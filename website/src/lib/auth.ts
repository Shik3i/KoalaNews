import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import { compare } from 'bcryptjs';
import { prisma } from './prisma';
import { checkRateLimit } from './rate-limit';

declare module 'next-auth' {
  // eslint-disable-next-line no-unused-vars
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role: string;
    };
  }
}

let pepperCache: string | null = null;

export async function getPepper(): Promise<string> {
  if (pepperCache) return pepperCache;
  const setting = await prisma.setting.findUnique({ where: { key: 'pepper' } });
  if (!setting?.value) {
    throw new Error('Password pepper is missing. Run scripts/init.mjs before accepting logins.');
  }
  pepperCache = setting.value;
  return pepperCache;
}

export function pepperPassword(password: string, pepper: string): string {
  return password + pepper;
}

function getAuthorizeIp(request: unknown): string {
  const headers = (request as { headers?: unknown })?.headers;
  if (headers && typeof (headers as Headers).get === 'function') {
    return (
      (headers as Headers).get('x-forwarded-for')?.split(',')[0]?.trim() ||
      (headers as Headers).get('x-real-ip')?.trim() ||
      'unknown'
    );
  }
  if (headers && typeof headers === 'object') {
    const record = headers as Record<string, string | string[] | undefined>;
    const forwarded = record['x-forwarded-for'];
    const value = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    return value?.split(',')[0]?.trim() || 'unknown';
  }
  return 'unknown';
}

async function findOrCreateOAuthUser(profile: { email: string; name?: string | null; image?: string | null }) {
  return prisma.user.upsert({
    where: { email: profile.email },
    create: {
      email: profile.email,
      name: profile.name || profile.email.split('@')[0],
      image: profile.image,
    },
    update: {
      name: profile.name ?? undefined,
      image: profile.image ?? undefined,
    },
  });
}

export const isGoogleOAuthConfigured =
  Boolean(process.env.GOOGLE_CLIENT_ID) && Boolean(process.env.GOOGLE_CLIENT_SECRET);

export const authOptions: NextAuthOptions = {
  providers: [
    ...(isGoogleOAuthConfigured
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
          }),
        ]
      : []),
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials, request) {
        if (!credentials?.email || !credentials?.password) return null;
        if (!(await checkRateLimit(`login:${getAuthorizeIp(request)}`, 10, 60_000))) return null;
        if (!(await checkRateLimit(`login-email:${credentials.email.toLowerCase()}`, 20, 15 * 60_000))) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email.trim().toLowerCase() },
        });
        if (!user) return null;
        if (user.banned) return null;
        if (!user.password) return null;

        const pepper = await getPepper();
        const isValid = await compare(
          pepperPassword(credentials.password, pepper),
          user.password,
        );
        if (!isValid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
        };
      },
    }),
  ],
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider === 'google') {
        if (!profile?.email) return false;
        const user = await findOrCreateOAuthUser({
          email: profile.email.trim().toLowerCase(),
          name: profile.name,
          image: (profile as any).picture,
        });
        if (user.banned) return false;
        (profile as any).dbUser = user;
      }
      return true;
    },
    async jwt({ token, user, account }) {
      if (account?.provider === 'google' && token.email) {
        const dbUser = await prisma.user.findUnique({ where: { email: token.email } });
        if (dbUser && !dbUser.banned) {
          token.id = dbUser.id;
          token.role = dbUser.role;
        }
      } else if (user) {
        token.id = user.id;
        token.role = (user as any).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (token?.id && token?.role && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    },
  },
};

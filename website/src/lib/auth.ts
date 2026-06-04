import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { compare } from 'bcryptjs';
import { prisma } from './prisma';

declare module 'next-auth' {
  // eslint-disable-next-line no-unused-vars
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      role: string;
    };
  }
}

let pepperCache: string | null = null;

export async function getPepper(): Promise<string> {
  if (pepperCache) return pepperCache;
  const setting = await prisma.setting.findUnique({ where: { key: 'pepper' } });
  pepperCache = setting?.value || '';
  return pepperCache;
}

export function pepperPassword(password: string, pepper?: string): string {
  return password + pepper;
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });
        if (!user) return null;
        if (user.banned) return null;

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
          role: user.role,
        };
      },
    }),
  ],
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    },
  },
};

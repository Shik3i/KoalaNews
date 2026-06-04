import { NextResponse } from 'next/server';
import { compare } from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { getPepper, pepperPassword } from '@/lib/auth';
import { signToken } from '@/lib/jwt';
import { checkRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    if (!checkRateLimit(`token:${ip}`, 10, 60000)) {
      return NextResponse.json({ error: 'too_many_requests' }, { status: 429 });
    }

    const { email, password } = await request.json();
    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
      return NextResponse.json({ error: 'invalid' }, { status: 400 });
    }

    const trimmedEmail = email.trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email: trimmedEmail } });
    if (!user) {
      return NextResponse.json({ error: 'invalid_credentials' }, { status: 401 });
    }

    if (user.banned) {
      return NextResponse.json({ error: 'account_banned' }, { status: 403 });
    }

    const pepper = await getPepper();
    const isValid = await compare(pepperPassword(password, pepper), user.password);
    if (!isValid) {
      return NextResponse.json({ error: 'invalid_credentials' }, { status: 401 });
    }

    const token = signToken(user.id, user.role);

    return NextResponse.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch {
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}

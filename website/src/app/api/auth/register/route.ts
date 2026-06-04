import { NextResponse } from 'next/server';
import { hash } from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { getPepper, pepperPassword } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';

export async function POST(request: Request) {
  try {
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    if (!checkRateLimit(`register:${ip}`, 5, 60000)) {
      return NextResponse.json({ error: 'too_many_requests' }, { status: 429 });
    }

    const setting = await prisma.setting.findUnique({
      where: { key: 'allow_registration' },
    });
    if (setting?.value === 'false') {
      return NextResponse.json({ error: 'registration_disabled' }, { status: 403 });
    }

    const { name, email, password } = await request.json();

    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
      return NextResponse.json({ error: 'missing' }, { status: 400 });
    }

    const trimmedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      return NextResponse.json({ error: 'invalid_email' }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: 'weak_password' }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email: trimmedEmail } });
    if (existing) {
      return NextResponse.json({ error: 'exists' }, { status: 409 });
    }

    const pepper = await getPepper();
    const hashedPassword = await hash(pepperPassword(password, pepper), 12);

    await prisma.user.create({
      data: { name: name || null, email: trimmedEmail, password: hashedPassword },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'server' }, { status: 500 });
  }
}

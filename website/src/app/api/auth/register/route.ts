import { NextResponse } from 'next/server';
import { hash } from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { pepperPassword } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const setting = await prisma.setting.findUnique({
      where: { key: 'allow_registration' },
    });
    if (setting?.value === 'false') {
      return NextResponse.json({ error: 'registration_disabled' }, { status: 403 });
    }

    const { name, email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'missing' }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: 'exists' }, { status: 409 });
    }

    const hashedPassword = await hash(pepperPassword(password), 12);

    await prisma.user.create({
      data: { name: name || null, email, password: hashedPassword },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'server' }, { status: 500 });
  }
}

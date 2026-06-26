import { NextResponse } from 'next/server';
import { hash } from 'bcryptjs';
import { asOptionalTrimmedString, asTrimmedString, getClientIp, jsonError, readJsonObject } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { getPepper, pepperPassword } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    if (!(await checkRateLimit(`register:${ip}`, 5, 60000))) {
      return jsonError('too_many_requests', 429);
    }

    const setting = await prisma.setting.findUnique({
      where: { key: 'allow_registration' },
    });
    if (setting?.value === 'false') {
      return jsonError('registration_disabled', 403);
    }

    const body = await readJsonObject(request);
    const name = asOptionalTrimmedString(body?.name, 80);
    const email = asTrimmedString(body?.email, 320);
    const password = asTrimmedString(body?.password, 512);
    if (!email || !password) {
      return jsonError('invalid', 400);
    }

    const trimmedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      return jsonError('invalid', 400);
    }
    if (password.length < 6) {
      return jsonError('invalid', 400);
    }

    const existing = await prisma.user.findUnique({ where: { email: trimmedEmail } });
    if (existing) {
      return NextResponse.json({ ok: true });
    }

    const pepper = await getPepper();
    const hashedPassword = await hash(pepperPassword(password, pepper), 12);

    await prisma.user.create({
      data: { name, email: trimmedEmail, password: hashedPassword },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return jsonError('server', 500);
  }
}

import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { hash } from 'bcryptjs';
import { asTrimmedString, jsonError, readJsonObject } from '@/lib/api';
import { getPepper, pepperPassword } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function POST(request: Request) {
  const body = await readJsonObject(request);
  const token = asTrimmedString(body?.token, 256);
  const password = asTrimmedString(body?.password, 512);
  if (!token || !password || password.length < 8) {
    return jsonError('invalid', 400);
  }

  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
  });
  if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
    return jsonError('invalid', 400);
  }

  const pepper = await getPepper();
  await prisma.$transaction([
    prisma.user.update({
      where: { id: resetToken.userId },
      data: { password: await hash(pepperPassword(password, pepper), 12) },
    }),
    prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: new Date() },
    }),
  ]);

  return NextResponse.json({ ok: true });
}

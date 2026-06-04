import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { asTrimmedString, getClientIp, jsonError, readJsonObject } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { checkRateLimit } from '@/lib/rate-limit';

function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function POST(request: Request) {
  if (!(await checkRateLimit(`password-reset:${getClientIp(request)}`, 5, 60 * 60_000))) {
    return jsonError('too_many_requests', 429);
  }

  const body = await readJsonObject(request);
  const email = asTrimmedString(body?.email, 320)?.toLowerCase();
  if (!email) return NextResponse.json({ ok: true });

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return NextResponse.json({ ok: true });

  const token = crypto.randomBytes(32).toString('base64url');
  await prisma.passwordResetToken.create({
    data: {
      tokenHash: hashToken(token),
      userId: user.id,
      expiresAt: new Date(Date.now() + 60 * 60_000),
    },
  });

  return NextResponse.json({
    ok: true,
    ...(process.env.NODE_ENV === 'production' ? {} : { resetToken: token }),
  });
}

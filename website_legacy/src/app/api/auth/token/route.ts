import { NextResponse } from 'next/server';
import { compare } from 'bcryptjs';
import { asTrimmedString, getClientIp, jsonError, readJsonObject } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { getPepper, pepperPassword } from '@/lib/auth';
import { signToken } from '@/lib/jwt';
import { checkRateLimit } from '@/lib/rate-limit';

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    if (!(await checkRateLimit(`token:${ip}`, 10, 60000))) {
      return jsonError('too_many_requests', 429);
    }

    const body = await readJsonObject(request);
    const email = asTrimmedString(body?.email, 320);
    const password = asTrimmedString(body?.password, 512);
    if (!email || !password) {
      return jsonError('invalid_credentials', 401);
    }

    const trimmedEmail = email.trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email: trimmedEmail } });
    if (!user) {
      return jsonError('invalid_credentials', 401);
    }

    if (user.banned) {
      return jsonError('invalid_credentials', 401);
    }

    if (!user.password) {
      return jsonError('invalid_credentials', 401);
    }

    const pepper = await getPepper();
    const isValid = await compare(pepperPassword(password, pepper), user.password);
    if (!isValid) {
      return jsonError('invalid_credentials', 401);
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
    return jsonError('server_error', 500);
  }
}

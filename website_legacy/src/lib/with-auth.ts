/* eslint-disable no-unused-vars */
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { isSafeSameOriginRequest } from '@/lib/api';
import { verifyToken } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';

type Handler = (
  request: Request,
  userId: string,
  role: string,
  ...args: any[]
) => Promise<Response>;

async function getCurrentUser(request: Request) {
  const auth = request.headers.get('authorization');
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;

  if (token) {
    const payload = verifyToken(token);
    if (!payload) return null;

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, role: true, banned: true },
    });
    if (!user || user.banned) return null;
    return user;
  }

  if (!isSafeSameOriginRequest(request)) return null;

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true, banned: true },
  });
  if (!user || user.banned) return null;
  return user;
}

export function requireAuth(handler: Handler) {
  return async (request: Request, ...args: any[]) => {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    return handler(request, user.id, user.role, ...args);
  };
}

export function requireAdmin(handler: Handler) {
  return requireAuth(async (request, userId, role, ...args: any[]) => {
    if (role !== 'ADMIN') {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    return handler(request, userId, role, ...args);
  });
}

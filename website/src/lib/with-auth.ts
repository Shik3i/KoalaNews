import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';

type Handler = (
  request: Request,
  userId: string,
  role: string,
) => Promise<Response>;

export function requireAuth(handler: Handler) {
  return async (request: Request) => {
    const auth = request.headers.get('authorization');
    const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;

    if (!token) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'invalid_token' }, { status: 401 });
    }

    return handler(request, payload.sub, payload.role);
  };
}

export function requireAdmin(handler: Handler) {
  return requireAuth(async (request, userId, role) => {
    if (role !== 'ADMIN') {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    return handler(request, userId, role);
  });
}

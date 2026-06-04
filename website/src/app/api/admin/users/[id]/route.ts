import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const targetUser = await prisma.user.findUnique({ where: { id: params.id } });
  if (!targetUser) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (targetUser.role === 'ADMIN' && body.role !== 'ADMIN') {
    const adminCount = await prisma.user.count({ where: { role: 'ADMIN' } });
    if (adminCount <= 1) {
      return NextResponse.json(
        { error: 'Cannot remove last admin' },
        { status: 400 },
      );
    }
  }

  const data: Record<string, unknown> = {};
  if (body.role) data.role = body.role;
  if (body.banned !== undefined) {
    data.banned = body.banned;
    data.bannedAt = body.banned ? new Date() : null;
    data.bannedReason = body.banned ? (body.reason ?? null) : null;
  }

  await prisma.user.update({ where: { id: params.id }, data });

  return NextResponse.json({ ok: true });
}

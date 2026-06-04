import { NextResponse } from 'next/server';
import { asBoundedInt } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/with-auth';

export const GET = requireAdmin(async (request) => {
  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get('cursor') ?? undefined;
  const q = searchParams.get('q')?.trim();
  const role = searchParams.get('role');
  const take = asBoundedInt(searchParams.get('take'), 25, 1, 100);

  const users = await prisma.user.findMany({
    where: {
      ...(q
        ? {
            OR: [
              { email: { contains: q } },
              { name: { contains: q } },
            ],
          }
        : {}),
      ...(role === 'ADMIN' || role === 'USER' ? { role } : {}),
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      banned: true,
      bannedAt: true,
      bannedReason: true,
      createdAt: true,
      _count: { select: { feeds: true } },
    },
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  return NextResponse.json({
    items: users.slice(0, take),
    nextCursor: users.length > take ? users[take].id : null,
  });
});

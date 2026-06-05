import { NextResponse } from 'next/server';
import { jsonError, readJsonObject, asTrimmedString } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/with-auth';

export const GET = requireAuth(async (_request, userId) => {
  const categories = await prisma.category.findMany({
    where: { userId },
    orderBy: { name: 'asc' },
    include: {
      feeds: {
        select: { id: true, url: true, title: true }
      }
    }
  });
  return NextResponse.json(categories);
});

export const POST = requireAuth(async (request, userId) => {
  const body = await readJsonObject(request);
  const name = asTrimmedString(body?.name, 255);
  if (!name) return jsonError('invalid_name', 400);

  try {
    const category = await prisma.category.create({
      data: { name, userId }
    });
    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    if ((error as { code?: string }).code === 'P2002') {
      return jsonError('category_exists', 409);
    }
    return jsonError('could_not_create_category', 500);
  }
});

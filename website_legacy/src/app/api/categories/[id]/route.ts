import { NextResponse } from 'next/server';
import { jsonError, readJsonObject, asTrimmedString } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/with-auth';

export const PATCH = requireAuth(
  async (request: Request, userId, _role, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const body = await readJsonObject(request);
    const name = asTrimmedString(body?.name, 255);
    if (!name) return jsonError('invalid_name', 400);

    const category = await prisma.category.findFirst({
      where: { id, userId }
    });
    if (!category) return jsonError('not_found', 404);

    try {
      const updated = await prisma.category.update({
        where: { id },
        data: { name }
      });
      return NextResponse.json(updated);
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') {
        return jsonError('category_exists', 409);
      }
      return jsonError('could_not_update_category', 500);
    }
  }
);

export const DELETE = requireAuth(
  async (_request: Request, userId, _role, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;

    const category = await prisma.category.findFirst({
      where: { id, userId }
    });
    if (!category) return jsonError('not_found', 404);

    await prisma.category.delete({
      where: { id }
    });

    return NextResponse.json({ ok: true });
  }
);

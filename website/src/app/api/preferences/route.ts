import { NextResponse } from 'next/server';
import { DEFAULT_APPEARANCE, normalizeAppearance } from '@/lib/appearance';
import { jsonError, readJsonObject } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/with-auth';

export const GET = requireAuth(async (_request, userId) => {
  const preferences = await prisma.userPreference.findUnique({ where: { userId } });
  return NextResponse.json(preferences ?? { userId, ...DEFAULT_APPEARANCE });
});

export const PUT = requireAuth(async (request, userId) => {
  const body = await readJsonObject(request);
  if (!body) return jsonError('invalid_body', 400);

  const preferences = normalizeAppearance(body);
  const saved = await prisma.userPreference.upsert({
    where: { userId },
    create: { userId, ...preferences },
    update: preferences,
  });

  return NextResponse.json(saved);
});

import { NextResponse } from 'next/server';
import { jsonError, readJsonObject } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/with-auth';

const EDITABLE_SETTINGS = {
  allow_registration: ['true', 'false'],
} as const;

export const GET = requireAdmin(async () => {
  const settings = await prisma.setting.findMany({
    where: { key: { in: Object.keys(EDITABLE_SETTINGS) } },
  });
  const obj: Record<string, string> = {};
  for (const s of settings) obj[s.key] = s.value;
  return NextResponse.json(obj);
});

export const PUT = requireAdmin(async (request) => {
  const body = await readJsonObject(request);
  if (!body) return jsonError('invalid_body', 400);

  for (const [key, value] of Object.entries(body)) {
    const allowedValues = EDITABLE_SETTINGS[key as keyof typeof EDITABLE_SETTINGS];
    if (!allowedValues || typeof value !== 'string' || !(allowedValues as readonly string[]).includes(value)) {
      return jsonError('invalid_setting', 400);
    }

    await prisma.setting.upsert({
      where: { key },
      create: { key, value },
      update: { value },
    });
  }

  return NextResponse.json({ ok: true });
});

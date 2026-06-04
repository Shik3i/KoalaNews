import { NextResponse } from 'next/server';
import { compare, hash } from 'bcryptjs';
import {
  asOptionalTrimmedString,
  asTrimmedString,
  jsonError,
  readJsonObject,
} from '@/lib/api';
import { getPepper, pepperPassword } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/with-auth';

export const GET = requireAuth(async (_request, userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, image: true, password: true },
  });
  if (!user) return jsonError('not_found', 404);

  return NextResponse.json({
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image,
    hasPassword: Boolean(user.password),
  });
});

export const PATCH = requireAuth(async (request, userId) => {
  const body = await readJsonObject(request);
  if (!body) return jsonError('invalid_body', 400);

  const name = asOptionalTrimmedString(body.name, 80);
  const image = asOptionalTrimmedString(body.image, 2048);
  const currentPassword = asOptionalTrimmedString(body.currentPassword, 512);
  const newPassword = asOptionalTrimmedString(body.newPassword, 512);

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return jsonError('not_found', 404);

  const data: { name?: string | null; image?: string | null; password?: string } = {};
  if (body.name !== undefined) data.name = name;
  if (body.image !== undefined) {
    if (image && (!image.startsWith('/') || image.startsWith('//'))) {
      return jsonError('invalid_image_path', 400);
    }
    data.image = image;
  }

  if (newPassword !== null) {
    if (newPassword.length < 8) return jsonError('weak_password', 400);

    const pepper = await getPepper();
    if (user.password) {
      const current = asTrimmedString(currentPassword, 512);
      if (!current || !(await compare(pepperPassword(current, pepper), user.password))) {
        return jsonError('invalid_current_password', 400);
      }
    }
    data.password = await hash(pepperPassword(newPassword, pepper), 12);
  }

  await prisma.user.update({ where: { id: userId }, data });
  return NextResponse.json({ ok: true });
});

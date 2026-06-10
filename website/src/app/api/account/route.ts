import { NextResponse } from 'next/server';
import { compare, hash } from 'bcryptjs';
import { jsonError, readJsonObject } from '@/lib/api';
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

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return jsonError('not_found', 404);

  const data: { name?: string | null; image?: string | null; password?: string } = {};

  if (body.name !== undefined) {
    if (body.name === null || body.name === '') {
      data.name = null;
    } else if (typeof body.name === 'string') {
      const trimmed = body.name.trim();
      if (trimmed.length > 80) return jsonError('name_too_long', 400);
      data.name = trimmed || null;
    } else {
      return jsonError('invalid_name', 400);
    }
  }

  if (body.image !== undefined) {
    if (body.image === null || body.image === '') {
      data.image = null;
    } else if (typeof body.image === 'string') {
      const trimmed = body.image.trim();
      if (trimmed.length > 2048) return jsonError('image_path_too_long', 400);
      if (!trimmed.startsWith('/') || trimmed.startsWith('//')) {
        return jsonError('invalid_image_path', 400);
      }
      data.image = trimmed || null;
    } else {
      return jsonError('invalid_image', 400);
    }
  }

  if (body.newPassword !== undefined && body.newPassword !== null && body.newPassword !== '') {
    if (typeof body.newPassword !== 'string') return jsonError('invalid_new_password', 400);
    const newPassword = body.newPassword.trim();
    if (newPassword.length < 8) return jsonError('weak_password', 400);
    if (newPassword.length > 512) return jsonError('password_too_long', 400);

    const pepper = await getPepper();
    if (user.password) {
      if (typeof body.currentPassword !== 'string') {
        return jsonError('invalid_current_password', 400);
      }
      const currentPassword = body.currentPassword.trim();
      if (
        currentPassword.length > 512 ||
        !(await compare(pepperPassword(currentPassword, pepper), user.password))
      ) {
        return jsonError('invalid_current_password', 400);
      }
    }
    data.password = await hash(pepperPassword(newPassword, pepper), 12);
  }

  await prisma.user.update({ where: { id: userId }, data });
  return NextResponse.json({ ok: true });
});

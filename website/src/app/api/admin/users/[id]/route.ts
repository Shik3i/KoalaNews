import { NextResponse } from 'next/server';
import { asBoolean, asOptionalTrimmedString, jsonError, readJsonObject } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/with-auth';

export const PATCH = requireAdmin(async (
  request: Request,
  actingUserId,
  _role,
  { params }: { params: { id: string } },
) => {
  const body = await readJsonObject(request);
  if (!body) return jsonError('invalid_body', 400);

  const targetUser = await prisma.user.findUnique({ where: { id: params.id } });
  if (!targetUser) {
    return jsonError('not_found', 404);
  }

  const requestedRole = body.role === undefined ? undefined : asOptionalTrimmedString(body.role, 20);
  if (requestedRole !== undefined && requestedRole !== null && !['ADMIN', 'USER'].includes(requestedRole)) {
    return jsonError('invalid_role', 400);
  }

  const requestedBan = body.banned === undefined ? undefined : asBoolean(body.banned);
  if (requestedBan === null) return jsonError('invalid_banned', 400);

  if (targetUser.id === actingUserId && (requestedBan === true || requestedRole === 'USER')) {
    return jsonError('cannot_change_self', 400);
  }

  if (targetUser.role === 'ADMIN' && requestedRole === 'USER') {
    const adminCount = await prisma.user.count({ where: { role: 'ADMIN' } });
    if (adminCount <= 1) {
      return NextResponse.json(
        { error: 'cannot_remove_last_admin' },
        { status: 400 },
      );
    }
  }

  const data: Record<string, unknown> = {};
  if (requestedRole) data.role = requestedRole;
  if (requestedBan !== undefined) {
    data.banned = requestedBan;
    data.bannedAt = requestedBan ? new Date() : null;
    data.bannedReason = requestedBan ? asOptionalTrimmedString(body.reason, 500) : null;
  }

  await prisma.user.update({ where: { id: params.id }, data });

  return NextResponse.json({ ok: true });
});

import { NextResponse } from 'next/server';
import { getDatabaseInfo } from '@/lib/database-backups';
import { requireAdmin } from '@/lib/with-auth';

export const runtime = 'nodejs';

export const GET = requireAdmin(async () => {
  return NextResponse.json(await getDatabaseInfo());
});

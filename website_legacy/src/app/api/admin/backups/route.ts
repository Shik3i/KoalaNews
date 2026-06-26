import { NextResponse } from 'next/server';
import { createGfsBackup } from '@/lib/database-backups';
import { jsonError } from '@/lib/api';
import { requireAdmin } from '@/lib/with-auth';

export const runtime = 'nodejs';

export const POST = requireAdmin(async () => {
  try {
    return NextResponse.json(await createGfsBackup());
  } catch {
    return jsonError('backup_failed', 500);
  }
});

import { readFile } from 'node:fs/promises';
import { getBackupDownload } from '@/lib/database-backups';
import { jsonError } from '@/lib/api';
import { requireAdmin } from '@/lib/with-auth';

export const runtime = 'nodejs';

export const GET = requireAdmin(
  async (_request: Request, _userId, _role, { params }: { params: Promise<{ name: string }> }) => {
    const { name } = await params;
    const backup = await getBackupDownload(name);
    if (!backup) return jsonError('not_found', 404);

    const data = await readFile(backup.filePath);
    return new Response(data, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Length': String(backup.size),
        'Content-Disposition': `attachment; filename="${name}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  },
);

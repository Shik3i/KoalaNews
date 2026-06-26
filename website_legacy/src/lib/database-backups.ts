import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readdir, rename, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const BACKUP_PREFIX = 'koalanews-backup';
const BACKUP_RE = /^koalanews-backup-(daily|weekly|monthly)-([0-9W-]+)\.db$/;
const TRASH_TABLES = ['ArticleRead', 'Article', 'ImageCache'];

export type BackupInfo = {
  name: string;
  kind: 'daily' | 'weekly' | 'monthly';
  sizeBytes: number;
  sizeLabel: string;
  createdAt: string;
  downloadUrl: string;
  restoreCommands: string;
};

export function getSqliteDatabasePath() {
  const url = process.env.DATABASE_URL;
  if (!url?.startsWith('file:')) {
    throw new Error('DATABASE_URL must be a SQLite file URL');
  }

  const rawPath = url.slice('file:'.length).split('?')[0] || '';
  if (!rawPath) throw new Error('DATABASE_URL is missing a file path');

  if (path.isAbsolute(rawPath)) return rawPath;
  return path.resolve(/*turbopackIgnore: true*/ process.cwd(), 'prisma', rawPath);
}

export async function getDatabaseInfo() {
  const databasePath = getSqliteDatabasePath();
  const databaseStats = existsSync(databasePath) ? await stat(databasePath) : null;
  const backupDir = getBackupDir(databasePath);

  return {
    path: databasePath,
    backupDir,
    sizeBytes: databaseStats?.size ?? 0,
    sizeLabel: formatBytes(databaseStats?.size ?? 0),
    backups: await listBackups(),
  };
}

export async function listBackups(): Promise<BackupInfo[]> {
  const databasePath = getSqliteDatabasePath();
  const backupDir = getBackupDir(databasePath);
  await mkdir(backupDir, { recursive: true });

  const entries = await readdir(backupDir);
  const backups = await Promise.all(
    entries.flatMap((name) => {
      const match = BACKUP_RE.exec(name);
      if (!match) return [];
      return [backupInfo(backupDir, name, match[1] as BackupInfo['kind'])];
    }),
  );

  return backups.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function createGfsBackup(now = new Date()) {
  const databasePath = getSqliteDatabasePath();
  if (!existsSync(databasePath)) throw new Error('SQLite database not found');

  const backupDir = getBackupDir(databasePath);
  await mkdir(backupDir, { recursive: true });

  const targets = [
    `${BACKUP_PREFIX}-daily-${formatDate(now)}.db`,
    `${BACKUP_PREFIX}-weekly-${formatIsoWeek(now)}.db`,
    `${BACKUP_PREFIX}-monthly-${formatMonth(now)}.db`,
  ];

  for (const target of targets) {
    await createSanitizedSnapshot(databasePath, path.join(backupDir, target));
  }

  await pruneBackups(backupDir);
  return getDatabaseInfo();
}

export async function getBackupDownload(name: string) {
  if (!BACKUP_RE.test(name)) return null;
  const backupDir = getBackupDir(getSqliteDatabasePath());
  const filePath = path.join(backupDir, name);
  if (!filePath.startsWith(`${backupDir}${path.sep}`) || !existsSync(filePath)) return null;
  const fileStats = await stat(filePath);
  return { filePath, size: fileStats.size };
}

function getBackupDir(databasePath: string) {
  return path.join(path.dirname(databasePath), 'backup');
}

async function createSanitizedSnapshot(databasePath: string, targetPath: string) {
  const tempPath = `${targetPath}.tmp-${process.pid}`;
  await rm(tempPath, { force: true });

  try {
    await execSqlite(databasePath, `VACUUM INTO ${quoteSqlString(tempPath)};`);
    await execSqlite(
      tempPath,
      [
        'PRAGMA foreign_keys=OFF;',
        ...TRASH_TABLES.map((table) => `DELETE FROM "${table}";`),
        'VACUUM;',
        'PRAGMA foreign_keys=ON;',
      ].join(' '),
    );
    await rename(tempPath, targetPath);
  } catch (error) {
    await rm(tempPath, { force: true });
    throw error;
  }
}

async function execSqlite(filePath: string, sql: string) {
  await execFileAsync('sqlite3', [filePath, sql], { timeout: 30_000 });
}

async function backupInfo(backupDir: string, name: string, kind: BackupInfo['kind']) {
  const filePath = path.join(backupDir, name);
  const fileStats = await stat(filePath);
  return {
    name,
    kind,
    sizeBytes: fileStats.size,
    sizeLabel: formatBytes(fileStats.size),
    createdAt: fileStats.mtime.toISOString(),
    downloadUrl: `/api/admin/backups/${encodeURIComponent(name)}`,
    restoreCommands: buildRestoreCommands(name),
  };
}

async function pruneBackups(backupDir: string) {
  const backups = await listBackups();
  const limits: Record<BackupInfo['kind'], number> = { daily: 7, weekly: 5, monthly: 12 };
  for (const kind of Object.keys(limits) as BackupInfo['kind'][]) {
    const stale = backups.filter((backup) => backup.kind === kind).slice(limits[kind]);
    await Promise.all(
      stale.map((backup) => rm(path.join(backupDir, backup.name), { force: true })),
    );
  }
}

function buildRestoreCommands(name: string) {
  return [
    'docker compose stop koalanews',
    'cp koalanews.db koalanews.db.old-$(date +%Y%m%d-%H%M%S)',
    `cp backup/${name} koalanews.db`,
    'docker compose start koalanews',
  ].join('\n');
}

function quoteSqlString(value: string) {
  return `'${value.replace(/'/g, "''")}'`;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unit = units.shift() ?? 'KB';
  while (value >= 1024 && units.length > 0) {
    value /= 1024;
    unit = units.shift() ?? unit;
  }
  return `${value.toFixed(value >= 10 ? 1 : 2)} ${unit}`;
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatMonth(date: Date) {
  return date.toISOString().slice(0, 7);
}

function formatIsoWeek(date: Date) {
  const normalized = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const day = normalized.getUTCDay() || 7;
  normalized.setUTCDate(normalized.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(normalized.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((normalized.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${normalized.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

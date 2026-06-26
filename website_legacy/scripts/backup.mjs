import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, rename, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const BACKUP_PREFIX = 'koalanews-backup';
const BACKUP_RE = /^koalanews-backup-(daily|weekly|monthly)-([0-9W-]+)\.db$/;
const TRASH_TABLES = ['ArticleRead', 'Article', 'ImageCache'];
const LIMITS = { daily: 7, weekly: 5, monthly: 12 };

async function loadDotEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!existsSync(envPath)) return;

  const text = await readFile(envPath, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separator = trimmed.indexOf('=');
    if (separator === -1) continue;

    const key = trimmed.slice(0, separator).trim();
    const rawValue = trimmed.slice(separator + 1).trim();
    if (!key || process.env[key] !== undefined) continue;
    process.env[key] = rawValue.replace(/^["']|["']$/g, '');
  }
}

function getSqliteDatabasePath() {
  const url = process.env.DATABASE_URL;
  if (!url?.startsWith('file:')) throw new Error('DATABASE_URL must be a SQLite file URL');

  const rawPath = url.slice('file:'.length).split('?')[0] || '';
  if (!rawPath) throw new Error('DATABASE_URL is missing a file path');
  if (path.isAbsolute(rawPath)) return rawPath;
  return path.resolve(process.cwd(), 'prisma', rawPath);
}

function getBackupDir(databasePath) {
  return path.join(path.dirname(databasePath), 'backup');
}

async function execSqlite(filePath, sql) {
  await execFileAsync('sqlite3', [filePath, sql], { timeout: 30_000 });
}

function quoteSqlString(value) {
  return `'${value.replace(/'/g, "''")}'`;
}

async function createSanitizedSnapshot(databasePath, targetPath) {
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

async function pruneBackups(backupDir) {
  const names = await readdir(backupDir);
  const backups = names
    .flatMap((name) => {
      const match = BACKUP_RE.exec(name);
      if (!match) return [];
      return [{ name, kind: match[1], path: path.join(backupDir, name) }];
    })
    .sort((a, b) => b.name.localeCompare(a.name));

  for (const kind of Object.keys(LIMITS)) {
    const stale = backups.filter((backup) => backup.kind === kind).slice(LIMITS[kind]);
    await Promise.all(stale.map((backup) => rm(backup.path, { force: true })));
  }
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function formatMonth(date) {
  return date.toISOString().slice(0, 7);
}

function formatIsoWeek(date) {
  const normalized = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = normalized.getUTCDay() || 7;
  normalized.setUTCDate(normalized.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(normalized.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((normalized.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${normalized.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

async function main() {
  await loadDotEnv();
  const databasePath = getSqliteDatabasePath();
  if (!existsSync(databasePath)) throw new Error(`SQLite database not found: ${databasePath}`);

  const backupDir = getBackupDir(databasePath);
  await mkdir(backupDir, { recursive: true });

  const now = new Date();
  const targets = [
    `${BACKUP_PREFIX}-daily-${formatDate(now)}.db`,
    `${BACKUP_PREFIX}-weekly-${formatIsoWeek(now)}.db`,
    `${BACKUP_PREFIX}-monthly-${formatMonth(now)}.db`,
  ];

  for (const target of targets) {
    await createSanitizedSnapshot(databasePath, path.join(backupDir, target));
  }

  await pruneBackups(backupDir);
  const databaseStats = await stat(databasePath);
  console.log('[backup] database:', databasePath);
  console.log('[backup] size:', databaseStats.size, 'bytes');
  console.log('[backup] directory:', backupDir);
  console.log('[backup] created:', targets.join(', '));
}

main().catch((error) => {
  console.error('[backup] Failed:', error);
  process.exit(1);
});

import { prisma } from './prisma';

const DEFAULT_RETENTION_DAYS = 14;
const DEFAULT_INTERVAL_HOURS = 24;

export function getRetentionDays() {
  const raw = process.env.KOALANEWS_RETENTION_DAYS ?? process.env.ARTICLE_RETENTION_DAYS ?? '';
  const days = Number(raw || DEFAULT_RETENTION_DAYS);
  if (!Number.isFinite(days) || days < 1) return DEFAULT_RETENTION_DAYS;
  return Math.floor(days);
}

function getCleanupIntervalHours() {
  const raw = process.env.KOALANEWS_CLEANUP_INTERVAL_HOURS ?? '';
  const hours = Number(raw || DEFAULT_INTERVAL_HOURS);
  if (!Number.isFinite(hours) || hours < 1) return DEFAULT_INTERVAL_HOURS;
  return Math.floor(hours);
}

export async function cleanupOldData(now = new Date()) {
  const days = getRetentionDays();
  const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  const [articles, images, resetTokens, rateLimits] = await prisma.$transaction([
    prisma.article.deleteMany({
      where: {
        OR: [
          { pubDate: { lt: cutoff } },
          { pubDate: null, createdAt: { lt: cutoff } },
        ],
      },
    }),
    prisma.imageCache.deleteMany({ where: { fetchedAt: { lt: cutoff } } }),
    prisma.passwordResetToken.deleteMany({
      where: {
        OR: [{ expiresAt: { lt: now } }, { usedAt: { not: null } }],
      },
    }),
    prisma.rateLimitEntry.deleteMany({ where: { resetAt: { lt: now } } }),
  ]);

  const orphanedSources = await prisma.sourceFeed.deleteMany({
    where: {
      subscriptions: { none: {} },
      articles: { none: {} },
    },
  });

  return {
    retentionDays: days,
    deletedArticles: articles.count,
    deletedCachedImages: images.count,
    deletedPasswordResetTokens: resetTokens.count,
    deletedRateLimitEntries: rateLimits.count,
    deletedOrphanedSourceFeeds: orphanedSources.count,
  };
}

export async function runScheduledCleanup(now = new Date()) {
  const intervalMs = getCleanupIntervalHours() * 60 * 60 * 1000;
  const key = 'cleanup:last_run';
  const setting = await prisma.setting.findUnique({ where: { key } });
  const lastRun = setting ? new Date(setting.value) : null;

  if (lastRun && Number.isFinite(lastRun.getTime()) && now.getTime() - lastRun.getTime() < intervalMs) {
    return null;
  }

  const result = await cleanupOldData(now);
  await prisma.setting.upsert({
    where: { key },
    create: { key, value: now.toISOString() },
    update: { value: now.toISOString() },
  });
  return result;
}

import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';

const url = process.env.DATABASE_URL || 'file:./dev.db';
const adapter = new PrismaLibSql({ url });
const prisma = new PrismaClient({ adapter });

function retentionDays() {
  const raw = process.env.KOALANEWS_RETENTION_DAYS ?? process.env.ARTICLE_RETENTION_DAYS ?? '14';
  const days = Number(raw);
  if (!Number.isFinite(days) || days < 1) return 14;
  return Math.floor(days);
}

async function main() {
  const days = retentionDays();
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

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
        OR: [{ expiresAt: { lt: new Date() } }, { usedAt: { not: null } }],
      },
    }),
    prisma.rateLimitEntry.deleteMany({ where: { resetAt: { lt: new Date() } } }),
  ]);

  const orphanedSources = await prisma.sourceFeed.deleteMany({
    where: {
      subscriptions: { none: {} },
      articles: { none: {} },
    },
  });

  console.log('[cleanup] retentionDays:', days);
  console.log('[cleanup] deleted articles:', articles.count);
  console.log('[cleanup] deleted cached images:', images.count);
  console.log('[cleanup] deleted password reset tokens:', resetTokens.count);
  console.log('[cleanup] deleted rate-limit entries:', rateLimits.count);
  console.log('[cleanup] deleted orphaned source feeds:', orphanedSources.count);
}

main()
  .catch((error) => {
    console.error('[cleanup] Failed:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

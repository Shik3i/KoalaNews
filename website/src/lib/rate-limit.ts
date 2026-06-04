import { prisma } from './prisma';

let lastCleanup = 0;

export async function checkRateLimit(key: string, max: number, windowMs: number): Promise<boolean> {
  const now = new Date();
  const resetAt = new Date(now.getTime() + windowMs);

  if (Date.now() - lastCleanup > 300_000) {
    lastCleanup = Date.now();
    await prisma.rateLimitEntry.deleteMany({ where: { resetAt: { lt: now } } });
  }

  const entry = await prisma.rateLimitEntry.findUnique({ where: { key } });

  if (!entry || entry.resetAt < now) {
    await prisma.rateLimitEntry.upsert({
      where: { key },
      create: { key, count: 1, resetAt },
      update: { count: 1, resetAt },
    });
    return true;
  }

  if (entry.count >= max) {
    return false;
  }

  await prisma.rateLimitEntry.update({
    where: { key },
    data: { count: { increment: 1 } },
  });
  return true;
}

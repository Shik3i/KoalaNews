import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';

const url = process.env.DATABASE_URL || 'file:./dev.db';
const adapter = new PrismaLibSql({ url });
const prisma = new PrismaClient({ adapter });

async function main() {
  const articles = await prisma.article.findMany({
    take: 10,
    select: {
      id: true,
      title: true,
      imageUrl: true,
      feedId: true,
      sourceFeedId: true,
    }
  });
  console.log('Total articles:', await prisma.article.count());
  console.log('Articles sample:', articles);
  
  const cacheCount = await prisma.imageCache.count();
  console.log('ImageCache count:', cacheCount);
}

main().catch(console.error).finally(() => prisma.$disconnect());

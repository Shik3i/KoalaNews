import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

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

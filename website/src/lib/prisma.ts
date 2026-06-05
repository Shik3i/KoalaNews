import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import path from 'path';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

let prismaInstance: PrismaClient;

if (globalForPrisma.prisma) {
  prismaInstance = globalForPrisma.prisma;
} else {
  let url = process.env.DATABASE_URL || 'file:./dev.db';
  if (url.startsWith('file:')) {
    const relativePath = url.substring(5);
    const absolutePath = path.resolve(process.cwd(), 'prisma', relativePath);
    url = `file:${absolutePath}`;
  }
  const adapter = new PrismaLibSql({ url });
  prismaInstance = new PrismaClient({ adapter });
}

export const prisma = prismaInstance;

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;


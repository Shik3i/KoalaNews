import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function initPrisma(): PrismaClient {
  if (!globalForPrisma.prisma) {
    const url = process.env.DATABASE_URL || '';
    const adapter = new PrismaLibSql({ url });
    globalForPrisma.prisma = new PrismaClient({ adapter });
  }
  return globalForPrisma.prisma;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_, p) {
    return initPrisma()[p as keyof PrismaClient];
  },
  set(_, p, v) {
    (initPrisma() as unknown as Record<string | symbol, unknown>)[p as string | symbol] = v;
    return true;
  },
});

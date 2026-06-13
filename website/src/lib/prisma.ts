import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function initPrisma(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = new PrismaClient();
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

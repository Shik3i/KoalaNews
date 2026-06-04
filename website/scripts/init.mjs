import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  const pepper = process.env.PEPPER || '';

  // --- Seed admin ---
  if (adminEmail && adminPassword) {
    const existing = await prisma.user.findUnique({ where: { email: adminEmail } });

    if (!existing) {
      const hashed = await hash(adminPassword + pepper, 12);
      await prisma.user.create({
        data: { email: adminEmail, password: hashed, name: 'Admin', role: 'ADMIN' },
      });
      console.log('[init] Admin account created:', adminEmail);
    } else if (existing.role !== 'ADMIN') {
      await prisma.user.update({
        where: { id: existing.id },
        data: { role: 'ADMIN' },
      });
      console.log('[init] User promoted to admin:', adminEmail);
    }
  }

  // --- Seed default settings ---
  const allowRegistration = process.env.ALLOW_REGISTRATION ?? 'true';
  await prisma.setting.upsert({
    where: { key: 'allow_registration' },
    create: { key: 'allow_registration', value: allowRegistration },
    update: { value: allowRegistration },
  });

  console.log('[init] Settings synced');
}

main()
  .catch((e) => {
    console.error('[init] Failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

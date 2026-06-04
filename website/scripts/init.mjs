import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function getOrCreatePepper(): Promise<string> {
  const existing = await prisma.setting.findUnique({ where: { key: 'pepper' } });
  if (existing) return existing.value;

  const newPepper = crypto.randomBytes(32).toString('hex');
  await prisma.setting.create({ data: { key: 'pepper', value: newPepper } });
  console.log('[init] Pepper generated and stored');
  return newPepper;
}

async function main() {
  const pepper = await getOrCreatePepper();

  // --- Seed admin (nur wenn KEIN Admin existiert) ---
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (adminEmail && adminPassword) {
    const existingAdmin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });

    if (existingAdmin) {
      console.log('[init] Admin already exists, skipping');
    } else {
      const existingUser = await prisma.user.findUnique({ where: { email: adminEmail } });
      if (existingUser) {
        await prisma.user.update({
          where: { id: existingUser.id },
          data: { role: 'ADMIN' },
        });
        console.log('[init] Existing user promoted to admin:', adminEmail);
      } else {
        const hashed = await hash(adminPassword + pepper, 12);
        await prisma.user.create({
          data: { email: adminEmail, password: hashed, name: 'Admin', role: 'ADMIN' },
        });
        console.log('[init] Admin account created:', adminEmail);
      }
    }
  }

  // --- Seed default settings (nur wenn noch nicht existieren) ---
  const allowRegistration = process.env.ALLOW_REGISTRATION ?? 'true';
  const regSetting = await prisma.setting.findUnique({ where: { key: 'allow_registration' } });
  if (!regSetting) {
    await prisma.setting.create({
      data: { key: 'allow_registration', value: allowRegistration },
    });
    console.log('[init] allow_registration set to:', allowRegistration);
  } else {
    console.log('[init] allow_registration already set to:', regSetting.value);
  }

  console.log('[init] Done');
}

main()
  .catch((e) => {
    console.error('[init] Failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

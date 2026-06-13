import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import bcrypt from 'bcryptjs';

const { hash } = bcrypt;

function dbPath() {
  const url = process.env.DATABASE_URL || 'file:./dev.db';
  const p = url.startsWith('file:') ? url.slice(5).split('?')[0] || '' : url;
  if (!p) throw new Error('Invalid DATABASE_URL');
  return p.startsWith('/') ? p : `/app/prisma/${p}`;
}

function db(sql) {
  return execFileSync('sqlite3', [dbPath(), sql], { encoding: 'utf8' }).trim();
}

function maskEmail(email) {
  const [name, domain] = email.split('@');
  return `${name.slice(0, 2)}***@${domain ?? 'unknown'}`;
}

async function getOrCreatePepper() {
  const existing = db("SELECT value FROM Setting WHERE key = 'pepper'");
  if (existing) return existing;
  const newPepper = crypto.randomBytes(32).toString('hex');
  db(`INSERT INTO Setting (key, value) VALUES ('pepper', '${newPepper.replace(/'/g, "''")}')`);
  console.log('[init] Pepper generated and stored');
  return newPepper;
}

async function main() {
  const pepper = await getOrCreatePepper();

  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (adminEmail && adminPassword) {
    const hasAdmin = db("SELECT 1 FROM User WHERE role = 'ADMIN' LIMIT 1");
    if (hasAdmin) {
      console.log('[init] Admin already exists, skipping');
    } else {
      const existingId = db(`SELECT id FROM User WHERE email = '${adminEmail.replace(/'/g, "''")}' LIMIT 1`);
      if (existingId) {
        const hashed = await hash(adminPassword + pepper, 12);
        db(`UPDATE User SET role = 'ADMIN', password = '${hashed.replace(/'/g, "''")}' WHERE id = '${existingId}'`);
        console.log('[init] Existing user promoted to admin:', maskEmail(adminEmail));
      } else {
        const hashed = await hash(adminPassword + pepper, 12);
        const id = crypto.randomUUID();
        db(`INSERT INTO User (id, email, password, name, role) VALUES ('${id}', '${adminEmail.replace(/'/g, "''")}', '${hashed.replace(/'/g, "''")}', 'Admin', 'ADMIN')`);
        console.log('[init] Admin account created:', maskEmail(adminEmail));
      }
    }
  }

  const allowRegistration = process.env.ALLOW_REGISTRATION ?? 'true';
  const regSetting = db("SELECT value FROM Setting WHERE key = 'allow_registration'");
  if (!regSetting) {
    db(`INSERT INTO Setting (key, value) VALUES ('allow_registration', '${allowRegistration.replace(/'/g, "''")}')`);
    console.log('[init] allow_registration set to:', allowRegistration);
  } else {
    console.log('[init] allow_registration already set to:', regSetting);
  }

  console.log('[init] Done');
}

main().catch((e) => {
  console.error('[init] Failed:', e);
  process.exit(1);
});

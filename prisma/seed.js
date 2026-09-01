require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

// Idempotent: safe to call on every server startup, not just once. The
// admin account is only created if that email doesn't already exist, so a
// fresh deploy is immediately usable without shell access, and a later
// redeploy never silently resets a password that's since been changed
// some other way.
async function runSeed(prisma) {
  const email = (process.env.ADMIN_EMAIL || 'admin@infopediatech.com').toLowerCase().trim();
  const existing = await prisma.adminUser.findUnique({ where: { email } });

  if (!existing) {
    const password = process.env.ADMIN_PASSWORD || 'infopedia-admin-change-me';
    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.adminUser.create({
      data: { email, passwordHash, name: process.env.ADMIN_NAME || 'Infopedia Admin' },
    });
    return { created: true, adminEmail: email };
  }

  return { created: false, adminEmail: email };
}

if (require.main === module) {
  const prisma = new PrismaClient();
  runSeed(prisma)
    .then((result) => {
      console.log(result.created ? `[seed] created admin: ${result.adminEmail}` : `[seed] admin already exists: ${result.adminEmail}`);
    })
    .catch((err) => {
      console.error('[seed] failed:', err);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}

module.exports = { runSeed };

const { PrismaClient } = require('@prisma/client');

// Reuse a single PrismaClient instance across the app (and across dev
// hot-reloads) to avoid exhausting DB connections — same pattern as the
// sibling Handa/PassNow backends.
const globalForPrisma = global;

const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

module.exports = prisma;

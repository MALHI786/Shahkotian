const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  __internal: {
    engine: { type: 'binary' }
  }
});

module.exports = prisma;

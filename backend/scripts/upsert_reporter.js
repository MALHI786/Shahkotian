const prisma = require('../src/config/database');
const bcrypt = require('bcryptjs');

async function main(){
  try {
    const pw = await bcrypt.hash('reporter123', 12);
    await prisma.newsReporter.upsert({
      where: { email: 'reporter@shahkotapp.com' },
      update: { password: pw, name: 'Shahkot News Reporter', isActive: true },
      create: { email: 'reporter@shahkotapp.com', password: pw, name: 'Shahkot News Reporter', isActive: true },
    });
    console.log('✅ reporter upserted');
  } catch (e) {
    console.error('Upsert error:', e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

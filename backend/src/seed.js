/**
 * Database Seed Script
 * Populates initial data for Shahkot App
 */

const prisma = require('./config/database');
const bcrypt = require('bcryptjs');

async function main() {
  console.log('🌱 Seeding Shahkot App database...\n');

  // ============ GOVERNMENT OFFICES ============
  console.log('📋 Adding Government Offices...');
  const offices = [
    {
      name: 'Tehsil Headquarter Hospital Shahkot',
      address: 'Hospital Road, Shahkot, District Nankana Sahib',
      helplines: ['056-3710022', '056-3710023'],
      timings: '24/7 Emergency, OPD: 8:00 AM - 2:00 PM',
      description: 'Main government hospital serving Shahkot and surrounding areas.',
      latitude: 31.9712,
      longitude: 73.4818,
    },
    {
      name: 'Tehsil Office Shahkot',
      address: 'Kachehri Road, Shahkot',
      helplines: ['056-3710001'],
      timings: 'Mon-Fri: 8:00 AM - 3:00 PM',
      description: 'Tehsil administration office for revenue and civic matters.',
      latitude: 31.9720,
      longitude: 73.4830,
    },
    {
      name: 'Police Station Shahkot',
      address: 'GT Road, Shahkot',
      helplines: ['15', '056-3710015'],
      timings: '24/7',
      description: 'Main police station of Shahkot.',
      latitude: 31.9705,
      longitude: 73.4810,
    },
    {
      name: 'Post Office Shahkot',
      address: 'Main Bazaar, Shahkot',
      helplines: ['056-3710030'],
      timings: 'Mon-Sat: 8:00 AM - 4:00 PM',
      description: 'Pakistan Post Office - Postal services and money orders.',
    },
    {
      name: 'NADRA Registration Center',
      address: 'Near Tehsil Office, Shahkot',
      helplines: ['1777', '056-3710040'],
      timings: 'Mon-Fri: 8:00 AM - 5:00 PM',
      description: 'CNIC registration and renewal services.',
    },
    {
      name: 'WAPDA / LESCO Office Shahkot',
      address: 'Railway Road, Shahkot',
      helplines: ['118', '056-3710050'],
      timings: 'Mon-Fri: 8:00 AM - 3:00 PM',
      description: 'Electricity bill payments, new connections, and complaint center.',
    },
    {
      name: 'Sui Gas Office (SNGPL)',
      address: 'GT Road, Shahkot',
      helplines: ['1199', '056-3710060'],
      timings: 'Mon-Fri: 8:00 AM - 3:00 PM',
      description: 'Gas connection services, billing, and emergency gas leakage complaints.',
    },
    {
      name: 'Revenue Office (Patwari)',
      address: 'Near Tehsil Complex, Shahkot',
      helplines: ['056-3710070'],
      timings: 'Mon-Fri: 9:00 AM - 2:00 PM',
      description: 'Land records, fard, and property transfer services.',
    },
  ];

  for (const office of offices) {
    await prisma.govtOffice.upsert({
      where: { id: office.name.replace(/\s/g, '-').toLowerCase().substring(0, 36) },
      update: office,
      create: office,
    });
  }
  console.log(`  ✅ ${offices.length} government offices added`);

  // ============ SHOPS ============
  console.log('🏪 Adding Shops...');
  const shops = [
    {
      name: 'Shahkot Mobile Market',
      address: 'Main Bazaar, Shahkot',
      contact: '0300-1234567',
      categories: ['mobile phones', 'accessories', 'chargers', 'covers', 'earphones'],
      description: 'All brands mobile phones, repair services, and accessories.',
    },
    {
      name: 'Al-Madina Cloth House',
      address: 'Mandi Road, Shahkot',
      contact: '0321-9876543',
      categories: ['clothing', 'fabric', 'suits', 'ready-made', 'unstitched'],
      description: 'Men and women clothing, wedding suits, and fabric.',
    },
    {
      name: 'Shahkot Electronics',
      address: 'GT Road, Shahkot',
      contact: '0333-5555666',
      categories: ['electronics', 'tv', 'fridge', 'washing machine', 'ac', 'fan'],
      description: 'Home appliances and electronics at best prices.',
    },
    {
      name: 'Khan Furniture House',
      address: 'Railway Road, Shahkot',
      contact: '0345-1112233',
      categories: ['furniture', 'bed', 'sofa', 'table', 'chair', 'wardrobe'],
      description: 'Custom and ready-made furniture for home and office.',
    },
    {
      name: 'Shahkot Sports Center',
      address: 'College Road, Shahkot',
      contact: '0312-4445556',
      categories: ['sports', 'cricket bat', 'football', 'shoes', 'gym equipment', 'sportswear'],
      description: 'All sports equipment and accessories.',
    },
    {
      name: 'Kitaab Ghar Shahkot',
      address: 'Near Govt High School, Shahkot',
      contact: '0303-7778889',
      categories: ['books', 'stationery', 'school supplies', 'notebooks', 'pens'],
      description: 'Books, stationery, and school/college supplies.',
    },
    {
      name: 'Shahkot Kirana Store',
      address: 'Main Bazaar, Shahkot',
      contact: '0300-9998887',
      categories: ['grocery', 'atta', 'rice', 'oil', 'spices', 'daily needs'],
      description: 'Daily grocery and household items.',
    },
    {
      name: 'Lucky Shoes Shahkot',
      address: 'Mandi Road, Shahkot',
      contact: '0341-6665554',
      categories: ['shoes', 'chappal', 'sandals', 'joggers', 'formal shoes'],
      description: 'Men, women, and kids footwear.',
    },
  ];

  for (const shop of shops) {
    await prisma.shop.create({ data: shop });
  }
  console.log(`  ✅ ${shops.length} shops added`);

  // ============ NEWS REPORTER (ADMIN ADDED) ============
  console.log('📰 Adding Sample News Reporter...');
  const reporterPassword = await bcrypt.hash('reporter123', 12);
  await prisma.newsReporter.create({
    data: {
      email: 'reporter@shahkotapp.com',
      password: reporterPassword,
      name: 'Shahkot News Reporter',
      isActive: true,
    },
  });
  console.log('  ✅ Sample reporter added (email: reporter@shahkotapp.com, password: reporter123)');

  console.log('\n🎉 Seeding complete! Shahkot App is ready.\n');
  console.log('Next steps:');
  console.log('1. Run: npm run dev');
  console.log('2. API available at: http://localhost:5000/api/health');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('Seed error:', e);
    await prisma.$disconnect();
    process.exit(1);
  });

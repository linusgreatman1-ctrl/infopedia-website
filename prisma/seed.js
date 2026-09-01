require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

// Idempotent: safe to call on every server startup, not just once. The
// admin account is only created if that email doesn't already exist, so a
// fresh deploy is immediately usable without shell access, and a later
// redeploy never silently resets a password that's since been changed
// some other way.
// The homepage's original hardcoded testimonials, seeded once so the
// switch to a DB-backed list doesn't blank the section out on deploy.
const DEFAULT_TESTIMONIALS = [
  { quote: "We came to Infopedia with a forecasting problem our old spreadsheets couldn't handle. Within weeks they had a model running against our real sales data, and the accuracy jump changed how we plan stock.", name: 'Chidinma Okafor', role: 'Operations Manager', company: 'Eagle System Company', avatar: 'CO', position: 0 },
  { quote: 'Our old website took forever to load and looked it. The team rebuilt it from scratch, and our checkout completion rate has been noticeably better since launch.', name: 'Udu Uomru', role: 'Founder', company: 'Deskon Ltd', avatar: 'UU', position: 1 },
  { quote: 'Migrating years of customer records without downtime was the part that worried me most. Infopedia planned it properly and it went through without a single support ticket.', name: 'Amaka Nwosu', role: 'IT Director', company: 'Pattern Financials', avatar: 'AN', position: 2 },
  { quote: "They didn't just write copy for us, they built a content plan tied to what our customers actually search for. Organic traffic has grown every month since we started.", name: 'Emeka Umeh', role: 'Marketing Lead', company: 'Delawga Legals', avatar: 'EU', position: 3 },
  { quote: "We sent five junior staff through the Tech Academy's web development track. All five are now shipping real features on our product — that's a faster ramp-up than any course we'd tried before.", name: 'Blessing Adeyemi', role: 'HR Manager', company: 'Coded Arts', avatar: 'BA', position: 4 },
  { quote: "Infopedia built the internal system we'd been patching together with spreadsheets for years. It's the first tool our operations team actually asked to keep using after the pilot.", name: 'Ibrahim Yusuf', role: 'CTO', company: 'Veltrix Technology Ltd', avatar: 'IY', position: 5 },
];

async function seedTestimonials(prisma) {
  const count = await prisma.testimonial.count();
  if (count > 0) return { created: false };
  await prisma.testimonial.createMany({ data: DEFAULT_TESTIMONIALS });
  return { created: true, count: DEFAULT_TESTIMONIALS.length };
}

async function runSeed(prisma) {
  const email = (process.env.ADMIN_EMAIL || 'admin@infopediatech.com').toLowerCase().trim();
  const existing = await prisma.adminUser.findUnique({ where: { email } });

  const testimonialsResult = await seedTestimonials(prisma);
  if (testimonialsResult.created) {
    console.log(`[seed] seeded ${testimonialsResult.count} default testimonials`);
  }

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

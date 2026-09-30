// ─── Database Seeder ─────────────────────────────────────────────────────────
// Seeds all databases with sample data for development/testing.
// Run from backend root: pnpm tsx scripts/seed.ts
import { PrismaPg } from '@prisma/adapter-pg';
import { randomUUID } from 'crypto';

// Database URLs from environment or local defaults
const AUTH_DB_URL = process.env.AUTH_DATABASE_URL || 'postgresql://ainrider:password@localhost:5434/ainrider_auth';
const ADMIN_DB_URL = process.env.ADMIN_DATABASE_URL || 'postgresql://ainrider:password@localhost:5435/ainrider_admin';
const TRIP_DB_URL = process.env.TRIP_DATABASE_URL || 'postgresql://ainrider:password@localhost:5436/ainrider_trip';

// Import Prisma clients dynamically
async function getPrismaClients() {
  const { PrismaClient: AuthPrisma } = await import('../apps/nest/auth-service/src/generated/prisma/index.js');
  const { PrismaClient: AdminPrisma } = await import('../apps/nest/admin-service/src/generated/prisma/index.js');
  const { PrismaClient: TripPrisma } = await import('../apps/nest/trip-service/src/generated/prisma/index.js');

  const authDb = new AuthPrisma({ adapter: new PrismaPg({ connectionString: AUTH_DB_URL }) });
  const adminDb = new AdminPrisma({ adapter: new PrismaPg({ connectionString: ADMIN_DB_URL }) });
  const tripDb = new TripPrisma({ adapter: new PrismaPg({ connectionString: TRIP_DB_URL }) });

  return { authDb, adminDb, tripDb };
}

// Helper functions (Safe deletion to bypass non-existent models if necessary)
const uuid = () => randomUUID();

async function main() {
  console.log('🚀 Starting database cleanup and seeding...\n');

  const { authDb, adminDb, tripDb } = await getPrismaClients();

  try {
    await Promise.all([authDb.$connect(), adminDb.$connect(), tripDb.$connect()]);

    // ─── Cleanup ───────────────────────────────────────────────────────────────
    console.log('🧹 Cleaning up existing data...');

    // Cleanup admin-service (Admin Panel data)
    // Using simple checks to avoid TS issues if some models are missing in specific envs
    const safeDelete = async (db: any, model: string) => {
      if (db[model]) await db[model].deleteMany();
    };

    // Correcting the model-service mapping:
    await safeDelete(adminDb, 'vehicle');
    await safeDelete(adminDb, 'vehicleModel');
    await safeDelete(adminDb, 'vehicleMake');
    await safeDelete(adminDb, 'vehicleType');
    await safeDelete(adminDb, 'promoUsage');
    await safeDelete(adminDb, 'promo');
    await safeDelete(adminDb, 'setting');
    await safeDelete(adminDb, 'complaintComment');
    await safeDelete(adminDb, 'complaint');
    await safeDelete(adminDb, 'adminAuditLog');
    await safeDelete(adminDb, 'notificationRead');
    await safeDelete(adminDb, 'notification');
    await safeDelete(adminDb, 'sOS'); // Prisma usually uses sOS for SOS model
    await safeDelete(adminDb, 'sOSAlerts'); // Fallback if name differs
    await safeDelete(adminDb, 'sos'); // Fallback if name differs
    await safeDelete(adminDb, 'booking');
    await safeDelete(adminDb, 'walletTransaction');
    await safeDelete(adminDb, 'withdrawal');
    await safeDelete(adminDb, 'wallet');
    await safeDelete(adminDb, 'userShadow');

    // Cleanup trip-service (Real-time Trip data)
    await safeDelete(tripDb, 'trip');
    await safeDelete(tripDb, 'sOS');
    await safeDelete(tripDb, 'sos');

    // Cleanup auth-service (Identity data)
    await safeDelete(authDb, 'refreshToken');
    await safeDelete(authDb, 'driverDocument');
    await safeDelete(authDb, 'rider');
    await safeDelete(authDb, 'driver');
    await safeDelete(authDb, 'vehicle');
    await safeDelete(authDb, 'user');

    console.log('  ✓ Cleanup complete');

    const bcrypt = await import('bcrypt');
    const password = await bcrypt.hash('password123', 10);

    // ─── Seed Admin Users ────────────────────────────────────────────────────────
    console.log('🌱 Seeding administrative users...');

    const adminUser = await authDb.user.create({
      data: {
        id: uuid(),
        email: 'admin@ainrider.com',
        phoneNumber: '+201000000001',
        passwordHash: password,
        firstName: 'مدير',
        lastName: 'النظام',
        role: 'ADMIN',
        status: 'ACTIVE',
      },
    });
    console.log('  ✓ Admin user');

    await authDb.user.create({
      data: {
        id: uuid(),
        email: 'support@ainrider.com',
        phoneNumber: '+201000000002',
        passwordHash: password,
        firstName: 'دعم',
        lastName: 'فني',
        role: 'SUPPORT',
        status: 'ACTIVE',
      },
    });
    console.log('  ✓ Support user');

    // ─── Seed Vehicle Types ──────────────────────────────────────────────────────
    console.log('🌱 Seeding vehicle services (VehicleTypes)...');

    const economyId = uuid();
    const comfortId = uuid();
    const premiumId = uuid();
    const suvId = uuid();

    const vehicleTypes = [
      { id: economyId, name: 'اقتصادي', type: 'ECONOMY', baseFare: 1500, perKmRate: 500, perMinuteRate: 100, minFare: 3000, maxPassengers: 4 },
      { id: comfortId, name: 'مريح', type: 'COMFORT', baseFare: 2000, perKmRate: 700, perMinuteRate: 150, minFare: 5000, maxPassengers: 4 },
      { id: premiumId, name: 'مميز', type: 'PREMIUM', baseFare: 3000, perKmRate: 1000, perMinuteRate: 200, minFare: 7500, maxPassengers: 4 },
      { id: suvId, name: 'دفع رباعي', type: 'SUV', baseFare: 2500, perKmRate: 800, perMinuteRate: 175, minFare: 6000, maxPassengers: 6 },
    ];

    for (const vt of vehicleTypes) {
      await adminDb.vehicleType.create({ data: vt });
    }
    console.log(`  ✓ ${vehicleTypes.length} Vehicle types seeded`);

    // ─── Seed Vehicle Catalog (Makes & Models) ───────────────────────────────────
    console.log('🌱 Seeding vehicle catalog (Makes & Models)...');

    const catalog = [
      {
        make: 'Toyota',
        models: [
          { name: 'Corolla', typeId: economyId },
          { name: 'Camry', typeId: comfortId },
          { name: 'Avalon', typeId: premiumId },
          { name: 'Land Cruiser', typeId: suvId },
          { name: 'Rav4', typeId: suvId },
        ]
      },
      {
        make: 'Hyundai',
        models: [
          { name: 'Elantra', typeId: economyId },
          { name: 'Sonata', typeId: comfortId },
          { name: 'Azera', typeId: premiumId },
          { name: 'Santa Fe', typeId: suvId },
          { name: 'Tucson', typeId: suvId },
        ]
      },
      {
        make: 'Kia',
        models: [
          { name: 'Cerato', typeId: economyId },
          { name: 'Optima', typeId: comfortId },
          { name: 'Cadenza', typeId: premiumId },
          { name: 'Sorento', typeId: suvId },
          { name: 'Sportage', typeId: suvId },
        ]
      },
      {
        make: 'Chevrolet',
        models: [
          { name: 'Spark', typeId: economyId },
          { name: 'Malibu', typeId: comfortId },
          { name: 'Impala', typeId: premiumId },
          { name: 'Tahoe', typeId: suvId },
        ]
      }
    ];

    for (const item of catalog) {
      const make = await adminDb.vehicleMake.create({
        data: { id: uuid(), name: item.make, isActive: true }
      });

      for (const model of item.models) {
        await adminDb.vehicleModel.create({
          data: {
            id: uuid(),
            makeId: make.id,
            name: model.name,
            vehicleTypeId: model.typeId,
            isActive: true
          }
        });
      }
    }
    console.log(`  ✓ Vehicle catalog seeded`);

    // ─── Seed Settings ───────────────────────────────────────────────────────────
    console.log('🌱 Seeding system settings...');

    const settings = [
      { key: 'app.name', value: 'عين رايدر', type: 'STRING', category: 'general', description: 'اسم التطبيق', isPublic: true },
      { key: 'app.currency', value: 'EGP', type: 'STRING', category: 'general', description: 'العملة الافتراضية', isPublic: true },
      { key: 'trip.cancellation_fee', value: '1000', type: 'NUMBER', category: 'trips', description: 'رسوم الإلغاء', isPublic: false },
      { key: 'driver.commission_rate', value: '15', type: 'NUMBER', category: 'drivers', description: 'نسبة العمولة (%)', isPublic: false },
    ];

    for (const s of settings) {
      await adminDb.setting.create({
        data: { ...s, updatedBy: 'system' }
      });
    }
    console.log(`  ✓ ${settings.length} Settings seeded`);

    // ─── Seed Promos ─────────────────────────────────────────────────────────────
    console.log('🌱 Seeding promotional codes...');

    const promos = [
      { code: 'WELCOME10', type: 'PERCENTAGE', value: 10, maxDiscount: 5000, description: 'خصم ترحيبي للمستخدمين الجدد' },
      { code: 'FLAT2000', type: 'FLAT', value: 2000, description: 'خصم ثابت 2000 جنيه' },
    ];

    for (const promo of promos) {
      await adminDb.promo.create({
        data: {
          ...promo,
          totalUsageLimit: 1000,
          maxUsagePerUser: 1,
          validFrom: new Date(),
          validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          status: 'ACTIVE',
          createdBy: adminUser.id,
        },
      });
    }
    // @TODO
    console.log(`  ✓ ${promos.length} Promos seeded`);

    console.log('\n✅ Database cleanup and seeding completed successfully!');
    console.log('\n📋 Admin credentials:');
    console.log('   Email: admin@ainrider.com');
    console.log('   Password: password123');

  } catch (error) {
    console.error('\n❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    await Promise.all([authDb.$disconnect(), adminDb.$disconnect(), tripDb.$disconnect()]);
  }
}

main();

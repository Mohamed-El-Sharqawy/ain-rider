// ─── Database Seeder ─────────────────────────────────────────────────────────
// Seeds all databases with sample data for development/testing.
// Run from backend root: pnpm tsx scripts/seed.ts
import { PrismaPg } from '@prisma/adapter-pg';

import { randomUUID } from 'crypto';

// Database URLs (using direct PostgreSQL connections, not PgBouncer)
const AUTH_DB_URL = process.env.AUTH_DATABASE_URL || 'postgresql://ainrider:password@localhost:5433/ainrider_auth';
const ADMIN_DB_URL = process.env.ADMIN_DATABASE_URL || 'postgresql://ainrider:password@localhost:5433/ainrider_admin';
const TRIP_DB_URL = process.env.TRIP_DATABASE_URL || 'postgresql://ainrider:password@localhost:5433/ainrider_trip';

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

// Helper functions
const uuid = () => randomUUID();

// Iraqi names for realistic data
const firstNames = ['أحمد', 'محمد', 'علي', 'حسين', 'حسن', 'عمر', 'خالد', 'يوسف', 'سعد', 'فاطمة', 'زينب', 'نور'];
const lastNames = ['العلي', 'الحسيني', 'الموسوي', 'الشمري', 'الجبوري', 'الربيعي', 'الدليمي', 'السعدي'];

const randomName = () => ({
  firstName: firstNames[Math.floor(Math.random() * firstNames.length)],
  lastName: lastNames[Math.floor(Math.random() * lastNames.length)],
});

const randomPhone = () => `+964${Math.floor(7000000000 + Math.random() * 900000000)}`;

// Baghdad coordinates for trips
const baghdadLocations = [
  { name: 'المنصور', lat: 33.3152, lng: 44.3661 },
  { name: 'الكرادة', lat: 33.3028, lng: 44.3941 },
  { name: 'الأعظمية', lat: 33.3619, lng: 44.3758 },
  { name: 'الكاظمية', lat: 33.3731, lng: 44.3397 },
  { name: 'زيونة', lat: 33.3217, lng: 44.4178 },
  { name: 'الجادرية', lat: 33.2892, lng: 44.4003 },
  { name: 'البياع', lat: 33.2856, lng: 44.3342 },
  { name: 'الشعب', lat: 33.3678, lng: 44.4119 },
];

async function main() {
  console.log('🚀 Starting database seeding...\n');
  
  const { authDb, adminDb, tripDb } = await getPrismaClients();
  
  try {
    await Promise.all([authDb.$connect(), adminDb.$connect(), tripDb.$connect()]);
    
    // Use bcrypt to hash password (simple hash for dev)
    const bcrypt = await import('bcrypt');
    const password = await bcrypt.hash('password123', 10);
    
    // ─── Seed Users ──────────────────────────────────────────────────────────────
    console.log('🌱 Seeding users...');
    
    const admin = await authDb.user.upsert({
      where: { email: 'admin@ainrider.com' },
      update: {},
      create: {
        id: uuid(),
        email: 'admin@ainrider.com',
        phoneNumber: '+9647700000001',
        passwordHash: password,
        firstName: 'مدير',
        lastName: 'النظام',
        role: 'ADMIN',
        status: 'ACTIVE',
      },
    });
    console.log('  ✓ Admin user');
    
    await authDb.user.upsert({
      where: { email: 'support@ainrider.com' },
      update: {},
      create: {
        id: uuid(),
        email: 'support@ainrider.com',
        phoneNumber: '+9647700000002',
        passwordHash: password,
        firstName: 'دعم',
        lastName: 'فني',
        role: 'SUPPORT',
        status: 'ACTIVE',
      },
    });
    console.log('  ✓ Support user');
    
    const riders: any[] = [];
    for (let i = 1; i <= 10; i++) {
      const name = randomName();
      const rider = await authDb.user.upsert({
        where: { email: `rider${i}@test.com` },
        update: {},
        create: {
          id: uuid(),
          email: `rider${i}@test.com`,
          phoneNumber: randomPhone(),
          passwordHash: password,
          ...name,
          role: 'RIDER',
          status: 'ACTIVE',
        },
      });
      await authDb.rider.upsert({
        where: { userId: rider.id },
        update: {},
        create: { userId: rider.id, rating: 4 + Math.random(), totalTrips: Math.floor(Math.random() * 50) },
      });
      riders.push(rider);
    }
    console.log('  ✓ 10 Riders');
    
    const drivers: any[] = [];
    for (let i = 1; i <= 5; i++) {
      const name = randomName();
      const driver = await authDb.user.upsert({
        where: { email: `driver${i}@test.com` },
        update: {},
        create: {
          id: uuid(),
          email: `driver${i}@test.com`,
          phoneNumber: randomPhone(),
          passwordHash: password,
          ...name,
          role: 'DRIVER',
          status: 'ACTIVE',
        },
      });
      await authDb.driver.upsert({
        where: { userId: driver.id },
        update: {},
        create: {
          userId: driver.id,
          licenseNumber: `IQ-${100000 + i}`,
          rating: 4 + Math.random(),
          totalTrips: Math.floor(Math.random() * 100),
          isOnline: Math.random() > 0.5,
        },
      });
      drivers.push(driver);
    }
    console.log('  ✓ 5 Drivers');
    
    // ─── Seed Vehicle Types ──────────────────────────────────────────────────────
    console.log('🌱 Seeding vehicle types...');
    
    const vehicleTypes = [
      { id: 'economy', name: 'اقتصادي', type: 'ECONOMY', baseFare: 1500, perKmRate: 500, perMinuteRate: 100, minFare: 3000, maxPassengers: 4 },
      { id: 'comfort', name: 'مريح', type: 'COMFORT', baseFare: 2000, perKmRate: 700, perMinuteRate: 150, minFare: 5000, maxPassengers: 4 },
      { id: 'premium', name: 'مميز', type: 'PREMIUM', baseFare: 3000, perKmRate: 1000, perMinuteRate: 200, minFare: 7500, maxPassengers: 4 },
      { id: 'suv', name: 'دفع رباعي', type: 'SUV', baseFare: 2500, perKmRate: 800, perMinuteRate: 175, minFare: 6000, maxPassengers: 6 },
    ];
    
    for (const vt of vehicleTypes) {
      await adminDb.vehicleType.upsert({ where: { id: vt.id }, update: vt, create: vt });
    }
    console.log(`  ✓ ${vehicleTypes.length} Vehicle types`);
    
    // ─── Seed Vehicles ───────────────────────────────────────────────────────────
    console.log('🌱 Seeding vehicles...');
    
    const makes = ['تويوتا', 'هيونداي', 'كيا', 'نيسان', 'مازدا'];
    const models = ['كامري', 'سوناتا', 'اوبتيما', 'التيما', 'مازدا 6'];
    const colors = ['أبيض', 'أسود', 'فضي', 'رمادي', 'أزرق'];
    
    for (let i = 0; i < drivers.length; i++) {
      const licensePlate = `بغداد-${10000 + i}`;
      await adminDb.vehicle.upsert({
        where: { licensePlate },
        update: {},
        create: {
          driverId: drivers[i].id,
          vehicleTypeId: vehicleTypes[i % vehicleTypes.length].id,
          make: makes[i % makes.length],
          model: models[i % models.length],
          year: 2020 + Math.floor(Math.random() * 4),
          color: colors[i % colors.length],
          licensePlate,
          registrationNumber: `REG-${200000 + i}`,
          insuranceNumber: `INS-${300000 + i}`,
          insuranceExpiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          status: 'ACTIVE',
        },
      });
    }
    console.log(`  ✓ ${drivers.length} Vehicles`);
    
    // ─── Seed Trips ──────────────────────────────────────────────────────────────
    console.log('🌱 Seeding trips...');
    
    const tripStatuses = ['COMPLETED', 'COMPLETED', 'COMPLETED', 'CANCELLED', 'IN_PROGRESS'];
    
    for (let i = 0; i < 20; i++) {
      const rider = riders[i % riders.length];
      const driver = drivers[i % drivers.length];
      const pickup = baghdadLocations[Math.floor(Math.random() * baghdadLocations.length)];
      const dropoff = baghdadLocations[Math.floor(Math.random() * baghdadLocations.length)];
      const status = tripStatuses[Math.floor(Math.random() * tripStatuses.length)];
      
      const distance = Math.random() * 15 + 2; // km
      const duration = Math.floor((distance * 3 + Math.random() * 10) * 60); // seconds
      const fare = Math.floor(1500 + distance * 500 + (duration / 60) * 100);
      const requestedAt = new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000);
      
      await tripDb.trip.create({
        data: {
          riderId: rider.id,
          driverId: status !== 'REQUESTED' ? driver.id : null,
          status,
          pickupLat: pickup.lat,
          pickupLng: pickup.lng,
          pickupAddress: `${pickup.name}، بغداد`,
          dropoffLat: dropoff.lat,
          dropoffLng: dropoff.lng,
          dropoffAddress: `${dropoff.name}، بغداد`,
          estimatedFare: fare,
          actualFare: status === 'COMPLETED' ? fare : null,
          distance: status === 'COMPLETED' ? distance * 1000 : null, // meters
          duration: status === 'COMPLETED' ? duration : null, // seconds
          paymentMethod: 'CASH',
          paymentStatus: status === 'COMPLETED' ? 'COLLECTED' : 'PENDING',
          requestedAt,
          matchedAt: status !== 'REQUESTED' ? new Date(requestedAt.getTime() + 60000) : null,
          startedAt: ['IN_PROGRESS', 'COMPLETED'].includes(status) ? new Date(requestedAt.getTime() + 120000) : null,
          completedAt: status === 'COMPLETED' ? new Date(requestedAt.getTime() + duration * 1000 + 120000) : null,
          cancelledAt: status === 'CANCELLED' ? new Date(requestedAt.getTime() + 90000) : null,
          cancellationReason: status === 'CANCELLED' ? 'تم الإلغاء من قبل الراكب' : null,
        },
      });
    }
    console.log('  ✓ 20 Trips');
    
    // ─── Seed Promos ─────────────────────────────────────────────────────────────
    console.log('🌱 Seeding promos...');
    
    const promos = [
      { code: 'WELCOME10', type: 'PERCENTAGE', value: 10, maxDiscount: 5000, description: 'خصم ترحيبي للمستخدمين الجدد' },
      { code: 'FLAT2000', type: 'FIXED', value: 2000, description: 'خصم ثابت 2000 دينار' },
      { code: 'WEEKEND15', type: 'PERCENTAGE', value: 15, maxDiscount: 7500, description: 'خصم نهاية الأسبوع' },
    ];
    
    for (const promo of promos) {
      await adminDb.promo.upsert({
        where: { code: promo.code },
        update: {},
        create: {
          ...promo,
          totalUsageLimit: 100,
          maxUsagePerUser: 3,
          validFrom: new Date(),
          validUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
          status: 'ACTIVE',
          createdBy: admin.id,
        },
      });
    }
    console.log(`  ✓ ${promos.length} Promos`);
    
    // ─── Seed Settings ───────────────────────────────────────────────────────────
    console.log('🌱 Seeding settings...');
    
    const settings = [
      { key: 'app.name', value: 'عين رايدر', type: 'STRING', category: 'general', description: 'اسم التطبيق', isPublic: true },
      { key: 'app.currency', value: 'IQD', type: 'STRING', category: 'general', description: 'العملة الافتراضية', isPublic: true },
      { key: 'trip.cancellation_fee', value: '1000', type: 'NUMBER', category: 'trips', description: 'رسوم الإلغاء', isPublic: false },
      { key: 'driver.commission_rate', value: '15', type: 'NUMBER', category: 'drivers', description: 'نسبة العمولة (%)', isPublic: false },
    ];
    
    for (const s of settings) {
      await adminDb.setting.upsert({ where: { key: s.key }, update: s, create: { ...s, updatedBy: 'system' } });
    }
    console.log(`  ✓ ${settings.length} Settings`);
    
    // ─── Seed Complaints ─────────────────────────────────────────────────────────
    console.log('🌱 Seeding complaints...');
    
    for (let i = 0; i < 5; i++) {
      const rider = riders[i % riders.length];
      const driver = drivers[i % drivers.length];
      const status = ['PENDING', 'IN_PROGRESS', 'RESOLVED'][i % 3];
      
      await adminDb.complaint.create({
        data: {
          complainantId: rider.id,
          complainantRole: 'RIDER',
          againstUserId: driver.id,
          type: 'DRIVER_BEHAVIOR',
          status,
          priority: ['LOW', 'MEDIUM', 'HIGH'][i % 3],
          subject: 'شكوى بخصوص الخدمة',
          description: 'تفاصيل الشكوى...',
          assignedTo: status !== 'PENDING' ? admin.id : null,
          resolution: status === 'RESOLVED' ? 'تم حل المشكلة' : null,
          resolvedAt: status === 'RESOLVED' ? new Date() : null,
        },
      });
    }
    console.log('  ✓ 5 Complaints');
    
    // ─── Seed Notifications ──────────────────────────────────────────────────────
    console.log('🌱 Seeding notifications...');
    
    const notificationTemplates = [
      // Push notifications
      { type: 'PUSH', title: 'مرحباً بك في عين رايدر!', body: 'شكراً لتسجيلك معنا. استمتع برحلات آمنة ومريحة.', priority: 'HIGH' },
      { type: 'PUSH', title: 'رحلتك في الطريق', body: 'السائق في طريقه إليك. يرجى الاستعداد.', priority: 'HIGH' },
      { type: 'PUSH', title: 'تم إكمال الرحلة', body: 'شكراً لاستخدامك عين رايدر. نتمنى لك يوماً سعيداً!', priority: 'MEDIUM' },
      { type: 'PUSH', title: 'عرض خاص لك!', body: 'احصل على خصم 20% على رحلتك القادمة. استخدم الكود: SPECIAL20', priority: 'MEDIUM' },
      { type: 'PUSH', title: 'تقييم رحلتك', body: 'كيف كانت تجربتك؟ شاركنا رأيك لتحسين خدماتنا.', priority: 'LOW' },
      
      // SMS notifications
      { type: 'SMS', title: 'رمز التحقق', body: 'رمز التحقق الخاص بك هو: 123456. لا تشاركه مع أحد.', priority: 'HIGH' },
      { type: 'SMS', title: 'تأكيد الحجز', body: 'تم تأكيد حجزك. السائق: أحمد العلي، رقم اللوحة: بغداد-10001', priority: 'HIGH' },
      { type: 'SMS', title: 'إشعار الدفع', body: 'تم خصم 5000 دينار من رصيدك لرحلة اليوم.', priority: 'MEDIUM' },
      
      // Email notifications
      { type: 'EMAIL', title: 'فاتورة رحلتك', body: 'مرفق فاتورة رحلتك من المنصور إلى الكرادة بتاريخ اليوم.', priority: 'LOW' },
      { type: 'EMAIL', title: 'تقرير الرحلات الشهري', body: 'إليك ملخص رحلاتك لهذا الشهر: 15 رحلة، إجمالي 75,000 دينار.', priority: 'LOW' },
      { type: 'EMAIL', title: 'تحديث سياسة الخصوصية', body: 'تم تحديث سياسة الخصوصية. يرجى مراجعتها في التطبيق.', priority: 'LOW' },
      { type: 'EMAIL', title: 'عرض نهاية الأسبوع', body: 'استمتع بخصم 15% على جميع رحلاتك هذا الأسبوع!', priority: 'MEDIUM' },
      
      // System notifications
      { type: 'SYSTEM', title: 'صيانة مجدولة', body: 'سيتم إجراء صيانة على النظام غداً من 2-4 صباحاً.', priority: 'MEDIUM' },
      { type: 'SYSTEM', title: 'تحديث التطبيق متاح', body: 'يتوفر تحديث جديد للتطبيق. قم بالتحديث للحصول على أفضل تجربة.', priority: 'LOW' },
      { type: 'SYSTEM', title: 'تم تفعيل حسابك', body: 'تهانينا! تم تفعيل حسابك بنجاح. يمكنك الآن البدء باستخدام التطبيق.', priority: 'HIGH' },
    ];
    
    let notificationCount = 0;
    for (const template of notificationTemplates) {
      // Create notification for random users
      const targetUsers = [...riders, ...drivers].slice(0, 5);
      for (const user of targetUsers) {
        const isRead = Math.random() > 0.6;
        const createdAt = new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000);
        
        await adminDb.notification.create({
          data: {
            userId: user.id,
            type: template.type,
            priority: template.priority,
            status: 'SENT',
            title: template.title,
            body: template.body,
            createdBy: admin.id,
            sentAt: createdAt,
            readAt: isRead ? new Date(createdAt.getTime() + Math.random() * 3600000) : null,
          },
        });
        notificationCount++;
      }
    }
    console.log(`  ✓ ${notificationCount} Notifications (PUSH, SMS, EMAIL, SYSTEM)`);
    
    console.log('\n✅ Database seeding completed successfully!');
    console.log('\n📋 Test credentials:');
    console.log('   Admin: admin@ainrider.com / password123');
    console.log('   Support: support@ainrider.com / password123');
    console.log('   Rider: rider1@test.com / password123');
    console.log('   Driver: driver1@test.com / password123');
    
  } catch (error) {
    console.error('\n❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    await Promise.all([authDb.$disconnect(), adminDb.$disconnect(), tripDb.$disconnect()]);
  }
}

main();

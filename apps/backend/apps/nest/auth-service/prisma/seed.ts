import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import * as bcrypt from "bcrypt";

async function main() {
  // Use DIRECT_URL to bypass PgBouncer — seeds need persistent session connections
  const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  const adapter = new PrismaPg({ connectionString });

  const prisma = new PrismaClient({ adapter });
  await prisma.$connect();

  // Seed Admin User
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env");
  }

  const adminPasswordHash = await bcrypt.hash(adminPassword, 10);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { passwordHash: adminPasswordHash },
    create: {
      email: adminEmail,
      phoneNumber: process.env.ADMIN_PHONE || "+9647700000000",
      passwordHash: adminPasswordHash,
      firstName: process.env.ADMIN_FIRST_NAME || "Admin",
      lastName: process.env.ADMIN_LAST_NAME || "User",
      role: "ADMIN",
      status: "ACTIVE",
    },
  });

  console.log(`[seed] Admin user upserted: ${admin.email} (id: ${admin.id})`);

  // Seed Support User
  const supportEmail = process.env.SUPPORT_EMAIL;
  const supportPassword = process.env.SUPPORT_PASSWORD;

  if (supportEmail && supportPassword) {
    const supportPasswordHash = await bcrypt.hash(supportPassword, 10);

    const support = await prisma.user.upsert({
      where: { email: supportEmail },
      update: { passwordHash: supportPasswordHash },
      create: {
        email: supportEmail,
        phoneNumber: process.env.SUPPORT_PHONE || "+9647700000001",
        passwordHash: supportPasswordHash,
        firstName: process.env.SUPPORT_FIRST_NAME || "Support",
        lastName: process.env.SUPPORT_LAST_NAME || "User",
        role: "SUPPORT",
        status: "ACTIVE",
      },
    });

    console.log(
      `[seed] Support user upserted: ${support.email} (id: ${support.id})`,
    );
  } else {
    console.log(
      "[seed] SUPPORT_EMAIL or SUPPORT_PASSWORD not set, skipping support user",
    );
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("[seed] Error:", err);
  process.exit(1);
});

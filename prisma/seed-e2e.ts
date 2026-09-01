import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  await prisma.labResult.deleteMany();
  await prisma.labOrder.deleteMany();
  await prisma.contact.deleteMany();

  const ana = await prisma.contact.create({
    data: {
      firstName: "Ana",
      lastName: "Torres",
      email: "ana.torres@example.com",
      phone: "+1-555-0101",
    },
  });

  const miguel = await prisma.contact.create({
    data: {
      firstName: "Miguel",
      lastName: "Fernandez",
      email: "miguel.fernandez@example.com",
      phone: "+1-555-0102",
    },
  });

  await prisma.labOrder.create({
    data: {
      orderNumber: "LO-E2E-001",
      testName: "Complete Blood Count",
      status: "PENDING",
      priority: "ROUTINE",
      orderedAt: new Date("2026-08-25T09:00:00Z"),
      contactId: ana.id,
    },
  });

  await prisma.labOrder.create({
    data: {
      orderNumber: "LO-E2E-002",
      testName: "Lipid Panel",
      status: "IN_PROGRESS",
      priority: "URGENT",
      orderedAt: new Date("2026-08-26T09:00:00Z"),
      contactId: ana.id,
    },
  });

  await prisma.labOrder.create({
    data: {
      orderNumber: "LO-E2E-003",
      testName: "Thyroid Panel",
      status: "COMPLETED",
      priority: "STAT",
      orderedAt: new Date("2026-08-20T09:00:00Z"),
      completedAt: new Date("2026-08-22T09:00:00Z"),
      contactId: miguel.id,
      result: {
        create: {
          summary: "TSH elevated significantly.",
          flag: "CRITICAL",
          reportedBy: "Dr. Elena Vasquez",
          reportedAt: new Date("2026-08-22T09:00:00Z"),
        },
      },
    },
  });

  await prisma.labOrder.create({
    data: {
      orderNumber: "LO-E2E-004",
      testName: "Urinalysis",
      status: "CANCELLED",
      priority: "ROUTINE",
      orderedAt: new Date("2026-08-18T09:00:00Z"),
      contactId: miguel.id,
    },
  });

  console.log("Seeded fixed e2e fixture data.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

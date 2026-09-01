import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const CONTACTS = [
  { firstName: "Ana", lastName: "Torres", email: "ana.torres@example.com", phone: "+1-555-0101" },
  { firstName: "Miguel", lastName: "Fernandez", email: "miguel.fernandez@example.com", phone: "+1-555-0102" },
  { firstName: "Laura", lastName: "Gomez", email: "laura.gomez@example.com", phone: "+1-555-0103" },
  { firstName: "Carlos", lastName: "Ruiz", email: "carlos.ruiz@example.com", phone: "+1-555-0104" },
  { firstName: "Sofia", lastName: "Martinez", email: "sofia.martinez@example.com", phone: "+1-555-0105" },
];

const TEST_NAMES = [
  "Complete Blood Count",
  "Basic Metabolic Panel",
  "Lipid Panel",
  "Thyroid Panel",
  "Urinalysis",
  "Hemoglobin A1C",
  "Liver Function Panel",
  "COVID-19 PCR",
];

function randomFrom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

async function main() {
  await prisma.labResult.deleteMany();
  await prisma.labOrder.deleteMany();
  await prisma.contact.deleteMany();

  const contacts = [];
  for (const data of CONTACTS) {
    contacts.push(await prisma.contact.create({ data }));
  }

  const statuses = ["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const;
  const priorities = ["ROUTINE", "URGENT", "STAT"] as const;

  let counter = 1;
  for (const contact of contacts) {
    const orderCount = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < orderCount; i++) {
      const status = randomFrom([...statuses]);
      const orderedAt = new Date(Date.now() - Math.floor(Math.random() * 14) * 24 * 60 * 60 * 1000);
      const order = await prisma.labOrder.create({
        data: {
          orderNumber: `LO-${String(counter).padStart(5, "0")}`,
          testName: randomFrom(TEST_NAMES),
          status,
          priority: randomFrom([...priorities]),
          orderedAt,
          completedAt: status === "COMPLETED" ? new Date(orderedAt.getTime() + 2 * 24 * 60 * 60 * 1000) : null,
          contactId: contact.id,
        },
      });
      counter++;

      if (status === "COMPLETED") {
        await prisma.labResult.create({
          data: {
            labOrderId: order.id,
            summary: "Results within expected reference range.",
            flag: randomFrom(["NORMAL", "NORMAL", "ABNORMAL", "CRITICAL"]),
            reportedBy: "Dr. Elena Vasquez",
          },
        });
      }
    }
  }

  console.log(`Seeded ${contacts.length} contacts and ${counter - 1} lab orders.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

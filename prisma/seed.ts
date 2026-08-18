// prisma/seed.ts — loads the CRM fixtures into Postgres. The actual logic lives in lib/seedDatabase so the
// "Reset demo" button (/api/reset) can restore the same baseline. found_contacts.csv is NOT loaded here —
// it enters through the ingest + hygiene path.
import { PrismaClient } from "@prisma/client";
import { seedDatabase } from "../lib/seedDatabase";

const prisma = new PrismaClient();

seedDatabase(prisma, (m) => console.log("  " + m))
  .then(() => console.log("Seed complete."))
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });

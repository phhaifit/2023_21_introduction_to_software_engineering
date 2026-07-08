import { PrismaClient, PrismaPg } from "@vcp/database";
import pg from "pg";

import { seedPlatformDemoData, PLATFORM_DEMO_PASSWORD, PLATFORM_DEMO_USERS } from "./platform-demo-seed.ts";

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required to seed the platform demo database.");
  }

  const pool = new pg.Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    const summary = await seedPlatformDemoData(prisma);
    const primaryUser = PLATFORM_DEMO_USERS[0];

    console.log("Platform demo seed completed.");
    console.log(`Users: ${summary.users}`);
    console.log(`Workspaces: ${summary.workspaces}`);
    console.log(`Memberships: ${summary.memberships}`);
    console.log(`Agents: ${summary.agents}`);
    console.log(`Workflows: ${summary.workflows}`);
    console.log(`Tasks: ${summary.tasks}`);
    console.log(`Documents: ${summary.documents}`);
    console.log(`Demo login: ${primaryUser.email} / ${PLATFORM_DEMO_PASSWORD}`);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

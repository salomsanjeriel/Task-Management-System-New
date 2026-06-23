import { PrismaClient } from '@prisma/client';

const url = "postgresql://postgres.clqxzwvaqnhsvupzvykq:MySimplePassword123TMS@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true";

const prisma = new PrismaClient({
  datasourceUrl: url,
});

async function main() {
  try {
    const user = await prisma.user.findFirst();
    console.log("Success Prisma native:", user);
  } catch (e) {
    console.error("Error Prisma native:", e);
  }
}

main();

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function run() {
  const c = await prisma.caseFollowUp.findFirst();
  console.log('CASE_ID:', c?.id || 'NOT_FOUND');
  process.exit(0);
}
run();

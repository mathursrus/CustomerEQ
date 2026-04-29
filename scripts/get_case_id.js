const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const caseFollowUp = await prisma.caseFollowUp.findFirst({
    select: { id: true }
  });
  console.log(JSON.stringify(caseFollowUp));
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});

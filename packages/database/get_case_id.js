const { PrismaClient } = require('./dist/index.js');
const prisma = new PrismaClient();

async function main() {
  const c = await prisma.case.findFirst({ select: { id: true } });
  if (c) {
    console.log(c.id);
  } else {
    console.log('NO_CASE_FOUND');
  }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

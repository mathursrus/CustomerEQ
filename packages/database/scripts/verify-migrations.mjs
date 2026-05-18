// Queries _prisma_migrations and exits 1 if any migration is incomplete.
// AC #3 of issue #386: belt-and-suspenders after prisma migrate deploy.
// Run from /app/packages/database so @prisma/client resolves from node_modules there.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
try {
  const incomplete = await prisma.$queryRaw`
    SELECT migration_name, applied_steps_count, steps_count, finished_at
    FROM "_prisma_migrations"
    WHERE applied_steps_count < steps_count
       OR (  finished_at IS NULL
          AND rolled_back_at IS NULL
          AND started_at IS NOT NULL)
  `;
  if (incomplete.length > 0) {
    console.error('ERROR: incomplete migrations detected:');
    for (const row of incomplete) {
      console.error(
        `  ${row.migration_name}: ${row.applied_steps_count}/${row.steps_count} steps applied, finished_at=${row.finished_at}`
      );
    }
    process.exit(1);
  }
  console.log('All migrations fully applied.');
} catch (e) {
  console.error('Migration verification query failed:', e);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}

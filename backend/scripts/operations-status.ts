import 'dotenv/config';
import { prisma } from '../src/utils/prisma';

async function main() {
  const alerts = await prisma.operationalAlert.groupBy({
    by: ['category', 'severity'],
    where: { status: 'OPEN' },
    _count: { _all: true },
  });
  const categories: Record<string, number> = {};
  let total = 0;
  let critical = 0;
  for (const alert of alerts) {
    categories[alert.category] = (categories[alert.category] || 0) + alert._count._all;
    total += alert._count._all;
    if (alert.severity === 'CRITICAL') critical += alert._count._all;
  }
  console.log(JSON.stringify({ open: total > 0, total, critical, categories }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());

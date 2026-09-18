import { prisma } from '../src/utils/prisma';
import { initializeWorkflowProject } from '../src/workflow/initialize';

async function backfill() {
  const organizationId = process.env.ORGANIZATION_ID || null;
  const defaultOwner = await prisma.user.findFirst({
    where: { role: 'ADMIN' },
    orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
  });
  const projects = await prisma.poolProject.findMany({ select: { id: true } });

  for (const project of projects) {
    await prisma.$transaction((tx) => initializeWorkflowProject(tx, project.id, {
      organizationId,
      ownerId: defaultOwner?.id || null,
    }));
  }

  const [properties, inquiries, stages, gates] = await Promise.all([
    prisma.property.count(),
    prisma.inquiry.count({ where: { projectId: { not: null } } }),
    prisma.lifecycleStage.count(),
    prisma.projectGate.count(),
  ]);

  const expectedStages = projects.length * 5;
  const expectedGates = projects.length * 4;
  if (inquiries < projects.length || stages < expectedStages || gates < expectedGates) {
    throw new Error(`Workflow backfill validation failed: projects=${projects.length}, inquiries=${inquiries}, stages=${stages}/${expectedStages}, gates=${gates}/${expectedGates}`);
  }

  console.log(`Workflow backfill complete: ${projects.length} projects, ${properties} properties, ${inquiries} converted inquiries, ${stages} stages, ${gates} gates.`);
}

backfill()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());

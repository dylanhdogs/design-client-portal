import { prisma } from '../src/utils/prisma';
import { initializeWorkflowProject } from '../src/workflow/initialize';
import { evaluateReceptionReadiness } from '../src/workflow/receptionCriteria';
import { saveCriterionState } from '../src/workflow/criterionState';

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

  // Seed conservative certainty metadata once. Canonical values stay in their
  // existing inquiry/client/property fields; non-empty legacy answers are not
  // upgraded to confirmed without an Admin review.
  const activeInquiries = await prisma.inquiry.findMany({
    where: { qualificationStatus: { in: ['NEW', 'IN_REVIEW', 'QUALIFIED'] } },
    include: {
      client: true,
      property: true,
      owner: { select: { id: true, role: true, active: true } },
      consultations: { where: { deletedAt: null } },
      workItems: { where: { deletedAt: null } },
      criterionStates: true,
    },
  });
  let seededCriterionStates = 0;
  for (const inquiry of activeInquiries) {
    if (inquiry.legacyReviewStatus !== 'PENDING') continue;
    const readiness = evaluateReceptionReadiness({
      ...inquiry,
      discovery: parseDiscovery(inquiry.discoveryData),
    });
    const existing = new Set(inquiry.criterionStates.map((state) => state.criterionId));
    await prisma.$transaction(async (tx) => {
      for (const criterion of readiness.criteria) {
        if (existing.has(criterion.id)) continue;
        await saveCriterionState(tx, {
          inquiryId: inquiry.id,
          criterionId: criterion.id,
          answerState: criterion.answerState,
          reason: criterion.answerState === 'NEEDS_REVIEW' ? 'Legacy answer requires explicit Admin confirmation.' : null,
          source: criterion.answerState === 'NEEDS_REVIEW' ? 'LEGACY_UNVERIFIED' : 'SYSTEM',
        });
        seededCriterionStates += 1;
      }
    });
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

  console.log(`Workflow backfill complete: ${projects.length} projects, ${properties} properties, ${inquiries} converted inquiries, ${stages} stages, ${gates} gates, ${seededCriterionStates} legacy criterion states seeded.`);
}

function parseDiscovery(value: string | null) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

backfill()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());

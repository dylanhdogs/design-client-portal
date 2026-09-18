import { Prisma, PrismaClient } from '@prisma/client';
import { LEGACY_PHASE_STAGE, LIFECYCLE_STAGES, STAGE_TRANSITIONS } from './constants';

type DbClient = PrismaClient | Prisma.TransactionClient;

function parseLegacyAddress(address: string) {
  const parts = address.split(',').map((part) => part.trim()).filter(Boolean);
  const statePostal = parts[2]?.match(/^([A-Za-z]{2})(?:\s+(\d{5}(?:-\d{4})?))?$/);
  return {
    address: parts[0] || address,
    city: parts[1] || null,
    state: statePostal?.[1]?.toUpperCase() || null,
    postalCode: statePostal?.[2] || null,
  };
}

function lifecycleFromLegacy(phases: Array<{ name: string; order: number; status: string }>) {
  const active = phases
    .filter((phase) => phase.status !== 'NOT_STARTED')
    .sort((a, b) => b.order - a.order)[0] || phases.sort((a, b) => a.order - b.order)[0];
  return active ? (LEGACY_PHASE_STAGE[active.name] || 'INQUIRY') : 'INQUIRY';
}

export async function initializeWorkflowProject(
  db: DbClient,
  projectId: string,
  options: { organizationId?: string | null; ownerId?: string | null } = {},
) {
  const project = await db.poolProject.findUnique({
    where: { id: projectId },
    include: { client: true, phases: true },
  });
  if (!project) throw new Error(`Project ${projectId} was not found during workflow initialization.`);

  const organizationId = options.organizationId || null;
  const currentStage = lifecycleFromLegacy(project.phases);
  const currentIndex = LIFECYCLE_STAGES.indexOf(currentStage);

  let property = await db.property.findFirst({ where: { clientId: project.clientId } });
  if (!property && project.client.address) {
    property = await db.property.create({
      data: {
        organizationId,
        clientId: project.clientId,
        ...parseLegacyAddress(project.client.address),
      },
    });
  }

  const existingInquiry = await db.inquiry.findFirst({ where: { projectId } });
  if (!existingInquiry) {
    await db.inquiry.create({
      data: {
        organizationId,
        clientId: project.clientId,
        propertyId: property?.id || null,
        projectId,
        source: 'LEGACY_BACKFILL',
        description: project.notes,
        objectives: project.poolType ? `${project.poolType}${project.poolShape ? ` — ${project.poolShape}` : ''}` : null,
        budgetExpectation: project.estimatedBudget,
        qualificationStatus: 'CONVERTED',
        ownerId: options.ownerId || null,
        convertedAt: project.createdAt,
        createdAt: project.client.createdAt,
      },
    });
  }

  for (const [index, stage] of LIFECYCLE_STAGES.entries()) {
    const status = index < currentIndex ? 'APPROVED' : index === currentIndex ? 'IN_PROGRESS' : 'NOT_STARTED';
    await db.lifecycleStage.upsert({
      where: { projectId_stage: { projectId, stage } },
      update: { organizationId },
      create: {
        organizationId,
        projectId,
        stage,
        status,
        ownerId: index === currentIndex ? options.ownerId || null : null,
        startedAt: index <= currentIndex ? project.createdAt : null,
        completedAt: index < currentIndex ? project.createdAt : null,
      },
    });
  }

  for (const transition of STAGE_TRANSITIONS) {
    await db.projectGate.upsert({
      where: {
        projectId_fromStage_toStage: { projectId, ...transition },
      },
      update: { organizationId },
      create: {
        organizationId,
        projectId,
        ...transition,
        status: LIFECYCLE_STAGES.indexOf(transition.fromStage) < currentIndex ? 'APPROVED' : 'PENDING',
        requiredItems: '[]',
      },
    });
  }

  await db.poolProject.update({
    where: { id: projectId },
    data: { currentLifecycleStage: currentStage },
  });
}

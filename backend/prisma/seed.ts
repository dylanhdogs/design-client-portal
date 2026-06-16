import bcrypt from 'bcryptjs';
import { prisma } from '../src/utils/prisma';

export const phaseTemplates = [
  {
    name: 'INTAKE',
    displayName: 'Initial Inquiry & Intake',
    order: 1,
    description: 'Record initial client information and project requirements',
    checklistItems: [
      { description: 'Record client contact info and property address', order: 1 },
      { description: 'Assess pool type preference (in-ground / above-ground)', order: 2 },
      { description: 'Determine primary use (recreation / fitness / aesthetic)', order: 3 },
      { description: 'Establish budget range', order: 4 },
      { description: 'Check HOA covenants and local restrictions', order: 5 },
      { description: 'Verify permit feasibility', order: 6 }
    ]
  },
  {
    name: 'SITE_EVALUATION',
    displayName: 'Site Evaluation',
    order: 2,
    description: 'Comprehensive site survey and feasibility assessment',
    checklistItems: [
      { description: 'Measure property and note sun exposure patterns', order: 1 },
      { description: 'Conduct soil perc test', order: 2 },
      { description: 'Verify equipment access and staging area', order: 3 },
      { description: 'Locate gas, electric, water, sewer lines', order: 4 },
      { description: 'Photograph and document existing conditions', order: 5 },
      { description: 'Check drainage patterns', order: 6 }
    ]
  },
  {
    name: 'DESIGN',
    displayName: 'Design & Conceptualization',
    order: 3,
    description: 'Pool design and feature selection',
    checklistItems: [
      { description: 'Complete client lifestyle interview', order: 1 },
      { description: 'Create rough sketch with pool shape and placement', order: 2 },
      { description: 'Select features (spa, tanning ledge, waterfall, lighting, heating)', order: 3 },
      { description: 'Choose finishes (plaster, pebble, glass tile)', order: 4 },
      { description: 'Select decking and coping materials', order: 5 },
      { description: 'Present 3D rendering to client', order: 6 },
      { description: 'Finalize design revisions', order: 7 }
    ]
  },
  {
    name: 'PROPOSAL',
    displayName: 'Proposal & Pricing',
    order: 4,
    description: 'Detailed proposal with cost breakdown and timeline',
    checklistItems: [
      { description: 'Prepare detailed scope of work', order: 1 },
      { description: 'Itemize material, labor, and equipment costs', order: 2 },
      { description: 'Add contingency (10-15%)', order: 3 },
      { description: 'List exclusions and optional upgrades', order: 4 },
      { description: 'Present timeline projection (permitting + construction + landscaping)', order: 5 },
      { description: 'Review and revise based on client feedback', order: 6 }
    ]
  },
  {
    name: 'CONTRACT',
    displayName: 'Contracting & Permitting',
    order: 5,
    description: 'Contract signing and permit acquisition',
    checklistItems: [
      { description: 'Finalize contract with progress payment schedule', order: 1 },
      { description: 'Sign contract and collect deposit', order: 2 },
      { description: 'Submit engineered drawings to building department', order: 3 },
      { description: 'Obtain structural engineering calculations (if needed)', order: 4 },
      { description: 'Receive permit approval', order: 5 }
    ]
  },
  {
    name: 'PRE_CONSTRUCTION',
    displayName: 'Pre-Construction Handoff',
    order: 6,
    description: 'Final preparation before construction begins',
    checklistItems: [
      { description: 'Conduct final walkthrough with client', order: 1 },
      { description: 'Confirm dimensions, equipment placement, scale markings', order: 2 },
      { description: 'Set construction start date', order: 3 },
      { description: 'Establish milestone communication cadence', order: 4 },
      { description: 'Archive signed plans, permits, soil report', order: 5 }
    ]
  }
];

export async function createPoolProjectWithPhases(clientId: string, data: {
  poolType?: string;
  poolShape?: string;
  dimensions?: string;
  estimatedBudget?: string;
  notes?: string;
}) {
  const project = await prisma.poolProject.create({
    data: {
      clientId,
      poolType: data.poolType || null,
      poolShape: data.poolShape || null,
      dimensions: data.dimensions || null,
      estimatedBudget: data.estimatedBudget || null,
      notes: data.notes || null,
      currentPhase: 1,
      status: 'INTAKE'
    }
  });

  for (const template of phaseTemplates) {
    const phase = await prisma.projectPhase.create({
      data: {
        projectId: project.id,
        name: template.name,
        displayName: template.displayName,
        order: template.order,
        description: template.description,
        status: template.order === 1 ? 'IN_PROGRESS' : 'NOT_STARTED',
        startDate: template.order === 1 ? new Date() : null
      }
    });

    for (const itemTemplate of template.checklistItems) {
      await prisma.checklistItem.create({
        data: {
          phaseId: phase.id,
          description: itemTemplate.description,
          order: itemTemplate.order,
          isCompleted: false
        }
      });
    }
  }

  return project;
}

async function seed() {
  const passwordHash = await bcrypt.hash('admin123', 10);
  
  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      passwordHash,
      name: 'Admin User',
      role: 'ADMIN'
    }
  });
  
  const staffPassword = await bcrypt.hash('staff123', 10);
  const staff = await prisma.user.upsert({
    where: { email: 'staff@example.com' },
    update: {},
    create: {
      email: 'staff@example.com',
      passwordHash: staffPassword,
      name: 'Staff User',
      role: 'STAFF'
    }
  });

  let demoClient = await prisma.client.findFirst({
    where: { email: 'client@example.com' }
  });

  if (!demoClient) {
    demoClient = await prisma.client.create({
      data: {
        name: 'Demo Client',
        company: 'Signature Exteriors Demo',
        email: 'client@example.com',
        phone: '555-0100',
        address: '123 Demo Backyard Lane, Phoenix, AZ',
        status: 'ACTIVE',
        notes: 'Demo client for client portal login testing.'
      }
    });
  }

  const existingProject = await prisma.poolProject.findUnique({
    where: { clientId: demoClient.id }
  });

  if (!existingProject) {
    await createPoolProjectWithPhases(demoClient.id, {
      poolType: 'In-Ground',
      poolShape: 'Freeform',
      dimensions: '32 ft x 16 ft',
      estimatedBudget: '$85,000 - $110,000',
      notes: 'Demo pool project for client portal walkthrough.'
    });
  }

  const clientPassword = await bcrypt.hash('client123', 10);
  await prisma.user.upsert({
    where: { email: 'client@example.com' },
    update: {
      passwordHash: clientPassword,
      name: 'Demo Client',
      role: 'CLIENT',
      clientId: demoClient.id
    },
    create: {
      email: 'client@example.com',
      passwordHash: clientPassword,
      name: 'Demo Client',
      role: 'CLIENT',
      clientId: demoClient.id
    }
  });
  
  console.log('Seed completed successfully!');
  console.log('Admin: admin@example.com / admin123');
  console.log('Staff: staff@example.com / staff123');
  console.log('Client: client@example.com / client123');
}

seed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

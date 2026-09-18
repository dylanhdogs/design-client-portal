import { prisma } from '../utils/prisma';
import { AppError } from '../utils/errors';

export interface WorkflowUser {
  id: string;
  role: string;
  clientId?: string;
}

export function requireInternal(user?: WorkflowUser) {
  if (!user || user.role !== 'ADMIN') {
    throw new AppError('Internal project access is required.', 403, 'FORBIDDEN');
  }
}

export async function assertActiveAssignee(
  userId: string | null | undefined,
  label: string,
  allowedRoles: string[] = ['ADMIN'],
) {
  if (!userId) return null;
  const user = await prisma.user.findFirst({
    where: { id: userId, active: true, role: { in: allowedRoles } },
    select: { id: true, role: true, clientId: true },
  });
  if (!user) {
    const eligibility = allowedRoles.includes('CLIENT') ? 'eligible' : 'internal';
    throw new AppError(`${label} must be an active ${eligibility} user.`, 400, 'VALIDATION_ERROR');
  }
  return user;
}

export async function assertProjectAccess(user: WorkflowUser | undefined, projectId: string) {
  if (!user) throw new AppError('Authentication is required.', 401, 'UNAUTHENTICATED');
  const project = await prisma.poolProject.findUnique({
    where: { id: projectId },
    include: { client: true },
  });
  if (!project || project.client.deletedAt !== null) throw new AppError('Project not found.', 404, 'NOT_FOUND');
  if (user.role === 'CLIENT' && (!user.clientId || user.clientId !== project.clientId)) {
    throw new AppError('You do not have access to this project.', 403, 'FORBIDDEN');
  }
  if (!['ADMIN', 'CLIENT'].includes(user.role)) {
    throw new AppError('You do not have access to this project.', 403, 'FORBIDDEN');
  }
  return project;
}

export async function canOverrideGate(user: WorkflowUser, projectId: string) {
  if (user.role === 'ADMIN') return true;
  return false;
}

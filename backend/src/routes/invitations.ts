import crypto from 'crypto';
import express from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { AppError } from '../utils/errors';
import { authenticate, authorize } from '../middleware/auth';
import { invitationLimiter } from '../middleware/rateLimits';
import { passwordSchema } from '../utils/password';
import { writeAuditEvent } from '../workflow/audit';

const router = express.Router();
const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

router.post('/clients/:clientId/invite', authenticate, authorize('ADMIN'), invitationLimiter, async (req, res, next) => {
  try {
    const { clientId } = req.params;
    const { email } = z.object({ email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()) }).parse(req.body);

    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client || client.deletedAt) throw new AppError('Client not found.', 404);

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) throw new AppError('A user with this email already exists.', 409);
    if (await prisma.user.findFirst({ where: { clientId, role: 'CLIENT' }, select: { id: true } })) {
      throw new AppError('This client already has a linked login. Resolve the existing account before inviting another.', 409, 'CONFLICT');
    }

    const existingInvite = await prisma.invitation.findFirst({
      where: { OR: [{ email }, { clientId, role: 'CLIENT' }], status: 'PENDING', expiresAt: { gt: new Date() } },
    });
    if (existingInvite) throw new AppError('An active invitation already exists for this email.', 409);

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await prisma.$transaction(async (tx) => {
      const invitation = await tx.invitation.create({
        data: { email, clientId, role: 'CLIENT', invitedById: (req as any).user.id, tokenHash: hashToken(token), expiresAt }
      });
      await writeAuditEvent(tx, {
        userId: (req as any).user.id, action: 'USER_INVITED', entityType: 'Invitation', entityId: invitation.id,
        requestId: (req as any).requestId, details: { email, role: 'CLIENT', clientId },
      });
    });

    const inviteLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/accept-invite?token=${token}`;
    if (process.env.NODE_ENV !== 'production') {
      console.info(`[Client Invitation] An invitation was created for ${email}.`);
    }

    res.status(201).json({
      message: 'Invitation created. Copy the link and share it securely.',
      inviteLink,
    });
  } catch (err) {
    next(err);
  }
});

const createInvitationSchema = z.object({
  email: z.string().trim().email().max(254),
  role: z.enum(['ADMIN', 'CLIENT']),
  clientId: z.string().trim().min(1).nullable().optional(),
}).strict();

router.get('/users/invitations', authenticate, authorize('ADMIN'), async (_req, res, next) => {
  try {
    const invitations = await prisma.invitation.findMany({
      where: { status: 'PENDING' },
      select: {
        id: true, email: true, role: true, clientId: true, status: true, expiresAt: true, createdAt: true,
        client: { select: { id: true, name: true, company: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(invitations);
  } catch (err) { next(err); }
});

router.post('/users/invitations', authenticate, authorize('ADMIN'), invitationLimiter, async (req, res, next) => {
  try {
    const data = createInvitationSchema.parse(req.body);
    const email = data.email.toLowerCase();
    const clientId = data.role === 'CLIENT' ? data.clientId || null : null;
    if (data.role === 'CLIENT' && !clientId) throw new AppError('Choose a client for a client invitation.', 400, 'VALIDATION_ERROR');
    const client = clientId ? await prisma.client.findFirst({ where: { id: clientId, deletedAt: null }, select: { id: true } }) : null;
    if (clientId && !client) throw new AppError('Choose an active client.', 400, 'VALIDATION_ERROR');
    if (data.role === 'CLIENT' && await prisma.user.findFirst({ where: { clientId, role: 'CLIENT' }, select: { id: true } })) {
      throw new AppError('This client already has a linked login. Resolve the existing account before inviting another.', 409, 'CONFLICT');
    }
    if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) throw new AppError('A user with this email already exists.', 409, 'CONFLICT');
    if (await prisma.invitation.findFirst({ where: { email, status: 'PENDING', expiresAt: { gt: new Date() } }, select: { id: true } })) {
      throw new AppError('An active invitation already exists for this email.', 409, 'CONFLICT');
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const invitation = await prisma.$transaction(async (tx) => {
      const created = await tx.invitation.create({
        data: { email, clientId, role: data.role, invitedById: (req as any).user.id, tokenHash: hashToken(token), expiresAt },
      });
      await writeAuditEvent(tx, {
        userId: (req as any).user.id, action: 'USER_INVITED', entityType: 'Invitation', entityId: created.id,
        requestId: (req as any).requestId, details: { email, role: data.role, clientId },
      });
      return created;
    });
    const inviteLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/accept-invite?token=${token}`;
    res.status(201).json({ id: invitation.id, email, role: data.role, expiresAt, inviteLink, message: 'Invitation created. Copy and share this one-time link privately.' });
  } catch (err) { next(err); }
});

router.post('/users/invitations/:id/resend', authenticate, authorize('ADMIN'), invitationLimiter, async (req, res, next) => {
  try {
    const existing = await prisma.invitation.findUnique({ where: { id: req.params.id }, include: { client: { select: { deletedAt: true } } } });
    if (!existing || existing.status !== 'PENDING') throw new AppError('Pending invitation not found.', 404, 'NOT_FOUND');
    if (existing.role === 'CLIENT' && (!existing.clientId || !existing.client || existing.client.deletedAt)) throw new AppError('Restore the linked client before resending this invitation.', 409, 'CONFLICT');
    if (await prisma.user.findUnique({ where: { email: existing.email }, select: { id: true } })) throw new AppError('An account already exists for this email.', 409, 'CONFLICT');
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await prisma.$transaction(async (tx) => {
      await tx.invitation.update({ where: { id: existing.id }, data: { token: null, tokenHash: hashToken(token), expiresAt, invitedById: (req as any).user.id } });
      await writeAuditEvent(tx, {
        userId: (req as any).user.id, action: 'USER_INVITATION_RESENT', entityType: 'Invitation', entityId: existing.id,
        requestId: (req as any).requestId, details: { email: existing.email, role: existing.role, clientId: existing.clientId },
      });
    });
    res.json({ inviteLink: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/accept-invite?token=${token}`, expiresAt, message: 'A new one-time invitation link was created. The previous link no longer works.' });
  } catch (err) { next(err); }
});

router.delete('/users/invitations/:id', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    const existing = await prisma.invitation.findUnique({ where: { id: req.params.id }, select: { id: true, email: true, role: true, clientId: true, status: true } });
    if (!existing || existing.status !== 'PENDING') throw new AppError('Pending invitation not found.', 404, 'NOT_FOUND');
    await prisma.$transaction(async (tx) => {
      await tx.invitation.update({ where: { id: existing.id }, data: { status: 'REVOKED', token: null, tokenHash: null } });
      await writeAuditEvent(tx, {
        userId: (req as any).user.id, action: 'USER_INVITATION_REVOKED', entityType: 'Invitation', entityId: existing.id,
        requestId: (req as any).requestId, details: { email: existing.email, role: existing.role, clientId: existing.clientId },
      });
    });
    res.json({ message: 'Invitation revoked.' });
  } catch (err) { next(err); }
});

router.get('/invite/:token', async (req, res, next) => {
  try {
    const { token } = req.params;

    const invitation = await prisma.invitation.findFirst({ where: { OR: [{ tokenHash: hashToken(token) }, { token }] } });
    if (!invitation) throw new AppError('Invitation not found.', 404);
    if (invitation.status !== 'PENDING') throw new AppError('Invitation has already been used.', 400);
    if (invitation.expiresAt < new Date()) throw new AppError('Invitation has expired.', 400);

    const client = invitation.clientId ? await prisma.client.findUnique({
      where: { id: invitation.clientId }, select: { name: true, company: true, deletedAt: true },
    }) : null;
    if (invitation.role === 'CLIENT' && (!client || client.deletedAt)) throw new AppError('Invitation is no longer available.', 404);

    res.json({ email: invitation.email, role: invitation.role, clientName: client?.name, clientCompany: client?.company });
  } catch (err) {
    next(err);
  }
});

router.post('/invite/:token/accept', invitationLimiter, async (req, res, next) => {
  try {
    const { token } = req.params;
    const { name, password } = z.object({
      name: z.string().trim().min(1, 'Enter your name.').max(100, 'Name must be no more than 100 characters.'),
      password: passwordSchema
    }).parse(req.body);

    const invitation = await prisma.invitation.findFirst({ where: { OR: [{ tokenHash: hashToken(token) }, { token }] }, include: { client: { select: { deletedAt: true } } } });
    if (!invitation) throw new AppError('Invitation not found.', 404);
    if (invitation.status !== 'PENDING') throw new AppError('Invitation has already been used.', 400);
    if (invitation.expiresAt < new Date()) throw new AppError('Invitation has expired.', 400);
    if (invitation.role === 'CLIENT' && (!invitation.clientId || !invitation.client || invitation.client.deletedAt)) throw new AppError('Invitation is no longer available.', 404);

    const existingUser = await prisma.user.findUnique({ where: { email: invitation.email } });
    if (existingUser) throw new AppError('A user with this email already exists.', 409);

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.$transaction(async (tx) => {
      const currentInvitation = await tx.invitation.findUnique({ where: { id: invitation.id }, include: { client: { select: { deletedAt: true } } } });
      if (!currentInvitation || currentInvitation.status !== 'PENDING' || currentInvitation.expiresAt < new Date() || (currentInvitation.role === 'CLIENT' && (!currentInvitation.clientId || !currentInvitation.client || currentInvitation.client.deletedAt))) {
        throw new AppError('Invitation is no longer available.', 409, 'CONFLICT');
      }
      if (currentInvitation.role === 'CLIENT' && await tx.user.findFirst({ where: { clientId: currentInvitation.clientId, role: 'CLIENT' }, select: { id: true } })) {
        throw new AppError('The client already has a login account. Ask an administrator to review this invitation.', 409, 'CONFLICT');
      }
      const created = await tx.user.create({
        data: { email: currentInvitation.email, passwordHash, name, role: currentInvitation.role, clientId: currentInvitation.role === 'CLIENT' ? currentInvitation.clientId : null },
      });
      await tx.invitation.update({ where: { id: currentInvitation.id }, data: { status: 'ACCEPTED', acceptedAt: new Date(), token: null, tokenHash: null } });
      await writeAuditEvent(tx, {
        userId: created.id, action: 'USER_INVITATION_ACCEPTED', entityType: 'User', entityId: created.id,
        requestId: (req as any).requestId, details: { invitationId: currentInvitation.id, role: currentInvitation.role },
      });
      return created;
    });

    res.status(201).json({ message: 'Account created successfully. You can now log in.', email: user.email, role: user.role });
  } catch (err) {
    next(err);
  }
});

export default router;

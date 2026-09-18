import crypto from 'crypto';
import express from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { AppError } from '../utils/errors';
import { authenticate, authorize } from '../middleware/auth';
import { logActivity } from '../utils/activity';
import { invitationLimiter } from '../middleware/rateLimits';
import { passwordSchema } from '../utils/password';

const router = express.Router();

router.post('/clients/:clientId/invite', authenticate, authorize('ADMIN'), invitationLimiter, async (req, res, next) => {
  try {
    const { clientId } = req.params;
    const { email } = z.object({ email: z.string().email() }).parse(req.body);

    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client || client.deletedAt) throw new AppError('Client not found.', 404);

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) throw new AppError('A user with this email already exists.', 409);

    const existingInvite = await prisma.invitation.findFirst({
      where: { email, clientId, status: 'PENDING', expiresAt: { gt: new Date() } }
    });
    if (existingInvite) throw new AppError('An active invitation already exists for this email.', 409);

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await prisma.invitation.create({
      data: { email, clientId, token, expiresAt }
    });

    const inviteLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/accept-invite?token=${token}`;
    if (process.env.NODE_ENV !== 'production') {
      console.info(`[Client Invitation] An invitation was created for ${email}.`);
    }

    logActivity((req as any).user.id, 'CREATE', 'Client', clientId, { inviteEmail: email });

    res.status(201).json({
      message: 'Invitation created. Copy the link and share it securely.',
      inviteLink,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/invite/:token', async (req, res, next) => {
  try {
    const { token } = req.params;

    const invitation = await prisma.invitation.findUnique({ where: { token } });
    if (!invitation) throw new AppError('Invitation not found.', 404);
    if (invitation.status !== 'PENDING') throw new AppError('Invitation has already been used.', 400);
    if (invitation.expiresAt < new Date()) throw new AppError('Invitation has expired.', 400);

    const client = await prisma.client.findUnique({
      where: { id: invitation.clientId },
      select: { name: true, company: true, deletedAt: true }
    });
    if (!client || client.deletedAt) throw new AppError('Invitation is no longer available.', 404);

    res.json({ email: invitation.email, clientName: client?.name, clientCompany: client?.company });
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

    const invitation = await prisma.invitation.findUnique({ where: { token }, include: { client: { select: { deletedAt: true } } } });
    if (!invitation) throw new AppError('Invitation not found.', 404);
    if (invitation.status !== 'PENDING') throw new AppError('Invitation has already been used.', 400);
    if (invitation.expiresAt < new Date()) throw new AppError('Invitation has expired.', 400);
    if (invitation.client.deletedAt) throw new AppError('Invitation is no longer available.', 404);

    const existingUser = await prisma.user.findUnique({ where: { email: invitation.email } });
    if (existingUser) throw new AppError('A user with this email already exists.', 409);

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.$transaction(async (tx) => {
      const currentInvitation = await tx.invitation.findUnique({ where: { id: invitation.id }, include: { client: { select: { deletedAt: true } } } });
      if (!currentInvitation || currentInvitation.status !== 'PENDING' || currentInvitation.expiresAt < new Date() || currentInvitation.client.deletedAt) {
        throw new AppError('Invitation is no longer available.', 409, 'CONFLICT');
      }
      const created = await tx.user.create({
        data: { email: currentInvitation.email, passwordHash, name, role: 'CLIENT', clientId: currentInvitation.clientId },
      });
      await tx.invitation.update({ where: { id: currentInvitation.id }, data: { status: 'ACCEPTED', acceptedAt: new Date() } });
      return created;
    });

    res.status(201).json({ message: 'Account created successfully. You can now log in.', email: user.email });
  } catch (err) {
    next(err);
  }
});

export default router;

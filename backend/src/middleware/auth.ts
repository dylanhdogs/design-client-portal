import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from '../utils/errors';
import { prisma } from '../utils/prisma';
import { getJwtSecret } from '../utils/env';
import { clearSessionCookies, parseCookies, requireCsrfForCookieAuth, SESSION_COOKIE } from '../utils/cookies';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    name: string;
    clientId?: string;
    sessionVersion: number;
  };
}

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authorization = req.headers.authorization;
    const bearerToken = authorization?.startsWith('Bearer ') && authorization.length > 7
      ? authorization.slice(7)
      : undefined;
    const cookieToken = parseCookies(req)[SESSION_COOKIE];
    const token = bearerToken || cookieToken;

    if (!token) {
      throw new AppError('Access denied. No token provided.', 401);
    }

    let decoded: any;
    try {
      decoded = jwt.verify(token, getJwtSecret()) as any;
    } catch {
      throw new AppError('Invalid token.', 401);
    }
    if (!bearerToken && cookieToken) requireCsrfForCookieAuth(req);
    const currentUser = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, email: true, role: true, name: true, clientId: true, sessionVersion: true, active: true, client: { select: { deletedAt: true } } },
    });
    if (!currentUser || !currentUser.active || decoded.sessionVersion !== currentUser.sessionVersion || (currentUser.role === 'CLIENT' && (!currentUser.clientId || !currentUser.client || currentUser.client.deletedAt !== null))) {
      clearSessionCookies(res);
      throw new AppError('Session is no longer valid. Please sign in again.', 401);
    }
    const { active: _active, client: _client, ...authenticatedUser } = currentUser;
    req.user = { ...authenticatedUser, clientId: authenticatedUser.clientId || undefined };
    next();
  } catch (error) {
    next(error);
  }
};

export const authorize = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new AppError('Access denied.', 403);
    }
    if (!roles.includes(req.user.role)) {
      throw new AppError('Access denied. Insufficient permissions.', 403);
    }
    next();
  };
};

// Middleware to restrict CLIENT users to only accessing their own client's data
export const restrictToOwnClient = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError('Access denied.', 403);
    }
    const clientId = req.params.clientId || req.params.id;
    if (!clientId || !(await prisma.client.findFirst({ where: { id: clientId, deletedAt: null }, select: { id: true } }))) {
      throw new AppError('Client not found.', 404, 'NOT_FOUND');
    }
    
    // Only the administrator has internal access. Legacy staff accounts are no longer supported.
    if (req.user.role === 'ADMIN') {
      return next();
    }
    
    // If user is CLIENT, verify they own this client
    if (req.user.role === 'CLIENT') {
      if (!req.user.clientId) {
        throw new AppError('Client account not properly linked.', 403);
      }
      
      if (req.user.clientId !== clientId) {
        throw new AppError('Access denied. You can only access your own data.', 403);
      }
    }
    
    next();
  } catch (err) {
    next(err);
  }
};

// Middleware to load clientId into JWT-decoded user for CLIENT users
export const loadClientData = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (req.user && req.user.role === 'CLIENT') {
      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { clientId: true }
      });
      
      if (user) {
        req.user.clientId = user.clientId || undefined;
      }
    }
    next();
  } catch (err) {
    next(err);
  }
};

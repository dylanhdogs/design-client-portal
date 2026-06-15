import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from '../utils/errors';
import { prisma } from '../utils/prisma';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    name: string;
    clientId?: string;
  };
}

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    throw new AppError('Access denied. No token provided.', 401);
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    req.user = decoded;
    next();
  } catch (err) {
    throw new AppError('Invalid token.', 401);
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
    
    // If user is ADMIN or STAFF, allow access
    if (req.user.role === 'ADMIN' || req.user.role === 'STAFF') {
      return next();
    }
    
    // If user is CLIENT, verify they own this client
    if (req.user.role === 'CLIENT') {
      const { clientId } = req.params;
      
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

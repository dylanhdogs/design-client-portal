import { AppError } from './errors';

export const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new AppError('JWT_SECRET environment variable is not set.', 500);
  }
  if (process.env.NODE_ENV === 'production' && secret.length < 32) {
    throw new AppError('JWT_SECRET must contain at least 32 characters in production.', 500);
  }
  return secret;
};

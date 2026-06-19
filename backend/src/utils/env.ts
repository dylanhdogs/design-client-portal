import { AppError } from './errors';

export const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new AppError('JWT_SECRET environment variable is not set.', 500);
  }
  return secret;
};

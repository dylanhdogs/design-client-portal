import path from 'path';
import { prisma } from './prisma';

export const getDatabasePath = (): string => {
  const databaseUrl = process.env.DATABASE_URL || 'file:./dev.db';
  if (!databaseUrl.startsWith('file:')) throw new Error('Only SQLite file DATABASE_URL values are supported.');
  const location = decodeURIComponent(databaseUrl.slice(5).split('?')[0]);
  return path.isAbsolute(location) ? path.normalize(location) : path.resolve(process.cwd(), 'prisma', location);
};

export const initializeDatabase = async (): Promise<void> => {
  await prisma.$connect();
  await prisma.$executeRawUnsafe('PRAGMA foreign_keys = ON');
  await prisma.$queryRawUnsafe('PRAGMA busy_timeout = 10000');
  await prisma.$queryRawUnsafe('PRAGMA journal_mode = WAL');
  const result = await prisma.$queryRawUnsafe<Array<{ integrity_check: string }>>('PRAGMA integrity_check');
  if (!result.length || result[0].integrity_check !== 'ok') throw new Error('SQLite integrity check failed.');
};

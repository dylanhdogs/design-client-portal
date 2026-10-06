import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { validateEnvironment } from '../src/utils/config';
import { getDatabasePath, initializeDatabase } from '../src/utils/database';
import { prisma } from '../src/utils/prisma';
import { getUploadDirectory } from '../src/utils/storage';

const checkDirectory = (directory: string, minimumFreeStorageBytes: number) => {
  fs.mkdirSync(directory, { recursive: true });
  fs.accessSync(directory, fs.constants.R_OK | fs.constants.W_OK);
  const stats = fs.statfsSync(directory);
  const availableBytes = stats.bavail * stats.bsize;
  if (availableBytes < minimumFreeStorageBytes) throw new Error(`${directory} has less than ${minimumFreeStorageBytes} bytes available.`);
  return { path: directory, availableBytes };
};

async function run() {
  const config = validateEnvironment();
  if (config.production && process.versions.node !== config.requiredNodeVersion) {
    throw new Error(`Node.js ${config.requiredNodeVersion} is required in production; found ${process.version}.`);
  }
  const databasePath = getDatabasePath();
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  if (!fs.existsSync(databasePath)) fs.writeFileSync(databasePath, '', { mode: 0o600, flag: 'wx' });
  fs.accessSync(databasePath, fs.constants.R_OK | fs.constants.W_OK);
  const uploads = checkDirectory(getUploadDirectory(), config.minimumFreeStorageBytes);
  const backups = checkDirectory(path.resolve(config.backupDirectory), config.minimumFreeStorageBytes);
  const manifests = checkDirectory(path.resolve(config.manifestDirectory), config.minimumFreeStorageBytes);
  if (config.production) {
    const frontendIndex = path.resolve(__dirname, '..', '..', 'frontend', 'dist', 'index.html');
    fs.accessSync(frontendIndex, fs.constants.R_OK);
  }
  await initializeDatabase();
  console.log(JSON.stringify({
    level: 'info',
    event: 'deployment_preflight_passed',
    node: process.version,
    reverseProxyMode: config.reverseProxyMode,
    databasePath,
    uploads,
    backups,
    manifests,
    backupEnabled: config.backupEnabled,
  }));
}

run().catch((error) => {
  console.error(JSON.stringify({ level: 'error', event: 'deployment_preflight_failed', message: String(error?.message || error) }));
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());

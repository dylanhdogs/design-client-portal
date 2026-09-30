import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { prisma } from '../src/utils/prisma';

const main = async () => {
const releaseId = process.env.RELEASE_ID?.trim();
if (!releaseId || !/^[A-Za-z0-9._-]+$/.test(releaseId)) {
  throw new Error('RELEASE_ID is required and may contain only letters, numbers, dots, underscores, and hyphens.');
}

const manifestDirectory = process.env.MANIFEST_DIR?.trim();
if (!manifestDirectory || !path.isAbsolute(manifestDirectory)) {
  throw new Error('MANIFEST_DIR must be an absolute persistent path.');
}

const packageJson = JSON.parse(await fs.readFile(path.resolve(__dirname, '..', 'package.json'), 'utf8'));
const migrations = await prisma.$queryRawUnsafe<Array<{ migration_name: string; finished_at: Date | null }>>(
  'SELECT migration_name, finished_at FROM _prisma_migrations WHERE rolled_back_at IS NULL ORDER BY finished_at ASC',
);
const configurationNames = [
  'NODE_ENV', 'HOST', 'PORT', 'FRONTEND_URL', 'CORS_ORIGINS', 'TRUST_PROXY_HOPS', 'STAGING_MODE',
  'DATABASE_URL', 'UPLOAD_DIR', 'BACKUP_DIR', 'BACKUP_ENABLED', 'BACKUP_SCHEDULER_MODE', 'BACKUP_RETENTION_DAYS', 'BACKUP_MAX_AGE_HOURS',
  'APP_INSTANCE_COUNT', 'ALLOW_UNSCANNED_COMPLEX_UPLOADS', 'MIN_FREE_STORAGE_BYTES',
  'JWT_SECRET', 'JWT_EXPIRES_IN', 'HEALTH_CHECK_TOKEN', 'BACKUP_ENCRYPTION_KEY', 'EXTERNAL_NOTIFICATION_MODE',
  'BRAVE_SEARCH_API_KEY',
  'DOCUMENT_RETENTION_DAYS', 'MANIFEST_DIR', 'PRIVACY_NOTICE_URL', 'SUPPORT_EMAIL',
  'ALERT_WEBHOOK_URL', 'ALERT_REPEAT_MINUTES', 'CPU_LOAD_PER_CORE_LIMIT', 'MEMORY_USED_PERCENT_LIMIT', 'CERTIFICATE_MIN_DAYS',
];

const manifest = {
  releaseId,
  createdAt: new Date().toISOString(),
  applicationVersion: packageJson.version,
  nodeVersion: process.version,
  platform: `${process.platform}-${process.arch}`,
  migrations: migrations.map((migration) => ({
    name: migration.migration_name,
    finishedAt: migration.finished_at?.toISOString() || null,
  })),
  configuredNames: configurationNames.filter((name) => process.env[name] !== undefined).sort(),
};

await fs.mkdir(manifestDirectory, { recursive: true });
const outputPath = path.join(manifestDirectory, `${releaseId}.json`);
await fs.writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx', mode: 0o640 });
await prisma.$disconnect();
console.info(JSON.stringify({ event: 'deployment_manifest_created', releaseId, outputPath }));
};

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  await prisma.$disconnect();
  process.exit(1);
});

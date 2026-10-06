import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { prisma } from '../src/utils/prisma';
import { getDatabasePath } from '../src/utils/database';
import { getUploadDirectory } from '../src/utils/storage';

const hashFile = async (filePath: string) => crypto.createHash('sha256').update(await fs.readFile(filePath)).digest('hex');

const listFiles = async (root: string, current = root): Promise<Array<{ path: string; bytes: number; sha256: string }>> => {
  const entries = await fs.readdir(current, { withFileTypes: true }).catch((error: NodeJS.ErrnoException) => error.code === 'ENOENT' ? [] : Promise.reject(error));
  const files: Array<{ path: string; bytes: number; sha256: string }> = [];
  for (const entry of entries) {
    const absolute = path.join(current, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) files.push(...await listFiles(root, absolute));
    if (entry.isFile()) {
      const stat = await fs.stat(absolute);
      files.push({ path: path.relative(root, absolute).replace(/\\/g, '/'), bytes: stat.size, sha256: await hashFile(absolute) });
    }
  }
  return files.sort((left, right) => left.path.localeCompare(right.path));
};

async function main() {
  if (process.env.MIGRATION_INVENTORY_ACK !== 'writes-frozen') {
    throw new Error('Set MIGRATION_INVENTORY_ACK=writes-frozen only after stopping application writes.');
  }
  const outputPath = path.resolve(process.argv[2] || 'data-inventory.json');
  if (await fs.stat(outputPath).then(() => true).catch(() => false)) throw new Error(`Inventory already exists: ${outputPath}`);
  await prisma.$queryRawUnsafe('PRAGMA wal_checkpoint(FULL)');
  const tableRows = await prisma.$queryRawUnsafe<Array<{ name: string }>>("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
  const tableCounts: Record<string, number> = {};
  for (const { name } of tableRows) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) throw new Error(`Unsafe database table name: ${name}`);
    const result = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(`SELECT COUNT(*) AS count FROM "${name}"`);
    tableCounts[name] = Number(result[0].count);
  }
  const databasePath = getDatabasePath();
  const uploads = await listFiles(getUploadDirectory());
  const inventory = {
    generatedAt: new Date().toISOString(),
    database: { bytes: (await fs.stat(databasePath)).size, sha256: await hashFile(databasePath), tableCounts },
    uploads: { count: uploads.length, bytes: uploads.reduce((sum, file) => sum + file.bytes, 0), files: uploads },
  };
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(inventory, null, 2)}\n`, { flag: 'wx', mode: 0o640 });
  console.info(JSON.stringify({ event: 'data_inventory_created', outputPath, uploadFiles: uploads.length, tables: tableRows.length }));
}

main().catch((error) => {
  console.error(String(error?.message || error));
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());

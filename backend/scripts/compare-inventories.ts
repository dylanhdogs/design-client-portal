import fs from 'node:fs/promises';
import path from 'node:path';

interface FileEntry { path: string; bytes: number; sha256: string }
interface Inventory {
  database: { bytes: number; sha256: string; tableCounts: Record<string, number> };
  uploads: { count: number; bytes: number; files: FileEntry[] };
}

const readInventory = async (filePath: string): Promise<Inventory> => {
  const parsed = JSON.parse(await fs.readFile(filePath, 'utf8')) as Inventory;
  if (!parsed?.database?.sha256 || !parsed.database.tableCounts || !Array.isArray(parsed?.uploads?.files)) {
    throw new Error(`Invalid inventory structure: ${filePath}`);
  }
  return parsed;
};

const main = async () => {
  if (process.env.MIGRATION_RECONCILIATION_ACK !== 'source-and-destination-writes-frozen') {
    throw new Error('Set MIGRATION_RECONCILIATION_ACK=source-and-destination-writes-frozen only after stopping writes in both environments.');
  }
  const [sourceArg, destinationArg, outputArg] = process.argv.slice(2);
  if (!sourceArg || !destinationArg || !outputArg) {
    throw new Error('Usage: compare-inventories.ts <source-inventory.json> <destination-inventory.json> <new-result.json>');
  }
  const sourcePath = path.resolve(sourceArg);
  const destinationPath = path.resolve(destinationArg);
  const outputPath = path.resolve(outputArg);
  if (await fs.stat(outputPath).then(() => true).catch(() => false)) throw new Error(`Comparison evidence already exists: ${outputPath}`);

  const [source, destination] = await Promise.all([readInventory(sourcePath), readInventory(destinationPath)]);
  const tableDifferences = [...new Set([...Object.keys(source.database.tableCounts), ...Object.keys(destination.database.tableCounts)])]
    .sort()
    .flatMap((table) => source.database.tableCounts[table] === destination.database.tableCounts[table] ? [] : [{
      table,
      source: source.database.tableCounts[table] ?? null,
      destination: destination.database.tableCounts[table] ?? null,
    }]);
  const sourceFiles = new Map(source.uploads.files.map((file) => [file.path, file]));
  const destinationFiles = new Map(destination.uploads.files.map((file) => [file.path, file]));
  const uploadDifferences = [...new Set([...sourceFiles.keys(), ...destinationFiles.keys()])]
    .sort()
    .flatMap((filePath) => {
      const left = sourceFiles.get(filePath);
      const right = destinationFiles.get(filePath);
      return left?.bytes === right?.bytes && left?.sha256 === right?.sha256 ? [] : [{
        path: filePath,
        source: left || null,
        destination: right || null,
      }];
    });
  const databaseExact = source.database.bytes === destination.database.bytes && source.database.sha256 === destination.database.sha256;
  const passed = databaseExact && tableDifferences.length === 0 && uploadDifferences.length === 0;
  const result = {
    comparedAt: new Date().toISOString(),
    sourceInventory: sourcePath,
    destinationInventory: destinationPath,
    databaseExact,
    tableDifferences,
    uploadDifferences,
    sourceSummary: { databaseBytes: source.database.bytes, uploadCount: source.uploads.count, uploadBytes: source.uploads.bytes },
    destinationSummary: { databaseBytes: destination.database.bytes, uploadCount: destination.uploads.count, uploadBytes: destination.uploads.bytes },
    passed,
  };
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, { flag: 'wx', mode: 0o640 });
  console.info(JSON.stringify({ event: 'data_inventories_compared', outputPath, passed, tableDifferences: tableDifferences.length, uploadDifferences: uploadDifferences.length }));
  if (!passed) process.exitCode = 1;
};

main().catch((error) => {
  console.error(String(error?.message || error));
  process.exitCode = 1;
});

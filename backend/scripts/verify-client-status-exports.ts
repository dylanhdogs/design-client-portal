import fs from 'node:fs/promises';
import path from 'node:path';
import ExcelJS from 'exceljs';
import { prisma } from '../src/utils/prisma';
import { buildClientStatusSnapshot, currentDateInZone } from '../src/reporting/clientStatus';
import { renderClientStatusPdf, renderClientStatusWorkbook } from '../src/reporting/clientStatusExports';

const outputDirectory = path.resolve(process.cwd(), 'output', 'report-verification');

async function main() {
  const project = await prisma.poolProject.findFirst({ where: { client: { deletedAt: null } }, include: { client: true } });
  if (!project) throw new Error('A project is required to verify report exports.');
  const built = await buildClientStatusSnapshot({ clientId: project.clientId, projectId: project.id, asOfDate: currentDateInZone() });
  await fs.mkdir(outputDirectory, { recursive: true });
  const pdf = await renderClientStatusPdf(built.snapshot, 'visual-verification');
  const xlsx = await renderClientStatusWorkbook(built.snapshot, 'visual-verification');
  const pdfPath = path.join(outputDirectory, 'client-status-report.pdf');
  const xlsxPath = path.join(outputDirectory, 'client-status-report.xlsx');
  await Promise.all([fs.writeFile(pdfPath, pdf), fs.writeFile(xlsxPath, xlsx)]);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(xlsx);
  if (workbook.worksheets.length !== 6) throw new Error('Workbook must contain six worksheets.');
  const required = ['Summary', 'Next Actions', 'Decisions & Approvals', 'Risks & Blockers', 'Recent Activity', 'Sources'];
  if (required.some((name) => !workbook.getWorksheet(name))) throw new Error('Workbook sheet contract is incomplete.');
  process.stdout.write(JSON.stringify({ state: built.snapshot.executiveStatus.state, currentActions: built.snapshot.nextActions.length, openRequirements: built.snapshot.actions.length, pdfPath, pdfBytes: pdf.length, xlsxPath, xlsxBytes: xlsx.length, sheets: workbook.worksheets.map((sheet) => ({ name: sheet.name, rows: sheet.rowCount, columns: sheet.columnCount })) }, null, 2));
}

main().finally(() => prisma.$disconnect());

import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { ClientStatusSnapshot, ReportAction, ReportRisk } from './clientStatus';

const COLORS = {
  navy: '#102A43', blue: '#2563EB', paleBlue: '#EAF2FF', green: '#16794A',
  amber: '#9A6700', red: '#B42318', gray: '#52606D', paleGray: '#F5F7FA',
  border: '#CBD5E1', white: '#FFFFFF', black: '#172B4D',
};

const stateColor = (state: string) => state === 'ON_TRACK' ? COLORS.green : state === 'BLOCKED' ? COLORS.red : state === 'ATTENTION_REQUIRED' ? COLORS.amber : COLORS.gray;
const human = (value: string | null | undefined) => value ? value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) : 'Not recorded';
const formatDate = (value: string | null | undefined, timeZone: string, includeTime = false) => {
  if (!value) return 'Not set';
  const date = new Date(value);
  return new Intl.DateTimeFormat('en-US', { timeZone, month: 'short', day: 'numeric', year: 'numeric', ...(includeTime ? { hour: 'numeric', minute: '2-digit' } : {}) }).format(date);
};
const money = (cents: number | null) => cents == null ? '—' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);

export async function renderClientStatusPdf(snapshot: ClientStatusSnapshot, reportId: string): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'LETTER', margins: { top: 48, right: 48, bottom: 24, left: 48 }, bufferPages: true, info: { Title: `${snapshot.client.name} — Daily Status Report`, Author: 'Signature Exteriors Design Portal', Subject: `Client status as of ${snapshot.report.asOfDate}` } });
  const chunks: Buffer[] = [];
  doc.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
  const complete = new Promise<Buffer>((resolve, reject) => { doc.on('end', () => resolve(Buffer.concat(chunks))); doc.on('error', reject); });
  const width = 516;

  const ensure = (height: number) => { if (doc.y + height > doc.page.height - 58) doc.addPage(); };
  const label = (text: string) => doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.gray).text(text.toUpperCase(), { characterSpacing: 0.7 });
  const section = (title: string) => { ensure(42); doc.moveDown(0.8); doc.font('Helvetica-Bold').fontSize(15).fillColor(COLORS.navy).text(title, 48, doc.y, { width }); doc.moveTo(48, doc.y + 5).lineTo(564, doc.y + 5).strokeColor(COLORS.border).lineWidth(0.7).stroke(); doc.moveDown(0.8); };
  const empty = (text: string) => { ensure(30); doc.roundedRect(48, doc.y, width, 28, 5).fill(COLORS.paleGray); doc.fillColor(COLORS.gray).font('Helvetica').fontSize(9).text(text, 59, doc.y + 9, { width: width - 22 }); doc.y += 32; };
  const actionRow = (item: ReportAction) => {
    const detail = [human(item.responsibility), item.owner || 'Unassigned', item.dueAt ? `Due ${formatDate(item.dueAt, snapshot.report.displayTimeZone)}` : 'No due date', item.overdueDays ? `${item.overdueDays}d overdue` : null].filter(Boolean).join(' · ');
    const descriptionHeight = item.description ? doc.heightOfString(item.description, { width: width - 32 }) : 0;
    const height = Math.max(48, 35 + descriptionHeight);
    ensure(height + 8); const y = doc.y;
    doc.roundedRect(48, y, width, height, 5).lineWidth(0.7).fillAndStroke(COLORS.white, COLORS.border);
    doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.black).text(item.title, 61, y + 10, { width: width - 28 });
    doc.font('Helvetica').fontSize(8).fillColor(item.overdueDays ? COLORS.red : COLORS.gray).text(detail, 61, doc.y + 4, { width: width - 28 });
    if (item.description) doc.fillColor(COLORS.gray).fontSize(8.5).text(item.description, 61, doc.y + 4, { width: width - 28 });
    doc.y = y + height + 8;
  };
  const riskRow = (item: ReportRisk) => {
    const body = [item.reason, item.mitigation ? `Mitigation: ${item.mitigation}` : null, item.owner ? `Owner: ${item.owner}` : null].filter(Boolean).join('\n');
    const height = Math.max(52, doc.heightOfString(body, { width: width - 76 }) + 24);
    ensure(height + 8); const y = doc.y;
    doc.roundedRect(48, y, width, height, 5).lineWidth(0.7).fillAndStroke(COLORS.white, COLORS.border);
    doc.roundedRect(48, y, 8, height, 5).fill(item.severity === 'HIGH' ? COLORS.red : item.severity === 'MEDIUM' ? COLORS.amber : COLORS.blue);
    doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.navy).text(`${human(item.severity)} · ${item.category}`, 68, y + 10, { width: width - 86 });
    doc.font('Helvetica').fontSize(8.5).fillColor(COLORS.black).text(body, 68, doc.y + 4, { width: width - 86 });
    doc.y = y + height + 8;
  };

  doc.rect(0, 0, doc.page.width, 126).fill(COLORS.navy);
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#BFD7FF').text('SIGNATURE EXTERIORS DESIGN PORTAL', 48, 37);
  doc.font('Helvetica-Bold').fontSize(23).fillColor(COLORS.white).text('Daily Client Status Report', 48, 58);
  doc.font('Helvetica').fontSize(10).fillColor('#D9E8FF').text(`${snapshot.client.name}${snapshot.client.company ? ` · ${snapshot.client.company}` : ''}`, 48, 92);
  doc.y = 148;
  const badge = human(snapshot.executiveStatus.state);
  doc.roundedRect(48, doc.y, 170, 27, 13).fill(stateColor(snapshot.executiveStatus.state));
  doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.white).text(badge.toUpperCase(), 61, doc.y + 9, { width: 145, align: 'center' });
  doc.font('Helvetica').fontSize(9).fillColor(COLORS.gray).text(`As of ${snapshot.report.asOfDate} · ${snapshot.report.displayTimeZone}`, 236, doc.y + 8, { width: 328, align: 'right' });
  doc.y += 44;
  doc.font('Helvetica').fontSize(11).fillColor(COLORS.black).text(snapshot.executiveStatus.summary, 48, doc.y, { width, lineGap: 3 });

  section('Current position');
  const currentY = doc.y;
  const cells = [
    ['Stage', human(snapshot.currentStage.stage)], ['Status', human(snapshot.currentStage.status)],
    ['Owner', snapshot.currentStage.owner || 'Unassigned'], ['Next milestone', snapshot.executiveStatus.nextMilestone ? human(snapshot.executiveStatus.nextMilestone) : 'Not recorded'],
  ];
  cells.forEach(([title, value], index) => { const x = 48 + (index % 2) * 264; const y = currentY + Math.floor(index / 2) * 55; doc.roundedRect(x, y, 252, 47, 5).fill(COLORS.paleGray); doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.gray).text(title.toUpperCase(), x + 12, y + 9); doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.navy).text(value, x + 12, y + 24, { width: 228 }); });
  doc.y = currentY + 108;

  section('Next actions');
  if (snapshot.nextActions.length) snapshot.nextActions.forEach(actionRow); else empty('No open next actions are recorded.');
  if (snapshot.actions.length > snapshot.nextActions.length) { section('Remaining open actions'); snapshot.actions.slice(snapshot.nextActions.length).forEach(actionRow); }
  section('Risks and blockers');
  if (snapshot.risks.length) snapshot.risks.forEach(riskRow); else empty('No current risks or blockers are recorded.');
  section('Decisions and approvals');
  const decisions = snapshot.decisions.filter((item) => !['APPROVED', 'REJECTED', 'CANCELLED'].includes(item.status));
  if (decisions.length) decisions.forEach((item) => actionRow({ id: item.id, sourceType: 'Decision', title: item.title, description: item.result, responsibility: 'LEADERSHIP', owner: item.decisionMaker, reviewer: null, status: item.status, priority: 'NORMAL', dueAt: item.dueAt, overdueDays: null, stage: null, costImpactCents: item.costImpact == null ? null : Math.round(item.costImpact * 100), scheduleImpactDays: null, sourcePath: item.sourcePath })); else empty('No pending decisions or approvals are recorded.');
  section('Completed today');
  if (snapshot.completedRecently.length) snapshot.completedRecently.forEach((item) => { ensure(34); doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.navy).text(`${formatDate(item.occurredAt, snapshot.report.displayTimeZone, true)} · ${human(item.eventType)}`, { continued: false }); doc.font('Helvetica').fontSize(9).fillColor(COLORS.black).text(item.description, { indent: 10 }); doc.moveDown(0.5); }); else empty('No completed activity is recorded for this reporting day.');
  if (snapshot.warnings.length) { section('Data-quality notes'); snapshot.warnings.forEach((warning) => { ensure(24); doc.font('Helvetica').fontSize(9).fillColor(COLORS.amber).text(`• ${warning}`, { width }); doc.moveDown(0.3); }); }
  section('Report record');
  doc.font('Helvetica').fontSize(8).fillColor(COLORS.gray).text(`Report ID: ${reportId}\nGenerated: ${formatDate(snapshot.report.generatedAt, snapshot.report.displayTimeZone, true)}\nSources: ${snapshot.sourceSummary.total} records · Fingerprint ${snapshot.sourceSummary.sourceFingerprint.slice(0, 16)}…`, { width });

  const range = doc.bufferedPageRange();
  for (let page = range.start; page < range.start + range.count; page += 1) {
    doc.switchToPage(page);
    if (page > 0) {
      doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.navy).text(`${snapshot.client.name} · ${snapshot.report.asOfDate} · ${reportId}`, 48, 18, { width, lineBreak: false });
      doc.moveTo(48, 34).lineTo(564, 34).strokeColor(COLORS.border).lineWidth(0.6).stroke();
    }
    doc.font('Helvetica').fontSize(8).fillColor(COLORS.gray).text('Internal operational report · Verify source records before external use', 48, doc.page.height - 34, { width: 390, lineBreak: false });
    doc.text(`Page ${page + 1} of ${range.count}`, 462, doc.page.height - 34, { width: 102, align: 'right', lineBreak: false });
  }
  doc.end();
  return complete;
}

export const sanitizeSpreadsheetCell = (value: unknown) => typeof value === 'string' && /^[=+\-@]/.test(value) ? `'${value}` : value;
const sheetHeader = (sheet: ExcelJS.Worksheet, headers: string[]) => {
  const row = sheet.addRow(headers);
  row.height = 25;
  row.eachCell((cell) => { cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF102A43' } }; cell.alignment = { vertical: 'middle' }; });
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } };
};
const finishSheet = (sheet: ExcelJS.Worksheet) => {
  sheet.eachRow((row, rowNumber) => { if (rowNumber > 1 && rowNumber % 2 === 1) row.eachCell((cell) => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F7FA' } }; }); row.eachCell((cell) => { cell.alignment = { vertical: 'top', wrapText: true }; cell.border = { bottom: { style: 'hair', color: { argb: 'FFCBD5E1' } } }; }); });
  sheet.columns.forEach((column) => { let max = 10; column.eachCell?.({ includeEmpty: true }, (cell) => { max = Math.max(max, String(cell.value ?? '').length + 2); }); column.width = Math.min(max, 45); });
};

export async function renderClientStatusWorkbook(snapshot: ClientStatusSnapshot, reportId: string): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Signature Exteriors Design Portal'; workbook.created = new Date(snapshot.report.generatedAt); workbook.subject = `Daily status for ${snapshot.client.name}`;
  const summary = workbook.addWorksheet('Summary', { properties: { tabColor: { argb: 'FF2563EB' } } });
  sheetHeader(summary, ['Field', 'Value']);
  [
    ['Client', snapshot.client.name], ['Company', snapshot.client.company], ['Property', snapshot.client.property], ['As-of date', new Date(`${snapshot.report.asOfDate}T12:00:00Z`)],
    ['Generated at', new Date(snapshot.report.generatedAt)], ['Time zone', snapshot.report.displayTimeZone], ['Generation mode', 'FACTS ONLY'], ['Overall state', human(snapshot.executiveStatus.state)], ['Summary', snapshot.executiveStatus.summary],
    ['Current stage', human(snapshot.currentStage.stage)], ['Stage status', human(snapshot.currentStage.status)], ['Stage owner', snapshot.currentStage.owner],
    ['Next milestone', snapshot.executiveStatus.nextMilestone], ['Open actions', snapshot.actions.length], ['Risks / blockers', snapshot.risks.length],
    ['Source records', snapshot.sourceSummary.total], ['Report ID', reportId], ['Source fingerprint', snapshot.sourceSummary.sourceFingerprint], ['Application URL', process.env.FRONTEND_URL || 'Not configured'],
  ].forEach(([field, value]) => summary.addRow([field, sanitizeSpreadsheetCell(value)]));
  summary.getCell('B5').numFmt = 'mmm d, yyyy'; summary.getCell('B6').numFmt = 'mmm d, yyyy h:mm AM/PM'; finishSheet(summary);

  const actions = workbook.addWorksheet('Next Actions', { properties: { tabColor: { argb: 'FF16794A' } } });
  sheetHeader(actions, ['Priority', 'Responsibility', 'Action', 'Owner', 'Reviewer', 'Status', 'Due', 'Overdue Days', 'Stage', 'Cost Impact', 'Schedule Impact Days', 'Source']);
  snapshot.actions.forEach((item) => actions.addRow([human(item.priority), human(item.responsibility), sanitizeSpreadsheetCell(item.title), sanitizeSpreadsheetCell(item.owner), sanitizeSpreadsheetCell(item.reviewer), human(item.status), item.dueAt ? new Date(item.dueAt) : null, item.overdueDays, human(item.stage), item.costImpactCents == null ? null : item.costImpactCents / 100, item.scheduleImpactDays, sanitizeSpreadsheetCell(item.sourcePath)]));
  actions.getColumn(7).numFmt = 'mmm d, yyyy'; actions.getColumn(10).numFmt = '$#,##0.00'; finishSheet(actions);

  const decisions = workbook.addWorksheet('Decisions & Approvals', { properties: { tabColor: { argb: 'FF7C3AED' } } });
  sheetHeader(decisions, ['Decision', 'Status', 'Decision Maker', 'Requested', 'Due', 'Decided', 'Result', 'Cost Impact', 'Schedule Impact', 'Source']);
  snapshot.decisions.forEach((item) => decisions.addRow([sanitizeSpreadsheetCell(item.title), human(item.status), sanitizeSpreadsheetCell(item.decisionMaker), new Date(item.requestedAt), item.dueAt ? new Date(item.dueAt) : null, item.decidedAt ? new Date(item.decidedAt) : null, sanitizeSpreadsheetCell(item.result), item.costImpact, sanitizeSpreadsheetCell(item.scheduleImpact), sanitizeSpreadsheetCell(item.sourcePath)]));
  decisions.getColumn(4).numFmt = 'mmm d, yyyy'; decisions.getColumn(5).numFmt = 'mmm d, yyyy'; decisions.getColumn(6).numFmt = 'mmm d, yyyy'; decisions.getColumn(8).numFmt = '$#,##0.00'; finishSheet(decisions);

  const risks = workbook.addWorksheet('Risks & Blockers', { properties: { tabColor: { argb: 'FFB42318' } } });
  sheetHeader(risks, ['Severity', 'Category', 'Reason', 'Owner', 'Due', 'Mitigation', 'Blocks Advancement', 'Source']);
  snapshot.risks.forEach((item) => risks.addRow([human(item.severity), sanitizeSpreadsheetCell(item.category), sanitizeSpreadsheetCell(item.reason), sanitizeSpreadsheetCell(item.owner), item.dueAt ? new Date(item.dueAt) : null, sanitizeSpreadsheetCell(item.mitigation), item.blocksAdvancement ? 'Yes' : 'No', sanitizeSpreadsheetCell(item.sourcePath)]));
  risks.getColumn(5).numFmt = 'mmm d, yyyy'; finishSheet(risks);

  const activity = workbook.addWorksheet('Recent Activity', { properties: { tabColor: { argb: 'FF0E7490' } } });
  sheetHeader(activity, ['Occurred At', 'Type', 'Event', 'Description', 'Actor', 'Source']);
  snapshot.completedRecently.forEach((item) => activity.addRow([new Date(item.occurredAt), human(item.sourceType), human(item.eventType), sanitizeSpreadsheetCell(item.description), sanitizeSpreadsheetCell(item.actor), sanitizeSpreadsheetCell(item.sourcePath)]));
  activity.getColumn(1).numFmt = 'mmm d, yyyy h:mm AM/PM'; finishSheet(activity);

  const sources = workbook.addWorksheet('Sources', { properties: { tabColor: { argb: 'FF52606D' } } });
  sheetHeader(sources, ['Source Type', 'Source ID', 'Last Updated', 'Report Section', 'Source Path']);
  snapshot.sources.forEach((item) => sources.addRow([human(item.sourceType), sanitizeSpreadsheetCell(item.sourceId), new Date(item.sourceUpdatedAt), human(item.section), sanitizeSpreadsheetCell(item.sourcePath)]));
  sources.getColumn(3).numFmt = 'mmm d, yyyy h:mm AM/PM'; finishSheet(sources);

  const output = await workbook.xlsx.writeBuffer();
  return Buffer.from(output);
}

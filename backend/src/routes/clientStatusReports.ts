import express from 'express';
import { z } from 'zod';
import { authenticate, loadClientData, AuthRequest } from '../middleware/auth';
import { requireInternal } from '../workflow/authorization';
import { writeAuditEvent } from '../workflow/audit';
import { AppError } from '../utils/errors';
import { prisma } from '../utils/prisma';
import { buildClientStatusSnapshot, currentDateInZone, parseSnapshot, reportDayBounds } from '../reporting/clientStatus';
import { renderClientStatusPdf, renderClientStatusWorkbook } from '../reporting/clientStatusExports';

const router = express.Router();
router.use(authenticate, loadClientData);

const generateSchema = z.object({
  projectId: z.string().uuid().nullable().optional(),
  inquiryId: z.string().uuid().nullable().optional(),
  asOfDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  includeAiNarrative: z.boolean().default(false),
  forceRefresh: z.boolean().default(false),
}).refine((value) => Boolean(value.projectId || value.inquiryId), { message: 'A project or inquiry is required.' });

const serialize = (report: any, stale = false) => ({
  id: report.id,
  clientId: report.clientId,
  projectId: report.projectId,
  inquiryId: report.inquiryId,
  asOfDate: report.asOfDate.toISOString().slice(0, 10),
  displayTimeZone: report.displayTimeZone,
  generatedAt: report.generatedAt,
  generatedBy: report.generatedBy,
  generator: report.generator || undefined,
  sourceWatermark: report.sourceWatermark,
  sourceFingerprint: report.sourceFingerprint,
  reportVersion: report.reportVersion,
  generationMode: report.generationMode,
  overallState: report.overallState,
  status: report.status,
  warningSummary: report.warningSummary,
  snapshot: parseSnapshot(report.factSnapshotJson),
  stale,
});

const findReport = async (clientId: string, reportId: string) => {
  const report = await prisma.clientStatusReport.findFirst({
    where: { id: reportId, clientId, client: { deletedAt: null } },
    include: { generator: { select: { id: true, name: true, email: true } } },
  });
  if (!report) throw new AppError('Status report not found.', 404, 'REPORT_NOT_FOUND');
  return report;
};

router.post('/clients/:clientId/status-reports', async (req: AuthRequest, res, next) => {
  try {
    requireInternal(req.user);
    const input = generateSchema.parse(req.body);
    if (input.includeAiNarrative) throw new AppError('AI narrative generation is not enabled yet. The verified facts report is available.', 409, 'REPORT_AI_DISABLED');
    const asOfDate = input.asOfDate || currentDateInZone();
    if (asOfDate !== currentDateInZone()) throw new AppError('Historical reports must be opened from saved snapshots. New reports use the current business date.', 400, 'REPORT_INVALID_DATE');
    const built = await buildClientStatusSnapshot({ clientId: req.params.clientId, projectId: input.projectId, inquiryId: input.inquiryId, asOfDate });
    const reportDate = reportDayBounds(asOfDate, built.snapshot.report.displayTimeZone).start;

    if (!input.forceRefresh) {
      const existing = await prisma.clientStatusReport.findFirst({
        where: {
          clientId: req.params.clientId,
          projectId: built.snapshot.report.projectId,
          inquiryId: built.snapshot.report.inquiryId,
          asOfDate: reportDate,
          generationMode: 'FACTS_ONLY',
          sourceFingerprint: built.sourceFingerprint,
          status: 'COMPLETE',
        },
        orderBy: { generatedAt: 'desc' },
        include: { generator: { select: { id: true, name: true, email: true } } },
      });
      if (existing) return res.json({ ...serialize(existing), reused: true });
    }

    const created = await prisma.$transaction(async (tx) => {
      const report = await tx.clientStatusReport.create({
        data: {
          organizationId: null,
          clientId: req.params.clientId,
          projectId: built.snapshot.report.projectId,
          inquiryId: built.snapshot.report.inquiryId,
          asOfDate: reportDate,
          displayTimeZone: built.snapshot.report.displayTimeZone,
          generatedAt: new Date(built.snapshot.report.generatedAt),
          generatedBy: req.user!.id,
          sourceWatermark: built.sourceWatermark,
          sourceFingerprint: built.sourceFingerprint,
          generationMode: 'FACTS_ONLY',
          overallState: built.snapshot.executiveStatus.state,
          factSnapshotJson: JSON.stringify(built.snapshot),
          warningSummary: built.snapshot.warnings.length ? built.snapshot.warnings.join(' ') : null,
        },
      });
      if (built.snapshot.sources.length) await tx.clientStatusReportSource.createMany({
        data: built.snapshot.sources.map((source) => ({ reportId: report.id, sourceType: source.sourceType, sourceId: source.sourceId, sourceUpdatedAt: new Date(source.sourceUpdatedAt), section: source.section })),
      });
      await writeAuditEvent(tx, { userId: req.user!.id, action: 'GENERATE_CLIENT_STATUS_REPORT', entityType: 'ClientStatusReport', entityId: report.id, requestId: (req as any).requestId, details: { clientId: report.clientId, projectId: report.projectId, inquiryId: report.inquiryId, asOfDate, sourceFingerprint: report.sourceFingerprint } });
      return report;
    });
    const report = await findReport(req.params.clientId, created.id);
    res.status(201).json({ ...serialize(report), reused: false });
  } catch (error) { next(error); }
});

router.get('/clients/:clientId/status-reports', async (req: AuthRequest, res, next) => {
  try {
    requireInternal(req.user);
    const client = await prisma.client.findFirst({ where: { id: req.params.clientId, deletedAt: null }, select: { id: true } });
    if (!client) throw new AppError('Client not found.', 404, 'REPORT_NOT_FOUND');
    const reports = await prisma.clientStatusReport.findMany({ where: { clientId: client.id }, orderBy: { generatedAt: 'desc' }, take: 50, include: { generator: { select: { id: true, name: true, email: true } } } });
    res.json({ data: reports.map((report) => serialize(report)) });
  } catch (error) { next(error); }
});

router.get('/clients/:clientId/status-reports/:reportId', async (req: AuthRequest, res, next) => {
  try {
    requireInternal(req.user);
    const report = await findReport(req.params.clientId, req.params.reportId);
    let stale = false;
    try {
      const current = await buildClientStatusSnapshot({ clientId: report.clientId, projectId: report.projectId, inquiryId: report.inquiryId, asOfDate: report.asOfDate.toISOString().slice(0, 10) });
      stale = current.sourceFingerprint !== report.sourceFingerprint;
    } catch { stale = true; }
    res.json(serialize(report, stale));
  } catch (error) { next(error); }
});

router.get('/clients/:clientId/status-reports/:reportId/export', async (req: AuthRequest, res, next) => {
  try {
    requireInternal(req.user);
    const format = z.enum(['pdf', 'xlsx']).parse(req.query.format);
    const report = await findReport(req.params.clientId, req.params.reportId);
    const snapshot = parseSnapshot(report.factSnapshotJson);
    const safeName = snapshot.client.name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'client';
    const fileName = `${safeName}-status-${snapshot.report.asOfDate}.${format}`;
    const output = format === 'pdf' ? await renderClientStatusPdf(snapshot, report.id) : await renderClientStatusWorkbook(snapshot, report.id);
    res.setHeader('Content-Type', format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(output);
  } catch (error) { next(error); }
});

export default router;

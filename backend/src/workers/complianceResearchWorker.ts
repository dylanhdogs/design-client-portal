import { prisma } from '../utils/prisma';
import { writeAuditEvent } from '../workflow/audit';
import { researchPublicCompliance } from '../services/complianceResearch';

let workerStarted = false;
let processing = false;

async function processJob(jobId: string): Promise<void> {
  const claimed = await prisma.complianceResearchJob.updateMany({
    where: { id: jobId, status: 'QUEUED' },
    data: { status: 'RUNNING', progress: 5, startedAt: new Date(), errorMessage: null },
  });
  if (!claimed.count) return;

  const job = await prisma.complianceResearchJob.findUnique({
    where: { id: jobId },
    include: { inquiry: { include: { property: true } } },
  });
  if (!job) return;

  try {
    const property = job.inquiry.property;
    if (!property?.address?.trim()) throw new Error('The inquiry is missing a property address.');
    const discovery = (() => {
      try { return JSON.parse(job.inquiry.discoveryData || '{}') as Record<string, unknown>; }
      catch { return {}; }
    })();
    const location = {
      address: property.address,
      city: property.city,
      state: property.state,
      postalCode: property.postalCode,
      jurisdiction: property.jurisdiction,
      hoaName: property.hoaName,
      municipality: typeof discovery.municipality === 'string' ? discovery.municipality : '',
      communityDevelopment: typeof discovery.communityDevelopment === 'string' ? discovery.communityDevelopment : '',
      communitySubcommunity: typeof discovery.communitySubcommunity === 'string' ? discovery.communitySubcommunity : '',
      complianceLinks: typeof discovery.complianceLinks === 'string' ? discovery.complianceLinks : '',
      hoaArcContact: typeof discovery.hoaArcContact === 'string' ? discovery.hoaArcContact : '',
    };
    const result = await researchPublicCompliance(location);
    const linkList = result.sources.map((source) => source.url);
    const finalStatus = result.sources.length ? 'NEEDS_REVIEW' : 'FAILED';
    const failureMessage = result.sources.length ? null : result.errorMessage || 'No authoritative public source pages were found. The inquiry will need another automated research attempt.';
    const now = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.complianceResearchSource.deleteMany({ where: { jobId } });
      if (result.sources.length) {
        await tx.complianceResearchSource.createMany({
          data: result.sources.map((source) => ({ ...source, jobId })),
        });
      }
      const updatedInquiry = await tx.inquiry.update({
        where: { id: job.inquiryId },
        data: {
          complianceVerificationStatus: finalStatus,
          complianceVerificationCheckedAt: now,
          complianceVerificationSource: 'Automated public web research',
          complianceVerificationCategories: result.categories.join('; ').slice(0, 3000) || 'No matching categories found in accessible pages',
          complianceVerificationLinks: linkList.join('\n').slice(0, 5000),
          complianceVerificationNotes: result.notes,
          complianceVerificationReviewedBy: null,
          complianceVerificationReviewedAt: null,
        },
      });
      await tx.complianceResearchJob.update({
        where: { id: jobId },
        data: {
          status: finalStatus,
          progress: 100,
          querySummary: result.queries.join('\n').slice(0, 2000),
          sourceCount: result.sources.length,
          errorMessage: failureMessage,
          completedAt: now,
        },
      });
      await writeAuditEvent(tx, {
        userId: job.requestedBy,
        action: 'COMPLIANCE_RESEARCH_COMPLETE',
        entityType: 'Inquiry',
        entityId: job.inquiryId,
        details: { jobId, status: finalStatus, sourceCount: result.sources.length },
        after: { complianceVerificationStatus: finalStatus, sourceCount: result.sources.length },
      });
      return updatedInquiry;
    });
  } catch (error) {
    const internalMessage = error instanceof Error ? error.message : 'Unknown compliance research error.';
    const publicMessage = /missing a property address/i.test(internalMessage)
      ? 'Add a property address to this inquiry, then retry.'
      : 'Research could not complete. Review the address and source links, then retry.';
    await prisma.$transaction([
      prisma.complianceResearchJob.update({ where: { id: jobId }, data: { status: 'FAILED', progress: 100, errorMessage: publicMessage, completedAt: new Date() } }),
      prisma.inquiry.update({ where: { id: job.inquiryId }, data: { complianceVerificationStatus: 'FAILED', complianceVerificationCheckedAt: new Date(), complianceVerificationNotes: publicMessage } }),
      prisma.activityLog.create({
        data: {
          userId: job.requestedBy,
          action: 'COMPLIANCE_RESEARCH_FAILED',
          entityType: 'Inquiry',
          entityId: job.inquiryId,
          details: JSON.stringify({ jobId, error: internalMessage.slice(0, 500) }),
        },
      }),
    ]);
  }
}

async function processNextQueuedJob(): Promise<void> {
  if (processing) return;
  processing = true;
  try {
    const job = await prisma.complianceResearchJob.findFirst({ where: { status: 'QUEUED' }, orderBy: { createdAt: 'asc' }, select: { id: true } });
    if (job) await processJob(job.id);
  } catch (error) {
    console.error(JSON.stringify({ level: 'error', event: 'compliance_research_worker_error', message: error instanceof Error ? error.message : 'Unknown worker error.' }));
  } finally {
    processing = false;
  }
}

export function startComplianceResearchWorker(): void {
  if (workerStarted) return;
  workerStarted = true;
  // Recover jobs interrupted by a single-container restart. This app's VPS deployment runs one backend process.
  void prisma.complianceResearchJob.updateMany({
    where: { status: 'RUNNING' },
    data: { status: 'QUEUED', progress: 0, startedAt: null, errorMessage: null },
  }).then(() => processNextQueuedJob()).catch((error) => {
    console.error(JSON.stringify({ level: 'error', event: 'compliance_research_recovery_error', message: error instanceof Error ? error.message : 'Unknown recovery error.' }));
  });
  const timer = setInterval(() => { void processNextQueuedJob(); }, 1500);
  timer.unref();
}

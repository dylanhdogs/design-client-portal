import PDFDocument from 'pdfkit';

const COLORS = {
  navy: '#102A43', blue: '#2563EB', paleBlue: '#EAF2FF', green: '#16794A',
  amber: '#9A6700', gray: '#52606D', paleGray: '#F5F7FA', border: '#CBD5E1',
  white: '#FFFFFF', black: '#172B4D', red: '#B42318',
};

const human = (value: unknown) => typeof value === 'string' && value.trim()
  ? value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
  : 'Not recorded';
const date = (value: unknown) => {
  if (!value) return 'Not set';
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? 'Not set' : new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(parsed);
};
const cleanFileName = (value: string) => value.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'inquiry';

export const inquiryPdfFileName = (inquiry: any) => `${cleanFileName(inquiry.client?.name || 'inquiry')}-reception-intake.pdf`;

export async function renderInquiryPdf(inquiry: any): Promise<Buffer> {
  const doc = new PDFDocument({
    size: 'LETTER', margins: { top: 48, right: 48, bottom: 30, left: 48 }, bufferPages: true,
    info: { Title: `${inquiry.client?.name || 'Inquiry'} - Reception Intake`, Author: 'Signature Exteriors Design Portal', Subject: 'Reception intake and pre-design discovery record' },
  });
  const chunks: Buffer[] = [];
  doc.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
  const complete = new Promise<Buffer>((resolve, reject) => { doc.on('end', () => resolve(Buffer.concat(chunks))); doc.on('error', reject); });
  const width = 516;
  const ensure = (height: number) => { if (doc.y + height > doc.page.height - 58) doc.addPage(); };
  const section = (title: string) => {
    ensure(44);
    doc.moveDown(0.7);
    doc.font('Helvetica-Bold').fontSize(15).fillColor(COLORS.navy).text(title, 48, doc.y, { width });
    doc.moveTo(48, doc.y + 5).lineTo(564, doc.y + 5).strokeColor(COLORS.border).lineWidth(0.7).stroke();
    doc.moveDown(0.8);
  };
  const label = (text: string) => doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.gray).text(text.toUpperCase(), { characterSpacing: 0.6 });
  const box = (title: string, value: unknown, x: number, y: number, boxWidth: number, boxHeight = 46) => {
    doc.roundedRect(x, y, boxWidth, boxHeight, 5).fill(COLORS.paleGray);
    doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.gray).text(title.toUpperCase(), x + 11, y + 9, { width: boxWidth - 22 });
    doc.font('Helvetica').fontSize(9.5).fillColor(COLORS.black).text(String(value || 'Not recorded'), x + 11, y + 24, { width: boxWidth - 22, height: boxHeight - 27, ellipsis: true });
  };
  const longValue = (title: string, value: unknown) => {
    const text = String(value || 'Not recorded');
    doc.font('Helvetica').fontSize(9.5);
    const height = Math.max(42, doc.heightOfString(text, { width: width - 24 }) + 27);
    ensure(height + 8);
    const y = doc.y;
    doc.roundedRect(48, y, width, height, 5).lineWidth(0.7).fillAndStroke(COLORS.white, COLORS.border);
    doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.gray).text(title.toUpperCase(), 60, y + 9, { width: width - 24 });
    doc.font('Helvetica').fontSize(9.5).fillColor(COLORS.black).text(text, 60, y + 23, { width: width - 24, lineGap: 2 });
    doc.y = y + height + 8;
  };
  const empty = (text: string) => { ensure(30); doc.roundedRect(48, doc.y, width, 28, 5).fill(COLORS.paleGray); doc.font('Helvetica').fontSize(9).fillColor(COLORS.gray).text(text, 60, doc.y + 9, { width: width - 24 }); doc.y += 34; };
  const discoveryLabels: Record<string, string> = {
    projectType: 'Project type', primaryUse: 'Primary use', householdUsers: 'Who regularly uses the pool', decisionMakers: 'Decision makers and approvals',
    propertyAccess: 'Property access', siteConditions: 'Site conditions', utilities: 'Utilities and constraints', hoaRequirements: 'HOA requirements',
    surveyStatus: 'Property survey status', poolSize: 'Approximate pool size or usable space', depthProfile: 'Preferred depths or activities',
    stylePreferences: 'Style, shape, and visual preferences', mustHaveFeatures: 'Must-have features', deckingOutdoorScope: 'Decking and outdoor scope',
    equipmentPreferences: 'Equipment and automation preferences', heatingPreference: 'Heating or cooling preference', budgetRange: 'Working investment range',
    targetCompletion: 'Target completion or event date', priorityTradeoffs: 'Priority tradeoffs', knownConcerns: 'Known concerns or deal breakers', representativeNotes: 'Representative notes',
  };

  doc.rect(0, 0, doc.page.width, 120).fill(COLORS.navy);
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#BFD7FF').text('SIGNATURE EXTERIORS DESIGN PORTAL', 48, 35);
  doc.font('Helvetica-Bold').fontSize(23).fillColor(COLORS.white).text('Reception Intake Record', 48, 56);
  doc.font('Helvetica').fontSize(10).fillColor('#D9E8FF').text(`${inquiry.client?.name || 'Unnamed inquiry'} - Complete intake and pre-design discovery`, 48, 88, { width });
  doc.y = 142;
  doc.roundedRect(48, doc.y, 170, 27, 13).fill(COLORS.blue);
  doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.white).text(human(inquiry.qualificationStatus).toUpperCase(), 61, doc.y + 9, { width: 145, align: 'center' });
  doc.font('Helvetica').fontSize(9).fillColor(COLORS.gray).text(`Generated ${date(new Date())}`, 236, doc.y + 8, { width: 328, align: 'right' });
  doc.y += 44;

  section('Lead and ownership');
  const leadY = doc.y;
  box('Client name', inquiry.client?.name, 48, leadY, 252);
  box('Original incoming contact channel', human(inquiry.source), 312, leadY, 252);
  box('Email', inquiry.client?.email, 48, leadY + 55, 252);
  box('Phone', inquiry.client?.phone, 312, leadY + 55, 252);
  box('Reception owner', inquiry.owner?.name, 48, leadY + 110, 252);
  box('Next action due', date(inquiry.nextActionDueAt), 312, leadY + 110, 252);
  doc.y = leadY + 165;
  longValue('Next reception action', inquiry.nextAction);

  section('Property');
  const property = inquiry.property || {};
  const propertyY = doc.y;
  box('Property address', property.address, 48, propertyY, 516);
  box('City', property.city, 48, propertyY + 55, 168);
  box('State', property.state, 222, propertyY + 55, 168);
  box('Postal code', property.postalCode, 396, propertyY + 55, 168);
  doc.y = propertyY + 110;

  section('Project vision and expectations');
  longValue('What the client would like to create or change', inquiry.description);
  longValue('What the finished project should accomplish', inquiry.objectives);
  longValue('Preliminary features or scope', inquiry.preliminaryScope);
  longValue('Design inspirations or reference links', inquiry.designInspirations);
  const expectationY = doc.y;
  box('Budget expectation', inquiry.budgetExpectation, 48, expectationY, 252);
  box('Desired timing', inquiry.desiredTiming, 312, expectationY, 252);
  doc.y = expectationY + 55;

  section('Representative-led pre-design discovery');
  const discovery = inquiry.discovery || {};
  const discoveryEntries = Object.entries(discoveryLabels);
  for (let index = 0; index < discoveryEntries.length; index += 1) {
    const [key, title] = discoveryEntries[index];
    const value = discovery[key];
    if (!value) continue;
    longValue(title, value);
  }
  if (!discoveryEntries.some(([key]) => discovery[key])) empty('No pre-design discovery responses have been recorded.');

  section('Site meeting and feasibility');
  longValue('Site measurements, access, and feasibility notes', inquiry.siteAssessment);
  if (inquiry.consultations?.some((item: any) => /site\s+meeting/i.test(item.title || ''))) {
    inquiry.consultations
      .filter((item: any) => /site\s+meeting/i.test(item.title || ''))
      .forEach((item: any) => longValue(`${item.title || 'Site meeting'} - ${human(item.status)} - ${date(item.date)}`, item.outcome || item.notes || 'No outcome recorded.'));
  } else empty('No site meeting has been scheduled or recorded.');

  section('ROM, narrative, proposal, and handoff');
  const proposalY = doc.y;
  box('ROM amount or range', inquiry.romAmount, 48, proposalY, 252);
  box('Proposal delivery date', date(inquiry.proposalProvidedAt), 312, proposalY, 252);
  doc.y = proposalY + 55;
  longValue('Narrative and design proposal', inquiry.proposalNarrative);
  longValue('Client response or decision', inquiry.proposalClientResponse);
  longValue('Design handoff completed', inquiry.handoffApprovedAt ? `Approved ${date(inquiry.handoffApprovedAt)}` : 'Not completed');

  section('Client follow-up requests');
  if (inquiry.workItems?.length) {
    inquiry.workItems.forEach((item: any) => longValue(`${item.title} - ${human(item.status)} - Due ${date(item.dueAt)}`, item.description || 'No additional details recorded.'));
  } else empty('No client follow-up requests have been created.');

  section('Files and conversations');
  if (inquiry.documents?.length) inquiry.documents.forEach((item: any) => longValue(item.originalName || item.filename || 'Untitled file', `${item.mimeType || 'File'} - Added ${date(item.createdAt)}${item.description ? ` - ${item.description}` : ''}`));
  else empty('No files are attached to this inquiry.');
  if (inquiry.consultations?.length) inquiry.consultations.forEach((item: any) => longValue(`${item.title || 'Consultation'} - ${human(item.status)} - ${date(item.date)}`, item.outcome || item.notes || 'No outcome recorded.'));
  else empty('No consultation records have been added.');

  section('Record summary');
  longValue('Purpose of this document', 'Internal Reception record for carrying the original conversation and representative-led discovery into Design. Verify source records before using this document externally.');
  const range = doc.bufferedPageRange();
  for (let page = range.start; page < range.start + range.count; page += 1) {
    doc.switchToPage(page);
    if (page > 0) {
      doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.navy).text(`${inquiry.client?.name || 'Inquiry'} - Reception Intake`, 48, 18, { width, lineBreak: false });
      doc.moveTo(48, 34).lineTo(564, 34).strokeColor(COLORS.border).lineWidth(0.6).stroke();
    }
    doc.font('Helvetica').fontSize(8).fillColor(COLORS.gray).text('Internal operational record - Generated from the current inquiry data', 48, doc.page.height - 48, { width: 390, lineBreak: false });
    doc.text(`Page ${page + 1} of ${range.count}`, 462, doc.page.height - 48, { width: 102, align: 'right', lineBreak: false });
  }
  doc.end();
  return complete;
}

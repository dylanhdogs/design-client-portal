import { FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertCircle, ArrowRight, CheckCircle2, ChevronDown, ClipboardCheck, ClipboardList, Clock3, Download, FileText, Inbox, LockKeyhole, Plus, UserRound } from 'lucide-react';
import { authApi, clientApi, consultationApi, getApiErrorMessage, inquiryApi } from '../api';
import FormModal from '../components/FormModal';
import DocumentUpload from '../components/DocumentUpload';
import { useAuth } from '../context/AuthContext';
import { Client, ComplianceResearchSnapshot, ComplianceResearchSource, Consultation, Inquiry, InquiryActivity, PoolDiscovery, ReceptionCriterionReadiness, User } from '../types';

const statuses = ['NEW', 'IN_REVIEW', 'QUALIFIED', 'DECLINED', 'NURTURED', 'CONVERTED'];
const sourceOptions = ['PHONE', 'SMS', 'EMAIL', 'WEBSITE', 'REFERRAL', 'WALK_IN', 'OTHER'];
const arizonaStateOptions = [{ value: 'AZ', label: 'Arizona (AZ)' }];
const arizonaCities = [
  'Apache Junction', 'Avondale', 'Buckeye', 'Bullhead City', 'Casa Grande', 'Chandler', 'Coolidge',
  'El Mirage', 'Eloy', 'Flagstaff', 'Fountain Hills', 'Gilbert', 'Glendale', 'Goodyear', 'Kingman',
  'Lake Havasu City', 'Marana', 'Maricopa', 'Mesa', 'Miami', 'Nogales', 'Oro Valley', 'Page',
  'Parker', 'Payson', 'Peoria', 'Phoenix', 'Prescott', 'Prescott Valley', 'Queen Creek', 'Safford',
  'San Luis', 'Scottsdale', 'Sedona', 'Show Low', 'Sierra Vista', 'Somerton', 'Surprise', 'Tempe',
  'Tucson', 'Wickenburg', 'Willcox', 'Winslow', 'Yuma',
].sort();
const projectVisionOptions = [
  { value: 'New pool', label: 'New pool' },
  { value: 'Pool remodel', label: 'Pool remodel' },
  { value: 'Spa addition', label: 'Spa addition' },
  { value: 'Outdoor living area', label: 'Outdoor living area' },
  { value: 'Pool and outdoor living', label: 'Pool and outdoor living' },
  { value: 'Water feature', label: 'Water feature' },
  { value: 'Landscape project', label: 'Landscape project' },
  { value: 'Repair or renovation', label: 'Repair or renovation' },
  { value: 'Other / needs discussion', label: 'Other / needs discussion' },
];
const projectObjectiveOptions = [
  { value: 'Entertainment', label: 'Entertainment' },
  { value: 'Family recreation', label: 'Family recreation' },
  { value: 'Exercise and wellness', label: 'Exercise and wellness' },
  { value: 'Relaxation', label: 'Relaxation' },
  { value: 'Improve appearance', label: 'Improve appearance' },
  { value: 'Increase home value', label: 'Increase home value' },
  { value: 'Safety or accessibility', label: 'Safety or accessibility' },
  { value: 'Rental or guest use', label: 'Rental or guest use' },
  { value: 'Other / needs discussion', label: 'Other / needs discussion' },
];
const preliminaryScopeOptions = [
  { value: 'Pool shell and excavation', label: 'Pool shell and excavation' },
  { value: 'Spa', label: 'Spa' },
  { value: 'Decking or patio', label: 'Decking or patio' },
  { value: 'Water features', label: 'Water features' },
  { value: 'Outdoor kitchen', label: 'Outdoor kitchen' },
  { value: 'Shade structure', label: 'Shade structure' },
  { value: 'Landscaping', label: 'Landscaping' },
  { value: 'Lighting', label: 'Lighting' },
  { value: 'Equipment and automation', label: 'Equipment and automation' },
  { value: 'Multiple features / needs discussion', label: 'Multiple features / needs discussion' },
];
const budgetOptions = [
  { value: 'Under $50,000', label: 'Under $50,000' },
  { value: '$50,000–$75,000', label: '$50,000–$75,000' },
  { value: '$75,000–$100,000', label: '$75,000–$100,000' },
  { value: '$100,000–$150,000', label: '$100,000–$150,000' },
  { value: '$150,000+', label: '$150,000+' },
  { value: 'Not discussed yet', label: 'Not discussed yet' },
];
const timingOptions = [
  { value: 'As soon as possible', label: 'As soon as possible' },
  { value: '0–3 months', label: '0–3 months' },
  { value: '3–6 months', label: '3–6 months' },
  { value: '6–12 months', label: '6–12 months' },
  { value: '12+ months', label: '12+ months' },
  { value: 'Flexible', label: 'Flexible' },
  { value: 'Not discussed yet', label: 'Not discussed yet' },
];
const discoveryPrimaryUseOptions = ['Family recreation', 'Entertainment', 'Exercise and wellness', 'Relaxation', 'Pool parties and guests', 'Not sure yet'];
const discoveryHouseholdOptions = ['Adults', 'Children', 'Grandchildren', 'Pets', 'Guests', 'Short-term rental guests'];
const discoveryDecisionOptions = ['Client only', 'Spouse or partner', 'Joint family decision', 'Property owner and representative', 'Multiple owners', 'Not decided yet'];
const discoveryAccessOptions = ['Easy equipment access', 'Through side yard', 'Through home or garage', 'Crane or special access may be needed', 'Access needs site review'];
const discoverySiteConditionOptions = ['Flat grade', 'Sloped grade', 'Drainage concern', 'Rock or hard soil concern', 'Retaining wall concern', 'Existing pool or structure', 'No known concerns yet'];
const discoveryUtilityOptions = ['City water', 'Well water', 'Septic system', 'Gas service', 'Overhead power lines', 'Easement or utility constraint', 'No known constraints yet'];
const discoveryHoaOptions = ['No HOA', 'HOA approval required', 'HOA rules need review', 'Neighborhood requirements only', 'Not sure yet'];
const discoveryPoolSizeOptions = ['Compact / small footprint', 'Standard backyard pool', 'Large entertaining pool', 'Lap or exercise pool', 'Size not determined yet'];
const discoveryDepthOptions = ['Shallow play area', 'Tanning ledge', 'Standard deep end', 'Diving depth', 'Lap or exercise lanes', 'Not determined yet'];
const discoveryStyleOptions = ['Modern', 'Traditional', 'Natural', 'Geometric', 'Freeform', 'Minimalist', 'Match existing home', 'Need design guidance'];
const discoveryFeatureOptions = ['Spa', 'Tanning ledge', 'Baja shelf', 'Water feature', 'Fire feature', 'Swim-up bar', 'Pool cover', 'Heating', 'Automation', 'Safety cover or fence'];
const discoveryOutdoorOptions = ['Concrete decking', 'Pavers', 'Covered patio', 'Shade structure', 'Outdoor kitchen', 'Fire pit', 'Landscaping', 'Pool lighting', 'No additional outdoor scope yet'];
const discoveryEquipmentOptions = ['Salt system', 'Traditional chlorine', 'Variable-speed pump', 'Automation controls', 'In-floor cleaning', 'Pool cover', 'Low-maintenance system', 'Need recommendations'];
const discoveryHeatingOptions = ['No heating planned', 'Gas heating', 'Heat pump', 'Cooling system', 'Heating and cooling', 'Not determined yet'];
const discoveryPriorityOptions = ['Budget', 'Schedule', 'Features', 'Finish level', 'Low maintenance', 'Energy efficiency', 'Resale value'];
const discoveryConcernOptions = ['Budget uncertainty', 'Schedule uncertainty', 'Access limitations', 'HOA approval', 'Site conditions', 'Maintenance concerns', 'No known concerns yet'];
const discoveryComplianceCategoryOptions = ['Municipal permits', 'HOA / ARC review', 'Pool barrier and safety', 'Grading and drainage', 'Utilities and easements', 'Community design standards', 'Unknown / needs verification'];
const complianceFollowUpStatusOptions = [{value:'NOT_REQUIRED',label:'Not required'},{value:'TBD',label:'TBD — follow-up required'},{value:'VERIFIED',label:'Verified'}];
const nextReceptionActionOptions = ['Complete qualification review', 'Contact HOA/ARC regarding compliance details', 'Request property survey', 'Confirm site meeting', 'Follow up with client', 'Prepare ROM review', 'Other'];
const siteMeetingDecisionOptions = ['Ready to continue', 'Needs follow-up', 'On hold', 'Not moving forward'];
const siteMeetingReadinessOptions = ['Ready for next step', 'Minor items to resolve', 'Additional site review needed', 'Not feasible as discussed'];
const siteMeetingConditionOptions = ['No material concerns observed', 'Access concern', 'Drainage concern', 'Soil or rock concern', 'Existing structure or utility concern', 'HOA or jurisdiction review needed'];
const siteMeetingNextStepOptions = ['Prepare concept direction', 'Request survey or measurements', 'Schedule follow-up meeting', 'Revise scope and budget', 'Review with Design', 'Other'];
const workflowQueueDefinitions = [
  { key: 'ATTENTION', label: 'Initial Contact Made', shortLabel: 'Initial contact', statuses: ['NEW'], description: 'Lead has been reached and the project record is being started.' },
  { key: 'PROGRESS', label: 'Pre-Design Discovery', shortLabel: 'Pre-design discovery', statuses: ['IN_REVIEW'], description: 'The inquiry is in qualification and the representative is completing the discovery record.' },
  { key: 'READY', label: 'Site Meetings & ROM Preparation', shortLabel: 'Site meetings and ROM', statuses: ['QUALIFIED'], description: 'The onsite meeting and feasibility work are underway.' },
  { key: 'HANDOFF', label: 'ROM Approval & Design Handoff', shortLabel: 'ROM and handoff', statuses: [], description: 'Prepare, review, present, and disposition the preliminary ROM.' },
];
const workflowStatusLabels: Record<string, string> = {
  NEW: 'Initial contact', IN_REVIEW: 'In review', QUALIFIED: 'Site meeting and ROM readiness', CONVERTED: 'ROM approval and handoff',
  DECLINED: 'Declined', NURTURED: 'Nurtured',
};
const terminalWorkStatuses = ['VERIFIED', 'CLOSED', 'CANCELLED'];
const statusColor: Record<string, string> = {
  NEW: 'bg-blue-100 text-blue-800', IN_REVIEW: 'bg-amber-100 text-amber-900',
  QUALIFIED: 'bg-emerald-100 text-emerald-800', CONVERTED: 'bg-violet-100 text-violet-800',
  DECLINED: 'bg-red-100 text-red-800', NURTURED: 'bg-gray-100 text-gray-800',
};

function legacyCriterionPreview(inquiry: Inquiry, criterionId: string): string {
  const record = inquiry as any;
  const discovery = record.discovery || {};
  const consultations = record.consultations || [];
  const workItems = record.workItems || [];
  const meetingLabel = (meeting: any) => [meeting.meetingMode || 'mode not recorded', meeting.status, meeting.date ? new Date(meeting.date).toLocaleString() : 'date not recorded'].join(' · ');
  const values: Record<string, unknown> = {
    CONTACT_IDENTITY: record.client?.name,
    CONTACT_METHOD: record.client?.email || record.client?.phone,
    INCOMING_CHANNEL: record.source,
    RECEPTION_OWNER: record.owner?.name || (record.ownerId ? 'Assigned owner; current owner profile unavailable' : null),
    INITIAL_NEXT_ACTION: [record.nextAction, record.nextActionDueAt ? new Date(record.nextActionDueAt).toLocaleDateString() : null].filter(Boolean).join(' · '),
    PROPERTY_IDENTIFIED: record.property?.address,
    PROJECT_TYPE: discovery.projectType,
    PRIMARY_USE: discovery.primaryUse,
    DESIRED_OUTCOME: record.objectives,
    DECISION_MAKERS: discovery.decisionMakers,
    PROPERTY_ACCESS: discovery.propertyAccess,
    REPORTED_SITE_CONDITIONS: discovery.siteConditions,
    UTILITIES: discovery.utilities,
    SURVEY_STATUS: discovery.surveyStatus,
    MUST_HAVE_FEATURES: discovery.mustHaveFeatures,
    QUALIFICATION_APPROVAL: record.qualificationStatus,
    INSPIRATION_STATUS: record.designInspirations,
    SITE_MEETING_SCHEDULED: consultations.filter((item: any) => item.activityType === 'SITE_MEETING' || /site\s+meeting/i.test(item.title || '')).map(meetingLabel).join('; '),
    BUDGET_EXPECTATION: [record.budgetExpectation, discovery.budgetRange].filter(Boolean).join(' · '),
    DESIRED_TIMING: [record.desiredTiming, discovery.targetCompletion].filter(Boolean).join(' · '),
    SITE_MEETING_OUTCOME: consultations.filter((item: any) => item.activityType === 'SITE_MEETING' || /site\s+meeting/i.test(item.title || '')).map((item: any) => item.outcome).filter(Boolean).join('; '),
    SITE_ASSESSMENT: record.siteAssessment,
    SITE_EVIDENCE: (record.documents || []).map((item: any) => item.description || item.fileName || item.category).filter(Boolean).join(', '),
    CLIENT_REQUESTS: workItems.filter((item: any) => item.clientVisible).map((item: any) => `${item.title || item.description || 'Client request'} (${item.status})`).join('; '),
    PRELIMINARY_ROM: record.romAmount,
    PRELIMINARY_BRIEF: record.handoffReview?.romPreviewSnapshot ? 'A reviewed ROM preview snapshot is saved.' : record.romProposalDetails || record.proposalNarrative,
    PROPOSAL_PRESENTED_AT: record.proposalProvidedAt ? new Date(record.proposalProvidedAt).toLocaleString() : null,
    ROM_APPROVAL: [record.romStatus, record.romDecisionAt ? new Date(record.romDecisionAt).toLocaleDateString() : null].filter(Boolean).join(' · '),
    DESIGN_AGREEMENT: record.designAgreementStatus,
    CLIENT_DISPOSITION: record.clientDisposition,
    HANDOFF_REVIEW: record.handoffReview?.result,
  };
  const raw = values[criterionId];
  const summary = Array.isArray(raw) ? raw.filter(Boolean).join(', ') : String(raw || '').trim();
  if (!summary) return 'No saved answer is available in the inquiry fields.';
  return summary.length > 240 ? `${summary.slice(0, 237)}…` : summary;
}
type TabKey = 'INTAKE' | 'QUESTIONS' | 'SCHEDULE' | 'FILES' | 'HANDOFF';
type DiscoverySubTab = 'QUESTIONS' | 'COMMUNITY' | 'CALL_TRACKER';
type RomProposalField = 'projectNarrative' | 'designBuildOverview' | 'proposedScope' | 'exclusions' | 'designDeliverables' | 'clientResponsibilities' | 'milestones' | 'allowancesOptions' | 'assumptions' | 'depositTerms' | 'nextSteps';
type RomProposalOverrides = Record<RomProposalField, string | null>;
const romProposalFieldDefinitions: Array<{key:RomProposalField;label:string;description:string}> = [
  {key:'projectNarrative',label:'Project narrative',description:'The story of the project, its goals, and the client’s intended use.'},
  {key:'designBuildOverview',label:'Design & build overview',description:'High-level approach and how the requested work fits together.'},
  {key:'proposedScope',label:'Proposed scope / items to price',description:'Scope language is preliminary until confirmed during design and site review.'},
  {key:'exclusions',label:'Exclusions and items not included',description:'Clarify boundaries to avoid implying unpriced work is included.'},
  {key:'designDeliverables',label:'Design deliverables and consultation tasks',description:'For example, concept plans, renderings, client reviews, or revision rounds—enter only what you intend to provide.'},
  {key:'clientResponsibilities',label:'Client decisions and responsibilities',description:'Selections, approvals, access, or information the client must provide.'},
  {key:'milestones',label:'Target schedule and milestones',description:'Inquiry timing answers prefill this as a target, not a guaranteed schedule.'},
  {key:'allowancesOptions',label:'Allowances, alternates, and options',description:'Identify provisional allowances or optional upgrades; do not imply a price unless entered.'},
  {key:'assumptions',label:'Assumptions and items to verify',description:'Site, utility, survey, permitting, and community constraints that still need confirmation.'},
  {key:'depositTerms',label:'Design deposit or fee terms',description:'Optional; enter the agreed fee/deposit language, or leave empty if not established.'},
  {key:'nextSteps',label:'Recommended next steps',description:'What the client and team should do after reviewing this ROM.'},
];
const emptyRomProposalOverrides = ():RomProposalOverrides => Object.fromEntries(romProposalFieldDefinitions.map(({key})=>[key,null])) as RomProposalOverrides;
const parseRomProposalOverrides = (value:string|null|undefined):RomProposalOverrides => {
  const empty = emptyRomProposalOverrides();
  if (!value) return empty;
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    for (const key of Object.keys(empty) as RomProposalField[]) if (typeof parsed[key] === 'string') empty[key] = parsed[key] as string;
  } catch { /* Ignore malformed legacy values; the inquiry answers remain the defaults. */ }
  return empty;
};
type IntakeForm = { clientId:string; leadName:string; leadEmail:string; leadPhone:string; ownerId:string; source:string; description:string; objectives:string; preliminaryScope:string; designInspirations:string; budgetExpectation:string; desiredTiming:string; nextAction:string; nextActionDueAt:string; address:string; city:string; state:string; postalCode:string };
type LeadCandidate = { id:string; name:string; email:string|null; phone:string|null };
const emptyForm: IntakeForm = { clientId:'', leadName:'', leadEmail:'', leadPhone:'', ownerId:'', source:'', description:'', objectives:'', preliminaryScope:'', designInspirations:'', budgetExpectation:'', desiredTiming:'', nextAction:'', nextActionDueAt:'', address:'', city:'', state:'AZ', postalCode:'' };
const emptyDiscovery: PoolDiscovery = {
  projectType:'', municipality:'', communityDevelopment:'', communitySubcommunity:'', hoaArcContact:'', complianceCategories:'', complianceLinks:'', complianceVerificationStatus:'', complianceVerificationCheckedAt:'', complianceFollowUpStatus:'', complianceFollowUpOwner:'', complianceFollowUpDueAt:'', complianceFollowUpAction:'', primaryUse:'', householdUsers:'', decisionMakers:'', propertyAccess:'', siteConditions:'', utilities:'',
  hoaRequirements:'', surveyStatus:'', poolSize:'', depthProfile:'', stylePreferences:'', mustHaveFeatures:'',
  deckingOutdoorScope:'', equipmentPreferences:'', heatingPreference:'', budgetRange:'', targetCompletion:'',
  priorityTradeoffs:'', knownConcerns:'', representativeNotes:'',
};
const requiredDiscoveryFields: Array<{key:keyof PoolDiscovery;label:string}> = [
  {key:'projectType',label:'Project type'}, {key:'primaryUse',label:'Primary use'}, {key:'decisionMakers',label:'Decision makers'},
  {key:'propertyAccess',label:'Property access'}, {key:'siteConditions',label:'Site conditions'}, {key:'utilities',label:'Utilities'},
  {key:'surveyStatus',label:'Survey status'}, {key:'mustHaveFeatures',label:'Must-have features'},
  {key:'budgetRange',label:'Working budget'}, {key:'targetCompletion',label:'Target completion'},
];

const inquiryPhaseDefinitions = [
  { key: 'INTAKE', label: 'Initial Contact Made', tab: 'INTAKE' as const },
  { key: 'DISCOVERY', label: 'Pre-Design Discovery', tab: 'QUESTIONS' as const },
  { key: 'SITE_MEETING', label: 'Site Meetings & ROM Preparation', tab: 'SCHEDULE' as const },
  { key: 'HANDOFF', label: 'ROM Approval & Design Handoff', tab: 'HANDOFF' as const },
];

const hasText = (value?: string | null) => Boolean(value?.trim());
const proposalText = (...values: Array<string | null | undefined>) => values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)).join(' ');
const proposalList = (...values: Array<string | null | undefined>) => values.map((value) => value?.trim()).filter((value): value is string => Boolean(value));
const summarizeComplianceExcerpt = (excerpt?: string | null) => {
  if (!excerpt?.trim()) return 'Open the source for Arizona-specific requirements.';
  const foreignState = /\b(Alabama|Alaska|Arkansas|California|Colorado|Connecticut|Delaware|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New Hampshire|New Jersey|New Mexico|New York|North Carolina|North Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode Island|South Carolina|South Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West Virginia|Wisconsin|Wyoming)\b/i;
  const relevant = /pool|permit|inspection|zoning|setback|barrier|fence|enclosure|hoa|homeowners|architectural|drainage|stormwater|easement|utility|covenant/i;
  const fragments = excerpt.split(/\s*…\s*|\s*\.\.\.\s*/).map((part) => part.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const summary = fragments.find((part) => relevant.test(part) && !foreignState.test(part))
    || fragments.find((part) => !foreignState.test(part));
  if (!summary) return 'Open the source and confirm it applies to this Arizona property.';
  return summary.length > 220 ? `${summary.slice(0, 217).trimEnd()}…` : summary;
};
const discoveryValueComplete = (value?: string | null) => Boolean(value?.trim() && value.trim().toUpperCase() !== 'UNKNOWN');
const discoveryProgress = (discovery?: PoolDiscovery | null) => {
  const complete = requiredDiscoveryFields.filter(({key})=>discoveryValueComplete(discovery?.[key])).length;
  return { complete, total: requiredDiscoveryFields.length, percent: Math.round((complete / requiredDiscoveryFields.length) * 100) };
};
function inquiryPhaseRequirements(inquiry: Inquiry, phaseIndex: number) {
  const hasContact = Boolean(inquiry.client?.name && (inquiry.client?.email || inquiry.client?.phone));
  const isSiteMeeting = (item: { title: string; status: string; activityType?: string }) => item.activityType === 'SITE_MEETING' || /site\s+meeting/i.test(item.title);
  const hasScheduledSiteMeeting = Boolean(inquiry.consultations?.some((item) => item.status === 'SCHEDULED' && isSiteMeeting(item)));
  const hasCompletedSiteMeeting = Boolean(inquiry.consultations?.some((item) => item.status === 'COMPLETED' && isSiteMeeting(item) && hasText(item.outcome)));
  const hasOpenRequests = Boolean(inquiry.workItems?.some((item) => !terminalWorkStatuses.includes(item.status)));
  const complianceReviewRequired = Boolean(inquiry.discovery?.complianceFollowUpStatus === 'TBD' || hasText(inquiry.discovery?.complianceCategories) || hasText(inquiry.discovery?.hoaArcContact) || hasText(inquiry.discovery?.hoaRequirements));
  const phaseRequirements = [
    [
      { label: 'Client name and email or phone', complete: hasContact },
      { label: 'Original incoming contact channel', complete: hasText(inquiry.source) },
      { label: 'Reception owner assigned', complete: Boolean(inquiry.ownerId) },
      { label: 'Next action and due date recorded', complete: Boolean(hasText(inquiry.nextAction) && inquiry.nextActionDueAt) },
    ],
    [
      { label: 'Property identified', complete: Boolean(inquiry.propertyId) },
      { label: 'Project vision and objectives recorded', complete: Boolean(hasText(inquiry.description) && hasText(inquiry.objectives)) },
      { label: 'Preliminary scope recorded', complete: hasText(inquiry.preliminaryScope) },
      { label: 'Budget expectation recorded', complete: hasText(inquiry.budgetExpectation) },
      { label: 'Desired timing recorded', complete: hasText(inquiry.desiredTiming) },
      { label: 'Pre-design discovery completed', complete: discoveryProgress(inquiry.discovery).percent === 100 },
    ],
    [
      { label: 'All site meeting(s) completed with outcomes', complete: hasCompletedSiteMeeting && !hasScheduledSiteMeeting },
      { label: 'Site measurements, access, and feasibility recorded', complete: hasText(inquiry.siteAssessment) },
      { label: 'All client information requests resolved', complete: !hasOpenRequests },
      { label: 'Compliance review verified when applicable', complete: !complianceReviewRequired || inquiry.complianceVerificationStatus === 'VERIFIED' },
    ],
    [
      { label: 'ROM amount or range recorded', complete: hasText(inquiry.romAmount) },
      { label: 'ROM approved with decision record', complete: inquiry.romStatus === 'APPROVED' && Boolean(inquiry.romDecisionAt && inquiry.romApprovedBy) },
      { label: 'Design Agreement accepted or not required', complete: ['ACCEPTED', 'NOT_REQUIRED'].includes(inquiry.designAgreementStatus || '') && (inquiry.designAgreementStatus === 'NOT_REQUIRED' || Boolean(inquiry.designAgreementAcceptedAt && inquiry.designAgreementAcceptedBy)) },
      { label: 'Design handoff summary recorded', complete: hasText(inquiry.handoffSummary) },
      { label: 'Design handoff completed', complete: Boolean(inquiry.projectId && inquiry.qualificationStatus === 'CONVERTED') },
    ],
  ];
  if (inquiry.qualificationStatus === 'CONVERTED' && inquiry.projectId) {
    return (phaseRequirements[phaseIndex] || []).map((requirement) => ({ ...requirement, complete: true }));
  }
  const serverPhase = inquiry.readiness?.phases[phaseIndex];
  if (serverPhase) {
    return serverPhase.criteria.map((criterion) => ({
      label: criterion.label,
      complete: criterion.complete,
      criterionId: criterion.id,
      blocker: criterion.blocker,
      deferred: criterion.deferred,
      answerState: criterion.answerState,
    }));
  }
  return phaseRequirements[phaseIndex] || [];
}
function inquiryPhaseCompletion(inquiry: Inquiry, phaseIndex: number) {
  const requirements = inquiryPhaseRequirements(inquiry, phaseIndex);
  return { requirements, complete: requirements.length > 0 && requirements.every((requirement) => requirement.complete) };
}
function coreIntakeProgress(inquiry: Inquiry) {
  const checks = [Boolean(inquiry.client?.name && (inquiry.client?.email || inquiry.client?.phone)), hasText(inquiry.property?.address), hasText(inquiry.description), hasText(inquiry.objectives), hasText(inquiry.preliminaryScope), hasText(inquiry.budgetExpectation), hasText(inquiry.desiredTiming), Boolean(inquiry.ownerId), hasText(inquiry.nextAction), discoveryProgress(inquiry.discovery).percent === 100];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}
function handoffBlockers(inquiry: Inquiry) {
  if (inquiry.qualificationStatus === 'CONVERTED') return [];
  const missing = [0, 1, 2, 3]
    .flatMap((phaseIndex) => inquiryPhaseRequirements(inquiry, phaseIndex))
    .filter((requirement) => !requirement.complete && requirement.label !== 'Design handoff completed')
    .map((requirement) => requirement.label);
  if (inquiry.qualificationStatus !== 'QUALIFIED') missing.push('Complete qualification before Design conversion.');
  return missing;
}
function queueGroup(inquiry: Inquiry) {
  if (['DECLINED','NURTURED'].includes(inquiry.qualificationStatus)) return 'ARCHIVED';
  if (inquiry.qualificationStatus === 'CONVERTED') return 'CLOSED';
  const stageByPhase: Record<string, string> = {
    INITIAL_CONTACT: 'ATTENTION',
    PRE_DESIGN_DISCOVERY: 'PROGRESS',
    SITE_MEETINGS_ROM: 'READY',
    ROM_HANDOFF: 'HANDOFF',
  };
  const stage = inquiry.readiness?.activeReceptionPhase;
  if (stage && stageByPhase[stage]) return stageByPhase[stage];
  return 'ATTENTION';
}

export default function Inquiries() {
  const { user: currentUser } = useAuth();
  const [items,setItems] = useState<Inquiry[]>([]);
  const [countItems,setCountItems] = useState<Inquiry[]>([]);
  const [clients,setClients] = useState<Client[]>([]);
  const [users,setUsers] = useState<User[]>([]);
  const [selected,setSelected] = useState<Inquiry|null>(null);
  const [complianceResearch,setComplianceResearch] = useState<ComplianceResearchSnapshot|null>(null);
  const [filter,setFilter] = useState('');
  const [queue,setQueue] = useState('ACTIVE');
  const [activeTab,setActiveTab] = useState<TabKey>('INTAKE');
  const [discoverySubTab,setDiscoverySubTab] = useState<DiscoverySubTab>('QUESTIONS');
  const [showCreate,setShowCreate] = useState(false);
  const [saving,setSaving] = useState(false);
  const [exportingInquiry,setExportingInquiry] = useState(false);
  const [error,setError] = useState('');
  const [outcome,setOutcome] = useState('');
  const [outcomeDecision,setOutcomeDecision] = useState('');
  const [outcomeReadiness,setOutcomeReadiness] = useState('');
  const [outcomeCondition,setOutcomeCondition] = useState('');
  const [outcomeNextStep,setOutcomeNextStep] = useState('');
  const [outcomeSpecific,setOutcomeSpecific] = useState('');
  const [outcomeSpecifics,setOutcomeSpecifics] = useState<string[]>([]);
  const [informationRequest,setInformationRequest] = useState('');
  const [contactChannel,setContactChannel] = useState<'PHONE'|'SMS'|'EMAIL'|'WEBSITE'|'IN_PERSON'|'REFERRAL'|'OTHER'>('PHONE');
  const [contactDirection,setContactDirection] = useState<'INBOUND'|'OUTBOUND'>('INBOUND');
  const [contactPerson,setContactPerson] = useState('');
  const [contactSummary,setContactSummary] = useState('');
  const [contactOutcome,setContactOutcome] = useState('CONNECTED');
  const [externalDispositionChannel,setExternalDispositionChannel] = useState<'PHONE'|'SMS'|'EMAIL'|'IN_PERSON'|'OTHER'>('PHONE');
  const [externalDisposition,setExternalDisposition] = useState<'PROCEED_TO_DESIGN'|'MORE_INFORMATION'|'PAUSE'|'DECLINE'>('PROCEED_TO_DESIGN');
  const [externalDispositionSummary,setExternalDispositionSummary] = useState('');
  const [contactFollowUpTitle,setContactFollowUpTitle] = useState('');
  const [contactFollowUpOwner,setContactFollowUpOwner] = useState('');
  const [contactFollowUpDueAt,setContactFollowUpDueAt] = useState('');
  const [discoveryForm,setDiscoveryForm] = useState<PoolDiscovery>(emptyDiscovery);
  const [designInspirations,setDesignInspirations] = useState('');
  const [showEdit,setShowEdit] = useState(false);
  const [hasIntakeConflict,setHasIntakeConflict] = useState(false);
  const [showRomPreview,setShowRomPreview] = useState(false);
  const [showRomEditor,setShowRomEditor] = useState(false);
  const [romProposalOverrides,setRomProposalOverrides] = useState<RomProposalOverrides>(emptyRomProposalOverrides);
  const [showRecord,setShowRecord] = useState(false);
  const [showMore,setShowMore] = useState(false);
  const [editForm,setEditForm] = useState({ leadName:'', leadEmail:'', leadPhone:'', description:'', objectives:'', preliminaryScope:'', designInspirations:'', budgetExpectation:'', desiredTiming:'', source:'', nextAction:'', nextActionDueAt:'', address:'', city:'', state:'', postalCode:'' });
  const editFormBaseline = useRef('');
  const [siteMeetingDate,setSiteMeetingDate] = useState('');
  const [siteActivityType,setSiteActivityType] = useState<Consultation['activityType']>('SITE_MEETING');
  const [activitySubject,setActivitySubject] = useState('');
  const [activityParticipants,setActivityParticipants] = useState('');
  const [activityEndAt,setActivityEndAt] = useState('');
  const [activityNextAction,setActivityNextAction] = useState('');
  const [activityNextActionDueAt,setActivityNextActionDueAt] = useState('');
  const [activityCancellationReason,setActivityCancellationReason] = useState('');
  const [discoveryCallDate,setDiscoveryCallDate] = useState('');
  const [discoveryCallSubject,setDiscoveryCallSubject] = useState('');
  const [discoveryCallParticipants,setDiscoveryCallParticipants] = useState('');
  const [discoveryCallEndAt,setDiscoveryCallEndAt] = useState('');
  const [discoveryCallNextAction,setDiscoveryCallNextAction] = useState('');
  const [discoveryCallNextActionDueAt,setDiscoveryCallNextActionDueAt] = useState('');
  const [discoveryCallOutcome,setDiscoveryCallOutcome] = useState('');
  const [siteAssessment,setSiteAssessment] = useState('');
  const [handoffForm,setHandoffForm] = useState({ romAmount:'', romStatus:'', romDecisionAt:'', romApprovedBy:'', designAgreementStatus:'', designAgreementAcceptedAt:'', designAgreementAcceptedBy:'', designAgreementNotRequiredReason:'', handoffSummary:'', proposalNarrative:'', proposalProvidedAt:'', proposalClientResponse:'' });
  const [form,setForm] = useState<IntakeForm>(emptyForm);
  const [searchParams] = useSearchParams();
  const [search,setSearch] = useState(() => localStorage.getItem('reception.search') || '');
  const [ownerScope,setOwnerScope] = useState<'ALL'|'MINE'>(() => localStorage.getItem('reception.ownerScope') === 'MINE' ? 'MINE' : 'ALL');
  const [overdueOnly,setOverdueOnly] = useState(() => localStorage.getItem('reception.overdueOnly') === 'true');
  const [matchCandidates,setMatchCandidates] = useState<LeadCandidate[]>([]);
  const [showHandoffConfirm,setShowHandoffConfirm] = useState(false);
  const [handoffSuccess,setHandoffSuccess] = useState<{clientId:string;projectId:string}|null>(null);
  const [statusAction,setStatusAction] = useState<'NURTURED'|'DECLINED'|null>(null);
  const [statusReason,setStatusReason] = useState('');
  const [discoverySaveState,setDiscoverySaveState] = useState<'idle'|'saving'|'saved'|'error'>('idle');
  const lastSavedDiscovery = useRef('');

  const load = async () => {
    try {
      setError('');
      const inquiryParams = { ...(filter ? {status:filter} : {}), ...(search.trim() ? {search:search.trim()} : {}), ...(ownerScope==='MINE'&&currentUser?.id ? {ownerId:currentUser.id} : {}), ...(overdueOnly ? {overdue:true} : {}) };
      const countParams = { ...(search.trim() ? {search:search.trim()} : {}), ...(ownerScope==='MINE'&&currentUser?.id ? {ownerId:currentUser.id} : {}), ...(overdueOnly ? {overdue:true} : {}), limit: 100 };
      const [inquiryResult,countResult,clientResult,userResult] = await Promise.all([inquiryApi.list(inquiryParams),inquiryApi.list(countParams),clientApi.getAll({status:'LEAD'}),authApi.getUsers()]);
      setItems(inquiryResult.data.data); setCountItems(countResult.data.data); setClients(clientResult.data.data);
      setUsers((userResult.data as User[]).filter((user) => user.active && user.role === 'ADMIN'));
      if (selected) setSelected((await inquiryApi.get(selected.id)).data);
    } catch (err) { setError(getApiErrorMessage(err,'Reception intake could not be loaded.')); }
  };
  useEffect(() => { load(); },[filter,search,ownerScope,overdueOnly,currentUser?.id]);
  useEffect(() => {
    localStorage.setItem('reception.search', search);
    localStorage.setItem('reception.ownerScope', ownerScope);
    localStorage.setItem('reception.overdueOnly', String(overdueOnly));
  }, [search, ownerScope, overdueOnly]);

  const visibleItems = useMemo(() => items.filter((item) => {
    if (filter) return true;
    if (queue === 'ACTIVE') return !['DECLINED','NURTURED','CONVERTED'].includes(item.qualificationStatus);
    return queueGroup(item) === queue;
  }),[filter,items,queue]);
  const counts = useMemo(() => ({
    ATTENTION:countItems.filter((item)=>queueGroup(item)==='ATTENTION').length,
    PROGRESS:countItems.filter((item)=>queueGroup(item)==='PROGRESS').length,
    READY:countItems.filter((item)=>queueGroup(item)==='READY').length,
    HANDOFF:countItems.filter((item)=>queueGroup(item)==='HANDOFF').length,
    CLOSED:countItems.filter((item)=>queueGroup(item)==='CLOSED').length,
  }),[countItems]);
  const blockers = selected ? handoffBlockers(selected) : [];
  const handoffReviewCurrent = Boolean(selected?.handoffReview?.result === 'APPROVED'
    && selected.handoffReview.intakeRevision === selected.intakeRevision
    && selected.handoffReview.workflowVersion === selected.readiness?.workflowVersion
    && selected.handoffReview.romPreviewHash === selected.romPreviewHash);
  const openRequests = selected?.workItems?.filter((item)=>!terminalWorkStatuses.includes(item.status)) || [];
  const selectedDiscoveryProgress = discoveryProgress(discoveryForm);
  const selectedPhaseCompletions = selected ? inquiryPhaseDefinitions.map((_, index) => inquiryPhaseCompletion(selected, index)) : [];
  const phaseOneComplete = Boolean(selectedPhaseCompletions[0]?.complete);
  const phaseTwoBlockers = selected?.readiness?.phases.find((phase) => phase.id === 'PRE_DESIGN_DISCOVERY')?.blockers || [];
  const canScheduleSiteMeetingEarly = phaseTwoBlockers.some((criterion) => criterion.id === 'SITE_MEETING_SCHEDULED')
    && phaseTwoBlockers.every((criterion) => ['QUALIFICATION_APPROVAL', 'SITE_MEETING_SCHEDULED'].includes(criterion.id));
  const phaseUnlocked = (phaseIndex:number) => phaseIndex === 0
    || selectedPhaseCompletions.slice(0, phaseIndex).every((phase) => phase.complete)
    || (phaseIndex === 2 && phaseOneComplete && canScheduleSiteMeetingEarly);
  const phaseTwoComplete = selected?.readiness
    ? phaseTwoBlockers.every((criterion) => criterion.id === 'QUALIFICATION_APPROVAL')
    : Boolean(selectedPhaseCompletions[1]?.complete);
  const criteriaForAdminReview = selected?.readiness?.criteria.filter((criterion) =>
    criterion.answerState === 'NEEDS_REVIEW'
    || (criterion.answerState === 'UNKNOWN' && ['MUST_HAVE_FEATURES', 'INSPIRATION_STATUS'].includes(criterion.id)),
  ) || [];
   const scheduledDiscoveryCall = selected?.consultations?.find((consultation) => consultation.status === 'SCHEDULED' && consultation.activityType === 'PHONE_CALL');
   const discoveryCalls = selected?.consultations?.filter((consultation) => consultation.activityType === 'PHONE_CALL') || [];
   const scheduledSiteMeeting = selected?.consultations?.find((consultation) => consultation.status === 'SCHEDULED' && (consultation.activityType === 'SITE_MEETING' || /site\s+meeting/i.test(consultation.title)));
   const siteMeetingHistory = selected?.consultations?.filter((consultation) => consultation.activityType === 'SITE_MEETING' || /site\s+meeting/i.test(consultation.title)) || [];
   const completedSiteMeeting = !scheduledSiteMeeting ? selected?.consultations?.find((consultation) => consultation.status === 'COMPLETED' && (consultation.activityType === 'SITE_MEETING' || /site\s+meeting/i.test(consultation.title)) && hasText(consultation.outcome)) : undefined;
   const currentActivityType = scheduledSiteMeeting?.activityType || 'SITE_MEETING';
   const canRecordActivity = Boolean(scheduledSiteMeeting && outcomeDecision && outcomeReadiness && outcomeCondition && outcomeNextStep);
   const canRecordDiscoveryCall = Boolean(scheduledDiscoveryCall && discoveryCallOutcome.trim());
  const discoveryDirty = Boolean(selected && JSON.stringify({discovery:discoveryForm,designInspirations}) !== lastSavedDiscovery.current);
  const romScopeSections = selected ? [
    { title: 'Project vision and design direction', items: proposalList(selected.description, selected.objectives, selected.designInspirations, discoveryForm.projectType ? `Project type: ${discoveryForm.projectType}` : '', discoveryForm.primaryUse ? `Intended use: ${discoveryForm.primaryUse}` : '', discoveryForm.householdUsers ? `Regular users: ${discoveryForm.householdUsers}` : '', discoveryForm.stylePreferences ? `Style preferences: ${discoveryForm.stylePreferences}` : '') },
    { title: 'Pool, outdoor living, and requested features', items: proposalList(selected.preliminaryScope, discoveryForm.poolSize ? `Approximate size: ${discoveryForm.poolSize}` : '', discoveryForm.depthProfile ? `Depths and activities: ${discoveryForm.depthProfile}` : '', discoveryForm.mustHaveFeatures ? `Must-have features: ${discoveryForm.mustHaveFeatures}` : '', discoveryForm.deckingOutdoorScope ? `Outdoor scope: ${discoveryForm.deckingOutdoorScope}` : '', discoveryForm.equipmentPreferences ? `Systems and equipment: ${discoveryForm.equipmentPreferences}` : '', discoveryForm.heatingPreference ? `Heating and cooling: ${discoveryForm.heatingPreference}` : '') },
    { title: 'Site investigation and feasibility', items: proposalList(discoveryForm.propertyAccess, discoveryForm.surveyStatus, discoveryForm.siteConditions, discoveryForm.utilities, siteAssessment, ...(selected.consultations || []).filter((item) => item.activityType === 'SITE_MEETING' || /site\s+meeting/i.test(item.title)).map((item) => item.outcome || item.notes)) },
    { title: 'Community, permits, and coordination', items: proposalList(discoveryForm.municipality, discoveryForm.communityDevelopment, discoveryForm.communitySubcommunity, discoveryForm.hoaArcContact, discoveryForm.hoaRequirements, discoveryForm.complianceCategories, ...(complianceResearch?.savedLinks || []).map((link) => `${link.authorityName}: ${link.title} (${link.url})`)) },
    { title: 'Investment, schedule, and priorities', items: proposalList(selected.budgetExpectation ? `Client budget expectation: ${selected.budgetExpectation}` : '', selected.desiredTiming ? `Target timing: ${selected.desiredTiming}` : '', discoveryForm.budgetRange ? `Discovery investment range: ${discoveryForm.budgetRange}` : '', discoveryForm.targetCompletion ? `Target completion: ${discoveryForm.targetCompletion}` : '', discoveryForm.priorityTradeoffs ? `Priorities: ${discoveryForm.priorityTradeoffs}` : '', discoveryForm.knownConcerns ? `Known concerns: ${discoveryForm.knownConcerns}` : '') },
  ].filter((section) => section.items.length > 0) : [];
  const romProjectNarrative = selected ? proposalText(
    `This preliminary Rough Order of Magnitude (ROM) outlines the current design direction for ${discoveryForm.projectType || selected.description || 'the residential project'}${selected.property?.address ? ` at ${selected.property.address}${selected.property.city ? `, ${selected.property.city}` : ''}${selected.property.state ? `, ${selected.property.state}` : ''}` : ''}.`,
    selected.objectives ? `The project is intended to ${selected.objectives}.` : '',
    discoveryForm.primaryUse ? `The planned use is ${discoveryForm.primaryUse.toLowerCase()}.` : '',
    selected.preliminaryScope ? `The inquiry's preliminary scope is: ${selected.preliminaryScope}.` : '',
    discoveryForm.mustHaveFeatures ? `Current must-haves include ${discoveryForm.mustHaveFeatures}.` : '',
    discoveryForm.deckingOutdoorScope ? `Related outdoor scope includes ${discoveryForm.deckingOutdoorScope}.` : '',
    siteAssessment ? `Site-meeting observations recorded so far: ${siteAssessment}.` : '',
    discoveryForm.communityDevelopment || discoveryForm.municipality ? `Planning coordination will consider ${proposalText(discoveryForm.communityDevelopment, discoveryForm.municipality)} and the recorded community requirements.` : '',
    handoffForm.proposalNarrative ? `Additional proposal narrative: ${handoffForm.proposalNarrative.trim()}` : '',
  ) : '';
  const romProposalDefaults:Record<RomProposalField,string> = {
    projectNarrative:romProjectNarrative,
    designBuildOverview:proposalText(selected?.description,selected?.objectives,selected?.preliminaryScope,discoveryForm.projectType,discoveryForm.stylePreferences,discoveryForm.mustHaveFeatures,discoveryForm.deckingOutdoorScope,discoveryForm.equipmentPreferences,discoveryForm.heatingPreference),
    proposedScope:proposalText(selected?.preliminaryScope,discoveryForm.mustHaveFeatures,discoveryForm.deckingOutdoorScope),
    exclusions:'',
    designDeliverables:'',
    clientResponsibilities:'',
    milestones:proposalText(selected?.desiredTiming?`Client timing preference: ${selected.desiredTiming}`:'',discoveryForm.targetCompletion?`Target completion discussed: ${discoveryForm.targetCompletion}`:''),
    allowancesOptions:'',
    assumptions:proposalText(discoveryForm.surveyStatus?`Survey status to verify: ${discoveryForm.surveyStatus}`:'',discoveryForm.propertyAccess?`Property access reported: ${discoveryForm.propertyAccess}`:'',discoveryForm.siteConditions?`Site conditions reported: ${discoveryForm.siteConditions}`:'',discoveryForm.utilities?`Utilities reported: ${discoveryForm.utilities}`:'',discoveryForm.hoaRequirements?`Community requirements reported: ${discoveryForm.hoaRequirements}`:''),
    depositTerms:'',
    nextSteps:'',
  };
  const romProposalValue = (key:RomProposalField) => romProposalOverrides[key] ?? romProposalDefaults[key];
  const editFormDirty = showEdit && JSON.stringify(editForm) !== editFormBaseline.current;
  const closeEdit = () => {
    if (editFormDirty && !window.confirm('You have unsaved intake changes. Choose OK to discard them, or Cancel to keep editing.')) return;
    setShowEdit(false);
  };

  const mutate = async (operation:()=>Promise<unknown>) => {
    try { setSaving(true); setError(''); await operation(); await load(); }
    catch (err) {
      const candidates = (err as any)?.response?.data?.error?.matchCandidates;
      if ((err as any)?.response?.data?.error?.code === 'STALE_INTAKE_REVISION') setHasIntakeConflict(true);
      if (Array.isArray(candidates)) {
        setMatchCandidates(candidates);
        setClients((current) => [...current, ...candidates.filter((candidate:LeadCandidate) => !current.some((item) => item.id === candidate.id))]);
      }
      setError(getApiErrorMessage(err,'The intake record could not be updated.'));
    }
    finally { setSaving(false); }
  };
  const saveCriterionReview = (criterionId: string, answerState: 'CONFIRMED' | 'UNKNOWN' | 'NOT_APPLICABLE', reason?: string, answerValue?: string) => {
    if (!selected) return;
    void mutate(() => inquiryApi.setCriterionState(selected.id, criterionId, { answerState, reason, answerValue }, selected.intakeRevision));
  };
  const create = (event:FormEvent) => {
    event.preventDefault();
    if (!form.leadEmail.trim() && !form.leadPhone.trim() && !form.clientId) {
      setError('Enter an email address or phone number so Reception can follow up.');
      return;
    }
    mutate(async()=>{
      const result = await inquiryApi.create({...form,clientId:form.clientId||undefined,lead:form.clientId?undefined:{name:form.leadName,email:form.leadEmail||null,phone:form.leadPhone||null},ownerId:form.ownerId||null,nextActionDueAt:form.nextActionDueAt||null,property:form.address.trim()?{address:form.address,city:form.city||null,state:form.state||null,postalCode:form.postalCode||null}:undefined});
      setSelected(result.data); setShowCreate(false); setForm({...emptyForm,ownerId:currentUser?.id||''}); setMatchCandidates([]); setActiveTab('INTAKE');
    });
  };
  const select = async (item:Inquiry) => {
    try {
      setHasIntakeConflict(false);
      setError('');
      const detail = (await inquiryApi.get(item.id)).data as Inquiry;
      setComplianceResearch(null);
      void inquiryApi.getComplianceResearch(item.id).then((response) => setComplianceResearch(response.data as ComplianceResearchSnapshot)).catch(() => {});
      setSelected(detail); setShowEdit(false); setShowRecord(true); setShowMore(false); setShowRomPreview(false); setShowRomEditor(false); setRomProposalOverrides(parseRomProposalOverrides(detail.romProposalDetails)); setActiveTab('INTAKE'); setDiscoverySubTab('QUESTIONS');
      const nextDiscovery = {...emptyDiscovery,...(detail.discovery||{}),complianceVerificationStatus:detail.complianceVerificationStatus||detail.discovery?.complianceVerificationStatus||'',complianceVerificationCheckedAt:detail.complianceVerificationCheckedAt||detail.discovery?.complianceVerificationCheckedAt||''};
      setDiscoveryForm(nextDiscovery); setDesignInspirations(detail.designInspirations || ''); lastSavedDiscovery.current = JSON.stringify({discovery:nextDiscovery,designInspirations:detail.designInspirations || ''}); setDiscoverySaveState('idle'); setShowHandoffConfirm(false);
       setSiteActivityType('SITE_MEETING');
       const scheduledSiteActivity = detail.consultations?.find((consultation) => consultation.status === 'SCHEDULED' && (consultation.activityType === 'SITE_MEETING' || /site\s+meeting/i.test(consultation.title)));
       const scheduledCall = detail.consultations?.find((consultation) => consultation.status === 'SCHEDULED' && consultation.activityType === 'PHONE_CALL');
       setSiteMeetingDate(scheduledSiteActivity?.date?.slice(0, 16) || '');
       setActivitySubject(scheduledSiteActivity?.subject || '');
       setActivityParticipants(scheduledSiteActivity?.participants || '');
       setActivityEndAt(scheduledSiteActivity?.endAt?.slice(0,16) || '');
       setActivityNextAction(scheduledSiteActivity?.nextAction || '');
       setActivityNextActionDueAt(scheduledSiteActivity?.nextActionDueAt?.slice(0,16) || '');
       setActivityCancellationReason('');
       setDiscoveryCallDate(scheduledCall?.date?.slice(0,16) || '');
       setDiscoveryCallSubject(scheduledCall?.subject || '');
       setDiscoveryCallParticipants(scheduledCall?.participants || '');
       setDiscoveryCallEndAt(scheduledCall?.endAt?.slice(0,16) || '');
       setDiscoveryCallNextAction(scheduledCall?.nextAction || '');
       setDiscoveryCallNextActionDueAt(scheduledCall?.nextActionDueAt?.slice(0,16) || '');
       setDiscoveryCallOutcome('');
      setOutcome(''); setOutcomeDecision(''); setOutcomeReadiness(''); setOutcomeCondition(''); setOutcomeNextStep(''); setOutcomeSpecific(''); setOutcomeSpecifics([]);
      setSiteAssessment(detail.siteAssessment || '');
      setHandoffForm({romAmount:detail.romAmount||'',romStatus:detail.romStatus||'',romDecisionAt:detail.romDecisionAt?detail.romDecisionAt.slice(0,16):'',romApprovedBy:detail.romApprovedBy||'',designAgreementStatus:detail.designAgreementStatus||'',designAgreementAcceptedAt:detail.designAgreementAcceptedAt?detail.designAgreementAcceptedAt.slice(0,16):'',designAgreementAcceptedBy:detail.designAgreementAcceptedBy||'',designAgreementNotRequiredReason:detail.readiness?.criteria.find((item)=>item.id==='DESIGN_AGREEMENT')?.reason||'',handoffSummary:detail.handoffSummary||'',proposalNarrative:detail.proposalNarrative||'',proposalProvidedAt:detail.proposalProvidedAt?detail.proposalProvidedAt.slice(0,16):'',proposalClientResponse:detail.proposalClientResponse||''});
      const nextEditForm = {leadName:detail.client.name||'',leadEmail:detail.client.email||'',leadPhone:detail.client.phone||'',description:detail.description||'',objectives:detail.objectives||'',preliminaryScope:detail.preliminaryScope||'',designInspirations:detail.designInspirations||'',budgetExpectation:detail.budgetExpectation||'',desiredTiming:detail.desiredTiming||'',source:detail.source||'',nextAction:detail.nextAction||'',nextActionDueAt:detail.nextActionDueAt?detail.nextActionDueAt.slice(0,16):'',address:detail.property?.address||'',city:detail.property?.city||'',state:detail.property?.state||'AZ',postalCode:detail.property?.postalCode||''};
      setEditForm(nextEditForm); editFormBaseline.current = JSON.stringify(nextEditForm);
    } catch (err) { setError(getApiErrorMessage(err,'Intake details could not be loaded.')); }
  };
  useEffect(() => {
    const inquiryId = searchParams.get('inquiryId');
    if (!inquiryId || selected?.id === inquiryId) return;
    const item = items.find((candidate) => candidate.id === inquiryId);
    if (item) void select(item);
  }, [items, searchParams]);
  useEffect(() => {
    if (!selected || activeTab !== 'QUESTIONS' || !discoveryDirty) return;
    const snapshot = JSON.stringify({discovery:discoveryForm,designInspirations});
    const timer = window.setTimeout(async () => {
      setDiscoverySaveState('saving');
      try {
        const response = await inquiryApi.update(selected.id, { discovery: discoveryForm, designInspirations: designInspirations.trim() || null }, selected.intakeRevision);
        lastSavedDiscovery.current = snapshot;
        setSelected(response.data);
        setDiscoverySaveState('saved');
      } catch {
        setDiscoverySaveState('error');
      }
    }, 800);
    return () => window.clearTimeout(timer);
  }, [selected?.id, activeTab, discoveryForm, designInspirations]);
  useEffect(() => {
    if (!selected || !['QUEUED', 'RUNNING'].includes(complianceResearch?.job?.status || '')) return;
    let cancelled = false;
    const timer = window.setInterval(() => {
      void Promise.all([inquiryApi.getComplianceResearch(selected.id), inquiryApi.get(selected.id)]).then(([researchResponse, inquiryResponse]) => {
        if (cancelled) return;
        const snapshot = researchResponse.data as ComplianceResearchSnapshot;
        setComplianceResearch(snapshot);
        setSelected(inquiryResponse.data as Inquiry);
        setDiscoveryForm((current) => ({ ...current,
          complianceVerificationStatus: snapshot.verification.status || current.complianceVerificationStatus,
          complianceVerificationCheckedAt: snapshot.verification.checkedAt || current.complianceVerificationCheckedAt,
        }));
      }).catch(() => {});
    }, 2000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [selected?.id, complianceResearch?.job?.status]);
  useEffect(() => {
    if (!discoveryDirty) return;
    const warn = (event:BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [discoveryDirty]);
  useEffect(() => {
    if (!editFormDirty) return;
    const warn = (event:BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [editFormDirty]);
  const changeStatus = (status:string) => {
    if (!selected) return;
    if (['DECLINED','NURTURED'].includes(status)) { setStatusAction(status as 'NURTURED'|'DECLINED'); setStatusReason(''); return; }
    mutate(()=>inquiryApi.setStatus(selected.id,status,selected.intakeRevision));
  };
  const saveDiscovery = (event:FormEvent) => {
    event.preventDefault();
    if (!selected) return;
    const snapshot = JSON.stringify({discovery:discoveryForm,designInspirations});
    mutate(async()=>{ await inquiryApi.update(selected.id,{discovery:discoveryForm,designInspirations:designInspirations.trim()||null},selected.intakeRevision); lastSavedDiscovery.current = snapshot; setDiscoverySaveState('saved'); });
  };
  const verifyComplianceCategories = () => {
    if (!selected?.property?.address) {
      setError('Enter the project address before verifying compliance categories.');
      return;
    }
    const reviewedCategories = discoveryForm.complianceCategories.trim() || complianceResearch?.verification.categories || '';
    const reviewedLinks = [...new Set([
      ...discoveryForm.complianceLinks.split(/\s*\n\s*/).filter(Boolean),
      ...(complianceResearch?.job?.sources.map((source) => source.url) || []),
      ...(complianceResearch?.savedLinks?.map((link) => link.url) || []),
    ])].join('\n');
    mutate(async()=>{
      const response = await inquiryApi.verifyCompliance(selected.id,{status:'VERIFIED',source:complianceResearch?.job?.sources.length?'Automated public-web sources reviewed by representative':'Representative address review',categories:reviewedCategories,links:reviewedLinks||null,notes:'Compliance categories, research findings, and supporting source links reviewed by the assigned representative.'},selected.intakeRevision);
      const verified = response.data as Inquiry;
      setDiscoveryForm((current)=>({...current,complianceCategories:reviewedCategories,complianceLinks:reviewedLinks,complianceVerificationStatus:verified.complianceVerificationStatus||'VERIFIED',complianceVerificationCheckedAt:verified.complianceVerificationCheckedAt||new Date().toISOString(),complianceFollowUpStatus:'VERIFIED'}));
    });
  };
  const saveComplianceLink = (source: ComplianceResearchSource) => {
    if (!selected) return;
    mutate(async () => {
      const response = await inquiryApi.addComplianceLink(selected.id, {
        title: source.title || source.domain,
        url: source.url,
        domain: source.domain,
        summary: summarizeComplianceExcerpt(source.excerpt),
        authorityType: source.authorityType,
        authorityName: source.authorityName,
      },selected.intakeRevision);
      const saved = response.data as ComplianceResearchSnapshot['savedLinks'][number];
      setComplianceResearch((current) => current ? {
        ...current,
        savedLinks: [saved, ...current.savedLinks.filter((link) => link.url !== saved.url)],
      } : current);
    });
  };
  const createContactLog = (event:FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected) return;
    const followUpTitle = contactFollowUpTitle.trim();
    const followUpFieldsStarted = Boolean(followUpTitle || contactFollowUpOwner || contactFollowUpDueAt);
    if (followUpFieldsStarted && (!followUpTitle || !contactFollowUpOwner || !contactFollowUpDueAt)) {
      setError('A follow-up needs an action, owner, and due date.');
      return;
    }
    const occurredAt = new Date().toISOString();
    mutate(async()=>{
      await inquiryApi.logActivity(selected.id,{
        channel:contactChannel,direction:contactDirection,contactPerson:contactPerson.trim()||null,
        occurredAt,organizationTimezone:'America/Phoenix',summary:contactSummary.trim(),outcomeCode:contactOutcome,
        ...(followUpFieldsStarted?{followUp:{title:followUpTitle,ownerId:contactFollowUpOwner,dueAt:new Date(contactFollowUpDueAt).toISOString()}}:{}),
        expectedIntakeRevision:selected.intakeRevision,idempotencyKey:crypto.randomUUID(),
      });
      setContactSummary('');setContactPerson('');setContactFollowUpTitle('');setContactFollowUpOwner('');setContactFollowUpDueAt('');setContactOutcome('CONNECTED');
    });
  };
  const categorizeDocumentAsEvidence = (documentId:string,category:string) => {
    if (!selected) return;
    mutate(()=>inquiryApi.addEvidence(selected.id,{documentId,category,expectedIntakeRevision:selected.intakeRevision}));
  };
  const reviewClientDisposition = (activityId:string,payload:Record<string,unknown>) => {
    if (!selected) return;
    mutate(()=>inquiryApi.reviewDisposition(selected.id,{...payload,activityId,expectedIntakeRevision:selected.intakeRevision,attested:true}));
  };
  const recordExternalDisposition = (event:FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected) return;
    mutate(async()=>{
      await inquiryApi.logActivity(selected.id,{
        channel:externalDispositionChannel,direction:'INBOUND',occurredAt:new Date().toISOString(),
        organizationTimezone:'America/Phoenix',summary:externalDispositionSummary.trim(),
        outcomeCode:'CLIENT_DISPOSITION_RECEIVED',clientDispositionValue:externalDisposition,
        expectedIntakeRevision:selected.intakeRevision,idempotencyKey:crypto.randomUUID(),
      });
      setExternalDispositionSummary('');
    });
  };
  const startComplianceResearch = async () => {
    if (!selected) return;
    if (!selected.property?.address?.trim()) {
      setError('Add the property address before researching public compliance sources.');
      return;
    }
    try {
      setSaving(true); setError('');
      const response = await inquiryApi.startComplianceResearch(selected.id,selected.intakeRevision);
      setComplianceResearch(response.data as ComplianceResearchSnapshot);
      await load();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Compliance research could not be started.'));
    } finally { setSaving(false); }
  };
   const scheduleSiteMeeting = () => {
     if (!selected || !siteMeetingDate) return;
     mutate(async()=>{ await consultationApi.create(selected.clientId,{ title:'Site meeting', activityType:'SITE_MEETING', meetingMode:'ONSITE', subject:activitySubject.trim()||null, date:new Date(siteMeetingDate).toISOString(), endAt:activityEndAt?new Date(activityEndAt).toISOString():null, status:'SCHEDULED', inquiryId:selected.id, expectedIntakeRevision:selected.intakeRevision, participants:activityParticipants.trim()||null, nextAction:activityNextAction||null, nextActionDueAt:activityNextActionDueAt?new Date(activityNextActionDueAt).toISOString():null }); });
   };
   const scheduleDiscoveryCall = () => {
     if (!selected || !discoveryCallDate) return;
     mutate(async()=>{ await consultationApi.create(selected.clientId,{ title:'Pre-design discovery call', activityType:'PHONE_CALL', meetingMode:'PHONE', subject:discoveryCallSubject.trim()||null, date:new Date(discoveryCallDate).toISOString(), endAt:discoveryCallEndAt?new Date(discoveryCallEndAt).toISOString():null, status:'SCHEDULED', inquiryId:selected.id, expectedIntakeRevision:selected.intakeRevision, participants:discoveryCallParticipants.trim()||null, nextAction:discoveryCallNextAction||null, nextActionDueAt:discoveryCallNextActionDueAt?new Date(discoveryCallNextActionDueAt).toISOString():null }); });
   };
   const cancelDiscoveryCall = () => {
     if (!selected || !scheduledDiscoveryCall || !activityCancellationReason.trim()) return;
     mutate(()=>consultationApi.update(selected.clientId,scheduledDiscoveryCall.id,{status:'CANCELLED',cancellationReason:activityCancellationReason.trim(),expectedIntakeRevision:selected.intakeRevision}));
   };
   const recordDiscoveryCall = () => {
     if (!selected || !scheduledDiscoveryCall || !discoveryCallOutcome.trim()) return;
     mutate(async()=>{
       await consultationApi.update(selected.clientId,scheduledDiscoveryCall.id,{status:'COMPLETED',meetingMode:'PHONE',subject:discoveryCallSubject.trim()||null,participants:discoveryCallParticipants.trim()||null,endAt:discoveryCallEndAt?new Date(discoveryCallEndAt).toISOString():null,nextAction:discoveryCallNextAction||null,nextActionDueAt:discoveryCallNextActionDueAt?new Date(discoveryCallNextActionDueAt).toISOString():null,outcome:discoveryCallOutcome.trim(),expectedIntakeRevision:selected.intakeRevision});
       setDiscoveryCallOutcome(''); setDiscoveryCallSubject(''); setDiscoveryCallParticipants(''); setDiscoveryCallEndAt(''); setDiscoveryCallNextAction(''); setDiscoveryCallNextActionDueAt('');
     });
   };
   const cancelScheduledActivity = () => {
    if (!selected || !scheduledSiteMeeting || !activityCancellationReason.trim()) return;
    mutate(()=>consultationApi.update(selected.clientId,scheduledSiteMeeting.id,{status:'CANCELLED',cancellationReason:activityCancellationReason.trim(),expectedIntakeRevision:selected.intakeRevision}));
  };
  const addOutcomeSpecific = () => {
    const specific = outcomeSpecific.trim();
    if (!specific) return;
    setOutcomeSpecifics((current) => [...current, specific]);
    setOutcomeSpecific('');
  };
  const recordSiteMeetingOutcome = () => {
    if (!selected || !scheduledSiteMeeting) return;
    const activityType = scheduledSiteMeeting.activityType || siteActivityType;
    if (activityType !== 'SITE_MEETING') {
      if (!outcome.trim()) return;
      mutate(async()=>{
        await consultationApi.update(selected.clientId,scheduledSiteMeeting.id,{status:'COMPLETED',meetingMode:activityType==='PHONE_CALL'?'PHONE':activityType==='VIDEO_CALL'?'VIDEO':'ONSITE',subject:activitySubject.trim()||null,participants:activityParticipants.trim()||null,endAt:activityEndAt?new Date(activityEndAt).toISOString():null,nextAction:activityNextAction||null,nextActionDueAt:activityNextActionDueAt?new Date(activityNextActionDueAt).toISOString():null,outcome:outcome.trim(),expectedIntakeRevision:selected.intakeRevision});
        setOutcome(''); setActivitySubject(''); setActivityParticipants(''); setActivityEndAt(''); setActivityNextAction(''); setActivityNextActionDueAt('');
      });
      return;
    }
    if (!outcomeDecision || !outcomeReadiness || !outcomeCondition || !outcomeNextStep) return;
    const details = [
      `Client decision: ${outcomeDecision}`,
      `Site readiness: ${outcomeReadiness}`,
      `Observed conditions: ${outcomeCondition}`,
      `Next step: ${outcomeNextStep}`,
      outcomeSpecifics.length ? `Specific findings: ${outcomeSpecifics.join('; ')}` : '',
      outcome.trim() ? `Additional notes: ${outcome.trim()}` : '',
    ].filter(Boolean).join('\n');
    mutate(async()=>{
      await consultationApi.update(selected.clientId,scheduledSiteMeeting.id,{status:'COMPLETED',meetingMode:'ONSITE',subject:activitySubject.trim()||null,participants:activityParticipants.trim()||null,endAt:activityEndAt?new Date(activityEndAt).toISOString():null,nextAction:activityNextAction||null,nextActionDueAt:activityNextActionDueAt?new Date(activityNextActionDueAt).toISOString():null,outcome:details,expectedIntakeRevision:selected.intakeRevision});
      setOutcome(''); setOutcomeDecision(''); setOutcomeReadiness(''); setOutcomeCondition(''); setOutcomeNextStep(''); setOutcomeSpecific(''); setOutcomeSpecifics([]);
    });
  };
  const saveSiteAssessment = () => {
    if (!selected) return;
    mutate(()=>inquiryApi.update(selected.id,{siteAssessment:siteAssessment.trim()||null},selected.intakeRevision));
  };
  const saveHandoffDetails = () => {
    if (!selected) return;
    if (handoffForm.designAgreementStatus==='NOT_REQUIRED'&&!handoffForm.designAgreementNotRequiredReason.trim()) {
      setError('An Admin reason is required to mark the Design Agreement not required.');
      return;
    }
    const romApproved = handoffForm.romStatus === 'APPROVED';
    const agreementAccepted = handoffForm.designAgreementStatus === 'ACCEPTED';
    mutate(async()=>{
      await inquiryApi.update(selected.id,{romAmount:handoffForm.romAmount.trim()||null,romStatus:handoffForm.romStatus||null,romDecisionAt:romApproved&&handoffForm.romDecisionAt?new Date(handoffForm.romDecisionAt).toISOString():null,romApprovedBy:romApproved?(handoffForm.romApprovedBy||currentUser?.id||null):null,designAgreementStatus:handoffForm.designAgreementStatus||null,designAgreementAcceptedAt:agreementAccepted&&handoffForm.designAgreementAcceptedAt?new Date(handoffForm.designAgreementAcceptedAt).toISOString():null,designAgreementAcceptedBy:agreementAccepted?(handoffForm.designAgreementAcceptedBy||currentUser?.id||null):null,handoffSummary:handoffForm.handoffSummary.trim()||null,proposalNarrative:handoffForm.proposalNarrative.trim()||null,romProposalDetails:JSON.stringify(romProposalOverrides),proposalProvidedAt:handoffForm.proposalProvidedAt?new Date(handoffForm.proposalProvidedAt).toISOString():null,proposalClientResponse:handoffForm.proposalClientResponse.trim()||null},selected.intakeRevision);
      let previewRevision=selected.intakeRevision+1;
      if (handoffForm.designAgreementStatus==='NOT_REQUIRED') {
        await inquiryApi.setCriterionState(selected.id,'DESIGN_AGREEMENT',{answerState:'CONFIRMED',reason:handoffForm.designAgreementNotRequiredReason.trim()},previewRevision);
        previewRevision++;
      }
      await inquiryApi.saveRomPreview(selected.id,previewRevision);
    });
  };
  const saveRomProposal = (event:FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected) return;
    mutate(async()=>{
      await inquiryApi.update(selected.id,{romProposalDetails:JSON.stringify(romProposalOverrides)},selected.intakeRevision);
      await inquiryApi.saveRomPreview(selected.id,selected.intakeRevision+1);
      setShowRomEditor(false);
    });
  };
  const runHandoffReview = () => {
    if (!selected) return;
    mutate(()=>inquiryApi.reviewHandoff(selected.id,{expectedIntakeRevision:selected.intakeRevision,workflowVersion:selected.readiness?.workflowVersion||1}));
  };
  const completeHandoff = () => {
    if (!selected) return;
    mutate(async()=>{
      const response = await inquiryApi.convert(selected.id,selected.intakeRevision);
      const data = response.data;
      const projectId = data.project?.id || data.id;
      setHandoffSuccess({clientId:data.client?.id || selected.clientId,projectId});
      setShowRecord(false); setShowHandoffConfirm(false);
    });
  };
  const downloadInquiryPdf = async () => {
    if (!selected) return;
    try {
      setExportingInquiry(true);
      setError('');
      await inquiryApi.downloadPdf(selected.id, selected.client.name);
    } catch (err) {
      setError(getApiErrorMessage(err, 'The inquiry PDF could not be downloaded.'));
    } finally {
      setExportingInquiry(false);
    }
  };
  const queueCards = workflowQueueDefinitions.map((definition, index) => ({
    ...definition,
    step: index + 1,
    count: counts[definition.key as keyof typeof counts],
    tone: ['text-blue-700', 'text-amber-700', 'text-emerald-700', 'text-violet-700'][index],
  }));
  const selectedWorkflow = queueCards.find((card) => card.key === queue);

  return <div className="mx-auto max-w-7xl space-y-6">
    <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"><div><p className="text-sm font-semibold text-blue-700">Reception workspace</p><h1 className="text-2xl font-bold text-gray-950">Reception Intake</h1><p className="mt-1 max-w-2xl text-sm text-gray-600">Build one clear project record that Design can continue without repeating the first conversation.</p></div><button onClick={()=>setShowCreate(!showCreate)} className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"><Plus className="mr-2 inline h-4 w-4" />New project inquiry</button></header>
    {error && !showEdit && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"><AlertCircle className="mr-2 inline h-4 w-4" />{error}</div>}
    {handoffSuccess && <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"><CheckCircle2 className="mr-2 inline h-4 w-4" /><span className="font-semibold">Lead converted to active client and Design project created.</span><span className="ml-2 inline-flex gap-3"><Link className="font-semibold underline" to={`/clients/${handoffSuccess.clientId}`}>Open Client</Link><Link className="font-semibold underline" to={`/projects/${handoffSuccess.projectId}`}>Open Design project</Link></span></div>}
<section aria-label="Pool construction intake workflow" className="rounded-xl border border-gray-200 bg-white p-4"><div className="flex flex-col gap-1"><p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Pool construction workflow</p><p className="text-sm text-gray-600">Select a phase to view the inquiries currently matching it.</p></div><div className="mt-4 flex flex-col gap-3 xl:flex-row xl:items-stretch">{queueCards.map((card,index)=><div key={card.key} className="flex min-w-0 flex-1 basis-0 items-stretch gap-3"><button onClick={()=>{setFilter('');setQueue(card.key);}} aria-label={`${card.label}: ${card.count} inquiries`} className={`flex h-full min-w-0 flex-1 flex-col rounded-xl border p-4 text-left transition hover:border-blue-400 hover:shadow-sm ${queue===card.key&&!filter?'border-blue-500 bg-blue-50 ring-2 ring-blue-100':'border-gray-200 bg-white'}`}><div className="flex min-h-[4rem] items-start justify-between gap-2"><p className="text-sm font-semibold leading-5 text-gray-900">{card.label}</p><span className={`shrink-0 text-2xl font-bold ${card.tone}`}>{card.count}</span></div><p className="mt-auto pt-4 text-xs font-semibold text-blue-700">View this phase</p></button>{index<queueCards.length-1&&<ArrowRight className="hidden w-5 shrink-0 self-center text-gray-300 xl:block" aria-hidden="true"/>}</div>)}</div></section>

    {showCreate && <FormModal open title="New project inquiry" description="Capture the lead and the project details Reception needs before Design." busy={saving} showSubmit={false} cancelLabel="Close" maxWidthClass="max-w-5xl" onClose={()=>setShowCreate(false)}><form onSubmit={create} className="space-y-6 rounded-xl border border-blue-200 bg-blue-50 p-5"><div><h2 className="text-lg font-semibold">Capture a project inquiry</h2><p className="mt-1 text-sm text-gray-600">Create the Reception lead and capture the project in one step. Clients does not need to be opened first.</p></div>{matchCandidates.length>0&&<div className="rounded-lg border border-amber-300 bg-amber-50 p-4"><p className="text-sm font-semibold text-amber-950">We found an existing client with this contact information.</p><p className="mt-1 text-sm text-amber-900">Select the correct record below to avoid creating a duplicate.</p><div className="mt-3 space-y-2">{matchCandidates.map((candidate)=><button type="button" key={candidate.id} onClick={()=>{setForm({...form,clientId:candidate.id,leadName:candidate.name,leadEmail:candidate.email||'',leadPhone:candidate.phone||''});setMatchCandidates([]);setError('');}} className="w-full rounded-lg border border-amber-200 bg-white p-3 text-left text-sm hover:border-blue-400"><span className="font-semibold">{candidate.name}</span><span className="ml-2 text-gray-600">{candidate.email||candidate.phone||'No contact listed'}</span></button>)}</div></div>}<FormSection title="1. Lead and ownership"><Select label="Existing Reception lead (optional)" value={form.clientId} set={(value)=>{const match=clients.find((client)=>client.id===value);setForm({...form,clientId:value,leadName:match?.name||'',leadEmail:match?.email||'',leadPhone:match?.phone||''});}} options={clients.map((client)=>({value:client.id,label:`${client.name}${client.email?` · ${client.email}`:client.phone?` · ${client.phone}`:''}`}))}/>{!form.clientId&&<><Field label="Lead name" value={form.leadName} set={(value)=>setForm({...form,leadName:value})} required/><Field label="Lead email" type="email" value={form.leadEmail} set={(value)=>setForm({...form,leadEmail:value})}/><Field label="Lead phone" value={form.leadPhone} set={(value)=>setForm({...form,leadPhone:value})}/><p className="text-xs text-gray-600 md:col-span-2">Enter at least one contact method: email or phone.</p></>}<Select label="Reception owner" value={form.ownerId} set={(value)=>setForm({...form,ownerId:value})} options={users.map((user)=>({value:user.id,label:user.name}))}/><ChannelSelect value={form.source} set={(value)=>setForm({...form,source:value})}/><Field label="Next reception action" value={form.nextAction} set={(value)=>setForm({...form,nextAction:value})}/><Field label="Next action due" type="datetime-local" value={form.nextActionDueAt} set={(value)=>setForm({...form,nextActionDueAt:value})}/></FormSection><FormSection title="2. Property"><Field label="Property address" value={form.address} set={(value)=>setForm({...form,address:value})}/><Field label="City" value={form.city} set={(value)=>setForm({...form,city:value})}/><Field label="State" value={form.state} set={(value)=>setForm({...form,state:value})}/><Field label="Postal code" value={form.postalCode} set={(value)=>setForm({...form,postalCode:value})}/><p className="text-xs text-gray-600 md:col-span-2">Property details can be completed later if the address is not known yet.</p></FormSection><FormSection title="3. Project vision"><Area label="What would the client like to create or change?" value={form.description} set={(value)=>setForm({...form,description:value})}/><Area label="What should the finished project accomplish?" value={form.objectives} set={(value)=>setForm({...form,objectives:value})}/><Area label="Preliminary features or scope" value={form.preliminaryScope} set={(value)=>setForm({...form,preliminaryScope:value})}/><Area label="Design inspirations or reference links" value={form.designInspirations} set={(value)=>setForm({...form,designInspirations:value})} className="md:col-span-2"/><div className="grid gap-4"><Field label="Budget expectation" value={form.budgetExpectation} set={(value)=>setForm({...form,budgetExpectation:value})}/><Field label="Desired timing" value={form.desiredTiming} set={(value)=>setForm({...form,desiredTiming:value})}/></div></FormSection><div className="flex justify-end gap-3"><button type="button" onClick={()=>setShowCreate(false)} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium">Cancel</button><button disabled={saving} className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving?'Saving…':'Save intake'}</button></div></form></FormModal>}

    <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4"><div className="flex flex-col gap-3 lg:flex-row lg:items-center"><label className="flex-1 text-sm font-medium text-gray-700">Search Reception leads<input aria-label="Search Reception leads" value={search} onChange={(event)=>setSearch(event.target.value)} placeholder="Name, email, phone, or property address" className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-normal" /></label><label className="text-sm font-medium text-gray-700">Exact status <select value={filter} onChange={(event)=>setFilter(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 lg:w-auto"><option value="">Use workflow stage</option>{statuses.map((status)=><option key={status} value={status}>{status.replace(/_/g,' ')}</option>)}</select></label><div className="flex gap-2 pt-1"><button type="button" onClick={()=>setOwnerScope('ALL')} className={`rounded-lg px-3 py-2 text-sm font-semibold ${ownerScope==='ALL'?'bg-blue-100 text-blue-800':'border border-gray-300 text-gray-700'}`}>All leads</button><button type="button" onClick={()=>setOwnerScope('MINE')} className={`rounded-lg px-3 py-2 text-sm font-semibold ${ownerScope==='MINE'?'bg-blue-100 text-blue-800':'border border-gray-300 text-gray-700'}`}>My leads</button><button type="button" onClick={()=>setOverdueOnly((value)=>!value)} aria-pressed={overdueOnly} className={`rounded-lg px-3 py-2 text-sm font-semibold ${overdueOnly?'bg-red-100 text-red-800':'border border-gray-300 text-gray-700'}`}>Overdue</button></div></div><button onClick={()=>{setQueue('ACTIVE');setFilter('');setOwnerScope('ALL');setOverdueOnly(false);}} className={`text-left text-sm font-semibold ${queue==='ACTIVE'&&!filter&&!overdueOnly?'text-blue-700':'text-gray-700'}`}>{queue==='ACTIVE'&&!filter?'All active intake records':filter?`Showing ${workflowStatusLabels[filter]||filter.replace(/_/g,' ')}`:selectedWorkflow?.label||'All active intake records'}</button></div>

    <div className="grid gap-6 lg:grid-cols-5"><section aria-label="Reception intake list" className="space-y-2 lg:col-span-5">
      {visibleItems.length?visibleItems.map((item)=>{const progress=coreIntakeProgress(item);return <button key={item.id} onClick={()=>select(item)} className={`grid w-full items-center gap-4 rounded-xl border bg-white p-4 text-left transition hover:border-blue-400 hover:shadow-sm md:grid-cols-[minmax(0,1.4fr)_auto_minmax(10rem,0.8fr)_minmax(0,1.2fr)_auto] ${selected?.id===item.id?'border-blue-500':'border-gray-200'}`}>
        <div className="min-w-0"><p className="truncate font-semibold text-gray-950">{item.client.name}</p><p className="mt-1 truncate text-sm text-gray-600">{item.property?.address||'Property not identified'}</p></div>
        <span className={`w-fit shrink-0 rounded-full px-2 py-1 text-xs font-semibold ${statusColor[item.qualificationStatus]}`}>{workflowStatusLabels[item.qualificationStatus]||item.qualificationStatus.replace(/_/g,' ')}</span>
        <div><div className="mb-1 flex justify-between text-xs text-gray-500"><span>Core intake</span><span>{progress}%</span></div><div className="h-1.5 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-blue-600" style={{width:`${progress}%`}}/></div></div>
        <p className="min-w-0 truncate text-sm text-gray-600"><Clock3 className="mr-1 inline h-3.5 w-3.5"/>Next: {item.nextAction||'Assign a next action'}{item.nextActionDueAt?` · ${new Date(item.nextActionDueAt).toLocaleDateString()}`:''}</p>
        <ArrowRight className="hidden h-5 w-5 text-gray-400 md:block"/>
      </button>;}) : <div className="rounded-xl border border-dashed p-8 text-center text-gray-500"><Inbox className="mx-auto mb-2 h-8 w-8"/>No intake records in this queue.</div>}
    </section>

      {selected&&<FormModal open={showRecord} title={selected.client.name} description={selected.property?`${selected.property.address}, ${selected.property.city||''} ${selected.property.state||''}`:'Property information needed'} showSubmit={false} cancelLabel="Close" maxWidthClass="max-w-5xl" onClose={()=>setShowRecord(false)}>
        <InquiryPhaseProgress completions={selectedPhaseCompletions} activePhaseIndex={selectedPhaseCompletions.findIndex((phase) => !phase.complete) < 0 ? inquiryPhaseDefinitions.length - 1 : Math.max(0, selectedPhaseCompletions.findIndex((phase) => !phase.complete))} onOpen={(tab)=>{setActiveTab(tab);if(tab==='QUESTIONS')setDiscoverySubTab('QUESTIONS');}} />
        {currentUser?.role==='ADMIN'&&['NEW','IN_REVIEW','QUALIFIED'].includes(selected.qualificationStatus)&&criteriaForAdminReview.length>0&&<LegacyCriterionReviewPanel inquiry={selected} criteria={criteriaForAdminReview} saving={saving} onSave={saveCriterionReview}/>}
        <nav aria-label="Intake record sections" className="flex items-center overflow-x-auto border-b border-gray-200 px-3"><TabButton disabled={!phaseUnlocked(0)} active={activeTab==='INTAKE'} onClick={()=>setActiveTab('INTAKE')} icon={<UserRound className="h-4 w-4"/>} label="Intake"/><TabButton disabled={!phaseUnlocked(1)} active={activeTab==='QUESTIONS'} onClick={()=>{setDiscoverySubTab('QUESTIONS');setActiveTab('QUESTIONS');}} icon={<ClipboardList className="h-4 w-4"/>} label={`Pre-design discovery${selectedDiscoveryProgress.percent===100?' ✓':''}${discoverySaveState==='saved'?' · Saved':''}`}/><TabButton disabled={!phaseUnlocked(2)} active={activeTab==='SCHEDULE'} onClick={()=>setActiveTab('SCHEDULE')} icon={<Clock3 className="h-4 w-4"/>} label="Site Meetings"/><TabButton active={activeTab==='FILES'} onClick={()=>setActiveTab('FILES')} icon={<FileText className="h-4 w-4"/>} label="Files"/><TabButton disabled={!phaseUnlocked(3)} active={activeTab==='HANDOFF'} onClick={()=>setActiveTab('HANDOFF')} icon={<ClipboardCheck className="h-4 w-4"/>} label="Handoff"/><button type="button" onClick={downloadInquiryPdf} disabled={exportingInquiry} className="ml-auto inline-flex shrink-0 items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50"><Download className="h-4 w-4"/>{exportingInquiry?'Preparing report…':'Download inquiry report'}</button></nav>
        <div className="inquiry-form-shell p-5">
          {activeTab==='HANDOFF'&&<div className="mb-4 flex flex-wrap justify-end gap-2"><button type="button" onClick={()=>setShowRomEditor(true)} className="inline-flex items-center gap-2 rounded-lg border border-blue-300 bg-white px-4 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-50"><FileText className="h-4 w-4"/>Edit ROM proposal</button><button type="button" onClick={()=>setShowRomPreview(true)} className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"><FileText className="h-4 w-4"/>Preview ROM proposal</button></div>}
           {activeTab==='INTAKE'&&<div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold">Project information</h3><p className="mt-1 text-sm text-gray-600">Capture facts once and build on this record through Design.</p></div><button onClick={()=>{setShowRecord(false);setShowEdit(true);}} className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium hover:border-blue-500 hover:text-blue-700">Edit intake</button></div>
            <div className="grid gap-4 sm:grid-cols-2"><Detail label="Client email" value={selected.client.email}/><Detail label="Project description" value={selected.description}/><Detail label="Objectives" value={selected.objectives}/><Detail label="Preliminary scope" value={selected.preliminaryScope}/><Detail label="Budget expectation" value={selected.budgetExpectation} preliminary/><Detail label="Desired timing" value={selected.desiredTiming} preliminary/><Detail label="Source / referral" value={selected.source}/><Detail label="Reception owner" value={selected.owner?.name}/></div>
            {!selected.ownerId&&<div className="rounded-lg border border-amber-200 bg-amber-50 p-4"><p className="mb-3 text-sm font-semibold text-amber-950">This inquiry needs an owner and next action.</p><Select label="Assign reception owner" value="" set={(ownerId)=>ownerId&&mutate(()=>inquiryApi.update(selected.id,{ownerId,nextAction:selected.nextAction||'Complete qualification review',nextActionDueAt:new Date(Date.now()+86400000).toISOString()},selected.intakeRevision))} options={users.map((user)=>({value:user.id,label:user.name}))}/></div>}
            {['NEW','IN_REVIEW'].includes(selected.qualificationStatus)&&<section className="rounded-xl border border-blue-200 bg-blue-50 p-4"><div><h3 className="font-semibold text-blue-950">Qualification review</h3><p className="mt-1 text-sm text-blue-900">These Admin decisions stay in Intake so you can complete qualification before Handoff unlocks.</p></div><div className="mt-3 flex flex-wrap gap-3">{selected.qualificationStatus==='NEW'&&<button disabled={saving||!phaseOneComplete} title={!phaseOneComplete?'Complete every Phase 1 requirement first.':undefined} onClick={()=>changeStatus('IN_REVIEW')} className="rounded-lg bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-950 disabled:cursor-not-allowed disabled:opacity-50">Begin qualification review</button>}{selected.qualificationStatus==='IN_REVIEW'&&<button disabled={saving||!phaseTwoComplete} title={!phaseTwoComplete?'Complete all other Pre-design Discovery requirements first.':undefined} onClick={()=>changeStatus('QUALIFIED')} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">Mark qualified</button>}</div></section>}
          </div>}

           {activeTab==='QUESTIONS'&&<form noValidate onSubmit={saveDiscovery} className="space-y-6">
            <div className="border-b border-gray-200 pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-semibold text-gray-950">Pre-design discovery</h3><p className="mt-1 text-sm text-gray-600">Capture the essentials with the client; answers stay with this inquiry.</p></div><span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">{selectedDiscoveryProgress.complete} of {selectedDiscoveryProgress.total} essentials</span></div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-blue-600 transition-all" style={{width:`${selectedDiscoveryProgress.percent}%`}}/></div>
            </div>
            <nav aria-label="Pre-design discovery sections" className="flex flex-wrap gap-2 border-b border-gray-200 pb-3" role="tablist">
              {[{key:'QUESTIONS' as const,label:'Questions'},{key:'COMMUNITY' as const,label:'Community and compliance context'},{key:'CALL_TRACKER' as const,label:'Pre-design discovery call tracker'}].map((tab)=><button key={tab.key} type="button" role="tab" aria-selected={discoverySubTab===tab.key} onClick={()=>setDiscoverySubTab(tab.key)} className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${discoverySubTab===tab.key?'bg-blue-700 text-white':'border border-gray-200 bg-white text-gray-700 hover:border-blue-300 hover:text-blue-700'}`}>{tab.label}</button>)}
            </nav>
            {discoverySubTab==='QUESTIONS'&&<div role="tabpanel" className="space-y-6">
            <DiscoverySection number="1" title="Project purpose and decision process" description="Establish what is being built, why it matters, and who can approve decisions.">
              <DiscoverySelect required label="Project type" value={discoveryForm.projectType} set={(value)=>setDiscoveryForm({...discoveryForm,projectType:value})} options={['New pool and spa','New pool only','Pool renovation','Outdoor living addition','Not yet determined']}/>
              <DiscoverySelect required label="How will the client primarily use the pool?" value={discoveryForm.primaryUse} set={(value)=>setDiscoveryForm({...discoveryForm,primaryUse:value})} options={discoveryPrimaryUseOptions}/>
              <DiscoveryChoices label="Who will regularly use the pool?" value={discoveryForm.householdUsers} set={(value)=>setDiscoveryForm({...discoveryForm,householdUsers:value})} options={discoveryHouseholdOptions}/>
              <DiscoverySelect required label="Who are the decision makers and how will approvals happen?" value={discoveryForm.decisionMakers} set={(value)=>setDiscoveryForm({...discoveryForm,decisionMakers:value})} options={discoveryDecisionOptions}/>
            </DiscoverySection>

            <DiscoverySection number="2" title="Property and feasibility" description="Record known site conditions before Design invests time in a concept.">
              <DiscoverySelect required label="Describe equipment and construction access" value={discoveryForm.propertyAccess} set={(value)=>setDiscoveryForm({...discoveryForm,propertyAccess:value})} options={discoveryAccessOptions}/>
              <DiscoveryChoices required label="Known grade, drainage, soil, retaining, or existing-condition concerns" value={discoveryForm.siteConditions} set={(value)=>setDiscoveryForm({...discoveryForm,siteConditions:value})} options={discoverySiteConditionOptions}/>
              <DiscoveryChoices required label="Utilities, septic, well, easements, or overhead-line constraints" value={discoveryForm.utilities} set={(value)=>setDiscoveryForm({...discoveryForm,utilities:value})} options={discoveryUtilityOptions}/>
              <DiscoverySelect label="HOA or neighborhood requirements" value={discoveryForm.hoaRequirements} set={(value)=>setDiscoveryForm({...discoveryForm,hoaRequirements:value})} options={discoveryHoaOptions}/>
              <DiscoverySelect required label="Property survey status" value={discoveryForm.surveyStatus} set={(value)=>setDiscoveryForm({...discoveryForm,surveyStatus:value})} options={['Current survey available','Survey exists but needs verification','Survey must be ordered','Not applicable']}/>
            </DiscoverySection>

            <DiscoverySection number="3" title="Pool concept and must-haves" description="Capture the starting design brief without promising final dimensions or selections.">
              <DiscoverySelect label="Approximate pool size or usable space" value={discoveryForm.poolSize} set={(value)=>setDiscoveryForm({...discoveryForm,poolSize:value})} options={discoveryPoolSizeOptions}/>
              <DiscoveryChoices label="Preferred depths or activities" value={discoveryForm.depthProfile} set={(value)=>setDiscoveryForm({...discoveryForm,depthProfile:value})} options={discoveryDepthOptions}/>
              <DiscoveryChoices label="Style, shape, and visual preferences" value={discoveryForm.stylePreferences} set={(value)=>setDiscoveryForm({...discoveryForm,stylePreferences:value})} options={discoveryStyleOptions}/>
              <DiscoveryChoices required label="Must-have features" value={discoveryForm.mustHaveFeatures} set={(value)=>setDiscoveryForm({...discoveryForm,mustHaveFeatures:value})} options={discoveryFeatureOptions}/>
              <DiscoveryChoices label="Decking, shade, kitchen, landscaping, or other outdoor scope" value={discoveryForm.deckingOutdoorScope} set={(value)=>setDiscoveryForm({...discoveryForm,deckingOutdoorScope:value})} options={discoveryOutdoorOptions}/>
              <DiscoveryChoices label="Equipment, sanitation, automation, or maintenance preferences" value={discoveryForm.equipmentPreferences} set={(value)=>setDiscoveryForm({...discoveryForm,equipmentPreferences:value})} options={discoveryEquipmentOptions}/>
              <DiscoverySelect label="Heating or cooling preference" value={discoveryForm.heatingPreference} set={(value)=>setDiscoveryForm({...discoveryForm,heatingPreference:value})} options={discoveryHeatingOptions}/>
            </DiscoverySection>

            <DiscoverySection number="4" title="Budget, schedule, and priorities" description="Align expectations early and record what should win if tradeoffs are needed.">
              <DiscoverySelect required label="Working investment range" value={discoveryForm.budgetRange} set={(value)=>setDiscoveryForm({...discoveryForm,budgetRange:value})} options={['Under $50,000','$50,000-$75,000','$75,000-$100,000','$100,000-$150,000','$150,000+','Not discussed yet']}/>
              <DiscoverySelect required label="Target completion or event date" value={discoveryForm.targetCompletion} set={(value)=>setDiscoveryForm({...discoveryForm,targetCompletion:value})} options={['As soon as possible','Within 3 months','3-6 months','6-12 months','12+ months','Flexible','Not decided yet']}/>
              <DiscoveryChoices label="Rank the priorities: budget, schedule, features, and finish level" value={discoveryForm.priorityTradeoffs} set={(value)=>setDiscoveryForm({...discoveryForm,priorityTradeoffs:value})} options={discoveryPriorityOptions}/>
              <DiscoveryChoices label="Known concerns, objections, or deal breakers" value={discoveryForm.knownConcerns} set={(value)=>setDiscoveryForm({...discoveryForm,knownConcerns:value})} options={discoveryConcernOptions}/>
              <ShortAnswer label="Representative quick note (optional)" value={discoveryForm.representativeNotes} set={(value)=>setDiscoveryForm({...discoveryForm,representativeNotes:value})} className="md:col-span-2"/>
            </DiscoverySection>
            </div>}

            {discoverySubTab==='COMMUNITY'&&<div role="tabpanel"><DiscoverySection number="5" title="Community and compliance context" description="Identify the governing community and compliance sources before Design develops a concept. Unknown items remain visible as follow-up work.">
              <ShortAnswer label="Municipality / jurisdiction" value={discoveryForm.municipality} set={(value)=>setDiscoveryForm({...discoveryForm,municipality:value})}/>
              <ShortAnswer label="Community or development" value={discoveryForm.communityDevelopment} set={(value)=>setDiscoveryForm({...discoveryForm,communityDevelopment:value})}/>
              <ShortAnswer label="Sub-community or neighborhood" value={discoveryForm.communitySubcommunity} set={(value)=>setDiscoveryForm({...discoveryForm,communitySubcommunity:value})}/>
              <ShortAnswer label="HOA / ARC contact or department link" value={discoveryForm.hoaArcContact} set={(value)=>setDiscoveryForm({...discoveryForm,hoaArcContact:value})}/>
              <DiscoveryChoices label="Compliance categories to verify" value={discoveryForm.complianceCategories} set={(value)=>setDiscoveryForm({...discoveryForm,complianceCategories:value})} options={discoveryComplianceCategoryOptions} className="md:col-span-2"/>
              <ShortAnswer label="Known compliance links or documents" value={discoveryForm.complianceLinks} set={(value)=>setDiscoveryForm({...discoveryForm,complianceLinks:value})} className="md:col-span-2"/>
              <Select label="Compliance follow-up state" value={discoveryForm.complianceFollowUpStatus} set={(value)=>setDiscoveryForm({...discoveryForm,complianceFollowUpStatus:value as PoolDiscovery['complianceFollowUpStatus']})} options={complianceFollowUpStatusOptions}/>
              {discoveryForm.complianceFollowUpStatus==='TBD'&&<><Select label="Follow-up owner" value={discoveryForm.complianceFollowUpOwner} set={(value)=>setDiscoveryForm({...discoveryForm,complianceFollowUpOwner:value})} options={users.map((user)=>({value:user.id,label:user.name}))}/><label className="block text-sm font-medium text-gray-800"><span className="form-field-caption">Follow-up due date</span><input type="datetime-local" value={discoveryForm.complianceFollowUpDueAt} onChange={(event)=>setDiscoveryForm({...discoveryForm,complianceFollowUpDueAt:event.target.value})} className="mt-1 w-full"/></label><ShortAnswer label="Follow-up action" value={discoveryForm.complianceFollowUpAction} set={(value)=>setDiscoveryForm({...discoveryForm,complianceFollowUpAction:value})}/></>}
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 md:col-span-2">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div><p className="text-sm font-semibold text-amber-950">Automated community compliance research</p><p className="mt-1 text-xs text-amber-900">The app searches city, county, state, and identified HOA sources from the property details, fetches relevant pages, and attaches findings here automatically. A representative only reviews whether the sources apply.</p></div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" disabled={saving||['QUEUED','RUNNING'].includes(complianceResearch?.job?.status||'')} onClick={startComplianceResearch} className="rounded-lg bg-amber-800 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{['QUEUED','RUNNING'].includes(complianceResearch?.job?.status||'')?'Research running…':'Search public sources'}</button>
                    <button type="button" disabled={saving||!(discoveryForm.complianceCategories.trim()||complianceResearch?.verification.categories)} onClick={verifyComplianceCategories} className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-50">Mark verified after review</button>
                  </div>
                </div>
                <p className="mt-2 text-xs text-amber-900">Verification: {discoveryForm.complianceVerificationStatus||'Not verified'}{discoveryForm.complianceVerificationCheckedAt?` · ${new Date(discoveryForm.complianceVerificationCheckedAt).toLocaleString()}`:''}</p>
                {(complianceResearch?.savedLinks?.length ?? 0) > 0 && <section className="mt-3 rounded-lg border border-blue-200 bg-white p-3" aria-label="Links saved to this inquiry"><h4 className="text-sm font-semibold text-gray-900">Saved to this inquiry ({complianceResearch!.savedLinks.length})</h4><div className="mt-2 space-y-2">{complianceResearch!.savedLinks.map((link) => <article key={link.id} className="rounded-md border border-gray-200 p-3"><div className="flex flex-wrap items-start justify-between gap-2"><a href={link.url} target="_blank" rel="noreferrer" className="break-words text-sm font-semibold text-blue-700 underline">{link.title || link.domain}</a><span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-800">{link.authorityName}</span></div>{link.summary && <p className="mt-2 text-sm leading-5 text-gray-700">{link.summary}</p>}<p className="mt-1 text-xs text-gray-500">Added {new Date(link.addedAt).toLocaleDateString()}</p></article>)}</div></section>}
                {complianceResearch?.job&&<div className="mt-3 space-y-3 rounded-lg border border-amber-200 bg-white p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold text-gray-900">Research job: {complianceResearch.job.status.replace(/_/g,' ')}</p><p className="text-xs text-gray-500">{complianceResearch.job.sourceCount} source{complianceResearch.job.sourceCount===1?'':'s'} · {complianceResearch.job.progress}%</p></div>
                  {complianceResearch.job.errorMessage&&<p className="text-sm text-red-700">{complianceResearch.job.errorMessage}</p>}
                  {complianceResearch.job.querySummary&&!/Arizona/i.test(complianceResearch.job.querySummary)&&complianceResearch.job.sources.length>0&&<p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">These are from an earlier search and may include sources outside Arizona. Run the search again to get Arizona-only results.</p>}
                  {/Arizona/i.test(complianceResearch.job.querySummary||'')&&complianceResearch.verification.categories&&<p className="text-sm text-gray-800"><span className="font-medium">Topics found:</span> {complianceResearch.verification.categories}</p>}
                  {/Arizona/i.test(complianceResearch.job.querySummary||'')&&complianceResearch.job.sources.length>0&&<div className="space-y-3"><p className="text-sm font-semibold text-gray-900">Arizona public sources · short excerpts for review</p>{[...complianceResearch.job.sources].sort((a,b)=>{const rank=(type:string)=>type==='CITY'?0:type==='COUNTY'?1:type==='STATE'?2:3;return rank(a.authorityType)-rank(b.authorityType);}).slice(0,5).map((source)=>{const alreadySaved=complianceResearch.savedLinks.some((link)=>link.url===source.url);return <article key={source.id} className="rounded-md border border-gray-200 bg-white p-3"><div className="flex flex-wrap items-start justify-between gap-2"><a href={source.url} target="_blank" rel="noreferrer" className="break-words text-sm font-semibold text-blue-700 underline">{source.title||source.domain}</a><span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-800">{source.authorityName}</span></div><p className="mt-2 text-sm leading-5 text-gray-700">{summarizeComplianceExcerpt(source.excerpt)}</p><button type="button" disabled={saving||alreadySaved} onClick={()=>saveComplianceLink(source)} className="mt-3 rounded-md border border-blue-200 px-3 py-1.5 text-xs font-semibold text-blue-800 hover:bg-blue-50 disabled:opacity-50">{alreadySaved?'Saved to inquiry':'Add to inquiry'}</button></article>})}{complianceResearch.job.sources.length>5&&<details className="rounded-md border border-gray-200"><summary className="cursor-pointer px-3 py-2 text-sm font-medium text-blue-700">Show {complianceResearch.job.sources.length-5} more source links</summary><div className="space-y-2 border-t border-gray-200 p-3">{complianceResearch.job.sources.slice(5).map((source)=>{const alreadySaved=complianceResearch.savedLinks.some((link)=>link.url===source.url);return <div key={source.id} className="flex flex-wrap items-center justify-between gap-2 text-sm"><div><a href={source.url} target="_blank" rel="noreferrer" className="break-words text-blue-700 underline">{source.title||source.domain}</a><span className="ml-2 text-xs text-gray-500">{source.authorityName}</span></div><button type="button" disabled={saving||alreadySaved} onClick={()=>saveComplianceLink(source)} className="rounded-md border border-blue-200 px-2 py-1 text-xs font-semibold text-blue-800 hover:bg-blue-50 disabled:opacity-50">{alreadySaved?'Saved':'Add to inquiry'}</button></div>})}</div></details>}</div>}
                  {complianceResearch.job.status==='NEEDS_REVIEW'&&complianceResearch.job.sources.length===0&&<p className="text-sm text-amber-800">No verifiable Arizona government or community pages were found. You can retry the search or confirm the local source links manually.</p>}
                  {complianceResearch.job.querySummary&&<details><summary className="cursor-pointer text-xs font-medium text-gray-600">Search details</summary><p className="mt-2 text-xs text-gray-600">Automated preliminary research only. Confirm the source and its requirements with the relevant Arizona authority or community before relying on it.</p><pre className="mt-2 whitespace-pre-wrap text-xs text-gray-600">{complianceResearch.job.querySummary}</pre></details>}
                </div>}
              </div>
             </DiscoverySection></div>}

              {discoverySubTab==='CALL_TRACKER'&&<section role="tabpanel" className="rounded-xl border border-blue-200 bg-blue-50 p-4" aria-label="Pre-design discovery call tracker"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold text-blue-950">Pre-design discovery call tracker</h3><p className="mt-1 text-sm text-blue-800">Use this tracker for phone calls with the potential client before any site meeting is scheduled. Site meetings are managed in the Site Meetings phase after discovery.</p></div>{scheduledDiscoveryCall?<span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-blue-800">Call scheduled</span>:<span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-blue-800">Phone calls only</span>}</div>{scheduledDiscoveryCall&&<p className="mt-3 text-sm text-blue-950">{scheduledDiscoveryCall.subject||scheduledDiscoveryCall.title} · {new Date(scheduledDiscoveryCall.date).toLocaleString()}</p>}<div className="mt-4 grid items-start gap-x-5 gap-y-5 sm:grid-cols-2"><label className="block text-sm font-medium text-gray-800"><span className="form-field-caption">Call date and time</span><input type="datetime-local" required value={discoveryCallDate} onChange={(event)=>setDiscoveryCallDate(event.target.value)} className="mt-1 w-full"/></label><label className="block text-sm font-medium text-gray-800"><span className="form-field-caption">End date and time</span><input type="datetime-local" value={discoveryCallEndAt} onChange={(event)=>setDiscoveryCallEndAt(event.target.value)} className="mt-1 w-full"/></label><label className="block text-sm font-medium text-gray-800"><span className="form-field-caption">Call subject</span><input value={discoveryCallSubject} onChange={(event)=>setDiscoveryCallSubject(event.target.value)} placeholder="Example: Initial discovery conversation" className="mt-1 w-full"/></label><label className="block text-sm font-medium text-gray-800"><span className="form-field-caption">Participants</span><input value={discoveryCallParticipants} onChange={(event)=>setDiscoveryCallParticipants(event.target.value)} placeholder="Names or email addresses" className="mt-1 w-full"/></label><Field label="Next call action" value={discoveryCallNextAction} set={setDiscoveryCallNextAction}/><label className="block text-sm font-medium text-gray-800"><span className="form-field-caption">Follow-up due</span><input type="datetime-local" value={discoveryCallNextActionDueAt} onChange={(event)=>setDiscoveryCallNextActionDueAt(event.target.value)} className="mt-1 w-full"/></label></div><div className="mt-4 flex flex-wrap items-end justify-end gap-2"><button type="button" disabled={saving||!discoveryCallDate||Boolean(scheduledDiscoveryCall)} onClick={scheduleDiscoveryCall} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Schedule phone call</button>{scheduledDiscoveryCall&&<><label className="block min-w-0 flex-1 text-sm font-medium text-red-900 sm:mr-auto"><span className="form-field-caption">Cancellation reason</span><input value={activityCancellationReason} onChange={(event)=>setActivityCancellationReason(event.target.value)} placeholder="Required only when cancelling" className="mt-1 w-full"/></label><button type="button" disabled={saving||!activityCancellationReason.trim()} onClick={cancelDiscoveryCall} className="rounded-lg border border-red-300 bg-white px-3 py-2 text-sm font-semibold text-red-800 disabled:opacity-50">Cancel call</button></>}</div>{scheduledDiscoveryCall&&<><label className="mt-4 block text-sm font-semibold text-gray-900"><span className="form-field-caption">Call outcome</span><textarea rows={3} value={discoveryCallOutcome} onChange={(event)=>setDiscoveryCallOutcome(event.target.value)} placeholder="Record what the potential client shared, decided, or needs next." className="mt-1 w-full font-normal"/></label><div className="mt-3 flex justify-end"><button type="button" disabled={saving||!canRecordDiscoveryCall} onClick={recordDiscoveryCall} className="rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Record call outcome</button></div></>}<div className="mt-5 border-t border-blue-200 pt-4">{discoveryCalls.length?<><h4 className="font-semibold text-blue-950">Discovery call history</h4><div className="mt-3 space-y-2">{discoveryCalls.map((call)=><div key={call.id} className="rounded-lg border border-blue-100 bg-white p-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold text-gray-950">{call.subject||call.title}</p><span className="text-xs font-semibold text-gray-500">{call.status}</span></div><p className="mt-1 text-sm text-gray-700">{call.outcome||call.cancellationReason||'No outcome recorded'}</p><p className="mt-1 text-xs text-gray-500">{new Date(call.date).toLocaleString()}</p></div>)}</div></>:<p className="text-sm text-blue-800">No discovery calls have been recorded yet.</p>}</div></section>}

             {(discoverySubTab==='QUESTIONS'||discoverySubTab==='COMMUNITY')&&<div className="sticky bottom-0 -mx-5 flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 bg-white px-5 py-4"><p className="text-sm text-gray-600">Fields marked * are required before qualification.</p><button disabled={saving} className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">{saving?'Saving…':'Save discovery'}</button></div>}

            {discoverySubTab==='QUESTIONS'&&<details className="rounded-xl border border-gray-200 bg-gray-50"><summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-gray-800">Client follow-up requests {openRequests.length?`(${openRequests.length} open)`: '(use only when necessary)'}</summary><div className="space-y-4 border-t border-gray-200 p-4">{selected.workItems?.length?<div className="space-y-3">{selected.workItems.map((item)=><div key={item.id} className={`rounded-lg border p-4 ${terminalWorkStatuses.includes(item.status)?'border-gray-200 bg-white':'border-amber-200 bg-amber-50'}`}><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold text-gray-950">{item.title}</p>{item.description&&<p className="mt-1 text-sm text-gray-600">{item.description}</p>}<p className="mt-2 text-xs text-gray-500">{item.dueAt?`Due ${new Date(item.dueAt).toLocaleDateString()}`:'No due date'}</p></div><span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-gray-700">{item.status.replace(/_/g,' ')}</span></div></div>)}</div>:<p className="text-sm text-gray-500">No client follow-up requests have been created.</p>}<label className="text-sm font-semibold text-gray-900">Request an item that the representative cannot answer<input aria-label="Missing information request" value={informationRequest} onChange={(event)=>setInformationRequest(event.target.value)} placeholder="Example: Upload the current property survey" className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-normal"/></label><div className="flex justify-end"><button type="button" disabled={saving||!informationRequest.trim()} onClick={()=>informationRequest&&mutate(async()=>{await inquiryApi.requestInformation(selected.id,{title:informationRequest,dueAt:new Date(Date.now()+3*86400000).toISOString()},selected.intakeRevision);setInformationRequest('');})} className="rounded-lg bg-amber-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Send focused request</button></div></div></details>}
          </form>}

           {activeTab==='SCHEDULE'&&<div className="rounded-xl border border-blue-200 bg-blue-50 p-4"><p className="font-semibold text-blue-950">Site meetings happen after discovery</p><p className="mt-1 text-sm text-blue-800">This phase is only for in-person site meetings after the potential client has completed the pre-design conversation. Phone calls are scheduled and recorded in Pre-design discovery.</p></div>}
          {activeTab==='SCHEDULE'&&<div className="grid gap-4 rounded-xl border border-gray-200 bg-white p-4 sm:grid-cols-2"><label className="text-sm font-medium text-gray-800">Subject or request<input value={activitySubject} onChange={(event)=>setActivitySubject(event.target.value)} placeholder="Example: Confirm HOA pool barrier requirements" className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2"/></label><label className="text-sm font-medium text-gray-800">Participants<input value={activityParticipants} onChange={(event)=>setActivityParticipants(event.target.value)} placeholder="Names or email addresses, separated by commas" className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2"/></label><label className="text-sm font-medium text-gray-800">End date and time<input type="datetime-local" value={activityEndAt} onChange={(event)=>setActivityEndAt(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2"/></label><Field label="Activity next action" value={activityNextAction} set={setActivityNextAction}/><label className="text-sm font-medium text-gray-800">Follow-up due<input type="datetime-local" value={activityNextActionDueAt} onChange={(event)=>setActivityNextActionDueAt(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2"/></label>{scheduledSiteMeeting&&<div className="sm:col-span-2 rounded-lg border border-red-200 bg-red-50 p-3"><label className="text-sm font-medium text-red-900">Cancellation reason<input value={activityCancellationReason} onChange={(event)=>setActivityCancellationReason(event.target.value)} placeholder="Required only when cancelling this activity" className="mt-1 w-full rounded-lg border border-red-200 bg-white px-3 py-2"/></label><div className="mt-2 flex justify-end"><button type="button" disabled={saving||!activityCancellationReason.trim()} onClick={cancelScheduledActivity} className="rounded-lg border border-red-300 px-3 py-2 text-sm font-semibold text-red-800 disabled:opacity-50">Cancel scheduled activity</button></div></div>}</div>}

{activeTab==='SCHEDULE'&&<div className="space-y-5"><div><h3 className="font-semibold">Site Meetings</h3><p className="mt-1 text-sm text-gray-600">Track each in-person site meeting separately and record the evidence needed before ROM handoff. Pre-design phone calls stay in the discovery phase.</p></div><div className="rounded-xl border border-gray-200 bg-gray-50 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h4 className="font-semibold text-gray-950">Site meeting tracker</h4><p className="mt-1 text-sm text-gray-600">Schedule the next site meeting only after the potential client has completed the pre-design conversation. Multiple site meetings may be recorded before handoff.</p></div>{completedSiteMeeting?<span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">Site meeting completed</span>:scheduledSiteMeeting?<span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800">Site meeting scheduled</span>:<span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">Needs scheduling</span>}</div>{scheduledSiteMeeting&&!completedSiteMeeting&&<p className="mt-3 text-sm text-gray-700">{scheduledSiteMeeting.title} scheduled for {new Date(scheduledSiteMeeting.date).toLocaleString()}</p>}{!scheduledSiteMeeting&&<div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end"><label className="flex-1 text-sm font-semibold text-gray-800">Site meeting date and time<input type="datetime-local" required value={siteMeetingDate} onChange={(event)=>setSiteMeetingDate(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-normal"/></label><button type="button" disabled={saving||!siteMeetingDate} onClick={scheduleSiteMeeting} className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Schedule site meeting</button></div>}{scheduledSiteMeeting&&!completedSiteMeeting&&<div className="mt-4 border-t border-gray-200 pt-4"><div><h4 className="font-semibold text-gray-900">{currentActivityType==='SITE_MEETING'?'Site meeting outcome':'Activity outcome'}</h4><p className="mt-1 text-sm text-gray-600">{currentActivityType==='SITE_MEETING'?'Capture the decision, readiness, site conditions, and next step separately so Design has a clear record.':'Record the result, follow-up, and any decision from this activity.'}</p></div>{currentActivityType==='SITE_MEETING'&&<div className="mt-4 grid gap-4 sm:grid-cols-2"><Select label="Client decision" value={outcomeDecision} set={setOutcomeDecision} options={siteMeetingDecisionOptions.map((option)=>({value:option,label:option}))}/><Select label="Site readiness" value={outcomeReadiness} set={setOutcomeReadiness} options={siteMeetingReadinessOptions.map((option)=>({value:option,label:option}))}/><Select label="Observed site conditions" value={outcomeCondition} set={setOutcomeCondition} options={siteMeetingConditionOptions.map((option)=>({value:option,label:option}))}/><Select label="Next step" value={outcomeNextStep} set={setOutcomeNextStep} options={siteMeetingNextStepOptions.map((option)=>({value:option,label:option}))}/></div>}<label className="mt-4 block text-sm font-semibold text-gray-900">{currentActivityType==='SITE_MEETING'?'Additional notes':'Outcome and follow-up notes'}<textarea rows={3} value={outcome} onChange={(event)=>setOutcome(event.target.value)} placeholder={currentActivityType==='SITE_MEETING'?'Add context, client concerns, or other details from the meeting.':'Record the result, response, and next action from this activity.'} className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-normal"/></label>{currentActivityType==='SITE_MEETING'&&<div className="mt-4 rounded-lg border border-dashed border-gray-300 bg-white p-3"><label className="text-sm font-semibold text-gray-900">Specific findings or follow-up items<input aria-label="Specific findings or follow-up items" value={outcomeSpecific} onChange={(event)=>setOutcomeSpecific(event.target.value)} onKeyDown={(event)=>{if(event.key==='Enter'){event.preventDefault();addOutcomeSpecific();}}} placeholder="Example: Confirm equipment access with homeowner" className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-normal"/></label><div className="mt-2 flex justify-end"><button type="button" disabled={!outcomeSpecific.trim()} onClick={addOutcomeSpecific} className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-800 disabled:opacity-50"><Plus className="h-4 w-4"/>Add specific</button></div>{outcomeSpecifics.length>0&&<ul className="mt-3 space-y-2">{outcomeSpecifics.map((specific,index)=><li key={specific+index} className="flex items-center justify-between gap-3 rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-700"><span>{specific}</span><button type="button" onClick={()=>setOutcomeSpecifics((current)=>current.filter((_,specificIndex)=>specificIndex!==index))} className="shrink-0 text-xs font-semibold text-red-700 hover:underline">Remove</button></li>)}</ul>}</div>}<div className="mt-4 flex justify-end"><button type="button" disabled={saving||!canRecordActivity} onClick={recordSiteMeetingOutcome} className="rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Record site meeting outcome</button></div></div>}</div><div className="rounded-xl border border-gray-200 bg-white p-4"><label className="text-sm font-semibold text-gray-900">Site measurements, access, and feasibility notes<textarea rows={5} value={siteAssessment} onChange={(event)=>setSiteAssessment(event.target.value)} placeholder="Record measurements, equipment access, drainage, utilities, soil, HOA, and feasibility findings." className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-normal"/></label><div className="mt-3 flex justify-end"><button type="button" disabled={saving} onClick={saveSiteAssessment} className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-800">Save site assessment</button></div></div>{siteMeetingHistory.length?<div className="space-y-3"><h4 className="font-semibold text-gray-950">Activity history</h4>{siteMeetingHistory.map((consultation)=><div key={consultation.id} className="rounded-lg bg-gray-50 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold">{consultation.subject||consultation.title}</p><span className="text-xs font-semibold text-gray-500">{consultation.activityType||'SITE_MEETING'} · {consultation.status}</span></div><p className="mt-1 text-sm text-gray-700">{consultation.outcome||consultation.notes||consultation.cancellationReason||'No outcome recorded'}</p>{consultation.nextAction&&<p className="mt-2 text-xs text-gray-600">Next action: {consultation.nextAction}{consultation.nextActionDueAt&&<> · due {new Date(consultation.nextActionDueAt).toLocaleDateString()}</>}</p>}<p className="mt-2 text-xs text-gray-500">{new Date(consultation.date).toLocaleString()}{consultation.endAt?<> – {new Date(consultation.endAt).toLocaleTimeString([], {hour: 'numeric', minute: '2-digit'})}</>:null} · {consultation.status}</p></div>)}</div>:<p className="text-sm text-gray-500">No site meeting records have been added.</p>}</div>}

          {activeTab==='FILES'&&<div className="space-y-5"><div><h3 className="font-semibold">Files & conversation</h3><p className="mt-1 text-sm text-gray-600">Keep supporting documents and a concise internal contact history with this inquiry.</p></div><DocumentUpload clientId={selected.clientId} inquiryId={selected.id} documents={selected.documents||[]} onUploadComplete={()=>mutate(()=>inquiryApi.get(selected.id))}/>{(selected.documents||[]).length>0&&<section className="space-y-2" aria-label="Categorize site evidence"><h4 className="text-sm font-semibold text-gray-900">Site evidence</h4>{selected.documents!.map((document)=>{const evidence=(selected.evidence||[]).find((item)=>item.documentId===document.id);return <div key={document.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-3"><span className="min-w-0 truncate text-sm text-gray-800">{document.originalName}</span>{evidence?<span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-800">{evidence.category.replace(/_/g,' ')}</span>:<select aria-label={`Categorize ${document.originalName} as site evidence`} defaultValue="" disabled={saving} onChange={(event)=>event.target.value&&categorizeDocumentAsEvidence(document.id,event.target.value)} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"><option value="">Mark as site evidence…</option><option value="SITE_PHOTO">Site photo</option><option value="SITE_PLAN">Site plan</option><option value="SURVEY">Survey</option><option value="OTHER_SITE_EVIDENCE">Other site evidence</option></select>}</div>})}</section>}<details className="rounded-xl border border-gray-200 bg-white"><summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-gray-900">Log a contact</summary><form onSubmit={createContactLog} className="grid gap-3 border-t border-gray-200 p-4 sm:grid-cols-2"><Select label="Channel" value={contactChannel} set={(value)=>setContactChannel(value as typeof contactChannel)} options={[{value:'PHONE',label:'Phone'},{value:'SMS',label:'Text message'},{value:'EMAIL',label:'Email'},{value:'WEBSITE',label:'Website'},{value:'IN_PERSON',label:'In person'},{value:'REFERRAL',label:'Referral'},{value:'OTHER',label:'Other'}]}/><Select label="Direction" value={contactDirection} set={(value)=>setContactDirection(value as typeof contactDirection)} options={[{value:'INBOUND',label:'Inbound'},{value:'OUTBOUND',label:'Outbound'}]}/><Field label="Contact person (optional)" value={contactPerson} set={setContactPerson}/><Select label="Outcome" value={contactOutcome} set={setContactOutcome} options={[{value:'CONNECTED',label:'Connected'},{value:'LEFT_MESSAGE',label:'Left message'},{value:'NO_ANSWER',label:'No answer'},{value:'MEETING_SCHEDULED',label:'Meeting scheduled'},{value:'FOLLOW_UP_REQUIRED',label:'Follow-up required'},{value:'OTHER',label:'Other'}]}/><Area label="Brief internal summary" value={contactSummary} set={setContactSummary} className="sm:col-span-2"/><div className="rounded-lg border border-gray-200 bg-gray-50 p-3 sm:col-span-2"><p className="text-sm font-semibold text-gray-800">Follow-up task (optional)</p><p className="mt-1 text-xs text-gray-500">If added, action, owner, and due date are saved with the contact log.</p><div className="mt-3 grid gap-3 sm:grid-cols-3"><Field label="Action" value={contactFollowUpTitle} set={setContactFollowUpTitle}/><Select label="Owner" value={contactFollowUpOwner} set={setContactFollowUpOwner} options={users.map((user)=>({value:user.id,label:user.name}))}/><Field label="Due date" type="datetime-local" value={contactFollowUpDueAt} set={setContactFollowUpDueAt}/></div></div><div className="flex justify-end sm:col-span-2"><button type="submit" disabled={saving||!contactSummary.trim()} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Save contact</button></div></form></details><section className="space-y-3"><h4 className="text-sm font-semibold text-gray-900">Contact history</h4>{selected.activities?.length?<div className="space-y-2">{selected.activities.map((activity)=><article key={activity.id} className="rounded-lg border border-gray-200 bg-white p-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold text-gray-900">{activity.channel.replace(/_/g,' ')} · {activity.direction.toLowerCase()} · {activity.outcomeCode.replace(/_/g,' ').toLowerCase()}</p><span className="text-xs text-gray-500">{new Date(activity.occurredAt).toLocaleString()}</span></div><p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">{activity.summary}</p><p className="mt-1 text-xs text-gray-500">{activity.actor?.name||activity.origin.replace(/_/g,' ')}{activity.contactPerson?` · with ${activity.contactPerson}`:''}</p>{activity.followUpWorkItem&&<p className="mt-2 rounded-md bg-amber-50 px-2 py-1.5 text-xs text-amber-900">Follow-up: {activity.followUpWorkItem.title}{activity.followUpWorkItem.dueAt?` · due ${new Date(activity.followUpWorkItem.dueAt).toLocaleDateString()}`:''}</p>}{activity.correctionOfActivityId&&<p className="mt-2 text-xs font-medium text-violet-700">Correction appended to an earlier entry</p>}</article>)}</div>:<p className="rounded-lg border border-dashed border-gray-300 p-4 text-sm text-gray-500">No contact activity has been logged yet.</p>}</section><Metric label="Inquiry files" value={selected.documents?.length||0}/></div>}


          {activeTab==='FILES'&&<details className="rounded-xl border border-violet-200 bg-violet-50"><summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-violet-950">Record a client decision from a call, email, or meeting</summary><form onSubmit={recordExternalDisposition} className="grid gap-3 border-t border-violet-200 p-4 sm:grid-cols-2"><p className="text-sm text-violet-900 sm:col-span-2">This saves an attributed response as pending. It does not approve or convert the inquiry until an Admin reviews it.</p><Select label="Response source" value={externalDispositionChannel} set={(value)=>setExternalDispositionChannel(value as typeof externalDispositionChannel)} options={[{value:'PHONE',label:'Phone'},{value:'SMS',label:'Text message'},{value:'EMAIL',label:'Email'},{value:'IN_PERSON',label:'In person'},{value:'OTHER',label:'Other'}]}/><Select label="Client decision" value={externalDisposition} set={(value)=>setExternalDisposition(value as typeof externalDisposition)} options={[{value:'PROCEED_TO_DESIGN',label:'Proceed to Design'},{value:'MORE_INFORMATION',label:'Needs more information'},{value:'PAUSE',label:'Pause for now'},{value:'DECLINE',label:'Decline'}]}/><Area label="Brief record of the client's explicit instruction" value={externalDispositionSummary} set={setExternalDispositionSummary} className="sm:col-span-2"/><div className="flex justify-end sm:col-span-2"><button type="submit" disabled={saving||!externalDispositionSummary.trim()} className="rounded-lg bg-violet-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Save pending decision</button></div></form></details>}

          {activeTab==='HANDOFF'&&<div className="space-y-5">
            <div><h3 className="font-semibold">ROM & Design handoff readiness</h3><p className="mt-1 text-sm text-gray-600">Record the commercial decision and agreement before creating the Design project.</p></div>
            <section className="rounded-xl border border-blue-200 bg-blue-50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3"><div><h4 className="font-semibold text-blue-950">Revision-bound proposal review</h4><p className="mt-1 text-sm text-blue-900">The ROM is preliminary and non-binding. Any intake or proposal edit makes a previous review stale.</p></div><span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-blue-800">{selected.romPreviewRevision===selected.intakeRevision&&selected.romPreviewHash?'Preview saved for this revision':'Preview needs to be saved'}</span></div>
              {selected.handoffReview&&<div className={`mt-3 rounded-lg border p-3 text-sm ${handoffReviewCurrent?'border-emerald-200 bg-emerald-50 text-emerald-900':'border-amber-200 bg-amber-50 text-amber-900'}`}><p className="font-semibold">Latest review: {selected.handoffReview.result.replace(/_/g,' ')} · revision {selected.handoffReview.intakeRevision}</p>{selected.handoffReview.reason&&<p className="mt-1">{selected.handoffReview.reason}</p>}</div>}
              <div className="mt-3 flex justify-end"><button type="button" disabled={saving||selected.romPreviewRevision!==selected.intakeRevision||!selected.romPreviewHash} onClick={runHandoffReview} className="rounded-lg border border-blue-300 bg-white px-4 py-2 text-sm font-semibold text-blue-900 disabled:opacity-50">Review current handoff</button></div>
            </section>
            <ClientDispositionReviewPanel key={`${selected.id}:${selected.intakeRevision}:${selected.clientDispositionEvidenceActivityId||'none'}`} activities={selected.activities||[]} evidenceActivityId={selected.clientDispositionEvidenceActivityId||null} reviewStatus={selected.clientDispositionReviewStatus||null} users={users} busy={saving} onSubmit={reviewClientDisposition}/>
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <h4 className="font-semibold text-gray-950">ROM approval and Design Agreement</h4>
              <p className="mt-1 text-sm text-gray-600">A meeting or client response alone does not approve the handoff.</p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field label="ROM amount or range" value={handoffForm.romAmount} set={(value)=>setHandoffForm({...handoffForm,romAmount:value})}/>
                <Select label="ROM status" value={handoffForm.romStatus} set={(value)=>setHandoffForm({...handoffForm,romStatus:value})} options={[{value:'DRAFT',label:'Draft'},{value:'PRESENTED',label:'Presented'},{value:'APPROVED',label:'Approved'},{value:'REJECTED',label:'Rejected'},{value:'NEEDS_REVISION',label:'Needs revision'}]}/>
                <label className="text-sm font-medium text-gray-800">Date presented to client<input type="datetime-local" value={handoffForm.proposalProvidedAt} onChange={(event)=>setHandoffForm({...handoffForm,proposalProvidedAt:event.target.value})} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2"/></label>
                <label className="text-sm font-medium text-gray-800">ROM decision date<input type="datetime-local" value={handoffForm.romDecisionAt} onChange={(event)=>setHandoffForm({...handoffForm,romDecisionAt:event.target.value})} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2"/></label>
                <Select label="Design Agreement status" value={handoffForm.designAgreementStatus} set={(value)=>setHandoffForm({...handoffForm,designAgreementStatus:value})} options={[{value:'NOT_REQUIRED',label:'Not required'},{value:'PENDING',label:'Pending'},{value:'ACCEPTED',label:'Accepted'},{value:'DECLINED',label:'Declined'}]}/>
                {handoffForm.designAgreementStatus==='NOT_REQUIRED'&&<Area label="Admin reason this agreement is not required" value={handoffForm.designAgreementNotRequiredReason} set={(value)=>setHandoffForm({...handoffForm,designAgreementNotRequiredReason:value})}/>}
                <label className="text-sm font-medium text-gray-800">Agreement acceptance date<input type="datetime-local" value={handoffForm.designAgreementAcceptedAt} onChange={(event)=>setHandoffForm({...handoffForm,designAgreementAcceptedAt:event.target.value})} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2"/></label>
                <Area label="Design handoff summary" value={handoffForm.handoffSummary} set={(value)=>setHandoffForm({...handoffForm,handoffSummary:value})} className="sm:col-span-2"/>
                <Area label="ROM decision notes" value={handoffForm.proposalClientResponse} set={(value)=>setHandoffForm({...handoffForm,proposalClientResponse:value})} className="sm:col-span-2"/>
                <Area label="Optional narrative and design proposal" value={handoffForm.proposalNarrative} set={(value)=>setHandoffForm({...handoffForm,proposalNarrative:value})} className="sm:col-span-2"/>
              </div>
              <p className="mt-3 text-xs text-gray-500">Approver identity is recorded as the authenticated internal user when ROM or the agreement is approved.</p>
              <div className="mt-3 flex justify-end"><button type="button" disabled={saving|| (handoffForm.designAgreementStatus==='NOT_REQUIRED'&&!handoffForm.designAgreementNotRequiredReason.trim())} onClick={saveHandoffDetails} className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-800 disabled:opacity-50">Save ROM details and refresh preview</button></div>
            </div>
            {blockers.length?<div className="rounded-lg border border-amber-200 bg-amber-50 p-4"><p className="font-semibold text-amber-950">{blockers.length} item{blockers.length===1?'':'s'} need attention</p><ul className="mt-3 space-y-2">{blockers.map((blocker)=><li key={blocker} className="flex gap-2 text-sm text-amber-900"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0"/>{blocker}</li>)}</ul></div>:<div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-900"><CheckCircle2 className="mr-2 inline h-5 w-5"/><span className="font-semibold">The current Design handoff requirements are complete.</span></div>}
            <div className="grid gap-3 sm:grid-cols-2"><ReadinessItem label="Client identity" complete={Boolean(selected.client?.name&&(selected.client?.email||selected.client?.phone))}/><ReadinessItem label="Property" complete={Boolean(selected.propertyId)}/><ReadinessItem label="Pre-design discovery" complete={selectedDiscoveryProgress.percent===100}/><ReadinessItem label="Completed onsite meeting" complete={Boolean(selectedPhaseCompletions[2]?.complete)}/><ReadinessItem label="ROM approved" complete={selected.romStatus==='APPROVED'&&Boolean(selected.romDecisionAt&&selected.romApprovedBy)}/><ReadinessItem label="Design Agreement accepted or Admin exception" complete={selected.designAgreementStatus==='ACCEPTED'||(selected.designAgreementStatus==='NOT_REQUIRED'&&selected.readiness?.criteria.find((item)=>item.id==='DESIGN_AGREEMENT')?.complete===true)}/><ReadinessItem label="Handoff summary" complete={hasText(selected.handoffSummary)}/><ReadinessItem label="Categorized site evidence" complete={Boolean(selected.evidence?.length)}/></div>
            {showHandoffConfirm&&<div className="rounded-lg border border-violet-200 bg-violet-50 p-4"><p className="font-semibold text-violet-950">Create the Design project now?</p><p className="mt-1 text-sm text-violet-900">This will convert the Reception lead into an active client, start Design, and close this intake record. The approved ROM snapshot and Reception history remain available.</p><div className="mt-4 flex flex-wrap gap-2"><button disabled={saving||!handoffReviewCurrent} onClick={completeHandoff} className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving?'Creating…':'Confirm handoff'}</button><button type="button" disabled={saving} onClick={()=>setShowHandoffConfirm(false)} className="rounded-lg border border-violet-300 bg-white px-4 py-2 text-sm font-semibold text-violet-900">Cancel</button></div></div>}
            <div className="flex flex-wrap gap-3 border-t border-gray-200 pt-5">{selected.qualificationStatus==='QUALIFIED'&&!showHandoffConfirm&&<button disabled={saving||!handoffReviewCurrent} title={!handoffReviewCurrent?'Save the current ROM and pass a revision-bound handoff review first.':undefined} onClick={()=>setShowHandoffConfirm(true)} className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">Approve handoff & create Design project</button>}{selected.projectId&&<Link to={'/projects/'+selected.projectId} className="rounded-lg border border-violet-300 px-4 py-2 text-sm font-semibold text-violet-700">Open Design project <ArrowRight className="ml-1 inline h-4 w-4"/></Link>}</div>
            <div className="rounded-lg border border-gray-200"><button onClick={()=>setShowMore(!showMore)} className="flex w-full items-center justify-between p-4 text-left text-sm font-semibold"><span>More intake actions</span><ChevronDown className={`h-4 w-4 transition ${showMore?'rotate-180':''}`}/></button>{showMore&&<div className="flex flex-wrap gap-2 border-t border-gray-200 p-4"><Link to={'/clients/'+selected.clientId+'/status-report?inquiryId='+selected.id+(selected.projectId?'&projectId='+selected.projectId:'')} className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium">View status report</Link>{['NEW','IN_REVIEW'].includes(selected.qualificationStatus)&&<><button onClick={()=>changeStatus('NURTURED')} className="rounded-lg bg-gray-100 px-3 py-2 text-sm">Move to nurture</button><button onClick={()=>changeStatus('DECLINED')} className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">Decline inquiry</button></>}</div>}</div>
          </div>}
        </div>
      </FormModal>}
    </div>

    {selected&&<FormModal
      open={showEdit}
      title="Edit project intake"
      description="Update the information that will move forward into Design."
      busy={saving}
      submitLabel="Save intake changes"
      onClose={closeEdit}
      onSubmit={(event)=>{event.preventDefault();if(!editForm.leadEmail.trim()&&!editForm.leadPhone.trim()){setError('Enter an email address or phone number so Reception can follow up.');return;}mutate(async()=>{const {leadName,leadEmail,leadPhone,address,city,state,postalCode,...inquiryData}=editForm;await inquiryApi.updateIntake(selected.id,{expectedIntakeRevision:selected.intakeRevision,client:{name:leadName,email:leadEmail.trim()||null,phone:leadPhone.trim()||null},...(address.trim()?{property:{address:address.trim(),city:city.trim()||null,state:state.trim()||null,postalCode:postalCode.trim()||null}}:{}),inquiry:{...inquiryData,source:inquiryData.source.trim()||null,nextAction:inquiryData.nextAction.trim()||null,nextActionDueAt:inquiryData.nextActionDueAt||null}});editFormBaseline.current=JSON.stringify(editForm);setShowEdit(false);});}}
    >
      {(error||hasIntakeConflict)&&<div role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">{hasIntakeConflict&&<><p className="font-semibold">This inquiry was updated elsewhere.</p><p className="mt-1">Your unsaved draft is still here. Review the latest saved record before trying again.</p><button type="button" onClick={()=>{if(selected)void select(selected);}} className="mt-3 rounded-lg border border-amber-400 bg-white px-3 py-2 font-semibold hover:bg-amber-100">Load latest and discard this draft</button></>}{error&&!hasIntakeConflict&&<p>{error}</p>}</div>}
      <fieldset disabled={saving} className="space-y-6">
      <FormSection title="Lead contact"><Field label="Lead name" value={editForm.leadName} set={(value)=>setEditForm({...editForm,leadName:value})} required/><Field label="Lead email" value={editForm.leadEmail} set={(value)=>setEditForm({...editForm,leadEmail:value})}/><Field label="Lead phone" value={editForm.leadPhone} set={(value)=>setEditForm({...editForm,leadPhone:value})}/></FormSection>
      <FormSection title="Project vision"><Area label="What would the client like to create or change?" value={editForm.description} set={(value)=>setEditForm({...editForm,description:value})}/><Area label="What should the finished project accomplish?" value={editForm.objectives} set={(value)=>setEditForm({...editForm,objectives:value})}/><Area label="Preliminary features or scope" value={editForm.preliminaryScope} set={(value)=>setEditForm({...editForm,preliminaryScope:value})} className="md:col-span-2"/><Area label="Design inspirations or reference links" value={editForm.designInspirations} set={(value)=>setEditForm({...editForm,designInspirations:value})} className="md:col-span-2"/></FormSection>
      <FormSection title="Property"><Field label="Property address" value={editForm.address} set={(value)=>setEditForm({...editForm,address:value})}/><Field label="City" value={editForm.city} set={(value)=>setEditForm({...editForm,city:value})}/><Field label="State" value={editForm.state} set={(value)=>setEditForm({...editForm,state:value})}/><Field label="Postal code" value={editForm.postalCode} set={(value)=>setEditForm({...editForm,postalCode:value})}/></FormSection>
      <FormSection title="Expectations"><Field label="Budget expectation" value={editForm.budgetExpectation} set={(value)=>setEditForm({...editForm,budgetExpectation:value})}/><Field label="Desired timing" value={editForm.desiredTiming} set={(value)=>setEditForm({...editForm,desiredTiming:value})}/><ChannelSelect value={editForm.source} set={(value)=>setEditForm({...editForm,source:value})}/></FormSection>
      <FormSection title="Reception follow-up"><Field label="Next action" value={editForm.nextAction} set={(value)=>setEditForm({...editForm,nextAction:value})}/><label className="text-sm font-medium text-gray-800">Next action due<input type="datetime-local" value={editForm.nextActionDueAt} onChange={(event)=>setEditForm({...editForm,nextActionDueAt:event.target.value})} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2"/></label></FormSection>
      </fieldset>
    </FormModal>}
    {selected&&<FormModal open={showRomEditor} title="Edit ROM proposal" description="Proposal-specific edits are saved with this inquiry and do not overwrite discovery answers." busy={saving} submitLabel="Save ROM draft" busyLabel="Saving…" maxWidthClass="max-w-5xl" onClose={()=>setShowRomEditor(false)} onSubmit={saveRomProposal}>
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950"><p className="font-semibold">Inquiry answers are the starting point</p><p className="mt-1">Fields with recorded answers are prefilled from the inquiry. Change any wording for this proposal; use “Reset to inquiry answer” to remove that override. Fields without an inquiry answer start empty.</p></div>
      <div className="grid gap-5 md:grid-cols-2">{romProposalFieldDefinitions.map(({key,label,description})=><div key={key} className="min-w-0">
        <Area label={label} value={romProposalOverrides[key]??romProposalDefaults[key]} set={(value)=>setRomProposalOverrides((current)=>({...current,[key]:value}))} className="min-h-28"/>
        <p className="mt-1 text-xs text-gray-500">{description} {romProposalDefaults[key].trim()?'Prefilled from inquiry answers.':'No matching inquiry answer; enter proposal-specific content if applicable.'}</p>
        {romProposalOverrides[key]!==null&&<button type="button" onClick={()=>setRomProposalOverrides((current)=>({...current,[key]:null}))} className="mt-1 text-xs font-semibold text-blue-700 hover:underline">Reset to inquiry answer</button>}
      </div>)}</div>
      <div className="flex justify-end border-t border-gray-200 pt-4"><button type="button" onClick={()=>setRomProposalOverrides(emptyRomProposalOverrides())} className="text-sm font-semibold text-gray-700 underline">Reset all fields to inquiry answers</button></div>
    </FormModal>}
    {selected&&<FormModal open={showRomPreview} title="Rough Order of Magnitude proposal" description="A discussion draft assembled from this inquiry. Review the source details and complete any items marked as not entered before sharing." showSubmit={false} cancelLabel="Close preview" maxWidthClass="max-w-5xl" onClose={()=>setShowRomPreview(false)}>
      <article className="mx-auto max-w-4xl space-y-6 rounded-lg border border-gray-200 bg-white p-6 text-gray-800 shadow-sm sm:p-9">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-gray-200 pb-5">
          <div className="flex items-center gap-4"><img src="/CompanyLogo.webp" alt="Signature Exteriors" className="h-14 max-w-40 object-contain"/><div><p className="text-sm font-semibold text-gray-900">Signature Exteriors</p><p className="text-xs text-gray-500">Residential design proposal</p></div></div>
          <div className="text-right"><span className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-amber-900">Preliminary · Not a contract</span><p className="mt-2 text-sm text-gray-600">Prepared {new Date().toLocaleDateString()}</p></div>
        </header>
        <section className="grid gap-4 rounded-lg bg-gray-50 p-4 sm:grid-cols-2">
          <div><p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Prepared for</p><p className="mt-1 font-semibold">{selected.client?.name||'Client name not entered'}</p></div>
          <div><p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Project property</p><p className="mt-1">{[selected.property?.address,selected.property?.city,selected.property?.state,selected.property?.postalCode].filter(Boolean).join(', ')||'Property address not entered'}</p></div>
        </section>
        <section>
          <h3 className="text-lg font-bold uppercase tracking-wide text-gray-950">General outline / scope of work &amp; estimated project cost</h3>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{romProposalValue('projectNarrative')||'Project narrative not entered yet.'}</p>
        </section>
        {romProposalFieldDefinitions.filter(({key})=>key!=='projectNarrative'&&romProposalValue(key).trim()).map(({key,label})=><section key={key}><h4 className="border-b border-gray-200 pb-2 font-bold text-gray-950">{label}</h4><p className="mt-3 whitespace-pre-wrap text-sm leading-6">{romProposalValue(key)}</p></section>)}
        {romScopeSections.map((section)=><section key={section.title}>
          <h4 className="border-b border-gray-200 pb-2 font-bold text-gray-950">{section.title}</h4>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6">{section.items.map((item,index)=><li key={`${section.title}-${index}`} className="break-words">{item}</li>)}</ul>
        </section>)}
        <section className="rounded-lg border border-blue-200 bg-blue-50 p-5">
          <h4 className="font-bold text-gray-950">Planning-level investment</h4>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div><p className="text-xs font-semibold uppercase tracking-wide text-gray-600">ROM estimate entered for this proposal</p><p className="mt-1 text-lg font-semibold">{handoffForm.romAmount?.trim()||'Not entered yet'}</p></div>
            <div><p className="text-xs font-semibold uppercase tracking-wide text-gray-600">Client-stated budget expectation</p><p className="mt-1 text-lg font-semibold">{selected.budgetExpectation?.trim()||discoveryForm.budgetRange?.trim()||'Not entered yet'}</p></div>
          </div>
          <p className="mt-4 text-xs leading-5 text-gray-600">The client budget expectation is recorded separately and is not a project quote. Any ROM amount shown is a preliminary planning figure, not a fixed price.</p>
        </section>
        {handoffForm.handoffSummary?.trim()&&<section><h4 className="font-bold text-gray-950">Design handoff context</h4><p className="mt-2 whitespace-pre-wrap text-sm leading-6">{handoffForm.handoffSummary.trim()}</p></section>}
        <section className="rounded-lg border border-gray-200 p-4 text-xs leading-5 text-gray-600">
          <h4 className="font-semibold text-gray-800">Planning assumptions and next steps</h4>
          <p className="mt-2">This draft reflects only information recorded in the inquiry as of the preparation date. Scope, quantities, dimensions, site conditions, utility capacity, engineering, material selections, permitting, and community or HOA requirements must be verified. Final scope, schedule, and price may change after site review, design development, approvals, and a written agreement. This document is for discussion and budgeting only; it is not an offer, construction contract, permit determination, or guarantee of approval.</p>
        </section>
        <footer className="border-t border-gray-200 pt-4 text-center text-xs text-gray-500">Signature Exteriors · Preliminary planning document · {new Date().toLocaleDateString()}</footer>
      </article>
    </FormModal>}
    {selected&&statusAction&&<FormModal open title={statusAction==='DECLINED'?'Decline inquiry':'Move inquiry to nurture'} description="Record why this Reception lead is leaving the active queue." busy={saving} submitLabel={statusAction==='DECLINED'?'Decline inquiry':'Move to nurture'} onClose={()=>setStatusAction(null)} onSubmit={(event)=>{event.preventDefault();mutate(async()=>{await inquiryApi.setStatus(selected.id,statusAction,selected.intakeRevision,statusReason);setStatusAction(null);});}}><label className="text-sm font-medium text-gray-800">Reason<textarea required rows={4} value={statusReason} onChange={(event)=>setStatusReason(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2"/></label></FormModal>}
  </div>;
}

function ClientDispositionReviewPanel({activities,evidenceActivityId,reviewStatus,users,busy,onSubmit}:{activities:InquiryActivity[];evidenceActivityId:string|null;reviewStatus:string|null;users:User[];busy:boolean;onSubmit:(activityId:string,payload:Record<string,unknown>)=>void}) {
  const pending = reviewStatus === 'PENDING_REVIEW'
    ? activities.find((activity)=>activity.id===evidenceActivityId&&activity.outcomeCode==='CLIENT_DISPOSITION_RECEIVED')
    : undefined;
  const [reason,setReason] = useState('');
  const [nextReviewAt,setNextReviewAt] = useState('');
  const [followUpTitle,setFollowUpTitle] = useState('');
  const [followUpOwnerId,setFollowUpOwnerId] = useState('');
  const [followUpDueAt,setFollowUpDueAt] = useState('');
  const [attested,setAttested] = useState(false);
  if (!pending) return null;
  const disposition = pending.clientDispositionValue as 'PROCEED_TO_DESIGN'|'MORE_INFORMATION'|'PAUSE'|'DECLINE';
  let romSnapshotText='';
  try { romSnapshotText=pending.clientRomSnapshot?JSON.stringify(JSON.parse(pending.clientRomSnapshot),null,2):''; } catch { romSnapshotText='The saved response snapshot could not be displayed.'; }
  const send = (event:FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit(pending.id,{
      disposition, attested:true, reason:reason.trim()||null,
      ...(disposition==='PAUSE'&&nextReviewAt?{nextReviewAt:new Date(nextReviewAt).toISOString()}:{}),
      ...(disposition==='MORE_INFORMATION'?{followUp:{title:followUpTitle.trim(),ownerId:followUpOwnerId,dueAt:new Date(followUpDueAt).toISOString()}}:{}),
    });
  };
  return <section className="rounded-xl border border-violet-200 bg-violet-50 p-4">
    <div><h4 className="font-semibold text-violet-950">Client response awaiting review</h4><p className="mt-1 text-sm text-violet-900">{pending.origin==='CLIENT_PORTAL'?'Submitted in the client portal':'Recorded from an external conversation'} · {pending.channel.replace(/_/g,' ')} · {new Date(pending.occurredAt).toLocaleString()}</p><p className="mt-2 text-sm font-semibold text-gray-950">Requested decision: {disposition.replace(/_/g,' ')}</p><p className="mt-1 whitespace-pre-wrap text-sm text-gray-800">{pending.outcomeDetail||pending.summary}</p></div>
    {romSnapshotText&&<details className="rounded-lg border border-violet-200 bg-white p-3"><summary className="cursor-pointer text-sm font-semibold text-violet-950">ROM version the client reviewed</summary><pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words text-xs text-gray-700">{romSnapshotText}</pre></details>}
    <form onSubmit={send} className="mt-4 grid gap-3 border-t border-violet-200 pt-4 sm:grid-cols-2">
      {disposition==='MORE_INFORMATION'&&<><Field label="Follow-up action" value={followUpTitle} set={setFollowUpTitle} required/><Select label="Follow-up owner" value={followUpOwnerId} set={setFollowUpOwnerId} options={users.filter((user)=>user.active&&user.role==='ADMIN').map((user)=>({value:user.id,label:user.name}))} required/><Field label="Follow-up due" type="datetime-local" value={followUpDueAt} set={setFollowUpDueAt} required/></>}
      {disposition==='PAUSE'&&<label className="text-sm font-medium text-gray-800">Next review date<input type="date" required value={nextReviewAt} onChange={(event)=>setNextReviewAt(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2"/></label>}
      {['PAUSE','DECLINE'].includes(disposition)&&<Area label={disposition==='DECLINE'?'Decline reason':'Reason for pause'} value={reason} set={setReason} className="sm:col-span-2"/>}
      {disposition==='MORE_INFORMATION'&&<Area label="Review notes (optional)" value={reason} set={setReason} className="sm:col-span-2"/>}
      <label className="flex items-start gap-2 text-sm text-violet-950 sm:col-span-2"><input type="checkbox" required checked={attested} onChange={(event)=>setAttested(event.target.checked)} className="mt-1"/><span>I reviewed the linked response and confirm it accurately records the client’s explicit instruction.</span></label>
      <div className="flex justify-end sm:col-span-2"><button type="submit" disabled={busy||!attested||(disposition==='MORE_INFORMATION'&&(!followUpTitle.trim()||!followUpOwnerId||!followUpDueAt))||(disposition==='PAUSE'&&(!reason.trim()||!nextReviewAt))||(disposition==='DECLINE'&&!reason.trim())} className="rounded-lg bg-violet-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy?'Saving…':'Confirm client response'}</button></div>
    </form>
  </section>;
}

function LegacyCriterionReviewPanel({inquiry,criteria,saving,onSave}:{inquiry:Inquiry;criteria:ReceptionCriterionReadiness[];saving:boolean;onSave:(criterionId:string,answerState:'CONFIRMED'|'UNKNOWN'|'NOT_APPLICABLE',reason?:string,answerValue?:string)=>void}) {
  const [reasons,setReasons] = useState<Record<string,string>>({});
  return <details aria-label="Review existing intake answers" className="group mx-5 mt-4 rounded-xl border border-amber-200 bg-amber-50">
    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl p-4 hover:bg-amber-100/60">
      <span><span className="block font-semibold text-amber-950">Answer review</span><span className="mt-1 block text-sm text-amber-900">{criteria.length} item{criteria.length===1?'':'s'} need{criteria.length===1?'s':''} attention before phase readiness.</span></span>
      <ChevronDown className="h-4 w-4 shrink-0 text-amber-800 transition group-open:rotate-180" aria-hidden="true"/>
    </summary>
    <div className="space-y-3 border-t border-amber-200 p-4"><p className="text-sm text-amber-900">Review legacy values before they count toward phase readiness. Confirm only what still reflects the client’s answer; correct inaccurate values in the inquiry fields first.</p>{criteria.map((criterion)=><div key={criterion.id} className="rounded-lg border border-amber-200 bg-white p-3">
      <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="text-sm font-semibold text-gray-950">{criterion.label}</p><p className="mt-1 break-words text-sm text-gray-700">{legacyCriterionPreview(inquiry,criterion.id)}</p><p className="mt-1 text-xs text-gray-500">{criterion.answerState==='NEEDS_REVIEW'?'Needs Admin review':'No answer recorded yet'} · {criterion.fieldPaths.join(', ')}</p></div>
        <div className="flex shrink-0 flex-wrap gap-2">{criterion.answerState==='NEEDS_REVIEW'&&(criterion.hasAnswer||(criterion.id==='DESIGN_AGREEMENT'&&inquiry.designAgreementStatus==='NOT_REQUIRED'))&&<button type="button" disabled={saving||(criterion.id==='DESIGN_AGREEMENT'&&!reasons[criterion.id]?.trim())} onClick={()=>onSave(criterion.id,'CONFIRMED',criterion.id==='DESIGN_AGREEMENT'?reasons[criterion.id]:undefined)} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Confirm saved answer</button>}{criterion.answerState==='UNKNOWN'&&criterion.id==='MUST_HAVE_FEATURES'&&<button type="button" disabled={saving} onClick={()=>onSave(criterion.id,'CONFIRMED',undefined,'NONE_IDENTIFIED')} className="rounded-lg border border-blue-300 px-3 py-2 text-xs font-semibold text-blue-800 disabled:opacity-50">None identified</button>}{criterion.answerState==='UNKNOWN'&&criterion.id==='INSPIRATION_STATUS'&&<button type="button" disabled={saving} onClick={()=>onSave(criterion.id,'CONFIRMED',undefined,'NONE_PROVIDED')} className="rounded-lg border border-blue-300 px-3 py-2 text-xs font-semibold text-blue-800 disabled:opacity-50">None provided</button>}</div>
      </div>
      {criterion.id==='SURVEY_STATUS'&&criterion.notApplicableAllowed&&<div className="mt-3 flex flex-col gap-2 sm:flex-row"><input aria-label="Admin reason for survey not applicable" value={reasons[criterion.id]||''} onChange={(event)=>setReasons((current)=>({...current,[criterion.id]:event.target.value}))} placeholder="Admin reason if a survey is not applicable" className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"/><button type="button" disabled={saving||!reasons[criterion.id]?.trim()} onClick={()=>onSave(criterion.id,'NOT_APPLICABLE',reasons[criterion.id])} className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold disabled:opacity-50">Mark not applicable</button></div>}
      {criterion.id==='DESIGN_AGREEMENT'&&inquiry.designAgreementStatus==='NOT_REQUIRED'&&<input aria-label="Admin reason for design agreement not required" value={reasons[criterion.id]||''} onChange={(event)=>setReasons((current)=>({...current,[criterion.id]:event.target.value}))} placeholder="Why is a Design Agreement not required?" className="mt-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"/>}
      {criterion.answerState==='NEEDS_REVIEW'&&!criterion.hasAnswer&&!(criterion.id==='DESIGN_AGREEMENT'&&inquiry.designAgreementStatus==='NOT_REQUIRED')&&<p className="mt-2 text-xs text-amber-800">This value is missing or unsupported, so it cannot be confirmed as-is. Update the canonical answer in its section, then save.</p>}
    </div>)}</div>
  </details>;
}

function InquiryPhaseProgress({completions,activePhaseIndex,onOpen}:{completions:Array<{requirements:Array<{label:string;complete:boolean}>;complete:boolean}>;activePhaseIndex:number;onOpen:(tab:TabKey)=>void}) {
  const phase = inquiryPhaseDefinitions[activePhaseIndex];
  const completion = completions[activePhaseIndex];
  const done = completion?.requirements.filter((requirement)=>requirement.complete).length ?? 0;
  const total = completion?.requirements.length ?? 0;
  return <section aria-label="Inquiry phase progress" className="mb-4">
    {phase&&completion&&<details className="group rounded-xl border border-gray-200 bg-white">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-4 py-3 hover:bg-gray-50">
        <div className="min-w-0"><p className="text-xs font-medium text-gray-500">Phase {activePhaseIndex+1} of {completions.length}</p><div className="mt-0.5 flex flex-wrap items-center gap-2"><span className="font-semibold text-gray-950">{phase.label}</span><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${completion.complete?'bg-emerald-50 text-emerald-700':'bg-blue-50 text-blue-700'}`}>{completion.complete?'Complete':'In progress'}</span></div><p className="mt-1 text-xs text-gray-500">{done} of {total} requirements complete</p></div>
        <ChevronDown className="h-4 w-4 shrink-0 text-gray-500 transition group-open:rotate-180" aria-hidden="true"/>
      </summary>
      <div className="border-t border-gray-100 px-4 py-3"><p className="text-xs font-semibold uppercase tracking-wide text-gray-500">What remains</p><div className="mt-2 grid gap-2 sm:grid-cols-2">{completion.requirements.filter((requirement)=>!requirement.complete).map((requirement)=><div key={requirement.label} className="flex items-center gap-2 text-sm text-gray-700"><span className="h-2 w-2 shrink-0 rounded-full bg-amber-400" aria-hidden="true"/><span>{requirement.label}</span></div>)}</div>{done===total&&<p className="mt-2 text-sm text-emerald-700">All requirements in this phase are complete.</p>}<button type="button" onClick={()=>onOpen(phase.tab)} className="mt-3 text-sm font-semibold text-blue-700 hover:underline">Open this phase</button></div>
    </details>}
  </section>;
}
function TabButton({active,onClick,icon,label,disabled=false}:{active:boolean;onClick:()=>void;icon:ReactNode;label:string;disabled?:boolean}) { return <button disabled={disabled} onClick={onClick} aria-disabled={disabled} className={`flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-sm font-medium ${disabled?'cursor-not-allowed border-transparent text-gray-300':active?'border-blue-600 text-blue-700':'border-transparent text-gray-500 hover:text-gray-800'}`}>{disabled&&<LockKeyhole className="h-3.5 w-3.5" aria-hidden="true"/>}{icon}{label}</button>; }
function FormSection({title,children}:{title:string;children:ReactNode}) { return <fieldset className="rounded-xl border border-gray-200 bg-gray-50/50 p-4 sm:p-5"><legend className="px-2 font-semibold text-gray-950">{title}</legend><div className="grid items-start gap-x-5 gap-y-5 md:grid-cols-2">{children}</div></fieldset>; }
function DiscoverySection({number,title,description,children}:{number:string;title:string;description:string;children:ReactNode}) { return <fieldset className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 shadow-sm sm:p-5"><legend className="px-2 font-semibold leading-6 text-slate-950"><span className="mr-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-800 ring-4 ring-white">{number}</span>{title}</legend><p className="mb-5 mt-1 max-w-3xl text-sm leading-6 text-slate-600">{description}</p><div className="grid items-start gap-x-5 gap-y-6 md:grid-cols-2">{children}</div></fieldset>; }
function Field({label,value,set,required,type='text',className=''}:{label:string;value:string;set:(value:string)=>void;required?:boolean;type?:string;className?:string}) {
  if (label === 'City') return <CitySearchSelect value={value} set={set} required={required} className={className}/>;
  if (label === 'State') return <Select label={label} value={value || 'AZ'} set={set} options={arizonaStateOptions} required={required} className={className}/>;
  if (label === 'Budget expectation') return <Select label={label} value={value} set={set} options={budgetOptions} required={required} className={className}/>;
  if (label === 'Desired timing') return <Select label={label} value={value} set={set} options={timingOptions} required={required} className={className}/>;
  if (label === 'Next reception action' || label === 'Next action' || label === 'Activity next action') return <Select label={label} value={value} set={set} options={nextReceptionActionOptions.map((option)=>({value:option,label:option}))} required={required} className={className}/>;
  return <label className={`block text-sm font-medium text-gray-800 ${className}`}><span className="form-field-caption">{label}{required&&<span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800">Required</span>}</span><input type={type} required={required} value={value} onChange={(event)=>set(event.target.value)} className="mt-1 w-full"/></label>;
}
function Area({label,value,set,className=''}:{label:string;value:string;set:(value:string)=>void;className?:string}) {
  const options = label === 'What would the client like to create or change?' ? projectVisionOptions : label === 'What should the finished project accomplish?' ? projectObjectiveOptions : label === 'Preliminary features or scope' ? preliminaryScopeOptions : null;
  if (label === 'Preliminary features or scope') return <DiscoveryChoices label={label} value={value} set={set} options={preliminaryScopeOptions.map((option)=>option.value)} className={className}/>;
  if (options) return <Select label={label} value={value} set={set} options={options} className={className}/>;
  return <label className={`block text-sm font-medium text-gray-800 ${className}`}><span className="form-field-caption">{label}</span><textarea rows={3} value={value} onChange={(event)=>set(event.target.value)} className="mt-1 w-full"/></label>;
}
function CitySearchSelect({value,set,required,className=''}:{value:string;set:(value:string)=>void;required?:boolean;className?:string}) { return <label className={`block text-sm font-medium text-gray-800 ${className}`}><span className="form-field-caption">City{required&&<span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800">Required</span>}</span><input list="arizona-cities" required={required} value={value} onChange={(event)=>set(event.target.value)} placeholder="Search Arizona cities" className="mt-1 w-full"/><datalist id="arizona-cities">{arizonaCities.map((city)=><option key={city} value={city}/>)}</datalist></label>; }
function ChannelSelect({value,set,required=false}:{value:string;set:(value:string)=>void;required?:boolean}) { return <label className="block text-sm font-medium text-gray-800"><span className="form-field-caption">Original Incoming Contact Channel{required&&<span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800">Required</span>}</span><select required={required} value={value} onChange={(event)=>set(event.target.value)} className="mt-1 w-full"><option value="">Select contact channel</option>{sourceOptions.map((option)=><option key={option} value={option}>{option.replace(/_/g,' ')}</option>)}</select></label>; }
function Select({label,value,set,options,required,className=''}:{label:string;value:string;set:(value:string)=>void;options:Array<{value:string;label:string}>;required?:boolean;className?:string}) { return <label className={`block text-sm font-medium text-gray-800 ${className}`}><span className="form-field-caption">{label}{required&&<span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800">Required</span>}</span><select required={required} value={value} onChange={(event)=>set(event.target.value)} className="mt-1 w-full"><option value="">Select {label.toLowerCase()}</option>{options.map((option)=><option key={option.value} value={option.value}>{option.label}</option>)}</select></label>; }
function DiscoverySelect({label,value,set,options,required}:{label:string;value:string;set:(value:string)=>void;options:string[];required?:boolean}) {
  const selectOptions = value && !options.includes(value) ? [value, ...options] : options;
  return <label className="block text-sm font-medium text-gray-800"><span className="form-field-caption">{label}{required&&<span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800">Required</span>}</span><select required={required} value={value} onChange={(event)=>set(event.target.value)} className="mt-1 w-full"><option value="">Select an answer</option>{selectOptions.map((option)=><option key={option} value={option}>{option===value&&!options.includes(option)?`Current response: ${option}`:option}</option>)}</select></label>;
}
function DiscoveryChoices({label,value,set,options,required=false,className=''}:{label:string;value:string;set:(value:string)=>void;options:string[];required?:boolean;className?:string}) {
  const selected = value.split(',').map((item)=>item.trim()).filter(Boolean);
  const toggle = (option:string) => set(selected.includes(option) ? selected.filter((item)=>item!==option).join(', ') : [...selected,option].join(', '));
  const extraValues = selected.filter((item)=>!options.includes(item));
  return <fieldset className={`rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm ${className}`}><legend className="max-w-full px-1 text-sm font-semibold leading-5 text-slate-700"><span className="form-field-caption">{label}{required&&<span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800">Required</span>}</span></legend><p className="mb-3 mt-1 text-xs leading-4 text-slate-500">Choose all that apply.</p><div className="flex flex-wrap gap-2">{options.map((option)=><button type="button" key={option} aria-pressed={selected.includes(option)} onClick={()=>toggle(option)} className={`min-h-9 rounded-full border px-3 py-1.5 text-xs font-semibold leading-4 transition ${selected.includes(option)?'border-blue-600 bg-blue-600 text-white shadow-sm':'border-slate-300 bg-white text-slate-700 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-800'}`}>{selected.includes(option)?'✓ ':'+ '}{option}</button>)}</div>{extraValues.length>0&&<p className="mt-2 text-xs text-slate-500">Existing response: {extraValues.join(', ')}</p>}</fieldset>;
}
function ShortAnswer({label,value,set,className=''}:{label:string;value:string;set:(value:string)=>void;className?:string}) { return <label className={`block text-sm font-medium text-gray-800 ${className}`}><span className="form-field-caption">{label}</span><input value={value} onChange={(event)=>set(event.target.value)} placeholder="Add a brief note" className="mt-1 w-full"/></label>; }
function Detail({label,value,preliminary=false}:{label:string;value?:string|null;preliminary?:boolean}) { return <div className="rounded-lg bg-gray-50 p-3"><div className="flex items-center gap-2"><p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>{preliminary&&<span className="rounded bg-white px-1.5 py-0.5 text-[10px] font-semibold text-gray-500">PRELIMINARY</span>}</div><p className="mt-1 text-sm text-gray-900">{value||'Not captured'}</p></div>; }
function Metric({label,value}:{label:string;value:number}) { return <div className="rounded-lg border border-gray-200 p-4"><p className="text-sm font-semibold">{label}</p><p className="mt-2 text-2xl font-bold text-gray-950">{value}</p><p className="mt-1 text-xs text-gray-500">Linked to this inquiry</p></div>; }
function ReadinessItem({label,complete,preliminary=false}:{label:string;complete:boolean;preliminary?:boolean}) { return <div className="flex items-center gap-3 rounded-lg border border-gray-200 p-3">{complete?<CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600"/>:<AlertCircle className="h-5 w-5 shrink-0 text-amber-600"/>}<div><p className="text-sm font-medium text-gray-900">{label}</p><p className="text-xs text-gray-500">{complete?(preliminary?'Captured as an early expectation':'Captured'):'Needs information'}</p></div></div>; }

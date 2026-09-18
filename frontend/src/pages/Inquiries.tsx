import { FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertCircle, ArrowRight, CheckCircle2, ChevronDown, ClipboardCheck, ClipboardList, Clock3, Download, FileText, Inbox, LockKeyhole, Plus, UserRound } from 'lucide-react';
import { authApi, clientApi, consultationApi, getApiErrorMessage, inquiryApi } from '../api';
import FormModal from '../components/FormModal';
import DocumentUpload from '../components/DocumentUpload';
import { useAuth } from '../context/AuthContext';
import { Client, Inquiry, PoolDiscovery, User } from '../types';

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
const workflowQueueDefinitions = [
  { key: 'ATTENTION', label: 'Initial Contact Made', shortLabel: 'Initial contact', statuses: ['NEW'], description: 'Lead has been reached and the project record is being started.' },
  { key: 'PROGRESS', label: 'Discovery & Design Inspirations Complete', shortLabel: 'Discovery and inspirations', statuses: ['IN_REVIEW'], description: 'The project brief and representative-led discovery are complete.' },
  { key: 'READY', label: 'Site Meeting & Feasibility Complete', shortLabel: 'Site meeting and feasibility', statuses: ['QUALIFIED'], description: 'The site meeting, evidence, and feasibility record are complete.' },
  { key: 'CLOSED', label: 'ROM / Narrative / Proposal & Design Handoff Complete', shortLabel: 'ROM, proposal, and handoff', statuses: ['CONVERTED'], description: 'The proposal record is complete and the inquiry has moved into Design.' },
];
const workflowStatusLabels: Record<string, string> = {
  NEW: 'Initial contact', IN_REVIEW: 'Discovery and inspirations', QUALIFIED: 'Site meeting and feasibility', CONVERTED: 'ROM, proposal, and handoff',
  DECLINED: 'Declined', NURTURED: 'Nurtured',
};
const terminalWorkStatuses = ['VERIFIED', 'CLOSED', 'CANCELLED'];
const statusColor: Record<string, string> = {
  NEW: 'bg-blue-100 text-blue-800', IN_REVIEW: 'bg-amber-100 text-amber-900',
  QUALIFIED: 'bg-emerald-100 text-emerald-800', CONVERTED: 'bg-violet-100 text-violet-800',
  DECLINED: 'bg-red-100 text-red-800', NURTURED: 'bg-gray-100 text-gray-800',
};
type TabKey = 'INTAKE' | 'QUESTIONS' | 'CONVERSATION' | 'HANDOFF';
type IntakeForm = { clientId:string; leadName:string; leadEmail:string; leadPhone:string; ownerId:string; source:string; description:string; objectives:string; preliminaryScope:string; designInspirations:string; budgetExpectation:string; desiredTiming:string; nextAction:string; nextActionDueAt:string; address:string; city:string; state:string; postalCode:string };
type LeadCandidate = { id:string; name:string; email:string|null; phone:string|null };
const emptyForm: IntakeForm = { clientId:'', leadName:'', leadEmail:'', leadPhone:'', ownerId:'', source:'', description:'', objectives:'', preliminaryScope:'', designInspirations:'', budgetExpectation:'', desiredTiming:'', nextAction:'', nextActionDueAt:'', address:'', city:'', state:'AZ', postalCode:'' };
const emptyDiscovery: PoolDiscovery = {
  projectType:'', primaryUse:'', householdUsers:'', decisionMakers:'', propertyAccess:'', siteConditions:'', utilities:'',
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
  { key: 'DISCOVERY', label: 'Discovery & Design Inspirations Complete', tab: 'QUESTIONS' as const },
  { key: 'SITE_MEETING', label: 'Site Meeting & Feasibility Complete', tab: 'CONVERSATION' as const },
  { key: 'HANDOFF', label: 'ROM / Narrative / Proposal & Design Handoff Complete', tab: 'HANDOFF' as const },
];

const hasText = (value?: string | null) => Boolean(value?.trim());
const discoveryValueComplete = (value?: string | null) => Boolean(value?.trim() && value.trim().toUpperCase() !== 'UNKNOWN');
const discoveryProgress = (discovery?: PoolDiscovery | null) => {
  const complete = requiredDiscoveryFields.filter(({key})=>discoveryValueComplete(discovery?.[key])).length;
  return { complete, total: requiredDiscoveryFields.length, percent: Math.round((complete / requiredDiscoveryFields.length) * 100) };
};
function inquiryPhaseRequirements(inquiry: Inquiry, phaseIndex: number) {
  const hasContact = Boolean(inquiry.client?.name && (inquiry.client?.email || inquiry.client?.phone));
  const isSiteMeeting = (item: { title: string; status: string }) => /site\s+meeting/i.test(item.title);
  const hasScheduledSiteMeeting = Boolean(inquiry.consultations?.some((item) => item.status === 'SCHEDULED' && isSiteMeeting(item)));
  const hasCompletedSiteMeeting = Boolean(inquiry.consultations?.some((item) => item.status === 'COMPLETED' && isSiteMeeting(item) && hasText(item.outcome)));
  const hasSiteEvidence = Boolean(inquiry.documents?.length);
  const hasOpenRequests = Boolean(inquiry.workItems?.some((item) => !terminalWorkStatuses.includes(item.status)));
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
      { label: 'Design inspirations recorded', complete: hasText(inquiry.designInspirations) },
    ],
    [
      { label: 'Site meeting scheduled', complete: hasScheduledSiteMeeting },
      { label: 'Site meeting completed with outcome', complete: hasCompletedSiteMeeting },
      { label: 'Site measurements, access, and feasibility recorded', complete: hasText(inquiry.siteAssessment) },
      { label: 'Site photos or supporting evidence uploaded', complete: hasSiteEvidence },
      { label: 'All client information requests resolved', complete: !hasOpenRequests },
    ],
    [
      { label: 'ROM amount or range recorded', complete: hasText(inquiry.romAmount) },
      { label: 'Narrative and design proposal recorded', complete: hasText(inquiry.proposalNarrative) },
      { label: 'Proposal delivery date recorded', complete: Boolean(inquiry.proposalProvidedAt) },
      { label: 'Client response or decision recorded', complete: hasText(inquiry.proposalClientResponse) },
      { label: 'Design handoff completed', complete: Boolean(inquiry.projectId && inquiry.qualificationStatus === 'CONVERTED') },
    ],
  ];
  if (inquiry.qualificationStatus === 'CONVERTED' && inquiry.projectId) {
    return (phaseRequirements[phaseIndex] || []).map((requirement) => ({ ...requirement, complete: true }));
  }
  return phaseRequirements[phaseIndex] || [];
}
function inquiryPhaseCompletion(inquiry: Inquiry, phaseIndex: number) {
  const requirements = inquiryPhaseRequirements(inquiry, phaseIndex);
  return { requirements, complete: requirements.length > 0 && requirements.every((requirement) => requirement.complete) };
}
function coreIntakeProgress(inquiry: Inquiry) {
  const checks = [Boolean(inquiry.client?.name && (inquiry.client?.email || inquiry.client?.phone)), hasText(inquiry.property?.address), hasText(inquiry.description), hasText(inquiry.objectives), hasText(inquiry.preliminaryScope), hasText(inquiry.designInspirations), hasText(inquiry.budgetExpectation), hasText(inquiry.desiredTiming), Boolean(inquiry.ownerId), hasText(inquiry.nextAction), discoveryProgress(inquiry.discovery).percent === 100];
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
  const stage = workflowQueueDefinitions.find((definition) => definition.statuses.includes(inquiry.qualificationStatus));
  if (stage) return stage.key;
  if (['DECLINED','NURTURED'].includes(inquiry.qualificationStatus)) return 'ARCHIVED';
  return 'ATTENTION';
}

export default function Inquiries() {
  const { user: currentUser } = useAuth();
  const [items,setItems] = useState<Inquiry[]>([]);
  const [clients,setClients] = useState<Client[]>([]);
  const [users,setUsers] = useState<User[]>([]);
  const [selected,setSelected] = useState<Inquiry|null>(null);
  const [filter,setFilter] = useState('');
  const [queue,setQueue] = useState('ACTIVE');
  const [activeTab,setActiveTab] = useState<TabKey>('INTAKE');
  const [showCreate,setShowCreate] = useState(false);
  const [saving,setSaving] = useState(false);
  const [exportingInquiry,setExportingInquiry] = useState(false);
  const [error,setError] = useState('');
  const [outcome,setOutcome] = useState('');
  const [informationRequest,setInformationRequest] = useState('');
  const [discoveryForm,setDiscoveryForm] = useState<PoolDiscovery>(emptyDiscovery);
  const [designInspirations,setDesignInspirations] = useState('');
  const [showEdit,setShowEdit] = useState(false);
  const [showRecord,setShowRecord] = useState(false);
  const [showMore,setShowMore] = useState(false);
  const [editForm,setEditForm] = useState({ leadName:'', leadEmail:'', leadPhone:'', description:'', objectives:'', preliminaryScope:'', designInspirations:'', budgetExpectation:'', desiredTiming:'', source:'', nextAction:'', nextActionDueAt:'', address:'', city:'', state:'', postalCode:'' });
  const [siteMeetingDate,setSiteMeetingDate] = useState('');
  const [siteAssessment,setSiteAssessment] = useState('');
  const [handoffForm,setHandoffForm] = useState({ romAmount:'', proposalNarrative:'', proposalProvidedAt:'', proposalClientResponse:'' });
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
      const [inquiryResult,clientResult,userResult] = await Promise.all([inquiryApi.list(inquiryParams),clientApi.getAll({status:'LEAD'}),authApi.getUsers()]);
      setItems(inquiryResult.data.data); setClients(clientResult.data.data);
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
    ATTENTION:items.filter((item)=>queueGroup(item)==='ATTENTION').length,
    PROGRESS:items.filter((item)=>queueGroup(item)==='PROGRESS').length,
    READY:items.filter((item)=>queueGroup(item)==='READY').length,
    CLOSED:items.filter((item)=>queueGroup(item)==='CLOSED').length,
  }),[items]);
  const blockers = selected ? handoffBlockers(selected) : [];
  const openRequests = selected?.workItems?.filter((item)=>!terminalWorkStatuses.includes(item.status)) || [];
  const selectedDiscoveryProgress = discoveryProgress(discoveryForm);
  const selectedPhaseCompletions = selected ? inquiryPhaseDefinitions.map((_, index) => inquiryPhaseCompletion(selected, index)) : [];
  const phaseUnlocked = (phaseIndex:number) => phaseIndex === 0 || selectedPhaseCompletions.slice(0, phaseIndex).every((phase) => phase.complete);
  const phaseOneComplete = Boolean(selectedPhaseCompletions[0]?.complete);
  const phaseTwoComplete = Boolean(selectedPhaseCompletions[1]?.complete);
  const phaseThreeComplete = Boolean(selectedPhaseCompletions[2]?.complete);
  const scheduledSiteMeeting = selected?.consultations?.find((consultation) => consultation.status === 'SCHEDULED' && /site\s+meeting/i.test(consultation.title));
  const completedSiteMeeting = selected?.consultations?.find((consultation) => consultation.status === 'COMPLETED' && /site\s+meeting/i.test(consultation.title) && hasText(consultation.outcome));
  const discoveryDirty = Boolean(selected && JSON.stringify({discovery:discoveryForm,designInspirations}) !== lastSavedDiscovery.current);

  const mutate = async (operation:()=>Promise<unknown>) => {
    try { setSaving(true); setError(''); await operation(); await load(); }
    catch (err) {
      const candidates = (err as any)?.response?.data?.error?.matchCandidates;
      if (Array.isArray(candidates)) {
        setMatchCandidates(candidates);
        setClients((current) => [...current, ...candidates.filter((candidate:LeadCandidate) => !current.some((item) => item.id === candidate.id))]);
      }
      setError(getApiErrorMessage(err,'The intake record could not be updated.'));
    }
    finally { setSaving(false); }
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
      const detail = (await inquiryApi.get(item.id)).data as Inquiry;
      setSelected(detail); setShowEdit(false); setShowRecord(true); setShowMore(false); setActiveTab('INTAKE');
      const nextDiscovery = {...emptyDiscovery,...(detail.discovery||{})};
      setDiscoveryForm(nextDiscovery); setDesignInspirations(detail.designInspirations || ''); lastSavedDiscovery.current = JSON.stringify({discovery:nextDiscovery,designInspirations:detail.designInspirations || ''}); setDiscoverySaveState('idle'); setShowHandoffConfirm(false);
      setSiteMeetingDate(detail.consultations?.find((consultation) => consultation.status === 'SCHEDULED' && /site\s+meeting/i.test(consultation.title))?.date?.slice(0, 16) || '');
      setSiteAssessment(detail.siteAssessment || '');
      setHandoffForm({romAmount:detail.romAmount||'',proposalNarrative:detail.proposalNarrative||'',proposalProvidedAt:detail.proposalProvidedAt?detail.proposalProvidedAt.slice(0,16):'',proposalClientResponse:detail.proposalClientResponse||''});
      setEditForm({leadName:detail.client.name||'',leadEmail:detail.client.email||'',leadPhone:detail.client.phone||'',description:detail.description||'',objectives:detail.objectives||'',preliminaryScope:detail.preliminaryScope||'',designInspirations:detail.designInspirations||'',budgetExpectation:detail.budgetExpectation||'',desiredTiming:detail.desiredTiming||'',source:detail.source||'',nextAction:detail.nextAction||'',nextActionDueAt:detail.nextActionDueAt?detail.nextActionDueAt.slice(0,16):'',address:detail.property?.address||'',city:detail.property?.city||'',state:detail.property?.state||'AZ',postalCode:detail.property?.postalCode||''});
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
        const response = await inquiryApi.update(selected.id, { discovery: discoveryForm, designInspirations: designInspirations.trim() || null });
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
    if (!discoveryDirty) return;
    const warn = (event:BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [discoveryDirty]);
  const changeStatus = (status:string) => {
    if (!selected) return;
    if (['DECLINED','NURTURED'].includes(status)) { setStatusAction(status as 'NURTURED'|'DECLINED'); setStatusReason(''); return; }
    mutate(()=>inquiryApi.setStatus(selected.id,status));
  };
  const saveDiscovery = (event:FormEvent) => {
    event.preventDefault();
    if (!selected) return;
    const snapshot = JSON.stringify({discovery:discoveryForm,designInspirations});
    mutate(async()=>{ await inquiryApi.update(selected.id,{discovery:discoveryForm,designInspirations:designInspirations.trim()||null}); lastSavedDiscovery.current = snapshot; setDiscoverySaveState('saved'); });
  };
  const scheduleSiteMeeting = () => {
    if (!selected || !siteMeetingDate) return;
    mutate(async()=>{ await consultationApi.create(selected.clientId,{ title:'Site meeting', date:new Date(siteMeetingDate).toISOString(), status:'SCHEDULED', inquiryId:selected.id }); });
  };
  const saveSiteAssessment = () => {
    if (!selected) return;
    mutate(()=>inquiryApi.update(selected.id,{siteAssessment:siteAssessment.trim()||null}));
  };
  const saveHandoffDetails = () => {
    if (!selected) return;
    mutate(()=>inquiryApi.update(selected.id,{romAmount:handoffForm.romAmount.trim()||null,proposalNarrative:handoffForm.proposalNarrative.trim()||null,proposalProvidedAt:handoffForm.proposalProvidedAt?new Date(handoffForm.proposalProvidedAt).toISOString():null,proposalClientResponse:handoffForm.proposalClientResponse.trim()||null}));
  };
  const completeHandoff = () => {
    if (!selected) return;
    mutate(async()=>{
      await inquiryApi.update(selected.id,{romAmount:handoffForm.romAmount.trim()||null,proposalNarrative:handoffForm.proposalNarrative.trim()||null,proposalProvidedAt:handoffForm.proposalProvidedAt?new Date(handoffForm.proposalProvidedAt).toISOString():null,proposalClientResponse:handoffForm.proposalClientResponse.trim()||null});
      const response = await inquiryApi.convert(selected.id);
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
    tone: ['text-blue-700', 'text-amber-700', 'text-emerald-700', 'text-gray-700'][index],
  }));
  const selectedWorkflow = queueCards.find((card) => card.key === queue);

  return <div className="mx-auto max-w-7xl space-y-6">
    <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"><div><p className="text-sm font-semibold text-blue-700">Reception workspace</p><h1 className="text-2xl font-bold text-gray-950">Reception Intake</h1><p className="mt-1 max-w-2xl text-sm text-gray-600">Build one clear project record that Design can continue without repeating the first conversation.</p></div><button onClick={()=>setShowCreate(!showCreate)} className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"><Plus className="mr-2 inline h-4 w-4" />New project inquiry</button></header>
    {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"><AlertCircle className="mr-2 inline h-4 w-4" />{error}</div>}
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
        <InquiryPhaseProgress completions={selectedPhaseCompletions} phaseUnlocked={phaseUnlocked} activePhaseIndex={selectedPhaseCompletions.findIndex((phase) => !phase.complete) < 0 ? inquiryPhaseDefinitions.length - 1 : Math.max(0, selectedPhaseCompletions.findIndex((phase) => !phase.complete))} onOpen={(tab)=>setActiveTab(tab)} />
        <nav aria-label="Intake record sections" className="flex items-center overflow-x-auto border-b border-gray-200 px-3"><TabButton disabled={!phaseUnlocked(0)} active={activeTab==='INTAKE'} onClick={()=>setActiveTab('INTAKE')} icon={<UserRound className="h-4 w-4"/>} label="Intake"/><TabButton disabled={!phaseUnlocked(1)} active={activeTab==='QUESTIONS'} onClick={()=>setActiveTab('QUESTIONS')} icon={<ClipboardList className="h-4 w-4"/>} label={`Pre-design discovery${selectedDiscoveryProgress.percent===100?' ✓':''}${discoverySaveState==='saved'?' · Saved':''}`}/><TabButton disabled={!phaseUnlocked(2)} active={activeTab==='CONVERSATION'} onClick={()=>setActiveTab('CONVERSATION')} icon={<FileText className="h-4 w-4"/>} label="Files & conversation"/><TabButton disabled={!phaseUnlocked(3)} active={activeTab==='HANDOFF'} onClick={()=>setActiveTab('HANDOFF')} icon={<ClipboardCheck className="h-4 w-4"/>} label="Handoff"/><button type="button" onClick={downloadInquiryPdf} disabled={exportingInquiry} className="ml-auto inline-flex shrink-0 items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50"><Download className="h-4 w-4"/>{exportingInquiry?'Preparing report…':'Download inquiry report'}</button></nav>
        <div className="p-5">
          {activeTab==='INTAKE'&&<div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold">Project information</h3><p className="mt-1 text-sm text-gray-600">Capture facts once and build on this record through Design.</p></div><button onClick={()=>{setShowRecord(false);setShowEdit(true);}} className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium hover:border-blue-500 hover:text-blue-700">Edit intake</button></div>
            <div className="grid gap-4 sm:grid-cols-2"><Detail label="Client email" value={selected.client.email}/><Detail label="Project description" value={selected.description}/><Detail label="Objectives" value={selected.objectives}/><Detail label="Preliminary scope" value={selected.preliminaryScope}/><Detail label="Budget expectation" value={selected.budgetExpectation} preliminary/><Detail label="Desired timing" value={selected.desiredTiming} preliminary/><Detail label="Source / referral" value={selected.source}/><Detail label="Reception owner" value={selected.owner?.name}/></div>
            {!selected.ownerId&&<div className="rounded-lg border border-amber-200 bg-amber-50 p-4"><p className="mb-3 text-sm font-semibold text-amber-950">This inquiry needs an owner and next action.</p><Select label="Assign reception owner" value="" set={(ownerId)=>ownerId&&mutate(()=>inquiryApi.update(selected.id,{ownerId,nextAction:selected.nextAction||'Complete qualification review',nextActionDueAt:new Date(Date.now()+86400000).toISOString()}))} options={users.map((user)=>({value:user.id,label:user.name}))}/></div>}
          </div>}

          {activeTab==='QUESTIONS'&&<form onSubmit={saveDiscovery} className="space-y-6">
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold text-blue-950">Representative-led pre-design discovery</h3><p className="mt-1 text-sm text-blue-800">Complete this with the client during calls, texts, emails, or an appointment. Answers stay on this single inquiry and move forward to Design.</p></div><span className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-blue-800">{selectedDiscoveryProgress.complete} of {selectedDiscoveryProgress.total} essentials</span></div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-blue-100"><div className="h-full rounded-full bg-blue-600 transition-all" style={{width:`${selectedDiscoveryProgress.percent}%`}}/></div>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <div><h4 className="font-semibold text-gray-950">Design inspirations</h4><p className="mt-1 text-sm text-gray-600">Capture reference links, images discussed, or style examples that should move into Design.</p></div>
              <Area label="Design inspirations or reference links" value={designInspirations} set={setDesignInspirations}/>
            </div>

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

            <div className="sticky bottom-0 -mx-5 flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 bg-white px-5 py-4"><p className="text-sm text-gray-600">Fields marked * are required before qualification.</p><button disabled={saving} className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">{saving?'Saving…':'Save discovery'}</button></div>

            <details className="rounded-xl border border-gray-200 bg-gray-50"><summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-gray-800">Client follow-up requests {openRequests.length?`(${openRequests.length} open)`: '(use only when necessary)'}</summary><div className="space-y-4 border-t border-gray-200 p-4">{selected.workItems?.length?<div className="space-y-3">{selected.workItems.map((item)=><div key={item.id} className={`rounded-lg border p-4 ${terminalWorkStatuses.includes(item.status)?'border-gray-200 bg-white':'border-amber-200 bg-amber-50'}`}><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold text-gray-950">{item.title}</p>{item.description&&<p className="mt-1 text-sm text-gray-600">{item.description}</p>}<p className="mt-2 text-xs text-gray-500">{item.dueAt?`Due ${new Date(item.dueAt).toLocaleDateString()}`:'No due date'}</p></div><span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-gray-700">{item.status.replace(/_/g,' ')}</span></div></div>)}</div>:<p className="text-sm text-gray-500">No client follow-up requests have been created.</p>}<label className="text-sm font-semibold text-gray-900">Request an item that the representative cannot answer<input aria-label="Missing information request" value={informationRequest} onChange={(event)=>setInformationRequest(event.target.value)} placeholder="Example: Upload the current property survey" className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-normal"/></label><div className="flex justify-end"><button type="button" disabled={saving||!informationRequest.trim()} onClick={()=>informationRequest&&mutate(async()=>{await inquiryApi.requestInformation(selected.id,{title:informationRequest,dueAt:new Date(Date.now()+3*86400000).toISOString()});setInformationRequest('');})} className="rounded-lg bg-amber-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Send focused request</button></div></div></details>
          </form>}

          {activeTab==='CONVERSATION'&&<div className="space-y-5"><div><h3 className="font-semibold">Site meeting, feasibility, and evidence</h3><p className="mt-1 text-sm text-gray-600">Schedule the site meeting, record what was learned, and attach the supporting photos or documents needed by Design.</p></div><div className="rounded-xl border border-gray-200 bg-gray-50 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h4 className="font-semibold text-gray-950">Site meeting</h4><p className="mt-1 text-sm text-gray-600">A completed site meeting with an outcome is required before Design handoff.</p></div>{completedSiteMeeting?<span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">Completed</span>:scheduledSiteMeeting?<span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800">Scheduled</span>:null}</div>{scheduledSiteMeeting&&!completedSiteMeeting&&<p className="mt-3 text-sm text-gray-700">Scheduled for {new Date(scheduledSiteMeeting.date).toLocaleString()}</p>}{!scheduledSiteMeeting&&!completedSiteMeeting&&<div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end"><label className="flex-1 text-sm font-semibold text-gray-800">Meeting date and time<input type="datetime-local" required value={siteMeetingDate} onChange={(event)=>setSiteMeetingDate(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-normal"/></label><button type="button" disabled={saving||!siteMeetingDate} onClick={scheduleSiteMeeting} className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Schedule site meeting</button></div>}{!completedSiteMeeting&&<div className="mt-4 border-t border-gray-200 pt-4"><label className="text-sm font-semibold text-gray-900">Site meeting outcome<input aria-label="Site meeting outcome" value={outcome} onChange={(event)=>setOutcome(event.target.value)} placeholder="Record the client decision, site findings, and next step" className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-normal"/></label><div className="mt-3 flex justify-end"><button type="button" disabled={saving||!outcome.trim()} onClick={()=>outcome&&mutate(async()=>{await consultationApi.create(selected.clientId,{title:'Site meeting',date:scheduledSiteMeeting?.date||new Date().toISOString(),status:'COMPLETED',inquiryId:selected.id,outcome});setOutcome('');})} className="rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Record site meeting outcome</button></div></div>}</div><div className="rounded-xl border border-gray-200 bg-white p-4"><label className="text-sm font-semibold text-gray-900">Site measurements, access, and feasibility notes<textarea rows={5} value={siteAssessment} onChange={(event)=>setSiteAssessment(event.target.value)} placeholder="Record measurements, equipment access, drainage, utilities, soil, HOA, and feasibility findings." className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-normal"/></label><div className="mt-3 flex justify-end"><button type="button" disabled={saving} onClick={saveSiteAssessment} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-800">Save site assessment</button></div></div><DocumentUpload clientId={selected.clientId} inquiryId={selected.id} documents={selected.documents||[]} onUploadComplete={()=>mutate(()=>inquiryApi.get(selected.id))}/><div className="grid gap-4 sm:grid-cols-2"><Metric label="Inquiry photos and documents" value={selected.documents?.length||0}/><Metric label="Consultation records" value={selected.consultations?.length||0}/></div>{selected.consultations?.length?<div className="space-y-3">{selected.consultations.map((consultation)=><div key={consultation.id} className="rounded-lg bg-gray-50 p-4"><p className="text-sm font-semibold">{consultation.title}</p><p className="mt-1 text-sm text-gray-700">{consultation.outcome||consultation.notes||'No outcome recorded'}</p><p className="mt-2 text-xs text-gray-500">{new Date(consultation.date).toLocaleDateString()} · {consultation.status}</p></div>)}</div>:<p className="text-sm text-gray-500">No consultation records have been added.</p>}</div>}

          {activeTab==='HANDOFF'&&<div className="space-y-5"><div><h3 className="font-semibold">Design handoff readiness</h3><p className="mt-1 text-sm text-gray-600">Review the record and resolve each blocker before creating the Design project.</p></div><div className="rounded-xl border border-gray-200 bg-white p-4"><h4 className="font-semibold text-gray-950">ROM, narrative, and proposal</h4><p className="mt-1 text-sm text-gray-600">Complete these handoff details before the inquiry can become a Design client.</p><div className="mt-4 grid gap-4 sm:grid-cols-2"><Field label="ROM amount or range" value={handoffForm.romAmount} set={(value)=>setHandoffForm({...handoffForm,romAmount:value})}/><label className="text-sm font-medium text-gray-800">Proposal delivery date<input type="datetime-local" value={handoffForm.proposalProvidedAt} onChange={(event)=>setHandoffForm({...handoffForm,proposalProvidedAt:event.target.value})} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2"/></label><Area label="Narrative and design proposal" value={handoffForm.proposalNarrative} set={(value)=>setHandoffForm({...handoffForm,proposalNarrative:value})} className="sm:col-span-2"/><Area label="Client response or decision" value={handoffForm.proposalClientResponse} set={(value)=>setHandoffForm({...handoffForm,proposalClientResponse:value})} className="sm:col-span-2"/></div><div className="mt-3 flex justify-end"><button type="button" disabled={saving} onClick={saveHandoffDetails} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-800">Save proposal details</button></div></div>{blockers.length?<div className="rounded-lg border border-amber-200 bg-amber-50 p-4"><p className="font-semibold text-amber-950">{blockers.length} item{blockers.length===1?'':'s'} need attention</p><ul className="mt-3 space-y-2">{blockers.map((blocker)=><li key={blocker} className="flex gap-2 text-sm text-amber-900"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0"/>{blocker}</li>)}</ul></div>:<div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-900"><CheckCircle2 className="mr-2 inline h-5 w-5"/><span className="font-semibold">The current conversion requirements are complete.</span></div>}<div className="grid gap-3 sm:grid-cols-2"><ReadinessItem label="Client identity" complete={Boolean(selected.client?.name&&(selected.client?.email||selected.client?.phone))}/><ReadinessItem label="Property" complete={Boolean(selected.propertyId)}/><ReadinessItem label="Pre-design discovery" complete={selectedDiscoveryProgress.percent===100}/><ReadinessItem label="Design inspirations" complete={hasText(selected.designInspirations)}/><ReadinessItem label="Site meeting scheduled" complete={Boolean(scheduledSiteMeeting||completedSiteMeeting)}/><ReadinessItem label="Site meeting completed" complete={Boolean(completedSiteMeeting)}/><ReadinessItem label="Site feasibility recorded" complete={hasText(selected.siteAssessment)}/><ReadinessItem label="Supporting evidence uploaded" complete={Boolean(selected.documents?.length)}/><ReadinessItem label="ROM amount or range" complete={hasText(selected.romAmount)}/><ReadinessItem label="Narrative and design proposal" complete={hasText(selected.proposalNarrative)}/><ReadinessItem label="Proposal delivery date" complete={Boolean(selected.proposalProvidedAt)}/><ReadinessItem label="Client response or decision" complete={hasText(selected.proposalClientResponse)}/></div>{showHandoffConfirm&&<div className="rounded-lg border border-violet-200 bg-violet-50 p-4"><p className="font-semibold text-violet-950">Create the Design project now?</p><p className="mt-1 text-sm text-violet-900">This will convert the Reception lead into an active client, start Design, and close this intake record. The Reception history will remain available.</p><div className="mt-4 flex flex-wrap gap-2"><button disabled={saving} onClick={completeHandoff} className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving?'Creating…':'Confirm handoff'}</button><button type="button" disabled={saving} onClick={()=>setShowHandoffConfirm(false)} className="rounded-lg border border-violet-300 bg-white px-4 py-2 text-sm font-semibold text-violet-900">Cancel</button></div></div>}<div className="flex flex-wrap gap-3 border-t border-gray-200 pt-5">{selected.qualificationStatus==='NEW'&&<button disabled={saving||!phaseOneComplete} title={!phaseOneComplete?'Complete every Phase 1 requirement first.':undefined} onClick={()=>changeStatus('IN_REVIEW')} className="rounded-lg bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-950 disabled:cursor-not-allowed disabled:opacity-50">Begin qualification review</button>}{selected.qualificationStatus==='IN_REVIEW'&&<button disabled={saving||!phaseTwoComplete} title={!phaseTwoComplete?'Complete every Phase 2 requirement first.':undefined} onClick={()=>changeStatus('QUALIFIED')} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">Mark qualified</button>}{selected.qualificationStatus==='QUALIFIED'&&!showHandoffConfirm&&<button disabled={saving||!phaseThreeComplete||blockers.length>0} title={!phaseThreeComplete?'Complete every Phase 3 requirement first.':blockers.length?'Resolve the remaining handoff blockers first.':undefined} onClick={()=>setShowHandoffConfirm(true)} className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">Approve handoff & create Design project</button>}{selected.projectId&&<Link to={`/projects/${selected.projectId}`} className="rounded-lg border border-violet-300 px-4 py-2 text-sm font-semibold text-violet-700">Open Design project <ArrowRight className="ml-1 inline h-4 w-4"/></Link>}</div><div className="rounded-lg border border-gray-200"><button onClick={()=>setShowMore(!showMore)} className="flex w-full items-center justify-between p-4 text-left text-sm font-semibold"><span>More intake actions</span><ChevronDown className={`h-4 w-4 transition ${showMore?'rotate-180':''}`}/></button>{showMore&&<div className="flex flex-wrap gap-2 border-t border-gray-200 p-4"><Link to={`/clients/${selected.clientId}/status-report?inquiryId=${selected.id}${selected.projectId?`&projectId=${selected.projectId}`:''}`} className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium">View status report</Link>{['NEW','IN_REVIEW'].includes(selected.qualificationStatus)&&<><button onClick={()=>changeStatus('NURTURED')} className="rounded-lg bg-gray-100 px-3 py-2 text-sm">Move to nurture</button><button onClick={()=>changeStatus('DECLINED')} className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">Decline inquiry</button></>}</div>}</div></div>}
        </div>
      </FormModal>}
    </div>

    {selected&&<FormModal
      open={showEdit}
      title="Edit project intake"
      description="Update the information that will move forward into Design."
      busy={saving}
      submitLabel="Save intake changes"
      onClose={()=>setShowEdit(false)}
      onSubmit={(event)=>{event.preventDefault();mutate(async()=>{const {leadName,leadEmail,leadPhone,address,city,state,postalCode,...inquiryData}=editForm;await clientApi.update(selected.clientId,{name:leadName,email:leadEmail,phone:leadPhone});await inquiryApi.update(selected.id,{...inquiryData,nextActionDueAt:inquiryData.nextActionDueAt||null,...(address.trim()?{property:{address,city:city||null,state:state||null,postalCode:postalCode||null}}:{})});setShowEdit(false);});}}
    >
      <FormSection title="Lead contact"><Field label="Lead name" value={editForm.leadName} set={(value)=>setEditForm({...editForm,leadName:value})} required/><Field label="Lead email" value={editForm.leadEmail} set={(value)=>setEditForm({...editForm,leadEmail:value})}/><Field label="Lead phone" value={editForm.leadPhone} set={(value)=>setEditForm({...editForm,leadPhone:value})}/></FormSection>
      <FormSection title="Project vision"><Area label="What would the client like to create or change?" value={editForm.description} set={(value)=>setEditForm({...editForm,description:value})}/><Area label="What should the finished project accomplish?" value={editForm.objectives} set={(value)=>setEditForm({...editForm,objectives:value})}/><Area label="Preliminary features or scope" value={editForm.preliminaryScope} set={(value)=>setEditForm({...editForm,preliminaryScope:value})} className="md:col-span-2"/><Area label="Design inspirations or reference links" value={editForm.designInspirations} set={(value)=>setEditForm({...editForm,designInspirations:value})} className="md:col-span-2"/></FormSection>
      <FormSection title="Property"><Field label="Property address" value={editForm.address} set={(value)=>setEditForm({...editForm,address:value})}/><Field label="City" value={editForm.city} set={(value)=>setEditForm({...editForm,city:value})}/><Field label="State" value={editForm.state} set={(value)=>setEditForm({...editForm,state:value})}/><Field label="Postal code" value={editForm.postalCode} set={(value)=>setEditForm({...editForm,postalCode:value})}/></FormSection>
      <FormSection title="Expectations"><Field label="Budget expectation" value={editForm.budgetExpectation} set={(value)=>setEditForm({...editForm,budgetExpectation:value})}/><Field label="Desired timing" value={editForm.desiredTiming} set={(value)=>setEditForm({...editForm,desiredTiming:value})}/><ChannelSelect value={editForm.source} set={(value)=>setEditForm({...editForm,source:value})}/></FormSection>
      <FormSection title="Reception follow-up"><Field label="Next action" value={editForm.nextAction} set={(value)=>setEditForm({...editForm,nextAction:value})}/><label className="text-sm font-medium text-gray-800">Next action due<input type="datetime-local" value={editForm.nextActionDueAt} onChange={(event)=>setEditForm({...editForm,nextActionDueAt:event.target.value})} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2"/></label></FormSection>
    </FormModal>}
    {selected&&statusAction&&<FormModal open title={statusAction==='DECLINED'?'Decline inquiry':'Move inquiry to nurture'} description="Record why this Reception lead is leaving the active queue." busy={saving} submitLabel={statusAction==='DECLINED'?'Decline inquiry':'Move to nurture'} onClose={()=>setStatusAction(null)} onSubmit={(event)=>{event.preventDefault();mutate(async()=>{await inquiryApi.setStatus(selected.id,statusAction,statusReason);setStatusAction(null);});}}><label className="text-sm font-medium text-gray-800">Reason<textarea required rows={4} value={statusReason} onChange={(event)=>setStatusReason(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2"/></label></FormModal>}
  </div>;
}

function InquiryPhaseProgress({completions,phaseUnlocked,activePhaseIndex,onOpen}:{completions:Array<{requirements:Array<{label:string;complete:boolean}>;complete:boolean}>;phaseUnlocked:(phaseIndex:number)=>boolean;activePhaseIndex:number;onOpen:(tab:TabKey)=>void}) {
  return <section aria-label="Inquiry phase progress" className="mb-5 rounded-xl border border-gray-200 bg-gray-50 p-4">
    <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-semibold text-gray-950">Inquiry phase progress</h3><p className="mt-1 text-sm text-gray-600">Complete every requirement in the current phase to unlock the next one.</p></div><span className="text-xs font-semibold uppercase tracking-wide text-gray-500">{completions.filter((phase)=>phase.complete).length} of {completions.length} complete</span></div>
    <div className="mt-4 grid gap-2 md:grid-cols-4">{inquiryPhaseDefinitions.map((phase,index)=>{const unlocked=phaseUnlocked(index);const completion=completions[index];return <button key={phase.key} type="button" disabled={!unlocked} onClick={()=>unlocked&&onOpen(phase.tab)} aria-label={`${phase.label}${unlocked?'':' locked'}`} className={`min-w-0 rounded-lg border p-3 text-left transition ${!unlocked?'cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400':completion.complete?'border-emerald-200 bg-emerald-50 text-emerald-900':activePhaseIndex===index?'border-blue-300 bg-blue-50 text-blue-950':'border-gray-200 bg-white text-gray-900 hover:border-blue-300'}`}><div className="flex items-start justify-between gap-2"><span className="text-xs font-semibold uppercase tracking-wide">Phase {index+1}</span>{!unlocked?<LockKeyhole className="h-4 w-4 shrink-0" aria-hidden="true"/>:completion.complete?<CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true"/>:<span className="h-2.5 w-2.5 shrink-0 rounded-full bg-blue-500" aria-hidden="true"/>}</div><p className="mt-2 text-sm font-semibold leading-5">{phase.label}</p><p className="mt-2 text-xs font-medium">{!unlocked?'Locked':completion.complete?'Complete':activePhaseIndex===index?'In progress':'Unlocked'}</p></button>})}</div>
    {completions[activePhaseIndex]&&<div className="mt-3 rounded-lg border border-blue-200 bg-white p-3"><p className="text-sm font-semibold text-gray-900">Phase {activePhaseIndex+1} requirements</p><div className="mt-2 grid gap-2 sm:grid-cols-2">{completions[activePhaseIndex].requirements.map((requirement)=><div key={requirement.label} className={`flex items-center gap-2 text-sm ${requirement.complete?'text-emerald-700':'text-gray-600'}`}><CheckCircle2 className={`h-4 w-4 shrink-0 ${requirement.complete?'text-emerald-500':'text-gray-300'}`} aria-hidden="true"/><span>{requirement.label}</span></div>)}</div></div>}
  </section>;
}
function TabButton({active,onClick,icon,label,disabled=false}:{active:boolean;onClick:()=>void;icon:ReactNode;label:string;disabled?:boolean}) { return <button disabled={disabled} onClick={onClick} aria-disabled={disabled} className={`flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-sm font-medium ${disabled?'cursor-not-allowed border-transparent text-gray-300':active?'border-blue-600 text-blue-700':'border-transparent text-gray-500 hover:text-gray-800'}`}>{disabled&&<LockKeyhole className="h-3.5 w-3.5" aria-hidden="true"/>}{icon}{label}</button>; }
function FormSection({title,children}:{title:string;children:ReactNode}) { return <fieldset><legend className="mb-3 font-semibold text-gray-950">{title}</legend><div className="grid gap-4 md:grid-cols-2">{children}</div></fieldset>; }
function DiscoverySection({number,title,description,children}:{number:string;title:string;description:string;children:ReactNode}) { return <fieldset className="rounded-xl border border-gray-200 p-4"><legend className="px-2 font-semibold text-gray-950"><span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs text-blue-800">{number}</span>{title}</legend><p className="mb-4 mt-1 text-sm text-gray-600">{description}</p><div className="grid gap-4 md:grid-cols-2">{children}</div></fieldset>; }
function Field({label,value,set,required,type='text',className=''}:{label:string;value:string;set:(value:string)=>void;required?:boolean;type?:string;className?:string}) {
  if (label === 'City') return <CitySearchSelect value={value} set={set} className={className}/>;
  if (label === 'State') return <Select label={label} value={value || 'AZ'} set={set} options={arizonaStateOptions} className={className}/>;
  if (label === 'Budget expectation') return <Select label={label} value={value} set={set} options={budgetOptions} className={className}/>;
  if (label === 'Desired timing') return <Select label={label} value={value} set={set} options={timingOptions} className={className}/>;
  return <label className={`text-sm font-medium text-gray-800 ${className}`}>{label}<input type={type} required={required} value={value} onChange={(event)=>set(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2"/></label>;
}
function Area({label,value,set,className=''}:{label:string;value:string;set:(value:string)=>void;className?:string}) {
  const options = label === 'What would the client like to create or change?' ? projectVisionOptions : label === 'What should the finished project accomplish?' ? projectObjectiveOptions : label === 'Preliminary features or scope' ? preliminaryScopeOptions : null;
  if (label === 'Preliminary features or scope') return <DiscoveryChoices label={label} value={value} set={set} options={preliminaryScopeOptions.map((option)=>option.value)} className={className}/>;
  if (options) return <Select label={label} value={value} set={set} options={options} className={className}/>;
  return <label className={`text-sm font-medium text-gray-800 ${className}`}>{label}<textarea rows={3} value={value} onChange={(event)=>set(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2"/></label>;
}
function CitySearchSelect({value,set,className=''}:{value:string;set:(value:string)=>void;className?:string}) { return <label className={`block text-sm font-medium text-gray-800 ${className}`}>City<input list="arizona-cities" value={value} onChange={(event)=>set(event.target.value)} placeholder="Search Arizona cities" className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2"/><datalist id="arizona-cities">{arizonaCities.map((city)=><option key={city} value={city}/>)}</datalist></label>; }
function ChannelSelect({value,set}:{value:string;set:(value:string)=>void}) { return <label className="block text-sm font-medium text-gray-800">Original Incoming Contact Channel<select value={value} onChange={(event)=>set(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2"><option value="">Select contact channel</option>{sourceOptions.map((option)=><option key={option} value={option}>{option.replace(/_/g,' ')}</option>)}</select></label>; }
function Select({label,value,set,options,required,className=''}:{label:string;value:string;set:(value:string)=>void;options:Array<{value:string;label:string}>;required?:boolean;className?:string}) { return <label className={`block text-sm font-medium text-gray-800 ${className}`}>{label}<select required={required} value={value} onChange={(event)=>set(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2"><option value="">Select {label.toLowerCase()}</option>{options.map((option)=><option key={option.value} value={option.value}>{option.label}</option>)}</select></label>; }
function DiscoverySelect({label,value,set,options,required}:{label:string;value:string;set:(value:string)=>void;options:string[];required?:boolean}) {
  const selectOptions = value && !options.includes(value) ? [value, ...options] : options;
  return <label className="block text-sm font-medium text-gray-800">{label}{required?' *':''}<select required={required} value={value} onChange={(event)=>set(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2"><option value="">Select an answer</option>{selectOptions.map((option)=><option key={option} value={option}>{option===value&&!options.includes(option)?`Current response: ${option}`:option}</option>)}</select></label>;
}
function DiscoveryChoices({label,value,set,options,required=false,className=''}:{label:string;value:string;set:(value:string)=>void;options:string[];required?:boolean;className?:string}) {
  const selected = value.split(',').map((item)=>item.trim()).filter(Boolean);
  const toggle = (option:string) => set(selected.includes(option) ? selected.filter((item)=>item!==option).join(', ') : [...selected,option].join(', '));
  const extraValues = selected.filter((item)=>!options.includes(item));
  return <fieldset className={`rounded-lg border border-gray-200 bg-gray-50 p-3 ${className}`}><legend className="px-1 text-sm font-medium text-gray-800">{label}{required?' *':''}</legend><p className="mb-2 text-xs text-gray-500">Choose all that apply.</p><div className="flex flex-wrap gap-2">{options.map((option)=><button type="button" key={option} aria-pressed={selected.includes(option)} onClick={()=>toggle(option)} className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${selected.includes(option)?'border-blue-600 bg-blue-600 text-white':'border-gray-300 bg-white text-gray-700 hover:border-blue-400 hover:text-blue-700'}`}>{selected.includes(option)?'✓ ':'+ '}{option}</button>)}</div>{extraValues.length>0&&<p className="mt-2 text-xs text-gray-500">Existing response: {extraValues.join(', ')}</p>}</fieldset>;
}
function ShortAnswer({label,value,set,className=''}:{label:string;value:string;set:(value:string)=>void;className?:string}) { return <label className={`block text-sm font-medium text-gray-800 ${className}`}>{label}<input value={value} onChange={(event)=>set(event.target.value)} placeholder="Add a brief note" className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2"/></label>; }
function Detail({label,value,preliminary=false}:{label:string;value?:string|null;preliminary?:boolean}) { return <div className="rounded-lg bg-gray-50 p-3"><div className="flex items-center gap-2"><p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>{preliminary&&<span className="rounded bg-white px-1.5 py-0.5 text-[10px] font-semibold text-gray-500">PRELIMINARY</span>}</div><p className="mt-1 text-sm text-gray-900">{value||'Not captured'}</p></div>; }
function Metric({label,value}:{label:string;value:number}) { return <div className="rounded-lg border border-gray-200 p-4"><p className="text-sm font-semibold">{label}</p><p className="mt-2 text-2xl font-bold text-gray-950">{value}</p><p className="mt-1 text-xs text-gray-500">Linked to this inquiry</p></div>; }
function ReadinessItem({label,complete,preliminary=false}:{label:string;complete:boolean;preliminary?:boolean}) { return <div className="flex items-center gap-3 rounded-lg border border-gray-200 p-3">{complete?<CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600"/>:<AlertCircle className="h-5 w-5 shrink-0 text-amber-600"/>}<div><p className="text-sm font-medium text-gray-900">{label}</p><p className="text-xs text-gray-500">{complete?(preliminary?'Captured as an early expectation':'Captured'):'Needs information'}</p></div></div>; }

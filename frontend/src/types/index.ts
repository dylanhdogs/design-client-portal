export interface User {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'CLIENT';
  active: boolean;
  clientId?: string | null;
  createdAt: string;
}

export interface Client {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  _count?: {
    consultations: number;
    documents: number;
    communications: number;
  };
  consultations?: Consultation[];
  documents?: Document[];
  communications?: Communication[];
  inquiries?: Array<{ id: string; projectId: string | null; qualificationStatus: string; convertedAt: string | null }>;
  poolProject?: PoolProject | null;
}

export interface Consultation {
  id: string;
  clientId: string;
  userId: string;
  title: string;
  date: string;
  notes: string | null;
  status: string;
  inquiryId?: string | null;
  outcome?: string | null;
  createdAt: string;
  updatedAt: string;
  user?: { name: string };
}

export interface Document {
  id: string;
  clientId: string;
  consultationId: string | null;
  userId: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  description: string | null;
  createdAt: string;
  user?: { name: string };
  consultation?: { title: string } | null;
}

export interface Communication {
  id: string;
  clientId: string;
  userId: string;
  type: string;
  subject: string | null;
  body: string;
  direction: string;
  date: string;
  createdAt: string;
  user?: { name: string };
}

export interface PoolProject {
  id: string;
  clientId: string;
  poolType: string | null;
  poolShape: string | null;
  dimensions: string | null;
  estimatedBudget: string | null;
  notes: string | null;
  currentPhase: number;
  status: string;
  workflowEnabled?: boolean;
  currentLifecycleStage?: string | null;
  workflowVersion?: number;
  createdAt: string;
  updatedAt: string;
  phases?: ProjectPhase[];
  poolNotes?: PoolNote[];
}

export interface LifecycleStage {
  id: string;
  projectId: string;
  stage: string;
  status: string;
  ownerId: string | null;
  reviewerId: string | null;
  startedAt: string | null;
  completedAt: string | null;
}

export interface WorkItem {
  id: string;
  projectId: string | null;
  inquiryId?: string | null;
  stage: string;
  type: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  ownerId: string | null;
  reviewerId: string | null;
  dueAt: string | null;
  clientVisible: boolean;
  owner?: { id: string; name: string } | null;
  reviewer?: { id: string; name: string } | null;
}

export interface Decision {
  id: string;
  projectId: string;
  stage: string;
  title: string;
  description: string | null;
  optionsJson: string | null;
  selectedOption: string | null;
  status: string;
  dueAt: string | null;
  decisionMaker?: { id: string; name: string } | null;
}

export interface ProjectGate {
  id: string;
  fromStage: string;
  toStage: string;
  status: string;
  blockerCount: number;
}

export interface GateBlocker {
  type: string;
  id: string;
  title: string;
  status: string;
}

export interface ProjectAssignment {
  id: string;
  scope: string;
  userId: string;
  user: Pick<User, 'id' | 'name' | 'email' | 'role'>;
}

export interface CommandCenter {
  project: PoolProject;
  client: { id: string; name: string };
  receptionInquiry?: { id: string } | null;
  lifecycle: LifecycleStage[];
  legacyPhases: ProjectPhase[];
  currentGate: ProjectGate | null;
  blockers: GateBlocker[];
  openWorkItems: WorkItem[];
  pendingDecisions: Decision[];
  assignments: ProjectAssignment[];
  recentActivity: Array<{
    id: string;
    action: string;
    entityType: string;
    createdAt: string;
    user: { name: string; role: string };
  }>;
}

export interface Property {
  id: string;
  clientId: string;
  address: string;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  jurisdiction: string | null;
  hoaName: string | null;
}

export interface Inquiry {
  id: string;
  clientId: string;
  propertyId: string | null;
  projectId: string | null;
  source: string | null;
  referralName: string | null;
  description: string | null;
  objectives: string | null;
  preliminaryScope: string | null;
  designInspirations: string | null;
  budgetExpectation: string | null;
  desiredTiming: string | null;
  discovery: PoolDiscovery | null;
  discoveryCompletedAt: string | null;
  siteAssessment: string | null;
  romAmount: string | null;
  proposalNarrative: string | null;
  proposalProvidedAt: string | null;
  proposalClientResponse: string | null;
  handoffApprovedAt: string | null;
  qualificationStatus: string;
  ownerId: string | null;
  nextAction: string | null;
  nextActionDueAt: string | null;
  declineReason: string | null;
  createdAt: string;
  client: Pick<Client, 'id' | 'name' | 'email' | 'phone'>;
  property: Property | null;
  owner?: Pick<User, 'id' | 'name' | 'email'> | null;
  consultations?: Consultation[];
  documents?: Document[];
  workItems?: WorkItem[];
  project?: PoolProject | null;
}

export interface PoolDiscovery {
  projectType: string;
  primaryUse: string;
  householdUsers: string;
  decisionMakers: string;
  propertyAccess: string;
  siteConditions: string;
  utilities: string;
  hoaRequirements: string;
  surveyStatus: string;
  poolSize: string;
  depthProfile: string;
  stylePreferences: string;
  mustHaveFeatures: string;
  deckingOutdoorScope: string;
  equipmentPreferences: string;
  heatingPreference: string;
  budgetRange: string;
  targetCompletion: string;
  priorityTradeoffs: string;
  knownConcerns: string;
  representativeNotes: string;
}

export interface ClientStatusReportAction {
  id: string;
  sourceType: string;
  title: string;
  description: string | null;
  responsibility: 'CLIENT' | 'INTERNAL' | 'EXTERNAL' | 'LEADERSHIP';
  owner: string | null;
  reviewer: string | null;
  status: string;
  priority: string;
  dueAt: string | null;
  overdueDays: number | null;
  stage: string | null;
  costImpactCents: number | null;
  scheduleImpactDays: number | null;
  sourcePath: string;
}

export interface ClientStatusSnapshot {
  schemaVersion: 1;
  report: { clientId: string; projectId: string | null; inquiryId: string | null; asOfDate: string; displayTimeZone: string; generatedAt: string };
  client: { name: string; company: string | null; status: string; property: string | null };
  context: { objective: string | null; description: string | null; preliminaryScope: string | null; budgetExpectation: string | null; desiredTiming: string | null };
  executiveStatus: { state: 'ON_TRACK' | 'ATTENTION_REQUIRED' | 'BLOCKED' | 'NO_ACTIVE_WORK'; summary: string; reasons: string[]; nextMilestone: string | null };
  currentStage: { stage: string; status: string; owner: string | null; gateStatus: string | null; canAdvance: boolean; blockerCount: number };
  completedRecently: Array<{ id: string; sourceType: string; occurredAt: string; actor: string | null; eventType: string; description: string; sourcePath: string }>;
  actions: ClientStatusReportAction[];
  decisions: Array<{ id: string; title: string; status: string; decisionMaker: string | null; requestedAt: string; dueAt: string | null; decidedAt: string | null; result: string | null; costImpact: number | null; scheduleImpact: string | null; sourcePath: string }>;
  risks: Array<{ id: string; sourceType: string; severity: 'HIGH' | 'MEDIUM' | 'LOW'; category: string; reason: string; owner: string | null; dueAt: string | null; mitigation: string | null; blocksAdvancement: boolean; sourcePath: string }>;
  nextActions: ClientStatusReportAction[];
  warnings: string[];
  sourceSummary: { total: number; byType: Record<string, number>; sourceFingerprint: string; sourceWatermark: string };
}

export interface ClientStatusReport {
  id: string;
  clientId: string;
  projectId: string | null;
  inquiryId: string | null;
  asOfDate: string;
  displayTimeZone: string;
  generatedAt: string;
  generatedBy: string;
  generator?: { id: string; name: string; email: string };
  sourceFingerprint: string;
  generationMode: 'FACTS_ONLY' | 'AI_ASSISTED';
  overallState: ClientStatusSnapshot['executiveStatus']['state'];
  status: string;
  warningSummary: string | null;
  snapshot: ClientStatusSnapshot;
  stale: boolean;
  reused?: boolean;
}

export interface DesignVersion {
  id: string;
  projectId: string;
  versionNumber: number;
  status: string;
  summary: string;
  requirements: string | null;
  siteInformation: string | null;
  changeSummary: string | null;
  materialChange: boolean;
  costImpact: string | number | null;
  currency: string;
  scheduleImpact: string | null;
  createdAt: string;
  approvedAt: string | null;
  creator?: { name: string };
  approver?: { name: string } | null;
  evidenceLinks?: Array<{ id: string; document: Document; purpose: string }>;
}

export interface ScopeVersion {
  id: string;
  projectId: string;
  versionNumber: number;
  status: string;
  inclusions: string;
  exclusions: string | null;
  allowances: string | null;
  estimateAmount: string | number | null;
  currency: string;
  changeSummary: string | null;
  materialChange: boolean;
  scheduleImpact: string | null;
  createdAt: string;
  approvedAt: string | null;
  creator?: { name: string };
  approver?: { name: string } | null;
  evidenceLinks?: Array<{ id: string; document: Document; purpose: string }>;
}

export interface DesignWorkspace {
  project: { id: string; clientId: string; currentLifecycleStage: string | null };
  client: { id: string; name: string };
  inquiry: Inquiry | null;
  properties: Property[];
  designVersions: DesignVersion[];
  scopeVersions: ScopeVersion[];
  outstandingQuestions: WorkItem[];
  evidence: Array<{ id: string; document: Document; purpose: string }>;
  decisions: Decision[];
}

export interface ComplianceException {
  id: string;
  requirementId: string;
  reason: string;
  risk: string;
  mitigation: string;
  ownerId: string;
  dueAt: string;
  status: string;
  approvedAt: string | null;
}

export interface ComplianceRequirement {
  id: string;
  projectId: string;
  propertyId: string | null;
  category: string;
  description: string;
  jurisdiction: string | null;
  externalAgency: string | null;
  required: boolean;
  status: string;
  ownerId: string | null;
  reviewerId: string | null;
  dueAt: string | null;
  submittedAt: string | null;
  externalResponseAt: string | null;
  evidenceRequired: boolean;
  clientVisible: boolean;
  rejectionReason: string | null;
  property?: Property | null;
  owner?: Pick<User, 'id' | 'name'> | null;
  reviewer?: Pick<User, 'id' | 'name'> | null;
  evidenceLinks: Array<{ id: string; purpose: string; document: Document }>;
  exceptions: ComplianceException[];
}

export interface ComplianceWorkspace {
  project: { id: string; clientId: string; currentLifecycleStage: string | null };
  client: { id: string; name: string };
  requirements: ComplianceRequirement[];
}

export interface ReadinessException {
  id: string; itemId: string; reason: string; risk: string; mitigation: string; ownerId: string;
  dueAt: string; highRisk: boolean; status: string; approvedAt: string | null;
}

export interface PreconstructionItem {
  id: string; projectId: string; category: string; title: string; details: string | null; status: string;
  required: boolean; ownerId: string | null; reviewerId: string | null; dueAt: string | null; clientVisible: boolean;
  responsibilityParty: string | null; costCode: string | null; amountCents: number | null; allowanceCents: number | null;
  currencyCode: string; startAt: string | null; endAt: string | null; longLead: boolean; sourceReference: string | null;
  targetReference: string | null; completedAt: string | null; verifiedAt: string | null;
  owner?: Pick<User, 'id' | 'name'> | null; reviewer?: Pick<User, 'id' | 'name'> | null; exceptions: ReadinessException[];
  evidenceLinks?: Array<{ id: string; purpose: string; document: Document }>;
}

export interface ReadinessReview {
  id: string; projectId: string; reviewerId: string; status: string; checklistJson: string; blockerCount: number;
  exceptionCount: number; score: number; result: string | null; submittedAt: string | null; reviewedAt: string | null;
  createdAt: string; reviewer?: Pick<User, 'id' | 'name'>;
}

export interface PreconstructionWorkspace {
  project: { id: string; clientId: string; currentLifecycleStage: string | null };
  client: { id: string; name: string };
  items: PreconstructionItem[];
  reviews: ReadinessReview[];
  assignments: ProjectAssignment[];
  readiness: { score: number; blockers: GateBlocker[]; exceptionCount: number } | null;
}

export interface Vendor { id:string; name:string; contactName:string|null; email:string|null; phone:string|null; category:string; complianceStatus:string; active:boolean; }
export interface Quote { id:string; vendorId:string; amountCents:number; taxCents:number; totalCents:number; currencyCode:string; scope:string; validUntil:string|null; leadTimeDays:number|null; status:string; vendor:Vendor; }
export interface Delivery { id:string; expectedAt:string|null; receivedAt:string|null; quantityReceived:number; condition:string; inspectionStatus:string; inspectionNotes:string|null; inspectedAt:string|null; }
export interface InvoiceMatch { id:string; invoiceReference:string; orderedAmountCents:number; deliveredAmountCents:number; invoicedAmountCents:number; varianceAmountCents:number; orderedQuantity:number; deliveredQuantity:number; currencyCode:string; status:string; }
export interface Substitution { id:string; originalSpecification:string; proposedSpecification:string; reason:string; costImpactCents:number; scheduleImpactDays:number; currencyCode:string; status:string; clientAuthorizationRequired:boolean; approvedAt:string|null; clientAuthorizedAt:string|null; }
export interface PurchaseOrder { id:string; orderNumber:string; approvedAmountCents:number; currencyCode:string; costCode:string|null; status:string; issuedAt:string; vendor:Vendor; deliveries:Delivery[]; invoiceMatches:InvoiceMatch[]; }
export interface ProcurementRequest { id:string; projectId:string; description:string; specification:string; quantity:number; unit:string; requiredBy:string; estimatedCostCents:number|null; currencyCode:string; costCode:string|null; required:boolean; status:string; ownerId:string|null; clientVisible:boolean; selectedQuoteId:string|null; closedAt:string|null; owner?:Pick<User,'id'|'name'>|null; selectedQuote?:Quote|null; quotes?:Quote[]; purchaseOrder?:PurchaseOrder|null; substitutions:Substitution[]; }
export interface ProcurementWorkspace { project:{id:string;clientId:string;currentLifecycleStage:string|null;status:string}; client:{id:string;name:string}; requests:ProcurementRequest[]; vendors:Vendor[]; gate:ProjectGate|null; blockers:GateBlocker[]; }

export interface NotificationTrigger {
  trigger: string; type: string; recipients: string; delivery: readonly string[];
}
export interface AutomationSuggestion {
  id: string; projectId: string | null; inquiryId: string | null; type: string; sourceEntityType: string;
  sourceEntityId: string; title: string; suggestionJson: string; rationale: string; status: string;
  reviewedBy: string | null; reviewedAt: string | null; reviewComment: string | null; createdAt: string;
}
export interface NotificationDelivery {
  id: string; channel: string; destination: string; status: string; attemptCount: number; lastAttemptAt: string | null;
  nextAttemptAt: string | null; sentAt: string | null; lastError: string | null; notification: Notification;
}
export interface ManagementDashboard {
  generatedAt: string;
  overview: { activeProjects:number; openWorkItems:number; pendingDecisions:number; gateBlockers:number; automationFailures:number };
  stageAging: Array<{ projectId:string; client:string; stage:string; status:string; ageDays:number|null }>;
  blockers: { workItems:number; overdueWorkItems:number; pendingDecisions:number; blockedGates:number; compliance:number; readiness:number; procurement:number };
  compliance: { total:number; required:number; approved:number; overdue:number; evidenceMissing:number; byStatus:Record<string,number> };
  readiness: { latestReviews:number; passRate:number; averageScore:number; openExceptions:number };
  procurement: { requests:number; openRequests:number; ordered:number; onTimeDeliveryRate:number; inspectionExceptionRate:number; amountVariances:number; totalVarianceCents:number; substitutions:number };
  clientExperience: { medianInquiryAcknowledgmentMinutes:number|null; openClientActions:number; overdueClientActions:number; onTimeActionRate:number; pendingClientDecisions:number; communicationsLast30Days:number; satisfaction:number|null };
  automation: { runs:number; failedRuns:number; partialRuns:number; pendingSuggestions:number; acceptedSuggestions:number; rejectedSuggestions:number; failedDeliveries:number; pendingDeliveries:number; sentDeliveries:number; openOperationalAlerts:number };
}

export interface ProjectPhase {
  id: string;
  projectId: string;
  name: string;
  displayName: string;
  order: number;
  status: string;
  description: string | null;
  startDate: string | null;
  completedDate: string | null;
  createdAt: string;
  updatedAt: string;
  checklistItems?: ChecklistItem[];
}

export interface ChecklistItem {
  id: string;
  phaseId: string;
  description: string;
  isCompleted: boolean;
  completedAt: string | null;
  completedBy: string | null;
  verificationStatus: 'NOT_SUBMITTED' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  submittedAt: string | null;
  submittedBy: string | null;
  verifiedAt: string | null;
  verifiedBy: string | null;
  rejectionReason: string | null;
  order: number;
  createdAt: string;
}

export interface PoolNote {
  id: string;
  projectId: string;
  userId: string;
  content: string;
  createdAt: string;
  user?: { name: string; role: string };
}

export interface Notification {
  id: string;
  userId: string;
  type: 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'REMINDER' | string;
  message: string;
  clientId: string | null;
  phaseId: string | null;
  itemId: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'STAFF' | 'CLIENT';
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
  _count?: {
    consultations: number;
    documents: number;
    communications: number;
  };
  consultations?: Consultation[];
  documents?: Document[];
  communications?: Communication[];
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
  createdAt: string;
  updatedAt: string;
  phases?: ProjectPhase[];
  poolNotes?: PoolNote[];
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

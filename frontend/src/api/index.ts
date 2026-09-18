import axios from 'axios';
import { Client, ClientStatusReport, Consultation, Communication } from '../types';

export const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export const getApiErrorMessage = (error: any, fallback: string): string => {
  const payload = error?.response?.data?.error;
  if (typeof payload === 'string') return payload;
  if (payload?.fieldErrors && typeof payload.fieldErrors === 'object') {
    const firstFieldMessage = Object.values(payload.fieldErrors)
      .flatMap((messages) => Array.isArray(messages) ? messages : [])
      .find((message): message is string => typeof message === 'string' && message.length > 0);
    if (firstFieldMessage) return firstFieldMessage;
  }
  if (payload && typeof payload.message === 'string') return payload.message;
  return fallback;
};

/** Convert a browser datetime-local value to an unambiguous UTC timestamp. */
export const toIsoDateTime = (value: string | null | undefined): string | null | undefined => {
  if (!value) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
};

const getApiUrl = (path: string) => {
  const base = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
  return `${base}${path}`;
};

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

const readCookie = (name: string): string | undefined => document.cookie
  .split('; ')
  .find((part) => part.startsWith(`${name}=`))
  ?.slice(name.length + 1);

api.interceptors.request.use((config) => {
  const method = (config.method || 'get').toUpperCase();
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const csrfToken = readCookie('portal_csrf');
    if (csrfToken) config.headers['X-CSRF-Token'] = decodeURIComponent(csrfToken);
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const requestUrl = String(error.config?.url || '');
    if (error.response?.status === 401 && !requestUrl.endsWith('/auth/me') && !requestUrl.endsWith('/auth/login') && window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;

export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  logout: () => api.post('/auth/logout'),
  register: (data: { email: string; password: string; name: string; role: string }) =>
    api.post('/auth/register', data),
  me: () => api.get('/auth/me'),
  getUsers: () => api.get('/auth/users'),
  resetUserPassword: (userId: string, newPassword: string) =>
    api.put(`/auth/users/${userId}/password`, { newPassword }),
  updateUserAccess: (userId: string, active: boolean) =>
    api.put(`/auth/users/${userId}/access`, { active }),
  updateProfile: (data: { name?: string; email?: string; currentPassword?: string; newPassword?: string }) =>
    api.put('/auth/me', data),
  forgotPassword: (email: string) =>
    api.post('/auth/forgot-password', { email }),
  resetPassword: (token: string, newPassword: string) =>
    api.post('/auth/reset-password', { token, newPassword })
};

export interface PublicPortalConfig {
  privacyNoticeUrl: string | null;
  supportEmail: string | null;
  passwordResetMode: 'administrator' | 'development-link';
}

export const publicApi = {
  getConfig: () => api.get<PublicPortalConfig>('/public/config'),
};

export const clientApi = {
  getAll: (params?: { status?: string; search?: string; archived?: boolean }) =>
    api.get('/clients', { params }),
  getById: (id: string) => api.get(`/clients/${id}`),
  create: (data: Partial<Client>) => api.post('/clients', data),
  update: (id: string, data: Partial<Client>) => api.put(`/clients/${id}`, data),
  delete: (id: string) => api.delete(`/clients/${id}`),
  restore: (id: string) => api.post(`/clients/${id}/restore`),
};

export const consultationApi = {
  getAll: (clientId: string) => api.get(`/clients/${clientId}/consultations`),
  create: (clientId: string, data: Partial<Consultation>) =>
    api.post(`/clients/${clientId}/consultations`, data),
  update: (clientId: string, id: string, data: Partial<Consultation>) =>
    api.put(`/clients/${clientId}/consultations/${id}`, data),
  delete: (clientId: string, id: string) => api.delete(`/clients/${clientId}/consultations/${id}`)
};

const getFileUrl = (path: string) => {
  const base = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
  return `${base}${path}`;
};

export const documentApi = {
  getAll: (clientId: string) => api.get(`/clients/${clientId}/documents`),
  create: (clientId: string, formData: FormData) =>
    api.post(`/clients/${clientId}/documents`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }),
  update: (clientId: string, id: string, data: { description?: string }) =>
    api.put(`/clients/${clientId}/documents/${id}`, data),
  delete: (clientId: string, id: string) =>
    api.delete(`/clients/${clientId}/documents/${id}`),
  download: async (clientId: string, id: string, filename: string) => {
    const response = await fetch(getApiUrl(`/clients/${clientId}/documents/${id}/download`), {
      credentials: 'include'
    });
    if (!response.ok) throw new Error('Download failed');
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },
  getViewBlob: async (id: string): Promise<{ blob: Blob; url: string }> => {
    const response = await fetch(getFileUrl(`/files/${id}`), {
      credentials: 'include'
    });
    if (!response.ok) throw new Error('Failed to load file');
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    return { blob, url };
  }
};

export const communicationApi = {
  getAll: (clientId: string) => api.get(`/clients/${clientId}/communications`),
  create: (clientId: string, data: Partial<Communication>) =>
    api.post(`/clients/${clientId}/communications`, data),
  delete: (clientId: string, id: string) => api.delete(`/clients/${clientId}/communications/${id}`)
};

// Pool Project API
export const poolProjectApi = {
  getMyProject: () => api.get('/my-project'),
  getByClientId: (clientId: string) => api.get(`/clients/${clientId}/project`),
  create: (clientId: string, data: {
    poolType?: string;
    poolShape?: string;
    dimensions?: string;
    estimatedBudget?: string;
    notes?: string;
  }) => api.post(`/clients/${clientId}/project`, data),
  update: (clientId: string, data: {
    poolType?: string;
    poolShape?: string;
    dimensions?: string;
    estimatedBudget?: string;
    notes?: string;
    currentPhase?: number;
    status?: string;
  }) => api.put(`/clients/${clientId}/project`, data)
};

// Phase API
export const phaseApi = {
  getAll: (clientId: string) => api.get(`/clients/${clientId}/project/phases`),
  update: (clientId: string, phaseId: string, data: {
    status: string;
    startDate?: string;
    completedDate?: string;
  }) => api.put(`/clients/${clientId}/project/phases/${phaseId}`, data),
  updateChecklist: (clientId: string, phaseId: string, itemId: string, data: {
    isCompleted: boolean;
  }) => api.put(`/clients/${clientId}/project/phases/${phaseId}/checklist/${itemId}`, data),
  submitChecklist: (clientId: string, phaseId: string, itemId: string) =>
    api.post(`/clients/${clientId}/project/phases/${phaseId}/checklist/${itemId}/submit`),
  verifyChecklist: (clientId: string, phaseId: string, itemId: string, data: {
    approved: boolean;
    rejectionReason?: string;
  }) => api.put(`/clients/${clientId}/project/phases/${phaseId}/checklist/${itemId}/verify`, data)
};

// Pool Notes API
export const poolNoteApi = {
  getAll: (clientId: string) => api.get(`/clients/${clientId}/project/notes`),
  create: (clientId: string, data: { content: string }) =>
    api.post(`/clients/${clientId}/project/notes`, data),
  delete: (clientId: string, noteId: string) =>
    api.delete(`/clients/${clientId}/project/notes/${noteId}`)
};

// Client User API
export const clientUserApi = {
  createLogin: (clientId: string, data: { email: string; password: string; name: string }) =>
    api.post(`/clients/${clientId}/create-login`, data),
  getLoginInfo: (clientId: string) => api.get(`/clients/${clientId}/login-info`),
  invite: (clientId: string, data: { email: string }) =>
    api.post(`/clients/${clientId}/invite`, data),
  checkInvite: (token: string) => api.get(`/invite/${token}`),
  acceptInvite: (token: string, data: { name: string; password: string }) =>
    api.post(`/invite/${token}/accept`, data)
};

export const notificationApi = {
  getAll: () => api.get('/notifications'),
  getUnreadCount: () => api.get('/notifications/unread-count'),
  markRead: (id: string) => api.put(`/notifications/${id}/read`),
  markAllRead: () => api.put('/notifications/read-all')
};

export const workflowApi = {
  getCommandCenter: (projectId: string) => api.get(`/projects/${projectId}/command-center`),
  createWorkItem: (projectId: string, data: Record<string, unknown>) => api.post(`/projects/${projectId}/work-items`, data),
  updateWorkItem: (id: string, data: Record<string, unknown>) => api.put(`/work-items/${id}`, data),
  completeWorkItem: (id: string) => api.post(`/work-items/${id}/complete`),
  verifyWorkItem: (id: string) => api.post(`/work-items/${id}/verify`),
  createDecision: (projectId: string, data: Record<string, unknown>) => api.post(`/projects/${projectId}/decisions`, data),
  approveDecision: (id: string, data: Record<string, unknown>) => api.post(`/decisions/${id}/approve`, data),
  rejectDecision: (id: string, data: Record<string, unknown>) => api.post(`/decisions/${id}/reject`, data),
  createAssignment: (projectId: string, data: { userId: string; scope: string }) => api.post(`/projects/${projectId}/assignments`, data),
  removeAssignment: (id: string) => api.delete(`/assignments/${id}`),
  advanceStage: (projectId: string, stage: string, expectedVersion: number) =>
    api.post(`/projects/${projectId}/stages/${stage}/advance`, { expectedVersion, idempotencyKey: crypto.randomUUID() }),
  overrideStage: (projectId: string, stage: string, data: Record<string, unknown>) =>
    api.post(`/projects/${projectId}/stages/${stage}/override`, { ...data, idempotencyKey: crypto.randomUUID() }),
};

export const inquiryApi = {
  list: (params?: { status?: string; ownerId?: string; search?: string; overdue?: boolean }) => api.get('/inquiries', { params }),
  get: (id: string) => api.get(`/inquiries/${id}`),
  downloadPdf: async (id: string, clientName: string) => {
    const response = await fetch(getApiUrl(`/inquiries/${id}/export`), { credentials: 'include' });
    if (!response.ok) throw new Error('Inquiry PDF export failed');
    const blob = await response.blob();
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${clientName.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-reception-intake.pdf`;
    link.click();
    URL.revokeObjectURL(link.href);
  },
  create: (data: Record<string, unknown>) => api.post('/inquiries', data),
  update: (id: string, data: Record<string, unknown>) => api.put(`/inquiries/${id}`, data),
  saveDiscovery: (id: string, discovery: object) => api.put(`/inquiries/${id}`, { discovery }),
  setStatus: (id: string, status: string, reason?: string) => api.post(`/inquiries/${id}/status`, { status, reason }),
  convert: (id: string) => api.post(`/inquiries/${id}/convert`),
  requestInformation: (id: string, data: { title: string; description?: string; dueAt: string }) => api.post(`/inquiries/${id}/missing-information`, data),
};

export const designApi = {
  getWorkspace: (projectId: string) => api.get(`/projects/${projectId}/design`),
  createDesignVersion: (projectId: string, data: Record<string, unknown>) => api.post(`/projects/${projectId}/design-versions`, data),
  createScopeVersion: (projectId: string, data: Record<string, unknown>) => api.post(`/projects/${projectId}/scope-versions`, data),
  submitDesign: (id: string) => api.post(`/design-versions/${id}/submit`),
  submitScope: (id: string) => api.post(`/scope-versions/${id}/submit`),
  approveDesign: (id: string, comment?: string) => api.post(`/design-versions/${id}/approve`, { comment }),
  rejectDesign: (id: string, comment: string) => api.post(`/design-versions/${id}/reject`, { comment }),
  approveScope: (id: string, comment?: string) => api.post(`/scope-versions/${id}/approve`, { comment }),
  rejectScope: (id: string, comment: string) => api.post(`/scope-versions/${id}/reject`, { comment }),
  linkEvidence: (projectId: string, data: Record<string, unknown>) => api.post(`/projects/${projectId}/evidence`, data),
};

export const complianceApi = {
  getWorkspace: (projectId: string) => api.get(`/projects/${projectId}/compliance`),
  createRequirement: (projectId: string, data: Record<string, unknown>) => api.post(`/projects/${projectId}/compliance`, data),
  updateRequirement: (id: string, data: Record<string, unknown>) => api.put(`/compliance/${id}`, data),
  submitRequirement: (id: string) => api.post(`/compliance/${id}/submit`),
  reviewRequirement: (id: string, approved: boolean, reason?: string) => api.post(`/compliance/${id}/review`, { approved, reason }),
  linkEvidence: (id: string, data: { documentId: string; purpose: string }) => api.post(`/compliance/${id}/evidence`, data),
  createException: (id: string, data: Record<string, unknown>) => api.post(`/compliance/${id}/exceptions`, data),
  approveException: (id: string) => api.post(`/compliance-exceptions/${id}/approve`),
};

export const preconstructionApi = {
  getWorkspace: (projectId: string) => api.get(`/projects/${projectId}/preconstruction`),
  createItem: (projectId: string, data: Record<string, unknown>) => api.post(`/projects/${projectId}/preconstruction/items`, data),
  updateItem: (id: string, data: Record<string, unknown>) => api.put(`/preconstruction/items/${id}`, data),
  completeItem: (id: string) => api.post(`/preconstruction/items/${id}/complete`),
  verifyItem: (id: string) => api.post(`/preconstruction/items/${id}/verify`),
  linkEvidence: (id: string, data: { documentId: string; purpose: string }) => api.post(`/preconstruction/items/${id}/evidence`, data),
  createException: (id: string, data: Record<string, unknown>) => api.post(`/preconstruction/items/${id}/exceptions`, data),
  approveException: (id: string) => api.post(`/readiness-exceptions/${id}/approve`),
  createReview: (projectId: string, reviewerId: string) => api.post(`/projects/${projectId}/readiness-review`, { reviewerId }),
  submitReview: (id: string) => api.post(`/readiness-reviews/${id}/submit`),
  approveReview: (id: string) => api.post(`/readiness-reviews/${id}/approve`),
};

export const procurementApi = {
  getWorkspace: (projectId: string) => api.get(`/projects/${projectId}/procurement`),
  getVendors: () => api.get('/vendors'),
  createVendor: (data: Record<string, unknown>) => api.post('/vendors', data),
  updateVendor: (id: string, data: Record<string, unknown>) => api.put(`/vendors/${id}`, data),
  createRequest: (projectId: string, data: Record<string, unknown>) => api.post(`/projects/${projectId}/procurement/requests`, data),
  addQuote: (id: string, data: Record<string, unknown>) => api.post(`/procurement/requests/${id}/quotes`, data),
  selectQuote: (id: string, quoteId: string) => api.post(`/procurement/requests/${id}/select-quote`, { quoteId }),
  createPurchaseOrder: (id: string, orderNumber: string) => api.post(`/procurement/requests/${id}/purchase-order`, { orderNumber }),
  recordDelivery: (purchaseOrderId: string, data: Record<string, unknown>) => api.post(`/procurement/purchase-orders/${purchaseOrderId}/deliveries`, data),
  inspectDelivery: (id: string, passed: boolean, notes?: string) => api.post(`/procurement/deliveries/${id}/inspect`, { passed, notes }),
  markBackorder: (id: string) => api.post(`/procurement/requests/${id}/backorder`),
  createSubstitution: (id: string, data: Record<string, unknown>) => api.post(`/procurement/requests/${id}/substitutions`, data),
  approveSubstitution: (id: string) => api.post(`/procurement/substitutions/${id}/approve`),
  clientAuthorizeSubstitution: (id: string) => api.post(`/procurement/substitutions/${id}/client-authorize`),
  invoiceMatch: (id: string, data: Record<string, unknown>) => api.post(`/procurement/requests/${id}/invoice-match`, data),
  closeRequest: (id: string) => api.post(`/procurement/requests/${id}/close`),
  approveGate: (projectId: string) => api.post(`/projects/${projectId}/procurement/gate/approve`),
};

export const automationApi = {
  run: () => api.post('/automation/run'),
  getNotificationMatrix: () => api.get('/automation/notification-matrix'),
  getSuggestions: (status?: string) => api.get('/automation/suggestions', { params: status ? { status } : undefined }),
  reviewSuggestion: (id: string, data: { decision: 'ACCEPT' | 'REJECT'; comment?: string; createWorkItem?: boolean }) =>
    api.post(`/automation/suggestions/${id}/review`, data),
  getDeliveries: () => api.get('/automation/deliveries'),
  retryDelivery: (id: string) => api.post(`/automation/deliveries/${id}/retry`),
};

export const managementApi = {
  getDashboard: () => api.get('/management/dashboard'),
};

export const clientStatusReportApi = {
  generate: (clientId: string, data: { projectId?: string | null; inquiryId?: string | null; asOfDate: string; forceRefresh?: boolean }) =>
    api.post<ClientStatusReport>(`/clients/${clientId}/status-reports`, { ...data, includeAiNarrative: false }),
  list: (clientId: string) => api.get<{ data: ClientStatusReport[] }>(`/clients/${clientId}/status-reports`),
  get: (clientId: string, reportId: string) => api.get<ClientStatusReport>(`/clients/${clientId}/status-reports/${reportId}`),
  download: async (clientId: string, reportId: string, format: 'pdf' | 'xlsx', clientName: string, asOfDate: string) => {
    const response = await fetch(getApiUrl(`/clients/${clientId}/status-reports/${reportId}/export?format=${format}`), { credentials: 'include' });
    if (!response.ok) throw new Error('Report export failed');
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${clientName.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-status-${asOfDate}.${format}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },
};

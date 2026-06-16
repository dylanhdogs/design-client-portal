import axios from 'axios';
import { Client, Consultation, Communication } from '../types';

export const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
export const UPLOADS_BASE_URL = import.meta.env.VITE_UPLOADS_URL || '/uploads';

const getApiUrl = (path: string) => {
  const base = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
  return `${base}${path}`;
};

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;

export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  register: (data: { email: string; password: string; name: string; role: string }) =>
    api.post('/auth/register', data),
  me: () => api.get('/auth/me'),
  getUsers: () => api.get('/auth/users')
};

export const clientApi = {
  getAll: (params?: { status?: string; search?: string }) =>
    api.get('/clients', { params }),
  getById: (id: string) => api.get(`/clients/${id}`),
  create: (data: Partial<Client>) => api.post('/clients', data),
  update: (id: string, data: Partial<Client>) => api.put(`/clients/${id}`, data),
  delete: (id: string) => api.delete(`/clients/${id}`)
};

export const consultationApi = {
  getAll: (clientId: string) => api.get(`/clients/${clientId}/consultations`),
  create: (clientId: string, data: Partial<Consultation>) =>
    api.post(`/clients/${clientId}/consultations`, data),
  update: (clientId: string, id: string, data: Partial<Consultation>) =>
    api.put(`/clients/${clientId}/consultations/${id}`, data),
  delete: (clientId: string, id: string) => api.delete(`/clients/${clientId}/consultations/${id}`)
};

export const documentApi = {
  getAll: (clientId: string) => api.get(`/clients/${clientId}/documents`),
  create: (clientId: string, formData: FormData) =>
    api.post(`/clients/${clientId}/documents`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }),
  delete: (clientId: string, id: string) =>
    api.delete(`/clients/${clientId}/documents/${id}`),
  download: async (clientId: string, id: string, filename: string) => {
    const token = localStorage.getItem('token');
    const response = await fetch(getApiUrl(`/clients/${clientId}/documents/${id}/download`), {
      headers: {
        'Authorization': `Bearer ${token}`
      }
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
  getLoginInfo: (clientId: string) => api.get(`/clients/${clientId}/login-info`)
};

export const notificationApi = {
  getAll: () => api.get('/notifications'),
  getUnreadCount: () => api.get('/notifications/unread-count'),
  markRead: (id: string) => api.put(`/notifications/${id}/read`),
  markAllRead: () => api.put('/notifications/read-all')
};

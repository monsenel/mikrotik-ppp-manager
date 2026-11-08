import {
  AdminSessionDto,
  AuditLogEntry,
  BulkUserActionDto,
  CreateOrUpdatePppProfileDto,
  CreateOrUpdatePppUserDto,
  DashboardSummaryDto,
  PppActiveSession,
  PppProfile,
  PppUser,
  RouterConnectionConfigDto,
  RouterInfoDto,
} from '../types/mikrotik';

export type AppDataMode = 'demo' | 'live';

let currentMode: AppDataMode = 'demo';

export function setApiClientMode(mode: AppDataMode) {
  currentMode = mode;
}

export function getApiClientMode(): AppDataMode {
  return currentMode;
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-App-Mode': currentMode,
      ...(options?.headers || {}),
    },
  });

  if (!res.ok) {
    let errorMessage = `HTTP ${res.status}`;
    try {
      const errBody = await res.json();
      if (errBody?.error) errorMessage = errBody.error;
    } catch {
      // fallback to status text
    }
    throw new Error(errorMessage);
  }

  return res.json() as Promise<T>;
}

export const mikrotikApi = {
  getSession: () => apiFetch<AdminSessionDto>('/api/auth/session'),
  login: (username: string, password: string) =>
    apiFetch<AdminSessionDto>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  logout: () =>
    apiFetch<{ authenticated: boolean }>('/api/auth/logout', {
      method: 'POST',
    }),

  getDashboardSummary: () => apiFetch<DashboardSummaryDto>('/api/dashboard/summary'),

  getUsers: () => apiFetch<PppUser[]>('/api/ppp/users'),
  getUserById: (id: string) => apiFetch<PppUser>(`/api/ppp/users/${encodeURIComponent(id)}`),
  createUser: (dto: CreateOrUpdatePppUserDto) =>
    apiFetch<PppUser>('/api/ppp/users', {
      method: 'POST',
      body: JSON.stringify(dto),
    }),
  updateUser: (id: string, dto: CreateOrUpdatePppUserDto) =>
    apiFetch<PppUser>(`/api/ppp/users/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(dto),
    }),
  deleteUser: (id: string) =>
    apiFetch<{ deleted: boolean }>(`/api/ppp/users/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),
  enableUser: (id: string) =>
    apiFetch<PppUser>(`/api/ppp/users/${encodeURIComponent(id)}/enable`, {
      method: 'POST',
    }),
  disableUser: (id: string) =>
    apiFetch<PppUser>(`/api/ppp/users/${encodeURIComponent(id)}/disable`, {
      method: 'POST',
    }),
  bulkUserAction: (dto: BulkUserActionDto) =>
    apiFetch<{ affected: number }>('/api/ppp/users/bulk', {
      method: 'POST',
      body: JSON.stringify(dto),
    }),

  getProfiles: () => apiFetch<PppProfile[]>('/api/ppp/profiles'),
  createProfile: (dto: CreateOrUpdatePppProfileDto) =>
    apiFetch<PppProfile>('/api/ppp/profiles', {
      method: 'POST',
      body: JSON.stringify(dto),
    }),
  updateProfile: (id: string, dto: CreateOrUpdatePppProfileDto) =>
    apiFetch<PppProfile>(`/api/ppp/profiles/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(dto),
    }),
  deleteProfile: (id: string) =>
    apiFetch<{ deleted: boolean }>(`/api/ppp/profiles/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  getSessions: () => apiFetch<PppActiveSession[]>('/api/ppp/sessions'),
  disconnectSession: (id: string) =>
    apiFetch<{ disconnected: boolean }>(`/api/ppp/sessions/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),
  disconnectUserSessions: (username: string) =>
    apiFetch<{ disconnected: number }>(
      `/api/ppp/sessions/disconnect-user/${encodeURIComponent(username)}`,
      { method: 'POST' }
    ),

  getRouterConfig: () => apiFetch<RouterConnectionConfigDto>('/api/router/config'),
  updateRouterConfig: (dto: RouterConnectionConfigDto) =>
    apiFetch<RouterConnectionConfigDto>('/api/router/config', {
      method: 'PUT',
      body: JSON.stringify(dto),
    }),
  testRouterConnection: (dto: RouterConnectionConfigDto) =>
    apiFetch<RouterInfoDto>('/api/router/test-connection', {
      method: 'POST',
      body: JSON.stringify(dto),
    }),
  getRouterInfo: () => apiFetch<RouterInfoDto>('/api/router/info'),

  getAuditLogs: () => apiFetch<AuditLogEntry[]>('/api/logs'),
};

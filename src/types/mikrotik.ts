export type PppServiceType = 'any' | 'pppoe' | 'pptp' | 'l2tp' | 'ovpn' | 'sstp';

export type OnlyOneOption = 'default' | 'yes' | 'no';
export type UseEncryptionOption = 'default' | 'yes' | 'no' | 'required';
export type ChangeTcpMssOption = 'default' | 'yes' | 'no';

export interface PppUser {
  id: string; // RouterOS .id (e.g., *1A)
  name: string;
  service: PppServiceType;
  profile: string;
  localAddress: string;
  remoteAddress: string;
  callerId: string;
  routes: string;
  limitBytesIn: number;
  limitBytesOut: number;
  comment: string;
  disabled: boolean;
  lastLoggedOut?: string;
  // Enriched from /ppp/active
  isOnline: boolean;
  activeIp?: string;
  uptime?: string;
  uptimeSeconds?: number;
  activeSessionId?: string;
  activeRowId?: string;
  activeCallerId?: string;
  activeEncoding?: string;
}

export interface CreateOrUpdatePppUserDto {
  name: string;
  password?: string; // Required on create; optional on update (only replaces if non-empty)
  service: PppServiceType;
  profile: string;
  localAddress?: string;
  remoteAddress?: string;
  callerId?: string;
  routes?: string;
  limitBytesIn?: number;
  limitBytesOut?: number;
  comment?: string;
  disabled?: boolean;
}

export interface BulkUserActionDto {
  ids: string[];
  action: 'enable' | 'disable' | 'delete' | 'assign-profile';
  profile?: string;
}

export interface PppProfile {
  id: string; // RouterOS .id
  name: string;
  localAddress: string;
  remoteAddress: string;
  rateLimit: string; // RouterOS format: rx-rate[/tx-rate] [rx-burst-rate[/tx-burst-rate] ...]
  sessionTimeout: string;
  idleTimeout: string;
  onlyOne: OnlyOneOption;
  useEncryption: UseEncryptionOption;
  dnsServer: string;
  changeTcpMss: ChangeTcpMssOption;
  comment: string;
  isDefaultBuiltIn: boolean;
  assignedUserCount: number;
  assignedUsers: string[];
}

export interface CreateOrUpdatePppProfileDto {
  name: string;
  localAddress?: string;
  remoteAddress?: string;
  rateLimit?: string;
  sessionTimeout?: string;
  idleTimeout?: string;
  onlyOne?: OnlyOneOption;
  useEncryption?: UseEncryptionOption;
  dnsServer?: string;
  changeTcpMss?: ChangeTcpMssOption;
  comment?: string;
}

export interface PppActiveSession {
  id: string; // RouterOS .id in /ppp/active
  name: string;
  service: string;
  callerId: string;
  address: string;
  uptime: string;
  uptimeSeconds: number;
  sessionId: string;
  encoding: string;
  limitBytesIn: number;
  limitBytesOut: number;
  relatedSecretId?: string;
  profile?: string;
}

export interface RouterConnectionConfigDto {
  routerDisplayName: string;
  host: string;
  port: number;
  username: string;
  password?: string; // Write-only; never returned in GET
  tlsEnabled: boolean;
  validateCertificate: boolean;
  timeoutMs: number;
  hasPasswordConfigured?: boolean;
}

export interface RouterInfoDto {
  connected: boolean;
  mode: 'live' | 'demo';
  routerDisplayName: string;
  identity: string;
  version: string;
  boardName: string;
  architectureName: string;
  uptime: string;
  cpuLoad: number;
  freeMemoryBytes: number;
  totalMemoryBytes: number;
  host: string;
  port: number;
  tlsEnabled: boolean;
  validateCertificate: boolean;
  lastCheckedAt: string;
  errorMessage?: string;
}

export type AuditActionType =
  | 'USER_CREATED'
  | 'USER_UPDATED'
  | 'USER_DELETED'
  | 'USER_ENABLED'
  | 'USER_DISABLED'
  | 'BULK_USERS_ENABLED'
  | 'BULK_USERS_DISABLED'
  | 'BULK_USERS_DELETED'
  | 'BULK_PROFILE_ASSIGNED'
  | 'PROFILE_CREATED'
  | 'PROFILE_UPDATED'
  | 'PROFILE_DELETED'
  | 'SESSION_DISCONNECTED'
  | 'USER_SESSIONS_DISCONNECTED'
  | 'ROUTER_CONFIG_UPDATED'
  | 'ROUTER_CONNECTION_TESTED'
  | 'ADMIN_LOGIN';

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  administrator: string;
  action: AuditActionType;
  target: string;
  details: string;
  result: 'SUCCESS' | 'FAILURE';
  errorMessage?: string;
  mode: 'live' | 'demo';
}

export interface DashboardSummaryDto {
  totalUsers: number;
  enabledUsers: number;
  disabledUsers: number;
  onlineUsers: number;
  offlineUsers: number;
  totalProfiles: number;
  routerInfo: RouterInfoDto;
  recentActions: AuditLogEntry[];
  recentSessions: PppActiveSession[];
  topSessionsByUptime: PppActiveSession[];
  serviceBreakdown: { service: string; total: number; online: number }[];
  profileBreakdown: { profile: string; count: number; onlineCount: number }[];
}

export interface AdminSessionDto {
  authenticated: boolean;
  username: string;
  role: string;
  csrfToken: string;
}

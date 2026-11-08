import { MikroTikApiClient, MikroTikEndpointConfig } from './mikrotikClient';
import {
  AuditActionType,
  AuditLogEntry,
  BulkUserActionDto,
  CreateOrUpdatePppProfileDto,
  CreateOrUpdatePppUserDto,
  DashboardSummaryDto,
  PppActiveSession,
  PppProfile,
  PppServiceType,
  PppUser,
  RouterConnectionConfigDto,
  RouterInfoDto,
} from '../src/types/mikrotik';
import { parseRouterOsUptimeToSeconds } from '../src/lib/utils';

interface StoredSecretRecord {
  id: string;
  name: string;
  passwordHashNote: string;
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
  lastLoggedOut: string;
}

interface StoredProfileRecord {
  id: string;
  name: string;
  localAddress: string;
  remoteAddress: string;
  rateLimit: string;
  sessionTimeout: string;
  idleTimeout: string;
  onlyOne: 'default' | 'yes' | 'no';
  useEncryption: 'default' | 'yes' | 'no' | 'required';
  dnsServer: string;
  changeTcpMss: 'default' | 'yes' | 'no';
  comment: string;
  isDefaultBuiltIn: boolean;
}

interface StoredActiveSessionRecord {
  id: string;
  name: string;
  service: string;
  callerId: string;
  address: string;
  uptime: string;
  sessionId: string;
  encoding: string;
  limitBytesIn: number;
  limitBytesOut: number;
}

class MikroTikPppService {
  private liveConfig: MikroTikEndpointConfig = {
    routerDisplayName: process.env.MIKROTIK_DISPLAY_NAME || 'Core-BNG-CCR2116-01',
    host: process.env.MIKROTIK_HOST || '',
    port: Number(process.env.MIKROTIK_PORT) || 8729,
    username: process.env.MIKROTIK_USER || 'ppp-api-admin',
    password: process.env.MIKROTIK_PASSWORD || '',
    tlsEnabled: process.env.MIKROTIK_TLS !== 'false',
    validateCertificate: process.env.MIKROTIK_VALIDATE_CERT !== 'false',
    timeoutMs: Number(process.env.MIKROTIK_TIMEOUT_MS) || 8000,
  };

  private auditLogs: AuditLogEntry[] = [
    {
      id: 'AUD-9041',
      timestamp: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
      administrator: 'netops.admin',
      action: 'USER_CREATED',
      target: 'ftth.tehran.104',
      details: 'Created PPPoE secret assigned to profileFiber-50M-20M (Remote IP: 100.64.14.104)',
      result: 'SUCCESS',
      mode: 'demo',
    },
    {
      id: 'AUD-9040',
      timestamp: new Date(Date.now() - 19 * 60 * 1000).toISOString(),
      administrator: 'netops.admin',
      action: 'PROFILE_UPDATED',
      target: 'Fiber-100M-40M',
      details: 'Updated RouterOS rate-limit to 40M/100M (40 Mbps Upload / 100 Mbps Download)',
      result: 'SUCCESS',
      mode: 'demo',
    },
    {
      id: 'AUD-9039',
      timestamp: new Date(Date.now() - 47 * 60 * 1000).toISOString(),
      administrator: 'sec.noc',
      action: 'SESSION_DISCONNECTED',
      target: 'corp.vpn.shiraz',
      details: 'Terminated active L2TP session *8F02 (172.22.10.18) for tunnel maintenance',
      result: 'SUCCESS',
      mode: 'demo',
    },
    {
      id: 'AUD-9038',
      timestamp: new Date(Date.now() - 125 * 60 * 1000).toISOString(),
      administrator: 'netops.admin',
      action: 'USER_DISABLED',
      target: 'pppoe.suspended.09',
      details: 'Administratively disabled PPP secret in /ppp/secret (billing hold)',
      result: 'SUCCESS',
      mode: 'demo',
    },
  ];

  private demoProfiles: StoredProfileRecord[] = [
    {
      id: '*0',
      name: 'default',
      localAddress: '100.64.0.1',
      remoteAddress: 'ppp-pool-standard',
      rateLimit: '',
      sessionTimeout: '',
      idleTimeout: '',
      onlyOne: 'default',
      useEncryption: 'default',
      dnsServer: '1.1.1.1,8.8.8.8',
      changeTcpMss: 'yes',
      comment: 'RouterOS built-in default PPP profile',
      isDefaultBuiltIn: true,
    },
    {
      id: '*FFFFFFFE',
      name: 'default-encryption',
      localAddress: '172.22.0.1',
      remoteAddress: 'vpn-pool-encrypted',
      rateLimit: '',
      sessionTimeout: '1d 00:00:00',
      idleTimeout: '00:30:00',
      onlyOne: 'default',
      useEncryption: 'yes',
      dnsServer: '1.1.1.1,9.9.9.9',
      changeTcpMss: 'yes',
      comment: 'RouterOS built-in encrypted tunnel profile',
      isDefaultBuiltIn: true,
    },
    {
      id: '*P101',
      name: 'Home-ADSL-10M-2M',
      localAddress: '100.64.0.1',
      remoteAddress: 'pool-residential-cgnat',
      rateLimit: '2M/10M',
      sessionTimeout: '1d 00:00:00',
      idleTimeout: '00:15:00',
      onlyOne: 'yes',
      useEncryption: 'no',
      dnsServer: '185.51.200.2,1.1.1.1',
      changeTcpMss: 'yes',
      comment: '10 Mbps Download / 2 Mbps Upload residential tier',
      isDefaultBuiltIn: false,
    },
    {
      id: '*P102',
      name: 'Fiber-50M-20M',
      localAddress: '100.64.14.1',
      remoteAddress: 'pool-ftth-metro',
      rateLimit: '20M/50M',
      sessionTimeout: '7d 00:00:00',
      idleTimeout: '01:00:00',
      onlyOne: 'yes',
      useEncryption: 'default',
      dnsServer: '1.1.1.1,8.8.8.8',
      changeTcpMss: 'yes',
      comment: '50 Mbps Download / 20 Mbps Upload FTTH subscriber profile',
      isDefaultBuiltIn: false,
    },
    {
      id: '*P103',
      name: 'Fiber-100M-40M',
      localAddress: '100.64.20.1',
      remoteAddress: 'pool-ftth-pro',
      rateLimit: '40M/100M',
      sessionTimeout: '14d 00:00:00',
      idleTimeout: '',
      onlyOne: 'yes',
      useEncryption: 'default',
      dnsServer: '1.1.1.1,8.8.4.4',
      changeTcpMss: 'yes',
      comment: '100 Mbps Download / 40 Mbps Upload FTTH Pro tier',
      isDefaultBuiltIn: false,
    },
    {
      id: '*P104',
      name: 'Corp-VPN-Dedicated-20M-10M',
      localAddress: '172.22.10.1',
      remoteAddress: 'pool-corp-static',
      rateLimit: '10M/20M',
      sessionTimeout: '3d 00:00:00',
      idleTimeout: '00:45:00',
      onlyOne: 'no',
      useEncryption: 'required',
      dnsServer: '10.20.0.53,1.1.1.1',
      changeTcpMss: 'yes',
      comment: 'Encrypted corporate branch tunnel — 20 Mbps Down / 10 Mbps Up',
      isDefaultBuiltIn: false,
    },
  ];

  private demoSecrets: StoredSecretRecord[] = [
    {
      id: '*101',
      name: 'ftth.tehran.101',
      passwordHashNote: '[REDACTED-SECRET]',
      service: 'pppoe',
      profile: 'Fiber-100M-40M',
      localAddress: '100.64.20.1',
      remoteAddress: '100.64.20.101',
      callerId: 'DC:2C:6E:4A:11:01',
      routes: '',
      limitBytesIn: 0,
      limitBytesOut: 0,
      comment: 'Valiasr Tower Unit 14 — hAP ax3 ONT',
      disabled: false,
      lastLoggedOut: 'nov/01/2026 04:12:09',
    },
    {
      id: '*102',
      name: 'ftth.tehran.104',
      passwordHashNote: '[REDACTED-SECRET]',
      service: 'pppoe',
      profile: 'Fiber-50M-20M',
      localAddress: '100.64.14.1',
      remoteAddress: '100.64.14.104',
      callerId: 'DC:2C:6E:4A:11:04',
      routes: '',
      limitBytesIn: 0,
      limitBytesOut: 0,
      comment: 'Saadat Abad Block B — Residential FTTH',
      disabled: false,
      lastLoggedOut: 'nov/07/2026 22:08:50',
    },
    {
      id: '*103',
      name: 'corp.vpn.isfahan',
      passwordHashNote: '[REDACTED-SECRET]',
      service: 'sstp',
      profile: 'Corp-VPN-Dedicated-20M-10M',
      localAddress: '172.22.10.1',
      remoteAddress: '172.22.10.14',
      callerId: '185.143.232.40',
      routes: '192.168.40.0/24 172.22.10.14 1',
      limitBytesIn: 0,
      limitBytesOut: 0,
      comment: 'Isfahan Regional Logistics Branch Router (RB5009)',
      disabled: false,
      lastLoggedOut: 'oct/28/2026 01:15:00',
    },
    {
      id: '*104',
      name: 'corp.vpn.shiraz',
      passwordHashNote: '[REDACTED-SECRET]',
      service: 'l2tp',
      profile: 'Corp-VPN-Dedicated-20M-10M',
      localAddress: '172.22.10.1',
      remoteAddress: '172.22.10.18',
      callerId: '91.98.104.212',
      routes: '192.168.55.0/24 172.22.10.18 1',
      limitBytesIn: 536870912000, // 500 GB
      limitBytesOut: 1073741824000, // 1 TB
      comment: 'Shiraz Branch Office L2TP/IPsec site-to-site',
      disabled: false,
      lastLoggedOut: 'nov/08/2026 07:40:12',
    },
    {
      id: '*105',
      name: 'eng.mohsen.remote',
      passwordHashNote: '[REDACTED-SECRET]',
      service: 'ovpn',
      profile: 'default-encryption',
      localAddress: '172.22.0.1',
      remoteAddress: '172.22.0.55',
      callerId: '',
      routes: '',
      limitBytesIn: 0,
      limitBytesOut: 0,
      comment: 'Senior Network Architect OpenVPN TLS access',
      disabled: false,
      lastLoggedOut: 'nov/08/2026 01:19:44',
    },
    {
      id: '*106',
      name: 'adsl.karaj.208',
      passwordHashNote: '[REDACTED-SECRET]',
      service: 'pppoe',
      profile: 'Home-ADSL-10M-2M',
      localAddress: '100.64.0.1',
      remoteAddress: '100.64.2.208',
      callerId: '48:A9:8A:91:00:E2',
      routes: '',
      limitBytesIn: 107374182400, // 100 GB
      limitBytesOut: 322122547200, // 300 GB
      comment: 'Mehrshahr Phase 2 Subscriber',
      disabled: false,
      lastLoggedOut: 'nov/06/2026 19:03:11',
    },
    {
      id: '*107',
      name: 'ftth.tabriz.319',
      passwordHashNote: '[REDACTED-SECRET]',
      service: 'pppoe',
      profile: 'Fiber-50M-20M',
      localAddress: '100.64.14.1',
      remoteAddress: '100.64.14.199',
      callerId: 'C4:AD:34:80:4F:19',
      routes: '',
      limitBytesIn: 0,
      limitBytesOut: 0,
      comment: 'Valiasr Tabriz Commercial Office — Offline CPE',
      disabled: false,
      lastLoggedOut: 'nov/08/2026 06:22:01',
    },
    {
      id: '*108',
      name: 'pppoe.suspended.09',
      passwordHashNote: '[REDACTED-SECRET]',
      service: 'pppoe',
      profile: 'Home-ADSL-10M-2M',
      localAddress: '100.64.0.1',
      remoteAddress: '100.64.3.109',
      callerId: '74:4D:28:11:9A:09',
      routes: '',
      limitBytesIn: 53687091200,
      limitBytesOut: 107374182400,
      comment: 'Suspended due to invoice expiration #INV-4082',
      disabled: true,
      lastLoggedOut: 'oct/30/2026 12:00:00',
    },
    {
      id: '*109',
      name: 'legacy.pptp.telemetry',
      passwordHashNote: '[REDACTED-SECRET]',
      service: 'pptp',
      profile: 'default-encryption',
      localAddress: '172.22.0.1',
      remoteAddress: '172.22.0.210',
      callerId: '5.160.44.19',
      routes: '',
      limitBytesIn: 0,
      limitBytesOut: 0,
      comment: 'Decommissioned substation SCADA link (Disabled)',
      disabled: true,
      lastLoggedOut: 'sep/14/2026 09:30:00',
    },
  ];

  private demoActiveSessions: StoredActiveSessionRecord[] = [
    {
      id: '*8F01',
      name: 'ftth.tehran.101',
      service: 'pppoe',
      callerId: 'DC:2C:6E:4A:11:01',
      address: '100.64.20.101',
      uptime: '1w4d18h42m19s',
      sessionId: '0x804011A1',
      encoding: 'none',
      limitBytesIn: 0,
      limitBytesOut: 0,
    },
    {
      id: '*8F02',
      name: 'corp.vpn.isfahan',
      service: 'sstp',
      callerId: '185.143.232.40',
      address: '172.22.10.14',
      uptime: '6d11h09m45s',
      sessionId: '0x804011B4',
      encoding: 'AES-256-CBC/SHA256',
      limitBytesIn: 0,
      limitBytesOut: 0,
    },
    {
      id: '*8F03',
      name: 'adsl.karaj.208',
      service: 'pppoe',
      callerId: '48:A9:8A:91:00:E2',
      address: '100.64.2.208',
      uptime: '2d07h34m12s',
      sessionId: '0x80401209',
      encoding: 'none',
      limitBytesIn: 107374182400,
      limitBytesOut: 322122547200,
    },
    {
      id: '*8F04',
      name: 'ftth.tehran.104',
      service: 'pppoe',
      callerId: 'DC:2C:6E:4A:11:04',
      address: '100.64.14.104',
      uptime: '14h51m08s',
      sessionId: '0x8040148C',
      encoding: 'none',
      limitBytesIn: 0,
      limitBytesOut: 0,
    },
    {
      id: '*8F05',
      name: 'eng.mohsen.remote',
      service: 'ovpn',
      callerId: '37.156.14.88',
      address: '172.22.0.55',
      uptime: '3h18m52s',
      sessionId: '0x804019F0',
      encoding: 'AES-256-GCM',
      limitBytesIn: 0,
      limitBytesOut: 0,
    },
  ];

  private idCounter = 500;

  public recordAudit(
    action: AuditActionType,
    target: string,
    details: string,
    mode: 'live' | 'demo',
    result: 'SUCCESS' | 'FAILURE' = 'SUCCESS',
    errorMessage?: string,
    administrator = 'netops.admin'
  ) {
    // Enforce strict zero-plaintext password policy in logs
    const sanitizedDetails = details.replace(/password\s*[:=]\s*\S+/gi, 'password=[REDACTED]');
    const entry: AuditLogEntry = {
      id: `AUD-${9042 + this.auditLogs.length}`,
      timestamp: new Date().toISOString(),
      administrator,
      action,
      target,
      details: sanitizedDetails,
      result,
      errorMessage,
      mode,
    };
    this.auditLogs.unshift(entry);
    if (this.auditLogs.length > 250) {
      this.auditLogs.pop();
    }
  }

  public getAuditLogs(): AuditLogEntry[] {
    return this.auditLogs;
  }

  public getRouterConfigSafe(): RouterConnectionConfigDto {
    return {
      routerDisplayName: this.liveConfig.routerDisplayName,
      host: this.liveConfig.host,
      port: this.liveConfig.port,
      username: this.liveConfig.username,
      tlsEnabled: this.liveConfig.tlsEnabled,
      validateCertificate: this.liveConfig.validateCertificate,
      timeoutMs: this.liveConfig.timeoutMs,
      hasPasswordConfigured: Boolean(this.liveConfig.password),
    };
  }

  public updateRouterConfig(dto: RouterConnectionConfigDto, mode: 'live' | 'demo'): RouterConnectionConfigDto {
    this.liveConfig = {
      routerDisplayName: dto.routerDisplayName.trim() || 'MikroTik-RouterOS',
      host: dto.host.trim(),
      port: Number(dto.port) || 8729,
      username: dto.username.trim(),
      password: dto.password && dto.password.trim() ? dto.password : this.liveConfig.password,
      tlsEnabled: Boolean(dto.tlsEnabled),
      validateCertificate: Boolean(dto.validateCertificate),
      timeoutMs: Number(dto.timeoutMs) || 8000,
    };

    this.recordAudit(
      'ROUTER_CONFIG_UPDATED',
      `${this.liveConfig.host || 'unconfigured'}:${this.liveConfig.port}`,
      `Updated RouterOS endpoint (${this.liveConfig.tlsEnabled ? 'API-SSL TLS' : 'API TCP'}, certValidation=${this.liveConfig.validateCertificate})`,
      mode
    );

    return this.getRouterConfigSafe();
  }

  public async getRouterInfo(mode: 'live' | 'demo', overrideConfig?: RouterConnectionConfigDto): Promise<RouterInfoDto> {
    if (mode === 'demo') {
      return {
        connected: true,
        mode: 'demo',
        routerDisplayName: this.liveConfig.routerDisplayName || 'Core-BNG-CCR2116-01',
        identity: 'BNG-TEHRAN-DC1',
        version: '7.16.1 (stable)',
        boardName: 'CCR2116-12G-4S+',
        architectureName: 'arm64',
        uptime: '48d19h14m32s',
        cpuLoad: 14,
        freeMemoryBytes: 14898167808,
        totalMemoryBytes: 17179869184,
        host: this.liveConfig.host || '10.254.0.1 (Demo BNG)',
        port: this.liveConfig.port || 8729,
        tlsEnabled: this.liveConfig.tlsEnabled,
        validateCertificate: this.liveConfig.validateCertificate,
        lastCheckedAt: new Date().toISOString(),
      };
    }

    const cfg: MikroTikEndpointConfig = overrideConfig
      ? {
          routerDisplayName: overrideConfig.routerDisplayName || this.liveConfig.routerDisplayName,
          host: overrideConfig.host,
          port: Number(overrideConfig.port) || 8729,
          username: overrideConfig.username,
          password:
            overrideConfig.password && overrideConfig.password.trim()
              ? overrideConfig.password
              : this.liveConfig.password,
          tlsEnabled: Boolean(overrideConfig.tlsEnabled),
          validateCertificate: Boolean(overrideConfig.validateCertificate),
          timeoutMs: Number(overrideConfig.timeoutMs) || 8000,
        }
      : this.liveConfig;

    if (!cfg.host) {
      return {
        connected: false,
        mode: 'live',
        routerDisplayName: cfg.routerDisplayName,
        identity: 'Unconfigured',
        version: '—',
        boardName: '—',
        architectureName: '—',
        uptime: '—',
        cpuLoad: 0,
        freeMemoryBytes: 0,
        totalMemoryBytes: 0,
        host: '',
        port: cfg.port,
        tlsEnabled: cfg.tlsEnabled,
        validateCertificate: cfg.validateCertificate,
        lastCheckedAt: new Date().toISOString(),
        errorMessage: 'No MikroTik RouterOS IP or hostname configured. Enter router parameters in Router Settings.',
      };
    }

    const client = new MikroTikApiClient(cfg);
    try {
      const [identityRows, resourceRows] = await Promise.all([
        client.executeCommand('/system/identity/print'),
        client.executeCommand('/system/resource/print'),
      ]);

      const identity = identityRows[0]?.['name'] || cfg.routerDisplayName;
      const res = resourceRows[0] || {};

      return {
        connected: true,
        mode: 'live',
        routerDisplayName: cfg.routerDisplayName,
        identity,
        version: res['version'] || 'RouterOS',
        boardName: res['board-name'] || 'MikroTik',
        architectureName: res['architecture-name'] || 'unknown',
        uptime: res['uptime'] || '0s',
        cpuLoad: Number(res['cpu-load'] || 0),
        freeMemoryBytes: Number(res['free-memory'] || 0),
        totalMemoryBytes: Number(res['total-memory'] || 0),
        host: cfg.host,
        port: cfg.port,
        tlsEnabled: cfg.tlsEnabled,
        validateCertificate: cfg.validateCertificate,
        lastCheckedAt: new Date().toISOString(),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Connection failed';
      return {
        connected: false,
        mode: 'live',
        routerDisplayName: cfg.routerDisplayName,
        identity: 'Unreachable',
        version: '—',
        boardName: '—',
        architectureName: '—',
        uptime: '—',
        cpuLoad: 0,
        freeMemoryBytes: 0,
        totalMemoryBytes: 0,
        host: cfg.host,
        port: cfg.port,
        tlsEnabled: cfg.tlsEnabled,
        validateCertificate: cfg.validateCertificate,
        lastCheckedAt: new Date().toISOString(),
        errorMessage: message,
      };
    }
  }

  public async getUsers(mode: 'live' | 'demo'): Promise<PppUser[]> {
    if (mode === 'demo') {
      const activeByName = new Map<string, StoredActiveSessionRecord>();
      for (const s of this.demoActiveSessions) {
        activeByName.set(s.name, s);
      }

      return this.demoSecrets.map((sec) => {
        const active = activeByName.get(sec.name);
        return {
          id: sec.id,
          name: sec.name,
          service: sec.service,
          profile: sec.profile,
          localAddress: sec.localAddress,
          remoteAddress: sec.remoteAddress,
          callerId: sec.callerId,
          routes: sec.routes,
          limitBytesIn: sec.limitBytesIn,
          limitBytesOut: sec.limitBytesOut,
          comment: sec.comment,
          disabled: sec.disabled,
          lastLoggedOut: sec.lastLoggedOut,
          isOnline: Boolean(active),
          activeIp: active?.address,
          uptime: active?.uptime,
          uptimeSeconds: active ? parseRouterOsUptimeToSeconds(active.uptime) : 0,
          activeSessionId: active?.sessionId,
          activeRowId: active?.id,
          activeCallerId: active?.callerId,
          activeEncoding: active?.encoding,
        };
      });
    }

    const client = new MikroTikApiClient(this.liveConfig);
    const [secretsRaw, activeRaw] = await Promise.all([
      client.executeCommand('/ppp/secret/print'),
      client.executeCommand('/ppp/active/print'),
    ]);

    const activeByName = new Map<string, Record<string, string>>();
    for (const act of activeRaw) {
      if (act['name']) {
        activeByName.set(act['name'], act);
      }
    }

    return secretsRaw.map((sec) => {
      const name = sec['name'] || '';
      const active = activeByName.get(name);
      const uptime = active?.['uptime'];
      return {
        id: sec['.id'] || name,
        name,
        service: (sec['service'] as PppServiceType) || 'any',
        profile: sec['profile'] || 'default',
        localAddress: sec['local-address'] || '',
        remoteAddress: sec['remote-address'] || '',
        callerId: sec['caller-id'] || '',
        routes: sec['routes'] || '',
        limitBytesIn: Number(sec['limit-bytes-in'] || 0),
        limitBytesOut: Number(sec['limit-bytes-out'] || 0),
        comment: sec['comment'] || '',
        disabled: sec['disabled'] === 'true' || sec['disabled'] === 'yes',
        lastLoggedOut: sec['last-logged-out'] || '',
        isOnline: Boolean(active),
        activeIp: active?.['address'],
        uptime,
        uptimeSeconds: parseRouterOsUptimeToSeconds(uptime),
        activeSessionId: active?.['session-id'] || active?.['.id'],
        activeRowId: active?.['.id'],
        activeCallerId: active?.['caller-id'],
        activeEncoding: active?.['encoding'],
      };
    });
  }

  public async getUserById(id: string, mode: 'live' | 'demo'): Promise<PppUser | null> {
    const users = await this.getUsers(mode);
    return users.find((u) => u.id === id || u.name === id) || null;
  }

  public async createUser(dto: CreateOrUpdatePppUserDto, mode: 'live' | 'demo'): Promise<PppUser> {
    const name = dto.name.trim();
    if (!name) throw new Error('Username is required.');
    if (!dto.password || !dto.password.trim()) {
      throw new Error('Password is required when creating a new PPP secret.');
    }

    if (mode === 'demo') {
      if (this.demoSecrets.some((s) => s.name.toLowerCase() === name.toLowerCase())) {
        throw new Error(`RouterOS error: failure: secret with the same name '${name}' already exists`);
      }

      const newId = `*${++this.idCounter}`;
      const record: StoredSecretRecord = {
        id: newId,
        name,
        passwordHashNote: '[REDACTED-SECRET]',
        service: dto.service || 'any',
        profile: dto.profile || 'default',
        localAddress: dto.localAddress?.trim() || '',
        remoteAddress: dto.remoteAddress?.trim() || '',
        callerId: dto.callerId?.trim() || '',
        routes: dto.routes?.trim() || '',
        limitBytesIn: Number(dto.limitBytesIn || 0),
        limitBytesOut: Number(dto.limitBytesOut || 0),
        comment: dto.comment?.trim() || '',
        disabled: Boolean(dto.disabled),
        lastLoggedOut: 'never',
      };
      this.demoSecrets.unshift(record);
      this.recordAudit(
        'USER_CREATED',
        name,
        `Created PPP secret (service=${record.service}, profile=${record.profile}, disabled=${record.disabled})`,
        mode
      );
      return (await this.getUserById(newId, mode))!;
    }

    const client = new MikroTikApiClient(this.liveConfig);
    const params: Record<string, string | number | boolean | undefined> = {
      name,
      password: dto.password,
      service: dto.service || 'any',
      profile: dto.profile || 'default',
      disabled: dto.disabled ? 'yes' : 'no',
    };
    if (dto.localAddress?.trim()) params['local-address'] = dto.localAddress.trim();
    if (dto.remoteAddress?.trim()) params['remote-address'] = dto.remoteAddress.trim();
    if (dto.callerId?.trim()) params['caller-id'] = dto.callerId.trim();
    if (dto.routes?.trim()) params['routes'] = dto.routes.trim();
    if (dto.limitBytesIn !== undefined) params['limit-bytes-in'] = Number(dto.limitBytesIn);
    if (dto.limitBytesOut !== undefined) params['limit-bytes-out'] = Number(dto.limitBytesOut);
    if (dto.comment !== undefined) params['comment'] = dto.comment.trim();

    await client.executeCommand('/ppp/secret/add', params);
    this.recordAudit(
      'USER_CREATED',
      name,
      `Created PPP secret on RouterOS (service=${dto.service}, profile=${dto.profile})`,
      mode
    );
    const created = await this.getUserById(name, mode);
    if (!created) throw new Error('User created on RouterOS, but could not be reloaded.');
    return created;
  }

  public async updateUser(id: string, dto: CreateOrUpdatePppUserDto, mode: 'live' | 'demo'): Promise<PppUser> {
    if (mode === 'demo') {
      const idx = this.demoSecrets.findIndex((s) => s.id === id);
      if (idx === -1) throw new Error(`PPP secret '${id}' not found.`);

      const existing = this.demoSecrets[idx];
      const nextName = dto.name?.trim() || existing.name;
      if (
        nextName.toLowerCase() !== existing.name.toLowerCase() &&
        this.demoSecrets.some((s) => s.name.toLowerCase() === nextName.toLowerCase())
      ) {
        throw new Error(`RouterOS error: failure: secret with the same name '${nextName}' already exists`);
      }

      const updated: StoredSecretRecord = {
        ...existing,
        name: nextName,
        service: dto.service || existing.service,
        profile: dto.profile || existing.profile,
        localAddress: dto.localAddress !== undefined ? dto.localAddress.trim() : existing.localAddress,
        remoteAddress: dto.remoteAddress !== undefined ? dto.remoteAddress.trim() : existing.remoteAddress,
        callerId: dto.callerId !== undefined ? dto.callerId.trim() : existing.callerId,
        routes: dto.routes !== undefined ? dto.routes.trim() : existing.routes,
        limitBytesIn: dto.limitBytesIn !== undefined ? Number(dto.limitBytesIn) : existing.limitBytesIn,
        limitBytesOut: dto.limitBytesOut !== undefined ? Number(dto.limitBytesOut) : existing.limitBytesOut,
        comment: dto.comment !== undefined ? dto.comment.trim() : existing.comment,
        disabled: dto.disabled !== undefined ? Boolean(dto.disabled) : existing.disabled,
      };
      this.demoSecrets[idx] = updated;

      const pwChanged = Boolean(dto.password && dto.password.trim());
      this.recordAudit(
        'USER_UPDATED',
        updated.name,
        `Updated PPP secret (profile=${updated.profile}, service=${updated.service}, passwordUpdated=${pwChanged})`,
        mode
      );
      return (await this.getUserById(id, mode))!;
    }

    const client = new MikroTikApiClient(this.liveConfig);
    const params: Record<string, string | number | boolean | undefined> = {
      '.id': id,
      name: dto.name.trim(),
      service: dto.service,
      profile: dto.profile,
      'local-address': dto.localAddress?.trim() || '',
      'remote-address': dto.remoteAddress?.trim() || '',
      'caller-id': dto.callerId?.trim() || '',
      routes: dto.routes?.trim() || '',
      'limit-bytes-in': Number(dto.limitBytesIn || 0),
      'limit-bytes-out': Number(dto.limitBytesOut || 0),
      comment: dto.comment?.trim() || '',
      disabled: dto.disabled ? 'yes' : 'no',
    };
    if (dto.password && dto.password.trim()) {
      params['password'] = dto.password;
    }

    await client.executeCommand('/ppp/secret/set', params);
    this.recordAudit(
      'USER_UPDATED',
      dto.name,
      `Updated PPP secret on RouterOS (profile=${dto.profile}, service=${dto.service})`,
      mode
    );
    return (await this.getUserById(id, mode))!;
  }

  public async setUserDisabled(id: string, disabled: boolean, mode: 'live' | 'demo'): Promise<PppUser> {
    if (mode === 'demo') {
      const sec = this.demoSecrets.find((s) => s.id === id);
      if (!sec) throw new Error(`PPP secret '${id}' not found.`);
      sec.disabled = disabled;
      this.recordAudit(
        disabled ? 'USER_DISABLED' : 'USER_ENABLED',
        sec.name,
        `${disabled ? 'Disabled' : 'Enabled'} PPP secret in /ppp/secret`,
        mode
      );
      return (await this.getUserById(id, mode))!;
    }

    const client = new MikroTikApiClient(this.liveConfig);
    await client.executeCommand(disabled ? '/ppp/secret/disable' : '/ppp/secret/enable', {
      numbers: id,
    });
    const updated = await this.getUserById(id, mode);
    this.recordAudit(
      disabled ? 'USER_DISABLED' : 'USER_ENABLED',
      updated?.name || id,
      `${disabled ? 'Disabled' : 'Enabled'} PPP secret on RouterOS`,
      mode
    );
    return updated!;
  }

  public async deleteUser(id: string, mode: 'live' | 'demo'): Promise<void> {
    if (mode === 'demo') {
      const idx = this.demoSecrets.findIndex((s) => s.id === id);
      if (idx === -1) throw new Error(`PPP secret '${id}' not found.`);
      const [removed] = this.demoSecrets.splice(idx, 1);
      this.recordAudit(
        'USER_DELETED',
        removed.name,
        `Deleted PPP secret (${removed.id}) from /ppp/secret`,
        mode
      );
      return;
    }

    const existing = await this.getUserById(id, mode);
    const client = new MikroTikApiClient(this.liveConfig);
    await client.executeCommand('/ppp/secret/remove', { numbers: id });
    this.recordAudit(
      'USER_DELETED',
      existing?.name || id,
      `Removed PPP secret (${id}) from RouterOS /ppp/secret`,
      mode
    );
  }

  public async bulkUserAction(dto: BulkUserActionDto, mode: 'live' | 'demo'): Promise<{ affected: number }> {
    const ids = dto.ids || [];
    if (ids.length === 0) return { affected: 0 };

    if (mode === 'demo') {
      let affected = 0;
      if (dto.action === 'delete') {
        const before = this.demoSecrets.length;
        this.demoSecrets = this.demoSecrets.filter((s) => !ids.includes(s.id));
        affected = before - this.demoSecrets.length;
        this.recordAudit(
          'BULK_USERS_DELETED',
          `${affected} users`,
          `Bulk deleted ${affected} PPP secrets from /ppp/secret`,
          mode
        );
      } else {
        for (const sec of this.demoSecrets) {
          if (ids.includes(sec.id)) {
            if (dto.action === 'enable') sec.disabled = false;
            if (dto.action === 'disable') sec.disabled = true;
            if (dto.action === 'assign-profile' && dto.profile) sec.profile = dto.profile;
            affected++;
          }
        }
        const actionType: AuditActionType =
          dto.action === 'enable'
            ? 'BULK_USERS_ENABLED'
            : dto.action === 'disable'
            ? 'BULK_USERS_DISABLED'
            : 'BULK_PROFILE_ASSIGNED';
        this.recordAudit(
          actionType,
          `${affected} users`,
          dto.action === 'assign-profile'
            ? `Bulk assigned profile '${dto.profile}' to ${affected} PPP secrets`
            : `Bulk ${dto.action}d ${affected} PPP secrets`,
          mode
        );
      }
      return { affected };
    }

    const client = new MikroTikApiClient(this.liveConfig);
    const joinedIds = ids.join(',');
    if (dto.action === 'enable') {
      await client.executeCommand('/ppp/secret/enable', { numbers: joinedIds });
      this.recordAudit('BULK_USERS_ENABLED', `${ids.length} users`, `Bulk enabled ${ids.length} secrets`, mode);
    } else if (dto.action === 'disable') {
      await client.executeCommand('/ppp/secret/disable', { numbers: joinedIds });
      this.recordAudit('BULK_USERS_DISABLED', `${ids.length} users`, `Bulk disabled ${ids.length} secrets`, mode);
    } else if (dto.action === 'delete') {
      await client.executeCommand('/ppp/secret/remove', { numbers: joinedIds });
      this.recordAudit('BULK_USERS_DELETED', `${ids.length} users`, `Bulk removed ${ids.length} secrets`, mode);
    } else if (dto.action === 'assign-profile' && dto.profile) {
      await client.executeCommand('/ppp/secret/set', { '.id': joinedIds, profile: dto.profile });
      this.recordAudit(
        'BULK_PROFILE_ASSIGNED',
        `${ids.length} users`,
        `Bulk assigned profile '${dto.profile}' to ${ids.length} secrets`,
        mode
      );
    }
    return { affected: ids.length };
  }

  public async getProfiles(mode: 'live' | 'demo'): Promise<PppProfile[]> {
    const users = await this.getUsers(mode);
    const usersByProfile = new Map<string, string[]>();
    for (const u of users) {
      const list = usersByProfile.get(u.profile) || [];
      list.push(u.name);
      usersByProfile.set(u.profile, list);
    }

    if (mode === 'demo') {
      return this.demoProfiles.map((p) => {
        const assigned = usersByProfile.get(p.name) || [];
        return {
          ...p,
          assignedUserCount: assigned.length,
          assignedUsers: assigned,
        };
      });
    }

    const client = new MikroTikApiClient(this.liveConfig);
    const raw = await client.executeCommand('/ppp/profile/print');
    return raw.map((r) => {
      const name = r['name'] || '';
      const assigned = usersByProfile.get(name) || [];
      return {
        id: r['.id'] || name,
        name,
        localAddress: r['local-address'] || '',
        remoteAddress: r['remote-address'] || '',
        rateLimit: r['rate-limit'] || '',
        sessionTimeout: r['session-timeout'] || '',
        idleTimeout: r['idle-timeout'] || '',
        onlyOne: (r['only-one'] as 'default' | 'yes' | 'no') || 'default',
        useEncryption:
          (r['use-encryption'] as 'default' | 'yes' | 'no' | 'required') || 'default',
        dnsServer: r['dns-server'] || '',
        changeTcpMss: (r['change-tcp-mss'] as 'default' | 'yes' | 'no') || 'default',
        comment: r['comment'] || '',
        isDefaultBuiltIn: r['default'] === 'true' || r['default'] === 'yes',
        assignedUserCount: assigned.length,
        assignedUsers: assigned,
      };
    });
  }

  public async createProfile(dto: CreateOrUpdatePppProfileDto, mode: 'live' | 'demo'): Promise<PppProfile> {
    const name = dto.name.trim();
    if (!name) throw new Error('Profile name is required.');

    if (mode === 'demo') {
      if (this.demoProfiles.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
        throw new Error(`RouterOS error: failure: profile with the same name '${name}' already exists`);
      }
      const newId = `*P${++this.idCounter}`;
      const record: StoredProfileRecord = {
        id: newId,
        name,
        localAddress: dto.localAddress?.trim() || '',
        remoteAddress: dto.remoteAddress?.trim() || '',
        rateLimit: dto.rateLimit?.trim() || '',
        sessionTimeout: dto.sessionTimeout?.trim() || '',
        idleTimeout: dto.idleTimeout?.trim() || '',
        onlyOne: dto.onlyOne || 'default',
        useEncryption: dto.useEncryption || 'default',
        dnsServer: dto.dnsServer?.trim() || '',
        changeTcpMss: dto.changeTcpMss || 'default',
        comment: dto.comment?.trim() || '',
        isDefaultBuiltIn: false,
      };
      this.demoProfiles.push(record);
      this.recordAudit(
        'PROFILE_CREATED',
        name,
        `Created PPP profile (rate-limit=${record.rateLimit || 'unlimited'}, remote=${record.remoteAddress || 'none'})`,
        mode
      );
      const profiles = await this.getProfiles(mode);
      return profiles.find((p) => p.id === newId)!;
    }

    const client = new MikroTikApiClient(this.liveConfig);
    await client.executeCommand('/ppp/profile/add', {
      name,
      'local-address': dto.localAddress?.trim() || undefined,
      'remote-address': dto.remoteAddress?.trim() || undefined,
      'rate-limit': dto.rateLimit?.trim() || undefined,
      'session-timeout': dto.sessionTimeout?.trim() || undefined,
      'idle-timeout': dto.idleTimeout?.trim() || undefined,
      'only-one': dto.onlyOne || 'default',
      'use-encryption': dto.useEncryption || 'default',
      'dns-server': dto.dnsServer?.trim() || undefined,
      'change-tcp-mss': dto.changeTcpMss || 'default',
      comment: dto.comment?.trim() || undefined,
    });
    this.recordAudit(
      'PROFILE_CREATED',
      name,
      `Created PPP profile on RouterOS (rate-limit=${dto.rateLimit || 'unlimited'})`,
      mode
    );
    const profiles = await this.getProfiles(mode);
    return profiles.find((p) => p.name === name)!;
  }

  public async updateProfile(id: string, dto: CreateOrUpdatePppProfileDto, mode: 'live' | 'demo'): Promise<PppProfile> {
    if (mode === 'demo') {
      const idx = this.demoProfiles.findIndex((p) => p.id === id);
      if (idx === -1) throw new Error(`PPP profile '${id}' not found.`);
      const existing = this.demoProfiles[idx];
      const nextName = existing.isDefaultBuiltIn ? existing.name : dto.name?.trim() || existing.name;

      // Update profile references if renamed
      if (nextName !== existing.name) {
        for (const s of this.demoSecrets) {
          if (s.profile === existing.name) s.profile = nextName;
        }
      }

      this.demoProfiles[idx] = {
        ...existing,
        name: nextName,
        localAddress: dto.localAddress !== undefined ? dto.localAddress.trim() : existing.localAddress,
        remoteAddress: dto.remoteAddress !== undefined ? dto.remoteAddress.trim() : existing.remoteAddress,
        rateLimit: dto.rateLimit !== undefined ? dto.rateLimit.trim() : existing.rateLimit,
        sessionTimeout: dto.sessionTimeout !== undefined ? dto.sessionTimeout.trim() : existing.sessionTimeout,
        idleTimeout: dto.idleTimeout !== undefined ? dto.idleTimeout.trim() : existing.idleTimeout,
        onlyOne: dto.onlyOne || existing.onlyOne,
        useEncryption: dto.useEncryption || existing.useEncryption,
        dnsServer: dto.dnsServer !== undefined ? dto.dnsServer.trim() : existing.dnsServer,
        changeTcpMss: dto.changeTcpMss || existing.changeTcpMss,
        comment: dto.comment !== undefined ? dto.comment.trim() : existing.comment,
      };

      this.recordAudit(
        'PROFILE_UPDATED',
        nextName,
        `Updated PPP profile (rate-limit=${this.demoProfiles[idx].rateLimit || 'unlimited'})`,
        mode
      );
      const profiles = await this.getProfiles(mode);
      return profiles.find((p) => p.id === id)!;
    }

    const client = new MikroTikApiClient(this.liveConfig);
    await client.executeCommand('/ppp/profile/set', {
      '.id': id,
      name: dto.name.trim(),
      'local-address': dto.localAddress?.trim() || '',
      'remote-address': dto.remoteAddress?.trim() || '',
      'rate-limit': dto.rateLimit?.trim() || '',
      'session-timeout': dto.sessionTimeout?.trim() || '',
      'idle-timeout': dto.idleTimeout?.trim() || '',
      'only-one': dto.onlyOne || 'default',
      'use-encryption': dto.useEncryption || 'default',
      'dns-server': dto.dnsServer?.trim() || '',
      'change-tcp-mss': dto.changeTcpMss || 'default',
      comment: dto.comment?.trim() || '',
    });
    this.recordAudit(
      'PROFILE_UPDATED',
      dto.name,
      `Updated PPP profile on RouterOS (rate-limit=${dto.rateLimit || 'unlimited'})`,
      mode
    );
    const profiles = await this.getProfiles(mode);
    return profiles.find((p) => p.id === id || p.name === dto.name)!;
  }

  public async deleteProfile(id: string, mode: 'live' | 'demo'): Promise<void> {
    if (mode === 'demo') {
      const idx = this.demoProfiles.findIndex((p) => p.id === id);
      if (idx === -1) throw new Error(`PPP profile '${id}' not found.`);
      if (this.demoProfiles[idx].isDefaultBuiltIn) {
        throw new Error('RouterOS error: cannot remove built-in default profile.');
      }
      const [removed] = this.demoProfiles.splice(idx, 1);
      this.recordAudit('PROFILE_DELETED', removed.name, `Removed PPP profile (${id})`, mode);
      return;
    }

    const client = new MikroTikApiClient(this.liveConfig);
    await client.executeCommand('/ppp/profile/remove', { numbers: id });
    this.recordAudit('PROFILE_DELETED', id, `Removed PPP profile (${id}) from RouterOS`, mode);
  }

  public async getSessions(mode: 'live' | 'demo'): Promise<PppActiveSession[]> {
    const users = await this.getUsers(mode);
    const userByName = new Map<string, PppUser>();
    for (const u of users) {
      userByName.set(u.name, u);
    }

    if (mode === 'demo') {
      return this.demoActiveSessions.map((s) => {
        const u = userByName.get(s.name);
        return {
          ...s,
          uptimeSeconds: parseRouterOsUptimeToSeconds(s.uptime),
          relatedSecretId: u?.id,
          profile: u?.profile,
        };
      });
    }

    const client = new MikroTikApiClient(this.liveConfig);
    const raw = await client.executeCommand('/ppp/active/print');
    return raw.map((r) => {
      const name = r['name'] || '';
      const uptime = r['uptime'] || '0s';
      const u = userByName.get(name);
      return {
        id: r['.id'] || '',
        name,
        service: r['service'] || 'pppoe',
        callerId: r['caller-id'] || '',
        address: r['address'] || '',
        uptime,
        uptimeSeconds: parseRouterOsUptimeToSeconds(uptime),
        sessionId: r['session-id'] || r['.id'] || '',
        encoding: r['encoding'] || 'none',
        limitBytesIn: Number(r['limit-bytes-in'] || 0),
        limitBytesOut: Number(r['limit-bytes-out'] || 0),
        relatedSecretId: u?.id,
        profile: u?.profile,
      };
    });
  }

  public async disconnectSession(id: string, mode: 'live' | 'demo'): Promise<void> {
    if (mode === 'demo') {
      const idx = this.demoActiveSessions.findIndex((s) => s.id === id);
      if (idx === -1) throw new Error(`Active session '${id}' is no longer present in /ppp/active.`);
      const [removed] = this.demoActiveSessions.splice(idx, 1);
      this.recordAudit(
        'SESSION_DISCONNECTED',
        removed.name,
        `Terminated active ${removed.service.toUpperCase()} session ${removed.id} (Assigned IP: ${removed.address})`,
        mode
      );
      return;
    }

    const client = new MikroTikApiClient(this.liveConfig);
    await client.executeCommand('/ppp/active/remove', { numbers: id });
    this.recordAudit(
      'SESSION_DISCONNECTED',
      id,
      `Executed /ppp/active/remove for session ID ${id}`,
      mode
    );
  }

  public async disconnectSessionsByUsername(username: string, mode: 'live' | 'demo'): Promise<{ disconnected: number }> {
    const sessions = await this.getSessions(mode);
    const matching = sessions.filter((s) => s.name.toLowerCase() === username.toLowerCase());
    for (const s of matching) {
      await this.disconnectSession(s.id, mode);
    }
    if (matching.length > 0) {
      this.recordAudit(
        'USER_SESSIONS_DISCONNECTED',
        username,
        `Terminated ${matching.length} active session(s) for subscriber '${username}'`,
        mode
      );
    }
    return { disconnected: matching.length };
  }

  public async getDashboardSummary(mode: 'live' | 'demo'): Promise<DashboardSummaryDto> {
    const [routerInfo, users, profiles, sessions] = await Promise.all([
      this.getRouterInfo(mode),
      this.getUsers(mode).catch(() => [] as PppUser[]),
      this.getProfiles(mode).catch(() => [] as PppProfile[]),
      this.getSessions(mode).catch(() => [] as PppActiveSession[]),
    ]);

    const totalUsers = users.length;
    const enabledUsers = users.filter((u) => !u.disabled).length;
    const disabledUsers = users.filter((u) => u.disabled).length;
    const onlineUsers = sessions.length;
    const offlineUsers = Math.max(0, totalUsers - onlineUsers);

    const recentSessions = [...sessions]
      .sort((a, b) => a.uptimeSeconds - b.uptimeSeconds)
      .slice(0, 5);

    const topSessionsByUptime = [...sessions]
      .sort((a, b) => b.uptimeSeconds - a.uptimeSeconds)
      .slice(0, 5);

    const services = ['pppoe', 'sstp', 'l2tp', 'ovpn', 'pptp', 'any'];
    const serviceBreakdown = services
      .map((srv) => {
        const matching = users.filter((u) => u.service === srv);
        return {
          service: srv.toUpperCase(),
          total: matching.length,
          online: matching.filter((u) => u.isOnline).length,
        };
      })
      .filter((item) => item.total > 0);

    const profileBreakdown = profiles.map((p) => ({
      profile: p.name,
      count: p.assignedUserCount,
      onlineCount: users.filter((u) => u.profile === p.name && u.isOnline).length,
    }));

    return {
      totalUsers,
      enabledUsers,
      disabledUsers,
      onlineUsers,
      offlineUsers,
      totalProfiles: profiles.length,
      routerInfo,
      recentActions: this.auditLogs.slice(0, 8),
      recentSessions,
      topSessionsByUptime,
      serviceBreakdown,
      profileBreakdown,
    };
  }
}

export const pppService = new MikroTikPppService();

import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { z } from 'zod';
import { pppService } from './server/pppService';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '256kb' }));

// Security headers
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Simple per-IP sliding window rate limiter for API protection
const rateWindowMs = 60_000;
const maxRequestsPerMinute = 240;
const ipHits = new Map<string, { count: number; resetAt: number }>();

app.use('/api', (req: Request, res: Response, next: NextFunction) => {
  const ip = req.ip || '127.0.0.1';
  const now = Date.now();
  const entry = ipHits.get(ip);
  if (!entry || now > entry.resetAt) {
    ipHits.set(ip, { count: 1, resetAt: now + rateWindowMs });
  } else {
    entry.count++;
    if (entry.count > maxRequestsPerMinute) {
      return res.status(429).json({
        error: 'Rate limit exceeded. Please wait before issuing additional RouterOS API requests.',
      });
    }
  }
  next();
});

// Administrator session & CSRF state
interface AdminSessionState {
  authenticated: boolean;
  username: string;
  role: string;
  csrfToken: string;
}

const currentAdminSession: AdminSessionState = {
  authenticated: true,
  username: process.env.ADMIN_USERNAME || 'netops.admin',
  role: 'Senior Network Administrator',
  csrfToken: crypto.randomBytes(24).toString('hex'),
};

function resolveMode(req: Request): 'live' | 'demo' {
  const headerMode = String(req.headers['x-app-mode'] || '').toLowerCase();
  const queryMode = String(req.query.mode || '').toLowerCase();
  if (headerMode === 'live' || queryMode === 'live') return 'live';
  return 'demo';
}

function requireAdminAuth(req: Request, res: Response, next: NextFunction) {
  if (!currentAdminSession.authenticated) {
    return res.status(401).json({ error: 'Administrator session is locked. Please sign in.' });
  }
  next();
}

// Input Validation Schemas (Zod)
const userSchema = z.object({
  name: z
    .string()
    .min(1, 'Username is required')
    .max(64, 'Username max 64 chars')
    .regex(/^[a-zA-Z0-9._@-]+$/, 'Username contains unsupported characters'),
  password: z.string().max(128).optional(),
  service: z.enum(['any', 'pppoe', 'pptp', 'l2tp', 'ovpn', 'sstp']).default('any'),
  profile: z.string().min(1, 'Profile is required').max(64),
  localAddress: z.string().max(64).optional().default(''),
  remoteAddress: z.string().max(64).optional().default(''),
  callerId: z.string().max(64).optional().default(''),
  routes: z.string().max(256).optional().default(''),
  limitBytesIn: z.coerce.number().min(0).optional().default(0),
  limitBytesOut: z.coerce.number().min(0).optional().default(0),
  comment: z.string().max(255).optional().default(''),
  disabled: z.boolean().optional().default(false),
});

const profileSchema = z.object({
  name: z
    .string()
    .min(1, 'Profile name is required')
    .max(64)
    .regex(/^[a-zA-Z0-9._-]+$/, 'Profile name may only contain letters, numbers, dots, underscores, or hyphens'),
  localAddress: z.string().max(64).optional().default(''),
  remoteAddress: z.string().max(64).optional().default(''),
  rateLimit: z.string().max(128).optional().default(''),
  sessionTimeout: z.string().max(64).optional().default(''),
  idleTimeout: z.string().max(64).optional().default(''),
  onlyOne: z.enum(['default', 'yes', 'no']).optional().default('default'),
  useEncryption: z.enum(['default', 'yes', 'no', 'required']).optional().default('default'),
  dnsServer: z.string().max(128).optional().default(''),
  changeTcpMss: z.enum(['default', 'yes', 'no']).optional().default('default'),
  comment: z.string().max(255).optional().default(''),
});

const routerConfigSchema = z.object({
  routerDisplayName: z.string().min(1).max(64),
  host: z.string().max(128),
  port: z.coerce.number().int().min(1).max(65535).default(8729),
  username: z.string().min(1).max(64),
  password: z.string().max(128).optional(),
  tlsEnabled: z.boolean().default(true),
  validateCertificate: z.boolean().default(true),
  timeoutMs: z.coerce.number().int().min(1000).max(30000).default(8000),
});

// --- AUTH ENDPOINTS ---
app.get('/api/auth/session', (_req: Request, res: Response) => {
  res.json(currentAdminSession);
});

app.post('/api/auth/login', (req: Request, res: Response) => {
  const { username, password } = req.body || {};
  const expectedPass = process.env.ADMIN_PASSWORD || 'admin123';
  if (!username || !password || password !== expectedPass) {
    pppService.recordAudit(
      'ADMIN_LOGIN',
      username || 'unknown',
      'Failed administrator sign-in attempt',
      resolveMode(req),
      'FAILURE',
      'Invalid credentials'
    );
    return res.status(401).json({ error: 'Invalid administrator credentials. (Default: netops.admin / admin123)' });
  }
  currentAdminSession.authenticated = true;
  currentAdminSession.username = String(username).trim();
  currentAdminSession.csrfToken = crypto.randomBytes(24).toString('hex');
  pppService.recordAudit(
    'ADMIN_LOGIN',
    currentAdminSession.username,
    'Administrator session unlocked',
    resolveMode(req)
  );
  res.json(currentAdminSession);
});

app.post('/api/auth/logout', (_req: Request, res: Response) => {
  currentAdminSession.authenticated = false;
  res.json({ authenticated: false });
});

// --- DASHBOARD ---
app.get('/api/dashboard/summary', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const mode = resolveMode(req);
    const summary = await pppService.getDashboardSummary(mode);
    res.json(summary);
  } catch (err) {
    res.status(502).json({
      error: err instanceof Error ? err.message : 'Unable to retrieve dashboard summary',
    });
  }
});

// --- PPP USERS (/ppp/secret) ---
app.get('/api/ppp/users', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const users = await pppService.getUsers(resolveMode(req));
    res.json(users);
  } catch (err) {
    res.status(502).json({
      error: err instanceof Error ? err.message : 'Failed to list PPP secrets from RouterOS',
    });
  }
});

app.get('/api/ppp/users/:id', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const user = await pppService.getUserById(req.params.id, resolveMode(req));
    if (!user) return res.status(404).json({ error: 'PPP secret not found.' });
    res.json(user);
  } catch (err) {
    res.status(502).json({
      error: err instanceof Error ? err.message : 'Failed to retrieve PPP secret details',
    });
  }
});

app.post('/api/ppp/users', requireAdminAuth, async (req: Request, res: Response) => {
  const mode = resolveMode(req);
  try {
    const parsed = userSchema.parse(req.body);
    const created = await pppService.createUser(parsed, mode);
    res.status(201).json(created);
  } catch (err) {
    const msg = err instanceof z.ZodError ? err.issues[0]?.message : err instanceof Error ? err.message : 'Failed to create user';
    pppService.recordAudit('USER_CREATED', req.body?.name || 'unknown', 'Create user failed', mode, 'FAILURE', msg);
    res.status(400).json({ error: msg });
  }
});

app.put('/api/ppp/users/:id', requireAdminAuth, async (req: Request, res: Response) => {
  const mode = resolveMode(req);
  try {
    const parsed = userSchema.parse(req.body);
    const updated = await pppService.updateUser(req.params.id, parsed, mode);
    res.json(updated);
  } catch (err) {
    const msg = err instanceof z.ZodError ? err.issues[0]?.message : err instanceof Error ? err.message : 'Failed to update user';
    pppService.recordAudit('USER_UPDATED', req.params.id, 'Update user failed', mode, 'FAILURE', msg);
    res.status(400).json({ error: msg });
  }
});

app.delete('/api/ppp/users/:id', requireAdminAuth, async (req: Request, res: Response) => {
  const mode = resolveMode(req);
  try {
    await pppService.deleteUser(req.params.id, mode);
    res.json({ deleted: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to delete user';
    pppService.recordAudit('USER_DELETED', req.params.id, 'Delete user failed', mode, 'FAILURE', msg);
    res.status(400).json({ error: msg });
  }
});

app.post('/api/ppp/users/:id/enable', requireAdminAuth, async (req: Request, res: Response) => {
  const mode = resolveMode(req);
  try {
    const user = await pppService.setUserDisabled(req.params.id, false, mode);
    res.json(user);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to enable user';
    res.status(400).json({ error: msg });
  }
});

app.post('/api/ppp/users/:id/disable', requireAdminAuth, async (req: Request, res: Response) => {
  const mode = resolveMode(req);
  try {
    const user = await pppService.setUserDisabled(req.params.id, true, mode);
    res.json(user);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to disable user';
    res.status(400).json({ error: msg });
  }
});

app.post('/api/ppp/users/bulk', requireAdminAuth, async (req: Request, res: Response) => {
  const mode = resolveMode(req);
  try {
    const result = await pppService.bulkUserAction(req.body, mode);
    res.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Bulk action failed';
    res.status(400).json({ error: msg });
  }
});

// --- PPP PROFILES (/ppp/profile) ---
app.get('/api/ppp/profiles', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const profiles = await pppService.getProfiles(resolveMode(req));
    res.json(profiles);
  } catch (err) {
    res.status(502).json({
      error: err instanceof Error ? err.message : 'Failed to load PPP profiles',
    });
  }
});

app.post('/api/ppp/profiles', requireAdminAuth, async (req: Request, res: Response) => {
  const mode = resolveMode(req);
  try {
    const parsed = profileSchema.parse(req.body);
    const created = await pppService.createProfile(parsed, mode);
    res.status(201).json(created);
  } catch (err) {
    const msg = err instanceof z.ZodError ? err.issues[0]?.message : err instanceof Error ? err.message : 'Failed to create profile';
    pppService.recordAudit('PROFILE_CREATED', req.body?.name || 'unknown', 'Create profile failed', mode, 'FAILURE', msg);
    res.status(400).json({ error: msg });
  }
});

app.put('/api/ppp/profiles/:id', requireAdminAuth, async (req: Request, res: Response) => {
  const mode = resolveMode(req);
  try {
    const parsed = profileSchema.parse(req.body);
    const updated = await pppService.updateProfile(req.params.id, parsed, mode);
    res.json(updated);
  } catch (err) {
    const msg = err instanceof z.ZodError ? err.issues[0]?.message : err instanceof Error ? err.message : 'Failed to update profile';
    pppService.recordAudit('PROFILE_UPDATED', req.params.id, 'Update profile failed', mode, 'FAILURE', msg);
    res.status(400).json({ error: msg });
  }
});

app.delete('/api/ppp/profiles/:id', requireAdminAuth, async (req: Request, res: Response) => {
  const mode = resolveMode(req);
  try {
    await pppService.deleteProfile(req.params.id, mode);
    res.json({ deleted: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to delete profile';
    pppService.recordAudit('PROFILE_DELETED', req.params.id, 'Delete profile failed', mode, 'FAILURE', msg);
    res.status(400).json({ error: msg });
  }
});

// --- ACTIVE SESSIONS (/ppp/active) ---
app.get('/api/ppp/sessions', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const sessions = await pppService.getSessions(resolveMode(req));
    res.json(sessions);
  } catch (err) {
    res.status(502).json({
      error: err instanceof Error ? err.message : 'Failed to fetch active PPP sessions',
    });
  }
});

app.delete('/api/ppp/sessions/:id', requireAdminAuth, async (req: Request, res: Response) => {
  const mode = resolveMode(req);
  try {
    await pppService.disconnectSession(req.params.id, mode);
    res.json({ disconnected: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to disconnect session';
    pppService.recordAudit('SESSION_DISCONNECTED', req.params.id, 'Disconnect session failed', mode, 'FAILURE', msg);
    res.status(400).json({ error: msg });
  }
});

app.post('/api/ppp/sessions/disconnect-user/:username', requireAdminAuth, async (req: Request, res: Response) => {
  const mode = resolveMode(req);
  try {
    const result = await pppService.disconnectSessionsByUsername(req.params.username, mode);
    res.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to disconnect user sessions';
    res.status(400).json({ error: msg });
  }
});

// --- ROUTER SETTINGS & CONNECTION ---
app.get('/api/router/config', requireAdminAuth, (_req: Request, res: Response) => {
  res.json(pppService.getRouterConfigSafe());
});

app.put('/api/router/config', requireAdminAuth, (req: Request, res: Response) => {
  const mode = resolveMode(req);
  try {
    const parsed = routerConfigSchema.parse(req.body);
    const updated = pppService.updateRouterConfig(parsed, mode);
    res.json(updated);
  } catch (err) {
    const msg = err instanceof z.ZodError ? err.issues[0]?.message : err instanceof Error ? err.message : 'Invalid router config';
    res.status(400).json({ error: msg });
  }
});

app.post('/api/router/test-connection', requireAdminAuth, async (req: Request, res: Response) => {
  const mode = resolveMode(req);
  try {
    const parsed = routerConfigSchema.parse(req.body);
    // Test connection always attempts live TCP/TLS handshake if host is provided, or returns demo info in demo mode if host is blank
    const testMode = parsed.host && parsed.host.trim() ? 'live' : mode;
    const info = await pppService.getRouterInfo(testMode, parsed);
    pppService.recordAudit(
      'ROUTER_CONNECTION_TESTED',
      `${parsed.host || 'demo-bng'}:${parsed.port}`,
      info.connected
        ? `Verified connection to ${info.identity} (${info.version})`
        : `Connection test failed: ${info.errorMessage}`,
      mode,
      info.connected ? 'SUCCESS' : 'FAILURE',
      info.errorMessage
    );
    res.json(info);
  } catch (err) {
    const msg = err instanceof z.ZodError ? err.issues[0]?.message : err instanceof Error ? err.message : 'Connection test failed';
    res.status(400).json({ error: msg });
  }
});

app.get('/api/router/info', requireAdminAuth, async (req: Request, res: Response) => {
  const info = await pppService.getRouterInfo(resolveMode(req));
  res.json(info);
});

// --- AUDIT LOGS ---
app.get('/api/logs', requireAdminAuth, (_req: Request, res: Response) => {
  res.json(pppService.getAuditLogs());
});

// --- OPENAPI / SWAGGER SPECIFICATION ---
app.get('/api/openapi.json', (_req: Request, res: Response) => {
  res.json({
    openapi: '3.1.0',
    info: {
      title: 'MikroTik PPP Manager API',
      version: '1.0.0',
      description: 'ASP.NET Core (.NET 10) & Node.js compatible REST API for MikroTik RouterOS PPP Administration over TLS (Port 8729).',
    },
    paths: {
      '/api/dashboard/summary': { get: { summary: 'Get real-time PPP subscriber & router summary' } },
      '/api/ppp/users': {
        get: { summary: 'List all /ppp/secret accounts enriched with /ppp/active state' },
        post: { summary: 'Create a new /ppp/secret account' },
      },
      '/api/ppp/users/{id}': {
        get: { summary: 'Get a single PPP secret by .id' },
        put: { summary: 'Update a PPP secret by .id' },
        delete: { summary: 'Remove a PPP secret from /ppp/secret' },
      },
      '/api/ppp/users/{id}/enable': { post: { summary: 'Enable a PPP secret' } },
      '/api/ppp/users/{id}/disable': { post: { summary: 'Disable a PPP secret' } },
      '/api/ppp/profiles': {
        get: { summary: 'List all /ppp/profile entries and assigned user counts' },
        post: { summary: 'Create a new /ppp/profile entry' },
      },
      '/api/ppp/profiles/{id}': {
        put: { summary: 'Update a /ppp/profile entry' },
        delete: { summary: 'Remove a /ppp/profile entry' },
      },
      '/api/ppp/sessions': { get: { summary: 'List active tunnels in /ppp/active' } },
      '/api/ppp/sessions/{id}': { delete: { summary: 'Terminate an active session in /ppp/active' } },
      '/api/router/test-connection': { post: { summary: 'Test RouterOS API/API-SSL connection' } },
      '/api/router/info': { get: { summary: 'Get RouterOS identity, version, and resource telemetry' } },
    },
  });
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`MikroTik PPP Manager server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

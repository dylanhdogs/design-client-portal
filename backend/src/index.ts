import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';
import authRoutes from './routes/auth';
import clientRoutes from './routes/clients';
import consultationRoutes from './routes/consultations';
import documentRoutes from './routes/documents';
import communicationRoutes from './routes/communications';
import poolProjectRoutes from './routes/poolProject';
import myProjectRoutes from './routes/myProject';
import phaseRoutes from './routes/phases';
import poolNotesRoutes from './routes/poolNotes';
import clientUserRoutes from './routes/clientUsers';
import notificationRoutes from './routes/notifications';
import fileRoutes from './routes/files';
import activityRoutes from './routes/activities';
import invitationRoutes from './routes/invitations';
import workflowRoutes from './routes/workflow';
import inquiryRoutes from './routes/inquiries';
import designRoutes from './routes/design';
import complianceRoutes from './routes/compliance';
import preconstructionRoutes from './routes/preconstruction';
import procurementRoutes from './routes/procurement';
import automationRoutes from './routes/automation';
import managementRoutes from './routes/management';
import clientStatusReportRoutes from './routes/clientStatusReports';
import { errorHandler } from './utils/errors';
import { AppError } from './utils/errors';
import { requireFeature, workflowFeatureGuard } from './utils/features';
import { structuredRequestLog } from './middleware/operations';
import { getUploadDirectory } from './utils/storage';
import { prisma } from './utils/prisma';
import { getBackupFreshness, startBackupScheduler } from './operations/scheduler';
import { validateEnvironment } from './utils/config';
import { getDatabasePath, initializeDatabase } from './utils/database';
import { canViewHealthDetails } from './utils/health';
import { createGracefulShutdown } from './utils/shutdown';

dotenv.config();

const runtimeConfig = validateEnvironment();
const app = express();
const HOST = runtimeConfig.host;
const PORT = runtimeConfig.port;
const configuredOrigins = runtimeConfig.corsOrigins;
const connectSources = ["'self'", ...configuredOrigins];

if (runtimeConfig.production) app.set('trust proxy', runtimeConfig.trustProxyHops);

if (process.env.STAGING_MODE === 'true') {
  app.use((_req, res, next) => {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
    next();
  });
  app.get('/robots.txt', (_req, res) => res.type('text/plain').send('User-agent: *\nDisallow: /\n'));
}

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "blob:"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      connectSrc: connectSources,
      fontSrc: ["'self'"],
      frameSrc: ["'self'", "blob:"],
      objectSrc: ["'none'"],
    },
  },
}));
app.use((req, res, next) => {
  const requestId = req.header('x-request-id') || crypto.randomUUID();
  (req as any).requestId = requestId;
  res.setHeader('x-request-id', requestId);
  next();
});
app.use(structuredRequestLog);
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || configuredOrigins.includes(origin)) return callback(null, true);
    return callback(new AppError('Origin is not allowed by CORS.', 403, 'FORBIDDEN'));
  },
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));

app.get('/api/public/config', (_req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.json({
    privacyNoticeUrl: runtimeConfig.privacyNoticeUrl || null,
    supportEmail: runtimeConfig.supportEmail || null,
    passwordResetMode: runtimeConfig.passwordResetMode,
  });
});

app.use('/api/files', fileRoutes);

app.use('/api/auth', authRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/clients/:clientId/consultations', consultationRoutes);
app.use('/api/clients/:clientId/documents', documentRoutes);
app.use('/api/clients/:clientId/communications', communicationRoutes);
app.use('/api/clients/:clientId/project', poolProjectRoutes);
app.use('/api/clients/:clientId/project/phases', phaseRoutes);
app.use('/api/clients/:clientId/project/notes', poolNotesRoutes);
app.use('/api/clients/:clientId', clientUserRoutes);
app.use('/api/my-project', myProjectRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api', invitationRoutes);

const storageCheck = (directory: string) => {
  try {
    fs.accessSync(directory, fs.constants.R_OK | fs.constants.W_OK);
    const stats = fs.statfsSync(directory);
    const availableBytes = stats.bavail * stats.bsize;
    const minimumBytes = Number(process.env.MIN_FREE_STORAGE_BYTES || 1024 * 1024 * 1024);
    return { ok: availableBytes >= minimumBytes, detail: availableBytes >= minimumBytes ? undefined : 'Available storage is below the configured safety threshold.' };
  } catch {
    return { ok: false, detail: 'Storage is unavailable.' };
  }
};

const getHealthChecks = async () => {
  const checks: Record<string, { ok: boolean; detail?: string }> = {};
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = { ok: true };
    const integrity = await prisma.$queryRawUnsafe<Array<{ quick_check: string }>>('PRAGMA quick_check');
    checks.databaseIntegrity = { ok: integrity[0]?.quick_check === 'ok', detail: integrity[0]?.quick_check === 'ok' ? undefined : 'SQLite quick check failed.' };
  } catch {
    checks.database = { ok: false, detail: 'Database query failed.' };
    checks.databaseIntegrity = { ok: false, detail: 'Database integrity could not be checked.' };
  }
  checks.databaseStorage = storageCheck(path.dirname(getDatabasePath()));
  checks.uploadStorage = storageCheck(getUploadDirectory());
  checks.backup = await getBackupFreshness();
  checks.singleInstance = { ok: !process.env.APP_INSTANCE_COUNT || process.env.APP_INSTANCE_COUNT === '1', detail: process.env.APP_INSTANCE_COUNT && process.env.APP_INSTANCE_COUNT !== '1' ? 'SQLite requires one application instance.' : undefined };
  return checks;
};

app.get('/api/health/live', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));
const mayViewHealthDetails = (req: express.Request) => {
  return canViewHealthDetails({
    production: runtimeConfig.production,
    // req.ip honors the validated one-hop trust-proxy topology. The socket peer is
    // Nginx itself and therefore must not be used to classify a public request.
    requestIp: req.ip || '',
    expectedToken: process.env.HEALTH_CHECK_TOKEN || '',
    suppliedToken: req.header('x-health-check-token') || '',
  });
};
const healthPayload = (req: express.Request, status: string, checks: Record<string, { ok: boolean; detail?: string }>) => ({
  status,
  ...(mayViewHealthDetails(req) ? { checks } : {}),
  timestamp: new Date().toISOString(),
});
app.get('/api/health/ready', async (req, res) => {
  const checks = await getHealthChecks();
  const ok = Object.values(checks).every((check) => check.ok);
  res.status(ok ? 200 : 503).json(healthPayload(req, ok ? 'ready' : 'not_ready', checks));
});
app.get('/api/health', async (req, res) => {
  const checks = await getHealthChecks();
  const ok = Object.values(checks).every((check) => check.ok);
  res.status(ok ? 200 : 503).json({ ...healthPayload(req, ok ? 'ok' : 'degraded', checks), requestId: (req as any).requestId });
});

app.use('/api', requireFeature('INQUIRY', /^\/inquiries(?:\/|$)/), inquiryRoutes);
app.use('/api', workflowFeatureGuard, workflowRoutes);
app.use('/api', requireFeature('DESIGN', /^\/(?:projects\/[^/]+\/(?:design|design-versions|scope-versions|evidence)|design-versions|scope-versions)(?:\/|$)/), designRoutes);
app.use('/api', requireFeature('COMPLIANCE', /^\/(?:projects\/[^/]+\/compliance|compliance|compliance-exceptions)(?:\/|$)/), complianceRoutes);
app.use('/api', requireFeature('PRECONSTRUCTION', /^\/(?:projects\/[^/]+\/(?:preconstruction|readiness-review)|preconstruction|readiness)(?:\/|$)/), preconstructionRoutes);
app.use('/api', requireFeature('PROCUREMENT', /^\/(?:projects\/[^/]+\/procurement|procurement|vendors)(?:\/|$)/), procurementRoutes);
app.use('/api', automationRoutes);
app.use('/api', managementRoutes);
app.use('/api', clientStatusReportRoutes);

// Serve frontend static files in production
if (runtimeConfig.production) {
  const frontendDist = path.resolve(__dirname, '..', '..', 'frontend', 'dist');
  app.use(express.static(frontendDist));
  
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

app.use(errorHandler);

if (require.main === module) {
  void initializeDatabase().then(() => {
    const server = app.listen(PORT, HOST, () => {
      console.log(JSON.stringify({ level: 'info', event: 'server_started', host: HOST, port: Number(PORT) }));
      startBackupScheduler();
    });
    const shutdown = createGracefulShutdown({
      closeServer: (callback) => server.close(callback),
      disconnectDatabase: () => prisma.$disconnect(),
      exitProcess: (code) => process.exit(code),
    });
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }).catch((error) => {
    console.error(JSON.stringify({ level: 'error', event: 'server_start_failed', message: String(error?.message || error) }));
    process.exitCode = 1;
  });
}

export { app };
export default app;

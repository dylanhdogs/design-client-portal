import path from 'path';
import { getSessionDuration } from './session';
import { getDocumentRetentionDays } from './retention';

export interface RuntimeConfig {
  production: boolean;
  reverseProxyMode: 'loopback' | 'container-network';
  host: string;
  port: number;
  trustProxyHops: number;
  frontendUrl: string;
  corsOrigins: string[];
  databaseUrl: string;
  uploadDirectory: string;
  backupDirectory: string;
  manifestDirectory: string;
  backupEnabled: boolean;
  backupSchedulerMode: 'internal' | 'external';
  backupIntervalHours: number;
  backupMaxAgeHours: number;
  minimumFreeStorageBytes: number;
  backupRetentionDays: number;
  requiredNodeVersion: string;
  privacyNoticeUrl: string;
  supportEmail: string;
  passwordResetMode: 'administrator' | 'development-link';
  documentRetentionDays: number;
}

const PLACEHOLDER_PATTERN = /replace-with|change-me|example-secret|construction-portal-jwt-secret-key-2026/i;

const required = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
};

const secureSecret = (name: string): string => {
  const value = required(name);
  if (value.length < 32 || PLACEHOLDER_PATTERN.test(value)) {
    throw new Error(`${name} must be a non-placeholder secret of at least 32 characters.`);
  }
  return value;
};

const absoluteFileUrl = (value: string): boolean => {
  if (!value.startsWith('file:')) return false;
  const location = value.slice(5).split('?')[0];
  return path.isAbsolute(location);
};

const isHttpsUrl = (value: string): boolean => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' && Boolean(parsed.hostname) && !parsed.username && !parsed.password;
  } catch {
    return false;
  }
};

const isHttpsOrigin = (value: string): boolean => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' && parsed.origin === value && !parsed.username && !parsed.password;
  } catch {
    return false;
  }
};

export const validateEnvironment = (): RuntimeConfig => {
  const production = process.env.NODE_ENV === 'production';
  const reverseProxyMode = process.env.REVERSE_PROXY_MODE?.trim() || 'loopback';
  if (!['loopback', 'container-network'].includes(reverseProxyMode)) {
    throw new Error('REVERSE_PROXY_MODE must be loopback or container-network.');
  }
  getSessionDuration();
  const documentRetentionDays = getDocumentRetentionDays();
  const host = process.env.HOST?.trim() || (production ? '127.0.0.1' : '0.0.0.0');
  if (!/^[A-Za-z0-9.:_-]+$/.test(host)) throw new Error('HOST contains unsupported characters.');
  const port = Number(process.env.PORT || 4000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be a valid TCP port.');
  const trustProxyHops = Number(process.env.TRUST_PROXY_HOPS || 1);
  if (!Number.isInteger(trustProxyHops) || trustProxyHops < 0 || trustProxyHops > 2) {
    throw new Error('TRUST_PROXY_HOPS must be an integer from 0 to 2.');
  }

  const frontendUrl = process.env.FRONTEND_URL?.trim() || 'http://localhost:3000';
  const corsOrigins = (process.env.CORS_ORIGINS || frontendUrl).split(',').map((value) => value.trim()).filter(Boolean);
  const databaseUrl = process.env.DATABASE_URL?.trim() || 'file:./dev.db';
  const uploadDirectory = process.env.UPLOAD_DIR?.trim() || 'uploads';
  const backupDirectory = process.env.BACKUP_DIR?.trim() || 'backups';
  const manifestDirectory = process.env.MANIFEST_DIR?.trim() || 'manifests';
  const backupEnabled = process.env.BACKUP_ENABLED === 'true';
  const backupSchedulerMode = process.env.BACKUP_SCHEDULER_MODE?.trim() || 'internal';
  if (!['internal', 'external'].includes(backupSchedulerMode)) {
    throw new Error('BACKUP_SCHEDULER_MODE must be internal or external.');
  }
  const backupIntervalHours = Number(process.env.BACKUP_INTERVAL_HOURS || 24);
  if (!Number.isInteger(backupIntervalHours) || backupIntervalHours < 1 || backupIntervalHours > 24) {
    throw new Error('BACKUP_INTERVAL_HOURS must be an integer from 1 to 24.');
  }
  const backupMaxAgeHours = Number(process.env.BACKUP_MAX_AGE_HOURS || 26);
  if (!Number.isInteger(backupMaxAgeHours) || backupMaxAgeHours < backupIntervalHours || backupMaxAgeHours > 168) {
    throw new Error('BACKUP_MAX_AGE_HOURS must be an integer between BACKUP_INTERVAL_HOURS and 168.');
  }
  const notificationMode = process.env.EXTERNAL_NOTIFICATION_MODE || 'disabled';
  if (!['disabled', 'console'].includes(notificationMode)) {
    throw new Error('EXTERNAL_NOTIFICATION_MODE must be disabled, or console outside production.');
  }
  const minimumFreeStorageBytes = Number(process.env.MIN_FREE_STORAGE_BYTES || 1024 * 1024 * 1024);
  if (!Number.isSafeInteger(minimumFreeStorageBytes) || minimumFreeStorageBytes < 100 * 1024 * 1024) {
    throw new Error('MIN_FREE_STORAGE_BYTES must be an integer of at least 104857600 bytes.');
  }
  const backupRetentionDays = Number(process.env.BACKUP_RETENTION_DAYS || 30);
  if (!Number.isInteger(backupRetentionDays) || backupRetentionDays < 1 || backupRetentionDays > 3650) {
    throw new Error('BACKUP_RETENTION_DAYS must be an integer from 1 to 3650.');
  }
  const requiredNodeVersion = process.env.REQUIRED_NODE_VERSION?.trim() || '22.23.2';
  if (!/^22\.\d+\.\d+$/.test(requiredNodeVersion)) {
    throw new Error('REQUIRED_NODE_VERSION must be an exact Node.js 22 version.');
  }
  const privacyNoticeUrl = process.env.PRIVACY_NOTICE_URL?.trim() || '';
  const supportEmail = process.env.SUPPORT_EMAIL?.trim() || '';

  if (process.env.APP_INSTANCE_COUNT && process.env.APP_INSTANCE_COUNT !== '1') {
    throw new Error('SQLite deployment requires APP_INSTANCE_COUNT=1.');
  }

  if (production) {
    const validHost = reverseProxyMode === 'loopback'
      ? ['127.0.0.1', '::1', 'localhost'].includes(host)
      : ['0.0.0.0', '::'].includes(host);
    if (!validHost) {
      throw new Error(reverseProxyMode === 'loopback'
        ? 'Production HOST must bind to a loopback address behind the reverse proxy.'
        : 'Container-network mode requires HOST=0.0.0.0 or HOST=::.');
    }
    secureSecret('JWT_SECRET');
    secureSecret('HEALTH_CHECK_TOKEN');
    if (!isHttpsUrl(privacyNoticeUrl)) throw new Error('PRIVACY_NOTICE_URL must be a valid HTTPS URL without embedded credentials in production.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supportEmail)) throw new Error('SUPPORT_EMAIL must be a valid address in production.');
    if (process.env.APP_INSTANCE_COUNT !== '1') throw new Error('APP_INSTANCE_COUNT=1 is required in production.');
    if (trustProxyHops !== 1) throw new Error('TRUST_PROXY_HOPS=1 is required for the supported Nginx topology.');
    if (!isHttpsOrigin(frontendUrl)) throw new Error('FRONTEND_URL must be an exact HTTPS origin without a path, trailing slash, or credentials in production.');
    if (!corsOrigins.length || corsOrigins.some((origin) => !isHttpsOrigin(origin))) {
      throw new Error('Every production CORS_ORIGINS value must be an exact HTTPS origin without a path, trailing slash, or credentials.');
    }
    if (!absoluteFileUrl(databaseUrl)) throw new Error('Production DATABASE_URL must be an absolute SQLite file URL.');
    if (!path.isAbsolute(uploadDirectory)) throw new Error('Production UPLOAD_DIR must be an absolute path.');
    if (!path.isAbsolute(backupDirectory)) throw new Error('Production BACKUP_DIR must be an absolute path.');
    if (!path.isAbsolute(manifestDirectory)) throw new Error('Production MANIFEST_DIR must be an absolute path.');
    if (!backupEnabled) throw new Error('BACKUP_ENABLED=true is required in production.');
    secureSecret('BACKUP_ENCRYPTION_KEY');
    if (notificationMode !== 'disabled') {
      throw new Error('EXTERNAL_NOTIFICATION_MODE must remain disabled until a production delivery provider is implemented and verified.');
    }
  }

  return { production, reverseProxyMode: reverseProxyMode as 'loopback' | 'container-network', host, port, trustProxyHops, frontendUrl, corsOrigins, databaseUrl, uploadDirectory, backupDirectory, manifestDirectory, backupEnabled, backupSchedulerMode: backupSchedulerMode as 'internal' | 'external', backupIntervalHours, backupMaxAgeHours, minimumFreeStorageBytes, backupRetentionDays, requiredNodeVersion, privacyNoticeUrl, supportEmail, passwordResetMode: notificationMode === 'console' ? 'development-link' : 'administrator', documentRetentionDays };
};

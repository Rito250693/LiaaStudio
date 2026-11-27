import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';

const ROOT_DIR = process.cwd();

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = val;
    }
  }
}

const rawEnv = (process.env.LIAA_ENV || process.env.NODE_ENV || 'development').toLowerCase();
export const APP_ENV =
  rawEnv === 'production' || rawEnv === 'staging' || rawEnv === 'test' ? rawEnv : 'development';

// Load environment-specific config files in precedence order
const envLocalPath = path.join(ROOT_DIR, '.env.local');
loadEnvFile(envLocalPath);
loadEnvFile(path.join(ROOT_DIR, `.env.${APP_ENV}`));
loadEnvFile(path.join(ROOT_DIR, '.env'));

// Ensure external secrets exist OUTSIDE SQLite (.env.local in non-production)
// Resolved lazily so static `vite build` does not require runtime production secrets.
const resolvedSecrets = {};

function ensureExternalSecret(envVarName) {
  if (resolvedSecrets[envVarName]) return resolvedSecrets[envVarName];
  if (process.env[envVarName] && process.env[envVarName].length >= 32) {
    resolvedSecrets[envVarName] = process.env[envVarName];
    return resolvedSecrets[envVarName];
  }
  if (APP_ENV === 'production') {
    throw new Error(
      `[LIAA SECURITY] Variable de entorno obligatoria faltante en producción: ${envVarName}`,
    );
  }
  const generated = crypto.randomBytes(32).toString('hex');
  process.env[envVarName] = generated;
  resolvedSecrets[envVarName] = generated;
  if (APP_ENV !== 'test') {
    try {
      const prefix = fs.existsSync(envLocalPath)
        ? '\n'
        : '# Secretos locales generados automáticamente (NO subir a Git)\n';
      fs.appendFileSync(envLocalPath, `${prefix}${envVarName}=${generated}\n`, 'utf8');
    } catch {
      // Keep ephemeral in memory if filesystem is read-only
    }
  }
  return generated;
}

export const EXTERNAL_SECRETS = {
  get encryptionKeyHex() {
    return ensureExternalSecret('LIAA_ENCRYPTION_KEY');
  },
  get sessionSecret() {
    return ensureExternalSecret('LIAA_SESSION_SECRET');
  },
};

export const PATHS = {
  root: ROOT_DIR,
  publicDir: path.join(ROOT_DIR, 'public'),
  contentFile: process.env.LIAA_CONTENT_FILE || path.join(ROOT_DIR, 'public', 'content.json'),
  imagesDir: path.join(ROOT_DIR, 'public', 'images'),
  uploadsDir: process.env.LIAA_UPLOADS_DIR || path.join(ROOT_DIR, 'public', 'images', 'uploads'),
  dataDir: path.join(ROOT_DIR, 'server', 'data'),
  dbFile: process.env.LIAA_DB_FILE || path.join(ROOT_DIR, 'server', 'data', `liaa.${APP_ENV}.db`),
};

export const SECURITY_CONFIG = {
  cookieName: 'liaa_admin_session',
  sessionTtlMs: Number(process.env.LIAA_SESSION_TTL_MS || 12 * 60 * 60 * 1000),
  passwordResetTtlMs: Number(process.env.LIAA_PASSWORD_RESET_TTL_MS || 20 * 60 * 1000),
  maxUploadBytes: 50 * 1024 * 1024, // 50 MB
  maxJsonBytes: 75 * 1024 * 1024,
  enforceHttps: process.env.LIAA_ENFORCE_HTTPS === 'true',
  trustProxy: process.env.LIAA_TRUST_PROXY === 'true',
  publicRegistrationEnabled: process.env.LIAA_PUBLIC_REGISTRATION === 'true',
  minPasswordLength: 10,
  rateLimitUserMaxAttempts: 6,
  rateLimitIpMaxAttempts: 25,
  rateLimitWindowMs: 15 * 60 * 1000,
};

export const MAIL_CONFIG = {
  host: process.env.SMTP_HOST || '',
  port: Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === 'true' || Number(process.env.SMTP_PORT) === 465,
  user: process.env.SMTP_USER || '',
  pass: process.env.SMTP_PASS || '',
  from: process.env.SMTP_FROM || process.env.SMTP_USER || 'no-reply@liaa.uaz.edu.mx',
  publicUrl: (process.env.LIAA_PUBLIC_URL || '').replace(/\/+$/, ''),
  get isConfigured() {
    return Boolean(this.host && this.user && this.pass);
  },
};

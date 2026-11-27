import crypto from 'node:crypto';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { EXTERNAL_SECRETS, PATHS } from './config.mjs';
import { SYSTEM_ROLES } from './permissions.mjs';
import { encryptSecret } from './cryptoVault.mjs';

let dbInstance = null;

export function hashPassword(password, saltHex) {
  const salt = saltHex || crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash: derived };
}

export function verifyPassword(password, salt, expectedHash) {
  if (!password || !salt || !expectedHash) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHash, 'hex');
  if (derived.length !== expected.length) return false;
  return crypto.timingSafeEqual(derived, expected);
}

function ensureColumn(db, tableName, columnName, columnDef) {
  const cols = db.prepare(`PRAGMA table_info(${tableName})`).all();
  if (!cols.some((c) => c.name === columnName)) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDef}`);
  }
}

export function getDb() {
  if (dbInstance) return dbInstance;

  fs.mkdirSync(PATHS.dataDir, { recursive: true });
  const db = new DatabaseSync(PATHS.dbFile);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA busy_timeout = 5000;');
  db.exec('PRAGMA foreign_keys = ON;');

  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS roles (
      id TEXT PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      is_system INTEGER NOT NULL DEFAULT 0,
      permissions_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      email TEXT DEFAULT '',
      display_name TEXT NOT NULL,
      role_id TEXT NOT NULL REFERENCES roles(id),
      custom_permissions_json TEXT DEFAULT '{}',
      avatar TEXT DEFAULT '/images/liaa-emblem.png',
      salt TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      locked_until TEXT DEFAULT NULL,
      must_change_password INTEGER NOT NULL DEFAULT 0,
      totp_secret TEXT DEFAULT NULL,
      totp_pending_secret TEXT DEFAULT NULL,
      totp_enabled INTEGER NOT NULL DEFAULT 0,
      last_login_at TEXT DEFAULT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      csrf_token TEXT NOT NULL,
      ip TEXT DEFAULT '',
      user_agent TEXT DEFAULT '',
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      revoked_at TEXT DEFAULT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      used_at TEXT DEFAULT NULL,
      requested_ip TEXT DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_pwd_reset_user ON password_reset_tokens(user_id);
    CREATE INDEX IF NOT EXISTS idx_pwd_reset_expires ON password_reset_tokens(expires_at);

    CREATE TABLE IF NOT EXISTS rate_limits (
      key TEXT PRIMARY KEY,
      attempts INTEGER NOT NULL DEFAULT 0,
      reset_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor_id TEXT DEFAULT NULL,
      actor_username TEXT DEFAULT '',
      actor_role TEXT DEFAULT '',
      action TEXT NOT NULL,
      resource_type TEXT NOT NULL,
      resource_id TEXT DEFAULT '',
      details_json TEXT DEFAULT '{}',
      ip TEXT DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_logs(actor_id);

    CREATE TABLE IF NOT EXISTS content_store (
      key TEXT PRIMARY KEY,
      data_json TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      updated_by TEXT DEFAULT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS content_revisions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content_key TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      data_json TEXT NOT NULL,
      actor_id TEXT DEFAULT NULL,
      actor_username TEXT DEFAULT '',
      note TEXT DEFAULT '',
      created_at TEXT NOT NULL
    );
  `);

  // Safe schema migrations for existing databases
  ensureColumn(db, 'users', 'totp_pending_secret', 'TEXT DEFAULT NULL');
  ensureColumn(db, 'content_store', 'version', 'INTEGER NOT NULL DEFAULT 1');
  ensureColumn(db, 'content_revisions', 'version', 'INTEGER NOT NULL DEFAULT 1');

  // Encrypt any legacy plaintext TOTP secrets at rest automatically
  const plaintextTotpUsers = db
    .prepare("SELECT id, totp_secret FROM users WHERE totp_secret IS NOT NULL AND totp_secret NOT LIKE 'enc:v1:%'")
    .all();
  for (const row of plaintextTotpUsers) {
    db.prepare('UPDATE users SET totp_secret = ? WHERE id = ?').run(
      encryptSecret(row.totp_secret),
      row.id,
    );
  }

  seedInitialState(db);
  dbInstance = db;
  return db;
}

export function closeDbForTests() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

function seedInitialState(db) {
  const now = new Date().toISOString();

  // Seed 7 system roles (idempotent)
  const insertRole = db.prepare(`
    INSERT OR IGNORE INTO roles(id, slug, name, description, is_system, permissions_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const r of SYSTEM_ROLES) {
    insertRole.run(
      r.id,
      r.slug,
      r.name,
      r.description,
      r.isSystem,
      JSON.stringify(r.permissions),
      now,
      now,
    );
  }

  // Create initial superadmin only if users table is completely empty
  const userCount = db.prepare('SELECT COUNT(*) AS cnt FROM users').get().cnt;
  if (userCount === 0) {
    const initialUser = process.env.LIAA_ADMIN_USER || 'admin';
    const initialPass = process.env.LIAA_ADMIN_PASS || 'LiaaUaz2026!';
    const { salt, hash } = hashPassword(initialPass);
    db.prepare(`
      INSERT INTO users(
        id, username, email, display_name, role_id, custom_permissions_json,
        avatar, salt, password_hash, status, must_change_password, totp_enabled, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'role-superadmin', '{}', '/images/liaa-emblem.png', ?, ?, 'active', 0, 0, ?, ?)
    `).run('usr-superadmin-1', initialUser, '', 'Superadministrador LIAA', salt, hash, now, now);
  }

  // Seed site_content into SQLite from public/content.json if empty
  const contentRow = db.prepare('SELECT key FROM content_store WHERE key = ?').get('site_content');
  if (!contentRow && fs.existsSync(PATHS.contentFile)) {
    const jsonText = fs.readFileSync(PATHS.contentFile, 'utf8');
    db.prepare(
      'INSERT INTO content_store(key, data_json, version, updated_by, updated_at) VALUES (?, ?, 1, ?, ?)',
    ).run('site_content', jsonText, 'system-seed', now);
  }
}

export function getSessionSecret() {
  // Always sourced from external environment secret (outside SQLite)
  return EXTERNAL_SECRETS.sessionSecret;
}

export function recordAudit({
  actor = null,
  action,
  resourceType,
  resourceId = '',
  details = {},
  ip = '',
}) {
  const db = getDb();
  // Never store raw passwords in audit details
  const safeDetails = { ...(details || {}) };
  delete safeDetails.password;
  delete safeDetails.newPassword;
  delete safeDetails.currentPassword;
  delete safeDetails.totpSecret;

  db.prepare(`
    INSERT INTO audit_logs(actor_id, actor_username, actor_role, action, resource_type, resource_id, details_json, ip, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    actor?.id || null,
    actor?.username || 'system',
    actor?.roleSlug || actor?.role || '',
    action,
    resourceType,
    String(resourceId || ''),
    JSON.stringify(safeDetails),
    ip || '',
    new Date().toISOString(),
  );
}

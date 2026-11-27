import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { APP_ENV, MAIL_CONFIG, PATHS, SECURITY_CONFIG } from './config.mjs';
import { getDb, getSessionSecret, hashPassword, recordAudit, verifyPassword } from './db.mjs';
import { decryptSecret, encryptSecret } from './cryptoVault.mjs';
import {
  formatSmtpError,
  getEffectivePublicUrl,
  getPublicSmtpSettings,
  maskEmail,
  saveSmtpSettings,
  sendPasswordResetEmail,
  sendSmtpTestEmail,
} from './mailer.mjs';
import {
  ALL_PERMISSION_KEYS,
  PERMISSION_CATALOG,
  resolveEffectivePermissions,
  userHasPermission,
} from './permissions.mjs';
import {
  ALLOWED_IMAGE_SPECS,
  getClientIp,
  validatePasswordPolicy,
  validateSafeUrl,
  validateSiteContentUrls,
  validateUploadedImage,
} from './security.mjs';
import { buildOtpAuthUri, generateTotpSecret, verifyTotpCode } from './totp.mjs';

const STATIC_IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function isValidEmail(val) {
  return typeof val === 'string' && EMAIL_REGEX.test(val.trim());
}

function hashResetToken(rawToken) {
  return crypto.createHash('sha256').update(String(rawToken || '')).digest('hex');
}

function resolvePublicOrigin(req, db) {
  const configuredUrl = getEffectivePublicUrl(db);
  if (configuredUrl) return configuredUrl;
  const rawHost = String(req.headers['x-forwarded-host'] || req.headers.host || 'localhost:5173')
    .split(',')[0]
    .trim();
  const safeHost = /^[a-zA-Z0-9.-]+(:\d{1,5})?$/.test(rawHost) ? rawHost : 'localhost:5173';
  const rawProto = SECURITY_CONFIG.trustProxy
    ? String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim()
    : '';
  const proto =
    rawProto === 'https' || SECURITY_CONFIG.enforceHttps || Boolean(req.socket?.encrypted)
      ? 'https'
      : 'http';
  return `${proto}://${safeHost}`;
}

function issuePasswordResetToken(db, userId, ip) {
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const ttlMs = SECURITY_CONFIG.passwordResetTtlMs;
  const expiresAt = new Date(nowMs + ttlMs).toISOString();
  const expiresMinutes = Math.max(1, Math.round(ttlMs / 60000));
  const rawToken = crypto.randomBytes(32).toString('base64url');
  const tokenHash = hashResetToken(rawToken);
  const id = `prt_${crypto.randomBytes(10).toString('hex')}`;

  db.prepare(
    'UPDATE password_reset_tokens SET used_at = ? WHERE user_id = ? AND used_at IS NULL',
  ).run(nowIso, userId);

  db.prepare(`
    INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, used_at, requested_ip, created_at)
    VALUES (?, ?, ?, ?, NULL, ?, ?)
  `).run(id, userId, tokenHash, expiresAt, ip || '', nowIso);

  return { id, rawToken, expiresAt, expiresMinutes };
}

function signToken(payloadObj) {
  const secret = getSessionSecret();
  const payload = Buffer.from(JSON.stringify(payloadObj)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expectedSig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(payload)
    .digest('base64url');

  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!data || typeof data.exp !== 'number' || data.exp < Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

function parseCookies(req) {
  const header = req.headers.cookie || '';
  const map = {};
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) map[key] = decodeURIComponent(val);
  }
  return map;
}

function makeCookieHeader(token, maxAgeSec) {
  const secureFlag = SECURITY_CONFIG.enforceHttps ? '; Secure' : '';
  return `${SECURITY_CONFIG.cookieName}=${encodeURIComponent(
    token,
  )}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSec}${secureFlag}`;
}

function sendJson(res, statusCode, payload, extraHeaders = {}) {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    ...extraHeaders,
  };
  if (SECURITY_CONFIG.enforceHttps) {
    headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains';
  }
  res.writeHead(statusCode, headers);
  res.end(JSON.stringify(payload));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > SECURITY_CONFIG.maxJsonBytes) {
        reject(new Error('PAYLOAD_TOO_LARGE'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        const text = Buffer.concat(chunks).toString('utf8');
        resolve(text ? JSON.parse(text) : {});
      } catch {
        reject(new Error('INVALID_JSON'));
      }
    });
    req.on('error', reject);
  });
}

// --- Persistent SQLite Rate Limiting ---
function checkRateLimitKey(key, maxAttempts) {
  const db = getDb();
  const row = db.prepare('SELECT attempts, reset_at FROM rate_limits WHERE key = ?').get(key);
  if (!row) return { allowed: true };
  const resetMs = new Date(row.reset_at).getTime();
  if (Date.now() > resetMs) {
    db.prepare('DELETE FROM rate_limits WHERE key = ?').run(key);
    return { allowed: true };
  }
  if (row.attempts >= maxAttempts) {
    return { allowed: false, retryAfterSec: Math.max(1, Math.ceil((resetMs - Date.now()) / 1000)) };
  }
  return { allowed: true };
}

function recordRateLimitHit(key) {
  const db = getDb();
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const resetIso = new Date(now + SECURITY_CONFIG.rateLimitWindowMs).toISOString();
  const row = db.prepare('SELECT attempts, reset_at FROM rate_limits WHERE key = ?').get(key);

  if (!row || now > new Date(row.reset_at).getTime()) {
    db.prepare(`
      INSERT INTO rate_limits(key, attempts, reset_at, updated_at)
      VALUES (?, 1, ?, ?)
      ON CONFLICT(key) DO UPDATE SET attempts = 1, reset_at = excluded.reset_at, updated_at = excluded.updated_at
    `).run(key, resetIso, nowIso);
  } else {
    db.prepare('UPDATE rate_limits SET attempts = attempts + 1, updated_at = ? WHERE key = ?').run(
      nowIso,
      key,
    );
  }
}

function clearRateLimitKey(key) {
  const db = getDb();
  db.prepare('DELETE FROM rate_limits WHERE key = ?').run(key);
}

// --- Users & Permissions Helpers ---
function loadUserWithRoleById(userId) {
  const db = getDb();
  const row = db
    .prepare(`
      SELECT
        u.*,
        r.slug AS role_slug,
        r.name AS role_name,
        r.permissions_json AS role_permissions_json
      FROM users u
      JOIN roles r ON r.id = u.role_id
      WHERE u.id = ?
    `)
    .get(userId);
  return row ? formatAuthUser(row) : null;
}

function formatAuthUser(row) {
  let rolePerms = [];
  let customOverrides = {};
  try {
    rolePerms = JSON.parse(row.role_permissions_json || '[]');
  } catch {
    rolePerms = [];
  }
  try {
    customOverrides = JSON.parse(row.custom_permissions_json || '{}');
  } catch {
    customOverrides = {};
  }

  const permissions = resolveEffectivePermissions(rolePerms, customOverrides);

  return {
    id: row.id,
    username: row.username,
    email: row.email || '',
    displayName: row.display_name || row.username,
    roleId: row.role_id,
    roleSlug: row.role_slug,
    roleName: row.role_name,
    role: row.role_slug === 'superadmin' || row.role_slug === 'admin' ? 'master' : 'adjunto',
    permissions,
    customPermissions: {
      grant: Array.isArray(customOverrides?.grant) ? customOverrides.grant : [],
      deny: Array.isArray(customOverrides?.deny) ? customOverrides.deny : [],
    },
    avatar: row.avatar || '/images/liaa-emblem.png',
    status: row.status,
    lockedUntil: row.locked_until || null,
    mustChangePassword: Boolean(row.must_change_password),
    totpEnabled: Boolean(row.totp_enabled),
    lastLoginAt: row.last_login_at || null,
    createdAt: row.created_at,
  };
}

function canActorGrantPermissions(actorPermissions, targetPermissions) {
  if (actorPermissions.includes('*')) return true;
  if (targetPermissions.includes('*')) return false;
  return targetPermissions.every((p) => actorPermissions.includes(p));
}

function getAuthenticatedSession(req) {
  const cookies = parseCookies(req);
  const parsed = verifyToken(cookies[SECURITY_CONFIG.cookieName]);
  if (!parsed || !parsed.sid) return null;

  const db = getDb();
  const session = db
    .prepare('SELECT * FROM sessions WHERE id = ? AND revoked_at IS NULL')
    .get(parsed.sid);

  if (!session) return null;
  if (new Date(session.expires_at).getTime() < Date.now()) return null;

  const user = loadUserWithRoleById(session.user_id);
  if (!user || user.status !== 'active') return null;
  if (user.lockedUntil && new Date(user.lockedUntil).getTime() > Date.now()) return null;

  return { session, user };
}

function verifyCsrf(req, session) {
  const headerToken = req.headers['x-csrf-token'];
  if (typeof headerToken !== 'string' || !session?.csrf_token) return false;
  const a = Buffer.from(headerToken);
  const b = Buffer.from(session.csrf_token);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function createSessionForUser(user, req, ip) {
  const db = getDb();
  const sid = `sess_${crypto.randomBytes(20).toString('hex')}`;
  const csrfToken = crypto.randomBytes(24).toString('hex');
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SECURITY_CONFIG.sessionTtlMs);
  const ua = String(req.headers['user-agent'] || '').slice(0, 200);

  db.prepare(`
    INSERT INTO sessions(id, user_id, csrf_token, ip, user_agent, created_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(sid, user.id, csrfToken, ip, ua, now.toISOString(), expiresAt.toISOString());

  db.prepare('UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?').run(
    now.toISOString(),
    now.toISOString(),
    user.id,
  );

  const signed = signToken({ sid, uid: user.id, exp: expiresAt.getTime() });
  const maxAge = Math.floor(SECURITY_CONFIG.sessionTtlMs / 1000);
  return { sid, csrfToken, cookie: makeCookieHeader(signed, maxAge) };
}

// --- Content Persistence & Optimistic Concurrency Control ---
function readContentRecord() {
  const db = getDb();
  const row = db
    .prepare('SELECT data_json, version, updated_at FROM content_store WHERE key = ?')
    .get('site_content');
  if (row) {
    return {
      data: JSON.parse(row.data_json),
      version: Number(row.version || 1),
      updatedAt: row.updated_at,
    };
  }
  if (fs.existsSync(PATHS.contentFile)) {
    return {
      data: JSON.parse(fs.readFileSync(PATHS.contentFile, 'utf8')),
      version: 1,
      updatedAt: new Date().toISOString(),
    };
  }
  return null;
}

function syncContentFileSafe(jsonText) {
  fs.mkdirSync(path.dirname(PATHS.contentFile), { recursive: true });
  const uniqueTmp = `${PATHS.contentFile}.${process.pid}.${Date.now()}.${crypto
    .randomBytes(3)
    .toString('hex')}.tmp`;
  fs.writeFileSync(uniqueTmp, jsonText, 'utf8');
  try {
    fs.renameSync(uniqueTmp, PATHS.contentFile);
  } catch {
    // Windows fallback when destination file is momentarily locked by reader/AV
    fs.copyFileSync(uniqueTmp, PATHS.contentFile);
    try {
      fs.unlinkSync(uniqueTmp);
    } catch {
      // Best-effort cleanup
    }
  }
}

/**
 * Atomic SQLite update with optimistic concurrency check (expectedVersion).
 * Uses BEGIN IMMEDIATE to prevent lost updates under concurrent requests.
 */
function updateContentTransactional({ expectedVersion, mutate, actor, note }) {
  const db = getDb();
  db.exec('BEGIN IMMEDIATE');
  try {
    const row = db
      .prepare('SELECT data_json, version FROM content_store WHERE key = ?')
      .get('site_content');
    const currentVersion = row ? Number(row.version || 1) : 1;
    const currentData = row
      ? JSON.parse(row.data_json)
      : fs.existsSync(PATHS.contentFile)
      ? JSON.parse(fs.readFileSync(PATHS.contentFile, 'utf8'))
      : {};

    if (
      expectedVersion !== undefined &&
      expectedVersion !== null &&
      Number(expectedVersion) !== currentVersion
    ) {
      db.exec('ROLLBACK');
      return {
        ok: false,
        status: 409,
        code: 'VERSION_CONFLICT',
        currentVersion,
        error: `Conflicto de edición: el contenido fue modificado por otro usuario (versión actual v${currentVersion}, tu versión era v${expectedVersion}). Recarga antes de guardar.`,
      };
    }

    const mutated = mutate(currentData);
    if (!mutated.ok) {
      db.exec('ROLLBACK');
      return mutated;
    }

    const nextData = mutated.data;
    delete nextData._version;

    const urlValidation = validateSiteContentUrls(nextData);
    if (!urlValidation.ok) {
      db.exec('ROLLBACK');
      return { ok: false, status: 400, error: `URL no válida — ${urlValidation.error}` };
    }

    const nextVersion = currentVersion + 1;
    const now = new Date().toISOString();
    const jsonText = JSON.stringify(nextData, null, 2);

    db.prepare(`
      INSERT INTO content_store(key, data_json, version, updated_by, updated_at)
      VALUES ('site_content', ?, ?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        data_json = excluded.data_json,
        version = excluded.version,
        updated_by = excluded.updated_by,
        updated_at = excluded.updated_at
    `).run(jsonText, nextVersion, actor?.id || 'system', now);

    db.prepare(`
      INSERT INTO content_revisions(content_key, version, data_json, actor_id, actor_username, note, created_at)
      VALUES ('site_content', ?, ?, ?, ?, ?, ?)
    `).run(nextVersion, jsonText, actor?.id || null, actor?.username || 'system', note, now);

    db.prepare(`
      DELETE FROM content_revisions
      WHERE id NOT IN (SELECT id FROM content_revisions ORDER BY id DESC LIMIT 50)
    `).run();

    db.exec('COMMIT');

    // Sync static snapshot after durable SQLite commit
    syncContentFileSafe(jsonText);

    return { ok: true, version: nextVersion, savedAt: now, data: nextData };
  } catch (err) {
    try {
      db.exec('ROLLBACK');
    } catch {
      // Ignore rollback errors if not in transaction
    }
    throw err;
  }
}

function stableEqual(a, b) {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

/**
 * Enforces strict granular permissions on news changes:
 * content.create, content.edit_own, content.edit_any, content.publish, content.submit_review, content.delete
 */
function validateAndPrepareNewsMutation(existingArticles, incomingArticles, actor) {
  if (!Array.isArray(incomingArticles)) {
    return { ok: false, status: 400, error: 'Lista de publicaciones inválida.' };
  }

  const perms = actor.permissions || [];
  const canCreate = userHasPermission(perms, 'content.create');
  const canEditOwn = userHasPermission(perms, 'content.edit_own');
  const canEditAny = userHasPermission(perms, 'content.edit_any');
  const canPublish = userHasPermission(perms, 'content.publish');
  const canSubmitReview = userHasPermission(perms, 'content.submit_review');
  const canDelete = userHasPermission(perms, 'content.delete');

  const existingBySlug = new Map(
    (Array.isArray(existingArticles) ? existingArticles : []).map((a) => [a.slug, a]),
  );
  const incomingSlugs = new Set(incomingArticles.map((a) => a.slug));

  // Check deletions
  for (const [slug, oldArt] of existingBySlug.entries()) {
    if (!incomingSlugs.has(slug)) {
      if (!canDelete) {
        return {
          ok: false,
          status: 403,
          error: 'No tienes permiso (content.delete) para eliminar publicaciones.',
        };
      }
      const isOwner = Boolean(oldArt.authorId && oldArt.authorId === actor.id);
      if (!isOwner && !canEditAny) {
        return {
          ok: false,
          status: 403,
          error: 'No tienes permiso (content.edit_any) para eliminar publicaciones de otros autores.',
        };
      }
    }
  }

  const prepared = [];
  for (const art of incomingArticles) {
    if (!art || typeof art !== 'object' || typeof art.slug !== 'string' || !art.slug.trim()) {
      return { ok: false, status: 400, error: 'Cada publicación debe incluir un slug válido.' };
    }

    const prev = existingBySlug.get(art.slug);
    const requestedStatus =
      art.status === 'draft' || art.status === 'review' || art.status === 'published'
        ? art.status
        : prev
        ? prev.status || 'published'
        : canPublish
        ? 'published'
        : 'draft';

    if (!prev) {
      // Creating a new article
      if (!canCreate) {
        return {
          ok: false,
          status: 403,
          error: 'No tienes permiso (content.create) para crear nuevas publicaciones.',
        };
      }
      if (requestedStatus === 'published' && !canPublish) {
        return {
          ok: false,
          status: 403,
          error:
            'No tienes permiso (content.publish) para publicar directamente. Guárdala como borrador o envíala a revisión.',
        };
      }
      if (requestedStatus === 'review' && !canSubmitReview && !canPublish) {
        return {
          ok: false,
          status: 403,
          error: 'No tienes permiso (content.submit_review) para enviar a revisión.',
        };
      }
      prepared.push({
        ...art,
        authorId: actor.id,
        status: requestedStatus,
      });
    } else {
      // Existing article: check whether it was modified
      const normalizedPrev = {
        ...prev,
        authorId: prev.authorId ?? null,
        status: prev.status || 'published',
      };
      const normalizedNext = {
        ...art,
        authorId: prev.authorId ?? art.authorId ?? null,
        status: requestedStatus,
      };

      const changed = !stableEqual(normalizedPrev, normalizedNext);
      if (changed) {
        const isOwner = Boolean(prev.authorId && prev.authorId === actor.id);
        if (isOwner) {
          if (!canEditOwn && !canEditAny) {
            return {
              ok: false,
              status: 403,
              error: 'No tienes permiso (content.edit_own) para editar tus publicaciones.',
            };
          }
        } else if (!canEditAny) {
          return {
            ok: false,
            status: 403,
            error:
              'No tienes permiso (content.edit_any) para modificar publicaciones de otros autores.',
          };
        }

        const prevStatus = prev.status || 'published';
        if (
          (requestedStatus === 'published' && prevStatus !== 'published') ||
          (prevStatus === 'published' && requestedStatus !== 'published')
        ) {
          if (!canPublish) {
            return {
              ok: false,
              status: 403,
              error: 'No tienes permiso (content.publish) para publicar o despublicar contenido.',
            };
          }
        }
      }

      prepared.push(normalizedNext);
    }
  }

  return { ok: true, articles: prepared };
}

function listAllImages() {
  const results = [];
  if (fs.existsSync(PATHS.imagesDir)) {
    for (const entry of fs.readdirSync(PATHS.imagesDir, { withFileTypes: true })) {
      if (!entry.isFile()) continue;
      const ext = path.extname(entry.name).toLowerCase();
      if (!STATIC_IMAGE_EXTENSIONS.has(ext)) continue;
      const stat = fs.statSync(path.join(PATHS.imagesDir, entry.name));
      results.push({
        name: entry.name,
        url: `/images/${entry.name}`,
        size: stat.size,
        uploaded: false,
        updatedAt: stat.mtime.toISOString(),
      });
    }
  }
  if (fs.existsSync(PATHS.uploadsDir)) {
    for (const entry of fs.readdirSync(PATHS.uploadsDir, { withFileTypes: true })) {
      if (!entry.isFile()) continue;
      const ext = path.extname(entry.name).toLowerCase();
      if (!STATIC_IMAGE_EXTENSIONS.has(ext)) continue;
      const stat = fs.statSync(path.join(PATHS.uploadsDir, entry.name));
      results.push({
        name: entry.name,
        url: `/images/uploads/${entry.name}`,
        size: stat.size,
        uploaded: true,
        updatedAt: stat.mtime.toISOString(),
      });
    }
  }
  return results.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

function parseExpectedVersion(req, body) {
  if (body && body.expectedVersion !== undefined && body.expectedVersion !== null) {
    return Number(body.expectedVersion);
  }
  const ifMatch = req.headers['if-match'];
  if (typeof ifMatch === 'string') {
    const m = /"?v?(\d+)"?/.exec(ifMatch.trim());
    if (m) return Number(m[1]);
  }
  return undefined;
}

export async function handleCmsApi(req, res) {
  const parsedUrl = new URL(req.url || '/', 'http://localhost');
  const pathname = parsedUrl.pathname;

  if (!pathname.startsWith('/api/')) {
    return false;
  }

  const db = getDb();
  const method = (req.method || 'GET').toUpperCase();
  const ip = getClientIp(req);

  try {
    // --- PUBLIC READ OF SITE CONTENT ---
    if (pathname === '/api/content' && method === 'GET') {
      const record = readContentRecord();
      if (!record) {
        sendJson(res, 404, { error: 'Contenido no encontrado.' });
        return true;
      }

      const auth = getAuthenticatedSession(req);
      const includeDrafts = Boolean(
        auth &&
          userHasPermission(auth.user.permissions, [
            'content.create',
            'content.edit_own',
            'content.edit_any',
            'content.publish',
          ]),
      );

      const responseData = {
        ...record.data,
        newsArticles: Array.isArray(record.data.newsArticles)
          ? includeDrafts
            ? record.data.newsArticles
            : record.data.newsArticles.filter((a) => !a.status || a.status === 'published')
          : [],
        _version: record.version,
      };

      sendJson(res, 200, responseData, { ETag: `"v${record.version}"` });
      return true;
    }

    // --- AUTH STATUS CHECK ---
    if (pathname === '/api/auth/me' && method === 'GET') {
      const auth = getAuthenticatedSession(req);
      sendJson(res, 200, {
        authenticated: Boolean(auth),
        env: APP_ENV,
        publicRegistrationEnabled: SECURITY_CONFIG.publicRegistrationEnabled,
        csrfToken: auth ? auth.session.csrf_token : null,
        username: auth ? auth.user.username : '',
        user: auth ? auth.user : null,
      });
      return true;
    }

    // --- LOGIN STEP 1 ---
    if (pathname === '/api/auth/login' && method === 'POST') {
      const body = await readJsonBody(req);
      const username = typeof body.username === 'string' ? body.username.trim() : '';
      const password = typeof body.password === 'string' ? body.password : '';

      const ipKey = `login:ip:${ip}`;
      const pairKey = `login:pair:${ip}:${username.toLowerCase()}`;

      const ipRate = checkRateLimitKey(ipKey, SECURITY_CONFIG.rateLimitIpMaxAttempts);
      if (!ipRate.allowed) {
        sendJson(res, 429, {
          error: `Demasiados intentos desde esta dirección. Intenta en ${ipRate.retryAfterSec} segundos.`,
        });
        return true;
      }

      const pairRate = checkRateLimitKey(pairKey, SECURITY_CONFIG.rateLimitUserMaxAttempts);
      if (!pairRate.allowed) {
        sendJson(res, 429, {
          error: `Demasiados intentos fallidos para esta cuenta. Intenta de nuevo en ${pairRate.retryAfterSec} segundos.`,
        });
        return true;
      }

      const row = db
        .prepare(`
          SELECT u.*, r.slug AS role_slug, r.name AS role_name, r.permissions_json AS role_permissions_json
          FROM users u
          JOIN roles r ON r.id = u.role_id
          WHERE LOWER(u.username) = LOWER(?)
        `)
        .get(username);

      const validPass = row && verifyPassword(password, row.salt, row.password_hash);
      if (!validPass) {
        recordRateLimitHit(ipKey);
        recordRateLimitHit(pairKey);
        recordAudit({
          actor: row
            ? { id: row.id, username: row.username, roleSlug: row.role_slug }
            : { username },
          action: 'auth.login_failed',
          resourceType: 'auth',
          details: { reason: 'invalid_credentials' },
          ip,
        });
        sendJson(res, 401, { error: 'Usuario o contraseña incorrectos.' });
        return true;
      }

      if (row.status === 'suspended') {
        sendJson(res, 403, { error: 'Tu cuenta se encuentra suspendida. Contacta al administrador.' });
        return true;
      }
      if (row.status === 'disabled') {
        sendJson(res, 403, { error: 'Tu cuenta está desactivada.' });
        return true;
      }
      if (row.locked_until && new Date(row.locked_until).getTime() > Date.now()) {
        sendJson(res, 423, {
          error: `Tu acceso está bloqueado temporalmente hasta ${new Date(
            row.locked_until,
          ).toLocaleString('es-MX')}.`,
        });
        return true;
      }

      clearRateLimitKey(pairKey);

      if (row.totp_enabled && row.totp_secret) {
        const challengeToken = signToken({
          purpose: '2fa',
          uid: row.id,
          exp: Date.now() + 5 * 60 * 1000,
        });
        sendJson(res, 200, {
          requires2FA: true,
          challengeToken,
          username: row.username,
        });
        return true;
      }

      const formattedUser = formatAuthUser(row);
      const { csrfToken, cookie } = createSessionForUser(formattedUser, req, ip);
      recordAudit({
        actor: formattedUser,
        action: 'auth.login',
        resourceType: 'session',
        details: { method: 'password', env: APP_ENV },
        ip,
      });

      sendJson(
        res,
        200,
        {
          ok: true,
          env: APP_ENV,
          csrfToken,
          username: formattedUser.username,
          user: formattedUser,
        },
        { 'Set-Cookie': cookie },
      );
      return true;
    }

    // --- LOGIN STEP 2 (2FA TOTP) ---
    if (pathname === '/api/auth/login-2fa' && method === 'POST') {
      const body = await readJsonBody(req);
      const challenge = verifyToken(body.challengeToken);
      const code = typeof body.code === 'string' ? body.code : '';

      if (!challenge || challenge.purpose !== '2fa' || !challenge.uid) {
        sendJson(res, 401, { error: 'El reto de verificación 2FA expiró. Inicia sesión de nuevo.' });
        return true;
      }

      const twoFaKey = `2fa:${ip}:${challenge.uid}`;
      const rate = checkRateLimitKey(twoFaKey, SECURITY_CONFIG.rateLimitUserMaxAttempts);
      if (!rate.allowed) {
        sendJson(res, 429, {
          error: `Demasiados intentos de 2FA. Espera ${rate.retryAfterSec} segundos.`,
        });
        return true;
      }

      const row = db
        .prepare(`
          SELECT u.*, r.slug AS role_slug, r.name AS role_name, r.permissions_json AS role_permissions_json
          FROM users u
          JOIN roles r ON r.id = u.role_id
          WHERE u.id = ?
        `)
        .get(challenge.uid);

      const decryptedSecret = row?.totp_secret ? decryptSecret(row.totp_secret) : null;
      if (!row || !decryptedSecret || !verifyTotpCode(decryptedSecret, code)) {
        recordRateLimitHit(twoFaKey);
        recordAudit({
          actor: row ? { id: row.id, username: row.username, roleSlug: row.role_slug } : null,
          action: 'auth.2fa_failed',
          resourceType: 'auth',
          ip,
        });
        sendJson(res, 401, { error: 'Código 2FA inválido. Verifica tu app autenticadora.' });
        return true;
      }

      clearRateLimitKey(twoFaKey);
      const formattedUser = formatAuthUser(row);
      const { csrfToken, cookie } = createSessionForUser(formattedUser, req, ip);
      recordAudit({
        actor: formattedUser,
        action: 'auth.login',
        resourceType: 'session',
        details: { method: 'password+2fa', env: APP_ENV },
        ip,
      });

      sendJson(
        res,
        200,
        {
          ok: true,
          env: APP_ENV,
          csrfToken,
          username: formattedUser.username,
          user: formattedUser,
        },
        { 'Set-Cookie': cookie },
      );
      return true;
    }

    // --- LOGOUT ---
    if (pathname === '/api/auth/logout' && method === 'POST') {
      const auth = getAuthenticatedSession(req);
      if (auth) {
        db.prepare('UPDATE sessions SET revoked_at = ? WHERE id = ?').run(
          new Date().toISOString(),
          auth.session.id,
        );
        recordAudit({
          actor: auth.user,
          action: 'auth.logout',
          resourceType: 'session',
          resourceId: auth.session.id,
          ip,
        });
      }
      sendJson(res, 200, { ok: true }, { 'Set-Cookie': makeCookieHeader('', 0) });
      return true;
    }

    // --- PASSWORD RESET REQUEST / VALIDATE / CONFIRM ---
    if (pathname === '/api/auth/password-reset/request' && method === 'POST') {
      const ipRate = checkRateLimitKey(`pwdreset:ip:${ip}`, 8);
      if (!ipRate.allowed) {
        sendJson(res, 429, {
          error: `Demasiadas solicitudes de recuperación desde esta IP. Intenta en ${ipRate.retryAfterSec} segundos.`,
        });
        return true;
      }

      const body = await readJsonBody(req);
      const rawIdentifier = typeof body.identifier === 'string' ? body.identifier.trim() : '';
      if (!rawIdentifier) {
        sendJson(res, 400, { error: 'Ingresa tu usuario o correo electrónico registrado.' });
        return true;
      }

      const idRateKey = `pwdreset:id:${rawIdentifier.toLowerCase()}`;
      const idRate = checkRateLimitKey(idRateKey, 4);
      if (!idRate.allowed) {
        sendJson(res, 429, {
          error: `Demasiados intentos recientes para esta cuenta. Intenta en ${idRate.retryAfterSec} segundos.`,
        });
        return true;
      }

      recordRateLimitHit(`pwdreset:ip:${ip}`);
      recordRateLimitHit(idRateKey);

      const userRow = db
        .prepare(`
          SELECT u.*, r.slug AS role_slug
          FROM users u
          JOIN roles r ON r.id = u.role_id
          WHERE LOWER(u.email) = LOWER(?) OR LOWER(u.username) = LOWER(?)
          LIMIT 1
        `)
        .get(rawIdentifier, rawIdentifier);

      const userEmail = typeof userRow?.email === 'string' ? userRow.email.trim() : '';
      if (!userRow || !isValidEmail(userEmail)) {
        recordAudit({
          actor: userRow
            ? { id: userRow.id, username: userRow.username, roleSlug: userRow.role_slug }
            : null,
          action: 'auth.password_reset_no_verified_email',
          resourceType: 'auth',
          details: { identifier: rawIdentifier },
          ip,
        });
        sendJson(res, 404, {
          code: 'EMAIL_NOT_VERIFIED_IN_PROFILE',
          error:
            'Tu correo no está verificado en ningún perfil, por favor contacta a soporte técnico para asistencia.',
        });
        return true;
      }

      if (userRow.status !== 'active') {
        sendJson(res, 403, {
          error:
            'Esta cuenta está desactivada o suspendida. Por favor contacta a soporte técnico para asistencia.',
        });
        return true;
      }

      const issued = issuePasswordResetToken(db, userRow.id, ip);
      const resetUrl = `${resolvePublicOrigin(req, db)}/admin?reset_token=${encodeURIComponent(issued.rawToken)}`;

      let deliveryResult;
      try {
        deliveryResult = await sendPasswordResetEmail({
          db,
          to: userEmail,
          displayName: userRow.display_name,
          username: userRow.username,
          resetUrl,
          expiresMinutes: issued.expiresMinutes,
        });
      } catch (mailErr) {
        db.prepare('UPDATE password_reset_tokens SET used_at = ? WHERE id = ?').run(
          new Date().toISOString(),
          issued.id,
        );
        console.error('[LIAA MAILER ERROR]', mailErr);
        sendJson(res, 502, {
          error: formatSmtpError(mailErr),
        });
        return true;
      }

      if (deliveryResult.mode === 'smtp_unconfigured') {
        db.prepare('UPDATE password_reset_tokens SET used_at = ? WHERE id = ?').run(
          new Date().toISOString(),
          issued.id,
        );
        sendJson(res, 503, {
          error:
            'El servicio de correo institucional aún no está configurado en el servidor. Contacta a soporte técnico para asistencia.',
        });
        return true;
      }

      recordAudit({
        actor: { id: userRow.id, username: userRow.username, roleSlug: userRow.role_slug },
        action: 'auth.password_reset_requested',
        resourceType: 'user',
        resourceId: userRow.id,
        details: { delivery: deliveryResult.mode, maskedEmail: maskEmail(userEmail) },
        ip,
      });

      const masked = maskEmail(userEmail);
      sendJson(res, 200, {
        ok: true,
        delivery: deliveryResult.mode,
        maskedEmail: masked,
        expiresMinutes: issued.expiresMinutes,
        message:
          deliveryResult.mode === 'smtp'
            ? `Enviamos un enlace de recuperación a ${masked}. Revisa tu bandeja de entrada o correo no deseado (expira en ${issued.expiresMinutes} minutos).`
            : `Enlace de recuperación generado para ${masked} (expira en ${issued.expiresMinutes} min). En modo desarrollo sin SMTP configurado, el enlace fue impreso en la consola del servidor.`,
      });
      return true;
    }

    if (pathname === '/api/auth/password-reset/validate' && method === 'GET') {
      const ipRate = checkRateLimitKey(`pwdreset_val:ip:${ip}`, 20);
      if (!ipRate.allowed) {
        sendJson(res, 429, { error: 'Demasiados intentos. Espera unos minutos.' });
        return true;
      }
      const token = parsedUrl.searchParams.get('token') || '';
      if (!token || token.length < 20) {
        sendJson(res, 400, { error: 'Enlace de recuperación inválido.' });
        return true;
      }

      const tokenHash = hashResetToken(token);
      const nowIso = new Date().toISOString();
      const row = db
        .prepare(`
          SELECT t.id, t.expires_at, u.username, u.display_name, u.status
          FROM password_reset_tokens t
          JOIN users u ON u.id = t.user_id
          WHERE t.token_hash = ? AND t.used_at IS NULL AND t.expires_at > ?
          LIMIT 1
        `)
        .get(tokenHash, nowIso);

      if (!row || row.status !== 'active') {
        recordRateLimitHit(`pwdreset_val:ip:${ip}`);
        sendJson(res, 400, {
          error: 'El enlace de recuperación es inválido, ya fue utilizado o ha expirado.',
        });
        return true;
      }

      sendJson(res, 200, {
        ok: true,
        username: row.username,
        displayName: row.display_name,
        expiresAt: row.expires_at,
      });
      return true;
    }

    if (pathname === '/api/auth/password-reset/confirm' && method === 'POST') {
      const ipRate = checkRateLimitKey(`pwdreset_confirm:ip:${ip}`, 10);
      if (!ipRate.allowed) {
        sendJson(res, 429, {
          error: `Demasiados intentos. Espera ${ipRate.retryAfterSec} segundos.`,
        });
        return true;
      }

      const body = await readJsonBody(req);
      const token = typeof body.token === 'string' ? body.token.trim() : '';
      const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';

      const policyCheck = validatePasswordPolicy(newPassword);
      if (!policyCheck.ok) {
        sendJson(res, 400, { error: policyCheck.error });
        return true;
      }

      if (!token || token.length < 20) {
        recordRateLimitHit(`pwdreset_confirm:ip:${ip}`);
        sendJson(res, 400, { error: 'Enlace de recuperación inválido.' });
        return true;
      }

      const tokenHash = hashResetToken(token);
      const nowIso = new Date().toISOString();
      let updatedUser = null;

      db.exec('BEGIN IMMEDIATE');
      try {
        const row = db
          .prepare(`
            SELECT t.id AS token_id, u.id AS user_id, u.username, u.status, r.slug AS role_slug
            FROM password_reset_tokens t
            JOIN users u ON u.id = t.user_id
            JOIN roles r ON r.id = u.role_id
            WHERE t.token_hash = ? AND t.used_at IS NULL AND t.expires_at > ?
            LIMIT 1
          `)
          .get(tokenHash, nowIso);

        if (!row || row.status !== 'active') {
          db.exec('ROLLBACK');
          recordRateLimitHit(`pwdreset_confirm:ip:${ip}`);
          sendJson(res, 400, {
            error: 'El enlace de recuperación es inválido, ya fue utilizado o ha expirado.',
          });
          return true;
        }

        const { salt, hash } = hashPassword(newPassword);
        db.prepare(`
          UPDATE users
          SET salt = ?, password_hash = ?, must_change_password = 0, locked_until = NULL, updated_at = ?
          WHERE id = ?
        `).run(salt, hash, nowIso, row.user_id);

        db.prepare(
          'UPDATE password_reset_tokens SET used_at = ? WHERE user_id = ? AND used_at IS NULL',
        ).run(nowIso, row.user_id);

        db.prepare(
          'UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL',
        ).run(nowIso, row.user_id);

        db.prepare('DELETE FROM rate_limits WHERE key = ?').run(
          `login:user:${row.username.toLowerCase()}`,
        );

        db.exec('COMMIT');
        updatedUser = row;
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }

      recordAudit({
        actor: {
          id: updatedUser.user_id,
          username: updatedUser.username,
          roleSlug: updatedUser.role_slug,
        },
        action: 'auth.password_reset_completed',
        resourceType: 'user',
        resourceId: updatedUser.user_id,
        ip,
      });

      sendJson(res, 200, {
        ok: true,
        message: 'Tu contraseña se restableció correctamente. Ya puedes iniciar sesión.',
      });
      return true;
    }

    // --- AUTHENTICATED ROUTES ---
    const auth = getAuthenticatedSession(req);
    if (!auth) {
      sendJson(res, 401, { error: 'Sesión expirada o no válida. Inicia sesión de nuevo.' });
      return true;
    }

    const { user: currentUser, session: currentSession } = auth;
    const isSuperAdmin = currentUser.roleSlug === 'superadmin';

    // Strict CSRF token validation on all authenticated mutating requests
    if (method !== 'GET' && method !== 'HEAD') {
      if (!verifyCsrf(req, currentSession)) {
        sendJson(res, 403, {
          error: 'Token CSRF inválido o ausente. Recarga la página e intenta de nuevo.',
        });
        return true;
      }
    }

    // --- SERVER-SIDE ENFORCEMENT OF MUST_CHANGE_PASSWORD ---
    if (currentUser.mustChangePassword) {
      const isPasswordUpdateRoute =
        (pathname === '/api/users/me' || pathname === '/api/auth/credentials') &&
        (method === 'PATCH' || method === 'POST');
      if (!isPasswordUpdateRoute) {
        sendJson(res, 403, {
          error:
            'Debes cambiar tu contraseña obligatoria antes de ejecutar cualquier otra operación.',
          code: 'PASSWORD_CHANGE_REQUIRED',
        });
        return true;
      }
    }

    // --- 2FA SETUP / ENABLE / DISABLE (SAFE PENDING SECRET + AES-256-GCM AT REST) ---
    if (pathname === '/api/auth/2fa/setup' && method === 'POST') {
      const secret = generateTotpSecret();
      const otpauthUri = buildOtpAuthUri({ secret, username: currentUser.username });
      const encryptedPending = encryptSecret(secret);
      // Store ONLY in totp_pending_secret — NEVER overwrite active totp_secret before confirmation!
      db.prepare('UPDATE users SET totp_pending_secret = ?, updated_at = ? WHERE id = ?').run(
        encryptedPending,
        new Date().toISOString(),
        currentUser.id,
      );
      sendJson(res, 200, { ok: true, secret, otpauthUri });
      return true;
    }

    if (pathname === '/api/auth/2fa/enable' && method === 'POST') {
      const body = await readJsonBody(req);
      const code = typeof body.code === 'string' ? body.code : '';
      const row = db
        .prepare('SELECT totp_pending_secret FROM users WHERE id = ?')
        .get(currentUser.id);
      const pendingPlain = row?.totp_pending_secret ? decryptSecret(row.totp_pending_secret) : null;

      if (!pendingPlain || !verifyTotpCode(pendingPlain, code)) {
        sendJson(res, 400, {
          error: 'Código de 6 dígitos incorrecto o configuración expirada. Verifica tu app.',
        });
        return true;
      }

      db.prepare(`
        UPDATE users
        SET totp_secret = ?, totp_pending_secret = NULL, totp_enabled = 1, updated_at = ?
        WHERE id = ?
      `).run(row.totp_pending_secret, new Date().toISOString(), currentUser.id);

      recordAudit({
        actor: currentUser,
        action: 'auth.2fa_enabled',
        resourceType: 'user',
        resourceId: currentUser.id,
        ip,
      });
      sendJson(res, 200, { ok: true, user: loadUserWithRoleById(currentUser.id) });
      return true;
    }

    if (pathname === '/api/auth/2fa/disable' && method === 'POST') {
      const body = await readJsonBody(req);
      const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : '';
      const row = db
        .prepare('SELECT salt, password_hash FROM users WHERE id = ?')
        .get(currentUser.id);
      if (!verifyPassword(currentPassword, row.salt, row.password_hash)) {
        sendJson(res, 400, { error: 'Debes confirmar tu contraseña actual para desactivar 2FA.' });
        return true;
      }
      db.prepare(`
        UPDATE users
        SET totp_enabled = 0, totp_secret = NULL, totp_pending_secret = NULL, updated_at = ?
        WHERE id = ?
      `).run(new Date().toISOString(), currentUser.id);
      recordAudit({
        actor: currentUser,
        action: 'auth.2fa_disabled',
        resourceType: 'user',
        resourceId: currentUser.id,
        ip,
      });
      sendJson(res, 200, { ok: true, user: loadUserWithRoleById(currentUser.id) });
      return true;
    }

    // --- PERMISSIONS & ROLES ---
    if (pathname === '/api/permissions' && method === 'GET') {
      sendJson(res, 200, { permissions: PERMISSION_CATALOG });
      return true;
    }

    if (pathname === '/api/roles' && method === 'GET') {
      const rows = db
        .prepare(`
          SELECT r.*, (SELECT COUNT(*) FROM users u WHERE u.role_id = r.id) AS user_count
          FROM roles r
          ORDER BY r.is_system DESC, r.created_at ASC
        `)
        .all();
      const roles = rows.map((r) => ({
        id: r.id,
        slug: r.slug,
        name: r.name,
        description: r.description || '',
        isSystem: Boolean(r.is_system),
        permissions: JSON.parse(r.permissions_json || '[]'),
        userCount: Number(r.user_count || 0),
        createdAt: r.created_at,
      }));
      sendJson(res, 200, { roles });
      return true;
    }

    if (pathname === '/api/roles' && method === 'POST') {
      if (!userHasPermission(currentUser.permissions, 'roles.manage')) {
        sendJson(res, 403, { error: 'No tienes permiso para crear roles personalizados.' });
        return true;
      }

      const body = await readJsonBody(req);
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      const description = typeof body.description === 'string' ? body.description.trim() : '';
      const rawPerms = Array.isArray(body.permissions) ? body.permissions : [];
      const validPerms = rawPerms.filter((p) => ALL_PERMISSION_KEYS.includes(p));

      if (name.length < 3) {
        sendJson(res, 400, { error: 'El nombre del rol debe tener al menos 3 caracteres.' });
        return true;
      }

      if (!canActorGrantPermissions(currentUser.permissions, validPerms)) {
        sendJson(res, 403, {
          error: 'No puedes crear un rol con permisos superiores a los tuyos.',
        });
        return true;
      }

      const baseSlug =
        name
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '_')
          .replace(/^_+|_+$/g, '') || 'rol';

      let slug = baseSlug;
      if (db.prepare('SELECT id FROM roles WHERE slug = ?').get(slug)) {
        slug = `${baseSlug}_${Date.now().toString(36).slice(-4)}`;
      }

      const id = `role-${Date.now().toString(36)}-${crypto.randomBytes(2).toString('hex')}`;
      const now = new Date().toISOString();

      db.prepare(`
        INSERT INTO roles(id, slug, name, description, is_system, permissions_json, created_at, updated_at)
        VALUES (?, ?, ?, ?, 0, ?, ?, ?)
      `).run(id, slug, name, description, JSON.stringify(validPerms), now, now);

      recordAudit({
        actor: currentUser,
        action: 'role.created',
        resourceType: 'role',
        resourceId: id,
        details: { name, slug, permissionsCount: validPerms.length },
        ip,
      });

      sendJson(res, 201, {
        ok: true,
        role: { id, slug, name, description, isSystem: false, permissions: validPerms, userCount: 0 },
      });
      return true;
    }

    if (pathname.startsWith('/api/roles/') && (method === 'PATCH' || method === 'DELETE')) {
      if (!userHasPermission(currentUser.permissions, 'roles.manage')) {
        sendJson(res, 403, { error: 'No tienes permiso para modificar roles.' });
        return true;
      }

      const roleId = decodeURIComponent(pathname.slice('/api/roles/'.length));
      const existing = db.prepare('SELECT * FROM roles WHERE id = ?').get(roleId);
      if (!existing) {
        sendJson(res, 404, { error: 'Rol no encontrado.' });
        return true;
      }

      if (existing.slug === 'superadmin') {
        sendJson(res, 400, { error: 'El rol Superadministrador no puede modificarse ni eliminarse.' });
        return true;
      }

      if (method === 'DELETE') {
        if (existing.is_system) {
          sendJson(res, 400, { error: 'Los roles predeterminados del sistema no pueden eliminarse.' });
          return true;
        }
        const assigned = db.prepare('SELECT COUNT(*) AS cnt FROM users WHERE role_id = ?').get(roleId).cnt;
        if (assigned > 0) {
          sendJson(res, 400, {
            error: `Hay ${assigned} usuario(s) con este rol. Reasígnalos antes de eliminarlo.`,
          });
          return true;
        }
        db.prepare('DELETE FROM roles WHERE id = ?').run(roleId);
        recordAudit({
          actor: currentUser,
          action: 'role.deleted',
          resourceType: 'role',
          resourceId: roleId,
          details: { name: existing.name },
          ip,
        });
        sendJson(res, 200, { ok: true });
        return true;
      }

      const body = await readJsonBody(req);
      const nextName =
        typeof body.name === 'string' && body.name.trim().length >= 3
          ? body.name.trim()
          : existing.name;
      const nextDesc =
        typeof body.description === 'string' ? body.description.trim() : existing.description;
      const nextPerms = Array.isArray(body.permissions)
        ? body.permissions.filter((p) => ALL_PERMISSION_KEYS.includes(p))
        : JSON.parse(existing.permissions_json || '[]');

      if (!canActorGrantPermissions(currentUser.permissions, nextPerms)) {
        sendJson(res, 403, {
          error: 'No puedes asignar a un rol permisos que tú mismo no posees.',
        });
        return true;
      }

      db.prepare(`
        UPDATE roles SET name = ?, description = ?, permissions_json = ?, updated_at = ?
        WHERE id = ?
      `).run(nextName, nextDesc, JSON.stringify(nextPerms), new Date().toISOString(), roleId);

      recordAudit({
        actor: currentUser,
        action: 'role.updated',
        resourceType: 'role',
        resourceId: roleId,
        details: { name: nextName, permissionsCount: nextPerms.length },
        ip,
      });

      sendJson(res, 200, { ok: true });
      return true;
    }

    // --- USERS MANAGEMENT ---
    if (pathname === '/api/users' && method === 'GET') {
      const canViewAll = userHasPermission(currentUser.permissions, ['users.view', 'users.manage']);
      const nowIso = new Date().toISOString();
      const rows = canViewAll
        ? db
            .prepare(`
              SELECT
                u.*,
                r.slug AS role_slug,
                r.name AS role_name,
                r.permissions_json AS role_permissions_json,
                (SELECT COUNT(*) FROM sessions s WHERE s.user_id = u.id AND s.revoked_at IS NULL AND s.expires_at > ?) AS active_sessions
              FROM users u
              JOIN roles r ON r.id = u.role_id
              ORDER BY u.created_at ASC
            `)
            .all(nowIso)
        : db
            .prepare(`
              SELECT
                u.*,
                r.slug AS role_slug,
                r.name AS role_name,
                r.permissions_json AS role_permissions_json,
                (SELECT COUNT(*) FROM sessions s WHERE s.user_id = u.id AND s.revoked_at IS NULL AND s.expires_at > ?) AS active_sessions
              FROM users u
              JOIN roles r ON r.id = u.role_id
              WHERE u.id = ?
            `)
            .all(nowIso, currentUser.id);

      const users = rows.map((row) => ({
        ...formatAuthUser(row),
        activeSessions: Number(row.active_sessions || 0),
      }));
      sendJson(res, 200, { users });
      return true;
    }

    if (pathname === '/api/users' && method === 'POST') {
      if (!userHasPermission(currentUser.permissions, ['users.create', 'users.manage'])) {
        sendJson(res, 403, { error: 'No tienes permiso para crear cuentas de usuario.' });
        return true;
      }

      const body = await readJsonBody(req);
      const username = typeof body.username === 'string' ? body.username.trim() : '';
      const email = typeof body.email === 'string' ? body.email.trim() : '';
      const displayName =
        typeof body.displayName === 'string' && body.displayName.trim()
          ? body.displayName.trim()
          : username;
      const password = typeof body.password === 'string' ? body.password : '';
      const avatar =
        typeof body.avatar === 'string' && body.avatar.trim()
          ? body.avatar.trim()
          : '/images/liaa-emblem.png';
      const mustChangePassword = body.mustChangePassword ? 1 : 0;

      if (username.length < 3 || !/^[a-zA-Z0-9._-]+$/.test(username)) {
        sendJson(res, 400, {
          error: 'El usuario debe tener mínimo 3 caracteres (letras, números, . _ -).',
        });
        return true;
      }

      const pwCheck = validatePasswordPolicy(password);
      if (!pwCheck.ok) {
        sendJson(res, 400, { error: pwCheck.error });
        return true;
      }

      const avatarCheck = validateSafeUrl(avatar, { allowEmpty: false, allowRelative: true });
      if (!avatarCheck.ok) {
        sendJson(res, 400, { error: `Avatar inválido: ${avatarCheck.error}` });
        return true;
      }

      if (db.prepare('SELECT id FROM users WHERE LOWER(username) = LOWER(?)').get(username)) {
        sendJson(res, 409, { error: 'Ya existe una cuenta con ese nombre de usuario.' });
        return true;
      }

      const requestedRoleId =
        typeof body.roleId === 'string' && body.roleId.trim() ? body.roleId.trim() : 'role-autor';
      const targetRole = db.prepare('SELECT * FROM roles WHERE id = ?').get(requestedRoleId);
      if (!targetRole) {
        sendJson(res, 400, { error: 'El rol seleccionado no existe.' });
        return true;
      }

      // Strict escalation protection: actor CANNOT assign any role whose permissions exceed their own
      const targetRolePerms = JSON.parse(targetRole.permissions_json || '[]');
      if (!canActorGrantPermissions(currentUser.permissions, targetRolePerms)) {
        sendJson(res, 403, {
          error: `No estás autorizado para asignar el rol "${targetRole.name}" (contiene permisos superiores a los tuyos).`,
        });
        return true;
      }

      const id = `usr-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
      const { salt, hash } = hashPassword(password);
      const now = new Date().toISOString();

      db.prepare(`
        INSERT INTO users(
          id, username, email, display_name, role_id, custom_permissions_json,
          avatar, salt, password_hash, status, must_change_password, totp_enabled, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, '{}', ?, ?, ?, 'active', ?, 0, ?, ?)
      `).run(
        id,
        username,
        email,
        displayName,
        targetRole.id,
        avatar,
        salt,
        hash,
        mustChangePassword,
        now,
        now,
      );

      recordAudit({
        actor: currentUser,
        action: 'user.created',
        resourceType: 'user',
        resourceId: id,
        details: { username, role: targetRole.slug, mustChangePassword: Boolean(mustChangePassword) },
        ip,
      });

      sendJson(res, 201, { ok: true, user: loadUserWithRoleById(id) });
      return true;
    }

    // Update own profile (and complete forced password change)
    if (
      (pathname === '/api/users/me' || pathname === '/api/auth/credentials') &&
      (method === 'PATCH' || method === 'POST')
    ) {
      const body = await readJsonBody(req);
      const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : '';
      const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';

      // If account has forced password change pending, require actual password update
      if (currentUser.mustChangePassword && !newPassword) {
        sendJson(res, 400, {
          error: 'Debes establecer una nueva contraseña para desbloquear tu cuenta.',
          code: 'PASSWORD_CHANGE_REQUIRED',
        });
        return true;
      }

      const newUsername =
        typeof body.username === 'string' && body.username.trim()
          ? body.username.trim()
          : currentUser.username;
      const email = typeof body.email === 'string' ? body.email.trim() : currentUser.email;
      const displayName =
        typeof body.displayName === 'string' && body.displayName.trim()
          ? body.displayName.trim()
          : currentUser.displayName;
      const avatar =
        typeof body.avatar === 'string' && body.avatar.trim() ? body.avatar.trim() : currentUser.avatar;

      if (newUsername.length < 3 || !/^[a-zA-Z0-9._-]+$/.test(newUsername)) {
        sendJson(res, 400, { error: 'Nombre de usuario inválido.' });
        return true;
      }

      const avatarCheck = validateSafeUrl(avatar, { allowEmpty: false, allowRelative: true });
      if (!avatarCheck.ok) {
        sendJson(res, 400, { error: `Avatar inválido: ${avatarCheck.error}` });
        return true;
      }

      if (email && !isValidEmail(email)) {
        sendJson(res, 400, { error: 'El formato del correo electrónico no es válido.' });
        return true;
      }

      if (email) {
        const dupEmail = db
          .prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?) AND id != ?')
          .get(email, currentUser.id);
        if (dupEmail) {
          sendJson(res, 409, { error: 'Ese correo electrónico ya está registrado en otro perfil.' });
          return true;
        }
      }

      const dup = db
        .prepare('SELECT id FROM users WHERE LOWER(username) = LOWER(?) AND id != ?')
        .get(newUsername, currentUser.id);
      if (dup) {
        sendJson(res, 409, { error: 'Ese nombre de usuario ya está en uso.' });
        return true;
      }

      const rawUser = db
        .prepare('SELECT salt, password_hash, must_change_password FROM users WHERE id = ?')
        .get(currentUser.id);

      let nextSalt = rawUser.salt;
      let nextHash = rawUser.password_hash;
      let nextMustChange = rawUser.must_change_password;

      if (newPassword) {
        if (!verifyPassword(currentPassword, rawUser.salt, rawUser.password_hash)) {
          sendJson(res, 400, { error: 'La contraseña actual no es correcta.' });
          return true;
        }
        const pwCheck = validatePasswordPolicy(newPassword);
        if (!pwCheck.ok) {
          sendJson(res, 400, { error: pwCheck.error });
          return true;
        }
        if (currentPassword === newPassword) {
          sendJson(res, 400, {
            error: 'La nueva contraseña debe ser diferente a la contraseña actual.',
          });
          return true;
        }
        const hashed = hashPassword(newPassword);
        nextSalt = hashed.salt;
        nextHash = hashed.hash;
        nextMustChange = 0;
      }

      db.prepare(`
        UPDATE users
        SET username = ?, email = ?, display_name = ?, avatar = ?, salt = ?, password_hash = ?, must_change_password = ?, updated_at = ?
        WHERE id = ?
      `).run(
        newUsername,
        email,
        displayName,
        avatar,
        nextSalt,
        nextHash,
        nextMustChange,
        new Date().toISOString(),
        currentUser.id,
      );

      recordAudit({
        actor: currentUser,
        action: newPassword ? 'user.password_changed' : 'user.profile_updated',
        resourceType: 'user',
        resourceId: currentUser.id,
        details: { username: newUsername, displayName },
        ip,
      });

      const refreshed = loadUserWithRoleById(currentUser.id);
      sendJson(res, 200, { ok: true, username: refreshed.username, user: refreshed });
      return true;
    }

    // Revoke all sessions for a specific user
    if (/^\/api\/users\/[^/]+\/revoke-sessions$/.test(pathname) && method === 'POST') {
      if (!userHasPermission(currentUser.permissions, 'users.manage')) {
        sendJson(res, 403, { error: 'No tienes permiso para revocar sesiones.' });
        return true;
      }
      const targetId = decodeURIComponent(pathname.split('/')[3]);
      const target = loadUserWithRoleById(targetId);
      if (!target) {
        sendJson(res, 404, { error: 'Usuario no encontrado.' });
        return true;
      }
      if (target.roleSlug === 'superadmin' && !isSuperAdmin) {
        sendJson(res, 403, { error: 'No puedes revocar sesiones de un Superadministrador.' });
        return true;
      }

      db.prepare('UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL').run(
        new Date().toISOString(),
        targetId,
      );

      recordAudit({
        actor: currentUser,
        action: 'user.sessions_revoked',
        resourceType: 'user',
        resourceId: targetId,
        details: { targetUsername: target.username },
        ip,
      });

      sendJson(res, 200, { ok: true });
      return true;
    }

    // Generate a one-time password recovery link (Admin assisted)
    if (/^\/api\/users\/[^/]+\/reset-link$/.test(pathname) && method === 'POST') {
      if (!userHasPermission(currentUser.permissions, 'users.manage')) {
        sendJson(res, 403, { error: 'No tienes permiso para generar enlaces de recuperación.' });
        return true;
      }
      const targetId = decodeURIComponent(pathname.split('/')[3]);
      const target = loadUserWithRoleById(targetId);
      if (!target) {
        sendJson(res, 404, { error: 'Usuario no encontrado.' });
        return true;
      }
      if (target.roleSlug === 'superadmin' && !isSuperAdmin) {
        sendJson(res, 403, {
          error: 'Solo un Superadministrador puede generar un enlace para otro Superadministrador.',
        });
        return true;
      }

      const issued = issuePasswordResetToken(db, targetId, ip);
      const resetUrl = `${resolvePublicOrigin(req, db)}/admin?reset_token=${encodeURIComponent(issued.rawToken)}`;

      recordAudit({
        actor: currentUser,
        action: 'user.reset_link_generated',
        resourceType: 'user',
        resourceId: targetId,
        details: { targetUsername: target.username, expiresAt: issued.expiresAt },
        ip,
      });

      sendJson(res, 200, {
        ok: true,
        resetUrl,
        expiresAt: issued.expiresAt,
        expiresMinutes: issued.expiresMinutes,
      });
      return true;
    }

    // Manage another user (role, customPermissions, status, lock, reset password, delete)
    if (pathname.startsWith('/api/users/') && (method === 'PATCH' || method === 'DELETE')) {
      if (!userHasPermission(currentUser.permissions, 'users.manage')) {
        sendJson(res, 403, { error: 'No tienes permiso para gestionar otros usuarios.' });
        return true;
      }

      const targetId = decodeURIComponent(pathname.slice('/api/users/'.length));
      const target = loadUserWithRoleById(targetId);
      if (!target) {
        sendJson(res, 404, { error: 'Usuario no encontrado.' });
        return true;
      }

      if (target.roleSlug === 'superadmin' && !isSuperAdmin) {
        sendJson(res, 403, {
          error: 'Solo un Superadministrador puede modificar a otro Superadministrador.',
        });
        return true;
      }

      if (method === 'DELETE') {
        if (target.id === currentUser.id) {
          sendJson(res, 400, { error: 'No puedes eliminar tu propia cuenta activa.' });
          return true;
        }
        const superCount = db
          .prepare(`
            SELECT COUNT(*) AS cnt FROM users u
            JOIN roles r ON r.id = u.role_id
            WHERE r.slug = 'superadmin' AND u.status = 'active'
          `)
          .get().cnt;
        if (target.roleSlug === 'superadmin' && superCount <= 1) {
          sendJson(res, 400, { error: 'Debe existir al menos un Superadministrador activo.' });
          return true;
        }
        db.prepare('DELETE FROM users WHERE id = ?').run(targetId);
        recordAudit({
          actor: currentUser,
          action: 'user.deleted',
          resourceType: 'user',
          resourceId: targetId,
          details: { targetUsername: target.username },
          ip,
        });
        sendJson(res, 200, { ok: true });
        return true;
      }

      const body = await readJsonBody(req);
      const now = new Date().toISOString();
      const changes = {};

      if (typeof body.roleId === 'string' && body.roleId !== target.roleId) {
        const nextRole = db.prepare('SELECT * FROM roles WHERE id = ?').get(body.roleId);
        if (!nextRole) {
          sendJson(res, 400, { error: 'Rol inválido.' });
          return true;
        }
        const nextRolePerms = JSON.parse(nextRole.permissions_json || '[]');
        if (!canActorGrantPermissions(currentUser.permissions, nextRolePerms)) {
          sendJson(res, 403, {
            error: `No puedes asignar el rol "${nextRole.name}" (contiene permisos superiores a los tuyos).`,
          });
          return true;
        }
        if (target.roleSlug === 'superadmin' && nextRole.slug !== 'superadmin') {
          const superCount = db
            .prepare(`
              SELECT COUNT(*) AS cnt FROM users u JOIN roles r ON r.id = u.role_id
              WHERE r.slug = 'superadmin' AND u.status = 'active'
            `)
            .get().cnt;
          if (superCount <= 1) {
            sendJson(res, 400, { error: 'Debe permanecer al menos un Superadministrador activo.' });
            return true;
          }
        }
        db.prepare('UPDATE users SET role_id = ?, updated_at = ? WHERE id = ?').run(
          nextRole.id,
          now,
          targetId,
        );
        changes.role = nextRole.slug;
      }

      // Per-user custom permission overrides (grant / deny)
      if (body.customPermissions && typeof body.customPermissions === 'object') {
        if (!userHasPermission(currentUser.permissions, 'roles.manage')) {
          sendJson(res, 403, {
            error: 'Se requiere el permiso roles.manage para asignar permisos individuales.',
          });
          return true;
        }
        const grant = Array.isArray(body.customPermissions.grant)
          ? body.customPermissions.grant.filter((p) => ALL_PERMISSION_KEYS.includes(p))
          : [];
        const deny = Array.isArray(body.customPermissions.deny)
          ? body.customPermissions.deny.filter((p) => ALL_PERMISSION_KEYS.includes(p))
          : [];

        if (!canActorGrantPermissions(currentUser.permissions, grant)) {
          sendJson(res, 403, {
            error: 'No puedes conceder permisos individuales que tú mismo no posees.',
          });
          return true;
        }

        const sanitizedOverrides = { grant, deny };
        db.prepare('UPDATE users SET custom_permissions_json = ?, updated_at = ? WHERE id = ?').run(
          JSON.stringify(sanitizedOverrides),
          now,
          targetId,
        );
        changes.customPermissions = sanitizedOverrides;
      }

      if (body.status === 'active' || body.status === 'suspended' || body.status === 'disabled') {
        if (target.id === currentUser.id && body.status !== 'active') {
          sendJson(res, 400, { error: 'No puedes suspender o desactivar tu propia cuenta.' });
          return true;
        }
        db.prepare('UPDATE users SET status = ?, updated_at = ? WHERE id = ?').run(
          body.status,
          now,
          targetId,
        );
        if (body.status !== 'active') {
          db.prepare('UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL').run(
            now,
            targetId,
          );
        }
        changes.status = body.status;
      }

      if ('lockMinutes' in body) {
        const mins = Number(body.lockMinutes);
        const until = mins > 0 ? new Date(Date.now() + mins * 60_000).toISOString() : null;
        db.prepare('UPDATE users SET locked_until = ?, updated_at = ? WHERE id = ?').run(
          until,
          now,
          targetId,
        );
        if (until) {
          db.prepare('UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL').run(
            now,
            targetId,
          );
        }
        changes.lockedUntil = until;
      }

      if (typeof body.mustChangePassword === 'boolean') {
        db.prepare('UPDATE users SET must_change_password = ?, updated_at = ? WHERE id = ?').run(
          body.mustChangePassword ? 1 : 0,
          now,
          targetId,
        );
        changes.mustChangePassword = body.mustChangePassword;
      }

      if (typeof body.newPassword === 'string' && body.newPassword.length > 0) {
        const pwCheck = validatePasswordPolicy(body.newPassword);
        if (!pwCheck.ok) {
          sendJson(res, 400, { error: pwCheck.error });
          return true;
        }
        const { salt, hash } = hashPassword(body.newPassword);
        db.prepare(
          'UPDATE users SET salt = ?, password_hash = ?, must_change_password = 1, updated_at = ? WHERE id = ?',
        ).run(salt, hash, now, targetId);
        db.prepare('UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL').run(
          now,
          targetId,
        );
        changes.passwordReset = true;
      }

      if (body.disable2FA === true && isSuperAdmin) {
        db.prepare(
          'UPDATE users SET totp_enabled = 0, totp_secret = NULL, totp_pending_secret = NULL, updated_at = ? WHERE id = ?',
        ).run(now, targetId);
        changes.disable2FA = true;
      }

      recordAudit({
        actor: currentUser,
        action: 'user.updated',
        resourceType: 'user',
        resourceId: targetId,
        details: { targetUsername: target.username, ...changes },
        ip,
      });

      sendJson(res, 200, { ok: true, user: loadUserWithRoleById(targetId) });
      return true;
    }

    // --- AUDIT LOGS ---
    if (pathname === '/api/audit' && method === 'GET') {
      const canViewAll = userHasPermission(currentUser.permissions, 'audit.view');
      const actorFilter = parsedUrl.searchParams.get('actor') || '';
      const actionFilter = parsedUrl.searchParams.get('action') || '';
      const limit = Math.min(200, Math.max(10, Number(parsedUrl.searchParams.get('limit') || 80)));

      const conditions = [];
      const params = [];

      if (!canViewAll) {
        conditions.push('actor_id = ?');
        params.push(currentUser.id);
      } else if (actorFilter) {
        conditions.push('(LOWER(actor_username) LIKE LOWER(?) OR actor_id = ?)');
        params.push(`%${actorFilter}%`, actorFilter);
      }

      if (actionFilter) {
        conditions.push('action LIKE ?');
        params.push(`${actionFilter}%`);
      }

      const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const rows = db
        .prepare(`SELECT * FROM audit_logs ${whereSql} ORDER BY id DESC LIMIT ?`)
        .all(...params, limit);

      const logs = rows.map((r) => ({
        id: r.id,
        actorId: r.actor_id,
        actorUsername: r.actor_username,
        actorRole: r.actor_role,
        action: r.action,
        resourceType: r.resource_type,
        resourceId: r.resource_id,
        details: JSON.parse(r.details_json || '{}'),
        ip: r.ip,
        createdAt: r.created_at,
      }));

      sendJson(res, 200, { logs });
      return true;
    }

    // --- GRANULAR SECTION ENDPOINTS WITH OPTIMISTIC CONCURRENCY ---
    if (pathname === '/api/site/design' && method === 'PUT') {
      const hasDesign = userHasPermission(currentUser.permissions, 'site.design');
      const hasPages = userHasPermission(currentUser.permissions, 'site.pages');
      if (!hasDesign && !hasPages) {
        sendJson(res, 403, { error: 'Se requiere el permiso site.design para modificar el diseño.' });
        return true;
      }
      const body = await readJsonBody(req);
      const touchesGlobalDesign =
        body.hero !== undefined ||
        body.homeSections !== undefined ||
        body.customBlocks !== undefined ||
        body.images !== undefined ||
        body.typography !== undefined;
      if (touchesGlobalDesign && !hasDesign) {
        sendJson(res, 403, { error: 'Se requiere el permiso site.design para modificar el diseño global.' });
        return true;
      }
      const expectedVersion = parseExpectedVersion(req, body);
      const result = updateContentTransactional({
        expectedVersion,
        actor: currentUser,
        note: 'Actualización de diseño (Hero/Bloques/Tipografía/Textos)',
        mutate: (current) => ({
          ok: true,
          data: {
            ...current,
            hero: body.hero !== undefined ? body.hero : current.hero,
            homeSections: Array.isArray(body.homeSections)
              ? body.homeSections
              : current.homeSections,
            customBlocks: Array.isArray(body.customBlocks)
              ? body.customBlocks
              : current.customBlocks,
            typography:
              body.typography && typeof body.typography === 'object'
                ? { ...(current.typography || {}), ...body.typography }
                : current.typography,
            pageTexts:
              body.pageTexts && typeof body.pageTexts === 'object' && !Array.isArray(body.pageTexts)
                ? { ...(current.pageTexts || {}), ...body.pageTexts }
                : current.pageTexts,
            siteInfo:
              body.images && typeof body.images === 'object'
                ? { ...current.siteInfo, images: { ...current.siteInfo?.images, ...body.images } }
                : current.siteInfo,
          },
        }),
      });
      if (!result.ok) {
        sendJson(res, result.status, result);
        return true;
      }
      recordAudit({
        actor: currentUser,
        action: 'content.design_updated',
        resourceType: 'site_design',
        details: { version: result.version },
        ip,
      });
      sendJson(res, 200, { ok: true, version: result.version, savedAt: result.savedAt });
      return true;
    }

    if (pathname === '/api/site/menus' && method === 'PUT') {
      if (!userHasPermission(currentUser.permissions, 'site.menus')) {
        sendJson(res, 403, { error: 'Se requiere el permiso site.menus para modificar menús.' });
        return true;
      }
      const body = await readJsonBody(req);
      if (!Array.isArray(body.navItems)) {
        sendJson(res, 400, { error: 'navItems debe ser un arreglo.' });
        return true;
      }
      const expectedVersion = parseExpectedVersion(req, body);
      const result = updateContentTransactional({
        expectedVersion,
        actor: currentUser,
        note: 'Actualización de menús',
        mutate: (current) => ({
          ok: true,
          data: { ...current, navItems: body.navItems },
        }),
      });
      if (!result.ok) {
        sendJson(res, result.status, result);
        return true;
      }
      recordAudit({
        actor: currentUser,
        action: 'content.menus_updated',
        resourceType: 'menus',
        details: { count: body.navItems.length, version: result.version },
        ip,
      });
      sendJson(res, 200, { ok: true, version: result.version, savedAt: result.savedAt });
      return true;
    }

    if (pathname === '/api/site/pages' && method === 'PUT') {
      if (!userHasPermission(currentUser.permissions, 'site.pages')) {
        sendJson(res, 403, { error: 'Se requiere el permiso site.pages para modificar páginas.' });
        return true;
      }
      const body = await readJsonBody(req);
      const expectedVersion = parseExpectedVersion(req, body);
      const result = updateContentTransactional({
        expectedVersion,
        actor: currentUser,
        note: 'Actualización de páginas e identidad',
        mutate: (current) => ({
          ok: true,
          data: {
            ...current,
            customPages: Array.isArray(body.customPages) ? body.customPages : current.customPages,
            labIdentity: body.labIdentity !== undefined ? body.labIdentity : current.labIdentity,
          },
        }),
      });
      if (!result.ok) {
        sendJson(res, result.status, result);
        return true;
      }
      recordAudit({
        actor: currentUser,
        action: 'content.pages_updated',
        resourceType: 'pages',
        details: { version: result.version },
        ip,
      });
      sendJson(res, 200, { ok: true, version: result.version, savedAt: result.savedAt });
      return true;
    }

    if (pathname === '/api/settings/smtp' && method === 'GET') {
      if (!userHasPermission(currentUser.permissions, 'site.settings')) {
        sendJson(res, 403, {
          error: 'Se requiere el permiso site.settings para consultar la configuración SMTP.',
        });
        return true;
      }
      sendJson(res, 200, { ok: true, ...getPublicSmtpSettings(db) });
      return true;
    }

    if (pathname === '/api/settings/smtp' && method === 'PUT') {
      if (!userHasPermission(currentUser.permissions, 'site.settings')) {
        sendJson(res, 403, {
          error: 'Se requiere el permiso site.settings para modificar la configuración SMTP.',
        });
        return true;
      }
      const body = await readJsonBody(req);
      const enabled = body.enabled !== false;
      const host = typeof body.host === 'string' ? body.host.trim() : '';
      const port = Number(body.port || 587);
      const user = typeof body.user === 'string' ? body.user.trim() : '';
      const publicUrl = typeof body.publicUrl === 'string' ? body.publicUrl.trim() : '';

      if (enabled && (!host || !user)) {
        sendJson(res, 400, {
          error: 'Debes indicar al menos el servidor SMTP (host) y el correo/usuario remitente.',
        });
        return true;
      }
      if (!Number.isInteger(port) || port < 1 || port > 65535) {
        sendJson(res, 400, { error: 'El puerto SMTP debe estar entre 1 y 65535.' });
        return true;
      }
      if (publicUrl) {
        const urlCheck = validateSafeUrl(publicUrl, { allowEmpty: false, allowRelative: false });
        if (!urlCheck.ok) {
          sendJson(res, 400, { error: `URL pública inválida: ${urlCheck.error}` });
          return true;
        }
      }

      const saved = saveSmtpSettings(db, {
        enabled,
        host,
        port,
        secure: Boolean(body.secure),
        user,
        pass: typeof body.pass === 'string' ? body.pass : '',
        clearPassword: body.clearPassword === true,
        from: typeof body.from === 'string' ? body.from : '',
        publicUrl,
      });

      recordAudit({
        actor: currentUser,
        action: 'settings.smtp_updated',
        resourceType: 'settings',
        resourceId: 'smtp_config',
        details: { enabled, host, port, user, configured: saved.configured },
        ip,
      });

      sendJson(res, 200, { ok: true, ...saved });
      return true;
    }

    if (pathname === '/api/settings/smtp/test' && method === 'POST') {
      if (!userHasPermission(currentUser.permissions, 'site.settings')) {
        sendJson(res, 403, {
          error: 'Se requiere el permiso site.settings para probar el envío de correo SMTP.',
        });
        return true;
      }
      const body = await readJsonBody(req);
      const to = (typeof body.to === 'string' && body.to.trim()) || currentUser.email || '';
      if (!isValidEmail(to)) {
        sendJson(res, 400, { error: 'Ingresa un correo electrónico destinatario válido para la prueba.' });
        return true;
      }

      try {
        const result = await sendSmtpTestEmail({
          db,
          to: to.trim(),
          actorUsername: currentUser.username,
        });
        recordAudit({
          actor: currentUser,
          action: 'settings.smtp_test_success',
          resourceType: 'settings',
          resourceId: 'smtp_config',
          details: { to: maskEmail(to), host: result.host, port: result.port },
          ip,
        });
        sendJson(res, 200, {
          ok: true,
          message: `Correo de prueba enviado correctamente a ${to.trim()}. Revisa tu bandeja de entrada (o Spam).`,
        });
      } catch (err) {
        recordAudit({
          actor: currentUser,
          action: 'settings.smtp_test_failed',
          resourceType: 'settings',
          resourceId: 'smtp_config',
          details: { error: String(err?.message || err).slice(0, 200) },
          ip,
        });
        sendJson(res, 400, { error: formatSmtpError(err) });
      }
      return true;
    }

    if (pathname === '/api/site/settings' && method === 'PUT') {
      if (!userHasPermission(currentUser.permissions, 'site.settings')) {
        sendJson(res, 403, {
          error: 'Se requiere el permiso site.settings para modificar configuración general.',
        });
        return true;
      }
      const body = await readJsonBody(req);
      if (!body.siteInfo || typeof body.siteInfo !== 'object') {
        sendJson(res, 400, { error: 'siteInfo es requerido.' });
        return true;
      }
      const expectedVersion = parseExpectedVersion(req, body);
      const result = updateContentTransactional({
        expectedVersion,
        actor: currentUser,
        note: 'Actualización de configuración general',
        mutate: (current) => ({
          ok: true,
          data: {
            ...current,
            siteInfo: {
              ...current.siteInfo,
              ...body.siteInfo,
              // Preserve site images unless actor also holds site.design
              images: userHasPermission(currentUser.permissions, 'site.design') && body.siteInfo.images
                ? body.siteInfo.images
                : current.siteInfo?.images,
            },
          },
        }),
      });
      if (!result.ok) {
        sendJson(res, result.status, result);
        return true;
      }
      recordAudit({
        actor: currentUser,
        action: 'content.settings_updated',
        resourceType: 'settings',
        details: { version: result.version },
        ip,
      });
      sendJson(res, 200, { ok: true, version: result.version, savedAt: result.savedAt });
      return true;
    }

    if (pathname === '/api/research' && method === 'PUT') {
      if (!userHasPermission(currentUser.permissions, ['research.manage', 'research.collaborate'])) {
        sendJson(res, 403, {
          error: 'Se requiere el permiso research.manage o research.collaborate.',
        });
        return true;
      }
      const body = await readJsonBody(req);
      const canManageLines = userHasPermission(currentUser.permissions, 'research.manage');
      const expectedVersion = parseExpectedVersion(req, body);
      const result = updateContentTransactional({
        expectedVersion,
        actor: currentUser,
        note: 'Actualización de investigación y proyectos',
        mutate: (current) => {
          if (
            Array.isArray(body.researchLines) &&
            !stableEqual(body.researchLines, current.researchLines) &&
            !canManageLines
          ) {
            return {
              ok: false,
              status: 403,
              error: 'Solo usuarios con research.manage pueden modificar líneas de investigación.',
            };
          }
          return {
            ok: true,
            data: {
              ...current,
              researchLines: Array.isArray(body.researchLines)
                ? body.researchLines
                : current.researchLines,
              projects: Array.isArray(body.projects) ? body.projects : current.projects,
            },
          };
        },
      });
      if (!result.ok) {
        sendJson(res, result.status, result);
        return true;
      }
      recordAudit({
        actor: currentUser,
        action: 'content.research_updated',
        resourceType: 'research',
        details: { version: result.version },
        ip,
      });
      sendJson(res, 200, { ok: true, version: result.version, savedAt: result.savedAt });
      return true;
    }

    // --- GRANULAR NEWS ENDPOINT ---
    if (pathname === '/api/news' && method === 'PUT') {
      const body = await readJsonBody(req);
      const expectedVersion = parseExpectedVersion(req, body);
      const result = updateContentTransactional({
        expectedVersion,
        actor: currentUser,
        note: 'Actualización de publicaciones',
        mutate: (current) => {
          const check = validateAndPrepareNewsMutation(
            current.newsArticles,
            body.newsArticles,
            currentUser,
          );
          if (!check.ok) return check;
          return { ok: true, data: { ...current, newsArticles: check.articles } };
        },
      });
      if (!result.ok) {
        sendJson(res, result.status, result);
        return true;
      }

      recordAudit({
        actor: currentUser,
        action: 'news.updated',
        resourceType: 'news',
        details: { count: result.data.newsArticles.length, version: result.version },
        ip,
      });

      sendJson(res, 200, {
        ok: true,
        version: result.version,
        savedAt: result.savedAt,
        newsArticles: result.data.newsArticles,
      });
      return true;
    }

    // --- FULL CONTENT ENDPOINT (NOW WITH STRICT FIELD-BY-FIELD DIFF RBAC!) ---
    if (pathname === '/api/content' && method === 'PUT') {
      const body = await readJsonBody(req);
      const expectedVersion = parseExpectedVersion(req, body);

      if (
        !body ||
        typeof body !== 'object' ||
        !body.siteInfo ||
        !body.labIdentity ||
        !Array.isArray(body.researchLines) ||
        !Array.isArray(body.projects) ||
        !Array.isArray(body.newsArticles)
      ) {
        sendJson(res, 400, { error: 'Estructura de contenido inválida.' });
        return true;
      }

      const result = updateContentTransactional({
        expectedVersion,
        actor: currentUser,
        note: 'Actualización de contenido del portal',
        mutate: (current) => {
          const perms = currentUser.permissions;

          // 1. Design diff
          const designChanged =
            !stableEqual(body.hero, current.hero) ||
            !stableEqual(body.homeSections, current.homeSections) ||
            !stableEqual(body.customBlocks, current.customBlocks) ||
            (body.typography !== undefined && !stableEqual(body.typography, current.typography)) ||
            (body.pageTexts !== undefined && !stableEqual(body.pageTexts, current.pageTexts)) ||
            !stableEqual(body.siteInfo?.images, current.siteInfo?.images);
          if (designChanged && !userHasPermission(perms, 'site.design')) {
            return {
              ok: false,
              status: 403,
              error: 'No tienes permiso (site.design) para modificar portada, bloques o imágenes globales.',
            };
          }

          // 2. Menus diff
          if (!stableEqual(body.navItems, current.navItems) && !userHasPermission(perms, 'site.menus')) {
            return {
              ok: false,
              status: 403,
              error: 'No tienes permiso (site.menus) para modificar el menú.',
            };
          }

          // 3. Pages / Identity diff
          const pagesChanged =
            !stableEqual(body.customPages, current.customPages) ||
            !stableEqual(body.labIdentity, current.labIdentity);
          if (pagesChanged && !userHasPermission(perms, 'site.pages')) {
            return {
              ok: false,
              status: 403,
              error: 'No tienes permiso (site.pages) para modificar páginas o identidad.',
            };
          }

          // 4. General Settings diff (excluding siteInfo.images already checked above)
          const stripImages = (s) => (s ? { ...s, images: undefined } : s);
          if (
            !stableEqual(stripImages(body.siteInfo), stripImages(current.siteInfo)) &&
            !userHasPermission(perms, 'site.settings')
          ) {
            return {
              ok: false,
              status: 403,
              error: 'No tienes permiso (site.settings) para modificar configuración general.',
            };
          }

          // 5. Research diff
          if (
            !stableEqual(body.researchLines, current.researchLines) &&
            !userHasPermission(perms, 'research.manage')
          ) {
            return {
              ok: false,
              status: 403,
              error: 'No tienes permiso (research.manage) para modificar líneas de investigación.',
            };
          }
          if (
            !stableEqual(body.projects, current.projects) &&
            !userHasPermission(perms, ['research.manage', 'research.collaborate'])
          ) {
            return {
              ok: false,
              status: 403,
              error: 'No tienes permiso para modificar proyectos.',
            };
          }

          // 6. News diff (strict granular check!)
          let finalNews = current.newsArticles;
          if (!stableEqual(body.newsArticles, current.newsArticles)) {
            const newsCheck = validateAndPrepareNewsMutation(
              current.newsArticles,
              body.newsArticles,
              currentUser,
            );
            if (!newsCheck.ok) return newsCheck;
            finalNews = newsCheck.articles;
          }

          const cleanPayload = {
            ...body,
            typography: body.typography !== undefined ? body.typography : current.typography,
            pageTexts: body.pageTexts !== undefined ? body.pageTexts : current.pageTexts,
            newsArticles: finalNews,
          };
          delete cleanPayload.expectedVersion;
          delete cleanPayload._version;
          return { ok: true, data: cleanPayload };
        },
      });

      if (!result.ok) {
        sendJson(res, result.status, result);
        return true;
      }

      recordAudit({
        actor: currentUser,
        action: 'content.updated',
        resourceType: 'site_content',
        details: { version: result.version },
        ip,
      });

      sendJson(res, 200, { ok: true, version: result.version, savedAt: result.savedAt });
      return true;
    }

    // --- MEDIA ---
    if (pathname === '/api/images' && method === 'GET') {
      sendJson(res, 200, { images: listAllImages() });
      return true;
    }

    if (pathname === '/api/upload' && method === 'POST') {
      if (!userHasPermission(currentUser.permissions, 'media.upload')) {
        sendJson(res, 403, { error: 'No tienes permiso para subir archivos.' });
        return true;
      }

      const body = await readJsonBody(req);
      const validation = validateUploadedImage({
        rawFilename: body.filename,
        dataUrl: body.dataUrl,
      });

      if (!validation.ok) {
        recordAudit({
          actor: currentUser,
          action: 'media.upload_rejected',
          resourceType: 'media',
          details: { filename: String(body.filename || '').slice(0, 80), reason: validation.error },
          ip,
        });
        sendJson(res, validation.status, { error: validation.error });
        return true;
      }

      const rawBase = path.basename(
        typeof body.filename === 'string' ? body.filename : 'imagen',
        path.extname(typeof body.filename === 'string' ? body.filename : ''),
      );
      const safeBase =
        rawBase
          .toLowerCase()
          .replace(/[^a-z0-9-_]+/g, '-')
          .replace(/^-+|-+$/g, '')
          .slice(0, 40) || 'imagen';

      // Unique non-overwriting filename with random entropy + wx exclusive creation flag
      const randomHex = crypto.randomBytes(6).toString('hex');
      const finalName = `${Date.now()}-${randomHex}-${safeBase}${validation.canonicalExt}`;
      fs.mkdirSync(PATHS.uploadsDir, { recursive: true });
      const destPath = path.join(PATHS.uploadsDir, finalName);
      fs.writeFileSync(destPath, validation.buffer, { flag: 'wx' });

      recordAudit({
        actor: currentUser,
        action: 'media.uploaded',
        resourceType: 'media',
        resourceId: finalName,
        details: {
          format: validation.format,
          size: validation.buffer.length,
          url: `/images/uploads/${finalName}`,
        },
        ip,
      });

      sendJson(res, 200, {
        ok: true,
        image: {
          name: finalName,
          url: `/images/uploads/${finalName}`,
          size: validation.buffer.length,
          uploaded: true,
          updatedAt: new Date().toISOString(),
        },
      });
      return true;
    }

    if (pathname === '/api/images' && method === 'DELETE') {
      if (!userHasPermission(currentUser.permissions, 'media.delete')) {
        sendJson(res, 403, { error: 'No tienes permiso para eliminar archivos.' });
        return true;
      }

      const body = await readJsonBody(req);
      const urlToDelete = typeof body.url === 'string' ? body.url : '';
      if (!urlToDelete.startsWith('/images/uploads/')) {
        sendJson(res, 400, {
          error: 'Solo se pueden eliminar imágenes subidas desde el panel (/images/uploads/).',
        });
        return true;
      }

      const fileName = path.basename(urlToDelete);
      const targetPath = path.resolve(PATHS.uploadsDir, fileName);
      if (!targetPath.startsWith(PATHS.uploadsDir) || !fs.existsSync(targetPath)) {
        sendJson(res, 404, { error: 'Imagen no encontrada.' });
        return true;
      }

      fs.unlinkSync(targetPath);
      recordAudit({
        actor: currentUser,
        action: 'media.deleted',
        resourceType: 'media',
        resourceId: fileName,
        ip,
      });

      sendJson(res, 200, { ok: true });
      return true;
    }

    sendJson(res, 404, { error: 'Ruta de API no encontrada.' });
    return true;
  } catch (err) {
    if (err?.message === 'PAYLOAD_TOO_LARGE') {
      sendJson(res, 413, { error: 'El archivo es demasiado grande (máximo 50 MB).' });
      return true;
    }
    if (err?.message === 'INVALID_JSON') {
      sendJson(res, 400, { error: 'Solicitud JSON inválida.' });
      return true;
    }
    console.error('[LIAA CMS Error]', err);
    sendJson(res, 500, { error: 'Error interno en el servidor CMS.' });
    return true;
  }
}

export function liaaCmsPlugin() {
  return {
    name: 'liaa-cms-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        // Also sandbox user uploads served during Vite development
        if (req.url && req.url.startsWith('/images/uploads/')) {
          res.setHeader('X-Content-Type-Options', 'nosniff');
          res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
        }
        if (!req.url || !req.url.startsWith('/api/')) {
          next();
          return;
        }
        handleCmsApi(req, res).catch(() => {
          sendJson(res, 500, { error: 'Error interno del servidor.' });
        });
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url && req.url.startsWith('/images/uploads/')) {
          res.setHeader('X-Content-Type-Options', 'nosniff');
          res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
        }
        if (!req.url || !req.url.startsWith('/api/')) {
          next();
          return;
        }
        handleCmsApi(req, res).catch(() => {
          sendJson(res, 500, { error: 'Error interno del servidor.' });
        });
      });
    },
  };
}

export { ALLOWED_IMAGE_SPECS };

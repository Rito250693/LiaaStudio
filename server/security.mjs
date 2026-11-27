import path from 'node:path';
import { SECURITY_CONFIG } from './config.mjs';

// SVG intentionally disabled until a hardened server-side SVG sanitizer is introduced
export const ALLOWED_IMAGE_SPECS = {
  png: { ext: '.png', mimes: new Set(['image/png']), extensions: new Set(['.png']) },
  jpeg: {
    ext: '.jpg',
    mimes: new Set(['image/jpeg', 'image/jpg']),
    extensions: new Set(['.jpg', '.jpeg']),
  },
  webp: { ext: '.webp', mimes: new Set(['image/webp']), extensions: new Set(['.webp']) },
  gif: { ext: '.gif', mimes: new Set(['image/gif']), extensions: new Set(['.gif']) },
};

const ALLOWED_MAP_EMBED_HOSTS = new Set([
  'www.google.com',
  'maps.google.com',
  'google.com',
  'www.openstreetmap.org',
]);

/**
 * Inspects actual binary magic bytes to determine real image format.
 * Returns 'png' | 'jpeg' | 'webp' | 'gif' | null
 */
export function detectImageMagicBytes(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return null;

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'png';
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'jpeg';
  }

  // GIF: GIF87a or GIF89a
  const gifSig = buffer.subarray(0, 6).toString('ascii');
  if (gifSig === 'GIF87a' || gifSig === 'GIF89a') {
    return 'gif';
  }

  // WEBP: RIFF....WEBP
  const riff = buffer.subarray(0, 4).toString('ascii');
  const webp = buffer.subarray(8, 12).toString('ascii');
  if (riff === 'RIFF' && webp === 'WEBP') {
    return 'webp';
  }

  return null;
}

export function validateUploadedImage({ rawFilename, dataUrl }) {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) {
    return { ok: false, status: 400, error: 'Formato de carga inválido.' };
  }

  const match = /^data:([a-zA-Z0-9/+.-]+);base64,([A-Za-z0-9+/=\s]+)$/.exec(dataUrl);
  if (!match) {
    return { ok: false, status: 400, error: 'Formato base64 de imagen inválido.' };
  }

  const declaredMime = match[1].toLowerCase();
  const ext = path.extname(typeof rawFilename === 'string' ? rawFilename : '').toLowerCase();

  if (declaredMime.includes('svg') || ext === '.svg') {
    return {
      ok: false,
      status: 400,
      error:
        'La carga de archivos SVG está deshabilitada por seguridad (prevención de XSS). Usa PNG, JPG, WEBP o GIF.',
    };
  }

  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length === 0) {
    return { ok: false, status: 400, error: 'El archivo de imagen está vacío.' };
  }
  if (buffer.length > SECURITY_CONFIG.maxUploadBytes) {
    return { ok: false, status: 413, error: 'La imagen excede el límite máximo de 50 MB.' };
  }

  const detected = detectImageMagicBytes(buffer);
  if (!detected) {
    return {
      ok: false,
      status: 400,
      error:
        'El contenido binario del archivo no corresponde a una imagen válida (PNG, JPG, WEBP o GIF).',
    };
  }

  const spec = ALLOWED_IMAGE_SPECS[detected];
  if (!spec.mimes.has(declaredMime)) {
    return {
      ok: false,
      status: 400,
      error: `El tipo MIME declarado (${declaredMime}) no coincide con el contenido real (${detected.toUpperCase()}).`,
    };
  }

  if (ext && !spec.extensions.has(ext)) {
    return {
      ok: false,
      status: 400,
      error: `La extensión (${ext}) no coincide con el formato real del archivo (${detected.toUpperCase()}).`,
    };
  }

  return { ok: true, buffer, format: detected, canonicalExt: spec.ext };
}

export function validatePasswordPolicy(password) {
  if (typeof password !== 'string') {
    return { ok: false, error: 'La contraseña es requerida.' };
  }
  if (password.trim().length < SECURITY_CONFIG.minPasswordLength) {
    return {
      ok: false,
      error: `La contraseña debe tener al menos ${SECURITY_CONFIG.minPasswordLength} caracteres.`,
    };
  }
  return { ok: true };
}

/**
 * Validates URLs strictly: allows https:, http:, or safe relative paths (/...).
 * Rejects javascript:, data:, vbscript:, file:, protocol-relative //..., control chars, etc.
 */
export function validateSafeUrl(
  value,
  { allowEmpty = true, allowRelative = true, allowedHosts = null, requireHttpsOnly = false } = {},
) {
  if (value === undefined || value === null || value === '') {
    return allowEmpty ? { ok: true } : { ok: false, error: 'URL requerida.' };
  }
  if (typeof value !== 'string') {
    return { ok: false, error: 'La URL debe ser una cadena de texto.' };
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return allowEmpty ? { ok: true } : { ok: false, error: 'URL requerida.' };
  }

  // Reject ASCII control chars or embedded newlines
  if (/[\u0000-\u001F\u007F]/.test(trimmed)) {
    return { ok: false, error: 'La URL contiene caracteres de control no permitidos.' };
  }

  // Relative paths: must start with single "/" and NOT "//"
  if (trimmed.startsWith('/')) {
    if (trimmed.startsWith('//')) {
      return { ok: false, error: 'No se permiten rutas protocol-relative (//).' };
    }
    if (!allowRelative) {
      return { ok: false, error: 'Se requiere una URL absoluta http:// o https://.' };
    }
    if (trimmed.includes('..')) {
      return { ok: false, error: 'La ruta relativa no puede contener "..".' };
    }
    return { ok: true };
  }

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, error: `URL malformada: "${trimmed.slice(0, 60)}"` };
  }

  const allowedProtocols = requireHttpsOnly ? ['https:'] : ['https:', 'http:'];
  if (!allowedProtocols.includes(parsed.protocol)) {
    return {
      ok: false,
      error: `Esquema de URL no permitido (${parsed.protocol}). Solo se permite ${allowedProtocols.join(' o ')}.`,
    };
  }

  if (allowedHosts && !allowedHosts.has(parsed.hostname.toLowerCase())) {
    return {
      ok: false,
      error: `Dominio no autorizado para este recurso (${parsed.hostname}).`,
    };
  }

  return { ok: true };
}

export function validateMapEmbedUrl(value) {
  return validateSafeUrl(value, {
    allowEmpty: true,
    allowRelative: false,
    requireHttpsOnly: true,
    allowedHosts: ALLOWED_MAP_EMBED_HOSTS,
  });
}

export function validateBlocksUrls(blocks, prefix = 'bloques') {
  if (!Array.isArray(blocks)) return { ok: true };
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (!b || typeof b !== 'object') continue;
    const checks = [
      [`${prefix}[${i}].image`, b.image],
      [`${prefix}[${i}].buttonLink`, b.buttonLink],
    ];
    for (const [field, val] of checks) {
      const r = validateSafeUrl(val, { allowEmpty: true, allowRelative: true });
      if (!r.ok) return { ok: false, error: `${field}: ${r.error}` };
    }
    if (Array.isArray(b.elements)) {
      for (let j = 0; j < b.elements.length; j++) {
        const el = b.elements[j];
        if (!el || typeof el !== 'object') continue;
        for (const [f, v] of [
          [`${prefix}[${i}].elements[${j}].image`, el.image],
          [`${prefix}[${i}].elements[${j}].href`, el.href],
        ]) {
          const r = validateSafeUrl(v, { allowEmpty: true, allowRelative: true });
          if (!r.ok) return { ok: false, error: `${f}: ${r.error}` };
        }
      }
    }
  }
  return { ok: true };
}

export function validateSiteContentUrls(payload) {
  if (!payload || typeof payload !== 'object') return { ok: true };

  if (payload.siteInfo) {
    const s = payload.siteInfo;
    const urlChecks = [
      ['siteInfo.pitecUrl', s.pitecUrl, false],
      ['siteInfo.mapsLinkUrl', s.mapsLinkUrl, false],
      ['siteInfo.socials.facebook', s.socials?.facebook, false],
      ['siteInfo.socials.uaz', s.socials?.uaz, false],
      ['siteInfo.images.emblem', s.images?.emblem, true],
      ['siteInfo.images.logo', s.images?.logo, true],
      ['siteInfo.images.pitecBuilding', s.images?.pitecBuilding, true],
      ['siteInfo.images.missionGraphic', s.images?.missionGraphic, true],
      ['siteInfo.images.visionGraphic', s.images?.visionGraphic, true],
    ];
    for (const [field, val, allowRelative] of urlChecks) {
      const r = validateSafeUrl(val, { allowEmpty: true, allowRelative });
      if (!r.ok) return { ok: false, error: `${field}: ${r.error}` };
    }
    if (s.mapsEmbedUrl) {
      const mapCheck = validateMapEmbedUrl(s.mapsEmbedUrl);
      if (!mapCheck.ok) return { ok: false, error: `siteInfo.mapsEmbedUrl: ${mapCheck.error}` };
    }
  }

  if (payload.hero) {
    const h = payload.hero;
    for (const [field, val] of [
      ['hero.primaryCta.to', h.primaryCta?.to],
      ['hero.secondaryCta.to', h.secondaryCta?.to],
      ['hero.card.image', h.card?.image],
    ]) {
      const r = validateSafeUrl(val, { allowEmpty: true, allowRelative: true });
      if (!r.ok) return { ok: false, error: `${field}: ${r.error}` };
    }
  }

  if (Array.isArray(payload.navItems)) {
    for (let i = 0; i < payload.navItems.length; i++) {
      const r = validateSafeUrl(payload.navItems[i]?.path, {
        allowEmpty: false,
        allowRelative: true,
      });
      if (!r.ok) return { ok: false, error: `navItems[${i}].path: ${r.error}` };
    }
  }

  if (Array.isArray(payload.newsArticles)) {
    for (let i = 0; i < payload.newsArticles.length; i++) {
      const r = validateSafeUrl(payload.newsArticles[i]?.image, {
        allowEmpty: true,
        allowRelative: true,
      });
      if (!r.ok) return { ok: false, error: `newsArticles[${i}].image: ${r.error}` };
    }
  }

  const cb = validateBlocksUrls(payload.customBlocks, 'customBlocks');
  if (!cb.ok) return cb;

  if (Array.isArray(payload.customPages)) {
    for (let i = 0; i < payload.customPages.length; i++) {
      const pr = validateBlocksUrls(payload.customPages[i]?.blocks, `customPages[${i}].blocks`);
      if (!pr.ok) return pr;
    }
  }

  return { ok: true };
}

export function getClientIp(req) {
  if (SECURITY_CONFIG.trustProxy) {
    const xff = req.headers['x-forwarded-for'];
    if (typeof xff === 'string' && xff.trim()) {
      const first = xff.split(',')[0].trim();
      if (/^[0-9a-fA-F:.]+$/.test(first)) {
        return first;
      }
    }
  }
  return req.socket?.remoteAddress || 'local';
}

import crypto from 'node:crypto';
import { EXTERNAL_SECRETS } from './config.mjs';

const ENC_PREFIX = 'enc:v1:';

function getKeyBuffer() {
  const hex = EXTERNAL_SECRETS.encryptionKeyHex;
  if (/^[0-9a-fA-F]{64}$/.test(hex)) {
    return Buffer.from(hex, 'hex');
  }
  return crypto.createHash('sha256').update(hex).digest();
}

export function encryptSecret(plaintext) {
  if (!plaintext || typeof plaintext !== 'string') return null;
  if (plaintext.startsWith(ENC_PREFIX)) return plaintext;

  const key = getKeyBuffer();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${ENC_PREFIX}${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptSecret(stored) {
  if (!stored || typeof stored !== 'string') return null;
  if (!stored.startsWith(ENC_PREFIX)) {
    // Legacy plaintext fallback (migrated to encrypted on next write)
    return stored;
  }

  const body = stored.slice(ENC_PREFIX.length);
  const parts = body.split(':');
  if (parts.length !== 3) return null;

  const [ivHex, tagHex, dataHex] = parts;
  try {
    const key = getKeyBuffer();
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(dataHex, 'hex')),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  } catch {
    return null;
  }
}

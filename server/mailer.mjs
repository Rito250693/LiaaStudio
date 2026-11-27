import fs from 'node:fs';
import path from 'node:path';
import nodemailer from 'nodemailer';
import { APP_ENV, MAIL_CONFIG, PATHS } from './config.mjs';
import { decryptSecret, encryptSecret } from './cryptoVault.mjs';

const SETTINGS_KEY = 'smtp_config';

let cachedSignature = '';
let cachedTransporter = null;

function readStoredSmtpRow(db) {
  if (!db) return null;
  try {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(SETTINGS_KEY);
    if (!row?.value) return null;
    const parsed = JSON.parse(row.value);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export function resetMailerCache() {
  cachedSignature = '';
  cachedTransporter = null;
}

export function getEffectiveSmtpConfig(db) {
  const stored = readStoredSmtpRow(db);
  if (stored && stored.enabled !== false && stored.host && stored.user && stored.passEncrypted) {
    let pass = '';
    try {
      pass = decryptSecret(stored.passEncrypted) || '';
    } catch {
      pass = '';
    }
    if (pass) {
      const cleanHost = String(stored.host).trim();
      const cleanUser = String(stored.user).trim();
      let cleanFrom = String(stored.from || cleanUser).trim();
      if (
        (cleanHost.toLowerCase().includes('gmail') || cleanHost.toLowerCase().includes('google')) &&
        cleanFrom.toLowerCase().includes('no-reply@liaa.uaz.edu.mx')
      ) {
        cleanFrom = `LIAA Studio UAZ <${cleanUser}>`;
      }
      return {
        configured: true,
        source: 'database',
        host: cleanHost,
        port: Number(stored.port || 587),
        secure: Boolean(stored.secure) || Number(stored.port) === 465,
        user: cleanUser,
        pass,
        from: cleanFrom,
        publicUrl: String(stored.publicUrl || '').trim().replace(/\/+$/, ''),
      };
    }
  }

  if (MAIL_CONFIG.isConfigured) {
    return {
      configured: true,
      source: 'env',
      host: MAIL_CONFIG.host,
      port: MAIL_CONFIG.port,
      secure: MAIL_CONFIG.secure,
      user: MAIL_CONFIG.user,
      pass: MAIL_CONFIG.pass,
      from: MAIL_CONFIG.from,
      publicUrl: MAIL_CONFIG.publicUrl,
    };
  }

  return {
    configured: false,
    source: 'none',
    host: stored?.host || MAIL_CONFIG.host || '',
    port: Number(stored?.port || MAIL_CONFIG.port || 587),
    secure: Boolean(stored?.secure ?? MAIL_CONFIG.secure),
    user: stored?.user || MAIL_CONFIG.user || '',
    pass: '',
    from: stored?.from || MAIL_CONFIG.from || '',
    publicUrl: (stored?.publicUrl || MAIL_CONFIG.publicUrl || '').replace(/\/+$/, ''),
  };
}

export function getEffectivePublicUrl(db) {
  const stored = readStoredSmtpRow(db);
  const fromDb = typeof stored?.publicUrl === 'string' ? stored.publicUrl.trim().replace(/\/+$/, '') : '';
  return fromDb || MAIL_CONFIG.publicUrl || '';
}

export function getPublicSmtpSettings(db) {
  const stored = readStoredSmtpRow(db);
  const effective = getEffectiveSmtpConfig(db);
  return {
    configured: effective.configured,
    source: effective.source,
    config: {
      enabled: stored ? stored.enabled !== false : true,
      host: stored?.host ?? MAIL_CONFIG.host ?? '',
      port: Number(stored?.port ?? MAIL_CONFIG.port ?? 587),
      secure: Boolean(stored?.secure ?? MAIL_CONFIG.secure),
      user: stored?.user ?? MAIL_CONFIG.user ?? '',
      hasPassword: Boolean(stored?.passEncrypted || MAIL_CONFIG.pass),
      from: stored?.from ?? (MAIL_CONFIG.isConfigured ? MAIL_CONFIG.from : ''),
      publicUrl: stored?.publicUrl ?? MAIL_CONFIG.publicUrl ?? '',
    },
  };
}

export function saveSmtpSettings(db, input) {
  const existing = readStoredSmtpRow(db) || {};
  const enabled = input.enabled !== false;
  const host = typeof input.host === 'string' ? input.host.trim() : '';
  const port = Number(input.port || 587);
  const secure = Boolean(input.secure) || port === 465;
  const user = typeof input.user === 'string' ? input.user.trim() : '';
  const from = typeof input.from === 'string' && input.from.trim() ? input.from.trim() : user;
  const publicUrl =
    typeof input.publicUrl === 'string' ? input.publicUrl.trim().replace(/\/+$/, '') : '';

  let passEncrypted = existing.passEncrypted || '';
  if (input.clearPassword === true) {
    passEncrypted = '';
  } else if (typeof input.pass === 'string' && input.pass.trim().length > 0) {
    // Strip spaces commonly pasted from Google App Passwords (e.g. "abcd efgh ijkl mnop")
    const cleanedPass =
      host.toLowerCase().includes('gmail') || host.toLowerCase().includes('google')
        ? input.pass.replace(/\s+/g, '')
        : input.pass.trim();
    passEncrypted = encryptSecret(cleanedPass);
  }

  const nextObj = {
    enabled,
    host,
    port,
    secure,
    user,
    passEncrypted,
    from,
    publicUrl,
  };

  const nowIso = new Date().toISOString();
  db.prepare(`
    INSERT INTO settings (key, value, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `).run(SETTINGS_KEY, JSON.stringify(nextObj), nowIso);

  resetMailerCache();
  return getPublicSmtpSettings(db);
}

function getTransporter(effective) {
  if (!effective.configured) return null;
  const sig = `${effective.host}:${effective.port}:${effective.secure}:${effective.user}:${effective.pass.length}`;
  if (!cachedTransporter || cachedSignature !== sig) {
    cachedTransporter = nodemailer.createTransport({
      host: effective.host,
      port: effective.port,
      secure: effective.secure,
      connectionTimeout: 12_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
      auth: {
        user: effective.user,
        pass: effective.pass,
      },
    });
    cachedSignature = sig;
  }
  return cachedTransporter;
}

export function formatSmtpError(err) {
  const raw = String(err?.response || err?.message || err || '');
  const lower = raw.toLowerCase();
  if (lower.includes('535') || lower.includes('invalid login') || lower.includes('username and password not accepted') || lower.includes('application-specific password')) {
    return 'Autenticación rechazada por el servidor SMTP. En Gmail/UAZ debes usar una "Contraseña de aplicación" de 16 caracteres (no tu contraseña normal).';
  }
  if (lower.includes('enotfound') || lower.includes('eai_again')) {
    return 'No se encontró el servidor SMTP. Revisa el nombre del host (ej. smtp.gmail.com) y tu conexión a Internet.';
  }
  if (lower.includes('econnrefused') || lower.includes('etimedout') || lower.includes('timeout')) {
    return 'No se pudo conectar al servidor SMTP en ese puerto. Prueba puerto 587 (sin SSL directo) o puerto 465 (con SSL/TLS directo).';
  }
  if (lower.includes('wrong version number') || lower.includes('ssl')) {
    return 'Error de cifrado SSL/TLS: para el puerto 587 deja SSL/TLS directo desactivado (usa STARTTLS); para el puerto 465 actívalo.';
  }
  return `Error SMTP: ${err?.message || 'No se pudo enviar el correo.'}`;
}

export function maskEmail(email) {
  if (!email || typeof email !== 'string' || !email.includes('@')) return '';
  const [local, domain] = email.trim().split('@');
  if (!local || !domain) return '';
  if (local.length <= 2) return `${local[0]}***@${domain}`;
  return `${local.slice(0, 2)}***${local.slice(-1)}@${domain}`;
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getEmblemAttachment() {
  const emblemPath = path.join(PATHS.imagesDir, 'liaa-emblem.png');
  if (!fs.existsSync(emblemPath)) return [];
  return [
    {
      filename: 'liaa-emblem.png',
      path: emblemPath,
      cid: 'liaa-emblem',
      contentDisposition: 'inline',
    },
  ];
}

function buildLiaaEmailHtml({
  preheader,
  eyebrow,
  title,
  greetingHtml,
  bodyHtml,
  ctaLabel,
  ctaUrl,
  calloutHtml,
  footerNote,
  hasEmblem,
}) {
  const safePreheader = escapeHtml(preheader || title);
  const safeEyebrow = escapeHtml(eyebrow);
  const safeTitle = escapeHtml(title);

  const logoCell = hasEmblem
    ? `<td width="56" valign="middle" style="padding-right:14px;">
         <div style="width:52px; height:52px; border-radius:14px; background-color:#050814; border:1px solid #1e3a5f; text-align:center; line-height:52px; overflow:hidden;">
           <img src="cid:liaa-emblem" alt="LIAA UAZ" width="40" height="40" style="display:block; margin:6px auto; width:40px; height:40px; object-fit:contain;" />
         </div>
       </td>`
    : '';

  const ctaBlock =
    ctaLabel && ctaUrl
      ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:28px 0 24px;">
           <tr>
             <td align="center">
               <a href="${escapeHtml(ctaUrl)}" target="_blank" style="display:inline-block; background-color:#0845ff; background-image:linear-gradient(90deg, #0845ff 0%, #029be6 100%); color:#ffffff; font-family:'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:15px; font-weight:700; text-decoration:none; padding:14px 30px; border-radius:12px; letter-spacing:0.01em; box-shadow:0 8px 24px rgba(8, 69, 255, 0.35);">
                 ${escapeHtml(ctaLabel)} &rarr;
               </a>
             </td>
           </tr>
         </table>`
      : '';

  const calloutBlock = calloutHtml
    ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:20px 0 0; background-color:#070d1f; border:1px solid #1b2a4a; border-left:3px solid #00d4ff; border-radius:12px;">
         <tr>
           <td style="padding:14px 16px; font-size:12px; line-height:1.6; color:#94a3b8;">
             ${calloutHtml}
           </td>
         </tr>
       </table>`
    : '';

  return `<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${safeTitle}</title>
  </head>
  <body style="margin:0; padding:0; background-color:#050814; font-family:'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color:#e2e8f0; -webkit-font-smoothing:antialiased;">
    <div style="display:none; max-height:0; overflow:hidden; opacity:0; mso-hide:all;">
      ${safePreheader}
    </div>

    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#050814; padding:36px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width:600px; background-color:#0b1229; border:1px solid #1b2b4e; border-radius:22px; overflow:hidden; box-shadow:0 24px 60px rgba(0, 0, 0, 0.55);">
            <!-- Top Gradient Bar -->
            <tr>
              <td height="5" style="height:5px; line-height:5px; font-size:0; background-color:#0845ff; background-image:linear-gradient(90deg, #0845ff 0%, #00d4ff 52%, #6d28d9 100%);">&nbsp;</td>
            </tr>

            <!-- Brand Header -->
            <tr>
              <td style="padding:28px 32px 20px; border-bottom:1px solid #162240; background-color:#080e21;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                  <tr>
                    ${logoCell}
                    <td valign="middle">
                      <div style="font-size:19px; font-weight:800; color:#ffffff; letter-spacing:0.02em; line-height:1.2;">
                        LIAA
                        <span style="display:inline-block; margin-left:6px; padding:2px 8px; font-family:Consolas, 'Courier New', monospace; font-size:11px; font-weight:700; color:#22d3ee; background-color:#0d213d; border:1px solid #164e63; border-radius:6px; vertical-align:middle;">
                          UAZ
                        </span>
                      </div>
                      <div style="margin-top:4px; font-size:12px; color:#94a3b8;">
                        Laboratorio de Inteligencia Artificial Avanzada · PITec
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Main Content -->
            <tr>
              <td style="padding:32px 32px 28px;">
                <div style="display:inline-block; padding:5px 12px; border-radius:999px; background-color:#0c223c; border:1px solid #155e75; font-family:Consolas, 'Courier New', monospace; font-size:11px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:#22d3ee;">
                  &#9679;&nbsp; ${safeEyebrow}
                </div>

                <h1 style="margin:18px 0 14px; font-size:24px; line-height:1.25; font-weight:800; color:#ffffff; letter-spacing:-0.01em;">
                  ${safeTitle}
                </h1>

                <p style="margin:0 0 14px; font-size:15px; line-height:1.65; color:#cbd5e1;">
                  ${greetingHtml}
                </p>

                <div style="font-size:14px; line-height:1.7; color:#cbd5e1;">
                  ${bodyHtml}
                </div>

                ${ctaBlock}
                ${calloutBlock}
              </td>
            </tr>

            <!-- Institutional Footer -->
            <tr>
              <td style="padding:20px 32px 24px; background-color:#070c1c; border-top:1px solid #162240; text-align:center;">
                <p style="margin:0 0 6px; font-size:12px; font-weight:600; color:#cbd5e1;">
                  Laboratorio de Inteligencia Artificial Avanzada (LIAA)
                </p>
                <p style="margin:0 0 10px; font-size:11px; line-height:1.5; color:#64748b;">
                  Posgrado en Ingeniería y Tecnología Aplicada (PITec) · Universidad Autónoma de Zacatecas
                </p>
                <p style="margin:0; font-size:11px; color:#475569;">
                  ${escapeHtml(footerNote || 'Este correo fue enviado automáticamente desde LIAA Studio. No respondas a este mensaje.')}
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export async function sendPasswordResetEmail({
  db,
  to,
  displayName,
  username,
  resetUrl,
  expiresMinutes,
}) {
  const safeName = escapeHtml(displayName || username);
  const safeUser = escapeHtml(username);
  const safeUrl = escapeHtml(resetUrl);
  const attachments = getEmblemAttachment();

  const subject = 'Recuperación de contraseña — LIAA Studio (UAZ)';
  const text = [
    `Hola ${displayName || username},`,
    '',
    `Recibimos una solicitud para restablecer la contraseña de tu cuenta (@${username}) en el portal del Laboratorio de Inteligencia Artificial Avanzada (LIAA – UAZ).`,
    '',
    `Abre el siguiente enlace de un solo uso (válido por ${expiresMinutes} minutos):`,
    resetUrl,
    '',
    'Si tú no solicitaste este restablecimiento, puedes ignorar este mensaje de forma segura. Tu contraseña actual no cambiará.',
    '',
    'Laboratorio de Inteligencia Artificial Avanzada (LIAA) · PITec – UAZ',
  ].join('\n');

  const html = buildLiaaEmailHtml({
    preheader: `Enlace seguro para restablecer la contraseña de @${username} (válido por ${expiresMinutes} minutos).`,
    eyebrow: 'Seguridad · Acceso LIAA Studio',
    title: 'Restablece tu contraseña',
    greetingHtml: `Hola <strong style="color:#ffffff;">${safeName}</strong>,`,
    bodyHtml: `Recibimos una solicitud para restablecer la contraseña de tu cuenta <span style="display:inline-block; padding:1px 7px; border-radius:6px; background-color:#111d3a; border:1px solid #1e3a5f; font-family:Consolas, monospace; font-size:13px; color:#38bdf8;">@${safeUser}</span> en el portal del <strong style="color:#ffffff;">LIAA</strong>. Haz clic en el botón de abajo para elegir una nueva contraseña segura.`,
    ctaLabel: 'Restablecer mi contraseña',
    ctaUrl: resetUrl,
    calloutHtml: `
      <strong style="color:#e2e8f0;">Detalles de seguridad:</strong><br/>
      &bull; Este enlace es de <strong style="color:#22d3ee;">un solo uso</strong> y expira automáticamente en <strong style="color:#22d3ee;">${expiresMinutes} minutos</strong>.<br/>
      &bull; Si tú no solicitaste este cambio, ignora este correo: tu cuenta y contraseña actual siguen protegidas.<br/><br/>
      <span style="color:#64748b;">¿El botón no abre? Copia y pega este enlace en tu navegador:</span><br/>
      <a href="${safeUrl}" style="word-break:break-all; color:#38bdf8; text-decoration:underline;">${safeUrl}</a>
    `,
    hasEmblem: attachments.length > 0,
  });

  const effective = getEffectiveSmtpConfig(db);
  const transporter = getTransporter(effective);
  if (transporter) {
    await transporter.sendMail({
      from: effective.from,
      to,
      subject,
      text,
      html,
      attachments,
    });
    return { delivered: true, mode: 'smtp' };
  }

  if (APP_ENV !== 'production') {
    if (APP_ENV !== 'test') {
      console.log('\n============================================================');
      console.log(`[LIAA PASSWORD RESET - ${APP_ENV.toUpperCase()}] (SMTP no configurado)`);
      console.log(`Usuario: @${username} (${to})`);
      console.log(`Enlace de un solo uso (${expiresMinutes} min):`);
      console.log(resetUrl);
      console.log('============================================================\n');
    }
    return { delivered: false, mode: 'dev_console' };
  }

  return { delivered: false, mode: 'smtp_unconfigured' };
}

export async function sendSmtpTestEmail({ db, to, actorUsername }) {
  const effective = getEffectiveSmtpConfig(db);
  if (!effective.configured) {
    throw new Error('Primero guarda el servidor SMTP, usuario y contraseña antes de probar el envío.');
  }
  const attachments = getEmblemAttachment();
  const transporter = getTransporter(effective);
  await transporter.verify();

  const html = buildLiaaEmailHtml({
    preheader: 'Tu servidor SMTP de LIAA Studio está conectado y listo para enviar correos.',
    eyebrow: 'Sistema de Correo · Verificado',
    title: 'Conexión SMTP configurada con éxito',
    greetingHtml: `Hola <strong style="color:#ffffff;">@${escapeHtml(actorUsername)}</strong>,`,
    bodyHtml: `Este es un correo de verificación enviado desde el panel administrativo de <strong style="color:#ffffff;">LIAA Studio</strong>. Tu servidor de correo ya está activo para enviar enlaces de recuperación de contraseña con esta misma identidad institucional.`,
    calloutHtml: `
      <strong style="color:#34d399;">&#10003; Estado: En línea y verificado</strong><br/>
      &bull; Servidor SMTP: <code style="color:#38bdf8;">${escapeHtml(effective.host)}:${effective.port}</code><br/>
      &bull; Remitente: <span style="color:#e2e8f0;">${escapeHtml(effective.from)}</span><br/>
      &bull; Cifrado en base de datos: <strong style="color:#22d3ee;">AES-256-GCM</strong>
    `,
    hasEmblem: attachments.length > 0,
  });

  await transporter.sendMail({
    from: effective.from,
    to,
    subject: '✅ Correo de prueba — LIAA Studio (UAZ)',
    text: `Hola @${actorUsername},\n\nEste es un correo de prueba enviado desde LIAA Studio.\nTu configuración SMTP (${effective.host}:${effective.port}) funciona correctamente para recuperación de contraseñas.\n\nLIAA · PITec · Universidad Autónoma de Zacatecas`,
    html,
    attachments,
  });
  return { ok: true, host: effective.host, port: effective.port };
}

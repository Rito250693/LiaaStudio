#!/usr/bin/env node
/**
 * Herramienta CLI de rescate de emergencia para restablecer la contraseña
 * de cualquier usuario (incluido el Superadministrador) directamente desde el servidor.
 *
 * Uso:
 *   npm run reset-password -- <usuario> "<NuevaContraseñaSegura123>"
 */
import readline from 'node:readline';
import { getDb, hashPassword } from './db.mjs';
import { validatePasswordPolicy } from './security.mjs';
import { APP_ENV, PATHS } from './config.mjs';

function promptText(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  const args = process.argv.slice(2);
  const username = (args[0] || (await promptText('Usuario a restablecer: '))).trim();
  if (!username) {
    console.error('Error: Debes indicar el nombre de usuario.');
    process.exit(1);
  }

  const db = getDb();
  const user = db
    .prepare('SELECT id, username, display_name, status FROM users WHERE LOWER(username) = LOWER(?)')
    .get(username);

  if (!user) {
    console.error(`Error: No se encontró el usuario "${username}" en ${PATHS.dbFile} (${APP_ENV}).`);
    process.exit(1);
  }

  const newPassword =
    args[1] || (await promptText(`Nueva contraseña para @${user.username} (mín. 10 caracteres): `));

  const strength = validatePasswordPolicy(newPassword);
  if (!strength.ok) {
    console.error(`Error: ${strength.error}`);
    process.exit(1);
  }

  const { salt, hash } = hashPassword(newPassword);
  const nowIso = new Date().toISOString();

  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare(`
      UPDATE users
      SET salt = ?, password_hash = ?, must_change_password = 0, locked_until = NULL, status = 'active', updated_at = ?
      WHERE id = ?
    `).run(salt, hash, nowIso, user.id);

    db.prepare('UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL').run(
      nowIso,
      user.id,
    );
    db.prepare('UPDATE password_reset_tokens SET used_at = ? WHERE user_id = ? AND used_at IS NULL').run(
      nowIso,
      user.id,
    );
    db.prepare('DELETE FROM rate_limits WHERE key = ?').run(`login:user:${user.username.toLowerCase()}`);

    db.prepare(`
      INSERT INTO audit_logs (actor_id, actor_username, actor_role, action, resource_type, resource_id, details_json, ip, created_at)
      VALUES (?, ?, 'cli', 'auth.cli_password_reset', 'user', ?, ?, 'localhost', ?)
    `).run(user.id, user.username, user.id, JSON.stringify({ env: APP_ENV }), nowIso);

    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  console.log(`✅ Contraseña de @${user.username} restablecida correctamente (${APP_ENV}).`);
  console.log('   Todas las sesiones anteriores fueron cerradas.');
}

main().catch((err) => {
  console.error('Error al restablecer contraseña:', err);
  process.exit(1);
});

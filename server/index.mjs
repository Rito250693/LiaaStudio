import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { APP_ENV, PATHS, SECURITY_CONFIG } from './config.mjs';
import { handleCmsApi } from './cmsMiddleware.mjs';

const PORT = Number(process.env.PORT || 3000);
const DIST_DIR = path.join(PATHS.root, 'dist');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

function serveFile(res, filePath, isUserUpload = false) {
  const ext = path.extname(filePath).toLowerCase();
  const headers = {
    'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  };
  if (isUserUpload) {
    // Prevent any uploaded file from ever executing script in the browser
    headers['Content-Security-Policy'] = "default-src 'none'; sandbox";
    headers['Cache-Control'] = 'public, max-age=86400';
  }
  if (SECURITY_CONFIG.enforceHttps) {
    headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains';
  }
  res.writeHead(200, headers);
  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer(async (req, res) => {
  if (
    SECURITY_CONFIG.enforceHttps &&
    req.headers['x-forwarded-proto'] &&
    req.headers['x-forwarded-proto'] !== 'https'
  ) {
    res.writeHead(301, { Location: `https://${req.headers.host}${req.url}` });
    res.end();
    return;
  }

  const handled = await handleCmsApi(req, res);
  if (handled) return;

  const parsed = new URL(req.url || '/', 'http://localhost');
  const reqPath = decodeURIComponent(parsed.pathname);

  // Explicitly block any probing of private directories or dotfiles
  if (
    reqPath.startsWith('/server/') ||
    reqPath.startsWith('/backups/') ||
    reqPath.includes('/.env') ||
    reqPath.includes('..')
  ) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Acceso denegado.');
    return;
  }

  if (reqPath.startsWith('/images/') || reqPath === '/content.json') {
    const pubTarget = path.resolve(PATHS.publicDir, `.${reqPath}`);
    if (
      pubTarget.startsWith(PATHS.publicDir) &&
      fs.existsSync(pubTarget) &&
      fs.statSync(pubTarget).isFile()
    ) {
      const isUpload = reqPath.startsWith('/images/uploads/');
      serveFile(res, pubTarget, isUpload);
      return;
    }
  }

  const cleanPath = reqPath === '/' ? '/index.html' : reqPath;
  const distTarget = path.resolve(DIST_DIR, `.${cleanPath}`);
  if (
    distTarget.startsWith(DIST_DIR) &&
    fs.existsSync(distTarget) &&
    fs.statSync(distTarget).isFile()
  ) {
    serveFile(res, distTarget, false);
    return;
  }

  const fallback = path.join(DIST_DIR, 'index.html');
  if (fs.existsSync(fallback)) {
    serveFile(res, fallback, false);
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Ejecuta primero "npm run build" antes de iniciar el servidor.');
});

server.listen(PORT, () => {
  console.log(`LIAA CMS [${APP_ENV.toUpperCase()}] activo en http://localhost:${PORT}`);
});

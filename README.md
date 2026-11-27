# LIAA Studio — Portal Web y CMS del Laboratorio de Inteligencia Artificial Avanzada (UAZ)

Portal web institucional y panel administrativo (**LIAA Studio**) del **Laboratorio de Inteligencia Artificial Avanzada (LIAA)**, adscrito al **Posgrado en Ingeniería y Tecnología Aplicada (PITec)** de la **Universidad Autónoma de Zacatecas (UAZ)**.

## Tecnologías principales

- **Frontend:** React 19, TypeScript 5.8, Vite 6, Tailwind CSS v4, React Router 7, `lucide-react`, `qrcode`.
- **Backend:** Servidor HTTP nativo en **Node.js (`>= 22.13.0`)** con API REST, autenticación por sesiones `HttpOnly`, protección CSRF, control de acceso basado en roles (**RBAC** con 21 permisos granulares), **2FA (TOTP con QR local)**, cifrado en reposo **AES-256-GCM**, bitácora de auditoría y envío de correo **SMTP** (`nodemailer`).
- **Base de datos:** **SQLite embebido** mediante el módulo nativo `node:sqlite` (modo WAL, sin instalar motores externos).
- **Editor visual en vivo:** Edición inline de títulos, textos y tipografías (global e individual) en todas las páginas públicas y personalizadas, además de bloques y lienzo visual arrastrable.

## Requisitos

- **Node.js `>= 22.13.0`** (obligatorio para `node:sqlite` sin flag experimental).
  - En servidores ARM de 32 bits (`armhf` / `armv7l`, como **ASUS Tinker Board S**): usar **Node.js `22.x LTS`**.

## Inicio rápido en desarrollo local

```bash
npm ci
npm run dev
```

- Sitio público: `http://localhost:5173/`
- Panel administrativo: `http://localhost:5173/admin`

*(En desarrollo, `.env.local` y `server/data/liaa.development.db` se crean automáticamente la primera vez y están ignorados en `.gitignore`.)*

## Despliegue en producción

### Opción 1: Docker Compose (recomendada)

1. Crea `.env.production` tomando como base `.env.example` y genera dos secretos hexadecimales de 64 caracteres:
   ```bash
   node -e "console.log('LIAA_ENCRYPTION_KEY=' + require('crypto').randomBytes(32).toString('hex'))"
   node -e "console.log('LIAA_SESSION_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
   ```
2. Prepara los directorios persistentes (en Linux, asigna UID `1000` del usuario `node`):
   ```bash
   mkdir -p server/data public/images/uploads
   sudo chown -R 1000:1000 server/data public/images/uploads
   ```
3. Levanta el contenedor:
   - En PC o servidor **64 bits (`amd64` / `arm64`)**:
     ```bash
     docker compose up -d --build
     ```
   - En servidores **ARM 32 bits / 2 GB RAM** (ej. ASUS Tinker Board S `armhf`, compilando `dist/` previamente en una PC con `npm run build`):
     ```bash
     LIAA_DOCKER_TARGET=prebuilt docker compose up -d --build
     ```

### Opción 2: Node.js + `systemd` + Nginx (sin Docker)

```bash
# En PC de desarrollo (compilar frontend)
npm ci && npm run build

# En el servidor Linux (instalar solo producción)
npm ci --omit=dev
LIAA_ENV=production node server/index.mjs
```

Configura Nginx como proxy reverso hacia `http://127.0.0.1:3000` (con `client_max_body_size 55M;`) y `LIAA_ENFORCE_HTTPS=true` + `LIAA_TRUST_PROXY=true` cuando actives SSL/HTTPS.

## Herramienta de rescate de contraseña (CLI)

Si el Superadministrador pierde acceso y no hay SMTP configurado, desde el servidor se puede restablecer cualquier cuenta de forma segura:

```bash
npm run reset-password -- <usuario> "<NuevaContraseñaSegura123>"
```

## Estructura principal

```text
├── src/                 # Frontend React + TypeScript + Editor Visual + Panel LIAA Studio
├── server/              # Backend HTTP, API REST, RBAC, 2FA TOTP, Vault AES-256-GCM, SMTP y SQLite
├── public/images/       # Imágenes institucionales y carpeta uploads/
├── Dockerfile           # Imagen multi-arch (amd64, arm64, arm/v7) con targets runner y prebuilt
├── docker-compose.yml   # Orquestación con volúmenes persistentes y límites de memoria
└── .env.example         # Plantilla de variables de entorno (sin secretos reales)
```

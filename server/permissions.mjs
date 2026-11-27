export const PERMISSION_CATALOG = [
  // Sitio y Diseño
  { key: 'site.design', group: 'Sitio y Diseño', label: 'Modificar diseño visual, portada y bloques' },
  { key: 'site.menus', group: 'Sitio y Diseño', label: 'Administrar menús y navegación' },
  { key: 'site.pages', group: 'Sitio y Diseño', label: 'Crear y editar páginas institucionales' },
  { key: 'site.settings', group: 'Sitio y Diseño', label: 'Editar configuración general y contacto' },

  // Publicaciones y Noticias
  { key: 'content.create', group: 'Publicaciones y Noticias', label: 'Crear nuevas noticias y artículos' },
  { key: 'content.edit_own', group: 'Publicaciones y Noticias', label: 'Editar publicaciones propias' },
  { key: 'content.edit_any', group: 'Publicaciones y Noticias', label: 'Editar publicaciones de otros autores' },
  { key: 'content.submit_review', group: 'Publicaciones y Noticias', label: 'Enviar contenidos a revisión' },
  { key: 'content.publish', group: 'Publicaciones y Noticias', label: 'Publicar y despublicar directamente' },
  { key: 'content.delete', group: 'Publicaciones y Noticias', label: 'Eliminar publicaciones' },

  // Investigación y Proyectos
  { key: 'research.collaborate', group: 'Investigación', label: 'Colaborar en proyectos y gestionar perfil investigador' },
  { key: 'research.manage', group: 'Investigación', label: 'Administrar líneas de investigación y proyectos' },

  // Biblioteca Multimedia
  { key: 'media.upload', group: 'Multimedia', label: 'Subir imágenes y archivos' },
  { key: 'media.delete', group: 'Multimedia', label: 'Eliminar archivos multimedia' },
  { key: 'media.private_read', group: 'Multimedia', label: 'Consultar recursos y documentos internos privados' },

  // Usuarios y Roles
  { key: 'users.view', group: 'Usuarios y Roles', label: 'Ver directorio de usuarios' },
  { key: 'users.create', group: 'Usuarios y Roles', label: 'Crear nuevas cuentas de usuario' },
  { key: 'users.manage', group: 'Usuarios y Roles', label: 'Suspender, bloquear, revocar sesiones y gestionar usuarios' },
  { key: 'roles.manage', group: 'Usuarios y Roles', label: 'Crear y modificar roles y permisos personalizados' },

  // Auditoría y Sistema
  { key: 'audit.view', group: 'Seguridad y Auditoría', label: 'Consultar registro de auditoría y actividad' },
  { key: 'system.backups', group: 'Seguridad y Auditoría', label: 'Exportar y restaurar respaldos del sistema' },
];

export const ALL_PERMISSION_KEYS = PERMISSION_CATALOG.map((p) => p.key);

export const SYSTEM_ROLES = [
  {
    id: 'role-superadmin',
    slug: 'superadmin',
    name: 'Superadministrador',
    description: 'Control total del sistema, seguridad, roles, diseño y respaldos.',
    isSystem: 1,
    permissions: ['*'],
  },
  {
    id: 'role-admin',
    slug: 'admin',
    name: 'Administrador',
    description: 'Gestiona el portal, diseño, contenidos, multimedia y usuarios autorizados.',
    isSystem: 1,
    permissions: ALL_PERMISSION_KEYS.filter((k) => k !== 'system.backups'),
  },
  {
    id: 'role-editor',
    slug: 'editor',
    name: 'Editor',
    description: 'Crea, revisa, edita y publica noticias, páginas de contenido y multimedia.',
    isSystem: 1,
    permissions: [
      'content.create',
      'content.edit_own',
      'content.edit_any',
      'content.submit_review',
      'content.publish',
      'content.delete',
      'media.upload',
      'media.private_read',
      'users.view',
      'users.create',
    ],
  },
  {
    id: 'role-investigador',
    slug: 'investigador',
    name: 'Investigador',
    description: 'Gestiona su perfil académico, colabora en proyectos y prepara publicaciones.',
    isSystem: 1,
    permissions: [
      'content.create',
      'content.edit_own',
      'content.submit_review',
      'research.collaborate',
      'media.upload',
      'media.private_read',
      'users.view',
    ],
  },
  {
    id: 'role-autor',
    slug: 'autor',
    name: 'Autor',
    description: 'Crea noticias y artículos propios y los envía a revisión.',
    isSystem: 1,
    permissions: [
      'content.create',
      'content.edit_own',
      'content.submit_review',
      'media.upload',
      'users.view',
    ],
  },
  {
    id: 'role-colaborador',
    slug: 'colaborador',
    name: 'Colaborador',
    description: 'Prepara borradores de contenido para revisión sin publicar directamente.',
    isSystem: 1,
    permissions: ['content.create', 'content.edit_own', 'content.submit_review'],
  },
  {
    id: 'role-lector-privado',
    slug: 'lector_privado',
    name: 'Lector privado',
    description: 'Acceso de solo lectura a recursos y documentos internos autorizados.',
    isSystem: 1,
    permissions: ['media.private_read'],
  },
];

export function resolveEffectivePermissions(rolePermissions, customOverrides) {
  if (Array.isArray(rolePermissions) && rolePermissions.includes('*')) {
    return ['*', ...ALL_PERMISSION_KEYS];
  }
  const set = new Set(Array.isArray(rolePermissions) ? rolePermissions : []);
  if (customOverrides && typeof customOverrides === 'object') {
    if (Array.isArray(customOverrides.grant)) {
      for (const p of customOverrides.grant) set.add(p);
    }
    if (Array.isArray(customOverrides.deny)) {
      for (const p of customOverrides.deny) set.delete(p);
    }
  }
  return Array.from(set);
}

export function userHasPermission(userPermissions, required) {
  if (!Array.isArray(userPermissions)) return false;
  if (userPermissions.includes('*')) return true;
  if (Array.isArray(required)) {
    return required.some((perm) => userPermissions.includes(perm));
  }
  return userPermissions.includes(required);
}

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  Activity,
  Ban,
  Check,
  Clock,
  Copy,
  Crown,
  KeyRound,
  Link2,
  Loader2,
  Lock,
  LogOut,
  Plus,
  QrCode,
  RotateCcw,
  Save,
  Shield,
  ShieldCheck,
  Smartphone,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import QRCode from 'qrcode';
import { useAuth, type AuthUser } from '../../context/AuthContext';
import { apiFetch } from '../../utils/apiClient';
import { ImageField, type GalleryImage } from './ImageField';

interface PermissionDef {
  key: string;
  group: string;
  label: string;
}

interface RoleDef {
  id: string;
  slug: string;
  name: string;
  description: string;
  isSystem: boolean;
  permissions: string[];
  userCount: number;
}

interface UsersProfileTabProps {
  images: GalleryImage[];
  onUploaded: (img: GalleryImage) => void;
  showToast: (type: 'success' | 'error', text: string) => void;
  onInspectAuditForUser: (username: string) => void;
}

type SubTab = 'profile' | 'users' | 'roles';

export function UsersProfileTab({
  images,
  onUploaded,
  showToast,
  onInspectAuditForUser,
}: UsersProfileTabProps) {
  const { user, isSuperAdmin, hasPermission, setAuthSession } = useAuth();
  const canCreateUsers = hasPermission(['users.create', 'users.manage']);
  const canManageUsers = hasPermission('users.manage');
  const canManageRoles = hasPermission('roles.manage');
  const canViewAudit = hasPermission('audit.view');

  const [subTab, setSubTab] = useState<SubTab>('profile');

  // My Profile state
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [email, setEmail] = useState(user?.email || '');
  const [username, setUsername] = useState(user?.username || '');
  const [avatar, setAvatar] = useState(user?.avatar || '/images/liaa-emblem.png');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // 2FA state
  const [totpSetup, setTotpSetup] = useState<{ secret: string; otpauthUri: string } | null>(null);
  const [totpQrDataUrl, setTotpQrDataUrl] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [totpDisablePass, setTotpDisablePass] = useState('');
  const [totpBusy, setTotpBusy] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);

  useEffect(() => {
    let active = true;
    if (!totpSetup?.otpauthUri) {
      setTotpQrDataUrl(null);
      return;
    }
    // Normalize label colon (`Issuer:account`) for maximum compatibility with Google & Microsoft Authenticator
    const normalizedUri = totpSetup.otpauthUri.replace(
      /^(otpauth:\/\/totp\/[^?]+?)%3A/i,
      '$1:',
    );
    QRCode.toDataURL(normalizedUri, {
      width: 224,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#0b1229', light: '#ffffff' },
    })
      .then((dataUrl) => {
        if (active) setTotpQrDataUrl(dataUrl);
      })
      .catch(() => {
        if (active) setTotpQrDataUrl(null);
      });
    return () => {
      active = false;
    };
  }, [totpSetup]);

  // Users & Roles data
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [roles, setRoles] = useState<RoleDef[]>([]);
  const [permissionsCatalog, setPermissionsCatalog] = useState<PermissionDef[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Create new account
  const [newAccUsername, setNewAccUsername] = useState('');
  const [newAccEmail, setNewAccEmail] = useState('');
  const [newAccDisplayName, setNewAccDisplayName] = useState('');
  const [newAccPassword, setNewAccPassword] = useState('');
  const [newAccRoleId, setNewAccRoleId] = useState('role-autor');
  const [newAccAvatar, setNewAccAvatar] = useState('/images/liaa-emblem.png');
  const [newAccForceChange, setNewAccForceChange] = useState(true);
  const [creatingAcc, setCreatingAcc] = useState(false);

  // Custom role creator / editor
  const [selectedRoleId, setSelectedRoleId] = useState<string>('role-editor');
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDesc, setNewRoleDesc] = useState('');
  const [creatingRole, setCreatingRole] = useState(false);
  const [roleDraftPerms, setRoleDraftPerms] = useState<string[]>([]);
  const [roleDraftName, setRoleDraftName] = useState('');
  const [roleDraftDesc, setRoleDraftDesc] = useState('');
  const [savingRole, setSavingRole] = useState(false);

  const loadAll = useCallback(async () => {
    setLoadingData(true);
    try {
      const [uRes, rRes, pRes] = await Promise.all([
        fetch('/api/users', { cache: 'no-store' }),
        fetch('/api/roles', { cache: 'no-store' }),
        fetch('/api/permissions', { cache: 'no-store' }),
      ]);
      if (uRes.ok) {
        const uData = await uRes.json();
        setUsers(uData.users || []);
      }
      if (rRes.ok) {
        const rData = await rRes.json();
        setRoles(rData.roles || []);
      }
      if (pRes.ok) {
        const pData = await pRes.json();
        setPermissionsCatalog(pData.permissions || []);
      }
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName);
      setEmail(user.email || '');
      setUsername(user.username);
      setAvatar(user.avatar);
    }
  }, [user]);

  const selectedRole = useMemo(
    () => roles.find((r) => r.id === selectedRoleId) || roles[0] || null,
    [roles, selectedRoleId],
  );

  useEffect(() => {
    if (selectedRole) {
      setRoleDraftName(selectedRole.name);
      setRoleDraftDesc(selectedRole.description);
      setRoleDraftPerms(selectedRole.permissions);
    }
  }, [selectedRole]);

  const groupedPermissions = useMemo(() => {
    const map = new Map<string, PermissionDef[]>();
    for (const p of permissionsCatalog) {
      const list = map.get(p.group) || [];
      list.push(p);
      map.set(p.group, list);
    }
    return Array.from(map.entries());
  }, [permissionsCatalog]);

  // --- PROFILE HANDLERS ---
  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (newPassword && newPassword !== confirmPassword) {
      showToast('error', 'La nueva contraseña y su confirmación no coinciden.');
      return;
    }
    setSavingProfile(true);
    try {
      const res = await apiFetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          email,
          displayName,
          avatar,
          currentPassword,
          newPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo actualizar tu perfil.');
      setAuthSession(data.user);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      await loadAll();
      showToast('success', 'Perfil actualizado correctamente.');
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Error al actualizar perfil.');
    } finally {
      setSavingProfile(false);
    }
  };

  // --- 2FA HANDLERS ---
  const handleStart2FA = async () => {
    setTotpBusy(true);
    try {
      const res = await apiFetch('/api/auth/2fa/setup', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error generando clave 2FA.');
      setTotpSetup({ secret: data.secret, otpauthUri: data.otpauthUri });
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Error configurando 2FA.');
    } finally {
      setTotpBusy(false);
    }
  };

  const handleEnable2FA = async (e: FormEvent) => {
    e.preventDefault();
    setTotpBusy(true);
    try {
      const res = await apiFetch('/api/auth/2fa/enable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: totpCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Código 2FA inválido.');
      setAuthSession(data.user);
      setTotpSetup(null);
      setTotpCode('');
      await loadAll();
      showToast('success', 'Autenticación de dos factores (2FA) activada.');
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Error activando 2FA.');
    } finally {
      setTotpBusy(false);
    }
  };

  const handleDisable2FA = async (e: FormEvent) => {
    e.preventDefault();
    setTotpBusy(true);
    try {
      const res = await apiFetch('/api/auth/2fa/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: totpDisablePass }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo desactivar 2FA.');
      setAuthSession(data.user);
      setTotpDisablePass('');
      await loadAll();
      showToast('success', '2FA desactivado en tu cuenta.');
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Error desactivando 2FA.');
    } finally {
      setTotpBusy(false);
    }
  };

  // --- USER MANAGEMENT HANDLERS ---
  const handleCreateUser = async (e: FormEvent) => {
    e.preventDefault();
    setCreatingAcc(true);
    try {
      const res = await apiFetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: newAccUsername,
          email: newAccEmail,
          displayName: newAccDisplayName || newAccUsername,
          password: newAccPassword,
          roleId: newAccRoleId,
          avatar: newAccAvatar,
          mustChangePassword: newAccForceChange,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo crear la cuenta.');
      setNewAccUsername('');
      setNewAccEmail('');
      setNewAccDisplayName('');
      setNewAccPassword('');
      setNewAccAvatar('/images/liaa-emblem.png');
      await loadAll();
      showToast('success', `Cuenta @${data.user.username} (${data.user.roleName}) creada.`);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Error creando cuenta.');
    } finally {
      setCreatingAcc(false);
    }
  };

  const patchTargetUser = async (target: AuthUser, body: Record<string, unknown>, msg: string) => {
    try {
      const res = await apiFetch(`/api/users/${encodeURIComponent(target.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo aplicar el cambio.');
      await loadAll();
      showToast('success', msg);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Error actualizando usuario.');
    }
  };

  const handleRevokeSessions = async (target: AuthUser) => {
    try {
      const res = await apiFetch(`/api/users/${encodeURIComponent(target.id)}/revoke-sessions`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error revocando sesiones.');
      await loadAll();
      showToast('success', `Todas las sesiones de @${target.username} fueron revocadas.`);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Error revocando sesiones.');
    }
  };

  const handleResetPasswordPrompt = async (target: AuthUser) => {
    const tempPass = window.prompt(
      `Nueva contraseña temporal para @${target.username} (mín. 10 caracteres; se le obligará a cambiarla al entrar):`,
    );
    if (!tempPass) return;
    await patchTargetUser(
      target,
      { newPassword: tempPass },
      `Contraseña temporal asignada a @${target.username} y sesiones cerradas.`,
    );
  };

  const handleGenerateResetLink = async (target: AuthUser) => {
    try {
      const res = await apiFetch(`/api/users/${encodeURIComponent(target.id)}/reset-link`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo generar el enlace.');
      try {
        await navigator.clipboard.writeText(data.resetUrl);
        showToast(
          'success',
          `Enlace de un solo uso para @${target.username} copiado al portapapeles (expira en ${data.expiresMinutes || 20} min).`,
        );
      } catch {
        window.prompt(`Enlace de recuperación para @${target.username} (expira en 20 min):`, data.resetUrl);
      }
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Error generando enlace.');
    }
  };

  const handleDeleteUser = async (target: AuthUser) => {
    if (!window.confirm(`¿Eliminar definitivamente a @${target.username}? (Para conservar historial usa "Desactivar")`)) {
      return;
    }
    try {
      const res = await apiFetch(`/api/users/${encodeURIComponent(target.id)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo eliminar.');
      await loadAll();
      showToast('success', `Usuario @${target.username} eliminado.`);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Error eliminando usuario.');
    }
  };

  // --- ROLES & PERMISSIONS HANDLERS ---
  const handleCreateRole = async (e: FormEvent) => {
    e.preventDefault();
    if (!newRoleName.trim()) return;
    setCreatingRole(true);
    try {
      const res = await apiFetch('/api/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newRoleName.trim(),
          description: newRoleDesc.trim(),
          permissions: ['content.create', 'content.edit_own', 'content.submit_review'],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo crear el rol.');
      setNewRoleName('');
      setNewRoleDesc('');
      await loadAll();
      setSelectedRoleId(data.role.id);
      showToast('success', `Rol personalizado "${data.role.name}" creado.`);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Error creando rol.');
    } finally {
      setCreatingRole(false);
    }
  };

  const handleSaveRolePermissions = async () => {
    if (!selectedRole) return;
    setSavingRole(true);
    try {
      const res = await apiFetch(`/api/roles/${encodeURIComponent(selectedRole.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: roleDraftName,
          description: roleDraftDesc,
          permissions: roleDraftPerms,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudieron guardar los permisos.');
      await loadAll();
      showToast('success', `Permisos del rol "${roleDraftName}" actualizados.`);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Error guardando rol.');
    } finally {
      setSavingRole(false);
    }
  };

  const handleDeleteRole = async (role: RoleDef) => {
    if (!window.confirm(`¿Eliminar el rol personalizado "${role.name}"?`)) return;
    try {
      const res = await apiFetch(`/api/roles/${encodeURIComponent(role.id)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo eliminar el rol.');
      await loadAll();
      setSelectedRoleId('role-editor');
      showToast('success', `Rol "${role.name}" eliminado.`);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Error eliminando rol.');
    }
  };

  const assignableRoles = roles.filter((r) => {
    if (isSuperAdmin) return true;
    if (r.permissions.includes('*')) return false;
    return r.permissions.every((p) => hasPermission(p));
  });

  // Per-user custom permissions modal state
  const [overrideUser, setOverrideUser] = useState<AuthUser | null>(null);
  const [overrideGrant, setOverrideGrant] = useState<string[]>([]);
  const [overrideDeny, setOverrideDeny] = useState<string[]>([]);
  const [savingOverrides, setSavingOverrides] = useState(false);

  const openOverridesModal = (u: AuthUser) => {
    setOverrideUser(u);
    setOverrideGrant(u.customPermissions?.grant || []);
    setOverrideDeny(u.customPermissions?.deny || []);
  };

  const saveOverrides = async () => {
    if (!overrideUser) return;
    setSavingOverrides(true);
    try {
      await patchTargetUser(
        overrideUser,
        { customPermissions: { grant: overrideGrant, deny: overrideDeny } },
        `Permisos individuales de @${overrideUser.username} actualizados.`,
      );
      setOverrideUser(null);
    } finally {
      setSavingOverrides(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Sub-navigation pills */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setSubTab('profile')}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition ${
            subTab === 'profile'
              ? 'bg-blue-600 text-white dark:bg-cyan-400 dark:text-slate-950'
              : 'border border-slate-200 bg-white text-slate-700 dark:border-white/10 dark:bg-[#0b1229] dark:text-slate-300'
          }`}
        >
          <Smartphone className="h-4 w-4" />
          Mi Perfil y 2FA
        </button>

        <button
          type="button"
          onClick={() => setSubTab('users')}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition ${
            subTab === 'users'
              ? 'bg-blue-600 text-white dark:bg-cyan-400 dark:text-slate-950'
              : 'border border-slate-200 bg-white text-slate-700 dark:border-white/10 dark:bg-[#0b1229] dark:text-slate-300'
          }`}
        >
          <Users className="h-4 w-4" />
          Usuarios ({users.length})
        </button>

        <button
          type="button"
          onClick={() => setSubTab('roles')}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition ${
            subTab === 'roles'
              ? 'bg-blue-600 text-white dark:bg-cyan-400 dark:text-slate-950'
              : 'border border-slate-200 bg-white text-slate-700 dark:border-white/10 dark:bg-[#0b1229] dark:text-slate-300'
          }`}
        >
          <Shield className="h-4 w-4" />
          Roles y Permisos ({roles.length})
        </button>
      </div>

      {/* ================= SUBTAB 1: MY PROFILE & 2FA ================= */}
      {subTab === 'profile' && (
        <div className="grid gap-8 lg:grid-cols-12">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 lg:col-span-7 dark:border-white/10 dark:bg-[#0b1229]">
            <div className="flex flex-wrap items-center gap-4 border-b border-slate-200 pb-6 dark:border-white/10">
              <img
                src={avatar || '/images/liaa-emblem.png'}
                alt={displayName}
                className="h-20 w-20 rounded-full border-2 border-cyan-400/60 bg-slate-900 object-cover shadow-lg"
              />
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-display text-2xl font-bold">{displayName || username}</h2>
                  <span className="inline-flex items-center gap-1 rounded-full bg-cyan-500/15 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-sky-700 dark:text-cyan-300">
                    {isSuperAdmin ? <Crown className="h-3 w-3 text-amber-400" /> : <UserCheck className="h-3 w-3" />}
                    {user?.roleName}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Tu foto de perfil y nombre se muestran siempre en la barra superior al iniciar sesión.
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveProfile} className="mt-6 space-y-5">
              <ImageField
                label="Tu foto de perfil"
                value={avatar}
                onChange={setAvatar}
                images={images}
                onUploaded={onUploaded}
              />

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    Nombre visible
                  </label>
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm dark:border-white/15 dark:bg-white/5 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    Usuario (login)
                  </label>
                  <input
                    type="text"
                    required
                    minLength={3}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 font-mono text-sm dark:border-white/15 dark:bg-white/5 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    Correo institucional
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nombre@uaz.edu.mx"
                    className="mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm dark:border-white/15 dark:bg-white/5 dark:text-white"
                  />
                  <p
                    className={`mt-1 text-[11px] ${
                      user?.email
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-amber-600 dark:text-amber-300'
                    }`}
                  >
                    {user?.email
                      ? 'Correo guardado para recuperación de contraseña.'
                      : 'Sin correo guardado: regístralo para poder recuperar tu contraseña.'}
                  </p>
                </div>
              </div>

              <div className="grid gap-4 border-t border-slate-200 pt-5 sm:grid-cols-3 dark:border-white/10">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    Contraseña actual
                  </label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Solo si cambias clave"
                    className="mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm dark:border-white/15 dark:bg-white/5 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    Nueva contraseña
                  </label>
                  <input
                    type="password"
                    minLength={10}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mín. 10 caracteres"
                    className="mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm dark:border-white/15 dark:bg-white/5 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    Confirmar clave
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repetir nueva clave"
                    className="mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm dark:border-white/15 dark:bg-white/5 dark:text-white"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={savingProfile}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#0845ff] to-[#029be6] px-5 py-3 text-sm font-semibold text-white shadow-md"
              >
                {savingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Guardar mi perfil
              </button>
            </form>
          </div>

          {/* 2FA Card */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 lg:col-span-5 dark:border-white/10 dark:bg-[#0b1229]">
            <div className="flex items-center gap-3">
              <div
                className={`flex h-11 w-11 items-center justify-center rounded-2xl ${
                  user?.totpEnabled
                    ? 'bg-emerald-500/15 text-emerald-500'
                    : 'bg-amber-500/15 text-amber-500'
                }`}
              >
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-display text-lg font-bold">
                  Autenticación de Dos Factores (2FA)
                </h3>
                <p className="font-mono text-xs text-slate-500">
                  Estado:{' '}
                  <strong className={user?.totpEnabled ? 'text-emerald-500' : 'text-amber-500'}>
                    {user?.totpEnabled ? 'ACTIVADO (TOTP)' : 'Desactivado'}
                  </strong>
                </p>
              </div>
            </div>

            <p className="mt-4 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              Protege tu cuenta con códigos temporales de 6 dígitos compatibles con{' '}
              <strong>Google Authenticator, Microsoft Authenticator o Authy</strong>.
            </p>

            {user?.totpEnabled ? (
              <form onSubmit={handleDisable2FA} className="mt-6 space-y-3">
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Para desactivar 2FA, confirma tu contraseña actual:
                </label>
                <input
                  type="password"
                  required
                  value={totpDisablePass}
                  onChange={(e) => setTotpDisablePass(e.target.value)}
                  placeholder="Tu contraseña actual"
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-cyan-500 focus:bg-white focus:outline-none dark:border-white/15 dark:bg-white/5 dark:text-white dark:focus:bg-[#0f1936]"
                />
                <button
                  type="submit"
                  disabled={totpBusy}
                  className="inline-flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-xs font-semibold text-rose-500 hover:bg-rose-500/20"
                >
                  Desactivar 2FA
                </button>
              </form>
            ) : totpSetup ? (
              <form onSubmit={handleEnable2FA} className="mt-6 space-y-4">
                <div className="rounded-2xl border border-cyan-500/30 bg-slate-50 p-4 dark:bg-white/5">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200">
                    <QrCode className="h-4 w-4 shrink-0 text-cyan-600 dark:text-cyan-400" />
                    <span>
                      1. Escanea este código QR con Google Authenticator, Microsoft Authenticator o
                      tu app preferida:
                    </span>
                  </div>

                  <div className="mt-4 flex flex-col items-center">
                    <div className="rounded-2xl bg-white p-3 shadow-md ring-1 ring-slate-200">
                      {totpQrDataUrl ? (
                        <img
                          src={totpQrDataUrl}
                          alt="Código QR para configurar autenticación 2FA del LIAA"
                          className="h-48 w-48 sm:h-52 sm:w-52"
                        />
                      ) : (
                        <div className="flex h-48 w-48 items-center justify-center text-slate-400">
                          <Loader2 className="h-6 w-6 animate-spin" />
                        </div>
                      )}
                    </div>
                    <p className="mt-2 text-center text-[11px] text-slate-500 dark:text-slate-400">
                      Generado localmente en tu equipo · Tipo TOTP (6 dígitos / 30 s)
                    </p>
                  </div>

                  <div className="mt-4 border-t border-slate-200 pt-3 dark:border-white/10">
                    <p className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
                      ¿No puedes escanear? Ingresa esta clave manual:
                    </p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <code className="flex-1 break-all rounded-lg bg-slate-900 px-3 py-2 font-mono text-xs text-cyan-300">
                        {totpSetup.secret}
                      </code>
                      <button
                        type="button"
                        onClick={async () => {
                          await navigator.clipboard.writeText(totpSetup.secret);
                          setCopiedSecret(true);
                          setTimeout(() => setCopiedSecret(false), 2000);
                        }}
                        className="rounded-lg border border-slate-300 p-2 text-slate-700 hover:bg-slate-100 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/10"
                        title="Copiar clave manual"
                      >
                        {copiedSecret ? (
                          <Check className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                    2. Ingresa el código de 6 dígitos que genera tu app:
                  </label>
                  <input
                    type="text"
                    required
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    className="mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-center font-mono text-lg tracking-[0.4em] text-slate-900 focus:border-cyan-500 focus:bg-white focus:outline-none dark:border-white/15 dark:bg-white/5 dark:text-white dark:focus:bg-[#0f1936]"
                  />
                  <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                    Si el código marca error, verifica que la fecha y hora de tu PC y tu celular
                    estén sincronizadas automáticamente.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="submit"
                    disabled={totpBusy || totpCode.length !== 6}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                  >
                    {totpBusy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ShieldCheck className="h-4 w-4" />
                    )}
                    Verificar y activar 2FA
                  </button>
                  <button
                    type="button"
                    disabled={totpBusy}
                    onClick={() => {
                      setTotpSetup(null);
                      setTotpQrDataUrl(null);
                      setTotpCode('');
                    }}
                    className="rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:border-white/15 dark:text-slate-300 dark:hover:bg-white/10"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            ) : (
              <button
                type="button"
                disabled={totpBusy}
                onClick={handleStart2FA}
                className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#0845ff] to-[#029be6] px-4 py-2.5 text-xs font-semibold text-white shadow-md"
              >
                <Smartphone className="h-4 w-4" />
                Configurar 2FA ahora
              </button>
            )}
          </div>
        </div>
      )}

      {/* ================= SUBTAB 2: USERS MANAGEMENT ================= */}
      {subTab === 'users' && (
        <div className="space-y-8">
          {canCreateUsers && (
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 dark:border-white/10 dark:bg-[#0b1229]">
              <div className="flex items-center gap-2.5">
                <UserPlus className="h-5 w-5 text-blue-600 dark:text-cyan-400" />
                <h2 className="font-display text-xl font-bold">Crear nueva cuenta de usuario</h2>
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                El registro público está desactivado por seguridad. Solo usuarios autorizados pueden
                dar de alta cuentas.
              </p>

              <form onSubmit={handleCreateUser} className="mt-6 space-y-5">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                  <div>
                    <label className="block text-xs font-semibold uppercase text-slate-500">
                      Usuario *
                    </label>
                    <input
                      type="text"
                      required
                      minLength={3}
                      value={newAccUsername}
                      onChange={(e) => setNewAccUsername(e.target.value)}
                      placeholder="dr.lopez"
                      className="mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-sm dark:border-white/15 dark:bg-white/5"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase text-slate-500">
                      Nombre completo *
                    </label>
                    <input
                      type="text"
                      required
                      value={newAccDisplayName}
                      onChange={(e) => setNewAccDisplayName(e.target.value)}
                      placeholder="Dra. Ana López"
                      className="mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm dark:border-white/15 dark:bg-white/5"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase text-slate-500">
                      Correo
                    </label>
                    <input
                      type="email"
                      value={newAccEmail}
                      onChange={(e) => setNewAccEmail(e.target.value)}
                      placeholder="ana@uaz.edu.mx"
                      className="mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm dark:border-white/15 dark:bg-white/5"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase text-slate-500">
                      Contraseña inicial *
                    </label>
                    <input
                      type="password"
                      required
                      minLength={10}
                      value={newAccPassword}
                      onChange={(e) => setNewAccPassword(e.target.value)}
                      placeholder="Mín. 10 chars"
                      className="mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm dark:border-white/15 dark:bg-white/5"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase text-slate-500">
                      Rol asignado
                    </label>
                    <select
                      value={newAccRoleId}
                      onChange={(e) => setNewAccRoleId(e.target.value)}
                      className="mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-semibold dark:border-white/15 dark:bg-[#070c1c]"
                    >
                      {assignableRoles.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={newAccForceChange}
                    onChange={(e) => setNewAccForceChange(e.target.checked)}
                    className="h-4 w-4 accent-cyan-500"
                  />
                  Obligar a cambiar la contraseña en el siguiente inicio de sesión
                </label>

                <ImageField
                  label="Foto de perfil (opcional)"
                  value={newAccAvatar}
                  onChange={setNewAccAvatar}
                  images={images}
                  onUploaded={onUploaded}
                />

                <button
                  type="submit"
                  disabled={creatingAcc}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white dark:bg-cyan-500 dark:text-slate-950"
                >
                  {creatingAcc ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                  Crear cuenta
                </button>
              </form>
            </div>
          )}

          {/* Users List */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 dark:border-white/10 dark:bg-[#0b1229]">
            <h2 className="font-display text-xl font-bold">
              Directorio y Control de Cuentas ({users.length})
            </h2>

            {loadingData ? (
              <div className="py-10 text-center">
                <Loader2 className="mx-auto h-6 w-6 animate-spin text-cyan-400" />
              </div>
            ) : (
              <div className="mt-6 space-y-4">
                {users.map((u) => {
                  const isMe = u.id === user?.id;
                  const isLocked = Boolean(
                    u.lockedUntil && new Date(u.lockedUntil).getTime() > Date.now(),
                  );

                  return (
                    <div
                      key={u.id}
                      className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 lg:flex-row lg:items-center dark:border-white/10 dark:bg-white/[0.03]"
                    >
                      <div className="flex items-center gap-3.5">
                        <img
                          src={u.avatar || '/images/liaa-emblem.png'}
                          alt={u.displayName}
                          className="h-12 w-12 shrink-0 rounded-full border border-cyan-400/40 bg-slate-900 object-cover"
                        />
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-display text-sm font-bold text-slate-900 dark:text-white">
                              {u.displayName} {isMe ? '(Tú)' : ''}
                            </p>
                            <span className="font-mono text-xs text-slate-500">@{u.username}</span>
                            <span className="rounded-md bg-blue-600/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-blue-700 dark:bg-cyan-400/15 dark:text-cyan-300">
                              {u.roleName}
                            </span>
                            {u.totpEnabled && (
                              <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 font-mono text-[10px] font-semibold text-emerald-600 dark:text-emerald-300">
                                2FA
                              </span>
                            )}
                            {u.status !== 'active' && (
                              <span className="rounded-md bg-rose-500/15 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase text-rose-500">
                                {u.status === 'suspended' ? 'Suspendido' : 'Desactivado'}
                              </span>
                            )}
                            {isLocked && (
                              <span className="rounded-md bg-amber-500/15 px-2 py-0.5 font-mono text-[10px] font-semibold text-amber-500">
                                Bloqueado temp.
                              </span>
                            )}
                          </div>
                          <p className="mt-1 font-mono text-[11px] text-slate-500">
                            Sesiones activas: {u.activeSessions || 0} · Último acceso:{' '}
                            {u.lastLoginAt
                              ? new Date(u.lastLoginAt).toLocaleString('es-MX')
                              : 'Nunca'}
                          </p>
                        </div>
                      </div>

                      {/* Admin controls */}
                      {canManageUsers && !isMe && (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <select
                            value={u.roleId}
                            onChange={(e) =>
                              void patchTargetUser(
                                u,
                                { roleId: e.target.value },
                                `Rol de @${u.username} actualizado.`,
                              )
                            }
                            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold dark:border-white/15 dark:bg-[#070c1c]"
                          >
                            {assignableRoles.map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.name}
                              </option>
                            ))}
                          </select>

                          {u.status === 'active' ? (
                            <button
                              type="button"
                              onClick={() =>
                                void patchTargetUser(
                                  u,
                                  { status: 'suspended' },
                                  `@${u.username} suspendido y sesiones revocadas.`,
                                )
                              }
                              title="Suspender cuenta"
                              className="inline-flex items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-amber-600 dark:text-amber-300"
                            >
                              <Ban className="h-3.5 w-3.5" />
                              Suspender
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                void patchTargetUser(
                                  u,
                                  { status: 'active', lockMinutes: 0 },
                                  `Cuenta @${u.username} reactivada.`,
                                )
                              }
                              className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-300"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                              Reactivar
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() =>
                              void patchTargetUser(
                                u,
                                { lockMinutes: isLocked ? 0 : 60 },
                                isLocked
                                  ? `Bloqueo temporal retirado a @${u.username}.`
                                  : `@${u.username} bloqueado por 1 hora.`,
                              )
                            }
                            title={isLocked ? 'Quitar bloqueo temporal' : 'Bloquear 1 hora'}
                            className="rounded-lg border border-slate-300 p-1.5 text-slate-600 hover:border-amber-400 dark:border-white/15 dark:text-slate-300"
                          >
                            <Clock className="h-3.5 w-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => void handleRevokeSessions(u)}
                            title="Revocar sesiones activas"
                            className="rounded-lg border border-slate-300 p-1.5 text-slate-600 hover:border-rose-400 dark:border-white/15 dark:text-slate-300"
                          >
                            <LogOut className="h-3.5 w-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => void handleResetPasswordPrompt(u)}
                            title="Restablecer contraseña y forzar cambio"
                            className="rounded-lg border border-slate-300 p-1.5 text-slate-600 hover:border-cyan-400 dark:border-white/15 dark:text-slate-300"
                          >
                            <KeyRound className="h-3.5 w-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => void handleGenerateResetLink(u)}
                            title="Generar y copiar enlace de recuperación (20 min)"
                            className="rounded-lg border border-slate-300 p-1.5 text-slate-600 hover:border-emerald-400 hover:text-emerald-500 dark:border-white/15 dark:text-slate-300"
                          >
                            <Link2 className="h-3.5 w-3.5" />
                          </button>

                          {u.status !== 'disabled' && (
                            <button
                              type="button"
                              onClick={() =>
                                void patchTargetUser(
                                  u,
                                  { status: 'disabled' },
                                  `@${u.username} desactivado conservando su historial.`,
                                )
                              }
                              title="Desactivar sin borrar historial"
                              className="rounded-lg border border-slate-300 p-1.5 text-slate-500 hover:border-rose-400 hover:text-rose-500 dark:border-white/15"
                            >
                              <Lock className="h-3.5 w-3.5" />
                            </button>
                          )}

                          {canManageRoles && u.roleSlug !== 'superadmin' && (
                            <button
                              type="button"
                              onClick={() => openOverridesModal(u)}
                              title="Permisos individuales (conceder/denegar)"
                              className="inline-flex items-center gap-1 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-2 py-1.5 text-[11px] font-semibold text-sky-700 dark:text-cyan-300"
                            >
                              <Shield className="h-3.5 w-3.5" />
                              Permisos
                            </button>
                          )}

                          {canViewAudit && (
                            <button
                              type="button"
                              onClick={() => onInspectAuditForUser(u.username)}
                              title="Ver actividad en Auditoría"
                              className="rounded-lg border border-slate-300 p-1.5 text-sky-600 hover:border-cyan-400 dark:border-white/15 dark:text-cyan-400"
                            >
                              <Activity className="h-3.5 w-3.5" />
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => void handleDeleteUser(u)}
                            title="Eliminar cuenta"
                            className="rounded-lg border border-rose-500/30 p-1.5 text-rose-500 hover:bg-rose-500/10"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= SUBTAB 3: ROLES & CUSTOM PERMISSIONS ================= */}
      {subTab === 'roles' && (
        <div className="grid gap-8 lg:grid-cols-12">
          {/* Left: Roles list + Create Custom Role */}
          <div className="space-y-6 lg:col-span-4">
            {canManageRoles && (
              <form
                onSubmit={handleCreateRole}
                className="space-y-3 rounded-3xl border border-cyan-500/30 bg-white p-5 shadow-sm dark:bg-[#0b1229]"
              >
                <h3 className="font-display text-base font-bold">Crear Rol Personalizado</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Ej. <em>&quot;Coordinador de publicaciones&quot;</em> con permisos a la medida.
                </p>
                <input
                  type="text"
                  required
                  minLength={3}
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  placeholder="Nombre del rol"
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-sm dark:border-white/15 dark:bg-white/5"
                />
                <input
                  type="text"
                  value={newRoleDesc}
                  onChange={(e) => setNewRoleDesc(e.target.value)}
                  placeholder="Descripción breve"
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-xs dark:border-white/15 dark:bg-white/5"
                />
                <button
                  type="submit"
                  disabled={creatingRole}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#0845ff] to-[#029be6] px-4 py-2 text-xs font-semibold text-white"
                >
                  <Plus className="h-4 w-4" />
                  Crear rol
                </button>
              </form>
            )}

            <div className="space-y-2">
              {roles.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setSelectedRoleId(r.id)}
                  className={`flex w-full items-center justify-between rounded-2xl border p-4 text-left transition ${
                    selectedRole?.id === r.id
                      ? 'border-blue-600 bg-blue-50/70 dark:border-cyan-400 dark:bg-cyan-400/10'
                      : 'border-slate-200 bg-white hover:border-sky-400 dark:border-white/10 dark:bg-[#0b1229]'
                  }`}
                >
                  <div>
                    <p className="font-display text-sm font-bold text-slate-900 dark:text-white">
                      {r.name}
                    </p>
                    <p className="mt-0.5 font-mono text-[10px] text-slate-500">
                      {r.isSystem ? 'Predeterminado' : 'Personalizado'} · {r.userCount} usuario(s)
                    </p>
                  </div>
                  <span className="rounded-lg bg-slate-200/70 px-2 py-0.5 font-mono text-[10px] dark:bg-white/10">
                    {r.permissions.includes('*') ? 'TOTAL' : `${r.permissions.length} perm`}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Right: Visual Permission Matrix */}
          <div className="lg:col-span-8">
            {selectedRole && (
              <div className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 dark:border-white/10 dark:bg-[#0b1229]">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5 dark:border-white/10">
                  <div className="flex-1 space-y-2">
                    <input
                      type="text"
                      disabled={!canManageRoles || selectedRole.slug === 'superadmin'}
                      value={roleDraftName}
                      onChange={(e) => setRoleDraftName(e.target.value)}
                      className="w-full rounded-xl border border-transparent bg-transparent font-display text-2xl font-bold focus:border-slate-300 focus:bg-slate-50 focus:px-3 focus:outline-none dark:focus:border-white/15 dark:focus:bg-white/5"
                    />
                    <input
                      type="text"
                      disabled={!canManageRoles || selectedRole.slug === 'superadmin'}
                      value={roleDraftDesc}
                      onChange={(e) => setRoleDraftDesc(e.target.value)}
                      className="w-full rounded-lg border border-transparent bg-transparent text-xs text-slate-500 focus:border-slate-300 focus:bg-slate-50 focus:px-3 focus:py-1 focus:outline-none dark:text-slate-400"
                    />
                  </div>

                  {canManageRoles && selectedRole.slug !== 'superadmin' && (
                    <div className="flex items-center gap-2">
                      {!selectedRole.isSystem && (
                        <button
                          type="button"
                          onClick={() => void handleDeleteRole(selectedRole)}
                          className="inline-flex items-center gap-1 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-500"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Eliminar
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={savingRole}
                        onClick={handleSaveRolePermissions}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#0845ff] to-[#029be6] px-4 py-2 text-xs font-semibold text-white shadow-md"
                      >
                        {savingRole ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Save className="h-3.5 w-3.5" />
                        )}
                        Guardar permisos
                      </button>
                    </div>
                  )}
                </div>

                {selectedRole.slug === 'superadmin' ? (
                  <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-5 text-sm text-amber-700 dark:text-amber-200">
                    El rol <strong>Superadministrador</strong> posee control total (`*`) sobre todos
                    los módulos presentes y futuros del sistema y no puede restringirse.
                  </div>
                ) : (
                  <div className="grid gap-5 md:grid-cols-2">
                    {groupedPermissions.map(([groupName, perms]) => (
                      <div
                        key={groupName}
                        className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-white/10 dark:bg-white/[0.02]"
                      >
                        <h4 className="font-mono text-xs font-bold uppercase tracking-wider text-sky-700 dark:text-cyan-400">
                          {groupName}
                        </h4>
                        <div className="mt-3 space-y-2.5">
                          {perms.map((p) => {
                            const checked = roleDraftPerms.includes(p.key);
                            return (
                              <label
                                key={p.key}
                                className="flex cursor-pointer items-start gap-2.5 text-xs"
                              >
                                <input
                                  type="checkbox"
                                  disabled={!canManageRoles}
                                  checked={checked}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setRoleDraftPerms((prev) =>
                                        prev.includes(p.key) ? prev : [...prev, p.key],
                                      );
                                    } else {
                                      setRoleDraftPerms((prev) =>
                                        prev.filter((item) => item !== p.key),
                                      );
                                    }
                                  }}
                                  className="mt-0.5 h-4 w-4 accent-cyan-500"
                                />
                                <span className="leading-snug text-slate-700 dark:text-slate-300">
                                  {p.label}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
      {/* Per-user custom permissions modal */}
      {overrideUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-cyan-400/25 dark:bg-[#0b1229]">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-white/10">
              <div>
                <h3 className="font-display text-lg font-bold">
                  Permisos individuales · @{overrideUser.username}
                </h3>
                <p className="text-xs text-slate-500">
                  Concede permisos extra o revoca permisos específicos sobre su rol ({overrideUser.roleName}).
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOverrideUser(null)}
                className="rounded-lg px-2 py-1 text-xs text-slate-400 hover:bg-white/10"
              >
                Cerrar
              </button>
            </div>

            <div className="space-y-3 overflow-y-auto p-6">
              {permissionsCatalog.map((p) => {
                const isGranted = overrideGrant.includes(p.key);
                const isDenied = overrideDeny.includes(p.key);
                const state = isGranted ? 'grant' : isDenied ? 'deny' : 'inherit';
                return (
                  <div
                    key={p.key}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 p-3 text-xs dark:border-white/10"
                  >
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white">{p.label}</p>
                      <p className="font-mono text-[10px] text-slate-500">{p.key}</p>
                    </div>
                    <select
                      value={state}
                      onChange={(e) => {
                        const v = e.target.value;
                        setOverrideGrant((g) => g.filter((k) => k !== p.key));
                        setOverrideDeny((d) => d.filter((k) => k !== p.key));
                        if (v === 'grant') setOverrideGrant((g) => [...g, p.key]);
                        if (v === 'deny') setOverrideDeny((d) => [...d, p.key]);
                      }}
                      className="rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-1 text-xs font-semibold dark:border-white/15 dark:bg-[#070c1c]"
                    >
                      <option value="inherit">Heredar del rol</option>
                      <option value="grant">Conceder (+)</option>
                      <option value="deny">Denegar (-)</option>
                    </select>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 px-6 py-4 dark:border-white/10">
              <button
                type="button"
                onClick={() => setOverrideUser(null)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold dark:border-white/15"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={savingOverrides}
                onClick={() => void saveOverrides()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#0845ff] to-[#029be6] px-4 py-2 text-xs font-semibold text-white"
              >
                {savingOverrides ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Guardar permisos individuales
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Activity,
  ArrowDown,
  ArrowUp,
  BookOpen,
  Building2,
  Check,
  CheckCircle2,
  Crown,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  FlaskConical,
  Image as ImageIcon,
  KeyRound,
  LayoutGrid,
  Loader2,
  Lock,
  LogOut,
  Mail,
  MenuSquare,
  Moon,
  Plus,
  Save,
  ShieldCheck,
  Sparkles,
  Sun,
  Trash2,
  Upload,
  UserCheck,
  Users,
} from 'lucide-react';
import { useContent, VersionConflictError } from '../context/ContentContext';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import type { NewsArticle, ProjectItem, ResearchLine, SiteContent, ValueItem } from '../data/siteData';
import { ImageField, type GalleryImage } from '../components/admin/ImageField';
import { HeroEditorTab } from '../components/admin/HeroEditorTab';
import { PageBuilderTab } from '../components/admin/PageBuilderTab';
import { MenuPagesTab } from '../components/admin/MenuPagesTab';
import { UsersProfileTab } from '../components/admin/UsersProfileTab';
import { AuditLogTab } from '../components/admin/AuditLogTab';
import { SmtpSettingsCard } from '../components/admin/SmtpSettingsCard';
import { IconPicker } from '../components/admin/IconPicker';
import { formatBytes, uploadAdminImage } from '../utils/imageUpload';
import { apiFetch } from '../utils/apiClient';

type AdminTab =
  | 'menu'
  | 'builder'
  | 'hero'
  | 'news'
  | 'identity'
  | 'research'
  | 'general'
  | 'gallery'
  | 'users'
  | 'audit';

function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

export function AdminPage() {
  const {
    content,
    contentVersion,
    refreshContent,
    saveContentToServer,
    saveDesignToServer,
    saveMenusToServer,
    savePagesToServer,
    saveSettingsToServer,
    saveResearchToServer,
    saveNewsToServer,
  } = useContent();
  const [conflictMsg, setConflictMsg] = useState<string | null>(null);
  const { theme, toggleTheme } = useTheme();
  const {
    authChecked,
    authenticated,
    user,
    env,
    isMaster,
    isSuperAdmin,
    hasPermission,
    setAuthSession,
    logout,
  } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Login + 2FA challenge state
  const [loginUser, setLoginUser] = useState('admin');
  const [loginPass, setLoginPass] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginBanner, setLoginBanner] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);
  const [twoFaChallenge, setTwoFaChallenge] = useState<string | null>(null);
  const [twoFaCode, setTwoFaCode] = useState('');

  // Password recovery state
  const resetTokenParam = searchParams.get('reset_token') || '';
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotIdentifier, setForgotIdentifier] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [forgotSuccess, setForgotSuccess] = useState<string | null>(null);
  const [resetChecking, setResetChecking] = useState(false);
  const [resetValidUser, setResetValidUser] = useState<{ username: string; displayName: string } | null>(null);
  const [resetTokenError, setResetTokenError] = useState<string | null>(null);
  const [resetNewPass, setResetNewPass] = useState('');
  const [resetConfirmPass, setResetConfirmPass] = useState('');
  const [resetSubmitting, setResetSubmitting] = useState(false);

  useEffect(() => {
    if (!resetTokenParam) {
      setResetValidUser(null);
      setResetTokenError(null);
      return;
    }
    let active = true;
    setResetChecking(true);
    setResetTokenError(null);
    fetch(`/api/auth/password-reset/validate?token=${encodeURIComponent(resetTokenParam)}`, {
      cache: 'no-store',
    })
      .then(async (res) => {
        const data = await res.json();
        if (!active) return;
        if (!res.ok) {
          setResetValidUser(null);
          setResetTokenError(
            data.error || 'El enlace de recuperación es inválido, ya fue utilizado o ha expirado.',
          );
          return;
        }
        setResetValidUser({ username: data.username, displayName: data.displayName });
        setLoginUser(data.username);
      })
      .catch(() => {
        if (active) setResetTokenError('Error de conexión validando el enlace de recuperación.');
      })
      .finally(() => {
        if (active) setResetChecking(false);
      });
    return () => {
      active = false;
    };
  }, [resetTokenParam]);

  // Forced password change state
  const [forceCurPass, setForceCurPass] = useState('');
  const [forceNewPass, setForceNewPass] = useState('');
  const [forceConfirmPass, setForceConfirmPass] = useState('');
  const [forceSaving, setForceSaving] = useState(false);
  const [forceError, setForceError] = useState<string | null>(null);

  // Audit filter
  const [auditActorFilter, setAuditActorFilter] = useState('');

  // Dashboard state
  const ALL_SIDEBAR_ITEMS: Array<{
    id: AdminTab;
    label: string;
    icon: typeof FileText;
    allowed: boolean;
  }> = [
    { id: 'menu', label: 'Menú y Páginas', icon: MenuSquare, allowed: hasPermission(['site.menus', 'site.pages']) },
    { id: 'builder', label: 'Constructor / Lienzo', icon: LayoutGrid, allowed: hasPermission('site.design') },
    { id: 'hero', label: 'Portada (Hero)', icon: Sparkles, allowed: hasPermission('site.design') },
    {
      id: 'news',
      label: 'Publicaciones / Noticias',
      icon: FileText,
      allowed: hasPermission(['content.create', 'content.edit_own', 'content.edit_any', 'content.publish']),
    },
    { id: 'identity', label: 'Nosotros e Imágenes', icon: BookOpen, allowed: hasPermission(['site.design', 'site.pages']) },
    {
      id: 'research',
      label: 'Investigación y Proyectos',
      icon: FlaskConical,
      allowed: hasPermission(['research.manage', 'research.collaborate']),
    },
    { id: 'general', label: 'Contacto y General', icon: Building2, allowed: hasPermission('site.settings') },
    { id: 'gallery', label: 'Galería de Imágenes', icon: ImageIcon, allowed: hasPermission(['media.upload', 'media.delete']) },
    { id: 'users', label: 'Perfil, Usuarios y Roles', icon: Users, allowed: true },
    { id: 'audit', label: 'Registro de Auditoría', icon: Activity, allowed: hasPermission('audit.view') },
  ];

  const sidebarItems = ALL_SIDEBAR_ITEMS.filter((item) => item.allowed);
  const allowedTabs = sidebarItems.map((i) => i.id);
  const tabParam = searchParams.get('tab') as AdminTab | null;
  const [tab, setTab] = useState<AdminTab>(
    tabParam && allowedTabs.includes(tabParam) ? tabParam : allowedTabs[0] || 'users',
  );
  const initialBlockId = searchParams.get('block') || undefined;

  const [draft, setDraft] = useState<SiteContent>(content);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [selectedNewsIdx, setSelectedNewsIdx] = useState<number>(0);

  // Gallery upload
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const [galleryUploading, setGalleryUploading] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  // Keep active tab valid for user permissions
  useEffect(() => {
    if (tabParam && allowedTabs.includes(tabParam)) {
      setTab(tabParam);
    } else if (allowedTabs.length > 0 && !allowedTabs.includes(tab)) {
      setTab(allowedTabs[0]);
    }
  }, [tabParam, allowedTabs.join(','), tab]);

  const selectTab = (nextTab: AdminTab) => {
    setTab(nextTab);
    setSearchParams({ tab: nextTab }, { replace: true });
  };

  const showToast = useCallback((type: 'success' | 'error', text: string) => {
    setToast({ type, text });
    window.setTimeout(() => {
      setToast((prev) => (prev?.text === text ? null : prev));
    }, 4000);
  }, []);

  const loadImages = useCallback(async () => {
    try {
      const res = await fetch('/api/images', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setImages(data.images || []);
      }
    } catch {
      // Ignore network error
    }
  }, []);

  // Sync draft when content loads initially (if not dirty)
  useEffect(() => {
    if (!dirty) {
      setDraft(content);
    }
  }, [content, dirty]);

  // Load images once authenticated
  useEffect(() => {
    if (authenticated) {
      void loadImages();
    }
  }, [authenticated, loadImages]);

  const updateDraft = (updater: (prev: SiteContent) => SiteContent) => {
    setDraft((prev) => updater(prev));
    setDirty(true);
  };

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoginLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUser, password: loginPass }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLoginError(data.error || 'No se pudo iniciar sesión.');
        return;
      }
      if (data.requires2FA && data.challengeToken) {
        setTwoFaChallenge(data.challengeToken);
        setLoginPass('');
        return;
      }
      setAuthSession(data.user, data.csrfToken);
      setLoginPass('');
      await refreshContent();
      await loadImages();
    } catch {
      setLoginError(
        'No se detectó el servidor CMS (/api). Ejecuta el sitio con "npm run dev" o "npm start".',
      );
    } finally {
      setLoginLoading(false);
    }
  };

  const handleVerify2FA = async (e: FormEvent) => {
    e.preventDefault();
    if (!twoFaChallenge) return;
    setLoginError(null);
    setLoginLoading(true);
    try {
      const res = await fetch('/api/auth/login-2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challengeToken: twoFaChallenge, code: twoFaCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLoginError(data.error || 'Código 2FA incorrecto.');
        return;
      }
      setTwoFaChallenge(null);
      setTwoFaCode('');
      setAuthSession(data.user, data.csrfToken);
      await refreshContent();
      await loadImages();
    } catch {
      setLoginError('Error de conexión verificando 2FA.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleRequestPasswordReset = async (e: FormEvent) => {
    e.preventDefault();
    setForgotError(null);
    setForgotSuccess(null);
    setForgotLoading(true);
    try {
      const res = await fetch('/api/auth/password-reset/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: forgotIdentifier.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setForgotError(
          data.error ||
            'Tu correo no está verificado en ningún perfil, por favor contacta a soporte técnico para asistencia.',
        );
        return;
      }
      setForgotSuccess(data.message || 'Se enviaron las instrucciones de recuperación a tu correo.');
    } catch {
      setForgotError('Error de conexión con el servidor CMS.');
    } finally {
      setForgotLoading(false);
    }
  };

  const clearResetTokenFromUrl = () => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('reset_token');
    setSearchParams(nextParams, { replace: true });
    setResetValidUser(null);
    setResetTokenError(null);
    setResetNewPass('');
    setResetConfirmPass('');
  };

  const handleConfirmPasswordReset = async (e: FormEvent) => {
    e.preventDefault();
    setResetTokenError(null);
    if (resetNewPass.length < 10) {
      setResetTokenError('La contraseña debe tener al menos 10 caracteres.');
      return;
    }
    if (resetNewPass !== resetConfirmPass) {
      setResetTokenError('Las contraseñas nuevas no coinciden.');
      return;
    }
    setResetSubmitting(true);
    try {
      const res = await fetch('/api/auth/password-reset/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: resetTokenParam, newPassword: resetNewPass }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResetTokenError(data.error || 'No se pudo restablecer la contraseña.');
        return;
      }
      clearResetTokenFromUrl();
      setForgotMode(false);
      setLoginError(null);
      setLoginBanner(data.message || 'Contraseña restablecida correctamente. Ya puedes iniciar sesión.');
    } catch {
      setResetTokenError('Error de conexión restableciendo la contraseña.');
    } finally {
      setResetSubmitting(false);
    }
  };

  const handleForcedPasswordChange = async (e: FormEvent) => {
    e.preventDefault();
    setForceError(null);
    if (forceNewPass !== forceConfirmPass) {
      setForceError('Las contraseñas nuevas no coinciden.');
      return;
    }
    setForceSaving(true);
    try {
      const res = await apiFetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: forceCurPass, newPassword: forceNewPass }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo cambiar la contraseña.');
      setAuthSession(data.user);
      setForceCurPass('');
      setForceNewPass('');
      setForceConfirmPass('');
      showToast('success', 'Contraseña actualizada. Bienvenido.');
    } catch (err) {
      setForceError(err instanceof Error ? err.message : 'Error al cambiar contraseña.');
    } finally {
      setForceSaving(false);
    }
  };

  const handleSaveAll = async () => {
    setSaving(true);
    setConflictMsg(null);
    try {
      let currentVer = contentVersion;
      const savedSections: string[] = [];

      const designChanged =
        JSON.stringify(draft.hero) !== JSON.stringify(content.hero) ||
        JSON.stringify(draft.homeSections) !== JSON.stringify(content.homeSections) ||
        JSON.stringify(draft.customBlocks) !== JSON.stringify(content.customBlocks) ||
        JSON.stringify(draft.siteInfo.images) !== JSON.stringify(content.siteInfo.images);

      const menusChanged = JSON.stringify(draft.navItems) !== JSON.stringify(content.navItems);

      const pagesChanged =
        JSON.stringify(draft.customPages) !== JSON.stringify(content.customPages) ||
        JSON.stringify(draft.labIdentity) !== JSON.stringify(content.labIdentity);

      const stripImgs = (s: SiteContent['siteInfo']) => ({ ...s, images: undefined });
      const settingsChanged =
        JSON.stringify(stripImgs(draft.siteInfo)) !== JSON.stringify(stripImgs(content.siteInfo));

      const researchChanged =
        JSON.stringify(draft.researchLines) !== JSON.stringify(content.researchLines) ||
        JSON.stringify(draft.projects) !== JSON.stringify(content.projects);

      const newsChanged =
        JSON.stringify(draft.newsArticles) !== JSON.stringify(content.newsArticles);

      if (designChanged) {
        if (!hasPermission('site.design')) {
          throw new Error('No tienes permiso (site.design) para guardar cambios de diseño.');
        }
        currentVer = await saveDesignToServer(
          {
            hero: draft.hero,
            homeSections: draft.homeSections,
            customBlocks: draft.customBlocks,
            images: draft.siteInfo.images,
          },
          currentVer,
        );
        savedSections.push('Diseño');
      }

      if (menusChanged) {
        if (!hasPermission('site.menus')) {
          throw new Error('No tienes permiso (site.menus) para guardar cambios en el menú.');
        }
        currentVer = await saveMenusToServer(draft.navItems, currentVer);
        savedSections.push('Menús');
      }

      if (pagesChanged) {
        if (!hasPermission('site.pages')) {
          throw new Error('No tienes permiso (site.pages) para guardar cambios en páginas.');
        }
        currentVer = await savePagesToServer(
          { customPages: draft.customPages, labIdentity: draft.labIdentity },
          currentVer,
        );
        savedSections.push('Páginas');
      }

      if (settingsChanged) {
        if (!hasPermission('site.settings')) {
          throw new Error('No tienes permiso (site.settings) para guardar configuración general.');
        }
        currentVer = await saveSettingsToServer(draft.siteInfo, currentVer);
        savedSections.push('Configuración');
      }

      if (researchChanged) {
        if (!hasPermission(['research.manage', 'research.collaborate'])) {
          throw new Error('No tienes permiso para guardar cambios en Investigación y Proyectos.');
        }
        currentVer = await saveResearchToServer(
          {
            researchLines: hasPermission('research.manage') ? draft.researchLines : undefined,
            projects: draft.projects,
          },
          currentVer,
        );
        savedSections.push('Investigación');
      }

      if (newsChanged) {
        if (
          !hasPermission([
            'content.create',
            'content.edit_own',
            'content.edit_any',
            'content.publish',
            'content.delete',
          ])
        ) {
          throw new Error('No tienes permiso para guardar cambios en Publicaciones.');
        }
        currentVer = await saveNewsToServer(draft.newsArticles, currentVer);
        savedSections.push('Publicaciones');
      }

      setDirty(false);
      showToast(
        'success',
        savedSections.length > 0
          ? `Guardado correctamente (${savedSections.join(', ')}) · v${currentVer}.`
          : 'Sin cambios pendientes.',
      );
    } catch (err) {
      if (err instanceof VersionConflictError) {
        setConflictMsg(err.message);
      }
      showToast('error', err instanceof Error ? err.message : 'Error al guardar.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveImmediate = async (next: SiteContent, msg: string) => {
    setSaving(true);
    setConflictMsg(null);
    try {
      await saveContentToServer(next, contentVersion);
      setDraft(next);
      setDirty(false);
      showToast('success', msg);
    } catch (err) {
      if (err instanceof VersionConflictError) {
        setConflictMsg(err.message);
      }
      showToast('error', err instanceof Error ? err.message : 'Error al guardar.');
    } finally {
      setSaving(false);
    }
  };

  const handleGalleryUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setGalleryUploading(true);
    let uploadedCount = 0;
    let lastSummary = '';

    try {
      for (const file of files) {
        const result = await uploadAdminImage(file);
        setImages((prev) => [result.image, ...prev]);
        uploadedCount += 1;
        if (result.optimized) {
          lastSummary = ` (${formatBytes(result.originalBytes)} → ${formatBytes(result.finalBytes)})`;
        }
      }
      showToast(
        'success',
        uploadedCount === 1
          ? `Imagen subida y optimizada${lastSummary}.`
          : `${uploadedCount} imágenes subidas y optimizadas correctamente.`,
      );
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Error al subir imágenes.');
    } finally {
      setGalleryUploading(false);
      if (galleryInputRef.current) galleryInputRef.current.value = '';
    }
  };

  const handleDeleteImage = async (img: GalleryImage) => {
    if (!window.confirm(`¿Eliminar definitivamente la imagen "${img.name}"?`)) return;
    try {
      const res = await apiFetch('/api/images', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: img.url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo eliminar.');
      setImages((prev) => prev.filter((item) => item.url !== img.url));
      showToast('success', 'Imagen eliminada.');
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Error al eliminar imagen.');
    }
  };

  // News helpers
  const addNewsArticle = () => {
    const now = new Date();
    const monthNames = [
      'Enero',
      'Febrero',
      'Marzo',
      'Abril',
      'Mayo',
      'Junio',
      'Julio',
      'Agosto',
      'Septiembre',
      'Octubre',
      'Noviembre',
      'Diciembre',
    ];
    const dateLabel = `${monthNames[now.getMonth()]} ${now.getFullYear()}`;
    const newArticle: NewsArticle = {
      slug: `nueva-nota-${Date.now().toString().slice(-5)}`,
      title: 'Nueva publicación del LIAA',
      date: dateLabel,
      category: 'Institucional',
      author: user?.displayName || 'Equipo LIAA',
      authorId: user?.id,
      status: hasPermission('content.publish') ? 'published' : 'draft',
      image: draft.siteInfo.images.pitecBuilding,
      excerpt: 'Escribe aquí un breve resumen de la nota para la vista previa.',
      content: ['Escribe aquí el primer párrafo completo de la publicación.'],
    };
    updateDraft((prev) => ({
      ...prev,
      newsArticles: [newArticle, ...prev.newsArticles],
    }));
    setSelectedNewsIdx(0);
  };

  const updateNewsAt = (index: number, patch: Partial<NewsArticle>) => {
    updateDraft((prev) => ({
      ...prev,
      newsArticles: prev.newsArticles.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    }));
  };

  const moveNews = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= draft.newsArticles.length) return;
    updateDraft((prev) => {
      const next = [...prev.newsArticles];
      const [moved] = next.splice(index, 1);
      next.splice(target, 0, moved);
      return { ...prev, newsArticles: next };
    });
    setSelectedNewsIdx(target);
  };

  const deleteNewsAt = (index: number) => {
    const target = draft.newsArticles[index];
    if (!window.confirm(`¿Eliminar la nota "${target.title}"?`)) return;
    updateDraft((prev) => ({
      ...prev,
      newsArticles: prev.newsArticles.filter((_, i) => i !== index),
    }));
    setSelectedNewsIdx((prev) => Math.max(0, prev - 1));
  };

  if (!authChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-[#050814]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600 dark:text-cyan-400" />
      </div>
    );
  }

  // LOGIN SCREEN
  if (!authenticated || !user) {
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-slate-100 px-4 py-12 dark:bg-[#050814]">
        <div className="bg-tech-grid pointer-events-none absolute inset-0 opacity-60" />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-1/4 h-80 w-80 rounded-full bg-cyan-500/20 blur-3xl"
        />

        <div className="relative w-full max-w-md rounded-3xl border border-slate-200 bg-white/95 p-8 shadow-2xl backdrop-blur-xl dark:border-cyan-400/25 dark:bg-[#0b1229]/95">
          <div className="flex flex-col items-center text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-200 bg-white p-2 shadow-md dark:border-cyan-400/30 dark:bg-slate-950">
              <img
                src={content.siteInfo.images.emblem}
                alt="Emblema LIAA"
                className="h-full w-full object-contain"
              />
            </div>
            <span className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-sky-500/25 bg-sky-500/10 px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-widest text-sky-700 dark:border-cyan-400/25 dark:bg-cyan-400/10 dark:text-cyan-300">
              <Lock className="h-3 w-3" />
              Acceso LIAA Studio
            </span>
            <h1 className="mt-3 font-display text-2xl font-bold text-slate-900 dark:text-white">
              {resetTokenParam
                ? 'Restablecer Contraseña'
                : twoFaChallenge
                  ? 'Verificación 2FA'
                  : forgotMode
                    ? 'Recuperar Contraseña'
                    : 'Iniciar Sesión'}
            </h1>
            <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
              {resetTokenParam
                ? resetValidUser
                  ? `Define una nueva contraseña para @${resetValidUser.username}.`
                  : 'Validando tu enlace de recuperación...'
                : twoFaChallenge
                  ? 'Ingresa el código de 6 dígitos de tu app autenticadora.'
                  : forgotMode
                    ? 'Ingresa tu usuario o el correo electrónico guardado en tu perfil.'
                    : 'Ingresa con tu cuenta autorizada del LIAA.'}
            </p>
          </div>

          {resetTokenParam ? (
            <div className="mt-8 space-y-4">
              {resetChecking ? (
                <div className="flex flex-col items-center gap-3 py-6 text-slate-500 dark:text-slate-400">
                  <Loader2 className="h-7 w-7 animate-spin text-blue-600 dark:text-cyan-400" />
                  <p className="text-xs">Verificando validez del enlace...</p>
                </div>
              ) : resetValidUser ? (
                <form onSubmit={handleConfirmPasswordReset} className="space-y-4">
                  <div>
                    <label
                      htmlFor="reset-new-pass"
                      className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300"
                    >
                      Nueva contraseña
                    </label>
                    <input
                      id="reset-new-pass"
                      type="password"
                      required
                      minLength={10}
                      autoComplete="new-password"
                      value={resetNewPass}
                      onChange={(e) => setResetNewPass(e.target.value)}
                      placeholder="Mínimo 10 caracteres"
                      className="mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none dark:border-white/15 dark:bg-white/5 dark:text-white dark:focus:border-cyan-400 dark:focus:bg-[#0f1936]"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="reset-confirm-pass"
                      className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300"
                    >
                      Confirmar nueva contraseña
                    </label>
                    <input
                      id="reset-confirm-pass"
                      type="password"
                      required
                      minLength={10}
                      autoComplete="new-password"
                      value={resetConfirmPass}
                      onChange={(e) => setResetConfirmPass(e.target.value)}
                      placeholder="Repite tu nueva contraseña"
                      className="mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none dark:border-white/15 dark:bg-white/5 dark:text-white dark:focus:border-cyan-400 dark:focus:bg-[#0f1936]"
                    />
                  </div>

                  {resetTokenError && (
                    <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs font-medium text-rose-600 dark:text-rose-300">
                      {resetTokenError}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={resetSubmitting}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#0845ff] to-[#029be6] px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition hover:brightness-110 disabled:opacity-60"
                  >
                    {resetSubmitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <KeyRound className="h-4 w-4" />
                    )}
                    {resetSubmitting ? 'Guardando...' : 'Guardar nueva contraseña'}
                  </button>
                </form>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs font-medium text-rose-600 dark:text-rose-300">
                    {resetTokenError || 'El enlace de recuperación no es válido o ya expiró.'}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      clearResetTokenFromUrl();
                      setForgotMode(true);
                    }}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#0845ff] to-[#029be6] px-5 py-3 text-sm font-semibold text-white"
                  >
                    Solicitar un nuevo enlace
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={clearResetTokenFromUrl}
                className="w-full text-center text-xs text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-cyan-400"
              >
                ← Volver al inicio de sesión
              </button>
            </div>
          ) : twoFaChallenge ? (
            <form onSubmit={handleVerify2FA} className="mt-8 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Código de 6 dígitos (TOTP)
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  inputMode="numeric"
                  maxLength={6}
                  value={twoFaCode}
                  onChange={(e) => setTwoFaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  className="mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-center font-mono text-xl tracking-[0.4em] text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none dark:border-white/15 dark:bg-white/5 dark:text-white dark:focus:border-cyan-400 dark:focus:bg-[#0f1936]"
                />
              </div>

              {loginError && (
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs font-medium text-rose-600 dark:text-rose-300">
                  {loginError}
                </div>
              )}

              <button
                type="submit"
                disabled={loginLoading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#0845ff] to-[#029be6] px-5 py-3.5 text-sm font-semibold text-white shadow-lg"
              >
                {loginLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                Verificar código
              </button>

              <button
                type="button"
                onClick={() => {
                  setTwoFaChallenge(null);
                  setTwoFaCode('');
                  setLoginError(null);
                }}
                className="w-full text-center text-xs text-slate-500 hover:text-cyan-400"
              >
                ← Volver a usuario y contraseña
              </button>
            </form>
          ) : forgotMode ? (
            <form onSubmit={handleRequestPasswordReset} className="mt-8 space-y-4">
              <div>
                <label
                  htmlFor="forgot-identifier"
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300"
                >
                  Usuario o correo electrónico
                </label>
                <input
                  id="forgot-identifier"
                  type="text"
                  required
                  autoFocus
                  value={forgotIdentifier}
                  onChange={(e) => setForgotIdentifier(e.target.value)}
                  placeholder="usuario o nombre@uaz.edu.mx"
                  className="mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none dark:border-white/15 dark:bg-white/5 dark:text-white dark:focus:border-cyan-400 dark:focus:bg-[#0f1936]"
                />
              </div>

              {forgotError && (
                <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-xs font-medium leading-relaxed text-amber-800 dark:text-amber-200">
                  {forgotError}
                </div>
              )}

              {forgotSuccess && (
                <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-xs font-medium leading-relaxed text-emerald-700 dark:text-emerald-300">
                  {forgotSuccess}
                </div>
              )}

              <button
                type="submit"
                disabled={forgotLoading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#0845ff] to-[#029be6] px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition hover:brightness-110 disabled:opacity-60"
              >
                {forgotLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Mail className="h-4 w-4" />
                )}
                {forgotLoading ? 'Verificando perfil...' : 'Enviar enlace de recuperación'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setForgotMode(false);
                  setForgotError(null);
                  setForgotSuccess(null);
                }}
                className="w-full text-center text-xs text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-cyan-400"
              >
                ← Volver al inicio de sesión
              </button>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="mt-8 space-y-4">
              {loginBanner && (
                <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                  {loginBanner}
                </div>
              )}

              <div>
                <label
                  htmlFor="admin-user"
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300"
                >
                  Usuario
                </label>
                <input
                  id="admin-user"
                  type="text"
                  autoComplete="username"
                  required
                  value={loginUser}
                  onChange={(e) => setLoginUser(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none dark:border-white/15 dark:bg-white/5 dark:text-white dark:focus:border-cyan-400 dark:focus:bg-[#0f1936]"
                />
              </div>

              <div>
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor="admin-pass"
                    className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300"
                  >
                    Contraseña
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setForgotMode(true);
                      setForgotIdentifier(loginUser || '');
                      setForgotError(null);
                      setForgotSuccess(null);
                      setLoginError(null);
                      setLoginBanner(null);
                    }}
                    className="text-xs font-medium text-blue-600 hover:underline dark:text-cyan-400"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>
                <div className="relative mt-1.5">
                  <input
                    id="admin-pass"
                    type={showPass ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={loginPass}
                    onChange={(e) => setLoginPass(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 py-3 pl-4 pr-11 text-sm text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none dark:border-white/15 dark:bg-white/5 dark:text-white dark:focus:border-cyan-400 dark:focus:bg-[#0f1936]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((v) => !v)}
                    aria-label="Mostrar u ocultar contraseña"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                  >
                    {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {loginError && (
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs font-medium text-rose-600 dark:text-rose-300">
                  {loginError}
                </div>
              )}

              <button
                type="submit"
                disabled={loginLoading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#0845ff] to-[#029be6] px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition hover:brightness-110 disabled:opacity-60"
              >
                {loginLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Lock className="h-4 w-4" />
                )}
                {loginLoading ? 'Verificando...' : 'Entrar al Panel'}
              </button>
            </form>
          )}

          <div className="mt-6 text-center">
            <Link
              to="/"
              className="text-xs font-medium text-slate-500 transition hover:text-blue-600 dark:text-slate-400 dark:hover:text-cyan-300"
            >
              ← Volver al sitio público del LIAA
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // FORCED PASSWORD CHANGE GATE
  if (user.mustChangePassword) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 dark:bg-[#050814]">
        <div className="w-full max-w-md rounded-3xl border border-amber-400/30 bg-white p-8 shadow-2xl dark:bg-[#0b1229]">
          <div className="flex items-center gap-3">
            <KeyRound className="h-6 w-6 text-amber-500" />
            <h1 className="font-display text-xl font-bold">Cambio obligatorio de contraseña</h1>
          </div>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Por seguridad, debes establecer una contraseña personal antes de ingresar al panel.
          </p>
          <form onSubmit={handleForcedPasswordChange} className="mt-6 space-y-4">
            <input
              type="password"
              required
              value={forceCurPass}
              onChange={(e) => setForceCurPass(e.target.value)}
              placeholder="Contraseña temporal actual"
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none dark:border-white/15 dark:bg-white/5 dark:text-white dark:focus:border-cyan-400 dark:focus:bg-[#0f1936]"
            />
            <input
              type="password"
              required
              minLength={10}
              value={forceNewPass}
              onChange={(e) => setForceNewPass(e.target.value)}
              placeholder="Nueva contraseña (mín. 10 caracteres)"
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none dark:border-white/15 dark:bg-white/5 dark:text-white dark:focus:border-cyan-400 dark:focus:bg-[#0f1936]"
            />
            <input
              type="password"
              required
              value={forceConfirmPass}
              onChange={(e) => setForceConfirmPass(e.target.value)}
              placeholder="Confirmar nueva contraseña"
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none dark:border-white/15 dark:bg-white/5 dark:text-white dark:focus:border-cyan-400 dark:focus:bg-[#0f1936]"
            />
            {forceError && <p className="text-xs text-rose-500">{forceError}</p>}
            <button
              type="submit"
              disabled={forceSaving}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#0845ff] to-[#029be6] px-5 py-3 text-sm font-semibold text-white"
            >
              {forceSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Guardar nueva contraseña y entrar
            </button>
          </form>
        </div>
      </div>
    );
  }

  const activeArticle = draft.newsArticles[selectedNewsIdx];
  const envBadge = env === 'production' ? 'PRODUCCIÓN' : env === 'staging' ? 'PRUEBAS' : 'DESARROLLO';

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 dark:bg-[#050814] dark:text-slate-100">
      {/* Top Studio Header */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur-xl dark:border-cyan-500/15 dark:bg-[#080e21]/90">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white p-1 dark:border-cyan-400/25 dark:bg-slate-950">
              <img
                src={draft.siteInfo.images.emblem}
                alt="LIAA"
                className="h-full w-full object-contain"
              />
            </div>
            <div>
              <p className="font-display text-base font-bold text-slate-900 dark:text-white">
                LIAA Studio
              </p>
              <p className="font-mono text-[10px] uppercase tracking-wider text-slate-500 dark:text-cyan-400">
                {user.roleName} · <span className="text-amber-500 dark:text-amber-300">{envBadge}</span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {dirty && (
              <span className="rounded-full bg-amber-500/15 px-3 py-1 font-mono text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                Cambios sin guardar
              </span>
            )}

            <button
              type="button"
              onClick={handleSaveAll}
              disabled={saving || !dirty}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#0845ff] to-[#029be6] px-4 py-2 text-xs font-semibold text-white shadow-md shadow-blue-600/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>

            <Link
              to="/"
              className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-3.5 py-2 text-xs font-semibold text-sky-700 transition hover:bg-cyan-500/20 dark:text-cyan-300"
            >
              <Eye className="h-3.5 w-3.5" />
              Ver Sitio Web
            </Link>

            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Cambiar tema"
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-700 dark:border-white/15 dark:bg-white/5 dark:text-slate-200"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            {/* Always visible profile pill */}
            <button
              type="button"
              onClick={() => selectTab('users')}
              className="flex items-center gap-2 rounded-full border border-slate-300 bg-slate-50 py-1 pl-1 pr-3 transition hover:border-cyan-400 dark:border-white/15 dark:bg-white/5"
              title="Ver mi perfil"
            >
              <img
                src={user.avatar || '/images/liaa-emblem.png'}
                alt={user.displayName}
                className="h-7 w-7 rounded-full border border-cyan-400/40 bg-slate-900 object-cover"
              />
              <span className="hidden text-xs font-semibold sm:inline">{user.displayName}</span>
            </button>

            <button
              type="button"
              onClick={() => void logout()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-500/20 dark:text-rose-300"
            >
              <LogOut className="h-3.5 w-3.5" />
              Salir
            </button>
          </div>
        </div>
      </header>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50">
          <div
            className={`flex items-center gap-2.5 rounded-2xl border px-4 py-3 text-sm font-medium shadow-xl backdrop-blur ${
              toast.type === 'success'
                ? 'border-emerald-500/40 bg-emerald-950/90 text-emerald-200'
                : 'border-rose-500/40 bg-rose-950/90 text-rose-200'
            }`}
          >
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{toast.text}</span>
          </div>
        </div>
      )}

      {/* Conflict Banner */}
      {conflictMsg && (
        <div className="border-b border-amber-500/40 bg-amber-950/90 px-4 py-3 text-xs text-amber-100">
          <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3">
            <span>{conflictMsg}</span>
            <button
              type="button"
              onClick={async () => {
                setConflictMsg(null);
                setDirty(false);
                await refreshContent();
                showToast('success', 'Contenido recargado con la versión más reciente.');
              }}
              className="rounded-lg bg-amber-400 px-3 py-1.5 font-semibold text-slate-950 hover:bg-amber-300"
            >
              Recargar versión más reciente
            </button>
          </div>
        </div>
      )}

      {/* Studio Body: Left Sidebar + Workspace */}
      <div className="mx-auto grid max-w-[1440px] gap-6 px-4 py-6 sm:px-6 lg:grid-cols-12">
        {/* Sidebar */}
        <aside className="lg:col-span-3 xl:col-span-2">
          <div className="sticky top-20 space-y-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#0b1229]">
            {/* Profile card inside sidebar */}
            <div className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-3 dark:border-white/10 dark:bg-white/[0.03]">
              <img
                src={user.avatar || '/images/liaa-emblem.png'}
                alt={user.displayName}
                className="h-11 w-11 shrink-0 rounded-full border-2 border-cyan-400/50 bg-slate-900 object-cover"
              />
              <div className="min-w-0">
                <p className="truncate text-xs font-bold text-slate-900 dark:text-white">
                  {user.displayName}
                </p>
                <span
                  className={`mt-0.5 inline-flex items-center gap-1 font-mono text-[10px] font-semibold uppercase ${
                    isSuperAdmin ? 'text-amber-600 dark:text-amber-300' : 'text-cyan-700 dark:text-cyan-300'
                  }`}
                >
                  {isSuperAdmin ? <Crown className="h-3 w-3" /> : <UserCheck className="h-3 w-3" />}
                  {user.roleName}
                </span>
              </div>
            </div>

            <nav className="flex flex-wrap gap-1.5 lg:flex-col">
              {sidebarItems.map((item) => {
                const Icon = item.icon;
                const active = tab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => selectTab(item.id)}
                    className={`flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-left text-xs font-semibold transition lg:w-full ${
                      active
                        ? 'bg-gradient-to-r from-[#0845ff] to-[#029be6] text-white shadow-sm'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>

            {!isMaster && (
              <div className="rounded-2xl border border-cyan-500/25 bg-cyan-500/10 p-3 text-[11px] leading-relaxed text-sky-700 dark:text-cyan-300">
                Tu rol activo es <strong>{user.roleName}</strong>. Solo ves los módulos autorizados
                para tus permisos.
              </div>
            )}
          </div>
        </aside>

        {/* Main Workspace */}
        <main className="min-w-0 lg:col-span-9 xl:col-span-10">
          {/* TAB: MENU & AUTO PAGES */}
          {tab === 'menu' && hasPermission(['site.menus', 'site.pages']) && (
            <MenuPagesTab
              draft={draft}
              updateDraft={updateDraft}
              onSaveImmediate={handleSaveImmediate}
            />
          )}

          {/* TAB: HERO */}
          {tab === 'hero' && hasPermission('site.design') && (
            <HeroEditorTab
              hero={draft.hero}
              onChange={(nextHero) => updateDraft((p) => ({ ...p, hero: nextHero }))}
              images={images}
              onUploaded={(img) => setImages((prev) => [img, ...prev])}
            />
          )}

          {/* TAB: PAGE BUILDER */}
          {tab === 'builder' && hasPermission('site.design') && (
            <PageBuilderTab
              draft={draft}
              updateDraft={updateDraft}
              images={images}
              onUploaded={(img) => setImages((prev) => [img, ...prev])}
              initialBlockId={initialBlockId}
            />
          )}

          {/* TAB: NEWS (MASTER + ADJUNTO) */}
          {tab === 'news' && (
            <div className="grid gap-8 lg:grid-cols-12">
              <div className="space-y-3 lg:col-span-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-lg font-bold">
                    Publicaciones ({draft.newsArticles.length})
                  </h2>
                  <button
                    type="button"
                    onClick={addNewsArticle}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-700 dark:bg-cyan-500 dark:text-slate-950"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Nueva nota
                  </button>
                </div>

                <div className="space-y-2.5">
                  {draft.newsArticles.map((art, idx) => (
                    <div
                      key={`${art.slug}-${idx}`}
                      onClick={() => setSelectedNewsIdx(idx)}
                      className={`cursor-pointer rounded-2xl border p-4 transition ${
                        idx === selectedNewsIdx
                          ? 'border-blue-600 bg-blue-50/70 dark:border-cyan-400 dark:bg-cyan-400/10'
                          : 'border-slate-200 bg-white hover:border-sky-400 dark:border-white/10 dark:bg-[#0b1229]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-mono text-[10px] uppercase tracking-wider text-sky-700 dark:text-cyan-400">
                          {art.category} · {art.date}
                        </span>
                        <div
                          className="flex items-center gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => moveNews(idx, -1)}
                            disabled={idx === 0}
                            className="rounded p-1 text-slate-400 hover:text-slate-800 disabled:opacity-30 dark:hover:text-white"
                          >
                            <ArrowUp className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveNews(idx, 1)}
                            disabled={idx === draft.newsArticles.length - 1}
                            className="rounded p-1 text-slate-400 hover:text-slate-800 disabled:opacity-30 dark:hover:text-white"
                          >
                            <ArrowDown className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteNewsAt(idx)}
                            className="rounded p-1 text-rose-400 hover:text-rose-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                      <p className="mt-1.5 line-clamp-2 font-display text-sm font-bold text-slate-900 dark:text-white">
                        {art.title}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="lg:col-span-8">
                {activeArticle ? (
                  <div className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 dark:border-white/10 dark:bg-[#0b1229]">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4 dark:border-white/10">
                      <h3 className="font-display text-xl font-bold">Editar publicación</h3>
                      <Link
                        to={`/noticias/${activeArticle.slug}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline dark:text-cyan-300"
                      >
                        Ver en el sitio
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                          Título de la nota
                        </label>
                        <input
                          type="text"
                          value={activeArticle.title}
                          onChange={(e) => {
                            const title = e.target.value;
                            updateNewsAt(selectedNewsIdx, {
                              title,
                              slug: slugify(title) || activeArticle.slug,
                            });
                          }}
                          className="mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm dark:border-white/15 dark:bg-white/5 dark:text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                          URL amigable (slug)
                        </label>
                        <input
                          type="text"
                          value={activeArticle.slug}
                          onChange={(e) =>
                            updateNewsAt(selectedNewsIdx, { slug: slugify(e.target.value) })
                          }
                          className="mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 font-mono text-xs dark:border-white/15 dark:bg-white/5 dark:text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                          Estado de publicación
                        </label>
                        <select
                          value={activeArticle.status || 'published'}
                          onChange={(e) =>
                            updateNewsAt(selectedNewsIdx, {
                              status: e.target.value as NewsArticle['status'],
                            })
                          }
                          className="mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm dark:border-white/15 dark:bg-[#070c1c] dark:text-white"
                        >
                          <option value="draft">Borrador (privado)</option>
                          <option value="review">En revisión</option>
                          <option value="published" disabled={!hasPermission('content.publish')}>
                            Publicado {hasPermission('content.publish') ? '' : '(sin permiso)'}
                          </option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                          Categoría
                        </label>
                        <select
                          value={activeArticle.category}
                          onChange={(e) =>
                            updateNewsAt(selectedNewsIdx, {
                              category: e.target.value as NewsArticle['category'],
                            })
                          }
                          className="mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm dark:border-white/15 dark:bg-[#070c1c] dark:text-white"
                        >
                          <option value="Institucional">Institucional</option>
                          <option value="Investigación">Investigación</option>
                          <option value="Eventos">Eventos</option>
                          <option value="Convocatorias">Convocatorias</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                          Fecha visible
                        </label>
                        <input
                          type="text"
                          value={activeArticle.date}
                          onChange={(e) => updateNewsAt(selectedNewsIdx, { date: e.target.value })}
                          className="mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm dark:border-white/15 dark:bg-white/5 dark:text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                          Autor
                        </label>
                        <input
                          type="text"
                          value={activeArticle.author}
                          onChange={(e) =>
                            updateNewsAt(selectedNewsIdx, { author: e.target.value })
                          }
                          className="mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm dark:border-white/15 dark:bg-white/5 dark:text-white"
                        />
                      </div>
                    </div>

                    <ImageField
                      label="Imagen de portada"
                      value={activeArticle.image}
                      onChange={(url) => updateNewsAt(selectedNewsIdx, { image: url })}
                      images={images}
                      onUploaded={(img) => setImages((prev) => [img, ...prev])}
                    />

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                        Resumen corto
                      </label>
                      <textarea
                        rows={2}
                        value={activeArticle.excerpt}
                        onChange={(e) => updateNewsAt(selectedNewsIdx, { excerpt: e.target.value })}
                        className="mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm dark:border-white/15 dark:bg-white/5 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                        Contenido completo (separa párrafos con línea en blanco)
                      </label>
                      <textarea
                        rows={8}
                        value={activeArticle.content.join('\n\n')}
                        onChange={(e) =>
                          updateNewsAt(selectedNewsIdx, {
                            content: e.target.value
                              .split(/\n\s*\n/)
                              .map((p) => p.trim())
                              .filter(Boolean),
                          })
                        }
                        className="mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm leading-relaxed dark:border-white/15 dark:bg-white/5 dark:text-white"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="rounded-3xl border border-dashed border-slate-300 p-12 text-center dark:border-white/15">
                    <p className="text-sm text-slate-500">
                      Crea tu primera nota con el botón &quot;Nueva nota&quot;.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB: IDENTITY & KEY IMAGES */}
          {tab === 'identity' && hasPermission(['site.design', 'site.pages']) && (
            <div className="space-y-8">
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 dark:border-white/10 dark:bg-[#0b1229]">
                <h2 className="font-display text-xl font-bold">Imágenes principales del sitio</h2>
                <div className="mt-6 grid gap-6 md:grid-cols-2">
                  <ImageField
                    label="Emblema LIAA (Navbar, Hero y Footer)"
                    value={draft.siteInfo.images.emblem}
                    onChange={(url) =>
                      updateDraft((p) => ({
                        ...p,
                        siteInfo: { ...p.siteInfo, images: { ...p.siteInfo.images, emblem: url } },
                      }))
                    }
                    images={images}
                    onUploaded={(img) => setImages((prev) => [img, ...prev])}
                  />
                  <ImageField
                    label="Logo horizontal LIAA (Página Nosotros)"
                    value={draft.siteInfo.images.logo}
                    onChange={(url) =>
                      updateDraft((p) => ({
                        ...p,
                        siteInfo: { ...p.siteInfo, images: { ...p.siteInfo.images, logo: url } },
                      }))
                    }
                    images={images}
                    onUploaded={(img) => setImages((prev) => [img, ...prev])}
                  />
                  <ImageField
                    label="Foto del Edificio PITec"
                    value={draft.siteInfo.images.pitecBuilding}
                    onChange={(url) =>
                      updateDraft((p) => ({
                        ...p,
                        siteInfo: {
                          ...p.siteInfo,
                          images: { ...p.siteInfo.images, pitecBuilding: url },
                        },
                      }))
                    }
                    images={images}
                    onUploaded={(img) => setImages((prev) => [img, ...prev])}
                  />
                  <ImageField
                    label="Gráfico de Misión"
                    value={draft.siteInfo.images.missionGraphic}
                    onChange={(url) =>
                      updateDraft((p) => ({
                        ...p,
                        siteInfo: {
                          ...p.siteInfo,
                          images: { ...p.siteInfo.images, missionGraphic: url },
                        },
                      }))
                    }
                    images={images}
                    onUploaded={(img) => setImages((prev) => [img, ...prev])}
                  />
                  <ImageField
                    label="Gráfico de Visión"
                    value={draft.siteInfo.images.visionGraphic}
                    onChange={(url) =>
                      updateDraft((p) => ({
                        ...p,
                        siteInfo: {
                          ...p.siteInfo,
                          images: { ...p.siteInfo.images, visionGraphic: url },
                        },
                      }))
                    }
                    images={images}
                    onUploaded={(img) => setImages((prev) => [img, ...prev])}
                  />
                </div>
              </div>

              <div className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 dark:border-white/10 dark:bg-[#0b1229]">
                <h2 className="font-display text-xl font-bold">¿Quiénes somos?, Misión y Visión</h2>
                <textarea
                  rows={3}
                  value={draft.labIdentity.aboutLead}
                  onChange={(e) =>
                    updateDraft((p) => ({
                      ...p,
                      labIdentity: { ...p.labIdentity, aboutLead: e.target.value },
                    }))
                  }
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm dark:border-white/15 dark:bg-white/5 dark:text-white"
                />
                <textarea
                  rows={5}
                  value={draft.labIdentity.aboutParagraphs.join('\n\n')}
                  onChange={(e) =>
                    updateDraft((p) => ({
                      ...p,
                      labIdentity: {
                        ...p.labIdentity,
                        aboutParagraphs: e.target.value
                          .split(/\n\s*\n/)
                          .map((x) => x.trim())
                          .filter(Boolean),
                      },
                    }))
                  }
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm dark:border-white/15 dark:bg-white/5 dark:text-white"
                />
                <div className="grid gap-5 md:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold uppercase text-slate-500">
                      Misión
                    </label>
                    <textarea
                      rows={4}
                      value={draft.labIdentity.mission}
                      onChange={(e) =>
                        updateDraft((p) => ({
                          ...p,
                          labIdentity: { ...p.labIdentity, mission: e.target.value },
                        }))
                      }
                      className="mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm dark:border-white/15 dark:bg-white/5 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase text-slate-500">
                      Visión
                    </label>
                    <textarea
                      rows={4}
                      value={draft.labIdentity.vision}
                      onChange={(e) =>
                        updateDraft((p) => ({
                          ...p,
                          labIdentity: { ...p.labIdentity, vision: e.target.value },
                        }))
                      }
                      className="mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm dark:border-white/15 dark:bg-white/5 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 dark:border-white/10 dark:bg-[#0b1229]">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-xl font-bold">
                    Valores ({draft.labIdentity.values.length})
                  </h2>
                  <button
                    type="button"
                    onClick={() => {
                      const nextCode = String(draft.labIdentity.values.length + 1).padStart(2, '0');
                      const nextVal: ValueItem = {
                        code: nextCode,
                        title: 'Nuevo Valor',
                        description: 'Describe este valor institucional.',
                      };
                      updateDraft((p) => ({
                        ...p,
                        labIdentity: { ...p.labIdentity, values: [...p.labIdentity.values, nextVal] },
                      }));
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white dark:bg-cyan-500 dark:text-slate-950"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Agregar valor
                  </button>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  {draft.labIdentity.values.map((val, idx) => (
                    <div
                      key={idx}
                      className="space-y-3 rounded-2xl border border-slate-200 p-4 dark:border-white/10"
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={val.code}
                          onChange={(e) =>
                            updateDraft((p) => ({
                              ...p,
                              labIdentity: {
                                ...p.labIdentity,
                                values: p.labIdentity.values.map((v, i) =>
                                  i === idx ? { ...v, code: e.target.value } : v,
                                ),
                              },
                            }))
                          }
                          className="w-16 rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-1.5 font-mono text-xs dark:border-white/15 dark:bg-white/5"
                        />
                        <input
                          type="text"
                          value={val.title}
                          onChange={(e) =>
                            updateDraft((p) => ({
                              ...p,
                              labIdentity: {
                                ...p.labIdentity,
                                values: p.labIdentity.values.map((v, i) =>
                                  i === idx ? { ...v, title: e.target.value } : v,
                                ),
                              },
                            }))
                          }
                          className="flex-1 rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-sm font-semibold dark:border-white/15 dark:bg-white/5"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            updateDraft((p) => ({
                              ...p,
                              labIdentity: {
                                ...p.labIdentity,
                                values: p.labIdentity.values.filter((_, i) => i !== idx),
                              },
                            }))
                          }
                          className="rounded-lg p-1.5 text-rose-400 hover:bg-rose-500/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <textarea
                        rows={2}
                        value={val.description}
                        onChange={(e) =>
                          updateDraft((p) => ({
                            ...p,
                            labIdentity: {
                              ...p.labIdentity,
                              values: p.labIdentity.values.map((v, i) =>
                                i === idx ? { ...v, description: e.target.value } : v,
                              ),
                            },
                          }))
                        }
                        className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs dark:border-white/15 dark:bg-white/5"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB: RESEARCH & PROJECTS */}
          {tab === 'research' && hasPermission(['research.manage', 'research.collaborate']) && (
            <div className="space-y-8">
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 dark:border-white/10 dark:bg-[#0b1229]">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-xl font-bold">
                    Proyectos destacados ({draft.projects.length})
                  </h2>
                  <button
                    type="button"
                    onClick={() => {
                      const newProj: ProjectItem = {
                        id: `proj-${Date.now().toString().slice(-4)}`,
                        title: 'Nuevo proyecto de IA',
                        lineId: draft.researchLines[0]?.id || 'vision-computadora',
                        status: 'En curso',
                        year: String(new Date().getFullYear()),
                        summary: 'Descripción breve del proyecto y sus objetivos.',
                        technologies: ['Python', 'PyTorch'],
                      };
                      updateDraft((p) => ({ ...p, projects: [newProj, ...p.projects] }));
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white dark:bg-cyan-500 dark:text-slate-950"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Nuevo proyecto
                  </button>
                </div>

                <div className="mt-6 space-y-4">
                  {draft.projects.map((proj, idx) => (
                    <div
                      key={proj.id}
                      className="space-y-3 rounded-2xl border border-slate-200 p-5 dark:border-white/10"
                    >
                      <div className="grid gap-3 sm:grid-cols-12">
                        <input
                          type="text"
                          value={proj.title}
                          onChange={(e) =>
                            updateDraft((p) => ({
                              ...p,
                              projects: p.projects.map((item, i) =>
                                i === idx ? { ...item, title: e.target.value } : item,
                              ),
                            }))
                          }
                          className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-semibold sm:col-span-5 dark:border-white/15 dark:bg-white/5"
                        />
                        <select
                          value={proj.lineId}
                          onChange={(e) =>
                            updateDraft((p) => ({
                              ...p,
                              projects: p.projects.map((item, i) =>
                                i === idx ? { ...item, lineId: e.target.value } : item,
                              ),
                            }))
                          }
                          className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs sm:col-span-3 dark:border-white/15 dark:bg-[#070c1c]"
                        >
                          {draft.researchLines.map((l) => (
                            <option key={l.id} value={l.id}>
                              {l.code} · {l.title}
                            </option>
                          ))}
                        </select>
                        <select
                          value={proj.status}
                          onChange={(e) =>
                            updateDraft((p) => ({
                              ...p,
                              projects: p.projects.map((item, i) =>
                                i === idx
                                  ? { ...item, status: e.target.value as ProjectItem['status'] }
                                  : item,
                              ),
                            }))
                          }
                          className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs sm:col-span-2 dark:border-white/15 dark:bg-[#070c1c]"
                        >
                          <option value="En curso">En curso</option>
                          <option value="Publicado">Publicado</option>
                          <option value="Colaboración">Colaboración</option>
                        </select>
                        <div className="flex items-center gap-2 sm:col-span-2">
                          <input
                            type="text"
                            value={proj.year}
                            onChange={(e) =>
                              updateDraft((p) => ({
                                ...p,
                                projects: p.projects.map((item, i) =>
                                  i === idx ? { ...item, year: e.target.value } : item,
                                ),
                              }))
                            }
                            className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-xs dark:border-white/15 dark:bg-white/5"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              updateDraft((p) => ({
                                ...p,
                                projects: p.projects.filter((_, i) => i !== idx),
                              }))
                            }
                            className="rounded-lg p-2 text-rose-400 hover:bg-rose-500/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      <textarea
                        rows={2}
                        value={proj.summary}
                        onChange={(e) =>
                          updateDraft((p) => ({
                            ...p,
                            projects: p.projects.map((item, i) =>
                              i === idx ? { ...item, summary: e.target.value } : item,
                            ),
                          }))
                        }
                        className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs dark:border-white/15 dark:bg-white/5"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 dark:border-white/10 dark:bg-[#0b1229]">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-xl font-bold">
                    Líneas de Investigación ({draft.researchLines.length})
                  </h2>
                  <button
                    type="button"
                    onClick={() => {
                      const num = String(draft.researchLines.length + 1).padStart(2, '0');
                      const nextLine: ResearchLine = {
                        id: `linea-${Date.now().toString().slice(-4)}`,
                        code: `LI-${num}`,
                        title: 'Nueva Línea de Investigación',
                        shortDescription: 'Resumen corto para la tarjeta de inicio.',
                        description: 'Descripción completa de la línea de investigación.',
                        icon: 'brain',
                        tags: ['IA', 'Investigación'],
                        applications: ['Aplicación principal 1'],
                      };
                      updateDraft((p) => ({
                        ...p,
                        researchLines: [...p.researchLines, nextLine],
                      }));
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white dark:bg-cyan-500 dark:text-slate-950"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Nueva línea
                  </button>
                </div>

                <div className="mt-6 space-y-4">
                  {draft.researchLines.map((line, idx) => (
                    <div
                      key={line.id}
                      className="space-y-3 rounded-2xl border border-slate-200 p-5 dark:border-white/10"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="text"
                          value={line.code}
                          onChange={(e) =>
                            updateDraft((p) => ({
                              ...p,
                              researchLines: p.researchLines.map((l, i) =>
                                i === idx ? { ...l, code: e.target.value } : l,
                              ),
                            }))
                          }
                          className="w-20 rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-xs dark:border-white/15 dark:bg-white/5"
                        />
                        <input
                          type="text"
                          value={line.title}
                          onChange={(e) =>
                            updateDraft((p) => ({
                              ...p,
                              researchLines: p.researchLines.map((l, i) =>
                                i === idx ? { ...l, title: e.target.value } : l,
                              ),
                            }))
                          }
                          className="flex-1 rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-semibold dark:border-white/15 dark:bg-white/5"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            updateDraft((p) => ({
                              ...p,
                              researchLines: p.researchLines.filter((_, i) => i !== idx),
                            }))
                          }
                          className="rounded-lg p-2 text-rose-400 hover:bg-rose-500/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      <IconPicker
                        label="Ícono de la línea"
                        value={line.icon}
                        onChange={(icon) =>
                          updateDraft((p) => ({
                            ...p,
                            researchLines: p.researchLines.map((l, i) =>
                              i === idx ? { ...l, icon } : l,
                            ),
                          }))
                        }
                      />

                      <textarea
                        rows={2}
                        value={line.description}
                        onChange={(e) =>
                          updateDraft((p) => ({
                            ...p,
                            researchLines: p.researchLines.map((l, i) =>
                              i === idx
                                ? {
                                    ...l,
                                    description: e.target.value,
                                    shortDescription: e.target.value.slice(0, 140),
                                  }
                                : l,
                            ),
                          }))
                        }
                        className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs dark:border-white/15 dark:bg-white/5"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB: GENERAL & CONTACT */}
          {tab === 'general' && hasPermission('site.settings') && (
            <div className="space-y-8">
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 dark:border-white/10 dark:bg-[#0b1229]">
                <h2 className="font-display text-xl font-bold">
                  Información Institucional y Contacto
                </h2>
                <div className="mt-6 grid gap-5 sm:grid-cols-2">
                  {(
                    [
                      ['fullName', 'Nombre completo del laboratorio'],
                      ['acronym', 'Siglas (ej. LIAA)'],
                      ['institution', 'Universidad / Institución'],
                      ['program', 'Programa de posgrado'],
                      ['degrees', 'Grados ofrecidos'],
                      ['phone', 'Teléfono'],
                      ['email', 'Correo electrónico'],
                      ['schedule', 'Horario de atención'],
                      ['shortAddress', 'Dirección corta (footer)'],
                      ['pitecUrl', 'URL sitio PITec'],
                    ] as const
                  ).map(([field, label]) => (
                    <div key={field}>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                        {label}
                      </label>
                      <input
                        type="text"
                        value={draft.siteInfo[field]}
                        onChange={(e) =>
                          updateDraft((p) => ({
                            ...p,
                            siteInfo: { ...p.siteInfo, [field]: e.target.value },
                          }))
                        }
                        className="mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm dark:border-white/15 dark:bg-white/5 dark:text-white"
                      />
                    </div>
                  ))}

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                      Dirección completa
                    </label>
                    <input
                      type="text"
                      value={draft.siteInfo.address}
                      onChange={(e) =>
                        updateDraft((p) => ({
                          ...p,
                          siteInfo: { ...p.siteInfo, address: e.target.value },
                        }))
                      }
                      className="mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm dark:border-white/15 dark:bg-white/5 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              <SmtpSettingsCard
                defaultTestEmail={user.email || ''}
                showToast={showToast}
              />
            </div>
          )}

          {/* TAB: GALLERY (MASTER + ADJUNTO) */}
          {tab === 'gallery' && (
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 dark:border-white/10 dark:bg-[#0b1229]">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="font-display text-xl font-bold">
                    Galería de Imágenes ({images.length})
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Sube fotos pesadas o diseños (PNG, JPG, WEBP o GIF hasta 50 MB; SVG bloqueado
                    por seguridad): se optimizan automáticamente para web.
                  </p>
                </div>
                <div>
                  <input
                    ref={galleryInputRef}
                    type="file"
                    multiple
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    onChange={handleGalleryUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    disabled={galleryUploading}
                    onClick={() => galleryInputRef.current?.click()}
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#0845ff] to-[#029be6] px-4 py-2.5 text-xs font-semibold text-white shadow-md"
                  >
                    {galleryUploading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    {galleryUploading ? 'Subiendo...' : 'Subir imágenes'}
                  </button>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
                {images.map((img) => (
                  <div
                    key={img.url}
                    className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-white/[0.03]"
                  >
                    <div className="aspect-[16/10] bg-slate-900">
                      <img src={img.url} alt={img.name} className="h-full w-full object-cover" />
                    </div>
                    <div className="p-3">
                      <p className="truncate font-mono text-xs font-medium text-slate-800 dark:text-slate-200">
                        {img.name}
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        {(img.size / 1024).toFixed(0)} KB · {img.uploaded ? 'Subida' : 'Base'}
                      </p>
                      <div className="mt-3 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(img.url);
                              setCopiedUrl(img.url);
                              setTimeout(() => setCopiedUrl(null), 2000);
                            } catch {
                              // Ignore
                            }
                          }}
                          className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 dark:border-white/15 dark:bg-white/5 dark:text-slate-200"
                        >
                          {copiedUrl === img.url ? (
                            <>
                              <Check className="h-3 w-3 text-emerald-500" />
                              Copiada
                            </>
                          ) : (
                            'Copiar ruta'
                          )}
                        </button>
                        {hasPermission('media.delete') && img.uploaded && (
                          <button
                            type="button"
                            onClick={() => handleDeleteImage(img)}
                            title="Eliminar imagen subida"
                            className="rounded-lg border border-rose-500/30 p-1.5 text-rose-500 hover:bg-rose-500/10"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB: PROFILE, USERS & CUSTOM ROLES */}
          {tab === 'users' && (
            <UsersProfileTab
              images={images}
              onUploaded={(img) => setImages((prev) => [img, ...prev])}
              showToast={showToast}
              onInspectAuditForUser={(uname) => {
                setAuditActorFilter(uname);
                selectTab('audit');
              }}
            />
          )}

          {/* TAB: AUDIT LOG */}
          {tab === 'audit' && hasPermission('audit.view') && (
            <AuditLogTab initialActor={auditActorFilter} />
          )}
        </main>
      </div>
    </div>
  );
}

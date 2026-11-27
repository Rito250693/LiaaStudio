import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Check,
  Crown,
  Eye,
  FilePlus2,
  LayoutDashboard,
  Loader2,
  LogOut,
  MenuSquare,
  Pencil,
  Type,
  UserCheck,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useContent } from '../context/ContentContext';
import type { FontFamilyKey } from '../data/siteData';
import { DEFAULT_TYPOGRAPHY, FONT_OPTIONS, getFontCssFamily } from '../utils/typography';

export function AdminBar() {
  const {
    authenticated,
    user,
    env,
    isMaster,
    isSuperAdmin,
    hasPermission,
    editMode,
    toggleEditMode,
    setEditMode,
    logout,
  } = useAuth();
  const { content, saveDesignToServer } = useContent();
  const location = useLocation();
  const navigate = useNavigate();

  const [typoOpen, setTypoOpen] = useState(false);
  const [savingTypo, setSavingTypo] = useState(false);
  const [typoSaved, setTypoSaved] = useState(false);

  if (!authenticated || !user) return null;

  const isInAdmin = location.pathname.startsWith('/admin');
  // Visual Edit Mode is now available on EVERY public page (built-in and custom pages)
  const canVisualEditRoute = hasPermission(['site.design', 'site.pages']) && !isInAdmin;
  const canEditGlobalTypography = hasPermission('site.design') && !isInAdmin;

  const currentTypo = {
    ...DEFAULT_TYPOGRAPHY,
    ...(content.typography || {}),
  };

  const handleUpdateGlobalFont = async (
    field: 'headingFont' | 'bodyFont' | 'monoFont',
    value: FontFamilyKey,
  ) => {
    setSavingTypo(true);
    setTypoSaved(false);
    try {
      await saveDesignToServer({
        typography: {
          ...currentTypo,
          [field]: value,
        },
      });
      setTypoSaved(true);
      window.setTimeout(() => setTypoSaved(false), 1800);
    } finally {
      setSavingTypo(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    if (isInAdmin) {
      navigate('/');
    }
  };

  const envLabel =
    env === 'production' ? 'PROD' : env === 'staging' ? 'PRUEBAS' : 'DEV';
  const envColor =
    env === 'production'
      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40'
      : env === 'staging'
      ? 'bg-amber-500/20 text-amber-300 border-amber-400/40'
      : 'bg-cyan-500/15 text-cyan-300 border-cyan-400/30';

  return (
    <div className="sticky top-0 z-[60] border-b border-cyan-500/30 bg-[#070d1f] text-slate-100 shadow-md">
      <div className="mx-auto flex h-12 max-w-7xl items-center justify-between gap-2 px-3 text-xs sm:px-6 lg:px-8">
        {/* Left: Switch between Site & Studio */}
        <div className="relative flex items-center gap-2 sm:gap-2.5">
          <span
            className={`hidden rounded-md border px-2 py-0.5 font-mono text-[10px] font-bold sm:inline-block ${envColor}`}
          >
            {envLabel}
          </span>

          {isInAdmin ? (
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 font-semibold text-white transition hover:bg-cyan-500 hover:text-slate-950"
            >
              <Eye className="h-3.5 w-3.5" />
              Ver Sitio Web
            </Link>
          ) : (
            <Link
              to={isMaster ? '/admin' : '/admin?tab=news'}
              onClick={() => setEditMode(false)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#0845ff] to-[#029be6] px-3 py-1.5 font-semibold text-white shadow-sm transition hover:brightness-110"
            >
              {isMaster ? (
                <>
                  <LayoutDashboard className="h-3.5 w-3.5" />
                  Panel de Control
                </>
              ) : (
                <>
                  <FilePlus2 className="h-3.5 w-3.5" />
                  Mi Panel
                </>
              )}
            </Link>
          )}

          {canVisualEditRoute && (
            <button
              type="button"
              onClick={() => {
                toggleEditMode();
                if (editMode) setTypoOpen(false);
              }}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-semibold transition ${
                editMode
                  ? 'border-amber-400/70 bg-amber-400/20 text-amber-200'
                  : 'border-white/15 bg-white/5 text-slate-200 hover:border-cyan-400/50 hover:text-cyan-300'
              }`}
            >
              <Pencil className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">
                {editMode ? 'Diseño Visual Activo' : 'Modo Diseño Visual'}
              </span>
              <span className="sm:hidden">{editMode ? 'Editando' : 'Editar'}</span>
            </button>
          )}

          {canEditGlobalTypography && editMode && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setTypoOpen((v) => !v)}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 font-semibold transition ${
                  typoOpen
                    ? 'border-cyan-400 bg-cyan-400/20 text-cyan-200'
                    : 'border-white/15 bg-white/5 text-slate-200 hover:border-cyan-400/50 hover:text-cyan-300'
                }`}
                title="Cambiar tipografía global de todo el sitio"
              >
                <Type className="h-3.5 w-3.5" />
                <span className="hidden md:inline">Tipografía Global</span>
              </button>

              {typoOpen && (
                <div className="absolute left-0 top-10 z-[80] w-80 rounded-2xl border border-cyan-400/30 bg-[#0b1229] p-4 text-left text-slate-100 shadow-2xl">
                  <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                    <div className="flex items-center gap-2">
                      <Type className="h-4 w-4 text-cyan-400" />
                      <span className="font-display text-xs font-bold uppercase tracking-wider text-white">
                        Tipografía del Sitio
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {savingTypo && <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-400" />}
                      {typoSaved && <Check className="h-3.5 w-3.5 text-emerald-400" />}
                      <button
                        type="button"
                        onClick={() => setTypoOpen(false)}
                        className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 space-y-3">
                    <div>
                      <label className="block font-mono text-[10px] uppercase tracking-wider text-cyan-300">
                        Fuente de Títulos (H1–H4)
                      </label>
                      <select
                        value={currentTypo.headingFont}
                        onChange={(e) =>
                          void handleUpdateGlobalFont(
                            'headingFont',
                            e.target.value as FontFamilyKey,
                          )
                        }
                        style={{ fontFamily: getFontCssFamily(currentTypo.headingFont) }}
                        className="mt-1 w-full rounded-xl border border-white/15 bg-[#070d1f] px-3 py-2 text-xs text-white focus:border-cyan-400 focus:outline-none"
                      >
                        {FONT_OPTIONS.map((f) => (
                          <option key={f.key} value={f.key}>
                            {f.label} ({f.category})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-mono text-[10px] uppercase tracking-wider text-cyan-300">
                        Fuente de Textos y Párrafos
                      </label>
                      <select
                        value={currentTypo.bodyFont}
                        onChange={(e) =>
                          void handleUpdateGlobalFont('bodyFont', e.target.value as FontFamilyKey)
                        }
                        style={{ fontFamily: getFontCssFamily(currentTypo.bodyFont) }}
                        className="mt-1 w-full rounded-xl border border-white/15 bg-[#070d1f] px-3 py-2 text-xs text-white focus:border-cyan-400 focus:outline-none"
                      >
                        {FONT_OPTIONS.map((f) => (
                          <option key={f.key} value={f.key}>
                            {f.label} ({f.category})
                          </option>
                        ))}
                      </select>
                    </div>

                    <p className="text-[11px] leading-relaxed text-slate-400">
                      También puedes personalizar la tipografía de cada título individual haciendo
                      clic en <strong className="text-cyan-300">Editar texto y tipografía</strong>.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {hasPermission('site.menus') && !isInAdmin && (
            <Link
              to="/admin?tab=menu"
              onClick={() => setEditMode(false)}
              className="hidden items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1.5 font-medium text-slate-200 transition hover:border-cyan-400/50 hover:text-cyan-300 lg:inline-flex"
            >
              <MenuSquare className="h-3.5 w-3.5" />
              Menú y Páginas
            </Link>
          )}
        </div>

        {/* Right: Always-visible Profile Avatar + Name + Role + Logout */}
        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            to="/admin?tab=users"
            onClick={() => setEditMode(false)}
            title="Editar mi perfil y seguridad 2FA"
            className="flex items-center gap-2 rounded-full border border-white/15 bg-white/5 py-1 pl-1 pr-3 transition hover:border-cyan-400/50"
          >
            <img
              src={user.avatar || '/images/liaa-emblem.png'}
              alt={user.displayName}
              className="h-7 w-7 rounded-full border border-cyan-400/40 bg-slate-900 object-cover"
            />
            <div className="hidden flex-col leading-none sm:flex">
              <span className="text-[11px] font-semibold text-white">{user.displayName}</span>
              <span className="mt-0.5 inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-wider text-cyan-300">
                {isSuperAdmin ? (
                  <Crown className="h-2.5 w-2.5 text-amber-400" />
                ) : (
                  <UserCheck className="h-2.5 w-2.5 text-emerald-400" />
                )}
                {user.roleName}
              </span>
            </div>
          </Link>

          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-1 rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1.5 font-medium text-rose-300 transition hover:bg-rose-500/20"
            title="Cerrar sesión"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Salir</span>
          </button>
        </div>
      </div>
    </div>
  );
}

import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowDown,
  ArrowUp,
  ExternalLink,
  Eye,
  EyeOff,
  GripVertical,
  LayoutTemplate,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import type { CustomPage, NavItem, SiteContent } from '../../data/siteData';
import { useAuth } from '../../context/AuthContext';

interface MenuPagesTabProps {
  draft: SiteContent;
  updateDraft: (updater: (prev: SiteContent) => SiteContent) => void;
  onSaveImmediate: (next: SiteContent, msg: string) => Promise<void>;
}

const RESERVED_SLUGS = new Set([
  'nosotros',
  'investigacion',
  'noticias',
  'contacto',
  'admin',
  'api',
]);

function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

export function MenuPagesTab({ draft, updateDraft, onSaveImmediate }: MenuPagesTabProps) {
  const navigate = useNavigate();
  const { setEditMode } = useAuth();

  const [newTitle, setNewTitle] = useState('');
  const [newSubtitle, setNewSubtitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const handleCreateMenuPage = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const label = newTitle.trim();
    if (!label) return;

    let slug = slugify(label);
    if (!slug) {
      setError('Escribe un nombre válido (por ejemplo: Talleres, Equipo, Laboratorios).');
      return;
    }
    if (RESERVED_SLUGS.has(slug) || draft.customPages.some((p) => p.slug === slug)) {
      slug = `${slug}-${Date.now().toString().slice(-3)}`;
    }

    const pageId = `page-${Date.now().toString(36)}`;
    const navId = `nav-${Date.now().toString(36)}`;
    const path = `/${slug}`;

    const newPage: CustomPage = {
      id: pageId,
      slug,
      title: label,
      eyebrow: 'LIAA · UAZ',
      subtitle:
        newSubtitle.trim() ||
        `Explora toda la información, actividades y recursos de ${label} en el Laboratorio de Inteligencia Artificial Avanzada.`,
      blocks: [
        {
          id: `blk-canvas-${Date.now().toString(36)}`,
          kind: 'canvas',
          eyebrow: label,
          title: `Espacio visual de ${label}`,
          subtitle: 'Activa el Modo Diseño Visual arriba para arrastrar textos, íconos e imágenes libremente.',
          canvasHeight: 400,
          elements: [
            {
              id: 'el-1',
              type: 'icon',
              x: 6,
              y: 16,
              width: 56,
              icon: 'sparkles',
              color: '#00d4ff',
            },
            {
              id: 'el-2',
              type: 'text',
              x: 18,
              y: 18,
              width: 420,
              text: `${label} · Laboratorio de Inteligencia Artificial Avanzada`,
              fontSize: 28,
              color: '#ffffff',
            },
            {
              id: 'el-3',
              type: 'text',
              x: 18,
              y: 44,
              width: 420,
              text: 'Haz clic en "Modo Diseño Visual" arriba para mover estos elementos, añadir fotos o insertar nuevos íconos.',
              fontSize: 15,
              color: '#94a3b8',
            },
            {
              id: 'el-4',
              type: 'image',
              x: 64,
              y: 15,
              width: 260,
              image: draft.siteInfo.images.pitecBuilding,
            },
          ],
        },
      ],
    };

    const newNav: NavItem = {
      id: navId,
      label,
      path,
      visible: true,
      pageId,
    };

    const nextContent: SiteContent = {
      ...draft,
      navItems: [...draft.navItems, newNav],
      customPages: [...draft.customPages, newPage],
    };

    await onSaveImmediate(
      nextContent,
      `Pestaña "${label}" y página ${path} creadas y publicadas automáticamente.`,
    );
    setNewTitle('');
    setNewSubtitle('');
  };

  const moveNav = (from: number, to: number) => {
    if (to < 0 || to >= draft.navItems.length || from === to) return;
    updateDraft((prev) => {
      const next = [...prev.navItems];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return { ...prev, navItems: next };
    });
  };

  const deleteCustomNav = (item: NavItem) => {
    if (!item.pageId) return;
    if (!window.confirm(`¿Eliminar la pestaña "${item.label}" y su página ${item.path}?`)) return;
    updateDraft((prev) => ({
      ...prev,
      navItems: prev.navItems.filter((n) => n.id !== item.id),
      customPages: prev.customPages.filter((p) => p.id !== item.pageId),
    }));
  };

  return (
    <div className="space-y-8">
      {/* Create new tab + page automatically */}
      <div className="rounded-3xl border border-cyan-500/30 bg-gradient-to-br from-blue-600/5 via-white to-cyan-500/5 p-6 shadow-sm sm:p-8 dark:from-[#0b1635] dark:via-[#0b1229] dark:to-[#081526]">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-r from-[#0845ff] to-[#029be6] text-white shadow-md">
            <LayoutTemplate className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-xl font-bold">
              Agregar nueva pestaña al menú (crea página automáticamente)
            </h2>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
              Por ejemplo, escribe <strong>&quot;Talleres&quot;</strong>: se añadirá al menú
              superior, creará la ruta <code className="font-mono">/talleres</code> con un Lienzo
              Libre editable y al hacer clic redirigirá automáticamente a esa página.
            </p>
          </div>
        </div>

        <form onSubmit={handleCreateMenuPage} className="mt-6 grid gap-4 sm:grid-cols-12">
          <div className="sm:col-span-4">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
              Nombre de la pestaña *
            </label>
            <input
              type="text"
              required
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Ej. Talleres"
              className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold dark:border-white/15 dark:bg-white/5 dark:text-white"
            />
            {newTitle.trim() && (
              <p className="mt-1 font-mono text-[11px] text-sky-700 dark:text-cyan-400">
                Ruta automática: /{slugify(newTitle)}
              </p>
            )}
          </div>

          <div className="sm:col-span-5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
              Descripción corta de la página (opcional)
            </label>
            <input
              type="text"
              value={newSubtitle}
              onChange={(e) => setNewSubtitle(e.target.value)}
              placeholder="Ej. Cursos prácticos y talleres de IA del LIAA"
              className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm dark:border-white/15 dark:bg-white/5 dark:text-white"
            />
          </div>

          <div className="flex items-end sm:col-span-3">
            <button
              type="submit"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#0845ff] to-[#029be6] px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:brightness-110"
            >
              <Plus className="h-4 w-4" />
              Crear pestaña
            </button>
          </div>
        </form>

        {error && <p className="mt-3 text-xs font-medium text-rose-500">{error}</p>}
      </div>

      {/* Manage Menu Items */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 dark:border-white/10 dark:bg-[#0b1229]">
        <h2 className="font-display text-xl font-bold">
          Menú de Navegación ({draft.navItems.length} pestañas)
        </h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Arrastra para cambiar el orden del menú superior, renombra las etiquetas o entra a diseñar
          en vivo tus páginas personalizadas.
        </p>

        <div className="mt-6 space-y-3">
          {draft.navItems.map((item, idx) => (
            <div
              key={item.id}
              draggable
              onDragStart={() => setDragIdx(idx)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragIdx !== null) moveNav(dragIdx, idx);
                setDragIdx(null);
              }}
              className={`flex flex-wrap items-center gap-3 rounded-2xl border p-3.5 transition ${
                !item.visible ? 'opacity-55' : ''
              } border-slate-200 bg-slate-50/70 dark:border-white/10 dark:bg-white/[0.03]`}
            >
              <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-slate-400" />

              <input
                type="text"
                value={item.label}
                onChange={(e) => {
                  const nextLabel = e.target.value;
                  updateDraft((prev) => ({
                    ...prev,
                    navItems: prev.navItems.map((n) =>
                      n.id === item.id ? { ...n, label: nextLabel } : n,
                    ),
                    customPages: item.pageId
                      ? prev.customPages.map((p) =>
                          p.id === item.pageId ? { ...p, title: nextLabel } : p,
                        )
                      : prev.customPages,
                  }));
                }}
                className="min-w-[140px] flex-1 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold dark:border-white/15 dark:bg-[#070c1c]"
              />

              <span className="rounded-lg bg-slate-200/70 px-2.5 py-1 font-mono text-xs text-slate-700 dark:bg-white/10 dark:text-cyan-300">
                {item.path}
              </span>

              <div className="flex items-center gap-1">
                {item.pageId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditMode(true);
                      navigate(item.path);
                    }}
                    className="inline-flex items-center gap-1 rounded-lg bg-cyan-500/15 px-2.5 py-1.5 text-xs font-semibold text-sky-700 transition hover:bg-cyan-500 hover:text-slate-950 dark:text-cyan-300"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Diseñar en vivo
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => navigate(item.path)}
                  title="Ir a esta página"
                  className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-200 dark:hover:bg-white/10"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </button>

                <button
                  type="button"
                  disabled={idx === 0}
                  onClick={() => moveNav(idx, idx - 1)}
                  className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-200 disabled:opacity-30 dark:hover:bg-white/10"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  disabled={idx === draft.navItems.length - 1}
                  onClick={() => moveNav(idx, idx + 1)}
                  className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-200 disabled:opacity-30 dark:hover:bg-white/10"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>

                <button
                  type="button"
                  disabled={item.path === '/'}
                  onClick={() =>
                    updateDraft((prev) => ({
                      ...prev,
                      navItems: prev.navItems.map((n) =>
                        n.id === item.id ? { ...n, visible: !n.visible } : n,
                      ),
                    }))
                  }
                  title={item.visible ? 'Ocultar del menú' : 'Mostrar en el menú'}
                  className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-200 disabled:opacity-30 dark:hover:bg-white/10"
                >
                  {item.visible ? (
                    <Eye className="h-3.5 w-3.5" />
                  ) : (
                    <EyeOff className="h-3.5 w-3.5 text-amber-500" />
                  )}
                </button>

                {item.pageId && (
                  <button
                    type="button"
                    onClick={() => deleteCustomNav(item)}
                    title="Eliminar pestaña y página"
                    className="rounded-lg p-1.5 text-rose-400 hover:bg-rose-500/10 hover:text-rose-500"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

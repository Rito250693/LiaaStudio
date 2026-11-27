import { useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  ArrowDown,
  ArrowLeftRight,
  ArrowUp,
  BarChart3,
  CheckCircle2,
  Image as ImageIcon,
  LayoutGrid,
  Megaphone,
  Move,
  Save,
  Trash2,
} from 'lucide-react';
import { PageBanner } from '../components/PageBanner';
import { CustomBlockRenderer } from '../components/CustomBlockRenderer';
import { NotFoundPage } from './NotFoundPage';
import { useContent } from '../context/ContentContext';
import { useAuth } from '../context/AuthContext';
import type { CustomBlock, CustomPage } from '../data/siteData';

export function DynamicPage() {
  const { pageSlug } = useParams();
  const { content, savePagesToServer, savePageText } = useContent();
  const { hasPermission, editMode } = useAuth();
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const page = content.customPages.find((p) => p.slug === pageSlug);

  if (!page) {
    return <NotFoundPage />;
  }

  const isEditing = hasPermission('site.pages') && editMode;

  const notify = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((prev) => (prev === msg ? null : prev)), 2600);
  };

  const persistPage = async (updatedPage: CustomPage, message = 'Página guardada.') => {
    setSaving(true);
    try {
      const nextPages = content.customPages.map((p) => (p.id === updatedPage.id ? updatedPage : p));
      await savePagesToServer({ customPages: nextPages });
      notify(message);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Error al guardar cambios.');
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const addBlock = (kind: CustomBlock['kind']) => {
    const id = `pblk-${Date.now().toString(36)}`;
    let block: CustomBlock;
    if (kind === 'canvas') {
      block = {
        id,
        kind: 'canvas',
        eyebrow: 'Diseño Libre',
        title: 'Lienzo Interactivo',
        subtitle: 'Arrastra textos, íconos, fotos y botones a cualquier posición.',
        canvasHeight: 420,
        elements: [
          {
            id: 'el-1',
            type: 'icon',
            x: 8,
            y: 16,
            width: 52,
            icon: 'sparkles',
            color: '#00d4ff',
          },
          {
            id: 'el-2',
            type: 'text',
            x: 22,
            y: 18,
            width: 420,
            text: `Bienvenidos a ${page.title}`,
            fontSize: 28,
            color: '#ffffff',
          },
          {
            id: 'el-3',
            type: 'image',
            x: 62,
            y: 16,
            width: 260,
            image: content.siteInfo.images.pitecBuilding,
          },
        ],
      };
    } else if (kind === 'icon-cards') {
      block = {
        id,
        kind: 'icon-cards',
        eyebrow: page.title,
        title: 'Actividades y Temas',
        subtitle: 'Explora los ejes principales de esta sección.',
        columns: 3,
        cards: [
          {
            icon: 'brain',
            title: 'Sesiones Prácticas',
            description: 'Aprende entrenando modelos reales paso a paso.',
          },
          {
            icon: 'code',
            title: 'Código Abierto',
            description: 'Materiales, notebooks y repositorios disponibles.',
          },
          {
            icon: 'graduation',
            title: 'Constancia UAZ',
            description: 'Acompañamiento académico dentro del PITec.',
          },
        ],
      };
    } else if (kind === 'text-image') {
      block = {
        id,
        kind: 'text-image',
        eyebrow: page.title,
        title: 'Información Destacada',
        subtitle: 'Personaliza el contenido y la imagen.',
        body: 'Agrega aquí los detalles, requisitos, fechas o información relevante de esta nueva página.',
        image: content.siteInfo.images.pitecBuilding,
        imagePosition: 'left',
        buttonLabel: 'Contactar al LIAA',
        buttonLink: '/contacto',
      };
    } else if (kind === 'stats') {
      block = {
        id,
        kind: 'stats',
        eyebrow: 'Resumen',
        title: 'Datos Clave',
        subtitle: '',
        stats: [
          { icon: 'calendar', value: '2026', label: 'Edición actual' },
          { icon: 'users', value: 'Abierto', label: 'Cupo disponible' },
          { icon: 'award', value: 'PITec', label: 'Respaldo UAZ' },
          { icon: 'sparkles', value: 'IA', label: 'Enfoque práctico' },
        ],
      };
    } else {
      block = {
        id,
        kind: 'cta-banner',
        eyebrow: page.title,
        icon: 'rocket',
        title: '¿Te interesa participar?',
        subtitle: 'Escríbenos para recibir fechas, temario y detalles de registro.',
        buttonLabel: 'Ir a Contacto',
        buttonLink: '/contacto',
        align: 'left',
      };
    }

    void persistPage({ ...page, blocks: [...page.blocks, block] }, 'Bloque añadido.');
  };

  const moveBlock = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= page.blocks.length) return;
    const next = [...page.blocks];
    const [moved] = next.splice(idx, 1);
    next.splice(target, 0, moved);
    void persistPage({ ...page, blocks: next }, 'Orden actualizado.');
  };

  const deleteBlock = (id: string) => {
    if (!window.confirm('¿Eliminar este bloque?')) return;
    void persistPage({ ...page, blocks: page.blocks.filter((b) => b.id !== id) }, 'Bloque eliminado.');
  };

  const updateBlock = async (nextBlock: CustomBlock) => {
    await persistPage(
      { ...page, blocks: page.blocks.map((b) => (b.id === nextBlock.id ? nextBlock : b)) },
      'Cambios guardados.',
    );
  };

  return (
    <div>
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-2xl border border-emerald-500/40 bg-emerald-950/90 px-4 py-3 text-xs font-medium text-emerald-200 shadow-xl backdrop-blur">
          <CheckCircle2 className="h-4 w-4" />
          <span>{toast}</span>
        </div>
      )}

      <PageBanner
        textKey={`page.${page.id}.banner`}
        eyebrow={page.eyebrow || 'LIAA · UAZ'}
        title={page.title}
        subtitle={page.subtitle}
        breadcrumb={page.title}
        onCustomSave={async (next) => {
          await persistPage(
            {
              ...page,
              eyebrow: next.eyebrow !== undefined ? next.eyebrow : page.eyebrow,
              title: next.title !== undefined ? next.title : page.title,
              subtitle: next.subtitle !== undefined ? next.subtitle : page.subtitle,
            },
            'Encabezado de página guardado.',
          );
          await savePageText(`page.${page.id}.banner`, next);
        }}
      />

      {/* Inline Header Editor when in Visual Edit Mode */}
      {isEditing && (
        <div className="border-b border-cyan-500/30 bg-[#070d20] py-5 text-xs text-slate-100">
          <div className="mx-auto max-w-7xl space-y-4 px-4 sm:px-6 lg:px-8">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono font-semibold uppercase tracking-wider text-cyan-300">
                Diseñando página /{page.slug} en vivo {saving ? '· Guardando...' : ''}
              </span>
              <span className="inline-flex items-center gap-1 text-emerald-300">
                <Save className="h-3.5 w-3.5" />
                Auto-guardado activo
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <input
                type="text"
                defaultValue={page.eyebrow}
                onBlur={(e) => {
                  if (e.target.value !== page.eyebrow) {
                    void persistPage({ ...page, eyebrow: e.target.value });
                  }
                }}
                placeholder="Etiqueta superior"
                className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-white"
              />
              <input
                type="text"
                defaultValue={page.title}
                onBlur={(e) => {
                  if (e.target.value !== page.title) {
                    void persistPage({ ...page, title: e.target.value });
                  }
                }}
                placeholder="Título de la página"
                className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 font-bold text-white"
              />
              <input
                type="text"
                defaultValue={page.subtitle}
                onBlur={(e) => {
                  if (e.target.value !== page.subtitle) {
                    void persistPage({ ...page, subtitle: e.target.value });
                  }
                }}
                placeholder="Descripción de la página"
                className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-white"
              />
            </div>

            {/* Quick Add Blocks */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-slate-400">Añadir bloque:</span>
              <button
                type="button"
                onClick={() => addBlock('canvas')}
                className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-400 px-3 py-1.5 font-bold text-slate-950 hover:bg-cyan-300"
              >
                <Move className="h-3.5 w-3.5" />+ Lienzo Libre (Arrastrar todo)
              </button>
              <button
                type="button"
                onClick={() => addBlock('icon-cards')}
                className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-3 py-1.5 font-semibold hover:bg-white/20"
              >
                <LayoutGrid className="h-3.5 w-3.5" />+ Tarjetas con Íconos
              </button>
              <button
                type="button"
                onClick={() => addBlock('text-image')}
                className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-3 py-1.5 font-semibold hover:bg-white/20"
              >
                <ImageIcon className="h-3.5 w-3.5" />+ Texto + Imagen
              </button>
              <button
                type="button"
                onClick={() => addBlock('cta-banner')}
                className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-3 py-1.5 font-semibold hover:bg-white/20"
              >
                <Megaphone className="h-3.5 w-3.5" />+ Banner CTA
              </button>
              <button
                type="button"
                onClick={() => addBlock('stats')}
                className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-3 py-1.5 font-semibold hover:bg-white/20"
              >
                <BarChart3 className="h-3.5 w-3.5" />+ Estadísticas
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Blocks */}
      {page.blocks.length === 0 ? (
        <section className="mx-auto max-w-4xl px-4 py-20 text-center">
          <p className="text-base text-slate-500 dark:text-slate-400">
            Esta página aún no tiene bloques de contenido.
            {hasPermission('site.pages')
              ? ' Activa "Modo Diseño Visual" arriba para añadir un Lienzo Libre o bloques visuales.'
              : ''}
          </p>
        </section>
      ) : (
        page.blocks.map((block, idx) => (
          <div
            key={block.id}
            className={
              isEditing ? 'relative border-b-2 border-dashed border-cyan-500/30' : undefined
            }
          >
            {isEditing && (
              <div className="mx-auto flex max-w-7xl justify-end px-4 pt-4 sm:px-6 lg:px-8">
                <div className="inline-flex items-center gap-1 rounded-xl border border-cyan-400/40 bg-[#070d20] p-1 text-xs text-slate-100 shadow-lg">
                  <span className="px-2 font-mono text-[11px] text-cyan-300">{block.kind}</span>
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => moveBlock(idx, -1)}
                    className="rounded p-1.5 hover:bg-white/10 disabled:opacity-30"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={idx === page.blocks.length - 1}
                    onClick={() => moveBlock(idx, 1)}
                    className="rounded p-1.5 hover:bg-white/10 disabled:opacity-30"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                  {(block.kind === 'text-image' || block.kind === 'cta-banner') && (
                    <button
                      type="button"
                      onClick={() =>
                        updateBlock({
                          ...block,
                          imagePosition: block.imagePosition === 'right' ? 'left' : 'right',
                          align: block.align === 'center' ? 'left' : 'center',
                        })
                      }
                      title="Invertir posición"
                      className="rounded p-1.5 text-cyan-300 hover:bg-white/10"
                    >
                      <ArrowLeftRight className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => deleteBlock(block.id)}
                    className="rounded p-1.5 text-rose-400 hover:bg-rose-500/20"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}

            <CustomBlockRenderer
              block={block}
              editable={isEditing}
              onChangeBlock={updateBlock}
            />
          </div>
        ))
      )}
    </div>
  );
}

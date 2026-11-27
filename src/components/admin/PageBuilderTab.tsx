import { useState } from 'react';
import {
  ArrowDown,
  ArrowLeftRight,
  ArrowUp,
  BarChart3,
  Eye,
  EyeOff,
  GripVertical,
  Image as ImageIcon,
  LayoutGrid,
  Megaphone,
  Move,
  Plus,
  Trash2,
} from 'lucide-react';
import type { CustomBlock, HomeSectionConfig, SiteContent } from '../../data/siteData';
import { ImageField, type GalleryImage } from './ImageField';
import { IconPicker } from './IconPicker';
import { CanvasBlockRenderer } from '../CanvasBlockRenderer';

interface PageBuilderTabProps {
  draft: SiteContent;
  updateDraft: (updater: (prev: SiteContent) => SiteContent) => void;
  images: GalleryImage[];
  onUploaded: (img: GalleryImage) => void;
  initialBlockId?: string;
}

export function PageBuilderTab({
  draft,
  updateDraft,
  images,
  onUploaded,
  initialBlockId,
}: PageBuilderTabProps) {
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(
    initialBlockId || draft.customBlocks[0]?.id || null,
  );
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const moveSection = (from: number, to: number) => {
    if (to < 0 || to >= draft.homeSections.length || from === to) return;
    updateDraft((prev) => {
      const next = [...prev.homeSections];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return { ...prev, homeSections: next };
    });
  };

  const toggleVisible = (id: string) => {
    updateDraft((prev) => ({
      ...prev,
      homeSections: prev.homeSections.map((s) =>
        s.id === id ? { ...s, visible: !s.visible } : s,
      ),
    }));
  };

  const flipSection = (sec: HomeSectionConfig) => {
    if (sec.type === 'hero') {
      const order: Array<'default' | 'reversed' | 'centered'> = [
        'default',
        'reversed',
        'centered',
      ];
      const nextLayout = order[(order.indexOf(draft.hero.layout) + 1) % order.length];
      updateDraft((prev) => ({
        ...prev,
        hero: { ...prev.hero, layout: nextLayout },
      }));
      return;
    }

    if (sec.type === 'custom' && sec.customBlockId) {
      updateDraft((prev) => ({
        ...prev,
        customBlocks: prev.customBlocks.map((b) =>
          b.id === sec.customBlockId
            ? {
                ...b,
                imagePosition: b.imagePosition === 'right' ? 'left' : 'right',
                align: b.align === 'center' ? 'left' : 'center',
              }
            : b,
        ),
      }));
      return;
    }

    updateDraft((prev) => ({
      ...prev,
      homeSections: prev.homeSections.map((s) =>
        s.id === sec.id ? { ...s, flipped: !s.flipped } : s,
      ),
    }));
  };

  const addCustomBlock = (kind: CustomBlock['kind']) => {
    const id = `blk-${Date.now().toString().slice(-5)}`;
    let block: CustomBlock;
    let sectionLabel: string;

    if (kind === 'canvas') {
      sectionLabel = 'Bloque: Lienzo Libre (Arrastrable)';
      block = {
        id,
        kind: 'canvas',
        eyebrow: 'Diseño Libre',
        title: 'Sección de Diseño Libre',
        subtitle: 'Arrastra y coloca textos, íconos, imágenes y botones en cualquier posición.',
        canvasHeight: 420,
        elements: [
          {
            id: 'el-1',
            type: 'icon',
            x: 8,
            y: 16,
            width: 56,
            icon: 'brain',
            color: '#00d4ff',
          },
          {
            id: 'el-2',
            type: 'text',
            x: 20,
            y: 18,
            width: 380,
            text: 'Arrastra este título, los íconos o la imagen donde tú quieras',
            fontSize: 26,
            color: '#ffffff',
          },
          {
            id: 'el-3',
            type: 'image',
            x: 62,
            y: 16,
            width: 240,
            image: draft.siteInfo.images.pitecBuilding,
          },
        ],
      };
    } else if (kind === 'icon-cards') {
      sectionLabel = 'Bloque: Tarjetas con Íconos';
      block = {
        id,
        kind,
        eyebrow: 'Destacados',
        title: '¿Por qué colaborar con el LIAA?',
        subtitle: 'Personaliza las tarjetas, sus íconos, textos y cantidad de columnas.',
        columns: 3,
        align: 'left',
        cards: [
          {
            icon: 'brain',
            title: 'Investigación de Frontera',
            description: 'Modelos avanzados de aprendizaje profundo y visión artificial.',
          },
          {
            icon: 'cpu',
            title: 'Infraestructura Especializada',
            description: 'Desarrollo sobre hardware embebido y cómputo científico.',
          },
          {
            icon: 'users',
            title: 'Equipo Multidisciplinario',
            description: 'Mentoría directa con investigadores y estudiantes de posgrado.',
          },
        ],
      };
    } else if (kind === 'text-image') {
      sectionLabel = 'Bloque: Texto + Imagen';
      block = {
        id,
        kind,
        eyebrow: 'Sección Personalizada',
        title: 'Título de tu nueva sección',
        subtitle: 'Agrega un subtítulo breve que introduzca el tema.',
        body: 'Escribe aquí uno o varios párrafos explicando este contenido.\n\nPuedes mover la imagen a la izquierda o a la derecha y agregar un botón opcional.',
        image: draft.siteInfo.images.pitecBuilding,
        imagePosition: 'left',
        buttonLabel: 'Más información',
        buttonLink: '/contacto',
      };
    } else if (kind === 'stats') {
      sectionLabel = 'Bloque: Indicadores / Métricas';
      block = {
        id,
        kind,
        eyebrow: 'Impacto LIAA',
        title: 'Resultados en cifras',
        subtitle: 'Destaca logros, publicaciones, investigadores o proyectos del laboratorio.',
        stats: [
          { icon: 'flask', value: '12+', label: 'Proyectos desarrollados' },
          { icon: 'book', value: '25+', label: 'Publicaciones científicas' },
          { icon: 'graduation', value: '30+', label: 'Estudiantes formados' },
          { icon: 'award', value: 'UAZ', label: 'Vinculación académica' },
        ],
      };
    } else {
      sectionLabel = 'Bloque: Banner / Llamado a la acción';
      block = {
        id,
        kind: 'cta-banner',
        eyebrow: 'Convocatoria Abierta',
        icon: 'rocket',
        title: 'Únete a un proyecto de Inteligencia Artificial en el LIAA',
        subtitle:
          'Si eres estudiante de licenciatura, maestría o doctorado, escríbenos para conocer los temas disponibles.',
        buttonLabel: 'Postularme ahora',
        buttonLink: '/contacto',
        align: 'left',
      };
    }

    updateDraft((prev) => ({
      ...prev,
      customBlocks: [...prev.customBlocks, block],
      homeSections: [
        ...prev.homeSections,
        {
          id: `sec-${id}`,
          type: 'custom',
          label: sectionLabel,
          visible: true,
          customBlockId: id,
        },
      ],
    }));
    setSelectedBlockId(id);
  };

  const deleteCustomBlock = (blockId: string) => {
    if (!window.confirm('¿Eliminar este bloque personalizado de la página?')) return;
    updateDraft((prev) => ({
      ...prev,
      customBlocks: prev.customBlocks.filter((b) => b.id !== blockId),
      homeSections: prev.homeSections.filter((s) => s.customBlockId !== blockId),
    }));
    if (selectedBlockId === blockId) {
      setSelectedBlockId(null);
    }
  };

  const updateBlock = (blockId: string, patch: Partial<CustomBlock>) => {
    updateDraft((prev) => ({
      ...prev,
      customBlocks: prev.customBlocks.map((b) => (b.id === blockId ? { ...b, ...patch } : b)),
      homeSections:
        patch.title !== undefined
          ? prev.homeSections.map((s) =>
              s.customBlockId === blockId ? { ...s, label: `Bloque: ${patch.title}` } : s,
            )
          : prev.homeSections,
    }));
  };

  const activeBlock = draft.customBlocks.find((b) => b.id === selectedBlockId) || null;

  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-12">
      {/* LEFT: Section Order & Add Block */}
      <div className="space-y-6 lg:col-span-5">
        {/* Add new blocks */}
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#0b1229]">
          <h2 className="font-display text-base font-bold">Añadir nuevo bloque a la portada</h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Crea nuevas secciones con íconos, imágenes, estadísticas o banners y muévelas donde
            quieras.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => addCustomBlock('canvas')}
              className="col-span-2 flex items-center justify-center gap-2 rounded-xl border border-cyan-500/40 bg-cyan-500/10 p-3 text-xs font-bold text-sky-700 transition hover:bg-cyan-500 hover:text-slate-950 dark:text-cyan-300"
            >
              <Move className="h-4 w-4 shrink-0" />
              + Lienzo Libre (Mover textos, íconos y fotos libremente)
            </button>
            <button
              type="button"
              onClick={() => addCustomBlock('icon-cards')}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-left text-xs font-semibold transition hover:border-blue-500 hover:bg-blue-50/60 dark:border-white/10 dark:bg-white/5 dark:hover:border-cyan-400"
            >
              <LayoutGrid className="h-4 w-4 shrink-0 text-blue-600 dark:text-cyan-400" />
              Tarjetas + Íconos
            </button>
            <button
              type="button"
              onClick={() => addCustomBlock('text-image')}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-left text-xs font-semibold transition hover:border-blue-500 hover:bg-blue-50/60 dark:border-white/10 dark:bg-white/5 dark:hover:border-cyan-400"
            >
              <ImageIcon className="h-4 w-4 shrink-0 text-blue-600 dark:text-cyan-400" />
              Texto + Imagen
            </button>
            <button
              type="button"
              onClick={() => addCustomBlock('cta-banner')}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-left text-xs font-semibold transition hover:border-blue-500 hover:bg-blue-50/60 dark:border-white/10 dark:bg-white/5 dark:hover:border-cyan-400"
            >
              <Megaphone className="h-4 w-4 shrink-0 text-blue-600 dark:text-cyan-400" />
              Banner / CTA
            </button>
            <button
              type="button"
              onClick={() => addCustomBlock('stats')}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-left text-xs font-semibold transition hover:border-blue-500 hover:bg-blue-50/60 dark:border-white/10 dark:bg-white/5 dark:hover:border-cyan-400"
            >
              <BarChart3 className="h-4 w-4 shrink-0 text-blue-600 dark:text-cyan-400" />
              Estadísticas
            </button>
          </div>
        </div>

        {/* Drag-and-drop Section Order */}
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#0b1229]">
          <h2 className="font-display text-base font-bold">Orden y Posición de Secciones</h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Arrastra para reordenar, invierte columnas (Izq ⇄ Der) u oculta cualquier sección.
          </p>

          <div className="mt-4 space-y-2">
            {draft.homeSections.map((sec, idx) => {
              const isCustom = sec.type === 'custom' && sec.customBlockId;
              const isSelected = isCustom && sec.customBlockId === selectedBlockId;
              const canFlip =
                sec.type === 'hero' ||
                sec.type === 'about' ||
                sec.type === 'location' ||
                sec.type === 'custom';

              return (
                <div
                  key={sec.id}
                  draggable
                  onDragStart={() => setDragIdx(idx)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (dragIdx !== null) moveSection(dragIdx, idx);
                    setDragIdx(null);
                  }}
                  onClick={() => {
                    if (isCustom && sec.customBlockId) setSelectedBlockId(sec.customBlockId);
                  }}
                  className={`flex items-center gap-2 rounded-2xl border p-3 transition ${
                    isCustom ? 'cursor-pointer' : 'cursor-grab'
                  } ${
                    isSelected
                      ? 'border-blue-600 bg-blue-50/70 dark:border-cyan-400 dark:bg-cyan-400/10'
                      : 'border-slate-200 bg-slate-50/60 hover:border-sky-400 dark:border-white/10 dark:bg-white/[0.03]'
                  } ${!sec.visible ? 'opacity-55' : ''}`}
                >
                  <GripVertical className="h-4 w-4 shrink-0 text-slate-400" />

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-slate-900 dark:text-white">
                      {sec.label}
                    </p>
                    <p className="font-mono text-[10px] text-slate-500">
                      {sec.visible ? 'Visible' : 'Oculta'}
                      {sec.type === 'hero' ? ` · ${draft.hero.layout}` : ''}
                      {(sec.type === 'about' || sec.type === 'location') && sec.flipped
                        ? ' · Invertida'
                        : ''}
                    </p>
                  </div>

                  <div
                    className="flex items-center gap-0.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => moveSection(idx, idx - 1)}
                      title="Subir"
                      className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-200/70 disabled:opacity-30 dark:hover:bg-white/10"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === draft.homeSections.length - 1}
                      onClick={() => moveSection(idx, idx + 1)}
                      title="Bajar"
                      className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-200/70 disabled:opacity-30 dark:hover:bg-white/10"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                    {canFlip && (
                      <button
                        type="button"
                        onClick={() => flipSection(sec)}
                        title="Invertir posición (Izquierda / Derecha)"
                        className="rounded-lg p-1.5 text-sky-600 hover:bg-sky-500/10 dark:text-cyan-400"
                      >
                        <ArrowLeftRight className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => toggleVisible(sec.id)}
                      title={sec.visible ? 'Ocultar sección' : 'Volver a mostrar sección'}
                      className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold transition ${
                        sec.visible
                          ? 'text-slate-500 hover:bg-slate-200/70 dark:hover:bg-white/10'
                          : 'border border-amber-400/50 bg-amber-400/20 text-amber-700 hover:bg-amber-400 hover:text-slate-950 dark:text-amber-200'
                      }`}
                    >
                      {sec.visible ? (
                        <Eye className="h-3.5 w-3.5" />
                      ) : (
                        <>
                          <EyeOff className="h-3.5 w-3.5" />
                          Mostrar
                        </>
                      )}
                    </button>
                    {isCustom && sec.customBlockId && (
                      <button
                        type="button"
                        onClick={() => deleteCustomBlock(sec.customBlockId!)}
                        title="Eliminar bloque"
                        className="rounded-lg p-1.5 text-rose-400 hover:bg-rose-500/10 hover:text-rose-500"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* RIGHT: Custom Block Editor */}
      <div className="lg:col-span-7">
        {activeBlock ? (
          <div className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 dark:border-white/10 dark:bg-[#0b1229]">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4 dark:border-white/10">
              <div>
                <span className="font-mono text-[11px] uppercase tracking-wider text-sky-700 dark:text-cyan-400">
                  Editor de Bloque · {activeBlock.kind}
                </span>
                <h3 className="font-display text-xl font-bold">{activeBlock.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => deleteCustomBlock(activeBlock.id)}
                className="inline-flex items-center gap-1 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-500 hover:bg-rose-500/20"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Eliminar bloque
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Etiqueta superior (Eyebrow)
                </label>
                <input
                  type="text"
                  value={activeBlock.eyebrow}
                  onChange={(e) => updateBlock(activeBlock.id, { eyebrow: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-sm dark:border-white/15 dark:bg-white/5"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Título del bloque
                </label>
                <input
                  type="text"
                  value={activeBlock.title}
                  onChange={(e) => updateBlock(activeBlock.id, { title: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-sm font-semibold dark:border-white/15 dark:bg-white/5"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                Subtítulo / Introducción
              </label>
              <textarea
                rows={2}
                value={activeBlock.subtitle}
                onChange={(e) => updateBlock(activeBlock.id, { subtitle: e.target.value })}
                className="mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-sm dark:border-white/15 dark:bg-white/5"
              />
            </div>

            {/* FREE CANVAS SPECIFIC */}
            {activeBlock.kind === 'canvas' && (
              <div className="border-t border-slate-200 pt-4 dark:border-white/10">
                <CanvasBlockRenderer
                  block={{ ...activeBlock, eyebrow: '', title: '', subtitle: '' }}
                  editable
                  onChangeBlock={(nextCanvas) =>
                    updateBlock(activeBlock.id, {
                      elements: nextCanvas.elements,
                      canvasHeight: nextCanvas.canvasHeight,
                    })
                  }
                />
              </div>
            )}

            {/* ICON CARDS SPECIFIC */}
            {activeBlock.kind === 'icon-cards' && (
              <div className="space-y-4 border-t border-slate-200 pt-4 dark:border-white/10">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold">Columnas:</span>
                    {([2, 3, 4] as const).map((col) => (
                      <button
                        key={col}
                        type="button"
                        onClick={() => updateBlock(activeBlock.id, { columns: col })}
                        className={`rounded-lg px-2.5 py-1 font-mono text-xs font-semibold ${
                          (activeBlock.columns || 3) === col
                            ? 'bg-blue-600 text-white dark:bg-cyan-400 dark:text-slate-950'
                            : 'border border-slate-300 dark:border-white/15'
                        }`}
                      >
                        {col}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      updateBlock(activeBlock.id, {
                        cards: [
                          ...(activeBlock.cards || []),
                          {
                            icon: 'sparkles',
                            title: 'Nueva Tarjeta',
                            description: 'Describe este elemento aquí.',
                          },
                        ],
                      })
                    }
                    className="inline-flex items-center gap-1 rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white dark:bg-cyan-500 dark:text-slate-950"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Añadir tarjeta
                  </button>
                </div>

                {(activeBlock.cards || []).map((card, cIdx) => (
                  <div
                    key={cIdx}
                    className="space-y-3 rounded-2xl border border-slate-200 p-4 dark:border-white/10"
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={card.title}
                        onChange={(e) =>
                          updateBlock(activeBlock.id, {
                            cards: (activeBlock.cards || []).map((c, i) =>
                              i === cIdx ? { ...c, title: e.target.value } : c,
                            ),
                          })
                        }
                        className="flex-1 rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-sm font-semibold dark:border-white/15 dark:bg-white/5"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          updateBlock(activeBlock.id, {
                            cards: (activeBlock.cards || []).filter((_, i) => i !== cIdx),
                          })
                        }
                        className="rounded-lg p-1.5 text-rose-400 hover:bg-rose-500/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <textarea
                      rows={2}
                      value={card.description}
                      onChange={(e) =>
                        updateBlock(activeBlock.id, {
                          cards: (activeBlock.cards || []).map((c, i) =>
                            i === cIdx ? { ...c, description: e.target.value } : c,
                          ),
                        })
                      }
                      className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs dark:border-white/15 dark:bg-white/5"
                    />
                    <IconPicker
                      label="Ícono de la tarjeta"
                      value={card.icon}
                      onChange={(icon) =>
                        updateBlock(activeBlock.id, {
                          cards: (activeBlock.cards || []).map((c, i) =>
                            i === cIdx ? { ...c, icon } : c,
                          ),
                        })
                      }
                    />
                  </div>
                ))}
              </div>
            )}

            {/* TEXT + IMAGE SPECIFIC */}
            {activeBlock.kind === 'text-image' && (
              <div className="space-y-4 border-t border-slate-200 pt-4 dark:border-white/10">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold">Posición de la imagen:</span>
                  {(['left', 'right'] as const).map((pos) => (
                    <button
                      key={pos}
                      type="button"
                      onClick={() => updateBlock(activeBlock.id, { imagePosition: pos })}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                        (activeBlock.imagePosition || 'left') === pos
                          ? 'bg-blue-600 text-white dark:bg-cyan-400 dark:text-slate-950'
                          : 'border border-slate-300 dark:border-white/15'
                      }`}
                    >
                      {pos === 'left' ? 'Imagen a la izquierda' : 'Imagen a la derecha'}
                    </button>
                  ))}
                </div>

                <ImageField
                  label="Imagen de la sección"
                  value={activeBlock.image || ''}
                  onChange={(url) => updateBlock(activeBlock.id, { image: url })}
                  images={images}
                  onUploaded={onUploaded}
                />

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    Texto completo (separa párrafos con línea en blanco)
                  </label>
                  <textarea
                    rows={5}
                    value={activeBlock.body || ''}
                    onChange={(e) => updateBlock(activeBlock.id, { body: e.target.value })}
                    className="mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-sm dark:border-white/15 dark:bg-white/5"
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <input
                    type="text"
                    value={activeBlock.buttonLabel || ''}
                    onChange={(e) => updateBlock(activeBlock.id, { buttonLabel: e.target.value })}
                    placeholder="Texto del botón (opcional)"
                    className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm dark:border-white/15 dark:bg-white/5"
                  />
                  <input
                    type="text"
                    value={activeBlock.buttonLink || ''}
                    onChange={(e) => updateBlock(activeBlock.id, { buttonLink: e.target.value })}
                    placeholder="Enlace (ej. /contacto o https://...)"
                    className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-xs dark:border-white/15 dark:bg-white/5"
                  />
                </div>
              </div>
            )}

            {/* CTA BANNER SPECIFIC */}
            {activeBlock.kind === 'cta-banner' && (
              <div className="space-y-4 border-t border-slate-200 pt-4 dark:border-white/10">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold">Alineación:</span>
                  {(['left', 'center'] as const).map((al) => (
                    <button
                      key={al}
                      type="button"
                      onClick={() => updateBlock(activeBlock.id, { align: al })}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                        (activeBlock.align || 'left') === al
                          ? 'bg-blue-600 text-white dark:bg-cyan-400 dark:text-slate-950'
                          : 'border border-slate-300 dark:border-white/15'
                      }`}
                    >
                      {al === 'left' ? 'Horizontal (Izquierda)' : 'Centrado'}
                    </button>
                  ))}
                </div>

                <IconPicker
                  label="Ícono del banner"
                  value={activeBlock.icon || 'rocket'}
                  onChange={(icon) => updateBlock(activeBlock.id, { icon })}
                />

                <div className="grid gap-3 sm:grid-cols-2">
                  <input
                    type="text"
                    value={activeBlock.buttonLabel || ''}
                    onChange={(e) => updateBlock(activeBlock.id, { buttonLabel: e.target.value })}
                    placeholder="Texto del botón"
                    className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm dark:border-white/15 dark:bg-white/5"
                  />
                  <input
                    type="text"
                    value={activeBlock.buttonLink || ''}
                    onChange={(e) => updateBlock(activeBlock.id, { buttonLink: e.target.value })}
                    placeholder="Enlace (/contacto o https://...)"
                    className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-xs dark:border-white/15 dark:bg-white/5"
                  />
                </div>
              </div>
            )}

            {/* STATS SPECIFIC */}
            {activeBlock.kind === 'stats' && (
              <div className="space-y-4 border-t border-slate-200 pt-4 dark:border-white/10">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold">Indicadores</span>
                  <button
                    type="button"
                    onClick={() =>
                      updateBlock(activeBlock.id, {
                        stats: [
                          ...(activeBlock.stats || []),
                          { icon: 'star', value: '10+', label: 'Nuevo dato' },
                        ],
                      })
                    }
                    className="inline-flex items-center gap-1 rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white dark:bg-cyan-500 dark:text-slate-950"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Añadir dato
                  </button>
                </div>

                {(activeBlock.stats || []).map((st, sIdx) => (
                  <div
                    key={sIdx}
                    className="space-y-3 rounded-2xl border border-slate-200 p-4 dark:border-white/10"
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={st.value}
                        onChange={(e) =>
                          updateBlock(activeBlock.id, {
                            stats: (activeBlock.stats || []).map((item, i) =>
                              i === sIdx ? { ...item, value: e.target.value } : item,
                            ),
                          })
                        }
                        className="w-28 rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 font-display text-sm font-bold dark:border-white/15 dark:bg-white/5"
                      />
                      <input
                        type="text"
                        value={st.label}
                        onChange={(e) =>
                          updateBlock(activeBlock.id, {
                            stats: (activeBlock.stats || []).map((item, i) =>
                              i === sIdx ? { ...item, label: e.target.value } : item,
                            ),
                          })
                        }
                        className="flex-1 rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs dark:border-white/15 dark:bg-white/5"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          updateBlock(activeBlock.id, {
                            stats: (activeBlock.stats || []).filter((_, i) => i !== sIdx),
                          })
                        }
                        className="rounded-lg p-1.5 text-rose-400 hover:bg-rose-500/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <IconPicker
                      value={st.icon}
                      onChange={(icon) =>
                        updateBlock(activeBlock.id, {
                          stats: (activeBlock.stats || []).map((item, i) =>
                            i === sIdx ? { ...item, icon } : item,
                          ),
                        })
                      }
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex h-full min-h-[320px] flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white/50 p-10 text-center dark:border-white/15 dark:bg-[#0b1229]/50">
            <LayoutGrid className="h-10 w-10 text-slate-400" />
            <h3 className="mt-4 font-display text-lg font-bold text-slate-900 dark:text-white">
              Constructor visual de bloques
            </h3>
            <p className="mt-2 max-w-md text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              Arrastra las secciones a la izquierda para cambiar su orden, invierte sus columnas o
              haz clic en cualquiera de los 4 tipos de bloque para crear secciones nuevas con íconos
              e imágenes.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

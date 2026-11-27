import { Plus, Trash2 } from 'lucide-react';
import type { HeroConfig } from '../../data/siteData';
import { ImageField, type GalleryImage } from './ImageField';
import { IconPicker } from './IconPicker';

interface HeroEditorTabProps {
  hero: HeroConfig;
  onChange: (next: HeroConfig) => void;
  images: GalleryImage[];
  onUploaded: (img: GalleryImage) => void;
}

export function HeroEditorTab({ hero, onChange, images, onUploaded }: HeroEditorTabProps) {
  const update = (patch: Partial<HeroConfig>) => onChange({ ...hero, ...patch });

  return (
    <div className="mt-8 space-y-8">
      {/* Layout & Position */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 dark:border-white/10 dark:bg-[#0b1229]">
        <h2 className="font-display text-xl font-bold">Distribución y Posición de la Portada</h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Elige dónde colocar el texto y la tarjeta del emblema, y activa o desactiva el fondo
          interactivo.
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {(
            [
              {
                id: 'default',
                title: 'Texto Izq · Tarjeta Der',
                desc: 'Distribución clásica',
              },
              {
                id: 'reversed',
                title: 'Tarjeta Izq · Texto Der',
                desc: 'Columnas invertidas',
              },
              {
                id: 'centered',
                title: 'Centrado Minimalista',
                desc: 'Sin tarjeta lateral',
              },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => update({ layout: opt.id })}
              className={`rounded-2xl border p-4 text-left transition ${
                hero.layout === opt.id
                  ? 'border-blue-600 bg-blue-50/70 dark:border-cyan-400 dark:bg-cyan-400/10'
                  : 'border-slate-200 hover:border-sky-400 dark:border-white/10 dark:bg-white/[0.02]'
              }`}
            >
              <p className="font-display text-sm font-bold text-slate-900 dark:text-white">
                {opt.title}
              </p>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{opt.desc}</p>
            </button>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap gap-6">
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={hero.showNeuralCanvas}
              onChange={(e) => update({ showNeuralCanvas: e.target.checked })}
              className="h-4 w-4 accent-cyan-500"
            />
            Mostrar animación de red neuronal de fondo
          </label>
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={hero.card.visible}
              onChange={(e) => update({ card: { ...hero.card, visible: e.target.checked } })}
              className="h-4 w-4 accent-cyan-500"
            />
            Mostrar tarjeta lateral con emblema
          </label>
        </div>
      </div>

      {/* Main Headline & Badge */}
      <div className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 dark:border-white/10 dark:bg-[#0b1229]">
        <h2 className="font-display text-xl font-bold">Textos Principales de la Portada</h2>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
            Etiqueta superior (Badge)
          </label>
          <input
            type="text"
            value={hero.badgeText}
            onChange={(e) => update({ badgeText: e.target.value })}
            className="mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm dark:border-white/15 dark:bg-white/5 dark:text-white"
          />
        </div>

        <IconPicker
          label="Ícono de la etiqueta superior"
          value={hero.badgeIcon}
          onChange={(badgeIcon) => update({ badgeIcon })}
        />

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
              Título — Inicio
            </label>
            <input
              type="text"
              value={hero.titlePrefix}
              onChange={(e) => update({ titlePrefix: e.target.value })}
              className="mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm dark:border-white/15 dark:bg-white/5 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-cyan-600 dark:text-cyan-400">
              Título — Parte Resaltada (Degradado)
            </label>
            <input
              type="text"
              value={hero.titleHighlight}
              onChange={(e) => update({ titleHighlight: e.target.value })}
              className="mt-1.5 w-full rounded-xl border border-cyan-400/50 bg-slate-50 px-4 py-2.5 text-sm font-semibold dark:bg-white/5 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
              Título — Final
            </label>
            <input
              type="text"
              value={hero.titleSuffix}
              onChange={(e) => update({ titleSuffix: e.target.value })}
              className="mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm dark:border-white/15 dark:bg-white/5 dark:text-white"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
            Descripción / Subtítulo
          </label>
          <textarea
            rows={3}
            value={hero.subtitle}
            onChange={(e) => update({ subtitle: e.target.value })}
            className="mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm dark:border-white/15 dark:bg-white/5 dark:text-white"
          />
        </div>

        {/* Buttons */}
        <div className="grid gap-4 border-t border-slate-200 pt-5 md:grid-cols-2 dark:border-white/10">
          <div className="space-y-3 rounded-2xl border border-slate-200 p-4 dark:border-white/10">
            <label className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
              <input
                type="checkbox"
                checked={hero.primaryCta.visible}
                onChange={(e) =>
                  update({ primaryCta: { ...hero.primaryCta, visible: e.target.checked } })
                }
                className="h-4 w-4 accent-cyan-500"
              />
              Botón Principal
            </label>
            <input
              type="text"
              value={hero.primaryCta.label}
              onChange={(e) =>
                update({ primaryCta: { ...hero.primaryCta, label: e.target.value } })
              }
              placeholder="Texto del botón"
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm dark:border-white/15 dark:bg-white/5"
            />
            <input
              type="text"
              value={hero.primaryCta.to}
              onChange={(e) => update({ primaryCta: { ...hero.primaryCta, to: e.target.value } })}
              placeholder="/investigacion"
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-xs dark:border-white/15 dark:bg-white/5"
            />
          </div>

          <div className="space-y-3 rounded-2xl border border-slate-200 p-4 dark:border-white/10">
            <label className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
              <input
                type="checkbox"
                checked={hero.secondaryCta.visible}
                onChange={(e) =>
                  update({ secondaryCta: { ...hero.secondaryCta, visible: e.target.checked } })
                }
                className="h-4 w-4 accent-cyan-500"
              />
              Botón Secundario
            </label>
            <input
              type="text"
              value={hero.secondaryCta.label}
              onChange={(e) =>
                update({ secondaryCta: { ...hero.secondaryCta, label: e.target.value } })
              }
              placeholder="Texto del botón"
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm dark:border-white/15 dark:bg-white/5"
            />
            <input
              type="text"
              value={hero.secondaryCta.to}
              onChange={(e) =>
                update({ secondaryCta: { ...hero.secondaryCta, to: e.target.value } })
              }
              placeholder="/nosotros"
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-xs dark:border-white/15 dark:bg-white/5"
            />
          </div>
        </div>
      </div>

      {/* Bottom Metrics */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 dark:border-white/10 dark:bg-[#0b1229]">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-xl font-bold">Métricas inferiores de la portada</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Agrega, edita o quita los datos rápidos debajo de los botones (ej. 4, M·D, UAZ).
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              update({
                metrics: [...hero.metrics, { value: '100%', label: 'Nuevo indicador' }],
              })
            }
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white dark:bg-cyan-500 dark:text-slate-950"
          >
            <Plus className="h-3.5 w-3.5" />
            Agregar métrica
          </button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {hero.metrics.map((m, idx) => (
            <div
              key={idx}
              className="space-y-2 rounded-2xl border border-slate-200 p-3 dark:border-white/10"
            >
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={m.value}
                  onChange={(e) =>
                    update({
                      metrics: hero.metrics.map((item, i) =>
                        i === idx ? { ...item, value: e.target.value } : item,
                      ),
                    })
                  }
                  className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 font-display text-sm font-bold dark:border-white/15 dark:bg-white/5"
                />
                <button
                  type="button"
                  onClick={() =>
                    update({ metrics: hero.metrics.filter((_, i) => i !== idx) })
                  }
                  className="rounded-lg p-1.5 text-rose-400 hover:bg-rose-500/10 hover:text-rose-500"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <input
                type="text"
                value={m.label}
                onChange={(e) =>
                  update({
                    metrics: hero.metrics.map((item, i) =>
                      i === idx ? { ...item, label: e.target.value } : item,
                    ),
                  })
                }
                className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs dark:border-white/15 dark:bg-white/5"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Showcase Card */}
      <div className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 dark:border-white/10 dark:bg-[#0b1229]">
        <h2 className="font-display text-xl font-bold">Tarjeta Destacada (Emblema / Imagen)</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
              Encabezado izquierdo (ej. LIAA // NODE_UAZ)
            </label>
            <input
              type="text"
              value={hero.card.headerLeft}
              onChange={(e) => update({ card: { ...hero.card, headerLeft: e.target.value } })}
              className="mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2 font-mono text-xs dark:border-white/15 dark:bg-white/5"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
              Encabezado derecho (ej. PITEC · IA)
            </label>
            <input
              type="text"
              value={hero.card.headerRight}
              onChange={(e) => update({ card: { ...hero.card, headerRight: e.target.value } })}
              className="mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2 font-mono text-xs dark:border-white/15 dark:bg-white/5"
            />
          </div>
        </div>

        <ImageField
          label="Imagen / Emblema dentro de la tarjeta"
          value={hero.card.image}
          onChange={(url) => update({ card: { ...hero.card, image: url } })}
          images={images}
          onUploaded={onUploaded}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 rounded-2xl border border-slate-200 p-4 dark:border-white/10">
            <label className="block text-[11px] font-semibold uppercase text-sky-700 dark:text-cyan-400">
              Mini-tarjeta izquierda
            </label>
            <input
              type="text"
              value={hero.card.stat1Label}
              onChange={(e) => update({ card: { ...hero.card, stat1Label: e.target.value } })}
              placeholder="Etiqueta"
              className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 font-mono text-xs dark:border-white/15 dark:bg-white/5"
            />
            <input
              type="text"
              value={hero.card.stat1Value}
              onChange={(e) => update({ card: { ...hero.card, stat1Value: e.target.value } })}
              placeholder="Valor"
              className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-sm font-semibold dark:border-white/15 dark:bg-white/5"
            />
          </div>

          <div className="space-y-2 rounded-2xl border border-slate-200 p-4 dark:border-white/10">
            <label className="block text-[11px] font-semibold uppercase text-violet-700 dark:text-violet-300">
              Mini-tarjeta derecha
            </label>
            <input
              type="text"
              value={hero.card.stat2Label}
              onChange={(e) => update({ card: { ...hero.card, stat2Label: e.target.value } })}
              placeholder="Etiqueta"
              className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 font-mono text-xs dark:border-white/15 dark:bg-white/5"
            />
            <input
              type="text"
              value={hero.card.stat2Value}
              onChange={(e) => update({ card: { ...hero.card, stat2Value: e.target.value } })}
              placeholder="Valor"
              className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-sm font-semibold dark:border-white/15 dark:bg-white/5"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

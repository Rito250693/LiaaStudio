import { useEffect, useState, type ReactNode } from 'react';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Check,
  Loader2,
  Pencil,
  RotateCcw,
  Type,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useContent } from '../context/ContentContext';
import type { EditableTextStyle, FontFamilyKey, PageTextOverride } from '../data/siteData';
import {
  buildHeadingInlineStyle,
  FONT_OPTIONS,
  getFontCssFamily,
  getHeadingSizeClasses,
  getHeadingWeightClass,
  getTextAlignClass,
} from '../utils/typography';

export interface ResolvedTextValues {
  eyebrow: string;
  title: string;
  subtitle: string;
  style?: EditableTextStyle;
  isEditing: boolean;
}

export function useResolvedPageText(
  textKey: string | undefined,
  defaults: { eyebrow?: string; title: string; subtitle?: string },
): ResolvedTextValues {
  const { content } = useContent();
  const { hasPermission, editMode } = useAuth();
  const override = textKey ? content.pageTexts?.[textKey] : undefined;
  const isEditing = Boolean(textKey && editMode && hasPermission(['site.design', 'site.pages']));

  return {
    eyebrow: override?.eyebrow !== undefined ? override.eyebrow : defaults.eyebrow || '',
    title: override?.title !== undefined ? override.title : defaults.title,
    subtitle: override?.subtitle !== undefined ? override.subtitle : defaults.subtitle || '',
    style: override?.style,
    isEditing,
  };
}

interface TextEditorModalProps {
  open: boolean;
  onClose: () => void;
  label?: string;
  initialEyebrow?: string;
  initialTitle: string;
  initialSubtitle?: string;
  initialStyle?: EditableTextStyle;
  showEyebrow?: boolean;
  showSubtitle?: boolean;
  showAlign?: boolean;
  onSave: (next: PageTextOverride) => Promise<void>;
  onReset: () => Promise<void>;
}

const SIZE_OPTIONS: Array<{ value: NonNullable<EditableTextStyle['fontSize']>; label: string }> = [
  { value: 'sm', label: 'Pequeño' },
  { value: 'md', label: 'Normal' },
  { value: 'lg', label: 'Grande' },
  { value: 'xl', label: 'Muy grande' },
  { value: '2xl', label: 'Extra' },
];

const WEIGHT_OPTIONS: Array<{
  value: NonNullable<EditableTextStyle['fontWeight']>;
  label: string;
}> = [
  { value: 'normal', label: 'Normal' },
  { value: 'medium', label: 'Medio' },
  { value: 'semibold', label: 'Semibold' },
  { value: 'bold', label: 'Negrita' },
  { value: 'extrabold', label: 'Extra' },
];

const QUICK_COLORS = [
  { label: 'Tema', value: '' },
  { label: 'Blanco', value: '#ffffff' },
  { label: 'Oscuro', value: '#0f172a' },
  { label: 'Cian LIAA', value: '#22d3ee' },
  { label: 'Azul UAZ', value: '#2563eb' },
  { label: 'Violeta', value: '#a855f7' },
  { label: 'Ámbar', value: '#f59e0b' },
];

export function InlineTextEditorModal({
  open,
  onClose,
  label = 'Editar texto y tipografía',
  initialEyebrow = '',
  initialTitle,
  initialSubtitle = '',
  initialStyle,
  showEyebrow = true,
  showSubtitle = true,
  showAlign = true,
  onSave,
  onReset,
}: TextEditorModalProps) {
  const [eyebrow, setEyebrow] = useState(initialEyebrow);
  const [title, setTitle] = useState(initialTitle);
  const [subtitle, setSubtitle] = useState(initialSubtitle);
  const [fontFamily, setFontFamily] = useState<FontFamilyKey | 'inherit'>(
    initialStyle?.fontFamily || 'inherit',
  );
  const [fontSize, setFontSize] = useState<EditableTextStyle['fontSize']>(
    initialStyle?.fontSize || 'md',
  );
  const [fontWeight, setFontWeight] = useState<EditableTextStyle['fontWeight']>(
    initialStyle?.fontWeight || 'bold',
  );
  const [align, setAlign] = useState<EditableTextStyle['align']>(initialStyle?.align || 'left');
  const [color, setColor] = useState(initialStyle?.color || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setEyebrow(initialEyebrow);
    setTitle(initialTitle);
    setSubtitle(initialSubtitle);
    setFontFamily(initialStyle?.fontFamily || 'inherit');
    setFontSize(initialStyle?.fontSize || 'md');
    setFontWeight(initialStyle?.fontWeight || 'bold');
    setAlign(initialStyle?.align || 'left');
    setColor(initialStyle?.color || '');
    setError(null);
  }, [open, initialEyebrow, initialTitle, initialSubtitle, initialStyle]);

  if (!open) return null;

  const previewStyle = buildHeadingInlineStyle({
    fontFamily,
    color: color || undefined,
  });

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSave({
        eyebrow: showEyebrow ? eyebrow : undefined,
        title,
        subtitle: showSubtitle ? subtitle : undefined,
        style: {
          fontFamily,
          fontSize,
          fontWeight,
          align: showAlign ? align : undefined,
          color: color || undefined,
        },
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el cambio.');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setSaving(true);
    setError(null);
    try {
      await onReset();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo restablecer.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
    >
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-cyan-400/30 bg-white p-6 text-left text-slate-900 shadow-2xl dark:bg-[#0b1229] dark:text-slate-100">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-4 dark:border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-600 dark:text-cyan-300">
              <Type className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-display text-base font-bold">{label}</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Los cambios se guardan directamente en el portal del LIAA.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Live Preview */}
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-[#060b1a]">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-slate-400">
            Vista previa en vivo
          </p>
          <div className={getTextAlignClass(showAlign ? align : 'left')}>
            {showEyebrow && eyebrow && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/25 bg-sky-500/10 px-2.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-widest text-sky-700 dark:border-cyan-400/25 dark:bg-cyan-400/10 dark:text-cyan-300">
                {eyebrow}
              </span>
            )}
            <p
              style={previewStyle}
              className={`mt-2 tracking-tight text-slate-900 dark:text-white ${getHeadingWeightClass(fontWeight)} ${
                fontSize === 'sm'
                  ? 'text-lg'
                  : fontSize === 'lg'
                    ? 'text-2xl'
                    : fontSize === 'xl' || fontSize === '2xl'
                      ? 'text-3xl'
                      : 'text-xl'
              }`}
            >
              {title || '(Sin título)'}
            </p>
            {showSubtitle && subtitle && (
              <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {/* Text Fields */}
        <div className="mt-5 space-y-4">
          {showEyebrow && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                Etiqueta superior (Eyebrow)
              </label>
              <input
                type="text"
                value={eyebrow}
                onChange={(e) => setEyebrow(e.target.value)}
                placeholder="Ej. Sobre el Laboratorio"
                className="mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-cyan-500 focus:bg-white focus:outline-none dark:border-white/15 dark:bg-white/5 dark:text-white dark:focus:bg-[#0f1936]"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
              Título principal
            </label>
            <textarea
              rows={2}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Escribe el título..."
              className="mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-cyan-500 focus:bg-white focus:outline-none dark:border-white/15 dark:bg-white/5 dark:text-white dark:focus:bg-[#0f1936]"
            />
          </div>

          {showSubtitle && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                Descripción / Subtítulo
              </label>
              <textarea
                rows={3}
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                placeholder="Descripción opcional debajo del título..."
                className="mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-cyan-500 focus:bg-white focus:outline-none dark:border-white/15 dark:bg-white/5 dark:text-white dark:focus:bg-[#0f1936]"
              />
            </div>
          )}

          {/* Typography Picker */}
          <div className="rounded-2xl border border-slate-200 p-4 dark:border-white/10">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
              Tipografía del título
            </label>
            <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => setFontFamily('inherit')}
                className={`rounded-xl border px-3 py-2 text-left text-xs transition ${
                  fontFamily === 'inherit'
                    ? 'border-cyan-400 bg-cyan-500/15 font-semibold text-sky-700 dark:text-cyan-300'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-cyan-400/50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300'
                }`}
              >
                <span className="block font-semibold">Global del sitio</span>
                <span className="text-[10px] opacity-70">Heredar fuente</span>
              </button>
              {FONT_OPTIONS.map((font) => (
                <button
                  key={font.key}
                  type="button"
                  onClick={() => setFontFamily(font.key)}
                  className={`rounded-xl border px-3 py-2 text-left text-xs transition ${
                    fontFamily === font.key
                      ? 'border-cyan-400 bg-cyan-500/15 text-sky-700 dark:text-cyan-300'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-cyan-400/50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300'
                  }`}
                >
                  <span
                    style={{ fontFamily: getFontCssFamily(font.key) }}
                    className="block truncate text-sm font-bold"
                  >
                    {font.label}
                  </span>
                  <span className="text-[10px] opacity-70">{font.category}</span>
                </button>
              ))}
            </div>

            {/* Size + Weight + Align */}
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Tamaño
                </label>
                <select
                  value={fontSize}
                  onChange={(e) => setFontSize(e.target.value as EditableTextStyle['fontSize'])}
                  className="mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-900 dark:border-white/15 dark:bg-[#070c1c] dark:text-white"
                >
                  {SIZE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Grosor
                </label>
                <select
                  value={fontWeight}
                  onChange={(e) =>
                    setFontWeight(e.target.value as EditableTextStyle['fontWeight'])
                  }
                  className="mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-900 dark:border-white/15 dark:bg-[#070c1c] dark:text-white"
                >
                  {WEIGHT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {showAlign && (
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Alineación
                  </label>
                  <div className="mt-1.5 flex gap-1">
                    {(
                      [
                        { v: 'left', icon: AlignLeft, t: 'Izquierda' },
                        { v: 'center', icon: AlignCenter, t: 'Centro' },
                        { v: 'right', icon: AlignRight, t: 'Derecha' },
                      ] as const
                    ).map(({ v, icon: Icon, t }) => (
                      <button
                        key={v}
                        type="button"
                        title={t}
                        onClick={() => setAlign(v)}
                        className={`flex flex-1 items-center justify-center rounded-xl border py-2 ${
                          align === v
                            ? 'border-cyan-400 bg-cyan-500/15 text-cyan-600 dark:text-cyan-300'
                            : 'border-slate-200 text-slate-500 dark:border-white/10 dark:text-slate-400'
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Color Picker */}
            <div className="mt-4">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Color del título
              </label>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                {QUICK_COLORS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setColor(preset.value)}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-medium transition ${
                      color === preset.value
                        ? 'border-cyan-400 bg-cyan-500/15 text-sky-700 dark:text-cyan-300'
                        : 'border-slate-200 text-slate-600 dark:border-white/10 dark:text-slate-300'
                    }`}
                  >
                    {preset.value && (
                      <span
                        className="h-3 w-3 rounded-full border border-slate-400/50"
                        style={{ backgroundColor: preset.value }}
                      />
                    )}
                    {preset.label}
                  </button>
                ))}
                <input
                  type="color"
                  value={color || '#22d3ee'}
                  onChange={(e) => setColor(e.target.value)}
                  title="Elegir color personalizado"
                  className="h-7 w-9 cursor-pointer rounded-lg border border-slate-300 bg-transparent p-0.5 dark:border-white/15"
                />
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-xs font-medium text-rose-600 dark:text-rose-300">
            {error}
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-4 dark:border-white/10">
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleReset()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:border-white/15 dark:text-slate-300 dark:hover:bg-white/10"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Restablecer original
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={onClose}
              className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:border-white/15 dark:text-slate-300 dark:hover:bg-white/10"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSave()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#0845ff] to-[#029be6] px-5 py-2 text-xs font-semibold text-white shadow-md hover:brightness-110 disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface EditableWrapperProps {
  enabled: boolean;
  onEdit: () => void;
  buttonLabel?: string;
  children: ReactNode;
  className?: string;
}

export function EditableOutline({
  enabled,
  onEdit,
  buttonLabel = 'Editar texto y tipografía',
  children,
  className = '',
}: EditableWrapperProps) {
  if (!enabled) return <>{children}</>;

  return (
    <div
      className={`group/txt relative rounded-2xl p-2 -m-2 ring-1 ring-dashed ring-cyan-400/50 transition hover:bg-cyan-500/[0.04] hover:ring-cyan-400 ${className}`}
    >
      <div className="mb-2 flex justify-end">
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onEdit();
          }}
          className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-400 px-2.5 py-1 text-[11px] font-bold text-slate-950 shadow-md transition hover:bg-cyan-300"
        >
          <Pencil className="h-3 w-3" />
          {buttonLabel}
        </button>
      </div>
      <div
        onDoubleClick={(e) => {
          e.preventDefault();
          onEdit();
        }}
        title="Doble clic para editar este texto y su tipografía"
        className="cursor-pointer"
      >
        {children}
      </div>
    </div>
  );
}

interface EditableHeadingRegionProps {
  textKey: string;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  showEyebrow?: boolean;
  showSubtitle?: boolean;
  variant?: 'section' | 'card';
  eyebrowSlot?: (resolvedEyebrow: string) => ReactNode;
  subtitleClassName?: string;
}

export function EditableHeadingRegion({
  textKey,
  eyebrow = '',
  title,
  subtitle = '',
  showEyebrow = Boolean(eyebrow),
  showSubtitle = Boolean(subtitle),
  variant = 'card',
  eyebrowSlot,
  subtitleClassName = 'mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400',
}: EditableHeadingRegionProps) {
  const { savePageText } = useContent();
  const resolved = useResolvedPageText(textKey, { eyebrow, title, subtitle });
  const [open, setOpen] = useState(false);

  const headingStyle = buildHeadingInlineStyle(resolved.style);
  const sizeClass = getHeadingSizeClasses(resolved.style?.fontSize, variant);
  const weightClass = getHeadingWeightClass(resolved.style?.fontWeight);
  const alignClass = getTextAlignClass(resolved.style?.align);

  return (
    <>
      <EditableOutline enabled={resolved.isEditing} onEdit={() => setOpen(true)}>
        <div className={alignClass}>
          {showEyebrow &&
            resolved.eyebrow &&
            (eyebrowSlot ? (
              eyebrowSlot(resolved.eyebrow)
            ) : (
              <span className="font-mono text-xs font-semibold uppercase tracking-widest text-sky-700 dark:text-cyan-400">
                {resolved.eyebrow}
              </span>
            ))}
          <h2
            style={headingStyle}
            className={`${showEyebrow && resolved.eyebrow ? 'mt-3' : ''} font-display tracking-tight text-slate-900 dark:text-white ${sizeClass} ${weightClass}`}
          >
            {resolved.title}
          </h2>
          {showSubtitle && resolved.subtitle && (
            <p className={subtitleClassName}>{resolved.subtitle}</p>
          )}
        </div>
      </EditableOutline>

      <InlineTextEditorModal
        open={open}
        onClose={() => setOpen(false)}
        initialEyebrow={resolved.eyebrow}
        initialTitle={resolved.title}
        initialSubtitle={resolved.subtitle}
        initialStyle={resolved.style}
        showEyebrow={showEyebrow}
        showSubtitle={showSubtitle}
        onSave={async (next) => {
          await savePageText(textKey, next);
        }}
        onReset={async () => {
          await savePageText(textKey, {});
        }}
      />
    </>
  );
}

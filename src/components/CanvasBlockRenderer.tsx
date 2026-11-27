import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Image as ImageIcon,
  Loader2,
  MousePointerClick,
  Move,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
  Type,
  Upload,
} from 'lucide-react';
import type { CanvasElement, CustomBlock } from '../data/siteData';
import { DynamicIcon, ICON_OPTIONS } from './DynamicIcon';
import { SectionHeader } from './SectionHeader';
import { uploadAdminImage } from '../utils/imageUpload';

type SaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

interface CanvasBlockRendererProps {
  block: CustomBlock;
  editable?: boolean;
  /** Called ONLY when a drag ends or an edit settles (never on pointermove) */
  onChangeBlock?: (next: CustomBlock) => void | Promise<void>;
}

export function CanvasBlockRenderer({
  block,
  editable = false,
  onChangeBlock,
}: CanvasBlockRendererProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Local state keeps drag & inspector editing 100% fluid without spamming the server
  const [localBlock, setLocalBlock] = useState<CustomBlock>(block);
  const localBlockRef = useRef<CustomBlock>(block);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Serialized save queue + status indicator so simultaneous PUTs never happen
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const isDraggingRef = useRef(false);
  const isSavingRef = useRef(false);
  const queuedBlockRef = useRef<CustomBlock | null>(null);
  const debounceTimerRef = useRef<number | null>(null);

  // Sync external prop updates only when not dragging and not holding unsaved local error
  useEffect(() => {
    if (!isDraggingRef.current && saveStatus !== 'error' && saveStatus !== 'saving') {
      setLocalBlock(block);
      localBlockRef.current = block;
    }
  }, [block, saveStatus]);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        window.clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const commitToParent = useCallback(
    async (snapshot: CustomBlock) => {
      if (!onChangeBlock) return;
      if (isSavingRef.current) {
        // Queue only the latest snapshot; never run overlapping saves
        queuedBlockRef.current = snapshot;
        return;
      }

      isSavingRef.current = true;
      setSaveStatus('saving');
      setSaveError(null);

      try {
        await onChangeBlock(snapshot);
        setSaveStatus('saved');
        window.setTimeout(() => {
          setSaveStatus((prev) => (prev === 'saved' ? 'idle' : prev));
        }, 2000);
      } catch (err) {
        // Keep localBlock intact so user never loses changes on network/conflict failure
        setSaveStatus('error');
        setSaveError(err instanceof Error ? err.message : 'Error al guardar el lienzo.');
      } finally {
        isSavingRef.current = false;
        const queued = queuedBlockRef.current;
        if (queued) {
          queuedBlockRef.current = null;
          void commitToParent(queued);
        }
      }
    },
    [onChangeBlock],
  );

  const scheduleDebouncedCommit = useCallback(
    (nextBlock: CustomBlock) => {
      setSaveStatus('pending');
      if (debounceTimerRef.current) {
        window.clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = window.setTimeout(() => {
        debounceTimerRef.current = null;
        void commitToParent(nextBlock);
      }, 450);
    },
    [commitToParent],
  );

  const applyLocal = (nextBlock: CustomBlock, mode: 'immediate' | 'debounced' | 'local-only') => {
    localBlockRef.current = nextBlock;
    setLocalBlock(nextBlock);
    if (mode === 'immediate') {
      if (debounceTimerRef.current) {
        window.clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      void commitToParent(nextBlock);
    } else if (mode === 'debounced') {
      scheduleDebouncedCommit(nextBlock);
    } else {
      setSaveStatus('pending');
    }
  };

  const elements = localBlock.elements || [];
  const height = localBlock.canvasHeight || 460;
  const selectedEl = elements.find((el) => el.id === selectedId) || null;

  const updateElements = (
    nextElements: CanvasElement[],
    mode: 'immediate' | 'debounced' | 'local-only',
  ) => {
    applyLocal({ ...localBlockRef.current, elements: nextElements }, mode);
  };

  const updateElement = (
    id: string,
    patch: Partial<CanvasElement>,
    mode: 'immediate' | 'debounced' | 'local-only',
  ) => {
    const curr = localBlockRef.current.elements || [];
    updateElements(
      curr.map((el) => (el.id === id ? { ...el, ...patch } : el)),
      mode,
    );
  };

  const addElement = (type: CanvasElement['type']) => {
    const id = `el-${Date.now().toString(36)}`;
    let next: CanvasElement;
    if (type === 'text') {
      next = {
        id,
        type: 'text',
        x: 10,
        y: 15,
        width: 340,
        text: 'Haz clic y arrastra este texto a donde quieras',
        fontSize: 22,
        color: '#ffffff',
      };
    } else if (type === 'icon') {
      next = {
        id,
        type: 'icon',
        x: 45,
        y: 25,
        width: 56,
        icon: 'brain',
        color: '#00d4ff',
      };
    } else if (type === 'image') {
      next = {
        id,
        type: 'image',
        x: 55,
        y: 18,
        width: 260,
        image: '/images/pitec-building.jpg',
      };
    } else {
      next = {
        id,
        type: 'button',
        x: 12,
        y: 65,
        width: 200,
        text: 'Inscribirme ahora',
        href: '/contacto',
      };
    }
    updateElements([...elements, next], 'immediate');
    setSelectedId(id);
  };

  const deleteElement = (id: string) => {
    updateElements(
      elements.filter((el) => el.id !== id),
      'immediate',
    );
    if (selectedId === id) setSelectedId(null);
  };

  const startDrag = (e: ReactPointerEvent, el: CanvasElement) => {
    if (!editable || !containerRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    setSelectedId(el.id);

    const rect = containerRef.current.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const origX = el.x;
    const origY = el.y;
    let moved = false;
    isDraggingRef.current = true;

    const onMove = (ev: globalThis.PointerEvent) => {
      const dxPct = ((ev.clientX - startX) / rect.width) * 100;
      const dyPct = ((ev.clientY - startY) / rect.height) * 100;
      const nextX = Math.max(0, Math.min(92, Math.round((origX + dxPct) * 10) / 10));
      const nextY = Math.max(0, Math.min(90, Math.round((origY + dyPct) * 10) / 10));
      if (nextX !== origX || nextY !== origY) moved = true;
      // Local state ONLY during pointermove — ZERO network calls while dragging!
      updateElement(el.id, { x: nextX, y: nextY }, 'local-only');
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      isDraggingRef.current = false;
      // Commit ONE single save when drag completes (if coordinates actually changed)
      if (moved) {
        void commitToParent(localBlockRef.current);
      } else if (saveStatus === 'pending') {
        setSaveStatus('idle');
      }
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const handleImageUploadForSelected = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedEl) return;
    setUploading(true);
    setUploadError(null);
    try {
      const result = await uploadAdminImage(file);
      updateElement(selectedEl.id, { image: result.image.url }, 'immediate');
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Error al subir la imagen.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      {(localBlock.eyebrow || localBlock.title) && (
        <div className="mb-8">
          <SectionHeader
            textKey={`block.${localBlock.id}`}
            eyebrow={localBlock.eyebrow || 'Diseño Libre'}
            title={localBlock.title}
            description={localBlock.subtitle}
          />
        </div>
      )}

      {/* Visual Toolbar when editing */}
      {editable && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-cyan-500/30 bg-[#070d20] p-3 text-xs text-slate-100 shadow-lg">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold text-cyan-300">
              <Move className="h-3.5 w-3.5" />
              Lienzo Libre:
            </span>
            <button
              type="button"
              onClick={() => addElement('text')}
              className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-2.5 py-1.5 font-semibold hover:bg-cyan-400 hover:text-slate-950"
            >
              <Type className="h-3.5 w-3.5" />+ Texto
            </button>
            <button
              type="button"
              onClick={() => addElement('icon')}
              className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-2.5 py-1.5 font-semibold hover:bg-cyan-400 hover:text-slate-950"
            >
              <Sparkles className="h-3.5 w-3.5" />+ Ícono
            </button>
            <button
              type="button"
              onClick={() => addElement('image')}
              className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-2.5 py-1.5 font-semibold hover:bg-cyan-400 hover:text-slate-950"
            >
              <ImageIcon className="h-3.5 w-3.5" />+ Imagen
            </button>
            <button
              type="button"
              onClick={() => addElement('button')}
              className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-2.5 py-1.5 font-semibold hover:bg-cyan-400 hover:text-slate-950"
            >
              <MousePointerClick className="h-3.5 w-3.5" />+ Botón
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Save status pill */}
            {saveStatus === 'saving' && (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-500/20 px-2.5 py-1 font-mono text-[11px] text-cyan-300">
                <Loader2 className="h-3 w-3 animate-spin" />
                Guardando...
              </span>
            )}
            {saveStatus === 'pending' && (
              <span className="rounded-lg bg-amber-500/20 px-2.5 py-1 font-mono text-[11px] text-amber-300">
                Cambios pendientes...
              </span>
            )}
            {saveStatus === 'saved' && (
              <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/20 px-2.5 py-1 font-mono text-[11px] text-emerald-300">
                <Check className="h-3 w-3" />
                Guardado
              </span>
            )}
            {saveStatus === 'error' && (
              <button
                type="button"
                onClick={() => void commitToParent(localBlockRef.current)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-rose-400/50 bg-rose-500/20 px-2.5 py-1 font-mono text-[11px] font-semibold text-rose-200 hover:bg-rose-500/30"
                title={saveError || 'Error al guardar'}
              >
                <AlertTriangle className="h-3 w-3" />
                Error al guardar
                <RotateCcw className="h-3 w-3" />
                Reintentar
              </button>
            )}

            <div className="flex items-center gap-2">
              <label className="text-[11px] text-slate-400">Alto:</label>
              <input
                type="range"
                min={260}
                max={820}
                step={20}
                value={height}
                onChange={(e) =>
                  applyLocal({ ...localBlockRef.current, canvasHeight: Number(e.target.value) }, 'debounced')
                }
                className="w-24 accent-cyan-400"
              />
              <span className="font-mono text-[11px] text-cyan-300">{height}px</span>
            </div>
          </div>
        </div>
      )}

      {editable && saveStatus === 'error' && saveError && (
        <div className="mb-3 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-2.5 text-xs text-rose-300">
          {saveError} Tus cambios siguen conservados en pantalla; pulsa &quot;Reintentar&quot;
          cuando restablezcas la conexión.
        </div>
      )}

      {/* Free-Position Canvas Surface */}
      <div
        ref={containerRef}
        onClick={() => setSelectedId(null)}
        style={{ minHeight: `${height}px` }}
        className={`relative w-full overflow-hidden rounded-3xl border bg-gradient-to-br from-slate-900 via-[#0a1228] to-[#070d1f] shadow-xl ${
          editable
            ? 'bg-tech-grid border-cyan-400/50 select-none'
            : 'border-slate-200 dark:border-cyan-400/20'
        }`}
      >
        {elements.length === 0 && editable && (
          <div className="flex h-full min-h-[280px] flex-col items-center justify-center p-8 text-center text-slate-400">
            <Plus className="h-8 w-8 text-cyan-400" />
            <p className="mt-2 text-sm font-medium text-white">
              Usa los botones de arriba para agregar textos, íconos, imágenes o botones y
              arrástralos libremente aquí.
            </p>
          </div>
        )}

        {elements.map((el) => {
          const isSelected = editable && selectedId === el.id;

          return (
            <div
              key={el.id}
              onPointerDown={(e) => startDrag(e, el)}
              onClick={(e) => {
                if (editable) {
                  e.stopPropagation();
                  setSelectedId(el.id);
                }
              }}
              style={{
                left: `${el.x}%`,
                top: `${el.y}%`,
                maxWidth: el.type === 'text' || el.type === 'image' ? `${el.width}px` : undefined,
              }}
              className={`absolute transition-shadow ${
                editable
                  ? `cursor-move rounded-xl p-1.5 ${
                      isSelected
                        ? 'z-20 ring-2 ring-cyan-400 bg-cyan-400/10'
                        : 'z-10 hover:ring-1 hover:ring-cyan-400/50'
                    }`
                  : ''
              }`}
            >
              {el.type === 'text' && (
                <p
                  style={{
                    fontSize: `${el.fontSize || 20}px`,
                    color: el.color || '#ffffff',
                    width: `${el.width}px`,
                  }}
                  className="font-display font-bold leading-snug break-words"
                >
                  {el.text}
                </p>
              )}

              {el.type === 'icon' && (
                <div
                  style={{ color: el.color || '#00d4ff' }}
                  className="flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 p-3 backdrop-blur"
                >
                  <span
                    style={{ width: el.width, height: el.width }}
                    className="flex items-center justify-center"
                  >
                    <DynamicIcon name={el.icon || 'brain'} className="h-full w-full" />
                  </span>
                </div>
              )}

              {el.type === 'image' && (
                <img
                  src={el.image || '/images/pitec-building.jpg'}
                  alt="Elemento visual"
                  draggable={false}
                  style={{ width: `${el.width}px` }}
                  className="rounded-2xl border border-white/15 object-cover shadow-lg"
                />
              )}

              {el.type === 'button' &&
                (editable ? (
                  <span className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#0845ff] to-[#029be6] px-5 py-3 text-sm font-semibold text-white shadow-lg">
                    {el.text || 'Botón'}
                    <ArrowRight className="h-4 w-4" />
                  </span>
                ) : /^https?:\/\//i.test(el.href || '') ? (
                  <a
                    href={el.href}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#0845ff] to-[#029be6] px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:brightness-110"
                  >
                    {el.text || 'Botón'}
                    <ArrowRight className="h-4 w-4" />
                  </a>
                ) : (
                  <Link
                    to={el.href || '/contacto'}
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#0845ff] to-[#029be6] px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:brightness-110"
                  >
                    {el.text || 'Botón'}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                ))}
            </div>
          );
        })}
      </div>

      {/* Selected Element Properties Inspector */}
      {editable && selectedEl && (
        <div className="mt-4 space-y-4 rounded-2xl border border-cyan-400/30 bg-[#0b1229] p-4 text-xs text-slate-100 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="font-mono font-semibold uppercase tracking-wider text-cyan-300">
              Editando: {selectedEl.type} (X: {selectedEl.x}% · Y: {selectedEl.y}%)
            </span>
            <button
              type="button"
              onClick={() => deleteElement(selectedEl.id)}
              className="inline-flex items-center gap-1 rounded-lg bg-rose-500/20 px-2.5 py-1 font-semibold text-rose-300 hover:bg-rose-500/30"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Eliminar
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {(selectedEl.type === 'text' || selectedEl.type === 'button') && (
              <div className="sm:col-span-2">
                <label className="text-[11px] text-slate-400">Texto</label>
                <input
                  type="text"
                  value={selectedEl.text || ''}
                  onChange={(e) => updateElement(selectedEl.id, { text: e.target.value }, 'debounced')}
                  className="mt-1 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-white"
                />
              </div>
            )}

            {selectedEl.type === 'button' && (
              <div>
                <label className="text-[11px] text-slate-400">Enlace</label>
                <input
                  type="text"
                  value={selectedEl.href || ''}
                  onChange={(e) => updateElement(selectedEl.id, { href: e.target.value }, 'debounced')}
                  placeholder="/contacto o https://..."
                  className="mt-1 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 font-mono text-white"
                />
              </div>
            )}

            {selectedEl.type === 'text' && (
              <>
                <div>
                  <label className="text-[11px] text-slate-400">
                    Tamaño texto ({selectedEl.fontSize || 20}px)
                  </label>
                  <input
                    type="range"
                    min={12}
                    max={54}
                    value={selectedEl.fontSize || 20}
                    onChange={(e) =>
                      updateElement(selectedEl.id, { fontSize: Number(e.target.value) }, 'debounced')
                    }
                    className="mt-2 w-full accent-cyan-400"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400">
                    Ancho caja ({selectedEl.width}px)
                  </label>
                  <input
                    type="range"
                    min={120}
                    max={720}
                    step={10}
                    value={selectedEl.width}
                    onChange={(e) =>
                      updateElement(selectedEl.id, { width: Number(e.target.value) }, 'debounced')
                    }
                    className="mt-2 w-full accent-cyan-400"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400">Color</label>
                  <input
                    type="color"
                    value={selectedEl.color || '#ffffff'}
                    onChange={(e) => updateElement(selectedEl.id, { color: e.target.value }, 'debounced')}
                    className="mt-1 block h-8 w-16 cursor-pointer rounded bg-transparent"
                  />
                </div>
              </>
            )}

            {selectedEl.type === 'icon' && (
              <>
                <div>
                  <label className="text-[11px] text-slate-400">
                    Tamaño ícono ({selectedEl.width}px)
                  </label>
                  <input
                    type="range"
                    min={24}
                    max={128}
                    value={selectedEl.width}
                    onChange={(e) =>
                      updateElement(selectedEl.id, { width: Number(e.target.value) }, 'debounced')
                    }
                    className="mt-2 w-full accent-cyan-400"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400">Color</label>
                  <input
                    type="color"
                    value={selectedEl.color || '#00d4ff'}
                    onChange={(e) => updateElement(selectedEl.id, { color: e.target.value }, 'debounced')}
                    className="mt-1 block h-8 w-16 cursor-pointer rounded bg-transparent"
                  />
                </div>
                <div className="sm:col-span-3">
                  <label className="text-[11px] text-slate-400">Elegir ícono</label>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {ICON_OPTIONS.map((opt) => (
                      <button
                        key={opt.name}
                        type="button"
                        title={opt.label}
                        onClick={() => updateElement(selectedEl.id, { icon: opt.name }, 'immediate')}
                        className={`rounded-lg border p-1.5 ${
                          selectedEl.icon === opt.name
                            ? 'border-cyan-400 bg-cyan-400 text-slate-950'
                            : 'border-white/15 bg-white/5 text-slate-200'
                        }`}
                      >
                        <DynamicIcon name={opt.name} className="h-4 w-4" />
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {selectedEl.type === 'image' && (
              <>
                <div className="sm:col-span-2">
                  <label className="text-[11px] text-slate-400">
                    Ancho imagen ({selectedEl.width}px)
                  </label>
                  <input
                    type="range"
                    min={80}
                    max={640}
                    step={10}
                    value={selectedEl.width}
                    onChange={(e) =>
                      updateElement(selectedEl.id, { width: Number(e.target.value) }, 'debounced')
                    }
                    className="mt-2 w-full accent-cyan-400"
                  />
                </div>
                <div className="flex items-end">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    onChange={handleImageUploadForSelected}
                    className="hidden"
                  />
                  <button
                    type="button"
                    disabled={uploading}
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-cyan-400 px-3 py-2 font-semibold text-slate-950"
                  >
                    {uploading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Upload className="h-3.5 w-3.5" />
                    )}
                    Cambiar foto
                  </button>
                </div>
                {uploadError && (
                  <p className="text-xs text-rose-400 sm:col-span-3">{uploadError}</p>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

import { useRef, useState, type ChangeEvent } from 'react';
import { Image as ImageIcon, Loader2, Upload, X } from 'lucide-react';
import { formatBytes, uploadAdminImage } from '../../utils/imageUpload';

export interface GalleryImage {
  name: string;
  url: string;
  size: number;
  uploaded: boolean;
  updatedAt: string;
}

interface ImageFieldProps {
  label: string;
  value: string;
  onChange: (url: string) => void;
  images: GalleryImage[];
  onUploaded: (img: GalleryImage) => void;
}

export function ImageField({ label, value, onChange, images, onUploaded }: ImageFieldProps) {
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoNote, setInfoNote] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setInfoNote(null);
    setUploading(true);

    try {
      const result = await uploadAdminImage(file);
      onUploaded(result.image);
      onChange(result.image.url);
      if (result.optimized) {
        setInfoNote(
          `Optimizada automáticamente para web (${formatBytes(result.originalBytes)} → ${formatBytes(result.finalBytes)}).`,
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al subir la imagen.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
        {label}
      </label>

      <div className="mt-2 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-3 sm:flex-row sm:items-center dark:border-white/10 dark:bg-white/[0.03]">
        <div className="h-20 w-28 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-900 dark:border-white/10">
          {value ? (
            <img src={value} alt={label} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-slate-500">
              <ImageIcon className="h-6 w-6" />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="/images/..."
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-mono text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-white/15 dark:bg-[#070c1c] dark:text-slate-200 dark:focus:border-cyan-400"
          />

          <div className="flex flex-wrap gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60 dark:bg-cyan-500 dark:text-slate-950 dark:hover:bg-cyan-400"
            >
              {uploading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5" />
              )}
              {uploading ? 'Subiendo...' : 'Subir desde PC'}
            </button>

            <button
              type="button"
              onClick={() => setGalleryOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-sky-500 dark:border-white/15 dark:bg-white/5 dark:text-slate-200 dark:hover:border-cyan-400/50"
            >
              <ImageIcon className="h-3.5 w-3.5" />
              Elegir de galería
            </button>
          </div>

          {infoNote && <p className="text-xs text-emerald-600 dark:text-emerald-400">{infoNote}</p>}
          {error && <p className="text-xs text-rose-500">{error}</p>}
        </div>
      </div>

      {/* Gallery Modal */}
      {galleryOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-cyan-400/25 dark:bg-[#0b1229]">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-white/10">
              <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                Seleccionar imagen
              </h3>
              <button
                type="button"
                onClick={() => setGalleryOpen(false)}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/10"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 overflow-y-auto p-6 sm:grid-cols-3">
              {images.map((img) => {
                const selected = img.url === value;
                return (
                  <button
                    key={img.url}
                    type="button"
                    onClick={() => {
                      onChange(img.url);
                      setGalleryOpen(false);
                    }}
                    className={`group overflow-hidden rounded-2xl border text-left transition ${
                      selected
                        ? 'border-blue-600 ring-2 ring-blue-500/30 dark:border-cyan-400 dark:ring-cyan-400/30'
                        : 'border-slate-200 hover:border-sky-400 dark:border-white/10 dark:hover:border-cyan-400/50'
                    }`}
                  >
                    <div className="aspect-[16/10] bg-slate-900">
                      <img
                        src={img.url}
                        alt={img.name}
                        className="h-full w-full object-cover transition group-hover:scale-105"
                      />
                    </div>
                    <div className="p-2.5">
                      <p className="truncate font-mono text-[11px] font-medium text-slate-800 dark:text-slate-200">
                        {img.name}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        {(img.size / 1024).toFixed(0)} KB · {img.uploaded ? 'Subida' : 'Base'}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

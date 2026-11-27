import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { useContent } from '../context/ContentContext';
import type { PageTextOverride } from '../data/siteData';
import {
  buildHeadingInlineStyle,
  getHeadingSizeClasses,
  getHeadingWeightClass,
  getTextAlignClass,
} from '../utils/typography';
import {
  EditableOutline,
  InlineTextEditorModal,
  useResolvedPageText,
} from './EditableTextBlock';

interface PageBannerProps {
  eyebrow: string;
  title: string;
  subtitle: string;
  breadcrumb: string;
  /** Unique persistence key enabling inline banner text & typography editing */
  textKey?: string;
  onCustomSave?: (next: PageTextOverride) => Promise<void>;
}

export function PageBanner({
  eyebrow,
  title,
  subtitle,
  breadcrumb,
  textKey,
  onCustomSave,
}: PageBannerProps) {
  const { savePageText } = useContent();
  const resolved = useResolvedPageText(textKey, { eyebrow, title, subtitle });
  const [open, setOpen] = useState(false);

  const headingStyle = buildHeadingInlineStyle(resolved.style);
  const sizeClass = getHeadingSizeClasses(resolved.style?.fontSize, 'banner');
  const weightClass = getHeadingWeightClass(resolved.style?.fontWeight);
  const alignClass = getTextAlignClass(resolved.style?.align);
  const isCentered = resolved.style?.align === 'center';

  const headerContent = (
    <div className={alignClass}>
      {resolved.eyebrow && (
        <span className="inline-flex items-center gap-2 rounded-full border border-sky-500/25 bg-sky-500/10 px-3 py-1 font-mono text-xs font-medium uppercase tracking-widest text-sky-700 dark:border-cyan-400/25 dark:bg-cyan-400/10 dark:text-cyan-300">
          {resolved.eyebrow}
        </span>
      )}

      <h1
        style={headingStyle}
        className={`mt-4 font-display tracking-tight text-slate-900 dark:text-white ${sizeClass} ${weightClass} ${
          isCentered ? 'mx-auto max-w-3xl' : 'max-w-3xl'
        }`}
      >
        {resolved.title}
      </h1>
      {resolved.subtitle && (
        <p
          className={`mt-4 text-base leading-relaxed text-slate-600 sm:text-lg dark:text-slate-300 ${
            isCentered ? 'mx-auto max-w-2xl' : 'max-w-2xl'
          }`}
        >
          {resolved.subtitle}
        </p>
      )}
    </div>
  );

  return (
    <section className="relative overflow-hidden border-b border-slate-200 bg-slate-100/80 py-16 sm:py-20 dark:border-cyan-500/15 dark:bg-[#070c1c]">
      <div className="bg-tech-grid pointer-events-none absolute inset-0 opacity-70" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 right-1/4 h-72 w-72 rounded-full bg-cyan-400/15 blur-3xl dark:bg-cyan-500/15"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-24 left-1/4 h-72 w-72 rounded-full bg-blue-600/10 blur-3xl dark:bg-violet-600/15"
      />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <nav
          aria-label="Ruta de navegación"
          className="mb-6 flex items-center gap-1.5 font-mono text-xs text-slate-500 dark:text-slate-400"
        >
          <Link to="/" className="transition hover:text-blue-600 dark:hover:text-cyan-300">
            Inicio
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-slate-900 dark:text-cyan-300">{breadcrumb}</span>
        </nav>

        {textKey ? (
          <>
            <EditableOutline
              enabled={resolved.isEditing}
              onEdit={() => setOpen(true)}
              buttonLabel="Editar encabezado y tipografía"
            >
              {headerContent}
            </EditableOutline>

            <InlineTextEditorModal
              open={open}
              onClose={() => setOpen(false)}
              label="Editar encabezado de página y tipografía"
              initialEyebrow={resolved.eyebrow}
              initialTitle={resolved.title}
              initialSubtitle={resolved.subtitle}
              initialStyle={resolved.style}
              showEyebrow
              showSubtitle
              showAlign
              onSave={async (next) => {
                if (onCustomSave) {
                  await onCustomSave(next);
                } else {
                  await savePageText(textKey, next);
                }
              }}
              onReset={async () => {
                await savePageText(textKey, {});
              }}
            />
          </>
        ) : (
          headerContent
        )}
      </div>
    </section>
  );
}

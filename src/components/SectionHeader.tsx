import { useState } from 'react';
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

interface SectionHeaderProps {
  eyebrow: string;
  title: string;
  description?: string;
  align?: 'left' | 'center';
  /** Unique persistence key enabling inline text & typography editing in Visual Edit Mode */
  textKey?: string;
  onCustomSave?: (next: PageTextOverride) => Promise<void>;
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  align = 'left',
  textKey,
  onCustomSave,
}: SectionHeaderProps) {
  const { savePageText } = useContent();
  const resolved = useResolvedPageText(textKey, {
    eyebrow,
    title,
    subtitle: description || '',
  });
  const [open, setOpen] = useState(false);

  const effectiveAlign = resolved.style?.align || align;
  const centered = effectiveAlign === 'center';
  const headingStyle = buildHeadingInlineStyle(resolved.style);
  const sizeClass = getHeadingSizeClasses(resolved.style?.fontSize, 'section');
  const weightClass = getHeadingWeightClass(resolved.style?.fontWeight);
  const alignClass = getTextAlignClass(effectiveAlign);

  const body = (
    <div className={`${centered ? 'mx-auto max-w-2xl' : 'max-w-2xl'} ${alignClass}`}>
      {resolved.eyebrow && (
        <div
          className={`inline-flex items-center gap-2 rounded-full border border-sky-500/25 bg-sky-500/10 px-3 py-1 font-mono text-xs font-medium uppercase tracking-widest text-sky-700 dark:border-cyan-400/25 dark:bg-cyan-400/10 dark:text-cyan-300 ${
            centered ? 'mx-auto' : ''
          }`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-blue-600 dark:bg-cyan-400" />
          {resolved.eyebrow}
        </div>
      )}
      <h2
        style={headingStyle}
        className={`mt-4 font-display tracking-tight text-slate-900 dark:text-white ${sizeClass} ${weightClass}`}
      >
        {resolved.title}
      </h2>
      {resolved.subtitle && (
        <p className="mt-3 text-base leading-relaxed text-slate-600 dark:text-slate-400">
          {resolved.subtitle}
        </p>
      )}
    </div>
  );

  if (!textKey) return body;

  return (
    <>
      <EditableOutline enabled={resolved.isEditing} onEdit={() => setOpen(true)}>
        {body}
      </EditableOutline>

      <InlineTextEditorModal
        open={open}
        onClose={() => setOpen(false)}
        label="Editar encabezado y tipografía"
        initialEyebrow={resolved.eyebrow}
        initialTitle={resolved.title}
        initialSubtitle={resolved.subtitle}
        initialStyle={{ align: effectiveAlign, ...(resolved.style || {}) }}
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
  );
}

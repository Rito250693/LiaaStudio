import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import type { CustomBlock } from '../data/siteData';
import { DynamicIcon } from './DynamicIcon';
import { SectionHeader } from './SectionHeader';
import { EditableHeadingRegion } from './EditableTextBlock';
import { CanvasBlockRenderer } from './CanvasBlockRenderer';

function ActionButton({ label, to }: { label: string; to: string }) {
  const isExternal = /^https?:\/\//i.test(to);
  const cls =
    'inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#0845ff] to-[#029be6] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:-translate-y-0.5 hover:brightness-110';

  if (isExternal) {
    return (
      <a href={to} target="_blank" rel="noreferrer" className={cls}>
        {label}
        <ArrowRight className="h-4 w-4" />
      </a>
    );
  }
  return (
    <Link to={to || '/'} className={cls}>
      {label}
      <ArrowRight className="h-4 w-4" />
    </Link>
  );
}

export function CustomBlockRenderer({
  block,
  editable = false,
  onChangeBlock,
}: {
  block: CustomBlock;
  editable?: boolean;
  onChangeBlock?: (next: CustomBlock) => void | Promise<void>;
}) {
  if (block.kind === 'canvas') {
    return (
      <CanvasBlockRenderer block={block} editable={editable} onChangeBlock={onChangeBlock} />
    );
  }

  if (block.kind === 'icon-cards') {
    const cols =
      block.columns === 2
        ? 'sm:grid-cols-2'
        : block.columns === 4
        ? 'sm:grid-cols-2 lg:grid-cols-4'
        : 'sm:grid-cols-2 lg:grid-cols-3';

    return (
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <SectionHeader
          textKey={`block.${block.id}`}
          eyebrow={block.eyebrow || 'Bloque Destacado'}
          title={block.title}
          description={block.subtitle}
          align={block.align === 'center' ? 'center' : 'left'}
        />
        <div className={`mt-12 grid gap-6 ${cols}`}>
          {(block.cards || []).map((card, idx) => (
            <div
              key={idx}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-sky-400 hover:shadow-lg dark:border-white/10 dark:bg-[#0b1229] dark:hover:border-cyan-400/50"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#0845ff]/15 to-[#00d4ff]/15 text-blue-700 ring-1 ring-blue-500/20 dark:from-[#0845ff]/25 dark:to-[#00d4ff]/20 dark:text-cyan-300 dark:ring-cyan-400/25">
                <DynamicIcon name={card.icon} className="h-6 w-6" />
              </div>
              <h3 className="mt-5 font-display text-lg font-bold text-slate-900 dark:text-white">
                {card.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                {card.description}
              </p>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (block.kind === 'text-image') {
    const imageRight = block.imagePosition === 'right';
    const paragraphs = (block.body || '')
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean);

    return (
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-12">
          <div className={`lg:col-span-6 ${imageRight ? 'lg:order-2' : 'lg:order-1'}`}>
            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-900 shadow-xl dark:border-cyan-400/20">
              <img
                src={block.image || '/images/pitec-building.jpg'}
                alt={block.title}
                className="aspect-[16/10] w-full object-cover"
              />
            </div>
          </div>

          <div className={`lg:col-span-6 ${imageRight ? 'lg:order-1' : 'lg:order-2'}`}>
            <SectionHeader
              textKey={`block.${block.id}`}
              eyebrow={block.eyebrow || 'Sección'}
              title={block.title}
              description={block.subtitle}
            />
            <div className="mt-4 space-y-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {paragraphs.map((p, idx) => (
                <p key={idx}>{p}</p>
              ))}
            </div>
            {block.buttonLabel && (
              <div className="mt-6">
                <ActionButton label={block.buttonLabel} to={block.buttonLink || '/contacto'} />
              </div>
            )}
          </div>
        </div>
      </section>
    );
  }

  if (block.kind === 'stats') {
    return (
      <section className="border-y border-slate-200 bg-slate-100/70 py-16 dark:border-cyan-500/15 dark:bg-[#070c1c]/80">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {(block.title || block.eyebrow) && (
            <div className="mb-10">
              <SectionHeader
                textKey={`block.${block.id}`}
                eyebrow={block.eyebrow || 'Indicadores'}
                title={block.title}
                description={block.subtitle}
                align="center"
              />
            </div>
          )}
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {(block.stats || []).map((st, idx) => (
              <div
                key={idx}
                className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm dark:border-white/10 dark:bg-[#0c142c]"
              >
                <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600/10 text-blue-700 dark:bg-cyan-400/10 dark:text-cyan-300">
                  <DynamicIcon name={st.icon} className="h-5 w-5" />
                </div>
                <p className="mt-4 font-display text-3xl font-bold text-slate-900 dark:text-white">
                  {st.value}
                </p>
                <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                  {st.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  // cta-banner
  const centered = block.align === 'center';
  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <div
        className={`flex flex-col gap-6 rounded-3xl border border-blue-500/25 bg-gradient-to-r from-[#0845ff]/10 via-[#029be6]/10 to-[#6d28d9]/10 p-8 sm:p-12 dark:border-cyan-400/25 dark:from-[#0845ff]/20 dark:via-[#029be6]/15 dark:to-[#6d28d9]/20 ${
          centered ? 'items-center text-center' : 'sm:flex-row sm:items-center sm:justify-between'
        }`}
      >
        <div className="max-w-2xl flex-1">
          <EditableHeadingRegion
            textKey={`block.${block.id}`}
            eyebrow={block.eyebrow}
            title={block.title}
            subtitle={block.subtitle}
            showEyebrow={Boolean(block.eyebrow)}
            showSubtitle={Boolean(block.subtitle)}
            variant="card"
            eyebrowSlot={(label) => (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/25 bg-white/70 px-3 py-1 font-mono text-xs font-semibold uppercase tracking-widest text-sky-700 dark:border-cyan-400/30 dark:bg-[#050814]/60 dark:text-cyan-300">
                {block.icon && <DynamicIcon name={block.icon} className="h-3.5 w-3.5" />}
                {label}
              </span>
            )}
            subtitleClassName="mt-2.5 text-sm leading-relaxed text-slate-600 sm:text-base dark:text-slate-300"
          />
        </div>
        {block.buttonLabel && (
          <div className="shrink-0">
            <ActionButton label={block.buttonLabel} to={block.buttonLink || '/contacto'} />
          </div>
        )}
      </div>
    </section>
  );
}

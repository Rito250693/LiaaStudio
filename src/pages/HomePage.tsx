import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowDown,
  ArrowLeftRight,
  ArrowRight,
  ArrowUp,
  Calendar,
  CheckCircle2,
  ExternalLink,
  Eye,
  EyeOff,
  GraduationCap,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
} from 'lucide-react';
import { NeuralCanvas } from '../components/NeuralCanvas';
import { SectionHeader } from '../components/SectionHeader';
import {
  EditableHeadingRegion,
  EditableOutline,
  InlineTextEditorModal,
} from '../components/EditableTextBlock';
import { ResearchIcon } from '../components/ResearchIcon';
import { DynamicIcon } from '../components/DynamicIcon';
import { CustomBlockRenderer } from '../components/CustomBlockRenderer';
import { useContent } from '../context/ContentContext';
import { useAuth } from '../context/AuthContext';
import type { HomeSectionConfig } from '../data/siteData';
import {
  buildHeadingInlineStyle,
  getHeadingWeightClass,
  getTextAlignClass,
} from '../utils/typography';

export function HomePage() {
  const { content, saveDesignToServer, savePageText } = useContent();
  const { hasPermission, editMode } = useAuth();
  const [liveToast, setLiveToast] = useState<string | null>(null);
  const [heroEditorOpen, setHeroEditorOpen] = useState(false);

  const { siteInfo, hero, labIdentity, researchLines, newsArticles, homeSections, customBlocks } =
    content;
  const heroTextOverride = content.pageTexts?.['home.hero'];
  const latestNews = newsArticles.slice(0, 3);
  const isEditing = hasPermission(['site.design', 'site.pages']) && editMode;

  const notify = (msg: string) => {
    setLiveToast(msg);
    window.setTimeout(() => setLiveToast((prev) => (prev === msg ? null : prev)), 2600);
  };

  const persistSections = async (nextSections: HomeSectionConfig[], message: string) => {
    try {
      await saveDesignToServer({ homeSections: nextSections });
      notify(message);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'No se pudo guardar el cambio.');
    }
  };

  const moveSection = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= homeSections.length) return;
    const next = [...homeSections];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    void persistSections(next, 'Orden actualizado y guardado.');
  };

  const toggleSectionVisibility = (id: string) => {
    const next = homeSections.map((s) => (s.id === id ? { ...s, visible: !s.visible } : s));
    void persistSections(next, 'Visibilidad actualizada.');
  };

  const flipSection = (sec: HomeSectionConfig) => {
    if (sec.type === 'hero') {
      const order: Array<'default' | 'reversed' | 'centered'> = [
        'default',
        'reversed',
        'centered',
      ];
      const nextLayout = order[(order.indexOf(hero.layout) + 1) % order.length];
      void saveDesignToServer({
        hero: { ...hero, layout: nextLayout },
      })
        .then(() => notify(`Diseño de portada cambiado a: ${nextLayout}.`))
        .catch((err) => notify(err instanceof Error ? err.message : 'Error al guardar.'));
      return;
    }

    if (sec.type === 'custom' && sec.customBlockId) {
      const nextBlocks = customBlocks.map((b) =>
        b.id === sec.customBlockId
          ? {
              ...b,
              imagePosition: b.imagePosition === 'right' ? ('left' as const) : ('right' as const),
              align: b.align === 'center' ? ('left' as const) : ('center' as const),
            }
          : b,
      );
      void saveDesignToServer({ customBlocks: nextBlocks })
        .then(() => notify('Posición del bloque invertida.'))
        .catch((err) => notify(err instanceof Error ? err.message : 'Error al guardar.'));
      return;
    }

    const next = homeSections.map((s) => (s.id === sec.id ? { ...s, flipped: !s.flipped } : s));
    void persistSections(next, 'Posición de columnas invertida.');
  };

  const getAdminEditLink = (sec: HomeSectionConfig): string => {
    switch (sec.type) {
      case 'hero':
        return '/admin?tab=hero';
      case 'about':
        return '/admin?tab=identity';
      case 'research':
        return '/admin?tab=research';
      case 'news':
        return '/admin?tab=news';
      case 'location':
        return '/admin?tab=general';
      case 'custom':
        return `/admin?tab=builder&block=${encodeURIComponent(sec.customBlockId || '')}`;
    }
  };

  const wrapEditable = (sec: HomeSectionConfig, idx: number, children: ReactNode) => {
    if (!isEditing) return <div key={sec.id}>{children}</div>;

    const canFlip =
      sec.type === 'hero' ||
      sec.type === 'about' ||
      sec.type === 'location' ||
      sec.type === 'custom';

    return (
      <div
        key={sec.id}
        className="group/edit relative border-y-2 border-dashed border-cyan-500/40 transition hover:border-cyan-400"
      >
        {/* Floating Edit Toolbar */}
        <div className="sticky top-12 z-30 mx-auto flex max-w-7xl justify-end px-4 pt-3 sm:px-6 lg:px-8">
          <div className="inline-flex flex-wrap items-center gap-1 rounded-xl border border-cyan-400/40 bg-[#070d20]/95 p-1.5 text-xs text-slate-100 shadow-xl backdrop-blur">
            <span className="px-2 font-mono text-[11px] font-semibold text-cyan-300">
              {sec.label}
            </span>
            <button
              type="button"
              disabled={idx === 0}
              onClick={() => moveSection(idx, -1)}
              title="Mover sección arriba"
              className="rounded-lg p-1.5 hover:bg-white/10 disabled:opacity-30"
            >
              <ArrowUp className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              disabled={idx === homeSections.length - 1}
              onClick={() => moveSection(idx, 1)}
              title="Mover sección abajo"
              className="rounded-lg p-1.5 hover:bg-white/10 disabled:opacity-30"
            >
              <ArrowDown className="h-3.5 w-3.5" />
            </button>
            {canFlip && (
              <button
                type="button"
                onClick={() => flipSection(sec)}
                title="Cambiar posición / distribución"
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 hover:bg-white/10"
              >
                <ArrowLeftRight className="h-3.5 w-3.5 text-cyan-300" />
                <span className="hidden sm:inline">Posición</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => toggleSectionVisibility(sec.id)}
              title="Ocultar sección"
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 hover:bg-white/10"
            >
              <EyeOff className="h-3.5 w-3.5 text-amber-300" />
              <span className="hidden sm:inline">Ocultar</span>
            </button>
            <Link
              to={getAdminEditLink(sec)}
              className="inline-flex items-center gap-1 rounded-lg bg-cyan-400 px-2.5 py-1.5 font-semibold text-slate-950 transition hover:bg-cyan-300"
            >
              <Pencil className="h-3.5 w-3.5" />
              Editar
            </Link>
          </div>
        </div>

        {children}
      </div>
    );
  };

  const renderHero = () => {
    const isCentered = hero.layout === 'centered' || !hero.card.visible;
    const isReversed = hero.layout === 'reversed' && hero.card.visible;

    return (
      <section className="relative overflow-hidden border-b border-slate-200 bg-gradient-to-b from-slate-100 via-white to-slate-50 dark:border-cyan-500/15 dark:from-[#040714] dark:via-[#070d22] dark:to-[#050814]">
        <div className="bg-tech-grid pointer-events-none absolute inset-0 opacity-60" />
        {hero.showNeuralCanvas && <NeuralCanvas />}

        {/* Ambient Glows */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-32 left-1/2 h-[420px] w-[620px] -translate-x-1/2 rounded-full bg-gradient-to-r from-[#0845ff]/20 via-[#00d4ff]/20 to-[#6d28d9]/20 blur-3xl dark:from-[#0845ff]/25 dark:via-[#00d4ff]/20 dark:to-[#6d28d9]/25"
        />

        <div
          className={`relative mx-auto grid max-w-7xl items-center gap-12 px-4 py-20 sm:px-6 md:py-28 lg:px-8 ${
            isCentered ? 'text-center' : 'lg:grid-cols-12'
          }`}
        >
          {/* Copy Column */}
          <div
            className={
              isCentered
                ? 'mx-auto max-w-3xl'
                : `lg:col-span-7 ${isReversed ? 'lg:order-2' : 'lg:order-1'}`
            }
          >
            <EditableOutline
              enabled={isEditing}
              onEdit={() => setHeroEditorOpen(true)}
              buttonLabel="Editar título y tipografía"
            >
              <div className={getTextAlignClass(heroTextOverride?.style?.align)}>
                {(heroTextOverride?.eyebrow ?? hero.badgeText) && (
                  <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/30 bg-white/80 px-3.5 py-1.5 font-mono text-xs font-medium text-sky-800 shadow-sm backdrop-blur dark:border-cyan-400/30 dark:bg-[#0b132b]/80 dark:text-cyan-300">
                    <DynamicIcon
                      name={hero.badgeIcon}
                      className="h-3.5 w-3.5 text-blue-600 dark:text-cyan-400"
                    />
                    <span>{heroTextOverride?.eyebrow ?? hero.badgeText}</span>
                  </div>
                )}

                <h1
                  style={buildHeadingInlineStyle(heroTextOverride?.style)}
                  className={`mt-6 font-display tracking-tight text-slate-950 dark:text-white ${getHeadingWeightClass(heroTextOverride?.style?.fontWeight)} ${
                    heroTextOverride?.style?.fontSize === 'sm'
                      ? 'text-3xl sm:text-4xl lg:text-5xl'
                      : heroTextOverride?.style?.fontSize === 'lg'
                        ? 'text-5xl sm:text-6xl lg:text-7xl'
                        : heroTextOverride?.style?.fontSize === 'xl' ||
                            heroTextOverride?.style?.fontSize === '2xl'
                          ? 'text-5xl sm:text-7xl'
                          : 'text-4xl sm:text-5xl lg:text-6xl'
                  }`}
                >
                  {heroTextOverride?.title ? (
                    heroTextOverride.title
                  ) : (
                    <>
                      {hero.titlePrefix}{' '}
                      <span className="bg-gradient-to-r from-[#0845ff] via-[#029be6] to-[#6d28d9] bg-clip-text text-transparent dark:from-[#00d4ff] dark:via-[#3b82f6] dark:to-[#a855f7]">
                        {hero.titleHighlight}
                      </span>{' '}
                      {hero.titleSuffix}
                    </>
                  )}
                </h1>

                <p
                  className={`mt-6 text-base leading-relaxed text-slate-600 sm:text-lg dark:text-slate-300 ${
                    isCentered ? 'mx-auto max-w-2xl' : 'max-w-2xl'
                  }`}
                >
                  {heroTextOverride?.subtitle ?? hero.subtitle}
                </p>
              </div>
            </EditableOutline>

            <InlineTextEditorModal
              open={heroEditorOpen}
              onClose={() => setHeroEditorOpen(false)}
              label="Editar portada principal y tipografía"
              initialEyebrow={heroTextOverride?.eyebrow ?? hero.badgeText}
              initialTitle={
                heroTextOverride?.title ??
                `${hero.titlePrefix} ${hero.titleHighlight} ${hero.titleSuffix}`.trim()
              }
              initialSubtitle={heroTextOverride?.subtitle ?? hero.subtitle}
              initialStyle={heroTextOverride?.style}
              showEyebrow
              showSubtitle
              showAlign
              onSave={async (next) => {
                await savePageText('home.hero', next);
                notify('Portada y tipografía guardadas.');
              }}
              onReset={async () => {
                await savePageText('home.hero', {});
                notify('Portada restablecida.');
              }}
            />

            {(hero.primaryCta.visible || hero.secondaryCta.visible) && (
              <div
                className={`mt-8 flex flex-wrap items-center gap-4 ${
                  isCentered ? 'justify-center' : ''
                }`}
              >
                {hero.primaryCta.visible && (
                  <Link
                    to={hero.primaryCta.to || '/investigacion'}
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#0845ff] to-[#029be6] px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition hover:-translate-y-0.5 hover:brightness-110"
                  >
                    {hero.primaryCta.label}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                )}
                {hero.secondaryCta.visible && (
                  <Link
                    to={hero.secondaryCta.to || '/nosotros'}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white/80 px-6 py-3.5 text-sm font-semibold text-slate-800 backdrop-blur transition hover:border-sky-500 hover:text-blue-700 dark:border-white/15 dark:bg-white/5 dark:text-white dark:hover:border-cyan-400/50 dark:hover:text-cyan-300"
                  >
                    {hero.secondaryCta.label}
                  </Link>
                )}
              </div>
            )}

            {/* Key Lab Metrics */}
            {hero.metrics.length > 0 && (
              <div
                className={`mt-10 grid gap-4 border-t border-slate-200/90 pt-6 dark:border-white/10 ${
                  isCentered ? 'mx-auto max-w-xl' : 'max-w-xl'
                }`}
                style={{
                  gridTemplateColumns: `repeat(${Math.min(hero.metrics.length, 4)}, minmax(0, 1fr))`,
                }}
              >
                {hero.metrics.map((metric, idx) => (
                  <div key={idx}>
                    <p className="font-display text-2xl font-bold text-slate-900 dark:text-white">
                      {metric.value}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      {metric.label}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right/Left Emblem Card Showcase */}
          {hero.card.visible && hero.layout !== 'centered' && (
            <div
              className={`relative flex items-center justify-center lg:col-span-5 ${
                isReversed ? 'lg:order-1' : 'lg:order-2'
              }`}
            >
              <div className="relative w-full max-w-md">
                <div
                  aria-hidden="true"
                  className="animate-pulse-slow absolute inset-6 rounded-full bg-gradient-to-tr from-[#0845ff]/30 via-[#00d4ff]/25 to-[#6d28d9]/30 blur-3xl"
                />
                <div className="relative overflow-hidden rounded-3xl border border-slate-200/90 bg-white/85 p-8 shadow-2xl shadow-blue-950/10 backdrop-blur-xl dark:border-cyan-400/20 dark:bg-[#0b1229]/85 dark:shadow-cyan-950/40">
                  <div className="flex items-center justify-between border-b border-slate-200/80 pb-4 font-mono text-[11px] text-slate-500 dark:border-white/10 dark:text-slate-400">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-emerald-400" />
                      {hero.card.headerLeft}
                    </span>
                    <span>{hero.card.headerRight}</span>
                  </div>

                  <div className="my-6 flex justify-center">
                    <div className="animate-float-gentle relative flex h-52 w-52 items-center justify-center rounded-2xl bg-white p-4 shadow-lg ring-1 ring-slate-200 dark:bg-slate-950/90 dark:ring-cyan-400/25">
                      <img
                        src={hero.card.image || siteInfo.images.emblem}
                        alt={`Logotipo del ${siteInfo.fullName}`}
                        className="h-full w-full object-contain"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-left">
                    <div className="rounded-xl border border-slate-200 bg-slate-50/90 p-3 dark:border-white/10 dark:bg-white/5">
                      <p className="font-mono text-[10px] uppercase tracking-wider text-sky-700 dark:text-cyan-400">
                        {hero.card.stat1Label}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-slate-900 dark:text-white">
                        {hero.card.stat1Value}
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50/90 p-3 dark:border-white/10 dark:bg-white/5">
                      <p className="font-mono text-[10px] uppercase tracking-wider text-violet-700 dark:text-violet-300">
                        {hero.card.stat2Label}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-slate-900 dark:text-white">
                        {hero.card.stat2Value}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    );
  };

  const renderAbout = (flipped?: boolean) => (
    <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
      <div className="grid items-center gap-12 lg:grid-cols-12">
        <div className={`lg:col-span-6 ${flipped ? 'lg:order-2' : 'lg:order-1'}`}>
          <div className="group relative overflow-hidden rounded-3xl border border-slate-200 bg-slate-900 shadow-xl dark:border-cyan-400/20">
            <img
              src={siteInfo.images.pitecBuilding}
              alt="Edificio PITec — Posgrado en Ingeniería y Tecnología Aplicada UAZ"
              className="aspect-[16/10] w-full object-cover transition duration-500 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#050814]/85 via-transparent to-transparent" />
            <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-4">
              <div>
                <span className="inline-block rounded-md bg-cyan-400/20 px-2.5 py-1 font-mono text-[11px] font-medium text-cyan-200 backdrop-blur">
                  SEDE PITec · UAZ
                </span>
                <p className="mt-1.5 font-display text-sm font-semibold text-white sm:text-base">
                  {siteInfo.degrees}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className={`lg:col-span-6 ${flipped ? 'lg:order-1' : 'lg:order-2'}`}>
          <SectionHeader
            textKey="home.about"
            eyebrow="Sobre el Laboratorio"
            title="Ciencia e ingeniería de IA desde Zacatecas hacia la frontera tecnológica"
            description={labIdentity.aboutLead}
          />
          <p className="mt-4 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            {labIdentity.aboutParagraphs[0]}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to="/nosotros"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 transition hover:border-blue-600 hover:text-blue-600 dark:border-cyan-400/30 dark:bg-cyan-400/10 dark:text-cyan-200 dark:hover:bg-cyan-400/20"
            >
              Misión, Visión y Valores
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href={siteInfo.pitecUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:text-blue-600 dark:text-slate-300 dark:hover:text-cyan-300"
            >
              <GraduationCap className="h-4 w-4" />
              Conocer PITec UAZ
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );

  const renderResearch = () => (
    <section className="border-y border-slate-200 bg-slate-100/70 py-20 dark:border-cyan-500/15 dark:bg-[#070c1c]/80">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <SectionHeader
            textKey="home.research"
            eyebrow="Líneas de Investigación"
            title="Áreas clave de desarrollo científico"
            description="Combinamos fundamentos matemáticos, aprendizaje profundo y hardware especializado para resolver problemas complejos de ingeniería."
          />
          <Link
            to="/investigacion"
            className="inline-flex shrink-0 items-center gap-2 text-sm font-semibold text-blue-700 transition hover:gap-3 dark:text-cyan-300"
          >
            Ver proyectos y posgrado
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {researchLines.map((line) => (
            <Link
              key={line.id}
              to="/investigacion"
              className="group relative flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-sky-400 hover:shadow-lg hover:shadow-sky-500/10 dark:border-white/10 dark:bg-[#0c142c] dark:hover:border-cyan-400/50 dark:hover:shadow-cyan-500/10"
            >
              <div className="flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#0845ff]/15 to-[#00d4ff]/15 text-blue-700 ring-1 ring-blue-500/20 dark:from-[#0845ff]/25 dark:to-[#00d4ff]/20 dark:text-cyan-300 dark:ring-cyan-400/25">
                  <ResearchIcon icon={line.icon} className="h-6 w-6" />
                </div>
                <span className="font-mono text-xs text-slate-400 dark:text-slate-500">
                  {line.code}
                </span>
              </div>

              <h3 className="mt-5 font-display text-lg font-bold text-slate-900 transition group-hover:text-blue-700 dark:text-white dark:group-hover:text-cyan-300">
                {line.title}
              </h3>

              <p className="mt-2.5 flex-1 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                {line.shortDescription}
              </p>

              <div className="mt-5 flex flex-wrap gap-1.5">
                {line.tags.slice(0, 2).map((tag) => (
                  <span
                    key={tag}
                    className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-600 dark:bg-white/5 dark:text-slate-300"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );

  const renderNews = () => (
    <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
      <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
        <SectionHeader
          textKey="home.news"
          eyebrow="Noticias y Eventos"
          title="Actividad reciente del LIAA"
          description="Anuncios académicos, convocatorias de tesis, seminarios y novedades del laboratorio."
        />
        <Link
          to="/noticias"
          className="inline-flex shrink-0 items-center gap-2 text-sm font-semibold text-blue-700 transition hover:gap-3 dark:text-cyan-300"
        >
          Todas las noticias
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="mt-12 grid gap-6 md:grid-cols-3">
        {latestNews.map((article) => (
          <article
            key={article.slug}
            className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:border-sky-400 dark:border-white/10 dark:bg-[#0b1229] dark:hover:border-cyan-400/40"
          >
            <Link
              to={`/noticias/${article.slug}`}
              className="relative block aspect-[16/10] overflow-hidden bg-slate-900"
            >
              <img
                src={article.image}
                alt={article.title}
                className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
              />
              <span className="absolute left-3 top-3 rounded-lg bg-[#050814]/80 px-2.5 py-1 font-mono text-[11px] font-medium text-cyan-300 backdrop-blur">
                {article.category}
              </span>
            </Link>

            <div className="flex flex-1 flex-col p-6">
              <div className="flex items-center gap-2 font-mono text-xs text-slate-500 dark:text-slate-400">
                <Calendar className="h-3.5 w-3.5" />
                <span>{article.date}</span>
              </div>

              <h3 className="mt-3 font-display text-lg font-bold leading-snug text-slate-900 transition group-hover:text-blue-700 dark:text-white dark:group-hover:text-cyan-300">
                <Link to={`/noticias/${article.slug}`}>{article.title}</Link>
              </h3>

              <p className="mt-2.5 flex-1 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                {article.excerpt}
              </p>

              <Link
                to={`/noticias/${article.slug}`}
                className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-blue-700 transition group-hover:gap-2.5 dark:text-cyan-300"
              >
                Leer artículo
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  );

  const renderLocation = (flipped?: boolean) => (
    <section className="border-t border-slate-200 bg-slate-100/70 py-20 dark:border-cyan-500/15 dark:bg-[#070c1c]/80">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl lg:grid-cols-12 dark:border-cyan-400/20 dark:bg-[#0b1229]">
          <div
            className={`flex flex-col justify-between p-8 sm:p-10 lg:col-span-5 ${
              flipped ? 'lg:order-2' : 'lg:order-1'
            }`}
          >
            <div>
              <EditableHeadingRegion
                textKey="home.location"
                eyebrow="Ubicación · UAZ"
                title="Visítanos en el edificio PITec"
                subtitle="¿Interesado en desarrollar tu tesis, realizar una estancia de investigación o colaborar en un proyecto de inteligencia artificial?"
                variant="card"
              />

              <ul className="mt-6 space-y-4 text-sm text-slate-700 dark:text-slate-300">
                <li className="flex items-start gap-3">
                  <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-blue-600 dark:text-cyan-400" />
                  <span>{siteInfo.address}</span>
                </li>
                <li className="flex items-center gap-3">
                  <Phone className="h-5 w-5 shrink-0 text-blue-600 dark:text-cyan-400" />
                  <span>{siteInfo.phone}</span>
                </li>
                <li className="flex items-center gap-3">
                  <Mail className="h-5 w-5 shrink-0 text-blue-600 dark:text-cyan-400" />
                  <a
                    href={`mailto:${siteInfo.email}`}
                    className="font-medium hover:text-blue-600 dark:hover:text-cyan-300"
                  >
                    {siteInfo.email}
                  </a>
                </li>
              </ul>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/contacto"
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#0845ff] to-[#029be6] px-5 py-3 text-sm font-semibold text-white shadow-md shadow-blue-600/20 transition hover:brightness-110"
              >
                Enviar mensaje
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href={siteInfo.mapsLinkUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-sky-500 dark:border-white/15 dark:text-slate-200 dark:hover:border-cyan-400/50"
              >
                Abrir en Maps
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </div>

          <div
            className={`min-h-[340px] lg:col-span-7 ${flipped ? 'lg:order-1' : 'lg:order-2'}`}
          >
            <iframe
              title="Ubicación del Laboratorio de Inteligencia Artificial Avanzada - PITec UAZ"
              src={siteInfo.mapsEmbedUrl}
              className="h-full min-h-[340px] w-full border-0 dark:opacity-90 dark:contrast-110"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </div>
      </div>
    </section>
  );

  const hiddenSections = homeSections.filter((s) => !s.visible);

  return (
    <div>
      {liveToast && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-2xl border border-emerald-500/40 bg-emerald-950/90 px-4 py-3 text-xs font-medium text-emerald-200 shadow-xl backdrop-blur">
          <CheckCircle2 className="h-4 w-4" />
          <span>{liveToast}</span>
        </div>
      )}

      {/* Top Restore Banner when any section is hidden in Visual Edit Mode */}
      {isEditing && hiddenSections.length > 0 && (
        <div className="border-b border-amber-400/40 bg-amber-950/90 py-3 text-amber-100">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-4 text-xs sm:px-6 lg:px-8">
            <span className="font-mono font-semibold uppercase tracking-wider text-amber-300">
              Secciones ocultas (clic para volver a mostrar):
            </span>
            {hiddenSections.map((sec) => (
              <button
                key={sec.id}
                type="button"
                onClick={() => toggleSectionVisibility(sec.id)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400/50 bg-amber-400/20 px-3 py-1 font-semibold text-amber-100 transition hover:bg-amber-400 hover:text-slate-950"
              >
                <Eye className="h-3.5 w-3.5" />
                Mostrar: {sec.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {homeSections.map((sec, idx) => {
        if (!sec.visible) return null;

        if (sec.type === 'hero') return wrapEditable(sec, idx, renderHero());
        if (sec.type === 'about') return wrapEditable(sec, idx, renderAbout(sec.flipped));
        if (sec.type === 'research') return wrapEditable(sec, idx, renderResearch());
        if (sec.type === 'news') return wrapEditable(sec, idx, renderNews());
        if (sec.type === 'location') return wrapEditable(sec, idx, renderLocation(sec.flipped));

        if (sec.type === 'custom' && sec.customBlockId) {
          const block = customBlocks.find((b) => b.id === sec.customBlockId);
          if (!block) return null;
          return wrapEditable(
            sec,
            idx,
            <CustomBlockRenderer
              block={block}
              editable={isEditing}
              onChangeBlock={async (nextBlock) => {
                const nextBlocks = customBlocks.map((b) =>
                  b.id === nextBlock.id ? nextBlock : b,
                );
                await saveDesignToServer({ customBlocks: nextBlocks });
                notify('Lienzo guardado.');
              }}
            />,
          );
        }
        return null;
      })}

      {/* Live Edit Mode Footer Helper */}
      {isEditing && (
        <div className="border-t-2 border-dashed border-cyan-500/40 bg-[#070d20] py-8 text-slate-200">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6 lg:px-8">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs uppercase tracking-wider text-cyan-300">
                Modo Edición Visual:
              </span>
              {hiddenSections.length > 0 ? (
                hiddenSections.map((sec) => (
                  <button
                    key={sec.id}
                    type="button"
                    onClick={() => toggleSectionVisibility(sec.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400/40 bg-amber-400/15 px-3 py-1.5 text-xs font-medium text-amber-200 hover:bg-amber-400/25"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    Mostrar: {sec.label}
                  </button>
                ))
              ) : (
                <span className="text-xs text-slate-400">
                  Todas las secciones están visibles. Usa las barras flotantes para moverlas o
                  editarlas.
                </span>
              )}
            </div>

            <Link
              to="/admin?tab=builder"
              className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-400 px-4 py-2 text-xs font-bold text-slate-950 transition hover:bg-cyan-300"
            >
              <Plus className="h-4 w-4" />
              Añadir nuevo bloque personalizado
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

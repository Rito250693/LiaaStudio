import { Link } from 'react-router-dom';
import { ArrowRight, Compass, Eye, ShieldCheck } from 'lucide-react';
import { PageBanner } from '../components/PageBanner';
import { SectionHeader } from '../components/SectionHeader';
import { EditableHeadingRegion } from '../components/EditableTextBlock';
import { useContent } from '../context/ContentContext';

export function AboutPage() {
  const {
    content: { siteInfo, labIdentity },
  } = useContent();

  return (
    <div>
      <PageBanner
        textKey="about.banner"
        eyebrow="Identidad Institucional"
        title="Sobre el LIAA"
        subtitle="Conoce nuestra historia, misión, visión y los valores que guían el trabajo científico en el Laboratorio de Inteligencia Artificial Avanzada de la UAZ."
        breadcrumb="Nosotros"
      />

      {/* ¿Quiénes somos? */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <SectionHeader
              textKey="about.who"
              eyebrow="¿Quiénes somos?"
              title="Investigación aplicada con identidad universitaria"
              description={labIdentity.aboutLead}
            />
            <div className="mt-6 space-y-4 text-base leading-relaxed text-slate-600 dark:text-slate-300">
              {labIdentity.aboutParagraphs.map((paragraph, idx) => (
                <p key={idx}>{paragraph}</p>
              ))}
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-xl dark:border-cyan-400/20 dark:bg-[#0b1229]">
              <div className="flex items-center justify-center rounded-2xl bg-slate-50 p-6 dark:bg-slate-950/80">
                <img
                  src={siteInfo.images.logo}
                  alt={`Logo horizontal ${siteInfo.acronym}`}
                  className="max-h-36 w-auto object-contain"
                />
              </div>
              <div className="mt-6 space-y-2 border-t border-slate-200 pt-5 text-sm dark:border-white/10">
                <p className="font-mono text-xs uppercase tracking-wider text-sky-700 dark:text-cyan-400">
                  Adscripción Académica
                </p>
                <p className="font-display font-semibold text-slate-900 dark:text-white">
                  {siteInfo.program}
                </p>
                <p className="text-slate-600 dark:text-slate-400">{siteInfo.institution}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Misión y Visión con los gráficos rescatados */}
      <section className="border-y border-slate-200 bg-slate-100/70 py-20 dark:border-cyan-500/15 dark:bg-[#070c1c]/80">
        <div className="mx-auto max-w-7xl space-y-12 px-4 sm:px-6 lg:px-8">
          {/* Misión */}
          <div className="grid overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-lg lg:grid-cols-12 dark:border-white/10 dark:bg-[#0c142c]">
            <div className="relative min-h-[260px] bg-slate-900 lg:col-span-4">
              <img
                src={siteInfo.images.missionGraphic}
                alt="Representación visual de redes neuronales e inteligencia artificial"
                className="h-full max-h-[380px] w-full object-cover object-center"
              />
              <div className="absolute inset-0 bg-gradient-to-tr from-[#050814]/70 via-transparent to-cyan-500/10" />
            </div>
            <div className="flex flex-col justify-center p-8 sm:p-10 lg:col-span-8">
              <EditableHeadingRegion
                textKey="about.mission"
                eyebrow="Misión"
                title="Generar conocimiento y tecnología con propósito"
                subtitle={labIdentity.mission}
                variant="card"
                subtitleClassName="mt-4 text-base leading-relaxed text-slate-600 dark:text-slate-300"
                eyebrowSlot={(label) => (
                  <div className="inline-flex w-fit items-center gap-2 rounded-xl bg-blue-600/10 px-3 py-1.5 font-mono text-xs font-semibold uppercase tracking-wider text-blue-700 dark:bg-cyan-400/10 dark:text-cyan-300">
                    <Compass className="h-4 w-4" />
                    {label}
                  </div>
                )}
              />
            </div>
          </div>

          {/* Visión */}
          <div className="grid overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-lg lg:grid-cols-12 dark:border-white/10 dark:bg-[#0c142c]">
            <div className="order-2 flex flex-col justify-center p-8 sm:p-10 lg:order-1 lg:col-span-8">
              <EditableHeadingRegion
                textKey="about.vision"
                eyebrow="Visión"
                title="Referente en inteligencia artificial aplicada"
                subtitle={labIdentity.vision}
                variant="card"
                subtitleClassName="mt-4 text-base leading-relaxed text-slate-600 dark:text-slate-300"
                eyebrowSlot={(label) => (
                  <div className="inline-flex w-fit items-center gap-2 rounded-xl bg-violet-600/10 px-3 py-1.5 font-mono text-xs font-semibold uppercase tracking-wider text-violet-700 dark:bg-violet-400/15 dark:text-violet-300">
                    <Eye className="h-4 w-4" />
                    {label}
                  </div>
                )}
              />
            </div>
            <div className="relative order-1 min-h-[260px] bg-slate-900 lg:order-2 lg:col-span-4">
              <img
                src={siteInfo.images.visionGraphic}
                alt="Visión tecnológica de ingeniería e inteligencia artificial"
                className="h-full max-h-[380px] w-full object-cover object-top"
              />
              <div className="absolute inset-0 bg-gradient-to-tl from-[#050814]/70 via-transparent to-violet-500/15" />
            </div>
          </div>
        </div>
      </section>

      {/* Valores */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <SectionHeader
          textKey="about.values"
          eyebrow="Valores"
          title="Principios que definen nuestra cultura científica"
          description="Cada investigación, publicación y prototipo desarrollado en el LIAA se sustenta en nuestros pilares fundamentales."
        />

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {labIdentity.values.map((val) => (
            <div
              key={val.code}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-sky-400 dark:border-white/10 dark:bg-[#0b1229] dark:hover:border-cyan-400/40"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-semibold text-blue-700 dark:text-cyan-400">
                  VAL_{val.code}
                </span>
                <ShieldCheck className="h-5 w-5 text-slate-400 dark:text-cyan-400/60" />
              </div>
              <h3 className="mt-4 font-display text-xl font-bold text-slate-900 dark:text-white">
                {val.title}
              </h3>
              <p className="mt-2.5 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                {val.description}
              </p>
            </div>
          ))}
        </div>

        {/* CTA Banner */}
        <div className="mt-16 flex flex-col items-start justify-between gap-6 rounded-3xl border border-blue-500/25 bg-gradient-to-r from-[#0845ff]/10 via-[#029be6]/10 to-[#6d28d9]/10 p-8 sm:flex-row sm:items-center sm:p-10 dark:border-cyan-400/25 dark:from-[#0845ff]/20 dark:via-[#029be6]/15 dark:to-[#6d28d9]/20">
          <div className="flex-1">
            <EditableHeadingRegion
              textKey="about.cta"
              title="¿Quieres sumarte a nuestras líneas de investigación?"
              subtitle="Explora nuestros proyectos activos y las oportunidades dentro del posgrado PITec."
              showEyebrow={false}
              variant="card"
              subtitleClassName="mt-2 text-sm text-slate-600 dark:text-slate-300"
            />
          </div>
          <Link
            to="/investigacion"
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-gradient-to-r from-[#0845ff] to-[#029be6] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:brightness-110"
          >
            Ver Investigación
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}

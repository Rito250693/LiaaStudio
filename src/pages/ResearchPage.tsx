import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, ExternalLink, FlaskConical, GraduationCap } from 'lucide-react';
import { PageBanner } from '../components/PageBanner';
import { SectionHeader } from '../components/SectionHeader';
import { EditableHeadingRegion } from '../components/EditableTextBlock';
import { ResearchIcon } from '../components/ResearchIcon';
import { useContent } from '../context/ContentContext';

export function ResearchPage() {
  const {
    content: { siteInfo, researchLines, projects },
  } = useContent();
  const [selectedLine, setSelectedLine] = useState<string>('all');

  const filteredProjects =
    selectedLine === 'all'
      ? projects
      : projects.filter((project) => project.lineId === selectedLine);

  const lineTitleMap = Object.fromEntries(researchLines.map((l) => [l.id, l.title]));

  return (
    <div>
      <PageBanner
        textKey="research.banner"
        eyebrow="Investigación y Posgrado"
        title="Líneas de Investigación y Proyectos"
        subtitle="Desarrollamos modelos y sistemas inteligentes orientados a resolver desafíos reales de ingeniería, industria y ciencia desde el PITec de la UAZ."
        breadcrumb="Investigación"
      />

      {/* Research Lines Detailed */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <SectionHeader
          textKey="research.lines"
          eyebrow="Ejes Científicos"
          title="Cuatro pilares de investigación en IA"
          description="Cada línea articula investigación básica y aplicada junto a tesis de maestría, doctorado y proyectos de vinculación."
        />

        <div className="mt-12 grid gap-8 md:grid-cols-2">
          {researchLines.map((line) => (
            <div
              key={line.id}
              className="flex flex-col rounded-3xl border border-slate-200 bg-white p-8 shadow-sm transition hover:border-sky-400 dark:border-white/10 dark:bg-[#0b1229] dark:hover:border-cyan-400/40"
            >
              <div className="flex items-center justify-between">
                <div className="flex h-13 w-13 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0845ff]/15 to-[#00d4ff]/15 text-blue-700 ring-1 ring-blue-500/20 dark:from-[#0845ff]/25 dark:to-[#00d4ff]/20 dark:text-cyan-300 dark:ring-cyan-400/25">
                  <ResearchIcon icon={line.icon} className="h-6 w-6" />
                </div>
                <span className="rounded-full border border-slate-200 px-3 py-1 font-mono text-xs font-medium text-slate-500 dark:border-white/10 dark:text-slate-400">
                  {line.code}
                </span>
              </div>

              <h3 className="mt-6 font-display text-2xl font-bold text-slate-900 dark:text-white">
                {line.title}
              </h3>

              <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                {line.description}
              </p>

              <div className="mt-6 border-t border-slate-200 pt-5 dark:border-white/10">
                <p className="font-mono text-xs uppercase tracking-wider text-sky-700 dark:text-cyan-400">
                  Aplicaciones principales
                </p>
                <ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-400">
                  {line.applications.map((app) => (
                    <li key={app} className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-cyan-400" />
                      <span>{app}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-6 flex flex-wrap gap-2">
                {line.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-lg bg-slate-100 px-2.5 py-1 font-mono text-xs text-slate-700 dark:bg-white/5 dark:text-slate-300"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Projects Filterable Section */}
      <section className="border-y border-slate-200 bg-slate-100/70 py-20 dark:border-cyan-500/15 dark:bg-[#070c1c]/80">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeader
            textKey="research.projects"
            eyebrow="Portafolio Técnico"
            title="Proyectos destacados"
            description="Filtra por línea de investigación para explorar iniciativas activas, prototipos y publicaciones."
          />

          {/* Filter Pills */}
          <div className="mt-8 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSelectedLine('all')}
              className={`rounded-xl px-4 py-2 text-xs font-semibold transition ${
                selectedLine === 'all'
                  ? 'bg-blue-600 text-white shadow-sm dark:bg-cyan-400 dark:text-slate-950'
                  : 'border border-slate-300 bg-white text-slate-700 hover:border-sky-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:border-cyan-400/50'
              }`}
            >
              Todos ({projects.length})
            </button>
            {researchLines.map((line) => (
              <button
                key={line.id}
                type="button"
                onClick={() => setSelectedLine(line.id)}
                className={`rounded-xl px-4 py-2 text-xs font-semibold transition ${
                  selectedLine === line.id
                    ? 'bg-blue-600 text-white shadow-sm dark:bg-cyan-400 dark:text-slate-950'
                    : 'border border-slate-300 bg-white text-slate-700 hover:border-sky-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:border-cyan-400/50'
                }`}
              >
                {line.code} · {line.title.split(' y ')[0]}
              </button>
            ))}
          </div>

          <div className="mt-8 grid gap-6 md:grid-cols-2">
            {filteredProjects.map((project) => (
              <div
                key={project.id}
                className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#0c142c]"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-[11px] font-semibold ${
                      project.status === 'En curso'
                        ? 'bg-emerald-500/10 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300'
                        : project.status === 'Publicado'
                        ? 'bg-blue-500/10 text-blue-700 dark:bg-cyan-400/15 dark:text-cyan-300'
                        : 'bg-violet-500/10 text-violet-700 dark:bg-violet-400/15 dark:text-violet-300'
                    }`}
                  >
                    <FlaskConical className="h-3 w-3" />
                    {project.status}
                  </span>
                  <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                    {project.year}
                  </span>
                </div>

                <h3 className="mt-4 font-display text-xl font-bold text-slate-900 dark:text-white">
                  {project.title}
                </h3>
                <p className="mt-1 font-mono text-xs text-sky-700 dark:text-cyan-400">
                  {lineTitleMap[project.lineId]}
                </p>

                <p className="mt-3 flex-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  {project.summary}
                </p>

                <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-200 pt-4 dark:border-white/10">
                  {project.technologies.map((tech) => (
                    <span
                      key={tech}
                      className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-0.5 font-mono text-[11px] text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
                    >
                      {tech}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Posgrado PITec Spotlight */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="grid items-center gap-10 overflow-hidden rounded-3xl border border-slate-200 bg-white p-8 shadow-xl sm:p-10 lg:grid-cols-12 dark:border-cyan-400/20 dark:bg-[#0b1229]">
          <div className="lg:col-span-7">
            <EditableHeadingRegion
              textKey="research.posgrado"
              eyebrow="Posgrado · UAZ"
              title={siteInfo.degrees}
              subtitle="El LIAA forma parte del ecosistema académico del PITec en la Universidad Autónoma de Zacatecas. Estudiantes de licenciatura, maestría y doctorado pueden integrarse mediante proyectos de tesis, estancias de investigación o servicio social especializado."
              variant="card"
              subtitleClassName="mt-4 text-sm leading-relaxed text-slate-600 sm:text-base dark:text-slate-300"
              eyebrowSlot={(label) => (
                <div className="inline-flex items-center gap-2 rounded-full bg-blue-600/10 px-3 py-1 font-mono text-xs font-semibold uppercase tracking-wider text-blue-700 dark:bg-cyan-400/10 dark:text-cyan-300">
                  <GraduationCap className="h-4 w-4" />
                  {label}
                </div>
              )}
            />
            <div className="mt-7 flex flex-wrap gap-3">
              <a
                href={siteInfo.pitecUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#0845ff] to-[#029be6] px-5 py-3 text-sm font-semibold text-white shadow-md shadow-blue-600/20 transition hover:brightness-110"
              >
                Sitio Oficial PITec
                <ExternalLink className="h-4 w-4" />
              </a>
              <Link
                to="/contacto"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-800 transition hover:border-sky-500 dark:border-white/15 dark:text-white dark:hover:border-cyan-400/50"
              >
                Solicitar información
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="lg:col-span-5">
            <img
              src={siteInfo.images.pitecBuilding}
              alt="Instalaciones del PITec UAZ"
              className="aspect-[16/10] w-full rounded-2xl object-cover shadow-lg ring-1 ring-slate-200 dark:ring-white/10"
            />
          </div>
        </div>
      </section>
    </div>
  );
}

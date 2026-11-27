import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Calendar, Search, User } from 'lucide-react';
import { PageBanner } from '../components/PageBanner';
import { type NewsArticle } from '../data/siteData';
import { useContent } from '../context/ContentContext';

const CATEGORIES: Array<'Todas' | NewsArticle['category']> = [
  'Todas',
  'Institucional',
  'Convocatorias',
  'Eventos',
  'Investigación',
];

export function NewsPage() {
  const {
    content: { newsArticles },
  } = useContent();
  const [category, setCategory] = useState<'Todas' | NewsArticle['category']>('Todas');
  const [query, setQuery] = useState('');

  const filteredArticles = useMemo(() => {
    return newsArticles.filter((article) => {
      const matchesCategory = category === 'Todas' || article.category === category;
      const q = query.trim().toLowerCase();
      const matchesQuery =
        !q ||
        article.title.toLowerCase().includes(q) ||
        article.excerpt.toLowerCase().includes(q) ||
        article.category.toLowerCase().includes(q);
      return matchesCategory && matchesQuery;
    });
  }, [category, query, newsArticles]);

  return (
    <div>
      <PageBanner
        textKey="news.banner"
        eyebrow="Divulgación y Anuncios"
        title="Noticias y Eventos"
        subtitle="Mantente al día con las novedades del Laboratorio de Inteligencia Artificial Avanzada, convocatorias de tesis, seminarios y comunicados de la UAZ."
        breadcrumb="Noticias"
      />

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        {/* Controls */}
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className={`rounded-xl px-4 py-2 text-xs font-semibold transition ${
                  category === cat
                    ? 'bg-blue-600 text-white shadow-sm dark:bg-cyan-400 dark:text-slate-950'
                    : 'border border-slate-300 bg-white text-slate-700 hover:border-sky-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:border-cyan-400/50'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="relative w-full md:w-72">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar noticias..."
              aria-label="Buscar noticias"
              className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none dark:border-white/15 dark:bg-[#0b1229] dark:text-white dark:focus:border-cyan-400"
            />
          </div>
        </div>

        {/* Articles Grid */}
        {filteredArticles.length === 0 ? (
          <div className="mt-12 rounded-3xl border border-dashed border-slate-300 p-12 text-center dark:border-white/15">
            <p className="font-display text-lg font-semibold text-slate-900 dark:text-white">
              No se encontraron publicaciones
            </p>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Prueba con otra categoría o un término de búsqueda diferente.
            </p>
          </div>
        ) : (
          <div className="mt-10 grid gap-8 md:grid-cols-2">
            {filteredArticles.map((article) => (
              <article
                key={article.slug}
                className="group flex flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:border-sky-400 dark:border-white/10 dark:bg-[#0b1229] dark:hover:border-cyan-400/40"
              >
                <Link
                  to={`/noticias/${article.slug}`}
                  className="relative block aspect-[16/9] overflow-hidden bg-slate-900"
                >
                  <img
                    src={article.image}
                    alt={article.title}
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  />
                  <span className="absolute left-4 top-4 rounded-lg bg-[#050814]/80 px-3 py-1 font-mono text-xs font-medium text-cyan-300 backdrop-blur">
                    {article.category}
                  </span>
                </Link>

                <div className="flex flex-1 flex-col p-7">
                  <div className="flex flex-wrap items-center gap-4 font-mono text-xs text-slate-500 dark:text-slate-400">
                    <span className="inline-flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" />
                      {article.date}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5" />
                      {article.author}
                    </span>
                  </div>

                  <h2 className="mt-3 font-display text-2xl font-bold leading-snug text-slate-900 transition group-hover:text-blue-700 dark:text-white dark:group-hover:text-cyan-300">
                    <Link to={`/noticias/${article.slug}`}>{article.title}</Link>
                  </h2>

                  <p className="mt-3 flex-1 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                    {article.excerpt}
                  </p>

                  <Link
                    to={`/noticias/${article.slug}`}
                    className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-blue-700 transition group-hover:gap-2.5 dark:text-cyan-300"
                  >
                    Leer nota completa
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

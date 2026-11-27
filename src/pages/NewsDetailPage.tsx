import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Calendar, Check, Share2, User } from 'lucide-react';
import { useContent } from '../context/ContentContext';

export function NewsDetailPage() {
  const { slug } = useParams();
  const {
    content: { newsArticles },
  } = useContent();
  const [copied, setCopied] = useState(false);

  const article = newsArticles.find((item) => item.slug === slug);

  if (!article) {
    return (
      <section className="mx-auto max-w-3xl px-4 py-24 text-center sm:px-6">
        <p className="font-mono text-xs uppercase tracking-widest text-sky-700 dark:text-cyan-400">
          Artículo no encontrado
        </p>
        <h1 className="mt-3 font-display text-3xl font-bold text-slate-900 dark:text-white">
          Esta publicación no existe o fue movida
        </h1>
        <Link
          to="/noticias"
          className="mt-8 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a Noticias
        </Link>
      </section>
    );
  }

  const related = newsArticles.filter((item) => item.slug !== article.slug).slice(0, 2);

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Ignore clipboard failures
    }
  };

  return (
    <article className="mx-auto max-w-4xl px-4 py-14 sm:px-6 lg:px-8">
      <Link
        to="/noticias"
        className="inline-flex items-center gap-2 font-mono text-xs font-medium text-slate-500 transition hover:text-blue-600 dark:text-slate-400 dark:hover:text-cyan-300"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Volver a Noticias
      </Link>

      <div className="mt-6">
        <span className="inline-block rounded-full border border-sky-500/25 bg-sky-500/10 px-3 py-1 font-mono text-xs font-medium uppercase tracking-widest text-sky-700 dark:border-cyan-400/25 dark:bg-cyan-400/10 dark:text-cyan-300">
          {article.category}
        </span>
        <h1 className="mt-4 font-display text-3xl font-bold tracking-tight text-slate-900 sm:text-5xl dark:text-white">
          {article.title}
        </h1>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-y border-slate-200 py-4 text-xs text-slate-500 dark:border-white/10 dark:text-slate-400">
          <div className="flex flex-wrap items-center gap-5 font-mono">
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="h-4 w-4 text-blue-600 dark:text-cyan-400" />
              {article.date}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <User className="h-4 w-4 text-blue-600 dark:text-cyan-400" />
              {article.author}
            </span>
          </div>

          <button
            type="button"
            onClick={handleShare}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 font-medium text-slate-700 transition hover:border-sky-500 dark:border-white/15 dark:text-slate-200 dark:hover:border-cyan-400/50"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-500" />
                Enlace copiado
              </>
            ) : (
              <>
                <Share2 className="h-3.5 w-3.5" />
                Compartir enlace
              </>
            )}
          </button>
        </div>
      </div>

      <div className="mt-8 overflow-hidden rounded-3xl border border-slate-200 bg-slate-900 shadow-lg dark:border-white/10">
        <img
          src={article.image}
          alt={article.title}
          className="max-h-[460px] w-full object-cover"
        />
      </div>

      <div className="mt-10 space-y-5 text-base leading-relaxed text-slate-700 sm:text-lg dark:text-slate-300">
        {article.content.map((paragraph, index) => (
          <p key={index}>{paragraph}</p>
        ))}
      </div>

      {/* Related */}
      <div className="mt-16 border-t border-slate-200 pt-10 dark:border-white/10">
        <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">
          Otras noticias del LIAA
        </h2>
        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          {related.map((item) => (
            <Link
              key={item.slug}
              to={`/noticias/${item.slug}`}
              className="group rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-sky-400 dark:border-white/10 dark:bg-[#0b1229] dark:hover:border-cyan-400/40"
            >
              <span className="font-mono text-[11px] text-sky-700 dark:text-cyan-400">
                {item.category} · {item.date}
              </span>
              <h3 className="mt-2 font-display text-base font-bold text-slate-900 transition group-hover:text-blue-700 dark:text-white dark:group-hover:text-cyan-300">
                {item.title}
              </h3>
            </Link>
          ))}
        </div>
      </div>
    </article>
  );
}

import { Link } from 'react-router-dom';
import { ExternalLink, Lock, Mail, MapPin, Phone } from 'lucide-react';
import { useContent } from '../context/ContentContext';

export function Footer() {
  const year = new Date().getFullYear();
  const {
    content: { siteInfo, navItems },
  } = useContent();
  const visibleNav = navItems.filter((item) => item.visible);

  return (
    <footer className="border-t border-slate-200 bg-slate-100/80 dark:border-cyan-500/15 dark:bg-[#040711]">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          {/* Brand Column */}
          <div className="lg:col-span-2">
            <Link to="/" className="inline-flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 bg-white p-1.5 dark:border-cyan-400/25 dark:bg-slate-900">
                <img
                  src={siteInfo.images.emblem}
                  alt={`Emblema ${siteInfo.acronym}`}
                  className="h-full w-full object-contain"
                />
              </div>
              <div>
                <p className="font-display text-lg font-bold text-slate-900 dark:text-white">
                  {siteInfo.acronym} · {siteInfo.institutionShort}
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  {siteInfo.fullName}
                </p>
              </div>
            </Link>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              Investigación aplicada, formación de posgrado y desarrollo de sistemas inteligentes
              en el {siteInfo.program} de la {siteInfo.institution}.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <a
                href={siteInfo.pitecUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-sky-500 hover:text-blue-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:border-cyan-400/50 dark:hover:text-cyan-300"
              >
                Portal PITec UAZ
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
              <a
                href={siteInfo.socials.uaz}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-sky-500 hover:text-blue-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:border-cyan-400/50 dark:hover:text-cyan-300"
              >
                Sitio Oficial UAZ
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>

          {/* Navigation Column */}
          <div>
            <h3 className="font-mono text-xs font-semibold uppercase tracking-widest text-sky-700 dark:text-cyan-400">
              Navegación
            </h3>
            <ul className="mt-4 space-y-2.5 text-sm">
              {visibleNav.map((item) => (
                <li key={item.id}>
                  <Link
                    to={item.path}
                    className="text-slate-600 transition hover:text-blue-600 dark:text-slate-400 dark:hover:text-cyan-300"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact Column */}
          <div>
            <h3 className="font-mono text-xs font-semibold uppercase tracking-widest text-sky-700 dark:text-cyan-400">
              Sede PITec · UAZ
            </h3>
            <ul className="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-400">
              <li className="flex items-start gap-2.5">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-cyan-400" />
                <span>{siteInfo.shortAddress}</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Phone className="h-4 w-4 shrink-0 text-blue-600 dark:text-cyan-400" />
                <span>{siteInfo.phone}</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Mail className="h-4 w-4 shrink-0 text-blue-600 dark:text-cyan-400" />
                <a
                  href={`mailto:${siteInfo.email}`}
                  className="transition hover:text-blue-600 dark:hover:text-cyan-300"
                >
                  {siteInfo.email}
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-slate-200 pt-6 text-xs text-slate-500 sm:flex-row dark:border-white/10 dark:text-slate-500">
          <p>
            © {year} {siteInfo.fullName} ({siteInfo.acronym}) — {siteInfo.institution}.
          </p>
          <div className="flex items-center gap-4">
            <span className="font-mono">Zacatecas, México · PITec</span>
            <Link
              to="/admin"
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-slate-400 transition hover:bg-slate-200/70 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-white/5 dark:hover:text-cyan-300"
              title="Panel de Administrador"
            >
              <Lock className="h-3 w-3" />
              Admin
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

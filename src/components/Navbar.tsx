import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Menu, Moon, Sun, X } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useContent } from '../context/ContentContext';
import { useAuth } from '../context/AuthContext';

export function Navbar() {
  const { theme, toggleTheme } = useTheme();
  const { authenticated } = useAuth();
  const {
    content: { siteInfo, navItems },
  } = useContent();
  const [mobileOpen, setMobileOpen] = useState(false);

  const visibleNav = navItems.filter((item) => item.visible);

  return (
    <header
      className={`sticky z-50 border-b border-slate-200/80 bg-white/80 backdrop-blur-xl transition-colors dark:border-cyan-500/15 dark:bg-[#050814]/80 ${
        authenticated ? 'top-12' : 'top-0'
      }`}
    >
      <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand */}
        <Link
          to="/"
          onClick={() => setMobileOpen(false)}
          className="group flex items-center gap-3 focus:outline-none"
        >
          <div className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm transition-transform duration-300 group-hover:scale-105 dark:border-cyan-400/25 dark:bg-slate-900/90 dark:shadow-cyan-500/10">
            <img
              src={siteInfo.images.emblem}
              alt={`Emblema ${siteInfo.acronym}`}
              className="h-full w-full object-contain"
            />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="font-display text-lg font-bold tracking-tight text-slate-900 dark:text-white">
              {siteInfo.acronym}
              <span className="ml-2 rounded-md border border-cyan-500/30 bg-cyan-500/10 px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider text-sky-700 dark:text-cyan-300">
                {siteInfo.institutionShort}
              </span>
            </span>
            <span className="hidden text-xs text-slate-500 sm:block dark:text-slate-400">
              Lab. de Inteligencia Artificial Avanzada
            </span>
          </div>
        </Link>

        {/* Dynamic Desktop Nav */}
        <nav className="hidden items-center gap-1 md:flex" aria-label="Navegación principal">
          {visibleNav.map((item) => (
            <NavLink
              key={item.id}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                `relative rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-sky-500/10 text-blue-700 dark:bg-cyan-400/10 dark:text-cyan-300'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Right Controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-100/80 text-slate-700 transition hover:border-sky-400 hover:text-blue-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:border-cyan-400/50 dark:hover:text-cyan-300"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          <Link
            to="/contacto"
            className="hidden rounded-xl bg-gradient-to-r from-[#0845ff] to-[#029be6] px-4 py-2 text-sm font-semibold text-white shadow-md shadow-blue-600/20 transition hover:brightness-110 lg:inline-flex"
          >
            Colaborar
          </Link>

          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Abrir menú de navegación"
            aria-expanded={mobileOpen}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-100/80 text-slate-700 md:hidden dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Nav Drawer */}
      {mobileOpen && (
        <div className="border-t border-slate-200 bg-white px-4 pb-5 pt-3 md:hidden dark:border-white/10 dark:bg-[#080d1f]">
          <nav className="flex flex-col gap-1" aria-label="Navegación móvil">
            {visibleNav.map((item) => (
              <NavLink
                key={item.id}
                to={item.path}
                end={item.path === '/'}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-sky-500/10 text-blue-700 dark:bg-cyan-400/10 dark:text-cyan-300'
                      : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
            <Link
              to="/contacto"
              onClick={() => setMobileOpen(false)}
              className="mt-2 inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-[#0845ff] to-[#029be6] px-4 py-2.5 text-sm font-semibold text-white"
            >
              Colaborar con el LIAA
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}

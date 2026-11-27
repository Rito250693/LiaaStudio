import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export function NotFoundPage() {
  return (
    <section className="mx-auto flex min-h-[65vh] max-w-3xl flex-col items-center justify-center px-4 py-20 text-center">
      <p className="font-mono text-sm font-semibold uppercase tracking-widest text-blue-600 dark:text-cyan-400">
        Error 404
      </p>
      <h1 className="mt-3 font-display text-4xl font-bold text-slate-900 sm:text-5xl dark:text-white">
        Página no encontrada
      </h1>
      <p className="mt-4 max-w-md text-sm text-slate-600 dark:text-slate-400">
        La ruta que buscas no existe dentro del portal del Laboratorio de Inteligencia Artificial
        Avanzada.
      </p>
      <Link
        to="/"
        className="mt-8 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#0845ff] to-[#029be6] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/20"
      >
        <ArrowLeft className="h-4 w-4" />
        Regresar al Inicio
      </Link>
    </section>
  );
}

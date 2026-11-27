import { useCallback, useEffect, useState } from 'react';
import { Activity, Loader2, RefreshCw, Search, ShieldAlert } from 'lucide-react';

interface AuditEntry {
  id: number;
  actorId: string | null;
  actorUsername: string;
  actorRole: string;
  action: string;
  resourceType: string;
  resourceId: string;
  details: Record<string, unknown>;
  ip: string;
  createdAt: string;
}

const ACTION_FILTERS = [
  { value: '', label: 'Todas las acciones' },
  { value: 'auth.', label: 'Accesos y 2FA' },
  { value: 'user.', label: 'Usuarios' },
  { value: 'role.', label: 'Roles y Permisos' },
  { value: 'content.', label: 'Diseño y Contenido' },
  { value: 'news.', label: 'Noticias' },
  { value: 'media.', label: 'Multimedia' },
];

export function AuditLogTab({ initialActor = '' }: { initialActor?: string }) {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [actorQuery, setActorQuery] = useState(initialActor);
  const [actionFilter, setActionFilter] = useState('');

  useEffect(() => {
    setActorQuery(initialActor);
  }, [initialActor]);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (actorQuery.trim()) qs.set('actor', actorQuery.trim());
      if (actionFilter) qs.set('action', actionFilter);
      qs.set('limit', '100');

      const res = await fetch(`/api/audit?${qs.toString()}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } finally {
      setLoading(false);
    }
  }, [actorQuery, actionFilter]);

  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  const badgeTone = (action: string) => {
    if (action.includes('failed') || action.includes('deleted') || action.includes('revoked')) {
      return 'bg-rose-500/15 text-rose-600 dark:text-rose-300';
    }
    if (action.startsWith('auth.') || action.startsWith('role.')) {
      return 'bg-amber-500/15 text-amber-700 dark:text-amber-300';
    }
    if (action.startsWith('user.')) {
      return 'bg-violet-500/15 text-violet-700 dark:text-violet-300';
    }
    return 'bg-cyan-500/15 text-sky-700 dark:text-cyan-300';
  };

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 dark:border-white/10 dark:bg-[#0b1229]">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600/10 text-blue-600 dark:bg-cyan-400/15 dark:text-cyan-300">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-xl font-bold">Registro de Auditoría</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Historial de seguridad y modificaciones: quién hizo qué, sobre qué recurso y cuándo.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void fetchLogs()}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:border-sky-500 dark:border-white/15 dark:bg-white/5 dark:text-slate-200"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Actualizar
        </button>
      </div>

      {/* Filters */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={actorQuery}
            onChange={(e) => setActorQuery(e.target.value)}
            placeholder="Filtrar por usuario..."
            className="w-full rounded-xl border border-slate-300 bg-slate-50 py-2.5 pl-10 pr-4 text-xs dark:border-white/15 dark:bg-white/5 dark:text-white"
          />
        </div>

        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold dark:border-white/15 dark:bg-[#070c1c] dark:text-white"
        >
          {ACTION_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="mt-6 overflow-x-auto">
        {loading ? (
          <div className="py-12 text-center">
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-cyan-400" />
          </div>
        ) : logs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 py-12 text-center dark:border-white/15">
            <ShieldAlert className="mx-auto h-8 w-8 text-slate-400" />
            <p className="mt-2 text-xs text-slate-500">
              No hay eventos de auditoría para este filtro.
            </p>
          </div>
        ) : (
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 font-mono text-[10px] uppercase tracking-wider text-slate-500 dark:border-white/10">
                <th className="pb-3 pr-4">Fecha / Hora</th>
                <th className="pb-3 pr-4">Usuario</th>
                <th className="pb-3 pr-4">Acción</th>
                <th className="pb-3 pr-4">Recurso</th>
                <th className="pb-3 pr-4">Detalles</th>
                <th className="pb-3">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70 dark:divide-white/5">
              {logs.map((entry) => (
                <tr key={entry.id} className="hover:bg-slate-50/70 dark:hover:bg-white/[0.02]">
                  <td className="whitespace-nowrap py-3 pr-4 font-mono text-[11px] text-slate-500">
                    {new Date(entry.createdAt).toLocaleString('es-MX')}
                  </td>
                  <td className="whitespace-nowrap py-3 pr-4">
                    <span className="font-semibold text-slate-900 dark:text-white">
                      @{entry.actorUsername || 'system'}
                    </span>
                    {entry.actorRole && (
                      <span className="ml-1.5 rounded bg-slate-200/80 px-1.5 py-0.5 font-mono text-[10px] text-slate-600 dark:bg-white/10 dark:text-slate-300">
                        {entry.actorRole}
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap py-3 pr-4">
                    <span
                      className={`inline-block rounded-md px-2 py-0.5 font-mono text-[11px] font-semibold ${badgeTone(
                        entry.action,
                      )}`}
                    >
                      {entry.action}
                    </span>
                  </td>
                  <td className="whitespace-nowrap py-3 pr-4 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                    {entry.resourceType}
                    {entry.resourceId ? ` · ${entry.resourceId.slice(0, 18)}` : ''}
                  </td>
                  <td className="max-w-xs truncate py-3 pr-4 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                    {Object.keys(entry.details || {}).length > 0
                      ? JSON.stringify(entry.details)
                      : '—'}
                  </td>
                  <td className="whitespace-nowrap py-3 font-mono text-[11px] text-slate-400">
                    {entry.ip || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

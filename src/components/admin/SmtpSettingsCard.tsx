import { useEffect, useState, type FormEvent } from 'react';
import {
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  Save,
  Send,
  ShieldCheck,
} from 'lucide-react';
import { apiFetch } from '../../utils/apiClient';

interface SmtpSettingsCardProps {
  defaultTestEmail?: string;
  showToast: (type: 'success' | 'error', text: string) => void;
}

interface SmtpApiPayload {
  configured: boolean;
  source: 'database' | 'env' | 'none';
  config: {
    enabled: boolean;
    host: string;
    port: number;
    secure: boolean;
    user: string;
    hasPassword: boolean;
    from: string;
    publicUrl: string;
  };
}

export function SmtpSettingsCard({ defaultTestEmail = '', showToast }: SmtpSettingsCardProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const [configured, setConfigured] = useState(false);
  const [source, setSource] = useState<'database' | 'env' | 'none'>('none');
  const [enabled, setEnabled] = useState(true);
  const [host, setHost] = useState('smtp.gmail.com');
  const [port, setPort] = useState(587);
  const [secure, setSecure] = useState(false);
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [hasPassword, setHasPassword] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [from, setFrom] = useState('');
  const [publicUrl, setPublicUrl] = useState(
    typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173',
  );

  const [testEmail, setTestEmail] = useState(defaultTestEmail);
  const [testResult, setTestResult] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null,
  );

  useEffect(() => {
    if (defaultTestEmail && !testEmail) {
      setTestEmail(defaultTestEmail);
    }
  }, [defaultTestEmail, testEmail]);

  useEffect(() => {
    let active = true;
    fetch('/api/settings/smtp', { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) return;
        const data = (await res.json()) as SmtpApiPayload;
        if (!active || !data.config) return;
        setConfigured(Boolean(data.configured));
        setSource(data.source || 'none');
        setEnabled(data.config.enabled !== false);
        if (data.config.host) setHost(data.config.host);
        if (data.config.port) setPort(data.config.port);
        setSecure(Boolean(data.config.secure));
        setUser(data.config.user || '');
        setHasPassword(Boolean(data.config.hasPassword));
        setFrom(data.config.from || '');
        setPublicUrl(
          data.config.publicUrl ||
            (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173'),
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const applyPreset = (preset: 'gmail' | 'outlook' | 'custom') => {
    setEnabled(true);
    if (preset === 'gmail') {
      setHost('smtp.gmail.com');
      setPort(587);
      setSecure(false);
    } else if (preset === 'outlook') {
      setHost('smtp.office365.com');
      setPort(587);
      setSecure(false);
    } else {
      setHost('');
      setPort(587);
      setSecure(false);
    }
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setTestResult(null);
    try {
      const res = await apiFetch('/api/settings/smtp', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled,
          host: host.trim(),
          port: Number(port),
          secure,
          user: user.trim(),
          pass,
          from: from.trim(),
          publicUrl: publicUrl.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo guardar la configuración SMTP.');
      setConfigured(Boolean(data.configured));
      setSource(data.source || 'none');
      setHasPassword(Boolean(data.config?.hasPassword));
      setPass('');
      showToast('success', 'Configuración de correo SMTP guardada y cifrada correctamente.');
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Error guardando SMTP.');
    } finally {
      setSaving(false);
    }
  };

  const handleSendTest = async () => {
    if (!testEmail.trim()) {
      showToast('error', 'Escribe un correo destinatario para enviar la prueba.');
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const res = await apiFetch('/api/settings/smtp/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: testEmail.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = data.error || 'Falló el envío de correo de prueba.';
        setTestResult({ type: 'error', text: msg });
        showToast('error', msg);
        return;
      }
      setTestResult({ type: 'success', text: data.message });
      showToast('success', data.message);
    } catch {
      const msg = 'Error de conexión al probar el envío SMTP.';
      setTestResult({ type: 'error', text: msg });
      showToast('error', msg);
    } finally {
      setTesting(false);
    }
  };

  const isGmailHost =
    host.toLowerCase().includes('gmail') || host.toLowerCase().includes('google');

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 dark:border-white/10 dark:bg-[#0b1229]">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5 dark:border-white/10">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-500/15 text-sky-700 dark:text-cyan-300">
            <Mail className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-xl font-bold">
              Correo Saliente (SMTP) y Recuperación de Contraseñas
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Configura la cuenta desde la cual el LIAA enviará enlaces de recuperación de
              contraseña. La contraseña se guarda cifrada con <strong>AES-256-GCM</strong>.
            </p>
          </div>
        </div>

        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-[11px] font-semibold ${
            configured
              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
              : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
          }`}
        >
          <ShieldCheck className="h-3.5 w-3.5" />
          {configured
            ? source === 'database'
              ? 'SMTP Activo (Panel)'
              : 'SMTP Activo (.env)'
            : 'Sin configurar'}
        </span>
      </div>

      {loading ? (
        <div className="py-10 text-center">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-cyan-400" />
        </div>
      ) : (
        <form onSubmit={handleSave} className="mt-6 space-y-5">
          {/* Quick Presets */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Plantilla rápida:
            </span>
            <button
              type="button"
              onClick={() => applyPreset('gmail')}
              className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                host === 'smtp.gmail.com'
                  ? 'border-cyan-400 bg-cyan-500/15 text-sky-700 dark:text-cyan-300'
                  : 'border-slate-300 text-slate-700 hover:border-cyan-400 dark:border-white/15 dark:text-slate-300'
              }`}
            >
              Gmail / Google Workspace (@uaz.edu.mx)
            </button>
            <button
              type="button"
              onClick={() => applyPreset('outlook')}
              className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                host === 'smtp.office365.com'
                  ? 'border-cyan-400 bg-cyan-500/15 text-sky-700 dark:text-cyan-300'
                  : 'border-slate-300 text-slate-700 hover:border-cyan-400 dark:border-white/15 dark:text-slate-300'
              }`}
            >
              Outlook / Office 365
            </button>
            <button
              type="button"
              onClick={() => applyPreset('custom')}
              className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-cyan-400 dark:border-white/15 dark:text-slate-300"
            >
              Otro servidor SMTP
            </button>
          </div>

          {isGmailHost && (
            <div className="rounded-2xl border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-xs leading-relaxed text-sky-900 dark:text-cyan-200">
              <strong>Importante para Gmail / cuentas Google (@uaz.edu.mx):</strong> activa la
              verificación en 2 pasos en tu cuenta de Google y genera una{' '}
              <strong>Contraseña de aplicación (16 caracteres)</strong> en{' '}
              <a
                href="https://myaccount.google.com/apppasswords"
                target="_blank"
                rel="noreferrer"
                className="font-semibold underline"
              >
                myaccount.google.com/apppasswords
              </a>
              . Google no acepta tu contraseña normal por SMTP.
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                Servidor SMTP (Host)
              </label>
              <input
                type="text"
                required={enabled}
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="smtp.gmail.com"
                className="mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-cyan-500 focus:bg-white focus:outline-none dark:border-white/15 dark:bg-white/5 dark:text-white dark:focus:bg-[#0f1936]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                Puerto
              </label>
              <input
                type="number"
                min={1}
                max={65535}
                required={enabled}
                value={port}
                onChange={(e) => {
                  const nextPort = Number(e.target.value || 587);
                  setPort(nextPort);
                  setSecure(nextPort === 465);
                }}
                className="mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 font-mono text-sm text-slate-900 focus:border-cyan-500 focus:bg-white focus:outline-none dark:border-white/15 dark:bg-white/5 dark:text-white dark:focus:bg-[#0f1936]"
              />
            </div>

            <div className="flex flex-col justify-end gap-2 pb-1">
              <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200">
                <input
                  type="checkbox"
                  checked={secure}
                  onChange={(e) => setSecure(e.target.checked)}
                  className="h-4 w-4 rounded accent-cyan-500"
                />
                SSL/TLS directo (puerto 465)
              </label>
              <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                  className="h-4 w-4 rounded accent-cyan-500"
                />
                Habilitar envío SMTP
              </label>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                Correo / Usuario SMTP
              </label>
              <input
                type="text"
                required={enabled}
                autoComplete="off"
                value={user}
                onChange={(e) => {
                  const val = e.target.value;
                  setUser(val);
                  if (!from || from === 'no-reply@liaa.uaz.edu.mx') {
                    setFrom(val ? `LIAA Studio UAZ <${val}>` : '');
                  }
                }}
                placeholder="liaa@uaz.edu.mx o tu_correo@gmail.com"
                className="mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-cyan-500 focus:bg-white focus:outline-none dark:border-white/15 dark:bg-white/5 dark:text-white dark:focus:bg-[#0f1936]"
              />
            </div>

            <div>
              <label className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                <span>Contraseña SMTP / App Password</span>
                {hasPassword && (
                  <span className="inline-flex items-center gap-1 font-mono text-[10px] font-semibold normal-case text-emerald-600 dark:text-emerald-400">
                    <Lock className="h-3 w-3" /> Guardada cifrada
                  </span>
                )}
              </label>
              <div className="relative mt-1.5">
                <input
                  type={showPass ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={pass}
                  onChange={(e) => {
                    setPass(e.target.value);
                    if (e.target.value.trim()) setEnabled(true);
                  }}
                  placeholder={
                    hasPassword
                      ? '•••••••••••• (deja vacío para conservar la actual)'
                      : 'Contraseña de aplicación de 16 caracteres'
                  }
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 py-2.5 pl-3.5 pr-10 text-sm text-slate-900 focus:border-cyan-500 focus:bg-white focus:outline-none dark:border-white/15 dark:bg-white/5 dark:text-white dark:focus:bg-[#0f1936]"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                >
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                Remitente visible (From)
              </label>
              <input
                type="text"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                placeholder='LIAA Studio UAZ <liaa@uaz.edu.mx>'
                className="mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-cyan-500 focus:bg-white focus:outline-none dark:border-white/15 dark:bg-white/5 dark:text-white dark:focus:bg-[#0f1936]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                URL pública del portal (para enlaces de correo)
              </label>
              <input
                type="url"
                value={publicUrl}
                onChange={(e) => setPublicUrl(e.target.value)}
                placeholder="http://localhost:5173"
                className="mt-1.5 w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 font-mono text-sm text-slate-900 focus:border-cyan-500 focus:bg-white focus:outline-none dark:border-white/15 dark:bg-white/5 dark:text-white dark:focus:bg-[#0f1936]"
              />
            </div>
          </div>

          {!configured && hasPassword && !enabled && (
            <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-xs font-medium text-amber-800 dark:text-amber-200">
              Tu contraseña ya está guardada cifrada, pero la casilla{' '}
              <strong>&quot;Habilitar envío SMTP&quot;</strong> está desmarcada. Márcala y haz clic
              en <strong>Guardar configuración SMTP</strong> para activar el botón de correo de
              prueba.
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 pt-5 dark:border-white/10">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#0845ff] to-[#029be6] px-5 py-2.5 text-xs font-semibold text-white shadow-md hover:brightness-110 disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? 'Guardando SMTP...' : 'Guardar configuración SMTP'}
            </button>

            {/* Test Email Bar */}
            <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
              <input
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="correo_prueba@uaz.edu.mx"
                className="w-full max-w-xs rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-xs text-slate-900 focus:border-cyan-500 focus:bg-white focus:outline-none dark:border-white/15 dark:bg-white/5 dark:text-white dark:focus:bg-[#0f1936]"
              />
              <button
                type="button"
                disabled={testing || !configured}
                onClick={() => void handleSendTest()}
                className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:text-emerald-300"
              >
                {testing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                {testing ? 'Enviando...' : 'Enviar correo de prueba'}
              </button>
            </div>
          </div>

          {testResult && (
            <div
              className={`flex items-start gap-2 rounded-2xl border px-4 py-3 text-xs font-medium ${
                testResult.type === 'success'
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                  : 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300'
              }`}
            >
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{testResult.text}</span>
            </div>
          )}
        </form>
      )}
    </div>
  );
}

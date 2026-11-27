import { useState, type FormEvent } from 'react';
import { CheckCircle2, Clock, ExternalLink, Mail, MapPin, Phone, Send } from 'lucide-react';
import { PageBanner } from '../components/PageBanner';
import { EditableHeadingRegion } from '../components/EditableTextBlock';
import { useContent } from '../context/ContentContext';

export function ContactPage() {
  const {
    content: { siteInfo },
  } = useContent();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [topic, setTopic] = useState('Tesis o Estancia de Investigación');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) return;
    setSubmitted(true);
  };

  const mailtoHref = `mailto:${siteInfo.email}?subject=${encodeURIComponent(
    `[LIAA Web] ${topic} - ${name}`,
  )}&body=${encodeURIComponent(`Nombre: ${name}\nCorreo: ${email}\nMotivo: ${topic}\n\n${message}`)}`;

  return (
    <div>
      <PageBanner
        textKey="contact.banner"
        eyebrow="Contacto y Vinculación"
        title="Ponte en contacto con el LIAA"
        subtitle="Escríbenos para colaborar en proyectos de investigación, proponer temas de tesis o conocer el proceso de admisión al posgrado PITec."
        breadcrumb="Contacto"
      />

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        {/* Info Cards */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#0b1229]">
            <MapPin className="h-6 w-6 text-blue-600 dark:text-cyan-400" />
            <h2 className="mt-4 font-display text-base font-bold text-slate-900 dark:text-white">
              Dirección
            </h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{siteInfo.address}</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#0b1229]">
            <Phone className="h-6 w-6 text-blue-600 dark:text-cyan-400" />
            <h2 className="mt-4 font-display text-base font-bold text-slate-900 dark:text-white">
              Teléfono PITec
            </h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{siteInfo.phone}</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#0b1229]">
            <Mail className="h-6 w-6 text-blue-600 dark:text-cyan-400" />
            <h2 className="mt-4 font-display text-base font-bold text-slate-900 dark:text-white">
              Correo Electrónico
            </h2>
            <a
              href={`mailto:${siteInfo.email}`}
              className="mt-2 block text-sm font-medium text-blue-700 hover:underline dark:text-cyan-300"
            >
              {siteInfo.email}
            </a>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#0b1229]">
            <Clock className="h-6 w-6 text-blue-600 dark:text-cyan-400" />
            <h2 className="mt-4 font-display text-base font-bold text-slate-900 dark:text-white">
              Horario de Atención
            </h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{siteInfo.schedule}</p>
          </div>
        </div>

        {/* Form + Map */}
        <div className="mt-12 grid gap-10 lg:grid-cols-12">
          <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-lg sm:p-10 lg:col-span-6 dark:border-cyan-400/20 dark:bg-[#0b1229]">
            <EditableHeadingRegion
              textKey="contact.form"
              title="Envíanos un mensaje"
              subtitle="Completa el formulario y prepara tu consulta para el equipo del LIAA · PITec."
              showEyebrow={false}
              variant="card"
              subtitleClassName="mt-2 text-sm text-slate-600 dark:text-slate-400"
            />

            {submitted ? (
              <div className="mt-8 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6">
                <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="h-5 w-5" />
                  <h3 className="font-display text-lg font-bold">¡Mensaje preparado!</h3>
                </div>
                <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">
                  Gracias, <strong>{name}</strong>. Como este sitio es 100% estático y sin servidor
                  PHP, puedes enviar tu mensaje directamente desde tu correo haciendo clic abajo (o
                  conectar Formspree cuando lo publiques).
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <a
                    href={mailtoHref}
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#0845ff] to-[#029be6] px-5 py-2.5 text-sm font-semibold text-white"
                  >
                    <Mail className="h-4 w-4" />
                    Abrir en mi correo
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      setSubmitted(false);
                      setName('');
                      setEmail('');
                      setMessage('');
                    }}
                    className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 dark:border-white/15 dark:text-slate-200"
                  >
                    Nuevo mensaje
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="mt-6 space-y-5">
                <div>
                  <label
                    htmlFor="contact-name"
                    className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300"
                  >
                    Nombre completo *
                  </label>
                  <input
                    id="contact-name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Tu nombre"
                    className="mt-2 w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none dark:border-white/15 dark:bg-white/5 dark:text-white dark:focus:border-cyan-400 dark:focus:bg-[#0f1936]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="contact-email"
                    className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300"
                  >
                    Correo electrónico *
                  </label>
                  <input
                    id="contact-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nombre@uaz.edu.mx"
                    className="mt-2 w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none dark:border-white/15 dark:bg-white/5 dark:text-white dark:focus:border-cyan-400 dark:focus:bg-[#0f1936]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="contact-topic"
                    className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300"
                  >
                    Motivo de consulta
                  </label>
                  <select
                    id="contact-topic"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    className="mt-2 w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none dark:border-white/15 dark:bg-[#070c1c] dark:text-white dark:focus:border-cyan-400 dark:focus:bg-[#0f1936]"
                  >
                    <option>Tesis o Estancia de Investigación</option>
                    <option>Admisión a Posgrado PITec (Maestría / Doctorado)</option>
                    <option>Vinculación y Proyectos con Industria</option>
                    <option>Información General</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="contact-message"
                    className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300"
                  >
                    Mensaje *
                  </label>
                  <textarea
                    id="contact-message"
                    required
                    rows={4}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Cuéntanos sobre tu proyecto, interés académico o consulta..."
                    className="mt-2 w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none dark:border-white/15 dark:bg-white/5 dark:text-white dark:focus:border-cyan-400 dark:focus:bg-[#0f1936]"
                  />
                </div>

                <button
                  type="submit"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#0845ff] to-[#029be6] px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:brightness-110"
                >
                  <Send className="h-4 w-4" />
                  Enviar consulta
                </button>
              </form>
            )}
          </div>

          <div className="flex flex-col gap-6 lg:col-span-6">
            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-lg dark:border-white/10 dark:bg-[#0b1229]">
              <img
                src={siteInfo.images.pitecBuilding}
                alt="Fachada del edificio PITec UAZ"
                className="aspect-[16/8] w-full object-cover"
              />
              <div className="flex items-center justify-between gap-4 p-5">
                <div>
                  <p className="font-display font-bold text-slate-900 dark:text-white">
                    Edificio PITec · {siteInfo.institution}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {siteInfo.shortAddress}
                  </p>
                </div>
                <a
                  href={siteInfo.mapsLinkUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-sky-500 dark:border-white/15 dark:text-slate-200"
                >
                  Cómo llegar
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>

            <div className="flex-1 overflow-hidden rounded-3xl border border-slate-200 shadow-lg dark:border-white/10">
              <iframe
                title="Mapa de ubicación del LIAA - PITec UAZ"
                src={siteInfo.mapsEmbedUrl}
                className="h-full min-h-[300px] w-full border-0 dark:opacity-90 dark:contrast-110"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

import type { IconName } from '../components/DynamicIcon';

export interface ResearchLine {
  id: string;
  code: string;
  title: string;
  shortDescription: string;
  description: string;
  icon: IconName;
  tags: string[];
  applications: string[];
}

export interface ProjectItem {
  id: string;
  title: string;
  lineId: string;
  status: 'En curso' | 'Publicado' | 'Colaboración';
  year: string;
  summary: string;
  technologies: string[];
}

export interface NewsArticle {
  slug: string;
  title: string;
  date: string;
  category: 'Institucional' | 'Investigación' | 'Eventos' | 'Convocatorias';
  author: string;
  authorId?: string;
  status?: 'draft' | 'review' | 'published';
  image: string;
  excerpt: string;
  content: string[];
}

export interface ValueItem {
  title: string;
  description: string;
  code: string;
}

export interface SiteImages {
  emblem: string;
  logo: string;
  pitecBuilding: string;
  missionGraphic: string;
  visionGraphic: string;
}

export interface SiteInfo {
  acronym: string;
  fullName: string;
  institution: string;
  institutionShort: string;
  program: string;
  degrees: string;
  address: string;
  shortAddress: string;
  phone: string;
  email: string;
  pitecUrl: string;
  schedule: string;
  mapsEmbedUrl: string;
  mapsLinkUrl: string;
  socials: {
    facebook: string;
    uaz: string;
  };
  images: SiteImages;
}

export interface LabIdentity {
  aboutLead: string;
  aboutParagraphs: string[];
  mission: string;
  vision: string;
  values: ValueItem[];
}

export interface HeroMetric {
  value: string;
  label: string;
}

export interface HeroConfig {
  badgeText: string;
  badgeIcon: IconName;
  titlePrefix: string;
  titleHighlight: string;
  titleSuffix: string;
  subtitle: string;
  primaryCta: {
    label: string;
    to: string;
    visible: boolean;
  };
  secondaryCta: {
    label: string;
    to: string;
    visible: boolean;
  };
  metrics: HeroMetric[];
  card: {
    visible: boolean;
    headerLeft: string;
    headerRight: string;
    image: string;
    stat1Label: string;
    stat1Value: string;
    stat2Label: string;
    stat2Value: string;
  };
  layout: 'default' | 'reversed' | 'centered';
  showNeuralCanvas: boolean;
}

export interface HomeSectionConfig {
  id: string;
  type: 'hero' | 'about' | 'research' | 'news' | 'location' | 'custom';
  label: string;
  visible: boolean;
  flipped?: boolean;
  customBlockId?: string;
}

export interface IconCardEntry {
  icon: IconName;
  title: string;
  description: string;
}

export interface StatEntry {
  icon: IconName;
  value: string;
  label: string;
}

export interface CanvasElement {
  id: string;
  type: 'text' | 'image' | 'icon' | 'button';
  /** Percentage from left (0 to 92) */
  x: number;
  /** Percentage from top (0 to 90) */
  y: number;
  /** Width in px (for text/image) or icon size in px */
  width: number;
  text?: string;
  fontSize?: number;
  color?: string;
  icon?: IconName;
  image?: string;
  href?: string;
}

export interface CustomBlock {
  id: string;
  kind: 'icon-cards' | 'text-image' | 'cta-banner' | 'stats' | 'canvas';
  eyebrow: string;
  title: string;
  subtitle: string;
  // For icon-cards
  columns?: 2 | 3 | 4;
  cards?: IconCardEntry[];
  // For text-image
  body?: string;
  image?: string;
  imagePosition?: 'left' | 'right';
  // For cta-banner & text-image
  buttonLabel?: string;
  buttonLink?: string;
  icon?: IconName;
  align?: 'left' | 'center';
  // For stats
  stats?: StatEntry[];
  // For free-position visual canvas
  canvasHeight?: number;
  elements?: CanvasElement[];
}

export interface NavItem {
  id: string;
  label: string;
  path: string;
  visible: boolean;
  /** Linked custom page id if created dynamically */
  pageId?: string;
}

export interface CustomPage {
  id: string;
  slug: string;
  title: string;
  eyebrow: string;
  subtitle: string;
  blocks: CustomBlock[];
}

export type FontFamilyKey =
  | 'space-grotesk'
  | 'inter'
  | 'poppins'
  | 'montserrat'
  | 'playfair'
  | 'merriweather'
  | 'roboto-slab'
  | 'outfit'
  | 'sora'
  | 'jetbrains-mono';

export interface SiteTypography {
  headingFont: FontFamilyKey;
  bodyFont: FontFamilyKey;
  monoFont: FontFamilyKey;
}

export interface EditableTextStyle {
  fontFamily?: FontFamilyKey | 'inherit';
  fontSize?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  fontWeight?: 'normal' | 'medium' | 'semibold' | 'bold' | 'extrabold';
  color?: string;
  align?: 'left' | 'center' | 'right';
}

export interface PageTextOverride {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  style?: EditableTextStyle;
}

export interface SiteContent {
  siteInfo: SiteInfo;
  hero: HeroConfig;
  labIdentity: LabIdentity;
  researchLines: ResearchLine[];
  projects: ProjectItem[];
  newsArticles: NewsArticle[];
  homeSections: HomeSectionConfig[];
  customBlocks: CustomBlock[];
  navItems: NavItem[];
  customPages: CustomPage[];
  typography?: SiteTypography;
  pageTexts?: Record<string, PageTextOverride>;
}

export const SITE_INFO: SiteInfo = {
  acronym: 'LIAA',
  fullName: 'Laboratorio de Inteligencia Artificial Avanzada',
  institution: 'Universidad Autónoma de Zacatecas',
  institutionShort: 'UAZ',
  program: 'Posgrado en Ingeniería y Tecnología Aplicada (PITec)',
  degrees: 'Maestría y Doctorado en Ingeniería y Tecnología Aplicada',
  address: 'Ramón López Velarde 517, Zacatecas Centro, C.P. 98068, Zacatecas, Zac., México',
  shortAddress: 'Ramón López Velarde 517, Centro, Zacatecas',
  phone: '492 925 66 90 Ext. 3967',
  email: 'pitec@uaz.edu.mx',
  pitecUrl: 'http://pitec.uaz.edu.mx/',
  schedule: 'Lunes a Viernes · 09:00 – 18:00 h',
  mapsEmbedUrl:
    'https://www.google.com/maps?q=Ram%C3%B3n%20L%C3%B3pez%20Velarde%20517%2C%20Zacatecas%20Centro%2C%2098068%20Zacatecas%2C%20Zac.&output=embed',
  mapsLinkUrl:
    'https://www.google.com/maps/search/?api=1&query=Ram%C3%B3n+L%C3%B3pez+Velarde+517,+Zacatecas+Centro,+98068+Zacatecas,+Zac.',
  socials: {
    facebook:
      'https://www.facebook.com/search/top?q=PITec%20Posgrados%20en%20Ingenier%C3%ADa%20y%20Tecnolog%C3%ADa%20Aplicada',
    uaz: 'https://www.uaz.edu.mx/',
  },
  images: {
    emblem: '/images/liaa-emblem.png',
    logo: '/images/liaa-logo.png',
    pitecBuilding: '/images/pitec-building.jpg',
    missionGraphic: '/images/ai-hand-network.png',
    visionGraphic: '/images/ai-engineer-hud.png',
  },
};

export const DEFAULT_HERO: HeroConfig = {
  badgeText: 'UAZ · PITec · Zacatecas, México',
  badgeIcon: 'sparkles',
  titlePrefix: 'Laboratorio de',
  titleHighlight: 'Inteligencia Artificial',
  titleSuffix: 'Avanzada',
  subtitle:
    'Impulsamos investigación científica, modelos de aprendizaje profundo y soluciones de ingeniería inteligente dentro del Posgrado en Ingeniería y Tecnología Aplicada (PITec) de la Universidad Autónoma de Zacatecas.',
  primaryCta: {
    label: 'Explorar Investigación',
    to: '/investigacion',
    visible: true,
  },
  secondaryCta: {
    label: 'Conocer el LIAA',
    to: '/nosotros',
    visible: true,
  },
  metrics: [
    { value: '4', label: 'Líneas de investigación activas' },
    { value: 'M · D', label: 'Maestría y Doctorado PITec' },
    { value: 'UAZ', label: 'Zacatecas Centro' },
  ],
  card: {
    visible: true,
    headerLeft: 'LIAA // NODE_UAZ',
    headerRight: 'PITEC · IA',
    image: '/images/liaa-emblem.png',
    stat1Label: 'Enfoque',
    stat1Value: 'Deep Learning & Visión',
    stat2Label: 'Adscripción',
    stat2Value: 'Posgrado PITec · UAZ',
  },
  layout: 'default',
  showNeuralCanvas: true,
};

export const DEFAULT_HOME_SECTIONS: HomeSectionConfig[] = [
  { id: 'sec-hero', type: 'hero', label: 'Portada Principal (Hero)', visible: true },
  { id: 'sec-about', type: 'about', label: 'Sobre el Laboratorio (PITec)', visible: true, flipped: false },
  { id: 'sec-research', type: 'research', label: 'Líneas de Investigación', visible: true },
  { id: 'sec-news', type: 'news', label: 'Noticias Recientes', visible: true },
  { id: 'sec-location', type: 'location', label: 'Ubicación y Mapa', visible: true, flipped: false },
];

export const LAB_IDENTITY: LabIdentity = {
  aboutLead:
    'El Laboratorio de Inteligencia Artificial Avanzada (LIAA) es un espacio de investigación, desarrollo tecnológico y formación de talento de posgrado adscrito al Posgrado en Ingeniería y Tecnología Aplicada (PITec) de la Universidad Autónoma de Zacatecas.',
  aboutParagraphs: [
    'Nacido con la vocación de conectar la investigación científica de frontera con problemas reales de la industria, la salud, el medio ambiente y el sector productivo, el LIAA impulsa soluciones basadas en aprendizaje profundo, visión por computadora, sistemas autónomos y ciencia de datos.',
    'En colaboración con estudiantes de Maestría y Doctorado en Ingeniería y Tecnología Aplicada, profesores investigadores y aliados externos, desarrollamos modelos reproducibles, prototipos funcionales y publicaciones de impacto nacional e internacional.',
  ],
  mission:
    'Impulsar investigación científica de alto impacto y desarrollo tecnológico en inteligencia artificial, formando especialistas de posgrado con sólido rigor analítico, compromiso ético y capacidad para resolver desafíos complejos de la sociedad y la industria desde la Universidad Autónoma de Zacatecas.',
  vision:
    'Consolidarnos como un laboratorio referente a nivel nacional e internacional en inteligencia artificial aplicada, reconocido por la calidad de sus contribuciones científicas, su vinculación efectiva con el ecosistema tecnológico y la formación de líderes en innovación.',
  values: [
    {
      code: '01',
      title: 'Rigor Científico',
      description:
        'Validamos cada modelo, experimento y resultado con metodologías reproducibles, métricas transparentes y estándares internacionales.',
    },
    {
      code: '02',
      title: 'Innovación Responsable',
      description:
        'Diseñamos sistemas inteligentes pensando en su impacto real, priorizando seguridad, equidad, privacidad y explicabilidad.',
    },
    {
      code: '03',
      title: 'Colaboración Interdisciplinaria',
      description:
        'Integramos ingeniería, matemáticas, ciencias computacionales y dominios aplicados junto a otras facultades, centros e industrias.',
    },
    {
      code: '04',
      title: 'Formación de Talento',
      description:
        'Acompañamos el crecimiento académico de estudiantes de maestría, doctorado y licenciatura mediante mentoría y proyectos reales.',
    },
    {
      code: '05',
      title: 'Ciencia Abierta',
      description:
        'Promovemos la difusión del conocimiento a través de publicaciones, seminarios, software abierto y divulgación tecnológica.',
    },
    {
      code: '06',
      title: 'Impacto Regional y Global',
      description:
        'Atendemos problemáticas estratégicas de Zacatecas y México con herramientas y arquitecturas de vanguardia mundial.',
    },
  ],
};

export const RESEARCH_LINES: ResearchLine[] = [
  {
    id: 'vision-computadora',
    code: 'LI-01',
    title: 'Visión por Computadora y Análisis de Imágenes',
    shortDescription:
      'Detección, segmentación y reconstrucción visual para inspección industrial, análisis biomédico y monitoreo inteligente.',
    description:
      'Investigamos arquitecturas neuronales convolucionales y transformers visuales para interpretar imágenes y secuencias de video en condiciones reales, optimizando precisión y latencia en entornos de cómputo limitado.',
    icon: 'eye',
    tags: ['Segmentación', 'Detección de Objetos', 'Imágenes Médicas', 'Inspección Industrial'],
    applications: [
      'Control de calidad automatizado en líneas de producción',
      'Apoyo al diagnóstico mediante procesamiento de imágenes clínicas',
      'Análisis aéreo y satelital para agricultura y medio ambiente',
    ],
  },
  {
    id: 'aprendizaje-profundo',
    code: 'LI-02',
    title: 'Aprendizaje Profundo y Modelos Generativos',
    shortDescription:
      'Diseño, entrenamiento eficiente y adaptación de redes neuronales profundas, modelos fundacionales e IA explicable.',
    description:
      'Exploramos técnicas de representación, aprendizaje auto-supervisado, ajuste fino eficiente y explicabilidad (XAI) para construir sistemas confiables y auditables en tareas de lenguaje, series temporales y toma de decisiones.',
    icon: 'brain',
    tags: ['Deep Learning', 'NLP / LLMs', 'XAI', 'Optimización'],
    applications: [
      'Asistentes especializados para documentación científica e institucional',
      'Modelos predictivos en series temporales complejas',
      'Compresión y cuantización de modelos para despliegue ligero',
    ],
  },
  {
    id: 'robotica-sistemas',
    code: 'LI-03',
    title: 'Robótica Inteligente y Sistemas Embebidos (Edge AI)',
    shortDescription:
      'Integración de percepción, control inteligente e inferencia en tiempo real sobre hardware embebido y plataformas autónomas.',
    description:
      'Desarrollamos algoritmos de navegación, fusión sensorial y control adaptativo capaces de ejecutarse directamente en dispositivos de borde (Edge AI), acelerando la autonomía de prototipos mecatrónicos e IoT.',
    icon: 'cpu',
    tags: ['Edge AI', 'Robótica', 'IoT Inteligente', 'Control Adaptativo'],
    applications: [
      'Inferencia en tiempo real sobre dispositivos GPU embebidos',
      'Navegación y evasión de obstáculos en robots móviles',
      'Monitoreo inteligente de infraestructura y sensores distribuidos',
    ],
  },
  {
    id: 'ciencia-datos',
    code: 'LI-04',
    title: 'Ciencia de Datos e IA Aplicada a Ingeniería',
    shortDescription:
      'Minería de datos, mantenimiento predictivo y simulación inteligente para sistemas energéticos, mineros e industriales.',
    description:
      'Aplicamos aprendizaje automático estadístico, análisis multivariado y optimización metaheurística para transformar grandes volúmenes de datos operativos en decisiones medibles y sostenibles.',
    icon: 'database',
    tags: ['Data Science', 'Mantenimiento Predictivo', 'Optimización', 'Industria 4.0'],
    applications: [
      'Detección temprana de anomalías y fallos en maquinaria',
      'Modelado inteligente de consumo energético y recursos hídricos',
      'Sistemas de soporte a decisiones para el sector productivo regional',
    ],
  },
];

export const PROJECTS: ProjectItem[] = [
  {
    id: 'proj-01',
    title: 'Sistema de Inspección Visual Automatizada con Redes Ligeras',
    lineId: 'vision-computadora',
    status: 'En curso',
    year: '2026',
    summary:
      'Arquitectura de detección en tiempo real desplegada en hardware embebido para identificación de defectos superficiales en procesos de manufactura.',
    technologies: ['PyTorch', 'ONNX Runtime', 'OpenCV', 'Edge GPU'],
  },
  {
    id: 'proj-02',
    title: 'Modelos Explicables para Predicción de Series Temporales en Ingeniería',
    lineId: 'aprendizaje-profundo',
    status: 'En curso',
    year: '2026',
    summary:
      'Evaluación comparativa de arquitecturas basadas en atención con módulos de interpretabilidad para pronóstico de demanda y detección de anomalías.',
    technologies: ['Transformers', 'SHAP', 'Python', 'FastAPI'],
  },
  {
    id: 'proj-03',
    title: 'Plataforma IoT Inteligente para Monitoreo Ambiental Universitario',
    lineId: 'robotica-sistemas',
    status: 'Colaboración',
    year: '2025',
    summary:
      'Red de nodos sensores de bajo consumo con inferencia local para análisis continuo de variables ambientales y alertas tempranas.',
    technologies: ['TinyML', 'ESP32', 'MQTT', 'Time-Series'],
  },
  {
    id: 'proj-04',
    title: 'Análisis Inteligente de Datos Operativos para Mantenimiento Predictivo',
    lineId: 'ciencia-datos',
    status: 'Publicado',
    year: '2025',
    summary:
      'Pipeline reproducible de aprendizaje automático para estimar vida útil remanente y reducir paros no programados en equipos industriales.',
    technologies: ['Scikit-learn', 'XGBoost', 'MLflow', 'Docker'],
  },
];

export const NEWS_ARTICLES: NewsArticle[] = [
  {
    slug: 'renovacion-portal-liaa-uaz',
    title: 'Nueva plataforma digital del Laboratorio de Inteligencia Artificial Avanzada',
    date: 'Noviembre 2026',
    category: 'Institucional',
    author: 'Equipo LIAA',
    image: '/images/pitec-building.jpg',
    excerpt:
      'Presentamos el portal renovado del LIAA dentro del Posgrado en Ingeniería y Tecnología Aplicada (PITec) de la UAZ, diseñado para difundir nuestras líneas de investigación y vinculación.',
    content: [
      'Con el objetivo de fortalecer la difusión científica y facilitar el contacto con estudiantes, investigadores y aliados tecnológicos, el Laboratorio de Inteligencia Artificial Avanzada (LIAA) estrena su nueva plataforma web institucional.',
      'Este espacio reúne de forma clara y accesible nuestra identidad, las líneas activas de investigación en visión por computadora, aprendizaje profundo, Edge AI y ciencia de datos, así como la información para integrarse a través de la Maestría y el Doctorado en Ingeniería y Tecnología Aplicada (PITec) de la Universidad Autónoma de Zacatecas.',
      'Invitamos a toda la comunidad universitaria y al sector externo a explorar nuestros proyectos, participar en nuestros seminarios y acercarse al laboratorio para colaborar en tesis, estancias de investigación y desarrollos conjuntos.',
    ],
  },
  {
    slug: 'convocatoria-estancias-tesis-ia',
    title: 'Invitación abierta para proyectos de tesis y estancias de investigación en IA',
    date: 'Octubre 2026',
    category: 'Convocatorias',
    author: 'Coordinación LIAA · PITec',
    image: '/images/ai-hand-network.png',
    excerpt:
      'Estudiantes de ingeniería, computación y posgrado pueden postularse para desarrollar proyectos de tesis, servicio social o estancias académicas en el LIAA.',
    content: [
      'El Laboratorio de Inteligencia Artificial Avanzada mantiene abiertas sus puertas para estudiantes interesados en desarrollar investigación aplicada en inteligencia artificial, visión por computadora, aprendizaje profundo y sistemas inteligentes.',
      'Los participantes cuentan con asesoría académica especializada, acceso a seminarios internos de lectura científica y vinculación directa con los programas de Maestría y Doctorado en Ingeniería y Tecnología Aplicada (PITec).',
      'Si deseas conocer los temas disponibles o proponer un proyecto afín a nuestras líneas de investigación, contáctanos a través de la sección de Contacto o escribe directamente a pitec@uaz.edu.mx.',
    ],
  },
  {
    slug: 'seminario-ia-aplicada-ingenieria',
    title: 'Seminario de Inteligencia Artificial Aplicada a Ingeniería y Tecnología',
    date: 'Septiembre 2026',
    category: 'Eventos',
    author: 'Comité Académico LIAA',
    image: '/images/ai-engineer-hud.png',
    excerpt:
      'Encuentro académico enfocado en arquitecturas de aprendizaje profundo, despliegue eficiente en hardware embebido y transferencia tecnológica regional.',
    content: [
      'Como parte de las actividades de divulgación y formación continua del PITec, el LIAA impulsa sesiones periódicas de seminario donde investigadores y estudiantes presentan avances metodológicos, revisiones del estado del arte y demostraciones técnicas.',
      'Entre los ejes abordados destacan el entrenamiento eficiente de redes neuronales, la explicabilidad en sistemas de apoyo a decisiones y el despliegue de modelos de visión artificial en dispositivos de bajo consumo.',
      'Mantente atento a esta sección para consultar las próximas fechas, ponentes invitados y materiales abiertos de cada sesión.',
    ],
  },
  {
    slug: 'bienvenida-agosto-diciembre-2021',
    title: 'Bienvenida Agosto – Diciembre 2021 · Comunidad Universitaria UAZ',
    date: 'Archivo histórico · UAZ',
    category: 'Institucional',
    author: 'Rito_ed',
    image: '/images/news-bienvenida.png',
    excerpt:
      'Mensaje de bienvenida a la comunidad universitaria de la Universidad Autónoma de Zacatecas al inicio del semestre Agosto – Diciembre, conservado del archivo original del laboratorio.',
    content: [
      'Estimada comunidad universitaria: hoy iniciamos un nuevo semestre con entusiasmo renovado y el firme compromiso de seguir fortaleciendo la formación académica, la investigación científica y la vinculación tecnológica en la Universidad Autónoma de Zacatecas.',
      'Agradecemos el esfuerzo continuo de docentes, estudiantes e investigadores que hacen posible consolidar espacios de innovación como el Laboratorio de Inteligencia Artificial Avanzada y el Posgrado en Ingeniería y Tecnología Aplicada (PITec).',
      'Esta nota forma parte del archivo rescatado de la primera versión del portal del LIAA.',
    ],
  },
];

export const DEFAULT_NAV_ITEMS: NavItem[] = [
  { id: 'nav-home', label: 'Inicio', path: '/', visible: true },
  { id: 'nav-about', label: 'Nosotros', path: '/nosotros', visible: true },
  { id: 'nav-research', label: 'Investigación', path: '/investigacion', visible: true },
  { id: 'nav-news', label: 'Noticias', path: '/noticias', visible: true },
  { id: 'nav-contact', label: 'Contacto', path: '/contacto', visible: true },
];

export const DEFAULT_CONTENT: SiteContent = {
  siteInfo: SITE_INFO,
  hero: DEFAULT_HERO,
  labIdentity: LAB_IDENTITY,
  researchLines: RESEARCH_LINES,
  projects: PROJECTS,
  newsArticles: NEWS_ARTICLES,
  homeSections: DEFAULT_HOME_SECTIONS,
  customBlocks: [],
  navItems: DEFAULT_NAV_ITEMS,
  customPages: [],
  typography: {
    headingFont: 'space-grotesk',
    bodyFont: 'inter',
    monoFont: 'jetbrains-mono',
  },
  pageTexts: {},
};

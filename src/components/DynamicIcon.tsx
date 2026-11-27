import {
  Award,
  BookOpen,
  BrainCircuit,
  Calendar,
  Code2,
  Compass,
  Cpu,
  Database,
  Eye,
  FlaskConical,
  Globe,
  GraduationCap,
  Layers,
  Lightbulb,
  Mail,
  Microscope,
  Rocket,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  Users,
  Zap,
} from 'lucide-react';

export type IconName =
  | 'sparkles'
  | 'brain'
  | 'cpu'
  | 'eye'
  | 'database'
  | 'rocket'
  | 'users'
  | 'award'
  | 'book'
  | 'globe'
  | 'microscope'
  | 'code'
  | 'shield'
  | 'zap'
  | 'layers'
  | 'target'
  | 'graduation'
  | 'calendar'
  | 'mail'
  | 'star'
  | 'lightbulb'
  | 'compass'
  | 'flask';

export const ICON_OPTIONS: Array<{ name: IconName; label: string }> = [
  { name: 'sparkles', label: 'Chispas IA' },
  { name: 'brain', label: 'Red Neuronal' },
  { name: 'cpu', label: 'Procesador' },
  { name: 'eye', label: 'Visión' },
  { name: 'database', label: 'Datos' },
  { name: 'rocket', label: 'Innovación' },
  { name: 'microscope', label: 'Ciencia' },
  { name: 'flask', label: 'Laboratorio' },
  { name: 'code', label: 'Código' },
  { name: 'graduation', label: 'Posgrado' },
  { name: 'users', label: 'Equipo' },
  { name: 'award', label: 'Logro' },
  { name: 'book', label: 'Publicación' },
  { name: 'globe', label: 'Global' },
  { name: 'shield', label: 'Ética' },
  { name: 'zap', label: 'Energía' },
  { name: 'layers', label: 'Arquitectura' },
  { name: 'target', label: 'Objetivo' },
  { name: 'lightbulb', label: 'Idea' },
  { name: 'compass', label: 'Misión' },
  { name: 'calendar', label: 'Evento' },
  { name: 'mail', label: 'Contacto' },
  { name: 'star', label: 'Destacado' },
];

export function DynamicIcon({
  name,
  className = 'h-5 w-5',
}: {
  name: IconName | string;
  className?: string;
}) {
  switch (name) {
    case 'brain':
      return <BrainCircuit className={className} />;
    case 'cpu':
      return <Cpu className={className} />;
    case 'eye':
      return <Eye className={className} />;
    case 'database':
      return <Database className={className} />;
    case 'rocket':
      return <Rocket className={className} />;
    case 'users':
      return <Users className={className} />;
    case 'award':
      return <Award className={className} />;
    case 'book':
      return <BookOpen className={className} />;
    case 'globe':
      return <Globe className={className} />;
    case 'microscope':
      return <Microscope className={className} />;
    case 'code':
      return <Code2 className={className} />;
    case 'shield':
      return <ShieldCheck className={className} />;
    case 'zap':
      return <Zap className={className} />;
    case 'layers':
      return <Layers className={className} />;
    case 'target':
      return <Target className={className} />;
    case 'graduation':
      return <GraduationCap className={className} />;
    case 'calendar':
      return <Calendar className={className} />;
    case 'mail':
      return <Mail className={className} />;
    case 'star':
      return <Star className={className} />;
    case 'lightbulb':
      return <Lightbulb className={className} />;
    case 'compass':
      return <Compass className={className} />;
    case 'flask':
      return <FlaskConical className={className} />;
    case 'sparkles':
    default:
      return <Sparkles className={className} />;
  }
}

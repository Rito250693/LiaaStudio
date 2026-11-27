import { DynamicIcon } from './DynamicIcon';
import type { ResearchLine } from '../data/siteData';

export function ResearchIcon({
  icon,
  className = 'h-6 w-6',
}: {
  icon: ResearchLine['icon'];
  className?: string;
}) {
  return <DynamicIcon name={icon} className={className} />;
}

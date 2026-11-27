import type { CSSProperties } from 'react';
import type { EditableTextStyle, FontFamilyKey, SiteTypography } from '../data/siteData';

export interface FontOption {
  key: FontFamilyKey;
  label: string;
  category: 'Moderna' | 'Institucional' | 'Editorial / Serif' | 'Técnica';
  cssFamily: string;
}

export const FONT_OPTIONS: FontOption[] = [
  {
    key: 'space-grotesk',
    label: 'Space Grotesk',
    category: 'Moderna',
    cssFamily: '"Space Grotesk", "Inter", system-ui, sans-serif',
  },
  {
    key: 'inter',
    label: 'Inter',
    category: 'Institucional',
    cssFamily: '"Inter", system-ui, -apple-system, sans-serif',
  },
  {
    key: 'poppins',
    label: 'Poppins',
    category: 'Moderna',
    cssFamily: '"Poppins", "Inter", system-ui, sans-serif',
  },
  {
    key: 'montserrat',
    label: 'Montserrat',
    category: 'Institucional',
    cssFamily: '"Montserrat", "Inter", system-ui, sans-serif',
  },
  {
    key: 'outfit',
    label: 'Outfit',
    category: 'Moderna',
    cssFamily: '"Outfit", "Inter", system-ui, sans-serif',
  },
  {
    key: 'sora',
    label: 'Sora',
    category: 'Moderna',
    cssFamily: '"Sora", "Inter", system-ui, sans-serif',
  },
  {
    key: 'playfair',
    label: 'Playfair Display',
    category: 'Editorial / Serif',
    cssFamily: '"Playfair Display", Georgia, serif',
  },
  {
    key: 'merriweather',
    label: 'Merriweather',
    category: 'Editorial / Serif',
    cssFamily: '"Merriweather", Georgia, serif',
  },
  {
    key: 'roboto-slab',
    label: 'Roboto Slab',
    category: 'Editorial / Serif',
    cssFamily: '"Roboto Slab", Georgia, serif',
  },
  {
    key: 'jetbrains-mono',
    label: 'JetBrains Mono',
    category: 'Técnica',
    cssFamily: '"JetBrains Mono", ui-monospace, SFMono-Regular, monospace',
  },
];

export const DEFAULT_TYPOGRAPHY: SiteTypography = {
  headingFont: 'space-grotesk',
  bodyFont: 'inter',
  monoFont: 'jetbrains-mono',
};

const FONT_MAP = new Map<FontFamilyKey, FontOption>(FONT_OPTIONS.map((f) => [f.key, f]));

export function getFontCssFamily(key?: FontFamilyKey | 'inherit'): string | undefined {
  if (!key || key === 'inherit') return undefined;
  return FONT_MAP.get(key)?.cssFamily;
}

export function applyGlobalTypography(typography?: SiteTypography) {
  if (typeof document === 'undefined') return;
  const merged = { ...DEFAULT_TYPOGRAPHY, ...(typography || {}) };
  const root = document.documentElement;
  const headingCss = getFontCssFamily(merged.headingFont) || FONT_OPTIONS[0].cssFamily;
  const bodyCss = getFontCssFamily(merged.bodyFont) || FONT_OPTIONS[1].cssFamily;
  const monoCss = getFontCssFamily(merged.monoFont) || FONT_OPTIONS[9].cssFamily;
  root.style.setProperty('--font-display', headingCss);
  root.style.setProperty('--font-sans', bodyCss);
  root.style.setProperty('--font-mono', monoCss);
}

export function buildHeadingInlineStyle(style?: EditableTextStyle): CSSProperties {
  if (!style) return {};
  const css: CSSProperties = {};
  const fam = getFontCssFamily(style.fontFamily);
  if (fam) css.fontFamily = fam;
  if (style.color && /^#[0-9a-fA-F]{3,8}$/.test(style.color.trim())) {
    css.color = style.color.trim();
  }
  return css;
}

export function getHeadingSizeClasses(
  size?: EditableTextStyle['fontSize'],
  variant: 'section' | 'banner' | 'card' = 'section',
): string {
  if (variant === 'banner') {
    switch (size) {
      case 'sm':
        return 'text-2xl sm:text-3xl';
      case 'md':
        return 'text-3xl sm:text-4xl';
      case 'lg':
        return 'text-3xl sm:text-5xl';
      case 'xl':
        return 'text-4xl sm:text-6xl';
      case '2xl':
        return 'text-5xl sm:text-7xl';
      default:
        return 'text-3xl sm:text-5xl';
    }
  }
  if (variant === 'card') {
    switch (size) {
      case 'sm':
        return 'text-xl sm:text-2xl';
      case 'md':
        return 'text-2xl sm:text-3xl';
      case 'lg':
        return 'text-3xl sm:text-4xl';
      case 'xl':
        return 'text-4xl sm:text-5xl';
      case '2xl':
        return 'text-5xl sm:text-6xl';
      default:
        return 'text-2xl sm:text-3xl';
    }
  }
  switch (size) {
    case 'sm':
      return 'text-2xl sm:text-3xl';
    case 'md':
      return 'text-3xl sm:text-4xl';
    case 'lg':
      return 'text-4xl sm:text-5xl';
    case 'xl':
      return 'text-4xl sm:text-6xl';
    case '2xl':
      return 'text-5xl sm:text-6xl';
    default:
      return 'text-3xl sm:text-4xl';
  }
}

export function getHeadingWeightClass(weight?: EditableTextStyle['fontWeight']): string {
  switch (weight) {
    case 'normal':
      return 'font-normal';
    case 'medium':
      return 'font-medium';
    case 'semibold':
      return 'font-semibold';
    case 'extrabold':
      return 'font-extrabold';
    case 'bold':
    default:
      return 'font-bold';
  }
}

export function getTextAlignClass(align?: EditableTextStyle['align']): string {
  switch (align) {
    case 'center':
      return 'text-center';
    case 'right':
      return 'text-right';
    case 'left':
    default:
      return 'text-left';
  }
}

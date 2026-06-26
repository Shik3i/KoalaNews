export const DESIGN_OPTIONS = [
  'clean',
  'newspaper',
  'terminal',
  'soft',
  'high-contrast',
  'glassmorphism',
  'retrowave',
] as const;
export const CARD_STYLE_OPTIONS = ['magazine', 'minimal', 'compact', 'headline', 'dense'] as const;
export const DENSITY_OPTIONS = ['comfortable', 'compact', 'dense'] as const;
export const FONT_SCALE_OPTIONS = ['small', 'medium', 'large'] as const;
export const ACCENT_OPTIONS = [
  'blue',
  'green',
  'red',
  'neutral',
  'purple',
  'orange',
  'cyan',
] as const;
export const THEME_OPTIONS = [
  'system',
  'light',
  'dark',
  'sepia',
  'nord',
  'forest',
  'cyberpunk',
  'dracula',
] as const;

export type AppearanceSettings = {
  theme: (typeof THEME_OPTIONS)[number];
  design: (typeof DESIGN_OPTIONS)[number];
  cardStyle: (typeof CARD_STYLE_OPTIONS)[number];
  density: (typeof DENSITY_OPTIONS)[number];
  fontScale: (typeof FONT_SCALE_OPTIONS)[number];
  accentColor: (typeof ACCENT_OPTIONS)[number];
  showImages: boolean;
  showSource: boolean;
  showDate: boolean;
  showDescription: boolean;
  showReadMore: boolean;
  descriptionLines: number;
};

export const DEFAULT_APPEARANCE: AppearanceSettings = {
  theme: 'system',
  design: 'clean',
  cardStyle: 'magazine',
  density: 'comfortable',
  fontScale: 'medium',
  accentColor: 'blue',
  showImages: true,
  showSource: true,
  showDate: true,
  showDescription: true,
  showReadMore: true,
  descriptionLines: 2,
};

export function asOption<T extends readonly string[]>(
  value: unknown,
  options: T,
  fallback: T[number],
): T[number] {
  return typeof value === 'string' && options.includes(value) ? value : fallback;
}

export function normalizeAppearance(input: Record<string, unknown>): AppearanceSettings {
  return {
    theme: asOption(input.theme, THEME_OPTIONS, DEFAULT_APPEARANCE.theme),
    design: asOption(input.design, DESIGN_OPTIONS, DEFAULT_APPEARANCE.design),
    cardStyle: asOption(input.cardStyle, CARD_STYLE_OPTIONS, DEFAULT_APPEARANCE.cardStyle),
    density: asOption(input.density, DENSITY_OPTIONS, DEFAULT_APPEARANCE.density),
    fontScale: asOption(input.fontScale, FONT_SCALE_OPTIONS, DEFAULT_APPEARANCE.fontScale),
    accentColor: asOption(input.accentColor, ACCENT_OPTIONS, DEFAULT_APPEARANCE.accentColor),
    showImages:
      typeof input.showImages === 'boolean' ? input.showImages : DEFAULT_APPEARANCE.showImages,
    showSource:
      typeof input.showSource === 'boolean' ? input.showSource : DEFAULT_APPEARANCE.showSource,
    showDate: typeof input.showDate === 'boolean' ? input.showDate : DEFAULT_APPEARANCE.showDate,
    showDescription:
      typeof input.showDescription === 'boolean'
        ? input.showDescription
        : DEFAULT_APPEARANCE.showDescription,
    showReadMore:
      typeof input.showReadMore === 'boolean'
        ? input.showReadMore
        : DEFAULT_APPEARANCE.showReadMore,
    descriptionLines:
      typeof input.descriptionLines === 'number'
        ? Math.min(Math.max(Math.round(input.descriptionLines), 0), 5)
        : DEFAULT_APPEARANCE.descriptionLines,
  };
}

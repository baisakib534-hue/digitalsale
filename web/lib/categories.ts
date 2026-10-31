/**
 * Product categories — grounded in Oct 2026 research on what actually sells
 * on Telegram: trading/signal channels, AI subscriptions & resold accounts,
 * ebooks/guides, courses, templates, presets, software & bots, memberships,
 * music/audio, design assets.
 */
export const CATEGORIES = [
  'Ebooks & Guides',
  'Courses',
  'Templates',
  'Presets',
  'Software & Bots',
  'AI Tools & Prompts',
  'Signals & Trading',
  'Memberships',
  'Music & Audio',
  'Design Assets',
] as const;

export type Category = (typeof CATEGORIES)[number];

export function isCategory(value: string): value is Category {
  return (CATEGORIES as readonly string[]).includes(value);
}

/** Map legacy v1 category names onto the v2 list (used by the DB migration). */
export const LEGACY_CATEGORY_MAP: Record<string, Category> = {
  Presets: 'Presets',
  Templates: 'Templates',
  Icons: 'Design Assets',
  Ebooks: 'Ebooks & Guides',
  Textures: 'Design Assets',
  'UI Kits': 'Design Assets',
};

/**
 * Product categories — grounded in Oct 2026 research on what actually sells
 * on Telegram: trading/signal channels, AI subscriptions & resold accounts,
 * ebooks/guides, courses, templates, presets, software & bots, memberships,
 * music/audio, design assets.
 *
 * v7: Redbubble-range expansion — the same breadth Redbubble allows, as
 * digital goods (design files, print-ready art, wallpapers): stickers,
 * apparel graphics, wall art/posters, phone & tech.
 *
 * v15: Etsy digital-coverage expansion — every digital product type that
 * sells on Etsy can now be listed here: planners & journals, SVG cut files,
 * wedding & invitations, spreadsheets & trackers, Notion templates,
 * resume templates, fonts.
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
  'Stickers & Decals',
  'Apparel Designs',
  'Wall Art & Posters',
  'Phone & Tech',
  'Planners & Journals',
  'SVG Cut Files',
  'Wedding & Invitations',
  'Spreadsheets & Trackers',
  'Notion Templates',
  'Resume Templates',
  'Fonts',
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

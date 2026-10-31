/**
 * Scam-phrase flagging (v4). Listing title/description is scanned on product
 * create/edit; matches set products.flagged = 1 (visible in the admin queue).
 * Flagging is for review — it never auto-blocks and is never public.
 */

const PATTERNS: { re: RegExp; label: string }[] = [
  { re: /guaranteed\s+profit/i, label: 'guaranteed profit' },
  { re: /double\s+your\s+(crypto|bitcoin|money|investment)/i, label: 'double your crypto' },
  { re: /risk[\s-]*free\s+(investment|profit|return|trading)/i, label: 'risk-free investment' },
  { re: /100%\s+guaranteed\s+returns?/i, label: '100% guaranteed returns' },
  { re: /no\s+risk.*guarantee/i, label: 'no-risk guarantee' },
  { re: /make\s+\$[\d,]+\s+(per|a|every)\s+(day|week)\s+guaranteed/i, label: 'guaranteed income claim' },
  { re: /send\s+\d+.*(get|receive)\s+back\s+double/i, label: 'doubling scam pattern' },
  { re: /investment\s+doubling/i, label: 'investment doubling' },
  { re: /guaranteed\s+\d+\s*x\s+returns?/i, label: 'guaranteed multiplier returns' },
  { re: /free\s+money\s+glitch/i, label: 'free money glitch' },
];

export interface ScamHit {
  label: string;
  excerpt: string;
}

/** Scan listing text. Returns matched phrases (empty = clean). */
export function scanListingText(title: string, description: string): ScamHit[] {
  const text = `${title}\n${description}`;
  const hits: ScamHit[] = [];
  for (const p of PATTERNS) {
    const m = p.re.exec(text);
    if (m) {
      const start = Math.max(0, (m.index ?? 0) - 24);
      hits.push({ label: p.label, excerpt: text.slice(start, (m.index ?? 0) + m[0].length + 24).replace(/\s+/g, ' ').trim() });
    }
  }
  return hits;
}

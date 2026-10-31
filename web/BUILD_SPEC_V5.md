# Mosshaw — Build Spec v5 (design overhaul: kill the AI-slop look)

His verdict: the current design still reads as AI-made. This spec replaces the
visual identity wholesale. Goal: a visitor trusts the site in 5 seconds because
it feels crafted by a human with opinions — not a template.

## 1. Design tokens (replace the old palette/type everywhere)
- **Paper** `#F5EFE0` (warm cream, page bg) · **Paper-deep** `#ECE3CE` (sections)
- **Ink** `#122019` (near-black green, text) · **Moss** `#1C3A28` (dark panels)
- **Ember** `#D9481C` (the ONE accent — CTAs, stamps, active states. No amber, no gradients)
- **Sage** `#7A8B6F` (muted text) · **Line** `#D8CCB2` (borders)
- Success green `#2E7D4F`, warning stays amber-ish only for warnings.
- **Fonts** (via next/font/google, no external CSS): display **"Instrument Serif"**
  (400 + italic) for headlines — huge, editorial; UI/body **"Space Grotesk"**;
  numbers/labels/eyebrows **"Space Mono"** (tabular, receipt-like — trust cue).
- **Grain**: subtle SVG-noise overlay fixed on body (opacity ~0.05) — kills the flat digital look.
- **Rules**: NO linear gradients anywhere. NO glassmorphism. NO purple/blue.
  NO emoji as icons (use inline SVG). Shadows are hard offset (`4px 4px 0 ink`)
  on cards/badges, soft small shadow only on dropdowns/modals.

## 2. Signature elements (the "human made this" cues)
- **Stamp badges**: slightly rotated (`-2deg`) bordered stamps — "TELEGRAM-VERIFIED",
  "SCANNED CLEAN", "10% FLAT FEE" — Space Mono, uppercase, ember or moss.
- **Hand-drawn SVG**: underline squiggle under key headline words, arrow doodles
  pointing at CTAs, starburst behind prices. 3–4 reusable components in
  `components/doodles.tsx`.
- **Ticker**: keep the marquee strip but restyle (ink bg, paper text, mono font).
- **Buttons**: ember fill, ink text? No — paper text on ember; `whileTap={{scale:.96}}`
  hover lift; hard shadow that compresses on press.

## 3. Motion (framer-motion — add dependency)
- `components/Reveal.tsx`: whileInView fade+rise (y 24→0, 0.5s), stagger groups.
- Hero: headline lines stagger in, stamps pop with spring, doodle arrow draws
  (pathLength animation).
- Cards: hover lift (-4px) + shadow grow; press scale.
- Accordions on /how-it-works and /fees (AnimatePresence height).
- Page transitions: subtle — initial fade on route change via template.
- **prefers-reduced-motion**: disable all of it.

## 4. Click sound (`lib/sound.ts`, `components/SoundToggle.tsx`)
- Tiny WebAudio "tick" (oscillator blip ~1800Hz, 40ms, low gain) on primary
  button presses — generated in code, no audio assets.
- Toggle in footer (+ floating on mobile), persisted in localStorage, default ON
  but subtle. Respect reduced-motion? No — separate toggle; still keep it quiet.

## 5. Trust-building content (real, never faked)
- **Trust strip** under hero: 4 items with SVG icons — "Telegram-verified sellers",
  "Every file malware-scanned", "Reports are public", "10% flat fee — nothing hidden".
- **"Safety, in the open"** section on landing: LIVE numbers from the DB —
  new `GET /api/stats` → `{ productsLive, filesScanned, reportsResolved, sellersVerified }`
  (count from products/scan_logs/reports/users). Real numbers only; if zero, show
  the labels with "—" not fake counts. This is the core trust mechanic.
- Copy voice: warm, specific, plain-spoken. Name the guarantees we actually have.
  **Never**: fake testimonials, fake "12,000 happy sellers", stock-photo people.
- Product page: keep Safety section + report button; add "Scanned clean" stamp
  when the product's files passed scan (we know from scan_logs — join by product).

## 6. Pages
Reskin ALL pages in the new system: `/`, `/market`, `/product/[id]`, `/store/[slug]`,
`/affiliates`, `/dashboard`, `/dashboard/affiliate`, `/dashboard/moderation`,
`/verify`, `/auth`, `/how-it-works`, `/fees`, `/sell`, header, footer.
Keep all routes, APIs, and logic identical — this is a visual + motion overhaul,
not a refactor. Keep the file scanning, reports, affiliate math, verification —
untouched behavior.

## 7. Tests
- Existing 95 tests must stay green (no behavior change).
- Add: `/api/stats` returns correct counts on a seeded DB; SoundToggle persists
  preference; Reveal renders children (jsdom smoke).

## 8. Verification bar for the builder
`npm test` green, `npm run build` clean, and every page must be screenshotted
by the builder? No — the builder has no browser. Builder: finish code, keep it
clean, report done. Visual review is mine.

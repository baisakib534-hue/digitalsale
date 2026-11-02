# Digitalsale — Professional Redesign Round (v15)
# Repo: baisakib534-hue/digitalsale, branch master
# Workdir: ~/workspace/goals/sellbridge-borderless-creator-marketplace/web/
# Engine: Hermes Agent + 9router API
# (flamingocode-build combo) ONLY — headless form:
# /home/hatch/.local/bin/hermes chat --provider ninerouter --model flamingocode-build
# -s claude-design,popular-web-designs,humanizer,test-driven-development,debugging-discipline
# --checkpoints --oneshot -Q -q "$(cat <this-file>)"
# (--oneshot -Q BEFORE -q; -Q between -q and its query breaks parsing.)
#
# RULES: Work in small slices; commit every 2-3 slices with clear messages.
# Commit EVERY file you create before pushing; never leave an untracked file.
# Run the FULL test suite (node:test, 170 tests) after every slice — all must
# pass, no regressions. `npm run build` must succeed (Next.js 14 + Tailwind v3).
# Verify every claim in the CODE (grep markers, never trust a summary).
# Commit + PUSH yourself and verify git ls-remote origin master == local HEAD.
# If the push asks for a GitHub username/password, STOP and report it — do not
# enter any credential. No browser runtime test — the owner verifies visually.

## 1. Context

Digitalsale is a live creator marketplace (Gumroad-style, Telegram Mini App-first):
"Sell digital goods. Actually get paid." Sellers get USDT payouts via NOWPayments,
10% flat platform fee. Codebase: Next.js 14 + TypeScript + Tailwind CSS v3 +
better-sqlite3, in `web/`. Currently at v14.13, all 170 tests pass, deployed on
Vercel. The site WORKS — every feature is functional. The problem is purely
visual: the owner says it looks "AI slop" and unprofessional.

Your job: a full visual redesign that makes it look like a professionally
designed product (Stripe / Linear / Vercel / Gumroad level of craft) — NOT a
reskin, NOT a new feature. Every route, every component, every API stays
exactly as functional as today. Only the visual layer changes.

## 2. Design system (KEEP — do not reinvent)

- Brand tokens in `web/app/globals.css` are LOAD-BEARING: --paper #FBFAF7,
  --ink #1C1917, --ember #EA580C, --line #E7E0D4, etc., plus the dark-mode
  `[data-theme="dark"]` overrides. The price-tag logo (ember tag on ink square,
  `web/public/logo-icon.svg`) stays. You may REFINE tokens (tweak a radius,
  adjust a shadow, add 1-2 new tokens) but the brand identity — warm paper,
  ink-black, ember accent, NO gradients, NO glassmorphism — is final.
- Typography: Space Grotesk (UI) + Instrument Serif (display accents) are
  already wired. Use them with INTENTION: real hierarchy, not every heading
  the same size.
- Mobile-first. The primary surface is a phone screen inside Telegram.
  Desktop must look deliberate, not just stretched.

## 3. Standing product rules (NEVER violate)

- Buyer-first: logged-out header primary CTA = "Sign up"; homepage bottom CTA
  is buyer-led ("Find something made for you", Browse primary / Sell secondary).
  Seller-contextual "Start selling" stays on /fees, /how-it-works, /verify,
  footer sellers column.
- Buyers NEVER see fee info. Fee info is sellers-only (/fees, seller dashboard).
- NO competitor names anywhere on the site.
- Prices in cents in the DB; displayed formatted. Do not touch pricing logic.
- Telegram verification gate, affiliate program, reports, license keys,
  discount codes — all functional, do not touch logic, only visuals.

## 4. What "AI slop" means here — ELIMINATE all of it

Study the current `web/app/page.tsx`, `web/components/*`, `web/app/globals.css`
and remove every trace of generic AI-generated design:

- NO generic purple/blue gradients anywhere (there are none in the brand —
  keep it that way; also no ember gradients).
- NO cookie-cutter "hero → 3-column features → testimonial → CTA" SaaS template
  rhythm. The current page (hero-slim, trust-strip, safety stats, roadmap,
  marquee, CTA panel) reads as assembled from a template. Recompose it with a
  real editorial eye: what does a BUYER need to see first, second, third?
- NO decorative doodles/emoji that don't earn their place (the ArrowDoodle,
  tick-star ✦ marquee separators, sprout glyphs — audit each; keep only what
  serves the brand, redraw or remove the rest).
- NO "lorem-ipsum energy" copy. The humanizer skill applies to every string
  you touch: short, concrete, confident. No "Unlock the power of", no "seamless",
  no "revolutionize", no exclamation-point enthusiasm.
- NO uniform card grids where every card looks identical. Product cards should
  have real hierarchy: cover art leads, price is scannable, store name is quiet.
- NO reveal-on-scroll animation on EVERYTHING. Motion should be rare and
  meaningful (one or two moments per page, max). The current Reveal/RevealGroup
  wrappers on nearly every section feel cheap — be ruthless.
- NO inconsistent spacing. Establish a real vertical rhythm (one spacing scale,
  used everywhere) and stick to it.
- Every page needs a clear visual POINT: one thing the eye lands on first.
  If you can't name it, the layout is wrong.

## 5. Scope (visual layer only — all routes keep working)

1. `web/app/globals.css` — refine the design system: spacing scale, type scale,
   button styles, card styles, form styles, focus states. Everything derives
   from here.
2. `web/app/page.tsx` — homepage recomposition (buyer-first narrative).
3. `web/components/SiteHeader.tsx` + footer (in layout) — navigation that
   looks designed, not default.
4. `web/components/ProductCard.tsx` — the single most-seen component; make it
   excellent.
5. `web/app/market/` — browse experience.
6. `web/app/product/[id]/` — product detail (BuyPanel, gallery, reviews).
7. `web/app/sell/`, `web/app/dashboard/` — seller flows (keep dense and
   functional, but professional).
8. Auth pages, /fees, /how-it-works, /terms, /verify — consistent, quiet,
   professional.
9. Dark mode MUST stay correct on every page you touch (the
   `[data-theme="dark"]` tokens exist — verify contrast, don't just hope).

Reference the `popular-web-designs` skill for how Stripe/Linear/Vercel achieve
their polish (spacing discipline, restrained color, confident typography) —
take the CRAFT, not the look. Digitalsale must look like itself, only better.

## 6. Process

- Start by reading: `web/app/page.tsx`, `web/app/globals.css` (full),
  `web/components/SiteHeader.tsx`, `web/components/ProductCard.tsx`,
  `web/app/layout.tsx`. Understand the current visual language before changing it.
- Redesign in this order: (1) globals.css design-system refinement,
  (2) header/footer, (3) ProductCard, (4) homepage, (5) market + product detail,
  (6) remaining pages.
- After EACH slice: run the full test suite (`npm test` in `web/`) — 170/170
  must pass. Run `npm run build` at the end of slices 1, 4, and 6.
- NEVER change: `web/lib/*` business logic, `web/app/api/*` routes,
  `web/db/*` schema/migrations, pricing math, auth flows, Telegram gating.
  If a visual change needs a data shape that doesn't exist, STOP that slice
  and design around what exists.
- better-sqlite3 is compiled from source in this repo — do NOT `npm rebuild`
  or `npm install` fresh. Use the existing node_modules.
- Commit messages: `Design: <what changed>`. Final commit: `v15 redesign`.
  PUSH yourself; verify `git ls-remote origin master` == local HEAD.

## 7. Definition of done

- All 170 tests pass. `npm run build` succeeds with no new warnings.
- Every page listed in scope renders with the new visual language; dark mode
  verified by reading the dark token overrides (no unreadable text).
- No route broken, no API changed, no business logic touched.
- The site looks like a team of designers made it — not a template, not a
  prompt output. When in doubt, REMOVE decoration rather than adding it.

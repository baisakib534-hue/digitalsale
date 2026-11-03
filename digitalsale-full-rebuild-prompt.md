# Digitalsale — FULL PROFESSIONAL REBUILD (v16)
# Repo: baisakib534-hue/digitalsale, branch master
# Workdir: ~/workspace/goals/sellbridge-borderless-creator-marketplace/web/
# Engine: Hermes Agent + 9router API
# (flamingocode-build combo) ONLY — headless form:
# /home/hatch/.local/bin/hermes chat --provider ninerouter --model flamingocode-build
# -s claude-design,popular-web-designs,humanizer,design-md,test-driven-development,systematic-debugging,codebase-inspection,simplify-code
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

## 0. THE MISSION — READ THIS FIRST

You are rebuilding the ENTIRE frontend of Digitalsale, a live creator
marketplace ("Sell digital goods. Actually get paid." — Gumroad-style, Telegram
Mini App-first, USDT payouts via NOWPayments). The backend (all APIs, database,
auth, payments, Telegram bot) WORKS and is fully tested — DO NOT touch it.

The owner looked at the site and said it looks like "AI slop" — generic,
template-assembled, unprofessional. Your job: rebuild EVERY page, EVERY
component, EVERY string of copy so the site looks like a professional human
design agency delivered it — the kind of site that costs $10,000 to $100,000.

This means:
- Every page has a clear visual POINT — one thing the eye lands on first.
- Every string of copy sounds like a confident human wrote it — short,
  concrete, no AI-isms (use the humanizer skill on EVERYTHING you write).
- Every corner is considered — empty states, error states, loading states,
  form validation, focus states, mobile breakpoints. Nothing looks default.
- The design has a distinctive personality — warm paper marketplace, ink-black,
  ember accent — NOT a Stripe/Linear clone, but WITH their level of craft
  (study popular-web-designs for the discipline, not the look).

## 1. Skills — USE ALL OF THEM, ACTIVELY

- codebase-inspection: BEFORE changing anything, map the full frontend —
  every route in web/app/, every component in web/components/, the design
  tokens in web/app/globals.css. Understand what exists before you rebuild it.
- claude-design + popular-web-designs: your design taste and reference.
  Study how Stripe/Linear/Vercel achieve polish through spacing discipline,
  restrained color, and confident typography — then apply that discipline to
  Digitalsale's OWN brand.
- design-md: document the refined design system as you go (tokens, spacing
  scale, type scale) so it stays consistent.
- humanizer: EVERY string you write or touch goes through this. No "unlock",
  no "seamless", no "revolutionize", no "delve", no exclamation-point
  enthusiasm, no lorem-ipsum energy. If a sentence could be on any SaaS site,
  rewrite it.
- test-driven-development: the 170-test suite is your safety net — run it
  after every slice.
- systematic-debugging: when something breaks, diagnose properly.
- simplify-code: if a component is convoluted, simplify it — but NEVER
  simplify away functionality.

## 2. What you MUST NOT touch

- web/lib/* — business logic (pricing, fees, auth, licenses, signatures)
- web/app/api/* — ALL API routes (they power the site)
- web/db/* — schema, migrations, seed (the seed data is load-bearing for tests)
- web/lib/categories.ts — the 21 categories are FINAL (just expanded)
- Pricing math, auth flows, Telegram gating, affiliate logic, bot logic.
- If a visual change needs a data shape that doesn't exist, STOP that slice
  and design around what exists. NEVER invent backend changes.

## 3. What you MUST rebuild (every page, every component, every string)

IN ORDER:
1. web/app/globals.css — the ENTIRE design system. Spacing scale (one scale,
   used everywhere), type scale (real hierarchy), buttons (all variants),
   cards, forms, inputs, badges, empty states, skeletons, focus-visible
   states, dark mode tokens (verify contrast — don't hope).
2. web/components/SiteHeader.tsx + footer — navigation that looks designed.
3. web/components/ProductCard.tsx — the most-seen component on the site.
   Make it excellent: cover leads, price scannable, store name quiet.
4. web/app/page.tsx — homepage. Buyer-first narrative (see §4). Recompose
   with editorial judgment — NOT the current template rhythm.
5. web/app/market/ — browse/search experience.
6. web/app/product/[id]/ — product detail: gallery, BuyPanel, reviews,
   license display.
7. web/app/sell/ + web/app/dashboard/ — seller flows. Dense but professional.
8. web/app/auth/*, web/app/verify/, web/app/fees/, web/app/how-it-works/,
   web/app/terms/, web/app/wishlist/, web/app/history/, web/app/affiliates/,
   web/app/store/, web/app/s/[token]/ — every remaining page, consistent.
9. Every EmptyState, every error message, every loading skeleton, every
   form validation message — human copy, considered design.

## 4. Standing product rules (NEVER violate)

- Buyer-first: logged-out header primary = "Sign up". Homepage bottom CTA is
  buyer-led ("Find something made for you", Browse primary / Sell secondary).
  "Start selling" stays seller-contextual (/fees, /how-it-works, /verify,
  footer sellers column).
- Buyers NEVER see fee info. Fees are sellers-only.
- NO competitor names anywhere.
- Brand: warm paper #FBFAF7, ink #1C1917, ember #EA580C, NO gradients,
  NO glassmorphism. Price-tag logo stays. Instrument Serif + Space Grotesk.
- Mobile-first (Telegram Mini App is the primary surface). Desktop deliberate,
  not stretched.
- Dark mode MUST be correct on every page (read the dark tokens, verify).

## 5. The anti-slop checklist — apply to EVERYTHING

- [ ] No generic gradients (especially purple/blue — there are none, keep it so)
- [ ] No cookie-cutter SaaS section rhythm
- [ ] No decorative emoji/doodles that don't earn their place
- [ ] No AI-ism copy (humanizer on everything)
- [ ] No identical-looking card grids without hierarchy
- [ ] No reveal-on-scroll on everything (rare, meaningful motion only)
- [ ] One spacing scale, used everywhere
- [ ] Every page: name the ONE thing the eye lands on first
- [ ] When in doubt, REMOVE decoration rather than adding it

## 6. Definition of done

- All 170 tests pass. `npm run build` succeeds, no new warnings.
- Every route renders in the new visual language. Dark mode verified.
- No API changed, no business logic touched, no functionality lost.
- A stranger would guess a human design team made this — and an expensive one.
- Commit messages: `Design: <what>`. Final: `v16 full rebuild`. PUSH yourself;
  verify `git ls-remote origin master` == local HEAD.

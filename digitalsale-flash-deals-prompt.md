# Digitalsale — Feature 1: FLASH DEALS (v17)
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
# Run the FULL test suite (node:test) after every slice — all must pass, no
# regressions. `npm run build` must succeed (Next.js 14 + Tailwind v3).
# Verify every claim in the CODE (grep markers, never trust a summary).
# Commit + PUSH yourself and verify git ls-remote origin master == local HEAD.
# If the push asks for a GitHub username/password, STOP and report it — do not
# enter any credential. No browser runtime test — the owner verifies visually.
#
# PRECONDITION: the login-500 fix (users.status → banned_at) is already pushed
# and deployed. If `git ls-remote origin master` does not contain it, STOP —
# this feature builds on top of it.
#
# LESSON (2026-11-03): test fixtures must use the REAL schema
# (web/db/schema.sql + web/db/migrate.ts). The v13.2 trust-safety test invented
# its own `users.status` column, passed 173/173, and hid a production 500.
# Every new test fixture in this feature MUST reuse the real schema path —
# build fixtures by running schema.sql + migrations on :memory:, never by
# hand-writing CREATE TABLE.

## 0. THE MISSION — READ THIS FIRST

You are building FLASH DEALS for Digitalsale — the FIRST of four committed
buyer-first features (next: Bundle pricing, Wishlist price-drop alerts, Buyer
referral — DO NOT build those now; only Flash Deals).

Flash Deals = a seller puts ONE product on a time-boxed automatic discount.
No promo code — the discounted price applies itself at checkout while the deal
is live. A countdown timer creates urgency. This is Digitalsale's edge over
Etsy/Gumroad (neither has it).

Owner's taste (hard rules — he rejected two homepage designs for violating
these):
- Buyer-first: the deal must read as a GIFT to the buyer, never as seller spam.
- No AI slop: no "Hurry!!", no "Unlock savings", no exclamation-point hype,
  no fake scarcity. One calm countdown line: "Deal ends in 14:22:08".
- Design system: warm paper, ink-black, ember accent. The deal treatment must
  feel like it always belonged — a slim ember countdown strip, not a neon
  banner.
- Human copy via the humanizer skill on EVERY string.

## 1. Skills — USE ALL OF THEM, ACTIVELY

- codebase-inspection: BEFORE changing anything, map how products, prices,
  checkout (NOWPayments), the seller dashboard, and the bot daily-post worker
  actually work. Read web/lib/discounts.ts (existing code-based discounts —
  Flash Deals must NOT conflict with them; if both exist, the LOWER price wins
  and the UI says so plainly), web/lib/daily-posts.ts (bot post pipeline),
  the seller dashboard products tab, and the checkout price computation path.
- claude-design + popular-web-designs: study how one serious commerce site
  renders a live countdown (restraint, tabular numerals, no jitter) and apply
  that discipline here.
- design-md: record the deal visual tokens (countdown strip, deal badge)
  in the design system doc so later features reuse them.
- humanizer: EVERY string.
- test-driven-development: new tests per slice, full suite green every slice.
- systematic-debugging: diagnose, don't guess.
- simplify-code: keep the diff minimal — this is a feature, not a rewrite.

## 2. SCOPE — FLASH DEALS ONLY

### 2a. Data model (migration, idempotent, follows db/migrate.ts conventions)
New table `flash_deals`:
- id TEXT PRIMARY KEY, product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE
- discount_percent INTEGER NOT NULL (5–90, enforced in code AND a CHECK constraint)
- starts_at TEXT NOT NULL, ends_at TEXT NOT NULL (ends_at > starts_at enforced)
- created_at TEXT NOT NULL DEFAULT (datetime('now'))
- UNIQUE(product_id) — one live deal per product at a time (a second deal may
  be scheduled only after the first ends; enforce in code with a clear error).
- Index on (starts_at, ends_at) for the "live deals" query.

### 2b. Pricing (the money path — get this exactly right)
- lib/flashDeals.ts: `liveDealForProduct(db, productId, now)` → deal row or null.
- Checkout price computation: if a live flash deal exists, price = the discounted
  price, applied AUTOMATICALLY. If a discount CODE is also valid, the buyer gets
  the LOWER of the two — never stacked, never the higher. The order record must
  store which discount applied (deal id or code) for the seller's payout view.
- Edge cases (test each): deal ends mid-checkout (price re-validated at order
  creation, not at page render), 100% guard (min 1 cent — a free product is a
  different feature), stock_limit respected, unpublished/suspended products can
  never have a live deal.

### 2c. Seller dashboard (products tab)
- "Start flash deal" on a published product: discount % picker (preset chips
  10/20/30/50 + custom), duration picker (6h / 24h / 48h / 72h / custom end).
- Live deal row shows: discount, time left, orders attributed to the deal,
  revenue attributed — and "End early".
- Plain-language preview of exactly what the buyer will see (no surprises).

### 2d. Buyer surfaces
- Product card: slim ember countdown strip ("Deal ends in 14:22:08") + struck
  original price. Tabular numerals, no layout shift as it ticks.
- Product page: same strip, larger; the discount applies in the price shown.
- Homepage: a "Flash deals" rail (only when ≥1 live deal exists; section
  disappears entirely when empty — no sad empty state).

### 2e. Deal-start bot post (fits the owner's bot rule exactly)
- When a deal goes live, post ONCE to the seller's OWN linked channels via the
  seller's OWN connected bot (cover photo + Buy now deep link), reusing the
  daily-post worker's rendering path. SILENTLY SKIP when the seller has no bot
  connected or no channel linked — never via @Digitalsale_bot, never to anyone
  else's channel. The main bot posts nothing.

### 2f. Tests (real schema only — see PRECONDITION lesson)
- Deal CRUD + one-live-deal-per-product enforcement.
- Pricing: deal auto-applies; code-vs-deal takes the lower; expired deal
  ignored at order creation; min-1-cent guard.
- Ban interplay: a banned seller's deals never go live (reuse isBanned).
- Countdown math: ends_at in the past → not live.

## 3. OUT OF SCOPE (do not build, do not stub)
Bundle pricing, wishlist price-drop alerts, buyer referral, recurring/scheduled
deals, deal analytics beyond attributed orders/revenue, admin deal controls.

## 4. DONE = all of these, verified by you in the code
- `npm run build` succeeds; full node:test suite green (no regressions).
- Every new fixture uses the real schema (grep your test files for
  "CREATE TABLE users" — zero hits allowed).
- The money path has a test for every edge case in 2b.
- Committed in small slices, pushed, git ls-remote origin master == local HEAD.
- Final report: files changed, tests added (count), how the price path was
  verified, what the seller does to start a deal, what the buyer sees.

# Mosshaw — Build Spec v2 (affiliates + 10% fee + Etsy-like landing)

This OVERRIDES parts of BUILD_SPEC.md where they conflict. Everything else in v1 still stands.

## 0. Research grounding (Telegram commerce, Oct 2026)
Web + social research confirms what sells on Telegram: trading/forex/crypto signal
channels, AI subscriptions & resold accounts, ebooks/guides, courses, Notion/templates,
Lightroom presets, software & bots, IPTV/subscriptions, AI prompt packs, private
communities/coaching, music/audio, design assets. Categories below reflect this.

## 1. Platform fee: 5% → 10%
- `lib/brand.ts`: `feePercent = 10`. Update EVERYTHING that says 5%: landing fee table
  (recompute the dollar math), product page "Seller receives / Platform fee" rows,
  checkout summary, dashboard copy, tests, seed assertions.
- Owner's earning = 10% commission per sale. Keep the honest fee breakdown UI.

## 2. Categories (replace the old 6)
New canonical list in `lib/categories.ts`:
`['Ebooks & Guides', 'Courses', 'Templates', 'Presets', 'Software & Bots',
  'AI Tools & Prompts', 'Signals & Trading', 'Memberships', 'Music & Audio',
  'Design Assets']`
- Migrate seed products into these (8–10 products, forest-themed, realistic).
- Market filters, product form category select, and tests must use the new list.
- Old category names must not appear anywhere in UI.

## 3. Affiliate program (Gumroad-style, full system)
### Money math (document in code + UI, test exactly)
- Sale price P (cents). Platform takes 10% of P.
- If the product has affiliates enabled and the order carries a valid ref code,
  the affiliate earns `commission_percent` (set by the SELLER, 5–60%) of P.
- Seller gets P − platform_fee − affiliate_cut.
- Example: $100.00 sale, 20% affiliate → affiliate $20.00, platform $10.00, seller $70.00.

### Data
- `affiliates`: id, user_id UNIQUE, code UNIQUE (8-char, URL-safe), created_at
- `product_affiliates`: product_id PK, enabled INTEGER (0/1), commission_percent REAL
- `affiliate_clicks`: id, code, product_id, ip_hash, created_at
  (dedupe: one counted click per ip_hash+product per day)
- `orders`: add `affiliate_code TEXT NULL`, `affiliate_usd INTEGER DEFAULT 0`

### Tracking
- `/product/[id]?ref=CODE`: if CODE is a valid affiliate code, set httpOnly cookie
  `mosshaw_ref=CODE` (30 days) and record a click (deduped). Invalid codes are ignored silently.
- Checkout reads the cookie; if that product has affiliates enabled → attach
  `affiliate_code` + computed `affiliate_usd` to the order. Cookie cleared after purchase.

### Seller controls
- Product create AND edit forms get an "Affiliate program" section: on/off toggle +
  commission % slider/input (5–60, default 20). Editable any time after listing.
- Dashboard product list shows affiliate status per product.

### Affiliate side (anyone can join)
- Public page `/affiliates`: how it works, earning example, join CTA.
- `POST /api/affiliate/join` (auth) → creates affiliate + unique code.
- `/dashboard/affiliate`: stats (clicks, conversions, earnings), **link generator**
  (pick an affiliate-enabled product → copy `?ref=CODE` link), and **promo tools**:
  ready-to-post swipe copy (3 variants), creative cards (product cover + title + price
  + ref link, downloadable), and a personal storefront link `/?ref=CODE`.
- Affiliate earnings + USDT payout address on the same dashboard.

### API
- `POST /api/affiliate/join`, `GET /api/affiliate/me` (stats + code),
  `GET /api/affiliate/products` (affiliate-enabled published products),
  `PATCH /api/products/[id]` (affiliate toggle + commission, owner only).

## 4. Landing = Etsy-like, products first
- `/` shows products FIRST, like Etsy: slim header, prominent search, category pills,
  product grid immediately. Only a slim hero strip on top (one line + CTA), no giant
  marketing hero.
- Move the rest to separate pages: `/how-it-works`, `/fees` (comparison table),
  `/sell` (seller CTA + fee pitch). Header nav: Marketplace, Affiliates, How it works,
  Fees, Sell.

## 5. Design polish — human-made beauty
Do a deliberate polish pass over every page after the feature work:
- Refined hover/focus/active states on cards, buttons, inputs (no dead-feeling controls)
- Consistent spacing rhythm, optical alignment of icons/text, real micro-interactions
  (subtle transitions, skeleton shimmer, button press states)
- Product cards: better cover treatment, price hierarchy, store byline
- No generic gradients, no placeholder-looking sections, no lorem ipsum (already true — keep it)

## 6. Tests (add to `npm test`, all must pass)
- Fee math at 10% incl. rounding edge cases; fee + affiliate + seller == amount
- Affiliate: join creates unique codes; invalid ref ignored; click dedupe;
  order attribution via cookie; commission math incl. seller-set %; toggle off →
  no attribution; cookie cleared after purchase
- New categories: seed covers them, invalid category rejected
- IPN paid order preserves affiliate_usd

## Acceptance
- `npm test` green, `npm run build` clean
- Landing shows products first; /affiliates, /how-it-works, /fees, /sell all live
- Seller can toggle affiliate + set commission at listing AND edit later (verify by hand via API)
- Screenshots of /, /market, /affiliates, /dashboard/affiliate reviewed for human-grade design

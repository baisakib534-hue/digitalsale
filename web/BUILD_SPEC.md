# Mosshaw — Creator Marketplace Website (Build Spec v1)

Working brand: **Mosshaw** (forest-themed; swappable in one place: `lib/brand.ts`).
Positioning: "Gumroad where you can actually get paid." 5% platform fee. USDT payouts via NOWPayments.
Target surface: **Telegram Mini App first**, also a fully responsive standalone website.

## Stack
- Next.js 14 App Router + TypeScript + React 18 (repo root: `web/`)
- better-sqlite3 (WAL mode), DB file `web/data/mosshaw.db` (gitignored), schema in `web/db/schema.sql`
- No external DB/services required to run. All third-party integrations degrade gracefully when env keys are missing.
- `npm run dev`, `npm run build`, `npm start`, `npm test` (node:test, no extra runner)

## Design system — human-grade, zero AI slop
- `web/app/globals.css` holds real design tokens (CSS vars): forest palette —
  deep pine `#0C241B`, moss `#476B4F`, fern `#9DBE8C`, paper cream `#FAF5EA`,
  bark `#3E2F23`, amber CTA `#E8A33D`. No purple/blue gradients, no generic SaaS look.
- Typography: **Fraunces** (display serif) + **Inter** (UI), via Google Fonts.
  Real type scale, 8pt spacing grid, consistent radius (10–18px) and soft shadows.
- Every page needs designed empty states, loading skeletons, and error states.
- Copy must be real, marketplace-specific English — no lorem ipsum anywhere.
- Seed data: 1 demo seller + store + 6 realistic forest-themed digital products
  (Lightroom presets, Notion templates, icon pack, ebook, textures, UI kit) with
  generated SVG/CSS cover art (no external images).

## Pages
- `/` — landing: hero, how-it-works (3 steps), featured products, categories,
  fee comparison (5% vs Gumroad 10%), seller CTA, footer
- `/market` — browse: search, category filter, sort (newest/price), product cards
- `/product/[id]` — cover, description, store link, price USD, Buy button
- `/store/[slug]` — store header + its products
- `/auth` — email/password signup+login; Telegram auto-login when inside Telegram
- `/dashboard` — seller: sales/earnings overview, product CRUD, orders, store settings, USDT payout address
- `/dashboard/purchases` — buyer: owned products + download links
- `/checkout/[orderId]` — order summary → NOWPayments hosted invoice

## Telegram Mini App
- Load `https://telegram.org/js/telegram-web-app.js` in root layout; init helper in `lib/telegram.ts`:
  read `initData`, `themeParams` → map to CSS vars, `viewport` expand,
  `MainButton` on checkout, `BackButton` on sub-pages, `HapticFeedback` on key taps,
  closing confirmation during checkout. Full graceful fallback when not in Telegram.

## Auth
- `users`: id, email (unique, nullable for Telegram-only), password_hash (scrypt),
  telegram_id (unique, nullable), name, avatar_url, created_at
- Sessions: httpOnly signed cookie (HMAC, `SESSION_SECRET` env, dev fallback).
- `POST /api/auth/telegram` — validates initData hash (HMAC-SHA256 with bot token,
  per Telegram docs); creates/links user. Disabled gracefully if `TELEGRAM_BOT_TOKEN` unset.

## Stores & products
- `stores`: id, user_id, name, slug (unique), bio, avatar_url, banner_url, payout_usdt_address
- `products`: id, store_id, title, slug, description, price_usd (cents), category,
  tags, cover_url, status (draft/published), created_at
- `product_files`: id, product_id, filename, mime, size, provider (`telegram`|`local`),
  telegram_file_id, telegram_message_id, local_path
- Upload flow (seller dashboard): multipart POST `/api/products/[id]/files` →
  `lib/channelStore.ts` `archiveFile()`:
  - if `TELEGRAM_BOT_TOKEN` + `STORAGE_CHANNEL_ID` set → `sendDocument` to channel,
    store file_id/message_id
  - else → save under `web/storage/` (dev fallback), provider=`local`
- Listing flow also calls `archiveProduct()` which posts a product card message
  (id, title, price, store) to the channel — this is the bot contract surface.

## Bot contract (website side; full bot comes next)
- `BOT_CONTRACT.md` in `web/`: product payload schema, channel message format,
  `POST /api/bot/archive {productId}` (re-archive on demand, auth: seller owner),
  `POST /api/bot/webhook` stub (validates Telegram secret token header, logs update,
  returns ok) ready for the real bot to take over.

## Payments — NOWPayments
- `lib/nowpayments.ts`: `createInvoice({orderId, amountUsd})`, `verifyIpn(rawBody, sig)`
  (HMAC-SHA512 over sorted JSON, `NOWPAYMENTS_IPN_SECRET`); sandbox via `NOWPAYMENTS_SANDBOX=1`.
- `orders`: id, product_id, buyer_id/email, amount_usd, fee_usd (5%), seller_usd,
  status (pending/paid/failed), nowpayments_invoice_id, created_at
- Checkout: create pending order → invoice → 302 to `invoice_url`.
  Without `NOWPAYMENTS_API_KEY`: checkout page shows honest "payments not configured" state.
- `POST /api/ipn`: verify signature → on `finished` mark paid → grant download.
  Never trust unverified callbacks.

## Downloads
- `GET /api/download/[token]`: HMAC-signed, expiring tokens issued for paid orders;
  streams local file or redirects to Telegram `getFile` URL when provider=telegram.

## Tests (`npm test`, must all pass)
- DB schema + seed integrity
- Auth: signup, login, wrong password rejected, session cookie, Telegram initData
  validation (test vector with known bot token)
- Product CRUD + file archive fallback (local provider)
- Order math (5% fee split), checkout without API key fails honestly,
  IPN signature verify (valid + tampered), download token expiry

## Acceptance
- `npm install && npm test` green, `npm run build` clean, `npm start` serves the site
- Every page reachable with no console errors; seeded marketplace looks alive
- All env-gated features degrade gracefully with clear messaging

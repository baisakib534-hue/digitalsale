# SellBridge 🌉

The borderless creator marketplace — sell digital products from **any country**,
get paid in **USDT**. No country bans. 5% fee (Gumroad charges 10%).

## Why it exists

Gumroad and Etsy can't pay sellers where their banks don't reach — Bangladesh isn't
even on Etsy's eligible-seller list. SellBridge settles in USDT via NOWPayments:
if you can receive crypto, you can sell. Sanctioned regions excluded by law.

## MVP scope (v0.1)

- Landing page with Gumroad/Etsy comparison
- Market: browse + buy digital products (crypto checkout via NOWPayments hosted invoice)
- Seller dashboard: publish products, see sales/revenue/USDT balance
- IPN webhook: marks orders paid, credits seller balance minus 5% platform fee
- Buyer download link after payment

## Setup

```bash
npm install
cp .env.example .env   # fill in Supabase + NOWPayments keys
npm run dev
```

1. **Supabase** (free): create project → SQL editor → run `supabase/schema.sql`.
2. **NOWPayments** (free): sign up → get API key + IPN secret.
   Set IPN callback URL to `https://YOUR-DOMAIN/api/ipn` in dashboard.
3. **Deploy** (Vercel free): push to GitHub → import → set root dir → add env vars → deploy.

## Money flow

```
Buyer pays $10 (300+ cryptos accepted)
  → NOWPayments settles USDT (0.5–1% deposit fee)
  → IPN confirms → seller credited $9.50 (5% platform fee)
  → buyer gets download link instantly
  → seller withdraws USDT anytime (0% payout fee, manual in MVP)
```

## Roadmap

- [ ] Deploy + 5 test sellers, 1 real sale end-to-end
- [ ] Supabase Storage for file uploads (replace pasted URLs)
- [ ] Magic-link auth (replace email-only dashboard)
- [ ] Auto USDT payouts via NOWPayments mass-payout API
- [ ] Reviews/ratings, categories, search
- [ ] Tighten RLS before public launch (see schema.sql note)

## Honest limits

- Sanctioned countries can't be served — by anyone, by law.
- NOWPayments account needed; verify Bangladesh signup works before promising dates.
- MVP trusts sellers' file URLs — add upload scanning before scale.

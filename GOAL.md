# SellBridge — Borderless Creator Marketplace

Goal ID: goal_8b1250a8a68b
Goal slug: sellbridge-borderless-creator-marketplace

## Description
Gumroad/Etsy-এর মতো creator marketplace — কিন্তু country ban ছাড়া। যেকোনো দেশের সেলার digital product বেচবে, USDT-তে payout পাবে (NOWPayments rail)। ৫% প্ল্যাটফর্ম ফি (Gumroad-এর ১০%-এর অর্ধেক)। Positioning: "Gumroad where you can actually get paid."

## Payment rail due diligence (2026-10-19)
- NOWPayments WORKS for Bangladesh (not restricted; their own blog ranks it #1 gateway
  in BD 2026). Signup risk: LOW.
- CATCH: NOWPayments ToS 15.1 excludes EU/UK/US residents; no MiCA license → no lawful
  EU service. Crypto deposits work in ~170 countries, but the big buyer markets (US/EU)
  are out. Strategy implication: SellBridge = "marketplace for the rest of the world"
  (South Asia, Africa, LatAm, ME, SE Asia) — exactly the underserved segment. US/EU
  coverage later via CoinGate (CASP-licensed) or BitPay as second rail.
- Risk: custodial by default + account-freeze history as volume grows → connect external
  payout wallet immediately, switch custodial mode off; KYC can trigger on flagged txs.

## Build status
- [x] MVP scaffold: Next.js 14 — landing, /market, /sell, /api (products, checkout, ipn,
      download, seller/summary); Supabase schema (sellers/products/orders); `npm run build` OK
- [x] Git repo init, clean history (node_modules excluded), push-ready
- [ ] BLOCKED: Supabase SQL run + NOWPayments signup/API key (user)
- [ ] Vercel deploy → 5 test sellers → first real sale

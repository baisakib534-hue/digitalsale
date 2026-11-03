# Digitalsale — FULL REBUILD CONTINUATION (v16, round 4)
# Repo: baisakib534-hue/digitalsale, branch master
# Workdir: ~/workspace/goals/sellbridge-borderless-creator-marketplace/web/
# Engine: Hermes Agent + 9router API
# (flamingocode-build combo) ONLY — headless form:
# /home/hatch/.local/bin/hermes chat --provider ninerouter --model flamingocode-build
# -s claude-design,popular-web-designs,humanizer,design-md,test-driven-development,systematic-debugging,codebase-inspection,simplify-code
# --checkpoints --oneshot -Q -q "$(cat <this-file>)"
#
# CONTEXT: Rounds 1-3 completed and pushed. Round 3 did the seller dashboard.
# You are finishing the REMAINING pages. Verify completed work via git log.

## Already done (DO NOT redo):
- web/DESIGN.md, web/app/globals.css design system
- SiteHeader, footer, ProductCard, WishlistButton
- Homepage, Market, Product Detail, Sell page
- Seller dashboard (7 tabs) — commit 025da01
- /setupbot backend (lib/seller-bot-setup.ts) — backend, DO NOT touch

## Your job — finish these, IN ORDER:
1. web/app/auth/ — login/signup pages (redesign, keep logic)
2. web/app/verify/ — Telegram verification flow page
3. web/app/fees/, web/app/how-it-works/, web/app/terms/ — static pages
4. web/app/wishlist/, web/app/history/ — buyer pages
5. web/app/affiliates/ — affiliate dashboard page
6. web/app/store/[slug]/, web/app/s/[token]/ — storefront pages
7. Every EmptyState, error message, loading skeleton, form validation
   message across the app — human copy (humanizer), considered design
8. FINAL: run FULL test suite (173 tests, all must pass),
   `npm run build` must succeed. Fix anything broken.

## Rules:
- Skills: use ALL 8 actively.
- NEVER touch: web/lib/* business logic, web/app/api/* routes, web/db/*,
  web/lib/categories.ts, pricing math, auth flows, Telegram gating,
  affiliate logic, bot logic, lib/seller-bot-setup.ts.
- Standing product rules: buyer-first CTAs, buyers never see fee info,
  NO competitor names, brand tokens (paper/ink/ember, no gradients),
  mobile-first, dark mode correct everywhere.
- Work in small slices; commit every 2-3 slices (`Design: <what>`).
- Commit + PUSH yourself; verify git ls-remote origin master == local HEAD.
- If push asks for credentials, STOP and report — never enter them.
- Final commit message: `v16 full rebuild complete`.

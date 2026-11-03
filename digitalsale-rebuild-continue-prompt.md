# Digitalsale — FULL REBUILD CONTINUATION (v16, round 2)
# Repo: baisakib534-hue/digitalsale, branch master
# Workdir: ~/workspace/goals/sellbridge-borderless-creator-marketplace/web/
# Engine: Hermes Agent + 9router API
# (flamingocode-build combo) ONLY — headless form:
# /home/hatch/.local/bin/hermes chat --provider ninerouter --model flamingocode-build
# -s claude-design,popular-web-designs,humanizer,design-md,test-driven-development,systematic-debugging,codebase-inspection,simplify-code
# --checkpoints --oneshot -Q -q "$(cat <this-file>)"
#
# CONTEXT: Round 1 was killed by a platform restart after ~1 hour. It completed
# and committed 13 design slices (see git log). You are CONTINUING — do NOT
# redo completed work. Verify what's done via git log before touching anything.

## Already done (DO NOT redo — verify with git log):
- web/DESIGN.md design system doc
- web/app/globals.css design system refinement
- web/components/SiteHeader.tsx + footer
- web/components/ProductCard.tsx + WishlistButton.tsx
- web/app/page.tsx homepage
- web/app/product/[id]/ product detail
- web/app/market/ browse page
- web/app/sell/ seller landing

## Your job — finish what remains, IN ORDER:
1. web/app/dashboard/ — seller dashboard (all tabs: overview, products,
   orders, payouts, affiliates, Telegram, settings). Dense but professional.
2. web/app/auth/ — login/signup pages.
3. web/app/verify/ — Telegram verification flow.
4. web/app/fees/, web/app/how-it-works/, web/app/terms/ — static info pages.
5. web/app/wishlist/, web/app/history/ — buyer pages.
6. web/app/affiliates/ — affiliate dashboard.
7. web/app/store/[slug]/, web/app/s/[token]/ — storefront pages.
8. Every remaining EmptyState, error message, loading skeleton, form
   validation message — human copy (humanizer skill), considered design.
9. Final pass: run the FULL test suite (170 tests, all must pass),
   `npm run build` must succeed with no new warnings. Fix anything broken.

## Rules (same as round 1):
- Skills: use ALL of claude-design, popular-web-designs, humanizer, design-md,
  test-driven-development, systematic-debugging, codebase-inspection,
  simplify-code — actively, not nominally.
- NEVER touch: web/lib/* business logic, web/app/api/* routes, web/db/*
  schema/migrations/seed, web/lib/categories.ts, pricing math, auth flows,
  Telegram gating, affiliate logic, bot logic.
- Standing product rules: buyer-first CTAs, buyers never see fee info,
  NO competitor names, brand tokens (paper/ink/ember, no gradients),
  mobile-first, dark mode correct everywhere.
- Anti-slop checklist applies to everything (see the original spec at
  digitalsale-full-rebuild-prompt.md if you need it).
- Work in small slices; commit every 2-3 slices (`Design: <what>`).
- Commit + PUSH yourself; verify git ls-remote origin master == local HEAD.
- If push asks for credentials, STOP and report — never enter them.
- Final commit message: `v16 full rebuild complete`.

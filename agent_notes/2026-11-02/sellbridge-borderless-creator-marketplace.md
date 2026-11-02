# Study Notes - 2026-11-02 - SellBridge — Borderless Creator Marketplace
<!-- studying-run-start: 2026-11-02T04:13:31Z -->

## Goal essence
Outcome goal (category: money): the user's main bet against the $1M/1-year pressure he named 2026-10-18 — a Gumroad/Etsy-like creator marketplace for sellers in banned/underserved countries, crypto checkout with USDT payouts (NOWPayments rail), no country bans. Positioning locked 2026-10-19: "Gumroad where you can actually get paid." Ordinary life/business goal, NOT a learning goal: the study task plan's teaching scaffolding (teach/novice, retrieval prompt, worked example, practice task, feedback rubric, transfer challenge, confidence check, next review 2026-11-03T04:13:31Z) is scheduler metadata only and is not preserved in this note, consistent with all prior notes for this goal.

**SellBridge is now Digitalsale.** The 2026-11-01 study note established this: his 2026-10-31T10:29:38Z order ("বাদ দেও একটা website বানাও gumroad x etsy এর মতো telegram miniapp এ লাগাবো") unshelved the goal, and the product now lives as **Digitalsale** (renamed from the "Mosshaw" working name by his order 2026-10-31T13:34:23Z) — Next.js 14, live repo **baisakib534-hue/digitalsale** (public), live at **https://digitalsale-pi.vercel.app**, **10% platform commission** (his order; goal record's 5% is stale), target Telegram Mini App + mobile-first. Today's note is a continuity check against that baseline.

## Where the goal stands (end of window 2026-11-02T04:01Z)
All in-window movement happened in main chat — his orders, the main agent's reports. No goal-record update (`user_goal.get`: timeline last update still 2026-10-20T15:00:31Z; `briefings: []` — no brief has ever been sent for this goal; `current_state` still "Marketplace MVP scaffold is built and verified, awaiting Supabase and NOWPayments keys"; description still says 5% fee; `attention_kind: does_not_need_attention`). The record remains stale vs reality — a later step with write access should reconcile it (brand name, 10% fee, live URL, repo).

New in-window vs the 2026-11-01 note (all main-chat-visible, none Letter-worthy):
- **v12:** seller profiles (logo + banner, social links), public profile store page, **white-label store links** `/s/st_…` (unique, no site branding; checkout still through the platform's payment gateway), seller API v1 (`dst_…` tokens, POST /api/v1/products). Live + smoke-tested.
- **Auto-post design locked by him** (2026-11-01T08:20:53Z: "digitalsale_bot দিয়ে auto post না — seller এর bot দিয়ে auto post"): auto-posts go through **each seller's own bot**, never @Digitalsale_bot. His standing rule; coded + commented accordingly.
- **Buyer-first CTAs** (his order): header "Start selling" → "Sign up"; buyer fees removed from product/checkout pages (fee info sellers-only); hero stamps (Telegram-verified seller, 10% flat fee, every file scanned) moved to a trust strip after he rejected the motion wall and the bento grid. **Design state: both rejected; the main agent asked him for a reference link/screenshot instead of guessing again.**
- **Bot wired + live:** @Digitalsale_bot token + TELEGRAM_WEBHOOK_SECRET set on Vercel; webhook registered at /api/bot/webhook (pending_update_count 0); bot welcome rewritten buyer-friendly with "Open Digitalsale" Mini App button.
- **NOWPayments DEFERRED to later by him** ("পরে লাগাও", 2026-11-01T21:37Z+06): login half-done (paknab56@gmail.com, email confirmation pending), window closed, account unchanged. His API key + IPN secret + his own USDT payout wallet still the blocker when he returns.
- **v14.9–v14.12:** price-tag logo designed (his order, #EA580C on #1C1917) applied to header + favicon; seller Telegram tools — connect own bot via BotFather token (validated via getMe, AES-encrypted) + link channels; daily auto-post worker /api/cron/daily-posts (10:00 UTC, CRON_SECRET) — **still needs OFFICIAL_CHANNEL_ID (+ TELEGRAM_BOT_USERNAME) env on Vercel.**
- **Account migration:** 'digitalsale-official' auto-suspended by GitHub; Vercel signup hard-blocked for official.digitalsale@gmail.com (do NOT retry); resolved via **org digitalsalehq** (created 2026-11-02 ~03:11 +06, Free, billing email official.digitalsale@gmail.com; he signed in as baisakib534-hue himself). Secondary-email add failed (tied to suspended account).
- **Stalled threads (all asked, unanswered):** 16-step browser E2E checklist (stalled since 2026-11-01 ~02:06 UTC awaiting his Secure Vault login-card fill); permanent Postgres (Supabase/Neon) decision; his click-through testing on his phone; design reference.

## Why this earns no Letter
- Today's study confirms continuity, not new evidence. Every in-window development (v12–v14.12 features, bot wiring, NOWPayments deferral, org migration, design rejections) was his order in main chat and the main agent's report back to him. A Letter's center would be his own report handed back to him ("your marketplace is live; here's what you ordered") — exactly the case the rules call `no_material_change` for.
- Repetition search (variants: `digitalsale`, `telegram mini`, `miniapp`, `affiliate`, `license`, `webhook`, `auto-post`/`daily-post`, `digitalsalehq`/`suspended`, `nowpayments` — over `agent_notes/` + `briefs/`, filenames included): `digitalsale` and `miniapp` hit only the 2026-11-01 note (read in full); `webhook` hits only the 2026-10-19 note's old NOWPayments-IPN scaffold context (unrelated to today's Telegram bot webhook — checked, no overlap); auto-post/daily-post and digitalsalehq/suspended have zero prior hits; `briefs/` is empty (no prior brief ever sent for this goal). The new-topic variants are genuinely new to the notes — but the conversation trigger fires on all of them, so `create` is still not earned.
- The conversation test: nothing the user hasn't already read. The free-text search (`SellBridge marketplace`, `Digitalsale marketplace`, `NOWPayments USDT payout`) over the in-window conversation returned no turns where the user learns something new about this goal from anyone but himself; the full turn list (read directly) shows his orders and the main agent's execution reports only.
- The one genuinely durable observation — the goal record is stale (brand, fee, live URL, repo all changed; `current_state` and `description` unchanged since 2026-10-20) — was already recorded in the 2026-11-01 note and is a record-reconciliation task for a later step, not a finding the user would learn from a Letter. He lived all the changes himself.

## Open questions for the next run (unchanged or new)
1. NOWPayments API key + IPN secret + his USDT payout wallet (deferred to later, his order).
2. OFFICIAL_CHANNEL_ID env for the daily auto-post worker — queued quietly, never re-push.
3. Permanent Postgres (Supabase/Neon) — signup/signin flakiness = per-instance ephemeral SQLite.
4. 16-step E2E resume: he fills the demo-buyer login card → re-dispatch the checklist.
5. Design: he sends a reference link/screenshot (no more guessing).
6. baisakib534-hue GitHub login on his network return — mostly FlamingoCode-scoped, but Digitalsale pushes also flow through it.

## Already Covered in Main Chat
- His seller-profile order (logo/banner/social, public profile page, unique white-label `/s/st_…` link, seller API) → v12 shipped, smoke-tested live.
- His auto-post correction ("seller এর bot দিয়ে auto post", not @Digitalsale_bot) → design locked, coded.
- Mobile grid 2-per-row, search pill rebuild, buyer fee text removed, theme/hardcoded-color fixes (17 spots), hero stamps moved to trust strip, motion wall → slowed → bento grid → clean grid (both rejected), buyer-first CTAs (header "Sign up").
- Telegram login flow (his number + codes), BotFather bot, @Digitalsale_bot webhook live + token set on Vercel, bot welcome + Mini App button.
- NOWPayments deferral order (পরে লাগাও); half-done login, nothing changed in the account.
- Account migration: digitalsale-official suspended, Vercel hard-blocked, org digitalsalehq created (he signed in himself), old Vercel session signed out.
- v14.9 logo, v14.10 bot welcome, v14.11 seller Telegram tools, v14.12 daily auto-post worker + pending OFFICIAL_CHANNEL_ID env.
- 16-step E2E stalled for his login-card fill; Postgres decision asked; his phone click-through testing pending.
- GitHub baisakib534-hue login waits on his tomorrow (network) — reported as waiting, login card stays in chat.

## Research Trajectory
- *External sources viewed*: none this run — all claims rest on the main-chat transcript (window 2026-11-01T04:01:00Z → 2026-11-02T04:16:57Z, full turn list read via `muse.context_fetch` + the persisted overflow file) and the user's own goal record; no third-party factual claim needed a fresh source. No web research needed: no competitor, pricing, or API facts were asserted.
- *Prior trajectories reviewed*: 2026-11-01 note read in full (the baseline: goal unshelved, Digitalsale live, 5%→10% fee, stale goal record — its findings stand, today's note is continuity); 2026-10-31 note's summary reused from the 11-01 note's review (seven no-change days, explicitly superseded). Repetition search run as required and documented under "Why this earns no Letter."
- *Scaffolds and support tactics*: no category scaffold registry for this goal (established 2026-10-19); proceeded on goal evidence. Money-category safety floor observed: no earnings promises, no new financial advice; fee math preserved as he stated ($100 → $10 platform / $25 affiliate / $65 seller).
- *Connected user data*: `user_goal.get` read (timeline, briefings, state — all stale, unchanged since 2026-10-20 except `updated_at` 2026-10-27). No connector mining: device/calendar/message data not probative for this build-stage goal. No goal write actions taken (read-only phase).
- *Image references checked*: none re-opened here — screenshots he shared were reviewed by the main agent in main chat.
- *User context and memory*: MEMORY.md Digitalsale entries corroborate the transcript (v14.5–v14.12, bot wired 2026-11-01 ~21:22 +06, org created 2026-11-02 ~03:11 +06, NOWPayments deferred, carrycle-cmyk flagged); alignment synthesis consulted for design-verdict and boundary norms. The study task plan's teach/novice scaffolding treated as scheduler metadata (outcome goal), consistent with all prior notes.
- *Searches skipped or unavailable*: domain/brand re-verification skipped (brand was his direct order); the 16-step E2E resume and any deployment verification are main-agent work, not study work; Postgres/webhook-infra claims rely on the main agent's in-window receipts already reported to the user.

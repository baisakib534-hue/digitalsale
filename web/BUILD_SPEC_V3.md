# Mosshaw — Build Spec v3 (Gmail-only auth + temp-mail block + Telegram verification)

Overrides v1/v2 where they conflict. Everything else still stands.

## 1. Email auth: @gmail.com ONLY, temp-mail blocked
- Signup AND login accept **only @gmail.com** addresses (case-insensitive).
  `googlemail.com` is normalized to `gmail.com`. Anything else → 400
  `{error:'email-not-gmail'}` with clear UI message "Only @gmail.com addresses are accepted."
- `lib/email.ts`:
  - `normalizeGmail(email)`: trim → lowercase → domain must be gmail.com/googlemail.com
    (else null) → canonical local = remove ALL dots + strip `+tag` suffix.
    Return `{display, canonical}` or null.
  - Uniqueness is enforced on the **canonical** address — `j.ohn+shop@gmail.com`
    and `john@gmail.com` are the SAME account. Duplicate canonical → 409
    `{error:'email-taken'}` (do not reveal which variant exists).
  - `isDisposable(email)`: blocklist in `lib/disposable-domains.ts` with 80+ known
    temp-mail domains (tmail.com, tempmail.*, guerrillamail.*, 10minutemail.*,
    mailinator.*, yopmail.*, etc.). Defense in depth alongside the gmail-only rule.
    Match → 400 `{error:'email-temp-blocked'}` "Temporary email addresses are not allowed."
- Rate limit: max 5 signup attempts per IP per 24h (`signup_attempts` table:
  ip_hash, created_at; prune old rows). Exceeded → 429 `{error:'rate-limited'}`.
- Existing non-gmail demo/seed accounts: migrate or re-seed the demo seller as a
  gmail address (e.g. `june.fernfield@gmail.com`), canonical-unique.

## 2. Telegram verification MANDATORY after signup
- `users`: add `telegram_verified INTEGER DEFAULT 0`, `telegram_username TEXT NULL`
  (telegram_id already exists).
- New accounts are **unverified**. Gated actions (require verified=1, else 403
  `{error:'telegram-verification-required'}` + UI redirect to `/verify`):
  creating a store, creating/editing products, joining the affiliate program,
  accessing `/dashboard` seller features. Browsing, market, and guest checkout stay open.
- Verification paths:
  a. **Inside Telegram Mini App**: `POST /api/auth/telegram` with valid initData →
     link telegram_id AND set `telegram_verified=1` (Mini App presence = proof).
  b. **On web via @Digitalsale_bot**: page `/verify` (auth) shows a deep link
     `https://t.me/Digitalsale_bot?start=v_<token>` + copy button + live status
     (poll `GET /api/auth/telegram/status`). `verification_tokens` table:
     token (32 hex chars), user_id, expires_at (15 min), used.
     `POST /api/bot/webhook` handles the Telegram Update: on message text
     `/start v_<token>` → look up token (valid, unused, unexpired) → set
     `telegram_verified=1`, `telegram_id`, `telegram_username` → mark token used →
     reply via `sendMessage` (needs `TELEGRAM_BOT_TOKEN`; if unset, log + still
     mark verified so the contract is testable). Validate the
     `X-Telegram-Bot-Api-Secret-Token` header against `TELEGRAM_WEBHOOK_SECRET`
     when set. Document the full update schema in BOT_CONTRACT.md.
- `/verify` UI: clear steps, human-designed, shows verified state with success screen.
- Seed demo seller: `telegram_verified=1`.
- Auth page copy: "Only Gmail. Every account is verified with Telegram — no fake stores."

## 3. Tests (add; all green)
- normalizeGmail: dots/plus/googlemail cases, uppercase, invalid domains → null
- Signup: non-gmail rejected, disposable rejected, duplicate canonical rejected,
  rate limit trips on 6th attempt
- Gating: unverified user gets 403 on store create / product create / affiliate join;
  verified user passes
- Webhook: valid token verifies user (mock sendMessage), reused/expired/unknown
  token rejected; wrong secret header → 401
- initData path sets telegram_verified=1

## 4. UI
- Login/signup forms: Gmail-only hint text, inline validation errors (no dead submits)
- Persistent "Verify with Telegram" banner for unverified logged-in users
- `/verify` page + `/dashboard` gating notices, all in the forest design system

# Mosshaw ↔ Telegram Bot Contract (website side)

**Bot: [@Digitalsale_bot](https://t.me/Digitalsale_bot)** (created by the store owner).
No token is stored here — the website reads `TELEGRAM_BOT_TOKEN` from the
environment only (see below).

The website archives every seller product file to a Telegram channel
(`lib/channelStore.ts`) and posts a product card message per listing.
This document is the contract the full bot (built next) will consume.
The website side is complete; the bot only needs to read.

## Environment

| Variable               | Meaning                                              |
| ---------------------- | ---------------------------------------------------- |
| `TELEGRAM_BOT_TOKEN`   | Bot token from @BotFather                            |
| `STORAGE_CHANNEL_ID`   | Channel chat id the bot posts to (e.g. `-100123…`)   |
| `TELEGRAM_WEBHOOK_SECRET` | Secret token the website checks on `/api/bot/webhook` |

When `TELEGRAM_BOT_TOKEN` / `STORAGE_CHANNEL_ID` are unset, the website
uses the local-disk fallback (`web/storage/`) and `archiveProduct()`
returns `{ posted: false, reason: 'not-configured' }` — no errors, no crashes.

## Product card message format

Posted by `archiveProduct()` via `sendMessage` with `parse_mode: HTML`:

```html
<b>{title}</b>
💰 ${price_usd} · 🏪 {store_name}
🆔 <code>{product_id}</code>
🔗 {product_url}        <!-- optional -->
```

Example:

```html
<b>Evergreen — 24 Lightroom Presets</b>
💰 $24.00 · 🏪 Fern & Field
🆔 <code>9f3c…</code>
🔗 https://mosshaw.example/product/9f3c…
```

The bot can parse the `🆔 <code>` line to map channel messages → product ids.

## File archive format

`archiveFile()` uses `sendDocument` with the original filename as caption.
The returned `document.file_id` + `message_id` are stored in `product_files`:

| column                | meaning                              |
| --------------------- | ------------------------------------ |
| `provider`            | `telegram` or `local`                |
| `telegram_file_id`    | `document.file_id` from sendDocument |
| `telegram_message_id` | channel message id of the document   |
| `local_path`          | `storage/<uuid>-<name>` (fallback)   |

Downloads: `GET /api/download/[token]` redirects to the Telegram
`getFile` URL for `telegram` files, or streams the file for `local` files.

## Website endpoints the bot will call

### `POST /api/bot/archive` — re-archive on demand
Auth: seller session cookie; the caller must own the product's store.

```jsonc
// request
{ "productId": "9f3c…" }
// response 200
{ "ok": true, "posted": true, "messageId": 123 }
{ "ok": true, "posted": false, "reason": "not-configured" }
```

### `POST /api/bot/webhook` — Telegram update receiver (@Digitalsale_bot)
- Validates the `X-Telegram-Bot-Api-Secret-Token` header against
  `TELEGRAM_WEBHOOK_SECRET` (when set). Mismatches → `401`.
- Handles the **verification deep link**: when a private message's text matches
  `/start v_<32-hex-token>` (from `https://t.me/Digitalsale_bot?start=v_<token>`),
  the token is consumed — the linked user's `telegram_verified` is set to 1 and
  their `telegram_id` / `telegram_username` are recorded — and the bot replies
  with a confirmation (or a failure reason for unknown/used/expired tokens).
- All other updates are acknowledged with `{ "ok": true }` and ignored.

Documented update schema (Telegram Bot API):
```jsonc
{
  "update_id": 123,
  "message": {
    "message_id": 1,
    "from": { "id": 12345, "username": "someone", "first_name": "Sam" },
    "chat": { "id": 12345, "type": "private" },
    "text": "/start v_9f3c2ab41d07e8f6c5a4b3d2e1f00987"
  }
}
```
Related: `POST /api/auth/telegram/verify-token` (auth) mints the 15-minute
single-use token and returns `{ token, deepLink, expiresAt }`;
`GET /api/auth/telegram/status` (auth) returns `{ verified, telegramUsername }`
and is polled by the `/verify` page.

## Init-data login

`POST /api/auth/telegram` accepts `{ "initData": "<raw initData>" }`,
validates it per https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
(HMAC-SHA256, `WebAppData` key), and creates or links the user by
`telegram_id`. Returns `{ ok: true }` and sets the session cookie.
Disabled with a clear message when `TELEGRAM_BOT_TOKEN` is unset.

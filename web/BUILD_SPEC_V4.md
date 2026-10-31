# Mosshaw — Build Spec v4 (reports + anti-scam/malware)

Overrides v1–v3 where they conflict. Everything else still stands.

## 1. Report system (public trust & safety)
- Report button on every product page and store page (login required to report).
- `reports`: id, reporter_user_id, target_type ('product'|'store'), target_id,
  reason ENUM ('scam','malware','fake','copyright','prohibited','other'),
  details TEXT, status ('open','reviewed','actioned','dismissed'), created_at.
  One OPEN report per user per target (409 on duplicate).
- **Public visibility**: product/store pages show report count badge; a public
  "Safety" section on product pages lists recent report reasons (reporter anonymized
  as "a verified buyer"); store page shows trust status.
- **Auto-moderation**: ≥3 distinct reporters on one target → product auto-suspended
  (`status='suspended'`, hidden from market) pending review.
- **Admin queue** `/dashboard/moderation`: lists open reports with actions
  (dismiss / suspend product / unsuspend / suspend store). Admin = users whose
  canonical gmail is in `ADMIN_EMAILS` env (comma-separated). Non-admin → 403.
- API: `POST /api/reports`, `GET /api/reports?target=product:<id>` (public list),
  `GET /api/admin/reports`, `POST /api/admin/reports/[id]/action`.

## 2. Malware / scam file scanning (incl. inside ZIPs)
New `lib/scan.ts`: `scanUpload({buffer, filename, mime}) → {clean, reasons[]}`.
Run on EVERY file upload BEFORE channel archiving; reject with
400 `{error:'file-blocked', reasons}` and a human-readable UI message.
- **Extension blocklist**: exe, dll, msi, bat, cmd, ps1, vbs, vbe, jse, ws, wsf,
  scr, com, pif, reg, lnk, jar, apk, dmg (as product payload), plus **double
  extensions** (`*.pdf.exe`, `*.zip.scr`).
- **Magic-byte verification**: file signature must match its extension for common
  types (pdf=%PDF, zip=PK, png, jpg, gif, mp3, mp4, epub...). Mismatch → reject
  ("file content does not match its extension").
- **ZIP inspection** (use `adm-zip`, pure JS — no native deps): parse entries
  WITHOUT extracting; recurse into nested zips (max depth 3); caps: 500 entries,
  500MB total uncompressed (zip-bomb guard); reject on: blocked extension inside,
  double extension inside, path traversal (`../`), encrypted entries (flag as
  suspicious → reject: "encrypted archives are not allowed").
- **Other archives**: `.rar`/`.7z`/etc → reject with "please upload a ZIP file"
  (we only inspect ZIP).
- **Quarantine log**: `scan_logs` table (id, user_id, filename, reasons JSON, created_at)
  for admin review.
- **Scam text patterns** `lib/scamPatterns.ts`: title/description scanned on
  product create/edit for phrases like "guaranteed profit", "double your crypto",
  "risk-free investment", "100% guaranteed returns" → product gets `flagged=1`
  (visible in admin queue, NOT auto-blocked, NOT public).

## 3. Wiring
- Upload route: scan → block/reject BEFORE `archiveFile`; log to scan_logs.
- Reports: wire into product/store pages, market cards (suspended hidden),
  seller dashboard (see reports on own products), admin moderation page.
- Suspended products: excluded from market/search/API, product page shows
  "under review" notice.

## 4. Tests (add; all green)
- clean pdf/zip/png pass; .exe rejected; `doc.pdf.exe` rejected; magic-mismatch rejected
- zip containing .exe inside → rejected; nested zip with .bat → rejected;
  zip bomb (huge uncompressed size in headers) → rejected; encrypted zip → rejected;
  path traversal entry → rejected; .rar → rejected with zip message; 600-entry zip → rejected
- scam phrases flag product; clean copy does not
- report: create ok, duplicate blocked, 3rd distinct reporter auto-suspends,
  public list anonymizes reporter, admin actions work, non-admin 403

## 5. UI (forest design system)
- Report modal (reason radio + details + submit), report count badges, Safety section,
  "under review" product state, moderation queue table, upload-blocked error panel
  listing exact reasons in plain language.

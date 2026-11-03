import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomId } from './crypto';

/**
 * Channel storage — Digitalsale's file archive.
 *
 * Sellers upload product files in the dashboard. archiveFile() stores them:
 *  - if TELEGRAM_BOT_TOKEN + STORAGE_CHANNEL_ID are set → sendDocument to the
 *    channel, returning the Telegram file_id / message_id (provider "telegram")
 *  - otherwise → local disk under web/storage/ (provider "local", dev fallback)
 *
 * archiveProduct() posts the product card message to the channel — this is the
 * bot-contract surface the future full bot will consume.
 *
 * Everything degrades gracefully: Telegram failures fall back to local disk,
 * and archiveProduct() is a no-op (with a reason) when unconfigured.
 */

export type FileArchive =
  | { provider: 'telegram'; telegramFileId: string; telegramMessageId: number }
  | { provider: 'local'; localPath: string };

export interface ArchiveFileInput {
  buffer: Buffer;
  filename: string;
  mime: string;
}

function botToken(): string {
  return process.env.TELEGRAM_BOT_TOKEN || '';
}

function channelId(): string {
  return process.env.STORAGE_CHANNEL_ID || '';
}

function safeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() || 'file';
  return base.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'file';
}

export function localDir(): string {
  // Vercel serverless filesystem is read-only except /tmp.
  if (process.env.VERCEL) return process.env.LOCAL_STORAGE_DIR || '/tmp/digitalsale-storage';
  return process.env.LOCAL_STORAGE_DIR || join(process.cwd(), 'storage');
}

function saveLocal(buffer: Buffer, filename: string): FileArchive {
  const dir = localDir();
  mkdirSync(dir, { recursive: true });
  const stored = `${randomId()}-${safeFilename(filename)}`;
  writeFileSync(join(dir, stored), buffer);
  return { provider: 'local', localPath: stored };
}

export async function archiveFile(input: ArchiveFileInput): Promise<FileArchive> {
  const token = botToken();
  const chatId = channelId();
  if (!token || !chatId) {
    return saveLocal(input.buffer, input.filename);
  }
  try {
    const form = new FormData();
    form.append('chat_id', chatId);
    form.append('caption', input.filename.slice(0, 200));
    form.append(
      'document',
      new Blob([new Uint8Array(input.buffer)], { type: input.mime || 'application/octet-stream' }),
      safeFilename(input.filename)
    );
    const res = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
      method: 'POST',
      body: form,
    });
    const json = (await res.json()) as {
      ok: boolean;
      result?: { message_id: number; document?: { file_id: string } };
      description?: string;
    };
    if (!json.ok || !json.result?.document?.file_id) {
      throw new Error(json.description || 'sendDocument failed');
    }
    return {
      provider: 'telegram',
      telegramFileId: json.result.document.file_id,
      telegramMessageId: json.result.message_id,
    };
  } catch (err) {
    // Honest fallback: never lose the seller's file.
    console.warn('[channelStore] Telegram archive failed, falling back to local:', (err as Error).message);
    return saveLocal(input.buffer, input.filename);
  }
}

export interface ArchiveProductInput {
  id: string;
  title: string;
  priceUsd: number; // dollars, for display
  storeName: string;
  url?: string;
}

export interface ArchiveProductResult {
  posted: boolean;
  reason?: string;
  messageId?: number;
}

/**
 * Post the product card to the storage channel (bot contract surface).
 * Payload schema is documented in web/BOT_CONTRACT.md.
 */
export async function archiveProduct(input: ArchiveProductInput): Promise<ArchiveProductResult> {
  const token = botToken();
  const chatId = channelId();
  if (!token || !chatId) {
    return { posted: false, reason: 'not-configured' };
  }
  try {
    const text =
      `<b>${escapeHtml(input.title)}</b>\n` +
      `💰 $${input.priceUsd.toFixed(2)} · 🏪 ${escapeHtml(input.storeName)}\n` +
      `🆔 <code>${escapeHtml(input.id)}</code>` +
      (input.url ? `\n🔗 ${escapeHtml(input.url)}` : '');
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    });
    const json = (await res.json()) as { ok: boolean; result?: { message_id: number }; description?: string };
    if (!json.ok || !json.result) {
      return { posted: false, reason: json.description || 'sendMessage failed' };
    }
    return { posted: true, messageId: json.result.message_id };
  } catch (err) {
    return { posted: false, reason: (err as Error).message };
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Build a Telegram getFile download URL for a stored file_id. */
export async function telegramFileUrl(fileId: string): Promise<string | null> {
  const token = botToken();
  if (!token) return null;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getFile`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ file_id: fileId }),
    });
    const json = (await res.json()) as { ok: boolean; result?: { file_path: string } };
    if (!json.ok || !json.result?.file_path) return null;
    return `https://api.telegram.org/file/bot${token}/${json.result.file_path}`;
  } catch {
    return null;
  }
}

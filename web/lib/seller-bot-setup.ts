/**
 * Seller bot auto-setup (v16.1).
 *
 * When a seller connects their OWN Telegram bot via the dashboard, that bot
 * is just a raw token — no commands, no menu button, no description. The
 * `/setupbot` command in @Digitalsale_bot configures the seller's bot through
 * the Telegram Bot API using their stored (AES-encrypted) token:
 *
 *   - setMyCommands: /start, /shop, /help
 *   - setMyShortDescription / setMyDescription: store branding
 *   - setChatMenuButton: "Open Shop" button -> their storefront mini app
 *
 * The seller's storefront URL uses the white-label token (/s/[token]) when
 * available, falling back to /store/[slug].
 */
import { BRAND } from './brand';
import { decryptBotToken } from './bot-notify';

interface SetupResult {
  ok: boolean;
  error?: string;
}

async function botApi(token: string, method: string, body: Record<string, unknown>): Promise<boolean> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as { ok?: boolean; description?: string };
    if (!data.ok) {
      console.error(`[seller-bot-setup] ${method} failed:`, data.description);
      return false;
    }
    return true;
  } catch (e) {
    console.error(`[seller-bot-setup] ${method} error:`, e);
    return false;
  }
}

export interface SellerBotConfig {
  storeName: string;
  storeBio: string;
  storeSlug: string;
  whitelabelToken: string | null;
  botUsername: string;
}

export async function setupSellerBot(
  tokenEnc: string,
  cfg: SellerBotConfig
): Promise<SetupResult> {
  const token = decryptBotToken(tokenEnc);
  if (!token) return { ok: false, error: 'Could not decrypt the stored bot token. Reconnect your bot from the dashboard.' };

  // Validate the token first — a revoked/changed token fails here.
  const valid = await botApi(token, 'getMe', {});
  if (!valid) {
    return { ok: false, error: 'Your bot token looks invalid or revoked. Generate a new one with @BotFather and reconnect it from the dashboard.' };
  }

  const shopUrl = cfg.whitelabelToken
    ? `${BRAND.siteUrl}/s/${cfg.whitelabelToken}`
    : `${BRAND.siteUrl}/store/${cfg.storeSlug}`;

  const shortDesc = `${cfg.storeName} — digital goods on Digitalsale`;
  const description =
    `🛍 ${cfg.storeName}\n\n` +
    (cfg.storeBio ? `${cfg.storeBio}\n\n` : '') +
    `Buy digital products, pay with crypto, download instantly.\n` +
    `Tap "Open Shop" below or use /shop to browse.`;

  const steps: Array<[string, Record<string, unknown>]> = [
    [
      'setMyCommands',
      {
        commands: [
          { command: 'start', description: 'Welcome + open the shop' },
          { command: 'shop', description: 'Browse this store' },
          { command: 'help', description: 'What this bot can do' },
        ],
      },
    ],
    ['setMyShortDescription', { short_description: shortDesc.slice(0, 120) }],
    ['setMyDescription', { description: description.slice(0, 512) }],
    [
      'setChatMenuButton',
      {
        menu_button: {
          type: 'web_app',
          text: 'Open Shop',
          web_app: { url: shopUrl },
        },
      },
    ],
  ];

  for (const [method, body] of steps) {
    const ok = await botApi(token, method, body);
    if (!ok) {
      return { ok: false, error: `Failed at "${method}" — the bot token may lack permissions. Try again.` };
    }
  }

  return { ok: true };
}

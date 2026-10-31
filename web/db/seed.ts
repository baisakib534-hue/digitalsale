import type Database from 'better-sqlite3';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomId, hashPassword } from '../lib/crypto';
import { slugify } from '../lib/format';
import { CATEGORIES } from '../lib/categories';
import { splitSale, DEFAULT_COMMISSION } from '../lib/affiliate';
import { localDir } from '../lib/channelStore';

/**
 * Demo seed: 1 seller + store, 10 forest-themed digital products across the
 * v2 categories (grounded in Telegram commerce research), generated SVG cover
 * art, demo product files (local provider), a demo buyer with paid orders,
 * and an affiliate demo (affiliates enabled on 3 products, one attributed sale).
 * Runs only when the users table is empty.
 */

const PINE = '#0C241B';
const MOSS = '#476B4F';
const FERN = '#9DBE8C';
const CREAM = '#FAF5EA';
const BARK = '#3E2F23';
const AMBER = '#E8A33D';

interface SeedProduct {
  slug: string;
  title: string;
  description: string;
  priceCents: number;
  category: string;
  tags: string;
  art: 'ridges' | 'cards' | 'icons' | 'book' | 'blobs' | 'ui' | 'chart' | 'chat' | 'play' | 'terminal' | 'wave';
  affiliate?: number; // commission % — affiliates enabled when set
}

const PRODUCTS: SeedProduct[] = [
  {
    slug: 'alpha-pine-signals',
    title: 'Alpha Pine — 30-Day Crypto Signals',
    description:
      'Thirty days inside a working crypto signals desk: 3–5 spot signals a week with entry, targets and invalidation — plus the reasoning behind every call, not just the numbers. Delivered to a private Telegram channel the moment you join. No leverage hype, no moon promises, just a documented 18-month track record and strict risk rules.',
    priceCents: 4900,
    category: 'Signals & Trading',
    tags: 'crypto,signals,trading,telegram,spot',
    art: 'chart',
    affiliate: 25,
  },
  {
    slug: 'prompt-grove',
    title: 'Prompt Grove — 500 AI Prompts',
    description:
      'Five hundred field-tested prompts for writing, code, design and research — organized by job, not by model. Each prompt ships with a worked example and a "when it fails" note. Works with ChatGPT, Claude and Gemini. Updated quarterly; buyers get every update free.',
    priceCents: 1900,
    category: 'AI Tools & Prompts',
    tags: 'ai,prompts,chatgpt,claude,productivity',
    art: 'chat',
  },
  {
    slug: 'slow-web-ebook',
    title: 'The Slow Web — an ebook',
    description:
      'A 148-page field guide to building a calm, independent creative business online: owning your audience, pricing digital products, leaving the algorithm treadmill. Part memoir, part manual — written over two winters in a cabin with unreliable wifi. EPUB, PDF and a printable zine version included.',
    priceCents: 1200,
    category: 'Ebooks & Guides',
    tags: 'ebook,business,indie,marketing,writing',
    art: 'book',
  },
  {
    slug: 'ship-it-course',
    title: 'Ship It — Video Course for Indie Makers',
    description:
      'A 4-hour video course on taking a digital product from idea to first sale in 30 days: validation without surveys, building the smallest sellable thing, launch checklists, and the exact emails that made $12k in a week. 28 lessons, transcripts, and the launch templates I actually use.',
    priceCents: 7900,
    category: 'Courses',
    tags: 'course,video,indie,launch,startup',
    art: 'play',
  },
  {
    slug: 'notion-creator-os',
    title: 'Studio — Notion Creator OS',
    description:
      'A complete Notion operating system for independent creators: content pipeline, product launch tracker, finance dashboard, sponsor CRM and a weekly review ritual. 40+ databases, all wired together with relations and rollups. Duplicate the template and run your whole studio from one workspace.',
    priceCents: 1900,
    category: 'Templates',
    tags: 'notion,template,productivity,creator,planning',
    art: 'cards',
  },
  {
    slug: 'evergreen-presets',
    title: 'Evergreen — 24 Lightroom Presets',
    description:
      'Twenty-four hand-tuned Lightroom presets for moody forest light: deep pine shadows, soft fern highlights and warm amber skin tones. Works with Lightroom Classic, CC and Mobile (DNG included). Every preset was built on real RAW files shot in the Pacific Northwest — no crushed blacks, no plastic skin, just honest color.',
    priceCents: 2400,
    category: 'Presets',
    tags: 'lightroom,presets,photography,forest,moody',
    art: 'ridges',
    affiliate: 20,
  },
  {
    slug: 'gatekeeper-bot',
    title: 'Gatekeeper — Paid Channel Bot',
    description:
      'A self-hosted Telegram bot that sells access to your paid channel: generates single-use invite links after crypto payment, removes expired members automatically, warns before renewal, and keeps a clean subscriber list. One-time setup, no monthly fee, your keys, your data. Node.js source included.',
    priceCents: 9900,
    category: 'Software & Bots',
    tags: 'telegram,bot,software,membership,automation',
    art: 'terminal',
  },
  {
    slug: 'the-grove-membership',
    title: 'The Grove — Private Creator Community',
    description:
      'A year inside a small, serious community of independent creators: monthly build-in-public reviews, a private Telegram group with zero spam, quarterly pricing workshops, and first access to everything Fern & Field ships. Capped at 200 members so it stays useful.',
    priceCents: 2900,
    category: 'Memberships',
    tags: 'community,membership,creators,coaching,telegram',
    art: 'blobs',
  },
  {
    slug: 'moss-tapes-loops',
    title: 'Moss Tapes — 120 Lo-fi Loops',
    description:
      '120 royalty-free lo-fi loops recorded on tape: dusty drums, warbly keys, rain-soaked guitars and forest field recordings. 24-bit WAV, BPM-labeled, key-tagged, ready to drop into any DAW. Use in commercial releases — no attribution needed, no Content ID claims, ever.',
    priceCents: 1600,
    category: 'Music & Audio',
    tags: 'music,lofi,loops,samples,royalty-free',
    art: 'wave',
  },
  {
    slug: 'pinecone-icons',
    title: 'Pinecone — 480 Line Icons',
    description:
      '480 hand-drawn line icons in a consistent 24px grid with 2px strokes: nature, commerce, media, interface and travel sets. Ships as SVG, Figma components, PNG @1x/@2x/@3x and an icon font. Every icon redrawn three times until it felt inevitable.',
    priceCents: 1400,
    category: 'Design Assets',
    tags: 'icons,svg,figma,ui,line-icons',
    art: 'icons',
    affiliate: 15,
  },
  // v7: Redbubble-range categories — print-ready digital goods.
  {
    slug: 'cryptid-sticker-pack',
    title: 'Cryptid Sticker Pack — 60 Die-Cut Designs',
    description:
      '60 original cryptid sticker designs with die-cut outlines and bleed, delivered as print-ready PNG (300 DPI, transparent) plus vector SVG and a Cricut/Silhouette cut file bundle. Perfect for Redbubble, Etsy, or your own sticker shop — full commercial license included.',
    priceCents: 1900,
    category: 'Stickers & Decals',
    tags: 'stickers,print-on-demand,die-cut,redbubble,commercial-license',
    art: 'blobs',
  },
  {
    slug: 'moss-tee-graphics',
    title: 'Forest Punk — 40 T-Shirt Graphics',
    description:
      '40 distressed forest-punk t-shirt graphics: 4500×5400px transparent PNGs on print-ready placement, plus editable PSD/AI source files. Made for merch, Redbubble, and print-on-demand — tested on black and vintage-wash blanks.',
    priceCents: 2400,
    category: 'Apparel Designs',
    tags: 'tshirt,merch,print-on-demand,redbubble,graphics',
    art: 'ridges',
  },
  {
    slug: 'ember-wall-art',
    title: 'Ember Hour — 25 Printable Wall Art Posters',
    description:
      '25 moody wall-art posters at 24×36in, 300 DPI: ember-hour landscapes, abstract grain studies, and quiet forest scenes. Print at home, at a print shop, or upload to any print-on-demand wall-art service.',
    priceCents: 1200,
    category: 'Wall Art & Posters',
    tags: 'wall-art,posters,printable,print-on-demand,decor',
    art: 'cards',
  },
  {
    slug: 'night-market-wallpapers',
    title: 'Night Market — 50 Phone Wallpapers + Icon Pack',
    description:
      '50 dark-mode phone wallpapers (4K, all aspect ratios) with a matching 200-icon custom icon pack for iOS and Android. One-tap Shortcuts profile for iPhone, plus a KWGT setup guide for Android.',
    priceCents: 900,
    category: 'Phone & Tech',
    tags: 'wallpapers,phone,icons,ios,android,dark-mode',
    art: 'wave',
    affiliate: 20,
  },
];

function grain(id: string): string {
  return `<filter id="${id}"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" result="n"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.06 0"/><feComposite operator="over" in2="SourceGraphic"/></filter>`;
}

function titleBand(title: string, sub: string): string {
  const safe = title.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const safeSub = sub.replace(/&/g, '&amp;');
  return `<rect x="0" y="820" width="800" height="180" fill="${PINE}"/>
    <text x="48" y="892" font-family="Georgia, serif" font-size="44" fill="${CREAM}">${safe}</text>
    <text x="48" y="936" font-family="Verdana, sans-serif" font-size="22" letter-spacing="3" fill="${FERN}">${safeSub}</text>`;
}

function coverSvg(p: SeedProduct): string {
  const g = grain('grain');
  const head = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000" viewBox="0 0 800 1000"><defs>${g}</defs>`;
  const tail = `<rect width="800" height="1000" filter="url(#grain)" opacity="0.5"/></svg>`;
  let body = '';
  switch (p.art) {
    case 'ridges':
      body = `<rect width="800" height="1000" fill="${PINE}"/>
        <circle cx="600" cy="240" r="110" fill="${AMBER}"/>
        <path d="M0 520 L160 340 L320 520 Z" fill="${MOSS}"/>
        <path d="M220 560 L400 360 L580 560 Z" fill="${FERN}" opacity="0.85"/>
        <path d="M480 600 L660 400 L800 560 L800 1000 L480 1000 Z" fill="${MOSS}"/>
        <path d="M0 640 L200 480 L420 660 L640 500 L800 620 L800 1000 L0 1000 Z" fill="${PINE}"/>
        <g fill="${PINE}">${[90, 210, 640, 730].map((x, i) => `<path d="M${x} ${700 + i * 12} l22 -64 l22 64 l-12 0 l0 26 l-20 0 l0 -26 Z"/>`).join('')}</g>`;
      break;
    case 'cards':
      body = `<rect width="800" height="1000" fill="${CREAM}"/>
        <g>${[0, 1, 2].map((r) => [0, 1].map((c) => {
          const x = 70 + c * 340; const y = 90 + r * 240;
          return `<rect x="${x}" y="${y}" width="300" height="200" rx="18" fill="#fff" stroke="${MOSS}" stroke-width="3"/>
            <rect x="${x + 24}" y="${y + 28}" width="120" height="18" rx="9" fill="${FERN}"/>
            <rect x="${x + 24}" y="${y + 60}" width="200" height="14" rx="7" fill="${PINE}" opacity="0.14"/>
            <rect x="${x + 24}" y="${y + 86}" width="160" height="14" rx="7" fill="${PINE}" opacity="0.14"/>
            <circle cx="${x + 256}" cy="${y + 150}" r="26" fill="${AMBER}"/>`;
        }).join('')).join('')}</g>`;
      break;
    case 'icons':
      body = `<rect width="800" height="1000" fill="${MOSS}"/>
        <g stroke="${CREAM}" stroke-width="10" fill="none" stroke-linecap="round">
        ${[
          '<circle cx="160" cy="180" r="56"/>',
          '<rect x="300" y="124" width="112" height="112" rx="24"/>',
          '<path d="M560 124 L640 236 L480 236 Z"/>',
          '<path d="M104 380 l56 -96 l56 96 l-32 0 l0 56 l-48 0 l0 -56 Z"/>',
          '<path d="M300 400 h112 M300 440 h80 M300 480 h112"/>',
          '<circle cx="600" cy="440" r="56"/><path d="M600 440 m-20 0 a20 20 0 1 0 40 0 a20 20 0 1 0 -40 0" fill="${CREAM}" stroke="none"/>',
          '<path d="M120 600 q40 -56 80 0 q40 56 80 0" />',
          '<rect x="320" y="580" width="72" height="96" rx="12"/><path d="M338 580 v-24 h36 v24"/>',
          '<path d="M520 580 h120 l-24 96 h-72 Z"/><circle cx="580" cy="560" r="14"/>',
        ].join('')}</g>`;
      break;
    case 'book':
      body = `<rect width="800" height="1000" fill="${BARK}"/>
        <rect x="180" y="120" width="440" height="640" rx="10" fill="${CREAM}"/>
        <rect x="180" y="120" width="36" height="640" fill="${MOSS}"/>
        <text x="400" y="420" text-anchor="middle" font-family="Georgia, serif" font-size="300" fill="${PINE}">S</text>
        <g fill="${PINE}">${[250, 330, 500, 580].map((x) => `<path d="M${x} 640 l20 -58 l20 58 l-11 0 l0 24 l-18 0 l0 -24 Z"/>`).join('')}</g>
        <rect x="240" y="700" width="320" height="12" rx="6" fill="${PINE}" opacity="0.25"/>`;
      break;
    case 'blobs':
      body = `<rect width="800" height="1000" fill="${MOSS}"/>
        <path d="M-40 200 Q200 80 420 220 T860 180 L860 -40 L-40 -40 Z" fill="${FERN}" opacity="0.8"/>
        <path d="M-40 480 Q180 360 400 480 T860 420 L860 1000 L-40 1000 Z" fill="${PINE}" opacity="0.9"/>
        <ellipse cx="200" cy="620" rx="150" ry="90" fill="${BARK}" opacity="0.55"/>
        <ellipse cx="580" cy="740" rx="180" ry="100" fill="${FERN}" opacity="0.5"/>
        <ellipse cx="380" cy="300" rx="120" ry="70" fill="${AMBER}" opacity="0.35"/>
        <g fill="${CREAM}" opacity="0.5">${Array.from({ length: 26 }, (_, i) => { const x = (i * 173) % 760 + 20; const y = (i * 269) % 780 + 60; return `<circle cx="${x}" cy="${y}" r="${3 + (i % 4)}"/>`; }).join('')}</g>`;
      break;
    case 'ui':
      body = `<rect width="800" height="1000" fill="${CREAM}"/>
        <rect x="90" y="90" width="620" height="660" rx="24" fill="#fff" stroke="${PINE}" stroke-width="4"/>
        <rect x="90" y="90" width="620" height="88" rx="24" fill="${PINE}"/>
        <circle cx="140" cy="134" r="12" fill="${AMBER}"/><circle cx="172" cy="134" r="12" fill="${FERN}"/><circle cx="204" cy="134" r="12" fill="${MOSS}"/>
        <rect x="130" y="230" width="240" height="220" rx="16" fill="${FERN}" opacity="0.5"/>
        <rect x="400" y="230" width="270" height="36" rx="18" fill="${PINE}"/>
        <rect x="400" y="286" width="200" height="24" rx="12" fill="${PINE}" opacity="0.18"/>
        <rect x="400" y="330" width="150" height="56" rx="28" fill="${AMBER}"/>
        <g>${[0, 1, 2].map((i) => `<rect x="${130 + i * 190}" y="500" width="160" height="180" rx="16" fill="#fff" stroke="${MOSS}" stroke-width="3"/><rect x="${146 + i * 190}" y="${520}" width="128" height="80" rx="10" fill="${MOSS}" opacity="0.35"/><rect x="${146 + i * 190}" y="620" width="90" height="16" rx="8" fill="${PINE}" opacity="0.25"/>`).join('')}</g>`;
      break;
    case 'chart':
      body = `<rect width="800" height="1000" fill="${PINE}"/>
        <g stroke="${MOSS}" stroke-width="2" opacity="0.6">${Array.from({ length: 9 }, (_, i) => `<line x1="60" y1="${140 + i * 80}" x2="740" y2="${140 + i * 80}"/>`).join('')}</g>
        <polyline points="80,640 180,560 260,600 360,440 440,480 540,320 640,360 720,220" fill="none" stroke="${AMBER}" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/>
        <g fill="${AMBER}">${[[80, 640], [260, 600], [440, 480], [640, 360], [720, 220]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="16"/>`).join('')}</g>
        <g fill="${FERN}" opacity="0.85">${[[140, 700], [320, 660], [500, 620], [680, 560]].map(([x, y], i) => `<rect x="${x}" y="${y}" width="46" height="${120 - i * 18}" rx="8"/>`).join('')}</g>
        <circle cx="640" cy="150" r="10" fill="${FERN}"><animate attributeName="opacity" values="1;0.2;1" dur="2s" repeatCount="indefinite"/></circle>
        <text x="660" y="162" font-family="Verdana, sans-serif" font-size="30" fill="${FERN}">LIVE</text>`;
      break;
    case 'chat':
      body = `<rect width="800" height="1000" fill="${PINE}"/>
        <g>
          <rect x="80" y="140" width="480" height="130" rx="30" fill="${MOSS}"/>
          <rect x="110" y="172" width="300" height="20" rx="10" fill="${CREAM}" opacity="0.85"/>
          <rect x="110" y="208" width="220" height="20" rx="10" fill="${CREAM}" opacity="0.5"/>
          <rect x="240" y="320" width="480" height="130" rx="30" fill="${AMBER}"/>
          <rect x="270" y="352" width="320" height="20" rx="10" fill="${PINE}" opacity="0.8"/>
          <rect x="270" y="388" width="240" height="20" rx="10" fill="${PINE}" opacity="0.5"/>
          <rect x="80" y="500" width="560" height="130" rx="30" fill="${MOSS}"/>
          <rect x="110" y="532" width="380" height="20" rx="10" fill="${CREAM}" opacity="0.85"/>
          <rect x="110" y="568" width="280" height="20" rx="10" fill="${CREAM}" opacity="0.5"/>
          <circle cx="400" cy="730" r="14" fill="${FERN}"/><circle cx="440" cy="730" r="14" fill="${FERN}" opacity="0.6"/><circle cx="480" cy="730" r="14" fill="${FERN}" opacity="0.3"/>
        </g>`;
      break;
    case 'play':
      body = `<rect width="800" height="1000" fill="${CREAM}"/>
        <circle cx="400" cy="400" r="170" fill="${PINE}"/>
        <path d="M360 300 L520 400 L360 500 Z" fill="${AMBER}"/>
        <g>${[0, 1, 2].map((i) => `<rect x="${90 + i * 220}" y="640" width="190" height="120" rx="16" fill="#fff" stroke="${MOSS}" stroke-width="3"/><rect x="${110 + i * 220}" y="664" width="110" height="16" rx="8" fill="${PINE}" opacity="0.25"/><rect x="${110 + i * 220}" y="694" width="80" height="16" rx="8" fill="${FERN}"/>`).join('')}</g>
        <text x="400" y="140" text-anchor="middle" font-family="Georgia, serif" font-size="64" fill="${PINE}">28 lessons</text>`;
      break;
    case 'terminal':
      body = `<rect width="800" height="1000" fill="${PINE}"/>
        <rect x="90" y="180" width="620" height="520" rx="20" fill="${BARK}"/>
        <rect x="90" y="180" width="620" height="64" rx="20" fill="#2A2119"/>
        <circle cx="140" cy="212" r="12" fill="${AMBER}"/><circle cx="176" cy="212" r="12" fill="${FERN}"/><circle cx="212" cy="212" r="12" fill="${MOSS}"/>
        <g font-family="monospace" font-size="30" fill="${FERN}">
          <text x="130" y="320">$ gatekeeper --serve</text>
          <text x="130" y="380" fill="${AMBER}">✓ channel linked</text>
          <text x="130" y="440" fill="${AMBER}">✓ payments armed</text>
          <text x="130" y="500">$ <rect x="162" y="478" width="22" height="34" fill="${AMBER}"/></text>
        </g>
        <g fill="${MOSS}" opacity="0.5">${[150, 300, 450, 600].map((x) => `<rect x="${x}" y="760" width="90" height="14" rx="7"/>`).join('')}</g>`;
      break;
    case 'wave':
      body = `<rect width="800" height="1000" fill="${BARK}"/>
        <g fill="${FERN}">${Array.from({ length: 28 }, (_, i) => {
          const h = 60 + Math.abs(Math.sin(i * 0.7)) * 320;
          const x = 60 + i * 25;
          return `<rect x="${x}" y="${500 - h / 2}" width="14" height="${h}" rx="7" opacity="${0.45 + (i % 3) * 0.2}"/>`;
        }).join('')}</g>
        <circle cx="400" cy="180" r="70" fill="${AMBER}"/>
        <path d="M375 150 L435 180 L375 210 Z" fill="${PINE}"/>
        <g fill="${CREAM}" opacity="0.4">${[120, 680].map((x) => `<rect x="${x}" y="880" width="120" height="12" rx="6"/>`).join('')}</g>`;
      break;
  }
  const titles: Record<string, [string, string]> = {
    'alpha-pine-signals': ['ALPHA PINE', '30-DAY CRYPTO SIGNALS'],
    'prompt-grove': ['PROMPT GROVE', '500 AI PROMPTS'],
    'slow-web-ebook': ['THE SLOW WEB', 'AN EBOOK · 148 PAGES'],
    'ship-it-course': ['SHIP IT', 'VIDEO COURSE · 28 LESSONS'],
    'notion-creator-os': ['STUDIO', 'NOTION CREATOR OS'],
    'evergreen-presets': ['EVERGREEN', '24 LIGHTROOM PRESETS'],
    'gatekeeper-bot': ['GATEKEEPER', 'PAID CHANNEL BOT'],
    'the-grove-membership': ['THE GROVE', 'PRIVATE COMMUNITY'],
    'moss-tapes-loops': ['MOSS TAPES', '120 LO-FI LOOPS'],
    'pinecone-icons': ['PINECONE', '480 LINE ICONS'],
    'cryptid-sticker-pack': ['CRYPTID', '60 DIE-CUT STICKERS'],
    'moss-tee-graphics': ['FOREST PUNK', '40 TEE GRAPHICS'],
    'ember-wall-art': ['EMBER HOUR', '25 WALL ART PRINTS'],
    'night-market-wallpapers': ['NIGHT MARKET', 'WALLPAPERS + ICONS'],
  };
  const [t, s] = titles[p.slug];
  return `${head}${body}${titleBand(t, s)}${tail}`;
}

export function seedIfEmpty(db: Database.Database): void {
  const row = db.prepare('SELECT COUNT(*) AS c FROM users').get() as { c: number };
  if (row.c > 0) return;

  // Validate the product list against the canonical categories.
  for (const p of PRODUCTS) {
    if (!(CATEGORIES as readonly string[]).includes(p.category)) {
      throw new Error(`seed product ${p.slug} has unknown category ${p.category}`);
    }
  }

  const now = new Date().toISOString();
  const sellerId = randomId();
  const buyerId = randomId();
  const storeId = randomId();

  // Demo seller (Telegram-verified, gmail address per v3 auth rules)
  db.prepare(
    `INSERT INTO users (id, email, password_hash, name, telegram_verified, telegram_username, created_at)
     VALUES (?, ?, ?, ?, 1, ?, ?)`
  ).run(sellerId, 'june.fernfield@gmail.com', hashPassword('DemoPass123!'), 'June Park', 'fernandfield', now);

  // Demo buyer (also an affiliate, verified)
  const affiliateId = randomId();
  db.prepare(
    `INSERT INTO users (id, email, password_hash, name, telegram_verified, created_at)
     VALUES (?, ?, ?, ?, 1, ?)`
  ).run(buyerId, 'buyer.demo@gmail.com', hashPassword('DemoPass123!'), 'Demo Buyer', now);
  db.prepare(
    `INSERT INTO affiliates (id, user_id, code, created_at) VALUES (?, ?, ?, ?)`
  ).run(affiliateId, buyerId, 'GROVE7Q2A', now);

  db.prepare(
    `INSERT INTO stores (id, user_id, name, slug, bio, payout_usdt_address, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    storeId,
    sellerId,
    'Fern & Field',
    'fern-and-field',
    'Digital goods from a small studio in the Pacific Northwest. Presets, templates and textures made slowly, by hand, in the woods.',
    'TXYZdemo000000000000000000000000000',
    now
  );

  // Cover art → public/covers/*.svg (committed to the repo; the write below is a
  // no-op on read-only filesystems like Vercel where the files already exist).
  const coversDir = join(process.cwd(), 'public', 'covers');
  try {
    mkdirSync(coversDir, { recursive: true });
  } catch {
    /* read-only FS — covers are served from the committed files */
  }
  // Demo files live in the local file archive (LOCAL_STORAGE_DIR-aware).
  const storageDir = localDir();
  mkdirSync(storageDir, { recursive: true });

  const insertProduct = db.prepare(
    `INSERT INTO products (id, store_id, title, slug, description, price_usd, category, tags, cover_url, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', ?)`
  );
  const insertFile = db.prepare(
    `INSERT INTO product_files (id, product_id, filename, mime, size, provider, local_path, created_at)
     VALUES (?, ?, ?, ?, ?, 'local', ?, ?)`
  );
  const insertAffiliateSetting = db.prepare(
    `INSERT INTO product_affiliates (product_id, enabled, commission_percent, updated_at)
     VALUES (?, 1, ?, ?)`
  );

  const created: { id: string; slug: string; title: string; priceCents: number; commission?: number }[] = [];
  PRODUCTS.forEach((p, i) => {
    const id = randomId();
    const coverFile = `${p.slug}.svg`;
    try {
      writeFileSync(join(coversDir, coverFile), coverSvg(p), 'utf8');
    } catch {
      /* read-only FS (Vercel) — cover is served from the committed public/covers file */
    }
    const createdAt = new Date(Date.now() - (PRODUCTS.length - i) * 86400000 * 2).toISOString();
    insertProduct.run(id, storeId, p.title, p.slug, p.description, p.priceCents, p.category, p.tags, `/covers/${coverFile}`, createdAt);
    created.push({ id, slug: p.slug, title: p.title, priceCents: p.priceCents, commission: p.affiliate });
    if (p.affiliate) insertAffiliateSetting.run(id, p.affiliate, now);

    // Demo downloadable file per product
    const fname = `${p.slug}-readme.txt`;
    const content = `Thanks for purchasing "${p.title}" from Fern & Field on Digitalsale!\n\nThis is a demo file standing in for the real product download.\nIn production, sellers upload their real files and Digitalsale archives them\nto the Telegram storage channel (or local disk in dev).\n\nOrder support: hello@digitalsale.example\n`;
    // Bare filename contract: the download route resolves via localDir().
    writeFileSync(join(storageDir, fname), content, 'utf8');
    insertFile.run(randomId(), id, fname, 'text/plain', Buffer.byteLength(content), fname, now);
  });

  // Demo orders at the 10% platform fee, one with affiliate attribution.
  const insertOrder = db.prepare(
    `INSERT INTO orders (id, product_id, buyer_id, buyer_email, amount_usd, fee_usd, seller_usd, affiliate_code, affiliate_usd, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'paid', ?)`
  );
  const mkOrder = (
    productId: string,
    price: number,
    email: string,
    bid: string | null,
    daysAgo: number,
    affCode: string | null = null
  ) => {
    const fee = Math.round((price * 10) / 100);
    let affiliateUsd = 0;
    if (affCode) {
      const setting = created.find((c) => c.id === productId);
      const pct = setting?.commission ?? DEFAULT_COMMISSION;
      affiliateUsd = Math.round((price * pct) / 100);
    }
    insertOrder.run(
      randomId(),
      productId,
      bid,
      email,
      price,
      fee,
      price - fee - affiliateUsd,
      affCode,
      affiliateUsd,
      new Date(Date.now() - daysAgo * 86400000).toISOString()
    );
  };
  // Affiliate-attributed sale: demo buyer bought via their own ref link.
  mkOrder(created[5].id, created[5].priceCents, 'buyer.demo@gmail.com', buyerId, 1, 'GROVE7Q2A');
  mkOrder(created[1].id, created[1].priceCents, 'moss.collector@example.com', null, 3);
  mkOrder(created[4].id, created[4].priceCents, 'trailhead.studio@example.com', null, 5);
  mkOrder(created[9].id, created[9].priceCents, 'fern.fan@example.com', null, 8);
  mkOrder(created[2].id, created[2].priceCents, 'buyer.demo@gmail.com', buyerId, 12);
  // A couple of affiliate clicks so the affiliate dashboard has real numbers.
  const insertClick = db.prepare(
    `INSERT INTO affiliate_clicks (id, code, product_id, ip_hash, created_at)
     VALUES (?, ?, ?, ?, ?)`
  );
  insertClick.run(randomId(), 'GROVE7Q2A', created[5].id, 'seed-hash-1', new Date(Date.now() - 86400000).toISOString());
  insertClick.run(randomId(), 'GROVE7Q2A', created[9].id, 'seed-hash-2', new Date(Date.now() - 2 * 86400000).toISOString());
}

export { slugify };

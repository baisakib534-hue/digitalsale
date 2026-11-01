import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { Space_Grotesk, Space_Mono } from 'next/font/google';
import TelegramInit from '../components/TelegramInit';
import ThemeProvider from '../components/ThemeProvider';
import SiteHeader, { BrandMark } from '../components/SiteHeader';
import SoundProvider from '../components/SoundProvider';
import SoundToggle from '../components/SoundToggle';
import { BRAND } from '../lib/brand';
import './globals.css';

const display = Space_Grotesk({
  subsets: ['latin'],
  weight: ['500', '700'],
  variable: '--font-display',
  display: 'swap',
});

const ui = Space_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-ui',
  display: 'swap',
});

const mono = Space_Mono({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: `${BRAND.name} — ${BRAND.tagline}`,
    template: `%s · ${BRAND.name}`,
  },
  description: BRAND.description,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // v12: white-label storefronts (/s/[token]) render chromeless — no header,
  // no footer, no Digitalsale branding. The seller's mini app shows only them.
  let whitelabel = false;
  try {
    whitelabel = (headers().get('x-pathname') || '').startsWith('/s/');
  } catch {
    whitelabel = false;
  }
  return (
    <html lang="en" className={`${display.variable} ${ui.variable} ${mono.variable}`}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#FBFAF7" />
        <script src="https://telegram.org/js/telegram-web-app.js" defer />
        {/* Anti-FOUC: set the theme before first paint. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=null;try{s=localStorage.getItem('digitalsale-theme')}catch(e){}var d=s==='dark'||(!s&&window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light';}catch(e){document.documentElement.dataset.theme='light';}})();`,
          }}
        />
      </head>
      <body className={whitelabel ? 'whitelabel' : ''}>
        <TelegramInit />
        <ThemeProvider />
        <SoundProvider />
        {!whitelabel && <SiteHeader />}
        <main>{children}</main>
        {!whitelabel && (
        <footer className="site-footer">
          <div className="wrap">
            <div className="cols">
              <div>
                <span className="brand">
                  <BrandMark />
                  {BRAND.name}
                </span>
                <p style={{ fontSize: 14.5, maxWidth: 300 }}>
                  {BRAND.description}
                </p>
                <div style={{ marginTop: 20 }}>
                  <SoundToggle />
                </div>
              </div>
              <div>
                <h4>Marketplace</h4>
                <a href="/market">Browse all</a>
                <a href="/market?category=Presets">Presets</a>
                <a href="/market?category=Templates">Templates</a>
                <a href="/affiliates">Affiliates</a>
              </div>
              <div>
                <h4>Sellers</h4>
                <a href="/auth?mode=signup">Start selling</a>
                <a href="/dashboard">Seller dashboard</a>
                <a href="/fees">Fees & payouts</a>
              </div>
              <div>
                <h4>Project</h4>
                <a href="/how-it-works">How it works</a>
                <a href="/terms">Terms of Service</a>
                <a href={`mailto:${BRAND.supportEmail}`}>Contact</a>
                <a href="/market?sort=newest">New arrivals</a>
              </div>
            </div>
            <div className="fine">
              <span>© 2026 {BRAND.name}. A borderless market for digital work.</span>
              <span>{BRAND.feePercent}% flat fee · Payouts in {BRAND.payoutAsset}</span>
            </div>
          </div>
        </footer>
        )}
      </body>
    </html>
  );
}

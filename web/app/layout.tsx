import type { Metadata } from 'next';
import { Instrument_Serif, Space_Grotesk, Space_Mono } from 'next/font/google';
import TelegramInit from '../components/TelegramInit';
import SiteHeader, { BrandMark } from '../components/SiteHeader';
import SoundProvider from '../components/SoundProvider';
import SoundToggle from '../components/SoundToggle';
import { BRAND } from '../lib/brand';
import './globals.css';

const display = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  style: ['normal', 'italic'],
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
  return (
    <html lang="en" className={`${display.variable} ${ui.variable} ${mono.variable}`}>
      <head>
        <script src="https://telegram.org/js/telegram-web-app.js" defer />
      </head>
      <body>
        <TelegramInit />
        <SoundProvider />
        <SiteHeader />
        <main>{children}</main>
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
      </body>
    </html>
  );
}

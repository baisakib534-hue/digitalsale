import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SellBridge — Sell digital products from any country',
  description:
    'The borderless creator marketplace. No country bans. Get paid in USDT. 5% fee.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

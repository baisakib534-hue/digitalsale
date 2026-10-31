'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/** Slim search bar for the Etsy-like landing hero → /market?q=… */
export default function LandingSearch() {
  const router = useRouter();
  const [q, setQ] = useState('');

  return (
    <form
      className="landing-search"
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        router.push(`/market${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`);
      }}
    >
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search ebooks, presets, prompts, templates…"
        aria-label="Search the market"
      />
      <button type="submit" className="btn btn-dark">
        Search
      </button>
    </form>
  );
}

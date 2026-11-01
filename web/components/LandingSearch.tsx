'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Unified search bar (Etsy/Gumroad pattern): one pill with a magnifier icon,
 * the input, a clear button, and an inline submit — single row on all screens.
 */
export default function LandingSearch() {
  const router = useRouter();
  const [q, setQ] = useState('');

  function go() {
    router.push(`/market${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`);
  }

  return (
    <form
      className="searchbar"
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        go();
      }}
    >
      <svg
        className="searchbar-icon"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="7" />
        <line x1="21" y1="21" x2="16.5" y2="16.5" />
      </svg>
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search ebooks, presets, prompts, templates…"
        aria-label="Search the market"
        className="searchbar-input"
      />
      {q && (
        <button
          type="button"
          className="searchbar-clear"
          aria-label="Clear search"
          onClick={() => setQ('')}
        >
          ×
        </button>
      )}
      <button type="submit" className="btn btn-dark btn-sm searchbar-go">
        Search
      </button>
    </form>
  );
}

'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { CATEGORIES } from '../lib/categories';

function buildHref(sp: URLSearchParams, patch: Record<string, string | undefined>): string {
  const next = new URLSearchParams(sp);
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined || v === '') next.delete(k);
    else next.set(k, v);
  }
  const qs = next.toString();
  return qs ? `/market?${qs}` : '/market';
}

/** Market toolbar: search form (GET-style), category chips, auto-submit sort select. */
export default function MarketToolbar() {
  const router = useRouter();
  const sp = useSearchParams();
  const q = sp.get('q') ?? '';
  const category = sp.get('category') ?? '';
  const sort = sp.get('sort') ?? 'newest';
  const [draft, setDraft] = useState(q);

  function go(patch: Record<string, string | undefined>) {
    router.push(buildHref(sp, patch));
  }

  return (
    <div>
      <div className="toolbar">
        <form
          className="searchbox"
          onSubmit={(e) => {
            e.preventDefault();
            go({ q: draft.trim() || undefined });
          }}
          role="search"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.8-3.8" />
          </svg>
          <input
            className="input"
            type="search"
            name="q"
            placeholder="Search presets, templates, icons…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            aria-label="Search products"
          />
        </form>
        <select
          className="select"
          value={sort}
          onChange={(e) => go({ sort: e.target.value })}
          aria-label="Sort products"
        >
          <option value="newest">Newest first</option>
          <option value="price-asc">Price: low to high</option>
          <option value="price-desc">Price: high to low</option>
        </select>
      </div>
      <div className="cat-row" role="group" aria-label="Filter by category">
        <Link
          href={buildHref(sp, { category: undefined })}
          className={`chip clickable${category === '' ? ' on' : ''}`}
        >
          All
        </Link>
        {CATEGORIES.map((c) => (
          <Link
            key={c}
            href={buildHref(sp, { category: c })}
            className={`chip clickable${category === c ? ' on' : ''}`}
          >
            {c}
          </Link>
        ))}
      </div>
    </div>
  );
}

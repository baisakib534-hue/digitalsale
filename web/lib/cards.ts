import { cookies } from 'next/headers';
import type Database from 'better-sqlite3';
import { getSessionUserId } from './auth';
import { productRatings } from './reviews';
import { wishlistFor } from './wishlist';
import type { CardProduct } from '../components/ProductCard';

/** Current user id from the request cookies (server components). */
export function currentUserIdFromCookies(): string | null {
  const header = cookies().toString();
  return getSessionUserId(new Request('http://internal/', { headers: { cookie: header } }));
}

/** Attach ratings + wishlist state to product cards. */
export function enrichCards(db: Database.Database, cards: CardProduct[]): CardProduct[] {
  if (cards.length === 0) return cards;
  const ids = cards.map((c) => c.id);
  const ratings = productRatings(db, ids);
  let wished = new Set<string>();
  try {
    const uid = currentUserIdFromCookies();
    if (uid) wished = wishlistFor(db, uid, ids);
  } catch {
    /* cookies unavailable — skip wishlist state */
  }
  return cards.map((c) => ({
    ...c,
    rating_avg: ratings.get(c.id)?.avg ?? null,
    rating_count: ratings.get(c.id)?.count ?? 0,
    wishlisted: wished.has(c.id),
  }));
}

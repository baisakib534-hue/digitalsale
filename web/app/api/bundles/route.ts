import { getDb } from '@/lib/db';
import { getSessionUserId } from '@/lib/auth';
import { requireVerified } from '@/lib/verify';
import { createBundle, getSellerBundles, getBundle } from '@/lib/bundles';
import { NextResponse } from 'next/server';

interface BundleRow {
  id: string;
  seller_id: string;
  name: string;
  description: string;
  price_cents: number;
  cover_image: string | null;
  status: 'live' | 'ended';
  created_at: string;
  updated_at: string;
  store_id: string;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const mine = searchParams.get('mine') === '1';

    const db = getDb();

    if (mine) {
      const uid = getSessionUserId(request);
      if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

      const bundleRows = db
        .prepare(
          `SELECT b.*, s.id as store_id
           FROM bundles b
           JOIN stores s ON s.id = b.seller_id
           WHERE s.user_id = ?
           ORDER BY b.created_at DESC`
        )
        .all(uid) as BundleRow[];

      // Fetch items for each bundle
      const result = [];
      for (const b of bundleRows) {
        const items = db
          .prepare('SELECT bundle_id, product_id FROM bundle_items WHERE bundle_id = ?')
          .all(b.id) as { bundle_id: string; product_id: string }[];
        result.push({ ...b, items });
      }

      return NextResponse.json({ bundles: result });
    }

    // Public listing: only live bundles from non-banned sellers
    const bundleRows = db
      .prepare(
        `SELECT b.*, s.id as store_id
         FROM bundles b
         JOIN stores s ON s.id = b.seller_id
         WHERE b.status = 'live' AND s.status != 'suspended'
         ORDER BY b.created_at DESC`
      )
      .all() as BundleRow[];

    // Fetch items for each bundle
    const result = [];
    for (const b of bundleRows) {
      const items = db
        .prepare('SELECT bundle_id, product_id FROM bundle_items WHERE bundle_id = ?')
        .all(b.id) as { bundle_id: string; product_id: string }[];
      result.push({ ...b, items });
    }

    return NextResponse.json({ bundles: result });
  } catch (error) {
    console.error('GET /api/bundles error:', error);
    return NextResponse.json({ error: 'Failed to fetch bundles' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const db = getDb();
    const verified = requireVerified(db, request);
    if (verified instanceof NextResponse) return verified;

    const store = db
      .prepare('SELECT id FROM stores WHERE user_id = ?')
      .get(verified.uid) as { id: string } | undefined;

    if (!store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    const body = await request.json();
    const { name, description, price_cents, product_ids, cover_image } = body;

    if (!name || !price_cents || !product_ids || !Array.isArray(product_ids)) {
      return NextResponse.json(
        { error: 'Missing required fields: name, price_cents, product_ids' },
        { status: 400 }
      );
    }

    if (price_cents < 1) {
      return NextResponse.json({ error: 'Price must be at least 1 cent' }, { status: 400 });
    }

    const bundle = createBundle(db, store.id, name, description || '', price_cents, product_ids, cover_image || null);

    return NextResponse.json({ bundle }, { status: 201 });
  } catch (error) {
    console.error('POST /api/bundles error:', error);
    const message = error instanceof Error ? error.message : 'Failed to create bundle';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
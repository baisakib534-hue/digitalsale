import { getDb } from '@/lib/db';
import { getSessionUserId } from '@/lib/auth';
import { requireVerified } from '@/lib/verify';
import { getBundle, endBundle } from '@/lib/bundles';
import { NextResponse } from 'next/server';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const db = getDb();

    const bundle = getBundle(db, id);
    if (!bundle) {
      return NextResponse.json({ error: 'Bundle not found' }, { status: 404 });
    }

    // For live bundles, check seller status
    if (bundle.status === 'live') {
      const store = db
        .prepare('SELECT status FROM stores WHERE id = ?')
        .get(bundle.seller_id) as { status: string } | undefined;
      if (store?.status === 'suspended') {
        return NextResponse.json({ error: 'Bundle not found' }, { status: 404 });
      }
    }

    // Fetch product details for each item
    const products = [];
    for (const item of bundle.items) {
      const product = db
        .prepare(
          `SELECT id, name, price_usd, cover_image, status FROM products WHERE id = ?`
        )
        .get(item.product_id) as { id: string; name: string; price_usd: number; cover_image: string | null; status: string } | undefined;
      if (product) {
        products.push(product);
      }
    }

    return NextResponse.json({ bundle: { ...bundle, products } });
  } catch (error) {
    console.error('GET /api/bundles/[id] error:', error);
    return NextResponse.json({ error: 'Failed to fetch bundle' }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const db = getDb();
    const verified = requireVerified(db, request);
    if (verified instanceof NextResponse) return verified;

    const store = db
      .prepare('SELECT id FROM stores WHERE user_id = ?')
      .get(verified.uid) as { id: string } | undefined;

    if (!store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    const bundle = getBundle(db, id);
    if (!bundle) {
      return NextResponse.json({ error: 'Bundle not found' }, { status: 404 });
    }

    if (bundle.seller_id !== store.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { name, description, cover_image, status } = body;

    const updates: string[] = [];
    const values: (string | number)[] = [];

    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      values.push(description);
    }
    if (cover_image !== undefined) {
      updates.push('cover_image = ?');
      values.push(cover_image);
    }
    if (status !== undefined) {
      if (status !== 'live' && status !== 'ended') {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
      }
      updates.push('status = ?');
      values.push(status);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    updates.push('updated_at = ?');
    values.push(new Date().toISOString().slice(0, 19).replace('T', ' '));
    values.push(id);

    db.prepare(`UPDATE bundles SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    const updated = getBundle(db, id);
    return NextResponse.json({ bundle: updated });
  } catch (error) {
    console.error('PUT /api/bundles/[id] error:', error);
    return NextResponse.json({ error: 'Failed to update bundle' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const db = getDb();
    const verified = requireVerified(db, request);
    if (verified instanceof NextResponse) return verified;

    const store = db
      .prepare('SELECT id FROM stores WHERE user_id = ?')
      .get(verified.uid) as { id: string } | undefined;

    if (!store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    const bundle = getBundle(db, id);
    if (!bundle) {
      return NextResponse.json({ error: 'Bundle not found' }, { status: 404 });
    }

    if (bundle.seller_id !== store.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Soft delete - mark as ended
    const ended = endBundle(db, id, store.id);
    if (!ended) {
      return NextResponse.json({ error: 'Failed to end bundle' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/bundles/[id] error:', error);
    return NextResponse.json({ error: 'Failed to delete bundle' }, { status: 500 });
  }
}
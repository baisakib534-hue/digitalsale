'use client';

import { useState } from 'react';
import { youTubeEmbedUrl, parseYouTubeId } from '../lib/video';

export interface GalleryImage {
  id: string;
  filename: string;
}

interface Props {
  title: string;
  videoUrl: string | null;
  images: GalleryImage[];
  coverUrl: string | null;
}

type Active = { kind: 'video'; embed: string } | { kind: 'image'; id: string; filename: string };

/**
 * Product media viewer (v6): YouTube demo video first (fullscreen-capable
 * embed), then seller-uploaded gallery pictures, then the cover art.
 * Thumbnails switch the main viewer; the video keeps native fullscreen.
 */
export default function ProductMedia({ title, videoUrl, images, coverUrl }: Props) {
  const vid = parseYouTubeId(videoUrl);
  const [active, setActive] = useState<Active | null>(null);

  const current: Active | null =
    active ??
    (vid
      ? { kind: 'video', embed: youTubeEmbedUrl(vid) }
      : images.length > 0
        ? { kind: 'image', id: images[0].id, filename: images[0].filename }
        : null);

  const thumbs: Active[] = [
    ...(vid ? [{ kind: 'video' as const, embed: youTubeEmbedUrl(vid) }] : []),
    ...images.map((im) => ({ kind: 'image' as const, id: im.id, filename: im.filename })),
  ];

  return (
    <div style={{ marginBottom: 32 }}>
      <div
        className="media-stage"
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '16 / 10',
          borderRadius: 18,
          overflow: 'hidden',
          background: 'var(--card, #fff)',
          border: '1px solid var(--line, #e5ddc8)',
        }}
      >
        {current?.kind === 'video' ? (
          <iframe
            key={current.embed}
            src={current.embed}
            title={`${title} — demo video`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
          />
        ) : current?.kind === 'image' ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={current.id}
            src={`/api/images/${current.id}`}
            alt={current.filename || title}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverUrl}
            alt={title}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--muted)',
            }}
          >
            No media yet
          </div>
        )}
      </div>

      {thumbs.length > 1 && (
        <div
          style={{
            display: 'flex',
            gap: 10,
            marginTop: 12,
            overflowX: 'auto',
            paddingBottom: 4,
          }}
          role="tablist"
          aria-label="Product media"
        >
          {thumbs.map((t, i) => {
            const isActive =
              current?.kind === t.kind &&
              (t.kind === 'video' || (current as { id: string }).id === t.id);
            return (
              <button
                key={t.kind === 'video' ? 'video' : t.id}
                role="tab"
                aria-selected={isActive}
                aria-label={t.kind === 'video' ? 'Demo video' : `Picture ${i}`}
                onClick={() => setActive(t)}
                style={{
                  position: 'relative',
                  flex: '0 0 auto',
                  width: 96,
                  height: 60,
                  borderRadius: 10,
                  overflow: 'hidden',
                  border: isActive ? '2px solid var(--ember, #D9481C)' : '1px solid var(--line, #e5ddc8)',
                  background: 'var(--card, #fff)',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                {t.kind === 'video' ? (
                  <span
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '100%',
                      height: '100%',
                      background: '#122019',
                      color: '#F5EFE0',
                      fontSize: 22,
                    }}
                    aria-hidden
                  >
                    ▶
                  </span>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/api/images/${t.id}`}
                    alt=""
                    loading="lazy"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

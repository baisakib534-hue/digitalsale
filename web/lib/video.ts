/**
 * YouTube URL handling for product demo videos (v6).
 * Sellers paste any YouTube URL; the product page embeds it via the
 * privacy-friendly youtube-nocookie player with fullscreen enabled.
 */

const ID_RE = /^[A-Za-z0-9_-]{11}$/;

/**
 * Extract the 11-char video ID from a YouTube URL.
 * Accepts: youtube.com/watch?v=, youtu.be/, youtube.com/embed/,
 * youtube.com/shorts/, youtube.com/live/, music.youtube.com/watch.
 * Returns null for anything else (including non-YouTube URLs).
 */
export function parseYouTubeId(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const raw = input.trim();
  if (!raw) return null;
  // Bare 11-char ID is also accepted.
  if (ID_RE.test(raw)) return raw;
  let url: URL;
  try {
    url = new URL(raw.startsWith('http') ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase().replace(/^www\./, '').replace(/^m\./, '');
  const validHosts = new Set([
    'youtube.com',
    'youtu.be',
    'youtube-nocookie.com',
    'music.youtube.com',
  ]);
  if (!validHosts.has(host)) return null;
  if (host === 'youtu.be') {
    const id = url.pathname.slice(1).split(/[?#/]/)[0];
    return ID_RE.test(id) ? id : null;
  }
  const path = url.pathname;
  const watchId = url.searchParams.get('v');
  if (path === '/watch' && watchId && ID_RE.test(watchId)) return watchId;
  for (const prefix of ['/embed/', '/shorts/', '/live/', '/v/']) {
    if (path.startsWith(prefix)) {
      const id = path.slice(prefix.length).split(/[?#/]/)[0];
      if (ID_RE.test(id)) return id;
    }
  }
  return null;
}

/** Canonical watch URL stored in the DB. */
export function youTubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

/** Embed URL used by the product page player (fullscreen enabled). */
export function youTubeEmbedUrl(videoId: string): string {
  return `https://www.youtube-nocookie.com/embed/${videoId}?rel=0`;
}

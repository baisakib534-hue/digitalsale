import { base64urlDecode, base64urlEncode, hmacSha256Hex } from './crypto';

export const SESSION_COOKIE = 'mosshaw_session';

/**
 * DEV FALLBACK — clearly marked. Set SESSION_SECRET in production;
 * without it, sessions are only as secret as this placeholder.
 */
function sessionSecret(): string {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 16) return s;
  return 'dev-only-session-secret-CHANGE-ME';
}

export interface SessionPayload {
  uid: string;
  exp: number;
}

export function createSessionToken(userId: string, ttlSeconds = 60 * 60 * 24 * 30): string {
  const payload: SessionPayload = {
    uid: userId,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const body = base64urlEncode(JSON.stringify(payload));
  const sig = hmacSha256Hex(sessionSecret(), body);
  return `${body}.${sig}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  const expected = hmacSha256Hex(sessionSecret(), body);
  if (sig.length !== expected.length) return null;
  // constant-time-ish compare without importing timingSafeEqual for strings
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  if (diff !== 0) return null;
  try {
    const payload = JSON.parse(base64urlDecode(body).toString('utf8')) as SessionPayload;
    if (typeof payload.uid !== 'string' || typeof payload.exp !== 'number') return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function sessionCookieHeader(token: string, maxAgeSeconds = 60 * 60 * 24 * 30): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secure}`;
}

export function clearSessionCookieHeader(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

/** Parse a Cookie header value into a record (Next-free, testable). */
export function parseCookies(header: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(val);
  }
  return out;
}

/** Extract the logged-in user id from a Request's Cookie header. */
export function getSessionUserId(req: Request): string | null {
  const cookies = parseCookies(req.headers.get('cookie'));
  const token = cookies[SESSION_COOKIE];
  if (!token) return null;
  const payload = verifySessionToken(token);
  return payload ? payload.uid : null;
}

/** Download tokens: HMAC-signed, expiring. Payload: {o: orderId, f: fileId, exp}. */
export function createDownloadToken(orderId: string, fileId: string, ttlSeconds = 60 * 60 * 24): string {
  const payload = { o: orderId, f: fileId, exp: Math.floor(Date.now() / 1000) + ttlSeconds };
  const body = base64urlEncode(JSON.stringify(payload));
  const sig = hmacSha256Hex(sessionSecret(), `dl:${body}`);
  return `${body}.${sig}`;
}

export function verifyDownloadToken(token: string): { orderId: string; fileId: string } | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  const expected = hmacSha256Hex(sessionSecret(), `dl:${body}`);
  if (sig.length !== expected.length) return null;
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  if (diff !== 0) return null;
  try {
    const payload = JSON.parse(base64urlDecode(body).toString('utf8')) as { o: string; f: string; exp: number };
    if (typeof payload.o !== 'string' || typeof payload.f !== 'string' || typeof payload.exp !== 'number') return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return { orderId: payload.o, fileId: payload.f };
  } catch {
    return null;
  }
}

import Link from 'next/link';
import { parseSocials, socialUrl, type StoreSocials } from '../lib/stores';

/** Social links row for white-label + public store pages. */
export function SocialRow({ socials, dark = false }: { socials: StoreSocials; dark?: boolean }) {
  const entries = (Object.keys(socials) as (keyof StoreSocials)[]).filter((k) => socials[k]);
  if (entries.length === 0) return null;
  const labels: Record<keyof StoreSocials, string> = {
    website: 'Website',
    x: 'X',
    instagram: 'Instagram',
    youtube: 'YouTube',
    telegram: 'Telegram',
  };
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {entries.map((k) => (
        <a
          key={k}
          href={socialUrl(k, socials[k]!)}
          target="_blank"
          rel="noopener noreferrer"
          className="chip clickable"
          style={dark ? { borderColor: 'rgba(255,255,255,0.35)', color: '#fff', background: 'rgba(0,0,0,0.35)' } : undefined}
        >
          {labels[k]}
        </a>
      ))}
    </div>
  );
}

/** Parse stored socials JSON for a store row. */
export function storeSocials(raw: string | null): StoreSocials {
  return parseSocials(raw);
}

export function WhitelabelBack({ token, label = '← All products' }: { token: string; label?: string }) {
  return (
    <Link
      href={`/s/${token}`}
      style={{ display: 'inline-block', marginBottom: 20, fontSize: 14, fontWeight: 600 }}
    >
      {label}
    </Link>
  );
}

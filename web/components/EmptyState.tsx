import Link from 'next/link';
import type { ReactNode, MouseEventHandler } from 'react';

export default function EmptyState({
  glyph,
  title,
  body,
  action,
}: {
  glyph: ReactNode;
  title: string;
  body: string;
  action?: { href: string; label: string } | { onClick: MouseEventHandler<HTMLButtonElement>; label: string };
}) {
  return (
    <div className="empty">
      <div className="glyph">{glyph}</div>
      <h3>{title}</h3>
      <p>{body}</p>
      {action && 'href' in action && (
        <Link href={action.href} className="btn btn-dark">
          {action.label}
        </Link>
      )}
      {action && 'onClick' in action && (
        <button className="btn btn-dark" onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  );
}

export function BasketGlyph() {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M5 8h14l-1.2 12.1a1 1 0 0 1-1 .9H7.2a1 1 0 0 1-1-.9L5 8Z" />
      <path d="M8.5 8V6.5a3.5 3.5 0 0 1 7 0V8" />
    </svg>
  );
}

export function SproutGlyph() {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M12 21v-8" />
      <path d="M12 13c0-4 3-7 8-7 0 4-3 7-8 7Z" />
      <path d="M12 13c0-4-3-7-8-7 0 4 3 7 8 7Z" />
    </svg>
  );
}

export function SearchGlyph() {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.8-3.8" />
    </svg>
  );
}

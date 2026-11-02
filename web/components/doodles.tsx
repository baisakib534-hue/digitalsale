'use client';

import { motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';

/* Hand-drawn SVG accents — the "a human made this" layer. */

export function Stamp({
  children,
  tone = 'paper',
  rotate = true,
}: {
  children: ReactNode;
  tone?: 'paper' | 'ember' | 'moss';
  rotate?: boolean;
}) {
  const cls = `stamp${tone === 'ember' ? ' stamp-ember' : tone === 'moss' ? ' stamp-moss' : ''}${rotate ? '' : ' stamp-flat'}`;
  return <span className={cls}>{children}</span>;
}

/** Wobbly underline for headline words. Usage: <span className="squiggle-wrap">word<Squiggle/></span> */
export function Squiggle({ color = 'var(--ember)' }: { color?: string }) {
  const reduce = useReducedMotion();
  const path = (
    <path
      d="M4 14 C 30 6, 60 20, 96 10 S 160 18, 196 8"
      fill="none"
      stroke={color}
      strokeWidth="7"
      strokeLinecap="round"
    />
  );
  return (
    <svg className="squiggle" viewBox="0 0 200 22" preserveAspectRatio="none" aria-hidden>
      {reduce ? (
        path
      ) : (
        <motion.path
          d="M4 14 C 30 6, 60 20, 96 10 S 160 18, 196 8"
          fill="none"
          stroke={color}
          strokeWidth="7"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          whileInView={{ pathLength: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: 'easeOut', delay: 0.35 }}
        />
      )}
    </svg>
  );
}

/** Loopy arrow doodle pointing at a CTA. */
export function ArrowDoodle({ color = 'var(--ember)' }: { color?: string }) {
  const reduce = useReducedMotion();
  const d = 'M8 8 C 40 4, 70 14, 84 44 M84 44 l-14 -6 M84 44 l3 -15';
  return (
    <svg
      className="doodle"
      width="96"
      height="64"
      viewBox="0 0 96 64"
      fill="none"
      aria-hidden
      style={{ transform: 'rotate(8deg)' }}
    >
      {reduce ? (
        <path d={d} stroke={color} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <motion.path
          d={d}
          stroke={color}
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          whileInView={{ pathLength: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.5 }}
        />
      )}
    </svg>
  );
}

/** Starburst badge behind prices / callouts. */
export function Starburst({ size = 120, color = 'var(--ember)' }: { size?: number; color?: string }) {
  const points = Array.from({ length: 12 }, (_, i) => {
    const a = (i * Math.PI) / 6;
    const r1 = 48;
    const r2 = 34;
    const x1 = 50 + r1 * Math.cos(a);
    const y1 = 50 + r1 * Math.sin(a);
    const x2 = 50 + r2 * Math.cos(a + Math.PI / 12);
    const y2 = 50 + r2 * Math.sin(a + Math.PI / 12);
    return `${x1.toFixed(1)},${y1.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}`;
  }).join(' ');
  return (
    <svg className="doodle" width={size} height={size} viewBox="0 0 100 100" aria-hidden>
      <polygon points={points} fill={color} opacity="0.9" />
    </svg>
  );
}

/* ---------- small inline SVG icon set (no emoji) ---------- */

function base(props: { size?: number; children: ReactNode }) {
  return (
    <svg
      width={props.size ?? 22}
      height={props.size ?? 22}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {props.children}
    </svg>
  );
}

export const IconCheck = ({ size }: { size?: number }) =>
  base({ size, children: <path d="M4 12.5l5 5L20 6.5" /> });

export const IconShield = ({ size }: { size?: number }) =>
  base({
    size,
    children: (
      <>
        <path d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6z" />
        <path d="M9 12l2 2 4-4" />
      </>
    ),
  });

export const IconBolt = ({ size }: { size?: number }) =>
  base({ size, children: <path d="M13 2L4 14h6l-1 8 9-12h-6z" /> });

export const IconFlag = ({ size }: { size?: number }) =>
  base({
    size,
    children: (
      <>
        <path d="M5 21V4" />
        <path d="M5 4h13l-3 4 3 4H5" />
      </>
    ),
  });

export const IconSend = ({ size }: { size?: number }) =>
  base({
    size,
    children: (
      <>
        <path d="M21 3L10 14" />
        <path d="M21 3l-7 18-4-7-7-4z" />
      </>
    ),
  });

export const IconCoin = ({ size }: { size?: number }) =>
  base({
    size,
    children: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 7.5v9M9.5 9.5c0-1 1.2-1.8 2.5-1.8s2.5.8 2.5 1.8-1 1.6-2.5 2-2.5 1-2.5 2 1.2 1.8 2.5 1.8 2.5-.8 2.5-1.8" />
      </>
    ),
  });

export const IconBox = ({ size }: { size?: number }) =>
  base({
    size,
    children: (
      <>
        <path d="M3 8l9-5 9 5v8l-9 5-9-5z" />
        <path d="M3 8l9 5 9-5M12 13v8" />
      </>
    ),
  });

export const IconUsers = ({ size }: { size?: number }) =>
  base({
    size,
    children: (
      <>
        <circle cx="9" cy="8" r="3.5" />
        <path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5" />
        <path d="M16 4.6a3.5 3.5 0 010 6.8M17.5 14.9c2 .7 3.4 2.5 4 5.1" />
      </>
    ),
  });

export const IconSearch = ({ size }: { size?: number }) =>
  base({
    size,
    children: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-3.8-3.8" />
      </>
    ),
  });

export const IconHeart = ({ size }: { size?: number }) =>
  base({
    size,
    children: <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />,
  });

export const IconTag = ({ size }: { size?: number }) =>
  base({
    size,
    children: (
      <>
        <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
        <circle cx="6" cy="6" r="1.5" />
      </>
    ),
  });

export const IconDownload = ({ size }: { size?: number }) =>
  base({
    size,
    children: (
      <>
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </>
    ),
  });

export const IconClock = ({ size }: { size?: number }) =>
  base({
    size,
    children: (
      <>
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </>
    ),
  });

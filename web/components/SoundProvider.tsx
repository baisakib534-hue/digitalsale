'use client';

import { useEffect } from 'react';
import { playTick } from '../lib/sound';

/** Plays the tick sound on primary button presses (delegated, one listener). */
export default function SoundProvider() {
  useEffect(() => {
    function onClick(e: MouseEvent) {
      const el = e.target as HTMLElement | null;
      if (!el || typeof el.closest !== 'function') return;
      if (el.closest('.btn-primary, button[type="submit"]')) playTick();
    }
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);
  return null;
}

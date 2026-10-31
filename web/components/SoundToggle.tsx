'use client';

import { useEffect, useState } from 'react';
import { getSoundEnabled, setSoundEnabled, playTick } from '../lib/sound';

/** Click-sound toggle — footer pill + floating mobile button, persisted. */
export default function SoundToggle() {
  const [on, setOn] = useState(true);

  useEffect(() => {
    setOn(getSoundEnabled());
  }, []);

  function toggle() {
    const next = !on;
    setOn(next);
    setSoundEnabled(next);
    if (next) playTick();
  }

  return (
    <>
      <button
        type="button"
        className={`sound-toggle${on ? '' : ' off'}`}
        onClick={toggle}
        aria-pressed={on}
        title="Toggle interface sounds"
      >
        <span className="dot" aria-hidden />
        Sound {on ? 'on' : 'off'}
      </button>
      <button
        type="button"
        className="sound-fab"
        onClick={toggle}
        aria-pressed={on}
        aria-label="Toggle interface sounds"
        title="Toggle interface sounds"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          {on ? (
            <>
              <path d="M11 5L6 9H2v6h4l5 4z" />
              <path d="M15.5 8.5a5 5 0 010 7M18.5 5.5a9.5 9.5 0 010 13" />
            </>
          ) : (
            <>
              <path d="M11 5L6 9H2v6h4l5 4z" />
              <path d="M22 9l-6 6M16 9l6 6" />
            </>
          )}
        </svg>
      </button>
    </>
  );
}

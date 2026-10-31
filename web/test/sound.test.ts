import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { getSoundEnabled, setSoundEnabled, playTick } from '../lib/sound';

/** Minimal localStorage stub for node. */
function stubStorage() {
  const store = new Map<string, string>();
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
  return store;
}

describe('sound preference', () => {
  beforeEach(() => {
    stubStorage();
  });

  it('defaults to ON when nothing is stored', () => {
    assert.equal(getSoundEnabled(), true);
  });

  it('persists the toggle across reads', () => {
    setSoundEnabled(false);
    assert.equal(getSoundEnabled(), false);
    setSoundEnabled(true);
    assert.equal(getSoundEnabled(), true);
  });

  it('playTick never throws, even without WebAudio', () => {
    setSoundEnabled(true);
    assert.doesNotThrow(() => playTick());
    setSoundEnabled(false);
    assert.doesNotThrow(() => playTick());
  });
});

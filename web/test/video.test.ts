import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseYouTubeId, youTubeWatchUrl, youTubeEmbedUrl } from '../lib/video';

describe('YouTube URL parsing (v6 product demo video)', () => {
  it('parses watch URLs', () => {
    assert.equal(parseYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  });
  it('parses youtu.be short links', () => {
    assert.equal(parseYouTubeId('https://youtu.be/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  });
  it('parses embed URLs', () => {
    assert.equal(parseYouTubeId('https://www.youtube.com/embed/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  });
  it('parses shorts URLs', () => {
    assert.equal(parseYouTubeId('https://www.youtube.com/shorts/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  });
  it('parses live URLs', () => {
    assert.equal(parseYouTubeId('https://www.youtube.com/live/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  });
  it('accepts a bare 11-char ID', () => {
    assert.equal(parseYouTubeId('dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  });
  it('accepts watch URLs with extra params', () => {
    assert.equal(parseYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s&list=abc'), 'dQw4w9WgXcQ');
  });
  it('rejects non-YouTube URLs', () => {
    assert.equal(parseYouTubeId('https://vimeo.com/123456789'), null);
    assert.equal(parseYouTubeId('https://www.youtube.com.evil.com/watch?v=dQw4w9WgXcQ'), null);
  });
  it('rejects malformed input', () => {
    assert.equal(parseYouTubeId(''), null);
    assert.equal(parseYouTubeId('not a url'), null);
    assert.equal(parseYouTubeId('https://www.youtube.com/watch?v=short'), null);
    assert.equal(parseYouTubeId(undefined), null);
    assert.equal(parseYouTubeId(123), null);
  });
  it('builds canonical watch and embed URLs', () => {
    assert.equal(youTubeWatchUrl('dQw4w9WgXcQ'), 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    assert.equal(
      youTubeEmbedUrl('dQw4w9WgXcQ'),
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0'
    );
  });
});

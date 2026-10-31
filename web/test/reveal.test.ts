import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Reveal, { RevealGroup, RevealItem } from '../components/Reveal';

describe('Reveal (server-render smoke)', () => {
  it('renders its children', () => {
    const html = renderToStaticMarkup(React.createElement(Reveal, null, 'hello world'));
    assert.ok(html.includes('hello world'), `children missing in: ${html.slice(0, 120)}`);
  });

  it('renders a staggered group with items', () => {
    const html = renderToStaticMarkup(
      React.createElement(RevealGroup, {
        className: 'g',
        children: [
          React.createElement(RevealItem, { key: 'a', children: 'one' }),
          React.createElement(RevealItem, { key: 'b', children: 'two' }),
        ],
      })
    );
    assert.ok(html.includes('one') && html.includes('two'));
    assert.ok(html.includes('class="g"'));
  });
});

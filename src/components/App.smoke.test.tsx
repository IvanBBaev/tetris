import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import App from './App';

// Server-side render exercises the whole component tree and every hook body
// (useGameLoop / useInput) without needing a browser. Effects (rAF, canvas,
// key listeners) don't run under SSR, so this catches wiring/runtime errors
// in the render path specifically.
describe('App smoke render', () => {
  it('mounts to the MENU screen without throwing', () => {
    const html = renderToString(<App />);
    expect(html).toContain('TETRIS');
    expect(html).toContain('Play');
    expect(html).toContain('Controls');
  });
});

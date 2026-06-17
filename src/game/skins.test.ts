import { describe, expect, it } from 'vitest';
import { DEFAULT_SKIN_ID, getSkin, SKINS } from './skins';
import { PIECE_TYPES } from './tetrominoes';

describe('skins', () => {
  it('offers at least 5 skins with unique ids', () => {
    expect(SKINS.length).toBeGreaterThanOrEqual(5);
    expect(new Set(SKINS.map((s) => s.id)).size).toBe(SKINS.length);
  });

  it('every skin defines all 7 piece colors and the required theme fields', () => {
    for (const s of SKINS) {
      for (const p of PIECE_TYPES) expect(s.colors[p]).toMatch(/^#|rgb/);
      expect(s.gold).toBeTruthy();
      expect(s.background).toBeTruthy();
      expect(s.accent).toBeTruthy();
      expect(['bevel', 'flat', 'outline']).toContain(s.style);
    }
  });

  it('getSkin resolves by id and falls back to the default', () => {
    expect(getSkin('neon').id).toBe('neon');
    expect(getSkin('does-not-exist').id).toBe(DEFAULT_SKIN_ID);
    expect(getSkin(undefined).id).toBe(DEFAULT_SKIN_ID);
  });
});

import { describe, expect, it } from 'vitest';
import { refillQueue, shuffledBag } from './bag';
import { PIECE_TYPES } from './tetrominoes';

/** Deterministic PRNG for reproducible shuffles. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SORTED = PIECE_TYPES.slice().sort().join('');

describe('7-bag generator', () => {
  it('shuffledBag yields every piece exactly once', () => {
    const bag = shuffledBag(mulberry32(1));
    expect(bag).toHaveLength(7);
    expect(new Set(bag).size).toBe(7);
    expect(bag.slice().sort().join('')).toBe(SORTED);
  });

  it('7 consecutive draws = a full permutation; 14 = two full bags', () => {
    const q = refillQueue([], mulberry32(42), 14);
    const first = q.slice(0, 7);
    const second = q.slice(7, 14);
    expect(first.slice().sort().join('')).toBe(SORTED);
    expect(second.slice().sort().join('')).toBe(SORTED);
  });

  it('never repeats a piece within any aligned 7-window', () => {
    const q = refillQueue([], mulberry32(7), 70);
    for (let i = 0; i < q.length; i += 7) {
      expect(new Set(q.slice(i, i + 7)).size).toBe(7);
    }
  });

  it('preserves already-buffered pieces and only appends', () => {
    const q = refillQueue(['I', 'O'], mulberry32(3), 7);
    expect(q[0]).toBe('I');
    expect(q[1]).toBe('O');
    expect(q.length).toBeGreaterThanOrEqual(7);
  });
});

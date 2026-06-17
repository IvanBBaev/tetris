import { PIECE_TYPES } from './tetrominoes';
import type { PieceType } from './types';

export type RNG = () => number;

/** A single 7-bag: a Fisher–Yates shuffle of all seven pieces. */
export function shuffledBag(rng: RNG = Math.random): PieceType[] {
  const bag = PIECE_TYPES.slice();
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return bag;
}

/**
 * Ensure a piece queue holds at least `min` upcoming pieces, appending fresh
 * shuffled bags as needed. Returns a new array (does not mutate the input).
 */
export function refillQueue(queue: PieceType[], rng: RNG, min: number): PieceType[] {
  const next = queue.slice();
  while (next.length < min) next.push(...shuffledBag(rng));
  return next;
}

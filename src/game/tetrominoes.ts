import type { Offset, Orientation, PieceType } from './types';

// Tetromino mino offsets, transcribed VERBATIM from the spec (§3).
// Do NOT regenerate these via matrix rotation — that introduces off-by-one bugs.
//
// Each entry is the 4 minos of a rotation state as [col, row] offsets inside the
// bounding box (3×3 for T/S/Z/J/L, 4×4 for I and O). row 0 = top.
// Indexed by Orientation: [0 (spawn), 1 (R), 2, 3 (L)].

type Shape = readonly [Offset[], Offset[], Offset[], Offset[]];

export const SHAPES: Record<PieceType, Shape> = {
  T: [
    [[1, 0], [0, 1], [1, 1], [2, 1]], // 0
    [[1, 0], [1, 1], [2, 1], [1, 2]], // R
    [[0, 1], [1, 1], [2, 1], [1, 2]], // 2
    [[1, 0], [0, 1], [1, 1], [1, 2]], // L
  ],
  S: [
    [[1, 0], [2, 0], [0, 1], [1, 1]], // 0
    [[1, 0], [1, 1], [2, 1], [2, 2]], // R
    [[1, 1], [2, 1], [0, 2], [1, 2]], // 2
    [[0, 0], [0, 1], [1, 1], [1, 2]], // L
  ],
  Z: [
    [[0, 0], [1, 0], [1, 1], [2, 1]], // 0
    [[2, 0], [1, 1], [2, 1], [1, 2]], // R
    [[0, 1], [1, 1], [1, 2], [2, 2]], // 2
    [[1, 0], [0, 1], [1, 1], [0, 2]], // L
  ],
  J: [
    [[0, 0], [0, 1], [1, 1], [2, 1]], // 0
    [[1, 0], [2, 0], [1, 1], [1, 2]], // R
    [[0, 1], [1, 1], [2, 1], [2, 2]], // 2
    [[1, 0], [1, 1], [0, 2], [1, 2]], // L
  ],
  L: [
    [[2, 0], [0, 1], [1, 1], [2, 1]], // 0
    [[1, 0], [1, 1], [1, 2], [2, 2]], // R
    [[0, 1], [1, 1], [2, 1], [0, 2]], // 2
    [[0, 0], [1, 0], [1, 1], [1, 2]], // L
  ],
  I: [
    [[0, 1], [1, 1], [2, 1], [3, 1]], // 0
    [[2, 0], [2, 1], [2, 2], [2, 3]], // R
    [[0, 2], [1, 2], [2, 2], [3, 2]], // 2
    [[1, 0], [1, 1], [1, 2], [1, 3]], // L
  ],
  O: [
    // O does not rotate; the four states are identical.
    [[1, 0], [2, 0], [1, 1], [2, 1]],
    [[1, 0], [2, 0], [1, 1], [2, 1]],
    [[1, 0], [2, 0], [1, 1], [2, 1]],
    [[1, 0], [2, 0], [1, 1], [2, 1]],
  ],
};

export const PIECE_TYPES: readonly PieceType[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];

/** Offsets of a piece type in a given orientation. */
export function shapeOffsets(type: PieceType, orientation: Orientation): Offset[] {
  return SHAPES[type][orientation];
}

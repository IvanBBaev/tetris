import { collides } from './board';
import type { ActivePiece, Board, Orientation } from './types';

// Super Rotation System wall kicks, transcribed VERBATIM from the spec (§4).
// All offsets are [dx, dy] with y growing DOWN — ready to add to the box position.

type Kick = readonly [number, number];

const LABEL: Record<Orientation, string> = { 0: '0', 1: 'R', 2: '2', 3: 'L' };

// §4.1 — J, L, S, T, Z
const KICKS_JLSTZ: Record<string, Kick[]> = {
  '0R': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  'R0': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  'R2': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  '2R': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  '2L': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  'L2': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  'L0': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  '0L': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
};

// §4.2 — I
const KICKS_I: Record<string, Kick[]> = {
  '0R': [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],
  'R0': [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]],
  'R2': [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]],
  '2R': [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
  '2L': [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]],
  'L2': [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],
  'L0': [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
  '0L': [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]],
};

export interface RotationResult {
  piece: ActivePiece;
  /** Index (0-4) of the kick offset that succeeded — needed for T-spin Mini detection. */
  kickIndex: number;
}

/**
 * Attempt an SRS rotation. `dir` is +1 (CW) or -1 (CCW).
 * Returns the new piece + kick index used, or null if all 5 kicks collide
 * (rotation rejected). O never rotates.
 */
export function rotate(board: Board, piece: ActivePiece, dir: 1 | -1): RotationResult | null {
  if (piece.type === 'O') return null;

  const from = piece.orientation;
  const to = ((((from + dir) % 4) + 4) % 4) as Orientation;
  const key = LABEL[from] + LABEL[to];
  const table = piece.type === 'I' ? KICKS_I : KICKS_JLSTZ;
  const kicks = table[key];

  for (let i = 0; i < kicks.length; i++) {
    const [dx, dy] = kicks[i];
    const candidate: ActivePiece = {
      ...piece,
      orientation: to,
      x: piece.x + dx,
      y: piece.y + dy,
    };
    if (!collides(board, candidate)) {
      return { piece: candidate, kickIndex: i };
    }
  }
  return null;
}

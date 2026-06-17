import { BOARD_HEIGHT, BOARD_WIDTH } from './constants';
import { SHAPES } from './tetrominoes';
import type { ActivePiece, Board, Cell, Orientation, PieceType, TSpinResult } from './types';

/** Create an empty 40×10 board (all cells null). */
export function createBoard(): Board {
  return Array.from({ length: BOARD_HEIGHT }, () =>
    Array<Cell>(BOARD_WIDTH).fill(null),
  );
}

/** Create an empty 40×10 boolean grid (used to track golden blocks). */
export function createBoolGrid(): boolean[][] {
  return Array.from({ length: BOARD_HEIGHT }, () => Array<boolean>(BOARD_WIDTH).fill(false));
}

/** Absolute [x, y] board coordinates of a piece's four minos. */
export function pieceCells(piece: ActivePiece): Array<[number, number]> {
  return SHAPES[piece.type][piece.orientation].map(
    ([cx, cy]) => [piece.x + cx, piece.y + cy] as [number, number],
  );
}

/** True if the piece overlaps a wall, the floor, or a locked cell. */
export function collides(board: Board, piece: ActivePiece): boolean {
  for (const [x, y] of pieceCells(piece)) {
    if (x < 0 || x >= BOARD_WIDTH || y < 0 || y >= BOARD_HEIGHT) return true;
    if (board[y][x] !== null) return true;
  }
  return false;
}

/** True if the piece cannot move down one row (resting on the stack/floor). */
export function isGrounded(board: Board, piece: ActivePiece): boolean {
  return collides(board, { ...piece, y: piece.y + 1 });
}

/** Lowest valid landing position of a piece (used by ghost & hard drop). */
export function dropPosition(board: Board, piece: ActivePiece): ActivePiece {
  let y = piece.y;
  while (!collides(board, { ...piece, y: y + 1 })) y++;
  return { ...piece, y };
}

/** Return a new board with the piece's minos written in (does not mutate). */
export function lockPiece(board: Board, piece: ActivePiece): Board {
  const next = board.map((row) => row.slice());
  for (const [x, y] of pieceCells(piece)) {
    if (y >= 0 && y < BOARD_HEIGHT && x >= 0 && x < BOARD_WIDTH) {
      next[y][x] = piece.type;
    }
  }
  return next;
}

/** Indices of completely-filled rows (the rows a clear animation flashes). */
export function fullRows(board: Board): number[] {
  const rows: number[] = [];
  for (let r = 0; r < BOARD_HEIGHT; r++) {
    if (board[r].every((cell) => cell !== null)) rows.push(r);
  }
  return rows;
}

/** Remove the given row indices from a grid and prepend empty rows (generic). */
export function removeRows<T>(grid: T[][], rows: number[], fill: T): T[][] {
  const drop = new Set(rows);
  const kept = grid.filter((_, i) => !drop.has(i));
  const empties = Array.from({ length: grid.length - kept.length }, () =>
    Array<T>(grid[0].length).fill(fill),
  );
  return [...empties, ...kept];
}

/**
 * True if the piece cannot move in any of the four directions (immobile) —
 * the All-Spin criterion for recognizing a spin of a non-T piece.
 */
export function isImmobile(board: Board, piece: ActivePiece): boolean {
  return (
    collides(board, { ...piece, y: piece.y - 1 }) &&
    collides(board, { ...piece, y: piece.y + 1 }) &&
    collides(board, { ...piece, x: piece.x - 1 }) &&
    collides(board, { ...piece, x: piece.x + 1 })
  );
}

/** Remove full rows, shift everything above down, prepend empty rows. */
export function clearLines(board: Board): { board: Board; cleared: number } {
  const remaining = board.filter((row) => row.some((cell) => cell === null));
  const cleared = BOARD_HEIGHT - remaining.length;
  const empties: Board = Array.from({ length: cleared }, () =>
    Array<Cell>(BOARD_WIDTH).fill(null),
  );
  return { board: [...empties, ...remaining], cleared };
}

// ── T-spin detection (3-corner rule + Mini, §9) ─────────────────────────

// Corners of the 3×3 T bounding box, as [col, row] offsets.
const CORNER_OFFSET = {
  A: [0, 0], // top-left
  B: [2, 0], // top-right
  C: [0, 2], // bottom-left
  D: [2, 2], // bottom-right
} as const;

type CornerKey = keyof typeof CORNER_OFFSET;

// "Front" corners point toward the T's nub; "back" are opposite (§9.1).
const FRONT: Record<Orientation, [CornerKey, CornerKey]> = {
  0: ['A', 'B'], // nub up
  1: ['B', 'D'], // nub right
  2: ['C', 'D'], // nub down
  3: ['A', 'C'], // nub left
};
const BACK: Record<Orientation, [CornerKey, CornerKey]> = {
  0: ['C', 'D'],
  1: ['A', 'C'],
  2: ['A', 'B'],
  3: ['B', 'D'],
};

/** A corner counts as occupied if it is a wall/floor or a locked cell. */
function cornerOccupied(board: Board, x: number, y: number): boolean {
  if (x < 0 || x >= BOARD_WIDTH || y < 0 || y >= BOARD_HEIGHT) return true;
  return board[y][x] !== null;
}

/**
 * Detect a T-spin for a just-locked piece.
 * Recognized only when the last successful action was a rotation and the piece is a T.
 */
export function detectTSpin(
  board: Board,
  piece: ActivePiece,
  lastMoveWasRotation: boolean,
  lastKickIndex: number,
): TSpinResult {
  if (piece.type !== 'T' || !lastMoveWasRotation) return 'none';

  const occ: Record<CornerKey, boolean> = {
    A: cornerOccupied(board, piece.x + CORNER_OFFSET.A[0], piece.y + CORNER_OFFSET.A[1]),
    B: cornerOccupied(board, piece.x + CORNER_OFFSET.B[0], piece.y + CORNER_OFFSET.B[1]),
    C: cornerOccupied(board, piece.x + CORNER_OFFSET.C[0], piece.y + CORNER_OFFSET.C[1]),
    D: cornerOccupied(board, piece.x + CORNER_OFFSET.D[0], piece.y + CORNER_OFFSET.D[1]),
  };

  const total = (occ.A ? 1 : 0) + (occ.B ? 1 : 0) + (occ.C ? 1 : 0) + (occ.D ? 1 : 0);
  if (total < 3) return 'none';

  // Kick override: the furthest kick (index 4) is the TST/STSD case → always full.
  if (lastKickIndex === 4) return 'full';

  const front = FRONT[piece.orientation].filter((k) => occ[k]).length;
  const back = BACK[piece.orientation].filter((k) => occ[k]).length;

  if (front === 2) return 'full'; // both front + ≥1 back (total ≥ 3)
  if (front === 1 && back === 2) return 'mini'; // one front + both back
  return 'none';
}

export interface SpinInfo {
  result: TSpinResult;
  /** Which piece spun (for the score label), or null when not a spin. */
  piece: PieceType | null;
}

/**
 * Detect a spin for any piece (All-Spin). T uses the 3-corner rule; every other
 * piece counts as a (full) spin when it is immobile right after a rotation.
 */
export function detectSpin(
  board: Board,
  piece: ActivePiece,
  lastMoveWasRotation: boolean,
  lastKickIndex: number,
): SpinInfo {
  if (!lastMoveWasRotation) return { result: 'none', piece: null };

  if (piece.type === 'T') {
    const result = detectTSpin(board, piece, true, lastKickIndex);
    return { result, piece: result === 'none' ? null : 'T' };
  }

  if (isImmobile(board, piece)) return { result: 'full', piece: piece.type };
  return { result: 'none', piece: null };
}

// Core game types. No React imports — pure logic only.
//
// Coordinate convention (whole project): (0,0) is top-left.
// x grows RIGHT, y grows DOWN. All tetromino/kick data is given in this system.

export type PieceType = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L';

/** A board cell: null = empty, otherwise the color key of a locked block. */
export type Cell = PieceType | null;

/** Playfield grid: 40 rows × 10 columns (rows 0-19 hidden buffer, 20-39 visible). */
export type Board = Cell[][];

/** Rotation states: 0 = spawn, 1 = R (cw), 2 = 180, 3 = L (ccw). */
export type Orientation = 0 | 1 | 2 | 3;

/** Mino offset inside a bounding box: [col, row] = [x, y]. */
export type Offset = readonly [number, number];

/** An active, falling piece referenced by its bounding-box top-left position. */
export interface ActivePiece {
  type: PieceType;
  orientation: Orientation;
  /** Bounding-box top-left column on the board. */
  x: number;
  /** Bounding-box top-left row on the board. */
  y: number;
}

export type GameStatus = 'MENU' | 'PLAYING' | 'PAUSED' | 'GAME_OVER';

/** Result of T-spin detection. */
export type TSpinResult = 'none' | 'mini' | 'full';

/** Summary of the most recent line-clearing lock — drives HUD flashes & SFX. */
export interface ClearEvent {
  /** Lines cleared by this lock (0-4). */
  lines: number;
  /** Spin result level (applies to any piece via All-Spin). */
  tspin: TSpinResult;
  /** Which piece performed the spin (for the label), or null if not a spin. */
  spinPiece: PieceType | null;
  /** True only for a 4-line clear without a spin. */
  tetris: boolean;
  /** Whether the Back-to-Back multiplier was applied. */
  b2b: boolean;
  /** Consecutive difficult-clear count (Back-to-Back streak length). */
  b2bChain: number;
  /** Combo counter value after this clear. */
  combo: number;
  /** True when this clear emptied the entire playfield (Perfect Clear). */
  perfectClear: boolean;
  /** True when a golden block was part of the cleared rows. */
  gold: boolean;
  /** Total points awarded by this clear (incl. all bonuses). */
  points: number;
}

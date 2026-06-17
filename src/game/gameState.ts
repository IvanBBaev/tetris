import { refillQueue, type RNG } from './bag';
import {
  collides,
  createBoard,
  createBoolGrid,
  detectSpin,
  dropPosition,
  fullRows,
  isGrounded,
  lockPiece,
  pieceCells,
  removeRows,
} from './board';
import {
  B2B_BONUS_STEP,
  B2B_MAX_MULT,
  BOARD_WIDTH,
  CLEAR_ANIM_MS,
  GOLD_BONUS,
  GOLD_SPAWN_CHANCE,
  HARD_DROP_POINTS_PER_CELL,
  LINES_PER_LEVEL,
  LOCK_DELAY_MS,
  MAX_LOCK_RESETS,
  SOFT_DROP_POINTS_PER_CELL,
  SPAWN_X,
  SPAWN_Y,
  lineScore,
} from './constants';
import { rotate } from './srs';
import type {
  ActivePiece,
  Board,
  ClearEvent,
  GameStatus,
  PieceType,
  TSpinResult,
} from './types';

/** Number of upcoming pieces to keep buffered (next queue shows ≥ 5). */
const QUEUE_LOOKAHEAD = 7;

/** Transient state while cleared rows play their flash/collapse before removal. */
export interface ClearAnimation {
  /** Board-row indices being cleared (in the not-yet-collapsed board). */
  rows: number[];
  elapsed: number;
  duration: number;
  /** Board to apply once the animation finishes (rows removed, stack dropped). */
  board: Board;
  /** Golden-block grid to apply alongside `board` on finalize. */
  gold: boolean[][];
  /** True when this clear empties the whole field (Perfect Clear). */
  perfectClear: boolean;
}

export interface GameState {
  board: Board;
  active: ActivePiece | null;
  hold: PieceType | null;
  canHold: boolean;
  /** Upcoming pieces; index 0 spawns next. Always kept ≥ QUEUE_LOOKAHEAD long. */
  queue: PieceType[];
  status: GameStatus;

  score: number;
  level: number;
  startLevel: number;
  lines: number;

  combo: number; // starts at -1
  b2b: boolean; // is a Back-to-Back chain currently active
  b2bChain: number; // consecutive difficult-clear count (escalates the multiplier)

  /** Golden-block grid mirroring `board`; true where a golden block is locked. */
  gold: boolean[][];
  /** Whether the active piece is a golden (bonus) piece. */
  activeGold: boolean;

  // ── Continuous, per-frame state (mutated by the game loop) ──
  gravityAcc: number; // fractional cells accumulated
  lockTimer: number; // ms elapsed while grounded
  lockResets: number; // move/rotate resets used this piece
  grounded: boolean;

  // ── Rotation tracking for T-spin detection ──
  lastMoveWasRotation: boolean;
  lastKickIndex: number;

  /** Most recent clear (for HUD flash / SFX); null after a non-scoring lock. */
  lastClear: ClearEvent | null;

  /** Active line-clear animation, or null when not clearing. */
  clearing: ClearAnimation | null;

  rng: RNG;
}

// ── Construction ────────────────────────────────────────────────────────

export function createInitialState(startLevel = 1, rng: RNG = Math.random): GameState {
  return {
    board: createBoard(),
    active: null,
    hold: null,
    canHold: true,
    queue: refillQueue([], rng, QUEUE_LOOKAHEAD),
    status: 'MENU',
    score: 0,
    level: startLevel,
    startLevel,
    lines: 0,
    combo: -1,
    b2b: false,
    b2bChain: 0,
    gold: createBoolGrid(),
    activeGold: false,
    gravityAcc: 0,
    lockTimer: 0,
    lockResets: 0,
    grounded: false,
    lastMoveWasRotation: false,
    lastKickIndex: 0,
    lastClear: null,
    clearing: null,
    rng,
  };
}

/** Begin a fresh game from the menu using the configured start level. */
export function startGame(state: GameState): GameState {
  const fresh = createInitialState(state.startLevel, state.rng);
  return spawnNext({ ...fresh, status: 'PLAYING' });
}

// ── Spawning ────────────────────────────────────────────────────────────

/** Pull the next piece into play; top out → GAME_OVER. */
function spawnNext(state: GameState): GameState {
  const queue = refillQueue(state.queue, state.rng, QUEUE_LOOKAHEAD + 1);
  const type = queue[0];
  const piece: ActivePiece = { type, orientation: 0, x: SPAWN_X, y: SPAWN_Y };

  const base: GameState = {
    ...state,
    queue: queue.slice(1),
    active: piece,
    activeGold: state.rng() < GOLD_SPAWN_CHANCE, // roll a golden bonus piece
    canHold: true,
    gravityAcc: 0,
    lockTimer: 0,
    lockResets: 0,
    grounded: isGrounded(state.board, piece),
    lastMoveWasRotation: false,
    lastKickIndex: 0,
    clearing: null,
  };

  // Block out: the spawned piece overlaps the stack → game over (§13).
  if (collides(state.board, piece)) {
    return { ...base, status: 'GAME_OVER' };
  }
  return base;
}

// ── Shared move application ─────────────────────────────────────────────

/**
 * Apply a validated piece position, updating grounded/lock-delay state.
 * `wasRotation` records the move type for T-spin detection.
 */
function applyMove(
  state: GameState,
  piece: ActivePiece,
  wasRotation: boolean,
  kickIndex = 0,
): GameState {
  const grounded = isGrounded(state.board, piece);
  let lockTimer = state.lockTimer;
  let lockResets = state.lockResets;

  if (grounded) {
    if (!state.grounded) {
      // Just landed. If the reset budget is exhausted, lock immediately on
      // the next frame; otherwise start the lock-delay timer fresh.
      lockTimer = state.lockResets >= MAX_LOCK_RESETS ? LOCK_DELAY_MS : 0;
    } else if (state.lockResets < MAX_LOCK_RESETS) {
      // Moved/rotated while already grounded → reset the timer (limited).
      lockTimer = 0;
      lockResets += 1;
    }
    // else: budget exhausted, leave the timer running toward lock.
  } else {
    // Airborne: the lock-delay timer is paused until the next landing.
    lockTimer = 0;
  }

  return {
    ...state,
    active: piece,
    grounded,
    lockTimer,
    lockResets,
    lastMoveWasRotation: wasRotation,
    lastKickIndex: wasRotation ? kickIndex : state.lastKickIndex,
  };
}

// ── Discrete actions (pure reducers) ────────────────────────────────────

export function moveHorizontal(state: GameState, dx: number): GameState {
  if (state.status !== 'PLAYING' || !state.active) return state;
  const moved = { ...state.active, x: state.active.x + dx };
  if (collides(state.board, moved)) return state;
  return applyMove(state, moved, false);
}

export function rotateActive(state: GameState, dir: 1 | -1): GameState {
  if (state.status !== 'PLAYING' || !state.active) return state;
  const result = rotate(state.board, state.active, dir);
  if (!result) return state;
  return applyMove(state, result.piece, true, result.kickIndex);
}

/** One gravity/soft-drop step down. Returns whether the piece actually moved. */
export function stepDown(state: GameState): { state: GameState; moved: boolean } {
  if (state.status !== 'PLAYING' || !state.active) return { state, moved: false };
  const moved = { ...state.active, y: state.active.y + 1 };
  if (collides(state.board, moved)) return { state, moved: false };
  return { state: applyMove(state, moved, false), moved: true };
}

/** A single soft-drop step (gravity step that also scores 1 point per cell). */
export function softDropStep(state: GameState): GameState {
  const { state: next, moved } = stepDown(state);
  if (!moved) return state;
  return { ...next, score: next.score + SOFT_DROP_POINTS_PER_CELL };
}

/** Move the piece to its landing position and award hard-drop points (no lock). */
export function hardDropToFloor(state: GameState): GameState {
  if (state.status !== 'PLAYING' || !state.active) return state;
  const landed = dropPosition(state.board, state.active);
  const dropped = landed.y - state.active.y;
  return {
    ...state,
    active: landed,
    score: state.score + dropped * HARD_DROP_POINTS_PER_CELL,
    // A downward move cancels a prior rotation for T-spin purposes; only a
    // zero-distance hard drop (already resting) preserves the rotation flag.
    lastMoveWasRotation: dropped > 0 ? false : state.lastMoveWasRotation,
  };
}

export function hardDrop(state: GameState): GameState {
  if (state.status !== 'PLAYING' || !state.active) return state;
  return lockActive(hardDropToFloor(state));
}

export function holdPiece(state: GameState): GameState {
  if (state.status !== 'PLAYING' || !state.active || !state.canHold) return state;
  const current = state.active.type;

  if (state.hold === null) {
    // First hold: stash current, spawn the next piece.
    const spawned = spawnNext({ ...state, hold: current, active: null });
    return { ...spawned, canHold: false };
  }

  // Swap: bring the held piece in at spawn position/orientation.
  const piece: ActivePiece = { type: state.hold, orientation: 0, x: SPAWN_X, y: SPAWN_Y };
  if (collides(state.board, piece)) {
    return { ...state, hold: current, active: piece, status: 'GAME_OVER', canHold: false };
  }
  return {
    ...state,
    hold: current,
    active: piece,
    activeGold: false, // held pieces are not golden
    canHold: false,
    gravityAcc: 0,
    lockTimer: 0,
    lockResets: 0,
    grounded: isGrounded(state.board, piece),
    lastMoveWasRotation: false,
    lastKickIndex: 0,
  };
}

export function togglePause(state: GameState): GameState {
  if (state.status === 'PLAYING') return { ...state, status: 'PAUSED' };
  if (state.status === 'PAUSED') return { ...state, status: 'PLAYING' };
  return state;
}

// ── Locking, line clears & scoring ──────────────────────────────────────

/** Perfect Clear (All Clear) base bonus by lines cleared, before × level. */
function perfectClearBase(cleared: number, b2bActive: boolean): number {
  if (cleared >= 4) return b2bActive ? 3200 : 2000;
  return [0, 800, 1200, 1800][cleared] ?? 0;
}

/** Back-to-Back multiplier, escalating with the chain length (capped). */
function b2bMultiplier(b2bActive: boolean, b2bChain: number): number {
  if (!b2bActive) return 1;
  // chain 2 → ×1.5, chain 3 → ×1.75, … capped at B2B_MAX_MULT.
  return Math.min(B2B_MAX_MULT, 1.5 + B2B_BONUS_STEP * Math.max(0, b2bChain - 2));
}

/** Points for a clear: lines × level × B2B, plus combo, perfect-clear & gold bonuses. */
export function scoreClear(opts: {
  tspin: TSpinResult;
  cleared: number;
  level: number;
  b2bActive: boolean;
  b2bChain?: number;
  combo: number;
  perfectClear?: boolean;
  gold?: boolean;
}): number {
  const base = lineScore(opts.tspin, opts.cleared);
  const mult = b2bMultiplier(opts.b2bActive, opts.b2bChain ?? 2);
  const lineComponent = Math.floor(base * opts.level * mult);
  // Combo bonus is NOT multiplied by B2B (§10.2).
  const comboBonus = opts.combo > 0 ? 50 * opts.combo * opts.level : 0;
  // Perfect Clear bonus (the big "bonus" reward for emptying the board).
  const pcBonus = opts.perfectClear ? perfectClearBase(opts.cleared, opts.b2bActive) * opts.level : 0;
  // Golden-block bonus.
  const goldBonus = opts.gold ? GOLD_BONUS * opts.level : 0;
  return lineComponent + comboBonus + pcBonus + goldBonus;
}

function isEmptyBoard(board: Board): boolean {
  return board.every((row) => row.every((cell) => cell === null));
}

/** Lock the active piece's golden mark into a copy of the gold grid. */
function lockGold(state: GameState): boolean[][] {
  const gold = state.gold.map((row) => row.slice());
  if (state.activeGold && state.active) {
    for (const [x, y] of pieceCells(state.active)) {
      if (y >= 0 && y < gold.length && x >= 0 && x < BOARD_WIDTH) gold[y][x] = true;
    }
  }
  return gold;
}

/**
 * Lock the active piece and resolve scoring/level/combo/B2B immediately.
 * If rows clear, returns a state with `clearing` set: the full rows stay in
 * `board` for the explosion and the collapsed board is stashed for
 * `finalizeClear`. With no clear, the next piece spawns right away.
 */
export function beginLock(state: GameState): GameState {
  if (!state.active) return state;

  const lockedBoard = lockPiece(state.board, state.active);
  const lockedGold = lockGold(state);
  const rows = fullRows(lockedBoard);
  const cleared = rows.length;

  // Spin detection. T-spins keep their guideline 0-line value (400/100), but
  // non-T All-Spins only count when they actually clear lines — otherwise an
  // immobile lock with no clear would farm points.
  const spin = detectSpin(state.board, state.active, state.lastMoveWasRotation, state.lastKickIndex);
  const isSpin = spin.result !== 'none' && (spin.piece === 'T' || cleared > 0);
  const tspin = isSpin ? spin.result : 'none';
  const spinPiece = isSpin ? spin.piece : null;
  const clearedBoard: Board = removeRows(lockedBoard, rows, null);
  const clearedGold = removeRows(lockedGold, rows, false);
  const perfectClear = cleared > 0 && isEmptyBoard(clearedBoard);
  const goldCleared = rows.some((r) => lockedGold[r].some(Boolean));

  // "Difficult" clear = Tetris OR any spin that clears ≥1 line (§10.1, All-Spin).
  const isDifficult = cleared > 0 && (cleared === 4 || tspin !== 'none');
  const b2bActive = isDifficult && state.b2bChain >= 1;

  // B2B chain: a difficult clear extends it, a normal line clear breaks it,
  // a spin with no lines leaves it unchanged.
  const newB2bChain =
    cleared > 0 ? (isDifficult ? state.b2bChain + 1 : 0) : state.b2bChain;

  // Combo: increments on every line-clearing lock, resets to -1 otherwise.
  const newCombo = cleared > 0 ? state.combo + 1 : -1;

  const gained = scoreClear({
    tspin,
    cleared,
    level: state.level,
    b2bActive,
    b2bChain: newB2bChain,
    combo: newCombo,
    perfectClear,
    gold: goldCleared,
  });

  const totalLines = state.lines + cleared;
  const newLevel = state.startLevel + Math.floor(totalLines / LINES_PER_LEVEL);

  const clearEvent: ClearEvent = {
    lines: cleared,
    tspin,
    spinPiece,
    tetris: cleared === 4 && tspin === 'none',
    b2b: b2bActive,
    b2bChain: newB2bChain,
    combo: newCombo,
    perfectClear,
    gold: goldCleared,
    points: gained,
  };

  const resolved: GameState = {
    ...state,
    active: null,
    score: state.score + gained,
    lines: totalLines,
    level: newLevel,
    combo: newCombo,
    b2b: newB2bChain >= 1,
    b2bChain: newB2bChain,
    canHold: true,
    lastClear: cleared > 0 || tspin !== 'none' ? clearEvent : null,
  };

  if (cleared === 0) {
    // No animation — drop the locked board/gold in and spawn immediately.
    return spawnNext({ ...resolved, board: lockedBoard, gold: lockedGold });
  }

  // Enter the clearing animation: keep the full rows visible; defer removal.
  return {
    ...resolved,
    board: lockedBoard,
    gold: lockedGold,
    clearing: {
      rows,
      elapsed: 0,
      duration: CLEAR_ANIM_MS,
      board: clearedBoard,
      gold: clearedGold,
      perfectClear,
    },
  };
}

/** Finish a clear animation: collapse the stack and spawn the next piece. */
export function finalizeClear(state: GameState): GameState {
  if (!state.clearing) return state;
  return spawnNext({
    ...state,
    board: state.clearing.board,
    gold: state.clearing.gold,
    clearing: null,
  });
}

/** Atomic lock + clear + spawn (no animation) — used by pure tests. */
export function lockActive(state: GameState): GameState {
  const begun = beginLock(state);
  return begun.clearing ? finalizeClear(begun) : begun;
}

// ── Queries (for rendering) ─────────────────────────────────────────────

/** Ghost piece position (current piece hard-dropped). */
export function ghostPiece(state: GameState): ActivePiece | null {
  if (!state.active) return null;
  return dropPosition(state.board, state.active);
}

/** Whether the active piece is currently grounded and locking. */
export function isLockTimerRunning(state: GameState): boolean {
  return state.grounded && state.status === 'PLAYING';
}

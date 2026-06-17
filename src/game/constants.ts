import type { PieceType, TSpinResult } from './types';

// ── Playfield dimensions ────────────────────────────────────────────────
export const BOARD_WIDTH = 10;
/** Internal height incl. hidden spawn buffer. */
export const BOARD_HEIGHT = 40;
/** Visible rows = 20; visible region is rows 20-39. */
export const VISIBLE_HEIGHT = 20;
/** Number of hidden buffer rows at the top (indices 0-19). */
export const HIDDEN_ROWS = BOARD_HEIGHT - VISIBLE_HEIGHT; // 20

// ── Spawn ───────────────────────────────────────────────────────────────
/** Bounding-box top-left column at spawn (same for all pieces). */
export const SPAWN_X = 3;
/** Bounding-box top-left row at spawn (box top sits on hidden row 18). */
export const SPAWN_Y = 18;

// ── Lock delay ──────────────────────────────────────────────────────────
export const LOCK_DELAY_MS = 500;
export const MAX_LOCK_RESETS = 15;

// ── Line-clear animation (§8) ───────────────────────────────────────────
/** Duration of the explosion before cleared rows are removed & the stack drops. */
export const CLEAR_ANIM_MS = 320;

// ── Input timing defaults (ms) ──────────────────────────────────────────
export const DEFAULT_DAS_MS = 133;
export const DEFAULT_ARR_MS = 10;

// ── Drops ───────────────────────────────────────────────────────────────
export const SOFT_DROP_FACTOR = 20;
export const SOFT_DROP_POINTS_PER_CELL = 1;
export const HARD_DROP_POINTS_PER_CELL = 2;

// ── Colors (guideline canonical) ────────────────────────────────────────
export const COLORS: Record<PieceType, string> = {
  I: '#00FFFF',
  O: '#FFFF00',
  T: '#800080',
  S: '#00FF00',
  Z: '#FF0000',
  J: '#0000FF',
  L: '#FF7F00',
};

// ── Bonuses ─────────────────────────────────────────────────────────────
/** Extra Back-to-Back multiplier added per chain step beyond the first ×1.5. */
export const B2B_BONUS_STEP = 0.25;
/** Cap on the Back-to-Back multiplier so it can't run away. */
export const B2B_MAX_MULT = 2.5;
/** Chance that a freshly spawned piece carries a golden mino. */
export const GOLD_SPAWN_CHANCE = 0.12;
/** Bonus per golden block cleared (× level). */
export const GOLD_BONUS = 500;
/** Render color of golden blocks. */
export const GOLD_COLOR = '#FFD700';

// ── Levels ──────────────────────────────────────────────────────────────
export const LINES_PER_LEVEL = 10;

/**
 * Guideline gravity formula:
 *   (0.8 - (level - 1) * 0.007) ^ (level - 1)
 *
 * NOTE: the spec (§7.1) labels this "cells/frame", but that is a mislabel — the
 * expression is the canonical guideline value for SECONDS PER ROW (it decreases
 * with level, i.e. faster). Taken literally as cells/frame it would drop a full
 * cell every frame at level 1 (instant) AND get slower with level — unplayable.
 * We therefore use it as seconds-per-row and invert to cells/ms, which yields
 * the correct, monotonically-faster guideline speeds (≈1 cell/s at level 1).
 */
export function secondsPerRow(level: number): number {
  return Math.pow(0.8 - (level - 1) * 0.007, level - 1);
}

/** Gravity expressed as cells per millisecond, accumulated against delta time. */
export function gravityCellsPerMs(level: number): number {
  return 1 / (secondsPerRow(level) * 1000);
}

// ── Scoring base values (× level unless noted) ──────────────────────────
/**
 * Base points for a clear, indexed by lines cleared, before the level
 * multiplier, B2B, and combo bonus are applied.
 */
export function lineScore(tspin: TSpinResult, cleared: number): number {
  if (tspin === 'full') {
    // 0,1,2,3 lines → 400 / 800 / 1200 / 1600. A 4-line spin (only reachable via
    // an All-Spin, e.g. a vertical I) scores at the spin-quad value 2000.
    return [400, 800, 1200, 1600, 2000][cleared] ?? 0;
  }
  if (tspin === 'mini') {
    // 0,1,2 lines → 100 / 200 / 400
    return [100, 200, 400][cleared] ?? 0;
  }
  // No T-spin: 0,1,2,3,4 lines → 0 / 100 / 300 / 500 / 800
  return [0, 100, 300, 500, 800][cleared] ?? 0;
}

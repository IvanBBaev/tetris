import { describe, expect, it } from 'vitest';
import {
  beginLock,
  createInitialState,
  finalizeClear,
  hardDropToFloor,
  lockActive,
  scoreClear,
  softDropStep,
  startGame,
  type GameState,
} from './gameState';
import type { Board } from './types';

const zeroRng = () => 0;

function cloneBoard(b: Board): Board {
  return b.map((row) => row.slice());
}

describe('scoreClear', () => {
  it('Tetris base = 800 × level', () => {
    expect(scoreClear({ tspin: 'none', cleared: 4, level: 1, b2bActive: false, combo: 0 })).toBe(800);
    expect(scoreClear({ tspin: 'none', cleared: 4, level: 3, b2bActive: false, combo: 0 })).toBe(2400);
  });

  it('B2B applies ×1.5 to the line component only', () => {
    expect(scoreClear({ tspin: 'none', cleared: 4, level: 1, b2bActive: true, combo: 0 })).toBe(1200);
    // T-Spin Double, B2B: 1200 × 1 × 1.5 = 1800
    expect(scoreClear({ tspin: 'full', cleared: 2, level: 1, b2bActive: true, combo: 0 })).toBe(1800);
  });

  it('combo bonus = 50 × combo × level, added after and not multiplied by B2B', () => {
    // Single, level 2, combo 3: 100×2 + 50×3×2 = 200 + 300 = 500
    expect(scoreClear({ tspin: 'none', cleared: 1, level: 2, b2bActive: false, combo: 3 })).toBe(500);
    // Combo 0 → no bonus
    expect(scoreClear({ tspin: 'none', cleared: 1, level: 1, b2bActive: false, combo: 0 })).toBe(100);
    // Tetris B2B + combo 2 @ lvl1: 800×1.5 + 50×2×1 = 1200 + 100 = 1300 (combo not ×1.5)
    expect(scoreClear({ tspin: 'none', cleared: 4, level: 1, b2bActive: true, combo: 2 })).toBe(1300);
  });

  it('T-spin and Mini base values', () => {
    expect(scoreClear({ tspin: 'full', cleared: 0, level: 1, b2bActive: false, combo: -1 })).toBe(400);
    expect(scoreClear({ tspin: 'full', cleared: 1, level: 1, b2bActive: false, combo: 0 })).toBe(800);
    expect(scoreClear({ tspin: 'full', cleared: 3, level: 1, b2bActive: false, combo: 0 })).toBe(1600);
    // 4-line spin (only via All-Spin, e.g. a vertical I) → spin-quad value.
    expect(scoreClear({ tspin: 'full', cleared: 4, level: 1, b2bActive: false, combo: 0 })).toBe(2000);
    expect(scoreClear({ tspin: 'mini', cleared: 0, level: 1, b2bActive: false, combo: -1 })).toBe(100);
    expect(scoreClear({ tspin: 'mini', cleared: 1, level: 1, b2bActive: false, combo: 0 })).toBe(200);
  });
});

/** A state whose active vertical I will complete a Tetris in column 0 on lock. */
function tetrisState(prev: GameState): GameState {
  const board = cloneBoard(prev.board);
  for (const r of [36, 37, 38, 39]) {
    for (let c = 0; c < 10; c++) board[r][c] = c === 0 ? null : 'I';
  }
  board[20][0] = 'I'; // stray block so the clear is NOT a Perfect Clear
  return {
    ...prev,
    board,
    status: 'PLAYING',
    active: { type: 'I', orientation: 1, x: -2, y: 36 }, // vertical bar in column 0
    activeGold: false,
    lastMoveWasRotation: false,
  };
}

/** A state whose active horizontal I completes one bottom row on lock. */
function singleLineState(prev: GameState): GameState {
  const board = cloneBoard(prev.board);
  for (let c = 0; c < 10; c++) board[39][c] = c >= 4 ? 'I' : null;
  board[20][0] = 'I'; // stray block so the clear is NOT a Perfect Clear
  return {
    ...prev,
    board,
    status: 'PLAYING',
    active: { type: 'I', orientation: 0, x: 0, y: 38 }, // fills row 39 cols 0-3
    activeGold: false,
    lastMoveWasRotation: false,
  };
}

describe('lockActive — clears, B2B & combo', () => {
  it('locks a Tetris, awards 800 @ lvl1, and arms Back-to-Back', () => {
    let s = tetrisState(createInitialState(1, zeroRng));
    const before = s.score;
    s = lockActive(s);
    expect(s.lines).toBe(4);
    expect(s.b2b).toBe(true);
    expect(s.combo).toBe(0);
    expect(s.score - before).toBe(800);
  });

  it('a second consecutive Tetris triggers the B2B ×1.5 (plus combo bonus)', () => {
    let s = lockActive(tetrisState(createInitialState(1, zeroRng)));
    const before = s.score;
    s = lockActive(tetrisState(s));
    // line component 800×1.5 = 1200; combo is now 1 → 50×1×1 = 50
    expect(s.score - before).toBe(1250);
    expect(s.b2b).toBe(true);
  });

  it('a normal line clear breaks the Back-to-Back chain', () => {
    let s = createInitialState(1, zeroRng);
    s = { ...s, status: 'PLAYING', b2b: true, combo: 0 };
    s = lockActive(singleLineState(s));
    expect(s.lines).toBe(1);
    expect(s.b2b).toBe(false);
  });

  it('combo increments across consecutive clears and resets on a clear-less lock', () => {
    let s = createInitialState(1, zeroRng);
    s = { ...s, status: 'PLAYING' };

    s = lockActive(singleLineState(s));
    expect(s.combo).toBe(0);

    const before = s.score;
    s = lockActive(singleLineState(s));
    expect(s.combo).toBe(1);
    expect(s.score - before).toBe(100 + 50); // single + combo bonus

    // Lock a piece that clears nothing → combo resets.
    s = { ...s, active: { type: 'O', orientation: 0, x: 4, y: 20 }, lastMoveWasRotation: false };
    s = lockActive(s);
    expect(s.combo).toBe(-1);
  });
});

describe('Back-to-Back escalation', () => {
  it('multiplier grows with the chain (×1.5 → ×1.75) and tracks b2bChain', () => {
    let s = lockActive(tetrisState(createInitialState(1, zeroRng))); // chain 1, no mult
    expect(s.b2bChain).toBe(1);
    s = lockActive(tetrisState(s)); // chain 2, ×1.5
    expect(s.b2bChain).toBe(2);
    const before = s.score;
    s = lockActive(tetrisState(s)); // chain 3, ×1.75
    expect(s.b2bChain).toBe(3);
    // line 800 × 1.75 = 1400; combo is now 2 → 50×2×1 = 100
    expect(s.score - before).toBe(1400 + 100);
  });

  it('escalation is exposed through scoreClear', () => {
    expect(scoreClear({ tspin: 'none', cleared: 4, level: 1, b2bActive: true, b2bChain: 2, combo: 0 })).toBe(1200);
    expect(scoreClear({ tspin: 'none', cleared: 4, level: 1, b2bActive: true, b2bChain: 3, combo: 0 })).toBe(1400);
    expect(scoreClear({ tspin: 'none', cleared: 4, level: 1, b2bActive: true, b2bChain: 4, combo: 0 })).toBe(1600);
  });
});

describe('golden block bonus', () => {
  it('awards a gold bonus when a golden block is in a cleared row', () => {
    const base = createInitialState(1, zeroRng);
    const board = cloneBoard(base.board);
    for (let c = 4; c < 10; c++) board[39][c] = 'I';
    board[20][0] = 'I'; // stray → not a Perfect Clear
    const s: GameState = {
      ...base,
      status: 'PLAYING',
      score: 0,
      board,
      active: { type: 'I', orientation: 0, x: 0, y: 38 },
      activeGold: true,
    };
    const after = lockActive(s);
    expect(after.lines).toBe(1);
    expect(after.lastClear?.gold).toBe(true);
    expect(after.score).toBe(100 + 500); // single + gold bonus, level 1
  });
});

describe('All-Spin scoring restriction', () => {
  it('does not score a non-T spin that clears no lines (no farming)', () => {
    const base = createInitialState(1, zeroRng);
    const board = cloneBoard(base.board);
    // Pocket trapping an S at the bottom-left; no row can complete.
    board[37][1] = 'I';
    board[37][2] = 'I';
    board[38][0] = 'I';
    board[38][3] = 'I';
    board[39][2] = 'I';
    board[39][3] = 'I';
    const s: GameState = {
      ...base,
      status: 'PLAYING',
      score: 0,
      board,
      active: { type: 'S', orientation: 0, x: 0, y: 38 },
      activeGold: false,
      lastMoveWasRotation: true,
    };
    const after = lockActive(s);
    expect(after.lastClear).toBeNull();
    expect(after.score).toBe(0);
  });
});

describe('drop scoring (never multiplied by level)', () => {
  it('soft drop step awards exactly 1 point at high level', () => {
    let s = startGame(createInitialState(9, zeroRng));
    const before = s.score;
    s = softDropStep(s);
    expect(s.score - before).toBe(1);
  });

  it('hard drop awards 2 points per cell, ignoring level', () => {
    const base = createInitialState(9, zeroRng);
    const s: GameState = {
      ...base,
      status: 'PLAYING',
      score: 0,
      active: { type: 'T', orientation: 0, x: 3, y: 20 },
    };
    // T spawn bottom is box.y+1; on an empty board it lands at y=38 → 18 rows.
    expect(hardDropToFloor(s).score).toBe(18 * 2);
  });
});

describe('Perfect Clear bonus', () => {
  it('awards a Perfect Clear bonus when the board is emptied by the clear', () => {
    const base = createInitialState(1, zeroRng);
    const board = cloneBoard(base.board);
    for (let c = 4; c < 10; c++) board[39][c] = 'I';
    const s: GameState = {
      ...base,
      status: 'PLAYING',
      score: 0,
      board,
      active: { type: 'I', orientation: 0, x: 0, y: 38 }, // fills row 39 cols 0-3
    };
    const after = lockActive(s);
    expect(after.lines).toBe(1);
    expect(after.lastClear?.perfectClear).toBe(true);
    // single (100) + perfect-clear single bonus (800), level 1, combo 0
    expect(after.score).toBe(900);
  });

  it('does not flag a Perfect Clear when residual blocks remain', () => {
    const after = lockActive(singleLineState(createInitialState(1, zeroRng)));
    expect(after.lastClear?.perfectClear).toBe(false);
  });
});

describe('clear animation (beginLock / finalizeClear)', () => {
  it('beginLock defers row removal, keeps full rows visible, stashes the collapsed board', () => {
    const begun = beginLock(tetrisState(createInitialState(1, zeroRng)));
    expect(begun.clearing).not.toBeNull();
    expect(begun.clearing!.rows).toEqual([36, 37, 38, 39]);
    expect(begun.active).toBeNull();
    expect(begun.lines).toBe(4); // score/lines applied immediately
    expect(begun.board[39].every((c) => c !== null)).toBe(true); // rows not yet removed

    const done = finalizeClear(begun);
    expect(done.clearing).toBeNull();
    expect(done.active).not.toBeNull(); // next piece spawned
    expect(done.board[39].every((c) => c !== null)).toBe(false); // stack collapsed
  });

  it('beginLock spawns immediately when no rows clear (no animation)', () => {
    const base = createInitialState(1, zeroRng);
    const s: GameState = {
      ...base,
      status: 'PLAYING',
      active: { type: 'O', orientation: 0, x: 4, y: 38 },
    };
    const begun = beginLock(s);
    expect(begun.clearing).toBeNull();
    expect(begun.active).not.toBeNull();
  });
});

describe('top out', () => {
  it('marks GAME_OVER when a new piece cannot spawn', () => {
    let s = createInitialState(1, zeroRng);
    // Block the spawn region (cols 0-8) so the next piece collides immediately.
    // Leave column 9 empty so these rows are not "full" and don't get cleared.
    const board = cloneBoard(s.board);
    for (let r = 18; r < 22; r++) for (let c = 0; c < 9; c++) board[r][c] = 'I';
    s = { ...s, status: 'PLAYING', board, active: { type: 'O', orientation: 0, x: 4, y: 38 } };
    s = lockActive(s); // locks O at the bottom, then tries to spawn into the filled region
    expect(s.status).toBe('GAME_OVER');
  });
});

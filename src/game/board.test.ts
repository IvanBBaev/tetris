import { describe, expect, it } from 'vitest';
import { clearLines, createBoard, detectSpin, detectTSpin, isImmobile, pieceCells } from './board';
import type { ActivePiece, Board } from './types';

function fillRow(board: Board, row: number, except: number[] = []): void {
  for (let c = 0; c < 10; c++) if (!except.includes(c)) board[row][c] = 'I';
}

function filledCount(board: Board): number {
  return board.flat().filter(Boolean).length;
}

describe('line clear', () => {
  it('clears a single full row and shifts blocks above down', () => {
    const board = createBoard();
    fillRow(board, 39);
    board[38][0] = 'T'; // a block sitting above the full row

    const { board: nb, cleared } = clearLines(board);
    expect(cleared).toBe(1);
    expect(nb[39][0]).toBe('T'); // shifted down one row
    expect(filledCount(nb)).toBe(1);
  });

  it('clears a double', () => {
    const board = createBoard();
    fillRow(board, 38);
    fillRow(board, 39);
    expect(clearLines(board).cleared).toBe(2);
  });

  it('clears a triple', () => {
    const board = createBoard();
    [37, 38, 39].forEach((r) => fillRow(board, r));
    expect(clearLines(board).cleared).toBe(3);
  });

  it('clears a tetris and empties the board', () => {
    const board = createBoard();
    [36, 37, 38, 39].forEach((r) => fillRow(board, r));
    const { board: nb, cleared } = clearLines(board);
    expect(cleared).toBe(4);
    expect(filledCount(nb)).toBe(0);
  });

  it('clears a full row in the middle of the stack, keeping the rest', () => {
    const board = createBoard();
    board[37][0] = 'S'; // above the cleared row
    fillRow(board, 38); // full → cleared
    board[39][5] = 'Z'; // below, stays put

    const { board: nb, cleared } = clearLines(board);
    expect(cleared).toBe(1);
    expect(nb[38][0]).toBe('S'); // S fell one row (37 → 38)
    expect(nb[39][5]).toBe('Z'); // Z unchanged
    expect(filledCount(nb)).toBe(2);
  });
});

describe('T-spin detection (3-corner rule)', () => {
  // T at box (3,30), orientation 0 (nub up).
  // Corners: A(3,30) B(5,30) front; C(3,32) D(5,32) back.
  const baseT = (): ActivePiece => ({ type: 'T', orientation: 0, x: 3, y: 30 });

  it('detects a full T-spin: both front corners + one back', () => {
    const board = createBoard();
    board[30][3] = 'I';
    board[30][5] = 'I';
    board[32][3] = 'I';
    expect(detectTSpin(board, baseT(), true, 0)).toBe('full');
  });

  it('detects a Mini: one front corner + both back', () => {
    const board = createBoard();
    board[30][3] = 'I';
    board[32][3] = 'I';
    board[32][5] = 'I';
    expect(detectTSpin(board, baseT(), true, 0)).toBe('mini');
  });

  it('kick index 4 upgrades a Mini configuration to a full T-spin', () => {
    const board = createBoard();
    board[30][3] = 'I';
    board[32][3] = 'I';
    board[32][5] = 'I';
    expect(detectTSpin(board, baseT(), true, 4)).toBe('full');
  });

  it('is not a T-spin when the last action was not a rotation', () => {
    const board = createBoard();
    board[30][3] = 'I';
    board[30][5] = 'I';
    board[32][3] = 'I';
    expect(detectTSpin(board, baseT(), false, 0)).toBe('none');
  });

  it('is not a T-spin for a non-T piece', () => {
    const board = createBoard();
    board[30][3] = 'I';
    board[30][5] = 'I';
    board[32][3] = 'I';
    expect(detectTSpin(board, { type: 'L', orientation: 0, x: 3, y: 30 }, true, 0)).toBe('none');
  });

  it('needs at least 3 occupied corners', () => {
    const board = createBoard();
    board[30][3] = 'I';
    board[30][5] = 'I'; // only the two front corners
    expect(detectTSpin(board, baseT(), true, 0)).toBe('none');
  });

  it('counts walls/floor as occupied corners', () => {
    const board = createBoard();
    // T at the bottom-left: box (0,38). Corners A(0,38) B(2,38) C(0,40 floor) D(2,40 floor).
    const piece: ActivePiece = { type: 'T', orientation: 0, x: 0, y: 38 };
    board[38][0] = 'I'; // fill one front corner; both back corners are the floor
    expect(detectTSpin(board, piece, true, 0)).toBe('mini');
  });
});

describe('All-Spin detection (detectSpin)', () => {
  // Fill the whole board, then carve out exactly the piece's cells → immobile.
  function boxIn(piece: ActivePiece): Board {
    const board = createBoard();
    for (let r = 0; r < 40; r++) for (let c = 0; c < 10; c++) board[r][c] = 'I';
    for (const [x, y] of pieceCells(piece)) board[y][x] = null;
    return board;
  }

  it('flags an immobile rotated S piece as a (full) spin', () => {
    const piece: ActivePiece = { type: 'S', orientation: 0, x: 3, y: 36 };
    const board = boxIn(piece);
    expect(isImmobile(board, piece)).toBe(true);
    const spin = detectSpin(board, piece, true, 0);
    expect(spin.result).toBe('full');
    expect(spin.piece).toBe('S');
  });

  it('does not flag a freely-movable piece as a spin', () => {
    const board = createBoard();
    const piece: ActivePiece = { type: 'L', orientation: 0, x: 3, y: 20 };
    expect(detectSpin(board, piece, true, 0).result).toBe('none');
  });

  it('requires the last action to be a rotation', () => {
    const piece: ActivePiece = { type: 'Z', orientation: 0, x: 3, y: 36 };
    const board = boxIn(piece);
    expect(detectSpin(board, piece, false, 0).result).toBe('none');
  });

  it('routes T pieces through the 3-corner rule', () => {
    const board = createBoard();
    board[30][3] = 'I';
    board[30][5] = 'I';
    board[32][3] = 'I';
    const t: ActivePiece = { type: 'T', orientation: 0, x: 3, y: 30 };
    const spin = detectSpin(board, t, true, 0);
    expect(spin.result).toBe('full');
    expect(spin.piece).toBe('T');
  });
});

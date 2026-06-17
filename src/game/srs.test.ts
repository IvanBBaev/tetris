import { describe, expect, it } from 'vitest';
import { clearLines, collides, createBoard, detectTSpin, lockPiece } from './board';
import { rotate } from './srs';
import { PIECE_TYPES } from './tetrominoes';
import type { ActivePiece, Board, Orientation } from './types';

function fillRowExcept(board: Board, row: number, except: number[]): void {
  for (let c = 0; c < 10; c++) if (!except.includes(c)) board[row][c] = 'I';
}

describe('SRS rotation on an open board', () => {
  it('rotates every piece through all 8 transitions using kick index 0', () => {
    const board = createBoard();
    for (const type of PIECE_TYPES) {
      if (type === 'O') continue;
      let piece: ActivePiece = { type, orientation: 0, x: 3, y: 20 };
      // CW cycle 0→R→2→L→0
      for (let i = 0; i < 4; i++) {
        const res = rotate(board, piece, 1);
        expect(res, `${type} CW from ${piece.orientation}`).not.toBeNull();
        expect(res!.kickIndex).toBe(0);
        expect(res!.piece.orientation).toBe((((piece.orientation + 1) % 4) as Orientation));
        piece = res!.piece;
      }
      // CCW cycle 0→L→2→R→0
      for (let i = 0; i < 4; i++) {
        const res = rotate(board, piece, -1);
        expect(res, `${type} CCW from ${piece.orientation}`).not.toBeNull();
        expect(res!.kickIndex).toBe(0);
        piece = res!.piece;
      }
    }
  });

  it('O never rotates', () => {
    expect(rotate(createBoard(), { type: 'O', orientation: 0, x: 3, y: 20 }, 1)).toBeNull();
  });
});

describe('SRS wall kicks', () => {
  it('T kicks right off the left wall (R→0 uses kick index 1)', () => {
    const board = createBoard();
    for (let r = 0; r < 40; r++) board[r][0] = 'I'; // solid left wall
    const piece: ActivePiece = { type: 'T', orientation: 1, x: 0, y: 20 };
    expect(collides(board, piece)).toBe(false);

    const res = rotate(board, piece, -1);
    expect(res).not.toBeNull();
    expect(res!.piece.orientation).toBe(0);
    expect(res!.kickIndex).toBe(1);
    expect(res!.piece.x).toBe(1);
    expect(collides(board, res!.piece)).toBe(false);
  });

  it('I kicks right off the left wall (R→0 uses kick index 1)', () => {
    const board = createBoard();
    for (let r = 0; r < 40; r++) board[r][0] = 'O';
    const piece: ActivePiece = { type: 'I', orientation: 1, x: 0, y: 20 };
    expect(collides(board, piece)).toBe(false);

    const res = rotate(board, piece, -1);
    expect(res).not.toBeNull();
    expect(res!.kickIndex).toBe(1);
    expect(res!.piece.x).toBe(2);
    expect(collides(board, res!.piece)).toBe(false);
  });
});

describe('SRS T-Spin Triple (deep kick)', () => {
  it('rotates a T into a 3-line slot via kick index 4 and clears three rows', () => {
    const board = createBoard();
    // Vertical slot at column 2 spanning rows 22-24, with a nub notch at (3,23).
    fillRowExcept(board, 22, [2]);
    fillRowExcept(board, 23, [2, 3]);
    fillRowExcept(board, 24, [2]);
    // Overhang forcing kicks 0-3 to fail so the deep TST kick (index 4) is used.
    board[20][2] = 'I';

    const piece: ActivePiece = { type: 'T', orientation: 0, x: 2, y: 20 };
    expect(collides(board, piece)).toBe(false);

    const res = rotate(board, piece, 1); // 0 → R
    expect(res).not.toBeNull();
    expect(res!.piece.orientation).toBe(1);
    expect(res!.kickIndex).toBe(4);
    expect(res!.piece.x).toBe(1);
    expect(res!.piece.y).toBe(22);

    // It is recognized as a full T-spin (kick-index-4 override).
    expect(detectTSpin(board, res!.piece, true, res!.kickIndex)).toBe('full');

    // Locking it clears the three rows.
    const { cleared } = clearLines(lockPiece(board, res!.piece));
    expect(cleared).toBe(3);
  });
});

import { forwardRef } from 'react';
import { pieceCells } from '../game/board';
import { BOARD_HEIGHT, HIDDEN_ROWS, VISIBLE_HEIGHT } from '../game/constants';
import { ghostPiece, type GameState } from '../game/gameState';
import type { Skin } from '../game/skins';
import styles from './Board.module.css';

/** Logical pixel size of one cell. The loop scales the canvas for device DPR. */
export const CELL = 30;
export const CANVAS_W = 10 * CELL;
export const CANVAS_H = VISIBLE_HEIGHT * CELL;

function drawCell(
  ctx: CanvasRenderingContext2D,
  col: number,
  visRow: number,
  color: string,
  skin: Skin,
  alpha = 1,
): void {
  const x = col * CELL;
  const y = visRow * CELL;

  if (skin.style === 'outline') {
    ctx.globalAlpha = alpha * 0.18;
    ctx.fillStyle = color;
    ctx.fillRect(x, y, CELL, CELL);
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1.5, y + 1.5, CELL - 3, CELL - 3);
    ctx.globalAlpha = 1;
    return;
  }

  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.fillRect(x, y, CELL, CELL);
  if (skin.style === 'bevel') {
    // Light top/left edge.
    ctx.globalAlpha = alpha * 0.35;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x, y, CELL, 3);
    ctx.fillRect(x, y, 3, CELL);
  }
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = skin.border;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, CELL - 1, CELL - 1);
  ctx.globalAlpha = 1;
}

function drawGhostCell(ctx: CanvasRenderingContext2D, col: number, visRow: number, color: string): void {
  const x = col * CELL;
  const y = visRow * CELL;
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = color;
  ctx.fillRect(x, y, CELL, CELL);
  ctx.globalAlpha = 0.6;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, CELL - 2, CELL - 2);
  ctx.globalAlpha = 1;
}

/** Render the playfield from game state. Operates in logical (CELL) coordinates. */
export function drawGame(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  opts: { ghost: boolean; skin: Skin },
): void {
  const { skin } = opts;

  // Background.
  ctx.fillStyle = skin.background;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Grid lines.
  ctx.strokeStyle = skin.grid;
  ctx.lineWidth = 1;
  for (let c = 1; c < 10; c++) {
    ctx.beginPath();
    ctx.moveTo(c * CELL + 0.5, 0);
    ctx.lineTo(c * CELL + 0.5, CANVAS_H);
    ctx.stroke();
  }
  for (let r = 1; r < VISIBLE_HEIGHT; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * CELL + 0.5);
    ctx.lineTo(CANVAS_W, r * CELL + 0.5);
    ctx.stroke();
  }

  // Locked cells (visible region only); golden blocks render in gold.
  for (let row = HIDDEN_ROWS; row < BOARD_HEIGHT; row++) {
    const visRow = row - HIDDEN_ROWS;
    for (let col = 0; col < 10; col++) {
      const cell = state.board[row][col];
      if (cell) drawCell(ctx, col, visRow, state.gold[row][col] ? skin.gold : skin.colors[cell], skin);
    }
  }

  // Ghost piece.
  if (opts.ghost && state.active && state.status === 'PLAYING') {
    const ghost = ghostPiece(state);
    if (ghost) {
      for (const [x, y] of pieceCells(ghost)) {
        const visRow = y - HIDDEN_ROWS;
        if (visRow >= 0) drawGhostCell(ctx, x, visRow, skin.colors[ghost.type]);
      }
    }
  }

  // Active piece (golden bonus pieces glow gold).
  if (state.active) {
    const color = state.activeGold ? skin.gold : skin.colors[state.active.type];
    for (const [x, y] of pieceCells(state.active)) {
      const visRow = y - HIDDEN_ROWS;
      if (visRow >= 0) drawCell(ctx, x, visRow, color, skin);
    }
  }

  // Line-clear animation: the cleared rows EXPLODE into fading fragments.
  if (state.clearing) {
    drawExplosion(ctx, state, skin);
  }
}

/** Deterministic per-fragment pseudo-random in [0,1) (stable across frames). */
function frag(seed: number): number {
  const x = Math.sin(seed) * 43758.5453;
  return x - Math.floor(x);
}

const FRAG_GRAVITY = 0.0035; // px/ms²

function drawExplosion(ctx: CanvasRenderingContext2D, state: GameState, skin: Skin): void {
  const clearing = state.clearing;
  if (!clearing) return;
  const { rows, elapsed, duration, perfectClear } = clearing;
  const t = Math.min(1, elapsed / duration);
  const half = CELL / 2;

  // Remove the solid cells of the cleared rows — they are bursting apart now.
  ctx.fillStyle = skin.background;
  for (const row of rows) {
    const visRow = row - HIDDEN_ROWS;
    if (visRow >= 0) ctx.fillRect(0, visRow * CELL, CANVAS_W, CELL);
  }

  // Bright impact flash at the very start.
  if (t < 0.4) {
    ctx.globalAlpha = 0.85 * (1 - t / 0.4);
    ctx.fillStyle = perfectClear ? '#ffe89a' : '#ffffff';
    for (const row of rows) {
      const visRow = row - HIDDEN_ROWS;
      if (visRow >= 0) ctx.fillRect(0, visRow * CELL, CANVAS_W, CELL);
    }
  }

  // Each original cell shatters into 4 fragments flying outward under gravity.
  for (const row of rows) {
    const visRow = row - HIDDEN_ROWS;
    if (visRow < 0) continue;
    for (let c = 0; c < 10; c++) {
      const cell = state.board[row][c];
      if (!cell) continue;
      const color = state.gold[row][c] ? skin.gold : skin.colors[cell];
      for (let f = 0; f < 4; f++) {
        const qx = f % 2;
        const qy = (f / 2) | 0;
        const seed = c * 131.1 + row * 57.7 + f * 19.3;
        const vx = (qx - 0.5) * 2 * (0.08 + frag(seed) * 0.14);
        const vy = -(0.12 + frag(seed + 1.7) * 0.2);
        const px = c * CELL + qx * half + half / 2 + vx * elapsed;
        const py =
          visRow * CELL + qy * half + half / 2 + vy * elapsed + 0.5 * FRAG_GRAVITY * elapsed * elapsed;
        const size = half * (1 - 0.35 * t);
        ctx.globalAlpha = Math.max(0, 1 - t);
        ctx.fillStyle = color;
        ctx.fillRect(px - size / 2, py - size / 2, size, size);
      }
    }
  }
  ctx.globalAlpha = 1;
}

/** The canvas element. Sizing/scaling is done by the game loop via the ref. */
export const Board = forwardRef<HTMLCanvasElement>((_props, ref) => {
  return (
    <canvas
      ref={ref}
      className={styles.board}
      style={{ width: CANVAS_W, height: CANVAS_H }}
      aria-label="Tetris playfield"
    />
  );
});
Board.displayName = 'Board';

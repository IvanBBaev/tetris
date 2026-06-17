import { SHAPES } from '../game/tetrominoes';
import type { PieceType } from '../game/types';
import styles from './MiniPiece.module.css';

const COLS = 4;
const ROWS = 2;

/** A small static preview of a piece in its spawn orientation (4×2 grid). */
export function MiniPiece({
  type,
  colors,
  dim = false,
}: {
  type: PieceType;
  colors: Record<PieceType, string>;
  dim?: boolean;
}) {
  const filled = new Set(SHAPES[type][0].map(([x, y]) => `${x},${y}`));
  const cells = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const on = filled.has(`${c},${r}`);
      cells.push(
        <div
          key={`${c},${r}`}
          className={styles.cell}
          style={on ? { background: colors[type], opacity: dim ? 0.4 : 1 } : undefined}
        />,
      );
    }
  }
  return <div className={styles.grid}>{cells}</div>;
}

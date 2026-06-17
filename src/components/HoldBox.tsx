import type { PieceType } from '../game/types';
import { MiniPiece } from './MiniPiece';
import styles from './Panel.module.css';

export function HoldBox({
  hold,
  canHold,
  colors,
}: {
  hold: PieceType | null;
  canHold: boolean;
  colors: Record<PieceType, string>;
}) {
  return (
    <section className={styles.panel}>
      <h2 className={styles.title}>Hold</h2>
      <div className={styles.holdSlot}>
        {hold ? (
          <MiniPiece type={hold} colors={colors} dim={!canHold} />
        ) : (
          <span className={styles.empty}>—</span>
        )}
      </div>
    </section>
  );
}

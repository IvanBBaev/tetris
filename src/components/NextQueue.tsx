import type { PieceType } from '../game/types';
import { MiniPiece } from './MiniPiece';
import styles from './Panel.module.css';

export function NextQueue({ next, colors }: { next: PieceType[]; colors: Record<PieceType, string> }) {
  return (
    <section className={styles.panel}>
      <h2 className={styles.title}>Next</h2>
      <div className={styles.queue}>
        {next.map((type, i) => (
          <MiniPiece key={i} type={type} colors={colors} />
        ))}
      </div>
    </section>
  );
}

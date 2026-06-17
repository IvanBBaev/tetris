import type { ClearEvent } from '../game/types';
import { clearLabel } from './clearText';
import styles from './Hud.module.css';

export function Hud({
  score,
  level,
  lines,
  highScore,
  combo,
  lastClear,
}: {
  score: number;
  level: number;
  lines: number;
  highScore: number;
  combo: number;
  lastClear: ClearEvent | null;
}) {
  const label = lastClear ? clearLabel(lastClear) : '';

  return (
    <section className={styles.hud}>
      <div className={styles.stat}>
        <span className={styles.label}>High</span>
        <span className={styles.value}>{highScore.toLocaleString()}</span>
      </div>
      <div className={styles.stat}>
        <span className={styles.label}>Score</span>
        <span className={styles.value}>{score.toLocaleString()}</span>
      </div>
      <div className={styles.statsRow}>
        <div className={styles.stat}>
          <span className={styles.label}>Level</span>
          <span className={styles.value}>{level}</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.label}>Lines</span>
          <span className={styles.value}>{lines}</span>
        </div>
      </div>

      <div className={styles.events}>
        {label && (
          <div key={`${label}-${score}`} className={styles.clear}>
            {lastClear && lastClear.b2bChain >= 2 && (
              <span className={styles.b2b}>B2B ×{lastClear.b2bChain - 1}</span>
            )}
            {lastClear?.gold && <span className={styles.gold}>★</span>}
            <span>{label}</span>
            {lastClear && lastClear.points > 0 && (
              <span className={styles.points}>+{lastClear.points.toLocaleString()}</span>
            )}
          </div>
        )}
        {lastClear?.perfectClear && (
          <div key={`pc-${score}`} className={styles.perfect}>
            PERFECT CLEAR
          </div>
        )}
        {combo > 0 && <div className={styles.combo}>Combo ×{combo}</div>}
      </div>
    </section>
  );
}

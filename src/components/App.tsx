import type { CSSProperties } from 'react';
import { SKINS, getSkin } from '../game/skins';
import type { PieceType } from '../game/types';
import type { TetrisControls } from '../hooks/useGameLoop';
import { useGameLoop, type HudState } from '../hooks/useGameLoop';
import type { Settings } from '../storage/persistence';
import styles from './App.module.css';
import { Board } from './Board';
import { HoldBox } from './HoldBox';
import { Hud } from './Hud';
import { NextQueue } from './NextQueue';

const PIECE_ORDER: PieceType[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];

const CONTROLS_HELP: Array<[string, string]> = [
  ['← →', 'Move'],
  ['↓', 'Soft drop'],
  ['Space', 'Hard drop'],
  ['↑ / X', 'Rotate CW'],
  ['Z / Ctrl', 'Rotate CCW'],
  ['C / Shift', 'Hold'],
  ['Esc / P', 'Pause'],
  ['M', 'Mute'],
];

export default function App() {
  const { hud, settings, canvasRef, popup, controls } = useGameLoop();
  const skin = getSkin(settings.skin);

  return (
    <div className={styles.app} style={{ '--accent': skin.accent } as CSSProperties}>
      <div className={styles.layout}>
        <aside className={styles.left}>
          <HoldBox hold={hud.hold} canHold={hud.canHold} colors={skin.colors} />
        </aside>

        <main className={styles.center}>
          <div className={styles.boardWrap}>
            <Board ref={canvasRef} />
            {popup && (
              <div
                key={popup.id}
                className={`${styles.popup} ${popup.perfect ? styles.popupPerfect : popup.gold ? styles.popupGold : ''}`}
                style={{ top: popup.y }}
              >
                {popup.label && <span className={styles.popupLabel}>{popup.label}</span>}
                <span className={styles.popupPoints}>+{popup.points.toLocaleString()}</span>
              </div>
            )}
            {hud.status === 'MENU' && (
              <MenuOverlay settings={settings} controls={controls} highScore={hud.highScore} />
            )}
            {hud.status === 'PAUSED' && <PauseOverlay controls={controls} />}
            {hud.status === 'GAME_OVER' && <GameOverOverlay hud={hud} controls={controls} />}
          </div>
        </main>

        <aside className={styles.right}>
          <NextQueue next={hud.next} colors={skin.colors} />
          <Hud
            score={hud.score}
            level={hud.level}
            lines={hud.lines}
            highScore={hud.highScore}
            combo={hud.combo}
            lastClear={hud.lastClear}
          />
          <section className={styles.help}>
            <h2 className={styles.helpTitle}>Controls</h2>
            <dl className={styles.helpList}>
              {CONTROLS_HELP.map(([key, action]) => (
                <div key={key} className={styles.helpRow}>
                  <dt>{key}</dt>
                  <dd>{action}</dd>
                </div>
              ))}
            </dl>
          </section>
        </aside>
      </div>
    </div>
  );
}

// ── Overlays ──────────────────────────────────────────────────────────

function Overlay({ children }: { children: React.ReactNode }) {
  return <div className={styles.overlay}>{children}</div>;
}

function MenuOverlay({
  settings,
  controls,
  highScore,
}: {
  settings: Settings;
  controls: TetrisControls;
  highScore: number;
}) {
  return (
    <Overlay>
      <h1 className={styles.brand}>TETRIS</h1>
      {highScore > 0 && <p className={styles.subtle}>High score: {highScore.toLocaleString()}</p>}

      <div className={styles.settings}>
        <label className={styles.field}>
          <span>Start level</span>
          <input
            type="number"
            min={1}
            max={15}
            value={settings.startLevel}
            onChange={(e) =>
              controls.updateSettings({
                startLevel: clamp(parseInt(e.target.value, 10) || 1, 1, 15),
              })
            }
          />
        </label>
        <label className={styles.field}>
          <span>DAS (ms)</span>
          <input
            type="number"
            min={0}
            max={500}
            value={settings.das}
            onChange={(e) => controls.updateSettings({ das: clamp(parseInt(e.target.value, 10) || 0, 0, 500) })}
          />
        </label>
        <label className={styles.field}>
          <span>ARR (ms)</span>
          <input
            type="number"
            min={0}
            max={200}
            value={settings.arr}
            onChange={(e) => controls.updateSettings({ arr: clamp(parseInt(e.target.value, 10) || 0, 0, 200) })}
          />
        </label>
        <label className={styles.toggle}>
          <input
            type="checkbox"
            checked={settings.ghost}
            onChange={(e) => controls.updateSettings({ ghost: e.target.checked })}
          />
          <span>Ghost piece</span>
        </label>
        <label className={styles.toggle}>
          <input
            type="checkbox"
            checked={settings.sound}
            onChange={(e) => controls.updateSettings({ sound: e.target.checked })}
          />
          <span>Sound</span>
        </label>

        <div className={styles.skinField}>
          <span className={styles.skinLabel}>Skin</span>
          <div className={styles.skinGrid}>
            {SKINS.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`${styles.skinBtn} ${settings.skin === s.id ? styles.skinBtnActive : ''}`}
                onClick={() => controls.updateSettings({ skin: s.id })}
              >
                <span className={styles.swatches}>
                  {PIECE_ORDER.map((p) => (
                    <i key={p} style={{ background: s.colors[p] }} />
                  ))}
                </span>
                <span className={styles.skinName}>{s.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <button className={styles.primary} onClick={() => controls.start(settings.startLevel)}>
        Play
      </button>
    </Overlay>
  );
}

function PauseOverlay({ controls }: { controls: TetrisControls }) {
  return (
    <Overlay>
      <h1 className={styles.brand}>Paused</h1>
      <button className={styles.primary} onClick={controls.togglePause}>
        Resume
      </button>
      <button className={styles.secondary} onClick={controls.toMenu}>
        Main menu
      </button>
    </Overlay>
  );
}

function GameOverOverlay({ hud, controls }: { hud: HudState; controls: TetrisControls }) {
  const isRecord = hud.score > 0 && hud.score >= hud.highScore;
  return (
    <Overlay>
      <h1 className={styles.brand}>Game Over</h1>
      <p className={styles.bigScore}>{hud.score.toLocaleString()}</p>
      {isRecord ? (
        <p className={styles.record}>New high score!</p>
      ) : (
        <p className={styles.subtle}>High score: {hud.highScore.toLocaleString()}</p>
      )}
      <button className={styles.primary} onClick={controls.restart}>
        Play again
      </button>
      <button className={styles.secondary} onClick={controls.toMenu}>
        Main menu
      </button>
    </Overlay>
  );
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

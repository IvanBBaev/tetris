import { useCallback, useEffect, useRef, useState } from 'react';
import { sfx, setSoundEnabled } from '../audio/sfx';
import { CANVAS_H, CANVAS_W, CELL, drawGame } from '../components/Board';
import { clearLabel } from '../components/clearText';
import {
  HIDDEN_ROWS,
  LOCK_DELAY_MS,
  SOFT_DROP_FACTOR,
  SOFT_DROP_POINTS_PER_CELL,
  gravityCellsPerMs,
} from '../game/constants';
import { getSkin } from '../game/skins';
import {
  beginLock,
  createInitialState,
  finalizeClear,
  hardDropToFloor,
  holdPiece,
  moveHorizontal,
  rotateActive,
  startGame,
  stepDown,
  togglePause,
  type GameState,
} from '../game/gameState';
import type { ClearEvent, GameStatus, PieceType } from '../game/types';
import {
  commitHighScore,
  loadSave,
  saveSettings,
  type SaveData,
  type Settings,
} from '../storage/persistence';
import { useInput } from './useInput';

/** Snapshot of state the React HUD renders. */
export interface HudState {
  status: GameStatus;
  score: number;
  level: number;
  lines: number;
  combo: number;
  b2b: boolean;
  next: PieceType[];
  hold: PieceType | null;
  canHold: boolean;
  lastClear: ClearEvent | null;
  highScore: number;
}

export interface TetrisControls {
  start: (level: number) => void;
  restart: () => void;
  toMenu: () => void;
  togglePause: () => void;
  updateSettings: (patch: Partial<Settings>) => void;
}

/** A floating "+points" flourish shown over the board after a clear. */
export interface Popup {
  id: number;
  label: string;
  points: number;
  /** Vertical position in logical board px (center of the cleared rows). */
  y: number;
  gold: boolean;
  perfect: boolean;
}

export interface UseGameLoop {
  hud: HudState;
  settings: Settings;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  popup: Popup | null;
  controls: TetrisControls;
}

const HUD_SYNC_INTERVAL_MS = 33; // ~30 Hz
const MAX_FRAME_DT_MS = 100; // clamp after tab-out / long stalls

function toHud(state: GameState, highScore: number): HudState {
  return {
    status: state.status,
    score: state.score,
    level: state.level,
    lines: state.lines,
    combo: state.combo,
    b2b: state.b2b,
    next: state.queue.slice(0, 5),
    hold: state.hold,
    canHold: state.canHold,
    lastClear: state.lastClear,
    highScore,
  };
}

function hudKey(h: HudState): string {
  return [
    h.status, h.score, h.level, h.lines, h.combo, h.b2b ? 1 : 0,
    h.next.join(''), h.hold ?? '-', h.canHold ? 1 : 0,
    h.lastClear?.points ?? -1, h.lastClear?.tspin ?? '-', h.lastClear?.lines ?? -1,
    h.lastClear?.perfectClear ? 1 : 0, h.highScore,
  ].join('|');
}

export function useGameLoop(): UseGameLoop {
  // Read persisted save once (not on every render — renders run ~30 Hz).
  const initialSaveRef = useRef<SaveData>();
  const initialSave = (initialSaveRef.current ??= loadSave());

  const stateRef = useRef<GameState>(createInitialState(initialSave.settings.startLevel));
  const settingsRef = useRef<Settings>(initialSave.settings);
  const highScoreRef = useRef<number>(initialSave.highScore);

  const [settings, setSettings] = useState<Settings>(initialSave.settings);
  const [hud, setHud] = useState<HudState>(() => toHud(stateRef.current, initialSave.highScore));

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

  // DAS/ARR + HUD-throttle timers (per-frame, never trigger renders).
  const dasTimer = useRef(0);
  const arrTimer = useRef(0);
  const lastDir = useRef(0);
  const hudAcc = useRef(0);
  const hudKeyRef = useRef('');
  const gameOverHandledRef = useRef(false);
  const shakeRef = useRef({ elapsed: 0, duration: 0, mag: 0 });

  const [popup, setPopup] = useState<Popup | null>(null);
  const popupIdRef = useRef(0);

  // ── HUD sync (throttled, change-gated) ──
  const syncHud = useCallback((force = false) => {
    const next = toHud(stateRef.current, highScoreRef.current);
    const key = hudKey(next);
    if (!force && key === hudKeyRef.current) return;
    hudKeyRef.current = key;
    setHud(next);
  }, []);

  // ── Lock the active piece, fire SFX, handle level-up ──
  // (Game over is handled centrally in the frame loop so every top-out path —
  // including a hold-swap top-out — commits the high score and plays the SFX.)
  const commitLock = useCallback((s: GameState): GameState => {
    const prevLevel = s.level;
    const result = beginLock(s);
    const ev = result.lastClear;
    if (ev && ev.lines > 0) {
      if (ev.tspin !== 'none') sfx.onTSpin();
      else if (ev.lines === 4) sfx.onTetris();
      else sfx.onLineClear(ev.lines);
      if (ev.perfectClear) sfx.onPerfectClear();

      // Screen shake scaled to how big the clear is.
      const mag = ev.perfectClear ? 16 : ev.lines === 4 ? 11 : ev.tspin !== 'none' ? 8 : ev.gold ? 7 : 0;
      if (mag > 0) shakeRef.current = { elapsed: 0, duration: 360, mag };

      // Floating "+points" flourish centered on the cleared rows.
      const rows = result.clearing?.rows ?? [];
      const avgRow = rows.length ? rows.reduce((a, b) => a + b, 0) / rows.length : HIDDEN_ROWS + 10;
      setPopup({
        id: ++popupIdRef.current,
        label: clearLabel(ev),
        points: ev.points,
        y: (avgRow - HIDDEN_ROWS) * CELL + CELL / 2,
        gold: ev.gold,
        perfect: ev.perfectClear,
      });
    } else {
      sfx.onLock();
    }
    if (result.level > prevLevel) sfx.onLevelUp();
    return result;
  }, []);

  // ── Settings & lifecycle controls ──
  const updateSettings = useCallback((patch: Partial<Settings>) => {
    const next = { ...settingsRef.current, ...patch };
    settingsRef.current = next;
    setSettings(next);
    saveSettings(next);
    if (patch.sound !== undefined) setSoundEnabled(patch.sound);
  }, []);

  const start = useCallback(
    (level: number) => {
      stateRef.current = startGame(createInitialState(level, Math.random));
      dasTimer.current = 0;
      arrTimer.current = 0;
      lastDir.current = 0;
      gameOverHandledRef.current = false;
      setPopup(null); // don't inherit the previous game's flourish
      syncHud(true);
    },
    [syncHud],
  );

  const restart = useCallback(() => start(settingsRef.current.startLevel), [start]);

  const toMenu = useCallback(() => {
    stateRef.current = { ...stateRef.current, status: 'MENU' };
    setPopup(null);
    syncHud(true);
  }, [syncHud]);

  const pause = useCallback(() => {
    stateRef.current = togglePause(stateRef.current);
    syncHud(true);
  }, [syncHud]);

  // ── Discrete input handlers (mutate the ref between frames) ──
  const heldRef = useInput({
    onRotateCW: () => {
      const next = rotateActive(stateRef.current, 1);
      if (next !== stateRef.current) {
        stateRef.current = next;
        sfx.onRotate();
      }
    },
    onRotateCCW: () => {
      const next = rotateActive(stateRef.current, -1);
      if (next !== stateRef.current) {
        stateRef.current = next;
        sfx.onRotate();
      }
    },
    onHardDrop: () => {
      const s = stateRef.current;
      if (s.status !== 'PLAYING' || !s.active) return;
      sfx.onHardDrop();
      stateRef.current = commitLock(hardDropToFloor(s));
      syncHud();
    },
    onHold: () => {
      const next = holdPiece(stateRef.current);
      if (next !== stateRef.current) {
        stateRef.current = next;
        sfx.onHold();
        syncHud();
      }
    },
    onPause: () => pause(),
    onToggleSound: () => updateSettings({ sound: !settingsRef.current.sound }),
    onRestart: () => {
      if (stateRef.current.status === 'GAME_OVER') start(settingsRef.current.startLevel);
    },
  });

  // ── Per-frame update ──
  const step = useCallback(
    (dt: number) => {
      const held = heldRef.current;

      const handleHorizontal = (st: GameState, delta: number): GameState => {
        const dir = held.right && !held.left ? 1 : held.left && !held.right ? -1 : 0;
        if (dir !== lastDir.current) {
          lastDir.current = dir;
          dasTimer.current = 0;
          arrTimer.current = 0;
          if (dir !== 0) {
            const moved = moveHorizontal(st, dir);
            if (moved !== st) {
              sfx.onMove();
              return moved;
            }
          }
          return st;
        }
        if (dir === 0) return st;

        dasTimer.current += delta;
        if (dasTimer.current < settingsRef.current.das) return st;

        arrTimer.current += delta;
        const arr = Math.max(1, settingsRef.current.arr);
        let cur = st;
        while (arrTimer.current >= arr) {
          arrTimer.current -= arr;
          const moved = moveHorizontal(cur, dir);
          if (moved === cur) {
            arrTimer.current = 0; // hit a wall — stop repeating
            break;
          }
          cur = moved;
          sfx.onMove();
        }
        return cur;
      };

      const applyGravity = (st: GameState, delta: number): GameState => {
        const mult = held.softDrop ? SOFT_DROP_FACTOR : 1;
        let acc = st.gravityAcc + gravityCellsPerMs(st.level) * mult * delta;
        const whole = Math.floor(acc);
        acc -= whole;
        let cur: GameState = { ...st, gravityAcc: acc };
        let steps = whole;
        while (steps-- > 0) {
          const { state: ns, moved } = stepDown(cur);
          if (!moved) break;
          cur = held.softDrop ? { ...ns, score: ns.score + SOFT_DROP_POINTS_PER_CELL } : ns;
        }
        return cur;
      };

      const applyLockDelay = (st: GameState, delta: number): GameState => {
        if (!st.active || !st.grounded) return st;
        const lockTimer = st.lockTimer + delta;
        if (lockTimer >= LOCK_DELAY_MS) return commitLock(st);
        return { ...st, lockTimer };
      };

      let s = stateRef.current;
      if (s.status === 'PLAYING') {
        if (s.clearing) {
          // Line-clear animation in progress: advance it, then finalize.
          const elapsed = s.clearing.elapsed + dt;
          s = elapsed >= s.clearing.duration
            ? finalizeClear(s)
            : { ...s, clearing: { ...s.clearing, elapsed } };
        } else {
          s = handleHorizontal(s, dt);
          s = applyGravity(s, dt);
          s = applyLockDelay(s, dt);
        }
        stateRef.current = s;
      }
    },
    [commitLock, heldRef],
  );

  // ── Canvas setup (DPR-aware) + initial sound state ──
  useEffect(() => {
    setSoundEnabled(settingsRef.current.sound);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(CANVAS_W * dpr);
    canvas.height = Math.round(CANVAS_H * dpr);
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctxRef.current = ctx;
    }
  }, []);

  // ── rAF loop ──
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(now - last, MAX_FRAME_DT_MS);
      last = now;

      step(dt);

      // Centralized game-over handling (fires once per game, any top-out path).
      if (stateRef.current.status === 'GAME_OVER' && !gameOverHandledRef.current) {
        gameOverHandledRef.current = true;
        sfx.onGameOver();
        highScoreRef.current = commitHighScore(stateRef.current.score);
        syncHud(true);
      }

      if (ctxRef.current) {
        drawGame(ctxRef.current, stateRef.current, {
          ghost: settingsRef.current.ghost,
          skin: getSkin(settingsRef.current.skin),
        });
      }

      // Screen shake: jitter the canvas element, decaying to rest.
      const canvas = canvasRef.current;
      if (canvas) {
        const sh = shakeRef.current;
        if (sh.mag > 0) {
          sh.elapsed += dt;
          const p = sh.elapsed / sh.duration;
          if (p >= 1) {
            sh.mag = 0;
            canvas.style.transform = '';
          } else {
            const d = (1 - p) * sh.mag;
            canvas.style.transform = `translate(${(Math.random() * 2 - 1) * d}px, ${(Math.random() * 2 - 1) * d}px)`;
          }
        }
      }

      hudAcc.current += dt;
      if (hudAcc.current >= HUD_SYNC_INTERVAL_MS) {
        hudAcc.current = 0;
        syncHud();
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [step, syncHud]);

  return {
    hud,
    settings,
    canvasRef,
    popup,
    controls: { start, restart, toMenu, togglePause: pause, updateSettings },
  };
}

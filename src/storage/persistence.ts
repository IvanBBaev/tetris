import { DEFAULT_ARR_MS, DEFAULT_DAS_MS } from '../game/constants';
import { DEFAULT_SKIN_ID } from '../game/skins';

const STORAGE_KEY = 'tetris:save';

export interface Settings {
  /** Delayed Auto Shift (ms held before auto-repeat). */
  das: number;
  /** Auto Repeat Rate (ms between repeats). */
  arr: number;
  /** Starting level (1+). */
  startLevel: number;
  /** Show the ghost piece. */
  ghost: boolean;
  /** Sound effects on/off. */
  sound: boolean;
  /** Active visual skin id (see game/skins.ts). */
  skin: string;
}

export interface SaveData {
  highScore: number;
  settings: Settings;
}

export const DEFAULT_SETTINGS: Settings = {
  das: DEFAULT_DAS_MS,
  arr: DEFAULT_ARR_MS,
  startLevel: 1,
  ghost: true,
  sound: true,
  skin: DEFAULT_SKIN_ID,
};

const DEFAULT_SAVE: SaveData = {
  highScore: 0,
  settings: DEFAULT_SETTINGS,
};

/** localStorage may be unavailable (SSR, sandboxed env, privacy mode). */
function getStorage(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    // Probe — some environments throw on access.
    const probe = '__tetris_probe__';
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return localStorage;
  } catch {
    return null;
  }
}

export function loadSave(): SaveData {
  const storage = getStorage();
  if (!storage) return { ...DEFAULT_SAVE, settings: { ...DEFAULT_SETTINGS } };
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SAVE, settings: { ...DEFAULT_SETTINGS } };
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    return {
      highScore: typeof parsed.highScore === 'number' ? parsed.highScore : 0,
      settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
    };
  } catch {
    return { ...DEFAULT_SAVE, settings: { ...DEFAULT_SETTINGS } };
  }
}

export function saveData(data: SaveData): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Ignore quota / serialization errors — persistence is best-effort.
  }
}

export function saveSettings(settings: Settings): void {
  const current = loadSave();
  saveData({ ...current, settings });
}

/** Persist a new high score only if it beats the stored one. Returns the kept value. */
export function commitHighScore(score: number): number {
  const current = loadSave();
  if (score > current.highScore) {
    saveData({ ...current, highScore: score });
    return score;
  }
  return current.highScore;
}

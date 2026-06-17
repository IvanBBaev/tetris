import { COLORS, GOLD_COLOR } from './constants';
import type { PieceType } from './types';

/** How a single cell is painted. */
export type CellStyle = 'bevel' | 'flat' | 'outline';

export interface Skin {
  id: string;
  name: string;
  /** The 7 tetromino colors. */
  colors: Record<PieceType, string>;
  /** Color of golden bonus blocks. */
  gold: string;
  /** Canvas background. */
  background: string;
  /** Grid line color (rgba). */
  grid: string;
  /** Cell border color (rgba). */
  border: string;
  /** UI accent (drives `--accent` for the chrome). */
  accent: string;
  style: CellStyle;
}

export const SKINS: Skin[] = [
  {
    id: 'classic',
    name: 'Classic',
    colors: { ...COLORS },
    gold: GOLD_COLOR,
    background: '#0b0d17',
    grid: 'rgba(255,255,255,0.05)',
    border: 'rgba(0,0,0,0.45)',
    accent: '#4cc2ff',
    style: 'bevel',
  },
  {
    id: 'neon',
    name: 'Neon',
    colors: { I: '#18f0ff', O: '#fff23a', T: '#c64bff', S: '#4dff5a', Z: '#ff3b6b', J: '#3b7bff', L: '#ff8a1e' },
    gold: '#ffd54a',
    background: '#05060a',
    grid: 'rgba(120,200,255,0.07)',
    border: 'rgba(0,0,0,0.55)',
    accent: '#18f0ff',
    style: 'bevel',
  },
  {
    id: 'pastel',
    name: 'Pastel',
    colors: { I: '#8ed6e0', O: '#f3e09b', T: '#c9a0dc', S: '#a8e6a3', Z: '#f4a6a6', J: '#9fb4e6', L: '#f3c08b' },
    gold: '#f6d68a',
    background: '#1b1d2a',
    grid: 'rgba(255,255,255,0.06)',
    border: 'rgba(0,0,0,0.22)',
    accent: '#b8a6e6',
    style: 'flat',
  },
  {
    id: 'mono',
    name: 'Mono',
    colors: { I: '#ffffff', O: '#d6d6d6', T: '#aeaeae', S: '#8a8a8a', Z: '#bcbcbc', J: '#cfcfcf', L: '#9a9a9a' },
    gold: '#ffe27a',
    background: '#0c0c0c',
    grid: 'rgba(255,255,255,0.06)',
    border: 'rgba(255,255,255,0.55)',
    accent: '#e8e8e8',
    style: 'outline',
  },
  {
    id: 'gameboy',
    name: 'Game Boy',
    colors: { I: '#9bbc0f', O: '#8bac0f', T: '#6b8c1a', S: '#4f7a12', Z: '#306230', J: '#5f8f2a', L: '#7faf1f' },
    gold: '#e0f8d0',
    background: '#0f380f',
    grid: 'rgba(155,188,15,0.10)',
    border: 'rgba(15,56,15,0.85)',
    accent: '#9bbc0f',
    style: 'flat',
  },
  {
    id: 'vaporwave',
    name: 'Vaporwave',
    colors: { I: '#2de2e6', O: '#fff07c', T: '#ff6ec7', S: '#61ffca', Z: '#ff3860', J: '#8c61ff', L: '#ff9f45' },
    gold: '#ffd700',
    background: '#160d2e',
    grid: 'rgba(255,110,199,0.08)',
    border: 'rgba(0,0,0,0.40)',
    accent: '#ff6ec7',
    style: 'bevel',
  },
];

export const DEFAULT_SKIN_ID = 'classic';

const BY_ID = new Map(SKINS.map((s) => [s.id, s]));

/** Look up a skin by id, falling back to the default. */
export function getSkin(id: string | undefined): Skin {
  return (id && BY_ID.get(id)) || BY_ID.get(DEFAULT_SKIN_ID)!;
}

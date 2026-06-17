import type { ClearEvent } from '../game/types';

const LINE_NAMES = ['', 'Single', 'Double', 'Triple', 'Tetris'];

/** Human label for a clear event, e.g. "Tetris", "T-Spin Double", "S-Spin". */
export function clearLabel(ev: ClearEvent): string {
  if (ev.tspin !== 'none' && ev.spinPiece) {
    const mini = ev.tspin === 'mini' ? ' Mini' : '';
    const lines = ev.lines > 0 ? ` ${LINE_NAMES[ev.lines]}` : '';
    return `${ev.spinPiece}-Spin${mini}${lines}`;
  }
  if (ev.lines > 0) return LINE_NAMES[ev.lines];
  return '';
}

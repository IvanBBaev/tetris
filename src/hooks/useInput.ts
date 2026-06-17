import { useEffect, useRef } from 'react';

/** Continuous keys read each frame by the game loop for DAS/ARR & soft drop. */
export interface HeldKeys {
  left: boolean;
  right: boolean;
  softDrop: boolean;
}

/** One-shot actions fired on key press (no auto-repeat). */
export interface InputHandlers {
  onRotateCW: () => void;
  onRotateCCW: () => void;
  onHardDrop: () => void;
  onHold: () => void;
  onPause: () => void;
  onToggleSound: () => void;
  onRestart: () => void;
}

// Keys whose default browser behavior (scrolling) we must suppress.
const PREVENT_DEFAULT = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space']);

/**
 * Keyboard input (§14). Held movement keys are tracked in a ref so the game
 * loop can implement DAS/ARR itself; discrete actions fire their handlers once
 * per physical press. We never rely on the OS key-repeat.
 */
export function useInput(handlers: InputHandlers): React.MutableRefObject<HeldKeys> {
  const held = useRef<HeldKeys>({ left: false, right: false, softDrop: false });
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (PREVENT_DEFAULT.has(e.code)) e.preventDefault();
      const h = handlersRef.current;
      switch (e.code) {
        case 'ArrowLeft':
          held.current.left = true;
          break;
        case 'ArrowRight':
          held.current.right = true;
          break;
        case 'ArrowDown':
          held.current.softDrop = true;
          break;
        case 'Space':
          if (!e.repeat) h.onHardDrop();
          break;
        case 'ArrowUp':
        case 'KeyX':
          if (!e.repeat) h.onRotateCW();
          break;
        case 'KeyZ':
        case 'ControlLeft':
        case 'ControlRight':
          if (!e.repeat) h.onRotateCCW();
          break;
        case 'KeyC':
        case 'ShiftLeft':
        case 'ShiftRight':
          if (!e.repeat) h.onHold();
          break;
        case 'Escape':
        case 'KeyP':
          if (!e.repeat) h.onPause();
          break;
        case 'KeyM':
          if (!e.repeat) h.onToggleSound();
          break;
        case 'Enter':
          if (!e.repeat) h.onRestart();
          break;
        default:
          break;
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'ArrowLeft':
          held.current.left = false;
          break;
        case 'ArrowRight':
          held.current.right = false;
          break;
        case 'ArrowDown':
          held.current.softDrop = false;
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  return held;
}

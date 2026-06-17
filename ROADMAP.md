# Roadmap — Tetris

Guideline-compliant Tetris (React 18 + TypeScript + Vite). This file tracks what is
done and what is planned. See `CLAUDE.md` for architecture and `WORKLOG.md` for the
detailed change log.

Legend: `[x]` shipped · `[ ]` planned.

## Status — shipped (v0.1)

**Core (all spec §17 acceptance criteria met):**
- [x] SRS rotation with the exact wall-kick tables; 7-bag randomizer
- [x] Hold (once per piece); ghost piece
- [x] Delta-timed gravity; soft/hard drop scoring; lock delay with 15-reset limit
- [x] Line clear; scoring; level & line goal; next queue (5)
- [x] T-spin (full + mini, 3-corner + kick override); Back-to-Back; combo
- [x] DAS/ARR (configurable); pause / game over / restart
- [x] High score + settings persistence (localStorage, feature-guarded)
- [x] Pure, React-free game logic with 48 unit tests + an SSR smoke test;
      `typecheck` and `build` clean

**Added on top of the spec:**
- [x] Line-clear **explosion** animation (per-cell particle burst)
- [x] Bonuses: **Perfect Clear**, escalating **Back-to-Back**, **golden blocks**, **All-Spin**
- [x] Juice: screen shake + floating "+points" flourish
- [x] 6 visual **skins** (Classic / Neon / Pastel / Mono / Game Boy / Vaporwave)

## Near-term (high value, low risk)

- [ ] **Reduced motion** — respect `prefers-reduced-motion` and add a setting to
      disable the explosion + screen shake. We added a lot of motion; make it opt-out.
- [ ] **Colorblind support** — a high-contrast / patterned skin or per-piece glyphs.
- [ ] **Keybinding remap UI** — bindings are currently hardcoded in `useInput`
      (only DAS/ARR are configurable); expose a remap panel in settings.
- [ ] In-game / pause-screen settings (skin is menu-only today).
- [ ] **Audio pass** — volume control, richer SFX, optional background music
      (current `sfx.ts` is a minimal Web Audio synth).
- [ ] Micro-animations: hold/next swap, level-up transition; clear-flash tuning.

## Mid-term

- [ ] **Game modes** — Sprint (40 lines, timed), Ultra (2 min), Marathon (end at L15),
      Zen (endless, no top-out). Currently only marathon/endless.
- [ ] **Stats** — PPS / APM / finesse; per-mode personal bests and session summary.
- [ ] **Handling options** — DAS-cut on direction change, 180° rotation key,
      lock-out vs. infinite-placement toggle.
- [ ] **Mobile / touch** (spec §21, deliberately skipped for desktop-only v0.1) —
      responsive canvas + on-screen buttons and/or swipe gestures.

## Long-term / exploratory

These were **explicit non-goals in the spec (§22)** — pursue only on request:
- [ ] **Replays** — the seeded-RNG design already allows deterministic playback.
- [ ] Online leaderboards (beyond the local high score).
- [ ] Custom skin editor.
- [ ] Multiplayer / versus with garbage lines.

## Tech / infra

- [ ] `git init` + add AI files to `.git/info/exclude` (CLAUDE.md, WORKLOG.md, .claude/)
      before any first commit. Not a git repo yet.
- [ ] Document/enforce the toolchain: add `"engines": { "node": ">=18" }` to
      `package.json` (system Node is v12 and breaks Vite/Vitest).
- [ ] ESLint + Prettier config; CI (typecheck + test on push).
- [ ] Static deploy (GitHub Pages / Vercel) — the build is a self-contained bundle.
- [ ] Playwright e2e for the play loop (used ad-hoc during dev; not committed).

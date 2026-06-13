# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Hong Zhong Mahjong (红中麻将) -- a single-player vs 3 AI opponents browser game. Pure vanilla JavaScript with Canvas 2D rendering. No frameworks, no build tools, no dependencies. Runs by opening `index.html` directly in a browser.

## Running the Game

```bash
# Serve via HTTP (required for full functionality)
npx serve .
# or
python -m http.server 8000
# Then open http://localhost:8000

# Quick test (no browser): verify all modules load without errors
node _test_load.js
```

There is no build step, no package.json, no linter, no test framework. `_test_load.js` is a Node.js smoke test that mocks the DOM and loads all modules in order.

## Architecture

### Module System

All modules use the **IIFE pattern** exposing globals on `window`:
```js
window.ModuleName = (function() { ... return { ... }; })();
```
Modules are loaded via `<script>` tags in `index.html` in this specific dependency order:

```
ai-module.js -> audio-module.js -> constants.js -> tiles.js -> game-state.js ->
hu-detection.js -> scoring.js -> actions.js -> ai-bridge.js ->
renderer.js -> game-flow.js -> ui.js -> main.js
```

### Tile Encoding (Critical)

Two separate encoding systems coexist and are bridged by `ai-bridge.js`:

| Tile       | Main Game (IDs) | AI Module (hex) |
|------------|-----------------|-----------------|
| Wan 1-9    | 1-9             | 0x10-0x19       |
| Tiao 1-9   | 10-18           | 0x20-0x28       |
| Tong 1-9   | 19-27           | 0x30-0x38       |
| Hong Zhong | 30              | 0x41            |

All calls to `AIModule.*` must go through `AIBridge` in `ai-bridge.js` for automatic conversion. Never call `AIModule` functions directly from game code.

### Key Modules

- **`game-state.js`**: Central `window.state` object. Phases: `idle` -> `playerTurn`/`aiTurn` -> `gameOver`. Turn phases: `draw` -> `discard` -> `response`.
- **`game-flow.js`**: Orchestrates the entire game loop. Turn order: South(0) -> West(2) -> North(1) -> East(3). Uses `_setTimer()` wrapper for all `setTimeout` calls with tracking/cleanup. Safety timers (5s) prevent hangs.
- **`hu-detection.js`**: Recursive backtracking for win detection (4 melds + 1 pair) with full wild card (Hong Zhong) support. Special hands: Seven Pairs, Dragon Seven Pairs, All Triplets, Full Flush.
- **`scoring.js`**: Fan calculation. Base 10 x total fan. Hong Zhong is wild card (+1 fan bonus when used as substitute).
- **`actions.js`**: `performHu`, `performPeng`, `performGang`, `checkQiangGangHu`.
- **`ai-module.js`**: Standalone AI with three difficulty levels (Easy/Medium/Hard). Uses shanten calculation and ukeire optimization on Hard.
- **`renderer.js`**: Canvas 2D with DPI-aware scaling. Portrait-only layout scaled to 375x750 base. Tiles drawn programmatically (not images).
- **`audio-module.js`**: Web Audio API synthesized sounds, no external files.

### Response Priority

When multiple players can respond to a discard: **Hu > Gang > Peng > Pass**. This is enforced in `game-flow.js`.

### Key Game Rules (Hong Zhong Variant)

- 112 tiles (27 suits x 4 + 4 Hong Zhong)
- Hong Zhong is a **wild card** (substitutes any tile for winning)
- Hong Zhong **cannot be discarded** (enforced in `playerDiscard()`)
- No chi (sequence claiming) allowed
- Win requires at least 1 Hong Zhong in hand (enforced in `canHu()`)
- Dealer gets 14 tiles, others get 13

### Rendering Layout

Portrait-only, responsive via `scale = min(W/375, H/750)`. Player is South (bottom), AI opponents are North (top), West (left), East (right). Discard piles rotate per player: South 0deg, North 180deg, West 90deg, East -90deg.

## Design Documents

- `docs/design.md` -- Full game rules, scoring, AI design, UI flow
- `docs/art.md` -- Visual design spec (colors, layout, animations, sound)
- `docs/bug-report.md` -- Prioritized bug list
- `docs/rule-check.md` -- Rule compliance audit checklist

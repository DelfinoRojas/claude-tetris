# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the project

- No build, no install, no tests, no linter — there is no `package.json` and nothing to compile.
- Run by opening `index.html` directly (`start index.html` on Windows), or serve statically
  (`python3 -m http.server 8000`, `npx serve .`) and open `http://localhost:8000`.
- "Testing a change" means loading the page in a browser and playing; there is no test runner
  to add a case to.

## Architecture

- `game.js` is a single classic script (`<script src="game.js">`, not a module). Everything
  lives in one top-level scope: mutable game state in the module-level `let` on `game.js:43`
  (`board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum,
  dropInterval, animId`), DOM handles cached as `const` above it. Adding a `type="module"` or
  a second script would break the shared-scope assumption.
- `init()` (`game.js:259`) is both boot and restart — it is called at file end and wired to
  `#restart-btn`. Any new resettable state must be reset there, not just declared.
- Game loop `loop()` (`game.js:243`) is `requestAnimationFrame` + a `dropAccum` accumulator
  compared against `dropInterval`. Pause cancels the frame and `togglePause()` re-seeds
  `lastTime = performance.now()` before resuming, so the paused wall-clock time does not
  arrive as one huge `dt`. Preserve that when touching pause/resume.
- Rendering is a full redraw per frame into `#board`: `drawGrid()` → settled board → ghost →
  current piece. All of it goes through `drawBlock()` (`game.js:159`), which takes cell
  coordinates plus a cell `size`, so the same function serves both the 30px board and the
  next-piece preview. Reuse it rather than writing new `fillRect` code.

## Key invariants (the part that bites)

- **A piece's type index is also its color index and its cell value.** `PIECES[3]` is the T
  piece, its matrix is filled with the literal `3`, `COLORS[3]` is its color, and `3` is what
  `merge()` writes into `board`. `0` means empty everywhere. Adding a piece means appending to
  *both* `PIECES` and `COLORS` at the same index, filling the new matrix with that index, and
  widening the `Math.random() * 7` in `randomPiece()` (`game.js:50`).
- **Canvas sizes are hardcoded in HTML and must match the JS constants.** `#board` is
  `width="300" height="600"` = `COLS*BLOCK` × `ROWS*BLOCK`; changing `COLS`, `ROWS` or `BLOCK`
  in `game.js` requires editing `index.html:12`. `#next-canvas` is 120×120, which assumes the
  4×4 grid at `NB = 30` that `drawNext()` centers into.
- **Rotation is not SRS.** `rotateCW()` is transpose+reverse on the piece's own square matrix,
  and `tryRotate()` tries horizontal kicks `[0, -1, 1, -2, 2]` only — no wall-kick tables, no
  rotation state. Don't describe or extend it as if it were SRS without actually implementing
  one.
- **No vanish zone / lock delay.** Pieces spawn at `y = 0` and `lockPiece()` fires the moment a
  downward move collides. `collide()` deliberately tolerates `ny < 0` so an off-top row is not
  a collision.

## Conventions

- All user-facing strings (overlay text, README, HTML copy) are in Spanish; comments are
  Spanish or English. Keep new UI strings Spanish to match.
- `'use strict'` at the top of `game.js`; ES6+ browser syntax used directly, no transpiling —
  so anything written must run as-is in a modern browser.
- CSS uses a fixed dark palette written as literal hex values (no custom properties); the
  accent blue `#7aa2f7` and the piece colors in `COLORS` are independent, so a palette change
  touches both files.

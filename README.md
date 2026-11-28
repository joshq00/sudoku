# Sudoku

A fast, offline-capable Sudoku for phones and desktop. Unlimited puzzles at three
difficulty levels, with notes, auto-candidates, error highlighting and explained hints.
No build step and no dependencies at runtime: plain HTML, CSS and JavaScript.

## Features

- **Easy / Medium / Hard.** Tapping a level starts a new puzzle. There is no daily cap.
  Every puzzle has exactly one solution and can be solved by logic alone (no guessing).
  - Easy: singles only. Medium: adds locked candidates and pairs.
    Hard: needs triples, X-Wing, XY-Wing or Swordfish.
- **Notes:** manual pencil marks, **Auto** (fill every candidate), **Trim** (remove stale
  notes, in the settings menu) and **auto-clean** (placing a digit clears it from the notes
  in its row, column and box).
- **Hints (`?`):** the first tap explains the next step and highlights the cells involved
  (yellow = the pattern, red = candidates to remove); the second tap applies it. If you make
  the move yourself, the same hint is not offered again.
- **Errors** are highlighted and counted. **Undo / redo** show what changed.
- **Settings (gear):** light / dark / auto theme, error display, auto-clean, highlights.
  Preferences are saved in `localStorage`.
- **Resumes where you left off:** the board, notes, undo history, timer and settings are saved in
  `localStorage` after every move. Closing the app and reopening it restores the game; a solved
  puzzle is not resumed. A `?seed=` link opens that puzzle (keeping your progress if it is the
  one you were already on).
- **Installable:** works as a home-screen app on iOS and Android and runs offline.

## Project layout

```
index.html              page markup + PWA tags
css/styles.css          all styles (CSS variables, light/dark themes)
js/solver.js            board geometry, generator, logic solver / difficulty grader (no DOM)
js/game.js              game state, rendering, input, notes tools
js/hints.js             hint engine (singles and advanced techniques)
js/history.js           undo / redo and the "what changed" flash
js/ui.js                keyboard, pause, settings menu, theme, saved preferences
js/main.js              starts the first game (loaded last)
sw.js, manifest.webmanifest, icons/    offline support and installability
tests/                  Playwright tests (logic, gameplay, layout, PWA)
```

The scripts are classic (non-module) scripts that share globals, and load in the order
listed in `index.html`. Tests rely on these globals (`S`, `sel`, `HX`, `start`, `generate`...).

## Run locally

```bash
npm install
npm start            # http://localhost:4173
```

## Tests

```bash
npx playwright install chromium   # first time only
npm test
```

The suite runs on desktop plus Pixel 7, iPhone 13 and a short 360x560 Android screen
(Chromium emulation). Set `CHROMIUM_PATH` to use an already-installed Chromium.
Generation/solver tests run once (desktop only) since they are pure logic.

Formatting uses Prettier: `npm run format` / `npm run format:check`.

## Deploy to GitHub Pages

1. Create a repository and push this folder to `main`.
2. In **Settings → Pages**, set **Source** to **GitHub Actions**.
3. The workflow in `.github/workflows/pages.yml` runs the tests and publishes the site at
   `https://<user>.github.io/<repo>/`. All paths are relative, so a project subpath works.

## Add to Home Screen

- **iPhone (Chrome or Safari):** Share → **Add to Home Screen**. It opens full-screen using
  `apple-touch-icon` and the manifest.
- **Android (Chrome):** menu → **Install app** / **Add to Home screen**.

## Caching

Every deploy is cache-busted automatically: `scripts/stamp.js` (run by the workflow) adds
`?v=<commit hash>` to all CSS/JS links and puts the hash in the service worker's cache
name. The service worker is network-first (always revalidates), so it only serves cached
files when you are offline. The tiny line at the bottom of the page is the commit time
and hash of what you are running (`dev build` when run locally).

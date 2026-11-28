/** Entry point: runs last, once every other script has loaded. */
// 1. A shared link like ?seed=M-7K3F2Q opens that puzzle (resuming it if it is the one you were on).
// 2. Otherwise, pick up the saved game if there is one.
// 3. Otherwise, start a new random puzzle.
const linked = parseSeed(new URLSearchParams(location.search).get('seed'));
if (linked) {
  if (!resumeGame(linked.seed)) {
    setDiff(linked.difficulty);
    newGame(linked.seed);
  }
} else if (!resumeGame()) {
  newGame();
}

// Save when the app is backgrounded or closed (the page may not get another chance).
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') saveGame();
});
addEventListener('pagehide', saveGame);

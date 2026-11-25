/** Entry point: runs last, once every other script has loaded. */
// A shared link like ?seed=M-7K3F2Q opens that exact puzzle; otherwise start a random one.
const linked = parseSeed(new URLSearchParams(location.search).get('seed'));
if (linked) {
  setDiff(linked.difficulty);
  newGame(linked.seed);
} else {
  newGame();
}

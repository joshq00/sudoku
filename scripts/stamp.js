#!/usr/bin/env node
/**
 * Stamps a built copy of the site with the commit it was built from.
 *
 *   node scripts/stamp.js <siteDir>
 *
 * What it does (all inside <siteDir>, the source files are never touched):
 *   - index.html: fills the tiny footer with the commit time and short hash
 *   - index.html: adds ?v=<hash> to every css/ and js/ file, so browsers can never
 *     mix a new page with old styles or scripts (cache busting)
 *   - sw.js: puts the hash in the cache name, so every deploy installs a fresh
 *     service worker and throws away the old cache
 *
 * COMMIT_TIME / COMMIT_SHA can be set to override what git reports (used by tests).
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const dir = process.argv[2];
if (!dir) {
  console.error('usage: node scripts/stamp.js <siteDir>');
  process.exit(1);
}

const git = (cmd) => execSync(cmd, { encoding: 'utf8' }).trim();
const time = process.env.COMMIT_TIME || git('git log -1 --format=%cI');
const sha = process.env.COMMIT_SHA || git('git rev-parse --short HEAD');

const edit = (file, fn) => {
  const p = path.join(dir, file);
  fs.writeFileSync(p, fn(fs.readFileSync(p, 'utf8')));
};
const fill = (text) => text.replaceAll('__COMMIT_TIME__', time).replaceAll('__COMMIT_SHA__', sha);

edit('index.html', (html) =>
  fill(html).replace(/(href|src)="((?:css|js)\/[^"?]+)"/g, `$1="$2?v=${sha}"`),
);
edit('sw.js', fill);
console.log(`stamped ${dir} with ${sha} (${time})`);

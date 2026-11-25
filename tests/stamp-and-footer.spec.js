// Build stamp (commit time footer) and cache busting done by scripts/stamp.js.
const { test, expect } = require('@playwright/test');
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { load } = require('./helpers');

const SITE_FILES = ['index.html', 'sw.js', 'manifest.webmanifest', 'css', 'js', 'icons'];

/** Copy the site to a temp dir and stamp it, exactly like the deploy workflow. */
function stampedCopy() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sudoku-site-'));
  for (const f of SITE_FILES)
    fs.cpSync(path.join(__dirname, '..', f), path.join(dir, f), { recursive: true });
  execFileSync('node', [path.join(__dirname, '..', 'scripts', 'stamp.js'), dir], {
    env: { ...process.env, COMMIT_TIME: '2026-11-25T16:58:00-05:00', COMMIT_SHA: 'abc1234' },
  });
  return dir;
}

test.describe('build stamp', () => {
  test('footer is tiny, on screen, and says "dev build" when unstamped', async ({ page }) => {
    await load(page);
    const footer = page.locator('#build');
    await expect(footer).toHaveText('dev build');
    const m = await footer.evaluate((el) => ({
      size: parseFloat(getComputedStyle(el).fontSize),
      bottom: el.getBoundingClientRect().bottom,
      vh: innerHeight,
    }));
    expect(m.size).toBeLessThanOrEqual(10);
    expect(m.bottom).toBeLessThanOrEqual(m.vh);
  });

  test('stamped copy shows the commit hash and time', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'stamping is not screen dependent');
    const dir = stampedCopy();
    await page.goto('file://' + path.join(dir, 'index.html'));
    await page.waitForFunction(() => document.querySelectorAll('.c.g').length > 20);
    const text = await page.locator('#build').textContent();
    expect(text).toContain('abc1234');
    expect(text).not.toContain('dev build');
    expect(text).toMatch(/2026/);
  });
});

test.describe('cache busting', () => {
  test.beforeEach(async ({}, info) => {
    test.skip(info.project.name !== 'desktop', 'file checks run once');
  });

  test('every css/js reference gets ?v=<hash>, and no placeholder is left', async () => {
    const dir = stampedCopy();
    const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
    const refs = [...html.matchAll(/(?:href|src)="((?:css|js)\/[^"]+)"/g)].map((m) => m[1]);
    expect(refs.length).toBeGreaterThanOrEqual(7); // 1 stylesheet + 6 scripts
    for (const r of refs) expect(r).toMatch(/\?v=abc1234$/);
    expect(html).not.toContain('__COMMIT_');
  });

  test('service worker cache name changes with the commit', async () => {
    const dir = stampedCopy();
    const sw = fs.readFileSync(path.join(dir, 'sw.js'), 'utf8');
    expect(sw).toContain("'sudoku-abc1234'");
    expect(sw).not.toContain('__COMMIT_');
  });

  test('the page asks browsers not to cache it and the worker never updates from cache', async ({
    page,
  }) => {
    await load(page);
    await expect(page.locator('meta[http-equiv="Cache-Control"]')).toHaveAttribute(
      'content',
      /no-cache/,
    );
    expect(
      await page.evaluate(() => document.documentElement.innerHTML.includes('updateViaCache')),
    ).toBe(true);
  });
});

// Mobile-first layout, the settings dropdown, theme switching and installability.
// Runs on desktop, Pixel 7, iPhone 13 and a short 360x560 Android screen.
const { test, expect } = require('@playwright/test');
const { load, fresh, topOf, openMenu } = require('./helpers');

test.describe('layout', () => {
  test('header is a single row: difficulty, timer + pause, gear, hint; no title or status bar', async ({
    page,
  }) => {
    await load(page);
    await expect(page.locator('h1')).toHaveCount(0);
    await expect(page.locator('#dl')).toHaveCount(0);
    // Compare vertical centres: controls differ in height but must share one row.
    const centres = await page.evaluate(() =>
      ['#diff', '#tm', '#pz', '#gear', '#hint'].map((sel) => {
        const r = document.querySelector(sel).getBoundingClientRect();
        return r.top + r.height / 2;
      }),
    );
    expect(Math.max(...centres) - Math.min(...centres)).toBeLessThanOrEqual(6); // one line
  });

  test('under the board: action buttons and digits side by side, digits on the right', async ({
    page,
  }) => {
    await load(page);
    await expect(page.locator('.tools button')).toHaveText([
      /Undo/,
      /Redo/,
      /Erase/,
      /Notes/,
      /Auto/,
    ]);
    await expect(page.locator('#pad button')).toHaveCount(9);
    const m = await page.evaluate(() => {
      const r = (s) => document.querySelector(s).getBoundingClientRect();
      return { pad: r('#pad'), tools: r('.tools'), boardBottom: r('#board').bottom };
    });
    expect(m.tools.left).toBeLessThan(m.pad.left); // digits on the right
    expect(m.pad.left).toBeGreaterThanOrEqual(m.tools.right - 1); // no overlap
    expect(Math.abs(m.pad.top - m.tools.top)).toBeLessThanOrEqual(2); // same row
    expect(m.pad.top).toBeGreaterThanOrEqual(m.boardBottom - 1);
  });

  test('the hint message sits underneath the buttons', async ({ page }) => {
    await load(page);
    const m = await page.evaluate(() => {
      const r = (s) => document.querySelector(s).getBoundingClientRect();
      return { padBottom: r('#pad').bottom, msgTop: r('#msg').top, toolsTop: r('.tools').top };
    });
    expect(m.msgTop).toBeGreaterThanOrEqual(m.padBottom - 1);
    expect(m.toolsTop).toBeLessThan(m.padBottom);
  });

  test('Notes is a tall button on the right, spanning the Erase and Auto rows', async ({
    page,
  }) => {
    await load(page);
    const r = await page.evaluate(() => {
      const b = (s) => document.querySelector(s).getBoundingClientRect();
      return { note: b('#note'), erase: b('#erase'), auto: b('#auto'), redo: b('#redo') };
    });
    expect(r.note.left).toBeGreaterThanOrEqual(r.erase.right - 1); // right column
    expect(Math.abs(r.note.top - r.erase.top)).toBeLessThanOrEqual(2); // starts at Erase's row
    expect(Math.abs(r.note.bottom - r.auto.bottom)).toBeLessThanOrEqual(2); // ends at Auto's row
    expect(r.auto.top).toBeGreaterThan(r.erase.bottom - 1); // Auto under Erase
    expect(Math.abs(r.auto.width - r.erase.width)).toBeLessThanOrEqual(2); // Auto no longer full width
    expect(Math.abs(r.redo.left - r.note.left)).toBeLessThanOrEqual(2); // Redo above Notes
  });

  test('every cell is the same size, even when whole rows are empty (seed M-ZD52TQ)', async ({
    page,
  }) => {
    await page.goto('/?seed=M-ZD52TQ');
    await page.waitForFunction(() => typeof S !== 'undefined' && S.seed === 'M-ZD52TQ' && S.vals);
    await page.waitForFunction(() => document.querySelectorAll('.c.g').length > 20);
    const spread = () =>
      page.evaluate(() => {
        const r = [...document.querySelectorAll('.c')].map((c) => c.getBoundingClientRect());
        const range = (f) => Math.max(...r.map(f)) - Math.min(...r.map(f));
        return { w: range((x) => x.width), h: range((x) => x.height) };
      });
    const a = await spread();
    expect(a.w).toBeLessThanOrEqual(1);
    expect(a.h).toBeLessThanOrEqual(1);
    // Also with an entirely empty grid.
    await page.evaluate(() => {
      S.vals = Array(81).fill(0);
      S.given = Array(81).fill(false);
      render();
    });
    const b = await spread();
    expect(b.w).toBeLessThanOrEqual(1);
    expect(b.h).toBeLessThanOrEqual(1);
  });

  test('fits the screen: nothing hidden, no page scroll, no sideways scroll', async ({ page }) => {
    await load(page);
    await fresh(page, 'easy');
    const m = await page.evaluate(() => {
      const r = (s) => document.querySelector(s).getBoundingClientRect();
      const app = document.querySelector('.app');
      return {
        boardTop: r('#board').top,
        padBottom: r('#pad').bottom,
        vh: innerHeight,
        sx: document.documentElement.scrollWidth,
        vw: innerWidth,
        appOverflow: app.scrollHeight - app.clientHeight,
        scrollY,
      };
    });
    expect(m.boardTop).toBeGreaterThanOrEqual(0);
    expect(m.padBottom).toBeLessThanOrEqual(m.vh);
    expect(m.sx).toBeLessThanOrEqual(m.vw);
    expect(m.appOverflow).toBeLessThanOrEqual(1);
    expect(m.scrollY).toBe(0);
  });

  test('the board takes most of the screen width', async ({ page }) => {
    await load(page);
    const { w, vw } = await page.evaluate(() => ({
      w: document.querySelector('#board').getBoundingClientRect().width,
      vw: innerWidth,
    }));
    // Nearly full width on phones; on wide screens the app is capped at ~520px.
    // On very short screens the two-row number pad claims height, so allow a smaller board.
    const short = await page.evaluate(() => innerHeight < 600);
    expect(w).toBeGreaterThanOrEqual(short ? 280 : Math.min(vw * 0.9, 440));
  });

  test('every control is a comfortable tap target', async ({ page }) => {
    await load(page);
    const min = await page.evaluate(() => {
      const sizes = [...document.querySelectorAll('.app button')]
        .map((b) => b.getBoundingClientRect())
        .filter((r) => r.height > 0);
      return Math.min(...sizes.map((r) => Math.min(r.width, r.height)));
    });
    expect(min).toBeGreaterThanOrEqual(32);
  });

  test('a long hint message never moves the board', async ({ page }) => {
    await load(page);
    await fresh(page, 'easy');
    const board = await topOf(page, '#board');
    await page.evaluate(() => {
      msg('X-Wing: ' + 'In 2 rows, 7 only has 2 possible spots and they line up. '.repeat(8));
      render();
    });
    expect(await topOf(page, '#board')).toBe(board);
    expect(await page.evaluate(() => scrollY)).toBe(0);
  });

  test('tapping pad, hint, undo and auto never scrolls the page', async ({ page }) => {
    await load(page);
    await fresh(page, 'easy');
    const board = await topOf(page, '#board');
    await page
      .locator('.c')
      .nth(await page.evaluate(() => S.vals.findIndex((v) => !v)))
      .click();
    for (const s of ['#pad button:nth-child(5)', '#hint', '#undo', '#auto']) {
      await page.locator(s).click();
    }
    expect(await topOf(page, '#board')).toBe(board);
    expect(await page.evaluate(() => scrollY)).toBe(0);
  });
});

test.describe('settings dropdown', () => {
  test('opens from the gear, floats over the board and closes on outside tap or Escape', async ({
    page,
  }) => {
    await load(page);
    const board = await topOf(page, '#board');
    await page.click('#gear');
    await expect(page.locator('#menu')).toHaveClass(/open/);
    expect(await topOf(page, '#board')).toBe(board); // overlay, nothing reflows
    const fits = await page.evaluate(() => {
      const r = document.querySelector('#menu').getBoundingClientRect();
      return r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight;
    });
    expect(fits).toBe(true);

    await page.mouse.click(5, 400 > (await page.evaluate(() => innerHeight)) - 5 ? 5 : 400);
    await expect(page.locator('#menu')).not.toHaveClass(/open/);
    await page.click('#gear');
    await page.keyboard.press('Escape');
    await expect(page.locator('#menu')).not.toHaveClass(/open/);
  });

  test('theme: Light, Dark and Auto apply immediately and are remembered', async ({ page }) => {
    await load(page);
    const theme = () => page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    const bg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);

    await openMenu(page);
    await page.click('#theme [data-t=dark]');
    expect(await theme()).toBe('dark');
    const dark = await bg();

    await page.click('#theme [data-t=light]');
    expect(await theme()).toBe('light');
    expect(await bg()).not.toBe(dark);

    await page.click('#theme [data-t=dark]');
    await page.reload();
    await page.waitForFunction(() => document.querySelectorAll('.c.g').length > 20);
    expect(await theme()).toBe('dark'); // persisted

    await openMenu(page);
    await page.click('#theme [data-t=auto]');
    expect(await theme()).toBeNull();
  });

  test('preferences persist across reloads', async ({ page }) => {
    await load(page);
    await openMenu(page);
    await page.uncheck('#oClean');
    await page.reload();
    await page.waitForFunction(() => document.querySelectorAll('.c.g').length > 20);
    await expect(page.locator('#oClean')).not.toBeChecked();
  });
});

test('installable web app: manifest, icons, service worker and iOS tags', async ({
  page,
  request,
}) => {
  await load(page);
  const manifest = await (await request.get('/manifest.webmanifest')).json();
  expect(manifest.display).toBe('standalone');
  expect(manifest.start_url).toBe('./');
  for (const icon of manifest.icons) expect((await request.get('/' + icon.src)).ok()).toBe(true);
  const sw = await request.get('/sw.js');
  expect(sw.ok()).toBe(true);
  const swText = await sw.text();
  for (const f of ['css/styles.css', 'js/main.js']) expect(swText).toContain(f); // precached
  expect(swText).toMatch(/fetch\(event\.request, \{ cache: 'no-cache' \}\)/); // network first, revalidated
  expect((await request.get('/icons/icon-180.png')).ok()).toBe(true);

  await expect(page.locator('link[rel=manifest]')).toHaveCount(1);
  await expect(page.locator('link[rel=apple-touch-icon]')).toHaveAttribute(
    'href',
    'icons/icon-180.png',
  );
  await expect(page.locator('meta[name=apple-mobile-web-app-capable]')).toHaveAttribute(
    'content',
    'yes',
  );
  await expect(page.locator('meta[name=viewport]')).toHaveAttribute(
    'content',
    /viewport-fit=cover/,
  );
});

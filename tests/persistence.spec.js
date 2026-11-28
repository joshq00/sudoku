// The game is saved to localStorage so closing the app and coming back resumes it.
const { test, expect } = require('@playwright/test');
const { load, fresh, firstEmpty, solutionAt, place } = require('./helpers');

const reload = async (page) => {
  await page.reload();
  await page.waitForFunction(() => typeof S !== 'undefined' && S.vals && S.given);
  await page.waitForFunction(() => document.querySelectorAll('.c.g').length > 20);
};

test('a game in progress is restored after the app is closed and reopened', async ({ page }) => {
  await load(page);
  await fresh(page, 'hard');
  await page.click('#auto');
  const i = await firstEmpty(page);
  await place(page, i, await solutionAt(page, i));
  const before = await page.evaluate(() => ({
    seed: S.seed,
    vals: S.vals.join(),
    notes: S.notes.join(),
    given: S.given.join(),
    hist: S.hist.length,
  }));
  await reload(page);
  const after = await page.evaluate(() => ({
    seed: S.seed,
    vals: S.vals.join(),
    notes: S.notes.join(),
    given: S.given.join(),
    hist: S.hist.length,
  }));
  expect(after).toEqual(before);
  await expect(page.locator('#diff button[data-d=hard]')).toHaveClass(/on/);
  await expect(page.locator('#seedText')).toHaveText(before.seed);
});

test('undo still works after resuming', async ({ page }) => {
  await load(page);
  await fresh(page, 'easy');
  const i = await firstEmpty(page);
  await place(page, i, await solutionAt(page, i));
  await reload(page);
  await page.click('#undo');
  expect(await page.evaluate((i) => S.vals[i], i)).toBe(0);
});

test('mistakes, hints, timer and note mode are kept', async ({ page }) => {
  await load(page);
  await fresh(page, 'easy');
  await page.evaluate(() => {
    S.mist = 2;
    S.hints = 3;
    S.t = 125;
    noteMode = true;
    render();
  });
  await reload(page);
  expect(await page.evaluate(() => [S.mist, S.hints, noteMode])).toEqual([2, 3, true]);
  await expect(page.locator('#tm')).toHaveText(/^2:0\d$/); // 2:05, still counting
});

test('the clock does not run while the app is closed', async ({ page }) => {
  await load(page);
  await fresh(page, 'easy');
  await page.evaluate(() => {
    S.t = 60;
    render();
  });
  await page.waitForTimeout(2500);
  await reload(page);
  expect(await page.evaluate(() => S.t)).toBeLessThan(70);
});

test('a solved puzzle is not resumed: reopening starts a new one', async ({ page }) => {
  await load(page);
  await fresh(page, 'easy');
  const seed = await page.evaluate(() => S.seed);
  await page.evaluate(() => {
    const i = S.vals.findIndex((v) => !v);
    S.vals = S.sol.slice();
    S.vals[i] = 0;
    sel = i;
    input(S.sol[i]);
  });
  await expect(page.locator('#ov')).toHaveClass(/show/);
  expect(await page.evaluate(() => localStorage.getItem('sdk.game'))).toBe('null');
  await reload(page);
  expect(await page.evaluate(() => S.seed)).not.toBe(seed);
});

test('a shared seed link opens that puzzle; the same seed resumes your progress', async ({
  page,
}) => {
  await page.goto('/?seed=E-ABC234');
  await page.waitForFunction(() => typeof S !== 'undefined' && S.seed === 'E-ABC234' && S.vals);
  const i = await firstEmpty(page);
  await place(page, i, await solutionAt(page, i));
  await reload(page); // same link again: keeps your move
  expect(await page.evaluate((i) => S.vals[i], i)).toBeGreaterThan(0);

  await page.goto('/?seed=M-ZZZ999'); // different seed replaces the saved game
  await page.waitForFunction(() => typeof S !== 'undefined' && S.seed === 'M-ZZZ999' && S.vals);
  await page.goto('/'); // plain link resumes the most recent game
  await page.waitForFunction(() => typeof S !== 'undefined' && S.vals && S.given);
  expect(await page.evaluate(() => S.seed)).toBe('M-ZZZ999');
});

test('a corrupted or tampered save is ignored and a new game starts', async ({ page }) => {
  await load(page);
  for (const bad of ['{not json', '{"v":1,"game":{"seed":"E-AAAAAA"}}', '{"v":99}', '"x"']) {
    await page.evaluate((b) => localStorage.setItem('sdk.game', b), bad);
    await reload(page);
    expect(await page.evaluate(() => S.vals.filter(Boolean).length)).toBeGreaterThan(15);
  }
});

test('the game still runs when storage is blocked', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new Error('blocked');
      },
    });
  });
  await load(page);
  const i = await firstEmpty(page);
  await place(page, i, await solutionAt(page, i));
  expect(await page.evaluate((i) => S.vals[i], i)).toBeGreaterThan(0);
});

test('the save stays small', async ({ page }) => {
  await load(page);
  await fresh(page, 'easy');
  await page.click('#auto');
  for (let k = 0; k < 30; k++) {
    await page.evaluate(() => {
      const j = S.vals.findIndex((v) => !v);
      sel = j;
      input(S.sol[j]);
    });
  }
  const bytes = await page.evaluate(() => localStorage.getItem('sdk.game').length);
  expect(bytes).toBeLessThan(200_000);
});

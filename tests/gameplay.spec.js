// Core play: entering numbers, notes, errors, undo/redo, hints, toggles, winning.
const { test, expect } = require('@playwright/test');
const { load, fresh, cell, firstEmpty, solutionAt, topOf, place, openMenu } = require('./helpers');

test('difficulty buttons start a new game every time, with no separate New Game button', async ({
  page,
}) => {
  await load(page);
  await expect(page.locator('#new')).toHaveCount(0);
  const seen = new Set();
  for (const d of ['easy', 'easy', 'medium']) {
    await page.click(`#diff button[data-d=${d}]`);
    await page.waitForFunction(
      (old) =>
        !document.querySelector('#msg').textContent.startsWith('Generating') &&
        !old.includes(S.sol.join('')),
      [...seen],
    );
    seen.add(await page.evaluate(() => S.sol.join('')));
    await expect(page.locator(`#diff button[data-d=${d}]`)).toHaveClass(/on/);
  }
  expect(seen.size).toBe(3); // unlimited, never repeated
});

test('entering, erasing, note mode and keyboard shortcuts', async ({ page }) => {
  await load(page);
  await fresh(page, 'easy');
  const i = await firstEmpty(page);
  await place(page, i, await solutionAt(page, i));
  expect(await page.evaluate((i) => S.vals[i], i)).toBeGreaterThan(0);
  await page.click('#erase');
  expect(await page.evaluate((i) => S.vals[i], i)).toBe(0);

  await page.keyboard.press('n');
  await expect(page.locator('#note')).toHaveClass(/on/);
  await page.keyboard.press('1');
  expect(await page.evaluate((i) => S.notes[i] & 2, i)).toBe(2);
  await page.keyboard.press('ArrowRight');
  expect(await page.evaluate(() => sel)).toBe(i + 1 > 80 ? 0 : i + 1);
});

test('Auto fills candidates, filling a number cleans peers, Trim removes stale notes', async ({
  page,
}) => {
  await load(page);
  await fresh(page, 'easy');
  await page.click('#auto');
  expect(
    await page.evaluate(() =>
      S.vals.every((v, i) => (v ? S.notes[i] === 0 : S.notes[i] === cand(S.vals, i))),
    ),
  ).toBe(true);

  const i = await firstEmpty(page);
  const d = await solutionAt(page, i);
  await place(page, i, d);
  expect(
    await page.evaluate(({ i, d }) => P[i].every((j) => !((S.notes[j] >> d) & 1)), { i, d }),
  ).toBe(true); // auto-clean

  // Plant an impossible note, then trim it away from the settings menu.
  const stale = await page.evaluate(() => {
    const j = S.vals.findIndex((v) => !v);
    const bad = S.vals[P[j].find((p) => S.vals[p])];
    S.notes[j] |= 1 << bad;
    render();
    return { j, bad };
  });
  await openMenu(page);
  await page.click('#trim');
  expect(await page.evaluate((s) => (S.notes[s.j] >> s.bad) & 1, stale)).toBe(0);
  await expect(page.locator('#menu.open')).toHaveCount(0); // menu closes after use
});

test('errors are shown and counted, and can be switched off', async ({ page }) => {
  await load(page);
  await fresh(page, 'easy');
  const { i, d } = await page.evaluate(() => {
    for (let i = 0; i < 81; i++)
      if (!S.vals[i])
        for (let d = 1; d < 10; d++)
          if (d !== S.sol[i] && !P[i].some((j) => S.vals[j] === d)) return { i, d };
  });
  await place(page, i, d);
  await expect(cell(page, i)).toHaveClass(/bad/);
  await expect(page.locator('#mist')).toHaveText('Mistakes: 1');
  await openMenu(page);
  await page.uncheck('#oErr');
  await expect(cell(page, i)).not.toHaveClass(/bad/);
});

test('undo/redo restore state, explain the change and keep the layout still', async ({ page }) => {
  await load(page);
  await fresh(page, 'easy');
  await page.click('#auto');
  const i = await firstEmpty(page);
  const d = await solutionAt(page, i);
  const before = await Promise.all(['#board', '#pad', '#undo'].map((s) => topOf(page, s)));

  await place(page, i, d);
  await page.click('#undo');
  expect(await page.evaluate((i) => S.vals[i], i)).toBe(0);
  await expect(page.locator('#msg')).toContainText('Undo');
  await expect(cell(page, i)).toHaveClass(/fl/);
  await page.click('#redo');
  expect(await page.evaluate((i) => S.vals[i], i)).toBe(d);

  expect(await Promise.all(['#board', '#pad', '#undo'].map((s) => topOf(page, s)))).toEqual(before);
  await page.keyboard.press('Control+z');
  expect(await page.evaluate((i) => S.vals[i], i)).toBe(0);
  await page.keyboard.press('Control+Shift+z');
  expect(await page.evaluate((i) => S.vals[i], i)).toBe(d);
});

test('hint (?): first tap explains it, second tap applies it', async ({ page }) => {
  await load(page);
  await fresh(page, 'easy');
  const filled = () => page.evaluate(() => S.vals.filter(Boolean).length);
  const start = await filled();
  await page.click('#hint');
  expect(await page.evaluate(() => !!HX)).toBe(true);
  expect(await filled()).toBe(start); // shown, not applied
  await page.click('#hint');
  expect(await filled()).toBe(start + 1);
  expect(await page.evaluate(() => S.hints)).toBe(1);
});

test('pattern hints highlight the pattern and a removal made by hand is not repeated', async ({
  page,
}) => {
  test.skip(test.info().project.name !== 'desktop', 'slow; logic only');
  await load(page);
  await fresh(page, 'hard');
  await page.click('#auto');
  let found = null;
  for (let k = 0; k < 80 && !found; k++) {
    await page.click('#hint');
    found = await page.evaluate(() =>
      HX && HX.elims
        ? { pat: HX.pat.length, tgt: HX.tgt.length, key: JSON.stringify(HX.elims) }
        : null,
    );
    if (!found) await page.click('#hint');
  }
  expect(found).not.toBeNull();
  expect(found.pat).toBeGreaterThan(0);
  expect(found.tgt).toBeGreaterThan(0);
  await expect(page.locator('#board .c.hp').first()).toBeVisible();
  await expect(page.locator('#board .c.ht').first()).toBeVisible();

  // Do the removal yourself instead of pressing hint again.
  await page.evaluate(() => {
    const l = HX.elims;
    HX = null;
    for (const [i, m] of l) S.notes[i] &= ~m;
    render();
  });
  await page.click('#hint');
  const next = await page.evaluate(() => (HX && HX.elims ? JSON.stringify(HX.elims) : 'none'));
  expect(next).not.toBe(found.key);
});

test('highlight toggles: row/column/box shading and matching-note tint', async ({ page }) => {
  await load(page);
  await fresh(page, 'easy');
  await page.click('#auto');
  await cell(page, await firstEmpty(page)).click();
  expect(await page.locator('.c.p').count()).toBeGreaterThan(0);
  await openMenu(page);
  await page.uncheck('#oPeer');
  expect(await page.locator('.c.p').count()).toBe(0);
  await page.uncheck('#oTint');
  await expect(page.locator('#board')).toHaveClass(/notint/);
});

test('only cells containing the selected digit get the note tint', async ({ page }) => {
  await load(page);
  await fresh(page, 'easy');
  await page.click('#auto');
  const given = await page.evaluate(() => S.vals.findIndex((v, i) => v && S.given[i]));
  await cell(page, given).click();
  expect(
    await page.evaluate(() =>
      [...document.querySelectorAll('.n .m')].every((s) => s.textContent.trim() !== ''),
    ),
  ).toBe(true);
});

test('pause icon hides the board and resumes', async ({ page }) => {
  await load(page);
  await page.click('#pz');
  await expect(page.locator('#board')).toHaveClass(/pause/);
  await page.click('#pz');
  await expect(page.locator('#board')).not.toHaveClass(/pause/);
});

test('solving the grid shows the win screen', async ({ page }) => {
  await load(page);
  await fresh(page, 'easy');
  await page.evaluate(() => {
    const i = S.vals.findIndex((v) => !v);
    S.vals = S.sol.slice();
    S.vals[i] = 0;
    sel = i;
    input(S.sol[i]);
  });
  await expect(page.locator('#ov')).toHaveClass(/show/);
});

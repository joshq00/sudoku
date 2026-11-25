// Shared helpers. The game exposes its state as globals (S, sel, HX, ...), so
// tests can drive and inspect it directly with page.evaluate.

/** Open the app and wait until the first puzzle has been generated. */
async function load(page) {
  await page.goto('/');
  await page.waitForFunction(() => document.querySelectorAll('.c.g').length > 20, null, {
    timeout: 30_000,
  });
}

/** Replace the current game with a freshly generated puzzle of the given difficulty. */
async function fresh(page, difficulty) {
  await page.evaluate((d) => start(generate(d)), difficulty);
  await page.waitForFunction(() => S.given && S.given.some(Boolean));
}

const cell = (page, i) => page.locator('.c').nth(i);
const firstEmpty = (page) => page.evaluate(() => S.vals.findIndex((v) => !v));
const solutionAt = (page, i) => page.evaluate((i) => S.sol[i], i);
const topOf = (page, selector) =>
  page.evaluate((s) => Math.round(document.querySelector(s).getBoundingClientRect().top), selector);

/** Tap a cell, then a digit on the number pad. */
async function place(page, i, digit) {
  await cell(page, i).click();
  await page
    .locator('#pad button')
    .nth(digit - 1)
    .click();
}

/** Open the settings dropdown (no-op if already open). */
async function openMenu(page) {
  if (!(await page.locator('#menu.open').count())) await page.click('#gear');
  await page.locator('#menu.open').waitFor();
}

module.exports = { load, fresh, cell, firstEmpty, solutionAt, topOf, place, openMenu };

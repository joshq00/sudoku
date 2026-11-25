// Seeds: the same seed must give the same puzzle everywhere; share/load must work.
const { test, expect } = require('@playwright/test');
const { load, openMenu } = require('./helpers');

test.describe('seed logic', () => {
  test.beforeEach(async ({}, info) => {
    test.skip(info.project.name !== 'desktop', 'pure logic, runs once');
  });

  test('the same seed always gives the same puzzle, for every difficulty', async ({ page }) => {
    await load(page);
    const same = await page.evaluate(() =>
      ['E-ABC234', 'M-ABC234', 'H-ABC234'].map((seed) => {
        const d = SEED_LEVELS[seed[0]];
        const a = generate(d, seed);
        const b = generate(d, seed);
        return a.puz.join('') === b.puz.join('') && a.sol.join('') === b.sol.join('');
      }),
    );
    expect(same).toEqual([true, true, true]);
  });

  test('different seeds give different puzzles, and the puzzle stays valid and unique', async ({
    page,
  }) => {
    await load(page);
    const r = await page.evaluate(() => {
      const a = generate('medium', 'M-AAAAAA');
      const b = generate('medium', 'M-BBBBBB');
      return {
        differ: a.puz.join('') !== b.puz.join(''),
        unique: count(a.puz.slice(), 2),
        consistent: a.puz.every((v, i) => !v || v === a.sol[i]),
      };
    });
    expect(r).toEqual({ differ: true, unique: 1, consistent: true });
  });

  test('generating from a seed leaves Math.random alone', async ({ page }) => {
    await load(page);
    expect(await page.evaluate(() => (generate('easy', 'E-ABC234'), rng === Math.random))).toBe(
      true,
    );
  });

  test('makeSeed and parseSeed round-trip, and input is forgiving', async ({ page }) => {
    await load(page);
    const r = await page.evaluate(() => ({
      made: makeSeed('hard'),
      lower: parseSeed('m-7k3f2q'),
      spaced: parseSeed('  H 7K3F2Q '),
      link: parseSeed('https://joshq00.github.io/sudoku/?seed=E-7K3F2Q&x=1'),
      bad: [parseSeed('nope'), parseSeed(''), parseSeed('X-7K3F2Q'), parseSeed('M-12')],
    }));
    expect(r.made).toMatch(/^H-[A-Z2-9]{6}$/);
    expect(r.lower).toEqual({ difficulty: 'medium', seed: 'M-7K3F2Q' });
    expect(r.spaced).toEqual({ difficulty: 'hard', seed: 'H-7K3F2Q' });
    expect(r.link).toEqual({ difficulty: 'easy', seed: 'E-7K3F2Q' });
    expect(r.bad).toEqual([null, null, null, null]);
  });
});

test.describe('seed controls', () => {
  // Make clipboard/share deterministic: record what would be copied, and no native share sheet.
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: async (t) => (window.__copied = t) },
        configurable: true,
      });
      Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    });
  });

  test('the menu shows the seed of the current puzzle', async ({ page }) => {
    await load(page);
    await openMenu(page);
    await expect(page.locator('#seedText')).toHaveText(/^[EMH]-[A-Z2-9]{6}$/);
    expect(await page.evaluate(() => S.seed)).toBe(await page.locator('#seedText').textContent());
  });

  test('Copy puts the seed on the clipboard; Share link copies a ?seed= link', async ({ page }) => {
    await load(page);
    await openMenu(page);
    const seed = await page.evaluate(() => S.seed);
    await page.click('#copySeed');
    expect(await page.evaluate(() => window.__copied)).toBe(seed);
    await expect(page.locator('#copySeed')).toHaveText('Copied!');
    await page.click('#shareSeed');
    const link = await page.evaluate(() => window.__copied);
    expect(new URL(link).searchParams.get('seed')).toBe(seed);
    expect(parseSeedInPage(link)).toBeTruthy();
  });

  test('if share and copy are both blocked, the link is shown to copy by hand', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: async () => Promise.reject(new Error('blocked')) },
        configurable: true,
      });
      Object.defineProperty(navigator, 'share', {
        value: async () =>
          Promise.reject(Object.assign(new Error('no'), { name: 'NotAllowedError' })),
        configurable: true,
      });
      document.execCommand = () => false;
    });
    await load(page);
    await openMenu(page);
    await page.click('#shareSeed');
    await expect(page.locator('#linkOut')).toBeVisible();
    const link = await page.inputValue('#linkOut');
    expect(new URL(link).searchParams.get('seed')).toBe(await page.evaluate(() => S.seed));
  });

  test('cancelling the native share sheet shows no fallback', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'share', {
        value: async () => Promise.reject(Object.assign(new Error('x'), { name: 'AbortError' })),
        configurable: true,
      });
    });
    await load(page);
    await openMenu(page);
    await page.click('#shareSeed');
    await expect(page.locator('#linkBox')).toBeHidden();
  });

  test('the native share sheet gets a link that opens the same puzzle', async ({
    page,
    context,
  }) => {
    await page.addInitScript(() => {
      window.__shared = null;
      Object.defineProperty(navigator, 'share', {
        value: async (d) => (window.__shared = d),
        configurable: true,
      });
    });
    await load(page);
    await openMenu(page);
    const seed = await page.evaluate(() => S.seed);
    await page.click('#shareSeed');
    const shared = await page.evaluate(() => window.__shared);
    expect(shared.url).toContain('seed=' + seed);
    const other = await context.newPage();
    await other.goto(shared.url);
    await other.waitForFunction(() => typeof S !== 'undefined' && S.vals);
    expect(await other.evaluate(() => S.seed)).toBe(seed);
  });

  test('loading a seed starts exactly that puzzle and switches difficulty', async ({ page }) => {
    await load(page);
    await openMenu(page);
    await page.fill('#seedIn', 'e-abc234');
    await page.click('#loadSeed');
    await page.waitForFunction(() => S.seed === 'E-ABC234');
    const r = await page.evaluate(() => ({
      puz: S.vals.join(''),
      expected: generate('easy', 'E-ABC234').puz.join(''),
    }));
    expect(r.puz).toBe(r.expected);
    await expect(page.locator('#diff button[data-d=easy]')).toHaveClass(/on/);
    await expect(page.locator('#menu')).not.toHaveClass(/open/); // menu closes
  });

  test('a pasted link works too, and a bad seed shows an error without changing the game', async ({
    page,
  }) => {
    await load(page);
    const before = await page.evaluate(() => S.seed);
    await openMenu(page);
    await page.fill('#seedIn', 'not a seed');
    await page.click('#loadSeed');
    await expect(page.locator('#seedErr')).toBeVisible();
    expect(await page.evaluate(() => S.seed)).toBe(before);

    await page.fill('#seedIn', 'http://localhost:4173/?seed=E-ZZZ999');
    await page.click('#loadSeed');
    await page.waitForFunction(() => S.seed === 'E-ZZZ999');
  });

  test('opening a shared link starts that puzzle', async ({ page }) => {
    await page.goto('/?seed=E-ABC234');
    await page.waitForFunction(() => S.vals && S.seed === 'E-ABC234');
    await expect(page.locator('#diff button[data-d=easy]')).toHaveClass(/on/);
  });

  test('the settings menu still fits the screen with the seed controls', async ({ page }) => {
    await load(page);
    await openMenu(page);
    const fits = await page.evaluate(() => {
      const r = document.querySelector('#menu').getBoundingClientRect();
      return r.top >= 0 && r.bottom <= innerHeight && r.right <= innerWidth;
    });
    expect(fits).toBe(true);
  });
});

// Tiny helper kept outside page.evaluate: a ?seed= link must be a valid seed.
function parseSeedInPage(link) {
  return /^[EMH]-[A-Z2-9]{6}$/.test(new URL(link).searchParams.get('seed'));
}

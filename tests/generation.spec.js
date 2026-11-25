// Puzzle generation and difficulty. Pure logic, so it only runs once (desktop).
const { test, expect } = require('@playwright/test');
const { load, fresh } = require('./helpers');

test.describe('puzzle generation', () => {
  test.beforeEach(async ({}, info) => {
    test.skip(info.project.name !== 'desktop', 'logic tests run once');
  });

  /** Facts about the current puzzle, computed in the page with the game's own solver. */
  const facts = (page) =>
    page.evaluate(() => {
      const g = S.vals.slice();
      return {
        clues: S.given.filter(Boolean).length,
        solutions: count(g.slice(), 2), // 1 means unique
        validSolution:
          U.every((u) => new Set(u.map((i) => S.sol[i])).size === 9) &&
          S.sol.every((v, i) => !S.given[i] || S.vals[i] === v),
        singlesOnly: grade(g, 1)[0],
        upToPairs: grade(g, 2)[0],
        upToFish: grade(g, 3)[0],
      };
    });

  test('easy: unique, valid and solvable with singles only', async ({ page }) => {
    await load(page);
    await fresh(page, 'easy');
    const f = await facts(page);
    expect(f.validSolution).toBe(true);
    expect(f.solutions).toBe(1);
    expect(f.singlesOnly).toBe(1);
    expect(f.clues).toBeGreaterThanOrEqual(36);
  });

  test('medium: unique and solvable without advanced techniques', async ({ page }) => {
    await load(page);
    await fresh(page, 'medium');
    const f = await facts(page);
    expect(f.validSolution).toBe(true);
    expect(f.solutions).toBe(1);
    expect(f.upToPairs).toBeGreaterThan(0);
  });

  test('hard: unique, logic-solvable and sparse', async ({ page }) => {
    await load(page);
    await fresh(page, 'hard');
    const f = await facts(page);
    expect(f.validSolution).toBe(true);
    expect(f.solutions).toBe(1);
    expect(f.upToFish).toBeGreaterThan(0);
    expect(f.clues).toBeLessThanOrEqual(30);
  });

  test('hard puzzles cannot be finished with singles alone', async ({ page }) => {
    await load(page);
    await fresh(page, 'hard');
    expect((await facts(page)).singlesOnly).toBe(0);
  });

  test('hint eliminations never remove the true solution digit', async ({ page }) => {
    await load(page);
    const result = await page.evaluate(() => {
      start(generate('hard'));
      let wrong = 0;
      let patternSteps = 0;
      for (let k = 0; k < 40; k++) {
        const h = findHint();
        if (h.elims) {
          patternSteps++;
          for (const [i, m] of h.elims) if ((m >> S.sol[i]) & 1) wrong++;
          for (const [i, m, f] of h.elims) S.elim[i] |= f || m;
        } else if (h.v) {
          if (h.v !== S.sol[h.i]) wrong++;
          S.vals[h.i] = h.v;
        } else break;
      }
      return { wrong, patternSteps };
    });
    expect(result.wrong).toBe(0);
  });
});

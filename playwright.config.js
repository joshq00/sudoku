// Playwright runs the same suite on desktop and three phone-sized screens.
// Locally you can point CHROMIUM_PATH at an installed Chromium; in CI the
// browser comes from `npx playwright install chromium`.
const { defineConfig, devices } = require('@playwright/test');

const launchOptions = process.env.CHROMIUM_PATH
  ? { executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] }
  : {};

// Emulate phones with Chromium (iPhone descriptors default to WebKit otherwise).
const phone = (device, overrides = {}) => {
  const { defaultBrowserType, ...rest } = devices[device];
  return { ...rest, browserName: 'chromium', launchOptions, ...overrides };
};

module.exports = defineConfig({
  testDir: 'tests',
  timeout: 90_000,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : 3,
  use: { baseURL: 'http://localhost:4173', launchOptions },
  webServer: {
    command: 'npx serve -l 4173 .',
    url: 'http://localhost:4173',
    reuseExistingServer: true,
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1000, height: 900 }, launchOptions } },
    { name: 'android', use: phone('Pixel 7') },
    { name: 'iphone', use: phone('iPhone 13') },
    // Short screen: the case where the board used to be pushed off the top.
    { name: 'small-android', use: phone('Pixel 5', { viewport: { width: 360, height: 560 } }) },
  ],
});

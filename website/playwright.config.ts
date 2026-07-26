import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.NOTF_TEST_PORT ?? 8765);
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './tests/visual',
  // Baselines use Playwright's default naming (…-snapshots/<name>-<project>-<platform>.png).
  // Rendering is pinned by the official Playwright Docker image, so the only
  // platform that ever gets generated/committed is the container's linux — a Mac
  // dev running the same image produces identical pixels. Regenerate baselines
  // only inside that image (see CONTRIBUTING.md).
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [['html', { open: 'never' }], ['list']],

  expect: {
    toHaveScreenshot: {
      animations: 'disabled',
      caret: 'hide',
      maxDiffPixelRatio: 0.05,
      scale: 'device',
    },
  },

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  webServer: {
    command: `python3 -m http.server ${PORT} --directory public`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    stdout: 'ignore',
    stderr: 'pipe',
  },

  projects: [
    {
      name: 'mobile-320',
      use: { ...devices['Desktop Chrome'], viewport: { width: 320, height: 720 } },
    },
    {
      name: 'mobile-375',
      use: { ...devices['Desktop Chrome'], viewport: { width: 375, height: 812 } },
    },
    {
      name: 'tablet-768',
      use: { ...devices['Desktop Chrome'], viewport: { width: 768, height: 1024 } },
    },
    {
      name: 'laptop-1024',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1024, height: 768 } },
    },
    {
      name: 'desktop-1440',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
  ],
});

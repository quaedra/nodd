import { readFile } from "node:fs/promises";
import { chromium } from "playwright";

// Compose a social card from the existing vector logo, with motion disabled.
const logo = await readFile(new URL("../public/logo.svg", import.meta.url), "utf8");
const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
  });
  await page.setContent(`<!doctype html>
    <html lang="en"><head><meta charset="utf-8"><style>
      * { box-sizing: border-box; }
      body { margin: 0; background: #fff; color: #000;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; }
      main { height: 630px; padding: 0 120px; display: flex; flex-direction: column; justify-content: center; }
      .brand { display: flex; align-items: center; gap: 24px; margin-bottom: 42px; }
      .brand svg { display: block; width: 112px; height: 112px; flex: none; }
      h1 { margin: 0; font-size: 88px; line-height: 1; font-weight: 700; }
      p { margin: 0; max-width: 930px; font-size: 42px; line-height: 1.4; }
    </style></head><body><main>
      <div class="brand">${logo}<h1>Nodd</h1></div>
      <p>Tiny, fast, free, use-case-specific decision models that can run in a browser.</p>
    </main></body></html>`);
  await page.screenshot({ path: new URL("../public/og-image.png", import.meta.url).pathname });
  // Wide cover for an X article, using the same branding and copy.
  await page.setViewportSize({ width: 1500, height: 600 });
  await page.addStyleTag({ content: "main { height: 600px; padding: 0 240px; }" });
  await page.screenshot({ path: new URL("../public/twitter-article-cover.png", import.meta.url).pathname });
} finally {
  await browser.close();
}

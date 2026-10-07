// Offline acceptance check using the same generated fixtures as the contract tests: the model page
// loads the Python-exported fixture encoder and matches Python's answers; docs and Models render.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { chromium } from "playwright";
import { preview } from "vite";

const web = fileURLToPath(new URL("../", import.meta.url));
const fixtures = join(web, "test/generated/model");
const server = await preview({ configFile: join(web, "vite.config.ts"), preview: { port: 0 }, logLevel: "error" });
let browser;
try {
  browser = await chromium.launch({ channel: "chromium" });
  const context = await browser.newContext({ serviceWorkers: "block" });
  await context.route("**/models/index.json", (route) => route.fulfill({ json: [] }));
  // serves the exported fixture folder (also intercepts the model worker's requests)
  await context.route("**/fixture-model/**", (route) => {
    const file = new URL(route.request().url()).pathname.split("/fixture-model/")[1];
    return route.fulfill({ body: readFileSync(join(fixtures, file)), contentType: file.endsWith(".json") ? "application/json" : "application/octet-stream" });
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const base = server.resolvedUrls.local[0];

  await page.goto(`${base}model.html?model=${encodeURIComponent(new URL("fixture-model", base).pathname)}`);
  await page.waitForFunction(() => window.__last, null, { timeout: 60_000 });
  assert.equal(await page.title(), "nodd · Model");
  // the browser (transformers.js, WASM) gives Python's answers: parity.jsonl = the exported q8 model's
  const expected = readFileSync(join(fixtures, "parity.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l)).filter((r) => r.text.trim());
  for (const row of expected.slice(0, 5)) {
    await page.evaluate(() => (window.__prev = window.__last));
    await page.fill("#text", row.text);
    await page.waitForFunction(() => window.__last !== window.__prev, null, { timeout: 10_000 });
    assert.equal(await page.evaluate(() => window.__last.label), row.label, `browser label for ${JSON.stringify(row.text)}`);
  }

  await page.goto(`${base}docs.html`);
  await page.waitForSelector("h1");
  assert.equal(await page.title(), "Docs · nodd · Quaedra Research");
  assert.ok((await page.locator("h2").count()) >= 5, "docs sections");

  await page.goto(`${base}models.html`);
  await page.waitForSelector("h1");
  assert.equal(await page.locator("nav a[aria-current=page]").textContent(), "Models");

  assert.deepEqual(errors, []);
  console.log("Browser fixture check passed: model page loads the exported fixture encoder and matches Python; docs and Models render.");
} finally {
  await browser?.close();
  await new Promise((resolve) => server.httpServer.close(resolve));
}

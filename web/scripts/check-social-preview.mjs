import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

// Check the built HTML: link crawlers do not run the React application.
const directory = resolve(process.argv[2] ?? "dist-demo");
const pages = (await readdir(directory)).filter((name) => name.endsWith(".html"));
assert(pages.includes("index.html"), "Missing built homepage");
for (const name of pages) {
  const html = await readFile(resolve(directory, name), "utf8");
  const tags = new Map([...html.matchAll(/<meta\s+(?:property|name)="([^"]+)"\s+content="([^"]*)"[^>]*>/g)]
    .map((match) => [match[1], match[2]]));
  for (const key of ["og:type", "og:title", "og:description", "og:url", "og:image", "og:image:alt", "twitter:card", "twitter:image"]) {
    assert(tags.get(key), `${name}: missing ${key}`);
  }
  assert.equal(tags.get("twitter:card"), "summary_large_image", name);
  assert.equal(tags.get("twitter:image"), tags.get("og:image"), name);
  const image = new URL(tags.get("og:image"));
  assert.equal(image.protocol, "https:", `${name}: image URL must be absolute HTTPS`);
  assert.equal(image.pathname, "/nodd/og-image.png", name);
}
const png = await readFile(resolve(directory, "og-image.png"));
assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a", "Invalid preview PNG");
assert.equal(png.readUInt32BE(16), 1200);
assert.equal(png.readUInt32BE(20), 630);
console.log(`Verified social metadata on ${pages.length} pages and the 1200×630 preview image.`);

// The service worker must precache every file the app loads, or the app
// breaks offline. This keeps PRECACHE in sync with the repo.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const sw = readFileSync(join(root, "sw.js"), "utf8");
const list = sw.slice(sw.indexOf("const PRECACHE"), sw.indexOf("];"));
const precache = [...list.matchAll(/"\.\/([^"]*)"/g)].map((m) => m[1]).filter(Boolean);

const walk = (dir) =>
  readdirSync(join(root, dir)).flatMap((name) => {
    const path = join(dir, name);
    return statSync(join(root, path)).isDirectory() ? walk(path) : [path];
  });

test("CACHE_VERSION exists", () => {
  assert.match(sw, /const CACHE_VERSION = "v\d+";/);
});

test("every precached file exists", () => {
  for (const file of precache) assert.ok(existsSync(join(root, file)), `missing ${file}`);
});

test("precache includes every JS, CSS, PNG icon and media file", () => {
  const needed = [
    ...walk("js"),
    ...walk("css"),
    ...walk("media"),
    ...walk("icons").filter((f) => f.endsWith(".png")),
  ].map((f) => relative(".", f));
  for (const file of needed) assert.ok(precache.includes(file), `sw.js does not precache ${file}`);
});

test("paths in index.html and the manifest are relative", () => {
  const html = readFileSync(join(root, "index.html"), "utf8");
  const manifest = readFileSync(join(root, "manifest.webmanifest"), "utf8");
  assert.doesNotMatch(html, /(src|href)="\/(?!\/)/);
  assert.doesNotMatch(manifest, /"(src|start_url|scope)": "\//);
});

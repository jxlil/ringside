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

test("CACHE_VERSION existe", () => {
  assert.match(sw, /const CACHE_VERSION = "v\d+";/);
});

test("todos los archivos del precache existen", () => {
  for (const file of precache) assert.ok(existsSync(join(root, file)), `falta ${file}`);
});

test("el precache incluye todos los JS, CSS, íconos PNG y media", () => {
  const needed = [
    ...walk("js"),
    ...walk("css"),
    ...walk("media"),
    ...walk("icons").filter((f) => f.endsWith(".png")),
  ].map((f) => relative(".", f));
  for (const file of needed) assert.ok(precache.includes(file), `sw.js no precachea ${file}`);
});

test("las rutas en index.html y el manifest son relativas", () => {
  const html = readFileSync(join(root, "index.html"), "utf8");
  const manifest = readFileSync(join(root, "manifest.webmanifest"), "utf8");
  assert.doesNotMatch(html, /(src|href)="\/(?!\/)/);
  assert.doesNotMatch(manifest, /"(src|start_url|scope)": "\//);
});

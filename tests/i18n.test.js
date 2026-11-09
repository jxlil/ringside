import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { detectLanguage, t } from "../js/i18n.js";

test("Spanish devices get Spanish, everything else English", () => {
  assert.equal(detectLanguage(["es-MX"]), "es");
  assert.equal(detectLanguage(["es"]), "es");
  assert.equal(detectLanguage(["ES-419", "en-US"]), "es");
  assert.equal(detectLanguage(["en-US", "es-MX"]), "en");
  assert.equal(detectLanguage(["fr-FR", "es-ES"]), "es");
  assert.equal(detectLanguage(["fr-FR", "de"]), "en");
  assert.equal(detectLanguage([]), "en");
});

test("t fills placeholders and falls back to English", () => {
  assert.equal(t("roundOf", { i: 2, n: 3 }, "en"), "Round 2 / 3");
  assert.equal(t("setOf", { i: 2, n: 5 }, "es"), "Serie 2 / 5");
  assert.equal(t("finished", {}, "fr"), "Done!");
  assert.equal(t("no-such-key", {}, "es"), "no-such-key");
});

test("both languages define the same keys", async () => {
  const src = readFileSync(new URL("../js/i18n.js", import.meta.url), "utf8");
  const block = (lang) => src.slice(src.indexOf(`  ${lang}: {`), src.indexOf("\n  },", src.indexOf(`  ${lang}: {`)));
  const keys = (lang) => [...block(lang).matchAll(/^ {4}(\w+):/gm)].map((m) => m[1]).sort();
  assert.ok(keys("en").length > 40);
  assert.deepEqual(keys("es"), keys("en"));
});

test("every key used in index.html exists", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const used = [...html.matchAll(/data-i18n(?:-html|-label|-placeholder)?="(\w+)"/g)].map((m) => m[1]);
  assert.ok(used.length > 10);
  for (const key of used) assert.notEqual(t(key, {}, "en"), key, `missing ${key}`);
});

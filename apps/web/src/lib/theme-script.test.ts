import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEFAULT_THEME,
  parseTheme,
  THEME_INIT_SCRIPT,
  THEME_STORAGE_KEY,
} from "./theme-script";

test("parseTheme passes through the two real themes", () => {
  assert.equal(parseTheme("light"), "light");
  assert.equal(parseTheme("dark"), "dark");
});

test("parseTheme falls back for anything a store can actually hand back", () => {
  for (const value of [null, undefined, "", "Dark", "system", 0, {}]) {
    assert.equal(parseTheme(value), DEFAULT_THEME);
  }
});

test("the boot script reads the same key the store writes", () => {
  // The flash-of-wrong-theme bug is exactly this pair drifting apart, so it is
  // worth asserting rather than trusting the import.
  assert.ok(THEME_INIT_SCRIPT.includes(JSON.stringify(THEME_STORAGE_KEY)));
});

test("the boot script only ever adds the dark class, and cannot throw", () => {
  assert.ok(THEME_INIT_SCRIPT.includes('classList.add("dark")'));
  assert.ok(/^try\{/.test(THEME_INIT_SCRIPT));
  assert.ok(/catch\(e\)\{\}$/.test(THEME_INIT_SCRIPT));
});

test("the boot script has no closing tag that could break out of <script>", () => {
  assert.ok(!THEME_INIT_SCRIPT.includes("</"));
});

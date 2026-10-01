"use strict";

// Guards that the public copy only promises what each page actually delivers.
// Round C (2026-10-01) fixed title/meta/intro copy on pages that advertised
// features they did not implement, and the home page's stale current-version
// claim. These checks stop those over-claims from coming back.
//
// Run: node --test scripts/copy-claims.test.cjs

const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");

const ROOT = join(__dirname, "..");

function read(name) {
  return readFileSync(join(ROOT, name), "utf8");
}

test("drive-discs copy does not promise farm locations it never lists", () => {
  const page = read("drive-discs.html");
  assert.doesNotMatch(page, /farm spots/i, "drive-discs must not advertise farm spots");
  assert.doesNotMatch(page, /where to farm/i, "drive-discs must not promise where to farm");
  const home = read("index.html");
  const card = home.match(/href="\/drive-discs"[\s\S]{0,200}?<\/a>/i);
  assert.ok(card, "home page must link the drive-discs card");
  assert.doesNotMatch(card[0], /farming locations/i, "home drive-discs card must not promise farming locations");
});

test("w-engines copy does not promise numeric base stats it never lists", () => {
  assert.doesNotMatch(read("w-engines.html"), /base stats/i, "w-engines must not promise base stats");
  const home = read("index.html");
  const card = home.match(/href="\/w-engines"[\s\S]{0,200}?<\/a>/i);
  assert.ok(card, "home page must link the w-engines card");
  assert.doesNotMatch(card[0], /with stats/i, "home w-engines card must not promise stats");
});

test("team-builder is described as a written guide, not an interactive filter", () => {
  const page = read("tools/team-builder.html");
  assert.doesNotMatch(page, /filter by element/i, "team-builder must not promise element filtering");
  assert.doesNotMatch(page, /compose teams by element/i, "team-builder must not promise a team composer");
  assert.match(page, /Team Building Guide/, "team-builder must describe itself as a guide");
});

test("home page does not assert a stale current version alongside 3.2", () => {
  assert.doesNotMatch(read("index.html"), /Version 2\.8/, "home page must not mix 2.8 into a 3.2 page");
});

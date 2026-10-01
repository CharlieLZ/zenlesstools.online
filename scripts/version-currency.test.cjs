"use strict";

// Round D (2026-10-02) — version/date currency.
//
// Verified 2026-10-02 from primary sources: the live Zenless Zone Zero version
// is 3.2 "Their Secret Histories" (official update notice 2026/09/09 and
// Phase II content overview 2026/09/30 on zenless.hoyoverse.com; Steam patch
// notes 24927009). Version 2.8 "New: Eridan Sunset" launched 2026-05-06 and is
// not current. Pages that cannot be sourced to 3.2 must not claim a version at
// all, and no page may carry a "last updated" date we cannot verify.
//
// Run: node --test scripts/version-currency.test.cjs

const assert = require("node:assert/strict");
const { readFileSync, readdirSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");

const ROOT = join(__dirname, "..");

function shippedPages() {
  const names = readdirSync(ROOT).filter((f) => f.endsWith(".html"));
  for (const dir of ["characters", "tools"]) {
    for (const f of readdirSync(join(ROOT, dir))) {
      if (f.endsWith(".html")) names.push(`${dir}/${f}`);
    }
  }
  return names.map((name) => [name, readFileSync(join(ROOT, name), "utf8")]);
}

test("no page claims a version other than the verified current one", () => {
  for (const [name, html] of shippedPages()) {
    assert.doesNotMatch(html, /\b2\.8\b/, `${name} must not claim the superseded Version 2.8`);
  }
});

test("the pages that announce a version announce the verified one", () => {
  const home = readFileSync(join(ROOT, "index.html"), "utf8");
  assert.match(home, /Version 3\.2/, "home must state the verified current version");
  const banners = readFileSync(join(ROOT, "banners.html"), "utf8");
  assert.match(banners, /Version 3\.2/, "banners must state the verified current version");
});

test("no page carries a date we cannot verify", () => {
  for (const [name, html] of shippedPages()) {
    assert.doesNotMatch(html, /May 7, 2026/, `${name} must not carry the unverified May 7, 2026 date`);
    assert.doesNotMatch(html, /2026-05-07/, `${name} must not carry the unverified 2026-05-07 date`);
    assert.doesNotMatch(html, /Verified: May 2026/, `${name} must not carry the unverified May 2026 check`);
  }
});

test("ended events and phases are not advertised as live", () => {
  const events = readFileSync(join(ROOT, "events.html"), "utf8");
  assert.doesNotMatch(events, /Now Live/, "events must not call an ended phase live");
  assert.doesNotMatch(events, />Active</, "events must not mark ended events active");
  assert.doesNotMatch(events, /Coming Soon/, "events must not forecast a phase that already passed");
  const home = readFileSync(join(ROOT, "index.html"), "utf8");
  assert.doesNotMatch(home, />Active</, "home must not tag an ended event active");
});

test("crawler-facing files do not promise a last-updated timestamp", () => {
  const full = readFileSync(join(ROOT, "llms-full.txt"), "utf8");
  assert.doesNotMatch(full, /last-updated timestamp/i, "llms-full must not promise a timestamp the pages no longer show");
});

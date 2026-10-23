"use strict";

// Locks the /tools/material-calculator page as the ranking page for the GSC
// query "zzz leveling calculator" (2026-10-23 refresh). Guards: search-facing
// title/H1 lead with "Leveling Calculator", a direct short answer near the top,
// a visible FAQ that exactly mirrors the FAQPage JSON-LD, Article dateModified
// and sitemap lastmod currency, and the internal links that pass link equity.
//
// Run: node --test scripts/material-calculator.test.cjs

const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");

const ROOT = join(__dirname, "..");
const page = readFileSync(join(ROOT, "tools/material-calculator.html"), "utf8");

function jsonLdBlocks(html) {
  const blocks = [];
  const re = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;
  let match;
  while ((match = re.exec(html)) !== null) blocks.push(JSON.parse(match[1]));
  return blocks;
}

function tagContent(html, tag) {
  const match = html.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? match[1].trim() : null;
}

test("title, meta description and H1 lead with the leveling-calculator query", () => {
  assert.match(tagContent(page, "title"), /Leveling Calculator/);
  const desc = page.match(/<meta name="description" content="([^"]*)" \/>/)[1];
  assert.match(desc, /leveling calculator/);
  assert.ok(desc.length >= 120 && desc.length <= 160, `description length ${desc.length} outside 120-160`);
  assert.match(tagContent(page, "h1"), /Leveling Calculator/);
});

test("a direct short answer appears near the top", () => {
  assert.match(page, /Short answer: how ZZZ leveling works/);
  assert.match(page, /level up to <strong>60<\/strong>/);
  assert.match(page, /skill caps at <strong>12<\/strong>/);
});

test("visible FAQ exactly mirrors the FAQPage JSON-LD", () => {
  const faq = jsonLdBlocks(page).find((block) => block["@type"] === "FAQPage");
  assert.ok(faq, "FAQPage JSON-LD must exist");
  const schema = faq.mainEntity.map((q) => ({
    name: q.name,
    text: q.acceptedAnswer.text,
  }));
  const visible = [...page.matchAll(/<summary>(.*?)<\/summary><p>(.*?)<\/p>/g)].map((m) => ({
    name: m[1].trim(),
    text: m[2].trim(),
  }));
  assert.ok(visible.length >= 5, `expected >=5 visible FAQ items, got ${visible.length}`);
  assert.deepEqual(visible, schema, "visible FAQ and FAQPage JSON-LD must match in order");
});

test("Article JSON-LD and sitemap lastmod are dated 2026-10-23", () => {
  const article = jsonLdBlocks(page).find((block) => block["@type"] === "Article");
  assert.ok(article, "Article JSON-LD must exist");
  assert.equal(article.dateModified, "2026-10-23");
  const sitemap = readFileSync(join(ROOT, "sitemap.xml"), "utf8");
  const entry = sitemap.match(/<loc>https:\/\/zenlesstools\.online\/tools\/material-calculator<\/loc><lastmod>([^<]+)<\/lastmod>/);
  assert.ok(entry, "sitemap must list the material-calculator URL");
  assert.equal(entry[1], "2026-10-23");
});

test("page links out to the related tools and guides", () => {
  for (const href of ["/tier-list", "/characters/", "/w-engines", "/drive-discs", "/tools/pull-planner"]) {
    assert.match(page, new RegExp(`href="${href}"`), `missing internal link ${href}`);
  }
});

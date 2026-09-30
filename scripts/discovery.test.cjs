"use strict";

// Locks the robots.txt / llms.txt / llms-full.txt / sitemap.xml contract for
// zenlesstools.online. The four files are the only discovery surface this site
// ships; nothing here renders UI, it only guards the crawler contract.
//
// Run: node --test scripts/discovery.test.cjs

const assert = require("node:assert/strict");
const { readFileSync, existsSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");

const ROOT = join(__dirname, "..");
const ORIGIN = "https://zenlesstools.online";

// ADR-B1: one constant, so reverting the "admit AI crawlers" decision is a
// one-line change. Order is kept exactly as approved in the fleet constant.
const AI_CRAWLERS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-SearchBot",
  "Claude-User",
  "anthropic-ai",
  "Claude-Web",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "GoogleOther",
  "Google-CloudVertexBot",
  "Applebot",
  "Applebot-Extended",
  "Meta-ExternalAgent",
  "Meta-ExternalFetcher",
  "Meta-WebIndexer",
  "FacebookBot",
  "Amazonbot",
  "CCBot",
  "Bytespider",
  "DuckAssistBot",
  "MistralAI-User",
  "cohere-ai",
  "cohere-training-data-crawler",
  "YouBot",
  "AI2Bot",
  "Diffbot",
  "Timpibot",
  "omgili",
  "Gemini-Deep-Research",
  "Google-NotebookLM",
  "GoogleAgent-URLContext",
  "DeepSeekBot",
  "ChatGLM-Spider",
  "DoubaoBot",
  "Kimi-SearchBot",
  "Kimi-User",
  "KimiBot",
  "QwenBot",
  "TongyiBot",
  "YiyanBot",
  "ERNIEBot",
  "PanguBot",
  "MistralAI-Index",
  "Amzn-SearchBot",
  "Bravebot",
  "PhindBot",
];

function read(name) {
  return readFileSync(join(ROOT, name), "utf8");
}

// Mirrors RFC 9309 grouping: consecutive User-agent lines share one group and
// a group ends when a rule is followed by a new User-agent line.
function parseRobots(text) {
  const groups = [];
  const sitemaps = [];
  let current = null;
  let seenRule = false;
  for (const raw of text.split("\n")) {
    const line = raw.split("#", 1)[0].trim();
    if (!line || !line.includes(":")) continue;
    const index = line.indexOf(":");
    const key = line.slice(0, index).trim().toLowerCase();
    const value = line.slice(index + 1).trim();
    if (key === "user-agent") {
      if (current === null || seenRule) {
        current = { agents: [], allow: [], disallow: [] };
        groups.push(current);
        seenRule = false;
      }
      current.agents.push(value);
    } else if (key === "allow" || key === "disallow") {
      if (current === null) continue;
      seenRule = true;
      current[key].push(value);
    } else if (key === "sitemap") {
      sitemaps.push(value);
    }
  }
  return { groups, sitemaps };
}

function groupFor(groups, agent) {
  const wanted = agent.toLowerCase();
  return groups.find((group) => group.agents.some((a) => a.toLowerCase() === wanted));
}

function siteFile(url) {
  const parsed = new URL(url);
  const relative = parsed.pathname.replace(/^\//, "");
  if (!relative) return join(ROOT, "index.html");
  if (relative.endsWith("/")) return join(ROOT, relative, "index.html");
  return [join(ROOT, `${relative}.html`), join(ROOT, relative, "index.html")].find(existsSync) || null;
}

test("robots.txt names the site sitemap and keeps a wildcard group", () => {
  const { groups, sitemaps } = parseRobots(read("robots.txt"));
  assert.deepEqual(sitemaps, [`${ORIGIN}/sitemap.xml`]);
  const star = groupFor(groups, "*");
  assert.ok(star, "robots.txt must keep a User-agent: * group");
  assert.ok(star.allow.includes("/"), "* group must allow /");
});

test("robots.txt admits every named AI crawler", () => {
  const { groups } = parseRobots(read("robots.txt"));
  const starred = new Set();
  for (const group of groups) {
    for (const agent of group.agents) starred.add(agent.toLowerCase());
  }
  const missing = AI_CRAWLERS.filter((ua) => !starred.has(ua.toLowerCase()));
  assert.deepEqual(missing, [], `robots.txt must name every AI crawler (missing ${missing.join(", ")})`);
});

test("named AI groups repeat the wildcard rules (RFC 9309)", () => {
  const { groups } = parseRobots(read("robots.txt"));
  const star = groupFor(groups, "*");
  for (const ua of AI_CRAWLERS) {
    const group = groupFor(groups, ua);
    assert.ok(group, `${ua} group must exist`);
    assert.deepEqual(
      [...group.allow].sort(),
      [...star.allow].sort(),
      `${ua} group Allow must equal the * group Allow`
    );
    assert.deepEqual(
      [...group.disallow].sort(),
      [...star.disallow].sort(),
      `${ua} group Disallow must equal the * group Disallow`
    );
  }
});

test("robots.txt never blocks render or structured-data assets", () => {
  const { groups } = parseRobots(read("robots.txt"));
  for (const group of groups) {
    for (const rule of group.disallow) {
      assert.ok(!rule.startsWith("/_next"), `must not block /_next (${rule})`);
      assert.ok(!rule.endsWith(".json$"), `must not block JSON (${rule})`);
      for (const asset of ["/assets/", ".js", ".css"]) {
        assert.ok(!rule.startsWith(asset), `must not block ${asset} (${rule})`);
      }
    }
  }
});

test("robots.txt keeps the llms files crawlable", () => {
  const { groups } = parseRobots(read("robots.txt"));
  const star = groupFor(groups, "*");
  for (const path of ["/llms.txt", "/llms-full.txt"]) {
    const blocked = star.disallow.some((rule) => {
      const prefix = rule.replace(/[*$]+$/, "");
      return prefix && prefix !== "/" && path.startsWith(prefix);
    });
    assert.ok(!blocked, `${path} must not be disallowed`);
  }
});

test("llms.txt follows llmstxt.org structure", () => {
  const body = read("llms.txt");
  const lines = body.split("\n");
  const first = lines.find((line) => line.trim());
  assert.match(first, /^# /, "first content line must be the single H1");
  assert.equal(lines.filter((line) => line.startsWith("# ")).length, 1);
  assert.ok(
    lines.slice(0, 15).some((line) => line.startsWith("> ")),
    "an H1 must be followed by a blockquote summary"
  );
  const h2 = lines.filter((line) => line.startsWith("## ")).map((line) => line.slice(3).trim());
  assert.ok(h2.length > 0, "llms.txt must contain H2 file lists");
  if (h2.includes("Optional")) {
    assert.equal(h2[h2.length - 1], "Optional", "## Optional must be the last section");
  }
  assert.ok(!/^\s*</m.test(body), "llms.txt must be markdown, not HTML");
});

test("llms.txt links resolve to real pages", () => {
  const body = read("llms.txt");
  const links = [...body.matchAll(/\[[^\]]+\]\((https?:\/\/[^)\s]+)\)/g)].map((match) => match[1]);
  assert.ok(links.length >= 10, `llms.txt must link the main pages (found ${links.length})`);
  assert.ok(links.length <= 40, `llms.txt must stay compact (found ${links.length})`);
  const sameSite = [...new Set(links.filter((url) => new URL(url).hostname === "zenlesstools.online"))];
  assert.ok(sameSite.length >= 10, "most links must be same-site canonical pages");
  for (const url of sameSite) {
    assert.equal(url, url.split("?")[0].split("#")[0], `${url} must be a clean canonical URL`);
    assert.ok(siteFile(url), `${url} must map to a file that exists in the repo`);
  }
  assert.ok(
    sameSite.includes(`${ORIGIN}/`),
    "llms.txt must link the home page"
  );
});

test("llms-full.txt is plain markdown with the same H1", () => {
  const full = read("llms-full.txt");
  const summary = read("llms.txt");
  const h1 = summary.split("\n").find((line) => line.trim());
  assert.equal(full.split("\n").find((line) => line.trim()), h1, "same H1 as llms.txt");
  assert.ok(full.length > 800, "llms-full.txt must carry real content");
  assert.ok(!/^\s*<!doctype|^\s*<html/im.test(full), "llms-full.txt must not be HTML");
});

test("sitemap.xml lists only real canonical pages on this host", () => {
  const body = read("sitemap.xml");
  const locs = [...body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1].trim());
  assert.ok(locs.length > 0, "sitemap.xml must list pages");
  assert.equal(new Set(locs).size, locs.length, "sitemap.xml must not repeat URLs");
  for (const loc of locs) {
    assert.ok(loc.startsWith(`${ORIGIN}/`), `${loc} must use the canonical host`);
    assert.ok(!loc.endsWith(".html"), `${loc} must use the extensionless route`);
    assert.ok(siteFile(loc), `${loc} must map to a file in the repo`);
  }
});

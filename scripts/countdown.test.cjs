const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");
const vm = require("node:vm");

// Synthetic timestamps exercise arithmetic, not a claim about any game server.
const deadline = "2030-01-02T03:04:05Z";
const deadlineMs = Date.parse(deadline);

function fixture(now = deadlineMs - 1000) {
  const elements = new Map();
  const timers = new Map();
  let nextTimer = 0;
  let clock = now;
  function element() {
    return {
      dataset: {}, style: {}, attributes: {}, innerHTML: "", textContent: "",
      setAttribute(name, value) { this.attributes[name] = value; },
      replaceChildren(child) { this.innerHTML = ""; this.textContent = child.textContent; }
    };
  }
  const context = vm.createContext({
    Date: class extends Date { static now() { return clock; } },
    document: {
      addEventListener() {},
      getElementById(id) { return elements.get(id) || null; },
      createElement: element
    },
    setInterval(callback) { timers.set(++nextTimer, callback); return nextTimer; },
    clearInterval(id) { timers.delete(id); }
  });
  vm.runInContext(readFileSync(join(__dirname, "../assets/js/main.js"), "utf8"), context);
  const el = element();
  elements.set("countdown", el);
  return {
    context, el, timers, elements,
    setNow(value) { clock = value; },
    tick() { [...timers.values()].forEach((callback) => callback()); }
  };
}

test("unknown and invalid deadlines are explicit, never NaN", () => {
  const { context, el, timers } = fixture();
  for (const value of [null, undefined, ""]) {
    assert.equal(context.getCountdownState(value).state, "unknown");
    context.initCountdown("countdown", value, "Fixture");
    assert.match(el.textContent, /unverified/);
  }
  for (const value of [
    "not-a-date", "2030-01-02T03:04:05", "2030-01-02", 123,
    "2030-02-29T03:04:05Z", "2030-02-30T03:04:05Z", "2030-04-31T03:04:05Z",
    "2030-13-01T03:04:05Z", "2030-01-00T03:04:05Z", "2030-01-02T24:00:00Z",
    "2030-01-02T03:60:05Z", "2030-01-02T03:04:60Z", "2030-01-02T03:04:05+14:01",
    "2030-01-02T03:04:05-00:00", "2030-01-02T03:04:05+08:60"
  ]) {
    assert.equal(context.getCountdownState(value).state, "invalid", String(value));
    context.initCountdown("countdown", value, "Fixture");
    assert.equal(el.dataset.state, "invalid");
    assert.match(el.textContent, /unavailable/);
    assert.doesNotMatch(el.innerHTML + el.textContent, /NaN/);
  }
  assert.equal(context.getCountdownState(deadline, NaN).state, "invalid");
  assert.equal(timers.size, 0);
});

test("explicit offsets describe the same instant independent of local timezone", () => {
  const { context } = fixture();
  for (const value of [deadline, "2030-01-02T11:04:05+08:00", "2030-01-01T22:04:05-05:00"]) {
    const result = context.getCountdownState(value, deadlineMs - 90061000);
    assert.equal(result.state, "counting");
    assert.equal(result.remainingSeconds, 90061);
  }
  assert.equal(context.getCountdownState("2032-02-29T00:00:00Z", deadlineMs).state, "counting");
});

test("future output shows days, hours, minutes and seconds without premature zero", () => {
  const f = fixture(deadlineMs - 90061000);
  f.context.initCountdown("countdown", deadline, "Fixture");
  assert.equal(f.el.dataset.state, "counting");
  assert.match(f.el.attributes["aria-label"], /1 days, 1 hours, 1 minutes, 1 seconds remaining/);
  assert.equal(f.el.attributes["aria-live"], "off");
  assert.equal(f.timers.size, 1);
  f.setNow(deadlineMs - 1);
  f.tick();
  assert.match(f.el.attributes["aria-label"], /0 days, 0 hours, 0 minutes, 1 seconds remaining/);
  assert.equal(f.el.dataset.state, "counting");
});

test("deadline equality and later times show ended and stop the timer", () => {
  const f = fixture();
  f.context.initCountdown("countdown", deadline, "Fixture");
  f.setNow(deadlineMs);
  f.tick();
  assert.equal(f.el.dataset.state, "ended");
  assert.equal(f.el.textContent, "Fixture ended");
  assert.equal(f.timers.size, 0);
  assert.equal(f.context.getCountdownState(deadline, deadlineMs + 1).remainingSeconds, 0);
  f.context.initCountdown("countdown", "2026-05-27T11:59:00Z", "Old fixture");
  assert.equal(f.el.dataset.state, "ended");
  assert.equal(f.timers.size, 0);
});

test("reinitialization replaces its timer and cannot overwrite an unknown state", () => {
  const f = fixture();
  f.context.initCountdown("countdown", deadline, "First");
  f.context.initCountdown("countdown", deadline, "Second");
  assert.equal(f.timers.size, 1);
  f.context.initCountdown("countdown", null, "Unknown");
  f.tick();
  assert.equal(f.timers.size, 0);
  assert.equal(f.el.dataset.state, "unknown");
  f.context.initCountdown("countdown", deadline, "Third");
  f.elements.delete("countdown");
  f.tick();
  assert.equal(f.timers.size, 0);
  f.context.initCountdown("missing", deadline, "Missing");
  assert.equal(f.timers.size, 0);
});

test("ended labels are text rather than injected markup", () => {
  const f = fixture(deadlineMs);
  const label = '<img src=x onerror="alert(1)">';
  f.context.initCountdown("countdown", deadline, label);
  assert.equal(f.el.textContent, label + " ended");
  assert.equal(f.el.innerHTML, "");
});

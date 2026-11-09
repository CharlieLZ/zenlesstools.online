// Shared utilities for ZZZ Tools Hub

// Copy button handler
function initCopyButtons() {
  document.querySelectorAll("[data-copy]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const code = btn.dataset.copy;
      try {
        await navigator.clipboard.writeText(code);
        const orig = btn.textContent;
        btn.textContent = "Copied!";
        btn.classList.add("copied");
        setTimeout(() => { btn.textContent = orig; btn.classList.remove("copied"); }, 1500);
      } catch {
        // fallback
        const ta = document.createElement("textarea");
        ta.value = code;
        ta.style.position = "fixed"; ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        const orig = btn.textContent;
        btn.textContent = "Copied!";
        setTimeout(() => { btn.textContent = orig; }, 1500);
      }
    });
  });
}

// Countdown deadlines must include a verified UTC offset, never browser-local time.
function getCountdownState(endDateStr, now = Date.now()) {
  if (endDateStr == null || endDateStr === "") return { state: "unknown" };
  const parts = typeof endDateStr === "string" && endDateStr.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/
  );
  if (!parts || !Number.isFinite(now)) return { state: "invalid" };
  const [, year, month, day, hour, minute, second, zone] = parts;
  const leapYear = +year % 4 === 0 && (+year % 100 !== 0 || +year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const offsetHours = zone === "Z" ? 0 : +zone.slice(1, 3);
  const offsetMinutes = zone === "Z" ? 0 : +zone.slice(4, 6);
  if (+month < 1 || +month > 12 || +day < 1 || +day > daysInMonth[+month - 1] ||
      +hour > 23 || +minute > 59 || +second > 59 || offsetHours > 14 ||
      offsetMinutes > 59 || (offsetHours === 14 && offsetMinutes !== 0) || zone === "-00:00") {
    return { state: "invalid" };
  }
  const deadline = Date.parse(endDateStr);
  if (!Number.isFinite(deadline)) return { state: "invalid" };
  const remainingMs = Math.max(0, deadline - now);
  return {
    state: remainingMs === 0 ? "ended" : "counting",
    // Keep one second visible until the actual deadline, including fractional seconds.
    remainingSeconds: Math.ceil(remainingMs / 1000)
  };
}

const countdownTimers = new WeakMap();

function initCountdown(elementId, endDateStr, label) {
  const el = document.getElementById(elementId);
  if (!el) return;
  const previousTimer = countdownTimers.get(el);
  if (previousTimer !== undefined) clearInterval(previousTimer);
  countdownTimers.delete(el);
  el.setAttribute("role", "timer");
  // A ticking countdown should be readable on demand without announcing every second.
  el.setAttribute("aria-live", "off");

  function stop() {
    const timer = countdownTimers.get(el);
    if (timer !== undefined) clearInterval(timer);
    countdownTimers.delete(el);
  }

  function update() {
    if (document.getElementById(elementId) !== el) {
      stop();
      return false;
    }
    const result = getCountdownState(endDateStr);
    el.dataset.state = result.state;
    if (result.state !== "counting") {
      const message = result.state === "ended"
        ? (label ? `${label} ended` : "Ended")
        : result.state === "unknown"
          ? "Schedule unverified — check the official notice."
          : "Countdown unavailable — deadline or timezone is invalid or unverified.";
      const text = document.createElement("span");
      text.style.gridColumn = "1 / -1";
      text.textContent = message;
      el.replaceChildren(text);
      el.setAttribute("aria-label", message);
      stop();
      return false;
    }
    const total = result.remainingSeconds;
    const d = Math.floor(total / 86400);
    const h = Math.floor((total % 86400) / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    el.setAttribute("aria-label", `${label ? label + ": " : ""}${d} days, ${h} hours, ${m} minutes, ${s} seconds remaining`);
    el.innerHTML = `
      <div class="time-box"><strong>${d}</strong><span>Days</span></div>
      <div class="time-box"><strong>${String(h).padStart(2,"0")}</strong><span>Hours</span></div>
      <div class="time-box"><strong>${String(m).padStart(2,"0")}</strong><span>Mins</span></div>
      <div class="time-box"><strong>${String(s).padStart(2,"0")}</strong><span>Secs</span></div>
    `;
    return true;
  }
  if (update()) countdownTimers.set(el, setInterval(update, 1000));
}

// Prefill the planner from links such as /tools/pull-planner?goal=Lucia&poly=16000
function applyPlannerQuery() {
  const params = new URLSearchParams(window.location.search);
  const goal = (params.get("goal") || "").trim().slice(0, 100);
  if (goal) {
    const goalEl = document.getElementById("goalName");
    if (goalEl) goalEl.value = goal;
  }
  for (const key of ["poly", "tapes", "pity"]) {
    const raw = params.get(key);
    if (raw == null || !/^\d+$/.test(raw)) continue;
    const el = document.getElementById(key);
    if (el) el.value = String(Math.min(Number(raw), key === "pity" ? 89 : 100000000));
  }
}

// Pull planner calculator
function initPullPlanner() {
  const btn = document.getElementById("calculateBtn");
  if (!btn) return;
  applyPlannerQuery();
  btn.addEventListener("click", () => calculate(true));
  initPlannerStorage();
  calculate();
}

function plannerValuesValid(p) {
  return !!p && [p.poly, p.tapes, p.pity, p.target, p.days].every(value => Number.isSafeInteger(value) && value >= 0)
    && p.pity <= 89 && p.target >= 1 && p.target <= 90 && Number.isFinite(p.daily) && p.daily >= 0
    && ["yes", "no"].includes(p.guaranteed) && typeof p.goal === "string" && p.goal.length <= 100
    && Number.isSafeInteger(Math.floor(p.poly / 160) + p.tapes + Math.floor(p.days * p.daily));
}

function trackPlannerAction(name) {
  if (navigator.doNotTrack === "1" || navigator.globalPrivacyControl === true) return;
  const props = { tool: "pull_planner", qa_internal: new URLSearchParams(window.location.search).get("qa") === "1" };
  try { window.gtag?.("event", name, props); } catch { /* Saving never depends on analytics. */ }
  try { window.plausible?.(name, { props }); } catch { /* Optional analytics. */ }
}

function initPlannerStorage() {
  const save = document.getElementById("savePlanBtn"), restore = document.getElementById("restorePlanBtn"), status = document.getElementById("planStorageStatus");
  if (!save || !restore || !status) return;
  const key = "zzz-pull-plan-v1";
  const fields = {poly:"poly",tapes:"tapes",pity:"pity",target:"target",days:"daysLeftInput",daily:"dailyIncome",guaranteed:"guaranteed",goal:"goalName"};
  save.addEventListener("click", () => {
    const inputs = calculate(false);
    if (!inputs) { status.textContent = "Fix the inputs before saving. Your previous saved plan has not changed."; return; }
    try {
      const savedAt = new Date().toISOString();
      localStorage.setItem(key, JSON.stringify({version:1, savedAt, lastVisitDay:savedAt.slice(0,10), inputs}));
      status.textContent = "Saved in this browser. Restore it on your next visit and update your resources and remaining days.";
      trackPlannerAction("plan_saved");
    } catch { status.textContent = "Browser storage is unavailable. You can still calculate, but this plan was not saved."; }
  });
  restore.addEventListener("click", () => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) { status.textContent = "No saved plan in this browser yet."; return; }
      if (raw.length > 10000) throw new Error("invalid saved plan");
      const saved = JSON.parse(raw);
      if (saved?.version !== 1 || !plannerValuesValid(saved.inputs) || typeof saved.savedAt !== "string" || !Number.isFinite(Date.parse(saved.savedAt))) throw new Error("invalid saved plan");
      for (const [name, id] of Object.entries(fields)) document.getElementById(id).value = String(saved.inputs[name]);
      calculate(false);
      status.textContent = `Restored the snapshot saved ${saved.savedAt.slice(0,10)}. Update resources and remaining days before using it; future income has not been earned automatically.`;
      trackPlannerAction("plan_restored");
      const today = new Date().toISOString().slice(0,10);
      if (saved.savedAt.slice(0,10) < today && saved.lastVisitDay !== today) {
        saved.lastVisitDay = today;
        try { localStorage.setItem(key, JSON.stringify(saved)); trackPlannerAction("plan_daily_return"); } catch { /* Restore still works; no duplicate return claim without persistence. */ }
      }
    } catch { status.textContent = "Saved plan unavailable or invalid. Your current inputs were kept; calculation still works."; }
  });
}

// Home-page quick pull budget check
function initMiniPullCheck() {
  const form = document.getElementById("miniCalc");
  if (!form) return;
  const polyEl = document.getElementById("miniPoly");
  const tapesEl = document.getElementById("miniTapes");
  const resultEl = document.getElementById("miniResult");
  const fullLink = document.getElementById("miniFullLink");
  const wholeNumber = (el) => {
    const value = Number(el?.value);
    return Number.isSafeInteger(value) && value >= 0 ? value : 0;
  };
  function render(track = false) {
    const poly = wholeNumber(polyEl);
    const tapes = wholeNumber(tapesEl);
    const pulls = Math.floor(poly / 160) + tapes;
    if (resultEl) {
      resultEl.textContent = `${pulls.toLocaleString()} pull${pulls === 1 ? "" : "s"} available now — ${poly.toLocaleString()} Polychrome + ${tapes} Master Tape${tapes === 1 ? "" : "s"}.`;
    }
    if (fullLink) fullLink.href = `/tools/pull-planner?poly=${poly}&tapes=${tapes}`;
    if (track === true && navigator.doNotTrack !== "1" && navigator.globalPrivacyControl !== true) {
      const query = new URLSearchParams(window.location.search);
      const properties = {
        tool: "home_mini",
        outcome: pulls > 0 ? "has_pulls" : "no_pulls",
        qa_internal: query.get("qa") === "1" || query.get("utm_source") === "qa-internal"
      };
      try { if (typeof window.gtag === "function") window.gtag("event", "calculator_complete", properties); }
      catch { console.warn("Mini pull check analytics unavailable: google"); }
    }
  }
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    render(true);
  });
  polyEl?.addEventListener("input", () => render(false));
  tapesEl?.addEventListener("input", () => render(false));
  render(false);
}

// Sticky mobile action for the full planner
function initMobileCalcBar() {
  const btn = document.getElementById("mobileCalcBtn");
  if (!btn) return;
  btn.addEventListener("click", () => {
    calculate(true);
    const result = document.querySelector(".result");
    if (!result) return;
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    result.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
  });
}

function calculate(track = false) {
  const get = (id, fallback = 0) => {
    const raw = document.getElementById(id)?.value;
    return raw == null || raw.trim() === "" ? fallback : Number(raw);
  };
  const poly = get("poly");
  const tapes = get("tapes");
  const pity = get("pity");
  const target = get("target", 90);
  const days = get("daysLeftInput");
  const daily = get("dailyIncome");
  const guaranteed = document.getElementById("guaranteed")?.value;
  const goal = document.getElementById("goalName")?.value.trim().slice(0, 100) || "your target";

  const currentPulls = Math.floor(poly / 160) + tapes;
  const futurePulls = Math.floor(days * daily);
  const available = currentPulls + futurePulls;
  const needed = Math.max(0, target - pity);
  const gap = Math.max(0, needed - available);

  const availEl = document.getElementById("availablePulls");
  const titleEl = document.getElementById("plannerTitle");
  const textEl = document.getElementById("plannerText");
  const chipsEl = document.getElementById("plannerChips");
  const plan = {poly, tapes, pity, target, days, daily, guaranteed, goal};
  const valid = plannerValuesValid(plan)
    && ["poly", "tapes", "pity", "target", "daysLeftInput", "dailyIncome"].every(id => !document.getElementById(id)?.validity?.badInput);
  if (!valid) {
    if (availEl) availEl.textContent = "—";
    if (titleEl) titleEl.textContent = "Check your inputs";
    if (textEl) textEl.textContent = "Use non-negative whole numbers for savings and days, pity from 0–89, and a planning threshold from 1–90. Daily income must be a finite, non-negative number.";
    if (chipsEl) chipsEl.innerHTML = "";
    return;
  }
  if (availEl) availEl.textContent = available;
  if (titleEl) titleEl.textContent = available >= needed ? "Planning threshold covered" : `Budget short for ${goal}`;
  if (textEl) {
    let t = `Need ~${needed} pulls to your ${target}-pull planning threshold (from ${pity} pity). Your estimated budget is ~${available} pulls. `;
    t += available >= needed
      ? "This covers your chosen planning threshold. "
      : `Estimated gap: ${gap} pulls. `;
    if (target < 90) t += "A threshold below 90 is an estimate, not a guarantee. ";
    if (guaranteed === "no") t += "The featured agent is not guaranteed by this first cycle: a lost 50/50 needs another cycle. ";
    else t += "Featured-agent guarantee is based on the status you entered; future income is still an estimate. ";
    const hard = 90 - pity, featured = hard + (guaranteed === "yes" ? 0 : 90);
    t += ` Under the standard Exclusive Agent 90-pull / 50-50 rules, budget up to ${hard} more pulls for the next S-rank and ${featured} for the featured agent in the worst case. You hold ${currentPulls} pulls now; ${futurePulls} future pulls are only an estimate. A budget gap is not a recommendation to spend: keep your limit or skip this banner.`;
    textEl.textContent = t;
  }
  if (chipsEl) {
    chipsEl.innerHTML = "";
    [currentPulls + " now", futurePulls + " estimated future", gap + " threshold gap", guaranteed === "yes" ? "Guarantee entered" : "50/50"].forEach((c) => {
      const s = document.createElement("span");
      s.className = "chip";
      s.textContent = c;
      chipsEl.appendChild(s);
    });
  }
  if (track === true && navigator.doNotTrack !== "1" && navigator.globalPrivacyControl !== true) {
    const query = new URLSearchParams(window.location.search);
    const properties = { tool: "pull_planner", outcome: available >= needed ? "covered" : "short",
      guaranteed: guaranteed === "yes", qa_internal: query.get("qa") === "1" || query.get("utm_source") === "qa-internal" };
    try { if (typeof window.gtag === "function") window.gtag("event", "calculator_complete", properties); }
    catch { console.warn("Pull planner analytics unavailable: google"); }
    try { if (typeof window.plausible === "function") window.plausible("calculator_complete", { props: properties }); }
    catch { console.warn("Pull planner analytics unavailable: plausible"); }
  }
  return plan;
}

// Material calculator
function initMaterialCalc() {
  document.querySelectorAll(".mat-calc input").forEach((inp) => {
    inp.addEventListener("input", calcMaterials);
  });
  calcMaterials();
}

function calcMaterials() {
  const get = (id) => Number(document.getElementById(id)?.value || 0);
  const lvl = get("charLevel");
  const skill = get("skillLevel");
  const wengine = get("wengineLevel");
  const results = [
    { name: "Investigation Merits", qty: Math.round(lvl * 0.8 + skill * 0.3 + wengine * 0.2) },
    { name: "Dennies", qty: Math.round(lvl * 2800 + skill * 1500 + wengine * 1800) },
    { name: "Core Skill Materials", qty: Math.round(skill * 0.5) },
    { name: "W-Engine Components", qty: Math.round(wengine * 0.6) },
    { name: "Expert Challenge Logs", qty: Math.round(lvl * 0.4 + skill * 0.3) },
    { name: "Ascension Seals", qty: Math.round(lvl * 0.25) },
  ];
  results.push({
    name: "Estimated days (180 stamina/day)",
    qty: Math.max(1, Math.round((lvl * 0.4 + skill * 0.3 + wengine * 0.3) / 2))
  });
  const tbody = document.getElementById("matResults");
  if (!tbody) return;
  tbody.innerHTML = results.map((r) => `<tr><td>${r.name}</td><td>${r.qty.toLocaleString()}</td></tr>`).join("");
}

// Checklist saves state to localStorage
function initChecklist() {
  document.querySelectorAll(".checklist-item input[type='checkbox']").forEach((cb) => {
    const key = "zzz-cl-" + (cb.id || Math.random());
    cb.checked = localStorage.getItem(key) === "1";
    cb.closest(".checklist-item")?.classList.toggle("completed", cb.checked);
    cb.addEventListener("change", () => {
      localStorage.setItem(key, cb.checked ? "1" : "0");
      cb.closest(".checklist-item")?.classList.toggle("completed", cb.checked);
    });
  });
}

// Initialize everything on DOM ready
document.addEventListener("DOMContentLoaded", () => {
  initCopyButtons();
  initPullPlanner();
  initMiniPullCheck();
  initMaterialCalc();
  initChecklist();
  initMobileCalcBar();
});

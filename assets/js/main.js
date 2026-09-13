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

// Pull planner calculator
function initPullPlanner() {
  const btn = document.getElementById("calculateBtn");
  if (!btn) return;
  btn.addEventListener("click", calculate);
  calculate();
}

function calculate() {
  const get = (id) => Number(document.getElementById(id)?.value || 0);
  const poly = get("poly");
  const tapes = get("tapes");
  const pity = get("pity");
  const target = get("target") || 90;
  const days = get("daysLeftInput");
  const daily = get("dailyIncome");
  const guaranteed = document.getElementById("guaranteed")?.value;
  const goal = document.getElementById("goalName")?.value || "your target";

  const currentPulls = Math.floor(poly / 160) + tapes;
  const futurePulls = Math.floor(days * daily);
  const available = currentPulls + futurePulls;
  const needed = Math.max(0, target - pity);
  const gap = Math.max(0, needed - available);

  const availEl = document.getElementById("availablePulls");
  const titleEl = document.getElementById("plannerTitle");
  const textEl = document.getElementById("plannerText");
  const chipsEl = document.getElementById("plannerChips");
  if (availEl) availEl.textContent = available;
  if (titleEl) titleEl.textContent = available >= needed ? `Ready for ${goal}` : `Short for ${goal}`;
  if (textEl) {
    let t = `Need ~${needed} pulls (from ${pity} pity). You have ~${available} pulls. `;
    t += available >= needed
      ? "You should reach your target before the banner ends."
      : `Estimated gap: ${gap} pulls. Farm dailies and events to close it.`;
    if (guaranteed === "no") t += " Not guaranteed — plan for a possible second pity.";
    textEl.textContent = t;
  }
  if (chipsEl) {
    chipsEl.innerHTML = "";
    [currentPulls + " now", futurePulls + " future", gap + " gap", guaranteed === "yes" ? "Guaranteed" : "50/50"].forEach((c) => {
      const s = document.createElement("span");
      s.className = "chip";
      s.textContent = c;
      chipsEl.appendChild(s);
    });
  }
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
  initMaterialCalc();
  initChecklist();
});

# Pull planning

- `tools/pull-planner.html` and `assets/js/main.js`: owned versus estimated pulls, conditional 90/50-50 worst-case budget, explicit browser-local save and restore. No account sync, payment or earned-rewards claim.
- `scripts/pull-planner.test.cjs`: validation, guarantee boundaries, corrupted/blocked storage, daily-return deduplication and privacy.
- `/tools/pull-planner?qa=1`: runtime proof with 14,400 Polychrome, 89 pity and both guarantee states; save, reload, restore; test denied storage and invalid snapshots. Analytics never include goal text or exact budget.
- `banners.html`, `events.html`, `codes.html`: dated official sources, no guessed server offset or unsupported active-code label. Source check 2026-11-09; recheck in-game Details before using a deadline.
- Build with `node scripts/build-static.mjs`; `scripts/check-release.mjs <merged SHA>` verifies native Pages, public build identity and Access protection.

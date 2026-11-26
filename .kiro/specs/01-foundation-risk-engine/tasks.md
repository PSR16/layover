# Spec 1: Foundation and risk engine (tasks)

Status: DRAFT. Order matters: pure logic first (testable alone), then data, then API, then UI. Each task is one commit. Run `npm test` before every commit.
Format: `Task N. Title` then requirements, files, tests. Mark done with `[x]` and add the commit hash.

## Phase 1: Risk engine (pure logic)

- [ ] **Task 1. Evidence check and research table update.**
  Confirm the wind-direction convention ("from" versus "toward") in Chen et al. 2024. Add E18 to E21 rows to `docs/research.md` (Muenchow 2026, Farnsworth 2024, Horton 2019, Klem 2025) with a "how Layover uses it" line each. Record the result in the design (section 9, point 1).
  Requirements: R16, R17, R13. Files: `docs/research.md`, `design.md`. Tests: none.
- [ ] **Task 2. Season and wind helpers.**
  `season.js` (season from a date and config dates) and `wind.js` (is a direction inside a sector, including the 0/360 wrap; shift between two directions).
  Requirements: R16, R17, R19. Tests: unit tests at the 0/360 boundary and season edges.
- [ ] **Task 3. Default config.**
  `risk-config.js` with weights, evidence IDs or "assumption", thresholds, wind sectors, season dates, reason text and `notes`.
  Requirements: R23, R30, R35. Tests: shape test (every weight has evidence).
- [ ] **Task 4. Config validator and merge.**
  `risk-config-validate.js`: `validateConfig` (six rules in design section 5) and `mergeConfig`.
  Requirements: R32, R33. Tests: one unit test per rejection rule, plus property test: any config that passes obeys R10, R13 and ordered thresholds.
- [ ] **Task 5. Night factors.**
  In `risk-factors.js`: migration, wind, wind shift, visibility, carry-over, season. Each returns `{ id, points, reasonKey, missing }`.
  Requirements: R10 to R12, R15 to R19, R22. Tests: unit tests per factor, monotonicity property tests for migration.
- [ ] **Task 6. Place factors.**
  In `risk-factors.js`: lit glass, tree, kind (stadium, arena, installation), height. No compass input exists.
  Requirements: R12, R13, R20, R21. Tests: lit-glass monotonicity, height weaker than glass, compass direction cannot change the score.
- [ ] **Task 7. Combine and assess.**
  `risk-combine.js` and `risk.js`: `assessNight`, `assessPlace`, `rankPlaces`. Includes the light multiplier, thresholds, weather-only cap and floor, missing-migration cap, trace and `configVersion`. Reasons come from config text.
  Requirements: R9, R14, R15, R22, R24, R25, R31, R33, R34. Tests: the full property table in `requirements.md`, including determinism, stable ranking, "never empty reasons", "add a dummy factor changes only its own trace entry".

## Phase 2: Data and weather

- [ ] **Task 8. Weather normalizer.**
  `weather-normalize.js`: Open-Meteo and weather.gov JSON to `Conditions.weather`, including dawn wind direction.
  Requirements: R27, R29. Tests: unit tests against recorded sample responses saved under `tests/fixtures/`.
- [ ] **Task 9. Replay-night data.**
  `data/replay-nights.js`: 2026-10-17 and an October 2023 night, each with a labelled sample migration level, a note on its source, and a saved weather snapshot. All records carry `source`.
  Requirements: R7, R26, R28. Tests: every record has a source and a note; missing source is treated as `sample`.
- [ ] **Task 10. Weather API client.**
  `api/weather.js`: Open-Meteo history, weather.gov live, 5 s timeout, fall back to the saved snapshot with a "Saved weather" flag.
  Requirements: R27 to R29. Tests: mocked fetch for success, timeout and error.
- [ ] **Task 11. Replay-night assessment checks.**
  Run the engine on both replay nights with real stored weather. Review the resulting levels with the user, then pin them as assertions. Adjust config through `notes` if a level is clearly wrong, and record the reason.
  Requirements: R15, R26. Tests: example-based replay tests.

## Phase 3: Shell and UI

- [ ] **Task 12. City config and theme tokens.**
  `config/city.js` (Chicago default) and `styles/tokens.css` (navy, amber, 44 px control size, contrast of at least 4.5:1).
  Requirements: R3, R4, R8. Tests: city config shape; contrast check of token pairs in a unit test.
- [ ] **Task 13. Hash router.**
  `router.js` and `main.js`: `#volunteer`, `#org`, unknown or empty hash falls back to `#volunteer`.
  Requirements: R1, R2. Tests: unit tests with a fake location object; no DOM needed in the router logic.
- [ ] **Task 14. Sample-data badge and risk badge.**
  `components/sample-badge` and `components/risk-badge`. Use `escapeHtml` or `textContent`. Badges for "Sample data", "Replay night", "Saved weather", "Sample migration level".
  Requirements: R5, R6, R7. Tests: unit tests that render to a detached element and check labels and escaping.
- [ ] **Task 15. Night selector and tonight panel.**
  A departures-board style panel on `#volunteer` and `#org` showing the selected night (tonight or replay), its level, reasons and badges. Controls are at least 44 px.
  Requirements: R4, R6, R9, R24, R27 to R29. Tests: view unit tests; manual 390 px Playwright screenshot.
- [ ] **Task 16. Close-out.**
  Run `npm run check`. Update `docs/kiro-log.md` sections 3, 4 and 7 (property tests, counterexamples found, requirements changed). Mark the spec done.
  Tests: `npm run check` passes.

## Order and dependencies

```
1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 11
                      8 -> 9 -> 10 -> 11
12 -> 13 -> 14 -> 15  (15 needs 7 and 10)
```

Tasks 12 to 14 can run in parallel with Phase 1 once Task 3 exists, since they don't need the engine. Task 11 is a review gate with you. Task 15 is the first thing visible in the app.

## Coverage check

R1, R2 (13); R3, R4, R8 (12); R5 to R7 (9, 14); R9 (7, 15); R10 to R12 (5, 6, 7); R13 (1, 4, 6); R14 (7); R15 (5, 7, 11); R16, R17 (1, 2, 5); R18, R19 (5); R20, R21 (6); R22 (5, 7); R23 (3); R24 (7, 15); R25 (7); R26 (9, 11); R27 to R29 (8, 10, 15); R30 to R35 (3, 4, 7).

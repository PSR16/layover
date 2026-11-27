# Spec 1: Foundation and risk engine (tasks)

Status: DRAFT. Order matters: pure logic first (testable alone), then data, then API, then UI. Each task is one commit. Run `npm test` before every commit.
Format: `Task N. Title` then requirements, files, tests. Mark done with `[x]` and add the commit hash.

## Phase 1: Risk engine (pure logic)

- [x] **Task 1. Evidence check and research table update.** (branch `docs/spec1-task-01-wind-evidence`)
  Confirm the wind-direction convention ("from" versus "toward") in Chen et al. 2024. Add E18 to E21 rows to `docs/research.md` (Muenchow 2026, Farnsworth 2024, Horton 2019, Klem 2025) with a "how Layover uses it" line each. Record the result in the design (section 9, point 1).
  Requirements: R16, R17, R13. Files: `docs/research.md`, `design.md`. Tests: none.
- [x] **Task 2. Season, wind and night-part helpers.** (branch `feat/spec1-task-02-season-wind-night-parts`, commits db8dacd, eb7eb38, 2406dab, bc8e151)
  `season.js` (season from a date and config dates), `wind.js` (is a direction inside a sector, including the 0/360 wrap; shift between two directions; westerly check) and `night-parts.js` (average hourly values into early, middle and late using sunset and sunrise). Adds `suncalc` as an exact-pinned dependency (`package.json` and lock together).
  Requirements: R16, R17, R19, R37, R38. Tests: unit tests at the 0/360 boundary, season edges, and night parts on a short and a long night.
- [x] **Task 3. Default config.** (branch `feat/spec1-task-03-default-config`, commits 946ae94, 075e528)
  `risk-config.js` with weights, evidence IDs or "assumption", thresholds, wind sectors, season dates, reason text and `notes`.
  Requirements: R23, R30, R35, R37, R38. Tests: shape test (every weight has evidence; `nightParts` sums to 1).
- [x] **Task 4. Config validator and merge.** (branch `feat/spec1-task-04-config-validator`, commit c3ddb5d)
  `risk-config-validate.js`: `validateConfig` (six rules in design section 5) and `mergeConfig`.
  Requirements: R32, R33. Tests: one unit test per rejection rule, plus property test: any config that passes obeys R10, R13 and ordered thresholds.
- [x] **Task 5. Night factors.** (branch `feat/spec1-task-05-night-factors`, commits 8d6c5c1, af46fba, a1d0354)
  In `risk-factors.js`: migration, wind, wind shift, visibility, carry-over, season. Each reads the three night parts and combines them with the `nightParts` weights (a single value is used for all parts). Each returns `{ id, points, reasonKey, missing }`.
  Requirements: R10 to R12, R15 to R19, R22, R37. Tests: unit tests per factor, monotonicity property tests for migration.
- [x] **Task 6. Place factors.** (branch `feat/spec1-task-06-place-factors`, commits 448acf8, 6289d9a, 1c205fd, 2fb469e)
  In `risk-factors.js`: lit glass, tree, kind (stadium, arena, installation), height, lakeshore. No compass input exists. Dim and covered windows count as unlit.
  Requirements: R12, R13, R20, R21, R38, R39. Tests: lit-glass monotonicity, height weaker than glass, compass direction cannot change the score.
- [x] **Task 7. Combine and assess.** (branch `feat/spec1-task-07-combine-assess`, commits 480332e, a250775, d91fc54, c0c887c)
  `risk-combine.js` and `risk.js`: `assessNight`, `assessPlace`, `rankPlaces`. Includes the light multiplier, thresholds, weather-only cap and floor, missing-migration cap, trace and `configVersion`. Reasons come from config text.
  Also adds `treatmentDiscount` to the config and validator (none 0, partial below full, full below 1) and applies it with the light multiplier (R40).
  Requirements: R9, R14, R15, R22, R24, R25, R31, R33, R34, R40. Tests: the full property table in `requirements.md`, including determinism, stable ranking, "never empty reasons", "add a dummy factor changes only its own trace entry".

## Phase 2: Data and weather

- [x] **Task 8. Weather normalizer.** (branch `feat/spec1-task-08-weather-normalizer`, commits 9e2d2b4, f2f677e)
  `weather-normalize.js`: Open-Meteo and weather.gov JSON to `Conditions.weather`, including dawn wind direction.
  Requirements: R27, R29. Tests: unit tests against recorded sample responses saved under `tests/fixtures/`.
- [x] **Task 9a. Build the radar-night table.** (branch `feat/spec1-task-09a-radar-night-table`, commits 5c4b9e8, dcc2999, b5e948f, a92c76d, 4e89eb3)
  Decide where the build script lives (design point 6). Read the raw dataset (outside the repo), pick nights (design section 10), scale radar migration to percentile within season, average weather per night part, and write a small derived file with the attribution header.
  Requirements: R26, R36. Tests: unit tests on the percentile scaling and night-part averaging using a tiny fixture.
- [x] **Task 9. Replay-night data.** (branch `feat/spec1-task-09-replay-nights-data`, commits 5214105, fdd5e5b)
  `data/replay-nights.js`: the radar nights from Task 9a plus the night of 2026-10-16 and the night of 2023-10-04, each with a labelled migration level, a note on its source, and a saved weather snapshot. All records carry `source`.
  Requirements: R7, R26, R28. Tests: every record has a source and a note; missing source is treated as `sample`.
- [x] **Task 10. Weather API client.** (branch `feat/spec1-task-10-weather-client`, commits 43ef557, 83a4978, 1758a8c, 1b9c3a5, b7458a2)
  `api/weather.js`: Open-Meteo history, weather.gov live, 5 s timeout, fall back to the saved snapshot with a "Saved weather" flag.
  Requirements: R27 to R29. Tests: mocked fetch for success, timeout and error.
- [x] **Task 11. Replay-night assessment checks.** (branch `feat/spec1-task-11-replay-calibration`, commits 12abf03, 2cca071, 0a594df, 3545abf, a5ac44c, ecbddb4, 4ea0f8c)
  Run the engine on every replay night with the stored weather. Check that radar nights with large mortality events score `elevated` or `high` and the quiet night scores `low`. Review the resulting levels with the user, then pin them as assertions. Adjust config through `notes` if a level is clearly wrong, and record the reason.
  Requirements: R15, R26. Tests: example-based replay tests.

## Phase 3: Shell and UI

- [ ] **Task 12. City config and theme tokens.**
  `config/city.js` (Chicago default) and `styles/tokens.css` (navy, amber, 44 px control size, contrast of at least 4.5:1).
  Requirements: R3, R4, R8, R38. Tests: city config shape (includes shoreline reference); contrast check of token pairs in a unit test.
- [ ] **Task 13. Hash router.**
  `router.js` and `main.js`: `#volunteer`, `#org`, unknown or empty hash falls back to `#volunteer`.
  Requirements: R1, R2. Tests: unit tests with a fake location object; no DOM needed in the router logic.
- [ ] **Task 14. Sample-data badge and risk badge.**
  `components/sample-badge` and `components/risk-badge`. Use `escapeHtml` or `textContent`. Badges for "Sample data", "Replay night", "Saved weather", "Sample migration level".
  Requirements: R5, R6, R7, R36. Tests: unit tests that render to a detached element and check labels, escaping and the credits text.
- [ ] **Task 15. Night selector and tonight panel.**
  A departures-board style panel on `#volunteer` and `#org` showing the selected night (tonight or replay), its level, reasons and badges. Controls are at least 44 px.
  Requirements: R4, R6, R9, R24, R27 to R29. Tests: view unit tests; manual 390 px Playwright screenshot.
- [ ] **Task 16. Close-out.**
  Run `npm run check`. Update `docs/kiro-log.md` sections 3, 4 and 7 (property tests, counterexamples found, requirements changed). Mark the spec done.
  Tests: `npm run check` passes.

## Order and dependencies

```
1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 11
                      8 -> 9a -> 9 -> 10 -> 11
12 -> 13 -> 14 -> 15  (15 needs 7 and 10)
```

Tasks 12 to 14 can run in parallel with Phase 1 once Task 3 exists, since they don't need the engine. Task 11 is a review gate with you. Task 15 is the first thing visible in the app.

## Coverage check

R1, R2 (13); R3, R4, R8 (12); R5 to R7 (9, 14); R36 (9a, 14); R37 (2, 3, 5); R38 (2, 3, 6, 12); R39 (6); R9 (7, 15); R10 to R12 (5, 6, 7); R13 (1, 4, 6); R14 (7); R15 (5, 7, 11); R41, R42 (11); R16, R17 (1, 2, 5); R18, R19 (5); R20, R21 (6); R22 (5, 7); R23 (3); R24 (7, 15); R25 (7); R26 (9a, 9, 11); R27 to R29 (8, 10, 15); R30 to R35 (3, 4, 7); R40 (7).

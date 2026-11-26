# Spec 1: Foundation and risk engine (design)

Status: DRAFT. Follows `requirements.md` (R1 to R35). Numbers below are starting values, all marked as assumptions until calibrated (research rule 1).

## 1. Module layout

```
src/
  main.js                    router bootstrap
  router.js                  hash router (R1, R2)
  config/city.js             city config: Chicago default (R8)
  lib/
    risk.js                  assessNight, assessPlace, rankPlaces (entry points)
    risk-config.js           DEFAULT_CONFIG data only (R30)
    risk-config-validate.js  validateConfig, mergeConfig (R32, R33)
    risk-inputs.js           read conditions: night parts, season, wind and sky scores (pure helpers)
    risk-night-factors.js    night factors, one small object per factor (R31)
    risk-place-factors.js    place factors (Task 6)
    risk-combine.js          combines factor outputs into a level (the only place that knows the math)
    wind.js                  wind-sector and wind-shift helpers (degrees, season)
    night-parts.js           split hourly values into early/middle/late using sunset and sunrise
    season.js                season from date and config dates
    weather-normalize.js     raw API JSON to the Conditions shape, averaged per night part (pure)
  api/weather.js             Open-Meteo history, weather.gov live (fetch, timeout, fallback)
  data/replay-nights.js      labelled replay nights and saved weather snapshots (R26, R28)
  views/ components/         shell, sample-data badge, risk badge
  styles/tokens.css          navy and amber tokens, 44 px control size
tests/                       one test file per lib module, plus risk.property.test.js
```

Dependencies point inward: `lib` imports only other `lib` files. `api/` calls `lib/weather-normalize.js`, never the other way.

## 2. Data shapes

```js
// Conditions: input for one night
{
  night: '2026-10-17',
  source: 'replay',                         // 'live' | 'replay' | 'sample' (R7)
  migration: {                               // 0..1, optional, per night part (R37)
    early: 0.8, middle: 0.9, late: 0.7,      // or a single `level` used for all parts
    source: 'replay',                        // 'replay' (radar) or 'sample' (hand-set)
  },
  weather: {                                 // optional; each part and field optional
    early:  { windFromDegrees: 200, windSpeedMps: 8, lowCloudPercent: 85, visibilityKm: 4 },
    middle: { windFromDegrees: 210, windSpeedMps: 9, lowCloudPercent: 90, visibilityKm: 3 },
    late:   { windFromDegrees: 240, windSpeedMps: 9, lowCloudPercent: 90, visibilityKm: 3 },
  },                                         // shift check (R17) compares early with late
  previousNights: [{ migration, weather }, { migration, weather }], // up to 2 (R18)
}

// Place: one route or building, plain attributes
{ id, kind: 'building' | 'stadium' | 'arena' | 'installation',
  lit: true, litGlassArea: 0..1, treeNear: boolean, heightMeters,
  lakeDistanceMeters: number | null }        // null when the city has no shoreline reference

// Risk result (R9, R22, R33, R34)
{ level, reasons: string[], missingInputs: string[],
  configVersion, trace: [{ factorId, contribution, evidence }] }
```

`litGlassArea` is a 0..1 share of lit window area. Dim and covered windows count as unlit, as in the Chicago dataset (R39, `docs/data-profile.md`). It is a relative proxy for E7. OSM rarely tags glass share, so spec 2 decides how to estimate it. Until then, sample places carry hand-set values labelled "Sample".

## 3. How the engine combines factors

Internal points are an implementation detail. They are never shown (R9, R34).

```
nightPoints  = migrationPoints                                  // parts weighted by config (R37)
             + weatherPoints            (wind, shift, visibility)   // scaled by migration level (R15)
             + carryOverPoints                                      // R18
             + seasonPoints                                         // R19
placePoints  = (litGlass + treeBonus + kindBonus + heightPoints)    // R12, R13, R20, R21
             + lakeshorePoints                                      // R38: near shore and westerly wind
               * lightMultiplier(cloud, visibility)                 // R14: multiplier, not flat
total        = nightPoints + placePoints
level        = threshold lookup on total
then apply: weather-only cap (no `high`), weather-only floor (`elevated`), missing-migration cap (R22)
```

`assessNight(conditions, config)` runs the night factors only. `assessPlace(place, conditions, config)` runs night factors plus place factors. `rankPlaces(places, conditions, config)` sorts by level, then points, then `id` (stable, R25).

Why two levels: a coordinator needs "tonight is high" (surge decision, spec 4) and "this route is high" (ranking). Both use the same factors and config.

## 4. Factor registry (the part you edit)

Each factor is a pure function with one job:

```js
// src/lib/risk-night-factors.js and risk-place-factors.js
export const NIGHT_FACTORS = [migrationFactor, windFactor, windShiftFactor,
  visibilityFactor, carryOverFactor, seasonFactor];
export const PLACE_FACTORS = [litGlassFactor, treeFactor, kindFactor, heightFactor, lakeshoreFactor];
// every factor is an object { id, group, evidence, reasonKeys, evaluate(input, config) }
// evaluate returns { id, group, points, reasonKey | null, missing: string[] }
// `group` ('migration' | 'weather' | 'carryOver' | 'season' | 'place') lets the combine step
// apply the weather-only cap and floor (R15). NIGHT_REASON_KEYS feeds validator rule 5.
```

- Adding a factor: write the function, add it to the list, add its entry to the config. `risk-combine.js` loops over the list and does not change (R31).
- Each function stays under the ESLint limits (complexity 8, 40 lines). Wind-sector math sits in `wind.js` so factor functions stay small.
- A factor returns `reasonKey`, not text. The text comes from config (R33), so wording is editable without touching code.
- A factor whose input is missing returns `points: 0` and lists the input in `missing` (R22).

## 5. Config (the other part you edit)

One plain object in `src/lib/risk-config.js`. Pure data, no functions, so it can later load from JSON, a coordinator screen or calibration output.

```js
export const DEFAULT_CONFIG = {
  version: '0.1.0',
  notes: [{ date: '2026-xx-xx', change: 'initial', evidence: ['E1'] }],
  thresholds: { elevated: 0.35, high: 0.7 },                      // assumption
  weights: {
    migration:  { weight: 0.45, evidence: ['E1', 'E3', 'E5'] },
    wind:       { weight: 0.15, evidence: ['E2', 'E17'] },
    windShift:  { weight: 0.08, evidence: ['E4'] },
    visibility: { weight: 0.10, evidence: ['E2'] },
    carryOver:  { weight: 0.06, evidence: ['E4', 'E17'] },
    fallBonus:  { weight: 0.05, evidence: ['E5'] },
    litGlass:   { weight: 0.30, evidence: ['E1', 'E7', 'E16'] },
    tree:       { weight: 0.05, evidence: ['E6', 'E15'] },
    stadium:    { weight: 0.12, evidence: ['E6', 'E8'] },
    height:     { weight: 0.02, evidence: ['E14'] },
    lakeshore:  { weight: 0.06, evidence: ['E1', 'E2'], maxDistanceMeters: 1500 }, // distance is an assumption
  },
  lightMultiplier: { lowCloudAbovePercent: 60, lowVisibilityBelowKm: 5,
                     cloudFactor: 1.4, visibilityFactor: 1.3, evidence: ['E2', 'E10', 'E11'] },
  nightParts: { early: 0.25, middle: 0.5, late: 0.25, evidence: ['E1'] }, // middle highest; exact split is an assumption
  weatherScaling: { minimum: 0.4, evidence: ['E2', 'E5'] },   // weather points grow with migration
  weatherOnly: { floorLevel: 'elevated', capLevel: 'elevated', evidence: ['E2', 'E5'] },
  missingMigrationCap: 'elevated',                                 // assumption (R22)
  wind: {                                                          // degrees the wind comes FROM
    fall:   { unfavorableFrom: [[135, 315]] },                     // S and W side, assumption
    spring: { unfavorableFrom: [[315, 360], [0, 45], [225, 315]] },// N and W side, assumption
    strongMps: 6, shiftDegrees: 60, evidence: ['E2', 'E4'],
  },
  seasons: { fall: ['08-15', '11-30'], spring: ['03-15', '06-05'] }, // assumption
  reasons: {
    migrationHigh: 'Heavy migration is expected tonight.',
    lowCloud: 'Low cloud pulls birds toward lit buildings.',
    windShift: 'Wind turns against migrating birds before dawn.',
    litGlass: 'Large areas of lit glass.',
    stadium: 'Stadium or large light installation.',
    // one line per reasonKey
  },
};
```

Numbers above are placeholders chosen to satisfy the rules in R10, R13 and the threshold order. They must be checked against the 2026-10-17 and 2023 replay nights during implementation, and any change gets a `notes` entry (R35). The wind sectors depend on the "from versus toward" check (below).

### Validator (R32)

`validateConfig(config)` returns a list of problems. It runs on load and in tests. It rejects:
1. a weight with no `evidence` array or the string `'assumption'`;
2. `weights.migration.weight` not the largest;
3. `weights.height.weight` not below `litGlass`, `stadium` and `tree`; `weights.lakeshore.weight` not above `litGlass`;
4. `thresholds.elevated >= thresholds.high`, or either outside 0 to 1;
5. a reason key used by a factor but missing from `reasons`;
6. a missing season or wind entry.

`mergeConfig(base, overrides)` deep-merges then validates, and throws with the problem list. `assessNight(conditions, overrides)` uses it (R33).

## 6. Requirement coverage

| Requirement | Where |
|---|---|
| R9, R24, R34 | `risk.js` result shape; reasons from `config.reasons`; UI never reads `trace` |
| R10, R13, R32 | validator rules 2 and 3 |
| R11, R12 | monotone factors: points are non-decreasing in migration and litGlass |
| R14 | `lightMultiplier` in `risk-combine.js` applies to place light points only |
| R15 | `weatherOnly` floor and cap applied after threshold lookup |
| R16, R17 | `wind.js` sectors and shift check; `windFactor`, `windShiftFactor` |
| R18 | `carryOverFactor` reads `previousNights`; weight below same-night wind weight |
| R19 | `seasonFactor` adds `fallBonus` |
| R20, R21 | `kindFactor`, `treeFactor`; no compass field exists in the Place shape |
| R22 | `missing` arrays collected; `missingMigrationCap` applied |
| R37 | `night-parts.js`; `nightParts` weights in config; single-value fallback |
| R38 | `lakeshoreFactor`; `wind.js` westerly check; city shoreline reference in `config/city.js` |
| R39 | lit-share input rule documented in Place shape; unit test on the coding helper |
| R36 | credits component on both views |
| R25 | `rankPlaces` sort key (level, points, id) |
| R26 to R29 | `data/replay-nights.js`, `api/weather.js`, `weather-normalize.js` |
| R1 to R8 | `router.js`, `styles/tokens.css`, `components/sample-badge`, `config/city.js` |

## 7. Weather and replay flow

1. User picks a night: Tonight (live) or a replay night.
2. Replay: `api/weather.js` requests Open-Meteo history for the city center and the night window (hourly wind speed, wind direction, low cloud cover, visibility). The raw JSON goes through `weather-normalize.js`, which uses sunset and sunrise (from `suncalc`, pinned exactly) to average the hours into the three night parts of `Conditions.weather`. Radar nights take migration from the committed derived table (see section 10).
3. On timeout (5 s) or error: use the saved snapshot in `replay-nights.js`, badge "Saved weather" (R28).
4. Live: weather.gov for the city center, same normalizer. Migration is the sample level, badge "Sample migration level" (R29).
5. `assessNight` returns the result. The view shows the level, the reasons and the badges.

Open-Meteo history may lag by a few days, which is fine for past nights.

## 8. Test plan

- **Unit tests** (one file per module): wind sectors at the 0/360 boundary, season dates, normalizer on recorded API samples, validator for each rejection rule, reason keys all present.
- **Property tests (fast-check):** the table in `requirements.md`, plus: results are deterministic for the same config; `mergeConfig` with an empty override equals the default.
- **Replay tests:** 2026-10-17 and the 2023 night against stored weather. Expected levels are set after the wind-direction check and reviewed by you before they become assertions.
- **UI checks:** hash routing and unknown-hash fallback; sample badge present wherever a replay or sample value is shown; controls at least 44 px (manual Playwright check later).

## 9. Risks and open points

1. **Wind direction convention (checked, Task 1).** The Chen et al. 2024 abstract reports northerly and westerly winds in spring, and southerly and westerly winds in fall, as the unfavorable ones. In standard weather usage a northerly wind comes from the north, and a spring northerly is a headwind for birds flying north. That matches the "from" convention used in the config. I could not read the full text (the publisher page requires a login and the PDF was not fetchable), so this rests on the abstract wording and meteorological usage. The sectors stay marked as assumptions on exact degree ranges. Open-Meteo reports wind direction as the direction the wind comes from, so no flip is needed in the normalizer.
   **New finding:** the abstract says low visibility in spring roughly triples collision rates independent of migration traffic. That is an exception to "weather matters most on heavy nights" (R15). The `elevated` floor for weather-only nights covers it. Task 5 must make spring low visibility a case that works without migration data.
2. **Floor effect on surge.** The R15 floor makes more nights `elevated`. That is fine for display, but spec 4 must base surge on `high` only (research rule 8). The floor is a config value, so it can be dropped.
3. **Glass share.** OSM seldom has it. Spec 2 must pick a proxy (for example building type plus facade tags), and label it.
4. **Muenchow 2026.** If it shows height matters in Chicago, change the height weight through config, record it in `notes`, and keep the validator rule so height stays below lit glass.
5. **Migration source.** Replay levels are hand-set. If BirdCast data becomes usable, only the loader changes. The engine takes the same number.

## 10. Replay data from the Chicago dataset

- A one-off script (location to decide, see point 6 below) reads the raw files kept outside the repo and writes a small committed table, one row per selected night: date, season, migration per night part (percentile within season), wind, cloud and visibility per night part, and a note. The file header carries the attribution text from `docs/data-sources.md` and the script name and date (CC BY 4.0, R36).
- Night selection: the largest spring and fall mortality events (for example 2018-05-02, 2000-10-15, 2002-05-06, 2013-10-08), plus quiet nights for contrast. The counts stay in `docs/` and fixtures, never in the UI.
- Radar nights use the dataset's own Midway weather for the saved snapshot, so the "Saved weather" fallback works without any network.
- News nights (2026-10-17, October 2023) have no radar data here and keep hand-set, labelled migration levels.

### Additional open points

6. **Where the build script lives.** The repo is JavaScript only. Options: a Node script under `tools/` that reads CSVs exported once from the dataset, or a Python script kept in `docs/`. The raw files are R and Excel based, so the first export step needs Python or R either way. Decide before Task 9 and update `structure.md` if a `tools/` folder is added.
7. **Lake reference.** A single shoreline distance needs a Lake Michigan shoreline line from OSM. Spec 2 supplies it. Until then, sample places carry hand-set `lakeDistanceMeters`, labelled sample.

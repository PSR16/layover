# Spec 1: Foundation and risk engine (requirements)

Status: DRAFT for review. Design and tasks drafted. Updated for night parts (R37), radar replay nights (R26), lakeshore (R38) and lit-share coding (R39).
Evidence IDs (E1 to E21) refer to `docs/research.md`. Requirements marked **[assumption]** have no direct evidence and say so.

## Scope

In: app shell, hash router, theme tokens, sample-data labelling, city config, risk scoring module, replay-night data and its loader.
Out (later specs): map and Overpass (spec 2), slots and volunteer journey (spec 3), coordinator tools (spec 4).

## Glossary

- **Night**: one evening-to-dawn window, identified by the date it starts on.
- **Conditions**: the inputs for one night: migration, weather, venues, previous nights, season.
- **Risk result**: `{ level: 'low' | 'elevated' | 'high', reasons: string[], missingInputs: string[] }`.
- **Replay night**: a past date whose conditions are loaded from a labelled file plus historical weather.
- **Night parts**: the night from sunset to sunrise split into three equal parts by elapsed time: early, middle, late. (Same method as the Van Doren et al. 2021 analysis, see `docs/data-profile.md`.)

## A. Shell and routing

- **R1.** WHEN the URL hash is `#volunteer` or `#org`, the app SHALL render the matching view.
- **R2.** WHEN the hash is empty or unknown, the app SHALL show `#volunteer` and set the hash to `#volunteer`.
- **R3.** The app SHALL use the night-airport theme: dark navy background, amber accents, text contrast of at least 4.5:1.
- **R4.** Every interactive control SHALL be at least 44x44 px.
- **R5.** All data inserted into the page SHALL be escaped with the shared `escapeHtml` helper or set with `textContent`.

## B. Sample data labelling

- **R6.** Every screen that shows sample, replayed or computed-from-sample data SHALL show a visible label reading "Sample data" or "Replay night".
- **R7.** Every data record SHALL carry a `source` field with one of `live`, `replay`, `sample`. IF the field is missing, THEN the UI SHALL treat the record as `sample`.
- **R8.** The city SHALL be a config value (`id`, name, center, timezone). The default is Chicago.

- **R36.** The app SHALL include a credits section on both views that shows the attribution text in `docs/data-sources.md` for the Van Doren et al. 2021 dataset (CC BY 4.0) whenever any value derived from it is used, and "© OpenStreetMap contributors" wherever map or building data appears.

## C. Risk engine (`src/lib/risk.js`, pure, no DOM or network)

- **R9.** The risk engine SHALL return only `low`, `elevated` or `high`, each with at least one plain-language reason. It SHALL NOT return a number, a death count or a "birds at risk" figure in any user-facing field. (Product rule.)
- **R10.** Migration intensity SHALL be the largest single weight. (E1, E3, E5)
- **R11.** WHEN other inputs are equal, higher migration intensity SHALL NOT lower the risk level. (E1, E3)
- **R12.** WHEN other inputs are equal, more lit-glass area at venues or buildings SHALL NOT lower the risk level. (E1, E7)
- **R13.** The engine SHALL treat building height as a weak signal, with a weight below every lit-glass weight. (E1, E7, E14)
- **R14.** WHEN low cloud ceiling or low visibility is present, the engine SHALL multiply the lit-venue contribution instead of adding flat points. (E10, E11, E2)
- **R15.** WHEN migration is light, weather SHALL NOT raise the level to `high` by itself. WHEN migration is light and weather is unfavorable (E2 wind or low visibility), the level SHALL be at least `elevated`. The floor SHALL be a config value. Spring low visibility SHALL count as unfavorable even when migration data is missing, because E2 found it roughly triples collisions independent of migration traffic. (E2, E5; research rule 10: prefer the more conservative behavior where studies disagree.)
- **R16.** The engine SHALL apply season-specific wind rules. Fall: south and west winds raise risk; spring: north and west winds raise risk. (E2) **[assumption on thresholds]**
- **R17.** WHEN wind changes from favorable to unfavorable for migrants between the early part and the late part of the night, the engine SHALL raise risk and include a reason that names the shift. (E4)
- **R18.** WHEN either of the previous 2 nights was high-migration with unfavorable weather, the engine SHALL add a carry-over contribution that is smaller than a same-night contribution. (E4, E17)
- **R19.** WHEN season is fall, the base risk SHALL be at least that of spring with all other inputs equal. (E5)
- **R20.** WHEN a venue is a stadium, arena or high-intensity light installation and is lit that night, the engine SHALL give it a larger contribution than an ordinary lit building. (E6, E8)
- **R21.** WHEN a building has trees within about 5 m or reflective glass facing trees, its glass contribution SHALL be higher. (E6, E15) Facade compass direction SHALL NOT change the score. (E15) Site differences by facade seen in Chicago (E1) are explained by lake, trees and lighting, which the engine models directly (R21, R37).
- **R22.** WHEN an input is missing, the engine SHALL still return a result using the inputs it has, and list the missing input names in `missingInputs`. WHEN migration is missing, the engine SHALL cap the level at `elevated` and say why. **[assumption]**
- **R23.** All weights and thresholds SHALL live in one config object, each with an evidence ID or the word "assumption", so they can be changed without editing logic.
- **R24.** Every reason string SHALL name the factor in plain words (for example "Heavy migration expected" or "Low cloud makes lit venues more attractive to birds"). It SHALL NOT use evidence IDs or jargon.
- **R25.** Ranking routes or buildings SHALL be a stable sort. Ties SHALL break on a fixed key (id), so the same input always gives the same order.

## C1. Night parts, lake and lighting

- **R37.** Weather and migration inputs SHALL be given per night part (early, middle, late). The engine SHALL weight the parts by config, with the middle part weighted highest. (E1: the middle third of the night was the most informative.) **[assumption on exact part weights]** WHEN only a single whole-night value exists, the engine SHALL use it for all three parts.
- **R38.** WHEN a place is near the Lake Michigan shoreline and the wind comes from the west (blowing toward the lake side), in either season, the engine SHALL add a lakeshore contribution and a reason that says so. (E1: westerly winds concentrated collisions at the lakefront building; E2: westerly winds raised collisions in both seasons.) **[assumption: distance threshold]** The city config SHALL hold the shoreline reference, so other cities can supply their own or none.
- **R39.** WHEN a place's lighting is described as a share of lit window area, the engine SHALL count dim and covered windows as unlit. (E1, E7)

## C2. Editability of the risk engine

- **R30.** Weights, thresholds, wind sectors, season dates and reason wording SHALL live in a plain, JSON-serializable config object separate from the logic. Changing any of them SHALL NOT require editing a function.
- **R31.** Each risk factor SHALL be an independent pure function in a registered list. Adding, removing or reordering a factor SHALL NOT require changes to the code that combines factors.
- **R32.** A config validator SHALL reject a config that breaks the research rules: no evidence ID or "assumption" on a factor; migration weight not the largest; height weight not below every lit-glass weight; level thresholds out of order. The validator SHALL run on load and in the tests.
- **R33.** The engine SHALL accept a config override argument and merge it over the defaults. The result SHALL include the `configVersion` used.
- **R34.** The engine SHALL return an internal `trace` listing each factor's contribution, for tests and developer tools. The UI SHALL NOT render numbers from it (R9).
- **R35.** Every place that changes weights SHALL record the reason in the config `notes` list with a date and an evidence ID or "local data".

## D. Replay nights

- **R26.** The app SHALL include a replay-night file with two kinds of Chicago night, each carrying a migration level (0 to 1), a `source` and a note on where the level came from:
  - **Radar nights** drawn from the 2000 to 2020 McCormick Place dataset (E1), including at least one spring and one fall night with a large mortality event and one quiet night. The level is the local radar bird density scaled by percentile within its season. `source: 'replay'`, label "Replay night, radar-derived migration".
  - **News nights**: 2026-10-17 and a night in October 2023, which fall outside the dataset. The level is hand-set from public BirdCast maps and the news reports. `source: 'sample'`, label "Sample migration level".
- **R27.** WHEN a replay night is selected, the app SHALL load weather for that date from the Open-Meteo historical API (wind speed and direction, low cloud cover, visibility) and average it into the three night parts (R37). The app SHALL show the weather as real data and label the migration level according to R26.
- **R28.** IF the weather request fails or times out, THEN the app SHALL fall back to a stored weather snapshot for that night, labelled "Saved weather", and still show a risk result.
- **R29.** WHEN no replay night is selected, the app SHALL use live weather from weather.gov for the city center and the sample migration level for tonight. The migration level SHALL be labelled "Sample migration level".

## Property-based tests (fast-check)

| Property | Requirement |
|---|---|
| Output level is always one of the three values, for any valid conditions | R9 |
| Raising migration never lowers the level | R11 |
| Raising lit-glass area never lowers the level | R12 |
| With migration at the minimum, no weather combination yields `high` | R15 |
| With minimum migration and unfavorable weather, level is at least `elevated` | R15 |
| Any valid random config passes the validator only if it obeys R10, R13 and ordered thresholds | R32 |
| Adding a dummy factor changes only that factor's trace entry | R31 |
| Fall base risk is at least spring base risk, all else equal | R19 |
| Facade compass direction never changes the score | R21 |
| Increasing the middle-part migration raises the level at least as much as the same change in the early or late part | R37 |
| Lakeshore contribution is zero when wind is not from the west or the place is beyond the threshold | R38 |
| Windows coded dim or covered add zero lit area | R39 |
| Removing any one input still returns a result and lists that input as missing | R22 |
| Same input always gives the same ranking order | R25 |
| Reasons list is never empty | R9, R24 |

Example-based tests: the 2026-10-17 replay night scores `elevated` or `high` given heavy migration and the stored weather (value to be confirmed against real weather in design).

## Open questions

1. **Steering conflict (resolved).** `.kiro/steering/research.md` rule 3 now separates favorable wind (more migration, belongs in the migration input) from unfavorable wind (raises collisions on heavy nights, E2). R16 follows the second. The evidence range is now E1–E21. **Checked in Task 1:** the Chen et al. 2024 abstract is consistent with the "wind from" convention (full text not read). See design section 9.
2. **E5 versus E2.** E5 found clear, cool fall days were worst, and E2 found low visibility raised risk. R15 handles it by making migration the main signal and weather a modifier. Is that the behavior you want?
3. **Muenchow 2026 (Chicago, height and luminosity).** If it finds height matters in Chicago, R13 may need a Chicago-specific note.

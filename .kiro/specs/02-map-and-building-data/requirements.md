# Spec 2: Map and building data (requirements)

Status: DRAFT for review. Evidence IDs refer to `docs/research.md`. Requirement numbers start at R1 inside this spec. Requirements marked **[assumption]** have no direct evidence and say so.

## Why

Spec 1 can score a night and a place, but it has no places. The coordinator question for a night is "which buildings matter", and the answer needs a map of real buildings with the attributes the engine reads. `docs/overture-check.md` shows what the data can and cannot give: footprints and heights are good, facade glass is almost empty, and the highest-mortality site (McCormick Place) has no venue class.

## Scope

In: a Leaflet map of the three Chicago study areas, a static building extract, a building-source seam so other sources can connect (live OpenStreetMap first), the live OpenStreetMap source with a saved fallback, a real lake shoreline, a short curated list of known light-hazard sites, place scoring through the spec 1 engine, and a text list of the same places.
Out (later specs): routes and slots (spec 3), coordinator tools (spec 4), shared data (spec 5), building history from finds (spec 6), the user's own location.

## Glossary

- **Building record**: `{ id, name?, footprint, centroid, heightMeters?, kind?, source }`. `source` is `map` or `sample` (spec 1 R7).
- **Hotspot**: a building on the curated list with hand-set attributes (venue kind, lit glass share, treatment). Always labelled sample.
- **Study area**: a bounding box with a saved building extract: Loop, lakefront (McCormick Place and Soldier Field) and Evanston lakefront.
- **Place score**: the engine's `assessPlace` result for a building on a chosen night: `low`, `elevated` or `high`, with reasons.

## A. Building data

- **R1.** The app SHALL ship a static extract of buildings for the three study areas, derived from Overture Maps (buildings theme, ODbL). Each record SHALL keep only the ID, name, simplified footprint, height and class. The extract SHALL record its Overture release, the build date and the script that built it. (`docs/overture-check.md`)
- **R2.** The extract SHALL stay small enough to load on a phone connection. **[assumption]** Budget: 500 kB gzipped for all three areas, loaded only when the map opens. The build script SHALL fail if the budget is exceeded.
- **R3.** Each building SHALL have a stable ID from the source data (the Overture ID). The record SHALL carry the OpenStreetMap ID too when the source gives one. (Spec 6 open question 2.)
- **R4.** A missing height or class SHALL stay missing. The app SHALL NOT invent a value, and the place score SHALL list it in `missingInputs` (spec 1 R22).
- **R5.** The credits block SHALL name Overture Maps and OpenStreetMap contributors whenever building data is on screen. (Spec 1 R36)

## B. Hotspots (hand-set, labelled sample)

- **R6.** The app SHALL hold a curated list of Chicago light-hazard sites, each with a name, a reason, hand-set attributes (kind, lit glass share, treatment status) and a dated note saying where the value came from. Starting list: McCormick Place Lakeside Center (E1, E22, E23), Soldier Field, Kellogg Global Hub in Evanston.
- **R7.** Every hotspot attribute that is not read from the map SHALL be shown as sample data. The place score for a hotspot SHALL carry the "Sample data" label.
- **R8.** WHEN a hotspot matches a building in the extract (by ID, or by name and distance), the record SHALL use the building's footprint and the hotspot's attributes. WHEN it matches none, the app SHALL still list the hotspot at its coordinates.
- **R9.** McCormick Place SHALL be scored through its lit glass share and treatment status, the way the spec 1 calibration scored it, and SHALL NOT get a venue kind. Adding a `convention-center` kind would count the lights twice and push 7 of the 18 replay nights from elevated to high, beyond the calibrated thresholds. (Revised 2026-11-27; the first draft added the kind.)
- **R10.** The hotspot list SHALL be plain data in `src/data/`, editable without touching code. A coordinator or the user can change a value and see the score change.

## C. Sources and live OpenStreetMap queries

Decision (2026-11-27): the first version runs on the static extract for three study areas. The data layer is built so other sources can connect later, because the hackathon rewards combining data. Live OpenStreetMap is the first extra source and is built after the static path works.

- **R31.** All building data SHALL reach the app through one `BuildingSource` interface: `load(area) -> Promise<{ buildings, source, savedOn }>`. The static extract, the live OpenStreetMap query and any later source SHALL implement it. Views, scoring and the map SHALL NOT know which source a record came from, except through its `source` label.
- **R32.** WHEN more than one source gives the same building (same OpenStreetMap ID, or footprints that overlap by more than half), the app SHALL merge them into one record. Values from the static extract win, a source SHALL only fill fields that are missing, and the record SHALL list every source that contributed. **[assumption]**
- **R33.** Adding a source SHALL need no change to scoring, the list or the map, only a new module and an entry in the source list.

- **R11.** WHEN the user opens the map, the app MAY ask Overpass for venues and the shoreline in the visible area. Requests SHALL time out after 8 seconds **[assumption]**, SHALL NOT be repeated for the same area within a session, and SHALL be cached in `localStorage` with the date saved.
- **R12.** WHEN Overpass times out, rate-limits, fails or returns nothing, the map SHALL keep working from the static extract and SHALL say so in one line ("Using saved map data from 2026-11-26. Try again.") with a Retry button. (Product rule: visible fallback)
- **R13.** The app SHALL send no user-entered text and no user location to Overpass. Queries use the map's visible bounding box only.
- **R14.** Overpass results SHALL be validated before use. A record with no geometry, a non-finite coordinate or an unknown shape SHALL be dropped, not drawn.

## D. Shoreline

- **R15.** The app SHALL replace the sample shoreline in the Chicago config with the Lake Michigan shoreline from OpenStreetMap, simplified to at most 200 points **[assumption]**, with `source: 'map'`, the build date and the licence note. (Spec 1 R38)
- **R16.** A building's `lakeDistanceMeters` SHALL be computed from that shoreline. WHEN the shoreline is missing, the field SHALL be absent and the engine SHALL skip the lakeshore factor.

## E. Scoring places

- **R17.** WHEN the user chooses a night (spec 1), the app SHALL score each hotspot and each building with a known height through `assessPlace` for that night's conditions, using the Chicago overlay. Buildings with nothing known except a footprint SHALL NOT be scored.
- **R30.** The app SHALL NOT let anyone set whether a building is lit on a given night. Nobody knows that reliably, so tonight's lit status is not an input in this spec or the next one. Hotspots carry one fixed, hand-set lighting assumption (R6), shown as sample.
- **R18.** WHEN lighting is unknown (the usual case outside hotspots), the app SHALL say "Lighting not known". The engine counts a place with no lit flag as lit, the cautious choice (spec 1 research rule 10), so the reason text SHALL say the level assumes the lights are on and uses what is known. Glass share is never guessed: when it is missing the score lists it in `missingInputs`. (Revised 2026-11-27 to match the engine.)
- **R19.** The map and list SHALL show only `low`, `elevated` or `high`, each with plain reasons. They SHALL NOT show a number, a bird count or a casualty figure. (Product rule)
- **R20.** Scoring SHALL be a pure function of the night's conditions and the building records, with no DOM, and SHALL give the same ranking for the same inputs.

## F. Map and list

- **R21.** The map SHALL use Leaflet with OpenStreetMap tiles and the required attribution visible at every width. The tile requests SHALL follow the OpenStreetMap tile usage policy **[assumption: fine for a demo, not for heavy use]**.
- **R22.** Place markers SHALL show the risk word, not colour alone. Selecting a marker or a list row SHALL show the building name (or "Unnamed building"), its level, its reasons, its height if known, and a "Sample data" label when any value is hand-set.
- **R23.** The same places SHALL appear as a text list, ranked by level, then name, that works with a keyboard and a screen reader. At 390 px the list is the first thing shown and the map opens from a "Show map" button. (`ux.md`: one job per screen)
- **R24.** The list SHALL show at most the 10 highest-ranked places first, with "Show more". Empty states SHALL say why and what to do ("No places score above low tonight. Check another night.").
- **R25.** Every map control (zoom, retry, show map, marker) SHALL be at least 44 by 44 px, with at least 8 px between targets. The map SHALL not trap keyboard focus or scroll.
- **R26.** The map view SHALL work with no horizontal scroll from 320 px, and SHALL respect `prefers-reduced-motion` (no animated pans or zooms).
- **R27.** Building names and other map text SHALL be set with `textContent` or escaped, including text from Overpass. (Spec 1 R5)

## G. Where it appears

- **R28.** The organization view SHALL show the ranked list and the map for the chosen night, under the night panel.
- **R29.** The volunteer view SHALL show the same list, read-only and limited to the top places, with the same labels. It SHALL NOT tell anyone to touch, catch or move a bird. (Product rule)

## Property-based tests (planned)

| Property | Requirement |
|---|---|
| Scoring a set of buildings gives the same ranking in any input order | R20 |
| A building with no lit data never gets a lit reason | R18 |
| Dropping a field from a building never raises its level beyond `elevated` because of that field alone | R4, R18 |
| Every Overpass result either passes validation or is dropped, never drawn with a non-finite coordinate | R14 |
| Distance to the shoreline is never negative and is 0 for a point on it | R16 |
| Any text from map data appears as text, never as markup | R27 |
| The extract build is deterministic: same input file, same output | R1 |

## Decided

- Three study areas (Loop, lakefront, Evanston), not all of Chicago.
- Static extract first. Other sources connect through `BuildingSource` (R31). Live OpenStreetMap is built after the static path works.
- No per-night lit status input (R30).

## Open questions

Defaults I will use unless you say otherwise: OpenStreetMap tiles for the demo, and "Unnamed building" with no reverse lookup.

1. **Hotspot list.** Who curates it and how often? Only the three sites above are backed by the news and the dataset. Adding more needs a source for each.

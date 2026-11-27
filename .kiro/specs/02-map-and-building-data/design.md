# Spec 2: Map and building data (design)

Status: DRAFT. Requirement IDs (R1 to R33) refer to `requirements.md` in this folder. Spec 1 IDs are written "spec 1 R22".

## 1. Module layout

```
src/
  lib/                        pure, no DOM, no network
    buildings.ts              BuildingRecord type helpers, validation, merge (R3, R4, R14, R32)
    building-source.ts        BuildingSource interface, mergeSources (R31, R32, R33)
    hotspots.ts               match a hotspot to a building (R8)
    place-builder.ts          BuildingRecord + hotspot + shoreline -> Place for the engine (R16, R17, R18)
    place-ranking.ts          rank places for a night, tie-breaks, top N (R17, R20, R24)
    shoreline.ts              simplify a shoreline, distance to it (R15, R16)
    overpass-parse.ts         Overpass JSON -> BuildingRecord[], drops bad records (R14)
  data/
    buildings-loop.json       static extract, one file per area (R1, R2)
    buildings-lakefront.json
    buildings-evanston.json
    hotspots.ts               curated list, plain data (R6, R10)
    chicago-shoreline.json    built from OpenStreetMap (R15)
  api/
    overpass.ts               fetch with timeout, cache in localStorage (R11, R12, R13)
    sources.ts                the source list: static first, then live OpenStreetMap
  map/
    map-view.ts               Leaflet setup, markers, attribution (R21, R22, R25, R26)
  views/
    places-section.ts         list, "Show more", selected place, map toggle (R23, R24, R28, R29)
  components/
    place-row.ts              one list row and detail (R22, R27)
tools/
  build-building-extract.ts   Overture GeoJSON -> slim extract; fails over budget (R1, R2)
  build-shoreline.ts          OSM coastline -> simplified shoreline (R15)
tests/                        one test file per lib module, plus place-ranking.property.test.ts
```

Dependencies point inward as in spec 1: `lib` imports only other `lib` files. `api/`, `map/` and `views/` call `lib`. Leaflet is imported only in `map/`. The map loads on demand (dynamic import), so the first screen stays small.

## 2. Data shapes

```ts
interface BuildingRecord {
  id: string;                 // Overture ID (R3)
  osmId?: string;             // when the source gives one (R3)
  name?: string;
  footprint: [number, number][];   // [longitude, latitude], simplified, closed ring
  centroid: Coordinate;
  heightMeters?: number;      // missing stays missing (R4)
  kind?: string;              // from the source class, mapped to a spec 1 kind where it matches
  source: 'map' | 'sample';   // spec 1 R7
  sources: string[];          // every source that contributed (R32)
}

interface Hotspot {
  id: string;                 // 'mccormick-lakeside' ...
  name: string;
  match: { buildingId?: string; osmId?: string; near: Coordinate; maxDistanceMeters: number };
  kind?: string;              // only kinds the engine knows ('stadium', 'arena', 'installation')
  litGlassShare?: number;     // hand-set, 0 to 1, left out when unknown
  treeNear?: boolean;
  birdSafeTreatment?: 'none' | 'partial' | 'full';
  note: { text: string; date: string; evidence: string[] };   // where each value came from (R6)
}

interface BuildingSource {
  id: string;                 // 'static', 'openstreetmap-live'
  load(area: Area): Promise<{ buildings: BuildingRecord[]; savedOn: string; fromCache: boolean }>;
}
```

The extract files are plain JSON arrays of `BuildingRecord`, with coordinates rounded to 5 decimals (about 1 m). A header object holds the Overture release, build date, script name and the licence note.

## 3. Building the extract (R1, R2)

`tools/build-building-extract.ts` reads the GeoJSON files in `~/Documents/Development/layover-data/overture/` and writes the three JSON files. Steps, each a small pure function in `tools/`:
1. Keep polygons with a height or class, plus every named building. A bare footprint with nothing known is not scored (R17), so it only helps the map picture; drop footprints below 150 m² to save space. **[assumption: thresholds tuned against the budget]**
2. Simplify each footprint with Douglas-Peucker at 1 m tolerance.
3. Round coordinates to 5 decimals. Keep `id`, `name`, `heightMeters`, `kind`, the OSM ID if present.
4. Write the header, then the records sorted by ID, so the same input gives the same file (deterministic, planned property).
5. Gzip the total in memory and fail above 500 kB (R2).

If the budget does not fit, the fallback is to drop unnamed buildings under a height threshold from the Loop first. The build prints how many records each rule dropped.

## 4. Sources and merging (R31 to R33)

`sources.ts` exports an ordered list: `[staticSource, liveOpenStreetMapSource]`. `loadBuildings(area)` loads every source with `Promise.allSettled`, so one failing source never blocks the others, then calls `mergeSources`.

`mergeSources` keys records by `osmId` when both have one, otherwise by footprint overlap above 50% of the smaller area. For a merged record, fields from the earlier source win and a later source fills only missing fields. The `sources` array lists both. The result reports which sources loaded and which failed, so the UI can show "Using saved map data from 2026-11-26" (R12).

Phase order: the static source and the whole scoring, list and map path ship first. The live source is added as a separate task and only changes `sources.ts`.

## 5. From building to scored place (R16 to R20)

`place-builder.ts` turns a `BuildingRecord` into the spec 1 `Place`:
- `lakeDistanceMeters` from `shoreline.ts` (R16).
- `heightMeters`, `kind` from the record.
- If a hotspot matches (`hotspots.ts`): `kind`, `litGlassShare`, `treeNear` and `birdSafeTreatment` come from the hotspot, and the place gets `source: 'sample'` so the UI shows the label (R7, R8).
- No lit data otherwise: the `lit` field stays undefined and the engine lists it in `missingInputs` (R18).

`place-ranking.ts` calls `assessPlace` per place with the night's conditions and the Chicago overlay, then sorts by level, then by the engine's internal ordering, then by name, then by ID, so the order is stable (R20). The UI receives level, reasons and missing names only (spec 1 R9, R34).

A building is scored only when it has a height, a class that maps to a kind, or a hotspot match (R17). Everything else is drawn as a quiet outline with no level.

## 6. Map and list (R21 to R29)

- `places-section.ts` renders the ranked list first (R23). Rows are buttons, at least 44 px tall. "Show more" appends the next 10 (R24).
- "Show map" loads `map-view.ts` with a dynamic import. Leaflet gets the OSM tile layer with the attribution control always on (R21). Markers are `L.divIcon` elements that carry the risk word as text, built with DOM calls (R22, R27). Zoom buttons are restyled to 44 px (R25). Animation is turned off when `prefers-reduced-motion` is set (R26).
- Selecting a marker or a row sets one `selectedPlaceId` in the selection store, so both stay in step. The detail shows name, level, reasons, height if known and the "Sample data" badge when `source` is `sample`.
- Empty and failure messages follow `ux.md`: say why, say what to do.
- The org view shows list and map under the night panel. The volunteer view shows the top places only, with no map button on first load (R28, R29).

## 7. Requirement coverage

| Requirement | Where |
|---|---|
| R1, R2 | `tools/build-building-extract.ts`, extract header, budget check |
| R3, R4 | `buildings.ts`, `place-builder.ts` |
| R5 | `lib/credits.ts` gains an Overture and OpenStreetMap entry when building data is shown |
| R6 to R10 | `data/hotspots.ts`, `hotspots.ts` (no new engine kind) |
| R11 to R14 | `api/overpass.ts`, `overpass-parse.ts` |
| R15, R16 | `tools/build-shoreline.ts`, `shoreline.ts`, `config/city.ts` |
| R17 to R20 | `place-builder.ts`, `place-ranking.ts` |
| R21 to R27 | `map-view.ts`, `places-section.ts`, `place-row.ts`, CSS |
| R28, R29 | `volunteer-view.ts`, `org-view.ts` |
| R30 | no input exists; a test asserts the place builder takes no per-night lit value |
| R31 to R33 | `building-source.ts`, `api/sources.ts` |

## 8. Test plan

- Unit tests per `lib` module, with the cases in the requirements' property table as `fast-check` tests in `place-ranking.property.test.ts`, `overpass-parse.property.test.ts`, `shoreline.property.test.ts` and `build-extract.property.test.ts`.
- Overpass: a fake `fetch` for success, timeout, 429, empty result and a record with a NaN coordinate. Cache hit and cache miss.
- DOM tests (happy-dom) for the list, "Show more", the selected detail, hostile text in names, and the fallback line with Retry. Leaflet itself is not run in tests; `map-view.ts` takes the Leaflet module as an argument, so a tiny fake can check marker text and attribution.
- A bundle check in the build step: the main chunk stays under its current size and Leaflet sits in its own chunk.
- Mutation checks as in spec 1: break the merge precedence, the shoreline distance and the "not scored" rule on purpose and confirm a test fails.
- Screenshots at 390 px and 1280 px for the list and the map (`ux.md`).

## 9. Risks and open points

1. **Extract size.** Three areas may not fit in 500 kB gzipped with every named building. The build prints the numbers early (Task 2) so the budget is checked before anything depends on it.
2. **Matching hotspots to buildings.** McCormick Place is several buildings and parts in the data. Task 4 inspects the matches by hand and records the chosen building IDs in the hotspot note.
3. **Kind mapping.** Overture classes (`stadium`, `university`, `commercial`, ...) map to spec 1 kinds only where there is evidence. Everything else keeps no kind and scores on height alone.
4. **Overpass limits.** Public servers rate-limit and change. The live source must never be the only path (R12), and its tests use only fakes.
5. **Tiles.** The public OSM tile server is for light use. For the demo this is fine. A heavy-use deploy needs another provider, so the tile URL is one config value.
6. **Footprint overlap in merging.** A heuristic. The merge tests include a pair of adjacent buildings that must not merge.

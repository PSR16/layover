# Spec 2: Map and building data (tasks)

Status: IN PROGRESS (Tasks 1 to 7 done). Format: `Task N. Title` then requirements, files, tests. Mark done with `[x]` and add the commit hash. One branch per task, `feat/spec2-task-NN-short-name`.

## Phase 1: Data (pure logic and build tools)

- [x] **Task 1. Building types and validation.** (branch `feat/spec2-task-01-building-types`) `buildings.ts`: `BuildingRecord`, `validateBuilding` (finite coordinates, closed ring, ID present), height and kind stay missing when missing. Types go in `types.ts`.
  Requirements: R3, R4, R14. Tests: unit; property: an invalid record never passes validation.
- [x] **Task 2. Extract build script and budget check.** (branch `feat/spec2-task-02-building-extract`, commits 3119ddf, 70a3344) `tools/build-building-extract.ts` and its pure helpers (filter, Douglas-Peucker, rounding, sort). Run on the three Overture GeoJSON files, print per-area size and what each rule dropped, write the three JSON files with a header. Fail above 500 kB gzipped.
  Requirements: R1, R2, R3, R5. Tests: helpers (simplify keeps the ring closed, rounding, determinism: same input, same bytes). Decision point: if the budget fails, stop and tell the user before dropping more.
- [x] **Task 3. Shoreline.** (branch `feat/spec2-task-03-shoreline`, commits 2483165, 1614539) `tools/build-shoreline.ts` (OSM coastline for Lake Michigan near Chicago and Evanston, at most 200 points), `shoreline-core.ts` (join, simplify; distance already existed in `geo.ts`), replace the sample shoreline in `config/city.ts`, update the credit.
  Requirements: R15, R16, spec 1 R38. Tests: distance is 0 on the line and never negative; a missing shoreline gives no distance. Re-run the Chicago calibration pins and report any change.
- [x] **Task 4. Hotspots.** (branch `feat/spec2-task-04-hotspots`) `data/hotspots.ts` (McCormick Place, Soldier Field, Kellogg Global Hub, each with a dated note and evidence), `hotspots.ts` matching, no new venue kind (see R9, revised): McCormick scores through its lit glass share. Match each hotspot to its real building IDs by hand and record them.
  Requirements: R6 to R10, spec 1 R35. Tests: matching by ID, by name and distance, no match keeps the coordinates; config validator still passes; pinned replay results unchanged or noted.
- [x] **Task 5. Place builder and ranking.** (branch `feat/spec2-task-05-place-ranking`) `place-builder.ts`, `place-ranking.ts`. Not scored without height, kind or hotspot. Stable order.
  Requirements: R17 to R20, R30. Tests: unit; properties: order independent, no lit reason without lit data, dropping a field never raises the level past what the engine allows.

## Phase 2: Sources

- [x] **Task 6. BuildingSource interface and static source.** (branch `feat/spec2-task-06-building-source`, commits 077ed4f, f3addae) `building-source.ts` with `mergeSources`, `api/sources.ts` with the static source (dynamic import of the area JSON).
  Requirements: R31 to R33, R12. Tests: merge precedence, adjacent buildings do not merge, one failing source does not block another.

## Phase 3: Screens

- [x] **Task 7. Place list.** (branch `feat/spec2-task-07-place-list`, cut from the unmerged Task 6 branch; commits 63165cb, 7d8cf7d, 939e399) `place-row.ts`, `places-section.ts`: ranked list, top 10, "Show more", detail, empty and loading states, hostile-text test. Added to the org view under the night panel.
  Requirements: R19, R22 to R24, R27, R28. Tests: DOM tests. Screenshots at 390 and 1280 px.
- [ ] **Task 8. Map.** `map-view.ts` with the Leaflet module passed in, dynamic import, tile layer and attribution, text markers, 44 px controls, reduced motion, "Show map" button, selection kept in step with the list. Credits gain Overture and OpenStreetMap.
  Requirements: R5, R21, R22, R25, R26. Tests: fake Leaflet checks markers, attribution and focus. Bundle check. Screenshots.
- [ ] **Task 9. Volunteer view list.** Top places read-only, same labels, no map button on load.
  Requirements: R29. Tests: DOM; no copy tells anyone to touch a bird.

## Phase 4: Live OpenStreetMap source

- [ ] **Task 10. Overpass parse and client.** `overpass-parse.ts` (drops bad records), `api/overpass.ts` (8 s timeout, cache with date, no user data sent).
  Requirements: R11, R13, R14. Tests: fake fetch for success, timeout, 429, empty, NaN coordinate; cache hit and miss; properties on parsing.
- [ ] **Task 11. Live source in the source list.** Add the live source to `sources.ts`, show the fallback line with Retry when it fails, merge results.
  Requirements: R12, R31 to R33. Tests: DOM: fallback line and Retry; the app works with the live source failing.

## Phase 5: Close-out

- [ ] **Task 12. Review and log.** Mutation checks on the merge, shoreline and not-scored rules. Run `npm run check`. Fill the log sections (hooks, spec comparison, property tests). Update `structure.md` and `tech.md` if the layout changed.
  Requirements: all. Tests: full suite.

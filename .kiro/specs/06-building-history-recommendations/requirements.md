# Spec 6: Building history and route recommendations (requirements)

Status: IDEA. Not started. Written down so the earlier specs leave room for it. Depends on spec 2 (buildings and map), spec 3 (finds log) and spec 4 (coordinator tools). Evidence IDs refer to `docs/research.md`.

## Why

The risk engine (spec 1) says which nights matter and scores a place from its attributes. It cannot know which buildings actually kill birds, because glass share, treatment and landscaping are rarely in the map data (`docs/overture-check.md`). The monitors' own advice is that any building with hazardous light, glass and plantings can be dangerous and there is no single worst building (E23). The best signal Layover can build is its own record: **which building, which day, how many birds found, and how much looking was done.** Over time that record can rank buildings and suggest routes better than tags.

## Scope

In: a building record, a daily finds record with search effort, a building history score, route recommendations for coordinators and volunteers, import of partner counts.
Out: bird handling guidance, casualty predictions, public per-building rankings.

## Glossary

- **Building record**: one building with a stable ID, name, attributes and a bird-safe treatment history.
- **Day record**: the finds and the search effort for one building on one night-of date.
- **Search effort**: how much looking happened (a route walked past the building, minutes, number of people). A day with no effort is *unknown*, not zero.
- **History score**: an internal number from past day records. Shown only as a plain phrase (R13).

## A. Building records

- **R1.** Each building SHALL have a stable ID taken from the map data (the Overture ID or the OpenStreetMap ID), a name when known, and the attributes the risk engine reads (spec 1: lit glass share, tree near, kind, height, lake distance, bird-safe treatment).
- **R2.** A building's bird-safe treatment SHALL be stored as a list of dated entries (`none`, `partial`, `full`, with the date and who recorded it). The current status is the latest entry on or before the date asked about. (E22)
- **R3.** WHEN a treatment entry is added, the history score SHALL treat days before and after it separately, so old counts do not penalize a treated building. (E22)
- **R4.** Every attribute SHALL carry a `source` of `map`, `volunteer`, `coordinator` or `sample`, and sample values SHALL be labelled.

## B. Day records (counts by day)

- **R5.** WHEN a volunteer logs finds, the app SHALL attach them to a building and a night-of date (the evening the night started), not to the calendar day of the walk.
- **R6.** Each day record SHALL hold the counts by condition (dead, injured and taken in, stunned and released, unknown), the species list, and the effort (route, minutes, people).
- **R7.** WHEN a walk passes a building and finds nothing, the app SHALL record a day record with zero birds and the effort. A "nothing found" walk is data.
- **R8.** WHEN two volunteers log the same building on the same night, the app SHALL show the coordinator both entries and SHALL NOT add them together automatically, because they may be the same birds.
- **R9.** A day record with no effort SHALL be marked `unknown`, and SHALL NOT count as zero in any score.

## C. History score

- **R10.** The history score for a building SHALL be computed from finds per unit of effort, weighted toward recent seasons, and SHALL shrink toward the city average when there are few observed days. (E5: a few nights cause most deaths, so a short record is noisy.)
- **R11.** Adding a day record with more birds found, all else equal, SHALL NOT lower the score.
- **R12.** Adding days with effort and no finds SHALL NOT raise the score.
- **R13.** The score SHALL be shown to users only as a phrase such as "frequent finds in past seasons". It SHALL NOT show a count of birds per building as a prediction, and SHALL NOT show death or casualty numbers. (Product rule)
- **R14.** The score SHALL be an input to ranking, never a replacement for the engine's night level. A building can rank high because of history even on a low-risk night, and the reason SHALL say so.

## D. Recommendations

- **R15.** For a chosen night, the coordinator view SHALL rank buildings by the engine's place risk combined with history, with plain reasons, and SHALL flag buildings that no route passes.
- **R16.** The coordinator view SHALL suggest which route to staff first, by summing the ranked buildings each route covers and adjusting for open slots.
- **R17.** The volunteer view SHALL suggest a walkable loop that covers the highest-ranked buildings within a chosen time, starting near the volunteer.
- **R18.** A suggestion SHALL NOT send an untrained person to handle birds. Count-only suggestions are open to anyone. (Product rule)
- **R19.** Recommendations SHALL be deterministic for the same inputs and SHALL list the building IDs and reasons so a coordinator can check them.

## E. Import and export

- **R20.** A coordinator SHALL be able to import past counts from a partner group as a file, with a column mapping, a preview and a record of who imported it and from what source.
- **R21.** An import SHALL NOT overwrite volunteer-logged records. Imported records SHALL be marked `imported`.
- **R22.** Exports (spec 4) SHALL include the building ID and the night-of date, so counts can be matched to external reporting.

## F. Privacy and safety

- **R23.** Volunteer names SHALL NOT appear on building history. Coordinators may see who logged an entry.
- **R24.** Building history SHALL be visible to coordinators, and volunteers see only the phrase from R13.

## Property-based tests (planned)

| Property | Requirement |
|---|---|
| More birds in a day record never lowers the score | R11 |
| More effort with no finds never raises the score | R12 |
| A day record with unknown effort never changes the score | R9 |
| With no data the score equals the city average | R10 |
| Same inputs always give the same ranking | R19 |
| A treatment entry separates days before and after it | R3 |
| Importing never changes a volunteer-logged record | R21 |

## Open questions

1. **Partner data.** Will a monitoring group share building-level counts, and under what terms? Their data could seed the history for the demo.
2. **Building IDs.** Do we use Overture IDs, OSM IDs or both? Overture IDs are stable across releases, OSM IDs change less often for real buildings but split and merge.
3. **Effort.** Is minutes walked past the building enough, or do we need a per-building check-in?
4. **Demo.** Which sample history do we show, and how is it labelled?
5. **Shared claims.** Building history across many devices needs the shared-data layer (spec 5).

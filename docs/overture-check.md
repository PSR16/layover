# Overture buildings check (downtown Chicago, lakefront, Evanston)

Run on 2026-11-26 with the `overturemaps` Python client (`--type=building` and `--type=building_part`). Raw downloads are in `~/Documents/Development/layover-data/overture/` (outside the repo). Licence: the buildings theme is ODbL (Overture release notes); credit Overture and OpenStreetMap contributors. Sources inside the data: OpenStreetMap, USGS Lidar and Microsoft ML Buildings.

## Areas

| Area | Bounding box (west, south, east, north) | Buildings |
|---|---|---|
| Loop | -87.645, 41.872, -87.620, 41.890 | 1,464 |
| Lakefront (McCormick Place, Soldier Field) | -87.630, 41.843, -87.600, 41.868 | 1,777 |
| Evanston (Northwestern lakefront) | -87.685, 42.050, -87.665, 42.062 | 774 |

## How often each property is filled in (buildings)

| Property | Loop | Lakefront | Evanston |
|---|---|---|---|
| height | 62% | 88% | 98% |
| num_floors | 50% | 22% | 4% |
| class | 76% | 67% | 42% |
| names | 44% | 10% | 18% |
| facade_material | 7% | 0% | 1% |

Height is mostly filled in because many buildings combine OpenStreetMap with USGS Lidar. Floors are patchy outside the Loop. Facade material is almost always empty.

## Glass signal (building or any of its parts says "glass")

| Area | Buildings with any facade info | Buildings marked glass |
|---|---|---|
| Loop | 9% | 2.8% (41) |
| Lakefront | 0% | 0.2% (3) |
| Evanston | 1% | 0% |

Parts add some facade detail in the Loop (44% of 407 parts) and almost none elsewhere.

## The three buildings from the news and the dataset

| Building | Height | Floors | Class | Facade | Note |
|---|---|---|---|---|---|
| McCormick Place Lakeside Center | 30 m | none | none | none | Has parts. Not classed as a venue. |
| Soldier Field | 26.2 m | none | stadium | none | Class matches the stadium factor. |
| Kellogg Global Hub (Evanston) | about 19.6 m | 6 | university | none | Mirrored building with no glass information. |

## What this means

1. **Footprints and heights are good enough** for a building layer, especially with the Lidar-derived heights.
2. **Glass cannot come from this data.** The one building the news blames on a mirrored facade has no facade tag. The engine's lit-glass factor needs a hand-set value for named hotspots (labelled sample) and a clearly labelled low-confidence proxy for the rest.
3. **Venue kind needs a curated list.** Soldier Field is classed as a stadium, but McCormick Place (the highest-mortality site in the dataset, E1) has no class, so the kind factor would miss it. Add a small curated list of Chicago light-hazard venues, labelled sample, and consider a `convention_center` kind in `stadium.kinds`.
4. **Volunteer finds can become the glass signal.** The brief already records building and side for each bird. Over time those counts are a better risk input than any tag, and they feed the "risky buildings no route passes" feature.
5. **Decision for spec 2:** use Overture for footprints, height and class in a static Chicago extract; use OSM for venue and shoreline queries; hand-set glass for named hotspots.

# Data profile: McCormick Place collision dataset

Source and licence: see `data-sources.md` (Van Doren et al. 2021, CC BY 4.0). Raw files live outside the repo in `~/Documents/Development/layover-data/`. This page records how the authors prepared the data, read from their code (`collisions_analysis_archive.Rmd`). Items marked **inferred** are my reading, not stated in the dataset.

## Files used

| File | Content |
|---|---|
| `collisions/MCP_lights_collisions.xlsx` (sheet `Sheet4`) | One row per survey day, 3,468 rows (1999-05-21 to 2020-11-28). Per window bay: `L<n>` lighting code and `N<n>` bird count. Bays 16 and 17 share one count column (`N16+17`). |
| `collisions/window_metadata.xlsx` | Bay side (1 to 4), compass direction, length in feet. |
| `collisions/MCP_yearly_from_1978.csv` | Season totals per year since 1978. |
| `radar_processed/KLOT_compiled_20201224.csv` | KLOT radar scans by height band: reflectivity (`linear_eta`), flight direction, speed, `percent_rain`. |
| `radar_processed/data_2020-12-21_complete.csv` | Local bird density (`mean.birds.km3`) within 4, 8, 16, 32 km of the site, over land and lake. |
| `weather/isd/direct/725340-14819-<year>` | Hourly Midway Airport observations (ISD fixed-width; columns in `isd_fwf_columns.csv`). |

## Lighting codes

Counts of bay-days since 2000: `YN` 48,671; `NN` 14,763; `YY` 5,303; `DN` 2,411; `NY` 1,362; `VDN` 124; `QY` 60; `DY` 45; `QN` 26.

The authors code a bay as **lit (1) only when the code is `YN`**. Everything else is unlit (0), except `QN`, which is missing.

| Code | Authors' value | Reading |
|---|---|---|
| `YN` | lit | Interior lights on and visible from outside |
| `YY` | unlit | Lights on but not visible (**inferred**: second letter `Y` = covered or curtained) |
| `NN`, `NY` | unlit | Lights off |
| `DN`, `DY` | unlit | Dim (their comment) |
| `VDN` | unlit | Very dim (their comment) |
| `QY` | unlit | Curtains closed, so lighting does not matter (their comment) |
| `QN` | missing | Questionable record |

Day-level lit share (2000 on): median 0.71 of bays, quartiles 0.38 and 0.90. The paper's light index is the length-weighted share of lit bays, about 0.5 to 1 because at least seven bays are always lit.

## How the authors defined a night

- Night of date D = the evening of D through the dawn survey on D+1 (**inferred** from the `night_of` field).
- Sunset and sunrise come from the R `sunriset` function at the site.
- A night is cut into **three equal parts by elapsed share of the night**: early (0 to 0.33), middle (0.33 to 0.66), late (0.66 to 1). Radar and weather are averaged inside each part.
- Season: day of year under 200 is spring, otherwise fall.

## Weather

- Hourly wind speed and direction, ceiling height and visibility from Midway (ISD), averaged per night part.
- Wind is converted to east-west (`uwind`) and north-south (`vwind`) components, with positive `uwind` meaning wind blowing toward the east (a westerly). The ISD direction is the direction the wind comes **from**, which matches the convention in our design.
- Moon illumination (fraction) from the `suncalc` package, one value per night.

## Cleaning the authors applied

- Dropped 2000-05-09 (14 birds, likely an entry error) and one 2007-08-29 record for bay 7.
- Removed duplicate dates.
- Started the series in 2000.

## What this means for the build

1. The "night in thirds" design is the authors' method. Layover can use the same split.
2. Light status can be a lit share (0 to 1), with dim and covered bays counted as unlit.
3. Migration can come from the local radar density file. Scale it within each season (for example by percentile) before giving it to the risk engine.
4. Wind: use "from" degrees, and derive east-west and north-south components for any threshold maths.
5. Moon illumination is a candidate factor. Its effect is not shown here, so it needs evidence before it gets a weight.
6. The dataset covers one building. Calibration notes must say "Chicago lakefront, one site".

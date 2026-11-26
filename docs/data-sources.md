# Data sources and licences

Raw third-party data stays outside the repo. Only small derived tables may be committed, with the attribution below.

## Van Doren et al. 2021 collision dataset

- Title: Dataset for "Drivers of fatal bird collisions in an urban center".
- Authors: Van Doren BM, Willard D, Hennen M, Horton K, Stuber E, Sheldon D, Sivakumar A, Wang J, Farnsworth A, Winger B.
- Published 10 June 2021, Mendeley Data, version 2. DOI: 10.17632/mjvt3yxdkv.2.
- Paper: Van Doren et al. 2021, PNAS (see E1 in `research.md`).
- Licence: Creative Commons Attribution 4.0 International (CC BY 4.0), as stated on the dataset page.
- Covers: McCormick Place Lakeside Center (Chicago), dawn surveys 1999 to 2020, per-window lighting, KLOT radar migration measures, Midway Airport weather.
- Local copy: `~/Documents/Development/layover-data/` (outside the repo, not committed).

### What CC BY 4.0 lets us do

- Use, adapt and redistribute the data, including derived tables in this repo and numbers in the demo.
- Conditions: give credit, link to the licence, say what we changed, and do not imply the authors endorse Layover.

### Required attribution text

> Includes data derived from Van Doren et al. (2021), "Dataset for Drivers of fatal bird collisions in an urban center", Mendeley Data, DOI 10.17632/mjvt3yxdkv.2, licensed CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). Changes: aggregated by night and rescaled by Layover. The authors do not endorse Layover.

Use this text in the app credits and in any committed derived file's header.

### Rules for derived files

- Commit aggregates only (for example one row per night). Never commit the raw archive, radar CSVs or the cached R outputs.
- Every derived file records its source DOI, the date it was built and the script that built it.
- Collision counts stay in `docs/` and `tests/fixtures/`. The UI does not show them as a prediction (product rule).

## OpenStreetMap

Map and building data. Credit "© OpenStreetMap contributors" (ODbL) wherever the map or derived building data appears. Already required by the Leaflet attribution rule.

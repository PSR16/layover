# Calibration report 1: the risk engine against Chicago dawn counts

Status: findings and proposals. **Nothing in the engine or config has been changed yet.** Applying them is waiting for approval.

Data: 3,141 survey nights from the McCormick Place dataset (Van Doren et al. 2021, CC BY 4.0, see `data-sources.md`) that have radar. Each night is scored as the survey building (untreated, kind "building", trees near, 300 m from the lake, that day's real lit share) with the night's radar migration percentile and Midway weather. Years up to 2012 are the **train** set and later years the **test** set. An **event night** is 10 or more birds found (289 nights, 9%). Birds found are used only to judge the engine and are never shown in the app.

Reproduce with `npx vite-node tools/calibrate-risk.js` (needs the exported tables, see `tools/export-chicago-dataset.py`).

## What the engine does well

- It ranks event nights above other nights about as well as the best simple scores built from the same inputs (AUC 0.78 train, 0.80 test; 0.5 is chance). Migration alone gives 0.72 and 0.75. Migration times lit share gives 0.79.
- Quiet nights score low. On the 16 chosen replay nights, all 4 quiet nights were `low` at night level.

## Problems found

1. **Thresholds do not fit the scale of the scores.** As built, a night can never reach `high` (night-level `high` flags 0% of 3,141 nights, since migration alone tops out near 0.5). At building level, 24 to 28% of nights are `high` and 67 to 71% are `elevated`, so `elevated` carries no information and `low` is almost empty (4 to 6%).
2. **One set of thresholds cannot serve both levels.** Night totals peak near 0.75 while building totals reach about 1.4. They need separate thresholds.
3. **The wind rules from New York do not match this site.** On heavy-migration nights the event rate is highest with **south wind in spring** (26% train, 18% test, against 5% and 4% otherwise) and **west wind in fall** (32% and 40%, against 16% and 11%). North and east winds go with few events in both seasons. Spring north and west winds, which E2 (New York) lists as unfavorable, show no increase here. The pattern holds in both the train and test years. Low ceiling and low visibility show no effect at this site (few such nights, and the ceiling proxy is coarse).
4. **Making lit glass depend on migration did not help.** Scaling the light factors by migration gave AUC 0.79, no better than as built. The additive form already captures most of what the two inputs can tell us here.
5. **A night's count is noisy.** Even the best variants put 41 to 43% of birds on the top 15% of nights, against 67% for a perfect ranking. That fits the authors' own model error (about 3 birds per night). The engine is a planning guide, not a forecast.

## Proposed changes (not applied)

| # | Change | Test-year effect |
|---|---|---|
| P1 | Add separate `placeThresholds` to the config, set so `high` is about the top 15% of nights on the train set, and recalibrate the night thresholds the same way. Night: elevated 0.37, high 0.47. Building: elevated 0.67, high 0.79. | `high` nights average 8 to 9 birds, `elevated` about 4, `low` about 2 (about 5 times more on `high` than `low`). As built: `high` 7.1, `elevated` 2.1, `low` 0.5 but `low` holds only 6% of nights. |
| P2 | Add a Chicago lakefront overlay with spring south and fall west wind sectors (spring [135, 225], fall [225, 315]). The default config keeps the E2 sectors. | Top 15% share 37% to 42%, `high` birds per night 8.1 to 9.3. AUC about the same (0.798 to 0.799). |
| P3 | Label the overlay "Chicago lakefront, one site, untreated building" and add a dated config note citing this dataset as local evidence. | None (honesty). |

Left alone: the migration weight, lit-glass weight, light multiplier and the cap and floor rules. Raising the wind weight to 0.25 or 0.35 added about 0.003 AUC, which is not worth changing.

## Caveats

- One building, one lakefront site, before its 2024 treatment. Do not apply the Chicago sector overlay to other cities.
- The sector choice looks at all years together, though it holds separately in train and test. Treat it as a description of this site, not a general rule.
- Thresholds that flag a fixed share of nights make `high` rare by construction. The test years show the flagged nights really are busier, but a different year could differ.
- McCormick's own lighting was the main driver of its counts (E1). Other buildings may behave differently, and treated buildings differ most (E22).

## Tool output

```
3141 nights with radar, 289 event nights (10+ birds). Train: up to 2012. Test: after.

Single signals, for comparison (AUC for event nights, Spearman with birds found):
  migration (middle part)          train AUC 0.718 rho 0.325  |  test AUC 0.749 rho 0.349
  lit share alone                  train AUC 0.688 rho 0.387  |  test AUC 0.652 rho 0.254
  migration x lit share            train AUC 0.786 rho 0.443  |  test AUC 0.793 rho 0.412
  migration x lit share squared    train AUC 0.798 rho 0.487  |  test AUC 0.796 rho 0.424
  migration squared x lit share    train AUC 0.765 rho 0.398  |  test AUC 0.781 rho 0.391

Event rate on heavy-migration nights (middle part at or above 0.7), by wind direction:
  spring train: wind from south  26% of 126, other   5% of 129  |  test: wind from south  18% of  74, other   4% of  69
  spring train: wind from west   9% of  32, other  16% of 223  |  test: wind from west  20% of   5, other  11% of 138
  spring train: wind from north   3% of  35, other  17% of 220  |  test: wind from north   4% of  23, other  13% of 120
  spring train: wind from east   3% of  63, other  19% of 192  |  test: wind from east   2% of  41, other  15% of 102
  fall   train: wind from south  33% of  43, other  21% of 271  |  test: wind from south  23% of  26, other  22% of 169
  fall   train: wind from west  32% of 134, other  16% of 180  |  test: wind from west  40% of  81, other  11% of 114
  fall   train: wind from north  13% of  90, other  26% of 224  |  test: wind from north   9% of  58, other  28% of 137
  fall   train: wind from east   4% of  49, other  26% of 265  |  test: wind from east   6% of  32, other  26% of 163

A. building, engine as built  [elevated 0.35, high 0.70]
  train  AUC 0.777  rho 0.467  top15%   39%  | high   28% nights   58% birds   7.7/night | elevated   67% nights   42% birds   2.4/night | low    4% nights    0% birds   0.2/night
  test   AUC 0.798  rho 0.451  top15%   37%  | high   24% nights   53% birds   7.1/night | elevated   71% nights   46% birds   2.1/night | low    6% nights    1% birds   0.5/night

B. building, thresholds from the top 15% of train nights  [elevated 0.67, high 0.79]
  train  AUC 0.777  rho 0.467  top15%   39%  | high   15% nights   39% birds   9.9/night | elevated   28% nights   30% birds   4.0/night | low   57% nights   31% birds   2.1/night
  test   AUC 0.798  rho 0.451  top15%   37%  | high   11% nights   29% birds   8.1/night | elevated   30% nights   37% birds   3.9/night | low   59% nights   35% birds   1.9/night

D. building, Chicago wind sectors, quantile thresholds  [elevated 0.67, high 0.79]
  train  AUC 0.789  rho 0.484  top15%   41%  | high   15% nights   41% birds  10.5/night | elevated   24% nights   26% birds   4.2/night | low   61% nights   33% birds   2.0/night
  test   AUC 0.799  rho 0.458  top15%   42%  | high   11% nights   33% birds   9.3/night | elevated   24% nights   31% birds   4.1/night | low   65% nights   36% birds   1.8/night

N1. night only, engine as built  [elevated 0.35, high 0.70]
  train  AUC 0.727  rho 0.355  top15%   31%  | high    0% nights    0% birds   0.0/night | elevated   49% nights   70% birds   5.4/night | low   51% nights   30% birds   2.2/night
  test   AUC 0.765  rho 0.382  top15%   34%  | high    0% nights    0% birds   0.0/night | elevated   48% nights   72% birds   4.8/night | low   52% nights   28% birds   1.7/night

N2. night only, Chicago wind sectors, quantile thresholds  [elevated 0.37, high 0.47]
  train  AUC 0.741  rho 0.376  top15%   34%  | high   15% nights   34% birds   8.5/night | elevated   25% nights   30% birds   4.6/night | low   60% nights   36% birds   2.3/night
  test   AUC 0.768  rho 0.387  top15%   39%  | high   13% nights   35% birds   8.8/night | elevated   24% nights   28% birds   3.7/night | low   63% nights   37% birds   1.9/night

C. building, lit factors scaled by migration (minimum 0.4), quantile thresholds  [elevated 0.61, high 0.74]
  train  AUC 0.771  rho 0.430  top15%   38%  | high   15% nights   39% birds   9.7/night | elevated   30% nights   30% birds   3.9/night | low   55% nights   31% birds   2.1/night
  test   AUC 0.793  rho 0.429  top15%   41%  | high   12% nights   31% birds   8.4/night | elevated   30% nights   37% birds   3.9/night | low   58% nights   32% birds   1.7/night

C. building, lit factors scaled by migration (minimum 0.1), quantile thresholds  [elevated 0.58, high 0.73]
  train  AUC 0.765  rho 0.410  top15%   38%  | high   15% nights   38% birds   9.6/night | elevated   30% nights   31% birds   3.9/night | low   55% nights   31% birds   2.1/night
  test   AUC 0.788  rho 0.414  top15%   39%  | high   12% nights   31% birds   8.3/night | elevated   31% nights   38% birds   3.9/night | low   58% nights   31% birds   1.7/night
```

/**
 * Default risk configuration: plain data only, safe to turn into JSON (R30).
 * Change numbers and wording here, never inside the factor functions.
 *
 * Every numeric value is an UNCALIBRATED ASSUMPTION until it is checked against replay nights
 * (Task 11) and the Chicago dataset (spec 1b). Evidence IDs point to docs/research.md and say
 * which finding supports the direction or relative size of a weight. A weight with no direct
 * evidence says "assumption" in its evidence list (R23, R35).
 *
 * Wind directions are where the wind comes FROM, in degrees (E1, E2).
 */
export const DEFAULT_CONFIG = {
  version: '0.1.0',

  notes: [
    {
      date: '2026-11-26',
      change:
        'Initial placeholder weights. Order follows research rules: migration largest, lit glass above height.',
      evidence: ['E1', 'E5', 'E14'],
    },
    {
      date: '2026-11-26',
      change:
        'Added weatherScaling (weather points grow with migration, E2/E5) and wind.lightWindFactor (assumption) for the night factors.',
      evidence: ['E2', 'E5'],
    },
    {
      date: '2026-11-26',
      change:
        'Added place settings: litGlass.reasonAbove, stadium.kinds, height.fullAtMeters (assumptions for the place factors).',
      evidence: ['E6', 'E8', 'E14'],
    },
    {
      date: '2026-11-26',
      change:
        'Added treatmentDiscount (R40, E22), weatherOnly.floorMinPoints (assumption) and the reasons quiet and birdSafeGlass for the combine step.',
      evidence: ['E22', 'E2'],
    },
  ],

  // Total points at or above these values give the level (assumption, see design section 3).
  thresholds: { elevated: 0.35, high: 0.7 },

  // Migration level (0 to 1) bands, used to pick the reason wording (assumption).
  migrationBands: { moderate: 0.4, heavy: 0.7 },

  weights: {
    migration: { weight: 0.45, evidence: ['E1', 'E3', 'E5'] },
    wind: { weight: 0.15, evidence: ['E2', 'E17'] },
    windShift: { weight: 0.08, evidence: ['E4'] },
    visibility: { weight: 0.1, evidence: ['E2'] },
    carryOver: { weight: 0.06, evidence: ['E4', 'E17'] },
    fallBonus: { weight: 0.05, evidence: ['E5'] },
    litGlass: { weight: 0.3, evidence: ['E1', 'E7', 'E16'], reasonAbove: 0.5 }, // wording shown from half lit (assumption)
    tree: { weight: 0.05, evidence: ['E6', 'E15'] },
    stadium: { weight: 0.12, evidence: ['E6', 'E8'], kinds: ['stadium', 'arena', 'installation'] },
    height: { weight: 0.02, evidence: ['E14'], fullAtMeters: 100 }, // full weight at this height (assumption)
    lakeshore: { weight: 0.06, evidence: ['E1', 'E2'], maxDistanceMeters: 1500 },
  },

  // Weights of the three night parts. Middle highest (E1); exact split is an assumption.
  nightParts: { early: 0.25, middle: 0.5, late: 0.25, evidence: ['E1', 'assumption'] },

  // Low cloud or low visibility multiplies the light contribution (R14).
  lightMultiplier: {
    lowCloudAbovePercent: 60,
    lowVisibilityBelowKm: 5,
    cloudFactor: 1.4,
    visibilityFactor: 1.3,
    evidence: ['E2', 'E10', 'E11'],
  },

  // Weather alone: never `high`, at least `elevated` when unfavorable (R15, E2, E5).
  // The floor applies when unfavorable weather adds at least floorMinPoints (assumption).
  weatherOnly: {
    floorLevel: 'elevated',
    capLevel: 'elevated',
    floorMinPoints: 0.08,
    evidence: ['E2', 'E5'],
  },

  // Share of the 'light' group contribution removed by bird-safe glass treatment (R40, E22).
  // Full is kept well below the reported drop of more than 95% (research rule 10).
  treatmentDiscount: { none: 0, partial: 0.5, full: 0.85, evidence: ['E22'] },

  // Weather points scale from `minimum` (no migration) up to 1 (full migration): weather matters
  // most on heavy nights (E2, E5). Spring low visibility ignores this scale (E2).
  weatherScaling: { minimum: 0.4, evidence: ['E2', 'E5'] },

  // Level cap when migration data is missing (R22, assumption).
  missingMigrationCap: 'elevated',

  // Unfavorable wind sectors in degrees, wind coming from (R16). Edges are assumptions.
  wind: {
    fall: { unfavorableFrom: [[135, 315]] },
    spring: {
      unfavorableFrom: [
        [315, 360],
        [0, 45],
        [225, 315],
      ],
    },
    strongMps: 6,
    lightWindFactor: 0.5, // share of the wind weight when unfavorable wind is below strongMps (assumption)
    evidence: ['E1', 'E2', 'E4'],
  },

  // Season windows as 'MM-DD' (R19). Dates are an assumption, widened from E15 and E1 survey dates.
  seasons: { spring: ['03-15', '06-05'], fall: ['08-15', '11-30'] },

  // Plain-language wording, one line per reason key (R24). No evidence IDs or jargon here.
  reasons: {
    migrationHeavy: 'Heavy bird migration is expected tonight.',
    migrationModerate: 'A fair number of migrating birds are expected tonight.',
    windUnfavorable:
      'Winds are blowing against migrating birds, which pushes them toward the city.',
    windShift: 'The wind turns against migrating birds before dawn.',
    lowVisibility: 'Low visibility makes birds more likely to hit buildings.',
    springLowVisibility:
      'Low visibility in spring is linked to far more collisions, even on lighter nights.',
    lowCloud: 'Low cloud pulls birds toward lit buildings.',
    carryOver: 'Heavy migration and rough weather over the last two nights still affect tonight.',
    fallSeason: 'Fall nights carry more collision risk than spring nights.',
    litGlass: 'Large areas of lit glass.',
    stadium: 'Stadium or large light installation.',
    nearTrees: 'Trees right next to the glass.',
    lakeshoreWind: 'Near the lakeshore, where west winds concentrate birds.',
    missingMigration:
      'No migration estimate is available, so the level is held at elevated at most.',
    weatherOnlyElevated: 'Weather alone raises the level to elevated.',
    quiet: 'Conditions look quiet for migrating birds.',
    birdSafeGlass: 'Bird-safe treatment on the glass lowers the risk here.',
  },
};

/**
 * Risk config overlay for the Chicago lakefront (R42). Pass it to the engine as the override
 * argument: `assessNight(conditions, CHICAGO_RISK_OVERRIDES)`.
 *
 * What it changes: the unfavorable wind sectors. In 3,141 survey nights at McCormick Place
 * (E1 dataset, docs/calibration-report.md), on heavy-migration nights the event rate was highest
 * with south wind in spring and west wind in fall, in both the train years (to 2012) and the test
 * years (after). The default sectors (E2, New York) put north and west in spring and south and
 * west in fall, which this site does not show.
 *
 * Limits: one building, one lakefront site, surveyed before its 2024 treatment. Do not use this
 * overlay for other cities. Show CHICAGO_RISK_LABEL wherever it is applied.
 */
import { DEFAULT_CONFIG } from '../lib/risk-config.js';

export const CHICAGO_RISK_LABEL = 'Chicago lakefront, one site, untreated building';

export const CHICAGO_RISK_OVERRIDES = {
  version: '0.2.0-chicago-lakefront',
  // Arrays replace the default array in a merge, so the overlay lists every note.
  notes: [
    ...DEFAULT_CONFIG.notes,
    {
      date: '2026-11-26',
      change:
        'Chicago lakefront overlay: spring south wind [135, 225] and fall west wind [225, 315] count as unfavorable, from 3,141 survey nights (train 2000 to 2012, tested 2013 to 2020). One site, untreated building. Not for other cities.',
      evidence: ['E1'],
    },
  ],
  wind: {
    spring: { unfavorableFrom: [[135, 225]] },
    fall: { unfavorableFrom: [[225, 315]] },
  },
};

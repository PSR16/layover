#!/usr/bin/env node
/**
 * Build src/data/radar-nights.json from the tables written by tools/export-chicago-dataset.py.
 *
 *   node tools/build-replay-nights.js --data ~/Documents/Development/layover-data/derived \
 *     --out src/data/radar-nights.json --built-on 2026-11-26
 *
 * The raw dataset stays outside the repo. Only the small chosen-nights file is committed, with the
 * CC BY 4.0 attribution (docs/data-sources.md, requirement R36).
 */
import { writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { chooseNights, toReplayNight } from './replay-nights-core.js';
import { DEFAULT_DATA_DIRECTORY, SITE, loadCandidates } from './chicago-data.js';

const ATTRIBUTION =
  'Includes data derived from Van Doren et al. (2021), "Dataset for Drivers of fatal bird collisions in an urban center", ' +
  'Mendeley Data, DOI 10.17632/mjvt3yxdkv.2, licensed CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). ' +
  'Changes: selected nights, radar bird density converted to a 0 to 1 percentile within season, ' +
  'weather averaged into three night parts. The authors do not endorse Layover.';

const ASSUMPTIONS = [
  'Night of D is sunset on D to sunrise on D+1; the dawn survey on D+1 is matched to it.',
  'Migration is the local radar bird density within 32 km (land and lake), scans with at most half of the area masked as weather, averaged per night part and ranked as a percentile among all nights of the same season (spring means day of year under 200).',
  'Weather is Chicago Midway hourly routine reports averaged per night part. A ceiling under 1,500 m counts as low cloud (100 percent), otherwise 0.',
  'Lit share counts only lighting code YN as lit, weighted by window length.',
  'Counts in "reference" are for checking the engine only. The interface never shows them.',
  'The building was surveyed before its 2024 bird-safe treatment, so these nights describe an untreated building.',
];

function build(directory, builtOn) {
  const withLevels = loadCandidates(directory);
  return {
    meta: {
      title: 'Radar replay nights from the McCormick Place dataset',
      site: SITE,
      source: 'Van Doren et al. 2021, Mendeley Data, DOI 10.17632/mjvt3yxdkv.2',
      licence: 'CC BY 4.0',
      attribution: ATTRIBUTION,
      builtBy: 'tools/export-chicago-dataset.py and tools/build-replay-nights.js',
      builtOn,
      nightsConsidered: withLevels.length,
      assumptions: ASSUMPTIONS,
    },
    nights: chooseNights(withLevels).map(toReplayNight),
  };
}

function main() {
  const { values } = parseArgs({
    options: {
      data: {
        type: 'string',
        default: DEFAULT_DATA_DIRECTORY,
      },
      out: { type: 'string', default: 'src/data/radar-nights.json' },
      'built-on': { type: 'string', default: new Date().toISOString().slice(0, 10) },
    },
  });
  const result = build(values.data, values['built-on']);
  writeFileSync(values.out, `${JSON.stringify(result, null, 2)}\n`);
  console.log(
    `Wrote ${result.nights.length} nights (from ${result.meta.nightsConsidered}) to ${values.out}`,
  );
}

main();

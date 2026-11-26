/**
 * Place factors: each one reads one building, venue or route plus the night's conditions
 * and returns { id, group, points, reasonKey, missing } (R31).
 * Groups: 'light' factors are multiplied by cloud and visibility in the combine step (R14);
 * 'place' factors are not.
 *
 * There is deliberately no facade compass input (R21; E15). Site differences seen in
 * Chicago (E1) come from the lake, trees and lighting, which are modelled directly.
 */
import { factorResult, clampShare } from './risk-factor-result.js';
import { migrationLevel, weatherScale, westerlyShare } from './risk-inputs.js';

/** A place with no `lit` flag counts as lit: the cautious choice (research rule 10). */
function isLit(place) {
  return place?.lit !== false;
}

function litShareOf(place) {
  return Number.isFinite(place?.litGlassArea) ? clampShare(place.litGlassArea) : undefined;
}

/** Lit glass area is the strongest building factor (R12; E1, E7, E16). */
const litGlassFactor = {
  id: 'litGlass',
  group: 'light',
  evidence: ['E1', 'E7', 'E16'],
  reasonKeys: ['litGlass'],
  evaluate(place, conditions, config) {
    const share = litShareOf(place);
    if (share === undefined) {
      return factorResult('litGlass', 'light', 0, { missing: ['litGlassArea'] });
    }
    const entry = config.weights.litGlass;
    const lit = isLit(place);
    return factorResult('litGlass', 'light', lit ? entry.weight * share : 0, {
      reasonKey: lit && share >= entry.reasonAbove ? 'litGlass' : null,
    });
  },
};

/**
 * Trees next to glass raise that glass's contribution (R21; E6, E15). E14 found fewer
 * collisions near trees in China. Where studies disagree we take the cautious reading
 * (research rule 10) and keep the bonus small.
 */
const treeFactor = {
  id: 'tree',
  group: 'light',
  evidence: ['E6', 'E15'],
  reasonKeys: ['nearTrees'],
  evaluate(place, conditions, config) {
    const share = litShareOf(place) ?? 0;
    if (!place?.treeNear || !isLit(place) || share === 0) {
      return factorResult('tree', 'light', 0);
    }
    return factorResult('tree', 'light', config.weights.tree.weight * share, {
      reasonKey: 'nearTrees',
    });
  },
};

/** Stadiums, arenas and light installations are major hazards while lit (R20; E6, E8). */
const kindFactor = {
  id: 'kind',
  group: 'light',
  evidence: ['E6', 'E8'],
  reasonKeys: ['stadium'],
  evaluate(place, conditions, config) {
    const { weight, kinds } = config.weights.stadium;
    if (!kinds.includes(place?.kind) || !isLit(place)) {
      return factorResult('kind', 'light', 0);
    }
    return factorResult('kind', 'light', weight, { reasonKey: 'stadium' });
  },
};

/** Height is a weak signal and always weighs less than lit glass (R13; E1, E14). */
const heightFactor = {
  id: 'height',
  group: 'place',
  evidence: ['E14'],
  reasonKeys: [],
  evaluate(place, conditions, config) {
    const { weight, fullAtMeters } = config.weights.height;
    if (!Number.isFinite(place?.heightMeters)) {
      return factorResult('height', 'place', 0);
    }
    return factorResult('height', 'place', weight * clampShare(place.heightMeters / fullAtMeters));
  },
};

function isNearLake(place, maxDistanceMeters) {
  const distance = place?.lakeDistanceMeters;
  return Number.isFinite(distance) && distance >= 0 && distance <= maxDistanceMeters;
}

/** West winds concentrate birds along the lakeshore, most on heavy nights (R38; E1, E2). */
const lakeshoreFactor = {
  id: 'lakeshore',
  group: 'place',
  evidence: ['E1', 'E2'],
  reasonKeys: ['lakeshoreWind'],
  evaluate(place, conditions, config) {
    const { weight, maxDistanceMeters } = config.weights.lakeshore;
    if (!isNearLake(place, maxDistanceMeters)) {
      return factorResult('lakeshore', 'place', 0);
    }
    const share = westerlyShare(conditions?.weather, config) ?? 0;
    const scale = weatherScale(migrationLevel(conditions?.migration, config), config);
    const points = weight * share * scale;
    return factorResult('lakeshore', 'place', points, {
      reasonKey: points > 0 ? 'lakeshoreWind' : null,
    });
  },
};

export const PLACE_FACTORS = [
  litGlassFactor,
  treeFactor,
  kindFactor,
  heightFactor,
  lakeshoreFactor,
];

/** Every reason key the place factors can return, for the config validator (rule 5). */
export const PLACE_REASON_KEYS = PLACE_FACTORS.flatMap((factor) => factor.reasonKeys);

/**
 * The curated list of Chicago light-hazard sites (spec 2 R6 to R10). Plain data: edit a value
 * here and the place score changes. Every value that does not come from the map is hand-set and
 * shown as sample data (R7). Each note says where its values came from; a value with no source
 * says "assumption". A value nobody knows is left out, never guessed.
 *
 * `match.buildingId` is the Overture ID in src/data/buildings-*.json (release 2026-11-18.0).
 */
import type { Hotspot } from '../lib/types.ts';
export const HOTSPOTS: Hotspot[] = [
  {
    id: 'mccormick-lakeside',
    name: 'McCormick Place Lakeside Center',
    reason: 'The site with the most recorded collisions in the Chicago dataset.',
    match: {
      buildingId: '22e8aa23-5afa-483f-844c-e40b64fc220e',
      osmId: 'way/136340574',
      near: { latitude: 41.8531, longitude: -87.6123 },
      maxDistanceMeters: 150,
    },
    litGlassShare: 0.71,
    treeNear: true,
    birdSafeTreatment: 'partial',
    note: {
      date: '2026-11-27',
      evidence: ['E1', 'E22', 'E23'],
      text:
        'Lit glass share 0.71 is the median share of lit bays on survey days, 2000 to 2020 (before treatment). ' +
        'Trees near the glass is an assumption carried over from the calibration. ' +
        'Treatment is set to partial: markers went on 120,000 sq ft of glass in 2024 and non-essential lights are dimmed overnight, ' +
        'and a drop of more than 95 percent is reported. Partial is the cautious reading. ' +
        'No venue kind is set: the calibration already scores this building through its lit glass, and a kind would count the lights twice.',
    },
  },
  {
    id: 'soldier-field',
    name: 'Soldier Field',
    reason:
      'A stadium with large lights. Stadiums caused a large share of collisions in other cities.',
    match: {
      buildingId: '3d88c673-7ec3-490a-b97c-723b67e7c681',
      osmId: 'relation/16699535',
      near: { latitude: 41.8623, longitude: -87.6176 },
      maxDistanceMeters: 200,
    },
    kind: 'stadium',
    note: {
      date: '2026-11-27',
      evidence: ['E6', 'E8'],
      text:
        'Kind comes from the map class (stadium). The lit glass share is not known and is left out, so the score lists it as missing. ' +
        'No collision count for this site is used.',
    },
  },
  {
    id: 'kellogg-global-hub',
    name: 'Kellogg Global Hub',
    reason:
      'A mirrored-glass building on the Evanston lakefront named in news reports of the October 2026 collisions.',
    match: {
      buildingId: '21d46636-657c-4508-9c16-0935e3fd7c75',
      osmId: 'way/466698283',
      near: { latitude: 42.0574, longitude: -87.672 },
      maxDistanceMeters: 150,
    },
    litGlassShare: 0.6,
    treeNear: false,
    note: {
      date: '2026-11-27',
      evidence: ['E7', 'assumption'],
      text:
        'The mirrored glass facade comes from news reports (docs/overture-check.md). The map has no facade or lighting data for it. ' +
        'The lit glass share of 0.6 is an assumption, a placeholder to edit when a monitoring group can say better.',
    },
  },
];

import { describe, it, expect } from 'vitest';
import fastCheck from 'fast-check';
import { parseOverpass } from '../src/lib/overpass-parse.ts';
import { isValidBuilding } from '../src/lib/buildings.ts';
import { wayElement } from './helpers/overpass.ts';

const anyNumber = fastCheck.oneof(
  fastCheck.double({ noNaN: false }),
  fastCheck.constant(Number.NaN),
  fastCheck.constant(Number.POSITIVE_INFINITY),
  fastCheck.constant(1000),
);
const point = fastCheck.record({ lat: anyNumber, lon: anyNumber });
const tagText = fastCheck.oneof(fastCheck.string(), fastCheck.constant('<script>1</script>'));
const element = fastCheck.record({
  type: fastCheck.constantFrom('way', 'node', 'relation'),
  id: fastCheck.oneof(fastCheck.integer(), fastCheck.constant(Number.NaN)),
  geometry: fastCheck.oneof(fastCheck.array(point, { maxLength: 8 }), fastCheck.constant(null)),
  tags: fastCheck.dictionary(fastCheck.string(), tagText, { maxKeys: 4 }),
});

const numbersOf = (building) => [...building.footprint.flat(), ...Object.values(building.centroid)];
const wayWithId = (id) => wayElement(id);
const osmIdOf = (building) => building.osmId;
const osmIdFor = (id) => `way/${id}`;

describe('parseOverpass properties', () => {
  // **Validates: Requirements 14** (spec 2 R14, R27)
  it('every record it returns passes validation, and kept plus dropped equals the input', () => {
    fastCheck.assert(
      fastCheck.property(fastCheck.array(element, { maxLength: 12 }), (elements) => {
        const result = parseOverpass({ elements });
        expect(result.buildings.every(isValidBuilding)).toBe(true);
        expect(result.buildings.length + result.dropped).toBe(elements.length);
      }),
    );
  });

  it('never returns a non-finite coordinate', () => {
    fastCheck.assert(
      fastCheck.property(fastCheck.array(element, { maxLength: 12 }), (elements) => {
        const numbers = parseOverpass({ elements }).buildings.flatMap(numbersOf);
        expect(numbers.every(Number.isFinite)).toBe(true);
      }),
    );
  });

  it('is deterministic and never throws for any list of elements', () => {
    fastCheck.assert(
      fastCheck.property(fastCheck.array(fastCheck.anything(), { maxLength: 10 }), (elements) => {
        const first = parseOverpass({ elements });
        expect(parseOverpass({ elements })).toEqual(first);
      }),
    );
  });

  it('keeps every well-formed way with a distinct id, in order', () => {
    fastCheck.assert(
      fastCheck.property(
        fastCheck.uniqueArray(fastCheck.integer({ min: 1 }), { maxLength: 10 }),
        (ids) => {
          const result = parseOverpass({ elements: ids.map(wayWithId) });
          expect(result.buildings.map(osmIdOf)).toEqual(ids.map(osmIdFor));
        },
      ),
    );
  });
});

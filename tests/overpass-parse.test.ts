import { describe, it, expect } from 'vitest';
import { parseHeightMeters, parseOverpass } from '../src/lib/overpass-parse.ts';
import { isValidBuilding } from '../src/lib/buildings.ts';
import { answer, wayElement } from './helpers/overpass.ts';

describe('parseHeightMeters', () => {
  it.each([
    ['45', 45],
    ['45 m', 45],
    ['150 ft', 45.7],
    ['12.5', 12.5],
  ])('reads %s', (text, expected) => {
    expect(parseHeightMeters(text)).toBe(expected);
  });

  it.each(['', 'tall', '0', '-5', '10 floors', '1e9x', undefined])('leaves %s missing', (text) => {
    expect(parseHeightMeters(text)).toBeUndefined();
  });
});

describe('parseOverpass', () => {
  it('turns a way into a record with an OpenStreetMap ID and the live source name', () => {
    const { buildings, dropped } = parseOverpass(
      answer([wayElement(42, { name: 'Test Hall', height: '30' })]),
    );
    expect(dropped).toBe(0);
    expect(buildings[0]).toMatchObject({
      id: 'osm/way/42',
      osmId: 'way/42',
      name: 'Test Hall',
      heightMeters: 30,
      source: 'map',
      sources: ['openstreetmap'],
    });
    expect(isValidBuilding(buildings[0])).toBe(true);
  });

  it('leaves height, name and kind missing when the tags have none', () => {
    const [record] = parseOverpass(answer([wayElement(1)])).buildings;
    expect(record).not.toHaveProperty('heightMeters');
    expect(record).not.toHaveProperty('name');
    expect(record).not.toHaveProperty('kind');
  });

  it('does not guess a height from building:levels', () => {
    const [record] = parseOverpass(answer([wayElement(1, { 'building:levels': '40' })])).buildings;
    expect(record).not.toHaveProperty('heightMeters');
  });

  it('maps stadium and arena tags to a kind, and ignores other building values', () => {
    const kinds = parseOverpass(
      answer([
        wayElement(1, { building: 'stadium' }),
        wayElement(2, { building: 'arena' }),
        wayElement(3, { leisure: 'stadium' }),
        wayElement(4, { building: 'constructor' }),
        wayElement(5, { building: '__proto__' }),
      ]),
    ).buildings.map((building) => building.kind);
    expect(kinds).toEqual(['stadium', 'arena', 'stadium', undefined, undefined]);
  });

  it('drops and counts a NaN or missing coordinate, an open ring, a node and a missing geometry', () => {
    const nanWay = wayElement(1);
    nanWay.geometry[1].lat = Number.NaN;
    const openWay = wayElement(2);
    openWay.geometry.pop();
    const noGeometry = { type: 'way', id: 3, tags: { building: 'yes' } };
    const node = { type: 'node', id: 4, lat: 41.88, lon: -87.63 };
    const shortWay = { ...wayElement(5), geometry: wayElement(5).geometry.slice(0, 2) };
    const stringCoordinate = wayElement(6);
    (stringCoordinate.geometry[0] as { lat: unknown }).lat = '41.88';
    const result = parseOverpass(
      answer([nanWay, openWay, noGeometry, node, shortWay, stringCoordinate, wayElement(7), null]),
    );
    expect(result.buildings.map((building) => building.id)).toEqual(['osm/way/7']);
    expect(result.dropped).toBe(7);
  });

  it('drops a relation even when it carries a drawable ring', () => {
    const relation = { ...wayElement(11), type: 'relation' };
    expect(parseOverpass(answer([relation]))).toEqual({ buildings: [], dropped: 1 });
  });

  it('drops a repeated way and a coordinate outside the globe', () => {
    const outside = wayElement(9, {}, [95, -87.63]);
    const result = parseOverpass(answer([wayElement(8), wayElement(8), outside]));
    expect(result.buildings).toHaveLength(1);
    expect(result.dropped).toBe(2);
  });

  it('keeps hostile text as plain text and cuts a very long name', () => {
    const hostile = '<img src=x onerror=alert(1)>';
    const long = 'A'.repeat(500);
    const [first, second] = parseOverpass(
      answer([wayElement(1, { name: hostile }), wayElement(2, { name: long })]),
    ).buildings;
    expect(first.name).toBe(hostile);
    expect(second.name).toHaveLength(120);
  });

  it('ignores tags that are not text, and a blank name', () => {
    const element = wayElement(1, { name: '   ' });
    (element.tags as Record<string, unknown>).height = 40;
    const [record] = parseOverpass(answer([element])).buildings;
    expect(record).not.toHaveProperty('name');
    expect(record).not.toHaveProperty('heightMeters');
  });

  it('returns nothing for an empty list', () => {
    expect(parseOverpass(answer([]))).toEqual({ buildings: [], dropped: 0 });
  });

  it.each([null, 'text', 42, [], {}, { elements: 'no' }])('throws for %j', (input) => {
    expect(() => parseOverpass(input)).toThrow(TypeError);
  });
});

import { describe, it, expect } from 'vitest';
import {
  OVERPASS_ENDPOINT,
  OVERPASS_TIMEOUT_MS,
  buildQuery,
  createLiveSource,
  fetchOverpass,
} from '../src/api/overpass.ts';
import { AREA_BOUNDS } from '../src/config/areas.ts';
import { loadBuildings } from '../src/api/sources.ts';
import { hang, recorder, reply } from './helpers/fake-fetch.ts';
import { answer, memoryStorage, wayElement } from './helpers/overpass.ts';

const DAY_ONE = () => new Date('2026-11-27T15:00:00Z');
const DAY_TWO = () => new Date('2026-11-28T15:00:00Z');
const good = () =>
  reply(answer([wayElement(1, { name: 'Test Hall', height: '30' }), wayElement(2)]));

const setup = (handler = good, extra = {}) => {
  const { fetchFn, calls } = recorder(handler);
  const storage = memoryStorage();
  const options = { fetchFn, storage, session: new Map(), now: DAY_ONE, ...extra };
  return { calls, storage, options };
};

describe('fetchOverpass', () => {
  it('returns parsed buildings and the day, and saves them', async () => {
    const { options, storage, calls } = setup();
    const result = await fetchOverpass('loop', options);
    expect(result).toMatchObject({
      succeeded: true,
      savedOn: '2026-11-27',
      fromCache: false,
      dropped: 0,
    });
    expect(result.succeeded && result.buildings.map((building) => building.id)).toEqual([
      'osm/way/1',
      'osm/way/2',
    ]);
    expect(calls).toHaveLength(1);
    expect([...storage.values.keys()]).toEqual(['layover:overpass:v1:loop:2026-11-27']);
  });

  it('sends only the bounding box of the area, with no credentials or referrer', async () => {
    const { options, calls } = setup();
    await fetchOverpass('evanston', options);
    const { url, init } = calls[0];
    expect(url).toBe(OVERPASS_ENDPOINT);
    expect(init.method).toBe('POST');
    expect(init.credentials).toBe('omit');
    expect(init.referrerPolicy).toBe('no-referrer');
    expect(Object.keys(init.headers).sort()).toEqual(['Accept', 'Content-Type']);
    const query = new URLSearchParams(init.body).get('data');
    expect(query).toBe(buildQuery(AREA_BOUNDS.evanston));
    const bounds = AREA_BOUNDS.evanston;
    expect(query).toContain(`(${bounds.south},${bounds.west},${bounds.north},${bounds.east})`);
    expect([...new URLSearchParams(init.body).keys()]).toEqual(['data']);
  });

  it('counts records it had to drop', async () => {
    const bad = wayElement(3);
    bad.geometry[0].lat = Number.NaN;
    const { options } = setup(() => reply(answer([wayElement(1), bad])));
    expect(await fetchOverpass('loop', options)).toMatchObject({ succeeded: true, dropped: 1 });
  });

  it('answers a repeat call in the session without asking again', async () => {
    const { options, calls } = setup();
    await fetchOverpass('loop', options);
    const again = await fetchOverpass('loop', options);
    expect(again.succeeded).toBe(true);
    expect(calls).toHaveLength(1);
  });

  it('asks for each area separately', async () => {
    const { options, calls } = setup();
    await Promise.all([fetchOverpass('loop', options), fetchOverpass('lakefront', options)]);
    expect(calls).toHaveLength(2);
  });

  it('shares one request between two calls made together', async () => {
    const { options, calls } = setup();
    await Promise.all([fetchOverpass('loop', options), fetchOverpass('loop', options)]);
    expect(calls).toHaveLength(1);
  });

  it('uses the saved answer from today after a page reload, without the network', async () => {
    const first = setup();
    await fetchOverpass('loop', first.options);
    const second = setup(good, { storage: first.storage });
    const result = await fetchOverpass('loop', second.options);
    expect(result).toMatchObject({ succeeded: true, fromCache: true, savedOn: '2026-11-27' });
    expect(second.calls).toHaveLength(0);
  });

  it('asks again the next day, because the key carries the date', async () => {
    const first = setup();
    await fetchOverpass('loop', first.options);
    const second = setup(good, { storage: first.storage, now: DAY_TWO });
    const result = await fetchOverpass('loop', second.options);
    expect(result).toMatchObject({ succeeded: true, fromCache: false, savedOn: '2026-11-28' });
    expect(second.calls).toHaveLength(1);
  });

  it('ignores a saved answer that is damaged or edited, and asks again', async () => {
    const key = 'layover:overpass:v1:loop:2026-11-27';
    const broken = [
      'not json',
      '{"savedOn":"2026-11-27"}',
      JSON.stringify({ savedOn: '2026-11-26', buildings: [] }),
    ];
    for (const text of broken) {
      const { options, calls } = setup(good, { storage: memoryStorage({ [key]: text }) });
      expect(await fetchOverpass('loop', options)).toMatchObject({
        succeeded: true,
        fromCache: false,
      });
      expect(calls).toHaveLength(1);
    }
  });

  it('drops invalid records from a saved answer', async () => {
    const key = 'layover:overpass:v1:loop:2026-11-27';
    const saved = JSON.stringify({
      savedOn: '2026-11-27',
      buildings: [{ id: 'x', footprint: 'bad' }],
    });
    const { options, calls } = setup(good, { storage: memoryStorage({ [key]: saved }) });
    expect(await fetchOverpass('loop', options)).toMatchObject({
      succeeded: true,
      fromCache: false,
    });
    expect(calls).toHaveLength(1);
  });

  it('still works when storage is missing, throws on read, or is full', async () => {
    const throwing = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('full');
      },
    };
    for (const storage of [null, throwing]) {
      const { options } = setup(good, { storage });
      expect(await fetchOverpass('loop', options)).toMatchObject({ succeeded: true });
    }
  });

  it('rejects an unknown area as invalid without a request', async () => {
    const { options, calls } = setup();
    expect(await fetchOverpass('__proto__' as never, options)).toEqual({
      succeeded: false,
      reason: 'invalid',
    });
    expect(calls).toHaveLength(0);
  });
});

describe('fetchOverpass failures', () => {
  it('reports a timeout after the limit, using the abort signal', async () => {
    const { options } = setup(hang, { timeoutMs: 20 });
    expect(await fetchOverpass('loop', options)).toEqual({ succeeded: false, reason: 'timeout' });
  });

  it('uses an 8 second limit by default', () => {
    expect(OVERPASS_TIMEOUT_MS).toBe(8000);
  });

  it('reports 429 as a rate limit with the status', async () => {
    const { options } = setup(() => reply({}, 429));
    expect(await fetchOverpass('loop', options)).toEqual({
      succeeded: false,
      reason: 'rate-limit',
      status: 429,
    });
  });

  it.each([406, 500, 502, 504])('reports %i as an http failure with the status', async (status) => {
    const { options } = setup(() => reply({}, status));
    expect(await fetchOverpass('loop', options)).toEqual({
      succeeded: false,
      reason: 'http',
      status,
    });
  });

  it('reports a network error', async () => {
    const { options } = setup(() => {
      throw new TypeError('Failed to fetch');
    });
    expect(await fetchOverpass('loop', options)).toEqual({ succeeded: false, reason: 'network' });
  });

  it('reports an empty result, and does not save it', async () => {
    const { options, storage } = setup(() => reply(answer([])));
    expect(await fetchOverpass('loop', options)).toEqual({ succeeded: false, reason: 'empty' });
    expect(storage.values.size).toBe(0);
  });

  it('reports an answer where every element is bad as empty', async () => {
    const { options } = setup(() => reply(answer([{ type: 'node', id: 1 }])));
    expect(await fetchOverpass('loop', options)).toEqual({ succeeded: false, reason: 'empty' });
  });

  it.each([
    ['malformed JSON', () => new Response('<html>busy</html>', { status: 200 })],
    ['an answer with no elements', () => reply({ version: 0.6 })],
    ['a JSON null', () => reply(null)],
  ])('reports %s as invalid', async (name, handler) => {
    const { options } = setup(handler);
    expect(await fetchOverpass('loop', options)).toEqual({ succeeded: false, reason: 'invalid' });
  });

  it('treats a runtime error remark as a failure even with some elements', async () => {
    const remark = 'runtime error: Query timed out in "query" at line 1';
    const { options, storage } = setup(() => reply(answer([wayElement(1)], { remark })));
    expect(await fetchOverpass('loop', options)).toEqual({ succeeded: false, reason: 'http' });
    expect(storage.values.size).toBe(0);
  });

  it('does not remember a failure: the next call asks again', async () => {
    let attempt = 0;
    const { options, calls } = setup(() => (++attempt === 1 ? reply({}, 502) : good()));
    expect((await fetchOverpass('loop', options)).succeeded).toBe(false);
    expect((await fetchOverpass('loop', options)).succeeded).toBe(true);
    expect(calls).toHaveLength(2);
  });
});

describe('createLiveSource', () => {
  it('fits the BuildingSource interface and loads an area', async () => {
    const { options } = setup();
    const source = createLiveSource(options);
    expect(source.id).toBe('openstreetmap');
    expect(await source.load('loop')).toMatchObject({ savedOn: '2026-11-27', fromCache: false });
  });

  it('rejects with a short reason, so the loader reports it and keeps the others', async () => {
    const { options } = setup(() => reply({}, 429));
    const merged = await loadBuildings('loop', [createLiveSource(options)]);
    expect(merged.buildings).toEqual([]);
    expect(merged.failed).toEqual([
      { id: 'openstreetmap', reason: 'OpenStreetMap is asking for fewer requests' },
    ]);
  });
});

describe('buildQuery', () => {
  it('asks for named, height-tagged and venue buildings in the box, with a server time limit', () => {
    const query = buildQuery(AREA_BOUNDS.loop);
    expect(query).toContain('[out:json][timeout:10]');
    expect(query).toContain('way["building"]["name"]');
    expect(query).toContain('way["building"]["height"]');
    expect(query).toContain('stadium|arena');
    expect(query).toContain('out tags geom');
    expect(query).toContain('41.872,-87.645,41.89,-87.62');
  });
});

/**
 * The building source list and the loader (spec 2 R12, R31 to R33). The static extract comes
 * first. A source that fails is reported and skipped, and never blocks another one. Adding a
 * source means one new module and one entry in `BUILDING_SOURCES`.
 */
import { keepValidBuildings } from '../lib/buildings.ts';
import { mergeSources } from '../lib/building-source.ts';
import type { Area, BuildingSource, MergedBuildings, SourceLoad } from '../lib/source-types.ts';
interface ExtractFile {
  header: { builtOn: string };
  buildings: unknown[];
}
const EXTRACT_IMPORTS: Record<Area, () => Promise<{ default: unknown }>> = {
  loop: () => import('../data/buildings-loop.json'),
  lakefront: () => import('../data/buildings-lakefront.json'),
  evanston: () => import('../data/buildings-evanston.json'),
};
export const staticSource: BuildingSource = {
  id: 'static',
  async load(area: Area): Promise<SourceLoad> {
    const loadExtract = EXTRACT_IMPORTS[area];
    if (!loadExtract) {
      throw new Error(`No building extract for area ${String(area)}`);
    }
    const file = (await loadExtract()).default as ExtractFile;
    return {
      buildings: keepValidBuildings(file.buildings).buildings,
      savedOn: file.header.builtOn,
      fromCache: false,
    };
  },
};
export const BUILDING_SOURCES: BuildingSource[] = [staticSource];
function reasonOf(error: unknown): string {
  return error instanceof Error && error.message ? error.message : 'Could not load';
}
/** Load every source at once, merge what arrived, and say which sources failed. */
export async function loadBuildings(
  area: Area,
  sources: BuildingSource[] = BUILDING_SOURCES,
): Promise<MergedBuildings> {
  const settled = await Promise.allSettled(sources.map(async (source) => source.load(area)));
  const lists: SourceLoad[] = [];
  const result: MergedBuildings = { buildings: [], loaded: [], failed: [] };
  for (const [index, outcome] of settled.entries()) {
    const { id } = sources[index];
    if (outcome.status === 'rejected') {
      result.failed.push({ id, reason: reasonOf(outcome.reason) });
      continue;
    }
    lists.push(outcome.value);
    result.loaded.push({ id, savedOn: outcome.value.savedOn, fromCache: outcome.value.fromCache });
  }
  result.buildings = mergeSources(lists.map((load) => load.buildings));
  return result;
}

const AREAS: Area[] = ['loop', 'lakefront', 'evanston'];
/** Load every study area and join them. A building that sits in two areas appears once. */
export async function loadAllAreas(
  sources: BuildingSource[] = BUILDING_SOURCES,
): Promise<MergedBuildings> {
  const results = await Promise.all(AREAS.map((area) => loadBuildings(area, sources)));
  const byId = new Map(
    results.flatMap(({ buildings }) => buildings).map((building) => [building.id, building]),
  );
  return {
    buildings: [...byId.values()],
    loaded: results.flatMap(({ loaded }) => loaded),
    failed: results.flatMap(({ failed }) => failed),
  };
}

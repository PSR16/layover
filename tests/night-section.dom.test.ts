// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { RADAR_ATTRIBUTION } from '../src/data/replay-nights.ts';
import { mountNightSection } from '../src/views/night-section.ts';
import { replayOptionText } from '../src/views/night-selector.ts';
import { fakeContext, fakeLoaders, settle } from './helpers/app-context.ts';

let container;

beforeEach(() => {
  document.body.innerHTML = '<section id="slot"></section>';
  container = document.querySelector('#slot');
});

async function mount(loaders = fakeLoaders()) {
  const context = fakeContext(loaders);
  const stop = mountNightSection(container, { ...context, idPrefix: 'test' });
  await settle();
  return { context, loaders, stop };
}

async function choose(context, selectId, value) {
  const select = container.querySelector(`#${selectId}`);
  select.value = value;
  select.dispatchEvent(new window.Event('change'));
  await settle();
  return context;
}

describe('night selector (R4)', () => {
  it('has a labelled night select and, for tonight, a sample migration level select under Details', async () => {
    await mount();
    expect(container.querySelector('label[for="test-select"]').textContent).toBe('Change night');
    expect(container.querySelector('label[for="test-level"]').textContent).toBe(
      'Sample migration level',
    );
    expect(container.querySelector('.details #test-level')).not.toBeNull();
    const options = [...container.querySelectorAll('#test-select option')];
    expect(options).toHaveLength(19);
    expect(options[0].textContent).toBe('Tonight (live weather)');
    expect(options[0].value).toBe('tonight');
  });

  it('describes replay nights by date and a plain word, with no counts', async () => {
    const { context } = await mount();
    for (const record of context.records) {
      expect(replayOptionText(record)).toMatch(/^\d{4}-\d{2}-\d{2}, [a-z ,]+$/);
    }
  });

  it('hides the sample level control for a replay night, where migration is not a choice', async () => {
    const { context } = await mount();
    await choose(context, 'test-select', 'radar-2018-05-01');
    expect(container.querySelector('#test-level')).toBeNull();
  });
});

describe('details control', () => {
  it('shows at most two labels outside Details and keeps the rest inside it', async () => {
    await mount();
    expect(
      container.querySelectorAll('.board > .badge, .board-title ~ .board-badges .badge'),
    ).toHaveLength(2);
    expect(container.querySelector('details > summary').textContent).toBe('Details');
    expect(container.querySelectorAll('details .badge').length).toBeGreaterThan(0);
  });
  it('stays open while the sample migration level changes', async () => {
    const { context } = await mount();
    container.querySelector('details').open = true;
    await choose(context, 'test-level', 'heavy');
    expect(container.querySelector('details').open).toBe(true);
  });
});
describe('night board (R6, R9, R27, R28)', () => {
  it('loads tonight on mount and shows a status line while it waits', async () => {
    const context = fakeContext(fakeLoaders());
    mountNightSection(container, { ...context, idPrefix: 'test' });
    expect(container.querySelector('[role="status"]').textContent).toBe('Loading weather...');
    await settle();
    expect(container.querySelector('[role="status"]')).toBeNull();
    expect(container.querySelector('.board-title').textContent).toContain('Tonight');
  });

  it('shows a replay night with its labels and the dataset credit (R36)', async () => {
    const { context, loaders } = await mount();
    await choose(context, 'test-select', 'radar-2018-05-01');
    expect(loaders.calls.replay).toEqual(['radar-2018-05-01']);
    const text = container.textContent;
    expect(text).toContain('Night of 2018-05-01');
    expect(text).toContain('Replay night, radar-derived migration');
    expect(text).toContain('Saved weather');
    expect(container.querySelector('[data-credit="chicago-dataset"]').textContent).toBe(
      RADAR_ATTRIBUTION,
    );
  });

  it('shows no dataset credit for tonight or a news night', async () => {
    const { context } = await mount();
    expect(container.querySelector('.credits')).toBeNull();
    await choose(context, 'test-select', 'news-2026-10-16');
    expect(container.textContent).toContain('Replay night, sample migration level');
    expect(container.querySelector('.credits')).toBeNull();
  });

  it('changes the board but makes no new request when only the sample level changes', async () => {
    const { context, loaders } = await mount();
    const before = container.querySelector('.board').textContent;
    await choose(context, 'test-level', 'heavy');
    expect(loaders.calls.tonight).toBe(1);
    expect(container.querySelector('.board').textContent).not.toBe(before);
    expect(container.querySelector('.board').textContent).toContain('Heavy');
    expect(container.querySelector('#test-level').value).toBe('heavy');
  });

  it('lets a newer choice win over a slower, older request', async () => {
    let releaseSlow;
    const loaders = fakeLoaders();
    const slow = new Promise((resolve) => {
      releaseSlow = resolve;
    });
    const quickReplay = loaders.loadReplayWeather;
    loaders.loadReplayWeather = async (record) =>
      record.id === 'radar-2000-10-14' ? slow : quickReplay(record);
    const { context } = await mount(loaders);
    await choose(context, 'test-select', 'radar-2000-10-14');
    await choose(context, 'test-select', 'radar-2018-05-01');
    expect(container.querySelector('.board-title').textContent).toBe('Night of 2018-05-01');
    releaseSlow({ weather: {}, source: 'saved', label: 'Saved weather', notes: [] });
    await settle();
    expect(container.querySelector('.board-title').textContent).toBe('Night of 2018-05-01');
  });

  it('shows "Weather unavailable" and what is not known when tonight fails (R29)', async () => {
    const loaders = fakeLoaders();
    loaders.loadTonightWeather = async () => ({
      night: '2026-11-26',
      weather: undefined,
      source: 'unavailable',
      label: 'Weather unavailable',
      notes: [],
    });
    await mount(loaders);
    expect(container.textContent).toContain('Weather unavailable');
    expect(container.querySelector('.board-missing').textContent).toContain('wind');
    expect(container.querySelector('.risk-word')).not.toBeNull();
  });

  it('stops listening when told to', async () => {
    const { context, stop } = await mount();
    stop();
    context.store.set({ nightId: 'radar-2018-05-01' });
    await settle();
    expect(container.querySelector('.board-title').textContent).toContain('Tonight');
  });
});

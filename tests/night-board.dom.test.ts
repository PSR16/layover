// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { renderNightBoard } from '../src/views/night-board.ts';

const HOSTILE = '<img src=x onerror="alert(1)"><script>alert(2)</script>';
const model = (overrides = {}) => ({
  title: 'Night of 2018-05-01',
  level: 'high',
  reasons: ['Heavy bird migration is expected tonight.'],
  missing: [],
  rows: [
    { label: 'Migration', value: 'Heavy' },
    { label: 'Wind', value: 'From the S at 9.0 m/s' },
  ],
  badges: [{ text: 'Sample data', tone: 'sample' }],
  usesDataset: false,
  ...overrides,
});

function render(data) {
  const container = document.createElement('div');
  renderNightBoard(container, data);
  return container;
}

describe('renderNightBoard', () => {
  it('leads with the risk word, then the reasons, the conditions and the labels (R6, R9)', () => {
    const container = render(model());
    expect(container.querySelector('h2').textContent).toBe('Night of 2018-05-01');
    expect(container.querySelector('.risk-answer').textContent).toBe('High risk');
    expect(container.querySelector('.risk-word').classList).toContain('risk-high');
    expect(container.querySelectorAll('.board-reasons li')).toHaveLength(1);
    expect(container.querySelector('.board-badges .badge').textContent).toBe('Sample data');
    const terms = [...container.querySelectorAll('.conditions dt')];
    expect(terms.map((term) => term.textContent)).toEqual(['Migration', 'Wind']);
    expect(container.querySelectorAll('.conditions dd')[1].textContent).toBe(
      'From the S at 9.0 m/s',
    );
  });
  it('uses a description list, so conditions read as labelled pairs for screen readers', () => {
    const container = render(model());
    expect(container.querySelector('dl.conditions')).not.toBeNull();
    expect(container.querySelectorAll('dt')).toHaveLength(2);
    expect(container.querySelectorAll('dd')).toHaveLength(2);
  });
  it('shows no note when nothing is missing, and a plain note when something is', () => {
    expect(render(model()).querySelector('.board-missing')).toBeNull();
    const note = render(model({ missing: ['wind', 'visibility and cloud'] })).querySelector(
      '.board-missing',
    );
    expect(note.textContent).toBe(
      'Not known tonight: wind, visibility and cloud. The level uses what is known.',
    );
  });

  it('never turns text from the data into markup (R5)', () => {
    const container = render(
      model({
        title: HOSTILE,
        reasons: [HOSTILE],
        rows: [{ label: HOSTILE, value: HOSTILE }],
        badges: [{ text: HOSTILE, tone: 'notice' }],
      }),
    );
    expect(container.querySelectorAll('img, script')).toHaveLength(0);
    expect(container.textContent).toContain(HOSTILE);
  });

  it('replaces what was in the container on each render', () => {
    const container = render(model());
    renderNightBoard(container, model({ title: 'Another night' }));
    expect(container.querySelectorAll('h2')).toHaveLength(1);
    expect(container.querySelector('h2').textContent).toBe('Another night');
  });
});

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
  it('shows the title, badges, risk word, reasons and condition rows as a board (R6, R9)', () => {
    const container = render(model());
    expect(container.querySelector('h3').textContent).toBe('Night of 2018-05-01');
    expect(container.querySelector('.badge').textContent).toBe('Sample data');
    const rows = [...container.querySelectorAll('.board-row')];
    expect(rows.map((row) => row.querySelector('dt').textContent)).toEqual([
      'Risk',
      'Why',
      'Migration',
      'Wind',
    ]);
    expect(rows[0].querySelector('dd').textContent).toBe('High');
    expect(rows[1].querySelectorAll('li')).toHaveLength(1);
    expect(rows[3].querySelector('dd').textContent).toBe('From the S at 9.0 m/s');
  });

  it('uses a description list, so the board reads as labelled pairs for screen readers', () => {
    const container = render(model());
    expect(container.querySelector('dl.board')).not.toBeNull();
    expect(container.querySelectorAll('dt')).toHaveLength(4);
    expect(container.querySelectorAll('dd')).toHaveLength(4);
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
    expect(container.querySelectorAll('h3')).toHaveLength(1);
    expect(container.querySelector('h3').textContent).toBe('Another night');
  });
});

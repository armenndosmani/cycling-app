import { describe, expect, it } from 'vitest';

import { canUndo, createHistory, record, undo, UNDO_LIMIT } from '@/planner/history';

describe('undo history', () => {
  it('undoes at least 10 steps in order', () => {
    let history = createHistory(0);
    for (let i = 1; i <= 12; i += 1) history = record(history, i);
    for (let i = 11; i >= 0; i -= 1) {
      history = undo(history);
      expect(history.present).toBe(i);
    }
    expect(canUndo(history)).toBe(false);
    expect(undo(history)).toBe(history);
  });

  it('keeps at most the limit and drops the oldest steps', () => {
    let history = createHistory(0);
    for (let i = 1; i <= UNDO_LIMIT + 5; i += 1) history = record(history, i);
    expect(history.past).toHaveLength(UNDO_LIMIT);
    expect(history.past[0]).toBe(5);
    expect(UNDO_LIMIT).toBeGreaterThanOrEqual(10);
  });

  it('ignores a change to the same state', () => {
    const state = { a: 1 };
    const history = createHistory(state);
    expect(record(history, state)).toBe(history);
  });
});

/** Undo steps kept in memory. The spec asks for at least 10. */
export const UNDO_LIMIT = 50;

/** Undo history: earlier states and the current one. Immutable. */
export type History<T> = {
  past: T[];
  present: T;
};

export function createHistory<T>(present: T): History<T> {
  return { past: [], present };
}

/** Records a new state. The oldest steps are dropped beyond the limit. */
export function record<T>(history: History<T>, next: T, limit = UNDO_LIMIT): History<T> {
  if (next === history.present) return history;
  const past = [...history.past, history.present];
  return { past: past.length > limit ? past.slice(past.length - limit) : past, present: next };
}

/** Goes back one step; unchanged when there is nothing to undo. */
export function undo<T>(history: History<T>): History<T> {
  if (history.past.length === 0) return history;
  return { past: history.past.slice(0, -1), present: history.past[history.past.length - 1] };
}

export function canUndo<T>(history: History<T>): boolean {
  return history.past.length > 0;
}

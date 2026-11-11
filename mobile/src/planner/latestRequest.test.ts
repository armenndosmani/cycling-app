import { describe, expect, it } from 'vitest';

import { LatestRequest } from '@/planner/latestRequest';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('LatestRequest', () => {
  it('returns the value of the only request', async () => {
    const latest = new LatestRequest();
    await expect(latest.run(async () => 42)).resolves.toEqual({ stale: false, value: 42 });
  });

  it('marks an older response as stale even if it arrives last', async () => {
    const latest = new LatestRequest();
    const first = deferred<string>();
    const second = deferred<string>();
    let firstSignal: AbortSignal | undefined;

    const firstRun = latest.run((signal) => {
      firstSignal = signal;
      return first.promise;
    });
    const secondRun = latest.run(() => second.promise);
    expect(firstSignal?.aborted).toBe(true);

    second.resolve('new');
    first.resolve('old');
    await expect(secondRun).resolves.toEqual({ stale: false, value: 'new' });
    await expect(firstRun).resolves.toEqual({ stale: true });
  });

  it('swallows errors of replaced requests but reports current ones', async () => {
    const latest = new LatestRequest();
    const first = deferred<string>();
    const firstRun = latest.run(() => first.promise);
    const secondRun = latest.run(async () => {
      throw new Error('current failed');
    });
    first.reject(new Error('aborted'));
    await expect(firstRun).resolves.toEqual({ stale: true });
    await expect(secondRun).rejects.toThrow('current failed');
  });

  it('cancel aborts and makes the running request stale', async () => {
    const latest = new LatestRequest();
    const pending = deferred<number>();
    let signal: AbortSignal | undefined;
    const run = latest.run((s) => {
      signal = s;
      return pending.promise;
    });
    latest.cancel();
    expect(signal?.aborted).toBe(true);
    pending.resolve(1);
    await expect(run).resolves.toEqual({ stale: true });
  });
});

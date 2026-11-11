export type LatestResult<T> = { stale: false; value: T } | { stale: true };

/**
 * Runs requests where only the newest one counts (route calculation, place search).
 * Starting a request aborts the previous one, and a response that arrives after a newer
 * request started is reported as stale, so rapid edits never leave an outdated result.
 */
export class LatestRequest {
  private sequence = 0;
  private controller: AbortController | null = null;

  async run<T>(task: (signal: AbortSignal) => Promise<T>): Promise<LatestResult<T>> {
    this.controller?.abort();
    const controller = new AbortController();
    this.controller = controller;
    this.sequence += 1;
    const sequence = this.sequence;

    try {
      const value = await task(controller.signal);
      return sequence === this.sequence ? { stale: false, value } : { stale: true };
    } catch (error) {
      // Errors of replaced or cancelled requests don't matter any more
      if (sequence !== this.sequence) return { stale: true };
      throw error;
    } finally {
      if (this.controller === controller) this.controller = null;
    }
  }

  /** Aborts the running request; its result will be stale. */
  cancel(): void {
    this.controller?.abort();
    this.controller = null;
    this.sequence += 1;
  }
}

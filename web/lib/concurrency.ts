/**
 * Simple concurrency limiter (pLimit-style).
 * No external dependencies — ~30 lines.
 *
 * Usage:
 *   const limit = createLimiter(4);
 *   const results = await Promise.all(items.map(i => limit(() => process(i))));
 */

const DEFAULT_CONCURRENCY = Number(process.env.INVOICE_BATCH_CONCURRENCY) || 4;

export function createLimiter(concurrency = DEFAULT_CONCURRENCY) {
  let active = 0;
  const queue: Array<() => void> = [];

  function next() {
    if (queue.length > 0 && active < concurrency) {
      active++;
      const resolve = queue.shift()!;
      resolve();
    }
  }

  return async function limit<T>(fn: () => Promise<T>): Promise<T> {
    // Wait for a slot
    if (active >= concurrency) {
      await new Promise<void>((resolve) => queue.push(resolve));
    } else {
      active++;
    }

    try {
      return await fn();
    } finally {
      active--;
      next();
    }
  };
}

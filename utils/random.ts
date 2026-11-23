import { AsyncLocalStorage } from 'node:async_hooks';
export function createRandom(seed: string): () => number {
  let state = 2166136261;
  for (const char of seed) state = Math.imul(state ^ char.charCodeAt(0), 16777619);
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}
const scope = new AsyncLocalStorage<() => number>();
let fallback = createRandom(process.env.TEST_SEED || 'portfolio');
export const random = () => (scope.getStore() || fallback)();
export function withRandomSeed<T>(seed: string, work: () => Promise<T>): Promise<T> {
  return scope.run(createRandom(seed), work);
}

/** Playwright runs one test at a time per worker process. */
export function setWorkerRandomSeed(seed: string): void { fallback = createRandom(seed); }

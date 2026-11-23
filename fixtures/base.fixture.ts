import { test as base, expect } from '@playwright/test';
import { setWorkerRandomSeed } from '../utils/random';
export const test = base.extend<{ replaySeed: string }>({
  replaySeed: [async ({}, use, info) => {
    const seed = `${process.env.TEST_SEED || 'portfolio'}:${info.titlePath.join(' / ')}`;
    await info.attach('scenario-seed', { body: seed, contentType: 'text/plain' });
    setWorkerRandomSeed(seed);
    await use(seed);
  }, { auto: true }],
});
export { expect };

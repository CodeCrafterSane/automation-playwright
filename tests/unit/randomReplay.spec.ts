import { test, expect } from '../../fixtures/base.fixture';
import { createRandom, random, withRandomSeed } from '../../utils/random';

test('reference fixture makes selected scenarios replayable', async ({ replaySeed }) => {
  const replay = createRandom(replaySeed);
  expect([random(), random(), random()]).toEqual([replay(), replay(), replay()]);
});

test('parallel async journeys retain separate random streams', async () => {
  const expected = (seed: string) => {
    const next = createRandom(seed);
    return [next(), next()];
  };
  const journey = (seed: string) => withRandomSeed(seed, async () => {
    const first = random();
    await Promise.resolve();
    return [first, random()];
  });
  const [purchase, refinance] = await Promise.all([journey('purchase'), journey('refinance')]);
  expect(purchase).toEqual(expected('purchase'));
  expect(refinance).toEqual(expected('refinance'));
  expect(purchase).not.toEqual(refinance);
});

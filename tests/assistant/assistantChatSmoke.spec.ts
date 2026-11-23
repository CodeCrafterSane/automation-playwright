import { test, expect } from '../../fixtures/assistant.fixture';

test.describe('Refactored Assistant chat @P1 @assistant', () => {
  test('opens from the homepage and answers a first-time buyer question', async ({ assistant }, testInfo) => {
    testInfo.setTimeout(180_000);

    await test.step('Open Assistant and verify the initial chat', () => assistant.open());
    const reply = await test.step('Send a question and verify a new assistant reply', () =>
      assistant.ask('What can you help me with as a first-time homebuyer?'),
    );
    expect(reply).toMatch(/home|buy|mortgage/i);
    await testInfo.attach('assistant-reply', { body: reply, contentType: 'text/plain' });
  });
});

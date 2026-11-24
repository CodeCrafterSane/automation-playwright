import { test, expect } from '@playwright/test';
import { buildSlackPayload, sendSlackNotification } from '../../scripts/notify-slack';

const metadata = { repository: 'portfolio/example', workflow: 'Playwright CI', scope: 'Offline CI',
  status: 'failure', runUrl: 'https://github.com/portfolio/example/actions/runs/123' };
// Deliberately fabricated segments, constructed without embedding a usable webhook.
const fixtureWebhook = new URL(['/services', 'fixture-workspace', 'fixture-channel', 'not-a-secret'].join('/'), 'https://hooks.slack.com').href;

test('notification contains run metadata rather than raw test details', () => {
  const payload = buildSlackPayload(metadata);
  expect(payload.unfurl_links).toBe(false);
  expect(payload.unfurl_media).toBe(false);
  expect(JSON.stringify(payload)).toContain(metadata.runUrl);
  expect(JSON.stringify(payload)).not.toMatch(/webhook|password|cookie|stacktrace/i);
});

test('notification rejects an unrelated run link', () => {
  expect(() => buildSlackPayload({ ...metadata, runUrl: 'https://example.com/actions/runs/123' })).toThrow();
});

test('Slack-like markup in fallback text is escaped', () => {
  const payload = buildSlackPayload({ ...metadata, workflow: '<!here> & CI' });
  expect(payload.text).toContain('&lt;!here&gt; &amp; CI');
});

test('missing webhook skips without calling the network', async () => {
  let called = false;
  const fetchImpl: typeof fetch = async () => { called = true; return new Response('ok'); };
  expect(await sendSlackNotification({ webhookUrl: '', payload: buildSlackPayload(metadata), fetchImpl })).toEqual({ skipped: true });
  expect(called).toBe(false);
});

for (const [description, webhookUrl] of [
  ['plain HTTP', fixtureWebhook.replace('https:', 'http:')],
  ['unrelated host', fixtureWebhook.replace('hooks.slack.com', 'example.com')],
  ['host suffix attack', fixtureWebhook.replace('hooks.slack.com', 'hooks.slack.com.example.com')],
  ['query string', fixtureWebhook + '?unexpected=value'],
] as const) {
  test(`notification rejects ${description} before a network call`, async () => {
    let called = false;
    const fetchImpl: typeof fetch = async () => { called = true; return new Response('ok'); };
    await expect(sendSlackNotification({ webhookUrl, payload: buildSlackPayload(metadata), fetchImpl })).rejects.toThrow('Invalid Slack webhook');
    expect(called).toBe(false);
  });
}

test('delivery uses JSON, prevents redirects and requires acknowledgment', async () => {
  const payload = buildSlackPayload(metadata);
  let captured: RequestInit | undefined;
  const fetchImpl: typeof fetch = async (_url, init) => { captured = init; return new Response('ok'); };
  expect(await sendSlackNotification({ webhookUrl: fixtureWebhook, payload, fetchImpl })).toEqual({ skipped: false });
  expect(captured?.method).toBe('POST');
  expect(captured?.redirect).toBe('error');
  expect(JSON.parse(captured?.body as string)).toEqual(payload);
  expect(captured?.signal).toBeInstanceOf(AbortSignal);
});

test('transport errors omit the webhook even if the client error includes it', async () => {
  const fetchImpl: typeof fetch = async () => { throw new Error(fixtureWebhook); };
  await expect(sendSlackNotification({ webhookUrl: fixtureWebhook, payload: buildSlackPayload(metadata), fetchImpl }))
    .rejects.toThrow('Slack delivery failed; transport details are omitted.');
});

test('HTTP failure omits the response body', async () => {
  const fetchImpl: typeof fetch = async () => new Response('sensitive response detail', { status: 403 });
  await expect(sendSlackNotification({ webhookUrl: fixtureWebhook, payload: buildSlackPayload(metadata), fetchImpl }))
    .rejects.toThrow('Slack delivery returned HTTP 403.');
});

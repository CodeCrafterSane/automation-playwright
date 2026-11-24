function escapeText(value) {
  return String(value).slice(0, 150).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function buildSlackPayload({ repository, workflow, scope, status, runUrl }) {
  if (!['success', 'failure', 'cancelled'].includes(status)) throw new Error('Unsupported workflow result.');
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository)) throw new Error('Invalid public repository name.');
  const expected = `https://github.com/${repository}/actions/runs/`;
  if (!runUrl.startsWith(expected) || !/^\d+$/.test(runUrl.slice(expected.length)))
    throw new Error('Use a GitHub run URL for this repository.');
  const fields = { Workflow: workflow, Scope: scope, Repository: repository, Result: status };
  return {
    text: `${escapeText(workflow)}: ${status} — ${escapeText(repository)}`,
    unfurl_links: false,
    unfurl_media: false,
    blocks: [
      { type: 'header', text: { type: 'plain_text', text: `Playwright ${status}`, emoji: false } },
      { type: 'section', fields: Object.entries(fields).map(([name, value]) => ({
        type: 'plain_text', text: `${name}: ${String(value).slice(0, 150)}`, emoji: false,
      })) },
      { type: 'actions', elements: [{ type: 'button', text: { type: 'plain_text', text: 'View GitHub run' }, url: runUrl }] },
    ],
  };
}

async function sendSlackNotification({ webhookUrl, payload, fetchImpl = globalThis.fetch }) {
  if (!webhookUrl) return { skipped: true };
  let url;
  try { url = new URL(webhookUrl); } catch { throw new Error('Invalid Slack webhook configuration.'); }
  if (url.protocol !== 'https:' || !['hooks.slack.com', 'hooks.slack-gov.com'].includes(url.hostname) ||
      url.port || url.username || url.password || url.search || url.hash ||
      !/^\/services\/[^/]+\/[^/]+\/[^/]+$/.test(url.pathname))
    throw new Error('Invalid Slack webhook configuration.');
  let response;
  try {
    response = await fetchImpl(url.href, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload), redirect: 'error', signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new Error('Slack delivery failed; transport details are omitted.');
  }
  if (!response.ok) throw new Error(`Slack delivery returned HTTP ${response.status}.`);
  if ((await response.text()).trim() !== 'ok') throw new Error('Slack did not acknowledge delivery.');
  return { skipped: false };
}

async function main() {
  if (!process.env.SLACK_WEBHOOK_URL) {
    console.log('Slack webhook is not configured; notification skipped.');
    return;
  }
  const repository = process.env.GITHUB_REPOSITORY;
  const payload = buildSlackPayload({ repository, workflow: process.env.GITHUB_WORKFLOW,
    scope: process.env.SLACK_SCOPE, status: process.env.SLACK_STATUS,
    runUrl: `https://github.com/${repository}/actions/runs/${process.env.GITHUB_RUN_ID}` });
  await sendSlackNotification({ webhookUrl: process.env.SLACK_WEBHOOK_URL, payload });
  console.log('Slack notification delivered.');
}
if (require.main === module) main().catch(() => {
  console.error('Slack notification failed. Webhook and response details are omitted.');
  process.exitCode = 1;
});
module.exports = { buildSlackPayload, sendSlackNotification };

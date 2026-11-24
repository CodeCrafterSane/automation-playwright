import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { renderWorkflows, syncWorkflows } from '../../scripts/generate-workflows';

const registry = () => JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../config/workflows.json'), 'utf8'));

test('checked-in workflows match the generator source of truth', () => {
  const changes = syncWorkflows(path.resolve(__dirname, '../../.github/workflows'), true);
  expect(changes).toEqual([]);
});

test('changing the registry updates both shard strategy and invocation', () => {
  const config = registry();
  config.shards = 3;
  const workflow = renderWorkflows(config).get('unit-tests.yml')!;
  expect(workflow).toContain('shard: [1,2,3]');
  expect(workflow).toContain('--shard="$SHARD/3"');
});

for (const [name, change] of [
  ['unpinned external action', (config: any) => { config.actions.checkout.ref = 'actions/checkout@main'; }],
  ['directory traversal', (config: any) => { config.workflows[0].file = '../unsafe.yml'; }],
  ['duplicate filename', (config: any) => { config.workflows.push(config.workflows[0]); }],
  ['empty Node matrix', (config: any) => { config.nodeVersions = []; }],
  ['empty shard', (config: any) => { config.shards = 0; }],
] as const) {
  test(`generator rejects ${name}`, () => {
    const config = registry();
    change(config);
    expect(() => renderWorkflows(config)).toThrow();
  });
}

test('drift detection is read-only and cleanup preserves handwritten workflows', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'portfolio-workflows-'));
  try {
    const expected = renderWorkflows();
    syncWorkflows(directory, false, expected);
    const original = fs.readFileSync(path.join(directory, 'checks.yml'), 'utf8');
    fs.writeFileSync(path.join(directory, 'checks.yml'), original + '# unexpected drift\n');
    expect(syncWorkflows(directory, true, expected)).toContain('checks.yml');
    expect(fs.readFileSync(path.join(directory, 'checks.yml'), 'utf8')).toContain('unexpected drift');
    fs.writeFileSync(path.join(directory, 'stale-generated.yml'), original);
    fs.writeFileSync(path.join(directory, 'handwritten.yml'), 'name: Keep this workflow\n');
    syncWorkflows(directory, false, expected);
    expect(fs.existsSync(path.join(directory, 'stale-generated.yml'))).toBe(false);
    expect(fs.readFileSync(path.join(directory, 'handwritten.yml'), 'utf8')).toBe('name: Keep this workflow\n');
    expect(syncWorkflows(directory, true, expected)).toEqual([]);
    const outside = path.join(directory, 'unrelated.txt');
    fs.writeFileSync(outside, 'Preserve unrelated content');
    fs.unlinkSync(path.join(directory, 'checks.yml'));
    fs.symlinkSync(outside, path.join(directory, 'checks.yml'));
    expect(() => syncWorkflows(directory, false, expected)).toThrow('regular files');
    expect(fs.readFileSync(outside, 'utf8')).toBe('Preserve unrelated content');
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

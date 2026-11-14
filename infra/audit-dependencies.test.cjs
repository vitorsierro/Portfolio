const test = require('node:test');
const assert = require('node:assert/strict');
const { inventory, audit } = require('./audit-dependencies.cjs');
const lock = `# yarn lockfile v1\n\nminimatch@^10.2.2, minimatch@11.0.8:\n  version "11.0.8"\n\n"@scope/example@^2":\n  version "2.0.1"\n`;

test('audita a versão resolvida do override, não a faixa antiga', async () => {
  assert.deepEqual(inventory(lock), { minimatch: ['11.0.8'], '@scope/example': ['2.0.1'] });
  const result = await audit(lock, async (_, options) => {
    assert.deepEqual(JSON.parse(options.body).minimatch, ['11.0.8']);
    return { ok: true, json: async () => ({}) };
  });
  assert.equal(result.advisories.length, 0);
});

test('não oculta avisos moderados nem falhas do registro', async () => {
  const result = await audit(lock, async () => ({ ok: true, json: async () => ({ minimatch: [{ severity: 'moderate', url: 'https://example.test/advisory', vulnerable_versions: '<12' }] }) }));
  assert.equal(result.counts.moderate, 1);
  await assert.rejects(audit(lock, async () => ({ ok: false, status: 503 })), /503/);
  await assert.rejects(audit(lock, async () => ({ ok: true, json: async () => null })), /inválida/);
});

const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const lockfile = require('@yarnpkg/lockfile');
const exceptions = require('./security-exceptions.json');

function inventory(text) {
  const parsed = lockfile.parse(text);
  if (parsed.type !== 'success') throw Error('Lockfile inválido ou com conflito');
  const packages = new Map();
  for (const [selector, entry] of Object.entries(parsed.object)) {
    const name = selector.slice(0, selector.lastIndexOf('@'));
    if (!name || !entry.version || selector.includes('npm:')) throw Error(`Dependência não suportada: ${selector}`);
    if (!packages.has(name)) packages.set(name, new Set());
    packages.get(name).add(entry.version);
  }
  if (!packages.size) throw Error('Inventário vazio');
  return Object.fromEntries([...packages].map(([name, versions]) => [name, [...versions]]));
}

async function audit(text, request = fetch) {
  const packages = inventory(text);
  // Endpoint oficial do npm audit, com as versões realmente resolvidas.
  // O audit do Yarn Classic ignora overrides fora da faixa do pacote pai.
  const response = await request('https://registry.npmjs.org/-/npm/v1/security/advisories/bulk', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(packages), signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw Error(`Registro de segurança respondeu HTTP ${response.status}`);
  const result = await response.json();
  if (!result || typeof result !== 'object' || Array.isArray(result)) throw Error('Resposta de auditoria inválida');
  const counts = { info: 0, low: 0, moderate: 0, high: 0, critical: 0 };
  const advisories = [];
  for (const [name, items] of Object.entries(result)) {
    if (!packages[name] || !Array.isArray(items)) throw Error('Resposta de auditoria inconsistente');
    for (const item of items) {
      if (!Object.hasOwn(counts, item.severity) || !item.url || !item.vulnerable_versions) throw Error('Aviso de segurança inválido');
      counts[item.severity]++;
      const exception = exceptions.find((entry) => entry.package === name && item.severity === 'low' &&
        item.url.endsWith(`/${entry.advisory}`) && Date.now() < Date.parse(`${entry.expires}T00:00:00Z`) &&
        packages[name].every((version) => entry.versions.includes(version)));
      advisories.push({ ...item, package: name, exception });
    }
  }
  return { counts, advisories, packages: Object.keys(packages).length };
}

if (require.main === module) {
  audit(readFileSync(resolve(__dirname, '../yarn.lock'), 'utf8')).then((result) => {
    for (const item of result.advisories) console.log(`${item.severity}: ${item.package} — ${item.url}${item.exception ? ` — exceção temporária até ${item.exception.expires}: ${item.exception.reason}` : ''}`);
    console.log(JSON.stringify({ vulnerabilities: result.counts, packages: result.packages }));
    process.exitCode = result.advisories.some((item) => !item.exception) ? 1 : 0;
  }).catch((error) => { console.error(error.message); process.exitCode = 1; });
}

module.exports = { inventory, audit };

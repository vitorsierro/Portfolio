const { spawnSync } = require('node:child_process');

const result = spawnSync(process.platform === 'win32' ? 'yarn.cmd' : 'yarn', ['audit', '--json'], {
  encoding: 'utf8',
  shell: process.platform === 'win32',
});
let summary;
for (const line of (result.stdout || '').split('\n').filter(Boolean)) {
  const entry = JSON.parse(line);
  if (entry.type === 'auditAdvisory') {
    console.log(`${entry.data.advisory.severity}: ${entry.data.advisory.module_name} — ${entry.data.advisory.url}`);
  }
  if (entry.type === 'auditSummary') summary = entry.data;
}
if (result.error || !summary) {
  console.error(result.error || result.stderr || 'Auditoria não retornou resultado válido');
  process.exit(1);
}
console.log(JSON.stringify(summary));
process.exit(summary.vulnerabilities.high || summary.vulnerabilities.critical ? 1 : 0);

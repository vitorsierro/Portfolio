#!/usr/bin/env python3
"""Exporta somente metadados públicos da operação para a API, sem credenciais."""
import datetime as dt
import json
from pathlib import Path
import re
import subprocess
import urllib.request


def run(*args):
    return subprocess.check_output(args, text=True, stderr=subprocess.DEVNULL, timeout=12).strip()


def api(config, path):
    request = urllib.request.Request(config['url'] + '/api/v1/' + path,
        headers={'Authorization': 'Bearer ' + config['token'], 'Accept': 'application/json'})
    with urllib.request.urlopen(request, timeout=8) as response:
        return json.load(response)


def date(value):
    try:
        return dt.datetime.strptime(value, '%a %Y-%m-%d %H:%M:%S %Z').replace(tzinfo=dt.timezone.utc).isoformat()
    except ValueError:
        return None


def version(container, command):
    try:
        output = run('docker', 'exec', container, command, '--version')
        match = re.search(r'\bv?(\d+\.\d+\.\d+)\b', output)
        return match[1] if match else None
    except subprocess.SubprocessError:
        return None


def enabled():
    result = subprocess.run(['systemctl', 'is-enabled', 'portfolio-stable-updates.timer'],
        capture_output=True, text=True, timeout=5)
    return result.stdout.strip() == 'enabled'


def deployments(history):
    return [{
        'commit': d.get('commit'), 'status': d.get('status'),
        'createdAt': d.get('created_at'), 'finishedAt': d.get('finished_at'),
    } for d in history.get('deployments', [])[:8]]


def collect(config):
    ids = run('docker', 'ps', '-aq', '--filter', 'label=coolify.applicationUuid=' + config['uuid']).split()
    containers = json.loads(run('docker', 'inspect', *ids)) if ids else []
    stats = {}
    if ids:
        try:
            for line in run('docker', 'stats', '--no-stream', '--format', '{{json .}}', *ids).splitlines():
                item = json.loads(line)
                stats[item['Name']] = item
        except (subprocess.SubprocessError, ValueError):
            pass
    services = []
    for c in containers:
        state = c['State']
        name = c['Config']['Labels'].get('com.docker.compose.service', c['Name'].lstrip('/'))
        metric = stats.get(c['Name'].lstrip('/'), {})
        services.append({'name': name, 'state': state['Status'],
            'health': state.get('Health', {}).get('Status'), 'startedAt': state.get('StartedAt'),
            'restarts': c.get('RestartCount', 0), 'cpu': metric.get('CPUPerc'), 'memory': metric.get('MemUsage')})
    result = {'collectedAt': dt.datetime.now(dt.timezone.utc).isoformat(),
        'services': sorted(services, key=lambda s: s['name']), 'coolifyAvailable': False,
        'application': 'VPS - serviços', 'status': None, 'deployments': []}
    try:
        app = api(config, 'applications/' + config['uuid'])
        history = api(config, 'deployments/applications/' + config['uuid'])
        result.update({'coolifyAvailable': True, 'application': app.get('name'),
            'status': app.get('status'), 'deployments': deployments(history)})
    except (OSError, ValueError):
        pass
    result['updates'] = {
        'enabled': enabled(),
        'result': run('systemctl', 'show', 'portfolio-stable-updates.service', '-p', 'Result', '--value'),
        'lastCheck': date(run('systemctl', 'show', 'portfolio-stable-updates.service', '-p', 'ExecMainExitTimestamp', '--value')),
        'nextCheck': date(run('systemctl', 'show', 'portfolio-stable-updates.timer', '-p', 'NextElapseUSecRealtime', '--value')),
        'hermesVersion': version('infra-hermes-1', 'hermes'),
        'memoryVersion': version('ai-memory', 'ai-memory'),
    }
    return result


def main():
    config = json.loads(Path('/home/deploy/.config/portfolio-coolify.json').read_text())
    result = collect(config)
    directory = Path('/var/lib/portfolio-status')
    directory.mkdir(mode=0o755, exist_ok=True)
    directory.chmod(0o755)
    temporary = directory / 'coolify.json.partial'
    temporary.write_text(json.dumps(result))
    temporary.chmod(0o644)
    temporary.replace(directory / 'coolify.json')


if __name__ == '__main__':
    main()

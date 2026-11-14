#!/usr/bin/env python3
"""Publica pelo Coolify local e só retorna sucesso após o deploy terminar."""
import json
import os
from pathlib import Path
import subprocess
import sys
import time
import urllib.request

CONFIG = Path(os.environ.get('PORTFOLIO_COOLIFY_CONFIG', '/home/deploy/.config/portfolio-coolify.json'))

def request(config, path, method='GET'):
    req = urllib.request.Request(config['url'].rstrip('/') + '/api/v1/' + path,
        method=method, headers={'Authorization': 'Bearer ' + config['token'], 'Accept': 'application/json'})
    with urllib.request.urlopen(req, timeout=60) as response:
        return json.load(response)

def deploy(config):
    result = request(config, 'deploy?uuid=' + config['uuid'] + '&force=true', 'POST')
    entries = result.get('deployments', [])
    if not entries or not entries[0].get('deployment_uuid'):
        raise RuntimeError('Coolify não retornou um identificador de deploy')
    deployment = entries[0]['deployment_uuid']
    print('Coolify deploy: ' + deployment, flush=True)
    previous = None
    for _ in range(300):
        result = request(config, 'deployments/' + deployment)
        status = result.get('status')
        if status != previous:
            print('Estado: ' + str(status), flush=True)
            previous = status
        if status == 'finished':
            return deployment
        if status in ('failed', 'cancelled', 'canceled'):
            raise RuntimeError('Deploy recusado ou malsucedido. Consulte o log no Coolify: ' + deployment)
        time.sleep(5)
    raise TimeoutError('Coolify não terminou o deploy em 25 minutos: ' + deployment)

if __name__ == '__main__':
    try:
        config = json.loads(CONFIG.read_text())
        # A cópia consistente do SQLite vem antes de qualquer migration.
        repo = Path(__file__).resolve().parents[2]
        subprocess.run(['bash', str(repo / 'infra/backup-db.sh')], check=True)
        deploy(config)
    except Exception as error:
        # Não imprimir respostas HTTP, cabeçalhos ou valores do ambiente.
        print('Falha ao publicar pelo Coolify: ' + str(error), file=sys.stderr)
        sys.exit(1)
#!/usr/bin/env python3
"""Contrato dos recursos persistentes e contextos de build na migração Coolify."""
import json
import os
from pathlib import Path
import subprocess

repo=Path(__file__).resolve().parents[2]
env={**os.environ,'COOLIFY_RESOURCE_UUID':'validation-resource','COOLIFY_REPO_DIR':str(repo)}
config=json.loads(subprocess.check_output(['docker','compose','-f',str(repo/'docker-compose.coolify.yml'),'config','--format','json'],env=env,stderr=subprocess.DEVNULL))
services=config['services']
assert config['name']=='infra'
assert set(services)=={'api','hermes','hermes-proxy','tool-sockets','nginx','certbot','excalidraw','excalidraw-room','ai-memory'}
for name in ['hermes','hermes-proxy','tool-sockets','excalidraw','excalidraw-room']:
    context=Path(services[name]['build']['context']).resolve()
    assert context==repo/'infra'/name,(name,context)
    assert (context/'Dockerfile').is_file()
for name in ['api','hermes-proxy','tool-sockets','excalidraw','excalidraw-room']:
    assert services[name]['image']=='infra-'+name
for name in ['api_data','hermes_data','certbot_conf','certbot_www']:
    assert config['volumes'][name]['external'] is True
    assert config['volumes'][name]['name']=='infra_'+name
assert set(services['hermes']['networks'])=={'hermes'}
assert set(services['api']['networks'])=={'backend','memory'}
assert set(services['ai-memory']['networks'])=={'memory'}
assert services['hermes-proxy']['network_mode']=='service:hermes'
assert services['ai-memory']['container_name']=='ai-memory'
for name,service in services.items():
    assert service['labels']['coolify.applicationUuid']=='validation-resource',name
    if name not in ['nginx','ai-memory']: assert not service.get('ports'),name
print('Compose validado: contextos, imagens, volumes persistentes e redes isoladas')
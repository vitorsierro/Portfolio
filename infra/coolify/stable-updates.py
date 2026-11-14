#!/usr/bin/env python3
"""Atualizações estáveis do Hermes/ai-memory, com cópia e validação antes do deploy."""
import argparse
import fcntl
import importlib.util
import json
from pathlib import Path
import re
import shutil
import subprocess
import time
import urllib.request

ROOT = Path('/var/backups/portfolio')
CONFIG = Path('/root/coolify-migration/updater.json')
HERMES_DATA = Path('/var/lib/docker/volumes/infra_hermes_data/_data')
MEMORY_DATA = Path('/var/opt/docker/utils/ai-memory/data')

def run(*args):
    return subprocess.check_output(args, text=True, stderr=subprocess.DEVNULL).strip()

def api(config, path, data=None, method=None):
    req = urllib.request.Request(config['url'] + '/api/v1/' + path,
        data=None if data is None else json.dumps(data).encode(), method=method,
        headers={'Authorization':'Bearer '+config['token'], 'Accept':'application/json', 'Content-Type':'application/json'})
    with urllib.request.urlopen(req, timeout=60) as response:
        return json.load(response)

def stable(repo):
    req=urllib.request.Request('https://api.github.com/repos/'+repo+'/releases/latest', headers={'User-Agent':'portfolio-stable-updater','Accept':'application/vnd.github+json'})
    with urllib.request.urlopen(req,timeout=30) as response:
        release=json.load(response)
    version=release['tag_name'].removeprefix('v')
    if release.get('prerelease') or release.get('draft') or not re.fullmatch(r'\d+\.\d+\.\d+',version):
        raise ValueError('Canal sem versão estável válida: '+repo)
    return version

def candidate(image, version):
    run('docker','pull',image)
    digest=json.loads(run('docker','image','inspect',image))[0]['RepoDigests'][0]
    entry='hermes' if image.startswith('nousresearch/') else 'ai-memory'
    output=run('docker','run','--rm','--network','none','--entrypoint',entry,digest,'--version')
    if not re.search(r'(?<!\d)v?'+re.escape(version)+r'(?![\d.])',output):
        raise RuntimeError('A imagem publicada ainda não corresponde à release: '+image)
    return digest

def snapshot(name, container, source, restart=True):
    stamp=time.strftime('%Y%m%d-%H%M%S')
    target=ROOT/(name+'-auto-'+stamp+'.tar.gz')
    partial=Path(str(target)+'.partial')
    running=run('docker','inspect',container,'--format','{{.State.Running}}')=='true'
    if running: run('docker','stop','-t','30',container)
    try:
        subprocess.run(['tar','-I','gzip -1','-cf',str(partial),'-C',str(source),'.'],check=True)
        partial.chmod(0o600)
        partial.rename(target)
    finally:
        if running and restart: run('docker','start',container)
    return target

def restore(source, backup, container):
    if source not in (HERMES_DATA,MEMORY_DATA) or source.resolve()!=source:
        raise RuntimeError('Destino de restauração fora dos diretórios autorizados')
    # Preservar o estado que falhou antes de restaurar o snapshot anterior.
    run('docker','stop','-t','30',container)
    failed=ROOT/(container+'-failed-'+time.strftime('%Y%m%d-%H%M%S')+'.tar.gz')
    subprocess.run(['tar','-I','gzip -1','-cf',str(failed),'-C',str(source),'.'],check=True)
    if source not in (HERMES_DATA,MEMORY_DATA) or source.resolve()!=source:
        raise RuntimeError('Destino de restauração fora dos diretórios autorizados')
    for child in source.iterdir():
        if child.is_dir() and not child.is_symlink(): shutil.rmtree(child)
        else: child.unlink()
    subprocess.run(['tar','-xzf',str(backup),'-C',str(source)],check=True)

def validate_memory(image, backup):
    temp=ROOT/('memory-validation-'+time.strftime('%Y%m%d-%H%M%S'))
    temp.mkdir(mode=0o700)
    name='portfolio-memory-update-check'
    try:
        subprocess.run(['tar','-xzf',str(backup),'-C',str(temp)],check=True)
        run('docker','run','-d','--name',name,'--network','none','--memory','1g','--pids-limit','128','--cap-drop','ALL','--security-opt','no-new-privileges','--env-file','/opt/portfolio/infra/ai-memory.env','-v',str(temp)+':/data',image,'serve','--transport','http','--bind','0.0.0.0:49374','--enable-web')
        for _ in range(30):
            state=json.loads(run('docker','inspect',name))[0]['State']
            if state.get('Health',{}).get('Status')=='healthy':
                run('docker','exec',name,'ai-memory','status')
                return
            if not state['Running']: break
            time.sleep(3)
        raise RuntimeError('A versão nova do ai-memory falhou sobre a cópia dos dados')
    finally:
        subprocess.run(['docker','rm','-f',name],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
        if temp.parent.resolve()==ROOT.resolve() and temp.name.startswith('memory-validation-'):
            shutil.rmtree(temp)

def update_env(config, values):
    data=[{'key':key,'value':value,'is_literal':True,'is_runtime':True,'is_buildtime':True} for key,value in values.items()]
    api(config,'applications/'+config['uuid']+'/envs/bulk',{'data':data},'PATCH')

def healthy():
    for _ in range(30):
        try:
            run('docker','exec','infra-api-1','node','-e',"fetch('http://127.0.0.1:3001/portfolio').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))")
            run('docker','exec','infra-hermes-1','/opt/hermes/.venv/bin/python','-c',"import urllib.request; assert urllib.request.urlopen('http://127.0.0.1:9119/').status==200")
            run('docker','exec','ai-memory','ai-memory','status')
            run('curl','-fsS','--max-time','10','https://api.vitorsierro.com/portfolio')
            return
        except subprocess.CalledProcessError:
            time.sleep(3)
    raise RuntimeError('Os serviços não passaram pela verificação de saúde')

def main(check=False):
    config=json.loads(CONFIG.read_text())
    uuid=config['uuid']
    hv,mv=stable('NousResearch/hermes-agent'),stable('akitaonrails/ai-memory')
    targets={'HERMES_BASE_IMAGE':candidate('nousresearch/hermes-agent:stable',hv),'AI_MEMORY_IMAGE':candidate('akitaonrails/ai-memory:latest',mv)}
    envs=api(config,'applications/'+uuid+'/envs')
    old={entry['key']:entry.get('value','') for entry in envs if not entry.get('is_preview')}
    changed={key:value for key,value in targets.items() if old.get(key)!=value}
    print('Hermes estável '+hv+'; ai-memory estável '+mv+'; imagens diferentes: '+str(len(changed)),flush=True)
    if check or not changed: return
    # Só reconstruir código do último deploy bem sucedido, sem antecipar commits em CI.
    history=api(config,'deployments/applications/'+uuid)
    history=history.get('deployments',[]) if isinstance(history,dict) else history
    previous=next((d for d in history if d.get('status')=='finished' and re.fullmatch(r'[0-9a-f]{40}',d.get('commit',''))),None)
    if not previous: raise RuntimeError('Nenhum commit validado disponível para atualização')
    backups={}
    if 'AI_MEMORY_IMAGE' in changed:
        backups['memory']=snapshot('ai-memory','ai-memory',MEMORY_DATA)
        validate_memory(targets['AI_MEMORY_IMAGE'],backups['memory'])
    if 'HERMES_BASE_IMAGE' in changed:
        run('docker','stop','infra-hermes-proxy-1')
        try: backups['hermes']=snapshot('hermes','infra-hermes-1',HERMES_DATA)
        finally: run('docker','start','infra-hermes-proxy-1')
    subprocess.run(['bash','/opt/portfolio/infra/backup-db.sh'],check=True)
    app_path='applications/'+uuid
    original_ref=api(config,app_path).get('git_commit_sha') or 'HEAD'
    api(config,app_path,{'git_commit_sha':previous['commit']},'PATCH')
    module_path=Path(__file__).with_name('deploy.py')
    spec=importlib.util.spec_from_file_location('coolify_deploy',module_path)
    bridge=importlib.util.module_from_spec(spec);spec.loader.exec_module(bridge)
    try:
        update_env(config,targets)
        try:
            bridge.deploy(config)
            healthy()
        except Exception:
            print('Atualização falhou. Restaurando imagens e dados anteriores.',flush=True)
            if 'memory' in backups: restore(MEMORY_DATA,backups['memory'],'ai-memory')
            if 'hermes' in backups:
                run('docker','stop','infra-hermes-proxy-1')
                restore(HERMES_DATA,backups['hermes'],'infra-hermes-1')
            update_env(config,{key:old[key] for key in targets})
            bridge.deploy(config)
            healthy()
            raise
        print('Atualização validada pelo Coolify.',flush=True)
        for name,keep in [('hermes-auto-',2),('ai-memory-auto-',7)]:
            for path in sorted(ROOT.glob(name+'*.tar.gz'),reverse=True)[keep:]: path.unlink()
    finally:
        api(config,app_path,{'git_commit_sha':original_ref},'PATCH')

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--check',action='store_true');args=parser.parse_args()
    with open('/home/deploy/.portfolio-deploy.lock','a') as lock:
        fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        main(args.check)
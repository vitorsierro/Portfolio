# Operação pelo Coolify

Os nove serviços da VPS estão na aplicação **VPS - servicos**, projeto **VPS Portfolio**. O site continua na Vercel. O Compose raw conserva os volumes `infra_api_data`, `infra_hermes_data`, os certificados e os diretórios do ai-memory. Não executar `down -v` nem iniciar o Compose legado em paralelo.

O painel está restrito ao loopback. Neste computador:

```powershell
ssh -N -L 8000:127.0.0.1:8000 portfolio-admin-security
```

Abrir http://127.0.0.1:8000. As credenciais foram entregues em arquivo privado, fora do Git. Cadastro público desativado. A administração usa chave separada da chave restrita do CI.

## Deploy e atualizações

O GitHub Actions valida o código e chama o comando SSH restrito. `infra/deploy.sh` delega ao Coolify quando `/home/deploy/.config/portfolio-coolify.json` existe. O token permite leitura e deploy somente desta aplicação. O sucesso exige os nove containers saudáveis e teste real de autenticação, refresh, isolamento de sessões e revogação dos WebSockets.

`portfolio-stable-updates.timer` verifica diariamente as releases estáveis oficiais e as imagens `hermes-agent:stable` e `ai-memory:latest`. Exige que a versão do binário corresponda à release, fixa o digest selecionado no Coolify e usa o commit do último deploy bem sucedido. Prereleases e imagens ainda não publicadas ficam para a próxima execução. Não substitui as verificações da CI por uma atualização de código sem testes.

Antes de mudar imagens, cria snapshots dos dados. O ai-memory é testado sobre uma cópia isolada dos dados, sem rede. A atualização passa pelo Coolify e por verificações de saúde. Em falha, tenta restaurar as imagens e os dados anteriores, preservando o estado que falhou para diagnóstico. Há uma breve indisponibilidade durante snapshots consistentes e recriação dos containers. Logs e falhas ficam no Coolify e no journal; falhas de rollback exigem intervenção administrativa.

```bash
systemctl status portfolio-stable-updates.service
journalctl -u portfolio-stable-updates.service -n 100
python3 /opt/portfolio/infra/coolify/stable-updates.py --check
```

O timer roda às 04h de Brasília, com atraso aleatório de até 15 minutos. Compartilha o lock dos deploys do CI. Mantém dois snapshots automáticos do Hermes e sete do ai-memory. O backup diário do painel roda às 03h, retém 14 dias e precede a atualização automática do próprio Coolify, programada para 05h. Sem mudança no digest dos agentes, a rotina não reinicia os serviços. Imagens auxiliares recebem atualizações de base durante os builds de deploy.

## Restauração e limites

Backups do painel e Postgres: `/var/backups/portfolio/coolify`. Snapshots da API, Hermes e ai-memory: `/var/backups/portfolio`. São arquivos sensíveis, com acesso restrito. Uma cópia do snapshot anterior à migração foi transferida para o computador do administrador. O backup remoto recorrente depende de configurar um destino externo; cópias no disco da VPS não cobrem perda da máquina.

O painel não ocupa 80/443: o proxy do servidor Coolify usa **Custom / None** e nginx continua responsável por TLS e pelo login único. Publicar o painel em um domínio exige configurar DNS e TLS. O endereço legado do ai-memory na porta 49374 foi preservado para não interromper os clientes existentes; ele mantém bearer token, mas a troca dos clientes para HTTPS/túnel e o fechamento da porta pública ainda precisam ser coordenados.

As operações limitadas `portfolio-ops hermes status`, `logs`, `discord`, `restart` e `gateway-restart` continuam disponíveis pela chave de deploy. Nunca restaurar uma imagem antiga do ai-memory sobre dados já migrados sem restaurar também o snapshot correspondente.
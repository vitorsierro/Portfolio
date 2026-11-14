# Operação de segurança

O ai-memory está fora desta alteração: container, publicação de porta e integração não foram modificados.

As imagens locais de Excalidraw e colaboração preservam os assets/código publicados, mas usam nginx e Node suportados. O sidecar instala socat no build e roda sem root. O Hermes usa base oficial por digest, com correções Python pontuais; seu init s6 precisa ser PID 1 e abandona root antes de executar o gateway. Não adicionar `init: true` ao Hermes.

A API passa a executar como `node`. O deploy corrige a propriedade do volume antes de iniciá-la. O banco e o volume do Hermes recebem backup antes de serem alterados; o snapshot do Hermes pausa e retoma seus serviços para evitar cópia inconsistente. Ele só é repetido quando a imagem do Hermes muda, retém as duas cópias completas mais recentes e publica o arquivo final apenas após concluir a gravação.

O logout invalida também access tokens ainda não expirados. Tokens antigos sem identificador de sessão serão rejeitados; o frontend pode renovar pelo refresh cookie. O login é limitado por IP e por conta no processo da API, independentemente da grafia da rota. Se houver múltiplas réplicas, migrar o estado de limitação para armazenamento compartilhado. O proxy confiável da API é um único hop (nginx); não publicar a porta da API diretamente.

O dashboard do Hermes aceita requisições de navegador apenas com a origem pública esperada antes de adaptar o header ao upstream. Upgrades do Hermes e da colaboração passam pelo serviço `tool-sockets`: ele autentica o cookie e acompanha um stream privado da API. Logout fecha imediatamente os canais daquela sessão, inclusive quando há tráfego. Expiração ou revogação direta no banco é verificada a cada 500 ms; perder o stream/heartbeat fecha o canal. Rotacionar o cookie de refresh não derruba sockets da sessão estável. A API atual tem uma réplica; múltiplas réplicas exigirão um barramento compartilhado de revogação além da consulta ao banco.

`node infra/audit-dependencies.cjs` consulta o endpoint oficial de advisories do npm com as versões resolvidas do lockfile e falha se a consulta não completar ou houver aviso sem exceção explícita. Isso evita o falso resultado do audit do Yarn Classic, que ignora overrides fora da faixa original. MinMatch/Glob/Deepmerge-ts receberam versões corrigidas, com lint/build/testes de compatibilidade. Resta um aviso baixo de `deepmerge 4.3.1`, sem versão corrigida: usado apenas pelas ferramentas de teste/build e excluído da imagem de produção. A exceção é visível, específica e expira em 14/12/2026 (`security-exceptions.json`).

O grupo Docker continua concedendo poder equivalente a root. A chave do CI tem `restrict` e comando forçado root-owned: aceita publicar o SHA atual da main e a interface operacional limitada abaixo, sem shell, PTY ou encaminhamento. Ela foi removida das chaves de root; o acesso administrativo usa chave separada, verificada antes da restrição. O fingerprint SSH está fixado no workflow. Não substituir o comando forçado por um arquivo gravável por deploy.

Operações autorizadas com a chave de deploy: `portfolio-ops hermes status`, `logs 200` (1 a 1000 linhas), `discord`, `gateway-restart` (somente gateway s6) e `restart` (Hermes e seu proxy). O diagnóstico mostra configuração não secreta e presença de credenciais; não imprime tokens. Os helpers em `/usr/local/sbin/portfolio-{deploy-ssh,hermes-ops}` são instalados como root.

No host: SSH somente por chave, root sem senha, Docker 29.9.3, containerd 2.4.2 e live-restore ativo. A atualização foi gradual e preservou ID, PID e horário de início do ai-memory. Backups locais têm integridade verificada e retenção; cópia externa ainda exige escolher/configurar um destino do proprietário.

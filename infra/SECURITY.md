# Operação de segurança

O ai-memory está fora desta alteração: container, publicação de porta e integração não foram modificados.

As imagens locais de Excalidraw e colaboração preservam os assets/código publicados, mas usam nginx e Node suportados. O sidecar instala socat no build e roda sem root. O Hermes usa base oficial por digest, com correções Python pontuais; seu init s6 precisa ser PID 1 e abandona root antes de executar o gateway. Não adicionar `init: true` ao Hermes.

A API passa a executar como `node`. O deploy corrige a propriedade do volume antes de iniciá-la. O banco e o volume do Hermes recebem backup antes de serem alterados; o snapshot do Hermes pausa e retoma seus serviços para evitar cópia inconsistente. Ele só é repetido quando a imagem do Hermes muda, retém as duas cópias completas mais recentes e publica o arquivo final apenas após concluir a gravação.

O logout invalida também access tokens ainda não expirados. Tokens antigos sem identificador de sessão serão rejeitados; o frontend pode renovar pelo refresh cookie. O login é limitado por IP e por conta no processo da API, independentemente da grafia da rota. Se houver múltiplas réplicas, migrar o estado de limitação para armazenamento compartilhado. O proxy confiável da API é um único hop (nginx); não publicar a porta da API diretamente.

O dashboard do Hermes aceita requisições de navegador apenas com a origem pública esperada antes de adaptar o header ao upstream. Cookies compartilhados entre subdomínios continuam sendo uma fronteira relevante. Timeouts nginx são de inatividade: não garantem encerramento imediato de um WebSocket já autenticado após logout.

`node infra/audit-dependencies.cjs` falha se a consulta não completar ou se houver vulnerabilidade alta/crítica. Permanecem quatro caminhos de um aviso moderado em minimatch, usado pelo lint TypeScript. Não foi imposta uma versão major incompatível à ferramenta para esconder o alerta.

O grupo Docker continua concedendo poder equivalente a root. A chave do CI deve ser restrita por origem/comando ou substituída por um mecanismo de deploy limitado; fazer essa transição exige preparar acesso administrativo independente. O fingerprint SSH está fixado no workflow. Não remover o grupo Docker nem desabilitar o único acesso operacional sem alternativa verificada.

Tarefas administrativas que dependem do console do provedor: revisar login SSH de root, atualizar Docker/containerd e pacotes do host, restringir a credencial de deploy e configurar backup externo com restauração testada. A ausência de acesso sudo/root impede aplicar essas tarefas pelo usuário deploy; não usar o Docker para contornar essa separação durante a manutenção.

# Finanças: sincronização e acesso à produção

## Regras implementadas

O banco SQLite é a fonte da lista financeira. O Pluggy atualiza esse histórico;
indisponibilidade do provedor não apaga os dados já salvos.

- `@@unique([userId, pluggyTransactionId])` impede inserir novamente o mesmo ID
  bancário. A sincronização atualiza a linha existente e preserva descrição,
  valor e categoria editados manualmente. O contador `importedTransactions`
  representa transações processadas, incluindo atualizações.
- Chamadas simultâneas da sincronização para o mesmo usuário compartilham uma
  execução na instância da API, inclusive entre o agendador e as requisições HTTP.
  O bloqueio é liberado também em caso de erro. A restrição única do SQLite
  continua protegendo os IDs entre processos. Se a API passar a ter réplicas,
  será necessário um bloqueio distribuído para também evitar consultas paralelas
  ao Pluggy entre essas réplicas.
- Não há exclusão automática por semelhança de descrição, valor, conta ou minuto.
  Duas compras iguais podem ser legítimas. IDs diferentes exigem revisão antes
  de qualquer limpeza, inclusive após reconectar uma instituição.
- Uma conexão pendente não avança `lastSyncedAt`; esse campo registra somente
  importações concluídas, permitindo tentar novamente quando o Pluggy terminar.
- Pix com a contraparte **Vitor Hugo de Souza Sierro** recebem `ownTransfer=true`.
  Entradas usam `paymentData.payer.name`; saídas usam `paymentData.receiver.name`.
  O nome do titular no outro lado não exclui pagamentos a terceiros. Sem nome
  estruturado da contraparte, a descrição precisa conter Pix e o nome completo.
  A comparação ignora caixa, acentos, pontuação e espaços repetidos.
- Esses Pix permanecem no banco, mas não aparecem na lista, paginação, totais,
  gráficos ou resumo anual. A marcação não é desfeita pela reimportação.
- Antes de cada sincronização, inclusive sem conexões e durante o intervalo de
  uma hora, o histórico Pluggy ainda não verificado é revisado pela descrição.
  Isso inclui registros anteriores à janela de 12 meses do provedor. Lançamentos
  manuais não são marcados automaticamente. `ownTransferChecked` registra a
  verificação e impede reaplicar a heurística da descrição aos lançamentos já
  avaliados com metadados estruturados do Pluggy. Nomes abreviados e descrições já
  editadas sem o nome completo precisam de revisão; não é possível recuperar
  metadados de contraparte que nunca foram persistidos para o histórico antigo.

A regra de titular acima é específica desta instalação pessoal. Antes de usar
o sistema para outros titulares, ela deve se tornar configuração por usuário.

## Como disponibilizar o banco para análise

O Compose configura SQLite em `/data/prod.db`, no volume `infra_api_data`.
Não existe uma porta de banco SQL a liberar. Confirme esses valores no servidor
caso a implantação tenha sido personalizada.

Para começar, basta um snapshot consistente. Na VPS:

```bash
cd /opt/portfolio
./infra/backup-db.sh
```

O script informa o caminho do arquivo `.db.gz`, normalmente em
`/var/backups/portfolio`. Ele usa a API de backup do SQLite; não copie o arquivo
do banco ativo diretamente. Baixe o backup para `private-data/` na raiz deste
projeto, diretório ignorado pelo Git, e informe seu caminho local no chat.
Essa cópia permite analisar duplicações, conexões e classificações sem alterar
produção. Um backup do banco contém também hashes de autenticação e outros
dados privados: mantenha-o local e fora de commits.

Se preferir acesso direto, configure uma chave SSH na sua máquina e a chave
pública no servidor. Informe somente o alias do SSH (ou host e usuário) e o
caminho local da chave privada. Não envie o conteúdo da chave, senha, token
Pluggy ou `.env` pelo chat. Exemplo de configuração local em `~/.ssh/config`:

```sshconfig
Host portfolio-producao
    HostName IP_DA_VPS
    User USUARIO_CONFIGURADO
    IdentityFile CAMINHO_LOCAL_DA_CHAVE
    IdentitiesOnly yes
```

O acesso começa com inspeção e backup. Permissão no grupo Docker dá controle
amplo do host; para apenas analisar, prefira uma cópia exportada do banco ou
uma conta limitada à leitura dos backups.

## Aplicação e revisão

O deploy padrão já executa backup e migrations. Esta mudança acrescenta a
colunas `ownTransfer` e `ownTransferChecked`; a classificação do histórico ocorre na primeira chamada
de sincronização depois do deploy, inclusive ao abrir Finanças. Não rode
`prisma migrate reset` nem substitua o banco de produção por uma cópia local.

Para corrigir registros ambíguos, prepare primeiro uma lista com ID, conta,
data, valor, descrição, classificação proposta e justificativa. A aplicação
deve usar IDs explícitos e transação SQL, com backup e contagem antes/depois.
Nenhuma correção de produção foi executada apenas por adicionar este código.

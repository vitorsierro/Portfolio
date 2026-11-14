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

## Categorias e aprendizado

`category-consolidation.ts` contém os destinos das categorias aposentadas pelo
titular. A importação e as operações do livro financeiro usam os destinos
consolidados para não recriar categorias removidas. Transporte e Saúde passam
a agrupar os subtipos indicados; farmácia/suplementos entram em Supermercado;
Delivery/Idiomas entram em Assinaturas; hospedagem/software/IA ficam juntos.
A consolidação move lançamentos e as duas classes de regra antes de apagar
a categoria antiga, sem excluir transações. Tipos de ativos cadastrados
manualmente na página Investimentos não são alterados por esses redirecionamentos.

`FinancePixAccountRule` permite uma regra explicitamente autorizada por usuário,
nome da conta e direção. Nesta instalação, o titular confirmou que Pix do Itaú
em ambas as direções, ainda em Outros, são movimentações do salário entre suas
contas: recebem Salário e continuam fora dos totais como transferências próprias.
A regra vale para qualquer valor e somente contas bancárias. Pagamentos salariais
originais, sem Pix, continuam sendo renda; regras de estabelecimento, finalidades
identificadas e classificações já ajustadas têm prioridade. A marcação de
transferência própria na sincronização é condicional à categoria e ao campo de
edição manual no momento da escrita, para proteger alterações concorrentes.

Movimentações permite selecionar Mês (filtro mensal original), Ano (de 1º de
janeiro até antes de 1º de janeiro seguinte) ou Tudo (sem limite de data).
O período e os filtros de categoria, tipo e busca são preservados na URL.
A API mantém `month=YYYY-MM` e `month=all` e aceita `year=YYYY`, que tem
prioridade quando enviado. A paginação e todos os agregados usam o mesmo intervalo.

Categorias com `excludedFromTotals=true` permanecem no histórico e nos filtros,
mas suas entradas e saídas não entram no resumo mensal, nos agregados da lista
ou no gráfico anual. O campo é salvo no banco, sem depender do nome da categoria;
as regras históricas de Lixo e pagamento de fatura continuam funcionando.
`Clínica — Pai` usa essa configuração para repasses recebidos e pagos em nome
de terceiro. O aprendizado continua restrito ao destinatário, direção e valor.

O gráfico anual de `Investimentos` mostra fluxo líquido: aplicações/compras
menos resgates e vendas recebidos, no ano de cada lançamento. A API também
retorna `applicationsCents` e `withdrawalsCents` por ano e a identificação
`net-investment-flow`. Valores negativos não são zerados no gráfico: indicam
mais retiradas que aportes no período, não prejuízo nem saldo atual da carteira.
As demais categorias continuam somando somente despesas. Resgates de RDB,
fundos, aplicações automáticas e recebimentos de investimentos têm regras
explícitas; cashback não é tratado como resgate de investimento. Salários
continuam sendo salários mesmo quando a empresa possui “Investimentos” no nome.

`category-rules.ts` separa os gastos de moradia, assinaturas, compras,
alimentação e transporte. O Pix para Luciana Sousa dos Santos Vilhanueva só
é financiamento quando é uma saída de exatamente R$ 1.200. Outros valores
não recebem essa classificação. Os boletos PM/PREF MUN GUARUJA foram
confirmados pelo titular como IPTU; os de condomínio e Elektro têm regras
próprias. Telefônica fica em Internet e telefonia sem presumir a modalidade.

O cartão importa operações `PAGAMENTO` (compras e estornos), excluindo apenas
`PAGAMENTO_FATURA`. Compras internacionais usam `amountInAccountCurrency`
em BRL; sem conversão fornecida pelo banco, o valor não é importado como reais.
O débito de pagamento da fatura na conta corrente fica registrado em
`Cartões — Pagamento de fatura`, categoria excluída dos totais para evitar
contar a mesma despesa duas vezes.

Quando o titular muda uma categoria em um lançamento Pluggy, o sistema salva
um exemplo em `FinanceCategoryRule`, junto com o usuário, estabelecimento,
direção e, quando necessário, valor. A alteração do lançamento e a regra são
salvas na mesma transação. A descrição original fica em `bankDescription`,
para que editar a descrição visível não estrague a identificação do fornecedor.

As regras aprendidas têm prioridade sobre as regras automáticas e a categoria
do provedor, mas não substituem lançamentos já editados manualmente. Uma nova
escolha para o mesmo exemplo atualiza sua regra; limpar a categoria remove
o exemplo correspondente. Regras pertencem a um único usuário e sobrevivem
a reinícios. Excluir uma categoria também remove seus exemplos por chave estrangeira.

A comparação ignora acentos, caixa, pontuação e parcelas como `4/12`.
Fornecedores conhecidos têm nomes canônicos. Outros nomes aceitam alta
similaridade de palavras (mínimo 0,9 e três palavras compartilhadas), sem
escolher entre categorias conflitantes com a mesma pontuação. Pix pessoais e
marketplaces exigem nome normalizado exato e o mesmo valor; descrições
genéricas como “Pagamento de pix” não geram aprendizado. O valor `-1` na regra
representa estabelecimento sem restrição de valor.

Não se presume o produto de uma compra genérica em marketplace: utiliza-se
o tipo informado pelo banco, quando disponível, ou `Compras — Outros`.
Assinaturas parceladas continuam nessa categoria, separadas por finalidade.

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

# ERP Financeiro — Paisagismo (Fase 1 + Fase 2 + Fase 3)

Base de um ERP financeiro hiper-integrado. Fase 1 entregou **Plano de Contas,
Centros de Custo, Livro Caixa e Contas Bancárias**; Fase 2 adicionou **Contas
a Receber, Contas a Pagar, DRE, DFC, Balanço Patrimonial e Balancete**; Fase 3
adiciona **Cadastros (Clientes/Fornecedores/Vendedores/Funcionários/Sócios/
Parceiros), Comissões automáticas, Metas vs. Realizado, Rankings, Recorrências
automáticas e Dashboard Executivo**. Tudo apoiado em um único motor de
partida dobrada real (toda transação gera duas "pernas" — débito e crédito —
que sempre se equilibram).

## Stack

- **Backend**: Node.js + TypeScript + Express + Prisma + PostgreSQL
- **Frontend**: React + TypeScript + Vite + Tailwind CSS + TanStack Query

## Pré-requisitos

- Node.js 18+
- PostgreSQL 14+ rodando localmente

## Setup

### 1. Banco de dados

Crie um banco vazio (via `psql`, pgAdmin, ou o utilitário que preferir):

```sql
CREATE DATABASE erp_paisagismo;
```

### 2. Backend

```bash
cd server
npm install
cp .env.example .env      # ajuste usuário/senha/porta se necessário
npx prisma migrate dev --name init
npx prisma db execute --file prisma/manual/constraints.sql --schema prisma/schema.prisma
npm run prisma:seed
npm run dev                # API em http://localhost:3333
```

O passo `db execute` acrescenta um `CHECK` constraint em nível de banco
reforçando a regra "cada lançamento tem débito OU crédito, nunca ambos" —
a aplicação já valida isso, essa é uma segunda camada de proteção.

### 3. Frontend

Em outro terminal:

```bash
cd client
npm install
npm run dev                 # http://localhost:5173 (proxy /api -> :3333)
```

### 4. Testes automatizados (backend)

Os testes são de integração — rodam contra um Postgres real (não mockam o
Prisma), porque o que mais importa validar aqui é a equação fundamental e a
imutabilidade, e isso só se prova gravando de verdade. Use um banco **separado**
do de desenvolvimento, para não misturar dados:

```bash
cd server
PGPASSWORD=postgres psql -U postgres -h localhost -c "CREATE DATABASE erp_paisagismo_test;"
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/erp_paisagismo_test?schema=public" npx prisma migrate deploy
psql -U postgres -h localhost -d erp_paisagismo_test -f prisma/manual/constraints.sql
npm test              # roda uma vez (vitest run)
npm run test:watch    # modo watch
```

`tests/setup.ts` já aponta `DATABASE_URL` para `erp_paisagismo_test` antes de
qualquer teste importar os serviços — não precisa (nem deve) apontar para o
banco de dev. Cobertura atual: `lancamentos.service.ts` (equação fundamental,
imutabilidade, cancelamento, reversão) e `titulos.service.ts` (validação de
grupo de conta, liquidação, comissão automática, edição de título aberto).

## Como o motor de partida dobrada funciona

Toda movimentação financeira passa por `criarTransacao()`
(`server/src/modules/lancamentos/lancamentos.service.ts`), que:

1. Recebe 2+ "partidas" (cada uma com conta contábil, centro de custo — **obrigatório** — e natureza débito/crédito).
2. Valida que a soma dos débitos é igual à soma dos créditos (equação fundamental).
3. Grava todas as partidas com um `transacaoId` compartilhado, numa transação de banco.
4. Registra a operação no `AuditLog`.

Lançamentos com `status = REALIZADO` são **imutáveis** (só podem ser
estornados via `reverterTransacao`, que cria uma nova transação com os
valores invertidos). Lançamentos `PREVISTO` podem ser editados/cancelados —
é exatamente esse status que representa um título em aberto (Contas a
Receber/Pagar, comissões, recorrências).

## Grupo do demonstrativo (`ContaContabil.grupo`)

Toda conta contábil pertence a um `GrupoDemonstrativo` (Ativo, Passivo,
Patrimônio Líquido, Receita, Custo Variável, Despesa, Entrada/Saída Não
Operacional) — é isso que diz ao DRE/DFC/Balanço em qual seção somar cada
conta. Uma Classe raiz escolhe o grupo ao ser criada; toda subconta **herda**
automaticamente o grupo do pai (`plano-contas.service.ts` sobrescreve
qualquer valor enviado pelo cliente para uma subconta) — assim nunca existe
uma subconta destoando do grupo da sua árvore.

## Contas a Receber / Contas a Pagar

Um título é só uma transação normal do motor de partida dobrada, criada com
`status: PREVISTO` (`titulos.service.ts` → `criarTitulo`):

- Receita: Débito "Contas a Receber" (grupo Ativo) / Crédito conta de Receita.
- Despesa: Débito conta de Custo/Despesa / Crédito "Fornecedores" (grupo Passivo).

Enquanto `PREVISTO`, o título aparece na lista de "em aberto" com aging por
vencimento. **Liquidar** (`liquidarTitulo`) cria uma *segunda* transação
(Débito/Crédito Banco ↔ conta de controle, já `REALIZADO`) e ao mesmo tempo
marca a transação original como `REALIZADO` — o título sai do "em aberto" e a
movimentação aparece no Livro Caixa. Essa segunda transação grava
`tituloOrigemId` apontando para a transação original, para os relatórios de
caixa (DFC / DRE regime caixa) saberem que aquele dinheiro pertence à mesma
categoria (ex.: "Vendas de Produtos"), mesmo a data do lançamento original
sendo diferente da data do recebimento.

Um título de Receita pode carregar `clienteId`/`vendedorId`; um de Despesa
pode carregar `fornecedorId` — campos opcionais em `Lancamento`, aplicados a
todas as pernas da transação (mesmo padrão de `tituloOrigemId`).

## Comissões automáticas (Fluxo 3)

Se um título de Receita é criado com `vendedorId`, `titulos.service.ts`
calcula `comissão = valor × percentualComissao` e cria **automaticamente**
um segundo título — desta vez de Despesa, Débito "Comissões sobre Vendas"
(`6.2.2`) / Crédito "Comissões a Pagar" (`2.1.4`), vencendo no dia 5 do mês
seguinte. É uma transação independente da venda (não precisa ser atômica com
ela — são dois fatos de negócio relacionados, não um só), e uma vez criada é
imutável como qualquer outro título `PREVISTO`/`REALIZADO`.

A tela de **Metas vs. Realizado** calcula uma "comissão ajustada" (comissão
já gerada × % de atingimento da meta do vendedor no período) só como
**número informativo** — não cria nem altera nenhum título. Se um dia isso
precisar virar um lançamento de ajuste de verdade, dá pra reaproveitar
`criarTitulo` na hora.

## Recorrências automáticas — sem cron real

Este ambiente não tem um processo de background persistente para "acordar"
sozinho em cada virada de mês. Em vez de fingir um cron,
`gerarLancamentosPendentes()` (`recorrencias.service.ts`) roda **sob
demanda**: automaticamente toda vez que o Dashboard carrega, e manualmente
pelo botão "Gerar Pendentes" na tela de Recorrências. Cada template guarda
`ultimaCompetenciaGerada` (`"2026-07"`) e, quando chamado, gera de uma vez
todos os meses que ficaram para trás — sem nunca duplicar o mesmo mês.

## Regime de competência vs. regime de caixa

- **Competência** (Plano de Contas, Centros de Custo, DRE-competência,
  Balanço, Balancete, Metas, Rankings): soma lançamentos `PREVISTO` +
  `REALIZADO` — um título em aberto já conta como saldo de Contas a
  Receber/Fornecedores, ou como receita realizada de um vendedor, mesmo sem
  ter sido liquidado.
- **Caixa** (Contas Bancárias, DFC, DRE-caixa): só `REALIZADO` com conta
  bancária preenchida — dinheiro que de fato mudou de mão.

Saldos nunca são colunas gravadas — são sempre **derivados** dos lançamentos
no momento da consulta (`server/src/modules/lancamentos/saldo.service.ts` e
`server/src/modules/relatorios/relatorios.helpers.ts`), o que evita qualquer
divergência entre "o que a tela mostra" e "o que realmente aconteceu".

**Cuidado com dupla contagem por `grupo`**: como `centroCustoId`,
`vendedorId` etc. são aplicados a *todas* as pernas de uma transação (não só
à perna "de resultado"), qualquer agregação por esses campos precisa
filtrar também por `contaContabil.grupo` (ex.: só `CUSTO_VARIAVEL`/`DESPESA`
para "realizado por centro de custo", só `RECEITA` para "realizado por
vendedor") — senão a perna de controle (Ativo/Passivo) soma junto e duplica
o valor. Já apareceu esse bug duas vezes durante o desenvolvimento (Centro de
Custo na Fase 2, e é o motivo do comentário em `metas.service.ts`) — se for
adicionar uma nova agregação por essas colunas, replique o filtro.

## O que está incluído nesta entrega (Fase 1 + Fase 2 + Fase 3)

- Plano de Contas hierárquico (4 níveis) com saldo acumulado por conta e grupo de demonstrativo.
- Centros de Custo hierárquicos com orçamento vs. realizado.
- Contas Bancárias com saldo atual (derivado) vs. saldo conciliado.
- Livro Caixa: registro de entradas/saídas realizadas, com estorno.
- Contas a Receber / Contas a Pagar: títulos em aberto com aging, liquidação, vínculo com cliente/fornecedor/vendedor.
- DRE (competência e caixa) com análise vertical (% da Receita Bruta).
- DFC com saldo inicial/final do período e projeção de 30 dias.
- Balanço Patrimonial com verificação da equação fundamental (Ativo = Passivo + PL).
- Balancete (débito/crédito/saldo por conta no período).
- Cadastros: Clientes, Fornecedores, Vendedores, Funcionários, Sócios, Parceiros.
- Comissão automática sobre vendas com vendedor vinculado.
- Metas vs. Realizado por vendedor (comissão ajustada é informativa).
- Rankings: Top 5 Receitas/Despesas, Ranking de Vendedores, Consolidado de Comissões.
- Recorrências automáticas (sem cron real — geração sob demanda).
- Dashboard Executivo consolidando saldo, DFC/DRE do mês, alertas, calendário de 7 dias e Top 5.
- Log de auditoria (quem, quando, o quê) para toda operação de escrita.
- Seed com árvore representativa de contas/centros/bancos/cadastros, títulos de exemplo (um liquidado, dois em aberto), uma venda com comissão automática e uma recorrência com meses em atraso para demonstrar o "catch-up".

## Fora de escopo (Fase 4 e além)

- Importação de extrato bancário (OFX/CSV) e conciliação assistida — hoje a
  conciliação é manual (atualizar saldo conciliado direto na tela).
- Autenticação real com os 4 níveis de permissão (Admin/Gerente/Vendedor/Operacional).
- Encerramento formal de exercício — o Balanço usa "Resultado Acumulado"
  (todo o histórico de Receita/Custos/Despesas até a data de corte) em vez de
  separar Lucros Acumulados de períodos anteriores do Resultado do Exercício atual.
- Análise horizontal (comparação com período anterior) e gráficos.
- DFC/DRE não categorizam movimentações Ativo↔Ativo sem conta de resultado
  associada (ex.: compra de imobilizado à vista, transferência entre bancos)
  — elas entram no saldo consolidado mas não aparecem detalhadas por linha.
- Recorrências só em frequência mensal (o enum já está pronto para
  semanal/trimestral/anual, só falta implementar o cálculo de próxima
  competência para essas frequências).

Nesta entrega não há login — todas as ações são atribuídas ao usuário fixo
`"Admin"`.

## Estrutura

```
server/
  prisma/schema.prisma        # ContaContabil, CentroCusto, ContaBancaria, Lancamento, AuditLog,
                               # Cliente, Fornecedor, Vendedor, Funcionario, Socio, Parceiro,
                               # RecorrenciaTemplate
  prisma/seed.ts               # dados iniciais
  src/modules/
    plano-contas/ centros-custo/ contas-bancarias/  # cadastros hierárquicos
    cadastros/                                       # Cliente/Fornecedor/Vendedor/Funcionario/Socio/Parceiro
    lancamentos/                                     # motor de partida dobrada + saldo + livro caixa +
                                                       # títulos + recorrências
    relatorios/                                       # DRE, DFC, Balanço, Balancete, Metas, Rankings, Dashboard
    audit-log/
  src/lib/                     # prisma client, auditoria, utilitário de árvore, erros de domínio
client/
  src/pages/                   # uma página por módulo — TitulosPageBase compartilhada por Receber/Pagar,
                               # CadastroPageBase compartilhada pelos 6 cadastros
  src/components/              # TreeTable, Modal, Toast, Sidebar, MoneyCell, PeriodPicker, StatementLine
  src/api/                     # cliente HTTP tipado por módulo
```

# HANDOFF — ERP Financeiro Paisagismo

Documento de transferência do projeto. Leia isto antes do `README.md` — o
README explica *como rodar*; este documento explica *o que existe, por que
foi construído assim, o que já foi testado e o que falta*.

## Status em uma frase

**Fases 1, 2 e 3 do roadmap original estão implementadas, testadas
manualmente no navegador e sem erros de TypeScript.** Desde 2026-07-15 há
testes automatizados de integração (Vitest + Postgres real) para o motor de
partida dobrada — ver seção "Testes automatizados" abaixo. A reforma visual
completa (tema escuro/claro, design system "futurista" preto/verde) foi
concluída em 2026-07-16 — **todas as telas do sistema estão migradas pro
design system `fx-*`** (ver seção "Sistema de design / tema escuro") e essa
reforma já está commitada (`2f85504`).

**A Fase 4 começou em 2026-07-16.** Já entregues e **commitados** (working
tree limpo): (1) **autenticação real** (4 papéis, JWT, autorização por papel,
gestão de usuários, auditoria atribuída — `01a4544`); (2) **reformulação de
Contas a Pagar/Receber** (dashboard, KPIs, kanban, pagamento parcial, workflow
de aprovação — `51312fc` + `6667731`); (3) **módulo Fluxo de Caixa** com 4
visões, DFC Gerencial (Margem de Contribuição preservada) e filtros globais
(`2556f93` + `66309cb` + `b43df17`); (4) **comissões de vendedor responsável +
indicação** no Contas a Receber e painel no Dashboard (`de207c5`); (5) correção
do acordeão do menu (`6ff485b`); (6) **reorganização de 2026-07-17** — ver
seção "Reorganização (fase de testes)": ⚠️ **login DESATIVADO por flag**
(`AUTH_ENABLED=false` no `server/.env` — temporário, fase de testes), modo
foco removido, menu enxuto (DFC + Livro Caixa viraram abas do Fluxo de Caixa;
Rankings e Metas viraram um item; Cadastros virou o item único "Cadastro"),
**recorrência integrada ao lançamento** (aba Repetição gera parcelas como
títulos PREVISTO) e **Cadastro unificado**; (7) **reestruturação de
2026-07-18** (`7c74b51`) — ver seção "Reestruturação do Dashboard e
Comercial": calendário financeiro grande e navegável, card Margem de Lucro
(PE unificado num bloco só), painel de comissões refeito, Rankings e Metas
premium (aba Comercial com avatares/foto de perfil do vendedor) e **menu
final em 4 grupos** (Operacional → Relatórios → Estrutura → Administração,
Cadastro dentro de Estrutura); (8) **pop-up "Lançamentos do dia"** no
calendário (`ee45237`) — clique num dia detalha os lançamentos reais e os
atalhos "+ Adicionar" reutilizam os modais existentes com a data
pré-preenchida (ver seção própria); (9) **melhorias de relatórios de
2026-07-18** (`5c5edf1`) — análise horizontal (comparação com período
anterior) no DRE/DFC/Balanço/Balancete, encerramento de exercício de
apresentação no Balanço e frequências semanal/quinzenal/trimestral/anual
nas recorrências (ver seção "Melhorias de relatórios"); (10) **melhorias
do módulo Contas a Pagar/Receber de 2026-07-18** (`b3de2ec`) — janelas
Semanal→Anual no gráfico projetado, tooltip legível, KPIs clicáveis,
edição de liquidado por permissão de chefia e **comissões acumuladas por
destinatário+data** no Contas a Pagar (ver seção própria); (11) **Design
System "Glass"** (`815f38d`→`dd15450`) — redesign global glassmorphism
dark-only (⚠️ tema claro aposentado da UI), velocímetro de score, badges de
status no calendário, árvore de submenus, Top 5 donut+barras e modo tela
cheia (ver seção própria). A parte fiscal (NF-e/CNAB/retenções) e
OFX/CSV + PDF/XLSX ficaram deliberadamente fora — **perguntar ao usuário
antes de iniciar OFX/CSV ou PDF/XLSX**. Repositório Git local (sem remote).

## Onde está o código

`D:\CLAUDE\PROJ ERP` — **disco local**, não no Google Drive compartilhado.

O projeto começou em `G:\Drives compartilhados\BIBLIOTECA\CLAUDE\PROJ ERP`,
mas o `npm install` falhava de forma consistente ali (EPERM/EBADF) porque é
um Shared Drive do Google que não lida bem com a quantidade de arquivos
pequenos que `node_modules` cria. Por pedido do usuário, o código inteiro
vive só em `D:\CLAUDE\PROJ ERP` — não há cópia nem sincronização no Drive.

## Ambiente desta máquina

- **PostgreSQL 16** instalado localmente via `winget` (não Docker).
  Serviço Windows `postgresql-x64-16`, sempre ligado.
  Usuário/senha: `postgres` / `postgres` (padrão do instalador, só dev local).
  Binário do `psql`: `C:\Program Files\PostgreSQL\16\bin\psql.exe`.
- Banco: `erp_paisagismo` em `localhost:5432`.
- **Preview/dev servers**: configurados em
  `G:\Drives compartilhados\BIBLIOTECA\CLAUDE\.claude\launch.json` (fica no
  diretório de trabalho principal, não dentro do projeto) apontando via
  `npm --prefix`/scripts wrapper para `D:\CLAUDE\scripts\run-server.cmd` e
  `run-client.cmd` — isso existe porque o launcher de preview tem problemas
  com espaços no caminho (`PROJ ERP`) quando chama `npm` diretamente no
  Windows. Se for rodar em outra máquina/ambiente, ignore isso e use
  `npm run dev` normalmente dentro de `server/` e `client/` (ver README).
- API: `http://localhost:3333`. Frontend: `http://localhost:5173` (proxy
  `/api` → `:3333`, configurado em `client/vite.config.ts`).

## Arquitetura — o que precisa ser entendido antes de mexer

Tudo gira em torno de **um único motor de partida dobrada**
(`server/src/modules/lancamentos/lancamentos.service.ts` →
`criarTransacao`/`inserirPernasTransacao`). Toda operação financeira do
sistema — Livro Caixa, Contas a Receber/Pagar, comissões, recorrências —
passa por ele. Não existem caminhos alternativos que gravem `Lancamento`
diretamente sem passar por essa função.

Conceitos-chave, cada um documentado com comentários no código-fonte onde é
implementado:

1. **`GrupoDemonstrativo`** (`ContaContabil.grupo`): toda conta pertence a um
   grupo (Ativo/Passivo/PL/Receita/Custo Variável/Despesa/Entrada ou Saída
   Não Operacional). É a *única* fonte de verdade sobre em que seção de
   DRE/Balanço/DFC uma conta entra. Herdado automaticamente do pai
   (`plano-contas.service.ts`).
2. **Regime de competência vs. caixa**: competência soma `PREVISTO +
   REALIZADO`; caixa só `REALIZADO` com conta bancária. Ver
   `saldo.service.ts` e `relatorios.helpers.ts`.
3. **Títulos** (Contas a Receber/Pagar) são só transações normais criadas com
   `status: PREVISTO` (`titulos.service.ts` → `criarTitulo`). **Liquidar**
   cria uma *segunda* transação `REALIZADO` e marca a original como
   `REALIZADO` também — a perna nova carrega `tituloOrigemId` apontando para
   a original, o que permite o DFC/DRE-caixa rastrear a categoria certa do
   dinheiro mesmo com datas diferentes.
4. **Comissão automática** (Fluxo 3): título de Receita com `vendedorId`
   dispara a criação automática de um título de Despesa de comissão
   (`gerarComissoes` dentro de `titulos.service.ts`). É uma transação
   independente e imutável — editar a venda depois **não** recalcula a comissão
   já gerada. **Desde 2026-07-17** há também **comissão de indicação**: se o
   título de receita traz um indicador (`indicadorTipo` VENDEDOR|PARCEIRO +
   `indicadorId` + `indicadorNome` snapshot), gera um 2º título de comissão
   usando `percentualIndicacao` do vendedor/parceiro que indicou. Ambas aceitam
   **override**: o modal manda `comissaoResponsavel`/`comissaoIndicacao` (valor
   final editado) e, quando presentes, o serviço usa esse valor em vez do
   percentual. Ver seção "Comissões (vendedor + indicação)".
5. **Recorrências sem cron real**: não há processo de background nesta
   stack. `gerarLancamentosPendentes()` (`recorrencias.service.ts`) roda sob
   demanda — automaticamente quando o Dashboard carrega, e manualmente via
   botão. Idempotente via `ultimaCompetenciaGerada`.
6. **Imutabilidade**: lançamento `REALIZADO` nunca muda (só via
   `reverterTransacao`, que cria uma transação inversa). `PREVISTO` pode ser
   editado/cancelado livremente — é esse status que representa "em aberto"
   em todo o sistema.

## Armadilha recorrente — cuidado ao adicionar novas agregações

`centroCustoId`, `vendedorId`, `clienteId`, `fornecedorId` são gravados em
**todas** as pernas de uma transação (não só na perna "de resultado").
Qualquer agregação nova por esses campos **precisa** filtrar também por
`contaContabil.grupo`, senão a perna de controle (Ativo/Passivo) soma junto
e duplica o valor. Isso já causou dois bugs reais durante o desenvolvimento
(um em "Realizado por Centro de Custo" na Fase 2, corrigido em
`saldo.service.ts`; a lógica de `metas.service.ts` já nasceu com o filtro
certo por causa disso). Se for escrever uma nova query agregando por um
desses campos, replique o padrão `contaContabil: { grupo: { in: [...] } }`
que já existe em `metas.service.ts`/`saldo.service.ts`.

## Bugs reais encontrados e corrigidos durante o desenvolvimento

Histórico útil para quem for mexer no código depois — mostra onde as
armadilhas já mordem:

1. **Fase 2** — Balanço Patrimonial zerado: `dataCorte` de um
   `<input type="date">` vira meia-noite UTC ao ser parseado, excluindo
   lançamentos feitos mais tarde no mesmo dia. Corrigido normalizando
   datas-fim para o último milissegundo do dia (`finalDoDia` em
   `relatorios.helpers.ts`).
2. **Fase 2** — Centro de Custo contava despesa em dobro quando um título
   era liquidado (a perna de baixa do Fornecedores herdava `tipo: DESPESA`
   e era somada junto com a despesa original). Corrigido filtrando por
   `contaContabil.grupo` em `saldo.service.ts` (ver seção acima).
3. **Fase 3 → pós-fase** — Contas a Receber/Pagar/Recorrências não tinham
   botão de editar (funcionalidade nunca implementada, não bug de UI
   travada). Ao implementar, um segundo bug apareceu: os `<select>` dos
   formulários de edição não pré-selecionavam a opção certa, porque as
   opções vêm de queries assíncronas que ainda não tinham carregado quando
   o formulário aplicava os valores iniciais via `defaultValues` do
   react-hook-form. Corrigido com `reset()` disparado num `useEffect` assim
   que os dados chegam — hoje o padrão vive em
   `components/contas/TituloModal.tsx` (e em `RecorrenciasPage.tsx`, legada;
   a antiga `TitulosPageBase.tsx` foi substituída e removida). **Se algum
   outro formulário de edição no futuro buscar suas próprias opções de
   `<select>` via `useQuery` dentro do próprio componente de formulário (em
   vez de receber os dados já carregados por prop do componente pai), ele
   provavelmente tem o mesmo bug latente** — os formulários de edição de
   Plano de Contas, Centros de Custo e Cadastros (Cliente/Fornecedor/
   Vendedor/etc.) recebem os dados já carregados via prop do componente pai
   e não foram afetados, mas não foram exaustivamente testados quanto a
   isso.
4. **2026-07-16, `MoneyCell`** — valores vindos da API apareciam como
   `"R$ NaN"` intermitentemente. Causa: campos `Decimal` do Prisma chegam
   como **string** no JSON (o tipo `number` no TS do frontend é só o
   contrato, não uma garantia em runtime) — `("500").toLocaleString(...)`
   silenciosamente ignora as opções de moeda em vez de dar erro, porque
   `String.prototype.toLocaleString` existe e aceita os mesmos argumentos.
   Corrigido com `Number(valor)` antes de formatar, com o porquê comentado
   no código. **Se algum componente novo formatar um valor monetário sem
   passar por `MoneyCell`/`formatBRL`, cuidado com a mesma armadilha.**
5. **2026-07-16, Tailwind + variável CSS** — ao migrar `receita`/`despesa`/
   `info`/`alerta` de hex fixo para `var(--x)` (pra adaptar ao tema), os
   modificadores de opacidade do Tailwind (`bg-receita/10`, `border-info/30`
   etc., usados em várias telas) **quebraram silenciosamente**: viravam
   `background-color: rgba(0,0,0,0)` (transparente) sem erro nenhum,
   porque o Tailwind precisa decompor a cor em canais R/G/B pra aplicar
   opacidade, e não consegue fazer isso com uma `var()` opaca. Corrigido
   definindo canais separados (`--receita-rgb: 46 255 160`, sem `rgb()`) e
   apontando o Tailwind pra `rgb(var(--receita-rgb) / <alpha-value>)` em vez
   de `var(--receita)` direto (ver `tailwind.config.js` + `index.css`). Esse
   é o padrão a seguir pra qualquer cor semântica nova que precise suportar
   `/opacity`.
6. **2026-07-16, drag-and-drop nativo (Sidebar)** — HTML5 DnD sintético via
   `element.dispatchEvent(new DragEvent(...))` não é confiável pra testar:
   o primeiro teste (arrastando com `dataTransfer.setData` chamado dentro do
   handler `onDragStart`, disparado sincronamente logo antes do
   `dragover`/`drop`) falhava porque o React ainda não tinha "flushado" o
   estado — isso não afeta um drag real (mouse leva tempo real entre os
   eventos), só a simulação. A implementação final usa **`useRef`** (não
   `useState`) pra guardar o que está sendo arrastado, porque leitura/escrita
   de ref é síncrona e imediata, eliminando essa classe de bug de vez —
   `useState` só é usado pro *indicador visual* de destino (`grupoAlvo`/
   `itemAlvo`), que pode esperar o próximo render.
7. **2026-07-16, `lucide-react`** — a versão instalada não tem
   `FileBarChart2`, `UserCircle2` nem `BarChart3` (existiam em versões mais
   antigas da lib; essa aqui usa a família `ChartColumn`/`ChartBar*` e
   `UserRound`). Antes de usar um ícone novo do lucide, confirme que existe
   com `grep "declare const NomeDoIcone:" node_modules/lucide-react/dist/lucide-react.d.ts`.
8. **2026-07-16, botão sólido sobre `--info`/`--neon`** — no tema escuro,
   `--info` e `--neon` são um verde **muito claro** (`#2EFFA0`); um botão
   com esse fundo e texto branco (`bg-info text-white`, padrão usado em
   quase todo formulário antigo) fica com contraste ruim. A convenção nova
   (`.fx-btn-primary` em `index.css`) usa fundo `var(--neon)` com texto
   quase-preto fixo (`#04120f`) — funciona nos dois temas porque `--neon`
   nunca é escuro o suficiente pra precisar de texto claro. Qualquer botão
   sólido novo deve seguir esse padrão, não `bg-info text-white`.

## O que está implementado (mapa por módulo)

Coluna **Tema** = migrado pro design system escuro/claro novo (`fx-*`) ou
ainda no visual antigo (Tailwind claro fixo). Ver seção seguinte pros
detalhes.

| Área | Backend | Frontend | Tema | Observação |
|---|---|---|---|---|
| Plano de Contas | `modules/plano-contas/` | `PlanoContasPage.tsx` | ✅ novo | hierárquico, 4 níveis, grupo herdado |
| Centros de Custo | `modules/centros-custo/` | `CentrosCustoPage.tsx` | ✅ novo | orçamento só em folha, rollup no pai |
| Contas Bancárias | `modules/contas-bancarias/` | `ContasBancariasPage.tsx` | ✅ novo | saldo atual derivado, conciliação manual |
| Livro Caixa | `modules/lancamentos/livro-caixa.*` | `LivroCaixaPage.tsx` (embutida como **aba do Fluxo de Caixa**) | ✅ novo | lançamento direto, sempre `REALIZADO` |
| Contas a Receber/Pagar | `modules/lancamentos/titulos.*`, `contas-receber.routes.ts`, `contas-pagar.routes.ts` | `components/contas/*` (módulo parametrizado) + 2 wrappers | ✅ novo | dashboard+KPIs+kanban, baixa parcial, aprovação — ver seção "Módulo Contas a Pagar/Receber" |
| DRE / DFC / Balancete | `modules/relatorios/` | `DREPage/DFCPage/BalancetePage.tsx` | ✅ novo | competência e caixa |
| Fluxo de Caixa (4 visões + DFC Gerencial) | `modules/relatorios/fluxo-caixa.*` | `FluxoCaixaPage.tsx` + `components/fluxo/*` | ✅ novo | Realizado/Projetado/Mensal/DFC; matriz mês×categoria, Margem de Contribuição integrada — ver seção "Módulo Fluxo de Caixa" |
| Balanço Patrimonial | `modules/relatorios/` | `BalancoPage.tsx` | ✅ novo | header/cards e as 3 árvores (Ativo/Passivo/PL, via `TreeTable`) todos migrados |
| Cadastro (unificado, 6 entidades) | `modules/cadastros/` (6 APIs preservadas) | `CadastroUnificadoPage.tsx` (`/cadastro`) | ✅ novo | item único de menu; pills de tipo, filtros, seção Comissão — ver "Reorganização" item 5 |
| Comissões (responsável + indicação) | `titulos.service.ts` (`gerarComissoes`), `rankings.service.ts` (`painelComissoes`) | bloco no `TituloModal.tsx` + `PainelComissoes.tsx` no Dashboard | ✅ novo | vendedor responsável + indicador (vendedor/parceiro), override manual — ver seção "Comissões" |
| Rankings e Metas | `modules/relatorios/rankings.*` + `metas.*` | `RankingsMetasPage.tsx` (3 abas: **Comercial** (`ComercialView`), Rankings, Metas) | ✅ novo | dashboard comercial premium com avatares/metas/comissões — ver "Reestruturação" |
| Recorrências | integrada: `criarTitulo` + `repeticao` (série de parcelas); legado: `modules/lancamentos/recorrencias.*` | aba Repetição do `TituloModal`; `RecorrenciasPage.tsx` (rota escondida, só templates legados) | ✅ novo | ver "Reorganização" item 4 |
| Dashboard | `modules/relatorios/dashboard.*` | `DashboardPage.tsx` | ✅ novo | rota `/`, orquestra os demais serviços + gráficos novos (ver seção de tema) |
| Auditoria | `modules/audit-log/`, `lib/audit.ts` | (sem tela dedicada) | — | toda escrita chama `registrarAuditoria` |

## Sistema de design / tema escuro (dark mode)

Trabalho de 2026-07-16, commitado em `2f85504`. Substitui a
UI Tailwind-claro-fixo original por um design system com tema claro/escuro
alternável, "futurista" (preto + verde neon no escuro). Migração é
**incremental por tela** — não foi tudo de uma vez.

### Infraestrutura (afeta o app inteiro, já pronta)

- **Tokens CSS** em `client/src/index.css` (`:root` = claro, `:root[data-theme="dark"]`
  = escuro): `--void/--bg/--card/--card2/--line/--border/--muted/--bright/--neon/--neon-soft/--expense/--alert/--info`.
  Semânticos antigos (`receita`/`despesa`/`info`/`alerta`, usados em telas
  não migradas) agora resolvem pra essas mesmas variáveis — **toda tela do
  sistema já reage ao tema**, mesmo as que nunca foram tocadas nesta reforma,
  porque essas classes Tailwind (`text-receita`, `bg-despesa/10` etc.)
  sempre existiram e agora só apontam pra outro lugar.
- **`client/src/theme/ThemeProvider.tsx`** + **`client/src/components/fx/ThemeToggle.tsx`**:
  contexto React + botão (sol/lua). Preferência salva em `localStorage`
  (`erp-tema`). `client/index.html` tem um `<script>` inline que aplica o
  tema salvo **antes do primeiro paint** (evita flash de tema errado) —
  se mexer em como o tema é lido/salvo, teria que atualizar os dois lugares.
- **Rede de segurança pra telas não migradas**: regra `.bg-white, .bg-gray-50 { color: #111827 }`
  em `index.css` — sem isso, texto dentro de um card `bg-white` antigo
  herdaria `--bright` (claro) do `body` em tema escuro e ficaria ilegível
  (texto claro sobre fundo branco). Só pode ser removida quando **todas** as
  telas estiverem migradas.
- **Fontes**: Space Grotesk (títulos), Inter (corpo), JetBrains Mono (números)
  — carregadas via Google Fonts em `client/index.html`.

### Componentes novos (`client/src/components/fx/`)

Reutilizáveis, pensados pra qualquer tela migrar depois, não só o Dashboard:

| Componente | Pra quê |
|---|---|
| `PageHeader.tsx` | título + subtítulo + ações — cabeçalho padrão de página |
| `KpiCard.tsx` + `Spark.tsx` | card de KPI com sparkline; 4 variantes visuais (`wave`/`bars`/`segments`/`candles`) |
| `Donut.tsx` + `DonutRank.tsx` | donut de ranking por categoria; `DonutRank` já inclui o card (título+donut+legenda) |
| `PontoEquilibrio.tsx` | card full-width: badge de status, barra de progresso, gráfico de linhas (Receitas/Despesas/Ponto de Equilíbrio) |
| `IconBadge.tsx`, `GlowDot.tsx`, `FlowerIcon.tsx`, `SegmentedControl.tsx`, `EmptyState.tsx`, `Sparkline.tsx` | primitivos visuais menores |

Classes CSS compartilhadas (`index.css`, namespace `fx-`): `.fx-card`,
`.fx-input`/`.fx-label` (formulários), `.fx-btn-primary`/`.fx-btn-ghost`/`.fx-btn-text`
(botões — ver bug #8 acima antes de criar um botão sólido novo),
`.fx-row-4`/`.fx-two-up`/`.fx-big-metric` (grids), `.fx-pe-*` (Ponto de
Equilíbrio), `.fx-side-*` (Sidebar).

### Sidebar (`client/src/components/Sidebar.tsx`) — reescrita completa

Não existe mais nenhum resquício da sidebar antiga. Funcionalidades novas:

- **Colapsável** (236px ↔ 70px, só ícones) — `localStorage["erp-sidebar-colapsado"]`.
- **Grupos expansíveis/recolhíveis** independentes —
  `localStorage["erp-sidebar-abertos"]` (mapa `{ idGrupo: boolean }`).
  (O "Modo Foco" que existia aqui foi **removido** em 2026-07-17 a pedido —
  ver seção "Reorganização" item 2.)
- **Ícone lucide por item** (mapeado manualmente em `GRUPOS_PADRAO` dentro
  do arquivo — cuidado com nomes de ícone que não existem, ver bug #7).
- **Drag-and-drop de grupos inteiros e de itens dentro do grupo**,
  independentes um do outro — `localStorage["erp-sidebar-ordem"]`. Usa
  `useRef` pro estado do drag em si (ver bug #6) — só o *indicador visual*
  de destino é `useState`.
- Grupos/itens são identificados por **`id` estável** (não pelo `titulo`
  exibido) — renomear um grupo no código não perde a ordem salva do usuário.
- Adaptada pra roteamento real (`useLocation`/`NavLink`) — o protótipo de
  referência original usava um `active`/`setActive` fake em memória.

### Dashboard (`client/src/pages/DashboardPage.tsx`)

Reescrito do zero várias vezes ao longo da reforma (paleta trocou 2x antes
de fechar em preto/verde neon). Estado atual:

- KPIs (Receita/Despesa/Resultado/Saldo do mês) com sparkline — cada um com
  uma variante visual diferente (`wave`/`bars`/`segments`/`candles`) de propósito.
- Gráfico "Receitas x Despesas" (área, 3M/6M/12M) + radar "Saúde Financeira"
  (**8 eixos** — Liquidez/Margem/Crescimento/Eficiência/Cobertura/Solvência/
  Reserva/Rentab. — heurística v1 documentada em `saude-financeira.service.ts`,
  **não é um KPI contábil padrão**, ajustável quando houver critério de
  negócio real).
- Card full-width "Ponto de Equilíbrio": badge (atingido/abaixo + quanto
  falta faturar), barra de progresso, gráfico de linhas por mês com seletor
  de período (3m/6m/9m/12m) — dados reais, calculados por mês em
  `dashboard.service.ts` (`calcularPontoEquilibrio`, extraído como helper
  reaproveitado tanto pro mês atual quanto pra série histórica).
- ~~Grid de 4 colunas com Calendário pequeno~~ → **atualizado em 2026-07-18**
  (ver seção "Reestruturação do Dashboard e Comercial"): o calendário virou o
  componente grande full-width `CalendarioFinanceiro.tsx` (navegável, pílulas
  por dia); o grid restante é de 3 colunas (`.fx-row-3`): Saldo por Conta,
  donut Top 5 Despesas e donut Top 5 Receitas. O quadrante pequeno de Ponto
  de Equilíbrio virou o card **Margem de Lucro**.
- Decoração de fundo (arco de luz + linha no topo), só visível no tema
  escuro (`.fx-page-decor`, injetada em `App.tsx`).

Backend que sustenta isso, tudo em `dashboard.service.ts` (+ `saude-financeira.service.ts`
novo e `calcularSaldosContasBancariasAteData` novo em `saldo.service.ts`):
`serieMensal` (12 meses de receitas/despesas/ponto de equilíbrio), `deltas`
(variação % vs. mês anterior), `saldoTrend7d` e `contasBancarias[].trend`
(saldo dos últimos 7 dias, uma query por dia — não otimizado, dataset de PME
não justifica ainda), `calendarioMes` (grid do mês inteiro, substituiu o
antigo "próximos 7 dias"), `saudeFinanceira`.

### Migração de tema — status final (2026-07-16)

Todas as telas foram migradas. `TreeTable.tsx` (compartilhado por Plano de
Contas, Centros de Custo e pelas 3 árvores do Balanço Patrimonial) e
`CadastroPageBase.tsx` (compartilhado pelos 6 Cadastros) foram migrados uma
vez cada, o que destravou todas as telas dependentes de uma vez.
`ContasBancariasPage.tsx` (estrutura própria, cards de conta, não usa
`TreeTable`/`CadastroPageBase`) recebeu migração dedicada. A rede de
segurança `.bg-white, .bg-gray-50 { color: #111827 }` foi removida do
`index.css` (confirmado por grep que nenhuma tela mais usa essas classes).
`npx tsc -b` limpo e os 22 testes de backend passam no estado atual.

- Frontend ainda **não tem nenhum teste automatizado** (só o backend tem,
  ver seção seguinte) — nada disso foi coberto por teste, só verificado
  manualmente no browser durante a implementação.

## Autenticação (Fase 4) — 2026-07-16 (commitada em `01a4544`)

Autenticação real com JWT + 4 papéis.

### Como funciona

- **Modelo `Usuario`** (`schema.prisma`) + enum `PapelUsuario`
  (`ADMIN`/`GERENTE`/`VENDEDOR`/`OPERACIONAL`). Migration
  `20260716093815_usuarios_auth`. Senha guardada como hash **bcryptjs** (JS
  puro de propósito — ver `lib/senha.ts`, mesma lógica anti-módulo-nativo do
  resto do projeto). `senhaHash` nunca sai do backend (`selectPublico` em
  `usuarios.service.ts`).
- **JWT** assinado com `JWT_SECRET` (novo no `.env`; fallback dev inseguro se
  ausente). Validade 12h. Assinamos só `id/nome/papel` — ver
  `middleware/auth.ts` (`gerarToken`, `autenticar`, `exigirPapel`).
- **Rotas**: `POST /api/auth/login` e `GET /api/auth/me` são as únicas fora da
  parede de auth (`authRouter`, montado antes do `app.use("/api", autenticar)`
  em `app.ts`). Todo o resto exige `Authorization: Bearer <token>`.
- **Autorização por papel**: aplicada na **granularidade de router em
  `app.ts`** (ponto único de ajuste da matriz). `exigirPapel(...papeis)` —
  ADMIN é superusuário e passa sempre; `exigirPapel()` sem args = só ADMIN.
  - Estrutura (plano-contas, centros-custo, contas-bancarias) → ADMIN, GERENTE
  - Operacional + Cadastros → ADMIN, GERENTE, OPERACIONAL
  - Relatórios/Dashboard → todos os autenticados (inclui VENDEDOR)
  - Usuários e Audit-log → só ADMIN / ADMIN+GERENTE respectivamente
- **Auditoria atribuída**: as rotas de escrita agora passam `req.usuario.nome`
  aos services (antes usavam sempre o fallback `USUARIO_PADRAO = "Admin"`).
  Os services **já aceitavam** o parâmetro `usuario` desde as fases
  anteriores — a Fase 4 só fez o wiring das rotas. Registros antigos do seed
  ainda mostram "Admin"; novos mostram o usuário logado.
- **Frontend**: `auth/AuthProvider.tsx` (contexto: `usuario`, `entrar`,
  `sair`, `temPapel`), `pages/LoginPage.tsx`, guarda em `App.tsx`
  (componente `Protegida` espelha a matriz do backend — é só UX, o servidor é
  a autoridade), token no `localStorage["erp-token"]` anexado em todo request
  no `lib/api.ts` (um 401 limpa o token e emite `auth:expirou` → derruba a
  sessão). Sidebar filtra grupos por papel e tem rodapé com usuário + logout.
  `pages/UsuariosPage.tsx` = CRUD de usuários (só ADMIN).

### Trava de segurança

`usuarios.service.excluir` não deixa excluir o **último ADMIN ativo** (evita
travar o sistema sem administrador).

### Usuários de demonstração (criados pelo seed)

`admin@lauc.com` / `gerente@lauc.com` / `vendedor@lauc.com` /
`operacional@lauc.com` — senha = `<papel>123` (ex.: `admin123`). Trocar em
qualquer uso real.

### O que **não** foi feito (candidatos futuros)

- Sem "esqueci minha senha", sem refresh token (expira em 12h e pede login de
  novo), sem rate-limiting no login. Autorização é por router, não por
  operação (ex.: VENDEDOR não tem "Contas a Receber só-leitura" — a matriz foi
  mantida limpa na granularidade de router de propósito; se precisar de
  leitura/escrita diferenciada, é aí que muda).
- Testes automatizados de auth ainda não existem (verificado só manualmente:
  login/logout, 401 sem token, 403 por papel, guarda de rota, auditoria
  atribuída — tudo confirmado no browser + curl).

## Módulo Contas a Pagar/Receber (Camadas 1 e 2) — 2026-07-16

Reformulação completa dos dois módulos de títulos num **componente único
parametrizado por tipo** (Pagar × Receber). Backend commitado em `51312fc`;
frontend no commit seguinte.

### Backend (Camada 2)

- **Pagamento parcial** (`liquidarTitulo` aceita `valor` opcional): cada baixa
  é uma transação `REALIZADO` vinculada por `tituloOrigemId`; o título só vira
  `REALIZADO` quando o saldo zera. `somarBaixas` soma a perna de banco das
  baixas. **Nuance contábil documentada no código**: competência (Balanço)
  sempre correto; caixa puro fica transitório enquanto parcial. Sem
  juros/multa/desconto ainda.
- **Aprovação**: enum `StatusAprovacao` (campo `aprovacao`, ortogonal ao
  `status` contábil — não interfere na partida dobrada). `decidirAprovacao`
  (aprovar/rejeitar); baixa bloqueada enquanto `PENDENTE`.
- **Campos novos** no `Lancamento`: `formaPagamento` (enum), `projeto`,
  `previsaoPagamento`. Gravados em todas as pernas (como `fornecedorId`).
- **`listarTitulos`**: listagem rica (abertos+parciais+pagos) com status
  derivado (`ABERTO/PARCIAL/VENCIDO/PAGO/REJEITADO/AGUARDANDO_APROVACAO`),
  saldo, pago e baixas. Endpoints: `GET /completo`, `POST /:id/aprovar`,
  `/:id/rejeitar`; `liquidar` aceita `valor` parcial. `listarTitulosAbertos`
  (antigo `GET /`) mantido, mas o frontend novo usa `/completo`.
- Migration `20260716140953_titulos_camada2`. 7 testes novos (29 no total).

### Frontend (Camada 1) — `client/src/components/contas/`

Tudo parametrizado por `ConfigModulo` (`tipos.ts`); `ContasPagarPage`/
`ContasReceberPage` só passam a config. Componentes reaproveitados
integralmente pelos dois módulos:

| Arquivo | Papel |
|---|---|
| `ContasModulo.tsx` | orquestrador: estado de período/busca/visão/seleção, queries, modais |
| `PeriodoBar.tsx` | ano/mês (‹ ›) + filtrar-por + atalhos rápidos de período |
| `Indicadores.tsx` | faixa de 6 KPIs + faixa de 5 totalizadores (`resumir` em `helpers.ts`) |
| `FluxoCaixaChart.tsx` | barras/dia recharts (a receber ⬆ verde, a pagar ⬇ coral), janelas 7–90d |
| `TitulosTabela.tsx` | tabela ordenável, checkbox de lote, ações; `StatusBadge` exportado aqui |
| `TitulosKanban.tsx` | kanban drag-and-drop (`useRef` p/ o drag — ver bug #6); drop em "Pagas" abre baixa, em "Em aberto"/"Rejeitadas" aprova/rejeita |
| `TituloModal.tsx` | modal com abas Detalhes/Pagamentos/Repetição/Diversos |
| `BaixaModal.tsx` | registrar pagamento total ou parcial, lista baixas + saldo |
| `helpers.ts` | labels/cores de status, forma de pagamento, período, `resumir`, export CSV |

- **Status é derivado** (não é campo editável), então o drag do kanban só
  dispara transições que correspondem a uma ação real (baixar, aprovar,
  rejeitar) — os demais arrastos são ignorados.
- CSS do módulo no `index.css` (namespace `fx-`): `.fx-chip`, `.fx-conta-kpis`,
  `.fx-conta-totais`, `.fx-search`, `.fx-view-toggle`, `.fx-tabs`/`.fx-tab`,
  `.fx-kanban*`, `.fx-icon-action`.
- `TitulosPageBase.tsx` (a tela antiga) **foi removido** — substituído por este
  módulo.

### Fora de escopo (a pedido — "parte fiscal e afins")

Importação **NF-e XML**, **CNAB** (remessa/retorno), **retenções de imposto**
(IRRF/INSS/ISS/PIS/COFINS/CSLL), **rateio por departamento**, **anexos**,
export **XLSX**, e geração de **parcelas recorrentes** direto do modal. As abas
Impostos/Departamentos/CNAB do spec original não foram criadas; Repetição
aponta para o módulo Recorrências. Frontend ainda sem testes automatizados
(só verificação manual no browser).

## Módulo Fluxo de Caixa / DFC Gerencial — 2026-07-16

Primeiro incremento (Shell + Visão 4 "DFC Gerencial") de um módulo maior de 4
visões. Rota `/fluxo-caixa` (grupo Relatórios da sidebar).

### O que foi feito

- **Backend** `modules/relatorios/fluxo-caixa.service.ts` → `dfcGerencial(ano,
  regime)`: roda a agregação **já existente** (`agregarCaixa`/
  `agregarCompetencia` de `relatorios.helpers.ts`) **mês a mês** e monta a
  matriz mês×categoria: recebimentos/pagamentos detalhados por categoria (com
  movimento), geração de caixa, blocos operacional/não-operacional, **Margem
  de Contribuição** e saldo acumulado. Rota `GET /api/fluxo-caixa/dfc-gerencial?ano=&regime=`
  (liberada a todos os autenticados, como os demais relatórios). Não otimizado
  (uma agregação por mês) — consistente com o resto do projeto.
- **Frontend**: `FluxoCaixaPage.tsx` (shell com switch das 4 visões — só DFC
  ativo, as outras 3 mostram placeholder "em construção" —, toggle de regime
  Caixa/Competência e navegador de ano), `components/fluxo/DFCMatrix.tsx`
  (matriz expansível, sticky no cabeçalho de meses e na 1ª coluna, "—"
  discreto pra zero, coluna Total-ano, linhas-grupo tintadas) e
  `components/fluxo/RecebimentosPagamentosChart.tsx` (combo recharts:
  recebimentos ⬆ verde, pagamentos ⬇ coral, linha de saldo acumulado azul).
  Export CSV da matriz. CSS `fx-dfc-*` no `index.css`.

### ⚠️ Margem de Contribuição — PRESERVADA (não recalculada)

O spec exigia preservar a Margem de Contribuição existente. **A fórmula não foi
alterada nem duplicada**: `dfcGerencial` calcula `margemContribuicao[mes] =
RECEITA[mes] − CUSTO_VARIAVEL[mes]` e `margemPercentual = margem ÷ receita`, a
**mesma** definição de `dre.service.ts` e `dfc.service.ts` (linha
`margemContribuicao = receitas - custosVariaveis`). Ela aparece **duas vezes**
na UI: (1) no resumo do topo ("Margem de Contribuição: R$ X") e (2) como uma
**linha dedicada** na matriz DFC (âmbar), seguida da linha "% Margem de
Contribuição", dentro do bloco operacional. Verificado no browser: julho/2026
em caixa = R$ 5.000 − R$ 1.200 = **R$ 3.800 (76%)**.

### Visões 1, 2 e 3 (adicionadas depois do DFC, mesmo módulo)

As outras três visões do switch já estão implementadas (não são mais
placeholder):

- **Backend** (novas funções em `fluxo-caixa.service.ts`): `serieDiaria(inicio,
  fim)` e `serieMensal(ano)`. Ambas separam **realizado** (pernas bancárias
  `REALIZADO`, entrada=débito no banco, saída=crédito; **exclui
  `TRANSFERENCIA`** — transferência entre contas não é fluxo) de **previsto**
  (saldo em aberto de títulos por dia/mês de vencimento). `serieDiaria` também
  devolve `recebiveisVencidos` (vencidos no passado, fora da projeção — banner
  da Visão 2). Rotas `GET /serie-diaria?dataInicio=&dataFim=` e
  `/serie-mensal?ano=`.
- **Frontend** (`components/fluxo/`): `FluxoRealizadoView` (Visão 1 — 4 KPIs,
  janela 7/15/30/90d, Diário/Semanal, área de saldo acumulado + barras
  entradas/saídas), `FluxoProjetadoView` (Visão 2 — toggle Realizado/Previsto/
  Ambos, 5 KPIs, banner de recebíveis vencidos, gráfico com linha "hoje" +
  tabela diária), `FluxoMensalView` (Visão 3 — toggle Líquido/Bruto, 4 KPIs,
  combo mensal + tabela por mês com Lucratividade% e previstos, total anual) e
  `KpiFluxo` (card compartilhado). O saldo acumulado é montado no frontend a
  partir do `saldoInicial`.

### Filtros globais (adicionados depois das 4 visões)

Barra de filtros compartilhada pelas 4 visões — `components/fluxo/FiltrosFluxoBar.tsx`:
**conta bancária**, **centro de custo** e **parceiro** (cliente/fornecedor/
vendedor combinados num `<optgroup>`). Estado no `FluxoCaixaPage`, incluído na
query key e repassado a todas as visões.

- **Backend**: interface `FiltrosFluxo` + helper `wherePerna` em
  `relatorios.helpers.ts`. `agregarCaixa`/`agregarCompetencia` ganharam
  `filtros?` opcional (backward-compatible — os outros relatórios não passam
  nada). No `fluxo-caixa.service.ts`, `movimentoRealizadoPorDia`/
  `previstoPorDia`/`dfcGerencial`/`serieDiaria`/`serieMensal` repassam os
  filtros. `parceiroId` casa com `OR: [clienteId, fornecedorId, vendedorId]`.
- **Regra**: filtro de **conta bancária só se aplica ao regime de caixa** (a
  competência não é específica de banco; a barra avisa "(só no caixa)"); e não
  se aplica ao **previsto** (título em aberto ainda não tocou banco).
- Verificado (curl + browser): filtrar por "Administrativo" reduz Pagamentos de
  R$ 2.700 → R$ 1.500 (o aluguel desse centro); "Limpar filtros" reseta.

### Ainda fora do módulo (próximos passos)

- Split fino de Investimento vs Financiamento (hoje há "operacional" e "não
  operacional"; separar exige marcar atividade CVM por conta — a limitação
  Ativo↔Ativo do `agregarCaixa` está documentada no próprio helper).
- **Importar Extrato (OFX/CSV) e export PDF/XLSX**: deixados para depois **a
  pedido do usuário — perguntar antes de iniciar** (ver memória
  `erp-prioridades-fase4`).
- Fluxo de Caixa ainda sem testes automatizados (verificado no browser + curl).

## Comissões (vendedor + indicação) — 2026-07-17

Reintrodução e ampliação do bloco de comissões no lançamento de Contas a
Receber, com reflexo no Dashboard.

### Regras / dados

- **Comissão responsável**: `Vendedor.percentualComissao` (já existia).
- **Comissão de indicação** (nova): `percentualIndicacao` — campo novo em
  **Vendedor e Parceiro** (o indicador pode ser qualquer um dos dois; cliente
  não entra). Editável no cadastro (migration `20260717014815_comissao_indicacao`).
- **Indicador no título**: guardado de forma polimórfica leve no `Lancamento`
  (`indicadorTipo` VENDEDOR|PARCEIRO, `indicadorId`, `indicadorNome` snapshot).
  Sem FK — comissão é fato consumado, o nome fica gravado mesmo se o cadastro
  do indicador mudar/sumir.
- **Geração** (`gerarComissoes` em `titulos.service.ts`): ao criar título de
  Receita, gera o título de comissão do responsável (se `vendedorId`) e o de
  indicação (se indicador). Reusa as contas **6.2.2** (Comissões sobre Vendas)
  e **2.1.4** (Comissões a Pagar) — nenhuma conta nova. Vencimento dia 5 do mês
  seguinte, como antes. **Política de "quando é paga" não mudou**: a comissão é
  gerada na emissão da venda (título a pagar), e "realiza" quando esse título é
  baixado, igual a qualquer outro título — não foi criada política nova.
- **Override**: o modal calcula os valores pelo percentual mas deixa editar; ao
  criar manda `comissaoResponsavel`/`comissaoIndicacao` (valor final), que o
  serviço usa no lugar do cálculo. Comissão só é gerada/exibida na **criação**
  de Receita (fato consumado — não recalcula em edição).

### UI

- **Modal** (`TituloModal.tsx`, aba Detalhes, só Receita nova): campo Vendedor
  (responsável) + campo "Indicado por" (optgroups Vendedores/Parceiros) + bloco
  **Comissões** com os dois valores editáveis em tempo real e o total.
- **Dashboard** (`components/fx/PainelComissoes.tsx`, consome
  `GET /api/rankings/comissoes-painel`): 4 KPIs (comissões responsável /
  indicação / a pagar / pagas), ranking de vendedores por comissão (barras
  horizontais com glow, top 3 destacado, valor vendido no subtítulo) e
  mini-ranking de Indicações (indicador + badge tipo + valor).

Verificado (curl + browser): venda R$ 1.000 com João Silva (5%) + Arquiteto
Indicador parceiro (3%) → comissão responsável R$ 50 + indicação R$ 30 (total
R$ 80) no modal; painel do Dashboard some as duas por vendedor/indicador.

## Reorganização (fase de testes) — 2026-07-17

Cinco mudanças pedidas juntas:

### 1. ⚠️ Login DESATIVADO por flag (temporário)

`AUTH_ENABLED=false` no `server/.env`. Com a flag desligada, `autenticar`
(`middleware/auth.ts`) injeta um usuário mock ADMIN (`USUARIO_TESTE`, id
"modo-teste") em toda requisição e o `/me` devolve esse mock — o frontend
(`AuthProvider` agora **sempre** tenta o `/me` ao montar) entra direto, sem
tela de login. **Todo o código de auth continua intacto**: para reativar,
remova a linha do `.env` (ou "true") e reinicie o servidor. Não deixar
desligado em produção.

### 2. Modo foco removido

Botão, estado, `localStorage["erp-sidebar-foco"]` e CSS `fx-side-foco-*`
removidos da Sidebar. O acordeão normal (grupos independentes, persistidos)
continua igual.

### 3. Menu enxuto

- **Fluxo de Caixa** agora tem 6 abas: as 4 visões + **DFC** (a antiga
  `DFCPage`, embutida) + **Livro Caixa** (a antiga `LivroCaixaPage`,
  embutida). `/dfc` e `/livro-caixa` redirecionam para `/fluxo-caixa`.
- **Rankings e Metas** viraram um item só (`/rankings-metas`,
  `RankingsMetasPage` com 2 abas embutindo as páginas originais); `/rankings`
  e `/metas` redirecionam.
- **Recorrências** saiu do menu (ver item 4). A rota `/recorrencias` continua
  viva (escondida) para gerir os templates legados.
- **Cadastros** virou o item único **"Cadastro"** (ver item 5).

### 4. Recorrência integrada ao lançamento

Aba **Repetição** do modal de Contas a Pagar/Receber (só na criação): toggle
"Conta recorrente" + frequência (semanal/quinzenal/mensal/anual) + nº total de
parcelas (2–60) + prévia das datas. **Como funciona**: as parcelas futuras são
**títulos PREVISTO reais** gerados na hora (`criarTitulo` → `repeticao`),
ligados por `serieRecorrenciaId`/`parcelaNumero`/`parcelaTotal` (migration
`20260717101242_recorrencia_serie`) — por isso entram **automaticamente** em
previsões, KPIs e gráficos (que leem títulos em aberto por vencimento), sem
código extra. Na edição de uma parcela, a aba mostra "parcela X/Y" + botão
**Encerrar recorrência** (`POST /:id/encerrar-serie` — cancela as parcelas
futuras ainda PREVISTO; realizadas ficam). Comissões: cada parcela de Receita
com vendedor/indicador gera as suas (semântica por título, consistente com o
Fluxo 3). Os **templates legados** (`RecorrenciaTemplate`) continuam
funcionando (geração no load do Dashboard) — nada foi migrado/perdido; novas
recorrências devem usar a aba Repetição.

**Correção junto**: `listarTitulos` agora exclui `CANCELADO`/`REVERTIDO`
(o `excluirTransacao` é um soft-cancel — sem o filtro, títulos cancelados
apareciam como abertos na listagem rica).

### 5. Cadastro unificado (item "Cadastro")

`CadastroUnificadoPage` (`/cadastro`): lista os 6 tipos numa tela só (busca
por nome/documento, filtro "Todos os tipos", A-Z, "Mostrar inativos", badges
coloridos por tipo, seleção múltipla p/ inativar em lote) + modal "Novo
Cadastro" com **pills de tipo** (Cliente/Fornecedor/Vendedor/Colaborador/
Sócio/Parceiro) e campos específicos por tipo. **Sem migração de dados** — os
6 modelos/APIs continuam os mesmos; só a UI foi unificada. As 6 rotas antigas
redirecionam para `/cadastro?tipo=X`. As 6 páginas antigas +
`CadastroPageBase.tsx` foram **removidas**. **Comissionamento preservado**: a
seção "Comissão" (Vendedor: % responsável* + % indicação + meta; Parceiro: %
indicação) é a mesma fonte que o lançamento de Contas a Receber consome nos
campos "Vendedor" e "Indicado por" (com override pontual). Simplificações
deliberadas vs. o spec: sem CEP/endereço estruturado, sem "Aparece em", sem
tipo-pessoa CPF/CNPJ separado (campo documento livre) — candidatos a
iteração futura; o tipo não muda na edição (modelos separados por trás).

## Reestruturação do Dashboard e Comercial — 2026-07-18

Cinco mudanças pedidas juntas:

1. **Calendário Financeiro grande** (`components/fx/CalendarioFinanceiro.tsx`,
   full-width no Dashboard): grade Dom–Sáb com navegação de mês, pílulas por
   dia (+receitas verde, −despesas coral, ~transferências azul #5B9DFF), hoje
   em círculo âmbar, legenda. Backend: `GET /api/dashboard/calendario?ano&mes`
   (`calendarioFinanceiro` em `dashboard.service.ts` — caixa realizado por
   data do lançamento + títulos em aberto por vencimento, transferências só a
   perna de débito p/ não duplicar). O calendário antigo pequeno saiu do grid.
2. **Margem de Lucro substituiu o PE pequeno**: card "Margem de Lucro" no
   `fx-two-up` usa `mesAtual.margemLiquida` do DRE (resultado ÷ receita) —
   verde/coral, barra, rótulo Lucro/Prejuízo. O Ponto de Equilíbrio agora só
   existe no bloco completo (`PontoEquilibrio.tsx`) — sem duplicação. **Margem
   de Contribuição intacta** (outra métrica, segue no DRE/DFC/Fluxo).
3. **Painel de comissões refeito** (`components/fx/PainelComissoes.tsx`):
   ranking com medalhas top 3, avatar, colunas claras Faturamento × Comissão
   com barra, KPIs (total/indicação/pagas/a pagar), indicações em bloco
   próprio, filtro **Mensal/Trimestral/Semestral/Anual** (`rangeDoPeriodo`
   exportado — período civil corrente até hoje).
4. **Rankings e Metas premium**: aba **Comercial**
   (`components/comercial/ComercialView.tsx`) com top 3 destaques (avatar,
   faturamento, variação vs período anterior), KPIs do ano (faturamento,
   resultado, margem, melhor/pior mês), gráfico de faturamento (com linha do
   ano anterior tracejada), gráfico de resultado com marcadores de melhor/pior
   mês, coluna "Vendedores Destaques" (avatares grandes) e ranking
   "faturamento × meta" (barra fantasma = meta; badge % da meta; comissão a
   receber ao lado). Abas antigas preservadas (Rankings, Metas tabela).
   Backend: `GET /api/rankings/serie-comercial?ano` (`serieComercial` —
   mesma fórmula de resultado do DRE, mês a mês + ano anterior).
   **Foto de perfil**: `Vendedor.fotoUrl` (migration
   `20260718033121_vendedor_foto`, data-URL base64 até 300 KB, upload no
   Cadastro unificado quando tipo=Vendedor); `Avatar.tsx` cai para iniciais
   sem foto. `fotoUrl` exposto em `calcularMetas` e `painelComissoes`.
5. **Menu final (4 grupos, ordem fixa)**: Operacional (Contas a Receber/
   Pagar, Fluxo de Caixa) → Relatórios (DRE, Balanço, Balancete, Rankings e
   Metas) → Estrutura (**Cadastro**, Plano de Contas, Centros de Custo,
   Contas Bancárias) → Administração (Usuários). Papéis agora por **item**
   (`ItemMenu.papeis`; grupo some se nenhum item visível). Chave da ordem
   salva virou `erp-sidebar-ordem-v2` (descarta a ordem antiga uma vez para o
   novo padrão valer).

## Calendário: pop-up "Lançamentos do dia" — 2026-07-18

Clicar num dia do Calendário Financeiro abre o pop-up **"Lançamentos do dia"**
(dentro de `CalendarioFinanceiro.tsx`): 3 seções — Receitas e Despesas (resumo
Projetado × Realizado + lista com badges `recebida`/`paga`/`a receber`/
`a pagar`/`parcial`/`vencida`) e Transferências (origem → destino, azul).
Backend: `GET /api/dashboard/calendario/dia?data=` (`lancamentosDoDia` em
`dashboard.service.ts`) — **mesma composição das pílulas agregadas** (realizado
= caixa do dia; projetado = títulos em aberto por vencimento; transferências =
pares origem→destino do dia), então os números do pop-up sempre batem com a
célula. Células maiores (92px) e clicáveis (hover neon).

**Atalhos "+ Adicionar receita/despesa/transferência" reutilizam os modais
existentes** — nenhum fluxo novo: receita/despesa abrem o `TituloModal` com as
configs exportadas de `ContasReceberPage`/`ContasPagarPage` (novo prop
`dataPadrao` pré-preenche emissão+vencimento com o dia clicado);
transferência abre o `NovaMovimentacaoForm` do Livro Caixa (agora exportado,
com `dataPadrao`/`tipoPadrao`). Após salvar, invalidam-se
calendário/dashboard/contas/livro-caixa — pílula e pop-up atualizam na hora
(verificado: +R$ 8.000 → +R$ 8.777 ao lançar R$ 777 pelo atalho).

## Design System "Glass" (glassmorphism dark) — 2026-07-18

Redesign global da camada de apresentação em 5 commits (`815f38d` → `dd15450`).
Zero mudança de lógica/dados/fórmulas, com 3 exceções deliberadas: velocímetro
de score (derivação de apresentação), campo `status` por dia no calendário
(idem) e modo tela cheia.

- **Dark-only**: fundo `#000` é invariante do DS. ⚠️ **O tema claro foi
  aposentado da UI** — `index.html` e `ThemeProvider` forçam `dark`, o
  `ThemeToggle` saiu do Dashboard; o mecanismo (tokens do claro, provider,
  componente) segue no código para eventual retorno.
- **Tokens**: no bloco dark do `index.css`, `--card/--card2/--line/--border`
  viraram **alpha de vidro** (branco translúcido sobre preto) e
  `--muted/--bright` viraram **cinza neutro** (#A6A9AD/#F5F6F7 — sem tint
  verde); `--info` agora é AZUL (#7CB8FF). Tokens novos em `:root`:
  `--glass-*`, `--blur-*`, `--glass-solid` (vidro opaco p/ sticky), `--r-card/
  input/pill`, `--ease/--dur`, `--accent*`.
- **Material**: classes `.glass/.glass-elevated/.glass-subtle` (gloss + aro
  luminoso + fallback `@supports` sem backdrop-filter) e estados
  `.hoverable/.row/.is-active`. `.fx-card` É o vidro base (todo card do
  sistema herda); inputs/busca/chips/abas/botões viraram pílula com foco
  verde; kanban, sidebar e modal em vidro (overlay com blur estilo Control
  Center — `.fx-modal-overlay/.fx-modal` em `Modal.tsx`); sticky do DFC usa
  `--glass-solid` para não virar sopa visual. Tooltips de gráfico:
  `glassTooltipProps` exportado de `ChartTooltip.tsx`, usado em TODOS os
  recharts.
- **Árvore de submenus** (Sidebar): spans `fx-tree-branch`/`fx-tree-node` por
  item + CSS (vertical contínua, ramo em L, nó que acende verde no ativo);
  acordeão/drag-and-drop/colapso intactos; some no modo colapsado.
- **Velocímetro** (`components/fx/GaugeScore.tsx`, reutilizável): gauge
  semicircular 0-100 com gradiente vermelho→âmbar→verde, glow, número
  central e classificação (Excelente≥80/Boa≥60/Atenção≥40/Crítica). No card
  Saúde Financeira ao lado do radar (que segue INTACTO); score = média
  simples dos 8 eixos existentes.
- **Calendário**: campo derivado `status` por dia (`emDia/aVencer/vencido`)
  em `calendarioFinanceiro` (dashboard.service — derivado dos MESMOS títulos
  das pílulas, pior status vence) + badge circular pontual na célula.
- **Gráficos**: `Donut.tsx` virou o modelo donut+barras (donut = proporção,
  barras ranqueadas = valor absoluto com valor na ponta) — pega os dois Top 5
  do Dashboard; chips de legenda clicáveis no Receitas x Despesas (destaca
  série, esmaece a outra).
- **Modo BI** (`components/fx/FullscreenButton.tsx`): Fullscreen API + Esc,
  fallback CSS `.fx-bi-mode` na `<main>`; regras `:fullscreen` dão mais
  respiro a KPIs/títulos. Botão no Dashboard e no Fluxo de Caixa.
- `prefers-reduced-motion` global preservado; contraste AA (muted ≈ 7:1
  sobre preto; CTA texto escuro sobre neon).

### Ajustes finos (`438b995` + `8e104a2`, 2026-07-18)

- **Ícones do menu**: token `--icon-size` (20px) vale para TODOS os itens,
  recolhido e expandido (CSS vence o atributo do lucide); recolhida, cada
  item é um botão 42px quadrado centralizado.
- **Árvore compacta**: recuo 12→5px, ramo 14→7px, linha/nó em opacidade
  0.35, grip de arraste absoluto (fora do fluxo) — títulos de submenu cabem
  inteiros sem alargar a barra.
- **Branding editável** (`lib/branding.ts` + `components/BrandingModal.tsx`):
  lápis no topo da sidebar abre modal com nome/subtítulo livres, upload de
  logo PNG/SVG ≤300 KB (data-URL em `localStorage["erp-branding"]`,
  renderizada SEM fundo — `.fx-side-logo`, max-height 34px), modos
  nome/logo/logo+nome; recolhida mostra mini logo ou iniciais.
- **Fundo limpo**: `.fx-page-decor` (arco + linha neon) REMOVIDA de App.tsx
  e do CSS; glow global reduzido (`--accent-glow` 0.45→0.22 + varredura de
  18 sombras).
- **Dashboard: faixa de KPIs + grid reequilibrado** (`8e227ae`):
  `components/fx/KpiIndicador.tsx` é o template padrão de KPI (badge, valor
  mono, barra sutil, status pontual). Faixa 4×2 com 8 indicadores TODOS
  derivados no frontend de dados já carregados (mesAtual, serieMensal,
  listas /completo de títulos, templates de recorrência): Margem
  Operacional, Inadimplência, Índice de Liquidez, Prazo Médio de
  Recebimento, Ticket Médio, MRR (parcelas de série do mês + templates
  mensais ativos) e **Média de Faturamento Mensal** (Σ últimos 12 meses ÷
  12), + Saldo Projetado 30d movido para a faixa. Hierarquia: Receitas x
  Despesas é o card dominante (gráfico 320px); **Ponto de Equilíbrio virou
  card secundário** (`PontoEquilibrio` ganhou prop `compacto`) na coluna
  lateral do calendário, empilhado com Saldo por Conta e Margem de Lucro;
  as células do calendário esticam (`grid-auto-rows: 1fr`) para casar a
  altura da coluna. Obs.: com auth reativada, as listas /completo e
  /recorrencias são 403 para VENDEDOR — os KPIs derivados delas mostram "—"
  (mesma limitação da projeção do gráfico).
- **Gráficos em área spline** (`3343a9d`): o Fluxo Projetado de Contas a
  Pagar/Receber (`FluxoCaixaChart`) trocou barras por **áreas spline**
  sobrepostas (verde entradas / coral saídas, gradiente translúcido,
  marcadores com halo quando ≤16 pontos, cursor vertical + tooltip de vidro,
  marca "hoje", draw-in). As visões Realizado/Projetado/Mensal do Fluxo de
  Caixa também trocaram barras por áreas; o **DFC Gerencial mantém as barras
  divergentes de propósito** (leitura mensal por barra é melhor).
  `lib/motion.ts` expõe `animacoesAtivas` (prefers-reduced-motion para as
  animações JS do recharts — a regra CSS global não as alcança; passar em
  `isAnimationActive`). ⚠️ Recharts: label de `ReferenceLine` como OBJETO
  não renderiza de forma confiável — usar a forma por função
  `label={({ viewBox }) => <text …>}` (padrão já usado em 3 gráficos).
- **Projeção anual no Receitas x Despesas** (DashboardPage): séries
  `receitasProj/despesasProj` tracejadas do mês corrente até dezembro,
  calculadas NO FRONTEND a partir das listas `/completo` de Contas a
  Receber/Pagar (saldo em aberto por mês de vencimento — mesma previsão dos
  módulos); divisa "hoje" via ReferenceLine (rótulo via função — o objeto
  `label` não renderiza em AreaChart sem YAxis; há um `<YAxis hide />`).
- **Layout do Dashboard**: `.fx-cal-slot` (span 8) + `.fx-cal-side` (span 4)
  para Calendário + Saldo por Conta lado a lado; Top 5 em `.fx-two-up`;
  comissões em `.fx-row-full`; breakpoint 1100px empilha.

## Contas a Pagar/Receber — melhorias de 2026-07-18 (`b3de2ec`)

Cinco ajustes pedidos juntos no módulo de títulos:

1. **Janelas do Fluxo projetado** (`FluxoCaixaChart.tsx`): o seletor 7–90d
   virou **Semanal/Mensal/Trimestral/Semestral/Anual** — buckets diários
   (7/30d), semanais (13 semanas) ou mensais (6/12 meses civis à frente).
   Projeção = saldo em aberto por vencimento (recorrências entram sozinhas
   por serem títulos PREVISTO reais).
2. **Tooltip legível no escuro**: componente novo
   `components/fx/ChartTooltip.tsx` (usado no gráfico do módulo) e
   `itemStyle` claro nos 4 gráficos do Fluxo de Caixa. **Causa raiz
   documentada no componente**: o tooltip padrão do recharts pinta o texto
   dos itens com a cor da série, que fica indefinida (= preta) quando as
   barras usam `<Cell>` sem `fill` no `<Bar>` — qualquer gráfico novo nesse
   padrão deve usar `ChartTooltip` ou `itemStyle`.
3. **KPIs clicáveis** (`Indicadores.tsx` + `ContasModulo.tsx`): clicar num
   indicador ou totalizador filtra a tabela/kanban pelos títulos que compõem
   aquele número; chip ao lado da busca mostra o filtro ativo (clique de
   novo/no × limpa). A regra de pertencimento é **compartilhada** com o
   cálculo dos cards (`pertenceAoIndicador` em `helpers.ts` — `resumir` foi
   reescrita sobre ela), então card e lista nunca divergem.
4. **Edição de título liquidado por permissão**: perfis de chefia
   (**ADMIN/GERENTE** — a permissão conceitual `editar_lancamento_liquidado`,
   ver `podeEditarLiquidado` em `titulos.service.ts`) podem editar campos
   descritivos (descrição, datas, parceiro, centro de custo, metadados) de um
   título REALIZADO; **valor e contas seguem imutáveis** (corrigir valor =
   estorno + relançamento). Validação no **backend** (rota PUT passa
   `req.usuario.papel`; VENDEDOR/OPERACIONAL levam 403), UI só espelha
   (gate em `ContasModulo.abrirEdicao` + lápis oculto na tabela + campos
   desabilitados no modal). Auditoria "Editar liquidado" com snapshot
   antes/depois. De quebra, a edição normal agora persiste
   formaPagamento/projeto/previsaoPagamento (antes o zod descartava).
5. **Comissões acumuladas no Contas a Pagar**: o lançamento de Receita ganhou
   **"Pagamento da comissão previsto para"** (`dataPagamentoComissao`) — vira
   o vencimento da despesa de comissão (ausente = dia 5 do mês seguinte, como
   antes). **Regra central**: mesmo destinatário (vendedor responsável OU
   indicador) + mesma data ⇒ soma no título existente em vez de criar outro
   (`acumularOuCriarComissao`); título novo só com data/destinatário
   diferentes ou se o existente já tem baixa parcial. Rastreabilidade na
   tabela nova **`ComissaoOrigem`** (migration `20260718152102`) — o modal
   mostra "Composição da comissão" ao editar (rota
   `GET /:transacaoId/comissao-origens`). **Ajustes**: cancelar uma venda
   subtrai a parcela dela do acumulado (cancela o título se era a única —
   hook no DELETE da rota de Contas a Receber); editar o valor da venda
   reescala proporcionalmente (preserva overrides). Comissão já
   liquidada/parcialmente paga é fato consumado — não é ajustada. Comissões
   antigas (pré-`ComissaoOrigem`) não têm linhas de origem e continuam se
   comportando como antes.

Verificado: 38 testes de integração (9 novos em
`tests/comissoes-acumuladas.test.ts` — acúmulo, datas distintas, default dia
5, baixa parcial bloqueia acúmulo, cancelamento/reescala, permissão por
papel) + curl no fluxo completo (2 vendas → 1 título acumulado de R$ 150 →
cancelamentos ajustando até zerar) + navegação no browser (janelas do
gráfico, KPI clicável filtrando a tabela com chip).

## Melhorias de relatórios — 2026-07-18 (`5c5edf1`)

Três entregas pedidas juntas:

### 1. Análise horizontal (DRE, DFC, Balanço, Balancete)

- **Opt-in**: os services calculam o período anterior só quando pedido
  (`?comparar=1` na rota; no serviço, `comparar?: boolean`) — o Dashboard
  chama `calcularDRE` em loop (série de 12 meses) e não paga esse custo.
- **Regra do "período anterior"** (`periodoAnterior` em
  `relatorios.helpers.ts`): períodos alinhados ao calendário ganham a
  comparação que um contador espera — mês(es) inteiro(s) → mês(es)
  imediatamente anterior(es) (julho → junho); dia 1º até o dia X do mesmo
  mês → mês anterior até o dia X; qualquer outro intervalo → mesma duração
  terminando no ms anterior ao início.
- **Merge por id**: `mesclarValoresAnteriores` copia
  `valorProprioAnterior`/`valorTotalAnterior` para dentro da árvore do
  período atual (as duas árvores vêm da mesma lista de contas). Cada seção
  também ganha `totalAnterior` (no DFC, os escalares viram `*Anterior`).
- **Balanço é diferente**: não tem período, tem corte — a rota aceita
  `dataCorteAnterior` opcional (a tela tem um segundo date picker "Comparar
  com (opcional)"); o serviço roda `calcularPosicao` duas vezes.
- **Frontend**: checkbox "Comparar com período anterior" no DRE/DFC/
  Balancete; `StatementLine` ganhou prop `anterior` (+ `StatementHeader` e
  `DeltaPct` exportados em `StatementLine.tsx`); TreeTable do Balanço ganha
  colunas Anterior/Δ% via `colunasComparadas`. O Δ% inverte a cor em linhas
  de despesa (gastar menos = verde, prop `inverter` do `DeltaPct`).

### 2. Encerramento de exercício (Balanço)

**De apresentação, não de escrituração** — nenhum lançamento é gravado (o
razão é imutável). `calcularPosicao` (`balanco.service.ts`) separa o antigo
Resultado Acumulado em **Lucros/Prejuízos Acumulados (exercícios
anteriores)** (resultado até 31/12 do ano anterior à data de corte) e
**Resultado do Exercício** (ano civil da data de corte até ela), com uma
agregação extra. `resultadoAcumulado` continua no payload (é a soma dos
dois e o que fecha a equação fundamental); o card de PL mostra as duas
linhas novas no lugar da antiga.

### 3. Frequências de recorrência

- **Templates legados** (`RecorrenciaTemplate`): enum
  `FrequenciaRecorrencia` agora tem SEMANAL/QUINZENAL/MENSAL/TRIMESTRAL/
  ANUAL (migration `20260718142920_recorrencia_frequencias`).
  `gerarLancamentosPendentes` foi reescrita por **ocorrência**
  (`ocorrenciasDoTemplate`): grade ancorada em `dataInicio`; mensal/
  trimestral/anual lançam no dia 1º com vencimento em `diaVencimento` e
  chave "YYYY-MM"; semanal/quinzenal caem a cada 7/14 dias contados de
  `dataInicio` (o `diaVencimento` **não se aplica** — o form desabilita o
  campo) com chave "YYYY-MM-DD". As chaves são comparáveis como string
  entre si, então `ultimaCompetenciaGerada` segue idempotente mesmo se a
  frequência for editada no meio da vida. Comportamento MENSAL preservado
  byte a byte (mesmas datas e descrições de antes).
- **Série integrada** (aba Repetição do `TituloModal`): `FrequenciaSerie`
  ganhou TRIMESTRAL (backend + zod + prévia do modal).
- Verificado por curl: template semanal com início 25/06 gerou 25/06,
  02/07, 09/07 e 16/07 (hoje 18/07); segunda chamada gerou zero
  (idempotência); dados de teste removidos em seguida.

## Modelo de dados (Prisma) — visão geral

`server/prisma/schema.prisma`. Dois pontos que não são óbvios olhando só o
schema:

- `Lancamento` é a única tabela de fatos — não existem tabelas separadas
  para "títulos" ou "comissões", são todas linhas de `Lancamento` com
  `transacaoId` compartilhado entre as pernas de uma mesma transação.
- `ContaContabil`, `CentroCusto`, `Cliente`, `Fornecedor`, `Vendedor` são
  todos referenciáveis por `Lancamento` via FK opcional — nenhum é
  obrigatório exceto `contaContabilId` e `centroCustoId`.

Migrações em `server/prisma/migrations/` (`20260714222511_init` +
`20260714225737_fase3`) mais o CHECK constraint manual em
`prisma/manual/constraints.sql` (débito XOR crédito, precisa ser reaplicado
manualmente após `migrate dev` — não faz parte da migration por limitação
do Prisma, ver README).

## Testes automatizados

Adicionados em 2026-07-15, cobrindo o motor de partida dobrada
(`lancamentos.service.ts` e `titulos.service.ts`): equação fundamental,
mínimo de partidas, `centroCustoId` obrigatório, imutabilidade de
`REALIZADO`, cancelamento de `PREVISTO`, reversão, validação de grupo de
conta em títulos, liquidação (segunda transação + `tituloOrigemId`),
comissão automática, edição de título aberto. 22 testes, todos passando.

- **Framework**: Vitest. Instalado só em `server/` (backend) — o frontend
  ainda não tem testes.
- **Estratégia**: integração contra Postgres real, não mock do Prisma —
  o que mais importa provar aqui (equação fundamental, CHECK constraint) só
  se prova gravando de verdade.
- **Banco**: `erp_paisagismo_test`, separado do banco de dev
  (`erp_paisagismo`). `server/tests/setup.ts` seta `DATABASE_URL` antes de
  qualquer import de serviço (Vitest `setupFiles` garante essa ordem).
- **Arquivos**: `server/tests/helpers/fixtures.ts` (plano de contas mínimo +
  centro de custo + vendedor + conta bancária, reaproveitados em todos os
  testes de um arquivo via `beforeAll`; `Lancamento`/`AuditLog` limpos em
  `afterEach`), `server/tests/lancamentos.service.test.ts`,
  `server/tests/titulos.service.test.ts`.
- **Rodar**: `cd server && npm test` (ver README para setup do banco de
  teste na primeira vez).
- **Ainda não coberto**: `saldo.service.ts`, `relatorios.*`,
  `recorrencias.service.ts`, `plano-contas.service.ts` (herança de grupo),
  rotas HTTP (só os services foram testados diretamente, não passando pelo
  Express) — candidatos naturais para expandir a suíte depois.

## O que falta

Nada pendente de commit — **tudo que foi feito até aqui está commitado e o
working tree está limpo** (ver seção Git).

### Fase 4 (candidatos restantes)

1. ✅ ~~Autenticação real~~ — feita (`01a4544`).
2. ✅ ~~Reformulação Contas a Pagar/Receber~~ (parcial/aprovação/kanban) —
   feita (`51312fc`/`6667731`). Parte fiscal do spec (NF-e, CNAB, retenções,
   rateio, anexos) segue de fora, deliberadamente.
3. ✅ ~~Fluxo de Caixa (4 visões + DFC Gerencial + filtros)~~ — feito
   (`2556f93`/`66309cb`/`b43df17`).
4. ✅ ~~Comissões (responsável + indicação) + painel no Dashboard~~ — feitas
   (`de207c5`).
5. ⏸️ **Importação de extrato bancário (OFX/CSV)** e export **PDF/XLSX** —
   **NÃO iniciar sem perguntar ao usuário antes** (pedido explícito dele em
   2026-07-16; ele tem outras prioridades e quer decidir o momento).
6. ✅ ~~Encerramento de exercício~~ — feito em apresentação (`5c5edf1`, ver
   seção "Melhorias de relatórios"). Um encerramento *escritural* (lançamento
   de encerramento zerando resultado contra PL) segue não existindo, de
   propósito.
7. ✅ ~~Análise horizontal~~ — feita (`5c5edf1`).
8. ✅ ~~Frequências de recorrência~~ — feitas (`5c5edf1`): templates legados
   em semanal/quinzenal/mensal/trimestral/anual e TRIMESTRAL na série
   integrada.
9. DFC/DRE não categorizam movimentações Ativo↔Ativo sem conta de resultado
   associada (compra de imobilizado à vista, transferência entre bancos) —
   entram no saldo consolidado mas não aparecem detalhadas por linha. Split
   fino Investimento×Financiamento no DFC Gerencial depende disso também.
10. Expandir a suíte de testes automatizados: hoje cobre só o motor de títulos
    (29 testes). Candidatos: `saldo.service`, `relatorios.*` (inclusive
    `fluxo-caixa.service`), `recorrencias.service`, comissões de indicação,
    rotas HTTP e auth — e, quando fizer sentido, testes de frontend (zero).

## Git

Repositório **local, sem remote** (`.gitignore` cobre `node_modules/`, `.env`,
`dist/`). **Working tree limpo — tudo commitado.** Histórico (mais recente
primeiro):

- `8e227ae` Dashboard: faixa de 8 KPIs derivados e grid reequilibrado
- `ae912ec` HANDOFF: gráficos em área spline
- `3343a9d` Gráficos: Fluxo Projetado em área spline; barras→áreas no fluxo
- `04c2903` HANDOFF: ajustes finos do Glass
- `8e104a2` Ajustes finos (2/2): projeção anual no gráfico e layout do Dashboard
- `438b995` Ajustes finos (1/2): sidebar (ícones/árvore/branding) e fundo limpo
- `63848b5` HANDOFF: Design System Glass
- `dd15450` Glass DS (5/5): modo apresentação / BI em tela cheia
- `9d6d1be` Glass DS (4/5): Top 5 em donut+barras e chips de legenda
- `efddbd4` Glass DS (3/5): velocímetro de score + badges no calendário
- `a7a0ed6` Glass DS (2/5): árvore de submenus na sidebar
- `815f38d` Glass DS (1/5): tokens, material de vidro e reskin base
- `b3de2ec` Contas a Pagar/Receber: janelas do gráfico, tooltip, KPIs
  clicáveis, edição de liquidado e comissões acumuladas
- `af24644` HANDOFF: melhorias de relatórios de 2026-07-18
- `5c5edf1` Relatórios: análise horizontal, encerramento de exercício e
  frequências de recorrência
- `ee45237` Calendário: pop-up "Lançamentos do dia" com atalhos de lançamento
- `06f7c99` HANDOFF: sincroniza com a reestruturação de 2026-07-18
- `7c74b51` Dashboard e Comercial: calendário grande, Margem de Lucro,
  ranking de vendedores, Rankings e Metas premium e menu final
- `a6fd207` HANDOFF: corrige trechos defasados
- `06338bb` Fase de testes: login por flag, menu enxuto, recorrência
  integrada, Cadastro único
- `de207c5` Comissões: vendedor responsável + indicação (+ painel Dashboard)
- `6ff485b` Corrige acordeão do menu (grupo recolhido sem vão vazio)
- `b43df17` Fluxo de Caixa: filtros globais (conta/centro/parceiro)
- `66309cb` Fluxo de Caixa: Visões 1, 2 e 3
- `2556f93` Fluxo de Caixa: shell + DFC Gerencial
- `6667731` Contas a Pagar/Receber Camada 1 (frontend)
- `51312fc` Contas a Pagar/Receber Camada 2 (baixa parcial/aprovação)
- `01a4544` Fase 4: autenticação (JWT, 4 papéis)
- `2f85504` Reforma de tema escuro/claro completa
- `dfd6033` Testes automatizados do motor de partida dobrada
- `285032a` Commit inicial (Fases 1–3)

Se for continuar com Git, o próximo passo natural é `git remote add origin
<url>` e `git push` quando fizer sentido.

Identidade do autor não está configurada neste ambiente (`git config
user.name`/`user.email` vazios) — os commits usaram `-c user.name=... -c
user.email=...` inline. Se for commitar de novo, configure a identidade uma
vez ou repita o `-c` inline.

## Como retomar o trabalho rapidamente

1. `cd "D:\CLAUDE\PROJ ERP\server" && npm run dev` (garanta que o
   PostgreSQL está rodando — `Get-Service postgresql-x64-16` no PowerShell).
2. `cd "D:\CLAUDE\PROJ ERP\client" && npm run dev`.
3. Abra `http://localhost:5173` — **entra direto no Dashboard, sem login**
   (⚠️ fase de testes: `AUTH_ENABLED=false` no `server/.env`, ver seção
   "Reorganização" item 1). Com a flag reativada, cai na tela de login — use
   um usuário de demonstração (ex.: `admin@lauc.com` / `admin123`; lista na
   seção "Autenticação (Fase 4)"). O toggle de tema (sol/lua) fica no topo do
   Dashboard; preferência em `localStorage["erp-tema"]`, token em
   `localStorage["erp-token"]`.
4. Se o banco estiver vazio ou você quiser resetar os dados de demonstração:
   `cd server && npm run prisma:seed` (idempotente, limpa tudo e recria —
   inclui os 4 usuários de demonstração).
5. Leia o `README.md` para os detalhes de setup do zero (criação do banco,
   migrations, constraint manual) — **ainda não foi atualizado com a reforma
   de tema**, só reflete o estado de antes de 2026-07-16.
6. `cd server && npm test` para rodar a suíte automatizada (precisa do banco
   `erp_paisagismo_test` criado uma vez — passo a passo no README, seção
   "Testes automatizados"). `cd client && npx tsc -b` pra typecheck do
   frontend (não tem suíte de teste, só typecheck).
7. A reforma de tema está completa (ver "O que falta → Imediato" acima) —
   só falta commitar. Se for continuar o projeto pela Fase 4, veja a seção
   "Fase 4 (candidatos)" acima.

# English Glossary

> Glossário pessoal de inglês alimentado durante o consumo de vídeos (e outras
> fontes), que vira um motor de **revisão espaçada (SM-2)** e um **gerador de
> prompts** para estudar com uma IA externa — reabsorvendo as correções como
> progresso.

Projeto pessoal de uso real, com ambição de **portfólio**: o foco é qualidade de
código e decisões bem justificadas, não infraestrutura de produção. Roda local,
single-user, sem orçamento de infra. O documento de design completo (requisitos,
modelo de dados e ADRs) é a fonte da verdade: [`docs/design.md`](docs/design.md).

## O método

Assistir conteúdo em inglês sem legenda de apoio e, a cada palavra desconhecida,
pausar e registrá-la — com definição própria em EN e PT, exemplos autorais e a
fonte onde apareceu. O app acumula esse vocabulário, agenda revisões por spaced
repetition e gera as provas que alimentam a IA.

## O que já funciona

Todos os fluxos centrais, ponta a ponta, no **modo Manual** (copia-e-cola com a IA):

- **Captura (Fluxo A):** buscar palavra (case-insensitive, sem lematizar — `ramble`
  e `rambling` são entradas distintas), cadastrar palavra nova, gerir fontes e
  tipos, captura em lote pela página da fonte, reencontros, e as vistas por
  palavra e por fonte (separando novas de reencontros).
- **Revisão (Fluxo B):** fila por data de vencimento + avaliação 0–5 (SM-2).
- **Provas (Fluxo C):** ciclo de dois turnos — gerar prompt → colar na IA →
  colar a prova respondida → gerar prompt de correção → colar o JSON →
  **validar e atualizar o SRS**. Três templates: revisão semanal, vocabulário,
  compreensão de fonte (com transcrição opcional).
- **Painel (Fluxo D):** métricas (palavras por estado, fontes, revisões,
  provas) + **export/backup** do banco inteiro em JSON.

## Stack

| Camada | Escolha | Porquê (resumo dos ADRs) |
| --- | --- | --- |
| Full-stack | **Next.js (App Router) + TypeScript estrito** | Poucos fluxos + um front; Next colapsa back+front (ADR-003). Mutações via Server Actions. |
| Dados | **Prisma + SQLite** | Single-user local; o arquivo **é** o backup (ADR-002). Trocar pra Postgres = trocar o provider. |
| Validação | **Zod** | O mesmo schema define o JSON que o prompt pede e valida o que volta. |
| SRS | **SM-2** | Clássico, determinístico, testável (ADR-004). |
| Testes | **Vitest** | TDD nas regras com lógica real. |
| UI | **React + Tailwind CSS** | — |

## Arquitetura — hexagonal (ports & adapters)

As dependências apontam para dentro. O **domínio é puro** (sem I/O, sem Next, sem
Prisma; datas sempre injetadas), o que o torna testável sem banco nem rede.

```
app/ (telas + Server Actions)  ──►  src/application/ (casos de uso)
                                          │  depende só das ports
                                          ▼
                                   src/domain/ (núcleo puro)
                                   • SRS (SM-2)  • PromptBuilder
                                   • ExamResult (schema Zod)
                                   • ports (interfaces de Repository)
                                          ▲
                                          │ implementadas por
                                   src/infra/prisma/ (adapters) ──► SQLite
                                   src/infra/backup/ (export/import JSON)
```

```
src/
  domain/        núcleo puro: srs/ prompt/ exam/ model.ts ports/
  application/   casos de uso (Fluxo A–D), framework-free
  infra/prisma/  adapters Prisma (1 por agregado) + mappers
  infra/backup/  export/import JSON versionado
  server/        composition root + Server Actions
  ui/            componentes React (client)
app/             rotas (App Router)
prisma/          schema + migrations
```

## Como rodar

Pré-requisitos: **Node LTS** (testado no 24) e npm.

```bash
# 1. instalar dependências
npm install

# 2. configurar o ambiente (SQLite local)
cp .env.example .env

# 3. criar o banco e gerar o Prisma Client
npm run db:migrate

# 4. rodar em desenvolvimento
npm run dev          # http://localhost:3000
```

O banco começa **vazio**. Comece criando um tipo de fonte e uma fonte em
**Fontes → Nova fonte**; depois capture palavras pela página da fonte.

### Scripts

| Script | O quê |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js |
| `npm test` | Vitest (uma vez) |
| `npm run test:cov` | testes + cobertura |
| `npm run typecheck` | `tsc --noEmit` (estrito) |
| `npm run db:migrate` | aplica migrations (dev) |
| `npm run db:reset` | recria o banco do zero |

## Desktop (Windows)

Além de rodar via `npm run dev`, o app é distribuído como aplicativo desktop
nativo para Windows (Electron), com banco de dados **local por usuário** e
atualização automática.

**Para quem só quer usar:**

- Baixe o instalador (`English Glossary Setup <versão>.exe`) na página de
  [Releases](https://github.com/Baradelli/english-glossary/releases) do
  GitHub. Duplo clique instala sem precisar de admin e abre sozinho.
- **Aviso do SmartScreen:** o instalador não é assinado digitalmente, então na
  primeira instalação o Windows mostra "O Windows protegeu o seu PC" → clique
  em **"Mais informações"** → **"Executar assim mesmo"**. As atualizações
  automáticas seguintes **não** passam por esse aviso.
- Cada pessoa tem seu próprio banco, guardado em
  `%APPDATA%\english-glossary\glossary.db` (a pasta de dados do usuário do
  Windows).
- Funciona **100% offline**; os recursos de IA são opcionais e exigem internet
  e uma chave de API configurada na tela **Configurações** dentro do app.
- **Backup:** exporte/restaure um JSON pela tela de Configurações. Além
  disso, antes de qualquer atualização de schema o app cria automaticamente
  uma cópia de segurança (`glossary.db.bak-<data>`) ao lado do banco.
- **Atualizações:** o app verifica novas versões toda vez que abre e instala
  ao reiniciar ou fechar.

**Para quem desenvolve:**

| Script | O quê |
| --- | --- |
| `npm run desktop:dev` | janela Electron sobre o `npm run dev` (rodando à parte), com HMR |
| `npm run desktop:preview` | build completo do app empacotado, aberto sem gerar instalador |
| `npm run desktop:build` | gera o instalador NSIS em `release/` |
| `npm run desktop:publish` | build + publica um draft release no GitHub (exige `GH_TOKEN` com escopo `repo`) |

Variáveis de ambiente: `GLOSSARY_DB_PATH` (sobrescreve o caminho do banco,
usado em testes) e `GLOSSARY_DEV_URL` (uso interno do `desktop:dev`).

**Checklist de release:**

1. Suba a `version` no `package.json`.
2. Faça o commit.
3. Rode `GH_TOKEN=<token> npm run desktop:publish`.
4. Confira no GitHub se o draft release tem o `.exe`, o `latest.yml` e o `.blockmap`.
5. Publique o release (tirar do modo draft).
6. Os apps já instalados atualizam sozinhos no próximo boot.

> Os assets do release precisam estar **públicos** (repositório público) para
> o auto-update funcionar — o `electron-updater` lê `latest.yml`/`.exe`
> anonimamente, sem autenticação.

## Testes

TDD: teste primeiro, ver falhar, implementar. **149 testes** (Vitest), **100% de
statements/lines/functions** no domínio + aplicação + infra. As poucas
ramificações não cobertas são guards defensivos para estados que as foreign keys
(`onDelete: Cascade`) tornam impossíveis.

- **Domínio** — testado puro, sem I/O, com datas injetadas (determinístico).
- **Repositórios e casos de uso** — testados por **integração contra um SQLite
  real** recriado a cada execução (`test/global-setup.ts`); mockar o banco não
  testaria nada, já que o repositório *é* o I/O.
- **UI / Server Actions** — não têm teste unitário por opção: a lógica vive nos
  casos de uso (testados); a UI é fina e foi verificada por `next build` +
  smoke test de runtime.

## Decisões que valem nota

- **SM-2 "clássico":** o ease factor é recalculado em toda revisão; errar (qualidade
  &lt; 3) zera as repetições e encurta o intervalo. O estado (nova/aprendendo/
  dominada) é **derivado** dos campos SRS, nunca uma coluna (§6.1).
- **Provas em dois turnos:** o prompt-pergunta só pede que a IA *apresente* a
  prova; só o prompt-correção pede o JSON estrito — validado pelo mesmo schema Zod.
- **Acerto → qualidade SM-2:** acerto = 5, erro = 2 (mapeamento do booleano da
  correção para a escala 0–5).
- **SQLite sem `Json`/arrays:** `examples` e `resultJson` são colunas `String` com
  JSON serializado nos mappers; dedup case-insensitive via colunas normalizadas
  (`termKey`/`nameKey`).
- **IA via port (`AiProvider`):** o modo Manual (copia-e-cola, custo zero) é o
  padrão; o **`ApiAdapter` opt-in** (ativado por `ANTHROPIC_API_KEY`) corrige a
  prova automaticamente via API, sem tocar no domínio. Modelo configurável por
  `ANTHROPIC_MODEL` (padrão `claude-opus-4-8`).

## Limitações conhecidas / evolução

- **Deploy:** o alvo é local. Um demo na Vercel exigiria trocar o provider do
  Prisma para Postgres (o filesystem serverless não persiste SQLite) — previsto
  em ADR-002 / §9, mas fora do escopo atual.
- **Import de backup:** o `importAll` existe e é testado, mas ainda **sem tela**
  (assume banco vazio). O export (download) é a rede de segurança principal.

---

Feito por Vitor. Decisões e trade-offs detalhados em [`docs/design.md`](docs/design.md).

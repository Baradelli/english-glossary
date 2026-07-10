<div align="center">

# English Glossary

**Capture o vocabulário das fontes que você consome, revise com repetição espaçada (SM-2)
e comprove em provas de múltipla escolha geradas por IA — offline, com seus dados só no seu PC.**

### [🌐 Site & download](https://baradelli.github.io/english-glossary/) · [⬇️ Baixar para Windows](https://github.com/Baradelli/english-glossary/releases/latest) · [📐 Documento de design](docs/design.md)

![Windows](https://img.shields.io/badge/Windows-10%2F11-0078D6?logo=windows&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-15-000000?logo=nextdotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![Electron](https://img.shields.io/badge/Electron-43-47848F?logo=electron&logoColor=white)
![Tests](https://img.shields.io/badge/tests-passing-3fb950)
![Offline](https://img.shields.io/badge/offline-first-1d4ed8)

</div>

---

**English Glossary** é um app de desktop (Windows) para quem estuda inglês com conteúdo real —
vídeos, livros, podcasts. A cada palavra ou expressão nova, você a registra **com a frase em que
apareceu**; o app acumula esse vocabulário, agenda revisões por repetição espaçada e gera provas
para você comprovar o que aprendeu.

Projeto pessoal de uso real, também pensado como **portfólio**: o foco é qualidade de código e
decisões bem justificadas. Roda local, single-user, sem infraestrutura de nuvem. O documento de
design completo (requisitos, modelo de dados e ADRs) é a fonte da verdade:
[`docs/design.md`](docs/design.md).

## O método

1. **Registre a fonte** — o vídeo, o livro, o podcast onde você encontrou o inglês.
2. **Capture com contexto** — salve a palavra/expressão junto com a frase original; reencontros em
   outras fontes são registrados como tal.
3. **Revise no ritmo certo** — o SM-2 agenda cada verbete; a revisão acontece ao responder provas.
4. **Prove que aprendeu** — gere provas do seu próprio vocabulário e receba correção com nota; os
   erros voltam para a prática.

## 📥 Instalação (Windows)

Para **usar o app** (não precisa de Node nem de nada técnico):

1. Baixe o instalador na página do **[site oficial](https://baradelli.github.io/english-glossary/)**
   ou direto nas **[Releases](https://github.com/Baradelli/english-glossary/releases/latest)**
   (`English-Glossary-Setup-<versão>.exe`).
2. Dê **duplo clique** — instala sem exigir permissão de administrador e abre sozinho.
3. Na primeira vez, o Windows pode mostrar **"O Windows protegeu o seu PC"** (SmartScreen, porque o
   instalador não tem assinatura digital paga). Clique em **"Mais informações" → "Executar assim
   mesmo"**. As atualizações seguintes **não** passam por esse aviso.

> **Requisitos:** Windows 10 ou 11 (64 bits). Gratuito, sem cadastro.

Detalhes importantes:

- **100% offline.** Captura, revisão (SRS) e painel funcionam sem internet. Só as **provas**
  dependem da IA (veja abaixo).
- **Seus dados ficam com você**, num banco SQLite local em
  `%APPDATA%\english-glossary\glossary.db`. Nada de nuvem, nada de conta. Desinstalar o app não
  apaga seus dados.
- **Backup:** exporte/restaure tudo em um arquivo JSON pela tela **Configurações**. Antes de
  qualquer atualização de schema, o app também cria uma cópia automática (`glossary.db.bak-<data>`).
- **Atualização automática:** ao abrir, o app verifica se há versão nova, baixa em segundo plano e
  aplica ao reiniciar ou fechar.
- **IA opcional, chave sua:** as provas são geradas pela IA da Anthropic. Cole a **sua** chave de
  API na tela **Configurações** para habilitá-las (a chave nunca sai do seu computador). Sem chave,
  todo o resto do app funciona normalmente.

## 🚀 Como usar

Depois de instalar, o fluxo do dia a dia é:

1. **Crie uma fonte** em **Fontes → Nova fonte** (ex.: um vídeo do YouTube), dentro de um tipo de
   fonte (Vídeo, Livro, Podcast…).
2. **Capture vocabulário** pela página da fonte: digite a palavra/expressão e a frase em que ela
   apareceu. Não sabe a definição? Com a chave de IA configurada, o app preenche EN/PT e exemplos;
   sem ela, você copia um prompt pronto para colar em qualquer IA e traz a resposta de volta.
3. **Faça provas** em **Provas**: gere uma **revisão semanal** (o que você capturou nos últimos 7
   dias) ou uma **prova de vocabulário** (amostra ponderada, que favorece as palavras difíceis). A
   IA escreve as questões de múltipla escolha e o app corrige na hora. Ao finalizar, cada questão
   pode ser expandida para explicar por que **cada alternativa** está certa ou errada; dali você
   também pode guardar uma observação editável no verbete. Errou algumas? Um clique gera uma
   **prática só dos erros**.
4. **Acompanhe a evolução** no **Painel**: sequência de dias de estudo (streak), calendário de
   atividade, previsão de revisões dos próximos 7 dias, crescimento do vocabulário, tendência das
   notas e as palavras em que você mais erra.

> A repetição espaçada (SM-2) roda nos bastidores: cada resposta de prova atualiza o agendamento da
> palavra (acerto → qualidade 5, erro → 2), então **estudar = fazer provas**.

## ✨ Recursos

- **Captura com contexto.** Busca case-insensitive e sem lematizar (`ramble` e `rambling` são
  entradas distintas), captura em lote pela fonte, reencontros, e vistas por palavra e por fonte
  (separando palavras novas de reencontros).
- **Revisão por repetição espaçada (SM-2).** O agendamento (intervalo, ease, próxima revisão) é
  alimentado ao responder provas; o estado da palavra (nova / aprendendo / dominada) é **derivado**
  dos campos SRS, nunca uma coluna.
- **Provas de múltipla escolha geradas por IA.** O app escolhe os verbetes; a IA escreve as
  questões (com uma justificativa por alternativa); o app valida o JSON, embaralha cada par
  alternativa + justificativa e **corrige localmente**. A revisão final é expansível, a prova é
  retomável, a nota é computada pelo app e a prática cobre só os erros. A **prova de compreensão de
  uma fonte** mantém o ciclo manual de copiar/colar com IA (com transcrição opcional).
- **Observações acumuladas no glossário.** Palavras e expressões recebem contexto incremental,
  inclusive a partir da revisão de provas; esse material passa a enriquecer prompts futuros e faz
  parte do backup.
- **Painel com dashboards.** Faixa "hoje", heatmap de atividade, previsão de 7 dias, crescimento do
  vocabulário, tendência de notas e ranking de palavras difíceis (Recharts), tema claro/escuro, e
  export/backup do banco em JSON.

## 🧑‍💻 Para desenvolvedores

Pré-requisitos: **Node LTS** (testado no 24) e npm.

```bash
git clone https://github.com/Baradelli/english-glossary.git
cd english-glossary

npm install          # dependências
cp .env.example .env # ambiente (SQLite local)
npm run db:migrate   # cria o banco e gera o Prisma Client
npm run dev          # http://localhost:3000
```

O banco começa **vazio** — comece criando um tipo de fonte e uma fonte em **Fontes → Nova fonte**.
Para habilitar a IA em desenvolvimento, defina `ANTHROPIC_API_KEY` no `.env` (veja o `.env.example`).

### Scripts

| Script | O quê |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js |
| `npm test` / `npm run test:cov` | Vitest (uma vez / com cobertura) |
| `npm run typecheck` | `tsc --noEmit` (estrito) |
| `npm run db:migrate` / `db:reset` | aplica migrations / recria o banco |
| `npm run desktop:dev` | janela Electron sobre o `npm run dev`, com HMR |
| `npm run desktop:preview` | app empacotado, aberto sem gerar instalador |
| `npm run desktop:build` | gera o instalador NSIS em `release/` |
| `npm run desktop:publish` | build + publica um draft release no GitHub (exige `GH_TOKEN`) |

Variáveis de ambiente extras: `GLOSSARY_DB_PATH` (sobrescreve o caminho do banco, usado em testes) e
`GLOSSARY_DEV_URL` (uso interno do `desktop:dev`).

### Publicar uma nova versão

1. Suba a `version` no `package.json` e faça o commit.
2. `GH_TOKEN=<token> npm run desktop:publish` (token com escopo `repo`).
3. Confira no GitHub se o draft release tem o `.exe`, o `latest.yml` e o `.blockmap`.
4. Publique o release (tirar do modo draft) — os apps instalados atualizam sozinhos no próximo boot.

> Os assets do release precisam estar **públicos** para o auto-update funcionar: o `electron-updater`
> lê `latest.yml`/`.exe` anonimamente.

## 🏛️ Arquitetura — hexagonal (ports & adapters)

As dependências apontam para dentro. O **domínio é puro** (sem I/O, sem Next, sem Prisma; datas
sempre injetadas), o que o torna testável sem banco nem rede.

```
app/ (telas + Server Actions)  ──►  src/application/ (casos de uso)
                                          │  depende só das ports
                                          ▼
                                   src/domain/ (núcleo puro)
                                   • SRS (SM-2)   • quiz (geração/correção)
                                   • insights     • ports (Repository)
                                          ▲
                                          │ implementadas por
                                   src/infra/prisma/ (adapters) ──► SQLite
                                   src/infra/ai/     (AiProvider) ──► Claude API
                                   src/infra/backup/ (export/import JSON)
```

```
src/
  domain/        núcleo puro: srs/ quiz/ insights/ prompt/ model.ts ports/
  application/   casos de uso (Fluxo A–D), framework-free
  infra/prisma/  adapters Prisma (1 por agregado) + mappers
  infra/ai/      AiProvider (ApiAdapter opt-in)
  infra/backup/  export/import JSON versionado
  server/        composition root + Server Actions
  ui/            componentes React (client)
app/             rotas (App Router)
prisma/          schema + migrations
```

## 🧰 Stack

| Camada | Escolha | Porquê (resumo dos ADRs) |
| --- | --- | --- |
| Full-stack | **Next.js (App Router) + TypeScript estrito** | Poucos fluxos + um front; Next colapsa back+front (ADR-003). Mutações via Server Actions. |
| Desktop | **Electron** | App nativo por usuário, offline, com auto-update. |
| Dados | **Prisma + SQLite** | Single-user local; o arquivo **é** o backup (ADR-002). Trocar pra Postgres = trocar o provider. |
| Validação | **Zod** | Valida o JSON que a IA devolve antes de qualquer persistência. |
| SRS | **SM-2** | Clássico, determinístico, testável (ADR-004). |
| IA | **Port `AiProvider`** (ApiAdapter opt-in) | Desacopla a capacidade de IA do provedor; a chave é do usuário (ADR-001). |
| Gráficos | **Recharts** + heatmap próprio | Lib mais popular de charts p/ React (ADR-008); calendar heatmap não existe nela. |
| Testes | **Vitest** | TDD nas regras com lógica real. |

## ✅ Testes

TDD: teste primeiro, ver falhar, implementar. A suíte Vitest mantém cobertura de **~99,8% de
statements/lines** e **100% de functions** no domínio + aplicação + infra. As poucas ramificações
não cobertas são guards defensivos para estados que as foreign keys (`onDelete: Cascade`) tornam
impossíveis.

- **Domínio** — testado puro, sem I/O, com datas/semente injetadas (determinístico).
- **Repositórios e casos de uso** — testados por **integração contra um SQLite real** recriado a
  cada execução; mockar o banco não testaria nada, já que o repositório *é* o I/O.
- **UI / Server Actions** — sem teste unitário por opção: a lógica vive nos casos de uso (testados);
  a UI é fina e é verificada por `next build` + smoke test de runtime.

## 💡 Decisões que valem nota

- **SM-2 "clássico".** O ease factor é recalculado em toda revisão; errar (qualidade &lt; 3) zera as
  repetições e encurta o intervalo. O estado da palavra é **derivado** dos campos SRS, nunca uma
  coluna.
- **Prova gerada pela IA, corrigida localmente (ADR-009).** O app decide _quais_ verbetes entram na
  prova e a IA escreve as questões de múltipla escolha (com explicação); o app valida o JSON (Zod),
  reembaralha as alternativas — o índice correto nunca vaza pela posição — e corrige sozinho.
  Restringir a só múltipla escolha torna a correção trivial e à prova de ambiguidade, então
  terceirizar a _geração_ não custa a _correção verificável_.
- **Revisão pelas provas (ADR-010).** Uma tela dedicada de revisão card-a-card existiu, mas era um
  segundo caminho para a mesma mutação SM-2; foi aposentada. O agendamento, o histórico
  (`ReviewLog`) e a due-ness continuam íntegros — só a superfície redundante saiu.
- **Dia local injetado.** Heatmap, streak e previsão bucketizam por dia civil no fuso do usuário
  (offset injetado nas funções puras de `src/domain/insights/`), nunca por dia UTC.
- **SQLite sem `Json`/arrays.** `examples`, `options` e `resultJson` são colunas `String` com JSON
  serializado nos mappers; dedup case-insensitive via colunas normalizadas (`termKey`/`nameKey`).
- **IA via port (`AiProvider`).** O `ApiAdapter` opt-in (ativado por `ANTHROPIC_API_KEY`) fala com a
  Claude API sem tocar no domínio; modelo configurável por `ANTHROPIC_MODEL` (padrão
  `claude-opus-4-8`).

## 🔭 Limitações conhecidas / evolução

- **Deploy web.** O alvo é local. Um demo na Vercel exigiria trocar o provider do Prisma para
  Postgres (o filesystem serverless não persiste SQLite) — previsto em ADR-002 / §9, fora do escopo
  atual.
- **Import de backup.** O `importAll` existe e é testado, mas ainda **sem tela** (assume banco
  vazio). O export (download) é a rede de segurança principal.

---

<div align="center">

Feito por **[Vitor Baradelli](https://github.com/Baradelli)** ·
[Site](https://baradelli.github.io/english-glossary/) ·
[Decisões & trade-offs](docs/design.md)

</div>

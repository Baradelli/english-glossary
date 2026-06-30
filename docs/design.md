# English Glossary — Documento de Design

**Status:** rascunho · **Autor:** Vitor · **Data:** 19/06/2026

> Glossário pessoal de inglês alimentado durante o consumo de vídeos do YouTube, que se transforma num motor de revisão por spaced repetition e geração de prompts de estudo para uma IA externa.

---

## 1. Contexto e problema

O método de estudo é deliberadamente "hard": assistir vídeos em inglês sem legenda/tradução de apoio e, a cada palavra desconhecida, pausar e ir ao glossário. Hoje esse fluxo não tem ferramenta — anotações soltas não acumulam progresso nem viram revisão estruturada.

O app resolve isso sendo o repositório central do vocabulário aprendido (com definição própria em EN e PT, exemplos autorais e os vídeos onde a palavra apareceu), o motor de revisão espaçada desse vocabulário, e o gerador dos prompts que alimentam uma IA externa para provas e revisões — fechando o ciclo ao reabsorver os resultados dessas provas como dados de progresso.

**Tipo de projeto:** pessoal (uso real do próprio Vitor) com ambição de **portfólio**. As duas coisas convivem porque "portfólio" aqui significa **qualidade de código e decisões bem justificadas**, não infraestrutura de produção. Um recrutador deve conseguir clonar, rodar local e ler um repositório limpo; não há requisito de multiusuário, escala ou alta disponibilidade.

**Restrições:** solo dev; roda **local single-user**; sem orçamento de infra recorrente. A IA externa é, por padrão, acessada via **copia-e-cola manual** (sem custo), porque o plano de chat do Claude não inclui acesso programático à API — esta é cobrada à parte, por token, numa conta de API separada.

## 2. Objetivos e não-objetivos

**Objetivos (v1):**

- Registrar palavras com definição EN, definição PT e frases de exemplo autorais, vinculadas às fontes onde foram encontradas (relação N:N — uma palavra pode reaparecer em várias fontes). Uma **fonte** é genérica: vídeo, filme, documento, livro, etc., com tipo gerenciável.
- Buscar uma palavra no glossário: se existe, mostrar definição/exemplos/fontes; se não, abrir o fluxo de cadastro.
- Agendar revisão das palavras por **spaced repetition real** (algoritmo SM-2), com datas de próxima revisão e sessões de revisão.
- Gerar **prompts** (revisão semanal, prova de vocabulário, prova de compreensão de uma fonte) a partir dos dados, num formato que instrui a IA a responder em **JSON estruturado**.
- Reabsorver o resultado colado (JSON validado): extrair nota e palavras acertadas/erradas e atualizar o agendamento SRS e as métricas.
- Dashboard de progresso: nº de palavras por estado, nº de fontes, palavras revisadas, histórico de provas.
- **Export/backup** do banco inteiro para JSON versionável.

**Não-objetivos (v1):**

- **Sem multiusuário e sem autenticação** — single-user local; isso elimina toda uma categoria de complexidade (sessões, RBAC, isolamento de dados).
- **Sem integração automática com a API do YouTube (ou qualquer fonte)** — a fonte é registrada por nome (e URL opcional) manualmente; nada de OAuth nem download de legendas.
- **Sem app mobile / sem PWA offline** — uso no navegador desktop.
- **Sem geração de áudio/pronúncia, sem OCR, sem captura automática de palavras** — a captura é manual e intencional (faz parte do método).
- **API de IA não é o caminho padrão** — fica como adapter plugável opcional, não como dependência de v1.

**Fluxo de maior risco** (o que, se não funcionar, mata o produto): o **ciclo de prova** — gerar prompt → colar na IA → trazer JSON → validar → atualizar progresso. É onde mora a lógica não-trivial e o contrato com um sistema externo. O design deve de-riscar isso primeiro.

## 3. Requisitos funcionais

Organizados pelos três fluxos centrais.

**Fluxo A — Captura de vocabulário a partir de uma fonte.**

- _Buscar palavra_ (ator: Vitor). Dado um termo, retorna a entrada existente (definições, exemplos, fontes vinculadas) ou sinaliza "não existe". A busca compara em **lowercase** (não duplica por capitalização), mas **não lematiza**: formas flexionadas distintas ("ramble", "rambling") são entradas separadas de propósito — representam usos diferentes que você quer estudar separadamente. Aceite: busca por forma exata, case-insensitive, em tempo imperceptível.
- _Gerenciar fonte e tipos_. Cadastrar uma `Source` com `name` (obrigatório), `url` (opcional) e `sourceType` (escolhido de uma lista gerenciável de `SourceType` que o usuário popula: vídeo, filme, doc, livro...). Aceite: fonte não duplica por URL quando há URL; tipos não duplicam por nome.
- _Cadastrar palavra nova_. O sistema pede definição EN, definição PT e ≥1 frase de exemplo autoral; vincula à fonte atual com a data e a frase de contexto opcional, criando um `WordSighting` marcado como primeiro encontro. Aceite: palavra persiste com campos obrigatórios e ≥1 `WordSighting`.
- _Captura em lote pela página da fonte_. A página de uma `Source` funciona como contexto ativo: estando nela, posso adicionar várias palavras seguidas já vinculadas àquela fonte, **sem recolar a URL/identificação**. Aceite: N palavras adicionadas pela página da fonte geram N sightings naquela fonte.
- _Registrar reencontro_. Ao encontrar uma palavra existente no contexto de uma fonte, o sistema registra um novo `WordSighting` (marcado como reencontro). Aceite: a mesma palavra passa a listar N fontes; a contagem de encontros reflete a frequência real.

**Fluxo A2 — Visualizações (por palavra e por fonte).**

- _Vista por palavra_. Lista/busca o glossário; ao abrir uma palavra, mostra definições, exemplos autorais, estado SRS, e todas as fontes onde apareceu com a frase de contexto de cada uma.
- _Vista por fonte_. Lista as fontes (filtrável por `SourceType`); ao abrir uma fonte, mostra o que aprendi nela — separando **palavras novas** (cadastradas ali) de **reencontros** (palavras que eu já sabia) —, a contagem, e atalho para gerar a prova de compreensão (Template 3) daquela fonte. Aceite: a separação novas/reencontros bate com a flag `isFirstEncounter` dos sightings.

**Fluxo B — Revisão por spaced repetition.**

- _Iniciar sessão de revisão_. O sistema seleciona as palavras com `nextReview <= hoje`. Aceite: a fila respeita as datas de agendamento.
- _Avaliar lembrança_. Para cada palavra, Vitor informa quão bem lembrou (qualidade 0–5, padrão SM-2); o sistema recalcula intervalo, fator de facilidade e `nextReview`. Aceite: dado um histórico de avaliações, os intervalos seguem o SM-2 de forma determinística (testável sem UI).

**Fluxo C — Provas com IA externa (o ciclo de maior risco).**

- _Gerar prompt_. A partir de um conjunto de palavras (as aprendidas na semana, ou as de uma fonte específica) o sistema monta um prompt de texto que (a) lista as palavras/contexto e (b) **instrui a IA a responder estritamente num JSON com schema fixo** (nota, acertos, erros, feedback). Tipos de prompt em v1: revisão semanal, prova de vocabulário, prova de compreensão de fonte. Aceite: o prompt gerado é copiável e contém o schema-alvo explícito.
- _Submeter resultado_. Vitor cola o JSON devolvido pela IA; o sistema **valida contra o schema** e, se válido, persiste a prova e atualiza o SRS das palavras erradas (reduz intervalo) e métricas. Se inválido, mostra erro de validação sem corromper dados. Aceite: JSON fora do schema é rejeitado com mensagem clara; JSON válido atualiza progresso de forma idempotente.

**Fluxo D — Progresso e dados.**

- _Dashboard_. Métricas: palavras por estado (nova/aprendendo/dominada conforme SRS), total de fontes, palavras revisadas no período, histórico/nota das provas. Aceite: números batem com o banco.
- _Export/backup_. Exporta todo o banco para um JSON. Aceite: o JSON exportado, reimportado num banco vazio, reconstrói o estado.

## 4. Requisitos não-funcionais

| Categoria                      | Alvo / decisão                                                                                     | Implicação no design                                                                                                            |
| ------------------------------ | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Performance / latência         | Não é preocupação no v1 (local, single-user, dado pequeno)                                         | Nenhuma otimização especial; sem cache                                                                                          |
| Escala / carga                 | Não aplica — 1 usuário, milhares de registros no máximo                                            | SQLite é mais que suficiente; nada de connection pooling                                                                        |
| Disponibilidade                | Downtime irrelevante                                                                               | Sem HA, sem health checks elaborados                                                                                            |
| **Consistência / integridade** | **Crítico** — o glossário é um ativo de meses; perda = projeto morto                               | Banco = fonte da verdade num arquivo; **export/backup JSON como feature de 1ª classe**; escritas do ciclo de prova idempotentes |
| Segurança                      | Sem superfície (local single-user). Único cuidado: chave da API (se ativada) fora do versionamento | `.env` para segredos; nada de auth/RBAC                                                                                         |
| Privacidade / LGPD             | Não aplica — dado é só do próprio usuário, na máquina dele                                         | —                                                                                                                               |
| Observabilidade                | Logs simples bastam; alerta/tracing seria teatro                                                   | `console`/logger leve; sem stack de observabilidade                                                                             |
| **Manutenibilidade / testes**  | **Importante** — solo, vida longa, é portfólio. TDD nas regras com lógica real                     | Domínio (SM-2, montagem de prompt, parse/validação de JSON) **isolado de I/O**, testável sem banco nem rede (Vitest)            |
| Custo                          | Zero recorrente no modo padrão. Adapter de API: ~centavos por prova se ativado                     | Modo Manual default; API opt-in                                                                                                 |
| Deploy / operação              | Roda local (`next dev`/`next start`). Deploy demo opcional na Vercel para portfólio                | Sem pipeline complexo; um README de "como rodar"                                                                                |

## 5. Arquitetura

**Estilo: monólito modular Next.js com núcleo de domínio hexagonal (ports & adapters).** Justificativa amarrada aos NFRs: o app é "alguns fluxos + um frontend", então separar API (Fastify) de front (React) só adicionaria partes móveis sem benefício — Next.js colapsa os dois. A camada hexagonal não é firula: ela cai direto de dois NFRs — **testabilidade** (domínio sem I/O) e da decisão de manter a **IA como dependência intercambiável** (Manual ↔ API).

```
┌─────────────────────────────────────────────┐
│  Next.js (App Router)                         │
│                                               │
│  UI (React)  ──►  API Routes / Server Actions │
│                          │                    │
│                          ▼                    │
│            ┌──────────────────────────┐       │
│            │   Núcleo de domínio       │  ◄── puro, testável, sem I/O
│            │  • SRS (SM-2)             │       │
│            │  • PromptBuilder          │       │
│            │  • ExamResultParser+Schema│       │
│            │  • Métricas               │       │
│            └──────────────────────────┘       │
│               │ (ports)        │ (port)        │
│               ▼                ▼               │
│        ┌────────────┐   ┌──────────────┐      │
│        │ Repository │   │  AiProvider   │      │
│        │ (Prisma)   │   │  port         │      │
│        └────────────┘   └──────────────┘      │
│               │            ╱        ╲          │
│               ▼          ▼            ▼         │
│           SQLite   ManualAdapter   ApiAdapter  │
│                    (gera prompt/   (chama a    │
│                     recebe cole)    API, opt-in)│
└─────────────────────────────────────────────┘
```

**Limites e dependências:** a UI fala com API routes/server actions; estas orquestram casos de uso que dependem **do domínio e das ports**, nunca de implementações concretas. O domínio não conhece Prisma, Next nem rede. As dependências apontam para dentro (regra hexagonal).

**Concerns transversais:**

- _Validação:_ Zod. O **mesmo schema Zod** define o JSON que o prompt pede à IA e valida o que volta — contrato único para os dois adapters.
- _Tratamento de erro:_ erros de validação de prova viram resposta 4xx com mensagem; nunca corrompem o banco (a escrita só ocorre após validação).
- _Background jobs:_ nenhum. O "relatório semanal" é gerado sob demanda quando Vitor pede — não há scheduler. (Decisão consciente: cron seria infra desnecessária para single-user local.)
- _Transações:_ a submissão de resultado de prova (gravar prova + atualizar N palavras) roda numa transação Prisma, para integridade.

## 6. Modelo de dados (esboço)

Entidades centrais e o ponto difícil (N:N + agendamento SRS):

- **Word** — `id`, `term`, `definitionEn`, `definitionPt`, `examples` (frases **autorais** que você escreve ao cadastrar — seu domínio ativo; distintas da frase real da fonte, que vive em `WordSighting.contextSentence`), campos SRS: `easeFactor`, `intervalDays`, `repetitions`, `nextReview`, `createdAt`. O **estado** (nova/aprendendo/dominada) **não é coluna** — é derivado dos campos SRS (ver §6.1).
- **Source** (antes "Video") — qualquer fonte de onde você extrai vocabulário: vídeo, filme, documento, livro, etc. Campos: `id`, `name` (**obrigatório**), `url?` (**opcional** — livro não tem URL), `sourceTypeId`, `createdAt`. URL, quando presente, é única.
- **SourceType** — lista gerenciável de tipos (`id`, `name`). Você popula na mão (vídeo, filme, doc, livro...). Permite filtrar o glossário por tipo de fonte sem risco de duplicata ("livro" vs "Livro").
- **WordSighting** — junção N:N que carrega semântica: `wordId`, `sourceId`, `seenAt`, `contextSentence?` (a frase real da fonte onde a palavra apareceu — opcional), `isFirstEncounter` (marca se a palavra foi **cadastrada** nesta fonte vs. **reencontrada** — usado para separar "novas vs. reencontros" na página da fonte). É a tabela que captura "reencontros" e alimenta a métrica de frequência. (Uma palavra tem muitos sightings; uma fonte tem muitos sightings.) Cada encontro guarda **sua própria** frase de contexto, então a mesma palavra pode listar várias frases reais, uma por fonte.
- **ReviewLog** — histórico de cada avaliação SRS: `wordId`, `quality` (0–5), `reviewedAt`, snapshot do intervalo resultante. Permite reconstruir/auditar o agendamento.
- **Exam** — prova em **fluxo de dois turnos** com histórico completo. Campos: `id`, `type` (semanal/vocabulário/compreensão), `sourceId?` (quando é prova de compreensão de uma fonte), `status` (`gerada` → `respondida` → `corrigida`), e três artefatos de texto: `promptText` (prompt-pergunta gerado), `answersText` (a prova + minhas respostas, colada de volta), `correctionPrompt` (prompt-correção gerado), `resultJson` (o JSON final validado), `score`, `createdAt`. Liga-se às palavras avaliadas via **ExamWord** (`examId`, `wordId`, `correct`), preenchida no passo de correção a partir do `resultJson` — é o que atualiza o SRS no fluxo C.

Os pontos que exigem cuidado: WordSighting (N:N com atributo), a transação do ExamResult que atualiza múltiplas Words, e a máquina de estados de `Exam` (a escrita do `resultJson`/`ExamWord` só ocorre na transição para `corrigida`, após validação Zod).

### 6.1 Derivação do estado da palavra (nova / aprendendo / dominada)

Regra de leitura sobre os campos SRS, sem coluna dedicada (segue a convenção do Anki para graduação de cartões):

| Estado         | Condição                                                                  |
| -------------- | ------------------------------------------------------------------------- |
| **Nova**       | `repetitions == 0` (nascem aqui; nunca passaram por revisão bem-sucedida) |
| **Aprendendo** | `repetitions >= 1` **e** `intervalDays < 21`                              |
| **Dominada**   | `intervalDays >= 21` (SM-2 já espaçou para >~3 semanas)                   |

Errar uma palavra na prova zera `repetitions` e encurta o intervalo — então uma palavra pode **regredir** de "dominada" para "aprendendo". Comportamento correto; o dashboard deve refletir.

### 6.2 Templates de prompt e schema de resposta

Os três templates compartilham o **mesmo schema JSON de correção**, validado por um único Zod. Só o corpo (a tarefa pedida à IA) muda. Todas as provas são em **dois turnos**: o sistema gera o prompt-pergunta; você cola na IA; responde na própria conversa; cola a prova+respostas de volta no sistema; o sistema gera o prompt-correção; você cola; a IA devolve o JSON final.

**Schema de correção (comum aos três, alvo do Zod):**

```json
{
  "score": 0,
  "items": [{ "term": "string", "correct": true, "note": "string" }],
  "feedback": "string"
}
```

`score` 0–100; `items[].term` deve casar com as palavras enviadas; `correct` alimenta `ExamWord` e o SRS; `note`/`feedback` são texto livre exibido.

**Template 1 — Revisão semanal.** Corpo: tutor monta prova mista (tradução, completar frase, uso em contexto) com as palavras da semana, variando o tipo de questão.

**Template 2 — Prova de vocabulário.** Corpo: examinador gera uma questão por palavra priorizando **uso em contexto** sobre tradução decorada, sobre um conjunto avulso de palavras. Quando a palavra tem frases reais de contexto (`WordSighting.contextSentence`), o PromptBuilder pode incluí-las para gerar questões ancoradas no contexto real onde você a encontrou.

**Template 3 — Compreensão de fonte.** Corpo: perguntas sobre o **conteúdo** da fonte (não só vocabulário). Inclui um **campo opcional de transcrição/resumo** que você cola — sem ele a IA só conhece o nome e as palavras, e a prova fica vaga. Quando preenchido, as perguntas se baseiam no texto colado.

Em todos: a instrução final é idêntica — _"responda ESTRITAMENTE neste formato JSON, sem texto fora dele"_ + o schema acima. O texto exato de cada corpo é detalhe de implementação do Fluxo C; o que está travado é a estrutura (dois turnos, schema único, campo de transcrição no T3).

## 7. Stack e justificativas

| Componente          | Escolha                                                                   | Razão / desvio                                                                                                                                                                        |
| ------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Linguagem / runtime | TypeScript estrito, Node LTS                                              | Default; type safety paga em código solo de vida longa                                                                                                                                |
| Backend             | **Next.js (App Router)** via API routes / server actions                  | **Desvio do default (Fastify):** o app é "alguns endpoints + front"; Next colapsa back+front, menos partes móveis, deploy de portfólio trivial                                        |
| Dados / ORM         | Prisma                                                                    | Default; tipagem forte + migrations; cai pra SQL cru se alguma agregação brigar com o ORM                                                                                             |
| Banco               | **SQLite**                                                                | **Desvio do default (Postgres):** single-user local; arquivo único **é** o backup; casa com o NFR de integridade; trocar pra Postgres é mudar o provider do Prisma se um dia hospedar |
| Frontend            | React (dentro do Next) + TS                                               | Default                                                                                                                                                                               |
| Async / jobs        | Nenhum (sob demanda)                                                      | Sem scheduler — relatório é gerado quando pedido                                                                                                                                      |
| Validação           | Zod                                                                       | Schema único compartilhado entre prompt-alvo e validação de retorno                                                                                                                   |
| Testes              | Vitest                                                                    | TDD nas regras de domínio (SM-2, prompts, parse)                                                                                                                                      |
| IA                  | **Port `AiProvider`** + `ManualAdapter` (default) e `ApiAdapter` (opt-in) | Desacopla capacidade de IA de provedor e de modelo de cobrança                                                                                                                        |
| Hospedagem          | Local (`next`); deploy demo opcional na Vercel                            | Sem custo recorrente; demo só pra portfólio                                                                                                                                           |

## 8. Decisões e trade-offs (ADRs)

### ADR-001: IA via port com adapter Manual como padrão (vs. depender da API)

- **Contexto:** o plano de chat não dá API programática gratuita; a API é cobrada à parte por token. Mas é barata (Sonnet ~US$3/MTok in, US$15/MTok out; uma prova ≈ centavos).
- **Opções:** **A) Manual** — sistema gera prompt, usuário cola na IA, traz o JSON. Custo zero; uma etapa manual. **B) API** — automático ponta a ponta; exige conta de API com créditos.
- **Fator decisivo:** custo zero no padrão + o requisito de não ficar refém de provedor/cobrança.
- **Decisão:** abstrair atrás de uma port `AiProvider`; **Manual é o default**, API é adapter opt-in via env var. O **mesmo schema Zod** serve aos dois.
- **Consequências:** funcionalidade 100% disponível hoje sem custo; ativar a API depois é trocar o adapter, sem tocar no domínio. Mudaria o padrão para API só se a etapa de colar virar atrito real e Vitor topar os créditos.

### ADR-002: SQLite (vs. Postgres)

- **Contexto:** banco para uso local single-user; integridade dos dados é o NFR crítico.
- **Opções:** **A) SQLite** — arquivo único, zero operação, backup = copiar arquivo. **B) Postgres** — robusto e o default do dev, mas exige rodar um serviço/container só pra um usuário.
- **Fator decisivo:** simplicidade operacional + "o backup é o próprio arquivo" casa com integridade.
- **Decisão:** SQLite + Prisma.
- **Consequências:** zero ops; portabilidade total. Migrar pra Postgres = trocar provider do Prisma + revisar tipos específicos, se um dia virar multiusuário hospedado.

### ADR-003: Next.js full-stack (vs. Fastify + React separados)

- **Contexto:** escopo é poucos fluxos + um front; é solo e quer servir de portfólio.
- **Opções:** **A) Next** — um projeto, um deploy, TS ponta a ponta. **B) Fastify+React** — separação clássica, melhor se houver múltiplos clientes.
- **Fator decisivo:** ausência de outros clientes (não-objetivo: sem mobile/CLI) torna a separação custo sem benefício.
- **Decisão:** Next.js. Reavaliar só se surgir um cliente externo consumindo a mesma API.

### ADR-004: SM-2 (vs. FSRS) para spaced repetition

- **Contexto:** quer SRS "de verdade", tipo Anki.
- **Opções:** **A) SM-2** — ~40 linhas, clássico, bem documentado, determinístico (ótimo pra testar). **B) FSRS** — agendamento superior, porém mais complexo e desenhado pra grandes volumes.
- **Fator decisivo:** o volume pessoal não justifica FSRS; SM-2 entrega o valor com complexidade mínima.
- **Decisão:** SM-2 em v1. FSRS fica como evolução possível atrás da mesma port de agendamento.

### ADR-005: Expressões como `kind` no `Word` (vs. entidade separada)

- **Contexto:** além de palavras, quer cadastrar **expressões** fixas/idiomáticas em inglês ("break a leg", "piece of cake") para estudar. Uma expressão tem a mesma forma e ciclo de vida de uma palavra: forma canônica, significado EN/PT, exemplos, agendamento SRS e sightings em fontes.
- **Opções:** **A) discriminador** — campo `kind` no `Word` (`"palavra" | "expressao"`), reaproveitando repositórios, fila de revisão, provas, sightings e telas. **B) entidade `Expression` separada** — modelo, port, ações e páginas paralelas.
- **Fator decisivo:** a sobreposição estrutural é ~90%; uma entidade separada duplicaria toda a pilha hexagonal por um objeto quase idêntico, e ainda quebraria a revisão/provas unificadas.
- **Decisão:** **A.** `kind String @default("palavra")` no `Word` — coluna aditiva (não-destrutiva: respeita "nunca resetar o dev.db"). Palavras e expressões dividem a mesma fila de revisão e as mesmas provas; diferem só no prompt de definição (idiomático para expressões) e em rótulos/filtros de UI.
- **Consequências:** custo mínimo (uma coluna + alguns condicionais). Se um dia expressões divergirem muito (campos próprios, cadência diferente), o `Word` fica mais "gordo" — aí valeria reabrir esta decisão e extrair a entidade.

## 9. Escalabilidade e evolução

Dado o alvo (1 usuário, milhares de registros), **não há gargalo de escala** a tratar — e dizer isso explicitamente faz parte de um bom design. O que medir é comportamental, não de carga: se as datas do SM-2 fazem sentido na prática e se os prompts geram provas úteis.

Caminho de evolução, se algum dia mudar de patamar: (1) **multiusuário hospedado** → trocar provider Prisma para Postgres, adicionar auth, escopar dados por usuário — a fronteira de Repository já isola isso; (2) **IA automática** → ativar `ApiAdapter` (já previsto); (3) **agendamento melhor** → trocar SM-2 por FSRS atrás da port; (4) **captura assistida** → integrar API do YouTube para puxar título/legendas.

**O que adiar de propósito (evitar over-engineering):** auth, multiusuário, scheduler/cron, fila de jobs, cache, observabilidade avançada, PWA/offline, mobile, integração YouTube. Nenhum desses tem requisito que o justifique em v1; construí-los agora seria o erro oposto — escalar prematuramente.

## 10. Riscos e pontos em aberto

- **Risco — qualidade do JSON da IA no modo Manual.** A IA pode devolver JSON malformado ou fora do schema. _Mitigação:_ validação Zod estrita + mensagem de erro clara; o prompt deve ser bem redigido (instrução de schema + exemplo). Vale tratar isso como o item de maior atenção do v1.
- **Risco — disciplina de backup.** Sendo manual, pode-se esquecer de exportar. _Mitigação:_ tornar o export um clique e/ou versionar o arquivo SQLite no Git do próprio projeto de dados.
- **Resolvido:** templates de prompt (3 tipos, dois turnos, schema único, transcrição opcional no T3 — §6.2) e limiares de estado da palavra (§6.1).

## 11. Roadmap / próximos passos

Começando pelo fluxo de maior risco (C), de-riscado primeiro como núcleo testável:

1. **Domínio puro + testes (TDD):** SM-2, `PromptBuilder`, schema Zod + `ExamResultParser`. Sem UI, sem banco — só Vitest. É o coração e o que mais vale no portfólio.
2. **Persistência:** schema Prisma (Word, Source, SourceType, WordSighting, ReviewLog, Exam, ExamWord) + Repository sobre SQLite + export/import JSON.
3. **Fluxo A (captura):** telas de busca/cadastro de palavra, gestão de fontes e tipos, captura em lote pela página da fonte, com reencontros; e as duas vistas (por palavra / por fonte, com novas vs. reencontros).
4. **Fluxo C (prova) ponta a ponta no modo Manual:** gerar prompt → colar JSON → validar → atualizar SRS.
5. **Fluxo B (revisão):** fila de revisão por data + avaliação.
6. **Fluxo D (dashboard):** métricas e histórico.
7. **Polimento de portfólio:** README com "como rodar" + decisões deste doc, e deploy demo opcional na Vercel.
8. **(Opcional, depois):** `ApiAdapter` ligando a IA via API.

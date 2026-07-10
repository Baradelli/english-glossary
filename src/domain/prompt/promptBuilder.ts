/**
 * PromptBuilder — pure functions that assemble the study prompts (§6.2).
 *
 * Comprehension exams run in TWO TURNS. Turn 1: a question prompt asks the AI
 * to *present* an exam — no JSON. You answer in the chat and paste the
 * exam-and-answers back. Turn 2: {@link buildCorrectionPrompt} asks the AI to
 * grade those answers and reply strictly in the correction JSON schema (the
 * textual twin of the Zod schema in the ExamResult module). The weekly and
 * vocabulary templates were retired by the in-app quiz (ADR-007); only the
 * one-turn quiz-generation prompt below (ADR-009) touches the quiz flow.
 *
 * No I/O, no clock, no randomness: output depends only on the inputs.
 */

export interface PromptWord {
  /** The exact form being studied; never lemmatised ("ramble" != "rambling"). */
  readonly term: string;
  /** Author's own English definition. */
  readonly definitionEn?: string;
  /** Author's own Portuguese definition. */
  readonly definitionPt?: string;
  /** Authorial example sentences (Word.examples). */
  readonly examples?: readonly string[];
  /** Real sentences from sources where the word appeared (WordSighting). */
  readonly contextSentences?: readonly string[];
}

export interface SourceComprehensionInput {
  readonly source: { readonly name: string };
  readonly words: readonly PromptWord[];
  /** Optional transcript/summary the user pastes to ground the questions. */
  readonly transcript?: string;
}

export interface CorrectionInput {
  /** The exam plus the user's answers, pasted back from the AI chat. */
  readonly answersText: string;
}

/** Closing block for the define-word prompt: asks for the EN/PT JSON. */
export const DEFINITION_SCHEMA_INSTRUCTION = `Responda ESTRITAMENTE neste formato JSON, sem nenhum texto fora dele:

{ "definitionEn": "significado no contexto, depois o geral e como é usada — em inglês", "definitionPt": "significado no contexto, depois o geral e como é usada — em português", "examples": ["frase de exemplo em inglês", "..."] }`;

/**
 * Prompt that asks the AI to define a term in English and Portuguese, returning
 * the strict JSON the WordDefinition parser validates. When a context sentence
 * is given, the AI is told to read the meaning in that context first, then give
 * the general meaning and how the word is used. Used to auto-fill (or
 * copy-paste) definitions when capturing a word.
 */
export function buildDefineWordPrompt(
  term: string,
  contextSentence?: string,
): string {
  const trimmed = term.trim();
  if (trimmed.length === 0) {
    throw new Error("buildDefineWordPrompt requires a term.");
  }
  const context = contextSentence?.trim();
  const contextBlock =
    context && context.length > 0
      ? `A palavra apareceu nesta frase: "${context}". Comece entendendo e priorizando o significado exato NESTE contexto.\n\n`
      : "";

  return `Você é um dicionário bilíngue para um estudante brasileiro de inglês.

${contextBlock}Para o termo em inglês "${trimmed}", em cada idioma (inglês e português) traga, nesta ordem: (1) o significado${
    context ? " neste contexto" : ""
  }, (2) o significado geral da palavra, e (3) o registro e as colocações comuns da palavra. Seja conciso e preciso.

Traga também, no campo "examples", no mínimo 3 frases de exemplo em inglês, cobrindo ao máximo a semântica da palavra (sentidos e usos diferentes), e não apenas repetindo o mesmo uso.

${DEFINITION_SCHEMA_INSTRUCTION}`;
}

/**
 * Prompt that asks the AI to explain a fixed/idiomatic English expression
 * ("break a leg", "piece of cake") for a Brazilian learner, returning the same
 * strict JSON the WordDefinition parser validates. Unlike the word prompt, it
 * frames the term as an idiom — figurative meaning, when/how to use it, and
 * register — instead of a dictionary headword. Examples must actually *use* the
 * expression. Used by the capture flow when the entry kind is "expressao".
 */
export function buildDefineExpressionPrompt(
  term: string,
  contextSentence?: string,
): string {
  const trimmed = term.trim();
  if (trimmed.length === 0) {
    throw new Error("buildDefineExpressionPrompt requires a term.");
  }
  const context = contextSentence?.trim();
  const contextBlock =
    context && context.length > 0
      ? `A expressão apareceu nesta frase: "${context}". Comece entendendo e priorizando o sentido exato NESTE contexto.\n\n`
      : "";

  return `Você é um guia bilíngue de expressões idiomáticas do inglês para um estudante brasileiro.

${contextBlock}Para a expressão em inglês "${trimmed}", em cada idioma (inglês e português) traga, nesta ordem: (1) o significado${
    context ? " neste contexto" : ""
  }, dando o sentido FIGURADO/idiomático (não o literal palavra a palavra); (2) quando e como a expressão é usada; e (3) o registro (formal, informal ou gíria) e o tom. Seja conciso e preciso.

Traga também, no campo "examples", no mínimo 3 frases de exemplo em inglês que de fato USEM a expressão "${trimmed}" em situações diferentes.

${DEFINITION_SCHEMA_INSTRUCTION}`;
}

/** Turn-1 closing line: present the exam, defer grading to turn 2. */
export const PRESENT_EXAM_INSTRUCTION = `Apresente a prova numerada para eu responder aqui nesta conversa. NÃO dê as respostas nem corrija agora — a correção será pedida num segundo passo.`;

/**
 * Turn-2 closing block (§6.2): the strict-JSON instruction plus the correction
 * schema. This is the contract the ExamResult parser validates.
 */
export const JSON_SCHEMA_INSTRUCTION = `Responda ESTRITAMENTE neste formato JSON, sem nenhum texto fora dele:

{
  "score": 0,
  "items": [{ "term": "string", "correct": true, "note": "string" }],
  "feedback": "string"
}

Regras do JSON:
- "score": inteiro de 0 a 100.
- "items": um objeto por palavra avaliada; "term" deve casar exatamente com as palavras enviadas.
- "correct": true se acertou a palavra, false caso contrário.
- "note": comentário curto sobre aquela palavra.
- "feedback": comentário geral sobre o desempenho.`;

function formatWordEntry(word: PromptWord): string {
  const lines: string[] = [`- ${word.term}`];
  if (word.definitionEn) lines.push(`  - EN: ${word.definitionEn}`);
  if (word.definitionPt) lines.push(`  - PT: ${word.definitionPt}`);
  for (const example of word.examples ?? []) {
    lines.push(`  - exemplo autoral: ${example}`);
  }
  for (const sentence of word.contextSentences ?? []) {
    lines.push(`  - contexto real: ${sentence}`);
  }
  return lines.join("\n");
}

function formatWordList(words: readonly PromptWord[]): string {
  return words.map(formatWordEntry).join("\n");
}

function asQuestionPrompt(body: string): string {
  return `${body}\n\n${PRESENT_EXAM_INSTRUCTION}`;
}

/**
 * Template 3 — Source comprehension. Questions about the source's *content*,
 * not only vocabulary. When a transcript/summary is provided, the questions are
 * grounded on that text; otherwise the AI only knows the source name and words.
 */
export function buildSourceComprehensionPrompt(
  input: SourceComprehensionInput,
): string {
  const { source, words, transcript } = input;
  const sections: string[] = [
    `Você é um examinador de compreensão. Crie perguntas sobre o CONTEÚDO da fonte abaixo, não apenas sobre vocabulário.`,
    `Fonte: ${source.name}`,
  ];

  if (transcript && transcript.trim().length > 0) {
    sections.push(
      `Baseie as perguntas estritamente na transcrição/resumo a seguir:\n${transcript}`,
    );
  } else {
    sections.push(
      `Nenhuma transcrição foi fornecida: baseie-se apenas no nome da fonte e nas palavras abaixo, mantendo as perguntas gerais.`,
    );
  }

  if (words.length > 0) {
    sections.push(`Palavras aprendidas nesta fonte:\n${formatWordList(words)}`);
  }

  return asQuestionPrompt(sections.join("\n\n"));
}

/**
 * Closing block for the quiz-generation prompt: the strict-JSON instruction
 * plus the AI-quiz schema. This is the contract the AiQuiz parser
 * (`src/domain/quiz/aiQuiz.ts`) validates.
 */
export const AI_QUIZ_JSON_SCHEMA_INSTRUCTION = `Responda ESTRITAMENTE neste formato JSON, sem nenhum texto fora dele:

{
  "items": [
    {
      "term": "string",
      "prompt": "string",
      "options": ["string", "string", "string", "string"],
      "correctIndex": 0,
      "explanation": "string"
    }
  ]
}

Regras do JSON:
- "items": exatamente uma questão por termo enviado; "term" deve casar EXATAMENTE com o termo enviado (mesma grafia).
- "prompt": o enunciado completo da questão. Instruções em português; o conteúdo sendo testado (frases, palavras) em inglês.
- "options": exatamente 4 alternativas, todas diferentes entre si e nenhuma vazia.
- "correctIndex": inteiro de 0 a 3, o índice da ÚNICA alternativa correta em "options".
- "explanation": 1–2 frases em português explicando por que a alternativa correta é a certa (e, se ajudar, por que as erradas enganam). É o que o estudante lê depois de responder.`;

/**
 * Quiz generation (ADR-009) — the AI writes the WHOLE quiz: one multiple-
 * choice question per term, replying strictly in the AiQuiz JSON schema. The
 * app validates the reply, reshuffles the alternatives and grades locally.
 * ONE-turn prompt: the reply is machine-validated, never pasted back.
 */
export function buildQuizGenerationPrompt(words: readonly PromptWord[]): string {
  if (words.length === 0) {
    throw new Error("buildQuizGenerationPrompt requires at least one word.");
  }

  return `Você é um professor de inglês criando uma prova de múltipla escolha para um estudante brasileiro. O objetivo é APRENDER: cada questão deve ensinar algo sobre o termo, não apenas conferir memorização.

Crie exatamente ${words.length} questões — uma por termo abaixo, na mesma ordem. Todas de múltipla escolha, com 4 alternativas e apenas UMA correta.

Diretrizes das questões:
- Questões simples e diretas (não necessariamente fáceis): teste UMA coisa por questão, com enunciado curto e sem pegadinhas artificiais.
- Varie o estilo entre as questões: significado do termo, completar uma frase natural em inglês com o termo certo, escolher a frase que usa o termo corretamente, ou o termo que encaixa numa situação descrita.
- Prefira frases naturais e cotidianas em inglês; quando houver "contexto real" do termo, inspire-se nele.
- As alternativas erradas devem ser plausíveis (erros que um estudante brasileiro cometeria), mas claramente erradas para quem conhece o termo.
- Use as definições fornecidas como fonte da verdade sobre o significado de cada termo.

Termos:
${formatWordList(words)}

${AI_QUIZ_JSON_SCHEMA_INSTRUCTION}`;
}

/**
 * Turn 2 — correction prompt. Takes the pasted exam-and-answers and asks the AI
 * to grade them, replying strictly in the correction JSON schema.
 */
export function buildCorrectionPrompt(input: CorrectionInput): string {
  if (input.answersText.trim().length === 0) {
    throw new Error("buildCorrectionPrompt requires the exam answers text.");
  }
  return `Você é um corretor. Abaixo está a prova com as minhas respostas. Corrija cada item, indique acertos e erros e dê uma nota.

${input.answersText}

${JSON_SCHEMA_INSTRUCTION}`;
}

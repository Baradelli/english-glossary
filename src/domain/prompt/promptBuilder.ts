/**
 * PromptBuilder — pure functions that assemble the text of the three study
 * prompts (§6.2). They take plain data (words, definitions, context sentences,
 * an optional transcript) and return a copy-pastable string. Every prompt ends
 * with the single shared instruction that pins the AI to the JSON correction
 * schema — the textual twin of the Zod schema in the ExamResult module.
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

/**
 * Shared closing block (§6.2): the strict-JSON instruction plus the correction
 * schema. Identical across all three templates so the AI always replies in the
 * shape the ExamResult parser validates.
 */
export const JSON_SCHEMA_INSTRUCTION = `Ao final, responda ESTRITAMENTE neste formato JSON, sem nenhum texto fora dele:

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

function withSchema(body: string): string {
  return `${body}\n\n${JSON_SCHEMA_INSTRUCTION}`;
}

/**
 * Template 1 — Weekly review. A tutor builds a mixed exam (translation,
 * fill-in-the-blank, use-in-context), varying the question type across the
 * week's words.
 */
export function buildWeeklyReviewPrompt(words: readonly PromptWord[]): string {
  if (words.length === 0) {
    throw new Error("buildWeeklyReviewPrompt requires at least one word.");
  }
  const body = `Você é um tutor de inglês. Monte uma prova de revisão semanal com as palavras abaixo.
Varie o tipo de questão entre tradução, completar a frase e uso em contexto, misturando os formatos ao longo da prova.

Palavras da semana:
${formatWordList(words)}`;
  return withSchema(body);
}

/**
 * Template 2 — Vocabulary exam. One question per word, prioritising
 * use-in-context over rote translation; when a word has real context
 * sentences, they anchor its question.
 */
export function buildVocabularyExamPrompt(words: readonly PromptWord[]): string {
  if (words.length === 0) {
    throw new Error("buildVocabularyExamPrompt requires at least one word.");
  }
  const body = `Você é um examinador de vocabulário. Gere exatamente uma questão por palavra.
Priorize o uso em contexto em vez de tradução decorada. Quando houver frases de contexto real, ancore a questão nelas.

Palavras:
${formatWordList(words)}`;
  return withSchema(body);
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

  return withSchema(sections.join("\n\n"));
}

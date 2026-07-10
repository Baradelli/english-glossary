export interface QuizReviewQuestion {
  readonly prompt: string;
  readonly options: readonly string[] | null;
  readonly correctIndex: number | null;
  readonly userAnswer: string | null;
  readonly explanation: string | null;
  readonly optionExplanations: readonly string[] | null;
}

export interface ReviewedOption {
  readonly text: string;
  readonly explanation: string | null;
  readonly selected: boolean;
  readonly correct: boolean;
}

function nonEmpty(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

export function buildOptionReview(
  question: QuizReviewQuestion,
): ReviewedOption[] {
  if (question.options === null) return [];

  const parsedAnswer =
    question.userAnswer !== null ? Number(question.userAnswer) : Number.NaN;
  const selectedIndex = Number.isInteger(parsedAnswer) ? parsedAnswer : -1;

  return question.options.map((text, index) => {
    const correct = index === question.correctIndex;
    return {
      text,
      explanation:
        nonEmpty(question.optionExplanations?.[index]) ??
        (correct ? nonEmpty(question.explanation) : null),
      selected: index === selectedIndex,
      correct,
    };
  });
}

export function buildObservationSeed(
  question: QuizReviewQuestion,
): string {
  const options = buildOptionReview(question);
  const correct = options.find((option) => option.correct);
  const selected = options.find((option) => option.selected);

  const correctLine =
    correct?.explanation !== null && correct?.explanation !== undefined
      ? `Resposta correta (“${correct.text}”): ${correct.explanation}`
      : null;

  if (selected && !selected.correct && selected.explanation) {
    return [
      `Sua resposta (“${selected.text}”): ${selected.explanation}`,
      correctLine,
    ]
      .filter((line): line is string => line !== null)
      .join("\n");
  }

  return correctLine ?? nonEmpty(question.explanation) ?? "";
}

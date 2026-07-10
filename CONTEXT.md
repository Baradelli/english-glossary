# English Glossary

A single-user tool for capturing English vocabulary and expressions encountered in real sources, defining them bilingually (EN/PT) with AI assistance, and drilling them via spaced repetition and AI-generated exams.

## Language

**Verbete** (lexical entry):
A single reviewable unit in the glossary — persisted as a `Word` row and scheduled by SM-2. Every verbete is either a _Palavra_ or an _Expressão_, distinguished by its `kind`. The two share the same shape (canonical form, EN/PT meaning, examples, accumulated observations, SRS state, sightings) and the same review queue and exams.
_Avoid_: "card", "entry" (use _verbete_)

**Palavra** (word):
A verbete whose canonical form is a single dictionary headword (`kind = "palavra"`). Defined with the standard bilingual-dictionary prompt (`buildDefineWordPrompt`).

**Expressão** (fixed expression / idiom):
A verbete whose canonical form is a multi-word fixed expression or idiom — e.g. _"break a leg"_, _"piece of cake"_ (`kind = "expressao"`). Stored as-entered in `term` (never lemmatised), so the whole expression is its own `termKey`. Defined with an idiom-aware prompt (`buildDefineExpressionPrompt`) that emphasises figurative meaning, when/how to use it, and register — but returns the same `{definitionEn, definitionPt, examples[]}` shape as a Palavra.
_Avoid_: "frase" (in PT that means _sentence_, and collides with _contextSentence_ and _examples_, which are literally frases)

**Sighting** (encounter):
A recorded occurrence of a verbete inside a `Source` (`WordSighting`). Carries the real `contextSentence`, whether it was the first encounter, and an optional per-source meaning. A verbete — Palavra or Expressão — is always born from a first sighting in a source.

**Source** (fonte):
Where a verbete was encountered (a YouTube video, a book, a podcast…), grouped by `SourceType`. Both Palavras and Expressões are captured inside a source.

**Revisão** (review):
One SM-2 update of a verbete: it recomputes the schedule (interval, ease, `nextReview`) and writes a `ReviewLog`. Reviews are produced by **answering prova questions** — a correct answer maps to SM-2 quality 5, a wrong one to 2 (there is no separate review screen; the dedicated card-by-card session was retired — ADR-010). A verbete's due-ness (`nextReview <= now`) still drives the dashboard's "hoje" band and weights the vocabulary prova.

**Questão** (question):
One answerable unit of a prova, always anchored to a single verbete (`ExamQuestion`; exactly one questão per verbete per prova). Written by the AI as multiple choice (four alternatives, one correct) grounded in the verbete's definitions and real `contextSentence`; the app validates, reshuffles the alternatives and grades it locally (ADR-009). Older provas may hold retired types (typed recall, cloze) and still render.
_Avoid_: calling the AI the grader — the AI only writes questions; the app grades.

**Distrator** (distractor):
An incorrect multiple-choice alternative. Written by the AI (a plausible mistake a Brazilian learner would make), then validated: the four alternatives must be non-empty and distinct.

**Explicação** (explanation):
A short PT reason attached to each alternative explaining why that option is right or wrong. Explanations stay paired with their alternatives while the app reshuffles them. After each answer, only the correct alternative's reason may appear in immediate feedback; the complete set is revealed in the expandable review of a finished prova. Older questões may have only the correct-answer explanation.

**Observação** (observation):
Student-curated context appended to a verbete while studying: a nuance, association, usage warning or lesson taken from a prova. Observações are explicit and append-only; AI output is never saved automatically. They become context for future prova and comprehension prompts.

**Prova de prática** (practice exam):
A follow-up quiz (`type = "pratica"`) whose verbetes are only those answered wrong in a finished prova (`practiceOfId` points back to it). The AI writes fresh questions for them, so practice never repeats the exact same wording. Updates SRS like any prova.

**Streak** (sequência):
Consecutive _local days_ with study activity (reviews or captures), ending today — or yesterday, if today has no activity yet.

**Dia local** (local day):
The civil day in the user's timezone, used for all daily bucketing (heatmap, streak, forecast). Timestamps are stored in UTC and converted with an injected offset.
_Avoid_: bucketing anything by UTC calendar day.

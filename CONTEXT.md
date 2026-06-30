# English Glossary

A single-user tool for capturing English vocabulary and expressions encountered in real sources, defining them bilingually (EN/PT) with AI assistance, and drilling them via spaced repetition and AI-generated exams.

## Language

**Verbete** (lexical entry):
A single reviewable unit in the glossary — persisted as a `Word` row and scheduled by SM-2. Every verbete is either a _Palavra_ or an _Expressão_, distinguished by its `kind`. The two share the same shape (canonical form, EN/PT meaning, examples, SRS state, sightings) and the same review queue and exams.
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

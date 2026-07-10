-- CreateTable
CREATE TABLE "ExamQuestion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "examId" TEXT NOT NULL,
    "wordId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "options" TEXT,
    "correctIndex" INTEGER,
    "correctAnswer" TEXT,
    "contextSentence" TEXT,
    "userAnswer" TEXT,
    "isCorrect" BOOLEAN,
    "answeredAt" DATETIME,
    CONSTRAINT "ExamQuestion_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ExamQuestion_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "Word" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Exam" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "sourceId" TEXT,
    "status" TEXT NOT NULL,
    "promptText" TEXT NOT NULL,
    "answersText" TEXT,
    "correctionPrompt" TEXT,
    "resultJson" TEXT,
    "score" INTEGER,
    "finishedAt" DATETIME,
    "practiceOfId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Exam_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Exam_practiceOfId_fkey" FOREIGN KEY ("practiceOfId") REFERENCES "Exam" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Exam" ("answersText", "correctionPrompt", "createdAt", "id", "promptText", "resultJson", "score", "sourceId", "status", "type") SELECT "answersText", "correctionPrompt", "createdAt", "id", "promptText", "resultJson", "score", "sourceId", "status", "type" FROM "Exam";
DROP TABLE "Exam";
ALTER TABLE "new_Exam" RENAME TO "Exam";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "ExamQuestion_wordId_idx" ON "ExamQuestion"("wordId");

-- CreateIndex
CREATE UNIQUE INDEX "ExamQuestion_examId_position_key" ON "ExamQuestion"("examId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "ExamQuestion_examId_wordId_key" ON "ExamQuestion"("examId", "wordId");

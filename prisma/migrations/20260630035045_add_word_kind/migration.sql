-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Word" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "term" TEXT NOT NULL,
    "termKey" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'palavra',
    "definitionEn" TEXT NOT NULL,
    "definitionPt" TEXT NOT NULL,
    "examples" TEXT NOT NULL,
    "easeFactor" REAL NOT NULL DEFAULT 2.5,
    "intervalDays" INTEGER NOT NULL DEFAULT 0,
    "repetitions" INTEGER NOT NULL DEFAULT 0,
    "nextReview" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Word" ("createdAt", "definitionEn", "definitionPt", "easeFactor", "examples", "id", "intervalDays", "nextReview", "repetitions", "term", "termKey") SELECT "createdAt", "definitionEn", "definitionPt", "easeFactor", "examples", "id", "intervalDays", "nextReview", "repetitions", "term", "termKey" FROM "Word";
DROP TABLE "Word";
ALTER TABLE "new_Word" RENAME TO "Word";
CREATE UNIQUE INDEX "Word_termKey_key" ON "Word"("termKey");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

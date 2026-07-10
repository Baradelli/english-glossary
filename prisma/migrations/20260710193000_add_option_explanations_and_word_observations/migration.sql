-- AlterTable
ALTER TABLE "Word" ADD COLUMN "observations" TEXT NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "ExamQuestion" ADD COLUMN "optionExplanations" TEXT;

import { PrismaClient } from "@prisma/client";

let client: PrismaClient | undefined;

/** Shared PrismaClient for tests; reads DATABASE_URL from the test env. */
export function getTestPrisma(): PrismaClient {
  if (!client) client = new PrismaClient();
  return client;
}

/** Truncates every table in foreign-key-safe order for test isolation. */
export async function resetDb(): Promise<void> {
  // Safety: never wipe a non-test database (e.g. dev.db) if the env ever leaks.
  const url = process.env.DATABASE_URL ?? "";
  if (!url.includes("test")) {
    throw new Error(
      `resetDb refused: DATABASE_URL does not point at a test database (${url || "unset"}).`,
    );
  }
  const db = getTestPrisma();
  await db.setting.deleteMany();
  await db.examQuestion.deleteMany();
  await db.examWord.deleteMany();
  await db.reviewLog.deleteMany();
  await db.wordSighting.deleteMany();
  await db.exam.deleteMany();
  await db.word.deleteMany();
  await db.source.deleteMany();
  await db.sourceType.deleteMany();
}

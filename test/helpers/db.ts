import { PrismaClient } from "@prisma/client";

let client: PrismaClient | undefined;

/** Shared PrismaClient for tests; reads DATABASE_URL from the test env. */
export function getTestPrisma(): PrismaClient {
  if (!client) client = new PrismaClient();
  return client;
}

/** Truncates every table in foreign-key-safe order for test isolation. */
export async function resetDb(): Promise<void> {
  const db = getTestPrisma();
  await db.examWord.deleteMany();
  await db.reviewLog.deleteMany();
  await db.wordSighting.deleteMany();
  await db.exam.deleteMany();
  await db.word.deleteMany();
  await db.source.deleteMany();
  await db.sourceType.deleteMany();
}

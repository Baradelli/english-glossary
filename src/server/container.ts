/**
 * Server composition root. Wires the repository adapters to the Prisma
 * singleton and exposes the dependency bundles the use cases expect. Imported
 * only by server components and server actions — never by client code.
 */

import { prisma } from "../infra/prisma/client.js";
import { createRepositories } from "../infra/prisma/repositories.js";

export const repos = createRepositories(prisma);

export const wordViewDeps = {
  words: repos.words,
  sightings: repos.sightings,
  sources: repos.sources,
};

export const sourceViewDeps = {
  sources: repos.sources,
  sourceTypes: repos.sourceTypes,
  sightings: repos.sightings,
  words: repos.words,
};

export const captureDeps = {
  words: repos.words,
  sightings: repos.sightings,
};

export const quizDeps = {
  words: repos.words,
  sightings: repos.sightings,
  exams: repos.exams,
};

export const dashboardDeps = {
  words: repos.words,
  sources: repos.sources,
  reviewLogs: repos.reviewLogs,
  sightings: repos.sightings,
  exams: repos.exams,
};

export const examComprehensionDeps = {
  sources: repos.sources,
  sightings: repos.sightings,
  words: repos.words,
  exams: repos.exams,
};

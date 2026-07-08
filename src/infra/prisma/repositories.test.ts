import { describe, expect, it } from "vitest";
import { getTestPrisma } from "../../../test/helpers/db.js";
import { createRepositories } from "./repositories.js";

describe("createRepositories", () => {
  it("wires every aggregate repository over one client", () => {
    const repos = createRepositories(getTestPrisma());
    expect(Object.keys(repos).sort()).toEqual([
      "exams",
      "reviewLogs",
      "settings",
      "sightings",
      "sourceTypes",
      "sources",
      "words",
    ]);
    expect(typeof repos.words.findByTerm).toBe("function");
    expect(typeof repos.sightings.listBySource).toBe("function");
    expect(typeof repos.exams.submitCorrection).toBe("function");
    expect(typeof repos.settings.getMany).toBe("function");
  });
});

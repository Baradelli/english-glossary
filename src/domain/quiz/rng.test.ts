import { describe, expect, it } from "vitest";
import { createRng, sampleWeighted, shuffle } from "./rng.js";

describe("createRng (mulberry32)", () => {
  it("produces the same sequence for the same seed", () => {
    const a = createRng(42);
    const b = createRng(42);
    const seqA = Array.from({ length: 20 }, () => a());
    const seqB = Array.from({ length: 20 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it("produces different sequences for different seeds", () => {
    const a = createRng(1);
    const b = createRng(2);
    expect(Array.from({ length: 5 }, () => a())).not.toEqual(
      Array.from({ length: 5 }, () => b()),
    );
  });

  it("stays within [0, 1)", () => {
    const rng = createRng(7);
    for (let i = 0; i < 1000; i++) {
      const value = rng();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe("shuffle", () => {
  const items = ["a", "b", "c", "d", "e", "f"];

  it("is deterministic for the same seed", () => {
    expect(shuffle(items, createRng(9))).toEqual(shuffle(items, createRng(9)));
  });

  it("keeps every item exactly once and does not mutate the input", () => {
    const snapshot = [...items];
    const result = shuffle(items, createRng(3));
    expect([...result].sort()).toEqual([...items].sort());
    expect(items).toEqual(snapshot);
  });

  it("actually reorders (some seed permutes this input)", () => {
    expect(shuffle(items, createRng(1))).not.toEqual(items);
  });
});

describe("sampleWeighted", () => {
  const items = [
    { id: "heavy", weight: 100 },
    { id: "light", weight: 1 },
    { id: "mid", weight: 10 },
  ];
  const weightOf = (item: { weight: number }) => item.weight;

  it("never repeats an item (sampling without replacement)", () => {
    for (let seed = 0; seed < 50; seed++) {
      const picked = sampleWeighted(items, weightOf, 3, createRng(seed));
      expect(new Set(picked.map((i) => i.id)).size).toBe(3);
    }
  });

  it("caps at the population size when count exceeds it", () => {
    const picked = sampleWeighted(items, weightOf, 10, createRng(5));
    expect(picked).toHaveLength(3);
  });

  it("respects the weights: the heavy item is drawn first far more often", () => {
    let heavyFirst = 0;
    const runs = 200;
    for (let seed = 0; seed < runs; seed++) {
      const first = sampleWeighted(items, weightOf, 1, createRng(seed))[0];
      if (first?.id === "heavy") heavyFirst += 1;
    }
    // heavy holds 100/111 ≈ 90% of the mass; deterministic given the seeds.
    expect(heavyFirst).toBeGreaterThan(runs * 0.8);
  });

  it("is deterministic for the same seed", () => {
    expect(sampleWeighted(items, weightOf, 2, createRng(11))).toEqual(
      sampleWeighted(items, weightOf, 2, createRng(11)),
    );
  });

  it("falls back to uniform when every weight is zero", () => {
    const picked = sampleWeighted(items, () => 0, 3, createRng(2));
    expect(new Set(picked.map((i) => i.id)).size).toBe(3);
  });
});

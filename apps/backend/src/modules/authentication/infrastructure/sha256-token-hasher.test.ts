import { describe, it, expect } from "vitest";
import { Sha256TokenHasher } from "./sha256-token-hasher.ts";

describe("Sha256TokenHasher", () => {
  it("returns the same hash for the same input", () => {
    const hasher = new Sha256TokenHasher();
    const input = "session-token-value";

    const first = hasher.hash(input);
    const second = hasher.hash(input);

    expect(first).toBe(second);
  });

  it("returns different hashes for different inputs", () => {
    const hasher = new Sha256TokenHasher();

    const first = hasher.hash("token-a");
    const second = hasher.hash("token-b");

    expect(first).not.toBe(second);
  });
});

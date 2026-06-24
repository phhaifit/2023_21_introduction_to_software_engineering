import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Sha256TokenHasher } from "./sha256-token-hasher.ts";

describe("Sha256TokenHasher", () => {
  it("returns the same hash for the same input", () => {
    const hasher = new Sha256TokenHasher();
    const input = "session-token-value";

    const first = hasher.hash(input);
    const second = hasher.hash(input);

    assert.equal(first, second);
  });

  it("returns different hashes for different inputs", () => {
    const hasher = new Sha256TokenHasher();

    const first = hasher.hash("token-a");
    const second = hasher.hash("token-b");

    assert.notEqual(first, second);
  });
});

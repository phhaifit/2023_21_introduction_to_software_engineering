import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BcryptPasswordHasher } from "./bcrypt-password-hasher.ts";

describe("BcryptPasswordHasher", () => {
  const password = "correct horse battery staple";

  it("produces different hashes for the same password", async () => {
    const hasher = new BcryptPasswordHasher(4);

    const firstHash = await hasher.hash(password);
    const secondHash = await hasher.hash(password);

    assert.notEqual(firstHash, secondHash);
  });

  it("verifies a password against its hash", async () => {
    const hasher = new BcryptPasswordHasher(4);
    const hashed = await hasher.hash(password);

    assert.equal(await hasher.verify(password, hashed), true);
  });

  it("returns false for a wrong password", async () => {
    const hasher = new BcryptPasswordHasher(4);
    const hashed = await hasher.hash(password);

    assert.equal(await hasher.verify("wrong", hashed), false);
  });

  it("returns false for an invalid bcrypt hash without throwing", async () => {
    const hasher = new BcryptPasswordHasher(4);

    assert.equal(await hasher.verify(password, "not-a-valid-bcrypt-hash"), false);
  });
});

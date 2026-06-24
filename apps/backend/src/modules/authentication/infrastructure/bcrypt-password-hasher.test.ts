import { describe, it, expect } from "vitest";
import { BcryptPasswordHasher } from "./bcrypt-password-hasher.ts";

describe("BcryptPasswordHasher", () => {
  const password = "correct horse battery staple";

  it("produces different hashes for the same password", async () => {
    const hasher = new BcryptPasswordHasher(4);

    const firstHash = await hasher.hash(password);
    const secondHash = await hasher.hash(password);

    expect(firstHash).not.toBe(secondHash);
  });

  it("verifies a password against its hash", async () => {
    const hasher = new BcryptPasswordHasher(4);
    const hashed = await hasher.hash(password);

    expect(await hasher.verify(password, hashed)).toBe(true);
  });

  it("returns false for a wrong password", async () => {
    const hasher = new BcryptPasswordHasher(4);
    const hashed = await hasher.hash(password);

    expect(await hasher.verify("wrong", hashed)).toBe(false);
  });

  it("returns false for an invalid bcrypt hash without throwing", async () => {
    const hasher = new BcryptPasswordHasher(4);

    expect(await hasher.verify(password, "not-a-valid-bcrypt-hash")).toBe(false);
  });
});

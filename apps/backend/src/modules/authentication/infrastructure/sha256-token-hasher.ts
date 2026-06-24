import { createHash } from "node:crypto";
import type { TokenHasher } from "../application/token-hasher.ts";

export class Sha256TokenHasher implements TokenHasher {
  hash(raw: string): string {
    return createHash("sha256").update(raw).digest("hex");
  }
}

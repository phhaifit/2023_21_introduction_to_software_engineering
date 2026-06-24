import * as bcrypt from "bcryptjs";
import type { PasswordHasher } from "../application/password-hasher.ts";

export class BcryptPasswordHasher implements PasswordHasher {
  private readonly saltRounds: number;

  constructor(saltRounds = 12) {
    this.saltRounds = saltRounds;
  }

  hash(plain: string): Promise<string> {
    return bcrypt.hash(plain, this.saltRounds);
  }

  async verify(plain: string, hashed: string): Promise<boolean> {
    try {
      return await bcrypt.compare(plain, hashed);
    } catch {
      return false;
    }
  }
}

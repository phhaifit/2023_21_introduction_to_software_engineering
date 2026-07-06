export interface TokenHasher {
  hash(raw: string): string;
}

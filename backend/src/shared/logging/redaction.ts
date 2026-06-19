const SECRET_KEY_PATTERNS = [
  /api[_-]?key/i,
  /authorization/i,
  /credential/i,
  /password/i,
  /secret/i,
  /token/i
];

export function isSecretKey(key: string): boolean {
  return SECRET_KEY_PATTERNS.some((pattern) => pattern.test(key));
}

export function redactSecrets(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactSecrets(item));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
      key,
      isSecretKey(key) ? "[REDACTED]" : redactSecrets(entry)
    ])
  );
}

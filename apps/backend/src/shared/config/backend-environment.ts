import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "dotenv";

const configDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(configDir, "../../../../..");

const backendEnvFiles = [
  resolve(repoRoot, ".env"),
  resolve(repoRoot, "apps/backend/.env"),
  resolve(repoRoot, "apps/backend/src/modules/workspace-user-management/.env")
];

let loaded = false;

export function loadBackendEnvironment(): void {
  if (loaded) return;
  loaded = true;

  for (const envFile of backendEnvFiles) {
    if (!existsSync(envFile)) continue;
    const parsed = parse(readFileSync(envFile));
    for (const [key, value] of Object.entries(parsed)) {
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  }
}

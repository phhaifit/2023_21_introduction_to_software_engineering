import type { WorkspaceClock } from "../application/ports/workspace-clock.ts";

export class SystemWorkspaceClock implements WorkspaceClock {
  now(): string {
    return new Date().toISOString();
  }

  addSeconds(isoTimestamp: string, seconds: number): string {
    return new Date(Date.parse(isoTimestamp) + seconds * 1000).toISOString();
  }
}

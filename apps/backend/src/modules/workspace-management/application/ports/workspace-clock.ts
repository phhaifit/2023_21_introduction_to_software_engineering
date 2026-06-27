export interface WorkspaceClock {
  now(): string;
  addSeconds(isoTimestamp: string, seconds: number): string;
}

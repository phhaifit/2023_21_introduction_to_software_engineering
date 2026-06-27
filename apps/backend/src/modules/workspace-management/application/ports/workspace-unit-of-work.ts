import type { WorkspaceTransaction } from "./workspace-persistence-types.ts";

export interface WorkspaceUnitOfWork {
  run<T>(work: (tx: WorkspaceTransaction) => Promise<T>): Promise<T>;
}

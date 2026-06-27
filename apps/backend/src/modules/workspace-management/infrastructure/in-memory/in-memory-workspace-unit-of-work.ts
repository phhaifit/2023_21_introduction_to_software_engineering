import type { WorkspaceTransaction } from "../../application/ports/workspace-persistence-types.ts";
import type { WorkspaceUnitOfWork } from "../../application/ports/workspace-unit-of-work.ts";

const TX = {} as WorkspaceTransaction;

export class InMemoryWorkspaceUnitOfWork implements WorkspaceUnitOfWork {
  runCount = 0;

  async run<T>(work: (tx: WorkspaceTransaction) => Promise<T>): Promise<T> {
    this.runCount += 1;
    return work(TX);
  }
}

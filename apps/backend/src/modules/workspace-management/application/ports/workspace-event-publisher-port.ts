import type { WorkspaceDomainEvent } from "../services/workspace-event-factory.ts";

export interface WorkspaceEventPublisherPort {
  publish(event: WorkspaceDomainEvent<unknown>): Promise<void>;
}

export class WorkspaceEventPublishFailure extends Error {
  readonly classification: "retryable" | "terminal";
  readonly code: string;

  constructor(
    classification: "retryable" | "terminal",
    code: string,
    message: string
  ) {
    super(message);
    this.name = "WorkspaceEventPublishFailure";
    this.classification = classification;
    this.code = code;
  }
}

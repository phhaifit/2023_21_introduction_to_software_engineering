import type { CreatedTaskRecord } from "./task-types";
import type { AgentKnowledgeAskCitationDto } from "@vcp/shared";

export interface TaskFinalizedResult {
  readonly text: string;
  readonly finalizedAt: string;
  readonly knowledgeStatus?:
    | "answered"
    | "insufficient_evidence"
    | "unauthorized"
    | "invalid_request"
    | "error";
  readonly citations?: readonly AgentKnowledgeAskCitationDto[];
  readonly warnings?: readonly string[];
}

export function isValidFinalizedResult(
  result: TaskFinalizedResult
): boolean {
  return result.text.trim().length > 0 && result.finalizedAt.trim().length > 0;
}

export function isTaskReadyForCompletion(task: CreatedTaskRecord): boolean {
  if (task.status !== "running") {
    return false;
  }

  const finalStep = task.processingSnapshot.steps.at(-1);
  const fixedStepReady = finalStep?.id === "finalize" && finalStep.status === "active";
  const providerStepReady =
    task.processingSnapshot.startedAt !== undefined &&
    task.processingSnapshot.steps.length > 0 &&
    task.processingSnapshot.steps.every((step) => step.status === "completed");

  if (!fixedStepReady && !providerStepReady) {
    return false;
  }

  return task.streamingSnapshot.phase === "exhausted";
}

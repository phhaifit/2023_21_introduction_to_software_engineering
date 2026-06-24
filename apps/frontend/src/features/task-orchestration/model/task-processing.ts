/**
 * task-processing.ts
 *
 * Pure, immutable processing-lifecycle model for the Task & Orchestration
 * PA5 prototype.
 *
 * Invariants enforced here:
 *   - At most one step is active at any time.
 *   - Completed steps cannot regress to waiting or active.
 *   - Steps activate in the approved ordered sequence defined by
 *     INITIAL_PROCESSING_STEPS (validate-input → analyze-request →
 *     select-routing → execute-task → aggregate-result → finalize).
 *   - Logs append in order; duplicate log IDs are rejected.
 *   - Unknown step IDs are rejected.
 *   - Input objects and arrays are never mutated.
 *   - No global time source, randomness, timer, or React dependency.
 */

import type { TaskLog, ProcessingStep } from "./task-types";

// ---------------------------------------------------------------------------
// Approved ordered step IDs — single source of truth for step ordering.
// Must match the labels defined in INITIAL_PROCESSING_STEPS.
// ---------------------------------------------------------------------------
export const ORDERED_STEP_IDS = [
  "validate-input",
  "analyze-request",
  "select-routing",
  "execute-task",
  "aggregate-result",
  "finalize"
] as const;

export type OrderedStepId = (typeof ORDERED_STEP_IDS)[number];

// ---------------------------------------------------------------------------
// ProcessingSnapshot — authoritative in-memory processing state
// ---------------------------------------------------------------------------
export interface ProcessingSnapshot {
  /** ISO-8601 string set when processing starts; absent before start. */
  readonly startedAt: string | undefined;
  /** Ordered steps — never reordered, never mutated in place. */
  readonly steps: readonly ProcessingStep[];
  /** Ordered log entries — append-only. */
  readonly logs: readonly TaskLog[];
}

// ---------------------------------------------------------------------------
// Result types — all operations are total (never throw)
// ---------------------------------------------------------------------------
export type ProcessingResult<T> =
  | { ok: true; snapshot: T }
  | { ok: false; reason: string; snapshot: ProcessingSnapshot };

// ---------------------------------------------------------------------------
// createInitialProcessingSnapshot
//
// Returns a snapshot where all steps are in "waiting" state and no logs
// exist.  The caller supplies the ordered step array so that this module
// does not need to import INITIAL_PROCESSING_STEPS directly (avoids
// circular dependency and keeps this module pure).
// ---------------------------------------------------------------------------
export function createInitialProcessingSnapshot(
  steps: readonly ProcessingStep[]
): ProcessingSnapshot {
  return {
    startedAt: undefined,
    steps: steps.map((step) => ({ ...step, status: "waiting" as const })),
    logs: []
  };
}

// ---------------------------------------------------------------------------
// startProcessing
//
// Transitions a snapshot from its initial state to "started":
//   - Sets startedAt to the supplied timestamp.
//   - Activates the first step (validate-input).
//   - Rejects if already started (startedAt is set).
// ---------------------------------------------------------------------------
export function startProcessing(
  snapshot: ProcessingSnapshot,
  startedAt: string
): ProcessingResult<ProcessingSnapshot> {
  if (snapshot.startedAt !== undefined) {
    return {
      ok: false,
      reason: "Processing has already started.",
      snapshot
    };
  }

  const firstStepId = ORDERED_STEP_IDS[0];
  const activatedSteps = _activateStep(snapshot.steps, firstStepId);
  if (activatedSteps === null) {
    return {
      ok: false,
      reason: `Cannot activate unknown step "${firstStepId}".`,
      snapshot
    };
  }

  return {
    ok: true,
    snapshot: {
      startedAt,
      steps: activatedSteps,
      logs: snapshot.logs
    }
  };
}

// ---------------------------------------------------------------------------
// activateNextStep
//
// Marks the step identified by stepId as "active".
// Invariants:
//   - stepId must exist in ORDERED_STEP_IDS.
//   - No other step may currently be active.
//   - The step must be in "waiting" state.
//   - All steps before stepId (by ORDERED_STEP_IDS order) must be
//     "completed".
// ---------------------------------------------------------------------------
export function activateNextStep(
  snapshot: ProcessingSnapshot,
  stepId: string
): ProcessingResult<ProcessingSnapshot> {
  if (!_isKnownStepId(stepId)) {
    return {
      ok: false,
      reason: `Unknown step ID "${stepId}".`,
      snapshot
    };
  }

  const currentlyActive = snapshot.steps.find((s) => s.status === "active");
  if (currentlyActive) {
    return {
      ok: false,
      reason: `Step "${currentlyActive.id}" is already active. Complete it before activating "${stepId}".`,
      snapshot
    };
  }

  const targetStep = snapshot.steps.find((s) => s.id === stepId);
  if (!targetStep) {
    return {
      ok: false,
      reason: `Step "${stepId}" not found in snapshot.`,
      snapshot
    };
  }

  if (targetStep.status !== "waiting") {
    return {
      ok: false,
      reason: `Step "${stepId}" is in state "${targetStep.status}" and cannot be activated.`,
      snapshot
    };
  }

  // Verify approved order: all steps before this one must be completed.
  const targetIndex = ORDERED_STEP_IDS.indexOf(stepId as OrderedStepId);
  for (let i = 0; i < targetIndex; i++) {
    const precedingId = ORDERED_STEP_IDS[i];
    const precedingStep = snapshot.steps.find((s) => s.id === precedingId);
    if (precedingStep && precedingStep.status !== "completed") {
      return {
        ok: false,
        reason: `Step "${precedingId}" must be completed before "${stepId}" can be activated.`,
        snapshot
      };
    }
  }

  const activated = _activateStep(snapshot.steps, stepId);
  if (activated === null) {
    return {
      ok: false,
      reason: `Cannot activate step "${stepId}".`,
      snapshot
    };
  }

  return {
    ok: true,
    snapshot: { ...snapshot, steps: activated }
  };
}

// ---------------------------------------------------------------------------
// completeActiveStep
//
// Marks the currently active step identified by stepId as "completed".
// Invariants:
//   - stepId must exist in ORDERED_STEP_IDS.
//   - The step must be in "active" state.
// ---------------------------------------------------------------------------
export function completeActiveStep(
  snapshot: ProcessingSnapshot,
  stepId: string,
  completedAt: string
): ProcessingResult<ProcessingSnapshot> {
  if (!_isKnownStepId(stepId)) {
    return {
      ok: false,
      reason: `Unknown step ID "${stepId}".`,
      snapshot
    };
  }

  const targetStep = snapshot.steps.find((s) => s.id === stepId);
  if (!targetStep) {
    return {
      ok: false,
      reason: `Step "${stepId}" not found in snapshot.`,
      snapshot
    };
  }

  if (targetStep.status !== "active") {
    return {
      ok: false,
      reason: `Step "${stepId}" is in state "${targetStep.status}" and cannot be completed (only active steps can be completed).`,
      snapshot
    };
  }

  const newSteps = snapshot.steps.map((step) =>
    step.id === stepId
      ? { ...step, status: "completed" as const, completedAt }
      : { ...step }
  );

  return {
    ok: true,
    snapshot: { ...snapshot, steps: newSteps }
  };
}

// ---------------------------------------------------------------------------
// appendProcessingLog
//
// Appends a log entry to the snapshot.
// Invariants:
//   - log.id must not already exist in snapshot.logs.
//   - log.stepId must be a known step ID.
// ---------------------------------------------------------------------------
export function appendProcessingLog(
  snapshot: ProcessingSnapshot,
  log: TaskLog
): ProcessingResult<ProcessingSnapshot> {
  if (!_isKnownStepId(log.stepId)) {
    return {
      ok: false,
      reason: `Unknown step ID "${log.stepId}" in log "${log.id}".`,
      snapshot
    };
  }

  const duplicate = snapshot.logs.some((existing) => existing.id === log.id);
  if (duplicate) {
    return {
      ok: false,
      reason: `Duplicate log ID "${log.id}".`,
      snapshot
    };
  }

  return {
    ok: true,
    snapshot: {
      ...snapshot,
      logs: [...snapshot.logs, { ...log }]
    }
  };
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

function _isKnownStepId(stepId: string): stepId is OrderedStepId {
  return (ORDERED_STEP_IDS as readonly string[]).includes(stepId);
}

/**
 * Returns a new steps array with `stepId` set to "active", or null if the
 * step cannot be found.  Does not mutate the input array.
 */
function _activateStep(
  steps: readonly ProcessingStep[],
  stepId: string
): readonly ProcessingStep[] | null {
  const found = steps.some((s) => s.id === stepId);
  if (!found) return null;

  return steps.map((step) =>
    step.id === stepId
      ? { ...step, status: "active" as const }
      : { ...step }
  );
}

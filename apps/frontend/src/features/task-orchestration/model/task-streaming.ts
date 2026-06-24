/**
 * task-streaming.ts
 *
 * Pure, immutable partial-result streaming model for the Task & Orchestration
 * PA5 prototype (Task 9A).
 *
 * Invariants enforced here:
 *   - Fragments append in order; duplicate fragment IDs are rejected.
 *   - Sequence numbers start at 1 and increase contiguously.
 *   - Phase transitions: idle → streaming → exhausted (one-way).
 *   - Input objects and arrays are never mutated.
 *   - No lifecycle status ownership — streaming does not complete tasks.
 *   - No global time source, randomness, timer, or React dependency.
 */

// ---------------------------------------------------------------------------
// StreamingSnapshot — authoritative partial-result state
// ---------------------------------------------------------------------------

export interface TaskStreamingFragment {
  readonly id: string;
  readonly sequence: number;
  readonly text: string;
  readonly appendedAt: string;
}

export type TaskStreamingPhase = "idle" | "streaming" | "exhausted";

export interface TaskStreamingSnapshot {
  readonly phase: TaskStreamingPhase;
  readonly fragments: readonly TaskStreamingFragment[];
  readonly startedAt: string | null;
  readonly exhaustedAt: string | null;
}

/** First sequence number assigned to the initial fragment. */
export const INITIAL_STREAMING_SEQUENCE = 1;

// ---------------------------------------------------------------------------
// Result types — all operations are total (never throw)
// ---------------------------------------------------------------------------

export type StreamingResult<T> =
  | { ok: true; snapshot: T }
  | { ok: false; reason: string; snapshot: TaskStreamingSnapshot };

// ---------------------------------------------------------------------------
// createInitialStreamingSnapshot
// ---------------------------------------------------------------------------

export function createInitialStreamingSnapshot(): TaskStreamingSnapshot {
  return {
    phase: "idle",
    fragments: [],
    startedAt: null,
    exhaustedAt: null
  };
}

// ---------------------------------------------------------------------------
// startStreaming
// ---------------------------------------------------------------------------

export function startStreaming(
  snapshot: TaskStreamingSnapshot,
  startedAt: string
): StreamingResult<TaskStreamingSnapshot> {
  if (snapshot.phase !== "idle") {
    return {
      ok: false,
      reason: `Cannot start streaming from phase "${snapshot.phase}".`,
      snapshot
    };
  }

  return {
    ok: true,
    snapshot: {
      phase: "streaming",
      fragments: [],
      startedAt,
      exhaustedAt: null
    }
  };
}

// ---------------------------------------------------------------------------
// appendStreamingFragment
// ---------------------------------------------------------------------------

export function appendStreamingFragment(
  snapshot: TaskStreamingSnapshot,
  fragment: TaskStreamingFragment
): StreamingResult<TaskStreamingSnapshot> {
  if (snapshot.phase !== "streaming") {
    return {
      ok: false,
      reason: `Cannot append fragment while phase is "${snapshot.phase}".`,
      snapshot
    };
  }

  const expectedSequence =
    snapshot.fragments.length + INITIAL_STREAMING_SEQUENCE;

  if (fragment.sequence !== expectedSequence) {
    return {
      ok: false,
      reason: `Expected sequence ${expectedSequence} but received ${fragment.sequence}.`,
      snapshot
    };
  }

  const duplicateId = snapshot.fragments.some(
    (existing) => existing.id === fragment.id
  );
  if (duplicateId) {
    return {
      ok: false,
      reason: `Duplicate fragment ID "${fragment.id}".`,
      snapshot
    };
  }

  return {
    ok: true,
    snapshot: {
      ...snapshot,
      fragments: [...snapshot.fragments, { ...fragment }]
    }
  };
}

// ---------------------------------------------------------------------------
// exhaustStreaming
// ---------------------------------------------------------------------------

export function exhaustStreaming(
  snapshot: TaskStreamingSnapshot,
  exhaustedAt: string
): StreamingResult<TaskStreamingSnapshot> {
  if (snapshot.phase !== "streaming") {
    return {
      ok: false,
      reason: `Cannot exhaust streaming from phase "${snapshot.phase}".`,
      snapshot
    };
  }

  return {
    ok: true,
    snapshot: {
      ...snapshot,
      phase: "exhausted",
      exhaustedAt
    }
  };
}

// ---------------------------------------------------------------------------
// selectAccumulatedPartialText
// ---------------------------------------------------------------------------

export function selectAccumulatedPartialText(
  snapshot: TaskStreamingSnapshot
): string {
  return snapshot.fragments.map((fragment) => fragment.text).join("");
}

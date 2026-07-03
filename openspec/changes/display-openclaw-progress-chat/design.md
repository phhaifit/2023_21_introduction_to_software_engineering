## Context

The backend connects to OpenClaw Gateway through the OpenAI-compatible `POST /v1/chat/completions` stream. That stream reliably carries assistant text chunks, while tool/search/session progress is optional and may arrive as `openclaw_extension`, OpenAI-style tool-call deltas, or Gateway WebSocket session frames.

The frontend already has provider-neutral state actions for provider steps, processing logs, partial output, and compact assistant progress. The gap is that several provider activity shapes are not normalized, and the chat partial-output display still relies on mock pipeline step IDs.

## Goals / Non-Goals

**Goals:**

- Normalize more safe OpenClaw activity shapes into `sub-activity` events.
- Treat reasoning/thinking progress as provider activity without exposing raw reasoning payloads.
- Display provider-originated activity and partial text in the chat assistant message from provider-neutral state.
- Keep changes small and within Task & Orchestration boundaries.

**Non-Goals:**

- No OpenClaw Gateway schema changes.
- No new production dependency.
- No Prisma, shared public contract, or API route shape changes.
- No attempt to synthesize provider activity that OpenClaw did not supply.

## Decisions

- Use the existing `sub-activity` contract instead of adding a new shared event union member. This avoids a cross-module shared contract change and fits the existing observability projection model.
- Expand backend mapping in `OpenClawHttpSSETransport` and `OpenClawRawEventMapper` to detect safe activity hints from `openclaw_extension`, OpenAI-compatible `delta.tool_calls`, and Gateway frame names/payloads.
- Represent thinking/reasoning as provider-diagnostic or message-style activity with safe display labels and sanitized summaries. Raw chain-of-thought is not surfaced.
- Relax chat partial-output rendering so HTTP/OpenClaw partial output is visible whenever accumulated text exists for a running task.

## Risks / Trade-offs

- Gateway frame schema may vary -> classifier must be defensive and ignore unknown shapes safely.
- Reasoning events may contain sensitive content -> only short sanitized labels/summaries are projected.
- Additional provider activity can create many dynamic steps -> frontend already limits compact recent steps and backend/adapter keeps bounded event history.

## Migration Plan

No data migration is required. Existing tasks continue to use the same API and state contracts. If OpenClaw does not emit optional progress, the UI continues to show partial/final output.

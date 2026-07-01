## Why

OpenClaw agent synchronization can emit transient failures such as `set-identity` errors even when the command is valid, because the current materializer can mirror the same workspace more than once and can run concurrent materialization for the same agent. This causes unnecessary Gateway reload pressure and can temporarily omit the native OpenClaw agent header during task execution.

## What Changes

- Make filesystem-backed OpenClaw agent materialization idempotent for an unchanged runtime profile.
- Coalesce concurrent materialization requests for the same workspace agent into one in-flight operation.
- Mirror OpenClaw artifacts once per materialization attempt and remove duplicate mirror calls.
- Preserve retry behavior after failed mirror/materialization attempts.
- Improve OpenClaw agent sync warning details while keeping logs concise and safe.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `openclaw-task-execution`: native OpenClaw agent materialization must be idempotent, race-safe, retryable after failure, and avoid duplicate Gateway mirror operations before emitting native agent headers.
- `agent-runtime-profile`: runtime profile `updatedAt` is the cache boundary for reusing already materialized agent artifacts.

## Impact

- Affected code: backend OpenClaw agent materializer and local server sync diagnostics.
- Affected tests: focused backend unit tests for materializer idempotency, concurrency, mirror count, and retry behavior.
- APIs: no public HTTP API changes.
- Shared contracts: no shared contract change.
- Database/Prisma: no schema or migration changes.
- Dependencies: no new production dependency.

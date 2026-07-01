## Context

Task & Orchestration consumes Agent Management runtime profiles and prepares OpenClaw-facing artifacts before sending a specific agent request to the Gateway. The current filesystem materializer writes local artifacts, mirrors them to the OpenClaw container, updates the native registration, and writes `agents.list.json`.

The failure being investigated is not caused by an invalid `openclaw agents set-identity` command: the exact command succeeds against the running container. The more likely cause is repeated and concurrent materialization of the same agent, which can trigger redundant Docker copies, `agents add/list/set-identity` commands, and Gateway config reload/restart windows.

## Goals / Non-Goals

**Goals:**

- Ensure one workspace agent has at most one active materialization operation in the process.
- Reuse an already materialized agent when the runtime profile `updatedAt` has not changed.
- Remove the duplicate mirror call after a native OpenClaw agent ID has already been returned.
- Allow a later request to retry normally after a failed materialization.
- Keep warning logs concise while exposing command exit context useful for diagnosis.

**Non-Goals:**

- Do not change Agent Management runtime profile contracts.
- Do not manage OpenClaw container lifecycle or Gateway restart behavior.
- Do not add a persistent materialization database.
- Do not change public Task Orchestration API responses.

## Decisions

1. Add an in-memory in-flight map keyed by `workspaceId:agentId`.

   Rationale: `validateAndGetAgent` and `listAvailableAgents` can request the same profile close together. Sharing the same promise prevents duplicate Docker/OpenClaw CLI calls within one backend process.

   Alternative considered: serialize all agent materialization globally. This would avoid duplicates but would unnecessarily block unrelated agents and workspaces.

2. Use `profile.updatedAt` as the idempotency boundary.

   Rationale: Agent Management already exposes `updatedAt` as the runtime profile freshness marker. If the materialized record has the same timestamp, the existing artifacts and native mapping can be reused safely.

   Alternative considered: hash generated `skill.md` and `agent.json`. That is more precise but adds complexity without a current contract need.

3. Mirror once per materialization attempt.

   Rationale: the mirror is responsible for copying artifacts and returning the native OpenClaw mapping. Calling it again immediately after updating `agents.list.json` amplifies Gateway reload pressure and makes transient `set-identity` failures more likely.

   Alternative considered: keep the second mirror to push the updated `agents.list.json`. The native mapping can be recorded locally after the first mirror, and the next profile update can mirror again.

4. Clear in-flight state in `finally`.

   Rationale: failed materialization must not poison the process. Later task submissions should retry.

5. Format sync errors locally at the catalog boundary.

   Rationale: the fallback behavior remains the same, but warning output should include bounded `code`, `signal`, `stdout`, and `stderr` snippets when available.

## Risks / Trade-offs

- Cached materialization is process-local, so a backend restart will materialize again on first use. This is acceptable because the mirror remains idempotent and avoids adding persistence.
- Removing the second mirror means `agents.list.json` with a native ID may not be copied immediately in the same attempt. Runtime request headers use the returned native mapping directly, and the next changed profile mirrors the updated file.
- In-memory locks do not coordinate across multiple backend processes. The current local runtime uses one process; distributed locking can be added later if deployment requires it.

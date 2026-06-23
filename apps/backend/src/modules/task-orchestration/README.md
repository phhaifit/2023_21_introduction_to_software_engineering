# Task & Orchestration Module Foundation

Owner: Member 8

OpenSpec change: `implement-task-orchestration`

## Context and Motivation

Task & Orchestration accepts a workspace member's request, records the durable
task intent, resolves an authoritative route, and tracks one or more execution
attempts until a terminal outcome is reached.

The PA5 frontend remains a deterministic prototype, but Task 6 and later work
must align with this production-facing boundary. This document defines that
boundary without implementing Prisma models, HTTP handlers, repositories,
services, workers, or events.

## Ownership

This module owns:

* `Task`: the submitted intent, prompt, requested routing policy, submitter,
  workspace, aggregate status, and final outcome reference.
* `TaskWork`: one execution attempt for a task, including its Work ID,
  resolved route, lifecycle status, timestamps, failure metadata, and result.
* Task lifecycle transition rules.
* Routing-request validation and routing-resolution records.
* Task processing logs, timeline entries, cancellation state, and result
  aggregation when those records are introduced.

This module references but does not own:

* `Workspace` and workspace membership from Workspace Management and Workspace
  User Management.
* `User` identity from Authentication.
* `Agent` from Agent Management.
* `Workflow` from Workflow Management.
* Tools, knowledge documents, subscriptions, and runtime resources owned by
  their respective modules.

The module must not create or own Workspace, User, Agent, or Workflow tables.

## Tenant and Identity Boundary

`workspaceId` and `submittedByUserId` are authoritative values from
`RequestContext`.

The public route is:

```text
POST /api/workspaces/:workspaceId/tasks
```

The route parameter is a resource locator, not trusted tenant input. The API
adapter receives `RequestContext` from authentication and membership
middleware, requires the route `workspaceId` to equal
`context.workspace.workspaceId`, and builds the application command from
context. Missing authentication returns HTTP 401. Missing membership,
permission failure, or route/context mismatch returns HTTP 403. Successful
creation returns HTTP 201. The request body must not accept `workspaceId`,
`submittedByUserId`, Task ID, Work ID, status, resolved route, or timestamps.
No records or events are created when authorization or workspace equality
fails.

## Domain Model

`Task` and `TaskWork` have a one-to-many relationship. Initial creation produces
exactly one `TaskWork`. The model permits later retries or reruns without
overwriting the original attempt or changing the original task identity.

The authoritative production status model is `TaskStatus` from `@vcp/shared`:

```text
queued
running
requires_action
succeeded
failed
cancelled
```

Both `Task` and `TaskWork` use this production enum and start as `queued`.

| Production `TaskStatus` | PA5 presentation status |
| --- | --- |
| `queued` | `pending` |
| `running` | `in-progress` |
| `requires_action` | Not produced by the PA5 prototype |
| `succeeded` | `completed` |
| `failed` | `failed` |
| `cancelled` | `canceled` |

This mapping belongs only at the frontend API-adapter/view-model boundary. It
does not belong in the domain, Prisma mapper, or shared production contract.
The existing frontend type named `TaskStatus` must be renamed to
`TaskPresentationStatus` in a later implementation phase; PR F0 does not
perform that source-code rename. Two incompatible public types named
`TaskStatus` must not remain authoritative.

Required aggregate fields:

```text
Task
  taskId
  workspaceId
  submittedByUserId
  prompt
  routingMode
  requestedAgentId?
  requestedWorkflowId?
  status
  createdAt
  updatedAt
  completedAt?

TaskWork
  workId
  taskId
  workspaceId
  attemptNumber
  status
  resolvedAgentId?
  resolvedWorkflowId?
  result?
  errorCode?
  errorMessage?
  queuedAt
  startedAt?
  finishedAt?
  createdAt
  updatedAt
```

## Routing Invariants

The authoritative routing modes are `auto`, `specific-agent`, and
`predefined-workflow`.

* `auto`: requested agent and requested workflow are both absent.
* `specific-agent`: requested agent is present and requested workflow is
  absent.
* `predefined-workflow`: requested workflow is present and requested agent is
  absent.
* A referenced agent or workflow must belong to the same workspace.
* A specific agent must be selectable; a workflow must be executable.
* The client requests a routing policy. The application service validates it.
* The resolver writes the resolved route to `TaskWork`; it does not rewrite the
  requested route on `Task`.
* Agent and workflow references are scalar typed IDs, not Prisma relations,
  because those aggregates are owned by other modules.

## Public API Contract

Request body:

```ts
type CreateTaskRequest = {
  prompt: string;
  routing:
    | { mode: "auto" }
    | { mode: "specific-agent"; agentId: EntityId<"agentId"> }
    | { mode: "predefined-workflow"; workflowId: EntityId<"workflowId"> };
};
```

Successful response uses `ApiSuccess<CreateTaskResponse>` with HTTP 201:

```ts
type CreateTaskResponse = {
  taskId: EntityId<"taskId">;
  workId: EntityId<"workId">;
  status: "queued";
  routingMode: TaskRoutingMode;
  requestedTargetId?: EntityId<"agentId"> | EntityId<"workflowId">;
  createdAt: string;
};
```

Expected failures use the shared `ApiFailure` envelope: unauthenticated,
forbidden or workspace mismatch, invalid prompt/routing, unavailable target,
and unexpected failure. Prisma records are never returned as API contracts.

The internal command is:

```ts
type CreateTaskCommand = {
  workspaceId: EntityId<"workspaceId">;
  submittedByUserId: EntityId<"userId">;
  prompt: string;
  routing: CreateTaskRequest["routing"];
};
```

Only the API adapter may combine transport input with authenticated context to
construct this command.

## Shared and Private Contracts

The following identity kinds already come from `@vcp/shared` through
`EntityId`:

* `EntityId<"workspaceId">`
* `EntityId<"userId">`
* `EntityId<"agentId">`
* `EntityId<"workflowId">`
* `EntityId<"taskId">`

Task & Orchestration imports and consumes these identities. It must not
redefine or re-export another module's identity ownership. `workId` does not
currently exist. `EntityId<"workId">` is a proposed reviewed shared-contract
extension for a later contract PR; PR F0 does not implement it. The approved
design does not use an untyped raw-string fallback.

The future shared-contract change is limited to values required across the
frontend, backend, workers, or event consumers:

* `workId` in `EntityIdKind`.
* `TaskRoutingMode` and the discriminated public routing request.
* `CreateTaskRequest` and `CreateTaskResponse`.
* Proposed versioned task domain-event names and payloads, subject to the
  reviewed envelope extension.
* Existing shared `TaskStatus` remains the production lifecycle vocabulary.

Domain entities, repository records, Prisma mappers, transition guards,
resolved-route details, logs, timeline records, failure internals, and service
commands remain private to this module.

Any shared change requires the active specification, contract tests, and
another module owner's review.

## Persistence Plan

Future Prisma models are `Task` and `TaskWork`, mapped to `tasks` and
`task_works`.

Repository conventions:

* String application-generated IDs: `taskId` and `workId`.
* `workId` is the public Work ID and Prisma primary key. There is no separate
  internal `id` and no duplicate Work ID column.
* `attemptNumber` starts at 1. Initial Task creation creates exactly one
  TaskWork with attempt number 1.
* Every retry creates a new TaskWork row with a new Work ID while the Task row
  remains the same.
* Attempt numbers are unique within a Task through
  `@@unique([taskId, attemptNumber])`.
* Retry allocation and concurrency control are implementation concerns for a
  later application/persistence phase.
* Required `workspaceId` on both records for tenant-scoped queries.
* `TaskWork.taskId` is the only owned Prisma relation, with restrictive
  deletion behavior.
* Scalar agent and workflow IDs have no Prisma foreign keys or relations.
* Indexes on `(workspaceId, createdAt)`, `(workspaceId, status)`, `taskId`, and
  `(workspaceId, workId)`.
* No soft-delete field and no task deletion API in the foundation. Execution
  history is retained; retention or erasure requires a separate specification.

```prisma
model TaskWork {
  workId        String @id
  taskId        String
  attemptNumber Int

  @@unique([taskId, attemptNumber])
}
```

The current Prisma schema persists timestamps in `String` fields containing
application-supplied ISO-8601 values. Domain, API, and event contracts represent
timestamps as ISO-8601 strings; the repository does not currently use Prisma
`DateTime` or JavaScript `Date` domain fields.

## Domain Events

The current shared event envelope is:

```ts
{
  name,
  eventId,
  occurredAt,
  payload
}
```

`task.submitted` remains the canonical submission event.

Task events propose a top-level `version: 1` field. This is not part of the
current `BaseDomainEvent` contract and requires a reviewed shared-contract
extension and contract-test update before implementation.

| Event | Aggregate | Trigger | Required references |
| --- | --- | --- | --- |
| `task.submitted` | Task | Task and initial TaskWork are created | `taskId`, initial `workId` |
| `task.routing_resolved` | TaskWork | Routing for one execution attempt is resolved | `taskId`, `workId` |
| `task.started` | TaskWork | One attempt starts | `taskId`, `workId` |
| `task.completed` | Task terminal event | One attempt completes the Task successfully | `taskId`, completed `workId` |
| `task.failed` | Task terminal event | The Task becomes terminally failed | `taskId`, terminal `workId` |
| `task.cancelled` | Task terminal event | The Task is cancelled | `taskId`, active or latest `workId` |

A failed attempt alone must not automatically emit terminal `task.failed`.
Retry-attempt events and aggregate Task terminal events are not interchangeable.

Events describe committed state and are published only after successful
persistence. Event payloads expose IDs, status, routing mode, and safe failure
codes; they do not expose prompts, result bodies, logs, or stack traces.

## Application and Persistence Boundaries

Required private interfaces:

* `TaskRepository`: create the Task with its initial TaskWork atomically, find
  by `(workspaceId, taskId)`, and update aggregate lifecycle state.
* `TaskWorkRepository`: find by `(workspaceId, workId)`, list attempts, and
  perform guarded lifecycle/result updates.
* `AgentRoutingCatalog`: verify same-workspace agent availability.
* `WorkflowRoutingCatalog`: verify same-workspace workflow executability.
* `TaskEventPublisher`: publish task events through the shared envelope and the
  proposed versioned extension once approved.
* `CreateTaskService`: validate, create IDs, persist queued records, and emit
  `task.submitted`.
* `TaskRoutingService`: validate or resolve routing and record the authoritative
  route on TaskWork.
* `TaskExecutionService`: coordinate workers and lifecycle transitions in later
  tasks.

Repositories accept `workspaceId` for every lookup or mutation. Services do not
import another capability's private repository or service.

## Testing Plan

Foundation tests must verify:

* Architecture documentation contains owned and referenced entities.
* The route body cannot provide tenant or submitter identity.
* Routing is a discriminated union and invalid target combinations are
  rejected.
* Repository interfaces require workspace-scoped identifiers.
* Prisma design contains tenant indexes and only owned relations.
* Shared contracts do not expose Prisma-generated types.
* Event names, proposed versions, required identifiers, and safe payload rules.
* Task 6 is gated on the completed foundation.

Later implementation adds domain, contract, repository, API, and tenant
isolation tests with the behavior it introduces.

## Task 6 Dependency

Task 6 may implement the deterministic PA5 creation flow only after Task 5A is
complete. Its task factory and store must preserve the same routing union,
identity separation, initial-state semantics, and authoritative transition
boundary so the prototype can later connect to the production API without
changing user-visible behavior.

## Explicit Non-Goals

This foundation does not implement Prisma models or migrations, API handlers,
repositories, services, workers, domain events, real agent/workflow lookup,
streaming, cancellation, retries, or external orchestration.

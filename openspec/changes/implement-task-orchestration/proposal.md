## Why

Users need a single place to submit work and receive final results from direct agents, workflows, or automatic routing. This change defines the task orchestration runtime behavior for V1.

## What Changes

- Add task submission with prompt and optional target agent or workflow.
- Add routing mode for direct agent, workflow, or simple automatic router.
- Add sequential multi-agent workflow execution for V1.
- Add logged handoff/context sharing between steps.
- Add task result aggregation and status tracking.

## Capabilities

### New Capabilities
- `task-orchestration`: Task submission, routing, direct agent execution, workflow execution coordination, sequential multi-agent handoff, status tracking, and result display.

### Modified Capabilities
No existing capability requirements change in this proposal.

## Impact

- Backend module: `apps/backend/src/modules/task-orchestration`
- Frontend feature: `apps/frontend/src/features/task-orchestration`
- Worker job: `apps/workers/src/jobs/task-execution`
- Shared infrastructure: events, queue runner, logging, OpenClaw runtime adapter boundary
- Related modules: agent, workflow, tools, and knowledge-base modules are consumed through public contracts

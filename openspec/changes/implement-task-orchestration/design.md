## Context

Task orchestration is the runtime coordination layer for user prompts. It consumes public contracts from agent management, workflow management, tools integration, and knowledge base, then delegates long-running execution through the task worker and OpenClaw adapter boundary.

## Goals / Non-Goals

**Goals:**
- Accept user task submissions with prompt and optional target.
- Support direct agent, workflow, and simple automatic routing modes.
- Execute V1 multi-agent workflows sequentially.
- Track task status, step handoffs, logs, and final result.
- Use workers for long-running execution.

**Non-Goals:**
- Fully autonomous multi-agent planning.
- Parallel graph execution.
- Model-provider billing or advanced prompt optimization.
- Direct ownership of agent, workflow, tool, or knowledge-base CRUD.

## Decisions

1. Use a task record as the durable execution source of truth.
   - Rationale: Users need status and results even when execution is asynchronous.
   - Alternative considered: Return only live execution responses. Rejected because long-running tasks need persistence.

2. Support three routing modes: direct agent, workflow, and simple auto-router.
   - Rationale: These map directly to the requirement while keeping V1 bounded.
   - Alternative considered: Full autonomous planner. Rejected for V1 because it is too broad for one module.

3. Run multi-agent workflow steps sequentially in V1.
   - Rationale: It matches the foundation decision and simplifies debugging and testing.
   - Alternative considered: Parallel or branching execution. Rejected for V1.

4. Consume other modules through public contracts only.
   - Rationale: Task orchestration coordinates modules but should not own their private data.

## Risks / Trade-offs

- Runtime execution may be slow or fail -> Use queued worker jobs and explicit task statuses.
- Auto-routing may be naive in V1 -> Make routing decisions logged and explainable.
- Cross-module contracts may evolve -> Keep integration points small and covered by contract tests.

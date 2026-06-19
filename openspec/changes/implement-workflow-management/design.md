## Context

Workflow management owns reusable process definitions made from ordered agent steps. Task orchestration owns actual execution. This split lets one team build workflow CRUD while another team builds the runtime that consumes workflow definitions.

## Goals / Non-Goals

**Goals:**
- Implement workflow list and detail views.
- Create and edit workflow definitions with ordered agent steps.
- Validate referenced agents and step configuration.
- Trigger workflow execution through a public request to task orchestration or the worker boundary.
- Track workflow definition status.

**Non-Goals:**
- Execute agent tasks inside the workflow management module.
- Build a visual drag-and-drop workflow editor in V1.
- Implement complex branching or parallel workflow execution.

## Decisions

1. Model V1 workflows as ordered sequential steps.
   - Rationale: The foundation selected sequential workflow behavior for V1 and it is testable by a single member.
   - Alternative considered: Graph-based branching workflows. Rejected for V1 because it expands validation and runtime complexity.

2. Keep execution outside this module.
   - Rationale: Workflow management defines what should happen; task orchestration runs it.
   - Alternative considered: Execute workflows directly from workflow controllers. Rejected because it mixes definition CRUD with runtime concerns.

3. Validate agent references through public agent summaries.
   - Rationale: Workflow management should not import private agent management repositories.
   - Alternative considered: Query agent tables directly. Rejected because it violates module boundaries.

4. Use status fields for draft, active, and archived workflows.
   - Rationale: Users need to control which workflows can be executed without deleting historical definitions.

## Risks / Trade-offs

- Workflow execution depends on task orchestration availability -> Emit or call a public execution request and handle unavailable runtime gracefully.
- Agent deletion can break workflows -> Validate before activation and report missing/disabled agents.
- Sequential V1 workflows are limited -> Keep the model extensible for future branching without implementing it now.

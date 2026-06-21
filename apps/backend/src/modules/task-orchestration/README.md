# Task & Orchestration Module

Owner: Member 8

Future feature spec: create a dedicated per-module OpenSpec change before implementing this module.

Foundation reference: see `docs/module-ownership.md`.

Boundary:

- Own task submission, routing decisions, multi-agent handoff, execution state, and final result aggregation.
- Consume agent, workflow, tool, and knowledge contracts without importing their internals.
- Keep long-running execution in workers.

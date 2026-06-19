# Agent Management Module

Owner: Member 5

Future feature spec: create a dedicated per-module OpenSpec change before implementing this module.

Foundation reference: see `docs/module-ownership.md`.

Boundary:

- Own agent listing, creation, editing, status changes, and `skill.md` generation.
- Publish agent creation/update events for orchestration and tool assignment.
- Do not execute tasks; task runs belong to Task & Orchestration.

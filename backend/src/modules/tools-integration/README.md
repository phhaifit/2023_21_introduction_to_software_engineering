# Tools & Integration Module

Owner: Member 6

Future feature spec: create a dedicated per-module OpenSpec change before implementing this module.

Foundation reference: see `docs/module-ownership.md`.

Boundary:

- Own tool catalog, quick integration metadata, secure credential references, and tool-agent assignments.
- Never expose raw API keys, tokens, or secret values after creation.
- Do not execute agent tasks; make assigned tool metadata available to orchestration.

# sync-openclaw-agent-materialization

## Why

Platform agents currently expose Agent Management runtime profiles and generated
`skill.md` content, but local OpenClaw execution only receives platform agent
metadata as routing context. When the backend sends a platform ID as a native
OpenClaw agent ID, the Gateway can reject the request with `Unknown agent`.

## What Changes

- Add an OpenClaw agent materialization boundary outside Agent Management.
- Materialize enabled Agent Management runtime profiles into an OpenClaw-facing
  filesystem workspace when configured.
- Return a verified native OpenClaw agent ID to Task Execution only after
  materialization succeeds.
- Keep Agent Management control-plane only; it still does not call OpenClaw.

## Out of Scope

- OpenClaw container provisioning or lifecycle management.
- Gateway credential creation.
- Workflow materialization.
- Tool/KB permission resolution beyond existing routing context.

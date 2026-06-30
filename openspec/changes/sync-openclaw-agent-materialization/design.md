# Design

## Boundary

Agent Management remains the source of truth for platform agent configuration
and runtime profiles. OpenClaw materialization belongs to the OpenClaw
integration boundary consumed by Task Execution.

The local backend wires an `OpenClawAgentMaterializer` between the public Agent
Management runtime profile reader and the Task Execution `ExternalAgentCatalog`.

## Filesystem Materialization

When `OPENCLAW_AGENT_WORKSPACE_DIR` is configured, the materializer writes:

- `<base>/<workspaceId>/<agentDirectoryName>/skill.md`
- `<base>/<workspaceId>/<agentDirectoryName>/agent.json`
- `<base>/<workspaceId>/agents.list.json`

The native OpenClaw agent ID is the runtime profile `agentDirectoryName`. The
Task Execution adapter sends `x-openclaw-agent-id` only when this materializer
returns a verified native ID.

If the filesystem materializer is not configured or fails, Task Execution still
sends platform routing context but does not send the native agent header.

## Local Docker Mirror

When `OPENCLAW_AGENT_MIRROR_CONTAINER` and `OPENCLAW_AGENT_MIRROR_DIR` are
configured, the filesystem materializer mirrors the completed workspace artifact
directory into the running OpenClaw Gateway container after each successful
materialization.

The local mirror uses Docker CLI operations only from the local composition
root. It does not provision containers, create credentials, or inspect container
environment variables.

## Safety

- Agent Management does not import OpenClaw transport code.
- The materializer does not provision containers or manage Gateway credentials.
- Failed materialization is non-fatal for listing/routing context but prevents
  native OpenClaw agent header usage.

## Why

Agent Management already generates skill configuration content in memory (`generateAgentSkillConfiguration`), but that content is never persisted to the file system. For agents to be usable by the OpenClaw runtime, each agent's skill configuration must be written as a `skill.md` file in the workspace directory. Without this, agents exist only as database records with no operational effect.

## What Changes

- Define a new port interface `AgentSkillWriter` with a single method `writeSkillConfiguration(agent, content)` that writes a skill.md file for an agent.
- Implement `FileSystemAgentSkillWriter` that writes `skill.md` files to a workspace-scoped directory on disk.
- Inject `AgentSkillWriter` into `AgentLifecycleUseCases` as an optional dependency.
- Call the writer in `saveMutation` (after create/update) so that every mutation automatically persists the skill file.
- Provide a no-op writer (`NoOpAgentSkillWriter`) for tests and environments where file writing is not needed.
- Add unit tests for the writer invocation and integration tests for the file system writer.
- Agent Management does NOT call Docker or OpenClaw directly — it only writes the configuration file.

## Capabilities

### New Capabilities
- `agent-skill-writer`: Automatic persistence of agent skill configuration files to the workspace file system upon agent creation or update.

### Modified Capabilities
_(None — the existing `agent-management` spec already mentions "prepares the corresponding skill configuration content" in the create/update scenarios. This change implements the write side without changing spec-level requirements.)_

## Impact

- **Application layer**: `AgentLifecycleUseCases` gains a new optional dependency `skillWriter?: AgentSkillWriter`. The `saveMutation` method calls the writer after persisting to the repository.
- **Infrastructure layer**: New file `file-system-agent-skill-writer.ts` implements the writer using Node.js `fs` module.
- **Composition root**: `local-agent-management-server.ts` injects the file system writer when a workspace output directory is configured (env `AGENT_SKILLS_DIR`).
- **Tests**: Existing domain/lifecycle tests remain on `NoOpAgentSkillWriter`. New tests verify file output.
- **Dependencies**: No new npm packages — uses built-in `node:fs/promises`.

## 1. Port Interface

- [x] 1.1 Create `backend/src/modules/agent-management/application/agent-skill-writer.ts` defining the `AgentSkillWriter` type with method `writeSkillConfiguration(agent: Agent, content: string): Promise<void>`

## 2. Implementations

- [x] 2.1 Create `backend/src/modules/agent-management/infrastructure/file-system-agent-skill-writer.ts` implementing `AgentSkillWriter` using `node:fs/promises` — writes to `<baseDir>/<workspaceId>/<agentId>/skill.md` with recursive `mkdir`
- [x] 2.2 Create `backend/src/modules/agent-management/infrastructure/no-op-agent-skill-writer.ts` implementing `AgentSkillWriter` as a no-op (empty async method)

## 3. Use Cases Integration

- [x] 3.1 Add `skillWriter?: AgentSkillWriter` to `AgentLifecycleDependencies` type
- [x] 3.2 Update `saveMutation` in `AgentLifecycleUseCases` to call `skillWriter?.writeSkillConfiguration(saved, skillConfiguration)` wrapped in try/catch with error logging

## 4. Composition Root

- [x] 4.1 Update `local-agent-management-server.ts` to read `AGENT_SKILLS_DIR` env var and inject `FileSystemAgentSkillWriter` or `NoOpAgentSkillWriter` into `AgentLifecycleUseCases`
- [x] 4.2 Add `AGENT_SKILLS_DIR` to `.env.example` with a descriptive comment

## 5. Unit Tests (Writer Invocation)

- [x] 5.1 Create `tests/contract/agent-management-skill-writer.test.mjs`
- [x] 5.2 Test: `createAgent` calls the skill writer once with correct agent and content
- [x] 5.3 Test: `updateAgent` calls the skill writer once with updated content
- [x] 5.4 Test: skill writer throws → agent is still saved, error is caught (does not propagate)

## 6. Integration Tests (File System Writer)

- [x] 6.1 Create `tests/contract/agent-management-skill-file-system.test.mjs`
- [x] 6.2 Test: write skill file → read back → content matches generated skill configuration
- [x] 6.3 Test: overwrite existing skill file → content is updated
- [x] 6.4 Test: target directory does not exist → directory is created automatically
- [x] 6.5 Cleanup: remove temp directory after all tests

## 7. Verification

- [x] 7.1 Run `npm test` — all existing and new tests pass
- [x] 7.2 Run `npm run build` — build is successful
- [x] 7.3 Run `openspec validate "write-agent-skill-configuration"` — passes
- [x] 7.4 Run `openspec validate --all --strict` — all pass
- [x] 7.5 Run `git diff --check` — no trailing whitespace

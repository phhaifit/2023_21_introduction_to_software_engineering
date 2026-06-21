## ADDED Requirements

### Requirement: Skill Writer Port Interface
The system SHALL define an `AgentSkillWriter` interface as a port in the application layer, decoupling skill file persistence from business logic.

#### Scenario: Writer interface defined
- **WHEN** the application layer is inspected
- **THEN** an `AgentSkillWriter` type exists with a method `writeSkillConfiguration(agent: Agent, content: string): Promise<void>`

### Requirement: Skill File Written on Agent Creation
The system SHALL invoke the skill writer after a new agent is persisted to the repository.

#### Scenario: Create agent triggers skill write
- **WHEN** a new agent is created successfully
- **THEN** the system calls `writeSkillConfiguration` with the saved agent and the generated skill configuration content

#### Scenario: Writer failure does not block creation
- **WHEN** the skill writer throws an error during agent creation
- **THEN** the agent is still persisted in the repository and the error is logged but does not propagate to the caller

### Requirement: Skill File Written on Agent Update
The system SHALL invoke the skill writer after an existing agent's configuration is updated.

#### Scenario: Update agent triggers skill write
- **WHEN** an agent's role, model, or instructions are updated
- **THEN** the system calls `writeSkillConfiguration` with the updated agent and the regenerated skill configuration content

### Requirement: File System Skill Writer
The system SHALL provide a file system implementation of `AgentSkillWriter` that writes `skill.md` files to a workspace-scoped directory.

#### Scenario: Skill file created on disk
- **WHEN** `writeSkillConfiguration` is called with an agent
- **THEN** the system writes the content to `<baseDir>/<workspaceId>/<agentId>/skill.md`

#### Scenario: Skill file overwritten on update
- **WHEN** `writeSkillConfiguration` is called for an agent whose skill file already exists
- **THEN** the existing file is overwritten with the new content

#### Scenario: Directory created if missing
- **WHEN** `writeSkillConfiguration` is called and the target directory does not exist
- **THEN** the system creates the necessary directories recursively before writing the file

### Requirement: No-Op Skill Writer for Tests
The system SHALL provide a no-op implementation of `AgentSkillWriter` for use in unit tests and environments without file system access.

#### Scenario: No-op writer does nothing
- **WHEN** `writeSkillConfiguration` is called on the no-op writer
- **THEN** no file system operations occur and no errors are thrown

### Requirement: Composition Root Writer Injection
The system SHALL inject the appropriate `AgentSkillWriter` implementation into `AgentLifecycleUseCases` based on runtime configuration.

#### Scenario: File system writer injected when configured
- **WHEN** the environment variable `AGENT_SKILLS_DIR` is set
- **THEN** the composition root injects `FileSystemAgentSkillWriter` with the configured base directory

#### Scenario: No-op writer injected when not configured
- **WHEN** `AGENT_SKILLS_DIR` is not set
- **THEN** the composition root injects `NoOpAgentSkillWriter`

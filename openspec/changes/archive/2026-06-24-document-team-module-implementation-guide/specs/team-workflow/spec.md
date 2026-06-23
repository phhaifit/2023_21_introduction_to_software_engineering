## ADDED Requirements

### Requirement: Team Module Implementation Guide
The project SHALL provide a teammate-facing module implementation guide before teams implement module endpoints and persistence in parallel.

#### Scenario: Teammate starts module work
- **WHEN** a teammate starts implementing an assigned module
- **THEN** the documentation SHALL direct them to read the project overview, requirements, architecture, module ownership, API route matrix, shared contract rules, and their active OpenSpec change before coding
- **AND** the guide SHALL identify the backend and frontend folders the teammate owns
- **AND** the guide SHALL require the teammate to implement only the selected OpenSpec task or module scope

#### Scenario: Module owner checks scope before editing
- **WHEN** a module owner prepares an implementation PR
- **THEN** the guide SHALL provide a checklist for allowed files, out-of-scope files, public API route rows, shared contract impact, Prisma model impact, domain event impact, tests, and verification commands
- **AND** the checklist SHALL require reviewers to reject private cross-module imports or ad hoc public DTOs

#### Scenario: Shared boundary change is needed
- **WHEN** a module owner needs to change shared contracts, Prisma schema, API route boundaries, or domain event definitions
- **THEN** the guide SHALL require the owner to document why the existing boundary is insufficient
- **AND** the owner SHALL update the relevant OpenSpec artifact or foundation spec
- **AND** the owner SHALL run the relevant contract, Prisma, OpenSpec, and repository test commands

### Requirement: Root README Scope
The root README SHALL be a concise project entry point rather than a feature implementation guide.

#### Scenario: New contributor opens README
- **WHEN** a contributor opens the root `README.md`
- **THEN** it SHALL describe the project overview, architecture direction, workspace layout, setup commands, test commands, and links to detailed docs
- **AND** it SHALL NOT contain detailed feature lists, module implementation instructions, or feature-specific manual test procedures

#### Scenario: Contributor needs feature details
- **WHEN** a contributor needs feature requirements, module ownership, API routes, or implementation rules
- **THEN** the README SHALL link to the detailed docs and OpenSpec sources of truth instead of duplicating that content

### Requirement: Onboarding Documentation Verification
The project SHALL include lightweight verification that the onboarding documentation structure remains discoverable and scoped correctly.

#### Scenario: Documentation checks run
- **WHEN** documentation or contract checks run
- **THEN** they SHALL verify that the team module implementation guide exists
- **AND** they SHALL verify that the README links to the required detailed docs
- **AND** they SHALL verify that the README does not contain feature-specific manual test sections

## Purpose

Define how the 9-member team coordinates ownership, OpenSpec usage, and pull request review.

## Requirements

### Requirement: Module Ownership Guide
The foundation SHALL document ownership assignment for the nine future product capabilities.

#### Scenario: Team member receives module assignment
- **WHEN** a member is assigned a capability
- **THEN** the member can find the backend folder, frontend folder, future spec responsibility, and implementation scope from team documentation

### Requirement: OpenSpec Team Workflow
The foundation SHALL document how team members use OpenSpec to read the active change, understand specs, claim tasks, validate changes, and open pull requests.

#### Scenario: New contributor starts a task
- **WHEN** a contributor starts work
- **THEN** the contributor can follow documented OpenSpec commands and artifact-reading order

### Requirement: Pull Request Review Checklist
The foundation SHALL document a pull request checklist that checks OpenSpec linkage, module boundary discipline, contract changes, and verification commands.

#### Scenario: Pull request is reviewed
- **WHEN** a reviewer checks a PR
- **THEN** the reviewer can verify whether the PR references the correct OpenSpec scope, respects module boundaries, and reports tests run

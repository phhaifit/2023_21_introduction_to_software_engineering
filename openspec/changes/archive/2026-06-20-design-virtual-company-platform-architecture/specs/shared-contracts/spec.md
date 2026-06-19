## ADDED Requirements

### Requirement: Shared Identity and Status Contracts
The foundation SHALL define shared entity ID names, workspace roles, permissions, subscription plans, and lifecycle statuses used across modules.

#### Scenario: Module uses shared identity
- **WHEN** a module references users, workspaces, members, agents, tools, workflows, tasks, documents, subscriptions, transactions, events, or jobs
- **THEN** it uses the shared contract names instead of redefining local names

### Requirement: Shared API Contract
The foundation SHALL define a common API success response, API error response, metadata shape, and error code list.

#### Scenario: Module returns an API error
- **WHEN** a future module returns an error response
- **THEN** the response follows the shared error shape and uses a shared error code or a reviewed extension

### Requirement: Shared Domain Event Contract
The foundation SHALL define namespaced domain event names and payload fields for cross-module coordination.

#### Scenario: Module publishes event
- **WHEN** a future module publishes an event for another module to consume
- **THEN** the event uses a shared event name and payload contract

### Requirement: Contract Schema Checks
The foundation SHALL include automated checks that verify required shared contracts and module boundary folders exist.

#### Scenario: Contract checks run
- **WHEN** a developer runs the foundation contract test command
- **THEN** required shared contract values and module boundary folders are verified

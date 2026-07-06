## Purpose

Define approved public retrieval and RAG contracts for downstream modules such as Task & Orchestration and agent workflows without exposing private implementation details.

This specification defines the boundary only and does not require Task & Orchestration code changes in this issue.

## Requirements

### Requirement: Downstream Module Contract
The system SHALL expose approved public retrieval and RAG capabilities for downstream modules without exposing private implementation details.

#### Scenario: Task orchestration requests retrieval or RAG through approved contract
- **WHEN** Task & Orchestration, agent workflows, or another approved downstream module needs workspace knowledge
- **THEN** it requests retrieval or RAG through an approved public Knowledge Base / RAG contract

#### Scenario: Downstream module cannot bypass checks
- **WHEN** a downstream module requests retrieval or RAG
- **THEN** the Knowledge Base / RAG boundary enforces workspace and permission checks before returning data

### Requirement: Safe Evidence Contract
The system SHALL return only safe evidence fields to downstream modules.

#### Scenario: Downstream module receives safe evidence fields
- **WHEN** a downstream module receives retrieval evidence
- **THEN** it receives only safe evidence, score, citation, status, and public metadata fields

### Requirement: Safe Answer Contract
The system SHALL return only safe answer fields to downstream modules.

#### Scenario: Downstream module receives safe answer fields
- **WHEN** a downstream module receives a RAG answer
- **THEN** it receives only safe answer, evidence reference, fallback, status, and public metadata fields

### Requirement: Downstream Permission Enforcement
The system SHALL prevent downstream modules from accessing private Knowledge Base / RAG internals.

#### Scenario: Downstream module cannot access private internals
- **WHEN** a downstream module consumes Knowledge Base / RAG capabilities
- **THEN** it cannot access storage, vector, queue, provider, credential, secret, or runtime internals

### Requirement: Internal Agent Retrieval Tool
The system SHALL expose a JSON-friendly internal tool that retrieves evidence
only from documents actively granted to the target workspace agent.

#### Scenario: Assigned evidence returned safely
- **WHEN** an existing workspace agent invokes the tool with a valid query
- **THEN** the tool delegates to the approved KB/RAG retrieval boundary and returns bounded citation-style evidence from active document grants

#### Scenario: No eligible documents short-circuits retrieval
- **WHEN** no active document grant remains after workspace and optional-filter intersection
- **THEN** the tool returns an empty safe response without calling embedding or vector adapters

#### Scenario: References cannot expand access
- **WHEN** skill/config references or source filters mention knowledge outside the agent's active document grants
- **THEN** the tool does not return that knowledge

### Requirement: Local Agent Ask Integration
The system SHALL provide a local-demo orchestration boundary that consumes the
internal agent retrieval tool and returns a grounded answer or safe fallback.

#### Scenario: Evidence grounds the local answer
- **WHEN** the retrieval tool returns active assigned evidence
- **THEN** the local agent ask boundary returns an evidence-only answer with bounded citations

#### Scenario: Missing evidence returns fallback
- **WHEN** the retrieval tool returns no eligible evidence
- **THEN** the local agent ask boundary returns an insufficient-evidence response without invoking its answer composer

### Requirement: Task Chat Knowledge Consumption
The system SHALL allow the existing Task chat Agent mode to consume assigned
KB/RAG knowledge through an approved backend port.

#### Scenario: Agent-mode task chat renders grounded evidence
- **WHEN** a user selects an agent and sends a Task chat message with active assigned evidence
- **THEN** Task Orchestration delegates to the KB/RAG agent ask boundary and returns the answer and bounded citations in the existing assistant turn

#### Scenario: Task chat cannot expand agent access
- **WHEN** the selected agent has no active assigned evidence
- **THEN** Task chat returns the safe insufficient-evidence response and does not access private retrieval or vector internals

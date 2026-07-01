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

## Purpose

Define grounded RAG answer generation from retrieved evidence, including citations, insufficient-evidence fallback, provider failure handling, and prompt/provider payload safety.

## Requirements

### Requirement: RAG Answer Generation
The system SHALL generate grounded answers using retrieved evidence.

#### Scenario: Answer generated with evidence
- **WHEN** an authorized caller requests a RAG answer with sufficient retrieved evidence
- **THEN** the system generates an answer grounded in that evidence

#### Scenario: Answer remains evidence-bound
- **WHEN** the system generates a RAG answer
- **THEN** the answer is based on approved retrieved evidence for the authorized workspace

### Requirement: Evidence and Citation Handling
The system SHALL return safe evidence references with RAG answers.

#### Scenario: Citation or evidence references returned
- **WHEN** a RAG answer is generated
- **THEN** the system returns citation or evidence references that map to safe public metadata

#### Scenario: Evidence references map safely
- **WHEN** evidence references are returned
- **THEN** they map to safe public document and chunk metadata

### Requirement: Insufficient Evidence Fallback
The system SHALL return a safe fallback when evidence is insufficient.

#### Scenario: Insufficient evidence fallback returned
- **WHEN** retrieved evidence is insufficient to support an answer
- **THEN** the system returns a safe insufficient-evidence fallback

### Requirement: Generation Provider Failure Handling
The system SHALL convert answer-generation provider failures into safe fallbacks.

#### Scenario: Provider error fallback returned
- **WHEN** the generation provider boundary fails
- **THEN** the system returns a safe provider-error fallback

#### Scenario: Raw prompt and provider payload not exposed
- **WHEN** RAG answer generation returns, fails, logs, or maps public DTOs
- **THEN** raw prompts and raw provider payloads are not exposed through public contracts

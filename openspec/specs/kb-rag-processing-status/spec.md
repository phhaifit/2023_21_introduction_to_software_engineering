## Purpose

Define safe live processing status behavior for real ingestion and indexing jobs.

## Requirements

### Requirement: Live Processing Status
The system SHALL expose safe processing status for real ingestion and indexing jobs.

#### Scenario: Queued job visible
- **WHEN** a processing job is queued
- **THEN** the system exposes safe queued status for the workspace

#### Scenario: Processing job visible
- **WHEN** a processing job is running
- **THEN** the system exposes safe processing status for the workspace

#### Scenario: Completed job visible
- **WHEN** a processing job completes
- **THEN** the system exposes safe completed status for the workspace

### Requirement: Processing Status Failure Display
The system SHALL expose safe failed processing status.

#### Scenario: Failed job safe error visible
- **WHEN** a processing job fails
- **THEN** the system exposes failed status with a safe error summary

### Requirement: Processing Status Safety
The system SHALL keep processing runtime internals out of public status responses.

#### Scenario: Status response excludes internals
- **WHEN** processing status is returned
- **THEN** the response excludes queue payloads, runtime internals, storage keys, private URLs, provider payloads, credentials, secrets, tokens, raw embeddings, and raw vectors

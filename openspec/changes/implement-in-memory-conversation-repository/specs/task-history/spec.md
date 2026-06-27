## ADDED Requirements

### Requirement: Canonical In-Memory Conversation History

The system SHALL utilize `InMemoryConversationRepository` as the canonical storage mechanism for conversation history and active chat sessions during local development and testing.

#### Scenario: Fetch conversation history from in-memory repository

* **GIVEN** the system is running in local development mode
* **WHEN** a client requests conversation history for an active workspace
* **THEN** the system SHALL query the `InMemoryConversationRepository`
* **AND** the system SHALL return the list of stored `Conversation` entities without requiring external database persistence

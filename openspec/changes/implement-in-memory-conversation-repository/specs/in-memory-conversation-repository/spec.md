## ADDED Requirements

### Requirement: In-Memory Conversation Repository Contract

The system SHALL provide an `InMemoryConversationRepository` interface and implementation to manage conversation history within the workspace context during local development and testing.

The repository SHALL maintain conversations and messages in an in-memory Map structure and SHALL NOT require external database persistence.

#### Scenario: Save and retrieve a conversation in memory

* **GIVEN** an active workspace session
* **WHEN** a new conversation is initiated
* **THEN** the system SHALL store the `Conversation` entity in the `InMemoryConversationRepository`
* **AND** the system SHALL successfully retrieve the conversation by its ID

#### Scenario: Append chat messages to an active conversation

* **GIVEN** an active conversation stored in the repository
* **WHEN** a new `ChatMessage` is emitted during task execution
* **THEN** the system SHALL append the message to the conversation's message log
* **AND** the updated message log SHALL be retrievable by the workspace client

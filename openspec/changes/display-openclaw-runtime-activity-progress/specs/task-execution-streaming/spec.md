## ADDED Requirements

### Requirement: Processing Activity Synchronizes With Streaming Output
Processing activity projection SHALL remain synchronized with partial output and terminal execution events. Activity updates SHALL move a queued task into running state, partial output SHALL continue streaming independently, and terminal events SHALL stop subsequent activity mutation.

#### Scenario: Activity update starts visible processing
- **GIVEN** a task is queued and subscribed to runtime events
- **WHEN** a normalized provider activity event is received before the first output chunk
- **THEN** the task SHALL transition to visible running processing
- **AND** the activity SHALL appear in the processing timeline without requiring a page refresh

#### Scenario: Terminal event stops activity mutation
- **GIVEN** a task has received a completed, failed, or canceled terminal event
- **WHEN** a late provider activity frame arrives
- **THEN** the frontend SHALL ignore the late activity mutation
- **AND** the terminal result state SHALL remain unchanged

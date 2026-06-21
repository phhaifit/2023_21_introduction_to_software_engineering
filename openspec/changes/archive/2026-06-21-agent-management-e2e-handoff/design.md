## Context

The Agent Management feature has been fully implemented across the stack, including the App Shell, Express HTTP API, Prisma database persistence, skill writer, and RBAC integration. To ensure the feature's stability and prevent regressions in the future, we need to implement end-to-end (E2E) tests. We also need to update the documentation for handoff.

## Goals / Non-Goals

**Goals:**
- Implement Playwright E2E tests covering the full lifecycle of an Agent (List, Create, Edit, Enable, Disable, Delete).
- Verify error handling and validation in the UI via tests.
- Update the `README.md` with a manual test guide.
- Prepare the feature for PR and handoff.

**Non-Goals:**
- Modifying the existing system architecture or application logic.
- Adding new features to Agent Management.

## Decisions

- **E2E Framework:** Use Playwright for end-to-end testing, as it is the standard tool for E2E in this project's ecosystem.
- **Test Coverage:** Tests will simulate real user interactions in the browser and interact with the actual API and database (or a test instance of it) to ensure the system works as a whole. 

## Risks / Trade-offs

- **Risk: Flaky Tests.** E2E tests involving browser automation and databases can be flaky.
  - **Mitigation:** Use robust Playwright locators (e.g., `getByRole`, `getByTestId`), wait for network responses appropriately, and ensure the database is cleaned up or isolated between tests.

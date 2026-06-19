## 1. Workspace Domain

- [ ] 1.1 Define workspace metadata, configuration, runtime reference, and lifecycle status model
- [ ] 1.2 Implement workspace repository or persistence interface
- [ ] 1.3 Implement workspace list and detail use cases scoped to authorized users

## 2. OpenClaw Runtime Coordination

- [ ] 2.1 Implement workspace creation use case that records provisioning state
- [ ] 2.2 Enqueue OpenClaw provisioning through the worker boundary
- [ ] 2.3 Implement provisioning worker result handling for active and failed states
- [ ] 2.4 Implement workspace deletion use case that marks deleting state and enqueues runtime cleanup

## 3. Frontend Experience

- [ ] 3.1 Build workspace list UI with status and timestamps
- [ ] 3.2 Build workspace creation form with name and configuration selection
- [ ] 3.3 Build workspace detail view with available configuration and related public summaries
- [ ] 3.4 Build workspace deletion confirmation flow

## 4. Verification and Handoff

- [ ] 4.1 Add tests for workspace list, create, provisioning success/failure, detail, and delete
- [ ] 4.2 Add tests that OpenClaw work goes through the adapter or worker boundary
- [ ] 4.3 Run OpenSpec validation and relevant test commands
- [ ] 4.4 Update module README with runtime status model and public workspace contracts

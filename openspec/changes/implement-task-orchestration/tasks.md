## 1. Task Domain

- [ ] 1.1 Define task, route, step history, handoff context, result, and status models
- [ ] 1.2 Implement task repository or persistence interface
- [ ] 1.3 Implement public task status and result contracts

## 2. Routing and Execution

- [ ] 2.1 Implement task submission with prompt validation
- [ ] 2.2 Implement direct-agent routing using public agent summaries
- [ ] 2.3 Implement workflow routing using public workflow definitions
- [ ] 2.4 Implement simple automatic routing with recorded decision rationale
- [ ] 2.5 Implement queued task execution worker for direct agent and sequential workflow execution
- [ ] 2.6 Implement failure handling with safe error summaries

## 3. Frontend Experience

- [ ] 3.1 Build task submission UI with direct agent, workflow, and automatic routing options
- [ ] 3.2 Build task status/detail UI with route and step history
- [ ] 3.3 Build final result display and failed-task error display

## 4. Verification and Handoff

- [ ] 4.1 Add tests for task submission, routing modes, sequential handoff, completion, and failure
- [ ] 4.2 Add tests that long-running execution uses the worker boundary
- [ ] 4.3 Run OpenSpec validation and relevant test commands
- [ ] 4.4 Update module README with routing rules, worker behavior, and consumed public contracts

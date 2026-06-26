# Task & Orchestration — Integrate OpenClaw Task Execution Tasks

## 1. External Runtime Resolution & Adapter Structure

- [ ] 1.1 Define conceptual consumer port `WorkspaceExecutionRuntimeResolver` and verify Task & Orchestration asks the resolver, receives a runtime reference, validates it is usable, and passes it to the adapter without provisioning it.
- [ ] 1.2 Implement `OpenClawTaskExecutionAdapter` skeleton satisfying `TaskExecutionAdapter` contracts, supporting fake transport tests for development verification.
- [ ] 1.3 Implement validation ensuring `OpenClawTaskExecutionAdapter` explicitly excludes runtime provisioning, container management, or credential creation.
- [ ] 1.4 Implement external runtime resolution contract tests and adapter skeleton structure verification tests.

## 2. Routing Delegation & Catalog Validation

- [ ] 2.1 Implement Auto-routing delegation ensuring Task & Orchestration sends an Auto routing request to the configured OpenClaw entry point without implementing an LLM Router.
- [ ] 2.2 Implement Specific Agent routing by receiving a platform agent ID, validating the externally supplied workspace-scoped agent contract, obtaining the provider mapping, and sending the mapped target through the adapter.
- [ ] 2.3 Implement Predefined Workflow routing by receiving a platform workflow ID, validating the externally supplied workspace-scoped workflow contract, obtaining the provider mapping, and sending the mapped target through the adapter.
- [ ] 2.4 Implement routing delegation tests and external catalog validation contract tests confirming Agent/Workflow administration remains outside scope.

## 3. Runtime Unavailable & No Silent Fallback

- [ ] 3.1 Implement explicit runtime unavailable behavior ensuring that when a valid Task is submitted for real execution and no running execution runtime can be resolved, Task & Orchestration returns a normalized execution-unavailable failure.
- [ ] 3.2 Implement strict validation ensuring Task & Orchestration SHALL NOT provision a runtime and SHALL NOT silently switch to mock execution when production execution fails.
- [ ] 3.3 Implement runtime-unavailable failure tests and silent fallback prevention verification tests.

## 4. Rigorous 10-Step Start Flow & Cancellation

- [ ] 4.1 Implement the 10-step start flow: (1) receive authenticated/authorized context, (2) validate input, (3) validate routing selection, (4) create platform Task/TaskWork, (5) resolve external runtime, (6) start execution via adapter, (7) store execution association, (8) consume normalized events, (9) update canonical lifecycle, (10) expose state via API.
- [ ] 4.2 Implement cancellation forwarding owning task cancellability validation, loading execution association, forwarding cancellation, applying canonical cancellation after defined confirmation, and suppressing late updates.
- [ ] 4.3 Implement validation verifying Task & Orchestration consumes authenticated principals without implementing authentication/RBAC, and forwards cancellation without terminating containers or deleting Gateways.
- [ ] 4.4 Implement 10-step start flow verification tests and cancellation forwarding boundary tests.

## 5. Transport Recovery & Blocked Integration Verification

- [ ] 5.1 Implement transport recovery mechanisms covering snapshot reconciliation, duplicate-event protection, stale-event handling, reconnect behavior, and background Task continuity without confusing provider connection state with Task lifecycle.
- [ ] 5.2 Document real-integration preconditions confirming real integration requires externally supplied running instances, verified endpoints, credential references, approved connection methods, verified contracts, and workspace associations.
- [ ] 5.3 Verify externally blocked real-integration tasks remain marked as incomplete (`[ ]`) while prerequisites are unavailable, ensuring no tasks require the Task & Orchestration owner to provision OpenClaw.
- [ ] 5.4 Execute full automated test suite, fake transport verification, and strict OpenSpec validation confirming zero regression.

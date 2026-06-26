# Task & Orchestration — Establish OpenClaw Task Integration Contracts Tasks

## 1. Task Execution Adapter Port & Start Command

- [ ] 1.1 Define `TaskExecutionAdapter` interface defining start execution, cancel execution, get execution snapshot, subscribe to normalized events, unsubscribe, and release local adapter resources.
- [ ] 1.2 Define `StartExecutionCommand` DTO including Task ID, Work ID, workspace ID, conversation ID, prompt, routing selection, and attachment references when supported.
- [ ] 1.3 Implement validation ensuring `StartExecutionCommand` explicitly excludes raw credentials, container configuration, infrastructure resource configuration, React state, and provider-specific unverified payloads.
- [ ] 1.4 Implement contract verification tests confirming port compliance and strict field exclusion rules.

## 2. Execution-Runtime Reference & Execution Binding

- [ ] 2.1 Define conceptual consumer port `WorkspaceExecutionRuntimeResolver` and `WorkspaceExecutionRuntime` contract ensuring Task & Orchestration receives or resolves an externally supplied runtime reference without provisioning it.
- [ ] 2.2 Define `ExecutionBinding` DTO defining the association between Platform Task ↔ external runtime reference ↔ provider session/run/execution reference.
- [ ] 2.3 Implement validation verifying that Task & Orchestration SHALL NOT provision the referenced runtime, and that `ExecutionBinding` contains only verified or abstract provider fields.
- [ ] 2.4 Implement binding correlation tests and external runtime resolution contract tests.

## 3. Normalized Events & Lifecycle Mapping

- [ ] 3.1 Define `NormalizedRuntimeEvent` discriminated union covering execution accepted, execution started, routing resolved, step started, step completed, partial output received, execution completed, execution failed, execution canceled, and optional tool/workflow/sub-agent activity.
- [ ] 3.2 Implement canonical lifecycle mapping table linking runtime observations to Pending, In-Progress, Completed, Failed, and Canceled statuses.
- [ ] 3.3 Implement transport resilience validation enforcing that transport interruption SHALL NOT by itself transition a Task to Failed.
- [ ] 3.4 Implement event union parsing tests, lifecycle mapping transition verification, and transport disconnection resilience tests.

## 4. Normalized Error Contract & Security

- [ ] 4.1 Define normalized error contract covering execution runtime unavailable, execution runtime not running, routing target unavailable, provider authentication rejected, execution start rejected, execution failed, cancellation failed, and snapshot recovery failed.
- [ ] 4.2 Implement security filters ensuring normalized errors are safe for presentation and never expose raw credentials or sensitive provider payloads.
- [ ] 4.3 Implement error contract presentation safety tests and credential redaction verification.

## 5. Mock Execution Adapter & Verification

- [ ] 5.1 Implement `MockTaskExecutionAdapter` wrapping existing in-memory mock execution as a legitimate Task & Orchestration test and development adapter satisfying `TaskExecutionAdapter`.
- [ ] 5.2 Verify external prerequisite documentation confirming a usable execution-runtime reference must be supplied by Workspace Management or infrastructure modules before real execution can begin.
- [ ] 5.3 Verify out-of-scope compliance confirming no runtime provisioning, container management, secret ownership, OpenClaw installation, custom AI routing, custom orchestration, or custom multi-agent execution exists in the codebase.
- [ ] 5.4 Execute full automated test suite, build verification, and strict OpenSpec validation confirming zero regression.

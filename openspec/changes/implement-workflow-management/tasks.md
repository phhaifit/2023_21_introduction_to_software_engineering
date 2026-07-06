## 1. Workflow Domain

- [x] 1.1 Define workflow, step, status, and execution request models
- [x] 1.2 Implement workflow repository or persistence interface
- [x] 1.3 Implement public workflow summary and workflow definition contracts

## 2. Workflow Definition Behavior

- [x] 2.1 Implement workflow list and detail use cases
- [x] 2.2 Implement workflow creation with ordered agent steps
- [x] 2.3 Implement workflow editing for name, status, and steps
- [x] 2.4 Validate referenced agents through public agent summaries before activation or execution
- [x] 2.5 Implement workflow execution request creation for task orchestration

## 3. Frontend Experience

- [x] 3.1 Build workflow list and detail UI
- [x] 3.2 Build create and edit workflow forms for sequential steps
- [x] 3.3 Build workflow activation and execution request controls
- [x] 3.4 Display validation errors for missing, disabled, or invalid agent references

## 4. Verification and Handoff

- [x] 4.1 Add tests for list, create, edit, activation validation, and execution request behavior
- [x] 4.2 Add tests that workflow management does not execute task steps directly
- [x] 4.3 Run OpenSpec validation and relevant test commands
- [x] 4.4 Update module README with workflow contract and execution handoff rules

## 1. Agent Domain

- [x] 1.1 Define workspace-scoped agent model with name, role, model, instructions, and lifecycle status
- [x] 1.2 Implement agent repository or persistence interface
- [x] 1.3 Implement public agent summary contract for other modules

## 2. Agent Lifecycle

- [ ] 2.1 Implement agent list use case
- [ ] 2.2 Implement agent creation with validation and skill configuration generation
- [ ] 2.3 Implement agent update for role, model, and instructions
- [ ] 2.4 Implement enable and disable actions
- [ ] 2.5 Implement delete or deleted-state behavior that prevents future selection

## 3. Frontend Experience

- [ ] 3.1 Build agent list UI with status, role, and model
- [ ] 3.2 Build create and edit agent forms
- [ ] 3.3 Build enable, disable, and delete controls with confirmation where needed
- [ ] 3.4 Display validation errors and disabled/deleted states clearly

## 4. Verification and Handoff

- [ ] 4.1 Add tests for list, create, update, enable, disable, and delete behavior
- [ ] 4.2 Add tests for skill configuration generation from stored fields
- [ ] 4.3 Run OpenSpec validation and relevant test commands
- [ ] 4.4 Update module README with public summary contract and lifecycle rules

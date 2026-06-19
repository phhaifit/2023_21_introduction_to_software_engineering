## 1. Tool and Integration Domain

- [ ] 1.1 Define tool catalog, integration, credential reference, and agent assignment models
- [ ] 1.2 Implement tool catalog and integration repository or persistence interfaces
- [ ] 1.3 Implement public assignment query contract for task orchestration

## 2. Integration and Credential Behavior

- [ ] 2.1 Implement Telegram quick integration flow or mock-mode adapter
- [ ] 2.2 Implement credential save/update behavior through the secret-safe boundary
- [ ] 2.3 Implement credential masking in all API responses
- [ ] 2.4 Implement assign and revoke tool access for agents
- [ ] 2.5 Ensure logging redaction is applied to integration payloads

## 3. Frontend Experience

- [ ] 3.1 Build tool catalog UI with integration status
- [ ] 3.2 Build Telegram quick integration UI
- [ ] 3.3 Build credential configuration form with masked saved state
- [ ] 3.4 Build agent-tool assignment controls

## 4. Verification and Handoff

- [ ] 4.1 Add tests for catalog, quick integration, credential save, masking, assignment, and revocation
- [ ] 4.2 Add tests that raw credentials are not returned in responses or logs
- [ ] 4.3 Run OpenSpec validation and relevant test commands
- [ ] 4.4 Update module README with provider assumptions, secret handling, and assignment contract

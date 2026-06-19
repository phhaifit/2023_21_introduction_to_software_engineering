## Context

Tools and integrations let agents use external services and communication channels. The foundation decision is Telegram first for quick integration, with future Zalo, Facebook Messenger, and Slack adapters. Sensitive credentials must stay behind a secret-safe boundary and logs must be redacted.

## Goals / Non-Goals

**Goals:**
- Provide a tool and integration catalog.
- Implement Telegram quick integration for V1.
- Capture and store tool credentials through a safe boundary.
- Assign tools to specific agents.
- Expose assignment data through public contracts for task execution.

**Non-Goals:**
- Implement every listed external channel in V1.
- Build a full OAuth platform for all providers.
- Let agents access credentials directly.

## Decisions

1. Implement Telegram as the first quick integration.
   - Rationale: The foundation selected Telegram first to keep V1 concrete and demoable.
   - Alternative considered: Support Zalo, Facebook, Telegram, and Slack all at once. Rejected because broad provider work would block parallel module progress.

2. Store credentials behind an abstraction.
   - Rationale: Secret storage may be local/mock for the project but should not leak into module code.
   - Alternative considered: Store plaintext tokens in feature tables. Rejected because it is unsafe and hard to redact.

3. Use agent-tool assignments rather than global tool access.
   - Rationale: The requirements need explicit control over which agent can use which tool or channel.
   - Alternative considered: All workspace agents can use all tools. Rejected because it weakens permission and audit boundaries.

4. Redact secrets in logs and API responses.
   - Rationale: Credential configuration is sensitive and should never be displayed after storage.

## Risks / Trade-offs

- Provider setup can be difficult during demos -> Keep Telegram adapter minimal and provide mock-mode configuration.
- Secret handling is easy to get wrong -> Add tests that responses and logs never include raw credential values.
- Assignment rules affect task execution -> Publish a stable assignment query contract for task orchestration.

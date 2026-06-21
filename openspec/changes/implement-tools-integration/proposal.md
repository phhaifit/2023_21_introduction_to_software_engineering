## Why

Agents need access to approved tools and communication channels to act on behalf of a virtual company. This change defines tool catalog, quick integrations, credential configuration, and assignment to agents.

## What Changes

- Add tool and integration catalog.
- Add quick integration flow for Telegram first, with room for future Zalo, Facebook Messenger, and Slack adapters.
- Add credential configuration for API keys, tokens, and environment variables.
- Store sensitive values through a secret-safe boundary.
- Add tool assignment to specific agents.

## Capabilities

### New Capabilities
- `tools-integration`: Tool catalog, quick integration setup, credential configuration, secret-safe storage boundary, and agent-tool assignment.

### Modified Capabilities
No existing capability requirements change in this proposal.

## Impact

- Backend module: `apps/backend/src/modules/tools-integration`
- Frontend feature: `apps/frontend/src/features/tools-integration`
- Shared infrastructure: logging redaction, secret handling boundary, events
- External boundary: Telegram adapter first; other channels remain future adapters
- Related modules: agent management and task orchestration consume assigned tool contracts

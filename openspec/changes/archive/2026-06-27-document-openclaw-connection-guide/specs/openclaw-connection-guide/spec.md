## ADDED Requirements

### Requirement: Authoritative OpenClaw Connection Guide

The system documentation SHALL include an authoritative, step-by-step connection guide (`docs/openclaw-connection-guide.md`) detailing the setup, execution, and troubleshooting of the OpenClaw Docker runtime and its connection to the platform Web UI and Express API.

#### Scenario: Documentation details Docker prerequisites and port configuration

* **GIVEN** a developer sets up the OpenClaw execution runtime locally
* **WHEN** consulting `docs/openclaw-connection-guide.md`
* **THEN** the documentation SHALL specify the required Docker daemon status, environment variables (`OPENCLAW_GATEWAY_TOKEN`), startup scripts (`bash scripts/docker/setup.sh`), and network port bindings (`http://127.0.0.1:18789`)
* **AND** it SHALL outline explicit troubleshooting steps for Docker socket unavailability, SSE stream disconnections, and runtime unavailability errors

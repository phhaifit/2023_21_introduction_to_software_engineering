# openclaw-gateway-troubleshooting Specification

## Purpose
Establishes a definitive operational runbook for handling physical gateway disconnections, HTTP 400/401 rejection codes, `AbortController` cancellation lifecycle, and secure error mapping (`execution-runtime-unavailable`, `provider-authentication-rejected`).

## ADDED Requirements

### Requirement: OpenClaw Gateway Rejection Handling
When the OpenClaw Gateway returns an HTTP 400 (Bad Request) or 401 (Unauthorized) status code during an execution request, the transport layer SHALL intercept the failure, log the exact HTTP status code without exposing raw authorization tokens, and map the error to a secure normalized representation.

#### Scenario: Intercept HTTP 400 Bad Request
* **GIVEN** `OpenClawHttpSSETransport` initiates a `POST /v1/chat/completions` request
* **WHEN** the OpenClaw Gateway responds with HTTP status 400
* **THEN** the transport layer SHALL log the failure securely
* **AND** it SHALL map the error to `execution-start-rejected` with a clear explanation

#### Scenario: Intercept HTTP 401 Unauthorized
* **GIVEN** `OpenClawHttpSSETransport` initiates an execution request
* **WHEN** the OpenClaw Gateway responds with HTTP status 401
* **THEN** the transport layer SHALL map the error to `provider-authentication-rejected`
* **AND** it SHALL NOT log or expose the raw Bearer token in the error payload

---

### Requirement: Physical Gateway Disconnection and Unavailability Recovery
When the physical OpenClaw Gateway container (port 18789) is unreachable due to network partition or container failure, the system SHALL handle the connection refusal gracefully and return a normalized `execution-runtime-unavailable` error.

#### Scenario: Handle unreachable gateway container
* **GIVEN** the physical OpenClaw Gateway container is down or unreachable
* **WHEN** `OpenClawHttpSSETransport` attempts to establish a connection
* **THEN** the transport layer SHALL catch the network connection error
* **AND** it SHALL return a normalized `execution-runtime-unavailable` error safe for UI presentation

---

### Requirement: AbortController Cancellation Lifecycle Runbook
The cancellation of an active SSE execution stream SHALL be governed strictly by local stream termination via `AbortController.abort()`. The system SHALL NOT attempt to send auxiliary cancellation HTTP requests to the gateway.

#### Scenario: Execute local stream abortion
* **GIVEN** an active SSE stream is currently open with the OpenClaw Gateway
* **WHEN** a cancellation signal is triggered by the user or system
* **THEN** `OpenClawHttpSSETransport` SHALL invoke `.abort()` on the stream's `AbortController`
* **AND** it SHALL immediately terminate the local stream reading loop
* **AND** it SHALL NOT transmit an outgoing cancellation POST request to the gateway

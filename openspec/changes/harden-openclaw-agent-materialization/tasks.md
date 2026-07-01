## 1. Materialization Hardening

- [x] 1.1 Add per-agent in-flight materialization coalescing.
- [x] 1.2 Reuse cached materialized mappings when `profile.updatedAt` is unchanged.
- [x] 1.3 Remove duplicate OpenClaw artifact mirror invocation after native registration.
- [x] 1.4 Improve OpenClaw agent sync warning formatting with bounded command diagnostics.

## 2. Tests

- [x] 2.1 Add materializer tests for unchanged-profile cache reuse.
- [x] 2.2 Add materializer tests for concurrent request coalescing.
- [x] 2.3 Add materializer tests for retry after mirror failure.
- [x] 2.4 Assert native mapping materialization mirrors only once per attempt.

## 3. Verification

- [x] 3.1 Run focused backend tests for OpenClaw agent materialization.
- [x] 3.2 Run OpenSpec validation for `harden-openclaw-agent-materialization`.
- [x] 3.3 Run repository validation commands required for this implementation slice.

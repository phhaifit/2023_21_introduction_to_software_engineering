## 1. Backend Progress Mapping

- [x] 1.1 Extend OpenClaw raw event mapping to normalize OpenAI-compatible tool-call and reasoning/thinking activity into safe runtime activity events.
- [x] 1.2 Extend Gateway side-channel activity classification to recognize reasoning/thinking and richer tool/search payload shapes without leaking sensitive payloads.
- [x] 1.3 Add backend adapter tests for tool-call, web-search, reasoning/thinking, and unrelated-session filtering.

## 2. Frontend Projection

- [x] 2.1 Update HTTP provider projection so provider activity labels and logs remain visible from normalized runtime activity events.
- [x] 2.2 Update chat partial-output visibility so provider-originated partial text renders without mock-only step ID requirements.
- [x] 2.3 Add frontend tests covering OpenClaw activity projection and HTTP provider partial output in chat.

## 3. Verification Handoff

- [x] 3.1 Review changed files and provide the user with exact verification commands without running tests.

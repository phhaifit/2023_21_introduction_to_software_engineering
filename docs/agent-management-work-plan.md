# Agent Management Work Plan

Mục tiêu: hoàn thiện Agent Management từ foundation hiện tại thành feature chạy được trong sản phẩm.

## Trạng Thái Hiện Tại

- [x] Domain model Agent
- [x] Agent lifecycle use cases: list, create, update, enable, disable, delete
- [x] Public summary contract
- [x] Static UI renderer
- [x] Contract tests
- [x] React/Vite app thật
- [x] Express API thật
- [x] Prisma/PostgreSQL persistence
- [x] skill.md writer nối với workspace/OpenClaw boundary
- [x] RBAC/workspace integration thật
- [ ] Playwright e2e tests

## Phase 1: App Shell

OpenSpec change đề xuất: `integrate-agent-management-app-shell`

- [x] Tạo React + Vite app shell nếu repo chưa có
- [x] Tạo Agent Management page
- [x] Mount UI Agent Management vào browser
- [x] Dùng mock data để hiển thị list agent
- [x] Manual test UI trong browser
- [x] Chạy `npm test`
- [x] Chạy `openspec validate "integrate-agent-management-app-shell"`

## Phase 2: HTTP API

OpenSpec change đề xuất: `add-agent-management-http-api`

- [x] Thêm Express routes cho Agent Management
- [x] Implement API list agents
- [x] Implement API create agent
- [x] Implement API update agent
- [x] Implement API enable agent
- [x] Implement API disable agent
- [x] Implement API delete agent
- [x] Dùng mock workspace/current user boundary
- [x] Map validation/not-found errors sang `ApiResponse`
- [x] Thêm API tests
- [x] Chạy `npm test`
- [x] Chạy `openspec validate "add-agent-management-http-api"`

## Phase 3: UI Nối API

OpenSpec change đề xuất: `connect-agent-management-ui-api`

- [x] Thêm frontend API client cho Agent Management
- [x] UI load list agent từ backend
- [x] Create form gọi API
- [x] Edit form gọi API
- [x] Enable/disable/delete gọi API
- [x] Refresh list sau mutation
- [x] Hiển thị loading state
- [x] Hiển thị validation/general errors
- [x] Manual test browser end-to-end với in-memory backend
- [x] Chạy `npm test`
- [x] Chạy `openspec validate "connect-agent-management-ui-api"`

## Phase 4: Prisma Persistence

OpenSpec change đề xuất: `persist-agent-management-prisma`

- [x] Thêm Prisma schema/table cho agents
- [x] Implement `PrismaAgentRepository`
- [x] Giữ `InMemoryAgentRepository` cho unit tests
- [x] Scope mọi query theo `workspaceId`
- [x] Đảm bảo deleted agents không hiện trong active list
- [x] Đảm bảo restart server không mất dữ liệu
- [x] Thêm repository/integration tests
- [x] Chạy `npm test`
- [x] Chạy `openspec validate "persist-agent-management-prisma"`

## Phase 5: skill.md Writer

OpenSpec change đề xuất: `write-agent-skill-configuration`

- [x] Tạo interface `AgentSkillWriter`
- [x] Create agent gọi writer sau khi lưu agent
- [x] Update agent gọi writer sau khi lưu config mới
- [x] Thêm mock writer cho tests
- [x] Thêm real writer qua workspace/OpenClaw boundary
- [x] Không gọi Docker/OpenClaw trực tiếp từ Agent Management
- [x] Test generated skill content
- [x] Test writer invocation
- [x] Chạy `npm test`
- [x] Chạy `openspec validate "write-agent-skill-configuration"`

## Phase 6: RBAC và Workspace Integration

OpenSpec change đề xuất: `agent-management-rbac-workspace-integration`

- [x] Dùng `RequestContext`
- [x] Dùng permission `agents:manage`
- [x] Admin/editor được mutate agents
- [x] Viewer bị chặn khi mutate
- [x] Anonymous bị chặn
- [x] Đảm bảo không leak agents qua workspace khác
- [x] Không import private code từ Authentication/Workspace modules
- [x] Thêm authorization tests
- [x] Chạy `npm test`
- [x] Chạy `openspec validate "agent-management-rbac-workspace-integration"`

## Phase 7: E2E và Handoff

OpenSpec change đề xuất: `agent-management-e2e-handoff`

- [x] Thêm Playwright test: list agents
- [x] Thêm Playwright test: create valid agent
- [x] Thêm Playwright test: invalid form shows errors
- [x] Thêm Playwright test: edit agent
- [x] Thêm Playwright test: disable agent
- [x] Thêm Playwright test: enable agent
- [x] Thêm Playwright test: delete agent
- [x] Cập nhật README/manual test guide
- [x] Chạy `npm test`
- [x] Chạy Playwright e2e command
- [x] Chạy `openspec validate --all --strict`
- [x] Chuẩn bị PR/handoff summary

## Quy Tắc Làm Việc

- [x] Mỗi phase tạo một OpenSpec change riêng
- [x] Mỗi change có `proposal.md`, `design.md`, `spec.md`, `tasks.md`
- [x] Không bắt đầu code khi chưa đọc change artifacts
- [x] Khi hoàn thành task thì tick checkbox ngay
- [x] Mỗi behavior mới phải có test tương ứng
- [x] Không sửa private module khác nếu không có change rõ ràng
- [x] Nếu cần shared contract mới, cập nhật OpenSpec trước
- [x] Trước PR luôn chạy:
  - `npm test`
  - `openspec validate "<change-name>"`
  - `openspec validate --all --strict`
  - `git diff --check`

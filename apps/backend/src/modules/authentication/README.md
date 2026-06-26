# Authentication Module

Owner: Member 1

## Overview

Module này quản lý danh tính người dùng, cung cấp các tính năng cốt lõi như đăng ký, đăng nhập, và quản lý phiên bản xác thực (session).

## Boundary

- Own user registration, login, logout, password hashing, and current-user context.
- Expose authenticated user identity to downstream modules through shared request context.
- Do not own workspace-level authorization; use the RBAC shared module for that.

## Endpoints

- `POST /api/auth/register` — public — tạo tài khoản, trả user summary (không bao giờ chứa password/passwordHash).
- `POST /api/auth/login` — public — xác thực, trả user + session token (raw token chỉ trả lần này).
- `POST /api/auth/logout` — đọc Authorization Bearer — invalidate session, idempotent.
- `GET /api/auth/me` — authenticated — trả current user từ session.

## Architecture decisions

- Dùng server-side session lưu trên Postgres (không JWT/Redis).
- Thuật toán bcryptjs với salt 12 cho password hashing.
- SHA-256 cho session token; raw token trả một lần duy nhất, DB chỉ lưu tokenHash.
- InvalidCredentials sử dụng chung một thông báo message để chống user enumeration.
- Session TTL cấu hình là 7 ngày; thao tác logout là idempotent.
- Persistence bằng Prisma khi có `DATABASE_URL`, fallback sang in-memory (mất dữ liệu khi restart) nếu thiếu cấu hình.

## Local development

Cần set biến môi trường `DATABASE_URL` (ví dụ: `postgresql://vcp:dev@localhost:5432/virtual_company_dev`) để persist.
Vui lòng chạy lệnh `docker start vcp-pg` và set biến môi trường.
Nếu thiếu `DATABASE_URL`, ứng dụng chạy với in-memory repository (mất dữ liệu khi restart server).

## Assumptions and limitations

- Auth là feature độc lập, KHÔNG gate toàn app: truy cập thông qua mục Account trên sidebar; các module khác vẫn dùng fake auth local. Đường hướng nâng cấp gate toàn app cần Workspace Management và sự đồng thuận của nhóm.
- Mặc dù `displayName` có trong domain nhưng schema Prisma chưa có cột này; giá trị sẽ rỗng khi đọc qua Prisma.
- Out of scope: OAuth, quên mật khẩu, xác minh email, refresh token.
- E2E login/logout test (task 4.2) chưa hoàn thành; chờ xác nhận về lựa chọn công cụ (Selenium/Katalon vs Playwright) với giảng viên.

## OpenSpec validation (Final Check)

Change `implement-authentication` pass `openspec validate --strict`. 
Ghi nhận `spec/client-side-routing` có warning (Purpose là TBD) và mô tả URL-based routing chưa khớp implementation state-based hiện tại; spec đó nằm ngoài scope của module Authentication.

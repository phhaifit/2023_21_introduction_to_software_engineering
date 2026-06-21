# Virtual Company Platform

Virtual Company Platform là nền tảng ảo hóa công ty dựa trên OpenClaw. Dự án hướng đến việc giúp người dùng tạo một workspace đại diện cho công ty, cấu hình các nhân viên ảo, gán công cụ làm việc, xây dựng quy trình phối hợp và điều phối tác vụ trong một môi trường số.

## Tổng Quan

Mỗi workspace trong hệ thống tương ứng với một môi trường làm việc riêng, nơi người dùng có thể quản lý thành viên, phân quyền, tạo agent, kết nối công cụ bên ngoài, xây dựng workflow và cung cấp dữ liệu nội bộ cho agent thông qua Knowledge Base/RAG.

Nền tảng tập trung vào các khả năng chính:

- Xác thực người dùng và quản lý phiên làm việc.
- Tạo, xem, cấu hình và xóa workspace dựa trên OpenClaw.
- Quản lý thành viên và phân quyền trong từng workspace.
- Tạo và cấu hình nhân viên ảo theo vai trò, model và instruction.
- Quản lý công cụ, tích hợp nhanh và phân quyền sử dụng công cụ cho agent.
- Xây dựng workflow phối hợp nhiều agent.
- Giao việc, điều phối task và tổng hợp kết quả từ agent hoặc workflow.
- Quản lý subscription, thanh toán và nâng cấp gói dịch vụ.
- Quản lý tri thức nội bộ bằng document upload, data sync và vector search.

## Định Hướng Kiến Trúc

Dự án được thiết kế theo mô hình modular monolith. Backend được chia theo từng capability để các thành viên có thể phát triển song song, trong khi vẫn dùng chung các contract nền tảng như định danh, vai trò, trạng thái, API response và domain event.

Các tác vụ chậm hoặc cần retry như cấp phát OpenClaw, xử lý thanh toán, ingest tài liệu và thực thi task dài sẽ được đưa qua worker thay vì xử lý trực tiếp trong HTTP request.

## Mục Tiêu Dự Án

Mục tiêu của dự án là xây dựng một nền tảng mô phỏng công ty ảo có khả năng mở rộng theo module, đủ rõ ràng về kiến trúc để nhóm 9 thành viên có thể triển khai độc lập từng phần, đồng thời vẫn đảm bảo các module tích hợp được với nhau thông qua shared contracts và ranh giới trách nhiệm đã thống nhất.

## Phát triển & Kiểm thử (Development & Testing)

### Cấu trúc Workspaces

Dự án dùng NPM Workspaces:

- `apps/frontend`: React + Vite app (`@vcp/frontend`)
- `apps/backend`: Express API development server (`@vcp/backend`)
- `apps/workers`: background job entry points (`@vcp/workers`)
- `packages/shared`: shared contracts (`@vcp/shared`)
- `packages/database`: Prisma schema, migrations, and database exports (`@vcp/database`)

### Cài đặt
1. Cài đặt các thư viện: `npm install`
2. Cài đặt trình duyệt cho Playwright E2E: `npx playwright install`

### Chạy hệ thống (Local)
1. Nếu muốn dùng PostgreSQL thật, đặt `DATABASE_URL` trước khi chạy app:
   ```bash
   export DATABASE_URL="postgresql://YOUR_POSTGRES_USER@localhost:5432/virtual_company_dev?schema=public"
   npm run prisma -- migrate deploy
   ```
2. Khởi động server (Backend API + Frontend Vite): `npm run dev`
3. Mở trình duyệt truy cập ứng dụng tại `http://127.0.0.1:5173`

Nếu Vite báo port khác như `5174`, thường là do một dev server cũ vẫn đang chiếm `5173`.
Kiểm tra và dừng process cũ:

```bash
lsof -nP -iTCP:3001 -sTCP:LISTEN
lsof -nP -iTCP:5173 -sTCP:LISTEN
```

### Prisma/PostgreSQL

Prisma commands phải chạy qua database workspace từ root:

```bash
npm run prisma -- validate
npm run prisma -- migrate deploy
```

`DATABASE_URL` dùng cho Prisma có thể chứa `?schema=public`. Với `psql`, bỏ query parameter này:

```bash
export PSQL_DATABASE_URL="postgresql://YOUR_POSTGRES_USER@localhost:5432/virtual_company_dev"
psql "$PSQL_DATABASE_URL" -c "\dt"
psql "$PSQL_DATABASE_URL" -c "select * from agents;"
```

### Chạy Tests
- **Unit, Contract & Integration Tests:** `npm test`
- **End-to-End (E2E) Tests:** `npm run test:e2e`

### Hướng dẫn Manual Test cho Agent Management
1. Chạy `npm run dev` để start server.
2. Truy cập ứng dụng, trang Agent Management sẽ tải danh sách agents.
3. Nếu không đặt `DATABASE_URL`, có sẵn 2 demo agents: `Research Agent` và `Support Agent`. Nếu dùng PostgreSQL thật, danh sách phản ánh dữ liệu trong database.
4. Nhấn **"New agent"** để thêm một nhân viên ảo mới.
5. Sử dụng nút **"Edit"** để cập nhật `Role`, `Model`, hoặc `Instructions`.
6. Sử dụng nút **"Disable"**, **"Enable"**, hoặc **"Delete"** để thử nghiệm lifecycle của agent.
7. Thử gửi form trống hoặc thiếu thông tin để kiểm tra validation.

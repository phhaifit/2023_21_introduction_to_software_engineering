# OpenClaw Connection Guide

This guide provides authoritative operational instructions for running the OpenClaw Docker runtime locally and connecting it to the platform's Express API and React Web UI chat.

---

## 1. Prerequisites & Environment Setup

Before starting the execution runtime, ensure the following prerequisites are met:

- **Docker Desktop / Daemon**: Must be actively running. Ensure the Docker socket (`/var/run/docker.sock` on Linux/macOS or Named Pipe on Windows) is accessible.
- **Environment Variables**:
  - `OPENCLAW_GATEWAY_TOKEN`: Token bảo mật dùng để xác thực giữa Backend và OpenClaw Gateway (mặc định: `demo_secure_token_abc123`).
  - `BACKEND_URL`: URL của Backend API, được cấu hình mặc định là `http://127.0.0.1:3001` trong `HttpTaskOrchestrationProvider`.

---

## 2. Startup & Port Bindings

### Lệnh khởi tạo OpenClaw Container
Để khởi động runtime thực thi OpenClaw, truy cập thư mục gốc của repository OpenClaw và chạy kịch bản thiết lập:

```bash
bash scripts/docker/setup.sh
```

### Thông số Binding
- **Host & Port**: Container OpenClaw Gateway sẽ lắng nghe trên địa chỉ `http://127.0.0.1:18789`.
- **Backend Transport**: Server Backend (thông qua `OpenClawHttpSSETransport`) sẽ kết nối trực tiếp đến cổng `18789` này thông qua giao thức chuẩn OpenAI-compatible HTTP API (`POST /v1/chat/completions`) để khởi tạo task và nhận luồng dữ liệu Server-Sent Events (SSE) (`chat.completion.chunk`). Việc hủy stream được xử lý hoàn toàn cục bộ thông qua `AbortController.abort()`.

---

## 3. Quy trình Kết nối & Ranh giới Kiến trúc (Architectural Boundaries)

### Routing model note

Backend must keep the OpenAI-compatible request body `model` as `openclaw/default`. For `specific-agent`, Backend also sends the selected native OpenClaw agent through `x-openclaw-agent-id` and includes the `openclaw/<agentId>` reference in system routing context. Selected workflows are sent as system routing context until OpenClaw exposes a documented workflow routing header or target. When the user selects `auto` routing, Backend sends the full current workspace candidate list: enabled agents and published workflows, including their OpenClaw references, so the OpenClaw coordinator can choose the best route.

### Progress side-channel note

Backend keeps `/v1/chat/completions` as the execution start and result stream path. In addition, `OpenClawHttpSSETransport` may open a best-effort Gateway WebSocket side-channel for the same `x-openclaw-session-key` and subscribe to `sessions.subscribe` plus `sessions.messages.subscribe`. Session operation/tool/message events received from the Gateway are mapped into normalized progress events so the UI can show actual OpenClaw progress when the Gateway emits it. If the Gateway or Node runtime does not expose WebSocket support, execution continues through HTTP/SSE and the UI falls back to partial output.

Luồng kết nối tuân thủ chặt chẽ nguyên tắc **Consumer - Provider**:

```text
+-----------------------+         HTTP POST /start         +--------------------------------+
|                       | -------------------------------> |                                |
|  React Web UI Chat    |                                  |  Express API Router            |
| (HttpTaskOrchestration| <------------------------------- | (OpenClawExecutionOrchestrator)|
|       Provider)       |         SSE GET /stream          +--------------------------------+
+-----------------------+                                                  |
                                                                           |
                                              POST /v1/chat/completions    |
                                             (OpenClawHttpSSETransport)    |
                                                                           v
                                                           +--------------------------------+
                                                           |  OpenClaw Gateway Container    |
                                                           |     (http://127.0.0.1:18789)   |
                                                           +--------------------------------+
```

- **Task & Orchestration (Consumer)**: Chỉ chịu trách nhiệm quản lý mô hình dữ liệu (`Task`, `TaskRun`), gửi yêu cầu thực thi không đồng bộ (non-blocking start), xử lý lỗi chuẩn hóa và hiển thị luồng dữ liệu (fragments, logs).
- **OpenClaw Container (Provider)**: Chịu trách nhiệm thực thi LLM routing, quản lý sandbox và cung cấp luồng sự kiện chuẩn OpenAI (`chat.completion.chunk`). Backend hoàn toàn không quản lý việc tự động cài đặt hay cấp phát CPU/RAM cho container.

---

## 4. Troubleshooting Workflow

### Lỗi 1: `failed to connect to the docker API at unix:///var/run/docker.sock`
- **Nguyên nhân**: Docker daemon chưa được bật hoặc user hiện tại không có quyền truy cập vào socket Docker.
- **Cách khắc phục**:
  1. Mở ứng dụng Docker Desktop (trên Windows/macOS) hoặc chạy `sudo systemctl start docker` (trên Linux).
  2. Xác minh Docker đã hoạt động bằng lệnh:
     ```bash
     docker ps
     ```

### Lỗi 2: `execution-runtime-unavailable`
- **Nguyên nhân**: Backend không thể kết nối tới OpenClaw tại `http://127.0.0.1:18789` khi người dùng gửi yêu cầu chạy task.
- **Cách khắc phục**:
  1. Kiểm tra container OpenClaw có đang chạy hay không:
     ```bash
     docker ps | grep openclaw
     ```
  2. Nếu container bị dừng, hãy chạy lại lệnh `bash scripts/docker/setup.sh`.
  3. Đảm bảo cổng `18789` không bị tường lửa chặn hoặc bị ứng dụng khác chiếm dụng.

### Lỗi 3: `provider-authentication-rejected`
- **Nguyên nhân**: Token xác thực `OPENCLAW_GATEWAY_TOKEN` giữa Backend và OpenClaw không khớp.
- **Cách khắc phục**:
  1. Kiểm tra file `.env` hoặc biến môi trường được export trong shell khởi chạy backend.
  2. Đảm bảo giá trị `OPENCLAW_GATEWAY_TOKEN` trùng khớp với cấu hình trong container OpenClaw.

---

## 5. Danh sách Kiểm tra Xác minh (Verification Checklist)

- [ ] Docker Desktop/daemon hoạt động ổn định (`docker info` thành công).
- [ ] Container OpenClaw khởi chạy thành công và in ra log `Listening on port 18789`.
- [ ] Lệnh `curl http://127.0.0.1:18789/health` trả về trạng thái HTTP 200 OK.
- [ ] Giao diện React Web UI hiển thị trạng thái `In-Progress` và tiếp nhận luồng SSE mượt mà khi submit task.

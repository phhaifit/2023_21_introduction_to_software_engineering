# Yêu cầu phần mềm cốt lõi để xây dựng platform ảo hóa công ty dựa trên OpenClaw:

## 1. Quản lý Xác thực (Authentication)
* **Đăng ký:** Người dùng tạo tài khoản mới bằng email và mật khẩu. Hệ thống sẽ kiểm tra tính hợp lệ, mã hóa mật khẩu và lưu vào cơ sở dữ liệu.
* **Đăng nhập:** Xác thực người dùng bằng email/mật khẩu để cấp quyền truy cập. Hệ thống tạo session hoặc access token để duy trì phiên làm việc.
* **Đăng xuất:** Kết thúc phiên làm việc hiện tại của người dùng. Backend sẽ vô hiệu hóa token và xóa session.

## 2. Quản lý Không gian làm việc (Workspace Management)
* **Xem danh sách:** Hiển thị toàn bộ các workspace đã tạo kèm theo trạng thái và thời gian.
* **Tạo mới (Core OpenClaw):** Người dùng nhập tên và chọn cấu hình cho workspace. Hệ thống backend sẽ tự động cấp phát container và khởi động một instance OpenClaw mới.
* **Xem chi tiết:** Tải toàn bộ dữ liệu cấu hình, danh sách agent, workflow và công cụ thuộc về một workspace cụ thể.
* **Xóa:** Hủy bỏ workspace khỏi hệ thống bằng cách xóa metadata và dừng/xóa container OpenClaw tương ứng.

## 3. Quản lý Nhân viên ảo (Agent Management)
* **Xem danh sách:** Hiển thị các agent đang hoạt động trong workspace với thông tin tên, trạng thái và vai trò.
* **Tạo mới:** Khởi tạo agent bằng cách xác định tên, vai trò, mô hình (model) và các hướng dẫn (instruction). Hệ thống sẽ tạo thư mục riêng và file skill.md cho agent.
* **Chỉnh sửa & Cấu hình:** Thay đổi các thông số của agent và định nghĩa cách hành xử, giới hạn thông qua file skill.md.
* **Bật/Tắt & Xóa:** Kiểm soát việc agent có được tham gia xử lý công việc hay không, hoặc xóa hoàn toàn agent khỏi hệ thống.

## 4. Quản lý Công cụ & Tích hợp (Tools & Integration)
* **Danh sách & Thêm mới:** Xem và duyệt qua các công cụ, ứng dụng bên ngoài (web search, CRM, email...) hiện có sẵn trên platform để bổ sung cho agent.
* **Tích hợp nhanh (Quick Integration):** Cho phép người dùng kết nối ngay lập tức với các nền tảng bên thứ ba phổ biến (như Zalo, Facebook Messenger, Telegram, Slack...) thông qua cơ chế ủy quyền (như OAuth) hoặc các template có sẵn chỉ với vài cú click chuột, bỏ qua các bước nhập liệu phức tạp.
* **Cấu hình bảo mật (Credential Config):** Cung cấp giao diện để nhập và lưu trữ an toàn các thông tin nhạy cảm (API key, token, biến môi trường) dành cho các công cụ đặc thù hoặc tích hợp nội bộ của riêng công ty.
* **Phân quyền (Tool Assignment):** Gán cụ thể công cụ hoặc kênh giao tiếp nào được phép sử dụng bởi agent nào.

## 5. Quản lý Quy trình (Workflow Management)
* **Tạo & Chỉnh sửa:** Định nghĩa hoặc thay đổi một chuỗi xử lý công việc liên quan đến nhiều agent. Người dùng có thể xác định thứ tự và logic phối hợp giữa các agent.
* **Danh sách & Thực thi:** Quản lý các quy trình hiện có và kích hoạt chạy tự động theo đúng luồng đã được cấu hình từ trước.

## 6. Quản lý & Điều phối Công việc (Task & Orchestration)
* **Giao việc:** Người dùng nhập yêu cầu (prompt) và gửi cho hệ thống xử lý.
* **Điều phối:** Người dùng có thể chỉ định trực tiếp một agent, một workflow, hoặc để hệ thống tự động phân tích và điều phối người xử lý.
* **Phối hợp nhóm (Multi-agent):** Cho phép các agent chuyển tiếp công việc, chia sẻ ngữ cảnh và cùng nhau giải quyết các tác vụ phức tạp.
* **Trả kết quả:** Tổng hợp đầu ra từ các agent và hiển thị kết quả cuối cùng cho người dùng.

## 7. Quản lý Subscription & Thanh toán (Subscription & Payment)
* **Lựa chọn gói dịch vụ:** Cho phép người dùng chọn mua các gói Workspace dựa trên nhu cầu:
    * **Gói Standard:** Cấp phát instance OpenClaw với cấu hình tài nguyên (CPU/RAM) mức trung bình.
    * **Gói Premium:** Cấp phát instance OpenClaw với cấu hình tài nguyên mạnh mẽ, tối ưu cho xử lý phức tạp.
* **Xử lý thanh toán:** Tích hợp cổng thanh toán trực tuyến để người dùng mua mới hoặc gia hạn gói dịch vụ định kỳ.
* **Nâng cấp Subscription:** Hỗ trợ quy trình nâng cấp từ gói Standard lên Premium. Hệ thống tự động thay đổi cấu hình hạ tầng của instance OpenClaw hiện tại sau khi thanh toán thành công.
* **Quản lý trạng thái:** Theo dõi thời hạn sử dụng, lịch sử giao dịch và gửi thông báo khi gói dịch vụ sắp hết hạn.

## 8. Quản lý Thành viên & Phân quyền (Workspace User Management)
* **Mời thành viên:** Cho phép quản trị viên thêm người dùng khác vào làm việc chung trong một workspace cụ thể thông qua email.
* **Phân quyền (Role-based Access Control):** Thiết lập các vai trò khác nhau trong workspace để kiểm soát quyền hạn:
    * **Admin:** Toàn quyền quản lý workspace, agent, workflow, tool và thành viên.
    * **Editor/Member:** Có quyền tạo và chỉnh sửa agent, workflow nhưng không có quyền quản lý thành viên hoặc xóa workspace.
    * **Viewer:** Chỉ có quyền xem cấu hình và kết quả thực thi task, không được phép chỉnh sửa.
* **Quản lý truy cập:** Kiểm soát danh sách người dùng đang tham gia và có quyền xóa thành viên khỏi workspace khi cần thiết.

## 9. Quản lý Tri thức & Dữ liệu nội bộ (Knowledge Base / RAG Management)

Để các nhân viên ảo (Agent) làm việc đúng với bối cảnh của từng công ty, chúng cần được tiếp cận với tài liệu và quy trình nội bộ. Phân hệ này ứng dụng công nghệ RAG (Retrieval-Augmented Generation) để cung cấp "bộ não" cho workspace.

* **Quản lý Tài liệu (Document Upload):** Cho phép người dùng tải lên các tài liệu nội bộ (PDF, Word, TXT, CSV...) như sổ tay nhân viên, báo cáo tài chính, mô tả sản phẩm.
* **Đồng bộ Dữ liệu tự động (Data Sync):** Phạm vi triển khai hiện tại hỗ trợ Google Drive. Người dùng chọn file hoặc thư mục cụ thể và có thể bật lịch đồng bộ tự động để cập nhật Knowledge Base khi nội dung đã chọn thay đổi. Hệ thống không đồng bộ toàn bộ Drive; Notion và Confluence nằm ngoài phạm vi triển khai này.
* **Vector hóa & Lưu trữ:** Hệ thống tự động xử lý và lưu trữ dữ liệu vào Vector Database để tối ưu hóa quá trình tìm kiếm ngữ nghĩa cho Agent.
* **Phân quyền truy cập tri thức:** Quản trị viên có thể cấu hình để chỉ định chính xác Agent nào được phép truy cập vào bộ tài liệu nào (ví dụ: Agent Nhân sự chỉ được đọc chính sách công ty, Agent Sales được đọc báo giá).

---

### Tóm tắt luồng tích hợp:
* Đăng ký/Đăng nhập -> Mua Subscription (Standard/Premium) -> Tạo Workspace (tương ứng cấu hình đã mua).
* Trong Workspace: Mời thành viên & Phân quyền -> Quản lý Agent/Workflow -> Thực thi Task.
* Khi cần hiệu năng cao hơn: Nâng cấp gói Premium -> Hệ thống tự động nâng cấp cấu hình OpenClaw.

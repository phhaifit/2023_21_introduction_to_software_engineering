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

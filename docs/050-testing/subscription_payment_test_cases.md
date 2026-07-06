---
id: subscription-payment-test-cases
type: Test Cases
status: Active
created: 2026-07-06
---

# Tài liệu Test Cases giao diện người dùng (UI) cho tính năng Subscription & Thanh toán

Tài liệu này định nghĩa các kịch bản kiểm thử (Test Cases) chi tiết ở cấp độ **giao diện người dùng (UI/UX) và luồng hành vi (E2E)** cho phân hệ **Subscription & Thanh toán (Payment)** thuộc hệ thống Virtualization Company Platform (VCP). Các kịch bản này mô tả chính xác những gì người dùng thao tác (nhập, click) trên giao diện và những gì người dùng nhìn thấy trên màn hình.

---

## Danh sách Test Cases Giao Diện Người Dùng (UI/UX)

### TC-UI-SUB-01: Mua gói dịch vụ Standard lần đầu với Cổng thanh toán mô phỏng (Sandbox)
* **ID**: `TC-UI-SUB-01`
* **Mục tiêu**: Xác minh luồng mua mới gói dịch vụ Standard từ góc độ người dùng chưa liên kết thẻ, sử dụng phương thức thanh toán mô phỏng (Sandbox) và kích hoạt thành công.
* **Tiền điều kiện**:
  * Người dùng đang ở màn hình chính Billing Dashboard của Workspace.
  * Workspace hiện tại đang sử dụng gói mặc định `Free Plan` và chưa có phương thức thanh toán nào được lưu.
* **Các bước người dùng thực hiện**:
  1. Nhìn vào mục **Current Subscription** ở cột trái để kiểm tra gói hiện tại.
  2. Cuộn xuống phần **Plan Comparison** ở cột phải, tìm gói **Standard Plan** và click nút **Buy**.
  3. Màn hình tự động chuyển sang trang **Upgrade Subscription Plan**. Click chọn checkbox xác nhận điều khoản: *"Tôi xác nhận rằng tài nguyên workspace sẽ được đăng ký gói Standard..."*.
  4. Click nút **Confirm & Proceed to Payment →** ở cuối trang.
  5. Giao diện chuyển sang màn hình **Payment Checkout**. Tại phần **Chọn cổng thanh toán mới**, click chọn radio button **Phương thức thanh toán mô phỏng** (được gắn nhãn *Recommended*).
  6. Tại cột phải **Order Summary**, kiểm tra số tiền hiển thị ở dòng **Total Due Today** (phải hiển thị `$29.00`).
  7. Click nút **Pay Now - $29.00**.
* **Những gì người dùng nhìn thấy**:
  - Tại bước 1: Mục *Current Subscription* hiển thị gói `"FREE Plan"`, giá trị là `$0 / month`. Các thanh tài nguyên (CPU, RAM, AI Agents, Storage) ở phần *Resource Usage* hiển thị định mức của gói Free (2 vCPUs, 4GB RAM, v.v.).
  - Tại bước 4: Trang checkout hiển thị đầy đủ thông tin thanh toán cho gói Standard.
  - Tại bước 7: Màn hình chuyển sang trang **Payment Successful** với vòng tròn tích xanh lá cây, hiển thị bảng hóa đơn thành công:
    * **PLAN**: `Standard Plan`
    * **AMOUNT PAID**: `$29.00`
    * **STATUS**: `Active`
  - Khi click nút **Go to Billing Dashboard** trên màn hình thành công:
    * Giao diện quay trở lại trang Billing Dashboard.
    * Banner Toast thông báo hiện lên: *"Thanh toán thành công! Gói dịch vụ của bạn đã được kích hoạt."*
    * Mục *Current Subscription* cập nhật thành `"STANDARD Plan"` hoạt động.
    * Các thanh giới hạn tài nguyên tại *Resource Usage* tự động nâng lên định mức của gói Standard (8 vCPUs, 16GB RAM, 10 Agents, 50GB Storage).
    * Bảng *Invoice History* hiển thị một dòng hóa đơn mới `INV-2026-XXXX` có trạng thái `"Paid"` màu xanh lá.

---

### TC-UI-SUB-02: Nâng cấp gói dịch vụ từ Standard lên Premium (Prorated Upgrade) và Áp dụng mã giảm giá
* **ID**: `TC-UI-SUB-02`
* **Mục tiêu**: Xác minh quy trình người dùng nâng cấp gói từ Standard lên Premium, áp dụng mã giảm giá thành công để giảm giá thanh toán và hệ thống tự động trừ tiền Standard Credit cũ theo tỷ lệ sử dụng (proration).
* **Tiền điều kiện**:
  * Workspace hiện đang sử dụng gói **Standard Plan** và gói đang hoạt động bình thường.
  * Đang có một phương thức thanh toán mặc định đã lưu.
* **Các bước người dùng thực hiện**:
  1. Tại màn hình Billing Dashboard, tìm mục **Current Subscription** ở cột trái và click nút **Upgrade Plan**.
  2. Màn hình tự động chuyển sang trang **Upgrade Subscription Plan**. Click chọn card **Premium Plan** (có gắn nhãn *Recommended*).
  3. Di chuyển đến ô nhập mã giảm giá tại mục **Upgrade Cost**, nhập chữ `"VCP10"` và click nút **Apply**.
  4. Kiểm tra dòng chiết khấu giảm giá và tổng tiền phải trả **Total Due Today**.
  5. Click chọn checkbox xác nhận điều khoản nâng cấp ở bottom.
  6. Click nút **Confirm & Proceed to Payment →**.
  7. Màn hình chuyển sang trang **Payment Checkout**. Tại mục **Saved Payment Methods**, click chọn phương thức thanh toán mặc định đã lưu của mình.
  8. Click nút **Pay Now - $40.00**.
* **Những gì người dùng nhìn thấy**:
  - Tại bước 2: Card *Premium Plan* được viền khung nổi bật.
  - Tại bước 4: Sau khi click *Apply* mã giảm giá:
    * Hệ thống hiển thị popup Toast thông báo: *"Áp dụng mã giảm giá thành công! Bạn được giảm $10.00"*.
    * Tại bảng tính phí xuất hiện thêm dòng chữ màu xanh lá: `Promo discount (VCP10) -$10.00`.
    * Dòng *Total Due Today* hiển thị giá trị đã giảm còn `$40.00` (giá nâng cấp chênh lệch `$50.00` trừ đi `$10.00` giảm giá).
  - Tại bước 6: Trang checkout hiển thị tóm tắt đơn hàng với tổng thanh toán là `$40.00`.
  - Sau khi click *Pay Now* thành công:
    * Màn hình chuyển sang trang **Payment Successful** hiển thị số tiền đã thanh toán thành công là `$40.00`.
    * Quay lại Billing Dashboard, gói dịch vụ chuyển thành `"PREMIUM Plan"`. Định mức giới hạn tài nguyên tăng lên (32 vCPUs, 64GB RAM, 50 Agents, 500GB Storage). Ngày gia hạn tiếp theo giữ nguyên chu kỳ thanh toán cũ của gói Standard.

---

### TC-UI-SUB-03: Thêm phương thức thanh toán mới (Thẻ tín dụng Visa/Mastercard)
* **ID**: `TC-UI-SUB-03`
* **Mục tiêu**: Xác minh người dùng có thể mở modal thêm thẻ thanh toán mới, hệ thống tự động nhận diện thương hiệu thẻ dựa trên số thẻ nhập vào và lưu thẻ thành công.
* **Tiền điều kiện**:
  * Người dùng đang ở màn hình chính Billing Dashboard.
* **Các bước người dùng thực hiện**:
  1. Nhìn vào cột phải **Payment Method**, click nút **+ Thêm phương thức** (hoặc click nút này trên trạng thái trống nếu chưa có thẻ nào).
  2. Khi modal **Liên kết phương thức thanh toán** xuất hiện, click chọn tab **Thẻ Visa/Master**.
  3. Nhập số thẻ bắt đầu bằng số `4` (ví dụ: `4111 2222 3333 4444`).
  4. Nhập tên chủ thẻ: `NGUYEN VAN A`.
  5. Nhập ngày hết hạn: `12/28`.
  6. Click nút **Lưu thẻ**.
* **Những gì người dùng nhìn thấy**:
  - Khi click nút ở bước 1, một modal popup hiện lên đè mờ màn hình Billing Dashboard phía sau.
  - Tại bước 3: Ngay khi người dùng nhập số thẻ bắt đầu bằng số `4`, trường nhập liệu tự động hiển thị biểu tượng thương hiệu thẻ **VISA**.
  - Tại bước 5: Ô nhập ngày hết hạn tự động chèn dấu `/` sau khi nhập 2 chữ số đầu tiên (định dạng `MM/YY`).
  - Sau khi click *Lưu thẻ* ở bước 6:
    * Modal popup tự động đóng lại.
    * Thông báo Toast thành công hiện lên ở góc màn hình: *"Đã thêm phương thức thanh toán thẻ mới."*
    * Thẻ Visa vừa thêm xuất hiện trong danh sách thẻ tại Billing Dashboard hiển thị dưới dạng masked: `•••• 4444` kèm tên chủ thẻ `NGUYEN VAN A` và nhãn `"MẶC ĐỊNH"` màu xanh dương (nếu đây là thẻ duy nhất).

---

### TC-UI-SUB-04: Xử lý khi thanh toán thất bại (Simulated Failed Payment)
* **ID**: `TC-UI-SUB-04`
* **Mục tiêu**: Xác minh hành vi của hệ thống khi người dùng gặp lỗi thanh toán hoặc hủy thanh toán, đảm bảo hệ thống rollback trạng thái và hiển thị cảnh báo cho phép thanh toán lại gói đang chờ.
* **Tiền điều kiện**:
  * Người dùng đang thực hiện nâng cấp gói lên Premium và đang ở màn hình **Payment Checkout**.
* **Các bước người dùng thực hiện**:
  1. Tại màn hình Payment Checkout, người dùng kiểm tra thông tin đơn hàng ở cột phải.
  2. Thay vì click nút thanh toán bình thường, click vào nút **Simulate Failed Payment** (màu đỏ nhạt).
* **Những gì người dùng nhìn thấy**:
  - Khi click nút ở bước 2:
    * Hệ thống hiển thị popup Toast thông báo lỗi màu đỏ: *"Giao dịch giả lập đã bị hủy bỏ hoặc thất bại."*
    * Màn hình checkout tự động đóng và chuyển hướng người dùng quay trở lại trang **Billing Dashboard**.
  - Tại trang Billing Dashboard:
    * Trạng thái gói dịch vụ của người dùng hiển thị là `Pending` (chờ thanh toán).
    * Xuất hiện một banner cảnh báo màu đỏ nhạt ở cột trái với nội dung: *"Bạn có một giao dịch đăng ký gói PREMIUM đang chờ thanh toán."*
    * Nút hành động chính đổi thành nút màu đỏ nổi bật: **Thanh toán gói đang chờ (PREMIUM)** để người dùng có thể click vào và quay lại trang checkout thực hiện lại giao dịch bất cứ lúc nào.

---

### TC-UI-SUB-05: Hủy tự động gia hạn gói dịch vụ
* **ID**: `TC-UI-SUB-05`
* **Mục tiêu**: Xác minh người dùng có thể chủ động tắt tính năng tự động gia hạn định kỳ gói dịch vụ đang hoạt động thông qua nút bấm trên giao diện.
* **Tiền điều kiện**:
  * Workspace đang sử dụng gói Standard hoặc Premium ở trạng thái `Active`.
  * Tùy chọn tự động gia hạn đang được bật (`Auto-Renewal` switch ở trạng thái ON).
* **Các bước người dùng thực hiện**:
  1. Tại màn hình Billing Dashboard, nhìn vào mục **Current Subscription** ở cột trái.
  2. Click vào nút **Cancel Auto-Renewal** (hoặc click trực tiếp gạt switch **Auto-Renewal** sang OFF).
  3. Một hộp thoại xác nhận của trình duyệt hiện lên với câu hỏi: *"Bạn có chắc chắn muốn hủy tự động gia hạn cho gói dịch vụ hiện tại không?"*. Click nút **OK** để đồng ý.
* **Những gì người dùng nhìn thấy**:
  - Sau khi click đồng ý ở bước 3:
    * Banner Toast thông báo hiện lên: *"Đã hủy tự động gia hạn thành công."* (hoặc *"Đã tắt tự động gia hạn thành công."*).
    * Switch *Auto-Renewal* tự động gạt về trạng thái màu xám (OFF).
    * Dòng chữ hiển thị thông tin gia hạn bên cạnh switch đổi thành thông báo thời hạn hết hiệu lực của gói hiện tại.
    * Nút bấm *Cancel Auto-Renewal* biến mất khỏi giao diện.
    * Gói dịch vụ của người dùng vẫn tiếp tục hiển thị trạng thái `Active` cho đến ngày hết chu kỳ.

---

### TC-UI-SUB-06: Đổi phương thức thanh toán mặc định và Xóa phương thức cũ
* **ID**: `TC-UI-SUB-06`
* **Mục tiêu**: Xác minh người dùng có thể thay đổi thẻ thanh toán mặc định giữa các thẻ đã lưu và thực hiện xóa một thẻ phụ ra khỏi hệ thống.
* **Tiền điều kiện**:
  * Người dùng đang có ít nhất 2 phương thức thanh toán đã liên kết hiển thị ở cột phải **Payment Method** (ví dụ: Thẻ mặc định Visa `•••• 4444` và thẻ phụ Mastercard `•••• 9999`).
* **Các bước người dùng thực hiện**:
  1. Tại cột phải **Payment Method**, cuộn xuống tìm thẻ phụ Mastercard `•••• 9999` và click vào nút **Đặt mặc định**.
  2. Chờ hệ thống cập nhật, sau đó tìm thẻ Visa `•••• 4444` (bấy giờ đã thành thẻ phụ) và click vào icon **thùng rác** (nút xóa thẻ) ở góc phải của thẻ đó.
  3. Khi hộp thoại xác nhận hiện lên hỏi: *"Bạn có chắc muốn xóa phương thức thanh toán này không?"*, click nút **OK**.
* **Những gì người dùng nhìn thấy**:
  - Tại bước 1: Sau khi click, thẻ Mastercard lập tức được gắn nhãn màu xanh dương có chữ **MẶC ĐỊNH**, thẻ Visa biến mất nhãn này.
  - Toast thông báo hiện lên: *"Đã đặt phương thức MC làm mặc định."*
  - Tại bước 3: Sau khi click xác nhận xóa thẻ Visa:
    * Thẻ Visa `•••• 4444` biến mất hoàn toàn khỏi danh sách hiển thị phương thức thanh toán.
    * Toast thông báo hiện lên: *"Đã xóa phương thức thanh toán thành công."*

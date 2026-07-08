# Walkthrough - Tích hợp cổng thanh toán Stripe Elements & Thanh toán 1-click

Tài liệu này tổng hợp toàn bộ các thay đổi và kết quả kiểm thử sau khi tích hợp thành công cổng thanh toán quốc tế **Stripe Elements** dạng nhúng vào phân hệ Billing & Subscription của VCP.

---

## 🛠️ Các thay đổi đã thực hiện (Changes Made)

### 1. Cấu hình & Thư viện
*   **[Modified] [.env](file:///c:/Users/NITRO/Documents/NMCNPM/2023_21_introduction_to_software_engineering/.env)**: Cấu hình các API keys môi trường Test của bạn: `STRIPE_PUBLISHABLE_KEY`, `VITE_STRIPE_PUBLISHABLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`.
*   **[Backend] Cài đặt `stripe` Node.js SDK**.
*   **[Frontend] Cài đặt `@stripe/stripe-js` & `@stripe/react-stripe-js`**.

### 2. Tầng Backend
*   **[New] [stripe-adapter.ts](file:///c:/Users/NITRO/Documents/NMCNPM/2023_21_introduction_to_software_engineering/apps/backend/src/modules/subscription-payment/infrastructure/stripe-adapter.ts)**:
    *   Xây dựng adapter đóng gói Stripe Node.js SDK chính thức.
    *   Hỗ trợ tạo SetupIntent để liên kết thẻ an toàn (`createSetupIntent`).
    *   Hỗ trợ tạo PaymentIntent để thực hiện thanh toán trừ tiền trực tiếp bằng Token thẻ đã lưu (`chargeToken`).
*   **[Modified] [checkout-use-cases.ts](file:///c:/Users/NITRO/Documents/NMCNPM/2023_21_introduction_to_software_engineering/apps/backend/src/modules/subscription-payment/application/checkout-use-cases.ts)**:
    *   Thêm phương thức `createStripeSetupIntent`, `confirmStripeBinding`, và `chargeStripePayment`.
    *   Tự động lưu thông tin thẻ sau khi liên kết vào bảng `paymentMethod` của database PostgreSQL (Prisma), tự động đặt làm mặc định đối với thẻ đầu tiên của workspace.
*   **[Modified] [subscription-router.ts](file:///c:/Users/NITRO/Documents/NMCNPM/2023_21_introduction_to_software_engineering/apps/backend/src/modules/subscription-payment/api/subscription-router.ts)**:
    *   Đăng ký các route API: `POST /stripe/setup-intent`, `POST /stripe/confirm-binding`, và `POST /stripe/charge`.

### 3. Tầng Frontend
*   **[Modified] [subscription-payment-api-client.ts](file:///c:/Users/NITRO/Documents/NMCNPM/2023_21_introduction_to_software_engineering/apps/frontend/src/features/subscription-payment/subscription-payment-api-client.ts)**:
    *   Đăng ký các hàm gọi API tương ứng của Stripe.
*   **[Modified] [subscription-payment-page.tsx](file:///c:/Users/NITRO/Documents/NMCNPM/2023_21_introduction_to_software_engineering/apps/frontend/src/features/subscription-payment/subscription-payment-page.tsx)**:
    *   **Modal thêm phương thức**: Nhúng **Stripe CardElement** (form nhập thẻ chính thức của Stripe) bọc trong component `<Elements>`. Khi người dùng bấm lưu, thông tin thẻ được truyền thẳng đến Stripe để xác thực qua SetupIntent mà không đi qua server của dự án.
    *   **Trang Checkout**:
        *   Cho phép chọn thẻ Stripe đã lưu và bấm **Pay Now** để thanh toán 1-click ngay lập tức qua backend API mà không cần redirect chuyển trang.
        *   Nếu chọn thanh toán bằng thẻ Stripe mới, nhúng form Stripe Elements trực tiếp tại màn hình Checkout để hoàn tất cả 2 việc (liên kết thẻ và thanh toán gói) liền mạch chỉ trong 1 lần click **Pay Now**.

---

## 🧪 Kết quả kiểm thử (Verification Evidence)

Các component và API đã vượt qua kiểm thử tích hợp 100%:

```text
 RUN  v4.1.9 C:/Users/NITRO/Documents/NMCNPM/2023_21_introduction_to_software_engineering

 ✓ tests/component/subscription-payment-integration.test.ts (12 tests) 91ms

 Test Files  1 passed (1)
      Tests  12 passed (12)
   Start at  15:47:50
   Duration  2.47s
```

---

## 🚀 Hướng dẫn kiểm thử thủ công
1.  Truy cập trang **Billing & Subscription** [http://127.0.0.1:5173/](http://127.0.0.1:5173/).
2.  **Liên kết thẻ Stripe**:
    *   Bấm **"+ Thêm phương thức"** ở Dashboard.
    *   Chọn tab **💳 Thẻ Visa/Master (Stripe)**. Nhập số thẻ test mặc định: `4242 4242 4242 4242`, Expire Date và CVC bất kỳ. Bấm **Lưu thẻ**.
    *   Thẻ Stripe mới sẽ lập tức xuất hiện ở mục **Payment Methods** dưới dạng `Visa •••• 4242` và được đồng bộ lưu trữ an toàn dưới cơ sở dữ liệu PostgreSQL.
3.  **Thanh toán 1-click**:
    *   Bấm mua gói bất kỳ (Standard / Premium) $\rightarrow$ Đi tới màn hình Checkout.
    *   Chọn thẻ Stripe vừa liên kết $\rightarrow$ Bấm **Pay Now**.
    *   Giao dịch được trừ tiền thành công trực tiếp bằng Token Stripe, giao diện chuyển tiếp ngay sang màn hình Success mà không cần redirect chuyển trang!

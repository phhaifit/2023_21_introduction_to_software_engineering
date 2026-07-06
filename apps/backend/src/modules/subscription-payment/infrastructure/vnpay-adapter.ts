import crypto from "node:crypto";

export class VnPayAdapter {
  private readonly tmnCode: string;
  private readonly hashSecret: string;
  private readonly vnpUrl: string;
  private readonly vnpApiUrl: string;

  constructor() {
    this.tmnCode = process.env.VNP_TMN_CODE || "2QXG2YX1";
    this.hashSecret = process.env.VNP_HASH_SECRET || "9Z9S9B9R9V9P9N9K9D9T9D9Q9J9U9C9Y";
    this.vnpUrl = process.env.VNP_URL || "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html";
    this.vnpApiUrl = process.env.VNP_API_URL || "https://sandbox.vnpayment.vn/merchant_webapi/api.html";
  }

  /**
   * Tạo URL thanh toán VNPay Sandbox (Hỗ trợ luồng Đăng ký Tokenization)
   */
  createPaymentUrl(params: {
    transactionId: string;
    amount: number;
    ipAddr: string;
    returnUrl: string;
    createDateStr: string; // Định dạng yyyyMMddHHmmss
  }): string {
    const vnpParams: Record<string, string> = {
      vnp_Version: "2.1.0",
      vnp_Command: "pay",
      vnp_TmnCode: this.tmnCode,
      vnp_Locale: "vn",
      vnp_CurrCode: "VND", // VNPay mặc định dùng VND, ta sẽ quy đổi USD sang VND (1 USD = 25000 VND)
      vnp_TxnRef: params.transactionId,
      vnp_OrderInfo: `Thanh toan dang ky goi dich vu VCP: ${params.transactionId}`,
      vnp_OrderType: "other",
      vnp_Amount: String(Math.round(params.amount * 25000 * 100)), // Đổi sang VND và nhân 100 theo chuẩn VNPay
      vnp_ReturnUrl: params.returnUrl,
      vnp_IpAddr: params.ipAddr,
      vnp_CreateDate: params.createDateStr
    };

    // Sắp xếp các tham số theo thứ tự alphabet của key
    const sortedParams = this.sortObject(vnpParams);
    
    // Tạo Query String ký (khoảng trắng chuyển thành + theo chuẩn VNPAY)
    const signData = Object.keys(sortedParams)
      .map(key => `${key}=${encodeURIComponent(sortedParams[key]).replace(/%20/g, "+")}`)
      .join("&");

    // Tạo SecureHash HMAC-SHA512
    const hmac = crypto.createHmac("sha512", this.hashSecret);
    const secureHash = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");

    // Append SecureHash vào URL
    const paymentUrl = `${this.vnpUrl}?${signData}&vnp_SecureHash=${secureHash}`;
    return paymentUrl;
  }

  /**
   * Xác minh chữ ký Checksum trả về từ VNPay (Return URL / IPN URL)
   */
  validateCallback(queryParams: Record<string, any>): boolean {
    const vnpSecureHash = queryParams["vnp_SecureHash"];
    if (!vnpSecureHash) return false;

    // Clone queryParams và xóa secureHash, secureHashType
    const params = { ...queryParams };
    delete params["vnp_SecureHash"];
    delete params["vnp_SecureHashType"];

    // Sắp xếp
    const sortedParams = this.sortObject(params);

    // Tạo Query String để đối soát
    const signData = Object.keys(sortedParams)
      .map(key => `${key}=${encodeURIComponent(sortedParams[key]).replace(/%20/g, "+")}`)
      .join("&");

    // Tính toán hash
    const hmac = crypto.createHmac("sha512", this.hashSecret);
    const calculatedHash = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");

    return calculatedHash.toLowerCase() === vnpSecureHash.toLowerCase();
  }

  /**
   * Gọi API VNPay Tokenization WebAPI để tự động trừ tiền định kỳ (Token Payment)
   */
  async chargeToken(params: {
    transactionId: string;
    amount: number;
    token: string;
    ipAddr: string;
    createDateStr: string; // yyyyMMddHHmmss
  }): Promise<{ success: boolean; message: string; responseCode: string }> {
    const requestId = `REQ-${Date.now()}`;
    const version = "2.1.0";
    const command = "payToken"; // Lệnh thanh toán bằng Token định kỳ
    const amountVnd = Math.round(params.amount * 25000 * 100);

    // Tạo chuỗi hash dữ liệu theo thứ tự cấu trúc VNPay WebAPI
    // Định dạng: RequestId|Version|Command|TmnCode|TxnRef|Amount|Token|CreateDate|IpAddr|HashSecret
    const rawHashData = `${requestId}|${version}|${command}|${this.tmnCode}|${params.transactionId}|${amountVnd}|${params.token}|${params.createDateStr}|${params.ipAddr}|${this.hashSecret}`;
    
    // Hash SHA-256 hoặc SHA-512 tùy chuẩn VNPay API (thường WebAPI dùng SHA-256 hoặc MD5/SHA-512. Ta dùng SHA-512 đồng bộ)
    const secureHash = crypto.createHash("sha512").update(rawHashData).digest("hex");

    const payload = {
      vnp_RequestId: requestId,
      vnp_Version: version,
      vnp_Command: command,
      vnp_TmnCode: this.tmnCode,
      vnp_TxnRef: params.transactionId,
      vnp_Amount: amountVnd,
      vnp_Token: params.token,
      vnp_OrderInfo: `Gia han tu dong goi dich vu VCP: ${params.transactionId}`,
      vnp_IpAddr: params.ipAddr,
      vnp_CreateDate: params.createDateStr,
      vnp_SecureHash: secureHash
    };

    try {
      // Vì là môi trường Sandbox demo, ta sẽ mock việc gọi API WebAPI thực sự tới VNPay
      // Trong môi trường thật: const res = await fetch(this.vnpApiUrl, { method: "POST", body: JSON.stringify(payload) });
      console.log("[VNPay Sandbox WebAPI] Gọi API Token Payment với payload:", payload);

      // Mô phỏng kết quả trả về của VNPay Token Payment Sandbox:
      // "00" là mã thành công
      const mockSuccess = !params.token.includes("fail"); 
      const responseCode = mockSuccess ? "00" : "99";
      const message = mockSuccess ? "Thanh toan qua Token thanh cong" : "The het han hoac khong du so du";

      return {
        success: mockSuccess,
        message,
        responseCode
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || "Loi kết nối API VNPay",
        responseCode: "99"
      };
    }
  }

  private sortObject(obj: Record<string, any>): Record<string, string> {
    const sorted: Record<string, string> = {};
    const keys = Object.keys(obj).sort();
    for (const key of keys) {
      // Chỉ lấy các key bắt đầu bằng vnp_ và có giá trị khác rỗng/null
      if (key.startsWith("vnp_") && obj[key] !== null && obj[key] !== undefined && obj[key] !== "") {
        sorted[key] = String(obj[key]);
      }
    }
    return sorted;
  }
}

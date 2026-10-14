# SỔ CÁI ĐĂNG KÝ & TỐI ƯU HÓA PROMPT AGENT (PROMPT REGISTRY & PLAYBOOK)
**Dự án:** LongHoaFood Master & SaaS Multi-Tenant F&B System  
**Chỉ huy Tối cao:** Anh Hải Âu (Founder)  
**Cố vấn Kỹ thuật:** Đu Đủ  
**Mục tiêu:** Lưu trữ, đánh giá và tối ưu hóa các mẫu Prompt thực chiến cho Roo Code (Gemini 3.1 Pro / 2.5 Pro). Triệt tiêu việc viết lại prompt sai lệch, chuẩn hóa quy trình tái sử dụng cho nhiều chi nhánh.

---

## 📌 QUY TẮC VÀNG VỀ CẤU TRÚC PROMPT (PROMPT FORMULA)
Mọi prompt giao việc cho Roo Code phải tuân thủ công thức 5 thành phần:
1. **[Bối cảnh & Kỷ luật]:** Nhắc đọc `.roorules` và `ROADMAP.md`.
2. **[Phạm vi mục tiêu]:** Nêu đích danh Task ID và các file được phép can thiệp.
3. **[Chỉ thị công cụ]:** Quy định rõ tool được dùng (`read_file`, `list_directory`, `apply_diff`). Cấm đoán mò.
4. **[Hàng rào bảo vệ]:** Nhắc lại các ràng buộc sống còn (Zero-tolerance cutting, giữ nguyên SSOT 7 sheet, trần KM <= 15%).
5. **[Yêu cầu nghiệm thu]:** Tự cập nhật trạng thái vào `ROADMAP.md` và xuất báo cáo kết quả.

---

## 🌟 BẢNG TỔNG HỢP MẪU PROMPT CHUẨN (GOLDEN PROMPT CATALOG)

### 1. NHÓM PROMPT TRINH SÁT & BẮT BỆNH (MODE: ARCHITECT)
*Dùng khi gặp lỗi mới hoặc cần khảo sát cấu trúc file trước khi sửa code, tuyệt đối không ghi file.*

#### Mã: `PR-ARCH-01` | Trinh sát cấu trúc thư mục & chẩn đoán lỗi Fetch view con
- **Mục tiêu:** Tìm nguyên nhân lỗi không tải được module view con trong Single Page Application (`admin-shell.html`).
- **Nội dung Prompt:**
```text
Đọc kỹ file .roorules và ROADMAP.md tại thư mục gốc để nắm vững quy chuẩn kỷ luật và mục tiêu Task 1.1.
Nhiệm vụ của bạn trong phiên này (Mode Architect):
1. Dùng tool list_directory kiểm tra chính xác toàn bộ danh sách file trong thư mục FRONTEND_WEB/.
2. Dùng tool read_file mở file FRONTEND_WEB/admin-shell.html, tìm đến đoạn code JavaScript xử lý sự kiện click nạp view con (hàm fetch).
3. So sánh đường dẫn tương đối trong code fetch và vị trí thực tế của file module.
4. Báo cáo nguyên nhân gốc rễ dẫn đến lỗi 'Failed to fetch' trên Live Server 127.0.0.1:5500.
5. Đề xuất kế hoạch giải quyết chi tiết theo từng bước.
LƯU Ý QUAN TRỌNG: Bạn đang ở chế độ Architect, chỉ đọc và phân tích, TUYỆT ĐỐI KHÔNG thực hiện bất kỳ lệnh ghi hay sửa file nào trong lượt này.
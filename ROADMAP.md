# LỘ TRÌNH PHÁT TRIỂN HỆ THỐNG LONGHOAFOOD MASTER (SAAS F&B)
**Chỉ huy Tối cao:** Anh Hải Âu (Founder)  
**Cố vấn Chiến lược:** Đu Đủ  
**Kỹ sư Trí tuệ Nội trú:** Roo Code (Gemini 3.1 Pro / 2.5 Pro)  
**Hạ tầng:** Google Apps Script (Headless Backend) + Modular SPA (Frontend) + Clasp CLI CI/CD  
**Cập nhật lần cuối:** 2026-10-08 10:30 (Giờ Việt Nam)

---

## 📌 BẢNG TRẠNG THÁI HỆ THỐNG TỔNG QUAN (SYSTEM DASHBOARD)
- **Backend Core**: 14 modules `.gs` đã đồng bộ thành công lên Staging Cloud (`clasp push -f`).
- **Profile Switching**: Đã tích hợp tự động qua `package.json` (`push:stag` / `push:prod`).
- **Agent Framework**: Đã cài đặt Roo Code, nạp API Key Gemini và kích hoạt bộ luật `.roorules`.
- **Điểm nghẽn ưu tiên (Active Blocker)**: Lỗi `Failed to fetch tab-pl.html` khi nạp view con trên Localhost Live Server.

---

## 🎯 GIAI ĐOẠN 1: ỔN ĐỊNH TOÀN DIỆN MÔI TRƯỜNG DEV (STAGING & LOCALHOST)
*Mục tiêu: Đưa toàn bộ giao diện SPA điều khiển vận hành mượt mà trên máy dev.*

- [ ] **Task 1.1: Khắc phục triệt để lỗi Fetch Module P&L**
  - Trạng thái: `[ ]`
  - Chi tiết: 
    * Kiểm tra đường dẫn nạp view con trong `FRONTEND_WEB/admin-shell.html`.
    * Khởi tạo chuẩn hóa file `FRONTEND_WEB/tab-pl.html` (Báo cáo P&L & Dòng tiền).
    * Đảm bảo tải mượt mà các tab: P&L Dòng Tiền, Thực Đơn & Bán Chéo, Trạm Shipper.
- [ ] **Task 1.2: Kiểm thử tính năng Shipper COD Shield trên Localhost**
  - Trạng thái: `[ ]`
  - Chi tiết:
    * Mở `tab-shippers.html` trên Localhost.
    * Test nút "Xóa tài xế" (Kiểm tra chặn xóa khi còn nợ quỹ và cho phép xóa khi công nợ = 0).
    * Test nút "Nộp két / Thanh toán công nợ COD".
- [ ] **Task 1.3: Đồng bộ Menu Manager Standalone**
  - Trạng thái: `[ ]`
  - Chi tiết:
    * Rà soát `menu-manager.html` kết nối với API `getAdminMenuCatalog` và `saveOrUpdateMenuItem`.

---

## 🚀 GIAI ĐOẠN 2: TRIỂN KHAI PRODUCTION CHÍNH THỨC (QUÁN BẾP THÍM 5)
*Mục tiêu: Đưa phiên bản ổn định lên phục vụ quán kinh doanh thật.*

- [ ] **Task 2.1: Cấu hình Script ID Production**
  - Trạng thái: `[ ]`
  - Chi tiết: Điền Script ID chính thức của quán vào `.clasp.prod.json`.
- [ ] **Task 2.2: Đẩy mã nguồn lên Production**
  - Trạng thái: `[ ]`
  - Chi tiết: Chạy lệnh `npm run push:prod` và tạo New Version trong Manage Deployments.
- [ ] **Task 2.3: Nghiệm thu dòng tiền thực tế**
  - Trạng thái: `[ ]`
  - Chi tiết: Kiểm tra tính toán Reverse-Pricing, biên Food Cost và chốt chặn khuyến mãi 15% trên đơn thật.

---

## 🌐 GIAI ĐOẠN 3: NÂNG CẤP KIẾN TRÚC MULTI-TENANT & MCP AUTOMATION
*Mục tiêu: Tự động hóa nhân bản hệ thống cho nhiều chi nhánh F&B.*

- [ ] **Task 3.1: Đóng gói Master Template Database**
  - Trạng thái: `[ ]`
  - Chi tiết: Tạo file Google Spreadsheet mẫu chuẩn 7 sheet SSOT.
- [ ] **Task 3.2: Tích hợp MCP Server Điều phối Đa quán**
  - Trạng thái: `[ ]`
  - Chi tiết: Cấu hình MCP Filesystem & Google Sheets API để AI tự động nhân bản chi nhánh mới theo lệnh.
- [ ] **Task 3.3: Ra mắt Cổng Quản Trị Trung Tâm (Master Franchise Portal)**
  - Trạng thái: `[ ]`
  - Chi tiết: Quản lý tập trung doanh thu và phí bản quyền công nghệ từ các quán đối tác.

---

## 📋 NHẬT KÝ THỰC THI AGENT (EXECUTION AUDIT LOG)
| Thời Gian | Agent Mode | Task Thực Hiện | Các File Tác Động | Kết Quả Nghiệm Thu |
| :--- | :--- | :--- | :--- | :--- |
| 2026-10-08 10:00 | System Init | Cấu hình Clasp CLI & Profile Switching | `.clasp.stag.json`, `package.json` | Thành công kết nối Staging Cloud |
| 2026-10-08 10:25 | System Init | Kích hoạt Roo Code & Bộ luật .roorules | `.roorules`, `ROADMAP.md` | Hoàn tất bộ khung kỷ luật Agent |
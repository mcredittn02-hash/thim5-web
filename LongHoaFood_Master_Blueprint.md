## PHẦN 2: MA TRẬN ROADMAP DẠNG CÂY (TREE VIEW MONITOR)
AI Agent và Founder BẮT BUỘC kiểm tra cây này trước khi thực thi tính năng.

📦 LONGHOAFOOD_SAAS_MASTER
 ┣ 🗄️ 1. DATABASE (Google Sheets - SSOT Control Panel)
 ┃ ┣ 📜 [Sheet] `SYS_CONFIG`          -> [LOCKED] : Bảng điều khiển 33 tham số động
 ┃ ┣ 📜 [Sheet] `SYS_CATEGORIES`      -> [LOCKED] : 8 nhóm danh mục đa ngành hàng
 ┃ ┣ 📜 [Sheet] `DATA_MENU`           -> [LOCKED] : CSDL Thực đơn 13 cột Reverse-Pricing
 ┃ ┣ 📜 [Sheet] `DATA_ORDERS`         -> [LOCKED] : Sổ cái đơn hàng D2C 17 cột chuẩn
 ┃ ┣ 📜 [Sheet] `DATA_SHIPPER_LEDGER` -> [LOCKED] : Sổ cái đối soát tài xế COD 10 cột
 ┃ ┣ 📜 [Sheet] `DATA_CUSTOMERS`      -> [LOCKED] : Mini CRM & Lượt quay thần vị 8 cột
 ┃ ┗ 📜 [Sheet] `DATA_AUDIT_LOGS`     -> [LOCKED] : Nhật ký kiểm toán an ninh 4 cột
 ┃
 ┣ ⚙️ 2. BACKEND (Headless GAS Engine - ĐÃ KHÓA 100%)
 ┃ ┣ 📄 `MasterDictionary.gs`         -> [LOCKED] : Trái tim SSOT, T5_SSOT & T5_UTILS
 ┃ ┣ 📄 `ConfigManager.gs`            -> [LOCKED] : RBAC Pin, 2FA TOTP, Warm-up 5m
 ┃┣ 📄 `CoreRouter.gs`               -> [LOCKED] : Headless Gateway, Security Shield & O(1) Dispatcher (ĐÃ HOÀN TẤT)
 ┃ ┣ 📄 `CustomerCRM.gs`              -> [LOCKED] : Mini CRM, Gu ẩm thực, Vòng quay 5%
 ┃ ┣ 📄 `Financereport.gs`            -> [LOCKED] : Báo cáo P&L động, Radar cảnh báo
 ┃ ┣ 📄 `IngestionEngine.gs`          -> [LOCKED] : Reverse-Pricing 13 cột, Gemini OCR
 ┣ 📄 `OrderEngine.gs`              -> [LOCKED] : Module thẩm định, điều phối đơn & Pure Dynamic Logistics (ĐÃ HOÀN TẤT) 
 ┃ ┣ 📄 `PaymentEngine.gs`            -> [LOCKED] : Webhook MBBank, Loa nổ tiền, Quét Gmail
 ┃ ┣ 📄 `DatabaseArchitect.gs`        -> [LOCKED] : Module 1-Click dọn sạch 7 Sheet
 ┃ ┣ 📄 `DatabaseDeepCleaner.gs`      -> [LOCKED] : Chốt chặn tiêu hủy sheet ngoặc vuông
 ┃ ┗ 📄 `Migration.gs`                -> [LOCKED] : Di trú dữ liệu Staging sang Main
 ┃
 ┗ 🖥️ 3. FRONTEND (Component-based SPA - Thư mục GITHUB-FRONTEND)
   ┣┣ 📄 `api.js`                      -> [LOCKED] : Cầu nối trung tâm gọi API Apps Script (ĐÃ HOÀN TẤT)
   ┣┣ 📄 `tab-pl.html`                 -> [LOCKED] : Real-time P&L Financial Audit & Cash Handover (ĐÃ HOÀN TẤT)
   ┣ 📄 `tracking.html`               -> [TODO] : Trang Live Tracking 5 bước cho khách (Ưu tiên 3)
   ┣ 📄 `wheel.html`                  -> [TODO] : Vòng quay may mắn Canvas Gamification (Ưu tiên 4)
   ┣┣ 📄 `index.html`                  -> [LOCKED] : Storefront D2C Pure Dynamic, GPS & Security Shield (ĐÃ HOÀN TẤT)
   ┣ ┣ 📄 `tab-config.html`             -> [LOCKED] : Control Plane Rule Engine, 7 Strategic Zones (ĐÃ HOÀN TẤT)
   ┣┣ 📄 `admin-shell.html`            -> [LOCKED] : Modular SPA Shell, RBAC Firewall & Router (ĐÃ HOÀN TẤT)
   ┣ 📄 `menu-manager.html`           -> [LOCKED] : Bàn điều khiển Menu Studio 3 Workspace
   ┣ 📄┣ 📄 `tab-menu.html`               -> [LOCKED] : Clean SFC Menu Matrix UI & Omni-Ingestion (ĐÃ HOÀN TẤT)
┣ 📄 `tab-menu.js`                 -> [LOCKED] : Zero Hard-code Controller & Gemini AI OCR Engine (ĐÃ HOÀN TẤT)
   ┣ 📄 `tab-orders.html`             -> [LOCKED] : View Kanban 4 làn điều phối đơn & Bếp KDS
   ┣ 📄 `kitchen.html`                -> [LOCKED] : KDS Dual Verification Gate, Sound Synth & Timer (ĐÃ HOÀN TẤT)
   ┣ ┣ 📄 `tab-shippers.html`            -> [LOCKED] : Tri-Workspace Fleet & Dispatch Engine (ĐÃ HOÀN TẤT)
   ┗ 📄 `tab-campaign.html`           -> [LOCKED] : Trung tâm chiến dịch Geo-Fencing Booster
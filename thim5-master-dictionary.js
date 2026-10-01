/**
 * =============================================================================
 * TÊN FILE: thim5-master-dictionary.js (PHIÊN BẢN ENTERPRISE SaaS v3.0 MASTER)
 * BẢN QUYỀN: BẾP MÌ TRỘN THÍM 5 & LONGHOAFOOD MASTER (NĂM 2026)
 * KIẾN TRÚC SƯ TRƯỞNG: ĐU ĐỦ (CỐ VẤN CHIẾN LƯỢC F&B CHO ANH HẢI ÂU)
 * VAI TRÒ: 
 *   - NGUỒN CHÂN LÝ DUY NHẤT (SINGLE SOURCE OF TRUTH - SSOT) TOÀN HỆ THỐNG.
 *   - BỘ KHÓA BẮT BUỘC CHO TRỢ LÝ AI (GEMINI) VÀ LẬP TRÌNH VIÊN:
 *       1. TRƯỚC KHI VIẾT HÀM HOẶC GỌI API: BẮT BUỘC kiểm tra T5_DICT.ACTIONS.
 *       2. CẤM GÁN CỨNG (HARD-CODE) CON SỐ TÀI CHÍNH / CƯỚC SHIP TRONG CODE.
 *       3. MỌI HÀM TÍNH TOÁN BẮT BUỘC ĐỌC THAM SỐ TỪ SHEET [SYS_CONFIG].
 * =============================================================================
 */

(function(root, factory) {
    if (typeof define === 'function' && define.amd) {
        define([], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.T5_DICT = factory();
        root.T5_SSOT = root.T5_DICT; // Alias tương thích ngược
        if (typeof window !== 'undefined') {
            window.T5_MASTER = root.T5_DICT;
        }
    }
}(typeof self !== 'undefined' ? self : this, function() {

    'use strict';

    /**
     * 1. HẰNG SỐ CƠ SỞ & ĐỊNH DANH BẾP TRUNG TÂM (CHỈ DÙNG LÀM FALLBACK CẤP CỨU)
     * Toàn bộ giá trị thực tế vận hành được điều khiển 100% qua Sheet [SYS_CONFIG]
     */
    var BASE_FALLBACK_CONFIG = Object.freeze({
        APP_VERSION: "3.0.20261001",
        BRAND_NAME: "Mì Trộn Thím 5",
        HEAD_KITCHEN_LOCATION: {
            NAME: "Bếp Trung Tâm Hòa Thành, Tây Ninh",
            LAT: 11.285267,
            LNG: 106.133347,
            GPS_STRING: "11.285267,106.133347",
            STORE_NAV_URL: "https://www.google.com/maps/dir/?api=1&destination=11.285267,106.133347"
        },
        // Fallback Biểu phí Ship D2C (Khi chưa tải được SYS_CONFIG)
        FALLBACK_CUSTOMER_RATE_PER_KM: 3000,  // Thu khách: 3.000đ/km (làm tròn lên)
        FALLBACK_DRIVER_RATE_PER_KM: 4500,    // Trả tài xế: 4.500đ/km
        FALLBACK_MIN_CUSTOMER_FEE: 3000,      // Tối thiểu thu khách: 3.000đ (< 1km tính 1km)
        FALLBACK_MIN_DRIVER_FEE: 5000,        // Tối thiểu trả tài xế: 5.000đ
        FALLBACK_ROUNDING_MODE: "CEIL_1KM",   // Làm tròn lên 1km
        FALLBACK_AUTO_SUBSIDY: true,          // Bật trợ giá quán bù ship
        FALLBACK_FREESHIP_THRESHOLD: 149000,  // Ngưỡng đơn Freeship
        FALLBACK_MAX_SUBSIDY: 20000,          // Trần bù ship tối đa/đơn

        // Fallback Cơ cấu Tài chính D2C Reverse-Pricing
        FALLBACK_D2C_DISCOUNT_PERCENT: 10.0,  // Web D2C giảm 10% so với Giá App Sàn
        FALLBACK_D2C_BUFFER_PERCENT: 15.0,    // Quỹ đệm D2C 15% (Bù ship + Quà + Thuế)
        FALLBACK_TAX_RATE_HKD: 0.045,         // Thuế HKD 4.5%
        FALLBACK_MAX_PROMOTION_RATE: 0.15,    // Khóa trần khuyến mãi tối đa 15% doanh thu gộp
        MAX_COD_HOLDING_PER_SHIPPER: 300000,  // Hạn mức ôm tiền mặt COD tối đa của Shipper
        MIN_AOV_LUCKY_WHEEL: 79000            // Mốc đơn tối thiểu kích hoạt vòng quay may mắn
    });

    /**
     * 2. TỪ ĐIỂN TÊN BẢNG GOOGLE SHEETS CHUẨN HÓA DUY NHẤT (DATABASE SHEETS SSOT)
     * Tuyệt đối không dùng tên phân mảnh: [SYS_CONFIG], [ORDERS_D2C], DATA ORDER
     */
    var SHEETS = Object.freeze({
        CONFIG: "SYS_CONFIG",
        CATEGORIES: "SYS_CATEGORIES",
        ORDERS: "DATA_ORDERS",
        ORDER_ITEMS: "DATA_ORDER_ITEMS",
        MENU: "DATA_MENU",
        SHIPPERS: "DATA_SHIPPERS",
        SHIPPER_LEDGER: "DATA_SHIPPER_LEDGER",
        CRM_USERS: "CRM_USERS",
        AUDIT_LOGS: "DATA_AUDIT_LOGS",
        WHEEL_VOUCHERS: "WHEEL_VOUCHERS"
    });

    /**
     * 3. BỘ CHỈ SỐ CỘT CHUẨN HÓA BẢNG DATA_ORDERS (16 CỘT CHUẨN v3.0)
     */
    var ORDERS_SCHEMA = Object.freeze({
        COL_ORDER_ID: 0,          // Cột A: Mã Đơn (VD: DH260927_4974)
        COL_TIMESTAMP: 1,         // Cột B: Thời Gian Tạo
        COL_OPS_STATUS: 2,        // Cột C: Trạng Thái Vận Hành
        COL_STEP: 3,              // Cột D: Bước Tiến Trình (0, 2, 2.5, 3, 4, -1)
        COL_CUST_NAME: 4,         // Cột E: Họ Tên Khách
        COL_CUST_PHONE: 5,        // Cột F: Số Điện Thoại Khách
        COL_CUST_ADDRESS: 6,      // Cột G: Địa Chỉ Giao Hàng
        COL_DISTANCE_KM: 7,       // Cột H: Cự Ly GPS (km)
        COL_SUBTOTAL: 8,          // Cột I: Tiền Món Ăn
        COL_BASE_SHIP_FEE: 9,     // Cột J: Cước Giao Hàng Gốc (Trả tài xế)
        COL_SHIPPING_SUBSIDY: 10, // Cột K: Trợ Giá Cước Ship Quán Chịu (Khấu trừ Quỹ đệm 15%)
        COL_FINAL_TOTAL: 11,      // Cột L: Thực Thu Khách (Đã trừ trợ giá)
        COL_PAYMENT_METHOD: 12,   // Cột M: Phương Thức (COD / VIETQR)
        COL_SHIPPER_INFO: 13,     // Cột N: Tài Xế Phụ Trách (Tên + SĐT)
        COL_GIFT_NAME: 14,        // Cột O: Món Quà May Mắn 0đ
        COL_NOTE: 15              // Cột P: Ghi Chú Đơn & Vết Kiểm Toán Bếp
    });

    /**
     * 4. BỘ CHỈ SỐ CỘT CHUẨN HÓA BẢNG DATA_MENU (13 CỘT REVERSE-PRICING)
     */
    var MENU_SCHEMA = Object.freeze({
        COL_CODE: 0,              // Cột A: Mã SKU (VD: M01, C01, TOP_TRUNG)
        COL_NAME: 1,              // Cột B: Tên Món Ăn / Topping
        COL_CATEGORY: 2,          // Cột C: Nhóm Danh Mục Đa Ngành
        COL_APP_PRICE: 3,         // Cột D: Giá Niêm Yết App Ngoài (+25%)
        COL_DISCOUNT_D2C: 4,      // Cột E: % Giảm Giá Kênh Web D2C
        COL_D2C_PRICE: 5,         // Cột F: Giá Bán Web D2C Thím 5
        COL_COGS: 6,              // Cột G: Giá Vốn Nguyên Liệu (Food Cost)
        COL_NET_PROFIT: 7,        // Cột H: Lợi Nhuận Ròng (LNR sau khi trừ Quỹ đệm 15%)
        COL_STATUS: 8,            // Cột I: Trạng Thái (ACTIVE | OUT_OF_STOCK | HIDDEN)
        COL_DESCRIPTION: 9,       // Cột J: Mô Tả Hương Vị & Topping Kèm
        COL_IMAGE_URL: 10,        // Cột K: Link Ảnh Google Drive Direct CDN
        COL_CROSS_SELL: 11,       // Cột L: Mã SKU Món Bán Kèm Gợi Ý
        COL_ROLE_TAG: 12          // Cột M: Tag Chiến Lược (CORE | COMBO | BOOSTER | TRAFFIC)
    });

    /**
     * 5. MA TRẬN TRẠNG THÁI VẬN HÀNH & BƯỚC TIẾN TRÌNH CHUẨN (STATE MACHINE SSOT)
     */
    var STEPS = Object.freeze({
        WAIT_VERIFY: 0,      // Đơn mới, chờ khách/shipper/bếp chốt đơn COD
        COOKING: 2,          // Bếp đang chế biến nóng giòn
        PACKED: 2.5,         // Món đã nấu xong, đóng hộp giữ nhiệt chờ tài xế
        SHIPPING: 3,         // Tài xế đang trên đường giao hàng
        COMPLETED: 4,        // Khách nhận món, thu đủ tiền, đơn hoàn tất
        CANCELLED: -1        // Đơn bị hủy (khách báo hủy, hết nguyên liệu, sự cố)
    });

    var STATUS_MAP = Object.freeze({
        NEW: { 
            step: STEPS.WAIT_VERIFY, 
            label: "Chờ Xác Minh COD", 
            badgeClass: "bg-amber-500/20 text-amber-300 border-amber-500/30",
            icon: "fa-receipt",
            eta: "25 - 35 Phút"
        },
        RECEIVED: { 
            step: STEPS.WAIT_VERIFY, 
            label: "Chờ Xác Minh COD", 
            badgeClass: "bg-amber-500/20 text-amber-300 border-amber-500/30",
            icon: "fa-receipt",
            eta: "25 - 35 Phút"
        },
        COOKING: { 
            step: STEPS.COOKING, 
            label: "Bếp Đang Nấu", 
            badgeClass: "bg-orange-500/20 text-orange-400 border-orange-500/40",
            icon: "fa-fire-burner",
            eta: "20 - 30 Phút"
        },
        READY: { 
            step: STEPS.PACKED, 
            label: "Đã Nấu Xong • Chờ Ship", 
            badgeClass: "bg-sky-500/20 text-sky-300 border-sky-500/30",
            icon: "fa-box-open",
            eta: "15 - 20 Phút"
        },
        PACKED: { 
            step: STEPS.PACKED, 
            label: "Đã Đóng Hộp • Chờ Ship", 
            badgeClass: "bg-sky-500/20 text-sky-300 border-sky-500/30",
            icon: "fa-box-open",
            eta: "15 - 20 Phút"
        },
        SHIPPING: { 
            step: STEPS.SHIPPING, 
            label: "Đang Giao Trên Đường", 
            badgeClass: "bg-purple-500/20 text-purple-300 border-purple-500/30",
            icon: "fa-motorcycle",
            eta: "5 - 10 Phút"
        },
        DELIVERING: { 
            step: STEPS.SHIPPING, 
            label: "Đang Giao Tận Tay", 
            badgeClass: "bg-purple-500/20 text-purple-300 border-purple-500/30",
            icon: "fa-motorcycle",
            eta: "5 - 10 Phút"
        },
        COMPLETED: { 
            step: STEPS.COMPLETED, 
            label: "Giao Thành Công", 
            badgeClass: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
            icon: "fa-house-chimney",
            eta: "Đã Nhận Món"
        },
        CANCELLED: { 
            step: STEPS.CANCELLED, 
            label: "Đơn Đã Hủy", 
            badgeClass: "bg-rose-500/20 text-rose-400 border-rose-500/30",
            icon: "fa-ban",
            eta: "--"
        }
    });
    /**
     * 6. HỢP ĐỒNG HÀNH ĐỘNG API TỔNG TOÀN HỆ THỐNG (ROUTER ACTIONS CONTRACT)
     * Đồng bộ chuẩn 100% giữa Frontend gọi qua Thim5API.callGAS và Backend CoreRouter.gs / IngestionEngine.gs
     */
    var ACTIONS = {
        // Quản trị Thực đơn & Danh mục Đa Ngành
        GET_ADMIN_MENU_CATALOG: "getAdminMenuCatalog",
        SAVE_OR_UPDATE_MENU_ITEM: "saveOrUpdateMenuItem",
        TOGGLE_MENU_ITEM_STATUS: "toggleMenuItemStatus",
        DELETE_MENU_ITEM: "deleteMenuItem",
        GET_MENU_CATEGORIES: "getMenuCategories",
        SAVE_MENU_CATEGORY: "saveMenuCategory",
        DELETE_MENU_CATEGORY: "deleteMenuCategory",

        // Omni-Ingestion Pipeline & Media Direct Drive CDN
        BATCH_IMPORT_MENU_ITEMS: "batchImportMenuItems",
        PARSE_UPLOADED_SPREADSHEET_BUFFER: "parseUploadedSpreadsheetBuffer",
        PROCESS_MENU_OCR_WITH_GEMINI: "processMenuOcrWithGemini",
        EXTRACT_MENU_FROM_PUBLIC_URL: "extractMenuFromPublicUrl",
        UPLOAD_DISH_MEDIA_IMAGE: "uploadDishMediaImage",
        UPLOAD_MENU_IMAGE: "uploadDishMediaImage", // Alias tương thích ngược
        GET_MENU_EXCEL_TEMPLATE: "getMenuExcelTemplateStructure",

        // Bán Hàng Storefront D2C & Tra Cứu Khách Hàng
        GET_CONFIG: "getConfig",
        CREATE_D2C_ORDER: "createD2COrder",
        GET_ORDER_TRACKING: "getOrderTracking",
        TOGGLE_STORE_STATUS: "toggleStoreOperationalStatus",
        GET_STORE_STATUS: "getStoreOperationalStatus",

        // Cấu hình Hệ Thống & Cước Phí Ship Động (Zero-Hardcode)
        GET_SYSTEM_DYNAMIC_CONFIG: "getSystemDynamicConfig",
        SAVE_SYSTEM_DYNAMIC_CONFIG: "saveSystemDynamicConfig",
        CALCULATE_DYNAMIC_SHIPPING_FEE: "calculateDynamicShippingFee",

        // Trạm Bếp KDS & Bàn Giao Món
        GET_KITCHEN_KDS_ORDERS: "getKitchenKdsOrders",
        KITCHEN_UPDATE_STATUS: "kitchenUpdateStatus",
        KITCHEN_ASSIGN_SHIPPER: "kitchenAssignShipper",
        KITCHEN_SETTLE_HANDOVER: "kitchenSettleHandover",
        VERIFY_AND_ASSIGN_COOK_ORDER: "verifyAndAssignCookOrder",

        // Trạm Điều Phối Shipper
        GET_SHIPPER_ORDERS: "getShipperOrders",
        SHIPPER_VERIFY_COD_SUCCESS: "shipperVerifyCodOrderSuccess",
        SHIPPER_UPDATE_STEP: "shipperUpdateStep",
        SHIPPER_RELEASE_ORDER: "shipperReleaseOrder",
        GET_ACTIVE_SHIPPERS_LIST: "getActiveShippersList",
        SAVE_OR_UPDATE_SHIPPER: "saveOrUpdateShipper",
        TOGGLE_SHIPPER_STATUS: "toggleShipperStatus",

        // Quản Lý Đơn Hàng & Tài Chính Admin Shell
        GET_ORDERS_LIST: "getOrdersList",
        ASSIGN_SHIPPER: "assignShipper",
        CONFIRM_KITCHEN_HANDOVER: "confirmKitchenHandover",
        COMPLETE_ORDER: "completeOrder",
        MANUAL_APPROVE_PAYMENT: "manualApprovePayment",
        GET_FINANCIAL_PL_SUMMARY: "getFinancialPlSummary",
        GET_SHIPPER_COD_LEDGER: "getShipperCodHoldingLedger",
        GET_FINANCIAL_AUDIT_LOGS: "getFinancialAuditLogs",

        // Bảo Mật, RBAC & Google Authenticator 2FA
        VERIFY_ADMIN_ROLE: "verifyAdminRole",
        VERIFY_SUPER_ADMIN_TOTP: "verifySuperAdminTotp",
        GET_TOTP_SETUP_QR_DATA: "getTotpSetupQrData",
        SEND_EMERGENCY_OTP_TO_EMAIL: "sendEmergencyBackupOtpToEmail",

        // Mini CRM Khách Hàng & Vòng Quay May Mắn (Gamification)
        GET_CUSTOMER_PROFILE: "getCustomerProfile",
        GET_PUBLIC_WHEEL_CONFIG: "getPublicWheelConfig",
        SPIN_LUCKY_WHEEL: "spinLuckyWheel",
        UPDATE_WHEEL_CONFIG: "updateWheelConfig",
        REDEEM_GIFT_TOKEN: "redeemGiftToken",
        LOG_WHEEL_REWARD: "logWheelRewardTransaction"
    };

    /**
     * CƠ CHẾ TỰ ĐỘNG ĐĂNG KÝ HÀNH ĐỘNG MỚI (DYNAMIC EXTENSION CONTRACT)
     * Giúp AI hoặc Module con đăng ký thêm Action API mới mà không làm vỡ SSOT.
     * @param {string} keyName - Tên khóa UPPER_SNAKE_CASE (VD: "EXPORT_EXCEL_REPORT")
     * @param {string} actionString - Tên Action camelCase (VD: "exportExcelReport")
     */
    function registerAction(keyName, actionString) {
        if (!keyName || !actionString) return;
        var cleanKey = String(keyName).trim().toUpperCase();
        var cleanAction = String(actionString).trim();
        ACTIONS[cleanKey] = cleanAction;
    }

    /**
     * 7. TỪ ĐIỂN KHÓA CẤU HÌNH TRÊN SHEET [SYS_CONFIG] (CONFIG_KEYS SSOT)
     * Khóa cứng tên Key trên Google Sheets để loại bỏ hoàn toàn việc gán cứng số trong code.
     */
    var CONFIG_KEYS = Object.freeze({
        // Nhận diện quán
        STORE_NAME: "STORE_NAME",
        STORE_SLOGAN: "STORE_SLOGAN",
        STORE_HOTLINE: "STORE_HOTLINE",
        STORE_ADDRESS: "STORE_ADDRESS",
        STORE_ICON: "STORE_ICON",
        STORE_LATITUDE: "STORE_LATITUDE",
        STORE_LONGITUDE: "STORE_LONGITUDE",
        STORE_STATUS: "STORE_STATUS",
        STORE_CLOSED_MESSAGE: "STORE_CLOSED_MESSAGE",

        // Biểu phí Ship D2C Linh hoạt
        SHIPPING_RATE_CUSTOMER_PER_KM: "SHIPPING_RATE_CUSTOMER_PER_KM", // Giá thu khách mỗi km
        SHIPPING_RATE_DRIVER_PER_KM: "SHIPPING_RATE_DRIVER_PER_KM",     // Giá trả tài xế mỗi km
        SHIPPING_MIN_CUSTOMER_FEE: "SHIPPING_MIN_CUSTOMER_FEE",         // Cước tối thiểu thu khách
        SHIPPING_MIN_DRIVER_FEE: "SHIPPING_MIN_DRIVER_FEE",             // Cước tối thiểu trả tài xế
        SHIPPING_AUTO_SUBSIDY: "SHIPPING_AUTO_SUBSIDY",                 // Quán bù ship tự động
        SHIPPING_ROUNDING_MODE: "SHIPPING_ROUNDING_MODE",               // CEIL_1KM hoặc EXACT
        FREESHIP_MIN_SUBTOTAL: "FREESHIP_MIN_SUBTOTAL",                 // Ngưỡng đơn Freeship
        MAX_SHIPPING_SUBSIDY: "MAX_SHIPPING_SUBSIDY",                   // Trần bù ship tối đa/đơn

        // Cơ cấu tài chính & Quỹ đệm D2C
        D2C_DISCOUNT_PERCENT: "D2C_DISCOUNT_PERCENT",                   // % Giảm giá D2C Web so với Sàn
        D2C_BUFFER_PERCENT: "D2C_BUFFER_PERCENT",                       // % Quỹ đệm D2C (Bù ship + Vòng quay + Thuế)
        PLATFORM_MASTER_FEE: "PLATFORM_MASTER_FEE",                     // Phí nền tảng SaaS
        TAX_RATE_HKD: "TAX_RATE_HKD",                                   // Thuế khoán HKD 4.5%
        MAX_PROMOTION_RATE: "MAX_PROMOTION_RATE",                       // Trần khuyến mãi tối đa 15%

        // Thanh toán ngân hàng & MoMo
        BANK_BIN: "BANK_BIN",
        BANK_CODE: "BANK_CODE",
        BANK_ACCOUNT_NO: "BANK_ACCOUNT_NO",
        BANK_ACCOUNT_NAME: "BANK_ACCOUNT_NAME",
        MOMO_PHONE: "MOMO_PHONE",
        MOMO_NAME: "MOMO_NAME",

        // Đội xe & Hạn mức
        MAX_COD_HOLDING_PER_SHIPPER: "MAX_COD_HOLDING_PER_SHIPPER",     // Trần nợ COD tài xế
        DRIVER_BONUS_PER_ORDER: "DRIVER_BONUS_PER_ORDER",               // Thưởng nóng tài xế

        // Bảo mật
        MASTER_SUPER_KEY: "MASTER_SUPER_KEY",
        SUPER_ADMIN_EMAIL: "SUPER_ADMIN_EMAIL",
        PIN_ADMIN_LV1: "PIN_ADMIN_LV1",
        PIN_ADMIN_LV2: "PIN_ADMIN_LV2"
    });

    /**
     * 8. DANH SÁCH SHIPPER NỘI BỘ MẶC ĐỊNH (PRESET SHIPPERS)
     */
    var SHIPPER_PRESETS = Object.freeze({
        "0585": { id: "SHIP_01", name: "Nguyễn Hải Âu", phone: "0934.220.585", rawPhone: "0934220585" },
        "4693": { id: "SHIP_02", name: "Nguyễn Hải Âu", phone: "0969.004.693", rawPhone: "0969004693" },
        "2862": { id: "SHIP_03", name: "Trần Minh Nam", phone: "0968.222.862", rawPhone: "0968222862" }
    });
    /**
     * 9. HÀM CHUẨN HÓA THỰC THỂ ĐƠN HÀNG TOÀN NĂNG (UNIVERSAL ORDER NORMALIZER)
     * Nhận vào bất kỳ đối tượng thô nào từ Google Sheets / KDS / Shipper / Admin / Web D2C.
     * Trả về đối tượng đồng nhất 100% thuộc tính an toàn, triệt tiêu hoàn toàn lỗi undefined.
     * @param {Object} raw - Dữ liệu đơn hàng thô
     * @returns {Object} Thực thể đơn hàng chuẩn hóa SSOT
     */
    function normalizeOrderEntity(raw) {
        if (!raw || typeof raw !== 'object') {
            raw = {};
        }

        // 1. Mã đơn hàng chuẩn hóa
        var orderId = String(raw.orderId || raw.orderCode || raw.code || raw.id || "DH_TEMP").trim();

        // 2. Chuẩn hóa Khách hàng & Địa chỉ
        var custName = String(raw.name || raw.customerName || "").trim();
        var custPhone = String(raw.phone || raw.customerPhone || "").trim();
        var custAddr = String(raw.address || raw.customerAddress || "Hòa Thành, Tây Ninh").trim();

        if ((!custName || !custPhone) && raw.customerInfo) {
            var parts = String(raw.customerInfo).split("|").map(function(s) { return s.trim(); });
            if (!custName && parts[0]) custName = parts[0];
            if (!custPhone && parts[1]) custPhone = parts[1];
            if ((!custAddr || custAddr === "Hòa Thành, Tây Ninh") && parts[2]) custAddr = parts[2];
        }

        if (raw.customer && typeof raw.customer === 'object') {
            if (!custName && raw.customer.name) custName = String(raw.customer.name).trim();
            if (!custPhone && raw.customer.phone) custPhone = String(raw.customer.phone).trim();
            if ((!custAddr || custAddr === "Hòa Thành, Tây Ninh") && raw.customer.address) {
                custAddr = String(raw.customer.address).trim();
            }
        }

        // 3. Chuẩn hóa Trạng thái Vận hành & Bước (State Machine SSOT)
        var rawStatus = String(raw.status || raw.operationalStatus || raw.opsStatus || "RECEIVED").trim().toUpperCase();
        var stepVal = 0;

        if (raw.step !== undefined && raw.step !== null) {
            stepVal = Number(raw.step);
        } else if (rawStatus === "CANCELLED" || rawStatus === "ĐÃ HỦY" || rawStatus === "HUY") {
            stepVal = STEPS.CANCELLED;
        } else if (rawStatus === "COMPLETED" || rawStatus === "HOÀN TẤT" || rawStatus === "DELIVERED") {
            stepVal = STEPS.COMPLETED;
        } else if (rawStatus === "DELIVERING" || rawStatus === "ĐANG GIAO" || rawStatus === "SHIPPING") {
            stepVal = STEPS.SHIPPING;
        } else if (rawStatus === "PACKED" || rawStatus === "READY" || rawStatus === "ĐÓNG GÓI") {
            stepVal = STEPS.PACKED;
        } else if (rawStatus === "COOKING" || rawStatus === "ĐANG NẤU") {
            stepVal = STEPS.COOKING;
        } else {
            stepVal = STEPS.WAIT_VERIFY;
        }

        var canonicalStatus = "RECEIVED";
        if (stepVal === STEPS.CANCELLED) canonicalStatus = "CANCELLED";
        else if (stepVal === STEPS.COMPLETED) canonicalStatus = "COMPLETED";
        else if (stepVal === STEPS.SHIPPING) canonicalStatus = "DELIVERING";
        else if (stepVal === STEPS.PACKED) canonicalStatus = "PACKED";
        else if (stepVal === STEPS.COOKING) canonicalStatus = "COOKING";
        else canonicalStatus = "RECEIVED";

        var statusMeta = STATUS_MAP[canonicalStatus] || STATUS_MAP.RECEIVED;

        // 4. Chuẩn hóa Phương thức & Trạng thái Thanh toán
        var rawMethod = String(raw.paymentMethod || raw.method || raw.payMethod || "COD").trim().toUpperCase();
        var isOnlinePaid = (rawMethod === "CK_VIETQR" || rawMethod === "VIETQR" || rawMethod === "BANK" || rawMethod === "MOMO");
        var paymentMethod = isOnlinePaid ? "VIETQR" : "COD";
        var paymentStatus = String(raw.paymentStatus || (isOnlinePaid ? "PAID_VIETQR" : "UNPAID")).trim().toUpperCase();

        // 5. Chuẩn hóa Tài chính & Dòng tiền
        var subtotal = Number(raw.subtotal || raw.itemsTotal || 0);
        var baseShipFee = Number(raw.shippingFee || raw.shipFee || raw.baseShipFee || BASE_FALLBACK_CONFIG.FALLBACK_MIN_CUSTOMER_FEE);
        var shippingSubsidy = Number(raw.shippingSubsidy || raw.subsidizedShipFee || raw.subsidy || 0);
        var customerShipFee = Math.max(0, baseShipFee - shippingSubsidy);

        var finalTotal = Number(raw.finalTotal || raw.totalAmount || raw.total || (subtotal + customerShipFee));
        var collectFromCustomer = isOnlinePaid ? 0 : finalTotal;

        var externalShipFee = Number(raw.externalShipFee || 0);
        var actualSubsidySpent = externalShipFee > 0 ? Math.max(0, externalShipFee - customerShipFee) : shippingSubsidy;

        // 6. Chuẩn hóa Kênh & Thông tin Shipper
        var rawShipperInfo = String(raw.shipperInfo || raw.shipper || raw.assignedShipper || "").trim();
        var deliveryChannel = String(raw.deliveryChannel || raw.shipperType || (rawShipperInfo.indexOf("GRAB") !== -1 || rawShipperInfo.indexOf("VILL") !== -1 ? "EXTERNAL" : "INTERNAL")).trim().toUpperCase();
        var trackingCode = String(raw.trackingCode || raw.externalTrackingCode || "").trim();

        // 7. Chuẩn hóa Danh sách Món ăn
        var itemsList = [];
        var itemsFormattedText = "";

        if (Array.isArray(raw.items)) {
            itemsList = raw.items.map(function(it) {
                var itQty = Number(it.quantity || it.qty || 1);
                var itPrice = Number(it.price || it.d2cPrice || 0);
                var itName = String(it.name || it.itemName || "Món ăn").trim();
                var itTaste = String(it.taste || raw.taste || "Cay Nhẹ").trim();
                var itSoup = String(it.soup || "").trim();
                var itTopping = String(it.toppingSummary || it.topping || "").trim();

                return {
                    dishId: String(it.dishId || it.id || it.code || "M_ITEM"),
                    name: itName,
                    price: itPrice,
                    quantity: itQty,
                    total: itPrice * itQty,
                    taste: itTaste,
                    soup: itSoup,
                    toppingSummary: itTopping,
                    isGift: Boolean(it.isGift || it.dishId === "GIFT_REWARD")
                };
            });

            itemsFormattedText = itemsList.map(function(it) {
                var desc = it.quantity + "x " + it.name;
                var sub = [];
                if (it.soup) sub.push(it.soup);
                if (it.toppingSummary && it.toppingSummary.indexOf("Token:") === -1) sub.push(it.toppingSummary);
                if (sub.length > 0) desc += " (" + sub.join(" • ") + ")";
                return desc;
            }).join(" | ");

        } else if (typeof raw.items === 'string' && raw.items.trim()) {
            itemsFormattedText = raw.items.trim();
            itemsList = raw.items.split(" | ").map(function(str) {
                return {
                    dishId: "M_TEXT",
                    name: str.trim(),
                    price: 0,
                    quantity: 1,
                    total: 0,
                    taste: String(raw.taste || "Cay Nhẹ"),
                    soup: "",
                    toppingSummary: "",
                    isGift: false
                };
            });
        }

        // Quà tặng 0đ may mắn từ Vòng quay
        var giftReward = null;
        if (raw.gift && raw.gift.name) {
            giftReward = {
                name: String(raw.gift.name).replace("🎁 ", "").trim(),
                giftToken: String(raw.gift.giftToken || "VERIFIED").trim()
            };
        } else if (raw.giftName) {
            giftReward = {
                name: String(raw.giftName).replace("🎁 ", "").trim(),
                giftToken: "VERIFIED"
            };
        }

        return {
            orderId: orderId,
            step: stepVal,
            opsStatus: canonicalStatus,
            statusLabel: statusMeta.label,
            badgeClass: statusMeta.badgeClass,
            statusIcon: statusMeta.icon,
            etaTime: statusMeta.eta,
            customer: {
                name: custName || "Khách Vãng Lai",
                phone: custPhone || "N/A",
                address: custAddr || "Hòa Thành, Tây Ninh",
                taste: String(raw.taste || "Cay Nhẹ (Chuẩn vị Thím 5)").trim(),
                distanceKm: Number(raw.distanceKm || raw.dist || 1.2),
                gpsLocation: raw.gps || (raw.customer && raw.customer.location ? raw.customer.location : null)
            },
            payment: {
                method: paymentMethod,
                isOnlinePaid: isOnlinePaid,
                status: paymentStatus,
                subtotal: subtotal,
                baseShipFee: baseShipFee,
                shippingSubsidy: shippingSubsidy,
                customerShipFee: customerShipFee,
                externalShipFee: externalShipFee,
                actualSubsidySpent: actualSubsidySpent,
                finalTotal: finalTotal,
                collectFromCustomer: collectFromCustomer
            },
            logistics: {
                deliveryChannel: deliveryChannel,
                shipperInfo: rawShipperInfo,
                trackingCode: trackingCode,
                storeNavUrl: raw.storeGpsUrl || BASE_FALLBACK_CONFIG.HEAD_KITCHEN_LOCATION.STORE_NAV_URL,
                customerNavUrl: raw.customerGpsUrl || ("https://www.google.com/maps/dir/?api=1&destination=" + encodeURIComponent(custAddr))
            },
            items: itemsList,
            itemsFormattedText: itemsFormattedText || "Món ăn Bếp Thím 5",
            giftReward: giftReward,
            note: String(raw.note || "").trim(),
            createdAt: raw.createdAt || raw.timestamp || raw.time || new Date().toISOString()
        };
    }

    /**
     * 10. CỖ MÁY TÍNH TOÁN CƯỚC PHÍ SHIP D2C LINH HOẠT THỜI GIAN THỰC (ZERO-HARDCODE)
     * Công thức: Cự ly làm tròn lên 1km, Cước thu khách tính riêng (3k/km), Cước trả ship tính riêng (4.5k/km).
     * Quán tự động bù ship khoản chênh lệch và khấu trừ vào Quỹ đệm D2C 15% của Thực Đơn.
     * @param {number} distanceKm - Khoảng cách GPS thực tế (km)
     * @param {number} [orderSubtotal=0] - Tổng tiền món ăn trong giỏ hàng (VND)
     * @param {Object} [customConfig] - Cấu hình nạp động từ Sheet [SYS_CONFIG]
     * @returns {Object} Chi tiết cước thu khách, cước trả ship, tiền quán bù
     */
    function calculateDynamicShippingFee(distanceKm, orderSubtotal, customConfig) {
        var dist = Number(distanceKm) || 1.0;
        var subtotal = Number(orderSubtotal) || 0;
        var cfg = customConfig || {};

        // 1. Quy tắc làm tròn cự ly tính cước dựa trên Sheet SYS_CONFIG
        var roundingMode = String(cfg.roundingMode || cfg.SHIPPING_ROUNDING_MODE || BASE_FALLBACK_CONFIG.FALLBACK_ROUNDING_MODE).toUpperCase();
        var billableKm = (roundingMode === "EXACT") ? Math.max(0.5, dist) : Math.max(1, Math.ceil(dist));

        // 2. Tính cước trả cho Shipper (Thu nhập thực tế giữ chân đội xe)
        var driverRate = Number(cfg.driverRatePerKm || cfg.SHIPPING_RATE_DRIVER_PER_KM || BASE_FALLBACK_CONFIG.FALLBACK_DRIVER_RATE_PER_KM);
        var minDriverFee = Number(cfg.minDriverFee || cfg.SHIPPING_MIN_DRIVER_FEE || BASE_FALLBACK_CONFIG.FALLBACK_MIN_DRIVER_FEE);
        var driverPayoutFee = Math.max(minDriverFee, Math.round(billableKm * driverRate));

        // 3. Tính cước thu của Khách hàng (Tạo cảm giác ship rẻ kích cầu)
        var customerRate = Number(cfg.customerRatePerKm || cfg.SHIPPING_RATE_CUSTOMER_PER_KM || BASE_FALLBACK_CONFIG.FALLBACK_CUSTOMER_RATE_PER_KM);
        var minCustomerFee = Number(cfg.minCustomerFee || cfg.SHIPPING_MIN_CUSTOMER_FEE || BASE_FALLBACK_CONFIG.FALLBACK_MIN_CUSTOMER_FEE);
        var customerPayFee = Math.max(minCustomerFee, Math.round(billableKm * customerRate));

        // 4. Tính toán phần tiền Quán tài trợ bù ship (Merchant Subsidy)
        var autoSubsidy = (cfg.autoSubsidy !== undefined)
                          ? Boolean(cfg.autoSubsidy === true || cfg.autoSubsidy === "true")
                          : (cfg.SHIPPING_AUTO_SUBSIDY !== undefined ? Boolean(cfg.SHIPPING_AUTO_SUBSIDY === true || cfg.SHIPPING_AUTO_SUBSIDY === "true") : BASE_FALLBACK_CONFIG.FALLBACK_AUTO_SUBSIDY);

        var subsidy = 0;
        var subsidyReason = "Trợ giá cước cạnh tranh D2C";

        if (autoSubsidy) {
            subsidy = Math.max(0, driverPayoutFee - customerPayFee);

            // Ưu đãi Freeship theo mốc giá trị đơn hàng
            var freeshipThreshold = Number(cfg.freeshipThreshold || cfg.FREESHIP_MIN_SUBTOTAL || BASE_FALLBACK_CONFIG.FALLBACK_FREESHIP_THRESHOLD);
            if (subtotal >= freeshipThreshold && subtotal > 0) {
                subsidy += customerPayFee;
                customerPayFee = 0;
                subsidyReason = "Freeship đơn tiệc từ " + Math.round(freeshipThreshold / 1000) + "k";
            }

            // Khóa trần mức bù ship tối đa để bảo vệ dòng tiền quán
            var maxSubsidy = Number(cfg.maxSubsidy || cfg.MAX_SHIPPING_SUBSIDY || BASE_FALLBACK_CONFIG.FALLBACK_MAX_SUBSIDY);
            if (subsidy > maxSubsidy) {
                var excess = subsidy - maxSubsidy;
                subsidy = maxSubsidy;
                customerPayFee += excess; // Khách cùng chia sẻ phần vượt trần
            }
        } else {
            customerPayFee = driverPayoutFee;
            subsidy = 0;
            subsidyReason = "Không áp dụng trợ giá quán";
        }

        return {
            distanceKm: dist,
            billableKm: billableKm,
            customerPayFee: customerPayFee,        // Cước thu khách hiển thị trên Web
            driverPayoutFee: driverPayoutFee,      // Cước trả cho tài xế trên App
            merchantSubsidy: subsidy,              // Tiền quán bù trừ vào Quỹ đệm D2C 15%
            subsidyReason: subsidyReason,
            isFreeShip: (customerPayFee === 0),
            roundingMode: roundingMode
        };
    }

    /**
     * 11. CÔNG CỤ TÍNH GIÁ REVERSE-PRICING 13 CỘT CHO BẢNG DATA_MENU
     * Công thức: Giá D2C = Giá App * (1 - % Giảm D2C)
     * Quỹ đệm D2C (15%) = Giá D2C * 15% (Bù ship + Vòng quay + Thuế HKD 4.5%)
     * Lợi Nhuận Ròng (LNR) = Giá D2C - Giá Vốn (COGS) - Quỹ đệm D2C
     * @param {number} appPrice - Giá niêm yết App ngoài (+25%)
     * @param {number} cogs - Giá vốn nguyên liệu món ăn (COGS)
     * @param {number} [optDiscountPercent] - % Giảm giá D2C (mặc định 10%)
     * @param {number} [optBufferPercent] - % Quỹ đệm D2C (mặc định 15%)
     * @returns {Object} Chi tiết phân tích Reverse-Pricing
     */
    function calculateReversePricing(appPrice, cogs, optDiscountPercent, optBufferPercent) {
        var rawAppPrice = Number(appPrice) || 0;
        var rawCogs = Number(cogs) || 0;
        var discountPercent = (optDiscountPercent !== undefined && optDiscountPercent !== null && optDiscountPercent !== "")
                              ? Number(optDiscountPercent)
                              : BASE_FALLBACK_CONFIG.FALLBACK_D2C_DISCOUNT_PERCENT;
        var bufferPercent = (optBufferPercent !== undefined && optBufferPercent !== null && optBufferPercent !== "")
                            ? Number(optBufferPercent)
                            : BASE_FALLBACK_CONFIG.FALLBACK_D2C_BUFFER_PERCENT;

        var rawD2cPrice = rawAppPrice * (1 - (discountPercent / 100));
        var d2cPrice = Math.round(rawD2cPrice / 1000) * 1000;
        var grossProfit = Math.max(0, d2cPrice - rawCogs);
        var bufferAmount = Math.round(d2cPrice * (bufferPercent / 100));
        var netProfit = grossProfit - bufferAmount;
        var fcPercentD2c = d2cPrice > 0 ? Math.round((rawCogs / d2cPrice) * 1000) / 10 : 0;
        var lnrMarginPercent = d2cPrice > 0 ? Math.round((netProfit / d2cPrice) * 1000) / 10 : 0;

        return {
            appPrice: rawAppPrice,
            cogs: rawCogs,
            discountPercent: discountPercent,
            d2cPrice: d2cPrice,
            grossProfit: grossProfit,
            bufferPercent: bufferPercent,
            bufferAmount: bufferAmount,
            netProfit: netProfit,
            fcPercentD2c: fcPercentD2c,
            lnrMarginPercent: lnrMarginPercent
        };
    }

    /**
     * 12. ĐÓNG GÓI VÀ XUẤT BẢN THƯ VIỆN TOÀN CỤC SSOT
     */
    return {
        CONSTANTS: BASE_FALLBACK_CONFIG,
        SHEETS: SHEETS,
        ORDERS_SCHEMA: ORDERS_SCHEMA,
        MENU_SCHEMA: MENU_SCHEMA,
        STEPS: STEPS,
        STATUS_MAP: STATUS_MAP,
        ACTIONS: ACTIONS,
        CONFIG_KEYS: CONFIG_KEYS,
        SHIPPER_PRESETS: SHIPPER_PRESETS,
        registerAction: registerAction,
        normalizeOrderEntity: normalizeOrderEntity,
        calculateDynamicShippingFee: calculateDynamicShippingFee,
        calculateReversePricing: calculateReversePricing
    };

}));

/* ==========================================================================
   FILE: thim5-master-dictionary.js - PHß║ªN [1/2]
   Bß║«T ─Éß║ªU Tß╗¬: Khai b├ío Module Wrapper SSOT & Cß║Ñu h├¼nh Fallback C╞í sß╗ƒ
   Kß║╛T TH├ÜC Tß║áI: Thß║╗ ─æ├│ng }; cß╗ºa Bß║úng M├ú Lß╗ùi ─Éß╗ïnh Danh ERROR_CODES
   H╞»ß╗ÜNG Dß║¬N: Tß║ío mß╗¢i hoß║╖c ghi ─æ├¿ phß║ºn ─æß║ºu ti├¬n cß╗ºa thim5-master-dictionary.js
   ========================================================================== */

/**
 * =============================================================================
 * T├èN FILE: thim5-master-dictionary.js (PHI├èN Bß║óN ENTERPRISE SaaS v3.5 MASTER)
 * Bß║óN QUYß╗ÇN: Bß║╛P M├î TRß╗ÿN TH├ìM 5 & LONGHOAFOOD MASTER (N─éM 2026)
 * KIß║╛N TR├ÜC S╞» TR╞»ß╗₧NG: ─ÉU ─Éß╗ª (Cß╗É Vß║ñN CHIß║╛N L╞»ß╗óC F&B CHO ANH Hß║óI ├éU)
 * VAI TR├Æ: 
 *   - NGUß╗ÆN CH├éN L├¥ DUY NHß║ñT (SINGLE SOURCE OF TRUTH - SSOT) TO├ÇN Hß╗å THß╗ÉNG.
 *   - Bß╗ÿ KH├ôA Bß║«T BUß╗ÿC CHO TRß╗ó L├¥ AI (GEMINI) V├Ç Lß║¼P TR├îNH VI├èN:
 *       1. TR╞»ß╗ÜC KHI VIß║╛T H├ÇM HOß║╢C Gß╗îI API: Bß║«T BUß╗ÿC kiß╗âm tra T5_DICT.ACTIONS.
 *       2. Cß║ñM G├üN Cß╗¿NG (HARD-CODE) CON Sß╗É T├ÇI CH├ìNH / C╞»ß╗ÜC SHIP TRONG CODE.
 *       3. Mß╗îI H├ÇM T├ìNH TO├üN Bß║«T BUß╗ÿC ─Éß╗îC THAM Sß╗É Tß╗¬ SHEET [SYS_CONFIG].
 *       4. Mß╗îI PHß║óN Hß╗ÆI Lß╗ûI PHß║óI ─É╞»ß╗óC ─Éß╗èNH DANH QUA T5_DICT.ERROR_CODES.
 * =============================================================================
 */

(function(root, factory) {
    var exp = factory();
    if (typeof define === 'function' && define.amd) {
        define([], function() { return exp; });
    }
    if (typeof module === 'object' && module.exports) {
        module.exports = exp;
    }
    root.T5_DICT = exp;
    root.T5_SSOT = exp;
    root.Thim5Dictionary = exp;
    
    if (typeof window !== 'undefined') {
        window.T5_DICT = exp;
        window.T5_SSOT = exp;
        window.T5_MASTER = exp;
        window.Thim5Dictionary = exp;

        // BỘ NHỚ ĐỆM L1 CLIENT-SIDE CACHE (RAM + SESSION STORAGE - TTL 60 GIÂY)
        if (!window.__THIM5_L1_CACHE__) {
            window.__THIM5_L1_CACHE__ = {
                _ram: {},
                get: function(key) {
                    var item = this._ram[key];
                    if (!item) {
                        try {
                            var raw = sessionStorage.getItem('__THIM5_L1_' + key);
                            if (raw) item = JSON.parse(raw);
                        } catch(e) {}
                    }
                    if (item && item.time && (Date.now() - item.time < 60000)) {
                        return item.value;
                    }
                    return null;
                },
                set: function(key, val) {
                    var item = { value: val, time: Date.now() };
                    this._ram[key] = item;
                    try {
                        sessionStorage.setItem('__THIM5_L1_' + key, JSON.stringify(item));
                    } catch(e) {}
                },
                clear: function() {
                    this._ram = {};
                    try {
                        var keys = Object.keys(sessionStorage);
                        for (var i = 0; i < keys.length; i++) {
                            if (keys[i].indexOf('__THIM5_L1_') === 0) sessionStorage.removeItem(keys[i]);
                        }
                    } catch(e) {}
                }
            };
        }
    }
}(typeof self !== 'undefined' ? self : this, function() {

    'use strict';

    /**
     * 1. Hß║░NG Sß╗É C╞á Sß╗₧ & ─Éß╗èNH DANH Bß║╛P TRUNG T├éM (CHß╗ê D├ÖNG L├ÇM FALLBACK Cß║ñP Cß╗¿U)
     * To├án bß╗Ö gi├í trß╗ï thß╗▒c tß║┐ vß║¡n h├ánh ─æ╞░ß╗úc ─æiß╗üu khiß╗ân 100% qua Sheet [SYS_CONFIG]
     */
    var BASE_FALLBACK_CONFIG = Object.freeze({
        APP_VERSION: "3.5.20261005",
        BRAND_NAME: "M├¼ Trß╗Ön Th├¡m 5",
        HEAD_KITCHEN_LOCATION: {
            NAME: "Bß║┐p Trung T├óm H├▓a Th├ánh, T├óy Ninh",
            LAT: 11.285267,
            LNG: 106.133347,
            GPS_STRING: "11.285267,106.133347",
            STORE_NAV_URL: "https://www.google.com/maps/dir/?api=1&destination=11.285267,106.133347"
        },
        // Fallback Biß╗âu ph├¡ Ship D2C (Khi ch╞░a tß║úi ─æ╞░ß╗úc SYS_CONFIG)
        FALLBACK_CUSTOMER_RATE_PER_KM: 5000,  // Thu kh├ích: 3.000─æ/km (l├ám tr├▓n l├¬n)
        FALLBACK_DRIVER_RATE_PER_KM: 4500,    // Trß║ú t├ái xß║┐: 4.500─æ/km
        FALLBACK_MIN_CUSTOMER_FEE: 5000,      // Tß╗æi thiß╗âu thu kh├ích: 3.000─æ (< 1km t├¡nh 1km)
        FALLBACK_MIN_DRIVER_FEE: 5000,        // Tß╗æi thiß╗âu trß║ú t├ái xß║┐: 5.000─æ
        FALLBACK_ROUNDING_MODE: "CEIL_1KM",   // L├ám tr├▓n l├¬n 1km
        FALLBACK_AUTO_SUBSIDY: true,          // Bß║¡t trß╗ú gi├í qu├ín b├╣ ship
        FALLBACK_FREESHIP_THRESHOLD: 149000,  // Ng╞░ß╗íng ─æ╞ín Freeship
        FALLBACK_MAX_SUBSIDY: 20000,          // Trß║ºn b├╣ ship tß╗æi ─æa/─æ╞ín

        // Fallback C╞í cß║Ñu T├ái ch├¡nh D2C Reverse-Pricing
        FALLBACK_D2C_DISCOUNT_PERCENT: 10.0,  // Web D2C giß║úm 10% so vß╗¢i Gi├í App S├án
        FALLBACK_D2C_BUFFER_PERCENT: 15.0,    // Quß╗╣ ─æß╗çm D2C 15% (B├╣ ship + Qu├á + Thuß║┐)
        FALLBACK_TAX_RATE_HKD: 0.045,         // Thuß║┐ HKD 4.5%
        FALLBACK_MAX_PROMOTION_RATE: 0.15,    // Kh├│a trß║ºn khuyß║┐n m├úi tß╗æi ─æa 15% doanh thu gß╗Öp
        MAX_COD_HOLDING_PER_SHIPPER: 300000,  // Hß║ín mß╗⌐c ├┤m tiß╗ün mß║╖t COD tß╗æi ─æa cß╗ºa Shipper
        MIN_AOV_LUCKY_WHEEL: 79000            // Mß╗æc ─æ╞ín tß╗æi thiß╗âu k├¡ch hoß║ít v├▓ng quay may mß║»n
    });

    /**
     * 2. Tß╗¬ ─ÉIß╗éN T├èN Bß║óNG GOOGLE SHEETS CHUß║¿N H├ôA DUY NHß║ñT (DATABASE SHEETS SSOT)
     * Tuyß╗çt ─æß╗æi kh├┤ng d├╣ng t├¬n ph├ón mß║únh: [SYS_CONFIG], [ORDERS_D2C], DATA ORDER
     */
    var SHEETS = Object.freeze({
        CONFIG: "SYS_CONFIG",
        CATEGORIES: "SYS_CATEGORIES",
        ORDERS: "DATA_ORDERS",
        ORDER_ITEMS: "DATA_ORDER_ITEMS",
        MENU: "DATA_MENU",
        SHIPPERS: "DATA_SHIPPERS",
        SHIPPER_LEDGER: "DATA_SHIPPER_LEDGER",
        CRM_USERS: "DATA_CUSTOMERS",         // Thống nhất với rules.md: DATA_CUSTOMERS
        CUSTOMERS: "DATA_CUSTOMERS",         // Alias SSOT
        DATA_CUSTOMERS: "DATA_CUSTOMERS",    // Alias trực tiếp
        AUDIT_LOGS: "DATA_AUDIT_LOGS",
        WHEEL_VOUCHERS: "WHEEL_VOUCHERS",
        WHEEL_LOGS: "DATA_WHEEL_LOGS",       // Đồng bộ với Backend
        COMMUNITY_POSTS: "DATA_COMMUNITY_POSTS", // Phase 5: Bài đăng cộng đồng
        REVIEWS: "DATA_REVIEWS"              // Phase 5: Đánh giá xác thực
    });

    /**
     * 3. Bß╗ÿ CHß╗ê Sß╗É Cß╗ÿT CHUß║¿N H├ôA Bß║óNG DATA_ORDERS (16 Cß╗ÿT CHUß║¿N v3.0)
     */
    var ORDERS_SCHEMA = Object.freeze({
        COL_ORDER_ID: 0,          // Cột A: Mã Đơn (VD: DH260927_4974)
        COL_ORDER_CODE: 0,        // Alias tương thích Backend
        COL_TIMESTAMP: 1,         // Cột B: Thời Gian Tạo
        COL_TIME: 1,              // Alias tương thích Backend
        COL_OPS_STATUS: 2,        // Cột C: Trạng Thái Vận Hành
        COL_STATUS: 2,            // Alias tương thích Backend
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
        COL_PAY_METHOD: 12,       // Alias tương thích Backend
        COL_SHIPPER_INFO: 13,     // Cột N: Tài Xế Phụ Trách (Tên + SĐT)
        COL_GIFT_NAME: 14,        // Cột O: Món Quà May Mắn 0đ
        COL_NOTE: 15,             // Cột P: Ghi Chú Đơn & Vết Kiểm Toán Bếp
        COL_SERVICE_TYPE: 16      // Cột Q: Phân Hệ Dịch Vụ (FOOD_DELIVERY / RIDE_HAILING)
    });

    /**
     * 4. Bß╗ÿ CHß╗ê Sß╗É Cß╗ÿT CHUß║¿N H├ôA Bß║óNG DATA_MENU (13 Cß╗ÿT REVERSE-PRICING)
     */
    var MENU_SCHEMA = Object.freeze({
        COL_CODE: 0,              // Cß╗Öt A: M├ú SKU (VD: M01, C01, TOP_TRUNG)
        COL_NAME: 1,              // Cß╗Öt B: T├¬n M├│n ─én / Topping
        COL_CATEGORY: 2,          // Cß╗Öt C: Nh├│m Danh Mß╗Ñc ─Éa Ng├ánh
        COL_APP_PRICE: 3,         // Cß╗Öt D: Gi├í Ni├¬m Yß║┐t App Ngo├ái (+25%)
        COL_DISCOUNT_D2C: 4,      // Cß╗Öt E: % Giß║úm Gi├í K├¬nh Web D2C
        COL_D2C_PRICE: 5,         // Cß╗Öt F: Gi├í B├ín Web D2C Th├¡m 5
        COL_COGS: 6,              // Cß╗Öt G: Gi├í Vß╗æn Nguy├¬n Liß╗çu (Food Cost)
        COL_NET_PROFIT: 7,        // Cß╗Öt H: Lß╗úi Nhuß║¡n R├▓ng (LNR sau khi trß╗½ Quß╗╣ ─æß╗çm 15%)
        COL_STATUS: 8,            // Cß╗Öt I: Trß║íng Th├íi (ACTIVE | OUT_OF_STOCK | HIDDEN)
        COL_DESCRIPTION: 9,       // Cß╗Öt J: M├┤ Tß║ú H╞░╞íng Vß╗ï & Topping K├¿m
        COL_IMAGE_URL: 10,        // Cß╗Öt K: Link ß║ónh Google Drive Direct CDN
        COL_CROSS_SELL: 11,       // Cß╗Öt L: M├ú SKU M├│n B├ín K├¿m Gß╗úi ├¥
        COL_ROLE_TAG: 12          // Cß╗Öt M: Tag Chiß║┐n L╞░ß╗úc (CORE | COMBO | BOOSTER | TRAFFIC)
    });

    /**
     * 5. Bß╗ÿ CHß╗ê Sß╗É Cß╗ÿT CHUß║¿N H├ôA Bß║óNG SYS_CATEGORIES (5 Cß╗ÿT CHUß║¿N SSOT)
     */
    var CATEGORIES_SCHEMA = Object.freeze({
        COL_CODE: 0,              // Cß╗Öt A: M├ú Danh Mß╗Ñc (VD: CAT_COM, CAT_MI, CAT_TOPPING)
        COL_ICON: 1,              // Cß╗Öt B: Biß╗âu T╞░ß╗úng Icon / Emoji (VD: ≡ƒì¢, ≡ƒì£, ≡ƒÑñ)
        COL_NAME: 2,              // Cß╗Öt C: T├¬n Danh Mß╗Ñc Hiß╗ân Thß╗ï (VD: M├│n C╞ím ─Éß║Ñt Th├ính)
        COL_SLUG: 3,              // Cß╗Öt D: Slug K├¬nh D2C (VD: com, mi-tron, topping)
        COL_MAX_FC: 4             // Cß╗Öt E: Trß║ºn Food Cost Cho Ph├⌐p (%) (VD: 38, 20, 18)
    });

    /**
     * 5b. BỘ CHỈ SỐ CỘT CHUẨN HÓA BẢNG SYS_CONFIG (3 CỘT CHUẨN SSOT)
     */
    var CONFIG_SCHEMA = Object.freeze({
        COL_KEY: 0,               // Cột A: Tham Số Cấu Hình (Key)
        COL_VALUE: 1,             // Cột B: Giá Trị Cấu Hình (Value)
        COL_DESCRIPTION: 2        // Cột C: Mô Tả Nghiệp Vụ
    });

    /**
     * 5c. BỘ CHỈ SỐ CỘT CHUẨN HÓA BẢNG DATA_SHIPPERS (6 CỘT CHUẨN SSOT)
     */
    var SHIPPERS_SCHEMA = Object.freeze({
        COL_CODE: 0,              // Cột A: Mã Shipper
        COL_NAME: 1,              // Cột B: Tên Tài Xế
        COL_PHONE: 2,             // Cột C: Số Điện Thoại
        COL_PLATE: 3,             // Cột D: Biển Số Xe
        COL_STATUS: 4,            // Cột E: Trạng Thái (ACTIVE / LOCKED_DEBT)
        COL_MAX_HOLDING: 5        // Cột F: Hạn Mức Giữ COD Tối Đa (300.000đ)
    });

    /**
     * 5d. BỘ CHỈ SỐ CỘT CHUẨN HÓA BẢNG DATA_SHIPPER_LEDGER (10 CỘT CHUẨN SSOT)
     */
    var SHIPPER_LEDGER_SCHEMA = Object.freeze({
        COL_TX_ID: 0,             // Cột A: Mã Phiên Giao
        COL_TIME: 1,              // Cột B: Thời Gian
        COL_SHIPPER_CODE: 2,      // Cột C: Mã Tài Xế
        COL_SHIPPER_NAME: 3,      // Cột D: Tên Tài Xế
        COL_SHIPPER_PHONE: 4,     // Cột E: Số Điện Thoại
        COL_ORDER_CODE: 5,        // Cột F: Mã Đơn Hàng
        COL_SHIPPING_FEE: 6,      // Cột G: Tiền Cước Nhận (VND)
        COL_COD_AMOUNT: 7,        // Cột H: Tiền Mặt COD Thu Hộ (VND)
        COL_STATUS: 8,            // Cột I: Trạng Thái Đối Soát COD
        COL_NOTE: 9               // Cột J: Ghi Chú / Bằng Chứng Giao
    });

    /**
     * 5e. BỘ CHỈ SỐ CỘT CHUẨN HÓA BẢNG DATA_CUSTOMERS (14 CỘT CHUẨN SSOT)
     */
    var CUSTOMERS_SCHEMA = Object.freeze({
        COL_CODE: 0,              // Cột A: Mã Khách Hàng
        COL_PHONE: 1,             // Cột B: Số Điện Thoại
        COL_NAME: 2,              // Cột C: Họ Tên
        COL_MONTHLY_ORDERS: 3,    // Cột D: Đơn Tháng Này
        COL_CURRENT_MONTH: 4,     // Cột E: Tháng Hiện Tại (YYYY-MM)
        COL_TIER_TITLE: 5,        // Cột F: Danh Hiệu Tháng
        COL_TASTE_NAME: 6,        // Cột G: Gu Ăn Uống
        COL_FULL_BADGE: 7,        // Cột H: Huy Hiệu Gen Z
        COL_LAST_MONTH_HONOR: 8,  // Cột I: Danh Hiệu Tháng Trước
        COL_POINTS: 9,            // Cột J: Điểm Tích Lũy
        COL_TOTAL_SPEND: 10,      // Cột K: Tổng Chi Tiêu Trọn Đời
        COL_LIFETIME_ORDERS: 11,  // Cột L: Tổng Đơn Trọn Đời
        COL_WHEEL_SPINS: 12,      // Cột M: Lượt Quay Còn Lại
        COL_UPDATED_AT: 13        // Cột N: Ngày Cập Nhật
    });

    /**
     * 5f. BỘ CHỈ SỐ CỘT CHUẨN HÓA BẢNG DATA_REVIEWS (9 CỘT CHUẨN SSOT)
     */
    var REVIEWS_SCHEMA = Object.freeze({
        COL_REVIEW_ID: 0,         // Cột A: Mã Đánh Giá
        COL_ORDER_CODE: 1,        // Cột B: Mã Đơn Hàng
        COL_PHONE: 2,             // Cột C: SĐT Khách
        COL_NAME: 3,              // Cột D: Họ Tên
        COL_RATING: 4,            // Cột E: Số Sao (1-5)
        COL_COMMENT: 5,           // Cột F: Nội Dung Đánh Giá
        COL_DISH_NAME: 6,         // Cột G: Món Đánh Giá
        COL_TIME: 7,              // Cột H: Thời Gian
        COL_STATUS: 8             // Cột I: Trạng Thái (APPROVED)
    });

    /**
     * 5g. BỘ CHỈ SỐ CỘT CHUẨN HÓA BẢNG DATA_ORDER_ITEMS (10 CỘT CHUẨN SSOT)
     */
    var ORDER_ITEMS_SCHEMA = Object.freeze({
        COL_ORDER_CODE: 0,        // Cột A: Mã Đơn
        COL_DISH_ID: 1,           // Cột B: Mã Món
        COL_NAME: 2,              // Cột C: Tên Món Ăn
        COL_PRICE: 3,             // Cột D: Đơn Giá
        COL_QTY: 4,               // Cột E: Số Lượng
        COL_TOTAL: 5,             // Cột F: Thành Tiền
        COL_TASTE: 6,             // Cột G: Khẩu Vị
        COL_SOUP: 7,              // Cột H: Chén Súp
        COL_TOPPINGS: 8,          // Cột I: Topping Thêm
        COL_NOTE: 9               // Cột J: Ghi Chú Món
    });

    /**
     * 5h. BỘ HẰNG SỐ TRẠNG THÁI ĐƠN HÀNG CHUẨN HÓA (ORDER_STATUS SSOT)
     */
    var ORDER_STATUS = Object.freeze({
        PENDING: "PENDING",               // Chờ xác minh COD / Đơn mới
        PREPARING: "PREPARING",           // Bếp đang chế biến món
        READY_TO_SHIP: "READY_TO_SHIP",   // Món đã đóng gói xong, chờ tài xế lấy
        SHIPPING: "SHIPPING",             // Tài xế nội bộ đang giao tận tay
        DISPATCHED_3PL: "DISPATCHED_3PL", // Đã điều phối sang đối tác công nghệ 3PL (Grab/Vill/Xanh SM)
        COMPLETED: "COMPLETED",           // Khách đã nhận món, thu đủ tiền, hoàn tất đơn
        CANCELLED: "CANCELLED",           // Đơn bị hủy
        // Backward compatibility aliases:
        RECEIVED: "PENDING",
        NEW: "PENDING",
        WAIT_VERIFY: "PENDING",
        COOKING: "PREPARING",
        PACKED: "READY_TO_SHIP",
        READY: "READY_TO_SHIP",
        DELIVERING: "SHIPPING",
        DELIVERED: "COMPLETED"
    });

    /**
     * 6. MA TRß║¼N TRß║áNG TH├üI Vß║¼N H├ÇNH & B╞»ß╗ÜC TIß║╛N TR├îNH CHUß║¿N (STATE MACHINE SSOT)
     */
    var STEPS = Object.freeze({
        WAIT_VERIFY: 0,      // Đơn mới, chờ khách/shipper/bếp chốt đơn COD
        PENDING: 0,          // Alias chuẩn v3.5
        COOKING: 2,          // Bếp đang chế biến nóng giòn
        PREPARING: 2,        // Alias chuẩn v3.5
        PACKED: 2.5,         // Món đã nấu xong, đóng hộp giữ nhiệt chờ tài xế
        READY_TO_SHIP: 2.5,  // Alias chuẩn v3.5
        SHIPPING: 3,         // Tài xế đang trên đường giao hàng
        DISPATCHED_3PL: 3,   // Giao qua đối tác 3PL sàn ngoài
        DELIVERING: 3,       // Alias
        COMPLETED: 4,        // Khách nhận món, thu đủ tiền, đơn hoàn tất
        CANCELLED: -1        // Đơn bị hủy (khách báo hủy, hết nguyên liệu, sự cố)
    });

    var STATUS_MAP = Object.freeze({
        PENDING: { 
            step: STEPS.PENDING, 
            label: "Chờ Xác Minh COD", 
            badgeClass: "bg-amber-500/20 text-amber-300 border-amber-500/30",
            icon: "fa-receipt",
            eta: "25 - 35 Phút"
        },
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
        PREPARING: { 
            step: STEPS.PREPARING, 
            label: "Bếp Đang Nấu", 
            badgeClass: "bg-orange-500/20 text-orange-400 border-orange-500/40",
            icon: "fa-fire-burner",
            eta: "20 - 30 Phút"
        },
        COOKING: { 
            step: STEPS.COOKING, 
            label: "Bếp Đang Nấu", 
            badgeClass: "bg-orange-500/20 text-orange-400 border-orange-500/40",
            icon: "fa-fire-burner",
            eta: "20 - 30 Phút"
        },
        READY_TO_SHIP: { 
            step: STEPS.READY_TO_SHIP, 
            label: "Đã Nấu Xong • Chờ Ship", 
            badgeClass: "bg-sky-500/20 text-sky-300 border-sky-500/30",
            icon: "fa-box-open",
            eta: "15 - 20 Phút"
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
        DISPATCHED_3PL: {
            step: STEPS.DISPATCHED_3PL,
            label: "Điều Phối Đối Tác 3PL",
            badgeClass: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
            icon: "fa-truck-fast",
            eta: "15 - 25 Phút"
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
     * 7. Hß╗óP ─Éß╗ÆNG H├ÇNH ─Éß╗ÿNG API Tß╗öNG TO├ÇN Hß╗å THß╗ÉNG (ROUTER ACTIONS CONTRACT)
     * Tu├ón thß╗º quy tß║»c 5 ─æß╗Öng tß╗½ th├⌐p: get..., save..., delete..., toggle..., process...
     */
    var ACTIONS = {
        // Hợp Đồng Hệ Thống & Kiểm Tra Sức Khỏe
        GET_SYSTEM_CONTRACT: "getSystemContract",
        PING: "ping",
        HEALTH_CHECK: "healthCheck",

        // Quản trị Thực đơn & Danh mục Đa Ngành
        GET_ADMIN_MENU_CATALOG: "getAdminMenuCatalog",
        GET_ADMIN_MENU: "getAdminMenuCatalog",
        SAVE_OR_UPDATE_MENU_ITEM: "saveOrUpdateMenuItem",
        SAVE_MENU_ITEM: "saveOrUpdateMenuItem",
        TOGGLE_MENU_ITEM_STATUS: "toggleMenuItemStatus",
        TOGGLE_MENU_ITEM: "toggleMenuItemStatus",
        DELETE_MENU_ITEM: "deleteMenuItem",
        GET_MENU_CATEGORIES: "getMenuCategories",
        SAVE_MENU_CATEGORY: "saveMenuCategory",
        DELETE_MENU_CATEGORY: "deleteMenuCategory",

        // Omni-Ingestion Pipeline & Media Direct Drive CDN
        BATCH_IMPORT_MENU_ITEMS: "batchImportMenuItems",
        BATCH_IMPORT_MENU: "batchImportMenuItems",
        PARSE_UPLOADED_SPREADSHEET_BUFFER: "parseUploadedSpreadsheetBuffer",
        PARSE_SPREADSHEET_BUFFER: "parseUploadedSpreadsheetBuffer",
        PROCESS_MENU_OCR_WITH_GEMINI: "processMenuOcrWithGemini",
        PROCESS_OCR_GEMINI: "processMenuOcrWithGemini",
        EXTRACT_MENU_FROM_PUBLIC_URL: "extractMenuFromPublicUrl",
        EXTRACT_MENU_URL: "extractMenuFromPublicUrl",
        UPLOAD_DISH_MEDIA_IMAGE: "uploadDishMediaImage",
        UPLOAD_MENU_IMAGE: "uploadDishMediaImage",
        UPLOAD_IMAGE_TO_MENU_DRIVE_FOLDER: "uploadDishMediaImage",
        GET_MENU_EXCEL_TEMPLATE: "getMenuExcelTemplateStructure",
        GET_MENU_TEMPLATE: "getMenuExcelTemplateStructure",

        // Bán Hàng Storefront D2C & Tra Cứu Khách Hàng
        GET_CONFIG: "getConfig",
        CREATE_D2C_ORDER: "createD2COrder",
        GET_ORDER_TRACKING: "getOrderTracking",
        TOGGLE_STORE_STATUS: "toggleStoreOperationalStatus",
        TOGGLE_STORE_OPERATIONAL_STATUS: "toggleStoreOperationalStatus",
        GET_STORE_STATUS: "getStoreOperationalStatus",
        GET_STORE_OPERATIONAL_STATUS: "getStoreOperationalStatus",

        // Cấu hình Hệ Thống & Cước Phí Ship Động (Zero-Hardcode)
        GET_SYSTEM_DYNAMIC_CONFIG: "getSystemDynamicConfig",
        GET_SYSTEM_CONFIG: "getSystemDynamicConfig",
        SAVE_SYSTEM_DYNAMIC_CONFIG: "saveSystemDynamicConfig",
        SAVE_SYSTEM_CONFIG: "saveSystemDynamicConfig",
        CALCULATE_DYNAMIC_SHIPPING_FEE: "calculateDynamicShippingFee",

        // Trạm Bếp KDS & Bàn Giao Món
        GET_KITCHEN_KDS_ORDERS: "getKitchenKdsOrders",
        GET_KITCHEN_ORDERS: "getKitchenKdsOrders",
        KITCHEN_UPDATE_STATUS: "kitchenUpdateStatus",
        KITCHEN_ASSIGN_SHIPPER: "kitchenAssignShipper",
        KITCHEN_SETTLE_HANDOVER: "kitchenSettleHandover",
        VERIFY_AND_ASSIGN_COOK_ORDER: "verifyAndAssignCookOrder",

        // Trạm Điều Phối Shipper (Hybrid Fleet)
        GET_SHIPPER_ORDERS: "getShipperOrders",
        SHIPPER_VERIFY_COD_SUCCESS: "shipperVerifyCodOrderSuccess",
        SHIPPER_VERIFY_COD: "shipperVerifyCodOrderSuccess",
        SHIPPER_UPDATE_STEP: "shipperUpdateStep",
        SHIPPER_RELEASE_ORDER: "shipperReleaseOrder",
        GET_ACTIVE_SHIPPERS_LIST: "getActiveShippersList",
        GET_ACTIVE_SHIPPERS: "getActiveShippersList",
        SAVE_OR_UPDATE_SHIPPER: "saveOrUpdateShipper",
        SAVE_SHIPPER: "saveOrUpdateShipper",
        TOGGLE_SHIPPER_STATUS: "toggleShipperStatus",
        TOGGLE_SHIPPER: "toggleShipperStatus",
        DELETE_SHIPPER: "deleteShipper",
        SETTLE_SHIPPER_DEBT: "settleShipperDebt",
        COMPLETE_ORDER_DELIVERY: "completeOrderDelivery",
        SHIPPER_UPDATE_ORDER_STATUS: "shipperUpdateOrderStatus",

        // Quản Lý Đơn Hàng & Tài Chính Admin Shell
        GET_ORDERS_LIST: "getOrdersList",
        ASSIGN_SHIPPER: "assignShipper",
        CONFIRM_KITCHEN_HANDOVER: "confirmKitchenHandover",
        COMPLETE_ORDER: "completeOrder",
        MANUAL_APPROVE_PAYMENT: "manualApprovePayment",
        GET_FINANCIAL_PL_SUMMARY: "getFinancialPlSummary",
        GET_FINANCIAL_PL: "getFinancialPlSummary",
        GET_SHIPPER_COD_LEDGER: "getShipperCodHoldingLedger",
        GET_SHIPPER_LEDGER: "getShipperCodHoldingLedger",
        GET_FINANCIAL_AUDIT_LOGS: "getFinancialAuditLogs",
        GET_AUDIT_LOGS: "getFinancialAuditLogs",

        // Bảo Mật, RBAC & Google Authenticator 2FA
        VERIFY_ADMIN_ROLE: "verifyAdminRole",
        VERIFY_SUPER_ADMIN_TOTP: "verifySuperAdminTotp",
        GET_TOTP_SETUP_QR_DATA: "getTotpSetupQrData",
        GET_TOTP_SETUP_QR: "getTotpSetupQrData",
        SEND_EMERGENCY_OTP_TO_EMAIL: "sendEmergencyBackupOtpToEmail",
        SEND_EMERGENCY_OTP: "sendEmergencyBackupOtpToEmail",

        // Mini CRM Khách Hàng & Vòng Quay May Mắn (Gamification)
        GET_CUSTOMER_PROFILE: "getCustomerProfile",
        LOOKUP_CUSTOMER_PROFILE: "lookupCustomerProfile",
        GET_PUBLIC_WHEEL_CONFIG: "getPublicWheelConfig",
        SPIN_LUCKY_WHEEL: "spinLuckyWheel",
        UPDATE_WHEEL_CONFIG: "updateWheelConfig",
        REDEEM_GIFT_TOKEN: "redeemGiftToken",
        LOG_WHEEL_REWARD: "logWheelRewardTransaction",

        // Phase 5: Cổng Cộng Đồng anngonlonghoa.com.vn & Đánh Giá Xác Thực
        SUBMIT_COMMUNITY_POST: "submitCommunityPost",
        APPROVE_COMMUNITY_POST: "approveCommunityPost",
        GET_COMMUNITY_FEED: "getCommunityFeed",
        SUBMIT_VERIFIED_REVIEW: "submitVerifiedReview",
        GET_VERIFIED_REVIEWS: "getVerifiedReviews"
    };

    /**
     * 8. Bß║óNG M├â Lß╗ûI ─Éß╗èNH DANH Bß║«T BUß╗ÿC TO├ÇN Hß╗å THß╗ÉNG (ERROR_CODES SSOT)
     * Triß╗çt ti├¬u ho├án to├án th├│i quen ─æo├ín m├▓ lß╗ùi giß╗»a Frontend v├á Backend.
     */
    var ERROR_CODES = Object.freeze({
        ERR_ROUTER_ACTION_NOT_FOUND: "ERR_ROUTER_ACTION_NOT_FOUND", // Router ch╞░a khai b├ío action
        ERR_SHEET_NOT_FOUND: "ERR_SHEET_NOT_FOUND",                 // Bß║úng t├¡nh Google Sheet kh├┤ng tß╗ôn tß║íi
        ERR_SCHEMA_MISMATCH: "ERR_SCHEMA_MISMATCH",                 // Dß╗» liß╗çu trß║ú vß╗ü thiß║┐u tr╞░ß╗¥ng hoß║╖c sai cß╗Öt
        ERR_EMPTY_CATEGORIES: "ERR_EMPTY_CATEGORIES",               // Danh mß╗Ñc SYS_CATEGORIES bß╗ï rß╗ùng
        ERR_UNAUTHORIZED: "ERR_UNAUTHORIZED",                       // Quyß╗ün PIN / Token kh├┤ng hß╗úp lß╗ç
        ERR_INVALID_PAYLOAD: "ERR_INVALID_PAYLOAD",                 // Tham sß╗æ truyß╗ün v├áo h├ám bß╗ï sai kiß╗âu
        ERR_NETWORK_GAS: "ERR_NETWORK_GAS",                         // Mß║Ñt kß║┐t nß╗æi tß╗¢i Google Apps Script
        ERR_EXECUTION_TIMEOUT: "ERR_EXECUTION_TIMEOUT"              // Qu├í thß╗¥i gian thß╗▒c thi cß╗ºa Apps Script
    });
    /* ==========================================================================
   FILE: thim5-master-dictionary.js - PHß║ªN [2/2]
   Bß║«T ─Éß║ªU Tß╗¬: Cß╗Ñm h├ám tß╗▒ kiß╗âm to├ín Telemetry chß╗æng ─æo├ín m├▓ (auditApiResponse)
   Kß║╛T TH├ÜC Tß║áI: ─É├│ng trß╗ìn vß║╣n Module Factory (})); ho├án tß║Ñt file
   H╞»ß╗ÜNG Dß║¬N: Copy nß╗æi tiß║┐p ngay sau Phß║ºn [1/2] cß╗ºa file thim5-master-dictionary.js
   ========================================================================== */

    /**
     * 9. Bß╗ÿ Tß╗░ KIß╗éM TO├üN T├ìNH TO├ÇN Vß║╕N GIAO TIß║╛P & Bß║«T Lß╗ûI Tß║¼N Gß╗ÉC (ANTI-GUESSING TELEMETRY)
     * Gi├║p Frontend v├á Backend tß╗▒ chß║⌐n ─æo├ín lß╗ùi ch├¡nh x├íc 100%, triß╗çt ti├¬u ─æo├ín m├▓.
     */
    function auditApiResponse(actionName, response) {
        if (!response) {
            console.error(
                "%c≡ƒÜ¿ [T5-TELEMETRY-FATAL] Phß║ún hß╗ôi rß╗ùng ho├án to├án tß╗½ Action: " + actionName,
                "background: #4c0519; color: #fecdd3; font-weight: bold; padding: 4px 8px; border-radius: 4px;"
            );
            return { valid: false, code: ERROR_CODES.ERR_NETWORK_GAS, message: "Kh├┤ng nhß║¡n ─æ╞░ß╗úc phß║ún hß╗ôi tß╗½ m├íy chß╗º!" };
        }

        if (response.status !== "success") {
            var errCode = response.code || ERROR_CODES.ERR_ROUTER_ACTION_NOT_FOUND;
            console.error(
                "%c≡ƒÜ¿ [T5-BACKEND-ERROR] " + errCode + " | Action: " + actionName,
                "background: #881337; color: #fda4af; font-weight: bold; padding: 4px 8px; border-radius: 4px;",
                response.message || response
            );
            return { valid: false, code: errCode, message: response.message || "M├íy chß╗º phß║ún hß╗ôi thß║Ñt bß║íi" };
        }

        // Kiß╗âm to├ín hß╗úp ─æß╗ông dß╗» liß╗çu cho Action Bundled Catalog
        if (actionName === ACTIONS.GET_ADMIN_MENU_CATALOG) {
            var data = response.data || {};
            var items = data.items || (Array.isArray(data) ? data : []);
            var categories = data.categories || [];

            if (!Array.isArray(items)) {
                console.warn("ΓÜá∩╕Å [T5-SCHEMA-WARNING] Kh├│a 'items' kh├┤ng phß║úi ─æß╗ïnh dß║íng mß║úng!");
            }

            if (!Array.isArray(categories) || categories.length === 0) {
                console.error(
                    "%c≡ƒÜ¿ [T5-SCHEMA-MISMATCH] Thiß║┐u danh mß╗Ñc trong g├│i dß╗» liß╗çu! Sheet SYS_CATEGORIES c├│ thß╗â ─æang rß╗ùng hoß║╖c ch╞░a ─æ╞░ß╗úc nß║íp.",
                    "background: #7c2d12; color: #fdba74; font-weight: bold; padding: 4px 8px; border-radius: 4px;"
                );
                return { valid: false, code: ERROR_CODES.ERR_EMPTY_CATEGORIES, message: "Danh mß╗Ñc thß╗▒c ─æ╞ín ch╞░a ─æ╞░ß╗úc cß║Ñu h├¼nh!" };
            }
        }

        return { valid: true, code: "OK", data: response.data };
    }

    function validateActionPayload(actionName, payload) {
        if (!payload || typeof payload !== 'object') {
            return { valid: false, code: ERROR_CODES.ERR_INVALID_PAYLOAD, message: "Payload truyß╗ün v├áo phß║úi l├á mß╗Öt ─æß╗æi t╞░ß╗úng hß╗úp lß╗ç!" };
        }
        if (actionName === ACTIONS.SAVE_OR_UPDATE_MENU_ITEM) {
            if (!payload.code && !payload.name) {
                return { valid: false, code: ERROR_CODES.ERR_INVALID_PAYLOAD, message: "M├│n ─ân bß║»t buß╗Öc phß║úi c├│ M├ú SKU v├á T├¬n m├│n!" };
            }
        }
        if (actionName === ACTIONS.SAVE_MENU_CATEGORY) {
            var cat = payload.category || payload;
            if (!cat.name || (!cat.code && !cat.slug)) {
                return { valid: false, code: ERROR_CODES.ERR_INVALID_PAYLOAD, message: "Danh mß╗Ñc bß║»t buß╗Öc phß║úi c├│ T├¬n hiß╗ân thß╗ï v├á M├ú/Slug!" };
            }
        }
        return { valid: true };
    }

    /**
     * C╞á CHß║╛ Tß╗░ ─Éß╗ÿNG ─É─éNG K├¥ H├ÇNH ─Éß╗ÿNG Mß╗ÜI (DYNAMIC EXTENSION CONTRACT)
     * Gi├║p AI hoß║╖c Module con ─æ─âng k├╜ th├¬m Action API mß╗¢i m├á kh├┤ng l├ám vß╗í SSOT.
     * @param {string} keyName - T├¬n kh├│a UPPER_SNAKE_CASE (VD: "EXPORT_EXCEL_REPORT")
     * @param {string} actionString - T├¬n Action camelCase (VD: "exportExcelReport")
     */
    function registerAction(keyName, actionString) {
        if (!keyName || !actionString) return;
        var cleanKey = String(keyName).trim().toUpperCase();
        var cleanAction = String(actionString).trim();
        ACTIONS[cleanKey] = cleanAction;
    }

    /**
     * 10. Tß╗¬ ─ÉIß╗éN KH├ôA Cß║ñU H├îNH TR├èN SHEET [SYS_CONFIG] (CONFIG_KEYS SSOT)
     * Kh├│a cß╗⌐ng t├¬n Key tr├¬n Google Sheets ─æß╗â loß║íi bß╗Å ho├án to├án viß╗çc g├ín cß╗⌐ng sß╗æ trong code.
     */
    var CONFIG_KEYS = Object.freeze({
        // Nhß║¡n diß╗çn qu├ín
        STORE_NAME: "STORE_NAME",
        STORE_SLOGAN: "STORE_SLOGAN",
        STORE_HOTLINE: "STORE_HOTLINE",
        STORE_ADDRESS: "STORE_ADDRESS",
        STORE_ICON: "STORE_ICON",
        STORE_LATITUDE: "STORE_LATITUDE",
        STORE_LONGITUDE: "STORE_LONGITUDE",
        STORE_STATUS: "STORE_STATUS",
        STORE_CLOSED_MESSAGE: "STORE_CLOSED_MESSAGE",

        // Biß╗âu ph├¡ Ship D2C Linh hoß║ít
        SHIPPING_RATE_CUSTOMER_PER_KM: "SHIPPING_RATE_CUSTOMER_PER_KM", // Gi├í thu kh├ích mß╗ùi km
        SHIPPING_RATE_DRIVER_PER_KM: "SHIPPING_RATE_DRIVER_PER_KM",     // Gi├í trß║ú t├ái xß║┐ mß╗ùi km
        SHIPPING_MIN_CUSTOMER_FEE: "SHIPPING_MIN_CUSTOMER_FEE",         // C╞░ß╗¢c tß╗æi thiß╗âu thu kh├ích
        SHIPPING_MIN_DRIVER_FEE: "SHIPPING_MIN_DRIVER_FEE",             // C╞░ß╗¢c tß╗æi thiß╗âu trß║ú t├ái xß║┐
        SHIPPING_AUTO_SUBSIDY: "SHIPPING_AUTO_SUBSIDY",                 // Qu├ín b├╣ ship tß╗▒ ─æß╗Öng
        SHIPPING_ROUNDING_MODE: "SHIPPING_ROUNDING_MODE",               // CEIL_1KM hoß║╖c EXACT
        FREESHIP_MIN_SUBTOTAL: "FREESHIP_MIN_SUBTOTAL",                 // Ng╞░ß╗íng ─æ╞ín Freeship
        MAX_SHIPPING_SUBSIDY: "MAX_SHIPPING_SUBSIDY",                   // Trß║ºn b├╣ ship tß╗æi ─æa/─æ╞ín

        // C╞í cß║Ñu t├ái ch├¡nh & Quß╗╣ ─æß╗çm D2C
        D2C_DISCOUNT_PERCENT: "D2C_DISCOUNT_PERCENT",                   // % Giß║úm gi├í D2C Web so vß╗¢i S├án
        D2C_BUFFER_PERCENT: "D2C_BUFFER_PERCENT",                       // % Quß╗╣ ─æß╗çm D2C (B├╣ ship + V├▓ng quay + Thuß║┐)
        PLATFORM_MASTER_FEE: "PLATFORM_MASTER_FEE",                     // Ph├¡ nß╗ün tß║úng SaaS
        TAX_RATE_HKD: "TAX_RATE_HKD",                                   // Thuß║┐ kho├ín HKD 4.5%
        MAX_PROMOTION_RATE: "MAX_PROMOTION_RATE",                       // Trß║ºn khuyß║┐n m├úi tß╗æi ─æa 15%

        // Thanh to├ín ng├ón h├áng & MoMo
        BANK_BIN: "BANK_BIN",
        BANK_CODE: "BANK_CODE",
        BANK_ACCOUNT_NO: "BANK_ACCOUNT_NO",
        BANK_ACCOUNT_NAME: "BANK_ACCOUNT_NAME",
        MOMO_PHONE: "MOMO_PHONE",
        MOMO_NAME: "MOMO_NAME",

        // ─Éß╗Öi xe & Hß║ín mß╗⌐c
        MAX_COD_HOLDING_PER_SHIPPER: "MAX_COD_HOLDING_PER_SHIPPER",     // Trß║ºn nß╗ú COD t├ái xß║┐
        DRIVER_BONUS_PER_ORDER: "DRIVER_BONUS_PER_ORDER",               // Th╞░ß╗ƒng n├│ng t├ái xß║┐

        // Bß║úo mß║¡t
        MASTER_SUPER_KEY: "MASTER_SUPER_KEY",
        SUPER_ADMIN_EMAIL: "SUPER_ADMIN_EMAIL",
        PIN_ADMIN_LV1: "PIN_ADMIN_LV1",
        PIN_ADMIN_LV2: "PIN_ADMIN_LV2"
    });

    /**
     * 11. DANH S├üCH SHIPPER Nß╗ÿI Bß╗ÿ Mß║╢C ─Éß╗èNH (PRESET SHIPPERS)
     */
        /**
     * 10b. MA TRẬN PHÂN QUYỀN VAI TRÒ HỆ THỐNG (ROLES MATRIX SSOT)
     */
    var ROLES = Object.freeze({
        SUPER_ADMIN_LV3: "SUPER_ADMIN_LV3", // Super Master anh Hải Âu (2FA TOTP)
        TENANT_ADMIN: "TENANT_ADMIN",       // Chủ quán F&B (Quản trị thực đơn, xem P&L, đăng bài)
        POS_LV2: "POS_LV2",                 // Thu ngân (PIN 2026 - Tạo đơn, điều phối ship, thu COD)
        KITCHEN_LV1: "KITCHEN_LV1",         // Bếp KDS (PIN 1985 - Xem đơn nấu, bật/tắt món)
        SHIPPER: "SHIPPER"                  // Tài xế giao hàng
    });

    var SHIPPER_PRESETS = Object.freeze({
        "0585": { id: "SHIP_01", name: "Nguyß╗àn Hß║úi ├éu", phone: "0934.220.585", rawPhone: "0934220585" },
        "4693": { id: "SHIP_02", name: "Nguyß╗àn Hß║úi ├éu", phone: "0969.004.693", rawPhone: "0969004693" },
        "2862": { id: "SHIP_03", name: "Trß║ºn Minh Nam", phone: "0968.222.862", rawPhone: "0968222862" }
    });

    /**
     * 12. H├ÇM CHUß║¿N H├ôA THß╗░C THß╗é ─É╞áN H├ÇNG TO├ÇN N─éNG (UNIVERSAL ORDER NORMALIZER)
     * Nhß║¡n v├áo bß║Ñt kß╗│ ─æß╗æi t╞░ß╗úng th├┤ n├áo tß╗½ Google Sheets / KDS / Shipper / Admin / Web D2C.
     * Trß║ú vß╗ü ─æß╗æi t╞░ß╗úng ─æß╗ông nhß║Ñt 100% thuß╗Öc t├¡nh an to├án, triß╗çt ti├¬u ho├án to├án lß╗ùi undefined.
     * @param {Object} raw - Dß╗» liß╗çu ─æ╞ín h├áng th├┤
     * @returns {Object} Thß╗▒c thß╗â ─æ╞ín h├áng chuß║⌐n h├│a SSOT
     */
    function normalizeOrderEntity(raw) {
        if (!raw || typeof raw !== 'object') {
            raw = {};
        }

        // 1. M├ú ─æ╞ín h├áng chuß║⌐n h├│a
        var orderId = String(raw.orderId || raw.orderCode || raw.code || raw.id || "DH_TEMP").trim();

        // 2. Chuß║⌐n h├│a Kh├ích h├áng & ─Éß╗ïa chß╗ë
        var custName = String(raw.name || raw.customerName || "").trim();
        var custPhone = String(raw.phone || raw.customerPhone || "").trim();
        var custAddr = String(raw.address || raw.customerAddress || "H├▓a Th├ánh, T├óy Ninh").trim();

        if ((!custName || !custPhone) && raw.customerInfo) {
            var parts = String(raw.customerInfo).split("|").map(function(s) { return s.trim(); });
            if (!custName && parts[0]) custName = parts[0];
            if (!custPhone && parts[1]) custPhone = parts[1];
            if ((!custAddr || custAddr === "H├▓a Th├ánh, T├óy Ninh") && parts[2]) custAddr = parts[2];
        }

        if (raw.customer && typeof raw.customer === 'object') {
            if (!custName && raw.customer.name) custName = String(raw.customer.name).trim();
            if (!custPhone && raw.customer.phone) custPhone = String(raw.customer.phone).trim();
            if ((!custAddr || custAddr === "H├▓a Th├ánh, T├óy Ninh") && raw.customer.address) {
                custAddr = String(raw.customer.address).trim();
            }
        }

        // 3. Chuß║⌐n h├│a Trß║íng th├íi Vß║¡n h├ánh & B╞░ß╗¢c (State Machine SSOT)
        var rawStatus = String(raw.status || raw.operationalStatus || raw.opsStatus || "RECEIVED").trim().toUpperCase();
        var stepVal = 0;

                if (raw.step !== undefined && raw.step !== null) {
            stepVal = Number(raw.step);
        } else if (rawStatus === "CANCELLED" || rawStatus === "ĐÃ HỦY" || rawStatus === "HUY") {
            stepVal = STEPS.CANCELLED;
        } else if (rawStatus === "COMPLETED" || rawStatus === "HOÀN TẤT" || rawStatus === "DELIVERED") {
            stepVal = STEPS.COMPLETED;
        } else if (rawStatus === "DISPATCHED_3PL" || rawStatus === "ĐIỀU PHỐI 3PL") {
            stepVal = STEPS.DISPATCHED_3PL;
        } else if (rawStatus === "DELIVERING" || rawStatus === "ĐANG GIAO" || rawStatus === "SHIPPING") {
            stepVal = STEPS.SHIPPING;
        } else if (rawStatus === "PACKED" || rawStatus === "READY" || rawStatus === "READY_TO_SHIP" || rawStatus === "ĐÓNG GÓI") {
            stepVal = STEPS.PACKED;
        } else if (rawStatus === "COOKING" || rawStatus === "PREPARING" || rawStatus === "ĐANG NẤU") {
            stepVal = STEPS.COOKING;
        } else {
            stepVal = STEPS.WAIT_VERIFY;
        }

        var canonicalStatus = "PENDING";
        if (stepVal === STEPS.CANCELLED) canonicalStatus = "CANCELLED";
        else if (stepVal === STEPS.COMPLETED) canonicalStatus = "COMPLETED";
        else if (rawStatus === "DISPATCHED_3PL" || (stepVal === STEPS.DISPATCHED_3PL && raw.deliveryChannel === "EXTERNAL")) canonicalStatus = "DISPATCHED_3PL";
        else if (stepVal === STEPS.SHIPPING) canonicalStatus = "SHIPPING";
        else if (stepVal === STEPS.PACKED) canonicalStatus = "READY_TO_SHIP";
        else if (stepVal === STEPS.COOKING) canonicalStatus = "PREPARING";
        else canonicalStatus = "PENDING";

        var statusMeta = STATUS_MAP[canonicalStatus] || STATUS_MAP.PENDING || STATUS_MAP.RECEIVED;

        // 4. Chuß║⌐n h├│a Ph╞░╞íng thß╗⌐c & Trß║íng th├íi Thanh to├ín
        var rawMethod = String(raw.paymentMethod || raw.method || raw.payMethod || "COD").trim().toUpperCase();
        var isOnlinePaid = (rawMethod === "CK_VIETQR" || rawMethod === "VIETQR" || rawMethod === "BANK" || rawMethod === "MOMO");
        var paymentMethod = isOnlinePaid ? "VIETQR" : "COD";
        var paymentStatus = String(raw.paymentStatus || (isOnlinePaid ? "PAID_VIETQR" : "UNPAID")).trim().toUpperCase();

        // 5. Chuß║⌐n h├│a T├ái ch├¡nh & D├▓ng tiß╗ün
        var subtotal = Number(raw.subtotal || raw.itemsTotal || 0);
        var baseShipFee = Number(raw.shippingFee || raw.shipFee || raw.baseShipFee || BASE_FALLBACK_CONFIG.FALLBACK_MIN_CUSTOMER_FEE);
        var shippingSubsidy = Number(raw.shippingSubsidy || raw.subsidizedShipFee || raw.subsidy || 0);
        var customerShipFee = Math.max(0, baseShipFee - shippingSubsidy);

        var finalTotal = Number(raw.finalTotal || raw.totalAmount || raw.total || (subtotal + customerShipFee));
        var collectFromCustomer = isOnlinePaid ? 0 : finalTotal;

        var externalShipFee = Number(raw.externalShipFee || 0);
        var actualSubsidySpent = externalShipFee > 0 ? Math.max(0, externalShipFee - customerShipFee) : shippingSubsidy;

        // 6. Chuß║⌐n h├│a K├¬nh & Th├┤ng tin Shipper
        var rawShipperInfo = String(raw.shipperInfo || raw.shipper || raw.assignedShipper || "").trim();
        var deliveryChannel = String(raw.deliveryChannel || raw.shipperType || (rawShipperInfo.indexOf("GRAB") !== -1 || rawShipperInfo.indexOf("VILL") !== -1 ? "EXTERNAL" : "INTERNAL")).trim().toUpperCase();
        var trackingCode = String(raw.trackingCode || raw.externalTrackingCode || "").trim();

        // 7. Chuß║⌐n h├│a Danh s├ích M├│n ─ân
        var itemsList = [];
        var itemsFormattedText = "";

        if (Array.isArray(raw.items)) {
            itemsList = raw.items.map(function(it) {
                var itQty = Number(it.quantity || it.qty || 1);
                var itPrice = Number(it.price || it.d2cPrice || 0);
                var itName = String(it.name || it.itemName || "M├│n ─ân").trim();
                var itTaste = String(it.taste || raw.taste || "Cay Nhß║╣").trim();
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
                if (sub.length > 0) desc += " (" + sub.join(" ΓÇó ") + ")";
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
                    taste: String(raw.taste || "Cay Nhß║╣"),
                    soup: "",
                    toppingSummary: "",
                    isGift: false
                };
            });
        }

        // Qu├á tß║╖ng 0─æ may mß║»n tß╗½ V├▓ng quay
        var giftReward = null;
        if (raw.gift && raw.gift.name) {
            giftReward = {
                name: String(raw.gift.name).replace("≡ƒÄü ", "").trim(),
                giftToken: String(raw.gift.giftToken || "VERIFIED").trim()
            };
        } else if (raw.giftName) {
            giftReward = {
                name: String(raw.giftName).replace("≡ƒÄü ", "").trim(),
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
                name: custName || "Kh├ích V├úng Lai",
                phone: custPhone || "N/A",
                address: custAddr || "H├▓a Th├ánh, T├óy Ninh",
                taste: String(raw.taste || "Cay Nhß║╣ (Chuß║⌐n vß╗ï Th├¡m 5)").trim(),
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
            itemsFormattedText: itemsFormattedText || "M├│n ─ân Bß║┐p Th├¡m 5",
            giftReward: giftReward,
            note: String(raw.note || "").trim(),
            createdAt: raw.createdAt || raw.timestamp || raw.time || new Date().toISOString()
        };
    }

    /**
     * 13. Cß╗û M├üY T├ìNH TO├üN C╞»ß╗ÜC PH├ì SHIP D2C LINH HOß║áT THß╗£I GIAN THß╗░C (ZERO-HARDCODE)
     * C├┤ng thß╗⌐c: Cß╗▒ ly l├ám tr├▓n l├¬n 1km, C╞░ß╗¢c thu kh├ích t├¡nh ri├¬ng (3k/km), C╞░ß╗¢c trß║ú ship t├¡nh ri├¬ng (4.5k/km).
     * Qu├ín tß╗▒ ─æß╗Öng b├╣ ship khoß║ún ch├¬nh lß╗çch v├á khß║Ñu trß╗½ v├áo Quß╗╣ ─æß╗çm D2C 15% cß╗ºa Thß╗▒c ─É╞ín.
     * @param {number} distanceKm - Khoß║úng c├ích GPS thß╗▒c tß║┐ (km)
     * @param {number} [orderSubtotal=0] - Tß╗òng tiß╗ün m├│n ─ân trong giß╗Å h├áng (VND)
     * @param {Object} [customConfig] - Cß║Ñu h├¼nh nß║íp ─æß╗Öng tß╗½ Sheet [SYS_CONFIG]
     * @returns {Object} Chi tiß║┐t c╞░ß╗¢c thu kh├ích, c╞░ß╗¢c trß║ú ship, tiß╗ün qu├ín b├╣
     */
    function calculateDynamicShippingFee(distanceKm, orderSubtotal, customConfig) {
        var dist = Number(distanceKm) || 1.0;
        var subtotal = Number(orderSubtotal) || 0;
        var cfg = customConfig || {};

        // 1. Quy tß║»c l├ám tr├▓n cß╗▒ ly t├¡nh c╞░ß╗¢c dß╗▒a tr├¬n Sheet SYS_CONFIG
        var roundingMode = String(cfg.roundingMode || cfg.SHIPPING_ROUNDING_MODE || BASE_FALLBACK_CONFIG.FALLBACK_ROUNDING_MODE).toUpperCase();
        var billableKm = (roundingMode === "EXACT") ? Math.max(0.5, dist) : Math.max(1, Math.ceil(dist));

        // 2. T├¡nh c╞░ß╗¢c trß║ú cho Shipper (Thu nhß║¡p thß╗▒c tß║┐ giß╗» ch├ón ─æß╗Öi xe)
        var driverRate = Number(cfg.driverRatePerKm || cfg.SHIP_PARTNER_RATE_PER_KM || cfg.SHIPPING_RATE_DRIVER_PER_KM || BASE_FALLBACK_CONFIG.FALLBACK_DRIVER_RATE_PER_KM);
        var minDriverFee = Number(cfg.minDriverFee || cfg.SHIPPING_MIN_DRIVER_FEE || BASE_FALLBACK_CONFIG.FALLBACK_MIN_DRIVER_FEE);
        var driverPayoutFee = Math.max(minDriverFee, Math.round(billableKm * driverRate));

        // 3. T├¡nh c╞░ß╗¢c thu cß╗ºa Kh├ích h├áng (Tß║ío cß║úm gi├íc ship rß║╗ k├¡ch cß║ºu)
        var customerRate = Number(cfg.customerRatePerKm || cfg.SHIP_CUST_RATE_PER_KM || cfg.SHIPPING_RATE_CUSTOMER_PER_KM || BASE_FALLBACK_CONFIG.FALLBACK_CUSTOMER_RATE_PER_KM);
        var minCustomerFee = Number(cfg.minCustomerFee || cfg.SHIPPING_MIN_CUSTOMER_FEE || BASE_FALLBACK_CONFIG.FALLBACK_MIN_CUSTOMER_FEE);
        var customerPayFee = Math.max(minCustomerFee, Math.round(billableKm * customerRate));

        // 4. T├¡nh to├ín phß║ºn tiß╗ün Qu├ín t├ái trß╗ú b├╣ ship (Merchant Subsidy)
        var autoSubsidy = (cfg.autoSubsidy !== undefined)
                          ? Boolean(cfg.autoSubsidy === true || cfg.autoSubsidy === "true")
                          : (cfg.SHIPPING_AUTO_SUBSIDY !== undefined ? Boolean(cfg.SHIPPING_AUTO_SUBSIDY === true || cfg.SHIPPING_AUTO_SUBSIDY === "true") : BASE_FALLBACK_CONFIG.FALLBACK_AUTO_SUBSIDY);

        var subsidy = 0;
        var subsidyReason = "Trß╗ú gi├í c╞░ß╗¢c cß║ính tranh D2C";

        if (autoSubsidy) {
            subsidy = Math.max(0, driverPayoutFee - customerPayFee);

            // ╞»u ─æ├úi Freeship theo mß╗æc gi├í trß╗ï ─æ╞ín h├áng
            var freeshipThreshold = Number(cfg.freeshipThreshold || cfg.FREESHIP_MIN_SUBTOTAL || BASE_FALLBACK_CONFIG.FALLBACK_FREESHIP_THRESHOLD);
            if (subtotal >= freeshipThreshold && subtotal > 0) {
                subsidy += customerPayFee;
                customerPayFee = 0;
                subsidyReason = "Freeship ─æ╞ín tiß╗çc tß╗½ " + Math.round(freeshipThreshold / 1000) + "k";
            }

            // Kh├│a trß║ºn mß╗⌐c b├╣ ship tß╗æi ─æa ─æß╗â bß║úo vß╗ç d├▓ng tiß╗ün qu├ín
            var maxSubsidy = Number(cfg.maxSubsidy || cfg.MAX_SHIPPING_SUBSIDY || BASE_FALLBACK_CONFIG.FALLBACK_MAX_SUBSIDY);
            if (subsidy > maxSubsidy) {
                var excess = subsidy - maxSubsidy;
                subsidy = maxSubsidy;
                customerPayFee += excess; // Kh├ích c├╣ng chia sß║╗ phß║ºn v╞░ß╗út trß║ºn
            }
        } else {
            customerPayFee = driverPayoutFee;
            subsidy = 0;
            subsidyReason = "Kh├┤ng ├íp dß╗Ñng trß╗ú gi├í qu├ín";
        }

        return {
            distanceKm: dist,
            billableKm: billableKm,
            customerPayFee: customerPayFee,        // C╞░ß╗¢c thu kh├ích hiß╗ân thß╗ï tr├¬n Web
            driverPayoutFee: driverPayoutFee,      // C╞░ß╗¢c trß║ú cho t├ái xß║┐ tr├¬n App
            merchantSubsidy: subsidy,              // Tiß╗ün qu├ín b├╣ trß╗½ v├áo Quß╗╣ ─æß╗çm D2C 15%
            subsidyReason: subsidyReason,
            isFreeShip: (customerPayFee === 0),
            roundingMode: roundingMode
        };
    }

    /**
     * 14. C├öNG Cß╗ñ T├ìNH GI├ü REVERSE-PRICING 13 Cß╗ÿT CHO Bß║óNG DATA_MENU
     * C├┤ng thß╗⌐c: Gi├í D2C = Gi├í App * (1 - % Giß║úm D2C)
     * Quß╗╣ ─æß╗çm D2C (15%) = Gi├í D2C * 15% (B├╣ ship + V├▓ng quay + Thuß║┐ HKD 4.5%)
     * Lß╗úi Nhuß║¡n R├▓ng (LNR) = Gi├í D2C - Gi├í Vß╗æn (COGS) - Quß╗╣ ─æß╗çm D2C
     * @param {number} appPrice - Gi├í ni├¬m yß║┐t App ngo├ái (+25%)
     * @param {number} cogs - Gi├í vß╗æn nguy├¬n liß╗çu m├│n ─ân (COGS)
     * @param {number} [optDiscountPercent] - % Giß║úm gi├í D2C (mß║╖c ─æß╗ïnh 10%)
     * @param {number} [optBufferPercent] - % Quß╗╣ ─æß╗çm D2C (mß║╖c ─æß╗ïnh 15%)
     * @returns {Object} Chi tiß║┐t ph├ón t├¡ch Reverse-Pricing
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
     * 15. ─É├ôNG G├ôI V├Ç XUß║ñT Bß║óN TH╞» VIß╗åN TO├ÇN Cß╗ñC SSOT
     */
    return {
        CONSTANTS: BASE_FALLBACK_CONFIG,
        SHEETS: SHEETS,
        ORDERS_SCHEMA: ORDERS_SCHEMA,
        MENU_SCHEMA: MENU_SCHEMA,
        CATEGORIES_SCHEMA: CATEGORIES_SCHEMA,
        CONFIG_SCHEMA: CONFIG_SCHEMA,
        SHIPPERS_SCHEMA: SHIPPERS_SCHEMA,
        SHIPPER_LEDGER_SCHEMA: SHIPPER_LEDGER_SCHEMA,
        CUSTOMERS_SCHEMA: CUSTOMERS_SCHEMA,
        REVIEWS_SCHEMA: REVIEWS_SCHEMA,
        ORDER_ITEMS_SCHEMA: ORDER_ITEMS_SCHEMA,
        ORDER_STATUS: ORDER_STATUS,
        ROLES: ROLES,
        STEPS: STEPS,
        STATUS_MAP: STATUS_MAP,
        ACTIONS: ACTIONS,
        ERROR_CODES: ERROR_CODES,
        CONFIG_KEYS: CONFIG_KEYS,
        SHIPPER_PRESETS: SHIPPER_PRESETS,
        auditApiResponse: auditApiResponse,
        validateActionPayload: validateActionPayload,
        registerAction: registerAction,
        normalizeOrderEntity: normalizeOrderEntity,
        calculateDynamicShippingFee: calculateDynamicShippingFee,
        calculateReversePricing: calculateReversePricing
    };

}));

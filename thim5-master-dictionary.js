/**
 * =============================================================================
 * TÊN FILE: thim5-master-dictionary.js (PHIÊN BẢN ENTERPRISE SaaS v3.0 MASTER)
 * BẢN QUYỀN: BẾP MÌ TRỘN THÍM 5 & LONGHOAFOOD MASTER (NĂM 2026)
 * KIẾN TRÚC SƯ TRƯỞNG: ĐU ĐỦ (CỐ VẤN CHIẾN LƯỢC F&B CHO ANH HẢI ÂU)
 * VAI TRÒ: 
 *   - TỪ ĐIỂN THAM CHIẾU DUY NHẤT (SINGLE SOURCE OF TRUTH - SSOT).
 *   - KHÓA CỨNG TOÀN BỘ ACTION APIS, TÊN BẢNG, TRẠNG THÁI VẬN HÀNH & TÊN CỘT.
 *   - CHỐNG TRÔI DẠT (ANTI-DRIFT) DỮ LIỆU GIỮA BẾP, SHIPPER, ADMIN & STOREFRONT.
 * =============================================================================
 */

(function(root, factory) {
    if (typeof define === 'function' && define.amd) {
        define([], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.T5_DICT = factory();
        root.T5_SSOT = root.T5_DICT; // Alias tương thích ngược toàn hệ thống
        window.T5_MASTER = root.T5_DICT;
    }
}(typeof self !== 'undefined' ? self : this, function() {

    'use strict';

    /**
     * 1. HẰNG SỐ TOÀN HỆ THỐNG & ĐỊNH DANH BẾP TRUNG TÂM (SYSTEM IMMUTABLE CONSTANTS)
     */
    var CONSTANTS = Object.freeze({
        APP_VERSION: "3.0.20260927",
        BRAND_NAME: "Mì Trộn Thím 5",
        HEAD_KITCHEN_LOCATION: {
            NAME: "Bếp Trung Tâm Hòa Thành, Tây Ninh",
            LAT: 11.285267,
            LNG: 106.133347,
            GPS_STRING: "11.285267,106.133347",
            STORE_NAV_URL: "https://www.google.com/maps/dir/?api=1&destination=11.285267,106.133347"
        },
        DEFAULT_BASE_SHIP_FEE: 12000,
        BASE_DISTANCE_KM: 2.0,
        EXTRA_FEE_PER_KM: 4500,
        RAIN_SURCHARGE_PER_KM: 1000,
        MAX_PROMOTION_RATE: 0.15,           // Khóa trần khuyến mãi tối đa 15% doanh thu gộp
        DEFAULT_PLATFORM_FEE_RATE: 0.20,    // Chiết khấu sàn app ngoài (Grab/Shopee) 20%
        TAX_RATE_HKD: 0.045,                // Thuế khoán Hộ kinh doanh 4.5%
        PLATFORM_MASTER_FEE_RATE: 0.02,     // Phí quản trị nền tảng SaaS 2%
        MAX_COD_HOLDING_PER_SHIPPER: 300000,// Hạn mức ôm tiền mặt COD tối đa của Shipper
        DRIVER_PEAK_BONUS: 2000,            // Thưởng nóng mỗi cuốc giờ cao điểm/mưa
        MIN_AOV_LUCKY_WHEEL: 79000          // Mốc đơn tối thiểu kích hoạt vòng quay may mắn
    });

    /**
     * 2. TỪ ĐIỂN TÊN BẢNG GOOGLE SHEETS CHUẨN HÓA DUY NHẤT (DATABASE SHEETS SSOT)
     * Triệt tiêu hoàn toàn các tên phân mảnh cũ: [ORDERS_D2C], DATA ORDER, [MENU_MATRIX]
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
        COL_BASE_SHIP_FEE: 9,     // Cột J: Cước Giao Hàng Gốc
        COL_SHIPPING_SUBSIDY: 10, // Cột K: Trợ Giá Cước Ship Quán Chịu
        COL_FINAL_TOTAL: 11,      // Cột L: Thực Thu Khách
        COL_PAYMENT_METHOD: 12,   // Cột M: Phương Thức (COD / VIETQR)
        COL_SHIPPER_INFO: 13,     // Cột N: Tài Xế Phụ Trách (Tên + SĐT)
        COL_GIFT_NAME: 14,        // Cột O: Món Quà May Mắn 0đ
        COL_NOTE: 15              // Cột P: Ghi Chú Đơn & Vết Kiểm Toán Bếp
    });

    /**
     * 4. BỘ CHỈ SỐ CỘT CHUẨN HÓA BẢNG DATA_MENU (13 CỘT REVERSE-PRICING)
     */
    var MENU_SCHEMA = Object.freeze({
        COL_CODE: 0,              // Cột A: Mã Món SKU (VD: M01, C01, CB01)
        COL_NAME: 1,              // Cột B: Tên Món Ăn
        COL_CATEGORY: 2,          // Cột C: Nhóm Danh Mục
        COL_APP_PRICE: 3,         // Cột D: Giá Niêm Yết App Ngoài (+25%)
        COL_DISCOUNT_D2C: 4,      // Cột E: % Giảm Giá Kênh D2C
        COL_D2C_PRICE: 5,         // Cột F: Giá Bán Web D2C Thím 5
        COL_COGS: 6,              // Cột G: Giá Vốn Nguyên Liệu (Food Cost)
        COL_NET_PROFIT: 7,        // Cột H: Lợi Nhuận Ròng (LNR)
        COL_STATUS: 8,            // Cột I: Trạng Thái (ACTIVE | OUT_OF_STOCK | HIDDEN)
        COL_DESCRIPTION: 9,       // Cột J: Mô Tả Hương Vị & Thành Phần
        COL_IMAGE_URL: 10,        // Cột K: Đường Dẫn Ảnh Món
        COL_CROSS_SELL: 11,       // Cột L: Mã Món Bán Kèm Gợi Ý
        COL_ROLE_TAG: 12          // Cột M: Vai Trò (CORE | COMBO | BOOSTER | TRAFFIC)
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
     * Đồng bộ chuẩn 100% giữa Frontend gọi qua Thim5API.callGAS và Backend CoreRouter.gs
     */
    var ACTIONS = Object.freeze({
        // Quản trị Thực đơn & Danh mục
        GET_ADMIN_MENU: "getAdminMenuCatalog",
        SAVE_MENU_ITEM: "saveOrUpdateMenuItem",
        TOGGLE_MENU_ITEM: "toggleMenuItemStatus",
        DELETE_MENU_ITEM: "deleteMenuItem",
        GET_CATEGORIES: "getMenuCategories",
        SAVE_CATEGORY: "saveMenuCategory",
        DELETE_CATEGORY: "deleteMenuCategory",

        // Omni-Ingestion Pipeline
        BATCH_IMPORT_MENU: "batchImportMenuItems",
        PARSE_SPREADSHEET_BUFFER: "parseUploadedSpreadsheetBuffer",
        PROCESS_OCR_GEMINI: "processMenuOcrWithGemini",
        EXTRACT_MENU_URL: "extractMenuFromPublicUrl",
        UPLOAD_MENU_IMAGE: "uploadImageToMenuDriveFolder",
        GET_MENU_TEMPLATE: "getMenuExcelTemplateStructure",

        // Bán Hàng D2C & Khách Hàng
        GET_CONFIG: "getConfig",
        CREATE_D2C_ORDER: "createD2COrder",
        GET_ORDER_TRACKING: "getOrderTracking",
        TOGGLE_STORE_STATUS: "toggleStoreStatus",
        GET_STORE_STATUS: "getStoreStatus",

        // Trạm Bếp KDS & Bàn Giao Món
        GET_KITCHEN_ORDERS: "getKitchenKdsOrders",
        KITCHEN_UPDATE_STATUS: "kitchenUpdateStatus",
        KITCHEN_ASSIGN_SHIPPER: "kitchenAssignShipper",
        KITCHEN_SETTLE_HANDOVER: "kitchenSettleHandover",
        KITCHEN_VERIFY_AND_COOK: "verifyAndAssignCookOrder",

        // Trạm Điều Phối Shipper
        GET_SHIPPER_ORDERS: "getShipperOrders",
        SHIPPER_VERIFY_COD: "shipperVerifyCodOrderSuccess",
        SHIPPER_UPDATE_STEP: "shipperUpdateStep",
        SHIPPER_RELEASE_ORDER: "shipperReleaseOrder",
        GET_ACTIVE_SHIPPERS: "getActiveShippersList",
        SAVE_SHIPPER: "saveOrUpdateShipper",
        TOGGLE_SHIPPER: "toggleShipperStatus",

        // Quản Lý Đơn Hàng & Tài Chính Admin
        GET_ORDERS_LIST: "getOrdersList",
        ASSIGN_SHIPPER: "assignShipper",
        CONFIRM_HANDOVER: "confirmKitchenHandover",
        COMPLETE_ORDER: "completeOrder",
        MANUAL_APPROVE_PAYMENT: "manualApprovePayment",
        GET_FINANCIAL_PL: "getFinancialPlSummary",
        GET_SHIPPER_LEDGER: "getShipperCodHoldingLedger",
        GET_AUDIT_LOGS: "getFinancialAuditLogs",

        // Bảo Mật & Phân Quyền
        VERIFY_ADMIN_ROLE: "verifyAdminRole",
        VERIFY_SUPER_ADMIN_TOTP: "verifySuperAdminTotp",
        GET_TOTP_SETUP_QR: "getTotpSetupQrData",
        SEND_EMERGENCY_OTP: "sendEmergencyBackupOtpToEmail",
        GET_SYSTEM_CONFIG: "getSystemDynamicConfig",
        SAVE_SYSTEM_CONFIG: "saveSystemDynamicConfig",

        // Mini CRM & Gamification Vòng Quay
        GET_CUSTOMER_PROFILE: "getCustomerProfile",
        GET_PUBLIC_WHEEL_CONFIG: "getPublicWheelConfig",
        SPIN_LUCKY_WHEEL: "spinLuckyWheel",
        UPDATE_WHEEL_CONFIG: "updateWheelConfig",
        REDEEM_GIFT_TOKEN: "redeemGiftToken",
        LOG_WHEEL_REWARD: "logWheelRewardTransaction"
    });

    /**
     * 7. DANH SÁCH SHIPPER NỘI BỘ MẶC ĐỊNH (PRESET SHIPPERS)
     */
    var SHIPPER_PRESETS = Object.freeze({
        "0585": { id: "SHIP_01", name: "Nguyễn Hải Âu", phone: "0934.220.585", rawPhone: "0934220585" },
        "4693": { id: "SHIP_02", name: "Nguyễn Hải Âu", phone: "0969.004.693", rawPhone: "0969004693" },
        "2862": { id: "SHIP_03", name: "Trần Minh Nam", phone: "0968.222.862", rawPhone: "0968222862" }
    });

    /**
     * 8. HÀM CHUẨN HÓA THỰC THỂ ĐƠN HÀNG TOÀN NĂNG (UNIVERSAL ORDER NORMALIZER)
     * Nhận vào bất kỳ đối tượng thô nào từ Google Sheets / KDS / Shipper / Admin / Web D2C
     * Trả về đối tượng đồng nhất 100% thuộc tính an toàn, triệt tiêu hoàn toàn lỗi undefined.
     */
    function normalizeOrderEntity(raw) {
        if (!raw || typeof raw !== 'object') {
            raw = {};
        }

        // 1. Mã đơn hàng chuẩn
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

        // 3. Chuẩn hóa Trạng thái Vận hành & Bước (State Machine)
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

        // Map ngược lại nhãn trạng thái chuẩn
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
        var baseShipFee = Number(raw.shippingFee || raw.shipFee || raw.baseShipFee || CONSTANTS.DEFAULT_BASE_SHIP_FEE);
        var shippingSubsidy = Number(raw.shippingSubsidy || raw.subsidizedShipFee || raw.subsidy || 0);
        var customerShipFee = Math.max(0, baseShipFee - shippingSubsidy);

        var finalTotal = Number(raw.finalTotal || raw.totalAmount || raw.total || (subtotal + customerShipFee));
        var collectFromCustomer = isOnlinePaid ? 0 : finalTotal;

        // Tiền bù ship sàn ngoài (nếu gọi GrabExpress / Vill)
        var externalShipFee = Number(raw.externalShipFee || 0);
        var actualSubsidySpent = externalShipFee > 0 ? Math.max(0, externalShipFee - customerShipFee) : shippingSubsidy;

        // 6. Chuẩn hóa Kênh & Thông tin Shipper
        var rawShipperInfo = String(raw.shipperInfo || raw.shipper || raw.assignedShipper || "").trim();
        var deliveryChannel = String(raw.deliveryChannel || raw.shipperType || (rawShipperInfo.indexOf("GRAB") !== -1 || rawShipperInfo.indexOf("VILL") !== -1 ? "EXTERNAL" : "INTERNAL")).trim().toUpperCase();
        var trackingCode = String(raw.trackingCode || raw.externalTrackingCode || "").trim();

        // 7. Chuẩn hóa Danh sách món ăn
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

        // Quà tặng 0đ may mắn
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
                storeNavUrl: raw.storeGpsUrl || CONSTANTS.HEAD_KITCHEN_LOCATION.STORE_NAV_URL,
                customerNavUrl: raw.customerGpsUrl || ("https://www.google.com/maps/dir/?api=1&destination=" + encodeURIComponent(custAddr))
            },
            items: itemsList,
            itemsFormattedText: itemsFormattedText || "Món ăn Bếp Thím 5",
            giftReward: giftReward,
            note: String(raw.note || "").trim(),
            createdAt: raw.createdAt || raw.timestamp || raw.time || new Date().toISOString()
        };
    }

/**
 * =============================================================================
 * MODULE: MASTER DICTIONARY & SCHEMA RUNTIME HYDRATION (v3.5 ENTERPRISE GHOST)
 * Tác giả: Đu Đủ - Cố vấn Chiến lược & Kỹ sư Trưởng hệ thống SaaS Enterprise
 * Bản quyền: Bếp Thím 5 & LongHoaFood Master (Năm 2026)
 * Trách nhiệm cốt tử:
 *   - Nguồn chân lý duy nhất (SSOT) toàn hệ thống cho Backend & Frontend.
 *   - Khóa cứng cấu trúc 7 Bảng CSDL Google Sheets, 16 cột Orders, 13 cột Menu.
 *   - Tự động di trú (Auto-Migration) schema khi mở rộng dịch vụ mới (Chở Khách).
 *   - Bơm hợp đồng dữ liệu runtime (Hydration) về Frontend qua API getSystemContract.
 * =============================================================================
 */

/**
 * 1. TỪ ĐIỂN CHUẨN HÓA TOÀN CẦU BẤT BIẾN (T5_SSOT)
 * Được đóng băng bằng Object.freeze() để chống trôi dạt dữ liệu trong runtime.
 */
var T5_SSOT = Object.freeze({
  SYSTEM: Object.freeze({
    VERSION: "v3.5.20261016",
    BRAND_NAME: "Mì Trộn Thím 5 & LongHoaFood Master SaaS (AnNgonLongHoa.com.vn)",
    TIMEZONE: "Asia/Ho_Chi_Minh",
    SUPER_ADMIN_EMAIL: "haiau2205@gmail.com",
    COMMUNITY_PORTAL_DOMAIN: "anngonlonghoa.com.vn",
    DEFAULT_TENANT_ID: "THIM5_LONGHOA",
    STORE_COORDS: Object.freeze({
      LAT: 11.285267,
      LNG: 106.133347,
      GPS_STRING: "11.285267,106.133347",
      MAPS_URL: "https://www.google.com/maps/dir/?api=1&destination=11.285267,106.133347"
    }),
    FINANCIAL_DEFAULTS: Object.freeze({
      BASE_SHIP_FEE: 5000,
      BASE_DISTANCE_KM: 1.0,
      EXTRA_FEE_PER_KM: 4500,
      SHIP_CUST_RATE_PER_KM: 5000,
      SHIP_PARTNER_RATE_PER_KM: 4500,
      SHIP_BASE_FEE_CUST: 5000,
      SHIP_BASE_MIN_FEE_DRIVER: 5000,
      SHIP_SURGE_MULTIPLIER: 1.0,
      MASTER_PLATFORM_FEE_PCT: 5.0,
      PLATFORM_MASTER_FEE: 0.05,
      CPA_SPOTLIGHT_BOOST_PCT: 3.0,
      CROSS_STORE_AFFILIATE_PCT: 10.0,
      FOOD_COST_CAP_TRAFFIC: 0.55,
      FOOD_COST_CAP_CORE: 0.45,
      FOOD_COST_CAP_BOOSTER: 0.20,
      MAX_PROMOTION_RATE: 0.15,
      TAX_RATE_HKD: 0.045,
      MAX_COD_HOLDING_PER_SHIPPER: 300000,
            PROMO_MODULE_MASTER_ENABLED: true,
      PROMO_CAMPAIGNS_JSON: "",
      PROMO_SMART_SHIP_VOUCHER_ENABLED: true,
      PROMO_TIER_25_ENABLED: true,
      PROMO_TIER_50_ENABLED: true,
      PROMO_TIER_100_ENABLED: true,
      PROMO_UPSELL_NUDGE_ENABLED: true,
      PROMO_MIN_NET_PROFIT_FLOOR: 25000,
      PROMO_SURPLUS_SHARE_RATIO: 0.7,
      SHIP_CUST_RATE_PER_KM: 5000,
      SHIP_PARTNER_RATE_PER_KM: 4500,
      MAX_PROMO_CAP_PCT: 15,
      COD_HOLDING_LIMIT: 300000,
      TAX_HKD_PCT: 4.5,
      MIN_AOV_LUCKY_WHEEL: 79000,
      MAX_WHEEL_BUDGET_RATE: 0.05,
      VERIFIED_REVIEW_REQUIRE_ORDER: true,
      VERIFIED_REVIEW_ALLOWED_STATUS: "COMPLETED"
    })
  }),

  SHEETS: Object.freeze({
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
    WHEEL_LOGS: "DATA_WHEEL_LOGS",
    COMMUNITY_POSTS: "DATA_COMMUNITY_POSTS", // Phase 5: Bài đăng cộng đồng
    REVIEWS: "DATA_REVIEWS"              // Phase 5: Đánh giá xác thực
  }),

  ORDERS_SCHEMA: Object.freeze({
    COL_ORDER_CODE: 0,       // Cột A: Mã Đơn
    COL_ORDER_ID: 0,         // Alias tương thích Frontend
    COL_TIME: 1,             // Cột B: Thời Gian
    COL_TIMESTAMP: 1,        // Alias tương thích Frontend
    COL_STATUS: 2,           // Cột C: Trạng Thái Vận Hành
    COL_OPS_STATUS: 2,       // Alias tương thích Frontend
    COL_STEP: 3,             // Cột D: Bước Tiến Trình (0, 2, 2.5, 3, 4, -1)
    COL_CUST_NAME: 4,        // Cột E: Họ Tên Khách
    COL_CUST_PHONE: 5,       // Cột F: SĐT Khách
    COL_CUST_ADDRESS: 6,     // Cột G: Địa Chỉ
    COL_DISTANCE_KM: 7,      // Cột H: Cự Ly GPS (km)
    COL_SUBTOTAL: 8,         // Cột I: Tiền Món Ăn
    COL_BASE_SHIP_FEE: 9,    // Cột J: Cước Giao Hàng Gốc
    COL_SHIPPING_SUBSIDY: 10,// Cột K: Trợ Giá Ship Quán Chịu
    COL_FINAL_TOTAL: 11,     // Cột L: Thực Thu Khách Trả
    COL_PAY_METHOD: 12,      // Cột M: Phương Thức (COD / VIETQR)
    COL_PAYMENT_METHOD: 12,  // Alias tương thích Frontend
    COL_SHIPPER_INFO: 13,    // Cột N: Tài Xế Phụ Trách
    COL_GIFT_NAME: 14,       // Cột O: Món Quà May Mắn 0đ
    COL_NOTE: 15,            // Cột P: Ghi Chú Đơn & Vết Kiểm Toán
    COL_SERVICE_TYPE: 16     // Cột Q: Phân Hệ Dịch Vụ (FOOD_DELIVERY / RIDE_HAILING)
  }),

  MENU_SCHEMA: Object.freeze({
    COL_CODE: 0,             // Cột A: Mã Món SKU
    COL_NAME: 1,             // Cột B: Tên Món Ăn
    COL_CATEGORY: 2,         // Cột C: Nhóm Danh Mục
    COL_APP_PRICE: 3,        // Cột D: Giá Niêm Yết App Ngoài
    COL_DISCOUNT_D2C: 4,     // Cột E: % Giảm Giá Kênh D2C
    COL_D2C_PRICE: 5,        // Cột F: Giá Bán Web D2C
    COL_COGS: 6,             // Cột G: Giá Vốn Food Cost
    COL_NET_PROFIT: 7,       // Cột H: Lợi Nhuận Ròng (LNR)
    COL_STATUS: 8,           // Cột I: Trạng Thái (ACTIVE / OUT_OF_STOCK)
    COL_DESCRIPTION: 9,      // Cột J: Mô Tả Món & Topping Kèm
    COL_IMAGE_URL: 10,       // Cột K: Đường Dẫn Ảnh Món
    COL_CROSS_SELL: 11,      // Cột L: Mã Món Bán Kèm Gợi Ý
    COL_ROLE_TAG: 12         // Cột M: Tag Chiến Lược (CORE / COMBO / BOOSTER)
  }),

  CATEGORIES_SCHEMA: Object.freeze({
    COL_CODE: 0,              // Cột A: Mã Danh Mục (VD: CAT_COM, CAT_MI, CAT_TOPPING)
    COL_ICON: 1,              // Cột B: Biểu Tượng Icon / Emoji
    COL_NAME: 2,              // Cột C: Tên Danh Mục Hiển Thị
    COL_SLUG: 3,              // Cột D: Slug Kênh D2C
    COL_MAX_FC: 4             // Cột E: Trần Food Cost Cho Phép (%)
  }),

  CONFIG_SCHEMA: Object.freeze({
    COL_KEY: 0,               // Cột A: Tham Số Cấu Hình (Key)
    COL_VALUE: 1,             // Cột B: Giá Trị Cấu Hình (Value)
    COL_DESCRIPTION: 2        // Cột C: Mô Tả Nghiệp Vụ
  }),

  SHIPPERS_SCHEMA: Object.freeze({
    COL_CODE: 0,              // Cột A: Mã Shipper
    COL_NAME: 1,              // Cột B: Tên Tài Xế
    COL_PHONE: 2,             // Cột C: Số Điện Thoại
    COL_PLATE: 3,             // Cột D: Biển Số Xe
    COL_STATUS: 4,            // Cột E: Trạng Thái (ACTIVE / LOCKED_DEBT)
    COL_MAX_HOLDING: 5        // Cột F: Hạn Mức Giữ COD Tối Đa (300.000đ)
  }),

  SHIPPER_LEDGER_SCHEMA: Object.freeze({
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
  }),

  CUSTOMERS_SCHEMA: Object.freeze({
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
  }),

  REVIEWS_SCHEMA: Object.freeze({
    COL_REVIEW_ID: 0,         // Cột A: Mã Đánh Giá
    COL_ORDER_CODE: 1,        // Cột B: Mã Đơn Hàng
    COL_PHONE: 2,             // Cột C: SĐT Khách
    COL_NAME: 3,              // Cột D: Họ Tên
    COL_RATING: 4,            // Cột E: Số Sao (1-5)
    COL_COMMENT: 5,           // Cột F: Nội Dung Đánh Giá
    COL_DISH_NAME: 6,         // Cột G: Món Đánh Giá
    COL_TIME: 7,              // Cột H: Thời Gian
    COL_STATUS: 8             // Cột I: Trạng Thái (APPROVED)
  }),

  ORDER_ITEMS_SCHEMA: Object.freeze({
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
  }),

  ORDER_STATUS: Object.freeze({
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
  }),

  ROLES: Object.freeze({
    SUPER_ADMIN_LV3: "SUPER_ADMIN_LV3", // Super Master anh Hải Âu (2FA TOTP)
    TENANT_ADMIN: "TENANT_ADMIN",       // Chủ quán F&B (Quản trị thực đơn, xem P&L, đăng bài)
    POS_LV2: "POS_LV2",                 // Thu ngân (PIN 2026 - Tạo đơn, điều phối ship, thu COD)
    KITCHEN_LV1: "KITCHEN_LV1",         // Bếp KDS (PIN 1985 - Xem đơn nấu, bật/tắt món)
    SHIPPER: "SHIPPER"                  // Tài xế giao hàng
  }),

  ERROR_CODES: Object.freeze({
    ERR_ROUTER_ACTION_NOT_FOUND: "ERR_ROUTER_ACTION_NOT_FOUND",
    ERR_SHEET_NOT_FOUND: "ERR_SHEET_NOT_FOUND",
    ERR_SCHEMA_MISMATCH: "ERR_SCHEMA_MISMATCH",
    ERR_EMPTY_CATEGORIES: "ERR_EMPTY_CATEGORIES",
    ERR_UNAUTHORIZED: "ERR_UNAUTHORIZED",
    ERR_INVALID_PAYLOAD: "ERR_INVALID_PAYLOAD",
    ERR_NETWORK_GAS: "ERR_NETWORK_GAS",
    ERR_EXECUTION_TIMEOUT: "ERR_EXECUTION_TIMEOUT"
  }),

  CONFIG_KEYS: Object.freeze({
    STORE_NAME: "STORE_NAME",
    STORE_SLOGAN: "STORE_SLOGAN",
    STORE_HOTLINE: "STORE_HOTLINE",
    STORE_ADDRESS: "STORE_ADDRESS",
    STORE_ICON: "STORE_ICON",
    STORE_LATITUDE: "STORE_LATITUDE",
    STORE_LONGITUDE: "STORE_LONGITUDE",
    STORE_STATUS: "STORE_STATUS",
    STORE_CLOSED_MESSAGE: "STORE_CLOSED_MESSAGE",
    COMMUNITY_PORTAL_DOMAIN: "COMMUNITY_PORTAL_DOMAIN",
    DEFAULT_TENANT_ID: "DEFAULT_TENANT_ID",
    SHIPPING_RATE_CUSTOMER_PER_KM: "SHIPPING_RATE_CUSTOMER_PER_KM",
    SHIP_CUST_RATE_PER_KM: "SHIP_CUST_RATE_PER_KM",
    SHIPPING_RATE_DRIVER_PER_KM: "SHIPPING_RATE_DRIVER_PER_KM",
    SHIP_PARTNER_RATE_PER_KM: "SHIP_PARTNER_RATE_PER_KM",
    SHIPPING_MIN_CUSTOMER_FEE: "SHIPPING_MIN_CUSTOMER_FEE",
    SHIP_BASE_FEE_CUST: "SHIP_BASE_FEE_CUST",
    SHIPPING_MIN_DRIVER_FEE: "SHIPPING_MIN_DRIVER_FEE",
    SHIP_SURGE_MULTIPLIER: "SHIP_SURGE_MULTIPLIER",
    SHIPPING_AUTO_SUBSIDY: "SHIPPING_AUTO_SUBSIDY",
    SHIPPING_ROUNDING_MODE: "SHIPPING_ROUNDING_MODE",
    FREESHIP_MIN_SUBTOTAL: "FREESHIP_MIN_SUBTOTAL",
    MAX_SHIPPING_SUBSIDY: "MAX_SHIPPING_SUBSIDY",
    MASTER_PLATFORM_FEE_PCT: "MASTER_PLATFORM_FEE_PCT",
    PLATFORM_MASTER_FEE: "PLATFORM_MASTER_FEE",
    CPA_SPOTLIGHT_BOOST_PCT: "CPA_SPOTLIGHT_BOOST_PCT",
    CROSS_STORE_AFFILIATE_PCT: "CROSS_STORE_AFFILIATE_PCT",
    FC_CAP_TRAFFIC: "FC_CAP_TRAFFIC",
    FC_CAP_CORE: "FC_CAP_CORE",
    FC_CAP_BOOSTER: "FC_CAP_BOOSTER",
    D2C_DISCOUNT_PERCENT: "D2C_DISCOUNT_PERCENT",
    D2C_BUFFER_PERCENT: "D2C_BUFFER_PERCENT",
    TAX_RATE_HKD: "TAX_RATE_HKD",
    MAX_PROMOTION_RATE: "MAX_PROMOTION_RATE",
        PROMO_MODULE_MASTER_ENABLED: "PROMO_MODULE_MASTER_ENABLED",
    PROMO_CAMPAIGNS_JSON: "PROMO_CAMPAIGNS_JSON",
    PROMO_SMART_SHIP_VOUCHER_ENABLED: "PROMO_SMART_SHIP_VOUCHER_ENABLED",
    PROMO_TIER_25_ENABLED: "PROMO_TIER_25_ENABLED",
    PROMO_TIER_50_ENABLED: "PROMO_TIER_50_ENABLED",
    PROMO_TIER_100_ENABLED: "PROMO_TIER_100_ENABLED",
    PROMO_UPSELL_NUDGE_ENABLED: "PROMO_UPSELL_NUDGE_ENABLED",
    PROMO_MIN_NET_PROFIT_FLOOR: "PROMO_MIN_NET_PROFIT_FLOOR",
    PROMO_SURPLUS_SHARE_RATIO: "PROMO_SURPLUS_SHARE_RATIO",
    MAX_PROMO_CAP_PCT: "MAX_PROMO_CAP_PCT",
    COD_HOLDING_LIMIT: "COD_HOLDING_LIMIT",
    TAX_HKD_PCT: "TAX_HKD_PCT",
    BANK_BIN: "BANK_BIN",
    BANK_CODE: "BANK_CODE",
    BANK_ACCOUNT_NO: "BANK_ACCOUNT_NO",
    BANK_ACCOUNT_NAME: "BANK_ACCOUNT_NAME",
    MOMO_PHONE: "MOMO_PHONE",
    MOMO_NAME: "MOMO_NAME",
    MAX_COD_HOLDING_PER_SHIPPER: "MAX_COD_HOLDING_PER_SHIPPER",
    DRIVER_BONUS_PER_ORDER: "DRIVER_BONUS_PER_ORDER",
    MASTER_SUPER_KEY: "MASTER_SUPER_KEY",
    SUPER_ADMIN_EMAIL: "SUPER_ADMIN_EMAIL",
    PIN_ADMIN_LV1: "PIN_ADMIN_LV1",
    PIN_ADMIN_LV2: "PIN_ADMIN_LV2",
    VERIFIED_REVIEW_REQUIRE_ORDER: "VERIFIED_REVIEW_REQUIRE_ORDER"
  }),

  STEPS: Object.freeze({
    WAIT_VERIFY: 0,          // Chờ xác minh đơn COD (PENDING)
    PENDING: 0,              // Alias chuẩn v3.5
    COOKING: 2,              // Bếp đang chế biến (PREPARING)
    PREPARING: 2,            // Alias chuẩn v3.5
    PACKED: 2.5,             // Đã đóng gói, chờ tài xế (READY_TO_SHIP)
    READY_TO_SHIP: 2.5,      // Alias chuẩn v3.5
    SHIPPING: 3,             // Đang giao trên đường
    DISPATCHED_3PL: 3,       // Giao qua đối tác sàn ngoài
    DELIVERING: 3,           // Alias
    COMPLETED: 4,            // Giao thành công, hoàn tất đơn
    CANCELLED: -1            // Đơn hủy
  }),

  SERVICES: Object.freeze({
    FOOD_DELIVERY: { code: "FOOD_DELIVERY", label: "Giao Món Ăn Bếp Thím 5", prefix: "DH" },
    RIDE_HAILING: { code: "RIDE_HAILING", label: "Chở Khách Đất Thánh Tây Ninh", prefix: "RIDE" },
    FAST_EXPRESS: { code: "FAST_EXPRESS", label: "Giao Hàng Siêu Tốc Hỏa Tốc", prefix: "SHIP" }
  }),

  ACTIONS: Object.freeze({
    // Hợp Đồng Hệ Thống & Kiểm Tra Sức Khỏe
    GET_SYSTEM_CONTRACT: "getSystemContract",
    EVALUATE_SMART_SHIP_VOUCHER: "evaluateSmartShipVoucher",
        GET_PROMO_CAMPAIGNS: "getPromoCampaigns",
    SAVE_PROMO_CAMPAIGN: "savePromoCampaign",
    TOGGLE_PROMO_CAMPAIGN_STATUS: "togglePromoCampaignStatus",
    DELETE_PROMO_CAMPAIGN: "deletePromoCampaign",
    EVALUATE_ORDER_PROMO_CAMPAIGNS: "evaluateOrderPromoCampaigns",
    UPDATE_PROMO_CONFIG: "updatePromoConfig",
    PING: "ping",
    HEALTH_CHECK: "healthCheck",

    // Xác thực, Phân quyền & 2FA
    VERIFY_ADMIN_ROLE: "verifyAdminRole",
    VERIFY_SUPER_ADMIN_TOTP: "verifySuperAdminTotp",
    GET_TOTP_SETUP_QR: "getTotpSetupQrData",
    GET_TOTP_SETUP_QR_DATA: "getTotpSetupQrData", // Alias
    SEND_EMERGENCY_OTP: "sendEmergencyBackupOtpToEmail",
    SEND_EMERGENCY_OTP_TO_EMAIL: "sendEmergencyBackupOtpToEmail", // Alias

    // Cấu hình Hệ thống & Cước Ship Động
    GET_CONFIG: "getConfig",
    GET_SYSTEM_CONFIG: "getSystemDynamicConfig",
    GET_SYSTEM_DYNAMIC_CONFIG: "getSystemDynamicConfig", // Alias
    SAVE_SYSTEM_CONFIG: "saveSystemDynamicConfig",
    SAVE_SYSTEM_DYNAMIC_CONFIG: "saveSystemDynamicConfig", // Alias
    CALCULATE_DYNAMIC_SHIPPING_FEE: "calculateDynamicShippingFee",

    // Bật/Tắt Quán
    TOGGLE_STORE_STATUS: "toggleStoreOperationalStatus",
    TOGGLE_STORE_OPERATIONAL_STATUS: "toggleStoreOperationalStatus", // Alias
    GET_STORE_STATUS: "getStoreOperationalStatus",
    GET_STORE_OPERATIONAL_STATUS: "getStoreOperationalStatus", // Alias

    // Đơn hàng Storefront D2C
    CREATE_D2C_ORDER: "createD2COrder",
    GET_ORDER_TRACKING: "getOrderTracking",

    // Quản lý Đơn hàng Admin Shell
    GET_ORDERS_LIST: "getOrdersList",
    ASSIGN_SHIPPER: "assignShipper",
    CONFIRM_KITCHEN_HANDOVER: "confirmKitchenHandover",
    COMPLETE_ORDER: "completeOrder",
    MANUAL_APPROVE_PAYMENT: "manualApprovePayment",

    // Trạm Bếp KDS
    GET_KITCHEN_ORDERS: "getKitchenKdsOrders",
    GET_KITCHEN_KDS_ORDERS: "getKitchenKdsOrders", // Alias
    KITCHEN_UPDATE_STATUS: "kitchenUpdateStatus",
    KITCHEN_ASSIGN_SHIPPER: "kitchenAssignShipper",
    KITCHEN_SETTLE_HANDOVER: "kitchenSettleHandover",
    VERIFY_AND_ASSIGN_COOK_ORDER: "verifyAndAssignCookOrder",

    // Trạm Shipper (Hybrid Fleet)
    GET_SHIPPER_ORDERS: "getShipperOrders",
    SHIPPER_VERIFY_COD: "shipperVerifyCodOrderSuccess",
    SHIPPER_VERIFY_COD_SUCCESS: "shipperVerifyCodOrderSuccess", // Alias
    SHIPPER_UPDATE_STEP: "shipperUpdateStep",
    SHIPPER_RELEASE_ORDER: "shipperReleaseOrder",
    GET_ACTIVE_SHIPPERS: "getActiveShippersList",
    GET_ACTIVE_SHIPPERS_LIST: "getActiveShippersList", // Alias
    SAVE_SHIPPER: "saveOrUpdateShipper",
    SAVE_OR_UPDATE_SHIPPER: "saveOrUpdateShipper", // Alias
    TOGGLE_SHIPPER: "toggleShipperStatus",
    TOGGLE_SHIPPER_STATUS: "toggleShipperStatus", // Alias
    DELETE_SHIPPER: "deleteShipper",
    SETTLE_SHIPPER_DEBT: "settleShipperDebt",
    COMPLETE_ORDER_DELIVERY: "completeOrderDelivery",
    SHIPPER_UPDATE_ORDER_STATUS: "shipperUpdateOrderStatus",

    // Quản trị Thực đơn & Danh mục
    GET_ADMIN_MENU: "getAdminMenuCatalog",
    GET_ADMIN_MENU_CATALOG: "getAdminMenuCatalog", // Alias
    SAVE_MENU_ITEM: "saveOrUpdateMenuItem",
    SAVE_OR_UPDATE_MENU_ITEM: "saveOrUpdateMenuItem", // Alias
    TOGGLE_MENU_ITEM: "toggleMenuItemStatus",
    TOGGLE_MENU_ITEM_STATUS: "toggleMenuItemStatus", // Alias
    DELETE_MENU_ITEM: "deleteMenuItem",
    GET_MENU_CATEGORIES: "getMenuCategories",
    SAVE_MENU_CATEGORY: "saveMenuCategory",
    DELETE_MENU_CATEGORY: "deleteMenuCategory",

    // Omni-Ingestion & Media
    BATCH_IMPORT_MENU: "batchImportMenuItems",
    BATCH_IMPORT_MENU_ITEMS: "batchImportMenuItems", // Alias
    PARSE_SPREADSHEET_BUFFER: "parseUploadedSpreadsheetBuffer",
    PARSE_UPLOADED_SPREADSHEET_BUFFER: "parseUploadedSpreadsheetBuffer", // Alias
    PROCESS_OCR_GEMINI: "processMenuOcrWithGemini",
    PROCESS_MENU_OCR_WITH_GEMINI: "processMenuOcrWithGemini", // Alias
    EXTRACT_MENU_URL: "extractMenuFromPublicUrl",
    EXTRACT_MENU_FROM_PUBLIC_URL: "extractMenuFromPublicUrl", // Alias
    UPLOAD_MENU_IMAGE: "uploadDishMediaImage", // Chuẩn hóa thành uploadDishMediaImage
    UPLOAD_DISH_MEDIA_IMAGE: "uploadDishMediaImage", // Alias
    UPLOAD_IMAGE_TO_MENU_DRIVE_FOLDER: "uploadDishMediaImage", // Alias tương thích ngược
    GET_MENU_TEMPLATE: "getMenuExcelTemplateStructure",
    GET_MENU_EXCEL_TEMPLATE: "getMenuExcelTemplateStructure", // Alias

    // Tài chính, P&L, Audit Logs
    GET_FINANCIAL_PL: "getFinancialPlSummary",
    GET_FINANCIAL_PL_SUMMARY: "getFinancialPlSummary", // Alias
    GET_SHIPPER_LEDGER: "getShipperCodHoldingLedger",
    GET_SHIPPER_COD_LEDGER: "getShipperCodHoldingLedger", // Alias
    GET_AUDIT_LOGS: "getFinancialAuditLogs",
    GET_FINANCIAL_AUDIT_LOGS: "getFinancialAuditLogs", // Alias

    // Mini CRM & Vòng Quay May Mắn
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
  })
});

/**
 * TỰ ĐỘNG DI TRÚ SCHEMA VÀO GOOGLE SHEETS (NON-DESTRUCTIVE AUTO-MIGRATION)
 * Tự động kiểm tra dòng Header, nếu phát hiện cột mới (ví dụ Cột Q: Loại Dịch Vụ)
 * sẽ tự động chèn thêm vào cuối bảng mà không làm xô lệch hoặc mất dữ liệu cũ.
 * 
 * @param {SpreadsheetApp.Spreadsheet} [optSs] - Bảng tính hiện hành
 * @returns {Object} Kết quả kiểm toán và di trú schema
 */
function syncDatabaseSchema(optSs) {
  var ss = optSs || SpreadsheetApp.getActiveSpreadsheet();
  var logs = [];

  try {
    // 1. Đồng bộ bảng DATA_ORDERS (17 cột chuẩn)
    var ordersSheet = ss.getSheetByName(T5_SSOT.SHEETS.ORDERS);
    var expectedOrderHeaders = [
      "Mã Đơn", "Thời Gian", "Trạng Thái", "Bước", "Họ Tên", "SĐT", "Địa Chỉ",
      "Cự Ly (km)", "Tiền Món", "Phí Ship Gốc", "Trợ Giá Ship", "Thực Thu Khách",
      "Phương Thức", "Tài Xế Phụ Trách", "Món Quà 0đ", "Ghi Chú Đơn", "Loại Dịch Vụ"
    ];

    if (!ordersSheet) {
      ordersSheet = ss.insertSheet(T5_SSOT.SHEETS.ORDERS);
      ordersSheet.appendRow(expectedOrderHeaders);
      ordersSheet.getRange(1, 1, 1, expectedOrderHeaders.length)
        .setBackground("#0f172a").setFontColor("#f8fafc").setFontWeight("bold");
      ordersSheet.setFrozenRows(1);
      logs.push("Khởi tạo mới bảng DATA_ORDERS với đầy đủ 17 cột chuẩn hóa.");
    } else {
      var currentOrderCols = ordersSheet.getLastColumn();
      if (currentOrderCols < expectedOrderHeaders.length) {
        var missingHeaders = expectedOrderHeaders.slice(currentOrderCols);
        ordersSheet.getRange(1, currentOrderCols + 1, 1, missingHeaders.length)
          .setValues([missingHeaders])
          .setBackground("#0f172a").setFontColor("#f8fafc").setFontWeight("bold");
        logs.push("Đã bổ sung an toàn " + missingHeaders.length + " cột mới vào DATA_ORDERS (" + missingHeaders.join(", ") + ").");
      }
    }

    // 2. Đồng bộ bảng DATA_MENU (13 cột Reverse-Pricing chuẩn)
    var menuSheet = ss.getSheetByName(T5_SSOT.SHEETS.MENU);
    var expectedMenuHeaders = [
      "Mã Món", "Tên Món Ăn", "Nhóm Phân Loại", "Giá App (Grab/Shopee)", "% Giảm D2C",
      "Giá Bán D2C Web", "Giá Vốn COGS", "Lợi Nhuận Ròng (LNR)", "Trạng Thái Bếp",
      "Mô Tả & Topping Kèm", "Đường Dẫn Hình Ảnh", "Mã Món Bán Kèm", "Tag Chiến Lược"
    ];

    if (!menuSheet) {
      menuSheet = ss.insertSheet(T5_SSOT.SHEETS.MENU);
      menuSheet.appendRow(expectedMenuHeaders);
      menuSheet.getRange(1, 1, 1, expectedMenuHeaders.length)
        .setBackground("#0f172a").setFontColor("#f8fafc").setFontWeight("bold");
      menuSheet.setFrozenRows(1);
      logs.push("Khởi tạo mới bảng DATA_MENU với đầy đủ 13 cột Reverse-Pricing.");
    } else {
      var currentMenuCols = menuSheet.getLastColumn();
      if (currentMenuCols < expectedMenuHeaders.length) {
        var missingMenuHeaders = expectedMenuHeaders.slice(currentMenuCols);
        menuSheet.getRange(1, currentMenuCols + 1, 1, missingMenuHeaders.length)
          .setValues([missingMenuHeaders])
          .setBackground("#0f172a").setFontColor("#f8fafc").setFontWeight("bold");
        logs.push("Đã bổ sung an toàn " + missingMenuHeaders.length + " cột mới vào DATA_MENU.");
      }
    }

    // 3. Đồng bộ bảng SYS_CATEGORIES (5 cột chuẩn)
    var catSheet = ss.getSheetByName(T5_SSOT.SHEETS.CATEGORIES);
    var expectedCatHeaders = ["Mã Danh Mục", "Icon", "Tên Danh Mục", "Slug D2C", "Trần Food Cost (%)"];
    if (!catSheet) {
      catSheet = ss.insertSheet(T5_SSOT.SHEETS.CATEGORIES);
      catSheet.appendRow(expectedCatHeaders);
      catSheet.getRange(1, 1, 1, expectedCatHeaders.length)
        .setBackground("#0f172a").setFontColor("#f8fafc").setFontWeight("bold");
      catSheet.setFrozenRows(1);
      logs.push("Khởi tạo mới bảng SYS_CATEGORIES với 5 cột chuẩn hóa.");
    }

    // 4. Đồng bộ bảng SYS_CONFIG (2 cột chuẩn Key - Value)
    var cfgSheet = ss.getSheetByName(T5_SSOT.SHEETS.CONFIG);
    if (!cfgSheet) {
      cfgSheet = ss.insertSheet(T5_SSOT.SHEETS.CONFIG);
      cfgSheet.appendRow(["Tham Số Cấu Hình", "Giá Trị", "Mô Tả Nghiệp Vụ"]);
      cfgSheet.getRange(1, 1, 1, 3)
        .setBackground("#0f172a").setFontColor("#f8fafc").setFontWeight("bold");
      cfgSheet.setFrozenRows(1);
      logs.push("Khởi tạo mới bảng SYS_CONFIG cấu hình động.");
    }

    // 5. Đồng bộ bảng DATA_REVIEWS (9 cột đánh giá xác thực Phase 5)
    var revSheet = ss.getSheetByName(T5_SSOT.SHEETS.REVIEWS);
    var expectedRevHeaders = ["Mã Đánh Giá", "Mã Đơn Hàng", "SĐT Khách", "Họ Tên", "Số Sao", "Nội Dung Đánh Giá", "Món Đánh Giá", "Thời Gian", "Trạng Thái"];
    if (!revSheet) {
      revSheet = ss.insertSheet(T5_SSOT.SHEETS.REVIEWS);
      revSheet.appendRow(expectedRevHeaders);
      revSheet.getRange(1, 1, 1, expectedRevHeaders.length)
        .setBackground("#0f172a").setFontColor("#f8fafc").setFontWeight("bold");
      revSheet.setFrozenRows(1);
      logs.push("Khởi tạo mới bảng DATA_REVIEWS đánh giá xác thực 9 cột.");
    }

    // 6. Đồng bộ bảng DATA_SHIPPER_LEDGER (10 cột sổ cái đội xe)
    var ldgSheet = ss.getSheetByName(T5_SSOT.SHEETS.SHIPPER_LEDGER);
    var expectedLdgHeaders = [
      "Mã Phiên Giao", "Thời Gian", "Mã Tài Xế", "Tên Tài Xế", "Số Điện Thoại",
      "Mã Đơn Hàng", "Tiền Cước Nhận (VND)", "Tiền Mặt COD Thu Hộ (VND)", "Trạng Thái Đối Soát COD", "Ghi Chú / Bằng Chứng Giao"
    ];
    if (!ldgSheet) {
      ldgSheet = ss.insertSheet(T5_SSOT.SHEETS.SHIPPER_LEDGER);
      ldgSheet.appendRow(expectedLdgHeaders);
      ldgSheet.getRange(1, 1, 1, expectedLdgHeaders.length)
        .setBackground("#0f172a").setFontColor("#f8fafc").setFontWeight("bold");
      ldgSheet.setFrozenRows(1);
      logs.push("Khởi tạo mới bảng DATA_SHIPPER_LEDGER sổ cái đội xe 10 cột.");
    }

    // 7. Đồng bộ bảng DATA_CUSTOMERS (14 cột Mini CRM)
    var custSheet = ss.getSheetByName(T5_SSOT.SHEETS.CUSTOMERS);
    var expectedCustHeaders = [
      "Mã Khách Hàng", "Số Điện Thoại", "Họ Tên", "Đơn Tháng Này", "Tháng Hiện Tại",
      "Danh Hiệu Tháng", "Gu Ăn Uống", "Huy Hiệu Gen Z", "Danh Hiệu Tháng Trước", "Điểm Tích Lũy",
      "Tổng Chi Tiêu Trọn Đời", "Tổng Đơn Trọn Đời", "Lượt Quay Còn Lại", "Ngày Cập Nhật"
    ];
    if (!custSheet) {
      custSheet = ss.insertSheet(T5_SSOT.SHEETS.CUSTOMERS);
      custSheet.appendRow(expectedCustHeaders);
      custSheet.getRange(1, 1, 1, expectedCustHeaders.length)
        .setBackground("#0f172a").setFontColor("#f8fafc").setFontWeight("bold");
      custSheet.setFrozenRows(1);
      logs.push("Khởi tạo mới bảng DATA_CUSTOMERS Mini CRM 14 cột.");
    }

    return {
      status: "success",
      code: 200,
      logs: logs,
      version: T5_SSOT.SYSTEM.VERSION
    };

  } catch (err) {
    Logger.log("⚠️ Lỗi syncDatabaseSchema: " + err.toString());
    return {
      status: "error",
      code: 500,
      message: "Lỗi đồng bộ cấu trúc cơ sở dữ liệu: " + err.message
    };
  }
}
/**
 * XUẤT TOÀN BỘ HỢP ĐỒNG HỆ THỐNG VÀ CẤU TRÚC SCHEMA ĐỘNG CHO FRONTEND
 * API: getSystemContract
 * Giúp Frontend tự động đồng bộ 100% cấu trúc cột, danh mục action, dịch vụ mới
 * mà không bao giờ cần phải chỉnh sửa thủ công code ở cả 2 đầu.
 * 
 * @param {Object} [payload] - Tham số yêu cầu từ Client
 * @returns {Object} Hợp đồng hệ thống chuẩn hóa JSON
 */
function getSystemContract(payload) {
  try {
    var cache = CacheService.getScriptCache();
    var cacheKey = "WARMED_SYSTEM_CONTRACT";
    var cachedData = cache.get(cacheKey);

    if (cachedData) {
      try {
        var parsedContract = JSON.parse(cachedData);
        return {
          status: "success",
          code: 200,
          cached: true,
          data: parsedContract
        };
      } catch (parseErr) {}
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // Nạp cấu hình động từ SYS_CONFIG
    var dynamicConfig = {};
    var configSheet = ss.getSheetByName(T5_SSOT.SHEETS.CONFIG);
    if (configSheet && configSheet.getLastRow() > 1) {
      var cfgData = configSheet.getRange(2, 1, configSheet.getLastRow() - 1, 2).getValues();
      for (var i = 0; i < cfgData.length; i++) {
        var k = String(cfgData[i][0] || "").trim().toUpperCase();
        var v = cfgData[i][1];
        if (k) {
          if (v === "true" || v === true) dynamicConfig[k] = true;
          else if (v === "false" || v === false) dynamicConfig[k] = false;
          else if (!isNaN(Number(v)) && String(v).trim() !== "") dynamicConfig[k] = Number(v);
          else dynamicConfig[k] = String(v !== undefined && v !== null ? v : "").trim();
        }
      }
    }

    var contractPayload = {
      system: T5_SSOT.SYSTEM,
      sheets: T5_SSOT.SHEETS,
      ordersSchema: T5_SSOT.ORDERS_SCHEMA,
      menuSchema: T5_SSOT.MENU_SCHEMA,
      categoriesSchema: T5_SSOT.CATEGORIES_SCHEMA,
      roles: T5_SSOT.ROLES,
      errorCodes: T5_SSOT.ERROR_CODES,
      configKeys: T5_SSOT.CONFIG_KEYS,
      steps: T5_SSOT.STEPS,
      services: T5_SSOT.SERVICES,
      actions: T5_SSOT.ACTIONS,
      dynamicConfig: dynamicConfig,
      synchronizedAt: Utilities.formatDate(new Date(), T5_SSOT.SYSTEM.TIMEZONE, "yyyy-MM-dd HH:mm:ss")
    };

    try {
      cache.put(cacheKey, JSON.stringify(contractPayload), 600); // Lưu đệm 10 phút
    } catch (cErr) {}

    return {
      status: "success",
      code: 200,
      cached: false,
      data: contractPayload
    };

  } catch (err) {
    return {
      status: "error",
      code: 500,
      message: "Lỗi xuất bản Hợp đồng hệ thống: " + err.toString()
    };
  }
}

/**
 * 2. BỘ THƯ VIỆN TIỆN ÍCH DÙNG CHUNG TOÀN NĂNG (T5_UTILS)
 * Hợp nhất toàn bộ các logic tính toán, khử trùng lặp code rác trên toàn bộ backend.
 */
var T5_UTILS = Object.freeze({
  /**
   * TÍNH TOÁN KHOẢNG CÁCH HAVERSINE TẠI MÁY CHỦ (SERVER-SIDE HAVERSINE)
   * 
   * @param {number} lat1 - Vĩ độ Bếp
   * @param {number} lon1 - Kinh độ Bếp
   * @param {number} lat2 - Vĩ độ Khách
   * @param {number} lon2 - Kinh độ Khách
   * @returns {number} Cự ly tính bằng kilomet (làm tròn 2 chữ số)
   */
  calculateHaversine: function(lat1, lon1, lat2, lon2) {
    var R = 6371; // Bán kính Trái Đất (km)
    var dLat = (lat2 - lat1) * (Math.PI / 180);
    var dLon = (lon2 - lon1) * (Math.PI / 180);
    
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
            
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round((R * c) * 100) / 100;
  },

  /**
   * LÀM SẠCH VÀ CHUYỂN ĐỔI CHUỖI TIỀN TỆ AN TOÀN TUYỆT ĐỐI (CHỐNG NAN)
   * 
   * @param {*} val - Giá trị thô từ ô Google Sheets
   * @returns {number} Số nguyên hợp lệ
   */
  cleanNumber: function(val) {
    if (val === null || val === undefined || val === "") return 0;
    if (typeof val === "number") return isNaN(val) ? 0 : val;

    var str = String(val).trim();
    var cleaned = str.replace(/[^0-9.-]+/g, "");
    var num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  },

  /**
   * PARSE NGÀY THÁNG ĐA ĐỊNH DẠNG CHUẨN MÚI GIỜ ASIA/HO_CHI_MINH (GMT+7)
   * 
   * @param {*} dateValue - Chuỗi ngày hoặc đối tượng Date
   * @returns {Date|null} Đối tượng Date hợp lệ
   */
  parseFlexibleDateVietnam: function(dateValue) {
    if (!dateValue) return null;
    if (dateValue instanceof Date) return dateValue;

    var str = String(dateValue).trim();
    if (!str) return null;

    // 1. Nhận diện ngày chuẩn Việt Nam DD/MM/YYYY hoặc DD-MM-YYYY
    var dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
    if (dmyMatch) {
      var day = parseInt(dmyMatch[1], 10);
      var month = parseInt(dmyMatch[2], 10) - 1;
      var year = parseInt(dmyMatch[3], 10);
      var hour = dmyMatch[4] ? parseInt(dmyMatch[4], 10) : 0;
      var minute = dmyMatch[5] ? parseInt(dmyMatch[5], 10) : 0;
      var second = dmyMatch[6] ? parseInt(dmyMatch[6], 10) : 0;

      var parsedDmy = new Date(year, month, day, hour, minute, second);
      if (!isNaN(parsedDmy.getTime())) return parsedDmy;
    }

    // 2. Nhận diện ISO YYYY-MM-DD
    var ymdMatch = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
    if (ymdMatch) {
      var yYear = parseInt(ymdMatch[1], 10);
      var yMonth = parseInt(ymdMatch[2], 10) - 1;
      var yDay = parseInt(ymdMatch[3], 10);
      var yHour = ymdMatch[4] ? parseInt(ymdMatch[4], 10) : 0;
      var yMinute = ymdMatch[5] ? parseInt(ymdMatch[5], 10) : 0;
      var ySecond = ymdMatch[6] ? parseInt(ymdMatch[6], 10) : 0;

      var parsedYmd = new Date(yYear, yMonth, yDay, yHour, yMinute, second);
      if (!isNaN(parsedYmd.getTime())) return parsedYmd;
    }

    var fallbackDate = new Date(str);
    if (!isNaN(fallbackDate.getTime())) return fallbackDate;

    return null;
  },

  /**
   * ĐỊNH DẠNG NGÀY THEO GIỜ VIỆT NAM YYYY-MM-DD
   */
  formatDateVn: function(dateObj) {
    if (!dateObj) return "";
    return Utilities.formatDate(dateObj, T5_SSOT.SYSTEM.TIMEZONE, "yyyy-MM-dd");
  },

  /**
   * XÓA CACHE TOÀN CỤC KHI CÓ BIẾN ĐỘNG CẤU HÌNH HOẶC DỮ LIỆU
   */
  invalidateGlobalCache: function() {
    try {
      var cache = CacheService.getScriptCache();
      cache.removeAll(["WARMED_SYS_CONFIG", "WARMED_SYSTEM_CONTRACT", "WARMED_MENU_CATALOG"]);
    } catch (e) {}
  }
});

/**
 * 3. HÀM CHUẨN HÓA THỰC THỂ ĐƠN HÀNG TOÀN NĂNG (UNIVERSAL ORDER NORMALIZER)
 * Sử dụng trực tiếp tại Backend cho mọi module để đồng nhất cấu trúc dữ liệu.
 * 
 * @param {Object} raw - Dữ liệu đơn thô từ Client hoặc dòng dữ liệu Google Sheets
 * @returns {Object} Thực thể đơn hàng chuẩn hóa SSOT
 */
function normalizeOrderEntity(raw) {
  if (!raw || typeof raw !== "object") raw = {};

  var orderCode = String(raw.orderCode || raw.orderId || raw.code || raw.id || "DH_TEMP").trim();
  var rawStatus = String(raw.status || raw.operationalStatus || raw.opsStatus || "RECEIVED").trim().toUpperCase();
  var stepVal = 0;

  if (raw.step !== undefined && raw.step !== null) {
    stepVal = Number(raw.step);
  } else if (rawStatus === "CANCELLED" || rawStatus === "HUY" || rawStatus === "ĐÃ HỦY") {
    stepVal = T5_SSOT.STEPS.CANCELLED;
  } else if (rawStatus === "COMPLETED" || rawStatus === "HOÀN THÀNH" || rawStatus === "ĐÃ GIAO") {
    stepVal = T5_SSOT.STEPS.COMPLETED;
  } else if (rawStatus === "DELIVERING" || rawStatus === "SHIPPING" || rawStatus === "ĐANG GIAO") {
    stepVal = T5_SSOT.STEPS.SHIPPING;
  } else if (rawStatus === "PACKED" || rawStatus === "READY" || rawStatus === "ĐÓNG GÓI") {
    stepVal = T5_SSOT.STEPS.PACKED;
  } else if (rawStatus === "COOKING" || rawStatus === "ĐANG NẤU") {
    stepVal = T5_SSOT.STEPS.COOKING;
  } else {
    stepVal = T5_SSOT.STEPS.WAIT_VERIFY;
  }

  var canonicalStatus = T5_SSOT.ORDER_STATUS.PENDING;
  var isExternalShipper = String(raw.shipperInfo || raw.shipper || "").indexOf("[") === 0 || Boolean(raw.isExternal);
  if (stepVal === T5_SSOT.STEPS.CANCELLED) canonicalStatus = T5_SSOT.ORDER_STATUS.CANCELLED;
  else if (stepVal === T5_SSOT.STEPS.COMPLETED) canonicalStatus = T5_SSOT.ORDER_STATUS.COMPLETED;
  else if (stepVal === T5_SSOT.STEPS.SHIPPING) canonicalStatus = isExternalShipper ? T5_SSOT.ORDER_STATUS.DISPATCHED_3PL : T5_SSOT.ORDER_STATUS.SHIPPING;
  else if (stepVal === T5_SSOT.STEPS.PACKED) canonicalStatus = T5_SSOT.ORDER_STATUS.READY_TO_SHIP;
  else if (stepVal === T5_SSOT.STEPS.COOKING) canonicalStatus = T5_SSOT.ORDER_STATUS.PREPARING;
  else canonicalStatus = T5_SSOT.ORDER_STATUS.PENDING;

  var rawMethod = String(raw.paymentMethod || raw.method || raw.payMethod || "COD").trim().toUpperCase();
  var isOnlinePaid = (rawMethod === "CK_VIETQR" || rawMethod === "VIETQR" || rawMethod === "BANK" || rawMethod === "MOMO");
  var paymentMethod = isOnlinePaid ? "VIETQR" : "COD";

  var subtotal = T5_UTILS.cleanNumber(raw.subtotal || raw.itemsTotal);
  var baseShipFee = T5_UTILS.cleanNumber(raw.shippingFee || raw.shipFee || raw.baseShipFee || T5_SSOT.SYSTEM.FINANCIAL_DEFAULTS.BASE_SHIP_FEE);
  var shippingSubsidy = T5_UTILS.cleanNumber(raw.shippingSubsidy || raw.subsidy);
  var customerShipFee = Math.max(0, baseShipFee - shippingSubsidy);
  var finalTotal = T5_UTILS.cleanNumber(raw.finalTotal || raw.totalAmount || (subtotal + customerShipFee));
  var collectFromCustomer = isOnlinePaid ? 0 : finalTotal;

  var serviceType = String(raw.serviceType || raw.service || T5_SSOT.SERVICES.FOOD_DELIVERY.code).trim().toUpperCase();

  return {
    orderCode: orderCode,
    orderId: orderCode, // Alias tương thích Frontend
    step: stepVal,
    status: canonicalStatus,
    serviceType: serviceType,
    customer: {
      name: String(raw.customerName || (raw.customer && raw.customer.name) || raw.name || "Khách Vãng Lai").trim(),
      phone: String(raw.customerPhone || (raw.customer && raw.customer.phone) || raw.phone || "").trim(),
      address: String(raw.customerAddress || (raw.customer && raw.customer.address) || raw.address || "Hòa Thành, Tây Ninh").trim(),
      distanceKm: Number(raw.distanceKm || (raw.customer && raw.customer.distanceKm) || 1.2)
    },
    payment: {
      method: paymentMethod,
      isOnlinePaid: isOnlinePaid,
      subtotal: subtotal,
      shippingFee: baseShipFee,
      shippingSubsidy: shippingSubsidy,
      customerShipFee: customerShipFee,
      finalTotal: finalTotal,
      collectFromCustomer: collectFromCustomer
    },
    logistics: {
      shipperInfo: String(raw.shipperInfo || raw.shipper || "").trim(),
      note: String(raw.note || "").trim()
    },
    items: Array.isArray(raw.items) ? raw.items : [],
    giftName: String(raw.giftName || (raw.gift && raw.gift.name) || "").trim(),
    createdAt: raw.createdAt || raw.timestamp || raw.time || Utilities.formatDate(new Date(), T5_SSOT.SYSTEM.TIMEZONE, "yyyy-MM-dd HH:mm:ss")
  };
}


/**
 * TÍNH TOÁN VOUCHER TRỢ GIÁ SHIP ĐỘNG THEO KHOẢNG CÁCH & LỢI NHUẬN RÒNG (BACKEND SSOT)
 * Thẩm định khả năng trợ giá ship dựa trên Lợi Nhuận Ròng thặng dư của giỏ hàng.
 * 
 * @param {Object} params - { subtotal, totalCogs, distanceKm, otherDiscount, config }
 * @returns {Object} Kết quả đánh giá Voucher
 */
function evaluateSmartShipVoucher(params) {
  params = params || {};
  var config = params.config || {};
  var subtotal = Number(params.subtotal) || 0;
  var totalCogs = Number(params.totalCogs);
  if (isNaN(totalCogs) || totalCogs < 0) {
    totalCogs = Math.round(subtotal * 0.40);
  }
  var distanceKm = Number(params.distanceKm) || 1.0;
  var otherDiscount = Number(params.otherDiscount) || 0;

  var isEnabled = config.PROMO_SMART_SHIP_VOUCHER_ENABLED !== false && String(config.PROMO_SMART_SHIP_VOUCHER_ENABLED) !== "false";
  var tier25Enabled = config.PROMO_TIER_25_ENABLED !== false && String(config.PROMO_TIER_25_ENABLED) !== "false";
  var tier50Enabled = config.PROMO_TIER_50_ENABLED !== false && String(config.PROMO_TIER_50_ENABLED) !== "false";
  var tier100Enabled = config.PROMO_TIER_100_ENABLED !== false && String(config.PROMO_TIER_100_ENABLED) !== "false";
  var upsellEnabled = config.PROMO_UPSELL_NUDGE_ENABLED !== false && String(config.PROMO_UPSELL_NUDGE_ENABLED) !== "false";

  var profitFloor = Number(config.PROMO_MIN_NET_PROFIT_FLOOR !== undefined ? config.PROMO_MIN_NET_PROFIT_FLOOR : 25000);
  var surplusRatio = Number(config.PROMO_SURPLUS_SHARE_RATIO !== undefined ? config.PROMO_SURPLUS_SHARE_RATIO : 0.7);
  var custRatePerKm = Number(config.SHIP_CUST_RATE_PER_KM || config.SHIPPING_RATE_CUSTOMER_PER_KM || 5000);
  var surgeMultiplier = Number(config.SHIP_SURGE_MULTIPLIER || 1.0);
  var minCustFee = Number(config.SHIP_BASE_FEE_CUST || config.SHIPPING_MIN_CUSTOMER_FEE || 5000);
  var maxPromoCapPct = Number(config.MAX_PROMO_CAP_PCT !== undefined ? config.MAX_PROMO_CAP_PCT : (config.MAX_PROMOTION_RATE !== undefined ? config.MAX_PROMOTION_RATE : 15));
  if (maxPromoCapPct > 0 && maxPromoCapPct < 1) maxPromoCapPct = maxPromoCapPct * 100;
  var masterFeePct = Number(config.MASTER_PLATFORM_FEE_PCT !== undefined ? config.MASTER_PLATFORM_FEE_PCT : 5.0);
  if (masterFeePct > 0 && masterFeePct < 1) masterFeePct = masterFeePct * 100;
  var taxHkdPct = Number(config.TAX_HKD_PCT !== undefined ? config.TAX_HKD_PCT : (config.TAX_RATE_HKD !== undefined ? config.TAX_RATE_HKD : 4.5));
  if (taxHkdPct > 0 && taxHkdPct < 1) taxHkdPct = taxHkdPct * 100;

  var billableKm = Math.max(1, Math.ceil(distanceKm));
  var shipFee = Math.max(minCustFee, Math.round(billableKm * custRatePerKm * surgeMultiplier));

  var masterFee = Math.round(subtotal * (masterFeePct / 100));
  var taxHkd = Math.round(subtotal * (taxHkdPct / 100));
  var cartNetProfit = Math.max(0, subtotal - totalCogs - masterFee - taxHkd);

  var profitAllow = Math.max(0, Math.round((cartNetProfit - profitFloor) * surplusRatio));
  var maxPromoAllowed = Math.round(subtotal * (maxPromoCapPct / 100));
  var capAllow = Math.max(0, maxPromoAllowed - otherDiscount);
  var maxShipDiscount = Math.min(shipFee, profitAllow, capAllow);

  var unlocked = false;
  var voucherCode = "";
  var tier = 0;
  var discountPct = 0;
  var discountAmount = 0;
  var title = "";
  var badgeText = "";

  if (isEnabled && subtotal > 0 && maxShipDiscount > 0) {
    if (tier100Enabled && maxShipDiscount >= shipFee) {
      unlocked = true;
      voucherCode = "SHIP_100";
      tier = 100;
      discountPct = 100;
      discountAmount = shipFee;
      title = "Freeship 100% Phí Vận Chuyển";
      badgeText = "TIỆC LỚN FREESHIP 100%";
    } else if (tier50Enabled && maxShipDiscount >= Math.round(shipFee * 0.5)) {
      unlocked = true;
      voucherCode = "SHIP_50";
      tier = 50;
      discountPct = 50;
      discountAmount = Math.round(shipFee * 0.5);
      title = "Giảm 50% Phí Vận Chuyển";
      badgeText = "TRỢ GIÁ SHIP 50%";
    } else if (tier25Enabled && maxShipDiscount >= Math.round(shipFee * 0.25)) {
      unlocked = true;
      voucherCode = "SHIP_25";
      tier = 25;
      discountPct = 25;
      discountAmount = Math.round(shipFee * 0.25);
      title = "Giảm 25% Phí Vận Chuyển";
      badgeText = "TRỢ GIÁ SHIP 25%";
    }
  }

  var nextTierInfo = null;
  if (isEnabled && upsellEnabled && tier < 100) {
    var targetTier = (tier === 0) ? (tier25Enabled ? 25 : (tier50Enabled ? 50 : 100)) :
                     (tier === 25) ? (tier50Enabled ? 50 : 100) : 100;
    var targetDiscount = Math.round(shipFee * (targetTier / 100));
    var neededNetProfit = Math.round(targetDiscount / (surplusRatio > 0 ? surplusRatio : 0.7)) + profitFloor;
    var netProfitGap = Math.max(0, neededNetProfit - cartNetProfit);
    var suggestedSpend = netProfitGap > 0 ? Math.ceil((netProfitGap / 0.65) / 5000) * 5000 : 0;
    if (suggestedSpend > 0) {
      nextTierInfo = {
        targetTier: targetTier,
        targetDiscount: targetDiscount,
        netProfitGap: netProfitGap,
        suggestedSpend: suggestedSpend,
        nudgeMessage: "Chọn thêm Topping / Nước uống (~" + suggestedSpend.toLocaleString("vi-VN") + "đ) để mở khóa ngay Voucher giảm " + targetTier + "% phí ship!"
      };
    }
  }

  return {
    enabled: isEnabled,
    unlocked: unlocked,
    voucherCode: voucherCode,
    tier: tier,
    discountPct: discountPct,
    discountAmount: discountAmount,
    title: title,
    badgeText: badgeText,
    shipFee: shipFee,
    cartNetProfit: cartNetProfit,
    profitFloor: profitFloor,
    profitAllow: profitAllow,
    capAllow: capAllow,
    maxShipDiscount: maxShipDiscount,
    nextTier: nextTierInfo
  };
}


var DEFAULT_PROMO_CAMPAIGNS = Object.freeze([
  {
    id: "CMP_SOLO_COMBO",
    name: "Đơn Đủ Bộ: 1 Món Chính + Topping + Nước",
    status: "ACTIVE",
    minMainDishes: 1,
    minToppings: 1,
    minDrinks: 1,
    minBoosterItems: 2,
    minSubtotal: 75000,
    minRetainedNetProfit: 28000,
    shipDiscountPct: 35,
    maxShipDiscount: 10000,
    freeBoosterMaxPrice: 15000,
    freeGiftType: "TOPPING_OR_DRINK",
    freeGiftDesc: "Tặng 1 Topping hoặc Nước uống (tối đa 15k, COGS <= 20%)",
    description: "Giảm 35% Phí Ship (tối đa 10k) hoặc tặng 1 Topping/Nước"
  },
  {
    id: "CMP_DUO_FEAST",
    name: "Combo Nhóm 2 Người: 2 Món Chính + Topping/Nước",
    status: "ACTIVE",
    minMainDishes: 2,
    minToppings: 0,
    minDrinks: 0,
    minBoosterItems: 2,
    minSubtotal: 135000,
    minRetainedNetProfit: 52000,
    shipDiscountPct: 70,
    maxShipDiscount: 15000,
    freeBoosterMaxPrice: 12000,
    freeGiftType: "TOPPING",
    freeGiftDesc: "Tặng kèm 1 Topping tươi ngon",
    description: "Giảm 50% - 70% Phí Ship (tối đa 15k) + Tặng 1 Topping"
  },
  {
    id: "CMP_PARTY_3PLUS",
    name: "Đại Tiệc Nhóm 3+ Người: 3 Món Chính + Topping/Nước",
    status: "ACTIVE",
    minMainDishes: 3,
    minToppings: 0,
    minDrinks: 0,
    minBoosterItems: 3,
    minSubtotal: 199000,
    minRetainedNetProfit: 75000,
    shipDiscountPct: 100,
    maxShipDiscount: 20000,
    freeBoosterMaxPrice: 25000,
    freeGiftType: "DRINK_AND_TOPPING",
    freeGiftDesc: "Tặng Free 1 Nước uống & 1 Topping",
    description: "FREESHIP 100% (tối đa 20k) + Tặng Free 1 Nước uống & 1 Topping"
  }
]);

function evaluateOrderPromoCampaigns(params) {
  params = params || {};
  var config = params.config || {};
  var items = Array.isArray(params.items) ? params.items : (Array.isArray(params.cartItems) ? params.cartItems : []);
  var subtotal = Number(params.subtotal) || 0;
  var totalCogs = Number(params.totalCogs);
  var distanceKm = Number(params.distanceKm) || 1.8;
  var otherDiscount = Number(params.otherDiscount) || 0;

  var mainDishesCount = 0;
  var toppingsCount = 0;
  var drinksCount = 0;
  var calcSubtotal = 0;
  var calcCogs = 0;

  for (var i = 0; i < items.length; i++) {
    var it = items[i];
    if (it.isGift) continue;
    var q = Number(it.quantity || it.qty || 1);
    var p = Number(it.price || it.d2cPrice || 0);
    var c = Number(it.cogs || it.costPrice || (p * 0.40));
    calcSubtotal += (p * q);
    calcCogs += (c * q);

    var cat = String(it.category || it.catId || it.cat || "").toUpperCase();
    var dId = String(it.dishId || it.id || it.code || "").toUpperCase();
    var name = String(it.name || "").toLowerCase();
    var role = String(it.role || it.roleTag || "").toUpperCase();

    var isDrink = cat.indexOf("NUOC") !== -1 || cat.indexOf("DRINK") !== -1 || cat.indexOf("BEVERAGE") !== -1 || 
                  dId.indexOf("NUOC_") === 0 || name.indexOf("nước") !== -1 || name.indexOf("trà") !== -1 || 
                  name.indexOf("cà phê") !== -1 || name.indexOf("pepsi") !== -1 || name.indexOf("coca") !== -1;

    var isTopping = cat.indexOf("TOPPING") !== -1 || dId.indexOf("TOP") === 0 || (role === "BOOSTER" && !isDrink);

    if (isDrink) drinksCount += q;
    else if (isTopping) toppingsCount += q;
    else if (p >= 30000 || role === "CORE" || role === "TRAFFIC" || cat.indexOf("MI") !== -1 || cat.indexOf("COM") !== -1) mainDishesCount += q;
    else toppingsCount += q;
  }

  if (subtotal === 0) subtotal = calcSubtotal;
  if (isNaN(totalCogs) || totalCogs <= 0) totalCogs = calcCogs > 0 ? calcCogs : Math.round(subtotal * 0.40);
  var boosterItemsCount = toppingsCount + drinksCount;

  var isMasterEnabled = config.PROMO_MODULE_MASTER_ENABLED !== false && String(config.PROMO_MODULE_MASTER_ENABLED) !== "false";
  var masterFeePct = Number(config.MASTER_PLATFORM_FEE_PCT !== undefined ? config.MASTER_PLATFORM_FEE_PCT : 5.0);
  var taxHkdPct = Number(config.TAX_HKD_PCT !== undefined ? config.TAX_HKD_PCT : (config.TAX_RATE_HKD !== undefined ? config.TAX_RATE_HKD : 4.5));
  var maxPromoCapPct = Number(config.MAX_PROMO_CAP_PCT !== undefined ? config.MAX_PROMO_CAP_PCT : (config.MAX_PROMOTION_RATE !== undefined ? config.MAX_PROMOTION_RATE : 15));
  if (maxPromoCapPct > 0 && maxPromoCapPct < 1) maxPromoCapPct = maxPromoCapPct * 100;

  var custRatePerKm = Number(config.SHIP_CUST_RATE_PER_KM || config.SHIPPING_RATE_CUSTOMER_PER_KM || 5000);
  var surgeMultiplier = Number(config.SHIP_SURGE_MULTIPLIER || 1.0);
  var minCustFee = Number(config.SHIP_BASE_FEE_CUST || config.SHIPPING_MIN_CUSTOMER_FEE || 5000);
  var billableKm = Math.max(1, Math.ceil(distanceKm));
  var shipFee = Math.max(minCustFee, Math.round(billableKm * custRatePerKm * surgeMultiplier));

  var masterFee = Math.round(subtotal * (masterFeePct / 100));
  var taxHkd = Math.round(subtotal * (taxHkdPct / 100));
  var lnrBefore = Math.max(0, subtotal - totalCogs - masterFee - taxHkd);

  var campaigns = Array.isArray(params.campaigns) && params.campaigns.length > 0 
      ? params.campaigns 
      : (Array.isArray(config.promoCampaigns) ? config.promoCampaigns : DEFAULT_PROMO_CAMPAIGNS);

  var activeResults = [];
  var bestCampaign = null;
  var primaryUpsellHint = "";

  if (isMasterEnabled && subtotal > 0) {
    var sortedCampaigns = campaigns.slice().sort(function(a, b) {
      return (b.minSubtotal || 0) - (a.minSubtotal || 0);
    });

    for (var cIdx = 0; cIdx < sortedCampaigns.length; cIdx++) {
      var cmp = sortedCampaigns[cIdx];
      if (cmp.status === "PAUSED" || cmp.status === false) continue;

      var meetsMains = mainDishesCount >= (cmp.minMainDishes || 0);
      var meetsToppings = toppingsCount >= (cmp.minToppings || 0);
      var meetsDrinks = drinksCount >= (cmp.minDrinks || 0);
      var meetsBoosters = boosterItemsCount >= (cmp.minBoosterItems || 0);
      var meetsSubtotal = subtotal >= (cmp.minSubtotal || 0);

      var isConditionsMet = meetsMains && meetsToppings && meetsDrinks && meetsBoosters && meetsSubtotal;

      var retainedFloor = Number(cmp.minRetainedNetProfit || 25000);
      var surplusProfit = Math.max(0, lnrBefore - retainedFloor);
      var profitShare = Math.round(surplusProfit * 0.65);
      var promoCap = Math.max(0, Math.round(subtotal * (maxPromoCapPct / 100)) - otherDiscount);
      var maxFreeBudget = Math.min(profitShare, promoCap);

      var targetShipDiscount = Math.round(shipFee * ((cmp.shipDiscountPct || 0) / 100));
      var allowedShipDiscount = Math.min(targetShipDiscount, (cmp.maxShipDiscount || shipFee), maxFreeBudget);

      var giftCogsCost = Math.round((cmp.freeBoosterMaxPrice || 0) * 0.20);
      var remBudgetForGift = Math.max(0, maxFreeBudget - allowedShipDiscount);
      var isGiftAwarded = (giftCogsCost > 0 && remBudgetForGift >= giftCogsCost && cmp.freeGiftType);

      var isUnlocked = isConditionsMet && (allowedShipDiscount > 0 || isGiftAwarded);

      var hint = "";
      if (!isUnlocked) {
        var hints = [];
        if (!meetsMains) hints.push("thêm " + (cmp.minMainDishes - mainDishesCount) + " Món Chính");
        if (!meetsBoosters && (cmp.minBoosterItems || 0) > boosterItemsCount) hints.push("thêm " + (cmp.minBoosterItems - boosterItemsCount) + " Topping/Nước");
        else {
          if (!meetsToppings) hints.push("thêm " + (cmp.minToppings - toppingsCount) + " Topping");
          if (!meetsDrinks) hints.push("thêm " + (cmp.minDrinks - drinksCount) + " Nước uống");
        }
        if (!meetsSubtotal) {
          var gapMoney = Math.ceil((cmp.minSubtotal - subtotal) / 1000) * 1000;
          hints.push("mua thêm " + gapMoney.toLocaleString("vi-VN") + "đ");
        }
        hint = hints.length > 0 ? ("Chọn " + hints.join(", ") + " để mở khóa: " + cmp.name) : "";
      }

      var resItem = {
        campaignId: cmp.id,
        name: cmp.name,
        unlocked: isUnlocked,
        meetsConditions: isConditionsMet,
        shipDiscountPct: cmp.shipDiscountPct || 0,
        shipDiscountAmount: allowedShipDiscount,
        freeGiftAwarded: isGiftAwarded,
        freeGiftType: isGiftAwarded ? cmp.freeGiftType : null,
        freeGiftDesc: isGiftAwarded ? cmp.freeGiftDesc : null,
        maxFreeBudget: maxFreeBudget,
        lnrBefore: lnrBefore,
        upsellHint: hint
      };

      activeResults.push(resItem);

      if (isUnlocked && !bestCampaign) bestCampaign = resItem;
      if (!primaryUpsellHint && hint) primaryUpsellHint = hint;
    }
  }

  return {
    enabled: isMasterEnabled,
    subtotal: subtotal,
    totalCogs: totalCogs,
    lnrBefore: lnrBefore,
    shipFee: shipFee,
    cartSummary: {
      mainDishes: mainDishesCount,
      toppings: toppingsCount,
      drinks: drinksCount,
      boosterItems: boosterItemsCount
    },
    campaigns: activeResults,
    bestCampaign: bestCampaign,
    appliedCampaign: bestCampaign ? { id: bestCampaign.campaignId, name: bestCampaign.name, minRetainedNetProfit: bestCampaign.minRetainedNetProfit } : null,
    unlocked: Boolean(bestCampaign && bestCampaign.unlocked),
    primaryUpsellHint: primaryUpsellHint,
    appliedDiscount: bestCampaign ? bestCampaign.shipDiscountAmount : 0,
    shipDiscount: bestCampaign ? bestCampaign.shipDiscountAmount : 0,
    appliedGift: (bestCampaign && bestCampaign.freeGiftAwarded) ? bestCampaign.freeGiftDesc : null,
    giftReward: (bestCampaign && bestCampaign.freeGiftAwarded) ? { type: bestCampaign.freeGiftType, desc: bestCampaign.freeGiftDesc } : null
  };
}

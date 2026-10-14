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
    VERSION: "v3.5.20261002",
    BRAND_NAME: "Mì Trộn Thím 5 & LongHoaFood Master",
    TIMEZONE: "Asia/Ho_Chi_Minh",
    SUPER_ADMIN_EMAIL: "haiau2205@gmail.com",
    STORE_COORDS: Object.freeze({
      LAT: 11.285267,
      LNG: 106.133347,
      GPS_STRING: "11.285267,106.133347",
      MAPS_URL: "https://www.google.com/maps/dir/?api=1&destination=11.285267,106.133347"
    }),
    FINANCIAL_DEFAULTS: Object.freeze({
      BASE_SHIP_FEE: 12000,
      BASE_DISTANCE_KM: 2.0,
      EXTRA_FEE_PER_KM: 4500,
      MAX_PROMOTION_RATE: 0.15,
      TAX_RATE_HKD: 0.045,
      PLATFORM_MASTER_FEE: 0.05,
      MAX_COD_HOLDING_PER_SHIPPER: 300000,
      MIN_AOV_LUCKY_WHEEL: 79000,
      MAX_WHEEL_BUDGET_RATE: 0.05
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
    CRM_USERS: "CRM_USERS",
    AUDIT_LOGS: "DATA_AUDIT_LOGS",
    WHEEL_VOUCHERS: "WHEEL_VOUCHERS",
    WHEEL_LOGS: "DATA_WHEEL_LOGS"
  }),

  ORDERS_SCHEMA: Object.freeze({
    COL_ORDER_CODE: 0,       // Cột A: Mã Đơn
    COL_TIME: 1,             // Cột B: Thời Gian
    COL_STATUS: 2,           // Cột C: Trạng Thái Vận Hành
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

  STEPS: Object.freeze({
    WAIT_VERIFY: 0,          // Chờ xác minh đơn COD
    COOKING: 2,              // Bếp đang chế biến
    PACKED: 2.5,             // Đã đóng gói, chờ tài xế
    SHIPPING: 3,             // Đang giao trên đường
    COMPLETED: 4,            // Giao thành công, hoàn tất đơn
    CANCELLED: -1            // Đơn hủy
  }),

  SERVICES: Object.freeze({
    FOOD_DELIVERY: { code: "FOOD_DELIVERY", label: "Giao Món Ăn Bếp Thím 5", prefix: "DH" },
    RIDE_HAILING: { code: "RIDE_HAILING", label: "Chở Khách Đất Thánh Tây Ninh", prefix: "RIDE" },
    FAST_EXPRESS: { code: "FAST_EXPRESS", label: "Giao Hàng Siêu Tốc Hỏa Tốc", prefix: "SHIP" }
  }),

  ACTIONS: Object.freeze({
    GET_SYSTEM_CONTRACT: "getSystemContract",
    PING: "ping",
    HEALTH_CHECK: "healthCheck",
    VERIFY_ADMIN_ROLE: "verifyAdminRole",
    VERIFY_SUPER_ADMIN_TOTP: "verifySuperAdminTotp",
    GET_TOTP_SETUP_QR: "getTotpSetupQrData",
    SEND_EMERGENCY_OTP: "sendEmergencyBackupOtpToEmail",
    GET_SYSTEM_CONFIG: "getSystemDynamicConfig",
    SAVE_SYSTEM_CONFIG: "saveSystemDynamicConfig",
    TOGGLE_STORE_STATUS: "toggleStoreStatus",
    GET_STORE_STATUS: "getStoreStatus",
    CREATE_D2C_ORDER: "createD2COrder",
    GET_ORDER_TRACKING: "getOrderTracking",
    GET_KITCHEN_ORDERS: "getKitchenKdsOrders",
    KITCHEN_UPDATE_STATUS: "kitchenUpdateStatus",
    KITCHEN_ASSIGN_SHIPPER: "kitchenAssignShipper",
    KITCHEN_SETTLE_HANDOVER: "kitchenSettleHandover",
    GET_SHIPPER_ORDERS: "getShipperOrders",
    SHIPPER_VERIFY_COD: "shipperVerifyCodOrderSuccess",
    SHIPPER_UPDATE_STEP: "shipperUpdateStep",
    SHIPPER_RELEASE_ORDER: "shipperReleaseOrder",
    GET_ACTIVE_SHIPPERS: "getActiveShippersList",
    SAVE_SHIPPER: "saveOrUpdateShipper",
    TOGGLE_SHIPPER: "toggleShipperStatus",
    GET_ADMIN_MENU: "getAdminMenuCatalog",
    SAVE_MENU_ITEM: "saveOrUpdateMenuItem",
    TOGGLE_MENU_ITEM: "toggleMenuItemStatus",
    DELETE_MENU_ITEM: "deleteMenuItem",
    BATCH_IMPORT_MENU: "batchImportMenuItems",
    PARSE_SPREADSHEET_BUFFER: "parseUploadedSpreadsheetBuffer",
    PROCESS_OCR_GEMINI: "processMenuOcrWithGemini",
    EXTRACT_MENU_URL: "extractMenuFromPublicUrl",
    UPLOAD_MENU_IMAGE: "uploadImageToMenuDriveFolder",
    GET_MENU_TEMPLATE: "getMenuExcelTemplateStructure",
    GET_FINANCIAL_PL: "getFinancialPlSummary",
    GET_SHIPPER_LEDGER: "getShipperCodHoldingLedger",
    GET_AUDIT_LOGS: "getFinancialAuditLogs",
    GET_CUSTOMER_PROFILE: "getCustomerProfile",
    GET_PUBLIC_WHEEL_CONFIG: "getPublicWheelConfig",
    SPIN_LUCKY_WHEEL: "spinLuckyWheel",
    UPDATE_WHEEL_CONFIG: "updateWheelConfig",
    REDEEM_GIFT_TOKEN: "redeemGiftToken",
    LOG_WHEEL_REWARD: "logWheelRewardTransaction"
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

  var canonicalStatus = "RECEIVED";
  if (stepVal === T5_SSOT.STEPS.CANCELLED) canonicalStatus = "CANCELLED";
  else if (stepVal === T5_SSOT.STEPS.COMPLETED) canonicalStatus = "COMPLETED";
  else if (stepVal === T5_SSOT.STEPS.SHIPPING) canonicalStatus = "DELIVERING";
  else if (stepVal === T5_SSOT.STEPS.PACKED) canonicalStatus = "PACKED";
  else if (stepVal === T5_SSOT.STEPS.COOKING) canonicalStatus = "COOKING";
  else canonicalStatus = "RECEIVED";

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

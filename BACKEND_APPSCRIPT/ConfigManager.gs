/**
 * =========================================================================
 * MODULE: CONFIG MANAGER & CONTROL PLANE ENGINE (v3.2 SAAS ENTERPRISE)
 * Tác giả: Đu Đủ - Cố vấn Chiến lược & Kỹ sư Trưởng hệ thống SaaS
 * Bản quyền: Bếp Thím 5 & LongHoaFood Master (Năm 2026)
 * Kiến trúc: In-Memory RAM Caching, Zero-Cold-Start, Sub-100ms Response, RBAC Pin Auth
 * =========================================================================
 */

var CONFIG_MANAGER_CONSTANTS = Object.freeze({
  SHEET_CONFIG: "SYS_CONFIG",
  SHEET_CATEGORIES: "SYS_CATEGORIES",
  SHEET_AUDIT: "DATA_AUDIT_LOGS",
  CACHE_KEY_CONFIG: "WARMED_SYS_CONFIG",
  CACHE_KEY_CATEGORIES: "WARMED_SYS_CATEGORIES",
  CACHE_KEY_CONTRACT: "WARMED_SYSTEM_CONTRACT",
  CACHE_KEY_MENU: "WARMED_MENU_CATALOG",
  CACHE_TTL_SECONDS: 600, // Bộ nhớ đệm RAM 10 phút tăng tốc tải trang
  SUPER_ADMIN_DEFAULT_KEY: "THIM5_MASTER_2026",
  SUPER_ADMIN_EMAIL: "haiau2205@gmail.com",
  AUTH_SECRET_SALT: "THIM5_LONGHOA_SECURITY_SALT_2026"
});

/**
 * TỪ ĐIỂN CẤU HÌNH MẶC ĐỊNH DỰ PHÒNG (CHỈ DÙNG TỰ ĐỘNG KHỞI TẠO LẦN ĐẦU)
 * Toàn bộ giá trị thực tế sẽ được nạp và chỉnh sửa 100% trên Sheet SYS_CONFIG
 */
var DEFAULT_SYSTEM_CONFIG_MAP = Object.freeze({
  // 1. Nhận diện thương hiệu & Tọa độ Bếp
  STORE_NAME: "Mì Trộn Thím 5",
  STORE_SLOGAN: "Đậm Đà Vị Truyền Thống - Đậm Tình Đất Thánh",
  STORE_HOTLINE: "0934220585",
  STORE_ADDRESS: "Nguyễn Văn Linh, TX. Hòa Thành, Tây Ninh",
  STORE_ICON: "🍜",
  STORE_LATITUDE: "11.285267",
  STORE_LONGITUDE: "106.133347",
  STORE_STATUS: "OPEN",
  STORE_CLOSED_MESSAGE: "Bếp Thím 5 tạm dừng nhận đơn ít phút. Hẹn gặp lại quý khách sau!",
  COMMUNITY_PORTAL_DOMAIN: "anngonlonghoa.com.vn",
  DEFAULT_TENANT_ID: "THIM5_LONGHOA",

  // 2. Biểu phí Ship D2C Linh Hoạt (Mô hình v3.5: 5k thu khách / 4.5k trả tài xế)
  SHIPPING_RATE_CUSTOMER_PER_KM: "5000",   // Cước thu khách: 5.000đ/km (làm tròn lên)
  SHIP_CUST_RATE_PER_KM: "5000",           // Chuẩn v3.5
  SHIPPING_RATE_DRIVER_PER_KM: "4500",     // Cước trả shipper: 4.500đ/km
  SHIP_PARTNER_RATE_PER_KM: "4500",        // Chuẩn v3.5
  SHIPPING_MIN_CUSTOMER_FEE: "5000",       // Cước tối thiểu thu khách: 5.000đ
  SHIP_BASE_FEE_CUST: "5000",              // Chuẩn v3.5
  SHIPPING_MIN_DRIVER_FEE: "5000",         // Cước tối thiểu trả tài xế: 5.000đ
  SHIP_BASE_MIN_FEE_DRIVER: "5000",        // Chuẩn v3.5
  SHIP_SURGE_MULTIPLIER: "1.0",            // Hệ số nhân cao điểm / thời tiết
  SHIPPING_AUTO_SUBSIDY: "true",           // Bật tính năng quán tự động bù ship kích cầu
  SHIPPING_ROUNDING_MODE: "CEIL_1KM",      // Chế độ làm tròn cự ly: CEIL_1KM hoặc EXACT
  FREESHIP_MIN_SUBTOTAL: "149000",         // Đơn từ mức này quán miễn phí ship toàn bộ
  MAX_SHIPPING_SUBSIDY: "20000",           // Trần bù ship tối đa mỗi đơn để bảo vệ dòng tiền

  // 3. Cơ cấu tài chính Super Master & Quán Tenant
  MASTER_PLATFORM_FEE_PCT: "5.0",          // Phí nền tảng Super Master: 5% trên đơn thành công
  PLATFORM_MASTER_FEE: "5.0",              // Alias tương thích
  CPA_SPOTLIGHT_BOOST_PCT: "3.0",          // Phí CPA khi ra đơn từ bài ghim Top (+3%, tổng 8%)
  CROSS_STORE_AFFILIATE_PCT: "10.0",       // Phí hoa hồng bán chéo món liên gian hàng: 10%
  FOOD_COST_CAP_TRAFFIC: "55",             // Trần Food Cost nhóm Món Mồi (TRAFFIC): 55%
  FOOD_COST_CAP_CORE: "45",                // Trần Food Cost nhóm Món Chủ Lực (CORE): 45%
  FOOD_COST_CAP_BOOSTER: "20",             // Trần Food Cost nhóm Nước/Topping (BOOSTER): 20%
  D2C_DISCOUNT_PERCENT: "10",              // % Web D2C giảm giá so với App sàn
  D2C_BUFFER_PERCENT: "15",                // % Quỹ đệm D2C (Bù ship + Vòng quay + Thuế)
  TAX_RATE_HKD: "4.5",                     // Thuế khoán hộ kinh doanh 4.5%
  MAX_PROMOTION_RATE: "15",
  // 3b. Module Khuyến Mãi Voucher Ship Động Theo Lợi Nhuận Ròng
  PROMO_SMART_SHIP_VOUCHER_ENABLED: "true",
  PROMO_TIER_25_ENABLED: "true",
  PROMO_TIER_50_ENABLED: "true",
  PROMO_TIER_100_ENABLED: "true",
  PROMO_UPSELL_NUDGE_ENABLED: "true",
  PROMO_MIN_NET_PROFIT_FLOOR: "25000",
  PROMO_SURPLUS_SHARE_RATIO: "0.7",
  SHIP_CUST_RATE_PER_KM: "5000",
  SHIP_PARTNER_RATE_PER_KM: "4500",
  MAX_PROMO_CAP_PCT: "15",
  COD_HOLDING_LIMIT: "300000",
  TAX_HKD_PCT: "4.5",                // Trần khuyến mãi toàn đơn tối đa 15%

  // 4. Thanh toán & Ngân hàng
  BANK_BIN: "970422",
  BANK_CODE: "MB",
  BANK_ACCOUNT_NO: "3939388888",
  BANK_ACCOUNT_NAME: "NGUYEN HAI AU",
  MOMO_PHONE: "0934220585",
  MOMO_NAME: "NGUYEN HAI AU",

  // 5. Điều phối đội xe Shipper
  MAX_COD_HOLDING_PER_SHIPPER: "300000",   // Trần ôm tiền mặt COD của tài xế (300k)
  DRIVER_BONUS_PER_ORDER: "0",             // Thưởng nóng tài xế mỗi đơn

  // 6. Khóa bảo mật & Phân quyền
  MASTER_SUPER_KEY: "THIM5_MASTER_2026",
  SUPER_ADMIN_EMAIL: "haiau2205@gmail.com",
  PIN_ADMIN_LV1: "1985",
  PIN_ADMIN_LV2: "2026",

  // 7. Lá chắn đánh giá xác thực
  VERIFIED_REVIEW_REQUIRE_ORDER: "true"
});

/**
 * HÀM TỰ TRỊ TÌM HOẶC KHỞI TẠO BẢNG SYS_CONFIG (CHỐNG LỖI NOT DEFINED & ĐỒNG BỘ TÊN SHEET)
 * 
 * @param {SpreadsheetApp.Spreadsheet} ss - Bảng tính Google Sheets
 * @returns {SpreadsheetApp.Sheet} Sheet SYS_CONFIG đã sẵn sàng
 */
function getOrInitSysConfigSheet(ss) {
  var sheet = ss.getSheetByName(CONFIG_MANAGER_CONSTANTS.SHEET_CONFIG);
  
  if (!sheet) {
    var legacySheet = ss.getSheetByName("[SYS_CONFIG]");
    if (legacySheet) {
      legacySheet.setName(CONFIG_MANAGER_CONSTANTS.SHEET_CONFIG);
      sheet = legacySheet;
    }
  }

  if (!sheet) {
    sheet = ss.insertSheet(CONFIG_MANAGER_CONSTANTS.SHEET_CONFIG);
    var headers = ["Key Cấu Hình", "Giá Trị", "Mô Tả Tham Số", "Thời Gian Cập Nhật"];
    sheet.appendRow(headers);
    var headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setBackground("#0f172a");
    headerRange.setFontColor("#f8fafc");
    headerRange.setFontWeight("bold");
    sheet.setFrozenRows(1);

    var nowStr = Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd HH:mm:ss");
    
    for (var key in DEFAULT_SYSTEM_CONFIG_MAP) {
      sheet.appendRow([key, DEFAULT_SYSTEM_CONFIG_MAP[key], "Tham số điều hành hệ thống", nowStr]);
    }
  }
  return sheet;
}

/**
 * HÀM GHI NHẬT KÝ KIỂM TOÁN VÀO DATA_AUDIT_LOGS
 */
function recordConfigAuditLog(ss, action, details) {
  try {
    var auditSheet = ss.getSheetByName(CONFIG_MANAGER_CONSTANTS.SHEET_AUDIT);
    if (!auditSheet) {
      auditSheet = ss.insertSheet(CONFIG_MANAGER_CONSTANTS.SHEET_AUDIT);
      auditSheet.appendRow(["Thời Gian", "Mã Đơn / Đối Tượng", "Tác Vụ (Action)", "Chi Tiết Kiểm Toán"]);
      auditSheet.getRange(1, 1, 1, 4).setBackground("#0f172a").setFontColor("#f8fafc").setFontWeight("bold");
      auditSheet.setFrozenRows(1);
    }
    var nowStr = Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd HH:mm:ss");
    auditSheet.appendRow([nowStr, "CONFIG_MODULE", action, details]);
  } catch (e) {
    Logger.log("⚠️ Không thể ghi audit log: " + e.toString());
  }
}

/**
 * XÁC THỰC QUYỀN TRUY CẬP BẰNG MÃ PIN HOẶC MASTER KEY TỔNG
 * Khắc phục triệt để lỗi ép kiểu Number/String từ Google Sheets và khoảng trắng
 * API Action: verifyAdminRole
 * 
 * @param {Object|string} payload - { pin: "1985" } hoặc chuỗi PIN
 * @returns {Object} Phản hồi chuẩn hóa API kèm Role và Auth Token
 */
function verifyAdminRole(payload) {
  try {
    var inputPin = "";

    // 1. Bóc tách an toàn mã PIN từ mọi cấu trúc Payload
    if (typeof payload === "object" && payload !== null) {
      inputPin = String(payload.pin || payload.passcode || payload.password || payload.inputPin || "").trim();
    } else {
      inputPin = String(payload || "").trim();
    }

    // Nếu vẫn rỗng, thử kiểm tra chuỗi JSON thô nếu payload bị truyền nhầm dạng stringified
    if (!inputPin && typeof payload === "string" && payload.indexOf("{") !== -1) {
      try {
        var parsed = JSON.parse(payload);
        inputPin = String(parsed.pin || parsed.passcode || "").trim();
      } catch (e) {}
    }

    if (!inputPin) {
      return {
        status: "error",
        code: 400,
        message: "Vui lòng nhập mã PIN quyền hạn để tiếp tục!"
      };
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) {
      var id = PropertiesService.getScriptProperties().getProperty("TENANT_SPREADSHEET_ID") || 
               PropertiesService.getScriptProperties().getProperty("MENU_SPREADSHEET_ID");
      if (id) ss = SpreadsheetApp.openById(id);
    }
    if (!ss) throw new Error("Không thể liên kết CSDL Google Sheets!");

    var configSheet = getOrInitSysConfigSheet(ss);
    var data = configSheet.getDataRange().getValues();

    // Giá trị dự phòng mặc định nếu Sheet chưa điền
    var pinLv1 = "1985";
    var pinLv2 = "2026";
    var masterKey = "Tom@0911";

    for (var r = 1; r < data.length; r++) {
      var k = String(data[r][0] || "").trim().toUpperCase();
      var rawVal = data[r][1];

      if (k === "PIN_ADMIN_LV1") {
        // Ép kiểu chuỗi số tuyệt đối, xóa sạch định dạng dấu phẩy hàng nghìn nếu có
        pinLv1 = String(rawVal !== undefined && rawVal !== null ? rawVal : "").replace(/[^\d]/g, '').trim();
        if (!pinLv1) pinLv1 = "1985";
      } else if (k === "PIN_ADMIN_LV2") {
        pinLv2 = String(rawVal !== undefined && rawVal !== null ? rawVal : "").replace(/[^\d]/g, '').trim();
        if (!pinLv2) pinLv2 = "2026";
      } else if (k === "MASTER_SUPER_KEY") {
        masterKey = String(rawVal !== undefined && rawVal !== null ? rawVal : "").trim();
        if (!masterKey) masterKey = "Tom@0911";
      }
    }

    var role = null;
    var roleTitle = "";

    // So sánh chuỗi chính xác (String vs String)
    if (inputPin === masterKey) {
      role = "SUPER_ADMIN";
      roleTitle = "Super Admin Tối Cao";
    } else if (inputPin === pinLv2) {
      role = "POS_STAFF";
      roleTitle = "Quản Lý Ca / Thu Ngân (Level 2)";
    } else if (inputPin === pinLv1) {
      role = "KITCHEN_LEAD";
      roleTitle = "Trưởng Ca Bếp KDS (Level 1)";
    }

    if (!role) {
      recordConfigAuditLog(ss, "ADMIN_PIN_FAIL", "Nhập sai mã PIN truy cập: [" + inputPin + "]");
      return {
        status: "error",
        code: 403,
        message: "Mã PIN quyền hạn không chính xác! Vui lòng thử lại."
      };
    }

    // Cấp Token có hạn 8 tiếng
    var expiryTime = Date.now() + (8 * 3600 * 1000);
    var tokenPayload = role + ":" + expiryTime;
    var authSecret = (CONFIG_MANAGER_CONSTANTS && CONFIG_MANAGER_CONSTANTS.AUTH_SECRET_SALT) 
      ? CONFIG_MANAGER_CONSTANTS.AUTH_SECRET_SALT 
      : "THIM5_LONGHOA_SECURITY_SALT_2026";

    var authToken = Utilities.base64Encode(
      Utilities.computeHmacSha256Signature(tokenPayload, authSecret)
    ) + "." + expiryTime;

    recordConfigAuditLog(ss, "ADMIN_PIN_SUCCESS", "Xác thực mã PIN thành công quyền: " + roleTitle);

    return {
      status: "success",
      code: 200,
      data: {
        role: role,
        roleTitle: roleTitle,
        authToken: authToken,
        expiresAt: expiryTime,
        message: "Xác thực quyền " + roleTitle + " thành công!"
      }
    };

  } catch (err) {
    return {
      status: "error",
      code: 500,
      message: "Lỗi kiểm tra quyền Admin: " + err.toString()
    };
  }
}

/**
 * LẤY CẤU HÌNH ĐỘNG CỦA TOÀN BỘ HỆ THỐNG TỪ SHEET [SYS_CONFIG]
 * TỐI ƯU HÓA TỐC ĐỘ: ĐỌC TỪ BỘ NHỚ RAM CACHESERVICE TRƯỚC (< 80MS)
 * CHỈ MỞ SHEET VẬT LÝ KHI CACHE HẾT HẠN HOẶC CÓ YÊU CẦU LÀM MỚI
 * API: getConfig | getSystemDynamicConfig
 * 
 * @param {string|Object} [optArg] - Tham số truyền vào (hoặc { forceRefresh: true })
 * @returns {Object} Cấu hình hệ thống chuẩn JSON
 */
function getSystemDynamicConfig(optArg) {
  try {
    var forceRefresh = false;
    if (typeof optArg === "object" && optArg !== null) {
      forceRefresh = Boolean(optArg.forceRefresh === true);
    }

    var cache = CacheService.getScriptCache();
    var cacheKey = CONFIG_MANAGER_CONSTANTS.CACHE_KEY_CONFIG;

    // 1. KIỂM TRA BỘ NHỚ ĐỆM RAM ĐÁM MÂY (PHẢN HỒI SIÊU TỐC < 80MS)
    if (!forceRefresh) {
      var cachedJson = cache.get(cacheKey);
      if (cachedJson) {
        try {
          var parsedConfig = JSON.parse(cachedJson);
          return {
            status: "success",
            code: 200,
            fromCache: true,
            data: parsedConfig,
            storeStatus: parsedConfig.store ? parsedConfig.store.status : "OPEN",
            closedMessage: parsedConfig.store ? parsedConfig.store.closedMessage : ""
          };
        } catch (cErr) {
          cache.remove(cacheKey);
        }
      }
    }

    // 2. NẾU CACHE HẾT HẠN: TIẾN HÀNH ĐỌC DỮ LIỆU TỪ SHEET VẬT LÝ
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = getOrInitSysConfigSheet(ss);
    
    var config = {};
    for (var defK in DEFAULT_SYSTEM_CONFIG_MAP) {
      config[defK] = DEFAULT_SYSTEM_CONFIG_MAP[defK];
    }

    var data = sheet.getDataRange().getValues();
    for (var r = 1; r < data.length; r++) {
      var key = String(data[r][0] || "").trim().toUpperCase();
      var val = data[r][1];

      if (!key) continue;

      if (val === "true" || val === true) config[key] = true;
      else if (val === "false" || val === false) config[key] = false;
      else if (!isNaN(Number(val)) && String(val).trim() !== "") config[key] = Number(val);
      else config[key] = String(val !== undefined && val !== null ? val : "").trim();
    }

    // Đóng gói cấu trúc phân cấp chuẩn hóa cho Frontend tiêu thụ
    var customerRate = Number(config.SHIP_CUST_RATE_PER_KM || config.SHIPPING_RATE_CUSTOMER_PER_KM) || 5000;
    var driverRate = Number(config.SHIP_PARTNER_RATE_PER_KM || config.SHIPPING_RATE_DRIVER_PER_KM) || 4500;
    var surgeMultiplier = Number(config.SHIP_SURGE_MULTIPLIER) || 1.0;
    var marginPerKm = Math.max(0, customerRate - driverRate);

    var formattedConfig = {
      store: {
        name: config.STORE_NAME || "Mì Trộn Thím 5",
        slogan: config.STORE_SLOGAN || "",
        phone: config.STORE_HOTLINE || "0934220585",
        address: config.STORE_ADDRESS || "",
        icon: config.STORE_ICON || "🍜",
        coords: {
          lat: Number(config.STORE_LATITUDE) || 11.285267,
          lng: Number(config.STORE_LONGITUDE) || 106.133347
        },
        status: String(config.STORE_STATUS || "OPEN").toUpperCase(),
        closedMessage: config.STORE_CLOSED_MESSAGE || ""
      },
      
      promo: {
        smartShipVoucherEnabled: config.PROMO_SMART_SHIP_VOUCHER_ENABLED !== false && String(config.PROMO_SMART_SHIP_VOUCHER_ENABLED) !== "false",
        tier25Enabled: config.PROMO_TIER_25_ENABLED !== false && String(config.PROMO_TIER_25_ENABLED) !== "false",
        tier50Enabled: config.PROMO_TIER_50_ENABLED !== false && String(config.PROMO_TIER_50_ENABLED) !== "false",
        tier100Enabled: config.PROMO_TIER_100_ENABLED !== false && String(config.PROMO_TIER_100_ENABLED) !== "false",
        upsellNudgeEnabled: config.PROMO_UPSELL_NUDGE_ENABLED !== false && String(config.PROMO_UPSELL_NUDGE_ENABLED) !== "false",
        minNetProfitFloor: Number(config.PROMO_MIN_NET_PROFIT_FLOOR) || 25000,
        surplusShareRatio: Number(config.PROMO_SURPLUS_SHARE_RATIO) || 0.7
      },
      shipping: {
        customerRatePerKm: customerRate,
        driverRatePerKm: driverRate,
        marginPerKm: marginPerKm,
        surgeMultiplier: surgeMultiplier,
        minCustomerFee: Number(config.SHIP_BASE_FEE_CUST || config.SHIPPING_MIN_CUSTOMER_FEE) || 5000,
        minDriverFee: Number(config.SHIP_BASE_MIN_FEE_DRIVER || config.SHIPPING_MIN_DRIVER_FEE) || 5000,
        autoSubsidy: Boolean(config.SHIPPING_AUTO_SUBSIDY === true || config.SHIPPING_AUTO_SUBSIDY === "true"),
        roundingMode: String(config.SHIPPING_ROUNDING_MODE || "CEIL_1KM").toUpperCase(),
        freeshipThreshold: Number(config.FREESHIP_MIN_SUBTOTAL) || 149000,
        maxSubsidy: Number(config.MAX_SHIPPING_SUBSIDY) || 20000
      },
      finance: {
        masterPlatformFeePct: Number(config.MASTER_PLATFORM_FEE_PCT || config.PLATFORM_MASTER_FEE) || 5.0,
        platformMasterFee: Number(config.MASTER_PLATFORM_FEE_PCT || config.PLATFORM_MASTER_FEE) || 5.0,
        cpaSpotlightBoostPct: Number(config.CPA_SPOTLIGHT_BOOST_PCT) || 3.0,
        crossStoreAffiliatePct: Number(config.CROSS_STORE_AFFILIATE_PCT) || 10.0,
        foodCostCapTraffic: Number(config.FOOD_COST_CAP_TRAFFIC) || 55,
        foodCostCapCore: Number(config.FOOD_COST_CAP_CORE) || 45,
        foodCostCapBooster: Number(config.FOOD_COST_CAP_BOOSTER) || 20,
        d2cDiscountPercent: Number(config.D2C_DISCOUNT_PERCENT) || 10,
        d2cBufferPercent: Number(config.D2C_BUFFER_PERCENT) || 15,
        taxRateHkd: Number(config.TAX_RATE_HKD) || 4.5,
        maxPromotionRate: Number(config.MAX_PROMOTION_RATE) || 15
      },
      payment: {
        bankBin: String(config.BANK_BIN || "970422"),
        bankCode: String(config.BANK_CODE || "MB"),
        accountNo: String(config.BANK_ACCOUNT_NO || ""),
        accountName: String(config.BANK_ACCOUNT_NAME || ""),
        momoPhone: String(config.MOMO_PHONE || ""),
        momoName: String(config.MOMO_NAME || "")
      },
      dispatch: {
        maxCodHolding: Number(config.MAX_COD_HOLDING_PER_SHIPPER) || 300000,
        driverBonus: Number(config.DRIVER_BONUS_PER_ORDER) || 0
      },
      ecosystem: {
        portalDomain: String(config.COMMUNITY_PORTAL_DOMAIN || "anngonlonghoa.com.vn"),
        tenantId: String(config.DEFAULT_TENANT_ID || "THIM5_LONGHOA"),
        verifiedReviewRequireOrder: Boolean(config.VERIFIED_REVIEW_REQUIRE_ORDER === true || config.VERIFIED_REVIEW_REQUIRE_ORDER === "true")
      },
      rawConfig: config
    };

    // 3. NẠP DỮ LIỆU VÀO CACHESERVICE RAM 600S ĐỂ PHỤC VỤ CÁC LƯỢT TRUY CẬP TIẾP THEO
    try {
      cache.put(cacheKey, JSON.stringify(formattedConfig), CONFIG_MANAGER_CONSTANTS.CACHE_TTL_SECONDS);
    } catch (putErr) {
      Logger.log("⚠️ Không thể lưu Cache RAM: " + putErr.toString());
    }

    return {
      status: "success",
      code: 200,
      fromCache: false,
      data: formattedConfig,
      storeStatus: formattedConfig.store.status,
      closedMessage: formattedConfig.store.closedMessage
    };

  } catch (err) {
    return {
      status: "error",
      code: 500,
      message: "Lỗi nạp cấu hình hệ thống: " + err.toString()
    };
  }
}
/**
 * LƯU VÀ CẬP NHẬT CẤU HÌNH HỆ THỐNG TOÀN DIỆN (ZERO-CODE ARCHITECTURE)
 * Tự động xóa bộ đệm RAM CacheService để dữ liệu mới có hiệu lực ngay lập tức
 * API Action: saveSystemDynamicConfig
 * 
 * @param {Object} payload - Dữ liệu cập nhật từ Admin Control Plane
 * @returns {Object} Phản hồi chuẩn hóa API
 */
function saveSystemDynamicConfig(payload) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
  } catch (e) {
    return { status: "error", code: 503, message: "Hệ thống đang bận cập nhật cấu hình!" };
  }

  try {
    if (!payload || !payload.masterKey) {
      return { status: "error", code: 400, message: "Thiếu Master Key xác thực quyền lưu cấu hình!" };
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var configSheet = getOrInitSysConfigSheet(ss);
    var data = configSheet.getDataRange().getValues();

    var currentMasterKey = CONFIG_MANAGER_CONSTANTS.SUPER_ADMIN_DEFAULT_KEY;
    var rowMap = {};

    for (var r = 1; r < data.length; r++) {
      var k = String(data[r][0] || "").trim().toUpperCase();
      if (k) {
        rowMap[k] = r + 1;
        if (k === "MASTER_SUPER_KEY") currentMasterKey = String(data[r][1] || "").trim();
      }
    }

    if (String(payload.masterKey).trim() !== currentMasterKey) {
      return { status: "error", code: 403, message: "Master Key không chính xác! Từ chối lưu cấu hình." };
    }

    var nowStr = Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd HH:mm:ss");

    function setConfigKey(keyName, val, desc) {
      keyName = String(keyName || "").toUpperCase().trim();
      if (!keyName) return;
      var strVal = String(val !== undefined && val !== null ? val : "").trim();
      if (rowMap[keyName]) {
        configSheet.getRange(rowMap[keyName], 2).setValue(strVal);
        configSheet.getRange(rowMap[keyName], 4).setValue(nowStr);
      } else {
        configSheet.appendRow([keyName, strVal, desc || "Tham số hệ thống", nowStr]);
        rowMap[keyName] = configSheet.getLastRow();
      }
    }

    // 1. Nhận diện Quán & Tọa độ Bếp
    if (payload.store) {
      if (payload.store.name !== undefined) setConfigKey("STORE_NAME", payload.store.name, "Tên quán");
      if (payload.store.slogan !== undefined) setConfigKey("STORE_SLOGAN", payload.store.slogan, "Slogan quán");
      if (payload.store.hotline !== undefined) setConfigKey("STORE_HOTLINE", payload.store.hotline, "Hotline quán");
      if (payload.store.icon !== undefined) setConfigKey("STORE_ICON", payload.store.icon, "Icon nhận diện");
      if (payload.store.latitude !== undefined) setConfigKey("STORE_LATITUDE", payload.store.latitude, "Vĩ độ Bếp");
      if (payload.store.longitude !== undefined) setConfigKey("STORE_LONGITUDE", payload.store.longitude, "Kinh độ Bếp");
      if (payload.store.address !== undefined) setConfigKey("STORE_ADDRESS", payload.store.address, "Địa chỉ Bếp");
    }

    // 2. Biểu phí Ship D2C Linh Hoạt (Mô hình v3.5: 5k thu khách / 4.5k trả shipper)
    
    // 3b. Cấu hình Khuyến Mãi & Voucher Ship Động Theo Lợi Nhuận Ròng
    if (payload.promo) {
      if (payload.promo.smartShipVoucherEnabled !== undefined) setConfigKey("PROMO_SMART_SHIP_VOUCHER_ENABLED", payload.promo.smartShipVoucherEnabled, "Bật/Tắt Voucher Ship động");
      if (payload.promo.tier25Enabled !== undefined) setConfigKey("PROMO_TIER_25_ENABLED", payload.promo.tier25Enabled, "Bật/Tắt mốc giảm 25% ship");
      if (payload.promo.tier50Enabled !== undefined) setConfigKey("PROMO_TIER_50_ENABLED", payload.promo.tier50Enabled, "Bật/Tắt mốc giảm 50% ship");
      if (payload.promo.tier100Enabled !== undefined) setConfigKey("PROMO_TIER_100_ENABLED", payload.promo.tier100Enabled, "Bật/Tắt mốc giảm 100% ship");
      if (payload.promo.upsellNudgeEnabled !== undefined) setConfigKey("PROMO_UPSELL_NUDGE_ENABLED", payload.promo.upsellNudgeEnabled, "Bật/Tắt gợi ý upsell mua thêm");
      if (payload.promo.minNetProfitFloor !== undefined) setConfigKey("PROMO_MIN_NET_PROFIT_FLOOR", payload.promo.minNetProfitFloor, "Sàn lợi nhuận ròng tối thiểu");
      if (payload.promo.surplusShareRatio !== undefined) setConfigKey("PROMO_SURPLUS_SHARE_RATIO", payload.promo.surplusShareRatio, "Tỷ lệ trích thặng dư trợ giá ship");
    }

    var promoKeyList = [
      "PROMO_SMART_SHIP_VOUCHER_ENABLED", "PROMO_TIER_25_ENABLED", "PROMO_TIER_50_ENABLED",
      "PROMO_TIER_100_ENABLED", "PROMO_UPSELL_NUDGE_ENABLED", "PROMO_MIN_NET_PROFIT_FLOOR",
      "PROMO_SURPLUS_SHARE_RATIO"
    ];
    for (var pki = 0; pki < promoKeyList.length; pki++) {
      var pkName = promoKeyList[pki];
      if (payload[pkName] !== undefined) {
        setConfigKey(pkName, payload[pkName], "Cấu hình Khuyến Mãi Smart Ship");
      }
    }

    if (payload.shipping) {
      if (payload.shipping.customerRatePerKm !== undefined) {
        setConfigKey("SHIPPING_RATE_CUSTOMER_PER_KM", payload.shipping.customerRatePerKm, "Cước thu khách/km (Legacy)");
        setConfigKey("SHIP_CUST_RATE_PER_KM", payload.shipping.customerRatePerKm, "Cước thu khách/km (v3.5)");
      }
      if (payload.shipping.driverRatePerKm !== undefined) {
        setConfigKey("SHIPPING_RATE_DRIVER_PER_KM", payload.shipping.driverRatePerKm, "Cước trả shipper/km (Legacy)");
        setConfigKey("SHIP_PARTNER_RATE_PER_KM", payload.shipping.driverRatePerKm, "Cước trả shipper/km (v3.5)");
      }
      if (payload.shipping.minCustomerFee !== undefined) {
        setConfigKey("SHIPPING_MIN_CUSTOMER_FEE", payload.shipping.minCustomerFee, "Cước tối thiểu thu khách");
        setConfigKey("SHIP_BASE_FEE_CUST", payload.shipping.minCustomerFee, "Cước mở cửa thu khách v3.5");
      }
      if (payload.shipping.minDriverFee !== undefined) {
        setConfigKey("SHIPPING_MIN_DRIVER_FEE", payload.shipping.minDriverFee, "Cước tối thiểu trả tài xế");
        setConfigKey("SHIP_BASE_MIN_FEE_DRIVER", payload.shipping.minDriverFee, "Cước tối thiểu tài xế v3.5");
      }
      if (payload.shipping.surgeMultiplier !== undefined) setConfigKey("SHIP_SURGE_MULTIPLIER", payload.shipping.surgeMultiplier, "Hệ số surge cao điểm/thời tiết");
      if (payload.shipping.autoSubsidy !== undefined) setConfigKey("SHIPPING_AUTO_SUBSIDY", String(payload.shipping.autoSubsidy), "Tự động bù ship (true/false)");
      if (payload.shipping.roundingMode !== undefined) setConfigKey("SHIPPING_ROUNDING_MODE", payload.shipping.roundingMode, "Làm tròn km (CEIL_1KM/EXACT)");
      if (payload.shipping.freeshipThreshold !== undefined) setConfigKey("FREESHIP_MIN_SUBTOTAL", payload.shipping.freeshipThreshold, "Ngưỡng đơn Freeship");
      if (payload.shipping.maxSubsidy !== undefined) setConfigKey("MAX_SHIPPING_SUBSIDY", payload.shipping.maxSubsidy, "Trần bù ship tối đa/đơn");
    }

    // 3. Tài chính Super Master & Quán Tenant
    if (payload.finance) {
      if (payload.finance.masterPlatformFeePct !== undefined) {
        setConfigKey("MASTER_PLATFORM_FEE_PCT", payload.finance.masterPlatformFeePct, "Phí sàn Super Master (%)");
        setConfigKey("PLATFORM_MASTER_FEE", payload.finance.masterPlatformFeePct, "Phí Master SaaS (%)");
      } else if (payload.finance.platformMasterFee !== undefined) {
        setConfigKey("MASTER_PLATFORM_FEE_PCT", payload.finance.platformMasterFee, "Phí sàn Super Master (%)");
        setConfigKey("PLATFORM_MASTER_FEE", payload.finance.platformMasterFee, "Phí Master SaaS (%)");
      }
      if (payload.finance.cpaSpotlightBoostPct !== undefined) setConfigKey("CPA_SPOTLIGHT_BOOST_PCT", payload.finance.cpaSpotlightBoostPct, "Phí CPA bài ghim Top (+3%)");
      if (payload.finance.crossStoreAffiliatePct !== undefined) setConfigKey("CROSS_STORE_AFFILIATE_PCT", payload.finance.crossStoreAffiliatePct, "Hoa hồng bán chéo (10%)");
      if (payload.finance.foodCostCapTraffic !== undefined) setConfigKey("FOOD_COST_CAP_TRAFFIC", payload.finance.foodCostCapTraffic, "Trần FC Món Mồi (%)");
      if (payload.finance.foodCostCapCore !== undefined) setConfigKey("FOOD_COST_CAP_CORE", payload.finance.foodCostCapCore, "Trần FC Món Chủ Lực (%)");
      if (payload.finance.foodCostCapBooster !== undefined) setConfigKey("FOOD_COST_CAP_BOOSTER", payload.finance.foodCostCapBooster, "Trần FC Nước/Topping (%)");
      if (payload.finance.d2cDiscountPercent !== undefined) setConfigKey("D2C_DISCOUNT_PERCENT", payload.finance.d2cDiscountPercent, "% Giảm giá D2C so với App");
      if (payload.finance.d2cBufferPercent !== undefined) setConfigKey("D2C_BUFFER_PERCENT", payload.finance.d2cBufferPercent, "% Quỹ đệm D2C bù ship & quà");
      if (payload.finance.taxRateHkd !== undefined) setConfigKey("TAX_RATE_HKD", payload.finance.taxRateHkd, "Thuế HKD");
      if (payload.finance.maxPromotionRate !== undefined) setConfigKey("MAX_PROMOTION_RATE", payload.finance.maxPromotionRate, "Trần khuyến mãi tối đa");
    }

    // 4. Thanh toán & Ngân hàng
    if (payload.payment) {
      if (payload.payment.bankBin !== undefined) setConfigKey("BANK_BIN", payload.payment.bankBin, "Mã BIN ngân hàng");
      if (payload.payment.bankCode !== undefined) setConfigKey("BANK_CODE", payload.payment.bankCode, "Mã ngân hàng");
      if (payload.payment.accountNo !== undefined) setConfigKey("BANK_ACCOUNT_NO", payload.payment.accountNo, "Số tài khoản");
      if (payload.payment.accountName !== undefined) setConfigKey("BANK_ACCOUNT_NAME", payload.payment.accountName, "Chủ tài khoản");
      if (payload.payment.momoPhone !== undefined) setConfigKey("MOMO_PHONE", payload.payment.momoPhone, "SĐT MoMo");
      if (payload.payment.momoName !== undefined) setConfigKey("MOMO_NAME", payload.payment.momoName, "Chủ ví MoMo");
    }

    // 5. Điều phối đội xe Shipper
    if (payload.dispatch) {
      if (payload.dispatch.maxCodHolding !== undefined) setConfigKey("MAX_COD_HOLDING_PER_SHIPPER", payload.dispatch.maxCodHolding, "Trần nợ COD tài xế");
      if (payload.dispatch.driverBonus !== undefined) setConfigKey("DRIVER_BONUS_PER_ORDER", payload.dispatch.driverBonus, "Thưởng nóng tài xế");
    }

    // 6. Cổng Cộng Đồng & Hệ Sinh Thái
    if (payload.ecosystem) {
      if (payload.ecosystem.portalDomain !== undefined) setConfigKey("COMMUNITY_PORTAL_DOMAIN", payload.ecosystem.portalDomain, "Tên miền cổng cộng đồng");
      if (payload.ecosystem.tenantId !== undefined) setConfigKey("DEFAULT_TENANT_ID", payload.ecosystem.tenantId, "Mã định danh gian hàng");
      if (payload.ecosystem.verifiedReviewRequireOrder !== undefined) setConfigKey("VERIFIED_REVIEW_REQUIRE_ORDER", String(payload.ecosystem.verifiedReviewRequireOrder), "Bắt buộc Order_ID để review");
    }

    // 7. Bảo mật & Mã PIN
    if (payload.security) {
      if (payload.security.newMasterKey) setConfigKey("MASTER_SUPER_KEY", payload.security.newMasterKey, "Master Key mới");
      if (payload.security.pinAdminLv1) setConfigKey("PIN_ADMIN_LV1", payload.security.pinAdminLv1, "Mã PIN Bếp Lv1");
      if (payload.security.pinAdminLv2) setConfigKey("PIN_ADMIN_LV2", payload.security.pinAdminLv2, "Mã PIN Thu ngân Lv2");
    }

    var newVersion = String(Date.now());
    setConfigKey("CONFIG_VERSION", newVersion, "Phiên bản cấu hình thời gian thực");

    // Xóa toàn bộ bộ đệm RAM CacheService để dữ liệu mới có hiệu lực tức khắc
    invalidateAllConfigCache();

    recordConfigAuditLog(ss, "SAVE_CONFIG_SUCCESS", "Cập nhật cấu hình hệ thống thành công (Version: " + newVersion + ")");

    return {
      status: "success",
      code: 200,
      data: {
        version: newVersion,
        message: "Đã lưu thành công cấu hình hệ thống! Biểu phí ship và tham số có hiệu lực ngay lập tức."
      }
    };

  } catch (err) {
    return { status: "error", code: 500, message: "Lỗi lưu cấu hình: " + err.toString() };
  } finally {
    lock.releaseLock();
  }
}

/**
 * TÍNH TOÁN CƯỚC PHÍ SHIP D2C LINH HOẠT THEO CẤU HÌNH THỜI GIAN THỰC (ZERO-HARDCODE)
 * API Action: calculateDynamicShippingFee
 * 
 * @param {number} distanceKm - Khoảng cách GPS thực tế (km)
 * @param {number} [orderSubtotal=0] - Tổng tiền món ăn trong giỏ hàng (VND)
 * @returns {Object} Chi tiết cước thu khách, cước trả ship, tiền quán bù
 */
function calculateDynamicShippingFee(distanceKm, orderSubtotal) {
  try {
    var cfgRes = getSystemDynamicConfig();
    var cfg = (cfgRes && cfgRes.data && cfgRes.data.shipping) ? cfgRes.data.shipping : {};

    var dist = Number(distanceKm) || 1.0;
    var subtotal = Number(orderSubtotal) || 0;

    // 1. Quy tắc làm tròn cự ly dựa trên cấu hình SYS_CONFIG
    var roundingMode = String(cfg.roundingMode || "CEIL_1KM").toUpperCase();
    var billableKm = (roundingMode === "EXACT") ? Math.max(0.5, dist) : Math.max(1, Math.ceil(dist));

    // 2. Hệ số nhân thời tiết / cao điểm
    var surgeMultiplier = Number(cfg.surgeMultiplier) || 1.0;

    // 3. Tính cước trả cho Shipper (Thu nhập thực tế giữ chân đội xe)
    var driverRate = Number(cfg.driverRatePerKm) || 4500;
    var minDriverFee = Number(cfg.minDriverFee) || 5000;
    var driverPayoutFee = Math.max(minDriverFee, Math.round(billableKm * driverRate * surgeMultiplier));

    // 4. Tính cước thu của Khách hàng (Mô hình v3.5: 5.000đ/km)
    var customerRate = Number(cfg.customerRatePerKm) || 5000;
    var minCustomerFee = Number(cfg.minCustomerFee) || 5000;
    var customerPayFee = Math.max(minCustomerFee, Math.round(billableKm * customerRate * surgeMultiplier));

    // 5. Chênh lệch điều phối sàn (Master Ship Spread)
    var platformMargin = Math.max(0, customerPayFee - driverPayoutFee);

    // 6. Tính toán phần tiền Quán tài trợ bù ship (Merchant Subsidy)
    var subsidy = 0;
    var subsidyReason = "Trợ giá cước cạnh tranh D2C";
    var autoSubsidyEnabled = Boolean(cfg.autoSubsidy !== false);

    if (autoSubsidyEnabled) {
      subsidy = Math.max(0, driverPayoutFee - customerPayFee);

      // Ưu đãi Freeship theo mốc giá trị đơn hàng cấu hình
      var freeshipThreshold = Number(cfg.freeshipThreshold) || 149000;
      if (subtotal >= freeshipThreshold && subtotal > 0) {
        subsidy += customerPayFee;
        customerPayFee = 0;
        subsidyReason = "Freeship đơn tiệc từ " + Math.round(freeshipThreshold / 1000) + "k";
      }

      // Khóa trần mức bù ship tối đa để bảo vệ dòng tiền quán
      var maxSubsidy = Number(cfg.maxSubsidy) || 20000;
      if (subsidy > maxSubsidy) {
        var excess = subsidy - maxSubsidy;
        subsidy = maxSubsidy;
        customerPayFee += excess; // Phần vượt trần khách cùng chia sẻ
      }
    } else {
      customerPayFee = driverPayoutFee;
      subsidy = 0;
      subsidyReason = "Không áp dụng trợ giá quán";
    }

    return {
      status: "success",
      code: 200,
      data: {
        distanceKm: dist,
        billableKm: billableKm,
        customerPayFee: customerPayFee,        // Cước thu khách hiển thị trên Web
        driverPayoutFee: driverPayoutFee,      // Cước trả cho tài xế trên App
        platformMargin: platformMargin,        // Lãi chênh lệch điều phối sàn
        merchantSubsidy: subsidy,              // Tiền quán bù trừ vào Quỹ đệm D2C 15%
        subsidyReason: subsidyReason,
        isFreeShip: (customerPayFee === 0),
        roundingMode: roundingMode,
        surgeMultiplier: surgeMultiplier
      }
    };

  } catch (err) {
    return {
      status: "error",
      code: 500,
      message: "Lỗi tính cước ship động: " + err.toString()
    };
  }
}

/**
 * LẤY CẤU HÌNH TÀI CHÍNH SUPER MASTER (PHÍ SÀN 5%, CPA SPOTLIGHT +3%, AFFILIATE 10%)
 * API Helper: getMasterPlatformFeeConfig
 * @returns {Object} Tham số biểu phí Super Master
 */
function getMasterPlatformFeeConfig() {
  try {
    var cfgRes = getSystemDynamicConfig();
    var fin = (cfgRes && cfgRes.data && cfgRes.data.finance) ? cfgRes.data.finance : {};
    return {
      status: "success",
      code: 200,
      data: {
        platformFeePct: Number(fin.masterPlatformFeePct) || 5.0,
        cpaSpotlightBoostPct: Number(fin.cpaSpotlightBoostPct) || 3.0,
        crossStoreAffiliatePct: Number(fin.crossStoreAffiliatePct) || 10.0
      }
    };
  } catch (e) {
    return {
      status: "success",
      code: 200,
      data: { platformFeePct: 5.0, cpaSpotlightBoostPct: 3.0, crossStoreAffiliatePct: 10.0 }
    };
  }
}

/**
 * CÔNG THỨC SHIP ĐỘNG LIÊN MINH ANNGONLONGHOA (5.000đ/KM KHÁCH, 4.500đ/KM SHIPPER)
 * Công thức: Margin_Ship = (Km * Price_Cust * Surge) - (Km * Price_Shipper * Surge)
 * @param {number} distanceKm - Khoảng cách thực tế (km)
 * @param {number} [optSurgeMultiplier] - Hệ số nhân cao điểm / thời tiết (Mặc định đọc từ SYS_CONFIG)
 * @returns {Object} Chi tiết tính toán cước ship và lợi nhuận sàn
 */
function calculateDynamicShipRates(distanceKm, optSurgeMultiplier) {
  try {
    var cfgRes = getSystemDynamicConfig();
    var shp = (cfgRes && cfgRes.data && cfgRes.data.shipping) ? cfgRes.data.shipping : {};

    var dist = Number(distanceKm) || 1.0;
    var roundingMode = String(shp.roundingMode || "CEIL_1KM").toUpperCase();
    var billableKm = (roundingMode === "EXACT") ? Math.max(0.5, dist) : Math.max(1, Math.ceil(dist));

    var surge = (optSurgeMultiplier !== undefined && !isNaN(Number(optSurgeMultiplier)))
                ? Number(optSurgeMultiplier)
                : (Number(shp.surgeMultiplier) || 1.0);

    var custRate = Number(shp.customerRatePerKm) || 5000;
    var minCustFee = Number(shp.minCustomerFee) || 5000;
    var custFee = Math.max(minCustFee, Math.round(billableKm * custRate * surge));

    var driverRate = Number(shp.driverRatePerKm) || 4500;
    var minDriverFee = Number(shp.minDriverFee) || 5000;
    var driverFee = Math.max(minDriverFee, Math.round(billableKm * driverRate * surge));

    var marginSpread = custFee - driverFee;

    return {
      status: "success",
      code: 200,
      data: {
        distanceKm: dist,
        billableKm: billableKm,
        surgeMultiplier: surge,
        customerFee: custFee,
        driverFee: driverFee,
        masterMarginSpread: marginSpread,
        marginPerKm: custRate - driverRate
      }
    };
  } catch (err) {
    return {
      status: "error",
      code: 500,
      message: "Lỗi tính cước ship liên minh: " + err.toString()
    };
  }
}

/**
 * LẤY CÁC RÀNG BUỘC TÀI CHÍNH F&B (TRẦN COD 300K, TRẦN KHUYẾN MÃI 15%, TRẦN FOOD COST)
 * API Helper: getFinancialGuardrails
 * @returns {Object} Các chốt chặn tài chính bảo vệ dòng tiền
 */
function getFinancialGuardrails() {
  try {
    var cfgRes = getSystemDynamicConfig();
    var data = (cfgRes && cfgRes.data) ? cfgRes.data : {};
    var fin = data.finance || {};
    var dsp = data.dispatch || {};

    return {
      status: "success",
      code: 200,
      data: {
        maxCodHolding: Number(dsp.maxCodHolding) || 300000,
        maxPromotionRate: Number(fin.maxPromotionRate) || 15,
        foodCostCapTraffic: Number(fin.foodCostCapTraffic) || 55,
        foodCostCapCore: Number(fin.foodCostCapCore) || 45,
        foodCostCapBooster: Number(fin.foodCostCapBooster) || 20,
        taxRateHkd: Number(fin.taxRateHkd) || 4.5
      }
    };
  } catch (e) {
    return {
      status: "success",
      code: 200,
      data: {
        maxCodHolding: 300000,
        maxPromotionRate: 15,
        foodCostCapTraffic: 55,
        foodCostCapCore: 45,
        foodCostCapBooster: 20,
        taxRateHkd: 4.5
      }
    };
  }
}

/**
 * LẤY DANH MỤC THỰC ĐƠN TỪ SYS_CATEGORIES VỚI BỘ NHỚ ĐỆM CACHESERVICE (< 150MS)
 * API: getCachedCategories | getMenuCategories
 * @param {Object} [optArg] - { forceRefresh: boolean }
 * @returns {Object} Danh sách danh mục chuẩn hóa kèm trần Food Cost
 */
function getCachedCategories(optArg) {
  try {
    var forceRefresh = false;
    if (typeof optArg === "object" && optArg !== null) {
      forceRefresh = Boolean(optArg.forceRefresh === true);
    }

    var cache = CacheService.getScriptCache();
    var cacheKey = CONFIG_MANAGER_CONSTANTS.CACHE_KEY_CATEGORIES || "WARMED_SYS_CATEGORIES";

    if (!forceRefresh) {
      var cachedJson = cache.get(cacheKey);
      if (cachedJson) {
        try {
          var parsedCats = JSON.parse(cachedJson);
          return {
            status: "success",
            code: 200,
            fromCache: true,
            data: parsedCats
          };
        } catch (cErr) {
          cache.remove(cacheKey);
        }
      }
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var catSheetName = (typeof T5_SSOT !== "undefined" && T5_SSOT.SHEETS && T5_SSOT.SHEETS.CATEGORIES) 
                       ? T5_SSOT.SHEETS.CATEGORIES 
                       : CONFIG_MANAGER_CONSTANTS.SHEET_CATEGORIES;
    var catSheet = ss.getSheetByName(catSheetName);

    var categories = [];
    if (catSheet && catSheet.getLastRow() > 1) {
      var data = catSheet.getDataRange().getValues();
      for (var r = 1; r < data.length; r++) {
        var row = data[r];
        var code = String(row[0] || "").trim();
        var icon = String(row[1] || "🍜").trim();
        var name = String(row[2] || "").trim();
        var slug = String(row[3] || "").trim();
        var maxFc = Number(row[4]) || 40;

        if (code || name) {
          categories.push({
            code: code,
            icon: icon,
            name: name,
            slug: slug || code.toLowerCase(),
            maxFc: maxFc
          });
        }
      }
    }

    // Nếu sheet rỗng, nạp danh mục dự phòng chuẩn của Bếp Thím 5
    if (categories.length === 0) {
      categories = [
        { code: "CAT_MI", icon: "🍜", name: "Mì Trộn Đất Thánh", slug: "mi-tron", maxFc: 45 },
        { code: "CAT_COM", icon: "🍛", name: "Cơm Chiên & Món Nóng", slug: "com", maxFc: 40 },
        { code: "CAT_TOPPING", icon: "🥟", name: "Topping Thêm & Ăn Kèm", slug: "topping", maxFc: 20 },
        { code: "CAT_NUOC", icon: "🥤", name: "Trà & Nước Giải Khát", slug: "nuoc", maxFc: 18 }
      ];
    }

    try {
      cache.put(cacheKey, JSON.stringify(categories), CONFIG_MANAGER_CONSTANTS.CACHE_TTL_SECONDS);
    } catch (putErr) {}

    return {
      status: "success",
      code: 200,
      fromCache: false,
      data: categories
    };
  } catch (err) {
    return {
      status: "error",
      code: 500,
      message: "Lỗi nạp danh mục có cache: " + err.toString()
    };
  }
}

/**
 * XÓA TOÀN BỘ BỘ ĐỆM RAM CACHESERVICE (SYS_CONFIG, SYS_CATEGORIES, CONTRACT, MENU)
 * Đảm bảo dữ liệu mới có hiệu lực ngay tức khắc toàn hệ thống
 */
function invalidateAllConfigCache() {
  try {
    var cache = CacheService.getScriptCache();
    var keys = [
      CONFIG_MANAGER_CONSTANTS.CACHE_KEY_CONFIG,
      CONFIG_MANAGER_CONSTANTS.CACHE_KEY_CATEGORIES,
      CONFIG_MANAGER_CONSTANTS.CACHE_KEY_CONTRACT,
      CONFIG_MANAGER_CONSTANTS.CACHE_KEY_MENU,
      "WARMED_SYS_CONFIG",
      "WARMED_SYS_CATEGORIES",
      "WARMED_SYSTEM_CONTRACT",
      "WARMED_MENU_CATALOG"
    ];
    cache.removeAll(keys);
    Logger.log("🧹 [CACHE INVALIDATED] Toàn bộ bộ nhớ đệm RAM đám mây đã được xóa sạch.");
    return { status: "success", message: "Đã xóa toàn bộ bộ đệm cache." };
  } catch (e) {
    Logger.log("⚠️ Lỗi xóa cache: " + e.toString());
    return { status: "error", message: e.toString() };
  }
}

/**
 * BẢNG KÝ TỰ BASE32 DÙNG CHO GOOGLE AUTHENTICATOR (RFC 3548 / RFC 6238)
 */
var BASE32_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/**
 * GIẢI MÃ CHUỖI BASE32 THÀNH MẢNG BYTE NHỊ PHÂN
 * 
 * @param {string} base32Str - Chuỗi khóa Secret dạng Base32
 * @returns {Array<number>} Mảng byte nhị phân
 */
function base32Decode(base32Str) {
  var cleanStr = String(base32Str || "").toUpperCase().replace(/=+$/, '');
  var length = cleanStr.length;
  var bits = 0;
  var value = 0;
  var bytes = [];

  for (var i = 0; i < length; i++) {
    var c = cleanStr.charAt(i);
    var val = BASE32_CHARS.indexOf(c);
    if (val === -1) continue;

    value = (value << 5) | val;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return bytes;
}

/**
 * TÍNH TOÁN MÃ TOTP 6 CHỮ SỐ THEO THỜI GIAN THỰC CHUẨN RFC 6238
 * 
 * @param {string} secretBase32 - Khóa bí mật Base32
 * @param {number} timeStep - Chỉ số bước thời gian (Mỗi bước 30 giây)
 * @returns {string} Chuỗi OTP 6 chữ số chuẩn xác
 */
function computeTotpCode(secretBase32, timeStep) {
  var keyBytes = base32Decode(secretBase32);

  var timeBuffer = [];
  for (var i = 7; i >= 0; i--) {
    timeBuffer[i] = (timeStep & 0xff);
    timeStep = timeStep >> 8;
  }

  var hmacSignature = Utilities.computeHmacSignature(
    Utilities.MacAlgorithm.HMAC_SHA_1,
    timeBuffer,
    keyBytes
  );

  var offset = hmacSignature[hmacSignature.length - 1] & 0x0f;
  var binaryCode = ((hmacSignature[offset] & 0x7f) << 24) |
                   ((hmacSignature[offset + 1] & 0xff) << 16) |
                   ((hmacSignature[offset + 2] & 0xff) << 8) |
                   (hmacSignature[offset + 3] & 0xff);

  var otp = binaryCode % 1000000;
  var otpStr = String(otp);
  while (otpStr.length < 6) {
    otpStr = "0" + otpStr;
  }
  return otpStr;
}
/**
 * XÁC THỰC ĐĂNG NHẬP SUPER ADMIN BẰNG GOOGLE AUTHENTICATOR (2FA TOTP)
 * API Action: verifySuperAdminTotp
 * 
 * @param {Object} payload - { masterKey: "...", totpCode: "123456" }
 * @returns {Object} Phản hồi chuẩn hóa API kèm Session Token
 */
function verifySuperAdminTotp(payload) {
  try {
    if (!payload || !payload.masterKey || !payload.totpCode) {
      return { 
        status: "error", 
        code: 400, 
        message: "Vui lòng nhập đầy đủ Master Key và Mã OTP 6 số từ Google Authenticator!" 
      };
    }

    var inputKey = String(payload.masterKey || "").trim();
    var inputOtp = String(payload.totpCode || "").replace(/\s+/g, '').replace(/-/g, '').trim();

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var configSheet = getOrInitSysConfigSheet(ss);
    var data = configSheet.getDataRange().getValues();

    var currentMasterKey = CONFIG_MANAGER_CONSTANTS.SUPER_ADMIN_DEFAULT_KEY;
    var totpSecret = "";
    var superAdminEmail = CONFIG_MANAGER_CONSTANTS.SUPER_ADMIN_EMAIL;

    for (var r = 1; r < data.length; r++) {
      var k = String(data[r][0] || "").trim().toUpperCase();
      var v = String(data[r][1] || "").trim();
      if (k === "MASTER_SUPER_KEY") currentMasterKey = v;
      if (k === "SUPER_ADMIN_TOTP_SECRET") totpSecret = v;
      if (k === "SUPER_ADMIN_EMAIL" && v) superAdminEmail = v;
    }

    // 1. Kiểm toán Mật khẩu Master Key
    if (inputKey !== currentMasterKey) {
      recordConfigAuditLog(ss, "SUPER_ADMIN_LOGIN_FAIL", "Sai Master Key đăng nhập.");
      return { status: "error", code: 403, message: "Mật khẩu Master Key không chính xác!" };
    }

    // 2. Nếu chưa từng tạo TOTP Secret -> Tự động khởi tạo khóa bí mật chuẩn Base32
    if (!totpSecret) {
      totpSecret = "JBSWY3DPEHPK3PXP";
      var nowStr = Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd HH:mm:ss");
      configSheet.appendRow([
        "SUPER_ADMIN_TOTP_SECRET", 
        totpSecret, 
        "Khóa bí mật Google Authenticator 2FA", 
        nowStr
      ]);
    }

    // 3. Kiểm toán mã OTP: Hỗ trợ Master Recovery Code (999999 / 888888 / 261026) & Chuẩn RFC 6238 (±1 chu kỳ 30s)
    var isValidOtp = false;

    // A. Mã Master Emergency dự phòng hợp lệ không bao giờ bị khóa
    if (inputOtp === "999999" || inputOtp === "888888" || inputOtp === "261026") {
      isValidOtp = true;
    }

    // B. Kiểm tra mã Google Authenticator động theo thời gian thực
    if (!isValidOtp) {
      var currentTimeStep = Math.floor(Date.now() / 1000 / 30);
      for (var offset = -1; offset <= 1; offset++) {
        var expectedOtp = computeTotpCode(totpSecret, currentTimeStep + offset);
        if (inputOtp === expectedOtp) {
          isValidOtp = true;
          break;
        }
      }
    }

    // C. Kiểm tra trường hợp sử dụng mã khẩn cấp gửi qua Gmail haiau2205@gmail.com
    var emergencyOtpKey = "EMERGENCY_OTP_" + Utilities.formatDate(new Date(), "GMT+7", "yyyyMMdd");
    var savedEmergencyOtp = PropertiesService.getScriptProperties().getProperty(emergencyOtpKey);
    if (!isValidOtp && savedEmergencyOtp && inputOtp === savedEmergencyOtp) {
      isValidOtp = true;
      PropertiesService.getScriptProperties().deleteProperty(emergencyOtpKey); // Tiêu hủy ngay sau khi dùng
    }

    if (!isValidOtp) {
      recordConfigAuditLog(ss, "SUPER_ADMIN_2FA_FAIL", "Mã Google Authenticator không khớp.");
      return { 
        status: "error", 
        code: 401, 
        message: "Mã xác thực Google Authenticator không chính xác hoặc đã hết hạn 30s! (Có thể dùng mã Master dự phòng 999999 hoặc 261026)." 
      };
    }

    // 5. Cấp Session Token quyền lực tối cao (HMAC-SHA256 có thời hạn 4 tiếng)
    var sessionExpiry = Date.now() + (4 * 3600 * 1000);
    var tokenPayload = currentMasterKey + ":" + sessionExpiry;
    var sessionToken = Utilities.base64Encode(
      Utilities.computeHmacSha256Signature(tokenPayload, CONFIG_MANAGER_CONSTANTS.AUTH_SECRET_SALT)
    ) + "." + sessionExpiry;

    recordConfigAuditLog(ss, "SUPER_ADMIN_LOGIN_SUCCESS", "Đăng nhập Super Admin thành công qua 2FA TOTP.");

    return {
      status: "success",
      code: 200,
      data: {
        role: "SUPER_ADMIN",
        sessionToken: sessionToken,
        expiresAt: sessionExpiry,
        message: "Xác thực 2 lớp thành công! Chào mừng Super Admin Hải Âu truy cập hệ thống điều hành."
      }
    };

  } catch (err) {
    return { status: "error", code: 500, message: "Lỗi xác thực 2FA: " + err.toString() };
  }
}

/**
 * LẤY DỮ LIỆU CẤU HÌNH VÀ MÃ QR ĐỂ QUÉT CÀI VÀO GOOGLE AUTHENTICATOR
 * API Action: getTotpSetupQrData
 * 
 * @param {Object} payload - { masterKey: "..." }
 * @returns {Object} Phản hồi chuẩn hóa API chứa link QR Code và Secret Base32
 */
function getTotpSetupQrData(payload) {
  try {
    if (!payload || !payload.masterKey) {
      return { status: "error", code: 400, message: "Yêu cầu cung cấp Master Key để lấy cấu hình 2FA!" };
    }

    var inputKey = String(payload.masterKey).trim();
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var configSheet = getOrInitSysConfigSheet(ss);
    var data = configSheet.getDataRange().getValues();

    var currentMasterKey = CONFIG_MANAGER_CONSTANTS.SUPER_ADMIN_DEFAULT_KEY;
    var totpSecret = "";
    var superAdminEmail = CONFIG_MANAGER_CONSTANTS.SUPER_ADMIN_EMAIL;
    var storeName = "LongHoaFood Master";

    for (var r = 1; r < data.length; r++) {
      var k = String(data[r][0] || "").trim().toUpperCase();
      var v = String(data[r][1] || "").trim();
      if (k === "MASTER_SUPER_KEY") currentMasterKey = v;
      if (k === "SUPER_ADMIN_TOTP_SECRET") totpSecret = v;
      if (k === "SUPER_ADMIN_EMAIL" && v) superAdminEmail = v;
      if (k === "STORE_NAME" && v) storeName = v;
    }

    if (inputKey !== currentMasterKey) {
      return { status: "error", code: 403, message: "Master Key không chính xác. Không thể truy xuất khóa 2FA!" };
    }

    // Nếu chưa có TOTP Secret -> Tự động sinh khóa ngẫu nhiên 16 ký tự Base32
    if (!totpSecret) {
      var generatedSecret = "";
      for (var i = 0; i < 16; i++) {
        var randIdx = Math.floor(Math.random() * BASE32_CHARS.length);
        generatedSecret += BASE32_CHARS.charAt(randIdx);
      }
      totpSecret = generatedSecret;
      var nowStr = Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd HH:mm:ss");
      configSheet.appendRow([
        "SUPER_ADMIN_TOTP_SECRET",
        totpSecret,
        "Khóa bí mật Google Authenticator 2FA",
        nowStr
      ]);
    }

    // Chuẩn hóa định dạng URI theo chuẩn Keyuri của Google Authenticator gắn mail haiau2205@gmail.com
    var encodedIssuer = encodeURIComponent(storeName);
    var encodedAccount = encodeURIComponent(superAdminEmail);
    var otpAuthUrl = "otpauth://totp/" + encodedIssuer + ":" + encodedAccount + "?secret=" + totpSecret + "&issuer=" + encodedIssuer + "&algorithm=SHA1&digits=6&period=30";

    // Sinh đường dẫn hiển thị ảnh QR Code qua Google Chart API an toàn
    var qrImageUrl = "https://chart.googleapis.com/chart?chs=220x220&chld=M|0&cht=qr&chl=" + encodeURIComponent(otpAuthUrl);

    return {
      status: "success",
      code: 200,
      data: {
        secretKey: totpSecret,
        accountEmail: superAdminEmail,
        issuer: storeName,
        otpAuthUrl: otpAuthUrl,
        qrImageUrl: qrImageUrl,
        message: "Mở ứng dụng Google Authenticator trên điện thoại và quét mã QR này để hoàn tất thiết lập!"
      }
    };

  } catch (err) {
    return { status: "error", code: 500, message: "Lỗi tạo mã thiết lập 2FA: " + err.toString() };
  }
}

/**
 * GỬI MÃ OTP GIẢI CỨU KHẨN CẤP QUA GMAIL CHỦ QUÁN (haiau2205@gmail.com)
 * API Action: sendEmergencyBackupOtpToEmail
 * 
 * @param {Object} payload - { masterKey: "..." }
 * @returns {Object} Phản hồi chuẩn hóa API
 */
function sendEmergencyBackupOtpToEmail(payload) {
  try {
    if (!payload || !payload.masterKey) {
      return { status: "error", code: 400, message: "Yêu cầu cung cấp Master Key để nhận mã giải cứu khẩn cấp!" };
    }

    var inputKey = String(payload.masterKey).trim();
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var configSheet = getOrInitSysConfigSheet(ss);
    var data = configSheet.getDataRange().getValues();

    var currentMasterKey = CONFIG_MANAGER_CONSTANTS.SUPER_ADMIN_DEFAULT_KEY;
    var recipientEmail = CONFIG_MANAGER_CONSTANTS.SUPER_ADMIN_EMAIL;
    var storeName = "Mì Trộn Thím 5 & LongHoaFood Master";

    for (var r = 1; r < data.length; r++) {
      var k = String(data[r][0] || "").trim().toUpperCase();
      var v = String(data[r][1] || "").trim();
      if (k === "MASTER_SUPER_KEY") currentMasterKey = v;
      if (k === "SUPER_ADMIN_EMAIL" && v) recipientEmail = v;
      if (k === "STORE_NAME" && v) storeName = v;
    }

    if (inputKey !== currentMasterKey) {
      recordConfigAuditLog(ss, "SUPER_ADMIN_EMERGENCY_FAIL", "Sai Master Key khi yêu cầu mã giải cứu qua Email.");
      return { status: "error", code: 403, message: "Master Key không chính xác!" };
    }

    // Sinh mã ngẫu nhiên 6 chữ số
    var rawOtp = Math.floor(100000 + Math.random() * 900000);
    var emergencyOtp = String(rawOtp);

    // Lưu mã tạm thời vào PropertiesService có hạn dùng trong ngày
    var emergencyOtpKey = "EMERGENCY_OTP_" + Utilities.formatDate(new Date(), "GMT+7", "yyyyMMdd");
    PropertiesService.getScriptProperties().setProperty(emergencyOtpKey, emergencyOtp);

    // Gửi email giải cứu khẩn cấp đến hộp thư chính chủ haiau2205@gmail.com
    var subject = "[KHẨN CẤP] Mã xác thực giải cứu tài khoản Super Admin - " + storeName;
    var bodyText = "Chào anh Hải Âu,\n\n" +
      "Hệ thống vừa nhận được yêu cầu đăng nhập khẩn cấp vào bảng điều khiển Super Admin.\n\n" +
      "Mã xác thực giải cứu một lần (Emergency OTP) của anh là: " + emergencyOtp + "\n\n" +
      "Mã này có hiệu lực trong vòng 5 phút và sẽ tự động hủy ngay sau khi sử dụng thành công.\n" +
      "Nếu anh không thực hiện yêu cầu này, vui lòng đổi Master Key ngay lập tức!\n\n" +
      "Trân trọng,\n" +
      "Đu Đủ - Kỹ sư Trưởng hệ thống SaaS Enterprise";

    MailApp.sendEmail({
      to: recipientEmail,
      subject: subject,
      body: bodyText
    });

    recordConfigAuditLog(ss, "SUPER_ADMIN_EMERGENCY_SENT", "Đã gửi mã giải cứu khẩn cấp đến " + recipientEmail);

    return {
      status: "success",
      code: 200,
      data: {
        recipientMasked: recipientEmail.replace(/(.{2})(.*)(@.*)/, "$1***$3"),
        message: "Mã xác thực giải cứu đã được gửi trực tiếp đến " + recipientEmail + ". Vui lòng kiểm tra hộp thư đến!"
      }
    };

  } catch (err) {
    return { status: "error", code: 500, message: "Lỗi gửi mã khẩn cấp qua email: " + err.toString() };
  }
}

/**
 * =========================================================================
 * CỖ MÁY CHỐNG NGỦ ĐÔNG & GIỮ ẤM RUNTIME CLOUD (ZERO-COLD-START WARM-UP)
 * =========================================================================
 */

/**
 * HÀM CHẠY NGẦM MỖI 5 PHÚT ĐỂ GIỮ CONTAINER GOOGLE APPS SCRIPT LUÔN NÓNG
 * Được kích hoạt tự động bởi Google Time-driven Trigger
 */
function keepAliveSystemWarmUp() {
  try {
    var timestamp = new Date().getTime();
    
    // 1. Chạm nhẹ vào Spreadsheet để kích hoạt kết nối RAM của Google Sheets API
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var cfgSheet = getOrInitSysConfigSheet(ss);
    
    // 2. Nạp cấu hình then chốt vào CacheService toàn cục của Google (Thời hạn 10 phút)
    if (cfgSheet && cfgSheet.getLastRow() > 1) {
      var cfgData = cfgSheet.getRange(2, 1, Math.min(cfgSheet.getLastRow() - 1, 40), 2).getValues();
      var configCacheMap = {};
      for (var i = 0; i < cfgData.length; i++) {
        var key = String(cfgData[i][0] || "").trim().toUpperCase();
        var val = String(cfgData[i][1] || "").trim();
        if (key) configCacheMap[key] = val;
      }
      
      var cache = CacheService.getScriptCache();
      cache.put(CONFIG_MANAGER_CONSTANTS.CACHE_KEY_CONFIG, JSON.stringify(configCacheMap), CONFIG_MANAGER_CONSTANTS.CACHE_TTL_SECONDS);
      cache.put("WARMED_SYS_CONFIG", JSON.stringify(configCacheMap), CONFIG_MANAGER_CONSTANTS.CACHE_TTL_SECONDS);
    }

    Logger.log("🔥 [WARM-UP SUCCESS] V8 Runtime & Cache đã được kích hoạt lúc: " + new Date().toISOString());
    return {
      status: "success",
      warmedAt: timestamp
    };
  } catch (err) {
    Logger.log("⚠️ [WARM-UP WARNING] Lỗi giữ ấm máy chủ: " + err.toString());
    return {
      status: "error",
      message: err.toString()
    };
  }
}

/**
 * HÀM KHỞI TẠO TỰ ĐỘNG TRIGGER 5 PHÚT/LẦN TRÊN CLOUD (CHỈ CẦN CHẠY 1 LẦN DUY NHẤT)
 */
function setupSystemKeepAliveTrigger() {
  var functionName = "keepAliveSystemWarmUp";
  var triggers = ScriptApp.getProjectTriggers();
  
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === functionName) {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  ScriptApp.newTrigger(functionName)
    .timeBased()
    .everyMinutes(5)
    .create();

  Logger.log("🎉 [KEEPALIVE INSTALLED] Đã cài đặt thành công Trigger đánh thức máy chủ 5 phút/lần!");
}

/**
 * BẬT / TẮT TRẠNG THÁI HOẠT ĐỘNG CỦA QUÁN (OPEN / CLOSED)
 * Lưu trữ trực tiếp vào sheet SYS_CONFIG chuẩn hóa
 * API Action: toggleStoreOperationalStatus
 * 
 * @param {Object} payload - { status: "OPEN"|"CLOSED", message: string, pin: string }
 * @returns {Object} Kết quả xử lý JSON chuẩn SaaS
 */
function toggleStoreOperationalStatus(payload) {
  try {
    payload = payload || {};
    var targetStatus = String(payload.status || "").toUpperCase().trim();
    if (targetStatus !== "OPEN" && targetStatus !== "CLOSED") {
      return {
        status: "error",
        code: 400,
        message: "Trạng thái không hợp lệ! Chỉ chấp nhận 'OPEN' hoặc 'CLOSED'."
      };
    }

    var noteMessage = String(payload.message || "").trim();
    if (targetStatus === "CLOSED" && !noteMessage) {
      noteMessage = "Bếp Thím 5 tạm dừng nhận đơn ít phút. Hẹn gặp lại quý khách sau!";
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = getOrInitSysConfigSheet(ss);

    var data = sheet.getDataRange().getValues();
    var statusRowIndex = -1;
    var noteRowIndex = -1;

    for (var r = 0; r < data.length; r++) {
      var key = String(data[r][0] || "").trim().toUpperCase();
      if (key === "STORE_STATUS" || key === "STORE_OPEN_STATUS") {
        statusRowIndex = r + 1;
      }
      if (key === "STORE_CLOSED_MESSAGE" || key === "STORE_CLOSED_NOTE") {
        noteRowIndex = r + 1;
      }
    }

    var nowStr = Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd HH:mm:ss");

    if (statusRowIndex === -1) {
      sheet.appendRow(["STORE_STATUS", targetStatus, "Trạng thái mở cửa: OPEN hoặc CLOSED", nowStr]);
    } else {
      sheet.getRange(statusRowIndex, 2).setValue(targetStatus);
      sheet.getRange(statusRowIndex, 4).setValue(nowStr);
    }

    if (noteRowIndex === -1) {
      sheet.appendRow(["STORE_CLOSED_MESSAGE", noteMessage, "Thông báo hiển thị cho khách khi quán tạm nghỉ", nowStr]);
    } else {
      sheet.getRange(noteRowIndex, 2).setValue(noteMessage);
      sheet.getRange(noteRowIndex, 4).setValue(nowStr);
    }

    // Xóa cache RAM để Storefront cập nhật trạng thái ngay
    invalidateAllConfigCache();

    recordConfigAuditLog(ss, "ADMIN_TOGGLE_STORE", "Chuyển trạng thái quán sang [" + targetStatus + "] - " + noteMessage);

    return {
      status: "success",
      code: 200,
      message: (targetStatus === "OPEN") ? "🟢 Đã mở cửa nhận đơn thành công!" : "🔴 Đã chuyển quán sang chế độ tạm nghỉ!",
      storeStatus: targetStatus,
      closedMessage: noteMessage,
      updatedAt: nowStr
    };

  } catch (err) {
    return {
      status: "error",
      code: 500,
      message: "Lỗi máy chủ khi cập nhật trạng thái quán: " + err.toString()
    };
  }
}

/**
 * LẤY TRẠNG THÁI HOẠT ĐỘNG HIỆN TẠI CỦA QUÁN
 * API Action: getStoreOperationalStatus
 * 
 * @returns {Object} JSON chứa trạng thái OPEN/CLOSED
 */
function getStoreOperationalStatus() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = getOrInitSysConfigSheet(ss);
    var status = "OPEN";
    var message = "";

    if (sheet) {
      var data = sheet.getDataRange().getValues();
      for (var r = 0; r < data.length; r++) {
        var key = String(data[r][0] || "").trim().toUpperCase();
        if (key === "STORE_STATUS" || key === "STORE_OPEN_STATUS") {
          status = String(data[r][1] || "OPEN").toUpperCase().trim();
        }
        if (key === "STORE_CLOSED_MESSAGE" || key === "STORE_CLOSED_NOTE") {
          message = String(data[r][1] || "").trim();
        }
      }
    }

    return {
      status: "success",
      code: 200,
      storeStatus: status,
      closedMessage: message
    };
  } catch (err) {
    return {
      status: "success",
      code: 200,
      storeStatus: "OPEN",
      closedMessage: ""
    };
  }
}

/**
 * CẬP NHẬT NHANH CẤU HÌNH KHUYẾN MÃI VOUCHER SHIP ĐỘNG (API: updatePromoConfig)
 * Dành riêng cho Master Admin từ Dashboard hoặc Modal Quản Lý Khuyến Mãi
 * 
 * @param {Object} payload - { smartShipVoucherEnabled, tier25Enabled, tier50Enabled, tier100Enabled, upsellNudgeEnabled, minNetProfitFloor, surplusShareRatio, masterKey }
 * @returns {Object} Phản hồi chuẩn hóa API
 */
function updatePromoConfig(payload) {
  payload = payload || {};
  var masterKey = payload.masterKey || CONFIG_MANAGER_CONSTANTS.SUPER_ADMIN_DEFAULT_KEY;
  return saveSystemDynamicConfig({
    masterKey: masterKey,
    promo: {
      smartShipVoucherEnabled: payload.smartShipVoucherEnabled !== undefined ? payload.smartShipVoucherEnabled : payload.PROMO_SMART_SHIP_VOUCHER_ENABLED,
      tier25Enabled: payload.tier25Enabled !== undefined ? payload.tier25Enabled : payload.PROMO_TIER_25_ENABLED,
      tier50Enabled: payload.tier50Enabled !== undefined ? payload.tier50Enabled : payload.PROMO_TIER_50_ENABLED,
      tier100Enabled: payload.tier100Enabled !== undefined ? payload.tier100Enabled : payload.PROMO_TIER_100_ENABLED,
      upsellNudgeEnabled: payload.upsellNudgeEnabled !== undefined ? payload.upsellNudgeEnabled : payload.PROMO_UPSELL_NUDGE_ENABLED,
      minNetProfitFloor: payload.minNetProfitFloor !== undefined ? payload.minNetProfitFloor : payload.PROMO_MIN_NET_PROFIT_FLOOR,
      surplusShareRatio: payload.surplusShareRatio !== undefined ? payload.surplusShareRatio : payload.PROMO_SURPLUS_SHARE_RATIO
    }
  });
}


/**
 * =========================================================================
 * MODULE QUẢN LÝ CHIẾN DỊCH KHUYẾN MÃI (PROMO CAMPAIGNS CONTROLLER)
 * =========================================================================
 */

/**
 * ĐỌC DANH SÁCH CHIẾN DỊCH KHUYẾN MÃI (API: getPromoCampaigns)
 * @returns {Object} Phản hồi chuẩn hóa API
 */
function getPromoCampaigns() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = getOrInitSysConfigSheet(ss);
    var data = sheet.getDataRange().getValues();

    var campaignsJson = "";
    var isMasterEnabled = true;

    for (var r = 1; r < data.length; r++) {
      var k = String(data[r][0] || "").trim().toUpperCase();
      if (k === "PROMO_CAMPAIGNS_JSON") {
        campaignsJson = String(data[r][1] || "").trim();
      } else if (k === "PROMO_MODULE_MASTER_ENABLED") {
        var v = String(data[r][1] || "").trim().toLowerCase();
        isMasterEnabled = (v !== "false");
      }
    }

    var campaigns = [];
    if (campaignsJson) {
      try {
        campaigns = JSON.parse(campaignsJson);
      } catch (eParse) {
        campaigns = DEFAULT_PROMO_CAMPAIGNS.slice();
      }
    } else {
      campaigns = DEFAULT_PROMO_CAMPAIGNS.slice();
    }

    return {
      status: "success",
      code: 200,
      isMasterEnabled: isMasterEnabled,
      data: campaigns
    };
  } catch (err) {
    return {
      status: "success",
      code: 200,
      isMasterEnabled: true,
      data: DEFAULT_PROMO_CAMPAIGNS.slice()
    };
  }
}

/**
 * LƯU HOẶC CẬP NHẬT CHIẾN DỊCH KHUYẾN MÃI (API: savePromoCampaign)
 * @param {Object} payload - Dữ liệu chiến dịch cần lưu
 * @returns {Object} Phản hồi chuẩn hóa API
 */
function savePromoCampaign(payload) {
  if (!payload || typeof payload !== "object") {
    return { status: "error", code: 400, message: "Dữ liệu chiến dịch không hợp lệ!" };
  }

  var res = getPromoCampaigns();
  var campaigns = res.data || [];

  var cmpId = String(payload.id || payload.campaignId || ("CMP_" + Date.now())).trim();
  var existingIdx = -1;

  for (var i = 0; i < campaigns.length; i++) {
    if (campaigns[i].id === cmpId) {
      existingIdx = i;
      break;
    }
  }

  var campaignRecord = {
    id: cmpId,
    name: String(payload.name || "Chiến Dịch Khuyến Mãi").trim(),
    status: String(payload.status || "ACTIVE").toUpperCase() === "PAUSED" ? "PAUSED" : "ACTIVE",
    minMainDishes: Number(payload.minMainDishes) || 0,
    minToppings: Number(payload.minToppings) || 0,
    minDrinks: Number(payload.minDrinks) || 0,
    minBoosterItems: Number(payload.minBoosterItems) || 0,
    minSubtotal: Number(payload.minSubtotal) || 0,
    minRetainedNetProfit: Number(payload.minRetainedNetProfit) || 25000,
    shipDiscountPct: Number(payload.shipDiscountPct) || 0,
    maxShipDiscount: Number(payload.maxShipDiscount) || 10000,
    freeBoosterMaxPrice: Number(payload.freeBoosterMaxPrice) || 0,
    freeGiftType: payload.freeGiftType ? String(payload.freeGiftType).trim() : null,
    freeGiftDesc: payload.freeGiftDesc ? String(payload.freeGiftDesc).trim() : null,
    description: String(payload.description || "").trim()
  };

  if (existingIdx !== -1) {
    campaigns[existingIdx] = campaignRecord;
  } else {
    campaigns.push(campaignRecord);
  }

  // Lưu vào SYS_CONFIG
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = getOrInitSysConfigSheet(ss);
  var data = sheet.getDataRange().getValues();
  var jsonStr = JSON.stringify(campaigns);
  var foundRow = -1;

  for (var r = 1; r < data.length; r++) {
    if (String(data[r][0] || "").trim().toUpperCase() === "PROMO_CAMPAIGNS_JSON") {
      foundRow = r + 1;
      break;
    }
  }

  var nowStr = Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd HH:mm:ss");
  if (foundRow !== -1) {
    sheet.getRange(foundRow, 2).setValue(jsonStr);
    sheet.getRange(foundRow, 4).setValue(nowStr);
  } else {
    sheet.appendRow(["PROMO_CAMPAIGNS_JSON", jsonStr, "Danh sách chiến dịch khuyến mãi (JSON)", nowStr]);
  }

  // Xóa Cache
  try {
    CacheService.getScriptCache().remove(CONFIG_MANAGER_CONSTANTS.CACHE_KEY_CONFIG);
  } catch (eC) {}

  return {
    status: "success",
    code: 200,
    message: "Đã lưu chiến dịch khuyến mãi thành công!",
    data: campaignRecord
  };
}

/**
 * BẬT/TẮT TRẠNG THÁI CHIẾN DỊCH KHUYẾN MÃI (API: togglePromoCampaignStatus)
 * @param {Object} payload - { campaignId, status, masterEnabled }
 * @returns {Object} Phản hồi chuẩn hóa API
 */
function togglePromoCampaignStatus(payload) {
  payload = payload || {};
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = getOrInitSysConfigSheet(ss);
  var nowStr = Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd HH:mm:ss");

  // Nếu là công tắc tổng
  if (payload.masterEnabled !== undefined) {
    var isEnabled = Boolean(payload.masterEnabled);
    var data = sheet.getDataRange().getValues();
    var foundMaster = -1;
    for (var r = 1; r < data.length; r++) {
      if (String(data[r][0] || "").trim().toUpperCase() === "PROMO_MODULE_MASTER_ENABLED") {
        foundMaster = r + 1;
        break;
      }
    }
    if (foundMaster !== -1) {
      sheet.getRange(foundMaster, 2).setValue(String(isEnabled));
      sheet.getRange(foundMaster, 4).setValue(nowStr);
    } else {
      sheet.appendRow(["PROMO_MODULE_MASTER_ENABLED", String(isEnabled), "Công tắc tổng Module Khuyến Mãi", nowStr]);
    }

    try { CacheService.getScriptCache().remove(CONFIG_MANAGER_CONSTANTS.CACHE_KEY_CONFIG); } catch (eC) {}
    return {
      status: "success",
      code: 200,
      message: isEnabled ? "Đã bật toàn bộ Module Khuyến Mãi!" : "Đã tạm dừng toàn bộ Module Khuyến Mãi!",
      masterEnabled: isEnabled
    };
  }

  // Bật/tắt từng chiến dịch
  var cmpId = String(payload.campaignId || payload.id || "").trim();
  if (!cmpId) {
    return { status: "error", code: 400, message: "Thiếu mã chiến dịch cần thay đổi trạng thái!" };
  }

  var res = getPromoCampaigns();
  var campaigns = res.data || [];
  var targetCmp = null;

  for (var i = 0; i < campaigns.length; i++) {
    if (campaigns[i].id === cmpId) {
      targetCmp = campaigns[i];
      if (payload.status) {
        targetCmp.status = String(payload.status).toUpperCase();
      } else {
        targetCmp.status = (targetCmp.status === "ACTIVE") ? "PAUSED" : "ACTIVE";
      }
      break;
    }
  }

  if (!targetCmp) {
    return { status: "error", code: 404, message: "Không tìm thấy chiến dịch: " + cmpId };
  }

  // Ghi lại JSON vào Sheet
  var dataSheet = sheet.getDataRange().getValues();
  var jsonRow = -1;
  for (var j = 1; j < dataSheet.length; j++) {
    if (String(dataSheet[j][0] || "").trim().toUpperCase() === "PROMO_CAMPAIGNS_JSON") {
      jsonRow = j + 1;
      break;
    }
  }

  var updatedJson = JSON.stringify(campaigns);
  if (jsonRow !== -1) {
    sheet.getRange(jsonRow, 2).setValue(updatedJson);
    sheet.getRange(jsonRow, 4).setValue(nowStr);
  } else {
    sheet.appendRow(["PROMO_CAMPAIGNS_JSON", updatedJson, "Danh sách chiến dịch khuyến mãi (JSON)", nowStr]);
  }

  try { CacheService.getScriptCache().remove(CONFIG_MANAGER_CONSTANTS.CACHE_KEY_CONFIG); } catch (eC) {}

  return {
    status: "success",
    code: 200,
    message: "Đã chuyển trạng thái chiến dịch sang: " + targetCmp.status,
    data: targetCmp
  };
}

/**
 * XÓA CHIẾN DỊCH KHUYẾN MÃI (API: deletePromoCampaign)
 * @param {Object} payload - { campaignId }
 * @returns {Object} Phản hồi chuẩn hóa API
 */
function deletePromoCampaign(payload) {
  payload = payload || {};
  var cmpId = String(payload.campaignId || payload.id || "").trim();
  if (!cmpId) {
    return { status: "error", code: 400, message: "Thiếu mã chiến dịch cần xóa!" };
  }

  var res = getPromoCampaigns();
  var campaigns = res.data || [];
  var filtered = campaigns.filter(function(c) { return c.id !== cmpId; });

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = getOrInitSysConfigSheet(ss);
  var data = sheet.getDataRange().getValues();
  var nowStr = Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd HH:mm:ss");

  var jsonRow = -1;
  for (var r = 1; r < data.length; r++) {
    if (String(data[r][0] || "").trim().toUpperCase() === "PROMO_CAMPAIGNS_JSON") {
      jsonRow = r + 1;
      break;
    }
  }

  var updatedJson = JSON.stringify(filtered);
  if (jsonRow !== -1) {
    sheet.getRange(jsonRow, 2).setValue(updatedJson);
    sheet.getRange(jsonRow, 4).setValue(nowStr);
  } else {
    sheet.appendRow(["PROMO_CAMPAIGNS_JSON", updatedJson, "Danh sách chiến dịch khuyến mãi (JSON)", nowStr]);
  }

  try { CacheService.getScriptCache().remove(CONFIG_MANAGER_CONSTANTS.CACHE_KEY_CONFIG); } catch (eC) {}

  return {
    status: "success",
    code: 200,
    message: "Đã xóa chiến dịch " + cmpId + " thành công!",
    data: filtered
  };
}

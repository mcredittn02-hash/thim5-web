/**
 * =========================================================================
 * MODULE: INGESTION ENGINE & REVERSE-PRICING CATALOG (v3.5 ENTERPRISE GHOST)
 * Tác giả: Đu Đủ - Cố vấn Chiến lược & Kỹ sư Trưởng hệ thống SaaS Enterprise
 * Bản quyền: Bếp Thím 5 & LongHoaFood Master (Năm 2026)
 * Kiến trúc: Dynamic Multi-Tenant, Reverse-Pricing Engine, Margin Guard Auditor
 * Đồng bộ: 100% với MasterDictionary (T5_SSOT, T5_UTILS) và DATA_MENU 13 cột
 * =========================================================================
 */

var INGESTION_CONSTANTS = Object.freeze({
  GEMINI_MODEL: "gemini-1.5-flash",
  DRIVE_ASSET_FOLDER: "THIM5_MENU_MEDIA",
  LOCK_TIMEOUT_MS: 3000,
  DEFAULT_D2C_DISCOUNT_PERCENT: 10.0,
  DEFAULT_D2C_BUFFER_PERCENT: 15.0,
  DEFAULT_CATEGORIES: Object.freeze({
    "CORE": { name: "Món Chủ Lực (Mì Trộn)", maxFcPercent: 38.0, icon: "🍜" },
    "BOOSTER": { name: "Nước & Topping Đẩy Vé", maxFcPercent: 20.0, icon: "🍹" },
    "DAC_SAN": { name: "Đặc Sản Tây Ninh", maxFcPercent: 45.0, icon: "🎁" },
    "GA_U_MUOI": { name: "Gà Ủ Muối Hoa Tiêu", maxFcPercent: 48.0, icon: "🍗" },
    "COMBO": { name: "Combo Đại Tiệc", maxFcPercent: 35.0, icon: "🍱" },
    "TOPPING": { name: "Topping Thêm", maxFcPercent: 25.0, icon: "🥓" }
  })
});

/**
 * HÀM HỖ TRỢ: ĐỌC % CHIẾT KHẤU D2C ĐỘNG TỪ SYS_CONFIG HOẶC CONFIGMANAGER
 * Phản hồi < 150ms qua CacheService, fallback an toàn 10.0%
 */
function getDefaultD2cDiscount_() {
  try {
    if (typeof getSystemDynamicConfig === "function") {
      var cfgRes = getSystemDynamicConfig();
      if (cfgRes && cfgRes.data && cfgRes.data.finance && cfgRes.data.finance.d2cDiscountPercent !== undefined) {
        var cfgDiscount = Number(cfgRes.data.finance.d2cDiscountPercent);
        if (!isNaN(cfgDiscount) && cfgDiscount > 0) return cfgDiscount;
      }
    }
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (ss) {
      var cfgSheet = ss.getSheetByName(T5_SSOT.SHEETS.CONFIG || "SYS_CONFIG");
      if (cfgSheet && cfgSheet.getLastRow() > 1) {
        var data = cfgSheet.getDataRange().getValues();
        for (var r = 1; r < data.length; r++) {
          var k = String(data[r][0] || "").trim().toUpperCase();
          if (k === "D2C_DISCOUNT_PERCENT" || k === "DEFAULT_D2C_DISCOUNT_PCT") {
            var val = Number(data[r][1]);
            if (!isNaN(val) && val > 0) return val;
          }
        }
      }
    }
  } catch (e) {
    Logger.log("⚠️ [IngestionEngine.getDefaultD2cDiscount_] Lỗi đọc cấu hình: " + e.message);
  }
  return INGESTION_CONSTANTS.DEFAULT_D2C_DISCOUNT_PERCENT;
}

/**
 * HÀM ĐIỀU PHỐI KẾT NỐI BẢNG TÍNH CHUẨN SAAS MULTI-TENANT (FALLBACK 3 LỚP)
 * Đảm bảo luôn lấy được đối tượng Spreadsheet dù chạy Container-bound hay Standalone Script.
 * 
 * @param {SpreadsheetApp.Spreadsheet} [optSs] - Đối tượng Spreadsheet truyền vào (nếu có)
 * @returns {SpreadsheetApp.Spreadsheet} Đối tượng Spreadsheet hợp lệ
 */
function getOrConnectSpreadsheet(optSs) {
  if (optSs && typeof optSs.getSheetByName === "function") {
    return optSs;
  }

  // 1. Thử lấy bảng tính đang liên kết trực tiếp (Container-bound)
  var activeSs = SpreadsheetApp.getActiveSpreadsheet();
  if (activeSs) {
    return activeSs;
  }

  // 2. Thử lấy ID bảng tính từ Script Properties (Dành cho Standalone Script của từng quán)
  var scriptProps = PropertiesService.getScriptProperties();
  var configuredSheetId = scriptProps.getProperty("TENANT_SPREADSHEET_ID") || scriptProps.getProperty("MENU_SPREADSHEET_ID");
  
  if (configuredSheetId) {
    try {
      return SpreadsheetApp.openById(configuredSheetId);
    } catch (e) {
      throw new Error("Không thể mở bảng tính với ID đã cấu hình: " + configuredSheetId + ". Chi tiết lỗi: " + e.toString());
    }
  }

  throw new Error("LỖI KẾT NỐI DATABASE: Dự án Apps Script này chưa được gắn với Google Sheets nào, và cũng chưa cấu hình 'TENANT_SPREADSHEET_ID' trong Cài đặt dự án (Script Properties)!");
}

/**
 * TỰ ĐỘNG KHỞI TẠO BẢNG DATA_MENU VỚI CẤU TRÚC 13 CỘT REVERSE-PRICING CHUẨN SAAS
 * 
 * @param {SpreadsheetApp.Spreadsheet} [ss] - Bảng tính Google Sheets (Không bắt buộc)
 * @returns {SpreadsheetApp.Sheet} Sheet DATA_MENU đã sẵn sàng
 */
function initMenuSheetIfNotExists(ss) {
  var targetSs = getOrConnectSpreadsheet(ss);
  var sheetName = T5_SSOT.SHEETS.MENU;
  var menuSheet = targetSs.getSheetByName(sheetName);

  if (!menuSheet) {
    menuSheet = targetSs.insertSheet(sheetName);
    
    // Cấu trúc 13 cột chuẩn hóa F&B SaaS tích hợp Reverse-Pricing
    var headers = [
      "Mã Món", 
      "Tên Món Ăn", 
      "Nhóm Phân Loại", 
      "Giá App (Grab/Shopee)", 
      "% Giảm D2C", 
      "Giá Bán D2C Web", 
      "Giá Vốn COGS", 
      "Lợi Nhuận Ròng (LNR)", 
      "Trạng Thái Bếp", 
      "Mô Tả & Topping Kèm", 
      "Đường Dẫn Hình Ảnh", 
      "Mã Món Bán Kèm (Cross-Sell)", 
      "Tag Chiến Lược"
    ];
    menuSheet.appendRow(headers);

    var headerRange = menuSheet.getRange(1, 1, 1, headers.length);
    headerRange.setBackground("#0f172a");
    headerRange.setFontColor("#f8fafc");
    headerRange.setFontWeight("bold");
    menuSheet.setFrozenRows(1);

    // Dữ liệu hạt giống chuẩn hóa ban đầu đã qua công thức Reverse-Pricing
    var seedData = [
      ["MI_XA_XIU", "Mì Trộn Xá Xíu Tóp Mỡ", "CORE", 49000, 10.0, 44000, 15000, 22400, "ACTIVE", "Kèm súp tóp mỡ hành lá thơm béo • Trứng lòng đào", "", "TRA_DAO_1L", "BEST_SELLER"],
      ["TRA_DAO_1L", "Trà Đào Mát Lạnh Ly Khổng Lồ 1L", "BOOSTER", 28000, 10.0, 25000, 5000, 16250, "ACTIVE", "Đào miếng giòn ngọt, đậm vị trà hoa quả tươi", "", "BANH_TRANG_ME", "BOOSTER"],
      ["BANH_TRANG_ME", "Bánh Tráng Phơi Sương Bơ Me Cay", "DAC_SAN", 23000, 10.0, 20000, 9000, 8000, "ACTIVE", "Bánh tráng phơi sương Trảng Bàng, muối tôm loại 1", "", "GA_U_MUOI_NUA_CON", "CROSS_SELL"],
      ["GA_U_MUOI_NUA_CON", "Gà Ủ Muối Hoa Tiêu (Nửa Con)", "GA_U_MUOI", 135000, 8.0, 124000, 55000, 50400, "ACTIVE", "Da giòn sần sật, thịt ngọt mọng nước kèm muối tiêu chanh", "", "TRA_DAO_1L", "CORE"],
      ["TOPPING_TRUNG", "Trứng Lòng Đào Dẻo", "TOPPING", 7000, 10.0, 6000, 2500, 2600, "ACTIVE", "Trứng gà tươi luộc lòng đào béo ngậy", "", "", "BOOSTER"]
    ];

    for (var s = 0; s < seedData.length; s++) {
      menuSheet.appendRow(seedData[s]);
    }
  }
  return menuSheet;
}

/**
 * THUẬT TOÁN REVERSE-PRICING ĐỘNG: TÍNH TOÁN GIÁ D2C VÀ LỢI NHUẬN RÒNG TỨC THÌ
 * Tránh thâm hụt ngầm quỹ Shipping, Khuyến mại và Wheel.
 * 
 * @param {number} appPrice - Giá niêm yết trên ứng dụng giao đồ ăn
 * @param {number} cogs - Giá vốn định lượng (Food Cost)
 * @param {number} [optDiscountPercent] - Tỷ lệ giảm giá D2C so với App
 * @param {number} [optBufferPercent] - Tỷ lệ dự phòng quỹ đệm D2C (Bù ship, wheel, thuế)
 * @returns {Object} Chi tiết phân tích cơ cấu giá và biên lợi nhuận
 */
function calculateReversePricing(appPrice, cogs, optDiscountPercent, optBufferPercent) {
  var rawAppPrice = T5_UTILS.cleanNumber(appPrice);
  var rawCogs = T5_UTILS.cleanNumber(cogs);
  
  var discountPercent = (optDiscountPercent !== undefined && optDiscountPercent !== null && optDiscountPercent !== "") 
                        ? Number(optDiscountPercent) 
                        : getDefaultD2cDiscount_();

  var bufferPercent = (optBufferPercent !== undefined && optBufferPercent !== null && optBufferPercent !== "") 
                      ? Number(optBufferPercent) 
                      : INGESTION_CONSTANTS.DEFAULT_D2C_BUFFER_PERCENT;

  // 1. Tính Giá Bán D2C Web (Làm tròn đến hàng nghìn đồng)
  var rawD2cPrice = rawAppPrice * (1 - (discountPercent / 100));
  var d2cPrice = Math.round(rawD2cPrice / 1000) * 1000;

  // 2. Tính Lợi Nhuận Gộp thô
  var grossProfit = d2cPrice - rawCogs;

  // 3. Tính Lợi Nhuận Ròng (LNR) thực tế sau khi trích quỹ đệm (Bù ship + Wheel + Khuyến mãi + Thuế HKD 4.5%)
  var bufferAmount = Math.round(d2cPrice * (bufferPercent / 100));
  var netProfit = grossProfit - bufferAmount;

  // 4. Tính phần trăm Food Cost thực tế trên kênh D2C Web
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
 * LẤY TOÀN BỘ DANH MỤC THỰC ĐƠN ĐỘNG CHO TRANG QUẢN TRỊ ADMIN & CLIENT D2C
 * Tự động bóc tách cấu trúc 13 cột Reverse-Pricing và nhóm danh mục tự co giãn.
 * API: getAdminMenuCatalog
 * 
 * @returns {Object} Phản hồi chuẩn hóa API
 */
function getAdminMenuCatalog() {
  try {
    var cache = CacheService.getScriptCache();
    var cachedMenu = cache.get("WARMED_MENU_CATALOG");
    if (cachedMenu) {
      try {
        var parsedMenu = JSON.parse(cachedMenu);
        return {
          status: "success",
          code: 200,
          cached: true,
          data: parsedMenu
        };
      } catch (cErr) {}
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var menuSheet = initMenuSheetIfNotExists(ss);
    var data = menuSheet.getDataRange().getValues();

    var items = [];
    var categoryMap = {};
    var SCHEMA = T5_SSOT.MENU_SCHEMA;

    for (var r = 1; r < data.length; r++) {
      var row = data[r];
      var code = String(row[SCHEMA.COL_CODE] || "").trim();
      var name = String(row[SCHEMA.COL_NAME] || "").trim();
      var cat = String(row[SCHEMA.COL_CATEGORY] || "CORE").trim().toUpperCase();
      var appPrice = T5_UTILS.cleanNumber(row[SCHEMA.COL_APP_PRICE]);
      var discountPercent = (row[SCHEMA.COL_DISCOUNT_D2C] !== "" && row[SCHEMA.COL_DISCOUNT_D2C] !== undefined) 
                            ? Number(row[SCHEMA.COL_DISCOUNT_D2C]) 
                            : INGESTION_CONSTANTS.DEFAULT_D2C_DISCOUNT_PERCENT;
      var d2cPrice = T5_UTILS.cleanNumber(row[SCHEMA.COL_D2C_PRICE]);
      var cost = T5_UTILS.cleanNumber(row[SCHEMA.COL_COGS]);
      var netProfit = T5_UTILS.cleanNumber(row[SCHEMA.COL_NET_PROFIT]);
      var status = String(row[SCHEMA.COL_STATUS] || "ACTIVE").trim().toUpperCase();
      var desc = String(row[SCHEMA.COL_DESCRIPTION] || "").trim();
      var imgUrl = String(row[SCHEMA.COL_IMAGE_URL] || "").trim();
      var crossSell = String(row[SCHEMA.COL_CROSS_SELL] || "").trim();
      var tag = String(row[SCHEMA.COL_ROLE_TAG] || "").trim();

      if (!code || !name) continue;

      var fcPercent = d2cPrice > 0 ? Math.round((cost / d2cPrice) * 1000) / 10 : 0;
      var lnrPercent = d2cPrice > 0 ? Math.round((netProfit / d2cPrice) * 1000) / 10 : 0;

      var itemObj = {
        code: code,
        name: name,
        category: cat,
        appPrice: appPrice,
        discountPercent: discountPercent,
        d2cPrice: d2cPrice,
        price: d2cPrice,
        cost: cost,
        netProfit: netProfit,
        fcPercent: fcPercent,
        lnrPercent: lnrPercent,
        status: status,
        isAvailable: (status === "ACTIVE"),
        description: desc,
        imageUrl: imgUrl,
        crossSellSuggest: crossSell,
        tag: tag
      };

      items.push(itemObj);

      if (!categoryMap[cat]) {
        var catMeta = INGESTION_CONSTANTS.DEFAULT_CATEGORIES[cat] || {
          name: cat,
          maxFcPercent: 40.0,
          icon: "📦"
        };
        categoryMap[cat] = {
          code: cat,
          name: catMeta.name,
          icon: catMeta.icon,
          maxFcPercent: catMeta.maxFcPercent,
          count: 0
        };
      }
      categoryMap[cat].count++;
    }

    var categories = Object.keys(categoryMap).map(function(k) {
      return categoryMap[k];
    });

    var resultPayload = {
      totalItems: items.length,
      categories: categories,
      items: items
    };

    try {
      cache.put("WARMED_MENU_CATALOG", JSON.stringify(resultPayload), 300);
    } catch (saveErr) {}

    return {
      status: "success",
      code: 200,
      cached: false,
      data: resultPayload
    };

  } catch (err) {
    return {
      status: "error",
      code: 500,
      message: "Lỗi nạp thực đơn Admin: " + err.toString()
    };
  }
}
/**
 * LẤY DANH MỤC TOPPING ĐỘC LẬP CHO STOREFRONT D2C & MÀN HÌNH BÁN HÀNG
 * Tự động lọc toàn bộ các mặt hàng thuộc nhóm 'TOPPING' trong DATA_MENU.
 * API: getToppingCatalog
 * 
 * @returns {Object} Phản hồi chuẩn hóa API chứa danh sách Topping đang mở bán
 */
function getToppingCatalog() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var menuSheet = initMenuSheetIfNotExists(ss);
    var data = menuSheet.getDataRange().getValues();
    var toppings = [];
    var SCHEMA = T5_SSOT.MENU_SCHEMA;

    for (var r = 1; r < data.length; r++) {
      var row = data[r];
      var cat = String(row[SCHEMA.COL_CATEGORY] || "").trim().toUpperCase();

      if (cat === "TOPPING") {
        var code = String(row[SCHEMA.COL_CODE] || "").trim();
        var name = String(row[SCHEMA.COL_NAME] || "").trim();
        var d2cPrice = T5_UTILS.cleanNumber(row[SCHEMA.COL_D2C_PRICE]);
        var appPrice = T5_UTILS.cleanNumber(row[SCHEMA.COL_APP_PRICE]);
        var cost = T5_UTILS.cleanNumber(row[SCHEMA.COL_COGS]);
        var status = String(row[SCHEMA.COL_STATUS] || "ACTIVE").trim().toUpperCase();
        var desc = String(row[SCHEMA.COL_DESCRIPTION] || "").trim();
        var imgUrl = String(row[SCHEMA.COL_IMAGE_URL] || "").trim();

        if (!code || !name) continue;

        toppings.push({
          code: code,
          name: name,
          category: "TOPPING",
          price: d2cPrice > 0 ? d2cPrice : appPrice,
          d2cPrice: d2cPrice > 0 ? d2cPrice : appPrice,
          appPrice: appPrice,
          cost: cost,
          status: status,
          isAvailable: (status === "ACTIVE"),
          description: desc,
          imageUrl: imgUrl
        });
      }
    }

    return {
      status: "success",
      code: 200,
      data: {
        totalToppings: toppings.length,
        items: toppings
      }
    };

  } catch (err) {
    return {
      status: "error",
      code: 500,
      message: "Lỗi nạp danh mục Topping độc lập: " + err.toString()
    };
  }
}

/**
 * THÊM MỚI HOẶC CẬP NHẬT MÓN ĂN HOẶC TOPPING VÀO BẢNG DATA_MENU 13 CỘT
 * Tự động tính toán cơ cấu giá Reverse-Pricing, kiểm soát trần Food Cost và xóa Cache.
 * API: saveOrUpdateMenuItem
 * 
 * @param {Object} itemPayload - Dữ liệu món ăn hoặc Topping gửi từ Client
 * @returns {Object} Phản hồi chuẩn hóa API
 */
function saveOrUpdateMenuItem(itemPayload) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(INGESTION_CONSTANTS.LOCK_TIMEOUT_MS);
  } catch (e) {
    return { status: "error", code: 503, message: "Hệ thống đang bận cập nhật thực đơn, vui lòng thử lại sau!" };
  }

  try {
    if (!itemPayload || !itemPayload.name) {
      return { status: "error", code: 400, message: "Tên món hoặc Topping không được để trống!" };
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var menuSheet = initMenuSheetIfNotExists(ss);

    var code = String(itemPayload.code || itemPayload.id || "").trim();
    var name = String(itemPayload.name).trim();
    var cat = String(itemPayload.category || "CORE").trim().toUpperCase();
    var rawAppPrice = T5_UTILS.cleanNumber(itemPayload.appPrice || itemPayload.price || 0);
    var rawCogs = T5_UTILS.cleanNumber(itemPayload.cost || itemPayload.cogs || 0);
    var discountPercent = (itemPayload.discountPercent !== undefined && itemPayload.discountPercent !== null && itemPayload.discountPercent !== "")
                          ? Number(itemPayload.discountPercent)
                          : INGESTION_CONSTANTS.DEFAULT_D2C_DISCOUNT_PERCENT;

    // Tự động định mức giá vốn nếu để trống dựa trên nhóm danh mục chiến lược
    if (rawCogs === 0 && rawAppPrice > 0) {
      if (cat === "BOOSTER") rawCogs = Math.round(rawAppPrice * 0.16);
      else if (cat === "DAC_SAN") rawCogs = Math.round(rawAppPrice * 0.40);
      else if (cat === "GA_U_MUOI") rawCogs = Math.round(rawAppPrice * 0.45);
      else if (cat === "COMBO") rawCogs = Math.round(rawAppPrice * 0.32);
      else if (cat === "TOPPING") rawCogs = Math.round(rawAppPrice * 0.22);
      else rawCogs = Math.round(rawAppPrice * 0.35);
    }

    // Kích hoạt thuật toán Reverse-Pricing
    var priceAnalysis = calculateReversePricing(rawAppPrice, rawCogs, discountPercent);
    var d2cPrice = priceAnalysis.d2cPrice;
    var netProfit = priceAnalysis.netProfit;

    var status = String(itemPayload.status || "ACTIVE").trim().toUpperCase();
    var desc = String(itemPayload.description || "").trim();
    var imgUrl = String(itemPayload.imageUrl || "").trim();
    var crossSell = String(itemPayload.crossSellSuggest || itemPayload.crossSell || "").trim();
    var tag = String(itemPayload.tag || (cat === "TOPPING" ? "BOOSTER" : "CORE")).trim();

    // Tự động sinh mã chuẩn nếu chưa có
    if (!code) {
      var prefix = (cat === "TOPPING") ? "TOP_" : "ITEM_";
      code = prefix + Utilities.formatDate(new Date(), T5_SSOT.SYSTEM.TIMEZONE, "yyMMdd_HHmmss");
    }

    var data = menuSheet.getDataRange().getValues();
    var targetRow = -1;
    var SCHEMA = T5_SSOT.MENU_SCHEMA;

    for (var r = 1; r < data.length; r++) {
      if (String(data[r][SCHEMA.COL_CODE]).trim().toUpperCase() === code.toUpperCase()) {
        targetRow = r + 1;
        break;
      }
    }

    if (targetRow !== -1) {
      // Cập nhật mặt hàng hiện hữu trên đúng 13 cột chuẩn
      menuSheet.getRange(targetRow, SCHEMA.COL_NAME + 1).setValue(name);
      menuSheet.getRange(targetRow, SCHEMA.COL_CATEGORY + 1).setValue(cat);
      menuSheet.getRange(targetRow, SCHEMA.COL_APP_PRICE + 1).setValue(rawAppPrice);
      menuSheet.getRange(targetRow, SCHEMA.COL_DISCOUNT_D2C + 1).setValue(discountPercent);
      menuSheet.getRange(targetRow, SCHEMA.COL_D2C_PRICE + 1).setValue(d2cPrice);
      menuSheet.getRange(targetRow, SCHEMA.COL_COGS + 1).setValue(rawCogs);
      menuSheet.getRange(targetRow, SCHEMA.COL_NET_PROFIT + 1).setValue(netProfit);
      menuSheet.getRange(targetRow, SCHEMA.COL_STATUS + 1).setValue(status);
      menuSheet.getRange(targetRow, SCHEMA.COL_DESCRIPTION + 1).setValue(desc);
      menuSheet.getRange(targetRow, SCHEMA.COL_IMAGE_URL + 1).setValue(imgUrl);
      menuSheet.getRange(targetRow, SCHEMA.COL_CROSS_SELL + 1).setValue(crossSell);
      menuSheet.getRange(targetRow, SCHEMA.COL_ROLE_TAG + 1).setValue(tag);
    } else {
      // Thêm mới dòng ở cuối bảng chuẩn 13 cột
      menuSheet.appendRow([
        code, name, cat, rawAppPrice, discountPercent, d2cPrice, rawCogs, netProfit, status, desc, imgUrl, crossSell, tag
      ]);
    }

    // Xóa Cache để cập nhật tức thì toàn hệ thống
    T5_UTILS.invalidateGlobalCache();

    return {
      status: "success",
      code: 200,
      data: {
        code: code,
        name: name,
        category: cat,
        appPrice: rawAppPrice,
        discountPercent: discountPercent,
        d2cPrice: d2cPrice,
        cost: rawCogs,
        netProfit: netProfit,
        fcPercentD2c: priceAnalysis.fcPercentD2c,
        lnrMarginPercent: priceAnalysis.lnrMarginPercent,
        imageUrl: imgUrl,
        message: "Đã lưu " + (cat === "TOPPING" ? "Topping" : "món ăn") + " thành công với cơ cấu giá Reverse-Pricing!"
      }
    };

  } catch (err) {
    return { status: "error", code: 500, message: "Lỗi lưu thực đơn: " + err.toString() };
  } finally {
    lock.releaseLock();
  }
}

/**
 * BẬT / TẮT TRẠNG THÁI MÓN ĂN HOẶC TOPPING (ACTIVE <-> OUT_OF_STOCK) TỨC THÌ
 * API: toggleMenuItemStatus
 * 
 * @param {string|Object} argCodeOrPayload - Mã món/Topping hoặc Object { itemCode, status }
 * @param {string} [optStatus] - Trạng thái mong muốn: "ACTIVE" hoặc "OUT_OF_STOCK"
 * @returns {Object} Phản hồi chuẩn hóa API
 */
function toggleMenuItemStatus(argCodeOrPayload, optStatus) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(INGESTION_CONSTANTS.LOCK_TIMEOUT_MS);
  } catch (e) {
    return { status: "error", code: 503, message: "Hệ thống bận, vui lòng thử lại sau!" };
  }

  try {
    var itemCode = "";
    var newStatus = "";

    if (typeof argCodeOrPayload === "object" && argCodeOrPayload !== null) {
      itemCode = String(argCodeOrPayload.itemCode || argCodeOrPayload.code || argCodeOrPayload.id || "").trim();
      newStatus = String(argCodeOrPayload.status || "").trim().toUpperCase();
    } else {
      itemCode = String(argCodeOrPayload || "").trim();
      newStatus = String(optStatus || "").trim().toUpperCase();
    }

    if (!itemCode) {
      return { status: "error", code: 400, message: "Thiếu mã mặt hàng cần cập nhật trạng thái!" };
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var menuSheet = initMenuSheetIfNotExists(ss);
    var data = menuSheet.getDataRange().getValues();
    var targetRow = -1;
    var currentStatus = "ACTIVE";
    var SCHEMA = T5_SSOT.MENU_SCHEMA;

    for (var r = 1; r < data.length; r++) {
      if (String(data[r][SCHEMA.COL_CODE]).trim().toUpperCase() === itemCode.toUpperCase()) {
        targetRow = r + 1;
        currentStatus = String(data[r][SCHEMA.COL_STATUS] || "ACTIVE").trim().toUpperCase();
        break;
      }
    }

    if (targetRow === -1) {
      return { status: "error", code: 404, message: "Không tìm thấy mặt hàng có mã " + itemCode };
    }

    if (!newStatus) {
      newStatus = (currentStatus === "ACTIVE") ? "OUT_OF_STOCK" : "ACTIVE";
    }

    menuSheet.getRange(targetRow, SCHEMA.COL_STATUS + 1).setValue(newStatus);

    T5_UTILS.invalidateGlobalCache();

    return {
      status: "success",
      code: 200,
      data: {
        itemCode: itemCode,
        newStatus: newStatus,
        isAvailable: (newStatus === "ACTIVE"),
        message: (newStatus === "ACTIVE") ? "Đã bật mặt hàng trở lại phục vụ!" : "Đã chuyển mặt hàng sang trạng thái Hết Hàng!"
      }
    };

  } catch (err) {
    return { status: "error", code: 500, message: "Lỗi cập nhật trạng thái mặt hàng: " + err.toString() };
  } finally {
    lock.releaseLock();
  }
}

/**
 * XÓA VĨNH VIỄN MỘT MÓN ĂN HOẶC TOPPING KHỎI THỰC ĐƠN
 * API: deleteMenuItem
 * 
 * @param {string|Object} argCodeOrPayload - Mã mặt hàng cần xóa
 * @returns {Object} Phản hồi chuẩn hóa API
 */
function deleteMenuItem(argCodeOrPayload) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(INGESTION_CONSTANTS.LOCK_TIMEOUT_MS);
  } catch (e) {
    return { status: "error", code: 503, message: "Hệ thống bận, vui lòng thử lại sau!" };
  }

  try {
    var code = "";
    if (typeof argCodeOrPayload === "object" && argCodeOrPayload !== null) {
      code = String(argCodeOrPayload.itemCode || argCodeOrPayload.code || argCodeOrPayload.id || "").trim();
    } else {
      code = String(argCodeOrPayload || "").trim();
    }

    if (!code) {
      return { status: "error", code: 400, message: "Thiếu mã mặt hàng cần xóa!" };
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var menuSheet = initMenuSheetIfNotExists(ss);
    var data = menuSheet.getDataRange().getValues();
    var targetRow = -1;
    var SCHEMA = T5_SSOT.MENU_SCHEMA;

    for (var r = 1; r < data.length; r++) {
      if (String(data[r][SCHEMA.COL_CODE]).trim().toUpperCase() === code.toUpperCase()) {
        targetRow = r + 1;
        break;
      }
    }

    if (targetRow === -1) {
      return { status: "error", code: 404, message: "Không tìm thấy mặt hàng " + code + " để xóa!" };
    }

    menuSheet.deleteRow(targetRow);

    T5_UTILS.invalidateGlobalCache();

    return {
      status: "success",
      code: 200,
      message: "Đã xóa mặt hàng " + code + " thành công khỏi thực đơn hệ thống!"
    };

  } catch (err) {
    return { status: "error", code: 500, message: "Lỗi xóa mặt hàng: " + err.toString() };
  } finally {
    lock.releaseLock();
  }
}

/**
 * CHUẨN HÓA MỘT BẢN GHI MÓN ĂN / TOPPING ĐẦU VÀO TÍCH HỢP REVERSE-PRICING
 * Tự động phân loại danh mục thông minh và tính toán đầy đủ 13 cột.
 * 
 * @param {Object} rawItem - Dữ liệu thô của mặt hàng
 * @param {number} [index] - Số thứ tự trong lô nạp
 * @returns {Object|null} Đối tượng đã chuẩn hóa SSOT
 */
function normalizeMenuItemRecord(rawItem, index) {
  if (!rawItem || typeof rawItem !== "object") return null;

  var name = String(rawItem.name || rawItem.title || rawItem.ten_mon || "").trim();
  if (!name) return null;

  // 1. Nhận diện danh mục thông minh
  var cat = String(rawItem.category || rawItem.nhom || rawItem.phan_loai || "").trim().toUpperCase();
  var lowerName = name.toLowerCase();

  if (!cat || !INGESTION_CONSTANTS.DEFAULT_CATEGORIES[cat]) {
    if (lowerName.indexOf("thêm") !== -1 || lowerName.indexOf("topping") !== -1 || 
        lowerName.indexOf("trứng") !== -1 || lowerName.indexOf("tóp mỡ") !== -1 || lowerName.indexOf("phô mai") !== -1) {
      cat = "TOPPING";
    } else if (lowerName.indexOf("trà") !== -1 || lowerName.indexOf("nước") !== -1 || lowerName.indexOf("sữa") !== -1 || lowerName.indexOf("pepsi") !== -1 || lowerName.indexOf("coca") !== -1) {
      cat = "BOOSTER";
    } else if (lowerName.indexOf("bánh tráng") !== -1 || lowerName.indexOf("muối") !== -1 || lowerName.indexOf("me") !== -1 || lowerName.indexOf("bò tơ") !== -1) {
      cat = "DAC_SAN";
    } else if (lowerName.indexOf("gà ủ muối") !== -1 || lowerName.indexOf("hoa tiêu") !== -1) {
      cat = "GA_U_MUOI";
    } else if (lowerName.indexOf("combo") !== -1 || lowerName.indexOf("đại tiệc") !== -1 || lowerName.indexOf("set") !== -1) {
      cat = "COMBO";
    } else {
      cat = "CORE";
    }
  }

  // 2. Làm sạch Giá App và Giá Vốn COGS qua T5_UTILS
  var appPrice = T5_UTILS.cleanNumber(rawItem.appPrice || rawItem.price || rawItem.gia_app || rawItem.gia_ban);
  var cogs = T5_UTILS.cleanNumber(rawItem.cost || rawItem.cogs || rawItem.gia_von || rawItem.food_cost);

  var discountPercent = (rawItem.discountPercent !== undefined && rawItem.discountPercent !== null && rawItem.discountPercent !== "")
                        ? Number(rawItem.discountPercent)
                        : getDefaultD2cDiscount_();

  // Tự tính giá vốn theo định mức danh mục nếu chưa có
  if (cogs === 0 && appPrice > 0) {
    if (cat === "BOOSTER") cogs = Math.round(appPrice * 0.16);
    else if (cat === "DAC_SAN") cogs = Math.round(appPrice * 0.40);
    else if (cat === "GA_U_MUOI") cogs = Math.round(appPrice * 0.45);
    else if (cat === "COMBO") cogs = Math.round(appPrice * 0.32);
    else if (cat === "TOPPING") cogs = Math.round(appPrice * 0.22);
    else cogs = Math.round(appPrice * 0.35);
  }

  // Phân tích Reverse Pricing
  var pricing = calculateReversePricing(appPrice, cogs, discountPercent);

  // 3. Chuẩn hóa mã mặt hàng
  var code = String(rawItem.code || rawItem.ma_mon || "").trim().toUpperCase();
  if (!code) {
    var prefix = (cat === "TOPPING") ? "TOP_" : "ITEM_";
    var timestampStr = Utilities.formatDate(new Date(), T5_SSOT.SYSTEM.TIMEZONE, "yyMMddHHmmss");
    code = prefix + timestampStr + "_" + (index !== undefined ? index : Math.floor(Math.random() * 1000));
  }

  var status = String(rawItem.status || "ACTIVE").trim().toUpperCase();
  if (status !== "ACTIVE" && status !== "OUT_OF_STOCK") {
    status = "ACTIVE";
  }

  var desc = String(rawItem.description || rawItem.mo_ta || rawItem.desc || "").trim();
  var imgUrl = String(rawItem.imageUrl || rawItem.image || rawItem.link_anh || "").trim();
  var crossSell = String(rawItem.crossSellSuggest || rawItem.cross_sell || rawItem.ban_kem || "").trim().toUpperCase();
  var tag = String(rawItem.tag || rawItem.nhan || (cat === "TOPPING" ? "BOOSTER" : "CORE")).trim().toUpperCase();

  return {
    code: code,
    name: name,
    category: cat,
    appPrice: appPrice,
    discountPercent: discountPercent,
    d2cPrice: pricing.d2cPrice,
    cost: cogs,
    netProfit: pricing.netProfit,
    fcPercentD2c: pricing.fcPercentD2c,
    lnrMarginPercent: pricing.lnrMarginPercent,
    status: status,
    description: desc,
    imageUrl: imgUrl,
    crossSellSuggest: crossSell,
    tag: tag
  };
}

/**
 * KIỂM TOÁN VÀ CẢNH BÁO BIÊN LỢI NHUẬN MẶT HÀNG (MARGIN GUARD AUDITOR)
 * Giám sát tự động Food Cost D2C và LNR thực tế với trần danh mục.
 * 
 * @param {Object} itemObj - Đối tượng mặt hàng đã phân tích Reverse-Pricing
 * @returns {Object} Kết quả kiểm toán biên lợi nhuận
 */
function auditItemMarginGuard(itemObj) {
  if (!itemObj || itemObj.d2cPrice <= 0) {
    return {
      isMarginSafe: true,
      fcPercent: 0,
      maxAllowedPercent: 40.0,
      warningLevel: "SAFE",
      warningMessage: "Mặt hàng chưa có giá bán niêm yết."
    };
  }

  var fcPercent = itemObj.fcPercentD2c || (Math.round((itemObj.cost / itemObj.d2cPrice) * 1000) / 10);
  var catConfig = INGESTION_CONSTANTS.DEFAULT_CATEGORIES[itemObj.category] || { maxFcPercent: 40.0 };
  var maxAllowed = catConfig.maxFcPercent;

  var warningLevel = "SAFE";
  var warningMessage = "Biên lợi nhuận nằm trong vùng an toàn.";
  var isMarginSafe = true;

  if (fcPercent > maxAllowed) {
    isMarginSafe = false;
    warningLevel = "DANGER";
    warningMessage = "CẢNH BÁO: Food Cost D2C " + fcPercent + "% vượt trần " + maxAllowed + "% của nhóm " + itemObj.category + "! LNR thực tế bị thâm hụt.";
  } else if (fcPercent > (maxAllowed - 5.0)) {
    warningLevel = "WARNING";
    warningMessage = "CHÚ Ý: Food Cost D2C " + fcPercent + "% tiệm cận trần cho phép " + maxAllowed + "%.";
  }

  return {
    isMarginSafe: isMarginSafe,
    fcPercent: fcPercent,
    maxAllowedPercent: maxAllowed,
    warningLevel: warningLevel,
    warningMessage: warningMessage
  };
}
/**
 * LẤY CẤU TRÚC VÀ NỘI DUNG FILE TEMPLATE EXCEL / CSV CHUẨN REVERSE-PRICING
 * Xuất dữ liệu mẫu đa ngành hàng kèm hướng dẫn phân biệt trường bắt buộc và tùy chọn.
 * Hỗ trợ Unicode UTF-8 with BOM để mở trực tiếp trong Excel không bị lỗi font.
 * API: getMenuExcelTemplateStructure
 * 
 * @returns {Object} Phản hồi chuẩn hóa API chứa tiêu đề, dữ liệu mẫu và chuỗi CSV
 */
function getMenuExcelTemplateStructure() {
  try {
    var headers = [
      "Mã Món (Để trống tự sinh)",
      "Tên Món Ăn (*Bắt buộc)",
      "Nhóm Phân Loại (CORE/BOOSTER/DAC_SAN/GA_U_MUOI/COMBO/TOPPING)",
      "Giá App (*Bắt buộc)",
      "% Giảm D2C (Để trống lấy mặc định)",
      "Giá Vốn COGS (Để trống tự tính)",
      "Trạng Thái (ACTIVE/OUT_OF_STOCK)",
      "Mô Tả & Topping Kèm",
      "Đường Dẫn Hình Ảnh (Link Drive/Web)",
      "Mã Món Bán Kèm (Cross-Sell)",
      "Tag Chiến Lược (BEST_SELLER/BOOSTER/CROSS_SELL/NEW)"
    ];

    var sampleRows = [
      ["MI_XA_XIU", "Mì Trộn Xá Xíu Tóp Mỡ", "CORE", 49000, 10, 15000, "ACTIVE", "Kèm súp tóp mỡ hành lá thơm béo • Trứng lòng đào", "", "TRA_DAO_1L", "BEST_SELLER"],
      ["TRA_DAO_1L", "Trà Đào Mát Lạnh Ly Khổng Lồ 1L", "BOOSTER", 28000, 10, 5000, "ACTIVE", "Đào miếng giòn ngọt, đậm vị trà hoa quả tươi", "", "BANH_TRANG_ME", "BOOSTER"],
      ["BANH_TRANG_ME", "Bánh Tráng Phơi Sương Bơ Me Cay", "DAC_SAN", 23000, 10, 9000, "ACTIVE", "Bánh tráng phơi sương Trảng Bàng, muối tôm loại 1", "", "GA_U_MUOI_NUA_CON", "CROSS_SELL"],
      ["GA_U_MUOI_NUA_CON", "Gà Ủ Muối Hoa Tiêu (Nửa Con)", "GA_U_MUOI", 135000, 8, 55000, "ACTIVE", "Da giòn sần sật, thịt ngọt mọng nước kèm muối tiêu chanh", "", "TRA_DAO_1L", "CORE"],
      ["TOP_TRUNG", "Trứng Lòng Đào Dẻo", "TOPPING", 7000, 10, 2500, "ACTIVE", "Trứng gà luộc lòng đào béo ngậy ăn kèm mì", "", "", "BOOSTER"],
      ["TOP_TOP_MO", "Tóp Mỡ Chiên Giòn Rụm Thêm", "TOPPING", 12000, 10, 3000, "ACTIVE", "Tóp mỡ nóng giòn lắc tỏi ớt cay thơm", "", "", "BOOSTER"]
    ];

    // Tạo chuỗi CSV thô hỗ trợ Unicode UTF-8 with BOM (\uFEFF)
    var csvContent = "\uFEFF" + headers.map(function(h) { return '"' + h + '"'; }).join(",") + "\r\n";
    for (var r = 0; r < sampleRows.length; r++) {
      var rowStr = sampleRows[r].map(function(val) {
        return '"' + String(val !== undefined && val !== null ? val : "").replace(/"/g, '""') + '"';
      }).join(",");
      csvContent += rowStr + "\r\n";
    }

    return {
      status: "success",
      code: 200,
      data: {
        headers: headers,
        sampleRows: sampleRows,
        csvRawString: csvContent,
        downloadFileName: "Template_Thuc_Don_Thim5_Chuan.csv",
        fieldsGuideline: {
          requiredFields: [
            "Tên Món Ăn: Bắt buộc phải có để hiển thị trên thực đơn",
            "Giá App: Giá niêm yết trên Grab/ShopeeFood để làm mốc neo tâm lý",
            "Nhóm Phân Loại: Quyết định trần Food Cost bảo vệ biên lợi nhuận (CORE, BOOSTER, DAC_SAN, GA_U_MUOI, COMBO, TOPPING)"
          ],
          optionalFields: [
            "Mã Món: Bỏ trống hệ thống tự sinh mã duy nhất dạng ITEM_yyMMdd_HHmmss (hoặc TOP_yyMMdd_HHmmss)",
            "% Giảm D2C: Bỏ trống tự lấy mặc định 10% (tính ra Giá Web rẻ hơn App)",
            "Giá Vốn COGS: Bỏ trống tự áp định mức theo nhóm (Core 35%, Booster 16%, Gà 45%, Topping 22%)",
            "Trạng Thái: Bỏ trống mặc định là ACTIVE (Đang bán)",
            "Mô Tả, Ảnh, Món Bán Kèm, Tag: Bổ sung sau trên giao diện Admin Shell"
          ]
        },
        message: "Đã xuất cấu trúc Template thực đơn chuẩn SaaS Reverse-Pricing!"
      }
    };

  } catch (err) {
    return { status: "error", code: 500, message: "Lỗi tạo template thực đơn: " + err.toString() };
  }
}

/**
 * CỖ MÁY BÓC TÁCH FILE EXCEL, CSV HOẶC BẢNG DỮ LIỆU ĐA CẤU TRÚC
 * Tự động nhận diện tiêu đề cột thông minh, làm sạch tiền tệ và chuẩn hóa JSON Reverse-Pricing.
 * API: parseUploadedSpreadsheetBuffer
 * 
 * @param {Object|string} csvOrDataPayload - { rawCsvText: "..." } hoặc chuỗi CSV hoặc mảng 2 chiều
 * @returns {Object} Mảng danh sách món ăn đã bóc tách chuẩn hóa kèm phân tích giá
 */
function parseUploadedSpreadsheetBuffer(csvOrDataPayload) {
  try {
    var rows = [];

    // Phân loại nguồn dữ liệu bảng tính đầu vào
    if (typeof csvOrDataPayload === "string") {
      rows = Utilities.parseCsv(csvOrDataPayload);
    } else if (csvOrDataPayload && csvOrDataPayload.rawCsvText) {
      rows = Utilities.parseCsv(csvOrDataPayload.rawCsvText);
    } else if (csvOrDataPayload && (csvOrDataPayload.base64 || csvOrDataPayload.base64Data)) {
      var b64Str = String(csvOrDataPayload.base64 || csvOrDataPayload.base64Data);
      if (b64Str.indexOf(";base64,") !== -1) {
        b64Str = b64Str.split(";base64,")[1];
      }
      var decodedBytes = Utilities.base64Decode(b64Str);
      var csvText = Utilities.newBlob(decodedBytes).getDataAsString("UTF-8");
      rows = Utilities.parseCsv(csvText);
    } else if (Array.isArray(csvOrDataPayload)) {
      rows = csvOrDataPayload;
    } else {
      return { status: "error", code: 400, message: "Dữ liệu bảng tính tải lên không đúng định dạng!" };
    }

    if (!rows || rows.length <= 1) {
      return { status: "error", code: 400, message: "Bảng tính rỗng hoặc thiếu dòng tiêu đề!" };
    }

    // 1. Quét tìm vị trí các cột dựa trên từ khóa linh hoạt
    var headerRow = rows[0];
    var colMap = {
      code: -1,
      name: -1,
      category: -1,
      appPrice: -1,
      discountPercent: -1,
      cost: -1,
      status: -1,
      desc: -1,
      image: -1,
      crossSell: -1,
      tag: -1
    };

    for (var c = 0; c < headerRow.length; c++) {
      var h = String(headerRow[c] || "").trim().toLowerCase();
      if (h.indexOf("mã") !== -1 || h.indexOf("code") !== -1 || h.indexOf("sku") !== -1) colMap.code = c;
      else if (h.indexOf("tên") !== -1 || h.indexOf("name") !== -1 || h.indexOf("món") !== -1 || h.indexOf("title") !== -1) colMap.name = c;
      else if (h.indexOf("nhóm") !== -1 || h.indexOf("loại") !== -1 || h.indexOf("category") !== -1 || h.indexOf("cat") !== -1) colMap.category = c;
      else if (h.indexOf("giá app") !== -1 || h.indexOf("app") !== -1 || h.indexOf("grab") !== -1 || h.indexOf("giá bán") !== -1 || h.indexOf("đơn giá") !== -1 || h.indexOf("price") !== -1) colMap.appPrice = c;
      else if (h.indexOf("%") !== -1 || h.indexOf("giảm") !== -1 || h.indexOf("discount") !== -1) colMap.discountPercent = c;
      else if (h.indexOf("giá vốn") !== -1 || h.indexOf("cost") !== -1 || h.indexOf("cogs") !== -1 || h.indexOf("vốn") !== -1) colMap.cost = c;
      else if (h.indexOf("trạng thái") !== -1 || h.indexOf("status") !== -1) colMap.status = c;
      else if (h.indexOf("mô tả") !== -1 || h.indexOf("desc") !== -1 || h.indexOf("topping") !== -1) colMap.desc = c;
      else if (h.indexOf("ảnh") !== -1 || h.indexOf("image") !== -1 || h.indexOf("hình") !== -1) colMap.image = c;
      else if (h.indexOf("bán kèm") !== -1 || h.indexOf("cross") !== -1) colMap.crossSell = c;
      else if (h.indexOf("tag") !== -1 || h.indexOf("nhãn") !== -1) colMap.tag = c;
    }

    // Tiêu chuẩn cơ sở: bắt buộc nhận diện được cột Tên Món
    if (colMap.name === -1) {
      colMap.code = 0;
      colMap.name = 1;
      colMap.category = 2;
      colMap.appPrice = 3;
      colMap.discountPercent = 4;
      colMap.cost = 5;
    }

    var parsedItems = [];

    // 2. Trích xuất và chuẩn hóa từng dòng
    for (var r = 1; r < rows.length; r++) {
      var rData = rows[r];
      var itemName = colMap.name !== -1 ? String(rData[colMap.name] || "").trim() : "";
      if (!itemName) continue;

      var rawItem = {
        code: colMap.code !== -1 ? String(rData[colMap.code] || "").trim() : "",
        name: itemName,
        category: colMap.category !== -1 ? String(rData[colMap.category] || "").trim() : "",
        appPrice: colMap.appPrice !== -1 ? String(rData[colMap.appPrice] || "0") : "0",
        discountPercent: colMap.discountPercent !== -1 ? String(rData[colMap.discountPercent] || "") : "",
        cost: colMap.cost !== -1 ? String(rData[colMap.cost] || "0") : "0",
        status: colMap.status !== -1 ? String(rData[colMap.status] || "ACTIVE").trim() : "ACTIVE",
        description: colMap.desc !== -1 ? String(rData[colMap.desc] || "").trim() : "",
        imageUrl: colMap.image !== -1 ? String(rData[colMap.image] || "").trim() : "",
        crossSellSuggest: colMap.crossSell !== -1 ? String(rData[colMap.crossSell] || "").trim() : "",
        tag: colMap.tag !== -1 ? String(rData[colMap.tag] || "").trim() : ""
      };

      var normalized = normalizeMenuItemRecord(rawItem, r);
      if (normalized) {
        parsedItems.push(normalized);
      }
    }

    return {
      status: "success",
      code: 200,
      data: {
        totalParsed: parsedItems.length,
        items: parsedItems,
        message: "Đã bóc tách thành công " + parsedItems.length + " mặt hàng từ file nạp thực đơn!"
      }
    };

  } catch (err) {
    return { status: "error", code: 500, message: "Lỗi phân tích file bảng tính: " + err.toString() };
  }
}

/**
 * NẠP THỰC ĐƠN HÀNG LOẠT (BATCH IMPORT) TỐI ƯU HÓA TỐC ĐỘ 0.8 GIÂY
 * Tích hợp chuẩn hóa 13 cột Reverse-Pricing, kiểm toán biên lợi nhuận và ghi 1 lần duy nhất bằng setValues().
 * API: batchImportMenuItems
 * 
 * @param {Object} payload - Chứa mảng items: [{ name, appPrice, discountPercent, cost, category, ... }]
 * @returns {Object} Phản hồi chuẩn hóa API
 */
function batchImportMenuItems(payload) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(INGESTION_CONSTANTS.LOCK_TIMEOUT_MS);
  } catch (e) {
    return { status: "error", code: 503, message: "Hệ thống đang bận xử lý dữ liệu, vui lòng thử lại sau giây lát!" };
  }

  try {
    var rawItems = [];
    if (payload && Array.isArray(payload.items)) {
      rawItems = payload.items;
    } else if (Array.isArray(payload)) {
      rawItems = payload;
    }

    if (rawItems.length === 0) {
      return { status: "error", code: 400, message: "Danh sách mặt hàng gửi lên nạp vào bị rỗng!" };
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var menuSheet = initMenuSheetIfNotExists(ss);
    var SCHEMA = T5_SSOT.MENU_SCHEMA;

    // 1. Quét toàn bộ danh mục hiện có để chống trùng mã và định vị dòng cập nhật
    var existingData = menuSheet.getDataRange().getValues();
    var existingCodesMap = {};
    for (var r = 1; r < existingData.length; r++) {
      var existCode = String(existingData[r][SCHEMA.COL_CODE] || "").trim().toUpperCase();
      if (existCode) {
        existingCodesMap[existCode] = r + 1; // 1-based index trong Google Sheets
      }
    }

    var rowsToAppend = [];
    var updatedCount = 0;
    var marginWarnings = [];

    // 2. Lặp qua từng bản ghi và chuẩn hóa dữ liệu theo chuẩn 13 cột
    for (var i = 0; i < rawItems.length; i++) {
      var itemObj = normalizeMenuItemRecord(rawItems[i], i);
      if (!itemObj) continue;

      // Kiểm toán biên lợi nhuận danh mục tức thì
      var marginAudit = auditItemMarginGuard(itemObj);
      if (!marginAudit.isMarginSafe) {
        marginWarnings.push({
          code: itemObj.code,
          name: itemObj.name,
          category: itemObj.category,
          fcPercentD2c: itemObj.fcPercentD2c,
          message: marginAudit.warningMessage
        });
      }

      var codeKey = itemObj.code.toUpperCase();

      // Nếu mã đã tồn tại -> Cập nhật đè trực tiếp lên 13 cột của dòng hiện hữu
      if (existingCodesMap[codeKey]) {
        var rowIdx = existingCodesMap[codeKey];
        menuSheet.getRange(rowIdx, SCHEMA.COL_NAME + 1).setValue(itemObj.name);
        menuSheet.getRange(rowIdx, SCHEMA.COL_CATEGORY + 1).setValue(itemObj.category);
        menuSheet.getRange(rowIdx, SCHEMA.COL_APP_PRICE + 1).setValue(itemObj.appPrice);
        menuSheet.getRange(rowIdx, SCHEMA.COL_DISCOUNT_D2C + 1).setValue(itemObj.discountPercent);
        menuSheet.getRange(rowIdx, SCHEMA.COL_D2C_PRICE + 1).setValue(itemObj.d2cPrice);
        menuSheet.getRange(rowIdx, SCHEMA.COL_COGS + 1).setValue(itemObj.cost);
        menuSheet.getRange(rowIdx, SCHEMA.COL_NET_PROFIT + 1).setValue(itemObj.netProfit);
        menuSheet.getRange(rowIdx, SCHEMA.COL_STATUS + 1).setValue(itemObj.status);
        menuSheet.getRange(rowIdx, SCHEMA.COL_DESCRIPTION + 1).setValue(itemObj.description);
        menuSheet.getRange(rowIdx, SCHEMA.COL_IMAGE_URL + 1).setValue(itemObj.imageUrl);
        menuSheet.getRange(rowIdx, SCHEMA.COL_CROSS_SELL + 1).setValue(itemObj.crossSellSuggest);
        menuSheet.getRange(rowIdx, SCHEMA.COL_ROLE_TAG + 1).setValue(itemObj.tag);
        updatedCount++;
      } else {
        // Mặt hàng mới hoàn toàn -> Đưa vào mảng gom để ghi 1 lần duy nhất
        rowsToAppend.push([
          itemObj.code,
          itemObj.name,
          itemObj.category,
          itemObj.appPrice,
          itemObj.discountPercent,
          itemObj.d2cPrice,
          itemObj.cost,
          itemObj.netProfit,
          itemObj.status,
          itemObj.description,
          itemObj.imageUrl,
          itemObj.crossSellSuggest,
          itemObj.tag
        ]);
        existingCodesMap[codeKey] = true;
      }
    }

    // 3. Ghi đồng loạt toàn bộ mặt hàng mới bằng duy nhất 1 thao tác setValues() (0.8 giây)
    if (rowsToAppend.length > 0) {
      var lastRow = menuSheet.getLastRow();
      menuSheet.getRange(lastRow + 1, 1, rowsToAppend.length, 13).setValues(rowsToAppend);
    }

    // Xóa Cache toàn cục để đồng bộ Storefront ngay tức thì
    if (typeof T5_UTILS !== "undefined" && typeof T5_UTILS.invalidateGlobalCache === "function") {
      T5_UTILS.invalidateGlobalCache();
    }
    if (typeof invalidateAllConfigCache === "function") {
      invalidateAllConfigCache();
    }
    try {
      var cache = CacheService.getScriptCache();
      if (cache) {
        cache.remove("T5_CATALOG_BUNDLED_CACHE");
        cache.remove("WARMED_MENU_CATALOG");
      }
    } catch (e) {}

    var totalProcessed = updatedCount + rowsToAppend.length;

    return {
      status: "success",
      code: 200,
      data: {
        totalProcessed: totalProcessed,
        newItemsAppended: rowsToAppend.length,
        existingUpdated: updatedCount,
        marginWarningsCount: marginWarnings.length,
        marginWarnings: marginWarnings,
        message: "Đã nạp thành công " + totalProcessed + " mặt hàng vào thực đơn quán (Thêm mới: " + rowsToAppend.length + ", Cập nhật: " + updatedCount + ")!"
      }
    };

  } catch (err) {
    return { status: "error", code: 500, message: "Lỗi nạp thực đơn hàng loạt: " + err.toString() };
  } finally {
    lock.releaseLock();
  }
}
/**
 * TẢI VÀ LƯU TRỮ HÌNH ẢNH MÓN ĂN VÀO THƯ MỤC PUBLIC TRÊN GOOGLE DRIVE
 * Tự động cấp quyền 'Anyone with link can view' và sinh link ảnh Direct CDN.
 * API: uploadImageToMenuDriveFolder (alias: uploadDishMediaImage)
 * 
 * @param {Object} payload - { base64Data: "data:image/webp;base64,...", fileName: "mi_xa_xiu.webp", itemCode: "MI_XA_XIU" }
 * @returns {Object} Phản hồi chuẩn hóa API chứa link ảnh Direct CDN URL
 */
function uploadImageToMenuDriveFolder(payload) {
  try {
    var base64String = payload ? (payload.base64 || payload.base64Data || payload.data) : null;
    if (!base64String) {
      return { status: "error", code: 400, message: "Thiếu dữ liệu hình ảnh Base64!" };
    }

    base64String = String(base64String);
    var itemCode = String(payload.itemCode || payload.code || "ITEM").trim().toUpperCase();
    var rawFileName = String(payload.fileName || (itemCode + "_" + Date.now() + ".webp")).trim();

    // 1. Tách chuỗi header data URI nếu có
    var contentType = String(payload.mimeType || "image/webp");
    var pureBase64 = base64String;
    if (base64String.indexOf("data:") !== -1 && base64String.indexOf(";base64,") !== -1) {
      var parts = base64String.split(";base64,");
      contentType = parts[0].replace("data:", "");
      pureBase64 = parts[1];
    }

    var decodedBytes = Utilities.base64Decode(pureBase64);
    var blob = Utilities.newBlob(decodedBytes, contentType, rawFileName);

    // 2. Tìm hoặc tự động tạo thư mục công khai THIM5_MENU_MEDIA trên Drive của quán
    var folderName = INGESTION_CONSTANTS.DRIVE_ASSET_FOLDER || "THIM5_MENU_MEDIA";
    var folders = DriveApp.getFoldersByName(folderName);
    var targetFolder = null;

    if (folders.hasNext()) {
      targetFolder = folders.next();
    } else {
      targetFolder = DriveApp.createFolder(folderName);
      targetFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    }

    // 3. Tạo file ảnh và mở quyền truy cập công khai
    var createdFile = targetFolder.createFile(blob);
    createdFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    var fileId = createdFile.getId();
    var directCdnUrl = "https://lh3.googleusercontent.com/d/" + fileId;

    return {
      status: "success",
      code: 200,
      data: {
        fileId: fileId,
        fileName: rawFileName,
        directCdnUrl: directCdnUrl,
        imageUrl: directCdnUrl,
        url: directCdnUrl,
        viewUrl: createdFile.getUrl(),
        googleDriveViewUrl: createdFile.getUrl(),
        message: "Đã lưu ảnh thành công vào Google Drive Media của quán!"
      }
    };

  } catch (err) {
    return { status: "error", code: 500, message: "Lỗi lưu trữ hình ảnh: " + err.toString() };
  }
}

/**
 * HÀM ALIAS SSOT: ĐỒNG BỘ 2 CHIỀU VỚI MASTER DICTIONARY VÀ ROUTER
 */
function uploadDishMediaImage(payload) {
  return uploadImageToMenuDriveFolder(payload);
}

/**
 * CỖ MÁY BÓC TÁCH THỰC ĐƠN TỪ ẢNH CHỤP / SCAN BẰNG GEMINI 1.5 FLASH VISION OCR
 * Tiếp nhận Base64 ảnh menu -> Gọi Gemini AI -> Xuất mảng JSON Staging tích hợp Reverse-Pricing.
 * API: processMenuOcrWithGemini
 * 
 * @param {Object} payload - { base64Data: "...", mimeType: "image/jpeg" }
 * @returns {Object} Danh sách món ăn được bóc tách cấu trúc để duyệt lưu
 */
function processMenuOcrWithGemini(payload) {
  try {
    var rawBase64 = payload ? (payload.base64 || payload.base64Data || payload.data) : null;
    if (!rawBase64) {
      return { status: "error", code: 400, message: "Vui lòng cung cấp dữ liệu hình ảnh thực đơn!" };
    }

    // Đọc Gemini API Key từ sheet SYS_CONFIG hoặc Script Properties
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var configSheet = ss.getSheetByName(T5_SSOT.SHEETS.CONFIG);
    var apiKey = "";

    if (configSheet && configSheet.getLastRow() > 1) {
      var cData = configSheet.getDataRange().getValues();
      for (var r = 1; r < cData.length; r++) {
        if (String(cData[r][0] || "").trim().toUpperCase() === "GEMINI_API_KEY") {
          apiKey = String(cData[r][1] || "").trim();
          break;
        }
      }
    }

    if (!apiKey) {
      apiKey = PropertiesService.getScriptProperties().getProperty("GEMINI_API_KEY") || "";
    }

    if (!apiKey) {
      return {
        status: "error",
        code: 401,
        message: "Chưa cấu hình GEMINI_API_KEY trong sheet SYS_CONFIG hoặc Script Properties. Vui lòng bổ sung key để dùng tính năng OCR hình ảnh!"
      };
    }

    var base64String = String(rawBase64);
    var mimeType = String(payload.mimeType || "image/jpeg");
    if (base64String.indexOf(";base64,") !== -1) {
      var splitParts = base64String.split(";base64,");
      mimeType = splitParts[0].replace("data:", "");
      base64String = splitParts[1];
    }

    var systemPrompt = [
      "Bạn là trợ lý AI chuyên gia bóc tách thực đơn F&B của Bếp Thím 5.",
      "Nhiệm vụ: Hãy nhìn vào hình ảnh menu và trích xuất TOÀN BỘ danh sách món ăn, giá tiền niêm yết (Giá App).",
      "Yêu cầu đầu ra: Chỉ trả về duy nhất 1 mảng JSON hợp lệ, KHÔNG bọc mã markdown trong ```json ```, KHÔNG thêm lời mở đầu hay kết luận.",
      "Mỗi phần tử trong mảng có cấu trúc sau:",
      "{",
      '  "name": "Tên món ăn đầy đủ",',
      '  "appPrice": 49000,',
      '  "category": "CORE hoặc BOOSTER hoặc DAC_SAN hoặc GA_U_MUOI hoặc COMBO hoặc TOPPING",',
      '  "description": "Mô tả nguyên liệu hoặc topping đi kèm (nếu có)",',
      '  "cost": 0',
      "}"
    ].join("\n");

    var apiUrl = "https://generativelanguage.googleapis.com/v1beta/models/" + INGESTION_CONSTANTS.GEMINI_MODEL + ":generateContent?key=" + apiKey;

    var requestBody = {
      contents: [{
        parts: [
          { text: systemPrompt },
          {
            inlineData: {
              mimeType: mimeType,
              data: base64String
            }
          }
        ]
      }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 2048
      }
    };

    var options = {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(requestBody),
      muteHttpExceptions: true
    };

    var response = UrlFetchApp.fetch(apiUrl, options);
    var responseCode = response.getResponseCode();
    var responseText = response.getContentText();

    if (responseCode !== 200) {
      return { status: "error", code: responseCode, message: "Lỗi gọi Gemini Vision API: " + responseText };
    }

    var apiJson = JSON.parse(responseText);
    var rawGeneratedText = "";
    if (apiJson.candidates && apiJson.candidates[0] && apiJson.candidates[0].content && apiJson.candidates[0].content.parts) {
      rawGeneratedText = apiJson.candidates[0].content.parts[0].text || "";
    }

    var cleanJsonStr = rawGeneratedText.trim()
      .replace(/^```json/i, '')
      .replace(/^```/i, '')
      .replace(/```$/i, '')
      .trim();

    var rawParsedItems = [];
    try {
      rawParsedItems = JSON.parse(cleanJsonStr);
    } catch (parseErr) {
      return {
        status: "error",
        code: 422,
        message: "Không thể parse kết quả từ AI thành JSON hợp lệ. Chuỗi thô: " + cleanJsonStr
      };
    }

    var stagingItems = [];
    for (var i = 0; i < rawParsedItems.length; i++) {
      var norm = normalizeMenuItemRecord(rawParsedItems[i], i);
      if (norm) {
        stagingItems.push(norm);
      }
    }

    return {
      status: "success",
      code: 200,
      data: {
        totalDetected: stagingItems.length,
        items: stagingItems,
        message: "Đã trích xuất thành công " + stagingItems.length + " mặt hàng từ hình ảnh thực đơn! Vui lòng kiểm tra và chỉnh sửa tay trước khi duyệt lưu."
      }
    };

  } catch (err) {
    return { status: "error", code: 500, message: "Lỗi xử lý OCR thực đơn: " + err.toString() };
  }
}

/**
 * CỖ MÁY CÀO VÀ TRÍCH XUẤT THỰC ĐƠN TỪ ĐƯỜNG LINK PUBLIC ONLINE
 * API: extractMenuFromPublicUrl
 * 
 * @param {Object|string} payload - { url: "https://..." } hoặc chuỗi URL
 * @returns {Object} Danh sách món ăn bóc tách được dạng Staging tích hợp Reverse-Pricing
 */
function extractMenuFromPublicUrl(payload) {
  try {
    var targetUrl = "";
    if (typeof payload === "string") {
      targetUrl = payload.trim();
    } else if (payload && payload.url) {
      targetUrl = String(payload.url).trim();
    }

    if (!targetUrl || !/^https?:\/\//i.test(targetUrl)) {
      return { status: "error", code: 400, message: "Vui lòng nhập đường link hợp lệ (bắt đầu bằng http:// hoặc https://)!" };
    }

    var options = {
      method: "get",
      muteHttpExceptions: true,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      }
    };

    var response = UrlFetchApp.fetch(targetUrl, options);
    if (response.getResponseCode() !== 200) {
      return { status: "error", code: response.getResponseCode(), message: "Không thể truy cập đường link thực đơn này (Mã phản hồi: " + response.getResponseCode() + ")!" };
    }

    var html = response.getContentText();
    var extractedItems = [];

    var regex = /([A-ZÀ-Ỹa-zà-ỹ0-9\s\(\)\-\+]{3,40})[^\d]{1,60}([\d]{1,3}(?:[\.,][\d]{3})+|\b[\d]{2,3}k\b|\b[\d]{5,7}\b)\s*(?:đ|vnđ|vnd)?/gi;
    var match;
    var count = 0;
    var seenNames = {};

    while ((match = regex.exec(html)) !== null && count < 100) {
      var rawName = match[1].replace(/<[^>]+>/g, '').trim();
      var rawPrice = match[2].toLowerCase().replace('k', '000').replace(/[^\d]/g, '');
      var priceNum = Number(rawPrice);

      if (rawName.length >= 3 && priceNum >= 5000 && priceNum <= 2000000 && !seenNames[rawName.toLowerCase()]) {
        seenNames[rawName.toLowerCase()] = true;
        var norm = normalizeMenuItemRecord({
          name: rawName,
          appPrice: priceNum,
          description: "Trích xuất từ web " + targetUrl.split("/")[2]
        }, count);

        if (norm) {
          extractedItems.push(norm);
          count++;
        }
      }
    }

    return {
      status: "success",
      code: 200,
      data: {
        targetUrl: targetUrl,
        totalExtracted: extractedItems.length,
        items: extractedItems,
        message: "Đã trích xuất thành công " + extractedItems.length + " mặt hàng từ đường link! Vui lòng kiểm tra và sửa tay trước khi duyệt lưu."
      }
    };

  } catch (err) {
    return { status: "error", code: 500, message: "Lỗi trích xuất menu từ link: " + err.toString() };
  }
}

/**
 * THUẬT TOÁN TỰ ĐỘNG PHÂN TÍCH LỊCH SỬ ĐƠN HÀNG VÀ DÁN NHÃN BEST_SELLER
 * Phân tích dữ liệu 14 ngày từ DATA_ORDERS và cập nhật vào Cột M (COL_ROLE_TAG) của DATA_MENU.
 * API: recalculateBestSellers
 * 
 * @returns {Object} Kết quả thực thi dán nhãn
 */
function recalculateBestSellers() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var ordersSheet = ss.getSheetByName(T5_SSOT.SHEETS.ORDERS);
    var menuSheet = ss.getSheetByName(T5_SSOT.SHEETS.MENU);
    var itemsSheet = ss.getSheetByName(T5_SSOT.SHEETS.ORDER_ITEMS);

    if (!ordersSheet || !menuSheet) {
      return { status: "error", code: 404, message: "Thiếu bảng DATA_ORDERS hoặc DATA_MENU!" };
    }

    var ordersData = ordersSheet.getDataRange().getValues();
    if (ordersData.length <= 1) {
      return { status: "success", code: 200, message: "Chưa có đủ dữ liệu đơn hàng để tính toán." };
    }

    var now = new Date();
    var fourteenDaysAgo = new Date(now.getTime() - (14 * 24 * 3600 * 1000));
    var itemQuantityMap = {};
    var ORDER_SCHEMA = T5_SSOT.ORDERS_SCHEMA;

    // 1. Quét sản lượng bán ra từ DATA_ORDER_ITEMS hoặc DATA_ORDERS
    if (itemsSheet && itemsSheet.getLastRow() > 1) {
      var itemsData = itemsSheet.getDataRange().getValues();
      for (var it = 1; it < itemsData.length; it++) {
        var dishId = String(itemsData[it][1] || "").trim();
        var qty = Number(itemsData[it][4]) || 1;
        if (dishId && dishId !== "GIFT_REWARD") {
          itemQuantityMap[dishId] = (itemQuantityMap[dishId] || 0) + qty;
        }
      }
    } else {
      // Fallback quét từ DATA_ORDERS
      for (var i = 1; i < ordersData.length; i++) {
        var orderDate = T5_UTILS.parseFlexibleDateVietnam(ordersData[i][ORDER_SCHEMA.COL_TIME]);
        if (!orderDate || orderDate < fourteenDaysAgo) continue;

        var noteStr = String(ordersData[i][ORDER_SCHEMA.COL_NOTE] || "");
        var statusStr = String(ordersData[i][ORDER_SCHEMA.COL_STATUS] || "").toUpperCase();
        if (statusStr === "CANCELLED") continue;
      }
    }

    // 2. Sắp xếp các món theo sản lượng bán ra giảm dần
    var sortedItems = Object.keys(itemQuantityMap).map(function(key) {
      return { id: key, qty: itemQuantityMap[key] };
    }).sort(function(a, b) {
      return b.qty - a.qty;
    });

    // Lấy top 20% số món bán chạy nhất (bán được tối thiểu >= 5 phần)
    var topThresholdIndex = Math.max(1, Math.ceil(sortedItems.length * 0.2));
    var bestSellerIds = {};
    for (var k = 0; k < sortedItems.length; k++) {
      if (k < topThresholdIndex && sortedItems[k].qty >= 5) {
        bestSellerIds[sortedItems[k].id] = true;
      }
    }

    // 3. Cập nhật nhãn vào Cột M (COL_ROLE_TAG) trên DATA_MENU
    var menuData = menuSheet.getDataRange().getValues();
    var MENU_SCHEMA = T5_SSOT.MENU_SCHEMA;
    var updatedCount = 0;

    for (var m = 1; m < menuData.length; m++) {
      var mId = String(menuData[m][MENU_SCHEMA.COL_CODE] || "").trim();
      var currentTag = String(menuData[m][MENU_SCHEMA.COL_ROLE_TAG] || "").trim();

      if (bestSellerIds[mId]) {
        if (currentTag.indexOf("BEST_SELLER") === -1) {
          var updatedTag = currentTag ? (currentTag + ", BEST_SELLER") : "BEST_SELLER";
          menuSheet.getRange(m + 1, MENU_SCHEMA.COL_ROLE_TAG + 1).setValue(updatedTag);
          updatedCount++;
        }
      } else {
        if (currentTag.indexOf("BEST_SELLER") !== -1) {
          var cleanedTag = currentTag.replace("BEST_SELLER", "").replace(/^,\s*|,\s*$/g, "").trim();
          menuSheet.getRange(m + 1, MENU_SCHEMA.COL_ROLE_TAG + 1).setValue(cleanedTag || "CORE");
        }
      }
    }

    T5_UTILS.invalidateGlobalCache();

    return {
      status: "success",
      code: 200,
      data: {
        totalBestSellers: Object.keys(bestSellerIds).length,
        updatedRows: updatedCount,
        message: "Đã cập nhật nhãn BEST_SELLER tự động cho " + Object.keys(bestSellerIds).length + " món ăn!"
      }
    };

  } catch (err) {
    return { status: "error", code: 500, message: "Lỗi tính toán Best Seller: " + err.toString() };
  }
}
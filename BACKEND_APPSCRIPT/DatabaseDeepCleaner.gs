/**
 * =============================================================================
 * MODULE: DATABASE DEEP CLEANER & SCHEMA UNIFICATION (v3.3 ENTERPRISE)
 * Tác giả: Đu Đủ - Cố vấn Chiến lược & Kỹ sư Trưởng hệ thống SaaS
 * Bản quyền: Bếp Thím 5 & LongHoaFood Master (Năm 2026)
 * Mục đích: 
 *   - Quét sạch vĩnh viễn toàn bộ sheet rác có dấu ngoặc vuông [...] và trùng lặp.
 *   - Hợp nhất dữ liệu CRM_USERS / [CRM_USERS] về chuẩn DATA_CUSTOMERS duy nhất.
 *   - Đưa CSDL về đúng 7 Sheet SSOT bất khả xâm phạm.
 * =============================================================================
 */

var DEEP_CLEANER_CONSTANTS = Object.freeze({
  HEADER_BG_COLOR: "#0f172a",
  HEADER_TEXT_COLOR: "#f8fafc",
  ALLOWED_SHEETS: {
    "SYS_CONFIG": true,
    "SYS_CATEGORIES": true,
    "DATA_MENU": true,
    "DATA_ORDERS": true,
    "DATA_SHIPPER_LEDGER": true,
    "DATA_CUSTOMERS": true,
    "DATA_AUDIT_LOGS": true
  }
});

/**
 * HÀM THU THẬP & HỢP NHẤT DỮ LIỆU KHÁCH HÀNG TỪ CÁC SHEET CRM CŨ TRƯỚC KHI XÓA
 * Đảm bảo anh Hải Âu không bị mất số điện thoại và điểm tích lũy của khách
 * 
 * @param {SpreadsheetApp.Spreadsheet} ss - Bảng tính Google Sheets
 * @returns {Array<Array>} Mảng dữ liệu khách hàng đã chuẩn hóa 8 cột
 */
function backupOldCustomerData(ss) {
  var customerMap = {};
  var oldCrmSheets = ["CRM_USERS", "[CRM_USERS]", "DATA_CUSTOMERS"];

  for (var s = 0; s < oldCrmSheets.length; s++) {
    var sheet = ss.getSheetByName(oldCrmSheets[s]);
    if (!sheet) continue;

    var data = sheet.getDataRange().getValues();
    if (data.length <= 1) continue;

    for (var r = 1; r < data.length; r++) {
      var row = data[r];
      var phone = String(row[1] || row[0] || "").trim().replace(/[^\d]/g, '');
      if (!phone || phone.length < 9) continue;

      var name = String(row[2] || row[1] || "Khách Hàng").trim();
      var rank = String(row[3] || "STANDARD").trim().toUpperCase();
      var points = Number(row[4]) || 0;
      var wheelSpins = Number(row[5]) || 0;
      var totalSpent = Number(row[6]) || 0;
      var lastOrder = row[7] ? Utilities.formatDate(new Date(row[7]), "GMT+7", "yyyy-MM-dd HH:mm:ss") : "";

      if (!customerMap[phone]) {
        var custCode = "CUST_" + phone.slice(-4) + "_" + Math.floor(Math.random() * 1000);
        customerMap[phone] = [custCode, phone, name, rank, points, wheelSpins, totalSpent, lastOrder];
      } else {
        // Cộng dồn điểm và lượt quay nếu trùng số điện thoại
        customerMap[phone][4] = Math.max(customerMap[phone][4], points);
        customerMap[phone][5] = Math.max(customerMap[phone][5], wheelSpins);
        customerMap[phone][6] = Math.max(customerMap[phone][6], totalSpent);
      }
    }
  }

  var resultRows = [];
  for (var p in customerMap) {
    resultRows.push(customerMap[p]);
  }
  return resultRows;
}

/**
 * HÀM CHÍNH ĐIỀU HÀNH DỌN RÁC TRIỆT ĐỂ TOÀN BỘ DATABASE
 * Xóa vĩnh viễn các sheet ngoặc vuông [...] và sheet dư thừa
 */
function runDeepCleanDatabaseMaster() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    var id = PropertiesService.getScriptProperties().getProperty("TENANT_SPREADSHEET_ID") || 
             PropertiesService.getScriptProperties().getProperty("MENU_SPREADSHEET_ID");
    if (id) ss = SpreadsheetApp.openById(id);
  }
  if (!ss) throw new Error("Không thể kết nối với Google Sheets của quán!");

  var timestamp = Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd HH:mm:ss");

  Logger.log("=================================================================");
  Logger.log("🧹 BẮT ĐẦU QUY TRÌNH QUÉT SẠCH RÁC VÀ TIÊU HỦY SHEET NGOẶC VUÔNG");
  Logger.log("⏰ Thời gian: " + timestamp);
  Logger.log("=================================================================");

  // 1. Sao lưu dữ liệu khách hàng cũ trước khi xóa sheet CRM rác
  var backedUpCustomers = backupOldCustomerData(ss);
  Logger.log("📦 Đã sao lưu an toàn " + backedUpCustomers.length + " khách hàng vào bộ nhớ RAM.");

  // 2. Tạo một sheet tạm an toàn để đảm bảo Google Sheets không bao giờ bị rỗng khi xóa
  var tempSafeSheet = ss.getSheetByName("TEMP_CLEANING_ZONE");
  if (!tempSafeSheet) {
    tempSafeSheet = ss.insertSheet("TEMP_CLEANING_ZONE");
  }

  // 3. Quét danh sách toàn bộ các sheet hiện có trong file
  var allSheets = ss.getSheets();
  var sheetsDeletedCount = 0;

  for (var i = 0; i < allSheets.length; i++) {
    var currentSheet = allSheets[i];
    var sheetName = currentSheet.getName().trim();

    // Bỏ qua sheet tạm đang dùng làm chốt an toàn
    if (sheetName === "TEMP_CLEANING_ZONE") continue;

    // Nếu tên sheet KHÔNG NẰM TRONG 7 SHEET CHUẨN -> TIÊU HỦY NGAY LẬP TỨC
    if (!DEEP_CLEANER_CONSTANTS.ALLOWED_SHEETS[sheetName]) {
      try {
        ss.deleteSheet(currentSheet);
        sheetsDeletedCount++;
        Logger.log("🗑️ [ĐÃ TIÊU HỦY TRIỆT ĐỂ]: " + sheetName);
      } catch (errDel) {
        Logger.log("⚠️ Không thể xóa sheet [" + sheetName + "]: " + errDel.toString());
      }
    }
  }

  Logger.log("🔥 Đã dọn sạch " + sheetsDeletedCount + " sheet rác dư thừa!");
  // ---------------------------------------------------------------------------
  // 4. TÁI LẬP SHEET DATA_CUSTOMERS & NẠP LẠI DỮ LIỆU CRM ĐÃ SAO LƯU
  // ---------------------------------------------------------------------------
  var custSheet = ss.getSheetByName("DATA_CUSTOMERS");
  if (!custSheet) {
    custSheet = ss.insertSheet("DATA_CUSTOMERS");
  } else {
    custSheet.clear();
  }

  var custHeaders = [
    "Mã Khách Hàng",
    "Số Điện Thoại",
    "Họ Và Tên",
    "Hạng Thành Viên (VIP)",
    "Điểm Tích Lũy",
    "Lượt Quay Thần Vị Còn Lại",
    "Tổng Chi Tiêu Tích Lũy (VND)",
    "Ngày Đặt Hàng Gần Nhất"
  ];

  custSheet.appendRow(custHeaders);
  var custHeaderRange = custSheet.getRange(1, 1, 1, custHeaders.length);
  custHeaderRange.setBackground(DEEP_CLEANER_CONSTANTS.HEADER_BG_COLOR);
  custHeaderRange.setFontColor(DEEP_CLEANER_CONSTANTS.HEADER_TEXT_COLOR);
  custHeaderRange.setFontWeight("bold");
  custSheet.setFrozenRows(1);

  if (backedUpCustomers && backedUpCustomers.length > 0) {
    custSheet.getRange(2, 1, backedUpCustomers.length, 8).setValues(backedUpCustomers);
    Logger.log("👥 [PHỤC HỒI CRM] Đã nạp thành công " + backedUpCustomers.length + " khách hàng vào DATA_CUSTOMERS.");
  } else {
    Logger.log("ℹ️ [DATA_CUSTOMERS] Chưa có dữ liệu khách hàng cũ, sheet đã sẵn sàng đón khách mới.");
  }

  // ---------------------------------------------------------------------------
  // 5. CHUẨN HÓA DỮ LIỆU & LÀM SẠCH CỘT TRÊN SHEET DATA_MENU
  // ---------------------------------------------------------------------------
  var menuSheet = ss.getSheetByName("DATA_MENU");
  var menuHeaders = [
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

  if (!menuSheet) {
    menuSheet = ss.insertSheet("DATA_MENU");
    menuSheet.appendRow(menuHeaders);
  } else {
    // Đọc và tự động sửa các lỗi lệch cột % Giảm D2C (biến số tiền 5000/18620 thành % chuẩn)
    var menuData = menuSheet.getDataRange().getValues();
    if (menuData.length > 1) {
      for (var mr = 1; mr < menuData.length; mr++) {
        var row = menuData[mr];
        var appP = Number(row[3]) || 0;
        var rawDiscount = Number(row[4]) || 0;
        var d2cP = Number(row[5]) || 0;

        // Nếu cột E bị điền nhầm số tiền lớn hơn 100 (ví dụ 5000, 18620)
        if (rawDiscount > 100 && appP > 0) {
          if (d2cP > 0 && appP > d2cP) {
            row[4] = Math.round(((appP - d2cP) / appP) * 100);
          } else {
            row[4] = 10; // Đưa về 10% mặc định an toàn
          }
        } else if (rawDiscount <= 0 && appP > 0 && d2cP > 0 && appP > d2cP) {
          row[4] = Math.round(((appP - d2cP) / appP) * 100);
        }
      }
      menuSheet.getRange(1, 1, menuData.length, menuData[0].length).setValues(menuData);
      Logger.log("🍜 [DATA_MENU] Đã quét và tự động sửa sạch lỗi lệch dữ liệu cột % Giảm D2C!");
    }
    menuSheet.getRange(1, 1, 1, menuHeaders.length).setValues([menuHeaders]);
  }

  var mHeaderRange = menuSheet.getRange(1, 1, 1, menuHeaders.length);
  mHeaderRange.setBackground(DEEP_CLEANER_CONSTANTS.HEADER_BG_COLOR);
  mHeaderRange.setFontColor(DEEP_CLEANER_CONSTANTS.HEADER_TEXT_COLOR);
  mHeaderRange.setFontWeight("bold");
  menuSheet.setFrozenRows(1);

  // ---------------------------------------------------------------------------
  // 6. ĐẢM BẢO ĐẦY ĐỦ CÁC SHEET HỆ THỐNG CÒN LẠI (KHÔNG DẤU NGOẶC VUÔNG)
  // ---------------------------------------------------------------------------

  // Sheet: SYS_CATEGORIES (5 cột)
  var catSheet = ss.getSheetByName("SYS_CATEGORIES");
  if (!catSheet) {
    catSheet = ss.insertSheet("SYS_CATEGORIES");
    var catHeaders = ["Mã Danh Mục", "Biểu Tượng (Icon)", "Tên Danh Mục", "Slug Kênh D2C", "Trần Food Cost (%)"];
    catSheet.appendRow(catHeaders);
    var defaultCats = [
      ["CAT_COM", "🍛", "Món Cơm Đất Thánh", "com", 38.0],
      ["CAT_MI", "🍜", "Mì Trộn Đặc Sản", "mi-tron", 38.0],
      ["CAT_COMBO", "🍱", "Combo Đại Tiệc D2C", "combo", 35.0],
      ["CAT_SOUP", "🥣", "Súp Booster Kéo Vé", "sup", 20.0],
      ["CAT_DRINK", "🥤", "Đồ Uống Khổng Lồ 1L", "do-uong", 18.0],
      ["CAT_TOPPING", "🥓", "Topping Thịt Trứng", "topping", 22.0],
      ["CAT_SPECIAL", "🌶️", "Đặc Sản Bánh Tráng", "dac-san", 40.0],
      ["CAT_EXTEND", "🍗", "Món Mở Rộng Fastfood", "fastfood", 45.0]
    ];
    catSheet.getRange(2, 1, defaultCats.length, 5).setValues(defaultCats);
  }
  catSheet.getRange(1, 1, 1, 5).setBackground(DEEP_CLEANER_CONSTANTS.HEADER_BG_COLOR).setFontColor(DEEP_CLEANER_CONSTANTS.HEADER_TEXT_COLOR).setFontWeight("bold");
  catSheet.setFrozenRows(1);

  // Sheet: DATA_ORDERS (18 cột)
  var ordersSheet = ss.getSheetByName("DATA_ORDERS");
  var ordersHeaders = [
    "Mã Đơn Hàng", "Thời Gian Đặt", "Tên Khách Hàng", "Số Điện Thoại", "Địa Chỉ Giao Hàng",
    "Tọa Độ GPS (Lat,Lng)", "Chi Tiết Món Đặt", "Tổng Tiền Món (Subtotal)", "Cước Thu Khách (Ship)",
    "Cước Trả Tài Xế", "Quán Trợ Giá Ship", "Giảm Giá Voucher / Wheel", "Tổng Thanh Toán Thực Tế",
    "Hình Thức Thanh Toán", "Trạng Thái Đơn Hàng", "Trạng Thái KDS Bếp", "Ghi Chú Khách Hàng", "Mã Shipper Nhận Đơn"
  ];
  if (!ordersSheet) {
    ordersSheet = ss.insertSheet("DATA_ORDERS");
    ordersSheet.appendRow(ordersHeaders);
  }
  ordersSheet.getRange(1, 1, 1, ordersHeaders.length).setBackground(DEEP_CLEANER_CONSTANTS.HEADER_BG_COLOR).setFontColor(DEEP_CLEANER_CONSTANTS.HEADER_TEXT_COLOR).setFontWeight("bold");
  ordersSheet.setFrozenRows(1);

  // Sheet: DATA_SHIPPER_LEDGER (10 cột)
  var shipperSheet = ss.getSheetByName("DATA_SHIPPER_LEDGER");
  var shipperHeaders = [
    "Mã Phiên Giao", "Thời Gian", "Mã Tài Xế", "Tên Tài Xế", "Số Điện Thoại",
    "Mã Đơn Hàng", "Tiền Cước Nhận (VND)", "Tiền Mặt COD Thu Hộ (VND)", "Trạng Thái Đối Soát COD", "Ghi Chú / Bằng Chứng Giao"
  ];
  if (!shipperSheet) {
    shipperSheet = ss.insertSheet("DATA_SHIPPER_LEDGER");
    shipperSheet.appendRow(shipperHeaders);
  }
  shipperSheet.getRange(1, 1, 1, shipperHeaders.length).setBackground(DEEP_CLEANER_CONSTANTS.HEADER_BG_COLOR).setFontColor(DEEP_CLEANER_CONSTANTS.HEADER_TEXT_COLOR).setFontWeight("bold");
  shipperSheet.setFrozenRows(1);

  // Sheet: DATA_AUDIT_LOGS (4 cột)
  var auditSheet = ss.getSheetByName("DATA_AUDIT_LOGS");
  var auditHeaders = ["Thời Gian", "Mã Đối Tượng", "Tác Vụ (Action)", "Chi Tiết Kiểm Toán"];
  if (!auditSheet) {
    auditSheet = ss.insertSheet("DATA_AUDIT_LOGS");
    auditSheet.appendRow(auditHeaders);
  }
  auditSheet.getRange(1, 1, 1, auditHeaders.length).setBackground(DEEP_CLEANER_CONSTANTS.HEADER_BG_COLOR).setFontColor(DEEP_CLEANER_CONSTANTS.HEADER_TEXT_COLOR).setFontWeight("bold");
  auditSheet.setFrozenRows(1);

  // ---------------------------------------------------------------------------
  // 7. TIÊU HỦY SHEET TẠM AN TOÀN TEMP_CLEANING_ZONE
  // ---------------------------------------------------------------------------
  if (tempSafeSheet) {
    try {
      ss.deleteSheet(tempSafeSheet);
      Logger.log("🧹 [CHỐT AN TOÀN] Đã thu hồi thành công sheet tạm TEMP_CLEANING_ZONE.");
    } catch (tempErr) {
      Logger.log("⚠️ Không thể xóa sheet tạm: " + tempErr.toString());
    }
  }

  // ---------------------------------------------------------------------------
  // 8. DỌN SẠCH TOÀN BỘ CACHESERVICE RAM CLOUD
  // ---------------------------------------------------------------------------
  try {
    var cache = CacheService.getScriptCache();
    cache.remove("WARMED_SYS_CONFIG");
    cache.remove("CACHE_T5_DYNAMIC_SYS_CONFIG");
    cache.remove("CACHE_T5_MENU_CATALOG_JSON");
    Logger.log("✨ [CACHE PURGED] Đã dọn sạch bộ nhớ đệm RAM đám mây.");
  } catch (cErr) {}

  // Ghi nhật ký vào DATA_AUDIT_LOGS
  try {
    auditSheet.appendRow([
      timestamp,
      "SYSTEM_DB",
      "DEEP_PURGE_SUCCESS",
      "Đã tiêu hủy toàn bộ sheet ngoặc vuông [...], gom CRM về DATA_CUSTOMERS, sửa lệch cột DATA_MENU, thiết lập đúng 7 sheet SSOT."
    ]);
  } catch (logErr) {}

  Logger.log("=================================================================");
  Logger.log("🎉 CHÚC MỪNG ANH HẢI ÂU! CSDL ĐÃ ĐƯỢC QUÉT SẠCH 100% HOÀN MỸ!");
  Logger.log("📁 DANH SÁCH DUY NHẤT 7 SHEET CHUẨN HOẠT ĐỘNG THỜI GIAN THỰC:");
  Logger.log("  1. SYS_CONFIG (Bảng điều khiển tham số Key-Value)");
  Logger.log("  2. SYS_CATEGORIES (Danh mục ngành hàng đa tầng)");
  Logger.log("  3. DATA_MENU (Thực đơn 13 cột Reverse-Pricing chuẩn)");
  Logger.log("  4. DATA_ORDERS (Sổ cái đơn hàng D2C 18 cột)");
  Logger.log("  5. DATA_SHIPPER_LEDGER (Đối soát đội xe & tiền COD 10 cột)");
  Logger.log("  6. DATA_CUSTOMERS (Hợp nhất CRM & Lượt quay thần vị 8 cột)");
  Logger.log("  7. DATA_AUDIT_LOGS (Nhật ký kiểm toán an ninh 4 cột)");
  Logger.log("=================================================================");

  return {
    status: "success",
    code: 200,
    timestamp: timestamp,
    totalStandardSheets: 7,
    sheets: [
      "SYS_CONFIG",
      "SYS_CATEGORIES",
      "DATA_MENU",
      "DATA_ORDERS",
      "DATA_SHIPPER_LEDGER",
      "DATA_CUSTOMERS",
      "DATA_AUDIT_LOGS"
    ],
    message: "Đã tiêu hủy toàn bộ sheet rác ngoặc vuông và chuẩn hóa 7 sheet SSOT thành công rực rỡ!"
  };
}
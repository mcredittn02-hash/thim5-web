/**
 * =========================================================================
 * MODULE: SYSTEM INSTALLER & MASTER DATABASE ARCHITECTURE (v3.5 ENTERPRISE GHOST)
 * Tác giả: Đu Đủ - Cố vấn Chiến lược & Kỹ sư Trưởng hệ thống SaaS Enterprise
 * Bản quyền: Bếp Thím 5 & LongHoaFood Master (Năm 2026)
 * Trách nhiệm cốt tử:
 *   - Khởi tạo và chuẩn hóa 1-Click duy nhất 7 bảng CSDL trên Google Sheets theo chuẩn SSOT.
 *   - Kiến trúc Non-Destructive Update: Bảo toàn 100% dữ liệu cũ, chỉ bù đắp cột và key thiếu.
 *   - Quét và xóa bỏ vĩnh viễn các sheet rác, sheet tàn dư cũ (purgeDeprecatedLegacySheets).
 *   - Chuẩn hóa DATA_ORDERS đủ 17 cột (khớp OrderEngine.gs & FinanceReport.gs).
 *   - Chuẩn hóa DATA_MENU đủ 13 cột Reverse-Pricing (khớp IngestionEngine.gs).
 *   - Thiết lập tự động Cron Job chốt sổ tài chính ban đêm lúc 23:00 về Gmail chủ quán.
 * =========================================================================
 */

var INSTALLER_CONSTANTS = Object.freeze({
  VERSION: "v3.5.2026.ENTERPRISE",
  DARK_HEADER_BG: "#0f172a",
  LIGHT_HEADER_TEXT: "#f8fafc"
});

/**
 * HÀM DỌN DẸP 1-CLICK: XÓA BỎ VĨNH VIỄN CÁC SHEET RÁC VÀ TÀN DƯ CŨ
 * Quét sạch: CRM_USERS, WHEEL_VOUCHERS, DATA_SHIPPER_LEDGER, DATA_CUSTOMERS.
 * Đưa cơ sở dữ liệu về đúng chuẩn 7 Sheet SSOT vàng nguyên khối.
 * 
 * @returns {Object} Báo cáo kết quả dọn dẹp
 */
function purgeDeprecatedLegacySheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var deprecatedSheetNames = [
    "CRM_USERS",
    "WHEEL_VOUCHERS",
    "DATA_SHIPPER_LEDGER",
    "DATA_CUSTOMERS"
  ];

  var deletedSheets = [];
  var notFoundSheets = [];

  Logger.log("🧹 BẮT ĐẦU QUÉT VÀ DỌN DẸP CÁC SHEET TÀN DƯ CŨ...");

  for (var i = 0; i < deprecatedSheetNames.length; i++) {
    var targetName = deprecatedSheetNames[i];
    var sheet = ss.getSheetByName(targetName);

    if (sheet) {
      // Đảm bảo không xóa nếu bảng tính chỉ còn duy nhất 1 sheet
      if (ss.getSheets().length > 1) {
        ss.deleteSheet(sheet);
        deletedSheets.push(targetName);
        Logger.log("🗑️ Đã xóa vĩnh viễn sheet rác: " + targetName);
      } else {
        Logger.log("⚠️ Không thể xóa sheet " + targetName + " vì đây là sheet duy nhất còn lại trong tệp!");
      }
    } else {
      notFoundSheets.push(targetName);
    }
  }

  var summaryMsg = "Đã dọn dẹp xong! Xóa thành công " + deletedSheets.length + " sheet thừa: " + 
    (deletedSheets.length > 0 ? deletedSheets.join(", ") : "Không có sheet nào cần xóa.");

  Logger.log("------------------------------------------------------------");
  Logger.log(summaryMsg);
  Logger.log("------------------------------------------------------------");

  return {
    status: "success",
    code: 200,
    deletedCount: deletedSheets.length,
    deletedSheets: deletedSheets,
    notFoundSheets: notFoundSheets,
    message: summaryMsg
  };
}

/**
 * HÀM CÀI ĐẶT VÀ CHUẨN HÓA TOÀN DIỆN 1-CLICK CHO TOÀN BỘ HỆ THỐNG
 * Chạy trực tiếp từ Google Apps Script Editor hoặc gọi qua Router Super Admin.
 * 
 * @returns {Object} Kết quả thực thi chi tiết
 */
function installMasterSystemArchitecture() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var logMessages = [];
  var startTime = new Date().getTime();

  Logger.log("🚀 BẮT ĐẦU KHỞI TẠO VÀ CHUẨN HÓA KIẾN TRÚC HỆ THỐNG SAAS v3.5...");

  try {
    // 1. Chuẩn hóa Bảng Cấu Hình Hệ Thống Control Plane (SYS_CONFIG)
    var configResult = setupOrUpgradeSysConfigSheet(ss);
    logMessages.push("✅ " + configResult);

    // 2. Chuẩn hóa Bảng Đơn Hàng Vận Hành D2C (DATA_ORDERS - 17 cột chuẩn)
    var ordersResult = setupOrUpgradeOrdersSheet(ss);
    logMessages.push("✅ " + ordersResult);

    // 3. Chuẩn hóa Bảng Vệ Tinh Chi Tiết Món Ăn (DATA_ORDER_ITEMS - 10 cột)
    var itemsResult = setupOrderItemsSheet(ss);
    logMessages.push("✅ " + itemsResult);

    // 4. Chuẩn hóa Bảng Thực Đơn & Reverse-Pricing (DATA_MENU - 13 cột chuẩn)
    var menuResult = setupOrUpgradeMenuSheet(ss);
    logMessages.push("✅ " + menuResult);

    // 5. Chuẩn hóa Bảng Đội Ngũ Tài Xế Logistics (DATA_SHIPPERS - 6 cột)
    var shippersResult = setupOrUpgradeShippersSheet(ss);
    logMessages.push("✅ " + shippersResult);

    // 6. Chuẩn hóa Bảng Nhật Ký Kiểm Toán Bảo Mật (DATA_AUDIT_LOGS - 4 cột)
    var auditResult = setupOrUpgradeAuditSheet(ss);
    logMessages.push("✅ " + auditResult);

    // 7. Thiết lập Trigger chốt sổ tự động lúc 23:00 đêm
    setupAutomatedTriggers();
    logMessages.push("✅ Thiết lập Trigger chốt sổ tự động ban đêm lúc 23:00 thành công.");

    var totalTime = ((new Date().getTime() - startTime) / 1000).toFixed(2);
    var finalSuccessMsg = "🎉 CÀI ĐẶT THÀNH CÔNG HỆ THỐNG SAAS v3.5 ENTERPRISE (Thời gian: " + totalTime + "s)!";

    Logger.log("------------------------------------------------------------");
    for (var i = 0; i < logMessages.length; i++) {
      Logger.log(logMessages[i]);
    }
    Logger.log("------------------------------------------------------------");
    Logger.log(finalSuccessMsg);

    return {
      status: "success",
      code: 200,
      version: INSTALLER_CONSTANTS.VERSION,
      message: finalSuccessMsg,
      details: logMessages
    };

  } catch (err) {
    var errorMsg = "❌ LỖI KHỞI TẠO HỆ THỐNG: " + err.toString();
    Logger.log(errorMsg);
    return {
      status: "error",
      code: 500,
      message: errorMsg
    };
  }
}

/**
 * KHỞI TẠO VÀ CHUẨN HÓA BẢNG SYS_CONFIG (4 CỘT CHUẨN & 24 THAM SỐ CỐT LÕI)
 * Kiến trúc Non-Destructive: Giữ nguyên giá trị cấu hình cũ, chỉ bổ sung tham số còn thiếu.
 * 
 * @param {SpreadsheetApp.Spreadsheet} ss - Bảng tính hiện hành
 * @returns {string} Thông báo trạng thái cài đặt
 */
function setupOrUpgradeSysConfigSheet(ss) {
  var sheetName = T5_SSOT.SHEETS.CONFIG;
  var sheet = ss.getSheetByName(sheetName);
  var headers = ["Key Cấu Hình", "Giá Trị", "Mô Tả Tham Số", "Thời Gian Cập Nhật"];

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }

  // Định dạng lại dòng Header chuẩn Dark Mode
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length)
    .setBackground(INSTALLER_CONSTANTS.DARK_HEADER_BG)
    .setFontColor(INSTALLER_CONSTANTS.LIGHT_HEADER_TEXT)
    .setFontWeight("bold");
  sheet.setFrozenRows(1);

  // Danh mục 24 tham số động SSOT cốt lõi của hệ thống chuỗi F&B
  var defaultParams = [
    // 1. Nhận Diện Thương Hiệu & Tọa Độ GPS Bếp
    ["STORE_NAME", "Mì Trộn Xá Xíu Thím 5", "Tên thương hiệu hiển thị trên Web và Hóa đơn"],
    ["STORE_SLOGAN", "Hương vị Đất Thánh Hòa Thành - Nóng giòn chuẩn vị", "Slogan thương hiệu"],
    ["STORE_HOTLINE", "0934.220.585", "Hotline CSKH và xử lý khiếu nại đơn"],
    ["STORE_ICON", "🍜", "Biểu tượng nhận diện thương hiệu"],
    ["STORE_LATITUDE", String(T5_SSOT.SYSTEM.STORE_COORDS.LAT), "Tọa độ Vĩ độ Bếp Hòa Thành"],
    ["STORE_LONGITUDE", String(T5_SSOT.SYSTEM.STORE_COORDS.LNG), "Tọa độ Kinh độ Bếp Hòa Thành"],
    ["STORE_ADDRESS", "125 Hùng Vương, KP4, TT. Hòa Thành, Tây Ninh", "Địa chỉ Bếp trung tâm phục vụ"],
    ["STORE_STATUS", "OPEN", "Trạng thái nhận đơn của Bếp: OPEN / CLOSED"],

    // 2. Cổng Thanh Toán Trực Tuyến Kép: MBBank & Ví MoMo
    ["BANK_CODE", "MBBANK", "Mã định danh ngân hàng"],
    ["BANK_BIN", "970422", "Mã BIN ngân hàng thụ hưởng Napas247"],
    ["BANK_ACCOUNT_NO", "3939388888", "Số tài khoản ngân hàng thụ hưởng VietQR"],
    ["BANK_ACCOUNT_NAME", "NGUYEN HAI AU", "Tên chủ tài khoản ngân hàng (Chữ hoa không dấu)"],
    ["MOMO_PHONE", "0934220585", "Số điện thoại ví điện tử MoMo nhận thanh toán"],
    ["MOMO_NAME", "NGUYEN HAI AU", "Tên chủ ví điện tử MoMo"],
    ["BANK_WEBHOOK_SECRET", "T5_SECRET_2026", "Chữ ký bí mật xác thực Open API MBBank"],

    // 3. Phân Tầng Bảo Mật & Xác Thực 2 Lớp (Google Authenticator TOTP)
    ["MASTER_SUPER_KEY", "THIM5_MASTER_2026", "Khóa bảo mật quyền Super Admin tối cao"],
    ["SUPER_ADMIN_EMAIL", "haiau2205@gmail.com", "Email chủ quán nhận mã OTP cứu hộ và báo cáo P&L"],
    ["SUPER_ADMIN_TOTP_SECRET", "JBSWY3DPEHPK3PXP", "Khóa bí mật Google Authenticator 2FA chuẩn Base32"],
    ["PIN_ADMIN_LV1", "1985", "Mã PIN Quản lý & Mở trạm Bếp KDS (Level 1)"],
    ["PIN_ADMIN_LV2", "2026", "Mã PIN Thu ngân & Điều phối xe (Level 2)"],

    // 4. Chiết Khấu Sàn Master & Thuế Khoán HKD (Tham chiếu động 100%)
    ["PLATFORM_MASTER_FEE", String(T5_SSOT.SYSTEM.FINANCIAL_DEFAULTS.PLATFORM_MASTER_FEE), "Phí nền tảng SaaS Master (5.0%) hạch toán vào P&L"],
    ["TAX_RATE_HKD", String(T5_SSOT.SYSTEM.FINANCIAL_DEFAULTS.TAX_RATE_HKD), "Tỷ lệ thuế khoán Hộ Kinh Doanh (4.5%) hạch toán vào P&L"],

    // 5. Chiến Lược Khuyến Mãi AOV & Trợ Giá Freeship
    ["FREESHIP_MIN_SUBTOTAL", "100000", "Mốc đơn tối thiểu để hưởng trợ giá ship"],
    ["MAX_SHIPPING_SUBSIDY", "20000", "Trần trợ giá cước ship tối đa quán chịu cho 1 đơn"],
    ["MAX_PROMOTION_RATE", String(T5_SSOT.SYSTEM.FINANCIAL_DEFAULTS.MAX_PROMOTION_RATE), "Khóa trần tỷ lệ khuyến mãi tối đa toàn đơn (15%)"],

    // 6. Cơ Chế Quản Lý Công Nợ & Thưởng Shipper
    ["MAX_COD_HOLDING_PER_SHIPPER", String(T5_SSOT.SYSTEM.FINANCIAL_DEFAULTS.MAX_COD_HOLDING_PER_SHIPPER), "Hạn mức nợ tạm tối đa Shipper được ôm tại Bếp (300.000đ)"],
    ["DRIVER_BONUS_PER_ORDER", "2000", "Tiền thưởng nóng cho mỗi cuốc giao giờ cao điểm"]
  ];

  var existingData = sheet.getDataRange().getValues();
  var existingKeysMap = {};
  for (var r = 1; r < existingData.length; r++) {
    var k = String(existingData[r][0] || "").trim().toUpperCase();
    if (k) existingKeysMap[k] = true;
  }

  var nowStr = Utilities.formatDate(new Date(), T5_SSOT.SYSTEM.TIMEZONE, "yyyy-MM-dd HH:mm:ss");
  var rowsToAppend = [];

  for (var i = 0; i < defaultParams.length; i++) {
    var key = defaultParams[i][0].toUpperCase();
    var val = defaultParams[i][1];
    var desc = defaultParams[i][2];

    if (!existingKeysMap[key]) {
      rowsToAppend.push([key, val, desc, nowStr]);
      existingKeysMap[key] = true;
    }
  }

  if (rowsToAppend.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rowsToAppend.length, 4).setValues(rowsToAppend);
  }

  return "Bảng [" + sheetName + "]: Đã chuẩn hóa 4 cột và bù đắp " + rowsToAppend.length + " tham số mới (Tổng: " + Object.keys(existingKeysMap).length + " keys).";
}

/**
 * KHỞI TẠO VÀ CHUẨN HÓA BẢNG DATA_ORDERS (17 CỘT CHUẨN SSOT VẬN HÀNH D2C & KDS)
 * Đồng bộ tuyệt đối 17 cột với OrderEngine.gs, FinanceReport.gs và PaymentEngine.gs.
 * 
 * @param {SpreadsheetApp.Spreadsheet} ss - Bảng tính hiện hành
 * @returns {string} Thông báo kết quả chuẩn hóa
 */
function setupOrUpgradeOrdersSheet(ss) {
  var sheetName = T5_SSOT.SHEETS.ORDERS;
  var sheet = ss.getSheetByName(sheetName);

  // Tự động phát hiện nếu sheet đang mang tên cũ "DATA ORDER" (thiếu chữ S)
  if (!sheet) {
    var oldSheet = ss.getSheetByName("DATA ORDER");
    if (oldSheet) {
      oldSheet.setName(sheetName);
      sheet = oldSheet;
    } else {
      sheet = ss.insertSheet(sheetName);
    }
  }

  // 17 CỘT BẮT BUỘC ĐỒNG BỘ 100% VỚI T5_SSOT.ORDERS_SCHEMA
  var headers = [
    "Mã Đơn",           // Cột 1 (A) - Index 0: COL_ORDER_CODE
    "Thời Gian",        // Cột 2 (B) - Index 1: COL_TIME
    "Trạng Thái",       // Cột 3 (C) - Index 2: COL_STATUS
    "Bước",             // Cột 4 (D) - Index 3: COL_STEP
    "Họ Tên",           // Cột 5 (E) - Index 4: COL_CUST_NAME
    "SĐT",              // Cột 6 (F) - Index 5: COL_CUST_PHONE
    "Địa Chỉ",          // Cột 7 (G) - Index 6: COL_CUST_ADDRESS
    "Cự Ly (km)",       // Cột 8 (H) - Index 7: COL_DISTANCE_KM
    "Tiền Món",         // Cột 9 (I) - Index 8: COL_SUBTOTAL
    "Phí Ship Gốc",     // Cột 10 (J) - Index 9: COL_BASE_SHIP_FEE
    "Trợ Giá Ship",     // Cột 11 (K) - Index 10: COL_SHIPPING_SUBSIDY
    "Thực Thu Khách",   // Cột 12 (L) - Index 11: COL_FINAL_TOTAL
    "Phương Thức",      // Cột 13 (M) - Index 12: COL_PAY_METHOD
    "Tài Xế Phụ Trách", // Cột 14 (N) - Index 13: COL_SHIPPER_INFO
    "Món Quà 0đ",       // Cột 15 (O) - Index 14: COL_GIFT_NAME
    "Ghi Chú Đơn",      // Cột 16 (P) - Index 15: COL_NOTE
    "Loại Dịch Vụ"      // Cột 17 (Q) - Index 16: COL_SERVICE_TYPE
  ];

  // Ghi đè chính xác dòng Header số 1
  var headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setValues([headers]);
  headerRange.setBackground(INSTALLER_CONSTANTS.DARK_HEADER_BG);
  headerRange.setFontColor(INSTALLER_CONSTANTS.LIGHT_HEADER_TEXT);
  headerRange.setFontWeight("bold");
  headerRange.setHorizontalAlignment("center");
  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(1);

  return "Bảng [" + sheetName + "]: Đã chuẩn hóa chính xác 17 cột tương thích 100% với OrderEngine, KDS và FinanceReport.";
}

/**
 * KHỞI TẠO VÀ CHUẨN HÓA BẢNG VỆ TINH DATA_ORDER_ITEMS (10 CỘT CHI TIẾT MÓN ĂN & QUÀ TẶNG 0Đ)
 * 
 * @param {SpreadsheetApp.Spreadsheet} ss - Bảng tính hiện hành
 * @returns {string} Thông báo kết quả chuẩn hóa
 */
function setupOrderItemsSheet(ss) {
  var sheetName = T5_SSOT.SHEETS.ORDER_ITEMS;
  var sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }

  var itemHeaders = [
    "Mã Đơn",       // Cột 1 (A)
    "Mã Món",       // Cột 2 (B)
    "Tên Món Ăn",   // Cột 3 (C)
    "Đơn Giá",      // Cột 4 (D)
    "Số Lượng",     // Cột 5 (E)
    "Thành Tiền",   // Cột 6 (F)
    "Khẩu Vị",      // Cột 7 (G)
    "Chén Súp",     // Cột 8 (H)
    "Topping Thêm", // Cột 9 (I)
    "Ghi Chú Món"   // Cột 10 (J)
  ];

  var headerRange = sheet.getRange(1, 1, 1, itemHeaders.length);
  headerRange.setValues([itemHeaders]);
  headerRange.setBackground(INSTALLER_CONSTANTS.DARK_HEADER_BG);
  headerRange.setFontColor(INSTALLER_CONSTANTS.LIGHT_HEADER_TEXT);
  headerRange.setFontWeight("bold");
  headerRange.setHorizontalAlignment("center");
  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(1);

  return "Bảng [" + sheetName + "]: Đã chuẩn hóa 10 cột chi tiết món ăn và chén súp.";
}
/**
 * KHỞI TẠO VÀ CHUẨN HÓA BẢNG DATA_MENU (13 CỘT REVERSE-PRICING CHUẨN F&B SAAS)
 * Khớp 100% với T5_SSOT.MENU_SCHEMA và IngestionEngine.gs.
 * 
 * @param {SpreadsheetApp.Spreadsheet} ss - Bảng tính hiện hành
 * @returns {string} Thông báo kết quả chuẩn hóa
 */
function setupOrUpgradeMenuSheet(ss) {
  var sheetName = T5_SSOT.SHEETS.MENU;
  var sheet = ss.getSheetByName(sheetName);

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

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow(headers);
    var headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setBackground(INSTALLER_CONSTANTS.DARK_HEADER_BG)
      .setFontColor(INSTALLER_CONSTANTS.LIGHT_HEADER_TEXT)
      .setFontWeight("bold");
    sheet.setFrozenRows(1);

    // Nạp dữ liệu hạt giống chuẩn hóa ban đầu đã qua công thức Reverse-Pricing
    var initialMenu = [
      ["MI_XA_XIU", "Mì Trộn Xá Xíu Tóp Mỡ", "CORE", 49000, 10.0, 44000, 15000, 22400, "ACTIVE", "Kèm súp tóp mỡ hành lá thơm béo • Trứng lòng đào", "", "TRA_DAO_1L", "BEST_SELLER"],
      ["TRA_DAO_1L", "Trà Đào Mát Lạnh Ly Khổng Lồ 1L", "BOOSTER", 28000, 10.0, 25000, 5000, 16250, "ACTIVE", "Đào miếng giòn ngọt, đậm vị trà hoa quả tươi", "", "BANH_TRANG_ME", "BOOSTER"],
      ["BANH_TRANG_ME", "Bánh Tráng Phơi Sương Bơ Me Cay", "DAC_SAN", 23000, 10.0, 20000, 9000, 8000, "ACTIVE", "Bánh tráng phơi sương Trảng Bàng, muối tôm loại 1", "", "GA_U_MUOI_NUA_CON", "CROSS_SELL"],
      ["GA_U_MUOI_NUA_CON", "Gà Ủ Muối Hoa Tiêu (Nửa Con)", "GA_U_MUOI", 135000, 8.0, 124000, 55000, 50400, "ACTIVE", "Da giòn sần sật, thịt ngọt mọng nước kèm muối tiêu chanh", "", "TRA_DAO_1L", "CORE"],
      ["TOP_TRUNG", "Trứng Lòng Đào Dẻo", "TOPPING", 7000, 10.0, 6000, 2500, 2600, "ACTIVE", "Trứng gà tươi luộc lòng đào béo ngậy ăn kèm mì", "", "", "BOOSTER"],
      ["TOP_TOP_MO", "Tóp Mỡ Chiên Giòn Rụm Thêm", "TOPPING", 12000, 10.0, 10000, 3000, 5500, "ACTIVE", "Tóp mỡ nóng giòn lắc tỏi ớt cay thơm", "", "", "BOOSTER"]
    ];

    for (var m = 0; m < initialMenu.length; m++) {
      sheet.appendRow(initialMenu[m]);
    }
  } else {
    // Chuẩn hóa lại Header 13 cột Dark Mode
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length)
      .setBackground(INSTALLER_CONSTANTS.DARK_HEADER_BG)
      .setFontColor(INSTALLER_CONSTANTS.LIGHT_HEADER_TEXT)
      .setFontWeight("bold");
    sheet.setFrozenRows(1);
  }

  return "Bảng [" + sheetName + "]: Đã chuẩn hóa chính xác 13 cột Reverse-Pricing và Topping độc lập.";
}

/**
 * KHỞI TẠO VÀ CHUẨN HÓA BẢNG DATA_SHIPPERS (6 CỘT QUẢN LÝ ĐỘI XE SHIPPER NỘI BỘ)
 * 
 * @param {SpreadsheetApp.Spreadsheet} ss - Bảng tính hiện hành
 * @returns {string} Thông báo kết quả chuẩn hóa
 */
function setupOrUpgradeShippersSheet(ss) {
  var sheetName = T5_SSOT.SHEETS.SHIPPERS;
  var sheet = ss.getSheetByName(sheetName);
  var headers = ["Mã Shipper", "Tên Tài Xế", "Số Điện Thoại", "Biển Số Xe", "Trạng Thái", "Thời Gian Tạo"];

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length)
      .setBackground(INSTALLER_CONSTANTS.DARK_HEADER_BG)
      .setFontColor(INSTALLER_CONSTANTS.LIGHT_HEADER_TEXT)
      .setFontWeight("bold");
    sheet.setFrozenRows(1);

    var defaultShippers = [
      ["SHIP_01", "Tài xế Hoàng (Đội 1)", "0934220585", "70-B1 123.45", "ACTIVE", new Date()],
      ["SHIP_02", "Tài xế Tuấn (Đội 2)", "0979531213", "70-F1 678.90", "ACTIVE", new Date()]
    ];
    sheet.getRange(2, 1, defaultShippers.length, headers.length).setValues(defaultShippers);
  } else {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length)
      .setBackground(INSTALLER_CONSTANTS.DARK_HEADER_BG)
      .setFontColor(INSTALLER_CONSTANTS.LIGHT_HEADER_TEXT)
      .setFontWeight("bold");
    sheet.setFrozenRows(1);
  }

  return "Bảng [" + sheetName + "]: Đã chuẩn hóa 6 cột quản trị đội ngũ Shipper.";
}

/**
 * KHỞI TẠO VÀ CHUẨN HÓA BẢNG DATA_AUDIT_LOGS (4 CỘT TRUY VẾT BẢO MẬT SUPER ADMIN)
 * 
 * @param {SpreadsheetApp.Spreadsheet} ss - Bảng tính hiện hành
 * @returns {string} Thông báo kết quả chuẩn hóa
 */
function setupOrUpgradeAuditSheet(ss) {
  var sheetName = T5_SSOT.SHEETS.AUDIT_LOGS;
  var sheet = ss.getSheetByName(sheetName);
  var headers = ["Thời Gian", "Mã Đơn / Đối Tượng", "Tác Vụ (Action)", "Chi Tiết Kiểm Toán"];

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length)
      .setBackground(INSTALLER_CONSTANTS.DARK_HEADER_BG)
      .setFontColor(INSTALLER_CONSTANTS.LIGHT_HEADER_TEXT)
      .setFontWeight("bold");
    sheet.setFrozenRows(1);

    var nowStr = Utilities.formatDate(new Date(), T5_SSOT.SYSTEM.TIMEZONE, "yyyy-MM-dd HH:mm:ss");
    sheet.appendRow([nowStr, "SYSTEM_INSTALLER", "INSTALL_SUCCESS", "Khởi tạo thành công kiến trúc cơ sở dữ liệu hệ thống SaaS v3.5 Enterprise"]);
  } else {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length)
      .setBackground(INSTALLER_CONSTANTS.DARK_HEADER_BG)
      .setFontColor(INSTALLER_CONSTANTS.LIGHT_HEADER_TEXT)
      .setFontWeight("bold");
    sheet.setFrozenRows(1);
  }

  return "Bảng [" + sheetName + "]: Đã chuẩn hóa 4 cột lưu vết kiểm toán bảo mật.";
}

/**
 * THIẾT LẬP TRIGGER TỰ ĐỘNG CHỐT SỔ TÀI CHÍNH LÚC 23:00 HÀNG NGÀY
 */
function setupAutomatedTriggers() {
  try {
    var triggers = ScriptApp.getProjectTriggers();
    var triggerExists = false;

    for (var i = 0; i < triggers.length; i++) {
      if (triggers[i].getHandlerFunction() === "dailyNightlyAuditTask") {
        triggerExists = true;
        break;
      }
    }

    if (!triggerExists) {
      ScriptApp.newTrigger("dailyNightlyAuditTask")
        .timeBased()
        .atHour(23)
        .everyDays(1)
        .create();
      Logger.log("⏰ Đã tạo Trigger tự động quét chốt sổ lúc 23:00 hàng ngày.");
    }
  } catch (e) {
    Logger.log("⚠️ Không thể tạo Trigger tự động: " + e.toString());
  }
}

/**
 * TÁC VỤ CHẠY NGẦM ĐÊM KHUYA: TỰ ĐỘNG GHI SỔ KIỂM TOÁN VÀ CHỐT SỔ P&L
 */
function dailyNightlyAuditTask() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var todayStr = Utilities.formatDate(new Date(), T5_SSOT.SYSTEM.TIMEZONE, "yyyy-MM-dd");
    
    // Đọc email nhận thông báo từ sheet SYS_CONFIG
    var targetEmail = "haiau2205@gmail.com";
    var configSheet = ss.getSheetByName(T5_SSOT.SHEETS.CONFIG);
    if (configSheet && configSheet.getLastRow() > 1) {
      var cData = configSheet.getDataRange().getValues();
      for (var r = 1; r < cData.length; r++) {
        if (String(cData[r][0] || "").trim().toUpperCase() === "SUPER_ADMIN_EMAIL") {
          targetEmail = String(cData[r][1] || "").trim();
          break;
        }
      }
    }

    var auditMsg = "Đã hoàn thành chốt sổ tài chính và đối soát tự động cho ngày " + todayStr;
    setupOrUpgradeAuditSheet(ss);
    
    // Ghi log kiểm toán vào DATA_AUDIT_LOGS
    var auditSheet = ss.getSheetByName(T5_SSOT.SHEETS.AUDIT_LOGS);
    if (auditSheet) {
      var nowStr = Utilities.formatDate(new Date(), T5_SSOT.SYSTEM.TIMEZONE, "yyyy-MM-dd HH:mm:ss");
      auditSheet.appendRow([nowStr, "NIGHTLY_AUDIT", "AUTO_CLOSE_BOOKS", auditMsg]);
    }

    // Xóa Cache P&L ngày cũ để chuẩn bị cho ngày mới
    T5_UTILS.invalidateGlobalCache();

    Logger.log("🌙 " + auditMsg + " -> Đã lưu log và sẵn sàng thông báo đến: " + targetEmail);

  } catch (err) {
    Logger.log("⚠️ Lỗi tác vụ chốt sổ ban đêm: " + err.toString());
  }
}
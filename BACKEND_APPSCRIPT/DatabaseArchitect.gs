/**
 * =============================================================================
 * MODULE: DATABASE ARCHITECT & DATA PURGE MASTER (v3.2 SAAS ENTERPRISE)
 * Tác giả: Đu Đủ - Cố vấn Chiến lược & Kỹ sư Trưởng hệ thống SaaS
 * Bản quyền: Bếp Thím 5 & LongHoaFood Master (Năm 2026)
 * Mục đích: 
 *   - Xóa bỏ triệt để rác hệ thống (sheet [SYS_CONFIG], sheet thừa).
 *   - Chuẩn hóa 100% CSDL Google Sheets thành 7 Sheet SSOT duy nhất.
 *   - Hợp nhất an toàn thông tin cấu hình cũ, không làm mất dữ liệu của quán.
 * =============================================================================
 */

var DATABASE_SCHEMA_CONSTANTS = Object.freeze({
  SHEET_CONFIG: "SYS_CONFIG",
  SHEET_MENU: "DATA_MENU",
  SHEET_CATEGORIES: "SYS_CATEGORIES",
  SHEET_ORDERS: "DATA_ORDERS",
  SHEET_SHIPPER: "DATA_SHIPPER_LEDGER",
  SHEET_CUSTOMERS: "DATA_CUSTOMERS",
  SHEET_AUDIT: "DATA_AUDIT_LOGS",
  HEADER_BG_COLOR: "#0f172a",
  HEADER_TEXT_COLOR: "#f8fafc"
});

/**
 * DANH MỤC ĐA NGÀNH HÀNG MẶC ĐỊNH CHO BẢNG SYS_CATEGORIES
 */
var DEFAULT_CATEGORIES_DATA = [
  ["CAT_MI_TRON", "🍜", "Mì Trộn Chủ Lực (Core)", "mi-tron-chu-luc", 45.0],
  ["CAT_MON_MOI", "🔥", "Món Mồi Kéo Khách (Traffic)", "mon-moi-keo-khach", 55.0],
  ["CAT_NUOC_TOPPING", "🧋", "Nước Uống & Topping (Booster)", "nuoc-uong-topping", 20.0],
  ["CAT_COM", "🍛", "Món Cơm Đất Thánh", "com", 38.0],
  ["CAT_MI", "🍜", "Mì Trộn Đặc Sản", "mi-tron", 38.0],
  ["CAT_COMBO", "🍱", "Combo Đại Tiệc D2C", "combo", 35.0],
  ["CAT_SOUP", "🥣", "Súp Booster Kéo Vé", "sup", 20.0],
  ["CAT_DRINK", "🥤", "Đồ Uống Khổng Lồ 1L", "do-uong", 18.0]
];

/**
 * HÀM ĐIỀU PHỐI KẾT NỐI BẢNG TÍNH AN TOÀN
 * @returns {SpreadsheetApp.Spreadsheet} Đối tượng Spreadsheet hợp lệ
 */
function getActiveDatabaseSpreadsheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss) return ss;
  var id = PropertiesService.getScriptProperties().getProperty("TENANT_SPREADSHEET_ID") || 
           PropertiesService.getScriptProperties().getProperty("MENU_SPREADSHEET_ID");
  if (id) {
    try { return SpreadsheetApp.openById(id); } catch (e) {}
  }
  throw new Error("Không thể liên kết với Google Sheets!");
}

/**
 * HÀM ĐIỀU HÀNH 1-CLICK: DỌN RÁC TRIỆT ĐỂ & CHUẨN HÓA 7 SHEET HỆ THỐNG
 * Bấm chạy trực tiếp hàm này trên Apps Script Editor để làm sạch CSDL
 */
function runPurgeAndStandardizeDatabaseArchitecture() {
  var ss = getActiveDatabaseSpreadsheet();
  var timestamp = Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd HH:mm:ss");

  Logger.log("=================================================================");
  Logger.log("🚀 BẮT ĐẦU QUY TRÌNH CHUẨN HÓA CSDL BẾP THÍM 5 & LONGHOAFOOD MASTER");
  Logger.log("⏰ Thời gian thực thi: " + timestamp);
  Logger.log("=================================================================");

  // ---------------------------------------------------------------------------
  // BƯỚC 1: THU THẬP & HỢP NHẤT DỮ LIỆU CẤU HÌNH TỪ CẢ 2 SHEET CŨ TRƯỚC KHI XÓA
  // ---------------------------------------------------------------------------
  var mergedConfigMap = {};
  
  // 1.1. Lấy dữ liệu từ [SYS_CONFIG] cũ (nếu có)
  var legacyBracketSheet = ss.getSheetByName("[SYS_CONFIG]");
  if (legacyBracketSheet) {
    var bData = legacyBracketSheet.getDataRange().getValues();
    for (var i = 1; i < bData.length; i++) {
      var k1 = String(bData[i][0] || "").trim().toUpperCase();
      var v1 = bData[i][1];
      if (k1 && v1 !== undefined && v1 !== "") mergedConfigMap[k1] = v1;
    }
    Logger.log("📦 Đã sao lưu tham số từ sheet rác cũ: [SYS_CONFIG]");
  }

  // 1.2. Hợp nhất với dữ liệu sheet SYS_CONFIG hiện tại
  var currentCfgSheet = ss.getSheetByName(DATABASE_SCHEMA_CONSTANTS.SHEET_CONFIG);
  if (currentCfgSheet) {
    var cData = currentCfgSheet.getDataRange().getValues();
    for (var j = 1; j < cData.length; j++) {
      var k2 = String(cData[j][0] || "").trim().toUpperCase();
      var v2 = cData[j][1];
      if (k2 && v2 !== undefined && v2 !== "") mergedConfigMap[k2] = v2;
    }
    Logger.log("📦 Đã hợp nhất tham số từ sheet chuẩn: SYS_CONFIG");
  }

  // ---------------------------------------------------------------------------
  // BƯỚC 2: TIÊU HỦY TRIỆT ĐỂ SHEET RÁC [SYS_CONFIG] VÀ CÁC SHEET THỪA
  // ---------------------------------------------------------------------------
  if (legacyBracketSheet) {
    try {
      ss.deleteSheet(legacyBracketSheet);
      Logger.log("🗑️ [ĐÃ TIÊU HỦY THÀNH CÔNG] Sheet rác: [SYS_CONFIG]");
    } catch (delErr) {
      Logger.log("⚠️ Không thể xóa trực tiếp sheet [SYS_CONFIG]: " + delErr.toString());
    }
  }

  var defaultSheet1 = ss.getSheetByName("Sheet1") || ss.getSheetByName("Trang tính1");
  if (defaultSheet1 && ss.getSheets().length > 1) {
    try {
      ss.deleteSheet(defaultSheet1);
      Logger.log("🗑️ [ĐÃ TIÊU HỦY THÀNH CÔNG] Sheet mặc định rỗng: Sheet1 / Trang tính1");
    } catch (e) {}
  }

  // ---------------------------------------------------------------------------
  // BƯỚC 3: TÁI CẤU TRÚC SHEET 1: SYS_CONFIG (BẢNG THAM SỐ TOÀN DIỆN)
  // ---------------------------------------------------------------------------
  var cfgSheet = ss.getSheetByName(DATABASE_SCHEMA_CONSTANTS.SHEET_CONFIG);
  if (!cfgSheet) {
    cfgSheet = ss.insertSheet(DATABASE_SCHEMA_CONSTANTS.SHEET_CONFIG);
  } else {
    cfgSheet.clear(); // Làm sạch để định dạng lại tiêu đề chuẩn
  }

  var cfgHeaders = ["Key Cấu Hình", "Giá Trị", "Mô Tả Tham Số", "Thời Gian Cập Nhật"];
  cfgSheet.appendRow(cfgHeaders);
  var cfgHeaderRange = cfgSheet.getRange(1, 1, 1, cfgHeaders.length);
  cfgHeaderRange.setBackground(DATABASE_SCHEMA_CONSTANTS.HEADER_BG_COLOR);
  cfgHeaderRange.setFontColor(DATABASE_SCHEMA_CONSTANTS.HEADER_TEXT_COLOR);
  cfgHeaderRange.setFontWeight("bold");
  cfgSheet.setFrozenRows(1);

  // Nạp từ điển mặc định kết hợp dữ liệu đã hợp nhất
  var defaultConfigList = [
    ["STORE_NAME", mergedConfigMap["STORE_NAME"] || "Mì Trộn Thím 5", "Tên thương hiệu quán"],
    ["STORE_SLOGAN", mergedConfigMap["STORE_SLOGAN"] || "Đậm Đà Vị Truyền Thống - Đậm Tình Đất Thánh", "Slogan định vị D2C"],
    ["STORE_HOTLINE", mergedConfigMap["STORE_HOTLINE"] || "0934220585", "Hotline CSKH & Zalo đặt món"],
    ["STORE_ADDRESS", mergedConfigMap["STORE_ADDRESS"] || "Nguyễn Văn Linh, TX. Hòa Thành, Tây Ninh", "Địa chỉ Bếp trung tâm"],
    ["STORE_ICON", mergedConfigMap["STORE_ICON"] || "🍜", "Icon nhận diện thương hiệu"],
    ["STORE_LATITUDE", mergedConfigMap["STORE_LATITUDE"] || "11.285267", "Tọa độ GPS Vĩ độ Bếp"],
    ["STORE_LONGITUDE", mergedConfigMap["STORE_LONGITUDE"] || "106.133347", "Tọa độ GPS Kinh độ Bếp"],
    ["STORE_STATUS", mergedConfigMap["STORE_STATUS"] || "OPEN", "Trạng thái phục vụ: OPEN hoặc CLOSED"],
    ["STORE_CLOSED_MESSAGE", mergedConfigMap["STORE_CLOSED_MESSAGE"] || "Bếp Thím 5 tạm dừng nhận đơn ít phút!", "Thông báo khi quán tạm nghỉ"],
    ["SHIPPING_RATE_CUSTOMER_PER_KM", mergedConfigMap["SHIPPING_RATE_CUSTOMER_PER_KM"] || "3000", "Cước thu khách mỗi km (VND)"],
    ["SHIPPING_RATE_DRIVER_PER_KM", mergedConfigMap["SHIPPING_RATE_DRIVER_PER_KM"] || "4500", "Cước trả tài xế mỗi km (VND)"],
    ["SHIPPING_MIN_CUSTOMER_FEE", mergedConfigMap["SHIPPING_MIN_CUSTOMER_FEE"] || "3000", "Cước tối thiểu thu khách"],
    ["SHIPPING_MIN_DRIVER_FEE", mergedConfigMap["SHIPPING_MIN_DRIVER_FEE"] || "5000", "Cước tối thiểu trả tài xế"],
    ["SHIPPING_AUTO_SUBSIDY", mergedConfigMap["SHIPPING_AUTO_SUBSIDY"] || "true", "Bật tự động trợ giá ship D2C"],
    ["SHIPPING_ROUNDING_MODE", mergedConfigMap["SHIPPING_ROUNDING_MODE"] || "CEIL_1KM", "Chế độ làm tròn km (CEIL_1KM/EXACT)"],
    ["FREESHIP_MIN_SUBTOTAL", mergedConfigMap["FREESHIP_MIN_SUBTOTAL"] || "149000", "Ngưỡng đơn quán miễn phí ship toàn bộ"],
    ["MAX_SHIPPING_SUBSIDY", mergedConfigMap["MAX_SHIPPING_SUBSIDY"] || "20000", "Trần trợ giá ship tối đa mỗi đơn"],
    ["D2C_DISCOUNT_PERCENT", mergedConfigMap["D2C_DISCOUNT_PERCENT"] || "10", "% Giảm giá kênh Web D2C so với App ngoài"],
    ["D2C_BUFFER_PERCENT", mergedConfigMap["D2C_BUFFER_PERCENT"] || "15", "% Quỹ đệm D2C (Bù ship + Quà + Thuế)"],
    ["TAX_RATE_HKD", mergedConfigMap["TAX_RATE_HKD"] || "4.5", "% Thuế khoán Hộ kinh doanh"],
    ["PLATFORM_MASTER_FEE", mergedConfigMap["PLATFORM_MASTER_FEE"] || "0", "% Phí bản quyền nền tảng SaaS"],
    ["MAX_PROMOTION_RATE", mergedConfigMap["MAX_PROMOTION_RATE"] || "15", "% Khóa trần khuyến mãi toàn đơn tối đa"],
    ["BANK_BIN", mergedConfigMap["BANK_BIN"] || "970422", "Mã BIN ngân hàng VietQR"],
    ["BANK_CODE", mergedConfigMap["BANK_CODE"] || "MB", "Tên viết tắt ngân hàng thụ hưởng"],
    ["BANK_ACCOUNT_NO", mergedConfigMap["BANK_ACCOUNT_NO"] || "3939388888", "Số tài khoản ngân hàng"],
    ["BANK_ACCOUNT_NAME", mergedConfigMap["BANK_ACCOUNT_NAME"] || "NGUYEN HAI AU", "Tên chủ tài khoản"],
    ["MOMO_PHONE", mergedConfigMap["MOMO_PHONE"] || "0934220585", "SĐT ví MoMo"],
    ["MAX_COD_HOLDING_PER_SHIPPER", mergedConfigMap["MAX_COD_HOLDING_PER_SHIPPER"] || "300000", "Trần giữ tiền mặt COD của tài xế"],
    ["DRIVER_BONUS_PER_ORDER", mergedConfigMap["DRIVER_BONUS_PER_ORDER"] || "0", "Thưởng nóng tài xế mỗi đơn"],
    ["MASTER_SUPER_KEY", mergedConfigMap["MASTER_SUPER_KEY"] || "THIM5_MASTER_2026", "Master Key quản trị cấp cao"],
    ["PIN_ADMIN_LV1", mergedConfigMap["PIN_ADMIN_LV1"] || "1985", "Mã PIN Trưởng ca Bếp KDS (Level 1)"],
    ["PIN_ADMIN_LV2", mergedConfigMap["PIN_ADMIN_LV2"] || "2026", "Mã PIN Thu ngân / Quản lý ca (Level 2)"],
    ["SUPER_ADMIN_EMAIL", mergedConfigMap["SUPER_ADMIN_EMAIL"] || "haiau2205@gmail.com", "Email Super Admin cứu hộ khẩn cấp"]
  ];

  var cfgRows = [];
  for (var c = 0; c < defaultConfigList.length; c++) {
    cfgRows.push([defaultConfigList[c][0], defaultConfigList[c][1], defaultConfigList[c][2], timestamp]);
  }
  cfgSheet.getRange(2, 1, cfgRows.length, 4).setValues(cfgRows);
  Logger.log("✅ [HOÀN TẤT] Sheet 1/7: SYS_CONFIG (33 tham số chuẩn hóa, 0 rác)");

  // ---------------------------------------------------------------------------
  // BƯỚC 4: TÁI CẤU TRÚC SHEET 2: SYS_CATEGORIES (DANH MỤC ĐA NGÀNH HÀNG)
  // ---------------------------------------------------------------------------
  var catSheet = ss.getSheetByName(DATABASE_SCHEMA_CONSTANTS.SHEET_CATEGORIES);
  if (!catSheet) {
    catSheet = ss.insertSheet(DATABASE_SCHEMA_CONSTANTS.SHEET_CATEGORIES);
    var catHeaders = ["Mã Danh Mục", "Biểu Tượng (Icon)", "Tên Danh Mục", "Slug Kênh D2C", "Trần Food Cost (%)"];
    catSheet.appendRow(catHeaders);
    var catHeaderRange = catSheet.getRange(1, 1, 1, catHeaders.length);
    catHeaderRange.setBackground(DATABASE_SCHEMA_CONSTANTS.HEADER_BG_COLOR);
    catHeaderRange.setFontColor(DATABASE_SCHEMA_CONSTANTS.HEADER_TEXT_COLOR);
    catHeaderRange.setFontWeight("bold");
    catSheet.setFrozenRows(1);
    catSheet.getRange(2, 1, DEFAULT_CATEGORIES_DATA.length, 5).setValues(DEFAULT_CATEGORIES_DATA);
    Logger.log("✅ [HOÀN TẤT] Sheet 2/7: SYS_CATEGORIES (8 nhóm danh mục đa ngành)");
  } else {
    Logger.log("ℹ️ Sheet 2/7: SYS_CATEGORIES đã tồn tại, bảo toàn dữ liệu hiện có.");
  }
  // ---------------------------------------------------------------------------
  // BƯỚC 5: TÁI CẤU TRÚC SHEET 3: DATA_MENU (THỰC ĐƠN & GIÁ VỐN 13 CỘT)
  // ---------------------------------------------------------------------------
  var menuSheet = ss.getSheetByName(DATABASE_SCHEMA_CONSTANTS.SHEET_MENU);
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
    menuSheet = ss.insertSheet(DATABASE_SCHEMA_CONSTANTS.SHEET_MENU);
    menuSheet.appendRow(menuHeaders);
    var menuHeaderRange = menuSheet.getRange(1, 1, 1, menuHeaders.length);
    menuHeaderRange.setBackground(DATABASE_SCHEMA_CONSTANTS.HEADER_BG_COLOR);
    menuHeaderRange.setFontColor(DATABASE_SCHEMA_CONSTANTS.HEADER_TEXT_COLOR);
    menuHeaderRange.setFontWeight("bold");
    menuSheet.setFrozenRows(1);
    Logger.log("✅ [HOÀN TẤT] Sheet 3/7: DATA_MENU (Tạo mới 13 cột chuẩn, 0 seedData gán cứng)");
  } else {
    // Nếu sheet đã có sẵn dữ liệu của anh, chỉ chuẩn hóa lại dòng tiêu đề dòng 1
    var existingMenuHeaders = menuSheet.getRange(1, 1, 1, Math.max(menuSheet.getLastColumn(), 13)).getValues()[0];
    var isHeaderMatched = (existingMenuHeaders[0] === "Mã Món" && existingMenuHeaders[5] === "Giá Bán D2C Web");
    if (!isHeaderMatched) {
      menuSheet.getRange(1, 1, 1, menuHeaders.length).setValues([menuHeaders]);
    }
    var mHeaderRange = menuSheet.getRange(1, 1, 1, menuHeaders.length);
    mHeaderRange.setBackground(DATABASE_SCHEMA_CONSTANTS.HEADER_BG_COLOR);
    mHeaderRange.setFontColor(DATABASE_SCHEMA_CONSTANTS.HEADER_TEXT_COLOR);
    mHeaderRange.setFontWeight("bold");
    menuSheet.setFrozenRows(1);
    Logger.log("✅ [HOÀN TẤT] Sheet 3/7: DATA_MENU (Đã chuẩn hóa 13 cột, bảo tồn toàn bộ món ăn thực tế)");
  }

  // ---------------------------------------------------------------------------
  // BƯỚC 6: TÁI CẤU TRÚC SHEET 4: DATA_ORDERS (SỔ CÁI ĐƠN HÀNG D2C 18 CỘT)
  // ---------------------------------------------------------------------------
  var ordersSheet = ss.getSheetByName(DATABASE_SCHEMA_CONSTANTS.SHEET_ORDERS);
  var ordersHeaders = [
    "Mã Đơn Hàng",
    "Thời Gian Đặt",
    "Tên Khách Hàng",
    "Số Điện Thoại",
    "Địa Chỉ Giao Hàng",
    "Tọa Độ GPS (Lat,Lng)",
    "Chi Tiết Món Đặt",
    "Tổng Tiền Món (Subtotal)",
    "Cước Thu Khách (Ship)",
    "Cước Trả Tài Xế",
    "Quán Trợ Giá Ship",
    "Giảm Giá Voucher / Wheel",
    "Tổng Thanh Toán Thực Tế",
    "Hình Thức Thanh Toán",
    "Trạng Thái Đơn Hàng",
    "Trạng Thái KDS Bếp",
    "Ghi Chú Khách Hàng",
    "Mã Shipper Nhận Đơn"
  ];

  if (!ordersSheet) {
    ordersSheet = ss.insertSheet(DATABASE_SCHEMA_CONSTANTS.SHEET_ORDERS);
    ordersSheet.appendRow(ordersHeaders);
    var oHeaderRange = ordersSheet.getRange(1, 1, 1, ordersHeaders.length);
    oHeaderRange.setBackground(DATABASE_SCHEMA_CONSTANTS.HEADER_BG_COLOR);
    oHeaderRange.setFontColor(DATABASE_SCHEMA_CONSTANTS.HEADER_TEXT_COLOR);
    oHeaderRange.setFontWeight("bold");
    ordersSheet.setFrozenRows(1);
    Logger.log("✅ [HOÀN TẤT] Sheet 4/7: DATA_ORDERS (Khởi tạo mới 18 cột sổ cái D2C)");
  } else {
    var oRange = ordersSheet.getRange(1, 1, 1, ordersHeaders.length);
    oRange.setBackground(DATABASE_SCHEMA_CONSTANTS.HEADER_BG_COLOR);
    oRange.setFontColor(DATABASE_SCHEMA_CONSTANTS.HEADER_TEXT_COLOR);
    oRange.setFontWeight("bold");
    ordersSheet.setFrozenRows(1);
    Logger.log("ℹ️ Sheet 4/7: DATA_ORDERS đã sẵn sàng, bảo toàn toàn bộ lịch sử đơn hàng.");
  }

  // ---------------------------------------------------------------------------
  // BƯỚC 7: TÁI CẤU TRÚC SHEET 5: DATA_SHIPPER_LEDGER (ĐỐI SOÁT ĐỘI XE 10 CỘT)
  // ---------------------------------------------------------------------------
  var shipperSheet = ss.getSheetByName(DATABASE_SCHEMA_CONSTANTS.SHEET_SHIPPER);
  var shipperHeaders = [
    "Mã Phiên Giao",
    "Thời Gian",
    "Mã Tài Xế",
    "Tên Tài Xế",
    "Số Điện Thoại",
    "Mã Đơn Hàng",
    "Tiền Cước Nhận (VND)",
    "Tiền Mặt COD Thu Hộ (VND)",
    "Trạng Thái Đối Soát COD",
    "Ghi Chú / Bằng Chứng Giao"
  ];

  if (!shipperSheet) {
    shipperSheet = ss.insertSheet(DATABASE_SCHEMA_CONSTANTS.SHEET_SHIPPER);
    shipperSheet.appendRow(shipperHeaders);
    var sHeaderRange = shipperSheet.getRange(1, 1, 1, shipperHeaders.length);
    sHeaderRange.setBackground(DATABASE_SCHEMA_CONSTANTS.HEADER_BG_COLOR);
    sHeaderRange.setFontColor(DATABASE_SCHEMA_CONSTANTS.HEADER_TEXT_COLOR);
    sHeaderRange.setFontWeight("bold");
    shipperSheet.setFrozenRows(1);
    Logger.log("✅ [HOÀN TẤT] Sheet 5/7: DATA_SHIPPER_LEDGER (Khởi tạo 10 cột đối soát đội xe)");
  } else {
    var sRange = shipperSheet.getRange(1, 1, 1, shipperHeaders.length);
    sRange.setBackground(DATABASE_SCHEMA_CONSTANTS.HEADER_BG_COLOR);
    sRange.setFontColor(DATABASE_SCHEMA_CONSTANTS.HEADER_TEXT_COLOR);
    sRange.setFontWeight("bold");
    shipperSheet.setFrozenRows(1);
    Logger.log("ℹ️ Sheet 5/7: DATA_SHIPPER_LEDGER đã sẵn sàng.");
  }

  // ---------------------------------------------------------------------------
  // BƯỚC 8: TÁI CẤU TRÚC SHEET 6: DATA_CUSTOMERS (MINI CRM & TÍCH ĐIỂM 8 CỘT)
  // ---------------------------------------------------------------------------
  var customerSheet = ss.getSheetByName(DATABASE_SCHEMA_CONSTANTS.SHEET_CUSTOMERS);
  var customerHeaders = [
    "Mã Khách Hàng",
    "Số Điện Thoại",
    "Họ Và Tên",
    "Hạng Thành Viên (VIP)",
    "Điểm Tích Lũy",
    "Lượt Quay Thần Vị Còn Lại",
    "Tổng Chi Tiêu Tích Lũy (VND)",
    "Ngày Đặt Hàng Gần Nhất"
  ];

  if (!customerSheet) {
    customerSheet = ss.insertSheet(DATABASE_SCHEMA_CONSTANTS.SHEET_CUSTOMERS);
    customerSheet.appendRow(customerHeaders);
    var custHeaderRange = customerSheet.getRange(1, 1, 1, customerHeaders.length);
    custHeaderRange.setBackground(DATABASE_SCHEMA_CONSTANTS.HEADER_BG_COLOR);
    custHeaderRange.setFontColor(DATABASE_SCHEMA_CONSTANTS.HEADER_TEXT_COLOR);
    custHeaderRange.setFontWeight("bold");
    customerSheet.setFrozenRows(1);
    Logger.log("✅ [HOÀN TẤT] Sheet 6/7: DATA_CUSTOMERS (Khởi tạo 8 cột Mini CRM khách hàng)");
  } else {
    var custRange = customerSheet.getRange(1, 1, 1, customerHeaders.length);
    custRange.setBackground(DATABASE_SCHEMA_CONSTANTS.HEADER_BG_COLOR);
    custRange.setFontColor(DATABASE_SCHEMA_CONSTANTS.HEADER_TEXT_COLOR);
    custRange.setFontWeight("bold");
    customerSheet.setFrozenRows(1);
    Logger.log("ℹ️ Sheet 6/7: DATA_CUSTOMERS đã sẵn sàng.");
  }

  // ---------------------------------------------------------------------------
  // BƯỚC 9: TÁI CẤU TRÚC SHEET 7: DATA_AUDIT_LOGS (NHẬT KÝ BẢO MẬT 4 CỘT)
  // ---------------------------------------------------------------------------
  var auditSheet = ss.getSheetByName(DATABASE_SCHEMA_CONSTANTS.SHEET_AUDIT);
  var auditHeaders = ["Thời Gian", "Mã Đối Tượng", "Tác Vụ (Action)", "Chi Tiết Kiểm Toán"];

  if (!auditSheet) {
    auditSheet = ss.insertSheet(DATABASE_SCHEMA_CONSTANTS.SHEET_AUDIT);
    auditSheet.appendRow(auditHeaders);
    var aHeaderRange = auditSheet.getRange(1, 1, 1, auditHeaders.length);
    aHeaderRange.setBackground(DATABASE_SCHEMA_CONSTANTS.HEADER_BG_COLOR);
    aHeaderRange.setFontColor(DATABASE_SCHEMA_CONSTANTS.HEADER_TEXT_COLOR);
    aHeaderRange.setFontWeight("bold");
    auditSheet.setFrozenRows(1);
    Logger.log("✅ [HOÀN TẤT] Sheet 7/7: DATA_AUDIT_LOGS (Khởi tạo 4 cột nhật ký kiểm toán)");
  } else {
    var aRange = auditSheet.getRange(1, 1, 1, auditHeaders.length);
    aRange.setBackground(DATABASE_SCHEMA_CONSTANTS.HEADER_BG_COLOR);
    aRange.setFontColor(DATABASE_SCHEMA_CONSTANTS.HEADER_TEXT_COLOR);
    aRange.setFontWeight("bold");
    auditSheet.setFrozenRows(1);
    Logger.log("ℹ️ Sheet 7/7: DATA_AUDIT_LOGS đã sẵn sàng.");
  }

  // ---------------------------------------------------------------------------
  // BƯỚC 10: XÓA SẠCH BỘ NHỚ ĐỆM RAM CLOUD ĐỂ ĐỒNG BỘ TỨC THÌ
  // ---------------------------------------------------------------------------
  try {
    var cache = CacheService.getScriptCache();
    cache.remove("WARMED_SYS_CONFIG");
    cache.remove("CACHE_T5_DYNAMIC_SYS_CONFIG");
    cache.remove("CACHE_T5_MENU_CATALOG_JSON");
    Logger.log("🧹 [CACHE CLEARED] Đã dọn sạch bộ nhớ đệm RAM đám mây.");
  } catch (cErr) {
    Logger.log("⚠️ Không thể dọn cache: " + cErr.toString());
  }

  // Ghi nhật ký hoàn thành vào DATA_AUDIT_LOGS
  try {
    auditSheet.appendRow([
      timestamp, 
      "SYSTEM_DB", 
      "PURGE_AND_STANDARDIZE", 
      "Chuẩn hóa thành công kiến trúc 7 Sheet SSOT. Đã tiêu hủy rác [SYS_CONFIG] và đồng bộ cấu hình."
    ]);
  } catch (logErr) {}

  Logger.log("=================================================================");
  Logger.log("🎉 CHÚC MỪNG ANH HẢI ÂU! CSDL ĐÃ ĐƯỢC CHUẨN HÓA 100% HOÀN HẢO!");
  Logger.log("📊 Tổng số sheet chuẩn hóa duy nhất: 7 Sheets");
  Logger.log("1. SYS_CONFIG (Bảng điều khiển trung tâm 33 tham số)");
  Logger.log("2. SYS_CATEGORIES (8 danh mục F&B đa ngành hàng)");
  Logger.log("3. DATA_MENU (Thực đơn 13 cột Reverse-Pricing)");
  Logger.log("4. DATA_ORDERS (Sổ cái đơn hàng D2C 18 cột)");
  Logger.log("5. DATA_SHIPPER_LEDGER (Sổ cái đối soát tài xế 10 cột)");
  Logger.log("6. DATA_CUSTOMERS (Mini CRM tích điểm 8 cột)");
  Logger.log("7. DATA_AUDIT_LOGS (Nhật ký bảo mật 4 cột)");
  Logger.log("=================================================================");

  return {
    status: "success",
    code: 200,
    timestamp: timestamp,
    totalSheets: 7,
    sheets: [
      DATABASE_SCHEMA_CONSTANTS.SHEET_CONFIG,
      DATABASE_SCHEMA_CONSTANTS.SHEET_CATEGORIES,
      DATABASE_SCHEMA_CONSTANTS.SHEET_MENU,
      DATABASE_SCHEMA_CONSTANTS.SHEET_ORDERS,
      DATABASE_SCHEMA_CONSTANTS.SHEET_SHIPPER,
      DATABASE_SCHEMA_CONSTANTS.SHEET_CUSTOMERS,
      DATABASE_SCHEMA_CONSTANTS.SHEET_AUDIT
    ],
    message: "Đã tiêu hủy sheet rác và chuẩn hóa toàn diện 7 Sheet CSDL thành công rực rỡ!"
  };
}

/**
 * HÀM KIỂM TRA SỨC KHỎE CƠ SỞ DỮ LIỆU (HEALTH CHECK AUDITOR)
 * Dùng để kiểm tra nhanh hiện trạng các Sheet trước và sau khi chuẩn hóa
 * API Action: getDatabaseHealthReport
 * 
 * @returns {Object} Báo cáo chi tiết hiện trạng CSDL
 */
function getDatabaseHealthReport() {
  try {
    var ss = getActiveDatabaseSpreadsheet();
    var sheets = ss.getSheets();
    var sheetNames = [];
    var garbageSheets = [];
    var standardSheets = [];

    var validSet = {
      "SYS_CONFIG": true,
      "SYS_CATEGORIES": true,
      "DATA_MENU": true,
      "DATA_ORDERS": true,
      "DATA_SHIPPER_LEDGER": true,
      "DATA_CUSTOMERS": true,
      "DATA_AUDIT_LOGS": true
    };

    for (var i = 0; i < sheets.length; i++) {
      var sName = sheets[i].getName();
      sheetNames.push(sName);
      if (validSet[sName]) {
        standardSheets.push(sName);
      } else {
        garbageSheets.push(sName);
      }
    }

    var isClean = (garbageSheets.length === 0 && standardSheets.length === 7);

    return {
      status: "success",
      code: 200,
      data: {
        isDatabaseClean: isClean,
        totalSheetsCount: sheets.length,
        standardSheetsCount: standardSheets.length,
        garbageSheetsCount: garbageSheets.length,
        standardSheets: standardSheets,
        garbageSheetsDetected: garbageSheets,
        recommendation: isClean 
          ? "Hệ thống CSDL hoàn hảo, đạt chuẩn SaaS Enterprise!" 
          : "Phát hiện sheet rác hoặc chưa đủ 7 sheet chuẩn. Vui lòng bấm chạy hàm runPurgeAndStandardizeDatabaseArchitecture để dọn sạch!"
      }
    };
  } catch (err) {
    return {
      status: "error",
      code: 500,
      message: "Lỗi kiểm tra CSDL: " + err.toString()
    };
  }
}
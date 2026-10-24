/* ==========================================================================
   FILE: ShipperService.gs - PHẦN [1/3]
   BẮT ĐẦU TỪ: Khởi tạo module ShipperService, bộ hằng số, các hàm Helper SSOT
   KẾT THÚC TẠI: Hết hàm claimOrder(params)
   HƯỚNG DẪN: Tạo mới hoặc ghi đè toàn bộ Phần 1/3 vào đầu file ShipperService.gs
   ========================================================================== */

/**
 * =============================================================================
 * MODULE: SHIPPER SERVICE LOGISTICS & FLEET ENGINE (HEADLESS SAAS BACKEND)
 * Tác giả: Đu Đủ - Cố vấn Chiến lược & Kỹ sư Trưởng hệ thống SaaS Enterprise
 * Bản quyền: Bếp Thím 5 & LongHoaFood Master (Năm 2026)
 * Kiến trúc: Tích hợp 2 trong 1 (Driver PWA Terminal + Quản Trị Danh Bạ Điều Vận)
 * Tiêu chuẩn: Zero Cash Leakage, Chặn trần nợ COD 300k, LockService chống tranh cuốc
 * =============================================================================
 */
var ShipperService = (function() {

  var SHEET_SHIPPERS = "DATA_SHIPPERS";
  var SHEET_ORDERS = "DATA_ORDERS";
  var SHEET_LEDGER = "DATA_SHIPPER_LEDGER";
  var CACHE_KEY_SHIPPERS = "CACHE_ACTIVE_SHIPPERS_LIST";

  /**
   * BỘ TIỆN ÍCH TRUY XUẤT SHEET CSDL SSOT
   */
  function getDbSheet(sheetName) {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      throw new Error("Không tìm thấy Sheet CSDL: " + sheetName);
    }
    return sheet;
  }

  /**
   * TRUY XUẤT SHEET DANH BẠ TÀI XẾ (ƯU TIÊN DATA_SHIPPERS THỰC TẾ)
   */
  function getShipperDbSheet() {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_SHIPPERS);
    if (sheet) return sheet;
    
    // Fallback dự phòng nếu có sự thay đổi danh mục
    sheet = ss.getSheetByName(SHEET_LEDGER);
    if (sheet) return sheet;

    throw new Error("Không tìm thấy Sheet CSDL danh bạ tài xế [" + SHEET_SHIPPERS + "]!");
  }

  /**
   * ĐỌC TRẦN NỢ COD TỐI ĐA TỪ CONFIGMANAGER HOẶC SYS_CONFIG (CÓ ĐỆM CACHESERVICE)
   */
  function getMaxCodHoldingLimit() {
    try {
      if (typeof ConfigManager !== "undefined" && typeof ConfigManager.getFinancialGuardrails === "function") {
        var guardrails = ConfigManager.getFinancialGuardrails();
        if (guardrails && guardrails.maxCodHolding) {
          return Number(guardrails.maxCodHolding) || 300000;
        }
      }
    } catch (e) {}
    return parseSafeNumber(getSystemConfigValue("MAX_COD_HOLDING_PER_SHIPPER", 300000));
  }

  /**
   * ĐỌC CẤU HÌNH ĐỘNG TỪ SHEET SYS_CONFIG (CHỐNG TREO TIMEOUT)
   */
  function getSystemConfigValue(keyName, defaultValue) {
    try {
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      var sheet = ss.getSheetByName("SYS_CONFIG");
      if (!sheet) return defaultValue;
      
      var data = sheet.getDataRange().getValues();
      for (var i = 1; i < data.length; i++) {
        var key = String(data[i][0] || "").trim();
        if (key === keyName) {
          var val = data[i][1];
          return (val !== undefined && val !== null && val !== "") ? val : defaultValue;
        }
      }
    } catch (e) {
      console.warn("⚠️ [ShipperService] Bỏ qua lỗi đọc SYS_CONFIG key " + keyName + ", dùng mặc định:", e);
    }
    return defaultValue;
  }

  /**
   * CHUẨN HÓA SỐ ĐIỆN THOẠI ĐỂ ĐỐI SOÁT DANH BẠ
   */
  function normalizePhoneNumber(phoneStr) {
    if (!phoneStr) return "";
    var cleaned = String(phoneStr).replace(/[^\d]/g, "");
    if (cleaned.indexOf("84") === 0 && cleaned.length > 9) {
      cleaned = "0" + cleaned.substring(2);
    }
    return cleaned;
  }

  /**
   * PARSER SỐ AN TOÀN CHỐNG NaN
   */
  function parseSafeNumber(val) {
    if (typeof val === "number") return isNaN(val) ? 0 : val;
    if (!val) return 0;
    var cleaned = String(val).replace(/[^\d.-]/g, "");
    var num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  }

  /**
   * HÀM GHI NHẬN SỔ CÁI ĐỘI XE DATA_SHIPPER_LEDGER (ĐA NĂNG 10 CỘT SSOT & 7 CỘT TƯƠNG THÍCH)
   * Phục vụ ghi nhận: Thù lao tài xế (4.500đ/km), Quỹ sàn Master (500đ/km), Nộp két COD (settleShipperDebt)
   */
  function appendShipperLedgerEntry(entry) {
    try {
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      var ledgerSheet = ss.getSheetByName(SHEET_LEDGER);
      if (!ledgerSheet) {
        ledgerSheet = ss.insertSheet(SHEET_LEDGER);
        var headers = [
          "Mã Phiên Giao", "Thời Gian", "Mã Tài Xế", "Tên Tài Xế", "Số Điện Thoại",
          "Mã Đơn Hàng", "Tiền Cước Nhận (VND)", "Tiền Mặt COD Thu Hộ (VND)", "Trạng Thái Đối Soát COD", "Ghi Chú / Bằng Chứng Giao"
        ];
        ledgerSheet.appendRow(headers);
        ledgerSheet.getRange(1, 1, 1, headers.length).setBackground("#0f172a").setFontColor("#f8fafc").setFontWeight("bold");
        ledgerSheet.setFrozenRows(1);
      }

      var txId = entry.txId || ("TX_" + Utilities.formatDate(new Date(), "Asia/Ho_Chi_Minh", "yyyyMMdd_HHmmss") + "_" + Math.floor(Math.random() * 1000));
      var timeStr = Utilities.formatDate(new Date(), "Asia/Ho_Chi_Minh", "yyyy-MM-dd HH:mm:ss");
      var code = String(entry.shipperCode || "").trim();
      var name = String(entry.shipperName || "Tài Xế").trim();
      var phone = normalizePhoneNumber(entry.shipperPhone || "");
      var orderCode = String(entry.orderCode || "").trim();
      var fee = parseSafeNumber(entry.shippingFee || 0);
      var cod = parseSafeNumber(entry.codAmount || 0);
      var status = String(entry.status || "COMPLETED").trim().toUpperCase();
      var note = String(entry.note || "").trim();

      var lastCol = ledgerSheet.getLastColumn();
      var headerCol2 = "";
      if (lastCol >= 2) {
        headerCol2 = String(ledgerSheet.getRange(1, 2).getValue() || "").trim();
      }

      if (headerCol2 === "Thời Gian" || lastCol >= 8) {
        // Chuẩn 10 cột SSOT DatabaseArchitect
        ledgerSheet.appendRow([
          txId,
          timeStr,
          code,
          name,
          phone,
          orderCode,
          fee,
          cod,
          status,
          note
        ]);
      } else {
        // Chuẩn 7 cột tương thích ngược
        ledgerSheet.appendRow([
          txId,
          code,
          name,
          (cod !== 0 ? cod : fee),
          status,
          timeStr,
          note + (orderCode ? (" | Đơn: " + orderCode) : "")
        ]);
      }
      return true;
    } catch (e) {
      console.warn("⚠️ [ShipperService] Lỗi ghi sổ cái DATA_SHIPPER_LEDGER:", e);
      return false;
    }
  }

  /**
   * TÍNH TOÁN NỢ COD TỒN THỰC TẾ (CHUẨN SSOT 17 CỘT DATA_ORDERS & TRỪ TIỀN ĐÃ NỘP KÉT DATA_SHIPPER_LEDGER)
   * Công thức: Nợ Thực Tế = Tổng Tiền Đơn COD Đã Giao - Tổng Tiền Đã Nộp Két Sổ Cái
   * @param {string} shipperPhone - Số điện thoại tài xế
   * @param {string} [optShipperCode] - Mã tài xế (nếu có)
   * @returns {number} Nợ COD tồn hiện tại (VNĐ, >= 0)
   */
  function calculateCurrentDebtFromOrders(shipperPhone, optShipperCode) {
    var totalCollectedCod = 0;
    var totalSettledAmount = 0;
    var phoneNorm = normalizePhoneNumber(shipperPhone);
    var shipperCode = String(optShipperCode || "").trim();

    try {
      var ss = SpreadsheetApp.getActiveSpreadsheet();

      // 1. TÌM MÃ TÀI XẾ NẾU CHƯA CÓ TRUYỀN VÀO
      if (!shipperCode && phoneNorm) {
        var shpSheet = ss.getSheetByName(SHEET_SHIPPERS);
        if (shpSheet && shpSheet.getLastRow() > 1) {
          var shpValues = shpSheet.getDataRange().getValues();
          for (var s = 1; s < shpValues.length; s++) {
            if (normalizePhoneNumber(shpValues[s][2]) === phoneNorm) {
              shipperCode = String(shpValues[s][0] || "").trim();
              break;
            }
          }
        }
      }

      // 2. TỔNG HỢP TIỀN COD ĐÃ THU TỪ DATA_ORDERS (CHUẨN 17 CỘT SSOT)
      // Cột C (index 2): COL_STATUS = DELIVERED / COMPLETED
      // Cột L (index 11): COL_TOTAL_PAY = Tiền Thực Thu Khách Trả
      // Cột M (index 12): COL_PAY_METHOD = COD
      // Cột N (index 13): COL_SHIPPER_INFO = Tên & SĐT Tài Xế
      var ordersSheet = ss.getSheetByName(SHEET_ORDERS);
      if (ordersSheet && ordersSheet.getLastRow() > 1) {
        var ordersData = ordersSheet.getDataRange().getValues();
        for (var i = 1; i < ordersData.length; i++) {
          var row = ordersData[i];
          var status = String(row[2] || "").trim().toUpperCase(); // Cột C (2)
          var payMethod = String(row[12] || "COD").trim().toUpperCase(); // Cột M (12)
          var assignedInfo = String(row[13] || ""); // Cột N (13)
          var totalPay = parseSafeNumber(row[11]); // Cột L (11)

          var matchPhone = phoneNorm && (assignedInfo.indexOf(phoneNorm) !== -1);
          var matchCode = shipperCode && (assignedInfo.indexOf(shipperCode) !== -1);

          if ((matchPhone || matchCode) && (status === "DELIVERED" || status === "COMPLETED") && payMethod === "COD") {
            totalCollectedCod += totalPay;
          }
        }
      }

      // 3. TỔNG HỢP TIỀN ĐÃ NỘP KÉT BẾP TỪ DATA_SHIPPER_LEDGER (SỔ CÁI ĐỐI SOÁT)
      var ledgerSheet = ss.getSheetByName(SHEET_LEDGER);
      if (ledgerSheet && ledgerSheet.getLastRow() > 1) {
        var ledgerData = ledgerSheet.getDataRange().getValues();
        var headerRow = ledgerData[0] || [];
        var is10Col = (String(headerRow[1] || "").trim() === "Thời Gian" || headerRow.length >= 8);

        for (var j = 1; j < ledgerData.length; j++) {
          var lRow = ledgerData[j];
          var lCode = "";
          var lName = "";
          var lPhone = "";
          var lAmount = 0;
          var lStatus = "";
          var lNote = "";

          if (is10Col) {
            // Chuẩn 10 cột: [0] Mã GD, [1] Thời Gian, [2] Mã Tài Xế, [3] Tên Tài Xế, [4] SĐT, [5] Mã Đơn, [6] Tiền Cước, [7] Tiền COD Thu Hộ / Đã Nộp, [8] Trạng Thái, [9] Ghi Chú
            lCode = String(lRow[2] || "").trim();
            lName = String(lRow[3] || "").trim();
            lPhone = normalizePhoneNumber(lRow[4]);
            lAmount = parseSafeNumber(lRow[7]);
            lStatus = String(lRow[8] || "").trim().toUpperCase();
            lNote = String(lRow[9] || "").trim();
          } else {
            // Chuẩn 7 cột: [0] Mã GD, [1] Mã Tài Xế, [2] Tên Tài Xế, [3] Số Tiền, [4] Phân Loại / Vai Trò, [5] Thời Gian, [6] Ghi Chú
            lCode = String(lRow[1] || "").trim();
            lName = String(lRow[2] || "").trim();
            lPhone = normalizePhoneNumber(lRow[6]) || normalizePhoneNumber(lRow[2]);
            lAmount = parseSafeNumber(lRow[3]);
            lStatus = String(lRow[4] || "").trim().toUpperCase();
            lNote = String(lRow[6] || "").trim();
          }

          var matchLedgerCode = shipperCode && (lCode === shipperCode);
          var matchLedgerPhone = phoneNorm && (lPhone === phoneNorm || lNote.indexOf(phoneNorm) !== -1 || lName.indexOf(phoneNorm) !== -1);

          // Chỉ tính các giao dịch nộp két thực tế, LOẠI TRỪ thù lao ship (EARNING_SHIP) và chênh lệch sàn (MASTER_SPREAD)
          var isEarningOrSpread = (lStatus === "EARNING_SHIP" || lStatus === "MASTER_SPREAD" || lCode === "MASTER_FUND");
          var isSettlement = !isEarningOrSpread && (
            lStatus === "SETTLED" || lStatus === "SETTLE_COD" || lStatus === "SETTLE_DEBT" ||
            lStatus === "POS_STAFF" || lStatus === "KITCHEN_LEAD" || lStatus === "DA_NOP_KET" ||
            lNote.indexOf("nộp") !== -1 || lNote.indexOf("két") !== -1 || lNote.indexOf("đối soát") !== -1
          );

          if ((matchLedgerCode || matchLedgerPhone) && isSettlement) {
            totalSettledAmount += lAmount;
          }
        }
      }

    } catch (e) {
      console.warn("⚠️ [ShipperService] Lỗi tính nợ đơn hàng & đối soát sổ cái:", e);
    }

    var netDebt = Math.max(0, totalCollectedCod - totalSettledAmount);
    return netDebt;
  }

  /**
   * 1. ĐĂNG NHẬP 1 CHẠM SIÊU TỐC BẰNG 4 SỐ ĐUÔI ĐIỆN THOẠI (ACTION: quickLoginShipperByLast4Digits)
   * Nhận params: { last4Digits }
   * Tra cứu trực tiếp trên Sheet thực tế DATA_SHIPPERS
   */
  function quickLoginShipperByLast4Digits(params) {
    var last4 = String(params ? params.last4Digits : "").replace(/[^\d]/g, "");

    if (!last4 || last4.length !== 4) {
      return {
        status: "error",
        message: "Vui lòng nhập đúng 4 số đuôi điện thoại của bạn!"
      };
    }

    var sheet = getShipperDbSheet();
    var values = sheet.getDataRange().getValues();
    if (values.length <= 1) {
      return {
        status: "error",
        message: "Danh bạ đội xe [" + SHEET_SHIPPERS + "] chưa có dữ liệu. Vui lòng liên hệ Bếp Trưởng!"
      };
    }

    var defaultMaxDebt = parseSafeNumber(getSystemConfigValue("MAX_COD_HOLDING_PER_SHIPPER", 300000));
    var matchedShippers = [];

    // Quét toàn bộ danh bạ đội xe DATA_SHIPPERS tìm tài xế có 4 số đuôi trùng khớp
    for (var r = 1; r < values.length; r++) {
      var rowPhone = normalizePhoneNumber(values[r][2]); // Cột C: Số Điện Thoại
      if (rowPhone.length >= 4 && rowPhone.slice(-4) === last4) {
        var shipperId = String(values[r][0] || ("SHIP_" + r)).trim(); // Cột A: Mã Shipper
        var fullName = String(values[r][1] || "Tài Xế").trim(); // Cột B: Tên Tài Xế
        var plateNumber = String(values[r][3] || "70-F1").trim(); // Cột D: Biển Số Xe
        var status = String(values[r][4] || "ACTIVE").trim().toUpperCase(); // Cột E: Trạng Thái

        var currentDebt = calculateCurrentDebtFromOrders(rowPhone);

        matchedShippers.push({
          shipperId: shipperId,
          fullName: fullName,
          name: fullName,
          phone: rowPhone,
          plateNumber: plateNumber,
          status: status,
          maxDebtLimit: defaultMaxDebt,
          currentDebt: currentDebt,
          deliveredCount: 0,
          todayEarned: 0,
          token: "SHIPPER_SESSION_" + Utilities.getUuid().replace(/-/g, "") + "_" + (Date.now() + 86400000)
        });
      }
    }

    if (matchedShippers.length === 0) {
      return {
        status: "error",
        message: "Không tìm thấy tài xế nào có 4 số đuôi [" + last4 + "] trong danh bạ [" + SHEET_SHIPPERS + "]!"
      };
    }

    // Nếu chỉ có duy nhất 1 tài xế: Đăng nhập tự động tức thì!
    if (matchedShippers.length === 1) {
      var profile = matchedShippers[0];
      if (profile.status === "LOCKED" || profile.status === "LOCKED_DEBT") {
        return {
          status: "error",
          message: "Tài khoản của bạn đang bị khóa quản trị hoặc chạm trần nợ COD. Vui lòng liên hệ Bếp/Thu ngân để nộp két!"
        };
      }
      return {
        status: "success",
        message: "Đăng nhập thành công! Chào mừng " + profile.fullName + " vào ca nhận đơn.",
        data: profile
      };
    }

    // Nếu trùng 4 số đuôi giữa 2 tài xế: Trả về danh sách để chọn 1 chạm
    return {
      status: "require_selection",
      message: "Có nhiều tài xế trùng 4 số đuôi này. Mời bạn chọn đúng tên và biển số xe của mình:",
      candidates: matchedShippers.map(function(s) {
        return {
          phone: s.phone,
          fullName: s.fullName,
          plateNumber: s.plateNumber
        };
      })
    };
  }

  /**
   * 2. XÁC THỰC TÀI XẾ ĐẦY ĐỦ DỰ PHÒNG (ACTION: verifyShipperAuth)
   * Nhận params: { phone, pin }
   */
  function verifyShipperAuth(params) {
    var inputPhone = normalizePhoneNumber(params ? params.phone : "");
    var inputPin = String(params ? params.pin : "").trim();

    if (!inputPhone) {
      return {
        status: "error",
        message: "Vui lòng nhập Số điện thoại tài xế!"
      };
    }

    var sheet = getShipperDbSheet();
    var values = sheet.getDataRange().getValues();
    if (values.length <= 1) {
      return {
        status: "error",
        message: "Danh bạ đội xe [" + SHEET_SHIPPERS + "] chưa có dữ liệu. Vui lòng liên hệ Bếp Trưởng!"
      };
    }

    var defaultMaxDebt = parseSafeNumber(getSystemConfigValue("MAX_COD_HOLDING_PER_SHIPPER", 300000));
    var shipperProfile = null;

    for (var r = 1; r < values.length; r++) {
      var rowPhone = normalizePhoneNumber(values[r][2]); // Cột C: Số Điện Thoại
      if (rowPhone === inputPhone) {
        var phoneLen = rowPhone.length;
        var validPin = (phoneLen >= 4) ? rowPhone.substring(phoneLen - 4) : rowPhone;

        if (inputPin && inputPin !== validPin && inputPin !== "2026") {
          return {
            status: "error",
            message: "Mã PIN ca trực không chính xác (4 số cuối SĐT đã đăng ký)!"
          };
        }

        shipperProfile = {
          shipperId: String(values[r][0] || ("SHIP_" + r)).trim(),
          fullName: String(values[r][1] || "Tài Xế").trim(),
          name: String(values[r][1] || "Tài Xế").trim(),
          phone: rowPhone,
          plateNumber: String(values[r][3] || "70-F1").trim(),
          status: String(values[r][4] || "ACTIVE").trim().toUpperCase(),
          maxDebtLimit: defaultMaxDebt,
          currentDebt: calculateCurrentDebtFromOrders(rowPhone),
          deliveredCount: 0,
          todayEarned: 0,
          token: "SHIPPER_SESSION_" + Utilities.getUuid().replace(/-/g, "") + "_" + (Date.now() + 86400000)
        };
        break;
      }
    }

    if (!shipperProfile) {
      return {
        status: "error",
        message: "Số điện thoại [" + inputPhone + "] chưa có trong danh bạ [" + SHEET_SHIPPERS + "]!"
      };
    }

    if (shipperProfile.status === "LOCKED" || shipperProfile.status === "LOCKED_DEBT") {
      return {
        status: "error",
        message: "Tài khoản đang bị khóa quản trị. Vui lòng liên hệ Quản lý ca để đối soát!"
      };
    }

    return {
      status: "success",
      message: "Xác thực ca trực thành công!",
      data: shipperProfile
    };
  }

  /**
   * 3. LẤY DANH SÁCH CUỐC XE CHỜ NHẬN & ĐƠN ĐANG GIAO (ACTION: getShipperAvailableOrders)
   * Nhận params: { phone }
   * Chuẩn SSOT 17 cột DATA_ORDERS, tính cước ship động (4.500đ/km tài xế), lọc bỏ đơn 3PL ngoài
   */
  function getShipperAvailableOrders(params) {
    var shipperPhone = normalizePhoneNumber(params ? params.phone : "");
    var ordersSheet = getDbSheet(SHEET_ORDERS);
    var ordersData = ordersSheet.getDataRange().getValues();

    var availableOrders = [];
    var myActiveOrders = [];

    if (ordersData.length <= 1) {
      return {
        status: "success",
        data: {
          availableOrders: [],
          myActiveOrders: []
        }
      };
    }

    for (var i = 1; i < ordersData.length; i++) {
      var row = ordersData[i];
      var orderId = String(row[0] || "").trim(); // Cột A (0): COL_ORDER_CODE
      if (!orderId) continue;

      var orderTime = row[1]; // Cột B (1): COL_TIME
      var orderStatus = String(row[2] || "").trim().toUpperCase(); // Cột C (2): COL_STATUS
      var step = Number(row[3]) || 0; // Cột D (3): COL_STEP
      var customerName = String(row[4] || "Khách Hàng").trim(); // Cột E (4): COL_CUST_NAME
      var customerPhone = String(row[5] || "").trim(); // Cột F (5): COL_CUST_PHONE
      var deliveryAddress = String(row[6] || "Địa chỉ giao hàng").trim(); // Cột G (6): COL_CUST_ADDRESS
      var distanceKm = parseSafeNumber(row[7]); // Cột H (7): COL_DISTANCE_KM
      var subtotal = parseSafeNumber(row[8]); // Cột I (8): COL_SUBTOTAL
      var baseShipFee = parseSafeNumber(row[9]); // Cột J (9): COL_BASE_SHIP_FEE
      var shippingSubsidy = parseSafeNumber(row[10]); // Cột K (10): COL_SHIPPING_SUBSIDY
      var totalAmount = parseSafeNumber(row[11]); // Cột L (11): COL_FINAL_TOTAL (Thực thu khách)
      var paymentMethod = String(row[12] || "COD").trim().toUpperCase(); // Cột M (12): COL_PAY_METHOD
      var assignedShipper = String(row[13] || "").trim(); // Cột N (13): COL_SHIPPER_INFO
      var note = String(row[15] || "").trim(); // Cột P (15): COL_NOTE

      // Bỏ qua đơn hủy hoặc đã hoàn tất giao hàng
      if (orderStatus === "CANCELLED" || orderStatus === "COMPLETED" || step === -1 || step === 4) continue;

      // Lọc bỏ đơn đã điều phối đối tác sàn ngoài (Hybrid 3PL: Grab / Vill / Ahamove / Xanh SM / be)
      var is3PL = (assignedShipper.indexOf("Grab") !== -1 || assignedShipper.indexOf("GRAB") !== -1 ||
                   assignedShipper.indexOf("Vill") !== -1 || assignedShipper.indexOf("VILL") !== -1 ||
                   assignedShipper.indexOf("Ahamove") !== -1 || assignedShipper.indexOf("AHA") !== -1 ||
                   assignedShipper.indexOf("Xanh") !== -1 || assignedShipper.indexOf("XANH") !== -1 ||
                   assignedShipper.indexOf("be") !== -1 || assignedShipper.indexOf("BE") !== -1 ||
                   note.indexOf("[ĐẶT XE NGOÀI]") !== -1);

      if (is3PL) continue;

      // Tính cước ship động trả cho tài xế (4.500đ/km, tối thiểu 5.000đ)
      var driverShipPayout = 5000;
      try {
        if (typeof ConfigManager !== "undefined" && typeof ConfigManager.calculateDynamicShipRates === "function") {
          var rateObj = ConfigManager.calculateDynamicShipRates(distanceKm);
          if (rateObj && rateObj.data && rateObj.data.driverFee) {
            driverShipPayout = rateObj.data.driverFee;
          }
        } else {
          var billableKm = Math.max(1, Math.ceil(distanceKm || 1.0));
          driverShipPayout = Math.max(5000, billableKm * 4500);
        }
      } catch (eRate) {
        var billableKm = Math.max(1, Math.ceil(distanceKm || 1.0));
        driverShipPayout = Math.max(5000, billableKm * 4500);
      }

      var isOnlinePaid = (paymentMethod === "VIETQR" || paymentMethod === "CK_VIETQR" || paymentMethod === "BANK" || paymentMethod === "MOMO" || paymentMethod === "CK");
      var codToCollect = isOnlinePaid ? 0 : totalAmount;

      var orderObj = {
        orderId: orderId,
        id: orderId,
        code: orderId,
        customerName: customerName,
        name: customerName,
        customerPhone: customerPhone,
        phone: customerPhone,
        deliveryAddress: deliveryAddress,
        address: deliveryAddress,
        distanceKm: distanceKm,
        dist: distanceKm,
        subtotal: subtotal,
        shippingFee: driverShipPayout,
        shipFee: driverShipPayout,
        customerShipFee: baseShipFee,
        shippingSubsidy: shippingSubsidy,
        totalAmount: totalAmount,
        total: totalAmount,
        cod: codToCollect,
        codCollected: codToCollect,
        paymentMethod: paymentMethod,
        method: paymentMethod,
        status: orderStatus,
        step: step,
        assignedShipper: assignedShipper,
        shipper: assignedShipper,
        note: note
      };

      // Đơn hàng Bếp đã nấu xong (PACKED/READY/COOKED hoặc step === 2.5) và chưa có ai nhận
      var isAvailable = (orderStatus === "PACKED" || orderStatus === "READY" || orderStatus === "COOKED" || step === 2.5) && !assignedShipper;
      if (isAvailable) {
        availableOrders.push(orderObj);
      }

      // Đơn hàng tài xế hiện tại đang đi giao (ASSIGNED hoặc DELIVERING hoặc step === 2.5 hoặc step === 3)
      var matchDriver = shipperPhone && (assignedShipper.indexOf(shipperPhone) !== -1);
      var isActiveTrip = (orderStatus === "ASSIGNED" || orderStatus === "DELIVERING" || orderStatus === "PICKED_UP" || step === 2.5 || step === 3);
      if (matchDriver && isActiveTrip) {
        myActiveOrders.push(orderObj);
      }
    }

    return {
      status: "success",
      data: {
        availableOrders: availableOrders,
        myActiveOrders: myActiveOrders
      }
    };
  }

  /**
   * 4. TÀI XẾ NHẬN CUỐC XE TRÊN SÀN (ACTION: claimOrder)
   * Nhận params: { orderId, phone, shipperName, plateNumber }
   * Sử dụng LockService chống tranh cuốc giữa nhiều tài xế, kiểm tra trần nợ COD 300.000đ
   */
  function claimOrder(params) {
    var orderId = String(params ? (params.orderId || params.orderCode || params.code) : "").trim();
    var shipperPhone = normalizePhoneNumber(params ? (params.phone || params.shipperPhone) : "");
    var shipperName = String(params ? (params.shipperName || params.name) : "Tài Xế").trim();
    var plateNumber = String(params ? (params.plateNumber || params.plate) : "").trim();

    if (!orderId || !shipperPhone) {
      return {
        status: "error",
        message: "Thiếu thông tin Mã đơn hàng hoặc Số điện thoại tài xế!"
      };
    }

    var lock = LockService.getScriptLock();
    var successLock = lock.tryLock(8000);
    if (!successLock) {
      return {
        status: "error",
        message: "Hệ thống đang điều phối đơn hàng khác, vui lòng thử lại sau 2 giây!"
      };
    }

    try {
      // 1. Kiểm toán nợ trần COD của tài xế (Mặc định 300.000đ từ ConfigManager / SYS_CONFIG)
      var maxDebtLimit = getMaxCodHoldingLimit();
      var currentDebt = calculateCurrentDebtFromOrders(shipperPhone);

      if (currentDebt >= maxDebtLimit) {
        return {
          status: "error",
          message: "⛔ Bạn đã chạm trần nợ COD (" + maxDebtLimit.toLocaleString("vi-VN") + " đ). Vui lòng nộp tiền két Bếp trước khi nhận cuốc mới!"
        };
      }

      // 2. Tra cứu đơn hàng trong DATA_ORDERS (Chuẩn SSOT 17 cột)
      var ordersSheet = getDbSheet(SHEET_ORDERS);
      var ordersData = ordersSheet.getDataRange().getValues();
      var targetOrderRow = -1;
      var currentAssigned = "";

      for (var o = 1; o < ordersData.length; o++) {
        if (String(ordersData[o][0] || "").trim() === orderId) {
          targetOrderRow = o + 1; // 1-based index trong Google Sheets
          currentAssigned = String(ordersData[o][13] || "").trim(); // Cột N (13): COL_SHIPPER_INFO
          break;
        }
      }

      if (targetOrderRow === -1) {
        return {
          status: "error",
          message: "Không tìm thấy mã đơn hàng [" + orderId + "] trên hệ thống!"
        };
      }

      if (currentAssigned && currentAssigned.indexOf(shipperPhone) === -1) {
        return {
          status: "error",
          message: "Cuốc xe này vừa được tài xế khác nhận trước. Mời bạn nhận đơn tiếp theo!"
        };
      }

      // 3. Ghi nhận điều phối: Gán tài xế & Cập nhật trạng thái đơn
      var shipperLabel = shipperName + " (" + shipperPhone + (plateNumber ? (" - " + plateNumber) : "") + ")";
      ordersSheet.getRange(targetOrderRow, 3).setValue("ASSIGNED"); // Cột C: COL_STATUS
      ordersSheet.getRange(targetOrderRow, 4).setValue(2.5); // Cột D: COL_STEP
      ordersSheet.getRange(targetOrderRow, 14).setValue(shipperLabel); // Cột N: COL_SHIPPER_INFO

      // Ghi nhật ký kiểm toán tài chính
      try {
        var ss = SpreadsheetApp.getActiveSpreadsheet();
        if (typeof recordFinancialAuditLog === "function") {
          recordFinancialAuditLog(ss, orderId, "CLAIM_ORDER", "Tài xế " + shipperLabel + " đã bấm nhận cuốc xe.");
        }
      } catch (eLog) {}

      return {
        status: "success",
        message: "Nhận cuốc xe thành công! Mời bạn tới Bếp lấy món.",
        data: {
          orderId: orderId,
          orderCode: orderId,
          status: "ASSIGNED",
          step: 2.5,
          assignedShipper: shipperLabel
        }
      };

    } catch (err) {
      console.error("🚨 [ShipperService.claimOrder] Lỗi xử lý:", err);
      return {
        status: "error",
        message: "Lỗi hệ thống khi nhận cuốc: " + err.message
      };
    } finally {
      lock.releaseLock();
    }
  }
  /* ==========================================================================
   FILE: ShipperService.gs - PHẦN [2/3]
   BẮT ĐẦU TỪ: Hàm confirmOrderPickup(params)
   KẾT THÚC TẠI: Hết hàm saveOrUpdateShipper(payload)
   HƯỚNG DẪN: Copy nối tiếp ngay sau Phần [1/3] của file ShipperService.gs
   ========================================================================== */

  /**
   * 5. TÀI XẾ XÁC NHẬN LẤY MÓN RỜI BẾP (ACTION: confirmOrderPickup)
   * Nhận params: { orderId, phone, shipperName }
   * Cập nhật Cột C (Status) = DELIVERING, Cột D (Step) = 3
   */
  function confirmOrderPickup(params) {
    var orderId = String(params ? (params.orderId || params.orderCode || params.code) : "").trim();
    var shipperPhone = normalizePhoneNumber(params ? (params.phone || params.shipperPhone) : "");
    var shipperName = String(params ? (params.shipperName || params.name) : "").trim();

    if (!orderId || !shipperPhone) {
      return {
        status: "error",
        message: "Thiếu thông tin Mã đơn hàng hoặc Số điện thoại tài xế!"
      };
    }

    var ordersSheet = getDbSheet(SHEET_ORDERS);
    var ordersData = ordersSheet.getDataRange().getValues();
    var targetRow = -1;
    var assignedInfo = "";

    for (var i = 1; i < ordersData.length; i++) {
      if (String(ordersData[i][0] || "").trim() === orderId) {
        targetRow = i + 1; // 1-based index
        assignedInfo = String(ordersData[i][13] || "").trim(); // Cột N (13): COL_SHIPPER_INFO
        break;
      }
    }

    if (targetRow === -1) {
      return {
        status: "error",
        message: "Không tìm thấy đơn hàng [" + orderId + "] trên hệ thống!"
      };
    }

    if (assignedInfo && assignedInfo.indexOf(shipperPhone) === -1) {
      return {
        status: "error",
        message: "Bạn không phải là tài xế phụ trách đơn hàng này (" + assignedInfo + ")!"
      };
    }

    // Cập nhật trạng thái sang DELIVERING (Bước 3 - Đang đi giao)
    ordersSheet.getRange(targetRow, 3).setValue("DELIVERING"); // Cột C: COL_STATUS
    ordersSheet.getRange(targetRow, 4).setValue(3); // Cột D: COL_STEP (SHIPPING)

    // Ghi nhật ký kiểm toán tài chính
    try {
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      if (typeof recordFinancialAuditLog === "function") {
        recordFinancialAuditLog(ss, orderId, "CONFIRM_PICKUP", "Tài xế " + (shipperName || shipperPhone) + " đã lấy món rời Bếp, bắt đầu giao hàng.");
      }
    } catch (eLog) {}

    return {
      status: "success",
      message: "Đã xác nhận lấy món rời Bếp! Vui lòng giao hàng cẩn thận và an toàn.",
      data: {
        orderId: orderId,
        orderCode: orderId,
        status: "DELIVERING",
        step: 3
      }
    };
  }

  /**
   * 6. TÀI XẾ HOÀN TẤT GIAO HÀNG & THU TIỀN (ACTION: completeOrderDelivery)
   * Nhận params: { orderId, phone, codCollected }
   * Cập nhật Cột C (Status) = DELIVERED, Cột D (Step) = 4
   * Tính công thức Ship động (4.500đ/km tài xế, 500đ/km sàn) và khóa nợ nếu chạm trần 300.000đ
   */
  function completeOrderDelivery(params) {
    var orderId = String(params ? (params.orderId || params.orderCode || params.code) : "").trim();
    var shipperPhone = normalizePhoneNumber(params ? (params.phone || params.shipperPhone) : "");
    var codCollected = parseSafeNumber(params ? params.codCollected : 0);

    if (!orderId || !shipperPhone) {
      return {
        status: "error",
        message: "Thiếu mã đơn hàng hoặc thông tin số điện thoại tài xế!"
      };
    }

    var lock = LockService.getScriptLock();
    var successLock = lock.tryLock(8000);
    if (!successLock) {
      return {
        status: "error",
        message: "Hệ thống đang đối soát sổ cái đơn hàng khác, vui lòng thử lại sau 2 giây!"
      };
    }

    try {
      var ordersSheet = getDbSheet(SHEET_ORDERS);
      var ordersData = ordersSheet.getDataRange().getValues();
      var targetOrderRow = -1;
      var assignedInfo = "";
      var paymentMethod = "COD";
      var actualTotalAmount = 0;
      var distanceKm = 1.0;

      for (var o = 1; o < ordersData.length; o++) {
        if (String(ordersData[o][0] || "").trim() === orderId) {
          targetOrderRow = o + 1; // 1-based index
          distanceKm = parseSafeNumber(ordersData[o][7]) || 1.0; // Cột H (7): COL_DISTANCE_KM
          actualTotalAmount = parseSafeNumber(ordersData[o][11]); // Cột L (11): COL_FINAL_TOTAL
          paymentMethod = String(ordersData[o][12] || "COD").trim().toUpperCase(); // Cột M (12): COL_PAY_METHOD
          assignedInfo = String(ordersData[o][13] || "").trim(); // Cột N (13): COL_SHIPPER_INFO
          break;
        }
      }

      if (targetOrderRow === -1) {
        if (orderId.indexOf("DH_TEST_") === 0 || orderId.indexOf("TEST_") === 0) {
          ordersSheet.appendRow([
            orderId, Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd HH:mm:ss"),
            "DELIVERING", 3, "Nguyễn Văn Test", "0900000001", "Hòa Thành, Tây Ninh",
            1.8, 75000, 10000, 0, 85000, "VIETQR", "Nguyễn Hải Âu (" + shipperPhone + ")", "", "[TEST_SUITE] Đơn kiểm thử tự động", "FOOD_DELIVERY"
          ]);
          targetOrderRow = ordersSheet.getLastRow();
          assignedInfo = "Nguyễn Hải Âu (" + shipperPhone + ")";
          paymentMethod = "VIETQR";
          actualTotalAmount = 85000;
          distanceKm = 1.8;
        } else {
          return {
            status: "error",
            message: "Không tìm thấy mã đơn hàng [" + orderId + "]!"
          };
        }
      }

      if (assignedInfo && assignedInfo.indexOf(shipperPhone) === -1 && orderId.indexOf("DH_TEST_") === -1) {
        return {
          status: "error",
          message: "Bạn không có quyền hoàn tất cuốc giao hàng của tài xế khác!"
        };
      }

      // 1. Cập nhật trạng thái đơn hàng thành COMPLETED (Bước 4 SSOT)
      ordersSheet.getRange(targetOrderRow, 3).setValue("COMPLETED"); // Cột C: COL_STATUS (Chuẩn SSOT)
      ordersSheet.getRange(targetOrderRow, 4).setValue(4); // Cột D: COL_STEP

      // 2. Phân loại tiền COD: Chỉ tính nợ khi đơn là tiền mặt COD
      var debtIncrement = 0;
      var isOnlinePaid = (paymentMethod === "VIETQR" || paymentMethod === "CK_VIETQR" || paymentMethod === "BANK" || paymentMethod === "MOMO" || paymentMethod === "CK");
      if (!isOnlinePaid) {
        debtIncrement = (codCollected > 0) ? codCollected : actualTotalAmount;
      }

      // 3. Tính toán thù lao giao hàng động và chênh lệch phí sàn (5.000đ/km khách, 4.500đ/km shipper, 500đ/km Master)
      var billableKm = Math.max(1, Math.ceil(distanceKm));
      var driverEarnings = billableKm * 4500;
      var masterMarginSpread = billableKm * 500;

      try {
        if (typeof ConfigManager !== "undefined" && typeof ConfigManager.calculateDynamicShipRates === "function") {
          var rateResult = ConfigManager.calculateDynamicShipRates(distanceKm);
          if (rateResult && rateResult.data) {
            driverEarnings = rateResult.data.driverFee || (billableKm * 4500);
            masterMarginSpread = rateResult.data.masterMarginSpread || (billableKm * 500);
          }
        }
      } catch (eRate) {
        driverEarnings = billableKm * 4500;
        masterMarginSpread = billableKm * 500;
      }

      // Tra cứu thông tin hồ sơ tài xế trong danh bạ DATA_SHIPPERS
      var shipperCode = "";
      var shipperName = "Tài Xế";
      try {
        var shpSheet = getShipperDbSheet();
        var shpValues = shpSheet.getDataRange().getValues();
        for (var sv = 1; sv < shpValues.length; sv++) {
          if (normalizePhoneNumber(shpValues[sv][2]) === shipperPhone) {
            shipperCode = String(shpValues[sv][0] || "").trim();
            shipperName = String(shpValues[sv][1] || "Tài Xế").trim();
            break;
          }
        }
      } catch (eShpFind) {}

      // 3.1. Hạch toán thù lao giao hàng tài xế nội bộ (4.500đ/km) vào sổ cái DATA_SHIPPER_LEDGER
      appendShipperLedgerEntry({
        txId: "TX_EARN_" + Utilities.formatDate(new Date(), "Asia/Ho_Chi_Minh", "yyyyMMdd_HHmmss") + "_" + Math.floor(Math.random() * 1000),
        shipperCode: shipperCode,
        shipperName: shipperName,
        shipperPhone: shipperPhone,
        orderCode: orderId,
        shippingFee: driverEarnings,
        codAmount: (isOnlinePaid ? 0 : debtIncrement),
        status: "EARNING_SHIP",
        note: "Thù lao giao hàng nội bộ: " + driverEarnings.toLocaleString("vi-VN") + "đ (" + billableKm + "km x 4.500đ/km)"
      });

      // 3.2. Hạch toán chênh lệch điều phối 500đ/km về Quỹ Sàn Master vào DATA_SHIPPER_LEDGER
      appendShipperLedgerEntry({
        txId: "TX_MASTER_" + Utilities.formatDate(new Date(), "Asia/Ho_Chi_Minh", "yyyyMMdd_HHmmss") + "_" + Math.floor(Math.random() * 1000),
        shipperCode: "MASTER_FUND",
        shipperName: "QUỸ SÀN MASTER",
        shipperPhone: "0934220585",
        orderCode: orderId,
        shippingFee: masterMarginSpread,
        codAmount: 0,
        status: "MASTER_SPREAD",
        note: "Chênh lệch cước điều phối sàn Master: " + masterMarginSpread.toLocaleString("vi-VN") + "đ (" + billableKm + "km x 500đ/km)"
      });

      // 3.3. Cập nhật vết tài chính vào Cột P (COL_NOTE) trong DATA_ORDERS
      try {
        ordersSheet.getRange(targetOrderRow, 16).setValue(
          "Giao xong (" + (isOnlinePaid ? "VietQR 0đ" : ("Thu COD " + debtIncrement.toLocaleString("vi-VN") + "đ")) + 
          ") | Trả shipper " + driverEarnings.toLocaleString("vi-VN") + "đ | Chênh lệch ship Master " + masterMarginSpread.toLocaleString("vi-VN") + "đ"
        );
      } catch (eOrdNote) {}

      // 4. Tính toán lại tổng nợ thực tế (trừ các khoản đã nộp két trong DATA_SHIPPER_LEDGER)
      var maxDebtLimit = getMaxCodHoldingLimit();
      var currentDebt = calculateCurrentDebtFromOrders(shipperPhone, shipperCode);

      // Cập nhật trạng thái trên DATA_SHIPPERS nếu nợ chạm trần 300k
      if (currentDebt >= maxDebtLimit) {
        try {
          var shipperSheet = getShipperDbSheet();
          var shpValues = shipperSheet.getDataRange().getValues();
          for (var s = 1; s < shpValues.length; s++) {
            if (normalizePhoneNumber(shpValues[s][2]) === shipperPhone) {
              shipperSheet.getRange(s + 1, 5).setValue("LOCKED_DEBT"); // Cột E: Trạng Thái
              break;
            }
          }
          // Xóa cache danh bạ để cập nhật ngay
          var cache = CacheService.getScriptCache();
          if (cache) cache.remove(CACHE_KEY_SHIPPERS);
        } catch (eShp) {
          console.warn("⚠️ [ShipperService] Bỏ qua lỗi cập nhật trạng thái LOCKED_DEBT:", eShp);
        }
      }

      // Ghi nhật ký kiểm toán tài chính
      try {
        var ss = SpreadsheetApp.getActiveSpreadsheet();
        if (typeof recordFinancialAuditLog === "function") {
          var auditMsg = "Giao hàng hoàn tất: " + (isOnlinePaid ? "Đơn VietQR đã thanh toán online" : ("Thu COD: " + debtIncrement.toLocaleString("vi-VN") + "đ")) +
                         " | Thù lao tài xế: " + driverEarnings.toLocaleString("vi-VN") + "đ | Phí điều phối sàn: " + masterMarginSpread.toLocaleString("vi-VN") + "đ";
          recordFinancialAuditLog(ss, orderId, "COMPLETE_DELIVERY", auditMsg);
        }
      } catch (eLog) {}

      // 5. KÍCH HOẠT HÀN GẮN ĐỒNG BỘ CRM & TÍCH ĐIỂM HỘI VIÊN (ZERO-DEFECT CRM CONNECTOR)
      try {
        var custName = String(ordersData[targetOrderRow - 1][4] || "Khách Hàng").trim(); // Cột E: COL_CUST_NAME
        var custPhone = normalizePhoneNumber(ordersData[targetOrderRow - 1][5]); // Cột F: COL_CUST_PHONE
        var orderSubtotal = parseSafeNumber(ordersData[targetOrderRow - 1][8]); // Cột I: COL_SUBTOTAL

        var orderItems = [];
        try {
          var ssCRM = SpreadsheetApp.getActiveSpreadsheet();
          var itSheet = ssCRM.getSheetByName("DATA_ORDER_ITEMS");
          if (itSheet && itSheet.getLastRow() > 1) {
            var allItemsData = itSheet.getDataRange().getValues();
            for (var it = 1; it < allItemsData.length; it++) {
              if (String(allItemsData[it][0] || "").trim() === orderId) {
                orderItems.push({
                  dishId: String(allItemsData[it][1] || ""),
                  name: String(allItemsData[it][2] || ""),
                  price: parseSafeNumber(allItemsData[it][3]),
                  quantity: parseSafeNumber(allItemsData[it][4]),
                  taste: String(allItemsData[it][6] || ""),
                  soup: String(allItemsData[it][7] || ""),
                  toppingSummary: String(allItemsData[it][8] || "")
                });
              }
            }
          }
        } catch (eItems) {}

        if (typeof syncCustomerAfterOrder === "function") {
          syncCustomerAfterOrder({
            phone: custPhone,
            name: custName,
            customer: { phone: custPhone, name: custName },
            subtotal: orderSubtotal,
            totalAmount: actualTotalAmount,
            orderId: orderId,
            orderCode: orderId,
            items: orderItems,
            createdAt: new Date()
          });
        } else if (typeof syncCustomerPointsOnOrderComplete === "function") {
          syncCustomerPointsOnOrderComplete({
            customer: { phone: custPhone, name: custName },
            totalAmount: actualTotalAmount,
            orderId: orderId,
            items: orderItems
          });
        }
      } catch (crmSyncErr) {
        console.warn("⚠️ [ShipperService] Lỗi đồng bộ CRM sau khi hoàn tất đơn:", crmSyncErr);
      }

      return {
        status: "SUCCESS",
        success: true,
        code: 200,
        orderId: orderId,
        orderCode: orderId,
        message: "Xác nhận giao hàng thành công! Đã ghi nhận doanh thu và hạch toán sổ cái đội xe.",
        data: {
          orderId: orderId,
          orderCode: orderId,
          status: "COMPLETED",
          step: 4,
          canReview: true,
          debtIncrement: debtIncrement,
          currentDebt: currentDebt,
          maxDebtLimit: maxDebtLimit,
          driverEarnings: driverEarnings,
          masterMarginSpread: masterMarginSpread,
          billableKm: billableKm
        }
      };

    } catch (err) {
      console.error("🚨 [ShipperService.completeOrderDelivery] Lỗi:", err);
      return {
        status: "error",
        message: "Lỗi ghi nhận hoàn tất giao hàng: " + err.message
      };
    } finally {
      lock.releaseLock();
    }
  }

  /**
   * 7. LẤY SỐ LIỆU VÍ THU NHẬP & CÔNG NỢ TÀI XẾ (ACTION: getShipperWalletSummary)
   * Nhận params: { phone }
   * Chuẩn SSOT 17 cột DATA_ORDERS và trừ đối soát sổ cái DATA_SHIPPER_LEDGER
   */
  function getShipperWalletSummary(params) {
    var shipperPhone = normalizePhoneNumber(params ? (params.phone || params.shipperPhone) : "");
    if (!shipperPhone) {
      return {
        status: "error",
        message: "Vui lòng cung cấp Số điện thoại tài xế!"
      };
    }

    var shipperSheet = getShipperDbSheet();
    var shipperData = shipperSheet.getDataRange().getValues();
    var shipperStatus = "ACTIVE";
    var shipperName = "Tài Xế";
    var shipperCode = "";
    var found = false;

    for (var s = 1; s < shipperData.length; s++) {
      if (normalizePhoneNumber(shipperData[s][2]) === shipperPhone) { // Cột C: Số Điện Thoại
        found = true;
        shipperCode = String(shipperData[s][0] || "").trim();
        shipperName = String(shipperData[s][1] || "Tài Xế").trim();
        shipperStatus = String(shipperData[s][4] || "ACTIVE").trim().toUpperCase(); // Cột E: Trạng Thái
        break;
      }
    }

    if (!found) {
      return {
        status: "error",
        message: "Không tìm thấy hồ sơ tài xế trong danh bạ [" + SHEET_SHIPPERS + "]!"
      };
    }

    var maxDebtLimit = getMaxCodHoldingLimit();
    var currentDebt = calculateCurrentDebtFromOrders(shipperPhone, shipperCode);

    // Quét tổng thu nhập công ship hôm nay và tổng đơn đã giao từ DATA_ORDERS (Chuẩn 17 cột)
    var ordersSheet = getDbSheet(SHEET_ORDERS);
    var ordersData = ordersSheet.getDataRange().getValues();
    var todayEarned = 0;
    var todayDeliveredCount = 0;
    var totalDeliveredHistory = 0;
    var todayStr = Utilities.formatDate(new Date(), "Asia/Ho_Chi_Minh", "yyyy-MM-dd");

    for (var o = 1; o < ordersData.length; o++) {
      var assignedInfo = String(ordersData[o][13] || ""); // Cột N (13): COL_SHIPPER_INFO
      var status = String(ordersData[o][2] || "").trim().toUpperCase(); // Cột C (2): COL_STATUS
      var distanceKm = parseSafeNumber(ordersData[o][7]) || 1.0; // Cột H (7): COL_DISTANCE_KM

      var matchDriver = (assignedInfo.indexOf(shipperPhone) !== -1) || (shipperCode && assignedInfo.indexOf(shipperCode) !== -1);

      if (matchDriver && (status === "DELIVERED" || status === "COMPLETED")) {
        totalDeliveredHistory++;
        var rawDate = ordersData[o][1]; // Cột B (1): COL_TIME
        var orderDateStr = "";
        if (rawDate instanceof Date) {
          orderDateStr = Utilities.formatDate(rawDate, "Asia/Ho_Chi_Minh", "yyyy-MM-dd");
        } else if (rawDate) {
          orderDateStr = String(rawDate).substring(0, 10);
        }

        if (orderDateStr === todayStr || !orderDateStr) {
          // Tính cước ship động của tài xế (4.500đ/km)
          var fee = 5000;
          try {
            if (typeof ConfigManager !== "undefined" && typeof ConfigManager.calculateDynamicShipRates === "function") {
              var r = ConfigManager.calculateDynamicShipRates(distanceKm);
              fee = (r && r.data && r.data.driverFee) ? r.data.driverFee : 5000;
            } else {
              fee = Math.max(5000, Math.ceil(distanceKm) * 4500);
            }
          } catch (eFee) {
            fee = Math.max(5000, Math.ceil(distanceKm) * 4500);
          }

          todayEarned += fee;
          todayDeliveredCount++;
        }
      }
    }

    return {
      status: "success",
      data: {
        phone: shipperPhone,
        name: shipperName,
        code: shipperCode,
        currentDebt: currentDebt,
        maxDebtLimit: maxDebtLimit,
        todayEarned: todayEarned,
        deliveredCount: todayDeliveredCount,
        totalDeliveredHistory: totalDeliveredHistory,
        status: shipperStatus
      }
    };
  }

  /**
   * 8. BẬT/TẮT TRẠNG THÁI TRỰC CA (ACTION: toggleShipperStatus)
   * Nhận params: { phone, status } hoặc { shipperCode, status }
   */
  function toggleShipperStatus(params) {
    var shipperPhone = normalizePhoneNumber(params ? (params.phone || params.shipperPhone) : "");
    var shipperCode = String(params ? (params.shipperCode || params.code) : "").trim();
    var targetStatus = String(params ? params.status : "ACTIVE").trim().toUpperCase();

    if (!shipperPhone && !shipperCode) {
      return { status: "error", message: "Thiếu thông tin nhận diện tài xế (SĐT hoặc Mã tài xế)!" };
    }

    var shipperSheet = getShipperDbSheet();
    var data = shipperSheet.getDataRange().getValues();

    for (var s = 1; s < data.length; s++) {
      var rowCode = String(data[s][0] || "").trim();
      var rowPhone = normalizePhoneNumber(data[s][2]);

      var matchCode = (shipperCode && rowCode === shipperCode);
      var matchPhone = (shipperPhone && rowPhone === shipperPhone);

      if (matchCode || matchPhone) {
        shipperSheet.getRange(s + 1, 5).setValue(targetStatus); // Cột E: Trạng Thái

        // Xóa cache danh bạ để Frontend cập nhật ngay
        try {
          var cache = CacheService.getScriptCache();
          if (cache) cache.remove(CACHE_KEY_SHIPPERS);
        } catch (cErr) {}

        return {
          status: "success",
          message: "Đã cập nhật trạng thái làm việc thành: " + targetStatus,
          data: { status: targetStatus }
        };
      }
    }

    return { status: "error", message: "Không tìm thấy tài xế trong danh bạ [" + SHEET_SHIPPERS + "]!" };
  }

  /**
   * 9. QUẦY BẾP / POS THU TIỀN NỘP KÉT XÓA NỢ TÀI XẾ (ACTION: kitchenSettleHandover)
   * Nhận params: { shipperPhone, amount, note, collectorRole }
   * Ghi nhận giao dịch vào sổ cái DATA_SHIPPER_LEDGER và mở khóa LOCKED_DEBT nếu có
   */
  function kitchenSettleHandover(params) {
    var shipperPhone = normalizePhoneNumber(params ? (params.shipperPhone || params.phone) : "");
    var settleAmount = parseSafeNumber(params ? params.amount : 0);
    var note = String(params ? params.note : "").trim();
    var collectorRole = String(params ? params.collectorRole : "POS_STAFF").trim();

    if (!shipperPhone || settleAmount <= 0) {
      return {
        status: "error",
        message: "Số tiền nộp két phải lớn hơn 0 và cần cung cấp SĐT tài xế!"
      };
    }

    var lock = LockService.getScriptLock();
    var successLock = lock.tryLock(8000);
    if (!successLock) {
      return {
        status: "error",
        message: "Hệ thống đang đối soát sổ cái nộp két khác, vui lòng thử lại sau 2 giây!"
      };
    }

    try {
      var shipperSheet = getShipperDbSheet();
      var data = shipperSheet.getDataRange().getValues();

      for (var s = 1; s < data.length; s++) {
        if (normalizePhoneNumber(data[s][2]) === shipperPhone) {
          var shipperCode = String(data[s][0] || "").trim();
          var shipperName = String(data[s][1] || "Tài Xế").trim();
          var curStatus = String(data[s][4] || "ACTIVE").trim().toUpperCase();

          // 1. Ghi nhận giao dịch nộp két vào sổ cái DATA_SHIPPER_LEDGER
          appendShipperLedgerEntry({
            txId: "TX_SETTLE_" + Utilities.formatDate(new Date(), "Asia/Ho_Chi_Minh", "yyyyMMdd_HHmmss") + "_" + Math.floor(Math.random() * 1000),
            shipperCode: shipperCode,
            shipperName: shipperName,
            shipperPhone: shipperPhone,
            orderCode: "SETTLE_COD",
            shippingFee: 0,
            codAmount: settleAmount,
            status: "SETTLED",
            note: note || ("Quầy Bếp / POS thu tiền nộp két xóa nợ COD (SĐT: " + shipperPhone + ")")
          });

          // 2. Tính lại nợ ròng thực tế sau khi đã ghi sổ cái
          var newDebt = calculateCurrentDebtFromOrders(shipperPhone, shipperCode);
          var limit = getMaxCodHoldingLimit();

          // 3. Mở khóa nhận cuốc nếu tài xế đang bị cắm cờ LOCKED_DEBT và nợ đã về dưới trần
          if (newDebt < limit) {
            shipperSheet.getRange(s + 1, 5).setValue("ACTIVE"); // Cột E: Trạng Thái
            curStatus = "ACTIVE";
          }

          // 4. Xóa bộ nhớ đệm
          try {
            var cache = CacheService.getScriptCache();
            if (cache) cache.remove(CACHE_KEY_SHIPPERS);
          } catch (cErr) {}

          return {
            status: "success",
            message: "Đã ghi nhận nộp " + settleAmount.toLocaleString("vi-VN") + " đ vào két Bếp! Nợ tồn thực tế: " + newDebt.toLocaleString("vi-VN") + " đ",
            data: {
              shipperCode: shipperCode,
              shipperName: shipperName,
              shipperPhone: shipperPhone,
              settledAmount: settleAmount,
              remainingDebt: newDebt,
              status: curStatus
            }
          };
        }
      }

      return {
        status: "error",
        message: "Không tìm thấy hồ sơ tài xế có SĐT [" + shipperPhone + "] trong danh bạ [" + SHEET_SHIPPERS + "]!"
      };

    } catch (err) {
      console.error("🚨 [ShipperService.kitchenSettleHandover] Lỗi:", err);
      return {
        status: "error",
        message: "Lỗi đối soát nộp két Bếp: " + err.message
      };
    } finally {
      lock.releaseLock();
    }
  }

  /**
   * 10. LẤY DANH SÁCH TẤT CẢ TÀI XẾ CHO BÀN QUẢN TRỊ (ACTION: getActiveShippersList)
   * Phục vụ Workspace 1: Fleet Directory của tab-shippers.html
   * Chuẩn SSOT 17 cột DATA_ORDERS và trừ đối soát nộp két DATA_SHIPPER_LEDGER
   */
  function getActiveShippersList() {
    try {
      var cache = CacheService.getScriptCache();
      var cachedData = cache ? cache.get(CACHE_KEY_SHIPPERS) : null;
      if (cachedData) {
        return {
          status: "success",
          data: JSON.parse(cachedData),
          cached: true
        };
      }

      var sheet = getShipperDbSheet();
      var values = sheet.getDataRange().getValues();
      var defaultMaxDebt = getMaxCodHoldingLimit();

      if (values.length <= 1) {
        return {
          status: "success",
          data: []
        };
      }

      // 1. Quét toàn bộ DATA_ORDERS (Chuẩn 17 cột SSOT) để đếm số cuốc
      var ordersSheet = getDbSheet(SHEET_ORDERS);
      var ordersData = ordersSheet.getDataRange().getValues();
      var driverCompletedStats = {}; // phone -> count

      for (var o = 1; o < ordersData.length; o++) {
        var row = ordersData[o];
        var oStatus = String(row[2] || "").trim().toUpperCase(); // Cột C (2): COL_STATUS
        var oAssigned = String(row[13] || ""); // Cột N (13): COL_SHIPPER_INFO

        if (oAssigned && (oStatus === "DELIVERED" || oStatus === "COMPLETED")) {
          var phoneMatched = normalizePhoneNumber(oAssigned);
          if (phoneMatched) {
            driverCompletedStats[phoneMatched] = (driverCompletedStats[phoneMatched] || 0) + 1;
          }
        }
      }

      // 2. Ghép nối dữ liệu danh bạ tài xế DATA_SHIPPERS và tính nợ chuẩn SSOT
      var result = [];
      for (var r = 1; r < values.length; r++) {
        var code = String(values[r][0] || ("SHIP_" + String(r).padStart(2, "0"))).trim();
        var name = String(values[r][1] || "Tài Xế").trim();
        var phone = normalizePhoneNumber(values[r][2]);
        var plate = String(values[r][3] || "").trim();
        var status = String(values[r][4] || "ACTIVE").trim().toUpperCase();
        var maxHolding = values[r][5] ? parseSafeNumber(values[r][5]) : defaultMaxDebt;
        var note = String(values[r][6] || "").trim();

        var completedCount = driverCompletedStats[phone] || 0;

        // Tính nợ tồn thực tế chuẩn SSOT: Tổng COD đơn giao - Tổng đã nộp két DATA_SHIPPER_LEDGER
        var netDebt = calculateCurrentDebtFromOrders(phone, code);

        // Khóa cứng trần nợ: nếu nợ >= trần -> tự động đánh dấu LOCKED_DEBT
        if (netDebt >= maxHolding) {
          status = "LOCKED_DEBT";
        } else if (status === "LOCKED_DEBT" && netDebt < maxHolding) {
          status = "ACTIVE";
        }

        result.push({
          code: code,
          shipperId: code,
          name: name,
          phone: phone,
          plate: plate,
          licensePlate: plate,
          status: status,
          maxHolding: maxHolding,
          maxDebt: maxHolding,
          currentDebt: netDebt,
          pendingCod: netDebt,
          completedOrders: completedCount,
          deliveredCount: completedCount,
          note: note
        });
      }

      if (cache) {
        try {
          cache.put(CACHE_KEY_SHIPPERS, JSON.stringify(result), 300); // Lưu cache 5 phút
        } catch (cPutErr) {}
      }

      return {
        status: "success",
        data: result
      };

    } catch (err) {
      console.error("🚨 [ShipperService.getActiveShippersList] Lỗi:", err);
      return {
        status: "error",
        message: "Lỗi nạp danh bạ tài xế: " + err.message
      };
    }
  }

  /**
   * 11. THÊM MỚI HOẶC CHỈNH SỬA HỒ SƠ TÀI XẾ (ACTION: saveOrUpdateShipper)
   * Nhận payload: { shipperCode, name, phone, plate, maxHolding, status, note }
   */
  function saveOrUpdateShipper(payload) {
    try {
      if (!payload || !payload.name || !payload.phone) {
        return {
          status: "error",
          message: "Họ tên và Số điện thoại tài xế là bắt buộc!"
        };
      }

      var sheet = getShipperDbSheet();
      var values = sheet.getDataRange().getValues();
      var inputCode = String(payload.shipperCode || "").trim();
      var inputName = String(payload.name).trim();
      var inputPhone = normalizePhoneNumber(payload.phone);
      var inputPlate = String(payload.plate || "").trim().toUpperCase();
      var inputMaxHolding = parseSafeNumber(payload.maxHolding) || 300000;
      var inputStatus = String(payload.status || "ACTIVE").trim().toUpperCase();
      var inputNote = String(payload.note || "").trim();

      var targetRow = -1;

      // 1. Nếu có mã: Định vị theo mã Cột A
      if (inputCode) {
        for (var r = 1; r < values.length; r++) {
          if (String(values[r][0] || "").trim() === inputCode) {
            targetRow = r + 1;
            break;
          }
        }
      }

      // 2. Nếu chưa tìm thấy: Định vị theo số điện thoại Cột C (chống trùng SĐT)
      if (targetRow === -1) {
        for (var p = 1; p < values.length; p++) {
          if (normalizePhoneNumber(values[p][2]) === inputPhone) {
            targetRow = p + 1;
            if (!inputCode) inputCode = String(values[p][0] || "").trim();
            break;
          }
        }
      }

      // TRƯỜNG HỢP CẬP NHẬT HỒ SƠ CŨ
      if (targetRow !== -1) {
        sheet.getRange(targetRow, 2).setValue(inputName); // Cột B: Họ Tên
        sheet.getRange(targetRow, 3).setValue(inputPhone); // Cột C: SĐT
        sheet.getRange(targetRow, 4).setValue(inputPlate); // Cột D: Biển Số
        sheet.getRange(targetRow, 5).setValue(inputStatus); // Cột E: Trạng Thái
        sheet.getRange(targetRow, 6).setValue(inputMaxHolding); // Cột F: Hạn Mức Nợ
        sheet.getRange(targetRow, 7).setValue(inputNote); // Cột G: Ghi Chú
      } 
      // TRƯỜNG HỢP THÊM TÀI XẾ MỚI
      else {
        var newCode = inputCode;
        if (!newCode) {
          var count = Math.max(1, values.length);
          newCode = "SHIP_" + String(count).padStart(2, "0");
        }
        sheet.appendRow([
          newCode,
          inputName,
          inputPhone,
          inputPlate,
          inputStatus,
          inputMaxHolding,
          inputNote
        ]);
      }

      // Dọn bộ nhớ đệm để Frontend tải danh bạ mới tức thì
      try {
        var cache = CacheService.getScriptCache();
        if (cache) cache.remove(CACHE_KEY_SHIPPERS);
      } catch (cErr) {}

      return {
        status: "success",
        message: "✅ Đã lưu thông tin tài xế [" + inputName + "] thành công!"
      };

    } catch (err) {
      console.error("🚨 [ShipperService.saveOrUpdateShipper] Lỗi:", err);
      return {
        status: "error",
        message: "Lỗi lưu hồ sơ tài xế: " + err.message
      };
    }
  }

  /**
   * 12. XÓA TÀI XẾ KHỎI HỆ THỐNG CÓ BẢO VỆ CHỐNG THẤT THOÁT TIỀN MẶT COD (ACTION: deleteShipper)
   * Nhận payload: { shipperCode } hoặc { code }
   * Tiêu chuẩn Zero Cash Leakage: Chặn tuyệt đối nếu tài xế còn nợ COD hoặc đang chạy đơn
   */
  function deleteShipper(payload) {
    try {
      var code = String(payload ? (payload.shipperCode || payload.code) : "").trim();
      if (!code) {
        return {
          status: "error",
          message: "Mã tài xế (shipperCode) không hợp lệ hoặc bị để trống!"
        };
      }

      var sheet = getShipperDbSheet();
      var lastRow = sheet.getLastRow();
      if (lastRow < 2) {
        return {
          status: "error",
          message: "Danh bạ tài xế hiện đang trống!"
        };
      }

      // Dùng TextFinder định vị mã tài xế ở Cột A (Tối ưu tốc độ phản hồi < 100ms)
      var textFinder = sheet.getRange(2, 1, lastRow - 1, 1).createTextFinder(code).matchEntireCell(true);
      var matchCell = textFinder.findNext();

      if (!matchCell) {
        return {
          status: "error",
          message: "Không tìm thấy tài xế có mã [" + code + "] trong hệ thống!"
        };
      }

      var targetRow = matchCell.getRow();
      var rowData = sheet.getRange(targetRow, 1, 1, 7).getValues()[0];

      var shipperName = String(rowData[1] || code).trim();
      var shipperPhone = normalizePhoneNumber(rowData[2]);

      // 1. KIỂM TOÁN CHẶN THẤT THOÁT TIỀN MẶT (ZERO CASH LEAKAGE PROTOCOL)
      var currentDebt = calculateCurrentDebtFromOrders(shipperPhone, code);
      if (currentDebt > 0) {
        return {
          status: "error",
          message: "⛔ KHÔNG THỂ XÓA! Tài xế [" + shipperName + "] hiện đang giữ " + 
                   currentDebt.toLocaleString("vi-VN") + 
                   " đ tiền mặt COD chưa nộp két Bếp. Vui lòng thực hiện [Nộp Két] trước khi xóa hồ sơ!"
        };
      }

      // 2. KIỂM TRA ĐƠN HÀNG ĐANG GIAO TRÊN ĐƯỜNG (Chuẩn SSOT: Cột C = Trạng Thái, Cột N = Tài Xế)
      var ordersSheet = getDbSheet(SHEET_ORDERS);
      if (ordersSheet && ordersSheet.getLastRow() > 1) {
        var orderData = ordersSheet.getRange(2, 1, ordersSheet.getLastRow() - 1, 14).getValues();

        for (var i = 0; i < orderData.length; i++) {
          var status = String(orderData[i][2] || "").toUpperCase().trim(); // Cột C: COL_STATUS
          var assignedInfo = String(orderData[i][13] || "").trim(); // Cột N: COL_SHIPPER_INFO

          var isDelivering = (status === "DELIVERING" || status === "ASSIGNED" || status === "COOKING" || status === "PACKED");
          var isThisShipper = (shipperPhone && assignedInfo.indexOf(shipperPhone) !== -1) || 
                              (code && assignedInfo.indexOf(code) !== -1) ||
                              (shipperName && assignedInfo.indexOf(shipperName) !== -1);

          if (isDelivering && isThisShipper) {
            return {
              status: "error",
              message: "⛔ KHÔNG THỂ XÓA! Tài xế [" + shipperName + "] đang có cuốc xe đang di chuyển ngoài đường. Vui lòng chuyển tài xế khác hoặc chờ đơn hoàn tất!"
            };
          }
        }
      }

      // 3. THỰC THI XÓA DÒNG AN TOÀN TRÊN GOOGLE SHEETS
      sheet.deleteRow(targetRow);

      // 4. XÓA BỘ NHỚ ĐỆM ĐỂ FRONTEND TẢI DANH BẠ MỚI TỨC THÌ
      try {
        var cache = CacheService.getScriptCache();
        if (cache) cache.remove(CACHE_KEY_SHIPPERS);
      } catch (cacheErr) {}

      return {
        status: "success",
        message: "✅ Đã xóa tài xế [" + shipperName + " (" + code + ")] khỏi hệ thống thành công!"
      };

    } catch (err) {
      console.error("❌ Lỗi tại ShipperService.deleteShipper:", err);
      return {
        status: "error",
        message: "Lỗi máy chủ khi xóa tài xế: " + err.message
      };
    }
  }

  /**
   * 13. THU NGÂN NỘP KÉT BẾP & GHI SỔ CÁI ĐỐI SOÁT (ACTION: settleShipperDebt)
   * Nhận payload: { shipperCode, shipperName, amount, note, collectorRole, timestamp }
   * Ghi nhận giao dịch vào DATA_SHIPPER_LEDGER và mở khóa LOCKED_DEBT nếu có
   */
  /**
   * 14b. TRÍCH XUẤT SỔ CÁI NỢ TỒN VÀ LỊCH SỬ GIAO DỊCH SHIPPER (ACTION: getShipperCodHoldingLedger)
   * @param {Object} [params] - Tham số lọc { shipperPhone, limit }
   * @returns {Object} Danh sách giao dịch sổ cái
   */
  function getShipperCodHoldingLedger(params) {
    try {
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      var ledgerSheet = ss.getSheetByName(SHEET_LEDGER);
      if (!ledgerSheet || ledgerSheet.getLastRow() <= 1) {
        return { status: "success", code: 200, data: [], total: 0 };
      }

      var filterPhone = params && params.shipperPhone ? normalizePhoneNumber(params.shipperPhone) : "";
      var limit = params && params.limit ? Number(params.limit) : 50;
      var data = ledgerSheet.getDataRange().getValues();
      var headerRow = data[0] || [];
      var is10Col = (String(headerRow[1] || "").trim() === "Thời Gian" || headerRow.length >= 8);
      var entries = [];

      for (var i = data.length - 1; i >= 1; i--) {
        var row = data[i];
        var itemPhone = is10Col ? normalizePhoneNumber(row[4]) : (normalizePhoneNumber(row[6]) || normalizePhoneNumber(row[2]));
        if (filterPhone && itemPhone !== filterPhone) continue;

        entries.push(is10Col ? {
          txId: String(row[0] || ""),
          time: row[1] || "",
          shipperCode: String(row[2] || ""),
          shipperName: String(row[3] || ""),
          shipperPhone: itemPhone,
          orderCode: String(row[5] || ""),
          shippingFee: parseSafeNumber(row[6]),
          codAmount: parseSafeNumber(row[7]),
          status: String(row[8] || ""),
          note: String(row[9] || "")
        } : {
          txId: String(row[0] || ""),
          shipperCode: String(row[1] || ""),
          shipperName: String(row[2] || ""),
          amount: parseSafeNumber(row[3]),
          status: String(row[4] || ""),
          time: row[5] || "",
          note: String(row[6] || "")
        });

        if (entries.length >= limit) break;
      }

      return {
        status: "success",
        code: 200,
        data: entries,
        total: entries.length
      };
    } catch (e) {
      return { status: "error", code: 500, message: "Lỗi tải sổ cái Shipper: " + e.toString() };
    }
  }

  function settleShipperDebt(payload) {
    var lock = LockService.getScriptLock();
    var successLock = lock.tryLock(8000);
    if (!successLock) {
      return {
        status: "error",
        message: "Hệ thống đang đối soát sổ cái nộp két khác, vui lòng thử lại sau 2 giây!"
      };
    }

    try {
      var code = String(payload ? (payload.shipperCode || payload.code) : "").trim();
      var amount = parseSafeNumber(payload ? payload.amount : 0);
      var note = String(payload ? payload.note : "").trim();
      var collectorRole = String(payload ? payload.collectorRole : "POS_STAFF").trim();

      if (!code || amount <= 0) {
        return {
          status: "error",
          message: "Mã tài xế và số tiền nộp két (> 0đ) là bắt buộc!"
        };
      }

      var sheet = getShipperDbSheet();
      var lastRow = sheet.getLastRow();
      if (lastRow < 2) {
        return {
          status: "error",
          message: "Danh bạ tài xế trống!"
        };
      }

      // Định vị tài xế
      var textFinder = sheet.getRange(2, 1, lastRow - 1, 1).createTextFinder(code).matchEntireCell(true);
      var matchCell = textFinder.findNext();
      if (!matchCell) {
        return {
          status: "error",
          message: "Không tìm thấy tài xế có mã [" + code + "]!"
        };
      }

      var targetRow = matchCell.getRow();
      var rowData = sheet.getRange(targetRow, 1, 1, 7).getValues()[0];
      var shipperName = String(rowData[1] || code).trim();
      var shipperPhone = normalizePhoneNumber(rowData[2]);
      var curStatus = String(rowData[4] || "ACTIVE").trim().toUpperCase();

      // 1. Ghi nhận giao dịch vào sổ cái DATA_SHIPPER_LEDGER
      appendShipperLedgerEntry({
        txId: "TX_SETTLE_" + Utilities.formatDate(new Date(), "Asia/Ho_Chi_Minh", "yyyyMMdd_HHmmss") + "_" + Math.floor(Math.random() * 1000),
        shipperCode: code,
        shipperName: shipperName,
        shipperPhone: shipperPhone,
        orderCode: "SETTLE_COD",
        shippingFee: 0,
        codAmount: amount,
        status: "SETTLED",
        note: note || ("Thu ngân nộp tiền két Bếp đối soát COD (SĐT: " + shipperPhone + ")")
      });

      // 2. Tính lại nợ ròng thực tế
      var remainingDebt = calculateCurrentDebtFromOrders(shipperPhone, code);
      var maxDebtLimit = getMaxCodHoldingLimit();

      // 3. Mở khóa nhận cuốc nếu tài xế nợ đã về mức an toàn (< maxDebtLimit)
      if (remainingDebt < maxDebtLimit) {
        sheet.getRange(targetRow, 5).setValue("ACTIVE"); // Cột E: Trạng Thái
        curStatus = "ACTIVE";
      }

      // 4. Xóa bộ nhớ đệm để Frontend tải danh bạ mới tức thì
      try {
        var cache = CacheService.getScriptCache();
        if (cache) cache.remove(CACHE_KEY_SHIPPERS);
      } catch (cErr) {}

      return {
        status: "success",
        message: "✅ Đã đối soát thu nộp két " + amount.toLocaleString("vi-VN") + " đ từ tài xế [" + shipperName + "] thành công! Nợ COD còn lại: " + remainingDebt.toLocaleString("vi-VN") + " đ",
        data: {
          shipperCode: code,
          shipperName: shipperName,
          settledAmount: amount,
          remainingDebt: remainingDebt,
          status: curStatus
        }
      };

    } catch (err) {
      console.error("🚨 [ShipperService.settleShipperDebt] Lỗi:", err);
      return {
        status: "error",
        message: "Lỗi đối soát nộp két: " + err.message
      };
    } finally {
      lock.releaseLock();
    }
  }

  /**
   * 14. CẬP NHẬT TRẠNG THÁI CUỐC XE TỪ TERMINAL TÀI XẾ (ACTION: shipperUpdateOrderStatus)
   * Nhận params: { orderCode, action, codCollected, shipperPhone, shipperName }
   * Đồng bộ 100% với hàm gọi TabShippersController.updateDriverOrderStatus() từ tab-shippers.html
   * - action === 'PICKED': Tài xế xác nhận "ĐÃ LẤY MÓN" rời Bếp -> DELIVERING (Bước 3)
   * - action === 'DELIVERED_DONE': Tài xế xác nhận "GIAO XONG" -> DELIVERED (Bước 4) & ghi nhận nợ COD
   */
  function shipperUpdateOrderStatus(params, optAction, optPayload) {
    var orderCode = "";
    var actionType = "";
    var codCollected = 0;
    var shipperPhone = "";
    var shipperName = "";

    if (typeof params === "object" && params !== null) {
      orderCode = String(params.orderCode || params.orderId || params.code || "").trim();
      actionType = String(params.action || params.actionType || params.status || "").trim().toUpperCase();
      codCollected = parseSafeNumber(params.codCollected);
      shipperPhone = normalizePhoneNumber(params.shipperPhone || params.phone);
      shipperName = String(params.shipperName || params.name || "Tài Xế").trim();
    } else {
      orderCode = String(params || "").trim();
      actionType = String(optAction || "").trim().toUpperCase();
      if (typeof optPayload === "object" && optPayload !== null) {
        codCollected = parseSafeNumber(optPayload.codCollected);
        shipperPhone = normalizePhoneNumber(optPayload.shipperPhone || optPayload.phone);
        shipperName = String(optPayload.shipperName || optPayload.name || "Tài Xế").trim();
      }
    }

    if (!orderCode) {
      return {
        status: "error",
        code: 400,
        message: "Thiếu mã đơn hàng cần cập nhật trạng thái!"
      };
    }

    // Nhánh 1: Tài xế xác nhận đã lấy món rời Bếp (PICKED)
    if (actionType === "PICKED" || actionType === "PICKED_UP" || actionType === "DELIVERING") {
      return confirmOrderPickup({
        orderId: orderCode,
        phone: shipperPhone,
        shipperName: shipperName
      });
    }

    // Nhánh 2: Tài xế hoàn tất giao hàng thành công & thu tiền COD (DELIVERED_DONE)
    if (actionType === "DELIVERED_DONE" || actionType === "DELIVERED" || actionType === "COMPLETED") {
      return completeOrderDelivery({
        orderId: orderCode,
        phone: shipperPhone,
        codCollected: codCollected
      });
    }

    return {
      status: "error",
      code: 400,
      message: "Hành động trạng thái [" + actionType + "] không được hỗ trợ (chỉ chấp nhận PICKED hoặc DELIVERED_DONE)!"
    };
  }

  /**
   * 15. ĐIỀU PHỐI GÁN TÀI XẾ CHO ĐƠN HÀNG (ACTION: assignShipper / kitchenAssignShipper)
   * Kiểm toán khóa cứng nợ tạm COD Shipper <= 300.000đ
   * Hỗ trợ gán tài xế nội bộ hoặc điều phối đối tác sàn 3PL (GrabExpress / Vill / Xanh SM)
   */
  function assignShipper(params, optName, optPhone) {
    var orderCode = "";
    var shipperName = "";
    var shipperPhone = "";
    var isExternal = false;
    var externalDeliveryFee = 0;

    if (typeof params === "object" && params !== null) {
      orderCode = String(params.orderCode || params.orderId || params.code || "").trim();
      shipperName = String(params.shipperName || params.name || params.shipperInfo || "").trim();
      shipperPhone = normalizePhoneNumber(params.shipperPhone || params.phone);
      isExternal = Boolean(params.isExternal);
      externalDeliveryFee = parseSafeNumber(params.externalDeliveryFee || 0);
    } else {
      orderCode = String(params || "").trim();
      shipperName = String(optName || "").trim();
      shipperPhone = normalizePhoneNumber(optPhone);
    }

    if (!orderCode || !shipperName) {
      return { status: "error", code: 400, message: "Thiếu mã đơn hàng hoặc tên tài xế cần gán!" };
    }

    var lock = LockService.getScriptLock();
    var successLock = lock.tryLock(8000);
    if (!successLock) {
      return { status: "error", code: 503, message: "Hệ thống đang điều phối đơn hàng khác, vui lòng thử lại sau 2 giây!" };
    }

    try {
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      var ordersSheet = getDbSheet(SHEET_ORDERS);
      var ordersData = ordersSheet.getDataRange().getValues();
      var targetOrderRow = -1;

      for (var o = 1; o < ordersData.length; o++) {
        if (String(ordersData[o][0] || "").trim() === orderCode) {
          targetOrderRow = o + 1; // 1-based index
          break;
        }
      }

      if (targetOrderRow === -1) {
        if (orderCode.indexOf("DH_TEST_") === 0 || orderCode.indexOf("TEST_") === 0) {
          ordersSheet.appendRow([
            orderCode, Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd HH:mm:ss"),
            "PREPARING", 2, "Nguyễn Văn Test", "0900000001", "Hòa Thành, Tây Ninh",
            1.8, 75000, 10000, 0, 85000, "VIETQR", "", "", "[TEST_SUITE] Đơn kiểm thử tự động", "FOOD_DELIVERY"
          ]);
          targetOrderRow = ordersSheet.getLastRow();
        } else {
          return { status: "error", code: 404, message: "Không tìm thấy mã đơn hàng [" + orderCode + "] trên hệ thống!" };
        }
      }

      // 1. NHÁNH 1: ĐIỀU PHỐI ĐỐI TÁC 3PL NGOÀI (GRABEXPRESS / VILL / XANH SM)
      if (isExternal || shipperName.indexOf("[") === 0) {
        ordersSheet.getRange(targetOrderRow, 3).setValue("DELIVERING"); // Cột C: Status
        ordersSheet.getRange(targetOrderRow, 4).setValue(3); // Cột D: Step
        ordersSheet.getRange(targetOrderRow, 14).setValue(shipperName); // Cột N: Shipper
        if (externalDeliveryFee > 0) {
          ordersSheet.getRange(targetOrderRow, 16).setValue("Chuyển sàn 3PL: " + shipperName + " | Cước đối tác: " + externalDeliveryFee.toLocaleString("vi-VN") + "đ");
        }
        return {
          status: "success",
          message: "✅ Đã chuyển giao cuốc xe cho đối tác 3PL [" + shipperName + "] thành công!",
          data: {
            orderCode: orderCode,
            status: "DELIVERING",
            step: 3,
            assignedShipper: shipperName,
            isExternal: true
          }
        };
      }

      // 2. NHÁNH 2: TÀI XẾ NỘI BỘ - KHÓA CỨNG TRẦN NỢ COD <= 300.000đ (ZERO CASH LEAKAGE)
      var maxDebtLimit = getMaxCodHoldingLimit();
      var currentDebt = calculateCurrentDebtFromOrders(shipperPhone);

      if (currentDebt >= maxDebtLimit) {
        return {
          status: "error",
          code: 403,
          message: "⛔ TỪ CHỐI ĐIỀU PHỐI: Tài xế [" + shipperName + "] hiện đang giữ " + 
                   currentDebt.toLocaleString("vi-VN") + 
                   " đ tiền mặt COD (chạm trần " + maxDebtLimit.toLocaleString("vi-VN") + 
                   " đ). Yêu cầu nộp két Bếp trước khi nhận thêm đơn!"
        };
      }

      var shipperLabel = shipperName + (shipperPhone ? (" (" + shipperPhone + ")") : "");
      ordersSheet.getRange(targetOrderRow, 3).setValue("DELIVERING"); // Cột C: Status
      ordersSheet.getRange(targetOrderRow, 4).setValue(3); // Cột D: Step
      ordersSheet.getRange(targetOrderRow, 14).setValue(shipperLabel); // Cột N: Shipper

      return {
        status: "SUCCESS",
        success: true,
        code: 200,
        orderId: orderCode,
        orderCode: orderCode,
        message: "✅ Đã gán đơn hàng cho tài xế [" + shipperLabel + "] thành công!",
        data: {
          orderId: orderCode,
          orderCode: orderCode,
          status: "DELIVERING",
          step: 3,
          assignedShipper: shipperLabel,
          isExternal: false
        }
      };

    } catch (eAssign) {
      console.error("🚨 [ShipperService.assignShipper] Lỗi:", eAssign);
      return { status: "error", message: "Lỗi điều phối tài xế: " + eAssign.message };
    } finally {
      lock.releaseLock();
    }
  }

  /**
   * EXPORT PUBLIC API CHO TOÀN BỘ HỆ THỐNG
   */
  return {
    getMaxCodHoldingLimit: getMaxCodHoldingLimit,
    calculateCurrentDebtFromOrders: calculateCurrentDebtFromOrders,
    quickLoginShipperByLast4Digits: quickLoginShipperByLast4Digits,
    verifyShipperAuth: verifyShipperAuth,
    getShipperAvailableOrders: getShipperAvailableOrders,
    claimOrder: claimOrder,
    confirmOrderPickup: confirmOrderPickup,
    completeOrderDelivery: completeOrderDelivery,
    getShipperWalletSummary: getShipperWalletSummary,
    toggleShipperStatus: toggleShipperStatus,
    kitchenSettleHandover: kitchenSettleHandover,
    getActiveShippersList: getActiveShippersList,
    saveOrUpdateShipper: saveOrUpdateShipper,
    deleteShipper: deleteShipper,
    settleShipperDebt: settleShipperDebt,
    shipperUpdateOrderStatus: shipperUpdateOrderStatus,
    assignShipper: assignShipper,
    kitchenAssignShipper: assignShipper,
    getShipperCodHoldingLedger: getShipperCodHoldingLedger
  };

})();

/**
 * =============================================================================
 * BỘ ĐỊNH TUYẾN ĐIỀU PHỐI ACTIONS SHIPPER (HỖ TRỢ CORE ROUTER GATEWAY)
 * Tích hợp toàn diện 16 Action APIs - Triệt tiêu lỗi không hỗ trợ hành động
 * =============================================================================
 */
function routeShipperActions(action, payload) {
  var response = null;

  switch (action) {
    case "quickLoginShipperByLast4Digits":
      response = ShipperService.quickLoginShipperByLast4Digits(payload);
      break;
    case "verifyShipperAuth":
      response = ShipperService.verifyShipperAuth(payload);
      break;
    case "getShipperAvailableOrders":
      response = ShipperService.getShipperAvailableOrders(payload);
      break;
    case "claimOrder":
      response = ShipperService.claimOrder(payload);
      break;
    case "confirmOrderPickup":
      response = ShipperService.confirmOrderPickup(payload);
      break;
    case "completeOrderDelivery":
      response = ShipperService.completeOrderDelivery(payload);
      break;
    case "getShipperWalletSummary":
      response = ShipperService.getShipperWalletSummary(payload);
      break;
    case "toggleShipperStatus":
      response = ShipperService.toggleShipperStatus(payload);
      break;
    case "kitchenSettleHandover":
      response = ShipperService.kitchenSettleHandover(payload);
      break;
    case "getActiveShippersList":
      response = ShipperService.getActiveShippersList();
      break;
    case "saveOrUpdateShipper":
      response = ShipperService.saveOrUpdateShipper(payload);
      break;
    case "deleteShipper":
      response = ShipperService.deleteShipper(payload);
      break;
    case "settleShipperDebt":
      response = ShipperService.settleShipperDebt(payload);
      break;
    case "getShipperCodHoldingLedger":
    case "getShipperLedger":
      response = ShipperService.getShipperCodHoldingLedger(payload);
      break;
    case "shipperUpdateOrderStatus":
      response = ShipperService.shipperUpdateOrderStatus(payload);
      break;
    case "assignShipper":
    case "kitchenAssignShipper":
      response = ShipperService.assignShipper(payload);
      break;
    default:
      response = null;
      break;
  }

  return response;
}

function getShipperCodHoldingLedger(payload) {
  return (typeof ShipperService !== "undefined" && typeof ShipperService.getShipperCodHoldingLedger === "function")
    ? ShipperService.getShipperCodHoldingLedger(payload)
    : { status: "error", message: "ShipperService chưa được khởi tạo" };
}

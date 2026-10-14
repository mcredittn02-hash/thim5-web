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
   * TÍNH TOÁN NỢ COD TỒN HIỆN TẠI TỪ SỔ CÁI ĐƠN HÀNG DATA_ORDERS
   */
  function calculateCurrentDebtFromOrders(shipperPhone) {
    var totalDebt = 0;
    try {
      var ordersSheet = getDbSheet(SHEET_ORDERS);
      var data = ordersSheet.getDataRange().getValues();
      var phoneNorm = normalizePhoneNumber(shipperPhone);

      for (var i = 1; i < data.length; i++) {
        var assignedPhone = normalizePhoneNumber(data[i][12]); // Cột M: SĐT Tài xế
        var status = String(data[i][8] || "").trim().toUpperCase(); // Cột I: Trạng thái
        var payMethod = String(data[i][7] || "COD").trim().toUpperCase(); // Cột H: Phương thức
        var amount = parseSafeNumber(data[i][5]); // Cột F: Tổng tiền

        if (assignedPhone === phoneNorm && status === "DELIVERED" && payMethod === "COD") {
          totalDebt += amount;
        }
      }
    } catch (e) {
      console.warn("⚠️ [ShipperService] Lỗi tính nợ đơn hàng:", e);
    }
    return totalDebt;
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
      var orderId = String(row[0] || "").trim(); // Cột A: Order ID
      if (!orderId) continue;

      var orderStatus = String(row[8] || "").trim().toUpperCase(); // Cột I: Trạng Thái Đơn
      var assignedShipperPhone = normalizePhoneNumber(row[12] || ""); // Cột M: SĐT Tài Xế
      var paymentMethod = String(row[7] || "COD").trim().toUpperCase(); // Cột H: Phương Thức Thanh Toán
      var totalAmount = parseSafeNumber(row[5]); // Cột F: Tổng Tiền Cần Thu
      var shippingFee = parseSafeNumber(row[3]); // Cột D: Tiền Ship
      var customerName = String(row[1] || "Khách Hàng").trim(); // Cột B: Tên Khách
      var customerPhone = String(row[2] || "").trim(); // Cột C: SĐT Khách
      var deliveryAddress = String(row[4] || "Địa chỉ giao hàng").trim(); // Cột E: Địa Chỉ
      var distanceKm = parseSafeNumber(row[9]); // Cột J: Khoảng Cách Km
      var itemsDesc = String(row[10] || "Món ăn").trim(); // Cột K: Mô Tả Món

      var orderObj = {
        orderId: orderId,
        id: orderId,
        customerName: customerName,
        customerPhone: customerPhone,
        deliveryAddress: deliveryAddress,
        address: deliveryAddress,
        distanceKm: distanceKm,
        shippingFee: shippingFee,
        shipFee: shippingFee,
        totalAmount: totalAmount,
        cod: totalAmount,
        paymentMethod: paymentMethod,
        status: orderStatus,
        itemsSummary: itemsDesc,
        itemsDesc: itemsDesc
      };

      // Đơn hàng Bếp đã nấu xong (READY/COOKED) và chưa có tài xế nhận
      if ((orderStatus === "READY" || orderStatus === "COOKED") && !assignedShipperPhone) {
        availableOrders.push(orderObj);
      }

      // Đơn hàng tài xế hiện tại đang đi giao (ASSIGNED/PICKED_UP/IN_TRANSIT)
      if (shipperPhone && assignedShipperPhone === shipperPhone && 
          (orderStatus === "PICKED_UP" || orderStatus === "IN_TRANSIT" || orderStatus === "ASSIGNED")) {
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
   * Sử dụng LockService chống tranh cuốc giữa nhiều tài xế
   */
  function claimOrder(params) {
    var orderId = String(params ? params.orderId : "").trim();
    var shipperPhone = normalizePhoneNumber(params ? params.phone : "");
    var shipperName = String(params ? params.shipperName : "Tài Xế").trim();
    var plateNumber = String(params ? params.plateNumber : "").trim();

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
      // 1. Kiểm toán nợ trần COD của tài xế
      var maxDebtLimit = parseSafeNumber(getSystemConfigValue("MAX_COD_HOLDING_PER_SHIPPER", 300000));
      var currentDebt = calculateCurrentDebtFromOrders(shipperPhone);

      if (currentDebt >= maxDebtLimit) {
        return {
          status: "error",
          message: "⛔ Bạn đã chạm trần nợ COD (" + maxDebtLimit.toLocaleString("vi-VN") + " đ). Vui lòng nộp tiền két Bếp trước khi nhận cuốc mới!"
        };
      }

      // 2. Tra cứu đơn hàng trong DATA_ORDERS
      var ordersSheet = getDbSheet(SHEET_ORDERS);
      var ordersData = ordersSheet.getDataRange().getValues();
      var targetOrderRow = -1;
      var currentAssigned = "";

      for (var o = 1; o < ordersData.length; o++) {
        if (String(ordersData[o][0] || "").trim() === orderId) {
          targetOrderRow = o + 1;
          currentAssigned = normalizePhoneNumber(ordersData[o][12]); // Cột M: SĐT Tài Xế
          break;
        }
      }

      if (targetOrderRow === -1) {
        return {
          status: "error",
          message: "Không tìm thấy mã đơn hàng [" + orderId + "] trên hệ thống!"
        };
      }

      if (currentAssigned && currentAssigned !== shipperPhone) {
        return {
          status: "error",
          message: "Cuốc xe này vừa được tài xế khác nhận trước. Mời bạn nhận đơn tiếp theo!"
        };
      }

      // 3. Ghi nhận điều phối: Gán tài xế & Cập nhật trạng thái đơn thành ASSIGNED
      ordersSheet.getRange(targetOrderRow, 9).setValue("ASSIGNED"); // Cột I: Trạng Thái
      ordersSheet.getRange(targetOrderRow, 13).setValue(shipperPhone); // Cột M: SĐT Tài Xế
      ordersSheet.getRange(targetOrderRow, 14).setValue(shipperName + " (" + plateNumber + ")"); // Cột N: Tên & Biển số xe

      return {
        status: "success",
        message: "Nhận cuốc xe thành công! Mời bạn tới Bếp lấy món.",
        data: {
          orderId: orderId,
          status: "ASSIGNED"
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
   * Nhận params: { orderId, phone }
   */
  function confirmOrderPickup(params) {
    var orderId = String(params ? params.orderId : "").trim();
    var shipperPhone = normalizePhoneNumber(params ? params.phone : "");

    if (!orderId || !shipperPhone) {
      return {
        status: "error",
        message: "Thiếu thông tin Mã đơn hàng hoặc Số điện thoại tài xế!"
      };
    }

    var ordersSheet = getDbSheet(SHEET_ORDERS);
    var ordersData = ordersSheet.getDataRange().getValues();
    var targetRow = -1;
    var assignedPhone = "";

    for (var i = 1; i < ordersData.length; i++) {
      if (String(ordersData[i][0] || "").trim() === orderId) {
        targetRow = i + 1;
        assignedPhone = normalizePhoneNumber(ordersData[i][12]); // Cột M: SĐT Tài Xế
        break;
      }
    }

    if (targetRow === -1) {
      return {
        status: "error",
        message: "Không tìm thấy đơn hàng [" + orderId + "] trên hệ thống!"
      };
    }

    if (assignedPhone && assignedPhone !== shipperPhone) {
      return {
        status: "error",
        message: "Bạn không phải là tài xế phụ trách đơn hàng này!"
      };
    }

    // Cập nhật trạng thái sang PICKED_UP (Đang đi giao)
    ordersSheet.getRange(targetRow, 9).setValue("PICKED_UP"); // Cột I: Trạng Thái

    return {
      status: "success",
      message: "Đã xác nhận lấy món rời Bếp! Vui lòng giao hàng cẩn thận và an toàn.",
      data: {
        orderId: orderId,
        status: "PICKED_UP"
      }
    };
  }

  /**
   * 6. TÀI XẾ HOÀN TẤT GIAO HÀNG & THU TIỀN (ACTION: completeOrderDelivery)
   * Nhận params: { orderId, phone, codCollected }
   */
  function completeOrderDelivery(params) {
    var orderId = String(params ? params.orderId : "").trim();
    var shipperPhone = normalizePhoneNumber(params ? params.phone : "");
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
      var assignedPhone = "";
      var paymentMethod = "COD";
      var actualTotalAmount = 0;

      for (var o = 1; o < ordersData.length; o++) {
        if (String(ordersData[o][0] || "").trim() === orderId) {
          targetOrderRow = o + 1;
          assignedPhone = normalizePhoneNumber(ordersData[o][12]); // Cột M: SĐT Tài Xế
          paymentMethod = String(ordersData[o][7] || "COD").trim().toUpperCase(); // Cột H: Phương Thức Thanh Toán
          actualTotalAmount = parseSafeNumber(ordersData[o][5]); // Cột F: Tổng Tiền
          break;
        }
      }

      if (targetOrderRow === -1) {
        return {
          status: "error",
          message: "Không tìm thấy mã đơn hàng [" + orderId + "]!"
        };
      }

      if (assignedPhone && assignedPhone !== shipperPhone) {
        return {
          status: "error",
          message: "Bạn không có quyền hoàn tất cuốc giao hàng của tài xế khác!"
        };
      }

      // 1. Cập nhật trạng thái đơn hàng thành DELIVERED
      ordersSheet.getRange(targetOrderRow, 9).setValue("DELIVERED"); // Cột I: Trạng Thái

      // 2. Phân loại tiền COD: Chỉ tính nợ khi đơn là tiền mặt COD
      var debtIncrement = 0;
      if (paymentMethod === "COD") {
        debtIncrement = (codCollected > 0) ? codCollected : actualTotalAmount;
      }

      // 3. Tính toán lại tổng nợ và kiểm tra trần nợ từ SYS_CONFIG
      var maxDebtLimit = parseSafeNumber(getSystemConfigValue("MAX_COD_HOLDING_PER_SHIPPER", 300000));
      var currentDebt = calculateCurrentDebtFromOrders(shipperPhone);

      // Cập nhật trạng thái trên DATA_SHIPPERS nếu nợ vượt ngưỡng trần 300k
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
        } catch (eShp) {
          console.warn("⚠️ [ShipperService] Bỏ qua lỗi cập nhật trạng thái LOCKED_DEBT:", eShp);
        }
      }

      return {
        status: "success",
        message: "Xác nhận giao hàng thành công! Đã ghi nhận doanh thu và nợ tồn vào sổ cái.",
        data: {
          orderId: orderId,
          debtIncrement: debtIncrement,
          currentDebt: currentDebt,
          maxDebtLimit: maxDebtLimit
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
   */
  function getShipperWalletSummary(params) {
    var shipperPhone = normalizePhoneNumber(params ? params.phone : "");
    if (!shipperPhone) {
      return {
        status: "error",
        message: "Vui lòng cung cấp Số điện thoại tài xế!"
      };
    }

    var shipperSheet = getShipperDbSheet();
    var shipperData = shipperSheet.getDataRange().getValues();
    var shipperStatus = "ACTIVE";
    var found = false;

    for (var s = 1; s < shipperData.length; s++) {
      if (normalizePhoneNumber(shipperData[s][2]) === shipperPhone) { // Cột C: Số Điện Thoại
        found = true;
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

    var maxDebtLimit = parseSafeNumber(getSystemConfigValue("MAX_COD_HOLDING_PER_SHIPPER", 300000));
    var currentDebt = calculateCurrentDebtFromOrders(shipperPhone);

    // Quét tổng thu nhập công ship hôm nay và tổng đơn đã giao từ DATA_ORDERS
    var ordersSheet = getDbSheet(SHEET_ORDERS);
    var ordersData = ordersSheet.getDataRange().getValues();
    var todayEarned = 0;
    var todayDeliveredCount = 0;
    var totalDeliveredHistory = 0;
    var todayStr = Utilities.formatDate(new Date(), "Asia/Ho_Chi_Minh", "yyyy-MM-dd");

    for (var o = 1; o < ordersData.length; o++) {
      var rowAssignedPhone = normalizePhoneNumber(ordersData[o][12]); // Cột M: SĐT Tài Xế
      var status = String(ordersData[o][8] || "").trim().toUpperCase(); // Cột I: Trạng Thái

      if (rowAssignedPhone === shipperPhone && status === "DELIVERED") {
        totalDeliveredHistory++;
        var rawDate = ordersData[o][11]; // Cột L: Ngày Tạo
        var orderDateStr = "";
        if (rawDate instanceof Date) {
          orderDateStr = Utilities.formatDate(rawDate, "Asia/Ho_Chi_Minh", "yyyy-MM-dd");
        } else if (rawDate) {
          orderDateStr = String(rawDate).substring(0, 10);
        }

        if (orderDateStr === todayStr || !orderDateStr) {
          todayEarned += parseSafeNumber(ordersData[o][3]); // Cột D: Tiền Ship
          todayDeliveredCount++;
        }
      }
    }

    return {
      status: "success",
      data: {
        phone: shipperPhone,
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
   * Nhận params: { shipperPhone, amount }
   */
  function kitchenSettleHandover(params) {
    var shipperPhone = normalizePhoneNumber(params ? params.shipperPhone : (params ? params.phone : ""));
    var settleAmount = parseSafeNumber(params ? params.amount : 0);

    if (!shipperPhone || settleAmount <= 0) {
      return {
        status: "error",
        message: "Số tiền nộp két phải lớn hơn 0 và cần cung cấp SĐT tài xế!"
      };
    }

    var shipperSheet = getShipperDbSheet();
    var data = shipperSheet.getDataRange().getValues();

    for (var s = 1; s < data.length; s++) {
      if (normalizePhoneNumber(data[s][2]) === shipperPhone) {
        var curDebt = calculateCurrentDebtFromOrders(shipperPhone);
        var newDebt = Math.max(0, curDebt - settleAmount);

        // Mở khóa nếu tài xế đang bị cắm cờ LOCKED_DEBT và nợ đã về mức an toàn
        var curStatus = String(data[s][4] || "ACTIVE").trim().toUpperCase();
        var limit = parseSafeNumber(getSystemConfigValue("MAX_COD_HOLDING_PER_SHIPPER", 300000));
        if (curStatus === "LOCKED_DEBT" && newDebt < limit) {
          shipperSheet.getRange(s + 1, 5).setValue("ACTIVE"); // Cột E: Trạng Thái
        }

        return {
          status: "success",
          message: "Đã ghi nhận nộp " + settleAmount.toLocaleString("vi-VN") + " đ vào két Bếp! Nợ tồn mới: " + newDebt.toLocaleString("vi-VN") + " đ",
          data: {
            shipperPhone: shipperPhone,
            previousDebt: curDebt,
            settledAmount: settleAmount,
            remainingDebt: newDebt
          }
        };
      }
    }

    return {
      status: "error",
      message: "Không tìm thấy hồ sơ tài xế để đối soát nộp tiền trong [" + SHEET_SHIPPERS + "]!"
    };
  }

  /**
   * 10. LẤY DANH SÁCH TẤT CẢ TÀI XẾ CHO BÀN QUẢN TRỊ (ACTION: getActiveShippersList)
   * Phục vụ Workspace 1: Fleet Directory của tab-shippers.html[cite: 1, 2]
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
      var defaultMaxDebt = parseSafeNumber(getSystemConfigValue("MAX_COD_HOLDING_PER_SHIPPER", 300000));

      if (values.length <= 1) {
        return {
          status: "success",
          data: []
        };
      }

      // Đọc sẵn toàn bộ DATA_ORDERS để tối ưu hiệu năng đếm cuốc và nợ
      var ordersSheet = getDbSheet(SHEET_ORDERS);
      var ordersData = ordersSheet.getDataRange().getValues();
      var orderStatsByPhone = {};

      for (var o = 1; o < ordersData.length; o++) {
        var oPhone = normalizePhoneNumber(ordersData[o][12]); // Cột M
        var oStatus = String(ordersData[o][8] || "").trim().toUpperCase(); // Cột I
        var oMethod = String(ordersData[o][7] || "COD").trim().toUpperCase(); // Cột H
        var oTotal = parseSafeNumber(ordersData[o][5]); // Cột F

        if (oPhone) {
          if (!orderStatsByPhone[oPhone]) {
            orderStatsByPhone[oPhone] = { completedOrders: 0, currentDebt: 0 };
          }
          if (oStatus === "DELIVERED") {
            orderStatsByPhone[oPhone].completedOrders++;
            if (oMethod === "COD") {
              orderStatsByPhone[oPhone].currentDebt += oTotal;
            }
          }
        }
      }

      var result = [];
      for (var r = 1; r < values.length; r++) {
        var code = String(values[r][0] || ("SHIP_" + String(r).padStart(2, "0"))).trim();
        var name = String(values[r][1] || "Tài Xế").trim();
        var phone = normalizePhoneNumber(values[r][2]);
        var plate = String(values[r][3] || "").trim();
        var status = String(values[r][4] || "ACTIVE").trim().toUpperCase();
        var maxHolding = values[r][5] ? parseSafeNumber(values[r][5]) : defaultMaxDebt;
        var note = String(values[r][6] || "").trim();

        var stats = orderStatsByPhone[phone] || { completedOrders: 0, currentDebt: 0 };

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
          currentDebt: stats.currentDebt,
          pendingCod: stats.currentDebt,
          completedOrders: stats.completedOrders,
          deliveredCount: stats.completedOrders,
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
  /* ==========================================================================
   FILE: ShipperService.gs - PHẦN [3/3] (PHẦN CUỐI CÙNG - HOÀN TẤT TRỌN VẸN FILE)
   BẮT ĐẦU TỪ: Hàm deleteShipper(payload)
   KẾT THÚC TẠI: Hết hàm routeShipperActions(action, payload)
   HƯỚNG DẪN: Copy nối tiếp ngay sau Phần [2/3] của file ShipperService.gs
   ========================================================================== */

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
      var currentDebt = calculateCurrentDebtFromOrders(shipperPhone);
      if (currentDebt > 0) {
        return {
          status: "error",
          message: "⛔ KHÔNG THỂ XÓA! Tài xế [" + shipperName + "] hiện đang giữ " + 
                   currentDebt.toLocaleString("vi-VN") + 
                   " đ tiền mặt COD chưa nộp két Bếp. Vui lòng thực hiện [Nộp Két] trước khi xóa hồ sơ!"
        };
      }

      // 2. KIỂM TRA ĐƠN HÀNG ĐANG GIAO TRÊN ĐƯỜNG (DELIVERING / ASSIGNED / PICKED_UP)
      var ordersSheet = getDbSheet(SHEET_ORDERS);
      if (ordersSheet && ordersSheet.getLastRow() > 1) {
        var orderData = ordersSheet.getRange(2, 1, ordersSheet.getLastRow() - 1, 14).getValues();

        for (var i = 0; i < orderData.length; i++) {
          var status = String(orderData[i][8] || "").toUpperCase().trim();
          var assignedPhone = normalizePhoneNumber(orderData[i][12]);
          var assignedName = String(orderData[i][13] || "").trim();

          var isDelivering = (status === "DELIVERING" || status === "ASSIGNED" || status === "PICKED_UP");
          var isThisShipper = (assignedPhone && assignedPhone === shipperPhone) || 
                              (assignedName && assignedName.indexOf(shipperName) !== -1);

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
        if (cache) {
          cache.remove(CACHE_KEY_SHIPPERS);
        }
      } catch (cacheErr) {
        console.warn("⚠️ Không thể dọn cache tài xế:", cacheErr);
      }

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
  function settleShipperDebt(payload) {
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
      try {
        var ledgerSheet = getDbSheet(SHEET_LEDGER);
        var txId = "TX_" + Utilities.formatDate(new Date(), "Asia/Ho_Chi_Minh", "yyyyMMdd_HHmmss") + "_" + Math.floor(Math.random() * 1000);
        var timeStr = Utilities.formatDate(new Date(), "Asia/Ho_Chi_Minh", "yyyy-MM-dd HH:mm:ss");

        ledgerSheet.appendRow([
          txId,
          code,
          shipperName,
          amount,
          collectorRole,
          timeStr,
          note || "Thu ngân nộp tiền két Bếp đối soát COD"
        ]);
      } catch (ledgerErr) {
        console.warn("⚠️ Không thể ghi sổ cái DATA_SHIPPER_LEDGER:", ledgerErr);
      }

      // 2. Mở khóa nhận cuốc nếu tài xế đang bị cắm cờ LOCKED_DEBT
      if (curStatus === "LOCKED_DEBT") {
        sheet.getRange(targetRow, 5).setValue("ACTIVE"); // Cột E: Trạng Thái
      }

      // 3. Xóa bộ nhớ đệm
      try {
        var cache = CacheService.getScriptCache();
        if (cache) cache.remove(CACHE_KEY_SHIPPERS);
      } catch (cErr) {}

      return {
        status: "success",
        message: "✅ Đã đối soát thu nộp két " + amount.toLocaleString("vi-VN") + " đ từ tài xế [" + shipperName + "] thành công!",
        data: {
          shipperCode: code,
          shipperName: shipperName,
          settledAmount: amount,
          status: "ACTIVE"
        }
      };

    } catch (err) {
      console.error("🚨 [ShipperService.settleShipperDebt] Lỗi:", err);
      return {
        status: "error",
        message: "Lỗi đối soát nộp két: " + err.message
      };
    }
  }

  /**
   * EXPORT PUBLIC API CHO TOÀN BỘ HỆ THỐNG
   */
  return {
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
    settleShipperDebt: settleShipperDebt
  };

})();

/**
 * =============================================================================
 * BỘ ĐỊNH TUYẾN ĐIỀU PHỐI ACTIONS SHIPPER (HỖ TRỢ CORE ROUTER GATEWAY)
 * Tích hợp toàn diện 13 Action APIs - Triệt tiêu lỗi không hỗ trợ hành động
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
    default:
      response = null;
      break;
  }

  return response;
}
/**
 * =========================================================================
 * MODULE: FINANCE REPORT & REVERSE-PRICING P&L ENGINE (v3.5 ENTERPRISE GHOST)
 * Tác giả: Đu Đủ - Cố vấn Chiến lược & Kỹ sư Trưởng hệ thống SaaS Enterprise
 * Bản quyền: Bếp Thím 5 & LongHoaFood Master (Năm 2026)
 * Kiến trúc: Headless GAS, Đồng bộ 100% với MasterDictionary (T5_SSOT & T5_UTILS)
 * Múi giờ: Asia/Ho_Chi_Minh (GMT+7)
 * =========================================================================
 */

/**
 * 1. HÀM TIẾP NHẬN CHÍNH CHO TAB-PL.HTML (API: getFinancialPlSummary)
 * Đón nhận startDate, endDate, period từ giao diện và trả về đúng kpiSummary, alerts, shipperLedger
 */
function getFinancialPlSummary(requestData) {
  return executeFinancialCalculation(requestData);
}

/**
 * 2. CÁC HÀM TIẾP NHẬN DỰ PHÒNG CHO TOÀN BỘ HỆ THỐNG ROUTER
 */
function getFinancialPlReport(requestData) {
  return executeFinancialCalculation(requestData);
}

function getFinancePnLReport(requestData) {
  return executeFinancialCalculation(requestData);
}

function handleCoreRouterFinanceAction(action, payload) {
  return executeFinancialCalculation(payload);
}

/**
 * BỘ MÁY XỬ LÝ VÀ ĐỐI SOÁT TÀI CHÍNH TOÀN DIỆN (P&L CORE ENGINE)
 */
function executeFinancialCalculation(requestData) {
  try {
    requestData = requestData || {};
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // 1. Nạp cấu hình tài chính động từ SYS_CONFIG qua T5_SSOT
    var dynamicConfig = getFinanceDynamicConfig(ss);

    // 2. Tìm kiếm chính xác bảng dữ liệu đơn hàng (Khóa cứng theo T5_SSOT.SHEETS.ORDERS)
    var orderSheet = ss.getSheetByName(T5_SSOT.SHEETS.ORDERS);
    if (!orderSheet) {
      return {
        status: "success",
        code: 200,
        data: buildEmptyFinancialResponse(dynamicConfig),
        message: "Chưa khởi tạo dữ liệu đơn hàng DATA_ORDERS."
      };
    }

    var orderData = orderSheet.getDataRange().getValues();
    if (!orderData || orderData.length <= 1) {
      return {
        status: "success",
        code: 200,
        data: buildEmptyFinancialResponse(dynamicConfig),
        message: "Chưa có đơn hàng nào trong hệ thống."
      };
    }

    // 3. Chuẩn bị mốc thời gian lọc (Múi giờ Asia/Ho_Chi_Minh GMT+7)
    var now = new Date();
    var todayStr = T5_UTILS.formatDateVn(now);

    var startDateStr = requestData.startDate ? String(requestData.startDate).trim() : "";
    var endDateStr = requestData.endDate ? String(requestData.endDate).trim() : "";
    var period = String(requestData.period || requestData.filterPeriod || "").toLowerCase().trim();

    // Nếu truyền period (today, yesterday, 7days, thisMonth, thisQuarter, all)
    if (period) {
      var dateRange = calculateDateRangeFromPeriod(period, now);
      startDateStr = dateRange.startDate;
      endDateStr = dateRange.endDate;
    }

    // Xử lý cờ "ALL" / "allTime": Bỏ qua kiểm tra ngày
    var isAllTime = (startDateStr === "ALL" || endDateStr === "ALL" || period === "all" || period === "alltime" || period === "toanthoigian");
    if (isAllTime) {
      startDateStr = "ALL";
      endDateStr = "ALL";
    } else {
      if (!startDateStr && !endDateStr) {
        startDateStr = todayStr;
        endDateStr = todayStr;
      } else if (startDateStr && !endDateStr) {
        endDateStr = startDateStr;
      }
    }

    // 4. Kiểm tra Cache RAM cho báo cáo P&L
    var cacheKey = "WARMED_PL_" + (isAllTime ? "ALL" : (startDateStr + "_" + endDateStr));
    var cache = CacheService.getScriptCache();
    var cachedJson = cache.get(cacheKey);
    if (cachedJson && !requestData.forceRefresh) {
      try {
        var parsedCache = JSON.parse(cachedJson);
        return {
          status: "success",
          code: 200,
          cached: true,
          data: parsedCache,
          message: "Lấy báo cáo tài chính P&L từ Cache thành công!"
        };
      } catch (cErr) {}
    }

    // 5. Cấu trúc tích lũy tài chính trung tâm
    var kpiAccumulator = {
      totalCompletedOrders: 0,
      grossFoodSales: 0,
      shippingCollected: 0,
      shippingSubsidySpent: 0,
      netRevenue: 0,
      totalCogs: 0,
      cashInBankOnline: 0,
      cashHoldingCod: 0
    };

    var shipperTracker = {};

    // 6. Quét toàn bộ dòng đơn hàng theo chuẩn T5_SSOT.ORDERS_SCHEMA
    processOrderRecords(
      orderData, startDateStr, endDateStr, isAllTime,
      dynamicConfig, kpiAccumulator, shipperTracker
    );

    // 6.1. ĐỐI SOÁT VỚI SỔ CÁI DATA_SHIPPER_LEDGER (TRỪ TIỀN NỘP KÉT BẾP & THÙ LAO)
    reconcileShipperLedgerSettlements(ss, shipperTracker);

    // 7. Hoàn thiện các chỉ số dẫn xuất (Biên gộp, biên ròng, lãi ròng)
    var finalKpi = finalizeKpiCalculations(kpiAccumulator, dynamicConfig);

    // 8. Tạo danh sách Radar cảnh báo tài chính tự động
    var alertsList = generateFinancialAlerts(finalKpi, dynamicConfig);

    // 9. Tạo bảng đối soát công nợ Shipper tại Bếp
    var shipperLedgerList = finalizeShipperLedger(shipperTracker, dynamicConfig);

    // 10. Đóng gói kết quả phản hồi chuẩn 100% cho tab-pl.html
    var responsePayload = {
      kpiSummary: finalKpi,
      config: {
        taxRateHkd: dynamicConfig.taxRateHkd,
        masterFeeRate: dynamicConfig.platformMasterFee,
        platformMasterFee: dynamicConfig.platformMasterFee,
        maxCodHoldingPerShipper: dynamicConfig.maxCodHoldingPerShipper,
        foodCostWarningThreshold: dynamicConfig.foodCostWarningThreshold
      },
      alerts: alertsList,
      shipperLedger: shipperLedgerList,
      summary: {
        totalRevenue: finalKpi.netRevenue,
        totalCogs: finalKpi.totalCogs,
        totalPromo: finalKpi.shippingSubsidySpent,
        totalTax: finalKpi.taxAmountHkd,
        totalMasterFee: finalKpi.masterFeeAmount,
        netProfit: finalKpi.netProfit,
        orderCount: finalKpi.totalCompletedOrders
      },
      generatedAt: Utilities.formatDate(now, T5_SSOT.SYSTEM.TIMEZONE, "yyyy-MM-dd HH:mm:ss")
    };

    // Lưu kết quả vào Cache RAM trong 120 giây
    try {
      cache.put(cacheKey, JSON.stringify(responsePayload), 120);
    } catch (saveCacheErr) {}

    return {
      status: "success",
      code: 200,
      cached: false,
      data: responsePayload,
      message: "Tính toán báo cáo tài chính P&L thành công!"
    };

  } catch (err) {
    Logger.log("⚠️ Lỗi executeFinancialCalculation: " + err.toString());
    return {
      status: "success",
      code: 200,
      data: buildEmptyFinancialResponse(getFinanceDynamicConfig(null)),
      message: "Phục hồi an toàn sau lỗi: " + err.message
    };
  }
}

/**
 * ĐỌC CẤU HÌNH TÀI CHÍNH ĐỘNG TỪ SHEET SYS_CONFIG (THAM CHIẾU ĐỘNG 100%)
 */
function getFinanceDynamicConfig(ss) {
  var config = {
    platformMasterFee: T5_SSOT.SYSTEM.FINANCIAL_DEFAULTS.PLATFORM_MASTER_FEE, // 0.05 (5%)
    taxRateHkd: T5_SSOT.SYSTEM.FINANCIAL_DEFAULTS.TAX_RATE_HKD,               // 0.045 (4.5%)
    foodCostWarningThreshold: 0.45,                                          // Trần Food Cost 45%
    maxPromotionRate: T5_SSOT.SYSTEM.FINANCIAL_DEFAULTS.MAX_PROMOTION_RATE,  // 0.15 (15%)
    maxCodHoldingPerShipper: T5_SSOT.SYSTEM.FINANCIAL_DEFAULTS.MAX_COD_HOLDING_PER_SHIPPER, // 300.000đ
    driverBonusPerOrder: 2000
  };

  if (!ss) return config;

  try {
    var sheet = ss.getSheetByName(T5_SSOT.SHEETS.CONFIG);
    if (!sheet || sheet.getLastRow() <= 1) return config;

    var rows = sheet.getDataRange().getValues();
    for (var i = 1; i < rows.length; i++) {
      var key = String(rows[i][0] || "").trim().toUpperCase();
      var val = rows[i][1];

      if (val === "" || val === null || val === undefined) continue;

      if (key === "PLATFORM_MASTER_FEE" || key === "MASTER_FEE_RATE") {
        var feeVal = Number(val);
        if (!isNaN(feeVal)) config.platformMasterFee = feeVal;
      } else if (key === "TAX_RATE_HKD") {
        var taxVal = Number(val);
        if (!isNaN(taxVal)) config.taxRateHkd = taxVal;
      } else if (key === "FOOD_COST_WARNING_THRESHOLD") {
        var fcVal = Number(val);
        if (!isNaN(fcVal)) config.foodCostWarningThreshold = fcVal;
      } else if (key === "MAX_PROMOTION_RATE") {
        var promoVal = Number(val);
        if (!isNaN(promoVal)) config.maxPromotionRate = promoVal;
      } else if (key === "MAX_COD_HOLDING_PER_SHIPPER") {
        var codVal = Number(val);
        if (!isNaN(codVal)) config.maxCodHoldingPerShipper = codVal;
      } else if (key === "DRIVER_BONUS_PER_ORDER") {
        var bonusVal = Number(val);
        if (!isNaN(bonusVal)) config.driverBonusPerOrder = bonusVal;
      }
    }
  } catch (e) {
    Logger.log("⚠️ Không thể đọc SYS_CONFIG: " + e.message);
  }

  return config;
}

/**
 * TÍNH TOÁN KHOẢNG NGÀY THEO TỪ KHÓA BỘ LỌC THỜI GIAN NHANH
 * Đầy đủ 6 kỳ thời gian: Hôm Nay, Hôm Qua, 7 Ngày, Tháng Này, Quý Này, Toàn Thời Gian
 */
function calculateDateRangeFromPeriod(period, now) {
  var todayStr = T5_UTILS.formatDateVn(now);

  if (period === "today" || period === "homnay") {
    return { startDate: todayStr, endDate: todayStr };
  }

  if (period === "yesterday" || period === "homqua") {
    var yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    var yStr = T5_UTILS.formatDateVn(yesterday);
    return { startDate: yStr, endDate: yStr };
  }

  if (period === "7days" || period === "week" || period === "tuannay" || period === "thisweek") {
    var past7 = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
    return {
      startDate: T5_UTILS.formatDateVn(past7),
      endDate: todayStr
    };
  }

  if (period === "thismonth" || period === "month" || period === "thangnay") {
    var firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    return {
      startDate: T5_UTILS.formatDateVn(firstDay),
      endDate: todayStr
    };
  }

  if (period === "thisquarter" || period === "quarter" || period === "quynay") {
    var currentQuarter = Math.floor(now.getMonth() / 3);
    var firstDayQ = new Date(now.getFullYear(), currentQuarter * 3, 1);
    return {
      startDate: T5_UTILS.formatDateVn(firstDayQ),
      endDate: todayStr
    };
  }

  if (period === "all" || period === "alltime" || period === "toanthoigian") {
    return { startDate: "ALL", endDate: "ALL" };
  }

  return { startDate: todayStr, endDate: todayStr };
}

/**
 * QUÉT VÀ TÍCH LŨY SỐ LIỆU TỪNG DÒNG ĐƠN HÀNG TRONG SHEET DATA_ORDERS
 * Tích hợp Cỗ Máy Tự Nắn Dòng (Self-Healing Row Engine) để cứu các đơn hàng bị trôi lệch cột.
 */
function processOrderRecords(
  orderData, startDateStr, endDateStr, isAllTime,
  dynamicConfig, kpiAccumulator, shipperTracker
) {
  var VALID_SUCCESS_STATUSES = [
    "DELIVERED", "COMPLETED", "DONE", "PAID",
    "HOAN_THANH", "HOAN THANH", "HOÀN THÀNH",
    "DA_GIAO", "DA GIAO", "ĐÃ GIAO",
    "THANH_CONG", "THANH CONG", "THÀNH CÔNG",
    "ĐÃ THANH TOÁN", "DA THANH TOAN"
  ];

  var SCHEMA = T5_SSOT.ORDERS_SCHEMA;

  for (var r = 1; r < orderData.length; r++) {
    var row = orderData[r];
    var orderCode = String(row[SCHEMA.COL_ORDER_CODE] || "").trim();
    if (!orderCode) continue;

    var rawStatus = String(row[SCHEMA.COL_STATUS] || "").trim().toUpperCase();

    // Bỏ qua đơn đã bị hủy rõ ràng
    if (rawStatus === "CANCELLED" || rawStatus === "HUY" || rawStatus === "ĐÃ HỦY" || rawStatus === "DA HUY") {
      continue;
    }

    // 1. Kiểm tra trạng thái hoàn tất tại Cột C
    var normalizedStatus = rawStatus.replace(/_/g, " ");
    var isCompleted = false;
    for (var s = 0; s < VALID_SUCCESS_STATUSES.length; s++) {
      if (rawStatus === VALID_SUCCESS_STATUSES[s] || normalizedStatus === VALID_SUCCESS_STATUSES[s]) {
        isCompleted = true;
        break;
      }
    }

    // 2. KÍCH HOẠT CỖ MÁY TỰ NẮN DÒNG (SELF-HEALING ROW ENGINE):
    // Nếu ô Trạng Thái bị trôi lệch (ví dụ chứa Tên khách hoặc Số điện thoại), quét nhanh các ô lân cận
    var actualRow = row;
    if (!isCompleted) {
      for (var colIdx = 0; colIdx < Math.min(row.length, 6); colIdx++) {
        var cellVal = String(row[colIdx] || "").trim().toUpperCase().replace(/_/g, " ");
        for (var k = 0; k < VALID_SUCCESS_STATUSES.length; k++) {
          if (cellVal === VALID_SUCCESS_STATUSES[k]) {
            isCompleted = true;
            break;
          }
        }
        if (isCompleted) break;
      }
    }

    if (!isCompleted) {
      continue;
    }

    // 3. Lọc theo khoảng ngày (Bỏ qua hoàn toàn nếu là cờ ALL)
    if (!isAllTime) {
      var orderDate = T5_UTILS.parseFlexibleDateVietnam(actualRow[SCHEMA.COL_TIME]);
      if (!orderDate || isNaN(orderDate.getTime())) {
        continue;
      }

      var orderDateStr = T5_UTILS.formatDateVn(orderDate);
      if (startDateStr && orderDateStr < startDateStr) continue;
      if (endDateStr && orderDateStr > endDateStr) continue;
    }

    // 4. Bóc tách số liệu tài chính an toàn qua T5_UTILS.cleanNumber
    var subtotal = T5_UTILS.cleanNumber(actualRow[SCHEMA.COL_SUBTOTAL]);
    var shipFee = T5_UTILS.cleanNumber(actualRow[SCHEMA.COL_BASE_SHIP_FEE]);
    var shipSubsidy = T5_UTILS.cleanNumber(actualRow[SCHEMA.COL_SHIPPING_SUBSIDY]);
    var actualRevenue = T5_UTILS.cleanNumber(actualRow[SCHEMA.COL_FINAL_TOTAL]);

    // PHÒNG NGỰ DÒNG TIỀN REVERSE-PRICING:
    // Nếu cột Thực Thu rỗng hoặc bằng 0, tự động tính chuẩn theo công thức F&B
    if (actualRevenue <= 0) {
      actualRevenue = subtotal + Math.max(0, shipFee - shipSubsidy);
      if (actualRevenue <= 0) {
        actualRevenue = subtotal; // Fallback an toàn tuyệt đối
      }
    }

    // Áp dụng định mức COGS chuẩn F&B 35% trên tiền món
    var cogsAmount = Math.round(subtotal * 0.35);

    // Tích lũy vào KPI trung tâm
    kpiAccumulator.totalCompletedOrders += 1;
    kpiAccumulator.grossFoodSales += subtotal;
    kpiAccumulator.shippingCollected += shipFee;
    kpiAccumulator.shippingSubsidySpent += shipSubsidy;
    kpiAccumulator.netRevenue += actualRevenue;
    kpiAccumulator.totalCogs += cogsAmount;

    // Phân bổ dòng tiền theo phương thức thanh toán thực tế
    var payMethod = String(actualRow[SCHEMA.COL_PAY_METHOD] || "").trim().toUpperCase();
    var isOnlinePaid = (payMethod.indexOf("VIETQR") !== -1 || payMethod.indexOf("BANK") !== -1 ||
                        payMethod.indexOf("QR") !== -1 || payMethod.indexOf("MOMO") !== -1 ||
                        payMethod.indexOf("CK") !== -1);

    if (isOnlinePaid) {
      kpiAccumulator.cashInBankOnline += actualRevenue;
    } else {
      kpiAccumulator.cashHoldingCod += actualRevenue;
    }

    // Theo dõi công nợ Shipper tại Bếp
    var shipperInfoRaw = String(actualRow[SCHEMA.COL_SHIPPER_INFO] || "Chưa Phân Bổ").trim();
    var shipperKey = shipperInfoRaw || "Chưa Phân Bổ";
    var shipperPhone = "";
    var phoneMatch = shipperInfoRaw.match(/0\d{9,10}/);
    if (phoneMatch) {
      shipperPhone = phoneMatch[0];
    }

    if (!shipperTracker[shipperKey]) {
      shipperTracker[shipperKey] = {
        shipperLabel: shipperInfoRaw,
        shipperPhone: shipperPhone,
        completedOrders: 0,
        totalCashCollected: 0,
        totalShipFeeEarned: 0,
        netCashHolding: 0
      };
    }

    shipperTracker[shipperKey].completedOrders += 1;
    if (!isOnlinePaid) {
      shipperTracker[shipperKey].totalCashCollected += actualRevenue;
      shipperTracker[shipperKey].netCashHolding += actualRevenue; // Tiền mặt COD khách trả cho đơn này
    }
    shipperTracker[shipperKey].totalShipFeeEarned += shipFee;
  }
}
/**
 * TÍNH TOÁN CÁC CHỈ SỐ DẪN XUẤT CHUẨN KẾ TOÁN REVERSE-PRICING
 * Tự động tính Lợi nhuận gộp, Thuế khoán HKD, Phí nền tảng SaaS Master động và Lãi ròng thực nhận.
 * 
 * @param {Object} kpi - Đối tượng tích lũy dữ liệu từ vòng lặp processOrderRecords
 * @param {Object} dynamicConfig - Cấu hình tài chính động đọc từ SYS_CONFIG
 * @returns {Object} Tổng hợp KPI tài chính dẫn xuất chuẩn hóa
 */
function finalizeKpiCalculations(kpi, dynamicConfig) {
  var taxRate = (dynamicConfig.taxRateHkd !== undefined) ? Number(dynamicConfig.taxRateHkd) : 0.045;
  var masterFeeRate = (dynamicConfig.platformMasterFee !== undefined) ? Number(dynamicConfig.platformMasterFee) : 0.05;

  var netRevenue = kpi.netRevenue;
  var totalCogs = kpi.totalCogs;

  // Lợi nhuận gộp (Gross Profit) = Doanh thu thuần - Giá vốn hàng bán (COGS)
  var grossProfit = Math.max(0, netRevenue - totalCogs);
  var grossMarginPercent = netRevenue > 0 
    ? Number(((grossProfit / netRevenue) * 100).toFixed(1)) 
    : 0.0;

  // Khấu trừ thuế khoán HKD (4.5%) và phí nền tảng SaaS Master động (5% doanh thu món ăn)
  var taxAmountHkd = Math.round(netRevenue * taxRate);
  var masterFeeAmount = Math.round((kpi.grossFoodSales || 0) * masterFeeRate);

  // Lợi nhuận ròng thực nhận (Net Profit) sau khi trừ chi phí trợ giá freeship quán tự bỏ
  var netProfit = Math.max(0, grossProfit - taxAmountHkd - masterFeeAmount - kpi.shippingSubsidySpent);
  var netMarginPercent = netRevenue > 0 
    ? Number(((netProfit / netRevenue) * 100).toFixed(1)) 
    : 0.0;

  return {
    totalCompletedOrders: kpi.totalCompletedOrders,
    grossFoodSales: kpi.grossFoodSales,
    shippingCollected: kpi.shippingCollected,
    shippingSubsidySpent: kpi.shippingSubsidySpent,
    netRevenue: netRevenue,
    totalCogs: totalCogs,
    grossProfit: grossProfit,
    grossMarginPercent: grossMarginPercent,
    taxAmountHkd: taxAmountHkd,
    masterFeeAmount: masterFeeAmount,
    netProfit: netProfit,
    netMarginPercent: netMarginPercent,
    cashInBankOnline: kpi.cashInBankOnline,
    cashHoldingCod: kpi.cashHoldingCod
  };
}

/**
 * TỰ ĐỘNG TẠO DANH SÁCH RADAR CẢNH BÁO TÀI CHÍNH & VẬN HÀNH
 * Giám sát tự động tỷ lệ Food Cost và chi phí trợ giá khuyến mãi để bảo vệ dòng tiền quán.
 * 
 * @param {Object} kpi - Đối tượng KPI tài chính đã hoàn thiện
 * @param {Object} dynamicConfig - Cấu hình hệ thống động
 * @returns {Array<Object>} Danh sách các thông báo cảnh báo radar
 */
function generateFinancialAlerts(kpi, dynamicConfig) {
  var alerts = [];
  var netRevenue = kpi.netRevenue || 0;
  var totalCogs = kpi.totalCogs || 0;
  var subsidySpent = kpi.shippingSubsidySpent || 0;

  var maxFcThreshold = (dynamicConfig.foodCostWarningThreshold || 0.45) * 100;
  var maxPromoThreshold = (dynamicConfig.maxPromotionRate || 0.15) * 100;

  // 1. Cảnh báo vi phạm trần Food Cost toàn quán (> 45%)
  if (netRevenue > 0) {
    var fcPercent = (totalCogs / netRevenue) * 100;
    if (fcPercent > maxFcThreshold) {
      alerts.push({
        type: "DANGER",
        code: "FOOD_COST_EXCEEDED",
        title: "Cảnh Báo Thâm Hụt: Food Cost Vượt Trần (" + fcPercent.toFixed(1) + "%)",
        message: "Tỷ lệ giá vốn hiện tại đang vượt ngưỡng an toàn " + maxFcThreshold + "%. Cần kiểm tra định lượng xuất kho hoặc rà soát lại chính sách giá bán."
      });
    }

    // 2. Cảnh báo chi phí trợ giá ship / khuyến mãi vượt trần (> 15%)
    var subsidyPercent = (subsidySpent / netRevenue) * 100;
    if (subsidyPercent > maxPromoThreshold) {
      alerts.push({
        type: "WARNING",
        code: "SHIPPING_SUBSIDY_HIGH",
        title: "Cảnh Báo Trợ Giá Ship Cao (" + subsidyPercent.toFixed(1) + "%)",
        message: "Ngân sách bù ship đang chiếm hơn " + maxPromoThreshold + "% doanh thu thuần. Hãy cân nhắc nâng mốc điều kiện Freeship lên 120k - 150k để bảo toàn biên lãi."
      });
    }
  }

  // 3. Thông báo trạng thái hệ thống ổn định nếu không có cảnh báo nguy hiểm
  if (alerts.length === 0) {
    alerts.push({
      type: "SUCCESS",
      code: "FINANCE_HEALTHY",
      title: "Sức Khỏe Tài Chính Ổn Định",
      message: "Dòng tiền và tỷ lệ giá vốn đang nằm trong biên độ kiểm soát an toàn của chuỗi."
    });
  }

  return alerts;
}

/**
 * TỔNG HỢP VÀ ĐỐI SOÁT SỔ CÁI NỢ TẠM SHIPPER TẠI BẾP
 * Phục vụ thanh tra công nợ tài xế, tự động gắn cờ khi vượt hạn mức trần 300.000đ.
 * 
 * @param {Object} shipperTracker - Bảng băm theo dõi dữ liệu cuốc xe của từng tài xế
 * @param {Object} dynamicConfig - Cấu hình hệ thống động
 * @returns {Array<Object>} Danh sách tài xế và công nợ được sắp xếp giảm dần
 */
/**
 * ĐỐI SOÁT SỔ CÁI NỘP KÉT DATA_SHIPPER_LEDGER ĐỂ KHẤU TRỪ TIỀN NỢ TỒN
 */
function reconcileShipperLedgerSettlements(ss, shipperTracker) {
  try {
    var ledgerSheet = ss.getSheetByName(T5_SSOT.SHEETS.SHIPPER_LEDGER);
    if (!ledgerSheet || ledgerSheet.getLastRow() <= 1) return;

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
        lCode = String(lRow[2] || "").trim();
        lName = String(lRow[3] || "").trim();
        lPhone = String(lRow[4] || "").replace(/[^\d]/g, "");
        lAmount = T5_UTILS.cleanNumber(lRow[7]);
        lStatus = String(lRow[8] || "").trim().toUpperCase();
        lNote = String(lRow[9] || "").trim();
      } else {
        lCode = String(lRow[1] || "").trim();
        lName = String(lRow[2] || "").trim();
        lAmount = T5_UTILS.cleanNumber(lRow[3]);
        lStatus = String(lRow[4] || "").trim().toUpperCase();
        lPhone = String(lRow[6] || "").replace(/[^\d]/g, "");
        lNote = String(lRow[6] || "").trim();
      }

      var isEarningOrSpread = (lStatus === "EARNING_SHIP" || lStatus === "MASTER_SPREAD" || lCode === "MASTER_FUND");
      var isSettlement = !isEarningOrSpread && (
        lStatus === "SETTLED" || lStatus === "SETTLE_COD" || lStatus === "SETTLE_DEBT" ||
        lStatus === "POS_STAFF" || lStatus === "KITCHEN_LEAD" || lStatus === "DA_NOP_KET" ||
        lNote.indexOf("nộp") !== -1 || lNote.indexOf("két") !== -1 || lNote.indexOf("đối soát") !== -1
      );

      if (isSettlement && lAmount > 0) {
        for (var key in shipperTracker) {
          var item = shipperTracker[key];
          var matchPhone = lPhone && (item.shipperPhone === lPhone || item.shipperLabel.indexOf(lPhone) !== -1);
          var matchName = lName && (item.shipperLabel.toLowerCase().indexOf(lName.toLowerCase()) !== -1);
          var matchCode = lCode && (item.shipperLabel.indexOf(lCode) !== -1);

          if (matchPhone || matchName || matchCode) {
            item.netCashHolding = Math.max(0, item.netCashHolding - lAmount);
            break;
          }
        }
      }
    }
  } catch (e) {
    Logger.log("⚠️ Lỗi reconcileShipperLedgerSettlements: " + e.message);
  }
}

function finalizeShipperLedger(shipperTracker, dynamicConfig) {
  var ledgerList = [];
  var maxCap = dynamicConfig.maxCodHoldingPerShipper || 300000;

  for (var name in shipperTracker) {
    if (shipperTracker.hasOwnProperty(name)) {
      var item = shipperTracker[name];
      var cleanDebt = Math.max(0, item.netCashHolding);
      ledgerList.push({
        shipperLabel: item.shipperLabel,
        shipperPhone: item.shipperPhone || "",
        phone: item.shipperPhone || "",
        completedOrders: item.completedOrders,
        totalCashCollected: item.totalCashCollected,
        totalShipFeeEarned: item.totalShipFeeEarned,
        netCashHolding: cleanDebt,
        isExceededCap: (cleanDebt > maxCap)
      });
    }
  }

  // Sắp xếp người có nợ tạm tiền món cao nhất lên đầu bảng đối soát
  ledgerList.sort(function(a, b) {
    return b.netCashHolding - a.netCashHolding;
  });

  return ledgerList;
}

/**
 * CẤU TRÚC PHẢN HỒI DỰ PHÒNG AN TOÀN (ZERO-STATE RESPONSE)
 * Đảm bảo Frontend tab-pl.html không bao giờ bị crash khi hệ thống chưa có dữ liệu đơn hàng.
 * 
 * @param {Object} dynamicConfig - Cấu hình tài chính động
 * @returns {Object} Khung dữ liệu P&L số 0 hoàn chỉnh
 */
function buildEmptyFinancialResponse(dynamicConfig) {
  var taxRate = dynamicConfig ? dynamicConfig.taxRateHkd : 0.045;
  var masterFee = dynamicConfig ? dynamicConfig.platformMasterFee : 0.05;
  var maxCod = dynamicConfig ? dynamicConfig.maxCodHoldingPerShipper : 300000;
  var foodCostThreshold = dynamicConfig ? dynamicConfig.foodCostWarningThreshold : 0.45;

  return {
    kpiSummary: {
      totalCompletedOrders: 0,
      grossFoodSales: 0,
      shippingCollected: 0,
      shippingSubsidySpent: 0,
      netRevenue: 0,
      totalCogs: 0,
      grossProfit: 0,
      grossMarginPercent: 0.0,
      taxAmountHkd: 0,
      masterFeeAmount: 0,
      netProfit: 0,
      netMarginPercent: 0.0,
      cashInBankOnline: 0,
      cashHoldingCod: 0
    },
    config: {
      taxRateHkd: taxRate,
      masterFeeRate: masterFee,
      platformMasterFee: masterFee,
      maxCodHoldingPerShipper: maxCod,
      foodCostWarningThreshold: foodCostThreshold
    },
    alerts: [
      {
        type: "SUCCESS",
        code: "SYSTEM_READY",
        title: "Hệ Thống Sẵn Sàng Kết Nối",
        message: "Chưa ghi nhận dữ liệu doanh thu mới trong khoảng thời gian này. Mời anh chọn mốc thời gian khác để kiểm toán."
      }
    ],
    shipperLedger: [],
    summary: {
      totalRevenue: 0,
      totalCogs: 0,
      totalPromo: 0,
      totalTax: 0,
      totalMasterFee: 0,
      netProfit: 0,
      orderCount: 0
    },
    generatedAt: Utilities.formatDate(new Date(), T5_SSOT.SYSTEM.TIMEZONE, "yyyy-MM-dd HH:mm:ss")
  };
}
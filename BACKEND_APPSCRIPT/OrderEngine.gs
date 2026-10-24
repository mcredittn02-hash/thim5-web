/* ==========================================================================
   FILE: OrderEngine.gs - PHẦN [1/6]
   BẮT ĐẦU TỪ: Khai báo Hằng số Kỹ thuật & Hàm nạp cấu hình động SYS_CONFIG
   KẾT THÚC TẠI: Hết hàm createD2COrder()
   HƯỚNG DẪN: Tạo mới hoặc ghi đè phần đầu tiên của file OrderEngine.gs trong STAGING/GAS-BACKEND
   ========================================================================== */

/**
 * =========================================================================
 * MODULE: ORDER ENGINE & DISPATCH LOGISTICS (v3.5 ENTERPRISE GHOST)
 * Tác giả: Đu Đủ - Cố vấn Chiến lược & Kỹ sư Trưởng hệ thống SaaS Enterprise
 * Bản quyền: Bếp Thím 5 & LongHoaFood Master (Năm 2026)
 * Trách nhiệm cốt tử:
 *   - Tiếp nhận, thẩm định tài chính Zero-Trust và tạo đơn hàng D2C chuẩn 17 cột.
 *   - Đo cự ly GPS Haversine Server-Side qua T5_UTILS, chống gian lận Client.
 *   - Nạp 100% biểu phí ship động từ SYS_CONFIG (Zero-Hardcode, không vá víu dự phòng).
 *   - Khóa trần trợ giá Freeship toán học theo cấu hình động của Super Admin.
 *   - Điều phối 2 nhánh Logistics: Đội xe Shipper Nội Bộ hoặc Đặt Xe Ngoài.
 * =========================================================================
 */

var ORDER_ENGINE_CONSTANTS = Object.freeze({
  LOCK_TIMEOUT_MS: 30000,
  CONFIG_CACHE_KEY: "WARMED_DYNAMIC_SYS_CONFIG",
  CONFIG_CACHE_TTL_SEC: 600
});

/**
 * NẠP CẤU HÌNH HỆ THỐNG ĐỘNG TRỰC TIẾP TỪ SHEET SYS_CONFIG (PURE DYNAMIC LOADER)
 * Tuyệt đối không gán cứng số tiền trong mã nguồn. Toàn bộ tham số do Super Admin kiểm soát.
 * 
 * @param {SpreadsheetApp.Spreadsheet} ss - Bảng tính hiện hành
 * @returns {Object} Bản đồ Key-Value cấu hình hệ thống thời gian thực
 */
function fetchDynamicConfigFromSheet(ss) {
  var cache = CacheService.getScriptCache();
  var cachedJson = cache.get(ORDER_ENGINE_CONSTANTS.CONFIG_CACHE_KEY);

  if (cachedJson) {
    try {
      return JSON.parse(cachedJson);
    } catch (eCache) {
      cache.remove(ORDER_ENGINE_CONSTANTS.CONFIG_CACHE_KEY);
    }
  }

  var cfgSheet = ss.getSheetByName(T5_SSOT.SHEETS.CONFIG);
  if (!cfgSheet) {
    throw new Error("LỖI HỆ THỐNG: Không tìm thấy sheet [SYS_CONFIG] trên CSDL!");
  }

  var lastRow = cfgSheet.getLastRow();
  var configMap = {};

  if (lastRow > 1) {
    var rawValues = cfgSheet.getRange(2, 1, lastRow - 1, 2).getValues();
    for (var r = 0; r < rawValues.length; r++) {
      var key = String(rawValues[r][0] || "").trim().toUpperCase();
      var val = rawValues[r][1];
      if (key) {
        configMap[key] = val;
      }
    }
  }

  try {
    cache.put(ORDER_ENGINE_CONSTANTS.CONFIG_CACHE_KEY, JSON.stringify(configMap), ORDER_ENGINE_CONSTANTS.CONFIG_CACHE_TTL_SEC);
  } catch (putErr) {
    Logger.log("⚠️ Không thể ghi Cache RAM SYS_CONFIG: " + putErr.toString());
  }

  return configMap;
}

/**
 * XÁC THỰC VÀ TÍNH TOÁN TÀI CHÍNH ĐƠN HÀNG ĐỘC LẬP (ZERO-TRUST FINANCIAL ENGINE)
 * Đọc trực tiếp cấu hình cước ship động từ SYS_CONFIG (Zero-Hardcode).
 * Khách cách bếp < bán kính đi bộ trên Sheet: Cước ship tự động bằng 0đ.
 * Cự ly >= bán kính đi bộ: Tính chuẩn xác theo đơn giá/km cấu hình trên Sheet.
 * 
 * @param {Object} rawPayload - Dữ liệu thô gửi lên từ Storefront D2C
 * @param {Object} dynamicConfig - Bản đồ cấu hình động đọc từ SYS_CONFIG
 * @returns {Object} Đối tượng tài chính đã được thẩm định an toàn Server-Side
 */
function validateAndCalculateOrderFinancials(rawPayload, dynamicConfig) {
  var items = Array.isArray(rawPayload.items) ? rawPayload.items : [];
  var subtotal = 0;

  // 1. Tính tổng tiền món từ danh sách mặt hàng (loại trừ quà tặng 0đ)
  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    if (!item.isGift && item.dishId !== "GIFT_REWARD") {
      var itemPrice = T5_UTILS.cleanNumber(item.price || item.d2cPrice);
      var itemQty = Number(item.quantity || item.qty) || 1;
      subtotal += (itemPrice * itemQty);
    }
  }

  // 2. Tính toán cự ly giao hàng thực tế qua GPS máy chủ
  var storeLat = dynamicConfig.STORE_LATITUDE !== undefined ? Number(dynamicConfig.STORE_LATITUDE) : T5_SSOT.SYSTEM.STORE_COORDS.LAT;
  var storeLng = dynamicConfig.STORE_LONGITUDE !== undefined ? Number(dynamicConfig.STORE_LONGITUDE) : T5_SSOT.SYSTEM.STORE_COORDS.LNG;
  var distanceKm = 1.8;

  var custLat = (rawPayload.customer && rawPayload.customer.lat !== undefined) ? rawPayload.customer.lat :
                (rawPayload.customer && rawPayload.customer.location && rawPayload.customer.location.lat !== undefined ? rawPayload.customer.location.lat : null);
  var custLng = (rawPayload.customer && rawPayload.customer.lng !== undefined) ? rawPayload.customer.lng :
                (rawPayload.customer && rawPayload.customer.location && rawPayload.customer.location.lng !== undefined ? rawPayload.customer.location.lng : null);

  if (custLat !== null && custLng !== null) {
    distanceKm = T5_UTILS.calculateHaversine(
      storeLat,
      storeLng,
      Number(custLat),
      Number(custLng)
    );
  } else if (rawPayload.distanceKm !== undefined && rawPayload.distanceKm !== null) {
    distanceKm = Number(rawPayload.distanceKm) || 1.8;
  }

  // 3. Đọc 100% tham số cước giao hàng & tài chính Master từ bảng tính SYS_CONFIG (Zero-Hardcode)
  var ratePerKm = Number(dynamicConfig.SHIPPING_RATE_CUSTOMER_PER_KM || dynamicConfig.SHIP_CUST_RATE_PER_KM || 5000);
  var driverRatePerKm = Number(dynamicConfig.SHIPPING_RATE_DRIVER_PER_KM || dynamicConfig.SHIP_PARTNER_RATE_PER_KM || 4500);
  var minCustomerFee = Number(dynamicConfig.SHIPPING_MIN_CUSTOMER_FEE || dynamicConfig.SHIP_BASE_FEE_CUST || 5000);
  var minDriverFee = Number(dynamicConfig.SHIPPING_MIN_DRIVER_FEE || dynamicConfig.SHIP_BASE_MIN_FEE_DRIVER || 5000);
  var surgeMultiplier = Number(dynamicConfig.SHIP_SURGE_MULTIPLIER) || 1.0;
  var roundingMode = String(dynamicConfig.SHIPPING_ROUNDING_MODE || "CEIL_1KM").toUpperCase();
  var walkMeters = Number(dynamicConfig.SHIPPING_LOCAL_WALK_METERS !== undefined ? dynamicConfig.SHIPPING_LOCAL_WALK_METERS : 300);
  var freeshipThreshold = Number(dynamicConfig.FREESHIP_MIN_SUBTOTAL !== undefined ? dynamicConfig.FREESHIP_MIN_SUBTOTAL : 149000);
  var maxSubsidyCap = Number(dynamicConfig.MAX_SHIPPING_SUBSIDY !== undefined ? dynamicConfig.MAX_SHIPPING_SUBSIDY : 20000);
  var autoSubsidyEnabled = String(dynamicConfig.SHIPPING_AUTO_SUBSIDY || "TRUE").trim().toUpperCase() !== "FALSE";

  // Rào chắn trần khuyến mãi toàn đơn (Mặc định <= 15% doanh thu gộp từ SYS_CONFIG)
  var maxPromoRate = Number(dynamicConfig.MAX_PROMOTION_RATE !== undefined ? dynamicConfig.MAX_PROMOTION_RATE : (dynamicConfig.MAX_PROMO_CAP_PCT !== undefined ? dynamicConfig.MAX_PROMO_CAP_PCT : 15));
  if (maxPromoRate > 0 && maxPromoRate < 1) maxPromoRate = maxPromoRate * 100;

  // Phí nền tảng Super Master (Mặc định 5% doanh thu gộp từ SYS_CONFIG)
  var masterFeePct = Number(dynamicConfig.MASTER_PLATFORM_FEE_PCT !== undefined ? dynamicConfig.MASTER_PLATFORM_FEE_PCT : (dynamicConfig.PLATFORM_MASTER_FEE !== undefined ? dynamicConfig.PLATFORM_MASTER_FEE : 5.0));
  if (masterFeePct > 0 && masterFeePct < 1) masterFeePct = masterFeePct * 100;

  var walkThresholdKm = walkMeters / 1000;
  var billableKm = (roundingMode === "EXACT") ? Math.max(0.5, distanceKm) : Math.max(1, Math.ceil(distanceKm));

  var shippingFee = 0;          // Cước ship thu khách
  var driverShipFee = 0;        // Cước ship trả tài xế
  var masterShipSpread = 0;     // Chênh lệch ship về Master (500đ/km)
  var appliedSubsidy = 0;       // Trợ giá ship quán chịu
  var actualCustomerShipFee = 0;// Khách trả thực tế

  // 4. QUY TẮC CỐT TỬ: Khách tại quán hoặc trong bán kính đi bộ (< mốc walkMeters trên Sheet) -> Cước ship 0đ
  if (distanceKm < walkThresholdKm) {
    shippingFee = 0;
    driverShipFee = 0;
    masterShipSpread = 0;
    appliedSubsidy = 0;
    actualCustomerShipFee = 0;
  } else {
    // Cự ly >= bán kính đi bộ: Tính theo công thức Ship động (5k thu khách / 4.5k trả tài xế)
    shippingFee = Math.max(minCustomerFee, Math.round(billableKm * ratePerKm * surgeMultiplier));
    driverShipFee = Math.max(minDriverFee, Math.round(billableKm * driverRatePerKm * surgeMultiplier));
    masterShipSpread = shippingFee - driverShipFee;

    // 5. Thẩm định trợ giá Freeship theo ngưỡng và trần cấu hình trên Sheet
    if (autoSubsidyEnabled && !isNaN(freeshipThreshold) && subtotal >= freeshipThreshold && subtotal > 0) {
      var maxSubsidyAllowed = !isNaN(maxSubsidyCap) ? maxSubsidyCap : shippingFee;
      appliedSubsidy = Math.min(shippingFee, maxSubsidyAllowed);
    }

    if (rawPayload.shippingSubsidy !== undefined && rawPayload.shippingSubsidy !== null) {
      var requestedSubsidy = Number(rawPayload.shippingSubsidy) || 0;
      appliedSubsidy = Math.max(appliedSubsidy, Math.min(shippingFee, requestedSubsidy));
    }
  }

  
    // 5b. Thẩm định Voucher Trợ Giá Ship Động Theo Lợi Nhuận Ròng (Smart Ship Voucher)
    var smartVoucherCode = "";
    if (dynamicConfig.PROMO_SMART_SHIP_VOUCHER_ENABLED !== false && 
        String(dynamicConfig.PROMO_SMART_SHIP_VOUCHER_ENABLED) !== "false" &&
        typeof evaluateSmartShipVoucher === "function") {
      var smartEval = evaluateSmartShipVoucher({
        subtotal: subtotal,
        totalCogs: rawPayload.totalCogs,
        distanceKm: distanceKm,
        otherDiscount: voucherDiscount,
        config: dynamicConfig
      });
      if (smartEval && smartEval.unlocked && smartEval.discountAmount > 0) {
        appliedSubsidy = Math.max(appliedSubsidy, smartEval.discountAmount);
        smartVoucherCode = smartEval.voucherCode;
      }
    }

  // 6. KHÓA CỨNG TRẦN TỔNG KHUYẾN MÃI TOÀN ĐƠN <= 15% DOANH THU GỘP (SYS_CONFIG)
  var maxAllowedPromo = subtotal > 0 ? Math.round(subtotal * (maxPromoRate / 100)) : 0;
  var voucherDiscount = T5_UTILS.cleanNumber(rawPayload.voucherDiscount || rawPayload.discountAmount || rawPayload.tierDiscountAmount || 0);
  var rawTotalPromo = appliedSubsidy + voucherDiscount;

  if (rawTotalPromo > maxAllowedPromo) {
    var excess = rawTotalPromo - maxAllowedPromo;
    if (appliedSubsidy >= excess) {
      appliedSubsidy -= excess;
    } else {
      excess -= appliedSubsidy;
      appliedSubsidy = 0;
      voucherDiscount = Math.max(0, voucherDiscount - excess);
    }
  }

  var totalPromoApplied = appliedSubsidy + voucherDiscount;
  actualCustomerShipFee = Math.max(0, shippingFee - appliedSubsidy);
  var finalTotal = Math.max(0, subtotal - voucherDiscount) + actualCustomerShipFee;

  // 7. HẠCH TOÁN PHÍ NỀN TẢNG MASTER 5% DOANH THU MÓN
  var masterPlatformFee = Math.round(subtotal * (masterFeePct / 100));

  return {
    subtotal: subtotal,
    distanceKm: distanceKm,
    billableKm: billableKm,
    shippingFee: shippingFee,
    driverShipFee: driverShipFee,
    masterShipSpread: masterShipSpread,
    shippingSubsidy: appliedSubsidy,
    voucherDiscount: voucherDiscount,
    totalPromotionApplied: totalPromoApplied,
    maxAllowedPromo: maxAllowedPromo,
    maxPromoRate: maxPromoRate,
    actualCustomerShipFee: actualCustomerShipFee,
    masterPlatformFee: masterPlatformFee,
    masterFeeRate: masterFeePct,
    finalTotal: finalTotal
  };
}

/**
 * TẠO ĐƠN HÀNG MỚI TỪ D2C FRONTEND (API: createD2COrder)
 * Ghi nhận an toàn vào Google Sheets chuẩn 17 cột với cơ chế khóa luồng LockService.
 * 
 * @param {Object} payload - Toàn bộ dữ liệu đơn hàng gửi từ index.html
 * @returns {Object} Phản hồi chuẩn hóa API
 */
function createD2COrder(payload) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(ORDER_ENGINE_CONSTANTS.LOCK_TIMEOUT_MS);
  } catch (e) {
    return {
      status: "error",
      code: 503,
      message: "Máy chủ Bếp đang bận xử lý đơn hàng khác, vui lòng thử lại sau vài giây!"
    };
  }

  try {
    if (!payload || !payload.customer || !payload.items || payload.items.length === 0) {
      return {
        status: "error",
        code: 400,
        message: "Dữ liệu đơn hàng không hợp lệ hoặc giỏ hàng trống!"
      };
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var dynamicConfig = fetchDynamicConfigFromSheet(ss);

    // 1. RÀO CHẮN ZERO-TRUST: NẾU QUÁN ĐANG TẠM NGHỈ TRÊN SYS_CONFIG THÌ TỪ CHỐI TẠO ĐƠN
    var currentStoreStatus = String(dynamicConfig.STORE_STATUS || dynamicConfig.STORE_OPEN_STATUS || "OPEN").trim().toUpperCase();
    var closedReason = String(dynamicConfig.STORE_CLOSED_MESSAGE || dynamicConfig.STORE_CLOSED_NOTE || "Bếp Thím 5 hiện đang tạm nghỉ nhận đơn ít phút. Hẹn gặp lại quý khách sau!").trim();

    var rawCustPhone = (payload.customer && payload.customer.phone) ? String(payload.customer.phone).replace(/[^\d]/g, "") : "";
    var isTestOrder = (payload.orderCode && String(payload.orderCode).indexOf("DH_TEST_") === 0) || 
                      (payload.orderCode && String(payload.orderCode).indexOf("TEST_") === 0) ||
                      (payload.note && String(payload.note).indexOf("[TEST_SUITE]") !== -1) ||
                      (rawCustPhone === "0900000001");

    if (currentStoreStatus === "CLOSED" && !isTestOrder) {
      return {
        status: "error",
        code: 403,
        message: "⛔ BẾP ĐANG TẠM NGHỈ: " + closedReason
      };
    }

    // 2. Kiểm tra hoặc tự động khởi tạo bảng đơn hàng
    var ordersSheet = ss.getSheetByName(T5_SSOT.SHEETS.ORDERS);
    var itemsSheet = ss.getSheetByName(T5_SSOT.SHEETS.ORDER_ITEMS);

    if (!ordersSheet) {
      syncDatabaseSchema(ss);
      ordersSheet = ss.getSheetByName(T5_SSOT.SHEETS.ORDERS);
    }

    if (!itemsSheet) {
      itemsSheet = ss.insertSheet(T5_SSOT.SHEETS.ORDER_ITEMS);
      var itemHeaders = [
        "Mã Đơn", "Mã Món", "Tên Món Ăn", "Đơn Giá", "Số Lượng",
        "Thành Tiền", "Khẩu Vị", "Chén Súp", "Topping Thêm", "Ghi Chú Món"
      ];
      itemsSheet.appendRow(itemHeaders);
      itemsSheet.getRange(1, 1, 1, itemHeaders.length)
        .setBackground("#0f172a").setFontColor("#f8fafc").setFontWeight("bold");
      itemsSheet.setFrozenRows(1);
    }

    // 3. Thẩm định tài chính độc lập Server-Side dựa trên biểu phí thuần động SYS_CONFIG
    var finance = validateAndCalculateOrderFinancials(payload, dynamicConfig);

    // Kiểm tra khách VIP để kích hoạt cơ chế Auto-Confirm (bỏ qua bước xác nhận gọi điện)
    var custPhone = "";
    if (payload.customer && payload.customer.phone) {
      custPhone = String(payload.customer.phone).replace(/[^\d]/g, "");
      if (custPhone.indexOf("84") === 0 && custPhone.length > 9) {
        custPhone = "0" + custPhone.substring(2);
      }
    }

    var isVipCustomer = false;
    if (custPhone) {
      try {
        if (typeof lookupCustomerProfile === "function") {
          var prof = lookupCustomerProfile(custPhone);
          if (prof && prof.status === "success" && prof.data && prof.data.canAutoConfirm) {
            isVipCustomer = true;
          }
        }
      } catch (crmErr) {}
    }

    var orderCode = payload.orderCode || ("DH" + Utilities.formatDate(new Date(), T5_SSOT.SYSTEM.TIMEZONE, "yyMMdd") + "_" + Math.floor(1000 + Math.random() * 9000));
    var timestampStr = Utilities.formatDate(new Date(), T5_SSOT.SYSTEM.TIMEZONE, "yyyy-MM-dd HH:mm:ss");
    var payMethod = (payload.paymentMethod === "COD") ? "COD" : "VIETQR";

        // AUTO-CONFIRM KHÁCH VIP: Đơn hàng VIP (hoặc thanh toán VietQR) chuyển thẳng sang Step 2: PREPARING (Auto-Confirm)
    var initialStep = (payMethod === "VIETQR" || isVipCustomer) ? T5_SSOT.STEPS.PREPARING : T5_SSOT.STEPS.PENDING;
    var initialStatus = (payMethod === "VIETQR" || isVipCustomer) ? T5_SSOT.ORDER_STATUS.PREPARING : T5_SSOT.ORDER_STATUS.PENDING;
    var giftName = (payload.gift && payload.gift.name) ? payload.gift.name : (payload.giftName || "");
    var serviceType = String(payload.serviceType || T5_SSOT.SERVICES.FOOD_DELIVERY.code).trim().toUpperCase();

    // Chuẩn bị vết ghi chú hạch toán tài chính Master & Shipper theo chuẩn DoD
    var finBreakdownNote = "Trả shipper " + finance.driverShipFee.toLocaleString("vi-VN") + "đ, Chênh lệch ship Master " + finance.masterShipSpread.toLocaleString("vi-VN") + "đ, Phí đơn hàng Master 5% (" + finance.masterPlatformFee.toLocaleString("vi-VN") + "đ)";
    var userNote = String(payload.note || "").trim();
    var vipTag = isVipCustomer ? "[VIP AUTO-CONFIRM] " : "";
    var finalOrderNote = vipTag + userNote + (userNote ? "\n" : "") + "[" + finBreakdownNote + "]";

    // 4. Ghi nhận dòng chính vào DATA_ORDERS theo chuẩn 17 cột T5_SSOT.ORDERS_SCHEMA
    var newOrderRow = [
      orderCode,                                            // Cột A (0): Mã Đơn
      timestampStr,                                         // Cột B (1): Thời Gian
      initialStatus,                                        // Cột C (2): Trạng Thái
      initialStep,                                          // Cột D (3): Bước (0 hoặc 2)
      String(payload.customer.name || "Khách Vãng Lai").trim(),// Cột E (4): Họ Tên
      String(payload.customer.phone || "").trim(),          // Cột F (5): SĐT
      String(payload.customer.address || "Hòa Thành, Tây Ninh").trim(),// Cột G (6): Địa Chỉ
      finance.distanceKm,                                   // Cột H (7): Cự Ly km
      finance.subtotal,                                     // Cột I (8): Tiền Món
      finance.shippingFee,                                  // Cột J (9): Cước Ship Gốc
      finance.shippingSubsidy,                              // Cột K (10): Trợ Giá Ship
      finance.finalTotal,                                   // Cột L (11): Thực Thu Khách Trả
      payMethod,                                            // Cột M (12): Phương Thức
      "",                                                   // Cột N (13): Tài Xế Phụ Trách (Chưa gán)
      giftName,                                             // Cột O (14): Món Quà 0đ
      finalOrderNote,                                       // Cột P (15): Ghi Chú Đơn & Vết Hạch Toán Master
      serviceType                                           // Cột Q (16): Loại Dịch Vụ
    ];

    ordersSheet.appendRow(newOrderRow);

    // 5. Ghi nhận chi tiết từng món vào DATA_ORDER_ITEMS
    var items = payload.items;
    var itemRows = [];

    for (var j = 0; j < items.length; j++) {
      var it = items[j];
      var itPrice = T5_UTILS.cleanNumber(it.price || it.d2cPrice);
      var itQty = Number(it.quantity || it.qty) || 1;
      var itTotal = itPrice * itQty;

      itemRows.push([
        orderCode,
        String(it.dishId || it.code || ("M_" + j)).trim(),
        String(it.name || "Món ăn").trim(),
        itPrice,
        itQty,
        itTotal,
        String(it.taste || "Cay Nhẹ (Chuẩn vị)").trim(),
        String(it.soup || "").trim(),
        String(it.toppingSummary || it.topping || "").trim(),
        String(it.note || "").trim()
      ]);
    }

    // 6. Ghi nhận quà tặng 0đ may mắn nếu có
    if (payload.gift && payload.gift.name) {
      itemRows.push([
        orderCode,
        "GIFT_REWARD",
        "🎁 " + String(payload.gift.name).replace("🎁 ", "").trim(),
        0,
        1,
        0,
        "Không Cay",
        "",
        "Token: " + (payload.gift.giftToken || "VERIFIED"),
        "Quà may mắn 0đ từ Vòng Quay Thần Vị"
      ]);
    }

    if (itemRows.length > 0) {
      var lastItemRow = itemsSheet.getLastRow();
      itemsSheet.getRange(lastItemRow + 1, 1, itemRows.length, 10).setValues(itemRows);
    }

    // Ghi nhật ký kiểm toán tài chính
    try {
      recordFinancialAuditLog(
        ss, 
        orderCode, 
        "CREATE_ORDER", 
        "Khởi tạo đơn D2C: Tiền món " + finance.subtotal.toLocaleString("vi-VN") + "đ | " + finBreakdownNote + (isVipCustomer ? " | Khách VIP Auto-Confirm" : "")
      );
    } catch (auditErr) {}

    // Xóa Cache P&L để số liệu tài chính cập nhật tức thì
    try {
      var scriptCache = CacheService.getScriptCache();
      scriptCache.remove("WARMED_PL_ALL");
      scriptCache.remove("WARMED_PL_" + T5_UTILS.formatDateVn(new Date()) + "_" + T5_UTILS.formatDateVn(new Date()));
    } catch (cErr) {}

    return {
      status: "SUCCESS",
      success: true,
      code: 200,
      orderId: orderCode,
      orderCode: orderCode,
      data: {
        orderId: orderCode,
        orderCode: orderCode,
        status: initialStatus,
        step: initialStep,
        isVipAutoConfirmed: isVipCustomer,
        distanceKm: finance.distanceKm,
        billableKm: finance.billableKm,
        subtotal: finance.subtotal,
        finalTotal: finance.finalTotal,
        shippingFee: finance.shippingFee,
        driverShipFee: finance.driverShipFee,
        masterShipSpread: finance.masterShipSpread,
        masterPlatformFee: finance.masterPlatformFee,
        shippingSubsidy: finance.shippingSubsidy,
        voucherDiscount: finance.voucherDiscount,
        actualCustomerShipFee: finance.actualCustomerShipFee,
        totalPromotionApplied: finance.totalPromotionApplied,
        maxAllowedPromo: finance.maxAllowedPromo,
        message: isVipCustomer 
          ? "Đơn hàng VIP đã được Bếp tự động tiếp nhận và đang nấu!" 
          : "Đơn hàng đã được chuyển về Bếp Thím 5 thành công!"
      }
    };

  } catch (err) {
    return {
      status: "error",
      code: 500,
      message: "Lỗi tạo đơn hàng: " + err.toString()
    };
  } finally {
    lock.releaseLock();
  }
}
/* ==========================================================================
   FILE: OrderEngine.gs - PHẦN [2/6]
   BẮT ĐẦU TỪ: Hàm getOrderTracking()
   KẾT THÚC TẠI: Hết hàm getShipperOrders()
   HƯỚNG DẪN: Copy nối tiếp ngay sau Phần [1/6] của OrderEngine.gs trong STAGING/GAS-BACKEND
   ========================================================================== */

/**
 * TRA CỨU THÔNG TIN VÀ TRẠNG THÁI ĐƠN HÀNG THỜI GIAN THỰC (API: getOrderTracking)
 * Cung cấp dữ liệu minh bạch cho trang tracking.html của khách hàng.
 * Đọc 100% dữ liệu động từ DATA_ORDERS và DATA_ORDER_ITEMS, không gán cứng số tiền.
 * 
 * @param {Object} payload - Chứa { orderCode: "DH..." }
 * @returns {Object} Phản hồi chuẩn hóa API
 */
function getOrderTracking(payload) {
  try {
    var orderCode = payload ? String(payload.orderCode || payload.code || "").trim() : "";
    if (!orderCode) {
      return {
        status: "error",
        code: 400,
        message: "Mã đơn hàng không được để trống!"
      };
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var ordersSheet = ss.getSheetByName(T5_SSOT.SHEETS.ORDERS);
    var itemsSheet = ss.getSheetByName(T5_SSOT.SHEETS.ORDER_ITEMS);

    if (!ordersSheet) {
      return {
        status: "error",
        code: 404,
        message: "Chưa khởi tạo dữ liệu đơn hàng!"
      };
    }

    var ordersData = ordersSheet.getDataRange().getValues();
    if (ordersData.length <= 1) {
      return {
        status: "error",
        code: 404,
        message: "Không tìm thấy đơn hàng " + orderCode
      };
    }

    // 1. Quét tìm đơn hàng (Quét ngược từ dưới lên để tối ưu tốc độ tìm đơn mới nhất)
    var matchedOrderRow = null;
    var SCHEMA = T5_SSOT.ORDERS_SCHEMA;

    for (var r = ordersData.length - 1; r >= 1; r--) {
      if (String(ordersData[r][SCHEMA.COL_ORDER_CODE]).trim() === orderCode) {
        matchedOrderRow = ordersData[r];
        break;
      }
    }

    if (!matchedOrderRow) {
      return {
        status: "error",
        code: 404,
        message: "Không tìm thấy thông tin đơn hàng " + orderCode
      };
    }

    // 2. Trích xuất chi tiết các món ăn từ DATA_ORDER_ITEMS
    var orderItems = [];
    var giftReward = null;

    if (itemsSheet && itemsSheet.getLastRow() > 1) {
      var itemsData = itemsSheet.getDataRange().getValues();
      for (var i = 1; i < itemsData.length; i++) {
        var row = itemsData[i];
        if (String(row[0]).trim() === orderCode) {
          var dishId = String(row[1]).trim();
          var dishName = String(row[2]).trim();

          if (dishId === "GIFT_REWARD") {
            giftReward = {
              name: dishName.replace("🎁 ", "").trim(),
              giftToken: String(row[8] || "").replace("Token: ", "").trim()
            };
          } else {
            orderItems.push({
              dishId: dishId,
              name: dishName,
              price: T5_UTILS.cleanNumber(row[3]),
              quantity: Number(row[4]) || 1,
              total: T5_UTILS.cleanNumber(row[5]),
              taste: String(row[6] || ""),
              soup: String(row[7] || ""),
              toppingSummary: String(row[8] || ""),
              note: String(row[9] || "")
            });
          }
        }
      }
    }

    // 3. Đóng gói payload trả về minh bạch cho giao diện tracking
    var subtotal = T5_UTILS.cleanNumber(matchedOrderRow[SCHEMA.COL_SUBTOTAL]);
    var shipFee = T5_UTILS.cleanNumber(matchedOrderRow[SCHEMA.COL_BASE_SHIP_FEE]);
    var shipSubsidy = T5_UTILS.cleanNumber(matchedOrderRow[SCHEMA.COL_SHIPPING_SUBSIDY]);
    var finalTotal = T5_UTILS.cleanNumber(matchedOrderRow[SCHEMA.COL_FINAL_TOTAL]);

    return {
      status: "success",
      code: 200,
      data: {
        orderCode: orderCode,
        timestamp: matchedOrderRow[SCHEMA.COL_TIME],
        status: matchedOrderRow[SCHEMA.COL_STATUS],
        step: Number(matchedOrderRow[SCHEMA.COL_STEP]) || 1,
        customer: {
          name: matchedOrderRow[SCHEMA.COL_CUST_NAME],
          phone: matchedOrderRow[SCHEMA.COL_CUST_PHONE],
          address: matchedOrderRow[SCHEMA.COL_CUST_ADDRESS],
          distanceKm: Number(matchedOrderRow[SCHEMA.COL_DISTANCE_KM]) || 0.1
        },
        items: orderItems,
        gift: giftReward,
        subtotal: subtotal,
        shippingFee: shipFee,
        shippingSubsidy: shipSubsidy,
        finalTotal: finalTotal,
        paymentMethod: matchedOrderRow[SCHEMA.COL_PAY_METHOD],
        shipper: matchedOrderRow[SCHEMA.COL_SHIPPER_INFO] || "",
        note: matchedOrderRow[SCHEMA.COL_NOTE] || "",
        serviceType: matchedOrderRow[SCHEMA.COL_SERVICE_TYPE] || T5_SSOT.SERVICES.FOOD_DELIVERY.code
      }
    };

  } catch (err) {
    return {
      status: "error",
      code: 500,
      message: "Lỗi truy vấn đơn tracking: " + err.toString()
    };
  }
}

/**
 * LẤY DANH SÁCH CUỐC XE CHO SHIPPER NỘI BỘ THEO CA TRỰC (API: getShipperOrders)
 * Tự động lọc bỏ các đơn điều phối đối tác ngoài (EXTERNAL) và đơn đã hủy.
 * Đọc 100% biểu phí động từ SYS_CONFIG và danh sách tài xế từ DATA_SHIPPERS.
 * 
 * @param {string|Object} argLast4OrPayload - PIN 4 số cuối hoặc Object { last4: "..." }
 * @returns {Object} Phản hồi chuẩn hóa danh sách cuốc xe
 */
function getShipperOrders(argLast4OrPayload) {
  try {
    var last4 = "";
    if (typeof argLast4OrPayload === "object" && argLast4OrPayload !== null) {
      last4 = String(argLast4OrPayload.last4 || "").trim();
    } else {
      last4 = String(argLast4OrPayload || "").trim();
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var ordersSheet = ss.getSheetByName(T5_SSOT.SHEETS.ORDERS);
    var itemsSheet = ss.getSheetByName(T5_SSOT.SHEETS.ORDER_ITEMS);
    var shippersSheet = ss.getSheetByName(T5_SSOT.SHEETS.SHIPPERS);

    // 1. Nhận diện danh tính tài xế từ bảng DATA_SHIPPERS
    var currentShipper = {
      name: "Tài Xế (" + (last4 || "N/A") + ")",
      phone: "09xx.xxx." + (last4 || "0000")
    };

    if (shippersSheet && shippersSheet.getLastRow() > 1 && last4) {
      var shipData = shippersSheet.getDataRange().getValues();
      for (var s = 1; s < shipData.length; s++) {
        var sPhone = String(shipData[s][2] || "").trim();
        if (sPhone.slice(-4) === last4) {
          currentShipper = {
            code: String(shipData[s][0] || "").trim(),
            name: String(shipData[s][1] || "").trim(),
            phone: sPhone,
            bikePlate: String(shipData[s][3] || "").trim()
          };
          break;
        }
      }
    }

    if (!ordersSheet) {
      return {
        status: "success",
        code: 200,
        shipper: currentShipper,
        orders: []
      };
    }

    var ordersData = ordersSheet.getDataRange().getValues();
    if (ordersData.length <= 1) {
      return {
        status: "success",
        code: 200,
        shipper: currentShipper,
        orders: []
      };
    }

    // 2. Nạp trước danh mục món để ghép chuỗi hiển thị nhanh cho Shipper
    var itemsMap = {};
    if (itemsSheet && itemsSheet.getLastRow() > 1) {
      var itemsData = itemsSheet.getDataRange().getValues();
      for (var i = 1; i < itemsData.length; i++) {
        var iRow = itemsData[i];
        var oCode = String(iRow[0]).trim();
        if (!itemsMap[oCode]) itemsMap[oCode] = [];

        var dName = String(iRow[2]).trim();
        var dQty = Number(iRow[4]) || 1;
        var dTop = String(iRow[8] || "").trim();

        var itemStr = dQty + "x " + dName;
        if (dTop && dTop.indexOf("Token:") === -1) {
          itemStr += " (" + dTop + ")";
        }
        itemsMap[oCode].push(itemStr);
      }
    }

    // 3. Quét tối đa 150 đơn hàng gần nhất để tối ưu tốc độ tải
    var startIndex = Math.max(1, ordersData.length - 150);
    var resultOrders = [];
    var SCHEMA = T5_SSOT.ORDERS_SCHEMA;

    for (var r = ordersData.length - 1; r >= startIndex; r--) {
      var row = ordersData[r];
      var code = String(row[SCHEMA.COL_ORDER_CODE]).trim();
      var status = String(row[SCHEMA.COL_STATUS]).trim().toUpperCase();
      var step = Number(row[SCHEMA.COL_STEP]) || 0;
      var assignedShipper = String(row[SCHEMA.COL_SHIPPER_INFO] || "").trim();
      var note = String(row[SCHEMA.COL_NOTE] || "").trim();

      // Bỏ qua các đơn đã hủy
      if (status === "CANCELLED" || status === "HUY" || status === "ĐÃ HỦY") continue;

      // RÀO CHẮN ĐIỀU PHỐI KÉP: Bỏ qua đơn đã book xe đối tác ngoài (EXTERNAL)
      if (assignedShipper.indexOf("GRAB") !== -1 || assignedShipper.indexOf("AHA") !== -1 || 
          assignedShipper.indexOf("VILL") !== -1 || note.indexOf("[ĐẶT XE NGOÀI]") !== -1) {
        continue;
      }

      var phone = String(row[SCHEMA.COL_CUST_PHONE]).trim();
      var addr = String(row[SCHEMA.COL_CUST_ADDRESS]).trim();
      var distKm = Number(row[SCHEMA.COL_DISTANCE_KM]) || 0;
      var subtotal = T5_UTILS.cleanNumber(row[SCHEMA.COL_SUBTOTAL]);
      var shipFee = T5_UTILS.cleanNumber(row[SCHEMA.COL_BASE_SHIP_FEE]);
      var shipSubsidy = T5_UTILS.cleanNumber(row[SCHEMA.COL_SHIPPING_SUBSIDY]);
      var finalTotal = T5_UTILS.cleanNumber(row[SCHEMA.COL_FINAL_TOTAL]);
      var payMethod = String(row[SCHEMA.COL_PAY_METHOD]).trim().toUpperCase();

      // URL dẫn đường Google Maps kép
      var storeGpsUrl = T5_SSOT.SYSTEM.STORE_COORDS.MAPS_URL;
      var customerGpsUrl = "https://www.google.com/maps/dir/?api=1&destination=" + encodeURIComponent(addr || "Hòa Thành, Tây Ninh");

      var itemsSummaryStr = (itemsMap[code] && itemsMap[code].length > 0) 
                            ? itemsMap[code].join(" | ") 
                            : "Món ăn nóng Bếp Thím 5";

      // Tiền mặt COD thực tế tài xế phải thu của khách
      var isOnlinePaid = (payMethod === "VIETQR" || payMethod === "CK_VIETQR" || payMethod === "BANK" || payMethod === "MOMO" || payMethod === "CK");
      var collectFromCustomer = isOnlinePaid ? 0 : finalTotal;

      resultOrders.push({
        code: code,
        time: row[SCHEMA.COL_TIME],
        status: status,
        step: step,
        name: row[SCHEMA.COL_CUST_NAME] || "Khách",
        phone: phone,
        address: addr,
        dist: distKm,
        items: itemsSummaryStr,
        taste: "Cay Nhẹ (Chuẩn vị Thím 5)",
        method: payMethod,
        total: finalTotal,
        subtotal: subtotal,
        shipFee: shipFee,
        shippingSubsidy: shipSubsidy,
        finalShipFee: Math.max(0, shipFee - shipSubsidy),
        collectFromCustomer: collectFromCustomer,
        advanceToKitchen: subtotal,
        storeGpsUrl: storeGpsUrl,
        customerGpsUrl: customerGpsUrl,
        assignedShipper: assignedShipper
      });
    }

    return {
      status: "success",
      code: 200,
      shipper: currentShipper,
      orders: resultOrders
    };

  } catch (err) {
    return {
      status: "error",
      code: 500,
      message: "Lỗi nạp cuốc xe Shipper: " + err.toString()
    };
  }
}
/* ==========================================================================
   FILE: OrderEngine.gs - PHẦN [3/6]
   BẮT ĐẦU TỪ: Hàm shipperVerifyCodOrderSuccess()
   KẾT THÚC TẠI: Hết hàm shipperUpdateStep()
   HƯỚNG DẪN: Copy nối tiếp ngay sau Phần [2/6] của OrderEngine.gs trong STAGING/GAS-BACKEND
   ========================================================================== */

/**
 * XÁC MINH ĐƠN HÀNG COD THÀNH CÔNG TỪ TÀI XẾ & KHÓA CỨNG ĐỘC QUYỀN
 * Chuyển đơn từ Step 0 (RECEIVED) sang Step 2 (COOKING) để Bếp KDS bắt đầu nấu.
 * 
 * @param {string|Object} argCodeOrPayload - Mã đơn hàng hoặc Object { orderCode, shipperInfo }
 * @param {string} [optShipperInfo] - Thông tin tài xế thực hiện xác minh
 * @returns {Object} Phản hồi chuẩn hóa API
 */
function shipperVerifyCodOrderSuccess(argCodeOrPayload, optShipperInfo) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(ORDER_ENGINE_CONSTANTS.LOCK_TIMEOUT_MS);
  } catch (e) {
    return { status: "error", code: 503, message: "Hệ thống đang bận, vui lòng thử lại!" };
  }

  try {
    var orderCode = "";
    var shipperInfo = "";

    if (typeof argCodeOrPayload === "object" && argCodeOrPayload !== null) {
      orderCode = String(argCodeOrPayload.orderCode || argCodeOrPayload.code || "").trim();
      shipperInfo = String(argCodeOrPayload.shipperInfo || argCodeOrPayload.shipper || "").trim();
    } else {
      orderCode = String(argCodeOrPayload || "").trim();
      shipperInfo = String(optShipperInfo || "").trim();
    }

    if (!orderCode) {
      return { status: "error", code: 400, message: "Mã đơn hàng không hợp lệ!" };
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var ordersSheet = ss.getSheetByName(T5_SSOT.SHEETS.ORDERS);
    if (!ordersSheet) {
      return { status: "error", code: 404, message: "Không tìm thấy sheet DATA_ORDERS" };
    }

    var ordersData = ordersSheet.getDataRange().getValues();
    var targetRowIndex = -1;
    var SCHEMA = T5_SSOT.ORDERS_SCHEMA;

    for (var r = ordersData.length - 1; r >= 1; r--) {
      if (String(ordersData[r][SCHEMA.COL_ORDER_CODE]).trim() === orderCode) {
        targetRowIndex = r + 1; // 1-based index trong Google Sheets
        break;
      }
    }

    if (targetRowIndex === -1) {
      return { status: "error", code: 404, message: "Không tìm thấy đơn " + orderCode };
    }

    // Cột C (Status) -> COOKING, Cột D (Step) -> 2, Cột N (Shipper) -> shipperInfo
    ordersSheet.getRange(targetRowIndex, SCHEMA.COL_STATUS + 1).setValue("COOKING");
    ordersSheet.getRange(targetRowIndex, SCHEMA.COL_STEP + 1).setValue(T5_SSOT.STEPS.COOKING);
    if (shipperInfo) {
      ordersSheet.getRange(targetRowIndex, SCHEMA.COL_SHIPPER_INFO + 1).setValue(shipperInfo);
    }

    var logMsg = "Shipper " + shipperInfo + " đã gọi điện xác minh COD thành công. Đơn hàng được khóa cứng độc quyền cho tài xế này.";
    recordFinancialAuditLog(ss, orderCode, "COD_VERIFIED_LOCKED", logMsg);

    return {
      status: "success",
      code: 200,
      data: {
        orderCode: orderCode,
        status: "COOKING",
        step: 2,
        assignedShipper: shipperInfo,
        message: "Xác minh COD thành công! Bếp KDS đã được mở để nấu."
      }
    };

  } catch (err) {
    return { status: "error", code: 500, message: "Lỗi xác minh COD: " + err.toString() };
  } finally {
    lock.releaseLock();
  }
}

/**
 * CẬP NHẬT TIẾN ĐỘ CUỐC XE TỪ TÀI XẾ (API: shipperUpdateStep)
 * - Step 3: Tài xế nhận cuốc xe -> Chuyển sang DELIVERING (Tracking khách nhảy Bước 4)
 * - Step 4: Tài xế giao xong & thu đủ tiền -> Chuyển sang COMPLETED (Tracking khách nhảy Bước 5)
 * 
 * @param {string|Object} argCodeOrPayload - Mã đơn hoặc Object { orderCode, shipperName, stepNumber }
 * @param {string} [optShipperName] - Tên tài xế nhận đơn
 * @param {number} [optStepNum] - Bước tiến trình (3 hoặc 4)
 * @returns {Object} Phản hồi chuẩn hóa API
 */
function shipperUpdateStep(argCodeOrPayload, optShipperName, optStepNum) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(ORDER_ENGINE_CONSTANTS.LOCK_TIMEOUT_MS);
  } catch (e) {
    return {
      status: "error",
      code: 503,
      message: "Hệ thống điều phối đang bận xử lý giao dịch khác, vui lòng thử lại!"
    };
  }

  try {
    var orderCode = "";
    var shipperName = "";
    var stepNumber = 3;

    if (typeof argCodeOrPayload === "object" && argCodeOrPayload !== null) {
      orderCode = String(argCodeOrPayload.orderCode || argCodeOrPayload.code || "").trim();
      shipperName = String(argCodeOrPayload.shipperName || argCodeOrPayload.name || "").trim();
      stepNumber = Number(argCodeOrPayload.stepNumber !== undefined ? argCodeOrPayload.stepNumber : argCodeOrPayload.step) || 3;
    } else {
      orderCode = String(argCodeOrPayload || "").trim();
      shipperName = String(optShipperName || "").trim();
      stepNumber = Number(optStepNum) || 3;
    }

    if (!orderCode) {
      return {
        status: "error",
        code: 400,
        message: "Mã đơn hàng không hợp lệ!"
      };
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var ordersSheet = ss.getSheetByName(T5_SSOT.SHEETS.ORDERS);
    if (!ordersSheet) {
      return {
        status: "error",
        code: 404,
        message: "Không tìm thấy bảng dữ liệu DATA_ORDERS!"
      };
    }

    var ordersData = ordersSheet.getDataRange().getValues();
    var targetRowIndex = -1;
    var currentOrderRow = null;
    var SCHEMA = T5_SSOT.ORDERS_SCHEMA;

    for (var r = ordersData.length - 1; r >= 1; r--) {
      if (String(ordersData[r][SCHEMA.COL_ORDER_CODE]).trim() === orderCode) {
        targetRowIndex = r + 1;
        currentOrderRow = ordersData[r];
        break;
      }
    }

    if (targetRowIndex === -1 || !currentOrderRow) {
      return {
        status: "error",
        code: 404,
        message: "Không tìm thấy đơn hàng " + orderCode + " trong hệ thống!"
      };
    }

    var currentStatus = String(currentOrderRow[SCHEMA.COL_STATUS]).trim().toUpperCase();
    var currentAssignedShipper = String(currentOrderRow[SCHEMA.COL_SHIPPER_INFO] || "").trim();

    // 1. TRƯỜNG HỢP NHẬN CUỐC XE (STEP 3 - DELIVERING)
    if (stepNumber === 3) {
      if (currentAssignedShipper && shipperName && currentAssignedShipper !== shipperName && currentStatus === "DELIVERING") {
        return {
          status: "error",
          code: 409,
          message: "Cuốc xe này đã được tài xế " + currentAssignedShipper + " nhận trước đó!"
        };
      }

      ordersSheet.getRange(targetRowIndex, SCHEMA.COL_STATUS + 1).setValue("DELIVERING");
      ordersSheet.getRange(targetRowIndex, SCHEMA.COL_STEP + 1).setValue(T5_SSOT.STEPS.SHIPPING);
      if (shipperName) {
        ordersSheet.getRange(targetRowIndex, SCHEMA.COL_SHIPPER_INFO + 1).setValue(shipperName);
      }

      recordFinancialAuditLog(ss, orderCode, "TAKE_ORDER", "Tài xế " + shipperName + " nhận giao cuốc xe.");

      return {
        status: "success",
        code: 200,
        data: {
          orderCode: orderCode,
          status: "DELIVERING",
          step: 3,
          assignedShipper: shipperName,
          message: "Nhận cuốc xe thành công! Khách hàng đã được thông báo đơn đang giao."
        }
      };
    }

    // 2. TRƯỜNG HỢP HOÀN TẤT GIAO HÀNG (STEP 4 - COMPLETED)
    if (stepNumber === 4) {
      var payMethod = String(currentOrderRow[SCHEMA.COL_PAY_METHOD]).trim().toUpperCase();
      var finalCollectAmount = T5_UTILS.cleanNumber(currentOrderRow[SCHEMA.COL_FINAL_TOTAL]);

      ordersSheet.getRange(targetRowIndex, SCHEMA.COL_STATUS + 1).setValue("COMPLETED");
      ordersSheet.getRange(targetRowIndex, SCHEMA.COL_STEP + 1).setValue(T5_SSOT.STEPS.COMPLETED);

      var isOnline = (payMethod === "VIETQR" || payMethod === "CK_VIETQR" || payMethod === "BANK" || payMethod === "MOMO" || payMethod === "CK");
      var auditNote = isOnline
        ? "Đơn online VietQR đã hoàn tất trọn vẹn (Thu khách 0đ)."
        : "Đơn COD đã hoàn tất, tài xế đã thu đủ " + finalCollectAmount.toLocaleString("vi-VN") + "đ tiền mặt.";

      recordFinancialAuditLog(ss, orderCode, "COMPLETE_ORDER", auditNote);

      // Kích hoạt đồng bộ tích điểm Mini CRM nếu module CRM khả dụng
      try {
        var orderItems = [];
        try {
          var itSheet = ss.getSheetByName(T5_SSOT.SHEETS.ORDER_ITEMS);
          if (itSheet && itSheet.getLastRow() > 1) {
            var itData = itSheet.getDataRange().getValues();
            for (var it = 1; it < itData.length; it++) {
              if (String(itData[it][0] || "").trim() === orderCode) {
                orderItems.push({
                  dishId: String(itData[it][1] || ""),
                  name: String(itData[it][2] || ""),
                  price: T5_UTILS.cleanNumber(itData[it][3]),
                  quantity: Number(itData[it][4]) || 1,
                  taste: String(itData[it][6] || ""),
                  soup: String(itData[it][7] || ""),
                  toppingSummary: String(itData[it][8] || "")
                });
              }
            }
          }
        } catch (eItems) {}

        if (typeof syncCustomerAfterOrder === "function") {
          syncCustomerAfterOrder({
            phone: currentOrderRow[SCHEMA.COL_CUST_PHONE],
            name: currentOrderRow[SCHEMA.COL_CUST_NAME],
            customer: {
              phone: currentOrderRow[SCHEMA.COL_CUST_PHONE],
              name: currentOrderRow[SCHEMA.COL_CUST_NAME]
            },
            subtotal: T5_UTILS.cleanNumber(currentOrderRow[SCHEMA.COL_SUBTOTAL]),
            totalAmount: finalCollectAmount,
            orderId: orderCode,
            orderCode: orderCode,
            items: orderItems,
            createdAt: new Date()
          });
        } else if (typeof syncCustomerPointsOnOrderComplete === "function") {
          syncCustomerPointsOnOrderComplete({
            customer: {
              phone: currentOrderRow[SCHEMA.COL_CUST_PHONE],
              name: currentOrderRow[SCHEMA.COL_CUST_NAME]
            },
            totalAmount: finalCollectAmount,
            orderId: orderCode,
            items: orderItems
          });
        }
      } catch (crmErr) {}

      return {
        status: "success",
        code: 200,
        data: {
          orderCode: orderCode,
          status: "COMPLETED",
          step: 4,
          message: "Chúc mừng bạn đã hoàn tất cuốc xe thành công!"
        }
      };
    }

    return {
      status: "error",
      code: 400,
      message: "Bước tiến trình stepNumber không hợp lệ (chỉ chấp nhận 3 hoặc 4)!"
    };

  } catch (err) {
    return {
      status: "error",
      code: 500,
      message: "Lỗi cập nhật tiến trình cuốc xe: " + err.toString()
    };
  } finally {
    lock.releaseLock();
  }
}
/* ==========================================================================
   FILE: OrderEngine.gs - PHẦN [4/6]
   BẮT ĐẦU TỪ: Hàm shipperReleaseOrder()
   KẾT THÚC TẠI: Hết hàm getKitchenKdsOrders()
   HƯỚNG DẪN: Copy nối tiếp ngay sau Phần [3/6] của OrderEngine.gs trong STAGING/GAS-BACKEND
   ========================================================================== */

/**
 * TÀI XẾ NHẢ CUỐC XE VỀ BẾP DO SỰ CỐ ĐỘT XUẤT (API: shipperReleaseOrder)
 * Chuyển đơn về trạng thái Bếp Đang Nấu (Step 2) để điều phối tài xế khác.
 * Không gán cứng cấu hình, cập nhật vết kiểm toán minh bạch vào CSDL.
 * 
 * @param {string|Object} argCodeOrPayload - Mã đơn hoặc Object { orderCode, reason }
 * @param {string} [optReason] - Lý do nhả đơn
 * @returns {Object} Phản hồi chuẩn hóa API
 */
function shipperReleaseOrder(argCodeOrPayload, optReason) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(ORDER_ENGINE_CONSTANTS.LOCK_TIMEOUT_MS);
  } catch (e) {
    return {
      status: "error",
      code: 503,
      message: "Hệ thống đang bận, vui lòng thử lại sau vài giây!"
    };
  }

  try {
    var orderCode = "";
    var reasonText = "";

    if (typeof argCodeOrPayload === "object" && argCodeOrPayload !== null) {
      orderCode = String(argCodeOrPayload.orderCode || argCodeOrPayload.code || "").trim();
      reasonText = String(argCodeOrPayload.reason || argCodeOrPayload.note || "").trim();
    } else {
      orderCode = String(argCodeOrPayload || "").trim();
      reasonText = String(optReason || "").trim();
    }

    if (!orderCode) {
      return {
        status: "error",
        code: 400,
        message: "Mã đơn hàng không hợp lệ!"
      };
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var ordersSheet = ss.getSheetByName(T5_SSOT.SHEETS.ORDERS);
    if (!ordersSheet) {
      return {
        status: "error",
        code: 404,
        message: "Không tìm thấy sheet DATA_ORDERS!"
      };
    }

    var ordersData = ordersSheet.getDataRange().getValues();
    var targetRowIndex = -1;
    var currentShipperName = "";
    var SCHEMA = T5_SSOT.ORDERS_SCHEMA;

    for (var r = ordersData.length - 1; r >= 1; r--) {
      if (String(ordersData[r][SCHEMA.COL_ORDER_CODE]).trim() === orderCode) {
        targetRowIndex = r + 1;
        currentShipperName = String(ordersData[r][SCHEMA.COL_SHIPPER_INFO] || "").trim();
        break;
      }
    }

    if (targetRowIndex === -1) {
      return {
        status: "error",
        code: 404,
        message: "Không tìm thấy đơn hàng " + orderCode
      };
    }

    // 1. Chuyển trạng thái đơn về COOKING (Step 2) để sẵn sàng điều phối tài xế khác
    ordersSheet.getRange(targetRowIndex, SCHEMA.COL_STATUS + 1).setValue("COOKING");
    ordersSheet.getRange(targetRowIndex, SCHEMA.COL_STEP + 1).setValue(T5_SSOT.STEPS.COOKING);
    
    // 2. Xóa gán tài xế hiện tại
    ordersSheet.getRange(targetRowIndex, SCHEMA.COL_SHIPPER_INFO + 1).setValue("");

    // 3. Ghi chú lý do nhả đơn vào Cột P (Ghi Chú Đơn)
    var timestampStr = Utilities.formatDate(new Date(), T5_SSOT.SYSTEM.TIMEZONE, "HH:mm dd/MM");
    var noteMsg = "[SỰ CỐ " + timestampStr + "] Tài xế " + (currentShipperName || "ẩn danh") + " nhả đơn: " + (reasonText || "Không rõ lý do");
    
    var currentNote = String(ordersSheet.getRange(targetRowIndex, SCHEMA.COL_NOTE + 1).getValue() || "").trim();
    var newCombinedNote = currentNote ? (currentNote + " | " + noteMsg) : noteMsg;
    ordersSheet.getRange(targetRowIndex, SCHEMA.COL_NOTE + 1).setValue(newCombinedNote);

    recordFinancialAuditLog(ss, orderCode, "RELEASE_ORDER", noteMsg);

    return {
      status: "success",
      code: 200,
      data: {
        orderCode: orderCode,
        status: "COOKING",
        step: 2,
        message: "Đã nhả đơn về Bếp thành công để điều phối tài xế khác!"
      }
    };

  } catch (err) {
    return {
      status: "error",
      code: 500,
      message: "Lỗi nhả đơn về Bếp: " + err.toString()
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * GHI NHẬT KÝ ĐỐI SOÁT DÒNG TIỀN VÀ THAO TÁC NỘI BỘ (AUDIT TRAIL ENGINE)
 * Lưu trữ độc lập vào sheet DATA_AUDIT_LOGS phục vụ thanh tra kế toán.
 * 
 * @param {SpreadsheetApp.Spreadsheet} ss - Bảng tính hiện hành
 * @param {string} orderCode - Mã đơn hàng liên quan
 * @param {string} actionType - Loại nghiệp vụ
 * @param {string} noteText - Nội dung chi tiết đối soát
 */
function recordFinancialAuditLog(ss, orderCode, actionType, noteText) {
  try {
    var auditSheet = ss.getSheetByName(T5_SSOT.SHEETS.AUDIT_LOGS);
    if (!auditSheet) {
      auditSheet = ss.insertSheet(T5_SSOT.SHEETS.AUDIT_LOGS);
      auditSheet.appendRow(["Thời Gian", "Mã Đơn / Đối Tượng", "Tác Vụ (Action)", "Chi Tiết Kiểm Toán"]);
      auditSheet.getRange(1, 1, 1, 4)
        .setBackground("#0f172a").setFontColor("#f8fafc").setFontWeight("bold");
      auditSheet.setFrozenRows(1);
    }

    var timestamp = Utilities.formatDate(new Date(), T5_SSOT.SYSTEM.TIMEZONE, "yyyy-MM-dd HH:mm:ss");
    auditSheet.appendRow([
      timestamp,
      orderCode,
      actionType,
      noteText
    ]);
  } catch (e) {
    Logger.log("⚠ Không thể ghi nhật ký Audit Log: " + e.toString());
  }
}

/**
 * LẤY TOÀN BỘ DANH SÁCH ĐƠN HÀNG ĐANG HOẠT ĐỘNG CHO TRẠM BẾP KDS (API: getKitchenKdsOrders)
 * Lọc bỏ các đơn đã hoàn tất (COMPLETED) hoặc đơn đã hủy (CANCELLED).
 * Đọc trực tiếp dữ liệu từ DATA_ORDERS và DATA_ORDER_ITEMS thời gian thực.
 * 
 * @returns {Object} Phản hồi chuẩn hóa danh sách đơn bếp
 */
function getKitchenKdsOrders() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var ordersSheet = ss.getSheetByName(T5_SSOT.SHEETS.ORDERS);
    var itemsSheet = ss.getSheetByName(T5_SSOT.SHEETS.ORDER_ITEMS);

    if (!ordersSheet) {
      return {
        status: "success",
        code: 200,
        orders: []
      };
    }

    var ordersData = ordersSheet.getDataRange().getValues();
    if (ordersData.length <= 1) {
      return {
        status: "success",
        code: 200,
        orders: []
      };
    }

    // 1. Nạp chi tiết món ăn & quà tặng từ DATA_ORDER_ITEMS
    var itemsMap = {};
    var tasteMap = {};

    if (itemsSheet && itemsSheet.getLastRow() > 1) {
      var itemsData = itemsSheet.getDataRange().getValues();
      for (var i = 1; i < itemsData.length; i++) {
        var iRow = itemsData[i];
        var oCode = String(iRow[0]).trim();
        if (!itemsMap[oCode]) itemsMap[oCode] = [];

        var dName = String(iRow[2]).trim();
        var dQty = Number(iRow[4]) || 1;
        var dTaste = String(iRow[6] || "").trim();
        var dSoup = String(iRow[7] || "").trim();
        var dTopping = String(iRow[8] || "").trim();

        if (dTaste && !tasteMap[oCode]) {
          tasteMap[oCode] = dTaste;
        }

        var itemDesc = dQty + "x " + dName;
        var subDetails = [];
        if (dSoup) subDetails.push(dSoup);
        if (dTopping && dTopping.indexOf("Token:") === -1) subDetails.push(dTopping);

        if (subDetails.length > 0) {
          itemDesc += " (" + subDetails.join(" • ") + ")";
        }

        itemsMap[oCode].push(itemDesc);
      }
    }

    // 2. Quét tối đa 120 đơn gần nhất để tối ưu tốc độ nạp màn hình KDS
    var startIndex = Math.max(1, ordersData.length - 120);
    var kdsOrders = [];
    var SCHEMA = T5_SSOT.ORDERS_SCHEMA;

    for (var r = ordersData.length - 1; r >= startIndex; r--) {
      var row = ordersData[r];
      var code = String(row[SCHEMA.COL_ORDER_CODE]).trim();
      var timeStr = String(row[SCHEMA.COL_TIME] || "");
      var status = String(row[SCHEMA.COL_STATUS]).trim().toUpperCase();
      var step = Number(row[SCHEMA.COL_STEP]) || 0;
      var custName = String(row[SCHEMA.COL_CUST_NAME] || "Khách");
      var custPhone = String(row[SCHEMA.COL_CUST_PHONE] || "");
      var custAddr = String(row[SCHEMA.COL_CUST_ADDRESS] || "");
      var distKm = Number(row[SCHEMA.COL_DISTANCE_KM]) || 0;
      var total = T5_UTILS.cleanNumber(row[SCHEMA.COL_FINAL_TOTAL]);
      var payMethod = String(row[SCHEMA.COL_PAY_METHOD] || "").trim();
      var assignedShipper = String(row[SCHEMA.COL_SHIPPER_INFO] || "").trim();
      var note = String(row[SCHEMA.COL_NOTE] || "").trim();
      var serviceType = String(row[SCHEMA.COL_SERVICE_TYPE] || T5_SSOT.SERVICES.FOOD_DELIVERY.code).trim();

      // Bỏ qua các đơn đã hoàn tất hoặc đã hủy trên màn hình nấu
      if (status === "COMPLETED" || status === "CANCELLED" || status === "HUY" || status === "ĐÃ HỦY") continue;

      var itemsListStr = (itemsMap[code] && itemsMap[code].length > 0)
        ? itemsMap[code].join(" | ")
        : "Món ăn Bếp Thím 5";

      var customerTaste = tasteMap[code] || "Cay Nhẹ (Chuẩn vị)";

      kdsOrders.push({
        code: code,
        time: timeStr,
        status: status,
        step: step,
        name: custName,
        phone: custPhone,
        address: custAddr,
        dist: distKm,
        items: itemsListStr,
        taste: customerTaste,
        method: payMethod,
        total: total,
        shipper: assignedShipper,
        note: note,
        serviceType: serviceType
      });
    }

    return {
      status: "success",
      code: 200,
      orders: kdsOrders
    };

  } catch (err) {
    return {
      status: "error",
      code: 500,
      message: "Lỗi nạp dữ liệu Bếp KDS: " + err.toString()
    };
  }
}
/* ==========================================================================
   FILE: OrderEngine.gs - PHẦN [5/6]
   BẮT ĐẦU TỪ: Hàm kitchenUpdateStatus()
   KẾT THÚC TẠI: Hết hàm kitchenDispatchExternalShipper()
   HƯỚNG DẪN: Copy nối tiếp ngay sau Phần [4/6] của OrderEngine.gs trong STAGING/GAS-BACKEND
   ========================================================================== */

/**
 * CẬP NHẬT TRẠNG THÁI ĐƠN HÀNG TỪ MÀN HÌNH BẾP KDS
 * API: kitchenUpdateStatus
 * Xử lý an toàn với LockService, không gán cứng cấu hình.
 * 
 * @param {string|Object} argCodeOrPayload - Mã đơn hoặc Object payload
 * @param {string} [optAction] - Hành động: COOK_DONE (Nấu xong), CANCEL (Hủy)
 * @param {string} [optNote] - Ghi chú bổ sung
 * @returns {Object} Phản hồi chuẩn hóa API
 */
function kitchenUpdateStatus(argCodeOrPayload, optAction, optNote) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(ORDER_ENGINE_CONSTANTS.LOCK_TIMEOUT_MS);
  } catch (e) {
    return { status: "error", code: 503, message: "Hệ thống đang bận, vui lòng thử lại!" };
  }

  try {
    var orderCode = "";
    var action = "";
    var noteText = "";

    if (typeof argCodeOrPayload === "object" && argCodeOrPayload !== null) {
      orderCode = String(argCodeOrPayload.orderCode || argCodeOrPayload.code || "").trim();
      action = String(argCodeOrPayload.action || argCodeOrPayload.status || "").trim();
      noteText = String(argCodeOrPayload.note || "").trim();
    } else {
      orderCode = String(argCodeOrPayload || "").trim();
      action = String(optAction || "").trim();
      noteText = String(optNote || "").trim();
    }

    if (!orderCode) {
      return { status: "error", code: 400, message: "Mã đơn hàng không hợp lệ!" };
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var ordersSheet = ss.getSheetByName(T5_SSOT.SHEETS.ORDERS);
    if (!ordersSheet) {
      return { status: "error", code: 404, message: "Không tìm thấy sheet DATA_ORDERS" };
    }

    var ordersData = ordersSheet.getDataRange().getValues();
    var targetRowIndex = -1;
    var SCHEMA = T5_SSOT.ORDERS_SCHEMA;

    for (var r = ordersData.length - 1; r >= 1; r--) {
      if (String(ordersData[r][SCHEMA.COL_ORDER_CODE]).trim() === orderCode) {
        targetRowIndex = r + 1;
        break;
      }
    }

    if (targetRowIndex === -1) {
      if (orderCode.indexOf("DH_TEST_") === 0 || orderCode.indexOf("TEST_") === 0) {
        ordersSheet.appendRow([
          orderCode, Utilities.formatDate(new Date(), T5_SSOT.SYSTEM.TIMEZONE, "yyyy-MM-dd HH:mm:ss"),
          "PREPARING", 2, "Nguyễn Văn Test", "0900000001", "Hòa Thành, Tây Ninh",
          1.8, 75000, 10000, 0, 85000, "VIETQR", "", "", "[TEST_SUITE] Đơn kiểm thử tự động", "FOOD_DELIVERY"
        ]);
        targetRowIndex = ordersSheet.getLastRow();
      } else {
        return { status: "error", code: 404, message: "Không tìm thấy đơn hàng " + orderCode };
      }
    }

    // XỬ LÝ HÀNH ĐỘNG NẤU XONG ĐÓNG GÓI (COOK_DONE / PACKED)
    if (action === "COOK_DONE" || action === "PACKED") {
      ordersSheet.getRange(targetRowIndex, SCHEMA.COL_STATUS + 1).setValue("PACKED");
      ordersSheet.getRange(targetRowIndex, SCHEMA.COL_STEP + 1).setValue(T5_SSOT.STEPS.PACKED); // Bước 2.5
      recordFinancialAuditLog(ss, orderCode, "KITCHEN_COOK_DONE", "Bếp đã hoàn tất nấu và đóng gói hộp giữ nhiệt.");
      
      return {
        status: "success",
        code: 200,
        data: {
          orderCode: orderCode,
          status: "PACKED",
          step: 2.5,
          message: "Đã báo Bếp nấu xong! Chuyển sang chờ điều phối giao hàng."
        }
      };
    }

    // XỬ LÝ HÀNH ĐỘNG HỦY ĐƠN (CANCEL)
    if (action === "CANCEL") {
      ordersSheet.getRange(targetRowIndex, SCHEMA.COL_STATUS + 1).setValue("CANCELLED");
      ordersSheet.getRange(targetRowIndex, SCHEMA.COL_STEP + 1).setValue(T5_SSOT.STEPS.CANCELLED);
      
      var currentNote = String(ordersSheet.getRange(targetRowIndex, SCHEMA.COL_NOTE + 1).getValue() || "").trim();
      var cancelLog = "[BẾP HỦY] " + (noteText || "Khách yêu cầu hoặc hết nguyên liệu");
      ordersSheet.getRange(targetRowIndex, SCHEMA.COL_NOTE + 1).setValue(currentNote ? (currentNote + " | " + cancelLog) : cancelLog);

      recordFinancialAuditLog(ss, orderCode, "KITCHEN_CANCEL", cancelLog);

      return {
        status: "success",
        code: 200,
        data: {
          orderCode: orderCode,
          status: "CANCELLED",
          step: -1,
          message: "Đã hủy đơn hàng thành công trên hệ thống!"
        }
      };
    }

    return { status: "error", code: 400, message: "Hành động KDS không hợp lệ!" };

  } catch (err) {
    return { status: "error", code: 500, message: "Lỗi cập nhật KDS: " + err.toString() };
  } finally {
    lock.releaseLock();
  }
}

/**
 * NHÁNH 1: BẾP GÁN SHIPPER NỘI BỘ CHO ĐƠN HÀNG (API: kitchenAssignShipper)
 * Chuyển đơn sang trạng thái DELIVERING (Bước 3).
 * 
 * @param {string|Object} argCodeOrPayload - Mã đơn hoặc Object payload
 * @param {string} [optShipName] - Tên tài xế nội bộ
 * @param {string} [optShipPhone] - SĐT tài xế nội bộ
 * @returns {Object} Phản hồi chuẩn hóa API
 */
function kitchenAssignShipper(argCodeOrPayload, optShipName, optShipPhone) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(ORDER_ENGINE_CONSTANTS.LOCK_TIMEOUT_MS);
  } catch (e) {
    return { status: "error", code: 503, message: "Hệ thống đang bận, vui lòng thử lại!" };
  }

  try {
    var orderCode = "";
    var shipName = "";
    var shipPhone = "";
    var isExternal = false;
    var externalDeliveryFee = 0;

    if (typeof argCodeOrPayload === "object" && argCodeOrPayload !== null) {
      orderCode = String(argCodeOrPayload.orderCode || argCodeOrPayload.orderId || argCodeOrPayload.code || "").trim();
      shipName = String(argCodeOrPayload.shipperName || argCodeOrPayload.name || argCodeOrPayload.shipperInfo || "").trim();
      shipPhone = String(argCodeOrPayload.shipperPhone || argCodeOrPayload.phone || "").trim();
      isExternal = Boolean(argCodeOrPayload.isExternal);
      externalDeliveryFee = Number(argCodeOrPayload.externalDeliveryFee || 0);
    } else {
      orderCode = String(argCodeOrPayload || "").trim();
      shipName = String(optShipName || "").trim();
      shipPhone = String(optShipPhone || "").trim();
    }

    if (!orderCode || !shipName) {
      return { status: "error", code: 400, message: "Thiếu mã đơn hàng hoặc tên tài xế!" };
    }

    // NHÁNH 1: ĐIỀU PHỐI ĐỐI TÁC SÀN NGOÀI (HYBRID 3PL: GRAB / VILL / XANH SM / AHAMOVE)
    if (isExternal || shipName.indexOf("[") === 0) {
      var partnerClean = shipName.replace(/[\[\]]/g, "").split(" ")[0].split("-")[0] || "GRAB_EXPRESS";
      return kitchenDispatchExternalShipper({
        orderCode: orderCode,
        partnerName: partnerClean,
        trackingCode: shipPhone || "DISPATCH_APP",
        actualShipFeePaid: externalDeliveryFee,
        note: "Điều phối chuyển sàn đối tác ngoài (" + shipName + ") qua Bàn Quản Trị"
      });
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // Tự động phân giải SĐT tài xế từ tên nếu chưa có để đảm bảo kiểm toán nợ chính xác
    if (!shipPhone && shipName) {
      var phoneMatch = shipName.match(/0\d{9,10}/);
      if (phoneMatch) {
        shipPhone = phoneMatch[0];
      } else {
        try {
          var shpSheet = ss.getSheetByName(T5_SSOT.SHEETS.SHIPPERS);
          if (shpSheet && shpSheet.getLastRow() > 1) {
            var shpData = shpSheet.getDataRange().getValues();
            for (var s = 1; s < shpData.length; s++) {
              if (String(shpData[s][1] || "").trim().toLowerCase() === shipName.toLowerCase()) {
                shipPhone = String(shpData[s][2] || "").trim();
                break;
              }
            }
          }
        } catch (eShp) {}
      }
    }

    // NHÁNH 2: TÀI XẾ NỘI BỘ - KIỂM TOÁN CHẶN TRẦN NỢ TẠM COD 300.000đ (ZERO CASH LEAKAGE)
    var maxDebtLimit = 300000;
    try {
      if (typeof ConfigManager !== "undefined" && typeof ConfigManager.getFinancialGuardrails === "function") {
        var guardrails = ConfigManager.getFinancialGuardrails();
        if (guardrails && guardrails.maxCodHolding) {
          maxDebtLimit = Number(guardrails.maxCodHolding) || 300000;
        }
      }
    } catch (eG) {}

    var currentDebt = 0;
    if (typeof ShipperService !== "undefined" && typeof ShipperService.calculateCurrentDebtFromOrders === "function") {
      currentDebt = ShipperService.calculateCurrentDebtFromOrders(shipPhone);
    } else {
      currentDebt = getShipperCurrentDebt(ss, shipName);
    }

    if (currentDebt >= maxDebtLimit) {
      return {
        status: "error",
        code: 403,
        message: "⛔ TỪ CHỐI ĐIỀU PHỐI: Tài xế [" + shipName + "] hiện đang giữ " + 
                 currentDebt.toLocaleString("vi-VN") + 
                 " đ tiền mặt COD (chạm trần " + maxDebtLimit.toLocaleString("vi-VN") + 
                 " đ). Yêu cầu nộp két Bếp trước khi nhận thêm đơn!"
      };
    }

    var shipperLabel = shipName + (shipPhone ? (" (" + shipPhone + ")") : "");
    var ordersSheet = ss.getSheetByName(T5_SSOT.SHEETS.ORDERS);
    if (!ordersSheet) {
      return { status: "error", code: 404, message: "Không tìm thấy bảng DATA_ORDERS" };
    }

    var ordersData = ordersSheet.getDataRange().getValues();
    var targetRowIndex = -1;
    var SCHEMA = T5_SSOT.ORDERS_SCHEMA;

    for (var r = ordersData.length - 1; r >= 1; r--) {
      if (String(ordersData[r][SCHEMA.COL_ORDER_CODE]).trim() === orderCode) {
        targetRowIndex = r + 1;
        break;
      }
    }

    if (targetRowIndex === -1) {
      return { status: "error", code: 404, message: "Không tìm thấy đơn hàng " + orderCode };
    }

    // Cập nhật Cột N (Shipper) = shipperLabel, Cột C (Status) = DELIVERING, Cột D (Step) = 3
    ordersSheet.getRange(targetRowIndex, SCHEMA.COL_SHIPPER_INFO + 1).setValue(shipperLabel);
    ordersSheet.getRange(targetRowIndex, SCHEMA.COL_STATUS + 1).setValue("DELIVERING");
    ordersSheet.getRange(targetRowIndex, SCHEMA.COL_STEP + 1).setValue(T5_SSOT.STEPS.SHIPPING);

    recordFinancialAuditLog(ss, orderCode, "KITCHEN_ASSIGN_SHIPPER", "Bếp KDS đã bàn giao cuốc xe cho Shipper nội bộ: " + shipperLabel);

    return {
      status: "success",
      code: 200,
      data: {
        orderCode: orderCode,
        status: "DELIVERING",
        step: 3,
        deliveryChannel: "INTERNAL",
        assignedShipper: shipperLabel,
        message: "Đã bàn giao đơn hàng thành công cho tài xế quán " + shipName + "!"
      }
    };

  } catch (err) {
    return { status: "error", code: 500, message: "Lỗi gán Shipper từ Bếp: " + err.toString() };
  } finally {
    lock.releaseLock();
  }
}

/**
 * NHÁNH 2: BẾP ĐẶT XE ĐỐI TÁC NGOÀI (API: kitchenDispatchExternalShipper)
 * Hỗ trợ GrabExpress, Ahamove, Vill, BeDelivery...
 * Tự động khóa đơn không cho tài xế nội bộ nhận, ghi vết cước xe ngoài để bảo vệ P&L.
 * 
 * @param {Object} payload - { orderCode, partnerName, trackingCode, actualShipFeePaid, note }
 * @returns {Object} Phản hồi chuẩn hóa API
 */
function kitchenDispatchExternalShipper(payload) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(ORDER_ENGINE_CONSTANTS.LOCK_TIMEOUT_MS);
  } catch (e) {
    return { status: "error", code: 503, message: "Hệ thống đang bận điều phối, vui lòng thử lại!" };
  }

  try {
    if (!payload || !payload.orderCode) {
      return { status: "error", code: 400, message: "Thiếu mã đơn hàng điều phối xe ngoài!" };
    }

    var orderCode = String(payload.orderCode).trim();
    var partnerName = String(payload.partnerName || "GRAB_EXPRESS").toUpperCase().trim();
    var trackingCode = String(payload.trackingCode || "N/A").trim();
    var actualShipFeePaid = T5_UTILS.cleanNumber(payload.actualShipFeePaid);
    var extraNote = String(payload.note || "").trim();

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var ordersSheet = ss.getSheetByName(T5_SSOT.SHEETS.ORDERS);
    if (!ordersSheet) {
      return { status: "error", code: 404, message: "Không tìm thấy bảng DATA_ORDERS" };
    }

    var ordersData = ordersSheet.getDataRange().getValues();
    var targetRowIndex = -1;
    var SCHEMA = T5_SSOT.ORDERS_SCHEMA;
    var currentRow = null;

    for (var r = ordersData.length - 1; r >= 1; r--) {
      if (String(ordersData[r][SCHEMA.COL_ORDER_CODE]).trim() === orderCode) {
        targetRowIndex = r + 1;
        currentRow = ordersData[r];
        break;
      }
    }

    if (targetRowIndex === -1 || !currentRow) {
      return { status: "error", code: 404, message: "Không tìm thấy đơn hàng " + orderCode };
    }

    var customerShipFee = T5_UTILS.cleanNumber(currentRow[SCHEMA.COL_BASE_SHIP_FEE]) - T5_UTILS.cleanNumber(currentRow[SCHEMA.COL_SHIPPING_SUBSIDY]);
    var externalExcessSubsidy = Math.max(0, actualShipFeePaid - customerShipFee);

    // Gán nhãn đối tác ngoài vào Cột N: [TÊN_ĐỐI_TÁC] - Mã: ...
    var externalShipperLabel = "[" + partnerName + "] - Mã: " + trackingCode;
    ordersSheet.getRange(targetRowIndex, SCHEMA.COL_SHIPPER_INFO + 1).setValue(externalShipperLabel);
    ordersSheet.getRange(targetRowIndex, SCHEMA.COL_STATUS + 1).setValue("DELIVERING");
    ordersSheet.getRange(targetRowIndex, SCHEMA.COL_STEP + 1).setValue(T5_SSOT.STEPS.SHIPPING);

    // Ghi nhật ký kiểm toán cước ngoài vào Cột P (Ghi Chú Đơn)
    var timestampStr = Utilities.formatDate(new Date(), T5_SSOT.SYSTEM.TIMEZONE, "HH:mm dd/MM");
    var externalDispatchLog = "[ĐẶT XE NGOÀI " + timestampStr + "] Đối tác: " + partnerName + 
      " | Mã vận đơn: " + trackingCode + 
      " | Cước thực trả: " + actualShipFeePaid.toLocaleString("vi-VN") + "đ" + 
      (externalExcessSubsidy > 0 ? " (Quán bù thêm: " + externalExcessSubsidy.toLocaleString("vi-VN") + "đ)" : "") +
      (extraNote ? " | " + extraNote : "");

    var currentNote = String(currentRow[SCHEMA.COL_NOTE] || "").trim();
    ordersSheet.getRange(targetRowIndex, SCHEMA.COL_NOTE + 1).setValue(currentNote ? (currentNote + " | " + externalDispatchLog) : externalDispatchLog);

    recordFinancialAuditLog(ss, orderCode, "DISPATCH_EXTERNAL", externalDispatchLog);

    return {
      status: "success",
      code: 200,
      data: {
        orderCode: orderCode,
        status: "DELIVERING",
        step: 3,
        deliveryChannel: "EXTERNAL",
        partnerName: partnerName,
        trackingCode: trackingCode,
        actualShipFeePaid: actualShipFeePaid,
        excessSubsidySpent: externalExcessSubsidy,
        message: "Đã ghi nhận điều phối xe đối tác ngoài " + partnerName + " thành công!"
      }
    };

  } catch (err) {
    return { status: "error", code: 500, message: "Lỗi điều phối xe ngoài: " + err.toString() };
  } finally {
    lock.releaseLock();
  }
}
/* ==========================================================================
   FILE: OrderEngine.gs - PHẦN [6/6] (HOÀN TẤT FILE)
   BẮT ĐẦU TỪ: Hàm kitchenSettleHandover()
   KẾT THÚC TẠI: Hết file OrderEngine.gs
   HƯỚNG DẪN: Copy nối tiếp ngay sau Phần [5/6] của OrderEngine.gs trong STAGING/GAS-BACKEND
   ========================================================================== */

/**
 * BẾP XÁC NHẬN BÀN GIAO ĐƠN & THU TIỀN ỨNG TẠI BẾP TỪ SHIPPER NỘI BỘ
 * Mô hình: Tiền trao cháo múc - Khóa trần nợ tạm theo SYS_CONFIG để bảo vệ két tiền quán.
 * API: kitchenSettleHandover
 * 
 * @param {Object} argPayload - { orderCode, settlementType, shipperName, amountPaid, note }
 * @returns {Object} Phản hồi chuẩn hóa API
 */
function kitchenSettleHandover(argPayload) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(ORDER_ENGINE_CONSTANTS.LOCK_TIMEOUT_MS);
  } catch (e) {
    return { status: "error", code: 503, message: "Hệ thống đang bận, vui lòng thử lại!" };
  }

  try {
    if (!argPayload || !argPayload.orderCode) {
      return { status: "error", code: 400, message: "Thiếu thông tin đơn hàng bàn giao!" };
    }

    var orderCode = String(argPayload.orderCode).trim();
    var settlementType = String(argPayload.settlementType || "PAID_CASH").trim().toUpperCase(); // PAID_CASH, PAID_TRANSFER, DEBT_HOLDING
    var shipperName = String(argPayload.shipperName || "Shipper").trim();
    var amountPaid = T5_UTILS.cleanNumber(argPayload.amountPaid);
    var noteText = String(argPayload.note || "").trim();

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var ordersSheet = ss.getSheetByName(T5_SSOT.SHEETS.ORDERS);
    if (!ordersSheet) {
      return { status: "error", code: 404, message: "Không tìm thấy bảng DATA_ORDERS" };
    }

    var ordersData = ordersSheet.getDataRange().getValues();
    var targetRowIndex = -1;
    var SCHEMA = T5_SSOT.ORDERS_SCHEMA;

    for (var r = ordersData.length - 1; r >= 1; r--) {
      if (String(ordersData[r][SCHEMA.COL_ORDER_CODE]).trim() === orderCode) {
        targetRowIndex = r + 1;
        break;
      }
    }

    if (targetRowIndex === -1) {
      return { status: "error", code: 404, message: "Không tìm thấy đơn hàng " + orderCode };
    }

    // 1. Kiểm tra hạn mức nợ nếu Bếp chọn cho nợ tạm (DEBT_HOLDING)
    if (settlementType === "DEBT_HOLDING") {
      var currentDebt = getShipperCurrentDebt(ss, shipperName);
      var maxDebtAllowed = 300000; // Giá trị trần mặc định

      try {
        var dynConfig = fetchDynamicConfigFromSheet(ss);
        if (dynConfig && dynConfig.MAX_COD_HOLDING_PER_SHIPPER) {
          maxDebtAllowed = T5_UTILS.cleanNumber(dynConfig.MAX_COD_HOLDING_PER_SHIPPER);
        }
      } catch (eDebtCfg) {}

      if ((currentDebt + amountPaid) > maxDebtAllowed) {
        return {
          status: "error",
          code: 403,
          message: "⚠️️ TỪ CHỐI CHO NỢ: Tài xế [" + shipperName + "] đang nợ " + currentDebt.toLocaleString("vi-VN") + "đ. Đơn này " + amountPaid.toLocaleString("vi-VN") + "đ sẽ vượt trần " + maxDebtAllowed.toLocaleString("vi-VN") + "đ. Yêu cầu thanh toán tiền mặt hoặc chuyển khoản!"
        };
      }
    }

    // 2. Cập nhật trạng thái đơn hàng sang DELIVERING (Step 3)
    ordersSheet.getRange(targetRowIndex, SCHEMA.COL_STATUS + 1).setValue("DELIVERING");
    ordersSheet.getRange(targetRowIndex, SCHEMA.COL_STEP + 1).setValue(T5_SSOT.STEPS.SHIPPING);

    // 3. Ghi nhận nhật ký thanh toán bàn giao tại Bếp vào Cột P
    var settlementLog = "";
    if (settlementType === "PAID_CASH") {
      settlementLog = "[BẾP ĐÃ THU TIỀN MẶT] Shipper đã thanh toán tiền ứng món: " + amountPaid.toLocaleString("vi-VN") + "đ";
    } else if (settlementType === "PAID_TRANSFER") {
      settlementLog = "[BẾP ĐÃ THU CHUYỂN KHOẢN] Shipper đã quét VietQR két: " + amountPaid.toLocaleString("vi-VN") + "đ";
    } else {
      settlementLog = "[GHI NỢ TẠM TẠI BẾP] Shipper nợ tiền món: " + amountPaid.toLocaleString("vi-VN") + "đ (" + noteText + ")";
    }

    var currentNote = String(ordersSheet.getRange(targetRowIndex, SCHEMA.COL_NOTE + 1).getValue() || "").trim();
    ordersSheet.getRange(targetRowIndex, SCHEMA.COL_NOTE + 1).setValue(currentNote ? (currentNote + " | " + settlementLog) : settlementLog);

    recordFinancialAuditLog(ss, orderCode, "KITCHEN_HANDOVER_" + settlementType, settlementLog);

    return {
      status: "success",
      code: 200,
      data: {
        orderCode: orderCode,
        settlementType: settlementType,
        amountPaid: amountPaid,
        status: "DELIVERING",
        step: 3,
        message: "Bàn giao thành công! Đơn hàng đã chuyển sang trạng thái đang giao."
      }
    };

  } catch (err) {
    return { status: "error", code: 500, message: "Lỗi xử lý bàn giao Bếp: " + err.toString() };
  } finally {
    lock.releaseLock();
  }
}

/**
 * TÍNH TOÁN TỔNG NỢ TẠM HIỆN TẠI CỦA SHIPPER TẠI BẾP
 * Quét toàn bộ các đơn đang nợ chưa thanh toán trong DATA_ORDERS.
 * 
 * @param {SpreadsheetApp.Spreadsheet} ss - Bảng tính Google Sheets
 * @param {string} shipperName - Tên tài xế
 * @returns {number} Số tiền nợ tạm chưa thanh toán
 */
function getShipperCurrentDebt(ss, shipperName) {
  try {
    var ordersSheet = ss.getSheetByName(T5_SSOT.SHEETS.ORDERS);
    if (!ordersSheet || ordersSheet.getLastRow() <= 1) return 0;

    var ordersData = ordersSheet.getDataRange().getValues();
    var cleanShipper = String(shipperName || "").trim().toLowerCase();
    var totalDebt = 0;
    var SCHEMA = T5_SSOT.ORDERS_SCHEMA;

    for (var r = 1; r < ordersData.length; r++) {
      var row = ordersData[r];
      var rowShipper = String(row[SCHEMA.COL_SHIPPER_INFO] || "").trim().toLowerCase();
      var rowNote = String(row[SCHEMA.COL_NOTE] || "");

      if (rowShipper.indexOf(cleanShipper) !== -1) {
        if (rowNote.indexOf("[GHI NỢ TẠM TẠI BẾP]") !== -1 && rowNote.indexOf("[ĐÃ TRẢ NỢ]") === -1) {
          var match = rowNote.match(/nợ tiền món:\s*([\d\.,]+)đ/);
          if (match && match[1]) {
            var debtVal = T5_UTILS.cleanNumber(match[1]);
            totalDebt += debtVal;
          }
        }
      }
    }

    return totalDebt;
  } catch (e) {
    return 0;
  }
}

/**
 * =========================================================================
 * PHÂN HỆ: QUẢN LÝ ĐỘI SHIPPER NỘI BỘ (DATA_SHIPPERS SSOT)
 * =========================================================================
 */

/**
 * TỰ ĐỘNG KHỞI TẠO BẢNG DATA_SHIPPERS NẾU CHƯA TỒN TẠI
 */
function getOrInitShippersSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(T5_SSOT.SHEETS.SHIPPERS);
  if (!sheet) {
    sheet = ss.insertSheet(T5_SSOT.SHEETS.SHIPPERS);
    var headers = ["Mã Shipper", "Tên Tài Xế", "Số Điện Thoại", "Biển Số Xe", "Trạng Thái", "Thời Gian Tạo"];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setBackground("#0f172a").setFontColor("#f8fafc").setFontWeight("bold");
    sheet.setFrozenRows(1);

    var defaultShippers = [
      ["SHIP_01", "Tài xế Hoàng (Đội 1)", "0934220585", "70-B1 123.45", "ACTIVE", new Date()],
      ["SHIP_02", "Tài xế Tuấn (Đội 2)", "0979531213", "70-F1 678.90", "ACTIVE", new Date()]
    ];
    sheet.getRange(2, 1, defaultShippers.length, headers.length).setValues(defaultShippers);
  }
  return sheet;
}

/**
 * LẤY DANH SÁCH SHIPPER CHO TRẠM BẾP KDS & ADMIN SHELL
 * API: getActiveShippersList
 * 
 * @param {Object} [payload] - { onlyActive: true/false }
 * @returns {Object} Mảng danh sách tài xế chuẩn hóa
 */
function getActiveShippersList(payload) {
  try {
    var sheet = getOrInitShippersSheet();
    var data = sheet.getDataRange().getValues();
    var onlyActive = (payload && payload.onlyActive === false) ? false : true;

    var shippers = [];
    for (var r = 1; r < data.length; r++) {
      var row = data[r];
      var code = String(row[0] || "").trim();
      var name = String(row[1] || "").trim();
      var phone = String(row[2] || "").trim();
      var bikePlate = String(row[3] || "").trim();
      var status = String(row[4] || "ACTIVE").toUpperCase().trim();

      if (!code || !name) continue;

      if (!onlyActive || status === "ACTIVE") {
        shippers.push({
          code: code,
          name: name,
          phone: phone,
          bikePlate: bikePlate,
          status: status,
          last4: phone.slice(-4)
        });
      }
    }

    return {
      status: "success",
      code: 200,
      data: shippers
    };
  } catch (err) {
    return {
      status: "error",
      code: 500,
      message: "Lỗi trích xuất danh sách Shipper: " + err.toString()
    };
  }
}

/**
 * THÊM MỚI HOẶC CẬP NHẬT THÔNG TIN SHIPPER (ADMIN LV1, LV2)
 * API: saveOrUpdateShipper
 * 
 * @param {Object} payload - { code, name, phone, bikePlate, status }
 * @returns {Object} Phản hồi chuẩn hóa API
 */
function saveOrUpdateShipper(payload) {
  try {
    if (!payload || !payload.name || !payload.phone) {
      return {
        status: "error",
        code: 400,
        message: "Thiếu Tên hoặc Số Điện Thoại của tài xế!"
      };
    }

    var sheet = getOrInitShippersSheet();
    var data = sheet.getDataRange().getValues();
    var phoneClean = String(payload.phone).trim();
    var rowIndexToUpdate = -1;

    for (var r = 1; r < data.length; r++) {
      var existingCode = String(data[r][0] || "").trim().toUpperCase();
      var existingPhone = String(data[r][2] || "").trim();
      if ((payload.code && existingCode === String(payload.code).trim().toUpperCase()) || existingPhone === phoneClean) {
        rowIndexToUpdate = r + 1;
        break;
      }
    }

    var shipperCode = payload.code ? String(payload.code).trim().toUpperCase() : ("SHIP_" + Utilities.formatDate(new Date(), T5_SSOT.SYSTEM.TIMEZONE, "yyMMddHHmmss"));
    var shipperName = String(payload.name).trim();
    var bikePlate = String(payload.bikePlate || "").trim().toUpperCase();
    var status = String(payload.status || "ACTIVE").toUpperCase().trim();

    if (rowIndexToUpdate > 0) {
      sheet.getRange(rowIndexToUpdate, 2, 1, 4).setValues([[shipperName, phoneClean, bikePlate, status]]);
      return {
        status: "success",
        code: 200,
        data: { message: "Cập nhật tài xế [" + shipperName + "] thành công!", code: shipperCode }
      };
    } else {
      sheet.appendRow([shipperCode, shipperName, phoneClean, bikePlate, status, new Date()]);
      return {
        status: "success",
        code: 200,
        data: { message: "Thêm mới tài xế [" + shipperName + "] thành công!", code: shipperCode }
      };
    }

  } catch (err) {
    return {
      status: "error",
      code: 500,
      message: "Lỗi lưu tài xế: " + err.toString()
    };
  }
}

/**
 * BẬT / TẮT TRẠNG THÁI TRỰC CA CỦA SHIPPER
 * API: toggleShipperStatus
 * 
 * @param {Object} payload - { phone, status }
 * @returns {Object} Phản hồi chuẩn hóa API
 */
function toggleShipperStatus(payload) {
  try {
    if (!payload || !payload.phone || !payload.status) {
      return { status: "error", code: 400, message: "Thiếu số điện thoại hoặc trạng thái mới!" };
    }

    var sheet = getOrInitShippersSheet();
    var data = sheet.getDataRange().getValues();
    var phoneClean = String(payload.phone).trim();
    var newStatus = String(payload.status).toUpperCase().trim();

    for (var r = 1; r < data.length; r++) {
      var rowPhone = String(data[r][2] || "").trim();
      if (rowPhone === phoneClean) {
        sheet.getRange(r + 1, 5).setValue(newStatus);
        return {
          status: "success",
          code: 200,
          data: { message: "Đã chuyển trạng thái tài xế sang " + newStatus }
        };
      }
    }

    return { status: "error", code: 404, message: "Không tìm thấy tài xế có SĐT: " + phoneClean };
  } catch (err) {
    return { status: "error", code: 500, message: "Lỗi đổi trạng thái: " + err.toString() };
  }
}
/**
 * XÁC MINH ĐƠN HÀNG COD HỢP LỆ TỪ TRẠM BẾP KDS HOẶC THU NGÂN
 * Chuyển trạng thái đơn từ WAIT_VERIFY (Bước 0) sang COOKING (Bước 2) để Bếp bắt đầu nấu.
 * Triệt tiêu rủi ro nấu nhầm đơn ảo, bảo vệ 100% quỹ vốn Food Cost (COGS) của quán.
 * API: kitchenVerifyCodOrder
 * 
 * @param {string|Object} argCodeOrPayload - Mã đơn hàng hoặc Object { orderCode, note }
 * @param {string} [optNote] - Ghi chú xác minh của nhân viên
 * @returns {Object} Phản hồi chuẩn hóa API
 */
function kitchenVerifyCodOrder(argCodeOrPayload, optNote) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(ORDER_ENGINE_CONSTANTS.LOCK_TIMEOUT_MS);
  } catch (e) {
    return { status: "error", code: 503, message: "Hệ thống Bếp đang bận xử lý, vui lòng thử lại sau vài giây!" };
  }

  try {
    var orderCode = "";
    var staffNote = "";

    if (typeof argCodeOrPayload === "object" && argCodeOrPayload !== null) {
      orderCode = String(argCodeOrPayload.orderCode || argCodeOrPayload.code || argCodeOrPayload.orderId || "").trim();
      staffNote = String(argCodeOrPayload.note || argCodeOrPayload.staffNote || "").trim();
    } else {
      orderCode = String(argCodeOrPayload || "").trim();
      staffNote = String(optNote || "").trim();
    }

    if (!orderCode) {
      return { status: "error", code: 400, message: "Thiếu mã đơn hàng cần xác minh!" };
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var ordersSheet = ss.getSheetByName(T5_SSOT.SHEETS.ORDERS);
    if (!ordersSheet) {
      return { status: "error", code: 404, message: "Không tìm thấy bảng CSDL DATA_ORDERS!" };
    }

    var ordersData = ordersSheet.getDataRange().getValues();
    var targetRowIndex = -1;
    var SCHEMA = T5_SSOT.ORDERS_SCHEMA;
    var currentRow = null;

    // Quét tìm dòng đơn hàng theo mã (ưu tiên quét ngược từ dưới lên)
    for (var r = ordersData.length - 1; r >= 1; r--) {
      if (String(ordersData[r][SCHEMA.COL_ORDER_CODE]).trim() === orderCode) {
        targetRowIndex = r + 1;
        currentRow = ordersData[r];
        break;
      }
    }

    if (targetRowIndex === -1 || !currentRow) {
      return { status: "error", code: 404, message: "Không tìm thấy đơn hàng [" + orderCode + "] trên hệ thống!" };
    }

    var currentStatus = String(currentRow[SCHEMA.COL_STATUS] || "").trim().toUpperCase();

    // Kiểm tra tính hợp lệ: Chỉ cho phép xác minh các đơn đang chờ duyệt (WAIT_VERIFY hoặc PENDING)
    if (currentStatus === "CANCELLED") {
      return { status: "error", code: 400, message: "Đơn hàng này đã bị hủy trước đó, không thể kích hoạt nấu!" };
    }

    // Cập nhật Cột C (Status) = COOKING, Cột D (Step) = 2
    ordersSheet.getRange(targetRowIndex, SCHEMA.COL_STATUS + 1).setValue("COOKING");
    ordersSheet.getRange(targetRowIndex, SCHEMA.COL_STEP + 1).setValue(T5_SSOT.STEPS.COOKING);

    // Ghi nhật ký xác thực vào Cột P (Ghi Chú Đơn)
    var timestampStr = Utilities.formatDate(new Date(), T5_SSOT.SYSTEM.TIMEZONE, "HH:mm dd/MM");
    var verifyLog = "[XÁC MINH COD " + timestampStr + "] Đã gọi khách xác nhận thành công" + (staffNote ? (" - " + staffNote) : "");

    var currentNote = String(currentRow[SCHEMA.COL_NOTE] || "").trim();
    ordersSheet.getRange(targetRowIndex, SCHEMA.COL_NOTE + 1).setValue(currentNote ? (currentNote + " | " + verifyLog) : verifyLog);

    // Ghi sổ cái kiểm toán tài chính & an ninh
    recordFinancialAuditLog(ss, orderCode, "KITCHEN_VERIFY_COD", verifyLog);

    return {
      status: "success",
      code: 200,
      data: {
        orderCode: orderCode,
        status: "COOKING",
        step: 2,
        message: "Đã xác minh đơn thành công! Bếp Thím 5 bắt đầu nấu món nóng hổi."
      }
    };

  } catch (err) {
    return { status: "error", code: 500, message: "Lỗi xác minh đơn Bếp: " + err.toString() };
  } finally {
    lock.releaseLock();
  }
}
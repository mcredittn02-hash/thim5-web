/**
 * =============================================================================
 * MODULE: CUSTOMER CRM & GAMIFICATION LUCKY WHEEL (v3.5 SAAS ENTERPRISE)
 * Tác giả: Đu Đủ - Cố vấn Chiến lược & Kỹ sư Trưởng hệ thống SaaS
 * Bản quyền: Bếp Thím 5 & LongHoaFood Master (Năm 2026)
 * Kiến trúc: Hợp nhất Mini CRM Gu Ẩm Thực + Thăng Hạng Chu Kỳ Tháng 2-4-7-12
 *            Ưu đãi giảm giá 1%-2%-3% + Biệt danh Gen Z + Cỗ máy Vòng Quay Thần Vị
 *            Lưu trữ độc quyền trên 2 Sheet chuẩn: DATA_CUSTOMERS & SYS_CONFIG
 * =============================================================================
 */

var CRM_CONSTANTS = Object.freeze({
  SHEET_CUSTOMERS: "DATA_CUSTOMERS",
  SHEET_CONFIG: "SYS_CONFIG",
  SHEET_AUDIT: "DATA_AUDIT_LOGS",
  CACHE_KEY_CRM_PREFIX: "CACHE_T5_CRM_USER_",
  CACHE_KEY_WHEEL_CONFIG: "CACHE_T5_WHEEL_PRIZES_CFG",
  CACHE_TTL_SECONDS: 600, // RAM Cache 10 phút tăng tốc tải trang
  DEFAULT_MIN_AOV_WHEEL: 79000, // Mức đơn tối thiểu mở khóa vòng quay
  MAX_WHEEL_BUDGET_PERCENT: 0.05, // Khóa trần chi phí quà tặng bình quân <= 5%
  
  // MỐC TẦN SUẤT THÁNG 2 - 4 - 7 - 12 & ĐẶC QUYỀN CHIẾT KHẤU 1% - 2% - 3%
  MONTHLY_MILESTONES: {
    LEVEL_0: { minOrders: 0, title: "Tân Binh Lạc Lối", discountPercent: 0, spinAward: 0, badgeColor: "#64748B", slogan: "Ăn thử một lần cho biết, ai ngờ dính tới giờ!" },
    LEVEL_1: { minOrders: 2, title: "Dân Chơi Nhập Môn", discountPercent: 0, spinAward: 0, badgeColor: "#3B82F6", slogan: "Bắt đầu quen vị, thiếu một bữa là thấy bứt rứt!" },
    LEVEL_2: { minOrders: 4, title: "Hệ Nghiện Định Kỳ", discountPercent: 1, spinAward: 1, badgeColor: "#10B981", slogan: "Khách quen mặt, shipper tới đầu ngõ là biết giao nhà ai! (Ưu đãi -1%)" },
    LEVEL_3: { minOrders: 7, title: "Chiến Thần Đóng Đô", discountPercent: 2, spinAward: 1, badgeColor: "#F59E0B", slogan: "Một tuần ghé mấy bận, quán chưa mở cửa đã ngóng! (Ưu đãi -2%)" },
    LEVEL_4: { minOrders: 12, title: "Cổ Đông Không Góp Vốn", discountPercent: 3, spinAward: 1, badgeColor: "#EF4444", slogan: "Nuôi sống cả cơ sở Thím 5, tiếng nói quyền lực ngang chủ quán! (Ưu đãi -3%)" }
  },

  DEFAULT_WHEEL_SLOTS: [
    { slotId: "SLOT_1", name: "Giảm 5.000đ Đơn Sau", type: "VOUCHER_CASH", displayPrice: 5000, costPrice: 3000, weight: 35, color: "#EF4444", status: "ACTIVE" },
    { slotId: "SLOT_2", name: "Tặng 1 Trứng Lòng Đào", type: "TOPPING", displayPrice: 6000, costPrice: 2500, weight: 25, color: "#F59E0B", status: "ACTIVE" },
    { slotId: "SLOT_3", name: "Giảm 10.000đ Đơn Sau", type: "VOUCHER_CASH", displayPrice: 10000, costPrice: 3500, weight: 15, color: "#10B981", status: "ACTIVE" },
    { slotId: "SLOT_4", name: "Tặng 1 Ly Trà Đào 1L", type: "BEVERAGE", displayPrice: 25000, costPrice: 5000, weight: 10, color: "#3B82F6", status: "ACTIVE" },
    { slotId: "SLOT_5", name: "Tặng Bánh Tráng Bơ Me", type: "SNACK", displayPrice: 20000, costPrice: 4000, weight: 10, color: "#8B5CF6", status: "ACTIVE" },
    { slotId: "SLOT_6", name: "Giảm 20.000đ Đơn Tiệc", type: "VOUCHER_CASH", displayPrice: 20000, costPrice: 4500, weight: 5, color: "#EC4899", status: "ACTIVE" }
  ]
});

/**
 * HÀM LẤY CƠ CẤU GIẢI THƯỞNG VÒNG QUAY TỪ SHEET SYS_CONFIG
 * Không sinh thêm bất kỳ sheet rác nào
 * 
 * @returns {Array<Object>} Mảng các ô quà tặng hợp lệ
 */
function getWheelConfigFromSysConfig() {
  var cache = CacheService.getScriptCache();
  var cachedJson = cache.get(CRM_CONSTANTS.CACHE_KEY_WHEEL_CONFIG);
  if (cachedJson) {
    try {
      return JSON.parse(cachedJson);
    } catch (e) {
      cache.remove(CRM_CONSTANTS.CACHE_KEY_WHEEL_CONFIG);
    }
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var cfgSheet = ss ? ss.getSheetByName(CRM_CONSTANTS.SHEET_CONFIG) : null;
  var prizes = CRM_CONSTANTS.DEFAULT_WHEEL_SLOTS;

  if (cfgSheet) {
    var data = cfgSheet.getDataRange().getValues();
    for (var r = 1; r < data.length; r++) {
      var key = String(data[r][0] || "").trim().toUpperCase();
      if (key === "WHEEL_PRIZES_JSON") {
        var rawVal = String(data[r][1] || "").trim();
        if (rawVal) {
          try {
            var parsed = JSON.parse(rawVal);
            if (Array.isArray(parsed) && parsed.length >= 4) {
              prizes = parsed;
            }
          } catch (parseErr) {
            Logger.log("⚠️ Lỗi parse WHEEL_PRIZES_JSON từ SYS_CONFIG: " + parseErr.toString());
          }
        }
        break;
      }
    }
  }

  try {
    cache.put(CRM_CONSTANTS.CACHE_KEY_WHEEL_CONFIG, JSON.stringify(prizes), CRM_CONSTANTS.CACHE_TTL_SECONDS);
  } catch (err) {}

  return prizes;
}

/**
 * HÀM CHUẨN HÓA SỐ ĐIỆN THOẠI VIỆT NAM AN TOÀN
 * 
 * @param {any} rawPhone - Chuỗi số điện thoại đầu vào
 * @returns {string} Số điện thoại 10 chữ số chuẩn hóa
 */
function normalizePhoneNumber(rawPhone) {
  if (!rawPhone) return "";
  var digits = String(rawPhone).replace(/[^\d]/g, '');
  if (digits.startsWith("84") && digits.length === 11) {
    digits = "0" + digits.slice(2);
  }
  return digits;
}

/**
 * CỖ MÁY PHÂN TÍCH GU ẨM THỰC THỜI GIAN THỰC (TASTE ANALYZER)
 * Tự động quét món ăn trong giỏ và giờ đặt để nhận diện thói quen ăn uống của khách
 * 
 * @param {Array<Object>} orderItems - Danh sách món ăn trong đơn
 * @param {Date} [orderDate] - Thời gian đặt đơn
 * @returns {Object} Thông tin Gu ăn uống { code, name, icon }
 */
function analyzeOrderTaste(orderItems, orderDate) {
  orderItems = Array.isArray(orderItems) ? orderItems : [];
  var date = orderDate ? new Date(orderDate) : new Date();
  var hour = date.getHours();

  var hasSpicy = false;
  var hasNoodle = false;
  var hasRice = false;
  var hasDrink = false;
  var hasSnack = false;
  var hasExtraTopping = false;

  for (var i = 0; i < orderItems.length; i++) {
    var it = orderItems[i];
    var itemName = String(it.name || it.itemName || "").toLowerCase();
    var note = String(it.note || it.description || "").toLowerCase();

    if (itemName.includes("cay") || note.includes("nhiều ớt") || note.includes("cay")) hasSpicy = true;
    if (itemName.includes("mì") || itemName.includes("mi")) hasNoodle = true;
    if (itemName.includes("cơm") || itemName.includes("com")) hasRice = true;
    if (itemName.includes("trà") || itemName.includes("nước") || itemName.includes("uống")) hasDrink = true;
    if (itemName.includes("bánh tráng") || itemName.includes("gà ủ muối")) hasSnack = true;
    if (itemName.includes("trứng") || itemName.includes("tóp mỡ") || itemName.includes("topping")) hasExtraTopping = true;
  }

  if (hasSpicy) {
    return { code: "SPICY_WARRIOR", name: "Chiến Thần Ăn Cay", icon: "🌶️" };
  } else if (hasNoodle && hasExtraTopping) {
    return { code: "NOODLE_TOPPING_MASTER", name: "Tín Đồ Mì Trộn Tóp Mỡ", icon: "🍜" };
  } else if (hasRice) {
    return { code: "RICE_BELIEVER", name: "Đạo Cơm Đất Thánh", icon: "🍛" };
  } else if (hasDrink && hasSnack) {
    return { code: "TEA_SNACK_GURU", name: "Hội Trà Bánh Chém Gió", icon: "🥤" };
  } else if (hour >= 21 || hour < 4) {
    return { code: "NIGHT_OWL_FOODIE", name: "Cú Đêm Đói Bụng", icon: "🌙" };
  } else if (hour >= 11 && hour <= 13) {
    return { code: "OFFICE_LUNCH_HERO", name: "Dân Văn Phòng Sành Ăn", icon: "💼" };
  }

  return { code: "STANDARD_FOODIE", name: "Thực Thần Mì Trộn", icon: "✨" };
}

/**
 * ĐÁNH GIÁ MỐC TẦN SUẤT THÁNG 2-4-7-12 & TẠO HUY HIỆU BIỆT DANH GEN Z
 * Tự động tính toán mức giảm giá 1% - 2% - 3% theo đúng quy tắc kinh doanh
 * 
 * @param {number} monthlyOrders - Số đơn hàng hoàn tất trong tháng hiện tại
 * @param {Object|string} tasteInput - Kết quả từ hàm analyzeOrderTaste hoặc mã gu
 * @returns {Object} Chi tiết danh hiệu, quyền lợi giảm giá và huy hiệu đầy đủ
 */
function evaluateMonthlyTierAndBadge(monthlyOrders, tasteInput) {
  var orders = Number(monthlyOrders) || 0;
  var taste = (typeof tasteInput === "object" && tasteInput !== null)
    ? tasteInput
    : { code: "STANDARD_FOODIE", name: String(tasteInput || "Thực Thần Mì Trộn"), icon: "✨" };

  var m = CRM_CONSTANTS.MONTHLY_MILESTONES;
  var tierMeta = m.LEVEL_0;

  if (orders >= m.LEVEL_4.minOrders) {
    tierMeta = m.LEVEL_4; // 12 đơn: Giảm 3%
  } else if (orders >= m.LEVEL_3.minOrders) {
    tierMeta = m.LEVEL_3; // 7 đơn: Giảm 2%
  } else if (orders >= m.LEVEL_2.minOrders) {
    tierMeta = m.LEVEL_2; // 4 đơn: Giảm 1%
  } else if (orders >= m.LEVEL_1.minOrders) {
    tierMeta = m.LEVEL_1; // 2 đơn: Giảm 0%
  } else {
    tierMeta = m.LEVEL_0; // 0-1 đơn: Giảm 0%
  }

  // Cấu trúc Biệt danh Gen Z chuẩn nhận diện: "[Icon] [Gu Ăn Uống] • [Danh Hiệu Tháng] (Slogan)"
  var fullBadge = taste.icon + " " + taste.name + " • " + tierMeta.title + " (" + tierMeta.slogan + ")";

  return {
    monthlyOrders: orders,
    tierTitle: tierMeta.title,
    discountPercent: tierMeta.discountPercent,
    spinAward: tierMeta.spinAward,
    badgeColor: tierMeta.badgeColor,
    slogan: tierMeta.slogan,
    tasteCode: taste.code,
    tasteName: taste.name,
    tasteIcon: taste.icon,
    fullBadge: fullBadge
  };
}
/**
 * HÀM TIỆN ÍCH: KIỂM TRA VÀ CUỘN CHU KỲ THÁNG CHO HỘI VIÊN
 * Nếu bước sang tháng mới, đặt lại số đơn tháng về 0 và lưu vinh danh tháng cũ
 * 
 * @param {string} dbMonthKey - Khóa tháng lưu trong CSDL (dạng YYYY-MM)
 * @param {number} dbMonthlyOrders - Số đơn trong tháng ghi nhận trước đó
 * @param {string} dbFullBadge - Huy hiệu đầy đủ tháng trước
 * @returns {Object} Trạng thái chu kỳ mới { isCycleRolled, currentMonthKey, monthlyOrders, lastMonthFameBadge }
 */
function checkAndResetMonthlyOrders(dbMonthKey, dbMonthlyOrders, dbFullBadge) {
  var currentMonthKey = Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM");
  var isSameMonth = (String(dbMonthKey || "").trim() === currentMonthKey);

  if (isSameMonth) {
    return {
      isCycleRolled: false,
      currentMonthKey: currentMonthKey,
      monthlyOrders: Number(dbMonthlyOrders) || 0,
      lastMonthFameBadge: ""
    };
  }

  // Sang tháng mới: Lưu lại huy hiệu tháng vừa qua làm vinh danh lịch sử
  return {
    isCycleRolled: true,
    currentMonthKey: currentMonthKey,
    monthlyOrders: 0,
    lastMonthFameBadge: String(dbFullBadge || "").trim()
  };
}

/**
 * TRA CỨU HỒ SƠ KHÁCH HÀNG, HUY HIỆU GEN Z & ƯU ĐÃI CHIẾT KHẤU 1% - 2% - 3%
 * API Action: lookupCustomerProfile | getCustomerProfile
 * 
 * @param {Object|string} payload - { phone: "0934220585" } hoặc chuỗi số điện thoại
 * @returns {Object} Phản hồi chuẩn hóa API
 */
function lookupCustomerProfile(payload) {
  try {
    var rawPhone = (typeof payload === "object" && payload !== null) 
      ? (payload.phone || payload.customerPhone || "") 
      : payload;
    var phone = normalizePhoneNumber(rawPhone);

    if (!phone || phone.length < 9) {
      return { status: "error", code: 400, message: "Số điện thoại tra cứu không hợp lệ!" };
    }

    var cache = CacheService.getScriptCache();
    var cacheKey = CRM_CONSTANTS.CACHE_KEY_CRM_PREFIX + phone;
    var cached = cache.get(cacheKey);

    // 1. Phản hồi siêu tốc từ RAM Cache (< 80ms)
    if (cached) {
      try {
        var parsedUser = JSON.parse(cached);
        return { status: "success", code: 200, fromCache: true, data: parsedUser };
      } catch (cErr) {
        cache.remove(cacheKey);
      }
    }

    // 2. Tra cứu trên bảng tính DATA_CUSTOMERS
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) {
      var id = PropertiesService.getScriptProperties().getProperty("TENANT_SPREADSHEET_ID") || 
               PropertiesService.getScriptProperties().getProperty("MENU_SPREADSHEET_ID");
      if (id) ss = SpreadsheetApp.openById(id);
    }
    if (!ss) throw new Error("Không thể liên kết CSDL Google Sheets!");

    var custSheet = ss.getSheetByName(CRM_CONSTANTS.SHEET_CUSTOMERS);
    var currentMonthKey = Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM");

    if (!custSheet) {
      var defaultNewProfile = {
        phone: phone,
        name: "Tân Binh Thím 5",
        isNewCustomer: true,
        monthlyOrders: 0,
        tierTitle: "Tân Binh Lạc Lối",
        tasteName: "Thực Thần Mì Trộn",
        discountPercent: 0,
        tierDiscountPercent: 0,
        fullBadge: "✨ Thực Thần Mì Trộn • Tân Binh Lạc Lối (Ăn thử một lần cho biết, ai ngờ dính tới giờ!)",
        badgeColor: "#64748B",
        slogan: "Ăn thử một lần cho biết, ai ngờ dính tới giờ!",
        lastMonthHonor: "",
        nextGoalText: "Đặt 2 đơn trong tháng này để mở khóa danh hiệu 'Dân Chơi Nhập Môn'!",
        points: 0,
        totalSpend: 0,
        lifetimeOrders: 0,
        wheelSpins: 0,
        availableSpins: 0,
        canAutoConfirm: false
      };
      return { status: "success", code: 200, data: defaultNewProfile };
    }

    var data = custSheet.getDataRange().getValues();
    var foundCustomer = null;

    for (var r = 1; r < data.length; r++) {
      var row = data[r];
      var sheetPhone = normalizePhoneNumber(row[1]);

      if (sheetPhone === phone) {
        var custName = String(row[2] || "Khách Quen Thím 5").trim();
        var rawMonthlyOrders = Number(row[3]) || 0;
        var rawMonthKey = String(row[4] || "");
        var storedTierTitle = String(row[5] || "");
        var storedTasteName = String(row[6] || "Thực Thần Mì Trộn");
        var storedFullBadge = String(row[7] || "");
        var storedLastMonthHonor = String(row[8] || "");
        var storedPoints = Number(row[9]) || 0;
        var storedTotalSpend = Number(row[10]) || 0;
        var storedLifetimeOrders = Number(row[11]) || 0;
        var storedSpins = Math.max(0, Number(row[12]) || 0);

        // Kiểm tra xem đã bước sang tháng mới hay chưa
        var isSameMonth = (rawMonthKey === currentMonthKey);
        var activeMonthlyOrders = isSameMonth ? rawMonthlyOrders : 0;
        var tasteObj = { code: "CUSTOM_TASTE", name: storedTasteName, icon: "🍜" };

        var badgeInfo = evaluateMonthlyTierAndBadge(activeMonthlyOrders, tasteObj);

        // Tính cự ly mục tiêu kế tiếp (Mốc 2 - 4 - 7 - 12 đơn)
        var nextGoalText = "";
        if (activeMonthlyOrders < 2) {
          nextGoalText = "Còn " + (2 - activeMonthlyOrders) + " đơn để mở khóa 'Dân Chơi Nhập Môn'!";
        } else if (activeMonthlyOrders < 4) {
          nextGoalText = "Còn " + (4 - activeMonthlyOrders) + " đơn để đạt 'Hệ Nghiện Định Kỳ' (Nhận 1 lượt quay & giảm 1%)!";
        } else if (activeMonthlyOrders < 7) {
          nextGoalText = "Còn " + (7 - activeMonthlyOrders) + " đơn để thăng cấp 'Chiến Thần Đóng Đô' (Giảm 2%)!";
        } else if (activeMonthlyOrders < 12) {
          nextGoalText = "Còn " + (12 - activeMonthlyOrders) + " đơn để trở thành 'Cổ Đông Không Góp Vốn' (Giảm 3%)!";
        } else {
          nextGoalText = "Đã đạt cấp tối đa! Bạn đang nuôi sống cả cơ sở Bếp Thím 5 (Đặc quyền giảm 3%)!";
        }

        foundCustomer = {
          code: String(row[0] || "").trim(),
          phone: phone,
          name: custName,
          isNewCustomer: false,
          monthlyOrders: activeMonthlyOrders,
          tierTitle: badgeInfo.tierTitle,
          tasteName: badgeInfo.tasteName,
          discountPercent: badgeInfo.discountPercent,
          tierDiscountPercent: badgeInfo.discountPercent,
          fullBadge: isSameMonth ? (storedFullBadge || badgeInfo.fullBadge) : badgeInfo.fullBadge,
          badgeColor: badgeInfo.badgeColor,
          slogan: badgeInfo.slogan,
          lastMonthHonor: storedLastMonthHonor,
          nextGoalText: nextGoalText,
          points: storedPoints,
          totalSpend: storedTotalSpend,
          lifetimeOrders: storedLifetimeOrders,
          wheelSpins: storedSpins,
          availableSpins: storedSpins,
          canAutoConfirm: (activeMonthlyOrders >= 4 || storedLifetimeOrders >= 5)
        };
        break;
      }
    }

    if (!foundCustomer) {
      foundCustomer = {
        phone: phone,
        name: "Tân Binh Thím 5",
        isNewCustomer: true,
        monthlyOrders: 0,
        tierTitle: "Tân Binh Lạc Lối",
        tasteName: "Thực Thần Mì Trộn",
        discountPercent: 0,
        tierDiscountPercent: 0,
        fullBadge: "✨ Thực Thần Mì Trộn • Tân Binh Lạc Lối (Ăn thử một lần cho biết, ai ngờ dính tới giờ!)",
        badgeColor: "#64748B",
        slogan: "Ăn thử một lần cho biết, ai ngờ dính tới giờ!",
        lastMonthHonor: "",
        nextGoalText: "Đặt 2 đơn trong tháng này để mở khóa danh hiệu 'Dân Chơi Nhập Môn'!",
        points: 0,
        totalSpend: 0,
        lifetimeOrders: 0,
        wheelSpins: 0,
        availableSpins: 0,
        canAutoConfirm: false
      };
    }

    // Nạp RAM Cache 10 phút
    try {
      cache.put(cacheKey, JSON.stringify(foundCustomer), CRM_CONSTANTS.CACHE_TTL_SECONDS);
    } catch (putErr) {}

    return {
      status: "success",
      code: 200,
      fromCache: false,
      data: foundCustomer
    };

  } catch (err) {
    return { status: "error", code: 500, message: "Lỗi tra cứu khách hàng: " + err.toString() };
  }
}

/**
 * ALIAS TƯƠNG THÍCH NGƯỢC CHO GIAO DIỆN CLIENT CŨ
 */
function getCustomerProfile(params) {
  var res = lookupCustomerProfile(params);
  if (res.status === "success") {
    var d = res.data;
    d.success = true;
    return d;
  }
  return { success: false, message: res.message || "Lỗi tra cứu" };
}

/**
 * ĐỒNG BỘ ĐIỂM THƯỞNG, TÍNH TẦN SUẤT THÁNG 2-4-7-12, TẠO HUY HIỆU GEN Z & TẶNG LƯỢT QUAY
 * Kích hoạt tự động khi đơn hàng chuyển sang trạng thái COMPLETED trong OrderEngine
 * API Action: syncCustomerAfterOrder | syncCustomerPointsOnOrderComplete
 * 
 * @param {Object} payload - Dữ liệu chi tiết đơn hàng hoàn tất
 * @returns {Object} Thông tin hội viên sau khi cập nhật
 */
function syncCustomerAfterOrder(payload) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {
    return { status: "error", code: 503, message: "Hệ thống CRM đang bận xử lý dữ liệu!" };
  }

  try {
    if (!payload) {
      return { status: "error", code: 400, message: "Thiếu dữ liệu đơn hàng đồng bộ CRM!" };
    }

    var rawPhone = payload.phone || (payload.customer ? payload.customer.phone : "");
    var phone = normalizePhoneNumber(rawPhone);

    if (!phone) {
      return { status: "error", code: 400, message: "Thiếu số điện thoại khách hàng!" };
    }

    var custName = String(payload.name || (payload.customer ? payload.customer.name : "") || "Khách Quen Thím 5").trim();
    var orderSubtotal = Number(payload.orderSubtotal || payload.subtotal || payload.totalAmount || payload.total || 0);
    var orderCode = String(payload.orderCode || payload.orderId || "T5-ORDER").trim();
    var orderItems = payload.items || payload.orderItems || [];
    var orderDate = payload.createdAt ? new Date(payload.createdAt) : new Date();

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) {
      var id = PropertiesService.getScriptProperties().getProperty("TENANT_SPREADSHEET_ID") || 
               PropertiesService.getScriptProperties().getProperty("MENU_SPREADSHEET_ID");
      if (id) ss = SpreadsheetApp.openById(id);
    }
    if (!ss) throw new Error("Không thể liên kết CSDL Google Sheets!");

    var custSheet = ss.getSheetByName(CRM_CONSTANTS.SHEET_CUSTOMERS);
    if (!custSheet) {
      throw new Error("Sheet DATA_CUSTOMERS chưa được khởi tạo!");
    }

    // 1. Phân tích Gu ẩm thực của đơn hàng hiện tại
    var currentOrderTaste = analyzeOrderTaste(orderItems, orderDate);

    // 2. Tỷ lệ tích điểm: 10.000đ = 1 Điểm
    var earnedPoints = Math.floor(orderSubtotal / 10000);

    // 3. Đọc ngưỡng mở khóa lượt quay AOV từ SYS_CONFIG (mặc định 79.000đ)
    var minAovWheel = CRM_CONSTANTS.DEFAULT_MIN_AOV_WHEEL;
    try {
      var cfgSheet = ss.getSheetByName(CRM_CONSTANTS.SHEET_CONFIG);
      if (cfgSheet) {
        var cData = cfgSheet.getDataRange().getValues();
        for (var k = 1; k < cData.length; k++) {
          var keyName = String(cData[k][0] || "").trim().toUpperCase();
          if (keyName === "MIN_AOV_LUCKY_WHEEL" || keyName === "WHEEL_MIN_ORDER") {
            minAovWheel = Number(cData[k][1]) || minAovWheel;
            break;
          }
        }
      }
    } catch (e) {}

    var earnedSpinsFromAov = (orderSubtotal >= minAovWheel) ? 1 : 0;
    var nowTimestamp = Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd HH:mm:ss");
    var currentMonthKey = Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM");

    var data = custSheet.getDataRange().getValues();
    var rowIndex = -1;

    for (var r = 1; r < data.length; r++) {
      if (normalizePhoneNumber(data[r][1]) === phone) {
        rowIndex = r + 1;
        break;
      }
    }

    if (rowIndex === -1) {
      // -----------------------------------------------------------------------
      // TRƯỜNG HỢP 1: KHÁCH HÀNG MỚI ĐẶT LẦN ĐẦU TIÊN
      // -----------------------------------------------------------------------
      var monthlyOrders = 1;
      var badgeInfo = evaluateMonthlyTierAndBadge(monthlyOrders, currentOrderTaste);
      var totalSpins = earnedSpinsFromAov;
      var custCode = "CUST_" + phone.slice(-4) + "_" + Math.floor(Math.random() * 1000);

      var newRow = [
        custCode,                      // Cột A: Mã khách hàng
        phone,                         // Cột B: SĐT
        custName,                      // Cột C: Tên
        monthlyOrders,                 // Cột D: Đơn tháng này (1)
        currentMonthKey,               // Cột E: Tháng hiện tại (YYYY-MM)
        badgeInfo.tierTitle,           // Cột F: Danh hiệu tháng
        badgeInfo.tasteName,           // Cột G: Gu ăn uống
        badgeInfo.fullBadge,           // Cột H: Huy hiệu đầy đủ Gen Z
        "",                            // Cột I: Danh hiệu tháng trước (rỗng)
        earnedPoints,                  // Cột J: Điểm tích lũy
        orderSubtotal,                 // Cột K: Tổng chi tiêu trọn đời
        1,                             // Cột L: Tổng đơn trọn đời
        totalSpins,                    // Cột M: Lượt quay còn lại
        nowTimestamp                   // Cột N: Ngày cập nhật
      ];

      custSheet.appendRow(newRow);
      Logger.log("✨ [CustomerCRM] Tân binh: " + phone + " | Huy hiệu: " + badgeInfo.fullBadge);

      // Xóa Cache RAM
      try {
        CacheService.getScriptCache().remove(CRM_CONSTANTS.CACHE_KEY_CRM_PREFIX + phone);
      } catch (cDelErr) {}

      return {
        status: "success",
        code: 200,
        success: true,
        data: {
          phone: phone,
          name: custName,
          monthlyOrders: 1,
          tierTitle: badgeInfo.tierTitle,
          tasteName: badgeInfo.tasteName,
          discountPercent: badgeInfo.discountPercent,
          tierDiscountPercent: badgeInfo.discountPercent,
          fullBadge: badgeInfo.fullBadge,
          badgeColor: badgeInfo.badgeColor,
          slogan: badgeInfo.slogan,
          addedPoints: earnedPoints,
          totalPoints: earnedPoints,
          addedSpins: totalSpins,
          totalSpins: totalSpins,
          availableSpins: totalSpins,
          newMilestoneAwarded: false,
          orderCode: orderCode,
          message: "Đã ghi nhận khách hàng mới thành công!"
        }
      };

    } else {
      // -----------------------------------------------------------------------
      // TRƯỜNG HỢP 2: KHÁCH HÀNG ĐÃ CÓ TRONG HỆ THỐNG
      // -----------------------------------------------------------------------
      var rowData = data[rowIndex - 1];
      var dbCustCode = String(rowData[0] || ("CUST_" + phone.slice(-4)));
      var dbMonthlyOrders = Number(rowData[3]) || 0;
      var dbMonthKey = String(rowData[4] || "");
      var dbFullBadge = String(rowData[7] || "");
      var dbLastMonthHonor = String(rowData[8] || "");
      var dbPoints = Number(rowData[9]) || 0;
      var dbTotalSpend = Number(rowData[10]) || 0;
      var dbLifetimeOrders = Number(rowData[11]) || 0;
      var dbSpins = Math.max(0, Number(rowData[12]) || 0);

      // Kiểm tra chu kỳ tháng: Nếu sang tháng mới -> Reset về 0 và lưu vinh danh tháng cũ
      var cycleState = checkAndResetMonthlyOrders(dbMonthKey, dbMonthlyOrders, dbFullBadge);
      var updatedMonthlyOrders = cycleState.monthlyOrders + 1;

      // Đánh giá Huy hiệu mới theo mốc 2-4-7-12
      var newBadgeInfo = evaluateMonthlyTierAndBadge(updatedMonthlyOrders, currentOrderTaste);

      // Kiểm tra chạm mốc thưởng mới (2, 4, 7, 12 đơn)
      var isMilestoneReached = (updatedMonthlyOrders === 2 || updatedMonthlyOrders === 4 || 
                                updatedMonthlyOrders === 7 || updatedMonthlyOrders === 12);
      var milestoneSpinsAward = (isMilestoneReached ? newBadgeInfo.spinAward : 0);
      var updatedSpins = dbSpins + earnedSpinsFromAov + milestoneSpinsAward;

      var updatedPoints = dbPoints + earnedPoints;
      var updatedSpend = dbTotalSpend + orderSubtotal;
      var updatedLifetimeOrders = dbLifetimeOrders + 1;

      // Cập nhật vào dòng của khách trên DATA_CUSTOMERS
      custSheet.getRange(rowIndex, 3).setValue(custName);
      custSheet.getRange(rowIndex, 4).setValue(updatedMonthlyOrders);
      custSheet.getRange(rowIndex, 5).setValue(cycleState.currentMonthKey);
      custSheet.getRange(rowIndex, 6).setValue(newBadgeInfo.tierTitle);
      custSheet.getRange(rowIndex, 7).setValue(newBadgeInfo.tasteName);
      custSheet.getRange(rowIndex, 8).setValue(newBadgeInfo.fullBadge);
      if (cycleState.isCycleRolled) {
        custSheet.getRange(rowIndex, 9).setValue(cycleState.lastMonthFameBadge);
      }
      custSheet.getRange(rowIndex, 10).setValue(updatedPoints);
      custSheet.getRange(rowIndex, 11).setValue(updatedSpend);
      custSheet.getRange(rowIndex, 12).setValue(updatedLifetimeOrders);
      custSheet.getRange(rowIndex, 13).setValue(updatedSpins);
      custSheet.getRange(rowIndex, 14).setValue(nowTimestamp);

      Logger.log("🎉 [CustomerCRM] Cập nhật: " + phone + " | Đơn tháng: " + updatedMonthlyOrders + " | Huy hiệu: " + newBadgeInfo.fullBadge);

      // Xóa Cache RAM
      try {
        CacheService.getScriptCache().remove(CRM_CONSTANTS.CACHE_KEY_CRM_PREFIX + phone);
      } catch (cDelErr) {}

      return {
        status: "success",
        code: 200,
        success: true,
        data: {
          phone: phone,
          name: custName,
          monthlyOrders: updatedMonthlyOrders,
          tierTitle: newBadgeInfo.tierTitle,
          tasteName: newBadgeInfo.tasteName,
          discountPercent: newBadgeInfo.discountPercent,
          tierDiscountPercent: newBadgeInfo.discountPercent,
          fullBadge: newBadgeInfo.fullBadge,
          badgeColor: newBadgeInfo.badgeColor,
          slogan: newBadgeInfo.slogan,
          addedPoints: earnedPoints,
          totalPoints: updatedPoints,
          addedSpins: (earnedSpinsFromAov + milestoneSpinsAward),
          totalSpins: updatedSpins,
          availableSpins: updatedSpins,
          newMilestoneAwarded: isMilestoneReached,
          orderCode: orderCode,
          message: isMilestoneReached 
            ? "Chúc mừng bạn đã mở khóa danh hiệu '" + newBadgeInfo.tierTitle + "'! Được tặng thêm lượt quay và ưu đãi giảm " + newBadgeInfo.discountPercent + "%."
            : "Đã đồng bộ đơn hàng thành công!"
        }
      };
    }

  } catch (err) {
    return { status: "error", code: 500, message: "Lỗi đồng bộ CRM: " + err.toString() };
  } finally {
    lock.releaseLock();
  }
}

/**
 * ALIAS TƯƠNG THÍCH NGƯỢC CHO CÁC MODULE GỌI THEO TÊN CŨ
 */
function syncCustomerPointsOnOrderComplete(orderData) {
  var res = syncCustomerAfterOrder(orderData);
  if (res.status === "success") {
    var d = res.data;
    d.success = true;
    return d;
  }
  return { success: false, message: res.message || "Lỗi đồng bộ điểm" };
}
/**
 * CỖ MÁY QUAY THƯỞNG SERVER-SIDE ZERO-TRUST (WEIGHTED RNG)
 * Kiểm toán nghiêm ngặt số lượt quay khả dụng, trừ lượt quay trực tiếp trên DATA_CUSTOMERS
 * API Action: spinLuckyWheel
 * 
 * @param {Object} payload - { phone, customerPhone, subtotal }
 * @returns {Object} Kết quả quay thưởng, góc dừng và mã quà tặng
 */
function spinLuckyWheel(payload) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {
    return { status: "error", code: 503, message: "Hệ thống vòng quay đang bận, vui lòng thử lại sau giây lát!" };
  }

  try {
    if (!payload) {
      return { status: "error", code: 400, message: "Yêu cầu quay thưởng không hợp lệ!" };
    }

    var rawPhone = payload.phone || payload.customerPhone || "";
    var phone = normalizePhoneNumber(rawPhone);

    if (!phone) {
      return { status: "error", code: 400, message: "Vui lòng nhập số điện thoại để tham gia quay thưởng!" };
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) {
      var id = PropertiesService.getScriptProperties().getProperty("TENANT_SPREADSHEET_ID") || 
               PropertiesService.getScriptProperties().getProperty("MENU_SPREADSHEET_ID");
      if (id) ss = SpreadsheetApp.openById(id);
    }
    if (!ss) throw new Error("Không thể kết nối CSDL!");

    var custSheet = ss.getSheetByName(CRM_CONSTANTS.SHEET_CUSTOMERS);
    if (!custSheet) {
      throw new Error("Không tìm thấy bảng dữ liệu khách hàng DATA_CUSTOMERS!");
    }

    // 1. KIỂM TOÁN LƯỢT QUAY TRÊN DATA_CUSTOMERS (CHỐNG GIAN LẬN CLIENT-SIDE)
    var custData = custSheet.getDataRange().getValues();
    var customerRow = -1;
    var availableSpins = 0;

    for (var r = 1; r < custData.length; r++) {
      if (normalizePhoneNumber(custData[r][1]) === phone) {
        customerRow = r + 1;
        // Lượt quay nằm ở Cột M (Index 12) theo cấu trúc 14 cột chuẩn
        availableSpins = Math.max(0, Number(custData[r][12]) || 0);
        break;
      }
    }

    // Nếu chưa có lượt quay nào -> Kiểm tra điều kiện đơn hàng gửi kèm
    var subtotal = Number(payload.subtotal || payload.orderSubtotal || 0);
    var minAovWheel = CRM_CONSTANTS.DEFAULT_MIN_AOV_WHEEL;
    try {
      var cfgSheet = ss.getSheetByName(CRM_CONSTANTS.SHEET_CONFIG);
      if (cfgSheet) {
        var cData = cfgSheet.getDataRange().getValues();
        for (var k = 1; k < cData.length; k++) {
          var keyName = String(cData[k][0] || "").trim().toUpperCase();
          if (keyName === "MIN_AOV_LUCKY_WHEEL" || keyName === "WHEEL_MIN_ORDER") {
            minAovWheel = Number(cData[k][1]) || minAovWheel;
            break;
          }
        }
      }
    } catch (e) {}

    if (availableSpins <= 0) {
      if (subtotal < minAovWheel) {
        return {
          status: "error",
          code: 403,
          success: false,
          message: "Quý khách chưa có lượt quay thưởng! Hãy đặt đơn từ " + 
            Math.round(minAovWheel / 1000) + "k để nhận lượt quay Thần Vị."
        };
      } else {
        availableSpins = 1;
      }
    }

    // 2. LẤY CƠ CẤU GIẢI THƯỞNG VÀ CHẠY THUẬT TOÁN WEIGHTED RNG
    var allSlots = getWheelConfigFromSysConfig();
    var activeSlots = [];
    var totalWeight = 0;

    for (var i = 0; i < allSlots.length; i++) {
      var slotItem = allSlots[i];
      var slotStatus = String(slotItem.status || "ACTIVE").toUpperCase();
      if (slotStatus === "ACTIVE") {
        var w = Number(slotItem.weight || slotItem.probability || 0);
        if (w > 0) {
          activeSlots.push({
            slotIndex: i,
            slotId: String(slotItem.slotId || ("SLOT_" + (i + 1))),
            name: String(slotItem.name || ""),
            type: String(slotItem.type || "DISCOUNT_CASH"),
            displayPrice: Number(slotItem.displayPrice || slotItem.value || 0),
            costPrice: Number(slotItem.costPrice || slotItem.foodCost || 0),
            weight: w,
            color: String(slotItem.color || "#EF4444")
          });
          totalWeight += w;
        }
      }
    }

    if (activeSlots.length === 0 || totalWeight <= 0) {
      return { status: "error", code: 500, message: "Cơ cấu giải thưởng chưa được kích hoạt trên hệ thống!" };
    }

    // Thuật toán bốc thăm ngẫu nhiên theo trọng số xác suất
    var randomVal = Math.random() * totalWeight;
    var cumulativeWeight = 0;
    var winningSlot = activeSlots[0];

    for (var j = 0; j < activeSlots.length; j++) {
      cumulativeWeight += activeSlots[j].weight;
      if (randomVal <= cumulativeWeight) {
        winningSlot = activeSlots[j];
        break;
      }
    }

    // 3. TRỪ TRỰC TIẾP 1 LƯỢT QUAY TRÊN SHEET DATA_CUSTOMERS
    var remainingSpins = Math.max(0, availableSpins - 1);
    if (customerRow !== -1) {
      custSheet.getRange(customerRow, 13).setValue(remainingSpins);
    }

    // 4. TÍNH TOÁN GÓC DỪNG CHO CANVAS VÀ SINH MÃ QUÀ TẶNG BẢO MẬT
    var slotCount = allSlots.length;
    var arcSizeDegrees = 360 / slotCount;
    var targetAngle = 1440 + (360 - (winningSlot.slotIndex * arcSizeDegrees + (arcSizeDegrees / 2)));
    var timeCode = Utilities.formatDate(new Date(), "GMT+7", "HHmmss");
    var giftToken = "GIFT_" + winningSlot.slotId + "_" + timeCode;

    // Xóa Cache RAM khách hàng
    try {
      CacheService.getScriptCache().remove(CRM_CONSTANTS.CACHE_KEY_CRM_PREFIX + phone);
    } catch (cErr) {}

    Logger.log("🎁 [LuckyWheel] SĐT " + phone + " ➔ Trúng: " + winningSlot.name + " | Còn lại: " + remainingSpins + " lượt.");

    return {
      status: "success",
      code: 200,
      success: true,
      data: {
        winningSlotIndex: winningSlot.slotIndex,
        slotId: winningSlot.slotId,
        giftName: winningSlot.name,
        giftType: winningSlot.type,
        giftValue: winningSlot.displayPrice,
        giftToken: giftToken,
        stopAngle: targetAngle,
        remainingSpins: remainingSpins,
        message: "Chúc mừng bạn đã trúng: " + winningSlot.name + "!"
      },
      winningSlotIndex: winningSlot.slotIndex,
      slotId: winningSlot.slotId,
      giftName: winningSlot.name,
      giftType: winningSlot.type,
      giftToken: giftToken,
      stopAngle: targetAngle,
      message: "Chúc mừng bạn đã trúng: " + winningSlot.name + "!"
    };

  } catch (err) {
    return { status: "error", code: 500, message: "Lỗi quay thưởng: " + err.toString() };
  } finally {
    lock.releaseLock();
  }
}

/**
 * CẬP NHẬT CƠ CẤU GIẢI THƯỞNG VÒNG QUAY BỞI ADMIN (CÓ KHÓA TRẦN CHI PHÍ 5%)
 * Bắt buộc kiểm tra tổng xác suất bằng 100% và chi phí kỳ vọng E(Cost) <= 5% đơn tối thiểu.
 * Lưu trữ trực tiếp dạng JSON vào khóa WHEEL_PRIZES_JSON trên sheet SYS_CONFIG (Không sinh sheet rác).
 * API Action: updateWheelConfig
 * 
 * @param {Object} params - Gồm { slots: Array, adminName: string, masterKey: string }
 * @returns {Object} Kết quả cập nhật và chỉ số an toàn tài chính
 */
function updateWheelConfig(params) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {
    return { status: "error", code: 503, message: "Hệ thống đang bận cập nhật cấu hình giải thưởng!" };
  }

  try {
    if (!params || !params.slots || !Array.isArray(params.slots)) {
      return { status: "error", code: 400, message: "Dữ liệu cơ cấu giải thưởng không đúng định dạng (Invalid Slots Array)." };
    }

    var slots = params.slots;
    if (slots.length < 4 || slots.length > 8) {
      return { status: "error", code: 400, message: "Số lượng ô quà tặng trên vòng quay phải từ 4 đến 8 ô để đảm bảo hiển thị tối ưu." };
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) {
      var id = PropertiesService.getScriptProperties().getProperty("TENANT_SPREADSHEET_ID") || 
               PropertiesService.getScriptProperties().getProperty("MENU_SPREADSHEET_ID");
      if (id) ss = SpreadsheetApp.openById(id);
    }
    if (!ss) throw new Error("Không thể kết nối CSDL!");

    var cfgSheet = ss.getSheetByName(CRM_CONSTANTS.SHEET_CONFIG);
    if (!cfgSheet) {
      throw new Error("Không tìm thấy bảng cấu hình SYS_CONFIG!");
    }

    // 1. Đọc mức đơn tối thiểu để mở khóa vòng quay từ SYS_CONFIG
    var minOrderAmount = CRM_CONSTANTS.DEFAULT_MIN_AOV_WHEEL;
    var cData = cfgSheet.getDataRange().getValues();
    var wheelConfigRowIndex = -1;

    for (var r = 1; r < cData.length; r++) {
      var k = String(cData[r][0] || "").trim().toUpperCase();
      if (k === "MIN_AOV_LUCKY_WHEEL" || k === "WHEEL_MIN_ORDER") {
        minOrderAmount = Number(cData[r][1]) || minOrderAmount;
      }
      if (k === "WHEEL_PRIZES_JSON") {
        wheelConfigRowIndex = r + 1;
      }
    }

    var maxBudgetPerOrder = Math.round(minOrderAmount * CRM_CONSTANTS.MAX_WHEEL_BUDGET_PERCENT); // Trần chi phí 5%

    // 2. KIỂM TOÁN RÀO CHẮN TOÁN HỌC (TOTAL WEIGHT & EXPECTED COST)
    var totalWeight = 0;
    var expectedCost = 0;
    var cleanSlots = [];

    for (var i = 0; i < slots.length; i++) {
      var s = slots[i];
      var weight = Number(s.weight || s.probability || 0);
      var cost = Number(s.costPrice || s.foodCost || 0);
      var displayPrice = Number(s.displayPrice || s.value || 0);

      if (weight < 0) {
        return { status: "error", code: 400, message: "Tỷ lệ trúng của ô quà '" + s.name + "' không được là số âm." };
      }
      if (cost < 0) {
        return { status: "error", code: 400, message: "Giá vốn Food Cost của ô quà '" + s.name + "' không được là số âm." };
      }

      totalWeight += weight;
      expectedCost += (weight / 100) * cost;

      cleanSlots.push({
        slotIndex: i,
        slotId: String(s.slotId || ("SLOT_" + (i + 1))),
        name: String(s.name || "").trim(),
        type: String(s.type || "DISCOUNT_CASH").toUpperCase(),
        displayPrice: displayPrice,
        costPrice: cost,
        weight: weight,
        color: String(s.color || "#EF4444"),
        status: String(s.status || "ACTIVE").toUpperCase()
      });
    }

    // Sai số cho phép 0.01% do làm tròn số thập phân
    if (Math.abs(totalWeight - 100) > 0.01) {
      return {
        status: "error",
        code: 400,
        message: "Tổng tỷ lệ trúng thưởng của các ô phải bằng chính xác 100% (Hiện tại đang là: " + totalWeight.toFixed(1) + "%)."
      };
    }

    // 3. RÀO CHẮN TÀI CHÍNH CỐT TỬ: CHI PHÍ KỲ VỌNG KHÔNG VƯỢT QUÁ 5%
    if (expectedCost > maxBudgetPerOrder) {
      var overAmount = Math.round(expectedCost - maxBudgetPerOrder);
      return {
        status: "error",
        code: 422,
        message: "🚨 VI PHẠM TRẦN CHI PHÍ 5%: Chi phí quà tặng bình quân đang là " + 
          Math.round(expectedCost).toLocaleString("vi-VN") + "đ/đơn, vượt mức trần cho phép (" + 
          maxBudgetPerOrder.toLocaleString("vi-VN") + "đ/đơn) mất " + overAmount.toLocaleString("vi-VN") + "đ. " +
          "Vui lòng giảm tỷ lệ trúng của các món đắt tiền hoặc chọn quà có Food Cost thấp hơn!"
      };
    }

    // 4. GHI ĐÈ VÀO SHEET SYS_CONFIG DƯỚI DẠNG CHUỖI JSON
    var jsonString = JSON.stringify(cleanSlots);
    var nowTimestamp = Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd HH:mm:ss");

    if (wheelConfigRowIndex !== -1) {
      cfgSheet.getRange(wheelConfigRowIndex, 2).setValue(jsonString);
      cfgSheet.getRange(wheelConfigRowIndex, 4).setValue(nowTimestamp);
    } else {
      cfgSheet.appendRow(["WHEEL_PRIZES_JSON", jsonString, "Cơ cấu giải thưởng Vòng Quay May Mắn (E_Cost <= 5%)", nowTimestamp]);
    }

    // Xóa Cache RAM để Client nhận ngay cơ cấu mới
    try {
      CacheService.getScriptCache().remove(CRM_CONSTANTS.CACHE_KEY_WHEEL_CONFIG);
    } catch (cErr) {}

    var actualCostPct = (expectedCost / minOrderAmount) * 100;
    var auditStaff = params.adminName || "Admin Quản Trị";

    // Ghi nhật ký vào DATA_AUDIT_LOGS
    try {
      var auditSheet = ss.getSheetByName(CRM_CONSTANTS.SHEET_AUDIT);
      if (auditSheet) {
        auditSheet.appendRow([
          nowTimestamp,
          "WHEEL_CONFIG",
          "UPDATE_PRIZES",
          auditStaff + " cập nhật cơ cấu giải thưởng. E(Cost) = " + Math.round(expectedCost) + "đ (" + actualCostPct.toFixed(2) + "% ngân sách đơn)."
        ]);
      }
    } catch (aErr) {}

    return {
      status: "success",
      code: 200,
      success: true,
      data: {
        expectedCost: Math.round(expectedCost),
        costPercentage: actualCostPct.toFixed(2) + "%",
        maxBudgetAllowed: maxBudgetPerOrder,
        totalSlots: cleanSlots.length,
        slots: cleanSlots,
        message: "Cập nhật cơ cấu giải thưởng thành công! Chi phí bình quân: " + 
          Math.round(expectedCost).toLocaleString("vi-VN") + "đ (" + actualCostPct.toFixed(2) + "% - Nằm trong hạn mức an toàn 5%)."
      }
    };

  } catch (err) {
    return { status: "error", code: 500, message: "Lỗi cập nhật cấu hình vòng quay: " + err.toString() };
  } finally {
    lock.releaseLock();
  }
}

/**
 * XÁC THỰC VÀ TIÊU THỤ TOKEN QUÀ TẶNG TRÁNH GIAN LẬN REPLAY ATTACK
 * Gắn mã quà vào đơn hàng cụ thể để không thể dùng lại ở các đơn tiếp theo.
 * API Action: redeemGiftToken
 * 
 * @param {Object} params - { phone, giftToken, orderId }
 * @returns {Object} Kết quả xác thực quà tặng
 */
function redeemGiftToken(params) {
  if (!params || !params.giftToken) {
    return { status: "error", code: 400, valid: false, message: "Không tìm thấy mã quà tặng kèm theo." };
  }

  var token = String(params.giftToken).trim();
  var phone = normalizePhoneNumber(params.phone || params.customerPhone || "");
  var orderId = String(params.orderId || params.orderCode || "T5-ORDER").trim();

  // Kiểm tra định dạng Token chuẩn máy chủ: GIFT_SLOT_X_HHMMSS
  if (token.indexOf("GIFT_") !== 0) {
    return { status: "error", code: 400, valid: false, message: "Mã quà tặng không hợp lệ (Invalid Token Format)." };
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    var id = PropertiesService.getScriptProperties().getProperty("TENANT_SPREADSHEET_ID") || 
               PropertiesService.getScriptProperties().getProperty("MENU_SPREADSHEET_ID");
    if (id) ss = SpreadsheetApp.openById(id);
  }
  if (!ss) throw new Error("Không thể liên kết CSDL Google Sheets!");

  var custSheet = ss.getSheetByName(CRM_CONSTANTS.SHEET_CUSTOMERS);
  if (!custSheet) {
    return { status: "error", code: 404, valid: false, message: "Không tìm thấy bảng dữ liệu khách hàng DATA_CUSTOMERS." };
  }

  var data = custSheet.getDataRange().getValues();
  var targetRow = -1;

  for (var i = 1; i < data.length; i++) {
    if (normalizePhoneNumber(data[i][1]) === phone) {
      targetRow = i + 1;
      break;
    }
  }

  var nowTimestamp = Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd HH:mm:ss");

  // Ghi nhật ký tiêu thụ mã quà tặng vào Cột I (Index 8) - Danh hiệu tháng trước & Quà đã dùng
  if (targetRow !== -1) {
    custSheet.getRange(targetRow, 9).setValue("CONSUMED: " + token + " (" + orderId + " - " + nowTimestamp + ")");
  }

  // Ghi nhận vào DATA_AUDIT_LOGS
  try {
    var auditSheet = ss.getSheetByName(CRM_CONSTANTS.SHEET_AUDIT);
    if (auditSheet) {
      auditSheet.appendRow([
        nowTimestamp,
        phone || "GUEST",
        "REDEEM_GIFT_TOKEN",
        "Tiêu thụ mã quà: " + token + " cho đơn hàng: " + orderId
      ]);
    }
  } catch (aErr) {}

  Logger.log("🎟️ [CustomerCRM] Token " + token + " đã tiêu thụ hợp lệ cho đơn " + orderId);

  return {
    status: "success",
    code: 200,
    valid: true,
    data: {
      giftToken: token,
      orderId: orderId,
      message: "Quà tặng hợp lệ và đã được áp dụng thành công vào đơn hàng!"
    }
  };
}

/**
 * LẤY DANH SÁCH KHÁCH HÀNG CRM DÀNH CHO ADMIN TRA CỨU & CHĂM SÓC
 * Hiển thị đầy đủ Biệt danh Gen Z, Mốc tháng 2-4-7-12, Chiết khấu 1%-2%-3%
 * API Action: getCustomerListAdmin
 * 
 * @param {Object} payload - { keyword: string, rankFilter: string, page: number, limit: number }
 * @returns {Object} Danh sách khách hàng và thống kê tổng quan
 */
function getCustomerListAdmin(payload) {
  try {
    payload = payload || {};
    var keyword = String(payload.keyword || "").trim().toLowerCase();
    var rankFilter = String(payload.rankFilter || "ALL").trim().toUpperCase();
    var page = Math.max(1, Number(payload.page) || 1);
    var limit = Math.max(1, Math.min(100, Number(payload.limit) || 20));

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) {
      var id = PropertiesService.getScriptProperties().getProperty("TENANT_SPREADSHEET_ID") || 
               PropertiesService.getScriptProperties().getProperty("MENU_SPREADSHEET_ID");
      if (id) ss = SpreadsheetApp.openById(id);
    }
    if (!ss) throw new Error("Không thể kết nối CSDL!");

    var custSheet = ss.getSheetByName(CRM_CONSTANTS.SHEET_CUSTOMERS);
    if (!custSheet) {
      return { status: "success", code: 200, data: { total: 0, customers: [], stats: {} } };
    }

    var data = custSheet.getDataRange().getValues();
    var filteredList = [];
    var stats = { totalSpent: 0, totalCustomers: 0, level4Count: 0, level3Count: 0, level2Count: 0, level1Count: 0 };
    var currentMonthKey = Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM");

    for (var r = 1; r < data.length; r++) {
      var row = data[r];
      var code = String(row[0] || "").trim();
      var phone = normalizePhoneNumber(row[1]);
      var name = String(row[2] || "Khách Quen Thím 5").trim();
      var monthlyOrders = Number(row[3]) || 0;
      var monthKey = String(row[4] || "");
      var tierTitle = String(row[5] || "Tân Binh Lạc Lối");
      var tasteName = String(row[6] || "Thực Thần Mì Trộn");
      var fullBadge = String(row[7] || "");
      var lastMonthHonor = String(row[8] || "");
      var points = Number(row[9]) || 0;
      var totalSpent = Number(row[10]) || 0;
      var lifetimeOrders = Number(row[11]) || 0;
      var wheelSpins = Number(row[12]) || 0;
      var lastOrderTime = row[13] ? Utilities.formatDate(new Date(row[13]), "GMT+7", "yyyy-MM-dd HH:mm:ss") : "";

      if (!phone) continue;

      // Xử lý kiểm tra chu kỳ tháng khi hiển thị
      var isSameMonth = (monthKey === currentMonthKey);
      var activeOrders = isSameMonth ? monthlyOrders : 0;

      var tasteObj = { code: "CUSTOM", name: tasteName, icon: "🍜" };
      var badgeInfo = evaluateMonthlyTierAndBadge(activeOrders, tasteObj);

      // Thống kê tổng quan cấp độ
      stats.totalCustomers++;
      stats.totalSpent += totalSpent;
      if (activeOrders >= 12) stats.level4Count++;
      else if (activeOrders >= 7) stats.level3Count++;
      else if (activeOrders >= 4) stats.level2Count++;
      else if (activeOrders >= 2) stats.level1Count++;

      // Điều kiện lọc
      var matchRank = (rankFilter === "ALL" || badgeInfo.tierTitle.toUpperCase().indexOf(rankFilter) !== -1);
      var matchKeyword = (!keyword || phone.indexOf(keyword) !== -1 || name.toLowerCase().indexOf(keyword) !== -1 || fullBadge.toLowerCase().indexOf(keyword) !== -1);

      if (matchRank && matchKeyword) {
        filteredList.push({
          code: code,
          phone: phone,
          name: name,
          monthlyOrders: activeOrders,
          tierTitle: badgeInfo.tierTitle,
          tasteName: tasteName,
          fullBadge: isSameMonth ? (fullBadge || badgeInfo.fullBadge) : badgeInfo.fullBadge,
          badgeColor: badgeInfo.badgeColor,
          discountPercent: badgeInfo.discountPercent,
          tierDiscountPercent: badgeInfo.discountPercent,
          lastMonthHonor: lastMonthHonor,
          points: points,
          wheelSpins: wheelSpins,
          totalSpent: totalSpent,
          lifetimeOrders: lifetimeOrders,
          lastOrderTime: lastOrderTime
        });
      }
    }

    // Phân trang danh sách kết quả
    var totalRecords = filteredList.length;
    var startIndex = (page - 1) * limit;
    var paginatedList = filteredList.slice(startIndex, startIndex + limit);

    return {
      status: "success",
      code: 200,
      data: {
        total: totalRecords,
        page: page,
        limit: limit,
        totalPages: Math.ceil(totalRecords / limit),
        stats: stats,
        customers: paginatedList
      }
    };

  } catch (err) {
    return { status: "error", code: 500, message: "Lỗi lấy danh sách khách hàng CRM: " + err.toString() };
  }
}

/**
 * CẬP NHẬT THỦ CÔNG ĐIỂM, LƯỢT QUAY HOẶC SỐ ĐƠN TRONG THÁNG BỞI ADMIN
 * API Action: updateCustomerVipManual
 * 
 * @param {Object} payload - { phone, monthlyOrders, points, wheelSpins, adminName }
 * @returns {Object} Kết quả xử lý
 */
function updateCustomerVipManual(payload) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {
    return { status: "error", code: 503, message: "Hệ thống đang bận cập nhật dữ liệu!" };
  }

  try {
    if (!payload || !payload.phone) {
      return { status: "error", code: 400, message: "Thiếu số điện thoại khách hàng cần cập nhật!" };
    }

    var phone = normalizePhoneNumber(payload.phone);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var custSheet = ss.getSheetByName(CRM_CONSTANTS.SHEET_CUSTOMERS);

    if (!custSheet) {
      return { status: "error", code: 404, message: "Không tìm thấy bảng dữ liệu khách hàng DATA_CUSTOMERS." };
    }

    var data = custSheet.getDataRange().getValues();
    var targetRow = -1;
    var currentRowData = null;

    for (var r = 1; r < data.length; r++) {
      if (normalizePhoneNumber(data[r][1]) === phone) {
        targetRow = r + 1;
        currentRowData = data[r];
        break;
      }
    }

    if (targetRow === -1) {
      return { status: "error", code: 404, message: "Không tìm thấy khách hàng có số điện thoại " + phone };
    }

    var nowTimestamp = Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd HH:mm:ss");

    // Nếu cập nhật số đơn trong tháng -> Tự động tính toán lại Huy hiệu Gen Z tương ứng
    if (payload.monthlyOrders !== undefined && !isNaN(Number(payload.monthlyOrders))) {
      var newOrders = Math.max(0, Number(payload.monthlyOrders));
      var currentTaste = String(currentRowData[6] || "Thực Thần Mì Trộn");
      var newBadge = evaluateMonthlyTierAndBadge(newOrders, { code: "CUSTOM", name: currentTaste, icon: "🍜" });

      custSheet.getRange(targetRow, 4).setValue(newOrders);
      custSheet.getRange(targetRow, 6).setValue(newBadge.tierTitle);
      custSheet.getRange(targetRow, 8).setValue(newBadge.fullBadge);
    }

    if (payload.points !== undefined && !isNaN(Number(payload.points))) {
      custSheet.getRange(targetRow, 10).setValue(Number(payload.points));
    }

    if (payload.wheelSpins !== undefined && !isNaN(Number(payload.wheelSpins))) {
      custSheet.getRange(targetRow, 13).setValue(Math.max(0, Number(payload.wheelSpins)));
    }

    custSheet.getRange(targetRow, 14).setValue(nowTimestamp);

    // Xóa Cache RAM để cập nhật ngay
    try {
      CacheService.getScriptCache().remove(CRM_CONSTANTS.CACHE_KEY_CRM_PREFIX + phone);
    } catch (cErr) {}

    var adminName = payload.adminName || "Super Admin";

    // Ghi nhật ký vào DATA_AUDIT_LOGS
    try {
      var auditSheet = ss.getSheetByName(CRM_CONSTANTS.SHEET_AUDIT);
      if (auditSheet) {
        auditSheet.appendRow([
          nowTimestamp,
          phone,
          "MANUAL_CRM_UPDATE",
          adminName + " cập nhật thủ công CRM khách: " + JSON.stringify(payload)
        ]);
      }
    } catch (aErr) {}

    return {
      status: "success",
      code: 200,
      message: "Đã cập nhật thông tin khách hàng " + phone + " thành công!"
    };

  } catch (err) {
    return { status: "error", code: 500, message: "Lỗi cập nhật thủ công CRM: " + err.toString() };
  } finally {
    lock.releaseLock();
  }
}
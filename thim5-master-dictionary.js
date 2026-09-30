/**
 * =============================================================================
 * TỆP TIN: thim5-master-dictionary.js (TỪ ĐIỂN CHUẨN HÓA TOÀN HỆ THỐNG SSOT)
 * PHIÊN BẢN: v3.0 SaaS Enterprise Master (Cập nhật 2026)
 * KIẾN TRÚC SƯ TRƯỞNG: ĐU ĐỦ (CỐ VẤN CHIẾN LƯỢC F&B CHO ANH HẢI ÂU)
 * VAI TRÒ:
 *   - Định nghĩa Single Source of Truth (SSOT) cho toàn bộ Client và Backend.
 *   - Khóa cứng tên bảng, tên cột CSDL Google Sheets, tên Action API.
 *   - Cung cấp công thức tính Reverse-Pricing, kiểm toán Food Cost tự động.
 * =============================================================================
 */

(function(global) {
  'use strict';

  var T5_DICT = {
    VERSION: "3.0.20260930",

    // =========================================================================
    // 1. TÊN SHEET CSDL CHUẨN TRÊN GOOGLE SHEETS
    // =========================================================================
    SHEETS: Object.freeze({
      MENU: "DATA_MENU",                   // Thực đơn 13 cột Reverse-Pricing
      CATEGORIES: "SYS_CATEGORIES",       // Danh mục đa ngành 5 cột
      CONFIG: "SYS_CONFIG",               // Cấu hình định danh & cước phí
      ORDERS: "DATA_ORDERS",               // Sổ cái đơn hàng 16 cột
      SHIPPERS: "DATA_SHIPPERS",           // Đội xe tài xế 6 cột
      SHIPPER_LEDGER: "DATA_SHIPPER_LEDGER", // Sổ nợ COD tài xế
      AUDIT_LOGS: "DATA_AUDIT_LOGS"        // Nhật ký kiểm toán hệ thống
    }),

    // =========================================================================
    // 2. BẢNG TIÊU ĐỀ CỘT CHUẨN HÓA (DATABASE SCHEMA DEFINITIONS)
    // =========================================================================
    SCHEMA: Object.freeze({
      // Bảng Thực Đơn 13 Cột Reverse-Pricing
      MENU_COLUMNS: [
        "code",             // Cột 1 (A): Mã Món / SKU
        "name",             // Cột 2 (B): Tên Món Ăn
        "category",         // Cột 3 (C): Nhóm Phân Loại (Slug)
        "appPrice",         // Cột 4 (D): Giá App (Grab/Shopee)
        "discountPercent",   // Cột 5 (E): % Giảm D2C Web
        "d2cPrice",         // Cột 6 (F): Giá Bán D2C Web Thực Tế
        "cogs",             // Cột 7 (G): Giá Vốn Định Lượng (COGS)
        "netProfit",        // Cột 8 (H): Lợi Nhuận Ròng (LNR) Thực Tế
        "status",           // Cột 9 (I): Trạng Thái Bếp (ACTIVE / OUT_OF_STOCK)
        "description",      // Cột 10 (J): Mô Tả & Topping Kèm
        "imageUrl",         // Cột 11 (K): Link Ảnh Direct CDN Google Drive
        "crossSellSuggest", // Cột 12 (L): Mã Món Bán Kèm (Cross-Sell SKU)
        "tag"               // Cột 13 (M): Tag Chiến Lược (BEST_SELLER, BOOSTER...)
      ],

      // Bảng Danh Mục Đa Ngành 5 Cột
      CATEGORY_COLUMNS: [
        "code",             // Cột 1 (A): Mã Danh Mục (CAT_COM, CAT_TOPPING...)
        "icon",             // Cột 2 (B): Biểu Tượng Emoji / Icon
        "name",             // Cột 3 (C): Tên Danh Mục Hiển Thị
        "slug",             // Cột 4 (D): Mã Slug Lọc D2C (com, an-kem, kho...)
        "maxFcPercent"      // Cột 5 (E): Trần Food Cost Cho Phép (%)
      ],

      // Bảng Đội Xe Shipper 6 Cột
      SHIPPER_COLUMNS: [
        "code",             // Cột 1 (A): Mã Shipper (SHIP_01, SHIP_02...)
        "name",             // Cột 2 (B): Tên Tài Xế
        "phone",            // Cột 3 (C): Số Điện Thoại
        "bikePlate",        // Cột 4 (D): Biển Số Xe
        "status",           // Cột 5 (E): Trạng Thái Trực Ca (ACTIVE / INACTIVE)
        "updatedAt"         // Cột 6 (F): Thời Gian Cập Nhật
      ]
    }),

    // =========================================================================
    // 3. BẢNG TỪ ĐIỂN ROUTER ACTIONS & ALIAS ÁNH XẠ TOÀN HỆ THỐNG
    // =========================================================================
    ACTIONS: Object.freeze({
      // Quản trị Thực Đơn & Danh Mục
      GET_ADMIN_MENU_CATALOG: "getAdminMenuCatalog",
      SAVE_OR_UPDATE_MENU_ITEM: "saveOrUpdateMenuItem",
      TOGGLE_MENU_ITEM_STATUS: "toggleMenuItemStatus",
      DELETE_MENU_ITEM: "deleteMenuItem",
      GET_MENU_CATEGORIES: "getMenuCategories",
      SAVE_MENU_CATEGORY: "saveMenuCategory",
      DELETE_MENU_CATEGORY: "deleteMenuCategory",

      // Omni-Ingestion Pipeline
      BATCH_IMPORT_MENU_ITEMS: "batchImportMenuItems",
      UPLOAD_DISH_MEDIA_IMAGE: "uploadDishMediaImage",
      PROCESS_MENU_OCR_WITH_GEMINI: "processMenuOcrWithGemini",
      PARSE_UPLOADED_SPREADSHEET_BUFFER: "parseUploadedSpreadsheetBuffer",
      EXTRACT_MENU_FROM_PUBLIC_URL: "extractMenuFromPublicUrl",
      GET_MENU_EXCEL_TEMPLATE_STRUCTURE: "getMenuExcelTemplateStructure",

      // Đội Xe Shipper & Vận Hành Bếp
      GET_ACTIVE_SHIPPERS_LIST: "getActiveShippersList",
      SAVE_OR_UPDATE_SHIPPER: "saveOrUpdateShipper",
      TOGGLE_SHIPPER_STATUS: "toggleShipperStatus",
      GET_SHIPPER_COD_HOLDING_LEDGER: "getShipperCodHoldingLedger",
      KITCHEN_ASSIGN_SHIPPER: "kitchenAssignShipper",
      KITCHEN_SETTLE_HANDOVER: "kitchenSettleHandover",
      SHIPPER_UPDATE_STEP: "shipperUpdateStep",

      // Storefront D2C & Khách Hàng
      GET_CONFIG: "getConfig",
      CREATE_D2C_ORDER: "createD2COrder",
      GET_ORDER_TRACKING: "getOrderTracking",
      GET_FINANCIAL_PL_SUMMARY: "getFinancialPlSummary"
    }),

    // Bảng Ánh Xạ Bí Danh (Alias Map) Chống Lỗi Lệch Pha Phiên Bản Giữa Các File
    ACTION_ALIASES: Object.freeze({
      "uploadImageToMenuDriveFolder": "uploadDishMediaImage",
      "getMenuCatalog": "getAdminMenuCatalog",
      "updateMenuItem": "saveOrUpdateMenuItem",
      "saveShipper": "saveOrUpdateShipper",
      "updateShipper": "saveOrUpdateShipper",
      "getShippers": "getActiveShippersList",
      "getShippersList": "getActiveShippersList",
      "setShipperStatus": "toggleShipperStatus",
      "placeOrder": "createD2COrder",
      "assignShipper": "kitchenAssignShipper",
      "completeOrder": "shipperUpdateStep"
    }),

    // =========================================================================
    // 4. ĐỊNH MỨC VẬN HÀNH & TRẦN FOOD COST THEO DANH MỤC CHIẾN LƯỢC
    // =========================================================================
    REVERSE_PRICING_CONFIG: Object.freeze({
      DEFAULT_DISCOUNT_PERCENT: 10.0, // Mặc định D2C Web rẻ hơn App 10%
      DEFAULT_BUFFER_PERCENT: 15.0,   // Quỹ đệm 15% (Bù ship + Wheel + Thuế HKD 4.5%)
      MAX_DEBT_CAP_SHIPPER: 300000    // Hạn mức ôm nợ COD tối đa 300.000đ
    }),

    DEFAULT_CATEGORIES: Object.freeze({
      "CORE": { name: "Món Chủ Lực", maxFcPercent: 40.0, icon: "🍜", slug: "kho" },
      "COM": { name: "Món Cơm", maxFcPercent: 45.0, icon: "🍛", slug: "com" },
      "BOOSTER": { name: "Nước Giải Khát", maxFcPercent: 20.0, icon: "🥤", slug: "giai-khat" },
      "TOPPING": { name: "Topping / Ăn Kèm", maxFcPercent: 25.0, icon: "🍳", slug: "an-kem" },
      "COMBO": { name: "Combo Đại Tiệc", maxFcPercent: 35.0, icon: "🍱", slug: "combo" },
      "SOUP": { name: "Món Nước Súp", maxFcPercent: 30.0, icon: "🥣", slug: "nuoc" },
      "DAC_SAN": { name: "Đặc Sản Tây Ninh", maxFcPercent: 45.0, icon: "🎁", slug: "dac-san" }
    })
      // =========================================================================
    // 5. THUẬT TOÁN REVERSE-PRICING ĐỘNG CHUẨN HÓA SSOT (KHỚP 100% BACKEND)
    // =========================================================================
    /**
     * TÍNH TOÁN CƠ CẤU GIÁ VÀ LỢI NHUẬN RÒNG REVERSE-PRICING
     * @param {number} appPrice - Giá niêm yết trên ứng dụng giao đồ ăn
     * @param {number} cogs - Giá vốn định lượng nguyên vật liệu (COGS)
     * @param {number} [optDiscountPercent] - % Giảm D2C Web so với App (Mặc định 10%)
     * @param {number} [optBufferPercent] - % Quỹ đệm D2C (Bù ship + Wheel + Thuế HKD 4.5% - Mặc định 15%)
     * @returns {Object}
     */
    calculateReversePricing: function(appPrice, cogs, optDiscountPercent, optBufferPercent) {
      var rawAppPrice = Number(appPrice) || 0;
      var rawCogs = Number(cogs) || 0;

      var discountPercent = (optDiscountPercent !== undefined && optDiscountPercent !== null && optDiscountPercent !== "")
                            ? Number(optDiscountPercent)
                            : T5_DICT.REVERSE_PRICING_CONFIG.DEFAULT_DISCOUNT_PERCENT;

      var bufferPercent = (optBufferPercent !== undefined && optBufferPercent !== null && optBufferPercent !== "")
                          ? Number(optBufferPercent)
                          : T5_DICT.REVERSE_PRICING_CONFIG.DEFAULT_BUFFER_PERCENT;

      // 1. Tính Giá Bán D2C Web (Làm tròn đến 1.000đ chẵn)
      var rawD2cPrice = rawAppPrice * (1 - (discountPercent / 100));
      var d2cPrice = Math.round(rawD2cPrice / 1000) * 1000;

      // 2. Tính Lợi Nhuận Gộp
      var grossProfit = Math.max(0, d2cPrice - rawCogs);

      // 3. Tính Lợi Nhuận Ròng (LNR) sau khi trích quỹ đệm
      var bufferAmount = Math.round(d2cPrice * (bufferPercent / 100));
      var netProfit = grossProfit - bufferAmount;

      // 4. Tính phần trăm Food Cost thực tế và Biên LNR
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
    },

    /**
     * CHUẨN HÓA DỮ LIỆU MÓN ĂN THÔ THÀNH OBJECT 13 CỘT REVERSE-PRICING
     * @param {Object} rawItem - Dữ liệu thô từ Form, File Excel, hoặc OCR
     * @param {number} [index] - Chỉ số thứ tự trong lô
     * @returns {Object|null}
     */
    normalizeMenuItem: function(rawItem, index) {
      if (!rawItem || typeof rawItem !== "object") return null;

      var name = String(rawItem.name || rawItem.title || rawItem.ten_mon || "").trim();
      if (!name) return null;

      var cat = String(rawItem.category || rawItem.nhom || rawItem.phan_loai || "").trim().toUpperCase();
      var lowerName = name.toLowerCase();

      // Tự động nhận diện danh mục thông minh nếu thiếu
      if (!cat || !T5_DICT.DEFAULT_CATEGORIES[cat]) {
        if (lowerName.indexOf("cơm") !== -1) cat = "COM";
        else if (lowerName.indexOf("trà") !== -1 || lowerName.indexOf("nước") !== -1 || lowerName.indexOf("sữa") !== -1) cat = "BOOSTER";
        else if (lowerName.indexOf("bánh tráng") !== -1 || lowerName.indexOf("muối") !== -1 || lowerName.indexOf("bò tơ") !== -1) cat = "DAC_SAN";
        else if (lowerName.indexOf("combo") !== -1 || lowerName.indexOf("đại tiệc") !== -1 || lowerName.indexOf("set") !== -1) cat = "COMBO";
        else if (lowerName.indexOf("súp") !== -1 || lowerName.indexOf("sup") !== -1 || lowerName.indexOf("canh") !== -1) cat = "SOUP";
        else if (lowerName.indexOf("topping") !== -1 || lowerName.indexOf("thêm") !== -1 || lowerName.indexOf("trứng") !== -1 || lowerName.indexOf("tóp mỡ") !== -1) cat = "TOPPING";
        else cat = "CORE";
      }

      var rawAppPriceStr = String(rawItem.appPrice || rawItem.price || rawItem.gia_app || rawItem.gia_ban || "0").replace(/[^\d]/g, '');
      var appPrice = Number(rawAppPriceStr) || 0;

      var rawCogsStr = String(rawItem.cogs || rawItem.cost || rawItem.gia_von || rawItem.food_cost || "0").replace(/[^\d]/g, '');
      var cogs = Number(rawCogsStr) || 0;

      var discountPercent = (rawItem.discountPercent !== undefined && rawItem.discountPercent !== null && rawItem.discountPercent !== "")
                            ? Number(rawItem.discountPercent)
                            : T5_DICT.REVERSE_PRICING_CONFIG.DEFAULT_DISCOUNT_PERCENT;

      // Áp định mức giá vốn tự động theo nhóm danh mục nếu chưa nhập
      if (cogs === 0 && appPrice > 0) {
        var catTargetFc = (T5_DICT.DEFAULT_CATEGORIES[cat] && T5_DICT.DEFAULT_CATEGORIES[cat].maxFcPercent) ? T5_DICT.DEFAULT_CATEGORIES[cat].maxFcPercent : 35.0;
        cogs = Math.round(appPrice * (catTargetFc / 100));
      }

      var pricing = T5_DICT.calculateReversePricing(appPrice, cogs, discountPercent);

      var code = String(rawItem.code || rawItem.ma_mon || "").trim().toUpperCase();
      if (!code) {
        var timestampStr = Date.now().toString().slice(-6);
        code = "ITEM_" + timestampStr + "_" + (index !== undefined ? index : Math.floor(Math.random() * 1000));
      }

      var status = String(rawItem.status || "ACTIVE").trim().toUpperCase();
      if (status !== "ACTIVE" && status !== "OUT_OF_STOCK") status = "ACTIVE";

      return {
        code: code,
        name: name,
        category: cat,
        appPrice: appPrice,
        discountPercent: discountPercent,
        d2cPrice: pricing.d2cPrice,
        cogs: cogs,
        cost: cogs, // Alias tương thích ngược
        netProfit: pricing.netProfit,
        fcPercentD2c: pricing.fcPercentD2c,
        lnrMarginPercent: pricing.lnrMarginPercent,
        status: status,
        isAvailable: (status === "ACTIVE"),
        description: String(rawItem.description || rawItem.mo_ta || rawItem.desc || "").trim(),
        imageUrl: String(rawItem.imageUrl || rawItem.image || rawItem.link_anh || "").trim(),
        crossSellSuggest: String(rawItem.crossSellSuggest || rawItem.cross_sell || rawItem.ban_kem || "").trim().toUpperCase(),
        tag: String(rawItem.tag || rawItem.nhan || "CORE").trim().toUpperCase()
      };
    },

    // =========================================================================
    // 6. THUẬT TOÁN HAVERSINE ĐO KHOẢNG CÁCH GPS & BIỂU PHÍ VẬN CHUYỂN
    // =========================================================================
    /**
     * TÍNH KHOẢNG CÁCH HAVERSINE GIỮA 2 ĐIỂM TỌA ĐỘ VỆ TINH (KM)
     * @param {number} lat1 - Vĩ độ điểm 1
     * @param {number} lon1 - Kinh độ điểm 1
     * @param {number} lat2 - Vĩ độ điểm 2
     * @param {number} lon2 - Kinh độ điểm 2
     * @returns {number} Khoảng cách km (làm tròn 2 chữ số thập phân)
     */
    calculateHaversineDistance: function(lat1, lon1, lat2, lon2) {
      var nLat1 = Number(lat1) || 0;
      var nLon1 = Number(lon1) || 0;
      var nLat2 = Number(lat2) || 0;
      var nLon2 = Number(lon2) || 0;

      if (nLat1 === 0 || nLon1 === 0 || nLat2 === 0 || nLon2 === 0) return 1.8;

      var R = 6371; // Bán kính Trái Đất (km)
      var dLat = (nLat2 - nLat1) * (Math.PI / 180);
      var dLon = (nLon2 - nLon1) * (Math.PI / 180);
      var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(nLat1 * (Math.PI / 180)) * Math.cos(nLat2 * (Math.PI / 180)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
      var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return Number((R * c).toFixed(2));
    },

    /**
     * TÍNH CƯỚC PHÍ SHIP VÀ TRỢ GIÁ THEO MA TRẬN 3 CHIỀU (AOV x DISTANCE x MARGIN)
     * @param {number} distKm - Cự ly giao hàng (km)
     * @param {number} subtotal - Tổng tiền món ăn (VND)
     * @param {Object} [optFlags] - { isRainMode, hasHighMarginItem }
     * @returns {Object}
     */
    calculateLogisticsPricing: function(distKm, subtotal, optFlags) {
      var dist = Number(distKm) || 1.8;
      var amount = Number(subtotal) || 0;
      var flags = optFlags || {};

      // Cước cơ sở: 12.000đ cho 2km đầu, mỗi km tiếp theo +4.500đ
      var fee = 12000;
      if (dist > 2.0) {
        fee += Math.ceil(dist - 2.0) * 4500;
      }
      fee = Math.ceil(fee / 1000) * 1000; // Làm tròn 1.000đ chẵn

      var subsidy = 0;
      var reason = "";

      // Nấc 3: Cự ly >= 4.0km đơn từ 149k hoặc từ 110k có món biên lãi cao (Trà đào / Combo)
      if (dist >= 4.0 && (amount >= 149000 || (amount >= 110000 && flags.hasHighMarginItem))) {
        subsidy = 15000;
        reason = "Hỗ trợ khách xa > 4km";
      }
      // Nấc 2: Cự ly >= 3.5km đơn từ 120k
      else if (dist >= 3.5 && amount >= 120000) {
        subsidy = 10000;
        reason = "Hỗ trợ ship đường xa > 3.5km";
      }
      // Nấc 1: Đơn từ 89k
      else if (amount >= 89000) {
        subsidy = 5000;
        reason = "Ưu đãi đơn từ 89k";
      }

      var appliedSubsidy = Math.min(fee, subsidy);
      var customerPayFee = Math.max(0, fee - appliedSubsidy);

      return {
        distanceKm: dist,
        baseShippingFee: fee,
        shippingSubsidy: appliedSubsidy,
        customerPayShipFee: customerPayFee,
        subsidyReason: reason,
        isFreeShip: (customerPayFee === 0 && fee > 0)
      };
    },

    // =========================================================================
    // 7. CHUẨN HÓA ĐƠN HÀNG 16 CỘT TRƯỚC KHI GHI VÀO DATA_ORDERS
    // =========================================================================
    /**
     * CHUẨN HÓA ĐỐI TƯỢNG ĐƠN HÀNG ĐỒNG BỘ 100% CSDL GOOGLE SHEETS
     * @param {Object} rawOrder - Dữ liệu đơn hàng thô từ Form Checkout
     * @returns {Object}
     */
    normalizeOrderEntity: function(rawOrder) {
      if (!rawOrder || typeof rawOrder !== "object") return null;

      var now = new Date();
      var yearStr = String(now.getFullYear()).slice(-2);
      var monthStr = String(now.getMonth() + 1).padStart(2, '0');
      var dayStr = String(now.getDate()).padStart(2, '0');
      var randSuffix = Math.floor(1000 + Math.random() * 9000);
      var orderCode = rawOrder.orderCode || ("DH" + yearStr + monthStr + dayStr + "_" + randSuffix);

      var customer = rawOrder.customer || {};
      var subtotal = Number(rawOrder.subtotal) || 0;
      var shipFee = Number(rawOrder.shippingFee) || 0;
      var shipSub = Number(rawOrder.shippingSubsidy) || 0;
      var finalTotal = Number(rawOrder.finalTotal) || (subtotal + Math.max(0, shipFee - shipSub));

      return {
        orderCode: orderCode,
        orderId: orderCode,
        customerName: String(customer.name || rawOrder.customerName || "Khách Hàng").trim(),
        customerPhone: String(customer.phone || rawOrder.customerPhone || "").trim().replace(/\D/g, ''),
        customerAddress: String(customer.address || rawOrder.customerAddress || "").trim(),
        customerLocation: customer.location || rawOrder.customerLocation || null,
        items: Array.isArray(rawOrder.items) ? rawOrder.items : [],
        gift: rawOrder.gift || null,
        giftName: rawOrder.giftName || (rawOrder.gift ? rawOrder.gift.name : ""),
        subtotal: subtotal,
        shippingFee: shipFee,
        shippingSubsidy: shipSub,
        subsidyReason: String(rawOrder.subsidyReason || "").trim(),
        finalTotal: finalTotal,
        paymentMethod: String(rawOrder.paymentMethod || "COD").toUpperCase().trim(),
        status: String(rawOrder.status || "WAIT_CONFIRM").toUpperCase().trim(),
        note: String(rawOrder.note || "").trim(),
        timestamp: rawOrder.timestamp || now.toISOString()
      };
    }
  };

  // ===========================================================================
  // 8. XUẤT BẢN THƯ VIỆN RA PHẠM VI TOÀN CỤC (GLOBAL EXPORT)
  // ===========================================================================
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = T5_DICT;
  }
  if (typeof global !== 'undefined') {
    global.T5_DICT = T5_DICT;
    global.T5_SSOT = T5_DICT;
    global.T5_MASTER = T5_DICT;
  }

})(typeof window !== 'undefined' ? window : this);

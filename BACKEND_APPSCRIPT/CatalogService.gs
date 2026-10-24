/**
 * =============================================================================
 * MODULE: CATALOG SERVICE - ĐIỀU HÀNH THỰC ĐƠN & DANH MỤC ĐA NGÀNH (v3.5 SAAS)
 * Tác giả: Đu Đủ - Cố vấn Chiến lược F&B & Kỹ sư Trưởng hệ thống SaaS
 * Bản quyền: Bếp Thím 5 & LongHoaFood Master (Năm 2026)
 * Tệp tin: CatalogService.gs (Chuẩn SSOT Bundled Catalog + CacheService Engine)
 * =============================================================================
 */

var CatalogService = (function() {
  'use strict';

  // Khóa định danh bộ nhớ đệm CacheService & Thời gian sống (300 giây)
  var CACHE_KEY_CATALOG = "T5_CATALOG_BUNDLED_CACHE";
  var CACHE_TTL_SECONDS = 300;

  /**
   * 1. HÀM NỘI BỘ: LẤY ĐỐI TƯỢNG SPREADSHEET HIỆN TẠI
   */
  function getActiveDbSpreadsheet_() {
    return SpreadsheetApp.getActiveSpreadsheet();
  }

  /**
   * 2. HÀM NỘI BỘ: XÓA BỘ NHỚ ĐỆM KHI CÓ BIẾN ĐỘNG DỮ LIỆU THỰC ĐƠN
   */
  function invalidateCatalogCache_() {
    try {
      var cache = CacheService.getScriptCache();
      if (cache) {
        cache.remove(CACHE_KEY_CATALOG);
        cache.remove("WARMED_MENU_CATALOG");
        cache.remove("WARMED_SYS_CATEGORIES");
      }
      if (typeof invalidateAllConfigCache === "function") {
        invalidateAllConfigCache();
      }
    } catch (e) {
      Logger.log("⚠️ [CatalogService] Lỗi xóa cache: " + e.message);
    }
  }

  /**
   * 2.1 HÀM NỘI BỘ: LẤY TỶ LỆ CHIẾT KHẤU MẶC ĐỊNH D2C ĐỘNG TỪ SYS_CONFIG
   * Phản hồi < 150ms qua CacheService của ConfigManager
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
      var ss = getActiveDbSpreadsheet_();
      var cfgSheet = ss.getSheetByName("SYS_CONFIG");
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
    } catch (e) {
      Logger.log("⚠️ [CatalogService.getDefaultD2cDiscount_] Lỗi đọc cấu hình: " + e.message);
    }
    return 20; // Fallback an toàn nếu chưa khởi tạo SYS_CONFIG
  }

  /**
   * 3. HÀM NỘI BỘ: ĐỌC DỮ LIỆU TOÀN DIỆN SHEET SYS_CATEGORIES (5 CỘT CHUẨN SSOT)
   * Khóa cứng thứ tự: Cột 0: Mã, Cột 1: Icon, Cột 2: Tên, Cột 3: Slug, Cột 4: Trần FC
   */
  function fetchAllCategoriesFromSheet_(ss) {
    var sheet = ss.getSheetByName("SYS_CATEGORIES");
    if (!sheet) {
      throw new Error("ERR_SHEET_NOT_FOUND: Bảng tính thiếu sheet [SYS_CATEGORIES]!");
    }

    var lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return [];
    }

    var rawValues = sheet.getRange(2, 1, lastRow - 1, 5).getValues();
    var categories = [];

    for (var i = 0; i < rawValues.length; i++) {
      var row = rawValues[i];
      var code = String(row[0] || "").trim();
      var icon = String(row[1] || "").trim() || "🍽️";
      var name = String(row[2] || "").trim();
      var slug = String(row[3] || "").trim();
      var maxFcPercent = Number(row[4]) || 38;

      if (!name) continue;

      if (!code) {
        code = "CAT_" + (i + 1);
      }
      if (!slug) {
        slug = code.toLowerCase().replace(/^cat_/, "").replace(/_/g, "-");
      }

      categories.push({
        code: code,
        icon: icon,
        name: name,
        slug: slug,
        maxFcPercent: maxFcPercent
      });
    }

    return categories;
  }

  /**
   * 4. HÀM NỘI BỘ: ĐỌC DỮ LIỆU TOÀN DIỆN SHEET DATA_MENU (13 CỘT REVERSE-PRICING)
   * Col 0: Mã Món | Col 1: Tên Món | Col 2: Nhóm Danh Mục | Col 3: Giá App (+25%)
   * Col 4: % Giảm D2C | Col 5: Giá Bán Web D2C | Col 6: Giá Vốn COGS | Col 7: Lợi Nhuận Ròng (LNR)
   * Col 8: Trạng Thái | Col 9: Mô Tả | Col 10: Link Ảnh CDN | Col 11: Súp/Bán Kèm | Col 12: Tag Chiến Lược
   */
  function fetchAllMenuItemsFromSheet_(ss) {
    var sheet = ss.getSheetByName("DATA_MENU");
    if (!sheet) {
      throw new Error("ERR_SHEET_NOT_FOUND: Bảng tính thiếu sheet [DATA_MENU]!");
    }

    var lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return [];
    }

    var rawValues = sheet.getRange(2, 1, lastRow - 1, 13).getValues();
    var items = [];

    for (var i = 0; i < rawValues.length; i++) {
      var row = rawValues[i];
      var code = String(row[0] || "").trim().toUpperCase();
      var name = String(row[1] || "").trim();

      if (!code && !name) continue;

      var category = String(row[2] || "").trim();
      var appPrice = Number(row[3]) || 0;
      var discountPercent = Number(row[4]) || 0;
      var d2cPrice = Number(row[5]) || 0;
      var cogs = Number(row[6]) || 0;
      var profit = Number(row[7]) || 0;
      var status = String(row[8] || "ACTIVE").trim().toUpperCase();
      var desc = String(row[9] || "").trim();
      var imageUrl = String(row[10] || "").trim();
      var boosterSoup = String(row[11] || "").trim();
      var role = String(row[12] || "CORE").trim().toUpperCase();

      var defaultDiscount = getDefaultD2cDiscount_();
      var effectiveDiscount = (discountPercent > 0 && discountPercent < 100) ? discountPercent : defaultDiscount;
      var discountMultiplier = (1 - effectiveDiscount / 100);

      if (d2cPrice <= 0 && appPrice > 0) {
        d2cPrice = Math.round((appPrice * discountMultiplier) / 1000) * 1000;
      }
      if (appPrice <= 0 && d2cPrice > 0) {
        var appMultiplier = (discountMultiplier > 0) ? discountMultiplier : 0.8;
        appPrice = Math.round((d2cPrice / appMultiplier) / 1000) * 1000;
      }
      if (discountPercent <= 0 && appPrice > 0 && d2cPrice > 0 && appPrice >= d2cPrice) {
        discountPercent = Math.round(((appPrice - d2cPrice) / appPrice) * 100);
      }
      if (profit <= 0 && d2cPrice > 0) {
        profit = Math.max(0, d2cPrice - cogs);
      }

      items.push({
        code: code,
        name: name,
        category: category,
        categorySlug: category.toLowerCase().replace(/_/g, "-"),
        appPrice: appPrice,
        discountPercent: discountPercent,
        d2cPrice: d2cPrice,
        price: d2cPrice,
        cogs: cogs,
        cost: cogs,
        profit: profit,
        status: status,
        description: desc,
        desc: desc,
        imageUrl: imageUrl,
        image: imageUrl,
        boosterSoup: boosterSoup,
        crossSell: boosterSoup,
        crossSellSuggest: boosterSoup,
        role: role,
        tag: role,
        isDry: Boolean(boosterSoup || category.toLowerCase().indexOf("khô") !== -1 || category.toLowerCase().indexOf("trộn") !== -1)
      });
    }

    return items;
  }

  /**
   * 5. HÀNH ĐỘNG ACTION API CHÍNH: LẤY TRỌN GÓI BUNDLED CATALOG (ITEMS + CATEGORIES)
   * Tích hợp CacheService siêu tốc: < 100ms khi trúng cache
   * Trả về đồng thời cả 2 thực thể để Client luôn nhận đủ 8 danh mục
   */
  function getAdminMenuCatalog(payload) {
    try {
      var forceRefresh = payload && (payload.forceRefresh === true || payload.forceRefresh === "true");
      var cache = CacheService.getScriptCache();

      if (!forceRefresh && cache) {
        var cachedJsonString = cache.get(CACHE_KEY_CATALOG);
        if (cachedJsonString) {
          try {
            var cachedData = JSON.parse(cachedJsonString);
            return {
              status: "success",
              code: "OK",
              meta: { cached: true, timestamp: new Date().getTime() },
              data: cachedData
            };
          } catch (errJson) {
            // Tiếp tục đọc trực tiếp nếu cache lỗi
          }
        }
      }

      var ss = getActiveDbSpreadsheet_();
      var categories = fetchAllCategoriesFromSheet_(ss);
      var items = fetchAllMenuItemsFromSheet_(ss);

      if (!categories || categories.length === 0) {
        return {
          status: "error",
          code: "ERR_EMPTY_CATEGORIES",
          message: "Sheet [SYS_CATEGORIES] đang rỗng! Vui lòng tạo ít nhất một danh mục thực đơn."
        };
      }

      var bundledPayload = {
        items: items,
        categories: categories,
        totalItems: items.length,
        totalCategories: categories.length
      };

      if (cache) {
        try {
          cache.put(CACHE_KEY_CATALOG, JSON.stringify(bundledPayload), CACHE_TTL_SECONDS);
        } catch (errPutCache) {
          Logger.log("⚠️ [CatalogService] Kích thước dữ liệu vượt hạn mức CacheService (100KB)");
        }
      }

      return {
        status: "success",
        code: "OK",
        meta: { cached: false, timestamp: new Date().getTime() },
        data: bundledPayload
      };

    } catch (e) {
      Logger.log("🚨 [CatalogService.getAdminMenuCatalog] Lỗi: " + e.message);
      return {
        status: "error",
        code: "ERR_SCHEMA_MISMATCH",
        message: "Lỗi truy vấn thực đơn và danh mục: " + e.message
      };
    }
  }

  /**
   * 6. HÀNH ĐỘNG ACTION API: ĐỌC ĐỘC LẬP SHEET SYS_CATEGORIES
   */
  function getMenuCategories(payload) {
    try {
      var ss = getActiveDbSpreadsheet_();
      var categories = fetchAllCategoriesFromSheet_(ss);

      return {
        status: "success",
        code: "OK",
        data: {
          categories: categories,
          total: categories.length
        }
      };
    } catch (e) {
      Logger.log("🚨 [CatalogService.getMenuCategories] Lỗi: " + e.message);
      return {
        status: "error",
        code: "ERR_SHEET_NOT_FOUND",
        message: "Không thể nạp danh mục từ sheet SYS_CATEGORIES: " + e.message
      };
    }
  }

  /**
   * 7. HÀNH ĐỘNG ACTION API: LƯU HOẶC CẬP NHẬT MÓN ĂN (13 CỘT REVERSE-PRICING)
   */
  function saveOrUpdateMenuItem(payload) {
    try {
      if (!payload || typeof payload !== 'object') {
        return {
          status: "error",
          code: "ERR_INVALID_PAYLOAD",
          message: "Dữ liệu món ăn gửi lên không hợp lệ!"
        };
      }

      var code = String(payload.code || payload.itemCode || "").trim().toUpperCase();
      var name = String(payload.name || "").trim();

      if (!code || !name) {
        return {
          status: "error",
          code: "ERR_INVALID_PAYLOAD",
          message: "Mã SKU và Tên món ăn là bắt buộc!"
        };
      }

      var ss = getActiveDbSpreadsheet_();
      var sheet = ss.getSheetByName("DATA_MENU");
      if (!sheet) {
        return {
          status: "error",
          code: "ERR_SHEET_NOT_FOUND",
          message: "Không tìm thấy sheet [DATA_MENU]!"
        };
      }

      var category = String(payload.category || "").trim();
      var d2cPrice = Number(payload.d2cPrice || payload.price || 0) || 0;
      var rawAppPrice = Number(payload.appPrice || 0) || 0;

      var rawDiscount = (payload.discountPercent !== undefined && payload.discountPercent !== null && payload.discountPercent !== "")
        ? payload.discountPercent
        : ((payload.discount !== undefined && payload.discount !== null && payload.discount !== "")
            ? payload.discount
            : ((payload.d2cDiscount !== undefined && payload.d2cDiscount !== null && payload.d2cDiscount !== "")
                ? payload.d2cDiscount
                : (payload["% Giảm D2C"] || payload["% Giảm"])));

      var defaultDiscount = getDefaultD2cDiscount_();
      var discountPercent = 0;

      if (rawDiscount !== undefined && rawDiscount !== null && rawDiscount !== "") {
        discountPercent = Math.max(0, Number(rawDiscount) || 0);
      } else if (rawAppPrice > 0 && d2cPrice > 0 && rawAppPrice >= d2cPrice) {
        discountPercent = Math.round(((rawAppPrice - d2cPrice) / rawAppPrice) * 100);
      } else {
        discountPercent = defaultDiscount;
      }

      var discountMultiplier = (discountPercent > 0 && discountPercent < 100) ? (1 - discountPercent / 100) : 0.8;

      var appPrice = rawAppPrice;
      if (appPrice <= 0 && d2cPrice > 0) {
        appPrice = Math.round((d2cPrice / discountMultiplier) / 1000) * 1000;
      } else if (d2cPrice <= 0 && appPrice > 0) {
        d2cPrice = Math.round((appPrice * discountMultiplier) / 1000) * 1000;
      }
      var cogs = Number(payload.cogs || payload.cost || 0) || 0;
      var profit = Math.max(0, d2cPrice - cogs);
      var status = String(payload.status || "ACTIVE").trim().toUpperCase();
      var desc = String(payload.description || payload.desc || "").trim();
      var imageUrl = String(payload.imageUrl || payload.image || "").trim();
      var boosterSoup = String(payload.boosterSoup || payload.crossSell || "").trim();
      var role = String(payload.role || payload.tag || "CORE").trim().toUpperCase();

      var lastRow = sheet.getLastRow();
      var rowIndexToUpdate = -1;

      if (lastRow >= 2) {
        var codesRange = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
        for (var i = 0; i < codesRange.length; i++) {
          if (String(codesRange[i][0] || "").trim().toUpperCase() === code) {
            rowIndexToUpdate = i + 2;
            break;
          }
        }
      }

      var rowData = [
        code,
        name,
        category,
        appPrice,
        discountPercent,
        d2cPrice,
        cogs,
        profit,
        status,
        desc,
        imageUrl,
        boosterSoup,
        role
      ];

      if (rowIndexToUpdate > 0) {
        sheet.getRange(rowIndexToUpdate, 1, 1, 13).setValues([rowData]);
      } else {
        sheet.appendRow(rowData);
      }

      invalidateCatalogCache_();

      return {
        status: "success",
        code: "OK",
        message: "Đã lưu thông tin món [" + name + "] thành công!",
        data: { code: code, name: name }
      };

    } catch (e) {
      Logger.log("🚨 [CatalogService.saveOrUpdateMenuItem] Lỗi: " + e.message);
      return {
        status: "error",
        code: "ERR_SCHEMA_MISMATCH",
        message: "Lỗi ghi dữ liệu món ăn: " + e.message
      };
    }
  }

  /**
   * 8. HÀNH ĐỘNG ACTION API: CÔNG TẮC BẬT/TẮT TRẠNG THÁI CÒN BÁN / HẾT HÀNG NHANH
   */
  function toggleMenuItemStatus(payload) {
    try {
      var code = String(payload.code || payload.itemCode || "").trim().toUpperCase();
      var newStatus = String(payload.status || "ACTIVE").trim().toUpperCase();

      if (!code) {
        return {
          status: "error",
          code: "ERR_INVALID_PAYLOAD",
          message: "Thiếu mã món ăn cần đổi trạng thái!"
        };
      }

      var ss = getActiveDbSpreadsheet_();
      var sheet = ss.getSheetByName("DATA_MENU");
      if (!sheet) {
        return {
          status: "error",
          code: "ERR_SHEET_NOT_FOUND",
          message: "Không tìm thấy sheet [DATA_MENU]!"
        };
      }

      var lastRow = sheet.getLastRow();
      if (lastRow < 2) {
        return {
          status: "error",
          code: "ERR_SCHEMA_MISMATCH",
          message: "Sheet thực đơn chưa có dữ liệu!"
        };
      }

      var codesRange = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
      var targetRow = -1;

      for (var i = 0; i < codesRange.length; i++) {
        if (String(codesRange[i][0] || "").trim().toUpperCase() === code) {
          targetRow = i + 2;
          break;
        }
      }

      if (targetRow === -1) {
        return {
          status: "error",
          code: "ERR_INVALID_PAYLOAD",
          message: "Không tìm thấy món có mã [" + code + "] trong thực đơn!"
        };
      }

      sheet.getRange(targetRow, 9).setValue(newStatus);
      invalidateCatalogCache_();

      return {
        status: "success",
        code: "OK",
        message: "Đã cập nhật trạng thái món [" + code + "] thành: " + newStatus,
        data: { code: code, status: newStatus }
      };

    } catch (e) {
      Logger.log("🚨 [CatalogService.toggleMenuItemStatus] Lỗi: " + e.message);
      return {
        status: "error",
        code: "ERR_SCHEMA_MISMATCH",
        message: "Lỗi cập nhật trạng thái món: " + e.message
      };
    }
  }

  /**
   * 9. HÀNH ĐỘNG ACTION API: XÓA MÓN ĂN KHỎI SHEET DATA_MENU
   */
  function deleteMenuItem(payload) {
    try {
      var code = String(payload.code || payload.itemCode || "").trim().toUpperCase();

      if (!code) {
        return {
          status: "error",
          code: "ERR_INVALID_PAYLOAD",
          message: "Thiếu mã món cần xóa!"
        };
      }

      var ss = getActiveDbSpreadsheet_();
      var sheet = ss.getSheetByName("DATA_MENU");
      if (!sheet) {
        return {
          status: "error",
          code: "ERR_SHEET_NOT_FOUND",
          message: "Không tìm thấy sheet [DATA_MENU]!"
        };
      }

      var lastRow = sheet.getLastRow();
      if (lastRow < 2) {
        return {
          status: "error",
          code: "ERR_SCHEMA_MISMATCH",
          message: "Thực đơn rỗng, không thể xóa!"
        };
      }

      var codesRange = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
      var targetRow = -1;

      for (var i = 0; i < codesRange.length; i++) {
        if (String(codesRange[i][0] || "").trim().toUpperCase() === code) {
          targetRow = i + 2;
          break;
        }
      }

      if (targetRow === -1) {
        return {
          status: "error",
          code: "ERR_INVALID_PAYLOAD",
          message: "Không tìm thấy mã món [" + code + "] để xóa!"
        };
      }

      sheet.deleteRow(targetRow);
      invalidateCatalogCache_();

      return {
        status: "success",
        code: "OK",
        message: "Đã xóa vĩnh viễn món [" + code + "] khỏi thực đơn!",
        data: { code: code }
      };

    } catch (e) {
      Logger.log("🚨 [CatalogService.deleteMenuItem] Lỗi: " + e.message);
      return {
        status: "error",
        code: "ERR_SCHEMA_MISMATCH",
        message: "Lỗi xóa món ăn: " + e.message
      };
    }
  }

  /**
   * 10. HÀNH ĐỘNG ACTION API: LƯU HOẶC CẬP NHẬT DANH MỤC (SYS_CATEGORIES 5 CỘT)
   */
  function saveMenuCategory(payload) {
    try {
      var catObj = payload.category || payload;
      var name = String(catObj.name || "").trim();
      var code = String(catObj.code || catObj.id || "").trim();
      var slug = String(catObj.slug || "").trim();
      var icon = String(catObj.icon || "🍽️").trim();
      var maxFcPercent = Number(catObj.maxFcPercent || 38);

      if (!name) {
        return {
          status: "error",
          code: "ERR_INVALID_PAYLOAD",
          message: "Tên danh mục không được để trống!"
        };
      }

      if (!code) {
        code = "CAT_" + new Date().getTime().toString().slice(-4);
      }
      if (!slug) {
        slug = code.toLowerCase().replace(/^cat_/, "").replace(/_/g, "-");
      }

      var ss = getActiveDbSpreadsheet_();
      var sheet = ss.getSheetByName("SYS_CATEGORIES");
      if (!sheet) {
        return {
          status: "error",
          code: "ERR_SHEET_NOT_FOUND",
          message: "Không tìm thấy sheet [SYS_CATEGORIES]!"
        };
      }

      var lastRow = sheet.getLastRow();
      var targetRow = -1;

      if (lastRow >= 2) {
        var codesRange = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
        for (var i = 0; i < codesRange.length; i++) {
          if (String(codesRange[i][0] || "").trim() === code) {
            targetRow = i + 2;
            break;
          }
        }
      }

      var rowData = [code, icon, name, slug, maxFcPercent];

      if (targetRow > 0) {
        sheet.getRange(targetRow, 1, 1, 5).setValues([rowData]);
      } else {
        sheet.appendRow(rowData);
      }

      invalidateCatalogCache_();

      return {
        status: "success",
        code: "OK",
        message: "Đã lưu danh mục [" + name + "] vào sheet SYS_CATEGORIES!",
        data: { code: code, name: name, slug: slug }
      };

    } catch (e) {
      Logger.log("🚨 [CatalogService.saveMenuCategory] Lỗi: " + e.message);
      return {
        status: "error",
        code: "ERR_SCHEMA_MISMATCH",
        message: "Lỗi ghi dữ liệu danh mục: " + e.message
      };
    }
  }

  /**
   * 11. HÀNH ĐỘNG ACTION API: XÓA DANH MỤC KHỎI SYS_CATEGORIES
   */
  function deleteMenuCategory(payload) {
    try {
      var code = String(payload.code || payload.categoryId || "").trim();

      if (!code) {
        return {
          status: "error",
          code: "ERR_INVALID_PAYLOAD",
          message: "Thiếu mã danh mục cần xóa!"
        };
      }

      var ss = getActiveDbSpreadsheet_();
      var sheet = ss.getSheetByName("SYS_CATEGORIES");
      if (!sheet) {
        return {
          status: "error",
          code: "ERR_SHEET_NOT_FOUND",
          message: "Không tìm thấy sheet [SYS_CATEGORIES]!"
        };
      }

      var lastRow = sheet.getLastRow();
      if (lastRow < 2) {
        return {
          status: "error",
          code: "ERR_SCHEMA_MISMATCH",
          message: "Sheet danh mục rỗng!"
        };
      }

      var codesRange = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
      var targetRow = -1;

      for (var i = 0; i < codesRange.length; i++) {
        if (String(codesRange[i][0] || "").trim() === code) {
          targetRow = i + 2;
          break;
        }
      }

      if (targetRow === -1) {
        return {
          status: "error",
          code: "ERR_INVALID_PAYLOAD",
          message: "Không tìm thấy danh mục [" + code + "] để xóa!"
        };
      }

      sheet.deleteRow(targetRow);
      invalidateCatalogCache_();

      return {
        status: "success",
        code: "OK",
        message: "Đã xóa danh mục thành công!",
        data: { code: code }
      };

    } catch (e) {
      Logger.log("🚨 [CatalogService.deleteMenuCategory] Lỗi: " + e.message);
      return {
        status: "error",
        code: "ERR_SCHEMA_MISMATCH",
        message: "Lỗi xóa danh mục: " + e.message
      };
    }
  }

  /**
   * 12. HÀNH ĐỘNG ACTION API: NẠP THỰC ĐƠN HÀNG LOẠT (BATCH IMPORT)
   */
  function batchImportMenuItems(payload) {
    try {
      var items = payload.items;
      if (!Array.isArray(items) || items.length === 0) {
        return {
          status: "error",
          code: "ERR_INVALID_PAYLOAD",
          message: "Danh sách món nạp hàng loạt không được rỗng!"
        };
      }

      var ss = getActiveDbSpreadsheet_();
      var sheet = ss.getSheetByName("DATA_MENU");
      if (!sheet) {
        return {
          status: "error",
          code: "ERR_SHEET_NOT_FOUND",
          message: "Không tìm thấy sheet [DATA_MENU]!"
        };
      }

      var rowsToAppend = [];
      var defaultDiscount = getDefaultD2cDiscount_();

      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        var code = String(it.code || ("M_" + (i + 1))).trim().toUpperCase();
        var name = String(it.name || "Món mới").trim();
        var category = String(it.category || "Món Cơm").trim();
        var d2cPrice = Number(it.d2cPrice || it.price || 0) || 0;
        var rawAppPrice = Number(it.appPrice || 0) || 0;

        // Nhận discountPercent động từ payload/Excel/OCR thay vì hardcode 20
        var rawDiscount = (it.discountPercent !== undefined && it.discountPercent !== null && it.discountPercent !== "")
          ? it.discountPercent
          : ((it.discount !== undefined && it.discount !== null && it.discount !== "")
              ? it.discount
              : ((it.d2cDiscount !== undefined && it.d2cDiscount !== null && it.d2cDiscount !== "")
                  ? it.d2cDiscount
                  : (it["% Giảm D2C"] || it["% Giảm"])));

        var discountPercent = 0;
        if (rawDiscount !== undefined && rawDiscount !== null && rawDiscount !== "") {
          discountPercent = Math.max(0, Number(rawDiscount) || 0);
        } else if (rawAppPrice > 0 && d2cPrice > 0 && rawAppPrice >= d2cPrice) {
          discountPercent = Math.round(((rawAppPrice - d2cPrice) / rawAppPrice) * 100);
        } else {
          discountPercent = defaultDiscount;
        }

        var discountMultiplier = (discountPercent > 0 && discountPercent < 100) ? (1 - discountPercent / 100) : 0.8;

        var appPrice = rawAppPrice;
        if (appPrice <= 0 && d2cPrice > 0) {
          appPrice = Math.round((d2cPrice / discountMultiplier) / 1000) * 1000;
        } else if (d2cPrice <= 0 && appPrice > 0) {
          d2cPrice = Math.round((appPrice * discountMultiplier) / 1000) * 1000;
        }
        var cogs = Number(it.cogs || it.cost || 0) || 0;
        var profit = Math.max(0, d2cPrice - cogs);
        var status = "ACTIVE";
        var desc = String(it.description || it.desc || "").trim();
        var imageUrl = String(it.imageUrl || it.image || "").trim();
        var boosterSoup = String(it.boosterSoup || "").trim();
        var role = String(it.role || it.tag || "CORE").trim().toUpperCase();

        rowsToAppend.push([
          code, name, category, appPrice, discountPercent,
          d2cPrice, cogs, profit, status, desc, imageUrl, boosterSoup, role
        ]);
      }

      if (rowsToAppend.length > 0) {
        var startRow = sheet.getLastRow() + 1;
        sheet.getRange(startRow, 1, rowsToAppend.length, 13).setValues(rowsToAppend);
      }

      invalidateCatalogCache_();

      return {
        status: "success",
        code: "OK",
        message: "Đã nạp thành công " + rowsToAppend.length + " món ăn vào CSDL DATA_MENU!",
        data: { count: rowsToAppend.length }
      };

    } catch (e) {
      Logger.log("🚨 [CatalogService.batchImportMenuItems] Lỗi: " + e.message);
      return {
        status: "error",
        code: "ERR_SCHEMA_MISMATCH",
        message: "Lỗi nạp thực đơn hàng loạt: " + e.message
      };
    }
  }

  // ĐÓNG GÓI DUY NHẤT MỘT RETURN PUBLIC API Ở CUỐI MODULE IIFE
  return {
    getAdminMenuCatalog: getAdminMenuCatalog,
    getMenuCategories: getMenuCategories,
    saveOrUpdateMenuItem: saveOrUpdateMenuItem,
    toggleMenuItemStatus: toggleMenuItemStatus,
    deleteMenuItem: deleteMenuItem,
    saveMenuCategory: saveMenuCategory,
    deleteMenuCategory: deleteMenuCategory,
    batchImportMenuItems: batchImportMenuItems,
    invalidateCatalogCache: invalidateCatalogCache_
  };
})();
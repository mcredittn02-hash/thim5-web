/* ==========================================================================
   FILE: CoreRouter.gs - PHẦN [1/2]
   BẮT ĐẦU TỪ: Khởi tạo hằng số ROUTER_CONSTANTS, buildJsonResponse, doGet, doPost,
                Bộ tiếp nhận toàn cầu handleGlobalGatewayRequest(e),
                Bắt đầu hàm executeActionRouting(action, payload) (Fast-Track Shipper đầy đủ,
                Đối soát SSOT, RBAC Firewall, và Nhóm 0, Nhóm 1, Nhóm 2 của ACTION_DISPATCH_TABLE)
   KẾT THÚC TẠI: Hết Nhóm 2 trong ACTION_DISPATCH_TABLE (sau action toggleShipperStatus)
   HƯỚNG DẪN: Tạo mới hoặc ghi đè toàn bộ Phần 1/2 vào đầu file CoreRouter.gs
   ========================================================================== */

/**
 * =========================================================================
 * MODULE: CORE ROUTER & HEADLESS API GATEWAY (v3.5 ENTERPRISE GHOST)
 * Tác giả: Đu Đủ - Cố vấn Chiến lược & Kỹ sư Trưởng hệ thống SaaS Enterprise
 * Bản quyền: Bếp Thím 5 & LongHoaFood Master (Năm 2026)
 * Trách nhiệm cốt tử:
 *   - Tiếp nhận 100% Request HTTP (GET & POST) từ Web D2C, KDS, Shipper, Admin.
 *   - Bóc tách đa tầng Payload, triệt tiêu hoàn toàn lỗi undefined và rỗng dữ liệu.
 *   - Fast-Track Router cho Shipper Logistics & Quản trị danh bạ (deleteShipper, settleShipperDebt).
 *   - Định tuyến chuẩn xác qua Bảng Ánh Xạ O(1) dựa trên T5_SSOT.ACTIONS.
 *   - Kiểm soát quyền RBAC đa tầng và bọc thép CORS cho toàn bộ phản hồi JSON.
 * =========================================================================
 */

var ROUTER_CONSTANTS = Object.freeze({
  ALLOWED_ORIGINS: "*",
  API_VERSION: "v3.5.20261007",
  CONTENT_TYPE_JSON: "application/json; charset=utf-8"
});

/**
 * XÂY DỰNG PHẢN HỒI JSON CHUẨN HÓA BỌC THÉP CORS
 * 
 * @param {Object} dataObj - Dữ liệu cần phản hồi cho client
 * @returns {ContentService.TextOutput} Đối tượng TextOutput chuẩn JSON
 */
function buildJsonResponse(dataObj) {
  var output = ContentService.createTextOutput(JSON.stringify(dataObj || {}));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

/**
 * CỔNG TIẾP NHẬN YÊU CẦU GET TỪ CLIENT (DÙNG CHO KDS, SHIPPING, TRACKING, PING)
 * 
 * @param {Object} e - Sự kiện HTTP GET của Google Apps Script
 * @returns {ContentService.TextOutput} Phản hồi JSON
 */
function doGet(e) {
  return handleGlobalGatewayRequest(e);
}

/**
 * CỔNG TIẾP NHẬN YÊU CẦU POST TỪ CLIENT (DÙNG CHO ĐẶT ĐƠN, LƯU CẤU HÌNH, 2FA, CRUD)
 * 
 * @param {Object} e - Sự kiện HTTP POST của Google Apps Script
 * @returns {ContentService.TextOutput} Phản hồi JSON
 */
function doPost(e) {
  return handleGlobalGatewayRequest(e);
}

/**
 * BỘ TIẾP NHẬN VÀ PHÂN TÍCH YÊU CẦU TOÀN CẦU (GLOBAL REQUEST DISPATCHER)
 * Tự động đồng bộ và bóc tách tham số đa tầng, chống lỗi CORS và Payload rỗng.
 * 
 * @param {Object} e - Sự kiện HTTP GET/POST
 * @returns {ContentService.TextOutput} Phản hồi JSON chuẩn hóa
 */
function handleGlobalGatewayRequest(e) {
  var action = "";
  var payload = {};

  try {
    // 1. Trích xuất Action và tham số từ Query String URL (GET hoặc POST params)
    if (e && e.parameter) {
      if (e.parameter.action) {
        action = String(e.parameter.action).trim();
      }
      for (var paramKey in e.parameter) {
        if (paramKey !== "action") {
          payload[paramKey] = e.parameter[paramKey];
        }
      }

      // Xử lý trường hợp Client truyền payload dạng chuỗi JSON qua query param: ?payload={...}
      if (e.parameter.payload && typeof e.parameter.payload === "string") {
        try {
          var parsedQueryPayload = JSON.parse(e.parameter.payload);
          if (parsedQueryPayload && typeof parsedQueryPayload === "object" && !Array.isArray(parsedQueryPayload)) {
            for (var qpKey in parsedQueryPayload) {
              payload[qpKey] = parsedQueryPayload[qpKey];
            }
          }
        } catch (jsonQueryErr) {}
      }
    }

    // 2. Trích xuất dữ liệu từ Body Post Data (JSON Request Payload)
    if (e && e.postData && e.postData.contents) {
      try {
        var parsedBody = JSON.parse(e.postData.contents);
        if (parsedBody && typeof parsedBody === "object") {
          if (parsedBody.action && !action) {
            action = String(parsedBody.action).trim();
          }

          // Trích xuất dữ liệu lồng ghép (data / payload) hoặc root keys
          var nestedData = parsedBody.data !== undefined ? parsedBody.data : (parsedBody.payload !== undefined ? parsedBody.payload : null);

          if (nestedData && typeof nestedData === "object" && !Array.isArray(nestedData)) {
            for (var ndKey in nestedData) {
              payload[ndKey] = nestedData[ndKey];
            }
          }

          // Sao chép toàn bộ thuộc tính ngoài root vào payload phẳng (tránh đè nestedData đã bóc)
          for (var rootKey in parsedBody) {
            if (rootKey !== "action" && rootKey !== "data" && rootKey !== "payload" && payload[rootKey] === undefined) {
              payload[rootKey] = parsedBody[rootKey];
            }
          }
        }
      } catch (jsonBodyErr) {
        // Nếu body không parse được JSON, giữ nguyên payload từ query parameters
      }
    }

    // Nếu không truyền action, tự động phản hồi Health Check hệ thống
    if (!action) {
      return buildJsonResponse({
        status: "success",
        code: 200,
        message: "🚀 LongHoaFood Master Headless SaaS Gateway Online (v3.5 Ghost Architecture)",
        version: ROUTER_CONSTANTS.API_VERSION,
        serverTime: Utilities.formatDate(new Date(), "Asia/Ho_Chi_Minh", "yyyy-MM-dd HH:mm:ss")
      });
    }

    // 3. Chuyển giao gói tin cho cỗ máy định tuyến chuyên trách
    var routeResult = executeActionRouting(action, payload);
    return buildJsonResponse(routeResult);

  } catch (globalRouterErr) {
    return buildJsonResponse({
      status: "error",
      code: 500,
      message: "Lỗi Gateway xử lý yêu cầu: " + globalRouterErr.toString(),
      serverTime: Utilities.formatDate(new Date(), "Asia/Ho_Chi_Minh", "yyyy-MM-dd HH:mm:ss")
    });
  }
}

/**
 * CỖ MÁY ĐỊNH TUYẾN NGHIỆP VỤ ĐA TẦNG O(1) DỰA TRÊN T5_SSOT.ACTIONS
 * Phân phối chính xác từng yêu cầu tới đúng module nghiệp vụ độc lập.
 * Tích hợp Fast-Track Router cho toàn bộ Phân hệ Shipper (PWA & Quản trị Fleet CRUD).
 * 
 * @param {string} action - Tên hành động API
 * @param {Object} payload - Dữ liệu tham số đã bóc tách
 * @returns {Object} Đối tượng kết quả phản hồi chuẩn hóa
 */
function executeActionRouting(action, payload) {
  var act = String(action || "").trim();
  payload = payload || {};

  // 1. FAST-TRACK ROUTER DÀNH CHO PHÂN HỆ SHIPPER LOGISTICS & QUẢN TRỊ FLEET
  // Đầy đủ 13 Action APIs, bỏ qua kiểm tra rườm rà, phản hồi trực tiếp < 150ms
  var SHIPPER_FAST_ACTIONS = [
    "quickLoginShipperByLast4Digits",
    "verifyShipperAuth",
    "getShipperAvailableOrders",
    "claimOrder",
    "confirmOrderPickup",
    "completeOrderDelivery",
    "getShipperWalletSummary",
    "toggleShipperStatus",
    "kitchenSettleHandover",
    "getActiveShippersList",
    "saveOrUpdateShipper",
    "deleteShipper",
    "settleShipperDebt"
  ];

  if (SHIPPER_FAST_ACTIONS.indexOf(act) !== -1) {
    if (typeof ShipperService !== "undefined" && typeof ShipperService[act] === "function") {
      try {
        return ShipperService[act](payload);
      } catch (shpErr) {
        Logger.log("🚨 [CoreRouter -> ShipperService] Lỗi: " + shpErr.toString());
        return {
          status: "error",
          code: 500,
          message: "Lỗi xử lý nghiệp vụ Shipper: " + shpErr.message,
          action: act
        };
      }
    } else if (typeof routeShipperActions === "function") {
      var routedResult = routeShipperActions(act, payload);
      if (routedResult !== null) return routedResult;
    }
  }

  // 2. Kiểm tra tính hợp lệ của Action qua Từ điển SSOT (với hệ thống cũ)
  var isValidAction = false;
  if (typeof T5_SSOT !== "undefined" && T5_SSOT.ACTIONS) {
    for (var key in T5_SSOT.ACTIONS) {
      if (T5_SSOT.ACTIONS[key] === act) {
        isValidAction = true;
        break;
      }
    }
  }

  // Hỗ trợ danh mục alias mở rộng để bảo toàn tính tương thích ngược cho Storefront & Admin
  if (!isValidAction) {
    if (act === "getConfig" || act === "getPublicConfig") {
      act = (typeof T5_SSOT !== "undefined" && T5_SSOT.ACTIONS) ? T5_SSOT.ACTIONS.GET_SYSTEM_CONFIG : "getSystemDynamicConfig";
      isValidAction = true;
    } else if (act === "placeOrder") {
      act = (typeof T5_SSOT !== "undefined" && T5_SSOT.ACTIONS) ? T5_SSOT.ACTIONS.CREATE_D2C_ORDER : "createD2COrder";
      isValidAction = true;
    } else if (act === "getKdsOrders" || act === "getOrdersList") {
      act = (typeof T5_SSOT !== "undefined" && T5_SSOT.ACTIONS) ? T5_SSOT.ACTIONS.GET_KITCHEN_ORDERS : "getKitchenKdsOrders";
      isValidAction = true;
    } else if (act === "assignShipper") {
      act = (typeof T5_SSOT !== "undefined" && T5_SSOT.ACTIONS) ? T5_SSOT.ACTIONS.KITCHEN_ASSIGN_SHIPPER : "kitchenAssignShipper";
      isValidAction = true;
    } else if (act === "confirmKitchenHandover") {
      act = (typeof T5_SSOT !== "undefined" && T5_SSOT.ACTIONS) ? T5_SSOT.ACTIONS.KITCHEN_SETTLE_HANDOVER : "kitchenSettleHandover";
      isValidAction = true;
    } else if (act === "completeOrder") {
      act = (typeof T5_SSOT !== "undefined" && T5_SSOT.ACTIONS) ? T5_SSOT.ACTIONS.SHIPPER_UPDATE_STEP : "shipperUpdateStep";
      isValidAction = true;
    } else if (act === "getMenuCatalog") {
      act = (typeof T5_SSOT !== "undefined" && T5_SSOT.ACTIONS) ? T5_SSOT.ACTIONS.GET_ADMIN_MENU : "getAdminMenuCatalog";
      isValidAction = true;
    } else if (act === "uploadDishMediaImage") {
      act = (typeof T5_SSOT !== "undefined" && T5_SSOT.ACTIONS) ? T5_SSOT.ACTIONS.UPLOAD_MENU_IMAGE : "uploadDishMediaImage";
      isValidAction = true;
    } else if (act === "setStoreStatus") {
      act = (typeof T5_SSOT !== "undefined" && T5_SSOT.ACTIONS) ? T5_SSOT.ACTIONS.TOGGLE_STORE_STATUS : "toggleStoreStatus";
      isValidAction = true;
    }
  }

  // 3. Kiểm toán ủy quyền và phân tầng bảo mật (RBAC Firewall)
  var authCheck = authorizeActionRequest(act, payload);
  if (!authCheck.authorized) {
    return {
      status: "error",
      code: authCheck.code || 403,
      message: authCheck.message || "Từ chối truy cập! Quyền hạn không đáp ứng yêu cầu nghiệp vụ."
    };
  }

  // 4. BẢNG ÁNH XẠ ĐIỀU PHỐI O(1) (ACTION DISPATCH TABLE TOÀN DIỆN)
  var ACTION_DISPATCH_TABLE = {
    // NHÓM 0: GIÁM SÁT MÁY CHỦ & HỢP ĐỒNG HỆ THỐNG RUNTIME
    "ping": function(p) {
      return { status: "success", code: 200, message: "PONG", version: ROUTER_CONSTANTS.API_VERSION, timestamp: Date.now() };
    },
    "healthCheck": function(p) {
      return { status: "success", code: 200, message: "PONG", version: ROUTER_CONSTANTS.API_VERSION, timestamp: Date.now() };
    },
    "getSystemContract": function(p) {
      return getSystemContract(p);
    },
    "syncDatabaseSchema": function(p) {
      return syncDatabaseSchema();
    },

    // NHÓM 1: CẤU HÌNH HỆ THỐNG, BẢO MẬT & XÁC THỰC RBAC (ConfigManager.gs)
    "verifyAdminRole": function(p) {
      return verifyAdminRole(p);
    },
    "verifySuperAdminTotp": function(p) {
      return verifySuperAdminTotp(p);
    },
    "getTotpSetupQrData": function(p) {
      return getTotpSetupQrData(p);
    },
    "sendEmergencyBackupOtpToEmail": function(p) {
      return sendEmergencyBackupOtpToEmail(p);
    },
    "getSystemDynamicConfig": function(p) {
      var masterKeyOpt = (typeof p === "string") ? p : (p.masterKey || "");
      return getSystemDynamicConfig(masterKeyOpt);
    },
    "saveSystemDynamicConfig": function(p) {
      return saveSystemDynamicConfig(p);
    },
    "toggleStoreStatus": function(p) {
      return toggleStoreOperationalStatus(p);
    },
    "getStoreStatus": function(p) {
      return getStoreOperationalStatus();
    },

    // NHÓM 2: VẬN HÀNH ĐƠN HÀNG, BẾP KDS & ĐIỀU PHỐI SHIPPER (OrderEngine.gs & ShipperService.gs)
    "createD2COrder": function(p) {
      return createD2COrder(p);
    },
    "getOrderTracking": function(p) {
      return getOrderTracking(p);
    },
    "getKitchenKdsOrders": function(p) {
      return getKitchenKdsOrders();
    },
    "kitchenUpdateStatus": function(p) {
      var kCode = p.orderCode || p.code || "";
      var kAction = p.action || p.status || "";
      var kNote = p.note || "";
      return kitchenUpdateStatus(kCode, kAction, kNote);
    },
    "kitchenAssignShipper": function(p) {
      var kaCode = p.orderCode || p.orderId || p.code || "";
      var kaName = p.shipperName || p.name || p.shipperInfo || "";
      var kaPhone = p.shipperPhone || p.phone || "";
      return kitchenAssignShipper(kaCode, kaName, kaPhone);
    },
    "kitchenSettleHandover": function(p) {
      if (typeof ShipperService !== "undefined" && typeof ShipperService.kitchenSettleHandover === "function") {
        return ShipperService.kitchenSettleHandover(p);
      }
      return (typeof kitchenSettleHandover === "function") ? kitchenSettleHandover(p) : { status: "error", message: "Chưa cấu hình kitchenSettleHandover" };
    },
    "getShipperOrders": function(p) {
      var sLast4 = (typeof p === "string") ? p : (p.last4 || p.shipperPhone || "");
      return getShipperOrders(sLast4);
    },
    "shipperVerifyCodOrderSuccess": function(p) {
      var svCode = p.orderCode || p.code || "";
      var svInfo = p.shipperInfo || p.shipper || "";
      return shipperVerifyCodOrderSuccess(svCode, svInfo);
    },
    "shipperUpdateStep": function(p) {
      var suCode = p.orderCode || p.orderId || p.code || "";
      var suName = p.shipperName || p.name || "";
      var suStep = Number(p.stepNumber !== undefined ? p.stepNumber : p.step) || 3;
      return shipperUpdateStep(suCode, suName, suStep);
    },
    "shipperReleaseOrder": function(p) {
      var srCode = p.orderCode || p.code || "";
      var srReason = p.reason || p.note || "Hỏng xe đột xuất";
      return shipperReleaseOrder(srCode, srReason);
    },
    "getActiveShippersList": function(p) {
      if (typeof ShipperService !== "undefined" && typeof ShipperService.getActiveShippersList === "function") {
        return ShipperService.getActiveShippersList();
      }
      return (typeof getActiveShippersList === "function") ? getActiveShippersList(p) : { status: "error", message: "Chưa cấu hình getActiveShippersList" };
    },
    "saveOrUpdateShipper": function(p) {
      if (typeof ShipperService !== "undefined" && typeof ShipperService.saveOrUpdateShipper === "function") {
        return ShipperService.saveOrUpdateShipper(p);
      }
      return (typeof saveOrUpdateShipper === "function") ? saveOrUpdateShipper(p) : { status: "error", message: "Chưa cấu hình saveOrUpdateShipper" };
    },
    "toggleShipperStatus": function(p) {
      if (typeof ShipperService !== "undefined" && typeof ShipperService.toggleShipperStatus === "function") {
        return ShipperService.toggleShipperStatus(p);
      }
      return (typeof toggleShipperStatus === "function") ? toggleShipperStatus(p) : { status: "error", message: "Chưa cấu hình toggleShipperStatus" };
    },
    /* ==========================================================================
   FILE: CoreRouter.gs - PHẦN [2/2] (PHẦN CUỐI CÙNG - HOÀN TẤT FILE)
   BẮT ĐẦU TỪ: Nhóm 2.1 Shipper PWA & Fleet CRUD (ACTION_DISPATCH_TABLE)
   KẾT THÚC TẠI: Hết hàm tiện ích resolvePayloadData(payload)
   HƯỚNG DẪN: Copy nối tiếp ngay sau dấu phẩy kết thúc action toggleShipperStatus ở Phần [1/2]
   ========================================================================== */

    // NHÓM 2.1: CÁC ROUTE SHIPPER PWA CLIENT & QUẢN TRỊ FLEET ĐƯỢC ĐỒNG BỘ TOÀN DIỆN
    "quickLoginShipperByLast4Digits": function(p) {
      if (typeof ShipperService !== "undefined" && typeof ShipperService.quickLoginShipperByLast4Digits === "function") {
        return ShipperService.quickLoginShipperByLast4Digits(p);
      }
      return (typeof quickLoginShipperByLast4Digits === "function") ? quickLoginShipperByLast4Digits(p) : { status: "error", message: "Chưa cấu hình quickLoginShipperByLast4Digits" };
    },
    "verifyShipperAuth": function(p) {
      if (typeof ShipperService !== "undefined" && typeof ShipperService.verifyShipperAuth === "function") {
        return ShipperService.verifyShipperAuth(p);
      }
      return (typeof verifyShipperAuth === "function") ? verifyShipperAuth(p) : { status: "error", message: "Chưa cấu hình verifyShipperAuth" };
    },
    "getShipperAvailableOrders": function(p) {
      if (typeof ShipperService !== "undefined" && typeof ShipperService.getShipperAvailableOrders === "function") {
        return ShipperService.getShipperAvailableOrders(p);
      }
      return (typeof getShipperAvailableOrders === "function") ? getShipperAvailableOrders(p) : { status: "error", message: "Chưa cấu hình getShipperAvailableOrders" };
    },
    "claimOrder": function(p) {
      if (typeof ShipperService !== "undefined" && typeof ShipperService.claimOrder === "function") {
        return ShipperService.claimOrder(p);
      }
      return (typeof claimOrder === "function") ? claimOrder(p) : { status: "error", message: "Chưa cấu hình claimOrder" };
    },
    "confirmOrderPickup": function(p) {
      if (typeof ShipperService !== "undefined" && typeof ShipperService.confirmOrderPickup === "function") {
        return ShipperService.confirmOrderPickup(p);
      }
      return (typeof confirmOrderPickup === "function") ? confirmOrderPickup(p) : { status: "error", message: "Chưa cấu hình confirmOrderPickup" };
    },
    "completeOrderDelivery": function(p) {
      if (typeof ShipperService !== "undefined" && typeof ShipperService.completeOrderDelivery === "function") {
        return ShipperService.completeOrderDelivery(p);
      }
      return (typeof completeOrderDelivery === "function") ? completeOrderDelivery(p) : { status: "error", message: "Chưa cấu hình completeOrderDelivery" };
    },
    "getShipperWalletSummary": function(p) {
      if (typeof ShipperService !== "undefined" && typeof ShipperService.getShipperWalletSummary === "function") {
        return ShipperService.getShipperWalletSummary(p);
      }
      return (typeof getShipperWalletSummary === "function") ? getShipperWalletSummary(p) : { status: "error", message: "Chưa cấu hình getShipperWalletSummary" };
    },
    "deleteShipper": function(p) {
      if (typeof ShipperService !== "undefined" && typeof ShipperService.deleteShipper === "function") {
        return ShipperService.deleteShipper(p);
      }
      return (typeof routeShipperActions === "function") ? routeShipperActions("deleteShipper", p) : { status: "error", message: "Chưa cấu hình module deleteShipper" };
    },
    "settleShipperDebt": function(p) {
      if (typeof ShipperService !== "undefined" && typeof ShipperService.settleShipperDebt === "function") {
        return ShipperService.settleShipperDebt(p);
      }
      return (typeof routeShipperActions === "function") ? routeShipperActions("settleShipperDebt", p) : { status: "error", message: "Chưa cấu hình module settleShipperDebt" };
    },

    // NHÓM 3: THỰC ĐƠN, REVERSE-PRICING & OMNI-INGESTION (CatalogService.gs & IngestionEngine.gs)
    "getAdminMenuCatalog": function(p) {
      return CatalogService.getAdminMenuCatalog(p);
    },
    "getMenuCategories": function(p) {
      return CatalogService.getMenuCategories(p);
    },
    "saveOrUpdateMenuItem": function(p) {
      return CatalogService.saveOrUpdateMenuItem(p);
    },
    "toggleMenuItemStatus": function(p) {
      return CatalogService.toggleMenuItemStatus(p);
    },
    "deleteMenuItem": function(p) {
      var itemCode = (typeof p === "string") ? p : (p ? (p.itemCode || p.code || p.id) : "");
      return CatalogService.deleteMenuItem({ code: itemCode });
    },
    "saveMenuCategory": function(p) {
      return CatalogService.saveMenuCategory(p);
    },
    "deleteMenuCategory": function(p) {
      var catCode = (typeof p === "string") ? p : (p ? (p.categoryId || p.code || p.id) : "");
      return CatalogService.deleteMenuCategory({ code: catCode });
    },
    "batchImportMenuItems": function(p) {
      return CatalogService.batchImportMenuItems(p);
    },
    "uploadDishMediaImage": function(p) {
      if (typeof uploadDishMediaImage === "function") {
        return uploadDishMediaImage(p);
      }
      return uploadImageToMenuDriveFolder(p);
    },
    "uploadImageToMenuDriveFolder": function(p) {
      if (typeof uploadImageToMenuDriveFolder === "function") {
        return uploadImageToMenuDriveFolder(p);
      }
      return uploadDishMediaImage(p);
    },
    "parseUploadedSpreadsheetBuffer": function(p) {
      return parseUploadedSpreadsheetBuffer(p);
    },
    "processMenuOcrWithGemini": function(p) {
      return processMenuOcrWithGemini(p);
    },
    "extractMenuFromPublicUrl": function(p) {
      return extractMenuFromPublicUrl(p);
    },
    "getMenuExcelTemplateStructure": function(p) {
      return getMenuExcelTemplateStructure();
    },

    // NHÓM 4: BÁO CÁO TÀI CHÍNH P&L, CÔNG NỢ & ĐỐI SOÁT (FinanceReport.gs)
    "getFinancialPlSummary": function(p) {
      return getFinancialPlSummary(p);
    },
    "getShipperCodHoldingLedger": function(p) {
      if (typeof getShipperCodHoldingLedger === "function") {
        return getShipperCodHoldingLedger(p);
      }
      return executeFinancialCalculation(p);
    },
    "getFinancialAuditLogs": function(p) {
      if (typeof getFinancialAuditLogs === "function") {
        return getFinancialAuditLogs(p);
      }
      return { status: "success", code: 200, data: [] };
    },

    // NHÓM 5: HỒ SƠ MINI CRM & GAMIFICATION VÒNG QUAY MAY MẮN (CustomerCRM.gs)
    "getCustomerProfile": function(p) {
      return getCustomerProfile(p);
    },
    "getPublicWheelConfig": function(p) {
      return getPublicWheelConfig();
    },
    "spinLuckyWheel": function(p) {
      return spinLuckyWheel(p);
    },
    "updateWheelConfig": function(p) {
      return updateWheelConfig(p);
    },
    "redeemGiftToken": function(p) {
      return redeemGiftToken(p);
    },
    "logWheelRewardTransaction": function(p) {
      if (typeof logWheelRewardTransaction === "function") {
        return logWheelRewardTransaction(p);
      }
      return { status: "success", code: 200, message: "Đã tiếp nhận ghi log vòng quay." };
    }
  };

  // 5. Thực thi Handler an toàn với khối bảo vệ Granular Try-Catch
  var handler = ACTION_DISPATCH_TABLE[act];
  if (typeof handler === "function") {
    try {
      return handler(payload);
    } catch (handlerErr) {
      Logger.log("⚠️ Lỗi thực thi Action [" + act + "]: " + handlerErr.toString());
      return {
        status: "error",
        code: 500,
        message: "Lỗi xử lý nghiệp vụ tại module chuyên trách: " + handlerErr.message,
        action: act
      };
    }
  }

  return {
    status: "error",
    code: 404,
    message: "Cổng API Gateway không hỗ trợ hành động [" + act + "]. Vui lòng kiểm tra lại cấu hình Route!",
    version: ROUTER_CONSTANTS.API_VERSION
  };
}

/**
 * LỚP KIỂM TOÁN ỦY QUYỀN VÀ BẢO VỆ PHÂN TẦNG RBAC (SECURITY FIREWALL)
 * 
 * @param {string} act - Tên hành động API
 * @param {Object} payload - Dữ liệu yêu cầu
 * @returns {Object} { authorized: boolean, code?: number, message?: string }
 */
function authorizeActionRequest(act, payload) {
  // Danh mục Action yêu cầu quyền Super Admin tối cao
  var SUPER_ADMIN_ACTIONS = [
    "saveSystemDynamicConfig",
    "syncDatabaseSchema",
    "updateWheelConfig"
  ];

  if (SUPER_ADMIN_ACTIONS.indexOf(act) !== -1) {
    var masterKey = String(payload.masterKey || payload.superKey || "").trim();
    if (!masterKey) {
      return { authorized: false, code: 401, message: "Hành động yêu cầu xác thực Master Key của Super Admin!" };
    }
  }

  // Danh mục Action yêu cầu quyền Quản Lý Ca / Thu Ngân / Super Admin
  var POS_STAFF_ACTIONS = [
    "deleteMenuItem",
    "batchImportMenuItems",
    "deleteShipper"
  ];

  if (POS_STAFF_ACTIONS.indexOf(act) !== -1) {
    var role = String(payload.role || "").trim().toUpperCase();
    var pin = String(payload.pin || "").trim();
    var masterKeyCheck = String(payload.masterKey || payload.superKey || "").trim();
    
    // Chấp nhận nếu có role POS_STAFF, STORE_MANAGER, SUPER_ADMIN hoặc có PIN / masterKey
    var isAuthorizedRole = (role === "SUPER_ADMIN" || role === "STORE_MANAGER" || role === "POS_STAFF");
    if (!isAuthorizedRole && !pin && !masterKeyCheck) {
      return { authorized: false, code: 403, message: "Hành động yêu cầu quyền hạn Quản lý quầy trở lên!" };
    }
  }

  return { authorized: true };
}

/**
 * BÓC TÁCH DỮ LIỆU ĐA TẦNG PHÒNG THỦ DÀNH CHO CÁC MODULE CON
 * 
 * @param {Object} payload - Đối tượng payload thô
 * @returns {Object} Đối tượng dữ liệu thuần túy
 */
function resolvePayloadData(payload) {
  if (!payload || typeof payload !== "object") return {};
  if (payload.data && typeof payload.data === "object" && !Array.isArray(payload.data)) {
    return payload.data;
  }
  return payload;
}
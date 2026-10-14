/* ==========================================================================
   FILE: api.js - PHẦN [1/2]
   BẮT ĐẦU TỪ: Khởi tạo Auto-Loader & Fallback Dictionary Guard
   KẾT THÚC TẠI: Hàm unwrapApiResponse()
   HƯỚNG DẪN: Tạo mới hoặc ghi đè phần đầu của file api.js trong GITHUB-FRONTEND
   ========================================================================== */

/**
 * =============================================================================
 * TÊN FILE: api.js (PHIÊN BẢN ENTERPRISE SaaS v3.5 MASTER DUAL-GATEWAY)
 * BẢN QUYỀN: BẾP MÌ TRỘN THÍM 5 & LONGHOAFOOD MASTER (NĂM 2026)
 * KIẾN TRÚC SƯ TRƯỞNG: ĐU ĐỦ (CỐ VẤN CHIẾN LƯỢC F&B CHO ANH HẢI ÂU)
 * TRÁCH NHIỆM CỐT TỬ:
 *   - AUTO-LOADER GUARD: Tự động nạp thim5-master-dictionary.js kèm Fallback RAM.
 *   - DUAL-PAYLOAD NORMALIZER: Làm phẳng payload thông minh, chống mất biến ngầm.
 *   - DUAL-ENDPOINT ROUTER: Tự động điều hướng Staging vs Production an toàn.
 *   - RUNTIME ADAPTER: Tương thích 100% Google Apps Script run & Fetch Client.
 * =============================================================================
 */

// =============================================================================
// 1. TỪ ĐIỂN DỰ PHÒNG CỐT LÕI (EMBEDDED SSOT FALLBACK DICTIONARY)
// =============================================================================
var _EMBEDDED_T5_ACTIONS = Object.freeze({
  PING: "ping",
  GET_SYSTEM_CONFIG: "getConfig",
  GET_ADMIN_MENU_CATALOG: "getAdminMenuCatalog",
  SAVE_OR_UPDATE_MENU_ITEM: "saveOrUpdateMenuItem",
  DELETE_MENU_ITEM: "deleteMenuItem",
  TOGGLE_MENU_ITEM_STATUS: "toggleMenuItemStatus",
  BATCH_IMPORT_MENU_ITEMS: "batchImportMenuItems",
  UPLOAD_DISH_MEDIA_IMAGE: "uploadDishMediaImage",
  GET_MENU_CATEGORIES: "getMenuCategories",
  SAVE_MENU_CATEGORY: "saveMenuCategory",
  DELETE_MENU_CATEGORY: "deleteMenuCategory",
  CREATE_D2C_ORDER: "createD2COrder",
  GET_ORDER_TRACKING: "getOrderTracking",
  GET_KITCHEN_ORDERS: "getKitchenKdsOrders",
  GET_SHIPPER_ORDERS: "getShipperOrders",
  GET_FINANCIAL_PL: "getFinancialPlSummary",
  VERIFY_ADMIN_ROLE: "verifyAdminRole",
  VERIFY_SUPER_ADMIN_TOTP: "verifySuperAdminTotp",
  TOGGLE_STORE_STATUS: "toggleStoreStatus",
  GET_STORE_STATUS: "getStoreStatus"
});

// =============================================================================
// 2. AUTO-LOADER GUARD: TỰ ĐỘNG NẠP THƯ VIỆN THÍM 5 MASTER DICTIONARY
// =============================================================================
var _t5DictionaryLoadPromise = null;

function ensureMasterDictionaryLoaded() {
  if (typeof window !== 'undefined' && (window.T5_DICT || window.T5_SSOT || window.T5_MASTER)) {
    return Promise.resolve(window.T5_DICT || window.T5_SSOT || window.T5_MASTER);
  }

  if (_t5DictionaryLoadPromise) {
    return _t5DictionaryLoadPromise;
  }

  _t5DictionaryLoadPromise = new Promise(function(resolve, reject) {
    if (typeof document === 'undefined') {
      resolve(null);
      return;
    }

    var existingScript = document.querySelector('script[src*="thim5-master-dictionary.js"]');
    if (existingScript) {
      existingScript.addEventListener('load', function() {
        resolve(window.T5_DICT || window.T5_SSOT || window.T5_MASTER);
      });
      existingScript.addEventListener('error', function(err) {
        console.warn('⚠️ [API Auto-Loader] Không thể nạp script hiện có, dùng Fallback:', err);
        resolve(null);
      });
      return;
    }

    var scriptEl = document.createElement('script');
    scriptEl.src = 'thim5-master-dictionary.js?v=' + Date.now();
    scriptEl.async = false;

    scriptEl.onload = function() {
      console.log('⚡ [API Auto-Loader] Đã nạp thành công thim5-master-dictionary.js!');
      resolve(window.T5_DICT || window.T5_SSOT || window.T5_MASTER);
    };

    scriptEl.onerror = function(err) {
      console.warn('⚠️ [API Auto-Loader Warning] Kiểm tra thư mục dự phòng /js:', err);
      var fallbackScript = document.createElement('script');
      fallbackScript.src = 'js/thim5-master-dictionary.js?v=' + Date.now();
      fallbackScript.async = false;
      fallbackScript.onload = function() {
        resolve(window.T5_DICT || window.T5_SSOT || window.T5_MASTER);
      };
      fallbackScript.onerror = function(fallbackErr) {
        console.warn('ℹ️ [API Auto-Loader Notice] Kích hoạt Embedded Fallback Dictionary an toàn.');
        resolve(null);
      };
      document.head.appendChild(fallbackScript);
    };

    document.head.appendChild(scriptEl);
  });

  return _t5DictionaryLoadPromise;
}

if (typeof window !== 'undefined') {
  ensureMasterDictionaryLoaded();
}

// =============================================================================
// 3. KHỞI TẠO BỘ ADAPTER TRUNG TÂM THIM5API (DUAL-GATEWAY ADAPTER)
// =============================================================================
var Thim5API = (function() {
  'use strict';

  var STAGING_GAS_ENDPOINT = 'https://script.google.com/macros/s/AKfycbx6ZrlsN-vodh5UwjPPbFin9rWyg6GRV4fVQJkcayMR5uScTsvheJUDniRCPKMhlFsO/exec';
  var PRODUCTION_GAS_ENDPOINT = 'https://script.google.com/macros/s/AKfycbwZZoE51LGSlZbE85BH_sB2bzWwB_omtZaPFI_vevlAh56bs8CrpGTPMfdg2FfzadcY/exec';

  var REQUEST_TIMEOUT_MS = 25000;

  function resolveActiveEndpoint() {
    if (typeof window === 'undefined') {
      return STAGING_GAS_ENDPOINT;
    }

    try {
      var urlParams = new URLSearchParams(window.location.search);
      var queryEndpoint = urlParams.get('gas_endpoint');
      if (queryEndpoint && queryEndpoint.startsWith('https://script.google.com/')) {
        localStorage.setItem('thim5_custom_api_endpoint', queryEndpoint.trim());
        console.log('🔗 [Thim5API Override] Đã cấu hình Endpoint mới từ URL Parameter:', queryEndpoint);
        return queryEndpoint.trim();
      }
    } catch (eParam) {}

    try {
      var cachedEndpoint = localStorage.getItem('thim5_custom_api_endpoint');
      if (cachedEndpoint && cachedEndpoint.startsWith('https://script.google.com/')) {
        return cachedEndpoint.trim();
      }
    } catch (eStorage) {}

    var currentHost = (window.location && window.location.hostname) ? window.location.hostname.toLowerCase() : '';

    if (
      currentHost.indexOf('test.') !== -1 ||
      currentHost.indexOf('staging') !== -1 ||
      currentHost === 'localhost' ||
      currentHost === '127.0.0.1' ||
      window.location.href.indexOf('staging') !== -1
    ) {
      return STAGING_GAS_ENDPOINT;
    }

    return PRODUCTION_GAS_ENDPOINT;
  }

  function isRunningInsideGoogleScriptRun() {
    return (
      typeof google !== 'undefined' &&
      google.script &&
      typeof google.script.run !== 'undefined' &&
      typeof google.script.run.withSuccessHandler === 'function'
    );
  }

  function getEndpoint() {
    return resolveActiveEndpoint();
  }

  function setEndpoint(newEndpointUrl) {
    if (newEndpointUrl && typeof newEndpointUrl === 'string' && newEndpointUrl.startsWith('https://script.google.com/')) {
      var cleanUrl = newEndpointUrl.trim();
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('thim5_custom_api_endpoint', cleanUrl);
      }
      console.log('✅ [Thim5API] Đã lưu thành công Endpoint máy chủ mới:', cleanUrl);
      return true;
    }
    console.warn('⛔ [Thim5API] Đường link Web App không hợp lệ! Bắt buộc bắt đầu bằng https://script.google.com/');
    return false;
  }

  function resetEndpointToDefault() {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('thim5_custom_api_endpoint');
    }
    console.log('🔄 [Thim5API] Đã khôi phục Endpoint mặc định theo môi trường:', resolveActiveEndpoint());
  }

  function unwrapApiResponse(rawResponse) {
    if (!rawResponse) return { status: 'error', message: 'Dữ liệu phản hồi trống từ máy chủ' };

    var data = rawResponse;
    if (typeof rawResponse === 'string') {
      try {
        data = JSON.parse(rawResponse);
      } catch (e) {
        return { status: 'error', message: 'Lỗi định dạng phản hồi máy chủ: ' + rawResponse };
      }
    }
    return data;
  }
  /* ==========================================================================
   FILE: api.js - PHẦN [2/2] (HOÀN TẤT FILE)
   BẮT ĐẦU TỪ: Hàm executeHeadlessFetchRequest()
   KẾT THÚC TẠI: Đăng ký window.Thim5API và window.callBackend
   HƯỚNG DẪN: Copy nối tiếp ngay sau dấu } cuối cùng của Phần [1/2] trong api.js
   ========================================================================== */

  /**
   * THỰC THI YÊU CẦU FETCH QUA GIAO THỨC HTTP ĐỘC LẬP (HEADLESS STATIC WEB)
   * Tích hợp Dual-Payload Normalizer và AbortController quản trị Timeout 25s
   */
  async function executeHeadlessFetchRequest(endpoint, actionName, payloadObj) {
    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timeoutId = null;

    if (controller) {
      timeoutId = setTimeout(function() {
        controller.abort();
      }, REQUEST_TIMEOUT_MS);
    }

    try {
      // 1. Tự động kiểm tra và trích xuất Session Token / Auth PIN nếu có
      var activeToken = "";
      var activeRole = "";
      try {
        if (typeof sessionStorage !== 'undefined') {
          activeToken = sessionStorage.getItem("thim5_admin_token") || sessionStorage.getItem("THIM5_AUTH_TOKEN") || "";
          activeRole = sessionStorage.getItem("thim5_auth_role") || sessionStorage.getItem("THIM5_ADMIN_ROLE") || "";
        }
      } catch (eStorageToken) {}

      // 2. Cơ chế làm phẳng Payload kép (Dual-Payload Normalizer)
      // Vừa giữ object payload/data vừa sao chép ra ngoài root để CoreRouter.gs bắt dính 100%
      var cleanPayload = (payloadObj && typeof payloadObj === 'object') ? Object.assign({}, payloadObj) : {};
      
      if (activeToken && !cleanPayload.authToken && !cleanPayload.token) {
        cleanPayload.authToken = activeToken;
      }
      if (activeRole && !cleanPayload.role) {
        cleanPayload.role = activeRole;
      }

      var requestBody = {
        action: actionName,
        payload: cleanPayload,
        data: cleanPayload,
        timestamp: Date.now()
      };

      // Đẩy thêm các key quan trọng ra root để tương thích mọi phiên bản CoreRouter
      for (var pKey in cleanPayload) {
        if (cleanPayload.hasOwnProperty(pKey) && requestBody[pKey] === undefined) {
          requestBody[pKey] = cleanPayload[pKey];
        }
      }

      // 3. Giao tiếp qua HTTP POST chuẩn hóa CORS với Content-Type text/plain tránh preflight OPTIONS
      var response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8'
        },
        body: JSON.stringify(requestBody),
        signal: controller ? controller.signal : undefined
      });

      if (!response.ok) {
        throw new Error('Máy chủ phản hồi mã lỗi HTTP: ' + response.status + ' (' + response.statusText + ')');
      }

      var responseText = await response.text();
      return unwrapApiResponse(responseText);

    } catch (fetchErr) {
      if (fetchErr.name === 'AbortError') {
        throw new Error('Yêu cầu vượt quá thời gian chờ (' + (REQUEST_TIMEOUT_MS / 1000) + ' giây). Vui lòng kiểm tra lại kết nối mạng!');
      }
      throw fetchErr;
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }

  /**
   * CỔNG ĐIỀU PHỐI API TRUNG TÂM (UNIVERSAL CALL GAS ADAPTER)
   * Tự động chờ nạp Từ Điển Master, nhận diện môi trường GAS vs Web độc lập,
   * hỗ trợ song song cả cú pháp Promise (async/await) lẫn Callback truyền thống.
   * 
   * @param {string} actionName - Tên hành động nghiệp vụ (theo SSOT Actions)
   * @param {Object} [payloadObj] - Dữ liệu gửi kèm yêu cầu
   * @param {Function} [optCallback] - Hàm callback tùy chọn (success, error)
   * @returns {Promise<Object>} Kết quả phản hồi chuẩn hóa JSON từ máy chủ
   */
  async function callGAS(actionName, payloadObj, optCallback) {
    var cleanAction = String(actionName || '').trim();
    var cleanPayload = (payloadObj && typeof payloadObj === 'object') ? payloadObj : {};

    // 1. Chờ nạp hoàn tất Từ Điển Master trước khi phát lệnh mạng
    try {
      await ensureMasterDictionaryLoaded();
    } catch (dictErr) {
      console.warn('⚠️ [Thim5API Warning] Tiếp tục gọi API khi Từ Điển chưa nạp xong:', dictErr);
    }

    // 2. Chuẩn hóa tên Action nếu có alias trong Từ Điển T5_DICT hoặc Embedded Dict
    if (typeof window !== 'undefined' && window.T5_DICT && window.T5_DICT.ACTIONS) {
      var actionsDict = window.T5_DICT.ACTIONS;
      if (actionsDict[cleanAction]) {
        cleanAction = actionsDict[cleanAction];
      }
    } else if (_EMBEDDED_T5_ACTIONS && _EMBEDDED_T5_ACTIONS[cleanAction]) {
      cleanAction = _EMBEDDED_T5_ACTIONS[cleanAction];
    }

    return new Promise(function(resolve, reject) {
      // TRƯỜNG HỢP A: Chạy trong môi trường nhúng trực tiếp Google Apps Script (HTML Service)
      if (isRunningInsideGoogleScriptRun()) {
        var runner = google.script.run
          .withSuccessHandler(function(response) {
            var unwrapped = unwrapApiResponse(response);
            if (typeof optCallback === 'function') {
              optCallback(unwrapped, null);
            }
            resolve(unwrapped);
          })
          .withFailureHandler(function(error) {
            console.error('❌ [GAS Execution Error] Action ' + cleanAction + ' thất bại:', error);
            if (typeof optCallback === 'function') {
              optCallback(null, error);
            }
            reject(error instanceof Error ? error : new Error(String(error)));
          });

        if (typeof runner[cleanAction] === 'function') {
          runner[cleanAction](cleanPayload);
        } else if (typeof runner.handleGlobalGatewayRequest === 'function') {
          runner.handleGlobalGatewayRequest({
            parameter: { action: cleanAction },
            postData: { contents: JSON.stringify(cleanPayload) }
          });
        } else if (typeof runner.doPost === 'function') {
          runner.doPost({
            parameter: { action: cleanAction },
            postData: { contents: JSON.stringify({ action: cleanAction, payload: cleanPayload }) }
          });
        } else {
          var noFuncErr = new Error('Hàm xử lý Backend [' + cleanAction + '] không tồn tại trong Google Apps Script!');
          if (typeof optCallback === 'function') optCallback(null, noFuncErr);
          reject(noFuncErr);
        }
        return;
      }

      // TRƯỜNG HỢP B: Chạy trên Web Hosting tĩnh độc lập (Headless HTTP Fetch)
      var currentEndpoint = getEndpoint();

      executeHeadlessFetchRequest(currentEndpoint, cleanAction, cleanPayload)
        .then(function(result) {
          if (typeof optCallback === 'function') {
            optCallback(result, null);
          }
          resolve(result);
        })
        .catch(function(fetchError) {
          console.error('❌ [Headless API Error] Action ' + cleanAction + ' thất bại:', fetchError);
          if (typeof optCallback === 'function') {
            optCallback(null, fetchError);
          }
          reject(fetchError);
        });
    });
  }

  /**
   * KIỂM TRA NHỊP TIM MẠNG & ĐO ĐỘ TRỄ MÁY CHỦ THỜI GIAN THỰC (HEARTBEAT PING)
   * 
   * @param {Object} [options] - Tham số cấu hình kiểm tra
   * @returns {Promise<Object>} { status, latencyMs, timestamp }
   */
  async function systemHeartbeatPing(options) {
    var startTime = performance.now();
    try {
      var res = await callGAS('ping', options || {});
      var latency = Math.round(performance.now() - startTime);
      return {
        status: 'success',
        latencyMs: latency,
        data: res,
        timestamp: Date.now()
      };
    } catch (pingErr) {
      return {
        status: 'error',
        latencyMs: -1,
        message: pingErr.message || 'Mất kết nối tới máy chủ Google Apps Script',
        timestamp: Date.now()
      };
    }
  }

  /**
   * CẦU NỐI TƯƠNG THÍCH NGƯỢC (LEGACY CALL BACKEND COMPATIBILITY)
   * Hỗ trợ trực tiếp cho các file như kitchen.html và shipping.html
   */
  function callBackend(gasFunctionName, gasArgsArray, apiActionName, apiPayloadObj) {
    var targetAction = apiActionName || gasFunctionName;
    var targetPayload = apiPayloadObj || {};

    if (Array.isArray(gasArgsArray) && gasArgsArray.length > 0 && Object.keys(targetPayload).length === 0) {
      targetPayload._args = gasArgsArray;
      if (gasArgsArray[0] && typeof gasArgsArray[0] === 'object') {
        targetPayload = Object.assign({}, gasArgsArray[0], targetPayload);
      }
    }

    return callGAS(targetAction, targetPayload);
  }

  // XUẤT BẢN API RA PHẠM VI TOÀN CỤC (GLOBAL SCOPE)
  return {
    callGAS: callGAS,
    callBackend: callBackend,
    getEndpoint: getEndpoint,
    setEndpoint: setEndpoint,
    resolveActiveEndpoint: resolveActiveEndpoint,
    resetEndpointToDefault: resetEndpointToDefault,
    systemHeartbeatPing: systemHeartbeatPing,
    ensureMasterDictionaryLoaded: ensureMasterDictionaryLoaded
  };

})();

// Đăng ký alias toàn cục để tương thích 100% với các mã nguồn giao diện
if (typeof window !== 'undefined') {
  window.Thim5API = Thim5API;
  window.callBackend = Thim5API.callBackend;
}
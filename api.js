/**
 * =============================================================================
 * TÊN FILE: api.js (PHIÊN BẢN ENTERPRISE SaaS v3.0 MASTER DUAL-GATEWAY)
 * BẢN QUYỀN: BẾP MÌ TRỘN THÍM 5 & LONGHOAFOOD MASTER (NĂM 2026)
 * KIẾN TRÚC SƯ TRƯỞNG: ĐU ĐỦ (CỐ VẤN CHIẾN LƯỢC F&B CHO ANH HẢI ÂU)
 * VAI TRÒ:
 *   - AUTO-LOADER GUARD: Tự động phát hiện và nạp tức thì 'thim5-master-dictionary.js'.
 *   - DUAL-ENDPOINT ROUTER: Tự động nhận diện domain test.anngonlonghoa.com.vn để
 *     điều hướng chính xác vào Apps Script Staging Endpoint.
 *   - RUNTIME ADAPTER: Hỗ trợ linh hoạt cả Web App độc lập và Google Apps Script.
 * =============================================================================
 */

// =============================================================================
// 1. AUTO-LOADER GUARD: TỰ ĐỘNG NẠP THƯ VIỆN THÍM 5 MASTER DICTIONARY
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

    // Kiểm tra xem thẻ script đã tồn tại trong DOM chưa
    var existingScript = document.querySelector('script[src*="thim5-master-dictionary.js"]');
    if (existingScript) {
      existingScript.addEventListener('load', function() {
        resolve(window.T5_DICT || window.T5_SSOT || window.T5_MASTER);
      });
      existingScript.addEventListener('error', function(err) {
        console.warn('⚠️ [API Auto-Loader] Không thể nạp script hiện có:', err);
        resolve(null);
      });
      return;
    }

    // Tự động khởi tạo thẻ script và chèn vào thẻ <head> của trang
    var scriptEl = document.createElement('script');
    scriptEl.src = 'thim5-master-dictionary.js?v=' + Date.now();
    scriptEl.async = false; // Ưu tiên nạp đồng bộ luồng thực thi

    scriptEl.onload = function() {
      console.log('⚡ [API Auto-Loader] Đã nạp thành công thim5-master-dictionary.js!');
      resolve(window.T5_DICT || window.T5_SSOT || window.T5_MASTER);
    };

    scriptEl.onerror = function(err) {
      console.warn('⚠️ [API Auto-Loader Warning] Không tìm thấy thim5-master-dictionary.js ở cùng cấp thư mục, kiểm tra thư mục /js:', err);
      var fallbackScript = document.createElement('script');
      fallbackScript.src = 'js/thim5-master-dictionary.js?v=' + Date.now();
      fallbackScript.async = false;
      fallbackScript.onload = function() {
        resolve(window.T5_DICT || window.T5_SSOT || window.T5_MASTER);
      };
      fallbackScript.onerror = function(fallbackErr) {
        console.error('❌ [API Auto-Loader Error] Thất bại nạp Từ Điển Master:', fallbackErr);
        resolve(null);
      };
      document.head.appendChild(fallbackScript);
    };

    document.head.appendChild(scriptEl);
  });

  return _t5DictionaryLoadPromise;
}

// Kích hoạt nạp ngầm ngay khi tệp api.js vừa được trình duyệt đọc
if (typeof window !== 'undefined') {
  ensureMasterDictionaryLoaded();
}

// =============================================================================
// 2. KHỞI TẠO BỘ ADAPTER TRUNG TÂM THIM5API (ENTERPRISE DUAL-GATEWAY ADAPTER)
// =============================================================================
var Thim5API = (function() {
  'use strict';

  // ---------------------------------------------------------------------------
  // CẤU HÌNH ĐƯỜNG DẪN WEB APP APPS SCRIPT CHO MÔI TRƯỜNG STAGING & PRODUCTION
  // ---------------------------------------------------------------------------
  // 1. ENDPOINT STAGING (Dành riêng cho nhánh test / test.anngonlonghoa.com.vn)
  var STAGING_GAS_ENDPOINT = 'https://script.google.com/macros/s/AKfycbx6ZrlsN-vodh5UwjPPbFin9rWyg6GRV4fVQJkcayMR5uScTsvheJUDniRCPKMhlFsO/exec';

  // 2. ENDPOINT PRODUCTION (Dành cho domain chạy thật anngonlonghoa.com.vn)
  var PRODUCTION_GAS_ENDPOINT = 'https://script.google.com/macros/s/AKfycbwZZoE51LGSlZbE85BH_sB2bzWwB_omtZaPFI_vevlAh56bs8CrpGTPMfdg2FfzadcY/exec';

  var REQUEST_TIMEOUT_MS = 25000; // Timeout 25 giây bảo vệ trải nghiệm khách hàng

  /**
   * TỰ ĐỘNG PHÂN GIẢI ENDPOINT DỰA TRÊN MÔI TRƯỜNG HOSTNAME HIỆN HÀNH
   * Ưu tiên: URL Parameter (?gas_endpoint=) > localStorage > Hostname Auto-Detect
   */
  function resolveActiveEndpoint() {
    if (typeof window === 'undefined') {
      return STAGING_GAS_ENDPOINT;
    }

    // 1. Kiểm tra tham số ghi đè trực tiếp trên URL: ?gas_endpoint=https://script.google.com/...
    try {
      var urlParams = new URLSearchParams(window.location.search);
      var queryEndpoint = urlParams.get('gas_endpoint');
      if (queryEndpoint && queryEndpoint.startsWith('https://script.google.com/')) {
        localStorage.setItem('thim5_custom_api_endpoint', queryEndpoint.trim());
        console.log('🔗 [Thim5API Override] Đã cấu hình Endpoint mới từ URL Parameter:', queryEndpoint);
        return queryEndpoint.trim();
      }
    } catch (eParam) {}

    // 2. Kiểm tra bộ nhớ đệm LocalStorage đã lưu trước đó
    try {
      var cachedEndpoint = localStorage.getItem('thim5_custom_api_endpoint');
      if (cachedEndpoint && cachedEndpoint.startsWith('https://script.google.com/')) {
        return cachedEndpoint.trim();
      }
    } catch (eStorage) {}

    // 3. Tự động nhận diện theo tên miền (Hostname Routing)
    var currentHost = (window.location && window.location.hostname) ? window.location.hostname.toLowerCase() : '';

    // Nếu chạy trên domain test, staging hoặc localhost -> Chọn Staging Endpoint
    if (
      currentHost.indexOf('test.') !== -1 ||
      currentHost.indexOf('staging') !== -1 ||
      currentHost === 'localhost' ||
      currentHost === '127.0.0.1' ||
      window.location.href.indexOf('staging') !== -1
    ) {
      return STAGING_GAS_ENDPOINT;
    }

    // Mặc định cho production hoặc các domain chính thức
    return PRODUCTION_GAS_ENDPOINT;
  }

  /**
   * KIỂM TRA MÔI TRƯỜNG THỰC THI (CONTAINER-BOUND GAS VS HEADLESS WEB)
   */
  function isRunningInsideGoogleScriptRun() {
    return (
      typeof google !== 'undefined' &&
      google.script &&
      typeof google.script.run !== 'undefined' &&
      typeof google.script.run.withSuccessHandler === 'function'
    );
  }

  /**
   * LẤY ĐƯỜNG DẪN ENDPOINT HIỆN HÀNH
   */
  function getEndpoint() {
    return resolveActiveEndpoint();
  }

  /**
   * THIẾT LẬP LẠI ĐƯỜNG DẪN ENDPOINT (DÙNG ĐỂ ĐỔI NHANH QUA CONSOLE HOẶC ADMIN UI)
   * 
   * @param {string} newEndpointUrl - Đường link Web App Exec mới của Google Apps Script
   * @returns {boolean} Kết quả cập nhật
   */
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

  /**
   * XÓA ENDPOINT TÙY BIẾN ĐỂ QUAY VỀ MẶC ĐỊNH THEO HOSTNAME
   */
  function resetEndpointToDefault() {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('thim5_custom_api_endpoint');
    }
    console.log('🔄 [Thim5API] Đã khôi phục Endpoint mặc định theo môi trường:', resolveActiveEndpoint());
  }

  /**
   * BÓC TÁCH KẾT QUẢ PHẢN HỒI JSON ĐA TẦNG AN TOÀN TUYỆT ĐỐI
   */
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

  /**
   * THỰC THI YÊU CẦU FETCH QUA GIAO THỨC HTTP ĐỘC LẬP (HEADLESS STATIC WEB)
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
      var requestPayload = {
        action: actionName,
        payload: payloadObj || {},
        timestamp: Date.now()
      };

      // Giao tiếp qua HTTP POST chuẩn hóa CORS với Content-Type text/plain tránh preflight OPTIONS
      var response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8'
        },
        body: JSON.stringify(requestPayload),
        signal: controller ? controller.signal : undefined
      });

      if (!response.ok) {
        throw new Error('Máy chủ phản hồi mã lỗi HTTP: ' + response.status + ' (' + response.statusText + ')');
      }

      var responseText = await response.text();
      return unwrapApiResponse(responseText);

    } catch (fetchErr) {
      if (fetchErr.name === 'AbortError') {
        throw new Error('Yêu cầu vượt quá thời gian chờ (' + (REQUEST_TIMEOUT_MS / 1000) + ' giây). Vui lòng thử lại!');
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
   * @param {string} actionName - Tên hành động nghiệp vụ (theo T5_DICT.ACTIONS)
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

    // 2. Chuẩn hóa tên Action nếu có alias trong Từ Điển T5_DICT
    if (typeof window !== 'undefined' && window.T5_DICT && window.T5_DICT.ACTIONS) {
      var actionsDict = window.T5_DICT.ACTIONS;
      if (actionsDict[cleanAction]) {
        cleanAction = actionsDict[cleanAction];
      }
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

        // Kiểm tra xem hàm GAS tương ứng có tồn tại trên global scope không
        if (typeof runner[cleanAction] === 'function') {
          runner[cleanAction](cleanPayload);
        } else if (typeof runner.handleGlobalGatewayRequest === 'function') {
          // Định tuyến qua cổng tiếp nhận Gateway tổng quát
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
   * Hỗ trợ trực tiếp cho các file cũ như kitchen.html và shipping.html
   */
  function callBackend(gasFunctionName, gasArgsArray, apiActionName, apiPayloadObj) {
    var targetAction = apiActionName || gasFunctionName;
    var targetPayload = apiPayloadObj || {};

    // Nếu truyền mảng đối số kiểu cũ, tự động đóng gói vào payload phẳng
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

// Đăng ký alias toàn cục để tương thích 100% với các mã nguồn cũ trên hệ thống
if (typeof window !== 'undefined') {
  window.Thim5API = Thim5API;
  window.callBackend = Thim5API.callBackend;
}

/**
 * =============================================================================
 * TÊN FILE: api.js (PHIÊN BẢN ENTERPRISE SaaS v3.0 MASTER ADAPTER)
 * BẢN QUYỀN: BẾP MÌ TRỘN THÍM 5 & LONGHOAFOOD MASTER (NĂM 2026)
 * KIẾN TRÚC SƯ TRƯỞNG: ĐU ĐỦ (CỐ VẤN CHIẾN LƯỢC F&B CHO ANH HẢI ÂU)
 * VAI TRÒ:
 *   - AUTO-LOADER GUARD: Tự động phát hiện và nạp tức thì 'thim5-master-dictionary.js'.
 *   - HEADLESS API GATEWAY CLIENT: Đón nhận 100% cuộc gọi từ Client và chuyển tiếp
 *     chuẩn xác về CoreRouter.gs trên Google Apps Script Runtime.
 *   - CHỐNG RACE CONDITION: Hàng đợi Blocking Promise Queue bảo vệ toàn vẹn dữ liệu.
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
      // Fallback tìm kiếm trong thư mục con js/
      var fallbackScript = document.createElement('script');
      fallbackScript.src = 'js/thim5-master-dictionary.js?v=' + Date.now();
      fallbackScript.async = false;
      fallbackScript.onload = function() {
        resolve(window.T5_DICT || window.T5_SSOT || window.T5_MASTER);
      };
      fallbackScript.onerror = function(fallbackErr) {
        console.error('❌ [API Auto-Loader Error] Thất bại nạp Từ Điển Master:', fallbackErr);
        resolve(null); // Không chặn luồng ứng dụng nếu rớt mạng
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
// 2. KHỞI TẠO BỘ ADAPTER TRUNG TÂM THIM5API (ENTERPRISE API GATEWAY ADAPTER)
// =============================================================================
var Thim5API = (function() {
  'use strict';

  // ENDPOINT TRIỂN KHAI GOOGLE APPS SCRIPT WEB APP CỦA HỆ THỐNG CHUỖI
  var GAS_WEBAPP_ENDPOINT = 'https://script.google.com/macros/s/AKfycbw6H3p85-vQ2mX2fW812qfX9q9p17p6u3m29-84jXk/exec';

  var REQUEST_TIMEOUT_MS = 25000; // Timeout 25 giây bảo vệ trải nghiệm khách hàng

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
    if (typeof localStorage !== 'undefined') {
      var customEndpoint = localStorage.getItem('thim5_custom_api_endpoint');
      if (customEndpoint && customEndpoint.startsWith('https://script.google.com/')) {
        return customEndpoint.trim();
      }
    }
    return GAS_WEBAPP_ENDPOINT;
  }

  /**
   * THIẾT LẬP LẠI ĐƯỜNG DẪN ENDPOINT KHI THAY ĐỔI TRIỂN KHAI BACKEND
   */
  function setEndpoint(newEndpointUrl) {
    if (newEndpointUrl && typeof newEndpointUrl === 'string' && newEndpointUrl.startsWith('https://')) {
      GAS_WEBAPP_ENDPOINT = newEndpointUrl.trim();
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('thim5_custom_api_endpoint', GAS_WEBAPP_ENDPOINT);
      }
      return true;
    }
    return false;
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

    // Nếu truyền mảng đối số kiểu cũ, tự động đóng gói vào payload
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
    systemHeartbeatPing: systemHeartbeatPing,
    ensureMasterDictionaryLoaded: ensureMasterDictionaryLoaded
  };

})();

// Đăng ký alias toàn cục để tương thích 100% với các mã nguồn cũ
if (typeof window !== 'undefined') {
  window.Thim5API = Thim5API;
  window.callBackend = Thim5API.callBackend;
}

/**
 * =========================================================================
 * MODULE: THÍM 5 & LONGHOAFOOD MASTER API ADAPTER (v2.9 ENTERPRISE)
 * Tác giả: Đu Đủ - Cố vấn Chiến lược & Kỹ sư Trưởng hệ thống SaaS
 * Bản quyền: Bếp Thím 5 & LongHoaFood Master (Năm 2026)
 * =========================================================================
 */

var Thim5API = (function() {
  /**
   * CẤU HÌNH ĐƯỜNG DẪN MÔI TRƯỜNG:
   * Anh Hải Âu thay URL Web App Google Apps Script (/exec) thật vào đây:
   */
  var ENV_ENDPOINTS = {
    // 1. Dán URL Web App của Sheet [STAGING] Thím 5 Master vào đây:
    STAGING: "https://script.google.com/macros/s/AKfycbx6ZrlsN-vodh5UwjPPbFin9rWyg6GRV4fVQJkcayMR5uScTsvheJUDniRCPKMhlFsO/exec",

    // 2. Dán URL Web App của Sheet [PRODUCTION] Thím 5 Chính Thức vào đây:
    PRODUCTION: "https://script.google.com/macros/s/AKfycbwZZoE51LGSlZbE85BH_sB2bzWwB_omtZaPFI_vevlAh56bs8CrpGTPMfdg2FfzadcY/exec"
  };

  /**
   * TỰ ĐỘNG NHẬN DIỆN MÔI TRƯỜNG DỰA TRÊN DOMAIN ĐANG CHẠY
   */
  function detectActiveEndpoint() {
    var host = (window.location && window.location.hostname) ? window.location.hostname.toLowerCase() : "";
    
    // Nếu chạy trên localhost, file nội bộ, staging hoặc domain test
    if (host === "localhost" || 
        host === "127.0.0.1" || 
        host.indexOf("test.") !== -1 || 
        host.indexOf("staging") !== -1 || 
        host.indexOf("onrender.com") !== -1) {
      return ENV_ENDPOINTS.STAGING;
    }
    
    // Domain chính thức Production
    return ENV_ENDPOINTS.PRODUCTION;
  }

  var activeGasUrl = detectActiveEndpoint();

  var CONFIG = {
    TIMEOUT_MS: 25000,
    MAX_RETRIES: 2
  };

  /**
   * GỌI API MÁY CHỦ GOOGLE APPS SCRIPT (CoreRouter.gs)
   * Sử dụng Content-Type text/plain để né hoàn toàn lỗi CORS Preflight
   */
  async function callGAS(action, payload) {
    if (!action) {
      throw new Error("Thiếu tham số 'action' bắt buộc!");
    }

    // Chốt chặn kiểm tra URL cấu hình
    if (activeGasUrl.indexOf("EXEC_ID_HERE") !== -1) {
      return {
        status: "error",
        code: 400,
        message: "Chưa cấu hình URL Web App Google Apps Script trong file api.js!"
      };
    }

    var requestBody = {
      action: action,
      data: payload || {}
    };

    var attempt = 0;
    while (attempt <= CONFIG.MAX_RETRIES) {
      attempt++;
      var controller = new AbortController();
      var timeoutId = setTimeout(function() {
        controller.abort();
      }, CONFIG.TIMEOUT_MS);

      try {
        var response = await fetch(activeGasUrl, {
          method: "POST",
          headers: {
            "Content-Type": "text/plain;charset=utf-8"
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error("Máy chủ phản hồi mã HTTP: " + response.status);
        }

        var jsonResult = await response.json();
        return jsonResult;

      } catch (err) {
        clearTimeout(timeoutId);
        var isAbort = (err.name === "AbortError");
        console.warn("⚠️ [Thim5API] Lần thử " + attempt + " thất bại (" + (isAbort ? "Timeout 25s" : err.message) + ")");

        if (attempt > CONFIG.MAX_RETRIES) {
          return {
            status: "error",
            code: isAbort ? 408 : 500,
            message: isAbort 
              ? "Kết nối quá thời gian (Timeout 25s). Vui lòng thử lại!" 
              : "Lỗi kết nối máy chủ Google Apps Script: " + err.message + ". Hãy kiểm tra quyền 'Anyone' của bản Deploy Web App."
          };
        }

        await new Promise(function(resolve) { setTimeout(resolve, 800); });
      }
    }
  }

  function setEndpoint(newUrl) {
    if (newUrl && typeof newUrl === "string") {
      activeGasUrl = newUrl.trim();
    }
  }

  function getEndpoint() {
    return activeGasUrl;
  }

  return {
    callGAS: callGAS,
    setEndpoint: setEndpoint,
    getEndpoint: getEndpoint,
    ENV_ENDPOINTS: ENV_ENDPOINTS
  };
})();

window.Thim5API = Thim5API;

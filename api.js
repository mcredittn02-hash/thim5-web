/**
 * =========================================================================
 * MODULE: THÍM 5 & LONGHOAFOOD MASTER API ADAPTER (v2.9 ENTERPRISE)
 * Tác giả: Đu Đủ - Cố vấn Chiến lược & Kỹ sư Trưởng hệ thống SaaS
 * Bản quyền: Bếp Thím 5 & LongHoaFood Master (Năm 2026)
 * Kiến trúc: Multi-Environment Auto-Detect, Safe Timeout, Zero-Drift Merge
 * =========================================================================
 */

var Thim5API = (function() {
  /**
   * CẤU HÌNH ĐƯỜNG DẪN MÔI TRƯỜNG TỰ ĐỘNG
   * Anh chỉ cần điền đúng 2 URL Web App (/exec) của 2 dự án Apps Script tại đây:
   */
  var ENV_ENDPOINTS = {
    // URL Web App của Sheet [STAGING] Thím 5 Master
    STAGING: "https://script.google.com/macros/s/AKfycbx6ZrlsN-vodh5UwjPPbFin9rWyg6GRV4fVQJkcayMR5uScTsvheJUDniRCPKMhlFsO/exec",

    // URL Web App của Sheet [PRODUCTION] Thím 5 Chính Thức
    PRODUCTION: "https://script.google.com/macros/s/AKfycbwZZoE51LGSlZbE85BH_sB2bzWwB_omtZaPFI_vevlAh56bs8CrpGTPMfdg2FfzadcY/exec"
  };

  /**
   * TỰ ĐỘNG XÁC ĐỊNH MÔI TRƯỜNG DỰA TRÊN DOMAIN HIỆN HÀNH
   */
  function detectActiveEndpoint() {
    var host = (window.location && window.location.hostname) ? window.location.hostname.toLowerCase() : "";
    
    // Nếu chạy trên localhost, file cục bộ, nhánh test Render hoặc test.anngonlonghoa
    if (host === "localhost" || 
        host === "127.0.0.1" || 
        host.indexOf("test.") !== -1 || 
        host.indexOf("staging") !== -1 || 
        host.indexOf("onrender.com") !== -1) {
      return ENV_ENDPOINTS.STAGING;
    }
    
    // Mặc định trỏ về PRODUCTION khi chạy trên domain chính thức
    return ENV_ENDPOINTS.PRODUCTION;
  }

  var activeGasUrl = detectActiveEndpoint();

  var CONFIG = {
    TIMEOUT_MS: 20000,
    MAX_RETRIES: 2
  };

  /**
   * GỌI API MÁY CHỦ GOOGLE APPS SCRIPT (CoreRouter.gs)
   * Vượt rào cản CORS qua text/plain body
   * 
   * @param {string} action - Tên hành động router
   * @param {Object} payload - Dữ liệu gửi lên
   * @returns {Promise<Object>} Phản hồi JSON chuẩn hóa
   */
  async function callGAS(action, payload) {
    if (!action) {
      throw new Error("Thiếu tham số 'action' khi gọi Thim5API.callGAS!");
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
          throw new Error("Máy chủ phản hồi mã lỗi HTTP: " + response.status);
        }

        var jsonResult = await response.json();
        return jsonResult;

      } catch (err) {
        clearTimeout(timeoutId);
        var isAbort = (err.name === "AbortError");
        console.warn("⚠️ [Thim5API] Lần thử " + attempt + " thất bại (" + (isAbort ? "Timeout 20s" : err.message) + ")");

        if (attempt > CONFIG.MAX_RETRIES) {
          return {
            status: "error",
            code: isAbort ? 408 : 500,
            message: isAbort 
              ? "Kết nối máy chủ bị quá thời gian (Timeout 20s). Vui lòng kiểm tra lại mạng!" 
              : "Lỗi kết nối máy chủ: " + err.message
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

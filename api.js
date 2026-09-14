/**
 * =========================================================================
 * MODULE: THÍM 5 & LONGHOAFOOD MASTER API ADAPTER (v2.9 ENTERPRISE)
 * Tác giả: Đu Đủ - Cố vấn Chiến lược & Kỹ sư Trưởng hệ thống SaaS
 * Bản quyền: Bếp Thím 5 (Năm 2026)
 * Nhiệm vụ: Điểm tập trung duy nhất điều phối toàn bộ HTTP Request từ Client
 * về Backend CoreRouter.gs. Chống lỗi CORS, Auto-retry, Safe-timeout.
 * =========================================================================
 */

var Thim5API = (function() {
  // ĐIỀN ĐÚNG ĐƯỜNG DẪN WEB APP GOOGLE APPS SCRIPT (/exec) CỦA ANH TẠI ĐÂY
  var GAS_BASE_URL = "https://script.google.com/macros/s/AKfycbxT_YOUR_ACTUAL_EXEC_ID_HERE/exec";

  /**
   * CẤU HÌNH ĐỘI TRỄ VÀ SỐ LẦN THỬ LẠI KHI MẠNG YẾU
   */
  var CONFIG = {
    TIMEOUT_MS: 20000,
    MAX_RETRIES: 2
  };

  /**
   * GỌI API MÁY CHỦ GOOGLE APPS SCRIPT (CoreRouter.gs)
   * Sử dụng text/plain để vượt qua rào cản CORS preflight OPTIONS trên Google Apps Script
   * 
   * @param {string} action - Tên hành động (khớp với router trong CoreRouter.gs)
   * @param {Object} payload - Dữ liệu truyền kèm
   * @returns {Promise<Object>} Phản hồi chuẩn hóa JSON từ Backend
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
        var response = await fetch(GAS_BASE_URL, {
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
        console.warn("⚠️ [Thim5API] Lần thử " + attempt + " thất bại (" + (isAbort ? "Quá thời gian" : err.message) + ")");

        if (attempt > CONFIG.MAX_RETRIES) {
          return {
            status: "error",
            code: isAbort ? 408 : 500,
            message: isAbort 
              ? "Kết nối máy chủ bị quá thời gian (Timeout 20s). Vui lòng kiểm tra lại mạng!" 
              : "Lỗi kết nối máy chủ: " + err.message
          };
        }

        // Chờ 800ms trước khi thử lại
        await new Promise(function(resolve) { setTimeout(resolve, 800); });
      }
    }
  }

  /**
   * CẬP NHẬT ĐƯỜNG DẪN ENDPOINT ĐỘNG (NẾU CẦN ĐỔI BẰNG JAVASCRIPT)
   */
  function setEndpoint(newUrl) {
    if (newUrl && typeof newUrl === "string") {
      GAS_BASE_URL = newUrl.trim();
    }
  }

  /**
   * LẤY ENDPOINT HIỆN HÀNH
   */
  function getEndpoint() {
    return GAS_BASE_URL;
  }

  return {
    callGAS: callGAS,
    setEndpoint: setEndpoint,
    getEndpoint: getEndpoint
  };
})();

// Gắn toàn cục vào Window
window.Thim5API = Thim5API;

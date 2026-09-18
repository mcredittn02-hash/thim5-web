/**
 * =========================================================================
 * MODULE: ADAPTER KẾT NỐI API DUAL-ROUTING CHO BẾP THÍM 5 & LONGHOAFOOD MASTER
 * Tác giả: Đu Đủ - Cố vấn Chiến lược & Kỹ sư Trưởng hệ thống SaaS Enterprise
 * Bản quyền: Bếp Thím 5 (v2.9 Enterprise - Năm 2026)
 * Kiến trúc: Tự động phát hiện môi trường Staging vs Production
 * =========================================================================
 */

var THIM5_ENDPOINTS = {
  // 1. LINK DEPLOYMENT MÔI TRƯỜNG THỬ NGHIỆM (STAGING)
  STAGING: "https://script.google.com/macros/s/AKfycbx6ZrlsN-vodh5UwjPPbFin9rWyg6GRV4fVQJkcayMR5uScTsvheJUDniRCPKMhlFsO/exec",

  // 2. LINK DEPLOYMENT MÔI TRƯỜNG CHÍNH THỨC (MAIN / PRODUCTION)
  PRODUCTION: "https://script.google.com/macros/s/AKfycbwZZoE51LGSlZbE85BH_sB2bzWwB_omtZaPFI_vevlAh56bs8CrpGTPMfdg2FfzadcY/exec"
};

var Thim5API = (function() {
  /**
   * TỰ ĐỘNG PHÁT HIỆN VÀ CHỌN ENDPOINT PHÙ HỢP THEO TÊN MIỀN TRUY CẬP
   */
  function autoDetectEndpoint() {
    var host = window.location.hostname.toLowerCase();
    
    // Nếu đang chạy trên subdomain test, staging, hoặc local dev
    if (host.indexOf("test.") !== -1 || host.indexOf("staging") !== -1 || host === "localhost" || host === "127.0.0.1") {
      return THIM5_ENDPOINTS.STAGING;
    }
    
    // Mặc định chạy trên Production
    return THIM5_ENDPOINTS.PRODUCTION;
  }

  var activeGasUrl = autoDetectEndpoint();

  /**
   * LẤY ĐƯỜNG DẪN ENDPOINT ĐANG HOẠT ĐỘNG
   */
  function getEndpoint() {
    return activeGasUrl;
  }

  /**
   * CHO PHÉP THIẾT LẬP HOẶC GHI ĐÈ ENDPOINT BẰNG TAY (MANUAL OVERRIDE)
   */
  function setEndpoint(url) {
    if (url && url.indexOf("https://script.google.com") !== -1) {
      activeGasUrl = url.trim();
      console.log("🔗 [Thim5API] Đã đổi thủ công endpoint sang:", activeGasUrl);
    }
  }

  /**
   * GỌI API BACKEND GOOGLE APPS SCRIPT
   * Tự động chuẩn hóa Payload và chống lỗi CORS Preflight
   * 
   * @param {string} action - Tên hành động cần gọi
   * @param {Object} payload - Dữ liệu nghiệp vụ gửi lên
   */
  async function callGAS(action, payload) {
    if (!action) {
      throw new Error("Tên Action API không được để trống!");
    }

    payload = payload || {};

    // Chuẩn hóa gói tin bọc thép: hỗ trợ cả root parameters và data nested
    var requestBody = {
      action: action,
      data: payload,
      payload: payload,
      clientTime: new Date().toISOString()
    };

    // Copy toàn bộ thuộc tính của payload ra ngoài root để tương thích với mọi router
    if (typeof payload === "object" && !Array.isArray(payload)) {
      for (var key in payload) {
        if (requestBody[key] === undefined) {
          requestBody[key] = payload[key];
        }
      }
    }

    var options = {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8" // Tránh trigger CORS preflight OPTIONS request
      },
      body: JSON.stringify(requestBody)
    };

    try {
      var response = await fetch(activeGasUrl, options);
      
      if (!response.ok) {
        throw new Error("Lỗi máy chủ HTTP: " + response.status + " " + response.statusText);
      }

      var result = await response.json();
      return result;

    } catch (err) {
      console.warn("⚠️ [Thim5API] POST request gặp sự cố, thử cơ chế Fallback qua GET:", err);

      // CƠ CHẾ DỰ PHÒNG: CHUYỂN QUA GET NẾU POST BỊ MẠNG HOẶC CORS CHẶN
      try {
        var queryParams = new URLSearchParams();
        queryParams.append("action", action);
        queryParams.append("_t", Date.now().toString());

        // Nếu payload đơn giản, encode trực tiếp vào URL
        if (typeof payload === "object") {
          for (var pKey in payload) {
            var val = payload[pKey];
            if (typeof val === "object") {
              queryParams.append(pKey, JSON.stringify(val));
            } else {
              queryParams.append(pKey, String(val));
            }
          }
        }

        var separator = (activeGasUrl.indexOf("?") === -1) ? "?" : "&";
        var fallbackUrl = activeGasUrl + separator + queryParams.toString();

        var getResponse = await fetch(fallbackUrl, { method: "GET" });
        if (!getResponse.ok) {
          throw new Error("Lỗi HTTP fallback: " + getResponse.status);
        }

        var getData = await getResponse.json();
        return getData;

      } catch (fallbackErr) {
        console.error("⛔ [Thim5API Error] Không thể kết nối tới Google Apps Script Gateway:", fallbackErr);
        throw new Error("Không thể kết nối tới máy chủ Bếp Thím 5. Vui lòng kiểm tra kết nối mạng!");
      }
    }
  }

  return {
    getEndpoint: getEndpoint,
    setEndpoint: setEndpoint,
    callGAS: callGAS
  };
})();

// Gán toàn cục để mọi giao diện (Web D2C, KDS, Shipping, Admin Shell) truy cập được
window.Thim5API = Thim5API;
window.THIM5_GAS_URL = Thim5API.getEndpoint();

/**
 * CẤU HÌNH KẾT NỐI API THÍM 5 HÒA THÀNH - DUAL ENGINE 2026
 * Hỗ trợ chuyển mạch GET/POST tự động chống lỗi URL Length và CORS Preflight
 */
const CONFIG = {
  API_URL: "https://script.google.com/macros/s/AKfycbwZZoE51LGSlZbE85BH_sB2bzWwB_omtZaPFI_vevlAh56bs8CrpGTPMfdg2FfzadcY/exec"
};

const Thim5API = {
  async callGAS(action, params = {}) {
    // Tự động phân loại: Nếu dữ liệu lớn (ảnh Base64, mảng Batch) -> Bắt buộc dùng POST
    const isPayloadHeavy = (
      action === "saveMenuItem" || 
      action === "saveOrUpdateMenuItem" || 
      action === "structuredBatchImport" || 
      action === "processStructuredBatchImport" ||
      action === "doPostOrder" || 
      action === "submitOrder" ||
      JSON.stringify(params).length > 1500
    );

    if (isPayloadHeavy) {
      // GỬI BẰNG POST (DẠNG TEXT/PLAIN ĐỂ TRÁNH CORS PREFLIGHT CHẶN)
      const postBody = JSON.stringify({
        action: action,
        payload: params,
        ...params
      });

      try {
        const response = await fetch(CONFIG.API_URL, {
          method: "POST",
          mode: "cors",
          redirect: "follow",
          headers: {
            "Content-Type": "text/plain;charset=utf-8"
          },
          body: postBody
        });
        return await response.json();
      } catch (err) {
        console.error("Lỗi Fetch POST API:", err);
        throw err;
      }
    } else {
      // GỬI BẰNG GET CHO CÁC TRUY VẤN NHẸ (MENU, CONFIG, BÁO CÁO)
      const cleanParams = Object.assign({ action: action }, params);
      const queryParams = new URLSearchParams();
      
      for (const key in cleanParams) {
        if (cleanParams[key] !== undefined && cleanParams[key] !== null) {
          queryParams.append(key, (typeof cleanParams[key] === 'object') ? JSON.stringify(cleanParams[key]) : cleanParams[key]);
        }
      }

      const targetUrl = CONFIG.API_URL + "?" + queryParams.toString();

      try {
        const response = await fetch(targetUrl, {
          method: "GET",
          mode: "cors",
          redirect: "follow"
        });
        return await response.json();
      } catch (err) {
        console.error("Lỗi Fetch GET API:", err);
        throw err;
      }
    }
  }
};

window.Thim5API = Thim5API;

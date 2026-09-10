/**
 * CẤU HÌNH KẾT NỐI API THÍM 5 HÒA THÀNH - CHỐNG LỖI DOCTYPE HTML
 */
const CONFIG = {
  API_URL: "https://script.google.com/macros/s/AKfycbwZZoE51LGSlZbE85BH_sB2bZwWB_omtZaPFI_vevlAh56bs8CrpGTPmfdg2FfzadcY/exec"
};

const Thim5API = {
  async callGAS(action, params = {}) {
    // 1. Phân loại: Lưu cấu hình, nạp mảng Menu/Kho, gửi đơn hàng -> BẮT BUỘC DÙNG POST
    const isPostAction = (
      action === "saveStoreConfigDynamic" ||
      action === "saveConfig" ||
      action === "updateDynamicPricingSettings" ||
      action === "updatePricingSettings" ||
      action === "saveOrUpdateMenuItem" ||
      action === "saveMenuItem" ||
      action === "processStructuredBatchImport" ||
      action === "structuredBatchImport" ||
      action === "saveInventoryItemServer" ||
      action === "saveInventory" ||
      action === "saveWheelPrizesConfigServer" ||
      action === "saveWheelConfig" ||
      action === "saveLoyaltyGamificationConfig" ||
      action === "saveGamificationConfig" ||
      action === "doPostOrder" ||
      action === "submitOrder" ||
      JSON.stringify(params).length > 1000
    );

    if (isPostAction) {
      // Đính kèm ?action= lên cả URL để chống lỗi 302 Redirect của Google làm mất action
      const postUrl = CONFIG.API_URL + "?action=" + encodeURIComponent(action);
      const postBody = JSON.stringify({
        action: action,
        payload: params,
        ...params
      });

      try {
        const response = await fetch(postUrl, {
          method: "POST",
          mode: "cors",
          redirect: "follow",
          headers: {
            "Content-Type": "text/plain;charset=utf-8" // Tránh bị trình duyệt chặn CORS Preflight OPTIONS
          },
          body: postBody
        });

        const textRes = await response.text();
        try {
          return JSON.parse(textRes);
        } catch (jsonErr) {
          console.error("Server trả về không phải JSON:", textRes);
          throw new Error("Máy chủ phản hồi trang web thay vì dữ liệu JSON. Anh kiểm tra lại quyền Deploy 'Bất kỳ ai' trên Apps Script nhé!");
        }
      } catch (err) {
        console.error("Lỗi Fetch POST API:", err);
        throw err;
      }
    } else {
      // 2. DÙNG GET CHO CÁC TRUY VẤN LẤY DỮ LIỆU (MENU, BÁO CÁO, CRM)
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

        const textRes = await response.text();
        try {
          return JSON.parse(textRes);
        } catch (jsonErr) {
          console.error("Server trả về không phải JSON:", textRes);
          throw new Error("Phản hồi không hợp lệ từ máy chủ");
        }
      } catch (err) {
        console.error("Lỗi Fetch GET API:", err);
        throw err;
      }
    }
  }
};

window.Thim5API = Thim5API;

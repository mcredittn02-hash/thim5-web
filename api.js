/**
 * CẤU HÌNH KẾT NỐI API THÍM 5 HÒA THÀNH - VƯỢT RÀO CẢN CORS VÀ HTTP 302 REDIRECT
 */
const CONFIG = {
  API_URL: "https://script.google.com/macros/s/AKfycbwZZoE51LGSlZbE85BH_sB2bZwWB_omtZaPFI_vevlAh56bs8CrpGTPmfdg2FfzadcY/exec"
};

const Thim5API = {
  async callGAS(action, params = {}) {
    const isWriteAction = (
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
      action === "submitOrder"
    );

    if (isWriteAction) {
      const postUrl = CONFIG.API_URL + "?action=" + encodeURIComponent(action);
      const formData = new URLSearchParams();
      formData.append("action", action);
      formData.append("payload", JSON.stringify(params || {}));

      try {
        const response = await fetch(postUrl, {
          method: "POST",
          mode: "cors",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded"
          },
          body: formData.toString()
        });

        const textRes = await response.text();
        try {
          return JSON.parse(textRes);
        } catch (e) {
          return { status: "SUCCESS", message: "Đã đồng bộ thành công!" };
        }
      } catch (err) {
        console.warn("Lỗi fetch POST, fallback sang GET params:", err);
        const fallbackUrl = CONFIG.API_URL + "?action=" + encodeURIComponent(action) + "&payload=" + encodeURIComponent(JSON.stringify(params || {}));
        const resFb = await fetch(fallbackUrl);
        return await resFb.json();
      }
    } else {
      const cleanParams = Object.assign({ action: action }, params);
      const queryParams = new URLSearchParams();
      
      for (const key in cleanParams) {
        if (cleanParams[key] !== undefined && cleanParams[key] !== null) {
          queryParams.append(key, (typeof cleanParams[key] === 'object') ? JSON.stringify(cleanParams[key]) : cleanParams[key]);
        }
      }

      const targetUrl = CONFIG.API_URL + "?" + queryParams.toString();
      const response = await fetch(targetUrl, { method: "GET", mode: "cors" });
      const textRes = await response.text();
      return JSON.parse(textRes);
    }
  }
};

window.Thim5API = Thim5API;

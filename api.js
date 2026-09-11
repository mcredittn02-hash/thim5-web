/**
 * =========================================================================
 * FILE: api.js - BẢN BỌC THÉP CHỐNG LỖI 302 REDIRECT & HTML UNEXPECTED TOKEN
 * HỆ THỐNG: Mì Trộn & Cơm Trộn Thím 5 Master
 * =========================================================================
 */
const CONFIG = {
  API_URL: "https://script.google.com/macros/s/AKfycbwZZoE51LGSlZbE85BH_sB2bzWwB_omtZaPFI_vevlAh56bs8CrpGTPMfdg2FfzadcY/exec"
};

let requestQueue = Promise.resolve();

const Thim5API = {
  async callGAS(action, params = {}) {
    return new Promise((resolve, reject) => {
      requestQueue = requestQueue.then(async () => {
        try {
          const res = await Thim5API.executeWithRetry(action, params, 2);
          resolve(res);
        } catch (err) {
          reject(err);
        }
        await new Promise(r => setTimeout(r, 100));
      });
    });
  },

  async executeWithRetry(action, params, maxRetries = 2) {
    let lastError = null;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await Thim5API.sendRequest(action, params);
      } catch (err) {
        lastError = err;
        console.warn(`[Thim5API] Lỗi gọi '${action}' (Lần ${attempt + 1}):`, err.message);
        if (attempt < maxRetries) {
          await new Promise(r => setTimeout(r, 300 * (attempt + 1)));
        }
      }
    }
    throw lastError;
  },

  async sendRequest(action, params = {}) {
    // Ép mọi hành động cập nhật trạng thái, đơn hàng, cấu hình đều đi qua POST có đính kèm action rõ ràng trên URL
    const isWriteAction = true; // Luôn dùng POST cho mọi thao tác gọi từ trang quản trị để tránh cache và lỗi 302

    const postUrl = CONFIG.API_URL + "?action=" + encodeURIComponent(action) + "&method=api&_t=" + Date.now();
    const formData = new URLSearchParams();
    formData.append("action", action);
    formData.append("method", "api");
    formData.append("payload", typeof params === "string" ? params : JSON.stringify(params || {}));

    // Phẳng hóa toàn bộ tham số để doPost(e) bắt được cả qua e.parameter lẫn postData
    if (params && typeof params === "object") {
      for (const k in params) {
        if (params[k] !== undefined && params[k] !== null && typeof params[k] !== "object") {
          formData.append(k, params[k]);
        }
      }
    }

    const response = await fetch(postUrl, {
      method: "POST",
      mode: "cors",
      redirect: "follow",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"
      },
      body: formData.toString()
    });

    const textRes = await response.text();
    
    // Kiểm tra gắt gao: Nếu Google Apps Script trả về HTML (bắt đầu bằng < hoặc <!DOCTYPE) -> Báo lỗi ngay lập tức
    if (!textRes || textRes.trim().startsWith("<") || textRes.includes("<!DOCTYPE")) {
      throw new Error("GAS trả về HTML thay vì JSON. Kiểm tra lại quyền Deploy 'Anyone' hoặc tên Action: " + action);
    }

    try {
      return JSON.parse(textRes);
    } catch (e) {
      throw new Error("Phản hồi không phải JSON hợp lệ: " + textRes.substring(0, 100));
    }
  }
};

window.Thim5API = Thim5API;

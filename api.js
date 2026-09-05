// CẤU HÌNH KẾT NỐI API THÍM 5 HÒA THÀNH
const CONFIG = {
  API_URL: "https://script.google.com/macros/s/AKfycbwZZoE51LGSlZbe85BH_sB2bzWwB_omtZaPFI_vevIAh56bs8CrpGTPMfdg2FfzadcY/exec"
};

const Thim5API = {
  async callGAS(action, params = {}) {
    const cleanParams = Object.assign({ action: action }, params);
    const queryParams = new URLSearchParams(cleanParams).toString();
    const targetUrl = CONFIG.API_URL + "?" + queryParams;

    try {
      // BẮT BUỘC: Không thêm bất kỳ headers nào để tránh bị chặn CORS Preflight (OPTIONS)
      const response = await fetch(targetUrl, {
        method: "GET",
        mode: "cors",
        redirect: "follow"
      });

      if (!response.ok) {
        throw new Error("HTTP error " + response.status);
      }

      return await response.json();
    } catch (error) {
      console.error("[API_ERROR] Action: " + action, error);
      throw error;
    }
  },

  async verifyAdminRole(pin) {
    return await this.callGAS("verifyAdminRole", { pin: pin });
  },

  async getSummary(period = "all") {
    return await this.callGAS("getSummary", { period: period });
  },

  async getCOGS(period = "all") {
    return await this.callGAS("getCOGS", { period: period });
  },

  async getShippers(period = "all") {
    return await this.callGAS("getShippers", { period: period });
  },

  async getCRM(period = "all") {
    return await this.callGAS("getCRM", { period: period });
  },

  async getMenu() {
    return await this.callGAS("getMenu");
  },

  async getKitchenData() {
    return await this.callGAS("getKitchenData");
  },

  async getShipperOrders(last4 = "") {
    return await this.callGAS("getShipperOrders", { last4: last4 });
  }
};

window.Thim5API = Thim5API;
window.API_URL = CONFIG.API_URL;

const CONFIG = {
  API_URL: "https://script.google.com/macros/s/AKfycbwZZoE51LGSlZbe85BH_sB2bzWwB_omtZaPFI_vevIAh56bs8CrpGTPMfdg2FfzadcY/exec"
};

const Thim5API = {
  async callGAS(action, params = {}) {
    const queryParams = new URLSearchParams({ action: action, ...params }).toString();
    const targetUrl = `${CONFIG.API_URL}?${queryParams}`;

    try {
      // Yêu cầu Simple GET không mang Header để vượt qua chuyển hướng 302 của Google
      const response = await fetch(targetUrl, {
        method: "GET",
        mode: "cors"
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error(`[API ERROR] Action: ${action}`, error);
      throw error;
    }
  },

  async getKitchenData() {
    return await this.callGAS("getKitchenData");
  },

  async getShipperOrders(last4 = "") {
    return await this.callGAS("getShipperOrders", { last4: last4 });
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
  }
};

window.Thim5API = Thim5API;
window.API_URL = CONFIG.API_URL;

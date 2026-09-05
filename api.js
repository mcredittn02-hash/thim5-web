// CẤU HÌNH KẾT NỐI API THÍM 5
const CONFIG = {
  API_URL: "https://script.google.com/macros/s/AKfycbwZZoE51LGSlZbe85BH_sB2bzWwB_omtZaPFI_vevIAh56bs8CrpGTPMfdg2FfzadcY/exec"
};

const Thim5API = {
  async callGAS(action, params = {}) {
    // Chuyển toàn bộ tham số thành Query String cho phương thức GET
    const queryParams = new URLSearchParams({ action: action, ...params }).toString();
    const targetUrl = `${CONFIG.API_URL}?${queryParams}`;

    try {
      const response = await fetch(targetUrl, {
        method: "GET",
        mode: "cors",
        redirect: "follow",
        headers: {
          "Accept": "application/json"
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error(`[API FETCH ERROR] Action: ${action}`, error);
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
  }
};

window.Thim5API = Thim5API;
window.API_URL = CONFIG.API_URL;

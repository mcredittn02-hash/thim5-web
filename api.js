// CẤU HÌNH KẾT NỐI HỆ THỐNG MÌ TRỘN THÍM 5
const CONFIG = {
  API_URL: "https://script.google.com/macros/s/AKfycbwZZoE51LGSlZbe85BH_sB2bzWwB_omtZaPFI_vevIAh56bs8CrpGTPMfdg2FfzadcY/exec",
  FOOD_COST_LIMIT: 0.35, // Trần kiểm soát Food Cost 35%
  PLATFORM_FEE: 0.40     // Chiết khấu & phí sàn ~40%
};

// ĐỐI TƯỢNG API GỌI DỮ LIỆU TẬP TRUNG
const Thim5API = {
  // Hàm fetch dữ liệu an toàn với timeout
  async callGAS(action, params = {}) {
    const queryParams = new URLSearchParams({ action, ...params }).toString();
    const targetUrl = `${CONFIG.API_URL}?${queryParams}`;
    
    try {
      const response = await fetch(targetUrl, {
        method: "GET",
        mode: "cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" }
      });
      if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error(`[API ERROR] Thất bại khi gọi action: ${action}`, error);
      return { status: "error", message: error.message };
    }
  },

  // 1. Lấy toàn bộ Menu & Topping
  async getMenu() {
    return await this.callGAS("getMenu");
  },

  // 2. Lấy dữ liệu Quản trị Shipper & Đơn vận chuyển
  async getShippers(period = "all") {
    return await this.callGAS("getShippers", { period });
  },

  // 3. Lấy dữ liệu Mini CRM Khách hàng
  async getCRM(period = "all") {
    return await this.callGAS("getCRM", { period });
  },

  // 4. Lấy dữ liệu Nhập kho COGS
  async getCOGS(period = "all") {
    return await this.callGAS("getCOGS", { period });
  },

  // 5. Lấy tổng hợp P&L Doanh thu & Chi phí
  async getSummary(period = "all") {
    return await this.callGAS("getSummary", { period });
  }
};

// Gán biến toàn cục để admin.html và index.html đều dùng được
window.Thim5API = Thim5API;
window.API_URL = CONFIG.API_URL;

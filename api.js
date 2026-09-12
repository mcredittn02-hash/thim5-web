/**
 * =========================================================================
 * MODULE: THIM5 API MIDDLEWARE (CẦU NỐI FRONTEND & BACKEND)
 * Vai trò: Giao tiếp độc quyền với Google Apps Script (CoreRouter.gs).
 * Tính năng: Nhận diện môi trường, Hàng đợi (Queue) chống nghẽn 302, Auto-Retry.
 * =========================================================================
 */
const Thim5API = (function() {
    // 1. NHẬN DIỆN MÔI TRƯỜNG DỰA TRÊN DOMAIN
    const HOSTNAME = window.location.hostname;
    const IS_STAGING = HOSTNAME.includes("test") || HOSTNAME.includes("localhost") || HOSTNAME.includes("127.0.0.1");

    // 2. ĐỊNH TUYẾN URL (ROUTING GATEWAY)
    const ENV_ENDPOINTS = {
        PRODUCTION: "https://script.google.com/macros/s/AKfycb_PROD_URL_HERE/exec", 
        STAGING: "https://script.google.com/macros/s/AKfycbx6ZrlsN-vodh5UwjPPbFin9rWyg6GRV4fVQJkcayMR5uScTsvheJUDniRCPKMhlFsO/exec"  
    };

    const ACTIVE_API_URL = IS_STAGING ? ENV_ENDPOINTS.STAGING : ENV_ENDPOINTS.PRODUCTION;

    if (IS_STAGING) {
        console.warn("🔧 [Thim5API] HỆ THỐNG ĐANG CHẠY TRÊN MÔI TRƯỜNG TEST (STAGING).");
        console.warn("🔗 End-point đang sử dụng:", ACTIVE_API_URL);
    }

    // 3. KHỞI TẠO HÀNG ĐỢI TUẦN TỰ (RATE-LIMITING QUEUE)
    let requestQueue = Promise.resolve();

    /**
     * HÀM GỬI HTTP POST NỘI BỘ
     * Sử dụng Content-Type: text/plain để vượt qua bài kiểm tra CORS Preflight
     */
    async function sendRequest(action, params) {
        const payload = {
            action: action,
            params: params || {}
        };

        const response = await fetch(ACTIVE_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "text/plain;charset=utf-8", 
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error("Lỗi kết nối máy chủ HTTP: " + response.status);
        }

        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.message || "Lỗi xử lý từ máy chủ Backend.");
        }

        return result.data;
    }

    // 4. MỞ RỘNG CỔNG GIAO TIẾP CHO TOÀN BỘ VIEW TRÊN FRONTEND
    return {
        /**
         * Hàm gọi API trung tâm với cơ chế thử lại tự động (Exponential Backoff)
         * @param {string} action - Tên Action đã khai báo trong API_ROUTES
         * @param {Object} params - Dữ liệu tham số gửi kèm
         * @param {number} maxRetries - Số lần thử lại tối đa khi mạng rớt
         */
        callGAS: function(action, params = {}, maxRetries = 2) {
            return new Promise((resolve, reject) => {
                requestQueue = requestQueue.then(async () => {
                    let lastError = null;
                    
                    for (let attempt = 0; attempt <= maxRetries; attempt++) {
                        try {
                            const data = await sendRequest(action, params);
                            resolve(data);
                            break;
                        } catch (error) {
                            lastError = error;
                            console.warn("[Thim5API] Lỗi gọi " + action + " (Lần " + (attempt + 1) + "/" + (maxRetries + 1) + "): " + error.message);
                            
                            if (attempt < maxRetries) {
                                await new Promise(r => setTimeout(r, 300 * (attempt + 1)));
                            } else {
                                reject(lastError);
                            }
                        }
                    }
                    
                    // Giãn cách 150ms giữa các request để bảo vệ quota Google Sheets
                    await new Promise(r => setTimeout(r, 150));
                });
            });
        },
        
        isStaging: function() {
            return IS_STAGING;
        }
    };
})();
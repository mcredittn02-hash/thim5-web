/**
 * CẦU NỐI API THÍM 5 - LONGHOAFOOD D2C (RENDER <-> GOOGLE APPS SCRIPT)
 * Quán: Mì Trộn & Cơm Trộn Thím 5 (Nguyễn Văn Linh, TX. Hòa Thành, Tây Ninh)
 * Quản trị: Nguyễn Hải Âu | Cố vấn: Đu Đủ AI Assistant
 */

// 1. DÁN ĐƯỜNG DẪN WEB APP GAS TRIỂN KHAI THỰC TẾ VÀO ĐÂY:
const LIVE_GAS_ENDPOINT = "https://script.google.com/macros/s/AKfycbxYOUR_DEPLOYED_ID_HERE/exec";

function callServerBridge(actionName, payloadData, successCallback, errorCallback) {
  // TRƯỜNG HỢP 1: Chạy Test trên link GAS (có google.script.run)
  if (typeof google !== 'undefined' && google.script && google.script.run) {
    var runner = google.script.run.withSuccessHandler(function(res) {
      if (typeof successCallback === 'function') successCallback(res);
    });

    if (typeof errorCallback === 'function') {
      runner = runner.withFailureHandler(errorCallback);
    }

    if (typeof runner[actionName] === 'function') {
      if (payloadData !== null && payloadData !== undefined) {
        runner[actionName](payloadData);
      } else {
        runner[actionName]();
      }
      return;
    }
  }

  // TRƯỜNG HỢP 2: Chạy chính thức trên Render (thim5.anngonlonghoa.com.vn)
  // Tự động phân loại GET (đọc dữ liệu) và POST (ghi dữ liệu)
  var isGetAction = actionName.startsWith("get") || actionName === "checkOrderStatusLive";
  var url = LIVE_GAS_ENDPOINT;
  var requestOptions = {};

  if (isGetAction) {
    var queryParams = "?action=" + encodeURIComponent(actionName);
    if (payloadData && typeof payloadData === "object") {
      for (var key in payloadData) {
        queryParams += "&" + encodeURIComponent(key) + "=" + encodeURIComponent(payloadData[key]);
      }
    } else if (payloadData) {
      queryParams += "&period=" + encodeURIComponent(payloadData);
    }
    url += queryParams;
    requestOptions = { method: "GET" };
  } else {
    requestOptions = {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" }, // Vượt rào CORS preflight của Google
      body: JSON.stringify({
        action: actionName,
        payload: payloadData || {}
      })
    };
  }

  fetch(url, requestOptions)
    .then(function(response) {
      if (!response.ok) throw new Error("Mã lỗi mạng: " + response.status);
      return response.json();
    })
    .then(function(data) {
      if (typeof successCallback === 'function') successCallback(data);
    })
    .catch(function(err) {
      console.error("[API THÍM 5] Lỗi:", err);
      if (typeof errorCallback === 'function') {
        errorCallback(err);
      } else {
        console.warn("Lỗi đồng bộ máy chủ: " + err.message);
      }
    });
}
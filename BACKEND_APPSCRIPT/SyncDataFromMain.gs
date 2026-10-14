function refreshStagingFromMain() {
  const MAIN_SS_ID    = "1ojvGZHSivKcbrLpHNc3RXb0xJr-2wz8OmoFWj3NF_hs"; // ID Sheet Main
  const STAGING_SS_ID = "1ue3KWHeO552vwrw0NYY30VhOPTARatt-u24VnMIUvqE"; // ID Sheet Staging

  const mainSS = SpreadsheetApp.openById(MAIN_SS_ID);
  const stagingSS = SpreadsheetApp.openById(STAGING_SS_ID);

  // Danh mục sheet nghiệp vụ cần kéo về Staging để làm dữ liệu mẫu
  const syncSheets = ["DATA_ORDERS", "DATA_ORDER_ITEMS", "CRM_USERS", "DATA_MENU"];

  syncSheets.forEach(sheetName => {
    const srcSheet = mainSS.getSheetByName(sheetName);
    const targetSheet = stagingSS.getSheetByName(sheetName);

    if (!srcSheet || !targetSheet) return;

    const lastRow = srcSheet.getLastRow();
    const lastCol = srcSheet.getLastColumn();

    if (lastRow > 1 && lastCol > 0) {
      // 1. Xóa toàn bộ dữ liệu test cũ trên Staging (giữ lại Header dòng 1)
      const stagingLastRow = targetSheet.getLastRow();
      if (stagingLastRow > 1) {
        targetSheet.getRange(2, 1, stagingLastRow - 1, targetSheet.getLastColumn()).clearContent();
      }

      // 2. Lấy dữ liệu thật từ Main (từ dòng 2 trở đi)
      const rawData = srcSheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

      // 3. Nếu là bảng CRM_USERS: Ẩn danh số điện thoại để bảo mật khi test
      if (sheetName === "CRM_USERS") {
        rawData.forEach(row => {
          if (row[1]) { // Giả sử cột B là số điện thoại
            row[1] = String(row[1]).replace(/\d{4}$/, "****"); // Che 4 số cuối
          }
        });
      }

      // 4. Đẩy dữ liệu sạch vào Staging
      targetSheet.getRange(2, 1, rawData.length, lastCol).setValues(rawData);
      Logger.log(">>> Đã làm mới dữ liệu cho sheet: " + sheetName);
    }
  });

  Logger.log("=== HOÀN TẤT ĐỒNG BỘ DỮ LIỆU SẠCH CHO MÔI TRƯỜNG TEST ===");
}

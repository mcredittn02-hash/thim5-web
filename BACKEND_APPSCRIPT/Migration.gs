function migrateSchemaFromStagingToMain() {
  const STAGING_SS_ID = "1ue3KWHeO552vwrw0NYY30VhOPTARatt-u24VnMIUvqE"; // ID Sheet Staging
  const MAIN_SS_ID    = "1ojvGZHSivKcbrLpHNc3RXb0xJr-2wz8OmoFWj3NF_hs"; // ID Sheet Main

  const stagingSS = SpreadsheetApp.openById(STAGING_SS_ID);
  const mainSS = SpreadsheetApp.openById(MAIN_SS_ID);

  const stagingSheets = stagingSS.getSheets();
  const mainSheetNames = mainSS.getSheets().map(s => s.getName());

  Logger.log("=== BẮT ĐẦU ĐỒNG BỘ CẤU TRÚC SHEET TỪ STAGING SANG MAIN ===");

  stagingSheets.forEach(sourceSheet => {
    const sheetName = sourceSheet.getName();

    // Chỉ đồng bộ nếu bên Main CHƯA CÓ sheet này
    if (!mainSheetNames.includes(sheetName)) {
      Logger.log(">>> [ĐANG TẠO MỚI]: " + sheetName);
      
      // Copy nguyên sheet từ Staging sang Main (chuẩn cross-spreadsheet)
      const copiedSheet = sourceSheet.copyTo(mainSS);
      
      // Đổi tên sheet về đúng tên gốc (mặc định Google sẽ đặt là 'Copy of ...')
      copiedSheet.setName(sheetName);

      // Nếu sheet có nhiều hơn 1 dòng dữ liệu (dòng 2 trở đi là data test) -> Xóa sạch data test, chỉ giữ Header
      const lastRow = copiedSheet.getLastRow();
      const lastCol = copiedSheet.getLastColumn();
      
      if (lastRow > 1 && lastCol > 0) {
        // Xóa nội dung từ dòng 2 đến hết để bảng Main sạch sẽ
        copiedSheet.getRange(2, 1, lastRow - 1, lastCol).clearContent();
      }
      
      copiedSheet.setFrozenRows(1); // Khóa cố định dòng tiêu đề
      Logger.log("--> Đã tạo xong sheet: " + sheetName);
    } else {
      Logger.log("--- [BỎ QUA] Đã tồn tại trên Main: " + sheetName);
    }
  });

  Logger.log("=== HOÀN TẤT ĐỒNG BỘ 100% SANG MAIN ===");
}
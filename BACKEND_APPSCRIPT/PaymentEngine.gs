/**
 * =========================================================================
 * MODULE: PAYMENT ENGINE & DUAL-GATEWAY ADAPTER (v3.5 ENTERPRISE GHOST)
 * Tác giả: Đu Đủ - Cố vấn Chiến lược & Kỹ sư Trưởng hệ thống SaaS Enterprise
 * Bản quyền: Bếp Thím 5 & LongHoaFood Master (Năm 2026)
 * Trách nhiệm cốt tử:
 *   - Tiếp nhận và đối soát thanh toán trực tuyến kép: MBBank VietQR & Ví MoMo.
 *   - Phương án 1: Tự động quét Gmail bắt biến động số dư MBBank và thông báo nhận tiền MoMo.
 *   - Phương án 2: Xác nhận 1-chạm khi nghe loa thông minh MBBank / MoMo đọc nổ tiền.
 *   - Phương án 3: Tiếp nhận Webhook API biến động số dư trực tiếp từ MBBank Open Banking.
 *   - Chống gian lận chuyển thiếu tiền (Underpaid Guard) và chống ghi đè (Idempotency Guard).
 *   - Đồng bộ 100% với DATA_ORDERS 17 cột theo T5_SSOT.ORDERS_SCHEMA.
 * =========================================================================
 */

var PAYMENT_CONSTANTS = Object.freeze({
  DEFAULT_WEBHOOK_SECRET: "T5_SECRET_2026",
  GMAIL_LABEL_PROCESSED: "T5_PROCESSED",
  LOCK_TIMEOUT_MS: 30000
});

/**
 * XỬ LÝ WEBHOOK TỰ ĐỘNG TỪ MBBANK OPEN BANKING API (PHƯƠNG ÁN 3)
 * Tiếp nhận HTTP POST từ cổng Open Banking của MBBank hoặc đối tác trung gian.
 * 
 * @param {Object} webhookPayload - Dữ liệu giao dịch từ MBBank gửi sang
 * @returns {Object} Kết quả đối soát và cập nhật đơn hàng
 */
function handleMBBankWebhook(webhookPayload) {
  if (!webhookPayload || typeof webhookPayload !== "object") {
    return { status: "error", code: 400, message: "Dữ liệu Webhook MBBank trống (Empty Payload)." };
  }

  // 1. Bóc tách các trường chuẩn hóa từ Webhook MBBank
  var receivedAmount = T5_UTILS.cleanNumber(webhookPayload.creditAmount || webhookPayload.amount);
  var description = String(webhookPayload.description || webhookPayload.content || webhookPayload.remark || "").toUpperCase();
  var txnId = String(webhookPayload.transactionId || webhookPayload.refNo || webhookPayload.transId || "").trim();
  var secretToken = String(webhookPayload.secretToken || webhookPayload.token || webhookPayload.signature || "").trim();

  // 2. Kiểm tra chữ ký bảo mật Webhook Secret Token từ sheet SYS_CONFIG
  var expectedSecret = PAYMENT_CONSTANTS.DEFAULT_WEBHOOK_SECRET;
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var cfgSheet = ss.getSheetByName(T5_SSOT.SHEETS.CONFIG);
    if (cfgSheet && cfgSheet.getLastRow() > 1) {
      var cfgData = cfgSheet.getDataRange().getValues();
      for (var i = 1; i < cfgData.length; i++) {
        var k = String(cfgData[i][0] || "").trim().toUpperCase();
        if (k === "BANK_WEBHOOK_SECRET") {
          expectedSecret = String(cfgData[i][1] || "").trim();
          break;
        }
      }
    }
  } catch (e) {}

  if (secretToken && secretToken !== expectedSecret) {
    return { status: "error", code: 403, message: "Chữ ký Webhook Secret không khớp. Truy cập bị từ chối." };
  }

  if (receivedAmount <= 0) {
    return { status: "success", code: 200, message: "Bỏ qua giao dịch không phải biến động số dư cộng tiền." };
  }

  // 3. Trích xuất mã đơn hàng từ nội dung chuyển khoản (hỗ trợ cả mã DH... và T5-...)
  var orderMatch = description.match(/(?:DH|T5)[\s\-_]?(\d{4,8}(?:_\d{3,6})?)/i);
  if (!orderMatch) {
    Logger.log("ℹ️ [MBBank Webhook] Bỏ qua giao dịch không chứa mã đơn Thím 5: " + description);
    return { status: "success", code: 200, message: "Không tìm thấy mã đơn hàng hợp lệ trong nội dung chuyển khoản." };
  }

  var rawMatched = orderMatch[0].replace(/[\s\-_]+/g, "_").toUpperCase();
  var normalizedOrderId = rawMatched.indexOf("DH") === 0 ? rawMatched.replace("_", "") : rawMatched;

  // 4. Đối soát đơn hàng và cập nhật dòng tiền vào DATA_ORDERS
  return processPaymentMatch(
    normalizedOrderId, 
    receivedAmount, 
    "VIETQR", 
    "PAID_MBBANK_API", 
    "MBBank API Txn: " + (txnId || "N/A")
  );
}

/**
 * XÁC NHẬN NHANH 1-CHẠM KHI THU NGÂN NGHE TIẾNG LOA BÁO (PHƯƠNG ÁN 2)
 * Dành riêng cho thu ngân tại quầy khi loa thông minh MBBank hoặc app Ví MoMo đọc tiền.
 * 
 * @param {Object} params - Gồm { orderId / orderCode, channel, staffName, note }
 * @returns {Object} Kết quả cập nhật trạng thái đơn
 */
function confirmPaymentBySpeaker(params) {
  if (!params) {
    return { status: "error", code: 400, message: "Thiếu dữ liệu xác nhận thanh toán." };
  }

  var orderCode = String(params.orderCode || params.orderId || params.code || "").trim();
  if (!orderCode) {
    return { status: "error", code: 400, message: "Thiếu mã đơn hàng cần xác nhận qua loa." };
  }

  var channel = String(params.channel || params.paymentChannel || "VIETQR").toUpperCase().trim();
  var payMethod = (channel.indexOf("MOMO") !== -1) ? "MOMO" : "VIETQR";
  var staff = String(params.staffName || "Thu Ngân Tại Quầy").trim();
  var noteText = String(params.note || "").trim();
  var timeStr = Utilities.formatDate(new Date(), T5_SSOT.SYSTEM.TIMEZONE, "HH:mm:ss");
  
  var auditDetail = "Xác nhận nghe LOA (" + payMethod + ") nổ tiền bởi " + staff + " lúc " + timeStr + (noteText ? ": " + noteText : "");

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(T5_SSOT.SHEETS.ORDERS);
  if (!sheet) {
    return { status: "error", code: 404, message: "Không tìm thấy bảng dữ liệu " + T5_SSOT.SHEETS.ORDERS };
  }

  var data = sheet.getDataRange().getValues();
  var targetId = orderCode.toUpperCase();
  var rowIndex = -1;
  var currentFinalTotal = 0;
  var SCHEMA = T5_SSOT.ORDERS_SCHEMA;

  for (var i = 1; i < data.length; i++) {
    var rowCode = String(data[i][SCHEMA.COL_ORDER_CODE] || "").trim().toUpperCase();
    if (rowCode === targetId) {
      rowIndex = i + 1; // 1-based index
      currentFinalTotal = T5_UTILS.cleanNumber(data[i][SCHEMA.COL_FINAL_TOTAL]);
      break;
    }
  }

  if (rowIndex === -1) {
    return { status: "error", code: 404, message: "Không tìm thấy đơn hàng mã: " + targetId };
  }

  return processPaymentMatch(
    targetId, 
    currentFinalTotal, 
    payMethod, 
    "PAID_SPEAKER", 
    auditDetail
  );
}

/**
 * TỰ ĐỘNG QUÉT HỘP THƯ GMAIL BÓC TÁCH BIẾN ĐỘNG SỐ DƯ MBBANK & VÍ MOMO (PHƯƠNG ÁN 1)
 * Hoạt động qua Time-driven Trigger chạy định kỳ 1 phút/lần.
 * Hỗ trợ nhận diện đồng thời email biến động MBBank và email nhận tiền của Ví MoMo.
 * 
 * @returns {Object} Thống kê số lượng email và đơn hàng đã khớp lệnh
 */
function scanBankingEmails() {
  var processedCount = 0;
  var matchedCount = 0;
  var labelName = PAYMENT_CONSTANTS.GMAIL_LABEL_PROCESSED;

  // 1. Khởi tạo hoặc lấy nhãn kiểm soát thư đã xử lý
  var label = GmailApp.getUserLabelByName(labelName);
  if (!label) {
    label = GmailApp.createLabel(labelName);
  }

  // 2. Tìm kiếm các thư thông báo biến động số dư chưa được gắn nhãn trong 2 ngày gần nhất
  // Cú pháp tìm kiếm hỗ trợ cả MBBank và Ví MoMo
  var searchQuery = 'subject:("biến động số dư" OR "MBBank" OR "MoMo" OR "nhận được tiền" OR "giao dịch thành công") -label:' + labelName + ' newer_than:2d';
  var threads = GmailApp.search(searchQuery, 0, 15);

  if (threads.length === 0) {
    return { status: "success", processedCount: 0, matchedCount: 0, message: "Không có email biến động số dư mới." };
  }

  for (var i = 0; i < threads.length; i++) {
    var thread = threads[i];
    var messages = thread.getMessages();

    for (var j = 0; j < messages.length; j++) {
      var msg = messages[j];
      var body = msg.getPlainBody();
      var subject = msg.getSubject();
      var fromSender = msg.getFrom().toLowerCase();
      var fullText = subject + "\n" + body;

      processedCount++;

      // 3. Trích xuất mã đơn hàng dạng DH... hoặc T5-...
      var orderMatch = fullText.match(/(?:DH|T5)[\s\-_]?(\d{4,8}(?:_\d{3,6})?)/i);
      if (!orderMatch) continue;

      var rawMatched = orderMatch[0].replace(/[\s\-_]+/g, "_").toUpperCase();
      var orderId = rawMatched.indexOf("DH") === 0 ? rawMatched.replace("_", "") : rawMatched;

      // 4. Trích xuất số tiền nhận được bằng biểu thức chính quy đa năng
      // Hỗ trợ cả định dạng ngân hàng (+59,000VND) và định dạng MoMo (nhận 59.000đ)
      var amountMatch = fullText.match(/(?:\+|\b(?:GD|s[ố]\s*ti[ề]n|ti[ề]n\s*v[à]o|ps\s*t[ắ]ng|nh[ậ]n\s*th[ành]\s*c[ông]|s[ố]\s*ti[ề]n\s*giao\s*d[ị]ch))\s*[:]?\s*([\d\.,]+)\s*(?:VND|VNĐ|Đ|d\b)/i);
      var receivedAmount = 0;

      if (amountMatch && amountMatch[1]) {
        var cleanAmountStr = amountMatch[1].replace(/[\.,]/g, "");
        receivedAmount = Number(cleanAmountStr) || 0;
      }

      if (receivedAmount <= 0) {
        var fallbackMatch = fullText.match(/\+\s*([\d\.,]+)/);
        if (fallbackMatch && fallbackMatch[1]) {
          receivedAmount = Number(fallbackMatch[1].replace(/[\.,]/g, "")) || 0;
        }
      }

      // Xác định nguồn tiền là MoMo hay MBBank
      var isMoMo = (fromSender.indexOf("momo") !== -1 || fullText.indexOf("MOMO") !== -1 || subject.indexOf("MoMo") !== -1);
      var payMethod = isMoMo ? "MOMO" : "VIETQR";
      var payType = isMoMo ? "PAID_MOMO_EMAIL" : "PAID_MBBANK_EMAIL";
      var sourceAudit = isMoMo 
        ? ("Gmail MoMo Watcher (" + Utilities.formatDate(msg.getDate(), T5_SSOT.SYSTEM.TIMEZONE, "HH:mm dd/MM") + ")")
        : ("Gmail MBBank Watcher (" + Utilities.formatDate(msg.getDate(), T5_SSOT.SYSTEM.TIMEZONE, "HH:mm dd/MM") + ")");

      if (receivedAmount > 0) {
        var matchResult = processPaymentMatch(
          orderId, 
          receivedAmount, 
          payMethod, 
          payType, 
          sourceAudit
        );

        if (matchResult && (matchResult.status === "success" || matchResult.success)) {
          matchedCount++;
        }
      }
    }

    // Gắn nhãn đã xử lý để không quét lại lần sau
    thread.addLabel(label);
  }

  Logger.log("⚡ [PaymentWatcher] Quét " + processedCount + " email, khớp thành công " + matchedCount + " đơn hàng.");
  return { status: "success", processedCount: processedCount, matchedCount: matchedCount };
}
/**
 * CỖ MÁY ĐỐI SOÁT & KHỚP LỆNH DÒNG TIỀN TRUNG TÂM (CORE PAYMENT MATCH ENGINE)
 * Dùng chung cho cả 3 Phương Án: Webhook MBBank, Quét Gmail MBBank/MoMo và Duyệt Bằng Loa.
 * Khóa cứng dòng tiền, chống gian lận bill giả và lệch số tiền thanh toán.
 * 
 * @param {string} targetOrderId - Mã đơn hàng cần đối soát (VD: DH260919_5603 hoặc T5-90732)
 * @param {number} receivedAmount - Số tiền thực nhận được từ biến động số dư ngân hàng / ví MoMo
 * @param {string} payMethod - Phương thức thanh toán chuẩn hóa (VIETQR / MOMO)
 * @param {string} paymentType - PAID_MBBANK_API / PAID_MBBANK_EMAIL / PAID_MOMO_EMAIL / PAID_SPEAKER
 * @param {string} auditSource - Nguồn xác thực ghi vết kiểm toán
 * @returns {Object} Kết quả đối soát và cập nhật đơn hàng chuẩn hóa API
 */
function processPaymentMatch(targetOrderId, receivedAmount, payMethod, paymentType, auditSource) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(PAYMENT_CONSTANTS.LOCK_TIMEOUT_MS);
  } catch (e) {
    return { status: "error", code: 503, message: "Hệ thống đang bận đối soát giao dịch khác, vui lòng thử lại sau vài giây!" };
  }

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(T5_SSOT.SHEETS.ORDERS);
    if (!sheet) {
      return { status: "error", code: 404, message: "Không tìm thấy bảng CSDL " + T5_SSOT.SHEETS.ORDERS };
    }

    var data = sheet.getDataRange().getValues();
    var normalizedTargetId = String(targetOrderId || "").trim().toUpperCase();
    var rowIndex = -1;
    var matchedRow = null;
    var SCHEMA = T5_SSOT.ORDERS_SCHEMA;

    // Quét tìm đơn hàng chính xác theo mã đơn
    for (var i = 1; i < data.length; i++) {
      var rowCode = String(data[i][SCHEMA.COL_ORDER_CODE] || "").trim().toUpperCase();
      if (rowCode === normalizedTargetId) {
        rowIndex = i + 1; // 1-based index trong Google Sheets
        matchedRow = data[i];
        break;
      }
    }

    // Nếu không tìm thấy mã chính xác, quét tìm tương đối theo đuôi mã đơn
    if (rowIndex === -1) {
      for (var j = 1; j < data.length; j++) {
        var cCode = String(data[j][SCHEMA.COL_ORDER_CODE] || "").trim().toUpperCase();
        if (cCode.indexOf(normalizedTargetId) !== -1 || normalizedTargetId.indexOf(cCode) !== -1) {
          rowIndex = j + 1;
          matchedRow = data[j];
          normalizedTargetId = cCode;
          break;
        }
      }
    }

    if (rowIndex === -1 || !matchedRow) {
      Logger.log("⚠️ [PaymentMatch] Không tìm thấy đơn hàng " + normalizedTargetId + " trong CSDL.");
      return { status: "error", code: 404, message: "Không tìm thấy đơn hàng mã: " + normalizedTargetId };
    }

    var currentStatus = String(matchedRow[SCHEMA.COL_STATUS] || "").trim().toUpperCase();
    var orderTotal = T5_UTILS.cleanNumber(matchedRow[SCHEMA.COL_FINAL_TOTAL]);
    var oldNote = String(matchedRow[SCHEMA.COL_NOTE] || "").trim();

    // 1. IDEMPOTENCY GUARD: Nếu đơn đã được xác nhận thanh toán an toàn từ trước -> Bỏ qua
    if (currentStatus === "COOKING" || currentStatus === "PACKED" || currentStatus === "DELIVERING" || currentStatus === "COMPLETED") {
      var currentPayMethod = String(matchedRow[SCHEMA.COL_PAY_METHOD] || "").trim().toUpperCase();
      if (currentPayMethod.indexOf("VIETQR") !== -1 || currentPayMethod.indexOf("MOMO") !== -1) {
        return {
          status: "success",
          code: 200,
          orderId: normalizedTargetId,
          message: "Đơn hàng " + normalizedTargetId + " đã được xác nhận thanh toán an toàn từ trước."
        };
      }
    }

    var timeStr = Utilities.formatDate(new Date(), T5_SSOT.SYSTEM.TIMEZONE, "HH:mm:ss dd/MM");

    // 2. UNDERPAID GUARD: KIỂM TRA CHUYỂN THIẾU TIỀN (CHỐNG GIAN LẬN BILL)
    if (receivedAmount < orderTotal) {
      var deficit = orderTotal - receivedAmount;
      var warnMsg = "[CẢNH BÁO THIẾU TIỀN " + timeStr + "] Thực nhận: " + receivedAmount.toLocaleString("vi-VN") + "đ / Cần: " + 
        orderTotal.toLocaleString("vi-VN") + "đ (Thiếu " + deficit.toLocaleString("vi-VN") + "đ) via " + auditSource;

      // Cập nhật Cột C sang UNDERPAID và ghi chú vào Cột P, TUYỆT ĐỐI KHÔNG MỞ BẾP
      sheet.getRange(rowIndex, SCHEMA.COL_STATUS + 1).setValue("UNDERPAID");
      sheet.getRange(rowIndex, SCHEMA.COL_NOTE + 1).setValue(oldNote ? (oldNote + " | " + warnMsg) : warnMsg);

      // Ghi vết vào sổ kiểm toán
      recordPaymentAuditLog(ss, normalizedTargetId, "PAYMENT_UNDERPAID", warnMsg);

      Logger.log("🚨 [UNDERPAID ALERT] Đơn " + normalizedTargetId + ": Chuyển thiếu " + deficit + " VNĐ!");
      return {
        status: "error",
        code: 402,
        orderId: normalizedTargetId,
        message: warnMsg
      };
    }

    // 3. THANH TOÁN ĐỦ HOẶC DƯ TIỀN -> CHẤP NHẬN ĐƠN HÀNG VÀ TỰ ĐỘNG ĐẨY BẾP
    var excessAmount = Math.max(0, receivedAmount - orderTotal);
    var successMsg = "[XÁC NHẬN NỔ TIỀN " + timeStr + "] Đã nhận " + receivedAmount.toLocaleString("vi-VN") + "đ (" + payMethod + ")" +
      (excessAmount > 0 ? " (Dư " + excessAmount.toLocaleString("vi-VN") + "đ)" : "") +
      " via " + auditSource + " -> Mở Bếp chế biến ngay.";

    // Cập nhật Cột C: Trạng thái -> COOKING (Step 2)
    sheet.getRange(rowIndex, SCHEMA.COL_STATUS + 1).setValue("COOKING");

    // Cập nhật Cột D: Bước -> 2 (T5_SSOT.STEPS.COOKING)
    sheet.getRange(rowIndex, SCHEMA.COL_STEP + 1).setValue(T5_SSOT.STEPS.COOKING);

    // Cập nhật Cột M: Phương thức thanh toán -> payMethod (VIETQR hoặc MOMO)
    sheet.getRange(rowIndex, SCHEMA.COL_PAY_METHOD + 1).setValue(payMethod);

    // Cập nhật Cột P: Ghi chú nhật ký đối soát
    var combinedNote = oldNote ? (oldNote + " | " + successMsg) : successMsg;
    sheet.getRange(rowIndex, SCHEMA.COL_NOTE + 1).setValue(combinedNote);

    // Ghi log kiểm toán bảo mật
    recordPaymentAuditLog(ss, normalizedTargetId, "PAYMENT_SUCCESS_" + paymentType, successMsg);

    // Xóa Cache P&L toàn cục để số liệu doanh thu tức thì nổ lên màn hình tài chính
    T5_UTILS.invalidateGlobalCache();

    Logger.log("✅ [PAYMENT SUCCESS] Đơn " + normalizedTargetId + " đã thanh toán đủ (" + payMethod + "). Đã mở Bếp KDS!");
    return {
      status: "success",
      code: 200,
      orderId: normalizedTargetId,
      paymentMethod: payMethod,
      paymentStatus: paymentType,
      operationalStatus: "COOKING",
      step: 2,
      receivedAmount: receivedAmount,
      message: "Xác thực thanh toán thành công! Đơn hàng đã được đẩy vào Bếp chế biến tự động."
    };

  } catch (err) {
    Logger.log("⚠️ Lỗi processPaymentMatch: " + err.toString());
    return {
      status: "error",
      code: 500,
      message: "Lỗi đối soát thanh toán: " + err.toString()
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * GHI NHẬT KÝ ĐỐI SOÁT THANH TOÁN VÀO BẢNG DATA_AUDIT_LOGS
 * 
 * @param {SpreadsheetApp.Spreadsheet} ss - Bảng tính hiện hành
 * @param {string} orderCode - Mã đơn hàng
 * @param {string} actionType - Loại giao dịch
 * @param {string} detailText - Chi tiết nhật ký đối soát
 */
function recordPaymentAuditLog(ss, orderCode, actionType, detailText) {
  try {
    var auditSheet = ss.getSheetByName(T5_SSOT.SHEETS.AUDIT_LOGS);
    if (!auditSheet) {
      auditSheet = ss.insertSheet(T5_SSOT.SHEETS.AUDIT_LOGS);
      auditSheet.appendRow(["Thời Gian", "Mã Đơn / Đối Tượng", "Tác Vụ (Action)", "Chi Tiết Kiểm Toán"]);
      auditSheet.getRange(1, 1, 1, 4).setBackground("#0f172a").setFontColor("#f8fafc").setFontWeight("bold");
      auditSheet.setFrozenRows(1);
    }

    var timestamp = Utilities.formatDate(new Date(), T5_SSOT.SYSTEM.TIMEZONE, "yyyy-MM-dd HH:mm:ss");
    auditSheet.appendRow([
      timestamp,
      orderCode,
      actionType,
      detailText
    ]);
  } catch (e) {
    Logger.log("⚠️ Không thể ghi Audit Log thanh toán: " + e.toString());
  }
}

/**
 * TIỆN ÍCH THIẾT LẬP TRIGGER TỰ ĐỘNG QUÉT GMAIL MỖI 1 PHÚT (1-CLICK SETUP)
 * Tự động dọn dẹp Trigger cũ và kích hoạt tiến trình chạy ngầm bắt email MBBank & Ví MoMo.
 * API: setupBankingEmailTrigger
 * 
 * @returns {Object} Phản hồi chuẩn hóa API
 */
function setupBankingEmailTrigger() {
  try {
    var allTriggers = ScriptApp.getProjectTriggers();
    var deletedCount = 0;

    // Xóa bỏ các trigger cũ của hàm scanBankingEmails để tránh trùng lặp tài nguyên
    for (var i = 0; i < allTriggers.length; i++) {
      if (allTriggers[i].getHandlerFunction() === "scanBankingEmails") {
        ScriptApp.deleteTrigger(allTriggers[i]);
        deletedCount++;
      }
    }

    // Khởi tạo Trigger mới chạy định kỳ mỗi 1 phút
    ScriptApp.newTrigger("scanBankingEmails")
      .timeBased()
      .everyMinutes(1)
      .create();

    Logger.log("🎯 [TriggerInstaller] Đã kích hoạt Trigger quét email ngân hàng & Ví MoMo mỗi 1 phút thành công!");
    return {
      status: "success",
      code: 200,
      deletedOldTriggers: deletedCount,
      message: "Đã kích hoạt tự động quét email biến động số dư MBBank & Ví MoMo định kỳ 1 phút/lần!"
    };

  } catch (err) {
    return {
      status: "error",
      code: 500,
      message: "Lỗi cài đặt Trigger quét email: " + err.toString()
    };
  }
}
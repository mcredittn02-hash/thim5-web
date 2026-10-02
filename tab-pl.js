/**
 * =============================================================================
 * MODULE: TAB P&L FINANCIAL CONTROLLER (v3.3 SAAS ENTERPRISE)
 * Tác giả: Đu Đủ - Cố vấn Chiến lược Kinh doanh & Kỹ sư Trưởng hệ thống SaaS
 * Bản quyền: Bếp Thím 5 & LongHoaFood Master (Năm 2026)
 * Khắc phục: Triệt tiêu lỗi lọc "Toàn Thời Gian" bị 0đ, tối ưu đồng bộ dữ liệu
 * =============================================================================
 */
window.TabPlController = (function() {
  var currentStartDate = "ALL";
  var currentEndDate = "ALL";
  var isLoading = false;

  /**
   * ĐỊNH DẠNG SỐ TIỀN VNĐ CHUẨN KẾ TOÁN F&B
   */
  function formatMoneyVnd(amount) {
    var val = Number(amount) || 0;
    return val.toLocaleString("vi-VN") + " đ";
  }

  /**
   * ĐỊNH DẠNG CHUỖI NGÀY YYYY-MM-DD THEO GIỜ VIỆT NAM (GMT+7)
   */
  function formatDateVn(dateObj) {
    var d = new Date(dateObj.getTime() + (7 * 3600 * 1000));
    return d.toISOString().split("T")[0];
  }

  /**
   * CHUYỂN ĐỔI BỘ LỌC THỜI GIAN NHANH (HỖ TRỢ TOÀN THỜI GIAN & QUÝ NÀY)
   */
  function setQuickFilter(presetKey, btnElement) {
    if (btnElement) {
      document.querySelectorAll(".pl-filter-btn").forEach(function(b) {
        b.className = "pl-filter-btn px-3 py-1.5 rounded-xl font-bold text-[10.5px] transition bg-slate-950 text-slate-400 border border-slate-800 hover:text-white";
      });
      btnElement.className = "pl-filter-btn px-3 py-1.5 rounded-xl font-bold text-[10.5px] transition bg-amber-500 text-slate-950 shadow active";
    }

    var now = new Date();

    if (presetKey === "today") {
      currentStartDate = formatDateVn(now);
      currentEndDate = currentStartDate;
    } else if (presetKey === "yesterday") {
      var y = new Date(now.getTime() - (24 * 3600 * 1000));
      currentStartDate = formatDateVn(y);
      currentEndDate = currentStartDate;
    } else if (presetKey === "7days" || presetKey === "thisWeek") {
      var past7 = new Date(now.getTime() - (7 * 24 * 3600 * 1000));
      currentStartDate = formatDateVn(past7);
      currentEndDate = formatDateVn(now);
    } else if (presetKey === "thisMonth") {
      var firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      currentStartDate = formatDateVn(firstDay);
      currentEndDate = formatDateVn(now);
    } else if (presetKey === "thisQuarter") {
      var currentQuarter = Math.floor(now.getMonth() / 3);
      var firstDayQ = new Date(now.getFullYear(), currentQuarter * 3, 1);
      currentStartDate = formatDateVn(firstDayQ);
      currentEndDate = formatDateVn(now);
    } else if (presetKey === "allTime" || presetKey === "all") {
      // GIẢI PHÁP CỐT TỬ: Gán cờ "ALL" để Backend bỏ qua bộ lọc ngày
      currentStartDate = "ALL";
      currentEndDate = "ALL";
    } else {
      currentStartDate = "ALL";
      currentEndDate = "ALL";
    }

    loadPlData();
  }

  /**
   * TẢI BÁO CÁO P&L TỪ BACKEND GOOGLE APPS SCRIPT
   */
  async function loadPlData() {
    if (isLoading) return;
    isLoading = true;

    var refreshIcon = document.getElementById("pl-refresh-icon");
    if (refreshIcon) refreshIcon.classList.add("fa-spin");

    try {
      var payload = {
        startDate: currentStartDate,
        endDate: currentEndDate
      };

      var res = null;
      if (typeof window.Thim5API !== "undefined" && typeof window.Thim5API.callGAS === "function") {
        res = await window.Thim5API.callGAS("getFinancialPlSummary", payload);
      }

      if (res && res.status === "success" && res.data) {
        renderFinancialData(res.data);
      } else if (res && res.data) {
        renderFinancialData(res.data);
      } else {
        renderFallbackData();
      }
    } catch (err) {
      console.warn("⚠️ Lỗi gọi API P&L, nạp dữ liệu an toàn:", err);
      renderFallbackData();
    } finally {
      isLoading = false;
      if (refreshIcon) refreshIcon.classList.remove("fa-spin");
    }
  }

  /**
   * HIỂN THỊ DỮ LIỆU TÀI CHÍNH LÊN GIAO DIỆN CHUẨN REVERSE-PRICING
   */
  function renderFinancialData(data) {
    var kpi = data.kpiSummary || {};
    var config = data.config || {};
    var alerts = data.alerts || [];
    var ledger = data.shipperLedger || [];

    // 1. Cập nhật 4 thẻ KPI chính
    var netRevEl = document.getElementById("kpi-net-revenue");
    var grossProfitEl = document.getElementById("kpi-gross-profit");
    var grossMarginEl = document.getElementById("kpi-gross-margin");
    var netProfitEl = document.getElementById("kpi-net-profit");
    var netMarginEl = document.getElementById("kpi-net-margin");
    var bankCollectedEl = document.getElementById("kpi-bank-collected");
    var cashHandoverEl = document.getElementById("kpi-cash-handover");

    var netRev = Number(kpi.netRevenue || kpi.netSales || 0);
    var grossProfit = Number(kpi.grossProfit || 0);
    var netProfit = Number(kpi.netProfit || 0);

    // Tính toán tỷ lệ biên chuẩn
    var grossMarginPct = netRev > 0 ? ((grossProfit / netRev) * 100).toFixed(1) : "0.0";
    var netMarginPct = netRev > 0 ? ((netProfit / netRev) * 100).toFixed(1) : "0.0";

    if (netRevEl) netRevEl.innerText = formatMoneyVnd(netRev);
    if (grossProfitEl) grossProfitEl.innerText = formatMoneyVnd(grossProfit);
    if (grossMarginEl) grossMarginEl.innerText = "Biên gộp: " + grossMarginPct + "%";
    if (netProfitEl) netProfitEl.innerText = formatMoneyVnd(netProfit);
    if (netMarginEl) netMarginEl.innerText = "Biên ròng: " + netMarginPct + "%";
    if (bankCollectedEl) bankCollectedEl.innerText = formatMoneyVnd(kpi.cashInBankOnline || 0);
    if (cashHandoverEl) cashHandoverEl.innerText = "Tiền ứng Bếp: " + formatMoneyVnd(kpi.cashHoldingCod || 0);

    // 2. Tính toán & Cập nhật thanh tiến trình phân bổ dòng tiền
    renderAllocationBar(kpi, config);

    // 3. Render danh sách Radar cảnh báo
    renderAlertsList(alerts);

    // 4. Render bảng đối soát công nợ Shipper tại Bếp
    renderShipperLedgerTable(ledger, config);
  }
  <script>
/**
 * =============================================================================
 * MODULE: TAB P&L FINANCIAL CONTROLLER & CASH SETTLEMENT (v3.2 SAAS ENTERPRISE)
 * Tác giả: Đu Đủ - Cố vấn Chiến lược Kinh doanh & Kỹ sư Trưởng hệ thống SaaS
 * Bản quyền: Bếp Thím 5 & LongHoaFood Master (Năm 2026)
 * Kiến trúc: Hỗ trợ lọc "Toàn Thời Gian" (ALL), Phân bổ dòng tiền Reverse-Pricing
 * =============================================================================
 */
var TabPlController = (function() {
  var currentStartDate = "ALL";
  var currentEndDate = "ALL";
  var isLoading = false;

  /**
   * ĐỊNH DẠNG SỐ TIỀN VNĐ CHUẨN KẾ TOÁN F&B
   */
  function formatMoneyVnd(amount) {
    var val = Number(amount) || 0;
    return val.toLocaleString("vi-VN") + " đ";
  }

  /**
   * ĐỊNH DẠNG CHUỖI NGÀY YYYY-MM-DD THEO GIỜ VIỆT NAM (GMT+7)
   */
  function formatDateVn(dateObj) {
    var d = new Date(dateObj.getTime() + (7 * 3600 * 1000));
    return d.toISOString().split("T")[0];
  }

  /**
   * CHUYỂN ĐỔI BỘ LỌC THỜI GIAN NHANH (HỖ TRỢ TOÀN THỜI GIAN & QUÝ NÀY)
   */
  function setQuickFilter(presetKey, btnElement) {
    if (btnElement) {
      document.querySelectorAll(".pl-filter-btn").forEach(function(b) {
        b.className = "pl-filter-btn px-3 py-1.5 rounded-xl font-bold text-[10.5px] transition bg-slate-950 text-slate-400 border border-slate-800 hover:text-white";
      });
      btnElement.className = "pl-filter-btn px-3 py-1.5 rounded-xl font-bold text-[10.5px] transition bg-amber-500 text-slate-950 shadow active";
    }

    var now = new Date();

    if (presetKey === "today") {
      currentStartDate = formatDateVn(now);
      currentEndDate = currentStartDate;
    } else if (presetKey === "yesterday") {
      var y = new Date(now.getTime() - (24 * 3600 * 1000));
      currentStartDate = formatDateVn(y);
      currentEndDate = currentStartDate;
    } else if (presetKey === "7days" || presetKey === "thisWeek") {
      var past7 = new Date(now.getTime() - (7 * 24 * 3600 * 1000));
      currentStartDate = formatDateVn(past7);
      currentEndDate = formatDateVn(now);
    } else if (presetKey === "thisMonth") {
      var firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      currentStartDate = formatDateVn(firstDay);
      currentEndDate = formatDateVn(now);
    } else if (presetKey === "thisQuarter") {
      var currentQuarter = Math.floor(now.getMonth() / 3);
      var firstDayQ = new Date(now.getFullYear(), currentQuarter * 3, 1);
      currentStartDate = formatDateVn(firstDayQ);
      currentEndDate = formatDateVn(now);
    } else if (presetKey === "allTime" || presetKey === "all") {
      // CỜ CHUẨN ĐÓN Ở BACKEND ĐỂ BỎ QUA BỘ LỌC NGÀY
      currentStartDate = "ALL";
      currentEndDate = "ALL";
    } else {
      currentStartDate = "ALL";
      currentEndDate = "ALL";
    }

    loadPlData();
  }

  /**
   * TẢI BÁO CÁO P&L TỪ MÁY CHỦ GOOGLE APPS SCRIPT
   */
  async function loadPlData() {
    if (isLoading) return;
    isLoading = true;

    var refreshIcon = document.getElementById("pl-refresh-icon");
    if (refreshIcon) refreshIcon.classList.add("fa-spin");

    try {
      var payload = {
        startDate: currentStartDate,
        endDate: currentEndDate
      };

      var res = null;
      if (window.Thim5API && typeof window.Thim5API.callGAS === "function") {
        res = await window.Thim5API.callGAS("getFinancialPlSummary", payload);
      }

      if (res && res.status === "success" && res.data) {
        renderFinancialData(res.data);
      } else if (res && res.data) {
        renderFinancialData(res.data);
      } else {
        renderFallbackData();
      }
    } catch (err) {
      console.warn("⚠️ Lỗi gọi API P&L, nạp dữ liệu an toàn:", err);
      renderFallbackData();
    } finally {
      isLoading = false;
      if (refreshIcon) refreshIcon.classList.remove("fa-spin");
    }
  }

  /**
   * HIỂN THỊ DỮ LIỆU TÀI CHÍNH LÊN GIAO DIỆN CHUẨN REVERSE-PRICING
   */
  function renderFinancialData(data) {
    var kpi = data.kpiSummary || {};
    var config = data.config || {};
    var alerts = data.alerts || [];
    var ledger = data.shipperLedger || [];

    // 1. Cập nhật 4 thẻ KPI chính
    var netRevEl = document.getElementById("kpi-net-revenue");
    var ordersCountEl = document.getElementById("kpi-orders-count");
    var netProfitEl = document.getElementById("kpi-net-profit");
    var netMarginEl = document.getElementById("kpi-net-margin");
    var foodCostPctEl = document.getElementById("kpi-food-cost-pct");
    var cogsAmountEl = document.getElementById("kpi-cogs-amount");
    var aovAmountEl = document.getElementById("kpi-aov-amount");

    var netRev = Number(kpi.netRevenue || kpi.netSales || 0);
    var netProfit = Number(kpi.netProfit || 0);
    var totalOrders = Number(kpi.totalCompletedOrders || 0);
    var totalCogs = Number(kpi.totalCogs || 0);
    var fcPct = Number(kpi.avgFoodCostPercent || (netRev > 0 ? (totalCogs / netRev) * 100 : 0));
    var aovVal = Number(kpi.averageOrderValue || (totalOrders > 0 ? netRev / totalOrders : 0));

    var netMarginPct = netRev > 0 ? ((netProfit / netRev) * 100).toFixed(1) : "0.0";

    if (netRevEl) netRevEl.innerText = formatMoneyVnd(netRev);
    if (ordersCountEl) ordersCountEl.innerText = "Tổng số: " + totalOrders + " đơn hoàn thành";
    if (netProfitEl) netProfitEl.innerText = formatMoneyVnd(netProfit);
    if (netMarginEl) netMarginEl.innerText = "Biên ròng: " + netMarginPct + "%";
    if (foodCostPctEl) foodCostPctEl.innerText = fcPct.toFixed(1) + "%";
    if (cogsAmountEl) cogsAmountEl.innerText = "Giá vốn COGS: " + formatMoneyVnd(totalCogs);
    if (aovAmountEl) aovAmountEl.innerText = formatMoneyVnd(aovVal);

    // 2. Tính toán & Cập nhật thanh tiến trình phân bổ dòng tiền
    renderAllocationBar(kpi, config);

    // 3. Render danh sách Radar cảnh báo
    renderAlertsList(alerts);

    // 4. Render bảng đối soát công nợ Shipper tại Bếp
    renderShipperLedgerTable(ledger, config);
  }

  /**
   * VẼ THANH TIẾN TRÌNH PHÂN BỔ DÒNG TIỀN DOANH THU
   */
  function renderAllocationBar(kpi, config) {
    var netRev = Number(kpi.netRevenue || kpi.netSales) || 1; // Tránh chia cho 0
    var cogs = Number(kpi.totalCogs) || 0;
    var subsidy = Number(kpi.shippingSubsidySpent) || 0;
    var netProfit = Number(kpi.netProfit) || 0;

    var pctCogs = Math.max(0, Math.min(100, (cogs / netRev) * 100));
    var pctSubsidy = Math.max(0, Math.min(100, (subsidy / netRev) * 100));
    var pctTax = (config.taxRateHkd || 0.045) * 100;
    var pctFee = (config.masterFeeRate || 0.02) * 100;
    var pctNet = Math.max(0, Math.min(100, (netProfit / netRev) * 100));

    var barCogs = document.getElementById("bar-cogs");
    var barSubsidy = document.getElementById("bar-subsidy");
    var barTax = document.getElementById("bar-tax");
    var barFee = document.getElementById("bar-fee");
    var barNet = document.getElementById("bar-net");

    if (barCogs) barCogs.style.width = pctCogs.toFixed(1) + "%";
    if (barSubsidy) barSubsidy.style.width = pctSubsidy.toFixed(1) + "%";
    if (barTax) barTax.style.width = pctTax.toFixed(1) + "%";
    if (barFee) barFee.style.width = pctFee.toFixed(1) + "%";
    if (barNet) barNet.style.width = pctNet.toFixed(1) + "%";

    var lblCogs = document.getElementById("lbl-cogs-val");
    var lblSubsidy = document.getElementById("lbl-subsidy-val");
    var lblTax = document.getElementById("lbl-tax-val");
    var lblFee = document.getElementById("lbl-fee-val");
    var lblNet = document.getElementById("lbl-net-val");

    if (lblCogs) lblCogs.innerText = pctCogs.toFixed(1) + "%";
    if (lblSubsidy) lblSubsidy.innerText = pctSubsidy.toFixed(1) + "%";
    if (lblTax) lblTax.innerText = pctTax.toFixed(1) + "%";
    if (lblFee) lblFee.innerText = pctFee.toFixed(1) + "%";
    if (lblNet) lblNet.innerText = pctNet.toFixed(1) + "%";
  }

  /**
   * RENDER DANH SÁCH RADAR CẢNH BÁO TÀI CHÍNH
   */
  function renderAlertsList(alerts) {
    var container = document.getElementById("pl-alerts-box");
    if (!container) return;

    if (!alerts || alerts.length === 0) {
      container.innerHTML = "";
      return;
    }

    var html = "";
    alerts.forEach(function(a) {
      var isDanger = (a.type === "DANGER" || a.type === "CRITICAL");
      var isWarning = (a.type === "WARNING");
      
      var borderClass = isDanger ? "border-rose-500/50 bg-rose-500/10 text-rose-300" 
                      : (isWarning ? "border-amber-500/50 bg-amber-500/10 text-amber-300" 
                      : "border-emerald-500/50 bg-emerald-500/10 text-emerald-300");
      var iconClass = isDanger ? "fa-triangle-exclamation text-rose-400" 
                    : (isWarning ? "fa-circle-exclamation text-amber-400" 
                    : "fa-shield-check text-emerald-400");

      html += `
        <div class="p-3 rounded-2xl border ${borderClass} flex items-start gap-2.5 shadow-sm text-xs">
          <i class="fa-solid ${iconClass} text-sm mt-0.5 shrink-0"></i>
          <div class="space-y-0.5 min-w-0">
            <strong class="font-black tracking-wide block">${a.title}</strong>
            <p class="text-[11px] opacity-90 leading-relaxed">${a.message}</p>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  /**
   * RENDER BẢNG ĐỐI SOÁT CÔNG NỢ TẠM SHIPPER TẠI BẾP
   */
  function renderShipperLedgerTable(ledger, config) {
    var tbody = document.getElementById("tbl-shipper-body");
    var debtBadge = document.getElementById("disp-total-debt-badge");
    if (!tbody) return;

    if (!ledger || ledger.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" class="p-6 text-center text-slate-500 font-sans">
            Không phát sinh giao dịch nhận món nào trong khoảng thời gian này.
          </td>
        </tr>
      `;
      if (debtBadge) debtBadge.innerText = "Tổng Nợ Tồn: 0 đ";
      return;
    }

    var maxDebtCap = config.maxCodHoldingPerShipper || 300000;
    var totalOutstandingDebt = 0;
    var html = "";

    ledger.forEach(function(item) {
      var netHolding = Number(item.netCashHolding) || 0;
      totalOutstandingDebt += netHolding;

      var isExceeded = (netHolding > maxDebtCap);
      var debtColorClass = isExceeded ? "text-rose-400 font-black" : (netHolding > 0 ? "text-amber-400 font-bold" : "text-emerald-400");

      html += `
        <tr class="hover:bg-slate-800/40 transition">
          <td class="p-2.5 font-sans font-bold text-white flex items-center gap-2">
            <div class="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-[10px] text-amber-400">
              <i class="fa-solid fa-motorcycle"></i>
            </div>
            <span>${item.shipperLabel}</span>
          </td>
          <td class="p-2.5 text-center text-slate-300">${item.completedOrders} đơn</td>
          <td class="p-2.5 text-right text-emerald-400">${formatMoneyVnd(item.totalCashCollected)}</td>
          <td class="p-2.5 text-right text-slate-300">${formatMoneyVnd(item.totalShipFeeEarned)}</td>
          <td class="p-2.5 text-right ${debtColorClass}">
            ${formatMoneyVnd(netHolding)}
            ${isExceeded ? '<span class="text-[9px] block text-rose-400 uppercase font-sans">Vượt Trần!</span>' : ''}
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
    if (debtBadge) {
      debtBadge.innerText = "Tổng Nợ Tồn: " + formatMoneyVnd(totalOutstandingDebt);
      if (totalOutstandingDebt > 0) {
        debtBadge.className = "px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30";
      } else {
        debtBadge.className = "px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30";
      }
    }
  }

  /**
   * DỮ LIỆU MẪU DỰ PHÒNG AN TOÀN KHI MẤT MẠNG TẠM THỜI
   */
  function renderFallbackData() {
    renderFinancialData({
      kpiSummary: {
        totalCompletedOrders: 0,
        grossFoodSales: 0,
        shippingCollected: 0,
        shippingSubsidySpent: 0,
        netRevenue: 0,
        totalCogs: 0,
        grossProfit: 0,
        grossMarginPercent: 0,
        netProfit: 0,
        netMarginPercent: 0,
        cashInBankOnline: 0,
        cashHoldingCod: 0,
        averageOrderValue: 0,
        avgFoodCostPercent: 0
      },
      config: {
        taxRateHkd: 0.045,
        masterFeeRate: 0.02,
        maxCodHoldingPerShipper: 300000
      },
      cogsDetails: {},
      shipperLedger: [],
      alerts: [{
        type: "SUCCESS",
        code: "SYSTEM_READY",
        title: "Hệ Thống Sẵn Sàng Kết Nối",
        message: "Chưa ghi nhận dữ liệu doanh thu mới trong mốc thời gian này. Mời chọn khoảng thời gian khác để xem đối soát."
      }]
    });
  }

  // TỰ ĐỘNG KHỞI CHẠY LẤY DỮ LIỆU HÔM NAY KHI NẠP COMPONENT
  setTimeout(function() {
    setQuickFilter("today", null);
  }, 100);

  // PUBLIC API RA NGOÀI
  return {
    setQuickFilter: setQuickFilter,
    loadPlData: loadPlData
  };
})();
</script>

/**
 * =========================================================================
 * MODULE: TAB MENU & OMNI-INGESTION PIPELINE (v3.0 SAAS ENTERPRISE)
 * Tác giả: Đu Đủ - Cố vấn Chiến lược & Kỹ sư Trưởng hệ thống SaaS
 * Bản quyền: Bếp Thím 5 & LongHoaFood Master (Năm 2026)
 * Tệp tin: tab-menu.js (Thuần JavaScript 100% - Cứu hộ hiển thị & Auto-Mount)
 * =========================================================================
 */
window.TabMenuController = (function() {
  'use strict';

  var rawMenuList = [];
  var dynamicCategories = [];
  var currentCategoryFilter = "ALL";
  var searchKeyword = "";
  var stagedIngestItems = [];
  var isLoading = false;
  var DEFAULT_PLATFORM_FEE_RATE = 0.20; // 20% chiết khấu sàn mặc định
  var initRetryCount = 0;

  /**
   * KHỞI CHẠY TẢI THỰC ĐƠN VÀ DANH MỤC VỚI CƠ CHẾ CHỜ DOM (AUTO-MOUNT)
   */
  async function init() {
    // 1. Kiểm tra xem DOM của tab-menu.html đã được nhúng vào admin-shell chưa
    var tableBody = document.getElementById("menu-table-body");
    var tabContainer = document.getElementById("category-filter-tabs");
    
    if ((!tableBody || !tabContainer) && initRetryCount < 10) {
      initRetryCount++;
      setTimeout(init, 60);
      return;
    }

    showTableLoading(true);

    try {
      if (!window.Thim5API || typeof window.Thim5API.callGAS !== "function") {
        throw new Error("Chưa kết nối Thim5API adapter!");
      }

      var actionCatalog = (window.T5_DICT && window.T5_DICT.ACTIONS && window.T5_DICT.ACTIONS.GET_ADMIN_MENU_CATALOG)
                          ? window.T5_DICT.ACTIONS.GET_ADMIN_MENU_CATALOG
                          : "getAdminMenuCatalog";

      var actionCats = (window.T5_DICT && window.T5_DICT.ACTIONS && window.T5_DICT.ACTIONS.GET_MENU_CATEGORIES)
                       ? window.T5_DICT.ACTIONS.GET_MENU_CATEGORIES
                       : "getMenuCategories";

      var results = await Promise.allSettled([
        window.Thim5API.callGAS(actionCatalog, {}),
        window.Thim5API.callGAS(actionCats, {})
      ]);

      var menuRes = results[0].status === "fulfilled" ? results[0].value : null;
      var catRes = results[1].status === "fulfilled" ? results[1].value : null;

      // 2. BÓC TÁCH DỮ LIỆU ĐA TẦNG (MULTI-LAYER EXTRACTION) CHỐNG MẤT MÓN
      rawMenuList = extractDishesFromResponse(menuRes);

      // 3. Bóc tách danh mục từ phản hồi catalog hoặc API danh mục
      dynamicCategories = extractCategoriesFromResponse(menuRes, catRes);

    } catch (err) {
      console.warn("⚠️ [TabMenu] Lỗi nạp dữ liệu từ máy chủ, kích hoạt danh mục chuẩn SSOT:", err);
      rawMenuList = [];
    } finally {
      showTableLoading(false);
      ensureToppingCategoryExists();
      renderAll();
    }
  }

  /**
   * CỖ MÁY BÓC TÁCH DANH SÁCH MÓN ĂN VƯỢT MỌI CẤU TRÚC PHẢN HỒI
   * @param {Object|Array} res - Phản hồi từ backend
   * @returns {Array} Mảng các món ăn chuẩn hóa
   */
  function extractDishesFromResponse(res) {
    if (!res) return [];

    // Trường hợp 1: Phản hồi chuẩn bọc trong res.data.items
    if (res.data && Array.isArray(res.data.items)) {
      return res.data.items;
    }

    // Trường hợp 2: res.data trực tiếp là một mảng
    if (res.data && Array.isArray(res.data)) {
      return res.data;
    }

    // Trường hợp 3: api.js đã unwrap và đưa về res.items
    if (Array.isArray(res.items)) {
      return res.items;
    }

    // Trường hợp 4: res chính là mảng món ăn
    if (Array.isArray(res)) {
      return res;
    }

    return [];
  }

  /**
   * CỖ MÁY BÓC TÁCH DANH MỤC TỪ CÁC NGUỒN PHẢN HỒI
   */
  function extractCategoriesFromResponse(menuRes, catRes) {
    // Ưu tiên 1: Đọc từ API danh mục chuyên trách
    if (catRes && catRes.status === "success" && Array.isArray(catRes.data) && catRes.data.length > 0) {
      return catRes.data;
    }

    // Ưu tiên 2: Đọc từ trường categories gộp trong menuRes
    if (menuRes && menuRes.data && Array.isArray(menuRes.data.categories) && menuRes.data.categories.length > 0) {
      return menuRes.data.categories;
    }

    return [];
  }

  /**
   * BẢO ĐẢM DANH MỤC TOPPING LUÔN TỒN TẠI TRONG CƠ SỞ DỮ LIỆU
   */
  function ensureToppingCategoryExists() {
    if (!Array.isArray(dynamicCategories) || dynamicCategories.length === 0) {
      dynamicCategories = [
        { code: "CAT_COM", icon: "🍛", name: "Món Cơm", slug: "com", maxFcPercent: 45 },
        { code: "CAT_MI", icon: "🍜", name: "Mì Chủ Lực", slug: "kho", maxFcPercent: 40 },
        { code: "CAT_COMBO", icon: "🍱", name: "Combo Độc Quyền", slug: "combo", maxFcPercent: 35 },
        { code: "CAT_SOUP", icon: "🥣", name: "Súp Booster", slug: "nuoc", maxFcPercent: 30 },
        { code: "CAT_DRINK", icon: "🥤", name: "Nước 1L", slug: "giai-khat", maxFcPercent: 20 },
        { code: "CAT_TOPPING", icon: "🍳", name: "Topping / Ăn Kèm", slug: "an-kem", maxFcPercent: 25 },
        { code: "CAT_EXTEND", icon: "🍗", name: "Món Mở Rộng", slug: "mo-rong", maxFcPercent: 40 }
      ];
      return;
    }

    var hasTopping = dynamicCategories.some(function(c) {
      var slug = String(c.slug || "").toLowerCase();
      var code = String(c.code || "").toUpperCase();
      var name = String(c.name || "").toLowerCase();
      return slug === "an-kem" || slug === "topping" || code === "CAT_TOPPING" || name.includes("topping");
    });

    if (!hasTopping) {
      dynamicCategories.push({
        code: "CAT_TOPPING",
        icon: "🍳",
        name: "Topping / Ăn Kèm",
        slug: "an-kem",
        maxFcPercent: 25
      });
    }
  }

  function showTableLoading(isLoadingState) {
    isLoading = isLoadingState;
    var loadingRow = document.getElementById("menu-loading-row");
    var emptyRow = document.getElementById("menu-empty-row");
    if (loadingRow) {
      if (isLoadingState) {
        loadingRow.classList.remove("hidden");
        if (emptyRow) emptyRow.classList.add("hidden");
      } else {
        loadingRow.classList.add("hidden");
      }
    }
  }

  function renderAll() {
    renderKpiMetrics(rawMenuList);
    renderCategoryTabs();
    renderCategoryDropdownOptions();
    applyFiltersAndRender();
  }

  /**
   * VẼ THANH TAB BỘ LỌC DANH MỤC ĐỘNG 100% (TỰ ĐỘNG SINH TAB TOPPING)
   */
  function renderCategoryTabs() {
    var container = document.getElementById("category-filter-tabs");
    if (!container) return;

    var totalAll = rawMenuList.length;
    var htmlBuffer = `
      <button type="button" 
              onclick="window.TabMenuController.filterByCategory('ALL', this)" 
              class="cat-filter-tab-btn ${currentCategoryFilter === 'ALL' ? 'active bg-amber-500 text-slate-950 font-black' : 'bg-slate-950 text-slate-300 font-bold border border-slate-800'} px-4 py-2 rounded-2xl text-xs transition shadow flex items-center gap-1.5 shrink-0 active:scale-95">
        <span>Tất Cả</span>
        <span id="badge-total-all" class="text-[10px] font-mono px-1.5 py-0.5 rounded-full ${currentCategoryFilter === 'ALL' ? 'bg-slate-950 text-white' : 'bg-slate-800 text-amber-400'} font-bold">${totalAll}</span>
      </button>
    `;

    dynamicCategories.forEach(function(cat) {
      var slug = String(cat.slug || cat.code || "").trim();
      var icon = cat.icon || "🍽️";
      var name = cat.name || "Danh mục";
      var isActive = (currentCategoryFilter.toLowerCase() === slug.toLowerCase());

      // Đếm số lượng món thuộc danh mục này
      var itemCount = rawMenuList.filter(function(item) {
        var itemCat = String(item.category || item.categorySlug || "").toLowerCase();
        var itemCode = String(item.category || "").toUpperCase();
        var filterSlug = slug.toLowerCase();
        
        return (itemCat === filterSlug) || 
               (itemCode === String(cat.code || "").toUpperCase()) ||
               (filterSlug === "an-kem" && (itemCat.includes("topping") || itemCat.includes("ăn kèm") || itemCat.includes("an-kem")));
      }).length;

      var btnClass = isActive 
        ? "active bg-amber-500 text-slate-950 font-black shadow" 
        : "bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 font-bold";

      var badgeClass = isActive 
        ? "bg-slate-950 text-white" 
        : "bg-slate-800 text-amber-400";

      htmlBuffer += `
        <button type="button" 
                onclick="window.TabMenuController.filterByCategory('${slug}', this)" 
                class="cat-filter-tab-btn ${btnClass} px-3.5 py-2 rounded-2xl text-xs transition flex items-center gap-1.5 shrink-0 active:scale-95">
          <span>${icon} ${name}</span>
          <span class="text-[10px] font-mono px-1.5 py-0.5 rounded-full ${badgeClass} font-bold">${itemCount}</span>
        </button>
      `;
    });

    container.innerHTML = htmlBuffer;
  }

  /**
   * ĐIỀU PHỐI ĐỔ DỮ LIỆU DANH MỤC ĐỘNG VÀO DROPDOWN THÊM/SỬA MÓN
   */
  function renderCategoryDropdownOptions(selectedVal) {
    var selectEl = document.getElementById("dish-category");
    if (!selectEl) return;

    var currentVal = selectedVal || selectEl.value || "com";
    selectEl.innerHTML = "";

    dynamicCategories.forEach(function(cat) {
      var opt = document.createElement("option");
      opt.value = String(cat.slug || cat.code || "").toLowerCase();
      opt.textContent = (cat.icon ? cat.icon + " " : "") + cat.name;
      if (opt.value === String(currentVal).toLowerCase()) {
        opt.selected = true;
      }
      selectEl.appendChild(opt);
    });
  }

  /**
   * BỘ LỌC DANH MỤC KHI BẤM NÚT TAB
   */
  function filterByCategory(slug, btnEl) {
    currentCategoryFilter = slug;
    renderCategoryTabs();
    applyFiltersAndRender();
  }
  /**
   * LỌC DỮ LIỆU MÓN ĂN & CẬP NHẬT GIAO DIỆN BẢNG MA TRẬN REVERSE-PRICING
   */
  function applyFiltersAndRender() {
    var query = String(searchKeyword || "").trim().toLowerCase();

    filteredMenuList = rawMenuList.filter(function(item) {
      if (!item) return false;

      // 1. Lọc theo danh mục đã chọn trên thanh Tab
      var matchCat = false;
      if (currentCategoryFilter === "ALL") {
        matchCat = true;
      } else {
        var itemCatSlug = String(item.category || item.categorySlug || "").toLowerCase();
        var filterSlug = String(currentCategoryFilter).toLowerCase();
        
        // Khớp trực tiếp mã slug hoặc mã code danh mục
        matchCat = (itemCatSlug === filterSlug) || 
                   (itemCatSlug.includes(filterSlug)) ||
                   (filterSlug === "an-kem" && (itemCatSlug.includes("topping") || itemCatSlug.includes("ăn kèm") || itemCatSlug.includes("an-kem")));
      }

      // 2. Lọc theo từ khóa tìm kiếm
      var matchQuery = true;
      if (query) {
        var itemName = String(item.name || "").toLowerCase();
        var itemCode = String(item.code || "").toLowerCase();
        var itemCat = String(item.category || item.categorySlug || "").toLowerCase();
        matchQuery = itemName.includes(query) || itemCode.includes(query) || itemCat.includes(query);
      }

      return matchCat && matchQuery;
    });

    renderMenuTable(filteredMenuList);
    updateKpiMetrics(rawMenuList);
  }

  /**
   * RENDER DỮ LIỆU VÀO BẢNG CHÍNH CHUẨN REVERSE-PRICING 13 CỘT
   */
  function renderMenuTable(items) {
    var tbody = document.getElementById("menu-table-body");
    var emptyRow = document.getElementById("menu-empty-row");
    if (!tbody) return;

    var oldRows = tbody.querySelectorAll(".menu-data-row");
    oldRows.forEach(function(r) { r.remove(); });

    if (!items || items.length === 0) {
      if (emptyRow) emptyRow.classList.remove("hidden");
      return;
    }

    if (emptyRow) emptyRow.classList.add("hidden");

    var htmlBuffer = "";
    items.forEach(function(item) {
      var appPrice = Number(item.appPrice || item.priceApp || 0);
      var discountPercent = (item.discountPercent !== undefined && item.discountPercent !== null && item.discountPercent !== "") 
                            ? Number(item.discountPercent) 
                            : (DEFAULT_PLATFORM_FEE_RATE * 100);
      var d2cPrice = Number(item.d2cPrice || item.priceD2c || item.price || 0);
      var cogs = Number(item.cogs || item.cost || 0);
      var netProfit = Number(item.netProfit || 0);

      // Tự động tính toán Reverse-Pricing nếu thiếu giá
      if (d2cPrice === 0 && appPrice > 0) {
        if (window.T5_DICT && typeof window.T5_DICT.calculateReversePricing === "function") {
          var pCalc = window.T5_DICT.calculateReversePricing(appPrice, cogs, discountPercent, 15);
          d2cPrice = pCalc.d2cPrice;
          netProfit = pCalc.netProfit;
        } else {
          d2cPrice = Math.round((appPrice * (1 - (discountPercent / 100))) / 1000) * 1000;
          netProfit = Math.max(0, d2cPrice - cogs - Math.round(d2cPrice * 0.15));
        }
      }

      var foodCostRate = d2cPrice > 0 ? (cogs / d2cPrice) * 100 : 0;
      var fcColorClass = "text-emerald-400 bg-emerald-500/10 border-emerald-500/30";
      if (foodCostRate > 45) {
        fcColorClass = "text-rose-400 bg-rose-500/10 border-rose-500/30 animate-pulse font-black";
      } else if (foodCostRate > 38) {
        fcColorClass = "text-amber-400 bg-amber-500/10 border-amber-500/30 font-bold";
      }

      var isOutOfStock = (String(item.status || "").toUpperCase() === "OUT_OF_STOCK");
      var statusBadge = isOutOfStock
        ? '<button type="button" onclick="window.TabMenuController.toggleItemStock(\'' + item.code + '\', \'ACTIVE\')" class="px-2.5 py-1 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 font-bold transition active:scale-95 text-[11px]">🔴 Hết Hàng</button>'
        : '<button type="button" onclick="window.TabMenuController.toggleItemStock(\'' + item.code + '\', \'OUT_OF_STOCK\')" class="px-2.5 py-1 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold transition active:scale-95 text-[11px]">🟢 Còn Bán</button>';

      var imgUrl = item.imageUrl || item.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=100';
      var crossSell = item.crossSellSuggest || item.crossSell || '--';

      var rowHtml = `
        <tr class="menu-data-row hover:bg-slate-800/40 transition">
          <td class="py-2.5 px-3.5 flex items-center gap-2.5">
            <div class="w-10 h-10 rounded-2xl bg-slate-950 border border-slate-800 overflow-hidden flex-shrink-0">
              <img src="${imgUrl}" alt="${item.name || 'Món'}" class="w-full h-full object-cover" onerror="this.src='https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=100'" />
            </div>
            <div class="space-y-0.5 overflow-hidden">
              <div class="flex items-center gap-1.5">
                <span class="font-mono text-[10px] font-bold text-amber-400">${item.code}</span>
                <span class="px-1.5 py-0.2 rounded text-[9px] font-mono bg-slate-800 text-slate-400 border border-slate-700">${item.tag || 'CORE'}</span>
              </div>
              <h4 class="font-bold text-white text-xs leading-tight truncate max-w-[190px]" title="${item.name}">${item.name}</h4>
            </div>
          </td>
          <td class="py-2.5 px-3 text-center text-slate-300 font-medium text-[11px]">${item.category || item.categorySlug || 'Món Cơm'}</td>
          <td class="py-2.5 px-3 text-right font-mono text-rose-400 text-xs font-bold">${cogs.toLocaleString('vi-VN')} đ</td>
          <td class="py-2.5 px-3 text-right font-mono font-black text-emerald-400 text-xs">+${netProfit.toLocaleString('vi-VN')} đ</td>
          <td class="py-2.5 px-3 text-right font-mono font-black text-amber-400 text-xs">${d2cPrice.toLocaleString('vi-VN')} đ</td>
          <td class="py-2.5 px-3 text-right font-mono text-slate-400 text-xs">${appPrice.toLocaleString('vi-VN')} đ</td>
          <td class="py-2.5 px-3 text-center">
            <span class="px-2 py-0.5 rounded-lg font-mono text-[10.5px] border ${fcColorClass}">
              ${foodCostRate.toFixed(1)}%
            </span>
          </td>
          <td class="py-2.5 px-3 text-center font-mono text-slate-400 text-[11px]">${crossSell}</td>
          <td class="py-2.5 px-3 text-center">${statusBadge}</td>
          <td class="py-2.5 px-3.5 text-center">
            <div class="flex items-center justify-center gap-1">
              <button type="button" onclick="window.TabMenuController.openDishModal('${item.code}')" class="p-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition active:scale-95" title="Chỉnh sửa món">
                <i class="fa-solid fa-pen-to-square text-[11px]"></i>
              </button>
              <button type="button" onclick="window.TabMenuController.deleteDishItem('${item.code}')" class="p-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition active:scale-95" title="Xóa món">
                <i class="fa-solid fa-trash text-[11px]"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
      htmlBuffer += rowHtml;
    });

    tbody.insertAdjacentHTML("beforeend", htmlBuffer);
  }

  /**
   * CẬP NHẬT 4 KPI VẬN HÀNH BẾP & FOOD COST
   */
  function updateKpiMetrics(items) {
    var total = items.length;
    var activeCount = 0;
    var boosterCount = 0;
    var totalCogs = 0;
    var totalPrice = 0;

    items.forEach(function(i) {
      if (String(i.status || "").toUpperCase() !== "OUT_OF_STOCK") activeCount++;
      var c = String(i.category || i.categorySlug || "").toLowerCase();
      var tag = String(i.tag || "").toUpperCase();
      if (c.includes("súp") || c.includes("uống") || c.includes("nước") || c.includes("topping") || c.includes("an-kem") || tag === "BOOSTER") {
        boosterCount++;
      }
      var p = Number(i.d2cPrice || i.priceD2c || i.price || 0);
      var cg = Number(i.cogs || i.cost || 0);
      if (p > 0) {
        totalPrice += p;
        totalCogs += cg;
      }
    });

    var avgFc = totalPrice > 0 ? (totalCogs / totalPrice) * 100 : 0;

    var elActive = document.getElementById("kpi-active-items");
    var elTotal = document.getElementById("kpi-total-items");
    var elFc = document.getElementById("kpi-avg-foodcost");
    var elBooster = document.getElementById("kpi-booster-count");

    if (elActive) elActive.innerText = activeCount;
    if (elTotal) elTotal.innerText = "/ " + total + " món";
    if (elFc) elFc.innerText = avgFc.toFixed(1) + "%";
    if (elBooster) elBooster.innerText = boosterCount;
  }

  function handleSearch(val) {
    searchKeyword = String(val || "").trim();
    applyFiltersAndRender();
  }

  /**
   * BẬT / TẮT TRẠNG THÁI CÒN HÀNG <-> HẾT HÀNG TRỰC TIẾP TRÊN BẢNG
   */
  async function toggleItemStock(code, newStatus) {
    var target = rawMenuList.find(function(x) { return x.code === code; });
    if (!target) return;

    var prevStatus = target.status;
    target.status = newStatus;
    applyFiltersAndRender();

    try {
      if (!window.Thim5API || typeof window.Thim5API.callGAS !== "function") {
        throw new Error("Không tìm thấy kết nối Thim5API!");
      }

      var actionName = (window.T5_DICT && window.T5_DICT.ACTIONS && window.T5_DICT.ACTIONS.TOGGLE_MENU_ITEM_STATUS)
                       ? window.T5_DICT.ACTIONS.TOGGLE_MENU_ITEM_STATUS
                       : "toggleMenuItemStatus";

      var res = await window.Thim5API.callGAS(actionName, { itemCode: code, status: newStatus });
      if (!res || res.status !== "success") {
        throw new Error((res && res.message) ? res.message : "Lỗi cập nhật máy chủ");
      }
    } catch (e) {
      alert("❌ Không thể đồng bộ trạng thái món lên Google Sheets: " + e.message);
      target.status = prevStatus;
      applyFiltersAndRender();
    }
  }

  /**
   * CỖ MÁY REVERSE-PRICING 2 CHIỀU & BẢO VỆ BIÊN LỢI NHUẬN MARGIN GUARD
   * @param {string} triggerSource - 'APP' | 'D2C' | 'COGS'
   */
  function calculateMarginGuard(triggerSource) {
    var cogsInput = document.getElementById("dish-cogs");
    var priceInput = document.getElementById("dish-price");
    var profitInput = document.getElementById("dish-profit");
    var appPriceInput = document.getElementById("dish-app-price");

    if (!cogsInput || !priceInput || !appPriceInput) return;

    var cogs = Number(cogsInput.value) || 0;
    var d2cPrice = Number(priceInput.value) || 0;
    var appPrice = Number(appPriceInput.value) || 0;

    // Chiều 1: Nhập Giá App Sàn -> Tự động tính Giá Web D2C
    if (triggerSource === "APP" && appPrice > 0) {
      d2cPrice = Math.round((appPrice * (1 - DEFAULT_PLATFORM_FEE_RATE)) / 1000) * 1000;
      priceInput.value = d2cPrice;
    } 
    // Chiều 2: Nhập Giá Bán Web D2C -> Tự động đội Giá App Sàn
    else if (triggerSource === "D2C" && d2cPrice > 0) {
      appPrice = Math.round((d2cPrice / (1 - DEFAULT_PLATFORM_FEE_RATE)) / 1000) * 1000;
      appPriceInput.value = appPrice;
    }

    var profit = Math.max(0, d2cPrice - cogs);
    var fcPercent = d2cPrice > 0 ? (cogs / d2cPrice) * 100 : 0;

    if (profitInput) {
      profitInput.value = profit.toLocaleString("vi-VN") + " đ";
    }

    var badge = document.getElementById("dish-margin-badge");
    var percentTxt = document.getElementById("dish-foodcost-percent");
    var adviceTxt = document.getElementById("dish-foodcost-advice");
    var bar = document.getElementById("dish-foodcost-bar");

    if (percentTxt) percentTxt.innerText = fcPercent.toFixed(1) + "%";
    if (bar) bar.style.width = Math.min(100, fcPercent) + "%";

    if (fcPercent > 45) {
      if (badge) {
        badge.className = "px-2 py-0.5 rounded-lg text-[9.5px] font-mono font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30 animate-pulse";
        badge.innerText = "Cảnh Báo Thâm Hụt Lợi Nhuận!";
      }
      if (adviceTxt) {
        adviceTxt.innerText = "Food Cost quá cao (>45%)! Cần tăng giá bán hoặc giảm định lượng.";
        adviceTxt.className = "text-rose-400 font-bold";
      }
      if (bar) bar.className = "h-full bg-rose-500 transition-all duration-300";
    } else if (fcPercent > 38) {
      if (badge) {
        badge.className = "px-2 py-0.5 rounded-lg text-[9.5px] font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30";
        badge.innerText = "Tiệm Cận Ngưỡng Trần (38-45%)";
      }
      if (adviceTxt) {
        adviceTxt.innerText = "Biên lợi nhuận ở mức chấp nhận được cho món chủ lực.";
        adviceTxt.className = "text-amber-400 font-medium";
      }
      if (bar) bar.className = "h-full bg-amber-500 transition-all duration-300";
    } else {
      if (badge) {
        badge.className = "px-2 py-0.5 rounded-lg text-[9.5px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30";
        badge.innerText = "Food Cost An Toàn (<38%)";
      }
      if (adviceTxt) {
        adviceTxt.innerText = "Biên lợi nhuận tối ưu, bảo vệ dòng tiền an toàn.";
        adviceTxt.className = "text-emerald-400 font-bold";
      }
      if (bar) bar.className = "h-full bg-emerald-500 transition-all duration-300";
    }
  }

  /**
   * NÉN ẢNH CANVAS CLIENT-SIDE VỀ ĐỊNH DẠNG WEBP (< 150KB)
   */
  async function compressImageWithCanvas(file, maxWidth, quality) {
    return new Promise(function(resolve, reject) {
      var reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = function(event) {
        var img = new Image();
        img.src = event.target.result;
        img.onload = function() {
          var canvas = document.createElement("canvas");
          var targetWidth = img.width;
          var targetHeight = img.height;

          if (targetWidth > maxWidth) {
            targetHeight = Math.round((targetHeight * maxWidth) / targetWidth);
            targetWidth = maxWidth;
          }

          canvas.width = targetWidth;
          canvas.height = targetHeight;
          var ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

          var base64 = canvas.toDataURL("image/webp", quality || 0.8);
          resolve(base64);
        };
        img.onerror = reject;
      };
      reader.onerror = reject;
    });
  }

  /**
   * NÉN ẢNH CANVAS & TẢI LÊN GOOGLE DRIVE CDN DIRECT LINK
   */
  async function handleSingleImageUpload(input) {
    var file = input.files[0];
    if (!file) return;

    var itemCode = (document.getElementById("dish-code") ? document.getElementById("dish-code").value : "").trim() || "ITEM";

    try {
      var compressedBase64 = await compressImageWithCanvas(file, 800, 0.8);

      if (window.Thim5API && typeof window.Thim5API.callGAS === "function") {
        var actionUpload = (window.T5_DICT && window.T5_DICT.ACTIONS && window.T5_DICT.ACTIONS.UPLOAD_DISH_MEDIA_IMAGE)
                           ? window.T5_DICT.ACTIONS.UPLOAD_DISH_MEDIA_IMAGE
                           : "uploadDishMediaImage";

        var res = await window.Thim5API.callGAS(actionUpload, {
          base64Data: compressedBase64,
          fileName: itemCode + "_" + Date.now() + ".webp",
          itemCode: itemCode
        });

        if (res && res.status === "success" && res.data && res.data.directCdnUrl) {
          document.getElementById("dish-image").value = res.data.directCdnUrl;
          alert("📸 Đã nén ảnh WebP và tải lên Google Drive CDN thành công!");
          return;
        }
      }

      // Fallback nếu chưa kết nối Drive: Lưu link ảnh demo
      document.getElementById("dish-image").value = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400";
      alert("📸 Đã nén ảnh thành công qua Canvas!");

    } catch (err) {
      alert("❌ Lỗi nén ảnh Canvas: " + err.message);
    }
  }
  /**
   * MODAL THÊM / CHỈNH SỬA MÓN ĂN & TOPPING
   */
  function openDishModal(editCode) {
    var modal = document.getElementById("modal-single-dish");
    var title = document.getElementById("modal-dish-title");
    var isEditInput = document.getElementById("dish-is-edit");

    if (editCode) {
      var item = rawMenuList.find(function(x) { return x.code === editCode; });
      if (!item) return;

      if (title) title.innerText = "Chỉnh Sửa Món: " + item.code;
      if (isEditInput) isEditInput.value = "true";

      var codeInp = document.getElementById("dish-code");
      if (codeInp) {
        codeInp.value = item.code;
        codeInp.readOnly = true;
      }

      var nameInp = document.getElementById("dish-name");
      if (nameInp) nameInp.value = item.name || "";

      renderCategoryDropdownOptions(item.category || item.categorySlug || "com");

      var roleInp = document.getElementById("dish-role");
      if (roleInp) roleInp.value = item.tag || item.role || "CORE";

      var unitInp = document.getElementById("dish-unit");
      if (unitInp) unitInp.value = item.unit || "Phần";

      var cogsInp = document.getElementById("dish-cogs");
      if (cogsInp) cogsInp.value = item.cogs || item.cost || "";

      var priceInp = document.getElementById("dish-price");
      if (priceInp) priceInp.value = item.d2cPrice || item.price || "";

      var appPriceInp = document.getElementById("dish-app-price");
      if (appPriceInp) appPriceInp.value = item.appPrice || item.priceApp || "";

      var imgInp = document.getElementById("dish-image");
      if (imgInp) imgInp.value = item.imageUrl || item.image || "";

      var statusInp = document.getElementById("dish-status");
      if (statusInp) statusInp.value = item.status || "ACTIVE";

      var descInp = document.getElementById("dish-desc");
      if (descInp) descInp.value = item.description || item.desc || "";

      var crossSellInp = document.getElementById("dish-cross-sell");
      if (crossSellInp) crossSellInp.value = item.crossSellSuggest || item.crossSell || "";

      var boosterInp = document.getElementById("dish-booster-soup");
      if (boosterInp) boosterInp.value = item.boosterSoup || "";

      var isDryCheck = document.getElementById("dish-is-dry");
      if (isDryCheck) isDryCheck.checked = Boolean(item.isDry !== false);

    } else {
      if (title) title.innerText = "Thêm Món / Topping Mới";
      if (isEditInput) isEditInput.value = "false";

      var form = document.getElementById("form-single-dish");
      if (form) form.reset();

      renderCategoryDropdownOptions("com");

      var newCodeInp = document.getElementById("dish-code");
      if (newCodeInp) {
        newCodeInp.readOnly = false;
        newCodeInp.value = "ITEM_" + (rawMenuList.length + 1).toString().padStart(2, "0");
      }

      var defaultDryCheck = document.getElementById("dish-is-dry");
      if (defaultDryCheck) defaultDryCheck.checked = true;
    }

    calculateMarginGuard("COGS");

    if (modal) {
      modal.classList.remove("hidden");
      modal.style.display = "flex";
      modal.style.zIndex = "9999";
    }
  }

  function closeDishModal() {
    var modal = document.getElementById("modal-single-dish");
    if (modal) {
      modal.classList.add("hidden");
      modal.style.display = "none";
    }
  }

  /**
   * LƯU MÓN VÀO THỰC ĐƠN GOOGLE SHEETS (CHUẨN 13 CỘT REVERSE-PRICING)
   */
  async function handleSaveDish(e) {
    if (e && typeof e.preventDefault === "function") e.preventDefault();

    var btn = document.getElementById("btn-save-dish-submit");
    var origBtnHtml = btn ? btn.innerHTML : "";
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang Lưu 13 Cột...';
    }

    try {
      var codeVal = (document.getElementById("dish-code") ? document.getElementById("dish-code").value : "").trim().toUpperCase();
      var nameVal = (document.getElementById("dish-name") ? document.getElementById("dish-name").value : "").trim();
      var catVal = document.getElementById("dish-category") ? document.getElementById("dish-category").value : "com";
      var roleVal = document.getElementById("dish-role") ? document.getElementById("dish-role").value : "CORE";
      var unitVal = (document.getElementById("dish-unit") ? document.getElementById("dish-unit").value : "Phần").trim() || "Phần";
      var cogsVal = Number(document.getElementById("dish-cogs") ? document.getElementById("dish-cogs").value : 0) || 0;
      var priceVal = Number(document.getElementById("dish-price") ? document.getElementById("dish-price").value : 0) || 0;
      var appPriceVal = Number(document.getElementById("dish-app-price") ? document.getElementById("dish-app-price").value : 0) || 0;
      var rawImgVal = (document.getElementById("dish-image") ? document.getElementById("dish-image").value : "").trim();
      var statusVal = document.getElementById("dish-status") ? document.getElementById("dish-status").value : "ACTIVE";
      var descVal = (document.getElementById("dish-desc") ? document.getElementById("dish-desc").value : "").trim();
      var crossSellVal = (document.getElementById("dish-cross-sell") ? document.getElementById("dish-cross-sell").value : "").trim().toUpperCase();
      var boosterSoupVal = (document.getElementById("dish-booster-soup") ? document.getElementById("dish-booster-soup").value : "").trim().toUpperCase();
      var isDryVal = document.getElementById("dish-is-dry") ? document.getElementById("dish-is-dry").checked : true;

      if (!nameVal) {
        throw new Error("Vui lòng nhập Tên món ăn!");
      }

      // CHỐNG NGHẼN MẠNG: Nếu ảnh là chuỗi Base64 dài > 500 ký tự -> Thay bằng link ảnh CDN ngắn gọn
      var safeImageUrl = rawImgVal;
      if (rawImgVal.startsWith("data:image") || rawImgVal.length > 500) {
        safeImageUrl = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400";
        if (document.getElementById("dish-image")) {
          document.getElementById("dish-image").value = safeImageUrl;
        }
      }

      var profitVal = Math.max(0, priceVal - cogsVal);
      var discountRateVal = Math.round(DEFAULT_PLATFORM_FEE_RATE * 100);

      var payload = {
        code: codeVal,
        name: nameVal,
        category: catVal,
        role: roleVal,
        tag: roleVal,
        unit: unitVal,
        cogs: cogsVal,
        cost: cogsVal,
        price: priceVal,
        d2cPrice: priceVal,
        appPrice: appPriceVal,
        discountRate: discountRateVal,
        discountPercent: discountRateVal,
        profit: profitVal,
        netProfit: profitVal,
        image: safeImageUrl,
        imageUrl: safeImageUrl,
        status: statusVal,
        description: descVal,
        crossSell: crossSellVal,
        crossSellSuggest: crossSellVal,
        boosterSoup: boosterSoupVal,
        isDry: isDryVal
      };

      if (!window.Thim5API || typeof window.Thim5API.callGAS !== "function") {
        throw new Error("Chưa kết nối Thim5API adapter!");
      }

      var actionSave = (window.T5_DICT && window.T5_DICT.ACTIONS && window.T5_DICT.ACTIONS.SAVE_OR_UPDATE_MENU_ITEM)
                       ? window.T5_DICT.ACTIONS.SAVE_OR_UPDATE_MENU_ITEM
                       : "saveOrUpdateMenuItem";

      var res = await window.Thim5API.callGAS(actionSave, payload);

      if (res && res.status === "success") {
        alert("🎉 Đã lưu thành công món [" + nameVal + "] vào cơ sở dữ liệu!");
        closeDishModal();
        await init();
      } else {
        alert("⛔ Máy chủ phản hồi: " + (res && res.message ? res.message : "Không thể lưu dữ liệu"));
      }
    } catch (err) {
      console.error("Lỗi lưu món:", err);
      alert("❌ " + err.message);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = origBtnHtml || '<i class="fa-solid fa-floppy-disk"></i> Lưu Vào CSDL DATA_MENU';
      }
    }
  }

  /**
   * XÓA MÓN ĂN KHỎI THỰC ĐƠN GOOGLE SHEETS
   */
  async function deleteDishItem(code) {
    if (confirm("Anh Hải Âu có chắc chắn muốn xóa vĩnh viễn món [" + code + "] khỏi cơ sở dữ liệu thực đơn?")) {
      try {
        if (!window.Thim5API || typeof window.Thim5API.callGAS !== "function") {
          throw new Error("Không tìm thấy kết nối Thim5API adapter!");
        }

        var actionDelete = (window.T5_DICT && window.T5_DICT.ACTIONS && window.T5_DICT.ACTIONS.DELETE_MENU_ITEM)
                           ? window.T5_DICT.ACTIONS.DELETE_MENU_ITEM
                           : "deleteMenuItem";

        var res = await window.Thim5API.callGAS(actionDelete, { itemCode: code });
        if (res && res.status === "success") {
          alert("🗑️ Đã xóa món [" + code + "] thành công!");
          await init();
        } else {
          alert("⛔ Lỗi: " + (res && res.message ? res.message : "Máy chủ từ chối xóa món!"));
        }
      } catch (err) {
        alert("❌ Lỗi kết nối xóa món: " + err.message);
      }
    }
  }

  /**
   * QUẢN TRỊ DANH MỤC MODAL (SYS_CATEGORIES)
   */
  function openCategoriesModal() {
    var modal = document.getElementById("modal-tab-categories");
    if (modal) modal.classList.remove("hidden");
    renderCategoryModalList();
  }

  function closeCategoriesModal() {
    var modal = document.getElementById("modal-tab-categories");
    if (modal) modal.classList.add("hidden");
  }

  function renderCategoryModalList() {
    var tbody = document.getElementById("tab-categories-list-tbody");
    if (!tbody) return;

    tbody.innerHTML = dynamicCategories.map(function(c, idx) {
      var icon = c.icon || "🍽️";
      var name = c.name || "Danh mục";
      var slug = c.slug || "";
      return `
        <tr class="hover:bg-slate-900/60 transition">
          <td class="p-2.5 text-center text-base">${icon}</td>
          <td class="p-2.5 text-white font-bold">${name}</td>
          <td class="p-2.5 font-mono text-amber-400">${slug}</td>
          <td class="p-2.5 text-center">
            <button type="button" onclick="window.TabMenuController.deleteCategory(${idx})" class="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30" title="Xóa"><i class="fa-solid fa-trash text-[10px]"></i></button>
          </td>
        </tr>
      `;
    }).join("");
  }

  async function handleSaveCategory(e) {
    if (e && typeof e.preventDefault === "function") e.preventDefault();

    var iconInp = document.getElementById("tab-cat-icon");
    var nameInp = document.getElementById("tab-cat-name");
    var slugInp = document.getElementById("tab-cat-slug");

    var icon = iconInp ? iconInp.value.trim() : "🍽️";
    var name = nameInp ? nameInp.value.trim() : "";
    var slug = slugInp ? slugInp.value.trim() : "";

    if (!name) {
      alert("Vui lòng nhập Tên danh mục!");
      return;
    }

    var newCat = {
      code: "CAT_" + Date.now().toString().slice(-4),
      icon: icon || "🍽️",
      name: name,
      slug: slug || name.toLowerCase(),
      maxFcPercent: 35
    };

    try {
      var actionSaveCat = (window.T5_DICT && window.T5_DICT.ACTIONS && window.T5_DICT.ACTIONS.SAVE_MENU_CATEGORY)
                          ? window.T5_DICT.ACTIONS.SAVE_MENU_CATEGORY
                          : "saveMenuCategory";

      var res = await window.Thim5API.callGAS(actionSaveCat, { category: newCat });
      if (res && res.status === "success") {
        alert("🎉 Đã thêm danh mục [" + name + "] thành công vào Google Sheets!");
        var catForm = document.getElementById("form-tab-category");
        if (catForm) catForm.reset();
        await init();
        renderCategoryModalList();
      } else {
        alert("⛔ Lỗi: " + (res && res.message ? res.message : "Không lưu được danh mục"));
      }
    } catch (err) {
      alert("❌ Lỗi mạng: " + err.message);
    }
  }

  async function deleteCategory(idx) {
    var c = dynamicCategories[idx];
    if (!c) return;

    if (confirm("Anh Hải Âu có chắc muốn xóa danh mục [" + c.name + "]?")) {
      try {
        var actionDelCat = (window.T5_DICT && window.T5_DICT.ACTIONS && window.T5_DICT.ACTIONS.DELETE_MENU_CATEGORY)
                           ? window.T5_DICT.ACTIONS.DELETE_MENU_CATEGORY
                           : "deleteMenuCategory";

        var catId = c.code || c.id || "";
        var res = await window.Thim5API.callGAS(actionDelCat, { categoryId: catId });
        if (res && res.status === "success") {
          alert("🗑️ Đã xóa danh mục thành công!");
          await init();
          renderCategoryModalList();
        } else {
          alert("⛔ Không thể xóa: " + (res && res.message ? res.message : ""));
        }
      } catch (e) {
        alert("❌ Lỗi xóa danh mục: " + e.message);
      }
    }
  }

  /**
   * MODAL OMNI-INGESTION ĐA KÊNH
   */
  function openOmniIngestionModal() {
    var modal = document.getElementById("modal-omni-ingestion");
    if (modal) modal.classList.remove("hidden");
    switchIngestChannel("EXCEL");
  }

  function closeOmniIngestionModal() {
    var modal = document.getElementById("modal-omni-ingestion");
    if (modal) modal.classList.add("hidden");
    clearIngestPreview();
  }

  function switchIngestChannel(channel) {
    var channels = ["excel", "ocr", "link", "json"];
    channels.forEach(function(c) {
      var box = document.getElementById("ingest-box-" + c);
      var btn = document.getElementById("tab-btn-ingest-" + c);
      if (box) box.classList.add("hidden");
      if (btn) btn.className = "flex-1 py-2 rounded-xl transition text-slate-400 hover:text-white";
    });

    var targetBox = document.getElementById("ingest-box-" + channel.toLowerCase());
    var activeBtn = document.getElementById("tab-btn-ingest-" + channel.toLowerCase());
    if (targetBox) targetBox.classList.remove("hidden");
    if (activeBtn) activeBtn.className = "flex-1 py-2 rounded-xl transition bg-amber-500 text-slate-950 font-black shadow";
  }

  function downloadExcelTemplate() {
    if (window.Thim5API && typeof window.Thim5API.getEndpoint === "function") {
      window.open(window.Thim5API.getEndpoint() + "?action=getMenuExcelTemplateStructure", "_blank");
    } else {
      alert("Không tìm thấy đường dẫn máy chủ!");
    }
  }

  function handleExcelFileSelect(input) {
    var file = input.files[0];
    if (!file) return;

    var reader = new FileReader();
    reader.onload = function(e) {
      var data = e.target.result;
      parseCsvOrExcelBuffer(data, file.name);
    };

    if (file.name.endsWith(".csv")) {
      reader.readAsText(file, "UTF-8");
    } else {
      reader.readAsDataURL(file);
    }
  }

  function parseCsvOrExcelBuffer(bufferData, fileName) {
    if (fileName.endsWith(".csv")) {
      var lines = bufferData.split(/\r\n|\n/);
      var items = [];
      for (var i = 1; i < lines.length; i++) {
        var line = lines[i].trim();
        if (!line) continue;
        var parts = line.split(",");
        if (parts.length >= 4) {
          items.push({
            code: parts[0].trim().toUpperCase(),
            name: parts[1].trim(),
            category: parts[2].trim() || "Món Cơm",
            cogs: Number(parts[3]) || 0,
            price: Number(parts[4]) || 0,
            role: parts[5] ? parts[5].trim().toUpperCase() : "CORE"
          });
        }
      }
      displayIngestPreview(items);
    } else {
      sendBufferToBackendParser(bufferData);
    }
  }

  async function sendBufferToBackendParser(base64Data) {
    try {
      var actionParse = (window.T5_DICT && window.T5_DICT.ACTIONS && window.T5_DICT.ACTIONS.PARSE_UPLOADED_SPREADSHEET_BUFFER)
                        ? window.T5_DICT.ACTIONS.PARSE_UPLOADED_SPREADSHEET_BUFFER
                        : "parseUploadedSpreadsheetBuffer";

      var res = await window.Thim5API.callGAS(actionParse, { base64Data: base64Data });
      if (res && res.status === "success" && Array.isArray(res.data)) {
        displayIngestPreview(res.data);
      } else if (res && res.status === "success" && res.data && Array.isArray(res.data.items)) {
        displayIngestPreview(res.data.items);
      } else {
        alert("⛔ Không thể đọc file Excel: " + (res && res.message ? res.message : "Định dạng không khớp!"));
      }
    } catch (err) {
      alert("Lỗi nạp file Excel: " + err.message);
    }
  }

  async function handleOcrImageSelect(input) {
    var file = input.files[0];
    if (!file) return;

    try {
      var compressedBase64 = "";
      if (window.Thim5MediaEngine && typeof window.Thim5MediaEngine.compressImage === "function") {
        var res = await window.Thim5MediaEngine.compressImage(file, 1200, 0.75);
        compressedBase64 = res.base64Data;
      } else {
        compressedBase64 = await new Promise(function(resolve) {
          var r = new FileReader();
          r.onload = function(e) { resolve(e.target.result); };
          r.readAsDataURL(file);
        });
      }
      callGeminiOcrApi(compressedBase64);
    } catch (e) {
      alert("Lỗi đọc ảnh OCR: " + e.message);
    }
  }

  async function callGeminiOcrApi(base64Data) {
    var btn = document.querySelector("#ingest-box-ocr button");
    var origText = btn ? btn.innerHTML : "";
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> AI Đang Quét Thực Đơn...';
    }

    try {
      var actionOcr = (window.T5_DICT && window.T5_DICT.ACTIONS && window.T5_DICT.ACTIONS.PROCESS_MENU_OCR_WITH_GEMINI)
                      ? window.T5_DICT.ACTIONS.PROCESS_MENU_OCR_WITH_GEMINI
                      : "processMenuOcrWithGemini";

      var res = await window.Thim5API.callGAS(actionOcr, { imageBase64: base64Data, base64Data: base64Data });
      if (res && res.status === "success" && Array.isArray(res.data)) {
        displayIngestPreview(res.data);
      } else if (res && res.status === "success" && res.data && Array.isArray(res.data.items)) {
        displayIngestPreview(res.data.items);
      } else {
        alert("⛔ AI không trích xuất được món: " + (res && res.message ? res.message : "Vui lòng chụp rõ hơn!"));
      }
    } catch (err) {
      alert("Lỗi AI OCR: " + err.message);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = origText;
      }
    }
  }

  async function handleParseUrl() {
    var urlInput = document.getElementById("input-public-url");
    var url = urlInput ? urlInput.value.trim() : "";
    if (!url) {
      alert("Vui lòng dán link thực đơn!");
      return;
    }

    try {
      var actionUrl = (window.T5_DICT && window.T5_DICT.ACTIONS && window.T5_DICT.ACTIONS.EXTRACT_MENU_FROM_PUBLIC_URL)
                      ? window.T5_DICT.ACTIONS.EXTRACT_MENU_FROM_PUBLIC_URL
                      : "extractMenuFromPublicUrl";

      var res = await window.Thim5API.callGAS(actionUrl, { url: url });
      if (res && res.status === "success" && Array.isArray(res.data)) {
        displayIngestPreview(res.data);
      } else if (res && res.status === "success" && res.data && Array.isArray(res.data.items)) {
        displayIngestPreview(res.data.items);
      } else {
        alert("⛔ Không thể cào link: " + (res && res.message ? res.message : "Trang web chặn quét!"));
      }
    } catch (e) {
      alert("Lỗi cào URL: " + e.message);
    }
  }

  function handleParseJson() {
    var jsonEl = document.getElementById("input-raw-json");
    var txt = jsonEl ? jsonEl.value.trim() : "";
    if (!txt) return;
    try {
      var parsed = JSON.parse(txt);
      if (Array.isArray(parsed)) {
        displayIngestPreview(parsed);
      } else {
        alert("JSON phải là một danh sách mảng các món ăn!");
      }
    } catch (e) {
      alert("Cú pháp JSON không hợp lệ: " + e.message);
    }
  }

  function displayIngestPreview(items) {
    if (!items || items.length === 0) return;
    stagedIngestItems = items;

    var container = document.getElementById("ingest-preview-container");
    var countEl = document.getElementById("preview-total-count");
    var tbody = document.getElementById("ingest-preview-tbody");

    if (countEl) countEl.innerText = items.length;
    if (tbody) {
      tbody.innerHTML = "";
      items.forEach(function(m, idx) {
        var cogs = Number(m.cogs || m.cost) || 0;
        var price = Number(m.d2cPrice || m.price) || 0;
        var fc = price > 0 ? ((cogs / price) * 100).toFixed(1) + "%" : "0%";

        var tr = `
          <tr class="hover:bg-slate-900">
            <td class="p-2 text-amber-400 font-bold">${m.code || ('M_' + (idx + 1))}</td>
            <td class="p-2 text-white font-medium">${m.name || 'Món mới'}</td>
            <td class="p-2 text-slate-400">${m.category || m.categorySlug || 'Món Cơm'}</td>
            <td class="p-2 text-right text-slate-400">${cogs.toLocaleString('vi-VN')} đ</td>
            <td class="p-2 text-right text-emerald-400 font-bold">${price.toLocaleString('vi-VN')} đ</td>
            <td class="p-2 text-center text-amber-400">${fc}</td>
          </tr>
        `;
        tbody.insertAdjacentHTML("beforeend", tr);
      });
    }

    if (container) container.classList.remove("hidden");
  }

  function clearIngestPreview() {
    stagedIngestItems = [];
    var container = document.getElementById("ingest-preview-container");
    var tbody = document.getElementById("ingest-preview-tbody");
    if (container) container.classList.add("hidden");
    if (tbody) tbody.innerHTML = "";
  }

  async function submitBatchIngest() {
    if (!stagedIngestItems || stagedIngestItems.length === 0) return;

    var btn = document.getElementById("btn-confirm-ingest-all");
    var origText = btn ? btn.innerHTML : "";
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang Nạp ' + stagedIngestItems.length + ' Món...';
    }

    try {
      var actionBatch = (window.T5_DICT && window.T5_DICT.ACTIONS && window.T5_DICT.ACTIONS.BATCH_IMPORT_MENU_ITEMS)
                        ? window.T5_DICT.ACTIONS.BATCH_IMPORT_MENU_ITEMS
                        : "batchImportMenuItems";

      var res = await window.Thim5API.callGAS(actionBatch, { items: stagedIngestItems });
      if (res && res.status === "success") {
        var msg = (res.data && res.data.message) ? res.data.message : "Đã nạp thành công hàng loạt món!";
        alert("🎉 " + msg);
        closeOmniIngestionModal();
        await init();
      } else {
        alert("⛔ Lỗi nạp hàng loạt: " + (res && res.message ? res.message : "Không xác định"));
      }
    } catch (err) {
      alert("Lỗi kết nối nạp hàng loạt: " + err.message);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = origText;
      }
    }
  }

  // TỰ ĐỘNG KHỞI TẠO CONTROLLER KHI SẴN SÀNG
  init();

  return {
    init: init,
    handleSearch: handleSearch,
    filterByCategory: filterByCategory,
    toggleItemStock: toggleItemStock,
    calculateMarginGuard: calculateMarginGuard,
    openDishModal: openDishModal,
    closeDishModal: closeDishModal,
    handleSaveDish: handleSaveDish,
    deleteDishItem: deleteDishItem,
    openCategoriesModal: openCategoriesModal,
    closeCategoriesModal: closeCategoriesModal,
    handleSaveCategory: handleSaveCategory,
    deleteCategory: deleteCategory,
    openOmniIngestionModal: openOmniIngestionModal,
    closeOmniIngestionModal: closeOmniIngestionModal,
    switchIngestChannel: switchIngestChannel,
    downloadExcelTemplate: downloadExcelTemplate,
    handleExcelFileSelect: handleExcelFileSelect,
    handleOcrImageSelect: handleOcrImageSelect,
    handleParseUrl: handleParseUrl,
    handleParseJson: handleParseJson,
    clearIngestPreview: clearIngestPreview,
    submitBatchIngest: submitBatchIngest,
    handleSingleImageUpload: handleSingleImageUpload
  };
})();

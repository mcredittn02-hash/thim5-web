/**
 * =========================================================================
 * MODULE: TAB MENU & OMNI-INGESTION PIPELINE (v3.2 SAAS ENTERPRISE)
 * Tác giả: Đu Đủ - Cố vấn Chiến lược & Kỹ sư Trưởng hệ thống SaaS
 * Bản quyền: Bếp Thím 5 & LongHoaFood Master (Năm 2026)
 * Tệp tin: tab-menu.js (Thuần JavaScript 100% - Cấm thẻ HTML <script> và </div>)
 * Khắc phục triệt để:
 *   1. Xóa bỏ vĩnh viễn logic tự ý đè ảnh Unsplash mặc định.
 *   2. Quy tắc thép: Giá D2C làm gốc bắt buộc > 0 -> Giá App gợi ý +25%.
 *   3. Tải ảnh thật trực tiếp lên Google Drive lấy Direct CDN URL.
 * =========================================================================
 */
window.TabMenuController = (function() {
  'use strict';

  var rawMenuList = [];
  var filteredMenuList = [];
  var currentRoleFilter = "ALL";
  var searchKeyword = "";
  var stagedIngestItems = [];
  var isUploadingMedia = false;

  // STATE QUẢN LÝ DANH MỤC ĐỘNG (DYNAMIC CATEGORY CRUD)
  var dynamicCategories = [
    { id: "CAT_COM", name: "Món Cơm Đất Thánh", icon: "🍛", slug: "Món Cơm" },
    { id: "CAT_MI", name: "Mì Trộn Đặc Sản", icon: "🍜", slug: "Mì Trộn" },
    { id: "CAT_COMBO", name: "Combo Đại Tiệc D2C (99k-149k)", icon: "🍱", slug: "Combo Độc Quyền" },
    { id: "CAT_SOUP", name: "Súp Booster Bán Kèm (12k-18k)", icon: "🥣", slug: "Súp Booster" },
    { id: "CAT_DRINK", name: "Đồ Uống Ly Khổng Lồ 1L", icon: "🥤", slug: "Đồ Uống 1L" },
    { id: "CAT_TOPPING", name: "Topping Thịt & Trứng", icon: "🥓", slug: "Topping Thêm" },
    { id: "CAT_SPECIAL", name: "Đặc Sản Bánh Tráng Phơi Sương", icon: "🌶️", slug: "Đặc Sản Tây Ninh" },
    { id: "CAT_EXTEND", name: "Món Mở Rộng (Gà Ủ Muối / Fastfood)", icon: "🍗", slug: "Món Mở Rộng" }
  ];

  /**
   * KHỞI CHẠY TẢI THỰC ĐƠN VÀ DANH MỤC TỪ MÁY CHỦ GOOGLE APPS SCRIPT
   */
  async function init() {
    showTableLoading(true);
    try {
      if (!window.Thim5API || typeof window.Thim5API.callGAS !== "function") {
        throw new Error("Không tìm thấy kết nối Thim5API adapter!");
      }

      var actionCatalog = (window.T5_DICT && window.T5_DICT.ACTIONS && window.T5_DICT.ACTIONS.GET_ADMIN_MENU_CATALOG)
                          ? window.T5_DICT.ACTIONS.GET_ADMIN_MENU_CATALOG
                          : "getAdminMenuCatalog";

      var actionCats = (window.T5_DICT && window.T5_DICT.ACTIONS && window.T5_DICT.ACTIONS.GET_MENU_CATEGORIES)
                       ? window.T5_DICT.ACTIONS.GET_MENU_CATEGORIES
                       : "getMenuCategories";

      var results = await Promise.allSettled([
        window.Thim5API.callGAS(actionCatalog, { forceRefresh: true }),
        window.Thim5API.callGAS(actionCats, {})
      ]);

      var menuRes = results[0].status === "fulfilled" ? results[0].value : null;
      var catRes = results[1].status === "fulfilled" ? results[1].value : null;

      if (menuRes && menuRes.status === "success" && menuRes.data) {
        if (Array.isArray(menuRes.data.items)) {
          rawMenuList = menuRes.data.items;
        } else if (Array.isArray(menuRes.data)) {
          rawMenuList = menuRes.data;
        } else {
          rawMenuList = [];
        }
      } else if (menuRes && Array.isArray(menuRes)) {
        rawMenuList = menuRes;
      } else {
        rawMenuList = [];
      }

      if (catRes && catRes.status === "success" && Array.isArray(catRes.data) && catRes.data.length > 0) {
        dynamicCategories = catRes.data;
      }

    } catch (err) {
      console.warn("⚠️ Lỗi khởi tạo thực đơn, sử dụng bộ nhớ đệm an toàn:", err);
      rawMenuList = [];
    } finally {
      showTableLoading(false);
      renderCategoryDropdownOptions();
      applyFiltersAndRender();
    }
  }

  function showTableLoading(isLoading) {
    var loadingRow = document.getElementById("menu-loading-row");
    var emptyRow = document.getElementById("menu-empty-row");
    if (loadingRow) {
      if (isLoading) {
        loadingRow.classList.remove("hidden");
        if (emptyRow) emptyRow.classList.add("hidden");
      } else {
        loadingRow.classList.add("hidden");
      }
    }
  }

  /**
   * ĐIỀU PHỐI ĐỔ DỮ LIỆU DANH MỤC ĐỘNG VÀO DROPDOWN THÊM/SỬA MÓN
   */
  function renderCategoryDropdownOptions(selectedVal) {
    var selectEl = document.getElementById("dish-category");
    if (!selectEl) return;

    var currentVal = selectedVal || selectEl.value || "Món Cơm";
    selectEl.innerHTML = "";

    dynamicCategories.forEach(function(cat) {
      var opt = document.createElement("option");
      opt.value = cat.slug || cat.name;
      opt.textContent = (cat.icon ? cat.icon + " " : "") + cat.name;
      if (opt.value === currentVal) {
        opt.selected = true;
      }
      selectEl.appendChild(opt);
    });
  }

  /**
   * LỌC DỮ LIỆU & CẬP NHẬT GIAO DIỆN BẢNG MA TRẬN
   */
  function applyFiltersAndRender() {
    filteredMenuList = rawMenuList.filter(function(item) {
      var itemRole = String(item.role || item.tag || "CORE").toUpperCase();
      var itemCat = String(item.category || "").toLowerCase();
      var matchRole = false;

      if (currentRoleFilter === "ALL") {
        matchRole = true;
      } else if (currentRoleFilter === "CORE") {
        matchRole = (itemRole === "CORE");
      } else if (currentRoleFilter === "RICE") {
        matchRole = (itemCat.includes("cơm") || itemCat.includes("com"));
      } else if (currentRoleFilter === "COMBO") {
        matchRole = (itemRole === "COMBO_EXCLUSIVE" || itemRole === "COMBO");
      } else if (currentRoleFilter === "BOOSTER_SOUP") {
        matchRole = (itemRole === "BOOSTER_SOUP" || itemCat.includes("súp"));
      } else if (currentRoleFilter === "TRAFFIC") {
        matchRole = (itemRole === "TRAFFIC");
      } else if (currentRoleFilter === "DRINKS") {
        matchRole = (itemRole === "DRINKS" || itemCat.includes("uống") || itemCat.includes("nước"));
      } else if (currentRoleFilter === "EXTENDED") {
        matchRole = (itemRole === "EXTENDED" || itemCat.includes("mở rộng") || itemCat.includes("fastfood"));
      } else {
        matchRole = (itemRole === currentRoleFilter);
      }

      var query = searchKeyword.toLowerCase();
      var matchQuery = !query || 
        String(item.name || "").toLowerCase().includes(query) || 
        String(item.code || "").toLowerCase().includes(query) ||
        String(item.category || "").toLowerCase().includes(query);

      return matchRole && matchQuery;
    });

    renderMenuTable(filteredMenuList);
    updateKpiMetrics(rawMenuList);
  }

  /**
   * RENDER DỮ LIỆU HTML VÀO BẢNG CHÍNH CHUẨN REVERSE-PRICING
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
      var price = Number(item.d2cPrice || item.price) || 0;
      var cogs = Number(item.cogs || item.cost) || 0;
      var profit = Math.max(0, price - cogs);
      var appPrice = Number(item.appPrice) || Math.round((price * 1.25) / 1000) * 1000;
      var foodCostRate = price > 0 ? (cogs / price) * 100 : 0;

      var fcColorClass = "text-emerald-400 bg-emerald-500/10 border-emerald-500/30";
      if (foodCostRate > 45) {
        fcColorClass = "text-rose-400 bg-rose-500/10 border-rose-500/30 animate-pulse font-black";
      } else if (foodCostRate > 38) {
        fcColorClass = "text-amber-400 bg-amber-500/10 border-amber-500/30 font-bold";
      }

      var isOutOfStock = (item.status === "OUT_OF_STOCK");
      var statusBadge = isOutOfStock
        ? '<button type="button" onclick="window.TabMenuController.toggleItemStock(\'' + item.code + '\', \'ACTIVE\')" class="px-2.5 py-1 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 font-bold transition active:scale-95 text-[11px]">🔴 Hết Hàng</button>'
        : '<button type="button" onclick="window.TabMenuController.toggleItemStock(\'' + item.code + '\', \'OUT_OF_STOCK\')" class="px-2.5 py-1 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold transition active:scale-95 text-[11px]">🟢 Còn Bán</button>';

      var roleBadge = "";
      var roleStr = String(item.role || item.tag || "CORE").toUpperCase();
      if (roleStr === "TRAFFIC") {
        roleBadge = '<span class="px-1.5 py-0.5 rounded text-[9px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/30">Mồi</span>';
      } else if (roleStr === "BOOSTER" || roleStr === "BOOSTER_SOUP") {
        roleBadge = '<span class="px-1.5 py-0.5 rounded text-[9px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">Kéo Vé</span>';
      } else if (roleStr === "COMBO_EXCLUSIVE" || roleStr === "COMBO") {
        roleBadge = '<span class="px-1.5 py-0.5 rounded text-[9px] font-mono bg-purple-500/10 text-purple-400 border border-purple-500/30">Combo D2C</span>';
      }

      var soupBadge = '<span class="text-slate-500 text-[10px] font-mono">--</span>';
      if (item.isDry || item.boosterSoup || String(item.category).includes("Mì") || String(item.category).includes("Cơm")) {
        var soupName = item.boosterSoup || "Súp Bò Viên/Hoành Thánh";
        soupBadge = '<span class="px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 truncate block max-w-[130px]" title="' + soupName + '">🥣 ' + soupName + '</span>';
      }

      var safeImgUrl = item.imageUrl || item.image || item.img || "";
      var imgThumb = safeImgUrl 
        ? `<img src="${safeImgUrl}" alt="${item.name}" class="w-full h-full object-cover" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🍜</text></svg>'" />`
        : `<div class="w-full h-full flex items-center justify-center text-slate-600 text-xs"><i class="fa-solid fa-image"></i></div>`;

      var rowHtml = `
        <tr class="menu-data-row hover:bg-slate-800/40 transition">
          <td class="py-2.5 px-3.5 flex items-center gap-2.5">
            <div class="w-10 h-10 rounded-2xl bg-slate-950 border border-slate-800 overflow-hidden flex-shrink-0">
              ${imgThumb}
            </div>
            <div class="space-y-0.5 overflow-hidden">
              <div class="flex items-center gap-1.5">
                <span class="font-mono text-[10px] font-bold text-amber-400">${item.code}</span>
                ${roleBadge}
              </div>
              <h4 class="font-bold text-white text-xs leading-tight truncate max-w-[200px]" title="${item.name}">${item.name}</h4>
            </div>
          </td>
          <td class="py-2.5 px-3 text-center text-slate-300 font-medium text-[11px]">${item.category || 'Món Cơm'}</td>
          <td class="py-2.5 px-3 text-right font-mono text-slate-400 text-xs">${cogs.toLocaleString('vi-VN')} đ</td>
          <td class="py-2.5 px-3 text-right font-mono font-bold text-emerald-400 text-xs">+${profit.toLocaleString('vi-VN')} đ</td>
          <td class="py-2.5 px-3 text-right font-mono font-black text-amber-400 text-xs">${price.toLocaleString('vi-VN')} đ</td>
          <td class="py-2.5 px-3 text-right font-mono text-slate-400 text-xs">${appPrice.toLocaleString('vi-VN')} đ</td>
          <td class="py-2.5 px-3 text-center">
            <span class="px-2 py-0.5 rounded-lg font-mono text-[10.5px] border ${fcColorClass}">
              ${foodCostRate.toFixed(1)}%
            </span>
          </td>
          <td class="py-2.5 px-3 text-center">${soupBadge}</td>
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
  function updateKpiMetrics(items) {
    var total = items.length;
    var activeCount = 0;
    var boosterCount = 0;
    var totalCogs = 0;
    var totalPrice = 0;

    items.forEach(function(i) {
      if (i.status !== "OUT_OF_STOCK" && i.status !== "HIDDEN") activeCount++;
      var r = String(i.role || i.tag || "").toUpperCase();
      var c = String(i.category || "").toLowerCase();
      if (r === "BOOSTER" || r === "BOOSTER_SOUP" || c.includes("súp") || c.includes("đồ uống") || c.includes("uống")) {
        boosterCount++;
      }
      var p = Number(i.d2cPrice || i.price) || 0;
      var cg = Number(i.cogs || i.cost) || 0;
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

  function filterRole(role, btnEl) {
    currentRoleFilter = role;
    document.querySelectorAll(".menu-role-btn").forEach(function(b) {
      b.className = "menu-role-btn px-2.5 py-1 rounded-xl text-slate-400 hover:text-white transition";
    });
    if (btnEl) btnEl.className = "menu-role-btn px-2.5 py-1 rounded-xl bg-amber-500 text-slate-950 font-bold shadow";
    applyFiltersAndRender();
  }

  async function toggleItemStock(code, newStatus) {
    var target = rawMenuList.find(function(x) { return x.code === code; });
    if (!target) return;

    var prevStatus = target.status;
    target.status = newStatus;
    applyFiltersAndRender();

    try {
      if (!window.Thim5API || typeof window.Thim5API.callGAS !== "function") {
        throw new Error("Không tìm thấy kết nối Thim5API adapter!");
      }

      var actionToggle = (window.T5_DICT && window.T5_DICT.ACTIONS && window.T5_DICT.ACTIONS.TOGGLE_MENU_ITEM_STATUS)
                         ? window.T5_DICT.ACTIONS.TOGGLE_MENU_ITEM_STATUS
                         : "toggleMenuItemStatus";

      var res = await window.Thim5API.callGAS(actionToggle, { code: code, itemCode: code, status: newStatus });
      if (!res || res.status !== "success") {
        throw new Error((res && res.message) ? res.message : "Lỗi cập nhật trạng thái trên máy chủ");
      }
    } catch (e) {
      alert("❌ Không thể đồng bộ trạng thái món lên hệ thống: " + e.message);
      target.status = prevStatus;
      applyFiltersAndRender();
    }
  }

  /**
   * CỖ MÁY TÍNH TOÁN GIÁ & KIỂM SOÁT MARGIN GUARD THỜI GIAN THỰC
   * QUY TẮC THÉP: Giá D2C làm gốc bắt buộc -> Tự động gợi ý Giá App +25%
   * triggerSource: 'D2C' | 'APP' | 'COGS'
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

    // CHIỀU 1: Người dùng gõ Giá Bán D2C Web -> Tự động gợi ý Giá App Sàn (+25%)
    if (triggerSource === "D2C" && d2cPrice > 0) {
      appPrice = Math.round((d2cPrice * 1.25) / 1000) * 1000;
      appPriceInput.value = appPrice;
    } 
    // CHIỀU 2: Người dùng gõ Giá App Sàn -> Hỗ trợ tính ngược lại Giá D2C nếu ô D2C đang trống
    else if (triggerSource === "APP" && appPrice > 0 && d2cPrice <= 0) {
      d2cPrice = Math.round((appPrice / 1.25) / 1000) * 1000;
      priceInput.value = d2cPrice;
    }

    // TÍNH TOÁN LỢI NHUẬN GỘP & TỶ LỆ FOOD COST CHUẨN XÁC
    var profit = Math.max(0, d2cPrice - cogs);
    var fcPercent = d2cPrice > 0 ? (cogs / d2cPrice) * 100 : 0;

    if (profitInput) {
      profitInput.value = profit.toLocaleString("vi-VN") + " đ";
    }

    var badge = document.getElementById("dish-margin-badge");
    var percentTxt = document.getElementById("dish-foodcost-percent");
    var adviceTxt = document.getElementById("dish-foodcost-advice");
    var bar = document.getElementById("dish-foodcost-bar");

    if (percentTxt) {
      percentTxt.innerText = fcPercent.toFixed(1) + "%";
    }
    if (bar) {
      bar.style.width = Math.min(100, fcPercent) + "%";
    }

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
        adviceTxt.className = "text-amber-400";
      }
      if (bar) bar.className = "h-full bg-amber-500 transition-all duration-300";
    } else {
      if (badge) {
        badge.className = "px-2 py-0.5 rounded-lg text-[9.5px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30";
        badge.innerText = "Food Cost An Toàn (<38%)";
      }
      if (adviceTxt) {
        adviceTxt.innerText = "Biên lợi nhuận tối ưu, bảo vệ dòng tiền an toàn.";
        adviceTxt.className = "text-emerald-400";
      }
      if (bar) bar.className = "h-full bg-emerald-500 transition-all duration-300";
    }
  }

  /**
   * NÉN ẢNH CANVAS CLIENT-SIDE VÀ TẢI THẲNG LÊN GOOGLE DRIVE
   * Thu được Direct CDN URL và gán vào input #dish-image, tuyệt đối KHÔNG đè ảnh Unsplash
   */
  async function handleSingleImageUpload(input) {
    var file = input.files ? input.files[0] : null;
    if (!file) return;

    var previewImg = document.getElementById("dish-img-preview");
    var inputUrl = document.getElementById("dish-image");
    var codeInput = document.getElementById("dish-code");
    var itemCode = (codeInput && codeInput.value.trim()) ? codeInput.value.trim().toUpperCase() : "ITEM";

    try {
      isUploadingMedia = true;

      // 1. Nén ảnh qua Canvas WebP
      var compressedBase64 = "";
      if (window.Thim5MediaEngine && typeof window.Thim5MediaEngine.compressImage === "function") {
        var resCompress = await window.Thim5MediaEngine.compressImage(file, 800, 0.80);
        compressedBase64 = resCompress.base64Data;
      } else {
        compressedBase64 = await new Promise(function(resolve, reject) {
          var reader = new FileReader();
          reader.onload = function(e) {
            var img = new Image();
            img.onload = function() {
              var canvas = document.createElement("canvas");
              var maxWidth = 800;
              var width = img.width;
              var height = img.height;
              if (width > maxWidth) {
                height = Math.round((height * maxWidth) / width);
                width = maxWidth;
              }
              canvas.width = width;
              canvas.height = height;
              var ctx = canvas.getContext("2d");
              ctx.drawImage(img, 0, 0, width, height);
              var dataUrl = canvas.toDataURL("image/webp", 0.82);
              if (!dataUrl || dataUrl.indexOf("data:image/webp") === -1) {
                dataUrl = canvas.toDataURL("image/jpeg", 0.82);
              }
              resolve(dataUrl);
            };
            img.onerror = function() { reject(new Error("Lỗi đọc dữ liệu ảnh")); };
            img.src = e.target.result;
          };
          reader.onerror = function() { reject(new Error("Lỗi nạp file từ thiết bị")); };
          reader.readAsDataURL(file);
        });
      }

      // Cập nhật ngay ảnh vừa chọn lên khung xem trước
      if (previewImg) {
        previewImg.src = compressedBase64;
        previewImg.classList.remove("hidden");
      }

      // 2. Gửi Base64 lên Google Apps Script để lưu vào thư mục THIM5_MENU_MEDIA trên Drive
      var actionUpload = (window.T5_DICT && window.T5_DICT.ACTIONS && window.T5_DICT.ACTIONS.UPLOAD_DISH_MEDIA_IMAGE)
                         ? window.T5_DICT.ACTIONS.UPLOAD_DISH_MEDIA_IMAGE
                         : "uploadDishMediaImage";

      var uploadPayload = {
        base64Data: compressedBase64,
        fileName: itemCode + "_" + Date.now() + ".webp",
        itemCode: itemCode
      };

      var resUpload = await window.Thim5API.callGAS(actionUpload, uploadPayload);

      if (resUpload && resUpload.status === "success" && resUpload.data) {
        var directUrl = resUpload.data.directCdnUrl || resUpload.data.lh3CdnUrl || resUpload.data.googleDriveViewUrl;
        if (inputUrl) {
          inputUrl.value = directUrl;
        }
        if (previewImg) {
          previewImg.src = directUrl;
        }
        alert("📸 Đã tải ảnh thật lên Google Drive thành công!");
      } else {
        // Nếu Drive chưa cấu hình xong: Giữ chuỗi nén Base64 để lưu thẳng, không bao giờ thay bằng ảnh Unsplash!
        if (inputUrl) {
          inputUrl.value = compressedBase64;
        }
        console.warn("⚠️ Chưa thể lấy URL Drive CDN, tạm thời lưu ảnh nén Base64:", resUpload);
      }

    } catch (err) {
      console.error("❌ Lỗi xử lý ảnh thật:", err);
      alert("⚠️ Không thể tải ảnh lên Google Drive: " + err.message + "\nHệ thống sẽ sử dụng ảnh nén cục bộ.");
      if (inputUrl && previewImg && previewImg.src) {
        inputUrl.value = previewImg.src;
      }
    } finally {
      isUploadingMedia = false;
    }
  }

  /**
   * MODAL THÊM / CHỈNH SỬA MÓN ĐƠN LẺ & COMBO
   */
  function openDishModal(editCode) {
    var modal = document.getElementById("modal-single-dish");
    var title = document.getElementById("modal-dish-title");
    var isEditInput = document.getElementById("dish-is-edit");
    var previewImg = document.getElementById("dish-img-preview");

    if (editCode) {
      var item = rawMenuList.find(function(x) { return x.code === editCode; });
      if (!item) return;
      if (title) title.innerText = "Chỉnh Sửa Món: " + item.code;
      if (isEditInput) isEditInput.value = "true";
      document.getElementById("dish-code").value = item.code;
      document.getElementById("dish-code").readOnly = true;
      document.getElementById("dish-name").value = item.name || "";
      
      renderCategoryDropdownOptions(item.category || "Món Cơm");

      document.getElementById("dish-role").value = item.role || item.tag || "CORE";
      document.getElementById("dish-unit").value = item.unit || "Phần";
      document.getElementById("dish-cogs").value = item.cogs || item.cost || "";
      document.getElementById("dish-price").value = item.d2cPrice || item.price || "";
      document.getElementById("dish-app-price").value = item.appPrice || "";
      
      var currentImg = item.imageUrl || item.image || item.img || "";
      document.getElementById("dish-image").value = currentImg;
      if (previewImg) {
        if (currentImg) {
          previewImg.src = currentImg;
          previewImg.classList.remove("hidden");
        } else {
          previewImg.src = "";
          previewImg.classList.add("hidden");
        }
      }

      document.getElementById("dish-status").value = item.status || "ACTIVE";
      document.getElementById("dish-desc").value = item.description || item.desc || "";
      document.getElementById("dish-cross-sell").value = item.crossSell || item.crossSellSuggest || "";
      document.getElementById("dish-booster-soup").value = item.boosterSoup || "";
      document.getElementById("dish-is-dry").checked = Boolean(item.isDry !== false);
    } else {
      if (title) title.innerText = "Thêm Món Ăn / Combo Mới";
      if (isEditInput) isEditInput.value = "false";
      var form = document.getElementById("form-single-dish");
      if (form) form.reset();
      
      renderCategoryDropdownOptions("Món Cơm");

      var codeInput = document.getElementById("dish-code");
      if (codeInput) {
        codeInput.readOnly = false;
        codeInput.value = "M_" + (rawMenuList.length + 1);
      }
      var isDryCheck = document.getElementById("dish-is-dry");
      if (isDryCheck) isDryCheck.checked = true;

      if (previewImg) {
        previewImg.src = "";
        previewImg.classList.add("hidden");
      }
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
   * QUY TẮC THÉP: Bắt buộc Giá D2C > 0. Nếu thiếu chặn lưu ngay lập tức!
   * Tuyệt đối không tự ý đè ảnh Unsplash mặc định.
   */
  async function handleSaveDish(e) {
    if (e && typeof e.preventDefault === "function") e.preventDefault();

    if (isUploadingMedia) {
      alert("⏳ Ảnh món ăn đang được tải lên Google Drive, vui lòng chờ trong giây lát!");
      return;
    }
    
    var btn = document.getElementById("btn-save-dish-submit");
    var origBtnHtml = btn ? btn.innerHTML : "";

    var codeVal = (document.getElementById("dish-code") ? document.getElementById("dish-code").value : "").trim().toUpperCase();
    var nameVal = (document.getElementById("dish-name") ? document.getElementById("dish-name").value : "").trim();
    var catVal = document.getElementById("dish-category") ? document.getElementById("dish-category").value : "Món Cơm";
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

    // 1. KIỂM TOÁN TÊN MÓN
    if (!nameVal) {
      alert("⚠️ Tên món ăn không được để trống!");
      if (document.getElementById("dish-name")) document.getElementById("dish-name").focus();
      return;
    }

    // 2. QUY TẮC THÉP: BẮT BUỘC NHẬP GIÁ BÁN D2C WEB > 0
    if (priceVal <= 0) {
      alert("⛔ QUY TẮC BẮT BUỘC: Giá Bán Web D2C phải lớn hơn 0 đ!\nQuý khách vui lòng nhập Giá D2C thực tế của món ăn trước khi lưu.");
      if (document.getElementById("dish-price")) document.getElementById("dish-price").focus();
      return;
    }

    // 3. TỰ ĐỘNG GỢI Ý GIÁ APP SÀN NGOÀI NẾU ĐỂ TRỐNG (+25%)
    if (appPriceVal <= priceVal) {
      appPriceVal = Math.round((priceVal * 1.25) / 1000) * 1000;
    }

    // 4. GIỮ NGUYÊN ẢNH THẬT ĐƯỢC CHỌN - TUYỆT ĐỐI KHÔNG ÉP LINK UNSPLASH
    var finalImageUrl = rawImgVal;

    var profitVal = Math.max(0, priceVal - cogsVal);
    var discountRateVal = appPriceVal > priceVal 
      ? Math.round(((appPriceVal - priceVal) / appPriceVal) * 100) 
      : 20;

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
      discountPercent: discountRateVal,
      profit: profitVal,
      image: finalImageUrl,
      imageUrl: finalImageUrl,
      status: statusVal,
      description: descVal,
      crossSell: crossSellVal,
      crossSellSuggest: crossSellVal,
      boosterSoup: boosterSoupVal,
      isDry: isDryVal
    };

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang Lưu Món...';
    }

    try {
      if (!window.Thim5API || typeof window.Thim5API.callGAS !== "function") {
        throw new Error("Chưa kết nối Thim5API adapter!");
      }

      var actionSave = (window.T5_DICT && window.T5_DICT.ACTIONS && window.T5_DICT.ACTIONS.SAVE_OR_UPDATE_MENU_ITEM)
                       ? window.T5_DICT.ACTIONS.SAVE_OR_UPDATE_MENU_ITEM
                       : "saveOrUpdateMenuItem";

      var res = await window.Thim5API.callGAS(actionSave, payload);
      
      if (res && res.status === "success") {
        alert("🎉 Đã lưu thành công món [" + nameVal + "] vào cơ sở dữ liệu thực đơn!\nGiá D2C: " + priceVal.toLocaleString("vi-VN") + "đ • Giá App: " + appPriceVal.toLocaleString("vi-VN") + "đ");
        closeDishModal();
        init(); // Làm mới ma trận thực đơn trên Admin
      } else {
        alert("⛔ Máy chủ phản hồi: " + (res && res.message ? res.message : "Không thể lưu dữ liệu món!"));
      }
    } catch (err) {
      console.error("Lỗi lưu món:", err);
      alert("❌ " + err.message);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = origBtnHtml || '<i class="fa-solid fa-floppy-disk"></i> Lưu Món Vào Thực Đơn';
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

        var res = await window.Thim5API.callGAS(actionDelete, { itemCode: code, code: code });
        if (res && res.status === "success") {
          alert("🗑️ Đã xóa món [" + code + "] thành công!");
          init();
        } else {
          alert("⛔ Lỗi: " + (res && res.message ? res.message : "Máy chủ từ chối xóa món!"));
        }
      } catch (err) {
        alert("❌ Lỗi kết nối xóa món: " + err.message);
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
    var endpoint = (window.Thim5API && typeof window.Thim5API.getEndpoint === "function") 
      ? window.Thim5API.getEndpoint() 
      : "";
    if (endpoint) {
      window.open(endpoint + "?action=getMenuExcelTemplateStructure", "_blank");
    } else {
      alert("⚠️ Chưa xác định được đường dẫn máy chủ backend!");
    }
  }

  function handleExcelFileSelect(input) {
    var file = input.files ? input.files[0] : null;
    if (!file) return;

    var reader = new FileReader();
    reader.onload = function(e) {
      var data = e.target.result;
      parseCsvOrExcelBuffer(data, file.name);
    };

    if (file.name.toLowerCase().endsWith(".csv")) {
      reader.readAsText(file, "UTF-8");
    } else {
      reader.readAsDataURL(file);
    }
  }

  function parseCsvOrExcelBuffer(bufferData, fileName) {
    if (fileName.toLowerCase().endsWith(".csv")) {
      var lines = bufferData.split(/\r\n|\n/);
      var items = [];
      for (var i = 1; i < lines.length; i++) {
        var line = lines[i].trim();
        if (!line) continue;
        var parts = line.split(",");
        if (parts.length >= 4) {
          var rawD2cPrice = Number(parts[4] || parts[3] || 0) || 0;
          var rawAppPrice = Math.round((rawD2cPrice * 1.25) / 1000) * 1000;
          items.push({
            code: String(parts[0] || "").trim().toUpperCase(),
            name: String(parts[1] || "").trim(),
            category: String(parts[2] || "").trim() || "Món Cơm",
            cogs: Number(parts[3]) || 0,
            d2cPrice: rawD2cPrice,
            price: rawD2cPrice,
            appPrice: rawAppPrice,
            role: parts[5] ? String(parts[5]).trim().toUpperCase() : "CORE"
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
      if (!window.Thim5API || typeof window.Thim5API.callGAS !== "function") {
        throw new Error("Chưa kết nối Thim5API adapter!");
      }

      var actionParse = (window.T5_DICT && window.T5_DICT.ACTIONS && window.T5_DICT.ACTIONS.PARSE_UPLOADED_SPREADSHEET_BUFFER)
                        ? window.T5_DICT.ACTIONS.PARSE_UPLOADED_SPREADSHEET_BUFFER
                        : "parseUploadedSpreadsheetBuffer";

      var res = await window.Thim5API.callGAS(actionParse, { base64Data: base64Data, rawCsvText: base64Data });
      if (res && res.status === "success" && res.data) {
        var items = Array.isArray(res.data.items) ? res.data.items : (Array.isArray(res.data) ? res.data : []);
        displayIngestPreview(items);
      } else {
        alert("⛔ Không thể đọc file Excel: " + (res && res.message ? res.message : "Định dạng không khớp!"));
      }
    } catch (err) {
      alert("Lỗi nạp file Excel: " + err.message);
    }
  }

  async function handleOcrImageSelect(input) {
    var file = input.files ? input.files[0] : null;
    if (!file) return;

    try {
      var compressedBase64 = "";
      if (window.Thim5MediaEngine && typeof window.Thim5MediaEngine.compressImage === "function") {
        var res = await window.Thim5MediaEngine.compressImage(file, 1200, 0.75);
        compressedBase64 = res.base64Data;
      } else {
        compressedBase64 = await new Promise(function(resolve, reject) {
          var r = new FileReader();
          r.onload = function(e) { resolve(e.target.result); };
          r.onerror = function() { reject(new Error("Lỗi đọc file ảnh!")); };
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
      if (!window.Thim5API || typeof window.Thim5API.callGAS !== "function") {
        throw new Error("Chưa kết nối Thim5API adapter!");
      }

      var actionOcr = (window.T5_DICT && window.T5_DICT.ACTIONS && window.T5_DICT.ACTIONS.PROCESS_MENU_OCR_WITH_GEMINI)
                      ? window.T5_DICT.ACTIONS.PROCESS_MENU_OCR_WITH_GEMINI
                      : "processMenuOcrWithGemini";

      var res = await window.Thim5API.callGAS(actionOcr, { base64Data: base64Data, imageBase64: base64Data, mimeType: "image/jpeg" });
      if (res && res.status === "success" && res.data) {
        var items = Array.isArray(res.data.items) ? res.data.items : (Array.isArray(res.data) ? res.data : []);
        displayIngestPreview(items);
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
      if (!window.Thim5API || typeof window.Thim5API.callGAS !== "function") {
        throw new Error("Chưa kết nối Thim5API adapter!");
      }

      var actionUrl = (window.T5_DICT && window.T5_DICT.ACTIONS && window.T5_DICT.ACTIONS.EXTRACT_MENU_FROM_PUBLIC_URL)
                      ? window.T5_DICT.ACTIONS.EXTRACT_MENU_FROM_PUBLIC_URL
                      : "extractMenuFromPublicUrl";

      var res = await window.Thim5API.callGAS(actionUrl, { url: url });
      if (res && res.status === "success" && res.data) {
        var items = Array.isArray(res.data.items) ? res.data.items : (Array.isArray(res.data) ? res.data : []);
        displayIngestPreview(items);
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
        var d2cPrice = Number(m.d2cPrice || m.price) || 0;
        var appPrice = Number(m.appPrice) || (d2cPrice > 0 ? Math.round((d2cPrice * 1.25) / 1000) * 1000 : 0);
        var fc = d2cPrice > 0 ? ((cogs / d2cPrice) * 100).toFixed(1) + "%" : "0%";

        var tr = `
          <tr class="hover:bg-slate-900">
            <td class="p-2 text-amber-400 font-bold font-mono">${m.code || ('M_' + (idx + 1))}</td>
            <td class="p-2 text-white font-medium">${m.name || 'Món mới'}</td>
            <td class="p-2 text-slate-400">${m.category || 'Món Cơm'}</td>
            <td class="p-2 text-right font-mono text-slate-400">${cogs.toLocaleString('vi-VN')} đ</td>
            <td class="p-2 text-right font-mono text-amber-400 font-bold">${d2cPrice.toLocaleString('vi-VN')} đ</td>
            <td class="p-2 text-right font-mono text-slate-400">${appPrice.toLocaleString('vi-VN')} đ</td>
            <td class="p-2 text-center text-amber-400 font-mono">${fc}</td>
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
      if (!window.Thim5API || typeof window.Thim5API.callGAS !== "function") {
        throw new Error("Chưa kết nối Thim5API adapter!");
      }

      var actionBatch = (window.T5_DICT && window.T5_DICT.ACTIONS && window.T5_DICT.ACTIONS.BATCH_IMPORT_MENU_ITEMS)
                        ? window.T5_DICT.ACTIONS.BATCH_IMPORT_MENU_ITEMS
                        : "batchImportMenuItems";

      var res = await window.Thim5API.callGAS(actionBatch, { items: stagedIngestItems });
      if (res && res.status === "success") {
        var msg = (res.data && res.data.message) ? res.data.message : "Đã nạp thực đơn hàng loạt thành công!";
        alert("🎉 " + msg);
        closeOmniIngestionModal();
        init();
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

  // TỰ ĐỘNG KHỞI TẠO CONTROLLER KHI GIAO DIỆN SẴN SÀNG
  init();

  return {
    init: init,
    handleSearch: handleSearch,
    filterRole: filterRole,
    toggleItemStock: toggleItemStock,
    calculateMarginGuard: calculateMarginGuard,
    openDishModal: openDishModal,
    closeDishModal: closeDishModal,
    handleSaveDish: handleSaveDish,
    deleteDishItem: deleteDishItem,
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

/* ==========================================================================
   FILE: tab-menu.js - PHẦN [1/6]
   BẮT ĐẦU TỪ: Khai báo Module Controller TabMenuController & Quản lý State
   KẾT THÚC TẠI: Thẻ đóng } của hàm TabMenuController.setCategoryFilter()
   HƯỚNG DẪN: Tạo mới hoặc ghi đè phần đầu tiên của tab-menu.js
   ========================================================================== */

/**
 * =============================================================================
 * MODULE: TAB MENU CONTROLLER - ĐIỀU HÀNH THỰC ĐƠN & DANH MỤC ĐA NGÀNH (v3.5 SAAS)
 * Bản quyền: Bếp Mì Trộn Thím 5 & LongHoaFood Master (Năm 2026)
 * Kiến trúc sư trưởng: Đu Đủ (Cố vấn F&B & Hệ thống SaaS cho anh Hải Âu)
 * Quy chuẩn kỹ thuật:
 *   - Nguồn chân lý duy nhất (SSOT) từ T5_DICT và Backend CatalogService.gs
 *   - Triệt tiêu 100% cơ chế Auto-Harvest danh mục từ món ăn
 *   - Render đủ 8 danh mục từ SYS_CATEGORIES (kể cả mục đang có 0 món)
 *   - Tích hợp chốt kiểm toán Telemetry qua T5_DICT.auditApiResponse()
 * =============================================================================
 */

var TabMenuController = (function() {
    'use strict';

    // Trạng thái cục bộ tập trung của Phân hệ Thực đơn & Danh mục
    var state = {
        isLoading: false,
        rawItems: [],
        categories: [],
        currentCategory: "ALL",
        searchKeyword: "",
        filterRole: "ALL",
        editingItem: null,
        isOcrProcessing: false,
        excelImportBuffer: null,
        activeSubTab: "MENU_ITEMS" // MENU_ITEMS | CATEGORIES | OMNI_INGESTION
    };

    /**
     * HÀM HỖ TRỢ: LẤY % GIẢM D2C MẶC ĐỊNH TỪ TỪ ĐIỂN HOẶC CẤU HÌNH ĐỘNG
     */
    function getDefaultDiscountPercent_() {
        if (window.T5_DICT && window.T5_DICT.CONFIG && window.T5_DICT.CONFIG.FALLBACK_D2C_DISCOUNT_PERCENT != null) {
            return Number(window.T5_DICT.CONFIG.FALLBACK_D2C_DISCOUNT_PERCENT) || 10;
        }
        return 10;
    }

    /**
     * 1. HÀM KHỞI CHẠY (ENTRY POINT CỦA TAB THỰC ĐƠN)
     */
    function init() {
        bindCoreEvents();
        bindModalPricingEvents();
        loadAdminCatalog(false);
    }

    /**
     * 2. ĐĂNG KÝ SỰ KIỆN GIAO DIỆN CỐT LÕI (CORE EVENT LISTENERS)
     * Có chốt chặn dataset.bound để ngăn đăng ký lặp sự kiện khi SPA re-init
     */
    function bindCoreEvents() {
        // Tìm kiếm thời gian thực theo Tên món ăn hoặc Mã SKU
        var searchInput = document.getElementById("menuSearchInput");
        if (searchInput && !searchInput.dataset.bound) {
            searchInput.dataset.bound = "true";
            searchInput.addEventListener("input", function(e) {
                state.searchKeyword = String(e.target.value || "").trim().toLowerCase();
                applyFilterAndRender();
            });
        }

        // Nút làm mới dữ liệu từ Google Sheets (Bỏ qua CacheService)
        var btnRefresh = document.getElementById("btnRefreshMenuCatalog");
        if (btnRefresh && !btnRefresh.dataset.bound) {
            btnRefresh.dataset.bound = "true";
            btnRefresh.addEventListener("click", function() {
                loadAdminCatalog(true);
            });
        }

        // Nút mở Modal thêm món ăn mới
        var btnAddNew = document.getElementById("btnOpenCreateDishModal");
        if (btnAddNew && !btnAddNew.dataset.bound) {
            btnAddNew.dataset.bound = "true";
            btnAddNew.addEventListener("click", function() {
                openEditModal(null);
            });
        }

        // Lọc món ăn theo Tag Chiến Lược (CORE, TRAFFIC, BOOSTER, COMBO)
        var roleFilterSelect = document.getElementById("menuRoleFilterSelect");
        if (roleFilterSelect && !roleFilterSelect.dataset.bound) {
            roleFilterSelect.dataset.bound = "true";
            roleFilterSelect.addEventListener("change", function(e) {
                state.filterRole = String(e.target.value || "ALL").trim().toUpperCase();
                applyFilterAndRender();
            });
        }

        // Điều hướng các Sub-workspace bên trong Bàn điều khiển Thực đơn
        var navSubTabs = document.querySelectorAll(".menu-subnav-btn");
        if (navSubTabs && navSubTabs.length > 0) {
            navSubTabs.forEach(function(btn) {
                if (!btn.dataset.bound) {
                    btn.dataset.bound = "true";
                    btn.addEventListener("click", function() {
                        var targetTab = this.getAttribute("data-tab");
                        if (targetTab) {
                            switchSubTab(targetTab);
                        }
                    });
                }
            });
        }
    }

    /**
     * 3. GỌI API NẠP TRỌN GÓI BUNDLED CATALOG (ITEMS + CATEGORIES)
     * Nhận đồng thời mảng món ăn (13 cột) và mảng danh mục (5 cột) từ Backend
     */
    function loadAdminCatalog(forceRefresh) {
        state.isLoading = true;
        renderLoadingState(true);

        var actionName = (window.T5_DICT && window.T5_DICT.ACTIONS) 
            ? window.T5_DICT.ACTIONS.GET_ADMIN_MENU_CATALOG 
            : "getAdminMenuCatalog";

        var payload = {
            forceRefresh: Boolean(forceRefresh)
        };

        if (typeof Thim5API === 'undefined' || typeof Thim5API.callGAS !== 'function') {
            console.error("🚨 [TabMenuController] Thư viện Thim5API chưa sẵn sàng!");
            renderErrorAlertBanner("Thư viện Thim5API chưa được nạp. Vui lòng kiểm tra lại file api.js!");
            state.isLoading = false;
            renderLoadingState(false);
            return;
        }

        Thim5API.callGAS(actionName, payload)
            .then(function(res) {
                // Kiểm toán tính toàn vẹn dữ liệu qua chốt Master Dictionary
                var audit = (window.T5_DICT && typeof window.T5_DICT.auditApiResponse === 'function')
                    ? window.T5_DICT.auditApiResponse(actionName, res)
                    : { valid: res && res.status === "success", data: res ? res.data : null };

                if (!audit.valid) {
                    throw new Error(audit.message || (res ? res.message : "Lỗi phản hồi dữ liệu thực đơn!"));
                }

                var catalogData = audit.data || {};
                state.rawItems = Array.isArray(catalogData.items) ? catalogData.items : [];
                state.categories = Array.isArray(catalogData.categories) ? catalogData.categories : [];

                hideErrorAlertBanner();
                renderCategoryTabs();
                renderCategoriesManagerTable();
                applyFilterAndRender();
            })
            .catch(function(err) {
                console.error("🚨 [TabMenuController.loadAdminCatalog] Thất bại:", err);
                renderErrorAlertBanner("Không thể nạp thực đơn: " + (err.message || err));
            })
            .finally(function() {
                state.isLoading = false;
                renderLoadingState(false);
            });
    }

    /**
     * 4. HIỂN THỊ TRẠNG THÁI LOADING / SKELETON KHI GỌI MẠNG
     */
    function renderLoadingState(isLoading) {
        var loader = document.getElementById("menuTableSkeleton");
        var content = document.getElementById("menuTableContentWrapper");
        if (loader && content) {
            if (isLoading) {
                loader.classList.remove("hidden");
                content.classList.add("opacity-40", "pointer-events-none");
            } else {
                loader.classList.add("hidden");
                content.classList.remove("opacity-40", "pointer-events-none");
            }
        }
    }

    /**
     * 5. HIỂN THỊ VÀ ẨN BANNER CẢNH BÁO LỖI TELEMETRY
     */
    function renderErrorAlertBanner(errorMessage) {
        var banner = document.getElementById("menuErrorAlertBanner");
        if (!banner) return;

        var msgSpan = document.getElementById("menuErrorAlertText");
        if (msgSpan) {
            msgSpan.textContent = errorMessage;
        }
        banner.classList.remove("hidden");
    }

    function hideErrorAlertBanner() {
        var banner = document.getElementById("menuErrorAlertBanner");
        if (banner) {
            banner.classList.add("hidden");
        }
    }

    /**
     * 6. VẼ ĐỦ 8 TAB DANH MỤC TỪ GOOGLE SHEET SYS_CATEGORIES
     * Hiển thị Icon, Tên danh mục và đếm số món tương ứng (kể cả mục đang có 0 món)
     */
    function renderCategoryTabs() {
        var container = document.getElementById("menuCategoryTabsContainer");
        if (!container) return;

        container.innerHTML = "";

        // Tab "Tất Cả Món Ăn"
        var totalAllCount = state.rawItems.length;
        var btnAll = document.createElement("button");
        btnAll.type = "button";
        btnAll.className = "flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-xs md:text-sm whitespace-nowrap transition-all duration-200 border " +
            (state.currentCategory === "ALL"
                ? "bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-lg shadow-amber-500/10 font-bold"
                : "bg-slate-800/60 text-slate-400 border-slate-700/60 hover:text-slate-200 hover:bg-slate-800");

        btnAll.innerHTML = "<span>🍽️</span> <span>Tất Cả Món</span> <span class='px-2 py-0.5 rounded-full text-[11px] bg-slate-900/80 text-slate-300 font-bold border border-slate-700/50'>" + totalAllCount + "</span>";
        btnAll.onclick = function() {
            setCategoryFilter("ALL");
        };
        container.appendChild(btnAll);

        // Vẽ chính xác 8 danh mục chiến lược nạp động từ SYS_CATEGORIES
        state.categories.forEach(function(cat) {
            var catCode = String(cat.code || "").trim();
            var catName = String(cat.name || "Danh mục").trim();
            var catIcon = String(cat.icon || "🍽️").trim();
            var catSlug = String(cat.slug || "").trim().toLowerCase();

            // Đếm số món ăn thuộc danh mục này
            var itemCount = 0;
            state.rawItems.forEach(function(it) {
                var itCat = String(it.category || "").trim().toLowerCase();
                var itCatSlug = String(it.categorySlug || "").trim().toLowerCase();
                var currentCatCode = catCode.toLowerCase();
                var currentCatName = catName.toLowerCase();

                if (itCat === currentCatName || itCat === currentCatCode || (catSlug && itCatSlug === catSlug)) {
                    itemCount++;
                }
            });

            var btn = document.createElement("button");
            btn.type = "button";
            btn.className = "flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-xs md:text-sm whitespace-nowrap transition-all duration-200 border " +
                (state.currentCategory === catCode
                    ? "bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-lg shadow-amber-500/10 font-bold"
                    : "bg-slate-800/60 text-slate-400 border-slate-700/60 hover:text-slate-200 hover:bg-slate-800");

            var badgeCountClass = itemCount > 0 
                ? "bg-slate-900/80 text-slate-300 font-bold border-slate-700/50" 
                : "bg-rose-500/20 text-rose-300 font-semibold border-rose-500/30";

            btn.innerHTML = "<span>" + catIcon + "</span> <span>" + catName + "</span> <span class='px-2 py-0.5 rounded-full text-[11px] border " + badgeCountClass + "'>" + itemCount + "</span>";
            btn.onclick = function() {
                setCategoryFilter(catCode);
            };
            container.appendChild(btn);
        });
    }

    /**
     * 7. THIẾT LẬP BỘ LỌC DANH MỤC VÀ ĐIỀU PHỐI VẼ LẠI DỮ LIỆU
     */
    function setCategoryFilter(categoryCode) {
        state.currentCategory = categoryCode;
        renderCategoryTabs();
        applyFilterAndRender();
    }
    /* ==========================================================================
   FILE: tab-menu.js - PHẦN [2/6]
   BẮT ĐẦU TỪ: Hàm applyFilterAndRender()
   KẾT THÚC TẠI: Hàm renderEmptyState()
   HƯỚNG DẪN: Copy nối tiếp ngay sau Phần [1/6] của file tab-menu.js
   ========================================================================== */

    /**
     * 8. BỘ LỌC ĐA ĐIỀU KIỆN & ĐIỀU PHỐI VẼ MA TRẬN MÓN ĂN
     * Kết hợp đồng thời: Danh mục đang chọn + Từ khóa tìm kiếm + Tag vai trò chiến lược
     */
    function applyFilterAndRender() {
        var filtered = state.rawItems.filter(function(item) {
            // 1. Lọc theo Danh mục
            var matchCategory = true;
            if (state.currentCategory !== "ALL") {
                var itCat = String(item.category || "").trim().toLowerCase();
                var itCatSlug = String(item.categorySlug || "").trim().toLowerCase();
                var curCat = String(state.currentCategory || "").trim().toLowerCase();

                // Tìm thông tin danh mục tương ứng trong state.categories
                var targetCatObj = state.categories.find(function(c) {
                    return String(c.code || "").toLowerCase() === curCat ||
                           String(c.name || "").toLowerCase() === curCat ||
                           String(c.slug || "").toLowerCase() === curCat;
                });

                if (targetCatObj) {
                    var targetCode = String(targetCatObj.code || "").toLowerCase();
                    var targetName = String(targetCatObj.name || "").toLowerCase();
                    var targetSlug = String(targetCatObj.slug || "").toLowerCase();
                    matchCategory = (itCat === targetCode || itCat === targetName || itCatSlug === targetSlug);
                } else {
                    matchCategory = (itCat === curCat || itCatSlug === curCat);
                }
            }

            // 2. Lọc theo Từ khóa tìm kiếm (SKU hoặc Tên món)
            var matchSearch = true;
            if (state.searchKeyword) {
                var itCode = String(item.code || "").toLowerCase();
                var itName = String(item.name || "").toLowerCase();
                matchSearch = (itCode.indexOf(state.searchKeyword) !== -1 || itName.indexOf(state.searchKeyword) !== -1);
            }

            // 3. Lọc theo Tag Chiến Lược (Role: CORE, TRAFFIC, BOOSTER, COMBO)
            var matchRole = true;
            if (state.filterRole !== "ALL") {
                var itRole = String(item.role || item.tag || "CORE").trim().toUpperCase();
                matchRole = (itRole === state.filterRole);
            }

            return matchCategory && matchSearch && matchRole;
        });

        renderMenuItemsTable(filtered);
        updateKpiDashboard();
    }

    /**
     * 8.1 CẬP NHẬT 4 THẺ KPI TÀI CHÍNH & VẬN HÀNH THỰC ĐƠN
     * Tính toán động: Món hoạt động, FC trung bình, Món kéo AOV, Trần FC
     */
    function updateKpiDashboard() {
        var activeCount = 0;
        var totalItems = Array.isArray(state.rawItems) ? state.rawItems.length : 0;
        var totalD2cActive = 0;
        var totalCogsActive = 0;
        var boosterCount = 0;

        (state.rawItems || []).forEach(function(it) {
            var isOutOfStock = String(it.status || "ACTIVE").toUpperCase() === "OUT_OF_STOCK";
            var role = String(it.role || it.tag || "CORE").toUpperCase();
            var d2c = Number(it.d2cPrice || it.price || 0);
            var cogs = Number(it.cogs || it.cost || 0);

            if (!isOutOfStock) {
                activeCount++;
                if (d2c > 0) {
                    totalD2cActive += d2c;
                    totalCogsActive += cogs;
                }
            }

            if (role === "BOOSTER" || String(it.category || "").toLowerCase().indexOf("topping") !== -1 || String(it.category || "").toLowerCase().indexOf("uống") !== -1) {
                boosterCount++;
            }
        });

        var avgFc = totalD2cActive > 0 ? (totalCogsActive / totalD2cActive) * 100 : 0;

        var elActive = document.getElementById("kpi-active-items");
        var elTotal = document.getElementById("kpi-total-items");
        var elAvgFc = document.getElementById("kpi-avg-foodcost");
        var elBooster = document.getElementById("kpi-booster-count");
        var elMaxFc = document.getElementById("kpi-max-fc-limit");

        if (elActive) elActive.textContent = activeCount;
        if (elTotal) elTotal.textContent = totalItems;
        if (elAvgFc) elAvgFc.textContent = avgFc.toFixed(1) + "%";
        if (elBooster) elBooster.textContent = boosterCount;
        if (elMaxFc) elMaxFc.textContent = "38.0%";
    }

    /**
     * 9. HÀM HỖ TRỢ: TRUY VẤN THÔNG TIN TRẦN FOOD COST VÀ ICON CỦA DANH MỤC
     */
    function getCategoryMeta(categoryNameOrCode) {
        var defaultMeta = { name: categoryNameOrCode || "Khác", icon: "🍽️", maxFcPercent: 38, slug: "other" };
        if (!categoryNameOrCode || !Array.isArray(state.categories)) {
            return defaultMeta;
        }

        var searchKey = String(categoryNameOrCode).trim().toLowerCase();
        var found = state.categories.find(function(c) {
            return String(c.code || "").trim().toLowerCase() === searchKey ||
                   String(c.name || "").trim().toLowerCase() === searchKey ||
                   String(c.slug || "").trim().toLowerCase() === searchKey;
        });

        return found ? found : defaultMeta;
    }

    /**
     * 10. HÀM HỖ TRỢ: TẠO HUY HIỆU VAI TRÒ CHIẾN LƯỢC (TAG ROLE BADGE)
     */
    function getRoleBadgeHtml(role) {
        var cleanRole = String(role || "CORE").trim().toUpperCase();
        switch (cleanRole) {
            case "TRAFFIC":
                return "<span class='inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40'>🎯 TRAFFIC</span>";
            case "BOOSTER":
                return "<span class='inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'>🚀 BOOSTER</span>";
            case "COMBO":
                return "<span class='inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40'>🎁 COMBO</span>";
            case "CORE":
            default:
                return "<span class='inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/40'>⭐ CHỦ LỰC</span>";
        }
    }

    /**
     * 11. VẼ MA TRẬN MÓN ĂN 13 CỘT CHUẨN REVERSE-PRICING
     * Tích hợp cảnh báo vi phạm trần Food Cost động theo từng danh mục từ SYS_CATEGORIES
     */
    function renderMenuItemsTable(items) {
        var tbody = document.getElementById("menuItemsTableBody");
        var countBadge = document.getElementById("menuFilteredCountBadge");

        if (countBadge) {
            countBadge.textContent = items.length + " món";
        }

        if (!tbody) return;
        tbody.innerHTML = "";

        if (!items || items.length === 0) {
            renderEmptyState(tbody, "Không tìm thấy món ăn nào phù hợp với bộ lọc hiện tại.");
            return;
        }

        items.forEach(function(item, idx) {
            var tr = document.createElement("tr");
            tr.className = "hover:bg-slate-800/40 transition-colors border-b border-slate-800/80 text-xs md:text-sm";

            var catMeta = getCategoryMeta(item.category);
            var maxAllowedFc = Number(catMeta.maxFcPercent) || 38;

            var d2cPrice = Number(item.d2cPrice || item.price || 0);
            var appPrice = Number(item.appPrice || 0);
            var cogs = Number(item.cogs || item.cost || 0);
            var profit = Number(item.profit || Math.max(0, d2cPrice - cogs));
            var discountPercent = Number(item.discountPercent || 0);

            // Tính % Food Cost thực tế trên Giá D2C
            var actualFcPercent = d2cPrice > 0 ? Math.round((cogs / d2cPrice) * 100) : 0;
            var isFcOverLimit = actualFcPercent > maxAllowedFc;

            var isOutOfStock = String(item.status || "ACTIVE").toUpperCase() === "OUT_OF_STOCK";
            var itemRole = String(item.role || item.tag || "CORE").toUpperCase();

            var thead = document.querySelector("#subWorkspaceMenuItems table thead");
            var theadCols = thead ? thead.querySelectorAll("th").length : 13;

            if (theadCols === 13) {
                tr.innerHTML =
                    // Cột 1: Món Ăn & Ảnh CDN
                    "<td class='py-3 px-3.5 text-slate-200'>" +
                        "<div class='flex items-center gap-3'>" +
                            "<div class='relative w-11 h-11 rounded-lg overflow-hidden bg-slate-800 border border-slate-700/80 flex-shrink-0 flex items-center justify-center'>" +
                                (item.imageUrl
                                    ? "<img src='" + item.imageUrl + "' alt='" + item.name + "' class='w-full h-full object-cover' onerror=\"this.style.display='none';this.nextElementSibling.style.display='flex';\"/><span style='display:none;' class='text-base'>🍲</span>"
                                    : "<span class='text-base'>🍲</span>") +
                                (isOutOfStock ? "<span class='absolute inset-0 bg-rose-950/80 backdrop-blur-[1px] text-[8px] font-bold text-rose-300 flex items-center justify-center text-center leading-tight'>HẾT<br>HÀNG</span>" : "") +
                            "</div>" +
                            "<div class='min-w-0'>" +
                                "<div class='font-bold text-slate-200 hover:text-amber-400 transition-colors cursor-pointer truncate max-w-[150px]' onclick='TabMenuController.openEditModal(\"" + item.code + "\")' title='" + (item.description || item.name) + "'>" + item.name + "</div>" +
                            "</div>" +
                        "</div>" +
                    "</td>" +

                    // Cột 2: Mã SKU
                    "<td class='py-3 px-2 font-mono text-xs text-slate-400 whitespace-nowrap'>" +
                        "<span class='px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700/50'>" + item.code + "</span>" +
                    "</td>" +

                    // Cột 3: Danh Mục
                    "<td class='py-3 px-3 whitespace-nowrap'>" +
                        "<span class='inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-slate-800/80 text-slate-300 border border-slate-700/60'>" +
                            "<span>" + catMeta.icon + "</span>" +
                            "<span class='truncate max-w-[100px]'>" + (catMeta.name || item.category) + "</span>" +
                        "</span>" +
                    "</td>" +

                    // Cột 4: Tag Chiến Lược (Role)
                    "<td class='py-3 px-2 text-center whitespace-nowrap'>" +
                        getRoleBadgeHtml(itemRole) +
                    "</td>" +

                    // Cột 5: Giá Niêm Yết App (+25%)
                    "<td class='py-3 px-3 text-right whitespace-nowrap font-mono text-slate-400 text-xs'>" +
                        (appPrice > 0 ? appPrice.toLocaleString('vi-VN') + "đ" : "---") +
                    "</td>" +

                    // Cột 6: % Giảm Web D2C
                    "<td class='py-3 px-2 text-right whitespace-nowrap font-mono font-bold text-emerald-400 text-xs'>" +
                        "-" + discountPercent + "%" +
                    "</td>" +

                    // Cột 7: Giá Bán Web D2C
                    "<td class='py-3 px-3 text-right whitespace-nowrap font-mono font-black text-amber-400 text-sm'>" +
                        d2cPrice.toLocaleString('vi-VN') + "đ" +
                    "</td>" +

                    // Cột 8: Giá Vốn Nguyên Liệu COGS
                    "<td class='py-3 px-3 text-right whitespace-nowrap font-mono text-slate-300 text-xs'>" +
                        cogs.toLocaleString('vi-VN') + "đ" +
                    "</td>" +

                    // Cột 9: % Food Cost Thực Tế
                    "<td class='py-3 px-2 text-center whitespace-nowrap'>" +
                        "<span class='inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold " +
                            (isFcOverLimit 
                                ? "bg-rose-500/20 text-rose-300 border border-rose-500/40' title='Vượt trần FC danh mục (" + maxAllowedFc + "%)!'"
                                : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' title='Trong trần FC an toàn (" + maxAllowedFc + "%)'") + "'>" +
                            (isFcOverLimit ? "⚠️ " : "✓ ") + actualFcPercent + "%" +
                        "</span>" +
                    "</td>" +

                    // Cột 10: Lợi Nhuận Ròng (LNR)
                    "<td class='py-3 px-3 text-right whitespace-nowrap'>" +
                        "<div class='font-mono font-bold text-emerald-400 text-xs md:text-sm'>+" + profit.toLocaleString('vi-VN') + "đ</div>" +
                        "<div class='text-[10px] text-slate-500 font-mono'>" + (d2cPrice > 0 ? Math.round((profit / d2cPrice) * 100) : 0) + "% LNR</div>" +
                    "</td>" +

                    // Cột 11: Súp Booster / Bán Kèm
                    "<td class='py-3 px-3 text-center whitespace-nowrap text-xs text-slate-400'>" +
                        (item.boosterSoup ? "<span class='text-amber-400/90 font-medium truncate max-w-[110px] inline-block' title='" + item.boosterSoup + "'>🥣 " + item.boosterSoup + "</span>" : "<span class='text-slate-600'>---</span>") +
                    "</td>" +

                    // Cột 12: Công Tắc Trạng Thái Bếp (Toggle Còn bán / Hết hàng)
                    "<td class='py-3 px-2 text-center whitespace-nowrap'>" +
                        "<button type='button' onclick='TabMenuController.toggleItemStatus(\"" + item.code + "\")' class='relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none " +
                            (isOutOfStock ? "bg-slate-700" : "bg-emerald-600") + "' title='" + (isOutOfStock ? "Món đang TẠM HẾT (Bấm để mở bán)" : "Món đang CÒN BÁN (Bấm để báo hết)") + "'>" +
                            "<span class='pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out " +
                            (isOutOfStock ? "translate-x-0" : "translate-x-5") + "'></span>" +
                        "</button>" +
                    "</td>" +

                    // Cột 13: Thao Tác Quản Trị (Sửa, Nhân Bản, Xóa)
                    "<td class='py-3 px-3.5 text-right whitespace-nowrap'>" +
                        "<div class='flex items-center justify-end gap-1.5'>" +
                            "<button type='button' onclick='TabMenuController.openEditModal(\"" + item.code + "\")' class='p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-amber-400 hover:bg-slate-700 transition-colors border border-slate-700/60' title='Chỉnh sửa 13 cột Reverse-Pricing'>" +
                                "<svg class='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z'></path></svg>" +
                            "</button>" +
                            "<button type='button' onclick='TabMenuController.cloneMenuItem(\"" + item.code + "\")' class='p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-blue-400 hover:bg-slate-700 transition-colors border border-slate-700/60' title='Nhân bản món ăn 1-click'>" +
                                "<svg class='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z'></path></svg>" +
                            "</button>" +
                            "<button type='button' onclick='TabMenuController.deleteMenuItem(\"" + item.code + "\")' class='p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-rose-400 hover:bg-slate-700 transition-colors border border-slate-700/60' title='Xóa món khỏi thực đơn'>" +
                                "<svg class='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16'></path></svg>" +
                            "</button>" +
                        "</div>" +
                    "</td>";
            } else {
                tr.innerHTML =
                    // Cột 1 & 2: Ảnh CDN & Thông tin Món (SKU, Tên, Mô tả)
                    "<td class='py-3 px-4 font-mono text-xs text-slate-400 whitespace-nowrap'>" +
                        "<div class='flex items-center gap-3'>" +
                            "<div class='relative w-12 h-12 rounded-lg overflow-hidden bg-slate-800 border border-slate-700/80 flex-shrink-0 flex items-center justify-center'>" +
                                (item.imageUrl
                                    ? "<img src='" + item.imageUrl + "' alt='" + item.name + "' class='w-full h-full object-cover' onerror=\"this.style.display='none';this.nextElementSibling.style.display='flex';\"/><span style='display:none;' class='text-lg'>🍲</span>"
                                    : "<span class='text-lg'>🍲</span>") +
                                (isOutOfStock ? "<span class='absolute inset-0 bg-rose-950/80 backdrop-blur-[1px] text-[9px] font-bold text-rose-300 flex items-center justify-center text-center leading-tight'>HẾT<br>HÀNG</span>" : "") +
                            "</div>" +
                            "<div class='min-w-0'>" +
                                "<div class='font-bold text-slate-200 hover:text-amber-400 transition-colors cursor-pointer truncate max-w-[160px] md:max-w-[200px]' onclick='TabMenuController.openEditModal(\"" + item.code + "\")'>" + item.name + "</div>" +
                                "<div class='flex items-center gap-1.5 mt-0.5'>" +
                                    "<span class='text-[10px] font-mono px-1 rounded bg-slate-800 text-slate-400 border border-slate-700/50'>" + item.code + "</span>" +
                                    (item.boosterSoup ? "<span class='text-[10px] text-amber-400/90 font-medium truncate max-w-[100px]' title='Kèm: " + item.boosterSoup + "'>🥣 " + item.boosterSoup + "</span>" : "") +
                                "</div>" +
                            "</div>" +
                        "</div>" +
                    "</td>" +

                    // Cột 3: Danh Mục
                    "<td class='py-3 px-3 whitespace-nowrap'>" +
                        "<span class='inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-slate-800/80 text-slate-300 border border-slate-700/60'>" +
                            "<span>" + catMeta.icon + "</span>" +
                            "<span class='truncate max-w-[110px]'>" + (catMeta.name || item.category) + "</span>" +
                        "</span>" +
                    "</td>" +

                    // Cột 4, 5, 6: Bộ Ba Giá Reverse-Pricing (Giá App, % Giảm D2C, Giá Web D2C)
                    "<td class='py-3 px-3 text-right whitespace-nowrap'>" +
                        "<div class='text-xs text-slate-400 line-through font-mono'>" + (appPrice > 0 ? appPrice.toLocaleString('vi-VN') + "đ" : "---") + "</div>" +
                        "<div class='text-[11px] text-emerald-400 font-semibold'>-" + discountPercent + "% D2C</div>" +
                    "</td>" +
                    "<td class='py-3 px-3 text-right whitespace-nowrap'>" +
                        "<div class='text-sm md:text-base font-extrabold text-amber-400 font-mono'>" + d2cPrice.toLocaleString('vi-VN') + "đ</div>" +
                        "<div class='text-[10px] text-slate-500'>Web D2C</div>" +
                    "</td>" +

                    // Cột 7 & 8: Giá Vốn COGS & Cảnh Báo Trần Food Cost Động
                    "<td class='py-3 px-3 text-right whitespace-nowrap'>" +
                        "<div class='font-mono text-slate-300 font-medium'>" + cogs.toLocaleString('vi-VN') + "đ</div>" +
                        "<div class='mt-0.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold " +
                            (isFcOverLimit 
                                ? "bg-rose-500/20 text-rose-300 border border-rose-500/40' title='Vượt trần FC danh mục (" + maxAllowedFc + "%)!'"
                                : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' title='Trong trần FC an toàn (" + maxAllowedFc + "%)'") + "'>" +
                            (isFcOverLimit ? "⚠️ " : "✓ ") + actualFcPercent + "%" +
                        "</div>" +
                    "</td>" +

                    // Cột 9: Lợi Nhuận Ròng (LNR)
                    "<td class='py-3 px-3 text-right whitespace-nowrap'>" +
                        "<div class='font-mono font-bold text-emerald-400 text-xs md:text-sm'>+" + profit.toLocaleString('vi-VN') + "đ</div>" +
                        "<div class='text-[10px] text-slate-500 font-mono'>" + (d2cPrice > 0 ? Math.round((profit / d2cPrice) * 100) : 0) + "% LNR</div>" +
                    "</td>" +

                    // Cột 10: Vai Trò Chiến Lược
                    "<td class='py-3 px-3 text-center whitespace-nowrap'>" +
                        getRoleBadgeHtml(itemRole) +
                    "</td>" +

                    // Cột 11: Công Tắc Trạng Thái Bếp (Toggle Còn bán / Hết hàng)
                    "<td class='py-3 px-3 text-center whitespace-nowrap'>" +
                        "<button type='button' onclick='TabMenuController.toggleItemStatus(\"" + item.code + "\")' class='relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none " +
                            (isOutOfStock ? "bg-slate-700" : "bg-emerald-600") + "' title='" + (isOutOfStock ? "Món đang TẠM HẾT (Bấm để mở bán)" : "Món đang CÒN BÁN (Bấm để báo hết)") + "'>" +
                            "<span class='pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out " +
                            (isOutOfStock ? "translate-x-0" : "translate-x-5") + "'></span>" +
                        "</button>" +
                    "</td>" +

                    // Cột 12: Thao Tác Quản Trị (Sửa, Nhân Bản, Xóa)
                    "<td class='py-3 px-4 text-right whitespace-nowrap'>" +
                        "<div class='flex items-center justify-end gap-1.5'>" +
                            "<button type='button' onclick='TabMenuController.openEditModal(\"" + item.code + "\")' class='p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-amber-400 hover:bg-slate-700 transition-colors border border-slate-700/60' title='Chỉnh sửa 13 cột Reverse-Pricing'>" +
                                "<svg class='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z'></path></svg>" +
                            "</button>" +
                            "<button type='button' onclick='TabMenuController.cloneMenuItem(\"" + item.code + "\")' class='p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-blue-400 hover:bg-slate-700 transition-colors border border-slate-700/60' title='Nhân bản món ăn 1-click'>" +
                                "<svg class='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z'></path></svg>" +
                            "</button>" +
                            "<button type='button' onclick='TabMenuController.deleteMenuItem(\"" + item.code + "\")' class='p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-rose-400 hover:bg-slate-700 transition-colors border border-slate-700/60' title='Xóa món khỏi thực đơn'>" +
                                "<svg class='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16'></path></svg>" +
                            "</button>" +
                        "</div>" +
                    "</td>";
            }

            tbody.appendChild(tr);
        });
    }

    /**
     * 12. HIỂN THỊ TRẠNG THÁI DANH SÁCH RỖNG
     */
    function renderEmptyState(container, message) {
        var thead = document.querySelector("#subWorkspaceMenuItems table thead");
        var theadCols = thead ? thead.querySelectorAll("th").length : 13;
        var tr = document.createElement("tr");
        tr.innerHTML =
            "<td colspan='" + theadCols + "' class='py-12 px-4 text-center text-slate-500'>" +
                "<div class='flex flex-col items-center justify-center gap-2'>" +
                    "<span class='text-3xl'>🍽️</span>" +
                    "<p class='text-sm font-medium text-slate-400'>" + message + "</p>" +
                    "<button type='button' onclick='TabMenuController.openEditModal(null)' class='mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-bold hover:bg-amber-500/30 transition-all'>" +
                        "<span>+</span> Thêm món mới vào danh mục" +
                    "</button>" +
                "</div>" +
            "</td>";
        container.appendChild(tr);
    }
    /* ==========================================================================
   FILE: tab-menu.js - PHẦN [3/6]
   BẮT ĐẦU TỪ: Hàm toggleItemStatus(itemCode)
   KẾT THÚC TẠI: Thẻ đóng } của hàm populateEditModalData(item)
   HƯỚNG DẪN: Copy nối tiếp ngay sau Phần [2/6] của file tab-menu.js
   ========================================================================== */

    /**
     * 13. CÔNG TẮC BẬT/TẮT TRẠNG THÁI MÓN ĂN 1-CLICK (CÒN BÁN / HẾT HÀNG)
     * Thao tác thời gian thực dành cho Trưởng Bếp KDS (Lv1) & Thu Ngân (Lv2)
     */
    function toggleItemStatus(itemCode) {
        if (!itemCode) return;

        var targetItem = state.rawItems.find(function(it) {
            return String(it.code).toUpperCase() === String(itemCode).toUpperCase();
        });

        if (!targetItem) {
            console.error("🚨 [TabMenuController] Không tìm thấy món:", itemCode);
            return;
        }

        var currentStatus = String(targetItem.status || "ACTIVE").toUpperCase();
        var nextStatus = (currentStatus === "ACTIVE") ? "OUT_OF_STOCK" : "ACTIVE";

        // Cập nhật Optimistic UI ngay trên Client để phản hồi tức thì
        targetItem.status = nextStatus;
        applyFilterAndRender();

        var actionName = (window.T5_DICT && window.T5_DICT.ACTIONS)
            ? window.T5_DICT.ACTIONS.TOGGLE_MENU_ITEM_STATUS
            : "toggleMenuItemStatus";

        var payload = {
            code: itemCode,
            status: nextStatus
        };

        Thim5API.callGAS(actionName, payload)
            .then(function(res) {
                var audit = (window.T5_DICT && typeof window.T5_DICT.auditApiResponse === 'function')
                    ? window.T5_DICT.auditApiResponse(actionName, res)
                    : { valid: res && res.status === "success" };

                if (!audit.valid) {
                    throw new Error(res ? res.message : "Lỗi phản hồi cập nhật trạng thái!");
                }
            })
            .catch(function(err) {
                console.error("🚨 [TabMenuController.toggleItemStatus] Thất bại, hoàn tác UI:", err);
                // Hoàn tác lại trạng thái cũ nếu Backend thất bại
                targetItem.status = currentStatus;
                applyFilterAndRender();
                alert("Không thể đổi trạng thái món: " + (err.message || err));
            });
    }

    /**
     * 14. XÓA MÓN ĂN VĨNH VIỄN KHỎI SHEET DATA_MENU
     * Yêu cầu xác nhận kiểm soát rủi ro dòng tiền
     */
    function deleteMenuItem(itemCode) {
        if (!itemCode) return;

        var targetItem = state.rawItems.find(function(it) {
            return String(it.code).toUpperCase() === String(itemCode).toUpperCase();
        });

        var dishName = targetItem ? targetItem.name : itemCode;
        var confirmMsg = "Anh Hải Âu có chắc chắn muốn XÓA VĨNH VIỄN món [" + dishName + "] (" + itemCode + ") khỏi hệ thống?\nThao tác này sẽ cập nhật trực tiếp vào sheet DATA_MENU!";
        
        if (!confirm(confirmMsg)) {
            return;
        }

        var actionName = (window.T5_DICT && window.T5_DICT.ACTIONS)
            ? window.T5_DICT.ACTIONS.DELETE_MENU_ITEM
            : "deleteMenuItem";

        var payload = {
            code: itemCode
        };

        // Ẩn tạm thời trên UI
        var previousItems = state.rawItems.slice();
        state.rawItems = state.rawItems.filter(function(it) {
            return String(it.code).toUpperCase() !== String(itemCode).toUpperCase();
        });
        applyFilterAndRender();
        renderCategoryTabs();

        Thim5API.callGAS(actionName, payload)
            .then(function(res) {
                var audit = (window.T5_DICT && typeof window.T5_DICT.auditApiResponse === 'function')
                    ? window.T5_DICT.auditApiResponse(actionName, res)
                    : { valid: res && res.status === "success" };

                if (!audit.valid) {
                    throw new Error(res ? res.message : "Lỗi xóa món từ Backend!");
                }
            })
            .catch(function(err) {
                console.error("🚨 [TabMenuController.deleteMenuItem] Thất bại, khôi phục danh sách:", err);
                state.rawItems = previousItems;
                applyFilterAndRender();
                renderCategoryTabs();
                alert("Lỗi khi xóa món: " + (err.message || err));
            });
    }

    /**
     * 15. NHÂN BẢN MÓN ĂN 1-CLICK (CLONE DISH)
     * Sao chép toàn bộ công thức 13 cột để tạo món biến thể siêu tốc
     */
    function cloneMenuItem(itemCode) {
        if (!itemCode) return;

        var sourceItem = state.rawItems.find(function(it) {
            return String(it.code).toUpperCase() === String(itemCode).toUpperCase();
        });

        if (!sourceItem) return;

        // Sinh mã SKU mới tự động (ví dụ: M01_COPY_1234)
        var randomSuffix = String(Math.floor(1000 + Math.random() * 9000));
        var newCode = sourceItem.code + "_COPY_" + randomSuffix;

        var clonedItem = JSON.parse(JSON.stringify(sourceItem));
        clonedItem.code = newCode;
        clonedItem.name = sourceItem.name + " (Bản sao)";
        clonedItem.status = "ACTIVE";

        openEditModal(clonedItem);
    }

    /**
     * 16. MỞ MODAL CHỈNH SỬA / THÊM MỚI MÓN ĂN 13 CỘT
     * Nhận vào itemCode (chỉnh sửa), clonedObject (nhân bản), hoặc null (thêm mới)
     */
    function openEditModal(target) {
        var modal = document.getElementById("dishEditModal");
        if (!modal) {
            console.error("🚨 [TabMenuController] Không tìm thấy modal #dishEditModal trong DOM!");
            return;
        }

        var itemToEdit = null;

        if (typeof target === "string") {
            itemToEdit = state.rawItems.find(function(it) {
                return String(it.code).toUpperCase() === String(target).toUpperCase();
            });
        } else if (target && typeof target === "object") {
            itemToEdit = target;
        }

        state.editingItem = itemToEdit;

        // Điền dữ liệu vào form modal
        populateEditModalData(itemToEdit);

        // Kích hoạt tính toán Live Reverse-Pricing
        bindModalPricingEvents();
        recalculatePricingModal();

        modal.classList.remove("hidden");
        document.body.classList.add("overflow-hidden");
    }

    /**
     * 17. ĐÓNG MODAL CHỈNH SỬA MÓN ĂN
     */
    function closeEditModal() {
        var modal = document.getElementById("dishEditModal");
        if (modal) {
            modal.classList.add("hidden");
        }
        document.body.classList.remove("overflow-hidden");
        state.editingItem = null;
    }

    /**
     * 18. ĐIỀN DỮ LIỆU VÀO FORM MODAL 13 CỘT REVERSE-PRICING
     * Đổ danh sách 8 danh mục từ SYS_CATEGORIES vào dropdown select
     */
    function populateEditModalData(item) {
        var modalTitle = document.getElementById("dishModalTitle");
        var inputCode = document.getElementById("modalDishCode");
        var inputName = document.getElementById("modalDishName");
        var selectCategory = document.getElementById("modalDishCategory");
        var inputAppPrice = document.getElementById("modalDishAppPrice");
        var inputDiscount = document.getElementById("modalDishDiscountPercent");
        var inputD2cPrice = document.getElementById("modalDishD2cPrice");
        var inputCogs = document.getElementById("modalDishCogs");
        var selectRole = document.getElementById("modalDishRole");
        var selectStatus = document.getElementById("modalDishStatus");
        var inputSoup = document.getElementById("modalDishBoosterSoup");
        var inputDesc = document.getElementById("modalDishDesc");
        var inputImgUrl = document.getElementById("modalDishImageUrl");
        var imgPreview = document.getElementById("modalDishImagePreview");

        // 1. Nạp danh sách Category động từ state.categories vào thẻ select
        if (selectCategory) {
            selectCategory.innerHTML = "";
            state.categories.forEach(function(cat) {
                var opt = document.createElement("option");
                opt.value = cat.name;
                opt.textContent = cat.icon + " " + cat.name;
                selectCategory.appendChild(opt);
            });
        }

        // 2. Chế độ Thêm mới
        if (!item) {
            if (modalTitle) modalTitle.textContent = "Thêm Món Mới Vào Thực Đơn";
            if (inputCode) {
                inputCode.value = "SKU_" + String(new Date().getTime()).slice(-6);
                inputCode.removeAttribute("readonly");
            }
            if (inputName) inputName.value = "";
            if (selectCategory && selectCategory.options.length > 0) selectCategory.selectedIndex = 0;
            if (inputAppPrice) inputAppPrice.value = "0";
            if (inputDiscount) inputDiscount.value = String(getDefaultDiscountPercent_());
            if (inputD2cPrice) inputD2cPrice.value = "0";
            if (inputCogs) inputCogs.value = "0";
            if (selectRole) selectRole.value = "CORE";
            if (selectStatus) selectStatus.value = "ACTIVE";
            if (inputSoup) inputSoup.value = "";
            if (inputDesc) inputDesc.value = "";
            if (inputImgUrl) inputImgUrl.value = "";
            if (imgPreview) {
                imgPreview.src = "";
                imgPreview.classList.add("hidden");
            }
            return;
        }

        // 3. Chế độ Chỉnh sửa món hiện có
        if (modalTitle) modalTitle.textContent = "Chỉnh Sửa Món: " + item.name;
        if (inputCode) {
            inputCode.value = item.code || "";
            inputCode.setAttribute("readonly", "true");
        }
        if (inputName) inputName.value = item.name || "";
        
        if (selectCategory) {
            var catMatched = false;
            for (var i = 0; i < selectCategory.options.length; i++) {
                if (selectCategory.options[i].value === item.category) {
                    selectCategory.selectedIndex = i;
                    catMatched = true;
                    break;
                }
            }
            if (!catMatched && item.category) {
                var newOpt = document.createElement("option");
                newOpt.value = item.category;
                newOpt.textContent = "🍽️ " + item.category;
                selectCategory.appendChild(newOpt);
                selectCategory.value = item.category;
            }
        }

        if (inputAppPrice) inputAppPrice.value = item.appPrice || 0;
        if (inputDiscount) inputDiscount.value = (item.discountPercent !== undefined && item.discountPercent !== null && item.discountPercent !== "") ? item.discountPercent : getDefaultDiscountPercent_();
        if (inputD2cPrice) inputD2cPrice.value = item.d2cPrice || item.price || 0;
        if (inputCogs) inputCogs.value = item.cogs || item.cost || 0;
        if (selectRole) selectRole.value = String(item.role || item.tag || "CORE").toUpperCase();
        if (selectStatus) selectStatus.value = String(item.status || "ACTIVE").toUpperCase();
        if (inputSoup) inputSoup.value = item.boosterSoup || item.crossSell || "";
        if (inputDesc) inputDesc.value = item.description || item.desc || "";
        if (inputImgUrl) inputImgUrl.value = item.imageUrl || item.image || "";
        
        if (imgPreview) {
            if (item.imageUrl) {
                imgPreview.src = item.imageUrl;
                imgPreview.classList.remove("hidden");
            } else {
                imgPreview.src = "";
                imgPreview.classList.add("hidden");
            }
        }
    }
    /* ==========================================================================
   FILE: tab-menu.js - PHẦN [4/6]
   BẮT ĐẦU TỪ: Hàm bindModalPricingEvents()
   KẾT THÚC TẠI: Thẻ đóng } của hàm saveDishForm()
   HƯỚNG DẪN: Copy nối tiếp ngay sau Phần [3/6] của file tab-menu.js
   ========================================================================== */

    /**
     * 19. ĐĂNG KÝ SỰ KIỆN TÍNH TOÁN TÀI CHÍNH THỜI GIAN THỰC TRONG MODAL
     * Tự động đồng bộ 2 chiều giữa Giá App (+25%), % Giảm D2C, Giá Web D2C và Giá Vốn COGS
     * Sử dụng chốt chặn dataset.bound chống đăng ký trùng lặp sự kiện
     */
    function bindModalPricingEvents() {
        var inputD2cPrice = document.getElementById("modalDishD2cPrice");
        var inputAppPrice = document.getElementById("modalDishAppPrice");
        var inputDiscount = document.getElementById("modalDishDiscountPercent");
        var inputCogs = document.getElementById("modalDishCogs");
        var selectCategory = document.getElementById("modalDishCategory");
        var selectRole = document.getElementById("modalDishRole");

        // Khi thay đổi Giá Web D2C (Giá gốc chuẩn hóa của cửa hàng)
        if (inputD2cPrice && !inputD2cPrice.dataset.bound) {
            inputD2cPrice.dataset.bound = "true";
            inputD2cPrice.addEventListener("input", function() {
                var d2cVal = Number(inputD2cPrice.value) || 0;
                var discountVal = Number(inputDiscount ? inputDiscount.value : getDefaultDiscountPercent_()) || getDefaultDiscountPercent_();

                // Tự động tính Giá Niêm Yết App (+25% hoặc theo % Giảm D2C) làm tròn đến hàng nghìn
                if (inputAppPrice) {
                    if (discountVal > 0 && discountVal < 100) {
                        var calculatedApp = Math.round((d2cVal / (1 - (discountVal / 100))) / 1000) * 1000;
                        inputAppPrice.value = calculatedApp;
                    } else {
                        var fallbackDisc = getDefaultDiscountPercent_();
                        inputAppPrice.value = Math.round((d2cVal / (1 - (fallbackDisc / 100))) / 1000) * 1000;
                    }
                }
                recalculatePricingModal();
            });
        }

        // Khi thay đổi Giá Niêm Yết App (Sàn Grab / ShopeeFood)
        if (inputAppPrice && !inputAppPrice.dataset.bound) {
            inputAppPrice.dataset.bound = "true";
            inputAppPrice.addEventListener("input", function() {
                var appVal = Number(inputAppPrice.value) || 0;
                var discountVal = Number(inputDiscount ? inputDiscount.value : getDefaultDiscountPercent_()) || getDefaultDiscountPercent_();

                // Tính ngược lại Giá Web D2C
                if (inputD2cPrice) {
                    var calculatedD2c = Math.round((appVal * (1 - (discountVal / 100))) / 1000) * 1000;
                    inputD2cPrice.value = Math.max(0, calculatedD2c);
                }
                recalculatePricingModal();
            });
        }

        // Khi thay đổi % Giảm Giá Kênh Web D2C
        if (inputDiscount && !inputDiscount.dataset.bound) {
            inputDiscount.dataset.bound = "true";
            inputDiscount.addEventListener("input", function() {
                var appVal = Number(inputAppPrice ? inputAppPrice.value : 0) || 0;
                var discountVal = Number(inputDiscount.value) || 0;

                if (appVal > 0 && inputD2cPrice) {
                    var calculatedD2c = Math.round((appVal * (1 - (discountVal / 100))) / 1000) * 1000;
                    inputD2cPrice.value = Math.max(0, calculatedD2c);
                }
                recalculatePricingModal();
            });
        }

        // Khi thay đổi Giá Vốn COGS (Nguyên vật liệu cấu thành món ăn)
        if (inputCogs && !inputCogs.dataset.bound) {
            inputCogs.dataset.bound = "true";
            inputCogs.addEventListener("input", function() {
                recalculatePricingModal();
            });
        }

        // Khi đổi Danh mục (Để đối chiếu Trần Food Cost của danh mục đó)
        if (selectCategory && !selectCategory.dataset.bound) {
            selectCategory.dataset.bound = "true";
            selectCategory.addEventListener("change", function() {
                recalculatePricingModal();
            });
        }

        // Khi đổi Vai trò chiến lược (TRAFFIC, CORE, BOOSTER, COMBO)
        if (selectRole && !selectRole.dataset.bound) {
            selectRole.dataset.bound = "true";
            selectRole.addEventListener("change", function() {
                recalculatePricingModal();
            });
        }
    }

    /**
     * 20. BỘ MÁY TÍNH TÀI CHÍNH LIVE REVERSE-PRICING TRONG MODAL
     * Tính toán Lợi Nhuận Ròng (LNR), % Food Cost và đối soát trần động với SYS_CATEGORIES
     */
    function recalculatePricingModal() {
        var inputD2cPrice = document.getElementById("modalDishD2cPrice");
        var inputCogs = document.getElementById("modalDishCogs");
        var selectCategory = document.getElementById("modalDishCategory");
        var selectRole = document.getElementById("modalDishRole");

        var displayProfit = document.getElementById("modalDishProfitDisplay");
        var displayFcPercent = document.getElementById("modalDishFcPercentDisplay");
        var warningBox = document.getElementById("modalDishFcWarningBox");
        var warningText = document.getElementById("modalDishFcWarningText");

        var d2cPrice = Number(inputD2cPrice ? inputD2cPrice.value : 0) || 0;
        var cogs = Number(inputCogs ? inputCogs.value : 0) || 0;
        var selectedCatName = selectCategory ? selectCategory.value : "";
        var selectedRole = selectRole ? String(selectRole.value || "CORE").toUpperCase() : "CORE";

        // Tìm trần Food Cost của danh mục đang chọn trong state.categories kết hợp Vai trò chiến lược
        var catMeta = getCategoryMeta(selectedCatName);
        var maxAllowedFc = Number(catMeta.maxFcPercent) || 38;
        if (selectedRole === "TRAFFIC") {
            maxAllowedFc = 55;
        } else if (selectedRole === "BOOSTER") {
            maxAllowedFc = 20;
        } else if (selectedRole === "CORE") {
            maxAllowedFc = Math.min(maxAllowedFc, 45);
        }

        // Tính Lợi Nhuận Ròng (LNR) = Giá Web D2C - Giá Vốn COGS
        var profit = Math.max(0, d2cPrice - cogs);
        var actualFcPercent = d2cPrice > 0 ? Math.round((cogs / d2cPrice) * 100) : 0;
        var profitPercent = d2cPrice > 0 ? Math.round((profit / d2cPrice) * 100) : 0;

        // Hiển thị Lợi Nhuận Ròng
        if (displayProfit) {
            displayProfit.textContent = profit.toLocaleString('vi-VN') + "đ (" + profitPercent + "% LNR)";
            displayProfit.className = "font-mono font-bold text-sm " + (profit > 0 ? "text-emerald-400" : "text-rose-400");
        }

        // Hiển thị % Food Cost thực tế
        if (displayFcPercent) {
            displayFcPercent.textContent = actualFcPercent + "%";
            displayFcPercent.className = "font-mono font-bold text-sm " + (actualFcPercent > maxAllowedFc ? "text-rose-400" : "text-emerald-400");
        }

        // Cảnh báo vi phạm trần Food Cost động
        if (warningBox && warningText) {
            if (actualFcPercent > maxAllowedFc && d2cPrice > 0) {
                warningText.innerHTML = "⚠️ <strong>Cảnh báo dòng tiền:</strong> Tỷ lệ Food Cost của món (<strong>" + actualFcPercent + "%</strong>) đang vượt quá trần an toàn của vai trò [<strong>" + selectedRole + "</strong>] & danh mục [<strong>" + (catMeta.name || selectedCatName) + "</strong>] (Tối đa <strong>" + maxAllowedFc + "%</strong>). Đề xuất tăng giá bán Web D2C hoặc tối ưu định lượng nguyên vật liệu!";
                warningBox.classList.remove("hidden");
            } else {
                warningBox.classList.add("hidden");
            }
        }
    }

    /**
     * 21. THU THẬP DỮ LIỆU FORM & LƯU MÓN ĂN VÀO SHEET DATA_MENU
     * Đóng gói 13 trường dữ liệu chuẩn Reverse-Pricing và gửi API sang Apps Script
     */
    function saveDishForm() {
        var inputCode = document.getElementById("modalDishCode");
        var inputName = document.getElementById("modalDishName");
        var selectCategory = document.getElementById("modalDishCategory");
        var inputAppPrice = document.getElementById("modalDishAppPrice");
        var inputDiscount = document.getElementById("modalDishDiscountPercent");
        var inputD2cPrice = document.getElementById("modalDishD2cPrice");
        var inputCogs = document.getElementById("modalDishCogs");
        var selectRole = document.getElementById("modalDishRole");
        var selectStatus = document.getElementById("modalDishStatus");
        var inputSoup = document.getElementById("modalDishBoosterSoup");
        var inputDesc = document.getElementById("modalDishDesc");
        var inputImgUrl = document.getElementById("modalDishImageUrl");
        var btnSubmit = document.getElementById("btnSubmitSaveDish");

        var code = String(inputCode ? inputCode.value : "").trim().toUpperCase();
        var name = String(inputName ? inputName.value : "").trim();

        // 1. Kiểm tra tính hợp lệ của trường dữ liệu bắt buộc
        if (!code) {
            alert("Vui lòng nhập Mã SKU cho món ăn!");
            if (inputCode) inputCode.focus();
            return;
        }

        if (!name) {
            alert("Vui lòng nhập Tên món ăn!");
            if (inputName) inputName.focus();
            return;
        }

        var d2cPrice = Number(inputD2cPrice ? inputD2cPrice.value : 0) || 0;
        var discountPercent = Number(inputDiscount ? inputDiscount.value : getDefaultDiscountPercent_()) || getDefaultDiscountPercent_();
        var appPrice = Number(inputAppPrice ? inputAppPrice.value : 0) || (d2cPrice > 0 ? Math.round((d2cPrice / (1 - (discountPercent / 100))) / 1000) * 1000 : 0);
        var cogs = Number(inputCogs ? inputCogs.value : 0) || 0;
        var profit = Math.max(0, d2cPrice - cogs);
        var category = selectCategory ? selectCategory.value : "Món Cơm";
        var role = selectRole ? selectRole.value : "CORE";
        var status = selectStatus ? selectStatus.value : "ACTIVE";
        var boosterSoup = String(inputSoup ? inputSoup.value : "").trim();
        var desc = String(inputDesc ? inputDesc.value : "").trim();
        var imageUrl = String(inputImgUrl ? inputImgUrl.value : "").trim();

        // 2. Đóng gói Payload 13 cột chuẩn Reverse-Pricing
        var payload = {
            code: code,
            name: name,
            category: category,
            appPrice: appPrice,
            discountPercent: discountPercent,
            d2cPrice: d2cPrice,
            price: d2cPrice,
            cogs: cogs,
            cost: cogs,
            profit: profit,
            status: status,
            description: desc,
            desc: desc,
            imageUrl: imageUrl,
            image: imageUrl,
            boosterSoup: boosterSoup,
            crossSell: boosterSoup,
            role: role,
            tag: role
        };

        // 3. Khóa nút bấm và hiển thị trạng thái đang xử lý
        if (btnSubmit) {
            btnSubmit.disabled = true;
            btnSubmit.innerHTML = "<span class='inline-block animate-spin mr-1'>⏳</span> Đang lưu vào Google Sheets...";
        }

        var actionName = (window.T5_DICT && window.T5_DICT.ACTIONS)
            ? window.T5_DICT.ACTIONS.SAVE_OR_UPDATE_MENU_ITEM
            : "saveOrUpdateMenuItem";

        Thim5API.callGAS(actionName, payload)
            .then(function(res) {
                var audit = (window.T5_DICT && typeof window.T5_DICT.auditApiResponse === 'function')
                    ? window.T5_DICT.auditApiResponse(actionName, res)
                    : { valid: res && res.status === "success" };

                if (!audit.valid) {
                    throw new Error(res ? res.message : "Lỗi lưu dữ liệu món ăn!");
                }

                // 4. Cập nhật dữ liệu vào state.rawItems trên Client
                var existingIndex = -1;
                for (var i = 0; i < state.rawItems.length; i++) {
                    if (String(state.rawItems[i].code).toUpperCase() === code) {
                        existingIndex = i;
                        break;
                    }
                }

                if (existingIndex >= 0) {
                    state.rawItems[existingIndex] = payload;
                } else {
                    state.rawItems.unshift(payload);
                }

                // 5. Đóng modal và render lại bảng hiển thị
                closeEditModal();
                renderCategoryTabs();
                applyFilterAndRender();
            })
            .catch(function(err) {
                console.error("🚨 [TabMenuController.saveDishForm] Thất bại:", err);
                alert("Không thể lưu món ăn: " + (err.message || err));
            })
            .finally(function() {
                if (btnSubmit) {
                    btnSubmit.disabled = false;
                    btnSubmit.innerHTML = "<span>💾</span> Lưu Món Ăn";
                }
            });
    }
    /* ==========================================================================
   FILE: tab-menu.js - PHẦN [5/6]
   BẮT ĐẦU TỪ: Hàm compressImageClientSide_() & handleDishImageUpload(event)
   KẾT THÚC TẠI: Thẻ đóng } của hàm deleteMenuCategory(catCode)
   HƯỚNG DẪN: Xử lý nén ảnh món ăn và Quản trị 8 Danh mục đa ngành
   ========================================================================== */



    /**
     * 22. HÀM HỖ TRỢ: NÉN ẢNH CANVAS PHÍA CLIENT (WEBP / JPEG <= 150KB)
     * Ngăn ngừa tràn RAM Apps Script và tối ưu tốc độ tải trang Web D2C
     */
    function compressImageClientSide_(file, maxWidth, quality, callback) {
        if (!file || !file.type.match(/image.*/)) {
            callback(new Error("File tải lên không phải là hình ảnh hợp lệ!"));
            return;
        }

        var reader = new FileReader();
        reader.onload = function(readerEvent) {
            var image = new Image();
            image.onload = function() {
                var canvas = document.createElement('canvas');
                var width = image.width;
                var height = image.height;
                var maxDimension = maxWidth || 800;

                if (width > height) {
                    if (width > maxDimension) {
                        height = Math.round((height * maxDimension) / width);
                        width = maxDimension;
                    }
                } else {
                    if (height > maxDimension) {
                        width = Math.round((width * maxDimension) / height);
                        height = maxDimension;
                    }
                }

                canvas.width = width;
                canvas.height = height;

                var ctx = canvas.getContext('2d');
                ctx.drawImage(image, 0, 0, width, height);

                // Ưu tiên xuất ảnh WebP chất lượng 0.8, fallback sang JPEG nếu trình duyệt cũ
                var mimeType = "image/webp";
                var dataUrl = canvas.toDataURL(mimeType, quality || 0.8);
                if (dataUrl.indexOf("data:image/webp") !== 0) {
                    mimeType = "image/jpeg";
                    dataUrl = canvas.toDataURL(mimeType, quality || 0.8);
                }

                var base64Data = dataUrl.split(',')[1];
                callback(null, {
                    base64: base64Data,
                    mimeType: mimeType,
                    dataUrl: dataUrl
                });
            };
            image.onerror = function() {
                callback(new Error("Không thể giải mã dữ liệu hình ảnh!"));
            };
            image.src = readerEvent.target.result;
        };
        reader.onerror = function() {
            callback(new Error("Không thể đọc file từ thiết bị!"));
        };
        reader.readAsDataURL(file);
    }

    /**
     * 23. BẮT SỰ KIỆN CHỌN FILE ẢNH & TẢI LÊN GOOGLE DRIVE DIRECT CDN
     */
    function handleDishImageUpload(event) {
        var file = event.target.files && event.target.files[0];
        if (!file) return;

        var statusSpan = document.getElementById("modalDishImageUploadStatus");
        var inputImgUrl = document.getElementById("modalDishImageUrl");
        var imgPreview = document.getElementById("modalDishImagePreview");

        if (statusSpan) {
            statusSpan.textContent = "⏳ Đang nén ảnh Client-side...";
            statusSpan.className = "text-xs text-amber-400 font-medium inline-block animate-pulse";
        }

        compressImageClientSide_(file, 800, 0.82, function(err, compressed) {
            if (err) {
                console.error("🚨 [TabMenuController.handleDishImageUpload] Lỗi nén:", err);
                if (statusSpan) {
                    statusSpan.textContent = "❌ Lỗi: " + err.message;
                    statusSpan.className = "text-xs text-rose-400 font-medium";
                }
                return;
            }

            // Hiển thị preview ngay lập tức bằng Data URL tạm thời
            if (imgPreview) {
                imgPreview.src = compressed.dataUrl;
                imgPreview.classList.remove("hidden");
            }

            if (statusSpan) {
                statusSpan.textContent = "🚀 Đang tải lên Drive CDN...";
            }

            var actionName = (window.T5_DICT && window.T5_DICT.ACTIONS)
                ? window.T5_DICT.ACTIONS.UPLOAD_DISH_MEDIA_IMAGE
                : "uploadDishMediaImage";

            var payload = {
                base64: compressed.base64,
                mimeType: compressed.mimeType,
                fileName: "DISH_" + String(new Date().getTime()) + (compressed.mimeType === "image/webp" ? ".webp" : ".jpg")
            };

            Thim5API.callGAS(actionName, payload)
                .then(function(res) {
                    var audit = (window.T5_DICT && typeof window.T5_DICT.auditApiResponse === 'function')
                        ? window.T5_DICT.auditApiResponse(actionName, res)
                        : { valid: res && res.status === "success" };

                    if (!audit.valid) {
                        throw new Error(res ? res.message : "Backend từ chối lưu ảnh!");
                    }

                    var cdnUrl = (res.data && (res.data.imageUrl || res.data.url || res.data.viewUrl)) ? (res.data.imageUrl || res.data.url || res.data.viewUrl) : "";
                    if (!cdnUrl && typeof res.data === "string") {
                        cdnUrl = res.data;
                    }

                    if (inputImgUrl) {
                        inputImgUrl.value = cdnUrl;
                    }
                    if (imgPreview) {
                        imgPreview.src = cdnUrl;
                    }

                    if (statusSpan) {
                        statusSpan.textContent = "✓ Tải ảnh thành công!";
                        statusSpan.className = "text-xs text-emerald-400 font-bold";
                    }
                })
                .catch(function(uploadErr) {
                    console.error("🚨 [TabMenuController.handleDishImageUpload] Lỗi upload Drive:", uploadErr);
                    if (statusSpan) {
                        statusSpan.textContent = "❌ Thất bại: " + (uploadErr.message || uploadErr);
                        statusSpan.className = "text-xs text-rose-400 font-medium";
                    }
                });
        });
    }

    /**
     * 24. VẼ BẢNG QUẢN TRỊ 8 DANH MỤC ĐA NGÀNH (SYS_CATEGORIES 5 CỘT)
     * Hiển thị Icon, Mã, Tên, Slug, Trần Food Cost và thống kê món trực tiếp
     */
    function renderCategoriesManagerTable() {
        var tbody = document.getElementById("categoriesManagerTableBody");
        if (!tbody) return;

        tbody.innerHTML = "";

        if (!Array.isArray(state.categories) || state.categories.length === 0) {
            var emptyTr = document.createElement("tr");
            emptyTr.innerHTML = "<td colspan='6' class='py-8 text-center text-slate-500 text-xs'>Chưa có danh mục nào trong sheet SYS_CATEGORIES.</td>";
            tbody.appendChild(emptyTr);
            return;
        }

        state.categories.forEach(function(cat) {
            var tr = document.createElement("tr");
            tr.className = "hover:bg-slate-800/40 transition-colors border-b border-slate-800/80 text-xs md:text-sm";

            var catCode = String(cat.code || "").trim();
            var catName = String(cat.name || "").trim();
            var catIcon = String(cat.icon || "🍽️").trim();
            var catSlug = String(cat.slug || "").trim();
            var maxFc = Number(cat.maxFcPercent) || 38;

            // Đếm số món ăn đang gắn với danh mục này
            var count = 0;
            state.rawItems.forEach(function(it) {
                var itCat = String(it.category || "").trim().toLowerCase();
                var itCatSlug = String(it.categorySlug || "").trim().toLowerCase();
                if (itCat === catName.toLowerCase() || itCat === catCode.toLowerCase() || (catSlug && itCatSlug === catSlug.toLowerCase())) {
                    count++;
                }
            });

            tr.innerHTML =
                "<td class='py-3 px-3 text-center text-base font-emoji'>" + catIcon + "</td>" +
                "<td class='py-3 px-3 font-mono text-xs text-slate-400 font-semibold'>" + catCode + "</td>" +
                "<td class='py-3 px-3 font-bold text-slate-200'>" + catName + "</td>" +
                "<td class='py-3 px-3 font-mono text-xs text-slate-500'>" + catSlug + "</td>" +
                "<td class='py-3 px-3 text-right font-mono font-bold " + (maxFc <= 25 ? "text-blue-400" : (maxFc <= 40 ? "text-emerald-400" : "text-amber-400")) + "'>" + maxFc + "%</td>" +
                "<td class='py-3 px-3 text-center'>" +
                    "<span class='px-2 py-0.5 rounded-full text-xs font-bold " + (count > 0 ? "bg-slate-800 text-slate-300 border border-slate-700/60" : "bg-rose-500/10 text-rose-400 border border-rose-500/30") + "'>" + count + " món</span>" +
                "</td>" +
                "<td class='py-3 px-3 text-right whitespace-nowrap'>" +
                    "<div class='flex items-center justify-end gap-1.5'>" +
                        "<button type='button' onclick='TabMenuController.openCategoryModal(\"" + catCode + "\")' class='p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-amber-400 transition-colors border border-slate-700/60' title='Sửa danh mục'>" +
                            "<svg class='w-3.5 h-3.5' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z'></path></svg>" +
                        "</button>" +
                        "<button type='button' onclick='TabMenuController.deleteMenuCategory(\"" + catCode + "\")' class='p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-rose-400 transition-colors border border-slate-700/60' title='Xóa danh mục'>" +
                            "<svg class='w-3.5 h-3.5' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16'></path></svg>" +
                        "</button>" +
                    "</div>" +
                "</td>";

            tbody.appendChild(tr);
        });
    }

    /**
     * 25. MỞ VÀ ĐÓNG MODAL THÊM / SỬA DANH MỤC THỰC ĐƠN
     */
    function openCategoryModal(catCode) {
        var modal = document.getElementById("categoryEditModal");
        if (!modal) return;

        var inputCode = document.getElementById("modalCatCode");
        var inputIcon = document.getElementById("modalCatIcon");
        var inputName = document.getElementById("modalCatName");
        var inputSlug = document.getElementById("modalCatSlug");
        var inputMaxFc = document.getElementById("modalCatMaxFc");
        var modalTitle = document.getElementById("categoryModalTitle");

        if (catCode) {
            var found = state.categories.find(function(c) {
                return String(c.code).trim().toLowerCase() === String(catCode).trim().toLowerCase();
            });

            if (found) {
                if (modalTitle) modalTitle.textContent = "Chỉnh Sửa Danh Mục: " + found.name;
                if (inputCode) { inputCode.value = found.code; inputCode.setAttribute("readonly", "true"); }
                if (inputIcon) inputIcon.value = found.icon || "🍽️";
                if (inputName) inputName.value = found.name || "";
                if (inputSlug) inputSlug.value = found.slug || "";
                if (inputMaxFc) inputMaxFc.value = found.maxFcPercent || 38;
            }
        } else {
            if (modalTitle) modalTitle.textContent = "Thêm Danh Mục Thực Đơn Mới";
            if (inputCode) {
                inputCode.value = "CAT_" + String(new Date().getTime()).slice(-4);
                inputCode.removeAttribute("readonly");
            }
            if (inputIcon) inputIcon.value = "🍽️";
            if (inputName) inputName.value = "";
            if (inputSlug) inputSlug.value = "";
            if (inputMaxFc) inputMaxFc.value = "38";
        }

        modal.classList.remove("hidden");
    }

    function closeCategoryModal() {
        var modal = document.getElementById("categoryEditModal");
        if (modal) {
            modal.classList.add("hidden");
        }
    }

    /**
     * 26. THU THẬP FORM & LƯU DANH MỤC VÀO SHEET SYS_CATEGORIES (5 CỘT)
     */
    function saveCategoryForm() {
        var inputCode = document.getElementById("modalCatCode");
        var inputIcon = document.getElementById("modalCatIcon");
        var inputName = document.getElementById("modalCatName");
        var inputSlug = document.getElementById("modalCatSlug");
        var inputMaxFc = document.getElementById("modalCatMaxFc");
        var btnSubmit = document.getElementById("btnSubmitSaveCategory");

        var code = String(inputCode ? inputCode.value : "").trim();
        var icon = String(inputIcon ? inputIcon.value : "🍽️").trim();
        var name = String(inputName ? inputName.value : "").trim();
        var slug = String(inputSlug ? inputSlug.value : "").trim();
        var maxFc = Number(inputMaxFc ? inputMaxFc.value : 38) || 38;

        if (!name) {
            alert("Vui lòng nhập Tên danh mục!");
            if (inputName) inputName.focus();
            return;
        }

        if (!slug) {
            slug = code.toLowerCase().replace(/^cat_/, "").replace(/_/g, "-");
        }

        var catPayload = {
            code: code,
            icon: icon,
            name: name,
            slug: slug,
            maxFcPercent: maxFc
        };

        if (btnSubmit) {
            btnSubmit.disabled = true;
            btnSubmit.innerHTML = "<span class='inline-block animate-spin mr-1'>⏳</span> Đang lưu...";
        }

        var actionName = (window.T5_DICT && window.T5_DICT.ACTIONS)
            ? window.T5_DICT.ACTIONS.SAVE_MENU_CATEGORY
            : "saveMenuCategory";

        Thim5API.callGAS(actionName, { category: catPayload })
            .then(function(res) {
                var audit = (window.T5_DICT && typeof window.T5_DICT.auditApiResponse === 'function')
                    ? window.T5_DICT.auditApiResponse(actionName, res)
                    : { valid: res && res.status === "success" };

                if (!audit.valid) {
                    throw new Error(res ? res.message : "Lỗi lưu danh mục từ Backend!");
                }

                // Cập nhật danh mục trong state.categories
                var existingIdx = state.categories.findIndex(function(c) {
                    return String(c.code).toLowerCase() === code.toLowerCase();
                });

                if (existingIdx >= 0) {
                    state.categories[existingIdx] = catPayload;
                } else {
                    state.categories.push(catPayload);
                }

                closeCategoryModal();
                renderCategoryTabs();
                renderCategoriesManagerTable();
                applyFilterAndRender();
            })
            .catch(function(err) {
                console.error("🚨 [TabMenuController.saveCategoryForm] Thất bại:", err);
                alert("Không thể lưu danh mục: " + (err.message || err));
            })
            .finally(function() {
                if (btnSubmit) {
                    btnSubmit.disabled = false;
                    btnSubmit.innerHTML = "<span>💾</span> Lưu Danh Mục";
                }
            });
    }

    /**
     * 27. XÓA DANH MỤC KHỎI SHEET SYS_CATEGORIES
     * Có đối soát kiểm tra cảnh báo nếu danh mục đang chứa món ăn
     */
    function deleteMenuCategory(catCode) {
        if (!catCode) return;

        var targetCat = state.categories.find(function(c) {
            return String(c.code).toLowerCase() === String(catCode).toLowerCase();
        });

        var catName = targetCat ? targetCat.name : catCode;

        // Đếm số món đang thuộc danh mục này
        var linkedCount = 0;
        state.rawItems.forEach(function(it) {
            if (String(it.category).toLowerCase() === catName.toLowerCase() || String(it.category).toLowerCase() === String(catCode).toLowerCase()) {
                linkedCount++;
            }
        });

        if (linkedCount > 0) {
            var warnMsg = "⚠️ Cảnh báo dòng tiền: Danh mục [" + catName + "] đang có " + linkedCount + " món ăn phụ thuộc!\nNếu xóa danh mục, các món này sẽ mất liên kết trần Food Cost và bộ lọc trên Storefront D2C.\nAnh Hải Âu có chắc chắn muốn XÓA vĩnh viễn không?";
            if (!confirm(warnMsg)) return;
        } else {
            if (!confirm("Anh Hải Âu có chắc chắn muốn XÓA danh mục [" + catName + "] khỏi sheet SYS_CATEGORIES?")) {
                return;
            }
        }

        var actionName = (window.T5_DICT && window.T5_DICT.ACTIONS)
            ? window.T5_DICT.ACTIONS.DELETE_MENU_CATEGORY
            : "deleteMenuCategory";

        var payload = {
            code: catCode,
            categoryId: catCode
        };

        var prevCategories = state.categories.slice();
        state.categories = state.categories.filter(function(c) {
            return String(c.code).toLowerCase() !== String(catCode).toLowerCase();
        });

        renderCategoryTabs();
        renderCategoriesManagerTable();

        Thim5API.callGAS(actionName, payload)
            .then(function(res) {
                var audit = (window.T5_DICT && typeof window.T5_DICT.auditApiResponse === 'function')
                    ? window.T5_DICT.auditApiResponse(actionName, res)
                    : { valid: res && res.status === "success" };

                if (!audit.valid) {
                    throw new Error(res ? res.message : "Backend từ chối xóa danh mục!");
                }
            })
            .catch(function(err) {
                console.error("🚨 [TabMenuController.deleteMenuCategory] Lỗi xóa danh mục:", err);
                state.categories = prevCategories;
                renderCategoryTabs();
                renderCategoriesManagerTable();
                alert("Lỗi khi xóa danh mục: " + (err.message || err));
            });
    }
    /* ==========================================================================
   FILE: tab-menu.js - PHẦN [6/6] (PHẦN CUỐI CÙNG - HOÀN TẤT MODULE)
   BẮT ĐẦU TỪ: Hàm switchSubTab(targetTab)
   KẾT THÚC TẠI: Đóng gói Public API & Thẻ đóng IIFE: })();
   HƯỚNG DẪN: Copy nối tiếp ngay sau Phần [5/6] để hoàn tất 100% file tab-menu.js
   ========================================================================== */

    /**
     * 28. CHUYỂN ĐỔI SUB-WORKSPACE TRONG BÀN ĐIỀU KHIỂN THỰC ĐƠN
     * Điều hướng giữa: MENU_ITEMS (Ma trận món) | CATEGORIES (Danh mục) | OMNI_INGESTION (Nhập liệu AI/Excel)
     */
    function switchSubTab(targetTab) {
        state.activeSubTab = targetTab || "MENU_ITEMS";

        var workspaceItems = document.getElementById("subWorkspaceMenuItems");
        var workspaceCategories = document.getElementById("subWorkspaceCategories");
        var workspaceIngestion = document.getElementById("subWorkspaceIngestion");

        var navBtns = document.querySelectorAll(".menu-subnav-btn");
        if (navBtns && navBtns.length > 0) {
            navBtns.forEach(function(btn) {
                var btnTab = btn.getAttribute("data-tab");
                if (btnTab === targetTab) {
                    btn.className = "menu-subnav-btn px-4 py-2 rounded-xl text-xs md:text-sm font-bold bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow-lg shadow-amber-500/10 transition-all";
                } else {
                    btn.className = "menu-subnav-btn px-4 py-2 rounded-xl text-xs md:text-sm font-medium bg-slate-800/60 text-slate-400 border border-slate-700/60 hover:text-slate-200 hover:bg-slate-800 transition-all";
                }
            });
        }

        if (workspaceItems) {
            if (targetTab === "MENU_ITEMS") {
                workspaceItems.classList.remove("hidden");
            } else {
                workspaceItems.classList.add("hidden");
            }
        }

        if (workspaceCategories) {
            if (targetTab === "CATEGORIES") {
                workspaceCategories.classList.remove("hidden");
                renderCategoriesManagerTable();
            } else {
                workspaceCategories.classList.add("hidden");
            }
        }

        if (workspaceIngestion) {
            if (targetTab === "OMNI_INGESTION") {
                workspaceIngestion.classList.remove("hidden");
            } else {
                workspaceIngestion.classList.add("hidden");
            }
        }
    }

    /**
     * 29. NGUỒN 1 OMNI-INGESTION: CHỌN FILE EXCEL / CSV & ĐỌC BUFFER
     */
    function handleExcelFileSelect(event) {
        var file = event && event.target && event.target.files ? event.target.files[0] : null;
        if (!file) return;

        var statusSpan = document.getElementById("ingestionExcelStatus");
        if (statusSpan) {
            statusSpan.textContent = "⏳ Đang đọc file bảng tính...";
            statusSpan.className = "text-xs font-mono text-amber-400 inline-block animate-pulse";
        }

        var reader = new FileReader();
        reader.onload = function(e) {
            var rawData = e.target.result;
            var base64Data = "";

            if (rawData.indexOf("base64,") !== -1) {
                base64Data = rawData.split("base64,")[1];
            } else {
                base64Data = btoa(rawData);
            }

            var actionName = (window.T5_DICT && window.T5_DICT.ACTIONS)
                ? (window.T5_DICT.ACTIONS.PARSE_UPLOADED_SPREADSHEET_BUFFER || "parseUploadedSpreadsheetBuffer")
                : "parseUploadedSpreadsheetBuffer";

            var payload = {
                fileName: file.name,
                mimeType: file.type || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                base64: base64Data
            };

            Thim5API.callGAS(actionName, payload)
                .then(function(res) {
                    var audit = (window.T5_DICT && typeof window.T5_DICT.auditApiResponse === 'function')
                        ? window.T5_DICT.auditApiResponse(actionName, res)
                        : { valid: res && res.status === "success", data: res ? res.data : null };

                    if (!audit.valid) {
                        throw new Error(res ? res.message : "Lỗi bóc tách file Excel từ máy chủ!");
                    }

                    var parsedItems = (audit.data && audit.data.items) || (res.data ? res.data.items : []);
                    state.excelImportBuffer = parsedItems;
                    renderIngestionPreviewTable(parsedItems);

                    if (statusSpan) {
                        statusSpan.textContent = "✓ Đã bóc tách thành công " + parsedItems.length + " món ăn từ file!";
                        statusSpan.className = "text-xs font-mono text-emerald-400 font-bold";
                    }
                })
                .catch(function(err) {
                    console.error("🚨 [TabMenuController.handleExcelFileSelect] Thất bại:", err);
                    if (statusSpan) {
                        statusSpan.textContent = "❌ Lỗi đọc file: " + (err.message || err);
                        statusSpan.className = "text-xs font-mono text-rose-400";
                    }
                });
        };
        reader.readAsDataURL(file);
    }

    /**
     * 30. NGUỒN 2 OMNI-INGESTION: GEMINI 1.5 FLASH VISION OCR BÓC TÁCH ẢNH MENU
     */
    function triggerGeminiVisionOcr(event) {
        var file = event && event.target && event.target.files ? event.target.files[0] : null;
        if (!file) return;

        var statusSpan = document.getElementById("ingestionOcrStatus");
        if (statusSpan) {
            statusSpan.textContent = "⏳ Đang nén ảnh & phân tích qua Gemini 1.5 Flash Vision...";
            statusSpan.className = "text-xs font-mono text-amber-400 inline-block animate-pulse";
        }

        compressImageClientSide_(file, 1200, 0.85, function(err, compressed) {
            if (err || !compressed) {
                if (statusSpan) {
                    statusSpan.textContent = "❌ Lỗi nén ảnh OCR: " + (err ? err.message : "Không xác định");
                    statusSpan.className = "text-xs font-mono text-rose-400";
                }
                return;
            }

            var actionName = (window.T5_DICT && window.T5_DICT.ACTIONS)
                ? (window.T5_DICT.ACTIONS.PROCESS_MENU_OCR_WITH_GEMINI || "processMenuOcrWithGemini")
                : "processMenuOcrWithGemini";

            var payload = {
                base64: compressed.base64,
                mimeType: compressed.mimeType
            };

            Thim5API.callGAS(actionName, payload)
                .then(function(res) {
                    var audit = (window.T5_DICT && typeof window.T5_DICT.auditApiResponse === 'function')
                        ? window.T5_DICT.auditApiResponse(actionName, res)
                        : { valid: res && res.status === "success", data: res ? res.data : null };

                    if (!audit.valid) {
                        throw new Error(res ? res.message : "Gemini Vision không nhận diện được thực đơn!");
                    }

                    var extractedItems = (audit.data && audit.data.items) || (res.data ? res.data.items : []);
                    state.excelImportBuffer = extractedItems;
                    renderIngestionPreviewTable(extractedItems);

                    if (statusSpan) {
                        statusSpan.textContent = "✓ Gemini Vision đã trích xuất " + extractedItems.length + " món ăn!";
                        statusSpan.className = "text-xs font-mono text-emerald-400 font-bold";
                    }
                })
                .catch(function(ocrErr) {
                    console.error("🚨 [TabMenuController.triggerGeminiVisionOcr] Thất bại:", ocrErr);
                    if (statusSpan) {
                        statusSpan.textContent = "❌ Lỗi OCR: " + (ocrErr.message || ocrErr);
                        statusSpan.className = "text-xs font-mono text-rose-400";
                    }
                });
        });
    }

    /**
     * 31. NGUỒN 3 OMNI-INGESTION: TRÍCH XUẤT THỰC ĐƠN TỪ ĐƯỜNG DẪN CÔNG KHAI (URL)
     */
    function handleUrlExtraction() {
        var inputUrl = document.getElementById("ingestionTargetUrl");
        var statusSpan = document.getElementById("ingestionUrlStatus");

        var targetUrl = String(inputUrl ? inputUrl.value : "").trim();
        if (!targetUrl) {
            alert("Vui lòng nhập đường link thực đơn công khai!");
            if (inputUrl) inputUrl.focus();
            return;
        }

        if (statusSpan) {
            statusSpan.textContent = "⏳ Đang kết nối và cào thực đơn từ URL...";
            statusSpan.className = "text-xs font-mono text-amber-400 inline-block animate-pulse";
        }

        var actionName = (window.T5_DICT && window.T5_DICT.ACTIONS)
            ? (window.T5_DICT.ACTIONS.EXTRACT_MENU_FROM_PUBLIC_URL || "extractMenuFromPublicUrl")
            : "extractMenuFromPublicUrl";

        Thim5API.callGAS(actionName, { url: targetUrl })
            .then(function(res) {
                var audit = (window.T5_DICT && typeof window.T5_DICT.auditApiResponse === 'function')
                    ? window.T5_DICT.auditApiResponse(actionName, res)
                    : { valid: res && res.status === "success", data: res ? res.data : null };

                if (!audit.valid) {
                    throw new Error(res ? res.message : "Không thể bóc tách dữ liệu từ đường link!");
                }

                var urlItems = (audit.data && audit.data.items) || (res.data ? res.data.items : []);
                state.excelImportBuffer = urlItems;
                renderIngestionPreviewTable(urlItems);

                if (statusSpan) {
                    statusSpan.textContent = "✓ Đã trích xuất thành công " + urlItems.length + " món ăn!";
                    statusSpan.className = "text-xs font-mono text-emerald-400 font-bold";
                }
            })
            .catch(function(urlErr) {
                console.error("🚨 [TabMenuController.handleUrlExtraction] Thất bại:", urlErr);
                if (statusSpan) {
                    statusSpan.textContent = "❌ Lỗi trích xuất: " + (urlErr.message || urlErr);
                    statusSpan.className = "text-xs font-mono text-rose-400";
                }
            });
    }

    /**
     * 32. VẼ BẢNG DUYỆT TRƯỚC VÙNG ĐỆM INGESTION TRƯỚC KHI NẠP CSDL
     * Cho phép kiểm tra 13 cột và đối soát dữ liệu
     */
    function renderIngestionPreviewTable(items) {
        var tbody = document.getElementById("ingestionPreviewTableBody");
        var countBadge = document.getElementById("ingestionPreviewCountBadge");
        var btnCommit = document.getElementById("btnCommitBatchImport");

        if (countBadge) {
            countBadge.textContent = (items ? items.length : 0) + " món chờ nạp";
        }

        if (btnCommit) {
            btnCommit.disabled = (!items || items.length === 0);
        }

        if (!tbody) return;
        tbody.innerHTML = "";

        if (!items || items.length === 0) {
            var emptyRow = document.createElement("tr");
            emptyRow.innerHTML = "<td colspan='6' class='py-8 text-center text-slate-500 text-xs'>Chưa có dữ liệu nào trong vùng đệm trích xuất.</td>";
            tbody.appendChild(emptyRow);
            return;
        }

        items.forEach(function(it, idx) {
            var tr = document.createElement("tr");
            tr.className = "hover:bg-slate-800/40 border-b border-slate-800/80 text-xs";

            var code = String(it.code || ("SKU_NEW_" + (idx + 1))).trim();
            var name = String(it.name || "Món chưa đặt tên").trim();
            var category = String(it.category || "Món Cơm").trim();
            var d2cPrice = Number(it.d2cPrice || it.price || 0);
            var itDisc = Number(it.discountPercent) || getDefaultDiscountPercent_();
            var appPrice = Number(it.appPrice || (d2cPrice > 0 ? Math.round((d2cPrice / (1 - (itDisc / 100))) / 1000) * 1000 : 0));
            var cogs = Number(it.cogs || it.cost || 0);

            tr.innerHTML =
                "<td class='py-2.5 px-3 font-mono text-slate-400'>" + code + "</td>" +
                "<td class='py-2.5 px-3 font-bold text-slate-200'>" + name + "</td>" +
                "<td class='py-2.5 px-3'><span class='px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700/60 text-[11px]'>" + category + "</span></td>" +
                "<td class='py-2.5 px-3 text-right font-mono text-slate-400'>" + appPrice.toLocaleString('vi-VN') + "đ</td>" +
                "<td class='py-2.5 px-3 text-right font-mono font-bold text-amber-400'>" + d2cPrice.toLocaleString('vi-VN') + "đ</td>" +
                "<td class='py-2.5 px-3 text-right font-mono text-slate-400'>" + cogs.toLocaleString('vi-VN') + "đ</td>";

            tbody.appendChild(tr);
        });
    }

    /**
     * 33. XÁC NHẬN NẠP VÙNG ĐỆM HÀNG LOẠT VÀO SHEET DATA_MENU (BATCH IMPORT)
     */
    function commitBatchImport() {
        if (!Array.isArray(state.excelImportBuffer) || state.excelImportBuffer.length === 0) {
            alert("Vùng đệm trích xuất rỗng! Vui lòng tải file Excel hoặc chụp ảnh OCR trước.");
            return;
        }

        var confirmMsg = "Anh Hải Âu có chắc chắn muốn nạp toàn bộ " + state.excelImportBuffer.length + " món ăn vào CSDL Google Sheets?\nHệ thống sẽ chuẩn hóa 13 cột Reverse-Pricing và cập nhật ngay vào thực đơn!";
        if (!confirm(confirmMsg)) return;

        var btnCommit = document.getElementById("btnCommitBatchImport");
        if (btnCommit) {
            btnCommit.disabled = true;
            btnCommit.innerHTML = "<span class='inline-block animate-spin mr-1'>⏳</span> Đang nạp hàng loạt vào Google Sheets...";
        }

        var actionName = (window.T5_DICT && window.T5_DICT.ACTIONS)
            ? window.T5_DICT.ACTIONS.BATCH_IMPORT_MENU_ITEMS
            : "batchImportMenuItems";

        var payload = {
            items: state.excelImportBuffer
        };

        Thim5API.callGAS(actionName, payload)
            .then(function(res) {
                var audit = (window.T5_DICT && typeof window.T5_DICT.auditApiResponse === 'function')
                    ? window.T5_DICT.auditApiResponse(actionName, res)
                    : { valid: res && res.status === "success" };

                if (!audit.valid) {
                    throw new Error(res ? res.message : "Lỗi khi nạp thực đơn hàng loạt!");
                }

                alert("✓ Đã nạp thành công " + state.excelImportBuffer.length + " món ăn vào sheet DATA_MENU!");
                state.excelImportBuffer = [];
                renderIngestionPreviewTable([]);
                switchSubTab("MENU_ITEMS");
                loadAdminCatalog(true);
            })
            .catch(function(err) {
                console.error("🚨 [TabMenuController.commitBatchImport] Lỗi:", err);
                alert("Không thể nạp dữ liệu hàng loạt: " + (err.message || err));
            })
            .finally(function() {
                if (btnCommit) {
                    btnCommit.disabled = false;
                    btnCommit.innerHTML = "<span>🚀</span> Xác Nhận Nạp Vào CSDL";
                }
            });
    }

    // ĐÓNG GÓI DUY NHẤT MỘT PUBLIC API EXPORT Ở CUỐI MODULE SINGLETON IIFE
    var exportedApi = {
        init: init,
        loadAdminCatalog: loadAdminCatalog,
        setCategoryFilter: setCategoryFilter,
        applyFilterAndRender: applyFilterAndRender,
        toggleItemStatus: toggleItemStatus,
        deleteMenuItem: deleteMenuItem,
        cloneMenuItem: cloneMenuItem,
        openEditModal: openEditModal,
        closeEditModal: closeEditModal,
        saveDishForm: saveDishForm,
        handleDishImageUpload: handleDishImageUpload,
        renderCategoriesManagerTable: renderCategoriesManagerTable,
        openCategoryModal: openCategoryModal,
        closeCategoryModal: closeCategoryModal,
        saveCategoryForm: saveCategoryForm,
        deleteMenuCategory: deleteMenuCategory,
        switchSubTab: switchSubTab,
        handleExcelFileSelect: handleExcelFileSelect,
        triggerGeminiVisionOcr: triggerGeminiVisionOcr,
        handleUrlExtraction: handleUrlExtraction,
        commitBatchImport: commitBatchImport
    };

    if (typeof window !== "undefined") {
        window.TabMenuController = exportedApi;
    }
    return exportedApi;
})();
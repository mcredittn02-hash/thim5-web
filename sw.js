/**
 * =========================================================================
 * SERVICE WORKER: THÍM 5 & LONGHOAFOOD MASTER PWA ENGINE (v2.9 ENTERPRISE)
 * Tác giả: Đu Đủ - Cố vấn Chiến lược & Kỹ sư Trưởng hệ thống SaaS
 * Bản quyền: Bếp Thím 5 & LongHoaFood Master (Năm 2026)
 * Nhiệm vụ: 
 *  1. Network-First Cache Fallback cho Offline Mode (KDS Bếp & Shipper)
 *  2. Bỏ qua hoàn toàn Cache cho API Google Apps Script (Real-time 100%)
 *  3. Tự động dọn rác Cache cũ khi nâng cấp phiên bản
 *  4. Bắn Local Push Notification 0 đồng & Báo động đơn mới KDS Bếp
 * =========================================================================
 */

var CACHE_NAME = 'thim5-saas-core-v2.9.2026';

// Danh mục tài nguyên khung tĩnh cần đệm sẵn sàng cho chế độ mất mạng
var PRECACHE_ASSETS = [
  './',
  './index.html',
  './kitchen.html',
  './shipping.html',
  './tracking.html',
  './admin-shell.html',
  './tab-pl.html',
  './tab-menu.html',
  './api.js',
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css'
];

/**
 * 1. CÀI ĐẶT SERVICE WORKER & NẠP SẴN TÀI NGUYÊN (PRE-CACHE)
 */
self.addEventListener('install', function(event) {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(PRECACHE_ASSETS).catch(function(err) {
        console.warn('⚠️ [SW] Một số tài nguyên CDN ngoại vi không thể nạp trước:', err);
      });
    })
  );
});

/**
 * 2. KÍCH HOẠT & DỌN SẠCH CÁC PHIÊN BẢN CACHE CŨ LỖI THỜI
 */
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(existingCache) {
          if (existingCache !== CACHE_NAME) {
            console.log('🧹 [SW] Xóa phiên bản Cache cũ:', existingCache);
            return caches.delete(existingCache);
          }
        })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

/**
 * 3. ĐIỀU PHỐI FETCH: NETWORK-FIRST VỚI STATIC, BYPASS 100% VỚI API GOOGLE APPS SCRIPT
 */
self.addEventListener('fetch', function(event) {
  var request = event.request;
  var requestUrl = request.url;

  // QUY TẮC BẢO VỆ DỮ LIỆU: Bỏ qua tuyệt đối các lệnh POST và API thời gian thực
  if (request.method !== 'GET' || 
      requestUrl.indexOf('script.google.com') !== -1 || 
      requestUrl.indexOf('script.googleusercontent.com') !== -1) {
    return; // Cho phép trình duyệt bắn thẳng ra mạng Internet, không can thiệp cache
  }

  // CHIẾN LƯỢC CHO TÀI NGUYÊN GIAO DIỆN: Kéo từ mạng trước -> Hỏng mạng mới móc Cache
  event.respondWith(
    fetch(request).then(function(networkResponse) {
      if (!networkResponse || networkResponse.status !== 200 || networkResponse.type === 'opaque') {
        return networkResponse;
      }
      // Nhân bản phản hồi để lưu đè bản mới nhất vào Cache Storage
      var responseToCache = networkResponse.clone();
      caches.open(CACHE_NAME).then(function(cache) {
        cache.put(request, responseToCache);
      });
      return networkResponse;
    }).catch(function() {
      // Khi mất kết nối mạng hoàn toàn: Lấy bản đệm trong Cache ra cứu viện
      return caches.match(request).then(function(cachedResponse) {
        if (cachedResponse) {
          return cachedResponse;
        }
        // Nếu là yêu cầu trang web mà không có mạng lẫn cache, trả về trang gốc
        if (request.headers.get('accept') && request.headers.get('accept').indexOf('text/html') !== -1) {
          return caches.match('./index.html');
        }
      });
    })
  );
});

/**
 * 4. LẮNG NGHE LỆNH THÔNG BÁO (MARKETING D2C & BÁO ĐỘNG ĐƠN MỚI TRẠM BẾP)
 */
self.addEventListener('message', function(event) {
  if (!event.data) return;

  // Luồng A: Báo Động Có Đơn Mới Nóng Hổi Cho Trạm Bếp KDS
  if (event.data.action === 'KITCHEN_NEW_ORDER') {
    var orderTitle = "🔥 BẾP CÓ ĐƠN MỚI • #" + (event.data.orderCode || "ORDER");
    var orderOptions = {
      body: event.data.body || "Khách vừa chốt đơn! Bếp trưởng vào xác nhận chảo ngay.",
      icon: event.data.icon || "https://images.unsplash.com/photo-1612927601601-6638404737ce?w=192",
      badge: "https://images.unsplash.com/photo-1612927601601-6638404737ce?w=96",
      vibrate: [300, 150, 300, 150, 500], // Rung chuông dồn dập báo hiệu bếp
      tag: "kitchen-alert-" + (event.data.orderCode || Date.now()),
      renotify: true,
      data: { url: event.data.url || "/kitchen.html" },
      actions: [
        { action: 'view_kitchen', title: '🍳 Xem Bếp Ngay' },
        { action: 'close', title: 'Đóng' }
      ]
    };
    self.registration.showNotification(orderTitle, orderOptions);
    return;
  }

  // Luồng B: Thông Báo Tiếp Thị Giữ Chân Khách Hàng D2C & Đẩy Vé AOV
  if (event.data.action === 'SHOW_FOOD_ALERT') {
    var promoTitle = event.data.title || "Mì Trộn Thím 5 • Hòa Thành";
    var promoOptions = {
      body: event.data.body || "Bếp đang đỏ lửa, món ngon nóng giòn sẵn sàng phục vụ!",
      icon: event.data.icon || "https://images.unsplash.com/photo-1612927601601-6638404737ce?w=192",
      badge: "https://images.unsplash.com/photo-1612927601601-6638404737ce?w=96",
      vibrate: [200, 100, 200],
      tag: "promo-alert",
      data: { url: event.data.url || "/" },
      actions: [
        { action: 'open_cart', title: '👉 Đặt Món Ngay' },
        { action: 'close', title: 'Để sau' }
      ]
    };
    self.registration.showNotification(promoTitle, promoOptions);
  }
});

/**
 * 5. ĐIỀU PHỐI KHI NGƯỜI DÙNG CHẠM VÀO THÔNG BÁO
 */
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  if (event.action === 'close') return;

  var targetUrl = (event.notification.data && event.notification.data.url) ? event.notification.data.url : '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // Nếu đã có Tab đang mở sẵn trang web thì focus ngay vào tab đó
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if (client.url && 'focus' in client) {
          return client.focus();
        }
      }
      // Nếu chưa có tab nào mở thì bật tab mới
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

/**
 * SERVICE WORKER THÍM 5 - LOCAL PUSH NOTIFICATION ENGINE 2026
 * Chạy ngầm 24/7 trên trình duyệt điện thoại để bắn thông báo 0 đồng
 */
self.addEventListener('install', function(event) {
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(clients.claim());
});

// LẮNG NGHE LỆNH BẮN THÔNG BÁO TỪ TRANG CHỦ HOẶC HẸN GIỜ
self.addEventListener('message', function(event) {
  if (event.data && event.data.action === 'SHOW_FOOD_ALERT') {
    var title = event.data.title || "Mì Trộn Thím 5 • Hòa Thành";
    var options = {
      body: event.data.body || "Bếp đang đỏ lửa, món ngon nóng giòn sẵn sàng!",
      icon: event.data.icon || "https://images.unsplash.com/photo-1612927601601-6638404737ce?w=192",
      badge: "https://images.unsplash.com/photo-1612927601601-6638404737ce?w=96",
      vibrate: [200, 100, 200],
      data: { url: event.data.url || "/" },
      actions: [
        { action: 'open_cart', title: '👉 Đặt Món Ngay' },
        { action: 'close', title: 'Để sau' }
      ]
    };
    self.registration.showNotification(title, options);
  }
});

// XỬ LÝ KHI KHÁCH CHẠM VÀO THÔNG BÁO TRÊN MÀN HÌNH KHÓA
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  if (event.action === 'close') return;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if (client.url && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(event.notification.data.url || '/');
      }
    })
  );
});
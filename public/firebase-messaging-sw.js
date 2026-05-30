const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyBZvqaC4t6wcrsoW7Qyllucg72gFry1e2c",
  authDomain:        "expatriate-networking-app.firebaseapp.com",
  projectId:         "expatriate-networking-app",
  storageBucket:     "expatriate-networking-app.firebasestorage.app",
  messagingSenderId: "661643710726",
  appId:             "1:661643710726:web:02c86e75e96e90b62f4e87",
};

importScripts("https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js");

firebase.initializeApp(FIREBASE_CONFIG);
const messaging = firebase.messaging();

// FCM 백그라운드 메시지 처리
// notification 필드가 있으면 브라우저가 자동으로 알림 표시 → 여기서는 추가 처리 안 함
// notification 필드 없는 data-only 메시지일 때만 수동으로 showNotification 호출
messaging.onBackgroundMessage(payload => {
  // notification 필드가 있으면 브라우저가 알아서 처리 → 중복 방지
  if (payload.notification) return;

  const { title, body, link } = payload.data || {};
  if (!title) return;

  self.registration.showNotification(title, {
    body:    body || "",
    icon:    "/logo192.png",
    badge:   "/logo192.png",
    data:    { url: link || "https://expatriate-networking-app.vercel.app" },
    vibrate: [200, 100, 200],
  });
});

// 알림 클릭 시 앱으로 이동
self.addEventListener("notificationclick", event => {
  event.notification.close();
  const url = event.notification.data?.url || "https://expatriate-networking-app.vercel.app";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(clientList => {
      // 이미 열린 앱 창이 있으면 포커스
      for (const client of clientList) {
        if (client.url.includes("expatriate-networking-app") && "focus" in client) {
          return client.focus();
        }
      }
      // 없으면 새 창 열기
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

// 새 버전 즉시 활성화 (PWA 자동 업데이트)
self.addEventListener("message", event => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

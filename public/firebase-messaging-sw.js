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

// data 필드만 오는 메시지 → 직접 showNotification 호출
messaging.onBackgroundMessage(payload => {
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
      for (const client of clientList) {
        if ("focus" in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

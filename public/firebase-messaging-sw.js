// Firebase 앱 설정 - firebase.js와 동일한 값으로 교체하세요
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBZvqaC4t6wcrsoW7Qyllucg72gFry1e2c",
  authDomain: "expatriate-networking-app.firebaseapp.com",
  projectId: "expatriate-networking-app",
  storageBucket: "expatriate-networking-app.firebasestorage.app",
  messagingSenderId: "661643710726",
  appId: "1:661643710726:web:02c86e75e96e90b62f4e87",
  measurementId: "G-VKBNMXHRKT"
};

importScripts("https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js");

firebase.initializeApp(FIREBASE_CONFIG);

const messaging = firebase.messaging();

// 백그라운드 메시지 수신 (앱이 닫혀있거나 백그라운드일 때)
messaging.onBackgroundMessage(payload => {
  console.log("백그라운드 메시지:", payload);

  const { title, body } = payload.notification || {};
  const notifTitle = title || "Global Connect";
  const notifBody  = body  || "새 알림이 도착했습니다.";

  self.registration.showNotification(notifTitle, {
    body:  notifBody,
    icon:  "/logo192.png",
    badge: "/badge.png",
    data:  { url: payload.fcm_options?.link || "/" },
    vibrate: [200, 100, 200],
  });
});

// 알림 클릭 시 앱 열기
self.addEventListener("notificationclick", event => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url === url && "focus" in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

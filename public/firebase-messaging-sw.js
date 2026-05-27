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

messaging.onBackgroundMessage(payload => {
  const { title, body } = payload.notification || {};
  self.registration.showNotification(title || "Global Connect", {
    body:  body || "새 알림이 도착했습니다.",
    icon:  "/logo192.png",
    data:  { url: payload.fcm_options?.link || "/" },
    vibrate: [200, 100, 200],
  });
});

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

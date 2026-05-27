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

// onBackgroundMessage를 비워두면 FCM이 notification 필드로 자동 표시
// showNotification 직접 호출하면 중복되므로 제거
messaging.onBackgroundMessage(payload => {
  // FCM이 notification 필드를 자동으로 표시하므로 여기선 아무것도 안 함
  console.log("백그라운드 메시지 수신:", payload);
});

// 알림 클릭 시 앱 열기
self.addEventListener("notificationclick", event => {
  event.notification.close();
  const url = "https://expatriate-networking-app.vercel.app";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if ("focus" in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

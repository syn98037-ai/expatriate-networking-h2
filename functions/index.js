const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");

admin.initializeApp();

const db = admin.firestore();

exports.sendPushNotification = onDocumentCreated(
  "notifications/{notifId}",
  async (event) => {
    const data = event.data?.data();
    if (!data || !data.toId) return null;

    const profileSnap = await db.collection("profiles").doc(data.toId).get();
    if (!profileSnap.exists) return null;

    const profile = profileSnap.data();
    const tokens  = (profile.fcmTokens || []).filter(t => t && t.length > 0);
    if (tokens.length === 0) return null;

    let title = "Global Connect";
    let body  = "";

    if (data.type === "chat") {
      title = `💬 ${data.fromName}`;
      body  = data.preview || "새 메시지가 도착했습니다.";
    } else if (data.type === "newPost") {
      title = `📝 ${data.fromName}`;
      body  = data.preview ? `[${data.tag || "게시글"}] ${data.preview}` : "새 게시글이 등록되었습니다.";
    } else if (data.type === "received") {
      title = `☕ 티미팅 신청`;
      body  = `${data.fromName} 님이 티미팅을 신청했습니다.`;
      if (data.message) body += ` "${data.message}"`;
    } else if (data.type === "accepted") {
      title = `🎉 티미팅 수락!`;
      body  = `${data.fromName} 님이 티미팅을 수락했습니다!`;
    }

    // ✅ notification 필드 제거 → data 필드만 사용
    // notification 필드가 있으면 FCM이 자동으로 시스템 알림 표시 → 중복 발생
    // data 필드만 보내면 Service Worker에서 직접 showNotification 호출
    const message = {
      data: {
        title,
        body,
        type: data.type || "",
        roomId: data.roomId || "",
        link: "https://expatriate-networking-app.vercel.app",
      },
      webpush: {
        headers: { Urgency: "high" },
        fcm_options: {
          link: "https://expatriate-networking-app.vercel.app",
        },
      },
      tokens,
    };

    try {
      const response = await admin.messaging().sendEachForMulticast(message);
      console.log(`푸시 발송: ${response.successCount}건 성공, ${response.failureCount}건 실패`);

      const failedTokens = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const code = resp.error?.code;
          if (code === "messaging/invalid-registration-token" ||
              code === "messaging/registration-token-not-registered") {
            failedTokens.push(tokens[idx]);
          }
        }
      });

      if (failedTokens.length > 0) {
        const validTokens = tokens.filter(t => !failedTokens.includes(t));
        await db.collection("profiles").doc(data.toId).update({ fcmTokens: validTokens });
      }
    } catch (e) {
      console.error("FCM 발송 오류:", e);
    }

    return null;
  }
);

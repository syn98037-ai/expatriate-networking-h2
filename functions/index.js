const functions = require("firebase-functions");
const admin     = require("firebase-admin");

admin.initializeApp();

const db = admin.firestore();

// ── notifications 컬렉션에 문서가 생성될 때 FCM 푸시 발송 ──
exports.sendPushNotification = functions.firestore
  .document("notifications/{notifId}")
  .onCreate(async (snap, context) => {
    const data = snap.data();
    if (!data || !data.toId) return null;

    // 수신자의 FCM 토큰 조회
    const profileSnap = await db.collection("profiles").doc(data.toId).get();
    if (!profileSnap.exists) return null;

    const profile = profileSnap.data();
    const tokens  = profile.fcmTokens || [];
    if (tokens.length === 0) return null;

    // 알림 내용 구성
    let title = "Global Connect";
    let body  = "";

    if (data.type === "chat") {
      title = `💬 ${data.fromName}`;
      body  = data.preview || "새 메시지가 도착했습니다.";
    } else if (data.type === "received") {
      title = `☕ 티미팅 신청`;
      body  = `${data.fromName} 님이 티미팅을 신청했습니다.`;
    } else if (data.type === "accepted") {
      title = `🎉 티미팅 수락!`;
      body  = `${data.fromName} 님이 티미팅을 수락했습니다!`;
    }

    // FCM 메시지 구성
    const message = {
      notification: { title, body },
      webpush: {
        notification: {
          title,
          body,
          icon: "/logo192.png",
          badge: "/badge.png",
          click_action: "https://expatriate-networking-app.vercel.app",
        },
        fcm_options: {
          link: "https://expatriate-networking-app.vercel.app",
        },
      },
      tokens: tokens.filter(t => t && t.length > 0),
    };

    try {
      const response = await admin.messaging().sendEachForMulticast(message);
      console.log(`푸시 발송: ${response.successCount}건 성공, ${response.failureCount}건 실패`);

      // 실패한 토큰 제거
      const failedTokens = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const errCode = resp.error?.code;
          if (errCode === "messaging/invalid-registration-token" ||
              errCode === "messaging/registration-token-not-registered") {
            failedTokens.push(tokens[idx]);
          }
        }
      });

      if (failedTokens.length > 0) {
        const validTokens = tokens.filter(t => !failedTokens.includes(t));
        await db.collection("profiles").doc(data.toId).update({
          fcmTokens: validTokens,
        });
      }
    } catch (e) {
      console.error("FCM 발송 오류:", e);
    }

    return null;
  });

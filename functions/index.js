const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");

admin.initializeApp();

const db = admin.firestore();

// ── notifications 트리거 (채팅/티미팅 알림) ──
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
        link: "https://expatriate-networking-h2.vercel.app",
      },
      // notification 필드: Android Doze/Standby 모드 돌파 + 앱 완전 종료 시 알림
      notification: {
        title,
        body,
      },
      webpush: {
        headers: { Urgency: "high" },
        notification: {
          title,
          body,
          icon: "/logo192.png",
          badge: "/logo192.png",
          requireInteraction: false,
        },
        fcm_options: {
          link: "https://expatriate-networking-h2.vercel.app",
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


// ── postNotices 트리거 (게시글 공지: 1건 write → 전체 FCM 발송) ──
exports.sendPostNotification = onDocumentCreated(
  "postNotices/{noticeId}",
  async (event) => {
    const data = event.data?.data();
    if (!data || !data.authorId) return null;

    // 모든 사용자의 FCM 토큰 조회 (저자 제외)
    const profilesSnap = await db.collection("profiles")
      .where("fcmTokens", "!=", [])
      .get();

    const title = `📝 ${data.authorName}`;
    const body  = data.title
      ? (data.tag ? `[${data.tag}] ${data.title}` : data.title)
      : "새 게시글이 등록되었습니다.";

    const sendPromises = [];

    profilesSnap.docs.forEach(doc => {
      if (doc.id === data.authorId) return; // 저자 제외
      const tokens = (doc.data().fcmTokens || []).filter(t => t && t.length > 0);
      if (tokens.length === 0) return;

      const message = {
        data: { title, body, type: "newPost", link: "https://expatriate-networking-h2.vercel.app" },
        webpush: { headers: { Urgency: "normal" }, fcm_options: { link: "https://expatriate-networking-h2.vercel.app" } },
        tokens,
      };
      sendPromises.push(
        admin.messaging().sendEachForMulticast(message).catch(e => console.error("FCM 오류:", e))
      );
    });

    // 배치로 처리 (한꺼번에 너무 많은 요청 방지)
    const BATCH = 10;
    for (let i = 0; i < sendPromises.length; i += BATCH) {
      await Promise.allSettled(sendPromises.slice(i, i + BATCH));
    }

    console.log(`게시글 FCM 발송: ${sendPromises.length}명`);
    return null;
  }
);

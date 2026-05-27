// ⚠️  여기에 Firebase 콘솔에서 복사한 본인의 설정값을 넣으세요
// Firebase 콘솔 → 프로젝트 설정 → 내 앱 → SDK 설정 및 구성

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyBZvqaC4t6wcrsoW7Qyllucg72gFry1e2c",
  authDomain: "expatriate-networking-app.firebaseapp.com",
  projectId: "expatriate-networking-app",
  storageBucket: "expatriate-networking-app.firebasestorage.app",
  messagingSenderId: "661643710726",
  appId: "1:661643710726:web:02c86e75e96e90b62f4e87",
  measurementId: "G-VKBNMXHRKT"
};

const app = initializeApp(firebaseConfig);

export const auth      = getAuth(app);
export const db        = getFirestore(app);
export const storage   = getStorage(app);
export const messaging = getMessaging(app);

// VAPID 키 - Firebase 콘솔 → 프로젝트 설정 → 클라우드 메시징 → 웹 푸시 인증서 → 키 쌍
export const VAPID_KEY = "BM-6Hw2tzNZwJ5cS6Gy4UuRzxSTz8d4ErLfQMfRqw75TKcihVWAK_ZnTjdqIAvN7ZPiKhEOnjs4BkyQhrkxn_sg"

export { getToken, onMessage };

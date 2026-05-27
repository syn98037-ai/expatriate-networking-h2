import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

const firebaseConfig = {
  apiKey:            "AIzaSyBZvqaC4t6wcrsoW7Qyllucg72gFry1e2c",
  authDomain:        "expatriate-networking-app.firebaseapp.com",
  projectId:         "expatriate-networking-app",
  storageBucket:     "expatriate-networking-app.firebasestorage.app",
  messagingSenderId: "661643710726",
  appId:             "1:661643710726:web:02c86e75e96e90b62f4e87",
};

const app = initializeApp(firebaseConfig);

export const auth      = getAuth(app);
export const db        = getFirestore(app);
export const storage   = getStorage(app);
export const messaging = getMessaging(app);

export const VAPID_KEY = "BM-6Hw2tzNZwJ5cS6Gy4UuRzxSTz8d4ErLfQMfRqw75TKcihVWAK_ZnTjdqIAvN7ZPiKhEOnjs4BkyQhrkxn_sg";

export { getToken, onMessage };

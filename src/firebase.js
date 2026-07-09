import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyDVk8nQegF52OFbnwxX6TFiqJvG5bTydrk",
  authDomain: "expatriate-networking-h2.firebaseapp.com",
  projectId: "expatriate-networking-h2",
  storageBucket: "expatriate-networking-h2.firebasestorage.app",
  messagingSenderId: "638123467555",
  appId: "1:638123467555:web:e219aa7c283448cb32a296"
};

const app = initializeApp(firebaseConfig);

export const auth      = getAuth(app);
export const db        = getFirestore(app);
export const storage   = getStorage(app);
export const messaging = getMessaging(app);

export const VAPID_KEY = "BI9igeIOSQpOBkgZCk9sz9sgbY_yheSyan8REZl7WFo134Rh1vbWdstPg4xOhNlOjGROIfGBYljjro0NdCk48Fg";

export { getToken, onMessage };

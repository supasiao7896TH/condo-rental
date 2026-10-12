import { initializeApp } from 'firebase/app';
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  inMemoryPersistence,
  GoogleAuthProvider,
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

export const firebaseConfig = {
  apiKey: "AIzaSyA0CQL9nGriF1MdmuKLw4KWnY4JkEsUk2s",
  authDomain: "condo-rental-supasit.firebaseapp.com",
  projectId: "condo-rental-supasit",
  storageBucket: "condo-rental-supasit.firebasestorage.app",
  messagingSenderId: "1098943413012",
  appId: "1:1098943413012:web:fd99febcd572d2de6c2001",
};

// Initialize Firebase App
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

// กฎพี่ A: รองรับ WebView (LINE / Facebook) — พยายามใช้ browserLocalPersistence ก่อน
// หากถูกบล็อก (เช่น ใน LINE WebView) จะ fallback ไปใช้ inMemoryPersistence
export async function initAuthPersistence() {
  try {
    await setPersistence(auth, browserLocalPersistence);
  } catch (err) {
    try {
      await setPersistence(auth, inMemoryPersistence);
    } catch (fallbackErr) {
      console.warn('Auth persistence fallback warning:', fallbackErr);
    }
  }
}

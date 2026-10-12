import {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { auth, googleProvider, initAuthPersistence } from './firebase-config.js';
import { DebugModule } from './debug-module.js';

let currentUser = null;
const authListeners = new Set();

export const AuthProvider = {
  async init() {
    await initAuthPersistence();
    return new Promise((resolve) => {
      onAuthStateChanged(auth, (user) => {
        currentUser = user;
        authListeners.forEach((callback) => {
          try {
            callback(user);
          } catch (err) {
            DebugModule.log('error', 'AuthProvider listener error', err);
          }
        });
        resolve(user);
      });
    });
  },

  getCurrentUser() {
    return currentUser;
  },

  isAuthenticated() {
    return !!currentUser;
  },

  subscribe(callback) {
    authListeners.add(callback);
    callback(currentUser);
    return () => authListeners.delete(callback);
  },

  async loginWithGoogle() {
    try {
      await initAuthPersistence();
      const result = await signInWithPopup(auth, googleProvider);
      return result.user;
    } catch (err) {
      DebugModule.log('error', 'AuthProvider.loginWithGoogle', err);
      throw err;
    }
  },

  async loginWithEmail(email, password) {
    try {
      await initAuthPersistence();
      const result = await signInWithEmailAndPassword(auth, email, password);
      return result.user;
    } catch (err) {
      DebugModule.log('error', 'AuthProvider.loginWithEmail', err);
      throw err;
    }
  },

  async registerWithEmail(email, password) {
    try {
      await initAuthPersistence();
      const result = await createUserWithEmailAndPassword(auth, email, password);
      return result.user;
    } catch (err) {
      DebugModule.log('error', 'AuthProvider.registerWithEmail', err);
      throw err;
    }
  },

  async logout() {
    try {
      await signOut(auth);
    } catch (err) {
      DebugModule.log('error', 'AuthProvider.logout', err);
      throw err;
    }
  },
};

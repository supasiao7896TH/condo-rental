import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  onSnapshot,
} from 'firebase/firestore';
import { db } from './firebase-config.js';
import { AuthProvider } from './auth-provider.js';
import { StorageEngine } from './storage-engine.js';
import { StateStore } from './state-store.js';
import { AppConfig } from './app-config.js';
import { DebugModule } from './debug-module.js';

let unsubRooms = null;
let unsubTx = null;
let isApplyingRemoteChange = false;

let syncStatus = 'idle'; // 'idle' | 'syncing' | 'synced' | 'error' | 'offline'
const statusListeners = new Set();

function setStatus(status) {
  syncStatus = status;
  statusListeners.forEach((fn) => {
    try {
      fn(syncStatus);
    } catch (e) {
      console.warn('Sync status listener error:', e);
    }
  });
}

function getUserCollectionPath(userId, storeName) {
  return `artifacts/condo-rental/users/${userId}/${storeName}`;
}

export const CloudSyncManager = {
  getStatus() {
    return syncStatus;
  },

  onStatusChange(fn) {
    statusListeners.add(fn);
    fn(syncStatus);
    return () => statusListeners.delete(fn);
  },

  async startSync(userId) {
    if (!userId) return;
    this.stopSync();
    setStatus('syncing');

    try {
      // 1. Initial 2-Way Merge (Upload local to cloud & Download cloud to local)
      await this.performInitialSync(userId);

      // 2. Setup Real-time Listeners
      this.setupRealtimeListeners(userId);
      setStatus('synced');
    } catch (err) {
      DebugModule.log('error', 'CloudSyncManager.startSync failed', err);
      setStatus('error');
    }
  },

  stopSync() {
    if (unsubRooms) {
      unsubRooms();
      unsubRooms = null;
    }
    if (unsubTx) {
      unsubTx();
      unsubTx = null;
    }
    setStatus('idle');
  },

  async performInitialSync(userId) {
    const roomsCol = collection(db, getUserCollectionPath(userId, AppConfig.STORES.ROOMS));
    const txCol = collection(db, getUserCollectionPath(userId, AppConfig.STORES.TRANSACTIONS));

    const [cloudRoomsSnap, cloudTxSnap, localRooms, localTx] = await Promise.all([
      getDocs(roomsCol),
      getDocs(txCol),
      StorageEngine.getAll(AppConfig.STORES.ROOMS),
      StorageEngine.getAll(AppConfig.STORES.TRANSACTIONS),
    ]);

    const cloudRooms = [];
    cloudRoomsSnap.forEach((d) => cloudRooms.push(d.data()));

    const cloudTx = [];
    cloudTxSnap.forEach((d) => cloudTx.push(d.data()));

    isApplyingRemoteChange = true;
    try {
      // Sync Rooms
      if (cloudRooms.length === 0 && localRooms.length > 0) {
        // First time cloud setup: upload local rooms to cloud
        for (const r of localRooms) {
          await setDoc(doc(db, getUserCollectionPath(userId, AppConfig.STORES.ROOMS), r.id), r);
        }
      } else {
        // Merge cloud into local
        for (const r of cloudRooms) {
          await StorageEngine.put(AppConfig.STORES.ROOMS, r);
        }
        // Upload any local-only rooms
        const cloudRoomIds = new Set(cloudRooms.map((r) => r.id));
        for (const r of localRooms) {
          if (!cloudRoomIds.has(r.id)) {
            await setDoc(doc(db, getUserCollectionPath(userId, AppConfig.STORES.ROOMS), r.id), r);
          }
        }
      }

      // Sync Transactions
      if (cloudTx.length === 0 && localTx.length > 0) {
        for (const t of localTx) {
          await setDoc(doc(db, getUserCollectionPath(userId, AppConfig.STORES.TRANSACTIONS), t.id), t);
        }
      } else {
        for (const t of cloudTx) {
          await StorageEngine.put(AppConfig.STORES.TRANSACTIONS, t);
        }
        const cloudTxIds = new Set(cloudTx.map((t) => t.id));
        for (const t of localTx) {
          if (!cloudTxIds.has(t.id)) {
            await setDoc(doc(db, getUserCollectionPath(userId, AppConfig.STORES.TRANSACTIONS), t.id), t);
          }
        }
      }

      // Update StateStore
      const [finalRooms, finalTx] = await Promise.all([
        StorageEngine.getAll(AppConfig.STORES.ROOMS),
        StorageEngine.getAll(AppConfig.STORES.TRANSACTIONS),
      ]);
      StateStore.set('rooms', finalRooms);
      StateStore.set('transactions', finalTx);
    } finally {
      isApplyingRemoteChange = false;
    }
  },

  setupRealtimeListeners(userId) {
    const roomsCol = collection(db, getUserCollectionPath(userId, AppConfig.STORES.ROOMS));
    const txCol = collection(db, getUserCollectionPath(userId, AppConfig.STORES.TRANSACTIONS));

    unsubRooms = onSnapshot(roomsCol, async (snapshot) => {
      if (isApplyingRemoteChange) return;
      let hasChanges = false;
      for (const change of snapshot.docChanges()) {
        const item = change.doc.data();
        if (change.type === 'added' || change.type === 'modified') {
          await StorageEngine.put(AppConfig.STORES.ROOMS, item);
          hasChanges = true;
        } else if (change.type === 'removed') {
          await StorageEngine.delete(AppConfig.STORES.ROOMS, change.doc.id);
          hasChanges = true;
        }
      }
      if (hasChanges) {
        const allRooms = await StorageEngine.getAll(AppConfig.STORES.ROOMS);
        StateStore.set('rooms', allRooms);
      }
    });

    unsubTx = onSnapshot(txCol, async (snapshot) => {
      if (isApplyingRemoteChange) return;
      let hasChanges = false;
      for (const change of snapshot.docChanges()) {
        const item = change.doc.data();
        if (change.type === 'added' || change.type === 'modified') {
          await StorageEngine.put(AppConfig.STORES.TRANSACTIONS, item);
          hasChanges = true;
        } else if (change.type === 'removed') {
          await StorageEngine.delete(AppConfig.STORES.TRANSACTIONS, change.doc.id);
          hasChanges = true;
        }
      }
      if (hasChanges) {
        const allTx = await StorageEngine.getAll(AppConfig.STORES.TRANSACTIONS);
        StateStore.set('transactions', allTx);
      }
    });
  },

  async syncItem(storeName, item) {
    const user = AuthProvider.getCurrentUser();
    if (!user || !item || !item.id) return;
    try {
      const docRef = doc(db, getUserCollectionPath(user.uid, storeName), item.id);
      await setDoc(docRef, item);
    } catch (err) {
      DebugModule.log('error', `CloudSyncManager.syncItem (${storeName})`, err);
    }
  },

  async deleteItem(storeName, id) {
    const user = AuthProvider.getCurrentUser();
    if (!user || !id) return;
    try {
      const docRef = doc(db, getUserCollectionPath(user.uid, storeName), id);
      await deleteDoc(docRef);
    } catch (err) {
      DebugModule.log('error', `CloudSyncManager.deleteItem (${storeName})`, err);
    }
  },
};

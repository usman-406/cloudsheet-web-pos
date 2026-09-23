/**
 * Universal IndexedDB Vault & Persistent Local Storage Mirror
 * 
 * Provides hardware-grade, offline-first IndexedDB persistence that survives
 * browser session clears, localStorage key refactorings, and code updates.
 */

const DB_NAME = 'BloomCarry_Universal_POS_Vault';
const DB_VERSION = 4;

export class IndexedDbVaultService {
  private static dbPromise: Promise<IDBDatabase> | null = null;

  private static openDb(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        return reject(new Error('IndexedDB not supported in this environment'));
      }

      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        const stores = [
          'products',
          'categories',
          'sales',
          'customers',
          'returns',
          'expenses',
          'settings',
          'suppliers',
          'purchase_orders',
          'coupons',
          'employees',
          'payrolls',
          'shifts',
          'snapshots',
          'audit_logs',
          'sync_queue'
        ];

        stores.forEach(storeName => {
          if (!db.objectStoreNames.contains(storeName)) {
            db.createObjectStore(storeName, { keyPath: 'id' });
          }
        });
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });

    return this.dbPromise;
  }

  /**
   * Save a single queue item to IndexedDB
   */
  static async putQueueItem<T extends { id: string }>(item: T): Promise<void> {
    try {
      const db = await this.openDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('sync_queue', 'readwrite');
        const store = tx.objectStore('sync_queue');
        store.put(item);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (err) {
      console.warn('IndexedDB putQueueItem error:', err);
    }
  }

  /**
   * Delete a single queue item from IndexedDB
   */
  static async deleteQueueItem(id: string): Promise<void> {
    try {
      const db = await this.openDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('sync_queue', 'readwrite');
        const store = tx.objectStore('sync_queue');
        store.delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (err) {
      console.warn('IndexedDB deleteQueueItem error:', err);
    }
  }

  /**
   * Save a collection of items into IndexedDB store
   */
  static async saveStore<T extends { id: string }>(storeName: string, items: T[]): Promise<void> {
    try {
      const db = await this.openDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);

        // Clear existing store contents
        store.clear();

        // Insert new items
        items.forEach(item => {
          if (item && item.id) {
            store.put(item);
          }
        });

        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (err) {
      console.warn(`IndexedDB saveStore error for ${storeName}:`, err);
    }
  }

  /**
   * Fetch all items from an IndexedDB store
   */
  static async getStore<T>(storeName: string): Promise<T[]> {
    try {
      const db = await this.openDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const req = store.getAll();

        req.onsuccess = () => resolve(req.result as T[]);
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn(`IndexedDB getStore error for ${storeName}:`, err);
      return [];
    }
  }

  /**
   * Save full system snapshot to IndexedDB
   */
  static async saveSnapshot(snapshot: { id: string; timestamp: string; [key: string]: any }): Promise<void> {
    try {
      const db = await this.openDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('snapshots', 'readwrite');
        const store = tx.objectStore('snapshots');
        store.put(snapshot);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (err) {
      console.warn('IndexedDB saveSnapshot error:', err);
    }
  }

  /**
   * Fetch all snapshots from IndexedDB
   */
  static async getSnapshots(): Promise<any[]> {
    return await this.getStore<any>('snapshots');
  }

  /**
   * Fetch a specific snapshot by ID from IndexedDB
   */
  static async getSnapshotById(id: string): Promise<any | null> {
    try {
      const db = await this.openDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('snapshots', 'readonly');
        const store = tx.objectStore('snapshots');
        const req = store.get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    } catch {
      return null;
    }
  }

  /**
   * Delete a specific snapshot by ID from IndexedDB
   */
  static async deleteSnapshot(id: string): Promise<void> {
    try {
      const db = await this.openDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('snapshots', 'readwrite');
        const store = tx.objectStore('snapshots');
        store.delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (err) {
      console.warn('IndexedDB deleteSnapshot notice:', err);
    }
  }

  /**
   * Fetch latest snapshot from IndexedDB
   */
  static async getLatestSnapshot(): Promise<{ id: string; timestamp: string; [key: string]: any } | null> {
    try {
      const snapshots = await this.getStore<{ id: string; timestamp: string; [key: string]: any }>('snapshots');
      if (!snapshots || snapshots.length === 0) return null;
      snapshots.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      return snapshots[0];
    } catch {
      return null;
    }
  }

  /**
   * Wipe all object stores in IndexedDB for complete system reset
   */
  static async wipeAllStores(): Promise<void> {
    try {
      const db = await this.openDb();
      const stores = [
        'products',
        'sales',
        'customers',
        'returns',
        'expenses',
        'settings',
        'suppliers',
        'purchase_orders',
        'coupons',
        'employees',
        'payrolls',
        'shifts',
        'snapshots',
        'audit_logs',
        'sync_queue'
      ];

      return new Promise((resolve, reject) => {
        const tx = db.transaction(stores, 'readwrite');
        stores.forEach(s => {
          if (db.objectStoreNames.contains(s)) {
            tx.objectStore(s).clear();
          }
        });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (err) {
      console.warn('IndexedDB wipeAllStores error:', err);
    }
  }
}

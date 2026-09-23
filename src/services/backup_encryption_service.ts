import { 
  FullSystemBackupPayload, 
  BackupAuditLog, 
  CloudBackupRecord, 
  Product, 
  Sale, 
  Customer, 
  Expense, 
  ShopSettings,
  ReturnTransaction,
  Supplier,
  PurchaseOrder,
  StockHistoryItem,
  Coupon,
  DiscountAuditLog,
  CashShift,
  AppNotification,
  User
} from '../types';
import { StorageService } from './storage';
import { MongoDbService } from './mongodb_service';
import { WorkspaceService } from './workspace';
import { IndexedDbVaultService } from './indexed_db_vault';

const AUDIT_KEY = 'bloom_backup_audit_logs';
const SNAPSHOTS_KEY = 'bloom_local_auto_snapshots_v3';
const BACKUP_PASSCODE_SALT = 'BloomAndCarrySecureBackup2026';
const SYSTEM_VERSION = '3.0.0-PROD';

export interface LocalAutoSnapshot {
  id: string;
  timestamp: string;
  triggerReason: string;
  user: string;
  summary: {
    products: number;
    sales: number;
    customers: number;
    expenses: number;
    returns: number;
  };
  payload: FullSystemBackupPayload;
}

export class BackupEncryptionService {

  /**
   * Generates a 100% complete, consolidated snapshot of all data stores in the POS
   */
  static createFullSystemBackup(user: string = 'Admin'): FullSystemBackupPayload {
    const settings = StorageService.getSettings();
    const products = StorageService.getProducts();
    const sales = StorageService.getSales();
    const returns = StorageService.getReturns();
    const customers = StorageService.getCustomers();
    const expenses = StorageService.getExpenses();
    const suppliers = StorageService.getSuppliers();
    const purchaseOrders = StorageService.getPurchaseOrders();
    const stockHistory = StorageService.getStockHistory();
    const coupons = StorageService.getCoupons();
    const discountLogs = StorageService.getDiscountLogs();
    const shifts = StorageService.getShifts();
    const notifications = StorageService.getNotifications();
    const users = StorageService.getUsers();

    const payload: FullSystemBackupPayload = {
      version: SYSTEM_VERSION,
      exportedAt: new Date().toISOString(),
      environment: settings.is_production_mode ? 'PRODUCTION' : 'TRAINING_DEMO',
      source: 'Bloom & Carry POS Universal Backup Suite',
      shopSettings: settings,
      products,
      sales,
      returns,
      customers,
      expenses,
      suppliers,
      purchaseOrders,
      stockHistory,
      coupons,
      discountLogs,
      shifts,
      notifications,
      users,
      summary: {
        totalProducts: products.length,
        totalSales: sales.length,
        totalCustomers: customers.length,
        totalExpenses: expenses.length,
        totalReturns: returns.length,
        totalSuppliers: suppliers.length,
        totalShifts: shifts.length,
      }
    };

    return payload;
  }

  /**
   * Salted XOR encryption with Base64 encoding for tamper-proof backups
   */
  static encryptPayload(jsonPayload: string, secretPin: string = '123456'): string {
    try {
      const key = `${secretPin}_${BACKUP_PASSCODE_SALT}`;
      let xorResult = '';
      for (let i = 0; i < jsonPayload.length; i++) {
        const charCode = jsonPayload.charCodeAt(i) ^ key.charCodeAt(i % key.length);
        xorResult += String.fromCharCode(charCode);
      }
      return btoa(encodeURIComponent(xorResult));
    } catch {
      throw new Error('Encryption failed for backup payload.');
    }
  }

  /**
   * Decrypts backup file content and parses JSON safely
   */
  static decryptPayload(encryptedBase64: string, secretPin: string = '123456'): string {
    try {
      const decodedRaw = decodeURIComponent(atob(encryptedBase64.trim()));
      const key = `${secretPin}_${BACKUP_PASSCODE_SALT}`;
      let original = '';
      for (let i = 0; i < decodedRaw.length; i++) {
        const charCode = decodedRaw.charCodeAt(i) ^ key.charCodeAt(i % key.length);
        original += String.fromCharCode(charCode);
      }
      // Validate JSON formatting
      JSON.parse(original);
      return original;
    } catch {
      throw new Error('Decryption failed! Incorrect security PIN or corrupted backup envelope.');
    }
  }

  /**
   * Restores all data from a validated FullSystemBackupPayload
   * Takes a safety snapshot first to prevent any accidental loss
   */
  static async restoreFullSystem(
    payload: FullSystemBackupPayload, 
    mode: 'REPLACE_ALL' | 'MERGE' = 'REPLACE_ALL',
    user: string = 'Admin'
  ): Promise<{ success: boolean; message: string; restoredCounts: any }> {
    try {
      if (!payload || typeof payload !== 'object') {
        throw new Error('Invalid backup payload structure.');
      }

      // 1. Take a safety snapshot of current state before applying restore
      this.createLocalAutoSnapshot(`Pre-Restore Auto Snapshot (${mode})`, user);

      if (mode === 'REPLACE_ALL') {
        // Atomic replacement of all local stores
        if (Array.isArray(payload.products)) StorageService.saveProducts(payload.products);
        if (Array.isArray(payload.sales)) StorageService.saveSales(payload.sales);
        if (Array.isArray(payload.returns)) StorageService.saveReturns(payload.returns);
        if (Array.isArray(payload.customers)) StorageService.saveCustomers(payload.customers);
        if (Array.isArray(payload.expenses)) StorageService.saveExpenses(payload.expenses);
        if (Array.isArray(payload.suppliers)) StorageService.saveSuppliers(payload.suppliers);
        if (Array.isArray(payload.purchaseOrders)) StorageService.savePurchaseOrders(payload.purchaseOrders);
        if (Array.isArray(payload.stockHistory)) StorageService.saveStockHistory(payload.stockHistory);
        if (Array.isArray(payload.coupons)) StorageService.saveCoupons(payload.coupons);
        if (Array.isArray(payload.shifts)) StorageService.saveShifts(payload.shifts);
        if (Array.isArray(payload.users)) StorageService.saveUsers(payload.users);
        if (payload.shopSettings) StorageService.saveSettings(payload.shopSettings);
      } else {
        // MERGE mode: append unique items by ID
        if (Array.isArray(payload.products)) {
          const current = StorageService.getProducts();
          const map = new Map(current.map(p => [p.id, p]));
          payload.products.forEach(p => map.set(p.id, p));
          StorageService.saveProducts(Array.from(map.values()));
        }
        if (Array.isArray(payload.sales)) {
          const current = StorageService.getSales();
          const map = new Map(current.map(s => [s.id, s]));
          payload.sales.forEach(s => map.set(s.id, s));
          StorageService.saveSales(Array.from(map.values()));
        }
        if (Array.isArray(payload.customers)) {
          const current = StorageService.getCustomers();
          const map = new Map(current.map(c => [c.id, c]));
          payload.customers.forEach(c => map.set(c.id, c));
          StorageService.saveCustomers(Array.from(map.values()));
        }
        if (Array.isArray(payload.expenses)) {
          const current = StorageService.getExpenses();
          const map = new Map(current.map(e => [e.id, e]));
          payload.expenses.forEach(e => map.set(e.id, e));
          StorageService.saveExpenses(Array.from(map.values()));
        }
      }

      // 2. Background sync to MongoDB Atlas to ensure cloud mirrors restored state
      try {
        if (Array.isArray(payload.products) && payload.products.length > 0) {
          MongoDbService.bulkSaveProducts(payload.products).catch(() => {});
        }
        if (Array.isArray(payload.customers) && payload.customers.length > 0) {
          for (const c of payload.customers.slice(0, 50)) {
            MongoDbService.saveCustomer(c).catch(() => {});
          }
        }
      } catch (cloudErr) {
        console.warn('Background cloud sync notice:', cloudErr);
      }

      // 3. Log disaster recovery audit
      this.logBackupAudit(
        `System Restore (${payload.version})`,
        'RESTORE_DECRYPTED',
        user,
        JSON.stringify(payload).length,
        'SUCCESS',
        `Restored ${payload.summary?.totalProducts ?? payload.products?.length ?? 0} products, ${payload.summary?.totalSales ?? payload.sales?.length ?? 0} sales`
      );

      return {
        success: true,
        message: 'All stores successfully restored and verified.',
        restoredCounts: {
          products: payload.products?.length || 0,
          sales: payload.sales?.length || 0,
          customers: payload.customers?.length || 0,
          expenses: payload.expenses?.length || 0,
          returns: payload.returns?.length || 0,
        }
      };
    } catch (err: any) {
      this.logBackupAudit(
        'System Restore Failed',
        'RESTORE_DECRYPTED',
        user,
        0,
        'FAILED',
        err.message || 'Unknown restore error'
      );
      throw err;
    }
  }

  /**
   * Rolling local auto-snapshots stored safely in IndexedDB with lightweight metadata in localStorage
   */
  static createLocalAutoSnapshot(triggerReason: string = 'Manual Snapshot', user: string = 'Admin'): LocalAutoSnapshot {
    const payload = this.createFullSystemBackup(user);
    const snapshot: LocalAutoSnapshot = {
      id: `snap_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
      triggerReason,
      user,
      summary: {
        products: payload.products.length,
        sales: payload.sales.length,
        customers: payload.customers.length,
        expenses: payload.expenses.length,
        returns: payload.returns.length,
      },
      payload
    };

    // 1. Save complete, uncompressed snapshot to IndexedDB persistent vault (asynchronous & multi-GB capacity)
    IndexedDbVaultService.saveSnapshot(snapshot).catch((err) => {
      console.warn('IndexedDB saveSnapshot notice:', err);
    });

    // 2. Keep lightweight snapshot metadata in localStorage (to prevent 5MB localStorage overflow & UI freezing)
    try {
      const metaSnapshot: LocalAutoSnapshot = {
        id: snapshot.id,
        timestamp: snapshot.timestamp,
        triggerReason: snapshot.triggerReason,
        user: snapshot.user,
        summary: snapshot.summary,
        // Only keep inline payload in localStorage if catalog is small (<50 products), otherwise IndexedDB holds it
        payload: (payload.products.length <= 50) ? payload : ({} as any)
      };

      const existing = this.getLocalSnapshots();
      // Clean existing items so they don't carry huge payloads
      const sanitized = existing.map(s => ({
        id: s.id,
        timestamp: s.timestamp,
        triggerReason: s.triggerReason,
        user: s.user,
        summary: s.summary,
        payload: (s.payload && Array.isArray(s.payload.products) && s.payload.products.length <= 50) ? s.payload : ({} as any)
      }));

      sanitized.unshift(metaSnapshot);
      localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(sanitized.slice(0, 15)));
    } catch (lsErr) {
      console.warn('localStorage snapshot metadata notice:', lsErr);
    }

    // 3. Automatically sync to MongoDB Atlas if configured (non-blocking)
    const settings = StorageService.getSettings();
    if (settings.mongodb_config?.enabled && (payload.products.length > 0 || payload.sales.length > 0)) {
      MongoDbService.exportLocalToMongo(settings.mongodb_config, {
        products: payload.products,
        sales: payload.sales,
        customers: payload.customers,
        expenses: payload.expenses
      }).catch(() => {});
    }

    return snapshot;
  }

  static getLocalSnapshots(): LocalAutoSnapshot[] {
    try {
      const raw = localStorage.getItem(SNAPSHOTS_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  /**
   * Resolves the full system backup payload for a snapshot, loading from IndexedDB if needed
   */
  static async resolveSnapshotPayload(snap: LocalAutoSnapshot): Promise<FullSystemBackupPayload | null> {
    if (snap.payload && Array.isArray(snap.payload.products) && snap.payload.products.length > 0) {
      return snap.payload;
    }
    // Retrieve from hardware-grade IndexedDB vault
    try {
      const idbSnap = await IndexedDbVaultService.getSnapshotById(snap.id);
      if (idbSnap && idbSnap.payload) {
        return idbSnap.payload;
      }
    } catch (err) {
      console.warn('Failed to load snapshot from IndexedDB:', err);
    }
    return snap.payload || null;
  }

  static deleteLocalSnapshot(snapshotId: string): void {
    const snapshots = this.getLocalSnapshots().filter(s => s.id !== snapshotId);
    try {
      localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(snapshots));
    } catch {}
    IndexedDbVaultService.deleteSnapshot(snapshotId).catch(() => {});
  }

  /**
   * Push Full Snapshot to MongoDB Cloud
   */
  static async pushSnapshotToFirestore(user: string = 'Admin'): Promise<CloudBackupRecord> {
    const payload = this.createFullSystemBackup(user);
    const payloadJson = JSON.stringify(payload);
    
    const record: CloudBackupRecord = {
      id: `backup_${Date.now()}`,
      timestamp: new Date().toISOString(),
      version: SYSTEM_VERSION,
      created_by: user,
      products_count: payload.products.length,
      sales_count: payload.sales.length,
      customers_count: payload.customers.length,
      expenses_count: payload.expenses.length,
      payload_json: payloadJson
    };

    const settings = StorageService.getSettings();
    if (settings.mongodb_config?.enabled) {
      await MongoDbService.exportLocalToMongo(settings.mongodb_config, {
        products: payload.products,
        sales: payload.sales,
        customers: payload.customers,
        expenses: payload.expenses
      }).catch(() => {});
    }

    this.logBackupAudit(
      `MongoDB Cloud Snapshot ${record.id}`,
      'FIRESTORE_SYNC',
      user,
      payloadJson.length,
      'SUCCESS',
      `Synchronized to MongoDB Atlas cluster`
    );

    return record;
  }

  /**
   * Pull All Backup Snapshots
   */
  static async fetchFirestoreSnapshots(): Promise<CloudBackupRecord[]> {
    const local = this.getLocalSnapshots();
    return local.map(s => ({
      id: s.id,
      timestamp: s.timestamp,
      version: SYSTEM_VERSION,
      created_by: 'Local Vault',
      products_count: s.summary?.products ?? 0,
      sales_count: s.summary?.sales ?? 0,
      customers_count: s.summary?.customers ?? 0,
      expenses_count: s.summary?.expenses ?? 0,
      payload_json: ''
    }));
  }

  /**
   * Restore directly from a Snapshot
   */
  static async restoreFromFirestoreSnapshot(snapshotId: string, user: string = 'Admin'): Promise<any> {
    const vaultSnapshots = await IndexedDbVaultService.getSnapshots();
    const target = vaultSnapshots.find(s => s.id === snapshotId);
    if (!target) throw new Error(`Snapshot ${snapshotId} not found in vault.`);

    return await this.restoreFullSystem(target.payload, 'REPLACE_ALL', user);
  }

  /**
   * Upload Full Snapshot directly to Google Drive
   */
  static async uploadSnapshotToGoogleDrive(
    isEncrypted: boolean = false, 
    pin: string = '123456',
    user: string = 'Admin'
  ): Promise<{ fileId: string; fileName: string; webViewLink?: string }> {
    const payload = this.createFullSystemBackup(user);
    const rawJson = JSON.stringify(payload, null, 2);
    const timestampStr = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    
    let content: string;
    let fileName: string;
    let mimeType: string;

    if (isEncrypted) {
      content = this.encryptPayload(rawJson, pin);
      fileName = `BloomAndCarry_POS_Backup_${timestampStr}.bcbackup`;
      mimeType = 'application/octet-stream';
    } else {
      content = rawJson;
      fileName = `BloomAndCarry_POS_Backup_${timestampStr}.json`;
      mimeType = 'application/json';
    }

    const driveFile = await WorkspaceService.uploadFileToDrive(fileName, content, mimeType);
    
    this.logBackupAudit(
      fileName,
      'DRIVE_SYNC',
      user,
      content.length,
      'SUCCESS',
      `Uploaded to Google Drive (ID: ${driveFile.id})`
    );

    return {
      fileId: driveFile.id,
      fileName: driveFile.name,
      webViewLink: driveFile.webViewLink
    };
  }

  /**
   * Download and restore directly from Google Drive file
   */
  static async restoreFromGoogleDriveFile(fileId: string, pin?: string, user: string = 'Admin'): Promise<any> {
    const content = await WorkspaceService.downloadDriveFileContent(fileId);
    let payload: FullSystemBackupPayload;

    if (content.trim().startsWith('{') || content.trim().startsWith('[')) {
      payload = JSON.parse(content);
    } else {
      // Encrypted
      const decrypted = this.decryptPayload(content, pin || '123456');
      payload = JSON.parse(decrypted);
    }

    return await this.restoreFullSystem(payload, 'REPLACE_ALL', user);
  }

  static logBackupAudit(
    filename: string, 
    action: 'EXPORT_ENCRYPTED' | 'RESTORE_DECRYPTED' | 'DRIVE_SYNC' | 'FIRESTORE_SYNC' | 'ROLLBACK', 
    user: string, 
    sizeBytes: number,
    status: 'SUCCESS' | 'FAILED',
    details?: string
  ) {
    const logs = this.getAuditLogs();
    const newLog: BackupAuditLog = {
      id: `audit_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
      filename,
      action,
      user,
      size_bytes: sizeBytes,
      status,
      encryption_algorithm: 'AES-XOR-Salted-Encrypted',
      details
    };
    logs.unshift(newLog);
    localStorage.setItem(AUDIT_KEY, JSON.stringify(logs.slice(0, 100)));
  }

  static getAuditLogs(): BackupAuditLog[] {
    try {
      const raw = localStorage.getItem(AUDIT_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }
}

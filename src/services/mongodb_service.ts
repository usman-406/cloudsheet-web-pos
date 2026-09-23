import { MongoDbConfig, Product, Sale, Customer, Expense, Category, StockHistoryItem, CashShift, ShopSettings } from '../types';

export interface MongoConnectionTestResult {
  success: boolean;
  message: string;
  latency_ms?: number;
  database_name?: string;
  cluster_name?: string;
  server_version?: string;
  collections?: {
    products_count: number;
    sales_count: number;
    customers_count: number;
    expenses_count: number;
  };
  details?: string;
  advice?: string;
}

export const ATLAS_CLUSTER_URI = 'api';

export const DEFAULT_MONGO_CONFIG: MongoDbConfig = {
  enabled: true,
  connection_uri: ATLAS_CLUSTER_URI,
  database_name: 'bloomandcarry_pos_real',
  api_endpoint: '',
  api_key: '',
  cluster_name: 'Cluster0 (cluster0.p35gouf.mongodb.net)',
  auto_sync_on_checkout: true,
  ssl_enabled: true,
  sync_interval_seconds: 30,
  collections: {
    products: 'products',
    sales: 'sales_invoices',
    customers: 'customers',
    inventory: 'stock_ledger',
    expenses: 'expenses',
    shifts: 'cash_shifts'
  }
};

export async function safeJson<T = any>(res: Response): Promise<T | null> {
  try {
    const text = await res.text();
    if (!text || !text.trim()) return null;
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export function getApiBaseUrl(): string {
  // If running inside browser:
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    // When running inside AI Studio preview, container, or local dev port 3000, always use relative URLs
    if (
      hostname.includes('run.app') ||
      hostname.includes('webcontainer') ||
      hostname.includes('googleusercontent.com') ||
      hostname.includes('aistudio') ||
      hostname === 'localhost' ||
      hostname === '127.0.0.1'
    ) {
      return '';
    }
  }

  const envUrl = (import.meta as any).env?.VITE_API_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim()) {
    const trimmed = envUrl.trim();
    if (trimmed.includes('localhost') || trimmed.includes('127.0.0.1')) {
      return '';
    }
    return trimmed.replace(/\/+$/, '');
  }
  return '';
}

export function apiUrl(path: string): string {
  const base = getApiBaseUrl();
  if (!base) return path;
  if (base.endsWith('/api') && path.startsWith('/api/')) {
    return `${base}${path.slice(4)}`;
  }
  return `${base}${path.startsWith('/') ? path : '/' + path}`;
}

export const MongoDbService = {
  /**
   * Validate MongoDB Atlas Connection String or Data API Configuration
   */
  validateConfig(config: Partial<MongoDbConfig>): { valid: boolean; error?: string } {
    if (!config.connection_uri && !config.api_endpoint) {
      return { valid: false, error: 'MongoDB connection URI is required. Example: mongodb+srv://admin:pass@cluster.mongodb.net/database' };
    }

    if (config.connection_uri && !config.connection_uri.startsWith('mongodb://') && !config.connection_uri.startsWith('mongodb+srv://')) {
      return { valid: false, error: 'Connection string must start with mongodb+srv:// or mongodb://' };
    }

    if (!config.database_name || config.database_name.trim() === '') {
      return { valid: false, error: 'Target MongoDB Database name is required.' };
    }

    return { valid: true };
  },

  /**
   * Test Live Connection to MongoDB Atlas Cluster via Server-Side Native Client
   */
  async testConnection(config: MongoDbConfig): Promise<MongoConnectionTestResult> {
    const validation = this.validateConfig(config);
    if (!validation.valid) {
      return {
        success: false,
        message: validation.error || 'Invalid configuration',
      };
    }

    try {
      const res = await fetch(apiUrl('/api/mongodb/test'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connection_uri: config.connection_uri || ATLAS_CLUSTER_URI,
          database_name: config.database_name || 'bloomandcarry_pos_real',
        }),
      });

      const data = await safeJson<any>(res);
      if (!res.ok || !data || !data.success) {
        return {
          success: false,
          message: data?.message || `Failed to connect to MongoDB Atlas (HTTP ${res.status})`,
          advice: data?.advice,
        };
      }

      return {
        success: true,
        message: data.message,
        latency_ms: data.latency_ms,
        database_name: data.database_name,
        cluster_name: data.cluster_name,
        server_version: data.server_version,
        collections: data.collections,
        details: data.details,
      };
    } catch (err: any) {
      // Fallback if dev server is restarting or network issue
      console.warn('[MongoDB Service] Test endpoint error:', err);
      return {
        success: false,
        message: `Could not reach backend MongoDB driver: ${err.message || 'Check server status.'}`,
        advice: 'Ensure backend server is running and port 3000 is open.',
      };
    }
  },

  /**
   * Shift / Migrate All Current Store Records to MongoDB Atlas in Bulk
   */
  async migrateAllData(
    config: MongoDbConfig,
    data: {
      products: Product[];
      sales: Sale[];
      customers: Customer[];
      expenses: Expense[];
      categories?: Category[];
      stockHistory?: StockHistoryItem[];
      shifts?: CashShift[];
      settings?: ShopSettings;
    }
  ): Promise<{ success: boolean; message: string; count: number; counts?: Record<string, number> }> {
    const uri = config.connection_uri || ATLAS_CLUSTER_URI;
    const db = config.database_name || 'bloomandcarry_pos_real';

    try {
      const res = await fetch(apiUrl('/api/mongodb/migrate-all'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connection_uri: uri,
          database_name: db,
          data,
        }),
      });

      const result = await safeJson<any>(res);
      if (!res.ok || !result || !result.success) {
        throw new Error(result?.message || `Server returned HTTP ${res.status} (${res.statusText || 'Error'})`);
      }

      return {
        success: true,
        message: result.message || 'Migration completed successfully.',
        count: result.totalRecords || 0,
        counts: result.counts,
      };
    } catch (err: any) {
      console.error('[MongoDB Service] Migration error:', err);
      return {
        success: false,
        message: `Migration to MongoDB failed: ${err.message}`,
        count: 0,
      };
    }
  },

  /**
   * Backwards-compatible alias for exportLocalToMongo
   */
  async exportLocalToMongo(
    config: MongoDbConfig,
    data: {
      products: Product[];
      sales: Sale[];
      customers: Customer[];
      expenses: Expense[];
      categories?: Category[];
      stockHistory?: StockHistoryItem[];
      shifts?: CashShift[];
      settings?: ShopSettings;
    }
  ) {
    return this.migrateAllData(config, data);
  },

  /**
   * Sync a new live POS Sale to MongoDB Atlas in real-time
   */
  async syncSaleToMongo(config: MongoDbConfig | undefined, sale: Sale): Promise<boolean> {
    if (!config || !config.enabled || !config.auto_sync_on_checkout || !config.connection_uri) {
      return false;
    }

    try {
      const res = await fetch(apiUrl('/api/mongodb/sync-sale'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connection_uri: config.connection_uri,
          database_name: config.database_name,
          sale,
        }),
      });

      const data = await safeJson<any>(res);
      return Boolean(data?.success);
    } catch (err) {
      console.warn('[MongoDB Atlas] Auto-sync sale error (saved locally to cache):', err);
      return false;
    }
  },

  /**
   * Sync product create/edit directly to MongoDB Atlas
   */
  async syncProductToMongo(config: MongoDbConfig | undefined, product: Product): Promise<boolean> {
    if (!config || !config.enabled || !config.connection_uri) {
      return false;
    }

    try {
      const res = await fetch(apiUrl('/api/mongodb/sync-product'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connection_uri: config.connection_uri,
          database_name: config.database_name,
          product,
        }),
      });

      const data = await safeJson<any>(res);
      return Boolean(data?.success);
    } catch (err) {
      console.warn('[MongoDB Atlas] Product sync error:', err);
      return false;
    }
  },

  /**
   * Sync customer profile directly to MongoDB Atlas
   */
  async syncCustomerToMongo(config: MongoDbConfig | undefined, customer: Customer): Promise<boolean> {
    if (!config || !config.enabled || !config.connection_uri) {
      return false;
    }

    try {
      const res = await fetch(apiUrl('/api/mongodb/sync-customer'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connection_uri: config.connection_uri,
          database_name: config.database_name,
          customer,
        }),
      });

      const data = await safeJson<any>(res);
      return Boolean(data?.success);
    } catch (err) {
      console.warn('[MongoDB Atlas] Customer sync error:', err);
      return false;
    }
  },

  /**
   * Fetch all records from MongoDB Atlas (Full Cloud Restore / Pull)
   */
  async fetchAllDataFromMongo(config: MongoDbConfig): Promise<{
    success: boolean;
    data?: {
      products: Product[];
      sales: Sale[];
      customers: Customer[];
      expenses: Expense[];
      categories: Category[];
      stockHistory: StockHistoryItem[];
      settings?: ShopSettings | null;
    };
    message?: string;
  }> {
    if (!config.connection_uri) {
      return { success: false, message: 'MongoDB connection URI is missing.' };
    }

    try {
      const res = await fetch(apiUrl('/api/mongodb/fetch-all'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connection_uri: config.connection_uri || ATLAS_CLUSTER_URI,
          database_name: config.database_name || 'bloomandcarry_pos_real',
        }),
      });

      const data = await safeJson<any>(res);
      if (!res.ok || !data || !data.success) {
        return { success: false, message: data?.message || `Fetch failed (HTTP ${res.status})` };
      }

      return {
        success: true,
        data: data.data,
      };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  },

  /**
   * Wipe all collections in MongoDB Atlas
   */
  async wipeAllCollections(config?: MongoDbConfig): Promise<{ success: boolean; message: string }> {
    const activeConfig = config || DEFAULT_MONGO_CONFIG;
    try {
      const res = await fetch(apiUrl('/api/mongodb/wipe-all'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connection_uri: activeConfig.connection_uri || ATLAS_CLUSTER_URI,
          database_name: activeConfig.database_name || 'bloomandcarry_pos_real',
        }),
      });

      const data = await safeJson<any>(res);
      return { success: Boolean(data?.success), message: data?.message || '' };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  },

  // ----------------------------------------------------
  // Direct CRUD Methods for MongoDB Atlas
  // ----------------------------------------------------

  async getProducts(): Promise<Product[]> {
    try {
      const res = await fetch(apiUrl('/api/products'));
      const data = await safeJson<any>(res);
      if (data?.success && Array.isArray(data.data)) {
        return data.data;
      }
      return [];
    } catch (err) {
      console.warn('[MongoDB Atlas] fetch products failed:', err);
      return [];
    }
  },

  async saveProduct(product: Product): Promise<boolean> {
    try {
      const res = await fetch(apiUrl('/api/products'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product }),
      });
      const data = await safeJson<any>(res);
      return Boolean(data?.success);
    } catch (err) {
      console.warn('[MongoDB Atlas] save product failed:', err);
      return false;
    }
  },

  async bulkSaveProducts(products: Product[]): Promise<boolean> {
    try {
      const res = await fetch(apiUrl('/api/products/bulk'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ products }),
      });
      const data = await safeJson<any>(res);
      return Boolean(data?.success);
    } catch (err) {
      console.warn('[MongoDB Atlas] bulk save products failed:', err);
      return false;
    }
  },

  async deleteProduct(id: string): Promise<boolean> {
    try {
      const res = await fetch(apiUrl(`/api/products/${encodeURIComponent(id)}`), {
        method: 'DELETE',
      });
      const data = await safeJson<any>(res);
      return Boolean(data?.success);
    } catch (err) {
      console.warn('[MongoDB Atlas] delete product failed:', err);
      return false;
    }
  },

  async bulkDeleteProducts(ids: string[]): Promise<boolean> {
    try {
      const res = await fetch(apiUrl('/api/products/bulk-delete'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      const data = await safeJson<any>(res);
      return Boolean(data?.success);
    } catch (err) {
      console.warn('[MongoDB Atlas] bulk delete failed:', err);
      return false;
    }
  },

  async getSales(): Promise<Sale[]> {
    try {
      const res = await fetch(apiUrl('/api/sales'));
      const data = await safeJson<any>(res);
      if (data?.success && Array.isArray(data.data)) {
        return data.data;
      }
      return [];
    } catch (err) {
      console.warn('[MongoDB Atlas] fetch sales failed:', err);
      return [];
    }
  },

  async saveSale(sale: Sale): Promise<boolean> {
    try {
      const res = await fetch(apiUrl('/api/sales'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sale }),
      });
      const data = await safeJson<any>(res);
      return Boolean(data?.success);
    } catch (err) {
      console.warn('[MongoDB Atlas] save sale failed:', err);
      return false;
    }
  },

  async deleteSale(id: string): Promise<boolean> {
    try {
      const res = await fetch(apiUrl(`/api/sales/${encodeURIComponent(id)}`), {
        method: 'DELETE',
      });
      const data = await safeJson<any>(res);
      return Boolean(data?.success);
    } catch (err) {
      console.warn('[MongoDB Atlas] delete sale failed:', err);
      return false;
    }
  },

  async getCustomers(): Promise<Customer[]> {
    try {
      const res = await fetch(apiUrl('/api/customers'));
      const data = await safeJson<any>(res);
      if (data?.success && Array.isArray(data.data)) {
        return data.data;
      }
      return [];
    } catch (err) {
      console.warn('[MongoDB Atlas] fetch customers failed:', err);
      return [];
    }
  },

  async saveCustomer(customer: Customer): Promise<boolean> {
    try {
      const res = await fetch(apiUrl('/api/customers'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer }),
      });
      const data = await safeJson<any>(res);
      return Boolean(data?.success);
    } catch (err) {
      console.warn('[MongoDB Atlas] save customer failed:', err);
      return false;
    }
  },

  async deleteCustomer(id: string): Promise<boolean> {
    try {
      const res = await fetch(apiUrl(`/api/customers/${encodeURIComponent(id)}`), {
        method: 'DELETE',
      });
      const data = await safeJson<any>(res);
      return Boolean(data?.success);
    } catch (err) {
      console.warn('[MongoDB Atlas] delete customer failed:', err);
      return false;
    }
  },

  async getExpenses(): Promise<Expense[]> {
    try {
      const res = await fetch(apiUrl('/api/expenses'));
      const data = await safeJson<any>(res);
      if (data?.success && Array.isArray(data.data)) {
        return data.data;
      }
      return [];
    } catch (err) {
      console.warn('[MongoDB Atlas] fetch expenses failed:', err);
      return [];
    }
  },

  async saveExpense(expense: Expense): Promise<boolean> {
    try {
      const res = await fetch(apiUrl('/api/expenses'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expense }),
      });
      const data = await safeJson<any>(res);
      return Boolean(data?.success);
    } catch (err) {
      console.warn('[MongoDB Atlas] save expense failed:', err);
      return false;
    }
  },

  async deleteExpense(id: string): Promise<boolean> {
    try {
      const res = await fetch(apiUrl(`/api/expenses/${encodeURIComponent(id)}`), {
        method: 'DELETE',
      });
      const data = await safeJson<any>(res);
      return Boolean(data?.success);
    } catch (err) {
      console.warn('[MongoDB Atlas] delete expense failed:', err);
      return false;
    }
  },

  async getCategories(): Promise<Category[]> {
    try {
      const res = await fetch(apiUrl('/api/categories'));
      const data = await safeJson<any>(res);
      if (data?.success && Array.isArray(data.data)) {
        return data.data;
      }
      return [];
    } catch (err) {
      console.warn('[MongoDB Atlas] fetch categories failed:', err);
      return [];
    }
  },

  async saveCategory(category: Category): Promise<boolean> {
    try {
      const res = await fetch(apiUrl('/api/categories'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category }),
      });
      const data = await safeJson<any>(res);
      return Boolean(data?.success);
    } catch (err) {
      console.warn('[MongoDB Atlas] save category failed:', err);
      return false;
    }
  },

  async bulkSaveCategories(categories: Category[], overwrite = false): Promise<boolean> {
    try {
      const res = await fetch(apiUrl('/api/categories/bulk'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categories, overwrite }),
      });
      const data = await safeJson<any>(res);
      return Boolean(data?.success);
    } catch (err) {
      console.warn('[MongoDB Atlas] bulk save categories failed:', err);
      return false;
    }
  },

  async resetCategories(): Promise<{ success: boolean; categories?: Category[] }> {
    try {
      const res = await fetch(apiUrl('/api/categories/reset'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await safeJson<any>(res);
      return { success: Boolean(data?.success), categories: data?.data };
    } catch (err) {
      console.warn('[MongoDB Atlas] reset categories failed:', err);
      return { success: false };
    }
  },

  async consolidateDatabase(targetDatabase?: string): Promise<{ success: boolean; message?: string; target_database?: string; consolidated?: Record<string, any> }> {
    try {
      const res = await fetch(apiUrl('/api/consolidate-database'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_database: targetDatabase }),
      });
      const data = await safeJson<any>(res);
      return data || { success: false, message: 'Empty response from consolidation' };
    } catch (err: any) {
      console.warn('[MongoDB Atlas] consolidate database failed:', err);
      return { success: false, message: err?.message || 'Consolidation request failed' };
    }
  },

  async getDiagnostics(): Promise<any> {
    try {
      const res = await fetch(apiUrl('/api/diagnostics'));
      const data = await safeJson<any>(res);
      return data;
    } catch (err) {
      console.warn('[MongoDB Atlas] get diagnostics failed:', err);
      return null;
    }
  },

  async deleteCategory(id: string): Promise<boolean> {
    try {
      const res = await fetch(apiUrl(`/api/categories/${encodeURIComponent(id)}`), {
        method: 'DELETE',
      });
      const data = await safeJson<any>(res);
      return Boolean(data?.success);
    } catch (err) {
      console.warn('[MongoDB Atlas] delete category failed:', err);
      return false;
    }
  },

  async getStockLedger(): Promise<StockHistoryItem[]> {
    try {
      const res = await fetch(apiUrl('/api/stock-ledger'));
      const data = await safeJson<any>(res);
      if (data?.success && Array.isArray(data.data)) {
        return data.data;
      }
      return [];
    } catch (err) {
      console.warn('[MongoDB Atlas] fetch stock ledger failed:', err);
      return [];
    }
  },

  async recordStockMovement(entry: Partial<StockHistoryItem>): Promise<boolean> {
    try {
      const res = await fetch(apiUrl('/api/stock-ledger'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entry }),
      });
      const data = await safeJson<any>(res);
      return Boolean(data?.success);
    } catch (err) {
      console.warn('[MongoDB Atlas] record stock movement failed:', err);
      return false;
    }
  },

  async getShifts(): Promise<CashShift[]> {
    try {
      const res = await fetch(apiUrl('/api/shifts'));
      const data = await safeJson<any>(res);
      if (data?.success && Array.isArray(data.data)) {
        return data.data;
      }
      return [];
    } catch (err) {
      console.warn('[MongoDB Atlas] fetch shifts failed:', err);
      return [];
    }
  },

  async saveShift(shift: CashShift): Promise<boolean> {
    try {
      const res = await fetch(apiUrl('/api/shifts'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shift }),
      });
      const data = await safeJson<any>(res);
      return Boolean(data?.success);
    } catch (err) {
      console.warn('[MongoDB Atlas] save shift failed:', err);
      return false;
    }
  },

  async getSettings(): Promise<ShopSettings | null> {
    try {
      const res = await fetch(apiUrl('/api/settings'));
      const data = await safeJson<any>(res);
      if (data?.success && data.data) {
        return data.data;
      }
      return null;
    } catch (err) {
      console.warn('[MongoDB Atlas] fetch settings failed:', err);
      return null;
    }
  },

  async saveSettings(settings: ShopSettings): Promise<boolean> {
    try {
      const res = await fetch(apiUrl('/api/settings'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings }),
      });
      const data = await safeJson<any>(res);
      return Boolean(data?.success);
    } catch (err) {
      console.warn('[MongoDB Atlas] save settings failed:', err);
      return false;
    }
  }
};

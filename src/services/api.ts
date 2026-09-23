import { Product, Sale, Customer, Expense, ShopSettings, Category } from '../types';
import { StorageService } from './storage';
import { MongoDbService } from './mongodb_service';
import { WorkspaceService } from './workspace';
import { IndexedDbVaultService } from './indexed_db_vault';

export interface SyncStatus {
  isConfigured: boolean;
  isSyncing: boolean;
  lastSynced?: string;
  lastError?: string;
}

export const ApiService = {
  /**
   * Helper to execute GET requests to Google Apps Script Web App
   */
  async fetchFromGas(url: string, action: string) {
    if (!url || !url.startsWith('http')) {
      throw new Error('Google Apps Script URL is missing or invalid.');
    }
    const cleanUrl = url.trim();
    const fullUrl = `${cleanUrl}${cleanUrl.includes('?') ? '&' : '?'}action=${action}&t=${Date.now()}`;
    
    const response = await fetch(fullUrl, {
      method: 'GET',
      redirect: 'follow',
    });

    if (!response.ok) {
      throw new Error(`Google Apps Script HTTP error! Status: ${response.status}`);
    }

    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`Invalid JSON output from Google Apps Script: ${text.substring(0, 100)}`);
    }
  },

  /**
   * Helper to execute POST requests to Google Apps Script Web App
   * Uses text/plain to avoid CORS preflight issues in browsers
   */
  async postToGas(url: string, payload: any) {
    if (!url || !url.startsWith('http')) {
      throw new Error('Google Apps Script URL is missing or invalid.');
    }
    const cleanUrl = url.trim();
    
    const response = await fetch(cleanUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
      redirect: 'follow',
    });

    if (!response.ok) {
      throw new Error(`Google Apps Script HTTP error! Status: ${response.status}`);
    }

    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch {
      return { status: 'success', raw: text };
    }
  },

  /**
   * Test connection to Google Apps Script
   */
  async testConnection(webAppUrl: string): Promise<{ success: boolean; message: string }> {
    try {
      const res = await this.fetchFromGas(webAppUrl, 'init');
      if (res && res.status === 'success') {
        return { success: true, message: 'Successfully connected to Google Apps Script & Google Sheet!' };
      }
      return { success: false, message: res.message || 'Connection failed with unknown response.' };
    } catch (err: any) {
      return { success: false, message: err.message || 'Failed to connect. Check Web App URL and permissions.' };
    }
  },

  /**
   * Fetch All Data with Multi-Tier Storage:
   * 1. Local Storage authoritative state
   * 2. IndexedDB native browser vault
   * 3. Google Apps Script Web App sync (if configured)
   * 4. Real-time Cloud Firestore Collections
   * 5. Google Sheets OAuth
   */
  async loadAllData(webAppUrl?: string) {
    const settings = StorageService.getSettings();

    // Step A: If local stores are empty, check IndexedDB native vault
    if (StorageService.getProducts().length === 0) {
      const idbProducts = await IndexedDbVaultService.getStore<Product>('products');
      if (idbProducts && idbProducts.length > 0) {
        StorageService.saveProducts(idbProducts);
      }
    }
    if (StorageService.getCategories().length === 0) {
      const idbCategories = await IndexedDbVaultService.getStore<Category>('categories');
      if (idbCategories && idbCategories.length > 0) {
        StorageService.saveCategories(idbCategories);
      }
    }
    if (StorageService.getSales().length === 0) {
      const idbSales = await IndexedDbVaultService.getStore<Sale>('sales');
      if (idbSales && idbSales.length > 0) {
        StorageService.saveSales(idbSales);
      }
    }
    if (StorageService.getCustomers().length <= 1) {
      const idbCustomers = await IndexedDbVaultService.getStore<Customer>('customers');
      if (idbCustomers && idbCustomers.length > 1) {
        StorageService.saveCustomers(idbCustomers);
      }
    }

    // Step B: Google Apps Script Web App sync
    if (webAppUrl && webAppUrl.startsWith('http')) {
      try {
        const res = await this.fetchFromGas(webAppUrl, 'getAllData');
        if (res && res.status === 'success') {
          // Sync local storage with Google Sheet data
          if (Array.isArray(res.products) && res.products.length > 0) {
            StorageService.saveProducts(res.products.map(p => ({
              ...p,
              buy_price: Number(p.buy_price) || 0,
              sell_price: Number(p.sell_price) || 0,
              stock_qty: Number(p.stock_qty) || 0,
            })));
          }
          if (Array.isArray(res.sales) && res.sales.length > 0) {
            StorageService.saveSales(res.sales.map(s => ({
              ...s,
              subtotal: Number(s.subtotal) || Number(s.total) || 0,
              total: Number(s.total) || 0,
              paid: Number(s.paid) || 0,
              items: typeof s.items_json === 'string' ? JSON.parse(s.items_json) : (s.items || [])
            })));
          }
          if (Array.isArray(res.customers) && res.customers.length > 0) {
            StorageService.saveCustomers(res.customers.map(c => ({
              ...c,
              points: Number(c.points) || 0,
            })));
          }
          if (Array.isArray(res.expenses) && res.expenses.length > 0) {
            StorageService.saveExpenses(res.expenses.map(e => ({
              ...e,
              amount: Number(e.amount) || 0,
            })));
          }
          return {
            success: true,
            products: StorageService.getProducts(),
            sales: StorageService.getSales(),
            customers: StorageService.getCustomers(),
            expenses: StorageService.getExpenses(),
            settings: StorageService.getSettings(),
            syncedFromGas: true,
          };
        }
      } catch (err) {
        console.warn('Google Apps Script fetch failed, falling back to database:', err);
      }
    }

    // Step C: MongoDB Atlas Database sync (Real-time & Persistent)
    try {
      const [mongoProducts, mongoCategories, mongoSales, mongoCustomers, mongoExpenses] = await Promise.all([
        MongoDbService.getProducts().catch(() => []),
        MongoDbService.getCategories().catch(() => []),
        MongoDbService.getSales().catch(() => []),
        MongoDbService.getCustomers().catch(() => []),
        MongoDbService.getExpenses().catch(() => [])
      ]);

      if (Array.isArray(mongoProducts)) {
        StorageService.saveProducts(mongoProducts, 'Cloud Products Synchronized');
      }
      if (Array.isArray(mongoCategories) && mongoCategories.length > 0) {
        StorageService.saveCategories(mongoCategories, 'Cloud Categories Synchronized');
      }
      if (Array.isArray(mongoSales)) {
        StorageService.saveSales(mongoSales, 'Cloud Sales Synchronized');
      }
      if (Array.isArray(mongoCustomers) && mongoCustomers.length > 0) {
        StorageService.saveCustomers(mongoCustomers, 'Cloud Customers Synchronized');
      }
      if (Array.isArray(mongoExpenses)) {
        StorageService.saveExpenses(mongoExpenses, 'Cloud Expenses Synchronized');
      }
    } catch {
      // Local storage is authoritative when offline
    }

    // Step E: Google Spreadsheet via OAuth read sync
    if (settings.google_spreadsheet_id) {
      try {
        const sheetProducts = await WorkspaceService.readProductsFromSheet(settings.google_spreadsheet_id);
        if (sheetProducts && sheetProducts.length > 0) {
          StorageService.saveProducts(sheetProducts);
        }
      } catch (err: any) {
        console.warn('Google Spreadsheet read notice:', err?.message || err);
      }
    }

    // Return unified storage
    // Check if automated monthly executive report is due
    WorkspaceService.checkAndAutoSendMonthlyReport().catch(err => {
      console.warn('Auto monthly report check notice:', err);
    });

    return {
      success: true,
      products: StorageService.getProducts(),
      sales: StorageService.getSales(),
      customers: StorageService.getCustomers(),
      expenses: StorageService.getExpenses(),
      settings: StorageService.getSettings(),
      syncedFromGas: false,
    };
  },

  /**
   * Save Sale to Cloud Firestore + Google Sheet + Local Storage
   * Note: Inventory deduction is performed single and atomically in the checkout flow
   */
  async saveSale(sale: Sale, webAppUrl?: string) {
    const settings = StorageService.getSettings();

    // If Test Transaction Mode is enabled, mark sale as TEST and skip inventory deduction / accounting ledger updates
    if (settings.is_test_transaction_mode) {
      const testSale: Sale = {
        ...sale,
        notes: `[TEST TRANSACTION MODE - Inventory & Accounting Protected] ${sale.notes || ''}`,
      };
      
      const sales = StorageService.getSales();
      sales.unshift(testSale);
      StorageService.saveSales(sales);
      return { success: true, pdfUrl: '', isTestTransaction: true };
    }

    // 1. Update Local Storage for Production Sale
    const sales = StorageService.getSales();
    const existingIndex = sales.findIndex(s => s.id === sale.id || s.invoice_no === sale.invoice_no);
    if (existingIndex >= 0) {
      sales[existingIndex] = sale;
    } else {
      sales.unshift(sale);
    }
    StorageService.saveSales(sales);

    // 2. Update Customer Points if named customer
    if (sale.customer_name && sale.customer_name !== 'Walk-in Customer') {
      const customers = StorageService.getCustomers();
      const updatedCust = customers.map(c => {
        if (c.name.toLowerCase() === sale.customer_name.toLowerCase()) {
          const addPoints = Math.floor(sale.total / 100);
          return {
            ...c,
            points: (c.points || 0) + addPoints,
            total_spent: (c.total_spent || 0) + sale.total,
            last_visit: new Date().toISOString().split('T')[0]
          };
        }
        return c;
      });
      StorageService.saveCustomers(updatedCust);
    }

    // 3. Non-blocking MongoDB Atlas sync
    MongoDbService.saveSale(sale).catch(err => {
      console.warn('MongoDB sale sync notice:', err?.message || err);
    });

    // 4. Non-blocking Google Spreadsheet OAuth sync
    if (settings.google_spreadsheet_id) {
      WorkspaceService.exportSalesToSheet(settings.google_spreadsheet_id, StorageService.getSales()).catch(err => {
        console.warn('Google Sheet sales sync notice:', err?.message || err);
      });
      WorkspaceService.exportProductsToSheet(settings.google_spreadsheet_id, StorageService.getProducts()).catch(err => {
        console.warn('Google Sheet stock sync notice:', err?.message || err);
      });
      const todayStr = new Date().toISOString().split('T')[0];
      WorkspaceService.exportDailySummaryToSheet(settings.google_spreadsheet_id, todayStr, StorageService.getSales(), StorageService.getExpenses()).catch(err => {
        console.warn('Google Sheet daily ledger sync notice:', err?.message || err);
      });
    }

    // 5. Sync to Google Sheet if Web App URL exists
    let drivePdfUrl = '';
    if (webAppUrl && webAppUrl.startsWith('http')) {
      try {
        const res = await this.postToGas(webAppUrl, {
          action: 'saveSale',
          data: {
            ...sale,
            items_json: JSON.stringify(sale.items)
          }
        });
        if (res && res.status === 'success' && res.pdf_url) {
          drivePdfUrl = res.pdf_url;
          // attach pdf url to local sale record
          sale.drive_pdf_url = drivePdfUrl;
          StorageService.saveSales(sales);
        }
      } catch (err) {
        console.error('Failed to post sale to Google Apps Script:', err);
      }
    }

    return { success: true, pdfUrl: drivePdfUrl };
  },

  /**
   * Upsert Product across Local Storage, Firestore Database, and Google Sheets
   */
  async saveProduct(product: Product, webAppUrl?: string) {
    const settings = StorageService.getSettings();

    // 1. Local Storage
    const products = StorageService.getProducts();
    const existingIndex = products.findIndex(p => p.id === product.id || (p.barcode && p.barcode === product.barcode));
    
    if (existingIndex >= 0) {
      products[existingIndex] = product;
    } else {
      products.unshift(product);
    }
    StorageService.saveProducts(products);

    // 2. MongoDB Atlas Database sync
    MongoDbService.saveProduct(product).catch(err => {
      console.warn('MongoDB saveProduct sync notice:', err?.message || err);
    });

    // 3. Google Spreadsheet sync via OAuth
    if (settings.google_spreadsheet_id) {
      WorkspaceService.exportProductsToSheet(settings.google_spreadsheet_id, products).catch(err => {
        console.warn('Google Sheet saveProduct sync notice:', err?.message || err);
      });
    }

    // 4. Google Apps Script Web App
    if (webAppUrl && webAppUrl.startsWith('http')) {
      try {
        await this.postToGas(webAppUrl, {
          action: 'saveProduct',
          data: product
        });
      } catch (err) {
        console.error('Failed to sync product to GAS:', err);
      }
    }
    return { success: true };
  },

  /**
   * Delete Product across Local Storage, MongoDB Database, and Google Sheets
   */
  async deleteProduct(id: string, webAppUrl?: string) {
    const settings = StorageService.getSettings();

    // 1. Local Storage
    const products = StorageService.getProducts().filter(p => p.id !== id);
    StorageService.saveProducts(products);

    // 2. MongoDB Atlas Database
    MongoDbService.deleteProduct(id).catch(err => {
      console.warn('MongoDB deleteProduct sync notice:', err?.message || err);
    });

    // 3. Google Spreadsheet sync
    if (settings.google_spreadsheet_id) {
      WorkspaceService.exportProductsToSheet(settings.google_spreadsheet_id, products).catch(err => {
        console.warn('Google Sheet delete sync notice:', err?.message || err);
      });
    }

    // 4. Google Apps Script
    if (webAppUrl && webAppUrl.startsWith('http')) {
      try {
        await this.postToGas(webAppUrl, {
          action: 'deleteProduct',
          id: id
        });
      } catch (err) {
        console.error('Failed to delete product on GAS:', err);
      }
    }
    return { success: true };
  },

  /**
   * Upsert Customer across Local Storage, MongoDB Database, and Google Apps Script
   */
  async saveCustomer(customer: Customer, webAppUrl?: string) {
    const customers = StorageService.getCustomers();
    const existingIndex = customers.findIndex(c => c.id === customer.id);
    if (existingIndex >= 0) {
      customers[existingIndex] = customer;
    } else {
      customers.unshift(customer);
    }
    StorageService.saveCustomers(customers);

    MongoDbService.saveCustomer(customer).catch(err => {
      console.warn('MongoDB saveCustomer sync notice:', err?.message || err);
    });

    if (webAppUrl && webAppUrl.startsWith('http')) {
      try {
        await this.postToGas(webAppUrl, {
          action: 'saveCustomer',
          data: customer
        });
      } catch (err) {
        console.error('Failed to sync customer to GAS:', err);
      }
    }
    return { success: true };
  },

  /**
   * Delete Customer across Local Storage, MongoDB Database, and GAS
   */
  async deleteCustomer(id: string, webAppUrl?: string) {
    StorageService.deleteCustomer(id);
    MongoDbService.deleteCustomer(id).catch(err => {
      console.warn('MongoDB deleteCustomer notice:', err?.message || err);
    });

    if (webAppUrl && webAppUrl.startsWith('http')) {
      try {
        await this.postToGas(webAppUrl, {
          action: 'deleteCustomer',
          id: id
        });
      } catch (err) {
        console.error('Failed to sync customer deletion to GAS:', err);
      }
    }
    return { success: true };
  },

  /**
   * Delete Expense across Local Storage, MongoDB Database, and GAS
   */
  async deleteExpense(id: string, webAppUrl?: string) {
    StorageService.deleteExpense(id);
    MongoDbService.deleteExpense(id).catch(err => {
      console.warn('MongoDB deleteExpense notice:', err?.message || err);
    });

    if (webAppUrl && webAppUrl.startsWith('http')) {
      try {
        await this.postToGas(webAppUrl, {
          action: 'deleteExpense',
          id: id
        });
      } catch (err) {
        console.error('Failed to delete expense on GAS:', err);
      }
    }
    return { success: true };
  },

  /**
   * Delete/Void Sale across Local Storage and MongoDB Database
   */
  async deleteSale(id: string) {
    StorageService.deleteSale(id);
    MongoDbService.deleteSale(id).catch(err => {
      console.warn('MongoDB deleteSale notice:', err?.message || err);
    });
    return { success: true };
  },

  /**
   * Save Expense across Local Storage, MongoDB Database, and Google Apps Script
   */
  async saveExpense(expense: Expense, webAppUrl?: string) {
    const expenses = StorageService.getExpenses();
    const existingIndex = expenses.findIndex(e => e.id === expense.id);
    if (existingIndex >= 0) {
      expenses[existingIndex] = expense;
    } else {
      expenses.unshift(expense);
    }
    StorageService.saveExpenses(expenses);

    MongoDbService.saveExpense(expense).catch(err => {
      console.warn('MongoDB saveExpense sync notice:', err?.message || err);
    });

    const settings = StorageService.getSettings();
    if (settings.google_spreadsheet_id) {
      WorkspaceService.exportExpensesToSheet(settings.google_spreadsheet_id, expenses).catch(err => {
        console.warn('Google Sheet expense sync notice:', err?.message || err);
      });
      const todayStr = new Date().toISOString().split('T')[0];
      WorkspaceService.exportDailySummaryToSheet(settings.google_spreadsheet_id, todayStr, StorageService.getSales(), expenses).catch(err => {
        console.warn('Google Sheet daily ledger sync notice:', err?.message || err);
      });
    }

    if (webAppUrl && webAppUrl.startsWith('http')) {
      try {
        await this.postToGas(webAppUrl, {
          action: 'saveExpense',
          data: expense
        });
      } catch (err) {
        console.error('Failed to sync expense to GAS:', err);
      }
    }
    return { success: true };
  },

  /**
   * Save Settings
   */
  async saveSettings(settings: ShopSettings, webAppUrl?: string) {
    StorageService.saveSettings(settings);

    MongoDbService.saveSettings(settings).catch(err => {
      console.warn('MongoDB saveSettings sync notice:', err?.message || err);
    });

    if (webAppUrl && webAppUrl.startsWith('http')) {
      try {
        await this.postToGas(webAppUrl, {
          action: 'saveSettings',
          data: settings
        });
      } catch (err) {
        console.error('Failed to sync settings to GAS:', err);
      }
    }
    return { success: true };
  },

  /**
   * Save Category across Local Storage and MongoDB Database
   */
  async saveCategory(category: Category) {
    const categories = StorageService.getCategories();
    const existingIndex = categories.findIndex(c => c.id === category.id);
    if (existingIndex >= 0) {
      categories[existingIndex] = category;
    } else {
      categories.push(category);
    }
    StorageService.saveCategories(categories, `Category Saved (${category.name})`);
    MongoDbService.saveCategory(category).catch(err => {
      console.warn('MongoDB saveCategory sync notice:', err?.message || err);
    });
    return { success: true };
  },

  /**
   * Delete Category across Local Storage and MongoDB Database
   */
  async deleteCategory(id: string, reassignTo?: string) {
    StorageService.deleteCategory(id, reassignTo);
    MongoDbService.deleteCategory(id).catch(err => {
      console.warn('MongoDB deleteCategory notice:', err?.message || err);
    });
    return { success: true };
  },

  /**
   * Manual Cloud Push Sync for all datasets
   */
  async syncAllToCloud(settings: ShopSettings) {
    const products = StorageService.getProducts();
    const sales = StorageService.getSales();

    if (settings.google_spreadsheet_id) {
      await WorkspaceService.exportProductsToSheet(settings.google_spreadsheet_id, products).catch(() => {});
      await WorkspaceService.exportSalesToSheet(settings.google_spreadsheet_id, sales).catch(() => {});
    }

    await MongoDbService.bulkSaveProducts(products).catch(() => {});
    for (const s of sales) {
      await MongoDbService.saveSale(s).catch(() => {});
    }

    return { success: true };
  }
};

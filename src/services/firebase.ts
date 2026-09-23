import { initializeApp, getApps } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup, 
  signInAnonymously,
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  User as FirebaseUser 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  deleteDoc, 
  getDocFromServer 
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { Product, Sale, Customer, ShopSettings, Category } from '../types';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

// Initialize Firebase App
const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Google Auth Provider with Google Drive, Google Sheets, Gmail scopes
export const googleAuthProvider = new GoogleAuthProvider();
googleAuthProvider.addScope('https://www.googleapis.com/auth/drive.file');
googleAuthProvider.addScope('https://www.googleapis.com/auth/drive.readonly');
googleAuthProvider.addScope('https://www.googleapis.com/auth/spreadsheets');
googleAuthProvider.addScope('https://www.googleapis.com/auth/gmail.send');
googleAuthProvider.addScope('https://www.googleapis.com/auth/gmail.compose');
googleAuthProvider.addScope('https://www.googleapis.com/auth/gmail.readonly');

// In-memory token storage (DO NOT persist in localStorage per Google Workspace specs)
let cachedAccessToken: string | null = null;
let isSigningIn = false;

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const currentUser = auth.currentUser;
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: currentUser?.uid,
      email: currentUser?.email,
      emailVerified: currentUser?.emailVerified,
      isAnonymous: currentUser?.isAnonymous,
      providerInfo: currentUser?.providerData?.map(p => ({
        providerId: p.providerId,
        email: p.email,
      })) || []
    },
    operationType,
    path
  };
  console.warn('Firestore Error Context:', JSON.stringify(errInfo));
  return errInfo;
}

// Test Connection
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firestore client is offline or database initializing.');
    }
    return false;
  }
}

// Init Auth listener
export const initAuth = (
  onAuthSuccess?: (user: FirebaseUser, token: string | null) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user) => {
    if (user) {
      if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

// Google Sign-In with popup
export const googleSignIn = async (): Promise<{ user: FirebaseUser; accessToken: string | null } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, googleAuthProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (credential?.accessToken) {
      cachedAccessToken = credential.accessToken;
    }
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error) {
    console.error('Firebase Google Sign-In Error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const setAccessToken = (token: string | null) => {
  cachedAccessToken = token;
};

export const firebaseLogout = async () => {
  await signOut(auth);
  cachedAccessToken = null;
};

// Ensure Firebase Auth is always active (Anonymous or Google) for persistent cloud operations
let authPromise: Promise<FirebaseUser | null> | null = null;

export async function ensureFirebaseAuth(): Promise<FirebaseUser | null> {
  if (auth.currentUser) return auth.currentUser;
  if (authPromise) return authPromise;

  authPromise = (async () => {
    try {
      const res = await signInAnonymously(auth);
      return res.user;
    } catch (err) {
      console.warn('Silent anonymous auth notice:', err);
      return null;
    } finally {
      authPromise = null;
    }
  })();

  return authPromise;
}

// Cloud Firestore Sync API for POS Collections
export const FirestoreSyncService = {
  // Sync Products to Firestore
  async saveProduct(product: Product): Promise<void> {
    await ensureFirebaseAuth();
    try {
      await setDoc(doc(db, 'products', product.id), {
        id: product.id,
        barcode: product.barcode || '',
        name: product.name || '',
        category: product.category || 'General',
        brand: product.brand || '',
        buy_price: Number(product.buy_price) || 0,
        sell_price: Number(product.sell_price) || 0,
        stock_qty: Number(product.stock_qty) || 0,
        min_stock_alert: Number(product.min_stock_alert) || 5,
        image_url: product.image_url || '',
        tax_rate: product.tax_rate !== undefined && product.tax_rate !== null ? Number(product.tax_rate) : null,
        is_tax_exempt: Boolean(product.is_tax_exempt),
        updated_at: new Date().toISOString()
      }, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `products/${product.id}`);
    }
  },

  async deleteProduct(productId: string): Promise<void> {
    await ensureFirebaseAuth();
    try {
      await deleteDoc(doc(db, 'products', productId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `products/${productId}`);
    }
  },

  async fetchProducts(): Promise<Product[]> {
    await ensureFirebaseAuth();
    try {
      const snap = await getDocs(collection(db, 'products'));
      return snap.docs.map(d => d.data() as Product);
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'products');
      return [];
    }
  },

  // Sync Categories to Firestore
  async saveCategory(category: Category): Promise<void> {
    await ensureFirebaseAuth();
    try {
      await setDoc(doc(db, 'categories', category.id), {
        id: category.id,
        name: category.name || '',
        code: category.code || '',
        description: category.description || '',
        color: category.color || 'bg-rose-50 text-rose-700 border-rose-200',
        icon: category.icon || 'Tag',
        status: category.status || 'ACTIVE',
        display_order: Number(category.display_order) || 0,
        created_at: category.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `categories/${category.id}`);
    }
  },

  async deleteCategory(categoryId: string): Promise<void> {
    await ensureFirebaseAuth();
    try {
      await deleteDoc(doc(db, 'categories', categoryId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `categories/${categoryId}`);
    }
  },

  async fetchCategories(): Promise<Category[]> {
    await ensureFirebaseAuth();
    try {
      const snap = await getDocs(collection(db, 'categories'));
      return snap.docs.map(d => d.data() as Category);
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'categories');
      return [];
    }
  },

  // Sync Sales to Firestore
  async saveSale(sale: Sale): Promise<void> {
    await ensureFirebaseAuth();
    try {
      await setDoc(doc(db, 'sales', sale.id), {
        id: sale.id,
        invoice_no: sale.invoice_no,
        datetime: sale.datetime,
        customer_name: sale.customer_name || 'Walk-in Customer',
        customer_phone: sale.customer_phone || '',
        subtotal: Number(sale.subtotal) || 0,
        discount_amount: Number(sale.discount) || 0,
        tax_amount: Number(sale.tax_amount) || 0,
        total: Number(sale.total) || 0,
        payment_method: sale.payment_method || 'Cash',
        cashier_name: sale.cashier_name || 'Admin',
        items_count: sale.items?.length || 0,
        items: (sale.items || []).map(i => ({
          product_id: i.product_id,
          barcode: i.barcode,
          name: i.name,
          quantity: i.quantity,
          sell_price: i.sell_price,
          total: i.total
        }))
      }, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `sales/${sale.id}`);
    }
  },

  async deleteSale(saleId: string): Promise<void> {
    await ensureFirebaseAuth();
    try {
      await deleteDoc(doc(db, 'sales', saleId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `sales/${saleId}`);
    }
  },

  async fetchSales(): Promise<Sale[]> {
    await ensureFirebaseAuth();
    try {
      const snap = await getDocs(collection(db, 'sales'));
      return snap.docs.map(d => d.data() as Sale);
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'sales');
      return [];
    }
  },

  // Sync Customers to Firestore
  async saveCustomer(customer: Customer): Promise<void> {
    await ensureFirebaseAuth();
    try {
      await setDoc(doc(db, 'customers', customer.id), {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email || '',
        loyalty_points: Number(customer.points) || 0,
        total_spent: Number(customer.total_spent) || 0
      }, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `customers/${customer.id}`);
    }
  },

  async deleteCustomer(customerId: string): Promise<void> {
    await ensureFirebaseAuth();
    try {
      await deleteDoc(doc(db, 'customers', customerId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `customers/${customerId}`);
    }
  },

  async fetchCustomers(): Promise<Customer[]> {
    await ensureFirebaseAuth();
    try {
      const snap = await getDocs(collection(db, 'customers'));
      return snap.docs.map(d => d.data() as Customer);
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'customers');
      return [];
    }
  },

  // Sync Store Settings to Firestore
  async saveSettings(settings: ShopSettings): Promise<void> {
    await ensureFirebaseAuth();
    try {
      await setDoc(doc(db, 'settings', 'general'), {
        id: 'general',
        shopName: settings.shop_name || 'Bloom & Carry Cosmetics',
        tagline: settings.tagline || '',
        address: settings.address || 'Hostel City Line 10, Yasmeen Plaza, Shop No. 1, Islamabad.',
        phone: settings.phone || '03461185406',
        website: settings.website || 'bloomandcarry.com',
        currencySymbol: settings.currency_symbol || 'Rs. ',
        taxRate: Number(settings.tax_rate) || 0,
        tax_rate: Number(settings.tax_rate) || 0,
        tax_mode: settings.tax_mode || 'EXCLUSIVE',
        category_tax_rates: settings.category_tax_rates || {},
        tax_exempt_categories: settings.tax_exempt_categories || [],
        updated_at: new Date().toISOString()
      }, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'settings/general');
    }
  },

  // Sync Returns to Firestore
  async saveReturn(returnTx: any): Promise<void> {
    await ensureFirebaseAuth();
    try {
      await setDoc(doc(db, 'returns', returnTx.id), {
        id: returnTx.id,
        return_no: returnTx.return_no,
        original_sale_id: returnTx.original_sale_id,
        original_invoice_no: returnTx.original_invoice_no,
        datetime: returnTx.datetime,
        customer_name: returnTx.customer_name || 'Walk-in Customer',
        customer_phone: returnTx.customer_phone || '',
        cashier_name: returnTx.cashier_name || 'Cashier',
        total_refund_amount: Number(returnTx.total_refund_amount) || 0,
        refund_method: returnTx.refund_method || 'Cash',
        status: returnTx.status || 'COMPLETED',
        updated_at: new Date().toISOString()
      }, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `returns/${returnTx.id}`);
    }
  },

  async deleteReturn(returnId: string): Promise<void> {
    await ensureFirebaseAuth();
    try {
      await deleteDoc(doc(db, 'returns', returnId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `returns/${returnId}`);
    }
  },

  async fetchReturns(): Promise<any[]> {
    await ensureFirebaseAuth();
    try {
      const snap = await getDocs(collection(db, 'returns'));
      return snap.docs.map(d => d.data());
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'returns');
      return [];
    }
  },

  // Sync Expenses to Firestore
  async saveExpense(expense: any): Promise<void> {
    await ensureFirebaseAuth();
    try {
      await setDoc(doc(db, 'expenses', expense.id), {
        id: expense.id,
        title: expense.title || '',
        category: expense.category || 'General',
        amount: Number(expense.amount) || 0,
        date: expense.date || new Date().toISOString(),
        payment_method: expense.payment_method || 'Cash',
        status: expense.status || 'APPROVED',
        updated_at: new Date().toISOString()
      }, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `expenses/${expense.id}`);
    }
  },

  async deleteExpense(expenseId: string): Promise<void> {
    await ensureFirebaseAuth();
    try {
      await deleteDoc(doc(db, 'expenses', expenseId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `expenses/${expenseId}`);
    }
  },

  async fetchExpenses(): Promise<any[]> {
    await ensureFirebaseAuth();
    try {
      const snap = await getDocs(collection(db, 'expenses'));
      return snap.docs.map(d => d.data());
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'expenses');
      return [];
    }
  },

  // Sync Suppliers
  async saveSupplier(supplier: any): Promise<void> {
    await ensureFirebaseAuth();
    try {
      await setDoc(doc(db, 'suppliers', supplier.id), {
        ...supplier,
        updated_at: new Date().toISOString()
      }, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `suppliers/${supplier.id}`);
    }
  },

  async deleteSupplier(supplierId: string): Promise<void> {
    await ensureFirebaseAuth();
    try {
      await deleteDoc(doc(db, 'suppliers', supplierId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `suppliers/${supplierId}`);
    }
  },

  async fetchSuppliers(): Promise<any[]> {
    await ensureFirebaseAuth();
    try {
      const snap = await getDocs(collection(db, 'suppliers'));
      return snap.docs.map(d => d.data());
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'suppliers');
      return [];
    }
  },

  // Sync Purchase Orders
  async savePurchaseOrder(po: any): Promise<void> {
    await ensureFirebaseAuth();
    try {
      await setDoc(doc(db, 'purchase_orders', po.id), {
        ...po,
        updated_at: new Date().toISOString()
      }, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `purchase_orders/${po.id}`);
    }
  },

  async deletePurchaseOrder(poId: string): Promise<void> {
    await ensureFirebaseAuth();
    try {
      await deleteDoc(doc(db, 'purchase_orders', poId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `purchase_orders/${poId}`);
    }
  },

  async fetchPurchaseOrders(): Promise<any[]> {
    await ensureFirebaseAuth();
    try {
      const snap = await getDocs(collection(db, 'purchase_orders'));
      return snap.docs.map(d => d.data());
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'purchase_orders');
      return [];
    }
  },

  // Sync Employees
  async saveEmployee(employee: any): Promise<void> {
    await ensureFirebaseAuth();
    try {
      await setDoc(doc(db, 'employees', employee.id), {
        ...employee,
        updated_at: new Date().toISOString()
      }, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `employees/${employee.id}`);
    }
  },

  async deleteEmployee(employeeId: string): Promise<void> {
    await ensureFirebaseAuth();
    try {
      await deleteDoc(doc(db, 'employees', employeeId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `employees/${employeeId}`);
    }
  },

  async fetchEmployees(): Promise<any[]> {
    await ensureFirebaseAuth();
    try {
      const snap = await getDocs(collection(db, 'employees'));
      return snap.docs.map(d => d.data());
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'employees');
      return [];
    }
  },

  // Sync Payrolls
  async savePayroll(payroll: any): Promise<void> {
    await ensureFirebaseAuth();
    try {
      await setDoc(doc(db, 'payrolls', payroll.id), {
        ...payroll,
        updated_at: new Date().toISOString()
      }, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `payrolls/${payroll.id}`);
    }
  },

  async deletePayroll(payrollId: string): Promise<void> {
    await ensureFirebaseAuth();
    try {
      await deleteDoc(doc(db, 'payrolls', payrollId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `payrolls/${payrollId}`);
    }
  },

  async fetchPayrolls(): Promise<any[]> {
    await ensureFirebaseAuth();
    try {
      const snap = await getDocs(collection(db, 'payrolls'));
      return snap.docs.map(d => d.data());
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'payrolls');
      return [];
    }
  },

  // Sync Coupons
  async saveCoupon(coupon: any): Promise<void> {
    await ensureFirebaseAuth();
    try {
      await setDoc(doc(db, 'coupons', coupon.id), {
        ...coupon,
        updated_at: new Date().toISOString()
      }, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `coupons/${coupon.id}`);
    }
  },

  async deleteCoupon(couponId: string): Promise<void> {
    await ensureFirebaseAuth();
    try {
      await deleteDoc(doc(db, 'coupons', couponId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `coupons/${couponId}`);
    }
  },

  async fetchCoupons(): Promise<any[]> {
    await ensureFirebaseAuth();
    try {
      const snap = await getDocs(collection(db, 'coupons'));
      return snap.docs.map(d => d.data());
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'coupons');
      return [];
    }
  },

  // Sync Backup Snapshots to Firestore for Cloud Disaster Recovery
  async saveBackupSnapshot(snapshot: any): Promise<void> {
    await ensureFirebaseAuth();
    try {
      await setDoc(doc(db, 'backups', snapshot.id), {
        id: snapshot.id,
        timestamp: snapshot.timestamp,
        version: snapshot.version || '3.0',
        created_by: snapshot.created_by || 'Admin',
        products_count: Number(snapshot.products_count) || 0,
        sales_count: Number(snapshot.sales_count) || 0,
        customers_count: Number(snapshot.customers_count) || 0,
        expenses_count: Number(snapshot.expenses_count) || 0,
        payload_json: snapshot.payload_json,
        updated_at: new Date().toISOString()
      }, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `backups/${snapshot.id}`);
    }
  },

  async fetchBackupSnapshots(): Promise<any[]> {
    await ensureFirebaseAuth();
    try {
      const snap = await getDocs(collection(db, 'backups'));
      return snap.docs.map(d => d.data()).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'backups');
      return [];
    }
  },

  async deleteBackupSnapshot(id: string): Promise<void> {
    await ensureFirebaseAuth();
    try {
      await deleteDoc(doc(db, 'backups', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `backups/${id}`);
    }
  },

  // Sync Shifts to Firestore
  async saveShift(shift: any): Promise<void> {
    await ensureFirebaseAuth();
    try {
      await setDoc(doc(db, 'shifts', shift.id), {
        ...shift,
        updated_at: new Date().toISOString()
      }, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `shifts/${shift.id}`);
    }
  },

  async fetchShifts(): Promise<any[]> {
    await ensureFirebaseAuth();
    try {
      const snap = await getDocs(collection(db, 'shifts'));
      return snap.docs.map(d => d.data());
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'shifts');
      return [];
    }
  },

  // Wipe all test collections from Cloud Firestore for complete system reset
  async wipeAllCloudCollections(): Promise<{ success: boolean; deletedCount: number; message: string }> {
    await ensureFirebaseAuth();
    let totalDeleted = 0;
    const collectionsToWipe = [
      'products',
      'categories',
      'sales',
      'customers',
      'expenses',
      'returns',
      'suppliers',
      'purchase_orders',
      'coupons',
      'payrolls',
      'shifts',
      'backups',
      'stock_history',
      'audit_logs',
      'reservations',
      'notifications',
      'fraud_alerts',
      'sync_queue',
      'dead_stock',
      'price_overrides'
    ];

    try {
      for (const colName of collectionsToWipe) {
        try {
          const snap = await getDocs(collection(db, colName));
          const deletePromises = snap.docs.map(async (d) => {
            await deleteDoc(doc(db, colName, d.id));
            totalDeleted++;
          });
          await Promise.all(deletePromises);
        } catch (colErr) {
          console.warn(`Firestore wipe error on ${colName}:`, colErr);
        }
      }

      // Re-initialize default walk-in customer and clean settings in Firestore
      try {
        await setDoc(doc(db, 'customers', 'cust_walkin'), {
          id: 'cust_walkin',
          name: 'Walk-in Customer',
          phone: '00000000000',
          email: 'walkin@bloomandcarry.com',
          loyalty_points: 0,
          total_spent: 0,
          updated_at: new Date().toISOString()
        }, { merge: true });

        await setDoc(doc(db, 'settings', 'general'), {
          id: 'general',
          shopName: 'Bloom & Carry Cosmetics',
          tagline: 'Luxury Cosmetics, Skincare & Fragrances Retail',
          address: 'Hostel City Line 10, Yasmeen Plaza, Shop No. 1, Islamabad.',
          phone: '03461185406',
          website: 'bloomandcarry.com',
          currencySymbol: 'Rs. ',
          taxRate: 5,
          tax_rate: 5,
          tax_mode: 'EXCLUSIVE',
          updated_at: new Date().toISOString()
        }, { merge: true });
      } catch (reinitErr) {
        console.warn('Firestore reinit defaults error:', reinitErr);
      }

      return {
        success: true,
        deletedCount: totalDeleted,
        message: `Successfully wiped ${totalDeleted} cloud documents across ${collectionsToWipe.length} collections.`
      };
    } catch (err: any) {
      console.error('Firestore full wipe failed:', err);
      return {
        success: false,
        deletedCount: totalDeleted,
        message: err?.message || 'Failed to wipe cloud collections'
      };
    }
  },

  // Pull all live data from Firestore in one disaster recovery action
  async pullAllFromCloudFirestore(): Promise<{
    products: Product[];
    sales: Sale[];
    customers: Customer[];
    expenses: any[];
    returns: any[];
    shifts: any[];
  }> {
    const [products, sales, customers, expenses, returns, shifts] = await Promise.all([
      this.fetchProducts().catch(() => []),
      this.fetchSales().catch(() => []),
      this.fetchCustomers().catch(() => []),
      this.fetchExpenses().catch(() => []),
      this.fetchReturns().catch(() => []),
      this.fetchShifts().catch(() => [])
    ]);

    return {
      products,
      sales,
      customers,
      expenses,
      returns,
      shifts
    };
  }
};

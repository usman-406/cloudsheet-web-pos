/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Product, 
  Sale, 
  Customer, 
  Expense, 
  ShopSettings, 
  User, 
  ActiveTab,
  Supplier,
  ReturnTransaction,
  Category
} from './types';
import { StorageService } from './services/storage';
import { ApiService } from './services/api';
import { MongoDbService } from './services/mongodb_service';
import { OfflineSyncEngine } from './services/offline_sync_engine';
import { Header } from './components/Header';
import { LoginModal } from './components/LoginModal';
import { POSBilling } from './components/POSBilling';
import { ThermalReceipt } from './components/ThermalReceipt';
import { ReturnRefundModal } from './components/ReturnRefundModal';
import { ThermalReturnSlip } from './components/ThermalReturnSlip';
import { Dashboard } from './components/Dashboard';
import { ProductsManagement } from './components/ProductsManagement';
import { CategoriesManagement } from './components/CategoriesManagement';
import { SalesHistory } from './components/SalesHistory';
import { CustomersManagement } from './components/CustomersManagement';
import { ExpensesManagement } from './components/ExpensesManagement';
import { SettingsPage } from './components/SettingsPage';
import { GASGuideModal } from './components/GASGuideModal';
import { HardwareStatusHeaderBar } from './components/HardwareStatusHeaderBar';
import { HardwareDiagnosticsModal } from './components/HardwareDiagnosticsModal';
import { StockLedgerView } from './components/StockLedgerView';
import { SuppliersManagement } from './components/SuppliersManagement';
import { PurchaseOrdersManagement } from './components/PurchaseOrdersManagement';
import { ShiftRegisterManagement } from './components/ShiftRegisterManagement';
import { ImportExportCenter } from './components/ImportExportCenter';
import { SystemHealthPage } from './components/SystemHealthPage';
import { StockReservationsManagement } from './components/StockReservationsManagement';
import { SecurityAuditOverview } from './components/SecurityAuditOverview';
import { EmployeeProductivityAnalytics } from './components/EmployeeProductivityAnalytics';
import { AutomatedTestSuiteView } from './components/AutomatedTestSuiteView';
import { BIAdvancedAnalytics } from './components/BIAdvancedAnalytics';
import { DeadStockAnalyzer } from './components/DeadStockAnalyzer';
import { SmartReorderingEngine } from './components/SmartReorderingEngine';
import { EmployeeManagementView } from './components/EmployeeManagementView';
import { CustomerDisplayModal } from './components/CustomerDisplayModal';
import { EmergencyControlsPanel } from './components/EmergencyControlsPanel';
import { CommandPaletteModal } from './components/CommandPaletteModal';
import { GoogleWorkspaceModal } from './components/GoogleWorkspaceModal';
import { DailyBackupPromptModal } from './components/DailyBackupPromptModal';
import { SecurityConfirmDialog, ConfirmDetailItem } from './components/SecurityConfirmDialog';
import { HelpCircle, X, CheckCircle2 } from 'lucide-react';

export default function App() {
  // Auth & Navigation
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [tabHistory, setTabHistory] = useState<ActiveTab[]>(['pos']);
  const activeTab = tabHistory[tabHistory.length - 1] || 'pos';

  const handleNavigate = (tab: ActiveTab) => {
    if (tab === activeTab) return;
    const adminOnlyTabs: ActiveTab[] = [
      'dashboard',
      'products',
      'categories',
      'stock_ledger',
      'purchase_orders',
      'suppliers',
      'expenses',
      'import_export',
      'system_health',
      'reservations',
      'security_audit',
      'employee_productivity',
      'automated_tests',
      'bi_analytics',
      'dead_stock',
      'smart_reorder',
      'employee_management',
      'emergency_controls',
      'settings',
      'google_workspace',
      'gas_guide',
    ];

    if (currentUser?.role !== 'admin' && adminOnlyTabs.includes(tab)) {
      setTabHistory(['pos']);
      return;
    }
    setTabHistory(prev => [...prev, tab]);
  };

  const handleGoBack = () => {
    if (tabHistory.length > 1) {
      setTabHistory(prev => prev.slice(0, prev.length - 1));
    } else {
      setTabHistory(['pos']);
    }
  };

  // Application Data
  const [products, setProducts] = useState<Product[]>(() => StorageService.getProducts());
  const [categories, setCategories] = useState<Category[]>(() => StorageService.getCategories());
  const [sales, setSales] = useState<Sale[]>(() => StorageService.getSales());
  const [returns, setReturns] = useState<ReturnTransaction[]>(() => StorageService.getReturns());
  const [customers, setCustomers] = useState<Customer[]>(() => StorageService.getCustomers());
  const [suppliers, setSuppliers] = useState<Supplier[]>(() => StorageService.getSuppliers());
  const [expenses, setExpenses] = useState<Expense[]>(() => StorageService.getExpenses());
  const [settings, setSettings] = useState<ShopSettings>(() => StorageService.getSettings());
  const [users, setUsers] = useState<User[]>(() => StorageService.getUsers());

  // Sync & Modals
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncedFromGas, setSyncedFromGas] = useState<boolean>(false);
  const [lastReceiptSale, setLastReceiptSale] = useState<Sale | null>(null);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState<boolean>(false);
  const [returnPreselectedSale, setReturnPreselectedSale] = useState<Sale | null>(null);
  const [activeReturnSlip, setActiveReturnSlip] = useState<ReturnTransaction | null>(null);
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState<boolean>(false);
  const [isHardwareModalOpen, setIsHardwareModalOpen] = useState<boolean>(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState<boolean>(false);
  const [isGoogleWorkspaceModalOpen, setIsGoogleWorkspaceModalOpen] = useState<boolean>(false);
  const [isDailyBackupModalOpen, setIsDailyBackupModalOpen] = useState<boolean>(false);
  const [reconnectToast, setReconnectToast] = useState<{ count: number; time: string } | null>(null);

  // Security Safeguard Confirmation Dialog State
  const [securityConfirm, setSecurityConfirm] = useState<{
    isOpen: boolean;
    title: string;
    message: string | React.ReactNode;
    details?: ConfirmDetailItem[];
    confirmText?: string;
    cancelText?: string;
    variant?: 'danger' | 'warning' | 'info' | 'success';
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  // Initial Load & Storage Hydration
  useEffect(() => {
    // Always show login screen first on app start / reload
    StorageService.clearActiveUser();
    setCurrentUser(null);

    // Initialize the real-time offline sync engine
    OfflineSyncEngine.init().catch(err => {
      console.warn('OfflineSyncEngine init notice:', err);
    });

    const handleFlushedEvent = (e: any) => {
      if (e?.detail?.succeeded > 0) {
        setReconnectToast({
          count: e.detail.succeeded,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        });
        setTimeout(() => setReconnectToast(null), 6000);
      }
    };

    const handleResetEvent = () => {
      const updatedSettings = StorageService.getSettings();
      setSettings(updatedSettings);
      setProducts([]);
      setCategories(StorageService.getCategories());
      setSales([]);
      setReturns([]);
      setCustomers(StorageService.getCustomers());
      setExpenses([]);
      setSuppliers([]);
    };

    window.addEventListener('bloom_offline_sync_flushed', handleFlushedEvent);
    window.addEventListener('bloom_system_reset_completed', handleResetEvent);

    loadData();

    return () => {
      window.removeEventListener('bloom_offline_sync_flushed', handleFlushedEvent);
      window.removeEventListener('bloom_system_reset_completed', handleResetEvent);
    };
  }, []);

  const loadData = async () => {
    setIsSyncing(true);
    const currSettings = StorageService.getSettings();
    setSettings(currSettings);

    const result = await ApiService.loadAllData(currSettings.gas_web_app_url);
    if (result.success) {
      setProducts(result.products || []);
      const syncedCategories = StorageService.syncCategoriesFromProducts();
      setCategories(syncedCategories);
      setSales(result.sales || []);
      setCustomers(result.customers || []);
      setExpenses(result.expenses || []);
      setSuppliers(StorageService.getSuppliers());
      setReturns(StorageService.getReturns());
      setSyncedFromGas(result.syncedFromGas);
    }
    setIsSyncing(false);
  };

  const handleManualSync = () => {
    loadData();
  };

  // Return & Refund Handlers
  const handleOpenReturnModal = (sale?: Sale | unknown) => {
    const validSale = (sale && typeof sale === 'object' && 'invoice_no' in sale && typeof (sale as any).invoice_no === 'string')
      ? (sale as Sale)
      : null;
    setReturnPreselectedSale(validSale);
    setIsReturnModalOpen(true);
  };

  const handleReturnSuccess = (returnTx: ReturnTransaction) => {
    setProducts(StorageService.getProducts());
    setSales(StorageService.getSales());
    setCustomers(StorageService.getCustomers());
    setReturns(StorageService.getReturns());
    setActiveReturnSlip(returnTx);
  };

  const handleReprintReturnSlip = (returnTx: ReturnTransaction) => {
    setActiveReturnSlip(returnTx);
  };

  // Login & Logout
  const handleLogin = (user: User) => {
    setCurrentUser(user);
    StorageService.setActiveUser(user);
    // If cashier, ensure on POS billing tab
    if (user?.role === 'cashier') {
      setTabHistory(['pos']);
    }

    // Check if automated daily safety backup is due today
    if (StorageService.isDailyBackupDue()) {
      setTimeout(() => {
        setIsDailyBackupModalOpen(true);
      }, 1200);
    }
  };

  const handleLogout = () => {
    StorageService.clearActiveUser();
    setCurrentUser(null);
  };

  // Sale Checkout Handler
  const handleCheckoutSale = async (sale: Sale) => {
    // Attach cashier name if missing
    if (!sale.cashier_name && currentUser) {
      sale.cashier_name = currentUser.name;
    }

    const res = await ApiService.saveSale(sale, settings.gas_web_app_url);
    
    // Sync with MongoDB Atlas if enabled
    if (settings.mongodb_config?.enabled) {
      MongoDbService.syncSaleToMongo(settings.mongodb_config, sale);
    }

    setLastReceiptSale(sale);

    // Refresh state
    setProducts(StorageService.getProducts());
    setSales(StorageService.getSales());
    setCustomers(StorageService.getCustomers());
  };

  const handlePurgeMockData = () => {
    StorageService.purgeAllMockData();
    const updatedSettings = StorageService.getSettings();
    setSettings(updatedSettings);
    setProducts([]);
    setCategories(StorageService.getCategories());
    setSales([]);
    setReturns([]);
    setCustomers(StorageService.getCustomers());
    setExpenses([]);
    setSuppliers([]);
  };

  const handleResetSystem = async () => {
    const res = await StorageService.resetSystem();
    const updatedSettings = StorageService.getSettings();
    setSettings(updatedSettings);
    setProducts([]);
    setCategories(StorageService.getCategories());
    setSales([]);
    setReturns([]);
    setCustomers(StorageService.getCustomers());
    setExpenses([]);
    setSuppliers([]);
    return res;
  };

  const handleLoadMockData = () => {
    StorageService.loadMockData();
    const updatedSettings = StorageService.getSettings();
    setSettings(updatedSettings);
    setProducts(StorageService.getProducts());
    setCategories(StorageService.getCategories());
    setSales(StorageService.getSales());
    setReturns(StorageService.getReturns());
    setCustomers(StorageService.getCustomers());
    setExpenses(StorageService.getExpenses());
    setSuppliers(StorageService.getSuppliers());
  };

  // Category Handlers
  const handleSaveCategory = async (category: Category) => {
    await ApiService.saveCategory(category);
    setCategories(StorageService.getCategories());
    setProducts(StorageService.getProducts());
  };

  const handleDeleteCategory = async (id: string, reassignTo?: string) => {
    await ApiService.deleteCategory(id, reassignTo);
    setCategories(StorageService.getCategories());
    setProducts(StorageService.getProducts());
  };

  const handleQuickAddCategory = async (categoryName: string) => {
    const newCat = StorageService.addCategory(categoryName);
    await MongoDbService.saveCategory(newCat).catch(() => {});
    setCategories(StorageService.getCategories());
  };

  const handleResetCategories = () => {
    const cleanCats = StorageService.resetToRealCategories();
    setCategories(cleanCats);
    setProducts(StorageService.getProducts());
  };

  // Save Handlers
  const handleSaveProduct = async (product: Product) => {
    await ApiService.saveProduct(product, settings.gas_web_app_url);
    setProducts(StorageService.getProducts());
  };

  const handleBulkImportProducts = async (importedList: Partial<Product>[] | Product[]) => {
    if (importedList.length > 0 && 'stock_qty' in importedList[0] && 'id' in importedList[0]) {
      setProducts(StorageService.getProducts());
      const syncedCats = StorageService.syncCategoriesFromProducts();
      setCategories(syncedCats);
      return { allProducts: StorageService.getProducts() };
    }
    const result = StorageService.upsertProductsByBarcode(importedList, 'Bulk Inventory Import');
    setProducts(result.allProducts);
    const syncedCats = StorageService.syncCategoriesFromProducts();
    setCategories(syncedCats);
    return result;
  };

  const handleDeleteProduct = async (id: string) => {
    const prod = products.find(p => p.id === id);
    if (!prod) return;

    setSecurityConfirm({
      isOpen: true,
      title: `Delete Product "${prod.name}"`,
      message: 'Are you sure you want to permanently delete this product catalog item? This will remove it from barcode lookup and inventory ledger.',
      variant: 'danger',
      confirmText: 'Yes, Delete Product',
      cancelText: 'Keep Product',
      details: [
        { label: 'Product Name', value: prod.name, highlight: true },
        { label: 'Barcode', value: prod.barcode || 'N/A' },
        { label: 'Current Stock', value: `${prod.stock_qty} Units`, badge: prod.stock_qty > 0 ? 'In Stock' : 'Out of Stock', badgeColor: prod.stock_qty > 0 ? 'emerald' : 'rose' },
        { label: 'Sell Price', value: `${settings.currency_symbol || 'Rs.'} ${prod.sell_price}` }
      ],
      onConfirm: async () => {
        await ApiService.deleteProduct(id, settings.gas_web_app_url);
        setProducts(StorageService.getProducts());
        setSecurityConfirm(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleDeleteMultipleProducts = async (ids: string[]) => {
    const updated = StorageService.deleteMultipleProducts(ids);
    setProducts(updated);
  };

  const handleDeleteSale = async (saleId: string, restoreStock: boolean = true) => {
    const res = StorageService.deleteSales([saleId], restoreStock);
    setSales(res.remainingSales);
    setProducts(res.updatedProducts);
  };

  const handleDeleteMultipleSales = async (saleIds: string[], restoreStock: boolean = true) => {
    const res = StorageService.deleteSales(saleIds, restoreStock);
    setSales(res.remainingSales);
    setProducts(res.updatedProducts);
  };

  const handleDeleteReturn = async (returnNoOrId: string) => {
    StorageService.deleteReturn(returnNoOrId);
    setReturns(StorageService.getReturns());
  };

  const handleStockAdjust = async (productId: string, type: 'IN' | 'OUT', qty: number, note: string) => {
    const found = products.find(p => p.id === productId);
    if (!found) return;

    const delta = type === 'IN' ? qty : -qty;
    const newQty = Math.max(0, found.stock_qty + delta);
    const updated = { ...found, stock_qty: newQty };

    await ApiService.saveProduct(updated, settings.gas_web_app_url);

    StorageService.addStockHistory({
      id: `sh_${Date.now()}`,
      product_id: productId,
      product_name: found.name,
      type,
      qty_change: qty,
      new_qty: newQty,
      date: new Date().toISOString(),
      note,
      user_name: currentUser?.name || 'Manager'
    });

    setProducts(StorageService.getProducts());
  };

  const handleSaveCustomer = async (customer: Customer) => {
    await ApiService.saveCustomer(customer, settings.gas_web_app_url);
    setCustomers(StorageService.getCustomers());
  };

  const handleDeleteCustomer = async (id: string) => {
    StorageService.deleteCustomer(id);
    setCustomers(StorageService.getCustomers());
  };

  const handleDeleteMultipleCustomers = async (ids: string[]) => {
    const updated = StorageService.deleteMultipleCustomers(ids);
    setCustomers(updated);
  };

  const handleSaveExpense = async (expense: Expense) => {
    await ApiService.saveExpense(expense, settings.gas_web_app_url);
    setExpenses(StorageService.getExpenses());
  };

  const handleDeleteExpense = async (id: string) => {
    StorageService.deleteExpense(id);
    setExpenses(StorageService.getExpenses());
  };

  const handleDeleteMultipleExpenses = async (ids: string[]) => {
    const updated = StorageService.deleteMultipleExpenses(ids);
    setExpenses(updated);
  };

  const handleSaveSettings = async (newSettings: ShopSettings) => {
    setSettings(newSettings);
    await ApiService.saveSettings(newSettings, newSettings.gas_web_app_url);
    loadData();
  };

  const handleVoidSale = (saleId: string) => {
    const foundSale = sales.find(s => s.id === saleId);
    if (!foundSale) return;

    setSecurityConfirm({
      isOpen: true,
      title: `Void Invoice #${foundSale.invoice_no}`,
      message: 'Are you sure you want to void this invoice? This will restore product stock back into inventory and mark the invoice as voided.',
      variant: 'danger',
      confirmText: 'Yes, Void Invoice',
      cancelText: 'Keep Invoice Active',
      details: [
        { label: 'Invoice No', value: foundSale.invoice_no, highlight: true },
        { label: 'Customer', value: foundSale.customer_name },
        { label: 'Total Amount', value: `${settings.currency_symbol || 'Rs.'} ${(foundSale.total ?? 0).toLocaleString()}`, highlight: true },
        { label: 'Payment Method', value: foundSale.payment_method, badge: foundSale.payment_method, badgeColor: 'purple' },
        { label: 'Items Sold', value: `${foundSale.items.length} Products` }
      ],
      onConfirm: () => {
        const salesList = StorageService.getSales();
        const updated = salesList.map(s => {
          if (s.id === saleId) return { ...s, status: 'voided' as const };
          return s;
        });
        StorageService.saveSales(updated);
        
        // Restore stock
        const productsList = StorageService.getProducts();
        for (const item of foundSale.items) {
          const prod = productsList.find(p => p.id === item.product_id || p.barcode === item.barcode);
          if (prod) {
            prod.stock_qty += item.quantity;
          }
        }
        StorageService.saveProducts(productsList);

        setSales(updated);
        setProducts(productsList);
        setSecurityConfirm(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  // If no user is authenticated, show login screen
  if (!currentUser) {
    return (
      <LoginModal
        users={users}
        onLogin={handleLogin}
        shopName={settings.shop_name}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col text-slate-800 font-sans antialiased">
      
      {/* Hardware Device Polling Status Header Bar */}
      <HardwareStatusHeaderBar
        onOpenDiagnostics={() => setIsHardwareModalOpen(true)}
        onOpenLedger={() => handleNavigate('stock_ledger')}
      />

      {/* Top Header Navigation */}
      <Header
        activeTab={activeTab}
        setActiveTab={handleNavigate}
        onGoBack={handleGoBack}
        currentUser={currentUser}
        onLogout={handleLogout}
        settings={settings}
        isSyncing={isSyncing}
        syncedFromGas={syncedFromGas}
        onManualSync={handleManualSync}
        onOpenShortcuts={() => setIsShortcutsModalOpen(true)}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        onOpenDailyBackup={() => setIsDailyBackupModalOpen(true)}
      />

      {/* Main Tab View Router */}
      <main className="flex-1 pb-12">
        {activeTab === 'pos' && (
          <POSBilling
            products={products}
            categoriesList={categories}
            customers={customers}
            settings={settings}
            onCheckout={handleCheckoutSale}
            onAddCustomer={handleSaveCustomer}
            onOpenReturnModal={() => handleOpenReturnModal()}
          />
        )}

        {activeTab === 'shift_register' && (
          <ShiftRegisterManagement
            settings={settings}
            activeUser={currentUser}
          />
        )}

        {activeTab === 'dashboard' && currentUser?.role === 'admin' && (
          <Dashboard
            sales={sales}
            products={products}
            returns={returns}
            expenses={expenses}
            settings={settings}
            onNavigateToProducts={() => handleNavigate('products')}
          />
        )}

        {activeTab === 'products' && currentUser?.role === 'admin' && (
          <ProductsManagement
            products={products}
            categoriesList={categories}
            settings={settings}
            onSaveProduct={handleSaveProduct}
            onBulkImportProducts={handleBulkImportProducts}
            onDeleteProduct={handleDeleteProduct}
            onDeleteMultipleProducts={handleDeleteMultipleProducts}
            onStockAdjust={handleStockAdjust}
            onNavigateToCategories={() => handleNavigate('categories')}
            onQuickAddCategory={handleQuickAddCategory}
          />
        )}

        {activeTab === 'categories' && currentUser?.role === 'admin' && (
          <CategoriesManagement
            categories={categories}
            products={products}
            settings={settings}
            onSaveCategory={handleSaveCategory}
            onDeleteCategory={handleDeleteCategory}
            onResetCategories={handleResetCategories}
            onSyncFromProducts={() => {
              const updated = StorageService.syncCategoriesFromProducts();
              setCategories(updated);
            }}
            onNavigateToProductsWithCategory={(catName) => {
              handleNavigate('products');
            }}
          />
        )}

        {activeTab === 'stock_ledger' && currentUser?.role === 'admin' && (
          <StockLedgerView settings={settings} />
        )}

        {activeTab === 'purchase_orders' && currentUser?.role === 'admin' && (
          <PurchaseOrdersManagement />
        )}

        {activeTab === 'suppliers' && currentUser?.role === 'admin' && (
          <SuppliersManagement />
        )}

        {activeTab === 'sales' && (
          <SalesHistory
            sales={sales}
            returns={returns}
            settings={settings}
            onReprintReceipt={(sale) => setLastReceiptSale(sale)}
            onVoidSale={handleVoidSale}
            onInitiateReturn={(sale) => handleOpenReturnModal(sale)}
            onOpenReturnModal={() => handleOpenReturnModal()}
            onReprintReturnSlip={handleReprintReturnSlip}
            onDeleteSale={handleDeleteSale}
            onDeleteSales={handleDeleteMultipleSales}
            onDeleteReturn={handleDeleteReturn}
          />
        )}

        {activeTab === 'customers' && (
          <CustomersManagement
            customers={customers}
            settings={settings}
            onSaveCustomer={handleSaveCustomer}
            onDeleteCustomer={handleDeleteCustomer}
            onDeleteMultipleCustomers={handleDeleteMultipleCustomers}
          />
        )}

        {activeTab === 'expenses' && currentUser?.role === 'admin' && (
          <ExpensesManagement
            expenses={expenses}
            settings={settings}
            onSaveExpense={handleSaveExpense}
            onDeleteExpense={handleDeleteExpense}
            onDeleteMultipleExpenses={handleDeleteMultipleExpenses}
          />
        )}

        {activeTab === 'import_export' && currentUser?.role === 'admin' && (
          <ImportExportCenter
            settings={settings}
            products={products}
            customers={customers}
            expenses={expenses}
            onRefreshData={loadData}
          />
        )}

        {activeTab === 'system_health' && currentUser?.role === 'admin' && (
          <SystemHealthPage
            settings={settings}
            onRefreshData={loadData}
          />
        )}

        {activeTab === 'reservations' && currentUser?.role === 'admin' && (
          <StockReservationsManagement
            products={products}
            settings={settings}
            onRefreshData={loadData}
          />
        )}

        {activeTab === 'security_audit' && currentUser?.role === 'admin' && (
          <SecurityAuditOverview
            settings={settings}
            activeUser={currentUser}
          />
        )}

        {activeTab === 'employee_productivity' && currentUser?.role === 'admin' && (
          <EmployeeProductivityAnalytics
            sales={sales}
            activeUser={currentUser}
          />
        )}

        {activeTab === 'automated_tests' && currentUser?.role === 'admin' && (
          <AutomatedTestSuiteView
            settings={settings}
            products={products}
          />
        )}

        {activeTab === 'bi_analytics' && currentUser?.role === 'admin' && (
          <BIAdvancedAnalytics
            sales={sales}
            products={products}
            customers={customers}
            suppliers={suppliers}
            returns={returns}
            expenses={expenses}
            settings={settings}
            onRefresh={loadData}
            onNavigateToTab={handleNavigate}
          />
        )}

        {activeTab === 'dead_stock' && currentUser?.role === 'admin' && (
          <DeadStockAnalyzer
            products={products}
            onApplyDiscount={(productId, discountPercent) => {
              alert(`Clearance discount of ${discountPercent}% flagged for product.`);
            }}
          />
        )}

        {activeTab === 'smart_reorder' && currentUser?.role === 'admin' && (
          <SmartReorderingEngine
            products={products}
            suppliers={suppliers}
            onCreateDraftPO={async (po) => {
              const pos = StorageService.getPurchaseOrders();
              pos.unshift(po as any);
              StorageService.savePurchaseOrders(pos);
              loadData();
              handleNavigate('purchase_orders');
            }}
          />
        )}

        {activeTab === 'employee_management' && currentUser?.role === 'admin' && (
          <EmployeeManagementView
            activeUser={currentUser}
          />
        )}

        {activeTab === 'emergency_controls' && currentUser?.role === 'admin' && (
          <EmergencyControlsPanel
            settings={settings}
            activeUser={currentUser}
            onUpdateSettings={async (updated) => {
              setSettings(updated);
              StorageService.saveSettings(updated);
            }}
          />
        )}

        {activeTab === 'settings' && currentUser?.role === 'admin' && (
          <SettingsPage
            settings={settings}
            onSaveSettings={handleSaveSettings}
            onNavigateToGasGuide={() => handleNavigate('gas_guide')}
            onManualSync={handleManualSync}
            onPurgeMockData={handlePurgeMockData}
            onLoadMockData={handleLoadMockData}
            onResetSystem={handleResetSystem}
          />
        )}

        {activeTab === 'gas_guide' && currentUser?.role === 'admin' && (
          <GASGuideModal onClose={() => handleNavigate('settings')} />
        )}

        {activeTab === 'google_workspace' && currentUser?.role === 'admin' && (
          <GoogleWorkspaceModal
            products={products}
            sales={sales}
            customers={customers}
            settings={settings}
            isOpen={true}
            onClose={() => handleNavigate('pos')}
            onDataImported={loadData}
          />
        )}
      </main>

      {/* Global Command Palette Modal (Cmd+K) */}
      <CommandPaletteModal
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        products={products}
        customers={customers}
        currentUser={currentUser}
        onSelectTab={handleNavigate}
      />


      {/* Hardware Diagnostics Modal */}
      {isHardwareModalOpen && (
        <HardwareDiagnosticsModal
          settings={settings}
          onClose={() => setIsHardwareModalOpen(false)}
        />
      )}

      {/* Thermal Receipt Preview Modal */}
      {lastReceiptSale && (
        <ThermalReceipt
          sale={lastReceiptSale}
          settings={settings}
          onClose={() => setLastReceiptSale(null)}
        />
      )}

      {/* Return & Refund Modal */}
      {isReturnModalOpen && (
        <ReturnRefundModal
          isOpen={isReturnModalOpen}
          preSelectedSale={returnPreselectedSale}
          settings={settings}
          onClose={() => {
            setIsReturnModalOpen(false);
            setReturnPreselectedSale(null);
          }}
          onReturnSuccess={handleReturnSuccess}
        />
      )}

      {/* Thermal Return Slip Preview Modal */}
      {activeReturnSlip && (
        <ThermalReturnSlip
          returnTx={activeReturnSlip}
          settings={settings}
          onClose={() => setActiveReturnSlip(null)}
        />
      )}

      {/* Keyboard Shortcuts Cheat Sheet Modal */}
      {isShortcutsModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100 p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center space-x-2">
                <HelpCircle className="w-5 h-5 text-[#0b5fa5]" />
                <h3 className="font-extrabold text-slate-800 text-base">POS Keyboard Shortcuts</h3>
              </div>
              <button 
                onClick={() => setIsShortcutsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between p-2 bg-slate-50 rounded-xl">
                <span className="font-bold text-slate-700">F1 Key</span>
                <span className="bg-blue-100 text-[#0b5fa5] font-extrabold px-2 py-1 rounded">New Sale / Clear</span>
              </div>
              <div className="flex items-center justify-between p-2 bg-slate-50 rounded-xl">
                <span className="font-bold text-slate-700">F2 Key</span>
                <span className="bg-blue-100 text-[#0b5fa5] font-extrabold px-2 py-1 rounded">Focus Product Search</span>
              </div>
              <div className="flex items-center justify-between p-2 bg-slate-50 rounded-xl">
                <span className="font-bold text-slate-700">F4 Key</span>
                <span className="bg-emerald-100 text-emerald-800 font-extrabold px-2 py-1 rounded">Open Payment Modal</span>
              </div>
              <div className="flex items-center justify-between p-2 bg-slate-50 rounded-xl">
                <span className="font-bold text-slate-700">F6 Key</span>
                <span className="bg-rose-100 text-rose-800 font-extrabold px-2 py-1 rounded">Return & Refund Modal</span>
              </div>
              <div className="flex items-center justify-between p-2 bg-slate-50 rounded-xl">
                <span className="font-bold text-slate-700">F8 Key</span>
                <span className="bg-amber-100 text-amber-900 font-extrabold px-2 py-1 rounded">Direct Checkout & Print</span>
              </div>
              <div className="flex items-center justify-between p-2 bg-slate-50 rounded-xl">
                <span className="font-bold text-slate-700">ESC Key</span>
                <span className="bg-red-100 text-red-700 font-extrabold px-2 py-1 rounded">Close Modal / Clear Cart</span>
              </div>
              <div className="flex items-center justify-between p-2 bg-slate-50 rounded-xl">
                <span className="font-bold text-slate-700">USB Barcode Gun</span>
                <span className="bg-indigo-100 text-indigo-800 font-extrabold px-2 py-1 rounded">Auto Scans & Adds to Cart</span>
              </div>
            </div>

            <button
              onClick={() => setIsShortcutsModalOpen(false)}
              className="w-full py-2.5 bg-[#0b5fa5] hover:bg-[#094e88] text-white font-bold rounded-xl text-xs shadow"
            >
              Close Guide
            </button>
          </div>
        </div>
      )}

      {/* Google Workspace & Cloud Center Modal */}
      {isGoogleWorkspaceModalOpen && currentUser?.role === 'admin' && (
        <GoogleWorkspaceModal
          products={products}
          sales={sales}
          customers={customers}
          settings={settings}
          isOpen={isGoogleWorkspaceModalOpen}
          onClose={() => setIsGoogleWorkspaceModalOpen(false)}
          onDataImported={loadData}
        />
      )}

      {/* Daily Automated Safety Backup Prompt Modal */}
      <DailyBackupPromptModal
        isOpen={isDailyBackupModalOpen}
        onClose={() => setIsDailyBackupModalOpen(false)}
        productsCount={products.length}
        salesCount={sales.length}
        customersCount={customers.length}
      />

      {/* Global App-Wide Security Confirmation Dialog */}
      <SecurityConfirmDialog
        isOpen={securityConfirm.isOpen}
        title={securityConfirm.title}
        message={securityConfirm.message}
        details={securityConfirm.details}
        confirmText={securityConfirm.confirmText}
        cancelText={securityConfirm.cancelText}
        variant={securityConfirm.variant}
        onConfirm={securityConfirm.onConfirm}
        onCancel={() => setSecurityConfirm(prev => ({ ...prev, isOpen: false }))}
      />

      {/* Offline-to-Online Reconnection Sync Alert */}
      {reconnectToast && (
        <div className="fixed bottom-5 right-5 z-50 max-w-sm bg-emerald-950/90 text-emerald-100 border border-emerald-400/40 rounded-xl shadow-2xl p-3.5 flex items-start space-x-3 animate-in fade-in slide-in-from-bottom-5">
          <div className="p-2 bg-emerald-500/20 rounded-lg text-emerald-300">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="flex-1 text-xs">
            <div className="font-bold text-emerald-200">⚡ Connection Restored!</div>
            <div className="mt-0.5 text-emerald-100/90 leading-relaxed">
              Successfully synced <strong className="text-white">{reconnectToast.count}</strong> offline changes & transactions to Cloud Firestore Database & Google Sheets.
            </div>
            <div className="mt-1 text-[10px] text-emerald-300/70">Synced at {reconnectToast.time}</div>
          </div>
          <button 
            onClick={() => setReconnectToast(null)}
            className="text-emerald-300 hover:text-white p-1 rounded-md"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

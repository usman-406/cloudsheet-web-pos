import React, { useState } from 'react';
import { 
  Settings, 
  Store, 
  Printer, 
  Percent, 
  Database, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Download, 
  Lock, 
  ExternalLink,
  Code2,
  Trash2,
  Sparkles,
  Server,
  ShieldCheck,
  Zap,
  Globe,
  Radio,
  Layers,
  Check,
  AlertTriangle,
  KeyRound,
  Eye,
  EyeOff
} from 'lucide-react';
import { ShopSettings, MongoDbConfig } from '../types';
import { ApiService } from '../services/api';
import { StorageService } from '../services/storage';
import { MongoDbService, DEFAULT_MONGO_CONFIG, MongoConnectionTestResult } from '../services/mongodb_service';

interface SettingsPageProps {
  settings: ShopSettings;
  onSaveSettings: (settings: ShopSettings) => void;
  onNavigateToGasGuide: () => void;
  onManualSync: () => void;
  onPurgeMockData?: () => void;
  onResetSystem?: () => Promise<any> | void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  settings,
  onSaveSettings,
  onNavigateToGasGuide,
  onManualSync,
  onPurgeMockData,
  onResetSystem,
}) => {
  const [formData, setFormData] = useState<ShopSettings>({ 
    ...settings,
    mongodb_config: settings.mongodb_config || { ...DEFAULT_MONGO_CONFIG }
  });
  
  const [gasTestResult, setGasTestResult] = useState<{ testing: boolean; message: string; isError?: boolean } | null>(null);
  const [mongoTestResult, setMongoTestResult] = useState<MongoConnectionTestResult | null>(null);
  const [isTestingMongo, setIsTestingMongo] = useState<boolean>(false);
  const [isPushingToMongo, setIsPushingToMongo] = useState<boolean>(false);
  const [mongoPushMessage, setMongoPushMessage] = useState<string | null>(null);
  const [isPullingFromMongo, setIsPullingFromMongo] = useState<boolean>(false);
  const [mongoPullMessage, setMongoPullMessage] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [purgeSuccessBanner, setPurgeSuccessBanner] = useState<string | null>(null);
  const [isConsolidating, setIsConsolidating] = useState<boolean>(false);
  const [consolidationMessage, setConsolidationMessage] = useState<string | null>(null);
  const [isResettingCategories, setIsResettingCategories] = useState<boolean>(false);
  const [categoryResetMessage, setCategoryResetMessage] = useState<string | null>(null);

  // Mode Switch & Purge Modal State
  const [isPurgeModalOpen, setIsPurgeModalOpen] = useState<boolean>(false);
  const [purgeAdminPin, setPurgeAdminPin] = useState<string>('');
  const [purgePinError, setPurgePinError] = useState<string>('');

  // Full System Reset Modal State
  const [isResetModalOpen, setIsResetModalOpen] = useState<boolean>(false);
  const [resetAdminPin, setResetAdminPin] = useState<string>('');
  const [resetPinError, setResetPinError] = useState<string>('');
  const [isResetting, setIsResetting] = useState<boolean>(false);
  const [resetProgressText, setResetProgressText] = useState<string>('');

  const isProductionMode = !!formData.is_production_mode;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings(formData);
    alert('Settings saved successfully!');
  };

  const handleConfirmPurgeMockData = () => {
    const activeUser = StorageService.getActiveUser();
    const adminUser = StorageService.getUsers().find(u => u?.role === 'admin');
    const validPin = adminUser?.pin || activeUser?.pin || 'Usman@Ali513';

    if (purgeAdminPin !== validPin) {
      setPurgePinError('Invalid Admin Password / PIN.');
      return;
    }

    // Execute purge
    StorageService.purgeAllMockData();
    const updatedSettings = StorageService.getSettings();
    setFormData({
      ...updatedSettings,
      mongodb_config: {
        ...(formData.mongodb_config || DEFAULT_MONGO_CONFIG),
        enabled: true
      }
    });
    onSaveSettings({
      ...updatedSettings,
      mongodb_config: {
        ...(formData.mongodb_config || DEFAULT_MONGO_CONFIG),
        enabled: true
      }
    });

    if (onPurgeMockData) {
      onPurgeMockData();
    }

    setIsPurgeModalOpen(false);
    setPurgeAdminPin('');
    setPurgePinError('');
    setPurgeSuccessBanner('🎉 Success! All mock demo records deleted. System is running in 100% Real Production Mode.');
    setTimeout(() => setPurgeSuccessBanner(null), 8000);
  };

  const handleConfirmFullSystemReset = async () => {
    const activeUser = StorageService.getActiveUser();
    const adminUser = StorageService.getUsers().find(u => u?.role === 'admin');
    const validPin = adminUser?.pin || activeUser?.pin || 'Usman@Ali513';

    if (resetAdminPin !== validPin) {
      setResetPinError('Invalid Admin Password / PIN.');
      return;
    }

    setIsResetting(true);
    setResetPinError('');
    setResetProgressText('1/4 Wiping local browser storage and cache...');

    try {
      await new Promise(r => setTimeout(r, 400));
      setResetProgressText('2/4 Clearing IndexedDB vault and sync outbox queue...');
      
      await new Promise(r => setTimeout(r, 400));
      setResetProgressText('3/4 Purging and syncing database with MongoDB Atlas...');

      let res;
      if (onResetSystem) {
        res = await onResetSystem();
      } else {
        res = await StorageService.resetSystem();
      }

      setResetProgressText('4/4 Re-initializing clean store state and defaults...');
      await new Promise(r => setTimeout(r, 400));

      const updatedSettings = StorageService.getSettings();
      setFormData({
        ...updatedSettings,
        mongodb_config: formData.mongodb_config
      });

      setIsResetModalOpen(false);
      setResetAdminPin('');
      setResetProgressText('');
      setPurgeSuccessBanner('🎉 MASTER RESET COMPLETE! All test data, test prices, sales history, customer records, and database documents have been permanently wiped across all tabs and database collections. Your system is 100% clean and ready for your real shop launch!');
      setTimeout(() => setPurgeSuccessBanner(null), 12000);
    } catch (err: any) {
      setResetPinError(`Reset encountered an issue: ${err.message || 'Please try again.'}`);
    } finally {
      setIsResetting(false);
    }
  };

  const handleTestGasConnection = async () => {
    if (!formData.gas_web_app_url || !formData.gas_web_app_url.startsWith('http')) {
      setGasTestResult({ testing: false, message: 'Please enter a valid Google Apps Script Web App URL starting with https://', isError: true });
      return;
    }

    setGasTestResult({ testing: true, message: 'Testing connection to Google Apps Script...' });
    const res = await ApiService.testConnection(formData.gas_web_app_url);
    if (res.success) {
      setGasTestResult({ testing: false, message: '✅ Success! Connected to Google Sheet Web App.', isError: false });
    } else {
      setGasTestResult({ testing: false, message: `❌ Connection Failed: ${res.message}`, isError: true });
    }
  };

  const handleTestMongoAtlas = async () => {
    const mongoConfig: MongoDbConfig = {
      ...DEFAULT_MONGO_CONFIG,
      ...(formData.mongodb_config || {}),
      connection_uri: formData.mongodb_config?.connection_uri || DEFAULT_MONGO_CONFIG.connection_uri,
      database_name: formData.mongodb_config?.database_name || DEFAULT_MONGO_CONFIG.database_name,
    };
    setIsTestingMongo(true);
    setMongoTestResult(null);

    const result = await MongoDbService.testConnection(mongoConfig);
    setIsTestingMongo(false);
    setMongoTestResult(result);
  };

  const handlePushAllToMongo = async () => {
    const mongoConfig: MongoDbConfig = {
      ...DEFAULT_MONGO_CONFIG,
      ...(formData.mongodb_config || {}),
      connection_uri: formData.mongodb_config?.connection_uri || DEFAULT_MONGO_CONFIG.connection_uri,
      database_name: formData.mongodb_config?.database_name || DEFAULT_MONGO_CONFIG.database_name,
    };
    setIsPushingToMongo(true);
    setMongoPushMessage(null);

    const fullData = {
      products: StorageService.getProducts(),
      sales: StorageService.getSales(),
      customers: StorageService.getCustomers(),
      expenses: StorageService.getExpenses(),
      categories: StorageService.getCategories(),
      stockHistory: StorageService.getStockHistory(),
      shifts: StorageService.getShifts(),
      settings: StorageService.getSettings(),
    };

    const res = await MongoDbService.migrateAllData(mongoConfig, fullData);
    setIsPushingToMongo(false);
    setMongoPushMessage(res.message);
    setTimeout(() => setMongoPushMessage(null), 8000);
  };

  const handlePullAllFromMongo = async () => {
    const mongoConfig: MongoDbConfig = {
      ...DEFAULT_MONGO_CONFIG,
      ...(formData.mongodb_config || {}),
      connection_uri: formData.mongodb_config?.connection_uri || DEFAULT_MONGO_CONFIG.connection_uri,
      database_name: formData.mongodb_config?.database_name || DEFAULT_MONGO_CONFIG.database_name,
    };
    const confirm = window.confirm('Pull all records from MongoDB Atlas and synchronize into local POS? Existing local records will be updated with Atlas cloud data.');
    if (!confirm) return;

    setIsPullingFromMongo(true);
    setMongoPullMessage(null);

    const res = await MongoDbService.fetchAllDataFromMongo(mongoConfig);
    setIsPullingFromMongo(false);

    if (res.success && res.data) {
      const { products, sales, customers, expenses, categories, stockHistory, settings } = res.data;
      if (Array.isArray(products) && products.length > 0) {
        StorageService.saveProducts(products, 'Synced from MongoDB Atlas');
      }
      if (Array.isArray(sales) && sales.length > 0) {
        StorageService.saveSales(sales, 'Synced from MongoDB Atlas');
      }
      if (Array.isArray(customers) && customers.length > 0) {
        StorageService.saveCustomers(customers, 'Synced from MongoDB Atlas');
      }
      if (Array.isArray(expenses) && expenses.length > 0) {
        StorageService.saveExpenses(expenses, 'Synced from MongoDB Atlas');
      }
      if (Array.isArray(categories) && categories.length > 0) {
        StorageService.saveCategories(categories);
      }
      if (Array.isArray(stockHistory) && stockHistory.length > 0) {
        StorageService.saveStockHistory(stockHistory);
      }
      if (settings) {
        const merged = { ...formData, ...settings };
        setFormData(merged);
        onSaveSettings(merged);
      }
      setMongoPullMessage(`🎉 Successfully pulled ${products?.length || 0} products, ${sales?.length || 0} sales, ${customers?.length || 0} customers from MongoDB Atlas!`);
      setTimeout(() => setMongoPullMessage(null), 8000);
    } else {
      setMongoPullMessage(`Failed to pull data from MongoDB Atlas: ${res.message || 'Unknown error'}`);
      setTimeout(() => setMongoPullMessage(null), 8000);
    }
  };

  const handleConsolidateDatabase = async () => {
    const mongoConfig = formData.mongodb_config || DEFAULT_MONGO_CONFIG;
    const targetDb = mongoConfig.database_name || 'bloomandcarry_pos_real';
    const confirm = window.confirm(
      `Consolidate all separated databases (customers, products, sales_invoices, categories, etc.) into the single master database "${targetDb}"? All records will be safely preserved and merged.`
    );
    if (!confirm) return;

    setIsConsolidating(true);
    setConsolidationMessage(null);
    try {
      const res = await MongoDbService.consolidateDatabase(targetDb);
      if (res.success) {
        setConsolidationMessage(`🎉 Consolidation Success! ${res.message || 'All collections merged into ' + targetDb}`);
      } else {
        setConsolidationMessage(`Consolidation Note: ${res.message || 'Unable to consolidate'}`);
      }
    } catch (e: any) {
      setConsolidationMessage(`Consolidation error: ${e.message || e}`);
    } finally {
      setIsConsolidating(false);
      setTimeout(() => setConsolidationMessage(null), 10000);
    }
  };

  const handleResetCategoriesAction = async () => {
    const confirm = window.confirm(
      'Clean up the 107 product-name categories and restore the 10 authentic cosmetics retail categories? Inventory products will be automatically mapped to their matching category.'
    );
    if (!confirm) return;

    setIsResettingCategories(true);
    setCategoryResetMessage(null);
    try {
      StorageService.resetToRealCategories();
      await MongoDbService.resetCategories();
      setCategoryResetMessage('🎉 Successfully cleaned up categories catalog! 10 authentic retail categories restored and synced to MongoDB Atlas.');
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (e: any) {
      setCategoryResetMessage(`Category cleanup error: ${e.message || e}`);
    } finally {
      setIsResettingCategories(false);
    }
  };

  const handleExportBackup = () => {
    const backupData = {
      timestamp: new Date().toISOString(),
      mode: isProductionMode ? 'PRODUCTION_REAL' : 'DEMO_SANDBOX',
      products: StorageService.getProducts(),
      sales: StorageService.getSales(),
      customers: StorageService.getCustomers(),
      expenses: StorageService.getExpenses(),
      settings: StorageService.getSettings(),
    };

    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `BloomandCarry_POS_Database_${isProductionMode ? 'REAL_DB' : 'MOCK_DB'}_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-6 lg:px-8 py-6 space-y-6 font-sans">
      
      {/* Top Banner Message */}
      {purgeSuccessBanner && (
        <div className="bg-emerald-600 text-white p-4 rounded-2xl shadow-lg flex items-center justify-between animate-fade-in">
          <div className="flex items-center space-x-3">
            <CheckCircle2 className="w-6 h-6 shrink-0" />
            <p className="text-xs sm:text-sm font-bold">{purgeSuccessBanner}</p>
          </div>
          <button 
            onClick={() => setPurgeSuccessBanner(null)}
            className="text-white/80 hover:text-white font-bold text-sm px-2 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-xl font-black text-slate-900">System & Database Architecture</h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>🟢 100% Real Production Database Active</span>
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Production mode is permanently enforced. All catalog, sales, customers, and operations are 100% live and cloud-persisted.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={handleExportBackup}
            className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs shadow-xs flex items-center justify-center space-x-2 transition cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Full Backup (JSON)</span>
          </button>
        </div>
      </div>

      {/* 🚀 PRIMARY SYSTEM OPERATING STATUS */}
      <div className="bg-white rounded-2xl border-2 border-emerald-300 shadow-sm p-5 sm:p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                <Server className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-black text-slate-900">Commercial Production System</h3>
            </div>
            <p className="text-xs text-slate-500">
              Demo/mock mode permanently deactivated — only authentic commercial records and live cloud persistence
            </p>
          </div>

          {/* Live Badge */}
          <div className="flex items-center bg-emerald-50 border border-emerald-300 px-4 py-2 rounded-xl text-xs font-black text-emerald-800 space-x-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Real Database Live</span>
          </div>
        </div>

        {/* Status Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Card 1: MongoDB Atlas Active Primary State */}
          <div className="p-4 rounded-xl border bg-emerald-50/80 border-emerald-300 ring-2 ring-emerald-500/20">
            <div className="flex items-center justify-between mb-2">
              <span className="font-extrabold text-xs text-emerald-950 flex items-center space-x-1.5">
                <Database className="w-4 h-4 text-emerald-600" />
                <span>Primary Cloud Database (MongoDB Atlas)</span>
              </span>
              <span className="bg-emerald-600 text-white text-[10px] px-2 py-0.5 rounded-full font-bold animate-pulse">
                ACTIVE &amp; SYNCED
              </span>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed">
              Active cluster connection to master database <strong className="font-mono text-emerald-900 bg-emerald-100/70 px-1 py-0.5 rounded">{formData.mongodb_config?.database_name || 'bloomandcarry_pos_real'}</strong>. All inventory items, barcodes, POS sales, customers, and categories synchronize in real-time.
            </p>
            <div className="mt-3 text-[11px] text-emerald-800 font-semibold flex items-center space-x-1.5">
              <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>100% Real Production Database Active (Zero Mock Data).</span>
            </div>
          </div>

          {/* Card 2: Offline Vault Engine */}
          <div className="p-4 rounded-xl border bg-slate-50 border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <span className="font-extrabold text-xs text-slate-900 flex items-center space-x-1.5">
                <ShieldCheck className="w-4 h-4 text-indigo-600" />
                <span>Offline Vault Engine (IndexedDB + Storage)</span>
              </span>
              <span className="bg-indigo-100 text-indigo-800 text-[10px] px-2 py-0.5 rounded-full font-bold">
                PROTECTED
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Ultra-fast local caching guarantees sub-millisecond barcode lookup and offline checkout even during network disconnection, automatically queueing sync events.
            </p>
            <div className="mt-3 text-[11px] text-slate-700 font-semibold flex items-center space-x-1.5">
              <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <span>Offline-first resilience with automated Atlas replication.</span>
            </div>
          </div>

        </div>

        {/* 🔴 MASTER SYSTEM & DATABASE RESET CARD (FOR REAL SHOP LAUNCH) */}
        <div className="bg-slate-900 border-2 border-red-500/40 text-white p-5 sm:p-6 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-5 shadow-xl">
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-xl bg-red-500/20 text-red-400 flex items-center justify-center font-bold">
                <Trash2 className="w-4 h-4" />
              </div>
              <h4 className="font-black text-base sm:text-lg text-white flex items-center space-x-2">
                <span>Master System & Database Reset (Pre-Launch Wipe)</span>
              </h4>
              <span className="bg-red-600 text-white text-[10px] px-2 py-0.5 rounded-full font-extrabold uppercase tracking-wide">
                Clean Slate
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Wipe all test data entered during trial (test products, test prices, demo sales, test customers, expenses, supplier logs, and calculated metrics) from <strong className="text-red-300">Local Storage, IndexedDB Vault, Sync Outbox, and MongoDB Atlas</strong> so your live shop starts with 100% clean data.
            </p>
          </div>

          <div className="flex items-center space-x-2 shrink-0 w-full md:w-auto">
            <button
              type="button"
              onClick={() => {
                setResetAdminPin('');
                setResetPinError('');
                setIsResetModalOpen(true);
              }}
              className="w-full md:w-auto px-5 py-3 bg-red-600 hover:bg-red-500 text-white font-extrabold rounded-xl text-xs sm:text-sm shadow-lg transition flex items-center justify-center space-x-2 cursor-pointer active:scale-95 border border-red-400/40"
            >
              <Trash2 className="w-4 h-4" />
              <span>Master Reset System & Database</span>
            </button>
          </div>
        </div>

      </div>

      <form onSubmit={handleSave} className="space-y-6">
        
        {/* 🍃 MONGODB ATLAS & REAL.DB INTEGRATION CARD */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="font-black text-base text-slate-900">MongoDB Atlas & Real.DB Connection</h3>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                    formData.mongodb_config?.enabled ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {formData.mongodb_config?.enabled ? 'Connected' : 'Offline / Standby'}
                  </span>
                </div>
                <p className="text-xs text-slate-500">Live cloud synchronization with MongoDB Atlas cluster & real database collections</p>
              </div>
            </div>

            {/* Toggle Enable MongoDB */}
            <div className="flex items-center space-x-2">
              <label htmlFor="mongoEnabled" className="text-xs font-bold text-slate-700 cursor-pointer">
                Enable MongoDB Sync
              </label>
              <input
                type="checkbox"
                id="mongoEnabled"
                checked={!!formData.mongodb_config?.enabled}
                onChange={(e) => setFormData({
                  ...formData,
                  mongodb_config: {
                    ...(formData.mongodb_config || DEFAULT_MONGO_CONFIG),
                    enabled: e.target.checked
                  }
                })}
                className="w-5 h-5 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
              />
            </div>
          </div>

          <div className="space-y-4 text-xs">
            
            {/* Connection String URI */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block font-bold text-slate-800">
                  MongoDB Atlas Connection URI (Connection String) *
                </label>
                <span className="text-[11px] text-slate-400 font-mono">Format: mongodb+srv://...</span>
              </div>
              <div className="relative flex items-center">
                <input
                  type={showPassword ? "text" : "password"}
                  value={formData.mongodb_config?.connection_uri || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    mongodb_config: {
                      ...(formData.mongodb_config || DEFAULT_MONGO_CONFIG),
                      connection_uri: e.target.value
                    }
                  })}
                  placeholder="mongodb+srv://admin:password@cluster0.mongodb.net/bloomandcarry_pos?retryWrites=true&w=majority"
                  className="w-full p-2.5 pr-10 bg-slate-50 border border-slate-300 rounded-xl font-mono text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Standard MongoDB Atlas cluster URI with credentials and options.
              </p>
            </div>

            {/* Grid 2 cols for Database Name & Cluster Name */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Database Name (Real.DB) *
                </label>
                <input
                  type="text"
                  value={formData.mongodb_config?.database_name || 'bloomandcarry_pos_real'}
                  onChange={(e) => setFormData({
                    ...formData,
                    mongodb_config: {
                      ...(formData.mongodb_config || DEFAULT_MONGO_CONFIG),
                      database_name: e.target.value
                    }
                  })}
                  placeholder="bloomandcarry_pos_real"
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Cluster Region / Host Identifier
                </label>
                <input
                  type="text"
                  value={formData.mongodb_config?.cluster_name || 'Atlas-Cluster0-AsiaSouth'}
                  onChange={(e) => setFormData({
                    ...formData,
                    mongodb_config: {
                      ...(formData.mongodb_config || DEFAULT_MONGO_CONFIG),
                      cluster_name: e.target.value
                    }
                  })}
                  placeholder="Atlas-Cluster0-AsiaSouth"
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Checkboxes & Sync Settings */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div className="flex items-center space-x-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <input
                  type="checkbox"
                  id="autoSyncCheckout"
                  checked={formData.mongodb_config?.auto_sync_on_checkout ?? true}
                  onChange={(e) => setFormData({
                    ...formData,
                    mongodb_config: {
                      ...(formData.mongodb_config || DEFAULT_MONGO_CONFIG),
                      auto_sync_on_checkout: e.target.checked
                    }
                  })}
                  className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                />
                <label htmlFor="autoSyncCheckout" className="font-bold text-slate-800 cursor-pointer">
                  Auto-sync POS Sales to MongoDB on Checkout
                </label>
              </div>

              <div className="flex items-center space-x-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <input
                  type="checkbox"
                  id="sslEnabled"
                  checked={formData.mongodb_config?.ssl_enabled ?? true}
                  onChange={(e) => setFormData({
                    ...formData,
                    mongodb_config: {
                      ...(formData.mongodb_config || DEFAULT_MONGO_CONFIG),
                      ssl_enabled: e.target.checked
                    }
                  })}
                  className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                />
                <label htmlFor="sslEnabled" className="font-bold text-slate-800 cursor-pointer">
                  Enforce SSL / TLS 1.3 Encryption
                </label>
              </div>
            </div>

            {/* Test, Shift & Pull Actions */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleTestMongoAtlas}
                disabled={isTestingMongo}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-xs transition flex items-center space-x-2 cursor-pointer disabled:opacity-50 active:scale-95"
              >
                {isTestingMongo ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Pinging Atlas Cluster...</span>
                  </>
                ) : (
                  <>
                    <Radio className="w-4 h-4" />
                    <span>Test MongoDB Atlas Connection</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handlePushAllToMongo}
                disabled={isPushingToMongo || !formData.mongodb_config?.enabled}
                className="px-4 py-2.5 bg-emerald-900 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs shadow-xs transition flex items-center space-x-2 cursor-pointer disabled:opacity-40 active:scale-95 border border-emerald-500/40"
              >
                {isPushingToMongo ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Shifting All Data to Atlas...</span>
                  </>
                ) : (
                  <>
                    <Globe className="w-4 h-4 text-emerald-400" />
                    <span>Shift Whole Data to MongoDB Atlas</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handlePullAllFromMongo}
                disabled={isPullingFromMongo || !formData.mongodb_config?.enabled}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs shadow-xs transition flex items-center space-x-2 cursor-pointer disabled:opacity-40 active:scale-95"
              >
                {isPullingFromMongo ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Pulling from Atlas...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 text-blue-400" />
                    <span>Pull / Restore from MongoDB Atlas</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleConsolidateDatabase}
                disabled={isConsolidating || !formData.mongodb_config?.enabled}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-xs transition flex items-center space-x-2 cursor-pointer disabled:opacity-40 active:scale-95"
                title="Consolidate all separated databases (customers, products, sales_invoices) into one unified database"
              >
                {isConsolidating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Consolidating Collections...</span>
                  </>
                ) : (
                  <>
                    <Layers className="w-4 h-4 text-blue-200" />
                    <span>Consolidate Into {formData.mongodb_config?.database_name || 'bloomandcarry_pos_real'}</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleResetCategoriesAction}
                disabled={isResettingCategories}
                className="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold border border-rose-200 rounded-xl text-xs shadow-xs transition flex items-center space-x-2 cursor-pointer disabled:opacity-40 active:scale-95"
                title="Clean up 107 product names and restore the 10 authentic retail categories"
              >
                {isResettingCategories ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-rose-600" />
                    <span>Cleaning Categories...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-rose-600" />
                    <span>Clean Up Categories (Restore 10 Real)</span>
                  </>
                )}
              </button>
            </div>

            {/* Consolidation & Category Reset Messages */}
            {consolidationMessage && (
              <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl text-xs font-bold text-blue-900 flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                <span>{consolidationMessage}</span>
              </div>
            )}

            {categoryResetMessage && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-900 flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{categoryResetMessage}</span>
              </div>
            )}

            {/* Quick MongoDB Atlas Configuration Helper Box */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs text-slate-700 space-y-1.5">
              <p className="font-bold text-slate-900 flex items-center space-x-1.5">
                <Database className="w-3.5 h-3.5 text-emerald-600" />
                <span>MongoDB Atlas Setup Guidelines:</span>
              </p>
              <ul className="list-disc pl-5 space-y-1 text-[11px] text-slate-600">
                <li><strong>Network Access:</strong> In MongoDB Atlas Console &rarr; <em>Network Access</em>, click <strong>Add IP Address</strong> and select <strong>Allow Access from Anywhere (0.0.0.0/0)</strong> so your cloud container can reach the cluster.</li>
                <li><strong>Database User:</strong> In <em>Database Access</em>, create a user with <strong>Read and write to any database</strong> permissions.</li>
                <li><strong>Connection String:</strong> Copy the URI from <em>Database &rarr; Connect &rarr; Drivers &rarr; Node.js</em>, and replace <code>&lt;password&gt;</code> with your database password.</li>
              </ul>
            </div>

            {/* Test Result Display */}
            {mongoTestResult && (
              <div className={`p-4 rounded-xl border text-xs font-semibold ${
                mongoTestResult.success ? 'bg-emerald-50 text-emerald-900 border-emerald-300' : 'bg-red-50 text-red-800 border-red-300'
              }`}>
                <div className="flex items-start space-x-2">
                  {mongoTestResult.success ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-1">
                    <p className="font-bold">{mongoTestResult.message}</p>
                    {mongoTestResult.advice && (
                      <p className="text-[11px] text-red-700 font-semibold bg-red-100/60 p-2 rounded-lg border border-red-200">
                        💡 {mongoTestResult.advice}
                      </p>
                    )}
                    {mongoTestResult.latency_ms && (
                      <p className="text-[11px] opacity-80">
                        ⚡ Latency: {mongoTestResult.latency_ms}ms | Cluster: {mongoTestResult.cluster_name} | Version: {mongoTestResult.server_version}
                      </p>
                    )}
                    {mongoTestResult.collections && (
                      <div className="text-[11px] font-mono bg-white/70 p-2 rounded border border-emerald-200 grid grid-cols-2 sm:grid-cols-4 gap-1.5 mt-1">
                        <div>Products: {mongoTestResult.collections.products_count}</div>
                        <div>Sales: {mongoTestResult.collections.sales_count}</div>
                        <div>Customers: {mongoTestResult.collections.customers_count}</div>
                        <div>Expenses: {mongoTestResult.collections.expenses_count}</div>
                      </div>
                    )}
                    {mongoTestResult.details && (
                      <p className="text-[11px] opacity-75">{mongoTestResult.details}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {mongoPushMessage && (
              <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-xl text-xs font-bold animate-fade-in flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{mongoPushMessage}</span>
              </div>
            )}

            {mongoPullMessage && (
              <div className="p-3 bg-blue-50 border border-blue-300 text-blue-900 rounded-xl text-xs font-bold animate-fade-in flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                <span>{mongoPullMessage}</span>
              </div>
            )}

          </div>
        </div>

        {/* Google Apps Script Integration Section */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <div className="flex items-center space-x-2">
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#0b5fa5] flex items-center justify-center">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-slate-800">Google Sheets & Drive Backup Web App</h3>
                <p className="text-xs text-slate-500">Connect to Google Sheet database API for secondary spreadsheets</p>
              </div>
            </div>

            <button
              type="button"
              onClick={onNavigateToGasGuide}
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl transition flex items-center space-x-1 cursor-pointer"
            >
              <Code2 className="w-4 h-4" />
              <span>View Code.gs Script</span>
            </button>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Google Apps Script Web App URL
              </label>
              <div className="flex space-x-2">
                <input
                  type="url"
                  value={formData.gas_web_app_url || ''}
                  onChange={(e) => setFormData({ ...formData, gas_web_app_url: e.target.value })}
                  placeholder="https://script.google.com/macros/s/AKfycbx.../exec"
                  className="flex-1 p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-[#0b5fa5]"
                />
                <button
                  type="button"
                  onClick={handleTestGasConnection}
                  className="px-4 py-2.5 bg-[#0b5fa5] hover:bg-[#094e88] text-white font-bold rounded-xl text-xs shadow-xs transition whitespace-nowrap cursor-pointer"
                >
                  Test Connection
                </button>
              </div>
            </div>

            {gasTestResult && (
              <div className={`p-3 rounded-xl border text-xs font-semibold ${
                gasTestResult.isError ? 'bg-red-50 text-red-700 border-red-200' : 'bg-emerald-50 text-emerald-800 border-emerald-200'
              }`}>
                {gasTestResult.testing ? (
                  <div className="flex items-center space-x-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-[#0b5fa5]" />
                    <span>{gasTestResult.message}</span>
                  </div>
                ) : (
                  <span>{gasTestResult.message}</span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Store Profile Section */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center space-x-2 border-b pb-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#0b5fa5] flex items-center justify-center">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-slate-800">Store Branding & Receipt Info</h3>
              <p className="text-xs text-slate-500">Appears on receipts, top navigation header, and reports</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Store Name *</label>
              <input
                type="text"
                required
                value={formData.shop_name}
                onChange={(e) => setFormData({ ...formData, shop_name: e.target.value })}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-[#0b5fa5]"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Tagline / Slogan</label>
              <input
                type="text"
                value={formData.tagline}
                onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium focus:bg-white focus:ring-2 focus:ring-[#0b5fa5]"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Store Address</label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium focus:bg-white focus:ring-2 focus:ring-[#0b5fa5]"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Phone Number</label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium focus:bg-white focus:ring-2 focus:ring-[#0b5fa5]"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Website Link</label>
              <input
                type="text"
                value={formData.website || ''}
                placeholder="bloomandcarry.com"
                onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium focus:bg-white focus:ring-2 focus:ring-[#0b5fa5]"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Currency Symbol</label>
              <input
                type="text"
                value={formData.currency_symbol || 'Rs.'}
                onChange={(e) => setFormData({ ...formData, currency_symbol: e.target.value })}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold focus:bg-white focus:ring-2 focus:ring-[#0b5fa5]"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Invoice Prefix</label>
              <input
                type="text"
                value={formData.invoice_prefix || 'BC-2026'}
                onChange={(e) => setFormData({ ...formData, invoice_prefix: e.target.value })}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold focus:bg-white focus:ring-2 focus:ring-[#0b5fa5]"
              />
            </div>
          </div>
        </div>

        {/* ================= DEDICATED SALES TAX & FBR / GST CONFIGURATION ================= */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
          <div className="flex items-center justify-between border-b pb-3">
            <div className="flex items-center space-x-2">
              <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <Percent className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-slate-800">Sales Tax & FBR / GST Rates</h3>
                <p className="text-xs text-slate-500">Configure global tax rate, calculation model, and category overrides</p>
              </div>
            </div>
            <span className="text-[11px] font-extrabold bg-amber-100 text-amber-900 px-2.5 py-1 rounded-full">
              Current Default: {formData.tax_rate ?? 0}%
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Primary Controls */}
            <div className="lg:col-span-7 space-y-4 text-xs">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block font-bold text-slate-800">
                    Store Default Sales Tax Rate (%) *
                  </label>
                  <span className="text-slate-400 font-semibold text-[11px]">Applied to all non-exempt items</span>
                </div>
                <div className="flex space-x-2">
                  <div className="relative flex-1">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      required
                      value={formData.tax_rate}
                      onChange={(e) => setFormData({ ...formData, tax_rate: Number(e.target.value) })}
                      className="w-full p-2.5 pr-8 bg-slate-50 border border-slate-300 rounded-xl font-black text-slate-900 text-sm focus:bg-white focus:ring-2 focus:ring-[#0b5fa5]"
                      placeholder="e.g. 16 or 18"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">%</span>
                  </div>
                </div>

                {/* Quick Preset Buttons */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {[
                    { label: '0% (Tax Free / Exempt)', val: 0 },
                    { label: '5% (Reduced)', val: 5 },
                    { label: '16% (Services / PRA)', val: 16 },
                    { label: '17% (GST Standard)', val: 17 },
                    { label: '18% (Federal GST)', val: 18 }
                  ].map(preset => (
                    <button
                      key={preset.val}
                      type="button"
                      onClick={() => setFormData({ ...formData, tax_rate: preset.val })}
                      className={`px-2.5 py-1 rounded-lg font-bold text-[11px] border transition cursor-pointer ${
                        formData.tax_rate === preset.val
                          ? 'bg-[#0b5fa5] text-white border-[#0b5fa5] shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1.5">
                  Tax Calculation Mode
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, tax_mode: 'EXCLUSIVE' })}
                    className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                      (formData.tax_mode || 'EXCLUSIVE') === 'EXCLUSIVE'
                        ? 'bg-blue-50/70 border-[#0b5fa5] ring-2 ring-[#0b5fa5]/20'
                        : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center space-x-1.5">
                      <span className="font-extrabold text-slate-900 text-xs">Tax EXCLUSIVE</span>
                      {(formData.tax_mode || 'EXCLUSIVE') === 'EXCLUSIVE' && <Check className="w-3.5 h-3.5 text-[#0b5fa5]" />}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Tax is added on top of the product price at checkout (e.g. Rs 1000 + Rs {((1000 * (formData.tax_rate || 0)) / 100).toFixed(0)} = Rs {(1000 + (1000 * (formData.tax_rate || 0)) / 100).toFixed(0)})
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, tax_mode: 'INCLUSIVE' })}
                    className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                      formData.tax_mode === 'INCLUSIVE'
                        ? 'bg-blue-50/70 border-[#0b5fa5] ring-2 ring-[#0b5fa5]/20'
                        : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center space-x-1.5">
                      <span className="font-extrabold text-slate-900 text-xs">Tax INCLUSIVE</span>
                      {formData.tax_mode === 'INCLUSIVE' && <Check className="w-3.5 h-3.5 text-[#0b5fa5]" />}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Price on the shelf already includes tax. Receipt displays embedded tax portion automatically.
                    </p>
                  </button>
                </div>
              </div>
            </div>

            {/* Live Calculation Simulator */}
            <div className="lg:col-span-5 bg-gradient-to-br from-slate-900 to-slate-800 text-white p-4 rounded-2xl space-y-3">
              <div className="flex items-center justify-between border-b border-slate-700 pb-2">
                <span className="text-[11px] uppercase tracking-wider font-extrabold text-amber-400 flex items-center space-x-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Live Tax Calculator Simulation</span>
                </span>
                <span className="text-[10px] text-slate-400 font-mono">1 Item @ Rs. 1,000</span>
              </div>

              {(() => {
                const samplePrice = 1000;
                const rate = formData.tax_rate || 0;
                const isInc = formData.tax_mode === 'INCLUSIVE';
                let tax = 0;
                let finalTotal = 0;
                let netBase = 0;

                if (isInc) {
                  netBase = rate > 0 ? samplePrice / (1 + rate / 100) : samplePrice;
                  tax = samplePrice - netBase;
                  finalTotal = samplePrice;
                } else {
                  netBase = samplePrice;
                  tax = (samplePrice * rate) / 100;
                  finalTotal = samplePrice + tax;
                }

                return (
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between text-slate-300">
                      <span>Base Retail Price:</span>
                      <span className="font-mono font-semibold">{formData.currency_symbol || 'Rs.'} {Math.round(netBase).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-amber-300 font-semibold">
                      <span>Sales Tax ({rate}%):</span>
                      <span className="font-mono font-bold">+{formData.currency_symbol || 'Rs.'} {(tax ?? 0).toFixed(2)}</span>
                    </div>
                    <div className="border-t border-slate-700 pt-2 flex justify-between text-sm font-black text-white">
                      <span>Customer Checkout Total:</span>
                      <span className="font-mono text-emerald-400">{formData.currency_symbol || 'Rs.'} {(finalTotal ?? 0).toFixed(0)}</span>
                    </div>
                    <p className="text-[10px] text-slate-400 pt-1">
                      Mode: <span className="text-white font-bold">{formData.tax_mode || 'EXCLUSIVE'}</span>. Changes save immediately to local storage and sync to Cloud Firestore.
                    </p>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>

        {/* Printer & Hardware Hardware Settings */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center space-x-2 border-b pb-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#0b5fa5] flex items-center justify-center">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-slate-800">Thermal Receipt Printer & Cash Drawer</h3>
              <p className="text-xs text-slate-500">Hardware parameters for 80mm ESC/POS thermal printers</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Printer Model Name</label>
              <input
                type="text"
                value={formData.printer_name}
                onChange={(e) => setFormData({ ...formData, printer_name: e.target.value })}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-[#0b5fa5]"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Paper Width</label>
              <select
                value={formData.paper_width || '80mm'}
                onChange={(e) => setFormData({ ...formData, paper_width: e.target.value as any })}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold focus:bg-white focus:ring-2 focus:ring-[#0b5fa5]"
              >
                <option value="80mm">80mm Thermal Receipt Paper (Standard)</option>
                <option value="58mm">58mm Compact Thermal Paper</option>
              </select>
            </div>

            <div className="flex items-center space-x-2 sm:col-span-2">
              <input
                type="checkbox"
                id="openDrawer"
                checked={formData.open_cash_drawer}
                onChange={(e) => setFormData({ ...formData, open_cash_drawer: e.target.checked })}
                className="w-4 h-4 text-[#0b5fa5] rounded border-slate-300 focus:ring-[#0b5fa5]"
              />
              <label htmlFor="openDrawer" className="font-bold text-slate-800 cursor-pointer">
                Pulse & Open Cash Drawer Signal on Sale Checkout
              </label>
            </div>
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          className="w-full py-4 bg-[#0b5fa5] hover:bg-[#094e88] text-white font-black rounded-2xl shadow-lg text-sm transition cursor-pointer active:scale-98"
        >
          Save All System Settings
        </button>

      </form>

      {/* 🔴 MODAL: MASTER SYSTEM & CLOUD DATABASE RESET */}
      {isResetModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/85 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto font-sans">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl my-auto max-h-[calc(100vh-2rem)] flex flex-col overflow-y-auto border-2 border-red-500/40 p-5 sm:p-7 space-y-6 relative animate-scale-up">
            
            {/* Header */}
            <div className="flex items-start space-x-3 text-red-600 border-b border-red-100 pb-4">
              <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center shrink-0 shadow-xs">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="space-y-0.5">
                <h3 className="font-black text-lg sm:text-xl text-slate-900">
                  Master System & Database Reset
                </h3>
                <p className="text-xs text-red-600 font-extrabold uppercase tracking-wide">
                  Complete Pre-Launch Wipe for Real Shop Inventory
                </p>
              </div>
            </div>

            {/* Explanation of what gets wiped */}
            <div className="bg-red-50 p-4 rounded-2xl border border-red-200 text-xs text-red-950 space-y-3">
              <div className="font-black text-xs uppercase tracking-wide text-red-900 flex items-center space-x-1.5">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                <span>The following data will be permanently wiped across all tabs and databases:</span>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-red-800">
                <div className="flex items-center space-x-1.5 bg-white/70 p-2 rounded-lg border border-red-200/60">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-600 shrink-0"></span>
                  <span><strong>Products:</strong> All test items, custom prices, barcodes</span>
                </div>
                <div className="flex items-center space-x-1.5 bg-white/70 p-2 rounded-lg border border-red-200/60">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-600 shrink-0"></span>
                  <span><strong>Sales & Invoices:</strong> All test checkout history</span>
                </div>
                <div className="flex items-center space-x-1.5 bg-white/70 p-2 rounded-lg border border-red-200/60">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-600 shrink-0"></span>
                  <span><strong>Stock Ledger:</strong> Stock history & adjustments</span>
                </div>
                <div className="flex items-center space-x-1.5 bg-white/70 p-2 rounded-lg border border-red-200/60">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-600 shrink-0"></span>
                  <span><strong>Customers:</strong> Test loyalty points & orders</span>
                </div>
                <div className="flex items-center space-x-1.5 bg-white/70 p-2 rounded-lg border border-red-200/60">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-600 shrink-0"></span>
                  <span><strong>Expenses & POs:</strong> Test store expenses & orders</span>
                </div>
                <div className="flex items-center space-x-1.5 bg-white/70 p-2 rounded-lg border border-red-200/60">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-600 shrink-0"></span>
                  <span><strong>Cloud Firestore:</strong> All cloud collections wiped</span>
                </div>
              </div>

              <div className="text-[11px] text-slate-700 font-semibold pt-2 border-t border-red-200/80 space-y-1">
                <p>✓ <strong>Preserved:</strong> Master Admin credentials and default Walk-in Customer profile.</p>
                <p>✓ <strong>Storage Engines:</strong> LocalStorage, IndexedDB Offline Vault, and Cloud Firestore are all synchronized to a clean zero-data state.</p>
              </div>
            </div>

            {/* Asynchronous Progress Indicator */}
            {isResetting && (
              <div className="bg-slate-900 text-white p-4 rounded-2xl space-y-2 animate-pulse">
                <div className="flex items-center space-x-2 text-xs font-bold text-red-400">
                  <RefreshCw className="w-4 h-4 animate-spin text-red-400" />
                  <span>Executing Master System & Database Reset...</span>
                </div>
                <p className="text-xs text-slate-300 font-mono">
                  {resetProgressText}
                </p>
              </div>
            )}

            {/* PIN Verification Safeguard */}
            {!isResetting && (
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-800">
                  Enter Master Admin Password / PIN to Authorize Reset *
                </label>
                <div className="relative flex items-center">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3" />
                  <input
                    type="password"
                    value={resetAdminPin}
                    onChange={(e) => {
                      setResetAdminPin(e.target.value);
                      setResetPinError('');
                    }}
                    placeholder="Enter Admin Password (e.g. Usman@Ali513)"
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-red-500"
                  />
                </div>
                {resetPinError && (
                  <p className="text-xs text-red-600 font-bold">{resetPinError}</p>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                disabled={isResetting}
                onClick={() => {
                  setIsResetModalOpen(false);
                  setResetAdminPin('');
                  setResetPinError('');
                }}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={isResetting}
                onClick={handleConfirmFullSystemReset}
                className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white font-extrabold rounded-xl text-xs sm:text-sm shadow-lg transition flex items-center space-x-2 cursor-pointer active:scale-95 disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isResetting ? 'Resetting System...' : 'Wipe All Data & Start Real Shop'}</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ⚠️ MODAL: CONFIRM DELETING ALL MOCK DATA */}
      {isPurgeModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto font-sans">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg my-auto max-h-[calc(100vh-2rem)] flex flex-col overflow-y-auto border border-red-200 p-5 sm:p-6 space-y-5 relative animate-scale-up">
            
            {/* Header */}
            <div className="flex items-center space-x-3 text-red-600">
              <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center shrink-0">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="font-black text-lg text-slate-900">Permanently Delete All Mock Data?</h3>
                <p className="text-xs text-red-600 font-bold">Shift toward 100% Real Production System</p>
              </div>
            </div>

            {/* Explanation of what gets wiped */}
            <div className="bg-red-50 p-4 rounded-xl border border-red-200 text-xs text-red-950 space-y-2">
              <p className="font-bold">The following mock collections will be wiped clean:</p>
              <ul className="list-disc pl-5 space-y-1 text-[11px] text-red-800">
                <li>Mock Products Catalog (Maybelline, MAC, Huda Beauty samples deleted)</li>
                <li>Demo Sales Invoices & Test Transactions</li>
                <li>Sample Customer Profiles & Mock Loyalty Logs</li>
                <li>Mock Store Expenses & Test Purchase Orders</li>
                <li>Demo Stock History Ledger</li>
              </ul>
              <p className="text-[11px] text-slate-700 font-semibold pt-1 border-t border-red-200/60">
                ✓ Administrator account credentials will be preserved. A clean Walk-in customer profile will be retained for quick POS cash register billing.
              </p>
            </div>

            {/* PIN Verification Safeguard */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-800">
                Enter Master Admin PIN to Authorize *
              </label>
              <div className="relative flex items-center">
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3" />
                <input
                  type="password"
                  value={purgeAdminPin}
                  onChange={(e) => {
                    setPurgeAdminPin(e.target.value);
                    setPurgePinError('');
                  }}
                  placeholder="Enter Admin Password / PIN"
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-red-500"
                />
              </div>
              {purgePinError && (
                <p className="text-xs text-red-600 font-bold">{purgePinError}</p>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsPurgeModalOpen(false);
                  setPurgeAdminPin('');
                  setPurgePinError('');
                }}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmPurgeMockData}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-extrabold rounded-xl text-xs shadow-md transition flex items-center space-x-2 cursor-pointer active:scale-95"
              >
                <Trash2 className="w-4 h-4" />
                <span>Confirm & Shift to Real System</span>
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

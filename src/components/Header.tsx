import React from 'react';
import { 
  ShoppingCart, 
  LayoutDashboard, 
  Package, 
  Receipt, 
  Users, 
  Wallet, 
  Settings, 
  Code2, 
  RefreshCw, 
  CheckCircle2, 
  WifiOff, 
  LogOut, 
  HelpCircle,
  FolderLock,
  Sparkles,
  Truck,
  ShoppingBag,
  Search,
  Database,
  Lock,
  Activity,
  Store,
  ShieldCheck,
  Cpu,
  BarChart3,
  PackageX,
  UserCheck,
  ShieldAlert,
  ArrowLeft,
  Cloud,
  CloudLightning,
  Tags
} from 'lucide-react';
import { ActiveTab, User, ShopSettings } from '../types';
import { OfflineSyncEngine, SyncEngineStatus } from '../services/offline_sync_engine';

interface HeaderProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  onGoBack?: () => void;
  currentUser: User | null;
  onLogout: () => void;
  settings: ShopSettings;
  isSyncing: boolean;
  syncedFromGas: boolean;
  onManualSync: () => void;
  onOpenShortcuts: () => void;
  onOpenCommandPalette?: () => void;
  onOpenDailyBackup?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  onGoBack,
  currentUser,
  onLogout,
  settings,
  isSyncing,
  syncedFromGas,
  onManualSync,
  onOpenShortcuts,
  onOpenCommandPalette,
  onOpenDailyBackup,
}) => {
  const isAdmin = currentUser?.role === 'admin';
  const [lastAutoBackup, setLastAutoBackup] = React.useState<string>('Realtime');
  const [isBackupFlashing, setIsBackupFlashing] = React.useState<boolean>(false);
  const [syncStatus, setSyncStatus] = React.useState<SyncEngineStatus>(OfflineSyncEngine.getStatus());

  React.useEffect(() => {
    const handleBackupEvent = (e: any) => {
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setLastAutoBackup(timeStr);
      setIsBackupFlashing(true);
      setTimeout(() => setIsBackupFlashing(false), 2000);
    };

    window.addEventListener('bloom_auto_backup_synced', handleBackupEvent);
    
    // Subscribe to OfflineSyncEngine status updates
    const unsubscribeSync = OfflineSyncEngine.subscribe((status) => {
      setSyncStatus(status);
    });

    return () => {
      window.removeEventListener('bloom_auto_backup_synced', handleBackupEvent);
      unsubscribeSync();
    };
  }, []);

  const navItems: { id: ActiveTab; label: string; icon: React.ComponentType<any>; adminOnly?: boolean }[] = [
    { id: 'pos', label: 'POS Billing', icon: ShoppingCart },
    { id: 'shift_register', label: 'Shift Register', icon: Lock },
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, adminOnly: true },
    { id: 'products', label: 'Products & Stock', icon: Package, adminOnly: true },
    { id: 'categories', label: 'Categories Setup', icon: Tags, adminOnly: true },
    { id: 'reservations', label: 'Stock Reservations', icon: ShoppingBag, adminOnly: true },
    { id: 'stock_ledger', label: 'Stock Ledger', icon: FolderLock, adminOnly: true },
    { id: 'purchase_orders', label: 'Purchase Orders', icon: ShoppingBag, adminOnly: true },
    { id: 'suppliers', label: 'Suppliers Management', icon: Truck, adminOnly: true },
    { id: 'sales', label: 'Sales History', icon: Receipt },
    { id: 'customers', label: 'Customers CRM', icon: Users },
    { id: 'expenses', label: 'Expenses', icon: Wallet, adminOnly: true },
    { id: 'import_export', label: 'Import/Export', icon: Database, adminOnly: true },
    { id: 'employee_productivity', label: 'Staff Performance', icon: Users, adminOnly: true },
    { id: 'employee_management', label: 'Staff Profiles & Shifts', icon: UserCheck, adminOnly: true },
    { id: 'bi_analytics', label: 'BI Analytics', icon: BarChart3, adminOnly: true },
    { id: 'dead_stock', label: 'Dead Stock Clearance', icon: PackageX, adminOnly: true },
    { id: 'smart_reorder', label: 'Smart Reordering', icon: Sparkles, adminOnly: true },
    { id: 'security_audit', label: 'Security & Compliance', icon: ShieldCheck, adminOnly: true },
    { id: 'emergency_controls', label: 'Emergency & Kill-Switch', icon: ShieldAlert, adminOnly: true },
    { id: 'automated_tests', label: 'Automated Test Suite', icon: Cpu, adminOnly: true },
    { id: 'system_health', label: 'System Health', icon: Activity, adminOnly: true },
    { id: 'settings', label: 'Settings', icon: Settings, adminOnly: true },
    { id: 'google_workspace', label: 'Google Workspace & Cloud', icon: Cloud, adminOnly: true },
    { id: 'gas_guide', label: 'Google Sheets Integration', icon: Code2, adminOnly: true },
  ];

  return (
    <header className="bg-[#0f6cbd] text-white shadow-xs select-none sticky top-0 z-40 font-sans">
      
      {/* Test Transaction Banner (if explicitly enabled) */}
      {settings.is_test_transaction_mode && (
        <div className="bg-amber-400 text-slate-950 px-4 py-1 text-xs font-black flex items-center justify-between shadow-inner">
          <div className="flex items-center space-x-2">
            <span className="bg-slate-950 text-amber-300 px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider">
              TEST TRANSACTION MODE
            </span>
            <span>Real physical inventory and financial accounting ledgers are NOT affected by checkouts in this mode.</span>
          </div>
          <span className="text-[10px] font-bold opacity-80 hidden md:inline">Test Mode Active</span>
        </div>
      )}

      {/* Top Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          
          {/* Brand & Shop Title */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {activeTab !== 'pos' && onGoBack && (
              <button
                onClick={onGoBack}
                className="flex items-center space-x-1 bg-white/20 hover:bg-white/30 active:scale-95 text-white px-2.5 py-1.5 rounded-xl text-xs font-bold transition shadow-xs border border-white/30"
                title="Go Back to Previous Screen"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Back</span>
              </button>
            )}
            <div className="flex items-center space-x-2.5 cursor-pointer" onClick={() => setActiveTab('pos')}>
              <div className="w-8 h-8 rounded-md bg-white text-[#0f6cbd] flex items-center justify-center font-black text-sm shadow-xs border border-white/30">
                <Sparkles className="w-5 h-5 text-[#0f6cbd]" />
              </div>
              <div>
                <h1 className="font-bold text-sm sm:text-base tracking-tight leading-none text-white truncate max-w-[140px] sm:max-w-none">
                  {settings.shop_name || 'BloomAndCarry Cosmetics'}
                </h1>
                <p className="text-[10px] sm:text-[11px] text-blue-100/90 leading-tight mt-0.5 truncate max-w-[140px] sm:max-w-none">
                  {settings.tagline || 'Point of Sale & Inventory System'}
                </p>
              </div>
            </div>
          </div>

          {/* Search / Command Palette Button */}
          {onOpenCommandPalette && (
            <button
              onClick={onOpenCommandPalette}
              className="hidden lg:flex items-center space-x-2 bg-white/10 hover:bg-white/20 border border-white/20 px-3 py-1.5 rounded-xl text-xs text-blue-100 transition w-64 justify-between"
            >
              <div className="flex items-center space-x-1.5">
                <Search className="w-3.5 h-3.5 text-blue-200" />
                <span>Search or Command...</span>
              </div>
              <kbd className="bg-white/20 px-1.5 py-0.5 text-[10px] rounded font-mono text-white">⌘K</kbd>
            </button>
          )}

          {/* Right Status Badges & Controls */}
          <div className="flex items-center space-x-2">
            
            {/* Keyboard Shortcuts Trigger */}
            <button
              onClick={onOpenShortcuts}
              className="hidden sm:flex items-center space-x-1 px-2.5 py-1 rounded-md text-xs bg-white/10 hover:bg-white/20 text-blue-50 transition border border-white/20"
              title="Keyboard Shortcuts (F1-F8)"
            >
              <HelpCircle className="w-3.5 h-3.5 text-blue-200" />
              <span>Shortcuts</span>
              <kbd className="bg-white/20 px-1 py-0.2 text-[10px] rounded font-mono text-white">F1-F8</kbd>
            </button>

            {/* Real-time CRUD Auto-Backup Status Badge */}
            <div 
              className={`hidden sm:flex items-center px-2 py-1 rounded-md text-xs border transition-all duration-300 ${
                isBackupFlashing 
                  ? 'bg-emerald-500/40 text-emerald-200 border-emerald-400 scale-105 shadow-xs shadow-emerald-500/50' 
                  : 'bg-white/10 text-blue-100 border-white/20'
              }`}
              title="Continuous Multi-Tier Auto Backup (IndexedDB + Cloud Firestore + Local Snapshot)"
            >
              <span className={`w-2 h-2 rounded-full mr-1.5 ${isBackupFlashing ? 'bg-emerald-300 animate-ping' : 'bg-emerald-400'}`}></span>
              <span className="font-semibold text-[11px]">
                {isBackupFlashing ? 'Auto-Backed Up!' : `Auto-Backup: ${lastAutoBackup}`}
              </span>
            </div>

            {/* Daily Safety Backup Trigger */}
            {onOpenDailyBackup && (
              <button
                onClick={onOpenDailyBackup}
                className="hidden lg:flex items-center space-x-1 px-2.5 py-1 rounded-md text-xs bg-white/10 hover:bg-white/20 text-blue-50 transition border border-white/20"
                title="Automated Daily Safety Backup & Disaster Recovery"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
                <span>Daily Backup</span>
              </button>
            )}

            {/* MongoDB Atlas / Real.DB Status Badge */}
            {settings.mongodb_config?.enabled ? (
              <div 
                className="hidden md:flex items-center bg-emerald-950/40 text-emerald-300 rounded-md px-2 py-1 border border-emerald-400/30 text-xs font-bold space-x-1.5"
                title={`Connected to MongoDB Atlas: ${settings.mongodb_config.database_name || 'real.db'}`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>MongoDB Atlas</span>
              </div>
            ) : settings.is_production_mode ? (
              <div 
                className="hidden md:flex items-center bg-emerald-900/40 text-emerald-200 rounded-md px-2 py-1 border border-emerald-400/30 text-xs font-bold space-x-1"
                title="Real Production System Active - 0 Mock Data"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                <span>Real System</span>
              </div>
            ) : null}

            {/* Realtime Cloud Sync & Outbox Badge */}
            <div className="flex items-center bg-blue-900/40 rounded-md px-2.5 py-1 border border-white/20 text-xs">
              {syncStatus.isSyncing || isSyncing ? (
                <div className="flex items-center space-x-1.5 text-blue-200">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-300" />
                  <span className="hidden md:inline font-medium">Syncing Cloud...</span>
                </div>
              ) : !syncStatus.isOnline ? (
                <div className="flex items-center space-x-1.5 text-amber-300 font-medium" title="Safe Offline Mode: Outbox will auto-flush upon internet recovery">
                  <WifiOff className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden md:inline">Offline Vault {syncStatus.pendingCount > 0 ? `(${syncStatus.pendingCount} queued)` : ''}</span>
                </div>
              ) : syncStatus.pendingCount > 0 ? (
                <div className="flex items-center space-x-1.5 text-cyan-300 font-medium" title="Uploading pending local changes to cloud">
                  <CloudLightning className="w-3.5 h-3.5 text-cyan-300 animate-pulse" />
                  <span className="hidden md:inline">Flushing ({syncStatus.pendingCount})</span>
                </div>
              ) : (
                <div className="flex items-center space-x-1.5 text-emerald-300" title="All changes synced to Cloud Firestore & Google Sheets">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="hidden md:inline font-semibold text-emerald-100">Cloud Live</span>
                </div>
              )}
              <button
                onClick={() => {
                  OfflineSyncEngine.flushQueue(true);
                  onManualSync();
                }}
                className="ml-2 text-white/80 hover:text-white hover:bg-white/20 p-1 rounded transition"
                title="Force Flush Outbox & Refresh from Cloud"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing || syncStatus.isSyncing ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* Current User Badge */}
            <div className="flex items-center space-x-2 pl-2 border-l border-white/20">
              <div className="text-right hidden sm:block">
                <div className="text-xs font-semibold leading-tight flex items-center justify-end space-x-1">
                  <span>{currentUser?.name || 'User'}</span>
                  <span className="bg-white/20 text-white text-[10px] px-1.5 py-0.2 rounded font-medium">
                    {isAdmin ? 'Admin' : 'Cashier'}
                  </span>
                </div>
                <div className="text-[10px] text-blue-100/80">@{currentUser?.username || 'user'}</div>
              </div>

              <button
                onClick={onLogout}
                className="bg-white/10 hover:bg-red-600/90 text-white p-1.5 rounded-md text-xs transition flex items-center space-x-1 border border-white/20"
                title="Logout / Switch User"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden lg:inline text-xs font-medium">Switch</span>
              </button>
            </div>

          </div>
        </div>
      </div>

      {/* Navigation Bar */}
      <div className="bg-[#115ea3] border-t border-white/15 overflow-x-auto no-scrollbar">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex space-x-1">
          {navItems.map((item) => {
            if (item.adminOnly && !isAdmin) return null;
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center space-x-2 px-3 py-2 text-xs font-medium border-b-2 whitespace-nowrap transition-colors ${
                  isActive
                    ? 'border-white text-white bg-white/15 font-bold'
                    : 'border-transparent text-blue-100 hover:text-white hover:bg-white/10'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-blue-200'}`} />
                <span>{item.label}</span>
                {item.id === 'pos' && (
                  <span className="bg-white/20 text-white text-[9px] font-bold px-1 rounded ml-1">F1</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};

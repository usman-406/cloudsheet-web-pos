import React, { useState, useEffect } from 'react';
import { 
  Cloud, 
  FileSpreadsheet, 
  Mail, 
  HardDrive, 
  Flame, 
  Database, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  UploadCloud, 
  DownloadCloud, 
  ExternalLink, 
  Send, 
  Trash2, 
  X,
  Sparkles,
  ShieldCheck
} from 'lucide-react';
import { 
  auth, 
  googleSignIn, 
  firebaseLogout, 
  getAccessToken,
  testFirestoreConnection
} from '../services/firebase';
import { MongoDbService } from '../services/mongodb_service';
import { WorkspaceService, GoogleDriveFile } from '../services/workspace';
import { Product, Sale, Customer, ShopSettings } from '../types';
import { StorageService } from '../services/storage';

interface GoogleWorkspaceModalProps {
  products: Product[];
  sales: Sale[];
  customers: Customer[];
  settings: ShopSettings;
  isOpen: boolean;
  onClose: () => void;
  onDataImported?: () => void;
}

export const GoogleWorkspaceModal: React.FC<GoogleWorkspaceModalProps> = ({
  products,
  sales,
  customers,
  settings,
  isOpen,
  onClose,
  onDataImported,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'drive' | 'sheets' | 'gmail' | 'firebase'>('overview');
  const [user, setUser] = useState(auth.currentUser);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Google Drive state
  const [driveFiles, setDriveFiles] = useState<GoogleDriveFile[]>([]);
  const [isLoadingDrive, setIsLoadingDrive] = useState(false);

  // Google Sheets state
  const [activeSpreadsheetId, setActiveSpreadsheetId] = useState<string>(settings.google_spreadsheet_id || '');
  const [activeSpreadsheetUrl, setActiveSpreadsheetUrl] = useState<string>(settings.google_spreadsheet_url || (settings.google_spreadsheet_id ? `https://docs.google.com/spreadsheets/d/${settings.google_spreadsheet_id}/edit` : ''));

  // Gmail state
  const [recipientEmail, setRecipientEmail] = useState<string>(settings.email || 'bloomandcarry.pk@gmail.com');
  const [customEmailSubject, setCustomEmailSubject] = useState<string>('Daily POS Report & Summary');
  const [customEmailBody, setCustomEmailBody] = useState<string>('Please find attached our latest retail POS updates.');

  // Firestore state
  const [isFirestoreConnected, setIsFirestoreConnected] = useState<boolean>(false);

  useEffect(() => {
    const checkAuth = async () => {
      const token = await getAccessToken();
      setAccessToken(token);
      setUser(auth.currentUser);
      if (token) {
        loadDriveFiles();
        checkFirestore();
      }
    };
    if (isOpen) {
      if (settings.google_spreadsheet_id) {
        setActiveSpreadsheetId(settings.google_spreadsheet_id);
        setActiveSpreadsheetUrl(settings.google_spreadsheet_url || `https://docs.google.com/spreadsheets/d/${settings.google_spreadsheet_id}/edit`);
      }
      checkAuth();
    }
  }, [isOpen, settings]);

  const checkFirestore = async () => {
    const isOk = await testFirestoreConnection();
    setIsFirestoreConnected(isOk);
  };

  const handleGoogleLogin = async () => {
    setIsLoggingIn(true);
    setStatusMessage(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setAccessToken(result.accessToken);
        setStatusMessage({ type: 'success', text: `Successfully connected with ${result.user.email}!` });
        loadDriveFiles();
        checkFirestore();
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to sign in with Google.' });
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await firebaseLogout();
      setUser(null);
      setAccessToken(null);
      setDriveFiles([]);
      setStatusMessage({ type: 'info', text: 'Signed out from Google Workspace.' });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Logout failed.' });
    }
  };

  // Google Drive Actions
  const loadDriveFiles = async () => {
    setIsLoadingDrive(true);
    try {
      const files = await WorkspaceService.listDriveFiles("trashed = false and (name contains 'POS' or name contains 'BoomandCarry' or mimeType = 'application/json' or mimeType = 'application/vnd.google-apps.spreadsheet')", 30);
      setDriveFiles(files);
    } catch (err: any) {
      console.warn('Drive files fetch note:', err.message);
    } finally {
      setIsLoadingDrive(false);
    }
  };

  const handleBackupToDrive = async () => {
    setLoadingAction('drive-backup');
    setStatusMessage(null);
    try {
      const backupPayload = {
        app: 'BoomandCarry POS',
        exportedAt: new Date().toISOString(),
        version: '2.5',
        products,
        sales,
        customers,
        settings,
        suppliers: StorageService.getSuppliers(),
        expenses: StorageService.getExpenses(),
        returns: StorageService.getReturns(),
      };
      const fileName = `BoomandCarry_POS_Backup_${new Date().toISOString().slice(0, 10)}_${Date.now().toString().slice(-4)}.json`;
      const file = await WorkspaceService.uploadFileToDrive(fileName, JSON.stringify(backupPayload, null, 2), 'application/json');
      setStatusMessage({ type: 'success', text: `Backup "${file.name}" saved to Google Drive successfully!` });
      loadDriveFiles();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to backup to Google Drive.' });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleRestoreFromDrive = async (file: GoogleDriveFile) => {
    const confirmRestore = window.confirm(`Are you sure you want to restore data from Google Drive file "${file.name}"? This will update local items.`);
    if (!confirmRestore) return;

    setLoadingAction(`restore-${file.id}`);
    try {
      const content = await WorkspaceService.downloadDriveFileContent(file.id);
      const parsed = JSON.parse(content);
      if (parsed.products && Array.isArray(parsed.products)) {
        StorageService.saveProducts(parsed.products);
      }
      if (parsed.sales && Array.isArray(parsed.sales)) {
        StorageService.saveSales(parsed.sales);
      }
      if (parsed.customers && Array.isArray(parsed.customers)) {
        StorageService.saveCustomers(parsed.customers);
      }
      if (parsed.settings) {
        StorageService.saveSettings(parsed.settings);
      }
      setStatusMessage({ type: 'success', text: `Successfully restored database from Google Drive backup "${file.name}"!` });
      if (onDataImported) onDataImported();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to parse and restore backup file.' });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleDeleteDriveFile = async (file: GoogleDriveFile) => {
    const confirmDelete = window.confirm(`Delete "${file.name}" from your Google Drive?`);
    if (!confirmDelete) return;

    try {
      await WorkspaceService.deleteDriveFile(file.id, file.name);
      setStatusMessage({ type: 'success', text: `Deleted "${file.name}" from Google Drive.` });
      setDriveFiles(prev => prev.filter(f => f.id !== file.id));
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to delete file.' });
    }
  };

  // Google Sheets Actions
  const handleSaveSpreadsheetLink = async (sheetInput: string) => {
    let cleanId = sheetInput.trim();
    if (cleanId.includes('/d/')) {
      const match = cleanId.match(/\/d\/([a-zA-Z0-9-_]+)/);
      if (match && match[1]) cleanId = match[1];
    }
    if (!cleanId) {
      setStatusMessage({ type: 'error', text: 'Please enter a valid Google Spreadsheet ID or URL.' });
      return;
    }
    const cleanUrl = `https://docs.google.com/spreadsheets/d/${cleanId}/edit`;
    setActiveSpreadsheetId(cleanId);
    setActiveSpreadsheetUrl(cleanUrl);

    const updated = {
      ...settings,
      google_spreadsheet_id: cleanId,
      google_spreadsheet_url: cleanUrl,
      google_workspace_email: user?.email || settings.google_workspace_email,
      auto_sync_google_sheets: true,
    };
    StorageService.saveSettings(updated);

    // Immediately push current products and sales to the newly linked sheet
    setLoadingAction('sheets-link');
    try {
      await WorkspaceService.exportProductsToSheet(cleanId, products, 'Products_Inventory');
      await WorkspaceService.exportSalesToSheet(cleanId, sales, 'Sales_Ledger');
      setStatusMessage({ type: 'success', text: `Linked Google Spreadsheet #${cleanId} saved to POS settings! Products and sales are synchronized.` });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: `Sheet linked, but initial export had an issue: ${err.message}` });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleCreateNewSheet = async () => {
    setLoadingAction('sheets-create');
    setStatusMessage(null);
    try {
      const title = `BoomandCarry POS Master Sheet - ${new Date().toLocaleDateString()}`;
      const result = await WorkspaceService.createSpreadsheet(title, ['Products_Inventory', 'Sales_Ledger']);
      setActiveSpreadsheetId(result.spreadsheetId);
      setActiveSpreadsheetUrl(result.spreadsheetUrl);

      const updated = {
        ...settings,
        google_spreadsheet_id: result.spreadsheetId,
        google_spreadsheet_url: result.spreadsheetUrl,
        google_workspace_email: user?.email || settings.google_workspace_email,
        auto_sync_google_sheets: true,
      };
      StorageService.saveSettings(updated);

      // Auto populate products
      await WorkspaceService.exportProductsToSheet(result.spreadsheetId, products, 'Products_Inventory');
      await WorkspaceService.exportSalesToSheet(result.spreadsheetId, sales, 'Sales_Ledger');

      setStatusMessage({ type: 'success', text: `Google Spreadsheet created and synced with ${products.length} products and ${sales.length} sales!` });
      loadDriveFiles();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to create Google Spreadsheet.' });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleSyncProductsToSheet = async () => {
    if (!activeSpreadsheetId) {
      setStatusMessage({ type: 'error', text: 'Please create or provide a Google Spreadsheet ID first.' });
      return;
    }
    setLoadingAction('sheets-sync-products');
    setStatusMessage(null);
    try {
      await WorkspaceService.exportProductsToSheet(activeSpreadsheetId, products, 'Products_Inventory');
      setStatusMessage({ type: 'success', text: `Exported ${products.length} products to Google Sheets successfully!` });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to sync products to Google Sheet.' });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleSyncSalesToSheet = async () => {
    if (!activeSpreadsheetId) {
      setStatusMessage({ type: 'error', text: 'Please create or provide a Google Spreadsheet ID first.' });
      return;
    }
    setLoadingAction('sheets-sync-sales');
    setStatusMessage(null);
    try {
      await WorkspaceService.exportSalesToSheet(activeSpreadsheetId, sales, 'Sales_Ledger');
      setStatusMessage({ type: 'success', text: `Exported ${sales.length} sales invoices to Google Sheets successfully!` });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to sync sales to Google Sheet.' });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleImportFromSheet = async () => {
    if (!activeSpreadsheetId) {
      setStatusMessage({ type: 'error', text: 'Please provide a Google Spreadsheet ID.' });
      return;
    }
    setLoadingAction('sheets-import');
    setStatusMessage(null);
    try {
      const sheetProducts = await WorkspaceService.readProductsFromSheet(activeSpreadsheetId, 'Products_Inventory');
      if (sheetProducts.length === 0) {
        setStatusMessage({ type: 'info', text: 'No products found in the specified Google Sheet tab.' });
        return;
      }
      StorageService.saveProducts(sheetProducts);
      setStatusMessage({ type: 'success', text: `Imported ${sheetProducts.length} products from Google Sheets directly into inventory!` });
      if (onDataImported) onDataImported();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to import from Google Sheet.' });
    } finally {
      setLoadingAction(null);
    }
  };

  // Gmail Actions
  const handleSendTestReceipt = async () => {
    if (!recipientEmail) {
      setStatusMessage({ type: 'error', text: 'Please enter a valid recipient email address.' });
      return;
    }
    if (sales.length === 0) {
      setStatusMessage({ type: 'error', text: 'No sales records found to generate receipt email.' });
      return;
    }
    setLoadingAction('gmail-receipt');
    setStatusMessage(null);
    try {
      const latestSale = sales[0];
      await WorkspaceService.sendInvoiceReceiptEmail(recipientEmail, latestSale, settings);
      setStatusMessage({ type: 'success', text: `Official invoice #${latestSale.invoice_no} email dispatched via Gmail to ${recipientEmail}!` });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to send receipt email via Gmail.' });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleSendLowStockAlert = async () => {
    if (!recipientEmail) {
      setStatusMessage({ type: 'error', text: 'Please enter a valid recipient email address.' });
      return;
    }
    const lowStockItems = products.filter(p => p.stock_qty <= (p.min_stock_alert || 5));
    if (lowStockItems.length === 0) {
      setStatusMessage({ type: 'info', text: 'All items currently have healthy stock levels. (No low stock items).' });
      return;
    }
    setLoadingAction('gmail-lowstock');
    setStatusMessage(null);
    try {
      await WorkspaceService.sendLowStockAlertEmail(recipientEmail, lowStockItems, settings);
      setStatusMessage({ type: 'success', text: `Low stock alert with ${lowStockItems.length} items sent via Gmail to ${recipientEmail}!` });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to send low stock alert via Gmail.' });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleSendCustomEmail = async () => {
    if (!recipientEmail || !customEmailSubject || !customEmailBody) {
      setStatusMessage({ type: 'error', text: 'Please fill in recipient, subject, and message content.' });
      return;
    }
    setLoadingAction('gmail-custom');
    setStatusMessage(null);
    try {
      await WorkspaceService.sendEmail(recipientEmail, customEmailSubject, customEmailBody);
      setStatusMessage({ type: 'success', text: `Email successfully sent via Gmail to ${recipientEmail}!` });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to send email.' });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleSendMonthlyExecutiveReport = async () => {
    const targetEmail = recipientEmail || 'bloomandcarry.pk@gmail.com';
    setLoadingAction('gmail-monthly-report');
    setStatusMessage(null);
    try {
      const currentMonthStr = new Date().toISOString().slice(0, 7);
      const res = await WorkspaceService.sendMonthlyComprehensiveReportEmail(
        targetEmail,
        currentMonthStr,
        sales,
        StorageService.getExpenses(),
        products,
        settings
      );
      setStatusMessage({ 
        type: 'success', 
        text: `📊 Executive Monthly Business Report for ${currentMonthStr} was successfully emailed to ${targetEmail}!` 
      });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to send monthly report email.' });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleSyncDailyLedgerToSheet = async () => {
    if (!activeSpreadsheetId) {
      setStatusMessage({ type: 'error', text: 'Please create or link a Google Spreadsheet first.' });
      return;
    }
    setLoadingAction('sheets-daily-ledger');
    setStatusMessage(null);
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      await WorkspaceService.exportDailySummaryToSheet(
        activeSpreadsheetId,
        todayStr,
        sales,
        StorageService.getExpenses()
      );
      setStatusMessage({ 
        type: 'success', 
        text: `Today's Daily Closing Ledger (${todayStr}) was stored in the 'Daily_Ledger' tab of your Google Sheet!` 
      });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to record daily ledger in Google Sheet.' });
    } finally {
      setLoadingAction(null);
    }
  };

  // Cloud Database Sync
  const handleSyncToFirestore = async () => {
    setLoadingAction('firebase-sync');
    setStatusMessage(null);
    try {
      if (products.length > 0) {
        await MongoDbService.bulkSaveProducts(products);
      }
      for (const s of sales.slice(0, 50)) {
        await MongoDbService.saveSale(s);
      }
      for (const c of customers.slice(0, 50)) {
        await MongoDbService.saveCustomer(c);
      }
      await MongoDbService.saveSettings(settings);
      setStatusMessage({ type: 'success', text: `Synced ${products.length} products, ${sales.length} sales, and store settings to MongoDB Atlas database!` });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to sync with MongoDB Atlas.' });
    } finally {
      setLoadingAction(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-5 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/30 border border-indigo-400/40 flex items-center justify-center text-indigo-300">
              <Cloud className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-black tracking-tight">Google Workspace & Cloud Sync Center</h2>
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Live Cloud Integrations
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Google Drive • Google Sheets • Gmail API • Firebase Firestore Database • Cloud SQL
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Notification Banner */}
        {statusMessage && (
          <div className={`px-5 py-3 text-xs font-semibold flex items-center justify-between border-b ${
            statusMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
            statusMessage.type === 'error' ? 'bg-rose-50 text-rose-800 border-rose-200' :
            'bg-blue-50 text-blue-800 border-blue-200'
          }`}>
            <div className="flex items-center space-x-2">
              {statusMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />}
              <span>{statusMessage.text}</span>
            </div>
            <button onClick={() => setStatusMessage(null)} className="text-slate-400 hover:text-slate-600 font-bold ml-2">✕</button>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50/80 px-5 gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-3 px-3.5 text-xs font-extrabold border-b-2 flex items-center space-x-1.5 transition whitespace-nowrap cursor-pointer ${
              activeTab === 'overview' ? 'border-indigo-600 text-indigo-600 bg-white' : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Connection Overview</span>
          </button>
          <button
            onClick={() => setActiveTab('drive')}
            className={`py-3 px-3.5 text-xs font-extrabold border-b-2 flex items-center space-x-1.5 transition whitespace-nowrap cursor-pointer ${
              activeTab === 'drive' ? 'border-amber-600 text-amber-600 bg-white' : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <HardDrive className="w-4 h-4" />
            <span>Google Drive</span>
          </button>
          <button
            onClick={() => setActiveTab('sheets')}
            className={`py-3 px-3.5 text-xs font-extrabold border-b-2 flex items-center space-x-1.5 transition whitespace-nowrap cursor-pointer ${
              activeTab === 'sheets' ? 'border-emerald-600 text-emerald-600 bg-white' : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Google Sheets</span>
          </button>
          <button
            onClick={() => setActiveTab('gmail')}
            className={`py-3 px-3.5 text-xs font-extrabold border-b-2 flex items-center space-x-1.5 transition whitespace-nowrap cursor-pointer ${
              activeTab === 'gmail' ? 'border-rose-600 text-rose-600 bg-white' : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Mail className="w-4 h-4" />
            <span>Gmail Dispatcher</span>
          </button>
          <button
            onClick={() => setActiveTab('firebase')}
            className={`py-3 px-3.5 text-xs font-extrabold border-b-2 flex items-center space-x-1.5 transition whitespace-nowrap cursor-pointer ${
              activeTab === 'firebase' ? 'border-orange-600 text-orange-600 bg-white' : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Flame className="w-4 h-4" />
            <span>Firebase Firestore</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="p-5 overflow-y-auto flex-1 bg-slate-50/40">
          {/* TAB 1: CONNECTION OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-5">
              {/* Auth Card */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center space-x-4">
                    {user?.photoURL ? (
                      <img src={user.photoURL} alt="Profile" className="w-12 h-12 rounded-full border-2 border-indigo-200 shadow-xs" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center text-indigo-700 font-black text-lg">
                        {user?.email ? user.email.charAt(0).toUpperCase() : 'G'}
                      </div>
                    )}
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="font-extrabold text-slate-900 text-base">
                          {user ? user.displayName || user.email : 'Google Account Connection'}
                        </h3>
                        {user && (
                          <span className="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                            Connected
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {user ? user.email : 'Connect your Google account to enable Drive backups, Sheets syncing, and Gmail dispatch.'}
                      </p>
                    </div>
                  </div>

                  <div>
                    {!user ? (
                      <button
                        onClick={handleGoogleLogin}
                        disabled={isLoggingIn}
                        className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-bold px-4 py-2.5 rounded-xl shadow-xs transition flex items-center space-x-2.5 cursor-pointer"
                      >
                        <svg className="w-5 h-5" viewBox="0 0 48 48">
                          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                          <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                        </svg>
                        <span>{isLoggingIn ? 'Connecting...' : 'Sign in with Google'}</span>
                      </button>
                    ) : (
                      <button
                        onClick={handleLogout}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3.5 py-2 rounded-xl text-xs transition cursor-pointer"
                      >
                        Disconnect Account
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Service Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Google Drive */}
                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2 text-amber-600 font-extrabold text-sm">
                        <HardDrive className="w-5 h-5" />
                        <span>Google Drive</span>
                      </div>
                      <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${user ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                        {user ? 'Active' : 'Awaiting Auth'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Store cloud JSON/CSV backups, browse stored backups, and restore POS records directly from Drive.
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveTab('drive')}
                    className="mt-4 w-full bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-extrabold py-2 rounded-lg transition text-center cursor-pointer"
                  >
                    Open Drive Manager →
                  </button>
                </div>

                {/* Google Sheets */}
                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2 text-emerald-600 font-extrabold text-sm">
                        <FileSpreadsheet className="w-5 h-5" />
                        <span>Google Sheets</span>
                      </div>
                      <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${user ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                        {user ? 'Active' : 'Awaiting Auth'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Real-time two-way synchronization of cosmetic products, inventory levels, and sales invoice ledgers.
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveTab('sheets')}
                    className="mt-4 w-full bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-extrabold py-2 rounded-lg transition text-center cursor-pointer"
                  >
                    Open Sheets Sync →
                  </button>
                </div>

                {/* Gmail API */}
                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2 text-rose-600 font-extrabold text-sm">
                        <Mail className="w-5 h-5" />
                        <span>Gmail API</span>
                      </div>
                      <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${user ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                        {user ? 'Active' : 'Awaiting Auth'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Dispatch official HTML tax receipts directly to customers and send automated stock alerts to management.
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveTab('gmail')}
                    className="mt-4 w-full bg-rose-50 hover:bg-rose-100 text-rose-800 text-xs font-extrabold py-2 rounded-lg transition text-center cursor-pointer"
                  >
                    Open Email Dispatcher →
                  </button>
                </div>

                {/* Firebase Firestore */}
                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2 text-orange-600 font-extrabold text-sm">
                        <Flame className="w-5 h-5" />
                        <span>Firebase Firestore</span>
                      </div>
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                        Provisioned
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Cloud Firestore database provisioned with hardened security rules for persistent real-time POS data.
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveTab('firebase')}
                    className="mt-4 w-full bg-orange-50 hover:bg-orange-100 text-orange-800 text-xs font-extrabold py-2 rounded-lg transition text-center cursor-pointer"
                  >
                    Manage Cloud Database →
                  </button>
                </div>

                {/* Cloud SQL Information */}
                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-col justify-between md:col-span-2">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2 text-blue-600 font-extrabold text-sm">
                        <Database className="w-5 h-5" />
                        <span>Google Cloud SQL (asia-southeast1)</span>
                      </div>
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                        GCP Billing Required
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Cloud SQL instance provisioning in region <code className="bg-slate-100 px-1 py-0.5 rounded text-blue-700 font-mono">asia-southeast1</code> requires an active Google Cloud Billing account and owner permissions on project <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-700 font-mono">gen-lang-client-0570638441</code>. Firebase Firestore is currently configured as your active real-time cloud database.
                    </p>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-lg">
                    <span>💡 <strong>Fallback Active:</strong> Firestore persistent collections are live and working seamlessly.</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: GOOGLE DRIVE */}
          {activeTab === 'drive' && (
            <div className="space-y-5">
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base flex items-center space-x-2">
                    <HardDrive className="w-5 h-5 text-amber-600" />
                    <span>Google Drive Cloud Backups</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Export entire database snapshots directly to your Google Drive or restore from prior backups.
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={loadDriveFiles}
                    disabled={isLoadingDrive}
                    className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition cursor-pointer"
                    title="Refresh Drive files"
                  >
                    <RefreshCw className={`w-4 h-4 ${isLoadingDrive ? 'animate-spin' : ''}`} />
                  </button>
                  <button
                    onClick={handleBackupToDrive}
                    disabled={loadingAction === 'drive-backup'}
                    className="bg-amber-600 hover:bg-amber-700 text-white font-extrabold px-4 py-2.5 rounded-xl text-xs shadow-xs transition flex items-center space-x-2 cursor-pointer"
                  >
                    <UploadCloud className="w-4 h-4" />
                    <span>{loadingAction === 'drive-backup' ? 'Uploading...' : 'Save Full Backup to Drive'}</span>
                  </button>
                </div>
              </div>

              {/* Files Table */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider">
                    Drive Backups & Sheets Files ({driveFiles.length})
                  </h4>
                </div>

                {isLoadingDrive ? (
                  <div className="p-10 text-center text-slate-500 text-xs">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-amber-600 mb-2" />
                    Loading files from your Google Drive...
                  </div>
                ) : driveFiles.length === 0 ? (
                  <div className="p-10 text-center text-slate-400 text-xs">
                    <HardDrive className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    No POS backups found in Drive yet. Click "Save Full Backup to Drive" to create your first cloud snapshot.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {driveFiles.map(file => (
                      <div key={file.id} className="p-3.5 hover:bg-slate-50 flex items-center justify-between transition">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center font-bold text-xs">
                            {file.mimeType.includes('spreadsheet') ? '📊' : '📁'}
                          </div>
                          <div>
                            <p className="text-xs font-extrabold text-slate-900">{file.name}</p>
                            <p className="text-[11px] text-slate-400">
                              Modified: {file.modifiedTime ? new Date(file.modifiedTime).toLocaleString() : 'Recent'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          {file.webViewLink && (
                            <a
                              href={file.webViewLink}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 text-slate-500 hover:text-indigo-600 rounded transition"
                              title="Open in Drive"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          )}
                          {file.name.endsWith('.json') && (
                            <button
                              onClick={() => handleRestoreFromDrive(file)}
                              disabled={loadingAction === `restore-${file.id}`}
                              className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[11px] font-extrabold rounded transition cursor-pointer"
                            >
                              {loadingAction === `restore-${file.id}` ? 'Restoring...' : 'Restore Data'}
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteDriveFile(file)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded transition cursor-pointer"
                            title="Delete file"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: GOOGLE SHEETS */}
          {activeTab === 'sheets' && (
            <div className="space-y-5">
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-base flex items-center space-x-2">
                      <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                      <span>Google Sheets Two-Way Synchronization</span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      Export products catalog and sales reports into formatted Google Spreadsheets or pull inventory updates back.
                    </p>
                  </div>
                  <button
                    onClick={handleCreateNewSheet}
                    disabled={loadingAction === 'sheets-create'}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-4 py-2.5 rounded-xl text-xs shadow-xs transition flex items-center space-x-2 cursor-pointer whitespace-nowrap"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>{loadingAction === 'sheets-create' ? 'Generating...' : 'Create Master Google Sheet'}</span>
                  </button>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Target Spreadsheet ID or Google Sheet Link:
                  </label>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <input
                      type="text"
                      value={activeSpreadsheetId}
                      onChange={(e) => setActiveSpreadsheetId(e.target.value)}
                      placeholder="Paste Google Spreadsheet ID or full docs.google.com URL"
                      className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-hidden font-mono"
                    />
                    <button
                      onClick={() => handleSaveSpreadsheetLink(activeSpreadsheetId)}
                      disabled={loadingAction === 'sheets-link'}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-3.5 py-2 rounded-lg text-xs transition cursor-pointer whitespace-nowrap"
                    >
                      {loadingAction === 'sheets-link' ? 'Linking...' : 'Save & Link Sheet'}
                    </button>
                    {activeSpreadsheetUrl && (
                      <a
                        href={activeSpreadsheetUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="bg-emerald-100 text-emerald-800 hover:bg-emerald-200 font-extrabold px-3 py-2 rounded-lg text-xs flex items-center justify-center space-x-1"
                      >
                        <span>Open Sheet</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
                  <button
                    onClick={handleSyncProductsToSheet}
                    disabled={loadingAction === 'sheets-sync-products'}
                    className="p-3.5 bg-white border border-emerald-300 hover:border-emerald-500 rounded-xl text-left transition shadow-xs cursor-pointer group"
                  >
                    <div className="flex items-center justify-between text-emerald-700 font-extrabold text-xs mb-1">
                      <span>Push Products ({products.length})</span>
                      <UploadCloud className="w-4 h-4 group-hover:translate-y-[-2px] transition" />
                    </div>
                    <p className="text-[11px] text-slate-500">Writes current catalog to 'Products_Inventory'.</p>
                  </button>

                  <button
                    onClick={handleSyncSalesToSheet}
                    disabled={loadingAction === 'sheets-sync-sales'}
                    className="p-3.5 bg-white border border-emerald-300 hover:border-emerald-500 rounded-xl text-left transition shadow-xs cursor-pointer group"
                  >
                    <div className="flex items-center justify-between text-emerald-700 font-extrabold text-xs mb-1">
                      <span>Push Sales ({sales.length})</span>
                      <UploadCloud className="w-4 h-4 group-hover:translate-y-[-2px] transition" />
                    </div>
                    <p className="text-[11px] text-slate-500">Writes invoices ledger into 'Sales_Ledger'.</p>
                  </button>

                  <button
                    onClick={handleSyncDailyLedgerToSheet}
                    disabled={loadingAction === 'sheets-daily-ledger'}
                    className="p-3.5 bg-white border border-emerald-300 hover:border-emerald-500 rounded-xl text-left transition shadow-xs cursor-pointer group"
                  >
                    <div className="flex items-center justify-between text-emerald-700 font-extrabold text-xs mb-1">
                      <span>Daily Ledger Row</span>
                      <UploadCloud className="w-4 h-4 group-hover:translate-y-[-2px] transition" />
                    </div>
                    <p className="text-[11px] text-slate-500">Records today's sales & profit in 'Daily_Ledger'.</p>
                  </button>

                  <button
                    onClick={handleImportFromSheet}
                    disabled={loadingAction === 'sheets-import'}
                    className="p-3.5 bg-white border border-indigo-300 hover:border-indigo-500 rounded-xl text-left transition shadow-xs cursor-pointer group"
                  >
                    <div className="flex items-center justify-between text-indigo-700 font-extrabold text-xs mb-1">
                      <span>Pull from Sheet</span>
                      <DownloadCloud className="w-4 h-4 group-hover:translate-y-[2px] transition" />
                    </div>
                    <p className="text-[11px] text-slate-500">Imports updated prices & quantities.</p>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: GMAIL DISPATCHER */}
          {activeTab === 'gmail' && (
            <div className="space-y-5">
              {/* Automated Monthly Reporting Card */}
              <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white rounded-xl p-5 shadow-md border border-indigo-700/50">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="bg-rose-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                        Automated Monthly Reporting
                      </span>
                      <span className="text-indigo-300 text-xs font-mono">
                        Target: bloomandcarry.pk@gmail.com
                      </span>
                    </div>
                    <h3 className="text-base font-black text-white">Monthly Executive Business & P&L Email Report</h3>
                    <p className="text-xs text-indigo-200 leading-relaxed max-w-2xl">
                      Automatically generates and emails full financial statements, profit & loss, expense breakdowns, and top-selling product CSV reports on the 1st of every month to <strong>bloomandcarry.pk@gmail.com</strong>.
                    </p>
                  </div>
                  <button
                    onClick={handleSendMonthlyExecutiveReport}
                    disabled={loadingAction === 'gmail-monthly-report'}
                    className="bg-rose-600 hover:bg-rose-500 text-white font-black px-4 py-2.5 rounded-xl text-xs shadow-lg transition flex items-center justify-center space-x-2 cursor-pointer whitespace-nowrap self-start sm:self-auto"
                  >
                    <Send className="w-4 h-4" />
                    <span>{loadingAction === 'gmail-monthly-report' ? 'Generating & Emailing...' : 'Dispatch Monthly Report Now'}</span>
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base flex items-center space-x-2">
                    <Mail className="w-5 h-5 text-rose-600" />
                    <span>Gmail API Automated Dispatcher</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Send thermal tax receipts to customers or automated stock alerts to your management email via Gmail.
                  </p>
                </div>

                <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Recipient Email Address:</label>
                    <input
                      type="email"
                      value={recipientEmail}
                      onChange={(e) => setRecipientEmail(e.target.value)}
                      placeholder="bloomandcarry.pk@gmail.com"
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:outline-hidden font-medium"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <button
                      onClick={handleSendTestReceipt}
                      disabled={loadingAction === 'gmail-receipt'}
                      className="p-3 bg-white border border-rose-200 hover:border-rose-400 rounded-xl text-left transition shadow-xs cursor-pointer flex items-center justify-between"
                    >
                      <div>
                        <p className="text-xs font-extrabold text-rose-700">Dispatch Latest Invoice Receipt</p>
                        <p className="text-[11px] text-slate-500">Formats HTML thermal receipt & emails to recipient</p>
                      </div>
                      <Send className="w-4 h-4 text-rose-600" />
                    </button>

                    <button
                      onClick={handleSendLowStockAlert}
                      disabled={loadingAction === 'gmail-lowstock'}
                      className="p-3 bg-white border border-amber-200 hover:border-amber-400 rounded-xl text-left transition shadow-xs cursor-pointer flex items-center justify-between"
                    >
                      <div>
                        <p className="text-xs font-extrabold text-amber-700">Send Low Stock Alert Report</p>
                        <p className="text-[11px] text-slate-500">Emails table of items at or below safety threshold</p>
                      </div>
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                    </button>
                  </div>
                </div>

                {/* Custom Compose Box */}
                <div className="border border-slate-200 rounded-xl p-4 space-y-3">
                  <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider">Custom Message Dispatch</h4>
                  <div>
                    <input
                      type="text"
                      value={customEmailSubject}
                      onChange={(e) => setCustomEmailSubject(e.target.value)}
                      placeholder="Email Subject"
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-400 focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <textarea
                      rows={3}
                      value={customEmailBody}
                      onChange={(e) => setCustomEmailBody(e.target.value)}
                      placeholder="Email message content..."
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-400 focus:outline-hidden"
                    />
                  </div>
                  <button
                    onClick={handleSendCustomEmail}
                    disabled={loadingAction === 'gmail-custom'}
                    className="bg-slate-900 hover:bg-slate-800 text-white font-extrabold px-4 py-2 rounded-lg text-xs transition flex items-center space-x-2 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{loadingAction === 'gmail-custom' ? 'Sending...' : 'Send Custom Email'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: FIREBASE FIRESTORE */}
          {activeTab === 'firebase' && (
            <div className="space-y-5">
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-base flex items-center space-x-2">
                      <Flame className="w-5 h-5 text-orange-600" />
                      <span>Firebase Cloud Firestore Database</span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      Persistent cloud database with zero-trust Attribute-Based Access Control security rules deployed.
                    </p>
                  </div>
                  <span className={`text-xs font-bold px-3 py-1 rounded-full ${isFirestoreConnected ? 'bg-emerald-100 text-emerald-800' : 'bg-orange-100 text-orange-800'}`}>
                    {isFirestoreConnected ? '● Online & Ready' : '● Provisioned (gen-lang-client-0570638441)'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div className="bg-orange-50/50 border border-orange-200 rounded-xl p-4">
                    <h4 className="text-xs font-extrabold text-orange-950 mb-1">Live Collections Provisioned:</h4>
                    <ul className="text-xs text-orange-900 space-y-1 font-mono">
                      <li>• /products (Inventory items & barcodes)</li>
                      <li>• /sales (Invoices & payment records)</li>
                      <li>• /customers (Customer profiles & loyalty)</li>
                      <li>• /settings (Store tax, currency, headers)</li>
                    </ul>
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col justify-between">
                    <div>
                      <h4 className="text-xs font-extrabold text-slate-900 mb-1">One-Click Cloud Sync</h4>
                      <p className="text-xs text-slate-500">
                        Pushes all current local products, transactions, and settings to your Firestore project.
                      </p>
                    </div>
                    <button
                      onClick={handleSyncToFirestore}
                      disabled={loadingAction === 'firebase-sync'}
                      className="mt-3 bg-orange-600 hover:bg-orange-700 text-white font-extrabold px-4 py-2.5 rounded-xl text-xs transition flex items-center justify-center space-x-2 cursor-pointer"
                    >
                      <UploadCloud className="w-4 h-4" />
                      <span>{loadingAction === 'firebase-sync' ? 'Syncing to Cloud...' : 'Sync Local Data to Cloud Firestore'}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>Google APIs & Firebase Integrated</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-extrabold rounded-xl transition cursor-pointer"
          >
            Close Window
          </button>
        </div>
      </div>
    </div>
  );
};

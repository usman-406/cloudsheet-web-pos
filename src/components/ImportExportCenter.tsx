import React, { useState, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { StorageService } from '../services/storage';
import { SecurityUploadService } from '../services/security_upload_service';
import { BackupEncryptionService, LocalAutoSnapshot } from '../services/backup_encryption_service';
import { MongoDbService } from '../services/mongodb_service';
import { WorkspaceService } from '../services/workspace';
import { ShopSettings, Product, Customer, Expense, FullSystemBackupPayload, CloudBackupRecord, BackupAuditLog } from '../types';
import { 
  FileUp, 
  FileDown, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  FileSpreadsheet, 
  Database, 
  RefreshCw, 
  FileText, 
  Lock, 
  ShieldCheck, 
  Cloud, 
  HardDrive, 
  History, 
  Download, 
  Upload, 
  Trash2, 
  RotateCcw, 
  Key, 
  FolderSync,
  AlertTriangle,
  Eye,
  Check
} from 'lucide-react';

interface ImportExportCenterProps {
  settings: ShopSettings;
  products: Product[];
  customers: Customer[];
  expenses: Expense[];
  onRefreshData: () => void;
}

type MainTab = 'backup_restore' | 'import' | 'export' | 'audit_logs';
type ImportType = 'products' | 'customers' | 'suppliers' | 'expenses';

export const ImportExportCenter: React.FC<ImportExportCenterProps> = ({
  settings,
  products,
  customers,
  expenses,
  onRefreshData,
}) => {
  const [activeTab, setActiveTab] = useState<MainTab>('backup_restore');
  
  // Backup & Disaster Recovery State
  const [backupPin, setBackupPin] = useState<string>('123456');
  const [isGeneratingBackup, setIsGeneratingBackup] = useState<boolean>(false);
  const [isUploadingToDrive, setIsUploadingToDrive] = useState<boolean>(false);
  const [isSyncingFirestore, setIsSyncingFirestore] = useState<boolean>(false);
  const [isPullingFirestore, setIsPullingFirestore] = useState<boolean>(false);
  const [cloudSnapshots, setCloudSnapshots] = useState<CloudBackupRecord[]>([]);
  const [localSnapshots, setLocalSnapshots] = useState<LocalAutoSnapshot[]>([]);
  const [auditLogs, setAuditLogs] = useState<BackupAuditLog[]>([]);
  
  // File Restore Wizard State
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restoreFileContent, setRestoreFileContent] = useState<string>('');
  const [restorePinInput, setRestorePinInput] = useState<string>('123456');
  const [decryptedPayload, setDecryptedPayload] = useState<FullSystemBackupPayload | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restoreSuccessMsg, setRestoreSuccessMsg] = useState<string | null>(null);
  const [isExecutingRestore, setIsExecutingRestore] = useState<boolean>(false);
  const [restoreMode, setRestoreMode] = useState<'REPLACE_ALL' | 'MERGE'>('REPLACE_ALL');

  // Import Wizard State
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [importType, setImportType] = useState<ImportType>('products');
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [validRowsCount, setValidRowsCount] = useState<number>(0);
  const [duplicateCount, setDuplicateCount] = useState<number>(0);
  const [duplicateAction, setDuplicateAction] = useState<'skip' | 'overwrite'>('skip');
  const [importLog, setImportLog] = useState<string[]>([]);
  
  const restoreFileInputRef = useRef<HTMLInputElement>(null);
  const importFileInputRef = useRef<HTMLInputElement>(null);

  // Load initial backup records
  useEffect(() => {
    refreshBackupMetadata();
  }, []);

  const refreshBackupMetadata = async () => {
    setLocalSnapshots(BackupEncryptionService.getLocalSnapshots());
    setAuditLogs(BackupEncryptionService.getAuditLogs());
    try {
      const cloud = await BackupEncryptionService.fetchFirestoreSnapshots();
      setCloudSnapshots(cloud);
    } catch {
      // Offline fallback
    }
  };

  // ----------------------------------------------------
  // BACKUP GENERATION HANDLERS
  // ----------------------------------------------------

  const handleDownloadEncryptedBackup = () => {
    try {
      setIsGeneratingBackup(true);
      const payload = BackupEncryptionService.createFullSystemBackup('Admin');
      const rawJson = JSON.stringify(payload, null, 2);
      const encrypted = BackupEncryptionService.encryptPayload(rawJson, backupPin);
      
      const blob = new Blob([encrypted], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dateStr = new Date().toISOString().slice(0, 10);
      const filename = `BloomAndCarry_SecureBackup_${dateStr}_${Date.now().toString().slice(-4)}.bcbackup`;
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      BackupEncryptionService.logBackupAudit(
        filename,
        'EXPORT_ENCRYPTED',
        'Admin',
        blob.size,
        'SUCCESS',
        `Encrypted snapshot generated (${payload.products.length} Products, ${payload.sales.length} Sales)`
      );

      refreshBackupMetadata();
      alert(`Encrypted Backup Downloaded!\n\nFile: ${filename}\nDecryption PIN: ${backupPin}\nKeep this PIN safe to restore data in the future.`);
    } catch (err: any) {
      alert(`Backup generation failed: ${err.message}`);
    } finally {
      setIsGeneratingBackup(false);
    }
  };

  const handleDownloadPlainJsonBackup = () => {
    try {
      setIsGeneratingBackup(true);
      const payload = BackupEncryptionService.createFullSystemBackup('Admin');
      const rawJson = JSON.stringify(payload, null, 2);
      
      const blob = new Blob([rawJson], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dateStr = new Date().toISOString().slice(0, 10);
      const filename = `BloomAndCarry_FullBackup_${dateStr}_${Date.now().toString().slice(-4)}.json`;
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      BackupEncryptionService.logBackupAudit(
        filename,
        'EXPORT_ENCRYPTED',
        'Admin',
        blob.size,
        'SUCCESS',
        `Universal JSON Backup generated (${payload.products.length} Products, ${payload.sales.length} Sales)`
      );

      refreshBackupMetadata();
      alert(`Full Universal JSON Backup Downloaded!\n\nFile: ${filename}\nContains all 10+ data stores in standard JSON format.`);
    } catch (err: any) {
      alert(`Backup generation failed: ${err.message}`);
    } finally {
      setIsGeneratingBackup(false);
    }
  };

  const handleSaveToFirestore = async () => {
    try {
      setIsSyncingFirestore(true);
      const record = await BackupEncryptionService.pushSnapshotToFirestore('Admin');
      refreshBackupMetadata();
      alert(`Cloud Backup Saved to Firestore!\n\nBackup ID: ${record.id}\nSnapshot saved with ${record.products_count} Products and ${record.sales_count} Sales.`);
    } catch (err: any) {
      alert(`Firestore backup failed: ${err.message}`);
    } finally {
      setIsSyncingFirestore(false);
    }
  };

  const handleSaveToGoogleDrive = async () => {
    try {
      setIsUploadingToDrive(true);
      const res = await BackupEncryptionService.uploadSnapshotToGoogleDrive(false, backupPin, 'Admin');
      refreshBackupMetadata();
      alert(`Successfully Backed Up to Google Drive!\n\nFile: ${res.fileName}\nUploaded to your connected Google Drive.`);
    } catch (err: any) {
      alert(`Google Drive backup failed: ${err.message}\nMake sure you have authorized Google Workspace in the Google Workspace tab.`);
    } finally {
      setIsUploadingToDrive(false);
    }
  };

  const handleCreateManualLocalSnapshot = () => {
    const snap = BackupEncryptionService.createLocalAutoSnapshot('Manual Admin Snapshot', 'Admin');
    refreshBackupMetadata();
    alert(`Local Safety Snapshot Created!\n\nSnapshot ID: ${snap.id}\nTimestamp: ${new Date(snap.timestamp).toLocaleTimeString()}`);
  };

  // ----------------------------------------------------
  // RESTORE & RECOVERY HANDLERS
  // ----------------------------------------------------

  const handleRestoreFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setRestoreFile(file);
    setRestoreError(null);
    setDecryptedPayload(null);
    setRestoreSuccessMsg(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      setRestoreFileContent(text);
      inspectAndParseRestoreContent(text, file.name, restorePinInput);
    };
    reader.readAsText(file);
  };

  const inspectAndParseRestoreContent = (content: string, filename: string, pin: string) => {
    setRestoreError(null);
    try {
      let payload: FullSystemBackupPayload;
      const cleanContent = content.trim();

      if (cleanContent.startsWith('{') || cleanContent.startsWith('[')) {
        // Plain JSON
        payload = JSON.parse(cleanContent);
      } else {
        // Encrypted .bcbackup
        const decryptedJson = BackupEncryptionService.decryptPayload(cleanContent, pin);
        payload = JSON.parse(decryptedJson);
      }

      // Check essential fields
      if (!payload.products && !payload.sales && !payload.customers) {
        throw new Error('File does not contain valid POS backup stores.');
      }

      setDecryptedPayload(payload);
    } catch (err: any) {
      setDecryptedPayload(null);
      setRestoreError(err.message || 'Unable to parse backup file. Check encryption PIN or file format.');
    }
  };

  const handleDecryptRetry = () => {
    if (!restoreFileContent || !restoreFile) return;
    inspectAndParseRestoreContent(restoreFileContent, restoreFile.name, restorePinInput);
  };

  const handleExecuteRestore = async () => {
    if (!decryptedPayload) return;

    const confirmMsg = restoreMode === 'REPLACE_ALL'
      ? 'WARNING: This will replace all current data with the backup snapshot. A safety rollback snapshot will be automatically saved first. Proceed?'
      : 'Merge Mode: This will add all missing items from the backup snapshot to your current database. Proceed?';

    if (!window.confirm(confirmMsg)) return;

    try {
      setIsExecutingRestore(true);
      setRestoreError(null);

      const result = await BackupEncryptionService.restoreFullSystem(decryptedPayload, restoreMode, 'Admin');
      
      setRestoreSuccessMsg(`Restore Succeeded! Restored ${result.restoredCounts.products} Products, ${result.restoredCounts.sales} Sales, ${result.restoredCounts.customers} Customers.`);
      onRefreshData();
      refreshBackupMetadata();
      alert(`System Successfully Restored!\n\nAll stores have been synchronized and verified.`);
    } catch (err: any) {
      setRestoreError(`Restore execution failed: ${err.message}`);
    } finally {
      setIsExecutingRestore(false);
    }
  };

  const handleRestoreFromCloudFirestore = async (snapshotId: string) => {
    if (!window.confirm('Restore database from this Cloud Firestore snapshot? Current state will be backed up automatically.')) return;
    try {
      setIsExecutingRestore(true);
      await BackupEncryptionService.restoreFromFirestoreSnapshot(snapshotId, 'Admin');
      onRefreshData();
      refreshBackupMetadata();
      alert('Database restored from Cloud Firestore snapshot!');
    } catch (err: any) {
      alert(`Cloud restore failed: ${err.message}`);
    } finally {
      setIsExecutingRestore(false);
    }
  };

  const handlePullAllLiveFirestore = async () => {
    if (!window.confirm('Pull all live documents from MongoDB Atlas to replace/reconcile local database?')) return;
    try {
      setIsPullingFirestore(true);
      const [mongoProducts, mongoCategories, mongoSales, mongoCustomers, mongoExpenses] = await Promise.all([
        MongoDbService.getProducts().catch(() => []),
        MongoDbService.getCategories().catch(() => []),
        MongoDbService.getSales().catch(() => []),
        MongoDbService.getCustomers().catch(() => []),
        MongoDbService.getExpenses().catch(() => [])
      ]);
      
      // Auto snapshot first
      BackupEncryptionService.createLocalAutoSnapshot('Pre-Cloud-Pull Snapshot', 'Admin');

      if (Array.isArray(mongoProducts)) StorageService.saveProducts(mongoProducts);
      if (Array.isArray(mongoCategories) && mongoCategories.length > 0) StorageService.saveCategories(mongoCategories);
      if (Array.isArray(mongoSales)) StorageService.saveSales(mongoSales);
      if (Array.isArray(mongoCustomers) && mongoCustomers.length > 0) StorageService.saveCustomers(mongoCustomers);
      if (Array.isArray(mongoExpenses)) StorageService.saveExpenses(mongoExpenses);

      onRefreshData();
      refreshBackupMetadata();
      alert(`MongoDB Atlas Recovery Succeeded!\n\nPulled from Cloud:\n- ${mongoProducts.length} Products\n- ${mongoSales.length} Sales\n- ${mongoCustomers.length} Customers\n- ${mongoExpenses.length} Expenses`);
    } catch (err: any) {
      alert(`Failed to pull from MongoDB Atlas: ${err.message}`);
    } finally {
      setIsPullingFirestore(false);
    }
  };

  const handleRestoreLocalSnapshot = async (snap: LocalAutoSnapshot) => {
    if (!window.confirm(`Roll back database to snapshot from ${new Date(snap.timestamp).toLocaleString()}?`)) return;
    try {
      await BackupEncryptionService.restoreFullSystem(snap.payload, 'REPLACE_ALL', 'Admin');
      onRefreshData();
      refreshBackupMetadata();
      alert('System successfully rolled back to selected snapshot!');
    } catch (err: any) {
      alert(`Rollback failed: ${err.message}`);
    }
  };

  // ----------------------------------------------------
  // IMPORT WIZARD HANDLERS
  // ----------------------------------------------------

  const handleImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const securityCheck = SecurityUploadService.validateFileUpload(file);
    if (!securityCheck.isValid) {
      alert(`Upload Blocked: ${securityCheck.errorMessage}`);
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      processImportFile(text, securityCheck.sanitizedFilename || file.name);
    };
    reader.readAsText(file);
  };

  const processImportFile = (text: string, filename: string) => {
    try {
      let rows: any[] = [];
      if (filename.endsWith('.json')) {
        rows = JSON.parse(text);
      } else {
        const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        if (lines.length > 1) {
          const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g, '').trim());
          rows = lines.slice(1).map(line => {
            const values = line.split(',').map(v => v.replace(/^"|"$/g, '').trim());
            const obj: any = {};
            headers.forEach((h, idx) => {
              obj[h.toLowerCase().replace(/\s+/g, '_')] = values[idx] || '';
            });
            return obj;
          });
        }
      }

      setParsedRows(rows);

      if (importType === 'products') {
        const existingBarcodes = new Set(products.map(p => p.barcode));
        let dups = 0;
        let valids = 0;

        rows.forEach(r => {
          if (r.barcode || r.name) {
            valids++;
            if (r.barcode && existingBarcodes.has(r.barcode)) dups++;
          }
        });

        setValidRowsCount(valids);
        setDuplicateCount(dups);
      } else {
        setValidRowsCount(rows.length);
        setDuplicateCount(0);
      }

      setCurrentStep(2);
    } catch {
      alert('Error parsing uploaded file. Please verify CSV or JSON formatting.');
    }
  };

  const handleConfirmImport = () => {
    let imported = 0;
    const logs: string[] = [];

    // Safety Snapshot before bulk import
    BackupEncryptionService.createLocalAutoSnapshot(`Pre-Bulk-Import (${importType})`, 'Admin');

    if (importType === 'products') {
      const currentProducts = StorageService.getProducts();
      const existingBarcodes = new Set(currentProducts.filter(p => p.barcode).map(p => String(p.barcode).trim().toLowerCase()));

      const rowsToProcess: Partial<Product>[] = [];
      parsedRows.forEach((row, idx) => {
        if (!row.name && !row.barcode) return;
        const bKey = row.barcode ? String(row.barcode).trim().toLowerCase() : '';
        if (bKey && existingBarcodes.has(bKey) && duplicateAction === 'skip') {
          logs.push(`Row ${idx + 1}: Skipped existing barcode ${row.barcode}`);
          return;
        }
        rowsToProcess.push(row);
      });

      const res = StorageService.upsertProductsByBarcode(rowsToProcess, 'Import Wizard Products');
      imported = res.updatedCount + res.addedCount;
      const catMsg = res.categoriesAdded ? `, ${res.categoriesAdded} new categories auto-registered.` : '.';
      logs.push(`Import complete: ${res.updatedCount} existing products updated by barcode, ${res.addedCount} new products added${catMsg}`);
    } else if (importType === 'customers') {
      const currentCusts = StorageService.getCustomers();
      const custMap = new Map(currentCusts.map(c => [c.phone, c]));

      parsedRows.forEach((row, idx) => {
        if (!row.name || !row.phone) return;
        const newCust: Customer = {
          id: `cust_${Date.now()}_${idx}`,
          name: String(row.name),
          phone: String(row.phone),
          email: row.email || '',
          points: Number(row.points) || 0,
          total_spent: 0
        };
        custMap.set(row.phone, newCust);
        imported++;
        logs.push(`Row ${idx + 1}: Imported customer ${newCust.name}`);
      });

      StorageService.saveCustomers(Array.from(custMap.values()));
    }

    setImportLog(logs);
    setCurrentStep(3);
    onRefreshData();
    refreshBackupMetadata();
  };

  // ----------------------------------------------------
  // EXPORT CSV HELPERS
  // ----------------------------------------------------

  const handleExportData = (type: 'products' | 'sales' | 'customers' | 'expenses' | 'returns' | 'stock_ledger') => {
    let csvContent = '';
    let filename = '';

    if (type === 'products') {
      const headers = ['ID', 'Barcode', 'Name', 'Category', 'Brand', 'Buy Price', 'Sell Price', 'Stock Qty', 'Min Stock Alert', 'Max Stock Level', 'Image URL', 'Expiry Date', 'Shade Code', 'Volume ML', 'Shelf Location', 'Tax Rate', 'Is Tax Exempt', 'Lead Time Days', 'Last Sold Date'];
      const rows = products.map(p => [
        `"${p.id}"`,
        `"${p.barcode}"`,
        `"${p.name.replace(/"/g, '""')}"`,
        `"${p.category}"`,
        `"${(p.brand || '').replace(/"/g, '""')}"`,
        p.buy_price ?? 0,
        p.sell_price ?? 0,
        p.stock_qty ?? 0,
        p.min_stock_alert ?? 5,
        p.max_stock_level ?? '',
        `"${(p.image_url || '').replace(/"/g, '""')}"`,
        `"${p.expiry_date || ''}"`,
        `"${(p.shade_code || '').replace(/"/g, '""')}"`,
        `"${(p.volume_ml || '').replace(/"/g, '""')}"`,
        `"${(p.shelf_location || '').replace(/"/g, '""')}"`,
        p.tax_rate ?? '',
        p.is_tax_exempt ? 'TRUE' : 'FALSE',
        p.supplier_lead_time_days ?? '',
        `"${p.last_sold_date || ''}"`
      ]);
      csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
      filename = `BloomAndCarry_Products_Full_Export_${new Date().toISOString().slice(0,10)}.csv`;
    } else if (type === 'sales') {
      const sales = StorageService.getSales();
      const headers = ['Invoice No', 'Date', 'Customer', 'Payment Method', 'Cashier', 'Subtotal', 'Discount', 'Tax', 'Total', 'Status'];
      const rows = sales.map(s => [
        s.invoice_no, s.datetime, `"${s.customer_name}"`, s.payment_method, `"${s.cashier_name}"`, s.subtotal, s.discount || 0, s.tax_amount || 0, s.total, s.status
      ]);
      csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
      filename = `BloomAndCarry_Sales_Export_${new Date().toISOString().slice(0,10)}.csv`;
    } else if (type === 'customers') {
      const headers = ['ID', 'Name', 'Phone', 'Email', 'Loyalty Points', 'Total Spent'];
      const rows = customers.map(c => [
        c.id, `"${c.name}"`, c.phone, c.email, c.points, c.total_spent || 0
      ]);
      csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
      filename = `BloomAndCarry_Customers_Export_${new Date().toISOString().slice(0,10)}.csv`;
    } else if (type === 'expenses') {
      const headers = ['ID', 'Date', 'Title', 'Category', 'Amount', 'Payment Method', 'Status'];
      const rows = expenses.map(e => [
        e.id, e.date, `"${e.title}"`, e.category, e.amount, e.payment_method || 'Cash', e.status || 'APPROVED'
      ]);
      csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
      filename = `BloomAndCarry_Expenses_Export_${new Date().toISOString().slice(0,10)}.csv`;
    } else if (type === 'returns') {
      const returns = StorageService.getReturns();
      const headers = ['Return No', 'Date', 'Invoice No', 'Customer', 'Refund Amount', 'Refund Method', 'Cashier'];
      const rows = returns.map(r => [
        r.return_no, r.datetime, r.original_invoice_no, `"${r.customer_name}"`, r.total_refund_amount, r.refund_method, `"${r.cashier_name}"`
      ]);
      csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
      filename = `BloomAndCarry_Returns_Export_${new Date().toISOString().slice(0,10)}.csv`;
    } else if (type === 'stock_ledger') {
      const stockHist = StorageService.getStockHistory();
      const headers = ['Date', 'Product', 'Type', 'Qty Change', 'New Qty', 'Note', 'User'];
      const rows = stockHist.map(sh => [
        sh.date, `"${sh.product_name}"`, sh.type, sh.qty_change, sh.new_qty, `"${sh.note}"`, `"${sh.user_name}"`
      ]);
      csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
      filename = `BloomAndCarry_Stock_Ledger_${new Date().toISOString().slice(0,10)}.csv`;
    }

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportExcelData = (type: 'products' | 'sales' | 'customers' | 'expenses' | 'returns' | 'stock_ledger') => {
    let data: any[] = [];
    let sheetName = 'Data';
    let filename = '';
    const dateStr = new Date().toISOString().slice(0, 10);

    if (type === 'products') {
      sheetName = 'Products Catalog';
      filename = `BloomAndCarry_Products_Full_Export_${dateStr}.xlsx`;
      data = products.map(p => ({
        'Product ID': p.id,
        'Barcode / SKU': String(p.barcode || ''),
        'Product Name': p.name,
        'Category': p.category,
        'Brand': p.brand || '',
        'Buy Price (Cost)': p.buy_price ?? 0,
        'Sell Price (Retail)': p.sell_price ?? 0,
        'Stock Quantity': p.stock_qty ?? 0,
        'Min Stock Alert': p.min_stock_alert ?? 5,
        'Max Stock Level': p.max_stock_level ?? '',
        'Image URL': p.image_url || '',
        'Gallery Images': Array.isArray(p.gallery_images) ? p.gallery_images.join(' ; ') : '',
        'Expiry Date': p.expiry_date || '',
        'Shade / Color Code': p.shade_code || '',
        'Volume / Size': p.volume_ml || '',
        'Shelf Location': p.shelf_location || '',
        'Custom Tax Rate (%)': p.tax_rate ?? '',
        'Is Tax Exempt': p.is_tax_exempt ? 'TRUE' : 'FALSE',
        'Supplier Lead Time (Days)': p.supplier_lead_time_days ?? '',
        'Last Sold Date': p.last_sold_date || ''
      }));
    } else if (type === 'sales') {
      sheetName = 'Sales Invoices';
      filename = `BloomAndCarry_Sales_Export_${dateStr}.xlsx`;
      const sales = StorageService.getSales();
      data = sales.map(s => ({
        'Invoice No': s.invoice_no,
        'Date & Time': s.datetime,
        'Customer Name': s.customer_name,
        'Payment Method': s.payment_method,
        'Cashier': s.cashier_name,
        'Subtotal': s.subtotal,
        'Discount': s.discount || 0,
        'Tax Amount': s.tax_amount || 0,
        'Total Amount': s.total,
        'Status': s.status
      }));
    } else if (type === 'customers') {
      sheetName = 'Customers CRM';
      filename = `BloomAndCarry_Customers_Export_${dateStr}.xlsx`;
      data = customers.map(c => ({
        'Customer ID': c.id,
        'Customer Name': c.name,
        'Phone Number': c.phone,
        'Email Address': c.email || '',
        'Loyalty Points': c.points || 0,
        'Total Spent': c.total_spent || 0
      }));
    } else if (type === 'expenses') {
      sheetName = 'Expenses Log';
      filename = `BloomAndCarry_Expenses_Export_${dateStr}.xlsx`;
      data = expenses.map(e => ({
        'Expense ID': e.id,
        'Date': e.date,
        'Title / Description': e.title,
        'Category': e.category,
        'Amount': e.amount,
        'Payment Method': e.payment_method || 'Cash',
        'Status': e.status || 'APPROVED'
      }));
    } else if (type === 'returns') {
      sheetName = 'Returns & Refunds';
      filename = `BloomAndCarry_Returns_Export_${dateStr}.xlsx`;
      const returns = StorageService.getReturns();
      data = returns.map(r => ({
        'Return No': r.return_no,
        'Date': r.datetime,
        'Original Invoice': r.original_invoice_no,
        'Customer Name': r.customer_name,
        'Refund Amount': r.total_refund_amount,
        'Refund Method': r.refund_method,
        'Cashier': r.cashier_name
      }));
    } else if (type === 'stock_ledger') {
      sheetName = 'Stock Ledger';
      filename = `BloomAndCarry_Stock_Ledger_${dateStr}.xlsx`;
      const stockHist = StorageService.getStockHistory();
      data = stockHist.map(sh => ({
        'Date & Time': sh.date,
        'Product Name': sh.product_name,
        'Adjustment Type': sh.type,
        'Quantity Change': sh.qty_change,
        'New Quantity Balance': sh.new_qty,
        'Reason / Note': sh.note,
        'Authorizing User': sh.user_name
      }));
    }

    if (data.length === 0) {
      alert(`No ${sheetName} records to export.`);
      return;
    }

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    XLSX.writeFile(workbook, filename);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* Top Header Card */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 flex items-center space-x-2">
            <Database className="w-6 h-6 text-[#0f6cbd]" />
            <span>Universal Backup & Disaster Recovery Center</span>
          </h2>
          <p className="text-xs text-slate-500">
            Multi-tier encrypted offline backups, Google Drive sync, Cloud Firestore snapshots, and instant disaster recovery
          </p>
        </div>

        <div className="flex flex-wrap bg-slate-100 p-1 rounded-xl gap-1">
          <button
            onClick={() => setActiveTab('backup_restore')}
            className={`px-3 py-1.5 font-bold text-xs rounded-lg transition flex items-center space-x-1.5 ${activeTab === 'backup_restore' ? 'bg-white text-[#0f6cbd] shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Backup & Restore</span>
          </button>
          <button
            onClick={() => setActiveTab('import')}
            className={`px-3 py-1.5 font-bold text-xs rounded-lg transition flex items-center space-x-1.5 ${activeTab === 'import' ? 'bg-white text-[#0f6cbd] shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Bulk Importer</span>
          </button>
          <button
            onClick={() => setActiveTab('export')}
            className={`px-3 py-1.5 font-bold text-xs rounded-lg transition flex items-center space-x-1.5 ${activeTab === 'export' ? 'bg-white text-[#0f6cbd] shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSVs</span>
          </button>
          <button
            onClick={() => setActiveTab('audit_logs')}
            className={`px-3 py-1.5 font-bold text-xs rounded-lg transition flex items-center space-x-1.5 ${activeTab === 'audit_logs' ? 'bg-white text-[#0f6cbd] shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Audit Trail</span>
          </button>
        </div>
      </div>

      {/* ---------------------------------------------------- */}
      {/* 1. BACKUP & DISASTER RECOVERY TAB */}
      {/* ---------------------------------------------------- */}
      {activeTab === 'backup_restore' && (
        <div className="space-y-6">
          
          {/* Quick Disaster Recovery Banner */}
          <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 p-6 rounded-3xl text-white shadow-md border border-slate-800 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <ShieldCheck className="w-6 h-6 text-emerald-400" />
                  <h3 className="text-lg font-black tracking-tight">Zero-Data-Loss Guarantee</h3>
                  <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border border-emerald-400/30">
                    Live Active Mirroring
                  </span>
                </div>
                <p className="text-xs text-slate-300 max-w-2xl">
                  Your business data (Products, Inventory, Invoices, Customers, Expenses) is simultaneously saved to Local Storage, Google Cloud Firestore, and Google Drive. If your computer crashes or browser data is wiped, restore everything in 1 click.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handlePullAllLiveFirestore}
                  disabled={isPullingFirestore}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl flex items-center space-x-2 transition shadow-md cursor-pointer"
                >
                  <Cloud className={`w-4 h-4 ${isPullingFirestore ? 'animate-spin' : ''}`} />
                  <span>{isPullingFirestore ? 'Recovering...' : 'Restore from Cloud Firestore'}</span>
                </button>
                <button
                  onClick={handleCreateManualLocalSnapshot}
                  className="px-3.5 py-2.5 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-xl flex items-center space-x-2 transition cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4 text-blue-300" />
                  <span>Take Safety Snapshot</span>
                </button>
              </div>
            </div>
          </div>

          {/* Dual Action Grid: Generate Backup vs Restore Backup */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* LEFT: Generate & Export Backups */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-5">
              <div className="border-b pb-3">
                <h3 className="font-extrabold text-slate-900 text-base flex items-center space-x-2">
                  <HardDrive className="w-5 h-5 text-[#0f6cbd]" />
                  <span>Create System Backup</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Generates a complete snapshot of all products, invoices, customers, and settings</p>
              </div>

              {/* Encryption PIN Setup */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                <label className="block text-xs font-bold text-slate-700 flex items-center space-x-1.5">
                  <Key className="w-3.5 h-3.5 text-[#0f6cbd]" />
                  <span>Backup Security PIN (For Encrypted .bcbackup):</span>
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="password"
                    value={backupPin}
                    onChange={(e) => setBackupPin(e.target.value)}
                    placeholder="Enter security PIN"
                    className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold focus:ring-2 focus:ring-[#0f6cbd] focus:outline-hidden"
                  />
                  <span className="text-[11px] text-slate-500 font-medium whitespace-nowrap">Default: 123456</span>
                </div>
                <p className="text-[11px] text-slate-500">This PIN is required when restoring an encrypted backup file on another computer.</p>
              </div>

              {/* Export Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={handleDownloadEncryptedBackup}
                  disabled={isGeneratingBackup}
                  className="p-3.5 bg-gradient-to-r from-[#0f6cbd] to-[#115ea3] hover:from-[#115ea3] hover:to-[#0c4a6e] text-white font-extrabold rounded-xl text-xs flex flex-col items-center justify-center space-y-1 transition shadow-xs cursor-pointer"
                >
                  <Lock className="w-5 h-5 text-blue-200" />
                  <span>Download Encrypted Backup</span>
                  <span className="text-[10px] text-blue-100 font-normal">Protected .bcbackup envelope</span>
                </button>

                <button
                  onClick={handleDownloadPlainJsonBackup}
                  disabled={isGeneratingBackup}
                  className="p-3.5 bg-slate-900 hover:bg-slate-800 text-white font-extrabold rounded-xl text-xs flex flex-col items-center justify-center space-y-1 transition shadow-xs cursor-pointer"
                >
                  <FileText className="w-5 h-5 text-emerald-400" />
                  <span>Download Universal JSON</span>
                  <span className="text-[10px] text-slate-300 font-normal">Standard .json data file</span>
                </button>

                <button
                  onClick={handleSaveToFirestore}
                  disabled={isSyncingFirestore}
                  className="p-3.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 font-extrabold rounded-xl text-xs flex flex-col items-center justify-center space-y-1 transition cursor-pointer"
                >
                  <Cloud className={`w-5 h-5 text-indigo-600 ${isSyncingFirestore ? 'animate-spin' : ''}`} />
                  <span>{isSyncingFirestore ? 'Saving...' : 'Save to Firestore Cloud'}</span>
                  <span className="text-[10px] text-indigo-600 font-normal">Firestore `backups` record</span>
                </button>

                <button
                  onClick={handleSaveToGoogleDrive}
                  disabled={isUploadingToDrive}
                  className="p-3.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 font-extrabold rounded-xl text-xs flex flex-col items-center justify-center space-y-1 transition cursor-pointer"
                >
                  <FolderSync className={`w-5 h-5 text-emerald-600 ${isUploadingToDrive ? 'animate-spin' : ''}`} />
                  <span>{isUploadingToDrive ? 'Uploading...' : 'Save to Google Drive'}</span>
                  <span className="text-[10px] text-emerald-600 font-normal">Direct Drive cloud storage</span>
                </button>
              </div>

              {/* Data Summary Stats */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs">
                <div className="font-bold text-slate-700 mb-2">Current Database Footprint:</div>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 text-center text-[11px]">
                  <div className="bg-white p-2 rounded-lg border border-slate-200">
                    <div className="font-bold text-[#0f6cbd] text-sm">{products.length}</div>
                    <div className="text-slate-500">Products</div>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-slate-200">
                    <div className="font-bold text-emerald-600 text-sm">{StorageService.getSales().length}</div>
                    <div className="text-slate-500">Sales</div>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-slate-200">
                    <div className="font-bold text-purple-600 text-sm">{customers.length}</div>
                    <div className="text-slate-500">Customers</div>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-slate-200">
                    <div className="font-bold text-rose-600 text-sm">{expenses.length}</div>
                    <div className="text-slate-500">Expenses</div>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-slate-200">
                    <div className="font-bold text-amber-600 text-sm">{StorageService.getReturns().length}</div>
                    <div className="text-slate-500">Returns</div>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT: Restore File & Instant Recovery */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-5">
              <div className="border-b pb-3">
                <h3 className="font-extrabold text-slate-900 text-base flex items-center space-x-2">
                  <Upload className="w-5 h-5 text-emerald-600" />
                  <span>Restore from Backup File</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Upload a .bcbackup or .json file to restore all stores and inventory</p>
              </div>

              {/* Upload Dropzone */}
              <div
                onClick={() => restoreFileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-[#0f6cbd] rounded-2xl p-6 text-center cursor-pointer bg-slate-50/60 hover:bg-slate-50 transition space-y-2"
              >
                <FileUp className="w-8 h-8 text-[#0f6cbd] mx-auto" />
                <div>
                  <h4 className="font-bold text-slate-800 text-xs">
                    {restoreFile ? restoreFile.name : 'Click to Upload .bcbackup or .json Backup File'}
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">Supports encrypted and unencrypted full system envelopes</p>
                </div>
                <input
                  type="file"
                  ref={restoreFileInputRef}
                  onChange={handleRestoreFileSelected}
                  accept=".bcbackup, .json"
                  className="hidden"
                />
              </div>

              {/* Error Notice */}
              {restoreError && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl space-y-2 text-xs">
                  <div className="font-bold text-rose-800 flex items-center space-x-1.5">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>Decryption or Validation Issue</span>
                  </div>
                  <p className="text-rose-700 text-[11px]">{restoreError}</p>
                  
                  <div className="flex items-center space-x-2 pt-1">
                    <input
                      type="password"
                      value={restorePinInput}
                      onChange={(e) => setRestorePinInput(e.target.value)}
                      placeholder="Enter Decryption PIN"
                      className="px-2.5 py-1.5 bg-white border border-rose-300 rounded-lg text-xs font-mono font-bold"
                    />
                    <button
                      onClick={handleDecryptRetry}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-xs"
                    >
                      Retry PIN
                    </button>
                  </div>
                </div>
              )}

              {/* Decrypted Snapshot Preview Card */}
              {decryptedPayload && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-emerald-900 flex items-center space-x-1.5 text-sm">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Backup Validated & Ready to Restore</span>
                    </div>
                    <span className="text-[10px] bg-emerald-200 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                      v{decryptedPayload.version || '3.0'}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
                    <div className="bg-white p-2 rounded-lg border border-emerald-200">
                      <div className="font-bold text-emerald-700">{decryptedPayload.products?.length || 0}</div>
                      <div className="text-slate-500">Products</div>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-emerald-200">
                      <div className="font-bold text-emerald-700">{decryptedPayload.sales?.length || 0}</div>
                      <div className="text-slate-500">Sales</div>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-emerald-200">
                      <div className="font-bold text-emerald-700">{decryptedPayload.customers?.length || 0}</div>
                      <div className="text-slate-500">Customers</div>
                    </div>
                  </div>

                  <div className="text-[11px] text-emerald-800">
                    Created At: <strong>{new Date(decryptedPayload.exportedAt).toLocaleString()}</strong>
                  </div>

                  {/* Restore Mode Selection */}
                  <div className="space-y-1.5 pt-1">
                    <label className="block text-xs font-bold text-slate-800">Restore Mode:</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setRestoreMode('REPLACE_ALL')}
                        className={`p-2 rounded-lg border text-left text-[11px] font-bold ${restoreMode === 'REPLACE_ALL' ? 'bg-emerald-600 text-white border-emerald-700' : 'bg-white text-slate-700 border-slate-300'}`}
                      >
                        <div>Replace All</div>
                        <div className="text-[9px] opacity-80 font-normal">Fresh state overwrite</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setRestoreMode('MERGE')}
                        className={`p-2 rounded-lg border text-left text-[11px] font-bold ${restoreMode === 'MERGE' ? 'bg-emerald-600 text-white border-emerald-700' : 'bg-white text-slate-700 border-slate-300'}`}
                      >
                        <div>Merge / Append</div>
                        <div className="text-[9px] opacity-80 font-normal">Combine with current</div>
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={handleExecuteRestore}
                    disabled={isExecutingRestore}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl text-xs flex items-center justify-center space-x-2 transition shadow-md cursor-pointer"
                  >
                    <RotateCcw className={`w-4 h-4 ${isExecutingRestore ? 'animate-spin' : ''}`} />
                    <span>{isExecutingRestore ? 'Restoring All Stores...' : 'Confirm & Restore System Now'}</span>
                  </button>
                </div>
              )}

              {/* Success Message */}
              {restoreSuccessMsg && (
                <div className="p-3 bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-xl text-xs font-bold flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>{restoreSuccessMsg}</span>
                </div>
              )}
            </div>

          </div>

          {/* Cloud Firestore Snapshots List */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-extrabold text-slate-900 text-sm flex items-center space-x-2">
                  <Cloud className="w-4 h-4 text-indigo-600" />
                  <span>Cloud Firestore Snapshot Archives</span>
                </h3>
                <p className="text-xs text-slate-500">Immutable cloud snapshots stored in Firestore database collection "backups"</p>
              </div>
              <button
                onClick={refreshBackupMetadata}
                className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
                title="Refresh Cloud Snapshots"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            {cloudSnapshots.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-xs">
                No Cloud Firestore snapshots found. Click "Save to Firestore Cloud" above to create one.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {cloudSnapshots.map(snap => (
                  <div key={snap.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="space-y-0.5">
                      <div className="font-bold text-slate-800 flex items-center space-x-2">
                        <span>Snapshot {snap.id}</span>
                        <span className="bg-indigo-50 text-indigo-700 font-extrabold px-2 py-0.5 rounded text-[10px]">
                          {snap.products_count} Prods | {snap.sales_count} Sales | {snap.customers_count} Cust
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Timestamp: {new Date(snap.timestamp).toLocaleString()} | Created by: {snap.created_by}
                      </div>
                    </div>

                    <button
                      onClick={() => handleRestoreFromCloudFirestore(snap.id)}
                      className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 font-bold rounded-lg text-xs flex items-center space-x-1.5 transition self-start sm:self-auto cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Restore This Snapshot</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Rolling Local Auto-Snapshots */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-extrabold text-slate-900 text-sm flex items-center space-x-2">
                  <History className="w-4 h-4 text-amber-600" />
                  <span>Rolling Local Safety Snapshots (Instant Rollback)</span>
                </h3>
                <p className="text-xs text-slate-500">Automatic safety points taken before any bulk imports, restores, or purges</p>
              </div>
            </div>

            {localSnapshots.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-xs">
                No local snapshots created yet.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {localSnapshots.map(snap => (
                  <div key={snap.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="space-y-0.5">
                      <div className="font-bold text-slate-800 flex items-center space-x-2">
                        <span>{snap.triggerReason}</span>
                        <span className="bg-amber-50 text-amber-800 font-bold px-2 py-0.5 rounded text-[10px]">
                          {snap.summary.products} Products | {snap.summary.sales} Sales
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {new Date(snap.timestamp).toLocaleString()} by {snap.user}
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleRestoreLocalSnapshot(snap)}
                        className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold rounded-lg text-xs flex items-center space-x-1.5 transition cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
                        <span>Rollback</span>
                      </button>
                      <button
                        onClick={() => {
                          BackupEncryptionService.deleteLocalSnapshot(snap.id);
                          refreshBackupMetadata();
                        }}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                        title="Delete snapshot"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* 2. BULK IMPORTER TAB */}
      {/* ---------------------------------------------------- */}
      {activeTab === 'import' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-6">
          
          <div className="grid grid-cols-3 gap-2 border-b pb-4 text-center">
            <div className={`p-2 rounded-xl text-xs font-bold ${currentStep === 1 ? 'bg-[#0f6cbd] text-white' : 'bg-slate-100 text-slate-600'}`}>
              1. Select Data & File
            </div>
            <div className={`p-2 rounded-xl text-xs font-bold ${currentStep === 2 ? 'bg-[#0f6cbd] text-white' : 'bg-slate-100 text-slate-600'}`}>
              2. Validate & Configure
            </div>
            <div className={`p-2 rounded-xl text-xs font-bold ${currentStep === 3 ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
              3. Execution Summary
            </div>
          </div>

          {currentStep === 1 && (
            <div className="space-y-4 max-w-xl mx-auto">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Data Entity Type *</label>
                <select
                  value={importType}
                  onChange={(e) => setImportType(e.target.value as ImportType)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-xs"
                >
                  <option value="products">Products & Inventory Catalog</option>
                  <option value="customers">Customers CRM Contacts</option>
                </select>
              </div>

              <div
                onClick={() => importFileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-[#0f6cbd] rounded-2xl p-8 text-center cursor-pointer bg-slate-50/50 hover:bg-slate-50 transition space-y-3"
              >
                <FileUp className="w-10 h-10 text-[#0f6cbd] mx-auto" />
                <div>
                  <h4 className="font-bold text-slate-800 text-sm">Click to Select CSV or JSON File</h4>
                  <p className="text-xs text-slate-500 mt-1">Supports UTF-8 CSV and JSON formatting</p>
                </div>
                <input
                  type="file"
                  ref={importFileInputRef}
                  onChange={handleImportFileChange}
                  accept=".csv, .json"
                  className="hidden"
                />
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-5 max-w-xl mx-auto text-xs">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl space-y-2">
                <div className="font-bold text-blue-900 text-sm flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-blue-600" />
                  <span>File Parsed Successfully</span>
                </div>
                <div className="text-slate-700">
                  Total Rows: <strong>{parsedRows.length}</strong> | Valid Records: <strong>{validRowsCount}</strong> | Duplicate Barcodes: <strong className="text-rose-600">{duplicateCount}</strong>
                </div>
              </div>

              {duplicateCount > 0 && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Duplicate Barcode Action</label>
                  <select
                    value={duplicateAction}
                    onChange={(e) => setDuplicateAction(e.target.value as any)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-xs"
                  >
                    <option value="skip">Skip Duplicate Rows (Preserve Existing Stock)</option>
                    <option value="overwrite">Overwrite / Update Existing Product Details</option>
                  </select>
                </div>
              )}

              <div className="flex space-x-3 pt-2">
                <button
                  onClick={() => setCurrentStep(1)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
                >
                  Back
                </button>
                <button
                  onClick={handleConfirmImport}
                  className="flex-1 py-2.5 bg-[#0f6cbd] hover:bg-[#115ea3] text-white font-bold rounded-xl text-xs shadow-md cursor-pointer"
                >
                  Run Import Operation
                </button>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-4 max-w-xl mx-auto text-xs">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1">
                <h4 className="font-bold text-emerald-900 text-sm flex items-center space-x-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <span>Bulk Import Execution Completed</span>
                </h4>
                <p className="text-slate-600">All valid entries were synchronized into local storage.</p>
              </div>

              <div className="bg-slate-900 text-emerald-400 p-4 rounded-xl font-mono max-h-48 overflow-y-auto space-y-1 text-[11px]">
                {importLog.map((line, idx) => (
                  <div key={idx}>{line}</div>
                ))}
              </div>

              <button
                onClick={() => setCurrentStep(1)}
                className="w-full py-2.5 bg-[#0f6cbd] text-white font-bold rounded-xl text-xs cursor-pointer"
              >
                Start Another Import
              </button>
            </div>
          )}

        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* 3. EXPORT CSVS TAB */}
      {/* ---------------------------------------------------- */}
      {activeTab === 'export' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          
          {/* Products */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#0f6cbd] flex items-center justify-center font-bold">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-sm">Products Catalog</h4>
                <p className="text-xs text-slate-500">{products.length} active SKUs (Full URLs & Details)</p>
              </div>
            </div>
            <div className="flex flex-col gap-2 pt-1">
              <button
                onClick={() => handleExportExcelData('products')}
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center justify-center space-x-2 transition cursor-pointer shadow-xs"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Download Products Excel (.xlsx)</span>
              </button>
              <button
                onClick={() => handleExportData('products')}
                className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center justify-center space-x-2 transition cursor-pointer"
              >
                <FileDown className="w-4 h-4 text-slate-600" />
                <span>Download Products CSV</span>
              </button>
            </div>
          </div>

          {/* Sales */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-sm">Sales Invoices</h4>
                <p className="text-xs text-slate-500">{StorageService.getSales().length} sales records</p>
              </div>
            </div>
            <div className="flex flex-col gap-2 pt-1">
              <button
                onClick={() => handleExportExcelData('sales')}
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center justify-center space-x-2 transition cursor-pointer shadow-xs"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Download Sales Excel (.xlsx)</span>
              </button>
              <button
                onClick={() => handleExportData('sales')}
                className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center justify-center space-x-2 transition cursor-pointer"
              >
                <FileDown className="w-4 h-4 text-slate-600" />
                <span>Download Sales CSV</span>
              </button>
            </div>
          </div>

          {/* Customers */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-sm">Customers CRM</h4>
                <p className="text-xs text-slate-500">{customers.length} customer profiles</p>
              </div>
            </div>
            <div className="flex flex-col gap-2 pt-1">
              <button
                onClick={() => handleExportExcelData('customers')}
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center justify-center space-x-2 transition cursor-pointer shadow-xs"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Download Customers Excel (.xlsx)</span>
              </button>
              <button
                onClick={() => handleExportData('customers')}
                className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center justify-center space-x-2 transition cursor-pointer"
              >
                <FileDown className="w-4 h-4 text-slate-600" />
                <span>Download Customers CSV</span>
              </button>
            </div>
          </div>

          {/* Expenses */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-sm">Expenses Log</h4>
                <p className="text-xs text-slate-500">{expenses.length} expense entries</p>
              </div>
            </div>
            <div className="flex flex-col gap-2 pt-1">
              <button
                onClick={() => handleExportExcelData('expenses')}
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center justify-center space-x-2 transition cursor-pointer shadow-xs"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Download Expenses Excel (.xlsx)</span>
              </button>
              <button
                onClick={() => handleExportData('expenses')}
                className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center justify-center space-x-2 transition cursor-pointer"
              >
                <FileDown className="w-4 h-4 text-slate-600" />
                <span>Download Expenses CSV</span>
              </button>
            </div>
          </div>

          {/* Returns */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-sm">Returns & Refunds</h4>
                <p className="text-xs text-slate-500">{StorageService.getReturns().length} return slips</p>
              </div>
            </div>
            <div className="flex flex-col gap-2 pt-1">
              <button
                onClick={() => handleExportExcelData('returns')}
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center justify-center space-x-2 transition cursor-pointer shadow-xs"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Download Returns Excel (.xlsx)</span>
              </button>
              <button
                onClick={() => handleExportData('returns')}
                className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center justify-center space-x-2 transition cursor-pointer"
              >
                <FileDown className="w-4 h-4 text-slate-600" />
                <span>Download Returns CSV</span>
              </button>
            </div>
          </div>

          {/* Stock Ledger */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center font-bold">
                <HardDrive className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-sm">Stock Ledger</h4>
                <p className="text-xs text-slate-500">{StorageService.getStockHistory().length} audit movements</p>
              </div>
            </div>
            <div className="flex flex-col gap-2 pt-1">
              <button
                onClick={() => handleExportExcelData('stock_ledger')}
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center justify-center space-x-2 transition cursor-pointer shadow-xs"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Download Stock Ledger Excel (.xlsx)</span>
              </button>
              <button
                onClick={() => handleExportData('stock_ledger')}
                className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center justify-center space-x-2 transition cursor-pointer"
              >
                <FileDown className="w-4 h-4 text-slate-600" />
                <span>Download Stock Ledger CSV</span>
              </button>
            </div>
          </div>

        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* 4. AUDIT LOGS TAB */}
      {/* ---------------------------------------------------- */}
      {activeTab === 'audit_logs' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <div>
              <h3 className="font-extrabold text-slate-900 text-sm">Backup, Export & Restore Audit Trail</h3>
              <p className="text-xs text-slate-500">Full tamper-evident historical log of all backup, export, and disaster recovery actions</p>
            </div>
          </div>

          {auditLogs.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              No audit logs recorded yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 border-b">
                    <th className="p-3 font-extrabold">Timestamp</th>
                    <th className="p-3 font-extrabold">Action</th>
                    <th className="p-3 font-extrabold">Target / File</th>
                    <th className="p-3 font-extrabold">User</th>
                    <th className="p-3 font-extrabold">Status</th>
                    <th className="p-3 font-extrabold">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {auditLogs.map(log => (
                    <tr key={log.id} className="hover:bg-slate-50/50">
                      <td className="p-3 text-slate-500 font-mono text-[11px]">{new Date(log.timestamp).toLocaleString()}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded font-extrabold text-[10px] ${
                          log.action === 'RESTORE_DECRYPTED' ? 'bg-emerald-100 text-emerald-800' :
                          log.action === 'EXPORT_ENCRYPTED' ? 'bg-blue-100 text-blue-800' :
                          log.action === 'FIRESTORE_SYNC' ? 'bg-indigo-100 text-indigo-800' :
                          'bg-purple-100 text-purple-800'
                        }`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-[11px] text-slate-700">{log.filename}</td>
                      <td className="p-3 text-slate-700 font-bold">{log.user}</td>
                      <td className="p-3">
                        <span className={`font-bold ${log.status === 'SUCCESS' ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {log.status}
                        </span>
                      </td>
                      <td className="p-3 text-slate-500 text-[11px]">{log.details || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

    </div>
  );
};

export const GOOGLE_APPS_SCRIPT_CODE = `/**
 * ============================================================================
 * BLOOM & CARRY POS - GOOGLE APPS SCRIPT BACKEND & AUTOMATION ENGINE
 * ============================================================================
 * Features:
 * 1. Real-Time Two-Way Sync with Google Sheets (Products, Sales, Customers, Expenses, Returns, Daily Ledger)
 * 2. Automated Daily Closing Ledger & Transaction Logging
 * 3. Automated Monthly Comprehensive Business Report Emailed to bloomandcarry.pk@gmail.com
 * 4. Google Drive PDF Invoices & Automated Cloud Backups
 *
 * Deployment Instructions:
 * 1. Open Google Sheets -> Extensions -> Apps Script
 * 2. Delete all existing code, paste this entire Code.gs file, and click Save (Ctrl + S)
 * 3. Click "Deploy" -> "New deployment"
 * 4. Select Type: "Web App"
 * 5. Description: "Bloom & Carry POS API & Automation Engine v3.5"
 * 6. Execute as: "Me" (your Google account)
 * 7. Who has access: "Anyone" (Required for POS API requests)
 * 8. Click "Deploy", Authorize permissions (Click Advanced -> Go to POS Backend), copy Web App URL
 * 9. Paste the Web App URL into POS System Settings -> Google Apps Script URL
 * 10. Run "setupAutomatedTriggers()" once in Apps Script editor to activate automatic daily & monthly jobs!
 * ============================================================================
 */

const DEFAULT_REPORT_EMAIL = 'bloomandcarry.pk@gmail.com';

const SHEET_NAMES = {
  PRODUCTS: 'Products',
  SALES: 'Sales',
  CUSTOMERS: 'Customers',
  EXPENSES: 'Expenses',
  RETURNS: 'Returns',
  SUPPLIERS: 'Suppliers',
  DAILY_LEDGER: 'Daily_Ledger',
  SETTINGS: 'Settings'
};

/**
 * Main GET Endpoint - Handles reads and queries
 */
function doGet(e) {
  try {
    initDatabase();
    const action = (e && e.parameter && e.parameter.action) || 'getAllData';
    let responseData = {};
    
    switch (action) {
      case 'getProducts':
        responseData = { status: 'success', data: getSheetData(SHEET_NAMES.PRODUCTS) };
        break;
      case 'getSales':
        responseData = { status: 'success', data: getSheetData(SHEET_NAMES.SALES) };
        break;
      case 'getCustomers':
        responseData = { status: 'success', data: getSheetData(SHEET_NAMES.CUSTOMERS) };
        break;
      case 'getExpenses':
        responseData = { status: 'success', data: getSheetData(SHEET_NAMES.EXPENSES) };
        break;
      case 'getReturns':
        responseData = { status: 'success', data: getSheetData(SHEET_NAMES.RETURNS) };
        break;
      case 'getDailyLedger':
        responseData = { status: 'success', data: getSheetData(SHEET_NAMES.DAILY_LEDGER) };
        break;
      case 'getSettings':
        responseData = { status: 'success', data: getSettingsData() };
        break;
      case 'getAllData':
        responseData = {
          status: 'success',
          products: getSheetData(SHEET_NAMES.PRODUCTS),
          sales: getSheetData(SHEET_NAMES.SALES),
          customers: getSheetData(SHEET_NAMES.CUSTOMERS),
          expenses: getSheetData(SHEET_NAMES.EXPENSES),
          returns: getSheetData(SHEET_NAMES.RETURNS),
          daily_ledger: getSheetData(SHEET_NAMES.DAILY_LEDGER),
          settings: getSettingsData()
        };
        break;
      case 'sendMonthlyReport':
        const emailTo = (e.parameter && e.parameter.email) || DEFAULT_REPORT_EMAIL;
        const resReport = sendMonthlyComprehensiveReport(emailTo);
        responseData = { status: 'success', message: 'Monthly report dispatched to ' + emailTo, details: resReport };
        break;
      case 'init':
        responseData = { status: 'success', message: 'Bloom & Carry POS Database initialized successfully with all tabs!' };
        break;
      default:
        responseData = { status: 'error', message: 'Invalid action parameter: ' + action };
    }
    
    return createJsonResponse(responseData);
  } catch (error) {
    return createJsonResponse({ status: 'error', message: error.toString() });
  }
}

/**
 * Main POST Endpoint - Handles writes, checkouts, and email triggers
 */
function doPost(e) {
  try {
    initDatabase();
    
    let contents;
    if (e.postData && e.postData.contents) {
      contents = JSON.parse(e.postData.contents);
    } else {
      contents = e.parameter;
    }
    
    const action = contents.action;
    let responseData = {};
    
    switch (action) {
      case 'saveSale':
        responseData = processSale(contents.data);
        break;
      case 'saveProduct':
        responseData = saveRow(SHEET_NAMES.PRODUCTS, contents.data);
        break;
      case 'deleteProduct':
        responseData = deleteRowById(SHEET_NAMES.PRODUCTS, contents.id);
        break;
      case 'saveCustomer':
        responseData = saveRow(SHEET_NAMES.CUSTOMERS, contents.data);
        break;
      case 'deleteCustomer':
        responseData = deleteRowById(SHEET_NAMES.CUSTOMERS, contents.id);
        break;
      case 'saveExpense':
        responseData = saveRow(SHEET_NAMES.EXPENSES, contents.data);
        break;
      case 'deleteExpense':
        responseData = deleteRowById(SHEET_NAMES.EXPENSES, contents.id);
        break;
      case 'saveReturn':
        responseData = saveRow(SHEET_NAMES.RETURNS, contents.data);
        break;
      case 'deleteReturn':
        responseData = deleteRowById(SHEET_NAMES.RETURNS, contents.id);
        break;
      case 'saveDailySummary':
        responseData = saveDailyLedgerRow(contents.data);
        break;
      case 'syncAllData':
        responseData = bulkSyncAllData(contents.data);
        break;
      case 'sendMonthlyReport':
        const emailRecipient = contents.email || DEFAULT_REPORT_EMAIL;
        const resultEmail = sendMonthlyComprehensiveReport(emailRecipient, contents.month);
        responseData = { status: 'success', message: 'Monthly report successfully emailed to ' + emailRecipient, result: resultEmail };
        break;
      case 'saveSettings':
        responseData = saveSettingsData(contents.data);
        break;
      case 'uploadImage':
        responseData = uploadImageToDrive(contents.base64Data, contents.fileName);
        break;
      default:
        responseData = { status: 'error', message: 'Unknown POST action: ' + action };
    }
    
    return createJsonResponse(responseData);
  } catch (error) {
    return createJsonResponse({ status: 'error', message: error.toString() });
  }
}

/**
 * Produces CORS compliant JSON response
 */
function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Initializes all required database tabs and formatting
 */
function initDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  const headersMap = {
    Products: ['id', 'barcode', 'name', 'category', 'buy_price', 'sell_price', 'stock_qty', 'min_stock_alert', 'image_url', 'updated_at'],
    Sales: ['id', 'invoice_no', 'datetime', 'customer_name', 'subtotal', 'discount', 'tax_amount', 'total', 'paid', 'payment_method', 'cashier_name', 'items_json'],
    Customers: ['id', 'name', 'phone', 'email', 'points', 'total_spent', 'last_visit'],
    Expenses: ['id', 'date', 'category', 'title', 'amount', 'recorded_by'],
    Returns: ['id', 'return_no', 'original_invoice_no', 'datetime', 'customer_name', 'refund_amount', 'refund_method', 'reason', 'items_json'],
    Daily_Ledger: ['date', 'total_invoices', 'gross_sales', 'total_discounts', 'net_sales', 'total_expenses', 'net_profit', 'cash_collected', 'card_bank_collected', 'logged_at'],
    Settings: ['shop_name', 'tagline', 'phone', 'email', 'report_email', 'currency_symbol', 'tax_rate', 'printer_name']
  };
  
  for (let sheetName in headersMap) {
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      sheet.appendRow(headersMap[sheetName]);
      sheet.getRange(1, 1, 1, headersMap[sheetName].length)
        .setFontWeight('bold')
        .setBackground('#0b5fa5')
        .setFontColor('#ffffff');
      sheet.setFrozenRows(1);
    }
  }
}

/**
 * Reads all rows from a sheet
 */
function getSheetData(sheetName) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) return [];
  
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  
  const headers = data[0];
  const result = [];
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const obj = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = row[j];
    }
    result.push(obj);
  }
  return result;
}

/**
 * Reads settings data
 */
function getSettingsData() {
  const rows = getSheetData(SHEET_NAMES.SETTINGS);
  if (rows.length > 0) {
    return rows[0];
  }
  return {
    shop_name: 'Bloom & Carry',
    tagline: 'Premium Cosmetics & Beauty Store',
    email: DEFAULT_REPORT_EMAIL,
    report_email: DEFAULT_REPORT_EMAIL,
    currency_symbol: 'Rs',
    tax_rate: 0,
    printer_name: 'Thermal Printer 80mm'
  };
}

/**
 * Saves settings data
 */
function saveSettingsData(settingsObj) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.SETTINGS);
  sheet.clearContents();
  sheet.appendRow(['shop_name', 'tagline', 'phone', 'email', 'report_email', 'currency_symbol', 'tax_rate', 'printer_name']);
  sheet.appendRow([
    settingsObj.shop_name || 'Bloom & Carry',
    settingsObj.tagline || 'Premium Cosmetics & Beauty Store',
    settingsObj.phone || '',
    settingsObj.email || DEFAULT_REPORT_EMAIL,
    settingsObj.report_email || DEFAULT_REPORT_EMAIL,
    settingsObj.currency_symbol || 'Rs',
    settingsObj.tax_rate || 0,
    settingsObj.printer_name || 'Thermal Printer 80mm'
  ]);
  return { status: 'success', message: 'Settings saved successfully' };
}

/**
 * Generic Upsert Row by ID
 */
function saveRow(sheetName, rowData) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) return { status: 'error', message: 'Sheet not found: ' + sheetName };
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idIndex = headers.indexOf('id');
  let existingRowIndex = -1;
  
  if (rowData.id) {
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][idIndex]) === String(rowData.id)) {
        existingRowIndex = i + 1;
        break;
      }
    }
  } else {
    rowData.id = 'ID_' + new Date().getTime();
  }
  
  const newRowValues = headers.map(header => {
    return rowData[header] !== undefined ? rowData[header] : '';
  });
  
  if (existingRowIndex > 0) {
    sheet.getRange(existingRowIndex, 1, 1, newRowValues.length).setValues([newRowValues]);
  } else {
    sheet.appendRow(newRowValues);
  }
  
  return { status: 'success', id: rowData.id, message: 'Saved to ' + sheetName };
}

/**
 * Delete row by ID
 */
function deleteRowById(sheetName, id) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) return { status: 'error', message: 'Sheet not found' };
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idIndex = headers.indexOf('id');
  
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idIndex]) === String(id)) {
      sheet.deleteRow(i + 1);
      return { status: 'success', message: 'Row deleted from ' + sheetName };
    }
  }
  return { status: 'error', message: 'ID not found: ' + id };
}

/**
 * Save Daily Ledger Row (Daily Closing Summary)
 */
function saveDailyLedgerRow(summaryData) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.DAILY_LEDGER);
  const dateStr = summaryData.date || new Date().toISOString().split('T')[0];
  
  const data = sheet.getDataRange().getValues();
  let existingRow = -1;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(dateStr)) {
      existingRow = i + 1;
      break;
    }
  }
  
  const rowValues = [
    dateStr,
    Number(summaryData.total_invoices) || 0,
    Number(summaryData.gross_sales) || 0,
    Number(summaryData.total_discounts) || 0,
    Number(summaryData.net_sales) || 0,
    Number(summaryData.total_expenses) || 0,
    Number(summaryData.net_profit) || 0,
    Number(summaryData.cash_collected) || 0,
    Number(summaryData.card_bank_collected) || 0,
    new Date().toISOString()
  ];
  
  if (existingRow > 0) {
    sheet.getRange(existingRow, 1, 1, rowValues.length).setValues([rowValues]);
  } else {
    sheet.appendRow(rowValues);
  }
  
  return { status: 'success', message: 'Daily ledger record updated for ' + dateStr };
}

/**
 * Bulk Sync All Data Payload from POS
 */
function bulkSyncAllData(payload) {
  if (payload.products && Array.isArray(payload.products)) {
    payload.products.forEach(p => saveRow(SHEET_NAMES.PRODUCTS, p));
  }
  if (payload.sales && Array.isArray(payload.sales)) {
    payload.sales.forEach(s => saveRow(SHEET_NAMES.SALES, { ...s, items_json: JSON.stringify(s.items || []) }));
  }
  if (payload.customers && Array.isArray(payload.customers)) {
    payload.customers.forEach(c => saveRow(SHEET_NAMES.CUSTOMERS, c));
  }
  if (payload.expenses && Array.isArray(payload.expenses)) {
    payload.expenses.forEach(e => saveRow(SHEET_NAMES.EXPENSES, e));
  }
  if (payload.returns && Array.isArray(payload.returns)) {
    payload.returns.forEach(r => saveRow(SHEET_NAMES.RETURNS, { ...r, items_json: JSON.stringify(r.items || []) }));
  }
  return { status: 'success', message: 'Full store sync completed in Google Sheets.' };
}

/**
 * Process POS Sale: logs sale, decrements stock, updates customer points, generates PDF in Drive
 */
function processSale(saleData) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. Insert into Sales Sheet
  const salesSheet = ss.getSheetByName(SHEET_NAMES.SALES);
  salesSheet.appendRow([
    saleData.id || ('SALE_' + new Date().getTime()),
    saleData.invoice_no,
    saleData.datetime || new Date().toISOString(),
    saleData.customer_name || 'Walk-in Customer',
    Number(saleData.subtotal) || Number(saleData.total) || 0,
    Number(saleData.discount) || 0,
    Number(saleData.tax_amount) || 0,
    Number(saleData.total) || 0,
    Number(saleData.paid) || Number(saleData.total) || 0,
    saleData.payment_method || 'Cash',
    saleData.cashier_name || 'Admin',
    typeof saleData.items_json === 'string' ? saleData.items_json : JSON.stringify(saleData.items || [])
  ]);
  
  // 2. Deduct Product Stock Qty
  const productsSheet = ss.getSheetByName(SHEET_NAMES.PRODUCTS);
  if (productsSheet && saleData.items && saleData.items.length > 0) {
    const pData = productsSheet.getDataRange().getValues();
    const pHeaders = pData[0];
    const idIdx = pHeaders.indexOf('id');
    const barcodeIdx = pHeaders.indexOf('barcode');
    const stockIdx = pHeaders.indexOf('stock_qty');
    
    if (stockIdx !== -1) {
      saleData.items.forEach(item => {
        for (let i = 1; i < pData.length; i++) {
          const matchesId = idIdx !== -1 && String(pData[i][idIdx]) === String(item.product_id);
          const matchesBarcode = barcodeIdx !== -1 && String(pData[i][barcodeIdx]) === String(item.barcode);
          
          if (matchesId || matchesBarcode) {
            const currentStock = Number(pData[i][stockIdx]) || 0;
            const newStock = Math.max(0, currentStock - Number(item.quantity));
            productsSheet.getRange(i + 1, stockIdx + 1).setValue(newStock);
            break;
          }
        }
      });
    }
  }
  
  // 3. Update Customer Points
  if (saleData.customer_name && saleData.customer_name !== 'Walk-in Customer') {
    const custSheet = ss.getSheetByName(SHEET_NAMES.CUSTOMERS);
    if (custSheet) {
      const cData = custSheet.getDataRange().getValues();
      const cHeaders = cData[0];
      const nameIdx = cHeaders.indexOf('name');
      const ptsIdx = cHeaders.indexOf('points');
      const spentIdx = cHeaders.indexOf('total_spent');
      
      const earnedPoints = Math.floor(saleData.total / 100);
      
      for (let i = 1; i < cData.length; i++) {
        if (String(cData[i][nameIdx]).toLowerCase() === String(saleData.customer_name).toLowerCase()) {
          if (ptsIdx !== -1) {
            const currentPts = Number(cData[i][ptsIdx]) || 0;
            custSheet.getRange(i + 1, ptsIdx + 1).setValue(currentPts + earnedPoints);
          }
          if (spentIdx !== -1) {
            const currentSpent = Number(cData[i][spentIdx]) || 0;
            custSheet.getRange(i + 1, spentIdx + 1).setValue(currentSpent + Number(saleData.total));
          }
          break;
        }
      }
    }
  }
  
  // 4. Generate PDF Invoice to Google Drive
  let pdfUrl = '';
  try {
    pdfUrl = createAndSavePdfInvoice(saleData);
  } catch (err) {
    Logger.log('PDF Generation notice: ' + err.toString());
  }
  
  return {
    status: 'success',
    invoice_no: saleData.invoice_no,
    pdf_url: pdfUrl,
    message: 'Sale saved in Google Sheets and stock updated.'
  };
}

/**
 * Creates Google Drive PDF invoice
 */
function createAndSavePdfInvoice(saleData) {
  let folder;
  const folders = DriveApp.getFoldersByName('BloomCarry_Invoices');
  if (folders.hasNext()) {
    folder = folders.next();
  } else {
    folder = DriveApp.createFolder('BloomCarry_Invoices');
  }
  
  const settings = getSettingsData();
  const shopName = settings.shop_name || 'Bloom & Carry';
  
  let html = '<html><head><style>';
  html += 'body { font-family: Arial, sans-serif; padding: 24px; font-size: 13px; color: #1e293b; }';
  html += '.header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #0b5fa5; padding-bottom: 15px; }';
  html += '.title { font-size: 22px; font-weight: bold; color: #0b5fa5; margin-bottom: 4px; }';
  html += 'table { width: 100%; border-collapse: collapse; margin-top: 15px; }';
  html += 'th, td { border-bottom: 1px solid #e2e8f0; padding: 8px 6px; text-align: left; }';
  html += 'th { background-color: #f1f5f9; color: #475569; font-size: 12px; }';
  html += '.total-row { font-weight: bold; font-size: 15px; color: #0b5fa5; }';
  html += '</style></head><body>';
  
  html += '<div class="header">';
  html += '<div class="title">' + shopName + '</div>';
  html += '<p style="margin: 4px 0; color: #64748b;">' + (settings.tagline || 'Premium Cosmetics & Beauty Store') + '</p>';
  html += '<p style="margin: 4px 0;"><b>Invoice #: ' + saleData.invoice_no + '</b> | Date: ' + (saleData.datetime || new Date().toLocaleString()) + '</p>';
  html += '<p style="margin: 4px 0;">Customer: ' + (saleData.customer_name || 'Walk-in Customer') + ' | Payment: ' + (saleData.payment_method || 'Cash') + '</p>';
  html += '</div>';
  
  html += '<table>';
  html += '<thead><tr><th>Item</th><th>Qty</th><th style="text-align:right;">Price</th><th style="text-align:right;">Total</th></tr></thead><tbody>';
  
  const items = saleData.items || [];
  items.forEach(function(item) {
    html += '<tr>';
    html += '<td>' + item.name + '</td>';
    html += '<td>' + item.quantity + '</td>';
    html += '<td style="text-align:right;">Rs ' + Number(item.sell_price).toFixed(2) + '</td>';
    html += '<td style="text-align:right;">Rs ' + Number(item.total).toFixed(2) + '</td>';
    html += '</tr>';
  });
  
  html += '</tbody></table>';
  
  html += '<div style="margin-top:20px; text-align:right;">';
  html += '<p>Subtotal: Rs ' + Number(saleData.subtotal || saleData.total).toFixed(2) + '</p>';
  if (saleData.discount) html += '<p style="color:#059669;">Discount: -Rs ' + Number(saleData.discount).toFixed(2) + '</p>';
  if (saleData.tax_amount) html += '<p>Tax: Rs ' + Number(saleData.tax_amount).toFixed(2) + '</p>';
  html += '<p class="total-row">Grand Total: Rs ' + Number(saleData.total).toFixed(2) + '</p>';
  html += '</div>';
  
  html += '<div style="margin-top:30px; text-align:center; color:#94a3b8; font-size:11px;">';
  html += 'Thank you for shopping at Bloom & Carry! Auto-generated by POS Cloud System.';
  html += '</div></body></html>';
  
  const blob = Utilities.newBlob(html, 'text/html', saleData.invoice_no + '.html');
  const pdfFile = folder.createFile(blob.getAs('application/pdf')).setName(saleData.invoice_no + '.pdf');
  pdfFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return pdfFile.getUrl();
}

/**
 * Upload Image to Drive
 */
function uploadImageToDrive(base64Data, fileName) {
  try {
    let folder;
    const folders = DriveApp.getFoldersByName('BloomCarry_Images');
    if (folders.hasNext()) {
      folder = folders.next();
    } else {
      folder = DriveApp.createFolder('BloomCarry_Images');
    }
    
    const splitData = base64Data.split(',');
    const contentType = splitData[0].match(/:(.*?);/)[1];
    const bytes = Utilities.base64Decode(splitData[1]);
    const blob = Utilities.newBlob(bytes, contentType, fileName);
    
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    const fileId = file.getId();
    const publicUrl = 'https://drive.google.com/uc?export=view&id=' + fileId;
    return { status: 'success', image_url: publicUrl, file_id: fileId };
  } catch (err) {
    return { status: 'error', message: err.toString() };
  }
}

/**
 * ============================================================================
 * AUTOMATED MONTHLY COMPREHENSIVE BUSINESS REPORT ENGINE
 * Emails full analytics, P&L, sales, expenses, top products & CSV attachment
 * to bloomandcarry.pk@gmail.com
 * ============================================================================
 */
function sendMonthlyComprehensiveReport(targetEmail, targetMonthStr) {
  const emailRecipient = targetEmail || DEFAULT_REPORT_EMAIL;
  const settings = getSettingsData();
  const shopName = settings.shop_name || 'Bloom & Carry';
  
  // Determine Month string (e.g. "2026-08")
  let targetMonth = targetMonthStr;
  if (!targetMonth) {
    const now = new Date();
    // Default to current or previous month
    targetMonth = now.toISOString().slice(0, 7);
  }
  
  const sales = getSheetData(SHEET_NAMES.SALES);
  const expenses = getSheetData(SHEET_NAMES.EXPENSES);
  const products = getSheetData(SHEET_NAMES.PRODUCTS);
  const returns = getSheetData(SHEET_NAMES.RETURNS);
  
  // Filter sales for target month
  const monthSales = sales.filter(s => {
    const d = String(s.datetime || '');
    return d.startsWith(targetMonth);
  });
  
  // Filter expenses for target month
  const monthExpenses = expenses.filter(e => {
    const d = String(e.date || '');
    return d.startsWith(targetMonth);
  });
  
  // Filter returns for target month
  const monthReturns = returns.filter(r => {
    const d = String(r.datetime || '');
    return d.startsWith(targetMonth);
  });
  
  // Financial Computations
  let grossSales = 0;
  let totalDiscounts = 0;
  let totalTax = 0;
  let netSales = 0;
  let cashSales = 0;
  let cardBankSales = 0;
  const productSalesMap = {};
  
  monthSales.forEach(s => {
    const total = Number(s.total) || 0;
    const subtotal = Number(s.subtotal) || total;
    const discount = Number(s.discount) || 0;
    const tax = Number(s.tax_amount) || 0;
    
    grossSales += subtotal;
    totalDiscounts += discount;
    totalTax += tax;
    netSales += total;
    
    const method = String(s.payment_method || '').toLowerCase();
    if (method.includes('cash')) {
      cashSales += total;
    } else {
      cardBankSales += total;
    }
    
    // Parse items for product breakdown
    let items = [];
    try {
      if (typeof s.items_json === 'string' && s.items_json.trim().startsWith('[')) {
        items = JSON.parse(s.items_json);
      }
    } catch(e) {}
    
    items.forEach(item => {
      const pName = item.name || 'Unknown Item';
      if (!productSalesMap[pName]) {
        productSalesMap[pName] = { qty: 0, revenue: 0 };
      }
      productSalesMap[pName].qty += (Number(item.quantity) || 1);
      productSalesMap[pName].revenue += (Number(item.total) || (Number(item.sell_price) * Number(item.quantity)) || 0);
    });
  });
  
  // Total Expenses
  let totalExpensesAmount = 0;
  const expenseCatMap = {};
  monthExpenses.forEach(e => {
    const amt = Number(e.amount) || 0;
    totalExpensesAmount += amt;
    const cat = e.category || 'General';
    expenseCatMap[cat] = (expenseCatMap[cat] || 0) + amt;
  });
  
  // Total Returns
  let totalRefundsAmount = 0;
  monthReturns.forEach(r => {
    totalRefundsAmount += Number(r.refund_amount) || 0;
  });
  
  const estimatedNetProfit = netSales - totalExpensesAmount - totalRefundsAmount;
  const netMarginPct = netSales > 0 ? ((estimatedNetProfit / netSales) * 100).toFixed(1) : '0';
  
  // Top 10 Products by revenue
  const topProducts = Object.keys(productSalesMap)
    .map(name => ({ name, qty: productSalesMap[name].qty, revenue: productSalesMap[name].revenue }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);
    
  // Inventory valuation
  let totalInventoryUnits = 0;
  let totalInventoryRetailVal = 0;
  let totalInventoryCostVal = 0;
  let lowStockCount = 0;
  
  products.forEach(p => {
    const qty = Number(p.stock_qty) || 0;
    const buy = Number(p.buy_price) || 0;
    const sell = Number(p.sell_price) || 0;
    const minAlert = Number(p.min_stock_alert) || 5;
    
    totalInventoryUnits += qty;
    totalInventoryCostVal += (qty * buy);
    totalInventoryRetailVal += (qty * sell);
    if (qty <= minAlert) lowStockCount++;
  });
  
  // Format HTML Email
  const subject = '📊 Monthly Business Performance & Executive Report [' + targetMonth + '] - ' + shopName;
  
  let html = '<!DOCTYPE html><html><head><meta charset="utf-8"/></head>';
  html += '<body style="font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif; background-color: #f8fafc; padding: 24px; color: #1e293b; margin: 0;">';
  html += '<div style="max-width: 680px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; padding: 28px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">';
  
  // Header
  html += '<div style="border-bottom: 3px solid #0b5fa5; padding-bottom: 20px; margin-bottom: 24px; text-align: center;">';
  html += '<h1 style="font-size: 24px; font-weight: 800; color: #0f172a; margin: 0 0 6px 0;">' + shopName + '</h1>';
  html += '<div style="display: inline-block; background-color: #e0f2fe; color: #0369a1; font-weight: 700; font-size: 12px; padding: 4px 12px; rounded: 9999px;">';
  html += 'Monthly Executive Statement • ' + targetMonth;
  html += '</div>';
  html += '<p style="font-size: 12px; color: #64748b; margin: 8px 0 0 0;">Generated automatically by Bloom & Carry Cloud POS Automation Engine</p>';
  html += '</div>';
  
  // KPI Metric Cards Grid
  html += '<table style="width: 100%; border-collapse: separate; border-spacing: 8px; margin-bottom: 24px;">';
  html += '<tr>';
  html += '<td style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 14px; text-align: center; width: 33%;">';
  html += '<div style="font-size: 11px; font-weight: 700; color: #166534; text-transform: uppercase;">Net Revenue</div>';
  html += '<div style="font-size: 18px; font-weight: 800; color: #15803d; margin-top: 4px;">Rs ' + netSales.toLocaleString() + '</div>';
  html += '<div style="font-size: 10px; color: #166534; margin-top: 2px;">' + monthSales.length + ' Invoices</div>';
  html += '</td>';
  
  html += '<td style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 12px; padding: 14px; text-align: center; width: 33%;">';
  html += '<div style="font-size: 11px; font-weight: 700; color: #1e40af; text-transform: uppercase;">Est. Net Profit</div>';
  html += '<div style="font-size: 18px; font-weight: 800; color: #1d4ed8; margin-top: 4px;">Rs ' + estimatedNetProfit.toLocaleString() + '</div>';
  html += '<div style="font-size: 10px; color: #1e40af; margin-top: 2px;">' + netMarginPct + '% Net Margin</div>';
  html += '</td>';
  
  html += '<td style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 12px; padding: 14px; text-align: center; width: 33%;">';
  html += '<div style="font-size: 11px; font-weight: 700; color: #991b1b; text-transform: uppercase;">Total Expenses</div>';
  html += '<div style="font-size: 18px; font-weight: 800; color: #b91c1c; margin-top: 4px;">Rs ' + totalExpensesAmount.toLocaleString() + '</div>';
  html += '<div style="font-size: 10px; color: #991b1b; margin-top: 2px;">' + monthExpenses.length + ' Recorded</div>';
  html += '</td>';
  html += '</tr></table>';
  
  // Financial Summary Breakdown Table
  html += '<h3 style="font-size: 14px; font-weight: 800; color: #0f172a; border-left: 4px solid #0b5fa5; padding-left: 8px; margin-bottom: 12px;">Financial Statement Summary</h3>';
  html += '<table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 24px;">';
  html += '<tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 8px 4px; color: #475569;">Gross Sales (Subtotal)</td><td style="padding: 8px 4px; text-align: right; font-weight: 600;">Rs ' + grossSales.toLocaleString() + '</td></tr>';
  html += '<tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 8px 4px; color: #059669;">Discounts Granted</td><td style="padding: 8px 4px; text-align: right; font-weight: 600; color: #059669;">-Rs ' + totalDiscounts.toLocaleString() + '</td></tr>';
  html += '<tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 8px 4px; color: #475569;">Tax Collected</td><td style="padding: 8px 4px; text-align: right; font-weight: 600;">Rs ' + totalTax.toLocaleString() + '</td></tr>';
  html += '<tr style="border-bottom: 1px solid #e2e8f0; font-weight: 700; background: #f8fafc;"><td style="padding: 8px 4px;">Net Sales Realized</td><td style="padding: 8px 4px; text-align: right; color: #0b5fa5;">Rs ' + netSales.toLocaleString() + '</td></tr>';
  html += '<tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 8px 4px; color: #dc2626;">Total Operating Expenses</td><td style="padding: 8px 4px; text-align: right; font-weight: 600; color: #dc2626;">-Rs ' + totalExpensesAmount.toLocaleString() + '</td></tr>';
  if (totalRefundsAmount > 0) {
    html += '<tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 8px 4px; color: #e11d48;">Customer Returns & Refunds</td><td style="padding: 8px 4px; text-align: right; font-weight: 600; color: #e11d48;">-Rs ' + totalRefundsAmount.toLocaleString() + '</td></tr>';
  }
  html += '<tr style="font-weight: 800; font-size: 13px; background: #eff6ff;"><td style="padding: 10px 4px; color: #1e3a8a;">Estimated Net Take-Home Profit</td><td style="padding: 10px 4px; text-align: right; color: #1d4ed8;">Rs ' + estimatedNetProfit.toLocaleString() + '</td></tr>';
  html += '</table>';
  
  // Payment Method Breakdown
  html += '<h3 style="font-size: 14px; font-weight: 800; color: #0f172a; border-left: 4px solid #0b5fa5; padding-left: 8px; margin-bottom: 12px;">Payment Collection Breakdown</h3>';
  html += '<table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 24px;">';
  html += '<tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 8px 4px; color: #475569;">Cash In Hand Collections</td><td style="padding: 8px 4px; text-align: right; font-weight: 700;">Rs ' + cashSales.toLocaleString() + '</td></tr>';
  html += '<tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 8px 4px; color: #475569;">Card, Bank Transfer & Digital Payments</td><td style="padding: 8px 4px; text-align: right; font-weight: 700;">Rs ' + cardBankSales.toLocaleString() + '</td></tr>';
  html += '</table>';
  
  // Top 10 Products Table
  if (topProducts.length > 0) {
    html += '<h3 style="font-size: 14px; font-weight: 800; color: #0f172a; border-left: 4px solid #0b5fa5; padding-left: 8px; margin-bottom: 12px;">Top 10 Selling Products</h3>';
    html += '<table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 24px;">';
    html += '<thead style="background: #f1f5f9; color: #475569;"><tr><th style="padding: 6px; text-align: left;">Product</th><th style="padding: 6px; text-align: center;">Units Sold</th><th style="padding: 6px; text-align: right;">Revenue</th></tr></thead><tbody>';
    topProducts.forEach(tp => {
      html += '<tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 6px; font-weight: 600;">' + tp.name + '</td><td style="padding: 6px; text-align: center;">' + tp.qty + '</td><td style="padding: 6px; text-align: right; font-weight: 700; color: #0b5fa5;">Rs ' + tp.revenue.toLocaleString() + '</td></tr>';
    });
    html += '</tbody></table>';
  }
  
  // Inventory Health Summary
  html += '<h3 style="font-size: 14px; font-weight: 800; color: #0f172a; border-left: 4px solid #0b5fa5; padding-left: 8px; margin-bottom: 12px;">Inventory & Stock Health</h3>';
  html += '<table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 24px;">';
  html += '<tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 8px 4px; color: #475569;">Total Inventory Items in Stock</td><td style="padding: 8px 4px; text-align: right; font-weight: 700;">' + totalInventoryUnits.toLocaleString() + ' units (' + products.length + ' SKUs)</td></tr>';
  html += '<tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 8px 4px; color: #475569;">Inventory Valuation (Retail Value)</td><td style="padding: 8px 4px; text-align: right; font-weight: 700; color: #059669;">Rs ' + totalInventoryRetailVal.toLocaleString() + '</td></tr>';
  html += '<tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 8px 4px; color: #475569;">Inventory Valuation (Cost Basis)</td><td style="padding: 8px 4px; text-align: right; font-weight: 700;">Rs ' + totalInventoryCostVal.toLocaleString() + '</td></tr>';
  if (lowStockCount > 0) {
    html += '<tr style="border-bottom: 1px solid #e2e8f0; background: #fff1f2;"><td style="padding: 8px 4px; color: #be123c; font-weight: 700;">⚠️ Low Stock Items Alert</td><td style="padding: 8px 4px; text-align: right; font-weight: 700; color: #be123c;">' + lowStockCount + ' SKUs require reordering</td></tr>';
  }
  html += '</table>';
  
  // Footer
  html += '<div style="text-align: center; border-top: 1px solid #e2e8f0; padding-top: 18px; font-size: 11px; color: #94a3b8;">';
  html += '<p style="margin: 0 0 4px 0; font-weight: 600; color: #64748b;">Bloom & Carry Cloud POS • Automated Management Intelligence</p>';
  html += '<p style="margin: 0;">This official report was compiled from your Google Sheets & Cloud Firestore database.</p>';
  html += '</div></div></body></html>';
  
  // Build CSV Attachment of Sales
  let csvContent = 'Invoice No,Date,Customer,Total,Payment Method\n';
  monthSales.forEach(s => {
    csvContent += '"' + s.invoice_no + '","' + s.datetime + '","' + (s.customer_name || 'Walk-in') + '",' + s.total + ',"' + s.payment_method + '"\n';
  });
  const csvBlob = Utilities.newBlob(csvContent, 'text/csv', 'BloomCarry_Sales_' + targetMonth + '.csv');
  
  // Dispatch Email
  GmailApp.sendEmail(emailRecipient, subject, 'Please view this monthly report in an HTML-compatible email client.', {
    htmlBody: html,
    attachments: [csvBlob],
    name: 'Bloom & Carry POS Automation'
  });
  
  return {
    recipient: emailRecipient,
    month: targetMonth,
    invoicesCount: monthSales.length,
    netSales: netSales,
    netProfit: estimatedNetProfit,
    timestamp: new Date().toISOString()
  };
}

/**
 * ============================================================================
 * AUTOMATED TIME-BASED TRIGGERS SETUP
 * Run this function once from Apps Script editor to automate:
 * 1. Daily midnight ledger snapshot calculation
 * 2. Monthly executive business report to bloomandcarry.pk@gmail.com on the 1st
 * ============================================================================
 */
function setupAutomatedTriggers() {
  // Clear existing triggers to avoid duplication
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(t => ScriptApp.deleteTrigger(t));
  
  // 1. Daily Midnight Closing Trigger (runs between 11pm-midnight)
  ScriptApp.newTrigger('dailyMidnightClosingJob')
    .timeBased()
    .everyDays(1)
    .atHour(23)
    .create();
    
  // 2. Monthly Executive Report Trigger (runs on 1st of every month at 8am)
  ScriptApp.newTrigger('monthlyReportTriggerJob')
    .timeBased()
    .onMonthDay(1)
    .atHour(8)
    .create();
    
  Logger.log('✅ Automated daily and monthly triggers installed successfully!');
}

/**
 * Daily closing background task
 */
function dailyMidnightClosingJob() {
  try {
    const today = new Date().toISOString().split('T')[0];
    const sales = getSheetData(SHEET_NAMES.SALES).filter(s => String(s.datetime || '').startsWith(today));
    const expenses = getSheetData(SHEET_NAMES.EXPENSES).filter(e => String(e.date || '').startsWith(today));
    
    let gross = 0;
    let discount = 0;
    let net = 0;
    let cash = 0;
    let cardBank = 0;
    
    sales.forEach(s => {
      const tot = Number(s.total) || 0;
      const sub = Number(s.subtotal) || tot;
      gross += sub;
      discount += Number(s.discount) || 0;
      net += tot;
      if (String(s.payment_method || '').toLowerCase().includes('cash')) {
        cash += tot;
      } else {
        cardBank += tot;
      }
    });
    
    let totalExp = 0;
    expenses.forEach(e => {
      totalExp += Number(e.amount) || 0;
    });
    
    saveDailyLedgerRow({
      date: today,
      total_invoices: sales.length,
      gross_sales: gross,
      total_discounts: discount,
      net_sales: net,
      total_expenses: totalExp,
      net_profit: net - totalExp,
      cash_collected: cash,
      card_bank_collected: cardBank
    });
    
    Logger.log('Daily midnight ledger recorded for ' + today);
  } catch (err) {
    Logger.log('Daily closing notice: ' + err.toString());
  }
}

/**
 * Monthly report background task
 */
function monthlyReportTriggerJob() {
  try {
    const now = new Date();
    // Previous month computation
    now.setMonth(now.getMonth() - 1);
    const prevMonthStr = now.toISOString().slice(0, 7);
    sendMonthlyComprehensiveReport(DEFAULT_REPORT_EMAIL, prevMonthStr);
    Logger.log('Monthly report automatically dispatched for ' + prevMonthStr);
  } catch (err) {
    Logger.log('Monthly report trigger error: ' + err.toString());
  }
}
`;


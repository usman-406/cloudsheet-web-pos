import { getAccessToken } from './firebase';
import { Product, Sale, ShopSettings } from '../types';
import { StorageService } from './storage';

export interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  createdTime?: string;
  modifiedTime?: string;
  size?: string;
  webViewLink?: string;
}

export interface WorkspaceAuthStatus {
  isConnected: boolean;
  email?: string;
}

// Utility to encode text to Base64URL (RFC 4648 § 5) for Gmail API
function base64UrlEncode(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export const WorkspaceService = {
  // ----------------------------------------------------
  // GOOGLE DRIVE API
  // ----------------------------------------------------
  
  async listDriveFiles(query: string = "trashed = false", pageSize: number = 25): Promise<GoogleDriveFile[]> {
    const token = await getAccessToken();
    if (!token) throw new Error('Not signed in to Google Workspace. Please sign in with Google.');

    const params = new URLSearchParams({
      q: query,
      pageSize: pageSize.toString(),
      fields: 'files(id, name, mimeType, createdTime, modifiedTime, size, webViewLink)',
      orderBy: 'modifiedTime desc',
    });

    const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `Failed to fetch Drive files (${res.status})`);
    }

    const data = await res.json();
    return data.files || [];
  },

  async uploadFileToDrive(fileName: string, content: string, mimeType: string = 'application/json'): Promise<GoogleDriveFile> {
    const token = await getAccessToken();
    if (!token) throw new Error('Not signed in to Google Workspace. Please sign in with Google.');

    const metadata = {
      name: fileName,
      mimeType: mimeType,
      description: 'BoomandCarry POS Cloud Backup & Sync File',
    };

    const boundary = '-------314159265358979323846';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const multipartRequestBody =
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      `Content-Type: ${mimeType}\r\n\r\n` +
      content +
      closeDelimiter;

    const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,webViewLink,createdTime', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartRequestBody,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `Failed to upload file to Google Drive (${res.status})`);
    }

    return await res.json();
  },

  async downloadDriveFileContent(fileId: string): Promise<string> {
    const token = await getAccessToken();
    if (!token) throw new Error('Not signed in to Google Workspace.');

    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to download file from Google Drive (${res.status})`);
    }

    return await res.text();
  },

  async deleteDriveFile(fileId: string, fileName: string): Promise<void> {
    const token = await getAccessToken();
    if (!token) throw new Error('Not signed in to Google Workspace.');

    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `Failed to delete file from Google Drive (${res.status})`);
    }
  },

  // ----------------------------------------------------
  // GOOGLE SHEETS API
  // ----------------------------------------------------

  async createSpreadsheet(title: string, sheetTabs: string[] = ['Products_Inventory', 'Sales_Ledger', 'Financial_Summary']): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
    const token = await getAccessToken();
    if (!token) throw new Error('Not signed in to Google Workspace.');

    const requestBody = {
      properties: {
        title: title || `BoomandCarry POS Database - ${new Date().toLocaleDateString()}`,
      },
      sheets: sheetTabs.map(name => ({
        properties: {
          title: name,
          gridProperties: {
            frozenRowCount: 1,
          }
        }
      }))
    };

    const res = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `Failed to create Google Spreadsheet (${res.status})`);
    }

    const data = await res.json();
    return {
      spreadsheetId: data.spreadsheetId,
      spreadsheetUrl: data.spreadsheetUrl,
    };
  },

  async exportProductsToSheet(spreadsheetId: string, products: Product[], sheetName: string = 'Products_Inventory'): Promise<void> {
    const token = await getAccessToken();
    if (!token) throw new Error('Not signed in to Google Workspace.');

    const headers = [
      'Product ID',
      'Barcode',
      'Product Name',
      'Category',
      'Brand',
      'Buy Price (Rs)',
      'Sell Price (Rs)',
      'Margin %',
      'Stock Qty',
      'Min Stock Alert',
      'Shelf Location',
      'Expiry Date',
      'Last Updated'
    ];

    const rows = products.map(p => {
      const sellPrice = p.sell_price || 0;
      const buyPrice = p.buy_price || 0;
      const margin = sellPrice > 0 ? (((sellPrice - buyPrice) / sellPrice) * 100).toFixed(1) + '%' : '0%';
      return [
        p.id,
        p.barcode,
        p.name,
        p.category || 'General',
        p.brand || '',
        p.buy_price || 0,
        p.sell_price || 0,
        margin,
        p.stock_qty || 0,
        p.min_stock_alert || 5,
        p.shelf_location || '',
        p.expiry_date || '',
        new Date().toISOString()
      ];
    });

    const values = [headers, ...rows];

    const range = `${sheetName}!A1:M${values.length}`;
    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        range,
        majorDimension: 'ROWS',
        values,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `Failed to update Products in Google Sheet (${res.status})`);
    }
  },

  async appendProductToSheet(spreadsheetId: string, product: Product, sheetName: string = 'Products_Inventory'): Promise<void> {
    const token = await getAccessToken();
    if (!token) return;

    const sellPrice = product.sell_price || 0;
    const buyPrice = product.buy_price || 0;
    const margin = sellPrice > 0 ? (((sellPrice - buyPrice) / sellPrice) * 100).toFixed(1) + '%' : '0%';
    const row = [
      product.id,
      product.barcode || '',
      product.name || '',
      product.category || 'General',
      product.brand || '',
      product.buy_price || 0,
      product.sell_price || 0,
      margin,
      product.stock_qty || 0,
      product.min_stock_alert || 5,
      product.shelf_location || '',
      product.expiry_date || '',
      new Date().toISOString()
    ];

    const range = `${sheetName}!A:M`;
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        range,
        majorDimension: 'ROWS',
        values: [row],
      }),
    });
  },

  async exportSalesToSheet(spreadsheetId: string, sales: Sale[], sheetName: string = 'Sales_Ledger'): Promise<void> {
    const token = await getAccessToken();
    if (!token) throw new Error('Not signed in to Google Workspace.');

    const headers = [
      'Invoice No',
      'Date & Time',
      'Customer Name',
      'Customer Phone',
      'Items Count',
      'Subtotal (Rs)',
      'Discount (Rs)',
      'Tax (Rs)',
      'Grand Total (Rs)',
      'Payment Method',
      'Cashier',
      'Status'
    ];

    const rows = sales.map(s => [
      s.invoice_no,
      s.datetime,
      s.customer_name || 'Walk-in Customer',
      s.customer_phone || '',
      s.items?.length || 0,
      s.subtotal || 0,
      s.discount || 0,
      s.tax_amount || 0,
      s.total || 0,
      s.payment_method || 'Cash',
      s.cashier_name || 'Staff',
      s.status || 'PAID'
    ]);

    const values = [headers, ...rows];
    const range = `${sheetName}!A1:L${values.length}`;

    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        range,
        majorDimension: 'ROWS',
        values,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `Failed to update Sales in Google Sheet (${res.status})`);
    }
  },

  async exportExpensesToSheet(spreadsheetId: string, expenses: any[], sheetName: string = 'Expenses_Ledger'): Promise<void> {
    const token = await getAccessToken();
    if (!token) return;

    const headers = ['ID', 'Date', 'Category', 'Title', 'Amount (Rs)', 'Recorded By', 'Created At'];
    const rows = expenses.map(e => [
      e.id,
      e.date,
      e.category || 'General',
      e.title || '',
      e.amount || 0,
      e.recorded_by || 'Admin',
      e.created_at || new Date().toISOString()
    ]);

    const values = [headers, ...rows];
    const range = `${sheetName}!A1:G${values.length}`;

    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ range, majorDimension: 'ROWS', values }),
    }).catch(err => console.warn('Expenses sheet export notice:', err));
  },

  async exportDailySummaryToSheet(spreadsheetId: string, dateStr: string, sales: Sale[], expenses: any[], sheetName: string = 'Daily_Ledger'): Promise<void> {
    const token = await getAccessToken();
    if (!token) return;

    const daySales = sales.filter(s => String(s.datetime || '').startsWith(dateStr));
    const dayExpenses = expenses.filter(e => String(e.date || '').startsWith(dateStr));

    let gross = 0;
    let discount = 0;
    let net = 0;
    let cash = 0;
    let digital = 0;

    daySales.forEach(s => {
      gross += Number(s.subtotal) || Number(s.total) || 0;
      discount += Number(s.discount) || 0;
      net += Number(s.total) || 0;
      if (String(s.payment_method || '').toLowerCase().includes('cash')) {
        cash += Number(s.total) || 0;
      } else {
        digital += Number(s.total) || 0;
      }
    });

    let totalExp = 0;
    dayExpenses.forEach(e => {
      totalExp += Number(e.amount) || 0;
    });

    const netProfit = net - totalExp;

    const row = [
      dateStr,
      daySales.length,
      gross,
      discount,
      net,
      totalExp,
      netProfit,
      cash,
      digital,
      new Date().toISOString()
    ];

    const range = `${sheetName}!A:J`;
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        range,
        majorDimension: 'ROWS',
        values: [row],
      }),
    }).catch(err => console.warn('Daily ledger append notice:', err));
  },

  async readProductsFromSheet(spreadsheetId: string, sheetName: string = 'Products_Inventory'): Promise<Product[]> {
    const token = await getAccessToken();
    if (!token) throw new Error('Not signed in to Google Workspace.');

    const range = `${sheetName}!A2:M5000`;
    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `Failed to read products from Google Sheet (${res.status})`);
    }

    const data = await res.json();
    const rows: string[][] = data.values || [];

    return rows.map((row, index) => {
      const id = row[0] || `SHEET_PROD_${Date.now()}_${index}`;
      const barcode = row[1] || `${Math.floor(100000000000 + Math.random() * 900000000000)}`;
      const name = row[2] || 'Unnamed Cosmetic Product';
      const category = row[3] || 'General';
      const brand = row[4] || '';
      const buy_price = parseFloat(row[5]) || 0;
      const sell_price = parseFloat(row[6]) || 0;
      const stock_qty = parseInt(row[8], 10) || 0;
      const min_stock_alert = parseInt(row[9], 10) || 5;
      const shelf_location = row[10] || '';
      const expiry_date = row[11] || '';

      return {
        id,
        barcode,
        name,
        category,
        brand,
        buy_price,
        sell_price,
        stock_qty,
        min_stock_alert,
        shelf_location,
        expiry_date,
        image_url: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=300&q=80',
      };
    });
  },

  // ----------------------------------------------------
  // GMAIL API
  // ----------------------------------------------------

  async sendEmail(to: string, subject: string, bodyText: string, bodyHtml?: string): Promise<{ id: string; threadId: string }> {
    const token = await getAccessToken();
    if (!token) throw new Error('Not signed in to Google Workspace.');

    // Construct MIME Message
    const boundary = '======_MIME_BOUNDARY_======';
    let mimeMessage = `To: ${to}\r\n`;
    mimeMessage += `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=\r\n`;
    mimeMessage += 'MIME-Version: 1.0\r\n';

    if (bodyHtml) {
      mimeMessage += `Content-Type: multipart/alternative; boundary="${boundary}"\r\n\r\n`;
      mimeMessage += `--${boundary}\r\n`;
      mimeMessage += 'Content-Type: text/plain; charset="UTF-8"\r\n\r\n';
      mimeMessage += `${bodyText}\r\n\r\n`;
      mimeMessage += `--${boundary}\r\n`;
      mimeMessage += 'Content-Type: text/html; charset="UTF-8"\r\n\r\n';
      mimeMessage += `${bodyHtml}\r\n\r\n`;
      mimeMessage += `--${boundary}--`;
    } else {
      mimeMessage += 'Content-Type: text/plain; charset="UTF-8"\r\n\r\n';
      mimeMessage += bodyText;
    }

    const raw = base64UrlEncode(mimeMessage);

    const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `Failed to send email via Gmail (${res.status})`);
    }

    return await res.json();
  },

  async sendInvoiceReceiptEmail(to: string, sale: Sale, settings: ShopSettings): Promise<{ id: string }> {
    const subject = `Official Tax Invoice & Receipt #${sale.invoice_no} - ${settings.shop_name}`;
    const plainText = `
Thank you for shopping with ${settings.shop_name}!
Invoice Number: ${sale.invoice_no}
Date: ${sale.datetime}
Cashier: ${sale.cashier_name}
Total Amount: ${settings.currency_symbol}${sale.total.toLocaleString()}
Payment Method: ${sale.payment_method}

Items:
${(sale.items || []).map(i => `- ${i.name} x${i.quantity} @ ${settings.currency_symbol}${i.sell_price} = ${settings.currency_symbol}${i.total}`).join('\n')}

Subtotal: ${settings.currency_symbol}${sale.subtotal.toLocaleString()}
Discount: ${settings.currency_symbol}${sale.discount.toLocaleString()}
Tax: ${settings.currency_symbol}${sale.tax_amount.toLocaleString()}
Grand Total: ${settings.currency_symbol}${sale.total.toLocaleString()}

${settings.tagline || 'Thank you for your business!'}
${settings.address || ''} | Tel: ${settings.phone || ''}
    `.trim();

    const itemsHtml = (sale.items || []).map(i => `
      <tr style="border-bottom: 1px dashed #e2e8f0;">
        <td style="padding: 8px 4px; font-size: 13px; color: #1e293b; font-weight: 600;">${i.name}</td>
        <td style="padding: 8px 4px; font-size: 13px; color: #475569; text-align: center;">${i.quantity}</td>
        <td style="padding: 8px 4px; font-size: 13px; color: #475569; text-align: right;">${settings.currency_symbol}${i.sell_price.toLocaleString()}</td>
        <td style="padding: 8px 4px; font-size: 13px; color: #0f172a; font-weight: 700; text-align: right;">${settings.currency_symbol}${i.total.toLocaleString()}</td>
      </tr>
    `).join('');

    const html = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"/></head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; padding: 20px; margin: 0;">
        <div style="max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; padding: 24px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          <div style="text-align: center; border-bottom: 2px solid #ec4899; padding-bottom: 16px; margin-bottom: 16px;">
            <h1 style="font-size: 22px; font-weight: 800; color: #0f172a; margin: 0 0 4px 0; letter-spacing: -0.5px;">${settings.shop_name}</h1>
            <p style="font-size: 12px; color: #ec4899; font-weight: 600; margin: 0;">${settings.tagline || 'Cosmetics & Beauty Store'}</p>
            <p style="font-size: 11px; color: #64748b; margin: 4px 0 0 0;">${settings.address || 'Hostel City Line 10, Yasmeen Plaza, Shop No. 1, Islamabad.'} | Phone: ${settings.phone || '03461185406'}${settings.website || 'bloomandcarry.com' ? ` | Web: ${settings.website || 'bloomandcarry.com'}` : ''}</p>
          </div>

          <div style="background-color: #fdf2f8; border: 1px solid #fbcfe8; border-radius: 8px; padding: 12px; margin-bottom: 16px;">
            <table style="width: 100%; font-size: 12px; color: #831843;">
              <tr>
                <td><strong>Invoice:</strong> #${sale.invoice_no}</td>
                <td style="text-align: right;"><strong>Date:</strong> ${sale.datetime}</td>
              </tr>
              <tr>
                <td><strong>Customer:</strong> ${sale.customer_name || 'Walk-in'}</td>
                <td style="text-align: right;"><strong>Payment:</strong> ${sale.payment_method}</td>
              </tr>
            </table>
          </div>

          <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
            <thead>
              <tr style="border-bottom: 2px solid #cbd5e1; background: #f8fafc;">
                <th style="padding: 6px 4px; font-size: 12px; color: #475569; text-align: left;">Item</th>
                <th style="padding: 6px 4px; font-size: 12px; color: #475569; text-align: center;">Qty</th>
                <th style="padding: 6px 4px; font-size: 12px; color: #475569; text-align: right;">Price</th>
                <th style="padding: 6px 4px; font-size: 12px; color: #475569; text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <div style="border-top: 2px solid #0f172a; padding-top: 12px; margin-bottom: 20px;">
            <table style="width: 100%; font-size: 13px;">
              <tr>
                <td style="color: #64748b;">Subtotal:</td>
                <td style="text-align: right; font-weight: 600;">${settings.currency_symbol}${sale.subtotal.toLocaleString()}</td>
              </tr>
              ${sale.discount > 0 ? `
              <tr>
                <td style="color: #059669;">Discount:</td>
                <td style="text-align: right; color: #059669; font-weight: 600;">-${settings.currency_symbol}${sale.discount.toLocaleString()}</td>
              </tr>` : ''}
              ${sale.tax_amount > 0 ? `
              <tr>
                <td style="color: #64748b;">Tax (${settings.tax_rate}%):</td>
                <td style="text-align: right; font-weight: 600;">${settings.currency_symbol}${sale.tax_amount.toLocaleString()}</td>
              </tr>` : ''}
              <tr style="font-size: 16px; font-weight: 800; color: #0f172a;">
                <td style="padding-top: 8px;">Grand Total:</td>
                <td style="padding-top: 8px; text-align: right; color: #be185d;">${settings.currency_symbol}${sale.total.toLocaleString()}</td>
              </tr>
            </table>
          </div>

          <div style="text-align: center; border-top: 1px solid #f1f5f9; padding-top: 16px; font-size: 11px; color: #94a3b8;">
            <p style="margin: 0 0 4px 0; font-weight: 600; color: #64748b;">Thank you for shopping with ${settings.shop_name}!</p>
            <p style="margin: 0;">Please retain this digital receipt for warranty or exchange purposes.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await this.sendEmail(to, subject, plainText, html);
  },

  async sendLowStockAlertEmail(to: string, lowStockProducts: Product[], settings: ShopSettings): Promise<{ id: string }> {
    const subject = `⚠️ Low Stock Warning: ${lowStockProducts.length} items require reordering - ${settings.shop_name}`;
    const plainText = `
Low Stock Alert for ${settings.shop_name}
Generated at: ${new Date().toLocaleString()}

The following items are at or below safety stock levels:
${lowStockProducts.map(p => `- ${p.name} (Barcode: ${p.barcode}) | In Stock: ${p.stock_qty} (Min Alert: ${p.min_stock_alert || 5})`).join('\n')}

Please review your purchase orders and reorder from suppliers.
    `.trim();

    const itemsRows = lowStockProducts.map(p => `
      <tr style="border-bottom: 1px solid #fee2e2;">
        <td style="padding: 8px; font-weight: 600; color: #991b1b;">${p.name}</td>
        <td style="padding: 8px; font-family: monospace; font-size: 11px; color: #475569;">${p.barcode}</td>
        <td style="padding: 8px; color: #64748b;">${p.category}</td>
        <td style="padding: 8px; text-align: center; font-weight: 800; color: #dc2626;">${p.stock_qty}</td>
        <td style="padding: 8px; text-align: center; color: #64748b;">${p.min_stock_alert || 5}</td>
      </tr>
    `).join('');

    const html = `
      <div style="max-width: 600px; margin: 0 auto; font-family: sans-serif; background: #ffffff; border: 1px solid #fecaca; border-radius: 8px; padding: 20px;">
        <h2 style="color: #dc2626; margin-top: 0;">⚠️ Low Stock Inventory Alert</h2>
        <p style="font-size: 13px; color: #475569;">Store: <strong>${settings.shop_name}</strong> | Date: ${new Date().toLocaleString()}</p>
        <p style="font-size: 14px; color: #1e293b;">The following <strong>${lowStockProducts.length}</strong> items have fallen below their minimum stock threshold:</p>
        <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin: 16px 0;">
          <thead style="background: #fef2f2; color: #991b1b;">
            <tr>
              <th style="padding: 8px; text-align: left;">Product</th>
              <th style="padding: 8px; text-align: left;">Barcode</th>
              <th style="padding: 8px; text-align: left;">Category</th>
              <th style="padding: 8px; text-align: center;">Current Stock</th>
              <th style="padding: 8px; text-align: center;">Min Threshold</th>
            </tr>
          </thead>
          <tbody>
            ${itemsRows}
          </tbody>
        </table>
        <p style="font-size: 12px; color: #64748b;">Sent automatically from BoomandCarry Cloud POS.</p>
      </div>
    `;

    return await this.sendEmail(to, subject, plainText, html);
  },

  async sendMonthlyComprehensiveReportEmail(
    to: string = 'bloomandcarry.pk@gmail.com',
    targetMonthStr?: string,
    salesData?: Sale[],
    expensesData?: any[],
    productsData?: Product[],
    settingsData?: ShopSettings
  ): Promise<{ id?: string; message: string }> {
    // 1. Determine Target Month
    const now = new Date();
    const currentMonthStr = now.toISOString().slice(0, 7);
    const targetMonth = targetMonthStr || currentMonthStr;

    // Load data from StorageService if not provided
    const sales = salesData || StorageService.getSales();
    const expenses = expensesData || StorageService.getExpenses();
    const products = productsData || StorageService.getProducts();
    const settings = settingsData || StorageService.getSettings();

    const shopName = settings.shop_name || 'Bloom & Carry';
    const currency = settings.currency_symbol || 'Rs';

    // Filter sales and expenses by targetMonth (e.g., "2026-08")
    const monthSales = sales.filter(s => String(s.datetime || '').startsWith(targetMonth));
    const monthExpenses = expenses.filter(e => String(e.date || '').startsWith(targetMonth));

    let grossSales = 0;
    let totalDiscounts = 0;
    let totalTax = 0;
    let netSales = 0;
    let cashSales = 0;
    let cardBankSales = 0;
    const productSalesMap: Record<string, { qty: number; revenue: number }> = {};

    monthSales.forEach(s => {
      const tot = Number(s.total) || 0;
      const sub = Number(s.subtotal) || tot;
      grossSales += sub;
      totalDiscounts += Number(s.discount) || 0;
      totalTax += Number(s.tax_amount) || 0;
      netSales += tot;

      const method = String(s.payment_method || '').toLowerCase();
      if (method.includes('cash')) {
        cashSales += tot;
      } else {
        cardBankSales += tot;
      }

      (s.items || []).forEach(item => {
        const pName = item.name || 'Product';
        if (!productSalesMap[pName]) {
          productSalesMap[pName] = { qty: 0, revenue: 0 };
        }
        productSalesMap[pName].qty += Number(item.quantity) || 1;
        productSalesMap[pName].revenue += Number(item.total) || ((Number(item.sell_price) || 0) * (Number(item.quantity) || 1));
      });
    });

    let totalExpensesAmount = 0;
    monthExpenses.forEach(e => {
      totalExpensesAmount += Number(e.amount) || 0;
    });

    const netProfit = netSales - totalExpensesAmount;
    const netMargin = netSales > 0 ? (Number((netProfit / netSales) * 100) || 0).toFixed(1) : '0';

    const topProducts = Object.keys(productSalesMap)
      .map(name => ({ name, qty: productSalesMap[name].qty, revenue: productSalesMap[name].revenue }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

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

    const subject = `📊 Monthly Executive Financial & Performance Report [${targetMonth}] - ${shopName}`;

    const plainText = `
=====================================================
${shopName} - Comprehensive Monthly Executive Report
Month: ${targetMonth}
Generated at: ${new Date().toLocaleString()}
=====================================================

1. EXECUTIVE FINANCIAL SUMMARY
- Gross Sales (Subtotal): ${currency} ${grossSales.toLocaleString()}
- Total Discounts Given: -${currency} ${totalDiscounts.toLocaleString()}
- Total Tax Collected: ${currency} ${totalTax.toLocaleString()}
- Net Realized Revenue: ${currency} ${netSales.toLocaleString()} (${monthSales.length} Invoices)
- Total Operating Expenses: -${currency} ${totalExpensesAmount.toLocaleString()} (${monthExpenses.length} Entries)
- Net Profit: ${currency} ${netProfit.toLocaleString()} (${netMargin}% Net Margin)

2. PAYMENT COLLECTIONS
- Cash Collections: ${currency} ${cashSales.toLocaleString()}
- Digital / Card / Bank: ${currency} ${cardBankSales.toLocaleString()}

3. INVENTORY & VALUATION
- Total Stock Units: ${totalInventoryUnits.toLocaleString()} units (${products.length} SKUs)
- Total Retail Valuation: ${currency} ${totalInventoryRetailVal.toLocaleString()}
- Total Inventory Cost Basis: ${currency} ${totalInventoryCostVal.toLocaleString()}
- Low Stock Items Requiring Reorder: ${lowStockCount} SKUs

4. TOP SELLING PRODUCTS
${topProducts.map((tp, idx) => `${idx + 1}. ${tp.name} - ${tp.qty} units | ${currency} ${tp.revenue.toLocaleString()}`).join('\n')}

=====================================================
Automated Cloud Intelligence • Bloom & Carry POS
    `.trim();

    const topProductsHtml = topProducts.map(tp => `
      <tr style="border-bottom: 1px solid #f1f5f9;">
        <td style="padding: 8px 6px; font-weight: 600; color: #1e293b;">${tp.name}</td>
        <td style="padding: 8px 6px; text-align: center; color: #475569;">${tp.qty}</td>
        <td style="padding: 8px 6px; text-align: right; font-weight: 700; color: #0b5fa5;">${currency} ${tp.revenue.toLocaleString()}</td>
      </tr>
    `).join('');

    const html = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"/></head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; padding: 24px; color: #1e293b; margin: 0;">
        <div style="max-width: 680px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; padding: 28px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          
          <div style="border-bottom: 3px solid #0b5fa5; padding-bottom: 20px; margin-bottom: 24px; text-align: center;">
            <h1 style="font-size: 24px; font-weight: 800; color: #0f172a; margin: 0 0 6px 0;">${shopName}</h1>
            <div style="display: inline-block; background-color: #e0f2fe; color: #0369a1; font-weight: 700; font-size: 12px; padding: 4px 14px; border-radius: 9999px;">
              Monthly Executive Statement • ${targetMonth}
            </div>
            <p style="font-size: 12px; color: #64748b; margin: 8px 0 0 0;">Recipient: <strong>${to}</strong> | Generated on ${new Date().toLocaleDateString()}</p>
          </div>

          <table style="width: 100%; border-collapse: separate; border-spacing: 8px; margin-bottom: 24px;">
            <tr>
              <td style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 14px; text-align: center; width: 33%;">
                <div style="font-size: 11px; font-weight: 700; color: #166534; text-transform: uppercase;">Net Revenue</div>
                <div style="font-size: 18px; font-weight: 800; color: #15803d; margin-top: 4px;">${currency} ${netSales.toLocaleString()}</div>
                <div style="font-size: 10px; color: #166534; margin-top: 2px;">${monthSales.length} Invoices</div>
              </td>
              <td style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 12px; padding: 14px; text-align: center; width: 33%;">
                <div style="font-size: 11px; font-weight: 700; color: #1e40af; text-transform: uppercase;">Net Profit</div>
                <div style="font-size: 18px; font-weight: 800; color: #1d4ed8; margin-top: 4px;">${currency} ${netProfit.toLocaleString()}</div>
                <div style="font-size: 10px; color: #1e40af; margin-top: 2px;">${netMargin}% Margin</div>
              </td>
              <td style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 12px; padding: 14px; text-align: center; width: 33%;">
                <div style="font-size: 11px; font-weight: 700; color: #991b1b; text-transform: uppercase;">Total Expenses</div>
                <div style="font-size: 18px; font-weight: 800; color: #b91c1c; margin-top: 4px;">${currency} ${totalExpensesAmount.toLocaleString()}</div>
                <div style="font-size: 10px; color: #991b1b; margin-top: 2px;">${monthExpenses.length} Records</div>
              </td>
            </tr>
          </table>

          <h3 style="font-size: 14px; font-weight: 800; color: #0f172a; border-left: 4px solid #0b5fa5; padding-left: 8px; margin-bottom: 12px;">Financial Statement Breakdown</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 24px;">
            <tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 8px 4px; color: #475569;">Gross Sales (Subtotal)</td><td style="padding: 8px 4px; text-align: right; font-weight: 600;">${currency} ${grossSales.toLocaleString()}</td></tr>
            <tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 8px 4px; color: #059669;">Discounts Granted</td><td style="padding: 8px 4px; text-align: right; font-weight: 600; color: #059669;">-${currency} ${totalDiscounts.toLocaleString()}</td></tr>
            <tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 8px 4px; color: #475569;">Tax Collected</td><td style="padding: 8px 4px; text-align: right; font-weight: 600;">${currency} ${totalTax.toLocaleString()}</td></tr>
            <tr style="border-bottom: 1px solid #e2e8f0; font-weight: 700; background: #f8fafc;"><td style="padding: 8px 4px;">Net Sales Realized</td><td style="padding: 8px 4px; text-align: right; color: #0b5fa5;">${currency} ${netSales.toLocaleString()}</td></tr>
            <tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 8px 4px; color: #dc2626;">Total Operating Expenses</td><td style="padding: 8px 4px; text-align: right; font-weight: 600; color: #dc2626;">-${currency} ${totalExpensesAmount.toLocaleString()}</td></tr>
            <tr style="font-weight: 800; font-size: 13px; background: #eff6ff;"><td style="padding: 10px 4px; color: #1e3a8a;">Net Profit (Take-Home)</td><td style="padding: 10px 4px; text-align: right; color: #1d4ed8;">${currency} ${netProfit.toLocaleString()}</td></tr>
          </table>

          <h3 style="font-size: 14px; font-weight: 800; color: #0f172a; border-left: 4px solid #0b5fa5; padding-left: 8px; margin-bottom: 12px;">Top 10 Selling Products</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 24px;">
            <thead style="background: #f1f5f9; color: #475569;">
              <tr>
                <th style="padding: 6px; text-align: left;">Product</th>
                <th style="padding: 6px; text-align: center;">Units Sold</th>
                <th style="padding: 6px; text-align: right;">Revenue</th>
              </tr>
            </thead>
            <tbody>
              ${topProductsHtml || '<tr><td colspan="3" style="padding: 12px; text-align: center; color: #94a3b8;">No products sold this period.</td></tr>'}
            </tbody>
          </table>

          <h3 style="font-size: 14px; font-weight: 800; color: #0f172a; border-left: 4px solid #0b5fa5; padding-left: 8px; margin-bottom: 12px;">Live Inventory Valuation</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 24px;">
            <tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 8px 4px; color: #475569;">Total Inventory Items in Stock</td><td style="padding: 8px 4px; text-align: right; font-weight: 700;">${totalInventoryUnits.toLocaleString()} units (${products.length} SKUs)</td></tr>
            <tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 8px 4px; color: #475569;">Retail Inventory Valuation</td><td style="padding: 8px 4px; text-align: right; font-weight: 700; color: #059669;">${currency} ${totalInventoryRetailVal.toLocaleString()}</td></tr>
            <tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 8px 4px; color: #475569;">Cost Basis Valuation</td><td style="padding: 8px 4px; text-align: right; font-weight: 700;">${currency} ${totalInventoryCostVal.toLocaleString()}</td></tr>
            ${lowStockCount > 0 ? `<tr style="background: #fff1f2;"><td style="padding: 8px 4px; color: #be123c; font-weight: 700;">⚠️ Low Stock Items Warning</td><td style="padding: 8px 4px; text-align: right; font-weight: 700; color: #be123c;">${lowStockCount} items below safety alert</td></tr>` : ''}
          </table>

          <div style="text-align: center; border-top: 1px solid #e2e8f0; padding-top: 18px; font-size: 11px; color: #94a3b8;">
            <p style="margin: 0 0 4px 0; font-weight: 600; color: #64748b;">Bloom & Carry Cloud POS • Automated Management Intelligence</p>
            <p style="margin: 0;">Sent directly to <strong>${to}</strong></p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Try sending via Gmail API first
    try {
      const emailResult = await this.sendEmail(to, subject, plainText, html);
      localStorage.setItem(`last_monthly_report_sent_${targetMonth}`, new Date().toISOString());
      return { id: emailResult.id, message: `Report successfully dispatched to ${to} via Gmail API.` };
    } catch (gmailErr: any) {
      // Fallback: If Google Apps Script URL configured, trigger through Apps Script Web App
      const gasUrl = localStorage.getItem('gas_web_app_url');
      if (gasUrl) {
        try {
          const gasRes = await fetch(gasUrl, {
            method: 'POST',
            body: JSON.stringify({
              action: 'sendMonthlyReport',
              email: to,
              month: targetMonth
            })
          });
          const gasJson = await gasRes.json();
          localStorage.setItem(`last_monthly_report_sent_${targetMonth}`, new Date().toISOString());
          return { message: `Report dispatched to ${to} via Apps Script Automation Engine.` };
        } catch (gasErr) {
          throw new Error(`Gmail API & GAS dispatch failed: ${gmailErr.message}`);
        }
      }
      throw gmailErr;
    }
  },

  /**
   * Automatically checks if the previous month's report has been sent.
   * If not, automatically dispatches it to bloomandcarry.pk@gmail.com
   */
  async checkAndAutoSendMonthlyReport(): Promise<void> {
    try {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth(); // 0-indexed

      // Calculate previous month string (e.g. "2026-07")
      const prevDate = new Date(currentYear, currentMonth - 1, 1);
      const prevMonthStr = prevDate.toISOString().slice(0, 7);

      const storageKey = `last_monthly_report_sent_${prevMonthStr}`;
      const alreadySent = localStorage.getItem(storageKey);

      // Only send if not yet sent for previous month
      if (!alreadySent) {
        console.log(`[AutoReportEngine] Triggering scheduled monthly executive report for ${prevMonthStr}...`);
        await this.sendMonthlyComprehensiveReportEmail('bloomandcarry.pk@gmail.com', prevMonthStr);
      }
    } catch (err) {
      console.warn('[AutoReportEngine] Notice:', err);
    }
  }
};


import { 
  Sale, 
  SaleItem, 
  ReturnTransaction, 
  ReturnItem, 
  RefundMethod, 
  ReturnCondition, 
  ReturnReason, 
  ShopSettings, 
  Coupon, 
  Product, 
  Customer, 
  StockHistoryItem,
  AppNotification,
  FraudAlert
} from '../types';
import { StorageService } from './storage';
import { EscPosService } from './escpos';
import { ApiService } from './api';
import { MongoDbService } from './mongodb_service';
import { WorkspaceService } from './workspace';

export interface ProcessReturnInput {
  originalSale: Sale;
  itemsToReturn: {
    item: SaleItem;
    returnQty: number;
    condition: ReturnCondition;
    reason: ReturnReason;
    customReason?: string;
    customRefundUnitPrice?: number;
  }[];
  refundMethod: RefundMethod;
  notes?: string;
  cashierName: string;
  approvedBy?: string;
  settings: ShopSettings;
  fullPriceRefund?: boolean;
}

export interface ReturnProcessResult {
  success: boolean;
  message: string;
  returnTx?: ReturnTransaction;
  storeCreditCoupon?: Coupon;
  updatedSale?: Sale;
}

export class ReturnRefundService {
  /**
   * Calculate precise refund breakdown for an item considering taxes, line discounts, and full price returns
   */
  static calculateItemRefundBreakdown(
    item: SaleItem,
    returnQty: number,
    sale: Sale,
    options?: {
      fullPriceRefund?: boolean;
      customUnitPrice?: number;
    }
  ): {
    unitDiscount: number;
    refundUnitPrice: number;
    lineRefundSubtotal: number;
    taxPortion: number;
    totalLineRefund: number;
    effectiveTaxRate: number;
  } {
    if (returnQty <= 0) {
      return {
        unitDiscount: 0,
        refundUnitPrice: 0,
        lineRefundSubtotal: 0,
        taxPortion: 0,
        totalLineRefund: 0,
        effectiveTaxRate: 0
      };
    }

    const originalQty = Math.max(1, item.quantity);
    const lineDiscount = item.discount || 0;
    const unitDiscount = lineDiscount / originalQty;

    // CRITICAL: If no tax was charged on the original sale (tax_amount <= 0 or missing),
    // then effectiveTaxRate is strictly 0. Never return or compute tax on a tax-free sale!
    const saleTaxAmount = Number(sale.tax_amount) || 0;
    let effectiveTaxRate = 0;
    if (saleTaxAmount > 0 && (sale.subtotal || sale.total)) {
      if (sale.tax_rate && sale.tax_rate > 0) {
        effectiveTaxRate = sale.tax_rate;
      } else {
        const base = sale.subtotal > 0 ? sale.subtotal : sale.total;
        effectiveTaxRate = Math.round(((saleTaxAmount / base) * 100) * 100) / 100;
      }
    }

    let proratedRefundUnitPrice = item.sell_price;

    if (options?.customUnitPrice !== undefined && options.customUnitPrice >= 0) {
      const customUnit = Number(options.customUnitPrice);
      const totalLineRefund = Math.round(customUnit * returnQty * 100) / 100;
      let lineRefundSubtotal = totalLineRefund;
      let taxPortion = 0;

      if (effectiveTaxRate > 0) {
        lineRefundSubtotal = Math.round((totalLineRefund / (1 + effectiveTaxRate / 100)) * 100) / 100;
        taxPortion = Math.round((totalLineRefund - lineRefundSubtotal) * 100) / 100;
      }

      return {
        unitDiscount: Math.max(0, Math.round((item.sell_price - customUnit) * 100) / 100),
        refundUnitPrice: customUnit,
        lineRefundSubtotal,
        taxPortion,
        totalLineRefund,
        effectiveTaxRate
      };
    } else if (options?.fullPriceRefund) {
      // Full retail/selling price as originally sold
      proratedRefundUnitPrice = item.sell_price;
    } else {
      const baseRefundUnitPrice = Math.max(0, item.sell_price - unitDiscount);

      // Factor in proportional invoice-level discount (excluding line discounts to prevent double deduction)
      const originalSubtotal = sale.subtotal || sale.total;
      const totalLineDiscounts = (sale.items || []).reduce((acc, curr) => acc + (curr.discount || 0), 0);
      const invoiceDiscount = Math.max(0, (sale.discount || 0) - totalLineDiscounts);

      const overallDiscountRatio = (originalSubtotal > 0 && invoiceDiscount > 0) 
        ? (invoiceDiscount / originalSubtotal) 
        : 0;

      proratedRefundUnitPrice = Math.round((baseRefundUnitPrice * (1 - overallDiscountRatio)) * 100) / 100;
    }

    // Determine if the original sale was tax-inclusive
    const isInclusiveSale = saleTaxAmount > 0 && Math.abs((sale.subtotal || 0) - (sale.total || 0)) < 0.5;

    let lineRefundSubtotal = 0;
    let taxPortion = 0;
    let totalLineRefund = 0;

    if (effectiveTaxRate <= 0) {
      // NO TAX AT TIME OF SELLING:
      // Refund is 100% real selling price of product with ZERO tax returned
      lineRefundSubtotal = Math.round(proratedRefundUnitPrice * returnQty * 100) / 100;
      taxPortion = 0;
      totalLineRefund = lineRefundSubtotal;
    } else if (isInclusiveSale) {
      // In tax-inclusive sales, proratedRefundUnitPrice represents the gross price paid by the customer
      totalLineRefund = Math.round(proratedRefundUnitPrice * returnQty * 100) / 100;
      lineRefundSubtotal = Math.round((totalLineRefund / (1 + effectiveTaxRate / 100)) * 100) / 100;
      taxPortion = Math.round((totalLineRefund - lineRefundSubtotal) * 100) / 100;
    } else {
      // In tax-exclusive sales, proratedRefundUnitPrice is the net price, and tax is added on top
      lineRefundSubtotal = Math.round(proratedRefundUnitPrice * returnQty * 100) / 100;
      taxPortion = Math.round((lineRefundSubtotal * (effectiveTaxRate / 100)) * 100) / 100;
      totalLineRefund = Math.round((lineRefundSubtotal + taxPortion) * 100) / 100;
    }

    return {
      unitDiscount: Math.round(unitDiscount * 100) / 100,
      refundUnitPrice: proratedRefundUnitPrice,
      lineRefundSubtotal,
      taxPortion,
      totalLineRefund,
      effectiveTaxRate
    };
  }

  /**
   * Execute full product return, inventory restock, financial refund, shift register adjustment,
   * loyalty points reversal, and store credit generation
   */
  static async processReturn(input: ProcessReturnInput): Promise<ReturnProcessResult> {
    try {
      const { originalSale, itemsToReturn, refundMethod, notes, cashierName, approvedBy, settings, fullPriceRefund } = input;

      const validItems = itemsToReturn.filter(i => i.returnQty > 0);
      if (validItems.length === 0) {
        return { success: false, message: 'Please select at least one item and quantity to return.' };
      }

      // 1. Validate return quantities against original sale
      for (const req of validItems) {
        const alreadyReturned = req.item.returned_qty || 0;
        const maxAvailable = req.item.quantity - alreadyReturned;
        if (req.returnQty > maxAvailable) {
          return { 
            success: false, 
            message: `Cannot return ${req.returnQty}x "${req.item.name}". Only ${maxAvailable} available to return.` 
          };
        }
      }

      // 2. Compute Return Line Items & Totals
      const returnNo = StorageService.getNextReturnNo();
      let subtotalRefund = 0;
      let totalTaxRefund = 0;
      let restockedCount = 0;
      let damagedCount = 0;

      const processedReturnItems: ReturnItem[] = validItems.map(req => {
        const breakdown = this.calculateItemRefundBreakdown(req.item, req.returnQty, originalSale, {
          fullPriceRefund: fullPriceRefund ?? true,
          customUnitPrice: req.customRefundUnitPrice
        });
        subtotalRefund += breakdown.lineRefundSubtotal;
        totalTaxRefund += breakdown.taxPortion;

        if (req.condition === 'RESTOCK_SELLABLE') {
          restockedCount += req.returnQty;
        } else {
          damagedCount += req.returnQty;
        }

        return {
          product_id: req.item.product_id,
          barcode: req.item.barcode,
          name: req.item.name,
          return_quantity: req.returnQty,
          original_quantity: req.item.quantity,
          sold_unit_price: req.item.sell_price,
          unit_discount: breakdown.unitDiscount,
          refund_unit_price: Math.round((breakdown.totalLineRefund / req.returnQty) * 100) / 100,
          refund_line_total: breakdown.totalLineRefund,
          condition: req.condition,
          reason: req.reason,
          custom_reason: req.customReason
        };
      });

      const originalSaleTaxAmount = Number(originalSale.tax_amount) || 0;
      if (originalSaleTaxAmount <= 0) {
        totalTaxRefund = 0;
      }
      let totalRefundAmount = Math.round((subtotalRefund + totalTaxRefund) * 100) / 100;

      // 3. Handle Store Credit Generation if selected
      let storeCreditCoupon: Coupon | undefined;
      let storeCreditCode: string | undefined;
      let storeCreditValidUntil: string | undefined;

      if (refundMethod === 'Store_Credit') {
        const codeSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
        storeCreditCode = `SC-${codeSuffix}`;
        const validDate = new Date();
        validDate.setFullYear(validDate.getFullYear() + 1); // 1-year store credit validity
        storeCreditValidUntil = validDate.toISOString().split('T')[0];

        storeCreditCoupon = {
          id: `coupon_sc_${Date.now()}`,
          code: storeCreditCode,
          discount_type: 'AMOUNT',
          discount_value: totalRefundAmount,
          min_subtotal: totalRefundAmount,
          expiry_date: storeCreditValidUntil,
          is_active: true
        };

        const existingCoupons = StorageService.getCoupons();
        existingCoupons.push(storeCreditCoupon);
        StorageService.saveCoupons(existingCoupons);
      }

      // 4. Calculate Customer Loyalty Points Reversal
      let pointsDeducted = 0;
      if (originalSale.customer_id && originalSale.customer_id !== 'cust_walkin') {
        const customers = StorageService.getCustomers();
        const customer = customers.find(c => c.id === originalSale.customer_id);
        if (customer) {
          // Standard rate: 1 point per 100 currency units
          pointsDeducted = Math.floor(subtotalRefund / 100);
          if (pointsDeducted > 0) {
            customer.points = Math.max(0, (customer.points || 0) - pointsDeducted);
            if (!customer.points_history) customer.points_history = [];
            customer.points_history.unshift({
              id: `log_pt_${Date.now()}`,
              date: new Date().toISOString(),
              type: 'REDEEMED',
              points: -pointsDeducted,
              note: `Points reversed for Return ${returnNo} (Invoice ${originalSale.invoice_no})`,
              user: cashierName
            });
            StorageService.saveCustomers(customers);
          }
        }
      }

      // 5. Build and Save Return Transaction Record
      const returnTx: ReturnTransaction = {
        id: `ret_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
        return_no: returnNo,
        original_sale_id: originalSale.id,
        original_invoice_no: originalSale.invoice_no,
        datetime: new Date().toISOString(),
        cashier_name: cashierName,
        customer_id: originalSale.customer_id,
        customer_name: originalSale.customer_name,
        customer_phone: originalSale.customer_phone,
        items: processedReturnItems,
        items_count: processedReturnItems.reduce((acc, curr) => acc + curr.return_quantity, 0),
        subtotal_refund: subtotalRefund,
        tax_refund: totalTaxRefund,
        total_refund_amount: totalRefundAmount,
        refund_method: refundMethod,
        store_credit_code: storeCreditCode,
        store_credit_valid_until: storeCreditValidUntil,
        restocked_items_count: restockedCount,
        damaged_items_count: damagedCount,
        points_deducted: pointsDeducted,
        notes: notes || '',
        approved_by: approvedBy || (cashierName.includes('Admin') ? cashierName : undefined),
        status: 'COMPLETED'
      };

      StorageService.addReturn(returnTx);

      // 6. Update Product Catalog Stock & Log Stock History
      const products = StorageService.getProducts();
      let productsUpdated = false;

      for (const retItem of processedReturnItems) {
        const prodIndex = products.findIndex(p => p.id === retItem.product_id || p.barcode === retItem.barcode);
        
        if (retItem.condition === 'RESTOCK_SELLABLE') {
          if (prodIndex >= 0) {
            products[prodIndex].stock_qty = (products[prodIndex].stock_qty || 0) + retItem.return_quantity;
            productsUpdated = true;
          }

          // Write to Stock Ledger
          const historyItem: StockHistoryItem = {
            id: `stock_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
            product_id: retItem.product_id,
            product_name: retItem.name,
            type: 'RETURN_RESTOCK',
            qty_change: retItem.return_quantity,
            new_qty: prodIndex >= 0 ? products[prodIndex].stock_qty : retItem.return_quantity,
            date: new Date().toISOString(),
            note: `Returned to shelf from Inv #${originalSale.invoice_no} (${returnNo}) - Reason: ${retItem.reason}`,
            user_name: cashierName
          };
          StorageService.addStockHistory(historyItem);
        } else {
          // Damaged or Expired item write-off (do NOT increment sellable stock, but log audit)
          const historyItem: StockHistoryItem = {
            id: `stock_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
            product_id: retItem.product_id,
            product_name: retItem.name,
            type: 'DAMAGED_WRITE_OFF',
            qty_change: 0,
            new_qty: prodIndex >= 0 ? products[prodIndex].stock_qty : 0,
            date: new Date().toISOString(),
            note: `Damaged/Defective item written off from Inv #${originalSale.invoice_no} (${returnNo}) - Condition: ${retItem.condition}`,
            user_name: cashierName
          };
          StorageService.addStockHistory(historyItem);
        }
      }

      if (productsUpdated) {
        StorageService.saveProducts(products);
      }

      // 7. Update Shift Register for Cash Refunds & Trigger Cash Drawer
      if (refundMethod === 'Cash') {
        const shifts = StorageService.getShifts();
        const activeShift = shifts.find(s => s.status === 'OPEN');
        if (activeShift) {
          activeShift.refunds = (activeShift.refunds || 0) + totalRefundAmount;
          activeShift.expected_cash = (activeShift.expected_cash || 0) - totalRefundAmount;
          StorageService.saveShifts(shifts);
        }

        // Pop cash drawer
        try {
          EscPosService.triggerCashDrawer();
        } catch (e) {
          console.warn('Could not pulse cash drawer:', e);
        }
      }

      // 8. Update Original Sale Record
      const sales = StorageService.getSales();
      const saleIndex = sales.findIndex(s => s.id === originalSale.id);
      
      let updatedSale: Sale;
      if (saleIndex >= 0) {
        updatedSale = { ...sales[saleIndex] };
      } else {
        updatedSale = { ...originalSale };
      }

      // Update returned_qty on each sale item
      updatedSale.items = updatedSale.items.map(item => {
        const matched = processedReturnItems.find(r => r.product_id === item.product_id || r.barcode === item.barcode);
        if (matched) {
          return {
            ...item,
            returned_qty: (item.returned_qty || 0) + matched.return_quantity
          };
        }
        return item;
      });

      // Track returned items list & total refunded
      if (!updatedSale.returned_items) updatedSale.returned_items = [];
      updatedSale.returned_items.push(...processedReturnItems);
      updatedSale.total_refunded = (updatedSale.total_refunded || 0) + totalRefundAmount;

      // Determine if fully refunded or partially refunded
      const totalSoldUnits = updatedSale.items.reduce((acc, curr) => acc + curr.quantity, 0);
      const totalReturnedUnits = updatedSale.items.reduce((acc, curr) => acc + (curr.returned_qty || 0), 0);

      if (totalReturnedUnits >= totalSoldUnits) {
        updatedSale.status = 'refunded';
      } else {
        updatedSale.status = 'partially_refunded';
      }

      updatedSale.return_note = `Return ${returnNo} processed on ${new Date().toLocaleDateString()} (${settings.currency_symbol || 'Rs.'} ${totalRefundAmount})`;

      if (saleIndex >= 0) {
        sales[saleIndex] = updatedSale;
        StorageService.saveSales(sales);
      }

      // 9. Add System Notification & High Refund Alert
      const notif: AppNotification = {
        id: `notif_${Date.now()}`,
        title: `🔄 Return ${returnNo} Processed`,
        message: `Refund of ${settings.currency_symbol || 'Rs.'} ${totalRefundAmount.toLocaleString()} via ${refundMethod} for Invoice #${originalSale.invoice_no} (${restockedCount} restocked, ${damagedCount} damaged).`,
        severity: 'info',
        timestamp: new Date().toISOString(),
        read: false,
        category: 'finance'
      };
      StorageService.addNotification(notif);

      if (totalRefundAmount >= 5000) {
        const alert: FraudAlert = {
          id: `fraud_${Date.now()}`,
          timestamp: new Date().toISOString(),
          type: 'UNUSUAL_REFUND',
          description: `High refund amount of ${settings.currency_symbol || 'Rs.'} ${totalRefundAmount.toLocaleString()} on Invoice #${originalSale.invoice_no} by ${cashierName}`,
          cashier: cashierName,
          status: 'PENDING_REVIEW'
        };
        StorageService.addFraudAlert(alert);
      }

      // 10. Background Cloud Synchronization
      MongoDbService.saveSale(updatedSale).catch(err => {
        console.warn('MongoDB updated sale sync notice:', err);
      });

      if (settings.google_spreadsheet_id) {
        WorkspaceService.exportProductsToSheet(settings.google_spreadsheet_id, products).catch(err => {
          console.warn('Google Sheet product restock sync notice:', err);
        });
        WorkspaceService.exportSalesToSheet(settings.google_spreadsheet_id, StorageService.getSales()).catch(err => {
          console.warn('Google Sheet updated sale sync notice:', err);
        });
      }

      if (settings.gas_web_app_url) {
        ApiService.postToGas(settings.gas_web_app_url, {
          action: 'saveReturn',
          data: returnTx
        }).catch(err => {
          console.warn('Background sync return to Google Sheet error:', err);
        });
      }

      if (settings.mongodb_config?.enabled) {
        MongoDbService.syncSaleToMongo(settings.mongodb_config, updatedSale).catch(err => {
          console.warn('Background sync return to MongoDB Atlas error:', err);
        });
      }

      return {
        success: true,
        message: `✅ Return ${returnNo} processed successfully! Refund amount: ${settings.currency_symbol || 'Rs.'} ${totalRefundAmount.toLocaleString()}`,
        returnTx,
        storeCreditCoupon,
        updatedSale
      };

    } catch (err: any) {
      console.error('Error processing return:', err);
      return {
        success: false,
        message: `Failed to process return: ${err.message || 'Unknown error'}`
      };
    }
  }
}

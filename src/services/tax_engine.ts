import { ShopSettings, CartItem, SaleItem } from '../types';

export interface TaxCalculationResult {
  subtotalNet: number;
  taxAmount: number;
  totalInclusive: number;
  appliedTaxRate: number;
  taxMode: 'INCLUSIVE' | 'EXCLUSIVE';
  itemTaxBreakdown: {
    productId: string;
    productName: string;
    lineSubtotal: number;
    lineTax: number;
    isExempt: boolean;
  }[];
}

export class TaxEngineService {
  /**
   * Formats currency according to store settings
   */
  static formatCurrency(
    amount: number, 
    settings: ShopSettings
  ): string {
    const symbol = settings.currency_symbol || 'Rs.';
    const decimals = settings.decimal_places ?? 2;
    const formattedNum = (amount || 0).toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    return `${symbol} ${formattedNum}`;
  }

  /**
   * Centralized tax computation engine for cart and receipts
   */
  static calculateCartTax(
    cartItems: CartItem[], 
    settings: ShopSettings
  ): TaxCalculationResult {
    const defaultTaxRate = settings.tax_rate ?? 16; // e.g. 16% standard tax in Pakistan
    const taxMode = settings.tax_mode || 'EXCLUSIVE';
    const exemptCategories = new Set(settings.tax_exempt_categories || []);
    const categoryRates = settings.category_tax_rates || {};

    let totalNet = 0;
    let totalTax = 0;

    const breakdown = cartItems.map(item => {
      const lineTotal = item.line_total;
      const category = item.product.category || '';
      
      // Determine effective tax rate hierarchy:
      // 1. Explicit product exemption -> 0%
      // 2. Explicit product custom tax rate -> item.product.tax_rate
      // 3. Category exemption -> 0%
      // 4. Category-specific tax rate -> categoryRates[category]
      // 5. Default store tax rate -> defaultTaxRate
      let effectiveRate = defaultTaxRate;
      let isExempt = false;

      if (item.product.is_tax_exempt) {
        effectiveRate = 0;
        isExempt = true;
      } else if (item.product.tax_rate !== undefined && item.product.tax_rate !== null && item.product.tax_rate >= 0) {
        effectiveRate = item.product.tax_rate;
        isExempt = effectiveRate === 0;
      } else if (exemptCategories.has(category)) {
        effectiveRate = 0;
        isExempt = true;
      } else if (categoryRates[category] !== undefined && categoryRates[category] !== null) {
        effectiveRate = categoryRates[category];
        isExempt = effectiveRate === 0;
      }

      let lineNet = 0;
      let lineTax = 0;

      if (effectiveRate === 0 || isExempt) {
        lineNet = lineTotal;
        lineTax = 0;
      } else if (taxMode === 'INCLUSIVE') {
        // Price includes tax: Net = Total / (1 + TaxRate/100)
        lineNet = lineTotal / (1 + effectiveRate / 100);
        lineTax = lineTotal - lineNet;
      } else {
        // Price excludes tax: Net = LineTotal, Tax = LineTotal * (TaxRate/100)
        lineNet = lineTotal;
        lineTax = lineTotal * (effectiveRate / 100);
      }

      totalNet += lineNet;
      totalTax += lineTax;

      return {
        productId: item.product.id,
        productName: item.product.name,
        lineSubtotal: lineNet,
        lineTax: lineTax,
        appliedRate: effectiveRate,
        isExempt,
      };
    });

    const grandTotal = taxMode === 'INCLUSIVE' ? totalNet + totalTax : totalNet + totalTax;

    return {
      subtotalNet: totalNet,
      taxAmount: totalTax,
      totalInclusive: grandTotal,
      appliedTaxRate: defaultTaxRate,
      taxMode,
      itemTaxBreakdown: breakdown,
    };
  }
}

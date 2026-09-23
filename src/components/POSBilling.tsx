import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Search, 
  Barcode, 
  Plus, 
  Minus, 
  Trash2, 
  UserPlus, 
  CreditCard, 
  Banknote, 
  Printer, 
  RotateCcw, 
  Sparkles,
  AlertTriangle,
  CheckCircle,
  Tag,
  Percent,
  DollarSign
} from 'lucide-react';
import { Product, CartItem, Customer, ShopSettings, PaymentMethod, Sale, Coupon, DiscountAuditLog, Category } from '../types';
import { useBarcodeScanner } from '../services/barcode';
import { EscPosService } from '../services/escpos';
import { CardTerminalModal } from './CardTerminalModal';
import { CustomerDisplayModal } from './CustomerDisplayModal';
import { InventorySyncService } from '../services/inventory_sync_service';
import { HardwareManager } from '../services/hardwareManager';
import { StorageService } from '../services/storage';
import { TaxEngineService } from '../services/tax_engine';

interface POSBillingProps {
  products: Product[];
  categoriesList?: Category[];
  customers: Customer[];
  settings: ShopSettings;
  onCheckout: (sale: Sale) => void;
  onAddCustomer: (customer: Customer) => void;
  onOpenReturnModal?: () => void;
}

export const POSBilling: React.FC<POSBillingProps> = ({
  products,
  categoriesList = [],
  customers,
  settings,
  onCheckout,
  onAddCustomer,
  onOpenReturnModal,
}) => {
  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);

  // Cart State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer>(
    customers.find(c => c.id === 'cust_walkin') || customers[0] || { id: 'cust_walkin', name: 'Walk-in Customer', phone: '00000000000', email: '', points: 0 }
  );
  const [overallDiscountType, setOverallDiscountType] = useState<'fixed' | 'percent'>('fixed');
  const [overallDiscountValue, setOverallDiscountValue] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [amountPaid, setAmountPaid] = useState<number | string>('');

  // Multi-Level Discounts & Loyalty State
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [couponInputCode, setCouponInputCode] = useState('');
  const [couponMsg, setCouponMsg] = useState<{ text: string; isError: boolean } | null>(null);
  const [redeemedPoints, setRedeemedPoints] = useState<number>(0);

  // Manager Discount Approval Modal
  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);
  const [managerPin, setManagerPin] = useState('');
  const [approvalReason, setApprovalReason] = useState('');
  const [approvalError, setApprovalError] = useState('');
  const [pendingSale, setPendingSale] = useState<Sale | null>(null);

  // Modals & UI States
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isCustomerDisplayOpen, setIsCustomerDisplayOpen] = useState(false);
  const [isCardTerminalModalOpen, setIsCardTerminalModalOpen] = useState(false);
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustEmail, setNewCustEmail] = useState('');
  const [lastCompletedSale, setLastCompletedSale] = useState<Sale | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Extract unique categories respecting configured categories and display order
  const categories = useMemo(() => {
    const configuredNames = (categoriesList || [])
      .filter(c => c.status === 'ACTIVE')
      .sort((a, b) => (a.display_order ?? 99) - (b.display_order ?? 99))
      .map(c => c.name);
    return Array.from(new Set(['All', ...configuredNames, ...products.map(p => p.category).filter(Boolean)]));
  }, [categoriesList, products]);

  // Quick Barcode Scan Hook
  useBarcodeScanner((scannedBarcode) => {
    const matchedProduct = products.find(
      p => p.barcode === scannedBarcode || p.id === scannedBarcode
    );
    if (matchedProduct) {
      addToCart(matchedProduct);
    } else {
      alert(`Barcode "${scannedBarcode}" not found in Product Catalog!`);
    }
  });

  // Global Keyboard Shortcuts (F1, F2, F4, F8, ESC)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // F1: Focus Cart / New Sale
      if (e.key === 'F1') {
        e.preventDefault();
        clearCart();
      }
      // F2: Search Product
      if (e.key === 'F2') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
      // F4: Payment Checkout
      if (e.key === 'F4') {
        e.preventDefault();
        if (cart.length > 0) {
          setIsCheckoutOpen(true);
        }
      }
      // F6: Return / Refund Modal
      if (e.key === 'F6' && onOpenReturnModal) {
        e.preventDefault();
        onOpenReturnModal();
      }
      // F8: Direct Print Bill
      if (e.key === 'F8') {
        e.preventDefault();
        if (cart.length > 0) {
          triggerDirectCheckout();
        }
      }
      // ESC: Clear Cart or Close Modal
      if (e.key === 'Escape') {
        if (isCheckoutOpen) {
          setIsCheckoutOpen(false);
        } else if (isAddCustomerOpen) {
          setIsAddCustomerOpen(false);
        } else {
          clearCart();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart, isCheckoutOpen, isAddCustomerOpen]);

  // Cart Functions
  const addToCart = (product: Product) => {
    if (product.stock_qty <= 0) {
      alert(`"${product.name}" is OUT OF STOCK!`);
      return;
    }

    EscPosService.playScanBeep();

    setCart(prev => {
      const existingIndex = prev.findIndex(item => item.product.id === product.id);
      if (existingIndex >= 0) {
        const item = prev[existingIndex];
        const newQty = item.quantity + 1;
        if (newQty > product.stock_qty) {
          alert(`Cannot add more than available stock (${product.stock_qty})!`);
          return prev;
        }
        const updated = [...prev];
        const unitPrice = product.sell_price;
        const lineTotal = newQty * unitPrice - item.discount_amount;
        updated[existingIndex] = {
          ...item,
          quantity: newQty,
          line_total: Math.max(0, lineTotal),
        };
        return updated;
      } else {
        return [
          ...prev,
          {
            product,
            quantity: 1,
            discount_percent: 0,
            discount_amount: 0,
            final_unit_price: product.sell_price,
            line_total: product.sell_price,
          }
        ];
      }
    });
  };

  const updateUnitPrice = (productId: string, newUnitPrice: number) => {
    setCart(prev => {
      return prev.map(item => {
        if (item.product.id === productId) {
          const effectivePrice = Math.max(0, Number(newUnitPrice) || 0);
          const lineTotal = (item.quantity * effectivePrice) - (item.discount_amount || 0);
          return {
            ...item,
            custom_unit_price: effectivePrice,
            final_unit_price: effectivePrice,
            line_total: Math.max(0, lineTotal),
          };
        }
        return item;
      });
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(prev => {
      return prev.map(item => {
        if (item.product.id === productId) {
          const newQty = item.quantity + delta;
          if (newQty <= 0) return null;
          if (newQty > item.product.stock_qty) {
            alert(`Stock limit reached (${item.product.stock_qty})`);
            return item;
          }
          const unitPrice = item.custom_unit_price !== undefined ? item.custom_unit_price : item.product.sell_price;
          const lineTotal = (newQty * unitPrice) - item.discount_amount;
          return {
            ...item,
            quantity: newQty,
            line_total: Math.max(0, lineTotal)
          };
        }
        return item;
      }).filter(Boolean) as CartItem[];
    });
  };

  const updateLineDiscount = (productId: string, discountVal: number) => {
    setCart(prev => {
      return prev.map(item => {
        if (item.product.id === productId) {
          const disc = Math.max(0, discountVal);
          const unitPrice = item.custom_unit_price !== undefined ? item.custom_unit_price : item.product.sell_price;
          const lineTotal = (item.quantity * unitPrice) - disc;
          return {
            ...item,
            discount_amount: disc,
            line_total: Math.max(0, lineTotal)
          };
        }
        return item;
      });
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(i => i.product.id !== productId));
  };

  const clearCart = () => {
    setCart([]);
    setOverallDiscountValue(0);
    setAppliedCoupon(null);
    setCouponInputCode('');
    setCouponMsg(null);
    setRedeemedPoints(0);
    setAmountPaid('');
  };

  // Coupon Code Handler
  const handleApplyCouponCode = () => {
    if (!couponInputCode.trim()) return;
    const coupons = StorageService.getCoupons();
    const found = coupons.find(c => (c.code || '').toUpperCase() === (couponInputCode || '').trim().toUpperCase() && c.is_active);

    if (!found) {
      setCouponMsg({ text: 'Invalid or expired coupon code!', isError: true });
      return;
    }

    const minSpend = found.min_subtotal || 0;
    if (rawSubtotal < minSpend) {
      setCouponMsg({ text: `Minimum spend for ${found.code} is Rs ${minSpend}`, isError: true });
      return;
    }

    setAppliedCoupon(found);
    setCouponMsg({ text: `Coupon ${found.code} applied!`, isError: false });
  };

  // Calculations
  const rawSubtotal = cart.reduce((sum, item) => {
    const unitPrice = item.custom_unit_price !== undefined ? item.custom_unit_price : item.product.sell_price;
    return sum + (item.quantity * unitPrice);
  }, 0);
  const lineDiscountsTotal = cart.reduce((sum, item) => sum + (item.discount_amount || 0), 0);
  const subtotalAfterLineDiscounts = Math.max(0, rawSubtotal - lineDiscountsTotal);

  let overallDiscountAmt = 0;
  if (overallDiscountType === 'fixed') {
    overallDiscountAmt = Math.min(subtotalAfterLineDiscounts, Number(overallDiscountValue) || 0);
  } else {
    overallDiscountAmt = Math.min(subtotalAfterLineDiscounts, (subtotalAfterLineDiscounts * (Number(overallDiscountValue) || 0)) / 100);
  }

  // Coupon Discount
  let couponDiscountAmt = 0;
  if (appliedCoupon) {
    if (appliedCoupon.discount_type === 'PERCENT') {
      const calc = (subtotalAfterLineDiscounts * appliedCoupon.discount_value) / 100;
      couponDiscountAmt = appliedCoupon.max_discount ? Math.min(calc, appliedCoupon.max_discount) : calc;
    } else {
      couponDiscountAmt = Math.min(subtotalAfterLineDiscounts, appliedCoupon.discount_value);
    }
  }

  // Loyalty Points Discount (1 pt = 1 PKR)
  const remainingBeforeLoyalty = Math.max(0, subtotalAfterLineDiscounts - overallDiscountAmt - couponDiscountAmt);
  const loyaltyDiscountAmt = Math.min(remainingBeforeLoyalty, redeemedPoints);

  const totalDiscountAmount = lineDiscountsTotal + overallDiscountAmt + couponDiscountAmt + loyaltyDiscountAmt;
  const netSubtotal = Math.max(0, rawSubtotal - totalDiscountAmount);

  // Tax calculation supporting Exclusive and Inclusive modes, per-product overrides & categories
  const taxCalcResult = TaxEngineService.calculateCartTax(cart, settings);
  const isTaxInclusive = settings.tax_mode === 'INCLUSIVE';
  let taxAmount = 0;
  let grandTotal = 0;

  if (isTaxInclusive) {
    taxAmount = taxCalcResult.taxAmount;
    grandTotal = Math.round(netSubtotal);
  } else {
    // If discounts apply globally, scale tax proportionally
    const discountRatio = rawSubtotal > 0 ? netSubtotal / rawSubtotal : 1;
    taxAmount = Math.round(taxCalcResult.taxAmount * discountRatio * 100) / 100;
    grandTotal = Math.round(netSubtotal + taxAmount);
  }

  const numericPaid = Number(amountPaid) || grandTotal;
  const changeDue = Math.max(0, numericPaid - grandTotal);

  // Memoized Filtered Products for ultra-responsive search & catalog browsing
  const filteredProducts = useMemo(() => {
    if (!products || products.length === 0) return [];
    const q = searchQuery.trim().toLowerCase();
    return products.filter(p => {
      const matchesSearch = !q ||
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.barcode && p.barcode.toLowerCase().includes(q)) ||
        (p.category && p.category.toLowerCase().includes(q));

      const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
      const matchesStock = !showLowStockOnly || (p.stock_qty <= (p.min_stock_alert || 5));

      return matchesSearch && matchesCategory && matchesStock;
    });
  }, [products, searchQuery, selectedCategory, showLowStockOnly]);

  const [visibleLimit, setVisibleLimit] = useState(48);

  useEffect(() => {
    setVisibleLimit(48);
  }, [searchQuery, selectedCategory, showLowStockOnly]);

  const displayedProducts = useMemo(() => {
    return filteredProducts.slice(0, visibleLimit);
  }, [filteredProducts, visibleLimit]);

  // Finalize Sale Completion
  const executeFinalCheckout = async (sale: Sale) => {
    // Process Atomic Stock Deduction & FIFO Ledger Logging
    await InventorySyncService.processSaleDeduction(
      sale.items,
      sale.invoice_no,
      sale.cashier_name || 'Cashier'
    );

    // Enqueue Async Print Job
    HardwareManager.getInstance().enqueueJob('printer', 'print_receipt', { sale, settings }, 'high');

    onCheckout(sale);
    setLastCompletedSale(sale);
    clearCart();
    setIsCheckoutOpen(false);
    setIsCardTerminalModalOpen(false);
  };

  // Direct Quick Checkout handler with Manager Discount Approval check
  const triggerDirectCheckout = (approvedManager?: string | unknown, reason?: string | unknown) => {
    const validManager = typeof approvedManager === 'string' ? approvedManager : undefined;
    const validReason = typeof reason === 'string' ? reason : undefined;
    const activeUser = StorageService.getActiveUser();

    // Calculate manual discount percentage
    const manualDiscountPercent = subtotalAfterLineDiscounts > 0 ? (overallDiscountAmt / subtotalAfterLineDiscounts) * 100 : 0;
    
    // Check role limit: Cashier is capped at 15% manual discount unless approved by manager
    if (activeUser?.role === 'cashier' && manualDiscountPercent > 15 && !validManager) {
      setIsApprovalModalOpen(true);
      return;
    }

    // Record Discount Audit Log if discount applied
    if (totalDiscountAmount > 0) {
      const log: DiscountAuditLog = {
        id: `disc_${Date.now()}`,
        timestamp: new Date().toISOString(),
        invoice_no: `INV-${Date.now()}`,
        discount_type: appliedCoupon ? 'coupon' : (redeemedPoints > 0 ? 'loyalty' : 'manual'),
        discount_amount: totalDiscountAmount,
        reason: validReason || (appliedCoupon ? `Coupon Code: ${appliedCoupon.code}` : 'Promotional Discount'),
        cashier: activeUser?.name || 'Cashier Desk',
        approved_by: validManager || activeUser?.name || 'Authorized Staff'
      };
      StorageService.addDiscountLog(log);
    }

    const invoiceNo = `INV-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Math.floor(1000 + Math.random() * 9000)}`;
    const sale: Sale = {
      id: `sale_${Date.now()}`,
      invoice_no: invoiceNo,
      datetime: new Date().toISOString(),
      customer_id: selectedCustomer.id,
      customer_name: selectedCustomer.name,
      customer_phone: selectedCustomer.phone,
      subtotal: rawSubtotal,
      tax_rate: settings.tax_rate || 0,
      tax_amount: taxAmount,
      discount: totalDiscountAmount,
      total: grandTotal,
      paid: numericPaid,
      change_due: changeDue,
      payment_method: paymentMethod,
      cashier_name: activeUser.name || 'Store Cashier',
      status: 'completed',
      items: cart.map(item => {
        const unitPrice = item.custom_unit_price !== undefined ? item.custom_unit_price : item.product.sell_price;
        return {
          product_id: item.product.id,
          barcode: item.product.barcode,
          name: item.product.name,
          quantity: item.quantity,
          buy_price: item.product.buy_price,
          sell_price: unitPrice,
          discount: item.discount_amount,
          total: item.line_total
        };
      })
    };

    if (paymentMethod === 'Card') {
      setIsCheckoutOpen(false);
      setIsCardTerminalModalOpen(true);
    } else {
      executeFinalCheckout(sale);
    }
  };

  // Submit Manager Discount PIN Approval
  const handleManagerApproval = (e: React.FormEvent) => {
    e.preventDefault();
    if (managerPin === 'Usman@Ali513' || managerPin === '123456' || managerPin === 'admin' || managerPin === '1234') {
      setIsApprovalModalOpen(false);
      setApprovalError('');
      const reasonText = approvalReason || 'Manager High Discount Authorization';
      setApprovalReason('');
      setManagerPin('');
      triggerDirectCheckout('Admin Manager', reasonText);
    } else {
      setApprovalError('Invalid Manager Security PIN!');
    }
  };

  // Add Customer Submit
  const handleCreateCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustName.trim()) return;

    const newCust: Customer = {
      id: `cust_${Date.now()}`,
      name: newCustName.trim(),
      phone: newCustPhone.trim() || '00000000000',
      email: newCustEmail.trim() || '',
      points: 0,
      total_spent: 0,
      last_visit: new Date().toISOString().split('T')[0]
    };

    onAddCustomer(newCust);
    setSelectedCustomer(newCust);
    setNewCustName('');
    setNewCustPhone('');
    setNewCustEmail('');
    setIsAddCustomerOpen(false);
  };

  return (
    <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-6 py-3 select-none">
      
      {/* Shortcut Guidance Bar */}
      <div className="bg-blue-50 border border-blue-200 text-[#0f6cbd] px-3 py-1.5 rounded-md mb-3 flex flex-wrap items-center justify-between text-xs font-semibold gap-2">
        <div className="flex items-center space-x-2">
          <span className="bg-[#0f6cbd] text-white px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wide">
            POS Terminal Active
          </span>
          <span className="hidden sm:inline">USB Barcode Scanner Ready (Scan item anytime to add)</span>
        </div>
        <div className="flex items-center space-x-2 text-[11px]">
          {onOpenReturnModal && (
            <button
              type="button"
              onClick={() => onOpenReturnModal()}
              className="bg-rose-700 hover:bg-rose-800 text-white px-2.5 py-1 rounded font-extrabold shadow-xs transition flex items-center space-x-1 cursor-pointer"
            >
              <span>🔄 Return / Refund</span>
              <kbd className="bg-rose-900/60 px-1 py-0.2 rounded text-[9px] font-mono">F6</kbd>
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsCustomerDisplayOpen(true)}
            className="bg-[#0f6cbd] text-white hover:bg-[#115ea3] px-2 py-0.5 rounded font-bold shadow-xs transition"
          >
            🖥️ Secondary Display
          </button>
          <span><kbd className="bg-white border border-slate-300 px-1 rounded shadow-xs font-mono text-slate-700">F1</kbd> New</span>
          <span><kbd className="bg-white border border-slate-300 px-1 rounded shadow-xs font-mono text-slate-700">F2</kbd> Find</span>
          <span><kbd className="bg-white border border-slate-300 px-1 rounded shadow-xs font-mono text-slate-700">F4</kbd> Pay</span>
          <span><kbd className="bg-white border border-slate-300 px-1 rounded shadow-xs font-mono text-slate-700">F8</kbd> Print</span>
          <span><kbd className="bg-white border border-slate-300 px-1 rounded shadow-xs font-mono text-slate-700">ESC</kbd> Clear</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* ================= LEFT SIDE: PRODUCT CATALOG & SEARCH ================= */}
        <div className="lg:col-span-7 flex flex-col space-y-3">
          
          {/* Search & Category Filter Bar */}
          <div className="bg-white p-3 rounded-lg shadow-xs border border-slate-200 space-y-2">
            
            <div className="flex items-center space-x-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  ref={searchInputRef}
                  data-barcode-input="true"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Scan barcode or type name/category (Press F2)..."
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-md text-sm font-medium focus:bg-white focus:ring-2 focus:ring-[#0f6cbd] focus:outline-none transition"
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 font-bold"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Low Stock Filter Button */}
              <button
                onClick={() => setShowLowStockOnly(!showLowStockOnly)}
                className={`flex items-center space-x-1.5 px-3 py-2 rounded-md text-xs font-bold transition border ${
                  showLowStockOnly 
                    ? 'bg-amber-600 text-white border-amber-700 shadow-xs' 
                    : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Low Stock</span>
              </button>
            </div>

            {/* Category Pills */}
            <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-md whitespace-nowrap font-medium transition ${
                    selectedCategory === cat
                      ? 'bg-[#0f6cbd] text-white shadow-xs font-bold'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

          </div>

          {/* Product Cards Grid */}
          <div className="bg-white p-3 rounded-lg shadow-xs border border-slate-200 flex-1 min-h-[480px] max-h-[620px] overflow-y-auto">
            {filteredProducts.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center py-16 text-slate-400">
                <Barcode className="w-12 h-12 mb-2 text-slate-300 stroke-[1.5]" />
                <p className="font-semibold text-sm">No matching cosmetic items found</p>
                <p className="text-xs text-slate-400">Try changing search query or category</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                  {displayedProducts.map((product) => {
                    const isOutOfStock = product.stock_qty <= 0;
                    const isLowStock = product.stock_qty <= (product.min_stock_alert || 5) && !isOutOfStock;

                    return (
                      <button
                        key={product.id}
                        onClick={() => addToCart(product)}
                        disabled={isOutOfStock}
                        className={`group relative text-left p-2.5 rounded-md border transition flex flex-col justify-between h-48 hover:shadow-xs ${
                          isOutOfStock
                            ? 'opacity-50 bg-slate-50 border-slate-200 cursor-not-allowed'
                            : isLowStock
                            ? 'border-amber-300 bg-amber-50/30 hover:border-amber-400'
                            : 'border-slate-200 hover:border-[#0f6cbd] bg-white'
                        }`}
                      >
                        {/* Top Image & Badges */}
                        <div className="relative w-full h-20 rounded bg-slate-100 mb-1.5 overflow-hidden">
                          <img 
                            src={product.image_url || 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=200'} 
                            alt={product.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition duration-200"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=200';
                            }}
                          />
                          {/* Stock Badge */}
                          <div className="absolute top-1 right-1">
                            {isOutOfStock ? (
                              <span className="bg-red-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-xs">
                                OUT
                              </span>
                            ) : isLowStock ? (
                              <span className="bg-amber-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-xs">
                                {product.stock_qty} left
                              </span>
                            ) : (
                              <span className="bg-[#107c41] text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-xs">
                                {product.stock_qty}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Details */}
                        <div>
                          <span className="text-[9px] font-semibold text-slate-500 uppercase tracking-tight block truncate">
                            {product.category}
                          </span>
                          <h4 className="font-bold text-xs text-slate-800 line-clamp-2 leading-tight group-hover:text-[#0f6cbd]">
                            {product.name}
                          </h4>
                          {product.shade_code && (
                            <span className="text-[10px] text-slate-500 block truncate font-medium mt-0.5">
                              {product.shade_code}
                            </span>
                          )}
                        </div>

                        {/* Price & Quick Add Button */}
                        <div className="flex items-center justify-between mt-1 pt-1 border-t border-slate-100">
                          <span className="font-bold text-xs sm:text-sm text-[#0f6cbd]">
                            {settings.currency_symbol || 'Rs'} {(product.sell_price ?? 0).toLocaleString()}
                          </span>
                          <div className="w-5 h-5 rounded bg-[#0f6cbd]/10 text-[#0f6cbd] group-hover:bg-[#0f6cbd] group-hover:text-white flex items-center justify-center transition">
                            <Plus className="w-3.5 h-3.5" />
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {filteredProducts.length > displayedProducts.length && (
                  <div className="pt-2 pb-1 flex items-center justify-between border-t border-slate-100 text-xs">
                    <span className="text-slate-500 font-medium">
                      Showing {displayedProducts.length} of {filteredProducts.length} items
                    </span>
                    <button
                      onClick={() => setVisibleLimit(prev => prev + 48)}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-[#0f6cbd] font-bold rounded transition"
                    >
                      Load More (+48 items)
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

        </div>


        {/* ================= RIGHT SIDE: CART & BILL PANEL ================= */}
        <div className="lg:col-span-5 bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between overflow-hidden">
          
          {/* Header & Customer Selection */}
          <div className="p-3 bg-slate-50 border-b border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <h3 className="font-bold text-slate-800 text-sm">Cart Terminal</h3>
                <span className="bg-blue-100 text-[#0b5fa5] text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {cart.reduce((a, b) => a + b.quantity, 0)} Items
                </span>
              </div>
              
              <button
                onClick={clearCart}
                disabled={cart.length === 0}
                className="text-xs text-red-600 hover:text-red-800 font-semibold flex items-center space-x-1 disabled:opacity-40"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Clear (ESC)</span>
              </button>
            </div>

            {/* Customer Picker */}
            <div className="flex items-center space-x-2">
              <div className="relative flex-1">
                <select
                  value={selectedCustomer.id}
                  onChange={(e) => {
                    const found = customers.find(c => c.id === e.target.value);
                    if (found) setSelectedCustomer(found);
                  }}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-[#0b5fa5] focus:outline-none"
                >
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      👤 {c.name} ({c.phone}) {c.points > 0 ? `| ${c.points} Pts` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={() => setIsAddCustomerOpen(true)}
                className="bg-[#0b5fa5] text-white p-2 rounded-xl hover:bg-[#094e88] transition"
                title="Add New Customer"
              >
                <UserPlus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Cart Table List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[260px] max-h-[340px]">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center py-12 text-slate-400">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-2">
                  <Tag className="w-6 h-6 text-slate-300" />
                </div>
                <p className="font-bold text-sm text-slate-600">Cart is empty</p>
                <p className="text-xs text-slate-400">Click products or scan barcode to add items</p>
              </div>
            ) : (
              cart.map((item) => (
                <div 
                  key={item.product.id}
                  className="bg-slate-50 hover:bg-blue-50/50 p-2.5 rounded-xl border border-slate-200 transition space-y-1.5"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 pr-2">
                      <h5 className="font-bold text-xs text-slate-800 leading-tight">
                        {item.product.name}
                      </h5>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {item.product.barcode} | Unit: {settings.currency_symbol} {item.product.sell_price}
                      </span>
                    </div>
                    <button
                      onClick={() => removeFromCart(item.product.id)}
                      className="text-slate-400 hover:text-red-600 p-1 rounded transition"
                      title="Remove item"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Quantity Controls, Price, Line Discount & Total */}
                  <div className="flex flex-wrap items-center justify-between gap-1 text-xs pt-1 border-t border-slate-200/60">
                    
                    {/* - Qty + */}
                    <div className="flex items-center space-x-1 bg-white border border-slate-300 rounded-lg p-0.5">
                      <button
                        onClick={() => updateQuantity(item.product.id, -1)}
                        className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 flex items-center justify-center font-bold text-slate-700 cursor-pointer"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-7 text-center font-extrabold text-xs text-slate-800">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.product.id, 1)}
                        className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 flex items-center justify-center font-bold text-slate-700 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Editable Unit Price */}
                    <div className="flex items-center space-x-1" title="Edit selling price for this sale / product exchange">
                      <span className="text-[10px] text-slate-500 font-bold">Price:</span>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={item.custom_unit_price !== undefined ? item.custom_unit_price : item.product.sell_price}
                        onChange={(e) => updateUnitPrice(item.product.id, Number(e.target.value))}
                        className={`w-16 px-1 py-0.5 bg-white border rounded text-center text-xs font-bold transition ${
                          item.custom_unit_price !== undefined && item.custom_unit_price !== item.product.sell_price
                            ? 'border-amber-500 text-amber-900 bg-amber-50/70'
                            : 'border-slate-300 text-slate-800'
                        }`}
                      />
                    </div>

                    {/* Line Discount Input */}
                    <div className="flex items-center space-x-1">
                      <span className="text-[10px] text-slate-400 font-semibold">Disc:</span>
                      <input
                        type="number"
                        min="0"
                        value={item.discount_amount || ''}
                        onChange={(e) => updateLineDiscount(item.product.id, Number(e.target.value))}
                        placeholder="0"
                        className="w-12 px-1 py-0.5 bg-white border border-slate-300 rounded text-center text-xs font-semibold text-slate-700"
                      />
                    </div>

                    {/* Line Total */}
                    <div className="text-right ml-auto">
                      <span className="font-extrabold text-sm text-[#0b5fa5]">
                        {settings.currency_symbol} {(item.line_total ?? 0).toLocaleString()}
                      </span>
                    </div>

                  </div>
                </div>
              ))
            )}
          </div>

          {/* Order Summary & Bill Calculations */}
          <div className="p-3 bg-slate-50 border-t border-slate-200 space-y-2">
            
            {/* Calculation Lines */}
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal ({cart.reduce((a, b) => a + b.quantity, 0)} items)</span>
                <span className="font-semibold">{settings.currency_symbol} {(subtotalAfterLineDiscounts ?? 0).toLocaleString()}</span>
              </div>

              {/* Overall Bill Discount */}
              <div className="flex items-center justify-between text-slate-600">
                <div className="flex items-center space-x-1">
                  <span>Manual Discount</span>
                  <button
                    onClick={() => setOverallDiscountType(overallDiscountType === 'fixed' ? 'percent' : 'fixed')}
                    className="bg-slate-200 text-slate-700 font-bold px-1 py-0.2 text-[10px] rounded hover:bg-slate-300"
                  >
                    {overallDiscountType === 'fixed' ? 'PKR' : '%'}
                  </button>
                </div>
                <input
                  type="number"
                  min="0"
                  value={overallDiscountValue || ''}
                  onChange={(e) => setOverallDiscountValue(Number(e.target.value))}
                  placeholder="0"
                  className="w-20 px-2 py-0.5 bg-white border border-slate-300 rounded text-right font-bold text-xs text-rose-600"
                />
              </div>

              {/* Coupon Code Input Line */}
              <div className="pt-1">
                <div className="flex items-center space-x-1">
                  <Tag className="w-3.5 h-3.5 text-[#0f6cbd]" />
                  <input
                    type="text"
                    value={couponInputCode}
                    onChange={(e) => setCouponInputCode(e.target.value)}
                    placeholder="Coupon Code (e.g. GLOW10)"
                    className="flex-1 px-2 py-0.5 bg-white border border-slate-300 rounded text-xs font-mono uppercase"
                  />
                  <button
                    onClick={handleApplyCouponCode}
                    className="px-2 py-0.5 bg-[#0f6cbd] text-white font-bold rounded text-xs hover:bg-[#115ea3]"
                  >
                    Apply
                  </button>
                </div>
                {couponMsg && (
                  <p className={`text-[10px] font-bold mt-0.5 ${couponMsg.isError ? 'text-rose-600' : 'text-[#107c41]'}`}>
                    {couponMsg.text}
                  </p>
                )}
              </div>

              {/* Loyalty Points Redemption Box */}
              {(selectedCustomer.points || 0) > 0 && (
                <div className="flex items-center justify-between text-slate-700 bg-amber-50 p-1.5 rounded border border-amber-200">
                  <div className="flex items-center space-x-1">
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                    <span className="text-[11px] font-bold">Redeem Loyalty Points ({selectedCustomer.points} pts available)</span>
                  </div>
                  <input
                    type="number"
                    min="0"
                    max={selectedCustomer.points}
                    value={redeemedPoints || ''}
                    onChange={(e) => setRedeemedPoints(Math.min(selectedCustomer.points || 0, Number(e.target.value)))}
                    placeholder="0"
                    className="w-16 px-1.5 py-0.5 bg-white border border-amber-300 rounded text-right font-bold text-xs text-amber-800"
                  />
                </div>
              )}

              {/* Discount Summary Display */}
              {couponDiscountAmt > 0 && (
                <div className="flex justify-between text-[#107c41] font-bold">
                  <span>Coupon Discount ({appliedCoupon?.code})</span>
                  <span>- {settings.currency_symbol} {(couponDiscountAmt ?? 0).toLocaleString()}</span>
                </div>
              )}

              {loyaltyDiscountAmt > 0 && (
                <div className="flex justify-between text-amber-700 font-bold">
                  <span>Loyalty Points Discount</span>
                  <span>- {settings.currency_symbol} {(loyaltyDiscountAmt ?? 0).toLocaleString()}</span>
                </div>
              )}

              {settings.tax_rate > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>Tax ({settings.tax_rate}%)</span>
                  <span className="font-semibold">{settings.currency_symbol} {(taxAmount ?? 0).toFixed(2)}</span>
                </div>
              )}

              {/* Grand Total Bar */}
              <div className="flex justify-between items-center pt-2 border-t border-slate-300 text-slate-900">
                <span className="font-bold text-base">Grand Total</span>
                <span className="font-black text-2xl text-[#0f6cbd]">
                  {settings.currency_symbol} {(grandTotal ?? 0).toLocaleString()}
                </span>
              </div>
            </div>

            {/* Payment Method Selector Pills */}
            <div className="grid grid-cols-4 gap-1 pt-1">
              {(['Cash', 'Card', 'Easypaisa', 'JazzCash'] as PaymentMethod[]).map((pm) => (
                <button
                  key={pm}
                  onClick={() => setPaymentMethod(pm)}
                  className={`py-1.5 px-1 rounded-xl text-[11px] font-bold text-center border transition ${
                    paymentMethod === pm
                      ? 'bg-[#0b5fa5] text-white border-[#0b5fa5] shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {pm}
                </button>
              ))}
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={() => setIsCheckoutOpen(true)}
                disabled={cart.length === 0}
                className="py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-extrabold rounded-xl shadow-md transition text-sm flex items-center justify-center space-x-1.5"
              >
                <Banknote className="w-4 h-4" />
                <span>PAY & CHECKOUT (F4)</span>
              </button>

              <button
                onClick={() => triggerDirectCheckout()}
                disabled={cart.length === 0}
                className="py-3 bg-[#0b5fa5] hover:bg-[#094e88] disabled:opacity-40 text-white font-extrabold rounded-xl shadow-md transition text-sm flex items-center justify-center space-x-1.5"
              >
                <Printer className="w-4 h-4" />
                <span>PRINT BILL (F8)</span>
              </button>
            </div>

          </div>

        </div>

      </div>

      {/* ================= CHECKOUT / PAYMENT MODAL ================= */}
      {isCheckoutOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100 space-y-4 p-6">
            
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-800">Complete POS Payment</h3>
                <p className="text-xs text-slate-500">Customer: {selectedCustomer.name}</p>
              </div>
              <button 
                onClick={() => setIsCheckoutOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg"
              >
                ✕
              </button>
            </div>

            {/* Amount Payable Highlight */}
            <div className="bg-blue-50 border border-blue-200 p-4 rounded-2xl text-center space-y-1">
              <span className="text-xs uppercase font-bold text-slate-500">Total Amount Payable</span>
              <div className="text-3xl font-black text-[#0b5fa5]">
                {settings.currency_symbol} {(grandTotal ?? 0).toLocaleString()}
              </div>
              <span className="text-[11px] text-slate-500 block">Payment Method: <strong className="text-slate-800">{paymentMethod}</strong></span>
            </div>

            {/* Cash Paid & Change Calculator */}
            {paymentMethod === 'Cash' && (
              <div className="space-y-3">
                <label className="block text-xs font-bold text-slate-700 uppercase">
                  Cash Amount Tendered ({settings.currency_symbol})
                </label>
                <input
                  type="number"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                  placeholder={`Exact (${grandTotal})`}
                  className="w-full text-center text-2xl font-black py-3 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#0b5fa5]"
                />

                {/* Quick Cash Suggestions */}
                <div className="flex space-x-2">
                  {[grandTotal, 500, 1000, 5000].map((quickAmt) => (
                    <button
                      key={quickAmt}
                      onClick={() => setAmountPaid(quickAmt)}
                      className="flex-1 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-lg border border-slate-300"
                    >
                      {settings.currency_symbol} {quickAmt}
                    </button>
                  ))}
                </div>

                {/* Change Due Box */}
                <div className="flex justify-between items-center p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <span className="font-bold text-emerald-800 text-sm">Change to Return:</span>
                  <span className="font-extrabold text-xl text-emerald-700">
                    {settings.currency_symbol} {(changeDue ?? 0).toLocaleString()}
                  </span>
                </div>
              </div>
            )}

            {/* Loyalty Points Redemption Option */}
            {selectedCustomer.points > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs space-y-1">
                <div className="flex justify-between items-center font-bold text-amber-900">
                  <span>Customer Loyalty Points Available:</span>
                  <span>{selectedCustomer.points} Points</span>
                </div>
                <p className="text-[11px] text-amber-800">
                  Completing this order will reward +{Math.floor(grandTotal / 100)} points to {selectedCustomer.name}.
                </p>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex space-x-3 pt-2">
              <button
                onClick={() => setIsCheckoutOpen(false)}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-sm"
              >
                Cancel (ESC)
              </button>
              <button
                onClick={() => triggerDirectCheckout()}
                className="flex-1 py-3 bg-[#0b5fa5] hover:bg-[#094e88] text-white font-extrabold rounded-xl text-sm shadow-md flex items-center justify-center space-x-2"
              >
                <CheckCircle className="w-4 h-4" />
                <span>Confirm & Print Bill</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ================= ADD CUSTOMER MODAL ================= */}
      {isAddCustomerOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleCreateCustomer} className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100 p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-800 border-b pb-2">Add New Customer</h3>
            
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Customer Full Name *</label>
                <input
                  type="text"
                  required
                  value={newCustName}
                  onChange={(e) => setNewCustName(e.target.value)}
                  placeholder="e.g. Imran Khan"
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium focus:bg-white focus:ring-2 focus:ring-[#0b5fa5]"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Mobile Phone Number</label>
                <input
                  type="text"
                  value={newCustPhone}
                  onChange={(e) => setNewCustPhone(e.target.value)}
                  placeholder="0300-1234567"
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium focus:bg-white focus:ring-2 focus:ring-[#0b5fa5]"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Email Address</label>
                <input
                  type="email"
                  value={newCustEmail}
                  onChange={(e) => setNewCustEmail(e.target.value)}
                  placeholder="customer@email.com"
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium focus:bg-white focus:ring-2 focus:ring-[#0b5fa5]"
                />
              </div>
            </div>

            <div className="flex space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setIsAddCustomerOpen(false)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 bg-[#0b5fa5] hover:bg-[#094e88] text-white font-bold rounded-xl text-xs shadow-md"
              >
                Save Customer
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ================= CARD PAYMENT TERMINAL MODAL ================= */}
      {isCardTerminalModalOpen && (
        <CardTerminalModal
          amount={grandTotal}
          invoiceNo={`INV-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Math.floor(1000 + Math.random() * 9000)}`}
          onApproved={(tx) => {
            const sale: Sale = {
              id: `sale_${Date.now()}`,
              invoice_no: tx.invoice_no,
              datetime: new Date().toISOString(),
              customer_id: selectedCustomer.id,
              customer_name: selectedCustomer.name,
              customer_phone: selectedCustomer.phone,
              subtotal: subtotalAfterLineDiscounts,
              tax_rate: settings.tax_rate || 0,
              tax_amount: taxAmount,
              discount: overallDiscountAmt + lineDiscountsTotal,
              total: grandTotal,
              paid: grandTotal,
              change_due: 0,
              payment_method: 'Card',
              cashier_name: 'Store Cashier',
              status: 'completed',
              items: cart.map(item => ({
                product_id: item.product.id,
                barcode: item.product.barcode,
                name: item.product.name,
                quantity: item.quantity,
                buy_price: item.product.buy_price,
                sell_price: item.product.sell_price,
                discount: item.discount_amount,
                total: item.line_total
              }))
            };
            executeFinalCheckout(sale);
          }}
          onCancel={() => setIsCardTerminalModalOpen(false)}
        />
      )}

      {/* ================= MANAGER DISCOUNT APPROVAL MODAL ================= */}
      {isApprovalModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-sm border border-slate-200 p-5 space-y-4">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="font-bold text-slate-900 text-sm text-rose-700 flex items-center space-x-1.5">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                <span>Manager Approval Required</span>
              </h3>
              <button onClick={() => setIsApprovalModalOpen(false)} className="text-slate-400 font-bold px-1">✕</button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Cashier role is capped at <strong>15% maximum manual discount</strong>. To apply this high discount, please enter Store Manager Security PIN and approval reason.
            </p>

            <form onSubmit={handleManagerApproval} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Manager Security PIN *</label>
                <input
                  type="password"
                  required
                  value={managerPin}
                  onChange={(e) => setManagerPin(e.target.value)}
                  placeholder="Enter PIN (Default: 123456)"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono text-center text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#0f6cbd]"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Approval Reason *</label>
                <input
                  type="text"
                  required
                  value={approvalReason}
                  onChange={(e) => setApprovalReason(e.target.value)}
                  placeholder="e.g. Cleared by Outlet Manager for damaged box"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0f6cbd]"
                />
              </div>

              {approvalError && (
                <div className="p-2 bg-rose-50 text-rose-700 font-bold text-[11px] rounded border border-rose-200">
                  {approvalError}
                </div>
              )}

              <div className="flex space-x-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setIsApprovalModalOpen(false)}
                  className="flex-1 py-2 border border-slate-300 text-slate-700 rounded-md font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-md shadow-xs"
                >
                  Authorize Sale
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Customer Secondary Display Modal */}
      {isCustomerDisplayOpen && (
        <CustomerDisplayModal
          cartItems={cart}
          settings={settings}
          subtotal={rawSubtotal}
          tax={taxAmount}
          discount={totalDiscountAmount}
          total={grandTotal}
          onClose={() => setIsCustomerDisplayOpen(false)}
        />
      )}

    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { 
  RotateCcw, 
  Search, 
  AlertTriangle, 
  CheckCircle2, 
  Package, 
  DollarSign, 
  CreditCard, 
  Banknote, 
  Ticket, 
  Smartphone, 
  ShieldCheck, 
  KeyRound, 
  Info,
  Calendar,
  User,
  ShoppingBag,
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { 
  Sale, 
  SaleItem, 
  ShopSettings, 
  RefundMethod, 
  ReturnCondition, 
  ReturnReason, 
  ReturnTransaction 
} from '../types';
import { ReturnRefundService, ProcessReturnInput } from '../services/return_service';
import { StorageService } from '../services/storage';
import { SecurityConfirmDialog, ConfirmDetailItem } from './SecurityConfirmDialog';

interface ReturnRefundModalProps {
  isOpen: boolean;
  onClose: () => void;
  preSelectedSale?: Sale | null;
  settings: ShopSettings;
  onReturnSuccess: (returnTx: ReturnTransaction) => void;
}

interface ItemReturnState {
  item: SaleItem;
  returnQty: number;
  maxAvailable: number;
  condition: ReturnCondition;
  reason: ReturnReason;
  customReason: string;
  customRefundUnitPrice?: number;
}

export const ReturnRefundModal: React.FC<ReturnRefundModalProps> = ({
  isOpen,
  onClose,
  preSelectedSale,
  settings,
  onReturnSuccess,
}) => {
  const [salesList, setSalesList] = useState<Sale[]>([]);
  const [searchInvoiceQuery, setSearchInvoiceQuery] = useState('');
  const [selectedSale, setSelectedSale] = useState<Sale | null>(preSelectedSale || null);
  const [itemsState, setItemsState] = useState<ItemReturnState[]>([]);
  const [refundMethod, setRefundMethod] = useState<RefundMethod>('Cash');
  const [fullPriceRefund, setFullPriceRefund] = useState(true);
  const [returnNotes, setReturnNotes] = useState('');
  const [managerPin, setManagerPin] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

  // Load sales list on open
  useEffect(() => {
    if (isOpen) {
      const allSales = StorageService.getSales();
      setSalesList(allSales);
      if (preSelectedSale) {
        initializeSaleForReturn(preSelectedSale);
      } else {
        setSelectedSale(null);
        setItemsState([]);
      }
      setErrorMessage('');
      setManagerPin('');
      setReturnNotes('');
    }
  }, [isOpen, preSelectedSale]);

  const initializeSaleForReturn = (sale: Sale) => {
    setSelectedSale(sale);
    setSearchInvoiceQuery(sale.invoice_no);
    setErrorMessage('');
    setFullPriceRefund(true);

    // Pre-populate items
    const initialItems: ItemReturnState[] = sale.items.map(item => {
      const alreadyReturned = item.returned_qty || 0;
      const maxAvailable = Math.max(0, item.quantity - alreadyReturned);

      return {
        item,
        returnQty: 0,
        maxAvailable,
        condition: 'RESTOCK_SELLABLE',
        reason: 'Customer Changed Mind',
        customReason: ''
      };
    });

    setItemsState(initialItems);

    // Default refund method based on original sale
    if (sale.payment_method === 'Cash') {
      setRefundMethod('Cash');
    } else if (sale.payment_method === 'Card') {
      setRefundMethod('Card');
    } else if (sale.payment_method === 'Easypaisa') {
      setRefundMethod('Easypaisa');
    } else if (sale.payment_method === 'JazzCash') {
      setRefundMethod('JazzCash');
    } else {
      setRefundMethod('Cash');
    }
  };

  const handleSearchSale = () => {
    const q = searchInvoiceQuery.trim().toLowerCase();
    if (!q) {
      setErrorMessage('Please enter an Invoice Number, Barcode, or Customer phone to search.');
      return;
    }

    const found = salesList.find(s => 
      s.invoice_no.toLowerCase().includes(q) ||
      (s.customer_phone && s.customer_phone.includes(q)) ||
      s.items.some(i => i.barcode && i.barcode.toLowerCase() === q)
    );

    if (found) {
      initializeSaleForReturn(found);
    } else {
      setErrorMessage(`No matching invoice found for query "${searchInvoiceQuery}".`);
    }
  };

  const updateItemQty = (index: number, newQty: number) => {
    const updated = [...itemsState];
    const item = updated[index];
    const clampedQty = Math.max(0, Math.min(newQty, item.maxAvailable));
    updated[index].returnQty = clampedQty;
    setItemsState(updated);
  };

  const updateItemCondition = (index: number, condition: ReturnCondition) => {
    const updated = [...itemsState];
    updated[index].condition = condition;
    setItemsState(updated);
  };

  const updateItemReason = (index: number, reason: ReturnReason) => {
    const updated = [...itemsState];
    updated[index].reason = reason;
    setItemsState(updated);
  };

  const updateItemRefundPrice = (index: number, price?: number) => {
    const updated = [...itemsState];
    updated[index].customRefundUnitPrice = price !== undefined && !isNaN(price) && price >= 0 ? price : undefined;
    setItemsState(updated);
  };

  // Live Totals Calculations
  const activeReturns = itemsState.filter(i => i.returnQty > 0);
  let liveSubtotalRefund = 0;
  let liveTaxRefund = 0;
  let totalRestockUnits = 0;
  let totalDamagedUnits = 0;

  const hasOriginalSaleTax = Boolean(selectedSale && Number(selectedSale.tax_amount) > 0);

  if (selectedSale) {
    activeReturns.forEach(req => {
      const breakdown = ReturnRefundService.calculateItemRefundBreakdown(req.item, req.returnQty, selectedSale, {
        fullPriceRefund,
        customUnitPrice: req.customRefundUnitPrice
      });
      liveSubtotalRefund += breakdown.lineRefundSubtotal;
      liveTaxRefund += hasOriginalSaleTax ? breakdown.taxPortion : 0;
      if (req.condition === 'RESTOCK_SELLABLE') {
        totalRestockUnits += req.returnQty;
      } else {
        totalDamagedUnits += req.returnQty;
      }
    });
  }

  if (!hasOriginalSaleTax) {
    liveTaxRefund = 0;
  }

  const liveGrandTotalRefund = Math.round((liveSubtotalRefund + liveTaxRefund) * 100) / 100;
  const estimatedPointsDeducted = Math.floor(liveSubtotalRefund / 100);

  const handleProcessReturn = () => {
    if (!selectedSale) {
      setErrorMessage('Please select an invoice first.');
      return;
    }

    if (activeReturns.length === 0) {
      setErrorMessage('Please select at least 1 item and quantity to return.');
      return;
    }

    // Manager PIN check if refund is large (> Rs 3000) or requested
    const activeUser = StorageService.getActiveUser();
    const adminUser = StorageService.getUsers().find(u => u?.role === 'admin');
    const validAdminPin = adminUser?.pin || 'Usman@Ali513';
    const isHighValue = liveGrandTotalRefund >= 3000;
    
    if (isHighValue && activeUser?.role !== 'admin') {
      if (!managerPin || managerPin !== validAdminPin) {
        setErrorMessage('High-value refund (≥ Rs. 3,000) requires valid Manager PIN/Password authorization.');
        return;
      }
    }

    setErrorMessage('');
    setIsConfirmModalOpen(true);
  };

  const executeProcessReturn = async () => {
    if (!selectedSale) return;
    const activeUser = StorageService.getActiveUser();
    const isHighValue = liveGrandTotalRefund >= 3000;

    setIsProcessing(true);
    setErrorMessage('');

    const input: ProcessReturnInput = {
      originalSale: selectedSale,
      itemsToReturn: activeReturns.map(r => ({
        item: r.item,
        returnQty: r.returnQty,
        condition: r.condition,
        reason: r.reason,
        customReason: r.customReason,
        customRefundUnitPrice: r.customRefundUnitPrice
      })),
      refundMethod,
      notes: returnNotes,
      cashierName: activeUser?.name || 'Cashier Desk',
      approvedBy: isHighValue ? 'Manager Approved' : undefined,
      settings,
      fullPriceRefund
    };

    const res = await ReturnRefundService.processReturn(input);
    setIsProcessing(false);
    setIsConfirmModalOpen(false);

    if (res.success && res.returnTx) {
      onReturnSuccess(res.returnTx);
      onClose();
    } else {
      setErrorMessage(res.message);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto font-sans">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[calc(100vh-2rem)] flex flex-col my-auto overflow-hidden border border-slate-200 animate-scale-up">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-rose-700 via-rose-800 to-slate-900 text-white p-4 sm:p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20">
              <RotateCcw className="w-5 h-5 text-rose-300" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base sm:text-lg font-black text-white">Process Product Return & Refund</h3>
                <span className="bg-rose-500/30 text-rose-200 border border-rose-400/40 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                  POS Return Engine
                </span>
              </div>
              <p className="text-xs text-rose-200/80">
                Lookup invoice, select items & condition, auto-recalculate tax, and restock inventory
              </p>
            </div>
          </div>

          <button 
            type="button"
            onClick={onClose}
            className="text-white/70 hover:text-white font-black text-lg px-2.5 py-1 rounded-xl hover:bg-white/10 transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5 bg-slate-50/50">
          
          {/* 1. SEARCH & INVOICE LOOKUP */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-extrabold text-slate-800 flex items-center space-x-1.5">
                <Search className="w-4 h-4 text-rose-600" />
                <span>1. Invoice Lookup (Scan Receipt Barcode or Search Number)</span>
              </label>
              {selectedSale && (
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  ✓ Invoice Loaded: #{selectedSale.invoice_no}
                </span>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={searchInvoiceQuery}
                  onChange={(e) => setSearchInvoiceQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearchSale()}
                  placeholder="Enter Invoice No (e.g. BC-2026-0001), Barcode, or Customer Phone..."
                  className="w-full pl-3 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <button
                type="button"
                onClick={handleSearchSale}
                className="px-5 py-2.5 bg-rose-700 hover:bg-rose-800 text-white font-bold rounded-xl text-xs shadow-xs transition flex items-center justify-center space-x-1.5 cursor-pointer whitespace-nowrap"
              >
                <Search className="w-3.5 h-3.5" />
                <span>Lookup Invoice</span>
              </button>
            </div>

            {/* Quick Recent Invoices Chips */}
            {!selectedSale && salesList.length > 0 && (
              <div className="pt-1">
                <p className="text-[10px] text-slate-400 font-bold uppercase mb-1.5">Or Pick from Recent Completed Sales:</p>
                <div className="flex flex-wrap gap-1.5">
                  {salesList.slice(0, 5).map(sale => (
                    <button
                      key={sale.id}
                      type="button"
                      onClick={() => initializeSaleForReturn(sale)}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300 border border-slate-200 text-slate-700 font-mono text-[11px] font-bold rounded-lg transition flex items-center space-x-1 cursor-pointer"
                    >
                      <span>#{sale.invoice_no}</span>
                      <span className="text-slate-400 font-sans">({sale.customer_name} - {settings.currency_symbol}{sale.total})</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 2. SELECTED INVOICE DETAILS SUMMARY */}
          {selectedSale && (
            <div className="bg-rose-50/60 border border-rose-200 rounded-2xl p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rose-200/80 pb-2">
                <div className="flex items-center space-x-2">
                  <span className="font-mono font-black text-sm text-rose-950">
                    Invoice #{selectedSale.invoice_no}
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    selectedSale.status === 'completed' 
                      ? 'bg-emerald-100 text-emerald-800' 
                      : selectedSale.status === 'partially_refunded' 
                      ? 'bg-amber-100 text-amber-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {(selectedSale.status || 'COMPLETED').toUpperCase()}
                  </span>
                </div>

                <div className="text-xs text-slate-600 flex items-center space-x-4">
                  <span>📅 {new Date(selectedSale.datetime).toLocaleDateString()}</span>
                  <span>👤 {selectedSale.customer_name}</span>
                  <span>💳 Paid: {selectedSale.payment_method}</span>
                  <span className="font-extrabold text-slate-900">
                    Grand Total: {settings.currency_symbol} {(selectedSale.total ?? 0).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Notice if already partially refunded */}
              {(selectedSale.total_refunded ?? 0) > 0 ? (
                <div className="flex items-center space-x-2 text-[11px] text-amber-800 bg-amber-50 p-2 rounded-xl border border-amber-200">
                  <Info className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    Notice: This invoice already has previous returns totaling <strong>{settings.currency_symbol} {(selectedSale.total_refunded ?? 0).toLocaleString()}</strong>. Remaining eligible items are listed below.
                  </span>
                </div>
              ) : null}
            </div>
          )}

          {/* 3. ITEM-BY-ITEM RETURN SELECTION TABLE */}
          {selectedSale && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden space-y-3 p-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black text-slate-900 flex items-center space-x-1.5">
                  <Package className="w-4 h-4 text-rose-600" />
                  <span>2. Select Products to Return & Specify Condition</span>
                </h4>
                <span className="text-[11px] text-slate-500 font-medium">
                  {itemsState.filter(i => i.maxAvailable > 0).length} returnable items
                </span>
              </div>

              {/* Policy Mode: Full Price vs Prorated */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 bg-rose-50/70 border border-rose-200 rounded-xl gap-2">
                <div>
                  <p className="font-bold text-xs text-rose-950">Refund Calculation: {fullPriceRefund ? 'Real Selling Price (100%)' : 'Pro-rated Discount Price'}</p>
                  <p className="text-[11px] text-rose-700">
                    {fullPriceRefund 
                      ? 'Returns the real selling price of the product without phantom tax.'
                      : 'Applies pro-rated cart discounts across line items.'}
                  </p>
                </div>
                <label className="flex items-center space-x-2 shrink-0 cursor-pointer bg-white px-3 py-1.5 rounded-lg border border-rose-300 shadow-xs">
                  <input
                    type="checkbox"
                    checked={fullPriceRefund}
                    onChange={(e) => setFullPriceRefund(e.target.checked)}
                    className="w-4 h-4 text-rose-600 rounded border-rose-300 focus:ring-rose-500 cursor-pointer"
                  />
                  <span className="text-xs font-black text-rose-900 select-none">Refund Real Selling Price</span>
                </label>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100/80 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="p-3">Product Name & Barcode</th>
                      <th className="p-3 text-center">Sold / Avail</th>
                      <th className="p-3 text-right">Sold Price</th>
                      <th className="p-3 text-center">Return Qty</th>
                      <th className="p-3 text-center">Refund Price / Unit</th>
                      <th className="p-3">Return Reason</th>
                      <th className="p-3">Restock Action</th>
                      <th className="p-3 text-right">Refund Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {itemsState.map((row, idx) => {
                      const breakdown = ReturnRefundService.calculateItemRefundBreakdown(row.item, row.returnQty, selectedSale, {
                        fullPriceRefund,
                        customUnitPrice: row.customRefundUnitPrice
                      });
                      const isUnavailable = row.maxAvailable <= 0;

                      return (
                        <tr 
                          key={idx} 
                          className={`transition ${row.returnQty > 0 ? 'bg-rose-50/40 font-semibold' : isUnavailable ? 'opacity-40 bg-slate-50' : 'hover:bg-slate-50'}`}
                        >
                          {/* Product Info */}
                          <td className="p-3">
                            <p className="font-bold text-slate-900">{row.item.name}</p>
                            <p className="font-mono text-[10px] text-slate-400">{row.item.barcode}</p>
                          </td>

                          {/* Sold / Available */}
                          <td className="p-3 text-center">
                            <span className="text-slate-600">{row.item.quantity} sold</span>
                            {row.item.returned_qty ? (
                              <p className="text-[10px] text-red-600 font-bold">({row.item.returned_qty} returned)</p>
                            ) : null}
                            <p className="text-[10px] text-emerald-700 font-bold">{row.maxAvailable} available</p>
                          </td>

                          {/* Net Sold Price */}
                          <td className="p-3 text-right font-mono">
                            <div>{settings.currency_symbol} {(row.item?.sell_price ?? 0).toLocaleString()}</div>
                            {!fullPriceRefund && breakdown.unitDiscount > 0 && (
                              <div className="text-[10px] text-emerald-600 font-bold">
                                -{settings.currency_symbol}{breakdown.unitDiscount} disc
                              </div>
                            )}
                          </td>

                          {/* Return Qty Stepper */}
                          <td className="p-3">
                            {isUnavailable ? (
                              <span className="text-[11px] text-slate-400 italic">Fully Returned</span>
                            ) : (
                              <div className="flex items-center justify-center space-x-1">
                                <button
                                  type="button"
                                  onClick={() => updateItemQty(idx, row.returnQty - 1)}
                                  disabled={row.returnQty <= 0}
                                  className="w-7 h-7 rounded-lg bg-slate-200 hover:bg-slate-300 disabled:opacity-30 font-bold text-slate-800 flex items-center justify-center cursor-pointer"
                                >
                                  -
                                </button>
                                <input
                                  type="number"
                                  min="0"
                                  max={row.maxAvailable}
                                  value={row.returnQty}
                                  onChange={(e) => updateItemQty(idx, parseInt(e.target.value) || 0)}
                                  className="w-12 text-center py-1 bg-white border border-slate-300 rounded-lg font-bold text-xs focus:ring-2 focus:ring-rose-500"
                                />
                                <button
                                  type="button"
                                  onClick={() => updateItemQty(idx, row.returnQty + 1)}
                                  disabled={row.returnQty >= row.maxAvailable}
                                  className="w-7 h-7 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-800 disabled:opacity-30 font-bold flex items-center justify-center cursor-pointer"
                                >
                                  +
                                </button>
                              </div>
                            )}
                          </td>

                          {/* Editable Refund Price per Unit */}
                          <td className="p-3 text-center">
                            {row.returnQty > 0 ? (
                              <div className="flex flex-col items-center space-y-1">
                                <div className="flex items-center space-x-1">
                                  <span className="text-[10px] text-slate-400 font-semibold">{settings.currency_symbol}</span>
                                  <input
                                    type="number"
                                    min="0"
                                    step="any"
                                    value={row.customRefundUnitPrice !== undefined ? row.customRefundUnitPrice : breakdown.refundUnitPrice}
                                    onChange={(e) => {
                                      const val = e.target.value === '' ? undefined : Number(e.target.value);
                                      updateItemRefundPrice(idx, val);
                                    }}
                                    className="w-20 px-1.5 py-1 bg-white border border-rose-300 rounded-lg text-xs font-black text-rose-700 text-center focus:ring-2 focus:ring-rose-500 focus:outline-none"
                                    title="Edit refund amount per unit"
                                  />
                                </div>
                                {row.customRefundUnitPrice !== undefined && (
                                  <button
                                    type="button"
                                    onClick={() => updateItemRefundPrice(idx, undefined)}
                                    className="text-[9px] text-blue-600 hover:underline font-bold cursor-pointer"
                                  >
                                    Auto Reset
                                  </button>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>

                          {/* Reason */}
                          <td className="p-3">
                            <select
                              disabled={row.returnQty === 0}
                              value={row.reason}
                              onChange={(e) => updateItemReason(idx, e.target.value as ReturnReason)}
                              className="w-full p-1.5 bg-slate-50 border border-slate-300 rounded-lg text-[11px] font-medium disabled:opacity-40 focus:ring-2 focus:ring-rose-500"
                            >
                              <option value="Customer Changed Mind">Customer Changed Mind</option>
                              <option value="Defective/Damaged">Defective / Damaged</option>
                              <option value="Wrong Shade/Color">Wrong Shade / Color</option>
                              <option value="Allergic Reaction">Allergic Reaction</option>
                              <option value="Expired/Seal Broken">Expired / Seal Broken</option>
                              <option value="Incorrect Billing Item">Incorrect Billing Item</option>
                              <option value="Other">Other Reason</option>
                            </select>
                          </td>

                          {/* Restock Condition */}
                          <td className="p-3">
                            <select
                              disabled={row.returnQty === 0}
                              value={row.condition}
                              onChange={(e) => updateItemCondition(idx, e.target.value as ReturnCondition)}
                              className={`w-full p-1.5 rounded-lg text-[11px] font-bold border disabled:opacity-40 focus:ring-2 focus:ring-rose-500 ${
                                row.condition === 'RESTOCK_SELLABLE' 
                                  ? 'bg-emerald-50 text-emerald-900 border-emerald-300' 
                                  : 'bg-rose-50 text-rose-900 border-rose-300'
                              }`}
                            >
                              <option value="RESTOCK_SELLABLE">🟢 Restock to Shelf (+Stock)</option>
                              <option value="DAMAGED_WRITE_OFF">🔴 Damaged Write-Off (No Restock)</option>
                              <option value="EXPIRED_SCRAP">⚠️ Expired Scrap (Write-Off)</option>
                            </select>
                          </td>

                          {/* Line Refund Total */}
                          <td className="p-3 text-right font-mono font-black text-rose-700">
                            {row.returnQty > 0 ? (
                              <div>
                                <span className="text-sm font-black">{settings.currency_symbol} {(breakdown?.totalLineRefund ?? breakdown?.lineRefundSubtotal ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                {(breakdown?.taxPortion || 0) > 0 && hasOriginalSaleTax && (
                                  <p className="text-[10px] text-slate-500 font-normal">
                                    (Net: {settings.currency_symbol}{(breakdown?.lineRefundSubtotal ?? 0).toFixed(2)} + Tax: {settings.currency_symbol}{(breakdown?.taxPortion ?? 0).toFixed(2)})
                                  </p>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 4. REFUND DISBURSEMENT & FINANCIAL ENGINE */}
          {selectedSale && activeReturns.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Left Column: Refund Method Selection */}
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                <h4 className="text-xs font-black text-slate-900 flex items-center space-x-1.5">
                  <DollarSign className="w-4 h-4 text-rose-600" />
                  <span>3. Choose Refund Disbursement Method</span>
                </h4>

                <div className="grid grid-cols-2 gap-2">
                  
                  {/* Cash */}
                  <button
                    type="button"
                    onClick={() => setRefundMethod('Cash')}
                    className={`p-3 rounded-xl border text-left flex flex-col justify-between space-y-2 transition cursor-pointer ${
                      refundMethod === 'Cash' 
                        ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/20 text-emerald-950' 
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <Banknote className="w-5 h-5 text-emerald-600" />
                      {refundMethod === 'Cash' && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                    </div>
                    <div>
                      <p className="font-extrabold text-xs">Cash Refund</p>
                      <p className="text-[10px] opacity-75">Deducts from shift register & pops cash drawer</p>
                    </div>
                  </button>

                  {/* Store Credit Voucher */}
                  <button
                    type="button"
                    onClick={() => setRefundMethod('Store_Credit')}
                    className={`p-3 rounded-xl border text-left flex flex-col justify-between space-y-2 transition cursor-pointer ${
                      refundMethod === 'Store_Credit' 
                        ? 'bg-amber-50 border-amber-500 ring-2 ring-amber-500/20 text-amber-950' 
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <Ticket className="w-5 h-5 text-amber-600" />
                      {refundMethod === 'Store_Credit' && <CheckCircle2 className="w-4 h-4 text-amber-600" />}
                    </div>
                    <div>
                      <p className="font-extrabold text-xs">Store Credit Voucher</p>
                      <p className="text-[10px] opacity-75">Generates redeemable coupon code for future shopping</p>
                    </div>
                  </button>

                  {/* Card Refund */}
                  <button
                    type="button"
                    onClick={() => setRefundMethod('Card')}
                    className={`p-3 rounded-xl border text-left flex flex-col justify-between space-y-2 transition cursor-pointer ${
                      refundMethod === 'Card' 
                        ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-500/20 text-blue-950' 
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <CreditCard className="w-5 h-5 text-blue-600" />
                      {refundMethod === 'Card' && <CheckCircle2 className="w-4 h-4 text-blue-600" />}
                    </div>
                    <div>
                      <p className="font-extrabold text-xs">Card / Bank Reversal</p>
                      <p className="text-[10px] opacity-75">Reverse to customer bank / POS terminal</p>
                    </div>
                  </button>

                  {/* Easypaisa / JazzCash */}
                  <button
                    type="button"
                    onClick={() => setRefundMethod('Easypaisa')}
                    className={`p-3 rounded-xl border text-left flex flex-col justify-between space-y-2 transition cursor-pointer ${
                      refundMethod === 'Easypaisa' 
                        ? 'bg-purple-50 border-purple-500 ring-2 ring-purple-500/20 text-purple-950' 
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <Smartphone className="w-5 h-5 text-purple-600" />
                      {refundMethod === 'Easypaisa' && <CheckCircle2 className="w-4 h-4 text-purple-600" />}
                    </div>
                    <div>
                      <p className="font-extrabold text-xs">Digital Mobile Wallet</p>
                      <p className="text-[10px] opacity-75">Easypaisa / JazzCash digital transfer</p>
                    </div>
                  </button>

                </div>

                {/* Notes & Reason Box */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Return Remarks / Customer Notes (Optional)
                  </label>
                  <input
                    type="text"
                    value={returnNotes}
                    onChange={(e) => setReturnNotes(e.target.value)}
                    placeholder="e.g. Customer wanted shade 130 instead, refunded in cash"
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-rose-500"
                  />
                </div>

                {/* Manager Authorization PIN if High Refund */}
                {liveGrandTotalRefund >= 3000 && (
                  <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 space-y-2">
                    <div className="flex items-center space-x-2 text-amber-900 text-xs font-bold">
                      <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0" />
                      <span>Manager PIN Authorization Required (≥ Rs. 3,000)</span>
                    </div>
                    <input
                      type="password"
                      value={managerPin}
                      onChange={(e) => setManagerPin(e.target.value)}
                      placeholder="Enter Manager Password"
                      className="w-full p-2 bg-white border border-amber-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                )}

              </div>

              {/* Right Column: Calculated Audit & Breakdown Summary */}
              <div className="bg-slate-900 text-white p-5 rounded-2xl flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="font-black text-xs uppercase tracking-wider text-rose-400">
                      Calculated Refund Summary
                    </span>
                    <span className="text-[11px] bg-white/10 px-2 py-0.5 rounded-full font-mono text-slate-300">
                      {activeReturns.reduce((acc, c) => acc + c.returnQty, 0)} items returning
                    </span>
                  </div>

                  <div className="space-y-2 text-xs text-slate-300">
                    <div className="flex justify-between">
                      <span>Subtotal of Returned Items:</span>
                      <span className="font-mono text-white font-bold">
                        {settings.currency_symbol} {(liveSubtotalRefund ?? 0).toFixed(2)}
                      </span>
                    </div>

                    {(liveTaxRefund || 0) > 0 && hasOriginalSaleTax && (
                      <div className="flex justify-between">
                        <span>Tax ({selectedSale.tax_rate || Math.round((((liveTaxRefund || 0) / (liveSubtotalRefund || 1)) * 100) * 10) / 10}%) Refund:</span>
                        <span className="font-mono text-white font-bold">
                          +{settings.currency_symbol} {(liveTaxRefund ?? 0).toFixed(2)}
                        </span>
                      </div>
                    )}

                    <div className="flex justify-between text-emerald-400 text-[11px]">
                      <span>Inventory Restocking:</span>
                      <span className="font-bold">+{totalRestockUnits} Units added to Shelf Stock</span>
                    </div>

                    {totalDamagedUnits > 0 && (
                      <div className="flex justify-between text-rose-400 text-[11px]">
                        <span>Damaged / Written-off:</span>
                        <span className="font-bold">{totalDamagedUnits} Units written off</span>
                      </div>
                    )}

                    {estimatedPointsDeducted > 0 && (
                      <div className="flex justify-between text-amber-300 text-[11px]">
                        <span>Loyalty Points Reversal:</span>
                        <span className="font-bold">-{estimatedPointsDeducted} Points deducted</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Grand Total Highlight */}
                <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700/80 space-y-1">
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs font-bold text-slate-400 uppercase">Total Amount to Refund:</span>
                    <span className="text-xl sm:text-2xl font-black text-rose-400 font-mono">
                      -{settings.currency_symbol} {(liveGrandTotalRefund ?? 0).toFixed(2)}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Disbursing via: <strong className="text-white">{refundMethod.replace('_', ' ')}</strong>
                  </p>
                </div>

                {/* Error Banner */}
                {errorMessage && (
                  <div className="p-3 bg-red-900/80 border border-red-500 text-red-200 rounded-xl text-xs font-bold flex items-center space-x-2 animate-shake">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex items-center space-x-3 pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="w-1/3 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleProcessReturn}
                    disabled={isProcessing}
                    className="w-2/3 py-3 bg-rose-600 hover:bg-rose-500 active:scale-98 text-white font-black rounded-xl text-xs shadow-lg transition flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
                  >
                    <RotateCcw className={`w-4 h-4 ${isProcessing ? 'animate-spin' : ''}`} />
                    <span>{isProcessing ? 'Processing Refund...' : 'Confirm & Process Return'}</span>
                  </button>
                </div>

              </div>

            </div>
          )}

          {/* If No Invoice Loaded Message */}
          {!selectedSale && (
            <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-300 p-8 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 mx-auto flex items-center justify-center">
                <ShoppingBag className="w-6 h-6" />
              </div>
              <h4 className="font-extrabold text-sm text-slate-800">Scan or Search Receipt to Begin Return</h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Scan the customer's thermal receipt barcode with your physical scanner or type the invoice number in the search bar above.
              </p>
            </div>
          )}

        </div>

      </div>

      {/* Security Confirmation Safeguard Dialog */}
      {selectedSale && isConfirmModalOpen && (
        <SecurityConfirmDialog
          isOpen={isConfirmModalOpen}
          title={`Confirm Return & Refund #${selectedSale.invoice_no}`}
          message="Please carefully verify the return items, inventory restock action, and refund disbursement method before executing."
          variant="danger"
          confirmText="Yes, Execute Return & Refund"
          cancelText="Go Back & Review"
          isLoading={isProcessing}
          details={[
            { label: 'Invoice No', value: selectedSale.invoice_no },
            { label: 'Customer', value: selectedSale.customer_name },
            { label: 'Units Returning', value: `${activeReturns.reduce((acc, c) => acc + c.returnQty, 0)} Items`, highlight: true },
            { label: 'Restocked to Shelf', value: `+${totalRestockUnits} Units`, badge: 'Restock', badgeColor: 'emerald' },
            ...(totalDamagedUnits > 0 ? [{ label: 'Damaged / Scrap', value: `${totalDamagedUnits} Units`, badge: 'Write-off', badgeColor: 'rose' as const }] : []),
            { label: 'Total Refund', value: `${settings.currency_symbol || 'Rs.'} ${(liveGrandTotalRefund ?? 0).toLocaleString()}`, highlight: true },
            { label: 'Disbursement Method', value: refundMethod.replace('_', ' '), badge: refundMethod, badgeColor: 'blue' as const },
            ...(estimatedPointsDeducted > 0 ? [{ label: 'Points Deducted', value: `-${estimatedPointsDeducted} pts`, badgeColor: 'amber' as const }] : []),
          ]}
          onConfirm={executeProcessReturn}
          onCancel={() => setIsConfirmModalOpen(false)}
        />
      )}
    </div>
  );
};

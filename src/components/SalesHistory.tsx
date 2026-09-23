import React, { useState, useMemo, useEffect } from 'react';
import { 
  Receipt, 
  Search, 
  Printer, 
  Download, 
  Ban, 
  Calendar, 
  CreditCard,
  FileSpreadsheet,
  RotateCcw,
  Package,
  TrendingDown,
  Sparkles,
  Ticket,
  CheckCircle2,
  Trash2
} from 'lucide-react';
import { Sale, ShopSettings, ReturnTransaction } from '../types';

interface SalesHistoryProps {
  sales: Sale[];
  returns?: ReturnTransaction[];
  settings: ShopSettings;
  onReprintReceipt: (sale: Sale) => void;
  onVoidSale: (saleId: string) => void;
  onInitiateReturn?: (sale: Sale) => void;
  onOpenReturnModal?: () => void;
  onReprintReturnSlip?: (returnTx: ReturnTransaction) => void;
  onDeleteSale?: (saleId: string, restoreStock?: boolean) => void;
  onDeleteSales?: (saleIds: string[], restoreStock?: boolean) => void;
  onDeleteReturn?: (returnNo: string) => void;
}

export const SalesHistory: React.FC<SalesHistoryProps> = ({
  sales,
  returns = [],
  settings,
  onReprintReceipt,
  onVoidSale,
  onInitiateReturn,
  onOpenReturnModal,
  onReprintReturnSlip,
  onDeleteSale,
  onDeleteSales,
  onDeleteReturn,
}) => {
  const [activeTab, setActiveTab] = useState<'sales' | 'returns'>('sales');
  const [searchQuery, setSearchQuery] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('All');

  // Multi-Selection and Deletion Security States
  const [selectedSaleIds, setSelectedSaleIds] = useState<string[]>([]);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [saleToDeleteSingle, setSaleToDeleteSingle] = useState<Sale | null>(null);
  const [returnToDeleteSingle, setReturnToDeleteSingle] = useState<ReturnTransaction | null>(null);
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [deletePasswordError, setDeletePasswordError] = useState<string | null>(null);
  const [restoreStockOnDelete, setRestoreStockOnDelete] = useState(true);

  const [salesPage, setSalesPage] = useState(1);
  const [salesPageSize, setSalesPageSize] = useState(25);
  const [returnsPage, setReturnsPage] = useState(1);
  const [returnsPageSize, setReturnsPageSize] = useState(25);

  useEffect(() => {
    setSalesPage(1);
    setReturnsPage(1);
  }, [searchQuery, paymentFilter]);

  const filteredSales = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return sales.filter(s => {
      const matchesSearch = !q ||
        (s.invoice_no && s.invoice_no.toLowerCase().includes(q)) ||
        (s.customer_name && s.customer_name.toLowerCase().includes(q)) ||
        (s.cashier_name && s.cashier_name.toLowerCase().includes(q));
      const matchesPayment = paymentFilter === 'All' || s.payment_method === paymentFilter;
      return matchesSearch && matchesPayment;
    });
  }, [sales, searchQuery, paymentFilter]);

  const totalSalesPages = salesPageSize === 0 ? 1 : Math.max(1, Math.ceil(filteredSales.length / salesPageSize));
  const paginatedSales = useMemo(() => {
    if (salesPageSize === 0) return filteredSales;
    const start = (salesPage - 1) * salesPageSize;
    return filteredSales.slice(start, start + salesPageSize);
  }, [filteredSales, salesPage, salesPageSize]);

  const filteredReturns = useMemo(() => {
    if (!returns || returns.length === 0) return [];
    const q = searchQuery.trim().toLowerCase();
    return returns.filter(r => {
      const matchesSearch = !q ||
        (r.return_no && r.return_no.toLowerCase().includes(q)) ||
        (r.original_invoice_no && r.original_invoice_no.toLowerCase().includes(q)) ||
        (r.customer_name && r.customer_name.toLowerCase().includes(q)) ||
        (r.cashier_name && r.cashier_name.toLowerCase().includes(q)) ||
        (r.store_credit_code && r.store_credit_code.toLowerCase().includes(q));
      const matchesPayment = paymentFilter === 'All' || r.refund_method === paymentFilter;
      return matchesSearch && matchesPayment;
    });
  }, [returns, searchQuery, paymentFilter]);

  const totalReturnsPages = returnsPageSize === 0 ? 1 : Math.max(1, Math.ceil(filteredReturns.length / returnsPageSize));
  const paginatedReturns = useMemo(() => {
    if (returnsPageSize === 0) return filteredReturns;
    const start = (returnsPage - 1) * returnsPageSize;
    return filteredReturns.slice(start, start + returnsPageSize);
  }, [filteredReturns, returnsPage, returnsPageSize]);

  // Selection handlers
  const handleToggleSelectAllSales = () => {
    if (selectedSaleIds.length === filteredSales.length && filteredSales.length > 0) {
      setSelectedSaleIds([]);
    } else {
      setSelectedSaleIds(filteredSales.map(s => s.id));
    }
  };

  const handleToggleSelectSale = (id: string) => {
    setSelectedSaleIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // Bulk Delete Receipt Submission with Admin Password Check ("Usman@Ali513")
  const handleConfirmBulkDeleteSales = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPasswordInput !== 'Usman@Ali513') {
      setDeletePasswordError('Security Check Failed: Incorrect Admin Password. Please enter Usman@Ali513.');
      return;
    }

    if (onDeleteSales) {
      onDeleteSales(selectedSaleIds, restoreStockOnDelete);
    } else if (onDeleteSale) {
      selectedSaleIds.forEach(id => onDeleteSale(id, restoreStockOnDelete));
    }

    setSelectedSaleIds([]);
    setIsBulkDeleteModalOpen(false);
    setAdminPasswordInput('');
    setDeletePasswordError(null);
  };

  // Single Receipt Delete Submission
  const handleConfirmSingleDeleteSale = (e: React.FormEvent) => {
    e.preventDefault();
    if (!saleToDeleteSingle) return;

    if (adminPasswordInput !== 'Usman@Ali513') {
      setDeletePasswordError('Security Check Failed: Incorrect Admin Password. Please enter Usman@Ali513.');
      return;
    }

    if (onDeleteSale) {
      onDeleteSale(saleToDeleteSingle.id, restoreStockOnDelete);
    } else if (onDeleteSales) {
      onDeleteSales([saleToDeleteSingle.id], restoreStockOnDelete);
    }

    setSaleToDeleteSingle(null);
    setAdminPasswordInput('');
    setDeletePasswordError(null);
  };

  // Delete Return Voucher Submission
  const handleConfirmDeleteReturn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnToDeleteSingle) return;

    if (adminPasswordInput !== 'Usman@Ali513') {
      setDeletePasswordError('Security Check Failed: Incorrect Admin Password. Please enter Usman@Ali513.');
      return;
    }

    if (onDeleteReturn) {
      onDeleteReturn(returnToDeleteSingle.return_no);
    }

    setReturnToDeleteSingle(null);
    setAdminPasswordInput('');
    setDeletePasswordError(null);
  };

  const exportToCsv = () => {
    if (activeTab === 'sales') {
      if (sales.length === 0) return;
      let csvContent = 'data:text/csv;charset=utf-8,';
      csvContent += 'Invoice No,Date,Customer,Subtotal,Tax,Discount,Total,Paid,Refunded,Payment Method,Cashier,Status\n';
      
      sales.forEach(s => {
        const row = [
          s.invoice_no,
          new Date(s.datetime).toLocaleString(),
          `"${s.customer_name}"`,
          s.subtotal,
          s.tax_amount,
          s.discount,
          s.total,
          s.paid,
          s.total_refunded || 0,
          s.payment_method,
          `"${s.cashier_name}"`,
          s.status
        ].join(',');
        csvContent += row + '\n';
      });

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `BoomandCarry_Sales_Invoices_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      if (returns.length === 0) return;
      let csvContent = 'data:text/csv;charset=utf-8,';
      csvContent += 'Return No,Original Invoice,Date,Customer,Refund Amount,Refund Method,Restocked Qty,Damaged Qty,Store Credit Code,Cashier,Status\n';
      
      returns.forEach(r => {
        const row = [
          r.return_no,
          r.original_invoice_no,
          new Date(r.datetime).toLocaleString(),
          `"${r.customer_name}"`,
          r.total_refund_amount,
          r.refund_method,
          r.restocked_items_count,
          r.damaged_items_count,
          r.store_credit_code || 'N/A',
          `"${r.cashier_name}"`,
          r.status
        ].join(',');
        csvContent += row + '\n';
      });

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `BoomandCarry_Return_Vouchers_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4 font-sans">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-xl font-bold text-slate-800">Sales Invoices & Returns History</h2>
            <span className="bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
              Full Returns & Cashier Refund Engine
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage transactions, issue product returns, restock inventory, and reprint thermal refund vouchers
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {onOpenReturnModal && (
            <button
              type="button"
              onClick={() => onOpenReturnModal()}
              className="px-4 py-2 bg-rose-700 hover:bg-rose-800 text-white font-bold rounded-xl text-xs shadow-xs flex items-center justify-center space-x-1.5 transition cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>🔄 Process Return / Refund</span>
            </button>
          )}

          <button
            type="button"
            onClick={exportToCsv}
            className="px-3.5 py-2 bg-[#107c41] hover:bg-[#0e6b37] text-white font-bold rounded-xl text-xs shadow-xs flex items-center justify-center space-x-1.5 transition cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Tabs & Filter Bar */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        
        {/* Navigation Tabs */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl w-full md:w-auto">
          <button
            type="button"
            onClick={() => setActiveTab('sales')}
            className={`flex-1 md:flex-initial px-4 py-1.5 rounded-lg text-xs font-black transition cursor-pointer flex items-center justify-center space-x-1.5 ${
              activeTab === 'sales'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>Sales Invoices ({sales.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('returns')}
            className={`flex-1 md:flex-initial px-4 py-1.5 rounded-lg text-xs font-black transition cursor-pointer flex items-center justify-center space-x-1.5 ${
              activeTab === 'returns'
                ? 'bg-rose-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-rose-700'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Returns & Refunds ({returns.length})</span>
          </button>
        </div>

        {/* Search & Filter Controls */}
        <div className="flex flex-col sm:flex-row items-center gap-2 w-full md:w-auto flex-1 md:max-w-xl">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={activeTab === 'sales' ? "Search invoice #, customer, cashier..." : "Search return #, original invoice, customer, voucher code..."}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:ring-2 focus:ring-rose-500"
            />
          </div>

          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 px-3 py-2 rounded-xl focus:ring-2 focus:ring-rose-500 w-full sm:w-auto shrink-0"
          >
            <option value="All">Payment: All</option>
            <option value="Cash">Cash</option>
            <option value="Store_Credit">Store Credit</option>
            <option value="Card">Card</option>
            <option value="Easypaisa">Easypaisa</option>
            <option value="JazzCash">JazzCash</option>
          </select>
        </div>

      </div>

      {/* Bulk Action Banner for Sales */}
      {activeTab === 'sales' && selectedSaleIds.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 px-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs animate-in fade-in duration-200">
          <div className="flex items-center space-x-3">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping"></span>
            <span className="font-bold text-xs text-red-900">
              {selectedSaleIds.length} receipt{selectedSaleIds.length > 1 ? 's' : ''} selected
            </span>
            <span className="text-[11px] text-red-600 hidden md:inline">
              (Total Value: {settings.currency_symbol} {sales.filter(s => selectedSaleIds.includes(s.id)).reduce((sum, s) => sum + (s.total || 0), 0).toLocaleString()})
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => setSelectedSaleIds([])}
              className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 font-bold rounded-lg text-xs transition cursor-pointer"
            >
              Deselect All
            </button>
            <button
              type="button"
              onClick={() => {
                setAdminPasswordInput('');
                setDeletePasswordError(null);
                setIsBulkDeleteModalOpen(true);
              }}
              className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg text-xs shadow-xs flex items-center space-x-1.5 transition cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Selected ({selectedSaleIds.length})</span>
            </button>
          </div>
        </div>
      )}

      {/* 1. SALES INVOICES TABLE VIEW */}
      {activeTab === 'sales' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="p-3 text-center w-10">
                    <input
                      type="checkbox"
                      checked={filteredSales.length > 0 && selectedSaleIds.length === filteredSales.length}
                      onChange={handleToggleSelectAllSales}
                      className="w-4 h-4 rounded text-red-600 focus:ring-red-600 cursor-pointer"
                      title="Select / Deselect All Receipts"
                    />
                  </th>
                  <th className="p-3">Invoice No</th>
                  <th className="p-3">Date & Time</th>
                  <th className="p-3">Customer</th>
                  <th className="p-3">Payment</th>
                  <th className="p-3 text-right">Grand Total</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-center">Actions & Returns</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSales.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-400">
                      No sales invoices found matching filters.
                    </td>
                  </tr>
                ) : (
                  paginatedSales.map((sale) => {
                    const isFullyRefunded = sale.status === 'refunded';
                    const isPartiallyRefunded = sale.status === 'partially_refunded';
                    const isVoided = sale.status === 'voided';
                    const canReturn = !isFullyRefunded && !isVoided;
                    const isSelected = selectedSaleIds.includes(sale.id);

                    return (
                      <tr 
                        key={sale.id} 
                        className={`transition ${isSelected ? 'bg-red-50/40 hover:bg-red-50/70' : 'hover:bg-slate-50/80'}`}
                      >
                        {/* Checkbox */}
                        <td className="p-3 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelectSale(sale.id)}
                            className="w-4 h-4 rounded text-red-600 focus:ring-red-600 cursor-pointer"
                          />
                        </td>
                        
                        {/* Invoice No */}
                        <td className="p-3 font-mono font-bold text-[#0b5fa5]">
                          <div>{sale.invoice_no}</div>
                          {sale.total_refunded && sale.total_refunded > 0 ? (
                            <span className="text-[10px] text-rose-600 font-bold">
                              (-{settings.currency_symbol}{sale.total_refunded} refunded)
                            </span>
                          ) : null}
                        </td>

                        {/* Date */}
                        <td className="p-3 text-slate-600">
                          {sale.datetime ? new Date(sale.datetime).toLocaleString() : '-'}
                        </td>

                        {/* Customer */}
                        <td className="p-3 font-semibold text-slate-800">
                          <div>{sale.customer_name}</div>
                          {sale.customer_phone && <span className="text-[10px] text-slate-400 font-mono">{sale.customer_phone}</span>}
                        </td>

                        {/* Payment */}
                        <td className="p-3">
                          <span className="bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded text-[10px]">
                            {sale.payment_method}
                          </span>
                        </td>

                        {/* Grand Total */}
                        <td className="p-3 text-right font-black text-slate-900 text-sm font-mono">
                          <div>
                            {settings.currency_symbol} {Math.max(0, (sale.total ?? 0) - (sale.total_refunded || 0)).toLocaleString()}
                          </div>
                          {(sale.total_refunded ?? 0) > 0 ? (
                            <div className="text-[10px] text-slate-400 font-normal line-through">
                              Orig: {settings.currency_symbol} {(sale.total ?? 0).toLocaleString()}
                            </div>
                          ) : null}
                        </td>

                        {/* Status */}
                        <td className="p-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                            sale.status === 'completed'
                              ? 'bg-emerald-100 text-emerald-800'
                              : isPartiallyRefunded
                              ? 'bg-amber-100 text-amber-800'
                              : isFullyRefunded
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-red-100 text-red-700'
                          }`}>
                            {sale.status === 'partially_refunded' ? 'PARTIAL RETURN' : (sale.status || 'COMPLETED').toUpperCase()}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center space-x-1.5">
                            
                            {/* Receipt button */}
                            <button
                              type="button"
                              onClick={() => onReprintReceipt(sale)}
                              className="px-2.5 py-1 bg-blue-50 text-[#0b5fa5] hover:bg-blue-100 rounded-lg text-xs font-bold transition flex items-center space-x-1 cursor-pointer"
                              title="View / Re-print Sales Receipt"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              <span>Receipt</span>
                            </button>

                            {/* Return / Refund button */}
                            {canReturn && onInitiateReturn && (
                              <button
                                type="button"
                                onClick={() => onInitiateReturn(sale)}
                                className="px-2.5 py-1 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-lg text-xs font-bold transition flex items-center space-x-1 border border-rose-200 cursor-pointer"
                                title="Process Product Return & Refund"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span>Return</span>
                              </button>
                            )}

                            {/* Void button */}
                            {sale.status === 'completed' && (
                              <button
                                type="button"
                                onClick={() => onVoidSale(sale.id)}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                                title="Void Sale"
                              >
                                <Ban className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {/* Delete Receipt (Admin Security Password) */}
                            <button
                              type="button"
                              onClick={() => {
                                setSaleToDeleteSingle(sale);
                                setAdminPasswordInput('');
                                setDeletePasswordError(null);
                              }}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                              title="Delete Receipt (Admin Password Required)"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>

                          </div>
                        </td>

                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Sales Table Pagination Bar */}
          <div className="p-3 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center space-x-2 text-slate-600">
              <span>Showing {filteredSales.length === 0 ? 0 : (salesPage - 1) * (salesPageSize || filteredSales.length) + 1} to {salesPageSize === 0 ? filteredSales.length : Math.min(salesPage * salesPageSize, filteredSales.length)} of {filteredSales.length} invoices</span>
              <span className="text-slate-300">|</span>
              <div className="flex items-center space-x-1">
                <span>Per page:</span>
                <select
                  value={salesPageSize}
                  onChange={(e) => {
                    setSalesPageSize(Number(e.target.value));
                    setSalesPage(1);
                  }}
                  className="bg-white border border-slate-300 rounded px-1.5 py-0.5 font-semibold text-slate-700 focus:outline-hidden"
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={0}>All</option>
                </select>
              </div>
            </div>

            {totalSalesPages > 1 && (
              <div className="flex items-center space-x-1">
                <button
                  type="button"
                  onClick={() => setSalesPage(prev => Math.max(1, prev - 1))}
                  disabled={salesPage === 1}
                  className="px-2.5 py-1 rounded bg-white border border-slate-300 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 font-bold transition"
                >
                  Prev
                </button>
                <span className="px-2 py-1 font-semibold text-slate-700">
                  Page {salesPage} of {totalSalesPages}
                </span>
                <button
                  type="button"
                  onClick={() => setSalesPage(prev => Math.min(totalSalesPages, prev + 1))}
                  disabled={salesPage === totalSalesPages}
                  className="px-2.5 py-1 rounded bg-white border border-slate-300 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 font-bold transition"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. RETURNS & REFUND VOUCHERS TABLE VIEW */}
      {activeTab === 'returns' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden space-y-2">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-rose-50 text-rose-900 font-bold uppercase tracking-wider border-b border-rose-200">
                <tr>
                  <th className="p-3">Return Slip No</th>
                  <th className="p-3">Orig. Invoice</th>
                  <th className="p-3">Date & Time</th>
                  <th className="p-3">Customer</th>
                  <th className="p-3 text-center">Items & Units</th>
                  <th className="p-3 text-right">Refund Amount</th>
                  <th className="p-3">Refund Method</th>
                  <th className="p-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredReturns.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-10 text-center text-slate-400 space-y-2">
                      <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
                        <RotateCcw className="w-5 h-5" />
                      </div>
                      <p className="font-bold text-sm text-slate-600">No returns or refunds processed yet.</p>
                      <p className="text-xs text-slate-400">
                        When a customer returns items, return transactions and voucher slips will appear here.
                      </p>
                    </td>
                  </tr>
                ) : (
                  paginatedReturns.map((ret) => (
                    <tr key={ret.id} className="hover:bg-rose-50/40 transition">
                      
                      {/* Return No */}
                      <td className="p-3 font-mono font-black text-rose-700">
                        {ret.return_no}
                      </td>

                      {/* Original Invoice */}
                      <td className="p-3 font-mono font-bold text-slate-800">
                        #{ret.original_invoice_no}
                      </td>

                      {/* Date */}
                      <td className="p-3 text-slate-600">
                        {ret.datetime ? new Date(ret.datetime).toLocaleString() : '-'}
                      </td>

                      {/* Customer */}
                      <td className="p-3 font-semibold text-slate-800">
                        <div>{ret.customer_name}</div>
                        <div className="text-[10px] text-slate-400">Cashier: {ret.cashier_name}</div>
                      </td>

                      {/* Items & Restocked breakdown */}
                      <td className="p-3 text-center">
                        <div className="font-bold text-slate-800">{ret.items_count ?? 0} units</div>
                        <div className="text-[10px] flex items-center justify-center space-x-1">
                          <span className="text-emerald-600">+{ret.restocked_items_count ?? 0} shelf</span>
                          {(ret.damaged_items_count ?? 0) > 0 && (
                            <span className="text-rose-600">({ret.damaged_items_count} damaged)</span>
                          )}
                        </div>
                      </td>

                      {/* Total Refund Amount */}
                      <td className="p-3 text-right font-mono font-black text-rose-700 text-sm">
                        -{settings.currency_symbol} {(ret.total_refund_amount ?? 0).toLocaleString()}
                      </td>

                      {/* Refund Method & Store Credit Voucher */}
                      <td className="p-3">
                        <span className="bg-rose-100 text-rose-800 font-bold px-2 py-0.5 rounded text-[10px]">
                          {ret.refund_method.replace('_', ' ')}
                        </span>
                        {ret.store_credit_code && (
                          <div className="mt-1 font-mono text-[10px] text-amber-900 font-bold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 inline-block">
                            🎟️ {ret.store_credit_code}
                          </div>
                        )}
                      </td>

                      {/* Print Voucher & Delete Action */}
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center space-x-1.5">
                          {onReprintReturnSlip && (
                            <button
                              type="button"
                              onClick={() => onReprintReturnSlip(ret)}
                              className="px-2.5 py-1 bg-rose-700 hover:bg-rose-800 text-white font-bold rounded-lg text-xs shadow-xs transition flex items-center justify-center space-x-1 cursor-pointer"
                              title="Print Return Voucher"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              <span>Voucher</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setReturnToDeleteSingle(ret);
                              setAdminPasswordInput('');
                              setDeletePasswordError(null);
                            }}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                            title="Delete Return Record"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>

                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Returns Table Pagination Bar */}
          <div className="p-3 border-t border-rose-200 bg-rose-50/50 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center space-x-2 text-rose-800">
              <span>Showing {filteredReturns.length === 0 ? 0 : (returnsPage - 1) * (returnsPageSize || filteredReturns.length) + 1} to {returnsPageSize === 0 ? filteredReturns.length : Math.min(returnsPage * returnsPageSize, filteredReturns.length)} of {filteredReturns.length} returns</span>
              <span className="text-rose-300">|</span>
              <div className="flex items-center space-x-1">
                <span>Per page:</span>
                <select
                  value={returnsPageSize}
                  onChange={(e) => {
                    setReturnsPageSize(Number(e.target.value));
                    setReturnsPage(1);
                  }}
                  className="bg-white border border-rose-300 rounded px-1.5 py-0.5 font-semibold text-rose-800 focus:outline-hidden"
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={0}>All</option>
                </select>
              </div>
            </div>

            {totalReturnsPages > 1 && (
              <div className="flex items-center space-x-1">
                <button
                  type="button"
                  onClick={() => setReturnsPage(prev => Math.max(1, prev - 1))}
                  disabled={returnsPage === 1}
                  className="px-2.5 py-1 rounded bg-white border border-rose-300 text-rose-800 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-rose-100 font-bold transition"
                >
                  Prev
                </button>
                <span className="px-2 py-1 font-semibold text-rose-800">
                  Page {returnsPage} of {totalReturnsPages}
                </span>
                <button
                  type="button"
                  onClick={() => setReturnsPage(prev => Math.min(totalReturnsPages, prev + 1))}
                  disabled={returnsPage === totalReturnsPages}
                  className="px-2.5 py-1 rounded bg-white border border-rose-300 text-rose-800 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-rose-100 font-bold transition"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= BULK RECEIPTS DELETION SECURITY MODAL ================= */}
      {isBulkDeleteModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-4">
          <form 
            onSubmit={handleConfirmBulkDeleteSales}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-red-200 animate-in zoom-in-95 duration-200"
          >
            <div className="bg-red-600 px-6 py-4 text-white flex items-center space-x-3">
              <div className="p-2 bg-white/20 rounded-xl">
                <Trash2 className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-base font-bold">Delete Selected Receipts</h3>
                <p className="text-xs text-red-100">Permanent Database Action</p>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-xl p-3.5 text-xs text-red-900 leading-relaxed">
                <p className="font-bold mb-1">
                  You are deleting <span className="text-red-950 font-black">{selectedSaleIds.length} sales invoice(s)</span>.
                </p>
                <p className="text-slate-600 text-[11px]">
                  Total Value: <strong className="font-bold text-slate-800">{settings.currency_symbol} {sales.filter(s => selectedSaleIds.includes(s.id)).reduce((sum, s) => sum + (s.total || 0), 0).toLocaleString()}</strong>
                </p>
              </div>

              {/* Restore inventory stock toggle */}
              <label className="flex items-start space-x-2.5 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100 transition">
                <input
                  type="checkbox"
                  checked={restoreStockOnDelete}
                  onChange={(e) => setRestoreStockOnDelete(e.target.checked)}
                  className="mt-0.5 w-4 h-4 text-[#0f6cbd] rounded focus:ring-[#0f6cbd]"
                />
                <span className="text-xs font-semibold text-slate-700">
                  Restore product inventory quantities back to stock upon deletion
                </span>
              </label>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Enter Admin Security Password <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  required
                  autoFocus
                  value={adminPasswordInput}
                  onChange={(e) => {
                    setAdminPasswordInput(e.target.value);
                    setDeletePasswordError(null);
                  }}
                  placeholder="Enter admin security password"
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono tracking-widest text-slate-900 focus:bg-white focus:ring-2 focus:ring-red-500 outline-hidden"
                />
                {deletePasswordError && (
                  <p className="text-xs text-red-600 font-bold mt-1.5">
                    {deletePasswordError}
                  </p>
                )}
              </div>

              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsBulkDeleteModalOpen(false);
                    setAdminPasswordInput('');
                    setDeletePasswordError(null);
                  }}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs shadow-md transition cursor-pointer flex items-center justify-center space-x-1.5"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Confirm Delete</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* ================= SINGLE RECEIPT DELETION SECURITY MODAL ================= */}
      {saleToDeleteSingle && (
        <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-4">
          <form 
            onSubmit={handleConfirmSingleDeleteSale}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-red-200 animate-in zoom-in-95 duration-200"
          >
            <div className="bg-red-600 px-6 py-4 text-white flex items-center space-x-3">
              <div className="p-2 bg-white/20 rounded-xl">
                <Trash2 className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-base font-bold">Delete Receipt #{saleToDeleteSingle.invoice_no}</h3>
                <p className="text-xs text-red-100">Permanent Database Removal</p>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
                <p className="font-bold text-slate-900">Customer: {saleToDeleteSingle.customer_name}</p>
                <p className="text-slate-600">Total: <strong className="font-mono font-bold text-slate-900">{settings.currency_symbol} {(saleToDeleteSingle.total ?? 0).toLocaleString()}</strong></p>
                <p className="text-slate-500 font-mono text-[11px]">Items: {saleToDeleteSingle.items?.length || 0} product lines</p>
              </div>

              {/* Restore inventory stock toggle */}
              <label className="flex items-start space-x-2.5 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100 transition">
                <input
                  type="checkbox"
                  checked={restoreStockOnDelete}
                  onChange={(e) => setRestoreStockOnDelete(e.target.checked)}
                  className="mt-0.5 w-4 h-4 text-[#0f6cbd] rounded focus:ring-[#0f6cbd]"
                />
                <span className="text-xs font-semibold text-slate-700">
                  Restore items ({saleToDeleteSingle.items?.reduce((sum, it) => sum + it.qty, 0) || 0} units) back into inventory stock
                </span>
              </label>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Enter Admin Security Password <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  required
                  autoFocus
                  value={adminPasswordInput}
                  onChange={(e) => {
                    setAdminPasswordInput(e.target.value);
                    setDeletePasswordError(null);
                  }}
                  placeholder="Enter admin security password"
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono tracking-widest text-slate-900 focus:bg-white focus:ring-2 focus:ring-red-500 outline-hidden"
                />
                {deletePasswordError && (
                  <p className="text-xs text-red-600 font-bold mt-1.5">
                    {deletePasswordError}
                  </p>
                )}
              </div>

              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setSaleToDeleteSingle(null);
                    setAdminPasswordInput('');
                    setDeletePasswordError(null);
                  }}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs shadow-md transition cursor-pointer flex items-center justify-center space-x-1.5"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete Receipt</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* ================= RETURN RECORD DELETION SECURITY MODAL ================= */}
      {returnToDeleteSingle && (
        <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-4">
          <form 
            onSubmit={handleConfirmDeleteReturn}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-rose-200 animate-in zoom-in-95 duration-200"
          >
            <div className="bg-rose-700 px-6 py-4 text-white flex items-center space-x-3">
              <div className="p-2 bg-white/20 rounded-xl">
                <Trash2 className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-base font-bold">Delete Return Slip {returnToDeleteSingle.return_no}</h3>
                <p className="text-xs text-rose-100">Permanent Database Removal</p>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs space-y-1">
                <p className="font-bold text-slate-900">Original Invoice: #{returnToDeleteSingle.original_invoice_no}</p>
                <p className="text-slate-600">Refund: <strong className="font-mono font-bold text-rose-700">{settings.currency_symbol} {(returnToDeleteSingle.total_refund_amount ?? 0).toLocaleString()}</strong></p>
                <p className="text-slate-500 font-mono text-[11px]">Customer: {returnToDeleteSingle.customer_name}</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Enter Admin Security Password <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  required
                  autoFocus
                  value={adminPasswordInput}
                  onChange={(e) => {
                    setAdminPasswordInput(e.target.value);
                    setDeletePasswordError(null);
                  }}
                  placeholder="Enter admin security password"
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono tracking-widest text-slate-900 focus:bg-white focus:ring-2 focus:ring-rose-500 outline-hidden"
                />
                {deletePasswordError && (
                  <p className="text-xs text-red-600 font-bold mt-1.5">
                    {deletePasswordError}
                  </p>
                )}
              </div>

              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setReturnToDeleteSingle(null);
                    setAdminPasswordInput('');
                    setDeletePasswordError(null);
                  }}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-rose-700 hover:bg-rose-800 text-white font-bold rounded-xl text-xs shadow-md transition cursor-pointer flex items-center justify-center space-x-1.5"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete Return</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

    </div>
  );
};


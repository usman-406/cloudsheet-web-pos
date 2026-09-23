import React, { useState, useEffect, useMemo } from 'react';
import { 
  FolderLock, 
  Search, 
  FileSpreadsheet, 
  ArrowUpRight, 
  ArrowDownRight, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  ShieldCheck,
  RefreshCw
} from 'lucide-react';
import { InventorySyncService } from '../services/inventory_sync_service';
import { InventoryLedgerItem, Product, ShopSettings } from '../types';

interface StockLedgerViewProps {
  settings: ShopSettings;
}

export const StockLedgerView: React.FC<StockLedgerViewProps> = ({ settings }) => {
  const [ledgerItems, setLedgerItems] = useState<InventoryLedgerItem[]>([]);
  const [lowStockList, setLowStockList] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');

  useEffect(() => {
    loadLedgerData();
  }, []);

  const loadLedgerData = () => {
    const ledger = InventorySyncService.getRealtimeStockLedger();
    setLedgerItems(ledger);
    const lowStock = InventorySyncService.getLowStockProducts();
    setLowStockList(lowStock);
  };

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, typeFilter]);

  const filteredLedger = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return ledgerItems.filter(item => {
      const matchesSearch = !q ||
        (item.product_name && item.product_name.toLowerCase().includes(q)) ||
        (item.barcode && item.barcode.includes(q)) ||
        (item.reference_no && item.reference_no.toLowerCase().includes(q));
      const matchesType = typeFilter === 'ALL' || item.type === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [ledgerItems, searchQuery, typeFilter]);

  const totalPages = pageSize === 0 ? 1 : Math.max(1, Math.ceil(filteredLedger.length / pageSize));
  const paginatedLedger = useMemo(() => {
    if (pageSize === 0) return filteredLedger;
    const start = (currentPage - 1) * pageSize;
    return filteredLedger.slice(start, start + pageSize);
  }, [filteredLedger, currentPage, pageSize]);

  const exportToCsv = () => {
    if (ledgerItems.length === 0) return;
    
    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += 'Timestamp,Product Name,Barcode,Type,Before,Change,After,Batch No,Unit Cost,User,Reference\n';
    
    ledgerItems.forEach(i => {
      const row = [
        `"${i.timestamp}"`,
        `"${i.product_name}"`,
        i.barcode,
        i.type,
        i.qty_before,
        i.qty_change,
        i.qty_after,
        i.batch_no || '',
        i.unit_cost,
        `"${i.user_name}"`,
        `"${i.reference_no}"`
      ].join(',');
      csvContent += row + '\n';
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `BoomandCarry_Stock_Ledger_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 font-sans">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-lg border border-slate-200 shadow-xs">
        <div>
          <div className="inline-flex items-center space-x-1.5 bg-blue-50 text-[#0f6cbd] text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-md mb-1">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Atomic Stock Ledger & Movement Logs</span>
          </div>
          <h2 className="text-xl font-bold text-slate-800">Real-Time Cosmetic Inventory Stock Ledger</h2>
          <p className="text-xs text-slate-500 mt-0.5">Millisecond-precision inventory mutations, batch logs, and low-stock triggers</p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={loadLedgerData}
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-md text-xs transition"
            title="Refresh Ledger"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={exportToCsv}
            className="px-4 py-2 bg-[#107c41] hover:bg-[#0e6b37] text-white font-bold rounded-md text-xs shadow-xs flex items-center space-x-2 transition"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Export Stock CSV</span>
          </button>
        </div>
      </div>

      {/* Low Stock Threshold Alert Panel */}
      {lowStockList.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl space-y-3">
          <div className="flex items-center justify-between text-amber-900 font-extrabold text-xs">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span>Low-Stock Inventory Alert ({lowStockList.length} Items Below Reorder Threshold)</span>
            </div>
            <span className="text-[10px] bg-amber-200 px-2 py-0.5 rounded font-bold uppercase">Automated Trigger</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
            {lowStockList.map(prod => (
              <div key={prod.id} className="bg-white p-3 rounded-xl border border-amber-200 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-900 truncate max-w-[180px]">{prod.name}</h4>
                  <span className="font-mono text-[10px] text-slate-400">{prod.barcode}</span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-black text-red-600">{prod.stock_qty} left</span>
                  <span className="text-[10px] text-slate-400 block">(Alert: {prod.min_stock_alert ?? 10})</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search ledger by product name, barcode, invoice/ref number..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:ring-2 focus:ring-[#0b5fa5]"
          />
        </div>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 px-3 py-2 rounded-xl focus:ring-2 focus:ring-[#0b5fa5] w-full sm:w-auto"
        >
          <option value="ALL">Mutation Type: All Types</option>
          <option value="FIFO_DEDUCTION">FIFO Sale Deductions</option>
          <option value="STOCK_IN">Stock Received (IN)</option>
          <option value="STOCK_OUT">Stock Removed (OUT)</option>
          <option value="ADJUSTMENT">Manual Adjustments</option>
        </select>
      </div>

      {/* Ledger Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="p-3">Timestamp (ms)</th>
                <th className="p-3">Product Name & Barcode</th>
                <th className="p-3">Type</th>
                <th className="p-3 text-center">Qty Before</th>
                <th className="p-3 text-center">Change</th>
                <th className="p-3 text-center">Qty After</th>
                <th className="p-3">Batch / Ref No</th>
                <th className="p-3">User</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLedger.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">
                    No stock ledger records found.
                  </td>
                </tr>
              ) : (
                paginatedLedger.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition">
                    
                    <td className="p-3 font-mono text-[11px] text-slate-500">
                      {new Date(item.timestamp).toLocaleString()}
                    </td>

                    <td className="p-3">
                      <div className="font-bold text-slate-900">{item.product_name}</div>
                      <span className="font-mono text-[10px] text-slate-400">{item.barcode}</span>
                    </td>

                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                        item.qty_change < 0 ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-800'
                      }`}>
                        {item.type}
                      </span>
                    </td>

                    <td className="p-3 text-center font-mono font-semibold text-slate-600">
                      {item.qty_before}
                    </td>

                    <td className={`p-3 text-center font-mono font-black ${
                      item.qty_change < 0 ? 'text-red-600' : 'text-emerald-600'
                    }`}>
                      {item.qty_change > 0 ? `+${item.qty_change}` : item.qty_change}
                    </td>

                    <td className="p-3 text-center font-mono font-bold text-slate-900">
                      {item.qty_after}
                    </td>

                    <td className="p-3 font-mono text-[11px] text-slate-600">
                      <div>{item.reference_no}</div>
                      <span className="text-[10px] text-slate-400">{item.batch_no}</span>
                    </td>

                    <td className="p-3 font-medium text-slate-700">
                      {item.user_name}
                    </td>

                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Stock Ledger Pagination Bar */}
        <div className="p-3 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center space-x-2 text-slate-600">
            <span>Showing {filteredLedger.length === 0 ? 0 : (currentPage - 1) * (pageSize || filteredLedger.length) + 1} to {pageSize === 0 ? filteredLedger.length : Math.min(currentPage * pageSize, filteredLedger.length)} of {filteredLedger.length} ledger movements</span>
            <span className="text-slate-300">|</span>
            <div className="flex items-center space-x-1">
              <span>Per page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
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

          {totalPages > 1 && (
            <div className="flex items-center space-x-1">
              <button
                type="button"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-2.5 py-1 rounded bg-white border border-slate-300 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 font-bold transition"
              >
                Prev
              </button>
              <span className="px-2 py-1 font-semibold text-slate-700">
                Page {currentPage} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="px-2.5 py-1 rounded bg-white border border-slate-300 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 font-bold transition"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>

    </div>
  );
};

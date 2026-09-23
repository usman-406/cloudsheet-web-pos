import React, { useState } from 'react';
import { Product } from '../types';
import { 
  AlertTriangle, 
  Clock, 
  DollarSign, 
  Tag, 
  Layers, 
  Search, 
  ArrowRight, 
  TrendingDown, 
  PackageX,
  Sparkles,
  Download
} from 'lucide-react';

interface DeadStockAnalyzerProps {
  products: Product[];
  onApplyDiscount: (productId: string, discountPercent: number) => void;
}

export const DeadStockAnalyzer: React.FC<DeadStockAnalyzerProps> = ({
  products,
  onApplyDiscount,
}) => {
  const [daysThreshold, setDaysThreshold] = useState<30 | 60 | 90 | 180>(60);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Identify dead stock items (unsold for > daysThreshold or low stock velocity)
  // For demo simulation, items with stock > 0 and no recent sale or older date are flagged
  const categories = Array.from(new Set(products.map(p => p.category)));

  const deadStockItems = products.filter(p => {
    if (p.stock_qty <= 0) return false;
    if (selectedCategory !== 'ALL' && p.category !== selectedCategory) return false;

    if (p.last_sold_date) {
      const daysSinceSale = (Date.now() - new Date(p.last_sold_date).getTime()) / (1000 * 3600 * 24);
      return daysSinceSale >= daysThreshold;
    }
    // If no last_sold_date recorded, treat items created earlier with stock as slow moving
    return p.stock_qty >= 5;
  });

  const totalCapitalLocked = deadStockItems.reduce((acc, p) => acc + (p.buy_price * p.stock_qty), 0);
  const totalRetailLocked = deadStockItems.reduce((acc, p) => acc + (p.sell_price * p.stock_qty), 0);

  const exportDeadStockList = () => {
    const csvRows = [
      ['Barcode', 'Product Name', 'Category', 'Shelf Location', 'Stock Qty', 'Buy Price', 'Sell Price', 'Total Capital Locked'],
      ...deadStockItems.map(p => [
        p.barcode,
        p.name,
        p.category,
        p.shelf_location || 'Unassigned Shelf',
        p.stock_qty,
        p.buy_price,
        p.sell_price,
        Number((p.buy_price || 0) * (p.stock_qty || 0) || 0).toFixed(2)
      ])
    ];

    const csvContent = "data:text/csv;charset=utf-8," + csvRows.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Dead_Stock_Report_${daysThreshold}_Days.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 flex items-center space-x-2">
            <PackageX className="w-6 h-6 text-[#0f6cbd]" />
            <span>Dead Stock & Slow-Moving Inventory Analyzer</span>
          </h2>
          <p className="text-xs text-slate-500">Unclog trapped liquidity by identifying aging SKUs and launching instant clearance promos</p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={exportDeadStockList}
            className="px-3.5 py-1.5 bg-[#0f6cbd] hover:bg-[#115ea3] text-white font-bold rounded-xl text-xs flex items-center space-x-1.5 transition shadow-xs"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV Report</span>
          </button>
        </div>
      </div>

      {/* Capital Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        <div className="bg-amber-50 p-5 rounded-2xl border border-amber-200 shadow-xs space-y-1">
          <div className="text-xs font-bold text-amber-800 uppercase flex items-center justify-between">
            <span>Trapped Purchase Capital</span>
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-amber-950">Rs. {totalCapitalLocked.toLocaleString()}</div>
          <div className="text-[11px] text-amber-700">Cost value of {deadStockItems.length} slow-moving SKUs</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <div className="text-xs font-bold text-slate-500 uppercase">Potential Retail Revenue</div>
          <div className="text-2xl font-black text-slate-900">Rs. {totalRetailLocked.toLocaleString()}</div>
          <div className="text-[11px] text-slate-500">Value if sold at full standard price</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
          <div className="text-xs font-bold text-slate-500 uppercase">Inactivity Threshold Filter</div>
          <div className="flex gap-1.5">
            {([30, 60, 90, 180] as const).map((days) => (
              <button
                key={days}
                onClick={() => setDaysThreshold(days)}
                className={`px-3 py-1.5 rounded-xl font-extrabold text-xs transition ${
                  daysThreshold === days 
                    ? 'bg-[#0f6cbd] text-white shadow-xs' 
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {days} Days
              </button>
            ))}
          </div>
        </div>

      </div>

      {/* Slow Moving Products Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-3">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <h3 className="text-sm font-bold text-slate-800">Slow-Moving SKUs (&gt; {daysThreshold} Days Inactive)</h3>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="p-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold"
          >
            <option value="ALL">All Categories</option>
            {categories.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {deadStockItems.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            No dead stock detected above the {daysThreshold}-day inactivity threshold!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="p-3">Product Name</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Shelf Location</th>
                  <th className="p-3 text-center">Unsold Qty</th>
                  <th className="p-3">Cost Price</th>
                  <th className="p-3">Retail Price</th>
                  <th className="p-3">Capital Trapped</th>
                  <th className="p-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                {deadStockItems.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="p-3 font-bold font-sans text-slate-900">{item.name}</td>
                    <td className="p-3 font-sans text-slate-600">{item.category}</td>
                    <td className="p-3 font-sans text-slate-500">{item.shelf_location || 'Unassigned'}</td>
                    <td className="p-3 text-center font-extrabold text-amber-700">{item.stock_qty}</td>
                    <td className="p-3 text-slate-600">Rs. {item.buy_price.toLocaleString()}</td>
                    <td className="p-3 text-slate-900 font-bold">Rs. {item.sell_price.toLocaleString()}</td>
                    <td className="p-3 text-rose-700 font-bold">Rs. {(item.buy_price * item.stock_qty).toLocaleString()}</td>
                    <td className="p-3 text-center font-sans">
                      <button
                        onClick={() => onApplyDiscount(item.id, 20)}
                        className="px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold text-[10px] rounded-lg transition"
                      >
                        Apply 20% Clearance
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
};

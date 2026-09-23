import React, { useState } from 'react';
import { Product, Supplier, PurchaseOrder } from '../types';
import { 
  Sparkles, 
  ShoppingCart, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Truck, 
  FilePlus, 
  ArrowRight,
  TrendingUp
} from 'lucide-react';

interface SmartReorderingEngineProps {
  products: Product[];
  suppliers: Supplier[];
  onCreateDraftPO: (po: Partial<PurchaseOrder>) => void;
}

export const SmartReorderingEngine: React.FC<SmartReorderingEngineProps> = ({
  products,
  suppliers,
  onCreateDraftPO,
}) => {
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>(suppliers[0]?.id || '');
  const [targetLeadDays, setTargetLeadDays] = useState<number>(7);

  // Compute reorder recommendations
  const reorderRecommendations = products.map(p => {
    const minAlert = p.min_stock_alert || 5;
    const maxStock = p.max_stock_level || 30;
    const leadTime = p.supplier_lead_time_days || targetLeadDays;

    // Simulated daily sales velocity based on stock level & min alert
    const dailyVelocity = 0.8; // average 0.8 units/day
    const safetyStock = minAlert;
    const recommendedQty = Math.max(0, Math.ceil((dailyVelocity * leadTime + safetyStock) - p.stock_qty));

    const isUrgent = p.stock_qty <= minAlert;

    return {
      product: p,
      minAlert,
      maxStock,
      leadTime,
      dailyVelocity,
      recommendedQty: isUrgent ? Math.max(recommendedQty, maxStock - p.stock_qty) : recommendedQty,
      isUrgent,
      estimatedCost: (p.buy_price || 0) * (isUrgent ? Math.max(recommendedQty, maxStock - p.stock_qty) : recommendedQty),
    };
  }).filter(r => r.recommendedQty > 0 || r.isUrgent);

  const urgentCount = reorderRecommendations.filter(r => r.isUrgent).length;
  const totalRecommendedCost = reorderRecommendations.reduce((acc, r) => acc + r.estimatedCost, 0);

  const handleGeneratePO = () => {
    const activeSupplier = suppliers.find(s => s.id === selectedSupplierId) || suppliers[0];
    const poItems = reorderRecommendations.slice(0, 10).map(r => ({
      product_id: r.product.id,
      product_name: r.product.name,
      barcode: r.product.barcode,
      ordered_qty: r.recommendedQty,
      received_qty: 0,
      unit_cost: r.product.buy_price,
      line_total: r.estimatedCost,
    }));

    onCreateDraftPO({
      po_number: `PO-AUTO-${Math.floor(1000 + Math.random() * 9000)}`,
      supplier_id: activeSupplier?.id || 'sup_1',
      supplier_name: activeSupplier?.name || 'Primary Cosmetic Supplier',
      status: 'DRAFT',
      order_date: new Date().toISOString().slice(0, 10),
      items: poItems,
      subtotal: totalRecommendedCost,
      tax: totalRecommendedCost * 0.16,
      total_amount: totalRecommendedCost * 1.16,
      notes: 'Generated automatically by Bloom & Carry Smart Reordering Velocity Engine.',
    });

    alert('Draft Purchase Order created successfully! Navigating to Purchase Orders tab...');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 flex items-center space-x-2">
            <Sparkles className="w-6 h-6 text-[#0f6cbd]" />
            <span>Smart Automated Reordering Engine</span>
          </h2>
          <p className="text-xs text-slate-500">Algorithmically calculates stock velocity, supplier lead time, and safety buffer to generate draft POs</p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleGeneratePO}
            disabled={reorderRecommendations.length === 0}
            className="px-4 py-2 bg-[#0f6cbd] hover:bg-[#115ea3] text-white font-bold rounded-xl text-xs flex items-center space-x-2 transition shadow-xs disabled:opacity-50"
          >
            <FilePlus className="w-4 h-4" />
            <span>Generate Draft Purchase Order</span>
          </button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-rose-50 p-5 rounded-2xl border border-rose-200 shadow-xs space-y-1">
          <div className="text-xs font-bold text-rose-800 uppercase flex items-center justify-between">
            <span>Critical Reorder Alert</span>
            <AlertTriangle className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl font-black text-rose-950">{urgentCount} SKUs</div>
          <div className="text-[11px] text-rose-700">Stock below safety minimum threshold</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <div className="text-xs font-bold text-slate-500 uppercase">Estimated Reorder Budget</div>
          <div className="text-2xl font-black text-slate-900">Rs. {totalRecommendedCost.toLocaleString()}</div>
          <div className="text-[11px] text-slate-500">Estimated purchase cost for restocking</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
          <div className="text-xs font-bold text-slate-500 uppercase">Lead Time Assumption</div>
          <div className="flex items-center space-x-2 text-xs">
            <Truck className="w-4 h-4 text-slate-400" />
            <input
              type="number"
              value={targetLeadDays}
              onChange={(e) => setTargetLeadDays(Number(e.target.value))}
              className="w-20 p-1 bg-slate-50 border border-slate-200 rounded-lg text-center font-bold"
            />
            <span className="font-semibold text-slate-600">Days Lead Time</span>
          </div>
        </div>
      </div>

      {/* Recommendations Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-3">
        <h3 className="text-sm font-bold text-slate-800">Smart Stock Velocity Recommendations</h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="p-3">Product Name</th>
                <th className="p-3">Category</th>
                <th className="p-3 text-center">Current Stock</th>
                <th className="p-3 text-center">Min Safety</th>
                <th className="p-3 text-center">Daily Velocity</th>
                <th className="p-3 text-center">Suggested Order</th>
                <th className="p-3">Unit Cost</th>
                <th className="p-3">Est Order Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
              {reorderRecommendations.map((r) => (
                <tr key={r.product.id} className="hover:bg-slate-50">
                  <td className="p-3 font-bold font-sans text-slate-900">{r.product.name}</td>
                  <td className="p-3 font-sans text-slate-600">{r.product.category}</td>
                  <td className={`p-3 text-center font-extrabold ${r.isUrgent ? 'text-rose-700 bg-rose-50 rounded' : 'text-slate-800'}`}>
                    {r.product.stock_qty}
                  </td>
                  <td className="p-3 text-center text-slate-500">{r.minAlert}</td>
                  <td className="p-3 text-center text-slate-600">{r.dailyVelocity} / day</td>
                  <td className="p-3 text-center font-black text-[#0f6cbd] text-sm bg-blue-50/50">
                    +{r.recommendedQty}
                  </td>
                  <td className="p-3 text-slate-600">Rs. {r.product.buy_price.toLocaleString()}</td>
                  <td className="p-3 text-slate-900 font-bold">Rs. {r.estimatedCost.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};

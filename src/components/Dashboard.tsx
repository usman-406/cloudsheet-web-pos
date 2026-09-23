import React, { useMemo } from 'react';
import { 
  TrendingUp, 
  DollarSign, 
  ShoppingBag, 
  AlertTriangle, 
  ArrowUpRight, 
  CreditCard, 
  CheckCircle,
  PackageCheck,
  RotateCcw,
  Receipt,
  Wallet
} from 'lucide-react';
import { Sale, Product, ShopSettings, ReturnTransaction, Expense } from '../types';

interface DashboardProps {
  sales: Sale[];
  products: Product[];
  returns?: ReturnTransaction[];
  expenses?: Expense[];
  settings: ShopSettings;
  onNavigateToProducts: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  sales,
  products,
  returns = [],
  expenses = [],
  settings,
  onNavigateToProducts,
}) => {
  const {
    todayGrossRevenue,
    todayTotalRefunds,
    todayNetRevenue,
    todayProfit,
    completedOrdersCount,
    refundedOrdersCount,
    lowStockProducts,
    paymentMethodStats,
    topSellingProducts,
    todaySales,
    todayReturns,
  } = useMemo(() => {
    // Today's Date Strings
    const todayStr = new Date().toISOString().split('T')[0];

    // Map for O(1) product lookups
    const productMap = new Map<string, Product>();
    products.forEach(p => productMap.set(p.id, p));

    // 1. Today's Non-Voided Sales
    const todaySales = sales.filter(s => {
      const saleDate = new Date(s.datetime).toISOString().split('T')[0];
      return saleDate === todayStr && s.status !== 'voided';
    });

    // 2. Today's Returns / Refunds
    const todayReturns = returns.filter(r => {
      const returnDate = new Date(r.datetime).toISOString().split('T')[0];
      return returnDate === todayStr && r.status !== 'VOIDED';
    });

    // Gross Sales Revenue Today
    const grossRev = todaySales.reduce((acc, s) => acc + (Number(s.total) || 0), 0);

    // Total Refunds Today
    const returnsTotalToday = todayReturns.reduce((acc, r) => acc + (Number(r.total_refund_amount) || 0), 0);
    const salesRefundTotalToday = todaySales.reduce((acc, s) => acc + (Number(s.total_refunded) || 0), 0);
    const totalRefunds = Math.max(returnsTotalToday, salesRefundTotalToday);

    // Net Revenue Today
    const netRev = Math.max(0, grossRev - totalRefunds);

    // 3. Today's Net Profit Calculation:
    let profit = 0;
    todaySales.forEach(s => {
      if (s.status === 'refunded') return;
      let saleLineProfit = 0;
      s.items.forEach(item => {
        const buyPrice = Number(item.buy_price) || 0;
        const sellPrice = Number(item.sell_price) || 0;
        const returnedQty = Number(item.returned_qty) || 0;
        const effectiveQty = Math.max(0, item.quantity - returnedQty);

        if (effectiveQty > 0) {
          const itemDiscount = (Number(item.discount) || 0) * (effectiveQty / (item.quantity || 1));
          const lineRevenue = (sellPrice * effectiveQty) - itemDiscount;
          const lineCost = buyPrice * effectiveQty;
          const lineProfit = lineRevenue - lineCost;
          saleLineProfit += lineProfit;
        }
      });

      const totalLineDiscounts = s.items.reduce((sum, it) => sum + (Number(it.discount) || 0), 0);
      const invoiceLevelDiscount = Math.max(0, (Number(s.discount) || 0) - totalLineDiscounts);
      profit += Math.max(0, saleLineProfit - invoiceLevelDiscount);
    });

    // Deduct write-offs for damaged goods returned today
    todayReturns.forEach(r => {
      (r.items || []).forEach(ri => {
        if (ri.condition === 'DAMAGED_WRITE_OFF' || ri.condition === 'EXPIRED_SCRAP') {
          const itemProd = productMap.get(ri.product_id);
          const buyCost = itemProd?.buy_price || 0;
          profit = Math.max(0, profit - (buyCost * ri.return_quantity));
        }
      });
    });

    const completedCount = todaySales.filter(s => s.status === 'completed' || s.status === 'partially_refunded').length;
    const refundedCount = todaySales.filter(s => s.status === 'refunded').length + todayReturns.length;

    // 4. Low stock products
    const lowStock = products.filter(p => p.stock_qty <= (p.min_stock_alert || 5));

    // 5. Payment method breakdown
    const pmStats: Record<string, { gross: number; refunded: number; net: number }> = {
      Cash: { gross: 0, refunded: 0, net: 0 },
      Card: { gross: 0, refunded: 0, net: 0 },
      Easypaisa: { gross: 0, refunded: 0, net: 0 },
      JazzCash: { gross: 0, refunded: 0, net: 0 },
      Store_Credit: { gross: 0, refunded: 0, net: 0 },
    };

    todaySales.forEach(s => {
      const pm = s.payment_method || 'Cash';
      if (!pmStats[pm]) {
        pmStats[pm] = { gross: 0, refunded: 0, net: 0 };
      }
      const saleTotal = Number(s.total) || 0;
      const saleRefund = Number(s.total_refunded) || 0;
      pmStats[pm].gross += saleTotal;
      pmStats[pm].refunded += saleRefund;
      pmStats[pm].net += Math.max(0, saleTotal - saleRefund);
    });

    const todaySaleIds = new Set(todaySales.map(s => s.id));
    todayReturns.forEach(r => {
      const rm = r.refund_method || 'Cash';
      if (!pmStats[rm]) {
        pmStats[rm] = { gross: 0, refunded: 0, net: 0 };
      }
      if (!todaySaleIds.has(r.original_sale_id)) {
        pmStats[rm].refunded += Number(r.total_refund_amount) || 0;
        pmStats[rm].net = Math.max(0, pmStats[rm].net - (Number(r.total_refund_amount) || 0));
      }
    });

    // 6. Top Selling Products Calculation
    const productSalesMap: Record<string, { name: string; qty: number; revenue: number }> = {};
    sales.filter(s => s.status !== 'voided').forEach(s => {
      s.items.forEach(item => {
        const returnedQty = Number(item.returned_qty) || 0;
        const effectiveQty = Math.max(0, item.quantity - returnedQty);
        if (effectiveQty > 0) {
          if (!productSalesMap[item.name]) {
            productSalesMap[item.name] = { name: item.name, qty: 0, revenue: 0 };
          }
          productSalesMap[item.name].qty += effectiveQty;
          const lineNetRevenue = (Number(item.sell_price) * effectiveQty) - ((Number(item.discount) || 0) * (effectiveQty / (item.quantity || 1)));
          productSalesMap[item.name].revenue += Math.max(0, lineNetRevenue);
        }
      });
    });

    const topSelling = Object.values(productSalesMap)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    return {
      todayGrossRevenue: grossRev,
      todayTotalRefunds: totalRefunds,
      todayNetRevenue: netRev,
      todayProfit: profit,
      completedOrdersCount: completedCount,
      refundedOrdersCount: refundedCount,
      lowStockProducts: lowStock,
      paymentMethodStats: pmStats,
      topSellingProducts: topSelling,
      todaySales,
      todayReturns,
    };
  }, [sales, products, returns]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-800">BoomandCarry Cosmetics Dashboard</h2>
          <p className="text-xs text-slate-500 mt-0.5">Real-time audited accounting, inventory balances & net revenue metrics</p>
        </div>
        <div className="flex items-center space-x-2">
          <span className="bg-blue-50 text-[#0f6cbd] border border-blue-200 px-3 py-1 rounded-xl text-xs font-bold flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Today: {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
          </span>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Today's Net Revenue */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-[#0f6cbd] transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Today's Net Revenue</span>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#0f6cbd] flex items-center justify-center">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-black text-slate-900">
              {settings.currency_symbol} {todayNetRevenue.toLocaleString()}
            </h3>
            {todayTotalRefunds > 0 ? (
              <div className="mt-1 flex items-center space-x-1.5 text-[11px]">
                <span className="text-slate-400 line-through">Gross: {settings.currency_symbol}{todayGrossRevenue.toLocaleString()}</span>
                <span className="text-rose-600 font-bold bg-rose-50 px-1.5 py-0.5 rounded">
                  -{settings.currency_symbol}{todayTotalRefunds.toLocaleString()} refunded
                </span>
              </div>
            ) : (
              <p className="text-xs text-emerald-600 font-semibold flex items-center mt-1">
                <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" />
                <span>{completedOrdersCount} Active Invoices Today</span>
              </p>
            )}
          </div>
        </div>

        {/* Today's Net Profit */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-emerald-300 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Net Profit Today</span>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-black text-emerald-700">
              {settings.currency_symbol} {todayProfit.toLocaleString()}
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-1">
              Net profit after product cost & returns
            </p>
          </div>
        </div>

        {/* Total Invoices & Returns */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-indigo-300 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Transactions Today</span>
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <ShoppingBag className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-black text-slate-900">
              {todaySales.length} Bills
            </h3>
            <div className="text-xs text-indigo-700 font-semibold mt-1 flex items-center justify-between">
              <span>{completedOrdersCount} Active</span>
              {todayReturns.length > 0 && (
                <span className="text-rose-600 font-bold bg-rose-50 px-1.5 py-0.5 rounded">
                  {todayReturns.length} Return{todayReturns.length > 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Low Stock Warning */}
        <div 
          onClick={onNavigateToProducts}
          className="bg-white p-5 rounded-2xl border border-amber-200 bg-amber-50/20 shadow-xs hover:border-amber-400 cursor-pointer transition"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-800 uppercase tracking-wide">Low Stock Alert</span>
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-black text-amber-900">
              {lowStockProducts.length} Items
            </h3>
            <p className="text-xs text-amber-700 font-semibold mt-1 underline">
              Click to view stock inventory & restock →
            </p>
          </div>
        </div>

      </div>

      {/* Middle Grid: Payment Breakdown + Top Selling */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Payment Methods Breakdown */}
        <div className="lg:col-span-5 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <h3 className="font-bold text-slate-800 text-sm flex items-center space-x-2">
              <CreditCard className="w-4 h-4 text-[#0b5fa5]" />
              <span>Today's Payment Collections (Net)</span>
            </h3>
            <span className="text-xs font-bold text-slate-500">
              Total: {settings.currency_symbol}{todayNetRevenue.toLocaleString()}
            </span>
          </div>

          <div className="space-y-3">
            {['Cash', 'Card', 'Easypaisa', 'JazzCash', 'Store_Credit'].map((pm) => {
              const stat = paymentMethodStats[pm] || { gross: 0, refunded: 0, net: 0 };
              const percentage = todayNetRevenue > 0 ? Math.round((stat.net / todayNetRevenue) * 100) : 0;

              return (
                <div key={pm} className="space-y-1">
                  <div className="flex justify-between text-xs font-bold text-slate-700">
                    <span className="capitalize">{pm.replace('_', ' ')}</span>
                    <div className="text-right">
                      <span>{settings.currency_symbol} {stat.net.toLocaleString()} ({percentage}%)</span>
                      {stat.refunded > 0 && (
                        <span className="text-[10px] text-rose-500 block font-normal">
                          (-{settings.currency_symbol}{stat.refunded.toLocaleString()} refunded)
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        pm === 'Cash' 
                          ? 'bg-emerald-500' 
                          : pm === 'Card' 
                          ? 'bg-[#0b5fa5]' 
                          : pm === 'Easypaisa' 
                          ? 'bg-emerald-600' 
                          : pm === 'JazzCash' 
                          ? 'bg-red-500' 
                          : 'bg-purple-500'
                      }`}
                      style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Selling Products */}
        <div className="lg:col-span-7 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <h3 className="font-bold text-slate-800 text-sm flex items-center space-x-2">
              <PackageCheck className="w-4 h-4 text-[#0b5fa5]" />
              <span>Top Selling Products (Net Sold)</span>
            </h3>
            <span className="text-xs text-slate-400 font-medium">Accounting for returns</span>
          </div>

          <div className="divide-y divide-slate-100 text-xs">
            {topSellingProducts.length === 0 ? (
              <p className="text-slate-400 py-6 text-center">No sales recorded yet</p>
            ) : (
              topSellingProducts.map((p, idx) => (
                <div key={idx} className="py-2.5 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <span className="w-6 h-6 rounded-full bg-blue-50 text-[#0b5fa5] font-black text-xs flex items-center justify-center">
                      #{idx + 1}
                    </span>
                    <span className="font-bold text-slate-800 text-sm">{p.name}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-extrabold text-slate-900 block">{p.qty} Units Sold</span>
                    <span className="text-slate-500 text-[11px]">{settings.currency_symbol} {p.revenue.toLocaleString()}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* Low Stock Alert Table */}
      {lowStockProducts.length > 0 && (
        <div className="bg-amber-50/50 border border-amber-200 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              <h3 className="font-bold text-amber-900 text-sm">Low Stock Items Requiring Restock</h3>
            </div>
            <button
              type="button"
              onClick={onNavigateToProducts}
              className="bg-amber-600 text-white px-3 py-1.5 rounded-xl text-xs font-bold hover:bg-amber-700 transition cursor-pointer"
            >
              Go to Inventory Manager →
            </button>
          </div>

          <div className="overflow-x-auto bg-white rounded-xl border border-amber-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-amber-100/60 text-amber-900 font-bold border-b border-amber-200">
                <tr>
                  <th className="p-3">Barcode</th>
                  <th className="p-3">Product Name</th>
                  <th className="p-3">Category</th>
                  <th className="p-3 text-center">Current Stock</th>
                  <th className="p-3 text-center">Min Threshold</th>
                  <th className="p-3 text-right">Sell Price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-100">
                {lowStockProducts.map((p) => (
                  <tr key={p.id} className="hover:bg-amber-50/50">
                    <td className="p-3 font-mono text-slate-500">{p.barcode}</td>
                    <td className="p-3 font-bold text-slate-800">{p.name}</td>
                    <td className="p-3 text-slate-600">{p.category}</td>
                    <td className="p-3 text-center">
                      <span className="bg-red-100 text-red-700 font-extrabold px-2 py-0.5 rounded-full text-[11px]">
                        {p.stock_qty} left
                      </span>
                    </td>
                    <td className="p-3 text-center font-medium text-slate-500">{p.min_stock_alert || 5}</td>
                    <td className="p-3 text-right font-bold text-slate-900">{settings.currency_symbol} {p.sell_price}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
};


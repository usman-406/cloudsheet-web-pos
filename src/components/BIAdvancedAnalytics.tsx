import React, { useState, useMemo } from 'react';
import { Sale, Product, Customer, Supplier, ShopSettings, ReturnTransaction, Expense } from '../types';
import { 
  BarChart3, 
  TrendingUp, 
  DollarSign, 
  ShoppingBag, 
  Users, 
  RefreshCw, 
  ArrowUpRight, 
  ArrowDownRight, 
  Percent, 
  Download, 
  Calendar,
  Layers,
  Award,
  Clock,
  PieChart,
  Activity,
  CheckCircle2,
  AlertCircle,
  CreditCard,
  ChevronRight,
  Package,
  Wallet,
  RotateCcw
} from 'lucide-react';

interface BIAdvancedAnalyticsProps {
  sales: Sale[];
  products: Product[];
  customers: Customer[];
  suppliers: Supplier[];
  returns?: ReturnTransaction[];
  expenses?: Expense[];
  settings: ShopSettings;
  onRefresh?: () => void;
  onNavigateToTab?: (tab: any) => void;
}

type TimeframePreset = 'today' | '7d' | '30d' | '90d' | 'year' | 'all' | 'custom';

export const BIAdvancedAnalytics: React.FC<BIAdvancedAnalyticsProps> = ({
  sales,
  products,
  customers,
  suppliers: _suppliers,
  returns = [],
  expenses = [],
  settings,
  onRefresh,
  onNavigateToTab,
}) => {
  const [timeframe, setTimeframe] = useState<TimeframePreset>('30d');
  const [customStart, setCustomStart] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [customEnd, setCustomEnd] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [chartMetric, setChartMetric] = useState<'revenue' | 'profit' | 'both'>('both');

  // Product map for fast O(1) lookups
  const productMap = useMemo(() => {
    const map = new Map<string, Product>();
    products.forEach(p => map.set(p.id, p));
    return map;
  }, [products]);

  // Calculate Start and End timestamps based on timeframe selection
  const { rangeStart, rangeEnd, rangeLabel } = useMemo(() => {
    const now = new Date();
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();

    if (timeframe === 'today') {
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
      return { rangeStart: startOfDay, rangeEnd: endOfDay, rangeLabel: 'Today' };
    }
    if (timeframe === '7d') {
      const d = new Date(now);
      d.setDate(d.getDate() - 6);
      d.setHours(0, 0, 0, 0);
      return { rangeStart: d.getTime(), rangeEnd: endOfDay, rangeLabel: 'Last 7 Days' };
    }
    if (timeframe === '30d') {
      const d = new Date(now);
      d.setDate(d.getDate() - 29);
      d.setHours(0, 0, 0, 0);
      return { rangeStart: d.getTime(), rangeEnd: endOfDay, rangeLabel: 'Last 30 Days' };
    }
    if (timeframe === '90d') {
      const d = new Date(now);
      d.setDate(d.getDate() - 89);
      d.setHours(0, 0, 0, 0);
      return { rangeStart: d.getTime(), rangeEnd: endOfDay, rangeLabel: 'Last 90 Days' };
    }
    if (timeframe === 'year') {
      const d = new Date(now);
      d.setDate(d.getDate() - 364);
      d.setHours(0, 0, 0, 0);
      return { rangeStart: d.getTime(), rangeEnd: endOfDay, rangeLabel: 'Last 365 Days' };
    }
    if (timeframe === 'custom') {
      const s = new Date(customStart + 'T00:00:00').getTime();
      const e = new Date(customEnd + 'T23:59:59').getTime();
      return { 
        rangeStart: isNaN(s) ? 0 : s, 
        rangeEnd: isNaN(e) ? endOfDay : e, 
        rangeLabel: `${customStart} to ${customEnd}` 
      };
    }
    // 'all'
    return { rangeStart: 0, rangeEnd: Infinity, rangeLabel: 'All Time Historical' };
  }, [timeframe, customStart, customEnd]);

  // Safe timestamp parser
  const getTimestamp = (datetimeStr: string | undefined): number => {
    if (!datetimeStr) return 0;
    const t = new Date(datetimeStr).getTime();
    return isNaN(t) ? 0 : t;
  };

  // Filter Sales in selected period
  const filteredSales = useMemo(() => {
    return sales.filter(s => {
      if (s.status === 'voided' || s.status === 'refunded') return false;
      const t = getTimestamp(s.datetime);
      if (timeframe === 'all') return true;
      return t >= rangeStart && t <= rangeEnd;
    });
  }, [sales, rangeStart, rangeEnd, timeframe]);

  // Filter Returns in selected period
  const filteredReturns = useMemo(() => {
    return returns.filter(r => {
      if (r.status === 'CANCELLED') return false;
      const t = getTimestamp(r.datetime);
      if (timeframe === 'all') return true;
      return t >= rangeStart && t <= rangeEnd;
    });
  }, [returns, rangeStart, rangeEnd, timeframe]);

  // Filter Expenses in selected period
  const filteredExpenses = useMemo(() => {
    return expenses.filter(e => {
      if (e.status === 'REJECTED') return false;
      const t = getTimestamp(e.date);
      if (timeframe === 'all') return true;
      return t >= rangeStart && t <= rangeEnd;
    });
  }, [expenses, rangeStart, rangeEnd, timeframe]);

  // Financial KPI Calculations
  const grossSalesRevenue = useMemo(() => {
    return filteredSales.reduce((acc, s) => acc + (Number(s.total) || 0), 0);
  }, [filteredSales]);

  const totalRefundAmount = useMemo(() => {
    const fromReturns = filteredReturns.reduce((acc, r) => acc + (Number(r.total_refund_amount) || 0), 0);
    const fromSales = filteredSales.reduce((acc, s) => acc + (Number(s.total_refunded) || 0), 0);
    return Math.max(fromReturns, fromSales);
  }, [filteredReturns, filteredSales]);

  const netSalesRevenue = useMemo(() => {
    return Math.max(0, grossSalesRevenue - totalRefundAmount);
  }, [grossSalesRevenue, totalRefundAmount]);

  // Cost of Goods Sold (COGS)
  const totalCOGS = useMemo(() => {
    let cost = 0;
    filteredSales.forEach(sale => {
      sale.items.forEach(item => {
        let buyPrice = item.buy_price;
        if (buyPrice === undefined || buyPrice === null || buyPrice === 0) {
          const p = productMap.get(item.product_id);
          buyPrice = p?.buy_price || 0;
        }
        cost += (Number(buyPrice) || 0) * (Number(item.quantity) || 1);
      });
    });

    // Subtract cost of restocked returned items
    let restockedCost = 0;
    filteredReturns.forEach(ret => {
      ret.items.forEach(item => {
        if (item.action === 'RESTOCK' || item.action === 'RESALE') {
          const buyPrice = item.buy_price || productMap.get(item.product_id)?.buy_price || 0;
          restockedCost += (Number(buyPrice) || 0) * (Number(item.quantity) || 1);
        }
      });
    });

    return Math.max(0, cost - restockedCost);
  }, [filteredSales, filteredReturns, productMap]);

  const grossProfit = useMemo(() => {
    return netSalesRevenue - totalCOGS;
  }, [netSalesRevenue, totalCOGS]);

  const grossProfitMargin = useMemo(() => {
    return netSalesRevenue > 0 ? (grossProfit / netSalesRevenue) * 100 : 0;
  }, [grossProfit, netSalesRevenue]);

  const totalOperatingExpenses = useMemo(() => {
    return filteredExpenses.reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
  }, [filteredExpenses]);

  const netOperatingIncome = useMemo(() => {
    return grossProfit - totalOperatingExpenses;
  }, [grossProfit, totalOperatingExpenses]);

  const netOperatingMargin = useMemo(() => {
    return netSalesRevenue > 0 ? (netOperatingIncome / netSalesRevenue) * 100 : 0;
  }, [netOperatingIncome, netSalesRevenue]);

  // Operational & Basket Metrics
  const totalOrders = filteredSales.length;
  const avgBasketSize = totalOrders > 0 ? netSalesRevenue / totalOrders : 0;
  
  const totalUnitsSold = useMemo(() => {
    return filteredSales.reduce((acc, s) => {
      const itemsQty = s.items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
      return acc + itemsQty;
    }, 0);
  }, [filteredSales]);

  const avgItemsPerOrder = totalOrders > 0 ? totalUnitsSold / totalOrders : 0;

  // Customer Loyalty & CLV Metrics
  const activeCustomersCount = useMemo(() => {
    const custSet = new Set<string>();
    filteredSales.forEach(s => {
      if (s.customer_id) custSet.add(s.customer_id);
      else if (s.customer_phone) custSet.add(s.customer_phone);
    });
    return custSet.size;
  }, [filteredSales]);

  const repeatCustomersCount = useMemo(() => {
    return customers.filter(c => (c.order_count || 0) > 1).length;
  }, [customers]);

  const repeatCustomerRate = useMemo(() => {
    return customers.length > 0 ? (repeatCustomersCount / customers.length) * 100 : 0;
  }, [repeatCustomersCount, customers.length]);

  const avgCLV = useMemo(() => {
    return customers.length > 0 
      ? customers.reduce((acc, c) => acc + (Number(c.total_spent) || 0), 0) / customers.length 
      : 0;
  }, [customers]);

  // Inventory Asset Valuation
  const totalInventoryWholesaleCost = useMemo(() => {
    return products.reduce((acc, p) => acc + ((Number(p.buy_price) || 0) * (Number(p.stock_qty) || 0)), 0);
  }, [products]);

  const totalInventoryRetailValue = useMemo(() => {
    return products.reduce((acc, p) => acc + ((Number(p.sell_price) || 0) * (Number(p.stock_qty) || 0)), 0);
  }, [products]);

  const lowStockCount = useMemo(() => {
    return products.filter(p => p.stock_qty <= (p.min_stock_level || 5)).length;
  }, [products]);

  const outOfStockCount = useMemo(() => {
    return products.filter(p => p.stock_qty <= 0).length;
  }, [products]);

  // Category Revenue & Profit Breakdown
  const categoryPerformance = useMemo(() => {
    const catMap: Record<string, { revenue: number; units: number; cost: number }> = {};

    filteredSales.forEach(sale => {
      sale.items.forEach(item => {
        const prod = productMap.get(item.product_id);
        const cat = prod?.category || 'Cosmetics & Skincare';
        const itemRevenue = Number(item.total) || 0;
        const itemQty = Number(item.quantity) || 1;
        const buyPrice = Number(item.buy_price ?? prod?.buy_price ?? 0);
        const itemCost = buyPrice * itemQty;

        if (!catMap[cat]) {
          catMap[cat] = { revenue: 0, units: 0, cost: 0 };
        }
        catMap[cat].revenue += itemRevenue;
        catMap[cat].units += itemQty;
        catMap[cat].cost += itemCost;
      });
    });

    return Object.keys(catMap).map(category => {
      const data = catMap[category];
      const profit = data.revenue - data.cost;
      return {
        category,
        revenue: data.revenue,
        units: data.units,
        profit,
        margin: data.revenue > 0 ? (profit / data.revenue) * 100 : 0,
        percentage: netSalesRevenue > 0 ? (data.revenue / netSalesRevenue) * 100 : 0,
      };
    }).sort((a, b) => b.revenue - a.revenue);
  }, [filteredSales, productMap, netSalesRevenue]);

  // Payment Method Breakdown
  const paymentMethodStats = useMemo(() => {
    const methodMap: Record<string, { count: number; total: number }> = {};

    filteredSales.forEach(sale => {
      const method = sale.payment_method || 'CASH';
      if (!methodMap[method]) {
        methodMap[method] = { count: 0, total: 0 };
      }
      methodMap[method].count += 1;
      methodMap[method].total += Number(sale.total) || 0;
    });

    return Object.keys(methodMap).map(method => ({
      method,
      count: methodMap[method].count,
      total: methodMap[method].total,
      percentage: grossSalesRevenue > 0 ? (methodMap[method].total / grossSalesRevenue) * 100 : 0,
    })).sort((a, b) => b.total - a.total);
  }, [filteredSales, grossSalesRevenue]);

  // Hourly Peak Shopping Velocity (0-23 hours)
  const hourlyVelocity = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, i) => ({ hour: i, count: 0, revenue: 0 }));

    filteredSales.forEach(s => {
      try {
        const d = new Date(s.datetime);
        const hr = d.getHours();
        if (hr >= 0 && hr < 24) {
          hours[hr].count += 1;
          hours[hr].revenue += Number(s.total) || 0;
        }
      } catch {
        // Ignore invalid dates
      }
    });

    let peakHour = 0;
    let maxCount = 0;
    hours.forEach(h => {
      if (h.count > maxCount) {
        maxCount = h.count;
        peakHour = h.hour;
      }
    });

    return { hours, peakHour, maxCount };
  }, [filteredSales]);

  // Top Performing Products
  const topProducts = useMemo(() => {
    const prodMap: Record<string, { product_id: string; name: string; category: string; units: number; revenue: number; cost: number }> = {};

    filteredSales.forEach(sale => {
      sale.items.forEach(item => {
        const key = item.product_id || item.name;
        const prod = productMap.get(item.product_id);
        const name = item.name || prod?.name || 'Cosmetic Item';
        const category = prod?.category || 'General';
        const qty = Number(item.quantity) || 1;
        const rev = Number(item.total) || 0;
        const buyPrice = Number(item.buy_price ?? prod?.buy_price ?? 0);
        const cost = buyPrice * qty;

        if (!prodMap[key]) {
          prodMap[key] = {
            product_id: item.product_id,
            name,
            category,
            units: 0,
            revenue: 0,
            cost: 0,
          };
        }
        prodMap[key].units += qty;
        prodMap[key].revenue += rev;
        prodMap[key].cost += cost;
      });
    });

    return Object.values(prodMap).map(p => {
      const prod = productMap.get(p.product_id);
      const profit = p.revenue - p.cost;
      return {
        ...p,
        profit,
        margin: p.revenue > 0 ? (profit / p.revenue) * 100 : 0,
        current_stock: prod?.stock_qty ?? 0,
        sku: prod?.sku || prod?.barcode || '-',
      };
    }).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  }, [filteredSales, productMap]);

  // Time Series Trend Data for SVG Visualizer
  const trendBuckets = useMemo(() => {
    // If today: 8 three-hour blocks
    // If 7d or 30d: daily buckets
    // If 90d or year or all: weekly or monthly buckets
    const bucketMap: Record<string, { label: string; revenue: number; profit: number; orderCount: number; timestamp: number }> = {};

    if (timeframe === 'today') {
      for (let h = 0; h < 24; h += 3) {
        const label = `${h.toString().padStart(2, '0')}:00`;
        bucketMap[label] = { label, revenue: 0, profit: 0, orderCount: 0, timestamp: h };
      }
      filteredSales.forEach(sale => {
        const hr = new Date(sale.datetime).getHours();
        const block = Math.floor(hr / 3) * 3;
        const label = `${block.toString().padStart(2, '0')}:00`;
        if (bucketMap[label]) {
          const rev = Number(sale.total) || 0;
          let cost = 0;
          sale.items.forEach(i => {
            const bp = i.buy_price ?? productMap.get(i.product_id)?.buy_price ?? 0;
            cost += bp * (i.quantity || 1);
          });
          bucketMap[label].revenue += rev;
          bucketMap[label].profit += (rev - cost);
          bucketMap[label].orderCount += 1;
        }
      });
    } else {
      // Days generator
      const numDays = timeframe === '7d' ? 7 : (timeframe === '30d' ? 30 : (timeframe === '90d' ? 14 : 12));
      
      if (timeframe === '7d' || timeframe === '30d' || timeframe === 'custom') {
        filteredSales.forEach(sale => {
          const dayStr = new Date(sale.datetime).toISOString().slice(5, 10); // MM-DD
          if (!bucketMap[dayStr]) {
            bucketMap[dayStr] = { label: dayStr, revenue: 0, profit: 0, orderCount: 0, timestamp: new Date(sale.datetime).getTime() };
          }
          const rev = Number(sale.total) || 0;
          let cost = 0;
          sale.items.forEach(i => {
            const bp = i.buy_price ?? productMap.get(i.product_id)?.buy_price ?? 0;
            cost += bp * (i.quantity || 1);
          });
          bucketMap[dayStr].revenue += rev;
          bucketMap[dayStr].profit += (rev - cost);
          bucketMap[dayStr].orderCount += 1;
        });
      } else {
        // Month or quarter grouping
        filteredSales.forEach(sale => {
          const monthStr = new Date(sale.datetime).toISOString().slice(0, 7); // YYYY-MM
          if (!bucketMap[monthStr]) {
            bucketMap[monthStr] = { label: monthStr, revenue: 0, profit: 0, orderCount: 0, timestamp: new Date(sale.datetime).getTime() };
          }
          const rev = Number(sale.total) || 0;
          let cost = 0;
          sale.items.forEach(i => {
            const bp = i.buy_price ?? productMap.get(i.product_id)?.buy_price ?? 0;
            cost += bp * (i.quantity || 1);
          });
          bucketMap[monthStr].revenue += rev;
          bucketMap[monthStr].profit += (rev - cost);
          bucketMap[monthStr].orderCount += 1;
        });
      }
    }

    return Object.values(bucketMap).sort((a, b) => a.timestamp - b.timestamp);
  }, [filteredSales, timeframe, productMap]);

  // Max value for trend scaling
  const maxTrendValue = useMemo(() => {
    let m = 0;
    trendBuckets.forEach(b => {
      if (b.revenue > m) m = b.revenue;
      if (b.profit > m) m = b.profit;
    });
    return Math.max(m, 100);
  }, [trendBuckets]);

  // Handle Manual Refresh
  const handleTriggerRefresh = async () => {
    setIsRefreshing(true);
    if (onRefresh) {
      await onRefresh();
    }
    setTimeout(() => {
      setIsRefreshing(false);
    }, 600);
  };

  // Export Executive BI Report as CSV
  const exportBIReport = () => {
    const currency = settings.currency_symbol || 'Rs.';
    const rows: (string | number)[][] = [
      ['Bloom & Carry Cosmetics - Executive Business Intelligence Report'],
      ['Timeframe Scope', rangeLabel],
      ['Generated On', new Date().toLocaleString()],
      [''],
      ['FINANCIAL SUMMARY', 'VALUE'],
      ['Gross Sales Revenue', `${currency} ${grossSalesRevenue.toFixed(2)}`],
      ['Total Returns & Refunds', `${currency} ${totalRefundAmount.toFixed(2)}`],
      ['Net Sales Revenue', `${currency} ${netSalesRevenue.toFixed(2)}`],
      ['Cost of Goods Sold (COGS)', `${currency} ${totalCOGS.toFixed(2)}`],
      ['Gross Profit', `${currency} ${grossProfit.toFixed(2)}`],
      ['Gross Profit Margin', `${grossProfitMargin.toFixed(2)}%`],
      ['Operating Expenses', `${currency} ${totalOperatingExpenses.toFixed(2)}`],
      ['Net Operating Income (EBITDA)', `${currency} ${netOperatingIncome.toFixed(2)}`],
      ['Net Operating Margin', `${netOperatingMargin.toFixed(2)}%`],
      [''],
      ['OPERATIONAL & BASKET METRICS', 'VALUE'],
      ['Total Completed Orders', totalOrders],
      ['Average Basket Value (AOV)', `${currency} ${avgBasketSize.toFixed(2)}`],
      ['Total Cosmetic Units Sold', totalUnitsSold],
      ['Average Items Per Order', avgItemsPerOrder.toFixed(2)],
      [''],
      ['CUSTOMER METRICS', 'VALUE'],
      ['Total Registered Customers', customers.length],
      ['Active Customers In Period', activeCustomersCount],
      ['Repeat Customer Rate', `${repeatCustomerRate.toFixed(2)}%`],
      ['Average Customer Lifetime Value (CLV)', `${currency} ${avgCLV.toFixed(2)}`],
      [''],
      ['INVENTORY & ASSET VALUATION', 'VALUE'],
      ['Total Stock Wholesale Value', `${currency} ${totalInventoryWholesaleCost.toFixed(2)}`],
      ['Total Stock Retail Value (MSRP)', `${currency} ${totalInventoryRetailValue.toFixed(2)}`],
      ['Active Registered Catalog SKUs', products.length],
      ['Low Stock SKUs (At or below threshold)', lowStockCount],
      ['Out of Stock SKUs', outOfStockCount],
      [''],
      ['CATEGORY BREAKDOWN', 'REVENUE', 'UNITS SOLD', 'PROFIT', 'MARGIN %', 'SHARE %'],
      ...categoryPerformance.map(c => [
        `"${c.category}"`,
        `${currency} ${c.revenue.toFixed(2)}`,
        c.units,
        `${currency} ${c.profit.toFixed(2)}`,
        `${c.margin.toFixed(1)}%`,
        `${c.percentage.toFixed(1)}%`
      ]),
      [''],
      ['PAYMENT METHOD BREAKDOWN', 'TRANSACTIONS', 'TOTAL VOLUME', 'SHARE %'],
      ...paymentMethodStats.map(p => [
        p.method,
        p.count,
        `${currency} ${p.total.toFixed(2)}`,
        `${p.percentage.toFixed(1)}%`
      ]),
      [''],
      ['TOP SELLING PRODUCTS', 'CATEGORY', 'UNITS SOLD', 'REVENUE', 'PROFIT', 'CURRENT STOCK'],
      ...topProducts.map(p => [
        `"${p.name}"`,
        `"${p.category}"`,
        p.units,
        `${currency} ${p.revenue.toFixed(2)}`,
        `${currency} ${p.profit.toFixed(2)}`,
        p.current_stock
      ])
    ];

    const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `BloomCarry_Executive_BI_${timeframe}_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const currency = settings.currency_symbol || 'Rs.';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 select-none font-sans">
      
      {/* Header & Date Range Controls */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-[#0f6cbd]/10 text-[#0f6cbd] rounded-xl">
              <BarChart3 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                <span>Business Intelligence & Executive Analytics</span>
                <span className="text-[10px] uppercase font-bold tracking-widest bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-200">
                  Engine Live
                </span>
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Multi-dimensional commercial analytics: net margins, basket velocity, CLV retention, and working capital
              </p>
            </div>
          </div>
        </div>

        {/* Timeframe Selector & Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Preset Buttons */}
          <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-bold text-slate-600 border border-slate-200/60">
            {(['today', '7d', '30d', '90d', 'year', 'all', 'custom'] as const).map(p => {
              const labels: Record<TimeframePreset, string> = {
                today: 'Today',
                '7d': '7D',
                '30d': '30D',
                '90d': '90D',
                year: '1 Year',
                all: 'All Time',
                custom: 'Custom'
              };
              const isActive = timeframe === p;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => setTimeframe(p)}
                  className={`px-3 py-1.5 rounded-lg transition text-xs ${
                    isActive 
                      ? 'bg-[#0f6cbd] text-white shadow-xs font-black' 
                      : 'hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                >
                  {labels[p]}
                </button>
              );
            })}
          </div>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={handleTriggerRefresh}
            title="Recalculate and re-fetch latest data from local vault & cloud"
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs border border-slate-200 transition"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-[#0f6cbd]' : ''}`} />
          </button>

          {/* Export Button */}
          <button
            type="button"
            onClick={exportBIReport}
            className="px-3.5 py-2 bg-[#0f6cbd] hover:bg-[#115ea3] text-white font-bold rounded-xl text-xs flex items-center space-x-1.5 transition shadow-xs cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Export BI Report</span>
          </button>
        </div>
      </div>

      {/* Custom Date Picker Sub-Bar */}
      {timeframe === 'custom' && (
        <div className="bg-blue-50/70 border border-blue-200 p-3.5 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center space-x-2 text-slate-700 font-bold">
            <Calendar className="w-4 h-4 text-[#0f6cbd]" />
            <span>Custom Date Scope:</span>
          </div>
          <div className="flex items-center space-x-2">
            <div>
              <span className="text-[10px] text-slate-500 font-semibold mr-1">From:</span>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-[#0f6cbd]"
              />
            </div>
            <div>
              <span className="text-[10px] text-slate-500 font-semibold mr-1">To:</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-[#0f6cbd]"
              />
            </div>
          </div>
        </div>
      )}

      {/* Diagnostic & Data Source Information Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1 font-semibold">
            <Activity className="w-3.5 h-3.5 text-emerald-600" />
            <span>Period: <strong className="text-slate-900">{rangeLabel}</strong></span>
          </div>
          <span className="text-slate-300">|</span>
          <div>
            Transactions Analyzed: <strong className="text-slate-900">{filteredSales.length}</strong> (of {sales.length} total on file)
          </div>
          <span className="text-slate-300 hidden md:inline">|</span>
          <div className="hidden md:inline">
            Catalog SKUs: <strong className="text-slate-900">{products.length}</strong>
          </div>
        </div>

        {filteredSales.length === 0 && sales.length > 0 && (
          <div className="flex items-center space-x-2 text-amber-800 bg-amber-100/80 px-2.5 py-1 rounded-lg font-bold text-[11px]">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>No sales in {rangeLabel}. Total {sales.length} sales exist in store history.</span>
            <button
              type="button"
              onClick={() => setTimeframe('all')}
              className="underline text-[#0f6cbd] hover:text-[#115ea3] cursor-pointer"
            >
              View All Time
            </button>
          </div>
        )}
      </div>

      {/* Empty State Banner when 0 Total Sales */}
      {sales.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 p-6 rounded-2xl text-center space-y-3">
          <div className="w-12 h-12 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center mx-auto">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <h3 className="text-base font-black text-slate-900">No Sales Recorded in Store Ledger Yet</h3>
          <p className="text-xs text-slate-600 max-w-md mx-auto">
            The Business Intelligence & Executive Analytics engine is active and ready. Once sales checkouts are performed at the POS Billing terminal, commercial KPIs, margins, and trends will render automatically.
          </p>
          {onNavigateToTab && (
            <button
              type="button"
              onClick={() => onNavigateToTab('pos')}
              className="px-4 py-2 bg-[#0f6cbd] hover:bg-[#115ea3] text-white font-bold rounded-xl text-xs inline-flex items-center space-x-2 shadow-xs transition cursor-pointer"
            >
              <span>Go to POS Billing (F1)</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* Primary KPI Grid: 4 Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Gross & Net Revenue */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Net Sales Revenue</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">{currency} {Math.round(netSalesRevenue).toLocaleString()}</div>
            <div className="text-[11px] text-emerald-700 font-bold flex items-center mt-1">
              <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" />
              <span>{filteredSales.length} Invoices Processed</span>
            </div>
            {totalRefundAmount > 0 && (
              <div className="text-[10px] text-rose-600 font-semibold mt-1">
                Less {currency} {Math.round(totalRefundAmount).toLocaleString()} in refunds ({filteredReturns.length} returns)
              </div>
            )}
          </div>
        </div>

        {/* Gross Profit & Margin */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Gross Merchandise Profit</span>
            <div className="p-2 bg-blue-50 text-[#0f6cbd] rounded-xl">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">{currency} {Math.round(grossProfit).toLocaleString()}</div>
            <div className="text-[11px] text-blue-700 font-bold flex items-center mt-1">
              <Percent className="w-3.5 h-3.5 mr-0.5" />
              <span>{grossProfitMargin.toFixed(1)}% Gross Margin</span>
            </div>
            <div className="text-[10px] text-slate-500 font-medium mt-1">
              Wholesale COGS: {currency} {Math.round(totalCOGS).toLocaleString()}
            </div>
          </div>
        </div>

        {/* Average Basket Size / AOV */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Average Basket Value (AOV)</span>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <ShoppingBag className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">{currency} {Math.round(avgBasketSize).toLocaleString()}</div>
            <div className="text-[11px] text-indigo-700 font-bold flex items-center mt-1">
              <span>{avgItemsPerOrder.toFixed(1)} Items per Basket</span>
            </div>
            <div className="text-[10px] text-slate-500 font-medium mt-1">
              Total Units Sold: {totalUnitsSold.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Net Operating Income & Expenses */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Net Operating Income (EBITDA)</span>
            <div className="p-2 bg-amber-50 text-amber-700 rounded-xl">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className={`text-2xl font-black ${netOperatingIncome >= 0 ? 'text-slate-900' : 'text-rose-600'}`}>
              {currency} {Math.round(netOperatingIncome).toLocaleString()}
            </div>
            <div className="text-[11px] text-slate-600 font-bold flex items-center mt-1">
              <span>{netOperatingMargin.toFixed(1)}% Net Operating Margin</span>
            </div>
            <div className="text-[10px] text-slate-500 font-medium mt-1">
              Expenses: {currency} {Math.round(totalOperatingExpenses).toLocaleString()} ({filteredExpenses.length} entries)
            </div>
          </div>
        </div>

      </div>

      {/* Visual Trend Chart: Revenue vs Profit Over Selected Timeframe */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-black text-slate-900 flex items-center space-x-2">
              <BarChart3 className="w-4 h-4 text-[#0f6cbd]" />
              <span>Sales & Profit Trajectory Timeline</span>
            </h3>
            <p className="text-xs text-slate-500">Visual trend of customer volume, daily receipts, and commercial gross yield</p>
          </div>

          <div className="flex items-center space-x-2 text-xs">
            <span className="text-slate-400 font-bold text-[11px]">Display:</span>
            <div className="flex bg-slate-100 p-0.5 rounded-lg font-bold text-slate-600">
              <button
                type="button"
                onClick={() => setChartMetric('both')}
                className={`px-2 py-1 rounded-md transition ${chartMetric === 'both' ? 'bg-white text-slate-900 shadow-xs' : 'hover:text-slate-900'}`}
              >
                Revenue & Profit
              </button>
              <button
                type="button"
                onClick={() => setChartMetric('revenue')}
                className={`px-2 py-1 rounded-md transition ${chartMetric === 'revenue' ? 'bg-white text-slate-900 shadow-xs' : 'hover:text-slate-900'}`}
              >
                Revenue Only
              </button>
              <button
                type="button"
                onClick={() => setChartMetric('profit')}
                className={`px-2 py-1 rounded-md transition ${chartMetric === 'profit' ? 'bg-white text-slate-900 shadow-xs' : 'hover:text-slate-900'}`}
              >
                Profit Only
              </button>
            </div>
          </div>
        </div>

        {trendBuckets.length > 0 ? (
          <div className="space-y-3">
            {/* Visual SVG Bar Timeline */}
            <div className="h-44 w-full flex items-end gap-1.5 sm:gap-3 pt-6 pb-2 px-2 overflow-x-auto">
              {trendBuckets.map((bucket, idx) => {
                const revHeight = maxTrendValue > 0 ? (bucket.revenue / maxTrendValue) * 100 : 0;
                const profitHeight = maxTrendValue > 0 ? (Math.max(0, bucket.profit) / maxTrendValue) * 100 : 0;

                return (
                  <div key={idx} className="flex-1 min-w-[32px] flex flex-col items-center group relative h-full justify-end">
                    
                    {/* Hover Tooltip */}
                    <div className="absolute -top-12 z-20 hidden group-hover:flex flex-col items-center bg-slate-900 text-white text-[10px] font-bold py-1 px-2 rounded-lg shadow-lg whitespace-nowrap pointer-events-none">
                      <span>{bucket.label}</span>
                      <span className="text-cyan-300">Rev: {currency} {Math.round(bucket.revenue).toLocaleString()}</span>
                      <span className="text-emerald-300">Profit: {currency} {Math.round(bucket.profit).toLocaleString()}</span>
                      <span className="text-slate-300 text-[9px]">{bucket.orderCount} orders</span>
                    </div>

                    {/* Bars Container */}
                    <div className="w-full flex items-end justify-center space-x-1 h-full pb-1">
                      {(chartMetric === 'both' || chartMetric === 'revenue') && (
                        <div 
                          className="w-full max-w-[14px] bg-[#0f6cbd] rounded-t-sm transition-all duration-300 hover:brightness-110"
                          style={{ height: `${Math.max(revHeight, 3)}%` }}
                        />
                      )}
                      {(chartMetric === 'both' || chartMetric === 'profit') && (
                        <div 
                          className="w-full max-w-[14px] bg-emerald-500 rounded-t-sm transition-all duration-300 hover:brightness-110"
                          style={{ height: `${Math.max(profitHeight, 2)}%` }}
                        />
                      )}
                    </div>

                    {/* X-axis Label */}
                    <span className="text-[10px] font-semibold text-slate-500 truncate w-full text-center mt-1">
                      {bucket.label}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex items-center justify-center space-x-6 text-xs text-slate-600 font-semibold pt-1 border-t border-slate-100">
              <div className="flex items-center space-x-1.5">
                <span className="w-3 h-3 bg-[#0f6cbd] rounded-xs" />
                <span>Gross Revenue ({currency} {Math.round(grossSalesRevenue).toLocaleString()})</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-3 h-3 bg-emerald-500 rounded-xs" />
                <span>Gross Merchandise Profit ({currency} {Math.round(grossProfit).toLocaleString()})</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-slate-400 text-xs font-semibold">
            No transaction timeline data available for {rangeLabel}.
          </div>
        )}
      </div>

      {/* 2-Column Analytical Breakdown: Category Performance & Peak Hours */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Category Revenue & Margin Share */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-900 flex items-center space-x-2">
              <PieChart className="w-4 h-4 text-[#0f6cbd]" />
              <span>Category Revenue & Margin Performance</span>
            </h3>
            <span className="text-xs font-bold text-slate-500">{categoryPerformance.length} Categories Active</span>
          </div>

          <div className="space-y-3">
            {categoryPerformance.slice(0, 6).map((cat) => (
              <div key={cat.category} className="space-y-1 bg-slate-50/70 p-2.5 rounded-xl border border-slate-100">
                <div className="flex justify-between items-center text-xs">
                  <div className="font-bold text-slate-800 flex items-center space-x-1.5">
                    <span>{cat.category}</span>
                    <span className="text-[10px] text-slate-400 font-normal">({cat.units} units)</span>
                  </div>
                  <div className="text-right">
                    <span className="font-black text-slate-900">{currency} {Math.round(cat.revenue).toLocaleString()}</span>
                    <span className="text-[10px] text-[#0f6cbd] font-bold ml-1.5">({cat.percentage.toFixed(1)}%)</span>
                  </div>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                  <div 
                    className="bg-[#0f6cbd] h-2 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, cat.percentage)}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-slate-500 font-semibold pt-0.5">
                  <span>Gross Profit: {currency} {Math.round(cat.profit).toLocaleString()}</span>
                  <span className="text-emerald-700 font-bold">{cat.margin.toFixed(1)}% margin</span>
                </div>
              </div>
            ))}

            {categoryPerformance.length === 0 && (
              <div className="text-center py-6 text-slate-400 text-xs font-semibold">
                No category sales recorded in this period.
              </div>
            )}
          </div>
        </div>

        {/* Peak Shopping Hours & Payment Methods */}
        <div className="space-y-6">
          
          {/* Peak Hours Card */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-900 flex items-center space-x-2">
                <Clock className="w-4 h-4 text-[#0f6cbd]" />
                <span>Peak Store Traffic & Sales Velocity</span>
              </h3>
              {hourlyVelocity.maxCount > 0 && (
                <span className="text-[10px] bg-blue-100 text-blue-900 font-black px-2 py-0.5 rounded-full">
                  Peak: {hourlyVelocity.peakHour}:00 - {hourlyVelocity.peakHour + 1}:00 ({hourlyVelocity.maxCount} orders)
                </span>
              )}
            </div>

            <div className="h-24 flex items-end gap-1 pt-2 pb-1">
              {hourlyVelocity.hours.map((h) => {
                const heightPct = hourlyVelocity.maxCount > 0 ? (h.count / hourlyVelocity.maxCount) * 100 : 0;
                const isPeak = h.hour === hourlyVelocity.peakHour && h.count > 0;

                return (
                  <div key={h.hour} className="flex-1 flex flex-col items-center group relative h-full justify-end">
                    <div className="absolute -top-7 z-10 hidden group-hover:block bg-slate-900 text-white text-[9px] py-0.5 px-1.5 rounded whitespace-nowrap">
                      {h.hour}:00 - {h.count} orders ({currency} {Math.round(h.revenue).toLocaleString()})
                    </div>
                    <div 
                      className={`w-full rounded-t-xs transition-all duration-300 ${
                        isPeak ? 'bg-amber-500' : 'bg-slate-300 group-hover:bg-[#0f6cbd]'
                      }`}
                      style={{ height: `${Math.max(heightPct, 4)}%` }}
                    />
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between text-[10px] text-slate-400 font-bold border-t border-slate-100 pt-1">
              <span>00:00 (12 AM)</span>
              <span>06:00 (6 AM)</span>
              <span>12:00 (12 PM)</span>
              <span>18:00 (6 PM)</span>
              <span>23:00 (11 PM)</span>
            </div>
          </div>

          {/* Payment Method Distribution */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <h3 className="text-sm font-black text-slate-900 flex items-center space-x-2">
              <CreditCard className="w-4 h-4 text-[#0f6cbd]" />
              <span>Payment Tender Distribution</span>
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
              {paymentMethodStats.map((p) => (
                <div key={p.method} className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <div className="text-[10px] text-slate-400 font-bold uppercase">{p.method}</div>
                  <div className="font-black text-slate-900 text-sm mt-0.5">{currency} {Math.round(p.total).toLocaleString()}</div>
                  <div className="text-[10px] text-slate-500 font-semibold">{p.count} orders ({p.percentage.toFixed(1)}%)</div>
                </div>
              ))}
              {paymentMethodStats.length === 0 && (
                <div className="col-span-full text-center py-3 text-slate-400 text-xs">
                  No payment data in this period.
                </div>
              )}
            </div>
          </div>

        </div>

      </div>

      {/* Top 10 High-Velocity Products Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-black text-slate-900 flex items-center space-x-2">
              <Award className="w-4 h-4 text-amber-500" />
              <span>Top 10 High-Velocity Products & Yield Ranking</span>
            </h3>
            <p className="text-xs text-slate-500">Fastest selling SKUs ranked by revenue volume, gross profit contribution, and live shelf stock</p>
          </div>
          <span className="text-xs font-bold text-slate-500">
            Top Performers in {rangeLabel}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] border-b border-slate-200">
              <tr>
                <th className="py-3 px-4"># Rank</th>
                <th className="py-3 px-4">Product Name</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4 text-center">Units Sold</th>
                <th className="py-3 px-4 text-right">Revenue</th>
                <th className="py-3 px-4 text-right">Profit Contribution</th>
                <th className="py-3 px-4 text-center">Margin</th>
                <th className="py-3 px-4 text-center">Current Shelf Stock</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {topProducts.map((prod, index) => (
                <tr key={index} className="hover:bg-slate-50/60 transition">
                  <td className="py-3 px-4 font-black text-slate-900">
                    <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] ${
                      index === 0 ? 'bg-amber-100 text-amber-900 font-black' : 
                      index === 1 ? 'bg-slate-200 text-slate-800 font-black' : 
                      index === 2 ? 'bg-amber-50 text-amber-800' : 'text-slate-500'
                    }`}>
                      {index + 1}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-bold text-slate-900">{prod.name}</div>
                    <div className="text-[10px] text-slate-400">SKU: {prod.sku}</div>
                  </td>
                  <td className="py-3 px-4 text-slate-600">{prod.category}</td>
                  <td className="py-3 px-4 text-center font-bold text-slate-900">{prod.units}</td>
                  <td className="py-3 px-4 text-right font-black text-slate-900">
                    {currency} {Math.round(prod.revenue).toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-emerald-700">
                    {currency} {Math.round(prod.profit).toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded-full text-[10px] font-bold border border-emerald-200">
                      {prod.margin.toFixed(1)}%
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      prod.current_stock <= 0 
                        ? 'bg-rose-100 text-rose-800 border border-rose-200' 
                        : prod.current_stock <= 5 
                        ? 'bg-amber-100 text-amber-800 border border-amber-200' 
                        : 'bg-slate-100 text-slate-800'
                    }`}>
                      {prod.current_stock} in stock
                    </span>
                  </td>
                </tr>
              ))}

              {topProducts.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-slate-400 text-xs">
                    No product velocity data recorded for {rangeLabel}.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Customer Loyalty & Inventory Valuation Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Customer Loyalty & CLV */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-900 flex items-center space-x-2">
              <Users className="w-4 h-4 text-[#0f6cbd]" />
              <span>Customer Lifetime Value & Retention Dynamics</span>
            </h3>
            <span className="text-xs font-bold text-purple-700">{customers.length} Registered CRM Accounts</span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-purple-50/70 p-3 rounded-xl border border-purple-200">
              <div className="text-purple-600 font-bold uppercase text-[10px]">Repeat Order Rate</div>
              <div className="text-2xl font-black text-purple-900 mt-1">{repeatCustomerRate.toFixed(1)}%</div>
              <div className="text-[10px] text-purple-700 mt-0.5">{repeatCustomersCount} customers bought &gt; 1 time</div>
            </div>

            <div className="bg-indigo-50/70 p-3 rounded-xl border border-indigo-200">
              <div className="text-indigo-600 font-bold uppercase text-[10px]">Average Customer CLV</div>
              <div className="text-2xl font-black text-indigo-900 mt-1">{currency} {Math.round(avgCLV).toLocaleString()}</div>
              <div className="text-[10px] text-indigo-700 mt-0.5">Average spend per client account</div>
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5">
            <div className="flex justify-between items-center font-bold text-slate-700">
              <span>Active Buyers in {rangeLabel}:</span>
              <span className="text-slate-900 font-black">{activeCustomersCount} accounts</span>
            </div>
            <p className="text-[11px] text-slate-500">
              Cosmetic customers who maintain high CLV qualify automatically for Tiered Loyalty Perks and VIP WhatsApp campaigns.
            </p>
          </div>
        </div>

        {/* Working Capital & Stock Valuation */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-900 flex items-center space-x-2">
              <Layers className="w-4 h-4 text-[#0f6cbd]" />
              <span>Inventory Asset & Working Capital Valuation</span>
            </h3>
            <span className="text-xs font-bold text-slate-500">{products.length} Registered SKUs</span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div className="text-slate-400 font-bold uppercase text-[10px]">Total Stock Wholesale Cost</div>
              <div className="text-xl font-black text-slate-900 mt-1">{currency} {Math.round(totalInventoryWholesaleCost).toLocaleString()}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">Tied capital at supplier purchase price</div>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div className="text-slate-400 font-bold uppercase text-[10px]">Total Stock Retail MSRP Value</div>
              <div className="text-xl font-black text-emerald-700 mt-1">{currency} {Math.round(totalInventoryRetailValue).toLocaleString()}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">Potential revenue when inventory is depleted</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className={`p-2.5 rounded-xl border flex items-center justify-between ${
              lowStockCount > 0 ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-slate-50 border-slate-200 text-slate-700'
            }`}>
              <span className="font-bold">Low Stock Alerts:</span>
              <span className="font-black text-sm">{lowStockCount} SKUs</span>
            </div>

            <div className={`p-2.5 rounded-xl border flex items-center justify-between ${
              outOfStockCount > 0 ? 'bg-rose-50 border-rose-200 text-rose-900' : 'bg-slate-50 border-slate-200 text-slate-700'
            }`}>
              <span className="font-bold">Out of Stock SKUs:</span>
              <span className="font-black text-sm">{outOfStockCount} SKUs</span>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
};

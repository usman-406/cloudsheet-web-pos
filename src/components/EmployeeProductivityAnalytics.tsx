import React from 'react';
import { Sale, User } from '../types';
import { Users, TrendingUp, DollarSign, RefreshCw, Percent, Award, ShieldCheck } from 'lucide-react';

interface EmployeeProductivityAnalyticsProps {
  sales: Sale[];
  activeUser: User;
}

export const EmployeeProductivityAnalytics: React.FC<EmployeeProductivityAnalyticsProps> = ({
  sales,
}) => {
  // Aggregate sales by cashier
  const statsByCashier: Record<string, {
    txCount: number;
    totalSales: number;
    totalDiscounts: number;
    totalRefunds: number;
  }> = {};

  sales.forEach(s => {
    const cashier = s.cashier_name || 'Store Cashier';
    if (!statsByCashier[cashier]) {
      statsByCashier[cashier] = { txCount: 0, totalSales: 0, totalDiscounts: 0, totalRefunds: 0 };
    }

    if (s.status === 'refunded') {
      statsByCashier[cashier].totalRefunds += s.total;
    } else {
      statsByCashier[cashier].txCount += 1;
      statsByCashier[cashier].totalSales += s.total;
      statsByCashier[cashier].totalDiscounts += (s.discount || 0);
    }
  });

  const cashiersList = Object.keys(statsByCashier).map(c => {
    const data = statsByCashier[c];
    const avgTx = data.txCount > 0 ? data.totalSales / data.txCount : 0;
    return {
      cashier: c,
      ...data,
      avgTx
    };
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 flex items-center space-x-2">
            <Users className="w-6 h-6 text-[#0f6cbd]" />
            <span>Employee Performance & Operational Analytics</span>
          </h2>
          <p className="text-xs text-slate-500">Transparent role-controlled metrics covering transaction volumes, average sale value, discounts, and refunds</p>
        </div>

        <div className="flex items-center space-x-2">
          <span className="bg-blue-50 text-blue-800 text-xs font-bold px-3 py-1.5 rounded-xl border border-blue-200 flex items-center space-x-1">
            <ShieldCheck className="w-4 h-4 text-[#0f6cbd]" />
            <span>Manager Role Access</span>
          </span>
        </div>
      </div>

      {/* Staff Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {cashiersList.map((st) => (
          <div key={st.cashier} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex justify-between items-center border-b pb-2">
              <span className="font-bold text-slate-900 text-sm">{st.cashier}</span>
              <Award className="w-4 h-4 text-amber-500" />
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <div className="text-slate-400 text-[10px] uppercase font-bold">Completed Sales</div>
                <div className="font-extrabold text-slate-900 text-base">{st.txCount} txs</div>
              </div>
              <div>
                <div className="text-slate-400 text-[10px] uppercase font-bold">Total Revenue</div>
                <div className="font-extrabold text-emerald-600 text-base">Rs. {st.totalSales.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-slate-400 text-[10px] uppercase font-bold">Avg Sale Value</div>
                <div className="font-bold text-slate-700">Rs. {Math.round(st.avgTx).toLocaleString()}</div>
              </div>
              <div>
                <div className="text-slate-400 text-[10px] uppercase font-bold">Discounts Given</div>
                <div className="font-bold text-amber-700">Rs. {st.totalDiscounts.toLocaleString()}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Performance Audit Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-3">
        <h3 className="text-sm font-bold text-slate-800">Operational Productivity Audit</h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="p-3">Cashier Name</th>
                <th className="p-3 text-center">Invoices Handled</th>
                <th className="p-3">Gross Revenue</th>
                <th className="p-3">Average Invoice</th>
                <th className="p-3">Discounts Issued</th>
                <th className="p-3">Refund Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
              {cashiersList.map((c) => (
                <tr key={c.cashier} className="hover:bg-slate-50">
                  <td className="p-3 font-bold font-sans text-slate-900">{c.cashier}</td>
                  <td className="p-3 text-center font-bold text-blue-700">{c.txCount}</td>
                  <td className="p-3 font-bold text-emerald-700">Rs. {c.totalSales.toLocaleString()}</td>
                  <td className="p-3 text-slate-700">Rs. {Math.round(c.avgTx).toLocaleString()}</td>
                  <td className="p-3 text-amber-700">Rs. {c.totalDiscounts.toLocaleString()}</td>
                  <td className="p-3 text-rose-700">Rs. {c.totalRefunds.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};

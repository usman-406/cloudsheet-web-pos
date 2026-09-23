import React, { useState, useEffect } from 'react';
import { StorageService } from '../services/storage';
import { CashShift, ShopSettings, User } from '../types';
import { 
  DollarSign, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  Lock, 
  Unlock, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Receipt,
  ShieldCheck,
  History
} from 'lucide-react';

interface ShiftRegisterManagementProps {
  settings: ShopSettings;
  activeUser: User;
}

export const ShiftRegisterManagement: React.FC<ShiftRegisterManagementProps> = ({
  settings,
  activeUser,
}) => {
  const [shifts, setShifts] = useState<CashShift[]>([]);
  const [activeShift, setActiveShift] = useState<CashShift | null>(null);

  // Form states
  const [openingCashInput, setOpeningCashInput] = useState<number>(5000);
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
  const [actualCashInput, setActualCashInput] = useState<number>(0);
  const [varianceReason, setVarianceReason] = useState<string>('');
  const [managerPin, setManagerPin] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Cash In/Out states
  const [isCashMovementModalOpen, setIsCashMovementModalOpen] = useState(false);
  const [movementType, setMovementType] = useState<'IN' | 'OUT'>('IN');
  const [movementAmount, setMovementAmount] = useState<number>(0);
  const [movementNote, setMovementNote] = useState<string>('');

  useEffect(() => {
    loadShifts();
  }, []);

  const loadShifts = () => {
    const loaded = StorageService.getShifts();
    setShifts(loaded);
    const current = loaded.find(s => s.status === 'OPEN') || null;
    setActiveShift(current);
  };

  // Start New Shift
  const handleStartShift = (e: React.FormEvent) => {
    e.preventDefault();
    const newShift: CashShift = {
      id: `shift_${Date.now()}`,
      cashier_name: activeUser.name,
      start_time: new Date().toISOString(),
      opening_cash: Number(openingCashInput) || 0,
      cash_sales: 0,
      card_sales: 0,
      digital_sales: 0,
      refunds: 0,
      cash_in: 0,
      cash_out: 0,
      expected_cash: Number(openingCashInput) || 0,
      status: 'OPEN'
    };

    const updated = [newShift, ...shifts];
    StorageService.saveShifts(updated);
    setShifts(updated);
    setActiveShift(newShift);
  };

  // Record Cash In/Out
  const handleCashMovement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeShift || movementAmount <= 0) return;

    let updatedShift = { ...activeShift };
    if (movementType === 'IN') {
      updatedShift.cash_in += movementAmount;
    } else {
      updatedShift.cash_out += movementAmount;
    }
    updatedShift.expected_cash = updatedShift.opening_cash + updatedShift.cash_sales + updatedShift.cash_in - updatedShift.cash_out - updatedShift.refunds;

    const all = shifts.map(s => s.id === updatedShift.id ? updatedShift : s);
    StorageService.saveShifts(all);
    setShifts(all);
    setActiveShift(updatedShift);
    setIsCashMovementModalOpen(false);
    setMovementAmount(0);
    setMovementNote('');
  };

  // Close & Reconcile Shift
  const handleCloseShift = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeShift) return;

    setErrorMsg('');
    const variance = actualCashInput - activeShift.expected_cash;

    if (variance !== 0) {
      if (!varianceReason.trim()) {
        setErrorMsg('Variance detected! You must provide a explanation for the cash discrepancy.');
        return;
      }
      if (managerPin !== '123456') {
        setErrorMsg('Invalid Manager Security PIN for variance clearance!');
        return;
      }
    }

    const closedShift: CashShift = {
      ...activeShift,
      end_time: new Date().toISOString(),
      actual_cash: actualCashInput,
      variance,
      variance_reason: varianceReason || 'Balanced Shift',
      status: 'CLOSED',
      approved_by: variance !== 0 ? 'Store Manager (Admin)' : activeUser.name
    };

    const all = shifts.map(s => s.id === closedShift.id ? closedShift : s);
    StorageService.saveShifts(all);
    setShifts(all);
    setActiveShift(null);
    setIsCloseModalOpen(false);
    setActualCashInput(0);
    setVarianceReason('');
    setManagerPin('');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* Module Title Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 flex items-center space-x-2">
            <DollarSign className="w-6 h-6 text-[#0f6cbd]" />
            <span>Cash Register & Shift Reconciliation</span>
          </h2>
          <p className="text-xs text-slate-500">Manage cashier opening float, cash sales tracking, drawer payouts, and shift closure audit</p>
        </div>

        {activeShift && (
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsCashMovementModalOpen(true)}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-xs flex items-center space-x-1.5 transition"
            >
              <ArrowUpRight className="w-4 h-4 text-emerald-600" />
              <span>Cash In / Out</span>
            </button>
            <button
              onClick={() => {
                setActualCashInput(activeShift.expected_cash);
                setIsCloseModalOpen(true);
              }}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs shadow-md flex items-center space-x-1.5 transition"
            >
              <Lock className="w-4 h-4" />
              <span>Close Shift</span>
            </button>
          </div>
        )}
      </div>

      {/* Active Shift Dashboard OR Start Shift Card */}
      {!activeShift ? (
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-8 shadow-xl max-w-xl mx-auto text-center space-y-5">
          <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto text-amber-400">
            <Unlock className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-xl font-black">No Active Cashier Shift</h3>
            <p className="text-xs text-slate-300 mt-1">
              Please enter the starting drawer float to open a new register session for {activeUser.name}.
            </p>
          </div>

          <form onSubmit={handleStartShift} className="space-y-4 max-w-sm mx-auto text-left">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Opening Cash Float ({settings.currency_symbol}) *</label>
              <input
                type="number"
                min="0"
                required
                value={openingCashInput}
                onChange={(e) => setOpeningCashInput(Number(e.target.value))}
                placeholder="5000"
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white font-black text-xl text-center focus:outline-none focus:ring-2 focus:ring-[#0f6cbd]"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-[#0f6cbd] hover:bg-[#115ea3] text-white font-extrabold rounded-xl text-sm shadow-lg transition"
            >
              Open Register Shift
            </button>
          </form>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          
          {/* Active Shift Overview */}
          <div className="bg-white p-5 rounded-2xl border border-emerald-200 bg-emerald-50/20 shadow-xs space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-emerald-700 uppercase tracking-wide flex items-center space-x-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Shift Active</span>
              </span>
              <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold">
                {activeShift.cashier_name}
              </span>
            </div>
            <div>
              <span className="text-xs text-slate-500 font-bold">Expected Drawer Cash</span>
              <h3 className="text-3xl font-black text-[#0f6cbd]">
                {settings.currency_symbol} {(activeShift.expected_cash ?? 0).toLocaleString()}
              </h3>
            </div>
            <div className="text-[11px] text-slate-500 font-medium">
              Started: {activeShift.start_time ? new Date(activeShift.start_time).toLocaleTimeString() : '-'}
            </div>
          </div>

          {/* Breakdown 1 */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
            <span className="text-xs font-bold text-slate-500">Opening Cash Float</span>
            <div className="text-2xl font-extrabold text-slate-800">
              {settings.currency_symbol} {(activeShift.opening_cash ?? 0).toLocaleString()}
            </div>
            <div className="text-[11px] text-slate-400">Initial cash placed in drawer</div>
          </div>

          {/* Breakdown 2 */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
            <span className="text-xs font-bold text-slate-500">Cash Sales Collected</span>
            <div className="text-2xl font-extrabold text-emerald-600">
              + {settings.currency_symbol} {(activeShift.cash_sales ?? 0).toLocaleString()}
            </div>
            <div className="text-[11px] text-slate-400">Card/Digital: {settings.currency_symbol} {((activeShift.card_sales || 0) + (activeShift.digital_sales || 0)).toLocaleString()}</div>
          </div>

          {/* Breakdown 3 */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
            <span className="text-xs font-bold text-slate-500">Cash Adjustments / Refunds</span>
            <div className="text-2xl font-extrabold text-rose-600">
              {settings.currency_symbol} {((activeShift.cash_in || 0) - (activeShift.cash_out || 0) - (activeShift.refunds || 0)).toLocaleString()}
            </div>
            <div className="text-[11px] text-slate-400">In: {activeShift.cash_in || 0} | Out: {activeShift.cash_out || 0} | Refunds: {activeShift.refunds || 0}</div>
          </div>

        </div>
      )}

      {/* Historical Shift Log */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden space-y-3 p-5">
        <h3 className="text-sm font-bold text-slate-800 flex items-center space-x-2">
          <History className="w-4 h-4 text-[#0f6cbd]" />
          <span>Shift Audit Trail & Reconciliation Log</span>
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="p-3">Shift ID / Cashier</th>
                <th className="p-3">Start & End Time</th>
                <th className="p-3 text-right">Opening Float</th>
                <th className="p-3 text-right">Cash Sales</th>
                <th className="p-3 text-right">Expected Cash</th>
                <th className="p-3 text-right">Actual Count</th>
                <th className="p-3 text-right">Variance</th>
                <th className="p-3">Reason / Approver</th>
                <th className="p-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {shifts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-400">
                    No shift history recorded yet.
                  </td>
                </tr>
              ) : (
                shifts.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50 transition">
                    <td className="p-3">
                      <div className="font-bold text-slate-900">{s.cashier_name}</div>
                      <div className="text-[10px] font-mono text-slate-400">{s.id}</div>
                    </td>
                    <td className="p-3 text-slate-600">
                      <div>{s.start_time ? new Date(s.start_time).toLocaleString() : '-'}</div>
                      {s.end_time && <div className="text-[10px] text-slate-400">Ended: {new Date(s.end_time).toLocaleTimeString()}</div>}
                    </td>
                    <td className="p-3 text-right font-semibold">{settings.currency_symbol} {(s.opening_cash ?? 0).toLocaleString()}</td>
                    <td className="p-3 text-right font-semibold text-emerald-600">{settings.currency_symbol} {(s.cash_sales ?? 0).toLocaleString()}</td>
                    <td className="p-3 text-right font-bold text-slate-800">{settings.currency_symbol} {(s.expected_cash ?? 0).toLocaleString()}</td>
                    <td className="p-3 text-right font-extrabold text-blue-700">
                      {s.actual_cash !== undefined ? `${settings.currency_symbol} ${(s.actual_cash ?? 0).toLocaleString()}` : '-'}
                    </td>
                    <td className="p-3 text-right font-extrabold">
                      {s.variance !== undefined ? (
                        <span className={s.variance === 0 ? 'text-emerald-600' : 'text-rose-600'}>
                          {s.variance > 0 ? `+${s.variance}` : s.variance}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="p-3">
                      <div className="text-slate-700 font-medium">{s.variance_reason || '-'}</div>
                      {s.approved_by && <div className="text-[10px] text-slate-400">By: {s.approved_by}</div>}
                    </td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${s.status === 'OPEN' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}>
                        {s.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cash Movement Modal */}
      {isCashMovementModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleCashMovement} className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <h3 className="font-bold text-slate-900 border-b pb-2 text-sm">Record Drawer Cash Deposit / Payout</h3>
            
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Movement Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setMovementType('IN')}
                    className={`py-2 rounded-xl font-bold ${movementType === 'IN' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700'}`}
                  >
                    Cash In (+)
                  </button>
                  <button
                    type="button"
                    onClick={() => setMovementType('OUT')}
                    className={`py-2 rounded-xl font-bold ${movementType === 'OUT' ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-700'}`}
                  >
                    Cash Out (-)
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Amount ({settings.currency_symbol}) *</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={movementAmount || ''}
                  onChange={(e) => setMovementAmount(Number(e.target.value))}
                  placeholder="1000"
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-sm"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Note / Reason</label>
                <input
                  type="text"
                  value={movementNote}
                  onChange={(e) => setMovementNote(e.target.value)}
                  placeholder="e.g. Added change float / Paid vendor"
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl"
                />
              </div>
            </div>

            <div className="flex space-x-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setIsCashMovementModalOpen(false)}
                className="flex-1 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2 bg-[#0f6cbd] text-white font-bold rounded-xl text-xs"
              >
                Save
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Close & Reconcile Modal */}
      {isCloseModalOpen && activeShift && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <form onSubmit={handleCloseShift} className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto p-6 space-y-4 my-auto">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="font-bold text-slate-900 text-sm flex items-center space-x-1.5">
                <Lock className="w-4 h-4 text-rose-600" />
                <span>Reconcile & Close Cash Shift</span>
              </h3>
              <button type="button" onClick={() => setIsCloseModalOpen(false)} className="text-slate-400 font-bold">✕</button>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1">
              <div className="flex justify-between text-slate-600">
                <span>Opening Cash:</span>
                <span className="font-bold">{settings.currency_symbol} {(activeShift.opening_cash ?? 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-emerald-700 font-bold">
                <span>Net Cash Sales:</span>
                <span>+ {settings.currency_symbol} {(activeShift.cash_sales ?? 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-slate-800 font-black border-t pt-1">
                <span>Calculated Expected Cash:</span>
                <span className="text-[#0f6cbd]">{settings.currency_symbol} {(activeShift.expected_cash ?? 0).toLocaleString()}</span>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Actual Physical Counted Cash *</label>
                <input
                  type="number"
                  required
                  value={actualCashInput}
                  onChange={(e) => setActualCashInput(Number(e.target.value))}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-black text-xl text-center text-slate-900"
                />
              </div>

              {/* Calculated Variance Preview */}
              <div className={`p-3 rounded-xl border text-xs font-bold flex justify-between items-center ${actualCashInput - (activeShift.expected_cash || 0) === 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
                <span>Calculated Variance:</span>
                <span className="text-sm font-black">
                  {settings.currency_symbol} {(actualCashInput - (activeShift.expected_cash || 0)).toLocaleString()}
                </span>
              </div>

              {actualCashInput - activeShift.expected_cash !== 0 && (
                <>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Variance Explanation *</label>
                    <input
                      type="text"
                      required
                      value={varianceReason}
                      onChange={(e) => setVarianceReason(e.target.value)}
                      placeholder="e.g. Uncollected change or vendor discrepancy"
                      className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Manager Security PIN *</label>
                    <input
                      type="password"
                      required
                      value={managerPin}
                      onChange={(e) => setManagerPin(e.target.value)}
                      placeholder="123456"
                      className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-center font-mono font-bold"
                    />
                  </div>
                </>
              )}

              {errorMsg && (
                <p className="text-xs text-rose-600 font-bold">{errorMsg}</p>
              )}
            </div>

            <div className="flex space-x-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setIsCloseModalOpen(false)}
                className="flex-1 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-xl text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs shadow-md"
              >
                Confirm & Close Register
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { 
  CreditCard, 
  Wifi, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  RefreshCw, 
  ShieldCheck, 
  UserCheck 
} from 'lucide-react';
import { CardPaymentTerminal } from '../services/card_payment_terminal';
import { CardTerminalTransaction, CardTerminalStep } from '../types';

interface CardTerminalModalProps {
  amount: number;
  invoiceNo: string;
  onApproved: (tx: CardTerminalTransaction) => void;
  onCancel: () => void;
}

export const CardTerminalModal: React.FC<CardTerminalModalProps> = ({
  amount,
  invoiceNo,
  onApproved,
  onCancel,
}) => {
  const terminal = CardPaymentTerminal.getInstance();
  const [transaction, setTransaction] = useState<CardTerminalTransaction>({
    status: 'connecting',
    amount,
    invoice_no: invoiceNo,
    message: 'Initiating TCP/IP socket connection to Card Terminal...',
    timestamp: new Date().toISOString()
  });

  useEffect(() => {
    const unsub = terminal.subscribe((tx) => {
      setTransaction(tx);
      if (tx.status === 'approved') {
        setTimeout(() => {
          onApproved(tx);
        }, 1200);
      }
    });

    // Start payment flow
    terminal.initiatePayment(amount, invoiceNo);

    return () => {
      unsub();
      terminal.reset();
    };
  }, [amount, invoiceNo]);

  const handleManualApprove = () => {
    const manualTx = terminal.forceManualApproval(amount, invoiceNo);
    onApproved(manualTx);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto font-sans">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md my-auto max-h-[calc(100vh-2rem)] flex flex-col overflow-y-auto border border-slate-200 p-4 sm:p-6 space-y-4 text-center relative">
        
        {/* Terminal Header */}
        <div className="space-y-1">
          <div className="inline-flex items-center space-x-1.5 bg-blue-50 text-[#0f6cbd] font-bold text-[10px] uppercase px-3 py-1 rounded-md border border-blue-200">
            <Wifi className="w-3.5 h-3.5 animate-pulse text-[#0f6cbd]" />
            <span>Card Terminal TCP/IP Socket Ready</span>
          </div>
          <h3 className="text-lg sm:text-xl font-bold text-slate-900">Card Payment Processing</h3>
          <p className="text-xs text-slate-500 font-semibold">Invoice: <span className="font-mono text-[#0f6cbd] font-bold">{invoiceNo}</span></p>
        </div>

        {/* Amount Display */}
        <div className="bg-slate-900 text-white py-3 px-5 rounded-md shadow-xs space-y-0.5">
          <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Amount Due on Pinpad</span>
          <h2 className="text-2xl sm:text-3xl font-black text-emerald-400">Rs {amount.toLocaleString()}</h2>
        </div>

        {/* Dynamic Step Status Visualizer */}
        <div className="py-6 px-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
          
          <div className="flex items-center justify-center">
            {transaction.status === 'connecting' && (
              <RefreshCw className="w-12 h-12 text-blue-600 animate-spin" />
            )}
            {transaction.status === 'present_card' && (
              <CreditCard className="w-12 h-12 text-blue-600 animate-bounce" />
            )}
            {transaction.status === 'entering_pin' && (
              <ShieldCheck className="w-12 h-12 text-amber-500 animate-pulse" />
            )}
            {transaction.status === 'processing' && (
              <RefreshCw className="w-12 h-12 text-indigo-600 animate-spin" />
            )}
            {transaction.status === 'approved' && (
              <CheckCircle2 className="w-12 h-12 text-emerald-600 animate-bounce" />
            )}
            {transaction.status === 'manual_fallback' && (
              <AlertTriangle className="w-12 h-12 text-amber-600" />
            )}
          </div>

          <p className="text-xs font-bold text-slate-800 leading-relaxed px-2">
            {transaction.message}
          </p>

          {transaction.cardMasked && (
            <div className="inline-block bg-white px-3 py-1 rounded-xl border border-slate-200 text-xs font-mono font-extrabold text-slate-700">
              {transaction.cardType} ({transaction.cardMasked})
            </div>
          )}

          {transaction.authCode && (
            <div className="bg-emerald-50 text-emerald-800 p-2 rounded-xl border border-emerald-200 text-xs font-mono font-black">
              Bank Auth Code: {transaction.authCode}
            </div>
          )}

        </div>

        {/* Action Buttons */}
        <div className="space-y-2">
          {transaction.status === 'manual_fallback' ? (
            <button
              onClick={handleManualApprove}
              className="w-full py-3 bg-amber-600 hover:bg-amber-700 text-white font-extrabold rounded-xl text-xs shadow-md flex items-center justify-center space-x-2 transition"
            >
              <UserCheck className="w-4 h-4" />
              <span>Verify Payment Manually & Complete Checkout</span>
            </button>
          ) : null}

          <button
            onClick={onCancel}
            className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition"
          >
            Cancel Card Payment
          </button>
        </div>

      </div>
    </div>
  );
};

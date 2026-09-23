import React, { useState } from 'react';
import { Download, ShieldCheck, Database, Calendar, CheckCircle2, X, FileJson, AlertCircle } from 'lucide-react';
import { StorageService } from '../services/storage';

interface DailyBackupPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  productsCount: number;
  salesCount: number;
  customersCount: number;
}

export const DailyBackupPromptModal: React.FC<DailyBackupPromptModalProps> = ({
  isOpen,
  onClose,
  productsCount,
  salesCount,
  customersCount,
}) => {
  const [downloaded, setDownloaded] = useState(false);

  if (!isOpen) return null;

  const todayFormatted = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const handleDownload = () => {
    const success = StorageService.downloadLocalStateBackupJson();
    if (success) {
      setDownloaded(true);
      setTimeout(() => {
        onClose();
      }, 1500);
    }
  };

  const handleDismiss = () => {
    StorageService.dismissDailyBackupForToday();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-lg overflow-hidden flex flex-col">
        {/* Header Banner */}
        <div className="bg-linear-to-r from-blue-700 via-[#0b5fa5] to-indigo-800 p-6 text-white relative">
          <button
            onClick={handleDismiss}
            className="absolute top-4 right-4 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 p-1.5 rounded-full transition-colors"
            title="Dismiss for today"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-white/15 rounded-xl backdrop-blur-xs border border-white/20">
              <ShieldCheck className="w-7 h-7 text-emerald-300" />
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-blue-200 bg-blue-900/40 px-2 py-0.5 rounded-full">
                Automated Safety Measure
              </span>
              <h2 className="text-xl font-black mt-1">Automated Daily POS Backup</h2>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 text-slate-700 text-sm">
          <div className="flex items-center space-x-2 text-xs font-semibold text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
            <Calendar className="w-4 h-4 text-[#0b5fa5]" />
            <span>Scheduled Daily Run: <strong className="text-slate-800">{todayFormatted}</strong></span>
          </div>

          <p className="leading-relaxed text-slate-600">
            To prevent any data loss from browser cache clears or hardware faults, the system has prepared an offline export of your entire local POS database.
          </p>

          {/* Data Summary Grid */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-blue-50/70 border border-blue-100 rounded-xl p-3 text-center">
              <span className="text-xs font-semibold text-blue-600 block">Inventory</span>
              <span className="text-xl font-extrabold text-blue-900">{productsCount}</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Products</span>
            </div>

            <div className="bg-emerald-50/70 border border-emerald-100 rounded-xl p-3 text-center">
              <span className="text-xs font-semibold text-emerald-600 block">Sales</span>
              <span className="text-xl font-extrabold text-emerald-900">{salesCount}</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Transactions</span>
            </div>

            <div className="bg-purple-50/70 border border-purple-100 rounded-xl p-3 text-center">
              <span className="text-xs font-semibold text-purple-600 block">Directory</span>
              <span className="text-xl font-extrabold text-purple-900">{customersCount}</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Customers</span>
            </div>
          </div>

          <div className="flex items-start space-x-2 text-xs text-amber-800 bg-amber-50 p-3 rounded-xl border border-amber-200">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p>
              Saving a daily copy to your local drive guarantees you can restore 100% of your business data at any time under Settings &gt; Backup &amp; Restore.
            </p>
          </div>

          {downloaded && (
            <div className="flex items-center space-x-2 text-xs font-bold text-emerald-700 bg-emerald-50 p-3 rounded-xl border border-emerald-200 animate-in fade-in">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>Backup downloaded successfully to your downloads folder! Closing...</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleDismiss}
            className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition-colors"
          >
            Remind Me Tomorrow
          </button>

          <button
            type="button"
            onClick={handleDownload}
            disabled={downloaded}
            className="flex items-center space-x-2 px-5 py-2.5 bg-[#0b5fa5] hover:bg-[#094e88] text-white text-xs font-bold rounded-xl shadow-md transition-all disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>Download Daily Backup (.json)</span>
          </button>
        </div>
      </div>
    </div>
  );
};

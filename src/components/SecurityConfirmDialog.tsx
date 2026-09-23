import React from 'react';
import { AlertTriangle, ShieldAlert, CheckCircle2, Info, X } from 'lucide-react';

export interface ConfirmDetailItem {
  label: string;
  value: string | number;
  highlight?: boolean;
  badge?: string;
  badgeColor?: 'emerald' | 'rose' | 'amber' | 'blue' | 'purple' | 'slate';
}

export interface SecurityConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string | React.ReactNode;
  details?: ConfirmDetailItem[];
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info' | 'success';
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const SecurityConfirmDialog: React.FC<SecurityConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  details = [],
  confirmText = 'Yes, Confirm & Proceed',
  cancelText = 'Cancel',
  variant = 'warning',
  isLoading = false,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  const getVariantStyles = () => {
    switch (variant) {
      case 'danger':
        return {
          icon: <ShieldAlert className="w-6 h-6 text-rose-600" />,
          iconBg: 'bg-rose-100 border-rose-200',
          headerBg: 'bg-rose-50 border-rose-200',
          titleColor: 'text-rose-950',
          confirmBtn: 'bg-rose-600 hover:bg-rose-700 active:scale-98 text-white focus:ring-rose-500 shadow-rose-200',
        };
      case 'success':
        return {
          icon: <CheckCircle2 className="w-6 h-6 text-emerald-600" />,
          iconBg: 'bg-emerald-100 border-emerald-200',
          headerBg: 'bg-emerald-50 border-emerald-200',
          titleColor: 'text-emerald-950',
          confirmBtn: 'bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white focus:ring-emerald-500 shadow-emerald-200',
        };
      case 'info':
        return {
          icon: <Info className="w-6 h-6 text-[#0b5fa5]" />,
          iconBg: 'bg-blue-100 border-blue-200',
          headerBg: 'bg-blue-50 border-blue-200',
          titleColor: 'text-slate-900',
          confirmBtn: 'bg-[#0b5fa5] hover:bg-[#094e88] active:scale-98 text-white focus:ring-blue-500 shadow-blue-200',
        };
      case 'warning':
      default:
        return {
          icon: <AlertTriangle className="w-6 h-6 text-amber-600" />,
          iconBg: 'bg-amber-100 border-amber-200',
          headerBg: 'bg-amber-50 border-amber-200',
          titleColor: 'text-amber-950',
          confirmBtn: 'bg-amber-600 hover:bg-amber-700 active:scale-98 text-white focus:ring-amber-500 shadow-amber-200',
        };
    }
  };

  const styles = getVariantStyles();

  return (
    <div 
      id="security-confirm-overlay"
      className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLoading) onCancel();
      }}
    >
      <div 
        id="security-confirm-card"
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md my-auto overflow-hidden border border-slate-200 animate-scale-up"
      >
        {/* Header Bar */}
        <div className={`p-4 border-b flex items-start justify-between ${styles.headerBg}`}>
          <div className="flex items-center space-x-3">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center border shrink-0 ${styles.iconBg}`}>
              {styles.icon}
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="text-[10px] uppercase font-black tracking-widest text-slate-500 bg-white/80 px-2 py-0.5 rounded border border-slate-200">
                  Security Safeguard
                </span>
              </div>
              <h3 className={`font-black text-base sm:text-lg leading-tight mt-0.5 ${styles.titleColor}`}>
                {title}
              </h3>
            </div>
          </div>
          <button
            id="security-confirm-close-btn"
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-white/60 transition disabled:opacity-30 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-5 space-y-4 text-slate-700">
          {/* Main Message */}
          <div className="text-xs sm:text-sm font-medium leading-relaxed">
            {message}
          </div>

          {/* Itemized Details Card if provided */}
          {details.length > 0 && (
            <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/90 space-y-2 text-xs">
              {details.map((item, index) => (
                <div 
                  key={index}
                  className={`flex items-center justify-between py-1 border-b border-slate-200/60 last:border-0 ${
                    item.highlight ? 'font-bold text-slate-900' : 'text-slate-600'
                  }`}
                >
                  <span className="text-slate-500">{item.label}</span>
                  <div className="flex items-center space-x-1.5">
                    <span className={item.highlight ? 'font-mono text-slate-950 font-black' : 'font-semibold'}>
                      {item.value}
                    </span>
                    {item.badge && (
                      <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold uppercase ${
                        item.badgeColor === 'emerald' ? 'bg-emerald-100 text-emerald-800' :
                        item.badgeColor === 'rose' ? 'bg-rose-100 text-rose-800' :
                        item.badgeColor === 'blue' ? 'bg-blue-100 text-blue-800' :
                        item.badgeColor === 'purple' ? 'bg-purple-100 text-purple-800' :
                        'bg-amber-100 text-amber-800'
                      }`}>
                        {item.badge}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Safety Notice */}
          <div className="flex items-center space-x-2 text-[11px] text-slate-500 bg-slate-100/70 p-2.5 rounded-lg border border-slate-200/60">
            <ShieldAlert className="w-4 h-4 text-slate-400 shrink-0" />
            <span>This verification step prevents accidental clicks and protects ledger integrity.</span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end space-x-2.5">
          <button
            id="security-confirm-cancel-btn"
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-700 font-bold rounded-xl text-xs border border-slate-300 transition shadow-xs cursor-pointer disabled:opacity-40"
          >
            {cancelText}
          </button>
          
          <button
            id="security-confirm-execute-btn"
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-5 py-2.5 font-black rounded-xl text-xs shadow-md transition flex items-center space-x-1.5 cursor-pointer disabled:opacity-50 ${styles.confirmBtn}`}
          >
            {isLoading ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <span>{confirmText}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

import React from 'react';
import { CartItem, ShopSettings } from '../types';
import { ShoppingBag, Sparkles, Heart, ShieldCheck, CheckCircle2 } from 'lucide-react';

interface CustomerDisplayModalProps {
  cartItems: CartItem[];
  settings: ShopSettings;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  onClose: () => void;
}

export const CustomerDisplayModal: React.FC<CustomerDisplayModalProps> = ({
  cartItems,
  settings,
  subtotal,
  tax,
  discount,
  total,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 bg-slate-950 text-white z-50 flex flex-col font-sans select-none">
      
      {/* Top Banner */}
      <div className="bg-[#0f6cbd] px-8 py-4 flex justify-between items-center border-b border-blue-400/30">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-white text-[#0f6cbd] flex items-center justify-center font-black text-xl shadow-lg">
            BC
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight">Bloom & Carry</h1>
            <p className="text-xs text-blue-100">Official Checkout Terminal — Thank you for shopping with us!</p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="text-xs font-bold text-blue-200 hover:text-white bg-blue-800/50 px-3 py-1.5 rounded-xl transition border border-blue-400/30"
        >
          Close Display Window
        </button>
      </div>

      {/* Main Secondary Screen Content */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 overflow-hidden">
        
        {/* Scanned Cart Items (Left 2 cols) */}
        <div className="lg:col-span-2 p-8 overflow-y-auto space-y-4 bg-slate-900/60">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-2">
            <ShoppingBag className="w-4 h-4 text-emerald-400" />
            <span>Scanned Items ({cartItems.reduce((a, b) => a + b.quantity, 0)})</span>
          </h2>

          {cartItems.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-slate-500 space-y-2">
              <Sparkles className="w-12 h-12 text-slate-600 animate-pulse" />
              <p className="text-base font-semibold">Welcome to Bloom & Carry! Next order scanning...</p>
            </div>
          ) : (
            <div className="space-y-2">
              {cartItems.map((item, idx) => (
                <div 
                  key={idx} 
                  className="bg-slate-800/90 p-4 rounded-2xl border border-slate-700/60 flex items-center justify-between"
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 rounded-xl bg-slate-700 flex items-center justify-center font-bold text-slate-300 overflow-hidden">
                      {item.product?.image_url ? (
                        <img src={item.product.image_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        (item.product?.name || 'Item').substring(0, 2).toUpperCase()
                      )}
                    </div>
                    <div>
                      <h3 className="font-bold text-base text-white">{item.product.name}</h3>
                      <p className="text-xs text-slate-400">
                        {item.product.category} • {settings.currency_symbol || 'Rs.'} {(item.final_unit_price ?? 0).toLocaleString()} x {item.quantity}
                      </p>
                    </div>
                  </div>

                  <div className="text-right font-black text-lg text-emerald-400">
                    {settings.currency_symbol || 'Rs.'} {(item.line_total ?? 0).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Total & Loyalty Banner (Right 1 col) */}
        <div className="p-8 bg-slate-950 flex flex-col justify-between border-l border-slate-800">
          
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-purple-900/40 to-indigo-900/40 p-5 rounded-2xl border border-purple-500/30 space-y-2">
              <div className="flex items-center space-x-2 text-purple-300 text-xs font-bold uppercase">
                <Heart className="w-4 h-4 text-purple-400" />
                <span>Bloom Rewards Loyalty</span>
              </div>
              <p className="text-xs text-slate-300">
                Earn 1 Point for every Rs 100 spent! Redeem points on your next purchase for instant discounts.
              </p>
            </div>

            <div className="space-y-3 font-mono text-sm border-t border-slate-800 pt-4">
              <div className="flex justify-between text-slate-400">
                <span>Subtotal Net:</span>
                <span>{settings.currency_symbol || 'Rs.'} {(subtotal ?? 0).toLocaleString()}</span>
              </div>

              {tax > 0 && (
                <div className="flex justify-between text-slate-400">
                  <span>Sales Tax ({settings.tax_rate || 16}%):</span>
                  <span>{settings.currency_symbol || 'Rs.'} {(tax ?? 0).toLocaleString()}</span>
                </div>
              )}

              {discount > 0 && (
                <div className="flex justify-between text-amber-400 font-bold">
                  <span>Discount Applied:</span>
                  <span>- {settings.currency_symbol || 'Rs.'} {(discount ?? 0).toLocaleString()}</span>
                </div>
              )}

              <div className="flex justify-between items-baseline pt-4 border-t border-slate-700 text-white font-sans">
                <span className="text-lg font-black uppercase tracking-wider text-slate-300">Total Due:</span>
                <span className="text-3xl font-black text-emerald-400 font-mono">
                  {settings.currency_symbol || 'Rs.'} {(total ?? 0).toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800 text-center text-xs text-slate-400 space-y-1">
            <div className="flex items-center justify-center space-x-1.5 text-emerald-400 font-bold">
              <CheckCircle2 className="w-4 h-4" />
              <span>Verified Hardware Checkout Terminal</span>
            </div>
            <p className="text-[11px] text-slate-500">Contact store manager for questions or split payment assistance.</p>
          </div>

        </div>

      </div>

    </div>
  );
};

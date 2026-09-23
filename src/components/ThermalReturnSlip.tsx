import React from 'react';
import { ReturnTransaction, ShopSettings } from '../types';
import { generateBarcodeSVG } from '../services/barcode';
import { EscPosService } from '../services/escpos';
import { Printer, Copy, Check, Share2 } from 'lucide-react';

interface ThermalReturnSlipProps {
  returnTx: ReturnTransaction | null;
  settings: ShopSettings;
  onClose?: () => void;
}

export const ThermalReturnSlip: React.FC<ThermalReturnSlipProps> = ({
  returnTx,
  settings,
  onClose,
}) => {
  if (!returnTx) return null;

  const barcodeSvg = generateBarcodeSVG(returnTx.return_no, 200, 45);

  const handleCopySummary = () => {
    const summary = `Bloom & Carry - RETURN VOUCHER ${returnTx.return_no}\nOriginal Inv: ${returnTx.original_invoice_no}\nTotal Refund: ${settings.currency_symbol || 'Rs.'} ${returnTx.total_refund_amount}\nMethod: ${returnTx.refund_method}${returnTx.store_credit_code ? `\nStore Credit Voucher: ${returnTx.store_credit_code}` : ''}`;
    navigator.clipboard.writeText(summary);
    alert('Return slip summary copied to clipboard!');
  };

  return (
    <div className="thermal-return-slip-wrapper font-sans">
      
      {/* On-screen Preview Modal */}
      <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto no-print">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm max-h-[calc(100vh-1.5rem)] flex flex-col my-auto overflow-hidden border border-slate-200 animate-scale-up">
          
          {/* Header Action Bar */}
          <div className="bg-rose-700 text-white px-4 py-3 flex items-center justify-between shrink-0">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-rose-300 animate-ping" />
              <span className="font-extrabold text-xs uppercase tracking-wider">Official Return Voucher (80mm)</span>
            </div>
            <button 
              onClick={onClose}
              className="text-white/80 hover:text-white font-bold text-base px-2 py-0.5 rounded-lg hover:bg-white/20 transition cursor-pointer"
            >
              ✕
            </button>
          </div>

          {/* Paper Content Preview */}
          <div className="p-4 sm:p-6 bg-slate-50 font-mono text-slate-800 text-xs leading-relaxed space-y-3 shadow-inner overflow-y-auto flex-1 overscroll-contain">
            
            {/* Header / Shop Info */}
            <div className="text-center border-b border-dashed border-slate-300 pb-3 space-y-1">
              <h2 className="font-black text-lg text-slate-900 uppercase tracking-tight">
                {settings.shop_name || 'Bloom & Carry Cosmetics'}
              </h2>
              {settings.tagline && <p className="text-[10px] text-slate-500 italic">{settings.tagline}</p>}
              <p className="text-[11px] font-sans">{settings.address || 'Hostel City Line 10, Yasmeen Plaza, Shop No. 1, Islamabad.'}</p>
              <p className="text-[11px] font-sans">Tel: {settings.phone || '03461185406'}</p>
              <p className="text-[11px] font-sans text-[#0b5fa5] font-semibold">{settings.website || 'bloomandcarry.com'}</p>
              
              <div className="inline-block bg-rose-100 text-rose-800 text-[10px] font-black uppercase tracking-widest px-3 py-0.5 rounded-full mt-2 border border-rose-300">
                ★ RETURN & REFUND VOUCHER ★
              </div>
            </div>

            {/* Voucher Metadata */}
            <div className="border-b border-dashed border-slate-300 pb-2 text-[11px] space-y-0.5">
              <div className="flex justify-between">
                <span>Return Slip No:</span>
                <span className="font-bold text-rose-700">{returnTx.return_no}</span>
              </div>
              <div className="flex justify-between">
                <span>Orig. Invoice No:</span>
                <span className="font-bold">{returnTx.original_invoice_no}</span>
              </div>
              <div className="flex justify-between">
                <span>Date & Time:</span>
                <span>{returnTx.datetime ? new Date(returnTx.datetime).toLocaleString() : '-'}</span>
              </div>
              <div className="flex justify-between">
                <span>Customer:</span>
                <span className="font-bold">{returnTx.customer_name}</span>
              </div>
              <div className="flex justify-between">
                <span>Cashier:</span>
                <span>{returnTx.cashier_name}</span>
              </div>
              <div className="flex justify-between">
                <span>Refund Method:</span>
                <span className="font-bold text-slate-900">{returnTx.refund_method.replace('_', ' ')}</span>
              </div>
            </div>

            {/* Returned Items Table */}
            <div className="border-b border-dashed border-slate-300 pb-2">
              <div className="flex justify-between font-bold border-b pb-1 text-[11px]">
                <span className="flex-1">Item & Condition</span>
                <span className="w-8 text-center">Qty</span>
                <span className="w-16 text-right">Refund</span>
              </div>
              <div className="space-y-1.5 mt-1.5">
                {returnTx.items.map((item, idx) => (
                  <div key={idx} className="text-[11px] border-b border-slate-200/60 pb-1">
                    <div className="flex justify-between">
                      <span className="flex-1 pr-1 truncate font-medium">{item.name}</span>
                      <span className="w-8 text-center font-bold text-rose-600">-{item.return_quantity}</span>
                      <span className="w-16 text-right font-bold">
                        {settings.currency_symbol} {(item.refund_line_total ?? (item.refund_unit_price * (item.return_quantity || 1)) ?? 0).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[9px] text-slate-500 mt-0.5">
                      <span>Reason: {item.reason}</span>
                      <span className={`px-1 py-0.2 rounded font-bold ${
                        item.condition === 'RESTOCK_SELLABLE' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {item.condition === 'RESTOCK_SELLABLE' ? 'Restocked to Shelf' : 'Damaged / Scrap'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Totals */}
            <div className="space-y-1 text-[11px] font-sans border-b border-dashed border-slate-300 pb-3">
              <div className="flex justify-between">
                <span>Subtotal Returned:</span>
                <span>{settings.currency_symbol} {(returnTx.subtotal_refund ?? 0).toLocaleString()}</span>
              </div>
              {(returnTx.tax_refund || 0) > 0 && (
                <div className="flex justify-between">
                  <span>Tax Refunded:</span>
                  <span>{settings.currency_symbol} {(returnTx.tax_refund ?? 0).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-black text-sm text-rose-700 border-t border-slate-300 pt-1">
                <span>TOTAL REFUND:</span>
                <span>-{settings.currency_symbol} {(returnTx.total_refund_amount ?? 0).toLocaleString()}</span>
              </div>
            </div>

            {/* Store Credit Voucher Code Display */}
            {returnTx.store_credit_code && (
              <div className="bg-amber-50 border-2 border-dashed border-amber-400 p-3 rounded-xl text-center space-y-1">
                <p className="text-[10px] text-amber-900 font-bold uppercase tracking-wider">Store Credit Voucher Code</p>
                <p className="text-base font-black font-mono text-amber-950 tracking-wider bg-white py-1 px-2 rounded-lg border border-amber-300">
                  {returnTx.store_credit_code}
                </p>
                <p className="text-[9px] text-amber-800">
                  Valid for 1 Year (Until {returnTx.store_credit_valid_until}) across all Bloom & Carry branches.
                </p>
              </div>
            )}

            {/* Customer & Cashier Signature Box */}
            <div className="pt-2 grid grid-cols-2 gap-4 text-[9px] text-slate-500 font-sans border-b border-dashed border-slate-300 pb-3">
              <div className="text-center">
                <div className="border-b border-slate-400 h-6 mb-1"></div>
                <span>Customer Signature</span>
              </div>
              <div className="text-center">
                <div className="border-b border-slate-400 h-6 mb-1"></div>
                <span>Cashier / Authorized</span>
              </div>
            </div>

            {/* Barcode & Footer */}
            <div className="text-center space-y-2 pt-1">
              <div 
                className="flex justify-center"
                dangerouslySetInnerHTML={{ __html: barcodeSvg }} 
              />
              <p className="text-[9px] text-slate-500 uppercase tracking-tight font-sans">
                Product Return Verification Slip <br/> Retain this voucher for accounting records.
              </p>
            </div>

          </div>

          {/* Action Buttons */}
          <div className="p-3 bg-slate-100 border-t space-y-2 shrink-0">
            <div className="flex space-x-2">
              <button
                type="button"
                onClick={() => EscPosService.triggerCashDrawer()}
                className="px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl transition cursor-pointer"
                title="Pop Drawer"
              >
                Drawer
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 py-2 bg-rose-700 hover:bg-rose-800 text-white font-extrabold text-xs rounded-xl shadow-xs transition flex items-center justify-center space-x-1 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>🖨️ Print Return Slip</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <button
                type="button"
                onClick={() => {
                  const phone = returnTx.customer_phone ? returnTx.customer_phone.replace(/[^0-9]/g, '') : '';
                  const storeLoc = encodeURIComponent(settings.address || 'Hostel City Line 10, Yasmeen Plaza, Shop No. 1, Islamabad.');
                  const storePhone = encodeURIComponent(settings.phone || '03461185406');
                  const storeWeb = encodeURIComponent(settings.website || 'bloomandcarry.com');
                  const msg = `*${settings.shop_name || 'Bloom & Carry'} Return Slip*%0AReturn Slip: ${returnTx.return_no}%0AOriginal Inv: ${returnTx.original_invoice_no}%0AStore: ${storeLoc}%0ATel: ${storePhone}%0AWeb: ${storeWeb}%0ARefund Amount: ${settings.currency_symbol || 'Rs.'}${returnTx.total_refund_amount}%0APaid Via: ${returnTx.refund_method}${returnTx.store_credit_code ? `%0AStore Credit Voucher Code: *${returnTx.store_credit_code}*` : ''}%0AThank you!`;
                  window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
                }}
                className="py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition flex items-center justify-center space-x-1 cursor-pointer"
              >
                <Share2 className="w-3 h-3" />
                <span>WhatsApp Return Slip</span>
              </button>

              <button
                type="button"
                onClick={handleCopySummary}
                className="py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-lg transition flex items-center justify-center space-x-1 cursor-pointer"
              >
                <Copy className="w-3 h-3" />
                <span>Copy Summary</span>
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* Hidden Printable HTML block */}
      <div id="thermal-return-receipt" className="print-only hidden">
        <div style={{ width: settings.paper_width || '80mm', margin: '0 auto', fontFamily: 'monospace', fontSize: '11px', padding: '5px' }}>
          <div style={{ textAlign: 'center', marginBottom: '8px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 'bold', margin: '0 0 4px 0' }}>{settings.shop_name}</h2>
            <p style={{ margin: '0', fontSize: '10px' }}>{settings.address || 'Hostel City Line 10, Yasmeen Plaza, Shop No. 1, Islamabad.'}</p>
            <p style={{ margin: '0', fontSize: '10px' }}>Tel: {settings.phone || '03461185406'}</p>
            <p style={{ margin: '0', fontSize: '10px' }}>Web: {settings.website || 'bloomandcarry.com'}</p>
            <p style={{ margin: '4px 0 0 0', fontWeight: 'bold', fontSize: '12px' }}>*** RETURN & REFUND VOUCHER ***</p>
          </div>

          <div style={{ borderTop: '1px dashed #000', borderBottom: '1px dashed #000', padding: '4px 0', margin: '6px 0' }}>
            <div>Return No: {returnTx.return_no}</div>
            <div>Orig Inv: {returnTx.original_invoice_no}</div>
            <div>Date: {returnTx.datetime ? new Date(returnTx.datetime).toLocaleString() : '-'}</div>
            <div>Customer: {returnTx.customer_name}</div>
            <div>Cashier: {returnTx.cashier_name}</div>
            <div>Method: {returnTx.refund_method}</div>
          </div>

          <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', margin: '6px 0' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #000' }}>
                <th>Item</th>
                <th style={{ textAlign: 'center' }}>Qty</th>
                <th style={{ textAlign: 'right' }}>Refund</th>
              </tr>
            </thead>
            <tbody>
              {returnTx.items.map((item, idx) => (
                <tr key={idx}>
                  <td>{item.name} ({item.condition === 'RESTOCK_SELLABLE' ? 'Restocked' : 'Damaged'})</td>
                  <td style={{ textAlign: 'center' }}>-{item.return_quantity}</td>
                  <td style={{ textAlign: 'right' }}>{item.refund_line_total}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ borderTop: '1px dashed #000', paddingTop: '4px', textAlign: 'right' }}>
            <div>Subtotal Refund: {returnTx.subtotal_refund}</div>
            {returnTx.tax_refund > 0 && <div>Tax Refund: {returnTx.tax_refund}</div>}
            <div style={{ fontWeight: 'bold', fontSize: '13px', marginTop: '4px' }}>
              TOTAL REFUND: -{settings.currency_symbol} {returnTx.total_refund_amount}
            </div>
          </div>

          {returnTx.store_credit_code && (
            <div style={{ border: '1px dashed #000', padding: '6px', margin: '8px 0', textAlign: 'center' }}>
              <div>STORE CREDIT VOUCHER CODE:</div>
              <div style={{ fontSize: '14px', fontWeight: 'bold' }}>{returnTx.store_credit_code}</div>
              <div style={{ fontSize: '9px' }}>Valid until: {returnTx.store_credit_valid_until}</div>
            </div>
          )}

          <div style={{ textAlign: 'center', marginTop: '12px' }}>
            <div dangerouslySetInnerHTML={{ __html: barcodeSvg }} />
            <p style={{ fontSize: '9px', marginTop: '4px' }}>Return verification voucher.</p>
          </div>
        </div>
      </div>

    </div>
  );
};

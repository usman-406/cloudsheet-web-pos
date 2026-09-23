import React, { useState } from 'react';
import { Sale, ShopSettings } from '../types';
import { generateBarcodeSVG } from '../services/barcode';
import { EscPosService } from '../services/escpos';
import { PrintService } from '../services/print_service';
import { HardwareManager } from '../services/hardwareManager';
import { WorkspaceService } from '../services/workspace';
import { 
  Printer, 
  Share2, 
  Mail, 
  Key, 
  CheckCircle2, 
  X, 
  Sparkles,
  Usb
} from 'lucide-react';

interface ThermalReceiptProps {
  sale: Sale | null;
  settings: ShopSettings;
  onClose?: () => void;
}

export const ThermalReceipt: React.FC<ThermalReceiptProps> = ({ sale, settings, onClose }) => {
  if (!sale) return null;

  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailStatus, setEmailStatus] = useState<string | null>(null);
  const [isDirectUsbPrinting, setIsDirectUsbPrinting] = useState(false);
  const [usbPrintResult, setUsbPrintResult] = useState<string | null>(null);

  const barcodeSvg = generateBarcodeSVG(sale.invoice_no, 220, 48);

  const handlePrintStandard = () => {
    // Enqueue hardware job & execute 80mm print
    HardwareManager.getInstance().enqueueJob('printer', 'print_receipt', { sale, settings }, 'high');
  };

  const handleDirectUsbPrint = async () => {
    setIsDirectUsbPrinting(true);
    setUsbPrintResult(null);

    // If not paired, attempt WebUSB pairing
    const pairedName = PrintService.getPairedUsbDeviceName();
    if (!pairedName) {
      const pairRes = await PrintService.pairUsbPrinter();
      if (!pairRes.success) {
        setUsbPrintResult(`USB Pairing Note: ${pairRes.message}. Using 80mm Driver fallback.`);
        setTimeout(() => setUsbPrintResult(null), 5000);
        setIsDirectUsbPrinting(false);
        handlePrintStandard();
        return;
      }
    }

    // Direct buffer write
    const res = await PrintService.executePrintJob(sale, settings, HardwareManager.getInstance().getConfig());
    setUsbPrintResult(res.message);
    setTimeout(() => setUsbPrintResult(null), 4000);
    setIsDirectUsbPrinting(false);
  };

  const handleSendGmailReceipt = async () => {
    const defaultEmail = sale.customer_phone?.includes('@') ? sale.customer_phone : settings.email || '';
    const targetEmail = prompt('Enter recipient email address for digital invoice:', defaultEmail);
    if (!targetEmail || !targetEmail.includes('@')) {
      if (targetEmail) alert('Please enter a valid email address.');
      return;
    }

    setIsSendingEmail(true);
    setEmailStatus(null);
    try {
      await WorkspaceService.sendInvoiceReceiptEmail(targetEmail, sale, settings);
      setEmailStatus(`Receipt emailed to ${targetEmail}`);
      setTimeout(() => setEmailStatus(null), 4000);
    } catch (err: any) {
      alert(`Gmail Dispatch Note: ${err.message || 'Please sign in with Google in Workspace Center.'}`);
    } finally {
      setIsSendingEmail(false);
    }
  };

  return (
    <div className="thermal-receipt-wrapper">
      
      {/* On-screen Print Modal preview styling */}
      <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto no-print">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm max-h-[calc(100vh-1.5rem)] sm:max-h-[calc(100vh-2rem)] flex flex-col my-auto overflow-hidden border border-slate-200 animate-scale-up">
          
          {/* Header Action Bar */}
          <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between font-sans shrink-0 border-b border-slate-800">
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 rounded-lg bg-[#0b5fa5] text-white flex items-center justify-center">
                <Printer className="w-3.5 h-3.5" />
              </div>
              <div>
                <span className="font-extrabold text-xs tracking-wider uppercase">POS-80 Thermal Receipt</span>
                <span className="ml-1.5 px-1.5 py-0.5 bg-emerald-500/20 text-emerald-300 rounded text-[9px] font-bold">80mm USB</span>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="text-slate-400 hover:text-white font-bold text-base px-2 py-0.5 rounded-lg hover:bg-slate-800 transition cursor-pointer"
              title="Close Receipt"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Paper Content Preview Container */}
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
              <div className="inline-block bg-slate-200 text-slate-700 text-[9px] font-bold px-2 py-0.5 rounded mt-1">
                80mm Continuous Thermal Roll
              </div>
            </div>

            {/* Invoice Info */}
            <div className="border-b border-dashed border-slate-300 pb-2 text-[11px] space-y-0.5">
              <div className="flex justify-between">
                <span>Inv No:</span>
                <span className="font-bold text-[#0b5fa5]">{sale.invoice_no}</span>
              </div>
              <div className="flex justify-between">
                <span>Date:</span>
                <span>{sale.datetime ? new Date(sale.datetime).toLocaleString() : '-'}</span>
              </div>
              <div className="flex justify-between">
                <span>Customer:</span>
                <span className="font-bold">{sale.customer_name || 'Walk-in Customer'}</span>
              </div>
              {sale.customer_phone && (
                <div className="flex justify-between">
                  <span>Phone:</span>
                  <span>{sale.customer_phone}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Payment:</span>
                <span className="font-bold">{sale.payment_method}</span>
              </div>
              <div className="flex justify-between">
                <span>Cashier:</span>
                <span>{sale.cashier_name}</span>
              </div>
            </div>

            {/* Items Table */}
            <div className="border-b border-dashed border-slate-300 pb-2">
              <div className="flex justify-between font-bold border-b pb-1 text-[11px] text-slate-900">
                <span className="flex-1">Item</span>
                <span className="w-10 text-center">Qty</span>
                <span className="w-16 text-right">Price</span>
              </div>
              <div className="space-y-1 mt-1">
                {sale.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-[11px]">
                    <span className="flex-1 pr-1 truncate">{item.name}</span>
                    <span className="w-10 text-center font-bold">x{item.quantity}</span>
                    <span className="w-16 text-right font-medium">{settings.currency_symbol || 'Rs.'} {(item.total ?? (item.quantity * item.sell_price) ?? 0).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Summary Totals */}
            <div className="space-y-1 text-[11px] font-sans border-b border-dashed border-slate-300 pb-3">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span className="font-mono">{settings.currency_symbol || 'Rs.'} {((sale.subtotal || sale.total) ?? 0).toLocaleString()}</span>
              </div>
              {(sale.discount || 0) > 0 && (
                <div className="flex justify-between text-red-600 font-semibold">
                  <span>Discount:</span>
                  <span className="font-mono">-{settings.currency_symbol || 'Rs.'} {(sale.discount ?? 0).toLocaleString()}</span>
                </div>
              )}
              {(sale.tax_amount || 0) > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>Tax ({sale.tax_rate}%):</span>
                  <span className="font-mono">+{settings.currency_symbol || 'Rs.'} {(sale.tax_amount ?? 0).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-black text-sm text-slate-900 border-t border-slate-300 pt-1">
                <span>GRAND TOTAL:</span>
                <span className="font-mono text-emerald-700">{settings.currency_symbol || 'Rs.'} {(sale.total ?? 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-[10px] text-slate-500 pt-0.5">
                <span>Paid ({sale.payment_method}):</span>
                <span className="font-mono">{settings.currency_symbol || 'Rs.'} {(sale.paid ?? 0).toLocaleString()}</span>
              </div>
              {(sale.change_due || 0) > 0 && (
                <div className="flex justify-between font-bold text-emerald-700">
                  <span>Change Due:</span>
                  <span className="font-mono">{settings.currency_symbol || 'Rs.'} {(sale.change_due ?? 0).toLocaleString()}</span>
                </div>
              )}
            </div>

            {/* Barcode & Footer */}
            <div className="text-center space-y-2 pt-1">
              <div 
                className="flex justify-center"
                dangerouslySetInnerHTML={{ __html: barcodeSvg }} 
              />
              <p className="text-[10px] text-slate-500 uppercase tracking-tight font-sans">
                Thank you for shopping with us! <br/> Software by Bloom & Carry POS
              </p>
            </div>

          </div>

          {/* Action Buttons & Digital Receipts */}
          <div className="p-3 bg-slate-100 border-t space-y-2 shrink-0 font-sans">
            
            {/* Primary Print Button */}
            <div className="flex space-x-2">
              <button
                type="button"
                onClick={() => EscPosService.triggerCashDrawer()}
                className="px-3 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl transition flex items-center space-x-1 cursor-pointer"
                title="Trigger 24V RJ11 Cash Drawer Kick Out"
              >
                <Key className="w-3.5 h-3.5" />
                <span>Drawer</span>
              </button>

              <button
                type="button"
                onClick={handlePrintStandard}
                className="flex-1 py-2.5 bg-[#0b5fa5] hover:bg-[#094e88] text-white font-extrabold text-xs rounded-xl shadow-md transition flex items-center justify-center space-x-1.5 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Print 80mm Receipt</span>
              </button>

              <button
                type="button"
                onClick={handleDirectUsbPrint}
                disabled={isDirectUsbPrinting}
                className="px-3 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl transition flex items-center space-x-1 cursor-pointer disabled:opacity-50"
                title="Direct WebUSB / ESC-POS hardware byte stream"
              >
                <Usb className="w-3.5 h-3.5 text-blue-400" />
                <span>Direct USB</span>
              </button>
            </div>

            {/* Digital Channels */}
            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <button
                type="button"
                onClick={() => {
                  const itemsSummary = sale.items.map(i => `${i.name} x${i.quantity} = ${settings.currency_symbol || 'Rs.'}${i.total}`).join('%0A');
                  const storeLoc = encodeURIComponent(settings.address || 'Hostel City Line 10, Yasmeen Plaza, Shop No. 1, Islamabad.');
                  const storePhone = encodeURIComponent(settings.phone || '03461185406');
                  const storeWeb = encodeURIComponent(settings.website || 'bloomandcarry.com');
                  const msg = `*${settings.shop_name || 'Bloom & Carry'} Receipt*%0AInvoice: ${sale.invoice_no}%0AStore: ${storeLoc}%0ATel: ${storePhone}%0AWeb: ${storeWeb}%0ATotal: ${settings.currency_symbol || 'Rs.'}${sale.total}%0AItems:%0A${itemsSummary}%0AThank you!`;
                  const phone = sale.customer_phone ? sale.customer_phone.replace(/[^0-9]/g, '') : '';
                  window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
                }}
                className="py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition flex items-center justify-center space-x-1 cursor-pointer"
              >
                <Share2 className="w-3 h-3" />
                <span>WhatsApp Receipt</span>
              </button>

              <button
                type="button"
                onClick={handleSendGmailReceipt}
                disabled={isSendingEmail}
                className="py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg transition flex items-center justify-center space-x-1 cursor-pointer disabled:opacity-50"
              >
                <Mail className="w-3 h-3" />
                <span>{isSendingEmail ? 'Sending...' : 'Gmail Receipt'}</span>
              </button>
            </div>

            {usbPrintResult && (
              <div className="text-[10px] text-center font-bold text-blue-800 bg-blue-100 py-1 px-2 rounded">
                ℹ️ {usbPrintResult}
              </div>
            )}

            {emailStatus && (
              <div className="text-[10px] text-center font-bold text-emerald-800 bg-emerald-100 py-1 px-2 rounded">
                ✓ {emailStatus}
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Hidden Printable HTML block (Active during window.print() for 80mm driver) */}
      <div id="thermal-receipt" className="print-only hidden">
        <div style={{ width: '76mm', margin: '0 auto', fontFamily: 'monospace', fontSize: '11px', padding: '2mm 2mm 8mm 2mm', color: '#000000', backgroundColor: '#ffffff' }}>
          
          {/* Shop Header */}
          <div style={{ textAlign: 'center', marginBottom: '6px' }}>
            <h2 style={{ fontSize: '15px', fontWeight: 'bold', margin: '0 0 2px 0', textTransform: 'uppercase' }}>
              {settings.shop_name || 'Bloom & Carry Cosmetics'}
            </h2>
            {settings.tagline && <p style={{ margin: '0', fontSize: '10px', fontStyle: 'italic' }}>{settings.tagline}</p>}
            <p style={{ margin: '0', fontSize: '10px' }}>{settings.address || 'Hostel City Line 10, Yasmeen Plaza, Shop No. 1, Islamabad.'}</p>
            <p style={{ margin: '0', fontSize: '10px' }}>Tel: {settings.phone || '03461185406'}</p>
            <p style={{ margin: '0', fontSize: '10px' }}>Web: {settings.website || 'bloomandcarry.com'}</p>
          </div>

          {/* Meta */}
          <div style={{ borderTop: '1px dashed #000', borderBottom: '1px dashed #000', padding: '4px 0', margin: '4px 0', fontSize: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>INV NO: {sale.invoice_no}</span>
              <span>{new Date(sale.datetime).toLocaleDateString()}</span>
            </div>
            <div>TIME: {new Date(sale.datetime).toLocaleTimeString()}</div>
            <div>CUSTOMER: {sale.customer_name || 'Walk-in'}</div>
            {sale.customer_phone && <div>PHONE: {sale.customer_phone}</div>}
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>CASHIER: {sale.cashier_name}</span>
              <span>PAY: {sale.payment_method}</span>
            </div>
          </div>

          {/* Table Header */}
          <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', margin: '4px 0', fontSize: '10px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #000' }}>
                <th style={{ padding: '2px 0' }}>ITEM</th>
                <th style={{ textAlign: 'center', padding: '2px 0' }}>QTY</th>
                <th style={{ textAlign: 'right', padding: '2px 0' }}>PRICE</th>
                <th style={{ textAlign: 'right', padding: '2px 0' }}>TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {sale.items.map((item, idx) => (
                <tr key={idx} style={{ borderBottom: '1px dotted #ccc' }}>
                  <td style={{ padding: '2px 0', maxWidth: '35mm', wordBreak: 'break-word' }}>{item.name}</td>
                  <td style={{ textAlign: 'center', padding: '2px 0' }}>{item.quantity}</td>
                  <td style={{ textAlign: 'right', padding: '2px 0' }}>{item.sell_price}</td>
                  <td style={{ textAlign: 'right', padding: '2px 0', fontWeight: 'bold' }}>{item.total}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div style={{ borderTop: '1px dashed #000', paddingTop: '4px', textAlign: 'right', fontSize: '10px' }}>
            <div>SUBTOTAL: {settings.currency_symbol || 'Rs.'} {((sale.subtotal || sale.total) ?? 0).toFixed(2)}</div>
            {(sale.discount || 0) > 0 && <div>DISCOUNT: -{settings.currency_symbol || 'Rs.'} {(sale.discount ?? 0).toFixed(2)}</div>}
            {(sale.tax_amount || 0) > 0 && <div>TAX ({sale.tax_rate}%): +{settings.currency_symbol || 'Rs.'} {(sale.tax_amount ?? 0).toFixed(2)}</div>}
            
            <div style={{ fontWeight: 'bold', fontSize: '13px', margin: '4px 0', borderTop: '1px solid #000', borderBottom: '1px solid #000', padding: '3px 0' }}>
              GRAND TOTAL: {settings.currency_symbol || 'Rs.'} {(sale.total ?? 0).toFixed(2)}
            </div>
            
            <div>PAID ({sale.payment_method}): {settings.currency_symbol || 'Rs.'} {(sale.paid ?? 0).toFixed(2)}</div>
            {(sale.change_due || 0) > 0 && <div style={{ fontWeight: 'bold' }}>CHANGE DUE: {settings.currency_symbol || 'Rs.'} {(sale.change_due ?? 0).toFixed(2)}</div>}
          </div>

          {/* Barcode & Cut Space */}
          <div style={{ textAlign: 'center', marginTop: '8px' }}>
            <div dangerouslySetInnerHTML={{ __html: barcodeSvg }} style={{ display: 'inline-block' }} />
            <p style={{ fontSize: '9px', margin: '4px 0 0 0', fontWeight: 'bold' }}>Thank you for shopping with us!</p>
            <p style={{ fontSize: '8px', margin: '1px 0 0 0', color: '#333' }}>Visit: {settings.website || 'bloomandcarry.com'}</p>
            <p style={{ fontSize: '8px', margin: '2px 0 0 0', color: '#555' }}>Goods exchangeable within 7 days with bill.</p>
          </div>

          {/* Extra bottom spacing for clean paper cutter action */}
          <div style={{ height: '6mm' }}></div>
        </div>
      </div>

    </div>
  );
};

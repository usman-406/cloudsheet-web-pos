import React, { useState } from 'react';
import { Product, ShopSettings } from '../types';
import { generateBarcodeSVG } from '../services/barcode';
import { Printer } from 'lucide-react';

interface BarcodeModalProps {
  product: Product;
  settings: ShopSettings;
  onClose: () => void;
}

export const BarcodeModal: React.FC<BarcodeModalProps> = ({ product, settings, onClose }) => {
  const [labelCount, setLabelCount] = useState<number>(12);
  const barcodeSvg = generateBarcodeSVG(product.barcode, 180, 50);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto font-sans">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[calc(100vh-2rem)] my-auto flex flex-col overflow-hidden border border-slate-200">
        
        {/* Header */}
        <div className="bg-[#0f6cbd] text-white p-3.5 sm:p-4 flex items-center justify-between shrink-0">
          <div>
            <h3 className="font-bold text-sm sm:text-base">Print Cosmetic Barcode Labels</h3>
            <p className="text-xs text-blue-100">{product.name} ({product.barcode})</p>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white font-bold text-lg px-2 cursor-pointer">✕</button>
        </div>

        {/* Configuration Bar */}
        <div className="p-3 sm:p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center space-x-2 text-xs">
            <span className="font-bold text-slate-700">Number of Labels:</span>
            <input
              type="number"
              min="1"
              max="100"
              value={labelCount}
              onChange={(e) => setLabelCount(Math.max(1, Number(e.target.value)))}
              className="w-20 px-2 py-1 border border-slate-300 rounded-md font-bold text-center bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0f6cbd]"
            />
          </div>

          <button
            onClick={() => window.print()}
            className="px-4 py-2 bg-[#0f6cbd] hover:bg-[#115ea3] text-white font-bold text-xs rounded-md shadow-xs flex items-center space-x-1.5 transition"
          >
            <Printer className="w-4 h-4" />
            <span>Print Label Sheet</span>
          </button>
        </div>

        {/* Printable Grid Preview */}
        <div className="p-4 sm:p-6 overflow-y-auto grow">
          <div id="barcode-labels-grid" className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {Array.from({ length: labelCount }).map((_, idx) => (
              <div 
                key={idx}
                className="p-3 border border-slate-200 rounded-md bg-white text-center space-y-1 shadow-xs text-xs"
              >
                <div className="font-bold text-slate-900 truncate leading-tight">{product.name}</div>
                {product.shade_code && (
                  <div className="text-[10px] text-slate-500 font-medium">{product.shade_code} {product.volume_ml ? `(${product.volume_ml})` : ''}</div>
                )}
                <div 
                  className="flex justify-center my-1"
                  dangerouslySetInnerHTML={{ __html: barcodeSvg }}
                />
                <div className="flex justify-between text-[11px] font-bold text-[#0f6cbd] pt-1 border-t border-slate-100">
                  <span>{product.barcode}</span>
                  <span>{settings.currency_symbol} {product.sell_price.toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};

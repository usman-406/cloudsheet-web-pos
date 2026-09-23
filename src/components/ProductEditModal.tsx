import React, { useState, useEffect } from 'react';
import { Plus, X, Tag, DollarSign, Percent, TrendingUp, Sparkles, ShieldCheck, Box } from 'lucide-react';
import { Product, ShopSettings } from '../types';

interface ProductEditModalProps {
  isOpen: boolean;
  product: Partial<Product> | null;
  categories: string[];
  settings: ShopSettings;
  onSave: (product: Product) => void;
  onClose: () => void;
  onQuickAddCategory?: (name: string) => void;
}

export const ProductEditModal: React.FC<ProductEditModalProps> = ({
  isOpen,
  product,
  categories,
  settings,
  onSave,
  onClose,
  onQuickAddCategory,
}) => {
  const [formData, setFormData] = useState<Partial<Product>>({});
  const [isAddingNewCategoryInline, setIsAddingNewCategoryInline] = useState(false);
  const [newCategoryNameInput, setNewCategoryNameInput] = useState('');

  // Sync form data when modal opens or product changes
  useEffect(() => {
    if (isOpen && product) {
      setFormData({ ...product });
      setIsAddingNewCategoryInline(false);
      setNewCategoryNameInput('');
    }
  }, [isOpen, product]);

  if (!isOpen || !formData) return null;

  const buyPrice = Number(formData.buy_price) || 0;
  const sellPrice = Number(formData.sell_price) || 0;
  const unitProfit = sellPrice - buyPrice;
  const profitMargin = sellPrice > 0 ? ((unitProfit / sellPrice) * 100).toFixed(1) : '0';
  const markupPercent = buyPrice > 0 ? ((unitProfit / buyPrice) * 100).toFixed(1) : '0';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.barcode) return;

    // Call onSave with complete updated product
    onSave(formData as Product);
  };

  const isNew = formData.id?.startsWith('prod_') && !formData.created_at;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto font-sans">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden border border-slate-200 my-auto animate-scale-up">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-[#0b5fa5] via-[#094e88] to-slate-900 text-white p-5 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center border border-white/20">
              <Sparkles className="w-5 h-5 text-blue-200" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-white">
                {isNew ? 'Add New Retail Product' : 'Edit Product Details'}
              </h3>
              <p className="text-xs text-blue-100/80">
                {formData.name || 'Catalog Item Specification & Pricing'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            
            {/* Product Name */}
            <div className="sm:col-span-2">
              <label className="block font-bold text-slate-700 mb-1">
                Product Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.name || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. Maybelline Fit Me Matte Foundation"
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-[#0b5fa5] focus:outline-none transition"
              />
            </div>

            {/* Barcode */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Barcode / SKU <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.barcode || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, barcode: e.target.value }))}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono text-slate-800 focus:bg-white focus:ring-2 focus:ring-[#0b5fa5] focus:outline-none transition"
              />
            </div>

            {/* Category */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block font-bold text-slate-700">
                  Category <span className="text-rose-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setIsAddingNewCategoryInline(!isAddingNewCategoryInline)}
                  className="text-[11px] font-bold text-[#0b5fa5] hover:underline flex items-center gap-0.5 cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>{isAddingNewCategoryInline ? 'Select Existing' : '+ New'}</span>
                </button>
              </div>

              {isAddingNewCategoryInline ? (
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    placeholder="Category name..."
                    value={newCategoryNameInput}
                    onChange={(e) => setNewCategoryNameInput(e.target.value)}
                    className="w-full p-2.5 bg-blue-50/50 border border-blue-300 rounded-xl font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-[#0b5fa5] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const trimmed = newCategoryNameInput.trim();
                      if (trimmed) {
                        setFormData(prev => ({ ...prev, category: trimmed }));
                        if (onQuickAddCategory) onQuickAddCategory(trimmed);
                        setIsAddingNewCategoryInline(false);
                        setNewCategoryNameInput('');
                      }
                    }}
                    className="px-3 py-1 text-xs font-bold text-white bg-[#0b5fa5] hover:bg-[#094e88] rounded-xl shrink-0 cursor-pointer"
                  >
                    Use
                  </button>
                </div>
              ) : (
                <select
                  value={formData.category || categories.filter(c => c !== 'All')[0] || 'General'}
                  onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-[#0b5fa5] focus:outline-none transition"
                >
                  {categories.filter(c => c !== 'All').map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Shade Code / Name */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">Shade / Variant</label>
              <input
                type="text"
                value={formData.shade_code || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, shade_code: e.target.value }))}
                placeholder="e.g. 120 Natural Ivory, Ruby Red"
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-[#0b5fa5] focus:outline-none transition"
              />
            </div>

            {/* Volume / Size */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">Volume / Pack Size</label>
              <input
                type="text"
                value={formData.volume_ml || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, volume_ml: e.target.value }))}
                placeholder="e.g. 30ml, 100g, 3.5g"
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-[#0b5fa5] focus:outline-none transition"
              />
            </div>

            {/* Physical Shelf / Location */}
            <div className="sm:col-span-2">
              <label className="block font-bold text-slate-700 mb-1">Shelf / Display Rack Location</label>
              <input
                type="text"
                value={formData.shelf_location || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, shelf_location: e.target.value }))}
                placeholder="e.g. Rack A-3, Lipstick Tower 2, Counter Front"
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-[#0b5fa5] focus:outline-none transition"
              />
            </div>

            {/* Buy Price */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Buy Price / Cost ({settings.currency_symbol})
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={formData.buy_price ?? 0}
                onChange={(e) => setFormData(prev => ({ ...prev, buy_price: Number(e.target.value) }))}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-[#0b5fa5] focus:outline-none transition"
              />
            </div>

            {/* Sell Price */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Selling Price ({settings.currency_symbol}) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min="0"
                step="any"
                required
                value={formData.sell_price ?? 0}
                onChange={(e) => setFormData(prev => ({ ...prev, sell_price: Number(e.target.value) }))}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-extrabold text-[#0b5fa5] focus:bg-white focus:ring-2 focus:ring-[#0b5fa5] focus:outline-none transition text-base"
              />
            </div>

            {/* Real-time Profit & Margin Analytics Card */}
            <div className="sm:col-span-2 bg-slate-50 border border-slate-200 p-3 rounded-2xl grid grid-cols-3 gap-2 text-center">
              <div className="bg-white p-2 rounded-xl border border-slate-100 shadow-2xs">
                <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">Gross Profit</span>
                <span className={`text-xs sm:text-sm font-black ${unitProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {settings.currency_symbol} {unitProfit.toLocaleString()}
                </span>
              </div>
              <div className="bg-white p-2 rounded-xl border border-slate-100 shadow-2xs">
                <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">Profit Margin</span>
                <span className={`text-xs sm:text-sm font-black ${Number(profitMargin) >= 0 ? 'text-blue-700' : 'text-rose-700'}`}>
                  {profitMargin}%
                </span>
              </div>
              <div className="bg-white p-2 rounded-xl border border-slate-100 shadow-2xs">
                <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">Markup Rate</span>
                <span className="text-xs sm:text-sm font-black text-amber-700">
                  {markupPercent}%
                </span>
              </div>
            </div>

            {/* Product Tax Option */}
            <div className="sm:col-span-2 bg-amber-50/70 border border-amber-200 p-3 rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <label className="block font-bold text-slate-800 text-xs">
                  Tax / GST Classification
                </label>
                <span className="text-[11px] font-semibold text-slate-500">
                  Store Default: {settings.tax_rate ?? 0}%
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({
                    ...prev,
                    is_tax_exempt: false,
                    tax_rate: undefined
                  }))}
                  className={`p-2 rounded-xl text-xs font-bold border text-center transition cursor-pointer ${
                    !formData.is_tax_exempt && (formData.tax_rate === undefined || formData.tax_rate === null)
                      ? 'bg-[#0b5fa5] text-white border-[#0b5fa5]'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  Default ({settings.tax_rate ?? 0}%)
                </button>

                <button
                  type="button"
                  onClick={() => setFormData(prev => ({
                    ...prev,
                    is_tax_exempt: true,
                    tax_rate: 0
                  }))}
                  className={`p-2 rounded-xl text-xs font-bold border text-center transition cursor-pointer ${
                    formData.is_tax_exempt
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  Tax Exempt (0%)
                </button>

                <button
                  type="button"
                  onClick={() => setFormData(prev => ({
                    ...prev,
                    is_tax_exempt: false,
                    tax_rate: formData.tax_rate ?? 18
                  }))}
                  className={`p-2 rounded-xl text-xs font-bold border text-center transition cursor-pointer ${
                    !formData.is_tax_exempt && formData.tax_rate !== undefined && formData.tax_rate !== null
                      ? 'bg-amber-600 text-white border-amber-600'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  Custom Rate
                </button>
              </div>

              {!formData.is_tax_exempt && formData.tax_rate !== undefined && formData.tax_rate !== null && (
                <div className="pt-1 flex items-center space-x-2">
                  <label className="text-xs font-bold text-slate-700 whitespace-nowrap">Custom Rate %:</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={formData.tax_rate}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      tax_rate: Number(e.target.value)
                    }))}
                    className="w-24 p-1.5 bg-white border border-amber-300 rounded-lg text-xs font-bold text-slate-900 focus:ring-2 focus:ring-[#0b5fa5]"
                    placeholder="e.g. 18"
                  />
                  <span className="text-[11px] text-slate-500">% applied specifically to this product SKU</span>
                </div>
              )}

              {/* Tax Preview */}
              <div className="bg-white p-2 rounded-xl border border-amber-200/80 flex justify-between items-center text-[11px]">
                {(() => {
                  const base = sellPrice;
                  const appliedRate = formData.is_tax_exempt
                    ? 0
                    : (formData.tax_rate !== undefined && formData.tax_rate !== null
                        ? formData.tax_rate
                        : (settings.tax_rate || 0));
                  const isInc = settings.tax_mode === 'INCLUSIVE';
                  let taxAmt = 0;
                  let checkoutTotal = 0;

                  if (appliedRate === 0) {
                    taxAmt = 0;
                    checkoutTotal = base;
                  } else if (isInc) {
                    const net = base / (1 + appliedRate / 100);
                    taxAmt = base - net;
                    checkoutTotal = base;
                  } else {
                    taxAmt = (base * appliedRate) / 100;
                    checkoutTotal = base + taxAmt;
                  }

                  return (
                    <>
                      <span className="text-slate-600">
                        Base: <strong>{settings.currency_symbol} {base.toLocaleString()}</strong> | Tax ({appliedRate}%): <strong>{settings.currency_symbol} {taxAmt.toFixed(2)}</strong>
                      </span>
                      <span className="font-extrabold text-[#0b5fa5]">
                        Checkout: {settings.currency_symbol} {checkoutTotal.toFixed(0)} {isInc ? '(Inc)' : '(+Tax)'}
                      </span>
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Stock Quantity */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Stock Quantity in Inventory <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min="0"
                required
                value={formData.stock_qty ?? 0}
                onChange={(e) => setFormData(prev => ({ ...prev, stock_qty: Number(e.target.value) }))}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-black text-slate-900 focus:bg-white focus:ring-2 focus:ring-[#0b5fa5] focus:outline-none transition"
              />
            </div>

            {/* Low Stock Alert */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">Low Stock Alert Level</label>
              <input
                type="number"
                min="1"
                value={formData.min_stock_alert ?? 5}
                onChange={(e) => setFormData(prev => ({ ...prev, min_stock_alert: Number(e.target.value) }))}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-[#0b5fa5] focus:outline-none transition"
              />
            </div>

            {/* Image URL */}
            <div className="sm:col-span-2">
              <label className="block font-bold text-slate-700 mb-1">Product Image URL</label>
              <input
                type="text"
                value={formData.image_url || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, image_url: e.target.value }))}
                placeholder="https://..."
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-700 focus:bg-white focus:ring-2 focus:ring-[#0b5fa5] focus:outline-none transition"
              />
            </div>

          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-3 bg-[#0b5fa5] hover:bg-[#094e88] text-white font-bold rounded-xl text-xs shadow-md transition cursor-pointer"
            >
              Save Product Details
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};

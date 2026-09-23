import React, { useState, useEffect } from 'react';
import { Product, Customer, ActiveTab, User } from '../types';
import { 
  Search, 
  ShoppingCart, 
  Package, 
  Receipt, 
  Users, 
  Wallet, 
  Settings as SettingsIcon, 
  FolderLock, 
  ShoppingBag, 
  Truck,
  ArrowRight,
  Sparkles,
  Cloud,
  Code2,
  Tags,
  BarChart3
} from 'lucide-react';

interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  customers: Customer[];
  currentUser?: User | null;
  onSelectTab: (tab: ActiveTab) => void;
  onSelectProduct?: (prod: Product) => void;
}

export const CommandPaletteModal: React.FC<CommandPaletteModalProps> = ({
  isOpen,
  onClose,
  products,
  customers,
  currentUser,
  onSelectTab,
  onSelectProduct,
}) => {
  const [query, setQuery] = useState('');
  const isAdmin = currentUser?.role === 'admin';

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
      } else if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filteredProducts = query.trim() ? products.filter(p => 
    p.name.toLowerCase().includes(query.toLowerCase()) ||
    p.barcode.includes(query) ||
    p.category.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 5) : [];

  const filteredCustomers = query.trim() ? customers.filter(c => 
    c.name.toLowerCase().includes(query.toLowerCase()) ||
    c.phone.includes(query)
  ).slice(0, 3) : [];

  const allNavs: { label: string; tab: ActiveTab; icon: React.ComponentType<any>; adminOnly?: boolean }[] = [
    { label: 'New POS Terminal Billing', tab: 'pos', icon: ShoppingCart },
    { label: 'Cash Register Shift Management', tab: 'shift_register', icon: Wallet },
    { label: 'Sales History Invoices', tab: 'sales', icon: Receipt },
    { label: 'Customers CRM Directory', tab: 'customers', icon: Users },
    { label: 'Product Inventory Catalog', tab: 'products', icon: Package, adminOnly: true },
    { label: 'Categories Setup & Management', tab: 'categories', icon: Tags, adminOnly: true },
    { label: 'Expenses Management Module', tab: 'expenses', icon: Wallet, adminOnly: true },
    { label: 'Stock Ledger & Audit', tab: 'stock_ledger', icon: FolderLock, adminOnly: true },
    { label: 'Business Intelligence & Executive Analytics', tab: 'bi_analytics', icon: BarChart3, adminOnly: true },
    { label: 'Import & Export Center', tab: 'import_export', icon: Sparkles, adminOnly: true },
    { label: 'Google Workspace & Cloud Hub', tab: 'google_workspace', icon: Cloud, adminOnly: true },
    { label: 'Google Sheets Integration Guide', tab: 'gas_guide', icon: Code2, adminOnly: true },
    { label: 'System Settings', tab: 'settings', icon: SettingsIcon, adminOnly: true },
  ];

  const quickNavs = allNavs.filter(nav => !nav.adminOnly || isAdmin);

  const matchingNavs = query.trim() 
    ? quickNavs.filter(n => n.label.toLowerCase().includes(query.toLowerCase()))
    : quickNavs;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-start justify-center pt-8 sm:pt-16 px-3 sm:px-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[calc(100vh-4rem)] flex flex-col overflow-hidden border border-slate-200">
        
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3 border-b border-slate-200 bg-slate-50/80 shrink-0">
          <Search className="w-5 h-5 text-slate-400 mr-2" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products, customers, or type command... (e.g. 'lipstick', 'pos', '0321')"
            className="w-full bg-transparent text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none"
          />
          <button 
            onClick={onClose}
            className="text-xs bg-slate-200 text-slate-600 font-bold px-2 py-1 rounded-lg hover:bg-slate-300 cursor-pointer"
          >
            ESC
          </button>
        </div>

        {/* Results List */}
        <div className="overflow-y-auto p-3 space-y-4 text-xs flex-1">
          
          {/* Quick Navigation Commands */}
          {matchingNavs.length > 0 && (
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-1.5">
                Quick Commands & Navigation
              </div>
              <div className="space-y-1">
                {matchingNavs.map((nav) => {
                  const Icon = nav.icon;
                  return (
                    <button
                      key={nav.tab}
                      onClick={() => {
                        onSelectTab(nav.tab);
                        onClose();
                      }}
                      className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-blue-50 text-slate-700 hover:text-[#0f6cbd] font-bold transition group"
                    >
                      <div className="flex items-center space-x-2.5">
                        <Icon className="w-4 h-4 text-slate-400 group-hover:text-[#0f6cbd]" />
                        <span>{nav.label}</span>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Product Results */}
          {filteredProducts.length > 0 && (
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-1.5">
                Matching Products
              </div>
              <div className="space-y-1">
                {filteredProducts.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      if (onSelectProduct) onSelectProduct(p);
                      onSelectTab('pos');
                      onClose();
                    }}
                    className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-slate-100 transition text-left"
                  >
                    <div className="flex items-center space-x-2.5">
                      <img src={p.image_url} alt="" className="w-8 h-8 rounded-lg object-cover" />
                      <div>
                        <div className="font-bold text-slate-900">{p.name}</div>
                        <div className="text-[10px] font-mono text-slate-400">Barcode: {p.barcode} | Stock: {p.stock_qty}</div>
                      </div>
                    </div>
                    <span className="font-extrabold text-[#0f6cbd]">Rs {p.sell_price.toLocaleString()}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Customer Results */}
          {filteredCustomers.length > 0 && (
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-1.5">
                Matching Customers
              </div>
              <div className="space-y-1">
                {filteredCustomers.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      onSelectTab('customers');
                      onClose();
                    }}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-100 transition text-left"
                  >
                    <div>
                      <div className="font-bold text-slate-900">{c.name}</div>
                      <div className="text-[10px] text-slate-500">{c.phone} | {c.points} Points</div>
                    </div>
                    <Users className="w-4 h-4 text-slate-400" />
                  </button>
                ))}
              </div>
            </div>
          )}

        </div>

        <div className="bg-slate-50 p-2 text-[11px] text-slate-400 text-center border-t">
          Use <kbd className="px-1 bg-white border rounded font-mono">↑</kbd> <kbd className="px-1 bg-white border rounded font-mono">↓</kbd> to navigate, <kbd className="px-1 bg-white border rounded font-mono">Enter</kbd> to select
        </div>

      </div>
    </div>
  );
};

import React, { useState, useMemo } from 'react';
import { 
  Tags, 
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
  Sparkles, 
  Heart, 
  Shield, 
  Eye, 
  Feather, 
  Sun, 
  Star, 
  Package, 
  Tag, 
  Palette, 
  AlertCircle, 
  CheckCircle2, 
  Download, 
  Layers,
  ArrowRight,
  Filter,
  RefreshCw,
  SlidersHorizontal
} from 'lucide-react';
import { Category, Product, ShopSettings } from '../types';

interface CategoriesManagementProps {
  categories: Category[];
  products: Product[];
  settings: ShopSettings;
  onSaveCategory: (category: Category) => void;
  onDeleteCategory: (categoryId: string, reassignToCategoryName?: string) => void;
  onResetCategories?: () => void;
  onSyncFromProducts?: () => void;
  onDeleteMultipleCategories?: (categoryIds: string[]) => void;
  onNavigateToProductsWithCategory?: (categoryName: string) => void;
}

// Available color styles for categories
export const CATEGORY_COLOR_PALETTES = [
  { id: 'rose', label: 'Rose Pink', class: 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100', badgeClass: 'bg-rose-100 text-rose-800' },
  { id: 'amber', label: 'Amber Gold', class: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100', badgeClass: 'bg-amber-100 text-amber-800' },
  { id: 'emerald', label: 'Emerald Mint', class: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100', badgeClass: 'bg-emerald-100 text-emerald-800' },
  { id: 'purple', label: 'Purple Plum', class: 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100', badgeClass: 'bg-purple-100 text-purple-800' },
  { id: 'violet', label: 'Violet Lavender', class: 'bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100', badgeClass: 'bg-violet-100 text-violet-800' },
  { id: 'cyan', label: 'Cyan Ocean', class: 'bg-cyan-50 text-cyan-700 border-cyan-200 hover:bg-cyan-100', badgeClass: 'bg-cyan-100 text-cyan-800' },
  { id: 'pink', label: 'Fuchsia Glow', class: 'bg-pink-50 text-pink-700 border-pink-200 hover:bg-pink-100', badgeClass: 'bg-pink-100 text-pink-800' },
  { id: 'indigo', label: 'Indigo Royal', class: 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100', badgeClass: 'bg-indigo-100 text-indigo-800' },
  { id: 'slate', label: 'Slate Neutral', class: 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200', badgeClass: 'bg-slate-200 text-slate-800' },
  { id: 'teal', label: 'Teal Luxury', class: 'bg-teal-50 text-teal-700 border-teal-200 hover:bg-teal-100', badgeClass: 'bg-teal-100 text-teal-800' },
];

export const CATEGORY_ICONS: { [key: string]: React.ComponentType<any> } = {
  Tag: Tag,
  Tags: Tags,
  Sparkles: Sparkles,
  Heart: Heart,
  Shield: Shield,
  Eye: Eye,
  Feather: Feather,
  Sun: Sun,
  Star: Star,
  Package: Package,
  Palette: Palette,
  Layers: Layers,
};

export const CategoriesManagement: React.FC<CategoriesManagementProps> = ({
  categories,
  products,
  settings,
  onSaveCategory,
  onDeleteCategory,
  onResetCategories,
  onSyncFromProducts,
  onNavigateToProductsWithCategory,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [isSyncingFromProducts, setIsSyncingFromProducts] = useState(false);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Partial<Category> | null>(null);
  const [modalError, setModalError] = useState('');
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);

  // Delete Dialog State
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [reassignCategoryName, setReassignCategoryName] = useState<string>('');
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [deletePasswordError, setDeletePasswordError] = useState<string | null>(null);

  // Pre-calculated product counts per category
  const productCountMap = useMemo(() => {
    const map = new Map<string, number>();
    products.forEach(p => {
      const cat = p.category ? p.category.trim().toLowerCase() : '';
      if (cat) {
        map.set(cat, (map.get(cat) || 0) + 1);
      }
    });
    return map;
  }, [products]);

  // Filtered categories
  const filteredCategories = useMemo(() => {
    return categories
      .filter(cat => {
        const matchesSearch = 
          cat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (cat.code && cat.code.toLowerCase().includes(searchQuery.toLowerCase())) ||
          (cat.description && cat.description.toLowerCase().includes(searchQuery.toLowerCase()));
        const matchesStatus = statusFilter === 'ALL' || cat.status === statusFilter;
        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => (a.display_order ?? 99) - (b.display_order ?? 99));
  }, [categories, searchQuery, statusFilter]);

  // Statistics
  const totalCategories = categories.length;
  const activeCategoriesCount = categories.filter(c => c.status === 'ACTIVE').length;
  const assignedProductsCount = products.length;

  const handleOpenAdd = () => {
    setEditingCategory({
      name: '',
      code: '',
      description: '',
      color: CATEGORY_COLOR_PALETTES[0].class,
      icon: 'Tag',
      status: 'ACTIVE',
      display_order: categories.length + 1,
    });
    setModalError('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (category: Category) => {
    setEditingCategory({ ...category });
    setModalError('');
    setIsModalOpen(true);
  };

  const handleSaveModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory || !editingCategory.name?.trim()) {
      setModalError('Category name is required.');
      return;
    }

    const cleanName = editingCategory.name.trim();
    // Check for duplicate name (case insensitive), excluding self
    const duplicate = categories.find(
      c => c.name.toLowerCase() === cleanName.toLowerCase() && c.id !== editingCategory.id
    );
    if (duplicate) {
      setModalError(`A category named "${cleanName}" already exists.`);
      return;
    }

    const autoCode = editingCategory.code?.trim().toUpperCase() || 
      cleanName.substring(0, 6).toUpperCase().replace(/[^A-Z0-9]/g, '');

    const categoryToSave: Category = {
      id: editingCategory.id || `cat_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      name: cleanName,
      code: autoCode,
      description: editingCategory.description?.trim() || '',
      color: editingCategory.color || CATEGORY_COLOR_PALETTES[0].class,
      icon: editingCategory.icon || 'Tag',
      status: editingCategory.status || 'ACTIVE',
      display_order: Number(editingCategory.display_order) || 1,
      created_at: editingCategory.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    onSaveCategory(categoryToSave);
    setIsModalOpen(false);
    setEditingCategory(null);
  };

  const handleOpenDelete = (category: Category) => {
    const assignedCount = productCountMap.get(category.name.trim().toLowerCase()) || 0;
    setDeleteTarget(category);
    setAdminPasswordInput('');
    setDeletePasswordError(null);
    // Find a fallback category that is not the one being deleted
    const otherCategories = categories.filter(c => c.id !== category.id && c.status === 'ACTIVE');
    setReassignCategoryName(otherCategories[0]?.name || 'General Cosmetics');
  };

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;

    if (adminPasswordInput !== 'Usman@Ali513') {
      setDeletePasswordError('Security Check Failed: Incorrect Admin Password. Please enter Usman@Ali513.');
      return;
    }

    const assignedCount = productCountMap.get(deleteTarget.name.trim().toLowerCase()) || 0;
    const reassignTo = assignedCount > 0 ? reassignCategoryName : undefined;
    onDeleteCategory(deleteTarget.id, reassignTo);
    setDeleteTarget(null);
    setAdminPasswordInput('');
    setDeletePasswordError(null);
  };

  const handleToggleStatus = (category: Category) => {
    const updated: Category = {
      ...category,
      status: category.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
      updated_at: new Date().toISOString(),
    };
    onSaveCategory(updated);
  };

  const handleExportCsv = () => {
    const headers = ['ID', 'Name', 'Code', 'Status', 'Display Order', 'Products Count', 'Description'];
    const rows = categories.map(c => [
      c.id,
      `"${c.name.replace(/"/g, '""')}"`,
      c.code || '',
      c.status,
      c.display_order ?? '',
      productCountMap.get(c.name.trim().toLowerCase()) || 0,
      `"${(c.description || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Categories_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div id="categories-management-container" className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      
      {/* Top Header Card */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-5 sm:p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-rose-50 text-rose-600 rounded-xl border border-rose-100">
              <Tags className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                Product Categories Setup
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Organize, classify, and color-code your cosmetics catalog for quick POS billing and stock sorting.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              id="sync-categories-from-products-btn"
              onClick={() => {
                setIsSyncingFromProducts(true);
                if (onSyncFromProducts) {
                  onSyncFromProducts();
                }
                setTimeout(() => setIsSyncingFromProducts(false), 600);
              }}
              disabled={isSyncingFromProducts}
              className="px-3.5 py-2 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              title="Automatically scan inventory items and add any missing categories to this catalog"
            >
              <Sparkles className={`w-4 h-4 text-indigo-600 ${isSyncingFromProducts ? 'animate-spin' : ''}`} />
              {isSyncingFromProducts ? 'Scanning...' : 'Sync from Inventory'}
            </button>

            <button
              id="reset-categories-catalog-btn"
              onClick={() => setIsResetModalOpen(true)}
              className="px-3.5 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Purge default categories and rebuild strictly from your imported products"
            >
              <RefreshCw className="w-4 h-4 text-rose-600" />
              Rebuild from Products
            </button>

            <button
              id="export-categories-csv-btn"
              onClick={handleExportCsv}
              className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Export all categories to CSV spreadsheet"
            >
              <Download className="w-4 h-4 text-slate-500" />
              Export CSV
            </button>

            <button
              id="add-new-category-btn"
              onClick={handleOpenAdd}
              className="px-4 py-2 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 rounded-lg shadow-xs flex items-center gap-2 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Add Category
            </button>
          </div>
        </div>

        {/* Categories Overload Banner if corrupted 107 categories exist */}
        {totalCategories > 60 && (
          <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-900">
            <div className="flex items-start sm:items-center gap-3">
              <div className="p-2 bg-amber-100 text-amber-800 rounded-lg shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div className="text-xs">
                <p className="font-bold text-sm">Notice: {totalCategories} categories detected</p>
                <p className="text-amber-700 mt-0.5">
                  Unusually high number of categories detected. Click &quot;Reset Standard&quot; to cleanly consolidate and restore standard retail categories.
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsResetModalOpen(true)}
              className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shrink-0 shadow-xs cursor-pointer transition-colors"
            >
              Clean Up Now
            </button>
          </div>
        )}

        {/* Stats Metrics Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 mt-6 pt-5 border-t border-slate-100">
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Categories</div>
            <div className="text-2xl font-bold text-slate-900 mt-1">{totalCategories}</div>
          </div>
          <div className="bg-emerald-50/50 rounded-lg p-3 border border-emerald-100">
            <div className="text-xs font-medium text-emerald-700 uppercase tracking-wider">Active in POS</div>
            <div className="text-2xl font-bold text-emerald-700 mt-1">{activeCategoriesCount}</div>
          </div>
          <div className="bg-rose-50/50 rounded-lg p-3 border border-rose-100">
            <div className="text-xs font-medium text-rose-700 uppercase tracking-wider">Cataloged Items</div>
            <div className="text-2xl font-bold text-rose-700 mt-1">{assignedProductsCount}</div>
          </div>
          <div className="col-span-2 sm:col-span-3 lg:col-span-1 bg-emerald-50/50 rounded-lg p-3 border border-emerald-100 flex flex-col justify-between">
            <div className="text-xs font-medium text-emerald-800 uppercase tracking-wider">Database Sync</div>
            <div className="text-xs font-semibold text-emerald-900 mt-1 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              IndexedDB & MongoDB Atlas Real-Time
            </div>
          </div>
        </div>
      </div>

      {/* Control Bar: Search, Filter, View Toggles */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              id="category-search-input"
              type="text"
              placeholder="Search category name, code, or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white transition-all text-slate-900 placeholder:text-slate-400"
            />
          </div>

          {/* Filters & View Toggles */}
          <div className="flex items-center gap-2">
            <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => setStatusFilter('ALL')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  statusFilter === 'ALL'
                    ? 'bg-white text-slate-900 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All ({categories.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('ACTIVE')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  statusFilter === 'ACTIVE'
                    ? 'bg-white text-emerald-700 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Active
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('INACTIVE')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  statusFilter === 'INACTIVE'
                    ? 'bg-white text-slate-600 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Inactive
              </button>
            </div>

            <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-white text-slate-900 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Grid Card View"
              >
                Grid
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                  viewMode === 'table'
                    ? 'bg-white text-slate-900 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Table View"
              >
                Table
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Categories Display */}
      {filteredCategories.length === 0 ? (
        <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-12 text-center">
          <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-3">
            <Tags className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-slate-900">No categories found</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
            {searchQuery ? 'Try changing your search query or status filter.' : 'Click "Add Category" above to create your first store product category.'}
          </p>
          {searchQuery && (
            <button
              onClick={() => { setSearchQuery(''); setStatusFilter('ALL'); }}
              className="mt-4 px-3 py-1.5 text-xs font-medium text-rose-600 hover:text-rose-700 bg-rose-50 rounded-lg"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredCategories.map((category) => {
            const IconComponent = CATEGORY_ICONS[category.icon || 'Tag'] || Tag;
            const productCount = productCountMap.get(category.name.trim().toLowerCase()) || 0;
            const isActive = category.status === 'ACTIVE';

            return (
              <div 
                key={category.id}
                className={`bg-white rounded-xl border transition-all duration-200 hover:shadow-md flex flex-col justify-between overflow-hidden ${
                  isActive ? 'border-slate-200 hover:border-slate-300' : 'border-slate-200 opacity-60 bg-slate-50/50'
                }`}
              >
                <div className="p-5">
                  {/* Category Card Header */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className={`p-2.5 rounded-lg border flex items-center justify-center ${category.color || 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                      <IconComponent className="w-5 h-5" />
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(category)}
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border cursor-pointer transition-colors ${
                          isActive 
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                            : 'bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-200'
                        }`}
                        title="Click to toggle active status"
                      >
                        {isActive ? 'Active' : 'Inactive'}
                      </button>
                    </div>
                  </div>

                  {/* Category Name & Code */}
                  <div>
                    <h3 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
                      <span>{category.name}</span>
                      {category.code && (
                        <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">
                          {category.code}
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2 min-h-[32px]">
                      {category.description || 'No description provided.'}
                    </p>
                  </div>

                  {/* Linked Products Count */}
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs text-slate-500 font-medium">Assigned Products</span>
                    <button
                      type="button"
                      onClick={() => onNavigateToProductsWithCategory && onNavigateToProductsWithCategory(category.name)}
                      className="text-xs font-bold text-slate-800 bg-slate-100 hover:bg-rose-50 hover:text-rose-700 px-2.5 py-1 rounded-md transition-colors flex items-center gap-1 cursor-pointer"
                      title="View products in inventory"
                    >
                      <span>{productCount} {productCount === 1 ? 'item' : 'items'}</span>
                      <ArrowRight className="w-3 h-3 text-slate-400" />
                    </button>
                  </div>
                </div>

                {/* Card Footer Actions */}
                <div className="bg-slate-50/80 px-4 py-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span className="text-[11px] font-medium text-slate-400">Order: #{category.display_order ?? 1}</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(category)}
                      className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 rounded-md transition-colors cursor-pointer"
                      title="Edit Category"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenDelete(category)}
                      className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-100/70 rounded-md transition-colors cursor-pointer"
                      title="Delete Category"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Order</th>
                  <th className="py-3 px-4">Category Name</th>
                  <th className="py-3 px-4">Code</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4 text-center">Products</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCategories.map((category) => {
                  const IconComponent = CATEGORY_ICONS[category.icon || 'Tag'] || Tag;
                  const productCount = productCountMap.get(category.name.trim().toLowerCase()) || 0;
                  const isActive = category.status === 'ACTIVE';

                  return (
                    <tr key={category.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4 font-mono text-xs text-slate-400 font-medium">
                        #{category.display_order ?? 1}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-900">
                        <div className="flex items-center gap-2.5">
                          <div className={`p-1.5 rounded-md border ${category.color || 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                            <IconComponent className="w-4 h-4" />
                          </div>
                          <span className="font-semibold">{category.name}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-xs text-slate-600">
                        {category.code || '—'}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-500 max-w-xs truncate">
                        {category.description || '—'}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => onNavigateToProductsWithCategory && onNavigateToProductsWithCategory(category.name)}
                          className="inline-flex items-center gap-1 font-semibold text-xs px-2.5 py-1 bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-700 rounded-md transition-colors"
                        >
                          {productCount}
                        </button>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(category)}
                          className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border cursor-pointer ${
                            isActive
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-slate-100 text-slate-600 border-slate-300'
                          }`}
                        >
                          {isActive ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(category)}
                            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                            title="Edit"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenDelete(category)}
                            className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit Category Modal */}
      {isModalOpen && editingCategory && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-rose-100 text-rose-700 rounded-lg">
                  <Tags className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    {editingCategory.id ? 'Edit Category' : 'Create New Category'}
                  </h3>
                  <p className="text-xs text-slate-500">Define classification name, code, color, and display badge.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200/50"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveModal} className="p-6 space-y-4">
              {modalError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-lg flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}

              {/* Category Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Category Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Matte Lipsticks, Hydrating Serums, Eye Liners"
                  value={editingCategory.name || ''}
                  onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500 text-slate-900 font-medium placeholder:text-slate-400"
                />
              </div>

              {/* Category Code & Order */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Short Code / SKU Tag
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. LIP-MAT"
                    value={editingCategory.code || ''}
                    onChange={(e) => setEditingCategory({ ...editingCategory, code: e.target.value.toUpperCase() })}
                    className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 uppercase font-mono text-slate-900"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Used for barcode prefixes</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Display Order (POS Sort)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="999"
                    value={editingCategory.display_order ?? 1}
                    onChange={(e) => setEditingCategory({ ...editingCategory, display_order: parseInt(e.target.value) || 1 })}
                    className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 font-mono text-slate-900"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Lower numbers appear first</span>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Description / Classification Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="Optional details on which beauty products belong here..."
                  value={editingCategory.description || ''}
                  onChange={(e) => setEditingCategory({ ...editingCategory, description: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 text-slate-900 placeholder:text-slate-400"
                />
              </div>

              {/* Color Theme Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Color Badge Theme
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {CATEGORY_COLOR_PALETTES.map((pal) => {
                    const isSelected = editingCategory.color === pal.class;
                    return (
                      <button
                        key={pal.id}
                        type="button"
                        onClick={() => setEditingCategory({ ...editingCategory, color: pal.class })}
                        className={`px-2 py-1.5 rounded-lg border text-xs font-semibold text-center transition-all cursor-pointer ${pal.class} ${
                          isSelected ? 'ring-2 ring-slate-900 ring-offset-1 font-bold' : 'opacity-80'
                        }`}
                      >
                        {pal.label.split(' ')[0]}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Icon Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Category Icon
                </label>
                <div className="grid grid-cols-6 gap-2">
                  {Object.keys(CATEGORY_ICONS).map((iconKey) => {
                    const IconComp = CATEGORY_ICONS[iconKey];
                    const isSelected = (editingCategory.icon || 'Tag') === iconKey;
                    return (
                      <button
                        key={iconKey}
                        type="button"
                        onClick={() => setEditingCategory({ ...editingCategory, icon: iconKey })}
                        className={`p-2.5 rounded-lg border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                          isSelected 
                            ? 'bg-rose-50 border-rose-500 text-rose-700 ring-2 ring-rose-500 ring-offset-1'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                        title={iconKey}
                      >
                        <IconComp className="w-4 h-4" />
                        <span className="text-[9px] truncate w-full text-center">{iconKey}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Status Radio */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  POS & Inventory Status
                </label>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700 font-medium">
                    <input
                      type="radio"
                      name="cat_status"
                      checked={editingCategory.status === 'ACTIVE'}
                      onChange={() => setEditingCategory({ ...editingCategory, status: 'ACTIVE' })}
                      className="text-rose-600 focus:ring-rose-500"
                    />
                    Active (Shown in POS & Filters)
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700 font-medium">
                    <input
                      type="radio"
                      name="cat_status"
                      checked={editingCategory.status === 'INACTIVE'}
                      onChange={() => setEditingCategory({ ...editingCategory, status: 'INACTIVE' })}
                      className="text-slate-600 focus:ring-slate-500"
                    />
                    Inactive (Hidden)
                  </label>
                </div>
              </div>

              {/* Live Preview Pill */}
              <div className="pt-3 border-t border-slate-100">
                <div className="text-[11px] font-medium text-slate-400 mb-1.5">Live Preview (How it looks on POS buttons):</div>
                <div className="flex items-center gap-2">
                  <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold ${editingCategory.color || 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                    {React.createElement(CATEGORY_ICONS[editingCategory.icon || 'Tag'] || Tag, { className: 'w-4 h-4' })}
                    <span>{editingCategory.name || 'Category Name'}</span>
                  </div>
                  {editingCategory.code && (
                    <span className="font-mono text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded border border-slate-200">
                      Code: {editingCategory.code}
                    </span>
                  )}
                </div>
              </div>

              {/* Modal Buttons */}
              <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 rounded-lg shadow-xs transition-colors cursor-pointer"
                >
                  {editingCategory.id ? 'Save Changes' : 'Create Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation & Product Reassignment Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3">
              <div className="p-3 bg-rose-50 text-rose-600 rounded-full shrink-0">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Delete Category</h3>
                <p className="text-sm text-slate-600 mt-1">
                  Are you sure you want to delete <span className="font-bold text-slate-900">"{deleteTarget.name}"</span>?
                </p>
              </div>
            </div>

            {/* If products are assigned to this category */}
            {(() => {
              const assignedCount = productCountMap.get(deleteTarget.name.trim().toLowerCase()) || 0;
              if (assignedCount > 0) {
                const otherOptions = categories.filter(c => c.id !== deleteTarget.id);
                return (
                  <div className="mt-4 p-4 bg-amber-50 rounded-xl border border-amber-200 space-y-2.5">
                    <div className="text-xs font-semibold text-amber-900 flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
                      <span>{assignedCount} {assignedCount === 1 ? 'product is' : 'products are'} currently assigned to this category!</span>
                    </div>
                    <p className="text-xs text-amber-800">
                      To prevent inventory from losing its category, please choose which category to move them into:
                    </p>
                    <select
                      value={reassignCategoryName}
                      onChange={(e) => setReassignCategoryName(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-white border border-amber-300 rounded-lg text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-amber-500"
                    >
                      {otherOptions.map(c => (
                        <option key={c.id} value={c.name}>{c.name}</option>
                      ))}
                      <option value="General Cosmetics">General Cosmetics</option>
                    </select>
                  </div>
                );
              }
              return (
                <p className="text-xs text-slate-500 mt-3">
                  This category currently has no products assigned to it and can be safely deleted.
                </p>
              );
            })()}

            <div className="mt-4 pt-3 border-t border-slate-200">
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Enter Admin Security Password <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                required
                autoFocus
                value={adminPasswordInput}
                onChange={(e) => {
                  setAdminPasswordInput(e.target.value);
                  setDeletePasswordError(null);
                }}
                placeholder="Enter admin security password"
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono tracking-widest text-slate-900 focus:bg-white focus:ring-2 focus:ring-rose-500 outline-hidden"
              />
              {deletePasswordError && (
                <p className="text-xs text-red-600 font-bold mt-1.5">
                  {deletePasswordError}
                </p>
              )}
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors cursor-pointer"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clean Up Product Names & Restore Real Categories Modal */}
      {isResetModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 animate-in fade-in zoom-in duration-150">
            <div className="flex items-start gap-3.5">
              <div className="p-3 bg-rose-50 text-rose-600 rounded-xl border border-rose-100 shrink-0">
                <RefreshCw className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">
                  Rebuild Categories from Products
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Purge hardcoded defaults and rebuild your category catalog strictly from your imported products.
                </p>
              </div>
            </div>

            <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-2 text-slate-700">
              <p className="font-bold text-slate-900">What this action does:</p>
              <ul className="list-disc list-inside space-y-1 text-slate-600">
                <li>Purges default categories that do not belong to any of your products.</li>
                <li>Scans all <strong>{products.length}</strong> products in your catalog / imported files.</li>
                <li>Extracts every unique category and assigns clean color badges and code tags.</li>
                <li>Syncs the updated categories directly to <strong>MongoDB Atlas</strong> and your offline vault.</li>
              </ul>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={isResetting}
                onClick={() => setIsResetModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isResetting}
                onClick={async () => {
                  setIsResetting(true);
                  try {
                    if (onResetCategories) {
                      onResetCategories();
                    } else {
                      // Fallback directly via StorageService
                      const { StorageService } = await import('../services/storage');
                      StorageService.resetToRealCategories();
                      window.location.reload();
                    }
                    setIsResetModalOpen(false);
                  } catch (e) {
                    console.error('Category reset error:', e);
                  } finally {
                    setIsResetting(false);
                  }
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 rounded-lg shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              >
                {isResetting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Cleaning &amp; Reassigning...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Yes, Clean Up &amp; Restore Real Categories
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

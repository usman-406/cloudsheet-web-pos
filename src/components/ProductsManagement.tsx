import React, { useState, useRef, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { StorageService } from '../services/storage';
import { 
  Package, 
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
  Barcode, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Image as ImageIcon,
  AlertTriangle,
  FileSpreadsheet,
  Download,
  Upload,
  Sparkles,
  Tags,
  FileDown,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { Product, ShopSettings, Category } from '../types';
import { BarcodeModal } from './BarcodeModal';
import { ProductEditModal } from './ProductEditModal';

interface ProductsManagementProps {
  products: Product[];
  categoriesList?: Category[];
  settings: ShopSettings;
  onSaveProduct: (product: Product) => void;
  onBulkImportProducts?: (products: Product[]) => void;
  onDeleteProduct: (id: string) => void;
  onDeleteMultipleProducts?: (ids: string[]) => void;
  onStockAdjust: (productId: string, type: 'IN' | 'OUT', qty: number, note: string) => void;
  onNavigateToCategories?: () => void;
  onQuickAddCategory?: (categoryName: string) => void;
}

export const ProductsManagement: React.FC<ProductsManagementProps> = ({
  products,
  categoriesList = [],
  settings,
  onSaveProduct,
  onBulkImportProducts,
  onDeleteProduct,
  onDeleteMultipleProducts,
  onStockAdjust,
  onNavigateToCategories,
  onQuickAddCategory,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);

  // Multi-Selection State
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [productToDeleteSingle, setProductToDeleteSingle] = useState<Product | null>(null);
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [deletePasswordError, setDeletePasswordError] = useState<string | null>(null);

  // Modals
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);
  
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [stockProduct, setStockProduct] = useState<Product | null>(null);
  const [stockChangeType, setStockChangeType] = useState<'IN' | 'OUT'>('IN');
  const [stockChangeQty, setStockChangeQty] = useState<number>(10);
  const [stockChangeNote, setStockChangeNote] = useState<string>('Stock Restock Shipment');

  const [barcodePrintProduct, setBarcodePrintProduct] = useState<Product | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Derive categories from both configured categoriesList and products (memoized)
  const categories = useMemo(() => {
    const configuredCategoryNames = categoriesList
      .filter(c => c.status === 'ACTIVE')
      .sort((a, b) => (a.display_order ?? 99) - (b.display_order ?? 99))
      .map(c => c.name);

    return Array.from(
      new Set(['All', ...configuredCategoryNames, ...products.map(p => p.category).filter(Boolean)])
    );
  }, [categoriesList, products]);

  // Memoize search and filter
  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return products.filter(p => {
      const matchesSearch = !q ||
        p.name.toLowerCase().includes(q) ||
        p.barcode.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        (p.shade_code && p.shade_code.toLowerCase().includes(q));
      const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
      const matchesLowStock = !showLowStockOnly || (p.stock_qty <= (p.min_stock_alert || 5));
      return matchesSearch && matchesCategory && matchesLowStock;
    });
  }, [products, searchQuery, selectedCategory, showLowStockOnly]);

  // Pagination state for ultra-fast table rendering
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(25);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCategory, showLowStockOnly]);

  const totalPages = pageSize === 0 ? 1 : Math.max(1, Math.ceil(filteredProducts.length / pageSize));
  const paginatedProducts = useMemo(() => {
    if (pageSize === 0) return filteredProducts;
    const start = (currentPage - 1) * pageSize;
    return filteredProducts.slice(start, start + pageSize);
  }, [filteredProducts, currentPage, pageSize]);

  const handleOpenAdd = () => {
    const autoBarcode = `8901${Math.floor(100000000 + Math.random() * 900000000)}`;
    setEditingProduct({
      id: `prod_${Date.now()}`,
      barcode: autoBarcode,
      name: '',
      category: categories.find(c => c.toLowerCase() !== 'all') || 'General',
      buy_price: 1500,
      sell_price: 2200,
      stock_qty: 20,
      min_stock_alert: 5,
      image_url: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=300',
      expiry_date: '',
      shade_code: '',
      volume_ml: ''
    });
    setIsEditModalOpen(true);
  };

  const handleOpenEdit = (p: Product) => {
    setEditingProduct({ ...p });
    setIsEditModalOpen(true);
  };

  const handleSaveProductFromModal = (savedProduct: Product) => {
    // Price History Audit Log Generation
    const existing = products.find(p => p.id === savedProduct.id);
    let history = existing?.price_history || [];

    if (existing && (existing.sell_price !== savedProduct.sell_price || existing.buy_price !== savedProduct.buy_price)) {
      const log = {
        id: `ph_${Date.now()}`,
        timestamp: new Date().toISOString(),
        old_buy_price: existing.buy_price,
        new_buy_price: savedProduct.buy_price || existing.buy_price,
        old_sell_price: existing.sell_price,
        new_sell_price: savedProduct.sell_price || existing.sell_price,
        user: 'Store Admin',
        reason: 'Price Revision via Products Catalog',
      };
      history = [log, ...history];
    }

    const updatedProduct: Product = {
      ...savedProduct,
      price_history: history,
    };

    onSaveProduct(updatedProduct);
    setIsEditModalOpen(false);
    setEditingProduct(null);
  };

  const handleStockAdjustSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!stockProduct || stockChangeQty <= 0) return;

    onStockAdjust(stockProduct.id, stockChangeType, stockChangeQty, stockChangeNote);
    setIsStockModalOpen(false);
    setStockProduct(null);
  };

  const escapeCsv = (val: any) => {
    if (val === null || val === undefined) return '""';
    const s = String(val).replace(/"/g, '""');
    return `"${s}"`;
  };

  // Export Complete Products Excel (.xlsx) with all columns & full image URL
  const handleExportExcel = () => {
    if (filteredProducts.length === 0) {
      alert('No products to export based on current filters.');
      return;
    }

    const dataToExport = filteredProducts.map((p) => ({
      'Barcode / SKU': String(p.barcode || ''),
      'Product Name': p.name || '',
      'Category': p.category || '',
      'Brand': p.brand || '',
      'Buy Price (Cost)': p.buy_price ?? 0,
      'Sell Price (Retail)': p.sell_price ?? 0,
      'Stock Quantity': p.stock_qty ?? 0,
      'Min Stock Alert': p.min_stock_alert ?? 5,
      'Max Stock Level': p.max_stock_level !== undefined && p.max_stock_level !== null ? p.max_stock_level : '',
      'Image URL': p.image_url || '',
      'Expiry Date': p.expiry_date || '',
      'Shade / Color Code': p.shade_code || '',
      'Volume / Size': p.volume_ml || '',
      'Shelf Location': p.shelf_location || '',
      'Custom Tax Rate (%)': p.tax_rate !== undefined && p.tax_rate !== null ? p.tax_rate : '',
      'Is Tax Exempt': p.is_tax_exempt ? 'TRUE' : 'FALSE',
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);

    // Apply structured column widths so Barcodes, URLs and descriptions are clean & text formatted
    worksheet['!cols'] = [
      { wch: 20 }, // Barcode / SKU
      { wch: 35 }, // Product Name
      { wch: 22 }, // Category
      { wch: 20 }, // Brand
      { wch: 16 }, // Buy Price (Cost)
      { wch: 16 }, // Sell Price (Retail)
      { wch: 14 }, // Stock Quantity
      { wch: 15 }, // Min Stock Alert
      { wch: 15 }, // Max Stock Level
      { wch: 60 }, // Image URL
      { wch: 14 }, // Expiry Date
      { wch: 18 }, // Shade / Color Code
      { wch: 14 }, // Volume / Size
      { wch: 22 }, // Shelf Location
      { wch: 18 }, // Custom Tax Rate (%)
      { wch: 14 }, // Is Tax Exempt
    ];

    // Explicitly enforce string formatting ('s') on Barcode / SKU column so Excel does not convert to scientific notation
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:P1');
    for (let R = range.s.r + 1; R <= range.e.r; ++R) {
      const barcodeCell = XLSX.utils.encode_cell({ r: R, c: 0 }); // Column 0 is Barcode / SKU
      if (worksheet[barcodeCell]) {
        worksheet[barcodeCell].t = 's';
        worksheet[barcodeCell].z = '@';
      }
    }

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Products Catalog');
    const dateStr = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(workbook, `BloomCarry_Products_Full_Export_${dateStr}.xlsx`);
  };

  // Export Complete Products CSV with full details & UTF-8 BOM
  const handleExportCSV = () => {
    if (filteredProducts.length === 0) {
      alert('No products to export based on current filters.');
      return;
    }

    const headers = [
      'Barcode / SKU',
      'Product Name',
      'Category',
      'Brand',
      'Buy Price (Cost)',
      'Sell Price (Retail)',
      'Stock Quantity',
      'Min Stock Alert',
      'Max Stock Level',
      'Image URL',
      'Expiry Date',
      'Shade / Color Code',
      'Volume / Size',
      'Shelf Location',
      'Custom Tax Rate (%)',
      'Is Tax Exempt'
    ];

    const rows = filteredProducts.map(p => [
      escapeCsv(String(p.barcode || '')),
      escapeCsv(p.name || ''),
      escapeCsv(p.category || ''),
      escapeCsv(p.brand || ''),
      p.buy_price ?? 0,
      p.sell_price ?? 0,
      p.stock_qty ?? 0,
      p.min_stock_alert ?? 5,
      p.max_stock_level !== undefined && p.max_stock_level !== null ? p.max_stock_level : '',
      escapeCsv(p.image_url || ''),
      escapeCsv(p.expiry_date || ''),
      escapeCsv(p.shade_code || ''),
      escapeCsv(p.volume_ml || ''),
      escapeCsv(p.shelf_location || ''),
      p.tax_rate !== undefined && p.tax_rate !== null ? p.tax_rate : '',
      p.is_tax_exempt ? 'TRUE' : 'FALSE'
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `BloomCarry_Products_Full_Export_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Export Sample Excel Template (.xlsx)
  const handleDownloadExcelTemplate = () => {
    const sampleRows = [
      {
        'Barcode / SKU': '890199887701',
        'Product Name': 'Maybelline Fit Me Matte Foundation',
        'Category': 'Foundations & Powders',
        'Brand': 'Maybelline New York',
        'Buy Price (Cost)': 1800,
        'Sell Price (Retail)': 2450,
        'Stock Quantity': 30,
        'Min Stock Alert': 5,
        'Max Stock Level': 100,
        'Image URL': 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=500',
        'Expiry Date': '2028-12-31',
        'Shade / Color Code': '120 Classic Ivory',
        'Volume / Size': '30ml',
        'Shelf Location': 'Aisle 2 - Shelf B',
        'Custom Tax Rate (%)': 17,
        'Is Tax Exempt': 'FALSE'
      },
      {
        'Barcode / SKU': '890199887702',
        'Product Name': 'MAC Retro Matte Lipstick',
        'Category': 'Lipstick & Lip Care',
        'Brand': 'M.A.C Cosmetics',
        'Buy Price (Cost)': 3200,
        'Sell Price (Retail)': 4200,
        'Stock Quantity': 25,
        'Min Stock Alert': 5,
        'Max Stock Level': 80,
        'Image URL': 'https://images.unsplash.com/photo-1586495777744-4413f21062fa?w=500',
        'Expiry Date': '2028-06-30',
        'Shade / Color Code': 'Ruby Woo',
        'Volume / Size': '3g',
        'Shelf Location': 'Aisle 1 - Display Case',
        'Custom Tax Rate (%)': 0,
        'Is Tax Exempt': 'TRUE'
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(sampleRows);
    worksheet['!cols'] = [
      { wch: 20 }, { wch: 35 }, { wch: 22 }, { wch: 20 },
      { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 15 }, { wch: 15 },
      { wch: 60 }, { wch: 14 }, { wch: 18 }, { wch: 14 },
      { wch: 22 }, { wch: 18 }, { wch: 14 }
    ];

    // Explicitly enforce string formatting ('s') on Barcode / SKU column
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:P3');
    for (let R = range.s.r + 1; R <= range.e.r; ++R) {
      const barcodeCell = XLSX.utils.encode_cell({ r: R, c: 0 });
      if (worksheet[barcodeCell]) {
        worksheet[barcodeCell].t = 's';
        worksheet[barcodeCell].z = '@';
      }
    }

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Import Template');
    XLSX.writeFile(workbook, 'BloomCarry_Products_Import_Template.xlsx');
  };

  // Export Sample CSV Template
  const handleDownloadCSVTemplate = () => {
    const headers = [
      'Barcode / SKU',
      'Product Name',
      'Category',
      'Brand',
      'Buy Price (Cost)',
      'Sell Price (Retail)',
      'Stock Quantity',
      'Min Stock Alert',
      'Max Stock Level',
      'Image URL',
      'Expiry Date',
      'Shade / Color Code',
      'Volume / Size',
      'Shelf Location',
      'Custom Tax Rate (%)',
      'Is Tax Exempt'
    ];
    const sampleRows = [
      ['890199887701', 'Maybelline Fit Me Matte Foundation', 'Foundations & Powders', 'Maybelline New York', '1800', '2450', '30', '5', '100', 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=500', '2028-12-31', '120 Classic Ivory', '30ml', 'Aisle 2 - Shelf B', '17', 'FALSE'],
      ['890199887702', 'MAC Retro Matte Lipstick', 'Lipstick & Lip Care', 'M.A.C Cosmetics', '3200', '4200', '25', '5', '80', 'https://images.unsplash.com/photo-1586495777744-4413f21062fa?w=500', '2028-06-30', 'Ruby Woo', '3g', 'Aisle 1 - Display Case', '0', 'TRUE']
    ];

    const csvContent = '\uFEFF' + [headers.join(','), ...sampleRows.map(r => r.map(c => `"${c}"`).join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'BloomCarry_Products_Import_Template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Import Products from Excel (.xlsx, .xls), CSV (.csv), or JSON (.json)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileNameLower = file.name.toLowerCase();

    // 1. JSON Parser
    if (fileNameLower.endsWith('.json')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const text = event.target?.result as string;
          const parsed = JSON.parse(text);
          if (Array.isArray(parsed)) {
            const rawItems: Partial<Product>[] = parsed.map((item: any) => ({
              id: item.id,
              barcode: item.barcode || item.Barcode,
              name: item.name || item.Name,
              category: item.category || item.Category,
              brand: item.brand || item.Brand,
              buy_price: item.buy_price || item.BuyPrice,
              sell_price: item.sell_price || item.SellPrice,
              stock_qty: item.stock_qty || item.StockQty,
              min_stock_alert: item.min_stock_alert || item.MinStockAlert,
              max_stock_level: item.max_stock_level,
              image_url: item.image_url || item.ImageURL || item.ImageUrl || item.URL,
              expiry_date: item.expiry_date || item.ExpiryDate,
              shade_code: item.shade_code || item.ShadeCode,
              volume_ml: item.volume_ml || item.VolumeML,
              shelf_location: item.shelf_location || item.ShelfLocation,
              tax_rate: item.tax_rate,
              is_tax_exempt: Boolean(item.is_tax_exempt || item.IsTaxExempt === 'TRUE' || item.IsTaxExempt === true),
              supplier_lead_time_days: item.supplier_lead_time_days
            })).filter(i => i.name && (i.barcode || i.id));

            const res = StorageService.upsertProductsByBarcode(rawItems, 'JSON Catalog Import');
            if (onBulkImportProducts) onBulkImportProducts(res.allProducts);
            alert(`🎉 Success! Import Complete:\n\n• ${res.updatedCount} existing products updated by unique barcode\n• ${res.addedCount} new products added to catalog\n• Total catalog items: ${res.allProducts.length}`);
          }
        } catch (err: any) {
          alert('Failed to parse JSON file: ' + err.message);
        }
      };
      reader.readAsText(file);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // 2. Excel (.xlsx, .xls) and CSV (.csv) via XLSX Engine
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const buffer = event.target?.result as ArrayBuffer;
        const workbook = XLSX.read(buffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) {
          alert('Uploaded file contains no readable worksheets.');
          return;
        }

        const worksheet = workbook.Sheets[firstSheetName];
        const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet, { raw: false, defval: '' });

        if (rawRows.length === 0) {
          alert('No data rows found in the uploaded file.');
          return;
        }

        // Helper to find column value by normalized key matching
        const findVal = (row: any, ...aliases: string[]): string => {
          const rowKeys = Object.keys(row);
          for (const alias of aliases) {
            const normAlias = alias.toLowerCase().replace(/[\s_\-\/\(\)%]/g, '');
            for (const key of rowKeys) {
              const normKey = key.toLowerCase().replace(/[\s_\-\/\(\)%]/g, '');
              if (normKey === normAlias || normKey.includes(normAlias) || normAlias.includes(normKey)) {
                const val = row[key];
                if (val !== undefined && val !== null) {
                  return String(val).trim();
                }
              }
            }
          }
          return '';
        };

        const importedProducts: Partial<Product>[] = [];

        rawRows.forEach((row) => {
          const barcode = findVal(row, 'barcode / sku', 'barcodesku', 'barcode', 'sku', 'code');
          const name = findVal(row, 'product name', 'productname', 'name', 'title', 'itemname', 'product');
          if (!name) return;

          const category = findVal(row, 'category', 'cat', 'productcategory') || 'General';
          const brand = findVal(row, 'brand', 'company', 'manufacturer');
          const buyPriceRaw = findVal(row, 'buy price (cost)', 'buypricecost', 'buyprice', 'costprice', 'cost', 'buy');
          const buyPrice = buyPriceRaw !== '' ? Number(buyPriceRaw) : 1000;
          const sellPriceRaw = findVal(row, 'sell price (retail)', 'sellpriceretail', 'sellprice', 'saleprice', 'retailprice', 'price', 'sell');
          const sellPrice = sellPriceRaw !== '' ? Number(sellPriceRaw) : 1500;
          const stockQtyRaw = findVal(row, 'stock quantity', 'stockquantity', 'stockqty', 'stock', 'qty', 'quantity');
          const stockQty = stockQtyRaw !== '' ? Number(stockQtyRaw) : 0;
          const minStockAlertRaw = findVal(row, 'min stock alert', 'minstockalert', 'minstock', 'minalert');
          const minStockAlert = minStockAlertRaw !== '' ? Number(minStockAlertRaw) : 5;
          const maxStockRaw = findVal(row, 'max stock level', 'maxstocklevel', 'maxstock');
          const maxStockLevel = maxStockRaw !== '' ? Number(maxStockRaw) : undefined;
          const imageUrl = findVal(row, 'image url', 'imageurl', 'image', 'photo', 'url', 'photourl', 'img') || 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=500';
          const expiryDate = findVal(row, 'expiry date', 'expirydate', 'expiry', 'expdate', 'exp');
          const shadeCode = findVal(row, 'shade / color code', 'shadecolorcode', 'shadecode', 'shade', 'color');
          const volumeMl = findVal(row, 'volume / size', 'volumesize', 'volumeml', 'volume', 'size', 'ml');
          const shelfLocation = findVal(row, 'shelf location', 'shelflocation', 'shelf', 'location', 'rack');
          const taxRateRaw = findVal(row, 'custom tax rate (%)', 'customtaxrate', 'taxrate', 'tax');
          const taxRate = taxRateRaw !== '' && !isNaN(Number(taxRateRaw)) ? Number(taxRateRaw) : undefined;
          const taxExemptRaw = findVal(row, 'is tax exempt', 'istaxexempt', 'taxexempt', 'exempt').toUpperCase();
          const isTaxExempt = taxExemptRaw === 'TRUE' || taxExemptRaw === 'YES' || taxExemptRaw === '1';

          importedProducts.push({
            id: findVal(row, 'productid', 'id') || undefined,
            barcode: barcode || undefined,
            name,
            category,
            brand,
            buy_price: isNaN(buyPrice) ? 1000 : buyPrice,
            sell_price: isNaN(sellPrice) ? 1500 : sellPrice,
            stock_qty: isNaN(stockQty) ? 0 : stockQty,
            min_stock_alert: isNaN(minStockAlert) ? 5 : minStockAlert,
            max_stock_level: maxStockLevel,
            image_url: imageUrl,
            expiry_date: expiryDate,
            shade_code: shadeCode,
            volume_ml: volumeMl,
            shelf_location: shelfLocation,
            tax_rate: taxRate,
            is_tax_exempt: isTaxExempt
          });
        });

        if (importedProducts.length > 0) {
          const res = StorageService.upsertProductsByBarcode(importedProducts, `File Import (${file.name})`);
          if (onBulkImportProducts) {
            onBulkImportProducts(res.allProducts);
          }
          const catMsg = res.categoriesAdded ? `\n• ${res.categoriesAdded} new categories automatically registered to catalog` : '';
          alert(`🎉 Success! File Processed:\n\n• ${res.updatedCount} existing products updated by unique barcode\n• ${res.addedCount} new products added to inventory${catMsg}\n• Total catalog items now: ${res.allProducts.length}`);
        } else {
          alert('No valid product rows could be parsed. Please verify the template headers.');
        }
      } catch (err: any) {
        console.error('File import error:', err);
        alert('Failed to parse file. Please verify column headers: ' + (err.message || 'Unknown format error'));
      }
    };
    reader.readAsArrayBuffer(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Selection handlers
  const handleToggleSelectAll = () => {
    if (selectedProductIds.length === filteredProducts.length && filteredProducts.length > 0) {
      setSelectedProductIds([]);
    } else {
      setSelectedProductIds(filteredProducts.map(p => p.id));
    }
  };

  const handleToggleSelectProduct = (id: string) => {
    setSelectedProductIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // Bulk Delete Submission with Admin Password Check ("Usman@Ali513")
  const handleConfirmBulkDelete = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPasswordInput !== 'Usman@Ali513') {
      setDeletePasswordError('Security Check Failed: Incorrect Admin Password. Please enter Usman@Ali513.');
      return;
    }

    if (onDeleteMultipleProducts) {
      onDeleteMultipleProducts(selectedProductIds);
    } else {
      selectedProductIds.forEach(id => onDeleteProduct(id));
    }

    setSelectedProductIds([]);
    setIsBulkDeleteModalOpen(false);
    setAdminPasswordInput('');
    setDeletePasswordError(null);
  };

  // Single Product Delete with Admin Password Check
  const handleConfirmSingleDelete = (e: React.FormEvent) => {
    e.preventDefault();
    if (!productToDeleteSingle) return;

    if (adminPasswordInput !== 'Usman@Ali513') {
      setDeletePasswordError('Security Check Failed: Incorrect Admin Password. Please enter Usman@Ali513.');
      return;
    }

    onDeleteProduct(productToDeleteSingle.id);
    setProductToDeleteSingle(null);
    setAdminPasswordInput('');
    setDeletePasswordError(null);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">
      
      {/* Hidden File Input for Excel/CSV/JSON Import */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept=".xlsx, .xls, .csv, .json"
        className="hidden"
      />

      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-lg border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center space-x-2">
            <Sparkles className="w-5 h-5 text-[#0f6cbd]" />
            <h2 className="text-xl font-bold text-slate-800">BoomandCarry Cosmetic Inventory</h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">Manage makeup shades, sizes, stock levels, barcodes & prices</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Templates Dropdown/Buttons */}
          <div className="flex items-center rounded-md border border-slate-200 bg-slate-50 p-0.5">
            <button
              onClick={handleDownloadExcelTemplate}
              className="px-2.5 py-1.5 hover:bg-white text-slate-700 font-bold rounded text-xs flex items-center space-x-1 transition cursor-pointer"
              title="Download Excel (.xlsx) Import Template"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden sm:inline">Excel Template</span>
            </button>
            <button
              onClick={handleDownloadCSVTemplate}
              className="px-2 py-1.5 hover:bg-white text-slate-600 font-bold rounded text-xs transition cursor-pointer"
              title="Download CSV Import Template"
            >
              CSV
            </button>
          </div>

          {/* Import Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-2 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-300 font-bold rounded-md text-xs flex items-center space-x-1.5 transition cursor-pointer shadow-2xs"
            title="Import products from Excel (.xlsx, .xls) or CSV"
          >
            <Upload className="w-3.5 h-3.5 text-emerald-600" />
            <span>Import Excel / CSV</span>
          </button>

          {/* Export Excel (.xlsx) */}
          <button
            onClick={handleExportExcel}
            className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-md text-xs flex items-center space-x-1.5 transition cursor-pointer shadow-xs"
            title="Export all products with full details and URLs to Excel (.xlsx)"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Export Excel (.xlsx)</span>
          </button>

          {/* Export CSV */}
          <button
            onClick={handleExportCSV}
            className="px-3 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 font-bold rounded-md text-xs flex items-center space-x-1.5 transition cursor-pointer"
            title="Export products to CSV"
          >
            <Download className="w-3.5 h-3.5 text-blue-600" />
            <span>Export CSV</span>
          </button>

          {onNavigateToCategories && (
            <button
              onClick={onNavigateToCategories}
              className="px-3 py-2 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 font-bold rounded-md text-xs flex items-center space-x-1 transition cursor-pointer"
              title="Manage product categories"
            >
              <Tags className="w-3.5 h-3.5 text-rose-600" />
              <span>Categories Setup</span>
            </button>
          )}

          <button
            onClick={handleOpenAdd}
            className="px-4 py-2 bg-[#0f6cbd] hover:bg-[#115ea3] text-white font-bold rounded-md text-xs shadow-xs flex items-center space-x-2 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Cosmetic Item</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search product by name, barcode, category..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:ring-2 focus:ring-[#0b5fa5]"
            />
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 px-3 py-2 rounded-xl focus:ring-2 focus:ring-[#0b5fa5]"
            >
              {categories.map(c => (
                <option key={c} value={c}>Category: {c}</option>
              ))}
            </select>

            <button
              onClick={() => setShowLowStockOnly(!showLowStockOnly)}
              className={`px-3 py-2 rounded-xl text-xs font-bold border transition flex items-center space-x-1 ${
                showLowStockOnly
                  ? 'bg-amber-500 text-white border-amber-600'
                  : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Low Stock ({products.filter(p => p.stock_qty <= (p.min_stock_alert || 5)).length})</span>
            </button>
          </div>

        </div>
      </div>

      {/* Bulk Action Banner */}
      {selectedProductIds.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 px-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs animate-in fade-in duration-200">
          <div className="flex items-center space-x-3">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping"></span>
            <span className="font-bold text-xs text-red-900">
              {selectedProductIds.length} item{selectedProductIds.length > 1 ? 's' : ''} selected
            </span>
            <span className="text-[11px] text-red-600 hidden md:inline">
              (Total Stock Units: {products.filter(p => selectedProductIds.includes(p.id)).reduce((sum, p) => sum + (p.stock_qty || 0), 0)})
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => setSelectedProductIds([])}
              className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 font-bold rounded-lg text-xs transition cursor-pointer"
            >
              Deselect All
            </button>
            <button
              type="button"
              onClick={() => {
                setAdminPasswordInput('');
                setDeletePasswordError(null);
                setIsBulkDeleteModalOpen(true);
              }}
              className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg text-xs shadow-xs flex items-center space-x-1.5 transition cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Selected ({selectedProductIds.length})</span>
            </button>
          </div>
        </div>
      )}

      {/* Products Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="p-3 text-center w-10">
                  <input
                    type="checkbox"
                    checked={filteredProducts.length > 0 && selectedProductIds.length === filteredProducts.length}
                    onChange={handleToggleSelectAll}
                    className="w-4 h-4 rounded text-[#0f6cbd] focus:ring-[#0f6cbd] cursor-pointer"
                    title="Select / Deselect All Products"
                  />
                </th>
                <th className="p-3">Product</th>
                <th className="p-3">Barcode</th>
                <th className="p-3">Category</th>
                <th className="p-3 text-right">Buy Price</th>
                <th className="p-3 text-right">Sell Price</th>
                <th className="p-3 text-center">Stock Qty</th>
                <th className="p-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">
                    No products found matching your filters.
                  </td>
                </tr>
              ) : (
                paginatedProducts.map((product) => {
                  const isLowStock = product.stock_qty <= (product.min_stock_alert || 5);
                  const isSelected = selectedProductIds.includes(product.id);

                  return (
                    <tr 
                      key={product.id} 
                      className={`transition ${isSelected ? 'bg-blue-50/50 hover:bg-blue-50/80' : 'hover:bg-slate-50/80'}`}
                    >
                      {/* Selection Checkbox */}
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelectProduct(product.id)}
                          className="w-4 h-4 rounded text-[#0f6cbd] focus:ring-[#0f6cbd] cursor-pointer"
                        />
                      </td>
                      
                      {/* Name & Cosmetics Details */}
                      <td className="p-3">
                        <div className="flex items-center space-x-3">
                          <img
                            src={product.image_url || 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=100'}
                            alt={product.name}
                            className="w-10 h-10 rounded-lg object-cover bg-slate-100 border border-slate-200"
                            onError={(e) => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=100'; }}
                          />
                          <div>
                            <span className="font-bold text-slate-900 text-xs block line-clamp-1">{product.name}</span>
                            <div className="flex items-center space-x-1 mt-0.5">
                              {product.shade_code && (
                                <span className="bg-pink-50 text-pink-700 text-[10px] font-bold px-1.5 py-0.2 rounded border border-pink-200">
                                  {product.shade_code}
                                </span>
                              )}
                              {product.volume_ml && (
                                <span className="bg-purple-50 text-purple-700 text-[10px] font-bold px-1.5 py-0.2 rounded border border-purple-200">
                                  {product.volume_ml}
                                </span>
                              )}
                              {product.expiry_date && (
                                <span className="text-[10px] text-slate-400">Exp: {product.expiry_date}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Barcode */}
                      <td className="p-3 font-mono font-semibold text-slate-600">
                        {product.barcode}
                      </td>

                      {/* Category */}
                      <td className="p-3">
                        <span className="bg-slate-100 text-slate-700 font-semibold text-[10px] uppercase px-2 py-0.5 rounded-full whitespace-nowrap">
                          {product.category}
                        </span>
                      </td>

                      {/* Buy Price */}
                      <td className="p-3 text-right font-medium text-slate-500">
                        {settings.currency_symbol} {product.buy_price.toLocaleString()}
                      </td>

                      {/* Sell Price & Tax */}
                      <td className="p-3 text-right">
                        <div className="font-extrabold text-[#0b5fa5] text-sm">
                          {settings.currency_symbol} {product.sell_price.toLocaleString()}
                        </div>
                        <div className="mt-0.5">
                          {product.is_tax_exempt ? (
                            <span className="inline-block bg-emerald-50 text-emerald-700 text-[10px] font-extrabold px-1.5 py-0.2 rounded border border-emerald-200">
                              0% Exempt
                            </span>
                          ) : product.tax_rate !== undefined && product.tax_rate !== null ? (
                            <span className="inline-block bg-amber-50 text-amber-800 text-[10px] font-extrabold px-1.5 py-0.2 rounded border border-amber-200">
                              {product.tax_rate}% Tax
                            </span>
                          ) : (
                            <span className="inline-block bg-slate-100 text-slate-600 text-[10px] font-semibold px-1.5 py-0.2 rounded">
                              {settings.tax_rate || 0}% Default
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Stock Qty */}
                      <td className="p-3 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-black inline-flex items-center space-x-1 ${
                          product.stock_qty <= 0 
                            ? 'bg-red-100 text-red-700' 
                            : isLowStock 
                            ? 'bg-amber-100 text-amber-800' 
                            : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          <span>{product.stock_qty}</span>
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center space-x-1">
                          
                          {/* Stock Adjust */}
                          <button
                            onClick={() => {
                              setStockProduct(product);
                              setIsStockModalOpen(true);
                            }}
                            className="p-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg transition"
                            title="Adjust Stock Qty"
                          >
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          </button>

                          {/* Print Barcode */}
                          <button
                            onClick={() => setBarcodePrintProduct(product)}
                            className="p-1.5 bg-blue-50 text-[#0b5fa5] hover:bg-blue-100 rounded-lg transition"
                            title="Print Barcode Labels"
                          >
                            <Barcode className="w-3.5 h-3.5" />
                          </button>

                          {/* Edit */}
                          <button
                            onClick={() => handleOpenEdit(product)}
                            className="p-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg transition"
                            title="Edit Product"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => {
                              setProductToDeleteSingle(product);
                              setAdminPasswordInput('');
                              setDeletePasswordError(null);
                            }}
                            className="p-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition cursor-pointer"
                            title="Delete Product"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>

                        </div>
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {filteredProducts.length > 0 && (
          <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="flex items-center space-x-2 text-slate-500">
              <span>Showing</span>
              <strong className="text-slate-800">
                {pageSize === 0 ? 1 : Math.min(filteredProducts.length, (currentPage - 1) * pageSize + 1)}
              </strong>
              <span>to</span>
              <strong className="text-slate-800">
                {pageSize === 0 ? filteredProducts.length : Math.min(filteredProducts.length, currentPage * pageSize)}
              </strong>
              <span>of</span>
              <strong className="text-slate-800">{filteredProducts.length}</strong>
              <span>products</span>
            </div>

            <div className="flex items-center space-x-3">
              {/* Page size selector */}
              <div className="flex items-center space-x-1 text-slate-500">
                <span>Per page:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="bg-white border border-slate-300 rounded-lg px-2 py-1 font-semibold text-slate-700 text-xs focus:ring-1 focus:ring-[#0b5fa5]"
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={0}>All</option>
                </select>
              </div>

              {/* Navigation buttons */}
              {pageSize > 0 && totalPages > 1 && (
                <div className="flex items-center space-x-1">
                  <button
                    type="button"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage <= 1}
                    className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white text-slate-700 font-semibold cursor-pointer"
                    title="Previous Page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="px-2 py-1 font-bold text-slate-700">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage >= totalPages}
                    className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white text-slate-700 font-semibold cursor-pointer"
                    title="Next Page"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ================= ADD / EDIT PRODUCT MODAL (Decoupled State for 0ms Typing Latency) ================= */}
      <ProductEditModal
        isOpen={isEditModalOpen}
        product={editingProduct}
        categories={categories}
        settings={settings}
        onSave={handleSaveProductFromModal}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingProduct(null);
        }}
        onQuickAddCategory={onQuickAddCategory}
      />

      {/* ================= STOCK ADJUSTMENT MODAL ================= */}
      {isStockModalOpen && stockProduct && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleStockAdjustSubmit} className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100 p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-800 border-b pb-2">Adjust Inventory Stock</h3>
            
            <div className="bg-blue-50 p-3 rounded-xl border border-blue-200 text-xs">
              <span className="font-bold text-slate-800 block">{stockProduct.name}</span>
              <span className="text-slate-500">Current Stock: <strong className="text-slate-900">{stockProduct.stock_qty}</strong></span>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={() => setStockChangeType('IN')}
                  className={`flex-1 py-2 rounded-xl font-bold border transition ${
                    stockChangeType === 'IN'
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-slate-100 text-slate-700 border-slate-200'
                  }`}
                >
                  + Stock In (Add)
                </button>
                <button
                  type="button"
                  onClick={() => setStockChangeType('OUT')}
                  className={`flex-1 py-2 rounded-xl font-bold border transition ${
                    stockChangeType === 'OUT'
                      ? 'bg-red-600 text-white border-red-600'
                      : 'bg-slate-100 text-slate-700 border-slate-200'
                  }`}
                >
                  - Stock Out (Remove)
                </button>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Quantity</label>
                <input
                  type="number"
                  min="1"
                  value={stockChangeQty}
                  onChange={(e) => setStockChangeQty(Number(e.target.value))}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-black text-center text-lg text-slate-800"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Adjustment Reason / Note</label>
                <input
                  type="text"
                  value={stockChangeNote}
                  onChange={(e) => setStockChangeNote(e.target.value)}
                  placeholder="e.g. New supplier shipment, damaged stock..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-700"
                />
              </div>
            </div>

            <div className="flex space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setIsStockModalOpen(false)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-md"
              >
                Update Stock
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Barcode Print Modal */}
      {barcodePrintProduct && (
        <BarcodeModal
          product={barcodePrintProduct}
          settings={settings}
          onClose={() => setBarcodePrintProduct(null)}
        />
      )}

      {/* ================= BULK PRODUCTS DELETION SECURITY MODAL ================= */}
      {isBulkDeleteModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-4">
          <form 
            onSubmit={handleConfirmBulkDelete}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-red-200 animate-in zoom-in-95 duration-200"
          >
            <div className="bg-red-600 px-6 py-4 text-white flex items-center space-x-3">
              <div className="p-2 bg-white/20 rounded-xl">
                <Trash2 className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-base font-bold">Confirm Bulk Deletion</h3>
                <p className="text-xs text-red-100">Permanent Database Action</p>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-800 leading-relaxed">
                You are about to permanently remove <strong className="font-black text-red-950">{selectedProductIds.length}</strong> product{selectedProductIds.length > 1 ? 's' : ''} from the database. 
                This will delete them from local memory, IndexedDB, and synchronize to cloud storage.
              </div>

              <div>
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
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono tracking-widest text-slate-900 focus:bg-white focus:ring-2 focus:ring-red-500 outline-hidden"
                />
                {deletePasswordError && (
                  <p className="text-xs text-red-600 font-bold mt-1.5">
                    {deletePasswordError}
                  </p>
                )}
              </div>

              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsBulkDeleteModalOpen(false);
                    setAdminPasswordInput('');
                    setDeletePasswordError(null);
                  }}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs shadow-md transition cursor-pointer flex items-center justify-center space-x-1.5"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Confirm Delete</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* ================= SINGLE PRODUCT DELETION SECURITY MODAL ================= */}
      {productToDeleteSingle && (
        <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-4">
          <form 
            onSubmit={handleConfirmSingleDelete}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-red-200 animate-in zoom-in-95 duration-200"
          >
            <div className="bg-red-600 px-6 py-4 text-white flex items-center space-x-3">
              <div className="p-2 bg-white/20 rounded-xl">
                <Trash2 className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-base font-bold">Delete Product</h3>
                <p className="text-xs text-red-100">Permanent Database Removal</p>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                <p className="font-bold text-slate-900 text-sm">{productToDeleteSingle.name}</p>
                <p className="font-mono text-slate-500 mt-0.5">Barcode: {productToDeleteSingle.barcode}</p>
                <p className="text-slate-600 mt-1">Current Stock: <strong className="font-bold">{productToDeleteSingle.stock_qty}</strong> units</p>
              </div>

              <div>
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
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono tracking-widest text-slate-900 focus:bg-white focus:ring-2 focus:ring-red-500 outline-hidden"
                />
                {deletePasswordError && (
                  <p className="text-xs text-red-600 font-bold mt-1.5">
                    {deletePasswordError}
                  </p>
                )}
              </div>

              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setProductToDeleteSingle(null);
                    setAdminPasswordInput('');
                    setDeletePasswordError(null);
                  }}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs shadow-md transition cursor-pointer flex items-center justify-center space-x-1.5"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete Product</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

    </div>
  );
};

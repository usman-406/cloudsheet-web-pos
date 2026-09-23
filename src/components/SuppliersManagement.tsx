import React, { useState, useEffect } from 'react';
import { StorageService } from '../services/storage';
import { Supplier, Product } from '../types';
import { 
  Truck, 
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
  Phone, 
  Mail, 
  MapPin, 
  DollarSign, 
  FileSpreadsheet,
  Package,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

export const SuppliersManagement: React.FC = () => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  // Multi-Selection & Admin Security Password Deletion States
  const [selectedSupplierIds, setSelectedSupplierIds] = useState<string[]>([]);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [supplierToDeleteSingle, setSupplierToDeleteSingle] = useState<Supplier | null>(null);
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [deletePasswordError, setDeletePasswordError] = useState<string | null>(null);

  // Payment Modal
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [selectedSupplierForPay, setSelectedSupplierForPay] = useState<Supplier | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);

  // Form State
  const [companyName, setCompanyName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [outstandingBalance, setOutstandingBalance] = useState(0);
  const [notes, setNotes] = useState('');
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    setSuppliers(StorageService.getSuppliers());
    setProducts(StorageService.getProducts());
  };

  const filteredSuppliers = suppliers.filter(s => 
    s.company_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.contact_person.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.phone.includes(searchQuery) ||
    s.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleOpenAdd = () => {
    setEditingSupplier(null);
    setCompanyName('');
    setContactPerson('');
    setPhone('');
    setEmail('');
    setAddress('');
    setOutstandingBalance(0);
    setNotes('');
    setSelectedProductIds([]);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (sup: Supplier) => {
    setEditingSupplier(sup);
    setCompanyName(sup.company_name);
    setContactPerson(sup.contact_person);
    setPhone(sup.phone);
    setEmail(sup.email);
    setAddress(sup.address);
    setOutstandingBalance(sup.outstanding_balance);
    setNotes(sup.notes || '');
    setSelectedProductIds(sup.products_supplied || []);
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) return;

    let updated: Supplier[];
    if (editingSupplier) {
      updated = suppliers.map(s => s.id === editingSupplier.id ? {
        ...s,
        company_name: companyName,
        contact_person: contactPerson,
        phone,
        email,
        address,
        outstanding_balance: Number(outstandingBalance),
        notes,
        products_supplied: selectedProductIds
      } : s);
    } else {
      const newSup: Supplier = {
        id: `supp_${Date.now()}`,
        company_name: companyName,
        contact_person: contactPerson,
        phone,
        email,
        address,
        outstanding_balance: Number(outstandingBalance),
        notes,
        products_supplied: selectedProductIds,
        last_order_date: new Date().toISOString().split('T')[0]
      };
      updated = [newSup, ...suppliers];
    }

    StorageService.saveSuppliers(updated);
    setSuppliers(updated);
    setIsModalOpen(false);
  };

  // Selection handlers
  const handleToggleSelectAll = () => {
    if (selectedSupplierIds.length === filteredSuppliers.length && filteredSuppliers.length > 0) {
      setSelectedSupplierIds([]);
    } else {
      setSelectedSupplierIds(filteredSuppliers.map(s => s.id));
    }
  };

  const handleToggleSelectSupplier = (id: string) => {
    setSelectedSupplierIds(prev =>
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

    const updated = StorageService.deleteMultipleSuppliers(selectedSupplierIds);
    setSuppliers(updated);
    setSelectedSupplierIds([]);
    setIsBulkDeleteModalOpen(false);
    setAdminPasswordInput('');
    setDeletePasswordError(null);
  };

  // Single Supplier Delete Submission
  const handleConfirmSingleDelete = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierToDeleteSingle) return;

    if (adminPasswordInput !== 'Usman@Ali513') {
      setDeletePasswordError('Security Check Failed: Incorrect Admin Password. Please enter Usman@Ali513.');
      return;
    }

    StorageService.deleteSupplier(supplierToDeleteSingle.id);
    setSuppliers(StorageService.getSuppliers());
    setSupplierToDeleteSingle(null);
    setAdminPasswordInput('');
    setDeletePasswordError(null);
  };

  const handleRecordPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplierForPay || paymentAmount <= 0) return;

    const updated = suppliers.map(s => {
      if (s.id === selectedSupplierForPay.id) {
        return {
          ...s,
          outstanding_balance: Math.max(0, s.outstanding_balance - paymentAmount)
        };
      }
      return s;
    });

    StorageService.saveSuppliers(updated);
    setSuppliers(updated);
    setIsPayModalOpen(false);
    setSelectedSupplierForPay(null);
  };

  const toggleProductSelection = (prodId: string) => {
    if (selectedProductIds.includes(prodId)) {
      setSelectedProductIds(selectedProductIds.filter(id => id !== prodId));
    } else {
      setSelectedProductIds([...selectedProductIds, prodId]);
    }
  };

  const exportToCsv = () => {
    const headers = ['Company Name', 'Contact Person', 'Phone', 'Email', 'Outstanding Balance (PKR)', 'Address', 'Notes'];
    const rows = suppliers.map(s => [
      `"${s.company_name.replace(/"/g, '""')}"`,
      `"${s.contact_person.replace(/"/g, '""')}"`,
      `"${s.phone}"`,
      `"${s.email}"`,
      s.outstanding_balance,
      `"${s.address.replace(/"/g, '""')}"`,
      `"${(s.notes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `BoomandCarry_Suppliers_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totalOutstanding = suppliers.reduce((sum, s) => sum + s.outstanding_balance, 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 font-sans">
      
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-lg border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center space-x-2">
            <Truck className="w-5 h-5 text-[#0f6cbd]" />
            <h2 className="text-xl font-bold text-slate-800">Cosmetic Supplier Directory & Balances</h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">Manage brand distributors, purchase costs, outstanding payables & product mappings</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={exportToCsv}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-md text-xs flex items-center space-x-1.5 transition border border-slate-300"
          >
            <FileSpreadsheet className="w-4 h-4 text-slate-600" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={handleOpenAdd}
            className="px-4 py-2 bg-[#0f6cbd] hover:bg-[#115ea3] text-white font-bold rounded-md text-xs shadow-xs flex items-center space-x-2 transition"
          >
            <Plus className="w-4 h-4" />
            <span>Add Cosmetic Supplier</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs">
          <span className="text-xs font-bold text-slate-500 uppercase">Total Suppliers</span>
          <div className="text-2xl font-black text-slate-800 mt-1">{suppliers.length}</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs">
          <span className="text-xs font-bold text-slate-500 uppercase">Total Outstanding Payable</span>
          <div className="text-2xl font-black text-rose-600 mt-1">Rs {totalOutstanding.toLocaleString()}</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs">
          <span className="text-xs font-bold text-slate-500 uppercase">Suppliers With Balance</span>
          <div className="text-2xl font-black text-amber-600 mt-1">
            {suppliers.filter(s => s.outstanding_balance > 0).length}
          </div>
        </div>
      </div>

      {/* Search Bar & Multi-Select Header Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by supplier name, contact person, phone, email..."
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#0f6cbd]"
          />
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <label className="flex items-center space-x-2 px-3 py-2 bg-white border border-slate-300 rounded-md text-xs font-semibold text-slate-700 cursor-pointer hover:bg-slate-50 transition">
            <input
              type="checkbox"
              checked={selectedSupplierIds.length > 0 && selectedSupplierIds.length === filteredSuppliers.length}
              onChange={handleToggleSelectAll}
              className="w-4 h-4 text-[#0f6cbd] rounded focus:ring-[#0f6cbd]"
            />
            <span>Select All ({filteredSuppliers.length})</span>
          </label>

          {selectedSupplierIds.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setIsBulkDeleteModalOpen(true);
                setAdminPasswordInput('');
                setDeletePasswordError(null);
              }}
              className="px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-md text-xs shadow-xs transition flex items-center space-x-1.5 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Selected ({selectedSupplierIds.length})</span>
            </button>
          )}
        </div>
      </div>

      {/* Supplier Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredSuppliers.map(sup => {
          const suppliedProducts = products.filter(p => (sup.products_supplied || []).includes(p.id));
          const isSelected = selectedSupplierIds.includes(sup.id);

          return (
            <div key={sup.id} className={`bg-white border rounded-lg p-5 shadow-xs flex flex-col justify-between space-y-4 transition ${
              isSelected ? 'border-[#0f6cbd] ring-2 ring-[#0f6cbd]/20 bg-blue-50/10' : 'border-slate-200 hover:border-slate-300'
            }`}>
              <div className="space-y-3">
                
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-2.5">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleSelectSupplier(sup.id)}
                      className="w-4 h-4 text-[#0f6cbd] rounded focus:ring-[#0f6cbd] cursor-pointer mt-1 shrink-0"
                    />
                    <div>
                      <h3 className="font-bold text-slate-900 text-base leading-snug">{sup.company_name}</h3>
                      <p className="text-xs text-slate-500 font-medium">Contact: {sup.contact_person}</p>
                    </div>
                  </div>
                  {sup.outstanding_balance > 0 ? (
                    <span className="bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold px-2 py-0.5 rounded-full">
                      Due: Rs {sup.outstanding_balance.toLocaleString()}
                    </span>
                  ) : (
                    <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center space-x-1">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Cleared</span>
                    </span>
                  )}
                </div>

                {/* Details */}
                <div className="space-y-1.5 text-xs text-slate-600">
                  <div className="flex items-center space-x-2">
                    <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="font-mono">{sup.phone}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{sup.email}</span>
                  </div>
                  <div className="flex items-start space-x-2">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                    <span className="line-clamp-2">{sup.address}</span>
                  </div>
                </div>

                {/* Supplied Products Badges */}
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                    Mapped Products ({suppliedProducts.length})
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {suppliedProducts.slice(0, 3).map(p => (
                      <span key={p.id} className="bg-slate-100 text-slate-700 text-[10px] font-medium px-2 py-0.5 rounded">
                        {p.name}
                      </span>
                    ))}
                    {suppliedProducts.length > 3 && (
                      <span className="bg-blue-50 text-[#0f6cbd] text-[10px] font-bold px-1.5 py-0.5 rounded">
                        +{suppliedProducts.length - 3} more
                      </span>
                    )}
                  </div>
                </div>

                {sup.notes && (
                  <p className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded border border-slate-100 italic">
                    "{sup.notes}"
                  </p>
                )}
              </div>

              {/* Actions Footer */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                {sup.outstanding_balance > 0 ? (
                  <button
                    onClick={() => {
                      setSelectedSupplierForPay(sup);
                      setPaymentAmount(sup.outstanding_balance);
                      setIsPayModalOpen(true);
                    }}
                    className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs rounded-md flex items-center space-x-1"
                  >
                    <DollarSign className="w-3.5 h-3.5" />
                    <span>Pay Balance</span>
                  </button>
                ) : (
                  <span className="text-xs text-slate-400 italic">No balance due</span>
                )}

                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => handleOpenEdit(sup)}
                    className="p-1.5 text-slate-600 hover:text-[#0f6cbd] rounded-md hover:bg-slate-100 cursor-pointer"
                    title="Edit Supplier"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSupplierToDeleteSingle(sup);
                      setAdminPasswordInput('');
                      setDeletePasswordError(null);
                    }}
                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded-md hover:bg-rose-50 cursor-pointer"
                    title="Delete Supplier"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add / Edit Supplier Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-slate-200 p-5 sm:p-6 space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-slate-900 text-base sm:text-lg">
                {editingSupplier ? 'Edit Supplier Details' : 'Add New Cosmetic Supplier'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-700 font-bold text-lg px-2">✕</button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 text-xs sm:text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Supplier / Brand Company Name *</label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="e.g. L'Oréal Pakistan Pvt Ltd"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0f6cbd]"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Contact Person Name</label>
                  <input
                    type="text"
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    placeholder="e.g. Farhan Ahmed"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0f6cbd]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. +92 300 1234567"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0f6cbd]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. orders@loreal.pk"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0f6cbd]"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">Office / Warehouse Address</label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="e.g. Industrial Estate Kot Lakhpat, Lahore"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0f6cbd]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Outstanding Balance Payable (PKR)</label>
                  <input
                    type="number"
                    value={outstandingBalance}
                    onChange={(e) => setOutstandingBalance(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0f6cbd]"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">Notes & Contract Terms</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    placeholder="Payment terms, delivery schedules, return policies..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0f6cbd]"
                  />
                </div>
              </div>

              {/* Product Mappings Selection */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Map Products Supplied by this Supplier</label>
                <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-md p-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5 bg-slate-50">
                  {products.map(p => {
                    const isSelected = selectedProductIds.includes(p.id);
                    return (
                      <button
                        type="button"
                        key={p.id}
                        onClick={() => toggleProductSelection(p.id)}
                        className={`text-left p-2 rounded border text-xs flex items-center justify-between transition ${
                          isSelected ? 'bg-blue-50 border-[#0f6cbd] text-[#0f6cbd] font-bold' : 'bg-white border-slate-200 text-slate-700'
                        }`}
                      >
                        <span className="truncate">{p.name}</span>
                        <span className="text-[10px] text-slate-400 font-mono ml-1">Rs {p.buy_price}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-md font-bold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#0f6cbd] hover:bg-[#115ea3] text-white rounded-md font-bold"
                >
                  Save Supplier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {isPayModalOpen && selectedSupplierForPay && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md border border-slate-200 p-5 space-y-4">
            <h3 className="font-bold text-slate-900 text-base">Record Payment to Supplier</h3>
            <p className="text-xs text-slate-500">
              Supplier: <span className="font-bold text-slate-800">{selectedSupplierForPay.company_name}</span><br />
              Current Balance: <span className="font-bold text-rose-600">Rs {selectedSupplierForPay.outstanding_balance.toLocaleString()}</span>
            </p>

            <form onSubmit={handleRecordPayment} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Amount Paid (PKR)</label>
                <input
                  type="number"
                  max={selectedSupplierForPay.outstanding_balance}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#0f6cbd]"
                  required
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setIsPayModalOpen(false)}
                  className="px-3 py-1.5 border border-slate-300 text-slate-700 rounded-md text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-bold"
                >
                  Confirm Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= BULK SUPPLIERS DELETION SECURITY MODAL ================= */}
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
                <h3 className="text-base font-bold">Delete Selected Suppliers</h3>
                <p className="text-xs text-red-100">Permanent Directory Action</p>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-xl p-3.5 text-xs text-red-900 leading-relaxed">
                <p className="font-bold mb-1">
                  You are about to delete <span className="text-red-950 font-black">{selectedSupplierIds.length} supplier profile(s)</span>.
                </p>
                <p className="text-slate-600 text-[11px]">
                  All associated vendor records, mapped cosmetic products, and contact records will be permanently removed across local storage, IndexedDB, and Cloud Firestore.
                </p>
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

      {/* ================= SINGLE SUPPLIER DELETION SECURITY MODAL ================= */}
      {supplierToDeleteSingle && (
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
                <h3 className="text-base font-bold">Delete Cosmetic Supplier</h3>
                <p className="text-xs text-red-100">Permanent Directory Removal</p>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
                <p className="font-bold text-slate-900">{supplierToDeleteSingle.company_name}</p>
                <p className="text-slate-600">Contact: {supplierToDeleteSingle.contact_person} | Phone: <strong className="font-mono text-slate-800">{supplierToDeleteSingle.phone}</strong></p>
                {supplierToDeleteSingle.outstanding_balance > 0 && (
                  <p className="text-rose-600 font-bold text-[11px]">Outstanding Payable: Rs {supplierToDeleteSingle.outstanding_balance.toLocaleString()}</p>
                )}
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
                    setSupplierToDeleteSingle(null);
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
                  <span>Delete Supplier</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

    </div>
  );
};

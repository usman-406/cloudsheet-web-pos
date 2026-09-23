import React, { useState, useRef, useMemo, useEffect } from 'react';
import { 
  Users, 
  UserPlus, 
  Search, 
  Edit3, 
  Award, 
  Phone, 
  Mail, 
  Download, 
  Upload, 
  FileSpreadsheet,
  MessageSquare,
  Cake,
  ShoppingBag,
  TrendingUp,
  Heart,
  Sliders,
  Send,
  CheckCircle2,
  Bell,
  Trash2
} from 'lucide-react';
import { Customer, ShopSettings, CustomerCommPref, LoyaltyPointLog } from '../types';
import { StorageService } from '../services/storage';

interface CustomersManagementProps {
  customers: Customer[];
  settings: ShopSettings;
  onSaveCustomer: (customer: Customer) => void;
  onDeleteCustomer?: (id: string) => void;
  onDeleteMultipleCustomers?: (ids: string[]) => void;
}

export const CustomersManagement: React.FC<CustomersManagementProps> = ({
  customers,
  settings,
  onSaveCustomer,
  onDeleteCustomer,
  onDeleteMultipleCustomers,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Partial<Customer> | null>(null);

  // Selection & Admin Deletion States
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([]);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [customerToDeleteSingle, setCustomerToDeleteSingle] = useState<Customer | null>(null);
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [deletePasswordError, setDeletePasswordError] = useState<string | null>(null);

  // Manual Points Adjustment Modal
  const [isPointsModalOpen, setIsPointsModalOpen] = useState(false);
  const [pointsCust, setPointsCust] = useState<Customer | null>(null);
  const [adjPoints, setAdjPoints] = useState<number>(0);
  const [adjType, setAdjType] = useState<'ADD' | 'SUBTRACT'>('ADD');
  const [adjReason, setAdjReason] = useState<string>('');

  // Send Communication Modal
  const [isCommModalOpen, setIsCommModalOpen] = useState(false);
  const [commCust, setCommCust] = useState<Customer | null>(null);
  const [commChannel, setCommChannel] = useState<'whatsapp' | 'sms' | 'email'>('whatsapp');
  const [commMessage, setCommMessage] = useState('');
  const [commSentSuccess, setCommSentSuccess] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(24);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const filteredCustomers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return customers.filter(c => {
      if (!q) return true;
      return (
        (c.name && c.name.toLowerCase().includes(q)) ||
        (c.phone && c.phone.includes(q)) ||
        (c.email && c.email.toLowerCase().includes(q))
      );
    });
  }, [customers, searchQuery]);

  const totalPages = pageSize === 0 ? 1 : Math.max(1, Math.ceil(filteredCustomers.length / pageSize));
  const paginatedCustomers = useMemo(() => {
    if (pageSize === 0) return filteredCustomers;
    const start = (currentPage - 1) * pageSize;
    return filteredCustomers.slice(start, start + pageSize);
  }, [filteredCustomers, currentPage, pageSize]);

  const handleOpenAdd = () => {
    setEditingCustomer({
      id: `cust_${Date.now()}`,
      name: '',
      phone: '',
      email: '',
      points: 0,
      total_spent: 0,
      order_count: 0,
      birthday: '',
      comm_pref: { email_receipts: true, sms_alerts: true, whatsapp_offers: true, birthday_offers: true, opt_out_all: false }
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (c: Customer) => {
    setEditingCustomer({ 
      ...c,
      comm_pref: c.comm_pref || { email_receipts: true, sms_alerts: true, whatsapp_offers: true, birthday_offers: true, opt_out_all: false }
    });
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCustomer || !editingCustomer.name) return;

    onSaveCustomer(editingCustomer as Customer);
    setIsModalOpen(false);
    setEditingCustomer(null);
  };

  // Selection handlers
  const handleToggleSelectAll = () => {
    if (selectedCustomerIds.length === filteredCustomers.length && filteredCustomers.length > 0) {
      setSelectedCustomerIds([]);
    } else {
      setSelectedCustomerIds(filteredCustomers.map(c => c.id));
    }
  };

  const handleToggleSelectCustomer = (id: string) => {
    setSelectedCustomerIds(prev =>
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

    if (onDeleteMultipleCustomers) {
      onDeleteMultipleCustomers(selectedCustomerIds);
    } else if (onDeleteCustomer) {
      selectedCustomerIds.forEach(id => onDeleteCustomer(id));
    }

    setSelectedCustomerIds([]);
    setIsBulkDeleteModalOpen(false);
    setAdminPasswordInput('');
    setDeletePasswordError(null);
  };

  // Single Customer Delete Submission
  const handleConfirmSingleDelete = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerToDeleteSingle) return;

    if (adminPasswordInput !== 'Usman@Ali513') {
      setDeletePasswordError('Security Check Failed: Incorrect Admin Password. Please enter Usman@Ali513.');
      return;
    }

    if (onDeleteCustomer) {
      onDeleteCustomer(customerToDeleteSingle.id);
    } else if (onDeleteMultipleCustomers) {
      onDeleteMultipleCustomers([customerToDeleteSingle.id]);
    }

    setCustomerToDeleteSingle(null);
    setAdminPasswordInput('');
    setDeletePasswordError(null);
  };

  // Handle Points Adjustment
  const handleOpenPointsModal = (cust: Customer) => {
    setPointsCust(cust);
    setAdjPoints(50);
    setAdjType('ADD');
    setAdjReason('VIP Promotion reward');
    setIsPointsModalOpen(true);
  };

  const handleSavePointsAdj = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pointsCust || adjPoints <= 0) return;

    const activeUser = StorageService.getActiveUser();
    const change = adjType === 'ADD' ? adjPoints : -adjPoints;
    const newPoints = Math.max(0, (pointsCust.points || 0) + change);

    const newLog: LoyaltyPointLog = {
      id: `pth_${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      type: 'MANUAL_ADJUSTMENT',
      points: change,
      note: adjReason || 'Manual adjustment by manager',
      user: activeUser.name
    };

    const updatedCust: Customer = {
      ...pointsCust,
      points: newPoints,
      points_history: [newLog, ...(pointsCust.points_history || [])]
    };

    onSaveCustomer(updatedCust);
    setIsPointsModalOpen(false);
    setPointsCust(null);
  };

  // Handle Send Communication
  const handleOpenComm = (cust: Customer) => {
    setCommCust(cust);
    setCommChannel('whatsapp');
    setCommMessage(`Dear ${cust.name}, thank you for shopping at BoomandCarry Cosmetics! You currently have ${cust.points} loyalty points ready for instant checkout redemption.`);
    setCommSentSuccess(false);
    setIsCommModalOpen(true);
  };

  const handleSendComm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commCust) return;
    setCommSentSuccess(true);
    setTimeout(() => {
      setIsCommModalOpen(false);
      setCommCust(null);
      setCommSentSuccess(false);
    }, 1500);
  };

  // Export Customers CSV
  const handleExportCSV = () => {
    const headers = ['ID', 'Name', 'Phone', 'Email', 'Points', 'TotalSpent', 'OrderCount', 'AvgOrderValue', 'Birthday'];
    const rows = filteredCustomers.map(c => [
      c.id,
      `"${c.name.replace(/"/g, '""')}"`,
      `"${c.phone}"`,
      `"${c.email || ''}"`,
      c.points || 0,
      c.total_spent || 0,
      c.order_count || 0,
      c.avg_order_value || 0,
      `"${c.birthday || ''}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `BoomandCarry_Customers_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4 font-sans">
      
      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={() => {}}
        accept=".csv, .json"
        className="hidden"
      />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-lg border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center space-x-2">
            <Users className="w-5 h-5 text-[#0f6cbd]" />
            <h2 className="text-xl font-bold text-slate-800">Customer CRM & Loyalty Rewards Engine</h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">Track purchase history, average order value, loyalty points, and multi-channel notifications</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-md text-xs flex items-center space-x-1.5 transition border border-slate-300"
          >
            <Download className="w-3.5 h-3.5 text-slate-600" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={handleOpenAdd}
            className="px-4 py-2 bg-[#0f6cbd] hover:bg-[#115ea3] text-white font-bold rounded-md text-xs shadow-xs flex items-center space-x-2 transition"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add New Customer</span>
          </button>
        </div>
      </div>

      {/* Search Bar & Multi-Select Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search customer by name, phone number, email..."
            className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#0f6cbd]"
          />
        </div>

        {/* Selection Count and Bulk Actions */}
        <div className="flex items-center space-x-2 shrink-0">
          <label className="flex items-center space-x-2 px-3 py-2 bg-white border border-slate-300 rounded-md text-xs font-semibold text-slate-700 cursor-pointer hover:bg-slate-50 transition">
            <input
              type="checkbox"
              checked={selectedCustomerIds.length > 0 && selectedCustomerIds.length === filteredCustomers.length}
              onChange={handleToggleSelectAll}
              className="w-4 h-4 text-[#0f6cbd] rounded focus:ring-[#0f6cbd]"
            />
            <span>Select All ({filteredCustomers.length})</span>
          </label>

          {selectedCustomerIds.length > 0 && (
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
              <span>Delete Selected ({selectedCustomerIds.length})</span>
            </button>
          )}
        </div>
      </div>

      {/* Customer Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {paginatedCustomers.map((cust) => {
          const comm = cust.comm_pref || { email_receipts: true, sms_alerts: true, whatsapp_offers: true, birthday_offers: true, opt_out_all: false };
          const isSelected = selectedCustomerIds.includes(cust.id);

          return (
            <div key={cust.id} className={`bg-white p-5 rounded-lg border shadow-xs space-y-4 transition flex flex-col justify-between ${
              isSelected ? 'border-[#0f6cbd] ring-2 ring-[#0f6cbd]/20 bg-blue-50/10' : 'border-slate-200 hover:border-slate-300'
            }`}>
              
              <div className="space-y-3">
                
                {/* Header Profile */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleSelectCustomer(cust.id)}
                      className="w-4 h-4 text-[#0f6cbd] rounded focus:ring-[#0f6cbd] cursor-pointer shrink-0"
                    />
                    <div className="w-10 h-10 rounded-md bg-blue-50 text-[#0f6cbd] font-black text-base flex items-center justify-center shrink-0">
                      {(cust.name || 'C').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-slate-900">{cust.name}</h4>
                      <div className="flex items-center space-x-1 text-slate-500 text-xs">
                        <Phone className="w-3 h-3 text-slate-400" />
                        <span className="font-mono">{cust.phone}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => handleOpenComm(cust)}
                      className="p-1.5 bg-blue-50 hover:bg-blue-100 text-[#0f6cbd] rounded-md transition cursor-pointer"
                      title="Send WhatsApp / SMS Notification"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleOpenEdit(cust)}
                      className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-md transition cursor-pointer"
                      title="Edit Profile & Preferences"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCustomerToDeleteSingle(cust);
                        setAdminPasswordInput('');
                        setDeletePasswordError(null);
                      }}
                      className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-md transition cursor-pointer"
                      title="Delete Customer Profile"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Email & Birthday */}
                <div className="space-y-1 text-xs text-slate-600">
                  {cust.email && (
                    <div className="flex items-center space-x-1.5">
                      <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{cust.email}</span>
                    </div>
                  )}
                  {cust.birthday && (
                    <div className="flex items-center space-x-1.5">
                      <Cake className="w-3.5 h-3.5 text-pink-500 shrink-0" />
                      <span>Birthday: {cust.birthday}</span>
                    </div>
                  )}
                </div>

                {/* Analytics Metrics Pill Grid */}
                <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-md border border-slate-200 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Total Spent</span>
                    <span className="font-bold text-slate-900">{settings.currency_symbol} {(cust.total_spent || 0).toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Avg Order Value</span>
                    <span className="font-bold text-slate-900">{settings.currency_symbol} {(cust.avg_order_value || Math.round((cust.total_spent || 0) / (cust.order_count || 1))).toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Order Count</span>
                    <span className="font-bold text-slate-900">{cust.order_count || 1} sales</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Fav Category</span>
                    <span className="font-bold text-[#0f6cbd] truncate block">{cust.favorite_category || 'Cosmetics'}</span>
                  </div>
                </div>

                {/* Comm Pref Badges */}
                <div className="flex items-center space-x-1 text-[10px] font-bold">
                  <span className="text-slate-400">Notif Prefs:</span>
                  {comm.opt_out_all ? (
                    <span className="bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">Opted Out</span>
                  ) : (
                    <>
                      {comm.whatsapp_offers && <span className="bg-emerald-50 text-[#107c41] px-1.5 py-0.5 rounded">WhatsApp</span>}
                      {comm.sms_alerts && <span className="bg-blue-50 text-[#0f6cbd] px-1.5 py-0.5 rounded">SMS</span>}
                      {comm.email_receipts && <span className="bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded">Email</span>}
                    </>
                  )}
                </div>
              </div>

              {/* Loyalty Bar & Adjust Button */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <div className="flex items-center space-x-1 text-amber-700 font-bold bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200">
                  <Award className="w-4 h-4 text-amber-600" />
                  <span>{cust.points || 0} Points</span>
                </div>

                <button
                  onClick={() => handleOpenPointsModal(cust)}
                  className="px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-800 font-bold rounded-md text-[11px] transition"
                >
                  Adjust Points
                </button>
              </div>

            </div>
          );
        })}
      </div>

      {/* Customer Grid Pagination Bar */}
      <div className="p-3.5 bg-white rounded-lg border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs shadow-xs">
        <div className="flex items-center space-x-2 text-slate-600">
          <span>Showing {filteredCustomers.length === 0 ? 0 : (currentPage - 1) * (pageSize || filteredCustomers.length) + 1} to {pageSize === 0 ? filteredCustomers.length : Math.min(currentPage * pageSize, filteredCustomers.length)} of {filteredCustomers.length} customer accounts</span>
          <span className="text-slate-300">|</span>
          <div className="flex items-center space-x-1">
            <span>Per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-white border border-slate-300 rounded px-1.5 py-0.5 font-semibold text-slate-700 focus:outline-hidden"
            >
              <option value={12}>12</option>
              <option value={24}>24</option>
              <option value={48}>48</option>
              <option value={0}>All</option>
            </select>
          </div>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center space-x-1">
            <button
              type="button"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="px-2.5 py-1 rounded bg-white border border-slate-300 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 font-bold transition"
            >
              Prev
            </button>
            <span className="px-2 py-1 font-semibold text-slate-700">
              Page {currentPage} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="px-2.5 py-1 rounded bg-white border border-slate-300 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 font-bold transition"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Manual Points Adjustment Modal */}
      {isPointsModalOpen && pointsCust && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md border border-slate-200 p-5 space-y-4">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="font-bold text-slate-900 text-base flex items-center space-x-2">
                <Award className="w-4 h-4 text-amber-600" />
                <span>Adjust Loyalty Points ({pointsCust.name})</span>
              </h3>
              <button onClick={() => setIsPointsModalOpen(false)} className="text-slate-400 font-bold px-1">✕</button>
            </div>

            <p className="text-xs text-slate-500">
              Current Points Balance: <span className="font-bold text-slate-800">{pointsCust.points || 0} Points</span>
            </p>

            <form onSubmit={handleSavePointsAdj} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAdjType('ADD')}
                  className={`py-2 rounded-md font-bold transition border ${
                    adjType === 'ADD' ? 'bg-emerald-50 border-emerald-300 text-[#107c41]' : 'bg-slate-50 border-slate-200 text-slate-600'
                  }`}
                >
                  + Add Reward Points
                </button>
                <button
                  type="button"
                  onClick={() => setAdjType('SUBTRACT')}
                  className={`py-2 rounded-md font-bold transition border ${
                    adjType === 'SUBTRACT' ? 'bg-rose-50 border-rose-300 text-rose-700' : 'bg-slate-50 border-slate-200 text-slate-600'
                  }`}
                >
                  - Deduct Points
                </button>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Points Quantity</label>
                <input
                  type="number"
                  min="1"
                  value={adjPoints}
                  onChange={(e) => setAdjPoints(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md font-bold text-sm focus:outline-none focus:ring-2 focus:ring-[#0f6cbd]"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Reason / Manager Approval Note *</label>
                <input
                  type="text"
                  value={adjReason}
                  onChange={(e) => setAdjReason(e.target.value)}
                  placeholder="e.g. Compensation for order delay, Manager campaign reward"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0f6cbd]"
                  required
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setIsPointsModalOpen(false)}
                  className="px-3 py-1.5 border border-slate-300 text-slate-700 rounded-md font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#0f6cbd] hover:bg-[#115ea3] text-white rounded-md font-bold"
                >
                  Confirm Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Send Notification Modal */}
      {isCommModalOpen && commCust && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md border border-slate-200 p-5 space-y-4">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="font-bold text-slate-900 text-base flex items-center space-x-2">
                <MessageSquare className="w-4 h-4 text-[#0f6cbd]" />
                <span>Send Offer / Notification ({commCust.name})</span>
              </h3>
              <button onClick={() => setIsCommModalOpen(false)} className="text-slate-400 font-bold px-1">✕</button>
            </div>

            {commSentSuccess ? (
              <div className="py-6 text-center space-y-2 text-emerald-700 font-bold text-sm">
                <CheckCircle2 className="w-10 h-10 mx-auto text-[#107c41] animate-bounce" />
                <p>Notification Dispatched via {commChannel.toUpperCase()}!</p>
              </div>
            ) : (
              <form onSubmit={handleSendComm} className="space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Select Dispatch Channel</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setCommChannel('whatsapp')}
                      className={`py-2 rounded-md font-bold transition border ${
                        commChannel === 'whatsapp' ? 'bg-emerald-50 border-emerald-300 text-[#107c41]' : 'bg-slate-50 border-slate-200 text-slate-600'
                      }`}
                    >
                      WhatsApp
                    </button>
                    <button
                      type="button"
                      onClick={() => setCommChannel('sms')}
                      className={`py-2 rounded-md font-bold transition border ${
                        commChannel === 'sms' ? 'bg-blue-50 border-blue-300 text-[#0f6cbd]' : 'bg-slate-50 border-slate-200 text-slate-600'
                      }`}
                    >
                      SMS
                    </button>
                    <button
                      type="button"
                      onClick={() => setCommChannel('email')}
                      className={`py-2 rounded-md font-bold transition border ${
                        commChannel === 'email' ? 'bg-purple-50 border-purple-300 text-purple-700' : 'bg-slate-50 border-slate-200 text-slate-600'
                      }`}
                    >
                      Email
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Message Content</label>
                  <textarea
                    rows={4}
                    value={commMessage}
                    onChange={(e) => setCommMessage(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0f6cbd]"
                  />
                </div>

                <div className="flex justify-end space-x-2 pt-2 border-t">
                  <button
                    type="button"
                    onClick={() => setIsCommModalOpen(false)}
                    className="px-3 py-1.5 border border-slate-300 text-slate-700 rounded-md font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-[#0f6cbd] hover:bg-[#115ea3] text-white rounded-md font-bold flex items-center space-x-1"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Send Now</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Add / Edit Customer Modal */}
      {isModalOpen && editingCustomer && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-xl w-full max-w-md border border-slate-200 p-5 space-y-4">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="font-bold text-slate-900 text-base">
                {editingCustomer.id?.startsWith('cust_') ? 'Add New Customer' : 'Edit Customer Profile'}
              </h3>
              <button type="button" onClick={() => setIsModalOpen(false)} className="text-slate-400 font-bold px-1">✕</button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Customer Full Name *</label>
                <input
                  type="text"
                  required
                  value={editingCustomer.name || ''}
                  onChange={(e) => setEditingCustomer({ ...editingCustomer, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0f6cbd]"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Mobile Phone Number</label>
                <input
                  type="text"
                  value={editingCustomer.phone || ''}
                  onChange={(e) => setEditingCustomer({ ...editingCustomer, phone: e.target.value })}
                  placeholder="0300-1234567"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0f6cbd]"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Email Address</label>
                <input
                  type="email"
                  value={editingCustomer.email || ''}
                  onChange={(e) => setEditingCustomer({ ...editingCustomer, email: e.target.value })}
                  placeholder="customer@email.com"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0f6cbd]"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Birthday (for Promotional Offers)</label>
                <input
                  type="date"
                  value={editingCustomer.birthday || ''}
                  onChange={(e) => setEditingCustomer({ ...editingCustomer, birthday: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0f6cbd]"
                />
              </div>

              {/* Communication Preferences Toggles */}
              <div className="border border-slate-200 p-3 rounded-md bg-slate-50 space-y-2">
                <span className="font-bold text-slate-700 block mb-1">Communication & Opt-in Settings</span>
                
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={editingCustomer.comm_pref?.whatsapp_offers ?? true}
                    onChange={(e) => setEditingCustomer({
                      ...editingCustomer,
                      comm_pref: { ...editingCustomer.comm_pref!, whatsapp_offers: e.target.checked }
                    })}
                  />
                  <span>WhatsApp Promotional Offers & Discounts</span>
                </label>

                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={editingCustomer.comm_pref?.sms_alerts ?? true}
                    onChange={(e) => setEditingCustomer({
                      ...editingCustomer,
                      comm_pref: { ...editingCustomer.comm_pref!, sms_alerts: e.target.checked }
                    })}
                  />
                  <span>SMS Order Alerts & Loyalty Updates</span>
                </label>

                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={editingCustomer.comm_pref?.email_receipts ?? true}
                    onChange={(e) => setEditingCustomer({
                      ...editingCustomer,
                      comm_pref: { ...editingCustomer.comm_pref!, email_receipts: e.target.checked }
                    })}
                  />
                  <span>Email Digital Invoices & Receipts</span>
                </label>
              </div>
            </div>

            <div className="flex space-x-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-md text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2 bg-[#0f6cbd] hover:bg-[#115ea3] text-white font-bold rounded-md text-xs shadow-xs"
              >
                Save Profile
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ================= BULK CUSTOMERS DELETION SECURITY MODAL ================= */}
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
                <h3 className="text-base font-bold">Delete Selected Customers</h3>
                <p className="text-xs text-red-100">Permanent Database Action</p>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-xl p-3.5 text-xs text-red-900 leading-relaxed">
                <p className="font-bold mb-1">
                  You are about to delete <span className="text-red-950 font-black">{selectedCustomerIds.length} customer record(s)</span>.
                </p>
                <p className="text-slate-600 text-[11px]">
                  All associated loyalty points profiles and communication preferences will be removed from local storage, IndexedDB, and Cloud Firestore.
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

      {/* ================= SINGLE CUSTOMER DELETION SECURITY MODAL ================= */}
      {customerToDeleteSingle && (
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
                <h3 className="text-base font-bold">Delete Customer Profile</h3>
                <p className="text-xs text-red-100">Permanent Database Removal</p>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
                <p className="font-bold text-slate-900">Name: {customerToDeleteSingle.name}</p>
                <p className="text-slate-600">Phone: <strong className="font-mono text-slate-800">{customerToDeleteSingle.phone}</strong></p>
                <p className="text-slate-500 text-[11px]">Points: {customerToDeleteSingle.points || 0} pts | Total Spent: {settings.currency_symbol} {(customerToDeleteSingle.total_spent || 0).toLocaleString()}</p>
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
                    setCustomerToDeleteSingle(null);
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
                  <span>Delete Customer</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

    </div>
  );
};

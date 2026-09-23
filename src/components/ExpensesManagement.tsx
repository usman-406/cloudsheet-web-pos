import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Wallet, Plus, Trash2, Calendar, Tag, Download, Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Image as ImageIcon } from 'lucide-react';
import { Expense, ShopSettings, ExpenseCategory } from '../types';

interface ExpensesManagementProps {
  expenses: Expense[];
  settings: ShopSettings;
  onSaveExpense: (expense: Expense) => void;
  onDeleteExpense: (id: string) => void;
  onDeleteMultipleExpenses?: (ids: string[]) => void;
}

const CATEGORIES: { label: string; value: ExpenseCategory; color: string }[] = [
  { label: 'Rent', value: 'Rent', color: 'bg-blue-100 text-blue-800' },
  { label: 'Electricity', value: 'Electricity', color: 'bg-amber-100 text-amber-800' },
  { label: 'Salaries', value: 'Salaries', color: 'bg-purple-100 text-purple-800' },
  { label: 'Packaging', value: 'Packaging', color: 'bg-pink-100 text-pink-800' },
  { label: 'Transport', value: 'Transport', color: 'bg-indigo-100 text-indigo-800' },
  { label: 'Marketing', value: 'Marketing', color: 'bg-rose-100 text-rose-800' },
  { label: 'Internet', value: 'Internet', color: 'bg-cyan-100 text-cyan-800' },
  { label: 'Supplies', value: 'Supplies', color: 'bg-emerald-100 text-emerald-800' },
  { label: 'Miscellaneous', value: 'Miscellaneous', color: 'bg-slate-100 text-slate-800' },
];

export const ExpensesManagement: React.FC<ExpensesManagementProps> = ({
  expenses,
  settings,
  onSaveExpense,
  onDeleteExpense,
  onDeleteMultipleExpenses,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('ALL');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Multi-Selection & Admin Security Password Deletion States
  const [selectedExpenseIds, setSelectedExpenseIds] = useState<string[]>([]);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [expenseToDeleteSingle, setExpenseToDeleteSingle] = useState<Expense | null>(null);
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [deletePasswordError, setDeletePasswordError] = useState<string | null>(null);

  const [editingExpense, setEditingExpense] = useState<Partial<Expense>>({
    id: `exp_${Date.now()}`,
    date: new Date().toISOString().split('T')[0],
    title: '',
    category: 'Rent',
    amount: 1000,
    payment_method: 'Cash',
    note: '',
    created_by: 'Store Manager (Admin)',
    status: 'APPROVED'
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCategoryFilter]);

  const filteredExpenses = useMemo(() => {
    return selectedCategoryFilter === 'ALL'
      ? expenses
      : expenses.filter(ex => ex.category === selectedCategoryFilter);
  }, [expenses, selectedCategoryFilter]);

  const totalExpenseSum = useMemo(() => {
    return filteredExpenses.reduce((a, b) => a + (Number(b.amount) || 0), 0);
  }, [filteredExpenses]);

  const totalPages = pageSize === 0 ? 1 : Math.max(1, Math.ceil(filteredExpenses.length / pageSize));
  const paginatedExpenses = useMemo(() => {
    if (pageSize === 0) return filteredExpenses;
    const start = (currentPage - 1) * pageSize;
    return filteredExpenses.slice(start, start + pageSize);
  }, [filteredExpenses, currentPage, pageSize]);

  // Selection handlers
  const handleToggleSelectAll = () => {
    if (selectedExpenseIds.length === filteredExpenses.length && filteredExpenses.length > 0) {
      setSelectedExpenseIds([]);
    } else {
      setSelectedExpenseIds(filteredExpenses.map(e => e.id));
    }
  };

  const handleToggleSelectExpense = (id: string) => {
    setSelectedExpenseIds(prev =>
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

    if (onDeleteMultipleExpenses) {
      onDeleteMultipleExpenses(selectedExpenseIds);
    } else {
      selectedExpenseIds.forEach(id => onDeleteExpense(id));
    }

    setSelectedExpenseIds([]);
    setIsBulkDeleteModalOpen(false);
    setAdminPasswordInput('');
    setDeletePasswordError(null);
  };

  // Single Expense Delete Submission
  const handleConfirmSingleDelete = (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseToDeleteSingle) return;

    if (adminPasswordInput !== 'Usman@Ali513') {
      setDeletePasswordError('Security Check Failed: Incorrect Admin Password. Please enter Usman@Ali513.');
      return;
    }

    onDeleteExpense(expenseToDeleteSingle.id);
    setExpenseToDeleteSingle(null);
    setAdminPasswordInput('');
    setDeletePasswordError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingExpense.title || !editingExpense.amount) return;

    onSaveExpense(editingExpense as Expense);
    setIsModalOpen(false);
    setEditingExpense({
      id: `exp_${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      title: '',
      category: 'Rent',
      amount: 1000,
      payment_method: 'Cash',
      note: '',
      created_by: 'Store Manager (Admin)',
      status: 'APPROVED'
    });
  };

  // Export Expenses CSV
  const handleExportCSV = () => {
    const headers = ['ID', 'Date', 'Title', 'Category', 'Amount', 'Payment Method', 'Created By', 'Status', 'Note'];
    const rows = filteredExpenses.map(ex => [
      ex.id,
      ex.date,
      `"${ex.title.replace(/"/g, '""')}"`,
      `"${ex.category || 'Miscellaneous'}"`,
      ex.amount,
      `"${ex.payment_method || 'Cash'}"`,
      `"${ex.created_by || 'Admin'}"`,
      `"${ex.status || 'APPROVED'}"`,
      `"${(ex.note || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `BloomAndCarry_Expenses_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Download Expenses CSV Template
  const handleDownloadTemplate = () => {
    const csvContent = 'data:text/csv;charset=utf-8,' + [
      'Date,Title,Category,Amount,Payment Method,Created By,Status,Note',
      '2026-08-01,"Commercial Shop Rent","Rent",120000,"Bank Transfer","Admin","APPROVED","Liberty market rental"',
      '2026-08-02,"Shop Electricity Bill","Electricity",32500,"Bank Transfer","Admin","APPROVED","LESCO July bill"'
    ].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'BloomAndCarry_Expenses_Template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Import Expenses CSV / JSON File
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        if (file.name.endsWith('.json')) {
          const parsed = JSON.parse(text);
          if (Array.isArray(parsed)) {
            parsed.forEach((item: any) => {
              if (item.title && item.amount) {
                onSaveExpense({
                  id: item.id || `exp_${Date.now()}_${Math.floor(Math.random()*1000)}`,
                  date: item.date || new Date().toISOString().split('T')[0],
                  title: String(item.title),
                  category: (item.category || 'Miscellaneous') as ExpenseCategory,
                  amount: Number(item.amount),
                  payment_method: item.payment_method || 'Cash',
                  created_by: item.created_by || 'Admin',
                  status: item.status || 'APPROVED',
                  note: item.note || ''
                });
              }
            });
            alert('Expenses imported successfully!');
          }
        } else {
          const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
          if (lines.length > 1) {
            lines.slice(1).forEach((line) => {
              const parts = line.split(',').map(p => p.replace(/^"|"$/g, '').trim());
              if (parts.length >= 3 && parts[1] && parts[3]) {
                onSaveExpense({
                  id: `exp_${Date.now()}_${Math.floor(Math.random()*1000)}`,
                  date: parts[0] || new Date().toISOString().split('T')[0],
                  title: parts[1],
                  category: (parts[2] || 'Miscellaneous') as ExpenseCategory,
                  amount: Number(parts[3]) || 0,
                  payment_method: parts[4] || 'Cash',
                  created_by: parts[5] || 'Admin',
                  status: 'APPROVED',
                  note: parts[7] || ''
                });
              }
            });
            alert('CSV Expenses imported successfully!');
          }
        }
      } catch {
        alert('Failed to parse expenses file.');
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">
      
      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept=".csv, .json"
        className="hidden"
      />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-xl font-extrabold text-slate-800">Expense Management Module</h2>
          <p className="text-xs text-slate-500">Track rent, electricity, salaries, packaging, transport, marketing, internet, supplies & misc expenses</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleDownloadTemplate}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center space-x-1 transition"
            title="Download CSV Template"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">CSV Template</span>
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 font-bold rounded-xl text-xs flex items-center space-x-1 transition"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="px-3 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 font-bold rounded-xl text-xs flex items-center space-x-1 transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 bg-[#0f6cbd] hover:bg-[#115ea3] text-white font-bold rounded-xl text-xs shadow-md flex items-center space-x-2 transition"
          >
            <Plus className="w-4 h-4" />
            <span>Record New Expense</span>
          </button>
        </div>
      </div>

      {/* Category Pills & Summary Widget */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="md:col-span-1 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Total ({selectedCategoryFilter})</span>
            <h3 className="text-2xl font-black text-rose-600 mt-1">
              {settings.currency_symbol} {totalExpenseSum.toLocaleString()}
            </h3>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
            <Wallet className="w-6 h-6" />
          </div>
        </div>

        <div className="md:col-span-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center flex-wrap gap-2">
            <span className="text-xs font-bold text-slate-500 mr-2">Filter Category:</span>
            <button
              onClick={() => setSelectedCategoryFilter('ALL')}
              className={`px-3 py-1 rounded-full text-xs font-bold transition cursor-pointer ${selectedCategoryFilter === 'ALL' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
            >
              All Categories ({expenses.length})
            </button>
            {CATEGORIES.map(cat => {
              const catCount = expenses.filter(e => e.category === cat.value).length;
              return (
                <button
                  key={cat.value}
                  onClick={() => setSelectedCategoryFilter(cat.value)}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition cursor-pointer ${selectedCategoryFilter === cat.value ? 'bg-[#0f6cbd] text-white' : `${cat.color} hover:opacity-80`}`}
                >
                  {cat.label} ({catCount})
                </button>
              );
            })}
          </div>

          {/* Bulk Selection Actions */}
          {selectedExpenseIds.length > 0 && (
            <div className="flex items-center space-x-2.5 bg-red-50 border border-red-200 px-3 py-1.5 rounded-xl">
              <span className="text-xs font-bold text-red-900">
                {selectedExpenseIds.length} Selected (Total: {settings.currency_symbol} {expenses.filter(e => selectedExpenseIds.includes(e.id)).reduce((a, b) => a + b.amount, 0).toLocaleString()})
              </span>
              <button
                type="button"
                onClick={() => {
                  setIsBulkDeleteModalOpen(true);
                  setAdminPasswordInput('');
                  setDeletePasswordError(null);
                }}
                className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg text-xs shadow-xs transition flex items-center space-x-1 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Selected</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Expenses Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="p-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={selectedExpenseIds.length > 0 && selectedExpenseIds.length === filteredExpenses.length}
                    onChange={handleToggleSelectAll}
                    className="w-4 h-4 text-[#0f6cbd] rounded focus:ring-[#0f6cbd] cursor-pointer"
                  />
                </th>
                <th className="p-3">Date</th>
                <th className="p-3">Title & Details</th>
                <th className="p-3">Category</th>
                <th className="p-3">Payment Method</th>
                <th className="p-3">Created By</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Amount</th>
                <th className="p-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-400">
                    No expense records found for this selection.
                  </td>
                </tr>
              ) : (
                paginatedExpenses.map((exp) => {
                  const isSelected = selectedExpenseIds.includes(exp.id);
                  return (
                    <tr key={exp.id} className={`transition ${isSelected ? 'bg-blue-50/40' : 'hover:bg-slate-50/80'}`}>
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelectExpense(exp.id)}
                          className="w-4 h-4 text-[#0f6cbd] rounded focus:ring-[#0f6cbd] cursor-pointer"
                        />
                      </td>
                      <td className="p-3 font-semibold text-slate-600 whitespace-nowrap">{exp.date}</td>
                      <td className="p-3">
                        <div className="font-bold text-slate-900">{exp.title}</div>
                        {exp.note && <div className="text-[11px] text-slate-500 mt-0.5">{exp.note}</div>}
                      </td>
                      <td className="p-3">
                        <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold ${CATEGORIES.find(c => c.value === exp.category)?.color || 'bg-slate-100 text-slate-700'}`}>
                          {exp.category}
                        </span>
                      </td>
                      <td className="p-3 font-medium text-slate-700">{exp.payment_method || 'Cash'}</td>
                      <td className="p-3 text-slate-600">{exp.created_by || 'Admin'}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center space-x-1 w-fit ${exp.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                          <CheckCircle2 className="w-3 h-3" />
                          <span>{exp.status || 'APPROVED'}</span>
                        </span>
                      </td>
                      <td className="p-3 text-right font-black text-rose-600 text-sm whitespace-nowrap">
                        {settings.currency_symbol} {exp.amount.toLocaleString()}
                      </td>
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            setExpenseToDeleteSingle(exp);
                            setAdminPasswordInput('');
                            setDeletePasswordError(null);
                          }}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded transition cursor-pointer"
                          title="Delete Expense Voucher"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Expenses Pagination Footer */}
        <div className="p-3 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center space-x-2 text-slate-600">
            <span>Showing {filteredExpenses.length === 0 ? 0 : (currentPage - 1) * (pageSize || filteredExpenses.length) + 1} to {pageSize === 0 ? filteredExpenses.length : Math.min(currentPage * pageSize, filteredExpenses.length)} of {filteredExpenses.length} expenses</span>
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
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
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
      </div>

      {/* Fitted & Scrollable Add Expense Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-slate-100 p-6 space-y-4 my-auto">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Record Store Expense</h3>
                <p className="text-xs text-slate-500">Add operational costs with category, method & approval</p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 font-bold hover:text-slate-700 text-lg px-2"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Expense Title *</label>
                <input
                  type="text"
                  required
                  value={editingExpense.title || ''}
                  onChange={(e) => setEditingExpense({ ...editingExpense, title: e.target.value })}
                  placeholder="e.g. Commercial Shop Premises Rent"
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium focus:bg-white focus:ring-2 focus:ring-[#0f6cbd]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Category *</label>
                  <select
                    value={editingExpense.category || 'Rent'}
                    onChange={(e) => setEditingExpense({ ...editingExpense, category: e.target.value as ExpenseCategory })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium focus:bg-white focus:ring-2 focus:ring-[#0f6cbd]"
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat.value} value={cat.value}>{cat.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Payment Method *</label>
                  <select
                    value={editingExpense.payment_method || 'Cash'}
                    onChange={(e) => setEditingExpense({ ...editingExpense, payment_method: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium focus:bg-white focus:ring-2 focus:ring-[#0f6cbd]"
                  >
                    <option value="Cash">Cash</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Card">Card</option>
                    <option value="Easypaisa">Easypaisa</option>
                    <option value="JazzCash">JazzCash</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Amount ({settings.currency_symbol}) *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={editingExpense.amount || ''}
                    onChange={(e) => setEditingExpense({ ...editingExpense, amount: Number(e.target.value) })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-extrabold text-rose-600 text-lg focus:bg-white focus:ring-2 focus:ring-[#0f6cbd]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Expense Date</label>
                  <input
                    type="date"
                    value={editingExpense.date || new Date().toISOString().split('T')[0]}
                    onChange={(e) => setEditingExpense({ ...editingExpense, date: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium focus:bg-white focus:ring-2 focus:ring-[#0f6cbd]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Notes / Description</label>
                <textarea
                  rows={2}
                  value={editingExpense.note || ''}
                  onChange={(e) => setEditingExpense({ ...editingExpense, note: e.target.value })}
                  placeholder="Additional context or invoice receipt reference..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium focus:bg-white focus:ring-2 focus:ring-[#0f6cbd]"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Attachment URL / Document Link (Optional)</label>
                <input
                  type="text"
                  value={editingExpense.attachment_url || ''}
                  onChange={(e) => setEditingExpense({ ...editingExpense, attachment_url: e.target.value })}
                  placeholder="https://drive.google.com/..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium focus:bg-white focus:ring-2 focus:ring-[#0f6cbd]"
                />
              </div>
            </div>

            <div className="flex space-x-3 pt-3 border-t">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 bg-[#0f6cbd] hover:bg-[#115ea3] text-white font-bold rounded-xl text-xs shadow-md"
              >
                Save Expense Record
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ================= BULK EXPENSES DELETION SECURITY MODAL ================= */}
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
                <h3 className="text-base font-bold">Delete Selected Expenses</h3>
                <p className="text-xs text-red-100">Permanent Ledger Removal</p>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-xl p-3.5 text-xs text-red-900 leading-relaxed">
                <p className="font-bold mb-1">
                  You are about to delete <span className="text-red-950 font-black">{selectedExpenseIds.length} expense voucher(s)</span>.
                </p>
                <p className="text-slate-600 text-[11px]">
                  Total Value: <strong className="font-mono text-red-700">{settings.currency_symbol} {expenses.filter(e => selectedExpenseIds.includes(e.id)).reduce((a, b) => a + b.amount, 0).toLocaleString()}</strong>
                </p>
                <p className="text-slate-500 text-[11px] mt-1">
                  These records will be removed from local storage, IndexedDB, and Cloud Firestore ledger.
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

      {/* ================= SINGLE EXPENSE DELETION SECURITY MODAL ================= */}
      {expenseToDeleteSingle && (
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
                <h3 className="text-base font-bold">Delete Expense Voucher</h3>
                <p className="text-xs text-red-100">Permanent Ledger Removal</p>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
                <div className="flex justify-between items-start">
                  <p className="font-bold text-slate-900">{expenseToDeleteSingle.title}</p>
                  <span className="font-black text-red-600 font-mono text-sm">{settings.currency_symbol} {expenseToDeleteSingle.amount.toLocaleString()}</span>
                </div>
                <p className="text-slate-600">Category: <strong className="text-slate-800">{expenseToDeleteSingle.category}</strong> | Date: {expenseToDeleteSingle.date}</p>
                {expenseToDeleteSingle.note && <p className="text-slate-500 text-[11px]">Note: {expenseToDeleteSingle.note}</p>}
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
                    setExpenseToDeleteSingle(null);
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
                  <span>Delete Expense</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

    </div>
  );
};


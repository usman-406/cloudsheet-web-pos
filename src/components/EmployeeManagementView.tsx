import React, { useState } from 'react';
import { Employee, User, PayrollRecord } from '../types';
import { StorageService } from '../services/storage';
import { 
  Users, 
  UserPlus, 
  ShieldCheck, 
  Key, 
  CheckCircle2, 
  XCircle, 
  Building, 
  Clock, 
  Phone, 
  Mail,
  Edit,
  Lock,
  UserCheck,
  DollarSign,
  Calculator,
  FileText,
  Printer,
  Calendar,
  CreditCard,
  Briefcase
} from 'lucide-react';

interface EmployeeManagementViewProps {
  activeUser: User;
}

export const EmployeeManagementView: React.FC<EmployeeManagementViewProps> = ({
  activeUser,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'employees' | 'payroll'>('employees');

  const [employees, setEmployees] = useState<Employee[]>(() => StorageService.getEmployees());
  const [payrolls, setPayrolls] = useState<PayrollRecord[]>(() => StorageService.getPayrolls());

  const [showAddModal, setShowAddModal] = useState(false);
  const [showPayrollModal, setShowPayrollModal] = useState(false);
  const [selectedPaySlip, setSelectedPaySlip] = useState<PayrollRecord | null>(null);

  const [newEmp, setNewEmp] = useState<Partial<Employee>>({
    role: 'cashier',
    department: 'Cash Counter',
    assigned_branch: 'Main Flagship Store',
    status: 'ACTIVE',
    shift: 'Morning (09:00 - 17:00)',
  });

  const [newPayroll, setNewPayroll] = useState({
    employee_id: employees[0]?.id || 'usr_2',
    month: `${new Date().toLocaleString('en-US', { month: 'long' })} ${new Date().getFullYear()}`,
    base_salary: 45000,
    working_days: 26,
    present_days: 26,
    overtime_hours: 0,
    overtime_rate: 350,
    commission_amount: 0,
    deductions: 0,
    payment_method: 'Bank Transfer',
  });

  const handleAddEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmp.name || !newEmp.username) return;

    const emp: Employee = {
      id: `emp_${Date.now()}`,
      name: newEmp.name || '',
      username: newEmp.username || '',
      role: (newEmp.role as any) || 'cashier',
      department: newEmp.department || 'Retail',
      assigned_branch: newEmp.assigned_branch || 'Main Flagship Store',
      status: 'ACTIVE',
      pin: newEmp.pin || '12345678',
      shift: (newEmp.shift as any) || 'Morning (09:00 - 17:00)',
      pos_permissions: newEmp.role === 'admin' ? ['all_access', 'price_override', 'refund_approve'] : ['checkout', 'loyalty_lookup'],
      phone: newEmp.phone || '0300-0000000',
      email: newEmp.email || '',
      created_at: new Date().toISOString().slice(0, 10),
    };

    const updated = [...employees, emp];
    setEmployees(updated);
    StorageService.saveEmployees(updated);
    setShowAddModal(false);
    setNewEmp({ role: 'cashier', department: 'Cash Counter', assigned_branch: 'Main Flagship Store', status: 'ACTIVE', shift: 'Morning (09:00 - 17:00)' });
  };

  const handleCreatePayroll = (e: React.FormEvent) => {
    e.preventDefault();
    const emp = employees.find(e => e.id === newPayroll.employee_id);
    if (!emp) return;

    const basePerDay = newPayroll.working_days > 0 ? (newPayroll.base_salary / newPayroll.working_days) : 0;
    const earnedBase = Math.round(basePerDay * newPayroll.present_days);
    const overtimeTotal = Number(newPayroll.overtime_hours) * Number(newPayroll.overtime_rate);
    const net = earnedBase + overtimeTotal + Number(newPayroll.commission_amount) - Number(newPayroll.deductions);

    const record: PayrollRecord = {
      id: `pay_${Date.now()}`,
      employee_id: emp.id,
      employee_name: emp.name,
      month: newPayroll.month,
      base_salary: Number(newPayroll.base_salary),
      working_days: Number(newPayroll.working_days),
      present_days: Number(newPayroll.present_days),
      overtime_hours: Number(newPayroll.overtime_hours),
      overtime_rate: Number(newPayroll.overtime_rate),
      commission_amount: Number(newPayroll.commission_amount),
      deductions: Number(newPayroll.deductions),
      net_salary: Math.max(0, net),
      status: 'PENDING',
      payment_method: newPayroll.payment_method,
    };

    const updated = [record, ...payrolls];
    setPayrolls(updated);
    StorageService.savePayrolls(updated);
    setShowPayrollModal(false);
  };

  const toggleStatus = (id: string) => {
    const updated = employees.map(e => e.id === id ? { ...e, status: (e.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE') as any } : e);
    setEmployees(updated);
    StorageService.saveEmployees(updated);
  };

  const markPaid = (id: string) => {
    const updated = payrolls.map(p => p.id === id ? { ...p, status: 'PAID' as const, payment_date: new Date().toISOString().slice(0, 10) } : p);
    setPayrolls(updated);
    StorageService.savePayrolls(updated);
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 flex items-center space-x-2">
            <Users className="w-5 h-5 sm:w-6 sm:h-6 text-[#0f6cbd]" />
            <span>Staff Profiles & Payroll Management</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">Manage employee access PINs, cash counter assignments, monthly wages, and payslips</p>
        </div>

        {/* Tab Switcher & Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="bg-slate-100 p-1 rounded-xl flex space-x-1 border border-slate-200">
            <button
              onClick={() => setActiveSubTab('employees')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeSubTab === 'employees' ? 'bg-white text-[#0f6cbd] shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              👥 Staff Directory
            </button>
            <button
              onClick={() => setActiveSubTab('payroll')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeSubTab === 'payroll' ? 'bg-white text-[#0f6cbd] shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              💵 Payroll & Wages
            </button>
          </div>

          {activeSubTab === 'employees' ? (
            <button
              onClick={() => setShowAddModal(true)}
              className="px-3.5 py-2 bg-[#0f6cbd] hover:bg-[#115ea3] text-white font-bold rounded-xl text-xs flex items-center space-x-1.5 transition shadow-xs cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>Add Staff</span>
            </button>
          ) : (
            <button
              onClick={() => setShowPayrollModal(true)}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center space-x-1.5 transition shadow-xs cursor-pointer"
            >
              <Calculator className="w-4 h-4" />
              <span>Calculate Payroll</span>
            </button>
          )}
        </div>
      </div>

      {/* Staff Directory Tab */}
      {activeSubTab === 'employees' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800">Store Personnel Directory ({employees.length})</h3>
            <span className="text-xs text-slate-400">Default Terminal PIN: 123456</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[650px]">
              <thead className="bg-slate-50 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="p-3">Employee Name</th>
                  <th className="p-3">Role & Dept</th>
                  <th className="p-3">Assigned Branch</th>
                  <th className="p-3">Work Shift</th>
                  <th className="p-3">Security PIN</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                {employees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-50">
                    <td className="p-3 font-bold font-sans text-slate-900">
                      <div>{emp.name}</div>
                      <div className="text-[10px] text-slate-400 font-normal">@{emp.username}</div>
                    </td>
                    <td className="p-3 font-sans">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        emp?.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                      }`}>
                        {((emp && emp.role) || 'staff').toUpperCase()}
                      </span>
                      <div className="text-[10px] text-slate-500 mt-0.5">{emp.department}</div>
                    </td>
                    <td className="p-3 font-sans text-slate-700">{emp.assigned_branch}</td>
                    <td className="p-3 font-sans text-slate-600">{emp.shift}</td>
                    <td className="p-3 font-mono font-bold text-slate-800">**** ({emp.pin})</td>
                    <td className="p-3 text-center font-sans">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        emp.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}>
                        {emp.status}
                      </span>
                    </td>
                    <td className="p-3 text-center font-sans">
                      <button
                        onClick={() => toggleStatus(emp.id)}
                        className={`px-2.5 py-1 text-[10px] font-bold rounded-lg transition cursor-pointer ${
                          emp.status === 'ACTIVE' ? 'bg-rose-100 hover:bg-rose-200 text-rose-800' : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800'
                        }`}
                      >
                        {emp.status === 'ACTIVE' ? 'Suspend Access' : 'Activate Access'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Payroll Management Tab */}
      {activeSubTab === 'payroll' && (
        <div className="space-y-4">
          
          {/* Quick Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs text-slate-500 font-bold uppercase tracking-wider block">Total Monthly Payroll</span>
              <span className="text-xl font-black text-slate-900 mt-1 block">
                Rs. {payrolls.reduce((a, b) => a + b.net_salary, 0).toLocaleString()}
              </span>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs text-emerald-600 font-bold uppercase tracking-wider block">Disbursed Wages</span>
              <span className="text-xl font-black text-emerald-700 mt-1 block">
                Rs. {payrolls.filter(p => p.status === 'PAID').reduce((a, b) => a + b.net_salary, 0).toLocaleString()}
              </span>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs text-amber-600 font-bold uppercase tracking-wider block">Pending Disbursal</span>
              <span className="text-xl font-black text-amber-700 mt-1 block">
                Rs. {payrolls.filter(p => p.status === 'PENDING').reduce((a, b) => a + b.net_salary, 0).toLocaleString()}
              </span>
            </div>
          </div>

          {/* Payroll Records Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800">Monthly Payroll Ledger</h3>
              <span className="text-xs text-slate-500">Period: Current Cycle</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[750px]">
                <thead className="bg-slate-50 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="p-3">Staff Member</th>
                    <th className="p-3">Cycle</th>
                    <th className="p-3 text-right">Base Salary</th>
                    <th className="p-3 text-center">Attendance</th>
                    <th className="p-3 text-right">Overtime & Comm.</th>
                    <th className="p-3 text-right">Net Payable</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3 text-center">Payslip</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                  {payrolls.map((pay) => (
                    <tr key={pay.id} className="hover:bg-slate-50">
                      <td className="p-3 font-bold font-sans text-slate-900">
                        {pay.employee_name}
                      </td>
                      <td className="p-3 font-sans text-slate-600">{pay.month}</td>
                      <td className="p-3 text-right font-bold text-slate-800">Rs. {pay.base_salary.toLocaleString()}</td>
                      <td className="p-3 text-center font-sans">
                        <span className="px-2 py-0.5 bg-slate-100 rounded text-slate-700 font-bold text-[10px]">
                          {pay.present_days} / {pay.working_days} Days
                        </span>
                      </td>
                      <td className="p-3 text-right text-emerald-700 font-bold">
                        + Rs. {(pay.overtime_hours * pay.overtime_rate + pay.commission_amount).toLocaleString()}
                      </td>
                      <td className="p-3 text-right font-black text-slate-900 text-xs">
                        Rs. {pay.net_salary.toLocaleString()}
                      </td>
                      <td className="p-3 text-center font-sans">
                        {pay.status === 'PAID' ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            PAID
                          </span>
                        ) : (
                          <button
                            onClick={() => markPaid(pay.id)}
                            className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 hover:bg-amber-200 text-amber-800 cursor-pointer transition"
                          >
                            Mark Paid
                          </button>
                        )}
                      </td>
                      <td className="p-3 text-center font-sans">
                        <button
                          onClick={() => setSelectedPaySlip(pay)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold flex items-center justify-center space-x-1 mx-auto transition cursor-pointer"
                        >
                          <FileText className="w-3 h-3 text-[#0f6cbd]" />
                          <span>View Slip</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* Add Employee Modal (Fully responsive & vertically scrollable) */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[calc(100vh-2rem)] flex flex-col my-auto shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-[#0f6cbd] p-4 text-white flex justify-between items-center shrink-0">
              <h3 className="font-bold text-sm">Register New Store Employee</h3>
              <button onClick={() => setShowAddModal(false)} className="text-white/80 hover:text-white font-bold cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleAddEmployee} className="p-4 sm:p-5 space-y-3 text-xs overflow-y-auto flex-1">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={newEmp.name || ''}
                  onChange={(e) => setNewEmp({ ...newEmp, name: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl"
                  placeholder="e.g. Sara Ali"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">POS Username *</label>
                <input
                  type="text"
                  required
                  value={newEmp.username || ''}
                  onChange={(e) => setNewEmp({ ...newEmp, username: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono"
                  placeholder="e.g. cashier_sara"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Role</label>
                  <select
                    value={newEmp.role}
                    onChange={(e) => setNewEmp({ ...newEmp, role: e.target.value as any })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl"
                  >
                    <option value="cashier">Cashier</option>
                    <option value="manager">Manager</option>
                    <option value="admin">Admin / Owner</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Security PIN *</label>
                  <input
                    type="password"
                    maxLength={6}
                    required
                    value={newEmp.pin || ''}
                    onChange={(e) => setNewEmp({ ...newEmp, pin: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono text-center font-bold"
                    placeholder="4-6 digit PIN"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Department</label>
                <input
                  type="text"
                  value={newEmp.department || ''}
                  onChange={(e) => setNewEmp({ ...newEmp, department: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl"
                  placeholder="e.g. Makeup Counter 1"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Assigned Branch Outlet</label>
                <input
                  type="text"
                  value={newEmp.assigned_branch || ''}
                  onChange={(e) => setNewEmp({ ...newEmp, assigned_branch: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl"
                  placeholder="e.g. Gulberg Main Flagship"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Phone Number</label>
                <input
                  type="text"
                  value={newEmp.phone || ''}
                  onChange={(e) => setNewEmp({ ...newEmp, phone: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl"
                  placeholder="0300-XXXXXXX"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3.5 py-2 bg-slate-100 font-bold rounded-xl text-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#0f6cbd] text-white font-bold rounded-xl shadow-xs cursor-pointer"
                >
                  Save Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Calculate Payroll Modal (Fully responsive & vertically scrollable) */}
      {showPayrollModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[calc(100vh-2rem)] flex flex-col my-auto shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-emerald-700 p-4 text-white flex justify-between items-center shrink-0">
              <h3 className="font-bold text-sm flex items-center space-x-1.5">
                <Calculator className="w-4 h-4" />
                <span>Calculate & Generate Staff Payroll</span>
              </h3>
              <button onClick={() => setShowPayrollModal(false)} className="text-white/80 hover:text-white font-bold cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleCreatePayroll} className="p-4 sm:p-5 space-y-3 text-xs overflow-y-auto flex-1">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Select Employee *</label>
                <select
                  value={newPayroll.employee_id}
                  onChange={(e) => setNewPayroll({ ...newPayroll, employee_id: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-800"
                >
                  {(employees || []).filter(Boolean).map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.name} ({((emp && emp.role) || 'staff').toUpperCase()})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Month / Cycle</label>
                  <input
                    type="text"
                    required
                    value={newPayroll.month}
                    onChange={(e) => setNewPayroll({ ...newPayroll, month: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Base Salary (Rs.) *</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={newPayroll.base_salary}
                    onChange={(e) => setNewPayroll({ ...newPayroll, base_salary: Number(e.target.value) })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Working Days</label>
                  <input
                    type="number"
                    min="1"
                    value={newPayroll.working_days}
                    onChange={(e) => setNewPayroll({ ...newPayroll, working_days: Number(e.target.value) })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Present Days</label>
                  <input
                    type="number"
                    min="0"
                    value={newPayroll.present_days}
                    onChange={(e) => setNewPayroll({ ...newPayroll, present_days: Number(e.target.value) })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Overtime (Hours)</label>
                  <input
                    type="number"
                    min="0"
                    value={newPayroll.overtime_hours}
                    onChange={(e) => setNewPayroll({ ...newPayroll, overtime_hours: Number(e.target.value) })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">OT Rate / Hr (Rs.)</label>
                  <input
                    type="number"
                    min="0"
                    value={newPayroll.overtime_rate}
                    onChange={(e) => setNewPayroll({ ...newPayroll, overtime_rate: Number(e.target.value) })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Commission / Bonus (Rs.)</label>
                  <input
                    type="number"
                    min="0"
                    value={newPayroll.commission_amount}
                    onChange={(e) => setNewPayroll({ ...newPayroll, commission_amount: Number(e.target.value) })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Deductions / Advances (Rs.)</label>
                  <input
                    type="number"
                    min="0"
                    value={newPayroll.deductions}
                    onChange={(e) => setNewPayroll({ ...newPayroll, deductions: Number(e.target.value) })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              {/* Net preview */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 font-bold flex justify-between items-center">
                <span>Calculated Net Disbursable:</span>
                <span className="text-emerald-700 font-black text-sm">
                  Rs. {(
                    (newPayroll.working_days > 0 ? (newPayroll.base_salary / newPayroll.working_days) * newPayroll.present_days : 0) +
                    (newPayroll.overtime_hours * newPayroll.overtime_rate) +
                    newPayroll.commission_amount -
                    newPayroll.deductions
                  ).toLocaleString()}
                </span>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowPayrollModal(false)}
                  className="px-3.5 py-2 bg-slate-100 font-bold rounded-xl text-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs cursor-pointer"
                >
                  Generate Payroll Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pay Slip View Modal */}
      {selectedPaySlip && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-sm w-full max-h-[calc(100vh-2rem)] flex flex-col my-auto shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 p-4 text-white flex justify-between items-center shrink-0">
              <span className="font-bold text-xs uppercase tracking-wider">Official Staff Payslip</span>
              <button onClick={() => setSelectedPaySlip(null)} className="text-white/80 hover:text-white font-bold cursor-pointer">✕</button>
            </div>

            <div className="p-5 font-mono text-xs text-slate-800 space-y-3 overflow-y-auto flex-1 bg-slate-50">
              <div className="text-center border-b pb-2">
                <h4 className="font-black text-sm uppercase">Bloom & Carry Cosmetics</h4>
                <p className="text-[10px] text-slate-500">Employee Salary Slip — {selectedPaySlip.month}</p>
              </div>

              <div className="space-y-1 text-[11px] border-b pb-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">Staff Name:</span>
                  <span className="font-bold">{selectedPaySlip.employee_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Status:</span>
                  <span className="font-bold text-emerald-700">{selectedPaySlip.status}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Payment Channel:</span>
                  <span>{selectedPaySlip.payment_method || 'Cash'}</span>
                </div>
              </div>

              <div className="space-y-1.5 text-[11px] border-b pb-2">
                <div className="flex justify-between">
                  <span>Basic Salary:</span>
                  <span>Rs. {selectedPaySlip.base_salary.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Present Days:</span>
                  <span>{selectedPaySlip.present_days} / {selectedPaySlip.working_days}</span>
                </div>
                {selectedPaySlip.overtime_hours > 0 && (
                  <div className="flex justify-between text-emerald-700">
                    <span>Overtime ({selectedPaySlip.overtime_hours} hrs):</span>
                    <span>+ Rs. {(selectedPaySlip.overtime_hours * selectedPaySlip.overtime_rate).toLocaleString()}</span>
                  </div>
                )}
                {selectedPaySlip.commission_amount > 0 && (
                  <div className="flex justify-between text-emerald-700">
                    <span>Sales Commission:</span>
                    <span>+ Rs. {selectedPaySlip.commission_amount.toLocaleString()}</span>
                  </div>
                )}
                {selectedPaySlip.deductions > 0 && (
                  <div className="flex justify-between text-rose-600">
                    <span>Deductions / Advances:</span>
                    <span>- Rs. {selectedPaySlip.deductions.toLocaleString()}</span>
                  </div>
                )}
              </div>

              <div className="flex justify-between items-baseline pt-1 font-bold text-sm text-slate-900 font-sans">
                <span>Net Disbursed:</span>
                <span className="text-base font-black text-emerald-700 font-mono">
                  Rs. {selectedPaySlip.net_salary.toLocaleString()}
                </span>
              </div>
            </div>

            <div className="p-3 bg-slate-100 border-t flex space-x-2 shrink-0">
              <button
                onClick={() => window.print()}
                className="flex-1 py-2 bg-[#0f6cbd] hover:bg-[#115ea3] text-white font-bold rounded-xl text-xs flex items-center justify-center space-x-1 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Payslip</span>
              </button>
              <button
                onClick={() => setSelectedPaySlip(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};


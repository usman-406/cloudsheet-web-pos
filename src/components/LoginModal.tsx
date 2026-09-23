import React, { useState } from 'react';
import { User } from '../types';
import { ShieldCheck, UserCheck, KeyRound, Store, Eye, EyeOff, Lock } from 'lucide-react';

interface LoginModalProps {
  users: User[];
  onLogin: (user: User) => void;
  shopName: string;
}

export const LoginModal: React.FC<LoginModalProps> = ({ users, onLogin, shopName }) => {
  const [selectedUserId, setSelectedUserId] = useState<string>(users[0]?.id || '');
  const [pin, setPin] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const selectedUser = users.find(u => u.id === selectedUserId) || users[0];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    if (!pin.trim()) {
      setError('Please enter your account password.');
      return;
    }
    
    // Check password/pin against user account
    if (selectedUser.pin && selectedUser.pin !== pin) {
      setError(`Incorrect password for ${selectedUser.name}. Please try again.`);
      return;
    }

    setError('');
    onLogin(selectedUser);
  };

  return (
    <div id="login-modal-overlay" className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 font-sans overflow-y-auto">
      <div id="login-modal-card" className="bg-white rounded-2xl shadow-2xl w-full max-w-md my-auto max-h-[calc(100vh-2rem)] flex flex-col overflow-hidden border border-slate-200">
        
        {/* Header */}
        <div className="bg-[#0f6cbd] p-4 sm:p-5 text-white text-center relative shrink-0">
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white text-[#0f6cbd] rounded-xl mx-auto flex items-center justify-center mb-2 shadow-xs border border-white/20">
            <Store className="w-5 h-5 sm:w-6 sm:h-6 text-[#0f6cbd]" />
          </div>
          <h2 className="text-base sm:text-lg font-bold">{shopName || 'BoomandCarry Cosmetics'}</h2>
          <p className="text-xs text-blue-100 mt-0.5">Select user account and authenticate to access POS terminal</p>
        </div>

        {/* Form Body with Scroll */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
          
          {error && (
            <div id="login-error-alert" className="bg-rose-50 text-rose-800 text-xs p-3 rounded-xl border border-rose-200 font-medium flex items-center space-x-2">
              <Lock className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* User Role Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Select User Account
            </label>
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
              {(users || []).filter(u => Boolean(u && typeof u === 'object')).map((u) => {
                const isSelected = u.id === selectedUserId;
                const isAdmin = u?.role === 'admin';
                const Icon = isAdmin ? ShieldCheck : UserCheck;

                return (
                  <button
                    key={u.id}
                    id={`login-user-btn-${u.id}`}
                    type="button"
                    onClick={() => {
                      setSelectedUserId(u.id);
                      setPin('');
                      setError('');
                    }}
                    className={`p-3 rounded-xl border text-left flex flex-col items-center justify-center transition cursor-pointer ${
                      isSelected
                        ? 'border-[#0f6cbd] bg-blue-50/80 text-[#0f6cbd] shadow-xs ring-1 ring-[#0f6cbd]'
                        : 'border-slate-200 hover:border-slate-300 text-slate-600 bg-slate-50/50'
                    }`}
                  >
                    <Icon className={`w-5 h-5 mb-1 ${isSelected ? 'text-[#0f6cbd]' : 'text-slate-400'}`} />
                    <span className="font-bold text-xs leading-tight text-center text-slate-900">{u.name}</span>
                    <span className={`text-[10px] uppercase font-bold mt-1 px-1.5 py-0.5 rounded ${
                      isAdmin ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                    }`}>
                      {u?.role || 'staff'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* PIN / Password Input */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Account Password
              </label>
              <span className="text-[11px] text-slate-400">
                {selectedUser?.role === 'admin' ? 'Manager Credentials' : 'Staff Credentials'}
              </span>
            </div>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="login-password-input"
                type={showPassword ? 'text' : 'password'}
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value);
                  if (error) setError('');
                }}
                placeholder={selectedUser?.role === 'admin' ? 'Enter Admin Password' : 'Enter Cashier Password'}
                className="w-full pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-[#0f6cbd] focus:outline-none font-sans"
                required
                autoFocus
              />
              <button
                id="login-toggle-password-btn"
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition p-0.5 cursor-pointer"
                title={showPassword ? 'Hide Password' : 'Show Password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <button
              id="login-submit-btn"
              type="submit"
              className="w-full py-2.5 bg-[#0f6cbd] hover:bg-[#115ea3] text-white font-bold rounded-xl shadow-xs transition text-xs sm:text-sm flex items-center justify-center space-x-2 cursor-pointer active:scale-98"
            >
              <span>Access POS Terminal</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};

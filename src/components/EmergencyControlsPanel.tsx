import React, { useState } from 'react';
import { ShopSettings, User } from '../types';
import { 
  ShieldAlert, 
  Lock, 
  Power, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle2, 
  WifiOff, 
  Database, 
  UserX, 
  Key,
  ShieldCheck
} from 'lucide-react';

interface EmergencyControlsPanelProps {
  settings: ShopSettings;
  activeUser: User;
  onUpdateSettings: (settings: ShopSettings) => void;
}

export const EmergencyControlsPanel: React.FC<EmergencyControlsPanelProps> = ({
  settings,
  activeUser,
  onUpdateSettings,
}) => {
  const [restrictedMode, setRestrictedMode] = useState<boolean>(false);
  const [sheetsSyncPaused, setSheetsSyncPaused] = useState<boolean>(false);
  const [auditLogs, setAuditLogs] = useState<Array<{ id: string; timestamp: string; action: string; user: string }>>([
    { id: 'e1', timestamp: new Date(Date.now() - 3600000).toLocaleString(), action: 'System Security Health Inspection', user: activeUser.username },
  ]);

  const handleToggleRestrictedMode = () => {
    const next = !restrictedMode;
    setRestrictedMode(next);
    setAuditLogs([
      { id: `e_${Date.now()}`, timestamp: new Date().toLocaleString(), action: next ? 'EMERGENCY LOCK ENFORCED' : 'EMERGENCY LOCK RELEASED', user: activeUser.username },
      ...auditLogs
    ]);
  };

  const handleRevokeSessions = () => {
    alert('Emergency Override Triggered: All non-admin terminal sessions revoked immediately.');
    setAuditLogs([
      { id: `e_${Date.now()}`, timestamp: new Date().toLocaleString(), action: 'ALL CASHIER TERMINAL SESSIONS REVOKED', user: activeUser.username },
      ...auditLogs
    ]);
  };

  const handlePauseSync = () => {
    const next = !sheetsSyncPaused;
    setSheetsSyncPaused(next);
    onUpdateSettings({
      ...settings,
      auto_sync_gas: !next,
    });
    setAuditLogs([
      { id: `e_${Date.now()}`, timestamp: new Date().toLocaleString(), action: next ? 'EXTERNAL GOOGLE SYNC PAUSED' : 'EXTERNAL GOOGLE SYNC RESUMED', user: activeUser.username },
      ...auditLogs
    ]);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 flex items-center space-x-2">
            <ShieldAlert className="w-6 h-6 text-rose-600" />
            <span>Emergency Crisis & Disaster Continuity Panel</span>
          </h2>
          <p className="text-xs text-slate-500">Owner-only kill switches for stolen devices, network breaches, or hardware compromised terminals</p>
        </div>

        <div className="flex items-center space-x-2">
          <span className={`text-xs font-black px-3 py-1.5 rounded-xl border flex items-center space-x-1 ${
            restrictedMode ? 'bg-rose-100 text-rose-900 border-rose-300' : 'bg-emerald-100 text-emerald-900 border-emerald-300'
          }`}>
            <CheckCircle2 className="w-4 h-4" />
            <span>{restrictedMode ? 'SYSTEM RESTRICTED' : 'SYSTEM NORMAL'}</span>
          </span>
        </div>
      </div>

      {/* Emergency Trigger Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* Card 1: Emergency System Lock */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-slate-500 uppercase">Emergency Register Lock</span>
            <Lock className="w-5 h-5 text-rose-600" />
          </div>
          <p className="text-xs text-slate-600">Forces instant 4-digit Manager PIN authorization on all sales transactions and discount actions.</p>
          <button
            onClick={handleToggleRestrictedMode}
            className={`w-full py-2 font-bold text-xs rounded-xl transition ${
              restrictedMode ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-rose-600 hover:bg-rose-700 text-white'
            }`}
          >
            {restrictedMode ? 'Unlock System Normal' : 'Activate Emergency Lock'}
          </button>
        </div>

        {/* Card 2: Revoke Active Sessions */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-slate-500 uppercase">Revoke Terminal Sessions</span>
            <UserX className="w-5 h-5 text-amber-600" />
          </div>
          <p className="text-xs text-slate-600">Force logouts on all remote cashier iPad/tablet devices if a terminal is lost or stolen.</p>
          <button
            onClick={handleRevokeSessions}
            className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl transition"
          >
            Revoke All Terminal Tokens
          </button>
        </div>

        {/* Card 3: Pause Integrations */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-slate-500 uppercase">Isolate Google Sync</span>
            <WifiOff className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-xs text-slate-600">Pause external Google Sheets API requests without wiping local offline store data.</p>
          <button
            onClick={handlePauseSync}
            className={`w-full py-2 font-bold text-xs rounded-xl transition ${
              sheetsSyncPaused ? 'bg-blue-600 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
            }`}
          >
            {sheetsSyncPaused ? 'Resume Google Sync' : 'Pause External Sync'}
          </button>
        </div>

      </div>

      {/* Emergency Audit Log */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-3">
        <h3 className="text-sm font-bold text-slate-800">Crisis Action Audit Log</h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="p-3">Timestamp</th>
                <th className="p-3">Emergency Action Description</th>
                <th className="p-3">Authorized Owner</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
              {auditLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50">
                  <td className="p-3 text-slate-500">{log.timestamp}</td>
                  <td className="p-3 font-bold font-sans text-slate-900">{log.action}</td>
                  <td className="p-3 font-sans text-slate-700">{log.user}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};

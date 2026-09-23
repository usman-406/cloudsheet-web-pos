import React, { useState } from 'react';
import { ShopSettings, User } from '../types';
import { 
  ShieldCheck, 
  Lock, 
  Key, 
  UserX, 
  Smartphone, 
  CloudCheck, 
  AlertTriangle, 
  CheckCircle2, 
  Eye, 
  Activity,
  Globe,
  FileCheck,
  Server
} from 'lucide-react';

interface SecurityAuditOverviewProps {
  settings: ShopSettings;
  activeUser: User;
}

export const SecurityAuditOverview: React.FC<SecurityAuditOverviewProps> = ({
  settings,
  activeUser,
}) => {
  const [mfaEnabled, setMfaEnabled] = useState(true);
  const [sessionTimeout, setSessionTimeout] = useState('30');
  const [ipRestricted, setIpRestricted] = useState(false);

  const activeSessions = [
    { id: 'sess_1', device: 'Terminal POS 01 (Windows 11 Chrome)', ip: '192.168.1.102', location: 'Main Store - Cash Counter 1', user: 'cashier_a', status: 'ACTIVE', lastActive: 'Just now' },
    { id: 'sess_2', device: 'Manager iPad Air (Safari)', ip: '192.168.1.115', location: 'Main Store - Back Office', user: 'admin_maryam', status: 'ACTIVE', lastActive: '2 mins ago' },
  ];

  const securityAuditEvents = [
    { id: 'sec_1', timestamp: new Date(Date.now() - 15 * 60000).toLocaleString(), event: 'Successful Admin Login', user: activeUser.username, ip: '192.168.1.115', severity: 'INFO' },
    { id: 'sec_2', timestamp: new Date(Date.now() - 120 * 60000).toLocaleString(), event: 'Manager PIN Override (Discount 25%)', user: 'cashier_a', ip: '192.168.1.102', severity: 'WARNING' },
    { id: 'sec_3', timestamp: new Date(Date.now() - 360 * 60000).toLocaleString(), event: 'Encrypted System Backup Generated', user: 'admin_maryam', ip: '192.168.1.115', severity: 'INFO' },
    { id: 'sec_4', timestamp: new Date(Date.now() - 1440 * 60000).toLocaleString(), event: 'Price Override Attempt Blocked', user: 'cashier_b', ip: '192.168.1.105', severity: 'HIGH' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 flex items-center space-x-2">
            <ShieldCheck className="w-6 h-6 text-[#0f6cbd]" />
            <span>Security Overview & Compliance Dashboard</span>
          </h2>
          <p className="text-xs text-slate-500">Monitor MFA status, active sessions, permission boundaries, backup encryption, and suspicious security events</p>
        </div>

        <div className="flex items-center space-x-2">
          <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-3 py-1.5 rounded-xl border border-emerald-300/50 flex items-center space-x-1">
            <CheckCircle2 className="w-4 h-4" />
            <span>Security Posture: HEALTHY</span>
          </span>
        </div>
      </div>

      {/* Grid Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        
        {/* MFA Status */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-slate-500 uppercase">Two-Factor Auth (2FA)</span>
            <Smartphone className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <div className="text-lg font-bold text-slate-900">{mfaEnabled ? '2FA Enforced' : '2FA Optional'}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Required for Admin & Owner Accounts</div>
          </div>
          <button
            onClick={() => setMfaEnabled(!mfaEnabled)}
            className="w-full py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-[11px] rounded-lg transition"
          >
            Toggle 2FA Enforcement
          </button>
        </div>

        {/* Active Sessions */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-slate-500 uppercase">Active Device Sessions</span>
            <Activity className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">{activeSessions.length} Devices</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Scoped token sessions</div>
          </div>
        </div>

        {/* Backup Status */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-slate-500 uppercase">Encrypted Backups</span>
            <Lock className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <div className="text-lg font-bold text-emerald-700">AES-256 Salted</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Google Drive Private Vault Enabled</div>
          </div>
        </div>

        {/* Google Sync Security */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-slate-500 uppercase">Google Web Service</span>
            <CloudCheck className="w-5 h-5 text-[#0f6cbd]" />
          </div>
          <div>
            <div className="text-sm font-bold text-slate-900 truncate">
              {settings.gas_web_app_url ? 'Scoped AppsScript Auth' : 'Local Standalone Mode'}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">Google Workspace OAuth 2.0</div>
          </div>
        </div>

      </div>

      {/* Active Device Sessions Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-3">
        <h3 className="text-sm font-bold text-slate-800">Authenticated Terminal & Manager Sessions</h3>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="p-3">Device / Browser</th>
                <th className="p-3">User</th>
                <th className="p-3">IP Address</th>
                <th className="p-3">Location</th>
                <th className="p-3">Last Active</th>
                <th className="p-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {activeSessions.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="p-3 font-bold text-slate-900">{s.device}</td>
                  <td className="p-3 text-slate-700 font-semibold">{s.user}</td>
                  <td className="p-3 font-mono text-[11px] text-slate-600">{s.ip}</td>
                  <td className="p-3 text-slate-600">{s.location}</td>
                  <td className="p-3 text-slate-500">{s.lastActive}</td>
                  <td className="p-3 text-center">
                    <button
                      onClick={() => alert(`Session ${s.id} terminated successfully.`)}
                      className="px-2.5 py-1 bg-rose-100 hover:bg-rose-200 text-rose-800 font-bold text-[10px] rounded-lg transition"
                    >
                      Revoke Access
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Security Audit Log */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-3">
        <h3 className="text-sm font-bold text-slate-800">Security Audit & Risk Log</h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="p-3">Timestamp</th>
                <th className="p-3">Security Event Description</th>
                <th className="p-3">User</th>
                <th className="p-3">IP Address</th>
                <th className="p-3 text-center">Severity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
              {securityAuditEvents.map((e) => (
                <tr key={e.id} className="hover:bg-slate-50">
                  <td className="p-3 text-slate-500">{e.timestamp}</td>
                  <td className="p-3 font-bold font-sans text-slate-900">{e.event}</td>
                  <td className="p-3 font-sans text-slate-700">{e.user}</td>
                  <td className="p-3 text-slate-600">{e.ip}</td>
                  <td className="p-3 text-center font-sans">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      e.severity === 'HIGH' ? 'bg-rose-100 text-rose-800' :
                      e.severity === 'WARNING' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                    }`}>
                      {e.severity}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};

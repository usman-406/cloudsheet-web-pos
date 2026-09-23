import React, { useState, useEffect } from 'react';
import { 
  Printer, 
  Barcode, 
  CreditCard, 
  Scale, 
  Cpu, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  RefreshCw, 
  SlidersHorizontal,
  FolderLock
} from 'lucide-react';
import { HardwareManager } from '../services/hardwareManager';
import { DeviceStatus, HardwareJob } from '../types';

interface HardwareStatusHeaderBarProps {
  onOpenDiagnostics: () => void;
  onOpenLedger?: () => void;
}

export const HardwareStatusHeaderBar: React.FC<HardwareStatusHeaderBarProps> = ({
  onOpenDiagnostics,
  onOpenLedger,
}) => {
  const [statuses, setStatuses] = useState<DeviceStatus[]>([]);
  const [jobs, setJobs] = useState<HardwareJob[]>([]);

  useEffect(() => {
    const hw = HardwareManager.getInstance();
    const unsubscribe = hw.subscribe((newStatuses, newJobs) => {
      setStatuses(newStatuses);
      setJobs(newJobs);
    });
    return unsubscribe;
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'online':
        return <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>;
      case 'busy':
        return <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>;
      case 'error':
        return <span className="w-2 h-2 rounded-full bg-red-500"></span>;
      default:
        return <span className="w-2 h-2 rounded-full bg-slate-400"></span>;
    }
  };

  const activeJobsCount = jobs.filter(j => j.status === 'pending' || j.status === 'processing').length;

  return (
    <div className="bg-slate-900 text-slate-200 text-xs py-1.5 px-4 border-b border-slate-800 flex items-center justify-between gap-4 overflow-x-auto select-none">
      
      {/* Left: Device Statuses */}
      <div className="flex items-center space-x-4 shrink-0">
        <div className="flex items-center space-x-1.5 text-blue-400 font-extrabold uppercase tracking-wider text-[10px]">
          <Cpu className="w-3.5 h-3.5 text-blue-400" />
          <span>Hardware Hub</span>
        </div>

        <div className="h-3 w-px bg-slate-700"></div>

        {/* Printer */}
        {statuses.find(s => s.device === 'printer') && (
          <div className="flex items-center space-x-1.5 font-medium text-slate-300">
            <Printer className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-[11px]">POS-80 (80mm USB)</span>
            {getStatusBadge(statuses.find(s => s.device === 'printer')?.status || 'offline')}
          </div>
        )}

        {/* Scanner */}
        {statuses.find(s => s.device === 'scanner') && (
          <div className="flex items-center space-x-1.5 font-medium text-slate-300">
            <Barcode className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-[11px]">Scanner (Active)</span>
            {getStatusBadge(statuses.find(s => s.device === 'scanner')?.status || 'offline')}
          </div>
        )}

        {/* Card Terminal */}
        {statuses.find(s => s.device === 'card_terminal') && (
          <div className="flex items-center space-x-1.5 font-medium text-slate-300">
            <CreditCard className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-[11px]">Card Terminal</span>
            {getStatusBadge(statuses.find(s => s.device === 'card_terminal')?.status || 'offline')}
          </div>
        )}

        {/* Scale */}
        {statuses.find(s => s.device === 'scale') && (
          <div className="flex items-center space-x-1.5 font-medium text-slate-300">
            <Scale className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-[11px]">Digital Scale</span>
            {getStatusBadge(statuses.find(s => s.device === 'scale')?.status || 'offline')}
          </div>
        )}
      </div>

      {/* Right: Active I/O Queue & Diagnostics Button */}
      <div className="flex items-center space-x-3 shrink-0">
        {activeJobsCount > 0 && (
          <div className="flex items-center space-x-1.5 bg-amber-500/20 text-amber-300 px-2.5 py-0.5 rounded-full border border-amber-500/30 font-bold text-[10px]">
            <RefreshCw className="w-3 h-3 animate-spin" />
            <span>I/O Queue: {activeJobsCount} Active</span>
          </div>
        )}

        {onOpenLedger && (
          <button
            onClick={onOpenLedger}
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-blue-300 font-bold rounded-lg text-[11px] border border-slate-700 flex items-center space-x-1 transition"
          >
            <FolderLock className="w-3 h-3 text-blue-400" />
            <span>Stock Ledger</span>
          </button>
        )}

        <button
          onClick={onOpenDiagnostics}
          className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-[11px] shadow-xs flex items-center space-x-1 transition"
        >
          <SlidersHorizontal className="w-3 h-3" />
          <span>Hardware Diagnostics</span>
        </button>
      </div>

    </div>
  );
};

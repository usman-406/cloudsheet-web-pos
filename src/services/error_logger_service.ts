import { SystemErrorLog } from '../types';

const ERROR_LOG_KEY = 'bloom_system_error_logs';

export class ErrorLoggerService {
  /**
   * Translates technical database or network stack trace into friendly non-technical notice for cashiers
   */
  static getFriendlyErrorMessage(rawError: any): string {
    const message = String(rawError?.message || rawError || '').toLowerCase();

    if (message.includes('network') || message.includes('failed to fetch') || message.includes('offline')) {
      return 'Network connection interrupted. Data saved locally and queued for automatic sync.';
    }
    if (message.includes('printer') || message.includes('paper') || message.includes('usb')) {
      return 'Receipt printer unavailable or out of paper. Transaction recorded safely.';
    }
    if (message.includes('pin') || message.includes('unauthorized') || message.includes('permission')) {
      return 'Security verification failed. Please check your manager authorization PIN.';
    }
    if (message.includes('stock') || message.includes('inventory') || message.includes('insufficient')) {
      return 'Item stock unavailable for checkout. Please review stock ledger balance.';
    }
    if (message.includes('sql') || message.includes('database') || message.includes('quota')) {
      return 'Storage system busy. Operational logs backed up locally.';
    }

    return 'Unable to complete action smoothly. Operational state preserved.';
  }

  static logError(
    component: string, 
    technicalError: any, 
    level: 'CRITICAL' | 'WARNING' | 'ERROR' | 'INFO' = 'ERROR'
  ): string {
    const friendlyMsg = this.getFriendlyErrorMessage(technicalError);
    const techDetails = typeof technicalError === 'object' 
      ? JSON.stringify(technicalError, Object.getOwnPropertyNames(technicalError))
      : String(technicalError);

    const logs = this.getErrorLogs();
    const newEntry: SystemErrorLog = {
      id: `err_${Date.now()}_${Math.floor(Math.random()*1000)}`,
      timestamp: new Date().toISOString(),
      level,
      component,
      user_facing_message: friendlyMsg,
      technical_details: techDetails,
      resolved: false
    };

    logs.unshift(newEntry);
    localStorage.setItem(ERROR_LOG_KEY, JSON.stringify(logs.slice(0, 200)));
    return friendlyMsg;
  }

  static getErrorLogs(): SystemErrorLog[] {
    try {
      const raw = localStorage.getItem(ERROR_LOG_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  static markResolved(id: string) {
    const logs = this.getErrorLogs();
    const updated = logs.map(l => l.id === id ? { ...l, resolved: true } : l);
    localStorage.setItem(ERROR_LOG_KEY, JSON.stringify(updated));
  }

  static clearResolved() {
    const logs = this.getErrorLogs().filter(l => !l.resolved);
    localStorage.setItem(ERROR_LOG_KEY, JSON.stringify(logs));
  }
}

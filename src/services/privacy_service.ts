import { Customer } from '../types';

const CUSTOMERS_KEY = 'bloom_customers';

export class PrivacyService {
  /**
   * Anonymizes customer PII without destroying historical transaction ledgers
   */
  static anonymizeCustomer(customerId: string): boolean {
    try {
      const raw = localStorage.getItem(CUSTOMERS_KEY);
      if (!raw) return false;
      
      const customers: Customer[] = JSON.parse(raw);
      const index = customers.findIndex(c => c.id === customerId);
      
      if (index === -1) return false;

      const c = customers[index];
      const anonCode = Math.floor(1000 + Math.random() * 9000);

      const anonymizedCustomer: Customer = {
        ...c,
        name: `Anonymized Customer #${anonCode}`,
        phone: '0300-XXXXXXX',
        email: `privacy_deleted_${c.id}@anonymized.local`,
        address: '[REDACTED FOR PRIVACY]',
        notes: '[PRIVACY REQUEST FULFILLED - PERSONAL DATA PURGED]',
        points_history: []
      };

      customers[index] = anonymizedCustomer;
      localStorage.setItem(CUSTOMERS_KEY, JSON.stringify(customers));
      return true;
    } catch {
      return false;
    }
  }
}

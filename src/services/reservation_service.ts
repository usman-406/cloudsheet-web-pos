import { StockReservation, Product } from '../types';

const RESERVATIONS_KEY = 'bloom_stock_reservations';

export class ReservationService {
  static getReservations(): StockReservation[] {
    try {
      const raw = localStorage.getItem(RESERVATIONS_KEY);
      if (!raw) return this.getInitialReservations();
      return JSON.parse(raw);
    } catch {
      return this.getInitialReservations();
    }
  }

  static saveReservations(items: StockReservation[]) {
    localStorage.setItem(RESERVATIONS_KEY, JSON.stringify(items));
  }

  static getInitialReservations(): StockReservation[] {
    return [];
  }

  /**
   * Calculates total active reserved quantity for a specific product
   */
  static getReservedQuantityForProduct(productId: string): number {
    const now = new Date().toISOString();
    const all = this.getReservations();
    return all
      .filter(r => r.product_id === productId && r.status === 'ACTIVE' && r.expires_at > now)
      .reduce((sum, r) => sum + r.reserved_qty, 0);
  }

  /**
   * Returns net available stock (physical stock minus active reservations)
   */
  static getAvailableStock(product: Product): number {
    const reserved = this.getReservedQuantityForProduct(product.id);
    return Math.max(0, product.stock_qty - reserved);
  }

  /**
   * Auto-releases expired reservations
   */
  static purgeExpiredReservations(): number {
    const now = new Date().toISOString();
    const all = this.getReservations();
    let expiredCount = 0;

    const updated = all.map(r => {
      if (r.status === 'ACTIVE' && r.expires_at <= now) {
        expiredCount++;
        return { ...r, status: 'EXPIRED' as const };
      }
      return r;
    });

    if (expiredCount > 0) {
      this.saveReservations(updated);
    }
    return expiredCount;
  }

  /**
   * Creates a new order reservation with configurable expiry hours (default 24h)
   */
  static createReservation(
    orderId: string,
    channel: 'e-commerce' | 'phone' | 'manual_reserve',
    customerName: string,
    product: Product,
    qty: number,
    expiryHours: number = 24
  ): StockReservation {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + expiryHours * 60 * 60 * 1000).toISOString();

    const newRes: StockReservation = {
      id: `res_${Date.now()}_${Math.floor(Math.random()*1000)}`,
      order_id: orderId,
      channel,
      customer_name: customerName,
      product_id: product.id,
      product_name: product.name,
      barcode: product.barcode,
      reserved_qty: qty,
      reserved_at: now.toISOString(),
      expires_at: expiresAt,
      status: 'ACTIVE'
    };

    const all = this.getReservations();
    all.unshift(newRes);
    this.saveReservations(all);
    return newRes;
  }

  static updateReservationStatus(id: string, status: 'FULFILLED' | 'CANCELLED') {
    const all = this.getReservations();
    const updated = all.map(r => r.id === id ? { ...r, status } : r);
    this.saveReservations(updated);
  }
}

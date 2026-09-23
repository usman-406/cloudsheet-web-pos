import React, { useState, useEffect } from 'react';
import { ReservationService } from '../services/reservation_service';
import { StockReservation, Product, ShopSettings } from '../types';
import { 
  ShoppingBag, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Plus, 
  RefreshCw,
  Globe,
  Phone,
  Package
} from 'lucide-react';

interface StockReservationsManagementProps {
  products: Product[];
  settings: ShopSettings;
  onRefreshData?: () => void;
}

export const StockReservationsManagement: React.FC<StockReservationsManagementProps> = ({
  products,
  settings,
  onRefreshData,
}) => {
  const [reservations, setReservations] = useState<StockReservation[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // New Reservation Form
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [orderIdInput, setOrderIdInput] = useState<string>('');
  const [customerNameInput, setCustomerNameInput] = useState<string>('');
  const [reservedQtyInput, setReservedQtyInput] = useState<number>(1);
  const [channelInput, setChannelInput] = useState<'e-commerce' | 'phone' | 'manual_reserve'>('phone');
  const [expiryHoursInput, setExpiryHoursInput] = useState<number>(24);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    ReservationService.purgeExpiredReservations();
    setReservations(ReservationService.getReservations());
  };

  const handleCreateReservation = (e: React.FormEvent) => {
    e.preventDefault();
    const prod = products.find(p => p.id === selectedProductId);
    if (!prod) return;

    ReservationService.createReservation(
      orderIdInput || `ORD-${Math.floor(Math.random()*10000)}`,
      channelInput,
      customerNameInput || 'Walk-in Reservation',
      prod,
      reservedQtyInput,
      expiryHoursInput
    );

    setIsModalOpen(false);
    loadData();
    if (onRefreshData) onRefreshData();
  };

  const handleUpdateStatus = (id: string, status: 'FULFILLED' | 'CANCELLED') => {
    ReservationService.updateReservationStatus(id, status);
    loadData();
    if (onRefreshData) onRefreshData();
  };

  const activeReservations = reservations.filter(r => r.status === 'ACTIVE');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* Title Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 flex items-center space-x-2">
            <ShoppingBag className="w-6 h-6 text-[#0f6cbd]" />
            <span>Stock Reservations & E-Commerce Queue</span>
          </h2>
          <p className="text-xs text-slate-500">Reserve inventory for phone & online orders with automatic expiration to prevent double-selling</p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 bg-[#0f6cbd] hover:bg-[#115ea3] text-white font-bold rounded-xl text-xs flex items-center space-x-1.5 transition shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Create Reservation</span>
          </button>
        </div>
      </div>

      {/* Inventory Stock vs Reserved Breakdown Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-3">
        <h3 className="text-sm font-bold text-slate-800">Product Availability vs Active Reservations</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {products.slice(0, 3).map(p => {
            const reserved = ReservationService.getReservedQuantityForProduct(p.id);
            const available = ReservationService.getAvailableStock(p);
            return (
              <div key={p.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2 text-xs">
                <div className="flex items-center space-x-2">
                  <img src={p.image_url} alt="" className="w-8 h-8 rounded-lg object-cover" />
                  <div>
                    <div className="font-bold text-slate-900">{p.name}</div>
                    <div className="text-[10px] text-slate-500">Barcode: {p.barcode}</div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-1 text-center bg-white p-2 rounded-lg border border-slate-200 font-bold">
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase">Physical</div>
                    <div className="text-slate-900 text-sm">{p.stock_qty}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-amber-600 uppercase">Reserved</div>
                    <div className="text-amber-600 text-sm">{reserved}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-emerald-600 uppercase">Available</div>
                    <div className="text-emerald-600 text-sm">{available}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Active Reservations Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden p-5 space-y-3">
        <h3 className="text-sm font-bold text-slate-800">Reservations Audit Log</h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="p-3">Order ID / Channel</th>
                <th className="p-3">Customer</th>
                <th className="p-3">Product Name</th>
                <th className="p-3 text-center">Qty Reserved</th>
                <th className="p-3">Expiry Time</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reservations.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    No active or historical reservations found.
                  </td>
                </tr>
              ) : (
                reservations.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="p-3">
                      <div className="font-bold text-slate-900">{r.order_id}</div>
                      <div className="text-[10px] text-slate-400 flex items-center space-x-1">
                        {r.channel === 'e-commerce' ? <Globe className="w-3 h-3 text-blue-600" /> : <Phone className="w-3 h-3 text-emerald-600" />}
                        <span className="capitalize">{r.channel}</span>
                      </div>
                    </td>
                    <td className="p-3 font-semibold text-slate-800">{r.customer_name}</td>
                    <td className="p-3 font-bold text-slate-900">{r.product_name}</td>
                    <td className="p-3 text-center font-extrabold text-[#0f6cbd]">{r.reserved_qty}</td>
                    <td className="p-3 text-slate-600">
                      <div>{new Date(r.expires_at).toLocaleString()}</div>
                    </td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        r.status === 'ACTIVE' ? 'bg-amber-100 text-amber-800' :
                        r.status === 'FULFILLED' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="p-3 text-center space-x-1">
                      {r.status === 'ACTIVE' && (
                        <>
                          <button
                            onClick={() => handleUpdateStatus(r.id, 'FULFILLED')}
                            className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] rounded transition"
                          >
                            Fulfill
                          </button>
                          <button
                            onClick={() => handleUpdateStatus(r.id, 'CANCELLED')}
                            className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold text-[10px] rounded transition"
                          >
                            Cancel
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: New Reservation */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleCreateReservation} className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <h3 className="font-bold text-slate-900 text-sm border-b pb-2">Create New Stock Reservation</h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Select Product *</label>
                <select
                  required
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold"
                >
                  <option value="">-- Choose Product --</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} (Stock: {p.stock_qty})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Order Reference ID</label>
                  <input
                    type="text"
                    value={orderIdInput}
                    onChange={(e) => setOrderIdInput(e.target.value)}
                    placeholder="WEB-9912"
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Customer Name</label>
                  <input
                    type="text"
                    value={customerNameInput}
                    onChange={(e) => setCustomerNameInput(e.target.value)}
                    placeholder="Sana Malik"
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Reserved Qty</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={reservedQtyInput}
                    onChange={(e) => setReservedQtyInput(Number(e.target.value))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Channel</label>
                  <select
                    value={channelInput}
                    onChange={(e) => setChannelInput(e.target.value as any)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl"
                  >
                    <option value="phone">Phone Order</option>
                    <option value="e-commerce">E-Commerce</option>
                    <option value="manual_reserve">Manual</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Expiry (Hours)</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={expiryHoursInput}
                    onChange={(e) => setExpiryHoursInput(Number(e.target.value))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold"
                  />
                </div>
              </div>
            </div>

            <div className="flex space-x-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="flex-1 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2 bg-[#0f6cbd] text-white font-bold rounded-xl text-xs shadow-md"
              >
                Save Reservation
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
};

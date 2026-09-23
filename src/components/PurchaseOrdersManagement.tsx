import React, { useState, useEffect } from 'react';
import { StorageService } from '../services/storage';
import { InventorySyncService } from '../services/inventory_sync_service';
import { PurchaseOrder, Supplier, Product, POItem, POStatus } from '../types';
import { 
  ShoppingBag, 
  Plus, 
  Search, 
  CheckCircle, 
  PackageCheck, 
  AlertTriangle, 
  Clock, 
  XCircle, 
  FileSpreadsheet, 
  Eye, 
  Truck,
  ArrowRight
} from 'lucide-react';

export const PurchaseOrdersManagement: React.FC = () => {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [activeStatusFilter, setActiveStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Create PO Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [expectedDate, setExpectedDate] = useState('');
  const [poNotes, setPoNotes] = useState('');
  const [poItems, setPoItems] = useState<{ product: Product; qty: number; cost: number }[]>([]);

  // Receive PO Modal
  const [isReceiveOpen, setIsReceiveOpen] = useState(false);
  const [receivingOrder, setReceivingOrder] = useState<PurchaseOrder | null>(null);
  const [receiveItemInputs, setReceiveItemInputs] = useState<{ [prodId: string]: { received: number; damaged: number; missing: number } }>({});

  // View PO Details Modal
  const [viewingOrder, setViewingOrder] = useState<PurchaseOrder | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    setOrders(StorageService.getPurchaseOrders());
    setSuppliers(StorageService.getSuppliers());
    setProducts(StorageService.getProducts());
  };

  const filteredOrders = orders.filter(po => {
    const matchesStatus = activeStatusFilter === 'ALL' || po.status === activeStatusFilter;
    const matchesSearch = po.po_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          po.supplier_name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  // Handle supplier change in Create PO
  const handleSupplierSelect = (suppId: string) => {
    setSelectedSupplierId(suppId);
    const supp = suppliers.find(s => s.id === suppId);
    if (supp) {
      // Auto populate products mapped to supplier
      const mapped = products.filter(p => (supp.products_supplied || []).includes(p.id));
      setPoItems(mapped.map(p => ({ product: p, qty: 20, cost: p.buy_price })));
    } else {
      setPoItems([]);
    }
  };

  const handleAddProductToPo = (prod: Product) => {
    if (poItems.some(i => i.product.id === prod.id)) return;
    setPoItems([...poItems, { product: prod, qty: 10, cost: prod.buy_price }]);
  };

  const handleRemoveProductFromPo = (prodId: string) => {
    setPoItems(poItems.filter(i => i.product.id !== prodId));
  };

  const handleItemQtyChange = (prodId: string, qty: number) => {
    setPoItems(poItems.map(i => i.product.id === prodId ? { ...i, qty: Math.max(1, qty) } : i));
  };

  const handleItemCostChange = (prodId: string, cost: number) => {
    setPoItems(poItems.map(i => i.product.id === prodId ? { ...i, cost: Math.max(0, cost) } : i));
  };

  const handleSavePO = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplierId || poItems.length === 0) return;

    const supp = suppliers.find(s => s.id === selectedSupplierId);
    const activeUser = StorageService.getActiveUser();

    const items: POItem[] = poItems.map(i => ({
      product_id: i.product.id,
      product_name: i.product.name,
      ordered_qty: i.qty,
      received_qty: 0,
      damaged_qty: 0,
      missing_qty: 0,
      unit_cost: i.cost,
      line_total: i.qty * i.cost
    }));

    const newPO: PurchaseOrder = {
      id: `po_${Date.now()}`,
      po_number: `PO-${new Date().toISOString().slice(0, 7).replace('-', '')}-${Math.floor(100 + Math.random() * 900)}`,
      supplier_id: selectedSupplierId,
      supplier_name: supp?.company_name || 'Supplier',
      status: 'ORDERED',
      created_date: new Date().toISOString().split('T')[0],
      expected_date: expectedDate || new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0],
      items,
      subtotal: items.reduce((sum, item) => sum + item.line_total, 0),
      notes: poNotes,
      created_by: activeUser.name
    };

    const updated = [newPO, ...orders];
    StorageService.savePurchaseOrders(updated);
    setOrders(updated);
    setIsCreateOpen(false);
  };

  // Open Receive Modal
  const handleOpenReceive = (po: PurchaseOrder) => {
    setReceivingOrder(po);
    const initialInputs: { [prodId: string]: { received: number; damaged: number; missing: number } } = {};
    po.items.forEach(item => {
      initialInputs[item.product_id] = {
        received: item.ordered_qty - item.received_qty,
        damaged: 0,
        missing: 0
      };
    });
    setReceiveItemInputs(initialInputs);
    setIsReceiveOpen(true);
  };

  // Process Receiving Inventory into Actual Stock
  const handleConfirmReceive = (e: React.FormEvent) => {
    e.preventDefault();
    if (!receivingOrder) return;

    const activeUser = StorageService.getActiveUser();
    const currentProducts = StorageService.getProducts();

    let allFullyReceived = true;
    let anyReceived = false;

    const updatedPOItems: POItem[] = receivingOrder.items.map(item => {
      const inputs = receiveItemInputs[item.product_id] || { received: 0, damaged: 0, missing: 0 };
      const newlyReceived = Math.max(0, Number(inputs.received) || 0);
      const newlyDamaged = Math.max(0, Number(inputs.damaged) || 0);
      const newlyMissing = Math.max(0, Number(inputs.missing) || 0);

      const totalReceived = item.received_qty + newlyReceived;
      const totalDamaged = item.damaged_qty + newlyDamaged;
      const totalMissing = item.missing_qty + newlyMissing;

      if (newlyReceived > 0) {
        anyReceived = true;
        // UPDATE ACTUAL INVENTORY STOCK FOR ONLY RECEIVED QTY
        const prodIndex = currentProducts.findIndex(p => p.id === item.product_id);
        if (prodIndex >= 0) {
          const oldQty = currentProducts[prodIndex].stock_qty;
          currentProducts[prodIndex].stock_qty += newlyReceived;
          // Optionally update buy_price if cost changed
          if (item.unit_cost > 0) {
            currentProducts[prodIndex].buy_price = item.unit_cost;
          }

          // Record Atomic Stock Ledger Entry
          InventorySyncService.adjustStock(
            item.product_id,
            'STOCK_IN',
            newlyReceived,
            `PO Receive: ${receivingOrder.po_number}`,
            activeUser.name
          );
        }
      }

      if (totalReceived < item.ordered_qty) {
        allFullyReceived = false;
      }

      return {
        ...item,
        received_qty: totalReceived,
        damaged_qty: totalDamaged,
        missing_qty: totalMissing
      };
    });

    // Save updated products stock
    StorageService.saveProducts(currentProducts);

    // Determine new PO status
    let newStatus: POStatus = receivingOrder.status;
    if (allFullyReceived) {
      newStatus = 'FULL_RECEIVED';
    } else if (anyReceived) {
      newStatus = 'PARTIALLY_RECEIVED';
    }

    const updatedOrders = orders.map(po => po.id === receivingOrder.id ? {
      ...po,
      items: updatedPOItems,
      status: newStatus,
      received_date: new Date().toISOString().split('T')[0]
    } : po);

    StorageService.savePurchaseOrders(updatedOrders);
    setOrders(updatedOrders);
    setProducts(currentProducts);
    setIsReceiveOpen(false);
    setReceivingOrder(null);
  };

  const getStatusBadge = (status: POStatus) => {
    switch (status) {
      case 'DRAFT':
        return <span className="bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full text-[10px] font-bold border border-slate-300">Draft</span>;
      case 'ORDERED':
        return <span className="bg-blue-50 text-[#0f6cbd] px-2.5 py-0.5 rounded-full text-[10px] font-bold border border-blue-200">Ordered / Pending</span>;
      case 'PARTIALLY_RECEIVED':
        return <span className="bg-amber-50 text-amber-700 px-2.5 py-0.5 rounded-full text-[10px] font-bold border border-amber-200">Partially Received</span>;
      case 'FULL_RECEIVED':
        return <span className="bg-emerald-50 text-[#107c41] px-2.5 py-0.5 rounded-full text-[10px] font-bold border border-emerald-200 flex items-center space-x-1"><CheckCircle className="w-3 h-3" /><span>Fully Received</span></span>;
      case 'CANCELLED':
        return <span className="bg-rose-50 text-rose-700 px-2.5 py-0.5 rounded-full text-[10px] font-bold border border-rose-200">Cancelled</span>;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 font-sans">
      
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-lg border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center space-x-2">
            <ShoppingBag className="w-5 h-5 text-[#0f6cbd]" />
            <h2 className="text-xl font-bold text-slate-800">Purchase Orders & Receiving Workflow</h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">Separate ordering from inventory receiving. Actual stock increases only upon verified delivery.</p>
        </div>

        <button
          onClick={() => {
            setSelectedSupplierId('');
            setExpectedDate(new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0]);
            setPoNotes('');
            setPoItems([]);
            setIsCreateOpen(true);
          }}
          className="px-4 py-2 bg-[#0f6cbd] hover:bg-[#115ea3] text-white font-bold rounded-md text-xs shadow-xs flex items-center space-x-2 transition"
        >
          <Plus className="w-4 h-4" />
          <span>Create Purchase Order</span>
        </button>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
        <div className="flex flex-wrap gap-1.5 text-xs">
          {['ALL', 'ORDERED', 'PARTIALLY_RECEIVED', 'FULL_RECEIVED'].map(st => (
            <button
              key={st}
              onClick={() => setActiveStatusFilter(st)}
              className={`px-3 py-1.5 rounded-md font-bold transition ${
                activeStatusFilter === st
                  ? 'bg-[#0f6cbd] text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {st.replace('_', ' ')}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search PO # or supplier..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-[#0f6cbd]"
          />
        </div>
      </div>

      {/* Purchase Orders Table */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
              <tr>
                <th className="p-3">PO Number</th>
                <th className="p-3">Supplier</th>
                <th className="p-3">Status</th>
                <th className="p-3">Created Date</th>
                <th className="p-3">Expected Date</th>
                <th className="p-3">Items Count</th>
                <th className="p-3 text-right">Total Amount</th>
                <th className="p-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400 italic">
                    No purchase orders found. Click "Create Purchase Order" to make one.
                  </td>
                </tr>
              ) : (
                filteredOrders.map(po => (
                  <tr key={po.id} className="hover:bg-slate-50 transition">
                    <td className="p-3 font-mono font-bold text-[#0f6cbd]">{po.po_number}</td>
                    <td className="p-3 font-bold">{po.supplier_name}</td>
                    <td className="p-3">{getStatusBadge(po.status)}</td>
                    <td className="p-3 text-slate-500">{po.created_date}</td>
                    <td className="p-3 text-slate-500">{po.expected_date}</td>
                    <td className="p-3 font-bold">{po.items.length} products</td>
                    <td className="p-3 text-right font-extrabold text-slate-900">Rs {po.subtotal.toLocaleString()}</td>
                    <td className="p-3">
                      <div className="flex items-center justify-center space-x-2">
                        <button
                          onClick={() => setViewingOrder(po)}
                          className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded text-[11px] flex items-center space-x-1"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View</span>
                        </button>

                        {po.status !== 'FULL_RECEIVED' && po.status !== 'CANCELLED' && (
                          <button
                            onClick={() => handleOpenReceive(po)}
                            className="px-2.5 py-1 bg-[#107c41] hover:bg-[#0e6b37] text-white font-bold rounded text-[11px] flex items-center space-x-1 shadow-xs"
                          >
                            <PackageCheck className="w-3.5 h-3.5" />
                            <span>Receive Items</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Purchase Order Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto border border-slate-200 p-5 sm:p-6 space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-slate-900 text-base sm:text-lg flex items-center space-x-2">
                <ShoppingBag className="w-5 h-5 text-[#0f6cbd]" />
                <span>Create New Cosmetic Purchase Order</span>
              </h3>
              <button onClick={() => setIsCreateOpen(false)} className="text-slate-400 hover:text-slate-700 font-bold text-lg px-2">✕</button>
            </div>

            <form onSubmit={handleSavePO} className="space-y-4 text-xs sm:text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Select Supplier *</label>
                  <select
                    value={selectedSupplierId}
                    onChange={(e) => handleSupplierSelect(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md font-bold focus:outline-none focus:ring-2 focus:ring-[#0f6cbd]"
                    required
                  >
                    <option value="">-- Choose Brand Supplier --</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.company_name} ({s.contact_person})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Expected Delivery Date</label>
                  <input
                    type="date"
                    value={expectedDate}
                    onChange={(e) => setExpectedDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0f6cbd]"
                  />
                </div>
              </div>

              {/* Add Product Picker */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Add Cosmetic Product to Order</label>
                <div className="flex items-center space-x-2">
                  <select
                    onChange={(e) => {
                      const p = products.find(prod => prod.id === e.target.value);
                      if (p) handleAddProductToPo(p);
                      e.target.value = '';
                    }}
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-[#0f6cbd]"
                  >
                    <option value="">+ Add Product from Catalog...</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.name} (Stock: {p.stock_qty} | Buy Price: Rs {p.buy_price})</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Items Table */}
              <div className="border border-slate-200 rounded-md overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 font-bold text-slate-600">
                    <tr>
                      <th className="p-2">Product Name</th>
                      <th className="p-2 w-28">Order Qty</th>
                      <th className="p-2 w-32">Unit Cost (PKR)</th>
                      <th className="p-2 text-right">Line Total</th>
                      <th className="p-2 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {poItems.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-4 text-center text-slate-400 italic">No products added yet. Select a supplier or add items above.</td>
                      </tr>
                    ) : (
                      poItems.map(item => (
                        <tr key={item.product.id}>
                          <td className="p-2 font-bold text-slate-800">{item.product.name}</td>
                          <td className="p-2">
                            <input
                              type="number"
                              min="1"
                              value={item.qty}
                              onChange={(e) => handleItemQtyChange(item.product.id, Number(e.target.value))}
                              className="w-20 px-2 py-1 border border-slate-300 rounded text-center font-bold"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              min="0"
                              value={item.cost}
                              onChange={(e) => handleItemCostChange(item.product.id, Number(e.target.value))}
                              className="w-24 px-2 py-1 border border-slate-300 rounded text-right font-bold"
                            />
                          </td>
                          <td className="p-2 text-right font-bold text-slate-900">
                            Rs {(item.qty * item.cost).toLocaleString()}
                          </td>
                          <td className="p-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveProductFromPo(item.product.id)}
                              className="text-rose-600 hover:text-rose-800 font-bold px-1"
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Notes / Instructions</label>
                <input
                  type="text"
                  value={poNotes}
                  onChange={(e) => setPoNotes(e.target.value)}
                  placeholder="Special instructions for distributor..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0f6cbd]"
                />
              </div>

              <div className="flex items-center justify-between pt-3 border-t">
                <div className="text-sm font-bold">
                  Total PO Value: <span className="text-[#0f6cbd] text-lg font-black">
                    Rs {poItems.reduce((sum, i) => sum + i.qty * i.cost, 0).toLocaleString()}
                  </span>
                </div>
                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={() => setIsCreateOpen(false)}
                    className="px-4 py-2 border border-slate-300 text-slate-700 rounded-md font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#0f6cbd] hover:bg-[#115ea3] text-white rounded-md font-bold shadow-xs"
                  >
                    Confirm & Send Purchase Order
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Receive Delivery Modal */}
      {isReceiveOpen && receivingOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto border border-slate-200 p-5 sm:p-6 space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-base sm:text-lg flex items-center space-x-2">
                  <PackageCheck className="w-5 h-5 text-[#107c41]" />
                  <span>Receive Shipment & Verification ({receivingOrder.po_number})</span>
                </h3>
                <p className="text-xs text-slate-500">Supplier: <span className="font-bold">{receivingOrder.supplier_name}</span></p>
              </div>
              <button onClick={() => setIsReceiveOpen(false)} className="text-slate-400 hover:text-slate-700 font-bold text-lg px-2">✕</button>
            </div>

            <form onSubmit={handleConfirmReceive} className="space-y-4 text-xs">
              <div className="bg-blue-50 border border-blue-200 text-[#0f6cbd] p-3 rounded-md leading-relaxed font-medium">
                ⚡ <strong>Inventory Receiving Policy:</strong> Inventory stock quantities in your POS will <u>only increase</u> for items marked in the <strong>"Newly Received Qty"</strong> column. Damaged/Missing items are recorded separately in audit logs.
              </div>

              <div className="border border-slate-200 rounded-md overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-100 font-bold text-slate-700">
                    <tr>
                      <th className="p-2.5">Product</th>
                      <th className="p-2 text-center">Ordered</th>
                      <th className="p-2 text-center">Prev Rcvd</th>
                      <th className="p-2 text-center text-[#107c41]">Newly Received Qty</th>
                      <th className="p-2 text-center text-amber-600">Damaged</th>
                      <th className="p-2 text-center text-rose-600">Missing</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {receivingOrder.items.map(item => {
                      const inp = receiveItemInputs[item.product_id] || { received: 0, damaged: 0, missing: 0 };
                      return (
                        <tr key={item.product_id}>
                          <td className="p-2.5 font-bold text-slate-800">{item.product_name}</td>
                          <td className="p-2 text-center font-bold">{item.ordered_qty}</td>
                          <td className="p-2 text-center text-slate-500">{item.received_qty}</td>
                          <td className="p-2 text-center bg-emerald-50/50">
                            <input
                              type="number"
                              min="0"
                              value={inp.received}
                              onChange={(e) => setReceiveItemInputs({
                                ...receiveItemInputs,
                                [item.product_id]: { ...inp, received: Number(e.target.value) }
                              })}
                              className="w-16 px-2 py-1 border border-emerald-300 rounded font-bold text-center text-[#107c41] bg-white"
                            />
                          </td>
                          <td className="p-2 text-center bg-amber-50/50">
                            <input
                              type="number"
                              min="0"
                              value={inp.damaged}
                              onChange={(e) => setReceiveItemInputs({
                                ...receiveItemInputs,
                                [item.product_id]: { ...inp, damaged: Number(e.target.value) }
                              })}
                              className="w-16 px-2 py-1 border border-amber-300 rounded font-bold text-center text-amber-700 bg-white"
                            />
                          </td>
                          <td className="p-2 text-center bg-rose-50/50">
                            <input
                              type="number"
                              min="0"
                              value={inp.missing}
                              onChange={(e) => setReceiveItemInputs({
                                ...receiveItemInputs,
                                [item.product_id]: { ...inp, missing: Number(e.target.value) }
                              })}
                              className="w-16 px-2 py-1 border border-rose-300 rounded font-bold text-center text-rose-700 bg-white"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsReceiveOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-md font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#107c41] hover:bg-[#0e6b37] text-white rounded-md font-bold shadow-xs flex items-center space-x-1.5"
                >
                  <PackageCheck className="w-4 h-4" />
                  <span>Update Stock & Finalize Receiving</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View PO Modal */}
      {viewingOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl border border-slate-200 p-5 space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-base">PO Details ({viewingOrder.po_number})</h3>
                <p className="text-xs text-slate-500">Created on {viewingOrder.created_date} by {viewingOrder.created_by}</p>
              </div>
              <button onClick={() => setViewingOrder(null)} className="text-slate-400 hover:text-slate-700 font-bold text-lg px-2">✕</button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-md border border-slate-200">
                <div><strong>Supplier:</strong> {viewingOrder.supplier_name}</div>
                <div><strong>Status:</strong> {getStatusBadge(viewingOrder.status)}</div>
                <div><strong>Expected Delivery:</strong> {viewingOrder.expected_date}</div>
                <div><strong>Received Date:</strong> {viewingOrder.received_date || 'N/A'}</div>
              </div>

              <table className="w-full text-left border border-slate-200 rounded-md overflow-hidden">
                <thead className="bg-slate-100 font-bold text-slate-700">
                  <tr>
                    <th className="p-2">Item</th>
                    <th className="p-2 text-center">Ordered</th>
                    <th className="p-2 text-center">Received</th>
                    <th className="p-2 text-center">Damaged</th>
                    <th className="p-2 text-right">Unit Cost</th>
                    <th className="p-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {viewingOrder.items.map((i, idx) => (
                    <tr key={idx}>
                      <td className="p-2 font-bold">{i.product_name}</td>
                      <td className="p-2 text-center">{i.ordered_qty}</td>
                      <td className="p-2 text-center text-[#107c41] font-bold">{i.received_qty}</td>
                      <td className="p-2 text-center text-amber-600">{i.damaged_qty}</td>
                      <td className="p-2 text-right">Rs {i.unit_cost.toLocaleString()}</td>
                      <td className="p-2 text-right font-bold">Rs {i.line_total.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {viewingOrder.notes && (
                <div className="text-slate-500 italic">Notes: "{viewingOrder.notes}"</div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t">
              <button
                onClick={() => setViewingOrder(null)}
                className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-md"
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

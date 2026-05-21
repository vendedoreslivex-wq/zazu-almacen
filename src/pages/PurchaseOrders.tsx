import React, { useState } from 'react';
import { useAppContext } from '../store/AppContext';
import { ModuleInfo } from '../components/ModuleInfo';
import { Plus, Trash2, ChevronDown, ChevronUp, CheckCircle, XCircle, Package } from 'lucide-react';
import { PurchaseOrder, PurchaseOrderItem, PurchaseOrderStatus } from '../types';
import { canEdit as hasPermission } from '../lib/permissions';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const STATUS_LABEL: Record<PurchaseOrderStatus, string> = {
  DRAFT: 'BORRADOR',
  APPROVED: 'APROBADA',
  PARTIAL: 'PARCIAL',
  COMPLETED: 'COMPLETADA',
  CANCELLED: 'CANCELADA',
};

const STATUS_STYLE: Record<PurchaseOrderStatus, string> = {
  DRAFT: 'border-[#9f9d99] text-[#9f9d99]',
  APPROVED: 'border-amber-600 text-amber-700',
  PARTIAL: 'border-blue-600 text-blue-700',
  COMPLETED: 'border-green-700 text-green-700',
  CANCELLED: 'border-red-600 text-red-600',
};

const emptyItem = (): PurchaseOrderItem => ({ productId: '', quantity: 1, unitCost: 0, receivedQuantity: 0 });

export const PurchaseOrders: React.FC = () => {
  const { purchaseOrders, addPurchaseOrder, updatePurchaseOrder, deletePurchaseOrder, receivePurchaseOrder, contacts, products, locations, currentUser } = useAppContext();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [receiveModal, setReceiveModal] = useState<PurchaseOrder | null>(null);
  const [receiving, setReceiving] = useState(false);
  const [receiveError, setReceiveError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'ALL' | PurchaseOrderStatus>('ALL');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const [form, setForm] = useState({ supplierId: '', reference: '', notes: '', locationId: '', items: [emptyItem()] });
  const [receiveQtys, setReceiveQtys] = useState<Record<number, number>>({});

  const isAdmin = hasPermission(currentUser.role, 'purchase-orders');
  const canEdit = hasPermission(currentUser.role, 'purchase-orders');
  const suppliers = contacts.filter(c => c.type === 'SUPPLIER');

  const filtered = purchaseOrders.filter(po => filterStatus === 'ALL' || po.status === filterStatus);

  const openAdd = () => {
    setForm({ supplierId: suppliers[0]?.id || '', reference: `OC-${Date.now().toString().slice(-6)}`, notes: '', locationId: locations[0]?.id || '', items: [emptyItem()] });
    setShowModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.supplierId || form.items.some(i => !i.productId)) return;
    addPurchaseOrder({ ...form, status: 'DRAFT' });
    setShowModal(false);
  };

  const changeStatus = (po: PurchaseOrder, status: PurchaseOrderStatus) => {
    updatePurchaseOrder({ ...po, status });
  };

  const openReceive = (po: PurchaseOrder) => {
    const init: Record<number, number> = {};
    po.items.forEach((item, i) => { init[i] = item.quantity - item.receivedQuantity; });
    setReceiveQtys(init);
    setReceiveError(null);
    setReceiveModal(po);
  };

  const confirmReceive = async () => {
    if (!receiveModal) return;
    setReceiving(true);
    setReceiveError(null);
    try {
      await receivePurchaseOrder(receiveModal, receiveQtys);
      setReceiveModal(null);
    } catch {
      setReceiveError('Error al registrar la recepción. Intenta de nuevo.');
    } finally {
      setReceiving(false);
    }
  };

  const addItem = () => setForm(f => ({ ...f, items: [...f.items, emptyItem()] }));
  const removeItem = (i: number) => setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }));
  const updateItem = (i: number, field: keyof PurchaseOrderItem, value: string | number) => {
    setForm(f => ({ ...f, items: f.items.map((item, idx) => idx === i ? { ...item, [field]: value } : item) }));
  };

  const totalValue = (po: PurchaseOrder) => po.items.reduce((s, i) => s + i.quantity * i.unitCost, 0);

  return (
    <div className="flex flex-col gap-6 h-full relative">
      <ModuleInfo number="07" title="Órdenes de Compra" description="Gestión de órdenes de compra a proveedores. Crea, aprueba y recibe pedidos; el inventario se actualiza automáticamente al confirmar la recepción." />
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 border-b border-[#141414] pb-3">
        <div>
          <h2 className="font-serif italic font-bold text-xs uppercase tracking-widest text-[#141414]">09 // ÓRDENES_COMPRA</h2>
          <p className="font-mono text-[10px] opacity-70 uppercase tracking-wide mt-1">Gestión de órdenes a proveedores.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)}
            className="border border-[#141414] bg-white/50 px-3 py-2 text-[10px] font-mono font-bold uppercase focus:outline-none cursor-pointer">
            <option value="ALL">TODOS</option>
            {(Object.keys(STATUS_LABEL) as PurchaseOrderStatus[]).map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
          {isAdmin && (
            <button onClick={openAdd} className="flex items-center gap-2 bg-[#141414] text-[#E4E3E0] px-4 py-2 text-xs font-bold font-mono uppercase hover:shadow-[3px_3px_0_#9f9d99] transition-all border border-[#141414]">
              <Plus size={14} /> NUEVA OC
            </button>
          )}
        </div>
      </div>

      {filtered.length === 0 && (
        <div className="text-center font-mono text-xs opacity-50 py-16 uppercase tracking-widest">Sin órdenes de compra</div>
      )}

      <div className="flex flex-col gap-3">
        {filtered.map(po => {
          const supplier = contacts.find(c => c.id === po.supplierId);
          const isExpanded = expanded === po.id;
          return (
            <div key={po.id} className="border border-[#141414] bg-white/40">
              <div className="flex items-center justify-between gap-4 p-4 cursor-pointer" onClick={() => setExpanded(isExpanded ? null : po.id)}>
                <div className="flex items-center gap-4 min-w-0 flex-wrap">
                  <span className={`font-mono text-[9px] font-bold border px-2 py-0.5 shrink-0 ${STATUS_STYLE[po.status]}`}>{STATUS_LABEL[po.status]}</span>
                  <span className="font-mono font-bold text-sm text-[#141414] shrink-0">{po.reference}</span>
                  <span className="font-mono text-xs opacity-70 shrink-0">{supplier?.name || 'Proveedor desconocido'}</span>
                  <span className="font-mono text-[10px] opacity-50">{format(new Date(po.date), 'dd MMM yyyy', { locale: es })}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-mono font-bold text-xs hidden sm:block">S/ {totalValue(po).toFixed(2)}</span>
                  {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
              </div>

              {isExpanded && (
                <div className="border-t border-[#141414] p-4 flex flex-col gap-4">
                  <div className="overflow-x-auto">
                    <table className="w-full text-[10px] font-mono border-collapse">
                      <thead>
                        <tr className="border-b border-[#141414]">
                          <th className="text-left py-1.5 pr-3 font-bold uppercase">Producto</th>
                          <th className="text-right py-1.5 px-3 font-bold uppercase">Solicitado</th>
                          <th className="text-right py-1.5 px-3 font-bold uppercase">Recibido</th>
                          <th className="text-right py-1.5 px-3 font-bold uppercase">Costo U.</th>
                          <th className="text-right py-1.5 pl-3 font-bold uppercase">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {po.items.map((item, i) => {
                          const prod = products.find(p => p.id === item.productId);
                          return (
                            <tr key={i} className="border-b border-[#141414]/20">
                              <td className="py-1.5 pr-3">{prod ? `${prod.code} ${prod.name} ${prod.color || ''} ${prod.size || ''}`.trim() : item.productId}</td>
                              <td className="text-right py-1.5 px-3">{item.quantity}</td>
                              <td className={`text-right py-1.5 px-3 font-bold ${item.receivedQuantity >= item.quantity ? 'text-green-700' : item.receivedQuantity > 0 ? 'text-amber-700' : ''}`}>{item.receivedQuantity}</td>
                              <td className="text-right py-1.5 px-3">S/ {item.unitCost.toFixed(2)}</td>
                              <td className="text-right py-1.5 pl-3">S/ {(item.quantity * item.unitCost).toFixed(2)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-[#141414]">
                          <td colSpan={4} className="py-1.5 pr-3 font-bold text-right uppercase">Total OC:</td>
                          <td className="text-right py-1.5 pl-3 font-bold">S/ {totalValue(po).toFixed(2)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                  {po.notes && <p className="font-mono text-[10px] opacity-60 italic">{po.notes}</p>}
                  {canEdit && (
                    <div className="flex flex-wrap gap-2">
                      {po.status === 'DRAFT' && isAdmin && (
                        <button onClick={() => changeStatus(po, 'APPROVED')} className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold font-mono uppercase border border-green-700 text-green-700 hover:bg-green-700 hover:text-white transition-colors">
                          <CheckCircle size={12} /> APROBAR
                        </button>
                      )}
                      {(po.status === 'APPROVED' || po.status === 'PARTIAL') && (
                        <button onClick={() => openReceive(po)} className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold font-mono uppercase border border-blue-700 text-blue-700 hover:bg-blue-700 hover:text-white transition-colors">
                          <Package size={12} /> RECIBIR
                        </button>
                      )}
                      {po.status !== 'COMPLETED' && po.status !== 'CANCELLED' && isAdmin && (
                        <button onClick={() => changeStatus(po, 'CANCELLED')} className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold font-mono uppercase border border-red-600 text-red-600 hover:bg-red-600 hover:text-white transition-colors">
                          <XCircle size={12} /> CANCELAR
                        </button>
                      )}
                      {isAdmin && (po.status === 'DRAFT' || po.status === 'CANCELLED') && (
                        <button onClick={() => setConfirmDelete(po.id)} className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold font-mono uppercase border border-[#141414]/30 hover:border-red-600 hover:text-red-600 transition-colors ml-auto">
                          <Trash2 size={12} /> ELIMINAR
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* New PO Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[#E4E3E0] border border-[#141414] shadow-[4px_4px_0_#141414] w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="border-b border-[#141414] px-5 py-3 flex justify-between items-center sticky top-0 bg-[#E4E3E0]">
              <span className="font-mono font-bold text-xs uppercase tracking-widest">NUEVA ORDEN DE COMPRA</span>
              <button onClick={() => setShowModal(false)} className="font-mono text-xs opacity-60 hover:opacity-100">✕</button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="font-mono text-[9px] font-bold uppercase tracking-widest opacity-60">Referencia *</label>
                  <input value={form.reference} onChange={e => setForm(f => ({ ...f, reference: e.target.value }))}
                    className="border border-[#141414] bg-white px-3 py-2 text-xs font-mono focus:outline-none focus:shadow-[2px_2px_0_#141414]" required />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-mono text-[9px] font-bold uppercase tracking-widest opacity-60">Proveedor *</label>
                  <select value={form.supplierId} onChange={e => setForm(f => ({ ...f, supplierId: e.target.value }))}
                    className="border border-[#141414] bg-white px-3 py-2 text-xs font-mono focus:outline-none cursor-pointer" required>
                    <option value="">Seleccionar...</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="font-mono text-[9px] font-bold uppercase tracking-widest opacity-60">Ubicación destino</label>
                <select value={form.locationId} onChange={e => setForm(f => ({ ...f, locationId: e.target.value }))}
                  className="border border-[#141414] bg-white px-3 py-2 text-xs font-mono focus:outline-none cursor-pointer">
                  <option value="">Sin asignar</option>
                  {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label className="font-mono text-[9px] font-bold uppercase tracking-widest opacity-60">Ítems *</label>
                  <button type="button" onClick={addItem} className="font-mono text-[9px] font-bold uppercase text-[#141414] hover:underline">+ AGREGAR</button>
                </div>
                {form.items.map((item, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-5">
                      <select value={item.productId} onChange={e => updateItem(i, 'productId', e.target.value)}
                        className="w-full border border-[#141414] bg-white px-2 py-1.5 text-[10px] font-mono focus:outline-none cursor-pointer" required>
                        <option value="">Producto...</option>
                        {products.map(p => <option key={p.id} value={p.id}>{p.code} — {p.name} {p.color} {p.size}</option>)}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <input type="number" min="1" value={item.quantity} onChange={e => updateItem(i, 'quantity', parseInt(e.target.value) || 1)}
                        className="w-full border border-[#141414] bg-white px-2 py-1.5 text-[10px] font-mono focus:outline-none text-center" placeholder="Qty" />
                    </div>
                    <div className="col-span-3">
                      <input type="number" min="0" step="0.01" value={item.unitCost} onChange={e => updateItem(i, 'unitCost', parseFloat(e.target.value) || 0)}
                        className="w-full border border-[#141414] bg-white px-2 py-1.5 text-[10px] font-mono focus:outline-none" placeholder="Costo" />
                    </div>
                    <div className="col-span-2 text-right">
                      {form.items.length > 1 && (
                        <button type="button" onClick={() => removeItem(i)} className="text-red-600 hover:opacity-70 p-1">
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-mono text-[9px] font-bold uppercase tracking-widest opacity-60">Notas</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2}
                  className="border border-[#141414] bg-white px-3 py-2 text-xs font-mono focus:outline-none resize-none" />
              </div>

              <div className="flex gap-2 pt-2">
                <button type="submit" className="flex-1 bg-[#141414] text-[#E4E3E0] py-2 text-xs font-bold font-mono uppercase hover:shadow-[2px_2px_0_#9f9d99] transition-all">CREAR OC</button>
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 border border-[#141414] py-2 text-xs font-bold font-mono uppercase hover:bg-white/50">CANCELAR</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Receive Modal */}
      {receiveModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[#E4E3E0] border border-[#141414] shadow-[4px_4px_0_#141414] w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="border-b border-[#141414] px-5 py-3 flex justify-between items-center">
              <span className="font-mono font-bold text-xs uppercase tracking-widest">RECIBIR — {receiveModal.reference}</span>
              <button onClick={() => setReceiveModal(null)} className="font-mono text-xs opacity-60 hover:opacity-100">✕</button>
            </div>
            <div className="p-5 flex flex-col gap-4">
              {receiveModal.items.map((item, i) => {
                const prod = products.find(p => p.id === item.productId);
                const pending = item.quantity - item.receivedQuantity;
                return (
                  <div key={i} className="flex items-center justify-between gap-4 border-b border-[#141414]/20 pb-3">
                    <div className="min-w-0">
                      <div className="font-mono text-xs font-bold truncate">{prod?.code} {prod?.name} {prod?.color} {prod?.size}</div>
                      <div className="font-mono text-[10px] opacity-60">Pendiente: {pending} / {item.quantity}</div>
                    </div>
                    <input type="number" min="0" max={pending} value={receiveQtys[i] ?? pending}
                      onChange={e => setReceiveQtys(q => ({ ...q, [i]: Math.min(pending, parseInt(e.target.value) || 0) }))}
                      className="w-20 border border-[#141414] bg-white px-2 py-1 text-xs font-mono text-center focus:outline-none" />
                  </div>
                );
              })}
              {receiveError && <p className="font-mono text-[10px] text-red-600 font-bold">{receiveError}</p>}
              <div className="flex gap-2 pt-2">
                <button onClick={confirmReceive} disabled={receiving} className="flex-1 bg-[#141414] text-[#E4E3E0] py-2 text-xs font-bold font-mono uppercase disabled:opacity-50">
                  {receiving ? 'REGISTRANDO...' : 'CONFIRMAR RECEPCIÓN'}
                </button>
                <button onClick={() => setReceiveModal(null)} disabled={receiving} className="flex-1 border border-[#141414] py-2 text-xs font-bold font-mono uppercase disabled:opacity-50">CANCELAR</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[#E4E3E0] border border-[#141414] shadow-[4px_4px_0_#141414] p-6 max-w-sm w-full">
            <p className="font-mono text-xs font-bold mb-4">¿Eliminar esta orden de compra?</p>
            <div className="flex gap-2">
              <button onClick={() => { deletePurchaseOrder(confirmDelete); setConfirmDelete(null); }} className="flex-1 bg-red-600 text-white py-2 text-xs font-bold font-mono uppercase">ELIMINAR</button>
              <button onClick={() => setConfirmDelete(null)} className="flex-1 border border-[#141414] py-2 text-xs font-bold font-mono uppercase">CANCELAR</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState } from 'react';
import { useAppContext } from '../store/AppContext';
import { ModuleInfo } from '../components/ModuleInfo';
import { Plus, ChevronDown, ChevronUp } from 'lucide-react';
import { AdjustmentReason } from '../types';
import { canEdit } from '../lib/permissions';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const REASON_LABEL: Record<AdjustmentReason, string> = {
  DAMAGE: 'DAÑO / ROTURA',
  LOSS: 'MERMA / PÉRDIDA',
  COUNT: 'CONTEO FÍSICO',
  RETURN: 'DEVOLUCIÓN',
  OTHER: 'OTRO',
};

const REASON_COLOR: Record<AdjustmentReason, string> = {
  DAMAGE: 'border-red-600 text-red-700',
  LOSS: 'border-orange-600 text-orange-700',
  COUNT: 'border-blue-600 text-blue-700',
  RETURN: 'border-green-700 text-green-700',
  OTHER: 'border-[#9f9d99] text-[#9f9d99]',
};

export const Adjustments: React.FC = () => {
  const { adjustments, addAdjustment, products, locations, stockLevels, currentUser } = useAppContext();
  const [showModal, setShowModal] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filterReason, setFilterReason] = useState<'ALL' | AdjustmentReason>('ALL');

  const canAdjust = canEdit(currentUser.role, 'adjustments');

  const [form, setForm] = useState({
    productId: '',
    locationId: '',
    newQuantity: 0,
    reason: 'COUNT' as AdjustmentReason,
    notes: '',
  });
  const [error, setError] = useState('');

  const currentStock = form.productId && form.locationId
    ? stockLevels.find(s => s.productId === form.productId && s.locationId === form.locationId)?.quantity ?? 0
    : 0;

  const filtered = adjustments.filter(a => filterReason === 'ALL' || a.reason === filterReason);

  const openAdd = () => {
    setForm({ productId: products[0]?.id || '', locationId: locations[0]?.id || '', newQuantity: 0, reason: 'COUNT', notes: '' });
    setError('');
    setShowModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.productId || !form.locationId) { setError('Selecciona producto y ubicación'); return; }
    if (form.newQuantity < 0) { setError('La cantidad no puede ser negativa'); return; }
    addAdjustment({
      productId: form.productId,
      locationId: form.locationId,
      previousQuantity: currentStock,
      newQuantity: form.newQuantity,
      reason: form.reason,
      notes: form.notes,
      user: currentUser.username,
    });
    setShowModal(false);
  };

  const diffColor = (prev: number, next: number) => {
    if (next > prev) return 'text-green-700';
    if (next < prev) return 'text-red-600';
    return 'text-[#9f9d99]';
  };

  return (
    <div className="flex flex-col gap-6 h-full relative">
      <ModuleInfo number="06" title="Ajustes de Inventario" description="Correcciones manuales de stock con motivo obligatorio. Permite incrementar o decrementar unidades de cualquier SKU con trazabilidad completa." />
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 border-b border-[#141414] pb-3">
        <div>
          <h2 className="font-serif italic font-bold text-xs uppercase tracking-widest text-[#141414]">10 // AJUSTES_INVENTARIO</h2>
          <p className="font-mono text-[10px] opacity-70 uppercase tracking-wide mt-1">Correcciones de stock con motivo y trazabilidad.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select value={filterReason} onChange={e => setFilterReason(e.target.value as any)}
            className="border border-[#141414] bg-white/50 px-3 py-2 text-[10px] font-mono font-bold uppercase focus:outline-none cursor-pointer">
            <option value="ALL">TODOS LOS MOTIVOS</option>
            {(Object.keys(REASON_LABEL) as AdjustmentReason[]).map(r => <option key={r} value={r}>{REASON_LABEL[r]}</option>)}
          </select>
          {canAdjust && (
            <button onClick={openAdd} className="flex items-center gap-2 bg-[#141414] text-[#E4E3E0] px-4 py-2 text-xs font-bold font-mono uppercase hover:shadow-[3px_3px_0_#9f9d99] transition-all border border-[#141414]">
              <Plus size={14} /> NUEVO AJUSTE
            </button>
          )}
        </div>
      </div>

      {filtered.length === 0 && (
        <div className="text-center font-mono text-xs opacity-50 py-16 uppercase tracking-widest">Sin ajustes registrados</div>
      )}

      <div className="flex flex-col gap-3">
        {filtered.map(adj => {
          const prod = products.find(p => p.id === adj.productId);
          const loc = locations.find(l => l.id === adj.locationId);
          const diff = adj.newQuantity - adj.previousQuantity;
          const isExp = expanded === adj.id;

          return (
            <div key={adj.id} className="border border-[#141414] bg-white/40">
              <div className="flex items-center justify-between gap-4 p-4 cursor-pointer" onClick={() => setExpanded(isExp ? null : adj.id)}>
                <div className="flex items-center gap-3 min-w-0 flex-wrap">
                  <span className={`font-mono text-[9px] font-bold border px-2 py-0.5 shrink-0 ${REASON_COLOR[adj.reason]}`}>
                    {REASON_LABEL[adj.reason]}
                  </span>
                  <span className="font-mono font-bold text-xs text-[#141414] truncate">
                    {prod ? `${prod.code} ${prod.name} ${prod.color || ''} ${prod.size || ''}`.trim() : adj.productId}
                  </span>
                  <span className="font-mono text-[10px] opacity-60 shrink-0">{loc?.name}</span>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-right">
                    <div className="font-mono text-[10px] opacity-50">{adj.previousQuantity} → {adj.newQuantity}</div>
                    <div className={`font-mono font-bold text-xs ${diffColor(adj.previousQuantity, adj.newQuantity)}`}>
                      {diff > 0 ? `+${diff}` : diff}
                    </div>
                  </div>
                  {isExp ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </div>
              </div>

              {isExp && (
                <div className="border-t border-[#141414] px-4 py-3 flex flex-wrap gap-4 text-[10px] font-mono">
                  <div><span className="opacity-50 uppercase">Fecha:</span> <span className="font-bold">{format(new Date(adj.date), 'dd MMM yyyy HH:mm', { locale: es })}</span></div>
                  <div><span className="opacity-50 uppercase">Usuario:</span> <span className="font-bold">{adj.user}</span></div>
                  {adj.notes && <div className="w-full"><span className="opacity-50 uppercase">Notas:</span> <span className="italic">{adj.notes}</span></div>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary cards */}
      {adjustments.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-2">
          {(Object.keys(REASON_LABEL) as AdjustmentReason[]).map(r => {
            const count = adjustments.filter(a => a.reason === r).length;
            return (
              <div key={r} className={`border p-3 cursor-pointer transition-all ${filterReason === r ? 'bg-[#141414] text-[#E4E3E0] border-[#141414]' : 'border-[#141414] bg-white/30 hover:bg-white/60'}`}
                onClick={() => setFilterReason(filterReason === r ? 'ALL' : r)}>
                <div className="font-mono text-[18px] font-black">{count}</div>
                <div className="font-mono text-[8px] uppercase tracking-widest opacity-70 mt-0.5">{REASON_LABEL[r]}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[#E4E3E0] border border-[#141414] shadow-[4px_4px_0_#141414] w-full max-w-md">
            <div className="border-b border-[#141414] px-5 py-3 flex justify-between items-center">
              <span className="font-mono font-bold text-xs uppercase tracking-widest">NUEVO AJUSTE DE INVENTARIO</span>
              <button onClick={() => setShowModal(false)} className="font-mono text-xs opacity-60 hover:opacity-100">✕</button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="font-mono text-[9px] font-bold uppercase tracking-widest opacity-60">Producto *</label>
                <select value={form.productId} onChange={e => setForm(f => ({ ...f, productId: e.target.value }))}
                  className="border border-[#141414] bg-white px-3 py-2 text-xs font-mono focus:outline-none cursor-pointer" required>
                  <option value="">Seleccionar...</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.code} — {p.name} {p.color} {p.size}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="font-mono text-[9px] font-bold uppercase tracking-widest opacity-60">Ubicación *</label>
                <select value={form.locationId} onChange={e => setForm(f => ({ ...f, locationId: e.target.value }))}
                  className="border border-[#141414] bg-white px-3 py-2 text-xs font-mono focus:outline-none cursor-pointer" required>
                  <option value="">Seleccionar...</option>
                  {locations.map(l => <option key={l.id} value={l.id}>{l.name} ({l.type})</option>)}
                </select>
              </div>

              <div className="bg-white/50 border border-[#141414]/30 px-4 py-3 flex justify-between items-center">
                <span className="font-mono text-[10px] opacity-60 uppercase">Stock actual en ubicación</span>
                <span className="font-mono font-black text-lg">{currentStock}</span>
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-mono text-[9px] font-bold uppercase tracking-widest opacity-60">Nueva cantidad *</label>
                <input type="number" min="0" value={form.newQuantity} onChange={e => setForm(f => ({ ...f, newQuantity: parseInt(e.target.value) || 0 }))}
                  className="border border-[#141414] bg-white px-3 py-2 text-sm font-mono font-bold focus:outline-none focus:shadow-[2px_2px_0_#141414] text-center" required />
                {form.newQuantity !== currentStock && (
                  <div className={`font-mono text-[10px] font-bold text-center ${form.newQuantity > currentStock ? 'text-green-700' : 'text-red-600'}`}>
                    Diferencia: {form.newQuantity > currentStock ? '+' : ''}{form.newQuantity - currentStock} unidades
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-mono text-[9px] font-bold uppercase tracking-widest opacity-60">Motivo *</label>
                <select value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value as AdjustmentReason }))}
                  className="border border-[#141414] bg-white px-3 py-2 text-xs font-mono focus:outline-none cursor-pointer">
                  {(Object.entries(REASON_LABEL) as [AdjustmentReason, string][]).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-mono text-[9px] font-bold uppercase tracking-widest opacity-60">Notas</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2}
                  className="border border-[#141414] bg-white px-3 py-2 text-xs font-mono focus:outline-none resize-none" />
              </div>

              {error && <p className="font-mono text-[10px] text-red-600 font-bold">{error}</p>}

              <div className="flex gap-2 pt-2">
                <button type="submit" className="flex-1 bg-[#141414] text-[#E4E3E0] py-2 text-xs font-bold font-mono uppercase hover:shadow-[2px_2px_0_#9f9d99] transition-all">REGISTRAR AJUSTE</button>
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 border border-[#141414] py-2 text-xs font-bold font-mono uppercase hover:bg-white/50">CANCELAR</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

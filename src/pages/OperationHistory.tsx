import React, { useState, useMemo } from 'react';
import { useAppContext } from '../store/AppContext';
import { ModuleInfo } from '../components/ModuleInfo';
import { format, parseISO, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronDown, ChevronUp, Filter, Download } from 'lucide-react';

type EventType = 'OPERATION' | 'ADJUSTMENT' | 'PURCHASE_ORDER';

type UnifiedEvent = {
  id: string;
  date: string;
  type: EventType;
  label: string;
  detail: string;
  user: string;
  productName?: string;
  quantity?: number;
  delta?: number;
};

const TYPE_COLOR: Record<EventType, string> = {
  OPERATION: 'border-blue-600 text-blue-700',
  ADJUSTMENT: 'border-orange-600 text-orange-700',
  PURCHASE_ORDER: 'border-purple-600 text-purple-700',
};

const TYPE_LABEL: Record<EventType, string> = {
  OPERATION: 'OPERACIÓN',
  ADJUSTMENT: 'AJUSTE',
  PURCHASE_ORDER: 'ORDEN COMPRA',
};

const TX_LABEL: Record<string, string> = {
  RECEPTION: 'RECEPCIÓN',
  DISPATCH: 'DESPACHO',
  TRANSFER: 'TRANSFERENCIA',
};

const ADJ_LABEL: Record<string, string> = {
  DAMAGE: 'DAÑO / ROTURA',
  LOSS: 'MERMA / PÉRDIDA',
  COUNT: 'CONTEO FÍSICO',
  RETURN: 'DEVOLUCIÓN',
  OTHER: 'OTRO',
};

const PO_LABEL: Record<string, string> = {
  DRAFT: 'BORRADOR',
  APPROVED: 'APROBADA',
  PARTIAL: 'PARCIAL',
  COMPLETED: 'COMPLETADA',
  CANCELLED: 'CANCELADA',
};

const exportCSV = (rows: UnifiedEvent[]) => {
  const headers = ['FECHA', 'MÓDULO', 'TIPO', 'PRODUCTO/DETALLE', 'REFERENCIA/USUARIO', 'CANTIDAD', 'DELTA'];
  const lines = rows.map(r => [
    format(new Date(r.date), 'dd/MM/yyyy HH:mm'),
    TYPE_LABEL[r.type],
    r.label,
    r.productName ?? r.detail,
    r.user,
    r.quantity ?? '',
    r.delta !== undefined ? (r.delta > 0 ? `+${r.delta}` : r.delta) : '',
  ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
  const csv = [headers.join(','), ...lines].join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `historial_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

export const OperationHistory: React.FC = () => {
  const { transactions, adjustments, purchaseOrders, products, locations, contacts } = useAppContext();
  const [filterType, setFilterType] = useState<'ALL' | EventType>('ALL');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const events = useMemo((): UnifiedEvent[] => {
    const ops: UnifiedEvent[] = transactions.map(tx => {
      const prod = products.find(p => p.id === tx.productId);
      const from = locations.find(l => l.id === tx.fromLocationId);
      const to = locations.find(l => l.id === tx.toLocationId);
      const detail = tx.type === 'TRANSFER'
        ? `${from?.name ?? '—'} → ${to?.name ?? '—'}`
        : tx.type === 'RECEPTION'
        ? `→ ${to?.name ?? '—'}`
        : `${from?.name ?? '—'} →`;
      return {
        id: tx.id,
        date: tx.date,
        type: 'OPERATION',
        label: TX_LABEL[tx.type] ?? tx.type,
        detail,
        user: tx.user,
        productName: prod ? `${prod.code} ${prod.name}` : tx.productId,
        quantity: tx.quantity,
      };
    });

    const adjs: UnifiedEvent[] = adjustments.map(adj => {
      const prod = products.find(p => p.id === adj.productId);
      const loc = locations.find(l => l.id === adj.locationId);
      return {
        id: adj.id,
        date: adj.date,
        type: 'ADJUSTMENT',
        label: ADJ_LABEL[adj.reason] ?? adj.reason,
        detail: loc?.name ?? '—',
        user: adj.user,
        productName: prod ? `${prod.code} ${prod.name}` : adj.productId,
        delta: adj.newQuantity - adj.previousQuantity,
      };
    });

    const pos: UnifiedEvent[] = purchaseOrders.map(po => {
      const supplier = contacts.find(c => c.id === po.supplierId);
      const totalUnits = po.items.reduce((s, i) => s + i.quantity, 0);
      return {
        id: po.id,
        date: po.date,
        type: 'PURCHASE_ORDER',
        label: PO_LABEL[po.status] ?? po.status,
        detail: supplier?.name ?? '—',
        user: po.reference,
        quantity: totalUnits,
      };
    });

    return [...ops, ...adjs, ...pos].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, adjustments, purchaseOrders, products, locations, contacts]);

  const filtered = useMemo(() => events.filter(e => {
    if (filterType !== 'ALL' && e.type !== filterType) return false;
    if (dateFrom || dateTo) {
      const d = new Date(e.date);
      if (dateFrom && d < startOfDay(parseISO(dateFrom))) return false;
      if (dateTo && d > endOfDay(parseISO(dateTo))) return false;
    }
    if (search) {
      const q = search.toLowerCase();
      return !!(
        e.productName?.toLowerCase().includes(q) ||
        e.label.toLowerCase().includes(q) ||
        e.detail.toLowerCase().includes(q) ||
        e.user.toLowerCase().includes(q)
      );
    }
    return true;
  }), [events, filterType, dateFrom, dateTo, search]);

  const counts: Record<EventType, number> = {
    OPERATION: events.filter(e => e.type === 'OPERATION').length,
    ADJUSTMENT: events.filter(e => e.type === 'ADJUSTMENT').length,
    PURCHASE_ORDER: events.filter(e => e.type === 'PURCHASE_ORDER').length,
  };

  return (
    <div className="flex flex-col gap-6 h-full relative">
      <ModuleInfo number="14" title="Historial General" description="Registro unificado y cronológico de todas las operaciones del sistema: movimientos de stock, ajustes e historial de órdenes de compra en una sola vista." />
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 border-b border-[#141414] pb-3">
        <div>
          <h2 className="font-serif italic font-bold text-xs uppercase tracking-widest text-[#141414]">14 // HISTORIAL_OPERACIONES_GENERAL</h2>
          <p className="font-mono text-[10px] opacity-70 uppercase tracking-wide mt-1">Registro unificado de todas las operaciones del sistema.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 border border-[#141414] bg-white/50 px-2">
            <span className="font-mono text-[9px] opacity-40 uppercase shrink-0">DESDE</span>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="bg-transparent py-2 text-[10px] font-mono focus:outline-none w-32 cursor-pointer" />
          </div>
          <div className="flex items-center gap-1 border border-[#141414] bg-white/50 px-2">
            <span className="font-mono text-[9px] opacity-40 uppercase shrink-0">HASTA</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="bg-transparent py-2 text-[10px] font-mono focus:outline-none w-32 cursor-pointer" />
          </div>
          {(dateFrom || dateTo) && (
            <button onClick={() => { setDateFrom(''); setDateTo(''); }}
              className="font-mono text-[9px] font-bold uppercase opacity-50 hover:opacity-100 border border-[#141414]/30 px-2 py-2">
              ✕ LIMPIAR
            </button>
          )}
          <div className="relative">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="BUSCAR..."
              className="border border-[#141414] bg-white/50 pl-3 pr-8 py-2 text-[10px] font-mono uppercase placeholder:opacity-40 focus:outline-none focus:shadow-[2px_2px_0_#141414] w-36"
            />
            <Filter size={11} className="absolute right-2.5 top-1/2 -translate-y-1/2 opacity-40" />
          </div>
          <select value={filterType} onChange={e => setFilterType(e.target.value as any)}
            className="border border-[#141414] bg-white/50 px-3 py-2 text-[10px] font-mono font-bold uppercase focus:outline-none cursor-pointer">
            <option value="ALL">TODOS ({events.length})</option>
            <option value="OPERATION">OPERACIONES ({counts.OPERATION})</option>
            <option value="ADJUSTMENT">AJUSTES ({counts.ADJUSTMENT})</option>
            <option value="PURCHASE_ORDER">ÓRDENES OC ({counts.PURCHASE_ORDER})</option>
          </select>
          <button onClick={() => exportCSV(filtered)}
            className="flex items-center gap-2 bg-[#141414] text-[#E4E3E0] px-3 py-2 text-[10px] font-bold font-mono uppercase hover:shadow-[2px_2px_0_#9f9d99] transition-all shrink-0">
            <Download size={12} /> CSV ({filtered.length})
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        {(Object.keys(counts) as EventType[]).map(t => (
          <div
            key={t}
            onClick={() => setFilterType(filterType === t ? 'ALL' : t)}
            className={`border p-3 cursor-pointer transition-all ${filterType === t ? 'bg-[#141414] text-[#E4E3E0] border-[#141414]' : 'border-[#141414] bg-white/30 hover:bg-white/60'}`}
          >
            <div className="font-mono text-[22px] font-black">{counts[t]}</div>
            <div className="font-mono text-[8px] uppercase tracking-widest opacity-70 mt-0.5">{TYPE_LABEL[t]}</div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center font-mono text-xs opacity-50 py-16 uppercase tracking-widest">Sin registros</div>
      )}

      <div className="flex flex-col gap-2">
        {filtered.map(ev => {
          const isExp = expanded === ev.id;
          return (
            <div key={ev.id} className="border border-[#141414] bg-white/40">
              <div
                className="flex items-center justify-between gap-4 p-3 cursor-pointer"
                onClick={() => setExpanded(isExp ? null : ev.id)}
              >
                <div className="flex items-center gap-3 min-w-0 flex-wrap">
                  <span className={`font-mono text-[9px] font-bold border px-2 py-0.5 shrink-0 ${TYPE_COLOR[ev.type]}`}>
                    {TYPE_LABEL[ev.type]}
                  </span>
                  <span className={`font-mono text-[9px] font-bold border px-2 py-0.5 shrink-0 border-[#141414]/30 text-[#141414]/70`}>
                    {ev.label}
                  </span>
                  {ev.productName && (
                    <span className="font-mono font-bold text-xs text-[#141414] truncate">{ev.productName}</span>
                  )}
                  <span className="font-mono text-[10px] opacity-50 shrink-0">{ev.detail}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {ev.delta !== undefined && (
                    <span className={`font-mono font-bold text-xs ${ev.delta > 0 ? 'text-green-700' : ev.delta < 0 ? 'text-red-600' : 'text-[#9f9d99]'}`}>
                      {ev.delta > 0 ? `+${ev.delta}` : ev.delta}
                    </span>
                  )}
                  {ev.quantity !== undefined && ev.delta === undefined && (
                    <span className="font-mono font-bold text-xs text-[#141414]">{ev.quantity} u.</span>
                  )}
                  <span className="font-mono text-[9px] opacity-40">
                    {format(new Date(ev.date), 'dd MMM yyyy', { locale: es })}
                  </span>
                  {isExp ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                </div>
              </div>

              {isExp && (
                <div className="border-t border-[#141414]/20 px-4 py-3 flex flex-wrap gap-4 text-[10px] font-mono bg-white/20">
                  <div><span className="opacity-50 uppercase">Fecha:</span> <span className="font-bold">{format(new Date(ev.date), 'dd MMM yyyy HH:mm', { locale: es })}</span></div>
                  <div><span className="opacity-50 uppercase">{ev.type === 'PURCHASE_ORDER' ? 'Referencia' : 'Usuario'}:</span> <span className="font-bold">{ev.user}</span></div>
                  {ev.productName && <div><span className="opacity-50 uppercase">Producto:</span> <span className="font-bold">{ev.productName}</span></div>}
                  <div><span className="opacity-50 uppercase">Módulo:</span> <span className="font-bold">{TYPE_LABEL[ev.type]}</span></div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

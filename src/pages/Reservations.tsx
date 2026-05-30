import React, { useState, useMemo } from 'react';
import {
  ClipboardList, Columns, Table2, Plus, X,
  Package, MapPin, User, Calendar, AlertTriangle, CheckCircle2,
  Clock, Ban, ArrowRight, Search, ChevronRight
} from 'lucide-react';
import { useAppContext } from '../store/AppContext';
import { Reservation, ReservationStatus } from '../types';

// ─── Columnas del kanban ──────────────────────────────────────────────────────

const COLUMNS: { status: ReservationStatus; label: string; color: string; border: string; dot: string; icon: React.ReactNode }[] = [
  {
    status: 'SOLICITADA', label: 'SOLICITADA',
    color: 'bg-amber-50', border: 'border-amber-400', dot: 'bg-amber-400',
    icon: <Clock size={13} className="text-amber-600" />
  },
  {
    status: 'CONFIRMADA', label: 'CONFIRMADA',
    color: 'bg-blue-50', border: 'border-blue-400', dot: 'bg-blue-400',
    icon: <CheckCircle2 size={13} className="text-blue-600" />
  },
  {
    status: 'LISTA', label: 'LISTA P/ ENTREGA',
    color: 'bg-green-50', border: 'border-green-400', dot: 'bg-green-400',
    icon: <Package size={13} className="text-green-600" />
  },
  {
    status: 'ENTREGADA', label: 'ENTREGADA',
    color: 'bg-[#f5f5f4]', border: 'border-[#9f9d99]', dot: 'bg-[#9f9d99]',
    icon: <ArrowRight size={13} className="text-[#9f9d99]" />
  },
  {
    status: 'CANCELADA', label: 'CANCELADA',
    color: 'bg-red-50', border: 'border-red-300', dot: 'bg-red-400',
    icon: <Ban size={13} className="text-red-500" />
  },
];

const STATUS_NEXT: Partial<Record<ReservationStatus, ReservationStatus>> = {
  SOLICITADA: 'CONFIRMADA',
  CONFIRMADA: 'LISTA',
  LISTA: 'ENTREGADA',
};

function isExpired(expiresAt?: string) {
  if (!expiresAt) return false;
  return new Date(expiresAt) < new Date();
}

function fmtDate(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── Tarjeta Kanban ───────────────────────────────────────────────────────────

function KanbanCard({
  res, productName, productColor, productSize, locationName, onAdvance,
}: {
  res: Reservation;
  productName: string;
  productColor?: string;
  productSize?: string;
  locationName?: string;
  onAdvance?: (id: string, next: ReservationStatus) => void;
  key?: React.Key;
}) {
  const expired = isExpired(res.expiresAt) && res.status !== 'ENTREGADA' && res.status !== 'CANCELADA';
  const next = STATUS_NEXT[res.status];

  return (
    <div className="bg-white/80 border border-[#141414] rounded-sm p-3 flex flex-col gap-2
                    hover:shadow-[2px_2px_0_#141414] transition-shadow group">
      {/* Referencia */}
      <div className="flex items-start justify-between gap-1">
        <span className="font-mono text-[10px] font-bold tracking-widest text-[#141414]/50 uppercase">
          {res.reference}
        </span>
        {next && onAdvance && (
          <button
            onClick={() => onAdvance(res.id, next)}
            title={`Avanzar a ${next}`}
            className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5
                       font-mono text-[8px] tracking-wider text-[#141414]/50 hover:text-[#141414]
                       border border-[#141414]/20 hover:border-[#141414] px-1.5 py-0.5 rounded-sm"
          >
            {next} <ChevronRight size={10} />
          </button>
        )}
      </div>

      {/* Producto */}
      <div className="flex items-center gap-1.5">
        <Package size={12} className="text-[#141414]/50 shrink-0" />
        <span className="font-medium text-[13px] text-[#141414] leading-tight truncate">
          {productName}
        </span>
      </div>

      {/* Tags */}
      <div className="flex gap-1 flex-wrap">
        {productColor && (
          <span className="font-mono text-[9px] tracking-wider border border-[#141414]/20 px-1.5 py-0.5 rounded-sm bg-[#E4E3E0] text-[#141414]/70 uppercase">
            {productColor}
          </span>
        )}
        {productSize && (
          <span className="font-mono text-[9px] tracking-wider border border-[#141414]/20 px-1.5 py-0.5 rounded-sm bg-[#E4E3E0] text-[#141414]/70 uppercase">
            {productSize}
          </span>
        )}
        <span className="font-mono text-[9px] tracking-wider border border-[#141414]/30 px-1.5 py-0.5 rounded-sm text-[#141414] font-bold">
          ×{res.quantity} uds
        </span>
      </div>

      {/* Info */}
      <div className="flex flex-col gap-1 text-[11px] text-[#141414]/60">
        <div className="flex items-center gap-1.5">
          <User size={10} className="shrink-0" />
          <span className="truncate">{res.client}</span>
        </div>
        {locationName && (
          <div className="flex items-center gap-1.5">
            <MapPin size={10} className="shrink-0" />
            <span className="truncate">{locationName}</span>
          </div>
        )}
        {res.expiresAt && (
          <div className="flex items-center gap-1.5">
            <Calendar size={10} className="shrink-0" />
            <span className={expired ? 'text-red-500 font-semibold' : ''}>
              Vence: {fmtDate(res.expiresAt)}
            </span>
            {expired && <AlertTriangle size={10} className="text-red-500 shrink-0" />}
          </div>
        )}
      </div>

      {/* Notas */}
      {res.notes && (
        <p className="text-[10px] text-[#141414]/50 italic border-t border-[#141414]/10 pt-1.5 leading-snug">
          {res.notes}
        </p>
      )}
    </div>
  );
}

// ─── Columna Kanban ───────────────────────────────────────────────────────────

function KanbanColumn({
  col, cards, products, locations, onAdvance,
}: {
  col: typeof COLUMNS[number];
  cards: Reservation[];
  products: ReturnType<typeof useAppContext>['products'];
  locations: ReturnType<typeof useAppContext>['locations'];
  onAdvance: (id: string, next: ReservationStatus) => void;
  key?: React.Key;
}) {
  return (
    <div className="flex flex-col gap-2 min-w-[220px] w-[220px] shrink-0">
      <div className={`border ${col.border} rounded-sm px-3 py-2 flex items-center justify-between ${col.color}`}>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${col.dot}`} />
          <span className="font-mono text-[10px] font-black tracking-widest text-[#141414] uppercase">
            {col.label}
          </span>
        </div>
        <span className="font-mono text-[10px] font-bold text-[#141414]/50">{cards.length}</span>
      </div>
      <div className="flex flex-col gap-2 min-h-[120px]">
        {cards.length === 0 ? (
          <div className="border border-dashed border-[#141414]/15 rounded-sm h-20 flex items-center justify-center">
            <span className="text-[10px] font-mono text-[#141414]/25 uppercase tracking-wider">Vacío</span>
          </div>
        ) : (
          cards.map(r => {
            const prod = products.find(p => p.id === r.productId);
            const loc = locations.find(l => l.id === r.locationId);
            return (
              <KanbanCard
                key={r.id}
                res={r}
                productName={prod?.name ?? r.productId}
                productColor={prod?.color}
                productSize={prod?.size}
                locationName={loc?.name}
                onAdvance={onAdvance}
              />
            );
          })
        )}
      </div>
    </div>
  );
}

// ─── Modal Nueva Reserva ──────────────────────────────────────────────────────

function NewReservationModal({
  onClose,
  onSave,
  products,
  locations,
  currentUser,
}: {
  onClose: () => void;
  onSave: (r: Omit<Reservation, 'id' | 'brand' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  products: ReturnType<typeof useAppContext>['products'];
  locations: ReturnType<typeof useAppContext>['locations'];
  currentUser: ReturnType<typeof useAppContext>['currentUser'];
}) {
  const [form, setForm] = useState({
    reference: '',
    productId: '',
    locationId: '',
    quantity: 1,
    client: '',
    status: 'SOLICITADA' as ReservationStatus,
    notes: '',
    expiresAt: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.reference.trim()) { setError('La referencia es obligatoria'); return; }
    if (!form.productId) { setError('Selecciona un producto'); return; }
    if (!form.client.trim()) { setError('El cliente es obligatorio'); return; }
    setSaving(true);
    try {
      await onSave({
        reference: form.reference.trim(),
        productId: form.productId,
        locationId: form.locationId || undefined,
        quantity: form.quantity,
        client: form.client.trim(),
        status: form.status,
        notes: form.notes.trim() || undefined,
        expiresAt: form.expiresAt || undefined,
        createdBy: currentUser.username,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-[#E4E3E0] border border-[#141414] shadow-[4px_4px_0_#141414] w-full max-w-lg">
        <div className="border-b border-[#141414] px-5 py-3.5 flex justify-between items-center">
          <span className="font-mono font-black text-[11px] uppercase tracking-widest">Nueva Reserva</span>
          <button onClick={onClose} className="p-1 hover:bg-[#141414]/10 rounded-sm transition-colors">
            <X size={14} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
          {error && (
            <div className="border border-red-500 bg-red-50 text-red-700 px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-wide rounded-sm">
              {error}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            {/* Referencia */}
            <div className="flex flex-col gap-1 col-span-2">
              <label className="font-mono text-[9px] font-bold uppercase tracking-widest text-[#141414]/50">Referencia *</label>
              <input
                value={form.reference}
                onChange={e => setForm(f => ({ ...f, reference: e.target.value }))}
                placeholder="RSV-001"
                className="border border-[#141414] bg-white px-3 py-2 text-xs font-mono focus:outline-none focus:shadow-[2px_2px_0_#141414]"
                required
              />
            </div>

            {/* Producto */}
            <div className="flex flex-col gap-1 col-span-2">
              <label className="font-mono text-[9px] font-bold uppercase tracking-widest text-[#141414]/50">Producto *</label>
              <select
                value={form.productId}
                onChange={e => setForm(f => ({ ...f, productId: e.target.value }))}
                className="border border-[#141414] bg-white px-3 py-2 text-xs font-mono focus:outline-none focus:shadow-[2px_2px_0_#141414] cursor-pointer"
                required
              >
                <option value="">— Seleccionar producto —</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name}{p.color ? ` · ${p.color}` : ''}{p.size ? ` · ${p.size}` : ''} ({p.code})
                  </option>
                ))}
              </select>
            </div>

            {/* Ubicación */}
            <div className="flex flex-col gap-1 col-span-2">
              <label className="font-mono text-[9px] font-bold uppercase tracking-widest text-[#141414]/50">Ubicación</label>
              <select
                value={form.locationId}
                onChange={e => setForm(f => ({ ...f, locationId: e.target.value }))}
                className="border border-[#141414] bg-white px-3 py-2 text-xs font-mono focus:outline-none focus:shadow-[2px_2px_0_#141414] cursor-pointer"
              >
                <option value="">— Sin ubicación específica —</option>
                {locations.map(l => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>

            {/* Cantidad */}
            <div className="flex flex-col gap-1">
              <label className="font-mono text-[9px] font-bold uppercase tracking-widest text-[#141414]/50">Cantidad *</label>
              <input
                type="number" min={1}
                value={form.quantity}
                onChange={e => setForm(f => ({ ...f, quantity: Math.max(1, parseInt(e.target.value) || 1) }))}
                className="border border-[#141414] bg-white px-3 py-2 text-xs font-mono focus:outline-none focus:shadow-[2px_2px_0_#141414]"
                required
              />
            </div>

            {/* Estado inicial */}
            <div className="flex flex-col gap-1">
              <label className="font-mono text-[9px] font-bold uppercase tracking-widest text-[#141414]/50">Estado inicial</label>
              <select
                value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value as ReservationStatus }))}
                className="border border-[#141414] bg-white px-3 py-2 text-xs font-mono focus:outline-none focus:shadow-[2px_2px_0_#141414] cursor-pointer"
              >
                <option value="SOLICITADA">SOLICITADA</option>
                <option value="CONFIRMADA">CONFIRMADA</option>
                <option value="LISTA">LISTA</option>
              </select>
            </div>

            {/* Cliente */}
            <div className="flex flex-col gap-1 col-span-2">
              <label className="font-mono text-[9px] font-bold uppercase tracking-widest text-[#141414]/50">Cliente / Destino *</label>
              <input
                value={form.client}
                onChange={e => setForm(f => ({ ...f, client: e.target.value }))}
                placeholder="Nombre del cliente o canal"
                className="border border-[#141414] bg-white px-3 py-2 text-xs font-mono focus:outline-none focus:shadow-[2px_2px_0_#141414]"
                required
              />
            </div>

            {/* Fecha vencimiento */}
            <div className="flex flex-col gap-1 col-span-2">
              <label className="font-mono text-[9px] font-bold uppercase tracking-widest text-[#141414]/50">Fecha de vencimiento</label>
              <input
                type="date"
                value={form.expiresAt}
                onChange={e => setForm(f => ({ ...f, expiresAt: e.target.value }))}
                className="border border-[#141414] bg-white px-3 py-2 text-xs font-mono focus:outline-none focus:shadow-[2px_2px_0_#141414]"
              />
            </div>

            {/* Notas */}
            <div className="flex flex-col gap-1 col-span-2">
              <label className="font-mono text-[9px] font-bold uppercase tracking-widest text-[#141414]/50">Notas</label>
              <textarea
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                rows={2}
                placeholder="Observaciones opcionales..."
                className="border border-[#141414] bg-white px-3 py-2 text-xs font-mono focus:outline-none focus:shadow-[2px_2px_0_#141414] resize-none"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="submit" disabled={saving}
              className="flex-1 bg-[#141414] text-[#E4E3E0] py-2.5 text-xs font-bold font-mono uppercase
                         hover:shadow-[2px_2px_0_#9f9d99] disabled:opacity-50 transition-all"
            >
              {saving ? 'GUARDANDO...' : 'CREAR RESERVA'}
            </button>
            <button
              type="button" onClick={onClose} disabled={saving}
              className="flex-1 border border-[#141414] py-2.5 text-xs font-bold font-mono uppercase hover:bg-white/50 disabled:opacity-50 transition-all"
            >
              CANCELAR
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Pestaña Kanban ───────────────────────────────────────────────────────────

function KanbanTab({
  reservations, products, locations, onAdvance, onNewReservation,
}: {
  reservations: Reservation[];
  products: ReturnType<typeof useAppContext>['products'];
  locations: ReturnType<typeof useAppContext>['locations'];
  onAdvance: (id: string, next: ReservationStatus) => void;
  onNewReservation: () => void;
}) {
  const [showDone, setShowDone] = useState(false);

  const active = reservations.filter(r => r.status !== 'ENTREGADA' && r.status !== 'CANCELADA');
  const done = reservations.filter(r => r.status === 'ENTREGADA' || r.status === 'CANCELADA');
  const shown = showDone ? reservations : active;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <button
          onClick={() => setShowDone(!showDone)}
          className={`font-mono text-[10px] tracking-widest uppercase px-3 py-1.5 border rounded-sm transition-colors
            ${showDone
              ? 'bg-[#141414] text-[#E4E3E0] border-[#141414]'
              : 'bg-white/50 text-[#141414]/60 border-[#141414]/20 hover:border-[#141414]/50'}`}
        >
          {showDone ? 'Ocultar finalizadas' : `Ver finalizadas (${done.length})`}
        </button>
        <button
          onClick={onNewReservation}
          className="flex items-center gap-2 bg-[#141414] text-[#E4E3E0] px-3 py-1.5 border border-[#141414]
                     font-mono text-[10px] tracking-widest uppercase hover:shadow-[2px_2px_0_#9f9d99] transition-all"
        >
          <Plus size={12} /> Nueva reserva
        </button>
      </div>

      <div className="overflow-x-auto pb-4">
        <div className="flex gap-3 w-max">
          {COLUMNS
            .filter(col => showDone || (col.status !== 'ENTREGADA' && col.status !== 'CANCELADA'))
            .map(col => (
              <KanbanColumn
                key={col.status}
                col={col}
                cards={shown.filter(r => r.status === col.status)}
                products={products}
                locations={locations}
                onAdvance={onAdvance}
              />
            ))}
        </div>
      </div>
    </div>
  );
}

// ─── Pestaña Stock Reservado ──────────────────────────────────────────────────

function StockTab({
  reservations, products, stockLevels, locations,
}: {
  reservations: Reservation[];
  products: ReturnType<typeof useAppContext>['products'];
  stockLevels: ReturnType<typeof useAppContext>['stockLevels'];
  locations: ReturnType<typeof useAppContext>['locations'];
}) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'ALL' | 'RESERVADO' | 'CRITICO'>('ALL');
  const [modelFilter, setModelFilter] = useState('');
  const [colorFilter, setColorFilter] = useState('');
  const [sizeFilter, setSizeFilter] = useState('');

  // Modelos únicos (nombres de producto sin color/talla)
  const models = useMemo(() => [...new Set(products.map(p => p.name))].sort(), [products]);
  const colors = useMemo(() => [...new Set(products.map(p => p.color).filter(Boolean))].sort() as string[], [products]);
  const sizes = useMemo(() => [...new Set(products.map(p => p.size).filter(Boolean))].sort() as string[], [products]);

  // Calcular unidades reservadas por producto (solo reservas activas)
  const reservedByProduct = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of reservations) {
      if (r.status !== 'ENTREGADA' && r.status !== 'CANCELADA') {
        map[r.productId] = (map[r.productId] ?? 0) + r.quantity;
      }
    }
    return map;
  }, [reservations]);

  // Stock total por producto sumando todas las ubicaciones
  const totalByProduct = useMemo(() => {
    const map: Record<string, number> = {};
    for (const sl of stockLevels) {
      map[sl.productId] = (map[sl.productId] ?? 0) + sl.quantity;
    }
    return map;
  }, [stockLevels]);

  // Ubicación principal del producto (la de mayor stock)
  const mainLocationByProduct = useMemo(() => {
    const map: Record<string, string> = {};
    const maxQty: Record<string, number> = {};
    for (const sl of stockLevels) {
      if ((sl.quantity ?? 0) > (maxQty[sl.productId] ?? -1)) {
        maxQty[sl.productId] = sl.quantity;
        const loc = locations.find(l => l.id === sl.locationId);
        map[sl.productId] = loc?.name ?? sl.locationId;
      }
    }
    return map;
  }, [stockLevels, locations]);

  const rows = useMemo(() => {
    return products
      .map(p => ({
        product: p,
        total: totalByProduct[p.id] ?? 0,
        reserved: reservedByProduct[p.id] ?? 0,
        location: mainLocationByProduct[p.id] ?? '—',
      }))
      .filter(row => {
        const q = search.toLowerCase();
        if (q && !row.product.name.toLowerCase().includes(q) && !row.product.code.toLowerCase().includes(q)) return false;
        if (modelFilter && row.product.name !== modelFilter) return false;
        if (colorFilter && row.product.color !== colorFilter) return false;
        if (sizeFilter && row.product.size !== sizeFilter) return false;
        if (filter === 'RESERVADO') return row.reserved > 0;
        if (filter === 'CRITICO') return row.total > 0 && row.reserved / row.total >= 0.5 && row.reserved > 0;
        return true;
      });
  }, [products, totalByProduct, reservedByProduct, mainLocationByProduct, search, modelFilter, colorFilter, sizeFilter, filter]);

  const hasActiveFilters = search || modelFilter || colorFilter || sizeFilter || filter !== 'ALL';

  const selectCls = "bg-white/60 border border-[#141414]/20 rounded-sm px-2 py-1.5 font-mono text-[10px] text-[#141414] focus:outline-none focus:border-[#141414] cursor-pointer uppercase tracking-wider";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 flex-wrap">
        {/* Búsqueda */}
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#141414]/40" />
          <input
            type="text"
            placeholder="Nombre o código..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-white/60 border border-[#141414]/20 rounded-sm pl-8 pr-7 py-1.5
                       font-mono text-[11px] text-[#141414] placeholder-[#141414]/30
                       focus:outline-none focus:border-[#141414] w-48"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2">
              <X size={11} className="text-[#141414]/40" />
            </button>
          )}
        </div>

        {/* Modelo */}
        <select value={modelFilter} onChange={e => setModelFilter(e.target.value)} className={selectCls}>
          <option value="">Modelo</option>
          {models.map(m => <option key={m} value={m}>{m}</option>)}
        </select>

        {/* Color */}
        {colors.length > 0 && (
          <select value={colorFilter} onChange={e => setColorFilter(e.target.value)} className={selectCls}>
            <option value="">Color</option>
            {colors.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}

        {/* Talla */}
        {sizes.length > 0 && (
          <select value={sizeFilter} onChange={e => setSizeFilter(e.target.value)} className={selectCls}>
            <option value="">Talla</option>
            {sizes.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        )}

        {/* Stock */}
        {(['ALL', 'RESERVADO', 'CRITICO'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`font-mono text-[10px] tracking-widest uppercase px-3 py-1.5 border rounded-sm transition-colors
              ${filter === f
                ? 'bg-[#141414] text-[#E4E3E0] border-[#141414]'
                : 'bg-white/50 text-[#141414]/60 border-[#141414]/20 hover:border-[#141414]/50'}`}
          >
            {f === 'ALL' ? 'Todos' : f === 'RESERVADO' ? 'Con reserva' : 'Crítico ≥50%'}
          </button>
        ))}

        {/* Limpiar */}
        {hasActiveFilters && (
          <button
            onClick={() => { setSearch(''); setModelFilter(''); setColorFilter(''); setSizeFilter(''); setFilter('ALL'); }}
            className="font-mono text-[10px] tracking-widest uppercase px-3 py-1.5 border border-red-300 text-red-500 rounded-sm hover:bg-red-50 transition-colors flex items-center gap-1"
          >
            <X size={10} /> Limpiar
          </button>
        )}

        <span className="font-mono text-[10px] text-[#141414]/40 tracking-wider ml-auto">
          {rows.length} producto{rows.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="border border-[#141414] rounded-sm overflow-hidden">
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr] bg-[#141414] text-[#E4E3E0] px-4 py-2.5 gap-4">
          {['PRODUCTO', 'CÓDIGO', 'UBICACIÓN', 'TOTAL', 'RESERVADO', 'DISPONIBLE'].map(h => (
            <span key={h} className="font-mono text-[9px] tracking-widest uppercase font-black">{h}</span>
          ))}
        </div>
        {rows.length === 0 ? (
          <div className="py-12 flex flex-col items-center gap-2 bg-white/30">
            <Package size={24} className="text-[#141414]/20" />
            <span className="font-mono text-[10px] text-[#141414]/30 tracking-wider uppercase">Sin resultados</span>
          </div>
        ) : (
          rows.map(({ product: p, total, reserved, location }) => {
            const available = total - reserved;
            const pct = total > 0 ? (reserved / total) * 100 : 0;
            const isCritical = pct >= 50 && reserved > 0;
            const isOver = available < 0;
            return (
              <div
                key={p.id}
                className={`grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr] px-4 py-3 gap-4 items-center
                            border-b border-[#141414]/10 last:border-0 transition-colors
                            ${isCritical ? 'bg-amber-50/60 hover:bg-amber-50' : 'bg-white/40 hover:bg-white/70'}`}
              >
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium text-[13px] text-[#141414] truncate">{p.name}</span>
                  <div className="flex gap-1">
                    {p.color && <span className="font-mono text-[9px] text-[#141414]/50 uppercase">{p.color}</span>}
                    {p.size && <span className="font-mono text-[9px] text-[#141414]/50 uppercase">· {p.size}</span>}
                  </div>
                  {reserved > 0 && (
                    <div className="h-1 w-full bg-[#141414]/10 rounded-full mt-1 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${isCritical ? 'bg-amber-400' : 'bg-blue-400'}`}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                  )}
                </div>
                <span className="font-mono text-[11px] text-[#141414]/60 tracking-wider">{p.code}</span>
                <div className="flex items-center gap-1">
                  <MapPin size={10} className="text-[#141414]/40 shrink-0" />
                  <span className="font-mono text-[11px] text-[#141414]/70 truncate">{location}</span>
                </div>
                <span className="font-mono text-[12px] font-bold text-[#141414]">{total}</span>
                <div className="flex items-center gap-1">
                  {isCritical && <AlertTriangle size={11} className="text-amber-500 shrink-0" />}
                  <span className={`font-mono text-[12px] font-bold ${reserved > 0 ? 'text-amber-600' : 'text-[#141414]/30'}`}>
                    {reserved}
                  </span>
                </div>
                <span className={`font-mono text-[12px] font-bold ${isOver ? 'text-red-600' : available === 0 ? 'text-amber-500' : 'text-green-600'}`}>
                  {available}
                </span>
              </div>
            );
          })
        )}
      </div>

      <div className="flex items-center gap-4 justify-end">
        {[
          { color: 'bg-green-500', label: 'Disponible' },
          { color: 'bg-amber-400', label: 'Crítico ≥50%' },
          { color: 'bg-red-500', label: 'Stock negativo' },
        ].map(l => (
          <div key={l.label} className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${l.color}`} />
            <span className="font-mono text-[9px] text-[#141414]/40 tracking-wider uppercase">{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Módulo principal ─────────────────────────────────────────────────────────

export const Reservations: React.FC = () => {
  const { reservations, products, locations, stockLevels, currentUser, addReservation, updateReservationStatus } = useAppContext();
  const [tab, setTab] = useState<'kanban' | 'stock'>('kanban');
  const [showNewModal, setShowNewModal] = useState(false);

  const totalActive = reservations.filter(r => r.status !== 'ENTREGADA' && r.status !== 'CANCELADA').length;
  const totalReservedUnits = useMemo(() => {
    return reservations
      .filter(r => r.status !== 'ENTREGADA' && r.status !== 'CANCELADA')
      .reduce((acc, r) => acc + r.quantity, 0);
  }, [reservations]);

  const criticalCount = useMemo(() => {
    const reservedByProduct: Record<string, number> = {};
    for (const r of reservations) {
      if (r.status !== 'ENTREGADA' && r.status !== 'CANCELADA') {
        reservedByProduct[r.productId] = (reservedByProduct[r.productId] ?? 0) + r.quantity;
      }
    }
    const totalByProduct: Record<string, number> = {};
    for (const sl of stockLevels) {
      totalByProduct[sl.productId] = (totalByProduct[sl.productId] ?? 0) + sl.quantity;
    }
    return Object.entries(reservedByProduct).filter(([pid, res]) => {
      const total = totalByProduct[pid] ?? 0;
      return total > 0 && res / total >= 0.5;
    }).length;
  }, [reservations, stockLevels]);

  const handleAdvance = async (id: string, next: ReservationStatus) => {
    await updateReservationStatus(id, next);
  };

  return (
    <div className="flex flex-col h-full gap-0 -m-4 md:-m-6 lg:-m-8">
      {/* Page header */}
      <div className="border-b border-[#141414] px-6 py-4 bg-[#E4E3E0] flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <ClipboardList size={18} className="text-[#141414]" />
          <div>
            <h1 className="font-mono font-black text-sm tracking-widest text-[#141414] uppercase">
              Reservas de Inventario
            </h1>
            <p className="font-mono text-[9px] text-[#141414]/40 tracking-wider uppercase mt-0.5">
              Gestión y seguimiento de stock apartado
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-end">
            <span className="font-mono font-black text-lg text-[#141414]">{totalActive}</span>
            <span className="font-mono text-[9px] text-[#141414]/40 tracking-wider uppercase">Activas</span>
          </div>
          <div className="w-px h-8 bg-[#141414]/20" />
          <div className="flex flex-col items-end">
            <span className="font-mono font-black text-lg text-amber-600">{totalReservedUnits}</span>
            <span className="font-mono text-[9px] text-[#141414]/40 tracking-wider uppercase">Uds apartadas</span>
          </div>
          <div className="w-px h-8 bg-[#141414]/20" />
          <div className="flex flex-col items-end">
            <span className={`font-mono font-black text-lg ${criticalCount > 0 ? 'text-red-500' : 'text-green-600'}`}>
              {criticalCount}
            </span>
            <span className="font-mono text-[9px] text-[#141414]/40 tracking-wider uppercase">Críticos</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-[#141414] bg-[#E4E3E0] flex">
        {[
          { key: 'kanban', label: 'Kanban', icon: <Columns size={13} /> },
          { key: 'stock', label: 'Stock Reservado', icon: <Table2 size={13} /> },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as typeof tab)}
            className={`flex items-center gap-2 px-5 py-3 font-mono text-[10px] tracking-widest uppercase
                        border-b-2 transition-colors
                        ${tab === t.key
                          ? 'border-[#141414] text-[#141414] font-black'
                          : 'border-transparent text-[#141414]/40 hover:text-[#141414]/70'}`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Contenido */}
      <div className="flex-1 overflow-auto p-6">
        {tab === 'kanban' ? (
          <KanbanTab
            reservations={reservations}
            products={products}
            locations={locations}
            onAdvance={handleAdvance}
            onNewReservation={() => setShowNewModal(true)}
          />
        ) : (
          <StockTab
            reservations={reservations}
            products={products}
            stockLevels={stockLevels}
            locations={locations}
          />
        )}
      </div>

      {/* Modal nueva reserva */}
      {showNewModal && (
        <NewReservationModal
          onClose={() => setShowNewModal(false)}
          onSave={addReservation}
          products={products}
          locations={locations}
          currentUser={currentUser}
        />
      )}
    </div>
  );
};

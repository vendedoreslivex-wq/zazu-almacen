import React, { useMemo, useState } from 'react';
import { Package, Truck, MapPin, Calendar, Search, ClipboardList, List, ChevronLeft, ChevronRight, X, Hash, Building2 } from 'lucide-react';
import { useAppContext } from '../store/AppContext';
import { ModuleInfo } from '../components/ModuleInfo';
import { Product, Location, Transaction } from '../types';
import { cn } from '../lib/utils';

const MONTH_LABEL = [
  'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE',
];
const WEEKDAY_LABEL = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('es-PE', {
    timeZone: 'America/Lima', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

/** Clave YYYY-MM-DD de una fecha ISO, en hora de Lima (UTC-5, sin DST). */
function limaDayKey(iso: string): string {
  const limaMs = new Date(iso).getTime() - 5 * 60 * 60 * 1000;
  return new Date(limaMs).toISOString().slice(0, 10);
}

function fmtDayLong(key: string) {
  return new Date(key + 'T00:00:00').toLocaleDateString('es-PE', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
}

interface Row {
  tx: Transaction;
  product: Product | undefined;
  location: Location | undefined;
  supplierName: string | undefined;
}

const ReceptionRow: React.FC<Row> = ({ tx, product, location, supplierName }) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 px-4 py-3">
      <div className="flex items-center gap-2 sm:w-36 shrink-0">
        <Hash size={11} className="opacity-30 shrink-0" />
        <span className="font-mono font-black text-[10px] uppercase tracking-wider truncate">{tx.reference}</span>
      </div>

      <div className="flex items-center gap-1.5 flex-1 min-w-0">
        <Package size={11} className="opacity-40 shrink-0" />
        <span className="font-mono text-[11px] truncate">{product?.name ?? tx.productId}</span>
        {product?.color && <span className="font-mono text-[9px] opacity-40 shrink-0">· {product.color}</span>}
        {product?.size && <span className="font-mono text-[9px] opacity-40 shrink-0">· {product.size}</span>}
        <span className="font-mono text-[9px] font-bold shrink-0 ml-1">+{tx.quantity} uds</span>
      </div>

      {supplierName && (
        <div className="flex items-center gap-1.5 sm:w-40 shrink-0 opacity-60">
          <Truck size={11} className="shrink-0" />
          <span className="font-mono text-[10px] truncate">{supplierName}</span>
        </div>
      )}

      {location && (
        <div className="hidden md:flex items-center gap-1.5 sm:w-32 shrink-0 opacity-50">
          <MapPin size={10} className="shrink-0" />
          <span className="font-mono text-[9px] truncate">{location.name}</span>
        </div>
      )}

      <span className="font-mono text-[8px] font-bold uppercase tracking-wider px-2 py-1 border rounded-sm shrink-0 bg-green-500/10 text-green-700 border-green-400">
        RECEPCIÓN
      </span>

      <div className="flex items-center gap-1.5 sm:w-36 shrink-0 opacity-40 justify-start sm:justify-end">
        <Calendar size={10} className="shrink-0" />
        <span className="font-mono text-[9px] whitespace-nowrap">{fmtDateTime(tx.date)}</span>
      </div>
    </div>
  );
};

interface SupplierGroup {
  supplierName: string;
  rows: Row[];
  qty: number;
}

function groupBySupplier(rows: Row[]): SupplierGroup[] {
  const map = new Map<string, Row[]>();
  for (const row of rows) {
    const key = row.supplierName ?? 'Sin proveedor';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(row);
  }
  return [...map.entries()]
    .map(([supplierName, groupRows]) => ({
      supplierName,
      rows: groupRows,
      qty: groupRows.reduce((sum, r) => sum + r.tx.quantity, 0),
    }))
    .sort((a, b) => b.qty - a.qty);
}

const ProductCard: React.FC<{ row: Row }> = ({ row }) => {
  const { tx, product, location } = row;
  return (
    <div className="border border-[var(--border-soft)] bg-[var(--surface)] px-3.5 py-3 flex items-center gap-3">
      <div className="w-8 h-8 rounded-sm bg-green-500/10 border border-green-500/30 flex items-center justify-center shrink-0">
        <Package size={14} className="text-green-600" />
      </div>

      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="font-mono text-[10px] font-black uppercase tracking-wide truncate">
            {product?.name ?? tx.productId}
          </span>
          {(product?.color || product?.size) && (
            <span className="font-mono text-[9px] opacity-40 shrink-0">
              {[product?.color, product?.size].filter(Boolean).join(' · ')}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="font-mono text-[9px] opacity-40 flex items-center gap-1">
            <Hash size={9} className="shrink-0" />{tx.reference}
          </span>
          {location && (
            <span className="font-mono text-[9px] opacity-40 flex items-center gap-1">
              <MapPin size={9} className="shrink-0" />{location.name}
            </span>
          )}
          <span className="font-mono text-[9px] opacity-30">{fmtDateTime(tx.date)}</span>
        </div>
      </div>

      <span className="font-mono font-black text-sm text-green-600 shrink-0">+{tx.quantity}</span>
    </div>
  );
};

function DayModal({ dayKey, rows, onClose }: { dayKey: string; rows: Row[]; onClose: () => void }) {
  const totalQty = rows.reduce((sum, r) => sum + r.tx.quantity, 0);
  const groups = useMemo(() => groupBySupplier(rows), [rows]);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-[var(--bg)] border border-[var(--border)] shadow-[4px_4px_0_var(--border)] w-full max-w-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="border-b border-[var(--border)] px-5 py-4 flex justify-between items-start shrink-0">
          <div className="flex flex-col gap-1">
            <span className="font-mono text-[8px] opacity-40 uppercase tracking-[0.25em]">Recepciones del día</span>
            <span className="font-mono font-black text-sm uppercase tracking-wide">{fmtDayLong(dayKey)}</span>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-[var(--ink)]/10 rounded-sm transition-colors shrink-0">
            <X size={16} />
          </button>
        </div>

        {/* KPI summary */}
        {rows.length > 0 && (
          <div className="grid grid-cols-3 border-b border-[var(--border)] shrink-0">
            <div className="flex flex-col items-center justify-center gap-0.5 py-3 border-r border-[var(--border)]">
              <span className="font-mono font-black text-lg">{rows.length}</span>
              <span className="font-mono text-[8px] opacity-40 uppercase tracking-widest">Comprobantes</span>
            </div>
            <div className="flex flex-col items-center justify-center gap-0.5 py-3 border-r border-[var(--border)]">
              <span className="font-mono font-black text-lg text-green-600">+{totalQty}</span>
              <span className="font-mono text-[8px] opacity-40 uppercase tracking-widest">Unidades</span>
            </div>
            <div className="flex flex-col items-center justify-center gap-0.5 py-3">
              <span className="font-mono font-black text-lg">{groups.length}</span>
              <span className="font-mono text-[8px] opacity-40 uppercase tracking-widest">Proveedores</span>
            </div>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
          {rows.length === 0 ? (
            <div className="py-10 flex flex-col items-center gap-2 opacity-30">
              <ClipboardList size={28} />
              <span className="font-mono text-[10px] uppercase tracking-widest">Sin recepciones este día</span>
            </div>
          ) : (
            groups.map(group => (
              <div key={group.supplierName} className="flex flex-col gap-2">
                <div className="flex items-center gap-2 px-0.5">
                  <Building2 size={12} className="opacity-40 shrink-0" />
                  <span className="font-mono text-[10px] font-black uppercase tracking-wider">{group.supplierName}</span>
                  <span className="h-px flex-1 bg-[var(--border-soft)]" />
                  <span className="font-mono text-[9px] font-bold opacity-50 shrink-0">
                    {group.rows.length} · +{group.qty} uds
                  </span>
                </div>
                <div className="flex flex-col gap-1.5">
                  {group.rows.map(row => <ProductCard key={row.tx.id} row={row} />)}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function CalendarView({ rowsByDay, monthCursor, setMonthCursor, onSelectDay }: {
  rowsByDay: Map<string, Row[]>;
  monthCursor: Date;
  setMonthCursor: (d: Date) => void;
  onSelectDay: (key: string) => void;
}) {
  const year = monthCursor.getFullYear();
  const month = monthCursor.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayKey = new Date().toISOString().slice(0, 10);

  const cells: (string | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => `${year}-${String(month + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`),
  ];

  return (
    <div className="border border-[var(--border)] bg-[var(--bg-card)] flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
        <button
          onClick={() => setMonthCursor(new Date(year, month - 1, 1))}
          className="p-1.5 border border-[var(--border)]/30 hover:border-[var(--border)] transition-colors"
        >
          <ChevronLeft size={14} />
        </button>
        <span className="font-mono font-black text-xs uppercase tracking-widest">{MONTH_LABEL[month]} {year}</span>
        <button
          onClick={() => setMonthCursor(new Date(year, month + 1, 1))}
          className="p-1.5 border border-[var(--border)]/30 hover:border-[var(--border)] transition-colors"
        >
          <ChevronRight size={14} />
        </button>
      </div>

      <div className="grid grid-cols-7 border-b border-[var(--border)]/30">
        {WEEKDAY_LABEL.map(w => (
          <div key={w} className="font-mono text-[8px] font-bold uppercase tracking-widest text-center py-2 opacity-40">
            {w}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {cells.map((key, i) => {
          if (!key) return <div key={i} className="aspect-square sm:aspect-auto sm:h-24 border-b border-r border-[var(--border)]/10" />;
          const dayRows = rowsByDay.get(key) ?? [];
          const qty = dayRows.reduce((sum, r) => sum + r.tx.quantity, 0);
          const isToday = key === todayKey;
          return (
            <button
              key={i}
              onClick={() => onSelectDay(key)}
              className={cn(
                'aspect-square sm:aspect-auto sm:h-24 border-b border-r border-[var(--border)]/10 flex flex-col items-start p-1.5 sm:p-2 gap-1 text-left transition-colors hover:bg-[var(--surface)]',
                dayRows.length === 0 && 'opacity-40'
              )}
            >
              <span className={cn(
                'font-mono text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full shrink-0',
                isToday ? 'bg-[var(--ink)] text-[var(--ink-inv)]' : ''
              )}>
                {Number(key.slice(-2))}
              </span>
              {dayRows.length > 0 && (
                <div className="flex flex-col gap-0.5 w-full">
                  <span className="font-mono text-[8px] font-black uppercase tracking-wider truncate" style={{ color: '#16a34a' }}>
                    {dayRows.length} rec.
                  </span>
                  <span className="font-mono text-[7px] opacity-50 truncate hidden sm:block">{qty} uds</span>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export const LivexFeed: React.FC = () => {
  const { transactions, products, locations, contacts } = useAppContext();
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'feed' | 'calendar'>('feed');
  const [monthCursor, setMonthCursor] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const receptions = useMemo(
    () => transactions.filter(tx => tx.type === 'RECEPTION' && tx.status !== 'CANCELLED'),
    [transactions]
  );

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return receptions
      .filter(tx => {
        if (!q) return true;
        const prod = products.find(p => p.id === tx.productId);
        const supplier = contacts.find(c => c.id === tx.contactId);
        return (
          tx.reference.toLowerCase().includes(q) ||
          prod?.name.toLowerCase().includes(q) ||
          prod?.code.toLowerCase().includes(q) ||
          supplier?.name.toLowerCase().includes(q)
        );
      })
      .map(tx => ({
        tx,
        product: products.find(p => p.id === tx.productId),
        location: locations.find(l => l.id === tx.toLocationId),
        supplierName: contacts.find(c => c.id === tx.contactId)?.name,
      }));
  }, [receptions, products, locations, contacts, search]);

  const rowsByDay = useMemo(() => {
    const map = new Map<string, Row[]>();
    for (const row of rows) {
      const key = limaDayKey(row.tx.date);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(row);
    }
    return map;
  }, [rows]);

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-5 pb-12">
      <ModuleInfo
        number="LX"
        title="Livex — Feed de Recepciones"
        description="Bitácora de solo lectura: cada comprobante de recepción (lo que se sube al inventario) aparece aquí. Cambia a calendario para ver qué se subió cada día."
      />

      <div className="flex items-center gap-2 border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2.5">
        <Search size={14} className="opacity-40 shrink-0" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por referencia, proveedor o producto..."
          className="flex-1 bg-transparent outline-none font-mono text-xs"
        />
        <span className="font-mono text-[9px] opacity-40 shrink-0">{rows.length} registros</span>
        <div className="flex border border-[var(--border)] shrink-0">
          <button
            onClick={() => setView('feed')}
            title="Vista de lista"
            className={cn('p-1.5 transition-colors', view === 'feed' ? 'bg-[var(--ink)] text-[var(--ink-inv)]' : 'opacity-50 hover:opacity-100')}
          >
            <List size={14} />
          </button>
          <button
            onClick={() => setView('calendar')}
            title="Vista de calendario"
            className={cn('p-1.5 transition-colors border-l border-[var(--border)]', view === 'calendar' ? 'bg-[var(--ink)] text-[var(--ink-inv)]' : 'opacity-50 hover:opacity-100')}
          >
            <Calendar size={14} />
          </button>
        </div>
      </div>

      {view === 'feed' ? (
        <div className="border border-[var(--border)] bg-[var(--bg-card)] flex flex-col divide-y" style={{ borderColor: 'var(--border)' }}>
          {rows.length === 0 ? (
            <div className="px-4 py-10 flex flex-col items-center gap-2 opacity-30">
              <ClipboardList size={28} />
              <span className="font-mono text-[10px] uppercase tracking-widest">Sin recepciones registradas</span>
            </div>
          ) : (
            rows.map(row => (
              <ReceptionRow
                key={row.tx.id}
                tx={row.tx}
                product={row.product}
                location={row.location}
                supplierName={row.supplierName}
              />
            ))
          )}
        </div>
      ) : (
        <CalendarView
          rowsByDay={rowsByDay}
          monthCursor={monthCursor}
          setMonthCursor={setMonthCursor}
          onSelectDay={setSelectedDay}
        />
      )}

      {selectedDay && (
        <DayModal
          dayKey={selectedDay}
          rows={rowsByDay.get(selectedDay) ?? []}
          onClose={() => setSelectedDay(null)}
        />
      )}
    </div>
  );
};

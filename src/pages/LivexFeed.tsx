import React, { useMemo, useState } from 'react';
import { Package, Truck, MapPin, Calendar, Search, ClipboardList, List, ChevronLeft, ChevronRight, X, Hash, Building2 } from 'lucide-react';
import { useAppContext } from '../store/AppContext';
import { ModuleInfo } from '../components/ModuleInfo';
import { TutorialModal, TutorialStep } from '../components/TutorialModal';
import { Product, Location, Transaction } from '../types';
import { cn } from '../lib/utils';
import type { Brand } from '../store/AppContext';

const BRAND_LABEL: Record<Brand, string> = { OVERSHARK: 'OVERSHARK', BRAVOS: 'BRAVOS URBAN', BOX_PRIME: 'BOX PRIME' };
const BRANDS: Brand[] = ['OVERSHARK', 'BRAVOS', 'BOX_PRIME'];

// ── Tutorial ───────────────────────────────────────────────────────────────────

const LivexIllustrationFeed = () => (
  <svg viewBox="0 0 200 140" className="w-full h-full" fill="none">
    <rect x="14" y="18" width="172" height="104" rx="2" fill="var(--bg-card)" stroke="var(--border)" strokeWidth="1.5" />
    {[0, 1, 2, 3].map(i => (
      <g key={i} opacity={1 - i * 0.18}>
        <rect x="24" y={30 + i * 24} width="152" height="18" rx="1" fill="var(--surface)" stroke="var(--border)" strokeWidth="1" />
        <rect x="30" y={35 + i * 24} width="6" height="8" rx="1" fill="#dcfce7" stroke="#86efac" strokeWidth="1" />
        <rect x="42" y={37 + i * 24} width="60" height="4" rx="1" fill="var(--border)" />
        <rect x="150" y={37 + i * 24} width="18" height="4" rx="1" fill="#86efac" />
      </g>
    ))}
  </svg>
);

const LivexIllustrationCalendar = () => (
  <svg viewBox="0 0 200 140" className="w-full h-full" fill="none">
    <rect x="30" y="20" width="140" height="100" rx="2" fill="var(--bg-card)" stroke="var(--border)" strokeWidth="1.5" />
    <rect x="30" y="20" width="140" height="18" fill="var(--ink)" />
    <text x="100" y="33" textAnchor="middle" fontSize="8" fill="var(--ink-inv)" fontWeight="700" fontFamily="monospace">JULIO 2026</text>
    {Array.from({ length: 4 }, (_, row) => (
      <g key={row}>
        {Array.from({ length: 6 }, (_, col) => {
          const has = (row * 6 + col) % 3 === 0;
          return (
            <g key={col} className={has ? 'tut-fade-up' : ''} style={has ? { animationDelay: `${(row * 6 + col) * 0.05}s` } : undefined}>
              <rect x={38 + col * 22} y={44 + row * 18} width="18" height="14" rx="1" fill={has ? '#dcfce7' : 'var(--surface)'} stroke={has ? '#86efac' : 'var(--border)'} strokeWidth="1" />
              {has && <circle cx={38 + col * 22 + 14} cy={44 + row * 18 + 4} r="2" fill="#15803d" />}
            </g>
          );
        })}
      </g>
    ))}
  </svg>
);

const LivexIllustrationDetail = () => (
  <svg viewBox="0 0 200 140" className="w-full h-full" fill="none">
    <rect x="24" y="14" width="152" height="112" rx="2" fill="var(--bg-card)" stroke="var(--border)" strokeWidth="1.5" />
    <rect x="24" y="14" width="152" height="20" fill="var(--surface)" />
    <text x="100" y="27" textAnchor="middle" fontSize="7" fill="var(--ink)" fontWeight="700" fontFamily="monospace">08 DE JULIO, 2026</text>
    <rect x="34" y="42" width="42" height="24" rx="1" fill="var(--surface)" stroke="var(--border)" strokeWidth="1" />
    <text x="55" y="52" textAnchor="middle" fontSize="10" fill="var(--ink)" fontWeight="900" fontFamily="monospace">3</text>
    <text x="55" y="61" textAnchor="middle" fontSize="5" fill="var(--ink-50)" fontFamily="monospace">COMPROB.</text>
    <rect x="79" y="42" width="42" height="24" rx="1" fill="#dcfce7" stroke="#86efac" strokeWidth="1" />
    <text x="100" y="52" textAnchor="middle" fontSize="10" fill="#15803d" fontWeight="900" fontFamily="monospace">+84</text>
    <text x="100" y="61" textAnchor="middle" fontSize="5" fill="#15803d" fontFamily="monospace">UNIDADES</text>
    <rect x="124" y="42" width="42" height="24" rx="1" fill="var(--surface)" stroke="var(--border)" strokeWidth="1" />
    <text x="145" y="52" textAnchor="middle" fontSize="10" fill="var(--ink)" fontWeight="900" fontFamily="monospace">2</text>
    <text x="145" y="61" textAnchor="middle" fontSize="5" fill="var(--ink-50)" fontFamily="monospace">PROVEED.</text>
    <g className="tut-fade-up" style={{ animationDelay: '0.3s' }}>
      <rect x="34" y="76" width="132" height="16" rx="1" fill="var(--surface)" stroke="var(--border)" strokeWidth="1" />
      <rect x="40" y="80" width="8" height="8" rx="1" fill="#dcfce7" stroke="#86efac" strokeWidth="1" />
      <rect x="54" y="83" width="50" height="3" rx="1" fill="var(--border)" />
      <text x="155" y="87" textAnchor="middle" fontSize="8" fill="#15803d" fontWeight="900" fontFamily="monospace">+24</text>
    </g>
    <g className="tut-fade-up" style={{ animationDelay: '0.6s' }}>
      <rect x="34" y="96" width="132" height="16" rx="1" fill="var(--surface)" stroke="var(--border)" strokeWidth="1" />
      <rect x="40" y="100" width="8" height="8" rx="1" fill="#dcfce7" stroke="#86efac" strokeWidth="1" />
      <rect x="54" y="103" width="50" height="3" rx="1" fill="var(--border)" />
      <text x="155" y="107" textAnchor="middle" fontSize="8" fill="#15803d" fontWeight="900" fontFamily="monospace">+18</text>
    </g>
  </svg>
);

const LIVEX_TUTORIAL_STEPS: TutorialStep[] = [
  {
    title: '¿Qué es Livex?',
    description: 'Livex es tu ventana de solo lectura al inventario. Aquí ves cada comprobante de recepción — es decir, todo lo que ha entrado al almacén — sin poder crear, editar ni borrar nada.',
    illustration: <LivexIllustrationFeed />,
    tips: [
      'Solo se muestran recepciones (lo que entra), no despachos ni traslados',
      'Usa el buscador para filtrar por referencia, proveedor o producto',
      'El selector de marca en el sidebar cambia qué inventario ves (OVERSHARK, BRAVOS, BOX PRIME)',
    ],
  },
  {
    title: 'Vista de Calendario',
    description: 'Cambia a la vista de calendario con el ícono junto al buscador. Cada día muestra cuántos comprobantes y unidades se subieron, de un vistazo.',
    illustration: <LivexIllustrationCalendar />,
    tips: [
      'Los días con recepciones se resaltan y muestran el conteo',
      'Usa las flechas para navegar entre meses',
      'El día de hoy siempre aparece marcado',
    ],
  },
  {
    title: 'Detalle de un día',
    description: 'Haz clic en cualquier día del calendario para ver el detalle completo: cuántos comprobantes hubo, cuántas unidades entraron, y de qué proveedores — agrupado y ordenado para revisar rápido.',
    illustration: <LivexIllustrationDetail />,
    tips: [
      'Los productos se agrupan por proveedor para facilitar la lectura',
      'Usa los botones de producto arriba para filtrar solo ese artículo',
      'Cada tarjeta muestra producto, cantidad, referencia y ubicación',
    ],
  },
];

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
        <Hash size={12} className="shrink-0" style={{ color: 'var(--ink)', opacity: 0.7 }} />
        <span className="font-mono font-black text-[11px] uppercase tracking-wider truncate" style={{ color: 'var(--ink)' }}>{tx.reference}</span>
      </div>

      <div className="flex items-center gap-1.5 flex-1 min-w-0">
        <Package size={12} className="shrink-0" style={{ color: 'var(--ink)', opacity: 0.8 }} />
        <span className="font-mono text-[12px] font-bold truncate" style={{ color: 'var(--ink)' }}>{product?.name ?? tx.productId}</span>
        {product?.color && <span className="font-mono text-[10px] font-bold uppercase shrink-0" style={{ color: 'var(--ink)', opacity: 0.85 }}>· {product.color}</span>}
        {product?.size && <span className="font-mono text-[10px] font-bold uppercase shrink-0" style={{ color: 'var(--ink)', opacity: 0.85 }}>· {product.size}</span>}
        <span className="font-mono text-[10px] font-bold shrink-0 ml-1 text-green-600">+{tx.quantity} uds</span>
      </div>

      {supplierName && (
        <div className="flex items-center gap-1.5 sm:w-40 shrink-0" style={{ color: 'var(--ink)', opacity: 0.9 }}>
          <Truck size={12} className="shrink-0" />
          <span className="font-mono text-[11px] font-bold truncate">{supplierName}</span>
        </div>
      )}

      {location && (
        <div className="hidden md:flex items-center gap-1.5 sm:w-32 shrink-0" style={{ color: 'var(--ink)', opacity: 0.8 }}>
          <MapPin size={11} className="shrink-0" />
          <span className="font-mono text-[10px] font-semibold truncate">{location.name}</span>
        </div>
      )}

      <span className="font-mono text-[9px] font-bold uppercase tracking-wider px-2 py-1 border rounded-sm shrink-0 bg-green-500/10 text-green-700 border-green-400">
        RECEPCIÓN
      </span>

      <div className="flex items-center gap-1.5 sm:w-36 shrink-0 justify-start sm:justify-end" style={{ color: 'var(--ink)', opacity: 0.7 }}>
        <Calendar size={11} className="shrink-0" />
        <span className="font-mono text-[10px] font-semibold whitespace-nowrap">{fmtDateTime(tx.date)}</span>
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

      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="font-mono text-[12px] font-black uppercase tracking-wide truncate" style={{ color: 'var(--ink)' }}>
            {product?.name ?? tx.productId}
          </span>
          {(product?.color || product?.size) && (
            <span className="font-mono text-[10px] font-bold uppercase shrink-0" style={{ color: 'var(--ink)', opacity: 0.85 }}>
              {[product?.color, product?.size].filter(Boolean).join(' · ')}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="font-mono text-[10px] font-semibold flex items-center gap-1" style={{ color: 'var(--ink)', opacity: 0.8 }}>
            <Hash size={10} className="shrink-0" />{tx.reference}
          </span>
          {location && (
            <span className="font-mono text-[10px] font-semibold flex items-center gap-1" style={{ color: 'var(--ink)', opacity: 0.8 }}>
              <MapPin size={10} className="shrink-0" />{location.name}
            </span>
          )}
          <span className="font-mono text-[10px] font-medium" style={{ color: 'var(--ink)', opacity: 0.65 }}>{fmtDateTime(tx.date)}</span>
        </div>
      </div>

      <span className="font-mono font-black text-base text-green-600 shrink-0">+{tx.quantity}</span>
    </div>
  );
};

interface ProductFilterOption {
  key: string;
  label: string;
  qty: number;
}

/** Agrupa por nombre de producto (no por variante de color/talla) */
function productGroupKey(row: Row): string {
  return row.product?.name ?? row.tx.productId;
}

function buildProductFilters(rows: Row[]): ProductFilterOption[] {
  const map = new Map<string, ProductFilterOption>();
  for (const row of rows) {
    const key = productGroupKey(row);
    const existing = map.get(key);
    if (existing) existing.qty += row.tx.quantity;
    else map.set(key, { key, label: key, qty: row.tx.quantity });
  }
  return [...map.values()].sort((a, b) => b.qty - a.qty);
}

function DayModal({ dayKey, rows, onClose }: { dayKey: string; rows: Row[]; onClose: () => void }) {
  const [productFilter, setProductFilter] = useState<string | null>(null);
  const totalQty = rows.reduce((sum, r) => sum + r.tx.quantity, 0);
  const totalSuppliers = useMemo(() => new Set(rows.map(r => r.supplierName ?? 'Sin proveedor')).size, [rows]);
  const productFilters = useMemo(() => buildProductFilters(rows), [rows]);
  const filteredRows = useMemo(
    () => productFilter ? rows.filter(r => productGroupKey(r) === productFilter) : rows,
    [rows, productFilter]
  );
  const groups = useMemo(() => groupBySupplier(filteredRows), [filteredRows]);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-[var(--bg)] border border-[var(--border)] shadow-[4px_4px_0_var(--border)] w-full max-w-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="border-b border-[var(--border)] px-5 py-4 flex justify-between items-start shrink-0">
          <div className="flex flex-col gap-1">
            <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.25em]" style={{ color: 'var(--ink)', opacity: 0.6 }}>Recepciones del día</span>
            <span className="font-mono font-black text-base uppercase tracking-wide" style={{ color: 'var(--ink)' }}>{fmtDayLong(dayKey)}</span>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-[var(--ink)]/10 rounded-sm transition-colors shrink-0">
            <X size={16} />
          </button>
        </div>

        {/* KPI summary */}
        {rows.length > 0 && (
          <div className="grid grid-cols-3 border-b border-[var(--border)] shrink-0">
            <div className="flex flex-col items-center justify-center gap-0.5 py-3 border-r border-[var(--border)]">
              <span className="font-mono font-black text-xl" style={{ color: 'var(--ink)' }}>{rows.length}</span>
              <span className="font-mono text-[9px] font-semibold uppercase tracking-widest" style={{ color: 'var(--ink)', opacity: 0.6 }}>Comprobantes</span>
            </div>
            <div className="flex flex-col items-center justify-center gap-0.5 py-3 border-r border-[var(--border)]">
              <span className="font-mono font-black text-xl text-green-600">+{totalQty}</span>
              <span className="font-mono text-[9px] font-semibold uppercase tracking-widest" style={{ color: 'var(--ink)', opacity: 0.6 }}>Unidades</span>
            </div>
            <div className="flex flex-col items-center justify-center gap-0.5 py-3">
              <span className="font-mono font-black text-xl" style={{ color: 'var(--ink)' }}>{totalSuppliers}</span>
              <span className="font-mono text-[9px] font-semibold uppercase tracking-widest" style={{ color: 'var(--ink)', opacity: 0.6 }}>Proveedores</span>
            </div>
          </div>
        )}

        {/* Product filter chips */}
        {productFilters.length > 1 && (
          <div className="flex items-center gap-1.5 px-4 py-3 border-b border-[var(--border)] overflow-x-auto shrink-0">
            <button
              onClick={() => setProductFilter(null)}
              className={cn(
                'font-mono text-[10px] font-bold uppercase tracking-wider px-2.5 py-1.5 border rounded-sm shrink-0 transition-colors',
                productFilter === null ? 'bg-[var(--ink)] text-[var(--ink-inv)] border-[var(--ink)]' : 'border-[var(--border)]'
              )}
              style={productFilter === null ? undefined : { color: 'var(--ink)', opacity: 0.75 }}
            >
              Todos
            </button>
            {productFilters.map(p => (
              <button
                key={p.key}
                onClick={() => setProductFilter(prev => prev === p.key ? null : p.key)}
                className={cn(
                  'font-mono text-[10px] font-bold uppercase tracking-wider px-2.5 py-1.5 border rounded-sm shrink-0 transition-colors whitespace-nowrap',
                  productFilter === p.key ? 'bg-green-600 text-white border-green-600' : 'border-[var(--border)]'
                )}
                style={productFilter === p.key ? undefined : { color: 'var(--ink)', opacity: 0.75 }}
              >
                {p.label} <span className="opacity-80">+{p.qty}</span>
              </button>
            ))}
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
          {rows.length === 0 ? (
            <div className="py-10 flex flex-col items-center gap-2 opacity-30">
              <ClipboardList size={28} />
              <span className="font-mono text-[10px] uppercase tracking-widest">Sin recepciones este día</span>
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="py-10 flex flex-col items-center gap-2 opacity-30">
              <Package size={28} />
              <span className="font-mono text-[10px] uppercase tracking-widest">Sin resultados para este producto</span>
            </div>
          ) : (
            groups.map(group => (
              <div key={group.supplierName} className="flex flex-col gap-2">
                <div className="flex items-center gap-2 px-0.5">
                  <Building2 size={13} className="shrink-0" style={{ color: 'var(--ink)', opacity: 0.65 }} />
                  <span className="font-mono text-[11px] font-black uppercase tracking-wider" style={{ color: 'var(--ink)' }}>{group.supplierName}</span>
                  <span className="h-px flex-1 bg-[var(--border-soft)]" />
                  <span className="font-mono text-[10px] font-bold shrink-0" style={{ color: 'var(--ink)', opacity: 0.6 }}>
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
        <span className="font-mono font-black text-sm uppercase tracking-widest" style={{ color: 'var(--ink)' }}>{MONTH_LABEL[month]} {year}</span>
        <button
          onClick={() => setMonthCursor(new Date(year, month + 1, 1))}
          className="p-1.5 border border-[var(--border)]/30 hover:border-[var(--border)] transition-colors"
        >
          <ChevronRight size={14} />
        </button>
      </div>

      <div className="grid grid-cols-7 border-b border-[var(--border)]/30">
        {WEEKDAY_LABEL.map(w => (
          <div key={w} className="font-mono text-[9px] font-bold uppercase tracking-widest text-center py-2" style={{ color: 'var(--ink)', opacity: 0.55 }}>
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
                'font-mono text-[11px] font-bold w-5 h-5 flex items-center justify-center rounded-full shrink-0',
                isToday ? 'bg-[var(--ink)] text-[var(--ink-inv)]' : ''
              )} style={isToday ? undefined : { color: 'var(--ink)' }}>
                {Number(key.slice(-2))}
              </span>
              {dayRows.length > 0 && (
                <div className="flex flex-col gap-0.5 w-full">
                  <span className="font-mono text-[9px] font-black uppercase tracking-wider truncate" style={{ color: '#16a34a' }}>
                    {dayRows.length} rec.
                  </span>
                  <span className="font-mono text-[8px] font-semibold truncate hidden sm:block" style={{ color: 'var(--ink)', opacity: 0.65 }}>{qty} uds</span>
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
  const { transactions, products, locations, contacts, activeBrand, setActiveBrand } = useAppContext();
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'feed' | 'calendar'>('feed');
  const [monthCursor, setMonthCursor] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [showTutorial, setShowTutorial] = useState(false);

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
      <TutorialModal
        open={showTutorial}
        onClose={() => setShowTutorial(false)}
        steps={LIVEX_TUTORIAL_STEPS}
        title="Livex"
      />

      <div className="flex items-stretch gap-0">
        <div className="flex-1">
          <ModuleInfo
            number="LX"
            title="Livex — Feed de Recepciones"
            description="Bitácora de solo lectura: cada comprobante de recepción (lo que se sube al inventario) aparece aquí. Cambia a calendario para ver qué se subió cada día."
          />
        </div>
        <button
          onClick={() => setShowTutorial(true)}
          className="flex items-center gap-1.5 px-4 border border-l-0 border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--ink)] hover:text-[var(--ink-inv)] transition-all duration-150 shrink-0"
          title="Ver tutorial"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" />
          </svg>
          <span className="font-mono text-[9px] font-bold uppercase tracking-widest hidden sm:block">Tutorial</span>
        </button>
      </div>

      <div className="flex border border-[var(--border)] bg-[var(--bg-sidebar)] shrink-0">
        {BRANDS.map(b => (
          <button
            key={b}
            onClick={() => setActiveBrand(b)}
            className={cn(
              'flex-1 px-3 py-2.5 font-mono text-[10px] font-black uppercase tracking-widest transition-all border-r last:border-r-0 border-[var(--border)]',
              activeBrand === b ? 'bg-[var(--ink)] text-[var(--ink-inv)]' : 'opacity-50 hover:opacity-100'
            )}
          >
            {BRAND_LABEL[b]}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2.5">
        <Search size={14} className="opacity-40 shrink-0" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por referencia, proveedor o producto..."
          className="flex-1 bg-transparent outline-none font-mono text-xs"
        />
        <span className="font-mono text-[10px] font-semibold shrink-0" style={{ color: 'var(--ink)', opacity: 0.6 }}>{rows.length} registros</span>
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

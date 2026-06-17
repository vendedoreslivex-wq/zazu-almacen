import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useAppContext } from '../store/AppContext';
import { ModuleInfo } from '../components/ModuleInfo';
import { TutorialModal, OPERATIONS_TUTORIAL_STEPS } from '../components/TutorialModal';
import {
  ArrowDownLeft, ArrowUpRight, ArrowRightLeft, AlertTriangle, X,
  Printer, CheckCircle, ScanLine, Pencil, Trash2, Camera, Plus, Minus, Filter,
  BarChart2, MapPin, Package, TrendingUp, TrendingDown, ShieldOff,
  FileText, FileSpreadsheet, Download, ChevronDown, ChevronUp, Search, Mail,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { cn } from '../lib/utils';
import SignaturePad from 'signature_pad';
import { TransactionType, Transaction } from '../types';
import { sendOperationEmail, sendOperationToInternalRecipients, OperationType, OperationItem } from '../lib/emailService';
import { BrowserQRCodeReader } from '@zxing/browser';
import type { IScannerControls } from '@zxing/browser';
import { supabase } from '../lib/supabase';
import { uploadSignature } from '../lib/signatureStorage';

// --- Types ---------------------------------------------------------------------

type ActiveOp = TransactionType | 'WRITEOFF';

type LineItem = { key: string; productId: string; qty: string };

type OperationGuide = {
  number: string;
  type: TransactionType;
  date: string;
  operator: string;
  brand: string;
  items: OperationItem[];
  fromLocation?: string;
  toLocation?: string;
  reference: string;
  contact?: string;
  signature?: string;
  photo?: string;
};

// --- Constants -----------------------------------------------------------------

const TX_BADGE: Record<TransactionType, { label: string; cls: string }> = {
  RECEPTION: { label: 'RX', cls: 'text-green-600 bg-green-500/10 border-green-500/40' },
  DISPATCH:  { label: 'TX', cls: 'text-red-600 bg-red-500/10 border-red-500/40' },
  TRANSFER:  { label: 'MV', cls: 'text-blue-600 bg-blue-500/10 border-blue-500/40' },
};

const GUIDE_PREFIX: Record<TransactionType, string> = {
  RECEPTION: 'RE',
  DISPATCH:  'DE',
  TRANSFER:  'TR',
};

const BRAND_ABBR: Record<string, string> = { OVERSHARK: 'OS', BRAVOS: 'BU', BOX_PRIME: 'BP' };

const BRAND_NAME: Record<string, string> = {
  OVERSHARK: 'OVERSHARK',
  BRAVOS:    'BRAVOS URBAN',
  BOX_PRIME: 'BOX PRIME',
};

const TYPE_META: Record<TransactionType, { label: string; accentColor: string; bgColor: string; icon: string }> = {
  RECEPTION: { label: 'RECEPCION', accentColor: '#15803d', bgColor: '#f0fdf4', icon: '?' },
  DISPATCH:  { label: 'DESPACHO',  accentColor: '#b91c1c', bgColor: '#fef2f2', icon: '?' },
  TRANSFER:  { label: 'TRASLADO',  accentColor: '#0369a1', bgColor: '#eff6ff', icon: '?' },
};

const WRITEOFF_REASONS = [
  'Prendas en mal estado',
  'Prendas rotas',
  'Prendas sucias / manchadas',
  'Prendas mojadas / h-medas',
  'Prendas con defecto de fabricacion',
  'Prendas deterioradas por almacenamiento',
  'Merma por siniestro / robo',
  'Otro motivo',
];

// --- Helpers -------------------------------------------------------------------

async function nextGuideNumber(type: TransactionType, brand: string): Promise<string> {
  const { data, error } = await supabase.rpc('next_guide_number', { p_brand: brand, p_type: type });
  if (error || !data) {
    // Fallback to a timestamp-based local id so the operation can still complete.
    return `${GUIDE_PREFIX[type]}-${Date.now().toString().slice(-5)}`;
  }
  return data as string;
}

function resizeImage(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const MAX = 800;
        const ratio = Math.min(MAX / img.width, MAX / img.height, 1);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * ratio);
        canvas.height = Math.round(img.height * ratio);
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.75));
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

// --- CascadeProductSelector ----------------------------------------------------
// Selector en cascada: modelo ? color ? talla ? cantidad.
// Al agregar una l-nea, el selector se reinicia autom-ticamente.

interface CascadeProps {
  products: { id: string; name: string; code: string; color?: string; size?: string; category: string }[];
  onAdd: (item: LineItem) => void;
  onScanClick?: () => void;
  stockLevels?: { productId: string; locationId: string; quantity: number }[];
  fromLocation?: string;
  opType?: TransactionType;
}

const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', '3XL', 'TALLA UNICA', '(TALLA UNICA)', '10K', '20K'];

function sortSizes(sizes: string[]) {
  return [...sizes].sort((a, b) => {
    const ia = SIZE_ORDER.indexOf(a.toUpperCase());
    const ib = SIZE_ORDER.indexOf(b.toUpperCase());
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
}

const CascadeProductSelector: React.FC<CascadeProps> = ({ products, onAdd, onScanClick, stockLevels = [], fromLocation, opType }) => {
  const [baseName, setBaseName] = useState('');
  const [color, setColor] = useState('');
  // sizeQtys: { [size]: qty string } · para el modo multi-talla
  const [sizeQtys, setSizeQtys] = useState<Record<string, string>>({});
  // qty para modo sin tallas
  const [qty, setQty] = useState('');

  const uniqueNames = useMemo(() => [...new Set(products.map(p => p.name))].sort(), [products]);
  const byName = useMemo(() => products.filter(p => p.name === baseName), [products, baseName]);
  const colors = useMemo(() => [...new Set(byName.filter(p => p.color).map(p => p.color!))].sort() as string[], [byName]);
  const byColor = useMemo(() => color ? byName.filter(p => p.color === color) : byName, [byName, color]);
  const sizes = useMemo(() => sortSizes([...new Set(byColor.filter(p => p.size).map(p => p.size!))] as string[]), [byColor]);

  const needsColor = colors.length > 0;
  const colorReady = !needsColor || !!color;
  const needsSize = sizes.length > 0;

  // Producto unico cuando no hay tallas
  const selectedProd = useMemo(() => {
    if (!baseName || !colorReady || needsSize) return null;
    return byColor[0] ?? null;
  }, [byColor, baseName, colorReady, needsSize]);

  const getAvail = (productId: string) => {
    if (!fromLocation || opType === 'RECEPTION') return null;
    return stockLevels
      .filter(sl => sl.productId === productId && sl.locationId === fromLocation)
      .reduce((sum, sl) => sum + sl.quantity, 0);
  };

  const reset = () => { setBaseName(''); setColor(''); setSizeQtys({}); setQty(''); };

  // Agregar multi-talla
  const handleAddSizes = () => {
    let added = false;
    for (const size of sizes) {
      const q = parseInt(sizeQtys[size] ?? '', 10);
      if (!q || q <= 0) continue;
      const prod = byColor.find(p => p.size === size);
      if (!prod) continue;
      onAdd({ key: `${prod.id}_${Date.now()}_${size}`, productId: prod.id, qty: String(q) });
      added = true;
    }
    if (added) reset();
  };

  // Agregar sin tallas
  const handleAdd = () => {
    const q = parseInt(qty, 10);
    if (!selectedProd || !q || q <= 0) return;
    onAdd({ key: `${selectedProd.id}_${Date.now()}`, productId: selectedProd.id, qty: String(q) });
    reset();
  };

  const anySizeQty = sizes.some(s => parseInt(sizeQtys[s] ?? '', 10) > 0);

  return (
    <div className="flex flex-col gap-2">
      {/* Modelo */}
      <div className="flex gap-2">
        <select
          value={baseName}
          onChange={e => { setBaseName(e.target.value); setColor(''); setSizeQtys({}); setQty(''); }}
          className="input-technical flex-1 text-[11px]"
        >
          <option value="">- Seleccione modelo -</option>
          {uniqueNames.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        {onScanClick && (
          <button type="button" onClick={onScanClick} title="Escanear QR"
            className="shrink-0 border border-[var(--border)] bg-[var(--bg-card-alt)] hover:bg-[var(--ink)] hover:text-[var(--ink-inv)] transition-all px-3 flex items-center justify-center">
            <ScanLine size={15} />
          </button>
        )}
      </div>

      {/* Color */}
      {baseName && needsColor && (
        <select
          value={color}
          onChange={e => { setColor(e.target.value); setSizeQtys({}); setQty(''); }}
          className="input-technical text-[11px]"
        >
          <option value="">- Seleccione color -</option>
          {colors.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      )}

      {/* Tallas m-ltiples con cantidad individual */}
      {baseName && colorReady && needsSize && (
        <div className="flex flex-col gap-1.5 border border-[var(--border)]/20 rounded-sm p-2 bg-[var(--bg-card)]">
          <span className="font-mono text-[9px] font-bold uppercase tracking-widest text-[var(--ink)]/50">Tallas y cantidades</span>
          {sizes.map(size => {
            const prod = byColor.find(p => p.size === size);
            const avail = prod ? getAvail(prod.id) : null;
            const q = parseInt(sizeQtys[size] ?? '', 10);
            const over = avail !== null && q > avail;
            return (
              <div key={size} className="flex items-center gap-2">
                <span className="font-mono text-[10px] font-black uppercase w-16 shrink-0 text-[var(--ink)]">{size}</span>
                {avail !== null && (
                  <span className={cn('font-mono text-[8px] font-bold w-16 shrink-0', avail === 0 ? 'text-red-500' : 'text-green-700')}>
                    DISP: {avail}
                  </span>
                )}
                <input
                  type="number"
                  min="0"
                  value={sizeQtys[size] ?? ''}
                  onChange={e => setSizeQtys(prev => ({ ...prev, [size]: e.target.value }))}
                  placeholder="0"
                  className={cn('input-technical text-[11px] flex-1 text-center', over && 'border-red-600 bg-red-500/10')}
                />
              </div>
            );
          })}
          <button
            type="button"
            onClick={handleAddSizes}
            disabled={!anySizeQty}
            className="mt-1 flex items-center justify-center gap-1.5 border border-[var(--border)] bg-[var(--ink)] text-[var(--ink-inv)] hover:bg-[var(--bg-input)] hover:text-[var(--ink)] disabled:opacity-30 transition-all px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-widest"
          >
            <Plus size={11} />
            AGREGAR TALLAS
          </button>
        </div>
      )}

      {/* Cantidad + botón agregar (sin tallas) */}
      {baseName && colorReady && !needsSize && selectedProd && (
        <div className="flex items-center gap-2">
          <div className="flex flex-col flex-1">
            <input
              type="number"
              min="1"
              value={qty}
              onChange={e => setQty(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAdd(); } }}
              placeholder="Cantidad"
              className={cn('input-technical text-[11px]', getAvail(selectedProd.id) !== null && parseInt(qty, 10) > getAvail(selectedProd.id)! && 'border-red-600 bg-red-500/10')}
              autoFocus
            />
            {getAvail(selectedProd.id) !== null && (
              <span className={cn('font-mono text-[8px] font-bold mt-0.5', getAvail(selectedProd.id) === 0 ? 'text-red-500' : 'text-green-700')}>
                DISP: {getAvail(selectedProd.id)} UND
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={handleAdd}
            disabled={!qty || parseInt(qty, 10) <= 0}
            className="shrink-0 flex items-center gap-1.5 border border-[var(--border)] bg-[var(--ink)] text-[var(--ink-inv)] hover:bg-[var(--bg-input)] hover:text-[var(--ink)] disabled:opacity-30 transition-all px-4 py-2.5 font-mono text-[10px] font-bold uppercase tracking-widest"
          >
            <Plus size={11} />
            AGREGAR
          </button>
        </div>
      )}
    </div>
  );
};

// --- Bulletins Tab -------------------------------------------------------------

type BulletinGroup = {
  reference: string;
  type: TransactionType;
  date: Date;
  operator: string;
  contact?: string;
  fromLocation?: string;
  toLocation?: string;
  signature?: string;
  items: { productName: string; productCode: string; quantity: number; variant?: string; serialNumber?: string }[];
};

const BulletinsTab: React.FC = () => {
  const { transactions, products, contacts, locations, activeBrand } = useAppContext();
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo,   setDateTo]   = useState('');
  const [bulletinData, setBulletinData] = useState<BulletinData | null>(null);

  // Aggregate transactions by reference → one bulletin per operation
  const bulletinGroups = useMemo(() => {
    const from = dateFrom ? new Date(dateFrom + 'T00:00:00') : null;
    const to   = dateTo   ? new Date(dateTo   + 'T23:59:59') : null;

    const active = transactions.filter(tx => tx.status !== 'CANCELLED' && tx.type in TX_BADGE);

    const map = new Map<string, BulletinGroup>();

    for (const tx of active) {
      const d = new Date(tx.date);
      if (from && d < from) continue;
      if (to   && d > to)   continue;

      // Key: reference + calendar day — same reference on different days = different bulletins
      const dayKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      const key = (tx.reference?.trim() ? `${tx.reference.trim()}__${dayKey}` : tx.id);

      const product  = products.find(p => p.id === tx.productId);
      const contact  = contacts.find(c => c.id === tx.contactId);
      const fromLoc  = locations.find(l => l.id === tx.fromLocationId);
      const toLoc    = locations.find(l => l.id === tx.toLocationId);

      const variant = [product?.color, product?.size].filter(Boolean).join(' · ') || undefined;

      if (map.has(key)) {
        map.get(key)!.items.push({
          productName: product?.name ?? tx.productId,
          productCode: product?.code ?? '',
          quantity: tx.quantity,
          variant,
          serialNumber: tx.serialNumber,
        });
      } else {
        map.set(key, {
          reference: tx.reference,
          type: tx.type,
          date: d,
          operator: tx.user,
          contact: contact?.name,
          fromLocation: fromLoc?.name,
          toLocation: toLoc?.name,
          signature: tx.signature,
          items: [{ productName: product?.name ?? tx.productId, productCode: product?.code ?? '', quantity: tx.quantity, variant, serialNumber: tx.serialNumber }],
        });
      }
    }

    return Array.from(map.values()).sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [transactions, products, contacts, locations, dateFrom, dateTo]);

  // Group bulletin groups by calendar day
  const dayGroups = useMemo(() => {
    const map = new Map<string, BulletinGroup[]>();
    for (const g of bulletinGroups) {
      const raw = g.date.toLocaleDateString('es-PE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      const key = raw.charAt(0).toUpperCase() + raw.slice(1);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(g);
    }
    return Array.from(map.entries());
  }, [bulletinGroups]);

  const openBulletin = (g: BulletinGroup) => {
    setBulletinData({
      type: g.type,
      reference: g.reference,
      date: g.date.toLocaleString('es-PE', { dateStyle: 'long', timeStyle: 'short' }),
      operator: g.operator,
      brand: activeBrand,
      items: g.items,
      fromLocation: g.fromLocation,
      toLocation: g.toLocation,
      contact: g.contact,
      signature: g.signature,
    });
  };

  const TYPE_COLOR: Record<TransactionType, string> = {
    RECEPTION: 'text-green-600 bg-green-500/10 border-green-500/30',
    DISPATCH:  'text-red-600 bg-red-500/10 border-red-500/30',
    TRANSFER:  'text-blue-600 bg-blue-500/10 border-blue-500/30',
  };
  const TYPE_LABEL: Record<TransactionType, string> = {
    RECEPTION: 'RECEPCIÓN', DISPATCH: 'DESPACHO', TRANSFER: 'TRASLADO',
  };

  return (
    <div className="flex flex-col gap-4">
      {bulletinData && <BulletinModal data={bulletinData} onClose={() => setBulletinData(null)} />}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
        <Mail size={13} className="text-[var(--ink)] opacity-50 shrink-0" />
        <span className="font-mono text-[9px] font-bold uppercase tracking-widest opacity-50">Filtrar por fecha</span>
        <div className="flex items-center gap-2 ml-auto">
          <span className="font-mono text-[9px] uppercase opacity-40">Desde</span>
          <input
            type="date" value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            className="border border-[var(--border)] bg-[var(--bg-card)] font-mono text-[10px] px-2 py-1 outline-none focus:border-[var(--ink)] cursor-pointer"
          />
          <span className="font-mono text-[9px] uppercase opacity-40">Hasta</span>
          <input
            type="date" value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            className="border border-[var(--border)] bg-[var(--bg-card)] font-mono text-[10px] px-2 py-1 outline-none focus:border-[var(--ink)] cursor-pointer"
          />
          {(dateFrom || dateTo) && (
            <button
              onClick={() => { setDateFrom(''); setDateTo(''); }}
              className="font-mono text-[9px] uppercase opacity-40 hover:opacity-100 flex items-center gap-1 transition-opacity"
            >
              <X size={10} /> Limpiar
            </button>
          )}
        </div>
      </div>

      {/* Count */}
      <div className="font-mono text-[9px] uppercase tracking-widest opacity-40 px-1">
        {bulletinGroups.length} comprobante{bulletinGroups.length !== 1 ? 's' : ''}{(dateFrom || dateTo) ? ' (filtrado)' : ''}
      </div>

      {/* Day groups */}
      {dayGroups.length === 0 ? (
        <div className="border border-[var(--border)] bg-[var(--surface)] p-8 text-center font-mono text-[10px] opacity-40 uppercase tracking-widest">
          No hay comprobantes para el rango seleccionado
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {dayGroups.map(([dateLabel, groups]) => (
            <div key={dateLabel}>
              {/* Day header */}
              <div className="flex items-center gap-3 mb-2">
                <span className="font-mono text-[9px] font-black uppercase tracking-widest opacity-60">{dateLabel}</span>
                <div className="flex-1 h-px bg-[var(--border)] opacity-30" />
                <span className="font-mono text-[8px] opacity-30">{groups.length} comprobante{groups.length !== 1 ? 's' : ''}</span>
              </div>

              {/* Bulletin rows */}
              <div className="flex flex-col gap-px">
                {groups.map((g, i) => {
                  const badge = TYPE_COLOR[g.type];
                  const label = TYPE_LABEL[g.type];
                  const totalQty = g.items.reduce((s, it) => s + it.quantity, 0);
                  return (
                    <button
                      key={g.reference || i}
                      onClick={() => openBulletin(g)}
                      className="flex items-center gap-3 border border-[var(--border)]/20 bg-[var(--surface)] hover:bg-[var(--bg-card)] hover:border-[var(--border)]/50 px-4 py-3 text-left transition-all group"
                    >
                      {/* Type badge */}
                      <span className={cn('shrink-0 font-mono text-[8px] font-black px-2 py-0.5 border', badge)}>{label}</span>

                      {/* Reference */}
                      <span className="shrink-0 font-mono text-[10px] font-bold opacity-70 w-28 truncate">{g.reference || '—'}</span>

                      {/* Products summary */}
                      <div className="flex-1 min-w-0">
                        <div className="font-mono text-[10px] font-bold truncate">
                          {g.items.length === 1
                            ? g.items[0].productName
                            : `${g.items.length} productos`}
                        </div>
                        <div className="font-mono text-[9px] opacity-40 truncate">
                          {g.contact ? g.contact : g.items.length > 1 ? g.items.map(it => it.productName).join(', ') : ''}
                        </div>
                      </div>

                      {/* Total qty */}
                      <span className="shrink-0 font-mono text-[11px] font-black bg-[var(--ink)] text-[var(--ink-inv)] px-2 py-0.5">{totalQty}</span>

                      {/* Time */}
                      <span className="shrink-0 font-mono text-[9px] opacity-40 hidden sm:block w-16 text-right">
                        {g.date.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
                      </span>

                      <Mail size={11} className="shrink-0 opacity-30 group-hover:opacity-70 transition-opacity" />
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// --- Main Page -----------------------------------------------------------------

export const Operations: React.FC = () => {
  const [activeOpt, setActiveOpt] = useState<ActiveOp>('RECEPTION');
  const [showTutorial, setShowTutorial] = useState(false);

  // Read sessionStorage filter set by Dashboard KPI cards
  const storedFilter = (() => {
    try { return JSON.parse(sessionStorage.getItem('operationsLogFilter') || 'null'); } catch { return null; }
  })();
  const [mainTab, setMainTab] = useState<'operations' | 'log' | 'reports' | 'bulletins'>(storedFilter ? 'log' : 'operations');

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-6 pb-8">
      <TutorialModal
        open={showTutorial}
        onClose={() => setShowTutorial(false)}
        steps={OPERATIONS_TUTORIAL_STEPS}
      />
      <div className="flex items-stretch gap-0">
        <div className="flex-1">
          <ModuleInfo
            number="05"
            title="Operaciones"
            description="Registro de movimientos de stock: entradas, salidas y transferencias. Soporta m-ltiples productos por operacion."
          />
        </div>
        <button
          onClick={() => setShowTutorial(true)}
          className="flex items-center gap-1.5 px-4 border border-l-0 border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--ink)] hover:text-[var(--ink-inv)] transition-all duration-150 shrink-0"
          title="Ver tutorial"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>
          </svg>
          <span className="font-mono text-[9px] font-bold uppercase tracking-widest hidden sm:block">Tutorial</span>
        </button>
      </div>

      {/* Main tabs */}
      <div className="flex border border-[var(--border)] bg-[var(--bg-sidebar)]">
        <button
          onClick={() => setMainTab('operations')}
          className={cn(
            'flex items-center gap-2 px-5 py-3 font-mono text-[10px] font-bold uppercase tracking-widest border-r border-[var(--border)] transition-all',
            mainTab === 'operations'
              ? 'bg-[var(--ink)] text-[var(--ink-inv)]'
              : 'text-[var(--ink)] opacity-60 hover:opacity-100 hover:bg-[var(--surface)]'
          )}
        >
          <ArrowRightLeft size={14} />
          OPERACIONES
        </button>
        <button
          onClick={() => setMainTab('log')}
          className={cn(
            'flex items-center gap-2 px-5 py-3 font-mono text-[10px] font-bold uppercase tracking-widest border-r border-[var(--border)] transition-all',
            mainTab === 'log'
              ? 'bg-[var(--ink)] text-[var(--ink-inv)]'
              : 'text-[var(--ink)] opacity-60 hover:opacity-100 hover:bg-[var(--surface)]'
          )}
        >
          <FileText size={14} />
          HISTORIAL
        </button>
        <button
          onClick={() => setMainTab('reports')}
          className={cn(
            'flex items-center gap-2 px-5 py-3 font-mono text-[10px] font-bold uppercase tracking-widest border-r border-[var(--border)] transition-all',
            mainTab === 'reports'
              ? 'bg-[var(--ink)] text-[var(--ink-inv)]'
              : 'text-[var(--ink)] opacity-60 hover:opacity-100 hover:bg-[var(--surface)]'
          )}
        >
          <BarChart2 size={14} />
          REPORTES
        </button>
        <button
          onClick={() => setMainTab('bulletins')}
          className={cn(
            'flex items-center gap-2 px-5 py-3 font-mono text-[10px] font-bold uppercase tracking-widest transition-all',
            mainTab === 'bulletins'
              ? 'bg-[var(--ink)] text-[var(--ink-inv)]'
              : 'text-[var(--ink)] opacity-60 hover:opacity-100 hover:bg-[var(--surface)]'
          )}
        >
          <Mail size={14} />
          COMPROBANTES
        </button>
      </div>

      {mainTab === 'operations' && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 bg-[var(--bg-sidebar)] border border-[var(--border)] p-2 shadow-[4px_4px_0_var(--border)]">
            <OptButton
              icon={<ArrowDownLeft size={18} />}
              label="RECEPCION"
              desc="Registra entrada de productos al stock. Suma al inventario total."
              active={activeOpt === 'RECEPTION'}
              onClick={() => setActiveOpt('RECEPTION')}
            />
            <OptButton
              icon={<ArrowUpRight size={18} />}
              label="DESPACHO"
              desc="Registra salida de productos. Descuenta del inventario disponible."
              active={activeOpt === 'DISPATCH'}
              onClick={() => setActiveOpt('DISPATCH')}
            />
            <OptButton
              icon={<ArrowRightLeft size={18} />}
              label="TRANSLADO"
              desc="Mueve productos entre almacenes. El total del inventario no cambia."
              active={activeOpt === 'TRANSFER'}
              onClick={() => setActiveOpt('TRANSFER')}
            />
            <OptButton
              icon={<ShieldOff size={18} />}
              label="BAJA / MERMA"
              desc="Registra prendas dadas de baja. Descuenta del inventario con motivo."
              active={activeOpt === 'WRITEOFF'}
              onClick={() => setActiveOpt('WRITEOFF')}
              accent="red"
            />
          </div>

          <div className="bg-[var(--bg-card)] border border-[var(--border)] p-6 lg:p-8 relative overflow-visible">
            <div className="absolute top-0 right-0 p-4 font-mono text-[100px] leading-none opacity-5 select-none pointer-events-none font-black">
              {activeOpt === 'RECEPTION' ? 'RX' : activeOpt === 'DISPATCH' ? 'TX' : activeOpt === 'TRANSFER' ? 'MV' : 'BJ'}
            </div>
            {activeOpt === 'WRITEOFF'
              ? <WriteOffForm key="writeoff" />
              : <OperationForm key={activeOpt} type={activeOpt as TransactionType} />
            }
          </div>
        </>
      )}

      {mainTab === 'log' && (
        <TransactionLog initialFilter={storedFilter} />
      )}

      {mainTab === 'reports' && (
        <div className="border border-[var(--border)] bg-[var(--surface-alt)] p-5 shadow-[3px_3px_0_var(--border)]">
          <OperationsReport />
        </div>
      )}

      {mainTab === 'bulletins' && (
        <BulletinsTab />
      )}
    </div>
  );
};

// --- OptButton -----------------------------------------------------------------

const OptButton = ({ icon, label, desc, active, onClick, accent }: any) => (
  <button
    onClick={onClick}
    className={cn(
      'flex flex-col items-center gap-1.5 p-2.5 sm:p-3 lg:p-4 border transition-all',
      accent === 'red'
        ? active
          ? 'border-red-800 bg-red-800 text-white shadow-[inset_2px_2px_0_rgba(0,0,0,0.5)]'
          : 'border-red-800 bg-[var(--surface)] text-[var(--ink)] hover:bg-red-800 hover:text-white'
        : active
          ? 'border-[var(--border)] bg-[var(--ink)] text-[var(--ink-inv)] shadow-[inset_2px_2px_0_rgba(0,0,0,0.5)]'
          : 'border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--ink)] hover:text-[var(--ink-inv)]'
    )}
  >
    <div className={cn(active ? '' : 'opacity-70')}>{icon}</div>
    <span className={cn('font-mono text-[9px] lg:text-[10px] tracking-widest font-bold uppercase', active ? '' : 'opacity-70')}>{label}</span>
    {desc && (
      <span className={cn(
        'hidden sm:block font-mono text-[7.5px] leading-tight text-center normal-case tracking-normal font-normal border-t pt-1.5 mt-0.5 w-full opacity-60',
        active ? 'border-white/20' : 'border-[var(--border-soft)]'
      )}>
        {desc}
      </span>
    )}
  </button>
);

// --- FormGroup -----------------------------------------------------------------

const FormGroup: React.FC<{ label: string; error?: string; children: React.ReactNode; className?: string }> = ({ label, error, children, className }) => (
  <div className={cn('flex flex-col gap-1.5', className)}>
    <label className={cn('font-mono text-[9px] font-bold tracking-[0.2em] uppercase', error ? 'text-red-700 opacity-100' : 'opacity-80')}>{label}</label>
    {children}
    {error && <span className="font-mono text-[9px] font-bold text-red-700 uppercase mt-0.5 border border-red-700 px-1 py-0.5 bg-red-500/15 w-fit shrink-0 tracking-wider">{error}</span>}
  </div>
);

const PreviewRow = ({ label, value }: { label: string; value: string }) => (
  <tr className="border-b border-[var(--border)]/15">
    <td className="py-1.5 pr-3 font-bold uppercase opacity-50 text-[9px] tracking-widest">{label}</td>
    <td className="py-1.5 pl-3 font-bold uppercase text-right">{value}</td>
  </tr>
);

// --- OperationForm -------------------------------------------------------------

const OperationForm: React.FC<{ type: TransactionType }> = ({ type }) => {
  const { products, locations, addTransaction, stockLevels, activeBrand, contacts, currentUser, users } = useAppContext();

  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [fromLocation, setFromLocation] = useState('');
  const [toLocation, setToLocation] = useState('');
  const [reference, setReference] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [contactId, setContactId] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const padRef = useRef<SignaturePad | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    canvas.getContext('2d')?.scale(ratio, ratio);
    const pad = new SignaturePad(canvas);
    padRef.current = pad;
    pad.addEventListener('beginStroke', () => setErrors(prev => ({ ...prev, signature: '' })));
    return () => { pad.off(); padRef.current = null; };
  }, []);
  const [scanningForKey, setScanningForKey] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [lineErrors, setLineErrors] = useState<Record<string, { productId?: string; qty?: string }>>({});
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [guide, setGuide] = useState<OperationGuide | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [pendingSig, setPendingSig] = useState<string | undefined>(undefined);

  const addLineItems = (items: LineItem[]) =>
    setLineItems(prev => [...prev, ...items]);

  const removeLineItem = (key: string) =>
    setLineItems(prev => prev.filter(l => l.key !== key));

  const handlePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const resized = await resizeImage(file);
    setPhoto(resized);
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    const newLineErrors: Record<string, { productId?: string; qty?: string }> = {};
    let hasLineError = false;

    if (lineItems.length === 0) {
      newErrors.lines = 'AGREGA_AL_MENOS_UN_PRODUCTO';
    }

    for (const item of lineItems) {
      const errs: { productId?: string; qty?: string } = {};
      const qty = parseInt(item.qty, 10);
      if (!item.qty || isNaN(qty) || qty <= 0) {
        errs.qty = 'CANTIDAD_INVALIDA';
      } else if ((type === 'DISPATCH' || type === 'TRANSFER') && item.productId && fromLocation) {
        const avail = stockLevels.filter(s => s.productId === item.productId && s.locationId === fromLocation).reduce((sum, s) => sum + s.quantity, 0);
        if (avail === 0) errs.productId = 'SIN_STOCK_EN_ORIGEN';
        else if (qty > avail) errs.qty = 'CANTIDAD_EXCEDE_STOCK';
      }
      if (Object.keys(errs).length) { newLineErrors[item.key] = errs; hasLineError = true; }
    }

    if (type === 'RECEPTION' && !toLocation) newErrors.toLocation = 'SELECCIONE_DESTINO';
    if (type === 'DISPATCH' && !fromLocation) newErrors.fromLocation = 'SELECCIONE_ORIGEN';
    if (type === 'TRANSFER') {
      if (!fromLocation) newErrors.fromLocation = 'SELECCIONE_ORIGEN';
      if (!toLocation) newErrors.toLocation = 'SELECCIONE_DESTINO';
      if (fromLocation && toLocation && fromLocation === toLocation) newErrors.toLocation = 'DESTINO_DEBE_SER_DIFERENTE';
    }
    if (!reference.trim()) newErrors.reference = 'REFERENCIA_OBLIGATORIA';
    if ((type === 'RECEPTION' || type === 'DISPATCH') && (!padRef.current || padRef.current.isEmpty())) {
      newErrors.signature = 'FIRMA_REQUERIDA';
    }

    setErrors(newErrors);
    setLineErrors(newLineErrors);
    return !hasLineError && Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    if (!validate()) return;
    const sigData = (type === 'RECEPTION' || type === 'DISPATCH') && padRef.current && !padRef.current.isEmpty()
      ? padRef.current.toDataURL()
      : undefined;
    setPendingSig(sigData);
    setShowPreview(true);
  };

  const confirmPreview = () => {
    setShowPreview(false);
    executeTransactions(pendingSig);
  };

  const executeTransactions = async (sigData: string | undefined) => {
    const guideNumber = await nextGuideNumber(type, activeBrand);
    const guideItems: OperationItem[] = [];

    // Upload signature to Storage so the DB stores a URL instead of a 50KB
    // base64 blob. Photos aren't stored in the DB · they only travel embedded
    // in the email (as CID attachments).
    const storedSig = sigData ? await uploadSignature(sigData) : undefined;

    try {
      for (const item of lineItems) {
        await addTransaction({
          type,
          productId: item.productId,
          quantity: parseInt(item.qty, 10),
          fromLocationId: type !== 'RECEPTION' ? fromLocation || undefined : undefined,
          toLocationId: type !== 'DISPATCH' ? toLocation || undefined : undefined,
          reference,
          user: currentUser.username,
          contactId: contactId || undefined,
          signature: storedSig,
          serialNumber: activeBrand === 'BOX_PRIME' ? serialNumber || undefined : undefined,
        });
        const product = products.find(p => p.id === item.productId);
        guideItems.push({
          productName: [product?.name, product?.color, product?.size].filter(Boolean).join(' · ') || item.productId,
          productCode: product?.code ?? '',
          quantity: parseInt(item.qty, 10),
          serialNumber: activeBrand === 'BOX_PRIME' ? serialNumber || undefined : undefined,
        });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'ERROR AL REGISTRAR' });
      return;
    }

    const fromLoc = locations.find(l => l.id === fromLocation);
    const toLoc = locations.find(l => l.id === toLocation);
    const contact = contacts.find(c => c.id === contactId);
    const now = new Date();
    const dateStr = now.toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' });

    setGuide({
      number: guideNumber,
      type,
      date: dateStr,
      operator: currentUser.username,
      brand: activeBrand,
      items: guideItems,
      fromLocation: fromLoc?.name,
      toLocation: toLoc?.name,
      reference,
      contact: contact?.name,
      signature: sigData,
      photo: photo ?? undefined,
    });

    // Reset
    setLineItems([]);
    setFromLocation('');
    setToLocation('');
    setReference('');
    setSerialNumber('');
    setContactId('');
    setPhoto(null);
    setErrors({});
    setLineErrors({});
    padRef.current?.clear();
    if (photoInputRef.current) photoInputRef.current.value = '';

    // Email payload · pass the original data URLs so emailService can embed
    // the images as CID attachments. Gmail/Outlook strip <img src="data:...">
    // and Storage public URLs aren't always rendered either, so we attach the
    // images directly into the MIME message.
    const emailPayload = {
      brand: activeBrand,
      operationType: type as OperationType,
      reference,
      date: dateStr,
      operator: currentUser.username,
      items: guideItems,
      fromLocation: fromLoc?.name,
      toLocation: toLoc?.name,
      contact: contact?.name,
      signature: sigData,
      photo: photo ?? undefined,
    };

    // Email to operator
    const userRecord = users.find(u => u.id === currentUser.id);
    const operatorEmail = (userRecord as any)?.emailPersonal || (userRecord as any)?.email;
    if (operatorEmail) {
      setFeedback({ type: 'success', message: '-OPERACION REGISTRADA! ENVIANDO COMPROBANTE...' });
      sendOperationEmail({ toEmail: operatorEmail, toName: currentUser.username, ...emailPayload })
        .then(() => setFeedback({ type: 'success', message: `-REGISTRADA! COMPROBANTE ? ${operatorEmail}` }))
        .catch(() => setFeedback({ type: 'success', message: '-OPERACION REGISTRADA! (SIN EMAIL · REVISA CONFIGURACION)' }));
    } else {
      setFeedback({ type: 'success', message: '-OPERACION REGISTRADA CORRECTAMENTE!' });
    }
    setTimeout(() => setFeedback(null), 6000);

    // Email to contact (supplier on RECEPTION, client on DISPATCH)
    if (contact?.email && (type === 'RECEPTION' || type === 'DISPATCH')) {
      sendOperationEmail({ toEmail: contact.email, toName: contact.name, ...emailPayload }).catch(() => {});
    }

    // Email to internal recipients (always)
    sendOperationToInternalRecipients(emailPayload);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 relative z-10">
      {feedback && (
        <div className={cn(
          'p-3 border font-bold font-mono text-xs uppercase tracking-widest',
          feedback.type === 'success' ? 'bg-green-500/15 border-green-700 text-green-600' : 'bg-red-500/15 border-red-700 text-red-600'
        )}>
          {feedback.message}
        </div>
      )}

      <div className="border-b border-[var(--border)] pb-3 hidden md:block">
        <h3 className="font-serif italic font-bold text-xs uppercase tracking-widest">
          {type === 'RECEPTION' ? '01 // NUEVA RECEPCION DE INVENTARIO' : type === 'DISPATCH' ? '01 // DESPACHO DE MATERIALES' : '01 // TRANSLADO INTERNO ZONAS'}
        </h3>
        <p className="opacity-60 text-[10px] font-mono mt-1 uppercase tracking-widest font-bold">
          SISTEMA_DE_REGISTRO_ACTIVO // {type}
        </p>
      </div>

      {/* -- SELECTOR DE PRODUCTOS -- */}
      <div className="flex flex-col gap-3">
        <label className="font-mono text-[9px] font-bold tracking-[0.2em] uppercase opacity-80">
          AGREGAR PRODUCTOS
        </label>
        <div className="border border-[var(--border)]/20 bg-[var(--bg-card)] p-3">
          <CascadeProductSelector
            products={products}
            onAdd={(item) => addLineItems([item])}
            onScanClick={() => setScanningForKey('matrix')}
            stockLevels={stockLevels}
            fromLocation={fromLocation}
            opType={type}
          />
        </div>

        {errors.lines && (
          <span className="font-mono text-[9px] font-bold text-red-700 uppercase border border-red-700 px-1 py-0.5 bg-red-500/15 w-fit tracking-wider">
            {errors.lines}
          </span>
        )}

        {/* Lista de l-neas confirmadas */}
        {lineItems.length > 0 && (
          <div className="flex flex-col gap-0 border border-[var(--border)]/20 overflow-hidden">
            <div className="bg-[var(--ink)] text-[var(--ink-inv)] px-3 py-1.5 font-mono text-[8px] font-bold uppercase tracking-widest flex justify-between">
              <span>PRODUCTOS EN OPERACION</span>
              <span>{lineItems.length} L-NEAS · {lineItems.reduce((s, l) => s + (parseInt(l.qty) || 0), 0)} UND</span>
            </div>
            {lineItems.map((item, idx) => {
              const prod = products.find(p => p.id === item.productId);
              const itemErr = lineErrors[item.key];
              return (
                <div key={item.key} className={cn(
                  'flex items-center gap-2 px-3 py-2 font-mono text-[10px] border-b border-[var(--border)]/10 last:border-0',
                  idx % 2 === 0 ? 'bg-[var(--surface)]' : 'bg-[var(--bg-modal)]/60',
                  itemErr && 'bg-red-500/10 border-red-500/30'
                )}>
                  <span className="opacity-40 text-[8px] w-4 shrink-0">{idx + 1}</span>
                  <span className="opacity-50 text-[9px] shrink-0">{prod?.code}</span>
                  <span className="font-bold flex-1 truncate uppercase">{prod?.name} {prod?.color} {prod?.size}</span>
                  <span className="font-black text-sm shrink-0">{item.qty}</span>
                  {itemErr && (
                    <span className="text-[8px] text-red-600 font-bold shrink-0">{itemErr.qty || itemErr.productId}</span>
                  )}
                  <button
                    type="button"
                    onClick={() => removeLineItem(item.key)}
                    className="shrink-0 text-red-400 hover:text-red-700 transition-colors p-0.5"
                  >
                    <Minus size={11} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* -- LOCATIONS -- */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(type === 'DISPATCH' || type === 'TRANSFER') && (
          <FormGroup label="UBICACION ORIGEN" error={errors.fromLocation}>
            <select
              value={fromLocation}
              onChange={e => { setFromLocation(e.target.value); if (type === 'TRANSFER' && e.target.value === toLocation) setToLocation(''); setErrors(prev => ({ ...prev, fromLocation: '' })); }}
              className={cn('input-technical', errors.fromLocation && 'border-red-600 bg-red-500/10')}
            >
              <option value="">Seleccione Origen...</option>
              {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </FormGroup>
        )}

        {(type === 'RECEPTION' || type === 'TRANSFER') && (
          <FormGroup label="UBICACION DESTINO" error={errors.toLocation}>
            <select
              value={toLocation}
              onChange={e => { setToLocation(e.target.value); setErrors(prev => ({ ...prev, toLocation: '' })); }}
              className={cn('input-technical', errors.toLocation && 'border-red-600 bg-red-500/10')}
            >
              <option value="">Seleccione Destino...</option>
              {locations.map(l => (
                <option key={l.id} value={l.id} disabled={type === 'TRANSFER' && l.id === fromLocation}>{l.name}</option>
              ))}
            </select>
            {toLocation && (() => {
              const items = stockLevels.filter(s => s.locationId === toLocation && s.quantity > 0);
              return items.length > 0 ? (
                <div className="text-[9px] font-mono border border-[var(--border)]/10 bg-[var(--surface-alt)] p-2 mt-1 max-h-28 overflow-y-auto">
                  <span className="opacity-60 uppercase tracking-widest font-bold mb-1 block">EN DESTINO:</span>
                  {items.map((s, i) => (
                    <div key={i} className="flex justify-between items-center border-b border-[var(--border)]/5 last:border-0 py-0.5">
                      <span className="font-bold truncate pr-2">{products.find(p => p.id === s.productId)?.name ?? '-'}</span>
                      <span className="bg-[var(--ink)] text-[var(--ink-inv)] px-1.5 py-0.5">{s.quantity}</span>
                    </div>
                  ))}
                </div>
              ) : null;
            })()}
          </FormGroup>
        )}

        {/* -- REFERENCE -- */}
        <FormGroup label="REFERENCIA / GU-A" error={errors.reference} className={type === 'TRANSFER' ? 'md:col-span-2' : ''}>
          <input
            type="text"
            value={reference}
            onChange={e => { setReference(e.target.value); setErrors(prev => ({ ...prev, reference: '' })); }}
            className={cn('input-technical', errors.reference && 'border-red-600 bg-red-500/10')}
            placeholder="EJ: GR-20914"
          />
        </FormGroup>

        {/* -- CONTACT -- */}
        {(type === 'RECEPTION' || type === 'DISPATCH') && (
          <FormGroup label={type === 'RECEPTION' ? 'PROVEEDOR' : 'CLIENTE'} className="border-l-4 border-l-[#141414] pl-2">
            <select value={contactId} onChange={e => setContactId(e.target.value)} className="input-technical">
              <option value="">{type === 'RECEPTION' ? '-- PROVEEDOR --' : '-- CLIENTE --'}</option>
              {contacts.filter(c => type === 'RECEPTION' ? c.type === 'SUPPLIER' : c.type === 'CLIENT').map(c => (
                <option key={c.id} value={c.id}>{c.name} ({c.document})</option>
              ))}
            </select>
            {contactId && (() => {
              const c = contacts.find(ct => ct.id === contactId);
              return c?.email ? (
                <div className="font-mono text-[9px] text-blue-600 font-bold mt-1 truncate">
                  ? {c.email}
                </div>
              ) : null;
            })()}
          </FormGroup>
        )}
      </div>

      {/* -- SERIAL + PHOTO ROW -- */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {activeBrand === 'BOX_PRIME' && (
          <FormGroup label="NUMERO DE SERIE / LOTE">
            <input
              type="text"
              value={serialNumber}
              onChange={e => setSerialNumber(e.target.value)}
              className="input-technical"
              placeholder="EJ: L-202305-A1"
            />
          </FormGroup>
        )}

        {/* -- PHOTO -- */}
        <FormGroup label="EVIDENCIA FOTOGR-FICA" className={activeBrand !== 'BOX_PRIME' ? 'md:col-span-2' : ''}>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              className="flex items-center gap-2 border border-[var(--border)] bg-[var(--bg-card-alt)] hover:bg-[var(--ink)] hover:text-[var(--ink-inv)] transition-all px-3 py-2 font-mono text-[10px] font-bold uppercase"
            >
              <Camera size={13} />
              {photo ? 'CAMBIAR FOTO' : 'CAPTURAR / ADJUNTAR'}
            </button>
            {photo && (
              <button type="button" onClick={() => { setPhoto(null); if (photoInputRef.current) photoInputRef.current.value = ''; }} className="text-red-500 hover:text-red-700 transition-colors">
                <X size={14} />
              </button>
            )}
          </div>
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handlePhotoCapture}
            className="hidden"
          />
          {photo ? (
            <div className="mt-2 border border-[var(--border)]/20 bg-[var(--bg-card)] p-1 w-fit">
              <img src={photo} alt="evidencia" className="max-h-28 max-w-full object-contain" />
            </div>
          ) : (
            <span className="font-mono text-[9px] opacity-40 uppercase tracking-wide mt-1">
              Opcional · se incluirá en guía y comprobante
            </span>
          )}
        </FormGroup>
      </div>

      {/* -- SIGNATURE -- */}
      {(type === 'RECEPTION' || type === 'DISPATCH') && (
        <FormGroup label="FIRMA DIGITAL" error={errors.signature}>
          <div className={cn(
            'border border-[var(--border)] bg-[var(--bg-input)] relative w-full h-32 overflow-hidden',
            errors.signature && 'border-red-600 shadow-[2px_2px_0_#dc2626]'
          )}>
            <canvas
              ref={canvasRef}
              className="w-full h-full cursor-crosshair"
            />
            <button
              type="button"
              onClick={() => padRef.current?.clear()}
              className="absolute top-2 right-2 text-[9px] font-mono font-bold tracking-widest bg-[var(--ink)] text-white px-2 py-1 opacity-70 hover:opacity-100"
            >
              BORRAR
            </button>
          </div>
          <span className="text-[9px] font-mono opacity-50 uppercase mt-1">
            {type === 'RECEPTION' ? 'Firma de conformidad de recepcion' : 'Firma de conformidad de despacho'}
          </span>
        </FormGroup>
      )}

      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mt-2">
        <div className="font-mono text-[9px] opacity-40 uppercase tracking-widest">
          {lineItems.length} {lineItems.length === 1 ? 'L-NEA' : 'L-NEAS'} · {lineItems.reduce((s, l) => s + (parseInt(l.qty) || 0), 0)} UND TOTAL
        </div>
        <button
          type="button"
          onClick={handleSubmit}
          className="w-full sm:w-auto bg-[var(--ink)] border border-[var(--border)] hover:bg-[var(--bg-input)] hover:text-[var(--ink)] text-[var(--ink-inv)] px-8 py-3.5 sm:py-3 text-[11px] font-mono tracking-widest font-bold transition-all shadow-[4px_4px_0_var(--border)] active:shadow-none active:translate-y-[4px] active:translate-x-[4px]"
        >
          EJECUTAR_{type}
        </button>
      </div>

      <style>{`
        .input-technical {
          width: 100%;
          background: rgba(255,255,255,.7);
          border: 1px solid #141414;
          border-radius: 0;
          padding: 10px 14px;
          color: #141414;
          font-size: 12px;
          font-weight: 700;
          font-family: var(--font-mono);
          text-transform: uppercase;
          outline: none;
          transition: all 0.1s;
        }
        .input-technical:focus { background: white; box-shadow: 2px 2px 0 0 #141414; }
      `}</style>

      {showPreview && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--bg)] border-2 border-[var(--border)] shadow-[6px_6px_0_var(--border)] w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="bg-[var(--ink)] text-[var(--ink-inv)] px-5 py-3 flex justify-between items-center">
              <div>
                <div className="font-mono text-[9px] opacity-50 uppercase tracking-widest">CONFIRMAR OPERACION</div>
                <div className="font-mono font-black text-sm uppercase tracking-widest">{TYPE_META[type].label}</div>
              </div>
              <button onClick={() => setShowPreview(false)} className="font-mono text-xs opacity-60 hover:opacity-100">?</button>
            </div>
            <div className="p-5 flex flex-col gap-4">
              <table className="w-full text-[10px] font-mono border-collapse">
                <tbody>
                  {reference && <PreviewRow label="Referencia" value={reference} />}
                  {contactId && <PreviewRow label={type === 'RECEPTION' ? 'Proveedor' : 'Cliente'} value={contacts.find(c => c.id === contactId)?.name || contactId} />}
                  {fromLocation && <PreviewRow label="Origen" value={locations.find(l => l.id === fromLocation)?.name || fromLocation} />}
                  {toLocation && <PreviewRow label="Destino" value={locations.find(l => l.id === toLocation)?.name || toLocation} />}
                  <PreviewRow label="Operador" value={currentUser.username} />
                </tbody>
              </table>
              <div className="border border-[var(--border)]">
                <div className="bg-[var(--ink)] text-[var(--ink-inv)] px-3 py-1.5 font-mono text-[9px] font-bold uppercase tracking-widest">PRODUCTOS</div>
                {lineItems.filter(l => l.productId).map((item, i) => {
                  const prod = products.find(p => p.id === item.productId);
                  return (
                    <div key={item.key} className={`flex justify-between items-center px-3 py-2 font-mono text-[10px] ${i % 2 === 0 ? 'bg-[var(--surface)]' : ''}`}>
                      <div>
                        <span className="font-bold">{prod?.code}</span>
                        <span className="opacity-60 ml-2">{prod?.name} {prod?.color} {prod?.size}</span>
                      </div>
                      <span className="font-black text-sm ml-4">{item.qty} uds</span>
                    </div>
                  );
                })}
                <div className="flex justify-between px-3 py-2 bg-[var(--bg-sidebar)] border-t border-[var(--border)] font-mono text-[10px] font-bold">
                  <span>TOTAL</span>
                  <span>{lineItems.reduce((s, l) => s + (parseInt(l.qty, 10) || 0), 0)} uds</span>
                </div>
              </div>
              {pendingSig && (
                <div>
                  <div className="font-mono text-[9px] opacity-50 uppercase tracking-widest mb-1">FIRMA</div>
                  <img src={pendingSig} alt="Firma" className="max-w-[160px] max-h-[60px] border border-[var(--border)] bg-[var(--bg-input)] p-1" />
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <button onClick={confirmPreview} className="flex-1 bg-[var(--ink)] text-[var(--ink-inv)] py-2.5 text-xs font-bold font-mono uppercase hover:shadow-[2px_2px_0_var(--border)] transition-all">
                  CONFIRMAR Y REGISTRAR
                </button>
                <button onClick={() => setShowPreview(false)} className="flex-1 border border-[var(--border)] py-2.5 text-xs font-bold font-mono uppercase hover:bg-[var(--surface)]">
                  VOLVER
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {guide && <GuideModal guide={guide} onClose={() => setGuide(null)} />}

      {scanningForKey !== null && (
        <QRScannerModal
          onClose={() => setScanningForKey(null)}
          onDetected={(id) => {
            // QR scan adds a single line with qty 1
            addLineItems([{ key: `qr_${id}_${Date.now()}`, productId: id, qty: '1' }]);
            setScanningForKey(null);
          }}
        />
      )}
    </form>
  );
};

// --- WriteOffForm --------------------------------------------------------------

const WriteOffForm: React.FC = () => {
  const { products, locations, addTransaction, stockLevels, activeBrand, currentUser } = useAppContext();

  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [fromLocation, setFromLocation] = useState('');
  const [reason, setReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [notes, setNotes] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const handlePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const resized = await resizeImage(file);
    setPhoto(resized);
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (lineItems.length === 0) errs.lines = 'AGREGA_AL_MENOS_UN_PRODUCTO';
    if (!fromLocation) errs.fromLocation = 'SELECCIONE_UBICACIÓN_ORIGEN';
    if (!reason) errs.reason = 'SELECCIONE_MOTIVO_DE_BAJA';
    if (reason === 'Otro motivo' && !customReason.trim()) errs.customReason = 'DESCRIBE_EL_MOTIVO';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const effectiveReason = reason === 'Otro motivo' ? customReason.trim() : reason;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    if (!validate()) return;
    setShowPreview(true);
  };

  const executeWriteOff = async () => {
    setShowPreview(false);
    const guideNumber = await nextGuideNumber('DISPATCH', activeBrand);
    const reference = `[BAJA] ${effectiveReason}${notes.trim() ? ' · ' + notes.trim() : ''}`;
    try {
      for (const item of lineItems) {
        await addTransaction({
          type: 'DISPATCH',
          productId: item.productId,
          quantity: parseInt(item.qty, 10),
          fromLocationId: fromLocation,
          reference,
          user: currentUser.username,
        });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'ERROR AL REGISTRAR' });
      return;
    }

    setLineItems([]);
    setFromLocation('');
    setReason('');
    setCustomReason('');
    setNotes('');
    setPhoto(null);
    setErrors({});
    if (photoInputRef.current) photoInputRef.current.value = '';

    setFeedback({ type: 'success', message: `¡BAJA REGISTRADA! GUÍA ${guideNumber}` });
    setTimeout(() => setFeedback(null), 6000);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 relative z-10">
      {feedback && (
        <div className={cn(
          'p-3 border font-bold font-mono text-xs uppercase tracking-widest',
          feedback.type === 'success' ? 'bg-green-500/15 border-green-700 text-green-600' : 'bg-red-500/15 border-red-700 text-red-600'
        )}>
          {feedback.message}
        </div>
      )}

      <div className="border-b border-red-800/30 pb-3">
        <h3 className="font-serif italic font-bold text-xs uppercase tracking-widest text-red-600">
          BAJA / MERMA · REGISTRO DE PRENDAS DADAS DE BAJA
        </h3>
        <p className="opacity-60 text-[10px] font-mono mt-1 uppercase tracking-widest font-bold text-red-600">
          DESCUENTA INVENTARIO · REQUIERE MOTIVO OBLIGATORIO
        </p>
      </div>

      {/* Productos */}
      <div className="flex flex-col gap-3">
        <label className="font-mono text-[9px] font-bold tracking-[0.2em] uppercase opacity-80">AGREGAR PRODUCTOS A DAR DE BAJA</label>
        <div className="border border-red-800/30 bg-red-500/10 p-3">
          <CascadeProductSelector
            products={products}
            onAdd={(item) => setLineItems(prev => [...prev, item])}
            stockLevels={stockLevels}
            fromLocation={fromLocation}
            opType="DISPATCH"
          />
        </div>
        {errors.lines && (
          <span className="font-mono text-[9px] font-bold text-red-700 uppercase border border-red-700 px-1 py-0.5 bg-red-500/15 w-fit tracking-wider">{errors.lines}</span>
        )}
        {lineItems.length > 0 && (
          <div className="flex flex-col gap-0 border border-red-800/30 overflow-hidden">
            <div className="bg-red-800 text-white px-3 py-1.5 font-mono text-[8px] font-bold uppercase tracking-widest flex justify-between">
              <span>PRENDAS A DAR DE BAJA</span>
              <span>{lineItems.length} L-NEAS · {lineItems.reduce((s, l) => s + (parseInt(l.qty) || 0), 0)} UND</span>
            </div>
            {lineItems.map((item, idx) => {
              const prod = products.find(p => p.id === item.productId);
              return (
                <div key={item.key} className={cn(
                  'flex items-center gap-2 px-3 py-2 font-mono text-[10px] border-b border-red-800/10 last:border-0',
                  idx % 2 === 0 ? 'bg-[var(--surface)]' : 'bg-red-500/10'
                )}>
                  <span className="opacity-40 text-[8px] w-4 shrink-0">{idx + 1}</span>
                  <span className="opacity-50 text-[9px] shrink-0">{prod?.code}</span>
                  <span className="font-bold flex-1 truncate uppercase">{prod?.name} {prod?.color} {prod?.size}</span>
                  <span className="font-black text-sm shrink-0">{item.qty}</span>
                  <button type="button" onClick={() => setLineItems(prev => prev.filter(l => l.key !== item.key))}
                    className="shrink-0 text-red-400 hover:text-red-700 transition-colors p-0.5">
                    <Minus size={11} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Ubicacion origen + Motivo */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormGroup label="UBICACION ORIGEN (ALMACEN)" error={errors.fromLocation}>
          <select
            value={fromLocation}
            onChange={e => { setFromLocation(e.target.value); setErrors(prev => ({ ...prev, fromLocation: '' })); }}
            className={cn('input-technical', errors.fromLocation && 'border-red-600 bg-red-500/10')}
          >
            <option value="">Seleccione Almacen...</option>
            {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </FormGroup>

        <FormGroup label="MOTIVO DE BAJA" error={errors.reason}>
          <select
            value={reason}
            onChange={e => { setReason(e.target.value); setErrors(prev => ({ ...prev, reason: '', customReason: '' })); }}
            className={cn('input-technical', errors.reason && 'border-red-600 bg-red-500/10')}
          >
            <option value="">- Seleccione motivo -</option>
            {WRITEOFF_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </FormGroup>

        {reason === 'Otro motivo' && (
          <FormGroup label="DESCRIBE EL MOTIVO" error={errors.customReason} className="md:col-span-2">
            <input
              type="text"
              value={customReason}
              onChange={e => { setCustomReason(e.target.value); setErrors(prev => ({ ...prev, customReason: '' })); }}
              className={cn('input-technical', errors.customReason && 'border-red-600 bg-red-500/10')}
              placeholder="EJ: PRENDAS VENCIDAS POR PLAZO DE ALMACENAMIENTO"
            />
          </FormGroup>
        )}

        <FormGroup label="OBSERVACIONES ADICIONALES (OPCIONAL)" className="md:col-span-2">
          <input
            type="text"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            className="input-technical"
            placeholder="EJ: LOTE 2024-03, DETECTADO EN REVISI-N MENSUAL"
          />
        </FormGroup>
      </div>

      {/* Foto evidencia */}
      <FormGroup label="EVIDENCIA FOTOGRÁFICA (RECOMENDADO)">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => photoInputRef.current?.click()}
            className="flex items-center gap-2 border border-[var(--border)] bg-[var(--bg-card-alt)] hover:bg-[var(--ink)] hover:text-[var(--ink-inv)] transition-all px-3 py-2 font-mono text-[10px] font-bold uppercase">
            <Camera size={13} />
            {photo ? 'CAMBIAR FOTO' : 'CAPTURAR / ADJUNTAR'}
          </button>
          {photo && (
            <button type="button" onClick={() => { setPhoto(null); if (photoInputRef.current) photoInputRef.current.value = ''; }}
              className="text-red-500 hover:text-red-700 transition-colors">
              <X size={14} />
            </button>
          )}
        </div>
        <input ref={photoInputRef} type="file" accept="image/*" capture="environment" onChange={handlePhotoCapture} className="hidden" />
        {photo && (
          <div className="mt-2 border border-[var(--border)]/20 bg-[var(--bg-card)] p-1 w-fit">
            <img src={photo} alt="evidencia" className="max-h-28 max-w-full object-contain" />
          </div>
        )}
      </FormGroup>

      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mt-2">
        <div className="font-mono text-[9px] opacity-40 uppercase tracking-widest">
          {lineItems.length} {lineItems.length === 1 ? 'L-NEA' : 'L-NEAS'} · {lineItems.reduce((s, l) => s + (parseInt(l.qty) || 0), 0)} UND TOTAL
        </div>
        <button
          type="button"
          onClick={handleSubmit}
          className="w-full sm:w-auto bg-red-800 border border-red-800 hover:bg-[var(--bg-input)] hover:text-red-600 text-white px-8 py-3.5 sm:py-3 text-[11px] font-mono tracking-widest font-bold transition-all shadow-[4px_4px_0_#991b1b] active:shadow-none active:translate-y-[4px] active:translate-x-[4px]"
        >
          REGISTRAR BAJA
        </button>
      </div>

      <style>{`
        .input-technical {
          width: 100%;
          background: rgba(255,255,255,.7);
          border: 1px solid #141414;
          border-radius: 0;
          padding: 10px 14px;
          color: #141414;
          font-size: 12px;
          font-weight: 700;
          font-family: var(--font-mono);
          text-transform: uppercase;
          outline: none;
          transition: all 0.1s;
        }
        .input-technical:focus { background: white; box-shadow: 2px 2px 0 0 #141414; }
      `}</style>

      {/* Preview modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--bg)] border-2 border-red-800 shadow-[6px_6px_0_#991b1b] w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="bg-red-800 text-white px-5 py-3 flex justify-between items-center">
              <div>
                <div className="font-mono text-[9px] opacity-70 uppercase tracking-widest">CONFIRMAR BAJA / MERMA</div>
                <div className="font-mono font-black text-sm uppercase tracking-widest">BAJA DE INVENTARIO</div>
              </div>
              <button onClick={() => setShowPreview(false)} className="font-mono text-xs opacity-60 hover:opacity-100">?</button>
            </div>
            <div className="p-5 flex flex-col gap-4">
              <div className="bg-red-500/10 border border-red-800/30 p-3 font-mono text-[10px] flex flex-col gap-1">
                <div className="flex gap-3"><span className="opacity-50 uppercase w-24 shrink-0">Motivo</span><span className="font-bold">{effectiveReason}</span></div>
                {notes && <div className="flex gap-3"><span className="opacity-50 uppercase w-24 shrink-0">Notas</span><span className="font-bold">{notes}</span></div>}
                <div className="flex gap-3"><span className="opacity-50 uppercase w-24 shrink-0">Almacen</span><span className="font-bold">{locations.find(l => l.id === fromLocation)?.name}</span></div>
                <div className="flex gap-3"><span className="opacity-50 uppercase w-24 shrink-0">Operador</span><span className="font-bold">{currentUser.username}</span></div>
              </div>
              <div className="border border-red-800/30">
                <div className="bg-red-800 text-white px-3 py-1.5 font-mono text-[9px] font-bold uppercase tracking-widest">PRENDAS A DAR DE BAJA</div>
                {lineItems.map((item, i) => {
                  const prod = products.find(p => p.id === item.productId);
                  return (
                    <div key={item.key} className={`flex justify-between items-center px-3 py-2 font-mono text-[10px] ${i % 2 === 0 ? 'bg-[var(--surface)]' : ''}`}>
                      <div>
                        <span className="font-bold">{prod?.code}</span>
                        <span className="opacity-60 ml-2">{prod?.name} {prod?.color} {prod?.size}</span>
                      </div>
                      <span className="font-black text-sm ml-4">{item.qty} uds</span>
                    </div>
                  );
                })}
                <div className="flex justify-between px-3 py-2 bg-red-500/15 border-t border-red-800/20 font-mono text-[10px] font-bold">
                  <span>TOTAL A DAR DE BAJA</span>
                  <span>{lineItems.reduce((s, l) => s + (parseInt(l.qty, 10) || 0), 0)} uds</span>
                </div>
              </div>
              <p className="font-mono text-[9px] text-red-600 font-bold uppercase tracking-widest border border-red-800/30 bg-red-500/10 p-2">
                ESTA ACCION DESCUENTA EL INVENTARIO Y NO SE PUEDE REVERTIR DIRECTAMENTE.
              </p>
              <div className="flex gap-2 pt-2">
                <button onClick={executeWriteOff} className="flex-1 bg-red-800 text-white py-2.5 text-xs font-bold font-mono uppercase hover:shadow-[2px_2px_0_#991b1b] transition-all">
                  CONFIRMAR BAJA
                </button>
                <button onClick={() => setShowPreview(false)} className="flex-1 border border-[var(--border)] py-2.5 text-xs font-bold font-mono uppercase hover:bg-[var(--surface)]">
                  VOLVER
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </form>
  );
};

// --- QR Scanner ----------------------------------------------------------------

const QRScannerModal: React.FC<{ onClose: () => void; onDetected: (productId: string) => void }> = ({ onClose, onDetected }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [status, setStatus] = useState<'starting' | 'scanning' | 'error'>('starting');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    let active = true;
    const reader = new BrowserQRCodeReader();

    const start = async () => {
      if (!videoRef.current) return;
      try {
        controlsRef.current = await reader.decodeFromVideoDevice(
          undefined,
          videoRef.current,
          (result) => {
            if (!active || !result) return;
            active = false;
            controlsRef.current?.stop();
            try {
              const data = JSON.parse(result.getText());
              if (data?.id) {
                onDetected(data.id);
              } else {
                setErrorMsg('QR no corresponde a un producto valido.');
                setStatus('error');
                active = true;
              }
            } catch {
              setErrorMsg('QR no reconocido. Usa un QR generado por Etiquetas.');
              setStatus('error');
              active = true;
            }
          },
        );
        if (active) setStatus('scanning');
      } catch (err: unknown) {
        const e = err as Error;
        setErrorMsg(e?.message?.toLowerCase().includes('permission') ? 'Sin acceso a c-mara.' : 'No se pudo iniciar la c-mara.');
        setStatus('error');
      }
    };

    start();
    return () => { active = false; controlsRef.current?.stop(); };
  }, []);

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[var(--bg)] border-2 border-[var(--border)] shadow-[8px_8px_0_var(--border)] w-full max-w-sm flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="border-b-2 border-[var(--border)] bg-[var(--ink)] text-[var(--ink-inv)] px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ScanLine size={15} />
            <span className="font-mono text-[10px] font-bold tracking-widest uppercase">ESCANEAR QR PRODUCTO</span>
          </div>
          <button onClick={onClose} className="opacity-60 hover:opacity-100"><X size={15} /></button>
        </div>
        <div className="relative bg-black">
          <video ref={videoRef} className="w-full" style={{ minHeight: 280 }} />
          {status === 'starting' && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60">
              <span className="font-mono text-[10px] text-white tracking-widest animate-pulse uppercase">INICIANDO C-MARA...</span>
            </div>
          )}
        </div>
        <div className="px-4 py-3 border-t border-[var(--border)]/20">
          {status === 'scanning' && <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-green-700 text-center animate-pulse">APUNTA AL QR DEL PRODUCTO</p>}
          {status === 'error' && (
            <div className="flex flex-col gap-2">
              <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-red-700 text-center">{errorMsg}</p>
              <button onClick={onClose} className="w-full border border-[var(--border)] bg-[var(--ink)] text-[var(--ink-inv)] py-2 font-mono text-[10px] font-bold tracking-widest uppercase">CERRAR</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// --- Bulletin Modal -------------------------------------------------------------

interface BulletinData {
  type: TransactionType;
  reference: string;
  date: string;
  operator: string;
  brand: string;
  items: { productName: string; productCode: string; quantity: number; variant?: string; serialNumber?: string }[];
  fromLocation?: string;
  toLocation?: string;
  contact?: string;
  signature?: string;
  photo?: string;
}

function buildBulletinHTML(p: BulletinData): string {
  const TYPE_LABEL: Record<TransactionType, string> = { RECEPTION: 'RECEPCIÓN', DISPATCH: 'DESPACHO', TRANSFER: 'TRASLADO' };
  const TYPE_COLOR: Record<TransactionType, string> = { RECEPTION: '#16a34a', DISPATCH: '#dc2626', TRANSFER: '#0891b2' };
  const label = TYPE_LABEL[p.type];
  const color = TYPE_COLOR[p.type];
  const brandDisplay = p.brand.replace('_', ' ');
  const totalQty = p.items.reduce((s, i) => s + i.quantity, 0);
  const contactLabel = p.type === 'RECEPTION' ? 'Proveedor' : 'Cliente';

  const row = (lbl: string, val: string) =>
    `<tr>
      <td style="padding:8px 0;font-size:11px;letter-spacing:.15em;opacity:.5;text-transform:uppercase;font-weight:700;border-bottom:1px solid rgba(20,20,20,.1);width:40%">${lbl}</td>
      <td style="padding:8px 0;font-size:11px;font-weight:900;text-transform:uppercase;text-align:right;border-bottom:1px solid rgba(20,20,20,.1)">${val}</td>
    </tr>`;

  const itemsHTML = p.items.length === 1
    ? `<div style="border:2px solid #141414;padding:16px;margin:20px 0;background:#fff">
        <div style="font-size:9px;letter-spacing:.25em;opacity:.4;text-transform:uppercase;margin-bottom:4px">${p.items[0].productCode}</div>
        <div style="font-size:15px;font-weight:900;text-transform:uppercase;letter-spacing:.05em">${p.items[0].productName}</div>
        ${p.items[0].variant ? `<div style="font-size:9px;opacity:.5;margin-top:4px;text-transform:uppercase;letter-spacing:.1em">${p.items[0].variant}</div>` : ''}
        ${p.items[0].serialNumber ? `<div style="font-size:9px;opacity:.5;margin-top:2px">S/N: ${p.items[0].serialNumber}</div>` : ''}
        <div style="display:inline-block;background:#141414;color:#E4E3E0;font-size:22px;font-weight:900;padding:8px 18px;margin-top:12px;letter-spacing:.05em">${p.items[0].quantity} UND</div>
      </div>`
    : `<div style="margin:20px 0">
        <div style="font-size:9px;letter-spacing:.2em;opacity:.4;text-transform:uppercase;margin-bottom:8px;font-weight:700">PRODUCTOS — ${p.items.length} LÍNEAS</div>
        <table style="width:100%;border-collapse:collapse;background:#fff;border:2px solid #141414">
          <thead><tr style="background:#141414;color:#E4E3E0">
            <td style="padding:7px 10px;font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase">Código</td>
            <td style="padding:7px 10px;font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase">Producto</td>
            <td style="padding:7px 10px;font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;text-align:right">Cant.</td>
          </tr></thead>
          <tbody>${p.items.map(it => `<tr style="border-bottom:1px solid #eee">
            <td style="padding:6px 10px;font-size:9px;font-weight:700;opacity:.5">${it.productCode}</td>
            <td style="padding:6px 10px;font-size:11px;font-weight:900;text-transform:uppercase">
              ${it.productName}
              ${it.variant ? `<div style="font-size:9px;font-weight:400;opacity:.55;text-transform:uppercase;letter-spacing:.08em;margin-top:2px">${it.variant}</div>` : ''}
              ${it.serialNumber ? `<div style="font-size:9px;font-weight:400;opacity:.45;margin-top:1px">S/N: ${it.serialNumber}</div>` : ''}
            </td>
            <td style="padding:6px 10px;font-size:11px;font-weight:900;text-align:right">${it.quantity}</td>
          </tr>`).join('')}</tbody>
          <tfoot><tr style="background:#f5f5f5">
            <td colspan="2" style="padding:8px 10px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.1em">TOTAL UNIDADES</td>
            <td style="padding:8px 10px;font-size:14px;font-weight:900;text-align:right">${totalQty}</td>
          </tr></tfoot>
        </table>
      </div>`;

  const sigHTML = p.signature
    ? `<div style="margin-top:16px;padding-top:16px;border-top:1px dashed rgba(20,20,20,.3)">
        <div style="font-size:9px;letter-spacing:.2em;opacity:.5;text-transform:uppercase;margin-bottom:8px;font-weight:700">FIRMA DE CONFORMIDAD</div>
        <img src="${p.signature}" alt="Firma" style="max-width:200px;max-height:80px;border:1px solid #141414;padding:4px;background:#fff;display:block">
      </div>` : '';

  const photoHTML = p.photo
    ? `<div style="margin-top:16px;padding-top:16px;border-top:1px dashed rgba(20,20,20,.3)">
        <div style="font-size:9px;letter-spacing:.2em;opacity:.5;text-transform:uppercase;margin-bottom:8px;font-weight:700">EVIDENCIA FOTOGRÁFICA</div>
        <img src="${p.photo}" alt="Evidencia" style="max-width:100%;max-height:240px;border:1px solid #141414;padding:4px;background:#fff;display:block">
      </div>` : '';

  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">
<style>*{box-sizing:border-box}body{margin:0;padding:24px 32px;background:#f0efec;font-family:'Courier New',monospace}</style>
</head><body>
  <div style="max-width:680px;margin:0 auto;background:#E4E3E0;border:2px solid #141414;box-shadow:6px 6px 0 #141414">
    <div style="background:#141414;color:#E4E3E0;padding:28px 36px">
      <div style="font-size:9px;letter-spacing:.35em;opacity:.5;text-transform:uppercase">${brandDisplay} — SISTEMA DE ALMACÉN</div>
      <div style="display:inline-block;background:${color};color:#fff;padding:6px 16px;font-size:10px;font-weight:900;letter-spacing:.3em;margin-top:14px;text-transform:uppercase">${label}</div>
      <div style="font-size:28px;font-weight:900;letter-spacing:.08em;margin-top:10px;text-transform:uppercase">${p.reference}</div>
      <div style="font-size:10px;opacity:.4;margin-top:4px;letter-spacing:.15em">${p.date}</div>
    </div>
    <div style="padding:28px 36px">
      <table style="width:100%;border-collapse:collapse">
        ${row('Operador', p.operator)}
        ${p.contact ? row(contactLabel, p.contact) : ''}
        ${p.fromLocation ? row('Origen', p.fromLocation) : ''}
        ${p.toLocation ? row('Destino', p.toLocation) : ''}
      </table>
      ${itemsHTML}${sigHTML}${photoHTML}
    </div>
    <div style="background:#D4D3D0;border-top:1px solid #141414;padding:12px 36px;font-size:9px;opacity:.45;letter-spacing:.15em;text-transform:uppercase">
      LogixZazu v3.0 — Comprobante generado automáticamente // ${p.date}
    </div>
  </div>
</body></html>`;
}

const BulletinModal: React.FC<{ data: BulletinData; onClose: () => void }> = ({ data, onClose }) => {
  const html = buildBulletinHTML(data);

  const handlePrint = () => {
    const win = window.open('', '_blank', 'width=700,height=900');
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.onload = () => win.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8" style={{ background: 'rgba(0,0,0,0.75)' }} onClick={onClose}>
      <div
        className="w-full flex flex-col"
        style={{ background: 'var(--bg-card)', border: '2px solid var(--border)', boxShadow: '8px 8px 0 var(--border)', maxWidth: '780px', height: '92vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b shrink-0" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          <div className="flex items-center gap-2">
            <Mail size={13} style={{ color: 'var(--ink)' }} />
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: 'var(--ink)' }}>
              Comprobante · {data.reference}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 font-mono text-[9px] font-bold uppercase tracking-wider border transition-all hover:opacity-80"
              style={{ borderColor: 'var(--border)', color: 'var(--ink-inv)', background: 'var(--ink)' }}
            >
              <Printer size={11} /> Imprimir
            </button>
            <button onClick={onClose} className="p-1 hover:opacity-60 transition-opacity" style={{ color: 'var(--ink)' }}>
              <X size={14} />
            </button>
          </div>
        </div>

        {/* iframe preview — ocupa todo el espacio restante */}
        <div className="flex-1 overflow-hidden">
          <iframe
            srcDoc={html}
            title="Comprobante de operación"
            style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
            sandbox="allow-same-origin"
          />
        </div>
      </div>
    </div>
  );
};

// --- Transaction Log ------------------------------------------------------------

const PAGE_SIZE = 50;

type LogFilter = { type?: string; dateFrom?: string; dateTo?: string } | null;

const TransactionLog: React.FC<{ initialFilter?: LogFilter }> = ({ initialFilter }) => {
  const {
    transactions, products, contacts, locations, activeBrand,
    deleteTransaction, hardDeleteTransaction, hardDeleteTransactions,
    updateTransaction, clearAllTransactions, currentUser,
  } = useAppContext();
  const isAdmin = currentUser.role === 'ADMIN_GENERAL';

  // Filters
  const [filterType, setFilterType] = useState<'ALL' | TransactionType>(
    (initialFilter?.type as TransactionType) || 'ALL'
  );
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'ACTIVE' | 'CANCELLED'>('ALL');
  const [filterDateFrom, setFilterDateFrom] = useState<string>(initialFilter?.dateFrom || '');
  const [filterDateTo,   setFilterDateTo]   = useState<string>(initialFilter?.dateTo   || '');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  // Clear sessionStorage after reading once
  React.useEffect(() => {
    if (initialFilter) sessionStorage.removeItem('operationsLogFilter');
  }, []);

  // Editing
  const [editTx, setEditTx] = useState<Transaction | null>(null);
  const [editRef, setEditRef] = useState('');
  const [editContact, setEditContact] = useState('');
  const [editDate, setEditDate] = useState('');

  // Action state
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const [toastErr, setToastErr] = useState(false);

  // Single action modals
  const [cancelTx, setCancelTx] = useState<Transaction | null>(null);   // anular (all roles)
  const [purgeTx, setPurgeTx]   = useState<Transaction | null>(null);   // borrar registro (admin only)
  const [showPurgeAll, setShowPurgeAll] = useState(false);
  const [bulletinData, setBulletinData] = useState<BulletinData | null>(null);

  // Multi-select (all roles for cancel; admin only for purge)
  const [selected, setSelected]           = useState<Set<string>>(new Set());
  const [showBulkCancel, setShowBulkCancel] = useState(false);
  const [showBulkPurge, setShowBulkPurge]   = useState(false);
  const lastSelectedRef = useRef<string | null>(null);

  const showToast = (msg: string, err = false) => {
    setToast(msg); setToastErr(err);
    setTimeout(() => setToast(''), 3000);
  };

  // Derived lists
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const from = filterDateFrom ? new Date(filterDateFrom + 'T00:00:00') : null;
    const to   = filterDateTo   ? new Date(filterDateTo   + 'T23:59:59') : null;
    return transactions.filter(tx => {
      if (filterType !== 'ALL' && tx.type !== filterType) return false;
      if (filterStatus === 'ACTIVE'    && tx.status === 'CANCELLED') return false;
      if (filterStatus === 'CANCELLED' && tx.status !== 'CANCELLED') return false;
      if (from || to) {
        const d = new Date(tx.date);
        if (from && d < from) return false;
        if (to   && d > to)   return false;
      }
      if (q) {
        const prod = products.find(p => p.id === tx.productId);
        const txt = [prod?.name, prod?.code, tx.reference,
          locations.find(l => l.id === tx.fromLocationId)?.name,
          locations.find(l => l.id === tx.toLocationId)?.name,
          contacts.find(c => c.id === tx.contactId)?.name,
        ].filter(Boolean).join(' ').toLowerCase();
        if (!txt.includes(q)) return false;
      }
      return true;
    });
  }, [transactions, filterType, filterStatus, filterDateFrom, filterDateTo, search, products, locations, contacts]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows   = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const selectableRows = pageRows.filter(tx => tx.status !== 'CANCELLED');

  // Reset page when filters change
  const setFilter = (fn: () => void) => { fn(); setPage(1); setSelected(new Set()); lastSelectedRef.current = null; };

  // Multi-select helpers
  const toggleSelect = (id: string, shiftKey = false) => {
    if (shiftKey && lastSelectedRef.current && lastSelectedRef.current !== id) {
      const ids = selectableRows.map(tx => tx.id);
      const a = ids.indexOf(lastSelectedRef.current);
      const b = ids.indexOf(id);
      if (a !== -1 && b !== -1) {
        const [lo, hi] = a < b ? [a, b] : [b, a];
        const range = ids.slice(lo, hi + 1);
        setSelected(prev => { const n = new Set(prev); range.forEach(r => n.add(r)); return n; });
        lastSelectedRef.current = id;
        return;
      }
    }
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
    lastSelectedRef.current = id;
  };

  const toggleSelectAll = () => {
    const ids = selectableRows.map(tx => tx.id);
    const allSel = ids.length > 0 && ids.every(id => selected.has(id));
    setSelected(allSel ? new Set() : new Set(ids));
  };

  // Action handlers
  const handleCancel = async () => {
    if (!cancelTx) return;
    setBusy(true);
    try {
      await deleteTransaction(cancelTx.id);
      setCancelTx(null);
      showToast('Operacion anulada. Stock revertido.');
    } catch (e: any) { showToast(e.message || 'Error al anular', true); }
    finally { setBusy(false); }
  };

  const handlePurge = async () => {
    if (!purgeTx) return;
    setBusy(true);
    try {
      await hardDeleteTransaction(purgeTx.id);
      setPurgeTx(null);
      showToast('Registro eliminado.');
    } catch (e: any) { showToast(e.message || 'Error al eliminar', true); }
    finally { setBusy(false); }
  };

  const handleBulkCancel = async () => {
    setBusy(true); setShowBulkCancel(false);
    const ids = Array.from(selected); let failed = 0;
    for (const id of ids) { try { await deleteTransaction(id); } catch { failed++; } }
    setSelected(new Set());
    setBusy(false);
    showToast(failed ? `${failed} no pudieron anularse.` : `${ids.length} operaciones anuladas.`, !!failed);
  };

  const handleBulkPurge = async () => {
    setBusy(true); setShowBulkPurge(false);
    const ids = Array.from(selected);
    try {
      await hardDeleteTransactions(ids);
      setSelected(new Set());
      showToast(`${ids.length} registros eliminados.`);
    } catch (e: any) { showToast(e.message || 'Error al eliminar', true); }
    finally { setBusy(false); }
  };

  const handlePurgeAll = async () => {
    setBusy(true); setShowPurgeAll(false);
    try {
      await clearAllTransactions();
      showToast('Todos los registros eliminados. Stock reiniciado a cero.');
    } catch (e: any) { showToast(e.message || 'Error', true); }
    finally { setBusy(false); }
  };

  const handleEditSave = async () => {
    if (!editTx || !editRef.trim()) return;
    setBusy(true);
    try {
      await updateTransaction(editTx.id, {
        reference: editRef.trim(),
        contactId: editContact || null,
        ...(editTx.type === 'RECEPTION' && editDate ? { date: editDate + 'T12:00:00Z' } : {}),
      });
      setEditTx(null);
      showToast('Operacion actualizada.');
    } catch (e: any) { showToast(e.message || 'Error al actualizar', true); }
    finally { setBusy(false); }
  };

  const allPageSelected = selectableRows.length > 0 && selectableRows.every(tx => selected.has(tx.id));

  return (
    <div className="flex flex-col gap-4">

      {/* Bulletin modal */}
      {bulletinData && <BulletinModal data={bulletinData} onClose={() => setBulletinData(null)} />}

      {/* Toast */}
      {toast && (
        <div className={cn(
          'border px-3 py-2 font-mono text-[10px] font-bold uppercase flex items-center justify-between',
          toastErr ? 'border-red-600 bg-red-500/10 text-red-700' : 'border-green-600 bg-green-500/10 text-green-700'
        )}>
          {toast}
          <button onClick={() => setToast('')} className="ml-3 opacity-60 hover:opacity-100"><X size={12} /></button>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Type filter */}
        <div className="flex items-center border border-[var(--border)]/20 bg-[var(--bg-card)] shrink-0">
          {(['ALL', 'RECEPTION', 'DISPATCH', 'TRANSFER'] as const).map(t => (
            <button key={t}
              onClick={() => setFilter(() => setFilterType(t))}
              className={cn('px-2.5 py-1.5 font-mono text-[8px] font-black tracking-widest uppercase border-r border-[var(--border)]/20 last:border-r-0 transition-all',
                filterType === t ? 'bg-[var(--ink)] text-[var(--ink-inv)]' : 'hover:bg-[var(--ink)]/5')}
            >
              {t === 'ALL' ? 'TODO' : t === 'RECEPTION' ? 'RX' : t === 'DISPATCH' ? 'TX' : 'MV'}
            </button>
          ))}
        </div>

        {/* Status filter */}
        <div className="flex items-center border border-[var(--border)]/20 bg-[var(--bg-card)] shrink-0">
          {(['ALL', 'ACTIVE', 'CANCELLED'] as const).map(s => (
            <button key={s}
              onClick={() => setFilter(() => setFilterStatus(s))}
              className={cn('px-2.5 py-1.5 font-mono text-[8px] font-black tracking-widest uppercase border-r border-[var(--border)]/20 last:border-r-0 transition-all',
                filterStatus === s ? 'bg-[var(--ink)] text-[var(--ink-inv)]' : 'hover:bg-[var(--ink)]/5')}
            >
              {s === 'ALL' ? 'TODOS' : s === 'ACTIVE' ? 'ACTIVOS' : 'ANULADOS'}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="flex items-center border border-[var(--border)]/20 bg-[var(--bg-card)] px-2 gap-1.5 flex-1 min-w-[160px]">
          <Search size={11} className="opacity-40 shrink-0" />
          <input
            value={search}
            onChange={e => setFilter(() => setSearch(e.target.value))}
            placeholder="Buscar producto, ref., ubicacion..."
            className="bg-transparent font-mono text-[9px] py-1.5 outline-none w-full placeholder:opacity-40"
          />
          {search && <button onClick={() => setFilter(() => setSearch(''))} className="opacity-40 hover:opacity-100"><X size={10} /></button>}
        </div>

        {/* Date range filter */}
        <div className="flex items-center gap-1 border border-[var(--border)]/20 bg-[var(--bg-card)] px-2 py-1 shrink-0">
          <span className="font-mono text-[8px] opacity-40 uppercase">Desde</span>
          <input type="date" value={filterDateFrom}
            onChange={e => setFilter(() => setFilterDateFrom(e.target.value))}
            className="bg-transparent font-mono text-[8px] outline-none cursor-pointer" />
          <span className="font-mono text-[8px] opacity-40 uppercase mx-1">-</span>
          <span className="font-mono text-[8px] opacity-40 uppercase">Hasta</span>
          <input type="date" value={filterDateTo}
            onChange={e => setFilter(() => setFilterDateTo(e.target.value))}
            className="bg-transparent font-mono text-[8px] outline-none cursor-pointer" />
          {(filterDateFrom || filterDateTo) && (
            <button onClick={() => setFilter(() => { setFilterDateFrom(''); setFilterDateTo(''); })}
              className="ml-1 opacity-40 hover:opacity-100"><X size={10} /></button>
          )}
        </div>

        <div className="flex-1 h-px bg-[var(--ink)]/10 hidden sm:block min-w-[10px]" />

        {/* Bulk cancel · all roles when selected */}
        {selected.size > 0 && (
          <button onClick={() => setShowBulkCancel(true)} disabled={busy}
            className="flex items-center gap-1.5 font-mono text-[8px] font-bold uppercase border border-orange-500 text-orange-600 px-2.5 py-1.5 hover:bg-orange-500 hover:text-white transition-all shrink-0 disabled:opacity-50">
            <ShieldOff size={10} /> ANULAR {selected.size}
          </button>
        )}
        {/* Bulk hard-delete · admin only */}
        {isAdmin && selected.size > 0 && (
          <button onClick={() => setShowBulkPurge(true)} disabled={busy}
            className="flex items-center gap-1.5 font-mono text-[8px] font-bold uppercase border border-red-600 bg-red-600 text-white px-2.5 py-1.5 hover:bg-red-700 transition-all shrink-0 disabled:opacity-50">
            <Trash2 size={10} /> BORRAR {selected.size}
          </button>
        )}

        {/* Purge all · admin only */}
        {isAdmin && (
          <button onClick={() => setShowPurgeAll(true)}
            className="flex items-center gap-1.5 font-mono text-[8px] font-bold uppercase border border-red-400 text-red-600 px-2.5 py-1.5 hover:bg-red-600 hover:text-white transition-all shrink-0">
            <Trash2 size={10} /> BORRAR TODO
          </button>
        )}
      </div>

      {/* Count + pagination info */}
      <div className="flex items-center justify-between">
        <span className="font-mono text-[8px] opacity-40 uppercase tracking-widest">
          {filtered.length} registro{filtered.length !== 1 ? 's' : ''}{search || filterType !== 'ALL' || filterStatus !== 'ALL' || filterDateFrom || filterDateTo ? ' (filtrado)' : ''}
        </span>
        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="font-mono text-[8px] px-2 py-1 border border-[var(--border)]/20 hover:bg-[var(--ink)]/5 disabled:opacity-30 transition-all">-</button>
            <span className="font-mono text-[8px] opacity-50 px-1">{page} / {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="font-mono text-[8px] px-2 py-1 border border-[var(--border)]/20 hover:bg-[var(--ink)]/5 disabled:opacity-30 transition-all">-</button>
          </div>
        )}
      </div>

      {/* Table */}
      {pageRows.length === 0 ? (
        <div className="border border-[var(--border)]/20 bg-[var(--surface-alt)] p-8 text-center font-mono text-[10px] opacity-40 uppercase tracking-widest">
          SIN REGISTROS
        </div>
      ) : (
        <div className="flex flex-col gap-0.5">
          {/* Select-all row · all roles */}
          {selectableRows.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--ink)]/5 border border-[var(--border)]/10">
              <input type="checkbox" checked={allPageSelected} onChange={toggleSelectAll}
                className="w-3.5 h-3.5 accent-[#141414] cursor-pointer" />
              <span className="font-mono text-[8px] opacity-50 uppercase tracking-widest">
                {selected.size > 0 ? `${selected.size} seleccionado${selected.size > 1 ? 's' : ''}` : 'Seleccionar pagina'}
              </span>
            </div>
          )}

          {pageRows.map(tx => {
            const product  = products.find(p => p.id === tx.productId);
            const contact  = contacts.find(c => c.id === tx.contactId);
            const fromLoc  = locations.find(l => l.id === tx.fromLocationId);
            const toLoc    = locations.find(l => l.id === tx.toLocationId);
            const isCancelled = tx.status === 'CANCELLED';
            const badge    = TX_BADGE[tx.type];
            const isSel    = selected.has(tx.id);

            const txVariant = [product?.color, product?.size].filter(Boolean).join(' · ') || undefined;
            const openBulletin = () => setBulletinData({
              type: tx.type,
              reference: tx.reference,
              date: new Date(tx.date).toLocaleString('es-PE', { dateStyle: 'long', timeStyle: 'short' }),
              operator: tx.user,
              brand: activeBrand,
              items: [{ productName: product?.name ?? tx.productId, productCode: product?.code ?? '', quantity: tx.quantity, variant: txVariant, serialNumber: tx.serialNumber }],
              fromLocation: fromLoc?.name,
              toLocation: toLoc?.name,
              contact: contact?.name,
              signature: tx.signature,
            });

            return (
              <div key={tx.id} className={cn(
                'border bg-[var(--surface)] flex items-center gap-2 md:gap-3 px-3 py-2.5 text-[11px] font-mono transition-all',
                isCancelled ? 'border-[var(--border)]/10 opacity-40' : 'border-[var(--border)]/15 hover:border-[var(--border)]/30',
                isSel && !isCancelled && 'bg-orange-500/10 border-orange-500/40'
              )}>
                {/* Checkbox · all roles, non-cancelled */}
                {isCancelled
                  ? <div className="w-3.5 h-3.5 shrink-0" />
                  : <input type="checkbox" checked={isSel} onChange={() => {}}
                      className="w-3.5 h-3.5 shrink-0 accent-[var(--ink)] cursor-pointer"
                      onClick={e => { e.stopPropagation(); toggleSelect(tx.id, e.shiftKey); }} />
                }

                <div className={cn('shrink-0 w-7 text-center text-[8px] font-black py-1 border', badge.cls)}>{badge.label}</div>
                <div className="shrink-0 text-[9px] opacity-40 w-24 hidden sm:block leading-tight">
                  {new Date(tx.date).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' })}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold truncate">{product?.name ?? tx.productId}</div>
                  <div className="text-[9px] opacity-50 truncate">
                    {product?.code}
                    {(product?.color || product?.size) && <span className="opacity-70"> · {[product?.color, product?.size].filter(Boolean).join(' / ')}</span>}
                    {contact ? ` · ${contact.name}` : ''}
                  </div>
                </div>
                <div className="shrink-0 bg-[var(--ink)] text-[var(--ink-inv)] px-2 py-0.5 text-[10px] font-black">{tx.quantity}</div>
                <div className="hidden md:flex items-center gap-1 shrink-0 text-[9px] opacity-50 max-w-[180px]">
                  {fromLoc && <span className="truncate">{fromLoc.name}</span>}
                  {fromLoc && toLoc && <ArrowRightLeft size={8} className="opacity-40 shrink-0" />}
                  {toLoc && <span className="truncate">{toLoc.name}</span>}
                </div>
                <div className="shrink-0 font-mono text-[9px] opacity-40 hidden lg:block truncate max-w-[100px]">{tx.reference}</div>

                {isCancelled ? (
                  <div className="flex items-center gap-0.5 shrink-0">
                    <span className="text-[8px] font-black text-red-500 border border-red-500/50 px-1.5 py-0.5 bg-red-500/10">ANULADO</span>
                    {/* Admin: hard-delete a cancelled record */}
                    {isAdmin && (
                      <button onClick={() => setPurgeTx(tx)} title="Eliminar registro"
                        className="p-1.5 border border-transparent hover:border-red-600 hover:bg-red-600 hover:text-white transition-all text-red-400 ml-0.5">
                        <Trash2 size={11} />
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-0.5 shrink-0">
                    {/* Bulletin / comprobante */}
                    <button onClick={openBulletin} title="Ver comprobante"
                      className="p-1.5 border border-transparent hover:border-[var(--border)] hover:bg-[var(--ink)] hover:text-[var(--ink-inv)] transition-all">
                      <Mail size={12} />
                    </button>
                    {/* Edit · all roles */}
                    <button onClick={() => { setEditTx(tx); setEditRef(tx.reference); setEditContact(tx.contactId ?? ''); setEditDate(tx.date.slice(0, 10)); }}
                      title="Editar" className="p-1.5 border border-transparent hover:border-[var(--border)] hover:bg-[var(--ink)] hover:text-[var(--ink-inv)] transition-all">
                      <Pencil size={12} />
                    </button>
                    {/* Cancel (anular) · all roles */}
                    <button onClick={() => setCancelTx(tx)} title="Anular"
                      className="p-1.5 border border-transparent hover:border-orange-500 hover:bg-orange-500 hover:text-white transition-all text-orange-500">
                      <ShieldOff size={12} />
                    </button>
                    {/* Hard delete · admin only */}
                    {isAdmin && (
                      <button onClick={() => setPurgeTx(tx)} title="Eliminar registro"
                        className="p-1.5 border border-transparent hover:border-red-600 hover:bg-red-600 hover:text-white transition-all text-red-400">
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Bottom pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1 pt-1">
          <button onClick={() => setPage(1)} disabled={page === 1}
            className="font-mono text-[8px] px-2 py-1 border border-[var(--border)]/20 hover:bg-[var(--ink)]/5 disabled:opacity-30 transition-all">-</button>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="font-mono text-[8px] px-2 py-1 border border-[var(--border)]/20 hover:bg-[var(--ink)]/5 disabled:opacity-30 transition-all">-</button>
          <span className="font-mono text-[8px] opacity-50 px-2">{page} / {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            className="font-mono text-[8px] px-2 py-1 border border-[var(--border)]/20 hover:bg-[var(--ink)]/5 disabled:opacity-30 transition-all">-</button>
          <button onClick={() => setPage(totalPages)} disabled={page === totalPages}
            className="font-mono text-[8px] px-2 py-1 border border-[var(--border)]/20 hover:bg-[var(--ink)]/5 disabled:opacity-30 transition-all">-</button>
        </div>
      )}

      {/* -- Modals ----------------------------------------------------------- */}

      {/* Edit modal */}
      {editTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-[var(--bg)] border-2 border-[var(--border)] shadow-[8px_8px_0_var(--border)] w-full max-w-sm">
            <div className="border-b-2 border-[var(--border)] bg-[var(--ink)] text-[var(--ink-inv)] px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2"><Pencil size={13} /><span className="font-mono text-[10px] font-bold tracking-widest uppercase">EDITAR OPERACION</span></div>
              <button onClick={() => setEditTx(null)} className="opacity-60 hover:opacity-100"><X size={14} /></button>
            </div>
            <div className="p-5 flex flex-col gap-4">
              <div className="font-mono text-[9px] opacity-50 uppercase tracking-widest border-b border-[var(--border)]/10 pb-2">
                {editTx.type} · {products.find(p => p.id === editTx.productId)?.name} · {editTx.quantity} UND
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[9px] font-bold tracking-[0.2em] uppercase opacity-70">REFERENCIA / GU-A</label>
                <input type="text" value={editRef} onChange={e => setEditRef(e.target.value)}
                  className="w-full border border-[var(--border)] bg-[var(--bg-input)] px-3 py-2 font-mono text-xs font-bold uppercase outline-none focus:shadow-[2px_2px_0_var(--border)] transition-all" />
              </div>
              {(editTx.type === 'RECEPTION' || editTx.type === 'DISPATCH') && (
                <div className="flex flex-col gap-1.5">
                  <label className="font-mono text-[9px] font-bold tracking-[0.2em] uppercase opacity-70">{editTx.type === 'RECEPTION' ? 'PROVEEDOR' : 'CLIENTE'}</label>
                  <select value={editContact} onChange={e => setEditContact(e.target.value)}
                    className="w-full border border-[var(--border)] bg-[var(--bg-input)] px-3 py-2 font-mono text-xs font-bold uppercase outline-none focus:shadow-[2px_2px_0_var(--border)] transition-all">
                    <option value="">-- Sin contacto --</option>
                    {useAppContext().contacts.filter(c => editTx.type === 'RECEPTION' ? c.type === 'SUPPLIER' : c.type === 'CLIENT').map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}
              {editTx.type === 'RECEPTION' && (
                <div className="flex flex-col gap-1.5">
                  <label className="font-mono text-[9px] font-bold tracking-[0.2em] uppercase opacity-70">FECHA DE RECEPCION</label>
                  <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)}
                    className="w-full border border-[var(--border)] bg-[var(--bg-input)] px-3 py-2 font-mono text-xs font-bold outline-none focus:shadow-[2px_2px_0_var(--border)] transition-all" />
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <button onClick={handleEditSave} disabled={busy || !editRef.trim()}
                  className="flex-1 bg-[var(--ink)] text-[var(--ink-inv)] py-2.5 font-mono text-[10px] font-bold tracking-widest uppercase hover:opacity-80 disabled:opacity-50 transition-all">
                  {busy ? 'GUARDANDO...' : 'GUARDAR'}
                </button>
                <button onClick={() => setEditTx(null)}
                  className="flex-1 border border-[var(--border)] py-2.5 font-mono text-[10px] font-bold tracking-widest uppercase hover:bg-[var(--ink)] hover:text-[var(--ink-inv)] transition-all">
                  CANCELAR
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cancel (anular) single */}
      {cancelTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-[var(--bg)] border-4 border-orange-500 shadow-[8px_8px_0_var(--border)] w-full max-w-sm">
            <div className="border-b border-orange-500 bg-orange-500 px-4 py-3 flex items-center gap-2">
              <ShieldOff size={15} className="text-white" />
              <span className="font-mono text-[10px] font-bold tracking-widest uppercase text-white">ANULAR OPERACION</span>
            </div>
            <div className="p-5 flex flex-col gap-4">
              <p className="font-mono text-xs font-bold uppercase text-center leading-relaxed">
                -Anular <span className="text-orange-600">{cancelTx.reference}</span>?<br />
                <span className="text-[9px] opacity-50 normal-case font-normal block mt-1">El stock ser- revertido. El registro permanece como ANULADO.</span>
              </p>
              <div className="flex gap-2">
                <button onClick={handleCancel} disabled={busy}
                  className="flex-1 bg-orange-500 border border-orange-500 text-white py-2.5 font-mono text-[10px] font-bold tracking-widest uppercase hover:bg-orange-600 disabled:opacity-50 transition-all">
                  {busy ? 'ANULANDO...' : 'CONFIRMAR'}
                </button>
                <button onClick={() => setCancelTx(null)}
                  className="flex-1 border border-[var(--border)] py-2.5 font-mono text-[10px] font-bold tracking-widest uppercase hover:bg-[var(--ink)] hover:text-[var(--ink-inv)] transition-all">
                  CANCELAR
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hard-delete single */}
      {purgeTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-[var(--bg)] border-4 border-red-600 shadow-[8px_8px_0_var(--border)] w-full max-w-sm">
            <div className="border-b border-red-600 bg-red-600 px-4 py-3 flex items-center gap-2">
              <Trash2 size={15} className="text-white" />
              <span className="font-mono text-[10px] font-bold tracking-widest uppercase text-white">ELIMINAR REGISTRO</span>
            </div>
            <div className="p-5 flex flex-col gap-4">
              <p className="font-mono text-xs font-bold uppercase text-center leading-relaxed">
                -Eliminar el registro <span className="text-red-600">{purgeTx.reference}</span>?<br />
                <span className="text-[9px] opacity-50 normal-case font-normal block mt-1">
                  {purgeTx.status !== 'CANCELLED'
                    ? 'El registro se borrar- sin revertir stock. Usa "Anular" si quieres revertir primero.'
                    : 'El registro ANULADO se borrar- permanentemente de la base de datos.'}
                </span>
              </p>
              <div className="flex gap-2">
                <button onClick={handlePurge} disabled={busy}
                  className="flex-1 bg-red-600 border border-red-600 text-white py-2.5 font-mono text-[10px] font-bold tracking-widest uppercase hover:bg-red-700 disabled:opacity-50 transition-all">
                  {busy ? 'ELIMINANDO...' : 'S-, ELIMINAR'}
                </button>
                <button onClick={() => setPurgeTx(null)}
                  className="flex-1 border border-[var(--border)] py-2.5 font-mono text-[10px] font-bold tracking-widest uppercase hover:bg-[var(--ink)] hover:text-[var(--ink-inv)] transition-all">
                  CANCELAR
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk cancel */}
      {showBulkCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-[var(--bg)] border-4 border-orange-500 shadow-[8px_8px_0_var(--border)] w-full max-w-sm">
            <div className="border-b border-orange-500 bg-orange-500 px-4 py-3 flex items-center gap-2">
              <ShieldOff size={15} className="text-white" />
              <span className="font-mono text-[10px] font-bold tracking-widest uppercase text-white">ANULAR {selected.size} OPERACIONES</span>
            </div>
            <div className="p-5 flex flex-col gap-4">
              <p className="font-mono text-xs font-bold uppercase text-center leading-relaxed">
                -Anular <span className="text-orange-600">{selected.size}</span> operaciones?<br />
                <span className="text-[9px] opacity-50 normal-case font-normal block mt-1">El stock de cada una ser- revertido. Los registros permanecen como ANULADOS.</span>
              </p>
              <div className="flex gap-2">
                <button onClick={handleBulkCancel} disabled={busy}
                  className="flex-1 bg-orange-500 border border-orange-500 text-white py-2.5 font-mono text-[10px] font-bold tracking-widest uppercase hover:bg-orange-600 disabled:opacity-50 transition-all">
                  {busy ? 'ANULANDO...' : 'CONFIRMAR'}
                </button>
                <button onClick={() => setShowBulkCancel(false)}
                  className="flex-1 border border-[var(--border)] py-2.5 font-mono text-[10px] font-bold tracking-widest uppercase hover:bg-[var(--ink)] hover:text-[var(--ink-inv)] transition-all">
                  CANCELAR
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk hard-delete */}
      {showBulkPurge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-[var(--bg)] border-4 border-red-600 shadow-[8px_8px_0_var(--border)] w-full max-w-sm">
            <div className="border-b border-red-600 bg-red-600 px-4 py-3 flex items-center gap-2">
              <Trash2 size={15} className="text-white" />
              <span className="font-mono text-[10px] font-bold tracking-widest uppercase text-white">ELIMINAR {selected.size} REGISTROS</span>
            </div>
            <div className="p-5 flex flex-col gap-4">
              <p className="font-mono text-xs font-bold uppercase text-center leading-relaxed">
                -Eliminar <span className="text-red-600">{selected.size}</span> registros de la base de datos?<br />
                <span className="text-[9px] opacity-50 normal-case font-normal block mt-1">Esta accion es irreversible. El stock NO ser- revertido.</span>
              </p>
              <div className="flex gap-2">
                <button onClick={handleBulkPurge} disabled={busy}
                  className="flex-1 bg-red-600 border border-red-600 text-white py-2.5 font-mono text-[10px] font-bold tracking-widest uppercase hover:bg-red-700 disabled:opacity-50 transition-all">
                  {busy ? 'ELIMINANDO...' : 'S-, ELIMINAR'}
                </button>
                <button onClick={() => setShowBulkPurge(false)}
                  className="flex-1 border border-[var(--border)] py-2.5 font-mono text-[10px] font-bold tracking-widest uppercase hover:bg-[var(--ink)] hover:text-[var(--ink-inv)] transition-all">
                  CANCELAR
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Purge all */}
      {showPurgeAll && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-[var(--bg)] border-4 border-red-600 shadow-[8px_8px_0_var(--border)] w-full max-w-sm">
            <div className="border-b border-red-600 bg-red-600 px-4 py-3 flex items-center gap-2">
              <AlertTriangle size={15} className="text-white" />
              <span className="font-mono text-[10px] font-bold tracking-widest uppercase text-white">BORRAR TODAS LAS OPERACIONES</span>
            </div>
            <div className="p-5 flex flex-col gap-4">
              <p className="font-mono text-xs font-bold uppercase text-center leading-relaxed">
                -Confirmas eliminar <span className="text-red-600">TODOS</span> los registros?<br />
                <span className="text-[10px] text-red-500 font-black block mt-1">ATENCION: El stock se reiniciar- a cero.</span>
                <span className="text-[9px] opacity-50 normal-case font-normal block mt-1">Esta accion es irreversible.</span>
              </p>
              <div className="flex gap-2">
                <button onClick={handlePurgeAll} disabled={busy}
                  className="flex-1 bg-red-600 border border-red-600 text-white py-2.5 font-mono text-[10px] font-bold tracking-widest uppercase hover:bg-red-700 disabled:opacity-50 transition-all">
                  {busy ? 'BORRANDO...' : 'S-, BORRAR TODO'}
                </button>
                <button onClick={() => setShowPurgeAll(false)}
                  className="flex-1 border border-[var(--border)] py-2.5 font-mono text-[10px] font-bold tracking-widest uppercase hover:bg-[var(--ink)] hover:text-[var(--ink-inv)] transition-all">
                  CANCELAR
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// --- Operations Report ---------------------------------------------------------

const OperationsReport: React.FC = () => {
  const { transactions, products, locations, activeBrand } = useAppContext();
  const [reportTab, setReportTab] = useState<'resumen' | 'movimientos' | 'bajas' | 'historial'>('resumen');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [searchQ, setSearchQ] = useState('');
  const [sortCol, setSortCol] = useState<'date' | 'qty' | 'type'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [histPage, setHistPage] = useState(1);
  const HIST_PAGE_SIZE = 15;

  const active = useMemo(() => transactions.filter(tx => tx.status !== 'CANCELLED'), [transactions]);

  const filtered = useMemo(() => active.filter(tx => {
    if (dateFrom && new Date(tx.date) < new Date(dateFrom + 'T00:00:00')) return false;
    if (dateTo   && new Date(tx.date) > new Date(dateTo   + 'T23:59:59')) return false;
    return true;
  }), [active, dateFrom, dateTo]);

  const writeoffs = useMemo(() => filtered.filter(tx => tx.reference?.startsWith('[BAJA]')), [filtered]);
  const regular   = useMemo(() => filtered.filter(tx => !tx.reference?.startsWith('[BAJA]')), [filtered]);

  const byType = useMemo(() => {
    const map: Record<string, { count: number; units: number }> = {
      RECEPTION: { count: 0, units: 0 },
      DISPATCH:  { count: 0, units: 0 },
      TRANSFER:  { count: 0, units: 0 },
    };
    regular.forEach(tx => { if (map[tx.type]) { map[tx.type].count++; map[tx.type].units += tx.quantity; } });
    return map;
  }, [regular]);

  const byDestination = useMemo(() => {
    const map = new Map<string, { name: string; count: number; units: number }>();
    regular.forEach(tx => {
      if (!tx.toLocationId) return;
      const name = locations.find(l => l.id === tx.toLocationId)?.name ?? tx.toLocationId;
      if (!map.has(tx.toLocationId)) map.set(tx.toLocationId, { name, count: 0, units: 0 });
      const e = map.get(tx.toLocationId)!; e.count++; e.units += tx.quantity;
    });
    return [...map.values()].sort((a, b) => b.units - a.units);
  }, [regular, locations]);

  const byProduct = useMemo(() => {
    const map = new Map<string, { name: string; code: string; in: number; out: number; transfer: number; writeoff: number }>();
    filtered.forEach(tx => {
      const prod = products.find(p => p.id === tx.productId);
      const name = prod?.name ?? tx.productId;
      const code = prod?.code ?? '';
      if (!map.has(name)) map.set(name, { name, code, in: 0, out: 0, transfer: 0, writeoff: 0 });
      const e = map.get(name)!;
      const isWriteoff = tx.reference?.startsWith('[BAJA]');
      if (tx.type === 'RECEPTION') e.in += tx.quantity;
      else if (tx.type === 'DISPATCH') { if (isWriteoff) e.writeoff += tx.quantity; else e.out += tx.quantity; }
      else e.transfer += tx.quantity;
    });
    return [...map.values()].sort((a, b) => (b.in + b.out + b.transfer + b.writeoff) - (a.in + a.out + a.transfer + a.writeoff)).slice(0, 25);
  }, [filtered, products]);

  const byWriteoffReason = useMemo(() => {
    const map = new Map<string, { count: number; units: number }>();
    writeoffs.forEach(tx => {
      const reason = tx.reference?.replace('[BAJA] ', '').split(' · ')[0] ?? 'Sin motivo';
      if (!map.has(reason)) map.set(reason, { count: 0, units: 0 });
      const e = map.get(reason)!; e.count++; e.units += tx.quantity;
    });
    return [...map.entries()].map(([reason, v]) => ({ reason, ...v })).sort((a, b) => b.units - a.units);
  }, [writeoffs]);

  const totalUnits  = regular.reduce((s, tx) => s + tx.quantity, 0);
  const totalOps    = regular.length;
  const writeoffUnits = writeoffs.reduce((s, tx) => s + tx.quantity, 0);

  // History with search + sort + pagination
  const histFiltered = useMemo(() => {
    let rows = [...filtered];
    if (searchQ.trim()) {
      const q = searchQ.trim().toLowerCase();
      rows = rows.filter(tx => {
        const prod = products.find(p => p.id === tx.productId);
        return (
          (prod?.name ?? '').toLowerCase().includes(q) ||
          (prod?.code ?? '').toLowerCase().includes(q) ||
          (tx.reference ?? '').toLowerCase().includes(q) ||
          (tx.user ?? '').toLowerCase().includes(q)
        );
      });
    }
    rows.sort((a, b) => {
      let va: number | string, vb: number | string;
      if (sortCol === 'date') { va = a.date; vb = b.date; }
      else if (sortCol === 'qty') { va = a.quantity; vb = b.quantity; }
      else { va = a.type; vb = b.type; }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return rows;
  }, [filtered, searchQ, sortCol, sortDir, products]);

  const histPages = Math.max(1, Math.ceil(histFiltered.length / HIST_PAGE_SIZE));
  const histRows  = histFiltered.slice((histPage - 1) * HIST_PAGE_SIZE, histPage * HIST_PAGE_SIZE);

  const toggleSort = (col: typeof sortCol) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('desc'); }
  };

  // -- Exports --
  const exportExcel = () => {
    const rows = histFiltered.map(tx => {
      const prod = products.find(p => p.id === tx.productId);
      const isWO = tx.reference?.startsWith('[BAJA]');
      return {
        Fecha: new Date(tx.date).toLocaleString('es-PE'),
        Tipo: isWO ? 'BAJA/MERMA' : tx.type === 'RECEPTION' ? 'RECEPCIÓN' : tx.type === 'DISPATCH' ? 'DESPACHO' : 'TRASLADO',
        Código: prod?.code ?? '',
        Producto: prod?.name ?? tx.productId,
        Color: prod?.color ?? '',
        Talla: prod?.size ?? '',
        Cantidad: tx.quantity,
        Origen: locations.find(l => l.id === tx.fromLocationId)?.name ?? '',
        Destino: locations.find(l => l.id === tx.toLocationId)?.name ?? '',
        Referencia: tx.reference ?? '',
        Operador: tx.user ?? '',
      };
    });
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 18 }, { wch: 12 }, { wch: 10 }, { wch: 30 }, { wch: 12 }, { wch: 8 }, { wch: 9 }, { wch: 18 }, { wch: 18 }, { wch: 30 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Operaciones');
    XLSX.writeFile(wb, `operaciones_${activeBrand}_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  const exportPDF = async () => {
    const win = window.open('', '_blank');
    if (!win) return;
    const logoB64 = await fetch('/Zazu/inv/zazu-inv-light.png')
      .then(r => r.blob())
      .then(b => new Promise<string>(res => { const fr = new FileReader(); fr.onload = () => res(fr.result as string); fr.readAsDataURL(b); }))
      .catch(() => '');
    const dateLabel = dateFrom || dateTo
      ? `Del ${dateFrom || '-'} al ${dateTo || '-'}`
      : 'Todos los per-odos';
    const rowsHTML = histFiltered.map((tx, i) => {
      const prod = products.find(p => p.id === tx.productId);
      const isWO = tx.reference?.startsWith('[BAJA]');
      const typeLabel = isWO ? 'BAJA' : tx.type === 'RECEPTION' ? 'RECEPCION' : tx.type === 'DISPATCH' ? 'DESPACHO' : 'TRASLADO';
      const typeColor = isWO ? '#991b1b' : tx.type === 'RECEPTION' ? '#15803d' : tx.type === 'DISPATCH' ? '#b91c1c' : '#0369a1';
      return `<tr style="background:${i%2===0?'#f9f9f9':'#fff'}">
        <td>${new Date(tx.date).toLocaleString('es-PE', { dateStyle:'short', timeStyle:'short' })}</td>
        <td><span style="color:${typeColor};font-weight:700">${typeLabel}</span></td>
        <td>${prod?.code ?? ''}</td>
        <td>${prod?.name ?? tx.productId}${prod?.size ? ' ' + prod.size : ''}</td>
        <td style="text-align:right;font-weight:700">${tx.quantity}</td>
        <td>${locations.find(l=>l.id===tx.fromLocationId)?.name ?? '-'}</td>
        <td>${locations.find(l=>l.id===tx.toLocationId)?.name ?? '-'}</td>
        <td>${tx.reference ?? ''}</td>
        <td>${tx.user ?? ''}</td>
      </tr>`;
    }).join('');
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>Reporte Operaciones · ${activeBrand}</title>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap');
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:Inter,sans-serif;font-size:10px;color:#141414;padding:24px 32px;background:#fff}
      .header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #141414;padding-bottom:12px;margin-bottom:16px}
      .logo{width:48px;height:48px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
      .company{margin-left:12px}
      .company h1{font-size:13px;font-weight:900;text-transform:uppercase}
      .company p{font-size:9px;opacity:.5;margin-top:2px}
      .meta{text-align:right;font-size:9px;opacity:.6}
      .kpi-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:16px}
      .kpi{border:1px solid #e5e5e5;padding:10px 12px;background:#fafafa}
      .kpi-label{font-size:8px;text-transform:uppercase;letter-spacing:.1em;opacity:.5;margin-bottom:4px}
      .kpi-val{font-size:18px;font-weight:900}
      .kpi-sub{font-size:8px;opacity:.4;margin-top:2px}
      .kpi.green{border-color:#bbf7d0;background:#f0fdf4}.kpi.green .kpi-val{color:#15803d}
      .kpi.red{border-color:#fecaca;background:#fef2f2}.kpi.red .kpi-val{color:#b91c1c}
      .kpi.dark{border-color:#141414;background:#141414}.kpi.dark .kpi-label,.kpi.dark .kpi-sub{color:#fff;opacity:.6}.kpi.dark .kpi-val{color:#fff}
      .section-title{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.15em;opacity:.4;margin:12px 0 6px}
      table{width:100%;border-collapse:collapse;font-size:9px}
      thead th{background:#141414;color:#fff;padding:5px 8px;text-align:left;font-size:8px;text-transform:uppercase;letter-spacing:.1em}
      tbody td{padding:4px 8px;border-bottom:1px solid #f0f0f0}
      tfoot td{background:#f5f4f1;font-weight:700;padding:5px 8px;border-top:2px solid #141414}
      @media print{body{padding:12px 16px}@page{size:A4 landscape;margin:1cm}}
    </style></head><body>
    <div class="header">
      <div style="display:flex;align-items:center">
        ${logoB64 ? `<div class="logo"><img src="${logoB64}" style="width:48px;height:48px;object-fit:contain" /></div>` : `<div class="logo" style="background:#6B21A8;color:#fff;font-weight:900;font-size:11px;letter-spacing:1px;flex-direction:column">zazu<span style="font-size:6px;letter-spacing:2px;opacity:.8">express</span></div>`}
        <div class="company">
          <h1>Reporte de Operaciones</h1>
          <p>Tecnología y Distribución Logística del Perú S.A.C. · RUC 20614699842</p>
          <p>Marca: ${activeBrand} · Período: ${dateLabel}</p>
        </div>
      </div>
      <div class="meta">Generado: ${new Date().toLocaleString('es-PE', { dateStyle:'short', timeStyle:'short' })}</div>
    </div>
    <div class="kpi-grid">
      <div class="kpi dark"><div class="kpi-label">Total Ops</div><div class="kpi-val">${totalOps}</div><div class="kpi-sub">operaciones</div></div>
      <div class="kpi dark"><div class="kpi-label">Unidades Mov.</div><div class="kpi-val">${totalUnits.toLocaleString('es-PE')}</div><div class="kpi-sub">unidades</div></div>
      <div class="kpi green"><div class="kpi-label">Recepciones</div><div class="kpi-val">${byType.RECEPTION.units.toLocaleString('es-PE')}</div><div class="kpi-sub">${byType.RECEPTION.count} ops</div></div>
      <div class="kpi red"><div class="kpi-label">Despachos</div><div class="kpi-val">${byType.DISPATCH.units.toLocaleString('es-PE')}</div><div class="kpi-sub">${byType.DISPATCH.count} ops</div></div>
      <div class="kpi red"><div class="kpi-label">Bajas / Merma</div><div class="kpi-val">${writeoffUnits.toLocaleString('es-PE')}</div><div class="kpi-sub">${writeoffs.length} ops</div></div>
    </div>
    <div class="section-title">Historial de operaciones (${histFiltered.length} registros)</div>
    <table><thead><tr>
      <th>Fecha</th><th>Tipo</th><th>Codigo</th><th>Producto</th><th style="text-align:right">Cant.</th>
      <th>Origen</th><th>Destino</th><th>Referencia</th><th>Operador</th>
    </tr></thead><tbody>${rowsHTML}</tbody>
    <tfoot><tr><td colspan="4">TOTAL</td><td style="text-align:right">${histFiltered.reduce((s,tx)=>s+tx.quantity,0).toLocaleString('es-PE')}</td><td colspan="4"></td></tr></tfoot>
    </table>
    <script>window.onload=()=>window.print()</script></body></html>`);
    win.document.close();
  };

  const TYPE_CFG = {
    RECEPTION: { label: 'Recepciones', icon: ArrowDownLeft, color: 'text-green-700', bg: 'bg-green-500/10 border-green-500/50', bar: 'bg-green-500' },
    DISPATCH:  { label: 'Despachos',   icon: ArrowUpRight,  color: 'text-red-700',   bg: 'bg-red-500/10 border-red-500/50',     bar: 'bg-red-500'   },
    TRANSFER:  { label: 'Traslados',   icon: ArrowRightLeft,color: 'text-blue-700',  bg: 'bg-blue-500/10 border-blue-500/50',   bar: 'bg-blue-400'  },
  };

  const SortIcon = ({ col }: { col: typeof sortCol }) => sortCol !== col ? null : sortDir === 'asc' ? <ChevronUp size={9} /> : <ChevronDown size={9} />;

  return (
    <div className="flex flex-col gap-5">

      {/* -- Header -- */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <BarChart2 size={14} className="opacity-50" />
          <h2 className="font-mono text-[10px] font-bold tracking-widest uppercase opacity-70">REPORTE DE OPERACIONES</h2>
          <span className="font-mono text-[8px] border border-[var(--border)]/20 px-1.5 py-0.5 bg-[var(--surface)] uppercase tracking-wider">{activeBrand}</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-[8px] uppercase tracking-widest opacity-40 hidden sm:inline">Período:</span>
          <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setHistPage(1); }}
            className="border border-[var(--border)]/30 px-2 py-1.5 font-mono text-[9px] bg-[var(--surface)] outline-none focus:border-[var(--border)] w-full sm:w-auto" />
          <span className="font-mono text-[9px] opacity-30">?</span>
          <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setHistPage(1); }}
            className="border border-[var(--border)]/30 px-2 py-1.5 font-mono text-[9px] bg-[var(--surface)] outline-none focus:border-[var(--border)] w-full sm:w-auto" />
          {(dateFrom || dateTo) && (
            <button onClick={() => { setDateFrom(''); setDateTo(''); }}
              className="font-mono text-[8px] border border-[var(--border)]/30 px-2 py-1.5 hover:bg-[var(--ink)] hover:text-[var(--ink-inv)] transition-colors whitespace-nowrap">
              ? LIMPIAR
            </button>
          )}
        </div>
      </div>

      {/* -- KPI Cards -- */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
        {/* Total ops */}
        <div className="border border-[var(--border)] bg-[var(--ink)] text-[var(--ink-inv)] p-3 shadow-[3px_3px_0_var(--border)] col-span-2 sm:col-span-1">
          <div className="font-mono text-[8px] opacity-50 uppercase tracking-widest mb-1">Total Ops</div>
          <div className="font-mono font-black text-2xl">{totalOps}</div>
          <div className="font-mono text-[8px] opacity-40 mt-0.5">operaciones</div>
        </div>
        {/* Unidades */}
        <div className="border border-[var(--border)] bg-[var(--bg-card-alt)] p-3 shadow-[3px_3px_0_var(--border)]">
          <div className="font-mono text-[8px] opacity-40 uppercase tracking-widest mb-1">Unidades</div>
          <div className="font-mono font-black text-2xl text-[var(--ink)]">{totalUnits.toLocaleString('es-PE')}</div>
          <div className="font-mono text-[8px] opacity-40 mt-0.5">movidas</div>
        </div>
        {/* Recepciones */}
        <div className="border border-green-400 bg-green-500/10 p-3">
          <div className="flex items-center gap-1 mb-1"><ArrowDownLeft size={10} className="text-green-700" /><span className="font-mono text-[8px] font-bold text-green-700 uppercase tracking-wide">Recepciones</span></div>
          <div className="font-mono font-black text-xl text-green-600">{byType.RECEPTION.units.toLocaleString('es-PE')}</div>
          <div className="font-mono text-[8px] text-green-700 opacity-60 mt-0.5">{byType.RECEPTION.count} operaciones</div>
        </div>
        {/* Despachos */}
        <div className="border border-red-500/50 bg-red-500/10 p-3">
          <div className="flex items-center gap-1 mb-1"><ArrowUpRight size={10} className="text-red-700" /><span className="font-mono text-[8px] font-bold text-red-700 uppercase tracking-wide">Despachos</span></div>
          <div className="font-mono font-black text-xl text-red-600">{byType.DISPATCH.units.toLocaleString('es-PE')}</div>
          <div className="font-mono text-[8px] text-red-700 opacity-60 mt-0.5">{byType.DISPATCH.count} operaciones</div>
        </div>
        {/* Bajas */}
        <div className="border border-orange-400 bg-orange-500/10 p-3">
          <div className="flex items-center gap-1 mb-1"><ShieldOff size={10} className="text-orange-700" /><span className="font-mono text-[8px] font-bold text-orange-700 uppercase tracking-wide">Bajas/Merma</span></div>
          <div className="font-mono font-black text-xl text-orange-600">{writeoffUnits.toLocaleString('es-PE')}</div>
          <div className="font-mono text-[8px] text-orange-700 opacity-60 mt-0.5">{writeoffs.length} operaciones</div>
        </div>
      </div>

      {/* -- Distribution bar -- */}
      {totalUnits > 0 && (
        <div className="border border-[var(--border)]/20 bg-[var(--bg-card)] px-4 py-3">
          <div className="font-mono text-[8px] opacity-40 uppercase tracking-widest mb-2">Distribución por tipo (unidades)</div>
          <div className="flex h-4 overflow-hidden border border-[var(--border)]/10">
            {(['RECEPTION', 'DISPATCH', 'TRANSFER'] as const).map(t => {
              const pct = (byType[t].units / totalUnits) * 100;
              return pct > 0 ? (
                <div key={t} className={`${TYPE_CFG[t].bar} h-full transition-all`} style={{ width: `${pct}%` }}
                  title={`${TYPE_CFG[t].label}: ${byType[t].units} uds (${pct.toFixed(1)}%)`} />
              ) : null;
            })}
            {writeoffUnits > 0 && (
              <div className="bg-orange-500 h-full" style={{ width: `${(writeoffUnits / (totalUnits + writeoffUnits)) * 100}%` }}
                title={`Bajas: ${writeoffUnits} uds`} />
            )}
          </div>
          <div className="flex gap-4 mt-1.5 flex-wrap">
            {(['RECEPTION', 'DISPATCH', 'TRANSFER'] as const).map(t => {
              const pct = totalUnits > 0 ? ((byType[t].units / totalUnits) * 100).toFixed(1) : '0.0';
              const dotColors = { RECEPTION: 'bg-green-500', DISPATCH: 'bg-red-500', TRANSFER: 'bg-blue-400' };
              return (
                <div key={t} className="flex items-center gap-1">
                  <span className={`w-2 h-2 shrink-0 ${dotColors[t]}`} />
                  <span className="font-mono text-[8px] opacity-60 uppercase">{TYPE_CFG[t].label}</span>
                  <span className="font-mono text-[8px] font-bold">{pct}%</span>
                </div>
              );
            })}
            {writeoffUnits > 0 && (
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 bg-orange-500 shrink-0" />
                <span className="font-mono text-[8px] opacity-60 uppercase">Bajas</span>
                <span className="font-mono text-[8px] font-bold">{((writeoffUnits / (totalUnits + writeoffUnits)) * 100).toFixed(1)}%</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* -- Tab bar + export buttons -- */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between border-b border-[var(--border)]/20">
        <div className="flex overflow-x-auto scrollbar-none">
          {([
            { id: 'resumen',     label: 'Resumen' },
            { id: 'movimientos', label: 'Productos' },
            { id: 'bajas',       label: `Bajas${writeoffs.length > 0 ? ` (${writeoffs.length})` : ''}` },
            { id: 'historial',   label: 'Historial' },
          ] as { id: typeof reportTab; label: string }[]).map(tab => (
            <button key={tab.id} onClick={() => setReportTab(tab.id)}
              className={cn('px-3 py-2 font-mono text-[9px] font-bold uppercase tracking-widest border-b-2 transition-colors whitespace-nowrap',
                reportTab === tab.id ? 'border-[var(--border)] text-[var(--ink)]' : 'border-transparent opacity-40 hover:opacity-70'
              )}>
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 pb-1 self-end sm:self-auto">
          <button onClick={exportExcel} title="Exportar Excel"
            className="flex items-center gap-1 border border-[var(--border)]/30 px-2.5 py-1.5 hover:bg-green-700 hover:text-white hover:border-green-700 transition-all font-mono text-[8px] font-bold uppercase">
            <FileSpreadsheet size={11} /> XLS
          </button>
          <button onClick={exportPDF} title="Exportar PDF"
            className="flex items-center gap-1 border border-[var(--border)]/30 px-2.5 py-1.5 hover:bg-[var(--ink)] hover:text-[var(--ink-inv)] transition-all font-mono text-[8px] font-bold uppercase">
            <FileText size={11} /> PDF
          </button>
        </div>
      </div>

      {/* -- RESUMEN -- */}
      {reportTab === 'resumen' && (
        <div className="flex flex-col gap-4">
          {/* Por tipo */}
          <div className="border border-[var(--border)] shadow-[3px_3px_0_var(--border)] overflow-hidden">
            <div className="bg-[var(--ink)] text-[var(--ink-inv)] px-4 py-2 font-mono text-[8px] font-bold uppercase tracking-widest">Operaciones por tipo</div>
            <div className="grid grid-cols-4 px-4 py-1.5 font-mono text-[8px] opacity-40 uppercase tracking-widest border-b border-[var(--border)]/10">
              <div>Tipo</div><div className="text-right">Ops.</div><div className="text-right">Unidades</div><div className="text-right">% Total</div>
            </div>
            {(['RECEPTION', 'DISPATCH', 'TRANSFER'] as const).map(t => {
              const cfg = TYPE_CFG[t]; const Icon = cfg.icon;
              const pct = totalUnits > 0 ? ((byType[t].units / totalUnits) * 100).toFixed(1) : '0.0';
              return (
                <div key={t} className="grid grid-cols-4 px-4 py-3 border-b border-[var(--border)]/10 last:border-0 hover:bg-[var(--surface)] items-center">
                  <div className="flex items-center gap-2"><Icon size={12} className={cfg.color} /><span className={`font-mono text-[10px] font-bold uppercase ${cfg.color}`}>{cfg.label}</span></div>
                  <div className="font-mono text-[11px] font-bold text-right">{byType[t].count}</div>
                  <div className="font-mono text-[12px] font-black text-right">{byType[t].units.toLocaleString('es-PE')}</div>
                  <div className="text-right"><span className={`font-mono text-[10px] font-bold px-1.5 py-0.5 border ${cfg.bg} ${cfg.color}`}>{pct}%</span></div>
                </div>
              );
            })}
            {writeoffs.length > 0 && (
              <div className="grid grid-cols-4 px-4 py-3 border-b border-[var(--border)]/10 hover:bg-[var(--surface)] items-center">
                <div className="flex items-center gap-2"><ShieldOff size={12} className="text-orange-700" /><span className="font-mono text-[10px] font-bold uppercase text-orange-700">Bajas/Merma</span></div>
                <div className="font-mono text-[11px] font-bold text-right">{writeoffs.length}</div>
                <div className="font-mono text-[12px] font-black text-right">{writeoffUnits.toLocaleString('es-PE')}</div>
                <div className="text-right"><span className="font-mono text-[10px] font-bold px-1.5 py-0.5 border bg-orange-500/10 border-orange-400 text-orange-700">{totalUnits > 0 ? ((writeoffUnits / (totalUnits + writeoffUnits)) * 100).toFixed(1) : '0.0'}%</span></div>
              </div>
            )}
            <div className="grid grid-cols-4 px-4 py-2.5 bg-[var(--bg-modal)] border-t border-[var(--border)]/20 font-mono text-[10px] font-black uppercase">
              <div className="opacity-40 text-[8px]">TOTAL</div>
              <div className="text-right">{totalOps}</div>
              <div className="text-right">{(totalUnits + writeoffUnits).toLocaleString('es-PE')}</div>
              <div className="text-right opacity-40">100%</div>
            </div>
          </div>

          {/* Por destino */}
          {byDestination.length > 0 && (
            <div className="border border-[var(--border)] shadow-[3px_3px_0_var(--border)] overflow-hidden">
              <div className="bg-[var(--ink)] text-[var(--ink-inv)] px-4 py-2 font-mono text-[8px] font-bold uppercase tracking-widest">Entradas por almacen destino</div>
              {byDestination.map((row, i) => {
                const barPct = byDestination[0].units > 0 ? (row.units / byDestination[0].units) * 100 : 0;
                return (
                  <div key={i} className="px-4 py-3 border-b border-[var(--border)]/10 last:border-0 hover:bg-[var(--surface)]">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <MapPin size={10} className="opacity-40 shrink-0" />
                        <span className="font-mono text-[10px] font-bold truncate uppercase">{row.name}</span>
                        <span className="font-mono text-[8px] opacity-40">{row.count} ops</span>
                      </div>
                      <span className="font-mono text-[12px] font-black text-green-700 shrink-0 ml-4">{row.units.toLocaleString('es-PE')} uds</span>
                    </div>
                    <div className="h-1.5 bg-[var(--ink)]/5 overflow-hidden">
                      <div className="h-full bg-green-500/60 transition-all" style={{ width: `${barPct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* -- POR PRODUCTO -- */}
      {reportTab === 'movimientos' && (
        <div className="border border-[var(--border)] shadow-[3px_3px_0_var(--border)] overflow-hidden">
          {/* Header · hidden on mobile, shown on sm+ */}
          <div className="hidden sm:grid sm:grid-cols-[1fr_56px_56px_56px_56px] bg-[var(--ink)] text-[var(--ink-inv)] px-4 py-2 font-mono text-[8px] font-bold uppercase tracking-widest gap-2">
            <div>Producto</div>
            <div className="text-right text-green-300">Entr.</div>
            <div className="text-right text-red-300">Sal.</div>
            <div className="text-right text-blue-300">Trasl.</div>
            <div className="text-right text-orange-300">Baja</div>
          </div>
          <div className="sm:hidden bg-[var(--ink)] text-[var(--ink-inv)] px-4 py-2 font-mono text-[8px] font-bold uppercase tracking-widest">
            Movimientos por producto
          </div>
          {byProduct.length === 0 ? (
            <div className="px-4 py-10 text-center font-mono text-[10px] opacity-40 uppercase">Sin operaciones en el per-odo</div>
          ) : byProduct.map((row, i) => {
            const total = row.in + row.out + row.transfer + row.writeoff;
            const maxTotal = byProduct[0] ? byProduct[0].in + byProduct[0].out + byProduct[0].transfer + byProduct[0].writeoff : 1;
            const barPct = maxTotal > 0 ? (total / maxTotal) * 100 : 0;
            return (
              <div key={i} className={cn('px-4 py-2.5 border-b border-[var(--border)]/10 last:border-0 hover:bg-[var(--surface)]', i % 2 !== 0 && 'bg-[var(--surface-alt)]')}>
                {/* Desktop row */}
                <div className="hidden sm:grid sm:grid-cols-[1fr_56px_56px_56px_56px] items-center gap-2 mb-1">
                  <div className="min-w-0">
                    <div className="font-mono text-[10px] font-bold truncate uppercase">{row.name}</div>
                    {row.code && <div className="font-mono text-[8px] opacity-40">{row.code}</div>}
                  </div>
                  <div className="font-mono text-[10px] font-bold text-right text-green-700">{row.in > 0 ? row.in.toLocaleString('es-PE') : <span className="opacity-20">-</span>}</div>
                  <div className="font-mono text-[10px] font-bold text-right text-red-600">{row.out > 0 ? row.out.toLocaleString('es-PE') : <span className="opacity-20">-</span>}</div>
                  <div className="font-mono text-[10px] font-bold text-right text-blue-600">{row.transfer > 0 ? row.transfer.toLocaleString('es-PE') : <span className="opacity-20">-</span>}</div>
                  <div className="font-mono text-[10px] font-bold text-right text-orange-600">{row.writeoff > 0 ? row.writeoff.toLocaleString('es-PE') : <span className="opacity-20">-</span>}</div>
                </div>
                {/* Mobile card row */}
                <div className="sm:hidden">
                  <div className="font-mono text-[10px] font-bold truncate uppercase mb-1">{row.name}</div>
                  <div className="grid grid-cols-4 gap-1 mb-1">
                    {[
                      { label: 'Entr', val: row.in, cls: 'text-green-700' },
                      { label: 'Sal',  val: row.out, cls: 'text-red-600' },
                      { label: 'Tras', val: row.transfer, cls: 'text-blue-600' },
                      { label: 'Baja', val: row.writeoff, cls: 'text-orange-600' },
                    ].map(({ label, val, cls }) => (
                      <div key={label} className="flex flex-col items-center border border-[var(--border)]/10 py-1 px-0.5 bg-[var(--surface)]">
                        <span className="font-mono text-[7px] opacity-40 uppercase">{label}</span>
                        <span className={cn('font-mono text-[11px] font-black', val > 0 ? cls : 'opacity-20')}>{val > 0 ? val : '-'}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="h-1 bg-[var(--ink)]/5 overflow-hidden">
                  <div className="h-full bg-[var(--ink)]/20 transition-all" style={{ width: `${barPct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* -- BAJAS / MERMA -- */}
      {reportTab === 'bajas' && (
        <div className="flex flex-col gap-4">
          {writeoffs.length === 0 ? (
            <div className="border border-[var(--border)]/20 px-4 py-12 text-center font-mono text-[10px] opacity-40 uppercase">
              No hay bajas registradas en este per-odo
            </div>
          ) : (
            <>
              {/* Por motivo */}
              <div className="border border-orange-400/50 shadow-[3px_3px_0_#c2410c30] overflow-hidden">
                <div className="bg-orange-800 text-white px-4 py-2 font-mono text-[8px] font-bold uppercase tracking-widest">Bajas por motivo</div>
                {byWriteoffReason.map((row, i) => {
                  const barPct = byWriteoffReason[0].units > 0 ? (row.units / byWriteoffReason[0].units) * 100 : 0;
                  return (
                    <div key={i} className="px-4 py-3 border-b border-orange-800/10 last:border-0 hover:bg-orange-500/10">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <ShieldOff size={10} className="text-orange-600 shrink-0 opacity-60" />
                          <span className="font-mono text-[10px] font-bold truncate">{row.reason}</span>
                          <span className="font-mono text-[8px] opacity-40 shrink-0">{row.count} ops</span>
                        </div>
                        <span className="font-mono text-[12px] font-black text-orange-700 shrink-0 ml-4">{row.units.toLocaleString('es-PE')} uds</span>
                      </div>
                      <div className="h-1.5 bg-orange-800/5 overflow-hidden">
                        <div className="h-full bg-orange-500/50 transition-all" style={{ width: `${barPct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Detalle de bajas */}
              <div className="border border-[var(--border)]/20 shadow-[2px_2px_0_var(--border-soft)] overflow-hidden">
                <div className="bg-[var(--ink)] text-[var(--ink-inv)] px-4 py-2 font-mono text-[8px] font-bold uppercase tracking-widest">Detalle de bajas ({writeoffs.length})</div>
                <div className="grid grid-cols-[auto_1fr_auto_auto] px-4 py-1.5 font-mono text-[8px] opacity-40 uppercase tracking-widest border-b border-[var(--border)]/10 gap-3">
                  <div>Fecha</div><div>Producto / Motivo</div><div className="text-right">Almacen</div><div className="text-right w-12">Cant.</div>
                </div>
                {writeoffs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((tx, i) => {
                  const prod = products.find(p => p.id === tx.productId);
                  const reason = tx.reference?.replace('[BAJA] ', '').split(' · ')[0] ?? '';
                  const notes  = tx.reference?.includes(' · ') ? tx.reference.split(' · ').slice(1).join(' · ') : '';
                  const fromLoc = locations.find(l => l.id === tx.fromLocationId);
                  return (
                    <div key={tx.id} className={cn('grid grid-cols-[auto_1fr_auto_auto] px-4 py-2.5 border-b border-[var(--border)]/8 last:border-0 hover:bg-orange-500/10 items-start gap-3', i % 2 !== 0 && 'bg-[var(--surface-alt)]')}>
                      <div className="font-mono text-[9px] opacity-50 shrink-0 whitespace-nowrap">
                        {new Date(tx.date).toLocaleDateString('es-PE', { day:'2-digit', month:'2-digit', year:'2-digit' })}
                      </div>
                      <div className="min-w-0">
                        <div className="font-mono text-[10px] font-bold truncate uppercase">{prod?.name ?? '-'}{prod?.size ? ` · ${prod.size}` : ''}</div>
                        <div className="font-mono text-[8px] text-orange-700 font-bold">{reason}</div>
                        {notes && <div className="font-mono text-[8px] opacity-40">{notes}</div>}
                        <div className="font-mono text-[8px] opacity-30">{tx.user}</div>
                      </div>
                      <div className="font-mono text-[9px] opacity-50 text-right shrink-0 whitespace-nowrap">{fromLoc?.name ?? '-'}</div>
                      <div className="font-mono text-[12px] font-black text-orange-700 text-right w-12 shrink-0">{tx.quantity}</div>
                    </div>
                  );
                })}
                <div className="flex justify-between px-4 py-2.5 bg-orange-500/10 border-t border-orange-800/20 font-mono text-[10px] font-black">
                  <span className="opacity-50 text-[8px]">TOTAL DADO DE BAJA</span>
                  <span className="text-orange-700">{writeoffUnits.toLocaleString('es-PE')} uds</span>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* -- HISTORIAL -- */}
      {reportTab === 'historial' && (
        <div className="flex flex-col gap-3">
          {/* Search */}
          <div className="flex items-center gap-2 border border-[var(--border)]/20 bg-[var(--surface)] px-3 py-1.5">
            <Search size={11} className="opacity-30 shrink-0" />
            <input
              type="text"
              value={searchQ}
              onChange={e => { setSearchQ(e.target.value); setHistPage(1); }}
              placeholder="Buscar producto, codigo, referencia, operador..."
              className="flex-1 bg-transparent outline-none font-mono text-[10px] placeholder:opacity-30"
            />
            {searchQ && <button onClick={() => setSearchQ('')} className="text-[var(--ink)]/40 hover:text-[var(--ink)]"><X size={11} /></button>}
          </div>

          <div className="border border-[var(--border)] shadow-[3px_3px_0_var(--border)] overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-[60px_56px_1fr_auto] sm:grid-cols-[auto_80px_auto_1fr_auto_auto_auto] bg-[var(--ink)] text-[var(--ink-inv)] px-3 py-2 font-mono text-[8px] font-bold uppercase tracking-widest gap-2 items-center">
              <button onClick={() => toggleSort('date')} className="flex items-center gap-0.5 hover:opacity-70 transition-opacity whitespace-nowrap">
                Fecha <SortIcon col="date" />
              </button>
              <button onClick={() => toggleSort('type')} className="flex items-center gap-0.5 hover:opacity-70 transition-opacity">
                Tipo <SortIcon col="type" />
              </button>
              <div className="hidden sm:block">Codigo</div>
              <div>Producto</div>
              <div className="hidden md:block">Almacen</div>
              <button onClick={() => toggleSort('qty')} className="flex items-center gap-0.5 hover:opacity-70 transition-opacity justify-end">
                <SortIcon col="qty" /> Cant.
              </button>
              <div className="hidden md:block">Operador</div>
            </div>

            {histRows.length === 0 ? (
              <div className="px-4 py-10 text-center font-mono text-[10px] opacity-40 uppercase">Sin resultados</div>
            ) : histRows.map((tx, i) => {
              const prod = products.find(p => p.id === tx.productId);
              const isWO = tx.reference?.startsWith('[BAJA]');
              const typeLabel = isWO ? 'BAJA' : tx.type === 'RECEPTION' ? 'RX' : tx.type === 'DISPATCH' ? 'TX' : 'MV';
              const typeColor = isWO ? 'text-orange-700 bg-orange-500/10 border-orange-400' : tx.type === 'RECEPTION' ? 'text-green-700 bg-green-500/10 border-green-400' : tx.type === 'DISPATCH' ? 'text-red-700 bg-red-500/10 border-red-400' : 'text-blue-700 bg-blue-500/10 border-blue-400';
              const locName = tx.type === 'RECEPTION'
                ? locations.find(l => l.id === tx.toLocationId)?.name
                : locations.find(l => l.id === tx.fromLocationId)?.name;
              return (
                <div key={tx.id} className={cn(
                  'grid grid-cols-[60px_56px_1fr_auto] sm:grid-cols-[auto_80px_auto_1fr_auto_auto_auto] px-3 py-2 border-b border-[var(--border)]/8 last:border-0 hover:bg-[var(--surface)] items-center gap-2',
                  i % 2 !== 0 ? 'bg-[var(--surface-alt)]' : '',
                  isWO && 'bg-orange-500/10'
                )}>
                  <div className="font-mono text-[9px] opacity-50 whitespace-nowrap">
                    {new Date(tx.date).toLocaleDateString('es-PE', { day:'2-digit', month:'2-digit', year:'2-digit' })}
                  </div>
                  <div><span className={cn('font-mono text-[8px] font-bold border px-1 py-0.5 uppercase', typeColor)}>{typeLabel}</span></div>
                  <div className="hidden sm:block font-mono text-[9px] opacity-50">{prod?.code ?? '-'}</div>
                  <div className="min-w-0">
                    <div className="font-mono text-[10px] font-bold truncate uppercase">{prod?.name ?? tx.productId}</div>
                    {(prod?.color || prod?.size) && <div className="font-mono text-[8px] opacity-40">{[prod?.color, prod?.size].filter(Boolean).join(' · ')}</div>}
                    {isWO && tx.reference && <div className="font-mono text-[8px] text-orange-700">{tx.reference.replace('[BAJA] ', '').split(' · ')[0]}</div>}
                  </div>
                  <div className="hidden md:block font-mono text-[9px] opacity-40 text-right whitespace-nowrap">{locName ?? '-'}</div>
                  <div className={cn('font-mono text-[11px] font-black text-right', tx.type === 'RECEPTION' ? 'text-green-700' : isWO ? 'text-orange-700' : 'text-red-700')}>{tx.quantity}</div>
                  <div className="hidden md:block font-mono text-[8px] opacity-30 text-right truncate max-w-[80px]">{tx.user}</div>
                </div>
              );
            })}

            {/* Footer totals */}
            <div className="flex justify-between items-center px-3 py-2 bg-[var(--bg-modal)] border-t border-[var(--border)]/20 font-mono text-[9px]">
              <span className="opacity-40 uppercase tracking-widest text-[8px]">{histFiltered.length} registros · {histFiltered.reduce((s,tx)=>s+tx.quantity,0).toLocaleString('es-PE')} uds</span>
              {histPages > 1 && (
                <div className="flex items-center gap-1">
                  <button onClick={() => setHistPage(p => Math.max(1, p-1))} disabled={histPage === 1}
                    className="border border-[var(--border)]/30 px-2 py-0.5 disabled:opacity-30 hover:bg-[var(--surface)] font-bold">-</button>
                  <span className="px-2 opacity-60">{histPage} / {histPages}</span>
                  <button onClick={() => setHistPage(p => Math.min(histPages, p+1))} disabled={histPage === histPages}
                    className="border border-[var(--border)]/30 px-2 py-0.5 disabled:opacity-30 hover:bg-[var(--surface)] font-bold">-</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// --- Guide Modal ---------------------------------------------------------------

const GuideModal: React.FC<{ guide: OperationGuide; onClose: () => void }> = ({ guide, onClose }) => {
  const printRef = useRef<HTMLDivElement>(null);
  const meta = TYPE_META[guide.type];
  const totalQty = guide.items.reduce((sum, i) => sum + i.quantity, 0);

  const handlePrint = async () => {
    const win = window.open('', '_blank');
    if (!win) return;
    const logoB64 = await fetch('/Zazu/zazu-logo/zazu-light mode.png')
      .then(r => r.blob())
      .then(b => new Promise<string>(res => { const fr = new FileReader(); fr.onload = () => res(fr.result as string); fr.readAsDataURL(b); }))
      .catch(() => '');
    const brandAbbr = BRAND_ABBR[guide.brand] ?? 'LZ';

    const itemsHTML = guide.items.length === 1
      ? `<div class="section">
          <div class="section-title">Producto</div>
          <div class="product-name">${guide.items[0].productName}</div>
          <div class="product-code">${guide.items[0].productCode}${guide.items[0].serialNumber ? ' // S/N: ' + guide.items[0].serialNumber : ''}</div>
          <div class="qty-box">${guide.items[0].quantity} UND</div>
        </div>`
      : `<div class="section">
          <div class="section-title">Productos (${guide.items.length} l-neas)</div>
          <table class="items-table">
            <thead><tr><th>Codigo</th><th>Producto</th><th class="right">Cant.</th></tr></thead>
            <tbody>${guide.items.map(it => `<tr><td class="code">${it.productCode}</td><td class="name">${it.productName}</td><td class="right qty">${it.quantity}</td></tr>`).join('')}</tbody>
            <tfoot><tr><td colspan="2" class="total-label">TOTAL</td><td class="right total-qty">${totalQty}</td></tr></tfoot>
          </table>
        </div>`;

    const photoHTML = guide.photo
      ? `<div class="section">
          <div class="section-title">Evidencia fotografica</div>
          <img class="photo-img" src="${guide.photo}" alt="evidencia"/>
        </div>`
      : '';

    const sigHTML = guide.signature
      ? `<div class="sig-section">
          <div class="section-title">Firma de conformidad</div>
          <img class="sig-img" src="${guide.signature}" alt="firma"/>
        </div>`
      : '';

    const flowHTML = (guide.fromLocation || guide.toLocation)
      ? `<div class="section">
          <div class="section-title">Movimiento</div>
          <div class="flow">
            ${guide.fromLocation ? `<div class="flow-box"><div class="flow-label">Origen</div><div class="flow-name">${guide.fromLocation}</div></div>` : ''}
            ${guide.fromLocation && guide.toLocation ? `<div class="flow-arrow">${meta.icon}</div>` : ''}
            ${guide.toLocation ? `<div class="flow-box"><div class="flow-label">Destino</div><div class="flow-name">${guide.toLocation}</div></div>` : ''}
          </div>
        </div>`
      : '';

    win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Guía ${guide.number}</title>
    <style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:'Courier New',monospace;background:#fff;display:flex;justify-content:center;padding:32px 16px}
      .doc{width:420px;border:2px solid #141414}
      .stripe{height:6px;background:${meta.accentColor}}
      .top{padding:16px 20px 14px;border-bottom:2px solid #141414;display:flex;justify-content:space-between;align-items:center;gap:12px}
      .top-left{display:flex;align-items:center;gap:12px}
      .brand-logo{width:40px;height:40px;flex-shrink:0;display:flex;align-items:center;justify-content:center;}
      .brand{font-size:8px;font-weight:700;letter-spacing:3px;opacity:.4;text-transform:uppercase;margin-bottom:4px}
      .docnum{font-size:18px;font-weight:900;letter-spacing:1px;text-transform:uppercase}
      .badge{padding:6px 14px;color:#fff;font-size:9px;font-weight:900;letter-spacing:2px;text-transform:uppercase;background:${meta.accentColor};display:flex;align-items:center;gap:6px;flex-shrink:0}
      .meta{display:grid;grid-template-columns:1fr 1fr;gap:0;border-bottom:1px solid #e5e5e5}
      .meta-cell{padding:10px 20px;border-right:1px solid #e5e5e5;border-bottom:1px solid #e5e5e5}
      .meta-cell:nth-child(even){border-right:none}
      .meta-label{font-size:7px;font-weight:700;letter-spacing:2px;opacity:.4;text-transform:uppercase;margin-bottom:3px}
      .meta-value{font-size:11px;font-weight:900;text-transform:uppercase}
      .section{padding:14px 20px;border-bottom:1px solid #e5e5e5}
      .section-title{font-size:7px;font-weight:700;letter-spacing:3px;opacity:.35;text-transform:uppercase;margin-bottom:10px}
      .product-name{font-size:13px;font-weight:900;text-transform:uppercase;margin-bottom:2px}
      .product-code{font-size:9px;opacity:.5;font-weight:700;letter-spacing:1px}
      .qty-box{display:inline-block;background:#141414;color:#fff;padding:6px 16px;font-size:20px;font-weight:900;margin-top:8px}
      .items-table{width:100%;border-collapse:collapse;font-size:10px}
      .items-table thead tr{background:#141414;color:#fff}
      .items-table th,.items-table td{padding:5px 8px;text-align:left}
      .items-table .right{text-align:right}
      .items-table .code{opacity:.5;font-size:9px}
      .items-table .name{font-weight:900;text-transform:uppercase}
      .items-table .qty{font-weight:900}
      .items-table tfoot td{background:#f5f5f5;font-weight:700;border-top:2px solid #141414}
      .total-label{opacity:.5;text-transform:uppercase;letter-spacing:.1em}
      .total-qty{font-size:14px;font-weight:900}
      .flow{display:flex;align-items:center}
      .flow-box{flex:1;background:#f5f5f5;border:1px solid #ddd;padding:8px 10px}
      .flow-label{font-size:7px;font-weight:700;letter-spacing:2px;opacity:.4;text-transform:uppercase;margin-bottom:3px}
      .flow-name{font-size:10px;font-weight:900;text-transform:uppercase}
      .flow-arrow{padding:0 10px;font-size:18px;color:${meta.accentColor};font-weight:900;flex-shrink:0}
      .sig-section,.photo-section{padding:14px 20px;border-bottom:1px solid #e5e5e5}
      .sig-img{border:1px solid #ddd;padding:4px;max-height:60px;width:100%;object-fit:contain}
      .photo-img{max-width:100%;max-height:160px;object-fit:contain;border:1px solid #ddd;padding:4px;display:block}
      .footer{padding:10px 20px;display:flex;justify-content:space-between;align-items:center;background:#fafafa}
      .footer-text{font-size:7px;opacity:.35;letter-spacing:1px;text-transform:uppercase}
      .stamp{border:2px solid ${meta.accentColor};color:${meta.accentColor};padding:4px 10px;font-size:8px;font-weight:900;letter-spacing:2px;text-transform:uppercase}
      @media print{body{padding:0}}
    </style></head><body>
    <div class="doc">
      <div class="stripe"></div>
      <div class="top">
        <div class="top-left">
          ${logoB64 ? `<div class="brand-logo"><img src="${logoB64}" style="width:40px;height:40px;object-fit:contain" /></div>` : `<div class="brand-logo" style="background:#141414;color:#E4E3E0;font-size:11px;font-weight:900;letter-spacing:1px">${brandAbbr}</div>`}
          <div>
            <div class="brand">${BRAND_NAME[guide.brand] ?? guide.brand} // GUÍA DE OPERACIÓN</div>
            <div class="docnum">${guide.number}</div>
          </div>
        </div>
        <div class="badge"><span>${meta.icon}</span>${meta.label}</div>
      </div>
      <div class="meta">
        <div class="meta-cell"><div class="meta-label">Fecha</div><div class="meta-value">${guide.date}</div></div>
        <div class="meta-cell"><div class="meta-label">Operador</div><div class="meta-value">${guide.operator}</div></div>
        <div class="meta-cell"><div class="meta-label">Referencia</div><div class="meta-value">${guide.reference}</div></div>
        ${guide.contact ? `<div class="meta-cell"><div class="meta-label">${guide.type === 'RECEPTION' ? 'Proveedor' : 'Cliente'}</div><div class="meta-value">${guide.contact}</div></div>` : '<div class="meta-cell"></div>'}
      </div>
      ${itemsHTML}
      ${flowHTML}
      ${sigHTML}
      ${photoHTML}
      <div class="footer">
        <div class="footer-text">LogixZazu v3.0 // Documento generado autom-ticamente</div>
        <div class="stamp">REGISTRADO</div>
      </div>
    </div>
    </body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 400);
  };

  return (
    <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div
        className="bg-[var(--bg-input)] border-2 border-[var(--border)] shadow-[10px_10px_0_var(--border)] w-full max-w-lg flex flex-col my-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="h-1.5 w-full" style={{ background: meta.accentColor }} />

        {/* Header */}
        <div className="px-6 py-4 border-b-2 border-[var(--border)] flex items-center justify-between gap-4" style={{ background: meta.bgColor }}>
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 bg-[var(--ink)] flex items-center justify-center shrink-0">
              <span className="font-mono font-black text-[var(--ink-inv)] text-[9px] tracking-wider">{BRAND_ABBR[guide.brand] ?? 'LZ'}</span>
            </div>
            <div className="min-w-0">
              <div className="font-mono text-[8px] font-bold tracking-[0.3em] opacity-40 uppercase mb-0.5">
                {BRAND_NAME[guide.brand] ?? guide.brand} // GUÍA DE OPERACIÓN
              </div>
              <div className="font-mono font-black text-xl tracking-tight text-[var(--ink)]">{guide.number}</div>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-2 px-4 py-2 text-white font-mono font-black text-[10px] tracking-widest uppercase" style={{ background: meta.accentColor }}>
              <span className="text-base leading-none">{meta.icon}</span>
              {meta.label}
            </div>
            <button onClick={onClose} className="p-1 opacity-40 hover:opacity-80"><X size={15} /></button>
          </div>
        </div>

        <div ref={printRef}>
          {/* Meta grid */}
          <div className="grid grid-cols-2 border-b border-[var(--border)]/15">
            {[
              { label: 'FECHA', value: guide.date },
              { label: 'OPERADOR', value: guide.operator },
              { label: 'REFERENCIA', value: guide.reference },
              guide.contact ? { label: guide.type === 'RECEPTION' ? 'PROVEEDOR' : 'CLIENTE', value: guide.contact } : null,
            ].filter(Boolean).map((cell: any) => (
              <div key={cell.label} className="px-5 py-3 border-b border-r border-[var(--border)]/10 odd:border-r even:border-r-0">
                <div className="font-mono text-[8px] font-bold tracking-[0.2em] opacity-40 uppercase mb-1">{cell.label}</div>
                <div className="font-mono font-black text-[11px] text-[var(--ink)] uppercase">{cell.value}</div>
              </div>
            ))}
          </div>

          {/* Items */}
          <div className="px-5 py-4 border-b border-[var(--border)]/15">
            <div className="font-mono text-[8px] font-bold tracking-[0.3em] opacity-35 uppercase mb-3">
              {guide.items.length === 1 ? 'PRODUCTO' : `PRODUCTOS · ${guide.items.length} L-NEAS`}
            </div>
            {guide.items.length === 1 ? (
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="font-mono font-black text-base text-[var(--ink)] uppercase leading-tight truncate">{guide.items[0].productName}</div>
                  <div className="font-mono text-[10px] opacity-50 mt-0.5">{guide.items[0].productCode}{guide.items[0].serialNumber ? ` · S/N: ${guide.items[0].serialNumber}` : ''}</div>
                </div>
                <div className="shrink-0 flex flex-col items-center justify-center px-4 py-2 text-white font-mono font-black" style={{ background: meta.accentColor, minWidth: 72 }}>
                  <span className="text-xl leading-none">{guide.items[0].quantity}</span>
                  <span className="text-[8px] tracking-widest opacity-80 mt-0.5">UND</span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-0 border border-[var(--border)]/20 overflow-hidden">
                <div className="grid grid-cols-[auto_1fr_auto] text-[9px] font-mono font-bold uppercase tracking-wider" style={{ background: meta.accentColor, color: 'white' }}>
                  <div className="px-3 py-2">Codigo</div>
                  <div className="px-3 py-2">Producto</div>
                  <div className="px-3 py-2 text-right">Cant.</div>
                </div>
                {guide.items.map((item, i) => (
                  <div key={i} className="grid grid-cols-[auto_1fr_auto] text-[10px] font-mono border-t border-[var(--border)]/10 bg-[var(--surface)]">
                    <div className="px-3 py-2 opacity-50 text-[9px]">{item.productCode}</div>
                    <div className="px-3 py-2 font-bold uppercase truncate">{item.productName}</div>
                    <div className="px-3 py-2 font-black text-right">{item.quantity}</div>
                  </div>
                ))}
                <div className="grid grid-cols-[1fr_auto] bg-[var(--bg-modal)] border-t border-[var(--border)]/20 font-mono font-black text-[11px]">
                  <div className="px-3 py-2 opacity-50 uppercase text-[9px] tracking-widest self-center">TOTAL</div>
                  <div className="px-3 py-2 text-right" style={{ color: meta.accentColor }}>{totalQty} UND</div>
                </div>
              </div>
            )}
          </div>

          {/* Movement */}
          {(guide.fromLocation || guide.toLocation) && (
            <div className="px-5 py-4 border-b border-[var(--border)]/15">
              <div className="font-mono text-[8px] font-bold tracking-[0.3em] opacity-35 uppercase mb-3">MOVIMIENTO</div>
              <div className="flex items-stretch gap-0">
                {guide.fromLocation && (
                  <div className="flex-1 border border-[var(--border)]/20 bg-[var(--bg-card-alt)] px-3 py-2.5">
                    <div className="font-mono text-[7px] font-bold tracking-[0.2em] opacity-40 uppercase mb-1">ORIGEN</div>
                    <div className="font-mono font-black text-[11px] text-[var(--ink)] uppercase">{guide.fromLocation}</div>
                  </div>
                )}
                {guide.fromLocation && guide.toLocation && (
                  <div className="flex items-center justify-center px-3 font-black text-lg text-white shrink-0" style={{ background: meta.accentColor }}>
                    {meta.icon}
                  </div>
                )}
                {guide.toLocation && (
                  <div className="flex-1 border border-[var(--border)]/20 bg-[var(--bg-card-alt)] px-3 py-2.5">
                    <div className="font-mono text-[7px] font-bold tracking-[0.2em] opacity-40 uppercase mb-1">DESTINO</div>
                    <div className="font-mono font-black text-[11px] text-[var(--ink)] uppercase">{guide.toLocation}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Signature */}
          {guide.signature && (
            <div className="px-5 py-4 border-b border-[var(--border)]/15">
              <div className="font-mono text-[8px] font-bold tracking-[0.3em] opacity-35 uppercase mb-2">FIRMA DE CONFORMIDAD</div>
              <div className="border border-[var(--border)]/20 bg-[var(--bg-card-alt)] p-2">
                <img src={guide.signature} alt="firma" className="h-16 w-full object-contain" />
              </div>
            </div>
          )}

          {/* Photo */}
          {guide.photo && (
            <div className="px-5 py-4 border-b border-[var(--border)]/15">
              <div className="font-mono text-[8px] font-bold tracking-[0.3em] opacity-35 uppercase mb-2">EVIDENCIA FOTOGR-FICA</div>
              <div className="border border-[var(--border)]/20 bg-[var(--bg-card-alt)] p-1">
                <img src={guide.photo} alt="evidencia" className="max-h-40 w-full object-contain" />
              </div>
            </div>
          )}

          {/* Footer stamp */}
          <div className="px-5 py-3 flex items-center justify-between bg-[var(--bg-card-alt)]">
            <div className="font-mono text-[8px] opacity-30 tracking-widest uppercase">LogixZazu v3.0 // Documento generado autom-ticamente</div>
            <div className="font-mono font-black text-[8px] tracking-widest uppercase px-3 py-1.5 border-2" style={{ borderColor: meta.accentColor, color: meta.accentColor }}>
              ? REGISTRADO
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="border-t-2 border-[var(--border)] p-3 flex gap-2 bg-[var(--bg-modal)]">
          <button
            onClick={handlePrint}
            className="flex-1 flex items-center justify-center gap-2 text-white py-2.5 text-[10px] font-bold font-mono uppercase transition-all hover:opacity-90"
            style={{ background: meta.accentColor }}
          >
            <Printer size={13} /> IMPRIMIR GU-A
          </button>
          <button onClick={onClose} className="flex-1 border-2 border-[var(--border)] py-2.5 text-[10px] font-bold font-mono uppercase hover:bg-[var(--bg-input)] transition-all text-[var(--ink)]">
            CERRAR
          </button>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { useAppContext } from '../store/AppContext';
import { ModuleInfo } from '../components/ModuleInfo';
import { Plus, ChevronDown, ChevronUp, Upload, Download, CheckCircle, XCircle, AlertCircle, PackagePlus, SlidersHorizontal } from 'lucide-react';
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

const VALID_REASONS: Record<string, AdjustmentReason> = {
  DAMAGE: 'DAMAGE', DAÑO: 'DAMAGE',
  LOSS: 'LOSS', MERMA: 'LOSS',
  COUNT: 'COUNT', CONTEO: 'COUNT',
  RETURN: 'RETURN', DEVOLUCION: 'RETURN', DEVOLUCIÓN: 'RETURN',
  OTHER: 'OTHER', OTRO: 'OTHER',
};

const PAGE_SIZE = 20;

type BulkMode = 'adjust' | 'reception';

type BulkRow = {
  line: number;
  code: string;
  qty: number;
  reason: AdjustmentReason;
  locationName: string;
  notes: string;
  productId: string | null;
  locationId: string | null;
  stockActual: number;
  error: string | null;
};

export const Adjustments: React.FC = () => {
  const { adjustments, addAdjustment, addTransaction, products, locations, stockLevels, currentUser } = useAppContext();
  const [showModal, setShowModal] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filterReason, setFilterReason] = useState<'ALL' | AdjustmentReason>('ALL');
  const [page, setPage] = useState(1);

  const canAdjust = canEdit(currentUser.role, 'adjustments');

  // --- Single adjustment form ---
  const [selName, setSelName] = useState('');
  const [selColor, setSelColor] = useState('');
  const [selSize, setSelSize] = useState('');
  const [form, setForm] = useState({
    productId: '',
    locationId: '',
    newQuantity: 0,
    reason: 'COUNT' as AdjustmentReason,
    notes: '',
  });
  const [error, setError] = useState('');

  const uniqueNames: string[] = Array.from(new Set<string>(products.map(p => p.name))).sort();
  const colorsForName: string[] = selName
    ? Array.from(new Set<string>(products.filter(p => p.name === selName && p.color).map(p => p.color!))).sort()
    : [];
  const sizesForNameColor: string[] = selName
    ? products
        .filter(p => p.name === selName && (!selColor || p.color === selColor))
        .map(p => p.size?.trim() || '')
        .filter((s): s is string => s.length > 0)
    : [];
  const uniqueSizes: string[] = Array.from(new Set<string>(sizesForNameColor)).sort();

  const resolveProductId = (name: string, color: string, size: string) => {
    const match = products.find(p =>
      p.name === name &&
      (!color || p.color === color) &&
      (!size || p.size?.trim() === size)
    );
    return match?.id || '';
  };

  const currentStock = form.productId && form.locationId
    ? stockLevels.find(s => s.productId === form.productId && s.locationId === form.locationId)?.quantity ?? 0
    : 0;

  const handleNameChange = (name: string) => {
    setSelName(name); setSelColor(''); setSelSize('');
    setForm(f => ({ ...f, productId: '' }));
  };
  const handleColorChange = (color: string) => {
    setSelColor(color); setSelSize('');
    setForm(f => ({ ...f, productId: '' }));
  };
  const handleSizeChange = (size: string) => {
    setSelSize(size);
    setForm(f => ({ ...f, productId: resolveProductId(selName, selColor, size) }));
  };

  const openAdd = () => {
    setSelName(''); setSelColor(''); setSelSize('');
    setForm({ productId: '', locationId: locations[0]?.id || '', newQuantity: 0, reason: 'COUNT', notes: '' });
    setError('');
    setShowModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selName) { setError('Selecciona un producto'); return; }
    if (!form.productId) { setError('Selecciona color y talla para identificar el SKU'); return; }
    if (!form.locationId) { setError('Selecciona una ubicación'); return; }
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

  // --- Bulk upload ---
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkMode, setBulkMode] = useState<BulkMode>('adjust');
  const [bulkRows, setBulkRows] = useState<BulkRow[]>([]);
  const [bulkDone, setBulkDone] = useState(false);
  const [bulkApplied, setBulkApplied] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const parseBulkRows = (rawRows: Record<string, unknown>[], mode: BulkMode) => {
    const qtyKey = mode === 'reception'
      ? ['cantidad_a_ingresar', 'Cantidad_a_ingresar', 'CANTIDAD_A_INGRESAR', 'cantidad', 'nueva_cantidad']
      : ['nueva_cantidad', 'Nueva_Cantidad', 'NUEVA_CANTIDAD', 'cantidad'];

    const rows: BulkRow[] = rawRows.map((r, i) => {
      const code = String(r['codigo'] ?? r['Codigo'] ?? r['CODIGO'] ?? '').trim();
      const qtyRaw = qtyKey.reduce<unknown>((found, k) => found !== '' && found !== undefined ? found : r[k], '');
      const qty = parseInt(String(qtyRaw), 10);
      const reasonRaw = String(r['motivo'] ?? r['Motivo'] ?? r['MOTIVO'] ?? 'COUNT').toUpperCase().replace(/[^A-ZÁÉÍÓÚÑÜ]/g, '');
      const reason: AdjustmentReason = VALID_REASONS[reasonRaw] ?? 'COUNT';
      const locationName = String(r['ubicacion'] ?? r['Ubicacion'] ?? r['UBICACION'] ?? '').trim();
      const notes = String(r['notas'] ?? r['Notas'] ?? r['NOTAS'] ?? '').trim();

      const prod = products.find(p => p.code.trim().toUpperCase() === code.toUpperCase());
      const loc = locationName
        ? locations.find(l => l.name.trim().toUpperCase() === locationName.toUpperCase())
        : locations[0];

      const stockActual = prod
        ? stockLevels.filter(s => s.productId === prod.id).reduce((sum, s) => sum + s.quantity, 0)
        : 0;

      let error: string | null = null;
      if (!code) error = 'Código vacío';
      else if (!prod) error = `Código "${code}" no encontrado`;
      else if (isNaN(qty) || qty < 0) error = 'Cantidad inválida';
      else if (!loc) error = `Ubicación "${locationName}" no encontrada`;

      return {
        line: i + 2,
        code,
        qty: isNaN(qty) ? 0 : qty,
        reason,
        locationName: loc?.name || locationName,
        notes,
        productId: prod?.id ?? null,
        locationId: loc?.id ?? null,
        stockActual,
        error,
      };
    });
    setBulkRows(rows);
    setBulkDone(false);
  };

  const handleBulkFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const data = new Uint8Array(ev.target?.result as ArrayBuffer);
      const wb = XLSX.read(data, { type: 'array' });
      const skip = new Set(['Motivos', 'Ubicaciones']);
      const raw: Record<string, unknown>[] = [];
      wb.SheetNames.filter(n => !skip.has(n)).forEach(sheetName => {
        const ws = wb.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });
        raw.push(...rows);
      });
      parseBulkRows(raw, bulkMode);
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const confirmBulk = async () => {
    const valid = bulkRows.filter(r => !r.error && r.productId && r.locationId);
    if (bulkMode === 'adjust') {
      valid.forEach(r => {
        const prev = stockLevels.find(s => s.productId === r.productId && s.locationId === r.locationId)?.quantity ?? 0;
        addAdjustment({
          productId: r.productId!,
          locationId: r.locationId!,
          previousQuantity: prev,
          newQuantity: r.qty,
          reason: r.reason,
          notes: r.notes,
          user: currentUser.username,
        });
      });
    } else {
      for (const r of valid) {
        await addTransaction({
          type: 'RECEPTION',
          productId: r.productId!,
          quantity: r.qty,
          toLocationId: r.locationId!,
          reference: r.notes || `Ingreso masivo ${format(new Date(), 'dd/MM/yyyy', { locale: es })}`,
          user: currentUser.username,
        });
      }
    }
    setBulkApplied(valid.length);
    setBulkDone(true);
  };

  const downloadTemplate = (mode: BulkMode) => {
    const defaultLoc = locations[0]?.name ?? '';
    const wb = XLSX.utils.book_new();

    // Group products by name, one sheet per product
    const productNames = Array.from(new Set<string>(products.map(p => p.name))).sort();
    productNames.forEach(name => {
      const variants = products.filter(p => p.name === name);
      if (mode === 'adjust') {
        const data = variants.map(p => ({
          codigo: p.code,
          color: p.color ?? '',
          talla: p.size ?? '',
          stock_actual: stockLevels.filter(s => s.productId === p.id).reduce((sum, s) => sum + s.quantity, 0),
          nueva_cantidad: '',
          motivo: 'COUNT',
          ubicacion: defaultLoc,
          notas: '',
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        ws['!cols'] = [{ wch: 16 }, { wch: 14 }, { wch: 10 }, { wch: 14 }, { wch: 16 }, { wch: 12 }, { wch: 28 }, { wch: 30 }];
        const sheetName = name.slice(0, 31);
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
      } else {
        const data = variants.map(p => ({
          codigo: p.code,
          color: p.color ?? '',
          talla: p.size ?? '',
          stock_actual: stockLevels.filter(s => s.productId === p.id).reduce((sum, s) => sum + s.quantity, 0),
          cantidad_a_ingresar: '',
          ubicacion: defaultLoc,
          notas: '',
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        ws['!cols'] = [{ wch: 16 }, { wch: 14 }, { wch: 10 }, { wch: 14 }, { wch: 20 }, { wch: 28 }, { wch: 30 }];
        const sheetName = name.slice(0, 31);
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
      }
    });

    // Reference sheets
    if (mode === 'adjust') {
      const wsMotivos = XLSX.utils.json_to_sheet(Object.entries(REASON_LABEL).map(([k, v]) => ({ clave: k, descripcion: v })));
      wsMotivos['!cols'] = [{ wch: 14 }, { wch: 22 }];
      XLSX.utils.book_append_sheet(wb, wsMotivos, 'Motivos');
    }
    const wsLocs = XLSX.utils.json_to_sheet(locations.map(l => ({ nombre: l.name, tipo: l.type })));
    wsLocs['!cols'] = [{ wch: 30 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, wsLocs, 'Ubicaciones');

    XLSX.writeFile(wb, mode === 'adjust' ? 'ajuste_masivo_inventario.xlsx' : 'ingreso_masivo_almacen.xlsx');
  };

  // --- Pagination & filter ---
  const filtered = adjustments.filter(a => filterReason === 'ALL' || a.reason === filterReason);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const diffColor = (prev: number, next: number) => {
    if (next > prev) return 'text-green-700';
    if (next < prev) return 'text-red-600';
    return 'text-[#9f9d99]';
  };

  const openBulk = (mode: BulkMode) => {
    setBulkMode(mode);
    setBulkRows([]);
    setBulkDone(false);
    setBulkApplied(0);
    setShowBulkModal(true);
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
          <select value={filterReason} onChange={e => { setFilterReason(e.target.value as any); setPage(1); }}
            className="border border-[#141414] bg-white/50 px-3 py-2 text-[10px] font-mono font-bold uppercase focus:outline-none cursor-pointer">
            <option value="ALL">TODOS LOS MOTIVOS</option>
            {(Object.keys(REASON_LABEL) as AdjustmentReason[]).map(r => <option key={r} value={r}>{REASON_LABEL[r]}</option>)}
          </select>
          {canAdjust && (
            <>
              <button onClick={() => openBulk('reception')}
                className="flex items-center gap-2 border border-[#141414] bg-white/50 px-4 py-2 text-xs font-bold font-mono uppercase hover:bg-white transition-all">
                <PackagePlus size={14} /> INGRESO MASIVO
              </button>
              <button onClick={() => openBulk('adjust')}
                className="flex items-center gap-2 border border-[#141414] bg-white/50 px-4 py-2 text-xs font-bold font-mono uppercase hover:bg-white transition-all">
                <SlidersHorizontal size={14} /> AJUSTE MASIVO
              </button>
              <button onClick={openAdd}
                className="flex items-center gap-2 bg-[#141414] text-[#E4E3E0] px-4 py-2 text-xs font-bold font-mono uppercase hover:shadow-[3px_3px_0_#9f9d99] transition-all border border-[#141414]">
                <Plus size={14} /> NUEVO AJUSTE
              </button>
            </>
          )}
        </div>
      </div>

      {filtered.length === 0 && (
        <div className="text-center font-mono text-xs opacity-50 py-16 uppercase tracking-widest">Sin ajustes registrados</div>
      )}

      <div className="flex flex-col gap-3">
        {paginated.map(adj => {
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <span className="font-mono text-[10px] opacity-50">
            {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} de {filtered.length}
          </span>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="border border-[#141414] px-3 py-1.5 text-[10px] font-mono font-bold disabled:opacity-30 hover:bg-white transition-all">
              ←
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1).map((p, idx, arr) => (
              <React.Fragment key={p}>
                {idx > 0 && arr[idx - 1] !== p - 1 && <span className="font-mono text-[10px] opacity-30 px-1">…</span>}
                <button onClick={() => setPage(p)}
                  className={`border px-3 py-1.5 text-[10px] font-mono font-bold transition-all ${p === page ? 'bg-[#141414] text-[#E4E3E0] border-[#141414]' : 'border-[#141414] hover:bg-white'}`}>
                  {p}
                </button>
              </React.Fragment>
            ))}
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="border border-[#141414] px-3 py-1.5 text-[10px] font-mono font-bold disabled:opacity-30 hover:bg-white transition-all">
              →
            </button>
          </div>
        </div>
      )}

      {/* Summary cards */}
      {adjustments.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-2">
          {(Object.keys(REASON_LABEL) as AdjustmentReason[]).map(r => {
            const count = adjustments.filter(a => a.reason === r).length;
            return (
              <div key={r} className={`border p-3 cursor-pointer transition-all ${filterReason === r ? 'bg-[#141414] text-[#E4E3E0] border-[#141414]' : 'border-[#141414] bg-white/30 hover:bg-white/60'}`}
                onClick={() => { setFilterReason(filterReason === r ? 'ALL' : r); setPage(1); }}>
                <div className="font-mono text-[18px] font-black">{count}</div>
                <div className="font-mono text-[8px] uppercase tracking-widest opacity-70 mt-0.5">{REASON_LABEL[r]}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Single adjustment modal */}
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
                <select value={selName} onChange={e => handleNameChange(e.target.value)}
                  className="border border-[#141414] bg-white px-3 py-2 text-xs font-mono focus:outline-none cursor-pointer" required>
                  <option value="">Seleccionar producto...</option>
                  {uniqueNames.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              {selName && colorsForName.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <label className="font-mono text-[9px] font-bold uppercase tracking-widest opacity-60">Color</label>
                  <div className="flex flex-wrap gap-1.5">
                    {colorsForName.map(c => (
                      <button key={c} type="button" onClick={() => handleColorChange(selColor === c ? '' : c)}
                        className={`px-3 py-1.5 text-[10px] font-mono font-bold uppercase border transition-all ${selColor === c ? 'bg-[#141414] text-[#E4E3E0] border-[#141414]' : 'border-[#141414] bg-white/60 hover:bg-white'}`}>
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {selName && uniqueSizes.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <label className="font-mono text-[9px] font-bold uppercase tracking-widest opacity-60">Talla</label>
                  <div className="flex flex-wrap gap-1.5">
                    {uniqueSizes.map(s => (
                      <button key={s} type="button" onClick={() => handleSizeChange(s)}
                        className={`min-w-[40px] px-3 py-1.5 text-[10px] font-mono font-bold uppercase border transition-all ${selSize === s ? 'bg-[#141414] text-[#E4E3E0] border-[#141414]' : 'border-[#141414] bg-white/60 hover:bg-white'}`}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {form.productId && (() => {
                const p = products.find(x => x.id === form.productId);
                return p ? (
                  <div className="bg-white/50 border border-[#141414]/30 px-3 py-2 font-mono text-[10px] text-[#141414] font-bold uppercase">
                    {p.code} — {p.name} {p.color} {p.size}
                  </div>
                ) : null;
              })()}
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

      {/* Bulk modal */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[#E4E3E0] border border-[#141414] shadow-[4px_4px_0_#141414] w-full max-w-3xl max-h-[90vh] flex flex-col">
            <div className="border-b border-[#141414] px-5 py-3 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                {bulkMode === 'reception'
                  ? <PackagePlus size={14} className="opacity-60" />
                  : <SlidersHorizontal size={14} className="opacity-60" />}
                <span className="font-mono font-bold text-xs uppercase tracking-widest">
                  {bulkMode === 'reception' ? 'INGRESO MASIVO AL ALMACÉN' : 'AJUSTE MASIVO DE INVENTARIO'}
                </span>
              </div>
              <button onClick={() => setShowBulkModal(false)} className="font-mono text-xs opacity-60 hover:opacity-100">✕</button>
            </div>

            <div className="p-5 flex flex-col gap-4 overflow-y-auto">
              {/* Mode explanation */}
              <div className={`border px-3 py-2 text-[9px] font-mono leading-relaxed ${bulkMode === 'reception' ? 'border-green-600 bg-green-50 text-green-800' : 'border-blue-600 bg-blue-50 text-blue-800'}`}>
                {bulkMode === 'reception'
                  ? '▸ INGRESO: suma las unidades al stock existente. Genera una transacción de RECEPCIÓN visible en el historial.'
                  : '▸ AJUSTE: reemplaza el stock con el valor exacto que indiques. Útil para conteos físicos y correcciones.'}
              </div>

              {/* Instructions */}
              <div className="bg-white/40 border border-[#141414]/20 p-3 flex flex-col gap-1.5">
                <p className="font-mono text-[9px] font-bold uppercase tracking-widest opacity-60">
                  Columnas del archivo: {bulkMode === 'reception'
                    ? 'codigo · cantidad_a_ingresar · ubicacion · notas'
                    : 'codigo · nueva_cantidad · motivo · ubicacion · notas'}
                </p>
                <p className="font-mono text-[9px] opacity-50 leading-relaxed">
                  La plantilla incluye todos los productos del catálogo con su stock actual.<br />
                  {bulkMode === 'adjust' && 'Motivos: COUNT, DAMAGE, LOSS, RETURN, OTHER (o en español). '}
                  Deja vacía la cantidad si no quieres modificar ese producto.
                </p>
                <button onClick={() => downloadTemplate(bulkMode)}
                  className="self-start flex items-center gap-1.5 border border-[#141414] px-3 py-1.5 text-[9px] font-mono font-bold uppercase hover:bg-white transition-all mt-1">
                  <Download size={11} /> Descargar plantilla Excel
                </button>
              </div>

              {/* File input */}
              {!bulkDone && (
                <>
                  <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleBulkFile} />
                  <button onClick={() => fileRef.current?.click()}
                    className="w-full border-2 border-dashed border-[#141414]/40 py-6 flex flex-col items-center gap-2 hover:border-[#141414] hover:bg-white/30 transition-all cursor-pointer bg-white/20">
                    <Upload size={20} className="opacity-40" />
                    <span className="font-mono text-[10px] uppercase tracking-widest opacity-60">Haz click para seleccionar el archivo Excel (.xlsx)</span>
                  </button>
                </>
              )}

              {/* Preview */}
              {bulkRows.length > 0 && !bulkDone && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[9px] uppercase tracking-widest opacity-60">
                      {bulkRows.filter(r => !r.error).length} válidas · {bulkRows.filter(r => r.error).length} con errores
                    </span>
                    <button onClick={() => fileRef.current?.click()}
                      className="font-mono text-[9px] uppercase tracking-widest underline opacity-60 hover:opacity-100">
                      Cambiar archivo
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-[10px] font-mono border-collapse">
                      <thead>
                        <tr className="border-b border-[#141414]">
                          <th className="text-left py-1.5 px-2 opacity-50 font-bold uppercase tracking-wide w-8">#</th>
                          <th className="text-left py-1.5 px-2 opacity-50 font-bold uppercase tracking-wide">Código</th>
                          <th className="text-right py-1.5 px-2 opacity-50 font-bold uppercase tracking-wide">Stock actual</th>
                          <th className="text-right py-1.5 px-2 opacity-50 font-bold uppercase tracking-wide">
                            {bulkMode === 'reception' ? 'A ingresar' : 'Nueva cant.'}
                          </th>
                          {bulkMode === 'reception' && (
                            <th className="text-right py-1.5 px-2 opacity-50 font-bold uppercase tracking-wide">Stock final</th>
                          )}
                          {bulkMode === 'adjust' && (
                            <th className="text-left py-1.5 px-2 opacity-50 font-bold uppercase tracking-wide">Motivo</th>
                          )}
                          <th className="text-left py-1.5 px-2 opacity-50 font-bold uppercase tracking-wide">Ubicación</th>
                          <th className="text-left py-1.5 px-2 opacity-50 font-bold uppercase tracking-wide">Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bulkRows.map(r => (
                          <tr key={r.line} className={`border-b border-[#141414]/10 ${r.error ? 'bg-red-50' : 'bg-white/20'}`}>
                            <td className="py-1.5 px-2 opacity-40">{r.line}</td>
                            <td className="py-1.5 px-2 font-bold">{r.code}</td>
                            <td className="py-1.5 px-2 text-right opacity-60">{r.stockActual}</td>
                            <td className={`py-1.5 px-2 text-right font-bold ${!r.error && bulkMode === 'reception' ? 'text-green-700' : ''}`}>
                              {bulkMode === 'reception' ? `+${r.qty}` : r.qty}
                            </td>
                            {bulkMode === 'reception' && (
                              <td className="py-1.5 px-2 text-right font-bold">
                                {!r.error ? r.stockActual + r.qty : '—'}
                              </td>
                            )}
                            {bulkMode === 'adjust' && (
                              <td className="py-1.5 px-2 opacity-70">{REASON_LABEL[r.reason]}</td>
                            )}
                            <td className="py-1.5 px-2 opacity-70 max-w-[140px] truncate">{r.locationName || '—'}</td>
                            <td className="py-1.5 px-2">
                              {r.error
                                ? <span className="flex items-center gap-1 text-red-600"><XCircle size={11} />{r.error}</span>
                                : <span className="flex items-center gap-1 text-green-700"><CheckCircle size={11} />OK</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {bulkRows.some(r => r.error) && (
                    <div className="flex items-start gap-2 bg-amber-50 border border-amber-300 px-3 py-2">
                      <AlertCircle size={13} className="text-amber-600 mt-0.5 shrink-0" />
                      <p className="font-mono text-[9px] text-amber-700">Las filas con errores serán ignoradas. Solo se procesarán las filas válidas.</p>
                    </div>
                  )}

                  <div className="flex gap-2 pt-1">
                    <button onClick={confirmBulk} disabled={bulkRows.every(r => !!r.error)}
                      className="flex-1 bg-[#141414] text-[#E4E3E0] py-2 text-xs font-bold font-mono uppercase hover:shadow-[2px_2px_0_#9f9d99] transition-all disabled:opacity-30 disabled:cursor-not-allowed">
                      {bulkMode === 'reception'
                        ? `INGRESAR ${bulkRows.filter(r => !r.error).length} PRODUCTOS`
                        : `APLICAR ${bulkRows.filter(r => !r.error).length} AJUSTES`}
                    </button>
                    <button onClick={() => setShowBulkModal(false)}
                      className="flex-1 border border-[#141414] py-2 text-xs font-bold font-mono uppercase hover:bg-white/50">
                      CANCELAR
                    </button>
                  </div>
                </>
              )}

              {/* Success */}
              {bulkDone && (
                <div className="flex flex-col items-center gap-3 py-8">
                  <CheckCircle size={36} className="text-green-700" />
                  <p className="font-mono font-bold text-sm uppercase tracking-widest">
                    {bulkMode === 'reception' ? `${bulkApplied} productos ingresados al almacén` : `${bulkApplied} ajustes aplicados`}
                  </p>
                  <button onClick={() => setShowBulkModal(false)}
                    className="bg-[#141414] text-[#E4E3E0] px-6 py-2 text-xs font-bold font-mono uppercase hover:shadow-[2px_2px_0_#9f9d99] transition-all mt-2">
                    CERRAR
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState, useMemo } from 'react';
import { useAppContext } from '../store/AppContext';
import { ModuleInfo } from '../components/ModuleInfo';
import { Plus, Trash2, ChevronDown, ChevronUp, CheckCircle, XCircle, Package, ShoppingCart, ArrowUpRight, ArrowRightLeft, FileText, BarChart2, Mail, ClipboardList } from 'lucide-react';
import { PurchaseOrder, PurchaseOrderItem, PurchaseOrderStatus } from '../types';
import { canEdit as hasPermission } from '../lib/permissions';
import { fmtLima } from '../lib/utils';
import { sendPurchaseOrderEmail } from '../lib/emailService';
import { OperationForm, TransactionLog, OperationsReport, BulletinsTab } from './Operations';
import { cn } from '../lib/utils';

// ─── Tipos internos ─────────────────────────────────────────────────────────────
type ProductRef = { id: string; name: string; code: string; color?: string; size?: string };

const PO_SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', '3XL', 'TALLA ÚNICA', '(TALLA ÚNICA)'];
function sortPoSizes(sizes: string[]) {
  return [...sizes].sort((a, b) => {
    const ia = PO_SIZE_ORDER.indexOf(a.toUpperCase());
    const ib = PO_SIZE_ORDER.indexOf(b.toUpperCase());
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
}

// ─── Selector cascada para OC (todos los productos) ────────────────────────────
function POCascadeSelector({ products, onAdd }: {
  products: ProductRef[];
  onAdd: (items: PurchaseOrderItem[]) => void;
}) {
  const [baseName, setBaseName] = useState('');
  const [color, setColor] = useState('');
  const [sizeQtys, setSizeQtys] = useState<Record<string, string>>({});
  const [sizesCosts, setSizesCosts] = useState<Record<string, string>>({});
  const [qty, setQty] = useState('');
  const [cost, setCost] = useState('');

  const uniqueNames = useMemo(() => [...new Set(products.map(p => p.name))].sort(), [products]);
  const byName = useMemo(() => products.filter(p => p.name === baseName), [products, baseName]);
  const colors = useMemo(() => [...new Set(byName.filter(p => p.color).map(p => p.color!))].sort() as string[], [byName]);
  const byColor = useMemo(() => color ? byName.filter(p => p.color === color) : byName, [byName, color]);
  const sizes = useMemo(() => sortPoSizes([...new Set(byColor.filter(p => p.size).map(p => p.size!))] as string[]), [byColor]);
  const needsColor = colors.length > 0;
  const colorReady = !needsColor || !!color;
  const needsSize = sizes.length > 0;
  const singleProd = !needsSize ? (byColor[0] ?? null) : null;

  const reset = () => { setBaseName(''); setColor(''); setSizeQtys({}); setSizesCosts({}); setQty(''); setCost(''); };

  const handleAdd = () => {
    if (needsSize) {
      const items: PurchaseOrderItem[] = [];
      for (const size of sizes) {
        const q = parseInt(sizeQtys[size] ?? '', 10);
        if (!q || q <= 0) continue;
        const prod = byColor.find(p => p.size === size);
        if (!prod) continue;
        items.push({ productId: prod.id, quantity: q, unitCost: parseFloat(sizesCosts[size] ?? '0') || 0, receivedQuantity: 0 });
      }
      if (items.length > 0) { onAdd(items); reset(); }
    } else if (singleProd) {
      const q = parseInt(qty, 10);
      if (!q || q <= 0) return;
      onAdd([{ productId: singleProd.id, quantity: q, unitCost: parseFloat(cost) || 0, receivedQuantity: 0 }]);
      reset();
    }
  };

  const anySizeQty = sizes.some(s => parseInt(sizeQtys[s] ?? '', 10) > 0);
  const canAdd = needsSize ? anySizeQty : (!!singleProd && parseInt(qty, 10) > 0);

  const selectCls = "border border-[var(--border)] bg-[var(--bg-input)] px-2 py-1.5 text-[10px] font-mono focus:outline-none cursor-pointer w-full";
  const inputCls = "border border-[var(--border)] bg-[var(--bg-input)] px-2 py-1.5 text-[10px] font-mono focus:outline-none w-full text-center";

  return (
    <div className="flex flex-col gap-2 border border-[var(--border)]/20 bg-[var(--bg-card)] rounded-sm p-3">
      <span className="font-mono text-[9px] font-bold uppercase tracking-widest text-[var(--ink)]/50">Agregar productos</span>
      <select value={baseName} onChange={e => { setBaseName(e.target.value); setColor(''); setSizeQtys({}); setSizesCosts({}); setQty(''); setCost(''); }} className={selectCls}>
        <option value="">— Seleccione modelo —</option>
        {uniqueNames.map(n => <option key={n} value={n}>{n}</option>)}
      </select>
      {baseName && needsColor && (
        <select value={color} onChange={e => { setColor(e.target.value); setSizeQtys({}); setSizesCosts({}); }} className={selectCls}>
          <option value="">— Seleccione color —</option>
          {colors.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      )}
      {baseName && colorReady && needsSize && (
        <div className="flex flex-col gap-1">
          <div className="grid grid-cols-[80px_1fr_1fr] gap-1 mb-0.5">
            <span className="font-mono text-[8px] font-bold uppercase tracking-widest text-[var(--ink)]/40">TALLA</span>
            <span className="font-mono text-[8px] font-bold uppercase tracking-widest text-[var(--ink)]/40 text-center">CANT.</span>
            <span className="font-mono text-[8px] font-bold uppercase tracking-widest text-[var(--ink)]/40 text-center">COSTO U.</span>
          </div>
          {sizes.map(size => (
            <div key={size} className="grid grid-cols-[80px_1fr_1fr] gap-1 items-center">
              <span className="font-mono text-[10px] font-black uppercase text-[var(--ink)]">{size}</span>
              <input type="number" min="0" placeholder="0" value={sizeQtys[size] ?? ''} onChange={e => setSizeQtys(prev => ({ ...prev, [size]: e.target.value }))} className={inputCls} />
              <input type="number" min="0" step="0.01" placeholder="0.00" value={sizesCosts[size] ?? ''} onChange={e => setSizesCosts(prev => ({ ...prev, [size]: e.target.value }))} className={inputCls} />
            </div>
          ))}
        </div>
      )}
      {baseName && colorReady && !needsSize && singleProd && (
        <div className="grid grid-cols-2 gap-2">
          <input type="number" min="1" placeholder="Cantidad" value={qty} onChange={e => setQty(e.target.value)} className={inputCls} />
          <input type="number" min="0" step="0.01" placeholder="Costo unit." value={cost} onChange={e => setCost(e.target.value)} className={inputCls} />
        </div>
      )}
      {baseName && colorReady && (
        <button type="button" onClick={handleAdd} disabled={!canAdd}
          className="flex items-center justify-center gap-1.5 border border-[var(--border)] bg-[var(--ink)] text-[var(--ink-inv)] hover:bg-[var(--bg-input)] hover:text-[var(--ink)] disabled:opacity-30 transition-all px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-widest">
          <Plus size={11} /> AGREGAR
        </button>
      )}
    </div>
  );
}

// ─── Selector cascada para REQUERIMIENTOS (solo con stock en reservas) ──────────
function ReqCascadeSelector({ products, onAdd }: {
  products: ProductRef[];
  onAdd: (items: PurchaseOrderItem[]) => void;
}) {
  const [baseName, setBaseName] = useState('');
  const [color, setColor] = useState('');
  const [sizeQtys, setSizeQtys] = useState<Record<string, string>>({});
  const [qty, setQty] = useState('');

  const uniqueNames = useMemo(() => [...new Set(products.map(p => p.name))].sort(), [products]);
  const byName = useMemo(() => products.filter(p => p.name === baseName), [products, baseName]);
  const colors = useMemo(() => [...new Set(byName.filter(p => p.color).map(p => p.color!))].sort() as string[], [byName]);
  const byColor = useMemo(() => color ? byName.filter(p => p.color === color) : byName, [byName, color]);
  const sizes = useMemo(() => sortPoSizes([...new Set(byColor.filter(p => p.size).map(p => p.size!))] as string[]), [byColor]);
  const needsColor = colors.length > 0;
  const colorReady = !needsColor || !!color;
  const needsSize = sizes.length > 0;
  const singleProd = !needsSize ? (byColor[0] ?? null) : null;

  const reset = () => { setBaseName(''); setColor(''); setSizeQtys({}); setQty(''); };

  const handleAdd = () => {
    if (needsSize) {
      const items: PurchaseOrderItem[] = [];
      for (const size of sizes) {
        const q = parseInt(sizeQtys[size] ?? '', 10);
        if (!q || q <= 0) continue;
        const prod = byColor.find(p => p.size === size);
        if (!prod) continue;
        items.push({ productId: prod.id, quantity: q, unitCost: 0, receivedQuantity: 0 });
      }
      if (items.length > 0) { onAdd(items); reset(); }
    } else if (singleProd) {
      const q = parseInt(qty, 10);
      if (!q || q <= 0) return;
      onAdd([{ productId: singleProd.id, quantity: q, unitCost: 0, receivedQuantity: 0 }]);
      reset();
    }
  };

  const anySizeQty = sizes.some(s => parseInt(sizeQtys[s] ?? '', 10) > 0);
  const canAdd = needsSize ? anySizeQty : (!!singleProd && parseInt(qty, 10) > 0);

  const selectCls = "border border-[var(--border)] bg-[var(--bg-input)] px-2 py-1.5 text-[10px] font-mono focus:outline-none cursor-pointer w-full";
  const inputCls = "border border-[var(--border)] bg-[var(--bg-input)] px-2 py-1.5 text-[10px] font-mono focus:outline-none w-full text-center";

  return (
    <div className="flex flex-col gap-2 border border-[var(--border)]/20 bg-[var(--bg-card)] rounded-sm p-3">
      <span className="font-mono text-[9px] font-bold uppercase tracking-widest text-[var(--ink)]/50">Agregar prendas al requerimiento</span>
      {products.length === 0 ? (
        <p className="font-mono text-[10px] opacity-50 text-center py-4">Sin stock en reservas disponible</p>
      ) : (
        <>
          <select value={baseName} onChange={e => { setBaseName(e.target.value); setColor(''); setSizeQtys({}); setQty(''); }} className={selectCls}>
            <option value="">— Seleccione modelo —</option>
            {uniqueNames.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          {baseName && needsColor && (
            <select value={color} onChange={e => { setColor(e.target.value); setSizeQtys({}); }} className={selectCls}>
              <option value="">— Seleccione color —</option>
              {colors.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
          {baseName && colorReady && needsSize && (
            <div className="flex flex-col gap-1">
              <div className="grid grid-cols-[80px_1fr] gap-1 mb-0.5">
                <span className="font-mono text-[8px] font-bold uppercase tracking-widest text-[var(--ink)]/40">TALLA</span>
                <span className="font-mono text-[8px] font-bold uppercase tracking-widest text-[var(--ink)]/40 text-center">CANT.</span>
              </div>
              {sizes.map(size => {
                const prod = byColor.find(p => p.size === size);
                return (
                  <div key={size} className="grid grid-cols-[80px_1fr] gap-1 items-center">
                    <span className="font-mono text-[10px] font-black uppercase text-[var(--ink)]">{size}</span>
                    <input type="number" min="0" placeholder="0"
                      value={sizeQtys[size] ?? ''}
                      onChange={e => setSizeQtys(prev => ({ ...prev, [size]: e.target.value }))}
                      className={inputCls}
                      disabled={!prod}
                    />
                  </div>
                );
              })}
            </div>
          )}
          {baseName && colorReady && !needsSize && singleProd && (
            <input type="number" min="1" placeholder="Cantidad" value={qty} onChange={e => setQty(e.target.value)} className={inputCls} />
          )}
          {baseName && colorReady && (
            <button type="button" onClick={handleAdd} disabled={!canAdd}
              className="flex items-center justify-center gap-1.5 border border-[var(--border)] bg-[var(--ink)] text-[var(--ink-inv)] hover:bg-[var(--bg-input)] hover:text-[var(--ink)] disabled:opacity-30 transition-all px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-widest">
              <Plus size={11} /> AGREGAR
            </button>
          )}
        </>
      )}
    </div>
  );
}

const STATUS_LABEL: Record<PurchaseOrderStatus, string> = {
  DRAFT: 'PENDIENTE',
  APPROVED: 'APROBADO',
  PARTIAL: 'PARCIAL',
  COMPLETED: 'COMPLETADO',
  CANCELLED: 'CANCELADO',
};

const STATUS_LABEL_OC: Record<PurchaseOrderStatus, string> = {
  DRAFT: 'BORRADOR',
  APPROVED: 'APROBADA',
  PARTIAL: 'PARCIAL',
  COMPLETED: 'COMPLETADA',
  CANCELLED: 'CANCELADA',
};

const STATUS_STYLE: Record<PurchaseOrderStatus, string> = {
  DRAFT: 'border-amber-600 text-amber-700',
  APPROVED: 'border-green-700 text-green-700',
  PARTIAL: 'border-blue-600 text-blue-700',
  COMPLETED: 'border-green-700 text-green-700',
  CANCELLED: 'border-red-600 text-red-600',
};

const emptyItem = (): PurchaseOrderItem => ({ productId: '', quantity: 1, unitCost: 0, receivedQuantity: 0 });

export const PurchaseOrders: React.FC = () => {
  const { purchaseOrders, addPurchaseOrder, updatePurchaseOrder, deletePurchaseOrder, receivePurchaseOrder, contacts, products, locations, stockLevels, currentUser } = useAppContext();
  const [mainTab, setMainTab] = useState<'req' | 'ops' | 'log' | 'reports' | 'bulletins' | 'oc'>('req');
  const [activeOpt, setActiveOpt] = useState<'DISPATCH' | 'TRANSFER'>('TRANSFER');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showReqModal, setShowReqModal] = useState(false);
  const [receiveModal, setReceiveModal] = useState<PurchaseOrder | null>(null);
  const [receiving, setReceiving] = useState(false);
  const [receiveError, setReceiveError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'ALL' | PurchaseOrderStatus>('ALL');
  const [filterReqStatus, setFilterReqStatus] = useState<'ALL' | PurchaseOrderStatus>('ALL');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [form, setForm] = useState({ supplierId: '', reference: '', notes: '', locationId: '', items: [emptyItem()] });
  const [reqForm, setReqForm] = useState({ reference: '', notes: '', items: [] as PurchaseOrderItem[] });
  const [receiveQtys, setReceiveQtys] = useState<Record<number, number>>({});

  const isAdmin = hasPermission(currentUser.role, 'purchase-orders');
  const isJefeAlmacen = currentUser.role === 'JEFE_ALMACEN' || currentUser.role === 'ADMIN_GENERAL' || currentUser.role === 'CEO';
  const canEdit = hasPermission(currentUser.role, 'purchase-orders');
  const suppliers = contacts.filter(c => c.type === 'SUPPLIER');

  // Ubicación destino fija para requerimientos
  const dispatchLocation = locations.find(l => l.name.toLowerCase().includes('despacho'));

  // Ubicaciones de reserva — busca por nombre
  const reserveLocations = locations.filter(l => l.name.toLowerCase().includes('reserva'));
  const reserveLocationIds = new Set(reserveLocations.map(l => l.id));
  const productsWithReserveStock = useMemo(() => {
    const productIdsWithStock = new Set(
      stockLevels
        .filter(sl => reserveLocationIds.has(sl.locationId) && sl.quantity > 0)
        .map(sl => sl.productId)
    );
    return products.filter(p => productIdsWithStock.has(p.id));
  }, [products, stockLevels, reserveLocationIds]);

  // Separar OC de Requerimientos
  const purchaseOrdersOC = purchaseOrders.filter(po => po.type === 'OC' || !po.type);
  const requirements = purchaseOrders.filter(po => po.type === 'REQUIREMENT');

  const filteredOC = purchaseOrdersOC.filter(po => filterStatus === 'ALL' || po.status === filterStatus);
  const filteredReq = requirements.filter(po => filterReqStatus === 'ALL' || po.status === filterReqStatus);

  const totalValue = (po: PurchaseOrder) => po.items.reduce((s, i) => s + i.quantity * i.unitCost, 0);

  const buildEmailItems = (items: PurchaseOrderItem[]) =>
    items.map(item => {
      const prod = products.find(p => p.id === item.productId);
      return { productCode: prod?.code ?? item.productId, productName: [prod?.name, prod?.color, prod?.size].filter(Boolean).join(' '), quantity: item.quantity, unitCost: item.unitCost };
    });

  const openAdd = () => {
    setForm({ supplierId: suppliers[0]?.id || '', reference: `OC-${Date.now().toString().slice(-6)}`, notes: '', locationId: locations[0]?.id || '', items: [] });
    setShowModal(true);
  };

  const openAddReq = () => {
    setReqForm({ reference: `REQ-${Date.now().toString().slice(-6)}`, notes: '', items: [] });
    setShowReqModal(true);
  };

  const handleSubmitOC = (e: React.FormEvent) => {
    e.preventDefault();
    const validItems = form.items.filter(i => i.productId);
    if (!form.supplierId || validItems.length === 0) return;
    const now = new Date();
    addPurchaseOrder({ ...form, type: 'OC', items: validItems, status: 'DRAFT' });
    setShowModal(false);
    const supplier = contacts.find(c => c.id === form.supplierId);
    sendPurchaseOrderEmail({ reference: form.reference, supplierName: supplier?.name ?? '—', status: 'DRAFT', date: now.toLocaleDateString('es-PE', { timeZone: 'America/Lima', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }), operator: currentUser.username, items: buildEmailItems(form.items), notes: form.notes });
  };

  const handleSubmitReq = (e: React.FormEvent) => {
    e.preventDefault();
    if (reqForm.items.length === 0) return;
    addPurchaseOrder({
      type: 'REQUIREMENT',
      supplierId: '',
      reference: reqForm.reference,
      notes: reqForm.notes,
      locationId: dispatchLocation?.id || '',
      items: reqForm.items,
      status: 'DRAFT',
    });
    setShowReqModal(false);
  };

  const changeStatus = (po: PurchaseOrder, status: PurchaseOrderStatus) => {
    updatePurchaseOrder({ ...po, status });
    if (po.type === 'OC' && status === 'APPROVED') {
      const supplier = contacts.find(c => c.id === po.supplierId);
      const now = new Date();
      sendPurchaseOrderEmail({ reference: po.reference, supplierName: supplier?.name ?? '—', status: 'APPROVED', date: now.toLocaleDateString('es-PE', { timeZone: 'America/Lima', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }), operator: currentUser.username, items: buildEmailItems(po.items), notes: po.notes });
    }
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
    try { await receivePurchaseOrder(receiveModal, receiveQtys); setReceiveModal(null); }
    catch { setReceiveError('Error al registrar. Intenta de nuevo.'); }
    finally { setReceiving(false); }
  };

  const removeItem = (i: number) => setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }));
  const updateItem = (i: number, field: keyof PurchaseOrderItem, value: string | number) =>
    setForm(f => ({ ...f, items: f.items.map((item, idx) => idx === i ? { ...item, [field]: value } : item) }));

  const removeReqItem = (i: number) => setReqForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }));

  const tabCls = (active: boolean) => cn(
    'flex items-center gap-2 px-4 py-3 font-mono text-[10px] font-bold uppercase tracking-widest border-r border-[var(--border)] transition-all',
    active ? 'bg-[var(--ink)] text-[var(--ink-inv)]' : 'text-[var(--ink)] opacity-60 hover:opacity-100 hover:bg-[var(--surface)]'
  );

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-6 pb-8">
      <ModuleInfo number="09" title="Despacho & Traslado" description="Gestión de requerimientos de almacén, traslados y órdenes de compra a proveedores." />

      {/* Main tabs */}
      <div className="flex flex-wrap border border-[var(--border)] bg-[var(--bg-sidebar)]">
        <button onClick={() => setMainTab('req')} className={tabCls(mainTab === 'req')}>
          <ClipboardList size={14} /> REQUERIMIENTOS
        </button>
        <button onClick={() => setMainTab('ops')} className={tabCls(mainTab === 'ops')}>
          <ArrowUpRight size={14} /> OPERACIONES
        </button>
        <button onClick={() => setMainTab('log')} className={tabCls(mainTab === 'log')}>
          <FileText size={14} /> HISTORIAL
        </button>
        <button onClick={() => setMainTab('reports')} className={tabCls(mainTab === 'reports')}>
          <BarChart2 size={14} /> REPORTES
        </button>
        <button onClick={() => setMainTab('bulletins')} className={tabCls(mainTab === 'bulletins')}>
          <Mail size={14} /> COMPROBANTES
        </button>
        <button onClick={() => setMainTab('oc')} className={cn(tabCls(mainTab === 'oc'), 'border-r-0')}>
          <ShoppingCart size={14} /> ÓRDENES OC
        </button>
      </div>

      {/* REQUERIMIENTOS tab */}
      {mainTab === 'req' && (
        <>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 border-b border-[var(--border)] pb-3">
            <div>
              <h2 className="font-mono font-black text-xs uppercase tracking-widest">09 // REQUERIMIENTOS_ALMACÉN</h2>
              <p className="font-mono text-[10px] opacity-70 uppercase tracking-wide mt-1">
                Órdenes internas de prendas desde reservas → Stock Despacho.
                {dispatchLocation && <span className="ml-2 opacity-50">Destino: {dispatchLocation.name}</span>}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <select value={filterReqStatus} onChange={e => setFilterReqStatus(e.target.value as any)}
                className="border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[10px] font-mono font-bold uppercase focus:outline-none cursor-pointer">
                <option value="ALL">TODOS</option>
                {(Object.keys(STATUS_LABEL) as PurchaseOrderStatus[]).map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
              </select>
              <button onClick={openAddReq} className="flex items-center gap-2 bg-[var(--ink)] text-[var(--ink-inv)] px-4 py-2 text-xs font-bold font-mono uppercase hover:shadow-[3px_3px_0_var(--border)] transition-all border border-[var(--border)]">
                <Plus size={14} /> NUEVO REQUERIMIENTO
              </button>
            </div>
          </div>

          {filteredReq.length === 0 && (
            <div className="text-center font-mono text-xs opacity-50 py-16 uppercase tracking-widest">Sin requerimientos</div>
          )}

          <div className="flex flex-col gap-3">
            {filteredReq.map(po => {
              const isExpanded = expanded === po.id;
              return (
                <div key={po.id} className="border border-[var(--border)] bg-[var(--bg-card)]">
                  <div className="flex items-center justify-between gap-4 p-4 cursor-pointer" onClick={() => setExpanded(isExpanded ? null : po.id)}>
                    <div className="flex items-center gap-4 min-w-0 flex-wrap">
                      <span className={`font-mono text-[9px] font-bold border px-2 py-0.5 shrink-0 ${STATUS_STYLE[po.status]}`}>{STATUS_LABEL[po.status]}</span>
                      <span className="font-mono font-bold text-sm text-[var(--ink)] shrink-0">{po.reference}</span>
                      <span className="font-mono text-xs opacity-50">{fmtLima(po.date, { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                      <span className="font-mono text-[10px] opacity-50">{po.items.reduce((s, i) => s + i.quantity, 0)} prendas</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="border-t border-[var(--border)] p-4 flex flex-col gap-4">
                      <div className="overflow-x-auto">
                        <table className="w-full text-[10px] font-mono border-collapse">
                          <thead>
                            <tr className="border-b border-[var(--border)]">
                              <th className="text-left py-1.5 pr-3 font-bold uppercase">Producto</th>
                              <th className="text-right py-1.5 px-3 font-bold uppercase">Solicitado</th>
                              <th className="text-right py-1.5 pl-3 font-bold uppercase">Despachado</th>
                            </tr>
                          </thead>
                          <tbody>
                            {po.items.map((item, i) => {
                              const prod = products.find(p => p.id === item.productId);
                              return (
                                <tr key={i} className="border-b border-[var(--border)]/20">
                                  <td className="py-1.5 pr-3">{prod ? `${prod.code} ${prod.name} ${prod.color || ''} ${prod.size || ''}`.trim() : item.productId}</td>
                                  <td className="text-right py-1.5 px-3">{item.quantity}</td>
                                  <td className={`text-right py-1.5 pl-3 font-bold ${item.receivedQuantity >= item.quantity ? 'text-green-700' : item.receivedQuantity > 0 ? 'text-amber-700' : ''}`}>{item.receivedQuantity}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      {po.notes && <p className="font-mono text-[10px] opacity-60 italic">{po.notes}</p>}
                      {dispatchLocation && (
                        <p className="font-mono text-[9px] opacity-40 uppercase">Destino: {dispatchLocation.name}</p>
                      )}
                      <div className="flex flex-wrap gap-2">
                        {/* Solo JEFE_ALMACEN/ADMIN/CEO puede aprobar */}
                        {po.status === 'DRAFT' && isJefeAlmacen && (
                          <button onClick={() => changeStatus(po, 'APPROVED')} className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold font-mono uppercase border border-green-700 text-green-700 hover:bg-green-700 hover:text-white transition-colors">
                            <CheckCircle size={12} /> APROBAR
                          </button>
                        )}
                        {po.status === 'DRAFT' && !isJefeAlmacen && (
                          <span className="font-mono text-[9px] opacity-40 uppercase tracking-widest self-center">Pendiente de aprobación por Jefe de Almacén</span>
                        )}
                        {(po.status === 'APPROVED' || po.status === 'PARTIAL') && isJefeAlmacen && (
                          <button onClick={() => openReceive(po)} className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold font-mono uppercase border border-blue-700 text-blue-700 hover:bg-blue-700 hover:text-white transition-colors">
                            <Package size={12} /> DESPACHAR
                          </button>
                        )}
                        {po.status !== 'COMPLETED' && po.status !== 'CANCELLED' && isJefeAlmacen && (
                          <button onClick={() => changeStatus(po, 'CANCELLED')} className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold font-mono uppercase border border-red-600 text-red-600 hover:bg-red-600 hover:text-white transition-colors">
                            <XCircle size={12} /> RECHAZAR
                          </button>
                        )}
                        {isJefeAlmacen && (po.status === 'DRAFT' || po.status === 'CANCELLED') && (
                          <button onClick={() => setConfirmDelete(po.id)} className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold font-mono uppercase border border-[var(--border)]/30 hover:border-red-600 hover:text-red-600 transition-colors ml-auto">
                            <Trash2 size={12} /> ELIMINAR
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Modal nuevo requerimiento */}
          {showReqModal && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-[var(--bg)] border border-[var(--border)] shadow-[4px_4px_0_var(--border)] w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div className="border-b border-[var(--border)] px-5 py-3 flex justify-between items-center sticky top-0 bg-[var(--bg)]">
                  <span className="font-mono font-bold text-xs uppercase tracking-widest">NUEVO REQUERIMIENTO</span>
                  <button onClick={() => setShowReqModal(false)} className="font-mono text-xs opacity-60 hover:opacity-100">✕</button>
                </div>
                <form onSubmit={handleSubmitReq} className="p-5 flex flex-col gap-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="font-mono text-[9px] font-bold uppercase tracking-widest opacity-60">Referencia *</label>
                      <input value={reqForm.reference} onChange={e => setReqForm(f => ({ ...f, reference: e.target.value }))}
                        className="border border-[var(--border)] bg-[var(--bg-input)] px-3 py-2 text-xs font-mono focus:outline-none" required />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="font-mono text-[9px] font-bold uppercase tracking-widest opacity-60">Destino</label>
                      <div className="border border-[var(--border)] bg-[var(--bg-input)]/50 px-3 py-2 text-xs font-mono opacity-60">
                        {dispatchLocation?.name ?? 'ALMACEN STOCK DESPACHO'}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="font-mono text-[9px] font-bold uppercase tracking-widest opacity-60">Prendas * (solo con stock en reservas)</label>
                    <ReqCascadeSelector
                      products={productsWithReserveStock}
                      onAdd={newItems => setReqForm(f => ({ ...f, items: [...f.items, ...newItems] }))}
                    />
                    {reqForm.items.length > 0 && (
                      <div className="flex flex-col gap-1 mt-1">
                        <div className="grid grid-cols-12 gap-2 px-1 mb-0.5">
                          <span className="col-span-8 font-mono text-[8px] font-bold uppercase tracking-widest text-[var(--ink)]/40">PRODUCTO</span>
                          <span className="col-span-2 font-mono text-[8px] font-bold uppercase tracking-widest text-[var(--ink)]/40 text-center">CANT.</span>
                          <span className="col-span-2 font-mono text-[8px] font-bold uppercase tracking-widest text-[var(--ink)]/40 text-right"></span>
                        </div>
                        {reqForm.items.map((item, i) => {
                          const prod = products.find(p => p.id === item.productId);
                          return (
                            <div key={i} className="grid grid-cols-12 gap-2 items-center bg-[var(--surface)] border border-[var(--border)]/10 px-2 py-1.5 rounded-sm">
                              <div className="col-span-8 flex flex-col">
                                <span className="font-mono text-[10px] font-bold text-[var(--ink)] truncate">{prod?.name ?? '—'}</span>
                                <span className="font-mono text-[8px] text-[var(--ink)]/50 uppercase">{[prod?.color, prod?.size].filter(Boolean).join(' · ')}</span>
                              </div>
                              <div className="col-span-2 font-mono text-[10px] text-center font-bold">{item.quantity}</div>
                              <div className="col-span-2 text-right">
                                <button type="button" onClick={() => removeReqItem(i)} className="text-red-600 hover:opacity-70 p-1">
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="font-mono text-[9px] font-bold uppercase tracking-widest opacity-60">Notas</label>
                    <textarea value={reqForm.notes} onChange={e => setReqForm(f => ({ ...f, notes: e.target.value }))} rows={2}
                      className="border border-[var(--border)] bg-[var(--bg-input)] px-3 py-2 text-xs font-mono focus:outline-none resize-none" />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button type="submit" disabled={reqForm.items.length === 0}
                      className="flex-1 bg-[var(--ink)] text-[var(--ink-inv)] py-2 text-xs font-bold font-mono uppercase hover:shadow-[2px_2px_0_var(--border)] transition-all disabled:opacity-40">
                      CREAR REQUERIMIENTO
                    </button>
                    <button type="button" onClick={() => setShowReqModal(false)} className="flex-1 border border-[var(--border)] py-2 text-xs font-bold font-mono uppercase">CANCELAR</button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </>
      )}

      {/* OPERACIONES tab */}
      {mainTab === 'ops' && (
        <>
          <div className="grid grid-cols-2 gap-2 bg-[var(--bg-sidebar)] border border-[var(--border)] p-2 shadow-[4px_4px_0_var(--border)]">
            <OptButton
              icon={<ArrowRightLeft size={18} />}
              label="TRASLADO"
              desc="Mueve productos entre almacenes. El total del inventario no cambia."
              active={activeOpt === 'TRANSFER'}
              onClick={() => setActiveOpt('TRANSFER')}
            />
            <OptButton
              icon={<ArrowUpRight size={18} />}
              label="DESPACHO"
              desc="Registra salida de productos. Descuenta del inventario disponible."
              active={activeOpt === 'DISPATCH'}
              onClick={() => setActiveOpt('DISPATCH')}
            />
          </div>
          <div className="bg-[var(--bg-card)] border border-[var(--border)] p-6 lg:p-8 relative overflow-visible">
            <div className="absolute top-0 right-0 p-4 font-mono text-[100px] leading-none opacity-5 select-none pointer-events-none font-black">
              {activeOpt === 'DISPATCH' ? 'TX' : 'MV'}
            </div>
            <OperationForm key={activeOpt} type={activeOpt} />
          </div>
        </>
      )}

      {/* HISTORIAL tab */}
      {mainTab === 'log' && <TransactionLog />}

      {/* REPORTES tab */}
      {mainTab === 'reports' && (
        <div className="border border-[var(--border)] bg-[var(--surface-alt)] p-5 shadow-[3px_3px_0_var(--border)]">
          <OperationsReport mode="dispatch" />
        </div>
      )}

      {/* COMPROBANTES tab */}
      {mainTab === 'bulletins' && <BulletinsTab mode="dispatch" />}

      {/* ÓRDENES OC tab */}
      {mainTab === 'oc' && (<>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 border-b border-[var(--border)] pb-3">
          <div>
            <h2 className="font-mono font-black text-xs uppercase tracking-widest">09 // ÓRDENES_COMPRA</h2>
            <p className="font-mono text-[10px] opacity-70 uppercase tracking-wide mt-1">Gestión de órdenes a proveedores externos.</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)}
              className="border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[10px] font-mono font-bold uppercase focus:outline-none cursor-pointer">
              <option value="ALL">TODOS</option>
              {(Object.keys(STATUS_LABEL_OC) as PurchaseOrderStatus[]).map(s => <option key={s} value={s}>{STATUS_LABEL_OC[s]}</option>)}
            </select>
            {isAdmin && (
              <button onClick={openAdd} className="flex items-center gap-2 bg-[var(--ink)] text-[var(--ink-inv)] px-4 py-2 text-xs font-bold font-mono uppercase hover:shadow-[3px_3px_0_var(--border)] transition-all border border-[var(--border)]">
                <Plus size={14} /> NUEVA OC
              </button>
            )}
          </div>
        </div>

        {filteredOC.length === 0 && (
          <div className="text-center font-mono text-xs opacity-50 py-16 uppercase tracking-widest">Sin órdenes de compra</div>
        )}

        <div className="flex flex-col gap-3">
          {filteredOC.map(po => {
            const supplier = contacts.find(c => c.id === po.supplierId);
            const isExpanded = expanded === po.id;
            return (
              <div key={po.id} className="border border-[var(--border)] bg-[var(--bg-card)]">
                <div className="flex items-center justify-between gap-4 p-4 cursor-pointer" onClick={() => setExpanded(isExpanded ? null : po.id)}>
                  <div className="flex items-center gap-4 min-w-0 flex-wrap">
                    <span className={`font-mono text-[9px] font-bold border px-2 py-0.5 shrink-0 ${STATUS_STYLE[po.status]}`}>{STATUS_LABEL_OC[po.status]}</span>
                    <span className="font-mono font-bold text-sm text-[var(--ink)] shrink-0">{po.reference}</span>
                    <span className="font-mono text-xs opacity-70 shrink-0">{supplier?.name || 'Proveedor desconocido'}</span>
                    <span className="font-mono text-[10px] opacity-50">{fmtLima(po.date, { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-mono font-bold text-xs hidden sm:block">S/ {totalValue(po).toFixed(2)}</span>
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </div>
                {isExpanded && (
                  <div className="border-t border-[var(--border)] p-4 flex flex-col gap-4">
                    <div className="overflow-x-auto">
                      <table className="w-full text-[10px] font-mono border-collapse">
                        <thead>
                          <tr className="border-b border-[var(--border)]">
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
                              <tr key={i} className="border-b border-[var(--border)]/20">
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
                          <tr className="border-t border-[var(--border)]">
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
                          <button onClick={() => setConfirmDelete(po.id)} className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold font-mono uppercase border border-[var(--border)]/30 hover:border-red-600 hover:text-red-600 transition-colors ml-auto">
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

        {showModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-[var(--bg)] border border-[var(--border)] shadow-[4px_4px_0_var(--border)] w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="border-b border-[var(--border)] px-5 py-3 flex justify-between items-center sticky top-0 bg-[var(--bg)]">
                <span className="font-mono font-bold text-xs uppercase tracking-widest">NUEVA ORDEN DE COMPRA</span>
                <button onClick={() => setShowModal(false)} className="font-mono text-xs opacity-60 hover:opacity-100">✕</button>
              </div>
              <form onSubmit={handleSubmitOC} className="p-5 flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="font-mono text-[9px] font-bold uppercase tracking-widest opacity-60">Referencia *</label>
                    <input value={form.reference} onChange={e => setForm(f => ({ ...f, reference: e.target.value }))}
                      className="border border-[var(--border)] bg-[var(--bg-input)] px-3 py-2 text-xs font-mono focus:outline-none" required />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="font-mono text-[9px] font-bold uppercase tracking-widest opacity-60">Proveedor *</label>
                    <select value={form.supplierId} onChange={e => setForm(f => ({ ...f, supplierId: e.target.value }))}
                      className="border border-[var(--border)] bg-[var(--bg-input)] px-3 py-2 text-xs font-mono focus:outline-none cursor-pointer" required>
                      <option value="">Seleccionar...</option>
                      {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-mono text-[9px] font-bold uppercase tracking-widest opacity-60">Ubicación destino</label>
                  <select value={form.locationId} onChange={e => setForm(f => ({ ...f, locationId: e.target.value }))}
                    className="border border-[var(--border)] bg-[var(--bg-input)] px-3 py-2 text-xs font-mono focus:outline-none cursor-pointer">
                    <option value="">Sin asignar</option>
                    {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="font-mono text-[9px] font-bold uppercase tracking-widest opacity-60">Ítems *</label>
                  <POCascadeSelector
                    products={products}
                    onAdd={newItems => setForm(f => ({ ...f, items: [...f.items.filter(i => i.productId), ...newItems] }))}
                  />
                  {form.items.filter(i => i.productId).length > 0 && (
                    <div className="flex flex-col gap-1 mt-1">
                      <div className="grid grid-cols-12 gap-2 px-1 mb-0.5">
                        {['PRODUCTO', 'CANT.', 'COSTO U.', ''].map(h => (
                          <span key={h} className={`font-mono text-[8px] font-bold uppercase tracking-widest text-[var(--ink)]/40 ${h === 'PRODUCTO' ? 'col-span-5' : h === '' ? 'col-span-2 text-right' : 'col-span-2 text-center'}`}>{h}</span>
                        ))}
                      </div>
                      {form.items.map((item, i) => {
                        if (!item.productId) return null;
                        const prod = products.find(p => p.id === item.productId);
                        return (
                          <div key={i} className="grid grid-cols-12 gap-2 items-center bg-[var(--surface)] border border-[var(--border)]/10 px-2 py-1.5 rounded-sm">
                            <div className="col-span-5 flex flex-col">
                              <span className="font-mono text-[10px] font-bold text-[var(--ink)] truncate">{prod?.name ?? '—'}</span>
                              <span className="font-mono text-[8px] text-[var(--ink)]/50 uppercase">{[prod?.color, prod?.size].filter(Boolean).join(' · ')}</span>
                            </div>
                            <div className="col-span-2">
                              <input type="number" min="1" value={item.quantity}
                                onChange={e => updateItem(i, 'quantity', parseInt(e.target.value) || 1)}
                                className="w-full border border-[var(--border)]/20 bg-[var(--bg-input)] px-2 py-1 text-[10px] font-mono focus:outline-none text-center" />
                            </div>
                            <div className="col-span-3">
                              <input type="number" min="0" step="0.01" value={item.unitCost}
                                onChange={e => updateItem(i, 'unitCost', parseFloat(e.target.value) || 0)}
                                className="w-full border border-[var(--border)]/20 bg-[var(--bg-input)] px-2 py-1 text-[10px] font-mono focus:outline-none" />
                            </div>
                            <div className="col-span-2 text-right">
                              <button type="button" onClick={() => removeItem(i)} className="text-red-600 hover:opacity-70 p-1">
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-mono text-[9px] font-bold uppercase tracking-widest opacity-60">Notas</label>
                  <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2}
                    className="border border-[var(--border)] bg-[var(--bg-input)] px-3 py-2 text-xs font-mono focus:outline-none resize-none" />
                </div>
                <div className="flex gap-2 pt-2">
                  <button type="submit" className="flex-1 bg-[var(--ink)] text-[var(--ink-inv)] py-2 text-xs font-bold font-mono uppercase hover:shadow-[2px_2px_0_var(--border)] transition-all">CREAR OC</button>
                  <button type="button" onClick={() => setShowModal(false)} className="flex-1 border border-[var(--border)] py-2 text-xs font-bold font-mono uppercase">CANCELAR</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {receiveModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-[var(--bg)] border border-[var(--border)] shadow-[4px_4px_0_var(--border)] w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="border-b border-[var(--border)] px-5 py-3 flex justify-between items-center">
                <span className="font-mono font-bold text-xs uppercase tracking-widest">RECIBIR — {receiveModal.reference}</span>
                <button onClick={() => setReceiveModal(null)} className="font-mono text-xs opacity-60 hover:opacity-100">✕</button>
              </div>
              <div className="p-5 flex flex-col gap-4">
                {receiveModal.items.map((item, i) => {
                  const prod = products.find(p => p.id === item.productId);
                  const pending = item.quantity - item.receivedQuantity;
                  return (
                    <div key={i} className="flex items-center justify-between gap-4 border-b border-[var(--border)]/20 pb-3">
                      <div className="min-w-0">
                        <div className="font-mono text-xs font-bold truncate">{prod?.code} {prod?.name} {prod?.color} {prod?.size}</div>
                        <div className="font-mono text-[10px] opacity-60">Pendiente: {pending} / {item.quantity}</div>
                      </div>
                      <input type="number" min="0" max={pending} value={receiveQtys[i] ?? pending}
                        onChange={e => setReceiveQtys(q => ({ ...q, [i]: Math.min(pending, parseInt(e.target.value) || 0) }))}
                        className="w-20 border border-[var(--border)] bg-[var(--bg-input)] px-2 py-1 text-xs font-mono text-center focus:outline-none" />
                    </div>
                  );
                })}
                {receiveError && <p className="font-mono text-[10px] text-red-600 font-bold">{receiveError}</p>}
                <div className="flex gap-2 pt-2">
                  <button onClick={confirmReceive} disabled={receiving} className="flex-1 bg-[var(--ink)] text-[var(--ink-inv)] py-2 text-xs font-bold font-mono uppercase disabled:opacity-50">
                    {receiving ? 'REGISTRANDO...' : 'CONFIRMAR RECEPCIÓN'}
                  </button>
                  <button onClick={() => setReceiveModal(null)} disabled={receiving} className="flex-1 border border-[var(--border)] py-2 text-xs font-bold font-mono uppercase disabled:opacity-50">CANCELAR</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {confirmDelete && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-[var(--bg)] border border-[var(--border)] shadow-[4px_4px_0_var(--border)] p-6 max-w-sm w-full">
              <p className="font-mono text-xs font-bold mb-4">¿Eliminar esta orden?</p>
              <div className="flex gap-2">
                <button onClick={() => { deletePurchaseOrder(confirmDelete!); setConfirmDelete(null); }} className="flex-1 bg-red-600 text-white py-2 text-xs font-bold font-mono uppercase">ELIMINAR</button>
                <button onClick={() => setConfirmDelete(null)} className="flex-1 border border-[var(--border)] py-2 text-xs font-bold font-mono uppercase">CANCELAR</button>
              </div>
            </div>
          </div>
        )}
      </>)}

      {/* Modal despachar requerimiento (fuera del tab OC) */}
      {receiveModal && mainTab === 'req' && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--bg)] border border-[var(--border)] shadow-[4px_4px_0_var(--border)] w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="border-b border-[var(--border)] px-5 py-3 flex justify-between items-center">
              <span className="font-mono font-bold text-xs uppercase tracking-widest">DESPACHAR — {receiveModal.reference}</span>
              <button onClick={() => setReceiveModal(null)} className="font-mono text-xs opacity-60 hover:opacity-100">✕</button>
            </div>
            <div className="p-5 flex flex-col gap-4">
              {receiveModal.items.map((item, i) => {
                const prod = products.find(p => p.id === item.productId);
                const pending = item.quantity - item.receivedQuantity;
                return (
                  <div key={i} className="flex items-center justify-between gap-4 border-b border-[var(--border)]/20 pb-3">
                    <div className="min-w-0">
                      <div className="font-mono text-xs font-bold truncate">{prod?.code} {prod?.name} {prod?.color} {prod?.size}</div>
                      <div className="font-mono text-[10px] opacity-60">Pendiente: {pending} / {item.quantity}</div>
                    </div>
                    <input type="number" min="0" max={pending} value={receiveQtys[i] ?? pending}
                      onChange={e => setReceiveQtys(q => ({ ...q, [i]: Math.min(pending, parseInt(e.target.value) || 0) }))}
                      className="w-20 border border-[var(--border)] bg-[var(--bg-input)] px-2 py-1 text-xs font-mono text-center focus:outline-none" />
                  </div>
                );
              })}
              {receiveError && <p className="font-mono text-[10px] text-red-600 font-bold">{receiveError}</p>}
              <div className="flex gap-2 pt-2">
                <button onClick={confirmReceive} disabled={receiving} className="flex-1 bg-[var(--ink)] text-[var(--ink-inv)] py-2 text-xs font-bold font-mono uppercase disabled:opacity-50">
                  {receiving ? 'DESPACHANDO...' : 'CONFIRMAR DESPACHO'}
                </button>
                <button onClick={() => setReceiveModal(null)} disabled={receiving} className="flex-1 border border-[var(--border)] py-2 text-xs font-bold font-mono uppercase disabled:opacity-50">CANCELAR</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && mainTab === 'req' && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--bg)] border border-[var(--border)] shadow-[4px_4px_0_var(--border)] p-6 max-w-sm w-full">
            <p className="font-mono text-xs font-bold mb-4">¿Eliminar este requerimiento?</p>
            <div className="flex gap-2">
              <button onClick={() => { deletePurchaseOrder(confirmDelete!); setConfirmDelete(null); }} className="flex-1 bg-red-600 text-white py-2 text-xs font-bold font-mono uppercase">ELIMINAR</button>
              <button onClick={() => setConfirmDelete(null)} className="flex-1 border border-[var(--border)] py-2 text-xs font-bold font-mono uppercase">CANCELAR</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const OptButton = ({ icon, label, desc, active, onClick }: { icon: React.ReactNode; label: string; desc: string; active: boolean; onClick: () => void }) => (
  <button
    onClick={onClick}
    className={cn(
      'flex flex-col items-center gap-1.5 p-3 lg:p-4 border transition-all text-center',
      active ? 'border-[var(--ink)] bg-[var(--ink)] text-[var(--ink-inv)] shadow-[3px_3px_0_var(--border)]' : 'border-[var(--border)] hover:border-[var(--ink)]/40 hover:bg-[var(--surface)]'
    )}
  >
    <span className={cn('transition-colors', active ? 'text-[var(--ink-inv)]' : 'text-[var(--ink)] opacity-60')}>{icon}</span>
    <span className="font-mono text-[10px] font-black uppercase tracking-widest">{label}</span>
    <span className={cn('font-mono text-[8px] leading-tight', active ? 'opacity-70' : 'opacity-40')}>{desc}</span>
  </button>
);

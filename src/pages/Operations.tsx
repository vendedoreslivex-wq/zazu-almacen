import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useAppContext } from '../store/AppContext';
import { ModuleInfo } from '../components/ModuleInfo';
import {
  ArrowDownLeft, ArrowUpRight, ArrowRightLeft, AlertTriangle, X,
  Printer, CheckCircle, ScanLine, Pencil, Trash2, Camera, Plus, Minus, Filter,
} from 'lucide-react';
import { cn } from '../lib/utils';
import SignaturePad from 'signature_pad';
import { TransactionType, Transaction } from '../types';
import { sendOperationEmail, sendOperationToInternalRecipients, OperationType, OperationItem } from '../lib/emailService';
import { BrowserQRCodeReader } from '@zxing/browser';
import type { IScannerControls } from '@zxing/browser';
import { supabase } from '../lib/supabase';

// ─── Types ─────────────────────────────────────────────────────────────────────

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

// ─── Constants ─────────────────────────────────────────────────────────────────

const TX_BADGE: Record<TransactionType, { label: string; cls: string }> = {
  RECEPTION: { label: 'RX', cls: 'text-green-700 bg-green-50 border-green-400' },
  DISPATCH:  { label: 'TX', cls: 'text-red-700 bg-red-50 border-red-400' },
  TRANSFER:  { label: 'MV', cls: 'text-blue-700 bg-blue-50 border-blue-400' },
};

const GUIDE_PREFIX: Record<TransactionType, string> = {
  RECEPTION: 'RE',
  DISPATCH:  'DE',
  TRANSFER:  'TR',
};

const BRAND_ICON: Record<string, string> = {
  OVERSHARK: '/img-icono/Img-barra/over-icon.png',
  BRAVOS:    '/img-icono/Img-barra/brav-icon.png',
  BOX_PRIME: '/img-icono/Img-barra/box.icon.png',
};

const BRAND_NAME: Record<string, string> = {
  OVERSHARK: 'OVERSHARK',
  BRAVOS:    'BRAVOS URBAN',
  BOX_PRIME: 'BOX PRIME',
};

const TYPE_META: Record<TransactionType, { label: string; accentColor: string; bgColor: string; icon: string }> = {
  RECEPTION: { label: 'RECEPCIÓN', accentColor: '#15803d', bgColor: '#f0fdf4', icon: '↓' },
  DISPATCH:  { label: 'DESPACHO',  accentColor: '#b91c1c', bgColor: '#fef2f2', icon: '↑' },
  TRANSFER:  { label: 'TRASLADO',  accentColor: '#0369a1', bgColor: '#eff6ff', icon: '⇄' },
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

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

// ─── CascadeProductSelector ────────────────────────────────────────────────────

interface CascadeProps {
  products: { id: string; name: string; code: string; color?: string; size?: string; category: string }[];
  value: string;
  onChange: (id: string) => void;
  error?: string;
  onScanClick?: () => void;
}

const CascadeProductSelector: React.FC<CascadeProps> = ({ products, value, onChange, error, onScanClick }) => {
  const init = useMemo(() => products.find(p => p.id === value), []);
  const [baseName, setBaseName] = useState(init?.name ?? '');
  const [color, setColor] = useState(init?.color ?? '');
  const [size, setSize] = useState(init?.size ?? '');

  // Sync when value changes externally (QR scan remounts component via key)
  const prevValue = useRef(value);
  useEffect(() => {
    if (value !== prevValue.current && value) {
      const p = products.find(pr => pr.id === value);
      if (p) { setBaseName(p.name); setColor(p.color ?? ''); setSize(p.size ?? ''); }
    }
    prevValue.current = value;
  }, [value, products]);

  const uniqueNames = useMemo(() => [...new Set(products.map(p => p.name))].sort(), [products]);
  const byName = useMemo(() => products.filter(p => p.name === baseName), [products, baseName]);
  const colors = useMemo(() => [...new Set(byName.filter(p => p.color).map(p => p.color!))].sort(), [byName]);
  const byNameColor = useMemo(() => byName.filter(p => !colors.length || p.color === color), [byName, colors, color]);
  const sizes = useMemo(() => [...new Set(byNameColor.filter(p => p.size).map(p => p.size!))].sort(), [byNameColor]);

  const resolveId = (name: string, col: string, sz: string): string => {
    const byN = products.filter(p => p.name === name);
    const cols = [...new Set(byN.filter(p => p.color).map(p => p.color!))];
    const byNC = byN.filter(p => !cols.length || p.color === col);
    const szs = [...new Set(byNC.filter(p => p.size).map(p => p.size!))];
    if (!name) return '';
    if (cols.length > 0 && !col) return '';
    if (szs.length > 0 && !sz) return '';
    return products.find(p =>
      p.name === name &&
      (!cols.length || p.color === col) &&
      (!szs.length || p.size === sz)
    )?.id ?? '';
  };

  const handleName = (name: string) => {
    setBaseName(name); setColor(''); setSize('');
    onChange(resolveId(name, '', ''));
  };
  const handleColor = (col: string) => {
    setColor(col); setSize('');
    onChange(resolveId(baseName, col, ''));
  };
  const handleSize = (sz: string) => {
    setSize(sz);
    onChange(resolveId(baseName, color, sz));
  };

  const resolved = products.find(p => p.id === value);
  const hasError = !!error && !value;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex gap-2">
        <select
          value={baseName}
          onChange={e => handleName(e.target.value)}
          className={cn('input-technical flex-1 text-[11px]', hasError && 'border-red-600 bg-red-50')}
        >
          <option value="">Seleccione producto...</option>
          {uniqueNames.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        {onScanClick && (
          <button
            type="button"
            onClick={onScanClick}
            title="Escanear QR"
            className="shrink-0 border border-[#141414] bg-white/70 hover:bg-[#141414] hover:text-[#E4E3E0] transition-all px-3 flex items-center justify-center"
          >
            <ScanLine size={15} />
          </button>
        )}
      </div>

      {baseName && colors.length > 0 && (
        <select
          value={color}
          onChange={e => handleColor(e.target.value)}
          className={cn('input-technical text-[11px]', hasError && !color && 'border-red-600 bg-red-50')}
        >
          <option value="">Color / Variante...</option>
          {colors.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      )}

      {baseName && sizes.length > 0 && (colors.length === 0 || color) && (
        <select
          value={size}
          onChange={e => handleSize(e.target.value)}
          className={cn('input-technical text-[11px]', hasError && !size && 'border-red-600 bg-red-50')}
        >
          <option value="">Talla / Tamaño...</option>
          {sizes.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      )}

      {resolved && (
        <div className="flex items-center gap-1.5 font-mono text-[9px] text-green-700 font-bold tracking-wider">
          <CheckCircle size={9} /> SKU: {resolved.code}
        </div>
      )}

      {hasError && (
        <span className="font-mono text-[9px] font-bold text-red-700 uppercase border border-red-700 px-1 py-0.5 bg-red-100 w-fit tracking-wider">
          {error}
        </span>
      )}
    </div>
  );
};

// ─── Main Page ─────────────────────────────────────────────────────────────────

export const Operations: React.FC = () => {
  const [activeOpt, setActiveOpt] = useState<TransactionType>('RECEPTION');

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-6 pb-8">
      <ModuleInfo
        number="05"
        title="Operaciones"
        description="Registro de movimientos de stock: entradas, salidas y transferencias. Soporta múltiples productos por operación."
      />

      <div className="grid grid-cols-3 gap-2 bg-[#D4D3D0] border border-[#141414] p-2 shadow-[4px_4px_0_#141414]">
        <OptButton icon={<ArrowDownLeft size={18} />} label="RECEPCIÓN" active={activeOpt === 'RECEPTION'} onClick={() => setActiveOpt('RECEPTION')} />
        <OptButton icon={<ArrowUpRight size={18} />} label="DESPACHO" active={activeOpt === 'DISPATCH'} onClick={() => setActiveOpt('DISPATCH')} />
        <OptButton icon={<ArrowRightLeft size={18} />} label="TRANSLADO" active={activeOpt === 'TRANSFER'} onClick={() => setActiveOpt('TRANSFER')} />
      </div>

      <div className="bg-white/40 border border-[#141414] p-6 lg:p-8 relative overflow-visible">
        <div className="absolute top-0 right-0 p-4 font-mono text-[100px] leading-none opacity-5 select-none pointer-events-none font-black">
          {activeOpt === 'RECEPTION' ? 'RX' : activeOpt === 'DISPATCH' ? 'TX' : 'MV'}
        </div>
        <OperationForm key={activeOpt} type={activeOpt} />
      </div>

      <RecentTransactions />
    </div>
  );
};

// ─── OptButton ─────────────────────────────────────────────────────────────────

const OptButton = ({ icon, label, active, onClick }: any) => (
  <button
    onClick={onClick}
    className={cn(
      'flex flex-col items-center justify-center gap-2 p-3 lg:p-4 border border-[#141414] transition-all',
      active ? 'bg-[#141414] text-[#E4E3E0] shadow-[inset_2px_2px_0_rgba(0,0,0,0.5)]' : 'bg-white/50 hover:bg-[#141414] hover:text-[#E4E3E0]'
    )}
  >
    <div className={cn(active ? '' : 'opacity-70')}>{icon}</div>
    <span className={cn('font-mono text-[9px] lg:text-[10px] tracking-widest font-bold uppercase', active ? '' : 'opacity-70')}>{label}</span>
  </button>
);

// ─── FormGroup ─────────────────────────────────────────────────────────────────

const FormGroup: React.FC<{ label: string; error?: string; children: React.ReactNode; className?: string }> = ({ label, error, children, className }) => (
  <div className={cn('flex flex-col gap-1.5', className)}>
    <label className={cn('font-mono text-[9px] font-bold tracking-[0.2em] uppercase', error ? 'text-red-700 opacity-100' : 'opacity-80')}>{label}</label>
    {children}
    {error && <span className="font-mono text-[9px] font-bold text-red-700 uppercase mt-0.5 border border-red-700 px-1 py-0.5 bg-red-100 w-fit shrink-0 tracking-wider">{error}</span>}
  </div>
);

const PreviewRow = ({ label, value }: { label: string; value: string }) => (
  <tr className="border-b border-[#141414]/15">
    <td className="py-1.5 pr-3 font-bold uppercase opacity-50 text-[9px] tracking-widest">{label}</td>
    <td className="py-1.5 pl-3 font-bold uppercase text-right">{value}</td>
  </tr>
);

// ─── OperationForm ─────────────────────────────────────────────────────────────

const OperationForm: React.FC<{ type: TransactionType }> = ({ type }) => {
  const { products, locations, addTransaction, stockLevels, activeBrand, contacts, currentUser, users } = useAppContext();

  const [lineItems, setLineItems] = useState<LineItem[]>([{ key: '0', productId: '', qty: '' }]);
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

  const addLineItem = () =>
    setLineItems(prev => [...prev, { key: String(Date.now()), productId: '', qty: '' }]);

  const removeLineItem = (key: string) =>
    setLineItems(prev => prev.filter(l => l.key !== key));

  const updateLineItemProduct = (key: string, productId: string) =>
    setLineItems(prev => prev.map(l => l.key === key ? { ...l, productId } : l));

  const updateLineItemQty = (key: string, qty: string) =>
    setLineItems(prev => prev.map(l => l.key === key ? { ...l, qty } : l));

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

    for (const item of lineItems) {
      const errs: { productId?: string; qty?: string } = {};
      if (!item.productId) {
        errs.productId = 'SELECCIONE_PRODUCTO';
      }
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
          signature: sigData,
          serialNumber: activeBrand === 'BOX_PRIME' ? serialNumber || undefined : undefined,
        });
        const product = products.find(p => p.id === item.productId);
        guideItems.push({
          productName: product?.name ?? item.productId,
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
    setLineItems([{ key: String(Date.now()), productId: '', qty: '' }]);
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

    // Email payload
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
      setFeedback({ type: 'success', message: '¡OPERACIÓN REGISTRADA! ENVIANDO COMPROBANTE...' });
      sendOperationEmail({ toEmail: operatorEmail, toName: currentUser.username, ...emailPayload })
        .then(() => setFeedback({ type: 'success', message: `¡REGISTRADA! COMPROBANTE → ${operatorEmail}` }))
        .catch(() => setFeedback({ type: 'success', message: '¡OPERACIÓN REGISTRADA! (SIN EMAIL — REVISA CONFIGURACIÓN)' }));
    } else {
      setFeedback({ type: 'success', message: '¡OPERACIÓN REGISTRADA CORRECTAMENTE!' });
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
          feedback.type === 'success' ? 'bg-green-100 border-green-700 text-green-800' : 'bg-red-100 border-red-700 text-red-800'
        )}>
          {feedback.message}
        </div>
      )}

      <div className="border-b border-[#141414] pb-3 hidden md:block">
        <h3 className="font-serif italic font-bold text-xs uppercase tracking-widest">
          {type === 'RECEPTION' ? '01 // NUEVA RECEPCIÓN DE INVENTARIO' : type === 'DISPATCH' ? '01 // DESPACHO DE MATERIALES' : '01 // TRANSLADO INTERNO ZONAS'}
        </h3>
        <p className="opacity-60 text-[10px] font-mono mt-1 uppercase tracking-widest font-bold">
          SISTEMA_DE_REGISTRO_ACTIVO // {type}
        </p>
      </div>

      {/* ── LINE ITEMS ── */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <label className="font-mono text-[9px] font-bold tracking-[0.2em] uppercase opacity-80">
            PRODUCTOS EN OPERACIÓN
          </label>
          <button
            type="button"
            onClick={addLineItem}
            className="flex items-center gap-1.5 font-mono text-[9px] font-bold uppercase border border-[#141414] px-2.5 py-1.5 hover:bg-[#141414] hover:text-[#E4E3E0] transition-all"
          >
            <Plus size={10} /> AGREGAR LÍNEA
          </button>
        </div>

        {lineItems.map((item, idx) => {
          const availStock = (type === 'DISPATCH' || type === 'TRANSFER') && item.productId && fromLocation
            ? stockLevels.filter(s => s.productId === item.productId && s.locationId === fromLocation).reduce((sum, s) => sum + s.quantity, 0)
            : null;
          const itemErr = lineErrors[item.key];

          return (
            <div key={item.key} className={cn(
              'border p-3 flex flex-col gap-2.5',
              itemErr ? 'border-red-300 bg-red-50/30' : 'border-[#141414]/20 bg-white/40'
            )}>
              <div className="flex items-center justify-between">
                <span className="font-mono text-[8px] opacity-40 uppercase tracking-widest font-bold">
                  LÍNEA {idx + 1}
                </span>
                {lineItems.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeLineItem(item.key)}
                    className="text-red-500 hover:text-red-700 p-0.5 transition-colors"
                  >
                    <Minus size={12} />
                  </button>
                )}
              </div>

              <CascadeProductSelector
                key={item.key}
                products={products}
                value={item.productId}
                onChange={id => updateLineItemProduct(item.key, id)}
                error={itemErr?.productId}
                onScanClick={() => setScanningForKey(item.key)}
              />

              <div className="flex gap-2 items-start">
                <div className="flex flex-col gap-1 flex-1">
                  <label className="font-mono text-[8px] opacity-60 uppercase tracking-widest font-bold">CANTIDAD</label>
                  <input
                    type="number"
                    min="1"
                    value={item.qty}
                    onChange={e => { updateLineItemQty(item.key, e.target.value); setLineErrors(prev => ({ ...prev, [item.key]: { ...prev[item.key], qty: undefined } })); }}
                    className={cn('input-technical font-mono text-base', itemErr?.qty && 'border-red-600 bg-red-50')}
                    placeholder="0"
                  />
                  {itemErr?.qty && (
                    <span className="font-mono text-[9px] font-bold text-red-700 uppercase border border-red-700 px-1 py-0.5 bg-red-100 w-fit tracking-wider">
                      {itemErr.qty}
                    </span>
                  )}
                </div>
                {availStock !== null && (
                  <div className="shrink-0 pt-5 font-mono text-[9px] text-green-700 font-bold tracking-wider whitespace-nowrap">
                    DISP: {availStock}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── LOCATIONS ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(type === 'DISPATCH' || type === 'TRANSFER') && (
          <FormGroup label="UBICACIÓN ORIGEN" error={errors.fromLocation}>
            <select
              value={fromLocation}
              onChange={e => { setFromLocation(e.target.value); if (type === 'TRANSFER' && e.target.value === toLocation) setToLocation(''); setErrors(prev => ({ ...prev, fromLocation: '' })); }}
              className={cn('input-technical', errors.fromLocation && 'border-red-600 bg-red-50')}
            >
              <option value="">Seleccione Origen...</option>
              {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </FormGroup>
        )}

        {(type === 'RECEPTION' || type === 'TRANSFER') && (
          <FormGroup label="UBICACIÓN DESTINO" error={errors.toLocation}>
            <select
              value={toLocation}
              onChange={e => { setToLocation(e.target.value); setErrors(prev => ({ ...prev, toLocation: '' })); }}
              className={cn('input-technical', errors.toLocation && 'border-red-600 bg-red-50')}
            >
              <option value="">Seleccione Destino...</option>
              {locations.map(l => (
                <option key={l.id} value={l.id} disabled={type === 'TRANSFER' && l.id === fromLocation}>{l.name}</option>
              ))}
            </select>
            {toLocation && (() => {
              const items = stockLevels.filter(s => s.locationId === toLocation && s.quantity > 0);
              return items.length > 0 ? (
                <div className="text-[9px] font-mono border border-[#141414]/10 bg-white/30 p-2 mt-1 max-h-28 overflow-y-auto">
                  <span className="opacity-60 uppercase tracking-widest font-bold mb-1 block">EN DESTINO:</span>
                  {items.map((s, i) => (
                    <div key={i} className="flex justify-between items-center border-b border-[#141414]/5 last:border-0 py-0.5">
                      <span className="font-bold truncate pr-2">{products.find(p => p.id === s.productId)?.name ?? '—'}</span>
                      <span className="bg-[#141414] text-[#E4E3E0] px-1.5 py-0.5">{s.quantity}</span>
                    </div>
                  ))}
                </div>
              ) : null;
            })()}
          </FormGroup>
        )}

        {/* ── REFERENCE ── */}
        <FormGroup label="REFERENCIA / GUÍA" error={errors.reference} className={type === 'TRANSFER' ? 'md:col-span-2' : ''}>
          <input
            type="text"
            value={reference}
            onChange={e => { setReference(e.target.value); setErrors(prev => ({ ...prev, reference: '' })); }}
            className={cn('input-technical', errors.reference && 'border-red-600 bg-red-50')}
            placeholder="EJ: GR-20914"
          />
        </FormGroup>

        {/* ── CONTACT ── */}
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
                  ✉ {c.email}
                </div>
              ) : null;
            })()}
          </FormGroup>
        )}
      </div>

      {/* ── SERIAL + PHOTO ROW ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {activeBrand === 'BOX_PRIME' && (
          <FormGroup label="NÚMERO DE SERIE / LOTE">
            <input
              type="text"
              value={serialNumber}
              onChange={e => setSerialNumber(e.target.value)}
              className="input-technical"
              placeholder="EJ: L-202305-A1"
            />
          </FormGroup>
        )}

        {/* ── PHOTO ── */}
        <FormGroup label="EVIDENCIA FOTOGRÁFICA" className={activeBrand !== 'BOX_PRIME' ? 'md:col-span-2' : ''}>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              className="flex items-center gap-2 border border-[#141414] bg-white/70 hover:bg-[#141414] hover:text-[#E4E3E0] transition-all px-3 py-2 font-mono text-[10px] font-bold uppercase"
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
            <div className="mt-2 border border-[#141414]/20 bg-white/40 p-1 w-fit">
              <img src={photo} alt="evidencia" className="max-h-28 max-w-full object-contain" />
            </div>
          ) : (
            <span className="font-mono text-[9px] opacity-40 uppercase tracking-wide mt-1">
              Opcional — se incluirá en guía y comprobante
            </span>
          )}
        </FormGroup>
      </div>

      {/* ── SIGNATURE ── */}
      {(type === 'RECEPTION' || type === 'DISPATCH') && (
        <FormGroup label="FIRMA DIGITAL" error={errors.signature}>
          <div className={cn(
            'border border-[#141414] bg-white relative w-full h-32 overflow-hidden',
            errors.signature && 'border-red-600 shadow-[2px_2px_0_#dc2626]'
          )}>
            <canvas
              ref={canvasRef}
              className="w-full h-full cursor-crosshair"
            />
            <button
              type="button"
              onClick={() => padRef.current?.clear()}
              className="absolute top-2 right-2 text-[9px] font-mono font-bold tracking-widest bg-[#141414] text-white px-2 py-1 opacity-70 hover:opacity-100"
            >
              BORRAR
            </button>
          </div>
          <span className="text-[9px] font-mono opacity-50 uppercase mt-1">
            {type === 'RECEPTION' ? 'Firma de conformidad de recepción' : 'Firma de conformidad de despacho'}
          </span>
        </FormGroup>
      )}

      <div className="flex justify-between items-center mt-2">
        <div className="font-mono text-[9px] opacity-40 uppercase tracking-widest">
          {lineItems.length} {lineItems.length === 1 ? 'PRODUCTO' : 'PRODUCTOS'} · {lineItems.filter(l => l.productId).length} SELECCIONADOS
        </div>
        <button
          type="button"
          onClick={handleSubmit}
          className="bg-[#141414] border border-[#141414] hover:bg-white hover:text-[#141414] text-[#E4E3E0] px-8 py-3 text-[11px] font-mono tracking-widest font-bold transition-all shadow-[4px_4px_0_#141414] active:shadow-none active:translate-y-[4px] active:translate-x-[4px]"
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
          <div className="bg-[#E4E3E0] border-2 border-[#141414] shadow-[6px_6px_0_#141414] w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="bg-[#141414] text-[#E4E3E0] px-5 py-3 flex justify-between items-center">
              <div>
                <div className="font-mono text-[9px] opacity-50 uppercase tracking-widest">CONFIRMAR OPERACIÓN</div>
                <div className="font-mono font-black text-sm uppercase tracking-widest">{TYPE_META[type].label}</div>
              </div>
              <button onClick={() => setShowPreview(false)} className="font-mono text-xs opacity-60 hover:opacity-100">✕</button>
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
              <div className="border border-[#141414]">
                <div className="bg-[#141414] text-[#E4E3E0] px-3 py-1.5 font-mono text-[9px] font-bold uppercase tracking-widest">PRODUCTOS</div>
                {lineItems.filter(l => l.productId).map((item, i) => {
                  const prod = products.find(p => p.id === item.productId);
                  return (
                    <div key={item.key} className={`flex justify-between items-center px-3 py-2 font-mono text-[10px] ${i % 2 === 0 ? 'bg-white/50' : ''}`}>
                      <div>
                        <span className="font-bold">{prod?.code}</span>
                        <span className="opacity-60 ml-2">{prod?.name} {prod?.color} {prod?.size}</span>
                      </div>
                      <span className="font-black text-sm ml-4">{item.qty} uds</span>
                    </div>
                  );
                })}
                <div className="flex justify-between px-3 py-2 bg-[#D4D3D0] border-t border-[#141414] font-mono text-[10px] font-bold">
                  <span>TOTAL</span>
                  <span>{lineItems.reduce((s, l) => s + (parseInt(l.qty, 10) || 0), 0)} uds</span>
                </div>
              </div>
              {pendingSig && (
                <div>
                  <div className="font-mono text-[9px] opacity-50 uppercase tracking-widest mb-1">FIRMA</div>
                  <img src={pendingSig} alt="Firma" className="max-w-[160px] max-h-[60px] border border-[#141414] bg-white p-1" />
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <button onClick={confirmPreview} className="flex-1 bg-[#141414] text-[#E4E3E0] py-2.5 text-xs font-bold font-mono uppercase hover:shadow-[2px_2px_0_#9f9d99] transition-all">
                  CONFIRMAR Y REGISTRAR
                </button>
                <button onClick={() => setShowPreview(false)} className="flex-1 border border-[#141414] py-2.5 text-xs font-bold font-mono uppercase hover:bg-white/50">
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
            // Replace the item with a new key so CascadeProductSelector remounts with the scanned product
            setLineItems(prev => prev.map(l =>
              l.key === scanningForKey
                ? { key: `${l.key}_qr_${Date.now()}`, productId: id, qty: l.qty }
                : l
            ));
            setScanningForKey(null);
          }}
        />
      )}
    </form>
  );
};

// ─── QR Scanner ────────────────────────────────────────────────────────────────

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
                setErrorMsg('QR no corresponde a un producto válido.');
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
        setErrorMsg(e?.message?.toLowerCase().includes('permission') ? 'Sin acceso a cámara.' : 'No se pudo iniciar la cámara.');
        setStatus('error');
      }
    };

    start();
    return () => { active = false; controlsRef.current?.stop(); };
  }, []);

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#E4E3E0] border-2 border-[#141414] shadow-[8px_8px_0_#141414] w-full max-w-sm flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="border-b-2 border-[#141414] bg-[#141414] text-[#E4E3E0] px-4 py-3 flex items-center justify-between">
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
              <span className="font-mono text-[10px] text-white tracking-widest animate-pulse uppercase">INICIANDO CÁMARA...</span>
            </div>
          )}
        </div>
        <div className="px-4 py-3 border-t border-[#141414]/20">
          {status === 'scanning' && <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-green-700 text-center animate-pulse">APUNTA AL QR DEL PRODUCTO</p>}
          {status === 'error' && (
            <div className="flex flex-col gap-2">
              <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-red-700 text-center">{errorMsg}</p>
              <button onClick={onClose} className="w-full border border-[#141414] bg-[#141414] text-[#E4E3E0] py-2 font-mono text-[10px] font-bold tracking-widest uppercase">CERRAR</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Recent Transactions ───────────────────────────────────────────────────────

const RecentTransactions: React.FC = () => {
  const { transactions, products, contacts, locations, activeBrand, deleteTransaction, updateTransaction, clearAllTransactions } = useAppContext();
  const [editTx, setEditTx] = useState<Transaction | null>(null);
  const [deleteTx, setDeleteTx] = useState<Transaction | null>(null);
  const [editRef, setEditRef] = useState('');
  const [editContact, setEditContact] = useState('');
  const [busy, setBusy] = useState(false);
  const [modalError, setModalError] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | TransactionType>('ALL');
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const filtered = transactions.filter(tx => filterType === 'ALL' || tx.type === filterType);
  const recent = filtered.slice(0, 15);

  const openEdit = (tx: Transaction) => {
    setEditTx(tx); setEditRef(tx.reference); setEditContact(tx.contactId ?? ''); setModalError('');
  };

  const handleEditSave = async () => {
    if (!editTx) return;
    if (!editRef.trim()) { setModalError('La referencia no puede estar vacía.'); return; }
    setBusy(true);
    try {
      await updateTransaction(editTx.id, { reference: editRef.trim(), contactId: editContact || null });
      setEditTx(null);
    } catch (err: any) {
      setModalError(err.message || 'Error al actualizar');
    } finally { setBusy(false); }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTx) return;
    setBusy(true);
    try {
      await deleteTransaction(deleteTx.id);
      setDeleteTx(null);
    } catch (err: any) {
      setModalError(err.message || 'Error al anular');
    } finally { setBusy(false); }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-mono text-[10px] font-bold tracking-widest uppercase opacity-60 shrink-0">OPERACIONES RECIENTES</h2>
        <div className="flex items-center border border-[#141414]/20 bg-white/40 shrink-0">
          {(['ALL', 'RECEPTION', 'DISPATCH', 'TRANSFER'] as const).map(t => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={cn(
                'px-2.5 py-1.5 font-mono text-[8px] font-black tracking-widest uppercase border-r border-[#141414]/20 last:border-r-0 transition-all',
                filterType === t ? 'bg-[#141414] text-[#E4E3E0]' : 'hover:bg-[#141414]/5'
              )}
            >
              {t === 'ALL' ? 'TODO' : t === 'RECEPTION' ? 'RX' : t === 'DISPATCH' ? 'TX' : 'MV'}
            </button>
          ))}
        </div>
        <div className="flex-1 h-px bg-[#141414]/10 hidden sm:block" />
        <button
          onClick={() => setShowClearConfirm(true)}
          className="flex items-center gap-1.5 font-mono text-[8px] font-bold uppercase border border-red-400 text-red-600 px-2.5 py-1.5 hover:bg-red-600 hover:text-white transition-all shrink-0"
        >
          <Trash2 size={10} /> BORRAR TODO
        </button>
      </div>

      {recent.length === 0 ? (
        <div className="border border-[#141414]/20 bg-white/30 p-6 text-center font-mono text-[10px] opacity-40 uppercase tracking-widest">
          SIN OPERACIONES REGISTRADAS
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {recent.map(tx => {
            const product = products.find(p => p.id === tx.productId);
            const contact = contacts.find(c => c.id === tx.contactId);
            const fromLoc = locations.find(l => l.id === tx.fromLocationId);
            const toLoc = locations.find(l => l.id === tx.toLocationId);
            const isCancelled = tx.status === 'CANCELLED';
            const badge = TX_BADGE[tx.type];
            return (
              <div
                key={tx.id}
                className={cn(
                  'border bg-white/50 flex items-center gap-2 md:gap-3 px-3 py-2.5 text-[11px] font-mono transition-all',
                  isCancelled ? 'border-[#141414]/10 opacity-40' : 'border-[#141414]/15 hover:border-[#141414]/30'
                )}
              >
                <div className={cn('shrink-0 w-7 text-center text-[8px] font-black py-1 border', badge.cls)}>{badge.label}</div>
                <div className="shrink-0 text-[9px] opacity-40 w-24 hidden sm:block leading-tight">
                  {new Date(tx.date).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' })}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold truncate">{product?.name ?? tx.productId}</div>
                  <div className="text-[9px] opacity-50 truncate">{product?.code}{contact ? ` · ${contact.name}` : ''}</div>
                </div>
                <div className="shrink-0 bg-[#141414] text-[#E4E3E0] px-2 py-0.5 text-[10px] font-black">{tx.quantity}</div>
                <div className="hidden md:flex items-center gap-1 shrink-0 text-[9px] opacity-50 max-w-[180px]">
                  {fromLoc && <span className="truncate">{fromLoc.name}</span>}
                  {fromLoc && toLoc && <span className="opacity-40">→</span>}
                  {toLoc && <span className="truncate">{toLoc.name}</span>}
                </div>
                <div className="shrink-0 font-mono text-[9px] opacity-40 hidden lg:block truncate max-w-[100px]">{tx.reference}</div>
                {isCancelled ? (
                  <span className="shrink-0 text-[8px] font-black text-red-500 border border-red-300 px-1.5 py-0.5 bg-red-50">ANULADO</span>
                ) : (
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button onClick={() => openEdit(tx)} title="Editar" className="p-1.5 border border-transparent hover:border-[#141414] hover:bg-[#141414] hover:text-[#E4E3E0] transition-all">
                      <Pencil size={12} />
                    </button>
                    <button onClick={() => { setDeleteTx(tx); setModalError(''); }} title="Anular" className="p-1.5 border border-transparent hover:border-red-600 hover:bg-red-600 hover:text-white transition-all text-red-500">
                      <Trash2 size={12} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Edit modal */}
      {editTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-[#E4E3E0] border-2 border-[#141414] shadow-[8px_8px_0_#141414] w-full max-w-sm">
            <div className="border-b-2 border-[#141414] bg-[#141414] text-[#E4E3E0] px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2"><Pencil size={13} /><span className="font-mono text-[10px] font-bold tracking-widest uppercase">EDITAR OPERACIÓN</span></div>
              <button onClick={() => setEditTx(null)} className="opacity-60 hover:opacity-100"><X size={14} /></button>
            </div>
            <div className="p-5 flex flex-col gap-4">
              {modalError && <div className="border border-red-600 bg-red-50 text-red-700 px-3 py-2 font-mono text-[10px] font-bold uppercase">{modalError}</div>}
              <div className="font-mono text-[9px] opacity-50 uppercase tracking-widest border-b border-[#141414]/10 pb-2">
                {editTx.type} · {products.find(p => p.id === editTx.productId)?.name} · {editTx.quantity} UND
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[9px] font-bold tracking-[0.2em] uppercase opacity-70">REFERENCIA / GUÍA</label>
                <input type="text" value={editRef} onChange={e => setEditRef(e.target.value)} className="w-full border border-[#141414] bg-white px-3 py-2 font-mono text-xs font-bold uppercase outline-none focus:shadow-[2px_2px_0_#141414] transition-all" />
              </div>
              {(editTx.type === 'RECEPTION' || editTx.type === 'DISPATCH') && (
                <div className="flex flex-col gap-1.5">
                  <label className="font-mono text-[9px] font-bold tracking-[0.2em] uppercase opacity-70">{editTx.type === 'RECEPTION' ? 'PROVEEDOR' : 'CLIENTE'}</label>
                  <select value={editContact} onChange={e => setEditContact(e.target.value)} className="w-full border border-[#141414] bg-white px-3 py-2 font-mono text-xs font-bold uppercase outline-none focus:shadow-[2px_2px_0_#141414] transition-all">
                    <option value="">-- Sin contacto --</option>
                    {useAppContext().contacts.filter(c => editTx.type === 'RECEPTION' ? c.type === 'SUPPLIER' : c.type === 'CLIENT').map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <button onClick={handleEditSave} disabled={busy} className="flex-1 bg-[#141414] text-[#E4E3E0] py-2.5 font-mono text-[10px] font-bold tracking-widest uppercase hover:opacity-80 disabled:opacity-50 transition-all">
                  {busy ? 'GUARDANDO...' : 'GUARDAR'}
                </button>
                <button onClick={() => setEditTx(null)} className="flex-1 border border-[#141414] py-2.5 font-mono text-[10px] font-bold tracking-widest uppercase hover:bg-[#141414] hover:text-[#E4E3E0] transition-all">
                  CANCELAR
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Clear all confirm modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-[#E4E3E0] border-4 border-red-600 shadow-[8px_8px_0_#141414] w-full max-w-sm">
            <div className="border-b border-red-600 bg-red-600 px-4 py-3 flex items-center gap-2">
              <AlertTriangle size={15} className="text-white" />
              <span className="font-mono text-[10px] font-bold tracking-widest uppercase text-white">BORRAR TODAS LAS OPERACIONES</span>
            </div>
            <div className="p-5 flex flex-col gap-4">
              <p className="font-mono text-xs font-bold uppercase text-center leading-relaxed">
                ¿Confirmas eliminar <span className="text-red-600">TODAS</span> las operaciones?<br />
                <span className="text-[10px] text-red-500 font-black block mt-1">ATENCIÓN: El stock se reiniciará a cero.</span>
                <span className="text-[9px] opacity-50 normal-case font-normal block mt-1">Esta acción es irreversible.</span>
              </p>
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    setBusy(true);
                    try { await clearAllTransactions(); setShowClearConfirm(false); }
                    catch (err: any) { setModalError(err.message || 'Error al borrar'); }
                    finally { setBusy(false); }
                  }}
                  disabled={busy}
                  className="flex-1 bg-red-600 border border-red-600 text-white py-2.5 font-mono text-[10px] font-bold tracking-widest uppercase hover:bg-red-700 disabled:opacity-50 transition-all"
                >
                  {busy ? 'BORRANDO...' : 'SÍ, BORRAR TODO'}
                </button>
                <button onClick={() => setShowClearConfirm(false)} className="flex-1 border border-[#141414] py-2.5 font-mono text-[10px] font-bold tracking-widest uppercase hover:bg-[#141414] hover:text-[#E4E3E0] transition-all">
                  CANCELAR
                </button>
              </div>
              {modalError && <div className="border border-red-600 bg-red-50 text-red-700 px-3 py-2 font-mono text-[10px] font-bold uppercase">{modalError}</div>}
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm modal */}
      {deleteTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-[#E4E3E0] border-4 border-[#141414] shadow-[8px_8px_0_#141414] w-full max-w-sm">
            <div className="border-b border-[#141414] bg-[#D4D3D0] px-4 py-3 flex items-center gap-2">
              <AlertTriangle size={15} className="text-red-600" />
              <span className="font-mono text-[10px] font-bold tracking-widest uppercase">ANULAR OPERACIÓN</span>
            </div>
            <div className="p-5 flex flex-col gap-4">
              {modalError && <div className="border border-red-600 bg-red-50 text-red-700 px-3 py-2 font-mono text-[10px] font-bold uppercase">{modalError}</div>}
              <p className="font-mono text-xs font-bold uppercase text-center leading-relaxed">
                ¿Anular operación <span className="text-red-600">{deleteTx.reference}</span>?<br />
                <span className="text-[10px] opacity-60 normal-case font-normal">El stock será revertido automáticamente.</span>
              </p>
              <div className="flex gap-2">
                <button onClick={handleDeleteConfirm} disabled={busy} className="flex-1 bg-red-600 border border-red-600 text-white py-2.5 font-mono text-[10px] font-bold tracking-widest uppercase hover:bg-red-700 disabled:opacity-50 transition-all">
                  {busy ? 'ANULANDO...' : 'SÍ, ANULAR'}
                </button>
                <button onClick={() => setDeleteTx(null)} className="flex-1 border border-[#141414] py-2.5 font-mono text-[10px] font-bold tracking-widest uppercase hover:bg-[#141414] hover:text-[#E4E3E0] transition-all">
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

// ─── Guide Modal ───────────────────────────────────────────────────────────────

const GuideModal: React.FC<{ guide: OperationGuide; onClose: () => void }> = ({ guide, onClose }) => {
  const printRef = useRef<HTMLDivElement>(null);
  const meta = TYPE_META[guide.type];
  const totalQty = guide.items.reduce((sum, i) => sum + i.quantity, 0);

  const handlePrint = () => {
    const win = window.open('', '_blank');
    if (!win) return;
    const logoUrl = `${window.location.origin}${BRAND_ICON[guide.brand] ?? BRAND_ICON.BOX_PRIME}`;

    const itemsHTML = guide.items.length === 1
      ? `<div class="section">
          <div class="section-title">Producto</div>
          <div class="product-name">${guide.items[0].productName}</div>
          <div class="product-code">${guide.items[0].productCode}${guide.items[0].serialNumber ? ' // S/N: ' + guide.items[0].serialNumber : ''}</div>
          <div class="qty-box">${guide.items[0].quantity} UND</div>
        </div>`
      : `<div class="section">
          <div class="section-title">Productos (${guide.items.length} líneas)</div>
          <table class="items-table">
            <thead><tr><th>Código</th><th>Producto</th><th class="right">Cant.</th></tr></thead>
            <tbody>${guide.items.map(it => `<tr><td class="code">${it.productCode}</td><td class="name">${it.productName}</td><td class="right qty">${it.quantity}</td></tr>`).join('')}</tbody>
            <tfoot><tr><td colspan="2" class="total-label">TOTAL</td><td class="right total-qty">${totalQty}</td></tr></tfoot>
          </table>
        </div>`;

    const photoHTML = guide.photo
      ? `<div class="section">
          <div class="section-title">Evidencia fotográfica</div>
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
      .brand-logo{width:40px;height:40px;object-fit:contain;flex-shrink:0}
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
          <img class="brand-logo" src="${logoUrl}" alt="${BRAND_NAME[guide.brand] ?? guide.brand}" />
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
        <div class="footer-text">LogixZazu v3.0 // Documento generado automáticamente</div>
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
        className="bg-white border-2 border-[#141414] shadow-[10px_10px_0_#141414] w-full max-w-lg flex flex-col my-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="h-1.5 w-full" style={{ background: meta.accentColor }} />

        {/* Header */}
        <div className="px-6 py-4 border-b-2 border-[#141414] flex items-center justify-between gap-4" style={{ background: meta.bgColor }}>
          <div className="flex items-center gap-3 min-w-0">
            <img src={BRAND_ICON[guide.brand] ?? BRAND_ICON.BOX_PRIME} alt={BRAND_NAME[guide.brand]} className="w-10 h-10 object-contain shrink-0" />
            <div className="min-w-0">
              <div className="font-mono text-[8px] font-bold tracking-[0.3em] opacity-40 uppercase mb-0.5">
                {BRAND_NAME[guide.brand] ?? guide.brand} // GUÍA DE OPERACIÓN
              </div>
              <div className="font-mono font-black text-xl tracking-tight text-[#141414]">{guide.number}</div>
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
          <div className="grid grid-cols-2 border-b border-[#141414]/15">
            {[
              { label: 'FECHA', value: guide.date },
              { label: 'OPERADOR', value: guide.operator },
              { label: 'REFERENCIA', value: guide.reference },
              guide.contact ? { label: guide.type === 'RECEPTION' ? 'PROVEEDOR' : 'CLIENTE', value: guide.contact } : null,
            ].filter(Boolean).map((cell: any) => (
              <div key={cell.label} className="px-5 py-3 border-b border-r border-[#141414]/10 odd:border-r even:border-r-0">
                <div className="font-mono text-[8px] font-bold tracking-[0.2em] opacity-40 uppercase mb-1">{cell.label}</div>
                <div className="font-mono font-black text-[11px] text-[#141414] uppercase">{cell.value}</div>
              </div>
            ))}
          </div>

          {/* Items */}
          <div className="px-5 py-4 border-b border-[#141414]/15">
            <div className="font-mono text-[8px] font-bold tracking-[0.3em] opacity-35 uppercase mb-3">
              {guide.items.length === 1 ? 'PRODUCTO' : `PRODUCTOS — ${guide.items.length} LÍNEAS`}
            </div>
            {guide.items.length === 1 ? (
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="font-mono font-black text-base text-[#141414] uppercase leading-tight truncate">{guide.items[0].productName}</div>
                  <div className="font-mono text-[10px] opacity-50 mt-0.5">{guide.items[0].productCode}{guide.items[0].serialNumber ? ` · S/N: ${guide.items[0].serialNumber}` : ''}</div>
                </div>
                <div className="shrink-0 flex flex-col items-center justify-center px-4 py-2 text-white font-mono font-black" style={{ background: meta.accentColor, minWidth: 72 }}>
                  <span className="text-xl leading-none">{guide.items[0].quantity}</span>
                  <span className="text-[8px] tracking-widest opacity-80 mt-0.5">UND</span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-0 border border-[#141414]/20 overflow-hidden">
                <div className="grid grid-cols-[auto_1fr_auto] text-[9px] font-mono font-bold uppercase tracking-wider" style={{ background: meta.accentColor, color: 'white' }}>
                  <div className="px-3 py-2">Código</div>
                  <div className="px-3 py-2">Producto</div>
                  <div className="px-3 py-2 text-right">Cant.</div>
                </div>
                {guide.items.map((item, i) => (
                  <div key={i} className="grid grid-cols-[auto_1fr_auto] text-[10px] font-mono border-t border-[#141414]/10 bg-white/60">
                    <div className="px-3 py-2 opacity-50 text-[9px]">{item.productCode}</div>
                    <div className="px-3 py-2 font-bold uppercase truncate">{item.productName}</div>
                    <div className="px-3 py-2 font-black text-right">{item.quantity}</div>
                  </div>
                ))}
                <div className="grid grid-cols-[1fr_auto] bg-[#f5f4f1] border-t border-[#141414]/20 font-mono font-black text-[11px]">
                  <div className="px-3 py-2 opacity-50 uppercase text-[9px] tracking-widest self-center">TOTAL</div>
                  <div className="px-3 py-2 text-right" style={{ color: meta.accentColor }}>{totalQty} UND</div>
                </div>
              </div>
            )}
          </div>

          {/* Movement */}
          {(guide.fromLocation || guide.toLocation) && (
            <div className="px-5 py-4 border-b border-[#141414]/15">
              <div className="font-mono text-[8px] font-bold tracking-[0.3em] opacity-35 uppercase mb-3">MOVIMIENTO</div>
              <div className="flex items-stretch gap-0">
                {guide.fromLocation && (
                  <div className="flex-1 border border-[#141414]/20 bg-[#fafaf9] px-3 py-2.5">
                    <div className="font-mono text-[7px] font-bold tracking-[0.2em] opacity-40 uppercase mb-1">ORIGEN</div>
                    <div className="font-mono font-black text-[11px] text-[#141414] uppercase">{guide.fromLocation}</div>
                  </div>
                )}
                {guide.fromLocation && guide.toLocation && (
                  <div className="flex items-center justify-center px-3 font-black text-lg text-white shrink-0" style={{ background: meta.accentColor }}>
                    {meta.icon}
                  </div>
                )}
                {guide.toLocation && (
                  <div className="flex-1 border border-[#141414]/20 bg-[#fafaf9] px-3 py-2.5">
                    <div className="font-mono text-[7px] font-bold tracking-[0.2em] opacity-40 uppercase mb-1">DESTINO</div>
                    <div className="font-mono font-black text-[11px] text-[#141414] uppercase">{guide.toLocation}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Signature */}
          {guide.signature && (
            <div className="px-5 py-4 border-b border-[#141414]/15">
              <div className="font-mono text-[8px] font-bold tracking-[0.3em] opacity-35 uppercase mb-2">FIRMA DE CONFORMIDAD</div>
              <div className="border border-[#141414]/20 bg-[#fafaf9] p-2">
                <img src={guide.signature} alt="firma" className="h-16 w-full object-contain" />
              </div>
            </div>
          )}

          {/* Photo */}
          {guide.photo && (
            <div className="px-5 py-4 border-b border-[#141414]/15">
              <div className="font-mono text-[8px] font-bold tracking-[0.3em] opacity-35 uppercase mb-2">EVIDENCIA FOTOGRÁFICA</div>
              <div className="border border-[#141414]/20 bg-[#fafaf9] p-1">
                <img src={guide.photo} alt="evidencia" className="max-h-40 w-full object-contain" />
              </div>
            </div>
          )}

          {/* Footer stamp */}
          <div className="px-5 py-3 flex items-center justify-between bg-[#fafaf9]">
            <div className="font-mono text-[8px] opacity-30 tracking-widest uppercase">LogixZazu v3.0 // Documento generado automáticamente</div>
            <div className="font-mono font-black text-[8px] tracking-widest uppercase px-3 py-1.5 border-2" style={{ borderColor: meta.accentColor, color: meta.accentColor }}>
              ✓ REGISTRADO
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="border-t-2 border-[#141414] p-3 flex gap-2 bg-[#f5f4f1]">
          <button
            onClick={handlePrint}
            className="flex-1 flex items-center justify-center gap-2 text-white py-2.5 text-[10px] font-bold font-mono uppercase transition-all hover:opacity-90"
            style={{ background: meta.accentColor }}
          >
            <Printer size={13} /> IMPRIMIR GUÍA
          </button>
          <button onClick={onClose} className="flex-1 border-2 border-[#141414] py-2.5 text-[10px] font-bold font-mono uppercase hover:bg-white transition-all text-[#141414]">
            CERRAR
          </button>
        </div>
      </div>
    </div>
  );
};

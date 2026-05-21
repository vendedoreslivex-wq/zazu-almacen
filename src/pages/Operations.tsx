import React, { useState, useRef, useEffect } from 'react';
import { useAppContext } from '../store/AppContext';
import { ModuleInfo } from '../components/ModuleInfo';
import { ArrowDownLeft, ArrowUpRight, ArrowRightLeft, AlertTriangle, X, Printer, CheckCircle } from 'lucide-react';
import { cn } from '../lib/utils';
import SignatureCanvas from 'react-signature-canvas';
import { TransactionType } from '../types';
import { sendOperationEmail, OperationType } from '../lib/emailService';

export const Operations: React.FC = () => {
  const [activeOpt, setActiveOpt] = useState<TransactionType>('RECEPTION');

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-6 pb-8">
      <ModuleInfo number="05" title="Operaciones" description="Registro de movimientos de stock: entradas, salidas y transferencias entre ubicaciones. Cada operación queda trazada con fecha, usuario y motivo." />
      {/* Operation Type Selector */}
      <div className="grid grid-cols-3 gap-2 bg-[#D4D3D0] border border-[#141414] p-2 shadow-[4px_4px_0_#141414]">
        <OptButton
          icon={<ArrowDownLeft size={18} />}
          label="RECEPCIÓN"
          active={activeOpt === 'RECEPTION'}
          onClick={() => setActiveOpt('RECEPTION')}
          colorClass="text-[var(--success-green)]"
        />
        <OptButton
          icon={<ArrowUpRight size={18} />}
          label="DESPACHO"
          active={activeOpt === 'DISPATCH'}
          onClick={() => setActiveOpt('DISPATCH')}
          colorClass="text-[var(--danger-red)]"
        />
        <OptButton
          icon={<ArrowRightLeft size={18} />}
          label="TRANSLADO"
          active={activeOpt === 'TRANSFER'}
          onClick={() => setActiveOpt('TRANSFER')}
          colorClass="text-[#00DDFF]"
        />
      </div>

      <div className="bg-white/40 border border-[#141414] p-6 lg:p-8 relative overflow-visible">
        <div className="absolute top-0 right-0 p-4 font-mono text-[100px] leading-none opacity-5 select-none pointer-events-none font-black">{activeOpt === 'RECEPTION' ? 'RX' : activeOpt === 'DISPATCH' ? 'TX' : 'MV'}</div>
        <OperationForm type={activeOpt} />
      </div>
    </div>
  );
};

const OptButton = ({icon, label, active, onClick, colorClass}) => (
  <button 
    onClick={onClick}
    className={cn(
      "flex flex-col items-center justify-center gap-2 p-3 lg:p-4 border border-[#141414] transition-all",
      active ? "bg-[#141414] text-[#E4E3E0] shadow-[inset_2px_2px_0_rgba(0,0,0,0.5)]" : "bg-white/50 hover:bg-[#141414] hover:text-[#E4E3E0]"
    )}
  >
    <div className={cn(active ? "" : "opacity-70")}>{icon}</div>
    <span className={cn("font-mono text-[9px] lg:text-[10px] tracking-widest font-bold uppercase", active ? "" : "opacity-70")}>{label}</span>
  </button>
)

const OperationForm: React.FC<{type: TransactionType}> = ({ type }) => {
  const { products, locations, addTransaction, stockLevels, activeBrand, contacts, currentUser, users } = useAppContext();

  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [fromLocation, setFromLocation] = useState('');
  const [toLocation, setToLocation] = useState('');
  const [reference, setReference] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [contactId, setContactId] = useState('');
  const [signature, setSignature] = useState<string | null>(null);
  const signatureRef = React.useRef<SignatureCanvas>(null);
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<{type: 'success' | 'error', message: string} | null>(null);
  const [showReceptionPrompt, setShowReceptionPrompt] = useState(false);
  const [pendingTx, setPendingTx] = useState<any>(null);
  const [guide, setGuide] = useState<OperationGuide | null>(null);

  useEffect(() => {
    setReference(peekGuideNumber(type, activeBrand));
  }, [type, activeBrand]);

  const getAvailableStock = () => {
    if (!productId || !fromLocation || type === 'RECEPTION') return null;
    const stocks = stockLevels.filter(s => s.productId === productId && s.locationId === fromLocation);
    return stocks.reduce((sum, s) => sum + s.quantity, 0);
  };

  const stockAvailable = getAvailableStock();

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!productId) newErrors.productId = "SELECCIONE_PRODUCTO";
    
    // Robust validation for quantity: must be a positive integer
    if (!quantity || !/^\d+$/.test(quantity.toString().trim()) || parseInt(quantity.toString().trim(), 10) <= 0) {
      newErrors.quantity = "CANTIDAD_INVALIDA";
    }

    if (type === 'RECEPTION' && !toLocation) newErrors.toLocation = "SELECCIONE_DESTINO";
    if (type === 'DISPATCH' && !fromLocation) newErrors.fromLocation = "SELECCIONE_ORIGEN";
    if (type === 'TRANSFER') {
      if (!fromLocation) newErrors.fromLocation = "SELECCIONE_ORIGEN";
      if (!toLocation) newErrors.toLocation = "SELECCIONE_DESTINO";
      if (fromLocation && toLocation && fromLocation === toLocation) newErrors.toLocation = "DESTINO_DEBE_SER_DIFERENTE";
    }

    if (type === 'DISPATCH' || type === 'TRANSFER') {
      if (productId && fromLocation) {
         if (stockAvailable === 0) newErrors.fromLocation = "SIN_STOCK_EN_ORIGEN";
         else if (quantity && Number(quantity) > stockAvailable!) newErrors.quantity = "CANTIDAD_EXCEDE_STOCK";
      }
    }
    
    if (!reference.trim()) newErrors.reference = "REFERENCIA_OBLIGATORIA";

    if (type === 'RECEPTION' || type === 'DISPATCH') {
      if (signatureRef.current?.isEmpty()) {
        newErrors.signature = "FIRMA_REQUERIDA";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    if (!validate()) return;
    
    const sigData = (type === 'RECEPTION' || type === 'DISPATCH') && signatureRef.current ? signatureRef.current.toDataURL() : undefined;

    if (type === 'RECEPTION') {
      const existing = stockLevels.find(s => s.productId === productId && s.locationId === toLocation);
      if (existing) {
        setPendingTx({
          type,
          productId,
          quantity: Number(quantity),
          toLocationId: toLocation,
          reference,
          user: currentUser.username,
          contactId,
          signature: sigData,
          serialNumber: activeBrand === 'BOX_PRIME' ? serialNumber : undefined
        });
        setShowReceptionPrompt(true);
        return;
      }
    }

    executeTransaction({
      type,
      productId,
      quantity: Number(quantity),
      fromLocationId: type === 'RECEPTION' ? undefined : fromLocation,
      toLocationId: type === 'DISPATCH' ? undefined : toLocation,
      reference,
      user: currentUser.username,
      contactId,
      signature: sigData,
      serialNumber: activeBrand === 'BOX_PRIME' ? serialNumber : undefined
    });
  };

  const executeTransaction = async (tx: any) => {
    try {
      await addTransaction(tx);

      const product = products.find(p => p.id === tx.productId);
      const fromLoc = locations.find(l => l.id === tx.fromLocationId);
      const toLoc = locations.find(l => l.id === tx.toLocationId);
      const contact = contacts.find(c => c.id === tx.contactId);
      const now = new Date();
      const guideNumber = nextGuideNumber(tx.type, activeBrand);

      setGuide({
        number: guideNumber,
        type: tx.type,
        date: now.toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' }),
        operator: currentUser.username,
        brand: activeBrand,
        productName: product?.name ?? tx.productId,
        productCode: product?.code ?? '',
        quantity: tx.quantity,
        fromLocation: fromLoc?.name,
        toLocation: toLoc?.name,
        reference: tx.reference,
        contact: contact?.name,
        serialNumber: tx.serialNumber,
        signature: tx.signature,
      });

      // Reset
      setProductId('');
      setQuantity('');
      setReference(peekGuideNumber(tx.type, activeBrand));
      setSerialNumber('');
      setFromLocation('');
      setToLocation('');
      setContactId('');
      setErrors({});
      if (signatureRef.current) signatureRef.current.clear();

      setFeedback({ type: 'success', message: '¡OPERACIÓN REGISTRADA! ENVIANDO COMPROBANTE...' });
      setTimeout(() => setFeedback(null), 6000);

      // Fire email non-blocking
      const userRecord = users.find(u => u.id === currentUser.id);
      const recipientEmail = userRecord?.emailPersonal || userRecord?.email;
      if (recipientEmail) {
        const product = products.find(p => p.id === tx.productId);
        const fromLoc = locations.find(l => l.id === tx.fromLocationId);
        const toLoc = locations.find(l => l.id === tx.toLocationId);
        const contact = contacts.find(c => c.id === tx.contactId);

        sendOperationEmail({
          toEmail: recipientEmail,
          toName: currentUser.username,
          brand: activeBrand,
          operationType: tx.type as OperationType,
          reference: tx.reference,
          date: new Date().toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' }),
          operator: currentUser.username,
          productName: product?.name ?? tx.productId,
          productCode: product?.code ?? '',
          quantity: tx.quantity,
          fromLocation: fromLoc?.name,
          toLocation: toLoc?.name,
          contact: contact?.name,
          serialNumber: tx.serialNumber,
          signature: tx.signature,
        }).then(() => {
          setFeedback({ type: 'success', message: `¡OPERACIÓN REGISTRADA! COMPROBANTE ENVIADO A ${recipientEmail}` });
        }).catch(() => {
          setFeedback({ type: 'success', message: '¡OPERACIÓN REGISTRADA! (SIN EMAIL — REVISA CONFIGURACIÓN)' });
        });
      } else {
        setFeedback({ type: 'success', message: '¡OPERACIÓN REGISTRADA CORRECTAMENTE!' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'ERROR AL REGISTRAR' });
    }
  };

  const handleReceptionPrompt = (forceNewEntry: boolean) => {
    setShowReceptionPrompt(false);
    if (pendingTx) {
      executeTransaction({ ...pendingTx, forceNewEntry });
      setPendingTx(null);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 relative z-10">
      {feedback && (
        <div className={cn("p-4 border font-bold font-mono text-xs uppercase tracking-widest flex items-center gap-2", feedback.type === 'success' ? "bg-green-100 border-green-700 text-green-800" : "bg-red-100 border-red-700 text-red-800")}>
          {feedback.message}
        </div>
      )}
      <div className="border-b border-[#141414] pb-3 mb-4 hidden md:block">
        <h3 className="font-serif italic font-bold text-xs uppercase tracking-widest text-inherit">
          {type === 'RECEPTION' ? '01 // NUEVA RECEPCIÓN DE INVENTARIO' : 
           type === 'DISPATCH' ? '01 // DESPACHO DE MATERIALES' : 
           '01 // TRANSLADO INTERNO ZONAS'}
        </h3>
        <p className="opacity-60 text-[10px] font-mono mt-1 uppercase tracking-widest font-bold">SISTEMA_DE_REGISTRO_ACTIVO // {type}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <FormGroup label="SKU PRODUCTO" error={errors.productId}>
          <select value={productId} onChange={e => {setProductId(e.target.value); setErrors(prev => ({...prev, productId: ''}))}} className={cn("input-technical", errors.productId && "border-red-600 bg-red-50 focus:shadow-[2px_2px_0_#dc2626]")}>
            <option value="">Seleccione Producto...</option>
            {products.map(p => (
              <option key={p.id} value={p.id}>{p.code} - {p.name}</option>
            ))}
          </select>
        </FormGroup>

        <FormGroup label="CANTIDAD" error={errors.quantity}>
          <input 
            type="number" 
            min="1" 
            value={quantity} 
            onChange={e => {setQuantity(e.target.value); setErrors(prev => ({...prev, quantity: ''}))}} 
            className={cn("input-technical font-mono text-lg", errors.quantity && "border-red-600 bg-red-50 focus:shadow-[2px_2px_0_#dc2626]")} 
            placeholder="0"
          />
        </FormGroup>

        {(type === 'DISPATCH' || type === 'TRANSFER') && (
          <FormGroup label="UBICACIÓN ORIGEN" error={errors.fromLocation}>
            <select 
              value={fromLocation} 
              onChange={e => {
                const val = e.target.value;
                setFromLocation(val); 
                setErrors(prev => ({...prev, fromLocation: ''}));
                if (type === 'TRANSFER' && val === toLocation) {
                  setToLocation('');
                }
              }} 
              className={cn("input-technical", errors.fromLocation && "border-red-600 bg-red-50 focus:shadow-[2px_2px_0_#dc2626]")}
            >
              <option value="">Seleccione Origen...</option>
              {locations.map(l => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
            {stockAvailable !== null && fromLocation && !errors.fromLocation && (
              <div className="mt-1 font-mono text-[10px] text-green-700 font-bold tracking-wider">STOCK MAX: {stockAvailable}</div>
            )}
          </FormGroup>
        )}

        {(type === 'RECEPTION' || type === 'TRANSFER') && (
          <FormGroup label="UBICACIÓN DESTINO" error={errors.toLocation}>
            <select value={toLocation} onChange={e => {setToLocation(e.target.value); setErrors(prev => ({...prev, toLocation: ''}))}} className={cn("input-technical", errors.toLocation && "border-red-600 bg-red-50 focus:shadow-[2px_2px_0_#dc2626]")}>
              <option value="">Seleccione Destino...</option>
              {locations.map(l => (
                  <option key={l.id} value={l.id} disabled={type === 'TRANSFER' && l.id === fromLocation}>{l.name}</option>
              ))}
            </select>
            {toLocation && (
              <div className="mt-2 text-[9px] font-mono border border-[#141414]/10 bg-white/30 p-2 max-h-32 overflow-y-auto">
                <span className="opacity-60 uppercase tracking-widest font-bold mb-1 block">PRODUCTOS EN DESTINO:</span>
                {stockLevels.filter(s => s.locationId === toLocation && s.quantity > 0).length > 0 ? (
                  stockLevels
                    .filter(s => s.locationId === toLocation && s.quantity > 0)
                    .map((s, i) => {
                      const product = products.find(p => p.id === s.productId);
                      return (
                        <div key={i} className="flex justify-between items-center border-b border-[#141414]/5 last:border-0 py-1">
                          <span className="font-bold truncate pr-2">{product?.name || 'DESCONOCIDO'}</span>
                          <span className="bg-[#141414] text-[#E4E3E0] px-1.5 py-0.5 whitespace-nowrap">{s.quantity}</span>
                        </div>
                      );
                    })
                ) : (
                  <span className="opacity-50 italic">UBICACIÓN VACÍA</span>
                )}
              </div>
            )}
          </FormGroup>
        )}

        <FormGroup label="REFERENCIA / GUÍA" error={errors.reference} className={activeBrand === 'BOX_PRIME' ? 'md:col-span-1' : 'md:col-span-2'}>
          <input 
            type="text" 
            value={reference} 
            onChange={e => {setReference(e.target.value); setErrors(prev => ({...prev, reference: ''}))}} 
            className={cn("input-technical", errors.reference && "border-red-600 bg-red-50 focus:shadow-[2px_2px_0_#dc2626]")} 
            placeholder="EJ: GR-20914"
          />
        </FormGroup>

        {(type === 'RECEPTION' || type === 'DISPATCH') && (
          <FormGroup label={type === 'RECEPTION' ? 'PROVEEDOR' : 'CLIENTE'} className="md:col-span-1 border-l-4 border-l-[#141414] pl-2">
            <select 
              value={contactId} 
              onChange={e => setContactId(e.target.value)} 
              className="input-technical"
            >
              <option value="">{type === 'RECEPTION' ? '-- SELECCIONAR PROVEEDOR --' : '-- SELECCIONAR CLIENTE --'}</option>
              {contacts.filter(c => type === 'RECEPTION' ? c.type === 'SUPPLIER' : c.type === 'CLIENT').map(c => (
                <option key={c.id} value={c.id}>{c.name} ({c.document})</option>
              ))}
            </select>
          </FormGroup>
        )}

        {activeBrand === 'BOX_PRIME' && (
          <FormGroup label="NÚMERO DE SERIE / LOTE" error={errors.serialNumber} className="md:col-span-1">
            <input 
              type="text" 
              value={serialNumber} 
              onChange={e => setSerialNumber(e.target.value)} 
              className={cn("input-technical")} 
              placeholder="EJ: L-202305-A1"
            />
          </FormGroup>
        )}

        {(type === 'RECEPTION' || type === 'DISPATCH') && (
          <FormGroup label="FIRMA DIGITAL" error={errors.signature} className="md:col-span-2">
            <div className={cn("border border-[#141414] bg-white relative w-full h-32 flex flex-col items-center justify-center overflow-hidden", errors.signature && "border-red-600 shadow-[2px_2px_0_#dc2626]")}>
              <SignatureCanvas 
                ref={signatureRef} 
                canvasProps={{ className: 'w-full h-full cursor-crosshair' }}
                onBegin={() => setErrors(prev => ({...prev, signature: ''}))}
              />
              <button 
                type="button" 
                onClick={() => signatureRef.current?.clear()}
                className="absolute top-2 right-2 text-[9px] font-mono font-bold tracking-widest bg-[#141414] text-white px-2 py-1 opacity-70 hover:opacity-100"
              >
                BORRAR
              </button>
            </div>
            <span className="text-[9px] font-mono opacity-50 uppercase mt-1">
              {type === 'RECEPTION' ? 'Firme en el recuadro superior para constancia de recepción' : 'Firme en el recuadro superior para constancia de despacho'}
            </span>
          </FormGroup>
        )}
      </div>

      {productId && (
        <div className="border border-[#141414] bg-white/40 p-4 mt-2">
          <h4 className="font-mono text-[10px] font-bold tracking-widest opacity-80 uppercase mb-3">CURRENT STOCK LEVELS</h4>
          {(() => {
            const prodStocks = stockLevels.filter(s => s.productId === productId && s.quantity > 0);
            const totalProdStock = prodStocks.reduce((sum, s) => sum + s.quantity, 0);
            if (prodStocks.length === 0) {
              return <div className="text-[10px] font-mono opacity-50 italic">SIN STOCK ACTUAL EN NINGUNA UBICACIÓN.</div>;
            }
            return (
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap gap-3">
                  {prodStocks.map((s, i) => {
                    const locName = locations.find(l => l.id === s.locationId)?.name;
                    return (
                      <div key={i} className="flex gap-2 items-center bg-white border border-[#141414]/20 p-2 shadow-[2px_2px_0_rgba(20,20,20,0.1)] text-[10px] font-mono">
                        <span className="font-bold truncate max-w-[150px]">{locName || 'UBICACIÓN DESCONOCIDA'}</span>
                        <span className="bg-[#141414] text-[#E4E3E0] px-1.5 py-0.5">{s.quantity}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-1 flex items-center gap-2 text-[11px] font-mono font-bold">
                  <span className="opacity-70">TOTAL DISPONIBLE:</span>
                  <span className="bg-[#141414] text-[#E4E3E0] px-2 py-0.5">{totalProdStock}</span>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      <div className="mt-6 flex justify-end">
        <button 
          type="button" 
          onClick={handleSubmit}
          className="bg-[#141414] border border-[#141414] hover:bg-white hover:text-[#141414] text-[#E4E3E0] px-8 py-3 text-[11px] font-mono tracking-widest font-bold transition-all shadow-[4px_4px_0_#141414] active:shadow-none active:translate-y-[4px] active:translate-x-[4px]"
        >
          EJECUTAR_{type}
        </button>
      </div>
{/* Style block for specific technical inputs */}
<style>{`
  .input-technical {
    width: 100%;
    background: rgba(255, 255, 255, 0.7);
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
  .input-technical:focus {
    background: white;
    box-shadow: 2px 2px 0 0 #141414;
  }
`}</style>
      {guide && <GuideModal guide={guide} onClose={() => setGuide(null)} />}

      {showReceptionPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 transition-opacity">
          <div className="bg-[#E4E3E0] border-4 border-[#141414] w-full max-w-sm shadow-[8px_8px_0_#141414] flex flex-col">
            <div className="p-3 border-b border-[#141414] bg-[#D4D3D0] flex justify-between items-center text-[#141414]">
              <div className="flex items-center gap-2">
                <AlertTriangle size={16} />
                <h2 className="font-serif italic font-bold text-xs uppercase tracking-widest">STOCK EXISTENTE</h2>
              </div>
              <button type="button" onClick={() => setShowReceptionPrompt(false)} className="opacity-60 hover:opacity-100 hover:bg-[#141414] hover:text-[#E4E3E0] p-1 transition-all"><X size={16}/></button>
            </div>
            <div className="p-5 flex flex-col gap-6">
              <p className="font-mono text-sm font-bold uppercase text-center leading-relaxed">
                El producto ya existe en esta ubicación. ¿Deseas actualizar el stock existente o agregarlo como una nueva entrada?
              </p>
              <div className="flex flex-col gap-2 mt-2">
                <button 
                  type="button"
                  onClick={() => handleReceptionPrompt(false)}
                  className="w-full bg-[#141414] border border-[#141414] text-[#E4E3E0] px-4 py-3 text-[10px] font-mono tracking-widest font-bold hover:bg-white hover:text-[#141414] transition-all shadow-[2px_2px_0_#141414]"
                >
                  ACTUALIZAR STOCK
                </button>
                <button 
                  type="button"
                  onClick={() => handleReceptionPrompt(true)}
                  className="w-full bg-white border border-[#141414] text-[#141414] px-4 py-3 text-[10px] font-mono tracking-widest font-bold hover:bg-[#141414] hover:text-white transition-all shadow-[2px_2px_0_#141414]"
                >
                  NUEVA ENTRADA
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </form>
  );
};

const FormGroup: React.FC<{label: string, error?: string, children: React.ReactNode, className?: string}> = ({label, error, children, className}) => (
  <div className={cn("flex flex-col gap-1.5", className)}>
    <label className={cn("font-mono text-[9px] font-bold tracking-[0.2em] uppercase", error ? "text-red-700 opacity-100" : "opacity-80")}>{label}</label>
    {children}
    {error && <span className="font-mono text-[9px] font-bold text-red-700 uppercase mt-0.5 border border-red-700 px-1 py-0.5 bg-red-100 w-fit shrink-0 tracking-wider tooltip">{error}</span>}
  </div>
);

type OperationGuide = {
  number: string;
  type: TransactionType;
  date: string;
  operator: string;
  brand: string;
  productName: string;
  productCode: string;
  quantity: number;
  fromLocation?: string;
  toLocation?: string;
  reference: string;
  contact?: string;
  serialNumber?: string;
  signature?: string;
};

const GUIDE_PREFIX: Record<TransactionType, string> = {
  RECEPTION: 'RE',
  DISPATCH:  'DE',
  TRANSFER:  'TR',
};

function nextGuideNumber(type: TransactionType, brand: string): string {
  const key = `guide_seq_${brand}_${type}`;
  const current = parseInt(localStorage.getItem(key) ?? '0', 10);
  const next = current + 1;
  localStorage.setItem(key, String(next));
  return `${GUIDE_PREFIX[type]}-${String(next).padStart(5, '0')}`;
}

function peekGuideNumber(type: TransactionType, brand: string): string {
  const key = `guide_seq_${brand}_${type}`;
  const current = parseInt(localStorage.getItem(key) ?? '0', 10);
  return `${GUIDE_PREFIX[type]}-${String(current + 1).padStart(5, '0')}`;
}

const TYPE_META: Record<TransactionType, { label: string; accentColor: string; bgColor: string; borderColor: string; icon: string }> = {
  RECEPTION: { label: 'RECEPCIÓN', accentColor: '#15803d', bgColor: '#f0fdf4', borderColor: '#16a34a', icon: '↓' },
  DISPATCH:  { label: 'DESPACHO',  accentColor: '#b91c1c', bgColor: '#fef2f2', borderColor: '#dc2626', icon: '↑' },
  TRANSFER:  { label: 'TRASLADO',  accentColor: '#0369a1', bgColor: '#eff6ff', borderColor: '#2563eb', icon: '⇄' },
};

const GuideModal: React.FC<{ guide: OperationGuide; onClose: () => void }> = ({ guide, onClose }) => {
  const printRef = useRef<HTMLDivElement>(null);
  const meta = TYPE_META[guide.type];

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Guía ${guide.number}</title>
    <style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:'Courier New',monospace;background:#fff;display:flex;justify-content:center;padding:32px 16px}
      .doc{width:420px;border:2px solid #141414}
      .stripe{height:6px;background:${meta.accentColor}}
      .top{padding:20px 20px 14px;border-bottom:2px solid #141414;display:flex;justify-content:space-between;align-items:flex-start}
      .brand{font-size:8px;font-weight:700;letter-spacing:3px;opacity:.4;text-transform:uppercase;margin-bottom:4px}
      .docnum{font-size:18px;font-weight:900;letter-spacing:1px;text-transform:uppercase}
      .badge{padding:6px 14px;color:#fff;font-size:9px;font-weight:900;letter-spacing:2px;text-transform:uppercase;background:${meta.accentColor};display:flex;align-items:center;gap:6px}
      .badge-icon{font-size:14px}
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
      .flow{display:flex;align-items:center;gap:0;margin-top:8px}
      .flow-box{flex:1;background:#f5f5f5;border:1px solid #ddd;padding:8px 10px}
      .flow-label{font-size:7px;font-weight:700;letter-spacing:2px;opacity:.4;text-transform:uppercase;margin-bottom:3px}
      .flow-name{font-size:10px;font-weight:900;text-transform:uppercase}
      .flow-arrow{padding:0 10px;font-size:18px;color:${meta.accentColor};font-weight:900;flex-shrink:0}
      .sig-section{padding:14px 20px;border-bottom:1px solid #e5e5e5}
      .sig-img{border:1px solid #ddd;padding:4px;max-height:60px;width:100%;object-fit:contain}
      .footer{padding:10px 20px;display:flex;justify-content:space-between;align-items:center;background:#fafafa}
      .footer-text{font-size:7px;opacity:.35;letter-spacing:1px;text-transform:uppercase}
      .stamp{border:2px solid ${meta.accentColor};color:${meta.accentColor};padding:4px 10px;font-size:8px;font-weight:900;letter-spacing:2px;text-transform:uppercase}
      @media print{body{padding:0}.doc{border:2px solid #141414}}
    </style></head><body>
    <div class="doc">
      <div class="stripe"></div>
      <div class="top">
        <div>
          <div class="brand">${guide.brand.replace('_', ' ')} // Sistema de Almacén</div>
          <div class="docnum">${guide.number}</div>
        </div>
        <div class="badge"><span class="badge-icon">${meta.icon}</span>${meta.label}</div>
      </div>
      <div class="meta">
        <div class="meta-cell"><div class="meta-label">Fecha</div><div class="meta-value">${guide.date}</div></div>
        <div class="meta-cell"><div class="meta-label">Operador</div><div class="meta-value">${guide.operator}</div></div>
        <div class="meta-cell"><div class="meta-label">Referencia</div><div class="meta-value">${guide.reference}</div></div>
        ${guide.contact ? `<div class="meta-cell"><div class="meta-label">${guide.type === 'RECEPTION' ? 'Proveedor' : 'Cliente'}</div><div class="meta-value">${guide.contact}</div></div>` : '<div class="meta-cell"></div>'}
      </div>
      <div class="section">
        <div class="section-title">Producto</div>
        <div class="product-name">${guide.productName}</div>
        <div class="product-code">${guide.productCode}${guide.serialNumber ? ' // S/N: ' + guide.serialNumber : ''}</div>
        <div class="qty-box">${guide.quantity} UND</div>
      </div>
      ${(guide.fromLocation || guide.toLocation) ? `
      <div class="section">
        <div class="section-title">Movimiento</div>
        <div class="flow">
          ${guide.fromLocation ? `<div class="flow-box"><div class="flow-label">Origen</div><div class="flow-name">${guide.fromLocation}</div></div>` : ''}
          ${guide.fromLocation && guide.toLocation ? `<div class="flow-arrow">${meta.icon}</div>` : ''}
          ${guide.toLocation ? `<div class="flow-box"><div class="flow-label">Destino</div><div class="flow-name">${guide.toLocation}</div></div>` : ''}
        </div>
      </div>` : ''}
      ${guide.signature ? `<div class="sig-section"><div class="section-title">Firma de conformidad</div><img class="sig-img" src="${guide.signature}" alt="firma"/></div>` : ''}
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
        {/* Color stripe top */}
        <div className="h-1.5 w-full" style={{ background: meta.accentColor }} />

        {/* Document header */}
        <div className="px-6 py-4 border-b-2 border-[#141414] flex items-start justify-between gap-4" style={{ background: meta.bgColor }}>
          <div>
            <div className="font-mono text-[8px] font-bold tracking-[0.3em] opacity-40 uppercase mb-1">
              {guide.brand.replace('_', ' ')} // GUÍA DE OPERACIÓN
            </div>
            <div className="font-mono font-black text-xl tracking-tight text-[#141414]">{guide.number}</div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div
              className="flex items-center gap-2 px-4 py-2 text-white font-mono font-black text-[10px] tracking-widest uppercase"
              style={{ background: meta.accentColor }}
            >
              <span className="text-base leading-none">{meta.icon}</span>
              {meta.label}
            </div>
            <button onClick={onClose} className="p-1 opacity-40 hover:opacity-80 transition-opacity">
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Printable area */}
        <div ref={printRef}>
          {/* Meta grid */}
          <div className="grid grid-cols-2 border-b border-[#141414]/15">
            {[
              { label: 'FECHA', value: guide.date },
              { label: 'OPERADOR', value: guide.operator },
              { label: 'REFERENCIA', value: guide.reference },
              guide.contact
                ? { label: guide.type === 'RECEPTION' ? 'PROVEEDOR' : 'CLIENTE', value: guide.contact }
                : null,
            ].filter(Boolean).map((cell: any) => (
              <div key={cell.label} className="px-5 py-3 border-b border-r border-[#141414]/10 odd:border-r even:border-r-0">
                <div className="font-mono text-[8px] font-bold tracking-[0.2em] opacity-40 uppercase mb-1">{cell.label}</div>
                <div className="font-mono font-black text-[11px] text-[#141414] uppercase">{cell.value}</div>
              </div>
            ))}
          </div>

          {/* Product section */}
          <div className="px-5 py-4 border-b border-[#141414]/15">
            <div className="font-mono text-[8px] font-bold tracking-[0.3em] opacity-35 uppercase mb-3">PRODUCTO</div>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="font-mono font-black text-base text-[#141414] uppercase leading-tight truncate">{guide.productName}</div>
                <div className="font-mono text-[10px] opacity-50 mt-0.5">
                  {guide.productCode}{guide.serialNumber ? ` · S/N: ${guide.serialNumber}` : ''}
                </div>
              </div>
              <div
                className="shrink-0 flex flex-col items-center justify-center px-4 py-2 text-white font-mono font-black"
                style={{ background: meta.accentColor, minWidth: '72px' }}
              >
                <span className="text-xl leading-none">{guide.quantity}</span>
                <span className="text-[8px] tracking-widest opacity-80 mt-0.5">UND</span>
              </div>
            </div>
          </div>

          {/* Movement flow */}
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
                  <div
                    className="flex items-center justify-center px-3 font-black text-lg text-white shrink-0"
                    style={{ background: meta.accentColor }}
                  >
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

          {/* Footer stamp */}
          <div className="px-5 py-3 flex items-center justify-between bg-[#fafaf9]">
            <div className="font-mono text-[8px] opacity-30 tracking-widest uppercase">LogixZazu v3.0 // Documento generado automáticamente</div>
            <div
              className="font-mono font-black text-[8px] tracking-widest uppercase px-3 py-1.5 border-2"
              style={{ borderColor: meta.accentColor, color: meta.accentColor }}
            >
              ✓ REGISTRADO
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="border-t-2 border-[#141414] p-3 flex gap-2 bg-[#f5f4f1]">
          <button
            onClick={handlePrint}
            className="flex-1 flex items-center justify-center gap-2 text-white py-2.5 text-[10px] font-bold font-mono uppercase transition-all hover:opacity-90 active:scale-[0.98]"
            style={{ background: meta.accentColor }}
          >
            <Printer size={13} /> IMPRIMIR GUÍA
          </button>
          <button
            onClick={onClose}
            className="flex-1 border-2 border-[#141414] py-2.5 text-[10px] font-bold font-mono uppercase hover:bg-white transition-all text-[#141414]"
          >
            CERRAR
          </button>
        </div>
      </div>
    </div>
  );
};

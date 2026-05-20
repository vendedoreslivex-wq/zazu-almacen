import React, { useState, useRef } from 'react';
import { useAppContext } from '../store/AppContext';
import { ModuleInfo } from '../components/ModuleInfo';
import { QRCodeSVG } from 'qrcode.react';
import { Printer, Search, Tag, MapPin } from 'lucide-react';

type LabelMode = 'products' | 'locations';

export const Labels: React.FC = () => {
  const { products, locations, stockLevels, activeBrand } = useAppContext();
  const [mode, setMode] = useState<LabelMode>('products');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [labelSize, setLabelSize] = useState<'sm' | 'md' | 'lg'>('md');
  const printRef = useRef<HTMLDivElement>(null);

  const QR_SIZE = { sm: 60, md: 80, lg: 110 };
  const LABEL_W = { sm: 130, md: 160, lg: 220 };

  const filteredProducts = products.filter(p =>
    `${p.code} ${p.name} ${p.color || ''} ${p.size || ''}`.toLowerCase().includes(search.toLowerCase())
  );
  const filteredLocations = locations.filter(l =>
    l.name.toLowerCase().includes(search.toLowerCase())
  );

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    const items = mode === 'products' ? filteredProducts : filteredLocations;
    setSelected(new Set(items.map(i => i.id)));
  };

  const clearSelection = () => setSelected(new Set());

  const selectedProducts = products.filter(p => selected.has(p.id));
  const selectedLocations = locations.filter(l => selected.has(l.id));

  const stockForProduct = (productId: string) =>
    stockLevels.filter(s => s.productId === productId).reduce((s, l) => s + l.quantity, 0);

  const getQRValue = (item: { id: string; [key: string]: unknown }) => {
    if (mode === 'products') {
      const p = products.find(x => x.id === item.id);
      if (!p) return item.id;
      return JSON.stringify({ id: p.id, code: p.code, name: p.name, color: p.color, size: p.size, brand: activeBrand });
    } else {
      const l = locations.find(x => x.id === item.id);
      if (!l) return item.id;
      return JSON.stringify({ id: l.id, name: l.name, type: l.type, brand: activeBrand });
    }
  };

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <html><head><title>Etiquetas QR — ${activeBrand}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Courier New', monospace; background: white; }
        .grid { display: flex; flex-wrap: wrap; gap: 8px; padding: 16px; }
        .label { border: 1px solid #141414; padding: 8px; display: flex; flex-direction: column; align-items: center; gap: 4px; width: ${LABEL_W[labelSize]}px; }
        .brand { font-size: 7px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; }
        .code { font-size: 8px; font-weight: bold; text-transform: uppercase; }
        .name { font-size: 7px; text-align: center; opacity: 0.8; }
        .attr { font-size: 7px; opacity: 0.6; }
        .stock { font-size: 7px; background: #141414; color: #E4E3E0; padding: 1px 4px; }
        @media print { body { padding: 0; } .grid { gap: 4px; padding: 8px; } }
      </style></head><body>
      <div class="grid">${content.innerHTML}</div>
      </body></html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 400);
  };

  const renderLabel = (id: string) => {
    const qrValue = mode === 'products'
      ? getQRValue(products.find(p => p.id === id) || { id })
      : getQRValue(locations.find(l => l.id === id) || { id });

    if (mode === 'products') {
      const p = products.find(x => x.id === id);
      if (!p) return null;
      const stock = stockForProduct(p.id);
      return (
        <div key={id} className="border border-[#141414] p-2 flex flex-col items-center gap-1 bg-white" style={{ width: LABEL_W[labelSize] }}>
          <div className="font-mono text-[7px] font-bold uppercase tracking-widest opacity-60">{activeBrand.replace('_', ' ')}</div>
          <QRCodeSVG value={qrValue} size={QR_SIZE[labelSize]} />
          <div className="font-mono text-[8px] font-black">{p.code}</div>
          <div className="font-mono text-[7px] text-center leading-tight">{p.name}</div>
          {(p.color || p.size) && <div className="font-mono text-[7px] opacity-60">{[p.color, p.size].filter(Boolean).join(' / ')}</div>}
          {stock > 0 && <div className="font-mono text-[7px] bg-[#141414] text-[#E4E3E0] px-1.5 py-0.5">STOCK: {stock}</div>}
        </div>
      );
    } else {
      const l = locations.find(x => x.id === id);
      if (!l) return null;
      return (
        <div key={id} className="border border-[#141414] p-2 flex flex-col items-center gap-1 bg-white" style={{ width: LABEL_W[labelSize] }}>
          <div className="font-mono text-[7px] font-bold uppercase tracking-widest opacity-60">{activeBrand.replace('_', ' ')}</div>
          <QRCodeSVG value={qrValue} size={QR_SIZE[labelSize]} />
          <div className="font-mono text-[9px] font-black text-center">{l.name}</div>
          <div className="font-mono text-[7px] opacity-60 bg-[#141414]/10 px-2 py-0.5">{l.type}</div>
        </div>
      );
    }
  };

  return (
    <div className="flex flex-col gap-6 h-full">
      <ModuleInfo number="11" title="Etiquetas QR" description="Generación e impresión de etiquetas con código QR para identificar productos físicamente en el almacén y agilizar las operaciones de picking." />
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 border-b border-[#141414] pb-3">
        <div>
          <h2 className="font-serif italic font-bold text-xs uppercase tracking-widest text-[#141414]">12 // ETIQUETAS_QR</h2>
          <p className="font-mono text-[10px] opacity-70 uppercase tracking-wide mt-1">Generación e impresión de etiquetas con código QR.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select value={labelSize} onChange={e => setLabelSize(e.target.value as any)}
            className="border border-[#141414] bg-white/50 px-3 py-2 text-[10px] font-mono font-bold uppercase focus:outline-none cursor-pointer">
            <option value="sm">PEQUEÑA</option>
            <option value="md">MEDIANA</option>
            <option value="lg">GRANDE</option>
          </select>
          <button onClick={handlePrint} disabled={selected.size === 0}
            className="flex items-center gap-2 bg-[#141414] text-[#E4E3E0] px-4 py-2 text-xs font-bold font-mono uppercase hover:shadow-[3px_3px_0_#9f9d99] transition-all border border-[#141414] disabled:opacity-30 disabled:cursor-not-allowed">
            <Printer size={14} /> IMPRIMIR ({selected.size})
          </button>
        </div>
      </div>

      {/* Mode toggle */}
      <div className="flex border border-[#141414]">
        <button onClick={() => { setMode('products'); clearSelection(); }}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-[10px] font-bold font-mono uppercase transition-all ${mode === 'products' ? 'bg-[#141414] text-[#E4E3E0]' : 'bg-white/30 hover:bg-white/60'}`}>
          <Tag size={13} /> Productos
        </button>
        <button onClick={() => { setMode('locations'); clearSelection(); }}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-[10px] font-bold font-mono uppercase transition-all border-l border-[#141414] ${mode === 'locations' ? 'bg-[#141414] text-[#E4E3E0]' : 'bg-white/30 hover:bg-white/60'}`}>
          <MapPin size={13} /> Ubicaciones
        </button>
      </div>

      {/* Search + controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 border border-[#141414] bg-white/50 px-3 py-2 flex-1 min-w-48">
          <Search size={13} className="opacity-40 shrink-0" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..."
            className="bg-transparent flex-1 text-xs font-mono focus:outline-none placeholder:opacity-40" />
        </div>
        <button onClick={selectAll} className="font-mono text-[10px] font-bold uppercase hover:underline opacity-60 hover:opacity-100">SELEC. TODOS</button>
        <button onClick={clearSelection} className="font-mono text-[10px] font-bold uppercase hover:underline opacity-60 hover:opacity-100">LIMPIAR</button>
        <span className="font-mono text-[10px] opacity-50">{selected.size} seleccionados</span>
      </div>

      {/* Item list */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-72 overflow-y-auto pr-1">
        {(mode === 'products' ? filteredProducts : filteredLocations).map(item => {
          const isSelected = selected.has(item.id);
          const label = mode === 'products'
            ? (() => { const p = item as typeof products[0]; return `${p.code} ${p.name} ${p.color || ''} ${p.size || ''}`.trim(); })()
            : item.name;
          return (
            <button key={item.id} onClick={() => toggleSelect(item.id)}
              className={`text-left px-3 py-2 border text-[10px] font-mono transition-all ${isSelected ? 'bg-[#141414] text-[#E4E3E0] border-[#141414]' : 'border-[#141414]/40 bg-white/30 hover:border-[#141414] hover:bg-white/60'}`}>
              <div className="font-bold truncate">{label}</div>
              {mode === 'products' && <div className="opacity-50 text-[8px] mt-0.5">{(item as typeof products[0]).category}</div>}
              {mode === 'locations' && <div className="opacity-50 text-[8px] mt-0.5">{(item as typeof locations[0]).type}</div>}
            </button>
          );
        })}
      </div>

      {/* Preview */}
      {selected.size > 0 && (
        <div className="border-t border-[#141414] pt-4">
          <div className="font-mono text-[9px] font-bold uppercase tracking-widest opacity-60 mb-3">PREVISUALIZACIÓN</div>
          <div ref={printRef} className="flex flex-wrap gap-3">
            {[...selected].map(id => renderLabel(id))}
          </div>
        </div>
      )}

      {selected.size === 0 && (
        <div className="text-center font-mono text-xs opacity-40 py-8 uppercase tracking-widest border border-dashed border-[#141414]/30">
          Selecciona ítems arriba para previsualizar las etiquetas
        </div>
      )}
    </div>
  );
};

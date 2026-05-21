import React, { useState, useRef } from 'react';
import { useAppContext } from '../store/AppContext';
import { ModuleInfo } from '../components/ModuleInfo';
import { QRCodeSVG } from 'qrcode.react';
import { Printer, Search, Tag, MapPin } from 'lucide-react';

type LabelMode = 'products' | 'locations';
type LabelStyle = 'qr' | 'barcode' | 'both';

// Code128B encoder — returns array of bar/space widths as booleans (true=bar)
const CODE128B_TABLE: Record<string, number> = {
  ' ':0,'!':1,'"':2,'#':3,'$':4,'%':5,'&':6,"'":7,'(':8,')':9,'*':10,'+':11,
  ',':12,'-':13,'.':14,'/':15,'0':16,'1':17,'2':18,'3':19,'4':20,'5':21,
  '6':22,'7':23,'8':24,'9':25,':':26,';':27,'<':28,'=':29,'>':30,'?':31,
  '@':32,'A':33,'B':34,'C':35,'D':36,'E':37,'F':38,'G':39,'H':40,'I':41,
  'J':42,'K':43,'L':44,'M':45,'N':46,'O':47,'P':48,'Q':49,'R':50,'S':51,
  'T':52,'U':53,'V':54,'W':55,'X':56,'Y':57,'Z':58,'[':59,'\\':60,']':61,
  '^':62,'_':63,'`':64,'a':65,'b':66,'c':67,'d':68,'e':69,'f':70,'g':71,
  'h':72,'i':73,'j':74,'k':75,'l':76,'m':77,'n':78,'o':79,'p':80,'q':81,
  'r':82,'s':83,'t':84,'u':85,'v':86,'w':87,'x':88,'y':89,'z':90,
};

const CODE128_PATTERNS: string[] = [
  '11011001100','11001101100','11001100110','10010011000','10010001100',
  '10001001100','10011001000','10011000100','10001100100','11001001000',
  '11001000100','11000100100','10110011100','10011011100','10011001110',
  '10111001100','10011101100','10011100110','11001110010','11001011100',
  '11001001110','11011100100','11001110100','11101101110','11101001100',
  '11100101100','11100100110','11101100100','11100110100','11100110010',
  '11011011000','11011000110','11000110110','10100011000','10001011000',
  '10001000110','10110001000','10001101000','10001100010','11010001000',
  '11000101000','11000100010','10110111000','10110001110','10001101110',
  '10111011000','10111000110','10001110110','11101110110','11010001110',
  '11000101110','11011101000','11011100010','11011101110','11101011000',
  '11101000110','11100010110','11101101000','11101100010','11100011010',
  '11101111010','11001000010','11110001010','10100110000','10100001100',
  '10010110000','10010000110','10000101100','10000100110','10110010000',
  '10110000100','10011010000','10011000010','10000110100','10000110010',
  '11000010010','11001010000','11110111010','11000010100','10001111010',
  '10100111100','10010111100','10010011110','10111100100','10011110100',
  '10011110010','11110100100','11110010100','11110010010','11011011110',
  '11011110110','11110110110','10101111000','10100011110','10001011110',
  '10111101000','10111100010','11110101000','11110100010','10111011110',
  '10111101110','11101011110','11110101110','11010000100','11010010000',
  '11010011100','1100011101011',
];

function encodeCode128B(text: string): boolean[] {
  const chars = text.toUpperCase().replace(/[^\x20-\x7E]/g, '');
  const values: number[] = [104]; // START B
  for (const ch of chars) {
    const idx = CODE128B_TABLE[ch] ?? CODE128B_TABLE[' '];
    values.push(idx);
  }
  // Checksum
  let check = values[0];
  for (let i = 1; i < values.length; i++) check = (check + i * values[i]) % 103;
  values.push(check);
  values.push(106); // STOP

  const bits: boolean[] = [];
  for (const v of values) {
    const pattern = CODE128_PATTERNS[v] ?? CODE128_PATTERNS[0];
    for (let i = 0; i < pattern.length; i++) {
      bits.push(pattern[i] === '1');
    }
  }
  // Trailing quiet zone
  for (let i = 0; i < 10; i++) bits.push(false);
  return bits;
}

const Barcode: React.FC<{ value: string; height?: number; className?: string }> = ({ value, height = 40, className }) => {
  const bits = encodeCode128B(value.slice(0, 30));
  const moduleW = 1.2;
  const width = bits.length * moduleW;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={className} xmlns="http://www.w3.org/2000/svg">
      {bits.map((dark, i) =>
        dark ? <rect key={i} x={i * moduleW} y={0} width={moduleW} height={height} fill="#141414" /> : null
      )}
    </svg>
  );
};

export const Labels: React.FC = () => {
  const { products, locations, stockLevels, activeBrand } = useAppContext();
  const [mode, setMode] = useState<LabelMode>('products');
  const [labelStyle, setLabelStyle] = useState<LabelStyle>('qr');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [labelSize, setLabelSize] = useState<'sm' | 'md' | 'lg'>('md');
  const [showPrice, setShowPrice] = useState(true);
  const [showStock, setShowStock] = useState(true);
  const [showCategory, setShowCategory] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const QR_SIZE = { sm: 50, md: 70, lg: 100 };
  const BAR_H = { sm: 28, md: 36, lg: 52 };
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
      <html><head><title>Etiquetas — ${activeBrand}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Courier New', monospace; background: white; }
        .grid { display: flex; flex-wrap: wrap; gap: 8px; padding: 16px; }
        .label { border: 1px solid #141414; padding: 8px; display: flex; flex-direction: column; align-items: center; gap: 4px; width: ${LABEL_W[labelSize]}px; }
        .brand { font-size: 7px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; }
        .code { font-size: 8px; font-weight: bold; text-transform: uppercase; }
        .name { font-size: 7px; text-align: center; opacity: 0.8; }
        .attr { font-size: 7px; opacity: 0.6; }
        .price { font-size: 9px; font-weight: bold; }
        .stock { font-size: 7px; background: #141414; color: #E4E3E0; padding: 1px 4px; }
        svg { max-width: 100%; }
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
    if (mode === 'products') {
      const p = products.find(x => x.id === id);
      if (!p) return null;
      const stock = stockForProduct(p.id);
      const qrValue = getQRValue({ id });
      const barcodeValue = p.code;
      return (
        <div key={id} className="border border-[#141414] p-2 flex flex-col items-center gap-1 bg-white" style={{ width: LABEL_W[labelSize] }}>
          <div className="font-mono text-[7px] font-bold uppercase tracking-widest opacity-60">{activeBrand.replace('_', ' ')}</div>
          {(labelStyle === 'qr' || labelStyle === 'both') && (
            <QRCodeSVG value={qrValue} size={QR_SIZE[labelSize]} />
          )}
          {(labelStyle === 'barcode' || labelStyle === 'both') && (
            <div className="flex flex-col items-center gap-0.5">
              <Barcode value={barcodeValue} height={BAR_H[labelSize]} />
              <div className="font-mono text-[7px] tracking-wider opacity-70">{barcodeValue}</div>
            </div>
          )}
          <div className="font-mono text-[8px] font-black">{p.code}</div>
          <div className="font-mono text-[7px] text-center leading-tight">{p.name}</div>
          {(p.color || p.size) && <div className="font-mono text-[7px] opacity-60">{[p.color, p.size].filter(Boolean).join(' / ')}</div>}
          {showCategory && p.category && <div className="font-mono text-[7px] opacity-50 uppercase">{p.category}</div>}
          {showPrice && p.sellPrice != null && (
            <div className="font-mono text-[9px] font-black border border-[#141414] px-1">
              S/ {p.sellPrice.toFixed(2)}
            </div>
          )}
          {showStock && stock > 0 && <div className="font-mono text-[7px] bg-[#141414] text-[#E4E3E0] px-1.5 py-0.5">STOCK: {stock}</div>}
        </div>
      );
    } else {
      const l = locations.find(x => x.id === id);
      if (!l) return null;
      const qrValue = getQRValue({ id });
      return (
        <div key={id} className="border border-[#141414] p-2 flex flex-col items-center gap-1 bg-white" style={{ width: LABEL_W[labelSize] }}>
          <div className="font-mono text-[7px] font-bold uppercase tracking-widest opacity-60">{activeBrand.replace('_', ' ')}</div>
          {(labelStyle === 'qr' || labelStyle === 'both') && (
            <QRCodeSVG value={qrValue} size={QR_SIZE[labelSize]} />
          )}
          {(labelStyle === 'barcode' || labelStyle === 'both') && (
            <div className="flex flex-col items-center gap-0.5">
              <Barcode value={l.name} height={BAR_H[labelSize]} />
              <div className="font-mono text-[7px] tracking-wider opacity-70">{l.name}</div>
            </div>
          )}
          <div className="font-mono text-[9px] font-black text-center">{l.name}</div>
          <div className="font-mono text-[7px] opacity-60 bg-[#141414]/10 px-2 py-0.5">{l.type}</div>
        </div>
      );
    }
  };

  return (
    <div className="flex flex-col gap-6 h-full">
      <ModuleInfo number="11" title="Etiquetas QR" description="Generación e impresión de etiquetas con código QR y/o código de barras para identificar productos físicamente en el almacén y agilizar las operaciones de picking." />
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 border-b border-[#141414] pb-3">
        <div>
          <h2 className="font-serif italic font-bold text-xs uppercase tracking-widest text-[#141414]">12 // ETIQUETAS_QR</h2>
          <p className="font-mono text-[10px] opacity-70 uppercase tracking-wide mt-1">Generación e impresión de etiquetas con código QR y de barras.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select value={labelSize} onChange={e => setLabelSize(e.target.value as 'sm' | 'md' | 'lg')}
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

      {/* Label style + extra fields */}
      <div className="flex flex-wrap items-center gap-4 border border-[#141414]/30 bg-white/30 p-3">
        <div className="flex flex-col gap-1">
          <span className="font-mono text-[8px] uppercase tracking-widest opacity-50">CÓDIGO</span>
          <div className="flex border border-[#141414]">
            {(['qr', 'barcode', 'both'] as LabelStyle[]).map(s => (
              <button key={s} onClick={() => setLabelStyle(s)}
                className={`px-3 py-1.5 text-[9px] font-bold font-mono uppercase border-r last:border-r-0 border-[#141414] transition-colors ${labelStyle === s ? 'bg-[#141414] text-[#E4E3E0]' : 'hover:bg-white/60'}`}>
                {s === 'qr' ? 'QR' : s === 'barcode' ? 'BARRAS' : 'AMBOS'}
              </button>
            ))}
          </div>
        </div>
        {mode === 'products' && (
          <div className="flex flex-col gap-1">
            <span className="font-mono text-[8px] uppercase tracking-widest opacity-50">MOSTRAR EN ETIQUETA</span>
            <div className="flex gap-2">
              {[
                { key: 'price', label: 'PRECIO', value: showPrice, set: setShowPrice },
                { key: 'stock', label: 'STOCK', value: showStock, set: setShowStock },
                { key: 'cat', label: 'CATEGORÍA', value: showCategory, set: setShowCategory },
              ].map(opt => (
                <button key={opt.key} onClick={() => opt.set(!opt.value)}
                  className={`px-2 py-1.5 text-[9px] font-bold font-mono uppercase border transition-colors ${opt.value ? 'bg-[#141414] text-[#E4E3E0] border-[#141414]' : 'border-[#141414]/40 hover:border-[#141414]'}`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}
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

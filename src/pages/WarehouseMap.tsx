import React, { useState, useMemo } from 'react';
import { useAppContext } from '../store/AppContext';
import { ModuleInfo } from '../components/ModuleInfo';
import { MapPin, Package, X, TrendingDown, AlertTriangle, CheckCircle, Circle } from 'lucide-react';
import { TutorialModal, WAREHOUSE_MAP_TUTORIAL_STEPS } from '../components/TutorialModal';

const TYPE_LABEL: Record<string, string> = {
  ZONE: 'ZONA',
  RACK: 'ESTANTE',
  BIN: 'CASILLERO',
  EXTERNAL: 'EXTERNO',
  WAREHOUSE: 'ALMACEN',
};

const TYPE_ICON: Record<string, string> = {
  ZONE: '?',
  RACK: '?',
  BIN: '?',
  EXTERNAL: '?',
  WAREHOUSE: '?',
};

type FillLevel = 'empty' | 'low' | 'medium' | 'high';

function getFillLevel(stock: number, capacity: number): FillLevel {
  if (stock === 0) return 'empty';
  const ratio = stock / capacity;
  if (ratio < 0.25) return 'low';
  if (ratio < 0.7) return 'medium';
  return 'high';
}

const FILL_STYLES: Record<FillLevel, string> = {
  empty: 'bg-[var(--bg-modal)] border-[var(--border)]/20 text-[var(--ink)]/40',
  low: 'bg-red-500/10 border-red-400 text-red-700',
  medium: 'bg-yellow-500/10 border-yellow-500 text-yellow-600',
  high: 'bg-green-500/10 border-green-600 text-green-600',
};

const FILL_BAR: Record<FillLevel, string> = {
  empty: 'bg-[var(--ink)]/10',
  low: 'bg-red-400',
  medium: 'bg-yellow-400',
  high: 'bg-green-500',
};

const FILL_LABEL: Record<FillLevel, string> = {
  empty: 'VACIO',
  low: 'BAJO',
  medium: 'NORMAL',
  high: 'LLENO',
};

export const WarehouseMap: React.FC = () => {
  const { locations, products, stockLevels, activeBrand } = useAppContext();
  const [selected, setSelected] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterFill, setFilterFill] = useState<FillLevel | 'ALL'>('ALL');
  const [showTutorial, setShowTutorial] = useState(false);

  const locationStats = useMemo(() => {
    return locations.map(loc => {
      const stocks = stockLevels.filter(s => s.locationId === loc.id);
      const totalUnits = stocks.reduce((sum, s) => sum + s.quantity, 0);
      const skuCount = stocks.filter(s => s.quantity > 0).length;
      const capacity = loc.type === 'ZONE' ? 500 : loc.type === 'WAREHOUSE' ? 1000 : loc.type === 'RACK' ? 200 : 100;
      const fill = getFillLevel(totalUnits, capacity);
      const lowStockItems = stocks.filter(s => {
        const product = products.find(p => p.id === s.productId);
        return product?.lowStockThreshold && s.quantity <= product.lowStockThreshold;
      });
      return { loc, totalUnits, skuCount, capacity, fill, lowStockItems, stocks };
    });
  }, [locations, stockLevels, products]);

  const filtered = locationStats.filter(ls =>
    (filterType === 'ALL' || ls.loc.type === filterType) &&
    (filterFill === 'ALL' || ls.fill === filterFill)
  );

  const selectedStat = locationStats.find(ls => ls.loc.id === selected);

  const summary = useMemo(() => ({
    empty: locationStats.filter(ls => ls.fill === 'empty').length,
    low: locationStats.filter(ls => ls.fill === 'low').length,
    medium: locationStats.filter(ls => ls.fill === 'medium').length,
    high: locationStats.filter(ls => ls.fill === 'high').length,
  }), [locationStats]);

  const types = [...new Set(locations.map(l => l.type))];

  return (
    <div className="flex flex-col gap-6 h-full">
      <TutorialModal open={showTutorial} onClose={() => setShowTutorial(false)} steps={WAREHOUSE_MAP_TUTORIAL_STEPS} title="Mapa del Almacén" />
      <div className="flex items-stretch gap-0">
        <div className="flex-1">
          <ModuleInfo number="12" title="Mapa del Almacen" description="Mapa visual del almacen que muestra el nivel de ocupacion por ubicacion. Identifica rápidamente zonas vacias, llenas o con stock crítico." />
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 border-b border-[var(--border)] pb-3">
        <div>
          <h2 className="font-serif italic font-bold text-xs uppercase tracking-widest text-[var(--ink)]">13 // MAPA_ALMACEN</h2>
          <p className="font-mono text-[10px] opacity-70 uppercase tracking-wide mt-1">Visualizacion del estado de stock por ubicacion.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select value={filterType} onChange={e => setFilterType(e.target.value)}
            className="border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[10px] font-mono font-bold uppercase focus:outline-none cursor-pointer">
            <option value="ALL">TODOS LOS TIPOS</option>
            {types.map(t => <option key={String(t)} value={String(t)}>{TYPE_LABEL[String(t)] || String(t)}</option>)}
          </select>
          <select value={filterFill} onChange={e => setFilterFill(e.target.value as any)}
            className="border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[10px] font-mono font-bold uppercase focus:outline-none cursor-pointer">
            <option value="ALL">TODOS LOS NIVELES</option>
            <option value="empty">VACIO</option>
            <option value="low">BAJO</option>
            <option value="medium">NORMAL</option>
            <option value="high">LLENO</option>
          </select>
        </div>
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-4 gap-2">
        {([
          { key: 'empty', label: 'VACIO', icon: Circle, color: 'text-[var(--ink)]/40 border-[var(--border)]/20 bg-[var(--bg-modal)]' },
          { key: 'low', label: 'BAJO', icon: AlertTriangle, color: 'text-red-700 border-red-500/50 bg-red-500/10' },
          { key: 'medium', label: 'NORMAL', icon: TrendingDown, color: 'text-yellow-600 border-yellow-500/50 bg-yellow-500/10' },
          { key: 'high', label: 'LLENO', icon: CheckCircle, color: 'text-green-600 border-green-500/50 bg-green-500/10' },
        ] as const).map(({ key, label, icon: Icon, color }) => (
          <button key={key}
            onClick={() => setFilterFill(filterFill === key ? 'ALL' : key)}
            className={`border p-3 flex flex-col items-center gap-1 transition-all cursor-pointer ${filterFill === key ? 'ring-2 ring-[#141414]' : ''} ${color}`}>
            <Icon size={16} />
            <div className="font-mono font-black text-lg leading-none">{summary[key]}</div>
            <div className="font-mono text-[8px] uppercase tracking-widest opacity-70">{label}</div>
          </button>
        ))}
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        {/* Map grid */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="text-center font-mono text-xs opacity-40 py-16 uppercase tracking-widest border border-dashed border-[var(--border)]/30">
              Sin ubicaciones para mostrar
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {filtered.map(({ loc, totalUnits, skuCount, capacity, fill, lowStockItems }) => {
                const barWidth = Math.min(100, Math.round((totalUnits / capacity) * 100));
                const isSelected = selected === loc.id;
                return (
                  <button key={loc.id} onClick={() => setSelected(isSelected ? null : loc.id)}
                    className={`border-2 p-3 flex flex-col gap-2 text-left transition-all cursor-pointer group relative ${FILL_STYLES[fill]} ${isSelected ? 'ring-2 ring-[#141414] shadow-[3px_3px_0_var(--border)]' : 'hover:shadow-[2px_2px_0_var(--border)]'}`}>

                    {lowStockItems.length > 0 && (
                      <div className="absolute top-2 right-2">
                        <AlertTriangle size={11} className="text-red-500" />
                      </div>
                    )}

                    <div className="flex items-start gap-2">
                      <span className="text-base leading-none mt-0.5">{TYPE_ICON[loc.type] || '?'}</span>
                      <div className="min-w-0">
                        <div className="font-mono font-black text-[10px] leading-tight truncate">{loc.name}</div>
                        <div className="font-mono text-[8px] opacity-50 uppercase tracking-widest mt-0.5">{TYPE_LABEL[loc.type] || loc.type}</div>
                      </div>
                    </div>

                    {/* Fill bar */}
                    <div className="w-full h-1.5 bg-[var(--ink)]/10 rounded-none">
                      <div className={`h-full transition-all ${FILL_BAR[fill]}`} style={{ width: `${barWidth}%` }} />
                    </div>

                    <div className="flex justify-between items-end">
                      <div>
                        <div className="font-mono font-black text-lg leading-none">{totalUnits}</div>
                        <div className="font-mono text-[7px] opacity-50 uppercase">unidades</div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono font-bold text-xs">{skuCount}</div>
                        <div className="font-mono text-[7px] opacity-50 uppercase">SKUs</div>
                      </div>
                    </div>

                    <div className={`font-mono text-[7px] font-bold uppercase tracking-widest px-1.5 py-0.5 self-start ${
                      fill === 'empty' ? 'bg-[var(--ink)]/10 text-[var(--ink)]/40' :
                      fill === 'low' ? 'bg-red-500 text-white' :
                      fill === 'medium' ? 'bg-yellow-400 text-yellow-900' :
                      'bg-green-500 text-white'
                    }`}>
                      {FILL_LABEL[fill]} {barWidth}%
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Detail panel */}
        {selectedStat && (
          <div className="w-72 shrink-0 border border-[var(--border)] bg-[var(--bg)] flex flex-col max-h-full overflow-hidden">
            <div className="border-b border-[var(--border)] px-4 py-3 flex justify-between items-center shrink-0">
              <div>
                <div className="font-mono font-black text-xs uppercase">{selectedStat.loc.name}</div>
                <div className="font-mono text-[8px] opacity-50 uppercase tracking-widest mt-0.5">{TYPE_LABEL[selectedStat.loc.type]}</div>
              </div>
              <button onClick={() => setSelected(null)} className="opacity-40 hover:opacity-100 transition-opacity">
                <X size={14} />
              </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 border-b border-[var(--border)] shrink-0">
              {[
                { label: 'UNIDADES', value: selectedStat.totalUnits },
                { label: 'SKUs', value: selectedStat.skuCount },
                { label: 'ALERTAS', value: selectedStat.lowStockItems.length },
              ].map(({ label, value }) => (
                <div key={label} className="p-3 border-r border-[var(--border)] last:border-r-0 text-center">
                  <div className="font-mono font-black text-xl">{value}</div>
                  <div className="font-mono text-[7px] opacity-50 uppercase tracking-widest">{label}</div>
                </div>
              ))}
            </div>

            {/* Product list */}
            <div className="flex-1 overflow-y-auto">
              {selectedStat.stocks.filter(s => s.quantity > 0).length === 0 ? (
                <div className="p-6 text-center font-mono text-[10px] opacity-40 uppercase">Ubicacion vacia</div>
              ) : (
                <div className="flex flex-col divide-y divide-[#141414]/20">
                  {selectedStat.stocks
                    .filter(s => s.quantity > 0)
                    .sort((a, b) => b.quantity - a.quantity)
                    .map(s => {
                      const prod = products.find(p => p.id === s.productId);
                      if (!prod) return null;
                      const isLow = prod.lowStockThreshold != null && s.quantity <= prod.lowStockThreshold;
                      return (
                        <div key={s.id} className={`px-4 py-2.5 flex items-center justify-between gap-2 ${isLow ? 'bg-red-500/10' : ''}`}>
                          <div className="min-w-0">
                            <div className="font-mono font-bold text-[10px] truncate flex items-center gap-1">
                              {isLow && <AlertTriangle size={9} className="text-red-500 shrink-0" />}
                              {prod.code}
                            </div>
                            <div className="font-mono text-[8px] opacity-60 truncate">{prod.name} {prod.color || ''} {prod.size || ''}</div>
                          </div>
                          <div className="shrink-0 text-right">
                            <div className={`font-mono font-black text-sm ${isLow ? 'text-red-600' : 'text-[var(--ink)]'}`}>{s.quantity}</div>
                            {prod.lowStockThreshold && (
                              <div className="font-mono text-[7px] opacity-40">mín {prod.lowStockThreshold}</div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            {/* Legend */}
            <div className="border-t border-[var(--border)] px-4 py-2 shrink-0 flex flex-wrap gap-x-3 gap-y-1">
              {(['empty', 'low', 'medium', 'high'] as FillLevel[]).map(f => (
                <div key={f} className="flex items-center gap-1">
                  <div className={`w-2 h-2 ${FILL_BAR[f]}`} />
                  <span className="font-mono text-[7px] opacity-60 uppercase">{FILL_LABEL[f]}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

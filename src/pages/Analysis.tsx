import React, { useState, useMemo } from 'react';
import { useAppContext } from '../store/AppContext';
import { ModuleInfo } from '../components/ModuleInfo';
import { TrendingUp, TrendingDown, Package, BarChart2, AlertTriangle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

type Tab = 'summary' | 'ranking' | 'tallas' | 'colores';

const TABS: { id: Tab; label: string }[] = [
  { id: 'summary',  label: 'RESUMEN'  },
  { id: 'ranking',  label: 'RANKING'  },
  { id: 'tallas',   label: 'TALLAS'   },
  { id: 'colores',  label: 'COLORES'  },
];

export const Analysis: React.FC = () => {
  const { products, stockLevels, transactions } = useAppContext();
  const [tab, setTab] = useState<Tab>('summary');
  const [rankSort, setRankSort] = useState<'dispatched' | 'stock' | 'ratio'>('dispatched');

  const totalStock = useMemo(
    () => stockLevels.reduce((s, sl) => s + sl.quantity, 0),
    [stockLevels]
  );

  const productData = useMemo(() => {
    return products.map(prod => {
      const stock = stockLevels
        .filter(sl => sl.productId === prod.id)
        .reduce((s, sl) => s + sl.quantity, 0);
      const dispatched = transactions
        .filter(t => t.type === 'DISPATCH' && t.productId === prod.id)
        .reduce((s, t) => s + t.quantity, 0);
      const received = transactions
        .filter(t => t.type === 'RECEPTION' && t.productId === prod.id)
        .reduce((s, t) => s + t.quantity, 0);
      const ratio = received > 0 ? (dispatched / received) * 100 : 0;
      return { prod, stock, dispatched, received, ratio };
    });
  }, [products, stockLevels, transactions]);

  const withStock   = useMemo(() => productData.filter(d => d.stock > 0), [productData]);
  const noMovement  = useMemo(() => productData.filter(d => d.stock > 0 && d.dispatched === 0), [productData]);
  const totalDisp   = useMemo(() => productData.reduce((s, d) => s + d.dispatched, 0), [productData]);
  const totalRecv   = useMemo(() => productData.reduce((s, d) => s + d.received, 0), [productData]);

  const ranked = useMemo(() => {
    return [...productData].sort((a, b) => {
      if (rankSort === 'dispatched') return b.dispatched - a.dispatched;
      if (rankSort === 'stock')      return b.stock - a.stock;
      return b.ratio - a.ratio;
    });
  }, [productData, rankSort]);

  const sizeData = useMemo(() => {
    const map = new Map<string, { stock: number; dispatched: number }>();
    productData.forEach(d => {
      const key = d.prod.size?.trim() || 'S/T';
      const prev = map.get(key) || { stock: 0, dispatched: 0 };
      map.set(key, { stock: prev.stock + d.stock, dispatched: prev.dispatched + d.dispatched });
    });
    return Array.from(map.entries())
      .map(([size, v]) => ({ size, ...v, ratio: v.dispatched > 0 || v.stock > 0 ? v.dispatched / (v.dispatched + v.stock) * 100 : 0 }))
      .sort((a, b) => b.dispatched - a.dispatched);
  }, [productData]);

  const colorData = useMemo(() => {
    const map = new Map<string, { stock: number; dispatched: number; skus: number }>();
    productData.forEach(d => {
      const key = d.prod.color?.trim() || 'S/C';
      const prev = map.get(key) || { stock: 0, dispatched: 0, skus: 0 };
      map.set(key, { stock: prev.stock + d.stock, dispatched: prev.dispatched + d.dispatched, skus: prev.skus + 1 });
    });
    return Array.from(map.entries())
      .map(([color, v]) => ({ color, ...v, ratio: v.dispatched > 0 || v.stock > 0 ? v.dispatched / (v.dispatched + v.stock) * 100 : 0 }))
      .sort((a, b) => b.dispatched - a.dispatched);
  }, [productData]);

  const top8Disp = useMemo(() =>
    [...productData].sort((a, b) => b.dispatched - a.dispatched).slice(0, 8),
    [productData]
  );

  return (
    <div className="h-full flex flex-col gap-6">
      <ModuleInfo number="02" title="Rendimiento de Productos" description="Ranking de despachos, variantes más y menos demandadas, y análisis de rotación por talla y color." />
      <div className="border-b border-[#141414] pb-3">
        <h2 className="font-serif italic font-bold text-xs uppercase tracking-widest text-[#141414]">05 // RENDIMIENTO DE PRODUCTOS</h2>
        <p className="font-mono text-[10px] opacity-70 uppercase tracking-wide mt-1">Qué variantes se mueven, cuáles no, y cómo se distribuye la demanda.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border border-[#141414] overflow-x-auto scrollbar-none">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 py-2 text-[10px] font-bold font-mono uppercase tracking-widest transition-colors border-r last:border-r-0 border-[#141414] whitespace-nowrap px-3 ${tab === t.id ? 'bg-[#141414] text-[#E4E3E0]' : 'bg-white/30 hover:bg-white/60'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── RESUMEN ── */}
      {tab === 'summary' && (
        <div className="flex flex-col gap-4">
          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="SKUs con stock" value={withStock.length} sub={`de ${products.length} total`} />
            <StatCard label="Sin movimiento" value={noMovement.length} sub="nunca despachados" warn={noMovement.length > 0} />
            <StatCard label="Total despachado" value={totalDisp} sub="unidades salidas" dark />
            <StatCard label="Total recepcionado" value={totalRecv} sub="unidades entradas" />
          </div>

          {/* Tasa de rotación global */}
          <div className="border border-[#141414] bg-white/30 p-4">
            <div className="font-mono text-[9px] font-bold uppercase tracking-widest opacity-50 mb-3">TASA DE ROTACIÓN GLOBAL</div>
            <div className="flex items-end gap-3">
              <span className="font-mono font-black text-3xl">
                {totalRecv > 0 ? ((totalDisp / totalRecv) * 100).toFixed(1) : '0.0'}%
              </span>
              <span className="font-mono text-[9px] opacity-60 mb-1">de lo recepcionado fue despachado</span>
            </div>
            <div className="mt-3 h-2 bg-[#141414]/10 border border-[#141414]/20">
              <div
                className="h-full bg-[#141414] transition-all"
                style={{ width: `${Math.min(totalRecv > 0 ? (totalDisp / totalRecv) * 100 : 0, 100)}%` }}
              />
            </div>
          </div>

          {/* Top 8 gráfico */}
          <div className="border border-[#141414] bg-white/30 p-4">
            <div className="font-mono text-[9px] font-bold uppercase tracking-widest opacity-50 mb-4">TOP 8 — UNIDADES DESPACHADAS</div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={top8Disp} margin={{ top: 0, right: 0, bottom: 32, left: 0 }}>
                <XAxis dataKey={d => d.prod.code} tick={{ fontFamily: 'Courier New', fontSize: 9, fill: '#141414' }} angle={-35} textAnchor="end" interval={0} />
                <YAxis tick={{ fontFamily: 'Courier New', fontSize: 9, fill: '#141414' }} width={32} />
                <Tooltip
                  contentStyle={{ fontFamily: 'Courier New', fontSize: 10, border: '1px solid #141414', background: '#E4E3E0' }}
                  formatter={(v: number) => [v, 'Uds despachadas']}
                  labelFormatter={(_: unknown, p: readonly { payload?: { prod?: { name?: string; code?: string } } }[]) => {
                    const prod = (p as Array<{ payload?: { prod?: { name?: string; code?: string } } }>)[0]?.payload?.prod;
                    return prod ? `${prod.code} ${prod.name}` : '';
                  }}
                />
                <Bar dataKey="dispatched" radius={[2, 2, 0, 0]}>
                  {top8Disp.map((_, i) => <Cell key={i} fill={i === 0 ? '#141414' : '#9f9d99'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Sin movimiento */}
          {noMovement.length > 0 && (
            <div className="border border-amber-400 bg-amber-50 p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle size={13} className="text-amber-700" />
                <span className="font-mono text-[9px] font-bold uppercase tracking-widest text-amber-800">{noMovement.length} SKUs con stock sin ningún despacho registrado</span>
              </div>
              <div className="flex flex-col gap-1">
                {noMovement.slice(0, 8).map(d => (
                  <div key={d.prod.id} className="flex items-center justify-between text-[10px] font-mono border-b border-amber-200 pb-1">
                    <span><span className="font-bold">{d.prod.code}</span> <span className="opacity-60">{d.prod.name} {d.prod.color} {d.prod.size}</span></span>
                    <span className="font-bold text-amber-800">{d.stock} uds</span>
                  </div>
                ))}
                {noMovement.length > 8 && (
                  <div className="font-mono text-[9px] opacity-50 pt-1">+{noMovement.length - 8} más — ver tab Ranking</div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── RANKING ── */}
      {tab === 'ranking' && (
        <div className="flex flex-col gap-3">
          {/* Sort pills */}
          <div className="flex gap-2 items-center">
            <span className="font-mono text-[9px] opacity-40 uppercase tracking-widest">Ordenar por</span>
            {([
              { id: 'dispatched', label: 'Despachos' },
              { id: 'stock',      label: 'Stock'     },
              { id: 'ratio',      label: '% Rotación'},
            ] as const).map(s => (
              <button key={s.id} onClick={() => setRankSort(s.id)}
                className={`px-2.5 py-1 font-mono text-[9px] font-bold uppercase border border-[#141414] transition-colors ${rankSort === s.id ? 'bg-[#141414] text-[#E4E3E0]' : 'hover:bg-white/60'}`}>
                {s.label}
              </button>
            ))}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-[10px] font-mono border-collapse">
              <thead>
                <tr className="bg-[#141414] text-[#E4E3E0]">
                  <th className="text-left py-2 px-3 font-bold uppercase w-6">#</th>
                  <th className="text-left py-2 px-3 font-bold uppercase">Producto</th>
                  <th className="text-right py-2 px-3 font-bold uppercase">Stock</th>
                  <th className="text-right py-2 px-3 font-bold uppercase">Recep.</th>
                  <th className="text-right py-2 px-3 font-bold uppercase">Despachos</th>
                  <th className="text-right py-2 px-3 font-bold uppercase">% Rotación</th>
                </tr>
              </thead>
              <tbody>
                {ranked.map(({ prod, stock, dispatched, received, ratio }, i) => (
                  <tr key={prod.id} className={`border-b border-[#141414]/15 hover:bg-white/40 ${dispatched === 0 ? 'opacity-40' : ''}`}>
                    <td className="py-1.5 px-3 opacity-40 font-bold">{i + 1}</td>
                    <td className="py-1.5 px-3">
                      <span className="font-bold">{prod.code}</span>
                      <span className="opacity-60 ml-2">{prod.name} {prod.color} {prod.size}</span>
                    </td>
                    <td className="text-right py-1.5 px-3">{stock}</td>
                    <td className="text-right py-1.5 px-3 opacity-60">{received}</td>
                    <td className="text-right py-1.5 px-3 font-bold">
                      {dispatched > 0
                        ? <span className="text-green-700">{dispatched}</span>
                        : <span className="opacity-30">—</span>}
                    </td>
                    <td className="text-right py-1.5 px-3">
                      {received > 0 ? (
                        <span className={ratio >= 70 ? 'text-green-700 font-bold' : ratio >= 30 ? 'text-amber-700' : 'opacity-50'}>
                          {ratio.toFixed(0)}%
                        </span>
                      ) : <span className="opacity-30">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-[#f0efec] border-t-2 border-[#141414]">
                  <td colSpan={2} className="py-2 px-3 font-bold uppercase text-[9px]">TOTAL ({productData.length} SKUs)</td>
                  <td className="text-right py-2 px-3 font-bold">{totalStock}</td>
                  <td className="text-right py-2 px-3 font-bold">{totalRecv}</td>
                  <td className="text-right py-2 px-3 font-bold">{totalDisp}</td>
                  <td className="text-right py-2 px-3 font-bold">
                    {totalRecv > 0 ? `${((totalDisp / totalRecv) * 100).toFixed(0)}%` : '—'}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ── TALLAS ── */}
      {tab === 'tallas' && (
        <div className="flex flex-col gap-4">
          <div className="overflow-x-auto">
            <table className="w-full text-[10px] font-mono border-collapse">
              <thead>
                <tr className="bg-[#141414] text-[#E4E3E0]">
                  <th className="text-left py-2 px-3 font-bold uppercase">Talla</th>
                  <th className="text-right py-2 px-3 font-bold uppercase">Stock</th>
                  <th className="text-right py-2 px-3 font-bold uppercase">Despachos</th>
                  <th className="text-right py-2 px-3 font-bold uppercase">% Rotación</th>
                  <th className="text-left py-2 px-3 font-bold uppercase">Demanda</th>
                </tr>
              </thead>
              <tbody>
                {sizeData.map(({ size, stock, dispatched, ratio }) => (
                  <tr key={size} className="border-b border-[#141414]/15 hover:bg-white/40">
                    <td className="py-2 px-3 font-bold uppercase">{size}</td>
                    <td className="text-right py-2 px-3">{stock}</td>
                    <td className="text-right py-2 px-3 font-bold">
                      {dispatched > 0 ? <span className="text-green-700">{dispatched}</span> : <span className="opacity-30">—</span>}
                    </td>
                    <td className="text-right py-2 px-3">
                      <span className={ratio >= 70 ? 'text-green-700 font-bold' : ratio >= 30 ? 'text-amber-700 font-bold' : 'opacity-50'}>
                        {dispatched + stock > 0 ? `${ratio.toFixed(0)}%` : '—'}
                      </span>
                    </td>
                    <td className="py-2 px-3">
                      <DemandBar pct={ratio} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="border border-[#141414] bg-white/30 p-4">
            <div className="font-mono text-[9px] font-bold uppercase tracking-widest opacity-50 mb-4">DESPACHOS POR TALLA</div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={sizeData} margin={{ top: 0, right: 0, bottom: 24, left: 0 }}>
                <XAxis dataKey="size" tick={{ fontFamily: 'Courier New', fontSize: 9, fill: '#141414' }} />
                <YAxis tick={{ fontFamily: 'Courier New', fontSize: 9, fill: '#141414' }} width={32} />
                <Tooltip
                  contentStyle={{ fontFamily: 'Courier New', fontSize: 10, border: '1px solid #141414', background: '#E4E3E0' }}
                  formatter={(v: number) => [v, 'Uds despachadas']}
                />
                <Bar dataKey="dispatched" radius={[2, 2, 0, 0]}>
                  {sizeData.map((_, i) => <Cell key={i} fill={i === 0 ? '#141414' : '#9f9d99'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── COLORES ── */}
      {tab === 'colores' && (
        <div className="flex flex-col gap-4">
          <div className="overflow-x-auto">
            <table className="w-full text-[10px] font-mono border-collapse">
              <thead>
                <tr className="bg-[#141414] text-[#E4E3E0]">
                  <th className="text-left py-2 px-3 font-bold uppercase">Color</th>
                  <th className="text-right py-2 px-3 font-bold uppercase">SKUs</th>
                  <th className="text-right py-2 px-3 font-bold uppercase">Stock</th>
                  <th className="text-right py-2 px-3 font-bold uppercase">Despachos</th>
                  <th className="text-right py-2 px-3 font-bold uppercase">% Rotación</th>
                  <th className="text-left py-2 px-3 font-bold uppercase">Demanda</th>
                </tr>
              </thead>
              <tbody>
                {colorData.map(({ color, skus, stock, dispatched, ratio }) => (
                  <tr key={color} className="border-b border-[#141414]/15 hover:bg-white/40">
                    <td className="py-2 px-3 font-bold">{color}</td>
                    <td className="text-right py-2 px-3 opacity-60">{skus}</td>
                    <td className="text-right py-2 px-3">{stock}</td>
                    <td className="text-right py-2 px-3 font-bold">
                      {dispatched > 0 ? <span className="text-green-700">{dispatched}</span> : <span className="opacity-30">—</span>}
                    </td>
                    <td className="text-right py-2 px-3">
                      <span className={ratio >= 70 ? 'text-green-700 font-bold' : ratio >= 30 ? 'text-amber-700 font-bold' : 'opacity-50'}>
                        {dispatched + stock > 0 ? `${ratio.toFixed(0)}%` : '—'}
                      </span>
                    </td>
                    <td className="py-2 px-3">
                      <DemandBar pct={ratio} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="border border-[#141414] bg-white/30 p-4">
            <div className="font-mono text-[9px] font-bold uppercase tracking-widest opacity-50 mb-4">TOP 10 COLORES — DESPACHOS</div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={colorData.slice(0, 10)} margin={{ top: 0, right: 0, bottom: 36, left: 0 }}>
                <XAxis dataKey="color" tick={{ fontFamily: 'Courier New', fontSize: 9, fill: '#141414' }} angle={-35} textAnchor="end" interval={0} />
                <YAxis tick={{ fontFamily: 'Courier New', fontSize: 9, fill: '#141414' }} width={32} />
                <Tooltip
                  contentStyle={{ fontFamily: 'Courier New', fontSize: 10, border: '1px solid #141414', background: '#E4E3E0' }}
                  formatter={(v: number) => [v, 'Uds despachadas']}
                />
                <Bar dataKey="dispatched" radius={[2, 2, 0, 0]}>
                  {colorData.slice(0, 10).map((_, i) => <Cell key={i} fill={i === 0 ? '#141414' : '#9f9d99'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {productData.length === 0 && (
        <div className="text-center font-mono text-xs opacity-50 py-16 uppercase tracking-widest">Sin datos de productos disponibles</div>
      )}
    </div>
  );
};

function StatCard({ label, value, sub, dark, warn }: { label: string; value: number | string; sub: string; dark?: boolean; warn?: boolean }) {
  const base = dark ? 'bg-[#141414] text-[#E4E3E0]' : warn ? 'bg-amber-50 border border-amber-400' : 'bg-white/40 border border-[#141414]';
  return (
    <div className={`p-4 ${base}`}>
      <div className={`font-mono text-[9px] font-bold uppercase tracking-widest mb-1 ${dark ? 'opacity-50' : warn ? 'text-amber-700' : 'opacity-60'}`}>{label}</div>
      <div className={`font-mono text-2xl font-black leading-tight ${warn && Number(value) > 0 ? 'text-amber-700' : ''}`}>{value}</div>
      <div className={`font-mono text-[9px] mt-1 ${dark ? 'opacity-40' : 'opacity-50'}`}>{sub}</div>
    </div>
  );
}

function DemandBar({ pct }: { pct: number }) {
  const fill = pct >= 70 ? '#16a34a' : pct >= 30 ? '#d97706' : '#9f9d99';
  return (
    <div className="flex items-center gap-1.5 min-w-[60px]">
      <div className="flex-1 h-1.5 bg-[#141414]/10 border border-[#141414]/15">
        <div className="h-full transition-all" style={{ width: `${Math.min(pct, 100)}%`, background: fill }} />
      </div>
    </div>
  );
}

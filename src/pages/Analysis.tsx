import React, { useState, useMemo } from 'react';
import { useAppContext } from '../store/AppContext';
import { ModuleInfo } from '../components/ModuleInfo';
import { Package, TrendingUp, TrendingDown, DollarSign, BarChart2 } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from 'recharts';

type Tab = 'summary' | 'products' | 'categories';

const TABS: { id: Tab; label: string }[] = [
  { id: 'summary', label: 'RESUMEN' },
  { id: 'products', label: 'POR PRODUCTO' },
  { id: 'categories', label: 'POR CATEGORÍA' },
];

export const Analysis: React.FC = () => {
  const { products, stockLevels, transactions } = useAppContext();
  const [tab, setTab] = useState<Tab>('summary');
  const [sortBy, setSortBy] = useState<'margin' | 'value' | 'stock'>('value');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const productData = useMemo(() => {
    return products.map(prod => {
      const stock = stockLevels
        .filter(sl => sl.productId === prod.id)
        .reduce((s, sl) => s + sl.quantity, 0);
      const costValue = stock * (prod.costPrice || 0);
      const sellValue = stock * (prod.sellPrice || 0);
      const margin = sellValue - costValue;
      const marginPct = costValue > 0 ? (margin / costValue) * 100 : 0;
      const dispatched = transactions
        .filter(t => t.type === 'DISPATCH' && t.productId === prod.id)
        .reduce((s, t) => s + t.quantity, 0);
      return { prod, stock, costValue, sellValue, margin, marginPct, dispatched };
    }).filter(d => d.stock > 0);
  }, [products, stockLevels, transactions]);

  const totals = useMemo(() => {
    const totalCost = productData.reduce((s, d) => s + d.costValue, 0);
    const totalSell = productData.reduce((s, d) => s + d.sellValue, 0);
    const totalMargin = totalSell - totalCost;
    const totalMarginPct = totalCost > 0 ? (totalMargin / totalCost) * 100 : 0;
    const totalStock = productData.reduce((s, d) => s + d.stock, 0);
    const totalDispatched = productData.reduce((s, d) => s + d.dispatched, 0);
    return { totalCost, totalSell, totalMargin, totalMarginPct, totalStock, totalDispatched };
  }, [productData]);

  const categoryData = useMemo(() => {
    const map = new Map<string, { costValue: number; sellValue: number; stock: number; count: number }>();
    productData.forEach(d => {
      const cat = d.prod.category || 'SIN CATEGORÍA';
      const prev = map.get(cat) || { costValue: 0, sellValue: 0, stock: 0, count: 0 };
      map.set(cat, {
        costValue: prev.costValue + d.costValue,
        sellValue: prev.sellValue + d.sellValue,
        stock: prev.stock + d.stock,
        count: prev.count + 1,
      });
    });
    return Array.from(map.entries())
      .map(([cat, v]) => ({
        cat,
        ...v,
        margin: v.sellValue - v.costValue,
        marginPct: v.costValue > 0 ? ((v.sellValue - v.costValue) / v.costValue) * 100 : 0,
      }))
      .sort((a, b) => b.sellValue - a.sellValue);
  }, [productData]);

  const sortedProducts = useMemo(() => {
    return [...productData].sort((a, b) => {
      const va = sortBy === 'margin' ? a.margin : sortBy === 'stock' ? a.stock : a.sellValue;
      const vb = sortBy === 'margin' ? b.margin : sortBy === 'stock' ? b.stock : b.sellValue;
      return sortDir === 'desc' ? vb - va : va - vb;
    });
  }, [productData, sortBy, sortDir]);

  const toggleSort = (col: typeof sortBy) => {
    if (sortBy === col) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortBy(col); setSortDir('desc'); }
  };

  const fmt = (n: number) => `S/ ${n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const topChart = [...productData].sort((a, b) => b.sellValue - a.sellValue).slice(0, 8);

  return (
    <div className="h-full flex flex-col gap-6">
      <ModuleInfo number="02" title="Análisis de Costos" description="Valorización financiera del inventario: márgenes, desglose por producto y categoría, y proyección de ingresos por el stock almacenado." />
      <div className="border-b border-[#141414] pb-3">
        <h2 className="font-serif italic font-bold text-xs uppercase tracking-widest text-[#141414]">05 // ANÁLISIS DE COSTOS</h2>
        <p className="font-mono text-[10px] opacity-70 uppercase tracking-wide mt-1">Valorización y márgenes del inventario activo.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border border-[#141414]">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 py-2 text-[10px] font-bold font-mono uppercase tracking-widest transition-colors border-r last:border-r-0 border-[#141414] ${tab === t.id ? 'bg-[#141414] text-[#E4E3E0]' : 'bg-white/30 hover:bg-white/60'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* SUMMARY TAB */}
      {tab === 'summary' && (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MetricCard icon={<Package size={18} />} label="Valor Costo" value={fmt(totals.totalCost)} sub={`${totals.totalStock.toLocaleString()} uds en stock`} dark={false} />
            <MetricCard icon={<TrendingUp size={18} />} label="Valor Venta" value={fmt(totals.totalSell)} sub="Proyección ingresos brutos" dark={true} />
            <MetricCard icon={<DollarSign size={18} />} label="Margen Bruto" value={fmt(totals.totalMargin)} sub={`${totals.totalMarginPct.toFixed(1)}% sobre costo`} dark={false} accent={totals.totalMargin >= 0 ? 'green' : 'red'} />
            <MetricCard icon={<BarChart2 size={18} />} label="SKUs con Stock" value={productData.length.toString()} sub={`${totals.totalDispatched.toLocaleString()} uds despachadas`} dark={false} />
          </div>

          <div className="border border-[#141414] bg-white/30 p-4">
            <div className="font-mono text-[9px] font-bold uppercase tracking-widest opacity-50 mb-4">TOP 8 PRODUCTOS — VALOR DE VENTA</div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={topChart} margin={{ top: 0, right: 0, bottom: 30, left: 0 }}>
                <XAxis dataKey={d => `${d.prod.code}`} tick={{ fontFamily: 'Courier New', fontSize: 9, fill: '#141414' }} angle={-35} textAnchor="end" interval={0} />
                <YAxis tick={{ fontFamily: 'Courier New', fontSize: 9, fill: '#141414' }} tickFormatter={v => `S/${(v / 1000).toFixed(0)}k`} width={42} />
                <Tooltip
                  contentStyle={{ fontFamily: 'Courier New', fontSize: 10, border: '1px solid #141414', background: '#E4E3E0' }}
                  formatter={(v: number) => [`S/ ${v.toFixed(2)}`, 'Valor venta']}
                  labelFormatter={(_: unknown, p: readonly { payload?: { prod?: { name?: string; code?: string } } }[]) => { const prod = (p as Array<{ payload?: { prod?: { name?: string; code?: string } } }>)[0]?.payload?.prod; return prod ? `${prod.code} ${prod.name}` : ''; }}
                />
                <Bar dataKey="sellValue" radius={[2, 2, 0, 0]}>
                  {topChart.map((_, i) => <Cell key={i} fill={i === 0 ? '#141414' : '#9f9d99'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="border border-[#141414] bg-white/30 p-4">
            <div className="font-mono text-[9px] font-bold uppercase tracking-widest opacity-50 mb-4">DISTRIBUCIÓN DE MÁRGENES</div>
            <div className="flex gap-4 flex-wrap">
              {[
                { label: '> 50%', color: '#16a34a', count: productData.filter(d => d.marginPct > 50).length },
                { label: '20–50%', color: '#0891b2', count: productData.filter(d => d.marginPct >= 20 && d.marginPct <= 50).length },
                { label: '0–20%', color: '#d97706', count: productData.filter(d => d.marginPct >= 0 && d.marginPct < 20).length },
                { label: '< 0%', color: '#dc2626', count: productData.filter(d => d.marginPct < 0).length },
              ].map(b => (
                <div key={b.label} className="flex items-center gap-2">
                  <div className="w-3 h-3 border border-[#141414]" style={{ background: b.color }} />
                  <span className="font-mono text-[10px] font-bold">{b.label}</span>
                  <span className="font-mono text-[10px] opacity-60">{b.count} SKUs</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* PRODUCTS TAB */}
      {tab === 'products' && (
        <div className="flex flex-col gap-3">
          <div className="overflow-x-auto">
            <table className="w-full text-[10px] font-mono border-collapse">
              <thead>
                <tr className="bg-[#141414] text-[#E4E3E0]">
                  <th className="text-left py-2 px-3 font-bold uppercase">Producto</th>
                  <th className="text-right py-2 px-3 font-bold uppercase cursor-pointer hover:opacity-70" onClick={() => toggleSort('stock')}>
                    Stock {sortBy === 'stock' ? (sortDir === 'desc' ? '↓' : '↑') : ''}
                  </th>
                  <th className="text-right py-2 px-3 font-bold uppercase">V. Costo</th>
                  <th className="text-right py-2 px-3 font-bold uppercase cursor-pointer hover:opacity-70" onClick={() => toggleSort('value')}>
                    V. Venta {sortBy === 'value' ? (sortDir === 'desc' ? '↓' : '↑') : ''}
                  </th>
                  <th className="text-right py-2 px-3 font-bold uppercase cursor-pointer hover:opacity-70" onClick={() => toggleSort('margin')}>
                    Margen {sortBy === 'margin' ? (sortDir === 'desc' ? '↓' : '↑') : ''}
                  </th>
                  <th className="text-right py-2 px-3 font-bold uppercase">%</th>
                </tr>
              </thead>
              <tbody>
                {sortedProducts.map(({ prod, stock, costValue, sellValue, margin, marginPct }) => (
                  <tr key={prod.id} className="border-b border-[#141414]/15 hover:bg-white/40">
                    <td className="py-2 px-3">
                      <div className="font-bold">{prod.code}</div>
                      <div className="opacity-60 text-[9px]">{prod.name} {prod.color} {prod.size}</div>
                    </td>
                    <td className="text-right py-2 px-3 font-bold">{stock}</td>
                    <td className="text-right py-2 px-3 opacity-70">{fmt(costValue)}</td>
                    <td className="text-right py-2 px-3 font-bold">{fmt(sellValue)}</td>
                    <td className={`text-right py-2 px-3 font-bold ${margin >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmt(margin)}</td>
                    <td className="text-right py-2 px-3">
                      <span className={`px-1.5 py-0.5 font-bold text-[9px] ${marginPct >= 20 ? 'bg-green-100 text-green-800' : marginPct >= 0 ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'}`}>
                        {marginPct.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-[#f0efec] border-t-2 border-[#141414]">
                  <td className="py-2 px-3 font-bold uppercase text-[9px]">TOTAL ({productData.length} SKUs)</td>
                  <td className="text-right py-2 px-3 font-bold">{totals.totalStock}</td>
                  <td className="text-right py-2 px-3 font-bold">{fmt(totals.totalCost)}</td>
                  <td className="text-right py-2 px-3 font-bold">{fmt(totals.totalSell)}</td>
                  <td className={`text-right py-2 px-3 font-bold ${totals.totalMargin >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmt(totals.totalMargin)}</td>
                  <td className="text-right py-2 px-3 font-bold">{totals.totalMarginPct.toFixed(1)}%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* CATEGORIES TAB */}
      {tab === 'categories' && (
        <div className="flex flex-col gap-4">
          <div className="overflow-x-auto">
            <table className="w-full text-[10px] font-mono border-collapse">
              <thead>
                <tr className="bg-[#141414] text-[#E4E3E0]">
                  <th className="text-left py-2 px-3 font-bold uppercase">Categoría</th>
                  <th className="text-right py-2 px-3 font-bold uppercase">SKUs</th>
                  <th className="text-right py-2 px-3 font-bold uppercase">Stock</th>
                  <th className="text-right py-2 px-3 font-bold uppercase">V. Costo</th>
                  <th className="text-right py-2 px-3 font-bold uppercase">V. Venta</th>
                  <th className="text-right py-2 px-3 font-bold uppercase">Margen</th>
                  <th className="text-right py-2 px-3 font-bold uppercase">%</th>
                </tr>
              </thead>
              <tbody>
                {categoryData.map(({ cat, count, stock, costValue, sellValue, margin, marginPct }) => (
                  <tr key={cat} className="border-b border-[#141414]/15 hover:bg-white/40">
                    <td className="py-2 px-3 font-bold uppercase">{cat.replace('_', ' ')}</td>
                    <td className="text-right py-2 px-3">{count}</td>
                    <td className="text-right py-2 px-3 font-bold">{stock}</td>
                    <td className="text-right py-2 px-3 opacity-70">{fmt(costValue)}</td>
                    <td className="text-right py-2 px-3 font-bold">{fmt(sellValue)}</td>
                    <td className={`text-right py-2 px-3 font-bold ${margin >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmt(margin)}</td>
                    <td className="text-right py-2 px-3">
                      <span className={`px-1.5 py-0.5 font-bold text-[9px] ${marginPct >= 20 ? 'bg-green-100 text-green-800' : marginPct >= 0 ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'}`}>
                        {marginPct.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="border border-[#141414] bg-white/30 p-4">
            <div className="font-mono text-[9px] font-bold uppercase tracking-widest opacity-50 mb-4">VALOR DE VENTA POR CATEGORÍA</div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={categoryData} margin={{ top: 0, right: 0, bottom: 30, left: 0 }}>
                <XAxis dataKey={d => d.cat.replace('_', ' ')} tick={{ fontFamily: 'Courier New', fontSize: 9, fill: '#141414' }} angle={-30} textAnchor="end" interval={0} />
                <YAxis tick={{ fontFamily: 'Courier New', fontSize: 9, fill: '#141414' }} tickFormatter={v => `S/${(v / 1000).toFixed(0)}k`} width={42} />
                <Tooltip
                  contentStyle={{ fontFamily: 'Courier New', fontSize: 10, border: '1px solid #141414', background: '#E4E3E0' }}
                  formatter={(v: number) => [`S/ ${v.toFixed(2)}`, 'Valor venta']}
                />
                <Bar dataKey="sellValue" fill="#141414" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {productData.length === 0 && (
        <div className="text-center font-mono text-xs opacity-50 py-16 uppercase tracking-widest">Sin productos con stock disponible</div>
      )}
    </div>
  );
};

interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  dark: boolean;
  accent?: 'green' | 'red';
}

function MetricCard({ icon, label, value, sub, dark, accent }: MetricCardProps) {
  const base = dark ? 'bg-[#141414] text-[#E4E3E0]' : 'bg-white border border-[#141414]';
  const valueColor = accent === 'green' ? 'text-green-700' : accent === 'red' ? 'text-red-600' : '';
  return (
    <div className={`p-4 relative overflow-hidden ${base}`}>
      <div className={`absolute right-2 top-2 opacity-10`}>{icon}</div>
      <div className={`font-mono text-[9px] font-bold uppercase tracking-widest mb-1 ${dark ? 'opacity-50' : 'opacity-60'}`}>{label}</div>
      <div className={`font-mono text-xl font-black leading-tight ${valueColor}`}>{value}</div>
      <div className={`font-mono text-[9px] mt-1 ${dark ? 'opacity-40' : 'opacity-50'}`}>{sub}</div>
    </div>
  );
}

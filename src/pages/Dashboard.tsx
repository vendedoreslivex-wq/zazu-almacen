import React from 'react';
import { useAppContext } from '../store/AppContext';
import { ModuleInfo } from '../components/ModuleInfo';
import { Package, ArrowDownLeft, ArrowUpRight, ArrowRightLeft, AlertTriangle } from 'lucide-react';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export const Dashboard: React.FC = () => {
  const { products, transactions, stockLevels } = useAppContext();

  const totalItemsInStock = stockLevels.reduce((acc, curr) => acc + curr.quantity, 0);
  const totalInventoryValue = stockLevels.reduce((acc, curr) => {
    const p = products.find(prod => prod.id === curr.productId);
    return acc + (p?.costPrice || 0) * curr.quantity;
  }, 0);
  
  const todayStart = new Date();
  todayStart.setHours(0,0,0,0);
  
  const todayTxs = transactions.filter(t => new Date(t.date) >= todayStart);
  const todaysReceptions = todayTxs.filter(t => t.type === 'RECEPTION').reduce((acc, curr) => acc + curr.quantity, 0);
  const todaysDispatches = todayTxs.filter(t => t.type === 'DISPATCH').reduce((acc, curr) => acc + curr.quantity, 0);

  // Generate chart data for the last 7 days
  const chartData = Array.from({ length: 7 }).map((_, i) => {
    const d = subDays(new Date(), 6 - i);
    const dayStart = startOfDay(d);
    const dayEnd = endOfDay(d);
    
    const dayTxs = transactions.filter(t => {
      const txDate = new Date(t.date);
      return txDate >= dayStart && txDate <= dayEnd;
    });

    return {
      date: format(d, 'dd/MM'),
      recepciones: dayTxs.filter(t => t.type === 'RECEPTION').reduce((acc, curr) => acc + curr.quantity, 0),
      despachos: dayTxs.filter(t => t.type === 'DISPATCH').reduce((acc, curr) => acc + curr.quantity, 0),
    };
  });

  // Calculate top categories by dispatches (rotación)
  const categoryRotations: Record<string, number> = {};
  transactions.filter(t => t.type === 'DISPATCH').forEach(tx => {
    const p = products.find(prod => prod.id === tx.productId);
    if (p) {
      const cat = p.category || 'General';
      categoryRotations[cat] = (categoryRotations[cat] || 0) + tx.quantity;
    }
  });
  
  const categoryChartData = Object.entries(categoryRotations)
    .map(([name, rot]) => ({ nombre: name, rotacion: rot }))
    .sort((a, b) => b.rotacion - a.rotacion)
    .slice(0, 5);

  const lowStockItems = products.map(p => {
    const productStock = stockLevels.filter(s => s.productId === p.id);
    const total = productStock.reduce((acc, curr) => acc + curr.quantity, 0);
    return { ...p, totalStock: total };
  }).filter(p => p.lowStockThreshold !== undefined && p.totalStock <= p.lowStockThreshold);

  return (
    <div className="flex flex-col gap-8">
      <ModuleInfo number="01" title="Dashboard" description="Vista general del almacén: stock total, alertas de bajo stock, movimientos recientes y métricas operativas en tiempo real." />
      {/* Header section */}
      <div className="border-b border-[#141414] pb-2">
        <h2 className="font-serif italic font-bold text-xs uppercase tracking-widest">01 // SYSTEM_STATUS</h2>
        <p className="font-mono text-[10px] opacity-70 uppercase tracking-wide mt-1">Resumen operativo del almacén al día de hoy.</p>
      </div>

      {/* Low Stock Alert Panel */}
      {lowStockItems.length > 0 && (
        <button 
          onClick={() => {
            window.sessionStorage.setItem('inventoryFilter', 'LOW_STOCK');
            window.dispatchEvent(new CustomEvent('navigate', { detail: { tab: 'inventory' } }));
          }}
          className="bg-[#b91c1c]/10 border-2 border-[#b91c1c] p-4 flex flex-col gap-3 relative overflow-hidden text-left hover:bg-[#b91c1c]/20 transition-colors w-full cursor-pointer group"
        >
          <div className="absolute -right-4 -top-4 opacity-5 rotate-12 group-hover:scale-110 transition-transform">
            <AlertTriangle size={120} />
          </div>
          <div className="flex items-center justify-between z-10 w-full relative">
            <div className="flex items-center gap-2 text-[#b91c1c]">
              <AlertTriangle size={20} />
              <h3 className="font-serif italic font-bold text-xs uppercase tracking-widest">ALERTA_STOCK_BAJO</h3>
            </div>
            <span className="font-mono text-[9px] font-bold text-white bg-[#b91c1c] px-2 py-1 tracking-widest shadow-[2px_2px_0_rgba(185,28,28,0.3)]">
              VER EN INVENTARIO →
            </span>
          </div>
          <p className="font-mono text-[10px] uppercase font-bold text-[#b91c1c]">
            {lowStockItems.length} SKU(s) POR DEBAJO DEL UMBRAL MINIMO. SE REQUIERE ATENCION INMEDIATA.
          </p>
          <div className="flex flex-wrap gap-2 mt-1 relative z-10">
            {lowStockItems.slice(0, 8).map(item => (
              <div key={item.id} className="bg-white border border-[#b91c1c] px-2 py-1 flex items-center gap-2">
                <span className="font-mono text-[9px] font-bold text-[#b91c1c]">{item.code}</span>
                <span className="font-mono text-[10px] font-black">{item.totalStock}</span>
                <span className="font-mono text-[8px] opacity-60">/ {item.lowStockThreshold}</span>
              </div>
            ))}
            {lowStockItems.length > 8 && (
              <div className="bg-white border border-[#b91c1c] px-2 py-1 flex items-center gap-2">
                <span className="font-mono text-[9px] font-bold text-[#b91c1c]">+{lowStockItems.length - 8} MÁS</span>
              </div>
            )}
          </div>
        </button>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          label="STOCK TOTAL (U)" 
          value={totalItemsInStock} 
          icon={<Package size={20} />} 
        />
        <StatCard 
          label="RECEP. HOY" 
          value={todaysReceptions} 
          icon={<ArrowDownLeft size={20} className="text-[#15803d]" />} 
          trend="+ entradas"
        />
        <StatCard 
          label="DESP. HOY" 
          value={todaysDispatches} 
          icon={<ArrowUpRight size={20} className="text-[#b91c1c]" />} 
          trend="- salidas"
        />
        <StatCard 
          label="SKUs ACTIVOS" 
          value={products.length} 
          icon={<ArrowRightLeft size={20} />} 
        />
        <StatCard 
          label="VALORIZACIÓN (COSTO)" 
          value={`S/ ${totalInventoryValue.toLocaleString('es-PE', { minimumFractionDigits: 2 })}`} 
          icon={<Package size={20} />} 
        />
      </div>

      {/* Chart Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="data-table-container">
          <div className="p-3 border-b border-[#141414] bg-[#D4D3D0] flex justify-between items-center">
            <h3 className="font-serif italic font-bold text-xs uppercase tracking-widest">02 // TENDENCIA_SEMANAL</h3>
          </div>
          <div className="h-[300px] p-4 bg-white/50">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#141414" opacity={0.1} vertical={false} />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontFamily: 'monospace', fontWeight: 'bold' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontFamily: 'monospace', fontWeight: 'bold' }} />
                <Tooltip 
                  cursor={{ fill: 'rgba(20, 20, 20, 0.05)' }}
                  contentStyle={{ borderRadius: 0, border: '2px solid #141414', backgroundColor: '#E4E3E0', padding: '8px', boxShadow: '4px 4px 0 #141414' }}
                  itemStyle={{ fontSize: '11px', fontFamily: 'monospace', fontWeight: 'bold' }}
                  labelStyle={{ fontSize: '10px', fontFamily: 'monospace', fontWeight: 'bold', marginBottom: '4px', textTransform: 'uppercase' }}
                />
                <Legend wrapperStyle={{ fontSize: '10px', fontFamily: 'monospace', fontWeight: 'bold' }} iconType="square" />
                <Bar dataKey="recepciones" name="RECEPCIONES" fill="#15803d" radius={[2, 2, 0, 0]} maxBarSize={40} />
                <Bar dataKey="despachos" name="DESPACHOS" fill="#b91c1c" radius={[2, 2, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="data-table-container">
          <div className="p-3 border-b border-[#141414] bg-[#D4D3D0] flex justify-between items-center">
            <h3 className="font-serif italic font-bold text-xs uppercase tracking-widest">ROTACIÓN_CATEGORÍAS</h3>
          </div>
          <div className="h-[300px] p-4 bg-white/50">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryChartData} layout="vertical" margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#141414" opacity={0.1} horizontal={false} />
                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontFamily: 'monospace', fontWeight: 'bold' }} />
                <YAxis type="category" dataKey="nombre" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontFamily: 'monospace', fontWeight: 'bold' }} width={80} />
                <Tooltip 
                  cursor={{ fill: 'rgba(20, 20, 20, 0.05)' }}
                  contentStyle={{ borderRadius: 0, border: '2px solid #141414', backgroundColor: '#E4E3E0', padding: '8px', boxShadow: '4px 4px 0 #141414' }}
                  itemStyle={{ fontSize: '11px', fontFamily: 'monospace', fontWeight: 'bold' }}
                  labelStyle={{ fontSize: '10px', fontFamily: 'monospace', fontWeight: 'bold', marginBottom: '4px', textTransform: 'uppercase' }}
                />
                <Bar dataKey="rotacion" name="UNIDADES" fill="#141414" radius={[0, 2, 2, 0]} maxBarSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recents */}
      <div className="data-table-container mt-4">
        <div className="p-3 border-b border-[#141414] bg-[#D4D3D0] flex justify-between items-center">
          <h3 className="font-serif italic font-bold text-xs uppercase tracking-widest">03 // Últimos_Movimientos</h3>
          <span className="font-mono text-[10px] opacity-50">SYNC_ID: 992-RX</span>
        </div>
        <div className="grid grid-cols-[100px_minmax(120px,1fr)_120px_100px_minmax(150px,1fr)] data-header">
          <div>FECHA</div>
          <div>TIPO</div>
          <div>CANTIDAD</div>
          <div>SKU</div>
          <div>REFERENCIA</div>
        </div>
        <div>
          {transactions.slice(0, 5).map(tx => {
            const product = products.find(p => p.id === tx.productId);
            // Dynamic coloring based on type
            const typeColor = tx.type === 'RECEPTION' ? 'bg-[#15803d] text-white border-[#141414]' 
               : tx.type === 'DISPATCH' ? 'bg-[#141414] text-[#E4E3E0] border-[#141414]' 
               : 'bg-white border-[#141414] text-[#141414]'; 
               
            return (
              <div key={tx.id} className="grid grid-cols-[100px_minmax(120px,1fr)_120px_100px_minmax(150px,1fr)] data-row items-center cursor-default">
                <div className="font-mono text-[10px] font-bold opacity-70">{format(new Date(tx.date), 'dd/MM/yy HH:mm')}</div>
                <div className={`font-mono text-[9px] font-bold py-0.5 px-2 w-fit uppercase tracking-wider border ${typeColor}`}>
                  {tx.type}
                </div>
                <div className="font-mono text-sm font-black">{tx.quantity}</div>
                <div className="font-mono text-[10px] uppercase font-bold">{product?.code || '???'}</div>
                <div className="text-[10px] font-bold uppercase truncate opacity-70">{tx.reference}</div>
              </div>
            );
          })}
          {transactions.length === 0 && (
             <div className="p-8 text-center text-[#141414] opacity-50 font-mono text-xs font-bold uppercase">NO SE ENCONTRARON REGISTROS</div>
          )}
        </div>
      </div>
    </div>
  );
};

const StatCard: React.FC<{label: string, value: string | number, icon: React.ReactNode, trend?: string}> = ({label, value, icon, trend}) => (
  <div className="bg-white/50 border border-[#141414] p-3 flex flex-col gap-3 relative group hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors shadow-[2px_2px_0_#141414]">
    <div className="flex justify-between items-start">
      <div className="font-mono text-[10px] font-bold opacity-70 tracking-widest uppercase">{label}</div>
      <div className="p-1 border border-current">{icon}</div>
    </div>
    <div className="flex items-end gap-2 mt-1">
      <div className="font-mono text-3xl font-black tracking-tighter leading-none">{value}</div>
      {trend && <div className="font-mono text-[9px] mb-1 px-1 border border-current uppercase font-bold">{trend}</div>}
    </div>
  </div>
);

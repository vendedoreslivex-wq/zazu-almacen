import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../store/AppContext';
import { useTheme } from '../store/ThemeContext';
import { ModuleInfo } from '../components/ModuleInfo';
import { Package, ArrowDownLeft, ArrowUpRight, ArrowRightLeft, AlertTriangle, TrendingUp, FileText, FileSpreadsheet, Printer, Trash2 } from 'lucide-react';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line, ReferenceLine } from 'recharts';
import * as XLSX from 'xlsx';

export const Dashboard: React.FC = () => {
  const { products, transactions, stockLevels } = useAppContext();
  const { theme } = useTheme();
  const navigate = useNavigate();

  const chartBorder   = theme === 'dark' ? '#3a3a3a' : '#141414';
  const chartBg       = theme === 'dark' ? '#1c1c1c' : '#E4E3E0';
  const chartInk      = theme === 'dark' ? '#E4E3E0' : '#141414';
  const tooltipStyle  = { borderRadius: 0, border: `2px solid ${chartBorder}`, backgroundColor: chartBg, padding: '8px', boxShadow: `4px 4px 0 ${chartBorder}`, color: chartInk };
  const [days, setDays] = useState<7 | 14 | 30>(7);
  const [mainTab, setMainTab] = useState<'resumen' | 'producto' | 'talla'>('resumen');

  const totalItemsInStock = stockLevels.reduce((acc, curr) => acc + curr.quantity, 0);
  const totalInventoryValue = stockLevels.reduce((acc, curr) => {
    const p = products.find(prod => prod.id === curr.productId);
    return acc + (p?.costPrice || 0) * curr.quantity;
  }, 0);
  
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  const todayStart = new Date();
  todayStart.setHours(0,0,0,0);
  
  const todayTxs = transactions.filter(t => new Date(t.date) >= todayStart);
  const todaysReceptions = todayTxs.filter(t => t.type === 'RECEPTION').reduce((acc, curr) => acc + curr.quantity, 0);
  const todaysDispatches = todayTxs.filter(t => t.type === 'DISPATCH' && !t.reference?.startsWith('[BAJA]')).reduce((acc, curr) => acc + curr.quantity, 0);
  const todaysWriteoffs  = todayTxs.filter(t => t.reference?.startsWith('[BAJA]')).reduce((acc, curr) => acc + curr.quantity, 0);

  // Generate chart data for the selected range
  const chartData = Array.from({ length: days }).map((_, i) => {
    const d = subDays(new Date(), days - 1 - i);
    const dayStart = startOfDay(d);
    const dayEnd = endOfDay(d);
    const dayTxs = transactions.filter(t => {
      const txDate = new Date(t.date);
      return txDate >= dayStart && txDate <= dayEnd;
    });
    return {
      date: days <= 14 ? format(d, 'dd/MM') : format(d, 'dd/MM'),
      recepciones: dayTxs.filter(t => t.type === 'RECEPTION').reduce((acc, curr) => acc + curr.quantity, 0),
      despachos:   dayTxs.filter(t => t.type === 'DISPATCH' && !t.reference?.startsWith('[BAJA]')).reduce((acc, curr) => acc + curr.quantity, 0),
      mermas:      dayTxs.filter(t => t.reference?.startsWith('[BAJA]')).reduce((acc, curr) => acc + curr.quantity, 0),
    };
  });

  const rangeStart = startOfDay(subDays(new Date(), days - 1));
  // Calculate top categories by dispatches (rotacion) within selected range
  const categoryRotations: Record<string, number> = {};
  transactions.filter(t => t.type === 'DISPATCH' && !t.reference?.startsWith('[BAJA]') && new Date(t.date) >= rangeStart).forEach(tx => {
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

  // -- Stock historico acumulado ----------------------------------------------
  // Ordenar todas las transacciones no canceladas cronologicamente
  const sortedTxs = [...transactions]
    .filter(t => t.status !== 'CANCELLED')
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Construir running total: recepcion suma, despacho resta, traslado neutro
  let running = 0;
  const stockHistoryMap: Record<string, { in: number; out: number; mermas: number; balance: number }> = {};
  sortedTxs.forEach(tx => {
    const day = format(new Date(tx.date), 'dd/MM/yy');
    if (!stockHistoryMap[day]) stockHistoryMap[day] = { in: 0, out: 0, mermas: 0, balance: 0 };
    if (tx.type === 'RECEPTION') { running += tx.quantity; stockHistoryMap[day].in += tx.quantity; }
    else if (tx.type === 'DISPATCH') {
      running -= tx.quantity;
      if (tx.reference?.startsWith('[BAJA]')) stockHistoryMap[day].mermas = (stockHistoryMap[day].mermas || 0) + tx.quantity;
      else stockHistoryMap[day].out += tx.quantity;
    }
    stockHistoryMap[day].balance = running;
  });

  const stockHistoryData = Object.entries(stockHistoryMap).map(([date, v]) => ({ date, ...v }));

  const totalIn       = sortedTxs.filter(t => t.type === 'RECEPTION').reduce((s, t) => s + t.quantity, 0);
  const totalOut      = sortedTxs.filter(t => t.type === 'DISPATCH' && !t.reference?.startsWith('[BAJA]')).reduce((s, t) => s + t.quantity, 0);
  const totalWriteoff = sortedTxs.filter(t => t.reference?.startsWith('[BAJA]')).reduce((s, t) => s + t.quantity, 0);
  const netBalance    = totalIn - totalOut - totalWriteoff;

  // -- Por producto (agrupado por nombre base, desglose por talla, sin color) --
  const byProductBase: Record<string, { name: string; code: string; in: number; out: number; writeoff: number; sizes: Record<string, { in: number; out: number; writeoff: number }> }> = {};
  sortedTxs.forEach(tx => {
    const p = products.find(prod => prod.id === tx.productId);
    if (!p) return;
    const baseKey = p.name.trim();
    if (!byProductBase[baseKey]) byProductBase[baseKey] = { name: p.name, code: p.code, in: 0, out: 0, writeoff: 0, sizes: {} };
    const size = p.size?.trim() || 'S/T';
    if (!byProductBase[baseKey].sizes[size]) byProductBase[baseKey].sizes[size] = { in: 0, out: 0, writeoff: 0 };
    const isWO = tx.reference?.startsWith('[BAJA]');
    if (tx.type === 'RECEPTION') {
      byProductBase[baseKey].in += tx.quantity;
      byProductBase[baseKey].sizes[size].in += tx.quantity;
    } else if (tx.type === 'DISPATCH') {
      if (isWO) {
        byProductBase[baseKey].writeoff += tx.quantity;
        byProductBase[baseKey].sizes[size].writeoff += tx.quantity;
      } else {
        byProductBase[baseKey].out += tx.quantity;
        byProductBase[baseKey].sizes[size].out += tx.quantity;
      }
    }
  });
  const byProductList = Object.entries(byProductBase)
    .map(([, v]) => ({
      ...v,
      balance: v.in - v.out - v.writeoff,
      sizeList: Object.entries(v.sizes)
        .map(([size, sv]) => ({ size, ...sv, balance: sv.in - sv.out - sv.writeoff }))
        .sort((a, b) => b.in - a.in),
    }))
    .sort((a, b) => b.in - a.in);

  // -- Por talla -------------------------------------------------------------
  const bySize: Record<string, { in: number; out: number; writeoff: number }> = {};
  sortedTxs.forEach(tx => {
    const p = products.find(prod => prod.id === tx.productId);
    const size = p?.size?.trim() || 'S/T';
    if (!bySize[size]) bySize[size] = { in: 0, out: 0, writeoff: 0 };
    const isWO = tx.reference?.startsWith('[BAJA]');
    if (tx.type === 'RECEPTION') bySize[size].in += tx.quantity;
    else if (tx.type === 'DISPATCH') {
      if (isWO) bySize[size].writeoff += tx.quantity;
      else bySize[size].out += tx.quantity;
    }
  });
  const bySizeList = Object.entries(bySize)
    .map(([size, v]) => ({ size, ...v, balance: v.in - v.out - v.writeoff }))
    .sort((a, b) => b.in - a.in);

  // -- Exportaciones ---------------------------------------------------------
  const exportProductoCSV = () => {
    const rows: string[][] = [['Producto', 'Total Ingresado', 'Total Despachado', 'Balance', 'Talla', 'Ingresado Talla', 'Despachado Talla', 'Balance Talla']];
    byProductList.forEach(p => {
      if (p.sizeList.length === 0) {
        rows.push([p.name, String(p.in), String(p.out), String(p.balance), '', '', '', '']);
      } else {
        p.sizeList.forEach((s, i) => {
          rows.push([i === 0 ? p.name : '', i === 0 ? String(p.in) : '', i === 0 ? String(p.out) : '', i === 0 ? String(p.balance) : '', s.size, String(s.in), String(s.out), String(s.balance)]);
        });
      }
    });
    const csv = rows.map(r => r.map(v => v.includes(',') ? `"${v}"` : v).join(',')).join('\n');
    const blob = new Blob(['?' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `stock_por_producto_${format(new Date(), 'yyyyMMdd')}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const exportProductoExcel = () => {
    const rows: (string | number)[][] = [['Producto', 'Total Ingresado', 'Total Despachado', 'Balance', 'Talla', 'Ingresado', 'Despachado', 'Balance Talla']];
    byProductList.forEach(p => {
      if (p.sizeList.length === 0) {
        rows.push([p.name, p.in, p.out, p.balance, '', '', '', '']);
      } else {
        p.sizeList.forEach((s, i) => {
          rows.push([i === 0 ? p.name : '', i === 0 ? p.in : '', i === 0 ? p.out : '', i === 0 ? p.balance : '', s.size, s.in, s.out, s.balance]);
        });
      }
    });
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [40,14,14,10,10,10,10,12].map(w => ({ wch: w }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Stock por Producto');
    XLSX.writeFile(wb, `stock_por_producto_${format(new Date(), 'yyyyMMdd')}.xlsx`);
  };

  const exportProductoPDF = () => {
    const now = format(new Date(), "dd 'de' MMMM yyyy, HH:mm", { locale: es });
    const tableRows = byProductList.map(p => {
      const sizesHTML = p.sizeList.map(s =>
        `<span style="display:inline-flex;flex-direction:column;align-items:center;border:1px solid #ccc;padding:3px 6px;margin:2px;font-size:8px;">
          <b>${s.size}</b>
          <span style="color:#15803d">+${s.in}</span>
          <span style="color:#dc2626">-${s.out}</span>
        </span>`).join('');
      return `<tr>
        <td><b>${p.name}</b></td>
        <td style="text-align:center;color:#15803d;font-weight:700">+${p.in}</td>
        <td style="text-align:center;color:#dc2626;font-weight:700">-${p.out}</td>
        <td style="text-align:center;font-weight:900;color:${p.balance >= 0 ? '#141414' : '#dc2626'}">${p.balance >= 0 ? '+' : ''}${p.balance}</td>
        <td>${sizesHTML}</td>
      </tr>`;
    }).join('');
    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
    <style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:'Courier New',monospace;padding:32px 40px;font-size:10px;color:#141414}
      @page{size:A4;margin:14mm}
      h1{font-size:16px;font-weight:900;letter-spacing:.1em;text-transform:uppercase;margin-bottom:4px}
      .meta{font-size:8px;opacity:.5;margin-bottom:24px;letter-spacing:.06em}
      table{width:100%;border-collapse:collapse;font-size:9px}
      thead{background:#141414;color:#E4E3E0}
      th{padding:8px 10px;text-align:left;font-size:8px;letter-spacing:.12em;text-transform:uppercase;font-weight:700}
      td{padding:7px 10px;border-bottom:1px solid #e5e7eb;vertical-align:middle}
      tr:nth-child(even) td{background:#fafafa}
    </style></head><body>
    <h1>Stock Acumulado | Por Producto</h1>
    <div class="meta">Generado: ${now}${now} · ${byProductList.length} productos</div>
    <table>
      <thead><tr><th>Producto</th><th>Ingresado</th><th>Despachado</th><th>Balance</th><th>Por Talla</th></tr></thead>
      <tbody>${tableRows}</tbody>
    </table>
    </body></html>`;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 500);
  };

  const exportTallaCSV = () => {
    const rows = [['Talla', 'Ingresado', 'Despachado', 'Balance'], ...bySizeList.map(s => [s.size, String(s.in), String(s.out), String(s.balance)])];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob(['?' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `stock_por_talla_${format(new Date(), 'yyyyMMdd')}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const exportTallaExcel = () => {
    const rows = [['Talla', 'Ingresado', 'Despachado', 'Balance'], ...bySizeList.map(s => [s.size, s.in, s.out, s.balance])];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [12, 12, 12, 10].map(w => ({ wch: w }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Stock por Talla');
    XLSX.writeFile(wb, `stock_por_talla_${format(new Date(), 'yyyyMMdd')}.xlsx`);
  };

  const exportTallaPDF = () => {
    const now = format(new Date(), "dd 'de' MMMM yyyy, HH:mm", { locale: es });
    const tableRows = bySizeList.map(s => `<tr>
      <td style="font-weight:900;font-size:14px">${s.size}</td>
      <td style="text-align:center;color:#15803d;font-weight:700">+${s.in}</td>
      <td style="text-align:center;color:#dc2626;font-weight:700">-${s.out}</td>
      <td style="text-align:center;font-weight:900;color:${s.balance >= 0 ? '#141414' : '#dc2626'}">${s.balance >= 0 ? '+' : ''}${s.balance}</td>
    </tr>`).join('');
    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
    <style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:'Courier New',monospace;padding:32px 40px;font-size:10px;color:#141414}
      @page{size:A4;margin:14mm}
      h1{font-size:16px;font-weight:900;letter-spacing:.1em;text-transform:uppercase;margin-bottom:4px}
      .meta{font-size:8px;opacity:.5;margin-bottom:24px;letter-spacing:.06em}
      table{width:100%;border-collapse:collapse;font-size:10px}
      thead{background:#141414;color:#E4E3E0}
      th{padding:8px 12px;text-align:left;font-size:8px;letter-spacing:.12em;text-transform:uppercase;font-weight:700}
      td{padding:10px 12px;border-bottom:1px solid #e5e7eb}
      tr:nth-child(even) td{background:#fafafa}
    </style></head><body>
    <h1>Stock Acumulado | Por Talla</h1>
    <div class="meta">Generado: ${now}${now} · ${bySizeList.length} tallas</div>
    <table>
      <thead><tr><th>Talla</th><th>Ingresado</th><th>Despachado</th><th>Balance</th></tr></thead>
      <tbody>${tableRows}</tbody>
    </table>
    </body></html>`;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 500);
  };

  const lowStockItems = products.map(p => {
    const productStock = stockLevels.filter(s => s.productId === p.id);
    const total = productStock.reduce((acc, curr) => acc + curr.quantity, 0);
    return { ...p, totalStock: total };
  }).filter(p => p.lowStockThreshold !== undefined && p.totalStock <= p.lowStockThreshold);

  return (
    <div className="flex flex-col gap-8">
      <ModuleInfo number="03" title="Dashboard" description="Vista general del almacen: stock total, alertas de bajo stock, movimientos recientes y metricas operativas en tiempo real." />
      {/* Header section */}
      <div className="border-b border-[var(--border)] pb-2">
        <h2 className="font-serif italic font-bold text-xs uppercase tracking-widest">01 // SYSTEM_STATUS</h2>
        <p className="font-mono text-[10px] opacity-70 uppercase tracking-wide mt-1">Resumen operativo del almacen al dia de hoy.</p>
      </div>

      {/* Main tabs */}
      <div className="flex border border-[var(--border)] bg-[var(--bg-sidebar)]">
        {([
          { key: 'resumen',  label: 'RESUMEN' },
          { key: 'producto', label: 'POR PRODUCTO' },
          { key: 'talla',    label: 'POR TALLA' },
        ] as const).map((tab, i, arr) => (
          <button
            key={tab.key}
            onClick={() => setMainTab(tab.key)}
            className={`flex-1 py-3 font-mono text-[10px] font-bold uppercase tracking-widest transition-all ${i < arr.length - 1 ? 'border-r border-[var(--border)]' : ''} ${mainTab === tab.key ? 'bg-[var(--ink)] text-[var(--ink-inv)]' : 'text-[var(--ink)] opacity-60 hover:opacity-100 hover:bg-[var(--surface)]'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* -- PESTANA: POR PRODUCTO ------------------------------------------------ */}
      {mainTab === 'producto' && (
        <div className="flex flex-col gap-4">
          <div className="border border-[var(--border)] bg-[var(--bg-sidebar)] px-4 py-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <span className="font-mono text-[10px] font-bold uppercase tracking-widest">STOCK ACUMULADO | POR PRODUCTO</span>
              <span className="font-mono text-[9px] opacity-50">{byProductList.length} productos</span>
            </div>
            <div className="flex gap-1">
              <button onClick={exportProductoPDF} title="Exportar PDF" className="flex items-center gap-1 px-2 py-1 border border-[var(--border)] font-mono text-[9px] uppercase font-bold hover:bg-[var(--ink)] hover:text-[var(--ink-inv)] transition-colors"><Printer size={11} /> PDF</button>
              <button onClick={exportProductoExcel} title="Exportar Excel" className="flex items-center gap-1 px-2 py-1 border border-[var(--border)] font-mono text-[9px] uppercase font-bold hover:bg-[var(--ink)] hover:text-[var(--ink-inv)] transition-colors"><FileSpreadsheet size={11} /> Excel</button>
              <button onClick={exportProductoCSV} title="Exportar CSV" className="flex items-center gap-1 px-2 py-1 border border-[var(--border)] font-mono text-[9px] uppercase font-bold hover:bg-[var(--ink)] hover:text-[var(--ink-inv)] transition-colors"><FileText size={11} /> CSV</button>
            </div>
          </div>

          {/* Totales globales */}
          <div className="grid grid-cols-4 border border-[var(--border)]">
            <div className="p-4 border-r border-[var(--border)]">
              <div className="font-mono text-[9px] font-bold uppercase tracking-widest opacity-60 mb-1">TOTAL INGRESADO</div>
              <div className="font-mono text-2xl font-black text-green-700">+{totalIn.toLocaleString()}</div>
            </div>
            <div className="p-4 border-r border-[var(--border)]">
              <div className="font-mono text-[9px] font-bold uppercase tracking-widest opacity-60 mb-1">TOTAL DESPACHADO</div>
              <div className="font-mono text-2xl font-black text-red-700">-{totalOut.toLocaleString()}</div>
            </div>
            <div className="p-4 border-r border-[var(--border)]">
              <div className="font-mono text-[9px] font-bold uppercase tracking-widest opacity-60 mb-1">TOTAL MERMAS</div>
              <div className={`font-mono text-2xl font-black ${totalWriteoff > 0 ? 'text-orange-600' : 'opacity-40'}`}>-{totalWriteoff.toLocaleString()}</div>
            </div>
            <div className="p-4">
              <div className="font-mono text-[9px] font-bold uppercase tracking-widest opacity-60 mb-1">BALANCE NETO</div>
              <div className={`font-mono text-2xl font-black ${netBalance >= 0 ? 'text-[var(--ink)]' : 'text-red-700'}`}>
                {netBalance >= 0 ? '+' : ''}{netBalance.toLocaleString()}
              </div>
            </div>
          </div>

          {/* Cards por producto */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {byProductList.map(p => (
              <div key={p.name} className="border border-[var(--border)] bg-[var(--surface)] flex flex-col shadow-[2px_2px_0_var(--border)]">
                {/* Header */}
                <div className="bg-[var(--ink)] text-[var(--ink-inv)] px-3 py-2 flex items-center justify-between gap-2">
                  <span className="font-mono text-[9px] font-bold uppercase tracking-widest truncate">{p.name}</span>
                  <span className={`font-mono text-[9px] font-bold px-1.5 py-0.5 border shrink-0 ${p.balance >= 0 ? 'border-green-400 text-green-300' : 'border-red-400 text-red-300'}`}>
                    {p.balance >= 0 ? '+' : ''}{p.balance}
                  </span>
                </div>
                {/* Totales IN / OUT / MERMA */}
                <div className={`grid divide-x divide-[#141414]/20 border-b border-[var(--border)]/20 ${p.writeoff > 0 ? 'grid-cols-3' : 'grid-cols-2'}`}>
                  <div className="p-3 flex flex-col gap-0.5">
                    <span className="font-mono text-[8px] uppercase tracking-widest opacity-50">INGRESADO</span>
                    <span className="font-mono text-xl font-black text-green-700">+{p.in}</span>
                  </div>
                  <div className="p-3 flex flex-col gap-0.5">
                    <span className="font-mono text-[8px] uppercase tracking-widest opacity-50">DESPACHADO</span>
                    <span className="font-mono text-xl font-black text-red-700">-{p.out}</span>
                  </div>
                  {p.writeoff > 0 && (
                    <div className="p-3 flex flex-col gap-0.5 bg-orange-500/10">
                      <span className="font-mono text-[8px] uppercase tracking-widest text-orange-600 opacity-80">MERMA</span>
                      <span className="font-mono text-xl font-black text-orange-600">-{p.writeoff}</span>
                    </div>
                  )}
                </div>
                {/* Desglose por talla */}
                <div className="px-3 py-2">
                  <div className="font-mono text-[8px] uppercase tracking-widest opacity-40 mb-1.5">POR TALLA</div>
                  <div className="flex flex-wrap gap-1.5">
                    {p.sizeList.map(s => (
                      <div key={s.size} className="border border-[var(--border)]/30 bg-[var(--ink)]/5 px-2 py-1 flex flex-col items-center min-w-[48px]">
                        <span className="font-mono text-[9px] font-black uppercase">{s.size}</span>
                        <span className="font-mono text-[8px] text-green-700 font-bold">+{s.in}</span>
                        <span className="font-mono text-[8px] text-red-700 font-bold">-{s.out}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
            {byProductList.length === 0 && (
              <div className="col-span-3 p-8 text-center font-mono text-xs uppercase opacity-40 border border-[var(--border)] bg-[var(--surface-alt)]">
                SIN MOVIMIENTOS REGISTRADOS
              </div>
            )}
          </div>
        </div>
      )}

      {/* -- PESTANA: POR TALLA -------------------------------------------------- */}
      {mainTab === 'talla' && (
        <div className="flex flex-col gap-4">
          <div className="border border-[var(--border)] bg-[var(--bg-sidebar)] px-4 py-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <span className="font-mono text-[10px] font-bold uppercase tracking-widest">STOCK ACUMULADO | POR TALLA</span>
              <span className="font-mono text-[9px] opacity-50">{bySizeList.length} tallas</span>
            </div>
            <div className="flex gap-1">
              <button onClick={exportTallaPDF} title="Exportar PDF" className="flex items-center gap-1 px-2 py-1 border border-[var(--border)] font-mono text-[9px] uppercase font-bold hover:bg-[var(--ink)] hover:text-[var(--ink-inv)] transition-colors"><Printer size={11} /> PDF</button>
              <button onClick={exportTallaExcel} title="Exportar Excel" className="flex items-center gap-1 px-2 py-1 border border-[var(--border)] font-mono text-[9px] uppercase font-bold hover:bg-[var(--ink)] hover:text-[var(--ink-inv)] transition-colors"><FileSpreadsheet size={11} /> Excel</button>
              <button onClick={exportTallaCSV} title="Exportar CSV" className="flex items-center gap-1 px-2 py-1 border border-[var(--border)] font-mono text-[9px] uppercase font-bold hover:bg-[var(--ink)] hover:text-[var(--ink-inv)] transition-colors"><FileText size={11} /> CSV</button>
            </div>
          </div>

          {/* Totales globales */}
          <div className="grid grid-cols-4 border border-[var(--border)]">
            <div className="p-4 border-r border-[var(--border)]">
              <div className="font-mono text-[9px] font-bold uppercase tracking-widest opacity-60 mb-1">TOTAL INGRESADO</div>
              <div className="font-mono text-2xl font-black text-green-700">+{totalIn.toLocaleString()}</div>
            </div>
            <div className="p-4 border-r border-[var(--border)]">
              <div className="font-mono text-[9px] font-bold uppercase tracking-widest opacity-60 mb-1">TOTAL DESPACHADO</div>
              <div className="font-mono text-2xl font-black text-red-700">-{totalOut.toLocaleString()}</div>
            </div>
            <div className="p-4 border-r border-[var(--border)]">
              <div className="font-mono text-[9px] font-bold uppercase tracking-widest opacity-60 mb-1">TOTAL MERMAS</div>
              <div className={`font-mono text-2xl font-black ${totalWriteoff > 0 ? 'text-orange-600' : 'opacity-40'}`}>-{totalWriteoff.toLocaleString()}</div>
            </div>
            <div className="p-4">
              <div className="font-mono text-[9px] font-bold uppercase tracking-widest opacity-60 mb-1">BALANCE NETO</div>
              <div className={`font-mono text-2xl font-black ${netBalance >= 0 ? 'text-[var(--ink)]' : 'text-red-700'}`}>
                {netBalance >= 0 ? '+' : ''}{netBalance.toLocaleString()}
              </div>
            </div>
          </div>

          {/* Cards por talla */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {bySizeList.map(s => (
              <div key={s.size} className="border border-[var(--border)] bg-[var(--surface)] flex flex-col shadow-[2px_2px_0_var(--border)]">
                <div className="bg-[var(--ink)] text-[var(--ink-inv)] px-3 py-3 text-center">
                  <span className="font-mono text-lg font-black uppercase tracking-widest">{s.size}</span>
                </div>
                <div className="p-3 text-center border-b border-[var(--border)]/20">
                  <div className="font-mono text-[8px] uppercase tracking-widest opacity-50 mb-0.5">BALANCE NETO</div>
                  <div className={`font-mono text-3xl font-black ${s.balance >= 0 ? 'text-[var(--ink)]' : 'text-red-700'}`}>
                    {s.balance >= 0 ? '+' : ''}{s.balance}
                  </div>
                </div>
                <div className={`grid divide-x divide-[#141414]/20 ${s.writeoff > 0 ? 'grid-cols-3' : 'grid-cols-2'}`}>
                  <div className="p-3 flex flex-col items-center gap-0.5">
                    <span className="font-mono text-[8px] uppercase tracking-widest opacity-50">IN</span>
                    <span className="font-mono text-lg font-black text-green-700">+{s.in}</span>
                  </div>
                  <div className="p-3 flex flex-col items-center gap-0.5">
                    <span className="font-mono text-[8px] uppercase tracking-widest opacity-50">OUT</span>
                    <span className="font-mono text-lg font-black text-red-700">-{s.out}</span>
                  </div>
                  {s.writeoff > 0 && (
                    <div className="p-3 flex flex-col items-center gap-0.5 bg-orange-500/10">
                      <span className="font-mono text-[8px] uppercase tracking-widest text-orange-600 opacity-80">MERMA</span>
                      <span className="font-mono text-lg font-black text-orange-600">-{s.writeoff}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {bySizeList.length === 0 && (
              <div className="col-span-4 p-8 text-center font-mono text-xs uppercase opacity-40 border border-[var(--border)] bg-[var(--surface-alt)]">
                SIN MOVIMIENTOS REGISTRADOS
              </div>
            )}
          </div>
        </div>
      )}

      {mainTab === 'resumen' && (
        <>
      {/* Low Stock Alert Panel */}
      {lowStockItems.length > 0 && (
        <button 
          onClick={() => {
            window.sessionStorage.setItem('inventoryFilter', 'LOW_STOCK');
            navigate('/inventory');
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
              VER EN INVENTARIO ?
            </span>
          </div>
          <p className="font-mono text-[10px] uppercase font-bold text-[#b91c1c]">
            {lowStockItems.length} SKU(s) POR DEBAJO DEL UMBRAL MINIMO. SE REQUIERE ATENCION INMEDIATA.
          </p>
          <div className="flex flex-wrap gap-2 mt-1 relative z-10">
            {lowStockItems.slice(0, 8).map(item => (
              <div key={item.id} className="bg-[var(--bg-input)] border border-[#b91c1c] px-2 py-1 flex items-center gap-2">
                <span className="font-mono text-[9px] font-bold text-[#b91c1c]">{item.code}</span>
                <span className="font-mono text-[10px] font-black">{item.totalStock}</span>
                <span className="font-mono text-[8px] opacity-60">/ {item.lowStockThreshold}</span>
              </div>
            ))}
            {lowStockItems.length > 8 && (
              <div className="bg-[var(--bg-input)] border border-[#b91c1c] px-2 py-1 flex items-center gap-2">
                <span className="font-mono text-[9px] font-bold text-[#b91c1c]">+{lowStockItems.length - 8} MAS</span>
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
          onClick={() => {
            sessionStorage.setItem('operationsLogFilter', JSON.stringify({ type: 'RECEPTION', dateFrom: todayStr, dateTo: todayStr }));
            navigate('/operations');
          }}
        />
        <StatCard
          label="DESP. HOY"
          value={todaysDispatches}
          icon={<ArrowUpRight size={20} className="text-[#b91c1c]" />}
          trend="- salidas"
          onClick={() => {
            sessionStorage.setItem('operationsLogFilter', JSON.stringify({ type: 'DISPATCH', dateFrom: todayStr, dateTo: todayStr }));
            navigate('/operations');
          }}
        />
        <StatCard
          label="MERMAS HOY"
          value={todaysWriteoffs}
          icon={<Trash2 size={20} className="text-orange-600" />}
          trend="bajas"
          warn={todaysWriteoffs > 0}
        />
      </div>

      {/* Chart Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="data-table-container">
          <div className="p-3 border-b border-[var(--border)] bg-[var(--bg-sidebar)] flex justify-between items-center gap-2">
            <h3 className="font-serif italic font-bold text-xs uppercase tracking-widest">02 // TENDENCIA · ULTIMOS {days}D</h3>
            <div className="flex gap-0 border border-[var(--border)]">
              {([7, 14, 30] as const).map(d => (
                <button key={d} onClick={() => setDays(d)}
                  className={`px-2 py-0.5 text-[9px] font-bold font-mono uppercase border-r last:border-r-0 border-[var(--border)] transition-colors ${days === d ? 'bg-[var(--ink)] text-[var(--ink-inv)]' : 'hover:bg-[var(--surface)]'}`}>
                  {d}D
                </button>
              ))}
            </div>
          </div>
          <div className="h-[300px] p-4 bg-[var(--surface)]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartBorder} opacity={0.1} vertical={false} />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontFamily: 'monospace', fontWeight: 'bold', fill: chartInk }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontFamily: 'monospace', fontWeight: 'bold', fill: chartInk }} />
                <Tooltip 
                  cursor={{ fill: 'rgba(20, 20, 20, 0.05)' }}
                  contentStyle={tooltipStyle}
                  itemStyle={{ fontSize: '11px', fontFamily: 'monospace', fontWeight: 'bold' }}
                  labelStyle={{ fontSize: '10px', fontFamily: 'monospace', fontWeight: 'bold', marginBottom: '4px', textTransform: 'uppercase' }}
                />
                <Legend wrapperStyle={{ fontSize: '10px', fontFamily: 'monospace', fontWeight: 'bold' }} iconType="square" />
                <Bar dataKey="recepciones" name="RECEPCIONES" fill="#15803d" radius={[2, 2, 0, 0]} maxBarSize={40} />
                <Bar dataKey="despachos"   name="DESPACHOS"   fill="#b91c1c" radius={[2, 2, 0, 0]} maxBarSize={40} />
                <Bar dataKey="mermas"      name="MERMAS"      fill="#ea580c" radius={[2, 2, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="data-table-container">
          <div className="p-3 border-b border-[var(--border)] bg-[var(--bg-sidebar)] flex justify-between items-center">
            <h3 className="font-serif italic font-bold text-xs uppercase tracking-widest">ROTACION_CATEGORIAS</h3>
          </div>
          <div className="h-[300px] p-4 bg-[var(--surface)]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryChartData} layout="vertical" margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartBorder} opacity={0.1} horizontal={false} />
                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontFamily: 'monospace', fontWeight: 'bold', fill: chartInk }} />
                <YAxis type="category" dataKey="nombre" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontFamily: 'monospace', fontWeight: 'bold', fill: chartInk }} width={80} />
                <Tooltip 
                  cursor={{ fill: 'rgba(20, 20, 20, 0.05)' }}
                  contentStyle={tooltipStyle}
                  itemStyle={{ fontSize: '11px', fontFamily: 'monospace', fontWeight: 'bold' }}
                  labelStyle={{ fontSize: '10px', fontFamily: 'monospace', fontWeight: 'bold', marginBottom: '4px', textTransform: 'uppercase' }}
                />
                <Bar dataKey="rotacion" name="UNIDADES" fill={chartInk} radius={[0, 2, 2, 0]} maxBarSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Stock historico acumulado */}
      <div className="data-table-container">
        <div className="p-3 border-b border-[var(--border)] bg-[var(--bg-sidebar)] flex justify-between items-center gap-2">
          <div className="flex items-center gap-2">
            <TrendingUp size={14} />
            <h3 className="font-serif italic font-bold text-xs uppercase tracking-widest">03 // STOCK_HISTORICO_ACUMULADO</h3>
          </div>
          <span className="font-mono text-[9px] opacity-50 uppercase">RECEP - DESPACHOS = BALANCE</span>
        </div>

        {/* Totalizadores */}
        <div className="grid grid-cols-4 border-b border-[var(--border)]">
          <div className="p-4 border-r border-[var(--border)] flex flex-col gap-1">
            <span className="font-mono text-[9px] font-bold uppercase tracking-widest opacity-60">TOTAL INGRESADO</span>
            <span className="font-mono text-2xl font-black text-green-700">+{totalIn.toLocaleString()}</span>
            <span className="font-mono text-[9px] opacity-40 uppercase">unidades historicas</span>
          </div>
          <div className="p-4 border-r border-[var(--border)] flex flex-col gap-1">
            <span className="font-mono text-[9px] font-bold uppercase tracking-widest opacity-60">TOTAL DESPACHADO</span>
            <span className="font-mono text-2xl font-black text-red-700">-{totalOut.toLocaleString()}</span>
            <span className="font-mono text-[9px] opacity-40 uppercase">ventas / salidas</span>
          </div>
          <div className="p-4 border-r border-[var(--border)] flex flex-col gap-1">
            <span className="font-mono text-[9px] font-bold uppercase tracking-widest opacity-60">TOTAL MERMAS</span>
            <span className={`font-mono text-2xl font-black ${totalWriteoff > 0 ? 'text-orange-600' : 'opacity-40'}`}>-{totalWriteoff.toLocaleString()}</span>
            <span className="font-mono text-[9px] opacity-40 uppercase">bajas / perdidas</span>
          </div>
          <div className="p-4 flex flex-col gap-1">
            <span className="font-mono text-[9px] font-bold uppercase tracking-widest opacity-60">BALANCE NETO</span>
            <span className={`font-mono text-2xl font-black ${netBalance >= 0 ? 'text-[var(--ink)]' : 'text-red-700'}`}>
              {netBalance >= 0 ? '+' : ''}{netBalance.toLocaleString()}
            </span>
            <span className="font-mono text-[9px] opacity-40 uppercase">stock acumulado total</span>
          </div>
        </div>

        {/* Grafica de linea acumulada */}
        {stockHistoryData.length > 0 ? (
          <div className="h-[280px] p-4 bg-[var(--surface)]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stockHistoryData} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartBorder} opacity={0.08} vertical={false} />
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 9, fontFamily: 'monospace', fontWeight: 'bold' }}
                  dy={8}
                  interval="preserveStartEnd"
                />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fontFamily: 'monospace', fontWeight: 'bold' }} />
                <Tooltip
                  cursor={{ stroke: '#141414', strokeWidth: 1, strokeDasharray: '4 4' }}
                  contentStyle={tooltipStyle}
                  itemStyle={{ fontSize: '11px', fontFamily: 'monospace', fontWeight: 'bold' }}
                  labelStyle={{ fontSize: '10px', fontFamily: 'monospace', fontWeight: 'bold', marginBottom: '4px', textTransform: 'uppercase' }}
                  formatter={(val: number, name: string) => [val.toLocaleString(), name]}
                />
                <ReferenceLine y={0} stroke="#b91c1c" strokeDasharray="4 4" strokeWidth={1} />
                <Legend wrapperStyle={{ fontSize: '10px', fontFamily: 'monospace', fontWeight: 'bold' }} iconType="square" />
                <Line
                  type="monotone"
                  dataKey="balance"
                  name="BALANCE ACUMULADO"
                  stroke={chartBorder}
                  strokeWidth={2}
                  dot={stockHistoryData.length <= 30}
                  activeDot={{ r: 5, fill: '#141414' }}
                />
                <Line
                  type="monotone"
                  dataKey="in"
                  name="INGRESADO"
                  stroke="#15803d"
                  strokeWidth={1.5}
                  strokeDasharray="4 2"
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="out"
                  name="DESPACHADO"
                  stroke="#b91c1c"
                  strokeWidth={1.5}
                  strokeDasharray="4 2"
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="mermas"
                  name="MERMAS"
                  stroke="#ea580c"
                  strokeWidth={1.5}
                  strokeDasharray="2 3"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="p-8 text-center font-mono text-xs uppercase opacity-40 bg-[var(--surface-alt)]">
            SIN MOVIMIENTOS REGISTRADOS AUN
          </div>
        )}
      </div>

      {/* Recents */}
      <div className="data-table-container mt-4">
        <div className="p-3 border-b border-[var(--border)] bg-[var(--bg-sidebar)] flex justify-between items-center">
          <h3 className="font-serif italic font-bold text-xs uppercase tracking-widest">04 // Ultimos_Movimientos</h3>
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
            const typeColor = tx.type === 'RECEPTION' ? 'bg-[#15803d] text-white border-[var(--border)]' 
               : tx.type === 'DISPATCH' ? 'bg-[var(--ink)] text-[var(--ink-inv)] border-[var(--border)]' 
               : 'bg-[var(--bg-input)] border-[var(--border)] text-[var(--ink)]'; 
               
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
             <div className="p-8 text-center text-[var(--ink)] opacity-50 font-mono text-xs font-bold uppercase">NO SE ENCONTRARON REGISTROS</div>
          )}
        </div>
      </div>
        </>
      )}
    </div>
  );
};

const StatCard: React.FC<{label: string, value: string | number, icon: React.ReactNode, trend?: string, onClick?: () => void, warn?: boolean}> = ({label, value, icon, trend, onClick, warn}) => (
  <div
    onClick={onClick}
    className={`border p-3 flex flex-col gap-3 relative group hover:bg-[var(--ink)] hover:text-[var(--ink-inv)] transition-colors shadow-[2px_2px_0_var(--border)]${onClick ? ' cursor-pointer' : ''} ${warn && Number(value) > 0 ? 'bg-orange-500/10 border-orange-500' : 'bg-[var(--surface)] border-[var(--border)]'}`}
  >
    <div className="flex justify-between items-start">
      <div className="font-mono text-[10px] font-bold opacity-70 tracking-widest uppercase">{label}</div>
      <div className="p-1 border border-current">{icon}</div>
    </div>
    <div className="flex items-end gap-2 mt-1">
      <div className="font-mono text-3xl font-black tracking-tighter leading-none">{value}</div>
      {trend && <div className="font-mono text-[9px] mb-1 px-1 border border-current uppercase font-bold">{trend}</div>}
    </div>
    {onClick && <div className="font-mono text-[7px] opacity-0 group-hover:opacity-60 uppercase tracking-widest absolute bottom-2 right-3">VER DETALLE ?</div>}
  </div>
);

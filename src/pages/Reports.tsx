import React, { useState, useRef } from 'react';
import { useAppContext } from '../store/AppContext';
import { ModuleInfo } from '../components/ModuleInfo';
import { Printer, Download, BarChart2, Package, ArrowLeftRight, Users } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

type ReportType = 'inventory' | 'movements' | 'valuation' | 'adjustments';

const REPORT_TITLES: Record<ReportType, string> = {
  inventory: 'INVENTARIO VALORIZADO',
  movements: 'MOVIMIENTOS POR PROVEEDOR',
  valuation: 'VALORIZACIÓN POR MARCA',
  adjustments: 'HISTORIAL DE AJUSTES',
};

export const Reports: React.FC = () => {
  const { products, stockLevels, transactions, contacts, adjustments, locations, activeBrand } = useAppContext();
  const [activeReport, setActiveReport] = useState<ReportType>('inventory');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const printRef = useRef<HTMLDivElement>(null);

  const totalStock = (productId: string) => stockLevels.filter(s => s.productId === productId).reduce((s, l) => s + l.quantity, 0);

  const inventoryRows = products.map(p => {
    const qty = totalStock(p.id);
    return { ...p, qty, totalCost: qty * (p.costPrice || 0), totalSell: qty * (p.sellPrice || 0) };
  }).filter(r => r.qty > 0);

  const filteredTx = transactions.filter(tx => {
    if (dateFrom && tx.date < dateFrom) return false;
    if (dateTo && tx.date > dateTo + 'T23:59:59') return false;
    return true;
  });

  const movementsBySupplier = contacts.filter(c => c.type === 'SUPPLIER').map(supplier => {
    const txs = filteredTx.filter(tx => tx.contactId === supplier.id && tx.type === 'RECEPTION');
    const total = txs.reduce((s, t) => s + t.quantity, 0);
    return { supplier, txs, total };
  }).filter(s => s.total > 0);

  const valuationTotal = {
    cost: inventoryRows.reduce((s, r) => s + r.totalCost, 0),
    sell: inventoryRows.reduce((s, r) => s + r.totalSell, 0),
    units: inventoryRows.reduce((s, r) => s + r.qty, 0),
  };

  const filteredAdj = adjustments.filter(adj => {
    if (dateFrom && adj.date < dateFrom) return false;
    if (dateTo && adj.date > dateTo + 'T23:59:59') return false;
    return true;
  });

  const exportCSV = () => {
    let csv = '';
    if (activeReport === 'inventory') {
      csv = 'Código,Nombre,Color,Talla,Categoría,Stock,Costo Unit,Costo Total,PVP Unit,PVP Total\n';
      csv += inventoryRows.map(r =>
        `${r.code},"${r.name}",${r.color || ''},${r.size || ''},${r.category},${r.qty},${r.costPrice || 0},${r.totalCost.toFixed(2)},${r.sellPrice || 0},${r.totalSell.toFixed(2)}`
      ).join('\n');
    } else if (activeReport === 'adjustments') {
      csv = 'Fecha,Producto,Ubicación,Antes,Después,Diferencia,Motivo,Notas,Usuario\n';
      csv += filteredAdj.map(a => {
        const prod = products.find(p => p.id === a.productId);
        const loc = locations.find(l => l.id === a.locationId);
        return `${format(new Date(a.date), 'dd/MM/yyyy HH:mm')},"${prod?.name || a.productId}","${loc?.name || a.locationId}",${a.previousQuantity},${a.newQuantity},${a.newQuantity - a.previousQuantity},${a.reason},"${a.notes || ''}",${a.user}`;
      }).join('\n');
    }
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reporte_${activeReport}_${format(new Date(), 'yyyyMMdd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <html><head><title>Reporte — ${REPORT_TITLES[activeReport]}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Courier New', monospace; font-size: 10px; color: #141414; padding: 24px; }
        h1 { font-size: 14px; font-weight: 900; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 4px; }
        .meta { font-size: 9px; opacity: 0.6; margin-bottom: 16px; }
        table { width: 100%; border-collapse: collapse; margin-top: 12px; }
        th { border-bottom: 2px solid #141414; padding: 4px 6px; text-align: left; font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; }
        td { border-bottom: 1px solid #ccc; padding: 4px 6px; font-size: 9px; }
        .text-right { text-align: right; }
        .total-row td { border-top: 2px solid #141414; font-weight: bold; }
        .brand { display: inline-block; background: #141414; color: #E4E3E0; padding: 2px 6px; font-size: 9px; font-weight: bold; margin-bottom: 8px; }
        @media print { body { padding: 12px; } }
      </style></head><body>
      <div class="brand">${activeBrand.replace('_', ' ')}</div>
      <h1>${REPORT_TITLES[activeReport]}</h1>
      <div class="meta">Generado: ${format(new Date(), "dd 'de' MMMM yyyy 'a las' HH:mm", { locale: es })}${dateFrom ? ` | Desde: ${dateFrom}` : ''}${dateTo ? ` | Hasta: ${dateTo}` : ''}</div>
      ${content.innerHTML}
      </body></html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 300);
  };

  return (
    <div className="flex flex-col gap-6 h-full">
      <ModuleInfo number="10" title="Reportes" description="Generación y exportación de reportes operativos: inventario actual, movimientos por período, valorización de stock y alertas de stock bajo mínimo." />
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 border-b border-[#141414] pb-3">
        <div>
          <h2 className="font-serif italic font-bold text-xs uppercase tracking-widest text-[#141414]">11 // REPORTES</h2>
          <p className="font-mono text-[10px] opacity-70 uppercase tracking-wide mt-1">Exportación y visualización de datos.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={exportCSV} className="flex items-center gap-1.5 border border-[#141414] px-3 py-2 text-[10px] font-bold font-mono uppercase hover:bg-white/50 transition-all">
            <Download size={13} /> CSV
          </button>
          <button onClick={handlePrint} className="flex items-center gap-1.5 bg-[#141414] text-[#E4E3E0] px-3 py-2 text-[10px] font-bold font-mono uppercase hover:shadow-[3px_3px_0_#9f9d99] transition-all border border-[#141414]">
            <Printer size={13} /> IMPRIMIR / PDF
          </button>
        </div>
      </div>

      {/* Report selector */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {([
          { id: 'inventory', label: 'Inventario Valorizado', icon: Package },
          { id: 'movements', label: 'Movimientos Proveedor', icon: ArrowLeftRight },
          { id: 'valuation', label: 'Valorización', icon: BarChart2 },
          { id: 'adjustments', label: 'Ajustes de Stock', icon: Users },
        ] as const).map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setActiveReport(id)}
            className={`flex items-center gap-2 p-3 border text-left transition-all ${activeReport === id ? 'bg-[#141414] text-[#E4E3E0] border-[#141414] shadow-[2px_2px_0_#9f9d99]' : 'border-[#141414] bg-white/30 hover:bg-white/60'}`}>
            <Icon size={16} className="shrink-0" />
            <span className="font-mono text-[10px] font-bold uppercase leading-tight">{label}</span>
          </button>
        ))}
      </div>

      {/* Date filter */}
      {(activeReport === 'movements' || activeReport === 'adjustments') && (
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex flex-col gap-1">
            <label className="font-mono text-[9px] font-bold uppercase tracking-widest opacity-60">Desde</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="border border-[#141414] bg-white/50 px-3 py-1.5 text-xs font-mono focus:outline-none" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="font-mono text-[9px] font-bold uppercase tracking-widest opacity-60">Hasta</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="border border-[#141414] bg-white/50 px-3 py-1.5 text-xs font-mono focus:outline-none" />
          </div>
          {(dateFrom || dateTo) && (
            <button onClick={() => { setDateFrom(''); setDateTo(''); }} className="font-mono text-[10px] opacity-60 hover:opacity-100 mt-4">✕ Limpiar</button>
          )}
        </div>
      )}

      {/* Report content */}
      <div ref={printRef} className="overflow-x-auto">
        {activeReport === 'inventory' && (
          <table className="w-full text-[10px] font-mono border-collapse">
            <thead>
              <tr className="border-b-2 border-[#141414]">
                <th className="text-left py-2 pr-3 font-bold uppercase">Código</th>
                <th className="text-left py-2 pr-3 font-bold uppercase">Nombre</th>
                <th className="text-left py-2 pr-3 font-bold uppercase">Color</th>
                <th className="text-left py-2 pr-3 font-bold uppercase">Talla</th>
                <th className="text-right py-2 px-3 font-bold uppercase">Stock</th>
                <th className="text-right py-2 px-3 font-bold uppercase">Costo U.</th>
                <th className="text-right py-2 px-3 font-bold uppercase">Total Costo</th>
                <th className="text-right py-2 px-3 font-bold uppercase">PVP U.</th>
                <th className="text-right py-2 pl-3 font-bold uppercase">Total PVP</th>
              </tr>
            </thead>
            <tbody>
              {inventoryRows.map(r => (
                <tr key={r.id} className="border-b border-[#141414]/20 hover:bg-white/40">
                  <td className="py-1.5 pr-3">{r.code}</td>
                  <td className="py-1.5 pr-3">{r.name}</td>
                  <td className="py-1.5 pr-3 opacity-70">{r.color}</td>
                  <td className="py-1.5 pr-3 opacity-70">{r.size}</td>
                  <td className="text-right py-1.5 px-3 font-bold">{r.qty}</td>
                  <td className="text-right py-1.5 px-3">S/ {(r.costPrice || 0).toFixed(2)}</td>
                  <td className="text-right py-1.5 px-3 font-bold">S/ {r.totalCost.toFixed(2)}</td>
                  <td className="text-right py-1.5 px-3">S/ {(r.sellPrice || 0).toFixed(2)}</td>
                  <td className="text-right py-1.5 pl-3 font-bold">S/ {r.totalSell.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-[#141414]">
                <td colSpan={4} className="py-2 pr-3 font-bold uppercase">TOTAL ({inventoryRows.length} SKUs)</td>
                <td className="text-right py-2 px-3 font-black">{valuationTotal.units}</td>
                <td className="text-right py-2 px-3"></td>
                <td className="text-right py-2 px-3 font-black">S/ {valuationTotal.cost.toFixed(2)}</td>
                <td className="text-right py-2 px-3"></td>
                <td className="text-right py-2 pl-3 font-black">S/ {valuationTotal.sell.toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>
        )}

        {activeReport === 'movements' && (
          <div className="flex flex-col gap-6">
            {movementsBySupplier.length === 0
              ? <div className="text-center font-mono text-xs opacity-50 py-12 uppercase tracking-widest">Sin recepciones en el período</div>
              : movementsBySupplier.map(({ supplier, txs, total }) => (
                <div key={supplier.id} className="border border-[#141414]">
                  <div className="bg-[#141414] text-[#E4E3E0] px-4 py-2 flex justify-between">
                    <span className="font-mono font-bold text-xs uppercase">{supplier.name}</span>
                    <span className="font-mono text-xs">{total} unidades · {txs.length} recepciones</span>
                  </div>
                  <table className="w-full text-[10px] font-mono border-collapse">
                    <thead><tr className="border-b border-[#141414]">
                      <th className="text-left py-1.5 px-3 font-bold uppercase">Fecha</th>
                      <th className="text-left py-1.5 px-3 font-bold uppercase">Referencia</th>
                      <th className="text-left py-1.5 px-3 font-bold uppercase">Producto</th>
                      <th className="text-right py-1.5 px-3 font-bold uppercase">Qty</th>
                    </tr></thead>
                    <tbody>
                      {txs.map(tx => {
                        const prod = products.find(p => p.id === tx.productId);
                        return (
                          <tr key={tx.id} className="border-b border-[#141414]/20 hover:bg-white/40">
                            <td className="py-1.5 px-3">{format(new Date(tx.date), 'dd/MM/yyyy', { locale: es })}</td>
                            <td className="py-1.5 px-3 opacity-70">{tx.reference}</td>
                            <td className="py-1.5 px-3">{prod ? `${prod.code} ${prod.name} ${prod.color || ''} ${prod.size || ''}`.trim() : tx.productId}</td>
                            <td className="text-right py-1.5 px-3 font-bold">{tx.quantity}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ))
            }
          </div>
        )}

        {activeReport === 'valuation' && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: 'Total SKUs con stock', value: inventoryRows.length.toString(), sub: 'productos activos' },
              { label: 'Unidades totales', value: valuationTotal.units.toLocaleString(), sub: 'unidades en almacén' },
              { label: 'Valor a costo', value: `S/ ${valuationTotal.cost.toFixed(2)}`, sub: 'valorización al costo' },
              { label: 'Valor a PVP', value: `S/ ${valuationTotal.sell.toFixed(2)}`, sub: 'valorización al precio venta' },
              { label: 'Margen bruto estimado', value: `S/ ${(valuationTotal.sell - valuationTotal.cost).toFixed(2)}`, sub: 'PVP − Costo' },
              { label: '% Margen', value: valuationTotal.cost > 0 ? `${(((valuationTotal.sell - valuationTotal.cost) / valuationTotal.cost) * 100).toFixed(1)}%` : 'N/A', sub: 'rentabilidad estimada' },
            ].map(({ label, value, sub }) => (
              <div key={label} className="border border-[#141414] bg-white/40 p-5">
                <div className="font-mono text-[9px] uppercase tracking-widest opacity-60 mb-2">{label}</div>
                <div className="font-mono font-black text-2xl text-[#141414]">{value}</div>
                <div className="font-mono text-[9px] opacity-50 mt-1">{sub}</div>
              </div>
            ))}
          </div>
        )}

        {activeReport === 'adjustments' && (
          <table className="w-full text-[10px] font-mono border-collapse">
            <thead>
              <tr className="border-b-2 border-[#141414]">
                <th className="text-left py-2 pr-3 font-bold uppercase">Fecha</th>
                <th className="text-left py-2 pr-3 font-bold uppercase">Producto</th>
                <th className="text-left py-2 pr-3 font-bold uppercase">Ubicación</th>
                <th className="text-right py-2 px-3 font-bold uppercase">Antes</th>
                <th className="text-right py-2 px-3 font-bold uppercase">Después</th>
                <th className="text-right py-2 px-3 font-bold uppercase">Diff</th>
                <th className="text-left py-2 px-3 font-bold uppercase">Motivo</th>
                <th className="text-left py-2 pl-3 font-bold uppercase">Usuario</th>
              </tr>
            </thead>
            <tbody>
              {filteredAdj.length === 0
                ? <tr><td colSpan={8} className="text-center py-12 opacity-50 uppercase tracking-widest">Sin ajustes en el período</td></tr>
                : filteredAdj.map(a => {
                  const prod = products.find(p => p.id === a.productId);
                  const loc = locations.find(l => l.id === a.locationId);
                  const diff = a.newQuantity - a.previousQuantity;
                  return (
                    <tr key={a.id} className="border-b border-[#141414]/20 hover:bg-white/40">
                      <td className="py-1.5 pr-3">{format(new Date(a.date), 'dd/MM/yy HH:mm')}</td>
                      <td className="py-1.5 pr-3">{prod ? `${prod.code} ${prod.name}` : a.productId}</td>
                      <td className="py-1.5 pr-3 opacity-70">{loc?.name}</td>
                      <td className="text-right py-1.5 px-3">{a.previousQuantity}</td>
                      <td className="text-right py-1.5 px-3 font-bold">{a.newQuantity}</td>
                      <td className={`text-right py-1.5 px-3 font-bold ${diff > 0 ? 'text-green-700' : diff < 0 ? 'text-red-600' : 'opacity-50'}`}>
                        {diff > 0 ? `+${diff}` : diff}
                      </td>
                      <td className="py-1.5 px-3 opacity-70">{a.reason}</td>
                      <td className="py-1.5 pl-3 opacity-70">{a.user}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

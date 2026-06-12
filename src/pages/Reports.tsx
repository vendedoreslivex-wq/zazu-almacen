import React, { useState, useRef, useMemo } from 'react';
import { useAppContext } from '../store/AppContext';
import { ModuleInfo } from '../components/ModuleInfo';
import { Printer, Download, BarChart2, Package, ArrowLeftRight, Users, Star, Clock, FileSpreadsheet, FileText, ChevronDown, LayoutGrid, List } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

type ReportType = 'inventory' | 'movements' | 'valuation' | 'adjustments' | 'abc' | 'aging';

const REPORT_TITLES: Record<ReportType, string> = {
  inventory: 'INVENTARIO VALORIZADO',
  movements: 'MOVIMIENTOS POR PROVEEDOR',
  valuation: 'VALORIZACION POR MARCA',
  adjustments: 'HISTORIAL DE AJUSTES',
  abc: 'ANALISIS ABC DE ROTACION',
  aging: 'ANTIG-EDAD DE STOCK',
};

// --- Men- desplegable de exportacion -----------------------------------------

function ExportMenu({ onPDF, onExcel, onCSV }: { onPDF: () => void; onExcel: () => void; onCSV: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 border border-[var(--border)] px-3 py-2 text-[10px] font-bold font-mono uppercase hover:bg-[var(--surface)] transition-all"
      >
        <Download size={13} /> Exportar <ChevronDown size={11} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-[var(--bg)] border border-[var(--border)] shadow-[3px_3px_0_var(--border)] min-w-[160px]">
          <button
            onClick={() => { onPDF(); setOpen(false); }}
            className="flex items-center gap-2 w-full px-4 py-2.5 font-mono text-[10px] uppercase tracking-widest hover:bg-[var(--ink)] hover:text-[var(--ink-inv)] transition-colors text-left"
          >
            <FileText size={12} /> PDF (descargar)
          </button>
          <div className="border-t border-[var(--border)]/20" />
          <button
            onClick={() => { onExcel(); setOpen(false); }}
            className="flex items-center gap-2 w-full px-4 py-2.5 font-mono text-[10px] uppercase tracking-widest hover:bg-[var(--ink)] hover:text-[var(--ink-inv)] transition-colors text-left"
          >
            <FileSpreadsheet size={12} /> Excel (.xlsx)
          </button>
          <div className="border-t border-[var(--border)]/20" />
          <button
            onClick={() => { onCSV(); setOpen(false); }}
            className="flex items-center gap-2 w-full px-4 py-2.5 font-mono text-[10px] uppercase tracking-widest hover:bg-[var(--ink)] hover:text-[var(--ink-inv)] transition-colors text-left"
          >
            <FileText size={12} /> CSV
          </button>
        </div>
      )}
    </div>
  );
}

// --- M-dulo principal ---------------------------------------------------------

export const Reports: React.FC = () => {
  const { products, stockLevels, transactions, contacts, adjustments, locations, activeBrand } = useAppContext();
  const [activeReport, setActiveReport] = useState<ReportType>('inventory');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const printRef = useRef<HTMLDivElement>(null);

  const totalStock = (productId: string) =>
    stockLevels.filter(s => s.productId === productId).reduce((s, l) => s + l.quantity, 0);

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

  const [agingDays, setAgingDays] = useState(30);
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');

  const abcData = useMemo(() => {
    const rows = products.map(p => {
      const dispatched = transactions
        .filter(t => t.type === 'DISPATCH' && t.productId === p.id)
        .reduce((s, t) => s + t.quantity, 0);
      return { prod: p, dispatched };
    }).filter(r => r.dispatched > 0).sort((a, b) => b.dispatched - a.dispatched);
    const totalDisp = rows.reduce((s, r) => s + r.dispatched, 0);
    let cumulative = 0;
    return rows.map(r => {
      cumulative += r.dispatched;
      const pct = totalDisp > 0 ? cumulative / totalDisp : 0;
      const cls = pct <= 0.8 ? 'A' : pct <= 0.95 ? 'B' : 'C';
      return { ...r, cls, pct: (r.dispatched / totalDisp) * 100 };
    });
  }, [products, transactions]);

  type AgingRow = { prod: typeof products[0]; stock: number; lastDispatch: string | undefined; daysSince: number | null };
  const agingData = useMemo((): AgingRow[] => {
    const now = new Date();
    const rows: AgingRow[] = [];
    for (const p of products) {
      const stock = totalStock(p.id);
      if (stock <= 0) continue;
      const lastDispatch = transactions
        .filter(t => t.type === 'DISPATCH' && t.productId === p.id)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
      const daysSince = lastDispatch ? differenceInDays(now, new Date(lastDispatch.date)) : null;
      if (daysSince === null || daysSince >= agingDays) {
        rows.push({ prod: p, stock, lastDispatch: lastDispatch?.date, daysSince });
      }
    }
    return rows.sort((a, b) => (b.daysSince ?? 9999) - (a.daysSince ?? 9999));
  }, [products, transactions, stockLevels, agingDays]);

  // --- Datos planos para CSV / Excel -----------------------------------------

  const getSheetData = (): { headers: string[]; rows: (string | number | null)[][] } => {
    switch (activeReport) {
      case 'inventory': {
        const totalUnits = inventoryRows.reduce((s, r) => s + r.qty, 0);
        return {
          headers: ['Codigo', 'Nombre', 'Color', 'Talla', 'Categor-a', 'Stock', '% Entrada'],
          rows: inventoryRows.map(r => [
            r.code, r.name, r.color || '', r.size || '', r.category,
            r.qty, totalUnits > 0 ? +((r.qty / totalUnits) * 100).toFixed(1) : 0,
          ]),
        };
      }
      case 'movements':
        return {
          headers: ['Proveedor', 'Fecha', 'Referencia', 'Producto', 'Codigo', 'Color', 'Talla', 'Cantidad'],
          rows: movementsBySupplier.flatMap(({ supplier, txs }) =>
            txs.map(tx => {
              const prod = products.find(p => p.id === tx.productId);
              return [
                supplier.name,
                format(new Date(tx.date), 'dd/MM/yyyy HH:mm'),
                tx.reference || '',
                prod?.name || tx.productId,
                prod?.code || '',
                prod?.color || '',
                prod?.size || '',
                tx.quantity,
              ];
            })
          ),
        };
      case 'valuation':
        return {
          headers: ['Indicador', 'Valor'],
          rows: [
            ['SKUs con stock', inventoryRows.length],
            ['Unidades totales', valuationTotal.units],
          ],
        };
      case 'adjustments':
        return {
          headers: ['Fecha', 'Producto', 'Codigo', 'Ubicacion', 'Antes', 'Despu-s', 'Diferencia', 'Motivo', 'Notas', 'Usuario'],
          rows: filteredAdj.map(a => {
            const prod = products.find(p => p.id === a.productId);
            const loc = locations.find(l => l.id === a.locationId);
            return [
              format(new Date(a.date), 'dd/MM/yyyy HH:mm'),
              prod?.name || a.productId,
              prod?.code || '',
              loc?.name || a.locationId,
              a.previousQuantity,
              a.newQuantity,
              a.newQuantity - a.previousQuantity,
              a.reason,
              a.notes || '',
              a.user,
            ];
          }),
        };
      case 'abc':
        return {
          headers: ['Clase', 'Codigo', 'Producto', 'Color', 'Talla', 'Despachos', '% Volumen'],
          rows: abcData.map(r => [
            r.cls, r.prod.code, r.prod.name, r.prod.color || '', r.prod.size || '',
            r.dispatched, +r.pct.toFixed(2),
          ]),
        };
      case 'aging':
        return {
          headers: ['Codigo', 'Producto', 'Color', 'Talla', 'Stock', 'ultimo Despacho', 'D-as sin movimiento'],
          rows: agingData.map(r => [
            r.prod.code, r.prod.name, r.prod.color || '', r.prod.size || '',
            r.stock,
            r.lastDispatch ? format(new Date(r.lastDispatch), 'dd/MM/yyyy') : 'Sin despachos',
            r.daysSince !== null ? r.daysSince : 'Sin despachos',
          ]),
        };
    }
  };

  // --- Exportar CSV -----------------------------------------------------------

  const exportCSV = () => {
    const { headers, rows } = getSheetData();
    const escape = (v: string | number | null) => {
      const s = String(v ?? '');
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [headers, ...rows].map(row => row.map(escape).join(',')).join('\n');
    const blob = new Blob(['?' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeReport}_${format(new Date(), 'yyyyMMdd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // --- Exportar Excel ---------------------------------------------------------

  const exportExcel = () => {
    const { headers, rows } = getSheetData();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

    // Ancho de columnas autom-tico
    const colWidths = headers.map((h, i) => {
      const maxLen = Math.max(h.length, ...rows.map(r => String(r[i] ?? '').length));
      return { wch: Math.min(maxLen + 2, 40) };
    });
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, REPORT_TITLES[activeReport].slice(0, 31));
    XLSX.writeFile(wb, `${activeReport}_${format(new Date(), 'yyyyMMdd')}.xlsx`);
  };

  // --- Exportar PDF -----------------------------------------------------------

  const handlePDF = async () => {
    const now = format(new Date(), "dd 'de' MMMM yyyy, HH:mm", { locale: es });
    const title = REPORT_TITLES[activeReport];
    const brand = activeBrand.replace('_', ' ');

    const dateRangeLabel = (() => {
      if (dateFrom && dateTo)
        return `Del ${format(new Date(dateFrom), "d 'de' MMMM", { locale: es })} al ${format(new Date(dateTo), "d 'de' MMMM 'del' yyyy", { locale: es })}`;
      if (dateFrom)
        return `Desde el ${format(new Date(dateFrom), "d 'de' MMMM 'del' yyyy", { locale: es })}`;
      if (dateTo)
        return `Hasta el ${format(new Date(dateTo), "d 'de' MMMM 'del' yyyy", { locale: es })}`;
      return '';
    })();

    // Logo Zazu Express — inventory variant (light, PDF is always white bg)
    const logoB64 = await fetch('/Zazu/inv/zazu-inv-light.png')
      .then(r => r.blob())
      .then(b => new Promise<string>(res => { const fr = new FileReader(); fr.onload = () => res(fr.result as string); fr.readAsDataURL(b); }))
      .catch(() => '');
    const logoSVG = logoB64
      ? `<img src="${logoB64}" style="width:70px;height:70px;object-fit:contain" />`
      : `<svg width="90" height="60" viewBox="0 0 90 60" xmlns="http://www.w3.org/2000/svg"><rect width="90" height="60" fill="#6B21A8" rx="4"/><text x="45" y="32" font-family="Arial Black,sans-serif" font-size="22" font-weight="900" fill="white" text-anchor="middle">zazu</text><text x="45" y="47" font-family="Arial,sans-serif" font-size="9" fill="#e9d5ff" text-anchor="middle" letter-spacing="3">express</text></svg>`;

    // CSS compartido para todos los reportes
    const sharedCSS = `
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap');
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: Inter, Arial, sans-serif; background: white; color: #111; padding: 28px 40px; font-size: 11px; width: 257mm; }
      @page { size: A4 landscape; margin: 12mm 14mm; }
      @media print { body { padding: 0; } }

      /* -- Header -- */
      .doc-header { display: flex; align-items: flex-start; gap: 24px; margin-bottom: 28px; padding-bottom: 20px; border-bottom: 2px solid #ddd; }
      .doc-logo { flex-shrink: 0; width: 70px; height: 70px; display: flex; align-items: center; justify-content: center; }
      .doc-company { flex: 1; padding-top: 4px; }
      .doc-company .name { font-size: 13px; font-weight: 900; text-transform: uppercase; letter-spacing: .03em; line-height: 1.3; }
      .doc-company .ruc { font-size: 11px; font-weight: 700; margin-top: 4px; }
      .doc-meta { text-align: right; font-size: 9px; color: #666; line-height: 1.7; }
      .doc-brand { display: inline-block; background: #6B21A8; color: white; padding: 2px 10px; font-size: 9px; font-weight: 700; border-radius: 3px; margin-top: 4px; letter-spacing: .08em; }

      /* -- T-tulo -- */
      .doc-title { text-align: center; margin: 20px 0 10px; }
      .doc-title h1 { font-size: 15px; font-weight: 900; text-transform: uppercase; letter-spacing: .05em; }
      .doc-date { text-align: center; font-size: 11px; font-weight: 700; margin-bottom: 22px; }

      /* -- Tabla pivote (modelo · talla) -- */
      table { width: 100%; border-collapse: collapse; font-size: 10.5px; }
      thead th { background: #e8e8e8; padding: 7px 10px; text-align: center; font-weight: 700; font-size: 10px; text-transform: uppercase; border: 1px solid #ccc; }
      thead th.col-model { text-align: left; min-width: 160px; }
      tbody td { padding: 6px 10px; border: 1px solid #ddd; text-align: center; }
      tbody td.col-model { text-align: left; font-weight: 600; }
      tbody tr:nth-child(even) td { background: #f9f9f9; }
      tbody td.col-total { font-weight: 700; background: #f0f0f0; }
      tfoot td { padding: 7px 10px; border: 1px solid #ccc; text-align: center; font-weight: 900; background: #e0e0e0; font-size: 11px; }
      tfoot td.col-model { text-align: left; }

      /* -- Summary cards -- */
      .summary { display: grid; gap: 10px; margin-bottom: 22px; }
      .card { border: 1.5px solid #ddd; padding: 11px 14px; border-radius: 4px; }
      .card.dark { background: #111; color: white; }
      .card.purple { background: #6B21A8; color: white; }
      .card .label { font-size: 8px; text-transform: uppercase; letter-spacing: .15em; opacity: .6; margin-bottom: 4px; }
      .card .value { font-size: 22px; font-weight: 900; line-height: 1; }
      .card .hint { font-size: 8px; opacity: .45; text-transform: uppercase; margin-top: 3px; }

      /* -- Tabla est-ndar -- */
      .std-table { width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 16px; }
      .std-table thead th { background: #111; color: white; padding: 8px 10px; text-align: left; font-size: 8px; letter-spacing: .15em; text-transform: uppercase; font-weight: 700; }
      .std-table th.c, .std-table td.c { text-align: center; }
      .std-table th.r, .std-table td.r { text-align: right; }
      .std-table tbody tr { border-bottom: 1px solid #e5e7eb; }
      .std-table tbody td { padding: 7px 10px; vertical-align: top; }
      .std-table tbody tr:nth-child(even) td { background: #fafafa; }
      .std-table tfoot td { padding: 8px 10px; font-weight: 700; border-top: 2px solid #111; background: #f5f5f5; }

      /* -- ABC chips -- */
      .cls-a { color: #15803d; font-weight: 900; }
      .cls-b { color: #b45309; font-weight: 900; }
      .cls-c { opacity: .55; }

      /* -- Footer -- */
      .doc-footer { margin-top: 28px; padding-top: 10px; border-top: 1px solid #e5e7eb; display: flex; justify-content: space-between; font-size: 8px; color: #aaa; }
    `;

    const headerHTML = `
      <div class="doc-header">
        <div class="doc-logo">${logoSVG}</div>
        <div class="doc-company">
          <div class="name">Tecnología y Distribución Logística<br>del Perú S.A.C.</div>
          <div class="ruc">RUC: 20614699842</div>
        </div>
        <div class="doc-meta">
          Generado: ${now}<br>
          Marca: <span class="doc-brand">${brand}</span>
        </div>
      </div>
      <div class="doc-title"><h1>${title}</h1></div>
      ${dateRangeLabel ? `<div class="doc-date">${dateRangeLabel}</div>` : `<div style="margin-bottom:16px"></div>`}
    `;

    const footerHTML = `<div class="doc-footer"><span>LOGIXZAZU · ${title}</span><span>${now}</span></div>`;

    const dateRange = dateRangeLabel;

    // -- Contenido espec-fico por reporte --
    let bodyHTML = '';

    // Helper: construye tabla pivote MODELO · TALLA con totales
    const buildPivotTable = (
      rows: { model: string; size: string; qty: number }[],
      rowLabel = 'MODELO'
    ) => {
      const allSizes = [...new Set(rows.map(r => r.size))].sort();
      const models = [...new Set(rows.map(r => r.model))].sort();
      const pivot: Record<string, Record<string, number>> = {};
      rows.forEach(({ model, size, qty }) => {
        if (!pivot[model]) pivot[model] = {};
        pivot[model][size] = (pivot[model][size] || 0) + qty;
      });
      const colTotals: Record<string, number> = {};
      allSizes.forEach(s => { colTotals[s] = models.reduce((acc, m) => acc + (pivot[m]?.[s] || 0), 0); });
      const grandTotal = Object.values(colTotals).reduce((a, b) => a + b, 0);

      const thCols = allSizes.map(s => `<th>${s}</th>`).join('');
      const tbodyRows = models.map(m => {
        const rowTotal = allSizes.reduce((a, s) => a + (pivot[m]?.[s] || 0), 0);
        const tds = allSizes.map(s => `<td>${pivot[m]?.[s] || 0}</td>`).join('');
        return `<tr><td class="col-model">${m}</td>${tds}<td class="col-total">${rowTotal}</td></tr>`;
      }).join('');
      const tfootTds = allSizes.map(s => `<td><strong>${colTotals[s]}</strong></td>`).join('');

      return `
        <table>
          <thead>
            <tr>
              <th class="col-model">${rowLabel}</th>
              ${thCols}
              <th>TOTAL</th>
            </tr>
          </thead>
          <tbody>${tbodyRows}</tbody>
          <tfoot>
            <tr>
              <td class="col-model"><strong>Total general</strong></td>
              ${tfootTds}
              <td><strong>${grandTotal}</strong></td>
            </tr>
          </tfoot>
        </table>
        <table style="width:auto;margin-top:10px;">
          <tbody>
            <tr>
              <td class="col-model" style="background:#e0e0e0;font-weight:900;padding:7px 14px;">TOTAL</td>
              <td style="background:#e0e0e0;font-weight:900;padding:7px 20px;">${grandTotal}</td>
            </tr>
          </tbody>
        </table>`;
    };

    if (activeReport === 'inventory') {
      // Tabla pivote: modelo · talla, cantidad en stock
      const pivotRows = inventoryRows.map(r => ({
        model: r.name,
        size: r.size?.trim() || 'S/T',
        qty: r.qty,
      }));
      const summaryCards = `
        <div class="summary" style="grid-template-columns:repeat(2,1fr);margin-bottom:18px;">
          <div class="card"><div class="label">SKUs con stock</div><div class="value">${inventoryRows.length}</div><div class="hint">productos activos</div></div>
          <div class="card purple"><div class="label">Unidades totales</div><div class="value">${valuationTotal.units.toLocaleString('es-PE')}</div><div class="hint">en almacen</div></div>
        </div>`;

      // Agrupar por nombre de producto → variantes
      const grouped: Record<string, typeof inventoryRows> = {};
      inventoryRows.forEach(r => {
        if (!grouped[r.name]) grouped[r.name] = [];
        grouped[r.name].push(r);
      });

      const buildProductTable = (name: string, variants: typeof inventoryRows) => {
        const totalQty = variants.reduce((s, v) => s + v.qty, 0);
        const code = variants[0]?.code || '';
        const hasColor = variants.some(v => v.color);
        const hasSize  = variants.some(v => v.size);

        const headerCols = [
          hasColor ? '<th style="text-align:left;padding:4px 8px;font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;background:#111;color:#fff;border:1px solid #333;">Color</th>' : '',
          hasSize  ? '<th style="text-align:left;padding:4px 8px;font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;background:#111;color:#fff;border:1px solid #333;">Talla</th>' : '',
          '<th style="text-align:center;padding:4px 8px;font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;background:#111;color:#fff;border:1px solid #333;">Cant.</th>',
        ].join('');

        const bodyRows = variants
          .sort((a, b) => (a.color || '').localeCompare(b.color || '') || (a.size || '').localeCompare(b.size || ''))
          .map((v, i) => {
            const bg = i % 2 === 0 ? '#fff' : '#f7f7f7';
            return `<tr style="background:${bg};">
              ${hasColor ? `<td style="padding:4px 8px;border:1px solid #e8e8e8;font-size:8.5px;color:#333;">${v.color || '—'}</td>` : ''}
              ${hasSize  ? `<td style="padding:4px 8px;border:1px solid #e8e8e8;font-size:8.5px;color:#333;">${v.size  || '—'}</td>` : ''}
              <td style="padding:4px 8px;border:1px solid #e8e8e8;font-size:8.5px;font-weight:700;text-align:center;color:#111;">${v.qty}</td>
            </tr>`;
          }).join('');

        const colspan = (hasColor ? 1 : 0) + (hasSize ? 1 : 0) + 1;
        const totalRow = `<tr>
          <td colspan="${colspan}" style="padding:4px 8px;border:1px solid #ccc;background:#f0f0f0;font-size:8px;font-weight:900;text-transform:uppercase;text-align:right;color:#111;">
            TOTAL: <strong>${totalQty}</strong>
          </td>
        </tr>`;

        return `<table style="width:100%;border-collapse:collapse;margin-bottom:12px;">
          <thead>
            <tr>
              <td colspan="${colspan}" style="padding:5px 8px;background:#6B21A8;color:#fff;">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                  <span style="font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:.04em;">${name}</span>
                  <span style="font-size:7px;opacity:.8;">${code} · ${variants.length} SKU${variants.length !== 1 ? 's' : ''}</span>
                </div>
              </td>
            </tr>
            <tr>${headerCols}</tr>
          </thead>
          <tbody>${bodyRows}</tbody>
          <tfoot>${totalRow}</tfoot>
        </table>`;
      };

      // Distribuir productos en 3 columnas manualmente para evitar cortes con html2canvas
      const entries = Object.entries(grouped);
      const col0: string[] = [];
      const col1: string[] = [];
      const col2: string[] = [];
      entries.forEach(([name, variants], i) => {
        const table = buildProductTable(name, variants);
        if (i % 3 === 0) col0.push(table);
        else if (i % 3 === 1) col1.push(table);
        else col2.push(table);
      });

      const colStyle = 'style="flex:1;min-width:0;"';
      const variantSection = `
        <div style="page-break-before:always;padding-top:4px;">
          <div style="display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #111;padding-bottom:10px;margin-bottom:18px;">
            <div>
              <div style="font-size:14px;font-weight:900;text-transform:uppercase;letter-spacing:.06em;color:#111;">Detalle por Producto y Variantes</div>
              <div style="font-size:8.5px;color:#888;margin-top:4px;letter-spacing:.05em;">${Object.keys(grouped).length} PRODUCTOS · ${inventoryRows.length} SKUs CON STOCK</div>
            </div>
            <div style="font-size:8px;color:#aaa;text-align:right;line-height:1.6;">${brand} · ${now}</div>
          </div>
          <div style="display:flex;gap:16px;align-items:flex-start;">
            <div ${colStyle}>${col0.join('')}</div>
            <div ${colStyle}>${col1.join('')}</div>
            <div ${colStyle}>${col2.join('')}</div>
          </div>
        </div>`;

      bodyHTML = summaryCards + buildPivotTable(pivotRows, 'MODELO') + variantSection;
    }

    else if (activeReport === 'movements') {
      const totalUnits = movementsBySupplier.reduce((s, m) => s + m.total, 0);
      const summaryCards = `
        <div class="summary" style="grid-template-columns:repeat(3,1fr);margin-bottom:18px;">
          <div class="card purple"><div class="label">Proveedores</div><div class="value">${movementsBySupplier.length}</div><div class="hint">con recepciones</div></div>
          <div class="card dark"><div class="label">Total unidades</div><div class="value">${totalUnits.toLocaleString('es-PE')}</div><div class="hint">recepcionadas</div></div>
          <div class="card"><div class="label">Transacciones</div><div class="value">${movementsBySupplier.reduce((s, m) => s + m.txs.length, 0)}</div><div class="hint">en el per-odo</div></div>
        </div>`;
      const tablesHTML = movementsBySupplier.map(({ supplier, txs, total }) => {
        const pivotRows = txs.map(tx => {
          const prod = products.find(p => p.id === tx.productId);
          return { model: prod?.name || tx.productId, size: prod?.size?.trim() || 'S/T', qty: tx.quantity };
        });
        return `
          <div style="margin-bottom:24px;">
            <div style="background:#6B21A8;color:white;padding:8px 12px;font-weight:700;font-size:11px;display:flex;justify-content:space-between;">
              <span>${supplier.name}</span><span>${total} uds · ${txs.length} recepciones</span>
            </div>
            ${buildPivotTable(pivotRows, 'MODELO')}
          </div>`;
      }).join('') || '<p style="text-align:center;padding:32px;opacity:.5;">Sin recepciones en el per-odo</p>';
      bodyHTML = summaryCards + tablesHTML;
    }

    else if (activeReport === 'valuation') {
      bodyHTML = `
        <div class="summary" style="grid-template-columns:repeat(2,1fr)">
          <div class="card"><div class="label">SKUs activos</div><div class="value">${inventoryRows.length}</div><div class="hint">con stock</div></div>
          <div class="card purple"><div class="label">Unidades</div><div class="value">${valuationTotal.units.toLocaleString('es-PE')}</div><div class="hint">en almacen</div></div>
        </div>`;
    }

    else if (activeReport === 'adjustments') {
      const pos = filteredAdj.filter(a => a.newQuantity > a.previousQuantity).length;
      const neg = filteredAdj.filter(a => a.newQuantity < a.previousQuantity).length;
      const summaryCards = `
        <div class="summary" style="grid-template-columns:repeat(3,1fr);margin-bottom:18px;">
          <div class="card purple"><div class="label">Total ajustes</div><div class="value">${filteredAdj.length}</div><div class="hint">en el per-odo</div></div>
          <div class="card"><div class="label">Incrementos</div><div class="value" style="color:#16a34a">+${pos}</div><div class="hint">stock sumado</div></div>
          <div class="card"><div class="label">Decrementos</div><div class="value" style="color:#dc2626">${neg}</div><div class="hint">stock reducido</div></div>
        </div>`;
      const bodyRows = filteredAdj.map(a => {
        const prod = products.find(p => p.id === a.productId);
        const loc = locations.find(l => l.id === a.locationId);
        const diff = a.newQuantity - a.previousQuantity;
        return `<tr>
          <td>${format(new Date(a.date), 'dd/MM/yy HH:mm')}</td>
          <td><strong>${prod?.code||''}</strong> ${prod?.name||a.productId}</td>
          <td style="opacity:.7">${loc?.name||'-'}</td>
          <td class="c">${a.previousQuantity}</td>
          <td class="c" style="font-weight:700">${a.newQuantity}</td>
          <td class="c" style="font-weight:700;color:${diff>0?'#16a34a':diff<0?'#dc2626':'#888'}">${diff>0?'+':''}${diff}</td>
          <td style="opacity:.7">${a.reason}</td>
          <td style="opacity:.7">${a.user}</td>
        </tr>`;
      }).join('');
      bodyHTML = summaryCards + `
        <table class="std-table">
          <thead><tr><th>Fecha</th><th>Producto</th><th>Ubicacion</th><th class="c">Antes</th><th class="c">Despu-s</th><th class="c">Diff</th><th>Motivo</th><th>Usuario</th></tr></thead>
          <tbody>${bodyRows||'<tr><td colspan="8" style="text-align:center;padding:24px;opacity:.5;">Sin ajustes en el per-odo</td></tr>'}</tbody>
        </table>`;
    }

    else if (activeReport === 'abc') {
      const aItems = abcData.filter(r => r.cls === 'A');
      const bItems = abcData.filter(r => r.cls === 'B');
      const cItems = abcData.filter(r => r.cls === 'C');
      const summaryCards = `
        <div class="summary" style="grid-template-columns:repeat(3,1fr);margin-bottom:18px;">
          <div class="card" style="border-color:#15803d;background:#f0fdf4"><div class="label" style="color:#15803d">Clase A · Alta rotacion</div><div class="value" style="color:#15803d">${aItems.length} SKUs</div><div class="hint">${aItems.reduce((s,r)=>s+r.pct,0).toFixed(1)}% del volumen</div></div>
          <div class="card" style="border-color:#b45309;background:#fffbeb"><div class="label" style="color:#b45309">Clase B · Media</div><div class="value" style="color:#b45309">${bItems.length} SKUs</div><div class="hint">${bItems.reduce((s,r)=>s+r.pct,0).toFixed(1)}% del volumen</div></div>
          <div class="card dark"><div class="label">Clase C · Baja</div><div class="value">${cItems.length} SKUs</div><div class="hint">${cItems.reduce((s,r)=>s+r.pct,0).toFixed(1)}% del volumen</div></div>
        </div>`;
      const clsStyle: Record<string,string> = { A:'color:#15803d', B:'color:#b45309', C:'opacity:.5' };
      const bodyRows = abcData.map(r => `
        <tr>
          <td style="font-size:15px;font-weight:900;${clsStyle[r.cls]}">${r.cls}</td>
          <td><strong>${r.prod.code}</strong> <span style="opacity:.6">${r.prod.name} ${[r.prod.size].filter(Boolean).join(' ')}</span></td>
          <td class="r" style="font-weight:700">${r.dispatched}</td>
          <td class="r">${r.pct.toFixed(1)}%</td>
        </tr>`).join('');
      bodyHTML = summaryCards + `
        <table class="std-table">
          <thead><tr><th>Clase</th><th>Producto</th><th class="r">Despachos</th><th class="r">% Volumen</th></tr></thead>
          <tbody>${bodyRows||'<tr><td colspan="4" style="text-align:center;padding:24px;opacity:.5;">Sin despachos</td></tr>'}</tbody>
        </table>`;
    }

    else if (activeReport === 'aging') {
      const critical = agingData.filter(r => r.daysSince !== null && r.daysSince >= 90).length;
      const summaryCards = `
        <div class="summary" style="grid-template-columns:repeat(3,1fr);margin-bottom:18px;">
          <div class="card purple"><div class="label">Productos estancados</div><div class="value">${agingData.length}</div><div class="hint">=${agingDays} dias sin movimiento</div></div>
          <div class="card" style="${critical>0?'border-color:#dc2626;background:#fef2f2':''}"><div class="label">Cr-ticos =90d</div><div class="value" style="color:${critical>0?'#dc2626':'#111'}">${critical}</div><div class="hint">alta prioridad</div></div>
          <div class="card"><div class="label">Unidades paradas</div><div class="value">${agingData.reduce((s,r)=>s+r.stock,0).toLocaleString('es-PE')}</div><div class="hint">en stock sin salida</div></div>
        </div>`;
      const bodyRows = agingData.map(r => {
        const daysColor = r.daysSince!==null&&r.daysSince>=90?'#dc2626':r.daysSince!==null&&r.daysSince>=30?'#b45309':'#111';
        return `<tr>
          <td><strong>${r.prod.code}</strong> <span style="opacity:.6">${r.prod.name} ${[r.prod.size].filter(Boolean).join(' ')}</span></td>
          <td class="c" style="font-weight:700">${r.stock}</td>
          <td class="c" style="opacity:.7">${r.lastDispatch?format(new Date(r.lastDispatch),'dd/MM/yyyy'):'-'}</td>
          <td class="c" style="font-weight:700;color:${daysColor}">${r.daysSince!==null?r.daysSince:'Sin despachos'}</td>
        </tr>`;
      }).join('');
      bodyHTML = summaryCards + `
        <table class="std-table">
          <thead><tr><th>Producto</th><th class="c">Stock</th><th class="c">ultimo despacho</th><th class="c">D-as sin movimiento</th></tr></thead>
          <tbody>${bodyRows||'<tr><td colspan="4" style="text-align:center;padding:24px;opacity:.5;">Sin productos estancados</td></tr>'}</tbody>
        </table>`;
    }

    const html = `<!DOCTYPE html><html lang="es"><head>
<meta charset="UTF-8">
<title>${title} · LogixZazu</title>
<style>${sharedCSS}</style>
</head><body>
${headerHTML}
${bodyHTML}
${footerHTML}
</body></html>`;

    const filename = `${activeReport}_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`;
    const container = document.createElement('div');
    container.innerHTML = html;
    document.body.appendChild(container);
    const target = (container.querySelector('body') || container) as HTMLElement;
    html2canvas(target, { scale: 2, useCORS: true, logging: false }).then(canvas => {
      const imgData = canvas.toDataURL('image/jpeg', 0.98);
      const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 12;
      const usableW = pageW - margin * 2;
      const imgH = (canvas.height * usableW) / canvas.width;
      let y = 0;
      while (y < imgH) {
        if (y > 0) pdf.addPage();
        pdf.addImage(imgData, 'JPEG', margin, margin - y, usableW, imgH);
        y += pageH - margin * 2;
      }
      pdf.save(filename);
    }).finally(() => document.body.removeChild(container));
  };

  // --- Datos Kanban por reporte ----------------------------------------------

  type KanbanCol = {
    key: string;
    label: string;
    sublabel: string;
    headerBg: string;   // tailwind bg
    headerText: string; // tailwind text
    accentCss: string;  // inline css color for bar/badge
    items: { id: string; code: string; name: string; sub: string; badge: string; detail: string; barPct?: number }[];
  };

  const kanbanCols = useMemo((): KanbanCol[] => {
    if (activeReport === 'abc') {
      const defs = [
        { key: 'A', label: 'Clase A', sublabel: 'Alta rotacion', headerBg: 'bg-[#14532d]', headerText: 'text-[#f0fdf4]', accentCss: '#16a34a' },
        { key: 'B', label: 'Clase B', sublabel: 'Rotacion media', headerBg: 'bg-[#78350f]', headerText: 'text-[#fffbeb]', accentCss: '#d97706' },
        { key: 'C', label: 'Clase C', sublabel: 'Baja rotacion', headerBg: 'bg-[var(--ink)]', headerText: 'text-[var(--ink-inv)]', accentCss: '#9f9d99' },
      ];
      return defs.map(d => {
        const rows = abcData.filter(r => r.cls === d.key);
        const volPct = rows.reduce((s, r) => s + r.pct, 0);
        return {
          ...d,
          sublabel: `${d.sublabel} · ${rows.length} SKUs · ${volPct.toFixed(1)}% vol`,
          items: rows.map(r => ({
            id: r.prod.id,
            code: r.prod.code,
            name: r.prod.name,
            sub: [r.prod.color, r.prod.size].filter(Boolean).join(' · '),
            badge: `${r.dispatched} uds`,
            detail: `${r.pct.toFixed(1)}% del volumen`,
            barPct: Math.min(r.pct * 5, 100),
          })),
        };
      });
    }

    if (activeReport === 'inventory') {
      const cats = [...new Set(inventoryRows.map(r => r.category))].sort() as string[];
      return cats.map((cat, i) => {
        const rows = inventoryRows.filter(r => r.category === cat);
        const totalQty = rows.reduce((s, r) => s + r.qty, 0);
        const totalSell = rows.reduce((s, r) => s + r.totalSell, 0);
        const hues = ['bg-[var(--ink)]', 'bg-[#1e3a5f]', 'bg-[#2d1b69]', 'bg-[#1a3a2a]', 'bg-[#4a1942]', 'bg-[#3d2b00]'];
        return {
          key: cat,
          label: cat || 'Sin categoria',
          sublabel: `${rows.length} SKUs · ${totalQty} uds · S/ ${totalSell.toFixed(0)}`,
          headerBg: hues[i % hues.length],
          headerText: 'text-[var(--ink-inv)]',
          accentCss: '#9f9d99',
          items: rows.map(r => ({
            id: r.id,
            code: r.code,
            name: r.name,
            sub: [r.color, r.size].filter(Boolean).join(' · '),
            badge: `${r.qty} uds`,
            detail: `S/ ${r.totalSell.toFixed(2)}`,
            barPct: totalQty > 0 ? Math.min((r.qty / totalQty) * 100, 100) : 0,
          })),
        };
      });
    }

    if (activeReport === 'aging') {
      const defs = [
        { key: 'critical', label: '=90 dias', sublabel: 'Cr-tico · accion inmediata', headerBg: 'bg-[#7f1d1d]', headerText: 'text-[#fef2f2]', accentCss: '#dc2626',
          filter: (r: typeof agingData[0]) => r.daysSince !== null && r.daysSince >= 90 },
        { key: 'warning', label: '30-89 dias', sublabel: 'Alerta · revisar pronto', headerBg: 'bg-[#78350f]', headerText: 'text-[#fffbeb]', accentCss: '#d97706',
          filter: (r: typeof agingData[0]) => r.daysSince !== null && r.daysSince >= 30 && r.daysSince < 90 },
        { key: 'low', label: '<30 dias', sublabel: 'Estancado · monitorear', headerBg: 'bg-[#374151]', headerText: 'text-[#f9fafb]', accentCss: '#6b7280',
          filter: (r: typeof agingData[0]) => r.daysSince !== null && r.daysSince < 30 },
        { key: 'never', label: 'Sin despachos', sublabel: 'Nunca despachado', headerBg: 'bg-[var(--ink)]', headerText: 'text-[var(--ink-inv)]', accentCss: '#9f9d99',
          filter: (r: typeof agingData[0]) => r.daysSince === null },
      ];
      return defs.map(d => {
        const rows = agingData.filter(d.filter);
        const totalStock = rows.reduce((s, r) => s + r.stock, 0);
        return {
          key: d.key,
          label: d.label,
          sublabel: `${d.sublabel} · ${rows.length} prods · ${totalStock} uds`,
          headerBg: d.headerBg,
          headerText: d.headerText,
          accentCss: d.accentCss,
          items: rows.map(r => ({
            id: r.prod.id,
            code: r.prod.code,
            name: r.prod.name,
            sub: [r.prod.color, r.prod.size].filter(Boolean).join(' · '),
            badge: r.daysSince !== null ? `${r.daysSince}d` : '-',
            detail: `Stock: ${r.stock} uds`,
          })),
        };
      }).filter(c => c.items.length > 0);
    }

    if (activeReport === 'adjustments') {
      const defs = [
        { key: 'up', label: 'Incrementos', sublabel: 'Stock aumentado', headerBg: 'bg-[#14532d]', headerText: 'text-[#f0fdf4]', accentCss: '#16a34a',
          filter: (a: typeof filteredAdj[0]) => a.newQuantity > a.previousQuantity },
        { key: 'down', label: 'Decrementos', sublabel: 'Stock reducido', headerBg: 'bg-[#7f1d1d]', headerText: 'text-[#fef2f2]', accentCss: '#dc2626',
          filter: (a: typeof filteredAdj[0]) => a.newQuantity < a.previousQuantity },
        { key: 'zero', label: 'Sin cambio', sublabel: 'Misma cantidad', headerBg: 'bg-[var(--ink)]', headerText: 'text-[var(--ink-inv)]', accentCss: '#9f9d99',
          filter: (a: typeof filteredAdj[0]) => a.newQuantity === a.previousQuantity },
      ];
      return defs.map(d => {
        const rows = filteredAdj.filter(d.filter);
        return {
          key: d.key,
          label: d.label,
          sublabel: `${d.sublabel} · ${rows.length} ajustes`,
          headerBg: d.headerBg,
          headerText: d.headerText,
          accentCss: d.accentCss,
          items: rows.map(a => {
            const prod = products.find(p => p.id === a.productId);
            const diff = a.newQuantity - a.previousQuantity;
            return {
              id: a.id,
              code: prod?.code || a.productId,
              name: prod?.name || a.productId,
              sub: format(new Date(a.date), 'dd/MM/yy'),
              badge: `${diff > 0 ? '+' : ''}${diff}`,
              detail: a.reason,
            };
          }),
        };
      }).filter(c => c.items.length > 0);
    }

    if (activeReport === 'movements') {
      return movementsBySupplier.map((m, i) => {
        const hues = ['bg-[var(--ink)]', 'bg-[#1e3a5f]', 'bg-[#2d1b69]', 'bg-[#1a3a2a]', 'bg-[#4a1942]'];
        return {
          key: m.supplier.id,
          label: m.supplier.name,
          sublabel: `${m.total} uds · ${m.txs.length} recepciones`,
          headerBg: hues[i % hues.length],
          headerText: 'text-[var(--ink-inv)]',
          accentCss: '#9f9d99',
          items: m.txs.map(tx => {
            const prod = products.find(p => p.id === tx.productId);
            return {
              id: tx.id,
              code: prod?.code || tx.productId,
              name: prod?.name || tx.productId,
              sub: [prod?.color, prod?.size].filter(Boolean).join(' · '),
              badge: `${tx.quantity} uds`,
              detail: format(new Date(tx.date), 'dd/MM/yyyy'),
            };
          }),
        };
      });
    }

    return [];
  }, [activeReport, abcData, inventoryRows, agingData, filteredAdj, movementsBySupplier, products]);

  // --- Vista Kanban ----------------------------------------------------------

  const renderKanban = () => {
    if (activeReport === 'valuation') return null;
    if (kanbanCols.length === 0)
      return <div className="text-center font-mono text-xs opacity-40 py-16 uppercase tracking-widest">Sin datos para mostrar</div>;

    const colCount = Math.min(kanbanCols.length, 4);

    return (
      <div className="flex gap-3 overflow-x-auto pb-2" style={{ alignItems: 'flex-start' }}>
        {kanbanCols.map(col => (
          <div
            key={col.key}
            className="flex flex-col border border-[var(--border)] shrink-0"
            style={{ width: `calc((100% - ${(colCount - 1) * 12}px) / ${colCount})`, minWidth: 200 }}
          >
            {/* Cabecera de columna */}
            <div className={`${col.headerBg} ${col.headerText} px-3 pt-3 pb-2.5`}>
              <div className="font-mono font-black text-sm uppercase tracking-wide leading-none">{col.label}</div>
              <div className="font-mono text-[8.5px] opacity-70 mt-1.5 leading-tight">{col.sublabel}</div>
              {/* Barra de conteo */}
              <div className="mt-2 h-0.5 bg-[var(--surface-alt)]">
                <div className="h-full bg-[var(--surface)]" style={{ width: `${Math.min((col.items.length / Math.max(...kanbanCols.map(c => c.items.length), 1)) * 100, 100)}%` }} />
              </div>
            </div>

            {/* Tarjetas */}
            <div className="flex flex-col gap-0 divide-y divide-[#141414]/10 overflow-y-auto" style={{ maxHeight: 420 }}>
              {col.items.length === 0
                ? <div className="py-6 text-center font-mono text-[9px] opacity-30 uppercase">Sin items</div>
                : col.items.map(item => (
                  <div key={item.id} className="px-3 py-2.5 hover:bg-[var(--surface)] transition-colors bg-[var(--surface-alt)] group">
                    <div className="flex items-start justify-between gap-1.5">
                      <span className="font-mono font-bold text-[10px] leading-tight">{item.code}</span>
                      <span
                        className="font-mono font-black text-[9px] px-1.5 py-0.5 shrink-0 leading-none"
                        style={{ background: col.accentCss + '22', color: col.accentCss, border: `1px solid ${col.accentCss}55` }}
                      >
                        {item.badge}
                      </span>
                    </div>
                    <div className="font-mono text-[9px] opacity-75 mt-0.5 leading-snug line-clamp-1">{item.name}</div>
                    {item.sub && <div className="font-mono text-[8px] opacity-45 mt-0.5">{item.sub}</div>}
                    <div className="font-mono text-[8px] opacity-55 mt-1">{item.detail}</div>
                    {item.barPct !== undefined && (
                      <div className="mt-1.5 h-0.5 bg-[var(--ink)]/10">
                        <div className="h-full" style={{ width: `${item.barPct}%`, background: col.accentCss }} />
                      </div>
                    )}
                  </div>
                ))}
            </div>

            {/* Pie de columna con total */}
            <div className="px-3 py-1.5 border-t border-[var(--border)]/20 bg-[var(--ink)]/5">
              <span className="font-mono text-[8.5px] opacity-50 uppercase tracking-widest">{col.items.length} {col.items.length === 1 ? 'item' : 'items'}</span>
            </div>
          </div>
        ))}
      </div>
    );
  };

  // --- Kanban en PDF ---------------------------------------------------------

  const buildKanbanHTML = () => {
    if (kanbanCols.length === 0) return '';
    const colPct = Math.floor(100 / Math.min(kanbanCols.length, 4));
    const accentMap: Record<string, string> = {
      '#16a34a': '#16a34a', '#d97706': '#d97706', '#dc2626': '#dc2626',
      '#6b7280': '#6b7280', '#9f9d99': '#888',
    };
    const colsHTML = kanbanCols.map(col => {
      const accent = accentMap[col.accentCss] || col.accentCss;
      const cardsHTML = col.items.slice(0, 30).map(item => `
        <div style="padding:6px 8px;border-bottom:1px solid #e5e7eb;break-inside:avoid;">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:4px;">
            <span style="font-weight:700;font-size:9px;">${item.code}</span>
            <span style="font-size:8px;font-weight:700;padding:1px 5px;border:1px solid ${accent}55;color:${accent};background:${accent}18;white-space:nowrap;">${item.badge}</span>
          </div>
          <div style="font-size:8px;opacity:.75;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${item.name}</div>
          ${item.sub ? `<div style="font-size:7px;opacity:.45;margin-top:1px;">${item.sub}</div>` : ''}
          <div style="font-size:7px;opacity:.55;margin-top:2px;">${item.detail}</div>
          ${item.barPct !== undefined ? `<div style="margin-top:4px;height:2px;background:#f0f0f0;"><div style="height:100%;width:${item.barPct}%;background:${accent};"></div></div>` : ''}
        </div>`).join('');
      const moreItems = col.items.length > 30 ? `<div style="padding:6px 8px;font-size:8px;opacity:.5;text-align:center;">+${col.items.length - 30} mas-</div>` : '';
      return `
        <div style="width:${colPct}%;box-sizing:border-box;border:1.5px solid #141414;display:inline-block;vertical-align:top;margin-right:${kanbanCols.length > 1 ? '8px' : '0'};break-inside:avoid;">
          <div style="background:#141414;color:#E4E3E0;padding:10px 10px 8px;">
            <div style="font-weight:900;font-size:11px;letter-spacing:.08em;text-transform:uppercase;">${col.label}</div>
            <div style="font-size:7px;opacity:.65;margin-top:3px;letter-spacing:.05em;">${col.sublabel}</div>
          </div>
          ${cardsHTML}${moreItems}
          <div style="padding:5px 8px;border-top:1px solid #e5e7eb;font-size:7px;opacity:.4;letter-spacing:.08em;text-transform:uppercase;">${col.items.length} items</div>
        </div>`;
    }).join('');
    return `
      <div class="section-header" style="margin-bottom:10px;">
        <span>Vista Kanban · Segmentacion por grupos</span>
        <span>${kanbanCols.length} columnas</span>
      </div>
      <div style="display:flex;gap:8px;align-items:flex-start;width:100%;">
        ${colsHTML}
      </div>`;
  };

  // --- Render ----------------------------------------------------------------

  return (
    <div className="flex flex-col gap-6 h-full">
      <ModuleInfo number="10" title="Reportes" description="Generacion y exportacion de reportes operativos: inventario actual, movimientos por per-odo, valorizacion de stock y alertas de stock bajo m-nimo." />

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 border-b border-[var(--border)] pb-3">
        <div>
          <h2 className="font-serif italic font-bold text-xs uppercase tracking-widest text-[var(--ink)]">11 // REPORTES</h2>
          <p className="font-mono text-[10px] opacity-70 uppercase tracking-wide mt-1">Exportacion y visualizacion de datos.</p>
        </div>
        <div className="flex items-center gap-2">
          {activeReport !== 'valuation' && (
            <div className="flex border border-[var(--border)]">
              <button
                onClick={() => setViewMode('list')}
                title="Vista lista"
                className={`flex items-center gap-1.5 px-3 py-2 font-mono text-[9px] uppercase tracking-widest transition-colors ${viewMode === 'list' ? 'bg-[var(--ink)] text-[var(--ink-inv)]' : 'hover:bg-[var(--surface)]'}`}
              >
                <List size={12} /> Lista
              </button>
              <button
                onClick={() => setViewMode('kanban')}
                title="Vista kanban"
                className={`flex items-center gap-1.5 px-3 py-2 font-mono text-[9px] uppercase tracking-widest border-l border-[var(--border)] transition-colors ${viewMode === 'kanban' ? 'bg-[var(--ink)] text-[var(--ink-inv)]' : 'hover:bg-[var(--surface)]'}`}
              >
                <LayoutGrid size={12} /> Kanban
              </button>
            </div>
          )}
          <ExportMenu onPDF={handlePDF} onExcel={exportExcel} onCSV={exportCSV} />
        </div>
      </div>

      {/* Selector de reporte */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {([
          { id: 'inventory', label: 'Inventario Valorizado', icon: Package },
          { id: 'movements', label: 'Movimientos Proveedor', icon: ArrowLeftRight },
          { id: 'valuation', label: 'Valorizacion', icon: BarChart2 },
          { id: 'adjustments', label: 'Ajustes de Stock', icon: Users },
          { id: 'abc', label: 'An-lisis ABC', icon: Star },
          { id: 'aging', label: 'Antig-edad Stock', icon: Clock },
        ] as const).map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setActiveReport(id)}
            className={`flex items-center gap-2 p-3 border text-left transition-all ${activeReport === id ? 'bg-[var(--ink)] text-[var(--ink-inv)] border-[var(--border)] shadow-[2px_2px_0_var(--border)]' : 'border-[var(--border)] bg-[var(--surface-alt)] hover:bg-[var(--surface)]'}`}>
            <Icon size={16} className="shrink-0" />
            <span className="font-mono text-[10px] font-bold uppercase leading-tight">{label}</span>
          </button>
        ))}
      </div>

      {/* Filtro de fechas */}
      {(activeReport === 'movements' || activeReport === 'adjustments') && (
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex flex-col gap-1">
            <label className="font-mono text-[9px] font-bold uppercase tracking-widest opacity-60">Desde</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-mono focus:outline-none" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="font-mono text-[9px] font-bold uppercase tracking-widest opacity-60">Hasta</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-mono focus:outline-none" />
          </div>
          {(dateFrom || dateTo) && (
            <button onClick={() => { setDateFrom(''); setDateTo(''); }}
              className="font-mono text-[10px] opacity-60 hover:opacity-100 mt-4">? Limpiar</button>
          )}
        </div>
      )}

      {/* Contenido del reporte */}
      {viewMode === 'kanban' && activeReport !== 'valuation' ? (
        <div className="pb-4">{renderKanban()}</div>
      ) : null}
      <div ref={printRef} className={`overflow-x-auto${viewMode === 'kanban' && activeReport !== 'valuation' ? ' hidden' : ''}`}>
        {activeReport === 'inventory' && (() => {
          const totalUnits = inventoryRows.reduce((s, r) => s + r.qty, 0);
          return (
            <table className="w-full text-[10px] font-mono border-collapse">
              <thead>
                <tr className="border-b-2 border-[var(--border)]">
                  <th className="text-left py-2 pr-3 font-bold uppercase">Codigo</th>
                  <th className="text-left py-2 pr-3 font-bold uppercase">Nombre</th>
                  <th className="text-left py-2 pr-3 font-bold uppercase">Color</th>
                  <th className="text-left py-2 pr-3 font-bold uppercase">Talla</th>
                  <th className="text-right py-2 px-3 font-bold uppercase">Stock</th>
                  <th className="text-right py-2 pl-3 font-bold uppercase">% Entrada</th>
                </tr>
              </thead>
              <tbody>
                {inventoryRows.map(r => {
                  const pct = totalUnits > 0 ? (r.qty / totalUnits) * 100 : 0;
                  return (
                    <tr key={r.id} className="border-b border-[var(--border)]/20 hover:bg-[var(--bg-card)]">
                      <td className="py-1.5 pr-3">{r.code}</td>
                      <td className="py-1.5 pr-3">{r.name}</td>
                      <td className="py-1.5 pr-3 opacity-70">{r.color}</td>
                      <td className="py-1.5 pr-3 opacity-70">{r.size}</td>
                      <td className="text-right py-1.5 px-3 font-bold">{r.qty}</td>
                      <td className="text-right py-1.5 pl-3 opacity-70">{pct.toFixed(1)}%</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-[var(--border)]">
                  <td colSpan={4} className="py-2 pr-3 font-bold uppercase">TOTAL ({inventoryRows.length} SKUs)</td>
                  <td className="text-right py-2 px-3 font-black">{valuationTotal.units}</td>
                  <td className="text-right py-2 pl-3 font-black">100%</td>
                </tr>
              </tfoot>
            </table>
          );
        })()}

        {activeReport === 'movements' && (
          <div className="flex flex-col gap-6">
            {movementsBySupplier.length === 0
              ? <div className="text-center font-mono text-xs opacity-50 py-12 uppercase tracking-widest">Sin recepciones en el per-odo</div>
              : movementsBySupplier.map(({ supplier, txs, total }) => (
                <div key={supplier.id} className="border border-[var(--border)]">
                  <div className="bg-[var(--ink)] text-[var(--ink-inv)] px-4 py-2 flex justify-between">
                    <span className="font-mono font-bold text-xs uppercase">{supplier.name}</span>
                    <span className="font-mono text-xs">{total} unidades · {txs.length} recepciones</span>
                  </div>
                  <table className="w-full text-[10px] font-mono border-collapse">
                    <thead><tr className="border-b border-[var(--border)]">
                      <th className="text-left py-1.5 px-3 font-bold uppercase">Fecha</th>
                      <th className="text-left py-1.5 px-3 font-bold uppercase">Referencia</th>
                      <th className="text-left py-1.5 px-3 font-bold uppercase">Producto</th>
                      <th className="text-right py-1.5 px-3 font-bold uppercase">Qty</th>
                    </tr></thead>
                    <tbody>
                      {txs.map(tx => {
                        const prod = products.find(p => p.id === tx.productId);
                        return (
                          <tr key={tx.id} className="border-b border-[var(--border)]/20 hover:bg-[var(--bg-card)]">
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
              ))}
          </div>
        )}

        {activeReport === 'valuation' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { label: 'Total SKUs con stock', value: inventoryRows.length.toString(), sub: 'productos activos' },
              { label: 'Unidades totales', value: valuationTotal.units.toLocaleString(), sub: 'unidades en almacen' },
            ].map(({ label, value, sub }) => (
              <div key={label} className="border border-[var(--border)] bg-[var(--bg-card)] p-5">
                <div className="font-mono text-[9px] uppercase tracking-widest opacity-60 mb-2">{label}</div>
                <div className="font-mono font-black text-2xl text-[var(--ink)]">{value}</div>
                <div className="font-mono text-[9px] opacity-50 mt-1">{sub}</div>
              </div>
            ))}
          </div>
        )}

        {activeReport === 'adjustments' && (
          <table className="w-full text-[10px] font-mono border-collapse">
            <thead>
              <tr className="border-b-2 border-[var(--border)]">
                <th className="text-left py-2 pr-3 font-bold uppercase">Fecha</th>
                <th className="text-left py-2 pr-3 font-bold uppercase">Producto</th>
                <th className="text-left py-2 pr-3 font-bold uppercase">Ubicacion</th>
                <th className="text-right py-2 px-3 font-bold uppercase">Antes</th>
                <th className="text-right py-2 px-3 font-bold uppercase">Despu-s</th>
                <th className="text-right py-2 px-3 font-bold uppercase">Diff</th>
                <th className="text-left py-2 px-3 font-bold uppercase">Motivo</th>
                <th className="text-left py-2 pl-3 font-bold uppercase">Usuario</th>
              </tr>
            </thead>
            <tbody>
              {filteredAdj.length === 0
                ? <tr><td colSpan={8} className="text-center py-12 opacity-50 uppercase tracking-widest">Sin ajustes en el per-odo</td></tr>
                : filteredAdj.map(a => {
                  const prod = products.find(p => p.id === a.productId);
                  const loc = locations.find(l => l.id === a.locationId);
                  const diff = a.newQuantity - a.previousQuantity;
                  return (
                    <tr key={a.id} className="border-b border-[var(--border)]/20 hover:bg-[var(--bg-card)]">
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

        {activeReport === 'abc' && (
          <div className="flex flex-col gap-4">
            <div className="flex gap-3 flex-wrap text-[10px] font-mono font-bold">
              {(['A','B','C'] as const).map(cls => {
                const items = abcData.filter(r => r.cls === cls);
                const colors = { A: 'bg-green-500/15 border-green-700 text-green-600', B: 'bg-amber-500/15 border-amber-700 text-amber-600', C: 'bg-[var(--surface)] border-[var(--border)]' };
                const pctVol = items.reduce((s, r) => s + r.pct, 0);
                return (
                  <div key={cls} className={`border px-3 py-2 ${colors[cls]}`}>
                    <span className="text-lg font-black">{cls}</span>
                    <span className="ml-2">{items.length} SKUs · {pctVol.toFixed(1)}% del volumen</span>
                  </div>
                );
              })}
            </div>
            <table className="w-full text-[10px] font-mono border-collapse">
              <thead>
                <tr className="border-b-2 border-[var(--border)]">
                  <th className="text-left py-1.5 pr-3 font-bold uppercase">Clase</th>
                  <th className="text-left py-1.5 pr-3 font-bold uppercase">Producto</th>
                  <th className="text-right py-1.5 px-3 font-bold uppercase">Despachos</th>
                  <th className="text-right py-1.5 pl-3 font-bold uppercase">% Volumen</th>
                </tr>
              </thead>
              <tbody>
                {abcData.map((r, i) => {
                  const clsColors = { A: 'text-green-700', B: 'text-amber-700', C: 'opacity-60' };
                  return (
                    <tr key={r.prod.id} className={`border-b border-[var(--border)]/15 ${i % 2 === 0 ? '' : 'bg-[var(--surface-alt)]'}`}>
                      <td className={`py-1.5 pr-3 font-black text-base ${clsColors[r.cls as 'A'|'B'|'C']}`}>{r.cls}</td>
                      <td className="py-1.5 pr-3">
                        <span className="font-bold">{r.prod.code}</span>
                        <span className="opacity-60 ml-2">{r.prod.name} {r.prod.color} {r.prod.size}</span>
                      </td>
                      <td className="text-right py-1.5 px-3 font-bold">{r.dispatched}</td>
                      <td className="text-right py-1.5 pl-3">{r.pct.toFixed(1)}%</td>
                    </tr>
                  );
                })}
                {abcData.length === 0 && <tr><td colSpan={4} className="text-center py-8 opacity-50">Sin despachos registrados</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {activeReport === 'aging' && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="font-mono text-[9px] font-bold uppercase opacity-60">Mostrar stock sin movimiento en mas de</span>
              {[15, 30, 60, 90].map(d => (
                <button key={d} onClick={() => setAgingDays(d)}
                  className={`px-3 py-1 text-[9px] font-bold font-mono uppercase border border-[var(--border)] transition-colors ${agingDays === d ? 'bg-[var(--ink)] text-[var(--ink-inv)]' : 'hover:bg-[var(--surface)]'}`}>
                  {d}D
                </button>
              ))}
            </div>
            <table className="w-full text-[10px] font-mono border-collapse">
              <thead>
                <tr className="border-b-2 border-[var(--border)]">
                  <th className="text-left py-1.5 pr-3 font-bold uppercase">Producto</th>
                  <th className="text-right py-1.5 px-3 font-bold uppercase">Stock</th>
                  <th className="text-right py-1.5 px-3 font-bold uppercase">ultimo despacho</th>
                  <th className="text-right py-1.5 pl-3 font-bold uppercase">D-as sin movimiento</th>
                </tr>
              </thead>
              <tbody>
                {agingData.map((r, i) => (
                  <tr key={r.prod.id} className={`border-b border-[var(--border)]/15 ${i % 2 === 0 ? '' : 'bg-[var(--surface-alt)]'}`}>
                    <td className="py-1.5 pr-3">
                      <span className="font-bold">{r.prod.code}</span>
                      <span className="opacity-60 ml-2">{r.prod.name} {r.prod.color} {r.prod.size}</span>
                    </td>
                    <td className="text-right py-1.5 px-3 font-bold">{r.stock}</td>
                    <td className="text-right py-1.5 px-3 opacity-70">
                      {r.lastDispatch ? format(new Date(r.lastDispatch), 'dd/MM/yyyy') : '-'}
                    </td>
                    <td className={`text-right py-1.5 pl-3 font-bold ${r.daysSince !== null && r.daysSince >= 90 ? 'text-red-600' : r.daysSince !== null && r.daysSince >= 30 ? 'text-amber-700' : ''}`}>
                      {r.daysSince !== null ? r.daysSince : 'Sin despachos'}
                    </td>
                  </tr>
                ))}
                {agingData.length === 0 && <tr><td colSpan={4} className="text-center py-8 opacity-50">No hay productos estancados con ese criterio</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

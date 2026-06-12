import React, { useState, useRef, useMemo } from 'react';
import { useAppContext } from '../store/AppContext';
import { ModuleInfo } from '../components/ModuleInfo';
import { Printer, Download, BarChart2, Package, ArrowLeftRight, Users, Star, Clock, FileSpreadsheet, FileText, ChevronDown, LayoutGrid, List } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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
    const brand = activeBrand.replace(/_/g, ' ');

    const dateRangeLabel = (() => {
      if (dateFrom && dateTo)
        return `Del ${format(new Date(dateFrom), "d 'de' MMMM", { locale: es })} al ${format(new Date(dateTo), "d 'de' MMMM 'del' yyyy", { locale: es })}`;
      if (dateFrom)
        return `Desde el ${format(new Date(dateFrom), "d 'de' MMMM 'del' yyyy", { locale: es })}`;
      if (dateTo)
        return `Hasta el ${format(new Date(dateTo), "d 'de' MMMM 'del' yyyy", { locale: es })}`;
      return '';
    })();

    const logoB64 = await fetch('/Zazu/inv/zazu-inv-light.png')
      .then(r => r.blob())
      .then(b => new Promise<string>(res => { const fr = new FileReader(); fr.onload = () => res(fr.result as string); fr.readAsDataURL(b); }))
      .catch(() => '');

    // A4 VERTICAL (portrait)
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    const filename = `${activeReport}_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`;
    const PW = pdf.internal.pageSize.getWidth();   // 210mm
    const PH = pdf.internal.pageSize.getHeight();  // 297mm
    const ML = 14; const MR = 14; const MT = 10; const MB = 14;
    const usableW = PW - ML - MR;                  // 182mm

    const PURPLE: [number,number,number] = [107, 33, 168];
    const BLACK:  [number,number,number] = [17, 17, 17];
    const GRAY:   [number,number,number] = [230, 230, 230];
    const WHITE:  [number,number,number] = [255, 255, 255];
    const LIGHT:  [number,number,number] = [250, 249, 255];
    const PURPLELIGHT: [number,number,number] = [237, 233, 254];

    const drawHeader = (pageTitle: string): number => {
      let y = MT;

      // Banda superior morada
      pdf.setFillColor(...PURPLE);
      pdf.rect(0, 0, PW, 14, 'F');

      // Logo
      if (logoB64) {
        try { pdf.addImage(logoB64, 'PNG', ML, 1.5, 11, 11); } catch {}
      }

      pdf.setTextColor(...WHITE);
      pdf.setFontSize(9); pdf.setFont('helvetica', 'bold');
      pdf.text('LOGIXZAZU', ML + (logoB64 ? 14 : 0), 7.5);
      pdf.setFontSize(7); pdf.setFont('helvetica', 'normal');
      pdf.text('Tecnologia y Distribucion Logistica del Peru S.A.C.  ·  RUC 20614699842', ML + (logoB64 ? 14 : 0), 11.5);
      pdf.setFontSize(7);
      pdf.text(`${brand}  ·  ${now}`, PW - MR, 9, { align: 'right' });

      y = 20;

      // Título del reporte
      pdf.setTextColor(...BLACK);
      pdf.setFontSize(14); pdf.setFont('helvetica', 'bold');
      pdf.text(pageTitle.toUpperCase(), PW / 2, y, { align: 'center' });
      y += 6;

      if (dateRangeLabel) {
        pdf.setFontSize(8); pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(100, 100, 100);
        pdf.text(dateRangeLabel, PW / 2, y, { align: 'center' });
        y += 5;
      }

      // Línea divisoria
      pdf.setDrawColor(...PURPLE);
      pdf.setLineWidth(0.5);
      pdf.line(ML, y, PW - MR, y);
      pdf.setLineWidth(0.2);

      return y + 5;
    };

    const drawFooter = () => {
      pdf.setFillColor(245, 243, 255);
      pdf.rect(0, PH - 10, PW, 10, 'F');
      pdf.setFontSize(6.5); pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(130, 100, 180);
      pdf.text(`LOGIXZAZU  ·  ${title}  ·  ${brand}`, ML, PH - 4);
      pdf.text(
        `Pagina ${(pdf as any).internal.getCurrentPageInfo().pageNumber}  ·  ${now}`,
        PW - MR, PH - 4, { align: 'right' }
      );
    };

    // ── REPORTE: INVENTARIO ───────────────────────────────────────────────────
    if (activeReport === 'inventory') {
      let y = drawHeader(title);

      // Cards de resumen (2 columnas)
      const cards = [
        { label: 'SKUs con stock', value: String(inventoryRows.length), sub: 'productos activos' },
        { label: 'Unidades totales', value: valuationTotal.units.toLocaleString('es-PE'), sub: 'en almacen' },
      ];
      const cardW = (usableW - 4) / 2;
      cards.forEach((c, i) => {
        const cx = ML + i * (cardW + 4);
        const bg = i === 1 ? PURPLE : PURPLELIGHT;
        const tc = i === 1 ? WHITE : PURPLE;
        pdf.setFillColor(bg[0], bg[1], bg[2]);
        pdf.roundedRect(cx, y, cardW, 16, 2, 2, 'F');
        pdf.setTextColor(tc[0], tc[1], tc[2]);
        pdf.setFontSize(7); pdf.setFont('helvetica', 'normal');
        pdf.text(c.label.toUpperCase(), cx + 4, y + 5);
        pdf.setFontSize(16); pdf.setFont('helvetica', 'bold');
        pdf.text(c.value, cx + 4, y + 12.5);
        pdf.setFontSize(6); pdf.setFont('helvetica', 'normal');
        pdf.text(c.sub.toUpperCase(), cx + 4, y + 15.5);
      });
      y += 22;

      // Tabla pivote MODELO × TALLA
      const allSizes: string[] = Array.from(new Set<string>(inventoryRows.map(r => r.size?.trim() || 'S/T'))).sort();
      const models: string[]   = Array.from(new Set<string>(inventoryRows.map(r => r.name))).sort();
      const pivot: Record<string, Record<string, number>> = {};
      inventoryRows.forEach(r => {
        const sz = r.size?.trim() || 'S/T';
        if (!pivot[r.name]) pivot[r.name] = {};
        pivot[r.name][sz] = (pivot[r.name][sz] || 0) + r.qty;
      });
      const colTotals: Record<string, number> = {};
      allSizes.forEach(sz => { colTotals[sz] = models.reduce((a, m) => a + (pivot[m]?.[sz] ?? 0), 0); });
      const grandTotal = Object.values(colTotals).reduce((a, b) => a + b, 0);

      const pivotBody = models.map(m => {
        const rowTotal = allSizes.reduce((a, sz) => a + (pivot[m]?.[sz] ?? 0), 0);
        return [m, ...allSizes.map(sz => { const v = pivot[m]?.[sz]; return v ? String(v) : '-'; }), String(rowTotal)];
      });
      pivotBody.push(['TOTAL GENERAL', ...allSizes.map(sz => String(colTotals[sz] ?? 0)), String(grandTotal)]);

      const modelColW = Math.min(70, usableW * 0.45);
      const sizeColW = (usableW - modelColW) / (allSizes.length + 1);

      autoTable(pdf, {
        startY: y,
        head: [['MODELO', ...allSizes, 'TOTAL']],
        body: pivotBody,
        margin: { left: ML, right: MR },
        styles: { fontSize: 7.5, cellPadding: 2.5, lineColor: [220, 210, 240], lineWidth: 0.2 },
        headStyles: { fillColor: PURPLE, textColor: WHITE, fontStyle: 'bold', halign: 'center', fontSize: 8 },
        columnStyles: {
          0: { halign: 'left', fontStyle: 'bold', cellWidth: modelColW },
          ...Object.fromEntries(allSizes.map((_, i) => [i + 1, { halign: 'center', cellWidth: sizeColW }])),
          [allSizes.length + 1]: { halign: 'center', fontStyle: 'bold', cellWidth: sizeColW, fillColor: PURPLELIGHT },
        },
        alternateRowStyles: { fillColor: LIGHT },
        didParseCell: (data) => {
          if (data.row.index === pivotBody.length - 1) {
            data.cell.styles.fillColor = PURPLE;
            data.cell.styles.textColor = WHITE;
            data.cell.styles.fontStyle = 'bold';
          }
        },
        didDrawPage: () => drawFooter(),
      });

      drawFooter();

      // ── Página 2+: detalle por producto (UNA tabla vertical por producto) ──
      const grouped: Record<string, typeof inventoryRows> = {};
      inventoryRows.forEach(r => {
        if (!grouped[r.name]) grouped[r.name] = [];
        grouped[r.name].push(r);
      });

      pdf.addPage();
      y = drawHeader('Detalle por Producto y Variantes');

      const entries = Object.entries(grouped);
      for (const [name, variants] of entries) {
        const totalQty = variants.reduce((s, v) => s + v.qty, 0);
        const hasColor = variants.some(v => v.color && v.color.trim() !== '');
        const hasSize  = variants.some(v => v.size && v.size.trim() !== '');

        // Construir columnas dinámicamente
        const cols: string[] = [];
        if (hasColor) cols.push('COLOR');
        if (hasSize)  cols.push('TALLA');
        cols.push('CANTIDAD');

        const body = variants
          .sort((a, b) => (a.color || '').localeCompare(b.color || '') || (a.size || '').localeCompare(b.size || ''))
          .map(v => {
            const row: string[] = [];
            if (hasColor) row.push(v.color?.trim() || '—');
            if (hasSize)  row.push(v.size?.trim()  || '—');
            row.push(String(v.qty));
            return row;
          });

        // Fila de total
        const totalRow: string[] = Array(cols.length - 1).fill('');
        totalRow[0] = 'TOTAL';
        totalRow[cols.length - 1] = String(totalQty);

        // Anchos de columna proporcionales
        const qtyColW = 28;
        const remainW = usableW - qtyColW;
        const otherW  = cols.length > 1 ? remainW / (cols.length - 1) : remainW;
        const colStyles: Record<number, object> = {};
        cols.forEach((_, i) => {
          if (i < cols.length - 1) {
            colStyles[i] = { cellWidth: otherW, halign: 'left' as const };
          } else {
            colStyles[i] = { cellWidth: qtyColW, halign: 'center' as const, fontStyle: 'bold' as const };
          }
        });

        // Verificar si hay espacio; si no, nueva página
        const estimatedH = (body.length + 3) * 7;
        if (y + estimatedH > PH - MB - 15) {
          pdf.addPage();
          y = drawHeader('Detalle por Producto y Variantes (cont.)');
        }

        autoTable(pdf, {
          startY: y,
          head: [
            [{ content: name.toUpperCase(), colSpan: cols.length, styles: { fillColor: PURPLE, textColor: WHITE, fontStyle: 'bold', fontSize: 9, halign: 'left' as const } }],
            cols.map(c => ({ content: c, styles: { fillColor: BLACK, textColor: WHITE, fontStyle: 'bold', halign: 'center' as const, fontSize: 8 } })),
          ],
          body: [...body, totalRow],
          margin: { left: ML, right: MR },
          tableWidth: usableW,
          styles: { fontSize: 8, cellPadding: 2.8, lineColor: [220, 210, 240], lineWidth: 0.2 },
          columnStyles: colStyles,
          alternateRowStyles: { fillColor: LIGHT },
          didParseCell: (data) => {
            if (data.section === 'body' && data.row.index === body.length) {
              data.cell.styles.fillColor = PURPLELIGHT;
              data.cell.styles.fontStyle = 'bold';
              data.cell.styles.textColor = PURPLE;
            }
          },
          didDrawPage: () => drawFooter(),
        });

        y = (pdf as any).lastAutoTable.finalY + 6;
      }

      drawFooter();
    }

    // ── OTROS REPORTES (autoTable simple) ────────────────────────────────────
    else {
      let y = drawHeader(title);

      if (activeReport === 'adjustments') {
        autoTable(pdf, {
          startY: y,
          head: [['Fecha', 'Producto', 'Ubicacion', 'Antes', 'Despues', 'Diff', 'Motivo', 'Usuario']],
          body: filteredAdj.map(a => {
            const prod = products.find(p => p.id === a.productId);
            const loc  = locations.find(l => l.id === a.locationId);
            const diff = a.newQuantity - a.previousQuantity;
            return [
              format(new Date(a.date), 'dd/MM/yy HH:mm'),
              `${prod?.code || ''} ${prod?.name || a.productId}`.trim(),
              loc?.name || '-',
              String(a.previousQuantity),
              String(a.newQuantity),
              `${diff > 0 ? '+' : ''}${diff}`,
              a.reason,
              a.user,
            ];
          }),
          margin: { left: ML, right: MR },
          styles: { fontSize: 7.5, cellPadding: 2.5, lineColor: [220, 210, 240], lineWidth: 0.2 },
          headStyles: { fillColor: PURPLE, textColor: WHITE, fontStyle: 'bold' },
          alternateRowStyles: { fillColor: LIGHT },
          didParseCell: (data) => {
            if (data.section === 'body' && data.column.index === 5) {
              const v = String(data.cell.raw);
              if (v.startsWith('+')) data.cell.styles.textColor = [22, 163, 74];
              else if (v.startsWith('-')) data.cell.styles.textColor = [220, 38, 38];
              data.cell.styles.fontStyle = 'bold';
            }
          },
          didDrawPage: () => drawFooter(),
        });
      }

      else if (activeReport === 'abc') {
        autoTable(pdf, {
          startY: y,
          head: [['Clase', 'Codigo', 'Producto', 'Color', 'Talla', 'Despachos', '% Volumen']],
          body: abcData.map(r => [
            r.cls,
            r.prod.code,
            r.prod.name,
            r.prod.color || '-',
            r.prod.size  || '-',
            String(r.dispatched),
            `${r.pct.toFixed(1)}%`,
          ]),
          margin: { left: ML, right: MR },
          styles: { fontSize: 8, cellPadding: 2.5, lineColor: [220, 210, 240], lineWidth: 0.2 },
          headStyles: { fillColor: PURPLE, textColor: WHITE, fontStyle: 'bold' },
          columnStyles: {
            0: { cellWidth: 14, halign: 'center', fontStyle: 'bold', fontSize: 11 },
            5: { halign: 'center' },
            6: { halign: 'center' },
          },
          alternateRowStyles: { fillColor: LIGHT },
          didParseCell: (data) => {
            if (data.section === 'body' && data.column.index === 0) {
              const cls = String(data.cell.raw);
              if (cls === 'A') data.cell.styles.textColor = [21, 128, 61];
              else if (cls === 'B') data.cell.styles.textColor = [180, 83, 9];
              else data.cell.styles.textColor = [150, 150, 150];
            }
          },
          didDrawPage: () => drawFooter(),
        });
      }

      else if (activeReport === 'aging') {
        autoTable(pdf, {
          startY: y,
          head: [['Codigo', 'Producto', 'Color', 'Talla', 'Stock', 'Ultimo despacho', 'Dias sin mov.']],
          body: agingData.map(r => [
            r.prod.code,
            r.prod.name,
            r.prod.color || '-',
            r.prod.size  || '-',
            String(r.stock),
            r.lastDispatch ? format(new Date(r.lastDispatch), 'dd/MM/yyyy') : '-',
            r.daysSince !== null ? String(r.daysSince) : 'Sin despachos',
          ]),
          margin: { left: ML, right: MR },
          styles: { fontSize: 8, cellPadding: 2.5, lineColor: [220, 210, 240], lineWidth: 0.2 },
          headStyles: { fillColor: PURPLE, textColor: WHITE, fontStyle: 'bold' },
          columnStyles: {
            4: { halign: 'center' },
            5: { halign: 'center' },
            6: { halign: 'center', fontStyle: 'bold' },
          },
          alternateRowStyles: { fillColor: LIGHT },
          didParseCell: (data) => {
            if (data.section === 'body' && data.column.index === 6) {
              const d = Number(data.cell.raw);
              if (d >= 90) data.cell.styles.textColor = [220, 38, 38];
              else if (d >= 30) data.cell.styles.textColor = [180, 83, 9];
            }
          },
          didDrawPage: () => drawFooter(),
        });
      }

      else if (activeReport === 'movements') {
        movementsBySupplier.forEach(({ supplier, txs, total }) => {
          // Encabezado de proveedor
          if (y > PH - 60) { pdf.addPage(); y = drawHeader(title); }
          pdf.setFillColor(...PURPLE);
          pdf.roundedRect(ML, y, usableW, 8, 1.5, 1.5, 'F');
          pdf.setTextColor(...WHITE);
          pdf.setFontSize(9); pdf.setFont('helvetica', 'bold');
          pdf.text(supplier.name.toUpperCase(), ML + 4, y + 5.5);
          pdf.setFontSize(8); pdf.setFont('helvetica', 'normal');
          pdf.text(`${total} uds  ·  ${txs.length} recepciones`, PW - MR - 4, y + 5.5, { align: 'right' });
          y += 11;
          autoTable(pdf, {
            startY: y,
            head: [['Fecha', 'Referencia', 'Producto', 'Color', 'Talla', 'Cantidad']],
            body: txs.map(tx => {
              const prod = products.find(p => p.id === tx.productId);
              return [
                format(new Date(tx.date), 'dd/MM/yy HH:mm'),
                tx.reference || '-',
                prod?.name || tx.productId,
                prod?.color || '-',
                prod?.size  || '-',
                String(tx.quantity),
              ];
            }),
            margin: { left: ML, right: MR },
            styles: { fontSize: 7.5, cellPadding: 2.2, lineColor: [220, 210, 240], lineWidth: 0.2 },
            headStyles: { fillColor: BLACK, textColor: WHITE, fontStyle: 'bold' },
            columnStyles: { 5: { halign: 'center', fontStyle: 'bold' } },
            alternateRowStyles: { fillColor: LIGHT },
            didDrawPage: () => drawFooter(),
          });
          y = (pdf as any).lastAutoTable.finalY + 8;
        });
      }

      else if (activeReport === 'valuation') {
        autoTable(pdf, {
          startY: y,
          head: [['Codigo', 'Producto', 'Color', 'Talla', 'Stock']],
          body: inventoryRows.map(r => [r.code, r.name, r.color || '-', r.size || '-', String(r.qty)]),
          margin: { left: ML, right: MR },
          styles: { fontSize: 8, cellPadding: 2.5, lineColor: [220, 210, 240], lineWidth: 0.2 },
          headStyles: { fillColor: PURPLE, textColor: WHITE, fontStyle: 'bold' },
          columnStyles: { 4: { halign: 'center', fontStyle: 'bold' } },
          alternateRowStyles: { fillColor: LIGHT },
          didDrawPage: () => drawFooter(),
        });
      }

      drawFooter();
    }

    pdf.save(filename);
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

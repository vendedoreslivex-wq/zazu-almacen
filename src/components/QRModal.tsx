import React, { useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, Printer } from 'lucide-react';

type QRItem =
  | { kind: 'product'; id: string; code: string; name: string; color?: string; size?: string; brand: string }
  | { kind: 'location'; id: string; name: string; type: string; brand: string };

interface QRModalProps {
  item: QRItem;
  onClose: () => void;
}

export const QRModal: React.FC<QRModalProps> = ({ item, onClose }) => {
  const printRef = useRef<HTMLDivElement>(null);

  const qrValue = item.kind === 'product'
    ? JSON.stringify({ id: item.id, code: item.code, name: item.name, color: item.color, size: item.size, brand: item.brand })
    : JSON.stringify({ id: item.id, name: item.name, type: item.type, brand: item.brand });

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <html><head><title>QR — ${item.kind === 'product' ? item.code : item.name}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Courier New', monospace; background: white; display: flex; justify-content: center; align-items: flex-start; padding: 24px; }
        .label { border: 2px solid #141414; padding: 16px; display: flex; flex-direction: column; align-items: center; gap: 8px; width: 220px; }
        .brand { font-size: 8px; font-weight: bold; text-transform: uppercase; letter-spacing: 2px; opacity: 0.6; }
        .code { font-size: 13px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; }
        .name { font-size: 10px; text-align: center; }
        .attr { font-size: 9px; opacity: 0.7; background: #f0f0f0; padding: 2px 8px; }
        @media print { body { padding: 0; } }
      </style></head><body>
      <div class="label">${content.innerHTML}</div>
      </body></html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 400);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-[var(--bg)] border-2 border-[var(--border)] shadow-[6px_6px_0_var(--border)] flex flex-col w-72"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b border-[var(--border)] px-4 py-3 flex justify-between items-center bg-[var(--bg-sidebar)]">
          <span className="font-mono font-bold text-[10px] uppercase tracking-widest">
            {item.kind === 'product' ? 'QR PRODUCTO' : 'QR UBICACIÓN'}
          </span>
          <button onClick={onClose} className="opacity-60 hover:opacity-100 hover:text-red-700 transition-colors p-0.5">
            <X size={15} />
          </button>
        </div>

        {/* QR + info */}
        <div className="flex flex-col items-center gap-3 p-6">
          <div className="font-mono text-[8px] font-bold uppercase tracking-widest opacity-50">
            {item.brand.replace('_', ' ')}
          </div>

          {/* Printable area */}
          <div ref={printRef} className="flex flex-col items-center gap-2 w-full">
            <div className="font-mono text-[8px] font-bold uppercase tracking-widest opacity-50 brand">
              {item.brand.replace('_', ' ')}
            </div>
            <QRCodeSVG value={qrValue} size={160} />
            {item.kind === 'product' ? (
              <>
                <div className="font-mono font-black text-sm code">{item.code}</div>
                <div className="font-mono text-[11px] text-center name">{item.name}</div>
                {(item.color || item.size) && (
                  <div className="font-mono text-[10px] opacity-60 attr">{[item.color, item.size].filter(Boolean).join(' / ')}</div>
                )}
              </>
            ) : (
              <>
                <div className="font-mono font-black text-sm text-center code">{item.name}</div>
                <div className="font-mono text-[10px] opacity-60 attr">{item.type}</div>
              </>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="border-t border-[var(--border)] p-3">
          <button
            onClick={handlePrint}
            className="w-full flex items-center justify-center gap-2 bg-[var(--ink)] text-[var(--ink-inv)] py-2.5 text-[10px] font-bold font-mono uppercase hover:shadow-[2px_2px_0_var(--border)] transition-all"
          >
            <Printer size={13} /> IMPRIMIR ETIQUETA
          </button>
        </div>
      </div>
    </div>
  );
};

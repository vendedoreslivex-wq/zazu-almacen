import { supabase } from './supabase';

const EDGE_FN_URL = `${import.meta.env.VITE_SUPABASE_FUNCTIONS_URL}/send-email`;

const INTERNAL_RECIPIENTS = [
  { name: 'Rubén',     email: 'rbnasmat@gmail.com' },
  { name: 'Williams',  email: 'Melaminacolors2@gmail.com' },
  { name: 'Benjamín',  email: 'elbenjael17@gmail.com' },
  { name: 'Valentino', email: 'jamesrojasdiaz01@gmail.com' },
];

async function callEdgeFunction(recipients: { name: string; email: string }[], subject: string, html: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return;
  await fetch(EDGE_FN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ recipients, subject, html }),
  });
}

// ─── Operation Emails ─────────────────────────────────────────────────────────

export type OperationType = 'RECEPTION' | 'DISPATCH' | 'TRANSFER';

export interface OperationItem {
  productName: string;
  productCode: string;
  quantity: number;
  serialNumber?: string;
}

export interface DispatchEmailParams {
  toEmail: string;
  toName: string;
  brand: string;
  operationType: OperationType;
  reference: string;
  date: string;
  operator: string;
  items: OperationItem[];
  fromLocation?: string;
  toLocation?: string;
  contact?: string;
  signature?: string;
  photo?: string;
}

const TYPE_LABEL: Record<OperationType, string> = {
  RECEPTION: 'RECEPCIÓN',
  DISPATCH: 'DESPACHO',
  TRANSFER: 'TRASLADO',
};

const TYPE_COLOR: Record<OperationType, string> = {
  RECEPTION: '#16a34a',
  DISPATCH: '#dc2626',
  TRANSFER: '#0891b2',
};

function buildHTML(p: DispatchEmailParams): string {
  const label = TYPE_LABEL[p.operationType];
  const color = TYPE_COLOR[p.operationType];
  const brandDisplay = p.brand.replace('_', ' ');
  const totalQty = p.items.reduce((sum, i) => sum + i.quantity, 0);
  const contactLabel = p.operationType === 'RECEPTION' ? 'Proveedor' : 'Cliente';

  const row = (lbl: string, val: string) =>
    `<tr>
      <td style="padding:8px 0;font-size:11px;letter-spacing:.15em;opacity:.5;text-transform:uppercase;font-weight:700;border-bottom:1px solid rgba(20,20,20,.1);width:40%">${lbl}</td>
      <td style="padding:8px 0;font-size:11px;font-weight:900;text-transform:uppercase;text-align:right;border-bottom:1px solid rgba(20,20,20,.1)">${val}</td>
    </tr>`;

  const itemsHTML = p.items.length === 1
    ? `<div style="border:2px solid #141414;padding:16px;margin:20px 0;background:#fff">
        <div style="font-size:9px;letter-spacing:.25em;opacity:.4;text-transform:uppercase;margin-bottom:4px">${p.items[0].productCode}</div>
        <div style="font-size:15px;font-weight:900;text-transform:uppercase;letter-spacing:.05em">${p.items[0].productName}</div>
        ${p.items[0].serialNumber ? `<div style="font-size:9px;opacity:.5;margin-top:4px">S/N: ${p.items[0].serialNumber}</div>` : ''}
        <div style="display:inline-block;background:#141414;color:#E4E3E0;font-size:22px;font-weight:900;padding:8px 18px;margin-top:12px;letter-spacing:.05em">${p.items[0].quantity} UND</div>
      </div>`
    : `<div style="margin:20px 0">
        <div style="font-size:9px;letter-spacing:.2em;opacity:.4;text-transform:uppercase;margin-bottom:8px;font-weight:700">PRODUCTOS — ${p.items.length} LÍNEAS</div>
        <table style="width:100%;border-collapse:collapse;background:#fff;border:2px solid #141414">
          <thead>
            <tr style="background:#141414;color:#E4E3E0">
              <td style="padding:7px 10px;font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase">Código</td>
              <td style="padding:7px 10px;font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase">Producto</td>
              <td style="padding:7px 10px;font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;text-align:right">Cant.</td>
            </tr>
          </thead>
          <tbody>
            ${p.items.map(item => `
            <tr style="border-bottom:1px solid #eee">
              <td style="padding:6px 10px;font-size:9px;font-weight:700;opacity:.5">${item.productCode}</td>
              <td style="padding:6px 10px;font-size:11px;font-weight:900;text-transform:uppercase">${item.productName}</td>
              <td style="padding:6px 10px;font-size:11px;font-weight:900;text-align:right">${item.quantity}</td>
            </tr>`).join('')}
          </tbody>
          <tfoot>
            <tr style="background:#f5f5f5">
              <td colspan="2" style="padding:8px 10px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.1em">TOTAL UNIDADES</td>
              <td style="padding:8px 10px;font-size:14px;font-weight:900;text-align:right">${totalQty}</td>
            </tr>
          </tfoot>
        </table>
      </div>`;

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:20px;background:#f0efec;font-family:'Courier New',monospace">
  <div style="max-width:580px;margin:0 auto;background:#E4E3E0;border:2px solid #141414;box-shadow:6px 6px 0 #141414">

    <div style="background:#141414;color:#E4E3E0;padding:24px 28px">
      <div style="font-size:9px;letter-spacing:.35em;opacity:.5;text-transform:uppercase">${brandDisplay} — SISTEMA DE ALMACÉN</div>
      <div style="display:inline-block;background:${color};color:#fff;padding:5px 14px;font-size:10px;font-weight:900;letter-spacing:.3em;margin-top:12px;text-transform:uppercase">${label}</div>
      <div style="font-size:24px;font-weight:900;letter-spacing:.08em;margin-top:8px;text-transform:uppercase">${p.reference}</div>
      <div style="font-size:10px;opacity:.4;margin-top:4px;letter-spacing:.15em">${p.date}</div>
    </div>

    <div style="padding:24px 28px">
      <table style="width:100%;border-collapse:collapse">
        ${row('Operador', p.operator)}
        ${p.contact ? row(contactLabel, p.contact) : ''}
        ${p.fromLocation ? row('Origen', p.fromLocation) : ''}
        ${p.toLocation ? row('Destino', p.toLocation) : ''}
      </table>

      ${itemsHTML}

      ${p.signature ? `
      <div style="margin-top:16px;padding-top:16px;border-top:1px dashed rgba(20,20,20,.3)">
        <div style="font-size:9px;letter-spacing:.2em;opacity:.5;text-transform:uppercase;margin-bottom:8px;font-weight:700">FIRMA DE CONFORMIDAD</div>
        <img src="${p.signature}" alt="Firma" style="max-width:200px;max-height:80px;border:1px solid #141414;padding:4px;background:#fff;display:block">
      </div>` : ''}

      ${p.photo ? `
      <div style="margin-top:16px;padding-top:16px;border-top:1px dashed rgba(20,20,20,.3)">
        <div style="font-size:9px;letter-spacing:.2em;opacity:.5;text-transform:uppercase;margin-bottom:8px;font-weight:700">EVIDENCIA FOTOGRÁFICA</div>
        <img src="${p.photo}" alt="Evidencia" style="max-width:100%;max-height:240px;border:1px solid #141414;padding:4px;background:#fff;display:block">
      </div>` : ''}
    </div>

    <div style="background:#D4D3D0;border-top:1px solid #141414;padding:10px 28px;font-size:9px;opacity:.45;letter-spacing:.15em;text-transform:uppercase">
      LogixZazu v3.0 — Comprobante generado automáticamente // ${p.date}
    </div>
  </div>
</body>
</html>`;
}

export async function sendOperationEmail(params: DispatchEmailParams): Promise<void> {
  const html = buildHTML(params);
  const subject = `[${TYPE_LABEL[params.operationType]}] ${params.reference} — ${params.brand.replace('_', ' ')}`;
  await callEdgeFunction([{ name: params.toName, email: params.toEmail }], subject, html);
}

export async function sendOperationToInternalRecipients(params: Omit<DispatchEmailParams, 'toEmail' | 'toName'>): Promise<void> {
  const html = buildHTML({ ...params, toEmail: '', toName: '' });
  const subject = `[${TYPE_LABEL[params.operationType]}] ${params.reference} — ${params.brand.replace('_', ' ')}`;
  await callEdgeFunction(INTERNAL_RECIPIENTS, subject, html);
}

// ─── Purchase Order Emails ────────────────────────────────────────────────────

export interface POEmailItem {
  productCode: string;
  productName: string;
  quantity: number;
  unitCost: number;
}

export interface PurchaseOrderEmailParams {
  reference: string;
  supplierName: string;
  status: 'DRAFT' | 'APPROVED';
  date: string;
  operator: string;
  items: POEmailItem[];
  notes?: string;
}

const PO_STATUS_LABEL: Record<'DRAFT' | 'APPROVED', string> = {
  DRAFT: 'CREADA',
  APPROVED: 'APROBADA',
};

const PO_STATUS_COLOR: Record<'DRAFT' | 'APPROVED', string> = {
  DRAFT: '#9f9d99',
  APPROVED: '#d97706',
};

function buildPOHTML(p: PurchaseOrderEmailParams): string {
  const label = PO_STATUS_LABEL[p.status];
  const color = PO_STATUS_COLOR[p.status];
  const totalUnits = p.items.reduce((s, i) => s + i.quantity, 0);
  const totalValue = p.items.reduce((s, i) => s + i.quantity * i.unitCost, 0);

  const row = (lbl: string, val: string) =>
    `<tr>
      <td style="padding:8px 0;font-size:11px;letter-spacing:.15em;opacity:.5;text-transform:uppercase;font-weight:700;border-bottom:1px solid rgba(20,20,20,.1);width:40%">${lbl}</td>
      <td style="padding:8px 0;font-size:11px;font-weight:900;text-transform:uppercase;text-align:right;border-bottom:1px solid rgba(20,20,20,.1)">${val}</td>
    </tr>`;

  const itemsHTML = `
    <div style="margin:20px 0">
      <div style="font-size:9px;letter-spacing:.2em;opacity:.4;text-transform:uppercase;margin-bottom:8px;font-weight:700">PRODUCTOS — ${p.items.length} LÍNEAS</div>
      <table style="width:100%;border-collapse:collapse;background:#fff;border:2px solid #141414">
        <thead>
          <tr style="background:#141414;color:#E4E3E0">
            <td style="padding:7px 10px;font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase">Código</td>
            <td style="padding:7px 10px;font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase">Producto</td>
            <td style="padding:7px 10px;font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;text-align:right">Cant.</td>
            <td style="padding:7px 10px;font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;text-align:right">Costo U.</td>
            <td style="padding:7px 10px;font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;text-align:right">Total</td>
          </tr>
        </thead>
        <tbody>
          ${p.items.map(item => `
          <tr style="border-bottom:1px solid #eee">
            <td style="padding:6px 10px;font-size:9px;font-weight:700;opacity:.5">${item.productCode}</td>
            <td style="padding:6px 10px;font-size:11px;font-weight:900;text-transform:uppercase">${item.productName}</td>
            <td style="padding:6px 10px;font-size:11px;font-weight:900;text-align:right">${item.quantity}</td>
            <td style="padding:6px 10px;font-size:11px;text-align:right">S/ ${item.unitCost.toFixed(2)}</td>
            <td style="padding:6px 10px;font-size:11px;font-weight:900;text-align:right">S/ ${(item.quantity * item.unitCost).toFixed(2)}</td>
          </tr>`).join('')}
        </tbody>
        <tfoot>
          <tr style="background:#f5f5f5">
            <td colspan="2" style="padding:8px 10px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.1em">TOTAL</td>
            <td style="padding:8px 10px;font-size:13px;font-weight:900;text-align:right">${totalUnits} und</td>
            <td></td>
            <td style="padding:8px 10px;font-size:13px;font-weight:900;text-align:right">S/ ${totalValue.toFixed(2)}</td>
          </tr>
        </tfoot>
      </table>
    </div>`;

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:20px;background:#f0efec;font-family:'Courier New',monospace">
  <div style="max-width:620px;margin:0 auto;background:#E4E3E0;border:2px solid #141414;box-shadow:6px 6px 0 #141414">

    <div style="background:#141414;color:#E4E3E0;padding:24px 28px">
      <div style="font-size:9px;letter-spacing:.35em;opacity:.5;text-transform:uppercase">LOGIXZAZU — ÓRDENES DE COMPRA</div>
      <div style="display:inline-block;background:${color};color:#fff;padding:5px 14px;font-size:10px;font-weight:900;letter-spacing:.3em;margin-top:12px;text-transform:uppercase">ORDEN ${label}</div>
      <div style="font-size:24px;font-weight:900;letter-spacing:.08em;margin-top:8px;text-transform:uppercase">${p.reference}</div>
      <div style="font-size:10px;opacity:.4;margin-top:4px;letter-spacing:.15em">${p.date}</div>
    </div>

    <div style="padding:24px 28px">
      <table style="width:100%;border-collapse:collapse">
        ${row('Proveedor', p.supplierName)}
        ${row('Operador', p.operator)}
        ${row('Estado', label)}
      </table>

      ${itemsHTML}

      ${p.notes ? `<div style="margin-top:12px;padding:12px;border:1px dashed rgba(20,20,20,.3);font-size:10px;opacity:.7">${p.notes}</div>` : ''}
    </div>

    <div style="background:#D4D3D0;border-top:1px solid #141414;padding:10px 28px;font-size:9px;opacity:.45;letter-spacing:.15em;text-transform:uppercase">
      LogixZazu v3.0 — Notificación automática // ${p.date}
    </div>
  </div>
</body>
</html>`;
}

export async function sendPurchaseOrderEmail(params: PurchaseOrderEmailParams): Promise<void> {
  const html = buildPOHTML(params);
  const subject = `[OC ${PO_STATUS_LABEL[params.status]}] ${params.reference} — ${params.supplierName}`;
  await callEdgeFunction(INTERNAL_RECIPIENTS, subject, html);
}

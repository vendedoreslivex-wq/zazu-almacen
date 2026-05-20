import emailjs from '@emailjs/browser';

const PUBLIC_KEY = 'Nl9Zi36JAgLjwURH4';
const SERVICE_ID = 'service_zazu';
const TEMPLATE_ID = 'template_zazu';

export type OperationType = 'RECEPTION' | 'DISPATCH' | 'TRANSFER';

export interface DispatchEmailParams {
  toEmail: string;
  toName: string;
  brand: string;
  operationType: OperationType;
  reference: string;
  date: string;
  operator: string;
  productName: string;
  productCode: string;
  quantity: number;
  fromLocation?: string;
  toLocation?: string;
  contact?: string;
  serialNumber?: string;
  signature?: string;
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

  const row = (lbl: string, val: string) =>
    `<tr><td style="padding:8px 0;font-size:11px;letter-spacing:.15em;opacity:.5;text-transform:uppercase;font-weight:700;border-bottom:1px solid rgba(20,20,20,.1);width:40%">${lbl}</td><td style="padding:8px 0;font-size:11px;font-weight:900;text-transform:uppercase;text-align:right;border-bottom:1px solid rgba(20,20,20,.1)">${val}</td></tr>`;

  const contactLabel = p.operationType === 'RECEPTION' ? 'Proveedor' : 'Cliente';

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:20px;background:#f0efec;font-family:'Courier New',monospace">
  <div style="max-width:580px;margin:0 auto;background:#E4E3E0;border:2px solid #141414;box-shadow:6px 6px 0 #141414">

    <!-- HEADER -->
    <div style="background:#141414;color:#E4E3E0;padding:24px 28px">
      <div style="font-size:9px;letter-spacing:.35em;opacity:.5;text-transform:uppercase">${brandDisplay} — SISTEMA DE ALMACÉN</div>
      <div style="display:inline-block;background:${color};color:#fff;padding:5px 14px;font-size:10px;font-weight:900;letter-spacing:.3em;margin-top:12px;text-transform:uppercase">${label}</div>
      <div style="font-size:24px;font-weight:900;letter-spacing:.08em;margin-top:8px;text-transform:uppercase">${p.reference}</div>
      <div style="font-size:10px;opacity:.4;margin-top:4px;letter-spacing:.15em">${p.date}</div>
    </div>

    <!-- BODY -->
    <div style="padding:24px 28px">
      <table style="width:100%;border-collapse:collapse">
        ${row('Operador', p.operator)}
        ${p.contact ? row(contactLabel, p.contact) : ''}
        ${p.fromLocation ? row('Origen', p.fromLocation) : ''}
        ${p.toLocation ? row('Destino', p.toLocation) : ''}
        ${p.serialNumber ? row('N° Serie / Lote', p.serialNumber) : ''}
      </table>

      <!-- PRODUCTO -->
      <div style="border:2px solid #141414;padding:16px;margin:20px 0;background:#fff">
        <div style="font-size:9px;letter-spacing:.25em;opacity:.4;text-transform:uppercase;margin-bottom:4px">${p.productCode}</div>
        <div style="font-size:15px;font-weight:900;text-transform:uppercase;letter-spacing:.05em">${p.productName}</div>
        <div style="display:inline-block;background:#141414;color:#E4E3E0;font-size:22px;font-weight:900;padding:8px 18px;margin-top:12px;letter-spacing:.05em">${p.quantity} UND</div>
      </div>

      ${p.signature ? `
      <!-- FIRMA -->
      <div style="margin-top:16px;padding-top:16px;border-top:1px dashed rgba(20,20,20,.3)">
        <div style="font-size:9px;letter-spacing:.2em;opacity:.5;text-transform:uppercase;margin-bottom:8px;font-weight:700">FIRMA DE CONFORMIDAD</div>
        <img src="${p.signature}" alt="Firma digital" style="max-width:200px;max-height:80px;border:1px solid #141414;padding:4px;background:#fff;display:block">
      </div>` : ''}
    </div>

    <!-- FOOTER -->
    <div style="background:#D4D3D0;border-top:1px solid #141414;padding:10px 28px;font-size:9px;opacity:.45;letter-spacing:.15em;text-transform:uppercase">
      LogixZazu v3.0 — Comprobante generado automáticamente // ${p.date}
    </div>
  </div>
</body>
</html>`;
}

export async function sendOperationEmail(params: DispatchEmailParams): Promise<void> {
  const html = buildHTML(params);
  await emailjs.send(
    SERVICE_ID,
    TEMPLATE_ID,
    {
      to_email: params.toEmail,
      to_name: params.toName,
      subject: `[${TYPE_LABEL[params.operationType]}] ${params.reference} — ${params.brand.replace('_', ' ')}`,
      html_body: html,
    },
    PUBLIC_KEY
  );
}

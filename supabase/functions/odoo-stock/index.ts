// Edge Function: odoo-stock
// Usa XML-RPC (compatible con API keys de Odoo Cloud).
// El navegador llama a Supabase, Supabase llama a Odoo sin CORS.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ODOO_URL  = Deno.env.get('ODOO_URL')     ?? 'https://zazuexpress2.odoo.com';
const ODOO_DB   = Deno.env.get('ODOO_DB')      ?? 'zazuexpress2-prod-27700346';
const ODOO_USER = Deno.env.get('ODOO_USER')    ?? 'overshark08@gmail.com';
const ODOO_KEY  = Deno.env.get('ODOO_API_KEY') ?? '5f57c210c5c4aa3aa697093e00a8d3d29319e698';

// ─── XML-RPC helpers ─────────────────────────────────────────────────────────

function xmlVal(v: unknown): string {
  if (v === null || v === false) return '<value><boolean>0</boolean></value>';
  if (v === true) return '<value><boolean>1</boolean></value>';
  if (typeof v === 'number') return Number.isInteger(v)
    ? `<value><int>${v}</int></value>`
    : `<value><double>${v}</double></value>`;
  if (typeof v === 'string') return `<value><string>${v.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</string></value>`;
  if (Array.isArray(v)) return `<value><array><data>${v.map(xmlVal).join('')}</data></array></value>`;
  if (typeof v === 'object') {
    const members = Object.entries(v as Record<string,unknown>)
      .map(([k, val]) => `<member><name>${k}</name>${xmlVal(val)}</member>`)
      .join('');
    return `<value><struct>${members}</struct></value>`;
  }
  return `<value><string>${String(v)}</string></value>`;
}

function buildCall(method: string, params: unknown[]): string {
  return `<?xml version="1.0"?><methodCall><methodName>${method}</methodName><params>${
    params.map(p => `<param>${xmlVal(p)}</param>`).join('')
  }</params></methodCall>`;
}

function parseXml(xml: string): unknown {
  // Tokenizer-based XML-RPC parser (no DOM available in Deno edge runtime)
  let pos = 0;

  function skipWS() { while (pos < xml.length && /\s/.test(xml[pos])) pos++; }

  function readTag(): string {
    skipWS();
    if (xml[pos] !== '<') throw new Error(`Expected '<' at ${pos}, got: ${xml.slice(pos, pos+20)}`);
    const end = xml.indexOf('>', pos);
    if (end === -1) throw new Error('Unclosed tag');
    const tag = xml.slice(pos + 1, end).trim();
    pos = end + 1;
    return tag;
  }

  function readUntilClose(tag: string): string {
    const close = `</${tag}>`;
    const idx = xml.indexOf(close, pos);
    if (idx === -1) throw new Error(`Missing closing </${tag}>`);
    const content = xml.slice(pos, idx);
    pos = idx + close.length;
    return content;
  }

  function parseValue(): unknown {
    skipWS();
    // consume <value>
    if (xml.slice(pos, pos + 7) !== '<value>') throw new Error(`Expected <value> at ${pos}`);
    pos += 7;
    skipWS();

    let result: unknown;

    if (xml.slice(pos, pos + 5) === '<int>') {
      pos += 5; result = parseInt(readUntilClose('int'), 10);
    } else if (xml.slice(pos, pos + 4) === '<i4>') {
      pos += 4; result = parseInt(readUntilClose('i4'), 10);
    } else if (xml.slice(pos, pos + 8) === '<double>') {
      pos += 8; result = parseFloat(readUntilClose('double'));
    } else if (xml.slice(pos, pos + 9) === '<boolean>') {
      pos += 9; result = readUntilClose('boolean').trim() === '1';
    } else if (xml.slice(pos, pos + 8) === '<string>') {
      pos += 8;
      result = readUntilClose('string').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>');
    } else if (xml.slice(pos, pos + 7) === '<array>') {
      pos += 7; skipWS();
      if (xml.slice(pos, pos + 6) !== '<data>') throw new Error('Expected <data>');
      pos += 6;
      const arr: unknown[] = [];
      skipWS();
      while (xml.slice(pos, pos + 7) === '<value>') { arr.push(parseValue()); skipWS(); }
      if (xml.slice(pos, pos + 7) !== '</data>') throw new Error('Expected </data>');
      pos += 7; skipWS();
      if (xml.slice(pos, pos + 8) !== '</array>') throw new Error('Expected </array>');
      pos += 8;
      result = arr;
    } else if (xml.slice(pos, pos + 8) === '<struct>') {
      pos += 8;
      const obj: Record<string, unknown> = {};
      skipWS();
      while (xml.slice(pos, pos + 8) === '<member>') {
        pos += 8; skipWS();
        if (xml.slice(pos, pos + 6) !== '<name>') throw new Error('Expected <name>');
        pos += 6;
        const name = readUntilClose('name');
        skipWS();
        obj[name] = parseValue();
        skipWS();
        if (xml.slice(pos, pos + 9) !== '</member>') throw new Error('Expected </member>');
        pos += 9; skipWS();
      }
      if (xml.slice(pos, pos + 9) !== '</struct>') throw new Error('Expected </struct>');
      pos += 9;
      result = obj;
    } else {
      // bare string value (no inner tag)
      const end = xml.indexOf('</value>', pos);
      if (end === -1) throw new Error('Missing </value>');
      result = xml.slice(pos, end).trim().replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>');
      pos = end;
    }

    skipWS();
    if (xml.slice(pos, pos + 8) !== '</value>') throw new Error(`Expected </value> at ${pos}`);
    pos += 8;
    return result;
  }

  // Check for fault
  if (xml.includes('<fault>')) {
    const fi = xml.indexOf('<value>', xml.indexOf('<fault>'));
    if (fi !== -1) { pos = fi; const obj = parseValue() as Record<string,unknown>; throw new Error(`Odoo fault ${obj.faultCode}: ${obj.faultString}`); }
  }

  // Normal response: find first <value> inside <param>
  const vi = xml.indexOf('<value>');
  if (vi === -1) throw new Error('XML-RPC: no <value> in response');
  pos = vi;
  return parseValue();
}

async function xmlrpc(endpoint: string, method: string, params: unknown[]): Promise<unknown> {
  const body = buildCall(method, params);
  const res = await fetch(`${ODOO_URL}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/xml', 'charset': 'utf-8' },
    body,
  });
  const text = await res.text();
  return parseXml(text);
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

let _uid: number | null = null;

async function getUid(): Promise<number> {
  if (_uid !== null) return _uid;
  const uid = await xmlrpc('/xmlrpc/2/common', 'authenticate', [ODOO_DB, ODOO_USER, ODOO_KEY, {}]);
  if (!uid || typeof uid !== 'number') throw new Error(`Auth fallida — uid: ${JSON.stringify(uid)}`);
  _uid = uid;
  return _uid;
}

// ─── search_read via XML-RPC ──────────────────────────────────────────────────

async function searchRead(model: string, domain: unknown[], fields: string[], limit = 500, order = ''): Promise<unknown[]> {
  const uid = await getUid();
  const kwargs: Record<string, unknown> = {
    fields,
    limit,
    context: {},
  };
  if (order) kwargs.order = order;
  const result = await xmlrpc('/xmlrpc/2/object', 'execute_kw', [
    ODOO_DB, uid, ODOO_KEY,
    model, 'search_read',
    [domain],
    kwargs,
  ]);
  return result as unknown[];
}

// ─── Queries ─────────────────────────────────────────────────────────────────

const COMPANY_IDS = [5, 8, 11];

async function getProducts() {
  return searchRead(
    'product.template',
    [['type', 'in', ['product', 'consu']], ['active', '=', true], ['company_id', 'in', COMPANY_IDS]],
    ['id', 'name', 'default_code', 'categ_id', 'qty_available', 'virtual_available', 'uom_id', 'list_price', 'standard_price', 'company_id'],
    500, 'name asc',
  );
}

async function getVariants() {
  return searchRead(
    'product.product',
    [['active', '=', true], ['company_id', 'in', COMPANY_IDS]],
    ['id', 'name', 'default_code', 'product_tmpl_id', 'qty_available', 'virtual_available', 'combination_indices', 'company_id', 'product_template_attribute_value_ids'],
    2000, 'product_tmpl_id asc',
  );
}

async function getAttributeValues(ids: number[]) {
  if (ids.length === 0) return [];
  return searchRead(
    'product.template.attribute.value',
    [['id', 'in', ids]],
    ['id', 'name', 'attribute_id', 'html_color'],
    5000, 'id asc',
  );
}

async function getQuants() {
  return searchRead(
    'stock.quant',
    [['quantity', '>', 0], ['company_id', 'in', COMPANY_IDS]],
    ['id', 'product_id', 'product_tmpl_id', 'location_id', 'lot_id', 'quantity', 'reserved_quantity', 'available_quantity', 'in_date', 'company_id'],
    5000, 'product_id asc',
  );
}

async function getLocations() {
  return searchRead(
    'stock.location',
    [['usage', 'in', ['internal', 'transit']], ['active', '=', true], ['company_id', 'in', COMPANY_IDS]],
    ['id', 'name', 'complete_name', 'usage', 'location_id', 'company_id'],
    200, 'complete_name asc',
  );
}

async function getMoves() {
  return searchRead(
    'stock.move',
    [['state', '=', 'done'], ['company_id', 'in', COMPANY_IDS]],
    ['id', 'product_id', 'location_id', 'location_dest_id', 'product_qty', 'state', 'date', 'origin', 'picking_id', 'company_id'],
    150, 'date desc',
  );
}

// ─── Route dispatch ───────────────────────────────────────────────────────────

const ROUTES: Record<string, () => Promise<unknown>> = {
  products:  getProducts,
  variants:  getVariants,
  quants:    getQuants,
  locations: getLocations,
  moves:     getMoves,
};

// ─── Handler ─────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const url = new URL(req.url);
    const resource = url.searchParams.get('resource') ?? 'all';

    let result: unknown;

    if (resource === 'all') {
      const [products, variants, quants, locations, moves] = await Promise.all([
        getProducts(), getVariants(), getQuants(), getLocations(), getMoves(),
      ]);
      // collect all attribute value IDs referenced by variants
      const attrIds = [...new Set(
        (variants as Record<string, unknown>[])
          .flatMap(v => (v.product_template_attribute_value_ids as number[]) ?? [])
      )];
      const attributeValues = await getAttributeValues(attrIds);
      result = { products, variants, quants, locations, moves, attributeValues };
    } else {
      const fn = ROUTES[resource];
      if (!fn) {
        return new Response(JSON.stringify({ error: `Recurso desconocido: ${resource}` }), {
          status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
        });
      }
      result = await fn();
    }

    return new Response(JSON.stringify(result), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});

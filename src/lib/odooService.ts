// Llama a la Supabase Edge Function `odoo-stock` como proxy.
// La Edge Function corre servidor-a-servidor hacia Odoo (sin CORS).

import { supabase, FUNCTIONS_URL } from './supabase';

async function edgeFetch(resource: string) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token ?? '';
  const res = await fetch(`${FUNCTIONS_URL}/odoo-stock?resource=${resource}`, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY as string,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Edge Function error ${res.status}: ${body}`);
  }
  const json = await res.json();
  if (json.error) throw new Error(json.error);
  return json;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type OdooProduct = {
  id: number;
  name: string;
  default_code: string;
  categ_id: [number, string];
  type: string;
  qty_available: number;
  virtual_available: number;
  uom_id: [number, string];
  list_price: number;
  standard_price: number;
  active: boolean;
  company_id: [number, string] | false;
};

export type OdooVariant = {
  id: number;
  name: string;
  default_code: string;
  product_tmpl_id: [number, string];
  qty_available: number;
  virtual_available: number;
  combination_indices: string;
  company_id: [number, string] | false;
  product_template_attribute_value_ids: number[];
};

export type OdooAttributeValue = {
  id: number;
  name: string;
  attribute_id: [number, string];
  html_color: string | false;
};

export type OdooStockLocation = {
  id: number;
  name: string;
  complete_name: string;
  usage: string;
  location_id: [number, string] | false;
  company_id: [number, string] | false;
};

export type OdooQuant = {
  id: number;
  product_id: [number, string];
  product_tmpl_id: [number, string];
  location_id: [number, string];
  lot_id: [number, string] | false;
  quantity: number;
  reserved_quantity: number;
  available_quantity: number;
  in_date: string | false;
  company_id: [number, string] | false;
};

export type OdooStockMove = {
  id: number;
  name?: string;
  product_id: [number, string];
  location_id: [number, string];
  location_dest_id: [number, string];
  product_qty: number;
  quantity_done?: number;
  state: string;
  date: string;
  origin: string | false;
  picking_id: [number, string] | false;
  company_id: [number, string] | false;
};

export type OdooAllData = {
  products: OdooProduct[];
  variants: OdooVariant[];
  quants: OdooQuant[];
  locations: OdooStockLocation[];
  moves: OdooStockMove[];
  attributeValues: OdooAttributeValue[];
};

// ─── API ─────────────────────────────────────────────────────────────────────

export async function fetchOdooAll(): Promise<OdooAllData> {
  return edgeFetch('all') as Promise<OdooAllData>;
}

export async function fetchOdooProducts(): Promise<OdooProduct[]> {
  return edgeFetch('products') as Promise<OdooProduct[]>;
}

export async function fetchOdooVariants(): Promise<OdooVariant[]> {
  return edgeFetch('variants') as Promise<OdooVariant[]>;
}

export async function fetchOdooQuants(): Promise<OdooQuant[]> {
  return edgeFetch('quants') as Promise<OdooQuant[]>;
}

export async function fetchOdooLocations(): Promise<OdooStockLocation[]> {
  return edgeFetch('locations') as Promise<OdooStockLocation[]>;
}

export async function fetchOdooRecentMoves(): Promise<OdooStockMove[]> {
  return edgeFetch('moves') as Promise<OdooStockMove[]>;
}

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { RefreshCw, AlertTriangle, Package, TrendingUp, TrendingDown, MapPin, Search, ChevronDown, ChevronRight, Wifi, WifiOff, Clock, BarChart2, List, Grid3X3 } from 'lucide-react';
import { ModuleInfo } from '../components/ModuleInfo';
import {
  fetchOdooAll,
  type OdooProduct, type OdooVariant, type OdooQuant, type OdooStockLocation, type OdooStockMove, type OdooAttributeValue,
} from '../lib/odooService';

// ─── Types ────────────────────────────────────────────────────────────────────

type ViewMode = 'products' | 'locations' | 'moves';
type Status = 'idle' | 'loading' | 'ok' | 'error';

type ResolvedAttr = { attrName: string; value: string; color: string | false };

type VariantWithAttrs = OdooVariant & { attrs: ResolvedAttr[] };

type ProductRow = OdooProduct & {
  variants: VariantWithAttrs[];
  quants: OdooQuant[];
};

// ─── Companies ────────────────────────────────────────────────────────────────

const COMPANIES: { id: number; label: string; sub: string }[] = [
  { id: 5,  label: 'BOX PRIME',     sub: 'Box Prime Peru' },
  { id: 8,  label: 'OVERSHARK',     sub: 'Overshark Peru S.A.C.' },
  { id: 11, label: 'BRAVOS URBAN',  sub: 'Bravos Urban Co.' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtQty(n: number) {
  return n.toLocaleString('es-PE', { maximumFractionDigits: 0 });
}
function fmtDate(d: string) {
  return new Date(d).toLocaleString('es-PE', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

// Strips internal reference prefixes from product names (e.g. "[OVER-REF-001] Polo" → "Polo")
function isColorAttr(name: string) { return /color|colour|tono|color\s*tejido/i.test(name); }
function isSizeAttr(name: string)  { return /talla|size|talle|talla\s*tejido/i.test(name); }

function cleanName(raw: string | undefined | false): string {
  if (!raw) return '';
  return raw.replace(/^\[[^\]]*\]\s*/, '').trim();
}
function badge(color: string, text: string) {
  const map: Record<string, string> = {
    green: 'bg-green-100 text-green-800 border-green-300',
    red: 'bg-red-100 text-red-800 border-red-300',
    yellow: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    blue: 'bg-blue-100 text-blue-800 border-blue-300',
    gray: 'bg-[#141414]/5 text-[#141414]/60 border-[#141414]/20',
  };
  return `inline-block font-mono text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 border ${map[color] ?? map.gray}`;
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon: Icon, accent }: { label: string; value: string | number; sub?: string; icon: React.ElementType; accent: string }) {
  return (
    <div className="border border-[#141414] bg-white/40 p-4 flex flex-col gap-2 shadow-[2px_2px_0_#141414]">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[9px] font-bold uppercase tracking-widest opacity-60">{label}</span>
        <Icon size={14} className={accent} />
      </div>
      <span className="font-mono font-black text-2xl text-[#141414]">{value}</span>
      {sub && <span className="font-mono text-[9px] opacity-50 uppercase tracking-wider">{sub}</span>}
    </div>
  );
}

// ─── Product Row ──────────────────────────────────────────────────────────────

const ProductItem: React.FC<{ row: ProductRow }> = ({ row }) => {
  const [open, setOpen] = useState(false);
  const totalQty = row.qty_available;
  const reserved = row.quants.reduce((s, q) => s + q.reserved_quantity, 0);
  const available = totalQty - reserved;

  return (
    <div className="border-b border-[#141414]/10 last:border-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/50 transition-colors text-left"
      >
        <span className="text-[#141414]/40">{open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono font-bold text-[11px] text-[#141414] truncate">{cleanName(row.name)}</span>
            {row.default_code && (
              <span className="font-mono text-[9px] opacity-50">[{row.default_code}]</span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="font-mono text-[9px] opacity-50 uppercase">{row.categ_id[1]}</span>
            {row.variants.length > 0 && (
              <span className={badge('blue', `${row.variants.length} var.`)} />
            )}
          </div>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <div className="text-right hidden sm:block">
            <div className="font-mono font-black text-sm text-[#141414]">{fmtQty(totalQty)}</div>
            <div className="font-mono text-[9px] opacity-40 uppercase">stock</div>
          </div>
          <div className="text-right hidden md:block">
            <div className={`font-mono font-bold text-sm ${available > 0 ? 'text-green-700' : 'text-red-600'}`}>
              {fmtQty(available)}
            </div>
            <div className="font-mono text-[9px] opacity-40 uppercase">disponible</div>
          </div>
          {reserved > 0 && (
            <div className="text-right hidden lg:block">
              <div className="font-mono font-bold text-sm text-yellow-700">{fmtQty(reserved)}</div>
              <div className="font-mono text-[9px] opacity-40 uppercase">reservado</div>
            </div>
          )}
          <span className={badge(totalQty === 0 ? 'red' : available > 0 ? 'green' : 'yellow',
            totalQty === 0 ? 'sin stock' : available > 0 ? 'disponible' : 'reservado'
          )} />
        </div>
      </button>

      {open && (
        <div className="bg-[#141414]/3 border-t border-[#141414]/10 px-4 pb-3 pt-2">
          {row.variants.length > 0 ? (
            <div>
              <div className="font-mono text-[9px] font-bold uppercase tracking-widest opacity-50 mb-2">Variantes ({row.variants.length})</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {row.variants.map(v => {
                  const colorAttr = v.attrs.find(a => isColorAttr(a.attrName));
                  const sizeAttr  = v.attrs.find(a => isSizeAttr(a.attrName));
                  const otherAttrs = v.attrs.filter(a => a !== colorAttr && a !== sizeAttr);
                  return (
                    <div key={v.id} className={`border bg-white/60 px-3 py-2 flex items-center justify-between gap-2 ${v.qty_available > 0 ? 'border-[#141414]/20' : 'border-[#141414]/10 opacity-50'}`}>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap mb-1">
                          {colorAttr && (
                            <div className="flex items-center gap-1">
                              {colorAttr.color ? (
                                <span
                                  className="w-3 h-3 rounded-full border border-[#141414]/20 shrink-0"
                                  style={{ backgroundColor: colorAttr.color }}
                                />
                              ) : null}
                              <span className="font-mono text-[10px] font-bold text-[#141414]">{colorAttr.value}</span>
                            </div>
                          )}
                          {colorAttr && sizeAttr && <span className="font-mono text-[9px] opacity-30">/</span>}
                          {sizeAttr && (
                            <span className="font-mono text-[10px] font-bold text-[#141414] border border-[#141414]/30 px-1.5 py-0.5 leading-none">{sizeAttr.value}</span>
                          )}
                          {otherAttrs.map(a => (
                            <span key={a.attrName} className="font-mono text-[9px] opacity-60">{a.value}</span>
                          ))}
                          {v.attrs.length === 0 && (
                            <span className="font-mono text-[9px] opacity-40 italic">sin atributos</span>
                          )}
                        </div>
                        {v.default_code && <div className="font-mono text-[9px] opacity-30">{v.default_code}</div>}
                      </div>
                      <div className="text-right shrink-0">
                        <div className={`font-mono font-black text-sm ${v.qty_available > 0 ? 'text-green-700' : 'text-red-500'}`}>
                          {fmtQty(v.qty_available)}
                        </div>
                        <div className="font-mono text-[9px] opacity-40">uds</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div>
              <div className="font-mono text-[9px] font-bold uppercase tracking-widest opacity-50 mb-2">Ubicaciones en stock</div>
              {row.quants.length === 0 ? (
                <span className="font-mono text-[9px] opacity-40">Sin registros de stock</span>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {row.quants.map(q => (
                    <div key={q.id} className="border border-[#141414]/20 bg-white/60 px-2 py-1.5 flex items-center gap-2">
                      <MapPin size={10} className="opacity-40 shrink-0" />
                      <span className="font-mono text-[9px] text-[#141414]">{q.location_id[1]}</span>
                      <span className="font-mono font-bold text-[10px] text-green-700">{fmtQty(q.quantity)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export const OdooStock: React.FC = () => {
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);

  const [products, setProducts] = useState<OdooProduct[]>([]);
  const [variants, setVariants] = useState<OdooVariant[]>([]);
  const [quants, setQuants] = useState<OdooQuant[]>([]);
  const [locations, setLocations] = useState<OdooStockLocation[]>([]);
  const [moves, setMoves] = useState<OdooStockMove[]>([]);
  const [attrMap, setAttrMap] = useState<Map<number, OdooAttributeValue>>(new Map());

  const [view, setView] = useState<ViewMode>('products');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [stockFilter, setStockFilter] = useState<'all' | 'in' | 'out'>('all');
  const [companyFilter, setCompanyFilter] = useState<number | 'ALL'>('ALL');
  const [colorFilter, setColorFilter] = useState('ALL');
  const [sizeFilter, setSizeFilter] = useState('ALL');

  const load = useCallback(async () => {
    setStatus('loading');
    setError(null);
    try {
      const { products: prods, variants: vars, quants: qts, locations: locs, moves: mvs, attributeValues: attrVals } = await fetchOdooAll();
      setProducts(prods);
      setVariants(vars);
      setQuants(qts);
      setLocations(locs);
      setMoves(mvs);
      const map = new Map<number, OdooAttributeValue>();
      attrVals.forEach(av => map.set(av.id, av));
      setAttrMap(map);
      setLastFetch(new Date());
      setStatus('ok');
    } catch (e) {
      setError((e as Error).message);
      setStatus('error');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Derived data ──────────────────────────────────────────────────────────

  const productRows = useMemo<ProductRow[]>(() => {
    return products.map(p => ({
      ...p,
      variants: variants
        .filter(v => v.product_tmpl_id[0] === p.id)
        .map(v => ({
          ...v,
          attrs: (v.product_template_attribute_value_ids ?? [])
            .map(id => attrMap.get(id))
            .filter((av): av is OdooAttributeValue => !!av)
            .map(av => ({
              attrName: av.attribute_id[1],
              value: av.name,
              color: av.html_color,
            })),
        })),
      quants: quants.filter(q => q.product_tmpl_id[0] === p.id),
    }));
  }, [products, variants, quants, attrMap]);

  const categories = useMemo(() => {
    const cats = [...new Set(products.map(p => p.categ_id[1]))].sort();
    return cats;
  }, [products]);

  // Collect all distinct attribute names to help debug what Odoo sends
  const allAttrNames = useMemo(() => {
    const set = new Set<string>();
    productRows.forEach(r => r.variants.forEach(v => v.attrs.forEach(a => set.add(a.attrName))));
    return [...set].sort();
  }, [productRows]);

  const allColors = useMemo(() => {
    const set = new Set<string>();
    productRows.forEach(r => r.variants.forEach(v => {
      v.attrs.forEach(a => { if (isColorAttr(a.attrName)) set.add(a.value.trim()); });
    }));
    return [...set].sort();
  }, [productRows]);

  const allSizes = useMemo(() => {
    const set = new Set<string>();
    productRows.forEach(r => r.variants.forEach(v => {
      v.attrs.forEach(a => { if (isSizeAttr(a.attrName)) set.add(a.value.trim()); });
    }));
    return [...set].sort();
  }, [productRows]);

  const filteredRows = useMemo(() => {
    const q = search.toLowerCase().trim();
    return productRows.filter(r => {
      if (companyFilter !== 'ALL') {
        const cid = r.company_id ? r.company_id[0] : null;
        if (cid !== companyFilter) return false;
      }
      if (categoryFilter !== 'ALL' && r.categ_id[1] !== categoryFilter) return false;
      if (stockFilter === 'in' && r.qty_available <= 0) return false;
      if (stockFilter === 'out' && r.qty_available > 0) return false;
      if (colorFilter !== 'ALL') {
        const hasColor = r.variants.some(v =>
          v.attrs.some(a => isColorAttr(a.attrName) && a.value.trim() === colorFilter)
        );
        if (!hasColor) return false;
      }
      if (sizeFilter !== 'ALL') {
        const hasSize = r.variants.some(v =>
          v.attrs.some(a => isSizeAttr(a.attrName) && a.value.trim() === sizeFilter)
        );
        if (!hasSize) return false;
      }
      if (!q) return true;
      const name = cleanName(r.name);
      return (
        name.toLowerCase().includes(q) ||
        (r.default_code ?? '').toLowerCase().includes(q) ||
        r.categ_id[1].toLowerCase().includes(q)
      );
    });
  }, [productRows, search, categoryFilter, stockFilter, companyFilter, colorFilter, sizeFilter]);

  const stats = useMemo(() => {
    const totalSKUs = products.length;
    const inStock = products.filter(p => p.qty_available > 0).length;
    const outOfStock = products.filter(p => p.qty_available <= 0).length;
    const totalUnits = products.reduce((s, p) => s + p.qty_available, 0);
    const totalValue = quants.reduce((s, q) => {
      const prod = products.find(p => p.id === q.product_tmpl_id[0]);
      return s + (prod?.standard_price ?? 0) * q.quantity;
    }, 0);
    return { totalSKUs, inStock, outOfStock, totalUnits, totalValue };
  }, [products, quants]);

  // ── Location view data ────────────────────────────────────────────────────

  const locationRows = useMemo(() => {
    return locations.map(loc => {
      const locQuants = quants.filter(q => q.location_id[0] === loc.id);
      const totalQty = locQuants.reduce((s, q) => s + q.quantity, 0);
      const skus = new Set(locQuants.map(q => q.product_id[0])).size;
      return { ...loc, totalQty, skus, quants: locQuants };
    }).filter(l => l.totalQty > 0).sort((a, b) => b.totalQty - a.totalQty);
  }, [locations, quants]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-8">
      <ModuleInfo
        number="17"
        title="Odoo Stock"
        description="Inventario en tiempo real desde Odoo ERP. Muestra cantidades, variantes, ubicaciones y movimientos recientes del almacén zazuexpress2."
      />

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="border-b border-[#141414] pb-2 flex-1 min-w-0">
          <h2 className="font-serif italic font-bold text-xs uppercase tracking-widest">17 // ODOO_STOCK_LIVE</h2>
          <p className="font-mono text-[10px] opacity-70 uppercase tracking-wide mt-1">Conexión directa a zazuexpress2.odoo.com</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {lastFetch && (
            <div className="flex items-center gap-1 font-mono text-[9px] opacity-50 uppercase">
              <Clock size={10} />
              {fmtDate(lastFetch.toISOString())}
            </div>
          )}
          <div className="flex items-center gap-1 font-mono text-[9px] font-bold uppercase">
            {status === 'ok' ? (
              <><Wifi size={11} className="text-green-600" /><span className="text-green-700">Conectado</span></>
            ) : status === 'error' ? (
              <><WifiOff size={11} className="text-red-600" /><span className="text-red-700">Error</span></>
            ) : (
              <><RefreshCw size={11} className="animate-spin opacity-50" /><span className="opacity-50">Cargando…</span></>
            )}
          </div>
          <button
            onClick={load}
            disabled={status === 'loading'}
            className="flex items-center gap-1.5 border border-[#141414] px-3 py-1.5 font-mono text-[9px] font-bold uppercase tracking-widest hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors disabled:opacity-40 shadow-[2px_2px_0_#141414]"
          >
            <RefreshCw size={10} className={status === 'loading' ? 'animate-spin' : ''} />
            Actualizar
          </button>
        </div>
      </div>

      {/* Error */}
      {status === 'error' && error && (
        <div className="border border-red-400 bg-red-50 px-4 py-3 flex items-start gap-3 shadow-[2px_2px_0_#dc2626]">
          <AlertTriangle size={16} className="text-red-600 shrink-0 mt-0.5" />
          <div>
            <div className="font-mono font-bold text-[10px] uppercase text-red-700 tracking-wider">Error de conexión Odoo</div>
            <div className="font-mono text-[10px] text-red-600 mt-0.5">{error}</div>
          </div>
        </div>
      )}

      {/* Stats */}
      {status === 'ok' && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="SKUs totales" value={stats.totalSKUs} sub={`${stats.inStock} con stock`} icon={Package} accent="text-[#141414]" />
          <StatCard label="Unidades" value={fmtQty(stats.totalUnits)} sub="en almacén" icon={BarChart2} accent="text-blue-600" />
          <StatCard label="Con stock" value={stats.inStock} sub={`${stats.outOfStock} sin stock`} icon={TrendingUp} accent="text-green-600" />
          <StatCard label="Sin stock" value={stats.outOfStock} sub="productos agotados" icon={TrendingDown} accent="text-red-600" />
        </div>
      )}

      {/* View Tabs */}
      {status === 'ok' && (
        <div>
          <div className="flex border-b border-[#141414] mb-4">
            {([
              { id: 'products', label: 'Productos', icon: List },
              { id: 'locations', label: 'Ubicaciones', icon: MapPin },
              { id: 'moves', label: 'Movimientos', icon: Grid3X3 },
            ] as { id: ViewMode; label: string; icon: React.ElementType }[]).map(tab => (
              <button
                key={tab.id}
                onClick={() => setView(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-2 font-mono text-[9px] font-bold uppercase tracking-widest border-b-2 transition-colors ${
                  view === tab.id
                    ? 'border-[#141414] text-[#141414]'
                    : 'border-transparent opacity-50 hover:opacity-80'
                }`}
              >
                <tab.icon size={11} />
                {tab.label}
              </button>
            ))}
          </div>

          {/* ── Products View ── */}
          {view === 'products' && (
            <div className="flex flex-col gap-3">
              {/* Company selector */}
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => setCompanyFilter('ALL')}
                  className={`px-4 py-2 font-mono text-[9px] font-bold uppercase tracking-widest border transition-colors shadow-[2px_2px_0_#141414] ${
                    companyFilter === 'ALL'
                      ? 'bg-[#141414] text-[#E4E3E0] border-[#141414]'
                      : 'border-[#141414] bg-white/60 opacity-60 hover:opacity-100'
                  }`}
                >
                  Todas
                </button>
                {COMPANIES.map(c => (
                  <button
                    key={c.id}
                    onClick={() => setCompanyFilter(c.id)}
                    className={`px-4 py-2 font-mono text-[9px] font-bold uppercase tracking-widest border transition-colors shadow-[2px_2px_0_#141414] ${
                      companyFilter === c.id
                        ? 'bg-[#141414] text-[#E4E3E0] border-[#141414]'
                        : 'border-[#141414] bg-white/60 opacity-60 hover:opacity-100'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>

              {/* Debug: attribute names from Odoo (remove once filters are confirmed) */}
              {allAttrNames.length > 0 && (
                <div className="flex flex-wrap gap-1 items-center">
                  <span className="font-mono text-[8px] opacity-40 uppercase tracking-widest">Atributos Odoo:</span>
                  {allAttrNames.map(n => (
                    <span key={n} className={`font-mono text-[8px] px-1.5 py-0.5 border ${isColorAttr(n) ? 'border-blue-400 text-blue-700 bg-blue-50' : isSizeAttr(n) ? 'border-green-400 text-green-700 bg-green-50' : 'border-[#141414]/20 opacity-40'}`}>
                      {n}
                    </span>
                  ))}
                </div>
              )}

              {/* Filters */}
              <div className="flex flex-wrap gap-2 items-center">
                <div className="flex items-center gap-1.5 border border-[#141414] px-2 py-1.5 bg-white/60 flex-1 min-w-[180px] max-w-xs">
                  <Search size={11} className="opacity-40 shrink-0" />
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar producto o código…"
                    className="font-mono text-[10px] bg-transparent outline-none w-full placeholder:opacity-40"
                  />
                </div>
                <select
                  value={categoryFilter}
                  onChange={e => setCategoryFilter(e.target.value)}
                  className="border border-[#141414] px-2 py-1.5 font-mono text-[9px] font-bold uppercase bg-white/60 outline-none focus:shadow-[2px_2px_0_#141414] cursor-pointer"
                >
                  <option value="ALL">Todas las categorías</option>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select
                  value={colorFilter}
                  onChange={e => setColorFilter(e.target.value)}
                  className="border border-[#141414] px-2 py-1.5 font-mono text-[9px] font-bold uppercase bg-white/60 outline-none focus:shadow-[2px_2px_0_#141414] cursor-pointer"
                >
                  <option value="ALL">Todos los colores</option>
                  {allColors.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select
                  value={sizeFilter}
                  onChange={e => setSizeFilter(e.target.value)}
                  className="border border-[#141414] px-2 py-1.5 font-mono text-[9px] font-bold uppercase bg-white/60 outline-none focus:shadow-[2px_2px_0_#141414] cursor-pointer"
                >
                  <option value="ALL">Todas las tallas</option>
                  {allSizes.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <div className="flex border border-[#141414]">
                  {([
                    { val: 'all', label: 'Todos' },
                    { val: 'in', label: 'Con stock' },
                    { val: 'out', label: 'Sin stock' },
                  ] as { val: typeof stockFilter; label: string }[]).map(opt => (
                    <button
                      key={opt.val}
                      onClick={() => setStockFilter(opt.val)}
                      className={`px-3 py-1.5 font-mono text-[9px] font-bold uppercase tracking-wider transition-colors ${
                        stockFilter === opt.val ? 'bg-[#141414] text-[#E4E3E0]' : 'hover:bg-white/60'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <span className="font-mono text-[9px] opacity-40 ml-auto">{filteredRows.length} resultado{filteredRows.length !== 1 ? 's' : ''}</span>
              </div>

              {/* Table */}
              <div className="border border-[#141414] shadow-[3px_3px_0_#141414] overflow-hidden">
                <div className="flex items-center px-4 py-2 bg-[#141414] text-[#E4E3E0]">
                  <div className="flex-1 font-mono text-[9px] font-bold uppercase tracking-widest">Producto</div>
                  <div className="font-mono text-[9px] font-bold uppercase tracking-widest w-20 text-right hidden sm:block">Stock</div>
                  <div className="font-mono text-[9px] font-bold uppercase tracking-widest w-20 text-right hidden md:block">Disponible</div>
                  <div className="font-mono text-[9px] font-bold uppercase tracking-widest w-20 text-right hidden lg:block">Reservado</div>
                  <div className="font-mono text-[9px] font-bold uppercase tracking-widest w-20 text-right">Estado</div>
                </div>
                {filteredRows.length === 0 ? (
                  <div className="px-4 py-8 text-center font-mono text-[10px] opacity-40 uppercase">Sin resultados</div>
                ) : (
                  filteredRows.map(row => <ProductItem key={row.id} row={row} />)
                )}
              </div>
            </div>
          )}

          {/* ── Locations View ── */}
          {view === 'locations' && (
            <div className="border border-[#141414] shadow-[3px_3px_0_#141414] overflow-hidden">
              <div className="flex items-center px-4 py-2 bg-[#141414] text-[#E4E3E0]">
                <div className="flex-1 font-mono text-[9px] font-bold uppercase tracking-widest">Ubicación</div>
                <div className="font-mono text-[9px] font-bold uppercase tracking-widest w-16 text-right">SKUs</div>
                <div className="font-mono text-[9px] font-bold uppercase tracking-widest w-20 text-right">Unidades</div>
              </div>
              {locationRows.length === 0 ? (
                <div className="px-4 py-8 text-center font-mono text-[10px] opacity-40 uppercase">Sin ubicaciones con stock</div>
              ) : locationRows.map(loc => (
                <div key={loc.id} className="flex items-center gap-3 px-4 py-3 border-b border-[#141414]/10 last:border-0 hover:bg-white/50 transition-colors">
                  <MapPin size={13} className="opacity-40 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-mono font-bold text-[11px] text-[#141414] truncate">{loc.complete_name}</div>
                    <div className="font-mono text-[9px] opacity-40 uppercase">{loc.usage}</div>
                  </div>
                  <div className="font-mono font-bold text-[11px] text-[#141414] w-16 text-right">{loc.skus}</div>
                  <div className="font-mono font-black text-sm text-green-700 w-20 text-right">{fmtQty(loc.totalQty)}</div>
                </div>
              ))}
            </div>
          )}

          {/* ── Moves View ── */}
          {view === 'moves' && (
            <div className="border border-[#141414] shadow-[3px_3px_0_#141414] overflow-hidden">
              <div className="flex items-center px-4 py-2 bg-[#141414] text-[#E4E3E0]">
                <div className="flex-1 font-mono text-[9px] font-bold uppercase tracking-widest">Producto</div>
                <div className="font-mono text-[9px] font-bold uppercase tracking-widest flex-1 hidden md:block">Origen → Destino</div>
                <div className="font-mono text-[9px] font-bold uppercase tracking-widest w-16 text-right">Cantidad</div>
                <div className="font-mono text-[9px] font-bold uppercase tracking-widest w-28 text-right hidden sm:block">Fecha</div>
              </div>
              {moves.length === 0 ? (
                <div className="px-4 py-8 text-center font-mono text-[10px] opacity-40 uppercase">Sin movimientos recientes</div>
              ) : moves.map(m => (
                <div key={m.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-[#141414]/10 last:border-0 hover:bg-white/50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="font-mono font-bold text-[10px] text-[#141414] truncate">{m.product_id[1]}</div>
                    {m.origin && <div className="font-mono text-[9px] opacity-40 truncate">{m.origin}</div>}
                  </div>
                  <div className="flex-1 hidden md:flex items-center gap-1 font-mono text-[9px] opacity-60 truncate">
                    <span className="truncate">{m.location_id[1]}</span>
                    <span className="opacity-40 shrink-0">→</span>
                    <span className="truncate">{m.location_dest_id[1]}</span>
                  </div>
                  <div className="font-mono font-black text-sm text-[#141414] w-16 text-right">{fmtQty(m.quantity_done ?? m.product_qty)}</div>
                  <div className="font-mono text-[9px] opacity-50 w-28 text-right hidden sm:block">{fmtDate(m.date)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Loading skeleton */}
      {status === 'loading' && (
        <div className="flex flex-col gap-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="border border-[#141414]/20 h-12 bg-white/30 animate-pulse" style={{ animationDelay: `${i * 0.08}s` }} />
          ))}
        </div>
      )}
    </div>
  );
};

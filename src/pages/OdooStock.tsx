import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { RefreshCw, AlertTriangle, Package, TrendingUp, TrendingDown, MapPin, Search, ChevronDown, ChevronRight, Wifi, WifiOff, Clock, BarChart2, List, Grid3X3, X, SlidersHorizontal } from 'lucide-react';
import { ModuleInfo } from '../components/ModuleInfo';
import {
  fetchOdooAll,
  type OdooProduct, type OdooVariant, type OdooQuant, type OdooStockLocation, type OdooStockMove, type OdooAttributeValue,
} from '../lib/odooService';
import { TutorialModal, ODOO_STOCK_TUTORIAL_STEPS } from '../components/TutorialModal';

// --- Types --------------------------------------------------------------------

type ViewMode = 'products' | 'locations' | 'moves';
type Status = 'idle' | 'loading' | 'ok' | 'error';
type StockAlert = 'all' | 'over' | 'low' | 'critical';
type StockPresence = 'all' | 'with' | 'without';

type ResolvedAttr = { attrName: string; value: string; color: string | false };
type VariantWithAttrs = OdooVariant & { attrs: ResolvedAttr[] };
type ProductRow = OdooProduct & { variants: VariantWithAttrs[]; quants: OdooQuant[] };

// --- Helpers -----------------------------------------------------------------

function fmtQty(n: number) { return n.toLocaleString('es-PE', { maximumFractionDigits: 0 }); }
function fmtDate(d: string) {
  return new Date(d).toLocaleString('es-PE', { timeZone: 'America/Lima', day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}
function isColorAttr(name: string) { return /color|colour|tono|color\s*tejido/i.test(name); }
function isSizeAttr(name: string)  { return /talla|size|talle|talla\s*tejido/i.test(name); }
function cleanName(raw: string | undefined | false): string {
  if (!raw) return '';
  return raw.replace(/^\[[^\]]*\]\s*/, '').trim();
}

const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', '3XL', 'TALLA UNICA', 'TALLA ÚNICA', '(TALLA UNICA)'];
function sizeRank(value: string): number {
  const idx = SIZE_ORDER.indexOf(value.trim().toUpperCase());
  return idx === -1 ? SIZE_ORDER.length : idx;
}

/** Ordena las variantes de un producto por color y luego por talla (XS→3XL). */
function sortVariants(vars: VariantWithAttrs[]): VariantWithAttrs[] {
  return [...vars].sort((a, b) => {
    const colorA = a.attrs.find(x => isColorAttr(x.attrName))?.value ?? '';
    const colorB = b.attrs.find(x => isColorAttr(x.attrName))?.value ?? '';
    const colorCmp = colorA.localeCompare(colorB);
    if (colorCmp !== 0) return colorCmp;
    const sizeA = a.attrs.find(x => isSizeAttr(x.attrName))?.value ?? '';
    const sizeB = b.attrs.find(x => isSizeAttr(x.attrName))?.value ?? '';
    return sizeRank(sizeA) - sizeRank(sizeB);
  });
}

interface ColorGroup {
  colorLabel: string;
  colorSwatch: string | false;
  variants: VariantWithAttrs[];
}

/** Agrupa las variantes (ya ordenadas) por color, para mostrar sus tallas juntas en una fila. */
function groupVariantsByColor(vars: VariantWithAttrs[]): ColorGroup[] {
  const map = new Map<string, ColorGroup>();
  for (const v of vars) {
    const colorAttr = v.attrs.find(a => isColorAttr(a.attrName));
    const key = colorAttr?.value ?? 'Sin color';
    if (!map.has(key)) map.set(key, { colorLabel: key, colorSwatch: colorAttr?.color ?? false, variants: [] });
    map.get(key)!.variants.push(v);
  }
  return [...map.values()];
}
function badge(color: string, text: string) {
  const map: Record<string, string> = {
    green: 'bg-green-500/15 text-green-600 border-green-500/50',
    red: 'bg-red-500/15 text-red-600 border-red-500/50',
    yellow: 'bg-yellow-500/15 text-yellow-600 border-yellow-500/50',
    blue: 'bg-blue-500/15 text-blue-600 border-blue-500/50',
    gray: 'bg-[var(--ink)]/5 text-[var(--ink)]/60 border-[var(--border)]/20',
  };
  return `inline-block font-mono text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 border ${map[color] ?? map.gray}`;
}

// --- Stat Card ----------------------------------------------------------------

function StatCard({ label, value, sub, icon: Icon, accent }: { label: string; value: string | number; sub?: string; icon: React.ElementType; accent: string }) {
  return (
    <div className="border border-[var(--border)] bg-[var(--bg-card)] p-4 flex flex-col gap-2 shadow-[2px_2px_0_var(--border)]">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[9px] font-bold uppercase tracking-widest" style={{ color: 'var(--ink)', opacity: 0.65 }}>{label}</span>
        <Icon size={14} className={accent} />
      </div>
      <span className="font-mono font-black text-2xl text-[var(--ink)]">{value}</span>
      {sub && <span className="font-mono text-[9px] font-semibold uppercase tracking-wider" style={{ color: 'var(--ink)', opacity: 0.55 }}>{sub}</span>}
    </div>
  );
}

// --- Filter Section (colapsable) ----------------------------------------------

const FilterSection: React.FC<{ title: string; children: React.ReactNode; defaultOpen?: boolean }> = ({ title, children, defaultOpen = true }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-[var(--border)] last:border-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-[var(--ink)]/5 transition-colors"
      >
        <span className="font-mono text-[9px] font-bold uppercase tracking-widest" style={{ color: 'var(--ink)', opacity: 0.7 }}>{title}</span>
        <ChevronDown size={12} className={`transition-transform ${open ? '' : '-rotate-90'}`} style={{ color: 'var(--ink)', opacity: 0.5 }} />
      </button>
      {open && <div className="px-4 pb-3">{children}</div>}
    </div>
  );
};

// --- Variant alert dot --------------------------------------------------------

function VariantAlertDot({ qty }: { qty: number }) {
  const OVER = 200, LOW_MAX = 80, LOW_MIN = 50, CRITICAL = 50;
  if (qty > OVER)                       return <span title="Sobre stock"  className="w-2 h-2 rounded-full bg-green-500 shrink-0" />;
  if (qty >= LOW_MIN && qty <= LOW_MAX) return <span title="Por acabar"   className="w-2 h-2 rounded-full bg-yellow-400 shrink-0" />;
  if (qty > 0 && qty < CRITICAL)        return <span title="Stock crítico" className="w-2 h-2 rounded-full bg-red-500 shrink-0 animate-pulse" />;
  if (qty === 0)                         return <span title="Sin stock"    className="w-2 h-2 rounded-full bg-[var(--ink)]/20 shrink-0" />;
  return null;
}

// --- Product Row --------------------------------------------------------------

const ProductItem: React.FC<{ row: ProductRow }> = ({ row }) => {
  const [open, setOpen] = useState(false);
  const totalQty = row.qty_available;
  const reserved = row.quants.reduce((s, q) => s + q.reserved_quantity, 0);
  const available = totalQty - reserved;

  return (
    <div className="border-b border-[var(--border)] last:border-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex flex-col gap-2 px-4 py-3 hover:bg-[var(--surface)] transition-colors text-left"
      >
        {/* Row 1: identity */}
        <div className="flex items-center gap-2.5">
          <span style={{ color: 'var(--ink)', opacity: 0.5 }} className="shrink-0">{open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}</span>
          <span className="font-mono font-bold text-[12px] truncate" style={{ color: 'var(--ink)' }}>{cleanName(row.name)}</span>
          {row.default_code && (
            <span className="font-mono text-[9px] font-semibold shrink-0" style={{ color: 'var(--ink)', opacity: 0.55 }}>[{row.default_code}]</span>
          )}
          <span className="h-px flex-1 bg-[var(--border-soft)] hidden sm:block" />
          <span className={badge(
            totalQty === 0 ? 'red' : available > 0 ? 'green' : 'yellow',
            totalQty === 0 ? 'sin stock' : available > 0 ? 'disponible' : 'reservado'
          )} />
        </div>

        {/* Row 2: category + variant alert summary + metrics */}
        <div className="flex items-center gap-3 flex-wrap pl-[21px]">
          <span className="font-mono text-[9px] font-semibold uppercase shrink-0" style={{ color: 'var(--ink)', opacity: 0.55 }}>{row.categ_id[1]}</span>
          {row.variants.length > 0 && <span className={badge('blue', `${row.variants.length} var.`)} />}
          {row.variants.length > 0 && (() => {
            const OVER = 200, LOW_MAX = 80, LOW_MIN = 50, CRITICAL = 50;
            const critical = row.variants.filter(v => v.qty_available > 0 && v.qty_available < CRITICAL).length;
            const low      = row.variants.filter(v => v.qty_available >= LOW_MIN && v.qty_available <= LOW_MAX).length;
            const over     = row.variants.filter(v => v.qty_available > OVER).length;
            return (
              <span className="flex items-center gap-2 shrink-0">
                {critical > 0 && <span className="flex items-center gap-1 font-mono text-[9px] text-red-700 font-bold"><span className="w-1.5 h-1.5 rounded-full bg-red-500" />{critical}</span>}
                {low      > 0 && <span className="flex items-center gap-1 font-mono text-[9px] text-yellow-700 font-bold"><span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />{low}</span>}
                {over     > 0 && <span className="flex items-center gap-1 font-mono text-[9px] text-green-700 font-bold"><span className="w-1.5 h-1.5 rounded-full bg-green-500" />{over}</span>}
              </span>
            );
          })()}

          <div className="flex items-center gap-4 ml-auto shrink-0">
            <div className="text-right hidden sm:block">
              <div className="font-mono font-black text-sm" style={{ color: 'var(--ink)' }}>{fmtQty(totalQty)}</div>
              <div className="font-mono text-[8px] font-bold uppercase" style={{ color: 'var(--ink)', opacity: 0.5 }}>a la mano</div>
            </div>
            <div className="text-right hidden md:block">
              <div className={`font-mono font-bold text-sm ${available > 0 ? 'text-green-700' : 'text-red-600'}`}>{fmtQty(available)}</div>
              <div className="font-mono text-[8px] font-bold uppercase" style={{ color: 'var(--ink)', opacity: 0.5 }}>disponible</div>
            </div>
            {reserved > 0 && (
              <div className="text-right hidden lg:block">
                <div className="font-mono font-bold text-sm text-yellow-700">{fmtQty(reserved)}</div>
                <div className="font-mono text-[8px] font-bold uppercase" style={{ color: 'var(--ink)', opacity: 0.5 }}>reservado</div>
              </div>
            )}
          </div>
        </div>
      </button>

      {open && (
        <div className="bg-[var(--surface-alt)] border-t border-[var(--border)] px-4 pb-4 pt-3">
          {row.variants.length > 0 ? (
            <div className="flex flex-col gap-3">
              <div className="font-mono text-[9px] font-bold uppercase tracking-widest" style={{ color: 'var(--ink)', opacity: 0.6 }}>Variantes ({row.variants.length})</div>
              {groupVariantsByColor(row.variants).map(cg => {
                const hasSizes = cg.variants.some(v => v.attrs.some(a => isSizeAttr(a.attrName)));
                return (
                  <div key={cg.colorLabel} className="border border-[var(--border)] bg-[var(--bg-card)]">
                    <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border-soft)]">
                      {cg.colorSwatch && <span className="w-3 h-3 rounded-full border border-[var(--border)] shrink-0" style={{ backgroundColor: cg.colorSwatch }} />}
                      <span className="font-mono text-[10px] font-bold" style={{ color: 'var(--ink)' }}>{cg.colorLabel}</span>
                      <span className="h-px flex-1 bg-[var(--border-soft)]" />
                      <span className="font-mono text-[9px] font-semibold" style={{ color: 'var(--ink)', opacity: 0.5 }}>{cg.variants.length} talla{cg.variants.length !== 1 ? 's' : ''}</span>
                    </div>
                    <div className={hasSizes ? 'flex flex-wrap gap-2 p-2.5' : 'flex flex-col gap-2 p-2.5'}>
                      {cg.variants.map(v => {
                        const sizeAttr   = v.attrs.find(a => isSizeAttr(a.attrName));
                        const colorAttr  = v.attrs.find(a => isColorAttr(a.attrName));
                        const otherAttrs = v.attrs.filter(a => a !== colorAttr && a !== sizeAttr);
                        return (
                          <div key={v.id} className={`border px-2.5 py-2 flex items-center gap-2 ${v.qty_available > 0 ? 'border-[var(--border-soft)] bg-[var(--surface)]' : 'border-[var(--border-soft)] bg-[var(--surface)] opacity-55'} ${hasSizes ? 'shrink-0' : ''}`}>
                            <VariantAlertDot qty={v.qty_available} />
                            {sizeAttr ? (
                              <span className="font-mono text-[10px] font-bold min-w-[24px] text-center" style={{ color: 'var(--ink)' }}>{sizeAttr.value}</span>
                            ) : (
                              otherAttrs.map(a => <span key={a.attrName} className="font-mono text-[9px] font-semibold" style={{ color: 'var(--ink)', opacity: 0.7 }}>{a.value}</span>)
                            )}
                            <span className={`font-mono font-black text-[11px] ${v.qty_available > 0 ? 'text-green-700' : 'text-red-500'}`}>{fmtQty(v.qty_available)}</span>
                          </div>
                        );
                      })}
                    </div>
                    {cg.variants.some(v => v.default_code) && (
                      <div className="px-2.5 pb-2 flex flex-wrap gap-x-3 gap-y-0.5">
                        {cg.variants.filter(v => v.default_code).map(v => (
                          <span key={v.id} className="font-mono text-[8px]" style={{ color: 'var(--ink)', opacity: 0.4 }}>{v.default_code}</span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div>
              <div className="font-mono text-[9px] font-bold uppercase tracking-widest mb-2.5" style={{ color: 'var(--ink)', opacity: 0.6 }}>Ubicaciones en stock</div>
              {row.quants.length === 0 ? (
                <span className="font-mono text-[9px]" style={{ color: 'var(--ink)', opacity: 0.45 }}>Sin registros de stock</span>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {row.quants.map(q => (
                    <div key={q.id} className="border border-[var(--border)] bg-[var(--bg-card)] px-2.5 py-1.5 flex items-center gap-2">
                      <MapPin size={10} className="shrink-0" style={{ color: 'var(--ink)', opacity: 0.5 }} />
                      <span className="font-mono text-[10px] font-semibold" style={{ color: 'var(--ink)' }}>{q.location_id[1]}</span>
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

// --- Main Page ----------------------------------------------------------------

export const OdooStock: React.FC = () => {
  const [status, setStatus]       = useState<Status>('idle');
  const [error, setError]         = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);

  const [products,  setProducts]  = useState<OdooProduct[]>([]);
  const [variants,  setVariants]  = useState<OdooVariant[]>([]);
  const [quants,    setQuants]    = useState<OdooQuant[]>([]);
  const [locations, setLocations] = useState<OdooStockLocation[]>([]);
  const [moves,     setMoves]     = useState<OdooStockMove[]>([]);
  const [attrMap,   setAttrMap]   = useState<Map<number, OdooAttributeValue>>(new Map());

  const [view, setView] = useState<ViewMode>('products');
  const [showTutorial, setShowTutorial] = useState(false);

  // -- Filter state ----------------------------------------------------------
  const [sidebarOpen, setSidebarOpen]           = useState(true);
  const [alertFilter, setAlertFilter]           = useState<StockAlert>('all');
  const [stockPresence, setStockPresence]       = useState<StockPresence>('all');
  const [companyFilter, setCompanyFilter]       = useState<Set<number>>(new Set());
  const [productSearch, setProductSearch]       = useState('');
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [colorSearch, setColorSearch]           = useState('');
  const [selectedColors, setSelectedColors]     = useState<Set<string>>(new Set());
  const [sizeSearch, setSizeSearch]             = useState('');
  const [selectedSizes, setSelectedSizes]       = useState<Set<string>>(new Set());
  const [search, setSearch]                     = useState('');

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

  // -- Derived data ----------------------------------------------------------

  const productRows = useMemo<ProductRow[]>(() => {
    return products.map(p => ({
      ...p,
      variants: sortVariants(variants
        .filter(v => v.product_tmpl_id[0] === p.id)
        .map(v => ({
          ...v,
          attrs: (v.product_template_attribute_value_ids ?? [])
            .map(id => attrMap.get(id))
            .filter((av): av is OdooAttributeValue => !!av)
            .map(av => ({ attrName: av.attribute_id[1], value: av.name, color: av.html_color })),
        }))),
      quants: quants.filter(q => q.product_tmpl_id[0] === p.id),
    }));
  }, [products, variants, quants, attrMap]);

  // Unique companies from actual data
  const allCompanies = useMemo(() => {
    const map = new Map<number, string>();
    productRows.forEach(r => {
      if (r.company_id && r.company_id[0]) map.set(r.company_id[0], r.company_id[1]);
    });
    return [...map.entries()].map(([id, label]) => ({ id, label })).sort((a, b) => a.label.localeCompare(b.label));
  }, [productRows]);

  // Unique product base names filtered by active company selection
  const allProductNames = useMemo(() => {
    const set = new Set<string>();
    productRows.forEach(r => {
      if (companyFilter.size > 0) {
        const cid = r.company_id ? r.company_id[0] : null;
        if (!cid || !companyFilter.has(cid)) return;
      }
      set.add(cleanName(r.name));
    });
    return [...set].sort();
  }, [productRows, companyFilter]);

  const allColors = useMemo(() => {
    const set = new Set<string>();
    productRows.forEach(r => {
      if (companyFilter.size > 0) {
        const cid = r.company_id ? r.company_id[0] : null;
        if (!cid || !companyFilter.has(cid)) return;
      }
      r.variants.forEach(v =>
        v.attrs.forEach(a => { if (isColorAttr(a.attrName)) set.add(a.value.trim()); })
      );
    });
    return [...set].sort();
  }, [productRows, companyFilter]);

  const allSizes = useMemo(() => {
    const set = new Set<string>();
    productRows.forEach(r => {
      if (companyFilter.size > 0) {
        const cid = r.company_id ? r.company_id[0] : null;
        if (!cid || !companyFilter.has(cid)) return;
      }
      r.variants.forEach(v =>
        v.attrs.forEach(a => { if (isSizeAttr(a.attrName)) set.add(a.value.trim()); })
      );
    });
    return [...set].sort();
  }, [productRows, companyFilter]);

  // Alert thresholds
  const OVER = 200, LOW_MAX = 80, LOW_MIN = 50, CRITICAL = 50;

  function variantAlert(qty: number): StockAlert {
    if (qty > OVER)                          return 'over';
    if (qty >= LOW_MIN && qty <= LOW_MAX)    return 'low';
    if (qty < CRITICAL)                      return 'critical';
    return 'all';
  }

  const filteredRows = useMemo(() => {
    const q = search.toLowerCase().trim();
    return productRows
      .map(r => {
        // Company
        if (companyFilter.size > 0) {
          const cid = r.company_id ? r.company_id[0] : null;
          if (!cid || !companyFilter.has(cid)) return null;
        }
        // Product name checkboxes
        if (selectedProducts.size > 0 && !selectedProducts.has(cleanName(r.name))) return null;
        // Con stock / Sin stock (misma cuenta que se muestra en la tarjeta: disponible = a mano - reservado)
        if (stockPresence !== 'all') {
          const reserved = r.quants.reduce((s, qn) => s + qn.reserved_quantity, 0);
          const available = r.qty_available - reserved;
          if (stockPresence === 'with'    && available <= 0) return null;
          if (stockPresence === 'without' && available > 0)  return null;
        }
        // Search
        if (q) {
          const name = cleanName(r.name);
          if (!name.toLowerCase().includes(q) && !(r.default_code ?? '').toLowerCase().includes(q)) return null;
        }

        // Filter variants by color, size, and alert
        let filteredVariants = r.variants;

        if (selectedColors.size > 0) {
          filteredVariants = filteredVariants.filter(v =>
            v.attrs.some(a => isColorAttr(a.attrName) && selectedColors.has(a.value.trim()))
          );
        }
        if (selectedSizes.size > 0) {
          filteredVariants = filteredVariants.filter(v =>
            v.attrs.some(a => isSizeAttr(a.attrName) && selectedSizes.has(a.value.trim()))
          );
        }
        if (alertFilter !== 'all') {
          if (r.variants.length > 0) {
            // Filter at variant level
            filteredVariants = filteredVariants.filter(v => variantAlert(v.qty_available) === alertFilter);
            if (filteredVariants.length === 0) return null;
          } else {
            // No variants · filter at product level
            const qty = r.qty_available;
            if (alertFilter === 'over'     && qty <= OVER)                       return null;
            if (alertFilter === 'low'      && (qty < LOW_MIN || qty > LOW_MAX))  return null;
            if (alertFilter === 'critical' && qty >= CRITICAL)                   return null;
          }
        } else if (selectedColors.size > 0 || selectedSizes.size > 0) {
          if (r.variants.length > 0 && filteredVariants.length === 0) return null;
        }

        return { ...r, variants: filteredVariants };
      })
      .filter((r): r is ProductRow => r !== null);
  }, [productRows, companyFilter, alertFilter, stockPresence, selectedProducts, selectedColors, selectedSizes, search]);

  const stats = useMemo(() => {
    const totalSKUs  = products.length;
    const inStock    = products.filter(p => p.qty_available > 0).length;
    const outOfStock = products.filter(p => p.qty_available <= 0).length;
    const totalUnits = products.reduce((s, p) => s + p.qty_available, 0);
    return { totalSKUs, inStock, outOfStock, totalUnits };
  }, [products]);

  const locationRows = useMemo(() => {
    return locations.map(loc => {
      const locQuants = quants.filter(q => q.location_id[0] === loc.id);
      const totalQty  = locQuants.reduce((s, q) => s + q.quantity, 0);
      const skus      = new Set(locQuants.map(q => q.product_id[0])).size;
      return { ...loc, totalQty, skus, quants: locQuants };
    }).filter(l => l.totalQty > 0).sort((a, b) => b.totalQty - a.totalQty);
  }, [locations, quants]);

  // -- Filter helpers --------------------------------------------------------

  function toggleSet<T>(set: Set<T>, val: T): Set<T> {
    const next = new Set(set);
    next.has(val) ? next.delete(val) : next.add(val);
    return next;
  }

  const activeFilterCount =
    (alertFilter !== 'all' ? 1 : 0) +
    (stockPresence !== 'all' ? 1 : 0) +
    companyFilter.size +
    selectedProducts.size +
    selectedColors.size +
    selectedSizes.size +
    (search ? 1 : 0);

  const clearAll = () => {
    setAlertFilter('all');
    setStockPresence('all');
    setCompanyFilter(new Set());
    setSelectedProducts(new Set());
    setSelectedColors(new Set());
    setSelectedSizes(new Set());
    setSearch('');
    setProductSearch('');
    setColorSearch('');
    setSizeSearch('');
  };

  // -- Render ----------------------------------------------------------------

  return (
    <div className="flex flex-col gap-6">
      <TutorialModal open={showTutorial} onClose={() => setShowTutorial(false)} steps={ODOO_STOCK_TUTORIAL_STEPS} title="Odoo Stock" />
      <ModuleInfo
        number="17"
        title="Odoo Stock"
        description="Inventario en tiempo real desde Odoo ERP. Muestra cantidades, variantes, ubicaciones y movimientos recientes del almacén zazuexpress2."
      />

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="border-b border-[var(--border)] pb-2 flex-1 min-w-0">
          <h2 className="font-serif italic font-bold text-xs uppercase tracking-widest">17 // ODOO_STOCK_LIVE</h2>
          <p className="font-mono text-[10px] font-semibold uppercase tracking-wide mt-1" style={{ color: 'var(--ink)', opacity: 0.7 }}>Conexión directa a zazuexpress2.odoo.com</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {lastFetch && (
            <div className="flex items-center gap-1 font-mono text-[9px] font-semibold uppercase" style={{ color: 'var(--ink)', opacity: 0.6 }}>
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
              <><RefreshCw size={11} className="animate-spin" style={{ color: 'var(--ink)', opacity: 0.6 }} /><span style={{ color: 'var(--ink)', opacity: 0.6 }}>Cargando...</span></>
            )}
          </div>
          <button
            onClick={load}
            disabled={status === 'loading'}
            className="flex items-center gap-1.5 border border-[var(--border)] px-3 py-1.5 font-mono text-[9px] font-bold uppercase tracking-widest hover:bg-[var(--ink)] hover:text-[var(--ink-inv)] transition-colors disabled:opacity-40 shadow-[2px_2px_0_var(--border)]"
          >
            <RefreshCw size={10} className={status === 'loading' ? 'animate-spin' : ''} />
            Actualizar
          </button>
          <button
            onClick={() => setShowTutorial(true)}
            className="flex items-center gap-1.5 border border-[var(--border)] px-3 py-1.5 font-mono text-[9px] font-bold uppercase tracking-widest hover:bg-[var(--ink)] hover:text-[var(--ink-inv)] transition-colors shadow-[2px_2px_0_var(--border)]"
            title="Ver tutorial"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>
            </svg>
            Tutorial
          </button>
        </div>
      </div>

      {/* Error */}
      {status === 'error' && error && (
        <div className="border border-red-400 bg-red-500/10 px-4 py-3 flex items-start gap-3 shadow-[2px_2px_0_#dc2626]">
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
          <StatCard label="SKUs totales"  value={stats.totalSKUs}        sub={`${stats.inStock} con stock`}     icon={Package}    accent="text-[var(--ink)]" />
          <StatCard label="Unidades"      value={fmtQty(stats.totalUnits)} sub="en almacén"                     icon={BarChart2}   accent="text-blue-600" />
          <StatCard label="Con stock"     value={stats.inStock}           sub={`${stats.outOfStock} sin stock`}  icon={TrendingUp}  accent="text-green-600" />
          <StatCard label="Sin stock"     value={stats.outOfStock}        sub="productos agotados"               icon={TrendingDown} accent="text-red-600" />
        </div>
      )}

      {/* View Tabs */}
      {status === 'ok' && (
        <div>
          <div className="flex border-b border-[var(--border)] mb-4">
            {([
              { id: 'products',  label: 'Productos',   icon: List },
              { id: 'locations', label: 'Ubicaciones',  icon: MapPin },
              { id: 'moves',     label: 'Movimientos',  icon: Grid3X3 },
            ] as { id: ViewMode; label: string; icon: React.ElementType }[]).map(tab => (
              <button
                key={tab.id}
                onClick={() => setView(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-2 font-mono text-[9px] font-bold uppercase tracking-widest border-b-2 transition-colors ${
                  view === tab.id ? 'border-[var(--border)] text-[var(--ink)]' : 'border-transparent opacity-50 hover:opacity-80'
                }`}
              >
                <tab.icon size={11} />
                {tab.label}
              </button>
            ))}
          </div>

          {/* -- Products View -- */}
          {view === 'products' && (
            <div className="flex gap-4 items-start">

              {/* -- Sidebar Filters -- */}
              <div className={`shrink-0 transition-all ${sidebarOpen ? 'w-56' : 'w-0 overflow-hidden'}`}>
                <div className="border border-[var(--border)] bg-[var(--surface)] shadow-[2px_2px_0_var(--border)]">
                  {/* Sidebar header */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-[var(--ink)] text-[var(--ink-inv)]">
                    <span className="font-mono text-[9px] font-bold uppercase tracking-widest">FILTROS</span>
                    {activeFilterCount > 0 && (
                      <button onClick={clearAll} className="font-mono text-[8px] uppercase tracking-widest opacity-70 hover:opacity-100 flex items-center gap-1">
                        <X size={9} /> Limpiar
                      </button>
                    )}
                  </div>

                  {/* ALERTA */}
                  <FilterSection title="ALERTA">
                    <div className="flex flex-col gap-1">
                      {([
                        { val: 'all',      label: 'Todos',       dot: null },
                        { val: 'over',     label: 'Sobre stock',  dot: 'bg-green-500',  sub: `> ${OVER}` },
                        { val: 'low',      label: 'Por acabar',   dot: 'bg-yellow-400', sub: `${LOW_MIN}-${LOW_MAX}` },
                        { val: 'critical', label: 'Stock crítico', dot: 'bg-red-500',    sub: `< ${CRITICAL}` },
                      ] as { val: StockAlert; label: string; dot: string | null; sub?: string }[]).map(opt => (
                        <button
                          key={opt.val}
                          onClick={() => setAlertFilter(opt.val)}
                          className={`flex items-center gap-2 px-2 py-2 text-left w-full transition-colors rounded-sm ${
                            alertFilter === opt.val
                              ? 'bg-[var(--success-green)] text-white'
                              : 'hover:bg-[var(--ink)]/5 text-[var(--ink)]'
                          }`}
                        >
                          {opt.dot
                            ? <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${opt.dot}`} />
                            : <span className="w-2.5 h-2.5 shrink-0" />
                          }
                          <span className="font-mono text-[9px] font-bold uppercase tracking-wide flex-1">{opt.label}</span>
                          {opt.sub && <span className="font-mono text-[8px] opacity-50">{opt.sub}</span>}
                        </button>
                      ))}
                    </div>
                  </FilterSection>

                  {/* EMPRESA */}
                  <FilterSection title="EMPRESA">
                    <div className="flex flex-col gap-1">
                      {allCompanies.length === 0 ? (
                        <span className="font-mono text-[9px] opacity-40">Sin datos</span>
                      ) : allCompanies.map(c => (
                        <label key={c.id} className="flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-[var(--ink)]/5 rounded-sm">
                          <input
                            type="checkbox"
                            checked={companyFilter.has(c.id)}
                            onChange={() => setCompanyFilter(toggleSet(companyFilter, c.id))}
                            className="w-3.5 h-3.5 accent-[#141414] cursor-pointer"
                          />
                          <span className="font-mono text-[9px] font-bold uppercase tracking-wide text-[var(--ink)]">{c.label}</span>
                        </label>
                      ))}
                    </div>
                  </FilterSection>

                  {/* PRODUCTO */}
                  <FilterSection title="PRODUCTO">
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center border border-[var(--border)]/20 bg-[var(--bg-input)] px-2 gap-1">
                        <Search size={9} className="opacity-30 shrink-0" />
                        <input
                          value={productSearch}
                          onChange={e => setProductSearch(e.target.value)}
                          placeholder="Buscar..."
                          className="bg-transparent font-mono text-[9px] py-1 outline-none w-full placeholder:opacity-30"
                        />
                      </div>
                      <div className="flex flex-col gap-0.5 max-h-40 overflow-y-auto pr-1">
                        {allProductNames
                          .filter(n => !productSearch || n.toLowerCase().includes(productSearch.toLowerCase()))
                          .map(name => (
                            <label key={name} className="flex items-center gap-2 px-1 py-1 cursor-pointer hover:bg-[var(--ink)]/5 rounded-sm">
                              <input
                                type="checkbox"
                                checked={selectedProducts.has(name)}
                                onChange={() => setSelectedProducts(toggleSet(selectedProducts, name))}
                                className="w-3.5 h-3.5 accent-[#141414] cursor-pointer shrink-0"
                              />
                              <span className="font-mono text-[9px] uppercase tracking-wide text-[var(--ink)] leading-tight">{name}</span>
                            </label>
                          ))
                        }
                      </div>
                    </div>
                  </FilterSection>

                  {/* COLOR */}
                  <FilterSection title="COLOR" defaultOpen={false}>
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center border border-[var(--border)]/20 bg-[var(--bg-input)] px-2 gap-1">
                        <Search size={9} className="opacity-30 shrink-0" />
                        <input
                          value={colorSearch}
                          onChange={e => setColorSearch(e.target.value)}
                          placeholder="Buscar..."
                          className="bg-transparent font-mono text-[9px] py-1 outline-none w-full placeholder:opacity-30"
                        />
                      </div>
                      <div className="flex flex-col gap-0.5 max-h-36 overflow-y-auto pr-1">
                        {allColors
                          .filter(c => !colorSearch || c.toLowerCase().includes(colorSearch.toLowerCase()))
                          .map(color => (
                            <label key={color} className="flex items-center gap-2 px-1 py-1 cursor-pointer hover:bg-[var(--ink)]/5 rounded-sm">
                              <input
                                type="checkbox"
                                checked={selectedColors.has(color)}
                                onChange={() => setSelectedColors(toggleSet(selectedColors, color))}
                                className="w-3.5 h-3.5 accent-[#141414] cursor-pointer shrink-0"
                              />
                              <span className="font-mono text-[9px] uppercase tracking-wide text-[var(--ink)]">{color}</span>
                            </label>
                          ))
                        }
                      </div>
                    </div>
                  </FilterSection>

                  {/* TALLA */}
                  <FilterSection title="TALLA" defaultOpen={false}>
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center border border-[var(--border)]/20 bg-[var(--bg-input)] px-2 gap-1">
                        <Search size={9} className="opacity-30 shrink-0" />
                        <input
                          value={sizeSearch}
                          onChange={e => setSizeSearch(e.target.value)}
                          placeholder="Buscar..."
                          className="bg-transparent font-mono text-[9px] py-1 outline-none w-full placeholder:opacity-30"
                        />
                      </div>
                      <div className="flex flex-col gap-0.5 max-h-36 overflow-y-auto pr-1">
                        {allSizes
                          .filter(s => !sizeSearch || s.toLowerCase().includes(sizeSearch.toLowerCase()))
                          .map(size => (
                            <label key={size} className="flex items-center gap-2 px-1 py-1 cursor-pointer hover:bg-[var(--ink)]/5 rounded-sm">
                              <input
                                type="checkbox"
                                checked={selectedSizes.has(size)}
                                onChange={() => setSelectedSizes(toggleSet(selectedSizes, size))}
                                className="w-3.5 h-3.5 accent-[#141414] cursor-pointer shrink-0"
                              />
                              <span className="font-mono text-[9px] uppercase tracking-wide text-[var(--ink)]">{size}</span>
                            </label>
                          ))
                        }
                      </div>
                    </div>
                  </FilterSection>
                </div>
              </div>

              {/* -- Main content -- */}
              <div className="flex-1 min-w-0 flex flex-col gap-3">
                {/* Toolbar row */}
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => setSidebarOpen(o => !o)}
                    className={`flex items-center gap-1.5 border px-2.5 py-1.5 font-mono text-[9px] font-bold uppercase tracking-widest transition-colors shadow-[2px_2px_0_var(--border)] shrink-0 ${
                      sidebarOpen ? 'bg-[var(--ink)] text-[var(--ink-inv)] border-[var(--border)]' : 'border-[var(--border)] hover:bg-[var(--ink)]/5'
                    }`}
                  >
                    <SlidersHorizontal size={10} />
                    Filtros
                    {activeFilterCount > 0 && (
                      <span className="bg-[var(--bg-input)] text-[var(--ink)] font-black px-1 rounded-sm text-[8px] ml-0.5">{activeFilterCount}</span>
                    )}
                  </button>

                  {/* Con stock / Sin stock */}
                  <div className="flex items-center border border-[var(--border)] shrink-0 shadow-[2px_2px_0_var(--border)]">
                    <button
                      onClick={() => setStockPresence(p => p === 'with' ? 'all' : 'with')}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 font-mono text-[9px] font-bold uppercase tracking-widest transition-colors ${
                        stockPresence === 'with' ? 'bg-green-600 text-white' : 'hover:bg-[var(--ink)]/5'
                      }`}
                      style={stockPresence === 'with' ? undefined : { color: 'var(--ink)', opacity: 0.75 }}
                    >
                      Con stock
                    </button>
                    <button
                      onClick={() => setStockPresence(p => p === 'without' ? 'all' : 'without')}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 font-mono text-[9px] font-bold uppercase tracking-widest border-l border-[var(--border)] transition-colors ${
                        stockPresence === 'without' ? 'bg-red-600 text-white' : 'hover:bg-[var(--ink)]/5'
                      }`}
                      style={stockPresence === 'without' ? undefined : { color: 'var(--ink)', opacity: 0.75 }}
                    >
                      Sin stock
                    </button>
                  </div>

                  {/* Search bar */}
                  <div className="flex items-center border border-[var(--border)]/30 bg-[var(--surface)] px-2 gap-1.5 flex-1 min-w-[160px]">
                    <Search size={11} className="opacity-40 shrink-0" />
                    <input
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder="Buscar producto o código..."
                      className="font-mono text-[10px] bg-transparent outline-none w-full placeholder:opacity-40 py-1.5"
                    />
                    {search && <button onClick={() => setSearch('')} className="opacity-40 hover:opacity-100"><X size={10} /></button>}
                  </div>

                  <span className="font-mono text-[9px] font-semibold ml-auto shrink-0" style={{ color: 'var(--ink)', opacity: 0.55 }}>
                    {filteredRows.length} resultado{filteredRows.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {/* Active filter chips */}
                {activeFilterCount > 0 && (
                  <div className="flex flex-wrap gap-1.5 items-center">
                    {alertFilter !== 'all' && (
                      <span className="flex items-center gap-1 font-mono text-[8px] uppercase font-bold px-2 py-0.5 bg-[var(--ink)]/10 border border-[var(--border)]/20">
                        {alertFilter === 'over' ? 'Sobre stock' : alertFilter === 'low' ? 'Por acabar' : 'Stock crítico'}
                        <button onClick={() => setAlertFilter('all')} className="opacity-50 hover:opacity-100"><X size={8} /></button>
                      </span>
                    )}
                    {stockPresence !== 'all' && (
                      <span className={`flex items-center gap-1 font-mono text-[8px] uppercase font-bold px-2 py-0.5 border ${stockPresence === 'with' ? 'bg-green-500/10 border-green-500/30 text-green-700' : 'bg-red-500/10 border-red-500/30 text-red-700'}`}>
                        {stockPresence === 'with' ? 'Con stock' : 'Sin stock'}
                        <button onClick={() => setStockPresence('all')} className="opacity-50 hover:opacity-100"><X size={8} /></button>
                      </span>
                    )}
                    {[...companyFilter].map(id => {
                      const c = allCompanies.find(x => x.id === id);
                      return c ? (
                        <span key={id} className="flex items-center gap-1 font-mono text-[8px] uppercase font-bold px-2 py-0.5 bg-[var(--ink)]/10 border border-[var(--border)]/20">
                          {c.label}
                          <button onClick={() => setCompanyFilter(toggleSet(companyFilter, id))} className="opacity-50 hover:opacity-100"><X size={8} /></button>
                        </span>
                      ) : null;
                    })}
                    {[...selectedProducts].map(n => (
                      <span key={n} className="flex items-center gap-1 font-mono text-[8px] uppercase font-bold px-2 py-0.5 bg-[var(--ink)]/10 border border-[var(--border)]/20">
                        {n}
                        <button onClick={() => setSelectedProducts(toggleSet(selectedProducts, n))} className="opacity-50 hover:opacity-100"><X size={8} /></button>
                      </span>
                    ))}
                    {[...selectedColors].map(c => (
                      <span key={c} className="flex items-center gap-1 font-mono text-[8px] uppercase font-bold px-2 py-0.5 bg-blue-500/10 border border-blue-500/30 text-blue-700">
                        {c}
                        <button onClick={() => setSelectedColors(toggleSet(selectedColors, c))} className="opacity-50 hover:opacity-100"><X size={8} /></button>
                      </span>
                    ))}
                    {[...selectedSizes].map(s => (
                      <span key={s} className="flex items-center gap-1 font-mono text-[8px] uppercase font-bold px-2 py-0.5 bg-green-500/10 border border-green-500/30 text-green-700">
                        {s}
                        <button onClick={() => setSelectedSizes(toggleSet(selectedSizes, s))} className="opacity-50 hover:opacity-100"><X size={8} /></button>
                      </span>
                    ))}
                    {activeFilterCount > 1 && (
                      <button onClick={clearAll} className="font-mono text-[8px] uppercase font-bold px-2 py-0.5 text-[var(--ink)]/50 hover:text-[var(--ink)] underline">
                        Limpiar todo
                      </button>
                    )}
                  </div>
                )}

                {/* Table */}
                <div className="border border-[var(--border)] shadow-[3px_3px_0_var(--border)] overflow-hidden">
                  <div className="flex items-center px-4 py-2 bg-[var(--ink)] text-[var(--ink-inv)]">
                    <div className="flex-1 font-mono text-[9px] font-bold uppercase tracking-widest">Producto</div>
                    <div className="font-mono text-[9px] font-bold uppercase tracking-widest w-20 text-right hidden sm:block">A la mano</div>
                    <div className="font-mono text-[9px] font-bold uppercase tracking-widest w-20 text-right hidden md:block">Disponible</div>
                    <div className="font-mono text-[9px] font-bold uppercase tracking-widest w-20 text-right hidden lg:block">Reservado</div>
                    <div className="font-mono text-[9px] font-bold uppercase tracking-widest w-20 text-right">Estado</div>
                  </div>
                  {filteredRows.length === 0 ? (
                    <div className="px-4 py-8 text-center font-mono text-[10px] uppercase" style={{ color: 'var(--ink)', opacity: 0.5 }}>Sin resultados</div>
                  ) : (
                    filteredRows.map(row => <ProductItem key={row.id} row={row} />)
                  )}
                </div>
              </div>
            </div>
          )}

          {/* -- Locations View -- */}
          {view === 'locations' && (
            <div className="border border-[var(--border)] shadow-[3px_3px_0_var(--border)] overflow-hidden">
              <div className="flex items-center px-4 py-2 bg-[var(--ink)] text-[var(--ink-inv)]">
                <div className="flex-1 font-mono text-[9px] font-bold uppercase tracking-widest">Ubicación</div>
                <div className="font-mono text-[9px] font-bold uppercase tracking-widest w-16 text-right">SKUs</div>
                <div className="font-mono text-[9px] font-bold uppercase tracking-widest w-20 text-right">Unidades</div>
              </div>
              {locationRows.length === 0 ? (
                <div className="px-4 py-8 text-center font-mono text-[10px] uppercase" style={{ color: 'var(--ink)', opacity: 0.5 }}>Sin ubicaciones con stock</div>
              ) : locationRows.map(loc => (
                <div key={loc.id} className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface)] transition-colors">
                  <MapPin size={13} className="shrink-0" style={{ color: 'var(--ink)', opacity: 0.55 }} />
                  <div className="flex-1 min-w-0">
                    <div className="font-mono font-bold text-[11px] text-[var(--ink)] truncate">{loc.complete_name}</div>
                    <div className="font-mono text-[9px] font-semibold uppercase" style={{ color: 'var(--ink)', opacity: 0.55 }}>{loc.usage}</div>
                  </div>
                  <div className="font-mono font-bold text-[11px] text-[var(--ink)] w-16 text-right">{loc.skus}</div>
                  <div className="font-mono font-black text-sm text-green-700 w-20 text-right">{fmtQty(loc.totalQty)}</div>
                </div>
              ))}
            </div>
          )}

          {/* -- Moves View -- */}
          {view === 'moves' && (
            <div className="border border-[var(--border)] shadow-[3px_3px_0_var(--border)] overflow-hidden">
              <div className="flex items-center px-4 py-2 bg-[var(--ink)] text-[var(--ink-inv)]">
                <div className="flex-1 font-mono text-[9px] font-bold uppercase tracking-widest">Producto</div>
                <div className="font-mono text-[9px] font-bold uppercase tracking-widest flex-1 hidden md:block">Origen → Destino</div>
                <div className="font-mono text-[9px] font-bold uppercase tracking-widest w-16 text-right">Cantidad</div>
                <div className="font-mono text-[9px] font-bold uppercase tracking-widest w-28 text-right hidden sm:block">Fecha</div>
              </div>
              {moves.length === 0 ? (
                <div className="px-4 py-8 text-center font-mono text-[10px] uppercase" style={{ color: 'var(--ink)', opacity: 0.5 }}>Sin movimientos recientes</div>
              ) : moves.map(m => (
                <div key={m.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface)] transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="font-mono font-bold text-[10px] text-[var(--ink)] truncate">{m.product_id[1]}</div>
                    {m.origin && <div className="font-mono text-[9px] font-semibold truncate" style={{ color: 'var(--ink)', opacity: 0.5 }}>{m.origin}</div>}
                  </div>
                  <div className="flex-1 hidden md:flex items-center gap-1 font-mono text-[9px] font-semibold truncate" style={{ color: 'var(--ink)', opacity: 0.7 }}>
                    <span className="truncate">{m.location_id[1]}</span>
                    <span className="shrink-0" style={{ opacity: 0.5 }}>→</span>
                    <span className="truncate">{m.location_dest_id[1]}</span>
                  </div>
                  <div className="font-mono font-black text-sm text-[var(--ink)] w-16 text-right">{fmtQty(m.quantity_done ?? m.product_qty)}</div>
                  <div className="font-mono text-[9px] font-semibold w-28 text-right hidden sm:block" style={{ color: 'var(--ink)', opacity: 0.6 }}>{fmtDate(m.date)}</div>
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
            <div key={i} className="border border-[var(--border)]/20 h-12 bg-[var(--surface-alt)] animate-pulse" style={{ animationDelay: `${i * 0.08}s` }} />
          ))}
        </div>
      )}
    </div>
  );
};

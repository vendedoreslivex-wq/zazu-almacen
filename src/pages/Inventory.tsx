import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useAppContext } from '../store/AppContext';
import { ModuleInfo } from '../components/ModuleInfo';
import { Search, Plus, X, ChevronDown, ChevronRight, Edit2, AlertTriangle, Trash2, Download, Upload, QrCode, ArrowDownLeft, ArrowUpRight, Package } from 'lucide-react';
import { Product } from '../types';
import Papa from 'papaparse';
import { canEdit } from '../lib/permissions';
import { QRModal } from '../components/QRModal';

export const Inventory: React.FC = () => {
  const { products, stockLevels, locations, transactions, addProduct, updateProduct, deleteProduct, activeBrand, setActiveBrand, currentUser } = useAppContext();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState('');
  const [filterColor, setFilterColor] = useState('');
  const [filterSize, setFilterSize] = useState('');
  const [filterStatus, setFilterStatus] = useState(() => {
    return window.sessionStorage.getItem('inventoryFilter') === 'LOW_STOCK' ? 'LOW_STOCK' : 'ALL';
  });

  // Clear session storage filter once read
  useEffect(() => {
    window.sessionStorage.removeItem('inventoryFilter');
  }, []);

  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
  const [expandedColors, setExpandedColors] = useState<Set<string>>(new Set());
  const [filterCategory, setFilterCategory] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newProduct, setNewProduct] = useState<{code: string, name: string, color: string, size: string, category: string, lowStockThreshold: string, costPrice: string, sellPrice: string}>({ code: '', name: '', color: '', size: '', category: '', lowStockThreshold: '', costPrice: '', sellPrice: '' });

  const [showVariantsModal, setShowVariantsModal] = useState(false);
  const [variantForm, setVariantForm] = useState({
    name: '', codePrefix: '', category: '',
    costPrice: '', sellPrice: '', lowStockThreshold: ''
  });
  const [variantBaseSearch, setVariantBaseSearch] = useState('');
  const [variantBaseOpen, setVariantBaseOpen] = useState(false);
  const PRESET_COLORS = ['Negro','Blanco','Azul','Rojo','Verde','Gris','Beige','Cemento','Vino','Marron','Plomo','Pacay','Menta','Camote','Denim','Topo','P.Rosa','Perla','Botella','Melanqe O.'];
  const PRESET_SIZES = ['XS','S','M','L','XL','XXL','XXXL','TALLA UNICA'];
  const [variantColors, setVariantColors] = useState<string[]>([]);
  const [variantSizes, setVariantSizes] = useState<string[]>([]);
  const [customColor, setCustomColor] = useState('');
  const [customSize, setCustomSize] = useState('');

  const toggleVariantColor = (c: string) => setVariantColors(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
  const toggleVariantSize = (s: string) => setVariantSizes(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);

  // Unique product families (distinct names) for the base selector
  const productFamilies = useMemo(() => {
    const seen = new Map<string, Product>();
    for (const p of products) {
      if (!seen.has(p.name)) seen.set(p.name, p);
    }
    return Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [products]);

  // Next correlative index for a given code prefix
  const nextIndexForPrefix = (prefix: string): number => {
    const upper = prefix.toUpperCase();
    const existing = products
      .map(p => p.code)
      .filter(c => c.startsWith(upper + '-'))
      .map(c => parseInt(c.slice(upper.length + 1), 10))
      .filter(n => !isNaN(n));
    return existing.length > 0 ? Math.max(...existing) + 1 : 0;
  };

  const selectVariantBase = (p: Product) => {
    const prefix = p.code.includes('-') ? p.code.split('-')[0] : p.code;
    setVariantForm({
      name: p.name,
      codePrefix: prefix,
      category: p.category ?? '',
      costPrice: p.costPrice != null ? String(p.costPrice) : '',
      sellPrice: p.sellPrice != null ? String(p.sellPrice) : '',
      lowStockThreshold: p.lowStockThreshold != null ? String(p.lowStockThreshold) : '',
    });
    setVariantBaseSearch(p.name);
    setVariantBaseOpen(false);
  };

  const handleAddVariants = () => {
    if (!variantForm.name || !variantForm.codePrefix) return;
    const colors = variantColors.length ? variantColors : [''];
    const sizes = variantSizes.length ? variantSizes : [''];
    const startIdx = nextIndexForPrefix(variantForm.codePrefix);
    let idx = 0;
    for (const color of colors) {
      for (const size of sizes) {
        const suffix = String(startIdx + idx).padStart(3, '0');
        addProduct({
          code: `${variantForm.codePrefix.toUpperCase()}-${suffix}`,
          name: variantForm.name.toUpperCase(),
          color: color || undefined,
          size: size || undefined,
          category: variantForm.category,
          costPrice: variantForm.costPrice ? Number(variantForm.costPrice) : undefined,
          sellPrice: variantForm.sellPrice ? Number(variantForm.sellPrice) : undefined,
          lowStockThreshold: variantForm.lowStockThreshold ? Number(variantForm.lowStockThreshold) : undefined,
        });
        idx++;
      }
    }
    setShowVariantsModal(false);
    setVariantForm({ name: '', codePrefix: '', category: '', costPrice: '', sellPrice: '', lowStockThreshold: '' });
    setVariantBaseSearch('');
    setVariantColors([]);
    setVariantSizes([]);
    setVariantColors([]);
    setVariantSizes([]);
  };

  const [showEditModal, setShowEditModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [qrProduct, setQrProduct] = useState<Product | null>(null);

  const totalRecepcionado = useMemo(() =>
    transactions.filter(t => t.type === 'RECEPTION' && t.status !== 'CANCELLED').reduce((s, t) => s + t.quantity, 0),
  [transactions]);

  const totalDisponible = useMemo(() =>
    stockLevels.reduce((s, sl) => s + sl.quantity, 0),
  [stockLevels]);

  const totalDespachado = useMemo(() =>
    transactions.filter(t => t.type === 'DISPATCH' && t.status !== 'CANCELLED').reduce((s, t) => s + t.quantity, 0),
  [transactions]);

  const uniqueColors = Array.from(new Set(products.map(p => p.color).filter(Boolean))) as string[];
  const uniqueSizes = Array.from(new Set(products.map(p => p.size).filter(Boolean))) as string[];
  const uniqueCategories = Array.from(new Set(products.map(p => p.category || 'SIN CATEGORIA').filter(Boolean))).sort();

  // Calculate aggregated stock per product
  const inventoryData = products.map(p => {
    const productStock = stockLevels.filter(s => s.productId === p.id);
    const total = productStock.reduce((acc, curr) => acc + curr.quantity, 0);
    return { ...p, totalStock: total, locations: productStock };
  }).filter(p => {
    const s = search.toLowerCase();
    const searchMatch = p.name.toLowerCase().includes(s) || p.code.toLowerCase().includes(s);
    const colorMatch = filterColor ? p.color === filterColor : true;
    const sizeMatch = filterSize ? p.size === filterSize : true;
    const categoryMatch = filterCategory ? (p.category || 'SIN CATEGORIA') === filterCategory : true;
    const statusMatch = filterStatus === 'LOW_STOCK' ? (p.lowStockThreshold !== undefined && p.totalStock <= p.lowStockThreshold) : true;
    return searchMatch && colorMatch && sizeMatch && categoryMatch && statusMatch;
  });

  const toggleExpand = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleProduct = (name: string) => {
    setExpandedProducts(prev => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  const toggleColor = (key: string) => {
    setExpandedColors(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const groupedByProduct = inventoryData.reduce<Record<string, typeof inventoryData>>((acc, p) => {
    if (!acc[p.name]) acc[p.name] = [];
    acc[p.name].push(p);
    return acc;
  }, {});

  const sortedProductNames = Object.keys(groupedByProduct).sort();

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newProduct.code && newProduct.name) {
      addProduct({
        code: newProduct.code,
        name: newProduct.name,
        color: newProduct.color,
        size: newProduct.size,
        category: newProduct.category,
        lowStockThreshold: newProduct.lowStockThreshold ? Number(newProduct.lowStockThreshold) : undefined,
        costPrice: newProduct.costPrice ? Number(newProduct.costPrice) : undefined,
        sellPrice: newProduct.sellPrice ? Number(newProduct.sellPrice) : undefined
      });
      setShowAddModal(false);
      setNewProduct({ code: '', name: '', color: '', size: '', category: '', lowStockThreshold: '', costPrice: '', sellPrice: '' });
    }
  };

  const openEditModal = (product: Product, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingProduct(product);
    setShowEditModal(true);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingProduct && editingProduct.code && editingProduct.name) {
      updateProduct(editingProduct);
      setShowEditModal(false);
      setEditingProduct(null);
    }
  };

  const confirmDelete = () => {
    if (productToDelete) {
      deleteProduct(productToDelete.id);
      setProductToDelete(null);
    }
  };

  const exportCSV = () => {
    const headers = ["Codigo", "Nombre", "Color", "Talla", "Categor-a", "Stock Total", "Umbral Bajo", "Costo Unitario", "Precio Venta"];
    
    const rows = inventoryData.map(item => [
      item.code,
      item.name,
      item.color || '',
      item.size || '',
      item.category,
      item.totalStock,
      item.lowStockThreshold !== undefined ? item.lowStockThreshold : '',
      item.costPrice !== undefined ? item.costPrice : '',
      item.sellPrice !== undefined ? item.sellPrice : ''
    ]);
    
    const csvContent = [
      headers.join(","),
      ...rows.map(r => r.map(field => `"${String(field).replace(/"/g, '""')}"`).join(","))
    ].join("\n");
    
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' }); // \uFEFF is BOM for Excel UTF-8 display
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `inventario_${activeBrand.toLowerCase()}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        results.data.forEach((row: any) => {
          if (row['Codigo'] && row['Nombre']) {
            addProduct({
              code: row['Codigo'],
              name: row['Nombre'],
              color: row['Color'],
              size: row['Talla'],
              category: row['Categor-a'] || 'General',
              lowStockThreshold: row['Umbral Bajo'] ? Number(row['Umbral Bajo']) : undefined
            });
          }
        });
        if (fileInputRef.current) fileInputRef.current.value = '';
        alert(`Se importaron ${results.data.length} productos.`);
      },
      error: (error: any) => {
        alert('Error al leer el archivo CSV: ' + error.message);
      }
    });
  };

  return (
    <div className="flex flex-col gap-6 h-full relative">
      <ModuleInfo number="05" title="Inventario" description="Directorio completo de productos organizados por nombre, color y talla. Registra, edita y elimina SKUs, consulta ubicaciones y exporta el inventario." />
      <datalist id="product-names">
        <option value="CAMISA WAFFLE" />
        <option value="CAMISERO JERSEY" />
        <option value="CAMISERO PIKE" />
        <option value="WAFFLE" />
        <option value="WAFFLE CAMISERO" />
        <option value="WAFFLE MANGA LARGA" />
        <option value="CUELLO CHINO" />
        <option value="CUELLO CHINO WAFFLE" />
        <option value="JERSEY MANGA LARGA" />
        <option value="BABY TY ESCOTE" />
        <option value="BABY TY" />
        <option value="BABY TY ESCOTADO MANGA" />
        <option value="BABY TY MANGA" />
        <option value="TOP RIB" />
        <option value="TOP RIB MANGA" />
        <option value="CLASICO" />
        <option value="OVERSIZE" />
        <option value="MEDIAS LARGAS" />
        <option value="MEDIAS CORTAS" />
      </datalist>

      <datalist id="category-list">
        <option value="Polos" />
        <option value="Medias" />
        <option value="Poleras" />
        <option value="Pantalones" />
      </datalist>

      <datalist id="variant-options">
        <option value="Azul / S" />
        <option value="Beige / M" />
        <option value="Botella / L" />
        <option value="Negro / XL" />
        <option value="Cemento / S" />
        <option value="Denim / M" />
        <option value="Melanqe O. / L" />
        <option value="Pacay / XL" />
        <option value="P.Rosa / S" />
        <option value="Perla / M" />
        <option value="Vino / L" />
        <option value="Menta / UNI" />
        <option value="Camote / XL" />
        <option value="Topo / S" />
        <option value="Plomo / UNI" />
        <option value="Marron / M" />
      </datalist>

      {/* -- Tarjetas de resumen -- */}
      <div className="grid grid-cols-3 gap-2">
        <div className="flex flex-col gap-1.5 border border-[var(--border)] bg-[var(--surface)] p-3 shadow-[3px_3px_0_var(--border)]">
          <div className="flex items-center gap-2">
            <ArrowDownLeft size={14} className="text-green-700 shrink-0" />
            <span className="font-mono text-[8px] font-bold uppercase tracking-widest text-[var(--ink)]/50">Total Recepcionado</span>
          </div>
          <span className="font-mono font-black text-2xl text-[var(--ink)] leading-none">{totalRecepcionado.toLocaleString()}</span>
          <span className="font-mono text-[8px] text-[var(--ink)]/40 uppercase tracking-widest">unidades ingresadas</span>
        </div>
        <div className="flex flex-col gap-1.5 border border-[var(--border)] bg-[var(--ink)] p-3 shadow-[3px_3px_0_var(--border)]">
          <div className="flex items-center gap-2">
            <Package size={14} className="text-[var(--ink-inv)]/70 shrink-0" />
            <span className="font-mono text-[8px] font-bold uppercase tracking-widest text-[var(--ink-inv)]/50">Total Disponible</span>
          </div>
          <span className="font-mono font-black text-2xl text-[var(--ink-inv)] leading-none">{totalDisponible.toLocaleString()}</span>
          <span className="font-mono text-[8px] text-[var(--ink-inv)]/40 uppercase tracking-widest">en stock ahora</span>
        </div>
        <div className="flex flex-col gap-1.5 border border-[var(--border)] bg-[var(--surface)] p-3 shadow-[3px_3px_0_var(--border)]">
          <div className="flex items-center gap-2">
            <ArrowUpRight size={14} className="text-red-700 shrink-0" />
            <span className="font-mono text-[8px] font-bold uppercase tracking-widest text-[var(--ink)]/50">Total Despachado</span>
          </div>
          <span className="font-mono font-black text-2xl text-[var(--ink)] leading-none">{totalDespachado.toLocaleString()}</span>
          <span className="font-mono text-[8px] text-[var(--ink)]/40 uppercase tracking-widest">unidades salidas</span>
        </div>
      </div>

      <div className="flex flex-col gap-3 border-b border-[var(--border)] pb-3">
        {/* Title row + primary actions */}
        <div className="flex justify-between items-end">
          <div>
            <h2 className="font-serif italic font-bold text-xs uppercase tracking-widest">01 // Directorio_Inventario</h2>
            <p className="font-mono text-[10px] opacity-70 uppercase tracking-wide mt-1 hidden sm:block">Estado consolidado de SKU y ubicaciones.</p>
          </div>
          <div className="flex items-center gap-2">
            {canEdit(currentUser.role, 'inventory') && (
              <>
                <input type="file" accept=".csv" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-[var(--bg-input)] hover:bg-[var(--ink)] border border-[var(--border)] text-[var(--ink)] hover:text-[var(--ink-inv)] shadow-[2px_2px_0_var(--border)] active:shadow-none active:translate-y-[2px] active:translate-x-[2px] transition-all px-3 py-2 flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase shrink-0 h-[34px]"
                  title="IMPORTAR CSV"
                >
                  <Upload size={13} /><span className="hidden sm:inline">IMPORTAR</span>
                </button>
              </>
            )}
            <button
              onClick={exportCSV}
              className="bg-[var(--bg-input)] hover:bg-[var(--ink)] border border-[var(--border)] text-[var(--ink)] hover:text-[var(--ink-inv)] shadow-[2px_2px_0_var(--border)] active:shadow-none active:translate-y-[2px] active:translate-x-[2px] transition-all px-3 py-2 flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase shrink-0 h-[34px]"
              title="EXPORTAR CSV"
            >
              <Download size={13} /><span className="hidden sm:inline">EXPORTAR</span>
            </button>
            {canEdit(currentUser.role, 'inventory') && (
              <>
                <button
                  onClick={() => setShowVariantsModal(true)}
                  className="bg-[var(--bg-input)] hover:bg-[var(--ink)] text-[var(--ink)] hover:text-[var(--ink-inv)] border border-[var(--border)] shadow-[2px_2px_0_var(--border)] active:shadow-none active:translate-y-[2px] active:translate-x-[2px] transition-all px-3 py-2 flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase shrink-0 h-[34px]"
                  title="CREAR VARIANTES EN LOTE"
                >
                  <Package size={13} /><span className="hidden sm:inline">VARIANTES</span>
                </button>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="bg-[var(--ink)] hover:bg-[var(--bg-input)] text-[var(--ink-inv)] hover:text-[var(--ink)] border border-[var(--border)] shadow-[2px_2px_0_var(--border)] active:shadow-none active:translate-y-[2px] active:translate-x-[2px] transition-all px-3 py-2 flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase shrink-0 h-[34px]"
                >
                  <Plus size={13} /><span className="hidden xs:inline">NUEVO SKU</span><span className="xs:hidden">NUEVO</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Filter row · scrollable on mobile */}
        <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
          <select
            value={activeBrand}
            onChange={(e) => setActiveBrand(e.target.value as any)}
            className="shrink-0 bg-[var(--surface)] border border-[var(--border)] py-1.5 px-2 text-[10px] font-bold text-[var(--ink)] focus:outline-none focus:bg-[var(--bg-input)] focus:shadow-[2px_2px_0_var(--border)] transition-all font-mono uppercase cursor-pointer h-[32px] w-28"
          >
            <option value="OVERSHARK">OVERSHARK</option>
            <option value="BRAVOS">BRAVOS URBAN</option>
            <option value="BOX_PRIME">BOX PRIME</option>
          </select>
          <div className="relative shrink-0 w-36 sm:w-44">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 opacity-50" />
            <input
              type="text" placeholder="BUSCAR..." value={search} onChange={e => setSearch(e.target.value)}
              className="w-full bg-[var(--surface)] border border-[var(--border)] px-7 py-1.5 text-[10px] font-bold text-[var(--ink)] focus:outline-none focus:bg-[var(--bg-input)] focus:shadow-[2px_2px_0_var(--border)] transition-all font-mono uppercase h-[32px]"
            />
          </div>
          <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}
            className="shrink-0 bg-[var(--surface)] border border-[var(--border)] py-1.5 px-2 text-[10px] font-bold text-[var(--ink)] focus:outline-none focus:bg-[var(--bg-input)] focus:shadow-[2px_2px_0_var(--border)] transition-all font-mono uppercase cursor-pointer h-[32px] w-28">
            <option value="">CATEGORIA</option>
            {uniqueCategories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={filterColor} onChange={(e) => setFilterColor(e.target.value)}
            className="shrink-0 bg-[var(--surface)] border border-[var(--border)] py-1.5 px-2 text-[10px] font-bold text-[var(--ink)] focus:outline-none focus:bg-[var(--bg-input)] focus:shadow-[2px_2px_0_var(--border)] transition-all font-mono uppercase cursor-pointer h-[32px] w-24">
            <option value="">COLOR</option>
            {uniqueColors.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={filterSize} onChange={(e) => setFilterSize(e.target.value)}
            className="shrink-0 bg-[var(--surface)] border border-[var(--border)] py-1.5 px-2 text-[10px] font-bold text-[var(--ink)] focus:outline-none focus:bg-[var(--bg-input)] focus:shadow-[2px_2px_0_var(--border)] transition-all font-mono uppercase cursor-pointer h-[32px] w-24">
            <option value="">TALLA</option>
            {uniqueSizes.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
            className="shrink-0 bg-[var(--surface)] border border-[var(--border)] py-1.5 px-2 text-[10px] font-bold text-[var(--ink)] focus:outline-none focus:bg-[var(--bg-input)] focus:shadow-[2px_2px_0_var(--border)] transition-all font-mono uppercase cursor-pointer h-[32px] w-28">
            <option value="ALL">ESTADO</option>
            <option value="LOW_STOCK">STOCK BAJO</option>
          </select>
        </div>
      </div>

      <div className="data-table-container flex-1 flex flex-col overflow-hidden">
        <div className="grid grid-cols-[1fr_100px] data-header">
          <div>PRODUCTO / COLOR / TALLA</div>
          <div className="text-right">STOCK</div>
        </div>

        <div className="flex-1 overflow-auto">
          {sortedProductNames.length === 0 && (
            <div className="p-12 flex items-center justify-center text-[var(--ink)] opacity-50 font-mono text-sm uppercase">NO HAY PRODUCTOS COINCIDENTES</div>
          )}
          {sortedProductNames.map(productName => {
            const productItems = groupedByProduct[productName];
            const isProductExpanded = expandedProducts.has(productName);
            const productTotal = productItems.reduce((s, i) => s + i.totalStock, 0);
            const productLowCount = productItems.filter(i => i.lowStockThreshold !== undefined && i.totalStock <= i.lowStockThreshold).length;
            const totalVariants = productItems.length;

            const colorGroups = productItems.reduce<Record<string, typeof productItems>>((acc, p) => {
              const col = p.color || 'SIN COLOR';
              if (!acc[col]) acc[col] = [];
              acc[col].push(p);
              return acc;
            }, {});
            const sortedColors = Object.keys(colorGroups).sort();

            return (
              <React.Fragment key={productName}>
                {/* Product header */}
                <div
                  className="flex items-center justify-between px-3 py-3 bg-[var(--bg)] text-[var(--ink)] border-b-2 border-b-[#141414] border-l-4 border-l-[#141414] cursor-pointer select-none hover:bg-[var(--bg-input)]/90 transition-colors"
                  onClick={() => toggleProduct(productName)}
                >
                  <div className="flex items-center gap-2 md:gap-3 min-w-0">
                    {isProductExpanded ? <ChevronDown size={15} className="shrink-0" /> : <ChevronRight size={15} className="shrink-0" />}
                    <span className="font-mono font-black text-[12px] uppercase tracking-widest truncate">{productName}</span>
                    <span className="hidden sm:inline font-mono text-[9px] opacity-50 border border-[var(--border)]/25 px-1.5 py-0.5 shrink-0">{sortedColors.length} col.</span>
                    <span className="hidden sm:inline font-mono text-[9px] opacity-50 border border-[var(--border)]/25 px-1.5 py-0.5 shrink-0">{totalVariants} SKU</span>
                    {productLowCount > 0 && (
                      <span className="font-mono text-[9px] bg-red-700 text-white px-1.5 py-0.5 flex items-center gap-1 shrink-0">
                        <AlertTriangle size={10} /> {productLowCount}
                      </span>
                    )}
                  </div>
                  <span className="font-mono font-black text-sm shrink-0 ml-2">{productTotal} u.</span>
                </div>

                {/* Color sub-groups */}
                {isProductExpanded && sortedColors.map(color => {
                  const colorKey = `${productName}|${color}`;
                  const colorItems = colorGroups[color];
                  const isColorExpanded = expandedColors.has(colorKey);
                  const colorTotal = colorItems.reduce((s, i) => s + i.totalStock, 0);
                  const colorLowCount = colorItems.filter(i => i.lowStockThreshold !== undefined && i.totalStock <= i.lowStockThreshold).length;

                  return (
                    <React.Fragment key={colorKey}>
                      {/* Color header */}
                      <div
                        className="flex items-center justify-between pl-7 md:pl-9 pr-3 py-2 bg-[var(--bg-sidebar)] border-b border-[var(--border)]/20 border-l-2 border-l-[#141414]/30 cursor-pointer select-none hover:bg-[var(--bg-sidebar)] transition-colors"
                        onClick={() => toggleColor(colorKey)}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {isColorExpanded ? <ChevronDown size={12} className="shrink-0" /> : <ChevronRight size={12} className="shrink-0" />}
                          <span className="font-mono font-bold text-[11px] uppercase tracking-wide">{color}</span>
                          <span className="font-mono text-[9px] opacity-50 border border-[var(--border)]/20 px-1.5 py-0.5 shrink-0">{colorItems.length}t</span>
                          {colorLowCount > 0 && (
                            <span className="font-mono text-[9px] bg-red-700 text-white px-1.5 py-0.5 flex items-center gap-1 shrink-0">
                              <AlertTriangle size={9} />
                            </span>
                          )}
                        </div>
                        <span className="font-mono font-bold text-sm shrink-0">{colorTotal} u.</span>
                      </div>

                      {/* Size rows */}
                      {isColorExpanded && colorItems.map(item => {
                        const isExpanded = expandedRows.has(item.id);
                        const isLowStock = item.lowStockThreshold !== undefined && item.totalStock <= item.lowStockThreshold;

                        return (
                          <React.Fragment key={item.id}>
                            <div
                              className={`flex items-center pl-12 md:pl-16 pr-3 py-2 cursor-pointer select-none transition-colors border-b border-[var(--border)]/10 ${
                                isLowStock
                                  ? (isExpanded ? 'bg-red-500/15' : 'bg-red-500/10 hover:bg-red-500/15')
                                  : (isExpanded ? 'bg-[var(--bg-card-alt)]' : 'bg-[var(--surface-alt)] hover:bg-[var(--surface)]')
                              }`}
                              onClick={() => toggleExpand(item.id)}
                            >
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <span className="opacity-40 shrink-0">{isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}</span>
                                <span className="font-mono text-[10px] font-black opacity-60 w-24 shrink-0">{item.code}</span>
                                <span className="font-mono text-[11px] font-bold uppercase">{item.size || 'UNICO'}</span>
                                {isLowStock && <span className="bg-red-700 text-white text-[8px] px-1.5 py-0.5 shrink-0 font-mono">BAJO</span>}
                              </div>
                              <div className="font-mono text-right text-sm font-black flex items-center gap-1.5 shrink-0">
                                {isLowStock && <AlertTriangle size={12} className="text-red-600" />}
                                <span className={isLowStock ? 'text-red-700' : ''}>{item.totalStock} u.</span>
                              </div>
                            </div>

                            {isExpanded && (
                              <div className={`border-b border-[var(--border)] p-3 md:p-4 pl-12 md:pl-16 flex flex-col gap-4 ${isLowStock ? 'bg-red-500/10' : 'bg-[var(--surface-alt)]'}`}>
                                <div className="flex justify-between items-start">
                                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 flex-1">
                                    <div className="flex flex-col gap-1">
                                      <span className="text-[9px] font-bold uppercase tracking-widest opacity-60 font-mono">CODIGO SKU</span>
                                      <span className="text-xs font-bold font-mono">{item.code}</span>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                      <span className="text-[9px] font-bold uppercase tracking-widest opacity-60 font-mono">NOMBRE</span>
                                      <span className="text-xs font-bold font-mono">{item.name}</span>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                      <span className="text-[9px] font-bold uppercase tracking-widest opacity-60 font-mono">COLOR</span>
                                      <span className="text-xs font-bold font-mono">{item.color || 'N/A'}</span>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                      <span className="text-[9px] font-bold uppercase tracking-widest opacity-60 font-mono">TALLA</span>
                                      <span className="text-xs font-bold font-mono">{item.size || 'N/A'}</span>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                      <span className="text-[9px] font-bold uppercase tracking-widest opacity-60 font-mono">UMBRAL MIN</span>
                                      <span className="text-xs font-bold font-mono">{item.lowStockThreshold ?? 'N/A'}</span>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                      <span className="text-[9px] font-bold uppercase tracking-widest opacity-60 font-mono">STOCK TOTAL</span>
                                      <span className={`text-xs font-bold font-mono px-2 py-0.5 w-fit ${isLowStock ? 'bg-red-700 text-white' : 'bg-[var(--ink)] text-[var(--ink-inv)]'}`}>
                                        {item.totalStock}{isLowStock ? ' (BAJO)' : ''}
                                      </span>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                      <span className="text-[9px] font-bold uppercase tracking-widest opacity-60 font-mono">COSTO</span>
                                      <span className="text-xs font-bold font-mono">{item.costPrice ? `S/ ${item.costPrice.toFixed(2)}` : 'N/A'}</span>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                      <span className="text-[9px] font-bold uppercase tracking-widest opacity-60 font-mono">P. VENTA</span>
                                      <span className="text-xs font-bold font-mono">{item.sellPrice ? `S/ ${item.sellPrice.toFixed(2)}` : 'N/A'}</span>
                                    </div>
                                  </div>
                                  <div className="flex flex-col gap-2 shrink-0 ml-4">
                                    <button onClick={(e) => { e.stopPropagation(); setQrProduct(item); }} className="bg-[var(--bg-input)] border border-[var(--border)] hover:bg-[var(--ink)] hover:text-[var(--ink-inv)] transition-colors p-2" title="VER QR">
                                      <QrCode size={14} />
                                    </button>
                                    {canEdit(currentUser.role, 'inventory') && (
                                      <>
                                        <button onClick={(e) => openEditModal(item, e)} className="bg-[var(--bg-input)] border border-[var(--border)] hover:bg-[var(--ink)] hover:text-[var(--ink-inv)] transition-colors p-2" title="EDITAR SKU">
                                          <Edit2 size={14} />
                                        </button>
                                        <button onClick={(e) => { e.stopPropagation(); setProductToDelete(item); }} className="bg-[var(--bg-input)] border border-red-700 text-red-700 hover:bg-red-700 hover:text-white transition-colors p-2" title="ELIMINAR SKU">
                                          <Trash2 size={14} />
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </div>

                                <div>
                                  <div className="text-[9px] font-bold uppercase tracking-[0.2em] mb-2 opacity-70 font-mono">DESGLOSE_DE_UBICACIONES //</div>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                                    {item.locations.length > 0 ? item.locations.map(loc => {
                                      const locName = locations.find(l => l.id === loc.locationId)?.name;
                                      return (
                                        <div key={loc.id} className="flex justify-between items-center bg-[var(--bg-input)] border border-[var(--border)] px-3 py-2 text-[10px] uppercase font-bold shadow-[2px_2px_0_rgba(20,20,20,0.15)]">
                                          <span className="opacity-70 font-mono text-[var(--ink)] truncate" title={locName}>{locName}</span>
                                          <span className="font-mono font-black text-sm">{loc.quantity}</span>
                                        </div>
                                      );
                                    }) : <span className="text-[9px] opacity-60 font-mono italic">SIN_STOCK_EN_ALMACEN</span>}
                                  </div>
                                </div>
                              </div>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </React.Fragment>
                  );
                })}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Variants Batch Modal */}
      {showVariantsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-[var(--bg)] border-4 border-[var(--border)] w-full max-w-2xl shadow-[8px_8px_0_var(--border)] flex flex-col max-h-[92vh]">
            <div className="p-3 border-b border-[var(--border)] bg-[var(--bg-sidebar)] flex justify-between items-center shrink-0">
              <h2 className="font-serif italic font-bold text-xs uppercase tracking-widest">REGISTRO // VARIANTES_EN_LOTE</h2>
              <button
                onClick={() => { setShowVariantsModal(false); setVariantBaseSearch(''); }}
                className="opacity-60 hover:opacity-100 hover:bg-[var(--ink)] hover:text-[var(--ink-inv)] p-1 border border-transparent hover:border-[var(--border)] transition-all"
              >
                <X size={16} />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-5 flex flex-col gap-5">

              {/* Base product selector */}
              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[9px] font-bold tracking-[0.2em] opacity-80 uppercase">FAMILIA DE PRODUCTO BASE</label>
                <div className="relative">
                  <input
                    value={variantBaseSearch}
                    onChange={e => { setVariantBaseSearch(e.target.value); setVariantBaseOpen(true); }}
                    onFocus={() => setVariantBaseOpen(true)}
                    onBlur={() => setTimeout(() => setVariantBaseOpen(false), 150)}
                    className="w-full bg-[var(--bg-card-alt)] border border-[var(--border)] p-2 text-xs font-bold uppercase focus:bg-[var(--bg-input)] focus:outline-none focus:shadow-[2px_2px_0_var(--border)] transition-all rounded-none"
                    placeholder="BUSCAR O DEJAR EN BLANCO PARA NUEVA FAMILIA"
                  />
                  {variantBaseOpen && (
                    <div className="absolute z-50 w-full border-2 border-[var(--border)] shadow-[4px_4px_0_var(--border)] max-h-48 overflow-y-auto" style={{ background: 'var(--bg)', top: '100%', left: 0 }}>
                      {productFamilies
                        .filter(p => !variantBaseSearch || p.name.toLowerCase().includes(variantBaseSearch.toLowerCase()))
                        .map(p => (
                          <button
                            key={p.id}
                            type="button"
                            onMouseDown={() => selectVariantBase(p)}
                            className="w-full text-left px-3 py-2 font-mono text-[10px] font-bold uppercase hover:bg-[var(--ink)] hover:text-[var(--ink-inv)] transition-all flex items-center justify-between gap-2"
                          >
                            <span>{p.name}</span>
                            <span className="opacity-40 font-normal">{p.code.includes('-') ? p.code.split('-')[0] : p.code}-···</span>
                          </button>
                        ))}
                    </div>
                  )}
                </div>
                {variantForm.name && (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--surface)] border border-[var(--border)]">
                    <span className="font-mono text-[9px] opacity-50 uppercase">Siguiente SKU:</span>
                    <span className="font-mono text-[10px] font-black">
                      {variantForm.codePrefix.toUpperCase()}-{String(nextIndexForPrefix(variantForm.codePrefix)).padStart(3, '0')}
                    </span>
                    <span className="font-mono text-[9px] opacity-40">→ ···{String(nextIndexForPrefix(variantForm.codePrefix) + Math.max(variantColors.length||1,1)*Math.max(variantSizes.length||1,1)-1).padStart(3,'0')}</span>
                  </div>
                )}
              </div>

              {/* Base fields */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="font-mono text-[9px] font-bold tracking-[0.2em] opacity-80 uppercase">NOMBRE DEL PRODUCTO *</label>
                  <input
                    required
                    value={variantForm.name}
                    onChange={e => setVariantForm({ ...variantForm, name: e.target.value })}
                    className="bg-[var(--bg-card-alt)] border border-[var(--border)] p-2 text-xs font-bold uppercase focus:bg-[var(--bg-input)] focus:outline-none focus:shadow-[2px_2px_0_var(--border)] transition-all rounded-none"
                    placeholder="EJ: CAMISA WAFFLE"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="font-mono text-[9px] font-bold tracking-[0.2em] opacity-80 uppercase">PREFIJO DE CÓDIGO *</label>
                  <input
                    required
                    value={variantForm.codePrefix}
                    onChange={e => setVariantForm({ ...variantForm, codePrefix: e.target.value })}
                    className="bg-[var(--bg-card-alt)] border border-[var(--border)] p-2 text-xs font-bold font-mono uppercase focus:bg-[var(--bg-input)] focus:outline-none focus:shadow-[2px_2px_0_var(--border)] transition-all rounded-none"
                    placeholder="EJ: CWF"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="font-mono text-[9px] font-bold tracking-[0.2em] opacity-80 uppercase">CATEGORÍA</label>
                  <input
                    list="category-list"
                    value={variantForm.category}
                    onChange={e => setVariantForm({ ...variantForm, category: e.target.value })}
                    className="bg-[var(--bg-card-alt)] border border-[var(--border)] p-2 text-xs font-bold uppercase focus:bg-[var(--bg-input)] focus:outline-none focus:shadow-[2px_2px_0_var(--border)] transition-all rounded-none"
                    placeholder="EJ: POLOS"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="font-mono text-[9px] font-bold tracking-[0.2em] opacity-80 uppercase">UMBRAL MÍNIMO</label>
                  <input
                    type="number"
                    value={variantForm.lowStockThreshold}
                    onChange={e => setVariantForm({ ...variantForm, lowStockThreshold: e.target.value })}
                    className="bg-[var(--bg-card-alt)] border border-[var(--border)] p-2 text-xs font-bold font-mono focus:bg-[var(--bg-input)] focus:outline-none focus:shadow-[2px_2px_0_var(--border)] transition-all rounded-none"
                    placeholder="EJ: 5"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="font-mono text-[9px] font-bold tracking-[0.2em] opacity-80 uppercase">COSTO (S/)</label>
                  <input
                    type="number" step="0.01"
                    value={variantForm.costPrice}
                    onChange={e => setVariantForm({ ...variantForm, costPrice: e.target.value })}
                    className="bg-[var(--bg-card-alt)] border border-[var(--border)] p-2 text-xs font-bold font-mono focus:bg-[var(--bg-input)] focus:outline-none focus:shadow-[2px_2px_0_var(--border)] transition-all rounded-none"
                    placeholder="EJ: 15.50"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="font-mono text-[9px] font-bold tracking-[0.2em] opacity-80 uppercase">PRECIO VENTA (S/)</label>
                  <input
                    type="number" step="0.01"
                    value={variantForm.sellPrice}
                    onChange={e => setVariantForm({ ...variantForm, sellPrice: e.target.value })}
                    className="bg-[var(--bg-card-alt)] border border-[var(--border)] p-2 text-xs font-bold font-mono focus:bg-[var(--bg-input)] focus:outline-none focus:shadow-[2px_2px_0_var(--border)] transition-all rounded-none"
                    placeholder="EJ: 45.00"
                  />
                </div>
              </div>

              {/* Colors */}
              <div className="flex flex-col gap-2">
                <label className="font-mono text-[9px] font-bold tracking-[0.2em] opacity-80 uppercase">COLORES</label>
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_COLORS.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => toggleVariantColor(c)}
                      className={`px-2.5 py-1 text-[9px] font-mono font-bold uppercase border transition-all ${variantColors.includes(c) ? 'bg-[var(--ink)] text-[var(--ink-inv)] border-[var(--border)] shadow-[2px_2px_0_var(--border)]' : 'bg-[var(--bg-card-alt)] text-[var(--ink)] border-[var(--border)] opacity-60 hover:opacity-100'}`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2 mt-1">
                  <input
                    value={customColor}
                    onChange={e => setCustomColor(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && customColor.trim()) { toggleVariantColor(customColor.trim()); setCustomColor(''); e.preventDefault(); }}}
                    className="bg-[var(--bg-card-alt)] border border-[var(--border)] p-1.5 text-xs font-bold font-mono uppercase focus:outline-none focus:shadow-[2px_2px_0_var(--border)] flex-1 rounded-none"
                    placeholder="OTRO COLOR + ENTER"
                  />
                  <button
                    type="button"
                    onClick={() => { if (customColor.trim()) { toggleVariantColor(customColor.trim()); setCustomColor(''); }}}
                    className="bg-[var(--bg-input)] border border-[var(--border)] px-3 text-[10px] font-mono font-bold hover:bg-[var(--ink)] hover:text-[var(--ink-inv)] transition-all"
                  >
                    +
                  </button>
                </div>
                {variantColors.length > 0 && (
                  <p className="font-mono text-[9px] opacity-60">Seleccionados: {variantColors.join(', ')}</p>
                )}
              </div>

              {/* Sizes */}
              <div className="flex flex-col gap-2">
                <label className="font-mono text-[9px] font-bold tracking-[0.2em] opacity-80 uppercase">TALLAS</label>
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_SIZES.map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => toggleVariantSize(s)}
                      className={`px-2.5 py-1 text-[9px] font-mono font-bold uppercase border transition-all ${variantSizes.includes(s) ? 'bg-[var(--ink)] text-[var(--ink-inv)] border-[var(--border)] shadow-[2px_2px_0_var(--border)]' : 'bg-[var(--bg-card-alt)] text-[var(--ink)] border-[var(--border)] opacity-60 hover:opacity-100'}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2 mt-1">
                  <input
                    value={customSize}
                    onChange={e => setCustomSize(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && customSize.trim()) { toggleVariantSize(customSize.trim()); setCustomSize(''); e.preventDefault(); }}}
                    className="bg-[var(--bg-card-alt)] border border-[var(--border)] p-1.5 text-xs font-bold font-mono uppercase focus:outline-none focus:shadow-[2px_2px_0_var(--border)] flex-1 rounded-none"
                    placeholder="OTRA TALLA + ENTER"
                  />
                  <button
                    type="button"
                    onClick={() => { if (customSize.trim()) { toggleVariantSize(customSize.trim()); setCustomSize(''); }}}
                    className="bg-[var(--bg-input)] border border-[var(--border)] px-3 text-[10px] font-mono font-bold hover:bg-[var(--ink)] hover:text-[var(--ink-inv)] transition-all"
                  >
                    +
                  </button>
                </div>
                {variantSizes.length > 0 && (
                  <p className="font-mono text-[9px] opacity-60">Seleccionadas: {variantSizes.join(', ')}</p>
                )}
              </div>

              {/* Preview count */}
              {(variantForm.name || variantForm.codePrefix) && (
                <div className="border border-[var(--border)] bg-[var(--surface)] p-3 flex items-center justify-between">
                  <span className="font-mono text-[10px] opacity-70 uppercase tracking-widest">SKUs a generar</span>
                  <span className="font-mono font-black text-xl">
                    {Math.max(variantColors.length || 1, 1) * Math.max(variantSizes.length || 1, 1)}
                  </span>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-[var(--border)] flex justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => { setShowVariantsModal(false); setVariantBaseSearch(''); }}
                className="bg-[var(--bg-input)] border border-[var(--border)] text-[var(--ink)] px-5 py-2.5 text-[10px] font-mono tracking-widest font-bold hover:bg-[var(--ink)] hover:text-[var(--ink-inv)] transition-all shadow-[2px_2px_0_var(--border)]"
              >
                CANCELAR
              </button>
              <button
                type="button"
                onClick={handleAddVariants}
                disabled={!variantForm.name || !variantForm.codePrefix}
                className="bg-[var(--ink)] text-[var(--ink-inv)] border border-[var(--border)] px-6 py-2.5 text-[10px] font-mono tracking-widest font-bold shadow-[4px_4px_0_var(--border)] hover:bg-[var(--bg-input)] hover:text-[var(--ink)] active:shadow-none active:translate-y-[4px] active:translate-x-[4px] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                CREAR_{Math.max(variantColors.length || 1, 1) * Math.max(variantSizes.length || 1, 1)}_SKUs
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Product Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 transition-opacity">
          <div className="bg-[var(--bg)] border-4 border-[var(--border)] w-full max-w-md shadow-[8px_8px_0_var(--border)] flex flex-col">
            <div className="p-3 border-b border-[var(--border)] bg-[var(--bg-sidebar)] flex justify-between items-center">
              <h2 className="font-serif italic font-bold text-xs uppercase tracking-widest">REGISTRO // NUEVO_SKU</h2>
              <button 
                onClick={() => setShowAddModal(false)} 
                className="opacity-60 hover:opacity-100 hover:bg-[var(--ink)] hover:text-[var(--ink-inv)] p-1 border border-transparent hover:border-[var(--border)] transition-all"
              >
                <X size={16}/>
              </button>
            </div>
            
            <form onSubmit={handleAddSubmit} className="p-5 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[9px] font-bold tracking-[0.2em] opacity-80 uppercase">CODIGO SKU</label>
                <input 
                  required
                  value={newProduct.code}
                  onChange={e => setNewProduct({...newProduct, code: e.target.value})}
                  className="bg-[var(--bg-card-alt)] border border-[var(--border)] p-2 text-xs font-bold font-mono uppercase focus:bg-[var(--bg-input)] focus:outline-none focus:shadow-[2px_2px_0_var(--border)] transition-all rounded-none"
                  placeholder="EJ: SKU-0010"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[9px] font-bold tracking-[0.2em] opacity-80 uppercase">NOMBRE DEL PRODUCTO</label>
                <input 
                  required
                  list="product-names"
                  value={newProduct.name}
                  onChange={e => setNewProduct({...newProduct, name: e.target.value})}
                  className="bg-[var(--bg-card-alt)] border border-[var(--border)] p-2 text-xs font-bold uppercase focus:bg-[var(--bg-input)] focus:outline-none focus:shadow-[2px_2px_0_var(--border)] transition-all rounded-none"
                  placeholder="EJ: CAMISA WAFFLE"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[9px] font-bold tracking-[0.2em] opacity-80 uppercase">COLOR (OPCIONAL)</label>
                <input 
                  value={newProduct.color}
                  onChange={e => setNewProduct({...newProduct, color: e.target.value})}
                  className="bg-[var(--bg-card-alt)] border border-[var(--border)] p-2 text-xs font-bold uppercase focus:bg-[var(--bg-input)] focus:outline-none focus:shadow-[2px_2px_0_var(--border)] transition-all rounded-none"
                  placeholder="EJ: NEGRO"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[9px] font-bold tracking-[0.2em] opacity-80 uppercase">TALLA (OPCIONAL)</label>
                <input 
                  value={newProduct.size}
                  onChange={e => setNewProduct({...newProduct, size: e.target.value})}
                  className="bg-[var(--bg-card-alt)] border border-[var(--border)] p-2 text-xs font-bold uppercase focus:bg-[var(--bg-input)] focus:outline-none focus:shadow-[2px_2px_0_var(--border)] transition-all rounded-none"
                  placeholder="EJ: XL"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[9px] font-bold tracking-[0.2em] opacity-80 uppercase">CATEGORIA</label>
                <input 
                  list="category-list"
                  value={newProduct.category}
                  onChange={e => setNewProduct({...newProduct, category: e.target.value})}
                  className="bg-[var(--bg-card-alt)] border border-[var(--border)] p-2 text-xs font-bold uppercase focus:bg-[var(--bg-input)] focus:outline-none focus:shadow-[2px_2px_0_var(--border)] transition-all rounded-none"
                  placeholder="EJ: POLOS"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[9px] font-bold tracking-[0.2em] opacity-80 uppercase">UMBRAL MIN. DE STOCK (OPCIONAL)</label>
                <input 
                  type="number"
                  value={newProduct.lowStockThreshold}
                  onChange={e => setNewProduct({...newProduct, lowStockThreshold: e.target.value})}
                  className="bg-[var(--bg-card-alt)] border border-[var(--border)] p-2 text-xs font-bold font-mono uppercase focus:bg-[var(--bg-input)] focus:outline-none focus:shadow-[2px_2px_0_var(--border)] transition-all rounded-none"
                  placeholder="EJ: 10"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[9px] font-bold tracking-[0.2em] opacity-80 uppercase">COSTO (S/)</label>
                <input 
                  type="number"
                  step="0.01"
                  value={newProduct.costPrice}
                  onChange={e => setNewProduct({...newProduct, costPrice: e.target.value})}
                  className="bg-[var(--bg-card-alt)] border border-[var(--border)] p-2 text-xs font-bold font-mono uppercase focus:bg-[var(--bg-input)] focus:outline-none focus:shadow-[2px_2px_0_var(--border)] transition-all rounded-none"
                  placeholder="EJ: 15.50"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[9px] font-bold tracking-[0.2em] opacity-80 uppercase">PRECIO VENTA (S/)</label>
                <input 
                  type="number"
                  step="0.01"
                  value={newProduct.sellPrice}
                  onChange={e => setNewProduct({...newProduct, sellPrice: e.target.value})}
                  className="bg-[var(--bg-card-alt)] border border-[var(--border)] p-2 text-xs font-bold font-mono uppercase focus:bg-[var(--bg-input)] focus:outline-none focus:shadow-[2px_2px_0_var(--border)] transition-all rounded-none"
                  placeholder="EJ: 45.00"
                />
              </div>
              
              <div className="mt-4 flex justify-end">
                <button 
                  type="submit" 
                  className="bg-[var(--ink)] text-[var(--ink-inv)] border border-[var(--border)] px-6 py-2.5 text-[10px] font-mono tracking-widest font-bold shadow-[4px_4px_0_var(--border)] hover:bg-[var(--bg-input)] hover:text-[var(--ink)] active:shadow-none active:translate-y-[4px] active:translate-x-[4px] transition-all"
                >
                  CREAR_REGISTRO
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Product Modal */}
      {showEditModal && editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 transition-opacity">
          <div className="bg-[var(--bg)] border-4 border-[var(--border)] w-full max-w-md shadow-[8px_8px_0_var(--border)] flex flex-col">
            <div className="p-3 border-b border-[var(--border)] bg-[var(--bg-sidebar)] flex justify-between items-center">
              <h2 className="font-serif italic font-bold text-xs uppercase tracking-widest">EDICION // SKU</h2>
              <button 
                onClick={() => {setShowEditModal(false); setEditingProduct(null);}} 
                className="opacity-60 hover:opacity-100 hover:bg-[var(--ink)] hover:text-[var(--ink-inv)] p-1 border border-transparent hover:border-[var(--border)] transition-all"
              >
                <X size={16}/>
              </button>
            </div>
            
            <form onSubmit={handleEditSubmit} className="p-5 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[9px] font-bold tracking-[0.2em] opacity-80 uppercase">CODIGO SKU</label>
                <input 
                  required
                  value={editingProduct.code}
                  onChange={e => setEditingProduct({...editingProduct, code: e.target.value})}
                  className="bg-[var(--bg-card-alt)] border border-[var(--border)] p-2 text-xs font-bold font-mono uppercase focus:bg-[var(--bg-input)] focus:outline-none focus:shadow-[2px_2px_0_var(--border)] transition-all rounded-none"
                  placeholder="EJ: SKU-0010"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[9px] font-bold tracking-[0.2em] opacity-80 uppercase">NOMBRE DEL PRODUCTO</label>
                <input 
                  required
                  list="product-names"
                  value={editingProduct.name}
                  onChange={e => setEditingProduct({...editingProduct, name: e.target.value})}
                  className="bg-[var(--bg-card-alt)] border border-[var(--border)] p-2 text-xs font-bold uppercase focus:bg-[var(--bg-input)] focus:outline-none focus:shadow-[2px_2px_0_var(--border)] transition-all rounded-none"
                  placeholder="EJ: CAMISA WAFFLE"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[9px] font-bold tracking-[0.2em] opacity-80 uppercase">COLOR (OPCIONAL)</label>
                <input 
                  value={editingProduct.color || ''}
                  onChange={e => setEditingProduct({...editingProduct, color: e.target.value})}
                  className="bg-[var(--bg-card-alt)] border border-[var(--border)] p-2 text-xs font-bold uppercase focus:bg-[var(--bg-input)] focus:outline-none focus:shadow-[2px_2px_0_var(--border)] transition-all rounded-none"
                  placeholder="EJ: NEGRO"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[9px] font-bold tracking-[0.2em] opacity-80 uppercase">TALLA (OPCIONAL)</label>
                <input 
                  value={editingProduct.size || ''}
                  onChange={e => setEditingProduct({...editingProduct, size: e.target.value})}
                  className="bg-[var(--bg-card-alt)] border border-[var(--border)] p-2 text-xs font-bold uppercase focus:bg-[var(--bg-input)] focus:outline-none focus:shadow-[2px_2px_0_var(--border)] transition-all rounded-none"
                  placeholder="EJ: XL"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[9px] font-bold tracking-[0.2em] opacity-80 uppercase">CATEGORIA</label>
                <input 
                  list="category-list"
                  value={editingProduct.category}
                  onChange={e => setEditingProduct({...editingProduct, category: e.target.value})}
                  className="bg-[var(--bg-card-alt)] border border-[var(--border)] p-2 text-xs font-bold uppercase focus:bg-[var(--bg-input)] focus:outline-none focus:shadow-[2px_2px_0_var(--border)] transition-all rounded-none"
                  placeholder="EJ: POLOS"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[9px] font-bold tracking-[0.2em] opacity-80 uppercase">UMBRAL MIN. DE STOCK (OPCIONAL)</label>
                <input 
                  type="number"
                  value={editingProduct.lowStockThreshold ?? ''}
                  onChange={e => setEditingProduct({...editingProduct, lowStockThreshold: e.target.value ? Number(e.target.value) : undefined})}
                  className="bg-[var(--bg-card-alt)] border border-[var(--border)] p-2 text-xs font-bold font-mono uppercase focus:bg-[var(--bg-input)] focus:outline-none focus:shadow-[2px_2px_0_var(--border)] transition-all rounded-none"
                  placeholder="EJ: 10"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[9px] font-bold tracking-[0.2em] opacity-80 uppercase">COSTO (S/)</label>
                <input 
                  type="number"
                  step="0.01"
                  value={editingProduct.costPrice ?? ''}
                  onChange={e => setEditingProduct({...editingProduct, costPrice: e.target.value ? Number(e.target.value) : undefined})}
                  className="bg-[var(--bg-card-alt)] border border-[var(--border)] p-2 text-xs font-bold font-mono uppercase focus:bg-[var(--bg-input)] focus:outline-none focus:shadow-[2px_2px_0_var(--border)] transition-all rounded-none"
                  placeholder="EJ: 15.50"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[9px] font-bold tracking-[0.2em] opacity-80 uppercase">PRECIO VENTA (S/)</label>
                <input 
                  type="number"
                  step="0.01"
                  value={editingProduct.sellPrice ?? ''}
                  onChange={e => setEditingProduct({...editingProduct, sellPrice: e.target.value ? Number(e.target.value) : undefined})}
                  className="bg-[var(--bg-card-alt)] border border-[var(--border)] p-2 text-xs font-bold font-mono uppercase focus:bg-[var(--bg-input)] focus:outline-none focus:shadow-[2px_2px_0_var(--border)] transition-all rounded-none"
                  placeholder="EJ: 45.00"
                />
              </div>
              
              <div className="mt-4 flex justify-end">
                <button 
                  type="submit" 
                  className="bg-[var(--ink)] text-[var(--ink-inv)] border border-[var(--border)] px-6 py-2.5 text-[10px] font-mono tracking-widest font-bold shadow-[4px_4px_0_var(--border)] hover:bg-[var(--bg-input)] hover:text-[var(--ink)] active:shadow-none active:translate-y-[4px] active:translate-x-[4px] transition-all"
                >
                  GUARDAR_CAMBIOS
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Delete Confirmation Modal */}
      {productToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 transition-opacity">
          <div className="bg-[var(--bg)] border-4 border-[var(--border)] w-full max-w-sm shadow-[8px_8px_0_var(--border)] flex flex-col">
            <div className="p-3 border-b border-[var(--border)] bg-[var(--bg-sidebar)] flex gap-2 items-center">
              <AlertTriangle size={16} className="text-red-600" />
              <h2 className="font-serif italic font-bold text-xs uppercase tracking-widest text-[var(--ink)]">ELIMINAR SKU</h2>
            </div>
            
            <div className="p-5 flex flex-col gap-6">
              <p className="font-mono text-sm font-bold text-center leading-relaxed">
                Are you sure you want to delete this product? This action cannot be undone.
              </p>
              <div className="text-center bg-[var(--surface)] border border-[var(--border)]/20 p-2">
                <span className="font-mono text-xs font-bold">{productToDelete.code}</span>
                <span className="block text-[10px] font-mono opacity-70 mt-1">{productToDelete.name}</span>
              </div>
              <div className="flex justify-between gap-4 mt-2">
                <button 
                  onClick={() => setProductToDelete(null)}
                  className="flex-1 bg-[var(--bg-input)] border border-[var(--border)] text-[var(--ink)] px-4 py-2 text-[10px] font-mono tracking-widest font-bold hover:bg-[var(--ink)] hover:text-white transition-all shadow-[2px_2px_0_var(--border)]"
                >
                  Cancel
                </button>
                <button 
                  onClick={confirmDelete}
                  className="flex-1 bg-red-700 text-white border border-[var(--border)] px-4 py-2 text-[10px] font-mono tracking-widest font-bold hover:bg-black transition-all shadow-[2px_2px_0_var(--border)]"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {qrProduct && (
        <QRModal
          item={{ kind: 'product', id: qrProduct.id, code: qrProduct.code, name: qrProduct.name, color: qrProduct.color, size: qrProduct.size, brand: activeBrand }}
          onClose={() => setQrProduct(null)}
        />
      )}
    </div>
  );
};

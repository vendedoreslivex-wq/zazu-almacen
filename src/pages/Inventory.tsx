import React, { useState, useRef, useEffect } from 'react';
import { useAppContext } from '../store/AppContext';
import { ModuleInfo } from '../components/ModuleInfo';
import { Search, Plus, X, ChevronDown, ChevronRight, Edit2, AlertTriangle, Trash2, Download, Upload, QrCode } from 'lucide-react';
import { Product } from '../types';
import Papa from 'papaparse';
import { canEdit } from '../lib/permissions';
import { QRModal } from '../components/QRModal';

export const Inventory: React.FC = () => {
  const { products, stockLevels, locations, addProduct, updateProduct, deleteProduct, activeBrand, setActiveBrand, currentUser } = useAppContext();
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

  const [showEditModal, setShowEditModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [qrProduct, setQrProduct] = useState<Product | null>(null);

  const uniqueColors = Array.from(new Set(products.map(p => p.color).filter(Boolean))) as string[];
  const uniqueSizes = Array.from(new Set(products.map(p => p.size).filter(Boolean))) as string[];
  const uniqueCategories = Array.from(new Set(products.map(p => p.category || 'SIN CATEGORÍA').filter(Boolean))).sort();

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
    const categoryMatch = filterCategory ? (p.category || 'SIN CATEGORÍA') === filterCategory : true;
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
    const headers = ["Código", "Nombre", "Color", "Talla", "Categoría", "Stock Total", "Umbral Bajo", "Costo Unitario", "Precio Venta"];
    
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
          if (row['Código'] && row['Nombre']) {
            addProduct({
              code: row['Código'],
              name: row['Nombre'],
              color: row['Color'],
              size: row['Talla'],
              category: row['Categoría'] || 'General',
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
      <ModuleInfo number="03" title="Inventario" description="Directorio completo de productos organizados por nombre, color y talla. Registra, edita y elimina SKUs, consulta ubicaciones y exporta el inventario." />
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

      <div className="flex flex-col gap-3 border-b border-[#141414] pb-3">
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
                  className="bg-white hover:bg-[#141414] border border-[#141414] text-[#141414] hover:text-[#E4E3E0] shadow-[2px_2px_0_#141414] active:shadow-none active:translate-y-[2px] active:translate-x-[2px] transition-all px-3 py-2 flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase shrink-0 h-[34px]"
                  title="IMPORTAR CSV"
                >
                  <Upload size={13} /><span className="hidden sm:inline">IMPORTAR</span>
                </button>
              </>
            )}
            <button
              onClick={exportCSV}
              className="bg-white hover:bg-[#141414] border border-[#141414] text-[#141414] hover:text-[#E4E3E0] shadow-[2px_2px_0_#141414] active:shadow-none active:translate-y-[2px] active:translate-x-[2px] transition-all px-3 py-2 flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase shrink-0 h-[34px]"
              title="EXPORTAR CSV"
            >
              <Download size={13} /><span className="hidden sm:inline">EXPORTAR</span>
            </button>
            {canEdit(currentUser.role, 'inventory') && (
              <button
                onClick={() => setShowAddModal(true)}
                className="bg-[#141414] hover:bg-white text-[#E4E3E0] hover:text-[#141414] border border-[#141414] shadow-[2px_2px_0_#141414] active:shadow-none active:translate-y-[2px] active:translate-x-[2px] transition-all px-3 py-2 flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase shrink-0 h-[34px]"
              >
                <Plus size={13} /><span className="hidden xs:inline">NUEVO SKU</span><span className="xs:hidden">NUEVO</span>
              </button>
            )}
          </div>
        </div>

        {/* Filter row — scrollable on mobile */}
        <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
          <select
            value={activeBrand}
            onChange={(e) => setActiveBrand(e.target.value as any)}
            className="shrink-0 bg-white/50 border border-[#141414] py-1.5 px-2 text-[10px] font-bold text-[#141414] focus:outline-none focus:bg-white focus:shadow-[2px_2px_0_#141414] transition-all font-mono uppercase cursor-pointer h-[32px] w-28"
          >
            <option value="OVERSHARK">OVERSHARK</option>
            <option value="BRAVOS">BRAVOS URBAN</option>
            <option value="BOX_PRIME">BOX PRIME</option>
          </select>
          <div className="relative shrink-0 w-36 sm:w-44">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 opacity-50" />
            <input
              type="text" placeholder="BUSCAR..." value={search} onChange={e => setSearch(e.target.value)}
              className="w-full bg-white/50 border border-[#141414] px-7 py-1.5 text-[10px] font-bold text-[#141414] focus:outline-none focus:bg-white focus:shadow-[2px_2px_0_#141414] transition-all font-mono uppercase h-[32px]"
            />
          </div>
          <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}
            className="shrink-0 bg-white/50 border border-[#141414] py-1.5 px-2 text-[10px] font-bold text-[#141414] focus:outline-none focus:bg-white focus:shadow-[2px_2px_0_#141414] transition-all font-mono uppercase cursor-pointer h-[32px] w-28">
            <option value="">CATEGORÍA</option>
            {uniqueCategories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={filterColor} onChange={(e) => setFilterColor(e.target.value)}
            className="shrink-0 bg-white/50 border border-[#141414] py-1.5 px-2 text-[10px] font-bold text-[#141414] focus:outline-none focus:bg-white focus:shadow-[2px_2px_0_#141414] transition-all font-mono uppercase cursor-pointer h-[32px] w-24">
            <option value="">COLOR</option>
            {uniqueColors.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={filterSize} onChange={(e) => setFilterSize(e.target.value)}
            className="shrink-0 bg-white/50 border border-[#141414] py-1.5 px-2 text-[10px] font-bold text-[#141414] focus:outline-none focus:bg-white focus:shadow-[2px_2px_0_#141414] transition-all font-mono uppercase cursor-pointer h-[32px] w-24">
            <option value="">TALLA</option>
            {uniqueSizes.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
            className="shrink-0 bg-white/50 border border-[#141414] py-1.5 px-2 text-[10px] font-bold text-[#141414] focus:outline-none focus:bg-white focus:shadow-[2px_2px_0_#141414] transition-all font-mono uppercase cursor-pointer h-[32px] w-28">
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
            <div className="p-12 flex items-center justify-center text-[#141414] opacity-50 font-mono text-sm uppercase">NO HAY PRODUCTOS COINCIDENTES</div>
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
                  className="flex items-center justify-between px-3 py-3 bg-[#E4E3E0] text-[#141414] border-b-2 border-b-[#141414] border-l-4 border-l-[#141414] cursor-pointer select-none hover:bg-white/90 transition-colors"
                  onClick={() => toggleProduct(productName)}
                >
                  <div className="flex items-center gap-2 md:gap-3 min-w-0">
                    {isProductExpanded ? <ChevronDown size={15} className="shrink-0" /> : <ChevronRight size={15} className="shrink-0" />}
                    <span className="font-mono font-black text-[12px] uppercase tracking-widest truncate">{productName}</span>
                    <span className="hidden sm:inline font-mono text-[9px] opacity-50 border border-[#141414]/25 px-1.5 py-0.5 shrink-0">{sortedColors.length} col.</span>
                    <span className="hidden sm:inline font-mono text-[9px] opacity-50 border border-[#141414]/25 px-1.5 py-0.5 shrink-0">{totalVariants} SKU</span>
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
                        className="flex items-center justify-between pl-7 md:pl-9 pr-3 py-2 bg-[#D4D3D0] border-b border-[#141414]/20 border-l-2 border-l-[#141414]/30 cursor-pointer select-none hover:bg-[#C8C7C4] transition-colors"
                        onClick={() => toggleColor(colorKey)}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {isColorExpanded ? <ChevronDown size={12} className="shrink-0" /> : <ChevronRight size={12} className="shrink-0" />}
                          <span className="font-mono font-bold text-[11px] uppercase tracking-wide">{color}</span>
                          <span className="font-mono text-[9px] opacity-50 border border-[#141414]/20 px-1.5 py-0.5 shrink-0">{colorItems.length}t</span>
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
                              className={`flex items-center pl-12 md:pl-16 pr-3 py-2 cursor-pointer select-none transition-colors border-b border-[#141414]/10 ${
                                isLowStock
                                  ? (isExpanded ? 'bg-red-100/80' : 'bg-red-50/60 hover:bg-red-100/80')
                                  : (isExpanded ? 'bg-white/80' : 'bg-white/20 hover:bg-white/50')
                              }`}
                              onClick={() => toggleExpand(item.id)}
                            >
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <span className="opacity-40 shrink-0">{isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}</span>
                                <span className="font-mono text-[10px] font-black opacity-60 w-24 shrink-0">{item.code}</span>
                                <span className="font-mono text-[11px] font-bold uppercase">{item.size || 'ÚNICO'}</span>
                                {isLowStock && <span className="bg-red-700 text-white text-[8px] px-1.5 py-0.5 shrink-0 font-mono">BAJO</span>}
                              </div>
                              <div className="font-mono text-right text-sm font-black flex items-center gap-1.5 shrink-0">
                                {isLowStock && <AlertTriangle size={12} className="text-red-600" />}
                                <span className={isLowStock ? 'text-red-700' : ''}>{item.totalStock} u.</span>
                              </div>
                            </div>

                            {isExpanded && (
                              <div className={`border-b border-[#141414] p-3 md:p-4 pl-12 md:pl-16 flex flex-col gap-4 ${isLowStock ? 'bg-red-50/40' : 'bg-white/30'}`}>
                                <div className="flex justify-between items-start">
                                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 flex-1">
                                    <div className="flex flex-col gap-1">
                                      <span className="text-[9px] font-bold uppercase tracking-widest opacity-60 font-mono">CÓDIGO SKU</span>
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
                                      <span className={`text-xs font-bold font-mono px-2 py-0.5 w-fit ${isLowStock ? 'bg-red-700 text-white' : 'bg-[#141414] text-[#E4E3E0]'}`}>
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
                                    <button onClick={(e) => { e.stopPropagation(); setQrProduct(item); }} className="bg-white border border-[#141414] hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors p-2" title="VER QR">
                                      <QrCode size={14} />
                                    </button>
                                    {canEdit(currentUser.role, 'inventory') && (
                                      <>
                                        <button onClick={(e) => openEditModal(item, e)} className="bg-white border border-[#141414] hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors p-2" title="EDITAR SKU">
                                          <Edit2 size={14} />
                                        </button>
                                        <button onClick={(e) => { e.stopPropagation(); setProductToDelete(item); }} className="bg-white border border-red-700 text-red-700 hover:bg-red-700 hover:text-white transition-colors p-2" title="ELIMINAR SKU">
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
                                        <div key={loc.id} className="flex justify-between items-center bg-white border border-[#141414] px-3 py-2 text-[10px] uppercase font-bold shadow-[2px_2px_0_rgba(20,20,20,0.15)]">
                                          <span className="opacity-70 font-mono text-[#141414] truncate" title={locName}>{locName}</span>
                                          <span className="font-mono font-black text-sm">{loc.quantity}</span>
                                        </div>
                                      );
                                    }) : <span className="text-[9px] opacity-60 font-mono italic">SIN_STOCK_EN_ALMACÉN</span>}
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

      {/* Add Product Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 transition-opacity">
          <div className="bg-[#E4E3E0] border-4 border-[#141414] w-full max-w-md shadow-[8px_8px_0_#141414] flex flex-col">
            <div className="p-3 border-b border-[#141414] bg-[#D4D3D0] flex justify-between items-center">
              <h2 className="font-serif italic font-bold text-xs uppercase tracking-widest">REGISTRO // NUEVO_SKU</h2>
              <button 
                onClick={() => setShowAddModal(false)} 
                className="opacity-60 hover:opacity-100 hover:bg-[#141414] hover:text-[#E4E3E0] p-1 border border-transparent hover:border-[#141414] transition-all"
              >
                <X size={16}/>
              </button>
            </div>
            
            <form onSubmit={handleAddSubmit} className="p-5 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[9px] font-bold tracking-[0.2em] opacity-80 uppercase">CÓDIGO SKU</label>
                <input 
                  required
                  value={newProduct.code}
                  onChange={e => setNewProduct({...newProduct, code: e.target.value})}
                  className="bg-white/70 border border-[#141414] p-2 text-xs font-bold font-mono uppercase focus:bg-white focus:outline-none focus:shadow-[2px_2px_0_#141414] transition-all rounded-none"
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
                  className="bg-white/70 border border-[#141414] p-2 text-xs font-bold uppercase focus:bg-white focus:outline-none focus:shadow-[2px_2px_0_#141414] transition-all rounded-none"
                  placeholder="EJ: CAMISA WAFFLE"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[9px] font-bold tracking-[0.2em] opacity-80 uppercase">COLOR (OPCIONAL)</label>
                <input 
                  value={newProduct.color}
                  onChange={e => setNewProduct({...newProduct, color: e.target.value})}
                  className="bg-white/70 border border-[#141414] p-2 text-xs font-bold uppercase focus:bg-white focus:outline-none focus:shadow-[2px_2px_0_#141414] transition-all rounded-none"
                  placeholder="EJ: NEGRO"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[9px] font-bold tracking-[0.2em] opacity-80 uppercase">TALLA (OPCIONAL)</label>
                <input 
                  value={newProduct.size}
                  onChange={e => setNewProduct({...newProduct, size: e.target.value})}
                  className="bg-white/70 border border-[#141414] p-2 text-xs font-bold uppercase focus:bg-white focus:outline-none focus:shadow-[2px_2px_0_#141414] transition-all rounded-none"
                  placeholder="EJ: XL"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[9px] font-bold tracking-[0.2em] opacity-80 uppercase">CATEGORÍA</label>
                <input 
                  list="category-list"
                  value={newProduct.category}
                  onChange={e => setNewProduct({...newProduct, category: e.target.value})}
                  className="bg-white/70 border border-[#141414] p-2 text-xs font-bold uppercase focus:bg-white focus:outline-none focus:shadow-[2px_2px_0_#141414] transition-all rounded-none"
                  placeholder="EJ: POLOS"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[9px] font-bold tracking-[0.2em] opacity-80 uppercase">UMBRAL MIN. DE STOCK (OPCIONAL)</label>
                <input 
                  type="number"
                  value={newProduct.lowStockThreshold}
                  onChange={e => setNewProduct({...newProduct, lowStockThreshold: e.target.value})}
                  className="bg-white/70 border border-[#141414] p-2 text-xs font-bold font-mono uppercase focus:bg-white focus:outline-none focus:shadow-[2px_2px_0_#141414] transition-all rounded-none"
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
                  className="bg-white/70 border border-[#141414] p-2 text-xs font-bold font-mono uppercase focus:bg-white focus:outline-none focus:shadow-[2px_2px_0_#141414] transition-all rounded-none"
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
                  className="bg-white/70 border border-[#141414] p-2 text-xs font-bold font-mono uppercase focus:bg-white focus:outline-none focus:shadow-[2px_2px_0_#141414] transition-all rounded-none"
                  placeholder="EJ: 45.00"
                />
              </div>
              
              <div className="mt-4 flex justify-end">
                <button 
                  type="submit" 
                  className="bg-[#141414] text-[#E4E3E0] border border-[#141414] px-6 py-2.5 text-[10px] font-mono tracking-widest font-bold shadow-[4px_4px_0_#141414] hover:bg-white hover:text-[#141414] active:shadow-none active:translate-y-[4px] active:translate-x-[4px] transition-all"
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
          <div className="bg-[#E4E3E0] border-4 border-[#141414] w-full max-w-md shadow-[8px_8px_0_#141414] flex flex-col">
            <div className="p-3 border-b border-[#141414] bg-[#D4D3D0] flex justify-between items-center">
              <h2 className="font-serif italic font-bold text-xs uppercase tracking-widest">EDICIÓN // SKU</h2>
              <button 
                onClick={() => {setShowEditModal(false); setEditingProduct(null);}} 
                className="opacity-60 hover:opacity-100 hover:bg-[#141414] hover:text-[#E4E3E0] p-1 border border-transparent hover:border-[#141414] transition-all"
              >
                <X size={16}/>
              </button>
            </div>
            
            <form onSubmit={handleEditSubmit} className="p-5 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[9px] font-bold tracking-[0.2em] opacity-80 uppercase">CÓDIGO SKU</label>
                <input 
                  required
                  value={editingProduct.code}
                  onChange={e => setEditingProduct({...editingProduct, code: e.target.value})}
                  className="bg-white/70 border border-[#141414] p-2 text-xs font-bold font-mono uppercase focus:bg-white focus:outline-none focus:shadow-[2px_2px_0_#141414] transition-all rounded-none"
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
                  className="bg-white/70 border border-[#141414] p-2 text-xs font-bold uppercase focus:bg-white focus:outline-none focus:shadow-[2px_2px_0_#141414] transition-all rounded-none"
                  placeholder="EJ: CAMISA WAFFLE"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[9px] font-bold tracking-[0.2em] opacity-80 uppercase">COLOR (OPCIONAL)</label>
                <input 
                  value={editingProduct.color || ''}
                  onChange={e => setEditingProduct({...editingProduct, color: e.target.value})}
                  className="bg-white/70 border border-[#141414] p-2 text-xs font-bold uppercase focus:bg-white focus:outline-none focus:shadow-[2px_2px_0_#141414] transition-all rounded-none"
                  placeholder="EJ: NEGRO"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[9px] font-bold tracking-[0.2em] opacity-80 uppercase">TALLA (OPCIONAL)</label>
                <input 
                  value={editingProduct.size || ''}
                  onChange={e => setEditingProduct({...editingProduct, size: e.target.value})}
                  className="bg-white/70 border border-[#141414] p-2 text-xs font-bold uppercase focus:bg-white focus:outline-none focus:shadow-[2px_2px_0_#141414] transition-all rounded-none"
                  placeholder="EJ: XL"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[9px] font-bold tracking-[0.2em] opacity-80 uppercase">CATEGORÍA</label>
                <input 
                  list="category-list"
                  value={editingProduct.category}
                  onChange={e => setEditingProduct({...editingProduct, category: e.target.value})}
                  className="bg-white/70 border border-[#141414] p-2 text-xs font-bold uppercase focus:bg-white focus:outline-none focus:shadow-[2px_2px_0_#141414] transition-all rounded-none"
                  placeholder="EJ: POLOS"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[9px] font-bold tracking-[0.2em] opacity-80 uppercase">UMBRAL MIN. DE STOCK (OPCIONAL)</label>
                <input 
                  type="number"
                  value={editingProduct.lowStockThreshold ?? ''}
                  onChange={e => setEditingProduct({...editingProduct, lowStockThreshold: e.target.value ? Number(e.target.value) : undefined})}
                  className="bg-white/70 border border-[#141414] p-2 text-xs font-bold font-mono uppercase focus:bg-white focus:outline-none focus:shadow-[2px_2px_0_#141414] transition-all rounded-none"
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
                  className="bg-white/70 border border-[#141414] p-2 text-xs font-bold font-mono uppercase focus:bg-white focus:outline-none focus:shadow-[2px_2px_0_#141414] transition-all rounded-none"
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
                  className="bg-white/70 border border-[#141414] p-2 text-xs font-bold font-mono uppercase focus:bg-white focus:outline-none focus:shadow-[2px_2px_0_#141414] transition-all rounded-none"
                  placeholder="EJ: 45.00"
                />
              </div>
              
              <div className="mt-4 flex justify-end">
                <button 
                  type="submit" 
                  className="bg-[#141414] text-[#E4E3E0] border border-[#141414] px-6 py-2.5 text-[10px] font-mono tracking-widest font-bold shadow-[4px_4px_0_#141414] hover:bg-white hover:text-[#141414] active:shadow-none active:translate-y-[4px] active:translate-x-[4px] transition-all"
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
          <div className="bg-[#E4E3E0] border-4 border-[#141414] w-full max-w-sm shadow-[8px_8px_0_#141414] flex flex-col">
            <div className="p-3 border-b border-[#141414] bg-[#D4D3D0] flex gap-2 items-center">
              <AlertTriangle size={16} className="text-red-600" />
              <h2 className="font-serif italic font-bold text-xs uppercase tracking-widest text-[#141414]">ELIMINAR SKU</h2>
            </div>
            
            <div className="p-5 flex flex-col gap-6">
              <p className="font-mono text-sm font-bold text-center leading-relaxed">
                Are you sure you want to delete this product? This action cannot be undone.
              </p>
              <div className="text-center bg-white/50 border border-[#141414]/20 p-2">
                <span className="font-mono text-xs font-bold">{productToDelete.code}</span>
                <span className="block text-[10px] font-mono opacity-70 mt-1">{productToDelete.name}</span>
              </div>
              <div className="flex justify-between gap-4 mt-2">
                <button 
                  onClick={() => setProductToDelete(null)}
                  className="flex-1 bg-white border border-[#141414] text-[#141414] px-4 py-2 text-[10px] font-mono tracking-widest font-bold hover:bg-[#141414] hover:text-white transition-all shadow-[2px_2px_0_#141414]"
                >
                  Cancel
                </button>
                <button 
                  onClick={confirmDelete}
                  className="flex-1 bg-red-700 text-white border border-[#141414] px-4 py-2 text-[10px] font-mono tracking-widest font-bold hover:bg-black transition-all shadow-[2px_2px_0_#141414]"
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

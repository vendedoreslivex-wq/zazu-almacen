import React, { useState, useMemo } from 'react';
import { useAppContext } from '../store/AppContext';
import { ModuleInfo } from '../components/ModuleInfo';
import { Search, Plus, X, Edit2, MapPin, Trash2, AlertTriangle, QrCode, ChevronLeft } from 'lucide-react';
import { QRModal } from '../components/QRModal';
import { Location } from '../types';
import { cn } from '../lib/utils';
import { TutorialModal, LOCATIONS_TUTORIAL_STEPS } from '../components/TutorialModal';

export const Locations: React.FC = () => {
  const { locations, stockLevels, products, addLocation, updateLocation, deleteLocation, deleteStockLevel, activeBrand } = useAppContext();
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('ALL');
  const [showTutorial, setShowTutorial] = useState(false);
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [newLocation, setNewLocation] = useState<{name: string, type: 'ZONE' | 'RACK' | 'BIN' | 'EXTERNAL' | 'WAREHOUSE'}>({ name: '', type: 'ZONE' });

  const [showEditModal, setShowEditModal] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [initialEditingLocation, setInitialEditingLocation] = useState<Location | null>(null);
  
  const [showDiscardModal, setShowDiscardModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  const [deletingLocationId, setDeletingLocationId] = useState<string | null>(null);
  const [confirmDeleteStock, setConfirmDeleteStock] = useState<{productId: string; locationId: string} | null>(null);
  
  const [feedback, setFeedback] = useState<{type: 'success' | 'error', message: string} | null>(null);

  const [expandedLocations, setExpandedLocations] = useState<Set<string>>(new Set());
  const [qrLocation, setQrLocation] = useState<Location | null>(null);

  // Detail view
  const [detailLocation, setDetailLocation] = useState<Location | null>(null);
  const [detailFilterName, setDetailFilterName] = useState('');
  const [detailFilterColor, setDetailFilterColor] = useState('');
  const [detailFilterSize, setDetailFilterSize] = useState('');

  const toggleLocationExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newExpanded = new Set(expandedLocations);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedLocations(newExpanded);
  };

  const filteredLocations = locations.filter(l => 
    l.name.toLowerCase().includes(search.toLowerCase()) &&
    (filterType === 'ALL' || l.type === filterType)
  );

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newLocation.name) {
      addLocation({
        name: newLocation.name,
        type: newLocation.type
      });
      setShowAddModal(false);
      setNewLocation({ name: '', type: 'ZONE' });
      showFeedback('success', 'UBICACION REGISTRADA CORRECTAMENTE');
    }
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingLocation && editingLocation.name) {
      updateLocation(editingLocation);
      setShowEditModal(false);
      setEditingLocation(null);
      setInitialEditingLocation(null);
      showFeedback('success', 'UBICACION ACTUALIZADA CORRECTAMENTE');
    }
  };

  const handleEditClick = (loc: Location) => {
    if (showEditModal && editingLocation && initialEditingLocation && (editingLocation.name !== initialEditingLocation.name || editingLocation.type !== initialEditingLocation.type)) {
      setPendingAction(() => () => {
        setEditingLocation({ ...loc });
        setInitialEditingLocation(loc);
        setShowEditModal(true);
      });
      setShowDiscardModal(true);
    } else {
      setEditingLocation({ ...loc });
      setInitialEditingLocation(loc);
      setShowEditModal(true);
    }
  };

  const requestCloseEditModal = () => {
    if (editingLocation && initialEditingLocation && (editingLocation.name !== initialEditingLocation.name || editingLocation.type !== initialEditingLocation.type)) {
      setPendingAction(null);
      setShowDiscardModal(true);
    } else {
      setShowEditModal(false);
      setEditingLocation(null);
      setInitialEditingLocation(null);
    }
  };

  const requestOpenAddModal = () => {
    if (showEditModal && editingLocation && initialEditingLocation && (editingLocation.name !== initialEditingLocation.name || editingLocation.type !== initialEditingLocation.type)) {
      setPendingAction(() => () => setShowAddModal(true));
      setShowDiscardModal(true);
    } else {
      setShowEditModal(false);
      setEditingLocation(null);
      setInitialEditingLocation(null);
      setShowAddModal(true);
    }
  };

  const confirmDiscard = () => {
    setShowDiscardModal(false);
    setShowEditModal(false);
    setEditingLocation(null);
    setInitialEditingLocation(null);
    if (pendingAction) {
      pendingAction();
      setPendingAction(null);
    }
  };

  const confirmSave = () => {
    if (editingLocation && editingLocation.name) {
      updateLocation(editingLocation);
      showFeedback('success', 'UBICACION ACTUALIZADA CORRECTAMENTE');
    }
    setShowDiscardModal(false);
    setShowEditModal(false);
    setEditingLocation(null);
    setInitialEditingLocation(null);
    if (pendingAction) {
      pendingAction();
      setPendingAction(null);
    }
  };

  const handleDeleteClick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingLocationId(id);
  };

  const confirmDelete = () => {
    if (!deletingLocationId) return;
    try {
      deleteLocation(deletingLocationId);
      showFeedback('success', 'UBICACION ELIMINADA');
    } catch (err: any) {
      showFeedback('error', err.message);
    }
    setDeletingLocationId(null);
  };

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4000);
  };

  // Calculate stats for each location
  const getLocationStats = (locId: string) => {
    const stocks = stockLevels.filter(s => s.locationId === locId);
    const uniqueSKUs = stocks.filter(s => s.quantity > 0).length;
    const totalItems = stocks.reduce((acc, curr) => acc + curr.quantity, 0);
    
    const locationProducts = stocks.filter(s => s.quantity > 0).map(s => {
      const product = products.find(p => p.id === s.productId);
      return {
        product,
        quantity: s.quantity
      };
    });

    return { uniqueSKUs, totalItems, locationProducts };
  };

  // Detail view derived data
  const detailItems = useMemo(() => {
    if (!detailLocation) return [];
    return stockLevels
      .filter(s => s.locationId === detailLocation.id && s.quantity > 0)
      .map(s => ({ ...s, product: products.find(p => p.id === s.productId) }))
      .filter(s => s.product);
  }, [detailLocation, stockLevels, products]);

  const detailNames = useMemo(() =>
    Array.from(new Set<string>(detailItems.map(s => s.product!.name))).sort(),
    [detailItems]);
  const detailColors = useMemo(() =>
    Array.from(new Set<string>(detailItems.filter(s => !detailFilterName || s.product!.name === detailFilterName).map(s => s.product!.color ?? '').filter(Boolean))).sort(),
    [detailItems, detailFilterName]);
  const detailSizes = useMemo(() =>
    Array.from(new Set<string>(detailItems.filter(s => (!detailFilterName || s.product!.name === detailFilterName) && (!detailFilterColor || s.product!.color === detailFilterColor)).map(s => s.product!.size?.trim() ?? '').filter(Boolean))).sort(),
    [detailItems, detailFilterName, detailFilterColor]);

  const detailFiltered = useMemo(() =>
    detailItems.filter(s =>
      (!detailFilterName || s.product!.name === detailFilterName) &&
      (!detailFilterColor || s.product!.color === detailFilterColor) &&
      (!detailFilterSize || s.product!.size?.trim() === detailFilterSize)
    ),
    [detailItems, detailFilterName, detailFilterColor, detailFilterSize]);

  const openDetail = (loc: Location, e: React.MouseEvent) => {
    e.stopPropagation();
    setDetailLocation(loc);
    setDetailFilterName('');
    setDetailFilterColor('');
    setDetailFilterSize('');
  };

  return (
    <div className="flex flex-col gap-6 h-full relative">
      <TutorialModal open={showTutorial} onClose={() => setShowTutorial(false)} steps={LOCATIONS_TUTORIAL_STEPS} title="Ubicaciones" />
      <div className="flex items-stretch gap-0">
        <div className="flex-1">
          <ModuleInfo number="06" title="Ubicaciones" description="Gestión de la estructura física del almacén: define zonas, estantes y ubicaciones donde se almacenan los productos con control de capacidad." />
        </div>
        <button
          onClick={() => setShowTutorial(true)}
          className="flex items-center gap-1.5 px-4 border border-l-0 border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--ink)] hover:text-[var(--ink-inv)] transition-all duration-150 shrink-0"
          title="Ver tutorial"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>
          </svg>
          <span className="font-mono text-[9px] font-bold uppercase tracking-widest hidden sm:block">Tutorial</span>
        </button>
      </div>
      {feedback && (
        <div className={cn("absolute top-0 right-0 z-50 p-4 border font-bold font-mono text-xs uppercase tracking-widest flex items-center gap-2 shadow-[4px_4px_0_rgba(0,0,0,0.2)]", feedback.type === 'success' ? "bg-green-500/15 border-green-700 text-green-600" : "bg-red-500/15 border-red-700 text-red-600")}>
          {feedback.message}
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 border-b border-[var(--border)] pb-3">
        <div>
          <h2 className="font-serif italic font-bold text-xs uppercase tracking-widest">02 // Gestión_Ubicaciones</h2>
          <p className="font-mono text-[10px] opacity-70 uppercase tracking-wide mt-1">Estructura del almacén y zonas.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 w-full sm:w-64">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-50" />
            <input 
              type="text"
              placeholder="BUSCAR UBICACION..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-[var(--surface)] border border-[var(--border)] items-center px-9 py-2 text-[10px] font-bold text-[var(--ink)] focus:outline-none focus:bg-[var(--bg-input)] focus:shadow-[2px_2px_0_var(--border)] transition-all font-mono uppercase"
            />
          </div>
          <select 
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            className="w-full sm:w-auto bg-[var(--surface)] border border-[var(--border)] py-2 px-3 text-[10px] font-bold text-[var(--ink)] focus:outline-none focus:bg-[var(--bg-input)] focus:shadow-[2px_2px_0_var(--border)] transition-all font-mono uppercase"
          >
            <option value="ALL">TODOS LOS TIPOS</option>
            <option value="ZONE">ZONA PRINCIPAL</option>
            <option value="RACK">ESTANTE / RACK</option>
            <option value="BIN">GAVETA / BIN</option>
            <option value="EXTERNAL">ALMACEN EXTERNO</option>
            <option value="WAREHOUSE">BODEGA</option>
          </select>
          <button 
            onClick={requestOpenAddModal}
            className="bg-[var(--ink)] hover:bg-[var(--bg-input)] w-full sm:w-auto justify-center text-[var(--ink-inv)] hover:text-[var(--ink)] border border-[var(--border)] shadow-[2px_2px_0_var(--border)] active:shadow-none active:translate-y-[2px] active:translate-x-[2px] transition-all px-4 py-2 flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-widest shrink-0"
          >
            <Plus size={14} />
            <span>NUEVA UBICACION</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredLocations.map(loc => {
          const stats = getLocationStats(loc.id);
          const isExpanded = expandedLocations.has(loc.id);
          
          return (
            <div
              key={loc.id}
              className={cn("bg-[var(--bg-card)] border border-[var(--border)] p-4 flex flex-col gap-4 shadow-[4px_4px_0_rgba(20,20,20,0.1)] hover:shadow-[4px_4px_0_var(--border)] transition-all relative group cursor-pointer", stats.totalItems === 0 && "opacity-80 bg-gray-100/40")}
              onClick={(e) => stats.totalItems > 0 ? openDetail(loc, e) : toggleLocationExpand(loc.id, e)}
            >
              <div className="flex justify-between items-start">
                <div className="flex gap-2 items-center">
                  <div className={cn("bg-[var(--ink)] text-[var(--ink-inv)] p-1.5 shrink-0", stats.totalItems === 0 && "opacity-50")}><MapPin size={16}/></div>
                  <div className="flex flex-col">
                    <span className="font-mono text-sm font-black uppercase flex items-center gap-2">
                      {loc.name}
                      {stats.totalItems === 0 && <span className="bg-orange-500/15 text-orange-600 text-[8px] px-1.5 py-0.5 border border-orange-500/30">VACÍA</span>}
                    </span>
                    <span className="font-mono text-[9px] opacity-70 tracking-widest font-bold">{loc.type}</span>
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => { e.stopPropagation(); setQrLocation(loc); }}
                    className="p-1.5 border border-[var(--border)] text-[var(--ink)] hover:bg-[var(--ink)] hover:text-[var(--ink-inv)] transition-colors"
                    title="VER QR"
                  >
                    <QrCode size={12} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleEditClick(loc); }}
                    className="p-1.5 border border-[var(--border)] text-[var(--ink)] hover:bg-[var(--ink)] hover:text-[var(--ink-inv)] transition-colors"
                  >
                    <Edit2 size={12} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteClick(loc.id, e); }}
                    className="p-1.5 border border-red-700 text-red-700 hover:bg-red-700 hover:text-red-50 transition-colors"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 border-t border-[var(--border)]/10 pt-4">
                <div className="flex flex-col">
                  <span className="font-mono text-[9px] opacity-60 uppercase tracking-widest font-bold">TOTAL SKUs</span>
                  <span className="font-mono text-lg font-black">{stats.uniqueSKUs}</span>
                </div>
                <div className="flex flex-col">
                  <span className="font-mono text-[9px] opacity-60 uppercase tracking-widest font-bold">UNIDADES TOTALES</span>
                  <span className="font-mono text-lg font-black">{stats.totalItems}</span>
                </div>
              </div>
              {isExpanded && stats.locationProducts.length > 0 && (
                <div className="flex flex-col gap-2 border-t border-[var(--border)]/10 pt-4 max-h-48 overflow-y-auto pr-1">
                  <span className="font-mono text-[9px] opacity-60 uppercase tracking-widest font-bold">PRODUCTOS ALMACENADOS</span>
                  {stats.locationProducts.map((lp, i) => (
                    <div key={i} className="flex justify-between items-center text-[10px] font-mono border-b border-[var(--border)]/5 pb-1 group/item">
                      <div className="flex flex-col truncate pr-2">
                        <span className="font-bold truncate">{lp.product?.name || 'PRODUCTO DESCONOCIDO'}</span>
                        {(lp.product?.color || lp.product?.size) && <span className="text-[8px] opacity-70 truncate">{lp.product.color} {lp.product.size}</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="bg-[var(--ink)] text-[var(--ink-inv)] px-1.5 py-0.5 shrink-0 transition-opacity">{lp.quantity}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); if(lp.product) setConfirmDeleteStock({ productId: lp.product.id, locationId: loc.id }); }}
                          className="opacity-0 group-hover/item:opacity-100 text-red-600 hover:bg-red-500/15 p-1"
                          title="ELIMINAR PRODUCTO DEL ESTANTE"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {stats.locationProducts.length > 0 && (
                <div className="text-[9px] text-[var(--ink)] font-mono opacity-50 uppercase text-center mt-2 group-hover:opacity-100 transition-opacity">
                  VER PRODUCTOS ALMACENADOS ?
                </div>
              )}
            </div>
          )
        })}
      </div>

      {filteredLocations.length === 0 && (
         <div className="p-12 flex items-center justify-center text-[var(--ink)] opacity-50 font-mono text-sm uppercase border border-dashed border-[var(--border)]">NO HAY UBICACIONES REGISTRADAS</div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 transition-opacity">
          <div className="bg-[var(--bg)] border-4 border-[var(--border)] w-full max-w-sm shadow-[8px_8px_0_var(--border)] flex flex-col">
            <div className="p-3 border-b border-[var(--border)] bg-[var(--bg-sidebar)] flex justify-between items-center">
              <h2 className="font-serif italic font-bold text-xs uppercase tracking-widest">NUEVA UBICACION</h2>
              <button onClick={() => setShowAddModal(false)} className="opacity-60 hover:opacity-100 hover:bg-[var(--ink)] hover:text-[var(--ink-inv)] p-1 transition-all"><X size={16}/></button>
            </div>
            <form onSubmit={handleAddSubmit} className="p-5 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[9px] font-bold tracking-[0.2em] opacity-80 uppercase">NOMBRE UBICACION</label>
                <input 
                  required
                  value={newLocation.name}
                  onChange={e => setNewLocation({...newLocation, name: e.target.value})}
                  className="bg-[var(--bg-card-alt)] border border-[var(--border)] p-2 text-xs font-bold uppercase focus:bg-[var(--bg-input)] focus:outline-none focus:shadow-[2px_2px_0_var(--border)] rounded-none"
                  placeholder="EJ: PASILLO 2 - RACK A"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[9px] font-bold tracking-[0.2em] opacity-80 uppercase">TIPO</label>
                <select 
                  value={newLocation.type}
                  onChange={e => setNewLocation({...newLocation, type: e.target.value as any})}
                  className="bg-[var(--bg-card-alt)] border border-[var(--border)] p-2 text-xs font-bold uppercase font-mono focus:bg-[var(--bg-input)] focus:outline-none focus:shadow-[2px_2px_0_var(--border)] rounded-none"
                >
                  <option value="ZONE">ZONA PRINCIPAL</option>
                  <option value="RACK">ESTANTE / RACK</option>
                  <option value="BIN">GAVETA / BIN</option>
                  <option value="EXTERNAL">ALMACEN EXTERNO</option>
                  <option value="WAREHOUSE">BODEGA</option>
                </select>
              </div>
              <div className="mt-4 flex justify-end">
                <button type="submit" className="bg-[var(--ink)] text-[var(--ink-inv)] border border-[var(--border)] px-6 py-2.5 text-[10px] font-mono tracking-widest font-bold shadow-[4px_4px_0_var(--border)] hover:bg-[var(--bg-input)] hover:text-[var(--ink)] active:shadow-[0_0_0_var(--border)] active:translate-y-[4px] active:translate-x-[4px] transition-all">
                  CREAR_REGISTRO
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editingLocation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 transition-opacity">
          <div className="bg-[var(--bg)] border-4 border-[var(--border)] w-full max-w-sm shadow-[8px_8px_0_var(--border)] flex flex-col">
            <div className="p-3 border-b border-[var(--border)] bg-[var(--bg-sidebar)] flex justify-between items-center">
              <h2 className="font-serif italic font-bold text-xs uppercase tracking-widest">EDITAR UBICACION</h2>
              <button onClick={requestCloseEditModal} className="opacity-60 hover:opacity-100 hover:bg-[var(--ink)] hover:text-[var(--ink-inv)] p-1 transition-all"><X size={16}/></button>
            </div>
            <form onSubmit={handleEditSubmit} className="p-5 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[9px] font-bold tracking-[0.2em] opacity-80 uppercase">NOMBRE UBICACION</label>
                <input 
                  required
                  value={editingLocation.name}
                  onChange={e => setEditingLocation({...editingLocation, name: e.target.value})}
                  className="bg-[var(--bg-card-alt)] border border-[var(--border)] p-2 text-xs font-bold uppercase focus:bg-[var(--bg-input)] focus:outline-none focus:shadow-[2px_2px_0_var(--border)] rounded-none"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[9px] font-bold tracking-[0.2em] opacity-80 uppercase">TIPO</label>
                <select 
                  value={editingLocation.type}
                  onChange={e => setEditingLocation({...editingLocation, type: e.target.value as any})}
                  className="bg-[var(--bg-card-alt)] border border-[var(--border)] p-2 text-xs font-bold uppercase font-mono focus:bg-[var(--bg-input)] focus:outline-none focus:shadow-[2px_2px_0_var(--border)] rounded-none"
                >
                  <option value="ZONE">ZONA PRINCIPAL</option>
                  <option value="RACK">ESTANTE / RACK</option>
                  <option value="BIN">GAVETA / BIN</option>
                  <option value="EXTERNAL">ALMACEN EXTERNO</option>
                  <option value="WAREHOUSE">BODEGA</option>
                </select>
              </div>
              <div className="mt-4 flex justify-end">
                <button type="submit" className="bg-[var(--ink)] text-[var(--ink-inv)] border border-[var(--border)] px-6 py-2.5 text-[10px] font-mono tracking-widest font-bold shadow-[4px_4px_0_var(--border)] hover:bg-[var(--bg-input)] hover:text-[var(--ink)] active:shadow-[0_0_0_var(--border)] active:translate-y-[4px] active:translate-x-[4px] transition-all">
                  GUARDAR_CAMBIOS
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingLocationId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 transition-opacity">
          <div className="bg-[var(--bg)] border-4 border-red-700 w-full max-w-sm shadow-[8px_8px_0_#b91c1c] flex flex-col">
            <div className="p-3 border-b border-red-700 bg-red-500/15 flex justify-between items-center text-red-600">
              <div className="flex items-center gap-2">
                <AlertTriangle size={16} />
                <h2 className="font-serif italic font-bold text-xs uppercase tracking-widest">ELIMINAR UBICACION</h2>
              </div>
              <button onClick={() => setDeletingLocationId(null)} className="opacity-60 hover:opacity-100 hover:bg-red-700 hover:text-white p-1 transition-all"><X size={16}/></button>
            </div>
            <div className="p-5 flex flex-col gap-6">
              <p className="font-mono text-sm font-bold uppercase text-center leading-relaxed">
                -Est-s seguro de que deseas eliminar esta ubicacion? Esta accion no se puede deshacer.
              </p>
              <div className="flex justify-between gap-4 mt-2">
                <button 
                  onClick={() => setDeletingLocationId(null)}
                  className="flex-1 bg-[var(--bg-input)] border border-[var(--border)] text-[var(--ink)] px-4 py-2 text-[10px] font-mono tracking-widest font-bold hover:bg-[var(--ink)] hover:text-white transition-all shadow-[2px_2px_0_var(--border)]"
                >
                  CANCELAR
                </button>
                <button 
                  onClick={confirmDelete}
                  className="flex-1 bg-red-700 border border-red-700 text-white px-4 py-2 text-[10px] font-mono tracking-widest font-bold hover:bg-red-800 transition-all shadow-[2px_2px_0_#991b1b]"
                >
                  CONFIRMAR
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Discard Confirmation Modal */}
      {showDiscardModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 transition-opacity">
          <div className="bg-[var(--bg)] border-4 border-[var(--border)] w-full max-w-sm shadow-[8px_8px_0_var(--border)] flex flex-col">
            <div className="p-3 border-b border-[var(--border)] bg-[var(--bg-sidebar)] flex justify-between items-center">
              <h2 className="font-serif italic font-bold text-xs uppercase tracking-widest">CAMBIOS SIN GUARDAR</h2>
              <button onClick={() => setShowDiscardModal(false)} className="opacity-60 hover:opacity-100 hover:bg-[var(--ink)] hover:text-[var(--ink-inv)] p-1 transition-all"><X size={16}/></button>
            </div>
            <div className="p-5 flex flex-col gap-6">
              <p className="font-mono text-sm font-bold uppercase text-center leading-relaxed">
                You have unsaved changes. Do you want to save them before leaving?
              </p>
              <div className="flex justify-between gap-4 mt-2">
                <button 
                  onClick={confirmDiscard}
                  className="flex-1 bg-[var(--bg-input)] border border-[var(--border)] text-[var(--ink)] px-4 py-2 text-[10px] font-mono tracking-widest font-bold hover:bg-[var(--ink)] hover:text-white transition-all shadow-[2px_2px_0_var(--border)]"
                >
                  Discard
                </button>
                <button 
                  onClick={confirmSave}
                  className="flex-1 bg-blue-700 border border-blue-700 text-white px-4 py-2 text-[10px] font-mono tracking-widest font-bold hover:bg-blue-800 transition-all shadow-[2px_2px_0_#1d4ed8]"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteStock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-[var(--bg)] border-4 border-red-700 w-full max-w-sm shadow-[8px_8px_0_#b91c1c] flex flex-col">
            <div className="p-3 border-b border-red-700 bg-red-500/15 flex items-center gap-2 text-red-600">
              <AlertTriangle size={16} />
              <h2 className="font-serif italic font-bold text-xs uppercase tracking-widest">ELIMINAR STOCK</h2>
            </div>
            <div className="p-5 flex flex-col gap-6">
              <p className="font-mono text-sm font-bold uppercase text-center leading-relaxed">
                -Est-s seguro de que deseas eliminar este producto del estante? Esta accion no se puede deshacer.
              </p>
              <div className="flex justify-between gap-4 mt-2">
                <button
                  onClick={() => setConfirmDeleteStock(null)}
                  className="flex-1 bg-[var(--bg-input)] border border-[var(--border)] text-[var(--ink)] px-4 py-2 text-[10px] font-mono tracking-widest font-bold hover:bg-[var(--ink)] hover:text-white transition-all shadow-[2px_2px_0_var(--border)]"
                >
                  CANCELAR
                </button>
                <button
                  onClick={() => { deleteStockLevel(confirmDeleteStock.productId, confirmDeleteStock.locationId); setConfirmDeleteStock(null); }}
                  className="flex-1 bg-red-700 border border-red-700 text-white px-4 py-2 text-[10px] font-mono tracking-widest font-bold hover:bg-red-800 transition-all shadow-[2px_2px_0_#991b1b]"
                >
                  CONFIRMAR
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Location detail modal */}
      {detailLocation && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--bg)] border border-[var(--border)] shadow-[6px_6px_0_var(--border)] w-full max-w-4xl max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="border-b border-[var(--border)] px-5 py-3 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <button onClick={() => setDetailLocation(null)} className="flex items-center gap-1 font-mono text-[10px] opacity-60 hover:opacity-100 transition-opacity">
                  <ChevronLeft size={13} /> VOLVER
                </button>
                <span className="font-mono text-[10px] opacity-30">|</span>
                <MapPin size={13} className="opacity-50" />
                <span className="font-mono font-bold text-xs uppercase tracking-widest">{detailLocation.name}</span>
                <span className="font-mono text-[9px] opacity-50 border border-[var(--border)]/30 px-1.5 py-0.5">{detailLocation.type}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-[10px] opacity-50">{detailItems.length} SKUs · {detailItems.reduce((s, i) => s + i.quantity, 0)} uds.</span>
                <button onClick={() => setDetailLocation(null)} className="font-mono text-xs opacity-60 hover:opacity-100">?</button>
              </div>
            </div>

            {/* Filters */}
            <div className="border-b border-[var(--border)]/20 px-5 py-3 flex flex-wrap gap-2 shrink-0 bg-[var(--surface-alt)]">
              {/* Producto */}
              <div className="flex flex-col gap-1 min-w-0">
                <span className="font-mono text-[8px] uppercase tracking-widest opacity-50 font-bold">Producto</span>
                <div className="flex flex-wrap gap-1">
                  <button onClick={() => { setDetailFilterName(''); setDetailFilterColor(''); setDetailFilterSize(''); }}
                    className={`px-2.5 py-1 text-[9px] font-mono font-bold border transition-all ${!detailFilterName ? 'bg-[var(--ink)] text-[var(--ink-inv)] border-[var(--border)]' : 'border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--bg-input)]'}`}>
                    TODOS
                  </button>
                  {detailNames.map(n => (
                    <button key={n} onClick={() => { setDetailFilterName(detailFilterName === n ? '' : n); setDetailFilterColor(''); setDetailFilterSize(''); }}
                      className={`px-2.5 py-1 text-[9px] font-mono font-bold border transition-all ${detailFilterName === n ? 'bg-[var(--ink)] text-[var(--ink-inv)] border-[var(--border)]' : 'border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--bg-input)]'}`}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              {detailColors.length > 0 && (
                <div className="flex flex-col gap-1 min-w-0">
                  <span className="font-mono text-[8px] uppercase tracking-widest opacity-50 font-bold">Color</span>
                  <div className="flex flex-wrap gap-1">
                    <button onClick={() => { setDetailFilterColor(''); setDetailFilterSize(''); }}
                      className={`px-2.5 py-1 text-[9px] font-mono font-bold border transition-all ${!detailFilterColor ? 'bg-[var(--ink)] text-[var(--ink-inv)] border-[var(--border)]' : 'border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--bg-input)]'}`}>
                      TODOS
                    </button>
                    {detailColors.map(c => (
                      <button key={c} onClick={() => { setDetailFilterColor(detailFilterColor === c ? '' : c); setDetailFilterSize(''); }}
                        className={`px-2.5 py-1 text-[9px] font-mono font-bold border transition-all ${detailFilterColor === c ? 'bg-[var(--ink)] text-[var(--ink-inv)] border-[var(--border)]' : 'border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--bg-input)]'}`}>
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {detailSizes.length > 0 && (
                <div className="flex flex-col gap-1 min-w-0">
                  <span className="font-mono text-[8px] uppercase tracking-widest opacity-50 font-bold">Talla</span>
                  <div className="flex flex-wrap gap-1">
                    <button onClick={() => setDetailFilterSize('')}
                      className={`px-2.5 py-1 text-[9px] font-mono font-bold border transition-all ${!detailFilterSize ? 'bg-[var(--ink)] text-[var(--ink-inv)] border-[var(--border)]' : 'border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--bg-input)]'}`}>
                      TODAS
                    </button>
                    {detailSizes.map(s => (
                      <button key={s} onClick={() => setDetailFilterSize(detailFilterSize === s ? '' : s)}
                        className={`min-w-[36px] px-2.5 py-1 text-[9px] font-mono font-bold border transition-all ${detailFilterSize === s ? 'bg-[var(--ink)] text-[var(--ink-inv)] border-[var(--border)]' : 'border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--bg-input)]'}`}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Product grid */}
            <div className="overflow-y-auto p-5 flex-1">
              {detailFiltered.length === 0 ? (
                <div className="text-center font-mono text-xs opacity-40 py-12 uppercase tracking-widest">Sin productos con esos filtros</div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {detailFiltered.map(item => (
                    <div key={`${item.productId}-${item.locationId}`}
                      className="border border-[var(--border)] bg-[var(--surface)] flex flex-col p-3 gap-2 hover:bg-[var(--bg-input)] transition-colors">
                      <div className="font-mono text-[8px] opacity-50 font-bold uppercase tracking-wide truncate">
                        {item.product!.code}
                      </div>
                      <div className="font-mono font-black text-xs uppercase leading-tight">
                        {item.product!.name}
                      </div>
                      {(item.product!.color || item.product!.size) && (
                        <div className="flex flex-wrap gap-1">
                          {item.product!.color && (
                            <span className="font-mono text-[8px] border border-[var(--border)]/30 px-1.5 py-0.5 uppercase bg-[var(--surface)]">
                              {item.product!.color}
                            </span>
                          )}
                          {item.product!.size && (
                            <span className="font-mono text-[8px] border border-[var(--border)]/30 px-1.5 py-0.5 uppercase bg-[var(--surface)]">
                              {item.product!.size}
                            </span>
                          )}
                        </div>
                      )}
                      <div className="mt-auto pt-2 border-t border-[var(--border)]/10 flex items-end justify-between">
                        <span className="font-mono text-[8px] opacity-40 uppercase">uds.</span>
                        <span className="font-mono font-black text-2xl leading-none">{item.quantity}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer count */}
            <div className="border-t border-[var(--border)]/20 px-5 py-2 shrink-0 flex justify-between items-center bg-[var(--surface-alt)]">
              <span className="font-mono text-[9px] opacity-40 uppercase tracking-widest">
                {detailFiltered.length} SKUs mostrados · {detailFiltered.reduce((s, i) => s + i.quantity, 0)} unidades
              </span>
            </div>
          </div>
        </div>
      )}

      {qrLocation && (
        <QRModal
          item={{ kind: 'location', id: qrLocation.id, name: qrLocation.name, type: qrLocation.type, brand: activeBrand }}
          onClose={() => setQrLocation(null)}
        />
      )}
    </div>
  );
};

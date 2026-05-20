import React, { useState } from 'react';
import { useAppContext } from '../store/AppContext';
import { ModuleInfo } from '../components/ModuleInfo';
import { Search, Plus, X, Edit2, MapPin, Trash2, AlertTriangle } from 'lucide-react';
import { Location } from '../types';
import { cn } from '../lib/utils';

export const Locations: React.FC = () => {
  const { locations, stockLevels, products, addLocation, updateLocation, deleteLocation, deleteStockLevel } = useAppContext();
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('ALL');
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [newLocation, setNewLocation] = useState<{name: string, type: 'ZONE' | 'RACK' | 'BIN' | 'EXTERNAL' | 'WAREHOUSE'}>({ name: '', type: 'ZONE' });

  const [showEditModal, setShowEditModal] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [initialEditingLocation, setInitialEditingLocation] = useState<Location | null>(null);
  
  const [showDiscardModal, setShowDiscardModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  const [deletingLocationId, setDeletingLocationId] = useState<string | null>(null);
  
  const [feedback, setFeedback] = useState<{type: 'success' | 'error', message: string} | null>(null);

  const [expandedLocations, setExpandedLocations] = useState<Set<string>>(new Set());

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
      showFeedback('success', 'UBICACIÓN REGISTRADA CORRECTAMENTE');
    }
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingLocation && editingLocation.name) {
      updateLocation(editingLocation);
      setShowEditModal(false);
      setEditingLocation(null);
      setInitialEditingLocation(null);
      showFeedback('success', 'UBICACIÓN ACTUALIZADA CORRECTAMENTE');
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
      showFeedback('success', 'UBICACIÓN ACTUALIZADA CORRECTAMENTE');
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
      showFeedback('success', 'UBICACIÓN ELIMINADA');
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

  return (
    <div className="flex flex-col gap-6 h-full relative">
      <ModuleInfo number="04" title="Ubicaciones" description="Gestión de la estructura física del almacén: define zonas, estantes y ubicaciones donde se almacenan los productos con control de capacidad." />
      {feedback && (
        <div className={cn("absolute top-0 right-0 z-50 p-4 border font-bold font-mono text-xs uppercase tracking-widest flex items-center gap-2 shadow-[4px_4px_0_rgba(0,0,0,0.2)]", feedback.type === 'success' ? "bg-green-100 border-green-700 text-green-800" : "bg-red-100 border-red-700 text-red-800")}>
          {feedback.message}
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 border-b border-[#141414] pb-3">
        <div>
          <h2 className="font-serif italic font-bold text-xs uppercase tracking-widest">02 // Gestión_Ubicaciones</h2>
          <p className="font-mono text-[10px] opacity-70 uppercase tracking-wide mt-1">Estructura del almacén y zonas.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 w-full sm:w-64">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-50" />
            <input 
              type="text"
              placeholder="BUSCAR UBICACIÓN..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-white/50 border border-[#141414] items-center px-9 py-2 text-[10px] font-bold text-[#141414] focus:outline-none focus:bg-white focus:shadow-[2px_2px_0_#141414] transition-all font-mono uppercase"
            />
          </div>
          <select 
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            className="w-full sm:w-auto bg-white/50 border border-[#141414] py-2 px-3 text-[10px] font-bold text-[#141414] focus:outline-none focus:bg-white focus:shadow-[2px_2px_0_#141414] transition-all font-mono uppercase"
          >
            <option value="ALL">TODOS LOS TIPOS</option>
            <option value="ZONE">ZONA PRINCIPAL</option>
            <option value="RACK">ESTANTE / RACK</option>
            <option value="BIN">GAVETA / BIN</option>
            <option value="EXTERNAL">ALMACÉN EXTERNO</option>
            <option value="WAREHOUSE">BODEGA</option>
          </select>
          <button 
            onClick={requestOpenAddModal}
            className="bg-[#141414] hover:bg-white w-full sm:w-auto justify-center text-[#E4E3E0] hover:text-[#141414] border border-[#141414] shadow-[2px_2px_0_#141414] active:shadow-none active:translate-y-[2px] active:translate-x-[2px] transition-all px-4 py-2 flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-widest shrink-0"
          >
            <Plus size={14} />
            <span>NUEVA UBICACIÓN</span>
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
              className={cn("bg-white/40 border border-[#141414] p-4 flex flex-col gap-4 shadow-[4px_4px_0_rgba(20,20,20,0.1)] hover:shadow-[4px_4px_0_#141414] transition-all relative group cursor-pointer", stats.totalItems === 0 && "opacity-80 bg-gray-100/40")}
              onClick={(e) => toggleLocationExpand(loc.id, e)}
            >
              <div className="flex justify-between items-start">
                <div className="flex gap-2 items-center">
                  <div className={cn("bg-[#141414] text-[#E4E3E0] p-1.5 shrink-0", stats.totalItems === 0 && "opacity-50")}><MapPin size={16}/></div>
                  <div className="flex flex-col">
                    <span className="font-mono text-sm font-black uppercase flex items-center gap-2">
                      {loc.name}
                      {stats.totalItems === 0 && <span className="bg-orange-100 text-orange-800 text-[8px] px-1.5 py-0.5 border border-orange-200">VACÍA</span>}
                    </span>
                    <span className="font-mono text-[9px] opacity-70 tracking-widest font-bold">{loc.type}</span>
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleEditClick(loc); }}
                    className="p-1.5 border border-[#141414] text-[#141414] hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors"
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
              <div className="grid grid-cols-2 gap-4 border-t border-[#141414]/10 pt-4">
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
                <div className="flex flex-col gap-2 border-t border-[#141414]/10 pt-4 max-h-48 overflow-y-auto pr-1">
                  <span className="font-mono text-[9px] opacity-60 uppercase tracking-widest font-bold">PRODUCTOS ALMACENADOS</span>
                  {stats.locationProducts.map((lp, i) => (
                    <div key={i} className="flex justify-between items-center text-[10px] font-mono border-b border-[#141414]/5 pb-1 group/item">
                      <div className="flex flex-col truncate pr-2">
                        <span className="font-bold truncate">{lp.product?.name || 'PRODUCTO DESCONOCIDO'}</span>
                        {(lp.product?.color || lp.product?.size) && <span className="text-[8px] opacity-70 truncate">{lp.product.color} {lp.product.size}</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="bg-[#141414] text-[#E4E3E0] px-1.5 py-0.5 shrink-0 transition-opacity">{lp.quantity}</span>
                        <button 
                          onClick={(e) => { e.stopPropagation(); if(lp.product) deleteStockLevel(lp.product.id, loc.id); }}
                          className="opacity-0 group-hover/item:opacity-100 text-red-600 hover:bg-red-100 p-1"
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
                <div className="text-[9px] text-[#141414] font-mono opacity-50 uppercase text-center mt-2 group-hover:opacity-100 transition-opacity">
                  {isExpanded ? 'OCULTAR PRODUCTOS' : 'VER PRODUCTOS ALMACENADOS'}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {filteredLocations.length === 0 && (
         <div className="p-12 flex items-center justify-center text-[#141414] opacity-50 font-mono text-sm uppercase border border-dashed border-[#141414]">NO HAY UBICACIONES REGISTRADAS</div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 transition-opacity">
          <div className="bg-[#E4E3E0] border-4 border-[#141414] w-full max-w-sm shadow-[8px_8px_0_#141414] flex flex-col">
            <div className="p-3 border-b border-[#141414] bg-[#D4D3D0] flex justify-between items-center">
              <h2 className="font-serif italic font-bold text-xs uppercase tracking-widest">NUEVA UBICACIÓN</h2>
              <button onClick={() => setShowAddModal(false)} className="opacity-60 hover:opacity-100 hover:bg-[#141414] hover:text-[#E4E3E0] p-1 transition-all"><X size={16}/></button>
            </div>
            <form onSubmit={handleAddSubmit} className="p-5 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[9px] font-bold tracking-[0.2em] opacity-80 uppercase">NOMBRE UBICACIÓN</label>
                <input 
                  required
                  value={newLocation.name}
                  onChange={e => setNewLocation({...newLocation, name: e.target.value})}
                  className="bg-white/70 border border-[#141414] p-2 text-xs font-bold uppercase focus:bg-white focus:outline-none focus:shadow-[2px_2px_0_#141414] rounded-none"
                  placeholder="EJ: PASILLO 2 - RACK A"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[9px] font-bold tracking-[0.2em] opacity-80 uppercase">TIPO</label>
                <select 
                  value={newLocation.type}
                  onChange={e => setNewLocation({...newLocation, type: e.target.value as any})}
                  className="bg-white/70 border border-[#141414] p-2 text-xs font-bold uppercase font-mono focus:bg-white focus:outline-none focus:shadow-[2px_2px_0_#141414] rounded-none"
                >
                  <option value="ZONE">ZONA PRINCIPAL</option>
                  <option value="RACK">ESTANTE / RACK</option>
                  <option value="BIN">GAVETA / BIN</option>
                  <option value="EXTERNAL">ALMACÉN EXTERNO</option>
                  <option value="WAREHOUSE">BODEGA</option>
                </select>
              </div>
              <div className="mt-4 flex justify-end">
                <button type="submit" className="bg-[#141414] text-[#E4E3E0] border border-[#141414] px-6 py-2.5 text-[10px] font-mono tracking-widest font-bold shadow-[4px_4px_0_#141414] hover:bg-white hover:text-[#141414] active:shadow-[0_0_0_#141414] active:translate-y-[4px] active:translate-x-[4px] transition-all">
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
          <div className="bg-[#E4E3E0] border-4 border-[#141414] w-full max-w-sm shadow-[8px_8px_0_#141414] flex flex-col">
            <div className="p-3 border-b border-[#141414] bg-[#D4D3D0] flex justify-between items-center">
              <h2 className="font-serif italic font-bold text-xs uppercase tracking-widest">EDITAR UBICACIÓN</h2>
              <button onClick={requestCloseEditModal} className="opacity-60 hover:opacity-100 hover:bg-[#141414] hover:text-[#E4E3E0] p-1 transition-all"><X size={16}/></button>
            </div>
            <form onSubmit={handleEditSubmit} className="p-5 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[9px] font-bold tracking-[0.2em] opacity-80 uppercase">NOMBRE UBICACIÓN</label>
                <input 
                  required
                  value={editingLocation.name}
                  onChange={e => setEditingLocation({...editingLocation, name: e.target.value})}
                  className="bg-white/70 border border-[#141414] p-2 text-xs font-bold uppercase focus:bg-white focus:outline-none focus:shadow-[2px_2px_0_#141414] rounded-none"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[9px] font-bold tracking-[0.2em] opacity-80 uppercase">TIPO</label>
                <select 
                  value={editingLocation.type}
                  onChange={e => setEditingLocation({...editingLocation, type: e.target.value as any})}
                  className="bg-white/70 border border-[#141414] p-2 text-xs font-bold uppercase font-mono focus:bg-white focus:outline-none focus:shadow-[2px_2px_0_#141414] rounded-none"
                >
                  <option value="ZONE">ZONA PRINCIPAL</option>
                  <option value="RACK">ESTANTE / RACK</option>
                  <option value="BIN">GAVETA / BIN</option>
                  <option value="EXTERNAL">ALMACÉN EXTERNO</option>
                  <option value="WAREHOUSE">BODEGA</option>
                </select>
              </div>
              <div className="mt-4 flex justify-end">
                <button type="submit" className="bg-[#141414] text-[#E4E3E0] border border-[#141414] px-6 py-2.5 text-[10px] font-mono tracking-widest font-bold shadow-[4px_4px_0_#141414] hover:bg-white hover:text-[#141414] active:shadow-[0_0_0_#141414] active:translate-y-[4px] active:translate-x-[4px] transition-all">
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
          <div className="bg-[#E4E3E0] border-4 border-red-700 w-full max-w-sm shadow-[8px_8px_0_#b91c1c] flex flex-col">
            <div className="p-3 border-b border-red-700 bg-red-100 flex justify-between items-center text-red-900">
              <div className="flex items-center gap-2">
                <AlertTriangle size={16} />
                <h2 className="font-serif italic font-bold text-xs uppercase tracking-widest">ELIMINAR UBICACIÓN</h2>
              </div>
              <button onClick={() => setDeletingLocationId(null)} className="opacity-60 hover:opacity-100 hover:bg-red-700 hover:text-white p-1 transition-all"><X size={16}/></button>
            </div>
            <div className="p-5 flex flex-col gap-6">
              <p className="font-mono text-sm font-bold uppercase text-center leading-relaxed">
                ¿Estás seguro de que deseas eliminar esta ubicación? Esta acción no se puede deshacer.
              </p>
              <div className="flex justify-between gap-4 mt-2">
                <button 
                  onClick={() => setDeletingLocationId(null)}
                  className="flex-1 bg-white border border-[#141414] text-[#141414] px-4 py-2 text-[10px] font-mono tracking-widest font-bold hover:bg-[#141414] hover:text-white transition-all shadow-[2px_2px_0_#141414]"
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
          <div className="bg-[#E4E3E0] border-4 border-[#141414] w-full max-w-sm shadow-[8px_8px_0_#141414] flex flex-col">
            <div className="p-3 border-b border-[#141414] bg-[#D4D3D0] flex justify-between items-center">
              <h2 className="font-serif italic font-bold text-xs uppercase tracking-widest">CAMBIOS SIN GUARDAR</h2>
              <button onClick={() => setShowDiscardModal(false)} className="opacity-60 hover:opacity-100 hover:bg-[#141414] hover:text-[#E4E3E0] p-1 transition-all"><X size={16}/></button>
            </div>
            <div className="p-5 flex flex-col gap-6">
              <p className="font-mono text-sm font-bold uppercase text-center leading-relaxed">
                You have unsaved changes. Do you want to save them before leaving?
              </p>
              <div className="flex justify-between gap-4 mt-2">
                <button 
                  onClick={confirmDiscard}
                  className="flex-1 bg-white border border-[#141414] text-[#141414] px-4 py-2 text-[10px] font-mono tracking-widest font-bold hover:bg-[#141414] hover:text-white transition-all shadow-[2px_2px_0_#141414]"
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

    </div>
  );
};

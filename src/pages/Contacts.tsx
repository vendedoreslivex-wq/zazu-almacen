import React, { useState } from 'react';
import { useAppContext } from '../store/AppContext';
import { ModuleInfo } from '../components/ModuleInfo';
import { Search, Plus, Trash2, Edit2 } from 'lucide-react';
import { Contact } from '../types';

export const Contacts: React.FC = () => {
  const { contacts, addContact, updateContact, deleteContact } = useAppContext();
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('ALL');
  
  const [showModal, setShowModal] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  
  const [formData, setFormData] = useState<{type: 'SUPPLIER'|'CLIENT', name: string, document: string, phone: string, email: string}>({
    type: 'SUPPLIER', name: '', document: '', phone: '', email: ''
  });

  const filteredContacts = contacts.filter(c => {
    const searchMatch = c.name.toLowerCase().includes(search.toLowerCase()) || c.document.toLowerCase().includes(search.toLowerCase());
    const typeMatch = filterType === 'ALL' || c.type === filterType;
    return searchMatch && typeMatch;
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.document) return;
    
    if (editingContact) {
      updateContact({ ...editingContact, ...formData });
    } else {
      addContact(formData);
    }
    
    setShowModal(false);
    setEditingContact(null);
    setFormData({ type: 'SUPPLIER', name: '', document: '', phone: '', email: '' });
  };

  const openEdit = (c: Contact) => {
    setEditingContact(c);
    setFormData({
      type: c.type,
      name: c.name,
      document: c.document,
      phone: c.phone || '',
      email: c.email || ''
    });
    setShowModal(true);
  };

  return (
    <div className="flex flex-col gap-6 h-full relative">
      <ModuleInfo number="09" title="Contactos" description="Directorio de proveedores y clientes vinculados a las operaciones del almacén: datos de contacto, RUC y tipo de relación comercial." />
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 border-b border-[#141414] pb-3">
        <div>
          <h2 className="font-serif italic font-bold text-xs uppercase tracking-widest text-[#141414]">04 // DATOS_CONTACTOS</h2>
          <p className="font-mono text-[10px] opacity-70 uppercase tracking-wide mt-1">Gestión de Proveedores y Clientes.</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap sm:flex-nowrap">
          <div className="flex flex-col gap-1 items-start w-1/2 sm:w-32 lg:w-40">
            <select 
              value={filterType} 
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full bg-white/50 border border-[#141414] py-2 px-2 text-[10px] font-bold text-[#141414] focus:outline-none focus:bg-white focus:shadow-[2px_2px_0_#141414] transition-all font-mono uppercase cursor-pointer h-[38px]"
            >
              <option value="ALL">TIPO (TODOS)</option>
              <option value="SUPPLIER">PROVEEDOR</option>
              <option value="CLIENT">CLIENTE</option>
            </select>
          </div>
          <div className="relative flex-1 min-w-[150px] sm:w-48 lg:w-56">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-50" />
            <input 
              type="text" 
              placeholder="BUSCAR CONTACTO..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-transparent border border-[#141414] py-2 pl-9 pr-4 text-[10px] font-bold focus:outline-none focus:bg-white focus:shadow-[2px_2px_0_#141414] transition-all font-mono uppercase h-[38px]"
            />
          </div>
          <button 
            onClick={() => {
              setEditingContact(null);
              setFormData({ type: 'SUPPLIER', name: '', document: '', phone: '', email: '' });
              setShowModal(true);
            }}
            className="bg-[#141414] hover:bg-white text-[#E4E3E0] hover:text-[#141414] border border-[#141414] shadow-[2px_2px_0_#141414] active:shadow-none active:translate-y-[2px] active:translate-x-[2px] transition-all px-4 py-2 flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-widest shrink-0 h-[38px]"
          >
            <Plus size={14} />
            <span className="hidden md:inline">NUEVO CONTACTO</span>
          </button>
        </div>
      </div>

      <div className="data-table-container flex-1 overflow-hidden flex flex-col">
        <div className="grid grid-cols-[100px_minmax(150px,1fr)_120px_120px_minmax(150px,1fr)_100px] border-b border-[#141414] p-3 bg-[#D4D3D0] text-[9px] font-bold uppercase tracking-widest opacity-80 font-mono">
          <div>TIPO</div>
          <div>NOMBRE EMPRESA/CLIENTE</div>
          <div>RUC / DNI</div>
          <div>TELÉFONO</div>
          <div>CORREO</div>
          <div className="text-right">ACCIONES</div>
        </div>
        
        <div className="flex-1 overflow-auto">
          {filteredContacts.map(c => (
            <div key={c.id} className="grid grid-cols-[100px_minmax(150px,1fr)_120px_120px_minmax(150px,1fr)_100px] data-row items-center py-3">
              <div className="font-mono text-[9px] font-black uppercase">
                <span className={`px-2 py-0.5 ${c.type === 'SUPPLIER' ? 'bg-[#141414] text-white' : 'bg-gray-300 text-black border border-[#141414]'}`}>
                  {c.type === 'SUPPLIER' ? 'PROVEEDOR' : 'CLIENTE'}
                </span>
              </div>
              <div className="font-mono text-[11px] font-black truncate pr-2">{c.name}</div>
              <div className="font-mono text-[10px] opacity-80">{c.document}</div>
              <div className="font-mono text-[10px] opacity-80">{c.phone || '---'}</div>
              <div className="font-mono text-[10px] opacity-80 truncate pr-2">{c.email || '---'}</div>
              <div className="flex items-center justify-end gap-2 pr-2">
                <button onClick={() => openEdit(c)} className="p-1 hover:bg-[#141414] hover:text-white transition-colors border border-transparent hover:border-[#141414]">
                  <Edit2 size={12} />
                </button>
                <button onClick={() => deleteContact(c.id)} className="p-1 hover:bg-red-700 hover:text-white transition-colors border border-transparent hover:border-red-700 text-red-600">
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
          {filteredContacts.length === 0 && (
            <div className="p-12 text-center font-mono text-sm opacity-50 font-bold uppercase">NO HAY CONTACTOS REGISTRADOS</div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 bg-[#E4E3E0]/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleSubmit} className="bg-[#E4E3E0] border-2 border-[#141414] shadow-[8px_8px_0_#141414] w-full max-w-md">
            <div className="border-b-2 border-[#141414] p-4 flex justify-between items-center bg-white">
              <h2 className="font-serif italic font-bold text-xs uppercase tracking-widest text-[#141414]">{editingContact ? 'EDITAR CONTACTO' : 'NUEVO CONTACTO'}</h2>
            </div>
            
            <div className="p-5 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[9px] font-bold tracking-[0.2em] opacity-80 uppercase">TIPO</label>
                <select 
                  value={formData.type}
                  onChange={e => setFormData({...formData, type: e.target.value as 'SUPPLIER'|'CLIENT'})}
                  className="bg-white/70 border border-[#141414] p-2 text-xs font-bold uppercase focus:bg-white focus:outline-none focus:shadow-[2px_2px_0_#141414] transition-all rounded-none"
                >
                  <option value="SUPPLIER">PROVEEDOR</option>
                  <option value="CLIENT">CLIENTE</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[9px] font-bold tracking-[0.2em] opacity-80 uppercase">NOMBRE / RAZÓN SOCIAL *</label>
                <input 
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="bg-white/70 border border-[#141414] p-2 text-xs font-bold uppercase focus:bg-white focus:outline-none focus:shadow-[2px_2px_0_#141414] transition-all rounded-none"
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[9px] font-bold tracking-[0.2em] opacity-80 uppercase">RUC / DNI *</label>
                <input 
                  value={formData.document}
                  onChange={e => setFormData({...formData, document: e.target.value})}
                  className="bg-white/70 border border-[#141414] p-2 text-xs font-bold font-mono focus:bg-white focus:outline-none focus:shadow-[2px_2px_0_#141414] transition-all rounded-none"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="font-mono text-[9px] font-bold tracking-[0.2em] opacity-80 uppercase">TELÉFONO</label>
                  <input 
                    value={formData.phone}
                    onChange={e => setFormData({...formData, phone: e.target.value})}
                    className="bg-white/70 border border-[#141414] p-2 text-xs font-bold font-mono focus:bg-white focus:outline-none focus:shadow-[2px_2px_0_#141414] transition-all rounded-none"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="font-mono text-[9px] font-bold tracking-[0.2em] opacity-80 uppercase">CORREO</label>
                  <input 
                    type="email"
                    value={formData.email}
                    onChange={e => setFormData({...formData, email: e.target.value})}
                    className="bg-white/70 border border-[#141414] p-2 text-xs font-bold font-mono focus:bg-white focus:outline-none focus:shadow-[2px_2px_0_#141414] transition-all rounded-none"
                  />
                </div>
              </div>
              
              <div className="mt-4 flex justify-end gap-3">
                <button 
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-widest opacity-70 hover:opacity-100 transition-opacity"
                >
                  CANCELAR
                </button>
                <button 
                  type="submit"
                  className="bg-[#141414] text-[#E4E3E0] px-4 py-2 text-[10px] font-mono tracking-widest font-bold hover:bg-black transition-all shadow-[2px_2px_0_#141414]"
                >
                  GUARDAR
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

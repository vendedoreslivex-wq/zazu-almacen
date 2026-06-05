import React, { useState, useMemo } from 'react';
import { useAppContext } from '../store/AppContext';
import { ModuleInfo } from '../components/ModuleInfo';
import { Search, Plus, Trash2, Edit2, History, X, AlertTriangle } from 'lucide-react';
import { Contact } from '../types';
import { format } from 'date-fns';

export const Contacts: React.FC = () => {
  const { contacts, addContact, updateContact, deleteContact, transactions, products } = useAppContext();
  const [historyContact, setHistoryContact] = useState<Contact | null>(null);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('ALL');
  
  const [showModal, setShowModal] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 border-b border-[var(--border)] pb-3">
        <div>
          <h2 className="font-serif italic font-bold text-xs uppercase tracking-widest text-[var(--ink)]">04 // DATOS_CONTACTOS</h2>
          <p className="font-mono text-[10px] opacity-70 uppercase tracking-wide mt-1">Gestión de Proveedores y Clientes.</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap sm:flex-nowrap">
          <div className="flex flex-col gap-1 items-start w-1/2 sm:w-32 lg:w-40">
            <select 
              value={filterType} 
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full bg-[var(--surface)] border border-[var(--border)] py-2 px-2 text-[10px] font-bold text-[var(--ink)] focus:outline-none focus:bg-[var(--bg-input)] focus:shadow-[2px_2px_0_var(--border)] transition-all font-mono uppercase cursor-pointer h-[38px]"
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
              className="w-full bg-transparent border border-[var(--border)] py-2 pl-9 pr-4 text-[10px] font-bold focus:outline-none focus:bg-[var(--bg-input)] focus:shadow-[2px_2px_0_var(--border)] transition-all font-mono uppercase h-[38px]"
            />
          </div>
          <button 
            onClick={() => {
              setEditingContact(null);
              setFormData({ type: 'SUPPLIER', name: '', document: '', phone: '', email: '' });
              setShowModal(true);
            }}
            className="bg-[var(--ink)] hover:bg-[var(--bg-input)] text-[var(--ink-inv)] hover:text-[var(--ink)] border border-[var(--border)] shadow-[2px_2px_0_var(--border)] active:shadow-none active:translate-y-[2px] active:translate-x-[2px] transition-all px-4 py-2 flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-widest shrink-0 h-[38px]"
          >
            <Plus size={14} />
            <span className="hidden md:inline">NUEVO CONTACTO</span>
          </button>
        </div>
      </div>

      <div className="data-table-container flex-1 overflow-hidden flex flex-col">
        <div className="grid grid-cols-[100px_minmax(150px,1fr)_120px_120px_minmax(150px,1fr)_100px] border-b border-[var(--border)] p-3 bg-[var(--bg-sidebar)] text-[9px] font-bold uppercase tracking-widest opacity-80 font-mono">
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
                <span className={`px-2 py-0.5 ${c.type === 'SUPPLIER' ? 'bg-[var(--ink)] text-[var(--ink-inv)]' : 'bg-[var(--bg-card-alt)] text-[var(--ink)] border border-[var(--border)]'}`}>
                  {c.type === 'SUPPLIER' ? 'PROVEEDOR' : 'CLIENTE'}
                </span>
              </div>
              <div className="font-mono text-[11px] font-black truncate pr-2">{c.name}</div>
              <div className="font-mono text-[10px] opacity-80">{c.document}</div>
              <div className="font-mono text-[10px] opacity-80">{c.phone || '---'}</div>
              <div className="font-mono text-[10px] opacity-80 truncate pr-2">{c.email || '---'}</div>
              <div className="flex items-center justify-end gap-2 pr-2">
                <button onClick={() => setHistoryContact(c)} title="Ver historial" className="p-1 hover:bg-[var(--ink)] hover:text-white transition-colors border border-transparent hover:border-[var(--border)]">
                  <History size={12} />
                </button>
                <button onClick={() => openEdit(c)} className="p-1 hover:bg-[var(--ink)] hover:text-white transition-colors border border-transparent hover:border-[var(--border)]">
                  <Edit2 size={12} />
                </button>
                <button onClick={() => setConfirmDeleteId(c.id)} className="p-1 hover:bg-red-700 hover:text-white transition-colors border border-transparent hover:border-red-700 text-red-600">
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

      {historyContact && (
        <div className="fixed inset-0 z-50 bg-[var(--bg)]/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[var(--bg)] border-2 border-[var(--border)] shadow-[8px_8px_0_var(--border)] w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="border-b-2 border-[var(--border)] p-4 flex justify-between items-center bg-[var(--bg-input)] shrink-0">
              <div>
                <h2 className="font-serif italic font-bold text-xs uppercase tracking-widest text-[var(--ink)]">HISTORIAL — {historyContact.name}</h2>
                <p className="font-mono text-[9px] opacity-60 uppercase mt-0.5">{historyContact.type === 'SUPPLIER' ? 'PROVEEDOR' : 'CLIENTE'} · {historyContact.document}</p>
              </div>
              <button onClick={() => setHistoryContact(null)} className="p-1 hover:bg-[var(--ink)] hover:text-white transition-colors border border-transparent hover:border-[var(--border)]">
                <X size={14} />
              </button>
            </div>
            {(() => {
              const contactTxs = transactions
                .filter(tx => (tx as any).contactId === historyContact.id)
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
              const totalReceptions = contactTxs.filter(t => t.type === 'RECEPTION').reduce((s, t) => s + t.quantity, 0);
              const totalDispatches = contactTxs.filter(t => t.type === 'DISPATCH').reduce((s, t) => s + t.quantity, 0);
              return (
                <>
                  <div className="flex gap-4 p-3 border-b border-[var(--border)] bg-[var(--bg-sidebar)] shrink-0">
                    <div className="font-mono text-[9px] font-bold uppercase"><span className="opacity-50">RECEPCIONES:</span> <span className="text-[#15803d]">{totalReceptions} U</span></div>
                    <div className="font-mono text-[9px] font-bold uppercase"><span className="opacity-50">DESPACHOS:</span> <span className="text-[#b91c1c]">{totalDispatches} U</span></div>
                    <div className="font-mono text-[9px] font-bold uppercase"><span className="opacity-50">TOTAL MOVS:</span> {contactTxs.length}</div>
                  </div>
                  <div className="overflow-auto flex-1">
                    {contactTxs.length === 0 ? (
                      <div className="p-12 text-center font-mono text-sm opacity-50 font-bold uppercase">SIN MOVIMIENTOS REGISTRADOS</div>
                    ) : (
                      <>
                        <div className="grid grid-cols-[110px_90px_90px_minmax(120px,1fr)_80px] p-2 bg-[var(--bg-sidebar)] text-[9px] font-bold uppercase tracking-widest opacity-80 font-mono border-b border-[var(--border)]">
                          <div>FECHA</div>
                          <div>TIPO</div>
                          <div>SKU</div>
                          <div>PRODUCTO</div>
                          <div className="text-right">CANT.</div>
                        </div>
                        {contactTxs.map(tx => {
                          const prod = products.find(p => p.id === tx.productId);
                          const typeColor = tx.type === 'RECEPTION' ? 'bg-[#15803d] text-white' : tx.type === 'DISPATCH' ? 'bg-[var(--ink)] text-[var(--ink-inv)]' : 'bg-[var(--bg-input)] border border-[var(--border)]';
                          return (
                            <div key={tx.id} className="grid grid-cols-[110px_90px_90px_minmax(120px,1fr)_80px] items-center py-2 px-2 border-b border-[var(--border)]/10 hover:bg-[var(--bg-card)] transition-colors">
                              <div className="font-mono text-[9px] opacity-70">{format(new Date(tx.date), 'dd/MM/yy HH:mm')}</div>
                              <div><span className={`font-mono text-[8px] font-bold px-1.5 py-0.5 uppercase ${typeColor}`}>{tx.type}</span></div>
                              <div className="font-mono text-[10px] font-bold">{prod?.code || '???'}</div>
                              <div className="font-mono text-[10px] truncate pr-2">{prod?.name || tx.reference}</div>
                              <div className="font-mono text-sm font-black text-right">{tx.quantity}</div>
                            </div>
                          );
                        })}
                      </>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 bg-[var(--bg)]/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[var(--bg)] border-2 border-[var(--border)] shadow-[8px_8px_0_var(--border)] w-full max-w-sm">
            <div className="border-b-2 border-[var(--border)] p-4 flex items-center gap-3 bg-[var(--bg-input)]">
              <AlertTriangle size={16} className="text-red-600 shrink-0" />
              <h2 className="font-serif italic font-bold text-xs uppercase tracking-widest text-[var(--ink)]">CONFIRMAR ELIMINACIÓN</h2>
            </div>
            <div className="p-5 flex flex-col gap-4">
              <p className="font-mono text-[11px] text-[var(--ink)]">¿Estás seguro de que deseas eliminar este contacto? Esta acción no se puede deshacer.</p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setConfirmDeleteId(null)}
                  className="px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-widest opacity-70 hover:opacity-100 transition-opacity"
                >
                  CANCELAR
                </button>
                <button
                  onClick={() => { deleteContact(confirmDeleteId); setConfirmDeleteId(null); }}
                  className="bg-red-700 text-white px-4 py-2 text-[10px] font-mono tracking-widest font-bold hover:bg-red-800 transition-all shadow-[2px_2px_0_var(--border)]"
                >
                  ELIMINAR
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 bg-[var(--bg)]/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleSubmit} className="bg-[var(--bg)] border-2 border-[var(--border)] shadow-[8px_8px_0_var(--border)] w-full max-w-md">
            <div className="border-b-2 border-[var(--border)] p-4 flex justify-between items-center bg-[var(--bg-input)]">
              <h2 className="font-serif italic font-bold text-xs uppercase tracking-widest text-[var(--ink)]">{editingContact ? 'EDITAR CONTACTO' : 'NUEVO CONTACTO'}</h2>
            </div>
            
            <div className="p-5 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[9px] font-bold tracking-[0.2em] opacity-80 uppercase">TIPO</label>
                <select 
                  value={formData.type}
                  onChange={e => setFormData({...formData, type: e.target.value as 'SUPPLIER'|'CLIENT'})}
                  className="bg-[var(--bg-card-alt)] border border-[var(--border)] p-2 text-xs font-bold uppercase focus:bg-[var(--bg-input)] focus:outline-none focus:shadow-[2px_2px_0_var(--border)] transition-all rounded-none"
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
                  className="bg-[var(--bg-card-alt)] border border-[var(--border)] p-2 text-xs font-bold uppercase focus:bg-[var(--bg-input)] focus:outline-none focus:shadow-[2px_2px_0_var(--border)] transition-all rounded-none"
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[9px] font-bold tracking-[0.2em] opacity-80 uppercase">RUC / DNI *</label>
                <input 
                  value={formData.document}
                  onChange={e => setFormData({...formData, document: e.target.value})}
                  className="bg-[var(--bg-card-alt)] border border-[var(--border)] p-2 text-xs font-bold font-mono focus:bg-[var(--bg-input)] focus:outline-none focus:shadow-[2px_2px_0_var(--border)] transition-all rounded-none"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="font-mono text-[9px] font-bold tracking-[0.2em] opacity-80 uppercase">TELÉFONO</label>
                  <input 
                    value={formData.phone}
                    onChange={e => setFormData({...formData, phone: e.target.value})}
                    className="bg-[var(--bg-card-alt)] border border-[var(--border)] p-2 text-xs font-bold font-mono focus:bg-[var(--bg-input)] focus:outline-none focus:shadow-[2px_2px_0_var(--border)] transition-all rounded-none"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="font-mono text-[9px] font-bold tracking-[0.2em] opacity-80 uppercase">CORREO</label>
                  <input 
                    type="email"
                    value={formData.email}
                    onChange={e => setFormData({...formData, email: e.target.value})}
                    className="bg-[var(--bg-card-alt)] border border-[var(--border)] p-2 text-xs font-bold font-mono focus:bg-[var(--bg-input)] focus:outline-none focus:shadow-[2px_2px_0_var(--border)] transition-all rounded-none"
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
                  className="bg-[var(--ink)] text-[var(--ink-inv)] px-4 py-2 text-[10px] font-mono tracking-widest font-bold hover:bg-black transition-all shadow-[2px_2px_0_var(--border)]"
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

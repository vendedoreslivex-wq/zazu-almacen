import React, { useState } from 'react';
import { useAppContext } from '../store/AppContext';
import { ModuleInfo } from '../components/ModuleInfo';
import { Plus, Trash2, Edit2, ShieldCheck, TrendingUp, Settings, Warehouse } from 'lucide-react';
import { UserWithPassword, Role } from '../types';
import { canEdit, ROLE_PERMISSIONS, Permission } from '../lib/permissions';

const ROLE_LABELS: Record<Role, string> = {
  ADMIN_GENERAL: 'Admin General',
  CEO: 'CEO',
  ADMINISTRADOR: 'Administrador',
  JEFE_ALMACEN: 'Jefe Almacén',
};

const ROLE_COLORS: Record<Role, string> = {
  ADMIN_GENERAL: 'bg-[#141414] text-[#E4E3E0]',
  CEO: 'bg-purple-700 text-white',
  ADMINISTRADOR: 'bg-blue-700 text-white',
  JEFE_ALMACEN: 'bg-amber-700 text-white',
};

const RoleIcon = ({ role }: { role: Role }) => {
  if (role === 'ADMIN_GENERAL') return <ShieldCheck size={12} />;
  if (role === 'CEO') return <TrendingUp size={12} />;
  if (role === 'ADMINISTRADOR') return <Settings size={12} />;
  return <Warehouse size={12} />;
};

const PERM_ICON: Record<Permission, string> = {
  full: '✓',
  view: '👁',
  none: '—',
};

const PERM_COLOR: Record<Permission, string> = {
  full: 'text-green-700 font-bold',
  view: 'text-blue-600',
  none: 'text-[#141414]/25',
};

const MODULE_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  analysis: 'Análisis',
  inventory: 'Inventario',
  locations: 'Ubicaciones',
  operations: 'Operaciones',
  adjustments: 'Ajustes',
  'purchase-orders': 'Órdenes OC',
  history: 'Historial',
  contacts: 'Contactos',
  reports: 'Reportes',
  labels: 'Etiquetas QR',
  'warehouse-map': 'Mapa Almacén',
  users: 'Usuarios',
  'operation-history': 'Historial General',
};

const emptyForm = { username: '', password: '', email: '', role: 'JEFE_ALMACEN' as Role, active: true };

export const Users: React.FC = () => {
  const { users, addUser, updateUser, deleteUser, currentUser } = useAppContext();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<UserWithPassword | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [showPass, setShowPass] = useState(false);

  const isAdmin = canEdit(currentUser.role, 'users');

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = (u: UserWithPassword) => {
    setEditing(u);
    setForm({ username: u.username, password: u.password, email: u.email || '', role: u.role, active: u.active });
    setShowModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.username || !form.password) return;
    if (editing) {
      updateUser({ ...editing, ...form });
    } else {
      addUser(form);
    }
    setShowModal(false);
  };

  const handleDelete = (id: string) => {
    if (id === 'u1') return;
    deleteUser(id);
    setConfirmDelete(null);
  };

  const roles: Role[] = ['ADMIN_GENERAL', 'CEO', 'ADMINISTRADOR', 'JEFE_ALMACEN'];
  const modules = Object.keys(MODULE_LABELS);

  return (
    <div className="flex flex-col gap-6 h-full relative">
      <ModuleInfo number="13" title="Usuarios y Roles" description="Administración de usuarios y control de accesos. Cada rol tiene permisos específicos por módulo: acceso completo, solo lectura o sin acceso." />
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 border-b border-[#141414] pb-3">
        <div>
          <h2 className="font-serif italic font-bold text-xs uppercase tracking-widest text-[#141414]">08 // USUARIOS_ROLES</h2>
          <p className="font-mono text-[10px] opacity-70 uppercase tracking-wide mt-1">Gestión de accesos y permisos por rol.</p>
        </div>
        {isAdmin && (
          <button onClick={openAdd} className="flex items-center gap-2 bg-[#141414] text-[#E4E3E0] px-4 py-2 text-xs font-bold font-mono uppercase hover:shadow-[3px_3px_0_#9f9d99] transition-all border border-[#141414]">
            <Plus size={14} /> NUEVO USUARIO
          </button>
        )}
      </div>

      {/* User list */}
      <div className="grid gap-3">
        {users.map(u => (
          <div key={u.id} className={`border border-[#141414] bg-white/40 p-4 flex items-center justify-between gap-4 ${!u.active ? 'opacity-50' : ''}`}>
            <div className="flex items-center gap-4 min-w-0">
              <div className={`flex items-center gap-1.5 px-2 py-1 text-[10px] font-bold font-mono uppercase shrink-0 ${ROLE_COLORS[u.role]}`}>
                <RoleIcon role={u.role} />
                {ROLE_LABELS[u.role]}
              </div>
              <div className="min-w-0">
                <div className="font-mono font-bold text-sm text-[#141414]">{u.username}</div>
                {u.email && <div className="font-mono text-[10px] opacity-60">{u.email}</div>}
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <div className={`font-mono text-[9px] font-bold px-2 py-0.5 border ${u.active ? 'border-green-700 text-green-700' : 'border-red-700 text-red-700'}`}>
                {u.active ? 'ACTIVO' : 'INACTIVO'}
              </div>
              {isAdmin && u.id !== 'u1' && (
                <>
                  <button onClick={() => openEdit(u)} className="p-1.5 border border-transparent hover:border-[#141414] transition-colors">
                    <Edit2 size={14} />
                  </button>
                  <button onClick={() => setConfirmDelete(u.id)} className="p-1.5 border border-transparent hover:border-red-600 hover:text-red-600 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Permissions matrix */}
      <div className="border border-[#141414] bg-white/30 p-5">
        <h3 className="font-mono font-bold text-xs uppercase tracking-widest mb-4 text-[#141414]">MATRIZ DE PERMISOS</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-[10px] font-mono border-collapse">
            <thead>
              <tr className="border-b-2 border-[#141414]">
                <th className="text-left py-2 pr-6 font-bold uppercase tracking-wide opacity-60">Módulo</th>
                {roles.map(r => (
                  <th key={r} className="text-center py-2 px-3 font-bold min-w-[90px]">
                    <div className={`inline-flex items-center gap-1 px-2 py-1 text-[9px] ${ROLE_COLORS[r]}`}>
                      <RoleIcon role={r} />
                      {ROLE_LABELS[r].toUpperCase()}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {modules.map(mod => (
                <tr key={mod} className="border-b border-[#141414]/15 hover:bg-white/40">
                  <td className="py-2 pr-6 font-semibold uppercase tracking-wide">{MODULE_LABELS[mod]}</td>
                  {roles.map(r => {
                    const perm = ROLE_PERMISSIONS[r]?.[mod] ?? 'none';
                    return (
                      <td key={r} className={`text-center py-2 px-3 text-base ${PERM_COLOR[perm]}`}>
                        {PERM_ICON[perm]}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex gap-4 mt-3 pt-3 border-t border-[#141414]/20">
          {(['full', 'view', 'none'] as Permission[]).map(p => (
            <div key={p} className="flex items-center gap-1.5 font-mono text-[9px] opacity-70">
              <span className={`text-sm ${PERM_COLOR[p]}`}>{PERM_ICON[p]}</span>
              <span className="uppercase">{p === 'full' ? 'Acceso completo' : p === 'view' ? 'Solo lectura' : 'Sin acceso'}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[#E4E3E0] border border-[#141414] shadow-[4px_4px_0_#141414] w-full max-w-md">
            <div className="border-b border-[#141414] px-5 py-3 flex justify-between items-center">
              <span className="font-mono font-bold text-xs uppercase tracking-widest">{editing ? 'EDITAR USUARIO' : 'NUEVO USUARIO'}</span>
              <button onClick={() => setShowModal(false)} className="font-mono text-xs opacity-60 hover:opacity-100">✕</button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="font-mono text-[9px] font-bold uppercase tracking-widest opacity-60">Usuario *</label>
                <input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                  className="border border-[#141414] bg-white px-3 py-2 text-xs font-mono focus:outline-none focus:shadow-[2px_2px_0_#141414]" required />
              </div>
              <div className="flex flex-col gap-1">
                <label className="font-mono text-[9px] font-bold uppercase tracking-widest opacity-60">Contraseña *</label>
                <div className="relative">
                  <input type={showPass ? 'text' : 'password'} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    className="w-full border border-[#141414] bg-white px-3 py-2 text-xs font-mono focus:outline-none focus:shadow-[2px_2px_0_#141414]" required />
                  <button type="button" onClick={() => setShowPass(s => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 font-mono text-[9px] opacity-50 hover:opacity-100">
                    {showPass ? 'OCULTAR' : 'VER'}
                  </button>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="font-mono text-[9px] font-bold uppercase tracking-widest opacity-60">Email</label>
                <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  className="border border-[#141414] bg-white px-3 py-2 text-xs font-mono focus:outline-none focus:shadow-[2px_2px_0_#141414]" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="font-mono text-[9px] font-bold uppercase tracking-widest opacity-60">Rol</label>
                <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as Role }))}
                  className="border border-[#141414] bg-white px-3 py-2 text-xs font-mono focus:outline-none focus:shadow-[2px_2px_0_#141414] cursor-pointer">
                  {roles.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="active" checked={form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} className="cursor-pointer" />
                <label htmlFor="active" className="font-mono text-[10px] font-bold uppercase cursor-pointer">Usuario activo</label>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" className="flex-1 bg-[#141414] text-[#E4E3E0] py-2 text-xs font-bold font-mono uppercase hover:shadow-[2px_2px_0_#9f9d99] transition-all">
                  {editing ? 'GUARDAR' : 'CREAR'}
                </button>
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 border border-[#141414] py-2 text-xs font-bold font-mono uppercase hover:bg-white/50 transition-all">
                  CANCELAR
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[#E4E3E0] border border-[#141414] shadow-[4px_4px_0_#141414] p-6 max-w-sm w-full">
            <p className="font-mono text-xs font-bold mb-4">¿Eliminar este usuario?</p>
            <div className="flex gap-2">
              <button onClick={() => handleDelete(confirmDelete)} className="flex-1 bg-red-600 text-white py-2 text-xs font-bold font-mono uppercase">ELIMINAR</button>
              <button onClick={() => setConfirmDelete(null)} className="flex-1 border border-[#141414] py-2 text-xs font-bold font-mono uppercase">CANCELAR</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

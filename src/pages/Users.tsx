import React, { useState } from 'react';
import { useAppContext } from '../store/AppContext';
import { ModuleInfo } from '../components/ModuleInfo';
import {
  Plus, Trash2, Edit2, ShieldCheck, TrendingUp, Settings,
  Warehouse, Mail, Users as UsersIcon, Lock, Bell, X
} from 'lucide-react';
import { UserWithPassword, Role, NotificationSubscriber } from '../types';
import { canEdit, Permission } from '../lib/permissions';

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

const ROLE_BORDER: Record<Role, string> = {
  ADMIN_GENERAL: 'border-[#141414]',
  CEO: 'border-purple-700',
  ADMINISTRADOR: 'border-blue-700',
  JEFE_ALMACEN: 'border-amber-700',
};

const RoleIcon = ({ role, size = 12 }: { role: Role; size?: number }) => {
  if (role === 'ADMIN_GENERAL') return <ShieldCheck size={size} />;
  if (role === 'CEO') return <TrendingUp size={size} />;
  if (role === 'ADMINISTRADOR') return <Settings size={size} />;
  return <Warehouse size={size} />;
};

const PERM_LABEL: Record<Permission, string> = { full: 'TOTAL', view: 'VER', none: '—' };
const PERM_STYLE: Record<Permission, string> = {
  full: 'bg-green-100 text-green-700 border-green-300',
  view: 'bg-blue-50 text-blue-600 border-blue-200',
  none: 'bg-transparent text-[#141414]/20 border-[#141414]/10',
};

const MODULE_GROUPS: { label: string; modules: { key: string; label: string }[] }[] = [
  {
    label: 'Principal',
    modules: [
      { key: 'dashboard', label: 'Dashboard' },
      { key: 'analysis', label: 'Análisis' },
      { key: 'reports', label: 'Reportes' },
    ],
  },
  {
    label: 'Almacén',
    modules: [
      { key: 'inventory', label: 'Inventario' },
      { key: 'reservations', label: 'Reservas' },
      { key: 'locations', label: 'Ubicaciones' },
      { key: 'warehouse-map', label: 'Mapa Almacén' },
      { key: 'labels', label: 'Etiquetas QR' },
    ],
  },
  {
    label: 'Operaciones',
    modules: [
      { key: 'operations', label: 'Operaciones' },
      { key: 'adjustments', label: 'Ajustes' },
      { key: 'purchase-orders', label: 'Órdenes OC' },
      { key: 'history', label: 'Historial' },
      { key: 'operation-history', label: 'Historial General' },
    ],
  },
  {
    label: 'Administración',
    modules: [
      { key: 'contacts', label: 'Contactos' },
      { key: 'users', label: 'Usuarios' },
    ],
  },
];

const emptyForm = { username: '', password: '', email: '', role: 'JEFE_ALMACEN' as Role, active: true };

type Tab = 'usuarios' | 'permisos' | 'notificaciones';

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'usuarios', label: 'Usuarios', icon: UsersIcon },
  { id: 'permisos', label: 'Permisos', icon: Lock },
  { id: 'notificaciones', label: 'Notificaciones', icon: Bell },
];

export const Users: React.FC = () => {
  const {
    users, addUser, updateUser, deleteUser, currentUser,
    rolePermissions, updateRolePermission,
    notificationSubscribers, addSubscriber, updateSubscriber, deleteSubscriber,
  } = useAppContext();

  const [activeTab, setActiveTab] = useState<Tab>('usuarios');

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<UserWithPassword | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [showPass, setShowPass] = useState(false);
  const [userError, setUserError] = useState('');
  const [userSubmitting, setUserSubmitting] = useState(false);

  const [showSubModal, setShowSubModal] = useState(false);
  const [editingSub, setEditingSub] = useState<NotificationSubscriber | null>(null);
  const [subForm, setSubForm] = useState({ name: '', email: '', active: true });
  const [confirmDeleteSub, setConfirmDeleteSub] = useState<string | null>(null);
  const [subError, setSubError] = useState('');

  const isAdmin = canEdit(currentUser.role, 'users');
  const isAdminGeneral = currentUser.role === 'ADMIN_GENERAL';
  const roles: Role[] = ['ADMIN_GENERAL', 'CEO', 'ADMINISTRADOR', 'JEFE_ALMACEN'];

  const openAdd = () => { setEditing(null); setForm(emptyForm); setUserError(''); setShowModal(true); };
  const openEdit = (u: UserWithPassword) => {
    setEditing(u);
    setForm({ username: u.username, password: '', email: u.email || '', role: u.role, active: u.active });
    setUserError('');
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserError('');
    if (!form.username) { setUserError('El nombre de usuario es obligatorio.'); return; }
    if (!editing && !form.email) { setUserError('El email es obligatorio para crear un usuario.'); return; }
    if (!editing && !form.password) { setUserError('La contraseña es obligatoria.'); return; }
    setUserSubmitting(true);
    try {
      if (editing) await updateUser({ ...editing, ...form, password: editing.password }, form.password || undefined);
      else await addUser(form);
      setShowModal(false);
    } catch (err) {
      setUserError(err instanceof Error ? err.message : 'Error al guardar el usuario');
    } finally {
      setUserSubmitting(false);
    }
  };

  const handleDelete = (id: string) => { if (id === 'u1') return; deleteUser(id); setConfirmDelete(null); };

  const openAddSub = () => { setEditingSub(null); setSubForm({ name: '', email: '', active: true }); setSubError(''); setShowSubModal(true); };
  const openEditSub = (s: NotificationSubscriber) => {
    setEditingSub(s);
    setSubForm({ name: s.name, email: s.email, active: s.active });
    setSubError('');
    setShowSubModal(true);
  };

  const handleSubmitSub = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subForm.name.trim() || !subForm.email.trim()) return;
    try {
      if (editingSub) await updateSubscriber({ id: editingSub.id, ...subForm });
      else await addSubscriber(subForm);
      setShowSubModal(false);
    } catch (err) {
      setSubError(err instanceof Error ? err.message : 'Error al guardar');
    }
  };

  const handleDeleteSub = async (id: string) => {
    try { await deleteSubscriber(id); setConfirmDeleteSub(null); }
    catch { setConfirmDeleteSub(null); }
  };

  return (
    <div className="flex flex-col gap-5 min-h-0 relative w-full max-w-full overflow-x-hidden">
      <ModuleInfo number="13" title="Usuarios y Roles" description="Administración de usuarios y control de accesos por módulo." />

      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-mono font-black text-sm tracking-widest text-[#141414] uppercase">Usuarios y Roles</h1>
          <p className="font-mono text-[9px] text-[#141414]/40 tracking-wider uppercase mt-0.5">
            {users.length} usuario{users.length !== 1 ? 's' : ''} registrado{users.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="border border-[#141414] bg-white/30">
        {/* Tab headers */}
        <div className="flex border-b border-[#141414]">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-3 font-mono text-[10px] font-black tracking-widest uppercase transition-all border-r border-[#141414] last:border-r-0
                  ${isActive
                    ? 'bg-[#141414] text-[#E4E3E0]'
                    : 'bg-[#E4E3E0] text-[#141414]/50 hover:text-[#141414] hover:bg-white/60'
                  }`}
              >
                <Icon size={13} />
                {tab.label}
                {tab.id === 'usuarios' && (
                  <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded-sm ml-0.5
                    ${isActive ? 'bg-white/20 text-[#E4E3E0]' : 'bg-[#141414]/10 text-[#141414]/50'}`}>
                    {users.length}
                  </span>
                )}
                {tab.id === 'notificaciones' && (
                  <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded-sm ml-0.5
                    ${isActive ? 'bg-white/20 text-[#E4E3E0]' : 'bg-[#141414]/10 text-[#141414]/50'}`}>
                    {notificationSubscribers.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        <div className="p-5 overflow-hidden">

          {/* ── Pestaña: Usuarios ── */}
          {activeTab === 'usuarios' && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[9px] text-[#141414]/40 tracking-wider uppercase">
                  {users.length} usuario{users.length !== 1 ? 's' : ''} en el sistema
                </span>
                {isAdmin && (
                  <button onClick={openAdd}
                    className="flex items-center gap-2 bg-[#141414] text-[#E4E3E0] px-4 py-2
                               font-mono text-[10px] tracking-widest uppercase hover:shadow-[3px_3px_0_#9f9d99] transition-all border border-[#141414]">
                    <Plus size={13} /> Nuevo usuario
                  </button>
                )}
              </div>
              <div className="grid gap-2">
                {users.map(u => (
                  <div key={u.id}
                    className={`flex items-center gap-4 px-4 py-3 border border-[#141414]/20 bg-white/50 rounded-sm
                                hover:bg-white/80 transition-colors ${!u.active ? 'opacity-40' : ''}`}
                  >
                    <div className={`w-8 h-8 flex items-center justify-center rounded-sm shrink-0 ${ROLE_COLORS[u.role]}`}>
                      <RoleIcon role={u.role} size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-[13px] text-[#141414]">{u.username}</span>
                        <span className={`font-mono text-[9px] font-bold px-2 py-0.5 border rounded-sm ${ROLE_BORDER[u.role]} ${ROLE_COLORS[u.role]}`}>
                          {ROLE_LABELS[u.role].toUpperCase()}
                        </span>
                        <span className={`font-mono text-[9px] px-2 py-0.5 border rounded-sm ${u.active ? 'border-green-600 text-green-700 bg-green-50' : 'border-red-500 text-red-600 bg-red-50'}`}>
                          {u.active ? 'ACTIVO' : 'INACTIVO'}
                        </span>
                      </div>
                      {u.email && (
                        <span className="font-mono text-[10px] text-[#141414]/50 truncate block mt-0.5">{u.email}</span>
                      )}
                    </div>
                    {isAdmin && u.id !== 'u1' && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => openEdit(u)}
                          className="p-2 border border-transparent hover:border-[#141414] hover:bg-white transition-colors rounded-sm">
                          <Edit2 size={13} />
                        </button>
                        <button onClick={() => setConfirmDelete(u.id)}
                          className="p-2 border border-transparent hover:border-red-500 hover:text-red-600 hover:bg-red-50 transition-colors rounded-sm">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Pestaña: Permisos ── */}
          {activeTab === 'permisos' && (
            <div className="flex flex-col gap-4">
              <span className="font-mono text-[9px] text-[#141414]/40 tracking-wider uppercase">
                Haz clic en una celda para cambiar el nivel de acceso
              </span>

              {/* Vista desktop: tabla */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full text-[10px] font-mono border-collapse">
                  <thead>
                    <tr>
                      <th className="text-left pb-3 pr-4 font-mono text-[9px] tracking-widest uppercase text-[#141414]/40 w-40">Módulo</th>
                      {roles.map(r => (
                        <th key={r} className="pb-3 px-2 text-center min-w-[100px]">
                          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[9px] font-black tracking-wider rounded-sm ${ROLE_COLORS[r]}`}>
                            <RoleIcon role={r} />
                            {ROLE_LABELS[r].toUpperCase()}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {MODULE_GROUPS.map(group => (
                      <React.Fragment key={group.label}>
                        <tr>
                          <td colSpan={roles.length + 1} className="pt-4 pb-1">
                            <span className="font-mono text-[9px] font-black tracking-widest uppercase text-[#141414]/30">— {group.label}</span>
                          </td>
                        </tr>
                        {group.modules.map(mod => (
                          <tr key={mod.key} className="border-b border-[#141414]/8 hover:bg-white/40 transition-colors">
                            <td className="py-2 pr-4 font-mono text-[11px] text-[#141414]/70">{mod.label}</td>
                            {roles.map(r => {
                              const perm: Permission = (rolePermissions[r]?.[mod.key] ?? 'none') as Permission;
                              const isEditable = isAdmin && r !== 'ADMIN_GENERAL';
                              const cycle: Permission[] = ['none', 'view', 'full'];
                              return (
                                <td key={r} className="text-center py-2 px-2">
                                  <button
                                    onClick={() => { if (!isEditable) return; updateRolePermission(r, mod.key, cycle[(cycle.indexOf(perm) + 1) % cycle.length]); }}
                                    disabled={!isEditable}
                                    className={`font-mono text-[9px] font-bold px-2.5 py-1 border rounded-sm tracking-wider transition-all ${PERM_STYLE[perm]} ${isEditable ? 'cursor-pointer hover:scale-105 hover:shadow-sm active:scale-95' : 'cursor-default'}`}
                                  >
                                    {PERM_LABEL[perm]}
                                  </button>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Vista mobile: tarjetas por módulo */}
              <div className="lg:hidden flex flex-col gap-3">
                {MODULE_GROUPS.map(group => (
                  <div key={group.label}>
                    <div className="font-mono text-[9px] font-black tracking-widest uppercase text-[#141414]/30 mb-2">— {group.label}</div>
                    <div className="flex flex-col gap-2">
                      {group.modules.map(mod => (
                        <div key={mod.key} className="border border-[#141414]/15 bg-white/50 px-3 py-2.5">
                          <div className="font-mono text-[11px] font-bold text-[#141414] mb-2">{mod.label}</div>
                          <div className="grid grid-cols-2 gap-1.5">
                            {roles.map(r => {
                              const perm: Permission = (rolePermissions[r]?.[mod.key] ?? 'none') as Permission;
                              const isEditable = isAdmin && r !== 'ADMIN_GENERAL';
                              const cycle: Permission[] = ['none', 'view', 'full'];
                              return (
                                <button
                                  key={r}
                                  onClick={() => { if (!isEditable) return; updateRolePermission(r, mod.key, cycle[(cycle.indexOf(perm) + 1) % cycle.length]); }}
                                  disabled={!isEditable}
                                  className={`flex items-center justify-between gap-1 px-2 py-1.5 border rounded-sm transition-all ${isEditable ? 'active:scale-95' : 'cursor-default'} ${perm === 'none' ? 'border-[#141414]/10 bg-transparent' : 'border-[#141414]/20 bg-white'}`}
                                >
                                  <div className={`flex items-center gap-1 text-[8px] font-black ${ROLE_COLORS[r]} px-1.5 py-0.5 rounded-sm shrink-0`}>
                                    <RoleIcon role={r} size={9} />
                                    <span>{r === 'ADMIN_GENERAL' ? 'AG' : r === 'ADMINISTRADOR' ? 'AD' : r === 'JEFE_ALMACEN' ? 'JA' : 'CEO'}</span>
                                  </div>
                                  <span className={`font-mono text-[8px] font-bold border px-1.5 py-0.5 rounded-sm ${PERM_STYLE[perm]}`}>{PERM_LABEL[perm]}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-[#141414]/10">
                {(['full', 'view', 'none'] as Permission[]).map(p => (
                  <div key={p} className="flex items-center gap-2">
                    <span className={`font-mono text-[9px] font-bold px-2 py-0.5 border rounded-sm ${PERM_STYLE[p]}`}>{PERM_LABEL[p]}</span>
                    <span className="font-mono text-[9px] text-[#141414]/40 uppercase tracking-wider">
                      {p === 'full' ? 'Acceso completo' : p === 'view' ? 'Solo lectura' : 'Sin acceso'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Pestaña: Notificaciones ── */}
          {activeTab === 'notificaciones' && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[9px] text-[#141414]/40 tracking-wider uppercase">
                  Reciben copia de cada operación y orden de compra
                </span>
                {isAdminGeneral && (
                  <button onClick={openAddSub}
                    className="flex items-center gap-1.5 font-mono text-[10px] tracking-widest uppercase
                               border border-[#141414] px-3 py-1.5 hover:bg-[#141414] hover:text-[#E4E3E0] transition-all rounded-sm">
                    <Plus size={11} /> Agregar
                  </button>
                )}
              </div>
              {notificationSubscribers.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-12">
                  <Mail size={22} className="text-[#141414]/20" />
                  <span className="font-mono text-[10px] text-[#141414]/30 tracking-wider uppercase">Sin destinatarios</span>
                </div>
              ) : (
                <div className="grid gap-2">
                  {notificationSubscribers.map(s => (
                    <div key={s.id}
                      className={`flex items-center gap-3 px-4 py-3 border border-[#141414]/20 bg-white/50 rounded-sm ${!s.active ? 'opacity-40' : ''}`}
                    >
                      <div className="w-7 h-7 flex items-center justify-center bg-[#141414]/5 border border-[#141414]/10 rounded-sm shrink-0">
                        <Mail size={12} className="text-[#141414]/50" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="font-mono font-bold text-[12px] text-[#141414] block">{s.name}</span>
                        <span className="font-mono text-[10px] text-[#141414]/50 truncate block">{s.email}</span>
                      </div>
                      <span className={`font-mono text-[9px] px-2 py-0.5 border rounded-sm shrink-0
                        ${s.active ? 'border-green-600 text-green-700 bg-green-50' : 'border-red-500 text-red-600 bg-red-50'}`}>
                        {s.active ? 'ACTIVO' : 'INACTIVO'}
                      </span>
                      {isAdminGeneral && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => openEditSub(s)}
                            className="p-2 border border-transparent hover:border-[#141414] hover:bg-white rounded-sm transition-colors">
                            <Edit2 size={12} />
                          </button>
                          <button onClick={() => setConfirmDeleteSub(s.id)}
                            className="p-2 border border-transparent hover:border-red-500 hover:text-red-600 hover:bg-red-50 rounded-sm transition-colors">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* ── Modal Usuario ── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[#E4E3E0] border border-[#141414] shadow-[4px_4px_0_#141414] w-full max-w-md">
            <div className="border-b border-[#141414] px-5 py-3.5 flex justify-between items-center">
              <span className="font-mono font-black text-[11px] uppercase tracking-widest">
                {editing ? 'Editar usuario' : 'Nuevo usuario'}
              </span>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-[#141414]/10 rounded-sm transition-colors">
                <X size={14} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
              {userError && (
                <div className="border border-red-500 bg-red-50 text-red-700 px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-wide rounded-sm">
                  {userError}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1 col-span-2">
                  <label className="font-mono text-[9px] font-bold uppercase tracking-widest text-[#141414]/50">Usuario *</label>
                  <input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                    className="border border-[#141414] bg-white px-3 py-2 text-xs font-mono focus:outline-none focus:shadow-[2px_2px_0_#141414]" required />
                </div>
                <div className="flex flex-col gap-1 col-span-2">
                  <label className="font-mono text-[9px] font-bold uppercase tracking-widest text-[#141414]/50">
                    Email {editing ? '' : '*'}
                  </label>
                  <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    className="border border-[#141414] bg-white px-3 py-2 text-xs font-mono focus:outline-none focus:shadow-[2px_2px_0_#141414]"
                    required={!editing} />
                </div>
                <div className="flex flex-col gap-1 col-span-2">
                  <label className="font-mono text-[9px] font-bold uppercase tracking-widest text-[#141414]/50">
                    Contraseña {editing ? '(dejar vacío para no cambiar)' : '*'}
                  </label>
                  <div className="relative">
                    <input type={showPass ? 'text' : 'password'} value={form.password}
                      onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                      placeholder={editing ? '••••••••' : ''}
                      className="w-full border border-[#141414] bg-white px-3 py-2 text-xs font-mono focus:outline-none focus:shadow-[2px_2px_0_#141414]"
                      required={!editing} />
                    <button type="button" onClick={() => setShowPass(s => !s)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 font-mono text-[9px] text-[#141414]/40 hover:text-[#141414] transition-colors">
                      {showPass ? 'OCULTAR' : 'VER'}
                    </button>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-mono text-[9px] font-bold uppercase tracking-widest text-[#141414]/50">Rol</label>
                  <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as Role }))}
                    className="border border-[#141414] bg-white px-3 py-2 text-xs font-mono focus:outline-none focus:shadow-[2px_2px_0_#141414] cursor-pointer">
                    {roles.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                  </select>
                </div>
                <div className="flex items-center gap-2 pt-5">
                  <input type="checkbox" id="active" checked={form.active}
                    onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} className="cursor-pointer" />
                  <label htmlFor="active" className="font-mono text-[10px] font-bold uppercase cursor-pointer">Activo</label>
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={userSubmitting}
                  className="flex-1 bg-[#141414] text-[#E4E3E0] py-2.5 text-xs font-bold font-mono uppercase
                             hover:shadow-[2px_2px_0_#9f9d99] disabled:opacity-50 transition-all">
                  {userSubmitting ? 'GUARDANDO...' : (editing ? 'GUARDAR' : 'CREAR USUARIO')}
                </button>
                <button type="button" onClick={() => setShowModal(false)} disabled={userSubmitting}
                  className="flex-1 border border-[#141414] py-2.5 text-xs font-bold font-mono uppercase hover:bg-white/50 disabled:opacity-50 transition-all">
                  CANCELAR
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal Destinatario ── */}
      {showSubModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[#E4E3E0] border border-[#141414] shadow-[4px_4px_0_#141414] w-full max-w-sm">
            <div className="border-b border-[#141414] px-5 py-3.5 flex justify-between items-center">
              <span className="font-mono font-black text-[11px] uppercase tracking-widest">
                {editingSub ? 'Editar destinatario' : 'Nuevo destinatario'}
              </span>
              <button onClick={() => setShowSubModal(false)} className="p-1 hover:bg-[#141414]/10 rounded-sm transition-colors">
                <X size={14} />
              </button>
            </div>
            <form onSubmit={handleSubmitSub} className="p-5 flex flex-col gap-4">
              {subError && (
                <div className="border border-red-500 bg-red-50 text-red-700 px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-wide rounded-sm">
                  {subError}
                </div>
              )}
              <div className="flex flex-col gap-1">
                <label className="font-mono text-[9px] font-bold uppercase tracking-widest text-[#141414]/50">Nombre *</label>
                <input value={subForm.name} onChange={e => setSubForm(f => ({ ...f, name: e.target.value }))}
                  className="border border-[#141414] bg-white px-3 py-2 text-xs font-mono focus:outline-none focus:shadow-[2px_2px_0_#141414]" required />
              </div>
              <div className="flex flex-col gap-1">
                <label className="font-mono text-[9px] font-bold uppercase tracking-widest text-[#141414]/50">Email *</label>
                <input type="email" value={subForm.email} onChange={e => setSubForm(f => ({ ...f, email: e.target.value }))}
                  className="border border-[#141414] bg-white px-3 py-2 text-xs font-mono focus:outline-none focus:shadow-[2px_2px_0_#141414]" required />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="sub-active" checked={subForm.active}
                  onChange={e => setSubForm(f => ({ ...f, active: e.target.checked }))} className="cursor-pointer" />
                <label htmlFor="sub-active" className="font-mono text-[10px] font-bold uppercase cursor-pointer">Activo</label>
              </div>
              <div className="flex gap-2 pt-1">
                <button type="submit"
                  className="flex-1 bg-[#141414] text-[#E4E3E0] py-2.5 text-xs font-bold font-mono uppercase hover:shadow-[2px_2px_0_#9f9d99] transition-all">
                  {editingSub ? 'GUARDAR' : 'AGREGAR'}
                </button>
                <button type="button" onClick={() => setShowSubModal(false)}
                  className="flex-1 border border-[#141414] py-2.5 text-xs font-bold font-mono uppercase hover:bg-white/50 transition-all">
                  CANCELAR
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Confirm delete usuario ── */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[#E4E3E0] border border-[#141414] shadow-[4px_4px_0_#141414] p-6 max-w-sm w-full">
            <p className="font-mono text-xs font-bold mb-1">¿Eliminar este usuario?</p>
            <p className="font-mono text-[10px] text-[#141414]/50 mb-5">Esta acción no se puede deshacer.</p>
            <div className="flex gap-2">
              <button onClick={() => handleDelete(confirmDelete)}
                className="flex-1 bg-red-600 text-white py-2.5 text-xs font-bold font-mono uppercase hover:bg-red-700 transition-colors">
                ELIMINAR
              </button>
              <button onClick={() => setConfirmDelete(null)}
                className="flex-1 border border-[#141414] py-2.5 text-xs font-bold font-mono uppercase hover:bg-white/50 transition-colors">
                CANCELAR
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm delete destinatario ── */}
      {confirmDeleteSub && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[#E4E3E0] border border-[#141414] shadow-[4px_4px_0_#141414] p-6 max-w-sm w-full">
            <p className="font-mono text-xs font-bold mb-1">¿Eliminar este destinatario?</p>
            <p className="font-mono text-[10px] text-[#141414]/50 mb-5">Dejará de recibir notificaciones.</p>
            <div className="flex gap-2">
              <button onClick={() => handleDeleteSub(confirmDeleteSub)}
                className="flex-1 bg-red-600 text-white py-2.5 text-xs font-bold font-mono uppercase hover:bg-red-700 transition-colors">
                ELIMINAR
              </button>
              <button onClick={() => setConfirmDeleteSub(null)}
                className="flex-1 border border-[#141414] py-2.5 text-xs font-bold font-mono uppercase hover:bg-white/50 transition-colors">
                CANCELAR
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

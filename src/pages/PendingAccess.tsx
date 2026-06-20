import React from 'react';
import { Clock, LogOut } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAppContext } from '../store/AppContext';

export const PendingAccess: React.FC = () => {
  const { currentUser } = useAppContext();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-8 px-4" style={{ background: 'var(--bg)', color: 'var(--ink)' }}>
      <div className="flex flex-col items-center gap-4">
        <div className="w-16 h-16 flex items-center justify-center border-2 border-[var(--border)] rounded-full opacity-40">
          <Clock size={28} />
        </div>
        <div className="flex flex-col items-center gap-1 text-center">
          <span className="font-mono font-black text-xs tracking-[0.3em] uppercase opacity-30">LOGIXZAZU</span>
          <h1 className="font-mono font-black text-lg tracking-widest uppercase mt-2">ESPERANDO CONFIRMACIÓN</h1>
          <p className="font-mono text-xs opacity-50 tracking-wider uppercase mt-1">de vista</p>
        </div>
      </div>

      <div className="max-w-sm w-full flex flex-col gap-3 p-6 border border-[var(--border)]" style={{ background: 'var(--bg-card)' }}>
        <div className="flex flex-col gap-1">
          <span className="font-mono text-[9px] opacity-40 uppercase tracking-widest">Usuario</span>
          <span className="font-mono font-bold text-sm uppercase">{currentUser.username || '—'}</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="font-mono text-[9px] opacity-40 uppercase tracking-widest">Rol</span>
          <span className="font-mono text-sm uppercase opacity-70">{currentUser.role}</span>
        </div>
        <div className="border-t border-[var(--border)] pt-3 mt-1">
          <p className="font-mono text-[10px] opacity-50 leading-relaxed">
            Tu cuenta aún no tiene módulos asignados. Contacta al administrador del sistema para que configure tus permisos de acceso.
          </p>
        </div>
      </div>

      <button
        onClick={() => supabase.auth.signOut()}
        className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest opacity-40 hover:opacity-80 hover:text-red-500 transition-all"
      >
        <LogOut size={14} />
        Cerrar sesión
      </button>
    </div>
  );
};

import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

export const ResetPassword: React.FC = () => {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres.'); return; }
    if (password !== confirm) { setError('Las contraseñas no coinciden.'); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setDone(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#E4E3E0] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <img src="/img-icono/zazu_icon.png" alt="LogixZazu" className="w-16 h-16 object-contain mx-auto mb-4" />
          <h1 className="font-mono font-black text-lg tracking-widest text-[#141414] uppercase">LOGIXZAZU</h1>
          <p className="font-mono text-[10px] opacity-40 tracking-[0.3em] uppercase mt-1">Restablecer contraseña</p>
        </div>

        <div className="border-2 border-[#141414] bg-white shadow-[6px_6px_0_#141414]">
          <div className="border-b-2 border-[#141414]">
            <div className="py-3 text-center font-mono text-[10px] font-bold tracking-widest uppercase bg-[#141414] text-[#E4E3E0]">
              {done ? 'CONTRASEÑA ACTUALIZADA' : 'NUEVA CONTRASEÑA'}
            </div>
          </div>

          {!done && (
            <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
              {error && (
                <div className="border border-red-600 bg-red-50 text-red-700 px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-wide">
                  {error}
                </div>
              )}
              <Field label="Nueva contraseña">
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="auth-input"
                  autoComplete="new-password"
                  minLength={6}
                  required
                />
              </Field>
              <Field label="Confirmar contraseña">
                <input
                  type="password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  className="auth-input"
                  autoComplete="new-password"
                  minLength={6}
                  required
                />
              </Field>
              <button
                type="submit"
                disabled={loading}
                className="mt-2 w-full bg-[#141414] text-[#E4E3E0] py-3 font-mono text-[11px] font-bold tracking-widest uppercase hover:shadow-[3px_3px_0_#9f9d99] disabled:opacity-50 transition-all"
              >
                {loading ? 'GUARDANDO...' : 'ACTUALIZAR CONTRASEÑA'}
              </button>
            </form>
          )}

          {done && (
            <div className="p-6 flex flex-col gap-4 items-center text-center">
              <div className="w-12 h-12 rounded-full bg-[#141414]/10 flex items-center justify-center text-2xl">✓</div>
              <p className="font-mono text-[10px] font-bold uppercase tracking-wide">
                Tu contraseña fue actualizada correctamente.
              </p>
              <button
                type="button"
                onClick={() => { supabase.auth.signOut(); }}
                className="mt-2 w-full bg-[#141414] text-[#E4E3E0] py-3 font-mono text-[11px] font-bold tracking-widest uppercase hover:shadow-[3px_3px_0_#9f9d99] transition-all"
              >
                IR AL LOGIN
              </button>
            </div>
          )}
        </div>

        <p className="text-center font-mono text-[9px] opacity-30 tracking-widest uppercase mt-6">
          LogixZazu v3.0 // Acceso restringido
        </p>
      </div>

      <style>{`
        .auth-input {
          width: 100%;
          background: #fafaf9;
          border: 1px solid #141414;
          padding: 10px 12px;
          font-family: var(--font-mono);
          font-size: 12px;
          font-weight: 600;
          color: #141414;
          outline: none;
          transition: all 0.1s;
        }
        .auth-input:focus { background: white; box-shadow: 2px 2px 0 #141414; }
      `}</style>
    </div>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex flex-col gap-1.5">
    <label className="font-mono text-[9px] font-bold tracking-[0.2em] uppercase opacity-60">{label}</label>
    {children}
  </div>
);

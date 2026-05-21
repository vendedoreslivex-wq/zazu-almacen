import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

type Screen = 'login' | 'forgot' | 'forgot_sent';

export const Login: React.FC = () => {
  const [screen, setScreen] = useState<Screen>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      if (msg.includes('Invalid login credentials')) setError('Email o contraseña incorrectos.');
      else setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setScreen('forgot_sent');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      setError(msg);
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
          <p className="font-mono text-[10px] opacity-40 tracking-[0.3em] uppercase mt-1">Sistema de Gestión de Almacén</p>
        </div>

        <div className="border-2 border-[#141414] bg-white shadow-[6px_6px_0_#141414]">
          <div className="border-b-2 border-[#141414]">
            <div className="py-3 text-center font-mono text-[10px] font-bold tracking-widest uppercase bg-[#141414] text-[#E4E3E0]">
              {screen === 'login' ? 'INGRESAR AL SISTEMA' : screen === 'forgot' ? 'RECUPERAR CONTRASEÑA' : 'CORREO ENVIADO'}
            </div>
          </div>

          {screen === 'login' && (
            <form onSubmit={handleLogin} className="p-6 flex flex-col gap-4">
              {error && (
                <div className="border border-red-600 bg-red-50 text-red-700 px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-wide">
                  {error}
                </div>
              )}
              <Field label="Email">
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="usuario@zazu-org.com"
                  className="auth-input"
                  autoComplete="email"
                  required
                />
              </Field>
              <Field label="Contraseña">
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="auth-input"
                  autoComplete="current-password"
                  required
                />
              </Field>
              <button
                type="submit"
                disabled={loading}
                className="mt-2 w-full bg-[#141414] text-[#E4E3E0] py-3 font-mono text-[11px] font-bold tracking-widest uppercase hover:shadow-[3px_3px_0_#9f9d99] disabled:opacity-50 transition-all"
              >
                {loading ? 'VERIFICANDO...' : 'INGRESAR'}
              </button>
              <button
                type="button"
                onClick={() => { setScreen('forgot'); setError(''); }}
                className="text-center font-mono text-[9px] opacity-40 hover:opacity-80 transition-opacity uppercase tracking-widest"
              >
                ¿Olvidaste tu contraseña?
              </button>
            </form>
          )}

          {screen === 'forgot' && (
            <form onSubmit={handleForgot} className="p-6 flex flex-col gap-4">
              <p className="font-mono text-[10px] opacity-60 uppercase tracking-wide leading-relaxed">
                Ingresa tu email y te enviaremos un enlace para restablecer tu contraseña.
              </p>
              {error && (
                <div className="border border-red-600 bg-red-50 text-red-700 px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-wide">
                  {error}
                </div>
              )}
              <Field label="Email">
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="usuario@zazu-org.com"
                  className="auth-input"
                  autoComplete="email"
                  required
                />
              </Field>
              <button
                type="submit"
                disabled={loading}
                className="mt-2 w-full bg-[#141414] text-[#E4E3E0] py-3 font-mono text-[11px] font-bold tracking-widest uppercase hover:shadow-[3px_3px_0_#9f9d99] disabled:opacity-50 transition-all"
              >
                {loading ? 'ENVIANDO...' : 'ENVIAR ENLACE'}
              </button>
              <button
                type="button"
                onClick={() => { setScreen('login'); setError(''); }}
                className="text-center font-mono text-[9px] opacity-40 hover:opacity-80 transition-opacity uppercase tracking-widest"
              >
                ← Volver al inicio de sesión
              </button>
            </form>
          )}

          {screen === 'forgot_sent' && (
            <div className="p-6 flex flex-col gap-4 items-center text-center">
              <div className="w-12 h-12 rounded-full bg-[#141414]/10 flex items-center justify-center text-2xl">✓</div>
              <p className="font-mono text-[10px] font-bold uppercase tracking-wide">
                Enlace enviado a:
              </p>
              <p className="font-mono text-xs font-black">{email}</p>
              <p className="font-mono text-[10px] opacity-50 uppercase tracking-wide leading-relaxed">
                Revisa tu bandeja de entrada y sigue las instrucciones para restablecer tu contraseña.
              </p>
              <button
                type="button"
                onClick={() => { setScreen('login'); setError(''); }}
                className="mt-2 w-full bg-[#141414] text-[#E4E3E0] py-3 font-mono text-[11px] font-bold tracking-widest uppercase hover:shadow-[3px_3px_0_#9f9d99] transition-all"
              >
                VOLVER AL LOGIN
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

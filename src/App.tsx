import { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useAppContext } from './store/AppContext';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Analysis } from './pages/Analysis';
import { Inventory } from './pages/Inventory';
import { Operations } from './pages/Operations';
import { History } from './pages/History';
import { Locations } from './pages/Locations';
import { Contacts } from './pages/Contacts';
import { Users } from './pages/Users';
import { PurchaseOrders } from './pages/PurchaseOrders';
import { Adjustments } from './pages/Adjustments';
import { Reports } from './pages/Reports';
import { Labels } from './pages/Labels';
import { WarehouseMap } from './pages/WarehouseMap';
import { OperationHistory } from './pages/OperationHistory';
import { supabase } from './lib/supabase';
import { ErrorBoundary } from './components/ErrorBoundary';
import type { Session } from '@supabase/supabase-js';

function AppShell() {
  const { loading } = useAppContext();

  if (loading) return <SplashScreen label="CARGANDO SISTEMA..." />;

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/analysis" element={<Analysis />} />
        <Route path="/inventory" element={<Inventory />} />
        <Route path="/locations" element={<Locations />} />
        <Route path="/operations" element={<Operations />} />
        <Route path="/history" element={<History />} />
        <Route path="/contacts" element={<Contacts />} />
        <Route path="/users" element={<Users />} />
        <Route path="/purchase-orders" element={<PurchaseOrders />} />
        <Route path="/adjustments" element={<Adjustments />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/labels" element={<Labels />} />
        <Route path="/warehouse-map" element={<WarehouseMap />} />
        <Route path="/operation-history" element={<OperationHistory />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Layout>
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSession(session));
    return () => subscription.unsubscribe();
  }, []);

  if (session === undefined) return <SplashScreen />;

  if (!session) return <Login />;

  return (
    <HashRouter>
      <ErrorBoundary>
        <AppProvider>
          <AppShell />
        </AppProvider>
      </ErrorBoundary>
    </HashRouter>
  );
}

function SplashScreen({ label = 'INICIANDO...' }: { label?: string }) {
  return (
    <div className="min-h-screen bg-[#E4E3E0] flex flex-col items-center justify-center gap-6">
      <div className="relative flex items-center justify-center">
        <div className="absolute w-24 h-24 border-2 border-[#141414]/20 rounded-full animate-ping" />
        <div className="absolute w-20 h-20 border border-[#141414]/10 rounded-full animate-pulse" />
        <img
          src="/img-icono/zazu_icon.png"
          alt="LogixZazu"
          className="w-16 h-16 object-contain relative z-10 animate-pulse"
          style={{ animationDuration: '1.5s' }}
        />
      </div>
      <div className="flex flex-col items-center gap-2">
        <span className="font-mono font-black text-base tracking-[0.3em] text-[#141414] uppercase">LOGIXZAZU</span>
        <span className="font-mono text-[9px] opacity-40 tracking-[0.4em] uppercase">{label}</span>
      </div>
      <div className="flex gap-1.5">
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className="w-1.5 h-1.5 bg-[#141414] rounded-full animate-bounce"
            style={{ animationDelay: `${i * 0.15}s`, animationDuration: '0.9s' }}
          />
        ))}
      </div>
    </div>
  );
}

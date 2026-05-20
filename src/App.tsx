import { useState, useEffect } from 'react';
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
import type { Session } from '@supabase/supabase-js';

function AppShell() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const { loading } = useAppContext();

  useEffect(() => {
    const handleNavigate = (e: CustomEvent) => {
      if (e.detail?.tab) setActiveTab(e.detail.tab);
    };
    window.addEventListener('navigate', handleNavigate as EventListener);
    return () => window.removeEventListener('navigate', handleNavigate as EventListener);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#E4E3E0] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-[#141414] border-t-transparent animate-spin" />
          <p className="font-mono text-[10px] uppercase tracking-widest opacity-50">CARGANDO SISTEMA...</p>
        </div>
      </div>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <Dashboard />;
      case 'analysis': return <Analysis />;
      case 'inventory': return <Inventory />;
      case 'locations': return <Locations />;
      case 'operations': return <Operations />;
      case 'history': return <History />;
      case 'contacts': return <Contacts />;
      case 'users': return <Users />;
      case 'purchase-orders': return <PurchaseOrders />;
      case 'adjustments': return <Adjustments />;
      case 'reports': return <Reports />;
      case 'labels': return <Labels />;
      case 'warehouse-map': return <WarehouseMap />;
      case 'operation-history': return <OperationHistory />;
      default: return <Dashboard />;
    }
  };

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
      {renderContent()}
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

  // Still resolving session
  if (session === undefined) {
    return (
      <div className="min-h-screen bg-[#E4E3E0] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#141414] border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!session) return <Login />;

  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  );
}

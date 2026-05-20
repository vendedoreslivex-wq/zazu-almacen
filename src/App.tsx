import { useState, useEffect } from 'react';
import { AppProvider } from './store/AppContext';
import { Layout } from './components/Layout';
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

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');

  useEffect(() => {
    const handleNavigate = (e: CustomEvent) => {
      if (e.detail && e.detail.tab) {
        setActiveTab(e.detail.tab);
      }
    };
    window.addEventListener('navigate', handleNavigate as EventListener);
    return () => window.removeEventListener('navigate', handleNavigate as EventListener);
  }, []);

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
    <AppProvider>
      <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
        {renderContent()}
      </Layout>
    </AppProvider>
  );
}

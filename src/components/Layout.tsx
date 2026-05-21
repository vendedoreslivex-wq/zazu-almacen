import React, { useState, useEffect } from 'react';
import { LayoutDashboard, ArrowLeftRight, PackageSearch, History, Menu, MapPin, Layers, Users, ShoppingCart, SlidersHorizontal, FileBarChart, QrCode, UserCircle, LayoutGrid, ScrollText, LogOut } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { useAppContext } from '../store/AppContext';
import { canView } from '../lib/permissions';

type NavItem = {
  id: string;
  label: string;
  icon: React.ElementType;
};

const BRAND_ICON: Record<string, string> = {
  OVERSHARK: '/img-icono/Img-barra/over-icon.png',
  BRAVOS: '/img-icono/Img-barra/brav-icon.png',
  BOX_PRIME: '/img-icono/Img-barra/box.icon.png',
};
const BRAND_NAME: Record<string, string> = { OVERSHARK: 'OVERSHARK', BRAVOS: 'BRAVOS URBAN', BOX_PRIME: 'BOX PRIME' };
const BRAND_LEGAL: Record<string, string> = { OVERSHARK: 'OVERSHARK PERU S.A.C.', BRAVOS: 'BRAVOS URBAN CO.', BOX_PRIME: 'BOX PRIME PERU' };

const ROLE_LABELS: Record<string, string> = {
  ADMIN_GENERAL: 'ADMIN GENERAL',
  CEO: 'CEO',
  ADMINISTRADOR: 'ADMINISTRADOR',
  JEFE_ALMACEN: 'JEFE ALMACÉN',
};

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'DASHBOARD', icon: LayoutDashboard },
  { id: 'analysis', label: 'ANALISIS', icon: Layers },
  { id: 'inventory', label: 'INVENTARIO', icon: PackageSearch },
  { id: 'locations', label: 'UBICACIONES', icon: MapPin },
  { id: 'operations', label: 'OPERACIONES', icon: ArrowLeftRight },
  { id: 'adjustments', label: 'AJUSTES', icon: SlidersHorizontal },
  { id: 'purchase-orders', label: 'ÓRDENES OC', icon: ShoppingCart },
  { id: 'history', label: 'HISTORIAL', icon: History },
  { id: 'contacts', label: 'CONTACTOS', icon: UserCircle },
  { id: 'reports', label: 'REPORTES', icon: FileBarChart },
  { id: 'labels', label: 'ETIQUETAS QR', icon: QrCode },
  { id: 'warehouse-map', label: 'MAPA ALMACÉN', icon: LayoutGrid },
  { id: 'users', label: 'USUARIOS', icon: Users },
  { id: 'operation-history', label: 'HISTORIAL GENERAL', icon: ScrollText },
];

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (id: string) => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, activeTab, setActiveTab }) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { activeBrand, setActiveBrand, currentUser, rolePermissions } = useAppContext();

  useEffect(() => {
    if (window.innerWidth < 768) setSidebarOpen(false);
  }, []);

  const visibleNav = navItems.filter(item => canView(currentUser.role, item.id, rolePermissions));

  const handleNavClick = (id: string) => {
    setActiveTab(id);
    if (window.innerWidth < 768) setSidebarOpen(false);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg-color)]">
      {/* Mobile backdrop */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-10 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed md:relative top-0 left-0 h-full flex-shrink-0 border-r border-[#141414] bg-[#D4D3D0] flex flex-col z-20 transition-all duration-300 ease-in-out",
          sidebarOpen ? "translate-x-0 w-[260px]" : "-translate-x-full md:translate-x-0 w-[260px] md:w-16"
        )}
      >
        <div className="h-16 flex items-center justify-between px-4 border-b border-[#141414]">
          <AnimatePresence>
            {sidebarOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-2 overflow-hidden"
              >
                <div className="w-7 h-7 flex-shrink-0 overflow-hidden">
                  <img
                    src={BRAND_ICON[activeBrand] ?? BRAND_ICON.BOX_PRIME}
                    alt={BRAND_NAME[activeBrand] ?? activeBrand}
                    className="w-full h-full object-contain"
                  />
                </div>
                <span className="font-mono font-bold tracking-wider text-sm text-[#141414] whitespace-nowrap">
                  {BRAND_NAME[activeBrand] ?? activeBrand}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
          {!sidebarOpen && (
            <div className="hidden md:flex w-7 h-7 flex-shrink-0 overflow-hidden mx-auto">
              <img
                src={BRAND_ICON[activeBrand] ?? BRAND_ICON.BOX_PRIME}
                alt={BRAND_NAME[activeBrand] ?? activeBrand}
                className="w-full h-full object-contain"
              />
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-[#141414] opacity-60 hover:opacity-100 transition-colors p-1 shrink-0"
          >
            <Menu size={20} />
          </button>
        </div>

        <nav className="flex-1 py-6 px-3 flex flex-col gap-2 overflow-y-auto">
          {visibleNav.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 transition-all duration-200 outline-none border border-transparent",
                  isActive
                    ? "bg-[#141414] text-[#E4E3E0] shadow-[2px_2px_0_#9f9d99]"
                    : "text-[#141414] opacity-60 hover:opacity-100 hover:border-[#141414] hover:bg-white/50"
                )}
                title={item.label}
              >
                <item.icon size={18} className={cn("flex-shrink-0", isActive && "stroke-[2.5px]")} />
                <AnimatePresence>
                  {sidebarOpen && (
                    <motion.span
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0 }}
                      className="font-mono text-xs font-semibold uppercase tracking-wider whitespace-nowrap overflow-hidden"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>
            );
          })}
        </nav>

        {sidebarOpen && (
          <div className="p-4 border-t border-[#141414] flex flex-col gap-2">
            <div className="flex flex-col gap-1">
              <label className="font-mono text-[9px] opacity-60 font-bold uppercase tracking-widest">MÓDULO ACTIVO:</label>
              <select
                value={activeBrand}
                onChange={(e) => setActiveBrand(e.target.value as any)}
                className="w-full bg-white/50 border border-[#141414] py-1 px-2 text-[10px] font-bold text-[#141414] focus:outline-none focus:bg-white focus:shadow-[2px_2px_0_#141414] transition-all font-mono uppercase cursor-pointer"
              >
                <option value="OVERSHARK">OVERSHARK</option>
                <option value="BRAVOS">BRAVOS URBAN</option>
                <option value="BOX_PRIME">BOX PRIME</option>
              </select>
            </div>

            <div className="font-mono text-[8px] opacity-60 uppercase tracking-widest mt-2">{BRAND_LEGAL[activeBrand] ?? activeBrand} // v-3.0</div>
          </div>
        )}
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col relative overflow-hidden min-w-0">
        {/* Top Header */}
        <header className="h-14 md:h-16 border-b border-[#141414] bg-[#E4E3E0] flex items-center justify-between px-3 md:px-6 gap-2">
          <div className="flex items-center gap-2 md:gap-4 min-w-0">
            <button
              className="md:hidden p-1.5 border border-[#141414] shrink-0"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu size={16} />
            </button>
            <img src="/img-icono/zazu_icon.png" alt="LogixZazu" className="w-7 h-7 md:w-8 md:h-8 object-contain shrink-0" />
            <h1 className="text-sm md:text-lg font-black tracking-tighter uppercase shrink-0 truncate">{activeBrand.replace('_', ' ')} / Central_01</h1>
            <span className="hidden sm:inline text-[10px] font-mono bg-[#141414] text-[#E4E3E0] px-2 py-0.5 border border-[#141414] whitespace-nowrap shrink-0">/ {navItems.find(n => n.id === activeTab)?.label}</span>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="flex flex-col items-end gap-0.5">
              <span className="font-mono font-black text-[11px] text-[#141414] uppercase tracking-wider">{currentUser.username || '—'}</span>
              <span className="font-mono text-[9px] opacity-50 uppercase tracking-widest hidden sm:block">{ROLE_LABELS[currentUser.role] ?? currentUser.role}</span>
            </div>
            <button
              onClick={() => supabase.auth.signOut()}
              title="Cerrar sesión"
              className="p-1.5 border border-transparent hover:border-red-600 hover:text-red-600 transition-colors"
            >
              <LogOut size={15} />
            </button>
          </div>
        </header>

        {/* Content Viewport */}
        <div className="flex-1 overflow-auto p-4 md:p-6 lg:p-8 w-full max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
};

import React from 'react';
import { useAppContext } from '../store/AppContext';
import { ModuleInfo } from '../components/ModuleInfo';
import { Package, TrendingUp } from 'lucide-react';

export const Analysis: React.FC = () => {
  const { products, stockLevels } = useAppContext();

  const totalInventoryValue = stockLevels.reduce((acc, curr) => {
    const p = products.find(prod => prod.id === curr.productId);
    return acc + (p?.costPrice || 0) * curr.quantity;
  }, 0);

  const totalInventorySellValue = stockLevels.reduce((acc, curr) => {
    const p = products.find(prod => prod.id === curr.productId);
    return acc + (p?.sellPrice || 0) * curr.quantity;
  }, 0);

  return (
    <div className="h-full flex flex-col gap-6">
      <ModuleInfo number="02" title="Análisis de Costos" description="Valorización financiera del inventario: calcula el costo total de compra y la proyección de ingresos según precios de venta registrados por SKU." />
      <div className="border-b border-[#141414] pb-3">
        <h2 className="font-serif italic font-bold text-xs uppercase tracking-widest text-[#141414]">05 // ANÁLISIS DE COSTOS</h2>
        <p className="font-mono text-[10px] opacity-70 uppercase tracking-wide mt-1">Valorización del inventario activo.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="border-2 border-[#141414] bg-white p-6 relative overflow-hidden">
          <div className="absolute right-0 top-0 opacity-5 scale-150 -translate-y-4 translate-x-4">
            <Package size={120} />
          </div>
          <div className="relative z-10">
            <h3 className="font-mono text-[10px] font-bold tracking-widest opacity-60 uppercase mb-2">VALORIZACIÓN (COSTO)</h3>
            <div className="font-mono text-3xl font-black">
              S/ {totalInventoryValue.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
            </div>
            <p className="font-mono text-[10px] uppercase font-bold mt-4 opacity-70">VALOR TOTAL DE COMPRA DEL STOCK ALMACENADO.</p>
          </div>
        </div>

        <div className="border-2 border-[#141414] bg-[#141414] text-[#E4E3E0] p-6 relative overflow-hidden">
          <div className="absolute right-0 top-0 opacity-5 scale-150 -translate-y-4 translate-x-4">
            <TrendingUp size={120} />
          </div>
          <div className="relative z-10">
            <h3 className="font-mono text-[10px] font-bold tracking-widest opacity-60 uppercase mb-2">VALORIZACIÓN (P. VENTA)</h3>
            <div className="font-mono text-3xl font-black">
              S/ {totalInventorySellValue.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
            </div>
            <p className="font-mono text-[10px] uppercase font-bold mt-4 opacity-70 text-[#E4E3E0]/70">PROYECCIÓN DE INGRESOS BRUTOS DEL STOCK ALMACENADO.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

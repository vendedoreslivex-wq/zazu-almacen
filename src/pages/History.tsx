import React, { useState } from 'react';
import { useAppContext } from '../store/AppContext';
import { ModuleInfo } from '../components/ModuleInfo';
import { format } from 'date-fns';
import { ChevronRight, ChevronDown, Download } from 'lucide-react';

export const History: React.FC = () => {
    const { transactions, products, locations, contacts } = useAppContext();
    const [filterType, setFilterType] = useState('ALL');
    const [filterStatus, setFilterStatus] = useState('ALL');
    const [filterProduct, setFilterProduct] = useState('ALL');
    const [filterUser, setFilterUser] = useState('ALL');
    const [dateRangePreset, setDateRangePreset] = useState('ALL_TIME');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [showFilters, setShowFilters] = useState(false);
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

    const uniqueUsers = Array.from(new Set(transactions.map(tx => tx.user || 'OPERATOR_01')));

    const filteredTransactions = transactions.filter(tx => {
        if (filterType !== 'ALL' && tx.type !== filterType) return false;
        if (filterStatus !== 'ALL' && tx.status !== filterStatus) return false;
        if (filterProduct !== 'ALL' && tx.productId !== filterProduct) return false;
        const txUser = tx.user || 'OPERATOR_01';
        if (filterUser !== 'ALL' && txUser !== filterUser) return false;
        if (dateFrom && new Date(tx.date) < new Date(dateFrom)) return false;
        if (dateTo) {
            const dTo = new Date(dateTo);
            dTo.setHours(23, 59, 59, 999);
            if (new Date(tx.date) > dTo) return false;
        }
        return true;
    });

    const resetFilters = () => {
        setFilterType('ALL');
        setFilterStatus('ALL');
        setFilterProduct('ALL');
        setFilterUser('ALL');
        setDateRangePreset('ALL_TIME');
        setDateFrom('');
        setDateTo('');
    };

    const handleDatePreset = (preset: string) => {
        setDateRangePreset(preset);
        if (preset === 'ALL_TIME') {
            setDateFrom('');
            setDateTo('');
        } else if (preset === 'LAST_7_DAYS') {
            const d = new Date();
            d.setDate(d.getDate() - 7);
            setDateFrom(d.toISOString().split('T')[0]);
            setDateTo('');
        } else if (preset === 'THIS_MONTH') {
            const d = new Date();
            d.setDate(1);
            setDateFrom(d.toISOString().split('T')[0]);
            setDateTo('');
        }
    };

    const toggleExpand = (id: string) => {
        const newExpanded = new Set(expandedRows);
        if (newExpanded.has(id)) {
            newExpanded.delete(id);
        } else {
            newExpanded.add(id);
        }
        setExpandedRows(newExpanded);
    };

    const exportToCSV = () => {
        const headers = ["ID", "Fecha", "Tipo", "Estado", "Producto SKU", "Nombre Producto", "Cantidad", "Origen", "Destino", "Usuario", "Referencia"];
        const rows = filteredTransactions.map(tx => {
            const product = products.find(p => p.id === tx.productId);
            const fromLoc = locations.find(l => l.id === tx.fromLocationId);
            const toLoc = locations.find(l => l.id === tx.toLocationId);
            return [
                tx.id,
                format(new Date(tx.date), 'dd/MM/yy HH:mm:ss'),
                tx.type,
                tx.status,
                product?.code || '',
                product?.name || '',
                tx.quantity,
                fromLoc?.name || '',
                toLoc?.name || '',
                tx.user || 'OPERATOR_01',
                tx.reference
            ];
        });

        const csvContent = [
            headers.join(","),
            ...rows.map(r => r.map(field => `"${String(field).replace(/"/g, '""')}"`).join(","))
        ].join("\n");

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `transacciones_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="h-full flex flex-col gap-6 relative">
            <ModuleInfo number="08" title="Historial" description="Registro inmutable de todas las transacciones del almacén. Consulta filtrada por tipo, producto o fecha con opción de imprimir tickets de operación." />
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 border-b border-[#141414] pb-3">
                <div>
                    <h2 className="font-serif italic font-bold text-xs uppercase tracking-widest">01 // Registro_Auditoría</h2>
                    <p className="font-mono text-[10px] opacity-70 uppercase tracking-wide mt-1">Historial inmutable de movimientos en la red de almacenes.</p>
                </div>
                <div className="flex items-center gap-2">
                    <button 
                        onClick={exportToCSV}
                        className="flex items-center gap-2 px-3 py-1.5 font-mono text-[10px] font-bold uppercase transition-all border border-[#141414] shadow-[2px_2px_0_#141414] active:shadow-none active:translate-y-[2px] active:translate-x-[2px] bg-white text-[#141414] hover:bg-black/5"
                    >
                        <Download size={14} /> EXPORTAR CSV
                    </button>
                    <button 
                        onClick={() => setShowFilters(!showFilters)}
                        className={`flex items-center gap-2 px-3 py-1.5 font-mono text-[10px] font-bold uppercase transition-all border border-[#141414] shadow-[2px_2px_0_#141414] active:shadow-none active:translate-y-[2px] active:translate-x-[2px] ${showFilters ? 'bg-[#141414] text-[#E4E3E0]' : 'bg-white/50 text-[#141414] hover:bg-white'}`}
                    >
                        FILTROS {showFilters ? 'ACTIVOS' : ''}
                    </button>
                </div>
            </div>

            {showFilters && (
                <div className="bg-white/40 border border-[#141414] p-4 flex flex-col gap-4">
                    <div className="flex flex-col md:flex-row gap-4 items-end">
                        <div className="flex flex-col gap-1.5 flex-1 lg:max-w-xs">
                            <label className="font-mono text-[9px] font-bold opacity-70 tracking-widest uppercase">TIPO OPERACIÓN</label>
                            <select 
                                value={filterType} 
                                onChange={e => setFilterType(e.target.value)}
                                className="bg-white/70 border border-[#141414] p-2 text-[10px] font-bold uppercase font-mono rounded-none"
                            >
                                <option value="ALL">TODAS</option>
                                <option value="RECEPTION">RECEPCIÓN</option>
                                <option value="DISPATCH">DESPACHO</option>
                                <option value="TRANSFER">TRANSLADO</option>
                            </select>
                        </div>
                        <div className="flex flex-col gap-1.5 flex-1 lg:max-w-xs">
                            <label className="font-mono text-[9px] font-bold opacity-70 tracking-widest uppercase">ESTADO</label>
                            <select 
                                value={filterStatus} 
                                onChange={e => setFilterStatus(e.target.value)}
                                className="bg-white/70 border border-[#141414] p-2 text-[10px] font-bold uppercase font-mono rounded-none"
                            >
                                <option value="ALL">TODOS</option>
                                <option value="COMPLETED">COMPLETADO</option>
                                <option value="PENDING">PENDIENTE</option>
                                <option value="CANCELLED">CANCELADO</option>
                                <option value="PREPARING">PREPARANDO</option>
                            </select>
                        </div>
                        <div className="flex flex-col gap-1.5 flex-1 lg:max-w-xs">
                            <label className="font-mono text-[9px] font-bold opacity-70 tracking-widest uppercase">PRODUCTO SKU</label>
                            <select 
                                value={filterProduct} 
                                onChange={e => setFilterProduct(e.target.value)}
                                className="bg-white/70 border border-[#141414] p-2 text-[10px] font-bold uppercase font-mono rounded-none"
                            >
                                <option value="ALL">TODOS LOS PRODUCTOS</option>
                                {products.map(p => (
                                    <option key={p.id} value={p.id}>{p.code} - {p.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex flex-col gap-1.5 flex-1 lg:max-w-xs">
                            <label className="font-mono text-[9px] font-bold opacity-70 tracking-widest uppercase">USUARIO</label>
                            <select 
                                value={filterUser} 
                                onChange={e => setFilterUser(e.target.value)}
                                className="bg-white/70 border border-[#141414] p-2 text-[10px] font-bold uppercase font-mono rounded-none"
                            >
                                <option value="ALL">TODOS LOS USUARIOS</option>
                                {uniqueUsers.map(u => (
                                    <option key={u} value={u}>{u}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    
                    <div className="flex flex-col md:flex-row gap-4 items-end">
                        <div className="flex flex-col gap-1.5 flex-1 lg:max-w-xs">
                            <label className="font-mono text-[9px] font-bold opacity-70 tracking-widest uppercase">RANGO DE FECHAS</label>
                            <div className="flex bg-white/70 border border-[#141414]">
                                <button type="button" onClick={() => handleDatePreset('ALL_TIME')} className={`flex-1 px-2 py-2 text-[9px] font-bold uppercase font-mono transition-colors ${dateRangePreset === 'ALL_TIME' ? 'bg-[#141414] text-[#E4E3E0]' : 'hover:bg-black/5'}`}>TODO</button>
                                <div className="w-[1px] bg-[#141414]"></div>
                                <button type="button" onClick={() => handleDatePreset('LAST_7_DAYS')} className={`flex-1 px-2 py-2 text-[9px] font-bold uppercase font-mono transition-colors ${dateRangePreset === 'LAST_7_DAYS' ? 'bg-[#141414] text-[#E4E3E0]' : 'hover:bg-black/5'}`}>ÚLT 7D</button>
                                <div className="w-[1px] bg-[#141414]"></div>
                                <button type="button" onClick={() => handleDatePreset('THIS_MONTH')} className={`flex-1 px-2 py-2 text-[9px] font-bold uppercase font-mono transition-colors ${dateRangePreset === 'THIS_MONTH' ? 'bg-[#141414] text-[#E4E3E0]' : 'hover:bg-black/5'}`}>ESTE MES</button>
                                <div className="w-[1px] bg-[#141414]"></div>
                                <button type="button" onClick={() => handleDatePreset('CUSTOM')} className={`flex-1 px-2 py-2 text-[9px] font-bold uppercase font-mono transition-colors ${dateRangePreset === 'CUSTOM' ? 'bg-[#141414] text-[#E4E3E0]' : 'hover:bg-black/5'}`}>PERSONALIZADO</button>
                            </div>
                        </div>
                        {dateRangePreset === 'CUSTOM' && (
                            <>
                                <div className="flex flex-col gap-1.5 flex-1 lg:max-w-[150px]">
                                    <label className="font-mono text-[9px] font-bold opacity-70 tracking-widest uppercase">DESDE</label>
                                    <input 
                                        type="date" 
                                        value={dateFrom}
                                        onChange={e => setDateFrom(e.target.value)}
                                        className="bg-white/70 border border-[#141414] p-2 text-[10px] font-bold uppercase font-mono rounded-none w-full"
                                    />
                                </div>
                                <div className="flex flex-col gap-1.5 flex-1 lg:max-w-[150px]">
                                    <label className="font-mono text-[9px] font-bold opacity-70 tracking-widest uppercase">HASTA</label>
                                    <input 
                                        type="date" 
                                        value={dateTo}
                                        onChange={e => setDateTo(e.target.value)}
                                        className="bg-white/70 border border-[#141414] p-2 text-[10px] font-bold uppercase font-mono rounded-none w-full"
                                    />
                                </div>
                            </>
                        )}
                        <div className="flex-1"></div>
                        <button 
                            onClick={resetFilters}
                            className="px-4 py-2 font-mono text-[10px] font-bold uppercase border border-[#141414] hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors mb-0.5"
                        >
                            LIMPIAR
                        </button>
                    </div>
                </div>
            )}

            <div className="data-table-container flex-1 flex flex-col overflow-hidden">
                <div className="grid grid-cols-[40px_140px_100px_minmax(150px,1fr)_100px_minmax(120px,1fr)_minmax(120px,1fr)_100px] data-header sticky top-0 bg-[#BCBBA7]">
                    <div></div>
                    <div>TIMESTAMP</div>
                    <div>TIPO</div>
                    <div>PRODUCTO</div>
                    <div className="text-right">CANT.</div>
                    <div className="pl-6">ORIGEN</div>
                    <div>DESTINO</div>
                    <div>REFERENCIA</div>
                </div>

                <div className="flex-1 overflow-auto">
                    {filteredTransactions.map(tx => {
                        const product = products.find(p => p.id === tx.productId);
                        const fromLoc = locations.find(l => l.id === tx.fromLocationId);
                        const toLoc = locations.find(l => l.id === tx.toLocationId);
                        const isExpanded = expandedRows.has(tx.id);

                        let colorOpt = 'bg-white text-[#141414] border-[#141414]';
                        if (tx.type === 'RECEPTION') colorOpt = 'bg-[#15803d] text-white border-[#141414]';
                        else if (tx.type === 'DISPATCH') colorOpt = 'bg-[#141414] text-[#E4E3E0] border-[#141414]';
                        else if (tx.type === 'TRANSFER') colorOpt = 'bg-blue-200 text-blue-900 border-blue-900';

                        return (
                            <React.Fragment key={tx.id}>
                                <div 
                                    className={`grid grid-cols-[40px_140px_100px_minmax(150px,1fr)_100px_minmax(120px,1fr)_minmax(120px,1fr)_100px] data-row items-center cursor-pointer select-none ${isExpanded ? 'bg-white/80 border-b-transparent' : ''}`}
                                    onClick={() => toggleExpand(tx.id)}
                                >
                                    <div className="flex justify-center opacity-50">
                                        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                    </div>
                                    <div className="font-mono text-[10px] opacity-70 font-bold">
                                        {format(new Date(tx.date), 'dd/MM/yy HH:mm:ss')}
                                    </div>
                                    <div className={`font-mono text-[9px] uppercase font-bold tracking-wider border py-0.5 px-2 w-fit ${colorOpt}`}>
                                        {tx.type}
                                    </div>
                                    <div className="flex flex-col gap-0.5">
                                        <span className="text-[10px] font-bold uppercase">{product?.name || '---'}</span>
                                        <span className="font-mono text-[9px] opacity-60">{product?.code}</span>
                                    </div>
                                    <div className="font-mono text-right text-base font-black">
                                        {tx.type === 'DISPATCH' ? '-' : tx.type === 'RECEPTION' ? '+' : ''}{tx.quantity}
                                    </div>
                                    <div className="pl-6 font-mono text-[10px] opacity-80 uppercase">
                                        {fromLoc?.name || '---'}
                                    </div>
                                    <div className="font-mono text-[10px] opacity-80 uppercase">
                                        {toLoc?.name || '---'}
                                    </div>
                                    <div className="text-[10px] font-bold uppercase truncate opacity-70">
                                        {tx.reference}
                                    </div>
                                </div>
                                {isExpanded && (
                                    <div className="bg-white/30 border-b border-[#141414] p-4 pl-[40px]">
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                            <div className="flex flex-col gap-1">
                                                <span className="text-[9px] font-bold uppercase tracking-widest opacity-60 font-mono">USUARIO_OPERADOR</span>
                                                <span className="text-xs font-bold font-mono">{tx.user || 'OPERATOR_01'}</span>
                                            </div>
                                            <div className="flex flex-col gap-1">
                                                <span className="text-[9px] font-bold uppercase tracking-widest opacity-60 font-mono">UBICACIÓN_ORIGEN</span>
                                                <span className="text-xs font-bold font-mono">{fromLoc ? fromLoc.name : (tx.fromLocationId ? 'N/A' : '---')}</span>
                                            </div>
                                            <div className="flex flex-col gap-1">
                                                <span className="text-[9px] font-bold uppercase tracking-widest opacity-60 font-mono">UBICACIÓN_DESTINO</span>
                                                <span className="text-xs font-bold font-mono">{toLoc ? toLoc.name : (tx.toLocationId ? 'N/A' : '---')}</span>
                                            </div>
                                            <div className="flex flex-col gap-1">
                                                <span className="text-[9px] font-bold uppercase tracking-widest opacity-60 font-mono">ESTADO_OPERACIÓN</span>
                                                <span className={`text-xs font-bold font-mono ${
                                                    tx.status === 'COMPLETED' ? 'text-[#15803d]' :
                                                    tx.status === 'PREPARING' ? 'text-blue-600' :
                                                    tx.status === 'CANCELLED' ? 'text-red-600' :
                                                    'text-yellow-600'
                                                }`}>
                                                    {tx.status}
                                                </span>
                                            </div>
                                            <div className="flex flex-col gap-1 md:col-span-2 lg:col-span-1">
                                                <span className="text-[9px] font-bold uppercase tracking-widest opacity-60 font-mono">ID_TRANSACCIÓN</span>
                                                <span className="text-[10px] font-bold font-mono bg-black/5 p-1 px-2 border border-black/10 w-fit truncate max-w-full" title={tx.id}>{tx.id}</span>
                                            </div>
                                            {tx.contactId && (
                                                <div className="flex flex-col gap-1 md:col-span-2 lg:col-span-1">
                                                    <span className="text-[9px] font-bold uppercase tracking-widest opacity-60 font-mono">
                                                        {tx.type === 'RECEPTION' ? 'PROVEEDOR' : 'CLIENTE'}
                                                    </span>
                                                    <span className="text-xs font-bold font-mono truncate">
                                                        {contacts.find(c => c.id === tx.contactId)?.name || '---'}
                                                    </span>
                                                </div>
                                            )}
                                            {tx.serialNumber && (
                                                <div className="flex flex-col gap-1 md:col-span-2 lg:col-span-1">
                                                    <span className="text-[9px] font-bold uppercase tracking-widest opacity-60 font-mono">LOTE/SERIE</span>
                                                    <span className="text-[10px] font-bold font-mono bg-black/5 p-1 px-2 border border-black/10 w-fit truncate max-w-full">{tx.serialNumber}</span>
                                                </div>
                                            )}
                                            {tx.signature && (
                                                <div className="flex flex-col gap-1 md:col-span-3">
                                                    <span className="text-[9px] font-bold uppercase tracking-widest opacity-60 font-mono">FIRMA DIGITAL</span>
                                                    <div className="border border-[#141414] bg-white w-48 h-20 p-1 flex items-center justify-center overflow-hidden">
                                                        <img src={tx.signature} alt="Firma de la operación" className="max-w-full max-h-full object-contain" />
                                                    </div>
                                                </div>
                                            )}
                                            <div className="flex flex-col gap-1 items-end justify-start md:col-span-3 lg:col-span-1">
                                                <button 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        // Simple PDF generation logic using print
                                                        const originalContents = document.body.innerHTML;
                                                        const ticktHTML = `
                                                            <div style="font-family: monospace; font-size: 12px; width: 300px; padding: 20px; border: 1px solid black; margin: auto;">
                                                                <h2 style="text-align: center; margin-bottom: 20px;">TICKET DE OPERACIÓN</h2>
                                                                <p><strong>ID:</strong> ${tx.id}</p>
                                                                <p><strong>TIPO:</strong> ${tx.type}</p>
                                                                <p><strong>FECHA:</strong> ${format(new Date(tx.date), 'dd/MM/yy HH:mm:ss')}</p>
                                                                <hr style="border:1px dashed black; margin: 10px 0;" />
                                                                <p><strong>MERCADERÍA:</strong> ${product?.name || '---'}</p>
                                                                <p><strong>CÓDIGO:</strong> ${product?.code || '---'}</p>
                                                                <p><strong>CANTIDAD:</strong> ${tx.type === 'DISPATCH' ? '-' : '+'}${tx.quantity}</p>
                                                                <hr style="border:1px dashed black; margin: 10px 0;" />
                                                                <p><strong>ORIGEN:</strong> ${fromLoc?.name || '---'}</p>
                                                                <p><strong>DESTINO:</strong> ${toLoc?.name || '---'}</p>
                                                                <p><strong>REFERENCIA:</strong> ${tx.reference}</p>
                                                                ${tx.serialNumber ? `<p><strong>LOTE/SERIE:</strong> ${tx.serialNumber}</p>` : ''}
                                                                <p><strong>OPERADOR:</strong> ${tx.user || 'OPERATOR_01'}</p>
                                                                ${tx.signature ? `<div style="text-align:center; margin-top:20px;">
                                                                    <p><strong>FIRMA:</strong></p>
                                                                    <img src="${tx.signature}" style="max-height: 60px; max-width: 200px;" />
                                                                </div>` : ''}
                                                            </div>
                                                        `;
                                                        
                                                        const printWindow = window.open('', '_blank');
                                                        if (printWindow) {
                                                            printWindow.document.write('<html><head><title>Ticket PDF</title></head><body onload="window.print();window.close()">' + ticktHTML + '</body></html>');
                                                            printWindow.document.close();
                                                        }
                                                    }}
                                                    className="bg-[#141414] text-white px-4 py-2 font-mono text-[9px] font-bold tracking-widest uppercase hover:bg-black transition-colors flex items-center gap-2"
                                                >
                                                    <span className="hidden sm:inline">GENERAR TICKET EN PDF</span>
                                                    <span className="sm:hidden">TICKET PDF</span>
                                                </button>
                                            </div>
                                            {tx.signature && (
                                                <div className="flex flex-col gap-1 md:col-span-3 lg:col-span-3 mt-4">
                                                    <span className="text-[9px] font-bold uppercase tracking-widest opacity-60 font-mono">FIRMA DIGITAL</span>
                                                    <div className="bg-white border border-[#141414] shadow-[2px_2px_0_#141414] p-2 inline-block w-fit">
                                                        <img src={tx.signature} alt="Firma de recepción" className="h-20 object-contain" />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </React.Fragment>
                        )
                    })}
                    {filteredTransactions.length === 0 && (
                        <div className="p-12 text-center font-mono text-sm opacity-50 font-bold uppercase">NO EXISTE REGISTRO CON LOS FILTROS ACTUALES</div>
                    )}
                </div>
            </div>
        </div>
    );
};

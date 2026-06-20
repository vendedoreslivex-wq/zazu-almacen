import React, { useState } from 'react';
import { useAppContext } from '../store/AppContext';
import { ModuleInfo } from '../components/ModuleInfo';
import { format } from 'date-fns';
import { ChevronRight, ChevronDown, Download, CheckSquare, Square } from 'lucide-react';

export const History: React.FC = () => {
    const { transactions, products, locations, contacts } = useAppContext();
    const [filterType, setFilterType] = useState('ALL');
    const [filterStatus, setFilterStatus] = useState('ALL');
    const [filterProduct, setFilterProduct] = useState('ALL');
    const [filterUser, setFilterUser] = useState('ALL');
    const [filterContact, setFilterContact] = useState('ALL');
    const [filterReference, setFilterReference] = useState('');
    const [dateRangePreset, setDateRangePreset] = useState('ALL_TIME');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [filterHasSignature, setFilterHasSignature] = useState(false);
    const [filterHasPhoto, setFilterHasPhoto] = useState(false);
    const [showFilters, setShowFilters] = useState(false);
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
    const [selected, setSelected] = useState<Set<string>>(new Set());

    const uniqueUsers = Array.from(new Set(transactions.map(tx => tx.user || 'OPERATOR_01')));

    const activeFilterCount = [
        filterType !== 'ALL', filterStatus !== 'ALL', filterProduct !== 'ALL',
        filterUser !== 'ALL', filterContact !== 'ALL', filterReference.trim() !== '',
        dateRangePreset !== 'ALL_TIME', filterHasSignature, filterHasPhoto,
    ].filter(Boolean).length;

    const filteredTransactions = transactions.filter(tx => {
        if (filterType !== 'ALL' && tx.type !== filterType) return false;
        if (filterStatus !== 'ALL' && tx.status !== filterStatus) return false;
        if (filterProduct !== 'ALL' && tx.productId !== filterProduct) return false;
        const txUser = tx.user || 'OPERATOR_01';
        if (filterUser !== 'ALL' && txUser !== filterUser) return false;
        if (filterContact !== 'ALL' && tx.contactId !== filterContact) return false;
        if (filterReference.trim() && !tx.reference?.toLowerCase().includes(filterReference.toLowerCase())) return false;
        if (filterHasSignature && !tx.signature) return false;
        if (filterHasPhoto && !(tx as any).photo) return false;
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
        setFilterContact('ALL');
        setFilterReference('');
        setDateRangePreset('ALL_TIME');
        setDateFrom('');
        setDateTo('');
        setFilterHasSignature(false);
        setFilterHasPhoto(false);
    };

    const toggleSelect = (id: string) => {
        const next = new Set(selected);
        if (next.has(id)) next.delete(id); else next.add(id);
        setSelected(next);
    };

    const allSelected = filteredTransactions.length > 0 && filteredTransactions.every(tx => selected.has(tx.id));
    const someSelected = selected.size > 0;

    const toggleSelectAll = () => {
        if (allSelected) {
            const next = new Set(selected);
            filteredTransactions.forEach(tx => next.delete(tx.id));
            setSelected(next);
        } else {
            const next = new Set(selected);
            filteredTransactions.forEach(tx => next.add(tx.id));
            setSelected(next);
        }
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
        const toExport = someSelected
            ? filteredTransactions.filter(tx => selected.has(tx.id))
            : filteredTransactions;
        const headers = ["ID", "Fecha", "Tipo", "Estado", "SKU", "Producto", "Color", "Talla", "Cantidad", "Origen", "Destino", "Contacto", "Usuario", "Referencia"];
        const rows = toExport.map(tx => {
            const product = products.find(p => p.id === tx.productId);
            const fromLoc = locations.find(l => l.id === tx.fromLocationId);
            const toLoc = locations.find(l => l.id === tx.toLocationId);
            const contact = contacts.find(c => c.id === tx.contactId);
            return [
                tx.id,
                format(new Date(tx.date + (tx.date.length === 10 ? 'T00:00:00' : '')), 'dd/MM/yy HH:mm:ss'),
                tx.type,
                tx.status,
                product?.code || '',
                product?.name || '',
                product?.color || '',
                product?.size || '',
                tx.quantity,
                fromLoc?.name || '',
                toLoc?.name || '',
                contact?.name || '',
                tx.user || '',
                tx.reference,
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
            <ModuleInfo number="10" title="Historial" description="Registro inmutable de todas las transacciones del almacen. Consulta filtrada por tipo, producto o fecha con opcion de imprimir tickets de operacion." />
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 border-b border-[var(--border)] pb-3">
                <div>
                    <h2 className="font-mono font-black text-xs uppercase tracking-widest">08 // HISTORIAL_OPERACIONES</h2>
                    <p className="font-mono text-[10px] opacity-70 uppercase tracking-wide mt-1">{filteredTransactions.length} registros · historial inmutable de movimientos en la red de almacenes.</p>
                </div>
                <div className="flex items-center gap-2">
                    {someSelected && (
                        <span className="font-mono text-[9px] font-bold opacity-60">{selected.size} SEL.</span>
                    )}
                    <button
                        onClick={exportToCSV}
                        className="flex items-center gap-2 px-3 py-1.5 font-mono text-[10px] font-bold uppercase transition-all border border-[var(--border)] shadow-[2px_2px_0_var(--border)] active:shadow-none active:translate-y-[2px] active:translate-x-[2px] bg-[var(--bg-input)] text-[var(--ink)] hover:bg-black/5"
                    >
                        <Download size={14} /> {someSelected ? `CSV (${selected.size})` : 'EXPORTAR CSV'}
                    </button>
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`flex items-center gap-2 px-3 py-1.5 font-mono text-[10px] font-bold uppercase transition-all border border-[var(--border)] shadow-[2px_2px_0_var(--border)] active:shadow-none active:translate-y-[2px] active:translate-x-[2px] ${showFilters ? 'bg-[var(--ink)] text-[var(--ink-inv)]' : 'bg-[var(--surface)] text-[var(--ink)] hover:bg-[var(--bg-input)]'}`}
                    >
                        FILTROS
                        {activeFilterCount > 0 && (
                            <span className="bg-red-600 text-white font-black text-[8px] rounded-full w-4 h-4 flex items-center justify-center leading-none">
                                {activeFilterCount}
                            </span>
                        )}
                    </button>
                </div>
            </div>

            {showFilters && (
                <div className="bg-[var(--bg-card)] border border-[var(--border)] p-4 flex flex-col gap-4">
                    <div className="flex flex-col md:flex-row gap-4 items-end">
                        <div className="flex flex-col gap-1.5 flex-1 lg:max-w-xs">
                            <label className="font-mono text-[9px] font-bold opacity-70 tracking-widest uppercase">TIPO OPERACION</label>
                            <select 
                                value={filterType} 
                                onChange={e => setFilterType(e.target.value)}
                                className="bg-[var(--bg-card-alt)] border border-[var(--border)] p-2 text-[10px] font-bold uppercase font-mono rounded-none"
                            >
                                <option value="ALL">TODAS</option>
                                <option value="RECEPTION">RECEPCION</option>
                                <option value="DISPATCH">DESPACHO</option>
                                <option value="TRANSFER">TRANSLADO</option>
                            </select>
                        </div>
                        <div className="flex flex-col gap-1.5 flex-1 lg:max-w-xs">
                            <label className="font-mono text-[9px] font-bold opacity-70 tracking-widest uppercase">ESTADO</label>
                            <select 
                                value={filterStatus} 
                                onChange={e => setFilterStatus(e.target.value)}
                                className="bg-[var(--bg-card-alt)] border border-[var(--border)] p-2 text-[10px] font-bold uppercase font-mono rounded-none"
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
                                className="bg-[var(--bg-card-alt)] border border-[var(--border)] p-2 text-[10px] font-bold uppercase font-mono rounded-none"
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
                                className="bg-[var(--bg-card-alt)] border border-[var(--border)] p-2 text-[10px] font-bold uppercase font-mono rounded-none"
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
                            <label className="font-mono text-[9px] font-bold opacity-70 tracking-widest uppercase">CONTACTO</label>
                            <select
                                value={filterContact}
                                onChange={e => setFilterContact(e.target.value)}
                                className="bg-[var(--bg-card-alt)] border border-[var(--border)] p-2 text-[10px] font-bold uppercase font-mono rounded-none"
                            >
                                <option value="ALL">TODOS LOS CONTACTOS</option>
                                {contacts.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex flex-col gap-1.5 flex-1 lg:max-w-xs">
                            <label className="font-mono text-[9px] font-bold opacity-70 tracking-widest uppercase">REFERENCIA / GU-A</label>
                            <input
                                type="text"
                                value={filterReference}
                                onChange={e => setFilterReference(e.target.value)}
                                placeholder="Buscar referencia..."
                                className="bg-[var(--bg-card-alt)] border border-[var(--border)] p-2 text-[10px] font-bold uppercase font-mono rounded-none w-full placeholder:opacity-40 placeholder:normal-case outline-none focus:bg-[var(--bg-input)]"
                            />
                        </div>
                    </div>

                    <div className="flex gap-3 flex-wrap">
                        <button type="button" onClick={() => setFilterHasSignature(v => !v)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 font-mono text-[9px] font-bold uppercase border border-[var(--border)] transition-colors ${filterHasSignature ? 'bg-[var(--ink)] text-[var(--ink-inv)]' : 'bg-[var(--surface)] hover:bg-[var(--bg-input)]'}`}>
                            {filterHasSignature ? <CheckSquare size={11} /> : <Square size={11} />} CON FIRMA
                        </button>
                        <button type="button" onClick={() => setFilterHasPhoto(v => !v)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 font-mono text-[9px] font-bold uppercase border border-[var(--border)] transition-colors ${filterHasPhoto ? 'bg-[var(--ink)] text-[var(--ink-inv)]' : 'bg-[var(--surface)] hover:bg-[var(--bg-input)]'}`}>
                            {filterHasPhoto ? <CheckSquare size={11} /> : <Square size={11} />} CON FOTO
                        </button>
                    </div>

                    <div className="flex flex-col md:flex-row gap-4 items-end">
                        <div className="flex flex-col gap-1.5 flex-1 lg:max-w-xs">
                            <label className="font-mono text-[9px] font-bold opacity-70 tracking-widest uppercase">RANGO DE FECHAS</label>
                            <div className="flex bg-[var(--bg-card-alt)] border border-[var(--border)]">
                                <button type="button" onClick={() => handleDatePreset('ALL_TIME')} className={`flex-1 px-2 py-2 text-[9px] font-bold uppercase font-mono transition-colors ${dateRangePreset === 'ALL_TIME' ? 'bg-[var(--ink)] text-[var(--ink-inv)]' : 'hover:bg-black/5'}`}>TODO</button>
                                <div className="w-[1px] bg-[var(--ink)]"></div>
                                <button type="button" onClick={() => handleDatePreset('LAST_7_DAYS')} className={`flex-1 px-2 py-2 text-[9px] font-bold uppercase font-mono transition-colors ${dateRangePreset === 'LAST_7_DAYS' ? 'bg-[var(--ink)] text-[var(--ink-inv)]' : 'hover:bg-black/5'}`}>-LT 7D</button>
                                <div className="w-[1px] bg-[var(--ink)]"></div>
                                <button type="button" onClick={() => handleDatePreset('THIS_MONTH')} className={`flex-1 px-2 py-2 text-[9px] font-bold uppercase font-mono transition-colors ${dateRangePreset === 'THIS_MONTH' ? 'bg-[var(--ink)] text-[var(--ink-inv)]' : 'hover:bg-black/5'}`}>ESTE MES</button>
                                <div className="w-[1px] bg-[var(--ink)]"></div>
                                <button type="button" onClick={() => handleDatePreset('CUSTOM')} className={`flex-1 px-2 py-2 text-[9px] font-bold uppercase font-mono transition-colors ${dateRangePreset === 'CUSTOM' ? 'bg-[var(--ink)] text-[var(--ink-inv)]' : 'hover:bg-black/5'}`}>PERSONALIZADO</button>
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
                                        className="bg-[var(--bg-card-alt)] border border-[var(--border)] p-2 text-[10px] font-bold uppercase font-mono rounded-none w-full"
                                    />
                                </div>
                                <div className="flex flex-col gap-1.5 flex-1 lg:max-w-[150px]">
                                    <label className="font-mono text-[9px] font-bold opacity-70 tracking-widest uppercase">HASTA</label>
                                    <input 
                                        type="date" 
                                        value={dateTo}
                                        onChange={e => setDateTo(e.target.value)}
                                        className="bg-[var(--bg-card-alt)] border border-[var(--border)] p-2 text-[10px] font-bold uppercase font-mono rounded-none w-full"
                                    />
                                </div>
                            </>
                        )}
                        <div className="flex-1"></div>
                        <button 
                            onClick={resetFilters}
                            className="px-4 py-2 font-mono text-[10px] font-bold uppercase border border-[var(--border)] hover:bg-[var(--ink)] hover:text-[var(--ink-inv)] transition-colors mb-0.5"
                        >
                            LIMPIAR
                        </button>
                    </div>
                </div>
            )}

            <div className="data-table-container flex-1 flex flex-col overflow-hidden">
                <div className="grid grid-cols-[32px_40px_130px_90px_minmax(180px,1fr)_70px_minmax(110px,1fr)_minmax(110px,1fr)_110px_100px] data-header sticky top-0 bg-[var(--bg-sidebar)]">
                    <div className="flex items-center justify-center cursor-pointer" onClick={toggleSelectAll}>
                        {allSelected ? <CheckSquare size={13} /> : <Square size={13} className="opacity-50" />}
                    </div>
                    <div></div>
                    <div>FECHA</div>
                    <div>TIPO</div>
                    <div>PRODUCTO / MODELO</div>
                    <div className="text-right">CANT.</div>
                    <div className="pl-4">ORIGEN</div>
                    <div>DESTINO</div>
                    <div>CONTACTO</div>
                    <div>REFERENCIA</div>
                </div>

                <div className="flex-1 overflow-auto">
                    {filteredTransactions.map(tx => {
                        const product = products.find(p => p.id === tx.productId);
                        const fromLoc = locations.find(l => l.id === tx.fromLocationId);
                        const toLoc = locations.find(l => l.id === tx.toLocationId);
                        const isExpanded = expandedRows.has(tx.id);

                        let colorOpt = 'bg-[var(--bg-input)] text-[var(--ink)] border-[var(--border)]';
                        if (tx.type === 'RECEPTION') colorOpt = 'bg-[#15803d] text-white border-[var(--border)]';
                        else if (tx.type === 'DISPATCH') colorOpt = 'bg-[var(--ink)] text-[var(--ink-inv)] border-[var(--border)]';
                        else if (tx.type === 'TRANSFER') colorOpt = 'bg-blue-200 text-blue-600 border-blue-900';

                        const contact = contacts.find(c => c.id === tx.contactId);
                        const modelParts = [product?.color, product?.size].filter(Boolean).join(' · ');

                        return (
                            <React.Fragment key={tx.id}>
                                <div
                                    className={`grid grid-cols-[32px_40px_130px_90px_minmax(180px,1fr)_70px_minmax(110px,1fr)_minmax(110px,1fr)_110px_100px] data-row items-center cursor-pointer select-none ${isExpanded ? 'bg-[var(--bg-card-alt)] border-b-transparent' : ''} ${selected.has(tx.id) ? '!bg-blue-500/10' : ''}`}
                                    onClick={() => toggleExpand(tx.id)}
                                >
                                    <div className="flex justify-center" onClick={e => { e.stopPropagation(); toggleSelect(tx.id); }}>
                                        {selected.has(tx.id) ? <CheckSquare size={13} className="text-blue-600" /> : <Square size={13} className="opacity-30" />}
                                    </div>
                                    <div className="flex justify-center opacity-50">
                                        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                    </div>
                                    <div className="font-mono text-[10px] opacity-70 font-bold">
                                        {format(new Date(tx.date + (tx.date.length === 10 ? 'T00:00:00' : '')), 'dd/MM/yy HH:mm')}
                                    </div>
                                    <div className={`font-mono text-[9px] uppercase font-bold tracking-wider border py-0.5 px-2 w-fit ${colorOpt}`}>
                                        {tx.type === 'RECEPTION' ? 'RECEP.' : tx.type === 'DISPATCH' ? 'DESP.' : 'TRANSF.'}
                                    </div>
                                    <div className="flex flex-col gap-0.5 min-w-0">
                                        <span className="text-[10px] font-bold uppercase truncate">{product?.name || '---'}</span>
                                        <span className="font-mono text-[9px] opacity-60 truncate">
                                            {product?.code}{modelParts ? ` · ${modelParts}` : ''}
                                        </span>
                                    </div>
                                    <div className={`font-mono text-right text-sm font-black ${tx.type === 'DISPATCH' ? 'text-red-600' : tx.type === 'RECEPTION' ? 'text-green-700' : 'text-blue-600'}`}>
                                        {tx.type === 'DISPATCH' ? '-' : tx.type === 'RECEPTION' ? '+' : ''}{tx.quantity}
                                    </div>
                                    <div className="pl-4 font-mono text-[10px] opacity-80 uppercase truncate">
                                        {fromLoc?.name || '---'}
                                    </div>
                                    <div className="font-mono text-[10px] opacity-80 uppercase truncate">
                                        {toLoc?.name || '---'}
                                    </div>
                                    <div className="font-mono text-[10px] uppercase truncate opacity-70">
                                        {contact?.name || '—'}
                                    </div>
                                    <div className="text-[10px] font-bold uppercase truncate opacity-70">
                                        {tx.reference}
                                    </div>
                                </div>
                                {isExpanded && (
                                    <div className="bg-[var(--surface-alt)] border-b border-[var(--border)] p-4 pl-[40px]">
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                            <div className="flex flex-col gap-1">
                                                <span className="text-[9px] font-bold uppercase tracking-widest opacity-60 font-mono">USUARIO_OPERADOR</span>
                                                <span className="text-xs font-bold font-mono">{tx.user || 'OPERATOR_01'}</span>
                                            </div>
                                            <div className="flex flex-col gap-1">
                                                <span className="text-[9px] font-bold uppercase tracking-widest opacity-60 font-mono">UBICACION_ORIGEN</span>
                                                <span className="text-xs font-bold font-mono">{fromLoc ? fromLoc.name : (tx.fromLocationId ? 'N/A' : '---')}</span>
                                            </div>
                                            <div className="flex flex-col gap-1">
                                                <span className="text-[9px] font-bold uppercase tracking-widest opacity-60 font-mono">UBICACION_DESTINO</span>
                                                <span className="text-xs font-bold font-mono">{toLoc ? toLoc.name : (tx.toLocationId ? 'N/A' : '---')}</span>
                                            </div>
                                            <div className="flex flex-col gap-1">
                                                <span className="text-[9px] font-bold uppercase tracking-widest opacity-60 font-mono">ESTADO_OPERACION</span>
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
                                                <span className="text-[9px] font-bold uppercase tracking-widest opacity-60 font-mono">ID_TRANSACCION</span>
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
                                                    <div className="border border-[var(--border)] bg-[var(--bg-input)] w-48 h-20 p-1 flex items-center justify-center overflow-hidden">
                                                        <img src={tx.signature} alt="Firma de la operacion" className="max-w-full max-h-full object-contain" />
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
                                                                <h2 style="text-align: center; margin-bottom: 20px;">TICKET DE OPERACION</h2>
                                                                <p><strong>ID:</strong> ${tx.id}</p>
                                                                <p><strong>TIPO:</strong> ${tx.type}</p>
                                                                <p><strong>FECHA:</strong> ${format(new Date(tx.date), 'dd/MM/yy HH:mm:ss')}</p>
                                                                <hr style="border:1px dashed black; margin: 10px 0;" />
                                                                <p><strong>MERCADER-A:</strong> ${product?.name || '---'}</p>
                                                                <p><strong>CODIGO:</strong> ${product?.code || '---'}</p>
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
                                                    className="bg-[var(--ink)] text-white px-4 py-2 font-mono text-[9px] font-bold tracking-widest uppercase hover:bg-black transition-colors flex items-center gap-2"
                                                >
                                                    <span className="hidden sm:inline">GENERAR TICKET EN PDF</span>
                                                    <span className="sm:hidden">TICKET PDF</span>
                                                </button>
                                            </div>
                                            {tx.signature && (
                                                <div className="flex flex-col gap-1 md:col-span-3 lg:col-span-3 mt-4">
                                                    <span className="text-[9px] font-bold uppercase tracking-widest opacity-60 font-mono">FIRMA DIGITAL</span>
                                                    <div className="bg-[var(--bg-input)] border border-[var(--border)] shadow-[2px_2px_0_var(--border)] p-2 inline-block w-fit">
                                                        <img src={tx.signature} alt="Firma de recepcion" className="h-20 object-contain" />
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

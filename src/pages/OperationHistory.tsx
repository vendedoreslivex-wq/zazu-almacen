import React, { useState, useMemo } from 'react';
import { useAppContext } from '../store/AppContext';
import { ModuleInfo } from '../components/ModuleInfo';
import { format, parseISO, startOfDay, endOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronDown, ChevronUp, Filter, Download, RefreshCw } from 'lucide-react';
import type { AuditAction, AuditLogEntry } from '../types';

// ─── Friendly labels ───────────────────────────────────────────────────────────

const TABLE_LABEL: Record<string, string> = {
  products: 'Productos',
  locations: 'Ubicaciones',
  contacts: 'Contactos',
  stock_levels: 'Stock',
  transactions: 'Operaciones',
  purchase_orders: 'Órdenes de Compra',
  purchase_order_items: 'Items OC',
  inventory_adjustments: 'Ajustes',
  profiles: 'Usuarios',
  role_permissions: 'Permisos',
  notification_subscribers: 'Notificaciones',
};

const ACTION_LABEL: Record<AuditAction, string> = {
  INSERT: 'CREÓ',
  UPDATE: 'EDITÓ',
  DELETE: 'ELIMINÓ',
};

const ACTION_COLOR: Record<AuditAction, string> = {
  INSERT: 'border-green-700 text-green-700',
  UPDATE: 'border-blue-700 text-blue-700',
  DELETE: 'border-red-700 text-red-700',
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

function summarize(entry: AuditLogEntry): string {
  const row = entry.newData ?? entry.oldData ?? {};
  const name = (row.name as string) || (row.username as string) || (row.code as string) || (row.reference as string);
  if (name) return name;
  if (entry.tableName === 'stock_levels' && entry.newData) {
    const qty = entry.newData.quantity;
    const prev = entry.oldData?.quantity;
    if (prev !== undefined) return `cantidad ${prev} → ${qty}`;
    return `cantidad ${qty}`;
  }
  if (entry.tableName === 'transactions' && entry.newData) {
    const t = entry.newData;
    return `${t.type} · ${t.quantity}u · ${t.reference}`;
  }
  if (entry.tableName === 'inventory_adjustments' && entry.newData) {
    const a = entry.newData;
    return `${a.previous_quantity} → ${a.new_quantity} (${a.reason})`;
  }
  return entry.recordId?.slice(0, 8) ?? '—';
}

function changedFields(entry: AuditLogEntry): Array<{ key: string; from: unknown; to: unknown }> {
  if (entry.action !== 'UPDATE' || !entry.oldData || !entry.newData) return [];
  const keys = new Set([...Object.keys(entry.oldData), ...Object.keys(entry.newData)]);
  const out: Array<{ key: string; from: unknown; to: unknown }> = [];
  for (const k of keys) {
    if (k === 'updated_at' || k === 'created_at') continue;
    const before = entry.oldData[k];
    const after = entry.newData[k];
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      out.push({ key: k, from: before, to: after });
    }
  }
  return out;
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'string' && v.length > 80) return v.slice(0, 80) + '…';
  if (typeof v === 'object') return JSON.stringify(v).slice(0, 120);
  return String(v);
}

const exportCSV = (rows: AuditLogEntry[]) => {
  const headers = ['FECHA', 'USUARIO', 'ACCION', 'TABLA', 'REGISTRO', 'MARCA', 'DETALLE'];
  const lines = rows.map(r => [
    format(new Date(r.occurredAt), 'dd/MM/yyyy HH:mm:ss'),
    r.userName ?? '—',
    ACTION_LABEL[r.action],
    TABLE_LABEL[r.tableName] ?? r.tableName,
    r.recordId ?? '—',
    r.brand ?? '—',
    summarize(r),
  ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
  const csv = [headers.join(','), ...lines].join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `auditoria_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

// ─── Page ──────────────────────────────────────────────────────────────────────

export const OperationHistory: React.FC = () => {
  const { auditLog, refreshAuditLog, currentUser } = useAppContext();
  const [filterTable, setFilterTable] = useState<string>('ALL');
  const [filterAction, setFilterAction] = useState<'ALL' | AuditAction>('ALL');
  const [filterBrand, setFilterBrand] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  if (currentUser.role !== 'ADMIN_GENERAL') {
    return (
      <div className="flex flex-col gap-6 h-full relative">
        <ModuleInfo number="14" title="Historial General" description="Registro completo de todas las acciones del sistema." />
        <div className="text-center font-mono text-xs opacity-50 py-16 uppercase tracking-widest border border-[#141414]/20 bg-white/30">
          Solo ADMIN_GENERAL puede ver el historial completo.
        </div>
      </div>
    );
  }

  const tables = useMemo(() => {
    const set = new Set<string>();
    for (const e of auditLog) set.add(e.tableName);
    return Array.from(set).sort();
  }, [auditLog]);

  const brands = useMemo(() => {
    const set = new Set<string>();
    for (const e of auditLog) if (e.brand) set.add(e.brand);
    return Array.from(set).sort();
  }, [auditLog]);

  const filtered = useMemo(() => auditLog.filter(e => {
    if (filterTable !== 'ALL' && e.tableName !== filterTable) return false;
    if (filterAction !== 'ALL' && e.action !== filterAction) return false;
    if (filterBrand !== 'ALL' && e.brand !== filterBrand) return false;
    if (dateFrom || dateTo) {
      const d = new Date(e.occurredAt);
      if (dateFrom && d < startOfDay(parseISO(dateFrom))) return false;
      if (dateTo && d > endOfDay(parseISO(dateTo))) return false;
    }
    if (search) {
      const q = search.toLowerCase();
      const haystack = [
        e.userName, e.recordId, e.brand, TABLE_LABEL[e.tableName] ?? e.tableName,
        summarize(e),
        JSON.stringify(e.newData ?? {}),
        JSON.stringify(e.oldData ?? {}),
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(q);
    }
    return true;
  }), [auditLog, filterTable, filterAction, filterBrand, search, dateFrom, dateTo]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try { await refreshAuditLog(); } finally { setRefreshing(false); }
  };

  return (
    <div className="flex flex-col gap-6 h-full relative">
      <ModuleInfo number="14" title="Historial General" description="Registro auditado de todas las acciones del sistema: creaciones, ediciones, borrados y cambios de stock — qué se hizo, quién lo hizo y cuándo." />

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 border-b border-[#141414] pb-3">
        <div>
          <h2 className="font-serif italic font-bold text-xs uppercase tracking-widest text-[#141414]">14 // AUDITORÍA_SISTEMA</h2>
          <p className="font-mono text-[10px] opacity-70 uppercase tracking-wide mt-1">
            {auditLog.length} entradas cargadas · últimas 1000 acciones
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 border border-[#141414] bg-white/50 px-2">
            <span className="font-mono text-[9px] opacity-40 uppercase shrink-0">DESDE</span>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="bg-transparent py-2 text-[10px] font-mono focus:outline-none w-32 cursor-pointer" />
          </div>
          <div className="flex items-center gap-1 border border-[#141414] bg-white/50 px-2">
            <span className="font-mono text-[9px] opacity-40 uppercase shrink-0">HASTA</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="bg-transparent py-2 text-[10px] font-mono focus:outline-none w-32 cursor-pointer" />
          </div>
          {(dateFrom || dateTo) && (
            <button onClick={() => { setDateFrom(''); setDateTo(''); }}
              className="font-mono text-[9px] font-bold uppercase opacity-50 hover:opacity-100 border border-[#141414]/30 px-2 py-2">
              ✕ LIMPIAR
            </button>
          )}
          <div className="relative">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="BUSCAR..."
              className="border border-[#141414] bg-white/50 pl-3 pr-8 py-2 text-[10px] font-mono uppercase placeholder:opacity-40 focus:outline-none focus:shadow-[2px_2px_0_#141414] w-36"
            />
            <Filter size={11} className="absolute right-2.5 top-1/2 -translate-y-1/2 opacity-40" />
          </div>
          <select value={filterTable} onChange={e => setFilterTable(e.target.value)}
            className="border border-[#141414] bg-white/50 px-3 py-2 text-[10px] font-mono font-bold uppercase focus:outline-none cursor-pointer">
            <option value="ALL">TODAS LAS TABLAS</option>
            {tables.map(t => <option key={t} value={t}>{(TABLE_LABEL[t] ?? t).toUpperCase()}</option>)}
          </select>
          <select value={filterAction} onChange={e => setFilterAction(e.target.value as 'ALL' | AuditAction)}
            className="border border-[#141414] bg-white/50 px-3 py-2 text-[10px] font-mono font-bold uppercase focus:outline-none cursor-pointer">
            <option value="ALL">TODAS</option>
            <option value="INSERT">CREÓ</option>
            <option value="UPDATE">EDITÓ</option>
            <option value="DELETE">ELIMINÓ</option>
          </select>
          {brands.length > 1 && (
            <select value={filterBrand} onChange={e => setFilterBrand(e.target.value)}
              className="border border-[#141414] bg-white/50 px-3 py-2 text-[10px] font-mono font-bold uppercase focus:outline-none cursor-pointer">
              <option value="ALL">TODAS MARCAS</option>
              {brands.map(b => <option key={b} value={b}>{b.replace('_', ' ')}</option>)}
            </select>
          )}
          <button onClick={handleRefresh} disabled={refreshing}
            className="flex items-center gap-1.5 border border-[#141414] bg-white/50 px-3 py-2 text-[10px] font-bold font-mono uppercase hover:bg-white/80 disabled:opacity-50 transition-all">
            <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} /> RECARGAR
          </button>
          <button onClick={() => exportCSV(filtered)}
            className="flex items-center gap-2 bg-[#141414] text-[#E4E3E0] px-3 py-2 text-[10px] font-bold font-mono uppercase hover:shadow-[2px_2px_0_#9f9d99] transition-all shrink-0">
            <Download size={12} /> CSV ({filtered.length})
          </button>
        </div>
      </div>

      {filtered.length === 0 && (
        <div className="text-center font-mono text-xs opacity-50 py-16 uppercase tracking-widest">Sin registros</div>
      )}

      <div className="flex flex-col gap-2">
        {filtered.map(ev => {
          const isExp = expanded === ev.id;
          const changes = changedFields(ev);
          return (
            <div key={ev.id} className="border border-[#141414] bg-white/40">
              <div
                className="flex items-center justify-between gap-4 p-3 cursor-pointer"
                onClick={() => setExpanded(isExp ? null : ev.id)}
              >
                <div className="flex items-center gap-3 min-w-0 flex-wrap">
                  <span className={`font-mono text-[9px] font-bold border px-2 py-0.5 shrink-0 ${ACTION_COLOR[ev.action]}`}>
                    {ACTION_LABEL[ev.action]}
                  </span>
                  <span className="font-mono text-[9px] font-bold border px-2 py-0.5 shrink-0 border-[#141414]/30 text-[#141414]/80">
                    {(TABLE_LABEL[ev.tableName] ?? ev.tableName).toUpperCase()}
                  </span>
                  {ev.brand && (
                    <span className="font-mono text-[9px] font-bold border px-2 py-0.5 shrink-0 border-[#141414]/20 text-[#141414]/60">
                      {ev.brand.replace('_', ' ')}
                    </span>
                  )}
                  <span className="font-mono font-bold text-xs text-[#141414] truncate">{summarize(ev)}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-mono text-[10px] font-bold opacity-80">{ev.userName ?? '—'}</span>
                  <span className="font-mono text-[9px] opacity-40 hidden sm:inline">
                    {format(new Date(ev.occurredAt), 'dd MMM HH:mm', { locale: es })}
                  </span>
                  {isExp ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                </div>
              </div>

              {isExp && (
                <div className="border-t border-[#141414]/20 px-4 py-3 flex flex-col gap-2 text-[10px] font-mono bg-white/20">
                  <div className="flex flex-wrap gap-4">
                    <div><span className="opacity-50 uppercase">Fecha:</span> <span className="font-bold">{format(new Date(ev.occurredAt), 'dd MMM yyyy HH:mm:ss', { locale: es })}</span></div>
                    <div><span className="opacity-50 uppercase">Usuario:</span> <span className="font-bold">{ev.userName ?? '—'}</span></div>
                    <div><span className="opacity-50 uppercase">Tabla:</span> <span className="font-bold">{TABLE_LABEL[ev.tableName] ?? ev.tableName}</span></div>
                    <div><span className="opacity-50 uppercase">Registro:</span> <span className="font-bold">{ev.recordId?.slice(0, 8) ?? '—'}</span></div>
                    {ev.brand && <div><span className="opacity-50 uppercase">Marca:</span> <span className="font-bold">{ev.brand.replace('_', ' ')}</span></div>}
                  </div>

                  {ev.action === 'UPDATE' && changes.length > 0 && (
                    <div className="border-t border-[#141414]/15 pt-2 mt-1">
                      <div className="font-mono text-[9px] opacity-50 uppercase tracking-widest mb-1">Cambios</div>
                      <table className="w-full text-[10px]">
                        <thead>
                          <tr className="text-left opacity-50 uppercase tracking-wide">
                            <th className="py-1 pr-3 w-32">Campo</th>
                            <th className="py-1 pr-3">Antes</th>
                            <th className="py-1">Después</th>
                          </tr>
                        </thead>
                        <tbody>
                          {changes.map(c => (
                            <tr key={c.key} className="border-t border-[#141414]/10">
                              <td className="py-1 pr-3 font-bold opacity-70">{c.key}</td>
                              <td className="py-1 pr-3 text-red-700/80">{formatValue(c.from)}</td>
                              <td className="py-1 text-green-700/80">{formatValue(c.to)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {ev.action === 'INSERT' && ev.newData && (
                    <details className="border-t border-[#141414]/15 pt-2 mt-1">
                      <summary className="cursor-pointer font-mono text-[9px] opacity-50 uppercase tracking-widest">Datos creados</summary>
                      <pre className="mt-1 text-[9px] bg-white/40 border border-[#141414]/10 p-2 overflow-x-auto">{JSON.stringify(ev.newData, null, 2)}</pre>
                    </details>
                  )}

                  {ev.action === 'DELETE' && ev.oldData && (
                    <details className="border-t border-[#141414]/15 pt-2 mt-1">
                      <summary className="cursor-pointer font-mono text-[9px] opacity-50 uppercase tracking-widest">Datos eliminados</summary>
                      <pre className="mt-1 text-[9px] bg-white/40 border border-[#141414]/10 p-2 overflow-x-auto">{JSON.stringify(ev.oldData, null, 2)}</pre>
                    </details>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

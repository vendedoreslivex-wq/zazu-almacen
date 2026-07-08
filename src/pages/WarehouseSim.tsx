import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ModuleInfo } from '../components/ModuleInfo';
import {
  Play, Pause, RotateCcw, CheckCircle2, XCircle, AlertTriangle,
  ArrowRight, Clock, Package, TrendingUp, Zap, Boxes, Truck,
  ShieldAlert, ChevronRight, CircleDot
} from 'lucide-react';
import { cn } from '../lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

type ZoneId = 'supplier' | 'reception' | 'reserve' | 'dispatch' | 'client';
type OpType = 'RECEPCION' | 'A_RESERVAS' | 'REQUERIMIENTO' | 'DESPACHO';
type PacketState = 'moving' | 'arrived' | 'pending_confirm' | 'confirmed' | 'rejected';

interface Zone {
  id: ZoneId;
  label: string;
  sub: string;
  color: string;
  bg: string;
  x: number; y: number; w: number; h: number;
}

interface Packet {
  id: string;
  opType: OpType;
  from: ZoneId;
  to: ZoneId;
  progress: number;
  state: PacketState;
  ref: string;
  color: string;
  sku: string;
  qty: number;
  startedAt: number;
  duration: number;
}

interface PendingBatch {
  id: string;
  packets: Packet[];
  createdAt: number;
  expiresAt: number;
}

interface LogEntry {
  id: string;
  opType: OpType;
  from: string;
  to: string;
  ref: string;
  qty: number;
  sku: string;
  result: 'ok' | 'rejected' | 'transit';
  ts: number;
}

interface ZoneStat {
  load: number;
  processed: number;
  queued: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ZONES: Zone[] = [
  { id: 'supplier',  label: 'PROVEEDOR',     sub: 'Origen',        color: '#6b7280', bg: '#6b728014', x: 4,  y: 35, w: 14, h: 30 },
  { id: 'reception', label: 'RECEPCIÓN',     sub: 'Entrada',       color: '#16a34a', bg: '#16a34a14', x: 23, y: 35, w: 14, h: 30 },
  { id: 'reserve',   label: 'RESERVAS',      sub: 'Stock físico',  color: '#d97706', bg: '#d9770614', x: 48, y: 8,  w: 14, h: 30 },
  { id: 'dispatch',  label: 'DESPACHO',      sub: 'Lista envío',   color: '#7c3aed', bg: '#7c3aed14', x: 48, y: 62, w: 14, h: 30 },
  { id: 'client',    label: 'CLIENTE',       sub: 'Destino',       color: '#dc2626', bg: '#dc262614', x: 78, y: 35, w: 14, h: 30 },
];
const ZONE_MAP = Object.fromEntries(ZONES.map(z => [z.id, z])) as Record<ZoneId, Zone>;

const ROUTES: { opType: OpType; from: ZoneId; to: ZoneId; color: string }[] = [
  { opType: 'RECEPCION',    from: 'supplier',  to: 'reception', color: '#16a34a' },
  { opType: 'A_RESERVAS',   from: 'reception', to: 'reserve',   color: '#d97706' },
  { opType: 'REQUERIMIENTO',from: 'reserve',   to: 'dispatch',  color: '#7c3aed' },
  { opType: 'DESPACHO',     from: 'dispatch',  to: 'client',    color: '#dc2626' },
];

const LABELS: Record<OpType, string> = {
  RECEPCION: 'RECEPCIÓN', A_RESERVAS: 'A RESERVAS', REQUERIMIENTO: 'REQUERIMIENTO', DESPACHO: 'DESPACHO',
};
const COLORS: Record<OpType, string> = {
  RECEPCION: '#16a34a', A_RESERVAS: '#d97706', REQUERIMIENTO: '#7c3aed', DESPACHO: '#dc2626',
};

const SKUS = ['OSH-001', 'BRV-045', 'BXP-112', 'OSH-078', 'BRV-201', 'BXP-033', 'OSH-155', 'BRV-099'];
const PREFIXES: Record<OpType, string> = { RECEPCION: 'REC', A_RESERVAS: 'RES', REQUERIMIENTO: 'REQ', DESPACHO: 'DSP' };

let _ctr = 1000;
const genRef = (op: OpType) => `${PREFIXES[op]}-${(++_ctr).toString().padStart(6, '0')}`;
const randSku = () => SKUS[Math.floor(Math.random() * SKUS.length)];
const randQty = () => Math.floor(5 + Math.random() * 95);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

// Bezier control point for curved paths
function bezierPoint(from: Zone, to: Zone, t: number): [number, number] {
  const x1 = from.x + from.w / 2;
  const y1 = from.y + from.h / 2;
  const x2 = to.x + to.w / 2;
  const y2 = to.y + to.h / 2;
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2 - 12;
  const tt = ease(t);
  const bx = lerp(lerp(x1, mx, tt), lerp(mx, x2, tt), tt);
  const by = lerp(lerp(y1, my, tt), lerp(my, y2, tt), tt);
  return [bx, by];
}

function bezierPath(from: Zone, to: Zone): string {
  const x1 = from.x + from.w / 2;
  const y1 = from.y + from.h / 2;
  const x2 = to.x + to.w / 2;
  const y2 = to.y + to.h / 2;
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2 - 12;
  return `M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`;
}

// ─── Confirm Modal ────────────────────────────────────────────────────────────

interface ConfirmModalProps {
  batch: PendingBatch;
  timeLeft: number;
  onConfirm: (ids: string[]) => void;
  onReject: (ids: string[]) => void;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({ batch, timeLeft, onConfirm, onReject }) => {
  const [selected, setSelected] = useState<Set<string>>(new Set(batch.packets.map(p => p.id)));
  const pct = Math.max(0, (timeLeft / 30000) * 100);
  const urgent = timeLeft < 8000;

  const toggle = (id: string) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative w-full max-w-lg mx-4 border-2 flex flex-col"
        style={{ background: 'var(--bg-card)', borderColor: urgent ? '#dc2626' : '#7c3aed', maxHeight: '80vh' }}>

        {/* Header */}
        <div className="px-5 py-4 border-b flex items-start justify-between gap-3"
          style={{ borderColor: 'var(--border)', background: urgent ? '#dc262610' : '#7c3aed0a' }}>
          <div className="flex items-center gap-3">
            <ShieldAlert size={20} style={{ color: urgent ? '#dc2626' : '#7c3aed' }} className={urgent ? 'animate-pulse' : ''} />
            <div>
              <div className="font-mono font-black text-sm uppercase tracking-widest">
                Confirmar Movimientos
              </div>
              <div className="font-mono text-[9px] opacity-50 uppercase tracking-widest mt-0.5">
                LOTE {batch.id} · {batch.packets.length} OPERACIONES PENDIENTES
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <div className="font-mono font-black text-lg" style={{ color: urgent ? '#dc2626' : '#7c3aed' }}>
              {Math.ceil(timeLeft / 1000)}s
            </div>
            <div className="w-20 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
              <div className="h-full rounded-full transition-all duration-200"
                style={{ width: `${pct}%`, background: urgent ? '#dc2626' : '#7c3aed' }} />
            </div>
          </div>
        </div>

        {/* Packet list */}
        <div className="overflow-y-auto flex-1 divide-y" style={{ borderColor: 'var(--border)' }}>
          {batch.packets.map(p => {
            const sel = selected.has(p.id);
            return (
              <button
                key={p.id}
                onClick={() => toggle(p.id)}
                className="w-full flex items-center gap-3 px-5 py-3 text-left transition-all hover:bg-[var(--surface)]"
                style={{ background: sel ? `${COLORS[p.opType]}08` : undefined }}
              >
                <div className={cn(
                  'w-4 h-4 border-2 flex items-center justify-center flex-shrink-0 transition-all',
                  sel ? 'border-[var(--ink)] bg-[var(--ink)]' : 'border-[var(--border)]'
                )}>
                  {sel && <div className="w-2 h-2 bg-[var(--ink-inv)]" />}
                </div>
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: COLORS[p.opType] }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-black text-[10px]">{p.ref}</span>
                    <span className="font-mono text-[8px] px-1 text-white" style={{ background: COLORS[p.opType] }}>
                      {LABELS[p.opType]}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5 opacity-50">
                    <span className="font-mono text-[8px]">{p.sku}</span>
                    <span className="font-mono text-[8px]">·</span>
                    <span className="font-mono text-[8px]">{p.qty} UN</span>
                    <span className="font-mono text-[8px]">·</span>
                    <span className="font-mono text-[8px]">{ZONE_MAP[p.from].label}</span>
                    <ArrowRight size={8} />
                    <span className="font-mono text-[8px]">{ZONE_MAP[p.to].label}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Actions */}
        <div className="px-5 py-4 border-t flex items-center gap-3" style={{ borderColor: 'var(--border)' }}>
          <span className="font-mono text-[9px] opacity-40 flex-1">
            {selected.size} de {batch.packets.length} seleccionados
          </span>
          <button
            onClick={() => {
              const rejIds = batch.packets.filter(p => !selected.has(p.id)).map(p => p.id);
              if (rejIds.length) onReject(rejIds);
              const confIds = [...selected];
              if (confIds.length) onConfirm(confIds);
            }}
            className="flex items-center gap-2 px-5 py-2.5 font-mono text-[10px] font-black uppercase tracking-widest text-white transition-all"
            style={{ background: '#16a34a' }}
          >
            <CheckCircle2 size={13} /> CONFIRMAR
          </button>
          <button
            onClick={() => onReject(batch.packets.map(p => p.id))}
            className="flex items-center gap-2 px-4 py-2.5 font-mono text-[10px] font-bold uppercase tracking-widest text-white transition-all"
            style={{ background: '#dc2626' }}
          >
            <XCircle size={13} /> RECHAZAR TODO
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Zone Box ─────────────────────────────────────────────────────────────────

interface ZoneBoxProps {
  zone: Zone;
  stat: ZoneStat;
  hasActive: boolean;
}

const ZoneBox: React.FC<ZoneBoxProps> = ({ zone, stat, hasActive }) => (
  <div
    className="absolute border-2 flex flex-col justify-between p-1.5 overflow-hidden"
    style={{
      left: `${zone.x}%`, top: `${zone.y}%`,
      width: `${zone.w}%`, height: `${zone.h}%`,
      borderColor: zone.color,
      background: zone.bg,
    }}
  >
    {/* Load bar */}
    <div className="absolute inset-x-0 bottom-0 h-1" style={{ background: `${zone.color}22` }}>
      <div
        className="h-full transition-all duration-700"
        style={{ width: `${stat.load}%`, background: zone.color, opacity: 0.7 }}
      />
    </div>

    <div className="flex flex-col gap-0.5">
      <div className="flex items-center justify-between">
        <span className="font-mono font-black uppercase tracking-wider leading-none"
          style={{ fontSize: 7, color: zone.color }}>
          {zone.label}
        </span>
        {hasActive && (
          <CircleDot size={6} style={{ color: zone.color }} className="animate-pulse" />
        )}
      </div>
      <span className="font-mono uppercase leading-none opacity-40" style={{ fontSize: 6 }}>
        {zone.sub}
      </span>
    </div>

    <div className="flex items-end justify-between">
      <span className="font-mono font-black leading-none" style={{ fontSize: 9, color: zone.color }}>
        {Math.round(stat.load)}%
      </span>
      {stat.queued > 0 && (
        <span className="font-mono leading-none px-0.5 text-white" style={{ fontSize: 6, background: zone.color }}>
          {stat.queued}q
        </span>
      )}
    </div>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

export const WarehouseSim: React.FC = () => {
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [packets, setPackets] = useState<Packet[]>([]);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [stats, setStats] = useState<Record<ZoneId, ZoneStat>>({
    supplier:  { load: 0, processed: 0, queued: 0 },
    reception: { load: 0, processed: 0, queued: 0 },
    reserve:   { load: 0, processed: 0, queued: 0 },
    dispatch:  { load: 0, processed: 0, queued: 0 },
    client:    { load: 0, processed: 0, queued: 0 },
  });
  const [pendingBatch, setPendingBatch] = useState<PendingBatch | null>(null);
  const [batchTimeLeft, setBatchTimeLeft] = useState(0);
  const [totalOps, setTotalOps] = useState(0);
  const [confirmed, setConfirmed] = useState(0);
  const [rejected, setRejected] = useState(0);
  const [efficiency, setEfficiency] = useState(100);
  const [alerts, setAlerts] = useState<string[]>([]);

  const rafRef = useRef<number>(0);
  const lastTickRef = useRef<number>(0);
  const spawnTimerRef = useRef<number>(0);
  const batchTimerRef = useRef<number>(0);
  const batchIdRef = useRef(1);
  const batchBufferRef = useRef<Packet[]>([]);
  const CONFIRM_INTERVAL = 120_000; // 2 minutes
  const CONFIRM_WINDOW = 30_000;    // 30s to confirm

  const addLog = useCallback((entry: Omit<LogEntry, 'id' | 'ts'>) => {
    setLog(prev => [{ ...entry, id: crypto.randomUUID(), ts: Date.now() }, ...prev.slice(0, 59)]);
  }, []);

  const spawnPacket = useCallback(() => {
    const route = ROUTES[Math.floor(Math.random() * ROUTES.length)];
    const baseDur = (3000 + Math.random() * 2000) / speed;
    const packet: Packet = {
      id: crypto.randomUUID(),
      opType: route.opType,
      from: route.from,
      to: route.to,
      progress: 0,
      state: 'moving',
      ref: genRef(route.opType),
      color: route.color,
      sku: randSku(),
      qty: randQty(),
      startedAt: performance.now(),
      duration: baseDur,
    };
    setPackets(prev => [...prev.slice(-25), packet]);
    batchBufferRef.current = [...batchBufferRef.current, packet];
    setStats(prev => ({
      ...prev,
      [route.from]: { ...prev[route.from], queued: prev[route.from].queued + 1 },
    }));
    setTotalOps(n => n + 1);
    addLog({ opType: route.opType, from: ZONE_MAP[route.from].label, to: ZONE_MAP[route.to].label, ref: packet.ref, qty: packet.qty, sku: packet.sku, result: 'transit' });
  }, [speed, addLog]);

  const triggerBatch = useCallback(() => {
    const buf = batchBufferRef.current;
    if (buf.length === 0) return;
    const batch: PendingBatch = {
      id: `LOTE-${String(batchIdRef.current++).padStart(3, '0')}`,
      packets: buf.slice(),
      createdAt: Date.now(),
      expiresAt: Date.now() + CONFIRM_WINDOW,
    };
    batchBufferRef.current = [];
    setPendingBatch(batch);
    setBatchTimeLeft(CONFIRM_WINDOW);
    setAlerts(prev => [`⚠ ${batch.id}: ${buf.length} movimientos esperan confirmación`, ...prev.slice(0, 4)]);
  }, []);

  const handleConfirm = useCallback((ids: Set<string>) => {
    setPendingBatch(null);
    setConfirmed(n => n + ids.size);
    setPackets(prev => prev.map(p => ids.has(p.id) ? { ...p, state: 'confirmed' } : p));
    ids.forEach(() => {
      setStats(prev => {
        const next = { ...prev };
        for (const k of Object.keys(next) as ZoneId[]) {
          next[k] = { ...next[k], load: Math.min(100, next[k].load + 8 + Math.random() * 10) };
        }
        return next;
      });
    });
    setAlerts(prev => [`✓ ${ids.size} movimientos confirmados`, ...prev.slice(0, 4)]);
  }, []);

  const handleReject = useCallback((ids: Set<string>) => {
    setRejected(n => n + ids.size);
    setPackets(prev => prev.map(p => ids.has(p.id) ? { ...p, state: 'rejected' } : p));
    setAlerts(prev => [`✗ ${ids.size} movimientos rechazados`, ...prev.slice(0, 4)]);
  }, []);

  const handleBatchAction = useCallback((confirmIds: string[], rejectIds: string[]) => {
    const confSet = new Set(confirmIds);
    const rejSet = new Set(rejectIds);
    if (confSet.size) handleConfirm(confSet);
    if (rejSet.size) handleReject(rejSet);
    setPendingBatch(null);
  }, [handleConfirm, handleReject]);

  // Auto-reject batch on timeout
  useEffect(() => {
    if (!pendingBatch) return;
    const int = setInterval(() => {
      setBatchTimeLeft(prev => {
        const next = prev - 200;
        if (next <= 0) {
          handleReject(new Set(pendingBatch.packets.map(p => p.id)));
          setPendingBatch(null);
          return 0;
        }
        return next;
      });
    }, 200);
    return () => clearInterval(int);
  }, [pendingBatch, handleReject]);

  // Update efficiency
  useEffect(() => {
    const total = confirmed + rejected;
    setEfficiency(total === 0 ? 100 : Math.round((confirmed / total) * 100));
  }, [confirmed, rejected]);

  const tick = useCallback((now: number) => {
    const dt = now - lastTickRef.current;
    lastTickRef.current = now;

    // Spawn packets
    spawnTimerRef.current += dt;
    const spawnInterval = 2800 / speed;
    while (spawnTimerRef.current >= spawnInterval) {
      spawnTimerRef.current -= spawnInterval;
      spawnPacket();
    }

    // Batch timer
    if (!pendingBatch) {
      batchTimerRef.current += dt;
      if (batchTimerRef.current >= CONFIRM_INTERVAL / speed) {
        batchTimerRef.current = 0;
        triggerBatch();
      }
    }

    // Advance packets
    setPackets(prev =>
      prev.map(p => {
        if (p.state !== 'moving') return p;
        const elapsed = now - p.startedAt;
        const progress = Math.min(1, elapsed / p.duration);
        const arrived = progress >= 1;
        if (arrived && p.state === 'moving') {
          setStats(z => ({
            ...z,
            [p.to]: {
              ...z[p.to],
              load: Math.min(100, z[p.to].load + 5 + Math.random() * 8),
              processed: z[p.to].processed + 1,
              queued: Math.max(0, z[p.to].queued - 1),
            },
            [p.from]: {
              ...z[p.from],
              queued: Math.max(0, z[p.from].queued - 1),
            },
          }));
        }
        return { ...p, progress, state: arrived ? 'arrived' : 'moving' };
      }).filter(p => p.state === 'moving' || p.state === 'pending_confirm')
    );

    // Decay zone load
    setStats(prev => {
      const next = { ...prev } as Record<ZoneId, ZoneStat>;
      for (const k of Object.keys(next) as ZoneId[]) {
        next[k] = { ...next[k], load: Math.max(0, next[k].load - dt * 0.002) };
      }
      return next;
    });

    rafRef.current = requestAnimationFrame(tick);
  }, [spawnPacket, triggerBatch, speed, pendingBatch]);

  useEffect(() => {
    if (running) {
      lastTickRef.current = performance.now();
      rafRef.current = requestAnimationFrame(tick);
    } else {
      cancelAnimationFrame(rafRef.current);
    }
    return () => cancelAnimationFrame(rafRef.current);
  }, [running, tick]);

  const reset = () => {
    setRunning(false);
    cancelAnimationFrame(rafRef.current);
    setPackets([]);
    setLog([]);
    setPendingBatch(null);
    setTotalOps(0);
    setConfirmed(0);
    setRejected(0);
    setEfficiency(100);
    setAlerts([]);
    batchBufferRef.current = [];
    spawnTimerRef.current = 0;
    batchTimerRef.current = 0;
    batchIdRef.current = 1;
    _ctr = 1000;
    setStats({
      supplier:  { load: 0, processed: 0, queued: 0 },
      reception: { load: 0, processed: 0, queued: 0 },
      reserve:   { load: 0, processed: 0, queued: 0 },
      dispatch:  { load: 0, processed: 0, queued: 0 },
      client:    { load: 0, processed: 0, queued: 0 },
    });
  };

  const inTransit = packets.filter(p => p.state === 'moving').length;
  const nextBatchIn = running && !pendingBatch
    ? Math.max(0, Math.ceil(((CONFIRM_INTERVAL / speed) - batchTimerRef.current) / 1000))
    : null;

  return (
    <>
      {/* Confirm Modal */}
      {pendingBatch && (
        <ConfirmModal
          batch={pendingBatch}
          timeLeft={batchTimeLeft}
          onConfirm={(ids) => handleBatchAction(ids, pendingBatch.packets.filter(p => !ids.includes(p.id)).map(p => p.id))}
          onReject={(ids) => handleBatchAction([], ids)}
        />
      )}

      <div className="max-w-6xl mx-auto flex flex-col gap-5 pb-12">
        <ModuleInfo number="SIM" title="Simulación de Carga" description="Centro de control de operaciones con confirmación de movimientos en tiempo real." />

        {/* KPI Row */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {[
            { icon: <Zap size={13} />, label: 'OPS TOTALES', value: totalOps, color: 'var(--ink)' },
            { icon: <Package size={13} />, label: 'EN TRÁNSITO', value: inTransit, color: inTransit > 10 ? '#d97706' : 'var(--ink)' },
            { icon: <CheckCircle2 size={13} />, label: 'CONFIRMADOS', value: confirmed, color: '#16a34a' },
            { icon: <XCircle size={13} />, label: 'RECHAZADOS', value: rejected, color: '#dc2626' },
            { icon: <TrendingUp size={13} />, label: 'EFICIENCIA', value: `${efficiency}%`, color: efficiency >= 80 ? '#16a34a' : efficiency >= 50 ? '#d97706' : '#dc2626' },
          ].map(k => (
            <div key={k.label} className="border border-[var(--border)] bg-[var(--bg-card)] p-3 flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5 opacity-40 font-mono text-[8px] uppercase tracking-widest font-bold">
                {k.icon}{k.label}
              </div>
              <div className="font-mono font-black text-xl tracking-tight" style={{ color: k.color }}>
                {k.value}
              </div>
            </div>
          ))}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3 flex-wrap border border-[var(--border)] bg-[var(--bg-card)] px-4 py-3">
          <button
            onClick={() => setRunning(r => !r)}
            className={cn(
              'flex items-center gap-2 px-5 py-2 font-mono text-[10px] font-black uppercase tracking-widest border-2 transition-all',
              running
                ? 'bg-[var(--ink)] text-[var(--ink-inv)] border-[var(--ink)]'
                : 'border-[var(--border)] hover:bg-[var(--ink)] hover:text-[var(--ink-inv)] hover:border-[var(--ink)]'
            )}
          >
            {running ? <Pause size={12} /> : <Play size={12} />}
            {running ? 'PAUSAR' : 'INICIAR'}
          </button>
          <button
            onClick={reset}
            className="flex items-center gap-2 px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-widest border border-[var(--border)] opacity-50 hover:opacity-100 transition-all"
          >
            <RotateCcw size={12} /> RESET
          </button>

          <div className="flex items-center gap-1.5 ml-2">
            <span className="font-mono text-[8px] opacity-40 uppercase tracking-widest font-bold">VELOCIDAD</span>
            {[0.5, 1, 2, 3].map(s => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={cn(
                  'px-2.5 py-1.5 font-mono text-[9px] font-bold border transition-all',
                  speed === s ? 'bg-[var(--ink)] text-[var(--ink-inv)] border-[var(--ink)]' : 'border-[var(--border)] opacity-40 hover:opacity-100'
                )}
              >
                {s}×
              </button>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-2">
            {nextBatchIn !== null && (
              <div className="flex items-center gap-1.5 border border-[var(--border)] px-3 py-1.5">
                <Clock size={10} className="opacity-40" />
                <span className="font-mono text-[9px] opacity-60 uppercase tracking-widest">Próx. confirmación</span>
                <span className="font-mono font-black text-[11px]" style={{ color: nextBatchIn < 15 ? '#d97706' : 'var(--ink)' }}>
                  {nextBatchIn}s
                </span>
              </div>
            )}
            {pendingBatch && (
              <div className="flex items-center gap-1.5 border-2 border-[#dc2626] px-3 py-1.5 animate-pulse">
                <AlertTriangle size={10} style={{ color: '#dc2626' }} />
                <span className="font-mono text-[9px] font-bold uppercase tracking-widest" style={{ color: '#dc2626' }}>
                  CONFIRMACIÓN PENDIENTE
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Map + Side panels */}
        <div className="flex gap-4">
          {/* SVG Map */}
          <div className="flex-1 border-2 border-[var(--border)] bg-[var(--bg-card)] relative overflow-hidden" style={{ height: 380 }}>
            <div className="absolute top-2 left-3 font-mono text-[7px] opacity-20 uppercase tracking-[0.3em] font-bold">
              MAPA DE FLUJO · ALMACÉN CENTRAL
            </div>

            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              <defs>
                {ROUTES.map((r, i) => (
                  <marker key={i} id={`arrow-${i}`} markerWidth="4" markerHeight="4" refX="3" refY="2" orient="auto">
                    <polygon points="0 0, 4 2, 0 4" fill={r.color} fillOpacity="0.4" />
                  </marker>
                ))}
              </defs>

              {/* Static route paths */}
              {ROUTES.map((r, i) => (
                <path
                  key={i}
                  d={bezierPath(ZONE_MAP[r.from], ZONE_MAP[r.to])}
                  fill="none"
                  stroke={r.color}
                  strokeWidth="0.4"
                  strokeOpacity="0.2"
                  strokeDasharray="2 1.5"
                  markerEnd={`url(#arrow-${i})`}
                />
              ))}

              {/* Moving packets */}
              {packets.filter(p => p.state === 'moving').map(p => {
                const from = ZONE_MAP[p.from];
                const to = ZONE_MAP[p.to];
                const [cx, cy] = bezierPoint(from, to, p.progress);
                const fade = p.progress < 0.08 ? p.progress / 0.08 : p.progress > 0.92 ? (1 - p.progress) / 0.08 : 1;
                return (
                  <g key={p.id} opacity={fade}>
                    {/* Glow ring */}
                    <circle cx={cx} cy={cy} r="2.8" fill={p.color} fillOpacity="0.12" />
                    {/* Core */}
                    <circle cx={cx} cy={cy} r="1.4" fill={p.color} />
                    {/* Inner */}
                    <circle cx={cx} cy={cy} r="0.6" fill="white" fillOpacity="0.6" />
                  </g>
                );
              })}
            </svg>

            {/* Zone boxes */}
            {ZONES.map(z => (
              <ZoneBox
                key={z.id}
                zone={z}
                stat={stats[z.id]}
                hasActive={packets.some(p => p.state === 'moving' && (p.from === z.id || p.to === z.id))}
              />
            ))}

            {/* Legend */}
            <div className="absolute bottom-2 right-3 flex flex-col gap-1.5 p-2 border border-[var(--border)]/30"
              style={{ background: 'var(--bg-card)', opacity: 0.9 }}>
              {ROUTES.map((r, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-4 h-px" style={{ background: r.color, opacity: 0.7 }} />
                  <span className="font-mono uppercase tracking-widest" style={{ fontSize: 6, color: r.color }}>
                    {LABELS[r.opType]}
                  </span>
                </div>
              ))}
            </div>

            {/* Paused / idle overlay */}
            {!running && packets.length === 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 opacity-20">
                <Boxes size={40} />
                <span className="font-mono text-[10px] uppercase tracking-[0.3em] font-bold">
                  Presiona INICIAR
                </span>
              </div>
            )}
          </div>

          {/* Alerts panel */}
          <div className="w-52 flex flex-col gap-2">
            <div className="border border-[var(--border)] bg-[var(--bg-card)] flex flex-col overflow-hidden flex-1">
              <div className="px-3 py-2 border-b border-[var(--border)] flex items-center gap-2">
                <AlertTriangle size={11} className="opacity-50" />
                <span className="font-mono text-[8px] font-bold uppercase tracking-widest opacity-50">ALERTAS</span>
              </div>
              <div className="flex-1 overflow-y-auto">
                {alerts.length === 0 ? (
                  <div className="px-3 py-4 font-mono text-[8px] opacity-20 uppercase text-center">Sin alertas</div>
                ) : (
                  alerts.map((a, i) => (
                    <div key={i}
                      className="px-3 py-2 border-b border-[var(--border)]/20 font-mono text-[8px] leading-tight"
                      style={{ opacity: 1 - i * 0.18 }}>
                      {a}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Zone throughput */}
            <div className="border border-[var(--border)] bg-[var(--bg-card)] p-3 flex flex-col gap-2">
              <span className="font-mono text-[8px] font-bold uppercase tracking-widest opacity-40 flex items-center gap-1.5">
                <Truck size={10} /> THROUGHPUT
              </span>
              {ZONES.map(z => (
                <div key={z.id} className="flex items-center gap-2">
                  <span className="font-mono text-[7px] uppercase tracking-widest opacity-50 w-14 truncate">{z.label}</span>
                  <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${stats[z.id].load}%`, background: z.color }}
                    />
                  </div>
                  <span className="font-mono font-black text-[8px] w-6 text-right" style={{ color: z.color }}>
                    {stats[z.id].processed}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Operation Log */}
        <div className="border border-[var(--border)] bg-[var(--bg-card)]">
          <div className="border-b border-[var(--border)] px-4 py-2.5 flex items-center justify-between">
            <span className="font-mono text-[9px] font-bold uppercase tracking-widest opacity-50 flex items-center gap-2">
              <ChevronRight size={11} /> LOG DE OPERACIONES
            </span>
            <span className="font-mono text-[8px] opacity-30">{log.length} REGISTROS</span>
          </div>
          <div className="max-h-52 overflow-y-auto divide-y" style={{ borderColor: 'var(--border)' }}>
            {log.length === 0 ? (
              <div className="px-4 py-6 text-center font-mono text-[8px] opacity-20 uppercase tracking-widest">Sin operaciones</div>
            ) : (
              log.map((entry, i) => (
                <div
                  key={entry.id}
                  className={cn(
                    'flex items-center gap-2.5 px-4 py-2 font-mono text-[8px]',
                    i === 0 && running ? 'bg-[var(--surface)]/50' : ''
                  )}
                >
                  <div
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ background: COLORS[entry.opType] }}
                  />
                  <span
                    className="px-1.5 py-0.5 text-white shrink-0 font-bold"
                    style={{ background: COLORS[entry.opType], fontSize: 6 }}
                  >
                    {LABELS[entry.opType]}
                  </span>
                  <span className="font-black opacity-70 shrink-0">{entry.ref}</span>
                  <span className="opacity-30 shrink-0">{entry.sku}</span>
                  <span className="opacity-50 shrink-0">{entry.qty}un</span>
                  <div className="flex items-center gap-1 opacity-30 flex-1 min-w-0">
                    <span className="truncate">{entry.from}</span>
                    <ArrowRight size={8} className="shrink-0" />
                    <span className="truncate">{entry.to}</span>
                  </div>
                  <span
                    className="shrink-0 px-1.5 py-0.5 font-bold"
                    style={{
                      fontSize: 6,
                      background: entry.result === 'ok' ? '#16a34a22' : entry.result === 'rejected' ? '#dc262622' : '#6b728022',
                      color: entry.result === 'ok' ? '#16a34a' : entry.result === 'rejected' ? '#dc2626' : '#6b7280',
                    }}
                  >
                    {entry.result === 'ok' ? 'CONF' : entry.result === 'rejected' ? 'REC' : 'TRÁNSITO'}
                  </span>
                  <span className="ml-auto opacity-20 shrink-0">
                    {new Date(entry.ts).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
};

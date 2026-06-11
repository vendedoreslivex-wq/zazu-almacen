import React, { useState, useEffect, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, BookOpen } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface TutorialStep {
  title: string;
  description: string;
  illustration: React.ReactNode;
  tips?: string[];
}

interface TutorialModalProps {
  open: boolean;
  onClose: () => void;
  steps: TutorialStep[];
}

// ── Animations (injected once) ──────────────────────────────────────────────

const TUTORIAL_STYLES = `
@keyframes tutorial-modal-in {
  from { opacity: 0; transform: scale(0.94) translateY(8px); }
  to   { opacity: 1; transform: scale(1)    translateY(0);   }
}
@keyframes tutorial-slide-in-right {
  from { opacity: 0; transform: translateX(40px); }
  to   { opacity: 1; transform: translateX(0);    }
}
@keyframes tutorial-slide-in-left {
  from { opacity: 0; transform: translateX(-40px); }
  to   { opacity: 1; transform: translateX(0);     }
}
@keyframes tutorial-progress {
  from { width: 0%; }
  to   { width: 100%; }
}
@keyframes tut-float {
  0%, 100% { transform: translateY(0px); }
  50%       { transform: translateY(-6px); }
}
@keyframes tut-pulse-ring {
  0%   { transform: scale(1);   opacity: 0.6; }
  100% { transform: scale(1.5); opacity: 0;   }
}
@keyframes tut-draw {
  from { stroke-dashoffset: 300; }
  to   { stroke-dashoffset: 0;   }
}
@keyframes tut-fade-up {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0);    }
}
@keyframes tut-bounce-x {
  0%, 100% { transform: translateX(0);    }
  40%       { transform: translateX(10px); }
}
@keyframes tut-spin-slow {
  from { transform: rotate(0deg);   }
  to   { transform: rotate(360deg); }
}
@keyframes tut-sign {
  0%   { stroke-dashoffset: 200; opacity: 0; }
  20%  { opacity: 1; }
  100% { stroke-dashoffset: 0; opacity: 1; }
}
.tut-float    { animation: tut-float     3s ease-in-out infinite; }
.tut-draw     { animation: tut-draw      1.2s ease forwards; }
.tut-fade-up  { animation: tut-fade-up   0.6s ease forwards; }
.tut-bounce-x { animation: tut-bounce-x  1.4s ease-in-out infinite; }
.tut-spin     { animation: tut-spin-slow 8s linear infinite; }
.tut-sign     { animation: tut-sign      1.8s ease forwards; }
`;

let stylesInjected = false;
function injectStyles() {
  if (stylesInjected) return;
  const el = document.createElement('style');
  el.textContent = TUTORIAL_STYLES;
  document.head.appendChild(el);
  stylesInjected = true;
}

// ── SVG Illustrations ──────────────────────────────────────────────────────────

const IllustrationOverview = () => (
  <svg viewBox="0 0 200 140" className="w-full h-full" fill="none">
    {/* Warehouse background */}
    <rect x="10" y="80" width="180" height="50" rx="2" fill="var(--surface)" stroke="var(--border)" strokeWidth="1.5"/>
    {/* Roof */}
    <polyline points="5,82 100,30 195,82" stroke="var(--ink)" strokeWidth="2" fill="var(--bg-card)" strokeLinejoin="round"/>

    {/* Box green - reception */}
    <g className="tut-float" style={{animationDelay:'0s'}}>
      <rect x="20" y="88" width="28" height="28" rx="2" fill="#dcfce7" stroke="#86efac" strokeWidth="1.5"/>
      <line x1="20" y1="100" x2="48" y2="100" stroke="#86efac" strokeWidth="1"/>
      <line x1="34" y1="88" x2="34" y2="116" stroke="#86efac" strokeWidth="1"/>
      <text x="34" y="128" textAnchor="middle" fontSize="7" fill="#15803d" fontWeight="700" fontFamily="monospace">RX</text>
    </g>
    {/* Box red - dispatch */}
    <g className="tut-float" style={{animationDelay:'1s'}}>
      <rect x="86" y="88" width="28" height="28" rx="2" fill="#fee2e2" stroke="#fca5a5" strokeWidth="1.5"/>
      <line x1="86" y1="100" x2="114" y2="100" stroke="#fca5a5" strokeWidth="1"/>
      <line x1="100" y1="88" x2="100" y2="116" stroke="#fca5a5" strokeWidth="1"/>
      <text x="100" y="128" textAnchor="middle" fontSize="7" fill="#dc2626" fontWeight="700" fontFamily="monospace">TX</text>
    </g>
    {/* Box blue - transfer */}
    <g className="tut-float" style={{animationDelay:'2s'}}>
      <rect x="152" y="88" width="28" height="28" rx="2" fill="#dbeafe" stroke="#93c5fd" strokeWidth="1.5"/>
      <line x1="152" y1="100" x2="180" y2="100" stroke="#93c5fd" strokeWidth="1"/>
      <line x1="166" y1="88" x2="166" y2="116" stroke="#93c5fd" strokeWidth="1"/>
      <text x="166" y="128" textAnchor="middle" fontSize="7" fill="#1d4ed8" fontWeight="700" fontFamily="monospace">MV</text>
    </g>

    {/* Arrow down to green */}
    <path d="M34 70 L34 85" stroke="#15803d" strokeWidth="1.5" strokeDasharray="3,2" className="tut-draw"/>
    <polygon points="34,87 30,80 38,80" fill="#15803d"/>
    {/* Arrow up from red */}
    <path d="M100 85 L100 70" stroke="#dc2626" strokeWidth="1.5" strokeDasharray="3,2" className="tut-draw" style={{animationDelay:'0.3s'}}/>
    <polygon points="100,68 96,75 104,75" fill="#dc2626"/>
    {/* Arrow right on blue */}
    <path d="M178 102 L193 102" stroke="#1d4ed8" strokeWidth="1.5" strokeDasharray="3,2" className="tut-draw" style={{animationDelay:'0.6s'}}/>
    <polygon points="195,102 188,98 188,106" fill="#1d4ed8"/>
  </svg>
);

const IllustrationReception = () => (
  <svg viewBox="0 0 200 140" className="w-full h-full" fill="none">
    {/* Truck */}
    <g className="tut-bounce-x">
      <rect x="8" y="70" width="70" height="40" rx="2" fill="var(--surface)" stroke="var(--border)" strokeWidth="1.5"/>
      <rect x="58" y="60" width="30" height="50" rx="2" fill="var(--bg-card)" stroke="var(--border)" strokeWidth="1.5"/>
      <circle cx="22" cy="112" r="7" fill="var(--ink)" stroke="var(--bg)" strokeWidth="2"/>
      <circle cx="22" cy="112" r="3" fill="var(--bg-card)"/>
      <circle cx="68" cy="112" r="7" fill="var(--ink)" stroke="var(--bg)" strokeWidth="2"/>
      <circle cx="68" cy="112" r="3" fill="var(--bg-card)"/>
      {/* Boxes in truck */}
      <rect x="14" y="78" width="14" height="14" rx="1" fill="#dcfce7" stroke="#86efac" strokeWidth="1"/>
      <rect x="32" y="78" width="14" height="14" rx="1" fill="#dcfce7" stroke="#86efac" strokeWidth="1"/>
      <rect x="14" y="94" width="14" height="12" rx="1" fill="#dcfce7" stroke="#86efac" strokeWidth="1"/>
    </g>

    {/* Platform / dock */}
    <rect x="95" y="95" width="100" height="8" fill="var(--ink)" rx="1"/>

    {/* Arrow moving right (unloading) */}
    <g className="tut-bounce-x" style={{animationDelay:'0.5s'}}>
      <path d="M88 90 L115 90" stroke="#15803d" strokeWidth="2"/>
      <polygon points="117,90 110,86 110,94" fill="#15803d"/>
    </g>

    {/* Warehouse shelf */}
    <rect x="118" y="50" width="74" height="43" rx="2" fill="var(--surface)" stroke="var(--border)" strokeWidth="1.5"/>
    <line x1="118" y1="70" x2="192" y2="70" stroke="var(--border)" strokeWidth="1"/>
    {/* Boxes on shelf */}
    <g className="tut-fade-up" style={{animationDelay:'0.8s'}}>
      <rect x="124" y="74" width="14" height="14" rx="1" fill="#dcfce7" stroke="#86efac" strokeWidth="1"/>
      <rect x="142" y="74" width="14" height="14" rx="1" fill="#dcfce7" stroke="#86efac" strokeWidth="1"/>
      <rect x="160" y="74" width="14" height="14" rx="1" fill="#dcfce7" stroke="#86efac" strokeWidth="1"/>
    </g>
    <rect x="124" y="54" width="14" height="12" rx="1" fill="var(--bg-card)" stroke="var(--border)" strokeWidth="1"/>
    <rect x="142" y="54" width="14" height="12" rx="1" fill="var(--bg-card)" stroke="var(--border)" strokeWidth="1"/>

    {/* Checkmark badge */}
    <g className="tut-fade-up" style={{animationDelay:'1.2s'}}>
      <circle cx="178" cy="38" r="12" fill="#dcfce7" stroke="#86efac" strokeWidth="1.5"/>
      <polyline points="172,38 176,43 184,33" stroke="#15803d" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    </g>

    {/* Label */}
    <text x="100" y="132" textAnchor="middle" fontSize="8" fill="var(--ink)" fontWeight="700" fontFamily="monospace">ENTRADA DE MERCANCIA</text>
  </svg>
);

const IllustrationDispatch = () => (
  <svg viewBox="0 0 200 140" className="w-full h-full" fill="none">
    {/* Shelf with boxes */}
    <rect x="10" y="45" width="74" height="60" rx="2" fill="var(--surface)" stroke="var(--border)" strokeWidth="1.5"/>
    <line x1="10" y1="75" x2="84" y2="75" stroke="var(--border)" strokeWidth="1"/>
    <line x1="10" y1="95" x2="84" y2="95" stroke="var(--border)" strokeWidth="1"/>

    {/* Boxes on shelves */}
    <rect x="16" y="50" width="14" height="20" rx="1" fill="#fee2e2" stroke="#fca5a5" strokeWidth="1"/>
    <rect x="34" y="50" width="14" height="20" rx="1" fill="#fee2e2" stroke="#fca5a5" strokeWidth="1"/>
    <rect x="52" y="50" width="14" height="20" rx="1" fill="var(--bg-card)" stroke="var(--border)" strokeWidth="1"/>
    <rect x="16" y="78" width="14" height="14" rx="1" fill="var(--bg-card)" stroke="var(--border)" strokeWidth="1"/>
    <rect x="34" y="78" width="14" height="14" rx="1" fill="#fee2e2" stroke="#fca5a5" strokeWidth="1"/>

    {/* Flying box — dispatch */}
    <g className="tut-bounce-x">
      <rect x="94" y="72" width="22" height="22" rx="2" fill="#fee2e2" stroke="#fca5a5" strokeWidth="1.5"/>
      <line x1="94" y1="83" x2="116" y2="83" stroke="#fca5a5" strokeWidth="1"/>
      <line x1="105" y1="72" x2="105" y2="94" stroke="#fca5a5" strokeWidth="1"/>
      <path d="M88 83 L92 83" stroke="#dc2626" strokeWidth="2"/>
      <polygon points="90,83 83,79 83,87" fill="#dc2626"/>
    </g>

    {/* Truck waiting */}
    <g style={{opacity:1}}>
      <rect x="128" y="68" width="60" height="38" rx="2" fill="var(--bg-card)" stroke="var(--border)" strokeWidth="1.5"/>
      <rect x="118" y="76" width="20" height="30" rx="2" fill="var(--surface)" stroke="var(--border)" strokeWidth="1.5"/>
      <circle cx="134" cy="108" r="6" fill="var(--ink)" stroke="var(--bg)" strokeWidth="2"/>
      <circle cx="134" cy="108" r="2.5" fill="var(--bg-card)"/>
      <circle cx="176" cy="108" r="6" fill="var(--ink)" stroke="var(--bg)" strokeWidth="2"/>
      <circle cx="176" cy="108" r="2.5" fill="var(--bg-card)"/>
      {/* Open door indicator */}
      <line x1="128" y1="68" x2="128" y2="106" stroke="#dc2626" strokeWidth="1.5" strokeDasharray="3,2"/>
    </g>

    {/* Alert badge - stock reduction */}
    <g className="tut-fade-up" style={{animationDelay:'0.6s'}}>
      <circle cx="30" cy="32" r="12" fill="#fee2e2" stroke="#fca5a5" strokeWidth="1.5"/>
      <text x="30" y="37" textAnchor="middle" fontSize="14" fill="#dc2626" fontWeight="900">−</text>
    </g>

    <text x="100" y="132" textAnchor="middle" fontSize="8" fill="var(--ink)" fontWeight="700" fontFamily="monospace">SALIDA DE MERCANCIA</text>
  </svg>
);

const IllustrationTransfer = () => (
  <svg viewBox="0 0 200 140" className="w-full h-full" fill="none">
    {/* Location A */}
    <rect x="8" y="50" width="60" height="60" rx="2" fill="var(--surface)" stroke="var(--border)" strokeWidth="1.5"/>
    <text x="38" y="44" textAnchor="middle" fontSize="8" fill="var(--ink)" fontWeight="700" fontFamily="monospace">ORIGEN</text>
    {/* Boxes A */}
    <rect x="14" y="58" width="16" height="16" rx="1" fill="#dbeafe" stroke="#93c5fd" strokeWidth="1"/>
    <rect x="34" y="58" width="16" height="16" rx="1" fill="#dbeafe" stroke="#93c5fd" strokeWidth="1"/>
    <rect x="14" y="78" width="16" height="16" rx="1" fill="#dbeafe" stroke="#93c5fd" strokeWidth="1"/>
    <rect x="34" y="78" width="16" height="16" rx="1" fill="var(--bg-card)" stroke="var(--border)" strokeWidth="1" opacity="0.4"/>
    <rect x="14" y="98" width="16" height="8" rx="1" fill="var(--bg-card)" stroke="var(--border)" strokeWidth="1" opacity="0.4"/>

    {/* Location B */}
    <rect x="132" y="50" width="60" height="60" rx="2" fill="var(--surface)" stroke="var(--border)" strokeWidth="1.5"/>
    <text x="162" y="44" textAnchor="middle" fontSize="8" fill="var(--ink)" fontWeight="700" fontFamily="monospace">DESTINO</text>
    {/* Boxes B (arriving) */}
    <rect x="138" y="58" width="16" height="16" rx="1" fill="var(--bg-card)" stroke="var(--border)" strokeWidth="1" opacity="0.4"/>
    <rect x="158" y="58" width="16" height="16" rx="1" fill="var(--bg-card)" stroke="var(--border)" strokeWidth="1" opacity="0.4"/>
    <g className="tut-fade-up" style={{animationDelay:'0.8s'}}>
      <rect x="138" y="78" width="16" height="16" rx="1" fill="#dbeafe" stroke="#93c5fd" strokeWidth="1"/>
      <rect x="158" y="78" width="16" height="16" rx="1" fill="#dbeafe" stroke="#93c5fd" strokeWidth="1"/>
    </g>

    {/* Moving box in center */}
    <g className="tut-bounce-x">
      <rect x="83" y="68" width="20" height="20" rx="2" fill="#dbeafe" stroke="#93c5fd" strokeWidth="1.5"/>
      <line x1="83" y1="78" x2="103" y2="78" stroke="#93c5fd" strokeWidth="1"/>
      <line x1="93" y1="68" x2="93" y2="88" stroke="#93c5fd" strokeWidth="1"/>
    </g>

    {/* Arrows both ways */}
    <path d="M72 73 L80 73" stroke="#1d4ed8" strokeWidth="1.5"/>
    <polygon points="82,73 75,69 75,77" fill="#1d4ed8"/>
    <path d="M106 83 L114 83" stroke="#1d4ed8" strokeWidth="1.5"/>
    <polygon points="116,83 109,79 109,87" fill="#1d4ed8"/>

    {/* Pin icons */}
    <g className="tut-float" style={{animationDelay:'0s'}}>
      <circle cx="38" cy="120" r="5" fill="#1d4ed8" opacity="0.8"/>
      <text x="38" y="123" textAnchor="middle" fontSize="6" fill="white" fontWeight="700">A</text>
    </g>
    <g className="tut-float" style={{animationDelay:'1.5s'}}>
      <circle cx="162" cy="120" r="5" fill="#1d4ed8" opacity="0.8"/>
      <text x="162" y="123" textAnchor="middle" fontSize="6" fill="white" fontWeight="700">B</text>
    </g>

    <text x="100" y="137" textAnchor="middle" fontSize="8" fill="var(--ink)" fontWeight="700" fontFamily="monospace">TRASLADO ENTRE UBICACIONES</text>
  </svg>
);

const IllustrationSignature = () => (
  <svg viewBox="0 0 200 140" className="w-full h-full" fill="none">
    {/* Document */}
    <rect x="30" y="15" width="90" height="110" rx="2" fill="var(--bg-card)" stroke="var(--border)" strokeWidth="1.5"/>
    {/* Header bar */}
    <rect x="30" y="15" width="90" height="16" rx="2" fill="var(--ink)"/>
    <text x="75" y="27" textAnchor="middle" fontSize="7" fill="var(--ink-inv)" fontWeight="700" fontFamily="monospace">GUIA DE OPERACION</text>
    {/* Lines */}
    <line x1="40" y1="44" x2="110" y2="44" stroke="var(--border)" strokeWidth="1"/>
    <line x1="40" y1="54" x2="110" y2="54" stroke="var(--border)" strokeWidth="1"/>
    <line x1="40" y1="64" x2="90" y2="64" stroke="var(--border)" strokeWidth="1"/>
    <rect x="40" y="70" width="70" height="28" rx="1" fill="var(--surface)" stroke="var(--border)" strokeWidth="1"/>
    <text x="75" y="80" textAnchor="middle" fontSize="6" fill="var(--ink-50)" fontFamily="monospace">FIRMA</text>
    {/* Animated signature */}
    <path
      d="M46 96 C52 88 58 100 64 93 C68 88 72 97 78 92 C84 87 90 96 96 91 C100 88 104 93 106 90"
      stroke="#1d4ed8"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeDasharray="200"
      className="tut-sign"
    />
    {/* Signature underline */}
    <line x1="40" y1="100" x2="110" y2="100" stroke="var(--border)" strokeWidth="1"/>

    {/* Camera / photo icon */}
    <g className="tut-float" style={{animationDelay:'1s'}}>
      <rect x="135" y="50" width="50" height="40" rx="4" fill="var(--surface)" stroke="var(--border)" strokeWidth="1.5"/>
      <circle cx="160" cy="70" r="10" fill="var(--bg-card)" stroke="var(--border)" strokeWidth="1.5"/>
      <circle cx="160" cy="70" r="5" fill="#dbeafe" stroke="#93c5fd" strokeWidth="1"/>
      <rect x="148" y="54" width="12" height="6" rx="2" fill="var(--border)"/>
      {/* Flash */}
      <g className="tut-fade-up" style={{animationDelay:'1.5s'}}>
        <circle cx="160" cy="70" r="14" fill="white" opacity="0" style={{animation:'tut-pulse-ring 1.5s ease-out infinite'}}>
          <animate attributeName="opacity" values="0.5;0" dur="1.5s" repeatCount="indefinite"/>
          <animate attributeName="r" values="10;20" dur="1.5s" repeatCount="indefinite"/>
        </circle>
      </g>
    </g>

    {/* Checkmark bottom */}
    <g className="tut-fade-up" style={{animationDelay:'1.8s'}}>
      <rect x="38" y="105" width="74" height="14" rx="1" fill="#dcfce7" stroke="#86efac" strokeWidth="1"/>
      <polyline points="45,112 50,116 60,106" stroke="#15803d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <text x="90" y="115" textAnchor="middle" fontSize="7" fill="#15803d" fontWeight="700" fontFamily="monospace">COMPLETADO</text>
    </g>
  </svg>
);

// ── Tutorial Steps for Operations ──────────────────────────────────────────────

export const OPERATIONS_TUTORIAL_STEPS: TutorialStep[] = [
  {
    title: '¿Qué son las Operaciones?',
    description: 'El módulo de Operaciones es el corazón del almacén. Aquí registras todos los movimientos de mercancía: entradas, salidas y traslados internos. Cada operación genera una guía numerada con trazabilidad completa.',
    illustration: <IllustrationOverview />,
    tips: [
      'RX = Recepción (mercancía entra al almacén)',
      'TX = Despacho (mercancía sale del almacén)',
      'MV = Traslado (cambio de ubicación interna)',
    ],
  },
  {
    title: 'Crear una Recepción',
    description: 'Registra la entrada de productos al almacén. Selecciona los productos recibidos con sus cantidades, la ubicación de destino y el proveedor o contacto. Se genera una guía RE-XXXX automáticamente.',
    illustration: <IllustrationReception />,
    tips: [
      'Puedes escanear códigos QR para agregar productos rápidamente',
      'Verifica las cantidades contra la factura del proveedor',
      'Elige la ubicación correcta antes de confirmar',
    ],
  },
  {
    title: 'Crear un Despacho',
    description: 'Registra la salida de productos del almacén hacia un cliente o destino externo. El sistema descuenta el stock automáticamente. Si no hay suficiente stock disponible, el sistema te avisará.',
    illustration: <IllustrationDispatch />,
    tips: [
      'Verifica el stock disponible antes de despachar',
      'Adjunta una foto del despacho como evidencia',
      'La firma del receptor es obligatoria para completar',
    ],
  },
  {
    title: 'Crear un Traslado',
    description: 'Mueve productos entre ubicaciones dentro del mismo almacén sin afectar el stock total. Ideal para reorganizar el almacén o abastecer puntos de venta internos.',
    illustration: <IllustrationTransfer />,
    tips: [
      'Selecciona primero la ubicación ORIGEN y luego la DESTINO',
      'Solo puedes trasladar hasta el stock disponible en origen',
      'El traslado actualiza ambas ubicaciones simultáneamente',
    ],
  },
  {
    title: 'Firmas y Evidencia Fotográfica',
    description: 'Cada operación puede incluir una firma digital del operador o receptor, y una foto de evidencia. Esto garantiza trazabilidad completa y protege ante cualquier disputa o auditoría.',
    illustration: <IllustrationSignature />,
    tips: [
      'La firma se captura directamente en pantalla con el dedo o mouse',
      'Las fotos se comprimen automáticamente para optimizar almacenamiento',
      'Puedes imprimir la guía en PDF al finalizar la operación',
    ],
  },
];

// ── TutorialModal Component ────────────────────────────────────────────────────

export const TutorialModal: React.FC<TutorialModalProps> = ({ open, onClose, steps }) => {
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState<'right' | 'left'>('right');
  const [animKey, setAnimKey] = useState(0);

  useEffect(() => { injectStyles(); }, []);

  useEffect(() => {
    if (!open) { setCurrent(0); }
  }, [open]);

  const goTo = useCallback((index: number) => {
    if (index < 0 || index >= steps.length) return;
    setDirection(index > current ? 'right' : 'left');
    setAnimKey(k => k + 1);
    setCurrent(index);
  }, [current, steps.length]);

  useEffect(() => {
    if (!open) return;
    const handle = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') goTo(current + 1);
      else if (e.key === 'ArrowLeft') goTo(current - 1);
      else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [open, current, goTo, onClose]);

  if (!open) return null;

  const step = steps[current];
  const progressPct = ((current + 1) / steps.length) * 100;
  const slideAnim = direction === 'right' ? 'tutorial-slide-in-right' : 'tutorial-slide-in-left';

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg flex flex-col overflow-hidden"
        style={{
          background: 'var(--bg-card)',
          border: '2px solid var(--border)',
          boxShadow: '8px 8px 0 var(--border)',
          animation: 'tutorial-modal-in 0.25s ease both',
          maxHeight: '90vh',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Top accent + progress bar */}
        <div className="h-1 w-full" style={{ background: 'var(--surface)' }}>
          <div
            className="h-full"
            style={{
              width: `${progressPct}%`,
              background: 'var(--ink)',
              transition: 'width 0.4s cubic-bezier(0.4,0,0.2,1)',
            }}
          />
        </div>

        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-3 border-b"
          style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
        >
          <div className="flex items-center gap-2">
            <BookOpen size={14} style={{ color: 'var(--ink)' }} />
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: 'var(--ink)' }}>
              Tutorial · Operaciones
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-[9px] font-bold" style={{ color: 'var(--ink-50)' }}>
              {current + 1} / {steps.length}
            </span>
            <button
              onClick={onClose}
              className="p-1 hover:opacity-70 transition-opacity"
              style={{ color: 'var(--ink)' }}
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Content — animated */}
        <div className="overflow-y-auto flex-1">
          <div
            key={animKey}
            style={{ animation: `${slideAnim} 0.3s ease both` }}
          >
            {/* Illustration */}
            <div
              className="w-full flex items-center justify-center px-6 pt-6 pb-2"
              style={{ height: '180px' }}
            >
              {step.illustration}
            </div>

            {/* Text */}
            <div className="px-6 pb-4">
              <h2
                className="font-mono font-black text-[15px] uppercase tracking-wider mb-3"
                style={{ color: 'var(--ink)' }}
              >
                {step.title}
              </h2>
              <p
                className="font-mono text-[11px] leading-relaxed mb-4"
                style={{ color: 'var(--ink-50)' }}
              >
                {step.description}
              </p>

              {/* Tips */}
              {step.tips && step.tips.length > 0 && (
                <div
                  className="flex flex-col gap-1.5 p-3"
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <span
                    className="font-mono text-[8px] font-bold uppercase tracking-[0.2em] mb-1"
                    style={{ color: 'var(--ink-50)' }}
                  >
                    Consejos
                  </span>
                  {step.tips.map((tip, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span
                        className="font-mono text-[10px] font-bold shrink-0 mt-[1px]"
                        style={{ color: 'var(--ink)' }}
                      >
                        →
                      </span>
                      <span
                        className="font-mono text-[10px] leading-snug"
                        style={{ color: 'var(--ink)' }}
                      >
                        {tip}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer navigation */}
        <div
          className="px-5 py-3 flex items-center justify-between border-t"
          style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
        >
          {/* Step dots */}
          <div className="flex items-center gap-1.5">
            {steps.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                className="transition-all duration-300"
                style={{
                  width: i === current ? '20px' : '6px',
                  height: '6px',
                  borderRadius: '3px',
                  background: i === current ? 'var(--ink)' : 'var(--border)',
                }}
              />
            ))}
          </div>

          {/* Prev / Next */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => goTo(current - 1)}
              disabled={current === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider border transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-70"
              style={{
                borderColor: 'var(--border)',
                color: 'var(--ink)',
                background: 'var(--bg-card)',
              }}
            >
              <ChevronLeft size={12} />
              Anterior
            </button>

            {current < steps.length - 1 ? (
              <button
                onClick={() => goTo(current + 1)}
                className="flex items-center gap-1.5 px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider border transition-all duration-150 hover:opacity-80"
                style={{
                  borderColor: 'var(--border)',
                  color: 'var(--ink-inv)',
                  background: 'var(--ink)',
                }}
              >
                Siguiente
                <ChevronRight size={12} />
              </button>
            ) : (
              <button
                onClick={onClose}
                className="flex items-center gap-1.5 px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider border transition-all duration-150 hover:opacity-80"
                style={{
                  borderColor: 'var(--border)',
                  color: 'var(--ink-inv)',
                  background: 'var(--ink)',
                }}
              >
                ¡Entendido!
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

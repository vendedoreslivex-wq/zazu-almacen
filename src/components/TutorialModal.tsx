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
  title?: string;
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

// ── SVG Illustrations · Órdenes OC ──────────────────────────────────────────────

const IllustrationPOOverview = () => (
  <svg viewBox="0 0 200 140" className="w-full h-full" fill="none">
    {/* Left card: OC */}
    <g className="tut-fade-up">
      <rect x="10" y="30" width="80" height="80" rx="2" fill="var(--surface)" stroke="var(--border)" strokeWidth="1.5"/>
      <rect x="10" y="30" width="80" height="18" rx="2" fill="#dbeafe"/>
      <text x="50" y="42" textAnchor="middle" fontSize="7" fill="#1d4ed8" fontWeight="700" fontFamily="monospace">ORDEN OC</text>
      <line x1="18" y1="58" x2="82" y2="58" stroke="var(--border)" strokeWidth="1"/>
      <line x1="18" y1="68" x2="70" y2="68" stroke="var(--border)" strokeWidth="1"/>
      <text x="18" y="82" fontSize="6" fill="var(--ink-50)" fontFamily="monospace">PROVEEDOR</text>
      <text x="18" y="94" fontSize="6" fill="var(--ink-50)" fontFamily="monospace">COSTO UNIT.</text>
      <g className="tut-float" style={{animationDelay:'0.4s'}}>
        <circle cx="70" cy="20" r="10" fill="#dbeafe" stroke="#93c5fd" strokeWidth="1.5"/>
        <path d="M65 20 h10 M70 15 v10" stroke="#1d4ed8" strokeWidth="1.5"/>
      </g>
    </g>

    {/* Right card: REQUIREMENT */}
    <g className="tut-fade-up" style={{animationDelay:'0.2s'}}>
      <rect x="110" y="30" width="80" height="80" rx="2" fill="var(--surface)" stroke="var(--border)" strokeWidth="1.5"/>
      <rect x="110" y="30" width="80" height="18" rx="2" fill="#dcfce7"/>
      <text x="150" y="42" textAnchor="middle" fontSize="6.5" fill="#15803d" fontWeight="700" fontFamily="monospace">REQUERIMIENTO</text>
      <line x1="118" y1="58" x2="182" y2="58" stroke="var(--border)" strokeWidth="1"/>
      <line x1="118" y1="68" x2="170" y2="68" stroke="var(--border)" strokeWidth="1"/>
      <text x="118" y="82" fontSize="6" fill="var(--ink-50)" fontFamily="monospace">RESERVA → DESP.</text>
      <text x="118" y="94" fontSize="6" fill="var(--ink-50)" fontFamily="monospace">SIN COSTO</text>
      <g className="tut-float" style={{animationDelay:'0.9s'}}>
        <circle cx="170" cy="20" r="10" fill="#dcfce7" stroke="#86efac" strokeWidth="1.5"/>
        <path d="M165 20 h10 M170 15 v10" stroke="#15803d" strokeWidth="1.5"/>
      </g>
    </g>

    <text x="100" y="132" textAnchor="middle" fontSize="7.5" fill="var(--ink)" fontWeight="700" fontFamily="monospace">DOS TIPOS DE ORDEN</text>
  </svg>
);

const IllustrationRequirement = () => (
  <svg viewBox="0 0 200 140" className="w-full h-full" fill="none">
    {/* Reserve location */}
    <rect x="8" y="45" width="70" height="55" rx="2" fill="var(--surface)" stroke="var(--border)" strokeWidth="1.5"/>
    <text x="43" y="39" textAnchor="middle" fontSize="7" fill="var(--ink)" fontWeight="700" fontFamily="monospace">RESERVA</text>
    <rect x="15" y="53" width="16" height="16" rx="1" fill="#dcfce7" stroke="#86efac" strokeWidth="1"/>
    <rect x="35" y="53" width="16" height="16" rx="1" fill="#dcfce7" stroke="#86efac" strokeWidth="1"/>
    <rect x="55" y="53" width="16" height="16" rx="1" fill="var(--bg-card)" stroke="var(--border)" strokeWidth="1" opacity="0.4"/>
    <rect x="15" y="73" width="16" height="16" rx="1" fill="var(--bg-card)" stroke="var(--border)" strokeWidth="1" opacity="0.4"/>

    {/* Cascading selector card */}
    <g className="tut-fade-up" style={{animationDelay:'0.3s'}}>
      <rect x="70" y="8" width="60" height="30" rx="2" fill="var(--bg-card)" stroke="var(--border)" strokeWidth="1.5"/>
      <text x="100" y="18" textAnchor="middle" fontSize="5.5" fill="var(--ink-50)" fontFamily="monospace">MODELO ▸ COLOR</text>
      <text x="100" y="27" textAnchor="middle" fontSize="5.5" fill="var(--ink-50)" fontFamily="monospace">▸ TALLA ▸ CANT.</text>
      <line x1="76" y1="31" x2="124" y2="31" stroke="#15803d" strokeWidth="1"/>
    </g>

    {/* Arrow to dispatch */}
    <g className="tut-bounce-x">
      <path d="M82 78 L108 78" stroke="#15803d" strokeWidth="2"/>
      <polygon points="110,78 103,74 103,82" fill="#15803d"/>
    </g>

    {/* Dispatch location */}
    <rect x="122" y="45" width="70" height="55" rx="2" fill="var(--surface)" stroke="var(--border)" strokeWidth="1.5"/>
    <text x="157" y="39" textAnchor="middle" fontSize="7" fill="var(--ink)" fontWeight="700" fontFamily="monospace">DESPACHO</text>
    <g className="tut-fade-up" style={{animationDelay:'0.8s'}}>
      <rect x="129" y="73" width="16" height="16" rx="1" fill="#dcfce7" stroke="#86efac" strokeWidth="1"/>
    </g>
    <rect x="149" y="53" width="16" height="16" rx="1" fill="var(--bg-card)" stroke="var(--border)" strokeWidth="1" opacity="0.3"/>

    <text x="100" y="130" textAnchor="middle" fontSize="7.5" fill="var(--ink)" fontWeight="700" fontFamily="monospace">DISP. LIMITA LA CANTIDAD</text>
  </svg>
);

const IllustrationCreateOC = () => (
  <svg viewBox="0 0 200 140" className="w-full h-full" fill="none">
    {/* Supplier */}
    <g className="tut-float" style={{animationDelay:'0s'}}>
      <circle cx="30" cy="40" r="16" fill="var(--bg-card)" stroke="var(--border)" strokeWidth="1.5"/>
      <path d="M22 46 q8 -10 16 0" stroke="var(--ink)" strokeWidth="1.5" fill="none"/>
      <circle cx="30" cy="34" r="5" fill="var(--ink)" opacity="0.7"/>
    </g>
    <text x="30" y="66" textAnchor="middle" fontSize="6" fill="var(--ink-50)" fontFamily="monospace">PROVEEDOR</text>

    {/* Arrow */}
    <path d="M50 40 L68 40" stroke="#1d4ed8" strokeWidth="1.5" strokeDasharray="3,2" className="tut-draw"/>
    <polygon points="70,40 63,36 63,44" fill="#1d4ed8"/>

    {/* OC form */}
    <g className="tut-fade-up" style={{animationDelay:'0.3s'}}>
      <rect x="74" y="15" width="110" height="90" rx="2" fill="var(--bg-card)" stroke="var(--border)" strokeWidth="1.5"/>
      <rect x="74" y="15" width="110" height="14" fill="#dbeafe"/>
      <text x="129" y="25" textAnchor="middle" fontSize="6" fill="#1d4ed8" fontWeight="700" fontFamily="monospace">NUEVA ORDEN OC</text>
      {/* table rows: size / qty / cost */}
      <text x="82" y="40" fontSize="6" fill="var(--ink-50)" fontFamily="monospace">TALLA</text>
      <text x="118" y="40" fontSize="6" fill="var(--ink-50)" fontFamily="monospace">CANT.</text>
      <text x="150" y="40" fontSize="6" fill="var(--ink-50)" fontFamily="monospace">COSTO</text>
      {[48, 60, 72].map((y, i) => (
        <g key={i}>
          <text x="82" y={y} fontSize="6.5" fill="var(--ink)" fontWeight="700" fontFamily="monospace">{['S','M','L'][i]}</text>
          <rect x="112" y={y-7} width="22" height="10" rx="1" fill="var(--surface)" stroke="var(--border)" strokeWidth="1"/>
          <rect x="144" y={y-7} width="26" height="10" rx="1" fill="var(--surface)" stroke="var(--border)" strokeWidth="1"/>
        </g>
      ))}
      <rect x="82" y="84" width="94" height="14" rx="1" fill="var(--ink)"/>
      <text x="129" y="94" textAnchor="middle" fontSize="6" fill="var(--ink-inv)" fontWeight="700" fontFamily="monospace">AGREGAR</text>
    </g>

    <text x="100" y="128" textAnchor="middle" fontSize="7.5" fill="var(--ink)" fontWeight="700" fontFamily="monospace">CANTIDAD Y COSTO POR TALLA</text>
  </svg>
);

const IllustrationApproveReceive = () => (
  <svg viewBox="0 0 200 140" className="w-full h-full" fill="none">
    {/* Status pills */}
    <g className="tut-fade-up">
      <rect x="8" y="20" width="52" height="18" rx="2" fill="var(--surface)" stroke="var(--border)" strokeWidth="1"/>
      <text x="34" y="32" textAnchor="middle" fontSize="6" fill="var(--ink-50)" fontWeight="700" fontFamily="monospace">BORRADOR</text>
    </g>
    <path d="M62 29 L78 29" stroke="var(--ink)" strokeWidth="1.5" className="tut-draw"/>
    <polygon points="80,29 73,25 73,33" fill="var(--ink)"/>
    <g className="tut-fade-up" style={{animationDelay:'0.3s'}}>
      <rect x="84" y="20" width="52" height="18" rx="2" fill="#dbeafe" stroke="#93c5fd" strokeWidth="1"/>
      <text x="110" y="32" textAnchor="middle" fontSize="6" fill="#1d4ed8" fontWeight="700" fontFamily="monospace">APROBADA</text>
    </g>
    <path d="M138 29 L154 29" stroke="var(--ink)" strokeWidth="1.5" className="tut-draw" style={{animationDelay:'0.3s'}}/>
    <polygon points="156,29 149,25 149,33" fill="var(--ink)"/>
    <g className="tut-fade-up" style={{animationDelay:'0.6s'}}>
      <rect x="160" y="20" width="32" height="18" rx="2" fill="#dcfce7" stroke="#86efac" strokeWidth="1"/>
      <text x="176" y="32" textAnchor="middle" fontSize="5.5" fill="#15803d" fontWeight="700" fontFamily="monospace">OK</text>
    </g>

    {/* Receive modal */}
    <g className="tut-fade-up" style={{animationDelay:'0.9s'}}>
      <rect x="30" y="55" width="140" height="65" rx="2" fill="var(--bg-card)" stroke="var(--border)" strokeWidth="1.5"/>
      <rect x="30" y="55" width="140" height="14" fill="var(--ink)"/>
      <text x="100" y="65" textAnchor="middle" fontSize="6" fill="var(--ink-inv)" fontWeight="700" fontFamily="monospace">RECIBIR / DESPACHAR</text>
      <text x="38" y="80" fontSize="6" fill="var(--ink-50)" fontFamily="monospace">PENDIENTE: 12 u.</text>
      <rect x="38" y="86" width="60" height="11" rx="1" fill="var(--surface)" stroke="var(--border)" strokeWidth="1"/>
      <text x="45" y="94" fontSize="6.5" fill="var(--ink)" fontWeight="700" fontFamily="monospace">12</text>
      <rect x="105" y="86" width="55" height="11" rx="1" fill="var(--surface)" stroke="var(--border)" strokeWidth="1"/>
      <text x="110" y="94" fontSize="5.5" fill="var(--ink-50)" fontFamily="monospace">RESERVA A</text>
      <g className="tut-fade-up" style={{animationDelay:'1.3s'}}>
        <circle cx="158" cy="110" r="7" fill="#dcfce7" stroke="#86efac" strokeWidth="1.5"/>
        <polyline points="155,110 157,113 162,107" stroke="#15803d" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </g>
    </g>

    <text x="100" y="134" textAnchor="middle" fontSize="7.5" fill="var(--ink)" fontWeight="700" fontFamily="monospace">ACTUALIZA STOCK REAL</text>
  </svg>
);

const IllustrationBulletinsReports = () => (
  <svg viewBox="0 0 200 140" className="w-full h-full" fill="none">
    {/* Bulletin document */}
    <g className="tut-float" style={{animationDelay:'0s'}}>
      <rect x="15" y="20" width="70" height="90" rx="2" fill="var(--bg-card)" stroke="var(--border)" strokeWidth="1.5"/>
      <rect x="15" y="20" width="70" height="14" fill="var(--ink)"/>
      <text x="50" y="30" textAnchor="middle" fontSize="5.5" fill="var(--ink-inv)" fontWeight="700" fontFamily="monospace">COMPROBANTE</text>
      <line x1="23" y1="44" x2="77" y2="44" stroke="var(--border)" strokeWidth="1"/>
      <line x1="23" y1="54" x2="77" y2="54" stroke="var(--border)" strokeWidth="1"/>
      <line x1="23" y1="64" x2="60" y2="64" stroke="var(--border)" strokeWidth="1"/>
      <path d="M28 82 q6 -8 12 0 q6 -8 12 0" stroke="#1d4ed8" strokeWidth="1.5" fill="none" className="tut-sign"/>
    </g>

    {/* Bar chart / reports */}
    <g className="tut-fade-up" style={{animationDelay:'0.4s'}}>
      <rect x="105" y="20" width="80" height="90" rx="2" fill="var(--surface)" stroke="var(--border)" strokeWidth="1.5"/>
      <text x="145" y="32" textAnchor="middle" fontSize="6" fill="var(--ink)" fontWeight="700" fontFamily="monospace">REPORTES</text>
      <rect x="115" y="70" width="10" height="28" fill="#93c5fd"/>
      <rect x="130" y="55" width="10" height="43" fill="#93c5fd"/>
      <rect x="145" y="80" width="10" height="18" fill="#93c5fd"/>
      <rect x="160" y="62" width="10" height="36" fill="#1d4ed8"/>
    </g>

    {/* Export buttons */}
    <g className="tut-fade-up" style={{animationDelay:'0.9s'}}>
      <rect x="105" y="116" width="36" height="14" rx="1" fill="var(--ink)"/>
      <text x="123" y="126" textAnchor="middle" fontSize="5.5" fill="var(--ink-inv)" fontWeight="700" fontFamily="monospace">EXCEL</text>
      <rect x="145" y="116" width="36" height="14" rx="1" fill="var(--ink)"/>
      <text x="163" y="126" textAnchor="middle" fontSize="5.5" fill="var(--ink-inv)" fontWeight="700" fontFamily="monospace">PDF</text>
    </g>

    <text x="50" y="128" textAnchor="middle" fontSize="7" fill="var(--ink)" fontWeight="700" fontFamily="monospace">IMPRIMIR</text>
  </svg>
);

// ── Tutorial Steps for Órdenes OC ───────────────────────────────────────────────

export const PURCHASE_ORDERS_TUTORIAL_STEPS: TutorialStep[] = [
  {
    title: '¿Qué es Órdenes OC?',
    description: 'Este módulo gestiona dos tipos de solicitudes distintas: la Orden de Compra (OC), que pide mercancía nueva a un proveedor externo, y el Requerimiento, que mueve stock ya existente desde una ubicación de reserva hacia despacho. Ambas comparten el mismo flujo de aprobación y recepción.',
    illustration: <IllustrationPOOverview />,
    tips: [
      'OC: para traer producto nuevo de un proveedor, con costo unitario',
      'Requerimiento: para abastecer despacho con stock que ya tienes en reserva',
      'Cualquier usuario puede crear un Requerimiento; solo roles con permiso pueden crear una OC',
    ],
  },
  {
    title: 'Crear un Requerimiento',
    description: 'Desde la pestaña OPERACIONES, elige REQUERIMIENTOS. Selecciona el producto (modelo, color y talla) y la cantidad: el sistema te muestra el disponible en reserva y no te deja pedir más de lo que existe. El destino siempre es la ubicación de Despacho.',
    illustration: <IllustrationRequirement />,
    tips: [
      'La columna "DISP." muestra cuánto hay realmente en reserva para esa talla',
      'No necesitas indicar costo ni proveedor',
      'El DESPACHADOR solo ve esta pantalla, sin acceso a Historial, Reportes ni OC',
    ],
  },
  {
    title: 'Crear una Orden de Compra (OC)',
    description: 'Desde la pestaña ÓRDENES OC, elige el proveedor y una referencia. Agrega productos por modelo y color; para cada talla ingresa la cantidad y el costo unitario. Al guardar, la orden queda en estado BORRADOR y se notifica por correo.',
    illustration: <IllustrationCreateOC />,
    tips: [
      'Puedes agregar varias tallas de un mismo modelo en una sola orden',
      'El costo unitario por talla se usa para calcular el valor total de la orden',
      'Elige la ubicación de destino donde llegará la mercancía',
    ],
  },
  {
    title: 'Aprobar, Recibir y Despachar',
    description: 'Una orden pasa de BORRADOR a APROBADA (requiere permiso), y luego se marca RECIBIR (OC) o DESPACHAR (Requerimiento) para registrar las unidades que realmente llegaron o salieron. Puedes recibir en partes: el sistema recuerda cuánto queda pendiente en cada línea.',
    illustration: <IllustrationApproveReceive />,
    tips: [
      'Solo se actualiza el stock real al confirmar la recepción/despacho, no al aprobar',
      'En Requerimientos puedes elegir de qué ubicación de reserva sale cada línea',
      'Una orden con recepción parcial queda en estado PARCIAL hasta completarse',
    ],
  },
  {
    title: 'Comprobantes y Reportes',
    description: 'La pestaña COMPROBANTES genera un documento imprimible por cada operación, útil como respaldo físico o digital. La pestaña REPORTES resume el historial con gráficos y permite exportar todo a Excel o PDF.',
    illustration: <IllustrationBulletinsReports />,
    tips: [
      'El comprobante se abre en una ventana lista para imprimir',
      'Los reportes se pueden filtrar por rango de fechas antes de exportar',
      'Ambas pestañas están ocultas para el rol DESPACHADOR',
    ],
  },
];

// ── SVG Illustrations · Dashboard ───────────────────────────────────────────────

const IllustrationDashOverview = () => (
  <svg viewBox="0 0 200 140" className="w-full h-full" fill="none">
    <g className="tut-fade-up">
      <rect x="8" y="14" width="42" height="30" rx="2" fill="var(--surface)" stroke="var(--border)" strokeWidth="1.5"/>
      <text x="29" y="26" textAnchor="middle" fontSize="5.5" fill="var(--ink-50)" fontFamily="monospace">STOCK TOTAL</text>
      <text x="29" y="38" textAnchor="middle" fontSize="9" fill="var(--ink)" fontWeight="900" fontFamily="monospace">36845</text>
    </g>
    <g className="tut-fade-up" style={{animationDelay:'0.15s'}}>
      <rect x="54" y="14" width="42" height="30" rx="2" fill="#dcfce7" stroke="#86efac" strokeWidth="1.5"/>
      <text x="75" y="26" textAnchor="middle" fontSize="5.5" fill="#15803d" fontFamily="monospace">RECEP. HOY</text>
      <text x="75" y="38" textAnchor="middle" fontSize="9" fill="#15803d" fontWeight="900" fontFamily="monospace">120</text>
    </g>
    <g className="tut-fade-up" style={{animationDelay:'0.3s'}}>
      <rect x="100" y="14" width="42" height="30" rx="2" fill="#fee2e2" stroke="#fca5a5" strokeWidth="1.5"/>
      <text x="121" y="26" textAnchor="middle" fontSize="5.5" fill="#dc2626" fontFamily="monospace">DESP. HOY</text>
      <text x="121" y="38" textAnchor="middle" fontSize="9" fill="#dc2626" fontWeight="900" fontFamily="monospace">64</text>
    </g>
    <g className="tut-fade-up" style={{animationDelay:'0.45s'}}>
      <rect x="146" y="14" width="46" height="30" rx="2" fill="#fef3c7" stroke="#fcd34d" strokeWidth="1.5"/>
      <text x="169" y="26" textAnchor="middle" fontSize="5.5" fill="#b45309" fontFamily="monospace">MERMAS HOY</text>
      <text x="169" y="38" textAnchor="middle" fontSize="9" fill="#b45309" fontWeight="900" fontFamily="monospace">3</text>
    </g>

    {/* trend chart */}
    <g className="tut-fade-up" style={{animationDelay:'0.6s'}}>
      <rect x="8" y="52" width="184" height="46" rx="2" fill="var(--bg-card)" stroke="var(--border)" strokeWidth="1.5"/>
      {[14, 24, 18, 30, 22, 34, 26].map((h, i) => (
        <rect key={i} x={16 + i * 24} y={94 - h} width="10" height={h} fill="#93c5fd"/>
      ))}
    </g>

    {/* pointing hand toward a KPI */}
    <g className="tut-bounce-x" style={{animationDelay:'0.9s'}}>
      <path d="M75 48 L75 44" stroke="#15803d" strokeWidth="1.5"/>
      <polygon points="75,42 71,49 79,49" fill="#15803d"/>
    </g>
    <text x="100" y="112" textAnchor="middle" fontSize="7" fill="var(--ink)" fontWeight="700" fontFamily="monospace">CLIC EN UNA TARJETA = FILTRO</text>
    <text x="100" y="124" textAnchor="middle" fontSize="7" fill="var(--ink)" fontWeight="700" fontFamily="monospace">EN OPERACIONES O INVENTARIO</text>
  </svg>
);

const IllustrationDashHistorical = () => (
  <svg viewBox="0 0 200 140" className="w-full h-full" fill="none">
    <rect x="12" y="20" width="176" height="70" rx="2" fill="var(--surface)" stroke="var(--border)" strokeWidth="1.5"/>
    <path d="M18 75 L45 60 L72 65 L99 45 L126 50 L153 30 L180 35" stroke="#1d4ed8" strokeWidth="2" fill="none" className="tut-draw" style={{strokeDasharray: 260}}/>
    {[18,45,72,99,126,153,180].map((x,i) => (
      <circle key={i} cx={x} cy={[75,60,65,45,50,30,35][i]} r="2.5" fill="#1d4ed8" className="tut-fade-up" style={{animationDelay:`${0.1*i}s`}}/>
    ))}
    <g className="tut-fade-up" style={{animationDelay:'0.9s'}}>
      <rect x="12" y="98" width="56" height="34" rx="2" fill="var(--bg-card)" stroke="var(--border)" strokeWidth="1"/>
      <text x="40" y="110" textAnchor="middle" fontSize="5.5" fill="var(--ink-50)" fontFamily="monospace">BALANCE NETO</text>
      <text x="40" y="123" textAnchor="middle" fontSize="8" fill="var(--ink)" fontWeight="900" fontFamily="monospace">+12,480</text>
    </g>
    <g className="tut-fade-up" style={{animationDelay:'1s'}}>
      <rect x="72" y="98" width="56" height="34" rx="2" fill="var(--bg-card)" stroke="var(--border)" strokeWidth="1"/>
      <text x="100" y="110" textAnchor="middle" fontSize="5.5" fill="var(--ink-50)" fontFamily="monospace">ROTACION TOP</text>
      <rect x="80" y="116" width="10" height="10" fill="#93c5fd"/>
      <rect x="94" y="112" width="10" height="14" fill="#93c5fd"/>
      <rect x="108" y="118" width="10" height="8" fill="#1d4ed8"/>
    </g>
    <g className="tut-fade-up" style={{animationDelay:'1.1s'}}>
      <rect x="132" y="98" width="56" height="34" rx="2" fill="var(--bg-card)" stroke="var(--border)" strokeWidth="1"/>
      <text x="160" y="110" textAnchor="middle" fontSize="5.5" fill="var(--ink-50)" fontFamily="monospace">POR PRODUCTO</text>
      <text x="160" y="123" textAnchor="middle" fontSize="6" fill="var(--ink)" fontWeight="700" fontFamily="monospace">PDF · XLS</text>
    </g>
  </svg>
);

// ── SVG Illustrations · Análisis ────────────────────────────────────────────────

const IllustrationAnalysisFilters = () => (
  <svg viewBox="0 0 200 140" className="w-full h-full" fill="none">
    <g className="tut-fade-up">
      <rect x="10" y="14" width="55" height="16" rx="2" fill="var(--surface)" stroke="var(--border)" strokeWidth="1"/>
      <text x="37" y="25" textAnchor="middle" fontSize="5.5" fill="var(--ink-50)" fontFamily="monospace">DESDE ▾</text>
      <rect x="70" y="14" width="55" height="16" rx="2" fill="var(--surface)" stroke="var(--border)" strokeWidth="1"/>
      <text x="97" y="25" textAnchor="middle" fontSize="5.5" fill="var(--ink-50)" fontFamily="monospace">HASTA ▾</text>
      <rect x="130" y="14" width="60" height="16" rx="2" fill="var(--surface)" stroke="var(--border)" strokeWidth="1"/>
      <text x="160" y="25" textAnchor="middle" fontSize="5.5" fill="var(--ink-50)" fontFamily="monospace">TIPO ▾</text>
    </g>
    {/* Rotation gauge */}
    <g className="tut-fade-up" style={{animationDelay:'0.3s'}}>
      <rect x="10" y="42" width="180" height="20" rx="2" fill="var(--bg-card)" stroke="var(--border)" strokeWidth="1"/>
      <rect x="10" y="42" width="126" height="20" rx="2" fill="#86efac"/>
      <text x="100" y="55" textAnchor="middle" fontSize="6.5" fill="var(--ink)" fontWeight="700" fontFamily="monospace">TASA DE ROTACION · 70%</text>
    </g>
    {/* Top 8 chart */}
    <g className="tut-fade-up" style={{animationDelay:'0.5s'}}>
      {[30,22,26,16,20,12,14,9].map((h,i) => (
        <rect key={i} x={14 + i*22} y={100-h} width="14" height={h} fill={i<2 ? '#15803d' : i<5 ? '#86efac' : '#e5e7eb'} />
      ))}
    </g>
    <g className="tut-fade-up" style={{animationDelay:'0.9s'}}>
      <rect x="10" y="108" width="180" height="24" rx="2" fill="#fef3c7" stroke="#fcd34d" strokeWidth="1"/>
      <text x="100" y="123" textAnchor="middle" fontSize="6" fill="#b45309" fontWeight="700" fontFamily="monospace">SIN MOVIMIENTO EN EL RANGO</text>
    </g>
  </svg>
);

// ── SVG Illustrations · Inventario ──────────────────────────────────────────────

const IllustrationInventoryDrilldown = () => (
  <svg viewBox="0 0 200 140" className="w-full h-full" fill="none">
    <g className="tut-fade-up">
      <rect x="10" y="12" width="180" height="18" rx="1" fill="var(--ink)"/>
      <text x="18" y="24" fontSize="6.5" fill="var(--ink-inv)" fontWeight="700" fontFamily="monospace">▾ SLIM FIT</text>
      <text x="180" y="24" textAnchor="end" fontSize="6.5" fill="var(--ink-inv)" fontWeight="700" fontFamily="monospace">1932 u.</text>
    </g>
    <g className="tut-fade-up" style={{animationDelay:'0.2s'}}>
      <rect x="18" y="32" width="172" height="16" rx="1" fill="var(--bg-sidebar)"/>
      <text x="28" y="43" fontSize="6" fill="var(--ink)" fontWeight="700" fontFamily="monospace">▾ NEGRO</text>
      <text x="180" y="43" textAnchor="end" fontSize="6" fill="var(--ink)" fontWeight="700" fontFamily="monospace">840 u.</text>
    </g>
    <g className="tut-fade-up" style={{animationDelay:'0.4s'}}>
      <rect x="28" y="50" width="162" height="14" rx="1" fill="var(--surface-alt)"/>
      <text x="40" y="60" fontSize="6" fill="var(--ink)" fontWeight="700" fontFamily="monospace">M</text>
      <text x="180" y="60" textAnchor="end" fontSize="6" fill="var(--ink)" fontWeight="700" fontFamily="monospace">210 u.</text>
    </g>

    {/* Detail panel expanded */}
    <g className="tut-fade-up" style={{animationDelay:'0.6s'}}>
      <rect x="28" y="66" width="162" height="52" rx="1" fill="var(--bg-card-alt)" stroke="var(--border)" strokeWidth="1"/>
      <text x="36" y="78" fontSize="5.5" fill="var(--ink-50)" fontFamily="monospace">CODIGO SKU</text>
      <text x="36" y="88" fontSize="6" fill="var(--ink)" fontWeight="700" fontFamily="monospace">SF-014</text>
      <text x="100" y="78" fontSize="5.5" fill="var(--ink-50)" fontFamily="monospace">STOCK</text>
      <text x="100" y="88" fontSize="6" fill="var(--ink)" fontWeight="700" fontFamily="monospace">210</text>
      {/* QR / edit / delete icons — ADMIN_GENERAL only for last two */}
      <g className="tut-float" style={{animationDelay:'0.2s'}}>
        <rect x="146" y="72" width="14" height="14" rx="1" fill="var(--surface)" stroke="var(--border)" strokeWidth="1"/>
      </g>
      <g className="tut-float" style={{animationDelay:'0.5s'}}>
        <rect x="163" y="72" width="14" height="14" rx="1" fill="var(--surface)" stroke="var(--border)" strokeWidth="1"/>
      </g>
      <text x="160" y="98" textAnchor="middle" fontSize="5" fill="#dc2626" fontWeight="700" fontFamily="monospace">EDITAR/ELIMINAR</text>
      <text x="160" y="106" textAnchor="middle" fontSize="5" fill="#dc2626" fontWeight="700" fontFamily="monospace">= SOLO ADMIN_GENERAL</text>
    </g>

    <text x="100" y="134" textAnchor="middle" fontSize="7" fill="var(--ink)" fontWeight="700" fontFamily="monospace">PRODUCTO ▸ COLOR ▸ TALLA</text>
  </svg>
);

const IllustrationInventoryBatch = () => (
  <svg viewBox="0 0 200 140" className="w-full h-full" fill="none">
    <g className="tut-fade-up">
      <rect x="14" y="14" width="172" height="24" rx="2" fill="var(--surface)" stroke="var(--border)" strokeWidth="1.5"/>
      <text x="22" y="30" fontSize="6.5" fill="var(--ink)" fontWeight="700" fontFamily="monospace">FAMILIA: WAFFLE CAMISERO</text>
    </g>
    {/* color chips */}
    <g className="tut-fade-up" style={{animationDelay:'0.2s'}}>
      {['NEGRO','AZUL','BEIGE','VINO'].map((c,i) => (
        <rect key={c} x={14 + i*44} y="46" width="40" height="14" rx="1" fill={i<2 ? 'var(--ink)' : 'var(--surface)'} stroke="var(--border)" strokeWidth="1"/>
      ))}
      {['NEGRO','AZUL','BEIGE','VINO'].map((c,i) => (
        <text key={c} x={34 + i*44} y="56" textAnchor="middle" fontSize="5" fill={i<2 ? 'var(--ink-inv)' : 'var(--ink)'} fontWeight="700" fontFamily="monospace">{c}</text>
      ))}
    </g>
    {/* size chips */}
    <g className="tut-fade-up" style={{animationDelay:'0.4s'}}>
      {['S','M','L','XL'].map((s,i) => (
        <rect key={s} x={14 + i*44} y="66" width="40" height="14" rx="1" fill={i<3 ? 'var(--ink)' : 'var(--surface)'} stroke="var(--border)" strokeWidth="1"/>
      ))}
      {['S','M','L','XL'].map((s,i) => (
        <text key={s} x={34 + i*44} y="76" textAnchor="middle" fontSize="5.5" fill={i<3 ? 'var(--ink-inv)' : 'var(--ink)'} fontWeight="700" fontFamily="monospace">{s}</text>
      ))}
    </g>
    {/* Preview count */}
    <g className="tut-fade-up" style={{animationDelay:'0.7s'}}>
      <rect x="14" y="88" width="172" height="24" rx="2" fill="var(--bg-card)" stroke="var(--border)" strokeWidth="1"/>
      <text x="22" y="103" fontSize="6" fill="var(--ink-50)" fontFamily="monospace">SKUs A GENERAR</text>
      <text x="178" y="104" textAnchor="end" fontSize="9" fill="var(--ink)" fontWeight="900" fontFamily="monospace">6</text>
    </g>
    <text x="100" y="128" textAnchor="middle" fontSize="7" fill="var(--ink)" fontWeight="700" fontFamily="monospace">2 COLORES × 3 TALLAS = 6 SKUs</text>
  </svg>
);

// ── Tutorial Steps · Dashboard ───────────────────────────────────────────────────

export const DASHBOARD_TUTORIAL_STEPS: TutorialStep[] = [
  {
    title: '¿Qué es el Dashboard?',
    description: 'El Dashboard resume el estado del almacén en tiempo real: stock total, recepciones y despachos de hoy, mermas, y un histórico completo. Es tu primer vistazo del día antes de entrar a un módulo específico.',
    illustration: <IllustrationDashOverview />,
    tips: [
      'Clic en "RECEP. HOY" o "DESP. HOY" te lleva a Operaciones ya filtrado por hoy',
      'La alerta roja de stock bajo te lleva directo a Inventario filtrado',
      '"STOCK TOTAL" y "MERMAS HOY" son solo informativos, no son clicables',
    ],
  },
  {
    title: 'Histórico y por Producto/Talla',
    description: 'Además del resumen del día, el Dashboard tiene un histórico acumulado desde el inicio de operaciones, y dos vistas adicionales (POR PRODUCTO y POR TALLA) para exportar totales detallados a PDF, Excel o CSV.',
    illustration: <IllustrationDashHistorical />,
    tips: [
      'Los botones 7D/14D/30D solo cambian el gráfico de tendencia, no el resto de tarjetas',
      'Las "mermas" son despachos marcados como baja — se restan del stock pero no cuentan como despacho normal',
      'El histórico acumulado es de todos los tiempos, no respeta el rango de días elegido',
    ],
  },
];

// ── Tutorial Steps · Análisis ────────────────────────────────────────────────────

export const ANALYSIS_TUTORIAL_STEPS: TutorialStep[] = [
  {
    title: '¿Qué es Análisis?',
    description: 'Análisis mide qué tan bien rota tu inventario: qué productos se venden rápido, cuáles llevan tiempo sin moverse, y cómo se compara cada talla o color. Todo se puede filtrar por rango de fechas y tipo de operación.',
    illustration: <IllustrationAnalysisFilters />,
    tips: [
      'La tasa de rotación es despachado ÷ recepcionado del rango filtrado',
      'Un producto nunca "recepcionado" en el sistema no puede mostrar % de rotación, aunque tenga stock',
      'Filtrar por un rango corto puede hacer que un producto activo aparezca como "sin movimiento"',
    ],
  },
  {
    title: 'Ranking, Tallas y Colores',
    description: 'La pestaña RANKING ordena todos los productos por despachos, stock o % de rotación. TALLAS y COLORES muestran la misma métrica agrupada por variante, para saber qué talla o color se agota más rápido.',
    illustration: <IllustrationAnalysisFilters />,
    tips: [
      'Verde = rotación ≥70%, ámbar = ≥30%, gris = por debajo',
      'Los filtros de fecha/tipo aplican a las 4 pestañas a la vez',
      'Estos filtros son propios de Análisis, no afectan Dashboard ni Operaciones',
    ],
  },
];

// ── Tutorial Steps · Inventario ──────────────────────────────────────────────────

export const INVENTORY_TUTORIAL_STEPS: TutorialStep[] = [
  {
    title: '¿Qué es Inventario?',
    description: 'Inventario es el directorio completo de productos, organizado en tres niveles: Producto, Color y Talla. Haz clic en cada nivel para ir expandiendo hasta llegar al detalle de un SKU específico con su stock por ubicación.',
    illustration: <IllustrationInventoryDrilldown />,
    tips: [
      'Editar y eliminar un SKU es exclusivo de ADMIN_GENERAL',
      'El ícono de QR abre el código de esa variante específica (color + talla)',
      'El filtro de ubicación limita el stock mostrado por SKU a esa ubicación, pero las tarjetas KPI arriba siempre son globales',
    ],
  },
  {
    title: 'Variantes en Lote y CSV',
    description: 'Para crear muchos SKUs de golpe (mismo producto en varios colores y tallas), usa VARIANTES: elige o crea la familia, selecciona colores y tallas con chips, y el sistema arma automáticamente el código correlativo de cada combinación.',
    illustration: <IllustrationInventoryBatch />,
    tips: [
      'El código de cada SKU nuevo se numera automáticamente a partir del último usado con ese prefijo',
      'Importar CSV solo crea productos nuevos: no actualiza los que ya existen si repites un código',
      'IMPORTAR y VARIANTES requieren permiso de edición sobre Inventario; solo ADMIN_GENERAL puede luego editar/eliminar cada SKU',
    ],
  },
];

// ── SVG Illustrations · Ubicaciones ─────────────────────────────────────────────

const IllustrationLocationsGrid = () => (
  <svg viewBox="0 0 200 140" className="w-full h-full" fill="none">
    {[
      {x:10,  y:16, fill:'#dcfce7', stroke:'#86efac', label:'ZONA A', pct:'40%'},
      {x:76,  y:16, fill:'#fef3c7', stroke:'#fcd34d', label:'RACK B', pct:'72%'},
      {x:142, y:16, fill:'#fee2e2', stroke:'#fca5a5', label:'BIN C',  pct:'94%'},
    ].map((c,i) => (
      <g key={c.label} className="tut-fade-up" style={{animationDelay:`${i*0.15}s`}}>
        <rect x={c.x} y={c.y} width="54" height="60" rx="2" fill={c.fill} stroke={c.stroke} strokeWidth="1.5"/>
        <text x={c.x+27} y={c.y+16} textAnchor="middle" fontSize="6.5" fill="var(--ink)" fontWeight="700" fontFamily="monospace">{c.label}</text>
        <rect x={c.x+8} y={c.y+24} width="38" height="8" rx="1" fill="var(--bg-card)" stroke="var(--border)" strokeWidth="1"/>
        <rect x={c.x+8} y={c.y+24} width={38*(parseInt(c.pct)/100)} height="8" rx="1" fill={c.stroke}/>
        <text x={c.x+27} y={c.y+46} textAnchor="middle" fontSize="8" fill="var(--ink)" fontWeight="900" fontFamily="monospace">{c.pct}</text>
      </g>
    ))}
    <g className="tut-bounce-x" style={{animationDelay:'0.6s'}}>
      <path d="M100 92 L100 100" stroke="var(--ink)" strokeWidth="1.5"/>
      <polygon points="100,102 96,95 104,95" fill="var(--ink)"/>
    </g>
    <text x="100" y="118" textAnchor="middle" fontSize="7" fill="var(--ink)" fontWeight="700" fontFamily="monospace">CLIC EN UNA TARJETA</text>
    <text x="100" y="130" textAnchor="middle" fontSize="7" fill="var(--ink)" fontWeight="700" fontFamily="monospace">= VER SKUs ALMACENADOS</text>
  </svg>
);

const IllustrationLocationsCRUD = () => (
  <svg viewBox="0 0 200 140" className="w-full h-full" fill="none">
    <g className="tut-fade-up">
      <rect x="14" y="14" width="172" height="16" rx="1" fill="var(--ink)"/>
      <text x="22" y="26" fontSize="6" fill="var(--ink-inv)" fontWeight="700" fontFamily="monospace">+ NUEVA UBICACION</text>
    </g>
    <g className="tut-fade-up" style={{animationDelay:'0.2s'}}>
      <rect x="14" y="38" width="172" height="34" rx="2" fill="var(--surface)" stroke="var(--border)" strokeWidth="1.5"/>
      <text x="22" y="52" fontSize="6" fill="var(--ink)" fontWeight="700" fontFamily="monospace">RESERVA CENTRAL 02</text>
      <text x="22" y="64" fontSize="5.5" fill="var(--ink-50)" fontFamily="monospace">TIPO: ZONA · 12 SKU · 840 u.</text>
      <g style={{opacity:0.9}}>
        <rect x="150" y="44" width="14" height="14" rx="1" fill="var(--bg-input)" stroke="var(--border)" strokeWidth="1"/>
        <rect x="168" y="44" width="14" height="14" rx="1" fill="var(--bg-input)" stroke="#dc2626" strokeWidth="1"/>
      </g>
    </g>
    <g className="tut-fade-up" style={{animationDelay:'0.5s'}}>
      <rect x="14" y="82" width="172" height="34" rx="2" fill="#fee2e2" stroke="#fca5a5" strokeWidth="1.5"/>
      <text x="22" y="96" fontSize="6" fill="#dc2626" fontWeight="700" fontFamily="monospace">¿ELIMINAR UBICACION?</text>
      <text x="22" y="108" fontSize="5.5" fill="#dc2626" fontFamily="monospace">Falla si aun tiene stock asignado</text>
    </g>
    <text x="100" y="130" textAnchor="middle" fontSize="7" fill="var(--ink)" fontWeight="700" fontFamily="monospace">MUEVE EL STOCK ANTES DE ELIMINAR</text>
  </svg>
);

// ── SVG Illustrations · Ajustes ─────────────────────────────────────────────────

const IllustrationAdjustRequest = () => (
  <svg viewBox="0 0 200 140" className="w-full h-full" fill="none">
    <g className="tut-fade-up">
      <rect x="20" y="16" width="160" height="50" rx="2" fill="var(--bg-card)" stroke="var(--border)" strokeWidth="1.5"/>
      <text x="30" y="30" fontSize="6" fill="var(--ink-50)" fontFamily="monospace">STOCK ACTUAL: 40</text>
      <rect x="30" y="36" width="50" height="14" rx="1" fill="var(--surface)" stroke="var(--border)" strokeWidth="1"/>
      <text x="55" y="46" textAnchor="middle" fontSize="7" fill="var(--ink)" fontWeight="900" fontFamily="monospace">35</text>
      <text x="90" y="46" fontSize="6.5" fill="#dc2626" fontWeight="700" fontFamily="monospace">−5 unidades</text>
      <rect x="30" y="54" width="90" height="10" rx="1" fill="#fee2e2" stroke="#fca5a5" strokeWidth="1"/>
      <text x="75" y="61.5" textAnchor="middle" fontSize="5" fill="#dc2626" fontWeight="700" fontFamily="monospace">MOTIVO: MERMA / PERDIDA</text>
    </g>
    <path d="M100 70 L100 80" stroke="var(--ink)" strokeWidth="1.5" className="tut-draw"/>
    <polygon points="100,82 96,75 104,75" fill="var(--ink)"/>
    <g className="tut-fade-up" style={{animationDelay:'0.4s'}}>
      <rect x="40" y="86" width="120" height="20" rx="2" fill="#fef3c7" stroke="#fcd34d" strokeWidth="1.5"/>
      <text x="100" y="99" textAnchor="middle" fontSize="6.5" fill="#b45309" fontWeight="700" fontFamily="monospace">ESTADO: PENDIENTE</text>
    </g>
    <text x="100" y="122" textAnchor="middle" fontSize="7" fill="var(--ink)" fontWeight="700" fontFamily="monospace">EL STOCK NO CAMBIA</text>
    <text x="100" y="132" textAnchor="middle" fontSize="7" fill="var(--ink)" fontWeight="700" fontFamily="monospace">HASTA QUE SE APRUEBE</text>
  </svg>
);

const IllustrationAdjustApprove = () => (
  <svg viewBox="0 0 200 140" className="w-full h-full" fill="none">
    <g className="tut-fade-up">
      <rect x="14" y="14" width="172" height="34" rx="2" fill="#fef3c7" stroke="#fcd34d" strokeWidth="1.5"/>
      <text x="22" y="28" fontSize="6" fill="#b45309" fontWeight="700" fontFamily="monospace">1 AJUSTE PENDIENTE</text>
      <text x="22" y="40" fontSize="5.5" fill="var(--ink-50)" fontFamily="monospace">SF-014 · 40 → 35 (-5) · por CARLOS</text>
    </g>
    <g className="tut-fade-up" style={{animationDelay:'0.3s'}}>
      <rect x="20" y="58" width="70" height="20" rx="1" fill="#15803d"/>
      <text x="55" y="71" textAnchor="middle" fontSize="6.5" fill="white" fontWeight="700" fontFamily="monospace">✓ APROBAR</text>
      <rect x="98" y="58" width="70" height="20" rx="1" fill="var(--bg-card)" stroke="#dc2626" strokeWidth="1.5"/>
      <text x="133" y="71" textAnchor="middle" fontSize="6.5" fill="#dc2626" fontWeight="700" fontFamily="monospace">✕ RECHAZAR</text>
    </g>
    <g className="tut-float" style={{animationDelay:'0.6s'}}>
      <circle cx="100" cy="100" r="14" fill="#dcfce7" stroke="#86efac" strokeWidth="1.5"/>
      <text x="100" y="97" textAnchor="middle" fontSize="10" fill="#15803d" fontWeight="900">AG</text>
    </g>
    <text x="100" y="126" textAnchor="middle" fontSize="7" fill="var(--ink)" fontWeight="700" fontFamily="monospace">SOLO ADMIN_GENERAL APRUEBA</text>
  </svg>
);

const IllustrationAdjustBulk = () => (
  <svg viewBox="0 0 200 140" className="w-full h-full" fill="none">
    <g className="tut-float" style={{animationDelay:'0s'}}>
      <rect x="14" y="30" width="46" height="56" rx="2" fill="#dcfce7" stroke="#86efac" strokeWidth="1.5"/>
      <text x="37" y="52" textAnchor="middle" fontSize="6" fill="#15803d" fontWeight="700" fontFamily="monospace">XLSX</text>
      <line x1="22" y1="60" x2="52" y2="60" stroke="#86efac" strokeWidth="1"/>
      <line x1="22" y1="68" x2="52" y2="68" stroke="#86efac" strokeWidth="1"/>
    </g>
    <path d="M64 58 L82 58" stroke="var(--ink)" strokeWidth="1.5" className="tut-draw"/>
    <polygon points="84,58 77,54 77,62" fill="var(--ink)"/>
    <g className="tut-fade-up" style={{animationDelay:'0.3s'}}>
      <rect x="88" y="20" width="98" height="80" rx="2" fill="var(--bg-card)" stroke="var(--border)" strokeWidth="1.5"/>
      <rect x="88" y="20" width="98" height="14" fill="var(--ink)"/>
      <text x="137" y="30" textAnchor="middle" fontSize="5.5" fill="var(--ink-inv)" fontWeight="700" fontFamily="monospace">VISTA PREVIA</text>
      {[38,50,62,74].map((y,i) => (
        <g key={i}>
          <rect x="94" y={y} width="86" height="9" fill={i===2 ? '#fee2e2' : 'var(--surface-alt)'}/>
          <text x="98" y={y+7} fontSize="5" fill={i===2 ? '#dc2626':'var(--ink)'} fontFamily="monospace">{i===2 ? 'ERROR: codigo no existe' : `SF-01${i} → OK`}</text>
        </g>
      ))}
    </g>
    <text x="100" y="122" textAnchor="middle" fontSize="7" fill="var(--ink)" fontWeight="700" fontFamily="monospace">FILAS CON ERROR SE IGNORAN,</text>
    <text x="100" y="132" textAnchor="middle" fontSize="7" fill="var(--ink)" fontWeight="700" fontFamily="monospace">EL RESTO QUEDA PENDIENTE</text>
  </svg>
);

// ── SVG Illustrations · Historial ───────────────────────────────────────────────

const IllustrationHistoryFilters = () => (
  <svg viewBox="0 0 200 140" className="w-full h-full" fill="none">
    <g className="tut-fade-up">
      <rect x="14" y="14" width="172" height="20" rx="2" fill="var(--surface)" stroke="var(--border)" strokeWidth="1.5"/>
      <text x="22" y="27" fontSize="6" fill="var(--ink)" fontWeight="700" fontFamily="monospace">FILTROS (3)</text>
      <circle cx="178" cy="20" r="5" fill="#dc2626"/>
    </g>
    {[
      {y:40, type:'RECEPCION', color:'#15803d', bg:'#dcfce7'},
      {y:58, type:'DESPACHO', color:'#dc2626', bg:'#fee2e2'},
      {y:76, type:'TRASLADO', color:'#1d4ed8', bg:'#dbeafe'},
    ].map((r,i) => (
      <g key={r.type} className="tut-fade-up" style={{animationDelay:`${i*0.15}s`}}>
        <rect x="14" y={r.y} width="172" height="14" rx="1" fill="var(--bg-card)" stroke="var(--border)" strokeWidth="1"/>
        <rect x="20" y={r.y+3} width="46" height="8" rx="1" fill={r.bg}/>
        <text x="43" y={r.y+9.5} textAnchor="middle" fontSize="4.5" fill={r.color} fontWeight="700" fontFamily="monospace">{r.type}</text>
        <text x="150" y={r.y+10} textAnchor="middle" fontSize="5" fill="var(--ink-50)" fontFamily="monospace">RE-00{i+1}</text>
      </g>
    ))}
    <g className="tut-fade-up" style={{animationDelay:'0.6s'}}>
      <rect x="14" y="98" width="80" height="14" rx="1" fill="var(--ink)"/>
      <text x="54" y="108" textAnchor="middle" fontSize="5.5" fill="var(--ink-inv)" fontWeight="700" fontFamily="monospace">EXPORTAR CSV</text>
    </g>
    <text x="100" y="128" textAnchor="middle" fontSize="7" fill="var(--ink)" fontWeight="700" fontFamily="monospace">REGISTRO INMUTABLE</text>
  </svg>
);

const IllustrationHistoryTicket = () => (
  <svg viewBox="0 0 200 140" className="w-full h-full" fill="none">
    <g className="tut-fade-up">
      <rect x="55" y="10" width="90" height="110" rx="2" fill="var(--bg-card)" stroke="var(--border)" strokeWidth="1.5"/>
      <rect x="55" y="10" width="90" height="16" fill="var(--ink)"/>
      <text x="100" y="21" textAnchor="middle" fontSize="6" fill="var(--ink-inv)" fontWeight="700" fontFamily="monospace">TICKET RE-0012</text>
      <line x1="63" y1="36" x2="137" y2="36" stroke="var(--border)" strokeWidth="1"/>
      <line x1="63" y1="46" x2="137" y2="46" stroke="var(--border)" strokeWidth="1"/>
      <line x1="63" y1="56" x2="120" y2="56" stroke="var(--border)" strokeWidth="1"/>
      <path d="M65 78 q6 -8 12 0 q6 -8 12 0 q6 -8 12 0" stroke="#1d4ed8" strokeWidth="1.5" fill="none" className="tut-sign"/>
      <rect x="63" y="90" width="74" height="24" rx="1" fill="var(--surface)" stroke="var(--border)" strokeWidth="1"/>
      <text x="100" y="105" textAnchor="middle" fontSize="5" fill="var(--ink-50)" fontFamily="monospace">FOTO EVIDENCIA</text>
    </g>
    <g className="tut-float" style={{animationDelay:'0.5s'}}>
      <rect x="150" y="50" width="34" height="34" rx="4" fill="var(--surface)" stroke="var(--border)" strokeWidth="1.5"/>
      <circle cx="167" cy="67" r="7" fill="var(--bg-card)" stroke="var(--border)" strokeWidth="1"/>
    </g>
    <text x="100" y="132" textAnchor="middle" fontSize="7" fill="var(--ink)" fontWeight="700" fontFamily="monospace">IMPRIME O GUARDA COMO PDF</text>
  </svg>
);

// ── Tutorial Steps · Ubicaciones ─────────────────────────────────────────────────

export const LOCATIONS_TUTORIAL_STEPS: TutorialStep[] = [
  {
    title: '¿Qué son Ubicaciones?',
    description: 'Ubicaciones representa la estructura física del almacén: zonas, racks, bins y almacenes. Cada tarjeta muestra cuántas unidades y SKUs hay guardados ahí, con un indicador visual de qué tan llena está.',
    illustration: <IllustrationLocationsGrid />,
    tips: [
      'Clic en una tarjeta con stock abre el detalle de todos los productos guardados ahí',
      'Puedes filtrar productos por modelo, color y talla dentro del detalle',
      'El % de llenado es una referencia aproximada, no una capacidad real configurada',
    ],
  },
  {
    title: 'Crear, editar y eliminar',
    description: 'Puedes crear nuevas ubicaciones, editarlas o eliminarlas. Si una ubicación todavía tiene stock asignado, el sistema no te dejará eliminarla hasta que muevas o retires ese stock primero.',
    illustration: <IllustrationLocationsCRUD />,
    tips: [
      'El código QR de cada ubicación sirve para identificarla físicamente en el almacén',
      'Puedes quitar el stock de un solo producto en una ubicación sin eliminar la ubicación completa',
      'Si cambias nombre o tipo y cierras sin guardar, el sistema te preguntará si deseas descartar los cambios',
    ],
  },
];

// ── Tutorial Steps · Ajustes ──────────────────────────────────────────────────────

export const ADJUSTMENTS_TUTORIAL_STEPS: TutorialStep[] = [
  {
    title: 'Solicitar un ajuste',
    description: 'Un ajuste corrige el stock de un SKU a un valor exacto, con un motivo obligatorio (daño, merma, conteo físico, devolución u otro). Al enviarlo, queda en estado PENDIENTE: el stock real no cambia todavía.',
    illustration: <IllustrationAdjustRequest />,
    tips: [
      'La diferencia (+/-) se calcula automáticamente contra el stock actual en esa ubicación',
      'El motivo queda registrado permanentemente junto con tus notas',
      'Puedes solicitar un ajuste individual o en lote vía Excel',
    ],
  },
  {
    title: 'Aprobación',
    description: 'Solo ADMIN_GENERAL puede aprobar o rechazar un ajuste pendiente. Al aprobar, el stock se actualiza de inmediato al valor solicitado. Al rechazar, el ajuste queda registrado como referencia pero no afecta el stock.',
    illustration: <IllustrationAdjustApprove />,
    tips: [
      'Los ajustes pendientes aparecen en un panel destacado arriba de la lista, visible solo para ADMIN_GENERAL',
      'Puedes indicar un motivo de rechazo opcional al rechazar',
      'El historial completo queda filtrable por estado: pendiente, aprobado o rechazado',
    ],
  },
  {
    title: 'Ajuste e Ingreso Masivo',
    description: 'Para corregir muchos SKUs de una vez (por ejemplo tras un conteo físico), descarga la plantilla Excel, complétala y súbela. El sistema valida cada fila y muestra una vista previa antes de confirmar.',
    illustration: <IllustrationAdjustBulk />,
    tips: [
      'Las filas con código no encontrado o cantidad inválida se marcan en rojo y se ignoran automáticamente',
      'El modo AJUSTE reemplaza el stock por el valor exacto; el modo INGRESO MASIVO suma unidades y sí se aplica de inmediato como recepción',
      'Revisa bien la vista previa antes de confirmar: son varias solicitudes de una sola vez',
    ],
  },
];

// ── Tutorial Steps · Historial ────────────────────────────────────────────────────

export const HISTORY_TUTORIAL_STEPS: TutorialStep[] = [
  {
    title: '¿Qué es Historial?',
    description: 'Historial es el registro completo e inmutable de todas las operaciones: recepciones, despachos y traslados. Puedes filtrar por tipo, estado, producto, usuario, contacto, fecha, o si tienen firma/foto adjunta.',
    illustration: <IllustrationHistoryFilters />,
    tips: [
      'No existe función de editar o anular un movimiento desde aquí: es un registro histórico',
      'Puedes seleccionar filas específicas y exportar solo esas a CSV',
      'El contador junto a "FILTROS" te dice cuántos filtros tienes activos',
    ],
  },
  {
    title: 'Detalle y comprobante',
    description: 'Haz clic en cualquier fila para ver el detalle completo: operador, ubicación de origen/destino, proveedor o cliente, número de lote/serie si aplica, y la firma digital si se capturó una. Desde ahí puedes generar un ticket imprimible.',
    illustration: <IllustrationHistoryTicket />,
    tips: [
      '"GENERAR TICKET" abre una ventana nueva lista para imprimir o guardar como PDF',
      'Si tu navegador bloquea ventanas emergentes, el ticket no se abrirá — revisa el bloqueador de pop-ups',
      'Los chips "CON FIRMA" y "CON FOTO" te ayudan a encontrar rápido movimientos con evidencia adjunta',
    ],
  },
];

// ── SVG Illustrations · Contactos ───────────────────────────────────────────────

const IllustrationContactsDirectory = () => (
  <svg viewBox="0 0 200 140" className="w-full h-full" fill="none">
    <g className="tut-fade-up">
      <rect x="14" y="14" width="80" height="16" rx="2" fill="var(--ink)"/>
      <text x="54" y="26" textAnchor="middle" fontSize="6" fill="var(--ink-inv)" fontWeight="700" fontFamily="monospace">+ NUEVO CONTACTO</text>
    </g>
    {[
      {y:38, type:'PROVEEDOR', color:'#1d4ed8', bg:'#dbeafe', name:'TEXTILES DEL SUR'},
      {y:58, type:'CLIENTE', color:'#15803d', bg:'#dcfce7', name:'BOUTIQUE LIMA'},
    ].map((r,i) => (
      <g key={r.type} className="tut-fade-up" style={{animationDelay:`${i*0.2}s`}}>
        <rect x="14" y={r.y} width="172" height="16" rx="1" fill="var(--surface)" stroke="var(--border)" strokeWidth="1"/>
        <rect x="20" y={r.y+3} width="52" height="10" rx="1" fill={r.bg}/>
        <text x="46" y={r.y+10.5} textAnchor="middle" fontSize="4.5" fill={r.color} fontWeight="700" fontFamily="monospace">{r.type}</text>
        <text x="80" y={r.y+11} fontSize="5.5" fill="var(--ink)" fontWeight="700" fontFamily="monospace">{r.name}</text>
        <rect x="150" y={r.y+3} width="10" height="10" rx="1" fill="var(--bg-input)" stroke="var(--border)" strokeWidth="1"/>
        <rect x="163" y={r.y+3} width="10" height="10" rx="1" fill="var(--bg-input)" stroke="var(--border)" strokeWidth="1"/>
        <rect x="176" y={r.y+3} width="10" height="10" rx="1" fill="var(--bg-input)" stroke="#dc2626" strokeWidth="1"/>
      </g>
    ))}
    <g className="tut-fade-up" style={{animationDelay:'0.5s'}}>
      <rect x="14" y="82" width="172" height="42" rx="2" fill="var(--bg-card)" stroke="var(--border)" strokeWidth="1.5"/>
      <text x="22" y="95" fontSize="6" fill="var(--ink)" fontWeight="700" fontFamily="monospace">HISTORIAL · TEXTILES DEL SUR</text>
      <text x="22" y="108" fontSize="5.5" fill="var(--ink-50)" fontFamily="monospace">RECEPCIONES: 480 u.   DESPACHOS: 0 u.</text>
      <text x="22" y="118" fontSize="5.5" fill="var(--ink-50)" fontFamily="monospace">TOTAL MOVS: 12</text>
    </g>
  </svg>
);

// ── SVG Illustrations · Reportes ────────────────────────────────────────────────

const IllustrationReportsTypes = () => (
  <svg viewBox="0 0 200 140" className="w-full h-full" fill="none">
    {['INVENTARIO','MOVIMIENTOS','VALORIZACION','ABC','AGING','AJUSTES'].map((t,i) => (
      <g key={t} className="tut-fade-up" style={{animationDelay:`${i*0.1}s`}}>
        <rect x={10 + (i%3)*63} y={14 + Math.floor(i/3)*36} width="58" height="30" rx="2"
          fill={i===0 ? 'var(--ink)' : 'var(--surface)'} stroke="var(--border)" strokeWidth="1.5"/>
        <text x={39 + (i%3)*63} y={32 + Math.floor(i/3)*36} textAnchor="middle" fontSize="5.5"
          fill={i===0 ? 'var(--ink-inv)' : 'var(--ink)'} fontWeight="700" fontFamily="monospace">{t}</text>
      </g>
    ))}
    <text x="100" y="130" textAnchor="middle" fontSize="7" fill="var(--ink)" fontWeight="700" fontFamily="monospace">6 TIPOS DE REPORTE</text>
  </svg>
);

const IllustrationReportsExport = () => (
  <svg viewBox="0 0 200 140" className="w-full h-full" fill="none">
    <g className="tut-fade-up">
      <rect x="30" y="14" width="140" height="18" rx="2" fill="var(--surface)" stroke="var(--border)" strokeWidth="1"/>
      <text x="100" y="26" textAnchor="middle" fontSize="6" fill="var(--ink)" fontWeight="700" fontFamily="monospace">DESDE ▾  HASTA ▾</text>
    </g>
    {[
      {label:'PDF', y:40, fill:'#fee2e2', stroke:'#fca5a5', color:'#dc2626'},
      {label:'PDF ENTREGA', y:62, fill:'#fee2e2', stroke:'#fca5a5', color:'#dc2626'},
      {label:'EXCEL (.XLSX)', y:84, fill:'#dcfce7', stroke:'#86efac', color:'#15803d'},
      {label:'CSV', y:106, fill:'var(--surface)', stroke:'var(--border)', color:'var(--ink)'},
    ].map((r,i) => (
      <g key={r.label} className="tut-fade-up" style={{animationDelay:`${i*0.15}s`}}>
        <rect x="30" y={r.y} width="140" height="16" rx="1" fill={r.fill} stroke={r.stroke} strokeWidth="1.5"/>
        <text x="100" y={r.y+11} textAnchor="middle" fontSize="6" fill={r.color} fontWeight="700" fontFamily="monospace">{r.label}</text>
      </g>
    ))}
  </svg>
);

// ── SVG Illustrations · Usuarios ────────────────────────────────────────────────

const IllustrationUsersMatrix = () => (
  <svg viewBox="0 0 200 140" className="w-full h-full" fill="none">
    <g className="tut-fade-up">
      <rect x="10" y="14" width="55" height="16" fill="var(--ink)"/>
      <text x="37" y="25" textAnchor="middle" fontSize="5" fill="var(--ink-inv)" fontWeight="700" fontFamily="monospace">MODULO</text>
      {['AG','CEO','AD','JA'].map((r,i) => (
        <g key={r}>
          <rect x={65+i*32} y="14" width="32" height="16" fill="var(--surface)" stroke="var(--border)" strokeWidth="1"/>
          <text x={81+i*32} y="25" textAnchor="middle" fontSize="5" fill="var(--ink)" fontWeight="700" fontFamily="monospace">{r}</text>
        </g>
      ))}
    </g>
    {['INVENTARIO','AJUSTES'].map((mod,ri) => (
      <g key={mod} className="tut-fade-up" style={{animationDelay:`${0.2+ri*0.2}s`}}>
        <rect x="10" y={30+ri*20} width="55" height="20" fill="var(--surface)" stroke="var(--border)" strokeWidth="1"/>
        <text x="14" y={43+ri*20} fontSize="5" fill="var(--ink)" fontWeight="700" fontFamily="monospace">{mod}</text>
        {[0,1,2,3].map(ci => {
          const level = (ri+ci) % 3;
          const fill = level === 2 ? 'var(--ink)' : level === 1 ? '#93c5fd' : 'var(--bg-card)';
          const txt = level === 2 ? 'FULL' : level === 1 ? 'VER' : '-';
          const color = level === 2 ? 'var(--ink-inv)' : 'var(--ink)';
          return (
            <g key={ci}>
              <rect x={65+ci*32} y={30+ri*20} width="32" height="20" fill={fill} stroke="var(--border)" strokeWidth="1"/>
              <text x={81+ci*32} y={43+ri*20} textAnchor="middle" fontSize="4.5" fill={color} fontWeight="700" fontFamily="monospace">{txt}</text>
            </g>
          );
        })}
      </g>
    ))}
    <text x="100" y="86" textAnchor="middle" fontSize="6.5" fill="var(--ink)" fontWeight="700" fontFamily="monospace">CLIC = NINGUNO ▸ VER ▸ TOTAL</text>

    <g className="tut-fade-up" style={{animationDelay:'0.7s'}}>
      <rect x="30" y="98" width="140" height="30" rx="2" fill="var(--bg-card)" stroke="var(--border)" strokeWidth="1.5"/>
      <circle cx="48" cy="113" r="9" fill="#dbeafe" stroke="#93c5fd" strokeWidth="1.5"/>
      <path d="M43 113 a5 5 0 0 1 10 0" stroke="#1d4ed8" strokeWidth="1.5" fill="none"/>
      <text x="105" y="110" textAnchor="middle" fontSize="5.5" fill="var(--ink)" fontWeight="700" fontFamily="monospace">VER COMO...</text>
      <text x="105" y="120" textAnchor="middle" fontSize="5" fill="var(--ink-50)" fontFamily="monospace">solo ADMIN_GENERAL, no cambia permisos reales</text>
    </g>
  </svg>
);

// ── Tutorial Steps · Contactos ─────────────────────────────────────────────────────

export const CONTACTS_TUTORIAL_STEPS: TutorialStep[] = [
  {
    title: '¿Qué es Contactos?',
    description: 'Contactos es el directorio de proveedores y clientes vinculados a tus operaciones. Cada contacto guarda su nombre/razón social, RUC o DNI, teléfono y correo, y puede editarse o eliminarse en cualquier momento.',
    illustration: <IllustrationContactsDirectory />,
    tips: [
      'Nombre y RUC/DNI son obligatorios; teléfono y correo son opcionales',
      'Filtra por PROVEEDOR o CLIENTE con el selector de tipo, o busca por nombre/documento',
      'Eliminar un contacto pide confirmación explícita y no se puede deshacer',
    ],
  },
  {
    title: 'Historial por contacto',
    description: 'El ícono de reloj en cada fila abre el historial de movimientos de ese contacto: total recepcionado, total despachado, y la lista completa de transacciones donde participó.',
    illustration: <IllustrationContactsDirectory />,
    tips: [
      'Los totales de Recepciones/Despachos no incluyen traslados, aunque sí aparecen en el conteo total de movimientos',
      'Si el contacto nunca tuvo movimientos, verás "SIN MOVIMIENTOS REGISTRADOS"',
      'Es la forma más rápida de saber cuánto le has comprado a un proveedor específico',
    ],
  },
];

// ── Tutorial Steps · Reportes ──────────────────────────────────────────────────────

export const REPORTS_TUTORIAL_STEPS: TutorialStep[] = [
  {
    title: 'Tipos de Reporte',
    description: 'Reportes ofrece seis vistas distintas: Inventario (stock actual por modelo/talla), Movimientos (recepciones por proveedor), Valorización, ABC (clasifica productos por volumen de despacho), Aging (stock estancado) y Ajustes (historial de correcciones).',
    illustration: <IllustrationReportsTypes />,
    tips: [
      'ABC clasifica en A/B/C según el % acumulado de despacho: A hasta 80%, B hasta 95%, C el resto',
      'Aging marca en rojo los productos sin despacho en 90+ días (el umbral se puede ajustar)',
      'Puedes alternar entre vista de lista o kanban para explorar en pantalla antes de exportar',
    ],
  },
  {
    title: 'Exportar reportes',
    description: 'Cada reporte se puede exportar a PDF, Excel o CSV con un rango de fechas. "PDF Entrega" es un documento formal aparte, basado solo en recepciones, pensado como acta de entrega, con su propio rango de fechas independiente.',
    illustration: <IllustrationReportsExport />,
    tips: [
      '"PDF Entrega" no refleja el stock actual: se basa únicamente en recepciones del rango que elijas',
      'El PDF estándar abre una ventana de impresión del navegador — revisa tu bloqueador de pop-ups si no aparece',
      'El filtro de fechas del reporte principal es independiente del de "PDF Entrega"',
    ],
  },
];

// ── Tutorial Steps · Usuarios ──────────────────────────────────────────────────────

export const USERS_TUTORIAL_STEPS: TutorialStep[] = [
  {
    title: 'Usuarios y Permisos',
    description: 'Aquí administras cuentas de usuario y qué puede ver o editar cada rol en cada módulo. La matriz de permisos se edita con un clic: cada celda avanza de NINGUNO a VER a TOTAL en un ciclo.',
    illustration: <IllustrationUsersMatrix />,
    tips: [
      'Solo un usuario con permiso TOTAL sobre "Usuarios" puede crear cuentas o editar la matriz',
      'La fila de ADMIN_GENERAL no se puede editar desde la matriz: sus permisos están fijos',
      'La cuenta raíz original del sistema no puede editarse ni eliminarse desde esta pantalla, por seguridad',
    ],
  },
  {
    title: '"Ver como" y Notificaciones',
    description: 'ADMIN_GENERAL tiene un selector especial en la barra superior para navegar temporalmente "viendo como" otro rol, útil para verificar qué le aparece a cada tipo de usuario sin cambiar sus permisos reales. La pestaña Notificaciones administra quién recibe copia de los correos de operaciones.',
    illustration: <IllustrationUsersMatrix />,
    tips: [
      '"Ver como" es solo un cambio visual de navegación — nunca modifica los permisos reales del rol',
      'Solo ADMIN_GENERAL puede agregar, editar o eliminar destinatarios de notificaciones por correo',
      'Cambiar la contraseña de un usuario existente es opcional: déjala vacía para no modificarla',
    ],
  },
];

// ── SVG Illustrations · Odoo Stock ──────────────────────────────────────────────

const IllustrationOdooSync = () => (
  <svg viewBox="0 0 200 140" className="w-full h-full" fill="none">
    <g className="tut-float" style={{animationDelay:'0s'}}>
      <rect x="14" y="40" width="60" height="50" rx="4" fill="var(--surface)" stroke="var(--border)" strokeWidth="1.5"/>
      <text x="44" y="60" textAnchor="middle" fontSize="7" fill="var(--ink)" fontWeight="900" fontFamily="monospace">ODOO</text>
      <text x="44" y="72" textAnchor="middle" fontSize="5" fill="var(--ink-50)" fontFamily="monospace">zazuexpress2</text>
    </g>
    <g className="tut-bounce-x">
      <path d="M78 65 L118 65" stroke="#1d4ed8" strokeWidth="1.5" strokeDasharray="3,2" className="tut-draw"/>
      <polygon points="120,65 113,61 113,69" fill="#1d4ed8"/>
    </g>
    <g className="tut-fade-up" style={{animationDelay:'0.3s'}}>
      <rect x="124" y="40" width="62" height="50" rx="2" fill="var(--bg-card)" stroke="var(--border)" strokeWidth="1.5"/>
      <text x="155" y="58" textAnchor="middle" fontSize="6" fill="var(--ink)" fontWeight="700" fontFamily="monospace">PRODUCTOS</text>
      <circle cx="140" cy="70" r="3" fill="#dc2626" className="tut-float"/>
      <circle cx="155" cy="70" r="3" fill="#fcd34d" className="tut-float" style={{animationDelay:'0.5s'}}/>
      <circle cx="170" cy="70" r="3" fill="#86efac" className="tut-float" style={{animationDelay:'1s'}}/>
      <text x="155" y="82" textAnchor="middle" fontSize="4.5" fill="var(--ink-50)" fontFamily="monospace">critico·bajo·ok</text>
    </g>
    <g className="tut-fade-up" style={{animationDelay:'0.6s'}}>
      <rect x="44" y="100" width="112" height="18" rx="1" fill="var(--surface)" stroke="var(--border)" strokeWidth="1"/>
      <text x="100" y="112" textAnchor="middle" fontSize="6" fill="var(--ink-50)" fontFamily="monospace">Conectado · hace 2 min</text>
    </g>
  </svg>
);

const IllustrationOdooTabs = () => (
  <svg viewBox="0 0 200 140" className="w-full h-full" fill="none">
    <g className="tut-fade-up">
      {['PRODUCTOS','UBICACIONES','MOVIMIENTOS'].map((t,i) => (
        <g key={t}>
          <rect x={10+i*63} y="14" width="58" height="16" fill={i===0?'var(--ink)':'var(--surface)'} stroke="var(--border)" strokeWidth="1"/>
          <text x={39+i*63} y="25" textAnchor="middle" fontSize="5" fill={i===0?'var(--ink-inv)':'var(--ink)'} fontWeight="700" fontFamily="monospace">{t}</text>
        </g>
      ))}
    </g>
    {/* sidebar filters */}
    <g className="tut-fade-up" style={{animationDelay:'0.2s'}}>
      <rect x="10" y="36" width="46" height="90" rx="1" fill="var(--surface)" stroke="var(--border)" strokeWidth="1"/>
      <text x="14" y="48" fontSize="5" fill="var(--ink-50)" fontWeight="700" fontFamily="monospace">ALERTA</text>
      <text x="14" y="60" fontSize="5" fill="var(--ink-50)" fontWeight="700" fontFamily="monospace">EMPRESA</text>
      <text x="14" y="72" fontSize="5" fill="var(--ink-50)" fontWeight="700" fontFamily="monospace">PRODUCTO</text>
      <text x="14" y="84" fontSize="5" fill="var(--ink-50)" fontWeight="700" fontFamily="monospace">COLOR</text>
      <text x="14" y="96" fontSize="5" fill="var(--ink-50)" fontWeight="700" fontFamily="monospace">TALLA</text>
    </g>
    {/* product rows with alert dots */}
    {[
      {y:38, color:'#dc2626', label:'Stock critico'},
      {y:60, color:'#fcd34d', label:'Por acabar'},
      {y:82, color:'#86efac', label:'Sobre stock'},
    ].map((r,i) => (
      <g key={r.label} className="tut-fade-up" style={{animationDelay:`${0.4+i*0.15}s`}}>
        <rect x="60" y={r.y} width="126" height="18" rx="1" fill="var(--bg-card)" stroke="var(--border)" strokeWidth="1"/>
        <circle cx="70" cy={r.y+9} r="3" fill={r.color}/>
        <text x="80" y={r.y+11} fontSize="5" fill="var(--ink)" fontWeight="700" fontFamily="monospace">{r.label}</text>
      </g>
    ))}
    <text x="123" y="132" textAnchor="middle" fontSize="6" fill="var(--ink)" fontWeight="700" fontFamily="monospace">SOLO LECTURA · SIN EDICION</text>
  </svg>
);

// ── SVG Illustrations · Reservas ────────────────────────────────────────────────

const IllustrationReservationsKanban = () => (
  <svg viewBox="0 0 200 140" className="w-full h-full" fill="none">
    {['SOLICITADA','CONFIRMADA','LISTA','ENTREGADA'].map((s,i) => (
      <g key={s} className="tut-fade-up" style={{animationDelay:`${i*0.15}s`}}>
        <rect x={8+i*47} y="14" width="42" height="100" rx="1" fill="var(--surface)" stroke="var(--border)" strokeWidth="1"/>
        <text x={29+i*47} y="26" textAnchor="middle" fontSize="4.5" fill="var(--ink-50)" fontWeight="700" fontFamily="monospace">{s}</text>
        <rect x={12+i*47} y="32" width="34" height="26" rx="1" fill="var(--bg-card)" stroke="var(--border)" strokeWidth="1"/>
        <text x={29+i*47} y="42" textAnchor="middle" fontSize="4" fill="var(--ink)" fontWeight="700" fontFamily="monospace">REF-00{i+1}</text>
        <text x={29+i*47} y="52" textAnchor="middle" fontSize="4" fill="var(--ink-50)" fontFamily="monospace">12 u.</text>
      </g>
    ))}
    <g className="tut-bounce-x" style={{animationDelay:'0.6s'}}>
      <path d="M46 45 L56 45" stroke="#1d4ed8" strokeWidth="1.5"/>
      <polygon points="58,45 51,41 51,49" fill="#1d4ed8"/>
    </g>
    <text x="29" y="66" textAnchor="middle" fontSize="4" fill="var(--ink-50)" fontFamily="monospace">▸ avanzar</text>
    <text x="100" y="130" textAnchor="middle" fontSize="7" fill="var(--ink)" fontWeight="700" fontFamily="monospace">EL BOTON "AVANZAR" SOLO SE VE AL PASAR EL MOUSE</text>
  </svg>
);

const IllustrationReservationsStock = () => (
  <svg viewBox="0 0 200 140" className="w-full h-full" fill="none">
    <g className="tut-fade-up">
      <rect x="14" y="14" width="172" height="16" fill="var(--ink)"/>
      <text x="22" y="25" fontSize="5.5" fill="var(--ink-inv)" fontWeight="700" fontFamily="monospace">PRODUCTO</text>
      <text x="120" y="25" fontSize="5.5" fill="var(--ink-inv)" fontWeight="700" fontFamily="monospace">TOTAL / RESERV. / DISP.</text>
    </g>
    {[
      {y:32, name:'SLIM FIT M', total:60, res:12, crit:false},
      {y:52, name:'WAFFLE L',   total:40, res:24, crit:true},
      {y:72, name:'OVERSIZE S', total:30, res:2,  crit:false},
    ].map((r,i) => (
      <g key={r.name} className="tut-fade-up" style={{animationDelay:`${i*0.15}s`}}>
        <rect x="14" y={r.y} width="172" height="18" rx="1" fill={r.crit ? '#fee2e2' : 'var(--surface)'} stroke={r.crit ? '#fca5a5' : 'var(--border)'} strokeWidth="1"/>
        <text x="22" y={r.y+12} fontSize="5.5" fill="var(--ink)" fontWeight="700" fontFamily="monospace">{r.name}</text>
        <text x="180" y={r.y+12} textAnchor="end" fontSize="5.5" fill={r.crit ? '#dc2626' : 'var(--ink)'} fontWeight="700" fontFamily="monospace">{r.total}/{r.res}/{r.total-r.res}</text>
      </g>
    ))}
    <text x="100" y="122" textAnchor="middle" fontSize="6.5" fill="#dc2626" fontWeight="700" fontFamily="monospace">ROJO = 50%+ DEL STOCK RESERVADO</text>
    <g className="tut-fade-up" style={{animationDelay:'0.6s'}}>
      <rect x="70" y="126" width="60" height="12" rx="1" fill="var(--ink)"/>
      <text x="100" y="135" textAnchor="middle" fontSize="5" fill="var(--ink-inv)" fontWeight="700" fontFamily="monospace">EXPORTAR PDF</text>
    </g>
  </svg>
);

// ── SVG Illustrations · Historial General ───────────────────────────────────────

const IllustrationAuditTrail = () => (
  <svg viewBox="0 0 200 140" className="w-full h-full" fill="none">
    {[
      {y:14, action:'INSERT', color:'#15803d', bg:'#dcfce7', table:'products'},
      {y:36, action:'UPDATE', color:'#1d4ed8', bg:'#dbeafe', table:'purchase_orders'},
      {y:58, action:'DELETE', color:'#dc2626', bg:'#fee2e2', table:'stock_levels'},
    ].map((r,i) => (
      <g key={r.action} className="tut-fade-up" style={{animationDelay:`${i*0.15}s`}}>
        <rect x="14" y={r.y} width="172" height="18" rx="1" fill="var(--surface)" stroke="var(--border)" strokeWidth="1"/>
        <rect x="20" y={r.y+3} width="52" height="12" rx="1" fill={r.bg}/>
        <text x="46" y={r.y+11.5} textAnchor="middle" fontSize="4.5" fill={r.color} fontWeight="700" fontFamily="monospace">{r.action}</text>
        <text x="80" y={r.y+12} fontSize="5" fill="var(--ink)" fontWeight="700" fontFamily="monospace">{r.table}</text>
        <text x="180" y={r.y+12} textAnchor="end" fontSize="4.5" fill="var(--ink-50)" fontFamily="monospace">CARLOS · hoy</text>
      </g>
    ))}
    <g className="tut-fade-up" style={{animationDelay:'0.6s'}}>
      <rect x="14" y="82" width="172" height="34" rx="2" fill="var(--bg-card)" stroke="var(--border)" strokeWidth="1.5"/>
      <text x="22" y="95" fontSize="5.5" fill="var(--ink-50)" fontFamily="monospace">ANTES: quantity = 40</text>
      <text x="22" y="106" fontSize="5.5" fill="#15803d" fontWeight="700" fontFamily="monospace">DESPUES: quantity = 35</text>
    </g>
    <text x="100" y="128" textAnchor="middle" fontSize="6.5" fill="var(--ink)" fontWeight="700" fontFamily="monospace">SOLO ADMIN_GENERAL · ULTIMAS 1000 ACCIONES</text>
  </svg>
);

// ── Tutorial Steps · Odoo Stock ──────────────────────────────────────────────────

export const ODOO_STOCK_TUTORIAL_STEPS: TutorialStep[] = [
  {
    title: '¿Qué es Odoo Stock?',
    description: 'Esta vista se conecta en vivo al ERP Odoo (zazuexpress2) y muestra el inventario tal como está registrado ahí: cantidades, variantes, ubicaciones y movimientos recientes. Es de solo lectura — no puedes editar nada desde aquí.',
    illustration: <IllustrationOdooSync />,
    tips: [
      '"Actualizar" vuelve a consultar Odoo en el momento; el sistema no se sincroniza solo en segundo plano',
      'El indicador de arriba (Conectado/Error/Cargando) te dice si la conexión con Odoo está funcionando',
      '"A la mano" es la cantidad física real en Odoo; "Disponible" es esa cantidad menos lo ya reservado en Odoo',
    ],
  },
  {
    title: 'Filtros y niveles de alerta',
    description: 'Puedes filtrar por empresa, producto, color y talla, y por nivel de alerta: stock crítico (menos de 50 unidades), por acabar (50-80) o sobre stock (más de 200). Estos umbrales son fijos, no se pueden configurar desde la app.',
    illustration: <IllustrationOdooTabs />,
    tips: [
      'Si eliges una empresa, las opciones de producto/color/talla se ajustan solo a esa empresa',
      'Un producto con variantes solo desaparece del filtro si TODAS sus variantes fallan el filtro de alerta',
      'El "Reservado" que ves aquí es el de Odoo, no tiene relación con el módulo interno de Reservas',
    ],
  },
];

// ── Tutorial Steps · Reservas ─────────────────────────────────────────────────────

export const RESERVATIONS_TUTORIAL_STEPS: TutorialStep[] = [
  {
    title: 'Tablero Kanban',
    description: 'Cada reserva pasa por cuatro estados en orden: Solicitada, Confirmada, Lista para entrega y Entregada (o Cancelada en cualquier momento). Pasa el mouse sobre una tarjeta para ver el botón que la avanza al siguiente estado.',
    illustration: <IllustrationReservationsKanban />,
    tips: [
      'El botón "Avanzar" solo aparece al pasar el mouse sobre la tarjeta — es fácil pasarlo por alto',
      'Solo se puede avanzar un paso a la vez, no saltar estados',
      'Las columnas Entregada y Cancelada están ocultas por defecto: usa "Ver finalizadas" para mostrarlas',
    ],
  },
  {
    title: 'Stock Reservado',
    description: 'Esta pestaña muestra, por producto, cuánto está reservado versus disponible. Un producto se marca como crítico cuando el 50% o más de su stock total ya está apartado en reservas activas.',
    illustration: <IllustrationReservationsStock />,
    tips: [
      'El cálculo de "crítico" es en vivo: compara reservas activas contra el stock real en ese momento',
      'Puedes exportar esta tabla como PDF para compartirla',
      'Una reserva vencida (fecha de expiración pasada) se marca en rojo pero no se cancela sola',
    ],
  },
];

// ── Tutorial Steps · Historial General ────────────────────────────────────────────

export const OPERATION_HISTORY_TUTORIAL_STEPS: TutorialStep[] = [
  {
    title: '¿Qué es Historial General?',
    description: 'Es la auditoría completa del sistema: cada creación, edición o eliminación en cualquier módulo (productos, ubicaciones, órdenes, usuarios, permisos, etc.) queda registrada con quién la hizo y cuándo, mostrando los valores antes y después del cambio.',
    illustration: <IllustrationAuditTrail />,
    tips: [
      'Solo ADMIN_GENERAL puede ver este historial completo',
      'El registro muestra los valores exactos que cambiaron, no solo que "algo cambió"',
      'Solo se guardan las últimas 1000 acciones: para investigar algo más antiguo necesitarás otra fuente',
    ],
  },
];

// ── SVG Illustrations · Mapa del Almacén ────────────────────────────────────────

const IllustrationMapHeatmap = () => (
  <svg viewBox="0 0 200 140" className="w-full h-full" fill="none">
    {[
      {x:10,  y:14, fill:'var(--bg-card)', stroke:'var(--border)', label:'VACIO'},
      {x:60,  y:14, fill:'#fee2e2', stroke:'#fca5a5', label:'BAJO'},
      {x:110, y:14, fill:'#fef3c7', stroke:'#fcd34d', label:'NORMAL'},
      {x:160, y:14, fill:'#dcfce7', stroke:'#86efac', label:'LLENO'},
    ].map((c,i) => (
      <g key={c.label} className="tut-fade-up" style={{animationDelay:`${i*0.12}s`}}>
        <rect x={c.x} y={c.y} width="34" height="34" rx="2" fill={c.fill} stroke={c.stroke} strokeWidth="1.5"/>
        <text x={c.x+17} y={c.y+50} textAnchor="middle" fontSize="5" fill="var(--ink-50)" fontWeight="700" fontFamily="monospace">{c.label}</text>
      </g>
    ))}
    <g className="tut-fade-up" style={{animationDelay:'0.5s'}}>
      <rect x="30" y="80" width="140" height="20" rx="1" fill="var(--surface)" stroke="var(--border)" strokeWidth="1"/>
      <rect x="30" y="80" width="100" height="20" rx="1" fill="#fcd34d"/>
      <text x="100" y="93" textAnchor="middle" fontSize="6" fill="var(--ink)" fontWeight="700" fontFamily="monospace">71% LLENO</text>
    </g>
    <text x="100" y="118" textAnchor="middle" fontSize="6.5" fill="var(--ink)" fontWeight="700" fontFamily="monospace">CAPACIDAD ES UN ESTIMADO FIJO,</text>
    <text x="100" y="128" textAnchor="middle" fontSize="6.5" fill="var(--ink)" fontWeight="700" fontFamily="monospace">NO UNA CONFIGURACION REAL</text>
  </svg>
);

const IllustrationMapDrilldown = () => (
  <svg viewBox="0 0 200 140" className="w-full h-full" fill="none">
    <g className="tut-fade-up">
      <rect x="10" y="20" width="80" height="90" rx="2" fill="#fef3c7" stroke="#fcd34d" strokeWidth="1.5"/>
      <text x="50" y="35" textAnchor="middle" fontSize="6" fill="var(--ink)" fontWeight="700" fontFamily="monospace">RACK B-02</text>
      <circle cx="82" cy="28" r="6" fill="#dc2626"/>
      <text x="82" y="30.5" textAnchor="middle" fontSize="6" fill="white" fontWeight="900">!</text>
    </g>
    <g className="tut-bounce-x">
      <path d="M94 60 L110 60" stroke="var(--ink)" strokeWidth="1.5"/>
      <polygon points="112,60 105,56 105,64" fill="var(--ink)"/>
    </g>
    <g className="tut-fade-up" style={{animationDelay:'0.3s'}}>
      <rect x="116" y="14" width="76" height="100" rx="2" fill="var(--bg-card)" stroke="var(--border)" strokeWidth="1.5"/>
      <rect x="116" y="14" width="76" height="14" fill="var(--ink)"/>
      <text x="154" y="24" textAnchor="middle" fontSize="5.5" fill="var(--ink-inv)" fontWeight="700" fontFamily="monospace">DETALLE SKUs</text>
      <text x="124" y="40" fontSize="5" fill="var(--ink-50)" fontFamily="monospace">UNIDADES: 142</text>
      <text x="124" y="50" fontSize="5" fill="var(--ink-50)" fontFamily="monospace">SKUs: 8</text>
      <text x="124" y="60" fontSize="5" fill="#dc2626" fontFamily="monospace">ALERTAS: 2</text>
      <rect x="122" y="68" width="64" height="12" rx="1" fill="#fee2e2"/>
      <text x="126" y="76.5" fontSize="4.5" fill="#dc2626" fontWeight="700" fontFamily="monospace">SF-014 · BAJO</text>
      <rect x="122" y="82" width="64" height="12" rx="1" fill="var(--surface)"/>
      <text x="126" y="90.5" fontSize="4.5" fill="var(--ink)" fontFamily="monospace">SF-020 · OK</text>
    </g>
  </svg>
);

// ── SVG Illustrations · Etiquetas ───────────────────────────────────────────────

const IllustrationLabelsGenerate = () => (
  <svg viewBox="0 0 200 140" className="w-full h-full" fill="none">
    <g className="tut-fade-up">
      <rect x="20" y="20" width="70" height="90" rx="2" fill="var(--bg-card)" stroke="var(--border)" strokeWidth="1.5"/>
      <rect x="30" y="30" width="50" height="50" fill="var(--surface)" stroke="var(--border)" strokeWidth="1"/>
      {[0,1,2,3,4].map(r => (
        <g key={r}>
          {[0,1,2,3,4].map(c => ((r+c)%2===0) && <rect key={c} x={32+c*9.5} y={32+r*9.5} width="8" height="8" fill="var(--ink)"/>)}
        </g>
      ))}
      <text x="55" y="92" textAnchor="middle" fontSize="6" fill="var(--ink)" fontWeight="700" fontFamily="monospace">SF-014</text>
      <text x="55" y="101" textAnchor="middle" fontSize="5" fill="var(--ink-50)" fontFamily="monospace">SLIM FIT · NEGRO · M</text>
    </g>
    <g className="tut-fade-up" style={{animationDelay:'0.3s'}}>
      <rect x="110" y="30" width="80" height="16" rx="2" fill="var(--ink)"/>
      <text x="150" y="41" textAnchor="middle" fontSize="5.5" fill="var(--ink-inv)" fontWeight="700" fontFamily="monospace">QR · BARRAS · AMBOS</text>
      <rect x="110" y="54" width="80" height="16" rx="2" fill="var(--surface)" stroke="var(--border)" strokeWidth="1"/>
      <text x="150" y="65" textAnchor="middle" fontSize="5.5" fill="var(--ink)" fontWeight="700" fontFamily="monospace">PEQ · MED · GRANDE</text>
      <rect x="110" y="78" width="80" height="16" rx="2" fill="var(--surface)" stroke="var(--border)" strokeWidth="1"/>
      <text x="150" y="89" textAnchor="middle" fontSize="5" fill="var(--ink)" fontWeight="700" fontFamily="monospace">PRECIO·STOCK·CATEGORIA</text>
    </g>
    <text x="100" y="130" textAnchor="middle" fontSize="6.5" fill="var(--ink)" fontWeight="700" fontFamily="monospace">SELECCIONA VARIOS Y ARMA TU ETIQUETA</text>
  </svg>
);

const IllustrationLabelsPrint = () => (
  <svg viewBox="0 0 200 140" className="w-full h-full" fill="none">
    <g className="tut-fade-up">
      {[0,1,2].map(i => (
        <rect key={i} x={16+i*30} y="20" width="24" height="14" rx="1" fill="var(--surface)" stroke="var(--ink)" strokeWidth="1.5"/>
      ))}
      {[0,1,2].map(i => (
        <path key={i} d={`M${20+i*30} 30 l4 4 l6 -8`} stroke="#15803d" strokeWidth="1.5" fill="none"/>
      ))}
    </g>
    <text x="100" y="46" textAnchor="middle" fontSize="5.5" fill="var(--ink-50)" fontFamily="monospace">3 SELECCIONADAS</text>
    <g className="tut-fade-up" style={{animationDelay:'0.3s'}}>
      <rect x="55" y="56" width="90" height="24" rx="2" fill="var(--ink)"/>
      <text x="100" y="71" textAnchor="middle" fontSize="7" fill="var(--ink-inv)" fontWeight="700" fontFamily="monospace">IMPRIMIR (3)</text>
    </g>
    <g className="tut-fade-up" style={{animationDelay:'0.6s'}}>
      <rect x="60" y="90" width="80" height="40" rx="2" fill="var(--bg-card)" stroke="var(--border)" strokeWidth="1.5"/>
      <path d="M65 95 L135 95" stroke="var(--border)" strokeWidth="1"/>
      <text x="100" y="112" textAnchor="middle" fontSize="5.5" fill="var(--ink-50)" fontFamily="monospace">Ventana emergente</text>
      <text x="100" y="122" textAnchor="middle" fontSize="5.5" fill="#dc2626" fontFamily="monospace">bloqueada = no imprime</text>
    </g>
  </svg>
);

// ── Tutorial Steps · Mapa del Almacén ─────────────────────────────────────────────

export const WAREHOUSE_MAP_TUTORIAL_STEPS: TutorialStep[] = [
  {
    title: 'Mapa de ocupación',
    description: 'El Mapa del Almacén colorea cada ubicación según qué tan llena está: vacía, baja, normal o llena. Es una forma visual rápida de detectar dónde hay espacio y dónde ya no.',
    illustration: <IllustrationMapHeatmap />,
    tips: [
      'La capacidad usada para calcular el % de llenado es un estimado fijo por tipo de ubicación, no una configuración real de tu almacén',
      'Puedes filtrar por tipo de ubicación o por nivel de llenado usando los contadores de arriba',
      'Un triángulo rojo en la esquina de una tarjeta indica que tiene al menos un SKU en stock bajo',
    ],
  },
  {
    title: 'Detalle por ubicación',
    description: 'Haz clic en cualquier tarjeta para ver el detalle completo de esa ubicación: unidades totales, cantidad de SKUs distintos, y alertas de stock bajo, con la lista completa de productos guardados ahí.',
    illustration: <IllustrationMapDrilldown />,
    tips: [
      'Los productos en alerta de stock bajo se resaltan en rojo dentro del panel de detalle',
      'Este módulo es solo de consulta: para mover o editar stock, ve a Operaciones o Ubicaciones',
      'Los filtros de arriba (VACIO/BAJO/NORMAL/LLENO) también funcionan como botones para saltar directo a ese grupo',
    ],
  },
];

// ── Tutorial Steps · Etiquetas ─────────────────────────────────────────────────────

export const LABELS_TUTORIAL_STEPS: TutorialStep[] = [
  {
    title: 'Generar etiquetas',
    description: 'Elige si quieres etiquetar Productos o Ubicaciones, luego selecciona el tipo de código (QR, barras o ambos), el tamaño de la etiqueta, y qué información adicional mostrar (precio, stock, categoría).',
    illustration: <IllustrationLabelsGenerate />,
    tips: [
      'El QR guarda todos los datos del producto o ubicación; el código de barras solo guarda el código o nombre',
      'El código de barras trunca a 30 caracteres y solo admite texto simple (sin tildes ni ñ)',
      'Puedes combinar QR y barras en la misma etiqueta si eliges "AMBOS"',
    ],
  },
  {
    title: 'Selección masiva e impresión',
    description: 'Selecciona uno o varios productos/ubicaciones con clic (o "SELEC. TODOS"), revisa la vista previa en pantalla, y presiona IMPRIMIR para abrir el diálogo de impresión del navegador con todas las etiquetas listas.',
    illustration: <IllustrationLabelsPrint />,
    tips: [
      'Si tu navegador bloquea ventanas emergentes, la impresión no se abrirá — revisa el bloqueador de pop-ups',
      'El botón IMPRIMIR se deshabilita si no has seleccionado ningún elemento',
      '"LIMPIAR" deselecciona todo de una vez si quieres empezar de nuevo',
    ],
  },
];

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

export const TutorialModal: React.FC<TutorialModalProps> = ({ open, onClose, steps, title = 'Operaciones' }) => {
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
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8"
      style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        className="w-full flex flex-col overflow-hidden"
        style={{
          background: 'var(--bg-card)',
          border: '2px solid var(--border)',
          boxShadow: '10px 10px 0 var(--border)',
          animation: 'tutorial-modal-in 0.25s ease both',
          maxWidth: '860px',
          maxHeight: '92vh',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Progress bar */}
        <div className="h-[3px] w-full" style={{ background: 'var(--surface)' }}>
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
          className="flex items-center justify-between px-6 py-3 border-b shrink-0"
          style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
        >
          <div className="flex items-center gap-2.5">
            <BookOpen size={15} style={{ color: 'var(--ink)' }} />
            <span className="font-mono text-[11px] font-black uppercase tracking-[0.22em]" style={{ color: 'var(--ink)' }}>
              Tutorial · {title}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="font-mono text-[10px] font-bold" style={{ color: 'var(--ink-50)' }}>
              {current + 1} / {steps.length}
            </span>
            <button
              onClick={onClose}
              className="p-1 hover:opacity-60 transition-opacity"
              style={{ color: 'var(--ink)' }}
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Body — 2 columns: illustration left, text right */}
        <div className="flex flex-1 overflow-hidden min-h-0">

          {/* Left: illustration panel */}
          <div
            className="hidden md:flex items-center justify-center shrink-0"
            style={{
              width: '320px',
              background: 'var(--surface)',
              borderRight: '1px solid var(--border)',
              padding: '32px 24px',
            }}
          >
            <div
              key={animKey}
              style={{ width: '100%', maxHeight: '280px', animation: `${slideAnim} 0.35s ease both` }}
            >
              {step.illustration}
            </div>
          </div>

          {/* Right: text content */}
          <div
            className="flex-1 overflow-y-auto"
            key={animKey}
            style={{ animation: `${slideAnim} 0.3s ease both` }}
          >
            {/* Mobile illustration */}
            <div
              className="md:hidden flex items-center justify-center px-6 pt-6"
              style={{ height: '180px' }}
            >
              {step.illustration}
            </div>

            <div className="px-8 py-8">
              {/* Step badge */}
              <div className="flex items-center gap-2 mb-4">
                <div
                  className="font-mono text-[9px] font-black uppercase tracking-[0.25em] px-2.5 py-1"
                  style={{
                    background: 'var(--ink)',
                    color: 'var(--ink-inv)',
                  }}
                >
                  Paso {current + 1}
                </div>
                {steps.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => goTo(i)}
                    className="transition-all duration-300"
                    title={`Ir al paso ${i + 1}`}
                    style={{
                      width: i === current ? '24px' : '7px',
                      height: '7px',
                      borderRadius: '4px',
                      background: i === current ? 'var(--ink)' : 'var(--border)',
                    }}
                  />
                ))}
              </div>

              {/* Title */}
              <h2
                className="font-mono font-black uppercase mb-4"
                style={{ color: 'var(--ink)', fontSize: '20px', lineHeight: '1.25', letterSpacing: '.04em' }}
              >
                {step.title}
              </h2>

              {/* Description */}
              <p
                className="font-mono leading-relaxed mb-6"
                style={{ color: 'var(--ink-50)', fontSize: '13px', lineHeight: '1.75' }}
              >
                {step.description}
              </p>

              {/* Tips */}
              {step.tips && step.tips.length > 0 && (
                <div
                  className="flex flex-col gap-3 p-4"
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <span
                    className="font-mono font-black uppercase tracking-[0.22em]"
                    style={{ color: 'var(--ink)', fontSize: '9px' }}
                  >
                    Consejos prácticos
                  </span>
                  {step.tips.map((tip, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div
                        className="shrink-0 font-mono font-black text-[9px] mt-[2px] flex items-center justify-center"
                        style={{
                          width: '18px',
                          height: '18px',
                          background: 'var(--ink)',
                          color: 'var(--ink-inv)',
                          borderRadius: '2px',
                        }}
                      >
                        {i + 1}
                      </div>
                      <span
                        className="font-mono leading-snug"
                        style={{ color: 'var(--ink)', fontSize: '12px', lineHeight: '1.6' }}
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
          className="px-6 py-4 flex items-center justify-between border-t shrink-0"
          style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
        >
          <button
            onClick={() => goTo(current - 1)}
            disabled={current === 0}
            className="flex items-center gap-2 px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-wider border transition-all duration-150 disabled:opacity-25 disabled:cursor-not-allowed hover:opacity-70"
            style={{
              borderColor: 'var(--border)',
              color: 'var(--ink)',
              background: 'var(--bg-card)',
            }}
          >
            <ChevronLeft size={13} />
            Anterior
          </button>

          {/* Keyboard hint */}
          <span className="font-mono text-[9px] hidden md:block" style={{ color: 'var(--ink-50)', opacity: .5 }}>
            ← → para navegar · ESC para cerrar
          </span>

          {current < steps.length - 1 ? (
            <button
              onClick={() => goTo(current + 1)}
              className="flex items-center gap-2 px-5 py-2 font-mono text-[11px] font-bold uppercase tracking-wider border transition-all duration-150 hover:opacity-85"
              style={{
                borderColor: 'var(--border)',
                color: 'var(--ink-inv)',
                background: 'var(--ink)',
              }}
            >
              Siguiente
              <ChevronRight size={13} />
            </button>
          ) : (
            <button
              onClick={onClose}
              className="flex items-center gap-2 px-5 py-2 font-mono text-[11px] font-bold uppercase tracking-wider border transition-all duration-150 hover:opacity-85"
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
  );
};
